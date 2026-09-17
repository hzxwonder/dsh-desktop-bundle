import {homedir} from 'node:os';
import {StringDecoder} from 'node:string_decoder';

/**
 * Remote terminal sessions deliberately use a separate namespace from the
 * official local `ctx.terminals` registry.  The SSH process is still created
 * through the Harness subprocess provider, so the same execution-world and
 * teardown rules apply without pretending that a remote PTY is a local shell.
 */

export const DEFAULT_REMOTE_CONFIG = Object.freeze({
  rows: 40,
  cols: 160,
  maxBytes: 256 * 1024,
  maxLines: 10000,
  idleSilenceMs: 1000,
  startupWaitMs: 350,
  timeoutMs: 30000,
  graceMs: 3000,
});

const HOST_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,253}$/;
const REMOTE_CWD_PATTERN = /^\/[\x20-\x7e]*$/;
const SIGNALS = new Set(['SIGINT', 'SIGTERM', 'SIGKILL', 'SIGTSTP', 'SIGHUP']);
const encoder = new TextEncoder();

export function validateRemoteHost(host) {
  if (typeof host !== 'string' || !HOST_PATTERN.test(host)) {
    throw new Error('REMOTE_TERMINAL_INVALID_HOST');
  }
  return host;
}

export function validateRemoteCwd(cwd) {
  if (cwd === undefined) return undefined;
  if (typeof cwd !== 'string' || !REMOTE_CWD_PATTERN.test(cwd) || cwd.includes('\0')) {
    throw new Error('REMOTE_TERMINAL_INVALID_CWD');
  }
  return cwd;
}

/** Quote one path for the remote login shell without invoking a local shell. */
export function quoteRemotePath(path) {
  validateRemoteCwd(path);
  return `'${path.replaceAll("'", "'\\\"'\\\"'")}'`;
}

export function redactRemoteText(value, limit = 65536) {
  return String(value).slice(0, limit)
    .replace(/\b(?:sk-[\w-]{16,}|gh[pousr]_[\w]{20,})\b/g, '[redacted]')
    .replace(/((?:authorization|cookie|password|secret|token|api[_-]?key)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]');
}

export function buildSshArgv(program, host, cwd) {
  validateRemoteHost(host);
  validateRemoteCwd(cwd);
  const argv = [
    program,
    '-tt',
    '-o', 'BatchMode=yes',
    '-o', 'StrictHostKeyChecking=yes',
    '-o', 'ConnectTimeout=10',
    '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=2',
    host,
  ];
  // An absent command lets the configured login shell choose the remote
  // session. When a directory is requested, pass one safely quoted command
  // that changes directory and then hands control back to the user's shell.
  if (cwd !== undefined) argv.push(`cd -- ${quoteRemotePath(cwd)} && exec "$SHELL" -i`);
  return argv;
}

/**
 * The local shell argv confined by the Session's own sandbox policy. A panel
 * terminal is not an Agent terminal, so the official terminal backends cannot
 * own it; this mirrors their confinement step instead of spawning an
 * unconfined shell behind the policy's back.
 */
export function localShellArgv(ctx, program, policy) {
  const argv = [program, ...(process.platform === 'win32' ? ['-NoLogo'] : ['-i'])];
  if (policy === undefined || policy.mode === 'danger-full-access') return argv;
  const sandbox = ctx.get?.('sandbox');
  if (sandbox === undefined) throw new Error('TERMINAL_SANDBOX_UNAVAILABLE');
  return sandbox.confine(argv, {...policy, mode: policy.mode}).argv;
}

function utf8Tail(value, maxBytes) {
  if (encoder.encode(value).byteLength <= maxBytes) return {value, truncated: false};
  const chars = Array.from(value);
  let bytes = 0;
  let start = chars.length;
  while (start > 0) {
    const next = encoder.encode(chars[start - 1]).byteLength;
    if (bytes + next > maxBytes) break;
    bytes += next;
    start -= 1;
  }
  return {value: chars.slice(start).join(''), truncated: true};
}

function stripAnsi(value) {
  return String(value)
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g, '')
    .replace(/\u001b\[[0-?]*[ -\/]*[@-~]/g, '')
    .replace(/\u001b[@-_]/g, '')
    .replaceAll('\r\n', '\n')
    .replaceAll('\r', '\n')
    .replaceAll('\u0007', '');
}

class BoundedScrollback {
  constructor(maxBytes, maxLines) {
    this.maxBytes = maxBytes;
    this.maxLines = maxLines;
    this.value = '';
    this.dropped = false;
  }

  append(text) {
    if (text.length === 0) return;
    this.value += text;
    const lines = this.value.split('\n');
    if (lines.length > this.maxLines) {
      this.value = lines.slice(-this.maxLines).join('\n');
      this.dropped = true;
    }
    const bounded = utf8Tail(this.value, this.maxBytes);
    this.value = bounded.value;
    this.dropped ||= bounded.truncated;
  }

  read(request = {}) {
    const offset = request.offset === undefined ? 0 : request.offset;
    const count = request.count === undefined ? 500 : request.count;
    if (!Number.isSafeInteger(offset) || offset < 0 || !Number.isSafeInteger(count) || count <= 0) {
      throw new Error('REMOTE_TERMINAL_INVALID_READ');
    }
    const lines = this.value.split('\n');
    const end = Math.max(0, lines.length - offset);
    const begin = Math.max(0, end - Math.min(count, 2000));
    return {
      text: redactRemoteText(lines.slice(begin, end).join('\n'), this.maxBytes),
      totalLines: lines.length,
      lineBegin: begin,
      lineEnd: end,
      truncated: this.dropped || begin > 0 && offset + count < lines.length,
    };
  }
}

class SendOperation {
  constructor(session, request) {
    this.session = session;
    this.request = request;
    this.output = '';
    this.truncated = false;
    this.finished = false;
    this.started = false;
    this.idleTimer = undefined;
    this.timeoutTimer = undefined;
    this.abortHandler = undefined;
    this.resolve = undefined;
    this.reject = undefined;
    this.done = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }

  append(text) {
    if (this.finished || text.length === 0) return;
    const bounded = utf8Tail(this.output + text, this.session.config.maxBytes);
    this.output = bounded.value;
    this.truncated ||= bounded.truncated;
    this.armIdle();
  }

  armIdle() {
    if (this.finished || !this.started) return;
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.session.finishSend(this, 'inferred_idle'), this.session.config.idleSilenceMs);
  }

  clearTimers() {
    clearTimeout(this.idleTimer);
    clearTimeout(this.timeoutTimer);
    this.idleTimer = undefined;
    this.timeoutTimer = undefined;
    if (this.request.signal && this.abortHandler) this.request.signal.removeEventListener('abort', this.abortHandler);
  }

  settle(reason) {
    if (this.finished) return;
    this.finished = true;
    this.clearTimers();
    this.resolve({
      viewport: redactRemoteText(this.output, this.session.config.maxBytes),
      waitReason: reason,
      sessionStatus: this.session.status(),
      truncated: this.truncated || this.session.scrollback.dropped,
    });
  }

  fail(error) {
    if (this.finished) return;
    this.finished = true;
    this.clearTimers();
    this.reject(error);
  }

  readOutput() {
    const output = {delta: this.output, truncated: this.truncated};
    this.output = '';
    this.truncated = false;
    return output;
  }

  cancel() {
    if (this.finished) return false;
    void this.session.interrupt().catch(error => this.fail(error));
    return true;
  }
}

/** A small line-oriented adapter over the official subprocess terminal handle. */
export class RemoteTerminalSession {
  constructor(terminal, config = {}) {
    this.terminal = terminal;
    this.config = {...DEFAULT_REMOTE_CONFIG, ...config};
    this.pid = terminal.pid;
    this.scrollback = new BoundedScrollback(this.config.maxBytes, this.config.maxLines);
    this.active = undefined;
    this.closed = false;
    this.exited = false;
    this.exitFacts = undefined;
    this.motd = '';
    this.outputListeners = [];
    this.decoder = new StringDecoder('utf8');
    this.raw = '';
    this.rawCursor = 0;
    terminal.output.on('data', chunk => this.onData(chunk));
    terminal.output.once('end', () => this.onExit({exitCode: null, signal: null}));
    terminal.output.once('error', error => this.onError(error));
    terminal.done.then(outcome => this.onExit(outcome), error => this.onError(error));
  }

  onData(chunk) {
    const raw = Buffer.isBuffer(chunk) ? this.decoder.write(chunk) : String(chunk);
    this.rawCursor += raw.length;
    this.raw = utf8Tail(this.raw + raw, this.config.maxBytes).value;
    const text = redactRemoteText(stripAnsi(raw), this.config.maxBytes);
    if (text.length === 0) return;
    this.scrollback.append(text);
    if (!this.active) this.motd = utf8Tail(this.motd + text, this.config.maxBytes).value;
    this.active?.append(text);
  }

  onExit(facts) {
    if (this.exited) return;
    this.exited = true;
    this.exitFacts = {exitCode: facts?.exitCode ?? null, signal: facts?.signal ?? null};
    this.active?.settle('session_exit');
  }

  onError(error) {
    if (this.exited) return;
    this.exited = true;
    this.exitFacts = {exitCode: null, signal: null};
    this.active?.fail(error);
  }

  status() {
    return this.exited
      ? {kind: 'exited', exitCode: this.exitFacts?.exitCode ?? null, signal: this.exitFacts?.signal ?? null}
      : {kind: 'running'};
  }

  startSend(request) {
    if (this.closed || this.exited) throw new Error('REMOTE_TERMINAL_SESSION_CLOSED');
    if (this.active && !this.active.finished) throw new Error('REMOTE_TERMINAL_SEND_ACTIVE');
    if (!request || typeof request.text !== 'string' || request.text.length > 65536) throw new Error('REMOTE_TERMINAL_INVALID_TEXT');
    const operation = new SendOperation(this, request);
    this.active = operation;
    operation.abortHandler = () => {
      void this.interrupt().catch(error => operation.fail(error));
      operation.fail(request.signal?.reason ?? new Error('REMOTE_TERMINAL_ABORTED'));
    };
    request.signal?.addEventListener('abort', operation.abortHandler, {once: true});
    void (async () => {
      try {
        await this.terminal.write(request.text + (request.submit === false ? '' : '\n'));
        operation.started = true;
        operation.timeoutTimer = setTimeout(() => this.finishSend(operation, 'timeout'), this.config.timeoutMs);
        operation.armIdle();
        if (this.exited) operation.settle('session_exit');
      } catch (error) {
        operation.fail(error);
      }
    })();
    return operation;
  }

  finishSend(operation, reason) {
    if (this.active !== operation || operation.finished) return;
    operation.settle(reason);
  }

  read(request) {
    return this.scrollback.read(request);
  }

  readStream(cursor = 0) {
    if (!Number.isSafeInteger(cursor) || cursor < 0 || cursor > this.rawCursor) throw new Error('REMOTE_TERMINAL_INVALID_READ');
    const start = this.rawCursor - this.raw.length;
    return {text: this.raw.slice(Math.max(0, cursor - start)), cursor: this.rawCursor, reset: cursor < start, status: this.status()};
  }

  async write(text) {
    if (this.closed || this.exited) throw new Error('REMOTE_TERMINAL_SESSION_CLOSED');
    if (typeof text !== 'string' || text.length > 65536) throw new Error('REMOTE_TERMINAL_INVALID_TEXT');
    await this.terminal.write(text);
    return {written: true};
  }

  resize(cols, rows) {
    if (!Number.isInteger(cols) || !Number.isInteger(rows) || cols < 2 || cols > 500 || rows < 1 || rows > 200) throw new Error('REMOTE_TERMINAL_INVALID_SIZE');
    // A shell that has exited leaves a prompt on screen while its pty is gone:
    // resizing that handle aborts the Host process outright, so a dead session
    // answers like one without a resize-capable handle.
    if (this.closed || this.exited) return {resized: false};
    // Harness local's owned node-pty handle supplies resize until the public contract exposes it.
    const handle = typeof this.terminal.resize === 'function' ? this.terminal : this.terminal.terminal;
    if (typeof handle?.resize !== 'function') return {resized: false};
    handle.resize(cols, rows);
    return {resized: true};
  }

  async interrupt() {
    if (this.exited) return;
    await this.terminal.signalForeground('SIGINT');
  }

  async signal(signal) {
    if (!SIGNALS.has(signal)) throw new Error('REMOTE_TERMINAL_INVALID_SIGNAL');
    if (this.exited) throw new Error('REMOTE_TERMINAL_SESSION_CLOSED');
    const targetPgid = await this.terminal.signalForeground(signal);
    return {delivered: true, targetPgid};
  }

  async close(reason = 'model request') {
    if (this.closed) return;
    this.closed = true;
    this.active?.settle('session_exit');
    await this.terminal.terminate(reason);
    this.onExit(this.exitFacts ?? {exitCode: null, signal: null});
  }
}

export class RemoteTerminalManager {
  constructor(ctx, config = {}) {
    this.ctx = ctx;
    this.config = {...DEFAULT_REMOTE_CONFIG, ...config};
    this.hosts = config.hosts === undefined ? undefined : new Set(config.hosts.map(validateRemoteHost));
    this.sessions = new Map();
    this.nextId = 0;
    this.disposed = false;
  }

  assertOwner(owner) {
    if (!owner) throw new Error('REMOTE_TERMINAL_AGENT_REQUIRED');
  }

  assertHost(host) {
    validateRemoteHost(host);
    if (this.hosts && !this.hosts.has(host)) throw new Error('REMOTE_TERMINAL_HOST_NOT_ALLOWED');
  }

  assertOwned(owner, id) {
    const record = this.sessions.get(id);
    if (!record) throw new Error('REMOTE_TERMINAL_NO_SESSION');
    if (record.owner !== owner) throw new Error('REMOTE_TERMINAL_FOREIGN_SESSION');
    return record.session;
  }

  async open(owner, args, signal) {
    this.assertOwner(owner);
    if (this.disposed) throw new Error('REMOTE_TERMINAL_DISPOSED');
    const ssh = this.ctx.get?.('sshWorkbench');
    const target = !args.host && !args.connectionId ? ssh?.getTarget(owner.session?.id) : undefined;
    const connection = ssh ? ssh.resolve({...args, connectionId: args.connectionId ?? target?.connectionId}) : undefined;
    if (args.connectionId && !ssh) throw new Error('REMOTE_TERMINAL_SSH_PLUGIN_REQUIRED');
    const host = connection?.host ?? args.host;
    this.assertHost(host);
    if (connection && !ssh.allowed(connection)) throw new Error('SSH_HOST_NOT_ALLOWED');
    const requestedCwd = args.cwd ?? target?.path ?? (connection?.directory?.startsWith('/') ? connection.directory : undefined);
    const cwd = validateRemoteCwd(requestedCwd);
    if (args.name !== undefined && (typeof args.name !== 'string' || args.name.length === 0 || args.name.length > 80)) {
      throw new Error('REMOTE_TERMINAL_INVALID_NAME');
    }
    if (args.name !== undefined && [...this.sessions.values()].some(record => record.owner === owner && record.name === args.name)) {
      throw new Error('REMOTE_TERMINAL_DUPLICATE_NAME');
    }
    signal?.throwIfAborted();
    const program = await this.ctx.subprocess.resolveExecutable('ssh', undefined, signal);
    const authentication = connection ? await ssh.passwords.prepare(connection) : undefined;
    const command = cwd === undefined ? 'export TERM=xterm-256color; exec "$SHELL" -i' : `cd -- ${quoteRemotePath(cwd)} && export TERM=xterm-256color && exec "$SHELL" -i`;
    const argv = connection ? ssh.argv(program, connection, command) : buildSshArgv(program, host, cwd);
    if (connection) argv[1] = '-tt';
    let terminal;
    try { terminal = await this.ctx.subprocess.spawnTerminal({
      argv, env: authentication?.env,
      cwd: owner.session?.header?.cwd ?? homedir(),
      rows: this.config.rows,
      cols: this.config.cols,
      graceMs: this.config.graceMs,
      signal,
    }); } catch (error) { await authentication?.dispose(); throw error; }
    void terminal.done.finally(() => authentication?.dispose()).catch(() => {});
    const session = new RemoteTerminalSession(terminal, this.config);
    const id = `remote-pty-${++this.nextId}`;
    const record = {id, owner, name: args.name, host, cwd, session};
    this.sessions.set(id, record);
    await new Promise(resolve => setTimeout(resolve, this.config.startupWaitMs));
    if (session.status().kind === 'exited') {
      this.sessions.delete(id);
      await session.close('startup failed').catch(() => {});
      throw new Error('REMOTE_TERMINAL_START_FAILED');
    }
    return this.snapshot(record, true);
  }

  async openLocal(owner, signal) {
    this.assertOwner(owner);
    if (this.disposed) throw new Error('REMOTE_TERMINAL_DISPOSED');
    const shell = process.platform === 'win32' ? 'pwsh' : process.env.SHELL || '/bin/sh';
    const program = await this.ctx.subprocess.resolveExecutable(shell, undefined, signal);
    const argv = localShellArgv(this.ctx, program, this.ctx.get?.('sandboxPolicy')?.resolve({session: owner.session}));
    const terminal = await this.ctx.subprocess.spawnTerminal({argv, cwd: owner.session?.header?.cwd ?? homedir(), rows: this.config.rows, cols: this.config.cols, graceMs: this.config.graceMs, signal});
    const session = new RemoteTerminalSession(terminal, this.config);
    const id = `local-pty-${++this.nextId}`;
    const record = {id, owner, host: 'localhost', cwd: owner.session?.header?.cwd, session};
    this.sessions.set(id, record);
    await new Promise(resolve => setTimeout(resolve, this.config.startupWaitMs));
    if (session.status().kind === 'exited') {
      this.sessions.delete(id);
      await session.close('startup failed').catch(() => {});
      throw new Error('TERMINAL_START_FAILED');
    }
    return this.snapshot(record, true);
  }

  snapshot(record, includeMotd = false) {
    return {
      sessionId: record.id,
      ...(record.name === undefined ? {} : {name: record.name}),
      host: record.host,
      ...(record.cwd === undefined ? {} : {cwd: record.cwd}),
      pid: record.session.pid,
      status: record.session.status(),
      ...(includeMotd ? {motd: record.session.motd || '(no startup output)'} : {}),
    };
  }

  send(owner, id, args, signal) {
    const session = this.assertOwned(owner, id);
    return session.startSend({text: args.text, submit: args.submit !== false, signal});
  }

  read(owner, id, args) {
    return this.assertOwned(owner, id).read(args);
  }

  readStream(owner, id, cursor) { return this.assertOwned(owner, id).readStream(cursor); }
  write(owner, id, text) { return this.assertOwned(owner, id).write(text); }
  resize(owner, id, cols, rows) { return this.assertOwned(owner, id).resize(cols, rows); }

  signal(owner, id, signal) {
    return this.assertOwned(owner, id).signal(signal);
  }

  async close(owner, id) {
    const record = this.sessions.get(id);
    const session = this.assertOwned(owner, id);
    await session.close('model request');
    this.sessions.delete(record.id);
    return {sessionId: record.id, outcome: 'closed'};
  }

  list(owner) {
    return [...this.sessions.values()].filter(record => record.owner === owner).map(record => this.snapshot(record));
  }

  async closeOwner(owner) {
    const records = [...this.sessions.values()].filter(record => record.owner === owner);
    await Promise.allSettled(records.map(async record => {
      await record.session.close('owner disposed');
      this.sessions.delete(record.id);
    }));
  }

  async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const records = [...this.sessions.values()];
    await Promise.allSettled(records.map(async record => {
      await record.session.close('plugin disposed');
      this.sessions.delete(record.id);
    }));
  }
}
