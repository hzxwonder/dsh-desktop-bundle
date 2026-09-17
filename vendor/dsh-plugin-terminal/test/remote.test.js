import {PassThrough} from 'node:stream';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  RemoteTerminalSession,
  buildSshArgv,
  quoteRemotePath,
  redactRemoteText,
  validateRemoteCwd,
  validateRemoteHost,
} from '../remote.js';

function fakeTerminal() {
  const output = new PassThrough();
  let resolveDone;
  const terminal = {
    pid: 4321,
    output,
    done: new Promise(resolve => { resolveDone = resolve; }),
    writes: [],
    foregroundSignal: undefined,
    async write(data) {
      this.writes.push(data);
      output.write(`echo: ${data.replaceAll('\n', '')}\n`);
    },
    async inspectForeground() { return {processGroupId: 4321, inputWaiting: true}; },
    async signalForeground(signal) { this.foregroundSignal = signal; return 4321; },
    async terminate() {
      output.end();
      resolveDone({exitCode: 0, signal: null});
    },
  };
  return terminal;
}

test('interactive stream preserves ANSI and UTF-8, cursors, raw keys and bounded history', async () => {
  const terminal = fakeTerminal();
  terminal.resize = (cols, rows) => {terminal.size = [cols, rows];};
  const session = new RemoteTerminalSession(terminal, {maxBytes: 64});
  const bytes = Buffer.from('\u001b[32m中文\u001b[0m');
  terminal.output.write(bytes.subarray(0, 6)); terminal.output.write(bytes.subarray(6));
  const first = session.readStream();
  assert.equal(first.text, '\u001b[32m中文\u001b[0m');
  assert.equal(session.readStream(first.cursor).text, '');
  assert.throws(() => session.readStream(-1), /INVALID_READ/);
  await session.write('\u0003'); assert.equal(terminal.writes.at(-1), '\u0003');
  session.resize(90, 24); assert.deepEqual(terminal.size, [90, 24]);
  assert.throws(() => session.resize(0, 24), /INVALID_SIZE/);
  terminal.output.write('a'.repeat(128));
  assert.equal(session.readStream(first.cursor).reset, true);
  assert(session.readStream().text.length <= 64);
  await session.close();
  await assert.rejects(session.write('x'), /SESSION_CLOSED/);
});

test('remote host and cwd validation rejects option injection', () => {
  assert.equal(validateRemoteHost('user@example.com'), 'user@example.com');
  assert.equal(validateRemoteCwd('/srv/project'), '/srv/project');
  for (const host of ['-oProxyCommand=x', 'host;id', 'host\nother', '']) assert.throws(() => validateRemoteHost(host));
  for (const cwd of ['relative', '../outside', '']) assert.throws(() => validateRemoteCwd(cwd));
  assert.equal(quoteRemotePath("/srv/it's"), "'/srv/it'\\\"'\\\"'s'");
});

test('ssh argv uses strict host policy and quotes remote cwd', () => {
  const argv = buildSshArgv('/usr/bin/ssh', 'dev', "/srv/it's");
  assert.deepEqual(argv.slice(0, 10), ['/usr/bin/ssh', '-tt', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', '-o', 'ConnectTimeout=10', '-o', 'ServerAliveInterval=15']);
  assert.match(argv.at(-1), /^cd -- '\/srv\/it/);
  assert.doesNotMatch(argv.join(' '), /ProxyCommand|UserKnownHostsFile/);
});

test('remote session sends, retains bounded output, signals and closes', async () => {
  const terminal = fakeTerminal();
  const session = new RemoteTerminalSession(terminal, {idleSilenceMs: 20, timeoutMs: 200, maxBytes: 4096, maxLines: 100});
  const operation = session.startSend({text: 'pwd', submit: true});
  const result = await operation.done;
  assert.equal(result.waitReason, 'inferred_idle');
  assert.match(result.viewport, /echo: pwd/);
  assert.match(session.read({count: 10}).text, /echo: pwd/);
  assert.deepEqual(await session.signal('SIGINT'), {delivered: true, targetPgid: 4321});
  assert.equal(terminal.foregroundSignal, 'SIGINT');
  await session.close();
  assert.equal(session.status().kind, 'exited');
});

test('remote session prevents concurrent sends and redacts token-shaped output', async () => {
  const terminal = fakeTerminal();
  terminal.write = async data => terminal.output.write(`token=sk-${'x'.repeat(20)} ${data}\n`);
  const session = new RemoteTerminalSession(terminal, {idleSilenceMs: 20, timeoutMs: 200});
  const operation = session.startSend({text: 'echo', submit: false});
  assert.throws(() => session.startSend({text: 'second', submit: false}), /SEND_ACTIVE/);
  const result = await operation.done;
  assert.match(result.viewport, /token=\[redacted\]/);
  assert.equal(redactRemoteText('api-key=secret'), 'api-key=[redacted]');
  await session.close();
});

test('an exited session never reaches the pty handle again', async () => {
  // Resizing the pty of a shell that already exited aborts the Host process, so
  // the panel's reattach resize must be refused before it touches the handle.
  const terminal = fakeTerminal();
  const calls = [];
  terminal.resize = (cols, rows) => { calls.push([cols, rows]); terminal.size = [cols, rows]; };
  const session = new RemoteTerminalSession(terminal, {idleSilenceMs: 20, timeoutMs: 200});
  assert.deepEqual(session.resize(90, 24), {resized: true});
  assert.deepEqual(calls, [[90, 24]]);
  await session.close();
  assert.equal(session.status().kind, 'exited');
  assert.deepEqual(session.resize(120, 40), {resized: false});
  assert.deepEqual(calls, [[90, 24]]);
});
