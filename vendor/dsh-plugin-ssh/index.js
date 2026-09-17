import { createHash } from 'node:crypto';
import { readFile, readdir, realpath, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join } from 'node:path';
import z from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import {SshPasswords, credentialId} from './auth.js';
import {installSshWeb} from './web.js';

export const name = 'dsh-plugin-ssh';
export const inject = ['tools', 'subprocess', 'commands'];
export const SSH_SETTINGS_NAMESPACE = 'ssh';
const worker = await readFile(new URL('./remote.py', import.meta.url), 'utf8');
const workerCommand = `python3 -c 'import base64;exec(base64.b64decode("${Buffer.from(worker).toString('base64')}"))'`;
const actions = ['hosts', 'connections', 'import', 'save_connection', 'remove_connection', 'save', 'remove', 'probe', 'connect', 'exec', 'list', 'listFiles', 'read', 'readFile', 'write', 'terminal', 'passwordStatus', 'getTarget', 'setTarget', 'clearTarget', 'projects'];
const SSH_COMMAND_USAGE = 'Usage: /ssh <host> <absolute-remote-root>\nExample: /ssh dev /srv/project';

const DEFAULT_CONNECTION = Object.freeze({
  authMode: 'agent',
  user: '',
  port: 22,
  identityFile: '',
  jumpHost: '',
  directory: '~',
  alias: false,
  connectTimeout: 10,
  keepalive: 15,
});

export const ConnectionSchema = z.object({
  id: z.string().min(1).max(100),
  authMode: z.union(['agent', 'key', 'password']).default('agent'),
  name: z.string().min(1).max(200),
  host: z.string().min(1).max(254),
  user: z.string().max(254).default(''),
  port: z.number().step(1).min(1).max(65535).default(22),
  identityFile: z.string().max(4096).default(''),
  jumpHost: z.string().max(254).default(''),
  directory: z.string().min(1).max(4096).default('~'),
  alias: z.boolean().default(false),
  connectTimeout: z.number().step(1).min(1).max(60).default(10),
  keepalive: z.number().step(1).min(0).max(300).default(15),
});

const TargetSchema = z.object({sessionId: z.string(), connectionId: z.string(), path: z.string(), updatedAt: z.string()});
export const SshSettingsSchema = z.object({
  connections: z.array(ConnectionSchema).default([]),
  targets: z.array(TargetSchema).default([]),
  projects: z.array(TargetSchema).default([]),
  workspaces: z.array(z.object({localPath: z.string(), connectionId: z.string(), path: z.string()})).default([]),
  detachedSessions: z.array(z.string()).default([]),
});

const MAX_CONFIG_DEPTH = 8;
const MAX_CONFIG_FILES = 500;
const MAX_CONFIG_BYTES = 1024 * 1024;

function safeConnectionWord(value, {allowAt = false} = {}) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096 || value.startsWith('-')) return false;
  const pattern = allowAt ? /^[a-zA-Z0-9][a-zA-Z0-9_.:@\[\]-]*$/ : /^[a-zA-Z0-9][a-zA-Z0-9_.:\[\]-]*$/;
  return pattern.test(value);
}

export function validateConnection(connection) {
  if (!connection || typeof connection !== 'object') throw new Error('SSH_INVALID_CONNECTION');
  const raw = {...DEFAULT_CONNECTION, ...connection, authMode: connection.authMode || DEFAULT_CONNECTION.authMode};
  // Keep the persisted representation closed over the documented schema.
  // In particular, a tool call may carry an accidental password/token field;
  // unknown fields must never be echoed or written to settings.
  const value = {
    id: raw.id,
    authMode: raw.authMode,
    name: raw.name,
    host: raw.host,
    user: raw.user,
    port: raw.port,
    identityFile: raw.identityFile,
    jumpHost: raw.jumpHost,
    directory: raw.directory,
    alias: raw.alias,
    connectTimeout: raw.connectTimeout,
    keepalive: raw.keepalive,
  };
  if (!safeConnectionWord(value.id) || value.id.length > 100) throw new Error('SSH_INVALID_CONNECTION_ID');
  if (typeof value.name !== 'string' || value.name.trim().length === 0 || value.name.length > 200 || /[\r\n\0]/.test(value.name)) throw new Error('SSH_INVALID_CONNECTION_NAME');
  if (!safeConnectionWord(value.host, {allowAt: true}) || value.host.length > 254) throw new Error('SSH_INVALID_HOST');
  if (value.user && !safeConnectionWord(value.user)) throw new Error('SSH_INVALID_USER');
  if (value.jumpHost && !safeConnectionWord(value.jumpHost, {allowAt: true})) throw new Error('SSH_INVALID_JUMP_HOST');
  if (!Number.isInteger(value.port) || value.port < 1 || value.port > 65535) throw new Error('SSH_INVALID_PORT');
  if (!Number.isInteger(value.connectTimeout) || value.connectTimeout < 1 || value.connectTimeout > 60) throw new Error('SSH_INVALID_CONNECT_TIMEOUT');
  if (!Number.isInteger(value.keepalive) || value.keepalive < 0 || value.keepalive > 300) throw new Error('SSH_INVALID_KEEPALIVE');
  if (typeof value.user !== 'string' || typeof value.jumpHost !== 'string' || typeof value.identityFile !== 'string' || typeof value.directory !== 'string' || typeof value.alias !== 'boolean') throw new Error('SSH_INVALID_CONNECTION');
  for (const field of ['identityFile', 'directory']) {
    if (typeof value[field] !== 'string' || value[field].length > 4096 || value[field].includes('\0') || /[\r\n]/.test(value[field])) throw new Error('SSH_INVALID_PATH');
  }
  if (value.identityFile.startsWith('-')) throw new Error('SSH_INVALID_IDENTITY_FILE');
  if (!['agent', 'key', 'password'].includes(value.authMode)) throw new Error('SSH_INVALID_AUTH_MODE');
  if (value.authMode === 'key' && value.identityFile.trim() === '') throw new Error('SSH_IDENTITY_REQUIRED');
  if (!value.directory.startsWith('/') && !/^~(?:\/|$)/.test(value.directory)) throw new Error('SSH_INVALID_DIRECTORY');
  return value;
}

export function normalizeConnection(connection, fallbackId = undefined) {
  const raw = {...DEFAULT_CONNECTION, ...(connection ?? {})};
  if (!raw.id && fallbackId) raw.id = fallbackId;
  if (!raw.name && raw.host) raw.name = raw.host;
  if (!raw.id && raw.host) raw.id = `ssh-${createHash('sha256').update(String(raw.host)).digest('hex').slice(0, 16)}`;
  return validateConnection(raw);
}

function normalizeConfigConnections(config = {}) {
  if (config.connections === undefined) return [];
  if (!Array.isArray(config.connections) || config.connections.length > 500) throw new Error('SSH_INVALID_CONNECTIONS');
  const seen = new Set();
  const result = config.connections.map((connection, index) => {
    const value = normalizeConnection(connection, `ssh-config-${index + 1}`);
    if (seen.has(value.id)) throw new Error('SSH_DUPLICATE_CONNECTION_ID');
    seen.add(value.id);
    return value;
  });
  validateConnectionList(result, config);
  return result;
}

export function validateConnectionList(connections, config = {}) {
  if (!Array.isArray(connections) || connections.length > 500) throw new Error('SSH_INVALID_CONNECTIONS');
  const ids = new Set();
  for (const connection of connections) {
    const value = validateConnection(connection);
    if (ids.has(value.id)) throw new Error('SSH_DUPLICATE_CONNECTION_ID');
    ids.add(value.id);
    if (Array.isArray(config.hosts) && !config.hosts.includes(value.host)) throw new Error('SSH_HOST_NOT_ALLOWED');
  }
  return true;
}

export function validateTarget(host) {
  if (typeof host !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:@-]{0,253}$/.test(host)) {
    throw new Error('SSH_INVALID_HOST: use a configured alias or user@hostname');
  }
  return host;
}

export function parseHosts(text) {
  return [...new Set(text.split(/\r?\n/).flatMap(line => {
    const match = /^\s*Host\s+(.+?)(?:\s+#.*)?$/i.exec(line);
    return match ? match[1].split(/\s+/).filter(host => /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(host)) : [];
  }))].sort();
}

function stripConfigComment(line) {
  let quote = '';
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if ((char === '"' || char === "'") && (i === 0 || line[i - 1] !== '\\')) quote = quote === char ? '' : quote || char;
    if (char === '#' && !quote && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

function concreteAlias(value) {
  return typeof value === 'string'
    && /^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(value)
    && !value.includes('*')
    && !value.includes('?');
}

export function parseSshConfig(text) {
  const aliases = new Set();
  for (const source of String(text ?? '').split(/\r?\n/)) {
    const line = stripConfigComment(source).trim();
    const match = /^Host\s+(.+)$/i.exec(line);
    if (!match) continue;
    for (const token of match[1].trim().split(/\s+/)) {
      if (concreteAlias(token)) aliases.add(token);
    }
  }
  return [...aliases].sort((a, b) => a.localeCompare(b));
}

function globPattern(pattern) {
  let output = '^';
  for (const char of pattern) {
    if (char === '*') output += '.*';
    else if (char === '?') output += '.';
    else output += char.replace(/[\\^$+{}.[\]|()]/g, '\\$&');
  }
  return new RegExp(`${output}$`);
}

async function includePaths(pattern, baseDir) {
  const expanded = pattern.startsWith('~/') ? join(homedir(), pattern.slice(2)) : isAbsolute(pattern) ? pattern : join(baseDir, pattern);
  if (!/[?*]/.test(expanded)) return [expanded];
  const parent = dirname(expanded);
  const matcher = globPattern(expanded.slice(parent.length + 1));
  try {
    const entries = await readdir(parent, {withFileTypes: true});
    return entries.filter(entry => entry.isFile() && matcher.test(entry.name)).map(entry => join(parent, entry.name)).sort();
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return [];
    throw error;
  }
}

/** Read concrete aliases from ~/.ssh/config and bounded Include files. */
export async function importSshAliases(configPath = join(homedir(), '.ssh', 'config')) {
  const aliases = new Set();
  const visited = new Set();
  let files = 0;
  let bytes = 0;
  async function visit(filename, depth) {
    if (depth > MAX_CONFIG_DEPTH || files >= MAX_CONFIG_FILES) throw new Error('SSH_CONFIG_IMPORT_LIMIT');
    let canonical;
    try { canonical = await realpath(filename); } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return;
      throw error;
    }
    if (visited.has(canonical)) return;
    visited.add(canonical);
    const content = await readFile(canonical, 'utf8');
    bytes += Buffer.byteLength(content);
    files += 1;
    if (bytes > MAX_CONFIG_BYTES) throw new Error('SSH_CONFIG_TOO_LARGE');
    const lines = content.split(/\r?\n/);
    for (const source of lines) {
      const line = stripConfigComment(source).trim();
      const host = /^Host\s+(.+)$/i.exec(line);
      if (host) {
        for (const token of host[1].trim().split(/\s+/)) if (concreteAlias(token)) aliases.add(token);
        continue;
      }
      const include = /^Include\s+(.+)$/i.exec(line);
      if (!include) continue;
      for (const token of include[1].trim().split(/\s+/)) {
        for (const child of await includePaths(token.replace(/^['"]|['"]$/g, ''), dirname(canonical))) await visit(child, depth + 1);
      }
    }
  }
  try {
    await visit(configPath, 0);
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR') return [];
    throw error;
  }
  return [...aliases].sort((a, b) => a.localeCompare(b));
}

export function importedConnection(alias) {
  const host = validateTarget(alias);
  return normalizeConnection({
    id: `alias-${createHash('sha256').update(host).digest('hex').slice(0, 20)}`,
    name: host,
    host,
    alias: true,
    authMode: 'agent',
  });
}

export function parseSshCommand(rawInput) {
  const input = String(rawInput ?? '').trim();
  if (!input || input.toLowerCase() === 'help') return {kind: 'help'};
  if (/\r|\n/.test(input)) throw new Error('SSH_COMMAND_USAGE');
  const words = input.split(/\s+/);
  const command = words[0].toLowerCase();
  if (command === 'list' && words.length === 1) return {kind: 'list'};
  if (command === 'import' && words.length === 1) return {kind: 'import'};
  if (command === 'connect') {
    if (words.length < 2 || words.length > 3) throw new Error('SSH_COMMAND_USAGE');
    const connectionId = validateTarget(words[1]);
    const root = words[2];
    if (root !== undefined && (!root.startsWith('/') && !/^~(?:\/|$)/.test(root) || root.includes('\0'))) {
      throw new Error('SSH_ABSOLUTE_ROOT_REQUIRED');
    }
    return {kind: 'connect', connectionId, root};
  }
  const match = /^(\S+)\s+(.+)$/.exec(input);
  if (!match) throw new Error('SSH_COMMAND_USAGE');
  const host = validateTarget(match[1]);
  const root = match[2].trim();
  if (!root.startsWith('/') || root.includes('\0')) throw new Error('SSH_ABSOLUTE_ROOT_REQUIRED');
  return {kind: 'connect', host, root};
}

export function formatProbeResult(host, root, result) {
  const python = Array.isArray(result.python) ? result.python.join('.') : 'unknown';
  return [
    `SSH connection verified: ${host}`,
    `Remote root: ${result.root ?? root}`,
    `Platform: ${result.platform ?? 'unknown'}`,
    `Python: ${python}`,
    'Remote project is bound to this session. Use ssh and remote_terminal tools for this target.',
    'The Harness local workspace and local tools keep their local execution context.'
  ].join('\n');
}

/** Build an argv vector without passing connection data through a shell. */
export function buildSshArgv(program, connection, command = workerCommand) {
  const value = validateConnection(connection);
  const argv = [
    program,
    '-T',
    '-o', `BatchMode=${value.authMode === 'password' ? 'no' : 'yes'}`,
    '-o', 'StrictHostKeyChecking=yes',
    '-o', `ConnectTimeout=${value.connectTimeout}`,
    '-o', `ServerAliveInterval=${value.keepalive}`,
    '-o', 'ServerAliveCountMax=2',
  ];
  if (value.authMode === 'password') argv.push('-o', 'PreferredAuthentications=password', '-o', 'PubkeyAuthentication=no', '-o', 'NumberOfPasswordPrompts=1');
  // A named connection is isolated from unrelated ~/.ssh/config rules. An
  // imported alias deliberately retains OpenSSH's own Host/Match resolution.
  if (!value.alias) argv.push('-F', '/dev/null', '-p', String(value.port));
  if (value.user) argv.push('-l', value.user);
  if (value.identityFile) argv.push('-i', value.identityFile);
  if (value.jumpHost) argv.push('-J', value.jumpHost);
  argv.push(value.host, command);
  return argv;
}

function normalizeRoot(root, allowHome = false) {
  if (typeof root !== 'string' || root.length === 0 || root.includes('\0') || /[\r\n]/.test(root)) {
    throw new Error('SSH_ABSOLUTE_ROOT_REQUIRED');
  }
  if (root.startsWith('/')) return root;
  if (allowHome && /^~(?:\/|$)/.test(root)) return root;
  throw new Error('SSH_ABSOLUTE_ROOT_REQUIRED');
}

function normalizeRelativePath(path = '.') {
  if (typeof path !== 'string' || path.length === 0 || path.length > 4096 || path.includes('\0') || /[\r\n]/.test(path) || path.startsWith('/')) {
    throw new Error('SSH_INVALID_PATH');
  }
  return path;
}

function connectionListFrom(source) {
  const value = typeof source === 'function' ? source() : source;
  if (!Array.isArray(value)) return [];
  return value.map(connection => validateConnection(connection));
}

/** Resolve a saved connection, or retain backwards-compatible host-only use. */
export function resolveConnection(args, connections = []) {
  const target = args?.target && typeof args.target === 'object' ? args.target : undefined;
  const connectionId = args?.connectionId ?? target?.connectionId;
  const requestedHost = args?.host;
  const saved = connectionListFrom(connections);
  if (args?.connection !== undefined) return normalizeConnection(args.connection);
  if (connectionId !== undefined) {
    if (typeof connectionId !== 'string' || connectionId.length === 0 || connectionId.startsWith('-')) throw new Error('SSH_INVALID_CONNECTION_ID');
    const found = saved.find(connection => connection.id === connectionId);
    if (!found) throw new Error('SSH_CONNECTION_NOT_FOUND');
    return found;
  }
  if (requestedHost !== undefined) {
    validateTarget(requestedHost);
    const found = saved.find(connection => connection.id === requestedHost || connection.host === requestedHost);
    if (found) return found;
    const explicit = {
      id: `adhoc-${createHash('sha256').update(requestedHost).digest('hex').slice(0, 20)}`,
      name: requestedHost,
      host: requestedHost,
      alias: args.alias === undefined ? true : Boolean(args.alias),
      user: args.user ?? '',
      port: args.port ?? 22,
      identityFile: args.identityFile ?? '',
      jumpHost: args.jumpHost ?? '',
      authMode: args.authMode || 'agent',
      directory: args.directory ?? '~',
      connectTimeout: args.connectTimeout ?? 10,
      keepalive: args.keepalive ?? 15,
    };
    return normalizeConnection(explicit);
  }
  throw new Error('SSH_CONNECTION_REQUIRED');
}

function requestForOperation(args, connections) {
  const connection = resolveConnection(args, connections);
  const target = args?.target && typeof args.target === 'object' ? args.target : undefined;
  const hasConnectionSelector = args?.connectionId !== undefined || target !== undefined || args?.connection !== undefined;
  // A saved connection may intentionally use `~` as its default directory.
  // Preserve that default when no root was supplied, while still rejecting
  // arbitrary relative roots from callers.
  const requestedRoot = args?.root ?? target?.path;
  const allowHome = requestedRoot === undefined
    || hasConnectionSelector
    || typeof requestedRoot === 'string' && /^~(?:\/|$)/.test(requestedRoot);
  const root = normalizeRoot(requestedRoot ?? connection.directory, allowHome);
  const path = normalizeRelativePath(args?.path ?? '.');
  const action = args?.action === 'connect' ? 'probe'
    : args?.action === 'listFiles' ? 'list'
      : args?.action === 'readFile' ? 'read'
        : args?.action;
  return {connection, root, path, action};
}

function operationResult(action, value, root, path) {
  if (action === 'connect') return {path: value?.root ?? root, root: value?.root ?? root, platform: value?.platform, python: value?.python};
  if (action === 'listFiles') {
    const entries = Array.isArray(value?.entries) ? value.entries.map(entry => ({
      ...entry,
      path: entry.path ?? (entry.name ? `${String(value?.path ?? root).replace(/\/$/, '')}/${entry.name}` : undefined),
      isDirectory: entry.isDirectory ?? entry.kind === 'directory',
      isSymlink: entry.isSymlink ?? entry.kind === 'symlink',
    })) : [];
    return {path: value?.path ?? value?.root ?? root, entries, truncated: Boolean(value?.truncated)};
  }
  if (action === 'readFile') {
    const content = typeof value?.content === 'string' ? value.content : '';
    return {
      path: value?.path ?? path,
      data: Buffer.from(content, 'utf8').toString('base64'),
      content,
      sha256: value?.revision,
      revision: value?.revision,
    };
  }
  return value;
}

export async function runRemote(subprocess, args, exec, config = {}) {
  const connections = args?.connections ?? [];
  const operation = requestForOperation(args, connections);
  const {connection, root, path, action} = operation;
  const timeoutMs = args.timeoutMs ?? 60000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 300000) throw new Error('SSH_INVALID_TIMEOUT');
  if (Array.isArray(config.hosts) && !config.hosts.includes(connection.host)) throw new Error('SSH_HOST_NOT_ALLOWED');
  if (action === 'terminal') throw new Error('SSH_TERMINAL_DELEGATED');
  if (!['probe', 'exec', 'list', 'read', 'write'].includes(action)) throw new Error('SSH_INVALID_ACTION');
  if (action === 'exec' && (!args.command?.trim() || Buffer.byteLength(args.command) > 65536)) throw new Error('SSH_INVALID_COMMAND');
  if (action === 'write' && (typeof args.content !== 'string' || Buffer.byteLength(args.content) > 65536 || !/^(missing|[a-f0-9]{64})$/.test(args.baseRevision ?? ''))) throw new Error('SSH_WRITE_REQUIRES_CONTENT_AND_REVISION');
  const callerSignal = exec?.signal ?? new AbortController().signal;
  const signal = AbortSignal.any([callerSignal, AbortSignal.timeout(timeoutMs + 15000)]);
  const program = await subprocess.resolveExecutable('ssh', undefined, signal);
  const authentication = connection.authMode === 'password'
    ? await config.passwords?.prepare(connection) : undefined;
  if (connection.authMode === 'password' && !authentication) throw new Error('SSH_PASSWORD_REQUIRED');
  let handle;
  try {
  handle = subprocess.spawn({
    argv: buildSshArgv(program, connection),
    env: authentication?.env,
    cwd: exec?.agent?.session.header.cwd ?? homedir(),
    stdio: {
      stdin: {data: JSON.stringify({action, root, path, preview: args.preview === true, command: args.command, content: args.content, baseRevision: args.baseRevision, timeout: timeoutMs / 1000})},
      stdout: {maxBytes: args.preview === true ? 2 * 1024 * 1024 : 512 * 1024}, stderr: {maxBytes: 16384},
    },
    graceMs: 1000, signal,
  });
    const outcome = await handle.done;
    signal.throwIfAborted();
    const output = handle.collected.stdout.readFrom(0);
    if (outcome.exitCode !== 0 || output.lossy) throw new Error('SSH_TRANSPORT_FAILED: check agent, known_hosts, alias and remote Python 3; remote outcome may be unknown');
    let value;
    try { value = JSON.parse(output.text); } catch { throw new Error('SSH_INVALID_RESPONSE: remote outcome may be unknown'); }
    if (!value.ok) throw new Error(value.error ?? 'SSH_REMOTE_FAILED');
    return operationResult(args.action, value.result, root, path);
  } finally {
    try {
      handle?.terminate?.();
      if (handle?.waitForExit) await handle.waitForExit(AbortSignal.timeout(5000));
    } finally { await authentication?.dispose(); }
  }
}

function connectionSummary(connection) {
  const value = validateConnection(connection);
  return {...value};
}

function validateConfig(config) {
  const value = config ?? {};
  if (value.hosts !== undefined && (!Array.isArray(value.hosts) || value.hosts.some(host => {
    try { validateTarget(host); return false; } catch { return true; }
  }))) throw new Error('SSH_INVALID_HOST_ALLOWLIST');
  for (const key of ['configPath', 'sshConfigPath']) {
    if (value[key] !== undefined && (typeof value[key] !== 'string' || !isAbsolute(value[key]) || value[key].includes('\0') || /[\r\n]/.test(value[key]))) throw new Error('SSH_INVALID_CONFIG_PATH');
  }
  const connections = normalizeConfigConnections(value);
  return {value, connections};
}

async function requireMutationApproval(ctx, exec, action, host = 'configured SSH settings') {
  const policy = ctx.get?.('sandboxPolicy')?.resolve(exec?.agent ? {session: exec.agent.session} : {});
  if (policy?.mode === 'read-only') throw new Error('SSH_READ_ONLY');
  if (policy?.mode === 'danger-full-access') return;
  const approval = ctx.get?.('approval');
  if (!approval || !exec?.agent) throw new Error('SSH_APPROVAL_REQUIRED');
  const outcome = await approval.request({
    agent: exec.agent,
    toolName: 'ssh',
    callId: exec.callId,
    signal: exec.signal,
    reason: `${action} ${host}`,
  });
  if (outcome !== 'allowed-once') throw new Error('SSH_APPROVAL_REQUIRED');
}

function createSettingsState(ctx, config, fallbackConnections) {
  let settingsService;
  let scope;
  let source = () => ({connections: fallbackConnections});
  let previousConnections = fallbackConnections;
  const changed = () => {
    const current = source()?.connections ?? [];
    for (const previous of previousConnections) {
      const next = current.find(item => item.id === previous.id);
      if (!next || credentialId(previous) !== credentialId(next)) void config.passwords?.remove(previous).catch(() => {});
    }
    previousConnections = current;
  };
  const install = settingsCtx => {
    const settings = settingsCtx?.settings;
    if (!settings) return;
    settingsService = settings;
    if (typeof settings.installSection === 'function') {
      settings.installSection(ctx, SSH_SETTINGS_NAMESPACE, SshSettingsSchema, {connections: fallbackConnections}, {
        validate: value => validateConnectionList(value.connections, config),
        setSource: current => { source = () => current?.() ?? {connections: fallbackConnections}; },
        onChange: changed,
      });
    } else if (typeof settings.register === 'function') {
      scope = settings.register(SSH_SETTINGS_NAMESPACE, SshSettingsSchema, {
        base: {connections: fallbackConnections},
        applies: 'live',
        validate: value => validateConnectionList(value.connections, config),
      });
      source = () => scope?.get?.() ?? {connections: fallbackConnections};
    }
  };
  if (typeof ctx.inject === 'function') ctx.inject(['settings'], install);
  else install({settings: ctx.get?.('settings')});
  const getConnections = () => {
    try { return connectionListFrom(source()?.connections ?? fallbackConnections); } catch { return [...fallbackConnections]; }
  };
  const saveConnections = async (next, expectedRevision) => {
    const normalized = next.map(connection => normalizeConnection(connection));
    validateConnectionList(normalized, config);
    if (settingsService) {
      if (typeof settingsService.mutate === 'function') await settingsService.mutate(SSH_SETTINGS_NAMESPACE, [{op: 'set', path: ['connections'], value: normalized}], expectedRevision);
      else if (typeof settingsService.replace === 'function') await settingsService.replace(SSH_SETTINGS_NAMESPACE, {...source(), connections: normalized}, expectedRevision);
      else if (typeof scope?.replace === 'function') await scope.replace({...source(), connections: normalized}, expectedRevision);
      else if (typeof settingsService.update === 'function') await settingsService.update(SSH_SETTINGS_NAMESPACE, {connections: normalized}, expectedRevision);
      else throw new Error('SSH_SETTINGS_UNAVAILABLE');
      return {connections: normalized, persisted: true};
    }
    fallbackConnections.splice(0, fallbackConnections.length, ...normalized);
    const current = source();
    source = () => ({...current, connections: fallbackConnections});
    return {connections: normalized, persisted: false};
  };
  let targetQueue = Promise.resolve();
  const getWorkspaceTarget = sessionId => {
    if (!sessionId || source()?.detachedSessions?.includes(sessionId)) return null;
    const direct = source()?.targets?.find(target => target.sessionId === sessionId);
    const cwd = ctx.get?.('sessions')?.get(sessionId)?.header?.cwd;
    const target = direct ?? source()?.workspaces?.find(item => item.localPath === cwd);
    return target ?? null;
  };
  const getTarget = sessionId => {
    const target = getWorkspaceTarget(sessionId);
    return target && getConnections().some(item => item.id === target.connectionId) ? target : null;
  };
  let workspaceQueue = Promise.resolve();
  const saveWorkspace = record => {
    const next = workspaceQueue.catch(() => {}).then(async () => {
    const workspaces = [...(source().workspaces ?? []).filter(item => item.localPath !== record.localPath), record];
    if (settingsService?.mutate) await settingsService.mutate(SSH_SETTINGS_NAMESPACE, [{op:'set', path:['workspaces'], value:workspaces}]);
    else if (settingsService?.replace) await settingsService.replace(SSH_SETTINGS_NAMESPACE, {...source(), workspaces});
    else { const value = {...source(), workspaces}; source = () => value; }
    });
    workspaceQueue=next;
    return next;
  };
  const saveTarget = (sessionId, target) => {
    const next = targetQueue.catch(() => {}).then(async () => {
      if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 256) throw new Error('SSH_SESSION_REQUIRED');
      const current = source();
      const targets = (current.targets ?? []).filter(item => item.sessionId !== sessionId);
      let projects = current.projects ?? [];
      if (target) {
        resolveConnection({connectionId: target.connectionId}, getConnections());
        normalizeRoot(target.path);
        const record = {sessionId, connectionId: target.connectionId, path: target.path, updatedAt: new Date().toISOString()};
        targets.push(record);
        projects = [record, ...projects.filter(item => item.connectionId !== record.connectionId || item.path !== record.path)].slice(0, 200);
      }
      const detachedSessions=(current.detachedSessions ?? []).filter(id=>id!==sessionId);
      if(!target)detachedSessions.push(sessionId);
      const value = {...current, targets: targets.slice(-1000), projects, detachedSessions:detachedSessions.slice(-1000)};
      if (settingsService?.mutate) await settingsService.mutate(SSH_SETTINGS_NAMESPACE, [{op: 'set', path: ['targets'], value: value.targets}, {op: 'set', path: ['projects'], value: projects}, {op:'set',path:['detachedSessions'],value:value.detachedSessions}]);
      else if (settingsService?.replace) await settingsService.replace(SSH_SETTINGS_NAMESPACE, value);
      else if (scope?.replace) await scope.replace(value);
      else source = () => value;
      return target;
    });
    targetQueue = next;
    return next;
  };
  return {getConnections, saveConnections, getTarget, getWorkspaceTarget, saveTarget, saveWorkspace, projects: () => source()?.projects ?? []};
}

export async function discoverConnections(config = {}) {
  const aliases = await importSshAliases(config.sshConfigPath ?? config.configPath ?? join(homedir(), '.ssh', 'config'));
  return aliases
    .filter(alias => !Array.isArray(config.hosts) || config.hosts.includes(alias))
    .map(importedConnection);
}

export async function importConnections(state, config, selected) {
  const candidates = await discoverConnections(config);
  if (selected !== undefined && (!Array.isArray(selected) || selected.some(host => typeof host !== 'string' || !candidates.some(item => item.host === host)))) throw new Error('SSH_INVALID_IMPORT_SELECTION');
  const imported = selected === undefined ? candidates : candidates.filter(item => selected.includes(item.host));
  const existing = state.getConnections();
  const byHost = new Map(existing.map(connection => [connection.host, connection]));
  for (const connection of imported) if (!byHost.has(connection.host)) byHost.set(connection.host, connection);
  const saved = await state.saveConnections([...byHost.values()]);
  return {connections: saved.connections.map(connectionSummary), imported: imported.filter(connection => !existing.some(old => old.host === connection.host)).map(connectionSummary), persisted: saved.persisted};
}

export async function executeSshCommand(ctx, invocation, config = {}, state = undefined) {
  const parsed = parseSshCommand(invocation.rawInput);
  const settingsState = state ?? createSettingsState(ctx, config, normalizeConfigConnections(config));
  if (parsed.kind === 'help') return {kind: 'success', text: `${SSH_COMMAND_USAGE}\n/ssh list\n/ssh import\n/ssh connect <connection-id> [~|/absolute/root]`};
  try {
    if (parsed.kind === 'list') {
      const connections = settingsState.getConnections().map(connectionSummary);
      return {kind: 'success', text: JSON.stringify({connections})};
    }
    if (parsed.kind === 'import') {
      // `/ssh import` mutates the same settings namespace as the tool action;
      // apply the identical sandbox/approval gate to both entry points.
      await requireMutationApproval(ctx, invocation, 'Import SSH aliases');
      const result = await importConnections(settingsState, config);
      return {kind: 'success', text: JSON.stringify(result)};
    }
    if (invocation.agent?.session) await requireMutationApproval(ctx, invocation, 'Connect SSH session');
    const result = await runRemote(ctx.subprocess, {
      action: 'connect',
      connectionId: parsed.connectionId,
      host: parsed.host,
      root: parsed.root,
      timeoutMs: 30000,
      connections: settingsState.getConnections(),
    }, invocation, config);
    if (settingsState.saveTarget && invocation.agent?.session) {
      const connection = resolveConnection(parsed, settingsState.getConnections());
      if (!settingsState.getConnections().some(item => item.id === connection.id)) await settingsState.saveConnections([...settingsState.getConnections(), connection]);
      await settingsState.saveTarget(invocation.agent.session.id, {connectionId: connection.id, path: result.path});
    }
    const host = parsed.host ?? parsed.connectionId;
    return {kind: 'success', text: formatProbeResult(host, parsed.root ?? result.path, result)};
  } catch (error) {
    if (invocation.signal?.aborted) throw error;
    const message = error instanceof Error ? error.message : String(error);
    return {kind: 'error', text: `SSH connection failed: ${message}`};
  }
}

export function apply(ctx, rawConfig = {}) {
  const {value: config, connections: fallbackConnections} = validateConfig(rawConfig);
  const passwords = new SshPasswords(() => ctx.get?.('credentials'));
  config.passwords = passwords;
  ctx.effect?.(() => () => passwords.dispose());
  const settingsState = createSettingsState(ctx, config, fallbackConnections);
  const service = {
    ...settingsState, passwords,
    resolve: args => resolveConnection(args, settingsState.getConnections()),
    argv: buildSshArgv,
    run: (args, exec) => runRemote(ctx.subprocess, {...args, connections: settingsState.getConnections()}, exec, config),
    discover: async () => ({connections: await discoverConnections(config)}),
    import: selected => importConnections(settingsState, config, selected),
    prepareWorkspace: async (args, exec) => {
      const connection = service.resolve(args);
      const probe = await service.run({...args, action:'connect'}, exec);
      const digest = createHash('sha256').update(JSON.stringify([connection.id, probe.path])).digest('hex');
      const directory = join(config.dshHome ?? process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'plugin-data', 'ssh', 'workspaces', digest);
      await mkdir(directory, {recursive:true, mode:0o700});
      const localPath = await realpath(directory);
      await settingsState.saveWorkspace({localPath, connectionId:connection.id, path:probe.path});
      return {localPath, connectionId:connection.id, path:probe.path, title:`${probe.path.split('/').filter(Boolean).at(-1) || '/'} · ${connection.name} · SSH`};
    },
    allowed: connection => !Array.isArray(config.hosts) || config.hosts.includes(connection.host),
  };
  ctx.provide?.('sshWorkbench', service);
  installSshWeb(ctx, service);
  ctx.inject?.(['systemPrompt'], scope => {
    scope.systemPrompt.context({name: 'ssh:workspace', order: 125, text: context => {
      const target = settingsState.getTarget(context.agent?.session.id);
      if (!target) return '';
      return `Active remote project: ${JSON.stringify(target)}. Use the ssh tool for remote file reads, writes and commands, and remote_terminal_open for an interactive shell. Calls without a connection selector use this target. The ordinary local file and shell tools continue to refer to the local workspace.`;
    }});
  });
  ctx.tools.register(defineTool({
    name: 'ssh',
    description: 'Manage OpenSSH connections and Session remote project targets; run bounded commands and UTF-8 file operations. Settings provide agent, key or password authentication. Passwords are entered only in the SSH settings form. Use setTarget/getTarget/clearTarget to manage the active remote project and projects for history. Operations without a connection selector reuse the active target. Remote Python 3 and strict host-key checking are required. Read before write and pass baseRevision for CAS. Use remote_terminal_open for an interactive shell.',
    parameters: {
      action: {type: 'string', enum: actions, required: true},
      host: {type: 'string'}, connectionId: {type: 'string'}, id: {type: 'string'},
      root: {type: 'string'}, path: {type: 'string'},
      target: {type: 'object', additionalProperties: false, properties: {connectionId: {type: 'string'}, path: {type: 'string'}}},
      connection: {type: 'object', additionalProperties: true},
      command: {type: 'string'}, content: {type: 'string'}, baseRevision: {type: 'string'}, timeoutMs: {type: 'integer'},
      user: {type: 'string'}, port: {type: 'integer'}, identityFile: {type: 'string'}, jumpHost: {type: 'string'},
      directory: {type: 'string'}, authMode: {type: 'string'}, alias: {type: 'boolean'}, connectTimeout: {type: 'integer'}, keepalive: {type: 'integer'},
    },
    output: {schema: {type: 'json'}, render: (_args, value) => [{type: 'text', text: JSON.stringify(value)}]},
    async execute(args, exec) {
      exec.signal.throwIfAborted();
      const action = args.action === 'save' ? 'save_connection' : args.action === 'remove' ? 'remove_connection' : args.action;
      if (action === 'hosts') {
        const hosts = await importSshAliases(config.sshConfigPath ?? config.configPath ?? join(homedir(), '.ssh', 'config'));
        return {hosts: hosts.filter(host => !Array.isArray(config.hosts) || config.hosts.includes(host)), includesEnumerated: true};
      }
      if (action === 'connections') return {connections: settingsState.getConnections().map(connectionSummary)};
      if (action === 'passwordStatus') return passwords.status(service.resolve(args));
      if (action === 'terminal') throw new Error('SSH_TERMINAL_DELEGATED');
      const sessionId = exec.agent?.session.id ?? exec.agent?.session.header.id;
      if (action === 'getTarget') return {target: settingsState.getTarget(sessionId)};
      if (action === 'projects') return {projects: settingsState.projects()};
      if (action === 'clearTarget') {
        await requireMutationApproval(ctx, exec, 'Clear SSH session target');
        await settingsState.saveTarget(sessionId, null);
        return {target: null};
      }
      if (action === 'setTarget') {
        await requireMutationApproval(ctx, exec, 'Set SSH session target');
        const connection = service.resolve(args);
        const probe = await service.run({...args, action: 'connect'}, exec);
        const target = {connectionId: connection.id, path: probe.path};
        await settingsState.saveTarget(sessionId, target);
        return {target};
      }
      if (action === 'import') {
        await requireMutationApproval(ctx, exec, 'Import SSH aliases');
        return importConnections(settingsState, config);
      }
      if (action === 'save_connection') {
        await requireMutationApproval(ctx, exec, 'Save SSH connection');
        const candidate = args.connection ?? args;
        const value = normalizeConnection(candidate, args.connectionId ?? args.id);
        const next = settingsState.getConnections().filter(connection => connection.id !== value.id);
        next.push(value);
        const saved = await settingsState.saveConnections(next);
        return {saved: true, persisted: saved.persisted, connection: connectionSummary(value), connections: saved.connections.map(connectionSummary)};
      }
      if (action === 'remove_connection') {
        await requireMutationApproval(ctx, exec, 'Remove SSH connection');
        const id = args.connectionId ?? args.id;
        if (typeof id !== 'string' || id.length === 0) throw new Error('SSH_INVALID_CONNECTION_ID');
        const existing = settingsState.getConnections();
        const removedConnection = existing.find(connection => connection.id === id);
        if (removedConnection) await passwords.remove(removedConnection);
        const next = existing.filter(connection => connection.id !== id);
        const saved = await settingsState.saveConnections(next);
        return {removed: next.length !== existing.length, persisted: saved.persisted, connections: saved.connections.map(connectionSummary)};
      }
      if (['exec', 'write'].includes(action)) await requireMutationApproval(ctx, exec, action === 'exec' ? 'Run remote command' : 'Write remote file', args.host ?? args.connectionId ?? 'configured host');
      if (['probe', 'connect', 'list', 'listFiles', 'read', 'readFile', 'exec', 'write'].includes(action)) {
        const target = !args.host && !args.connectionId && !args.connection && !args.target ? settingsState.getTarget(sessionId) : undefined;
        return runRemote(ctx.subprocess, {...args, target: args.target ?? target, action, connections: settingsState.getConnections()}, exec, config);
      }
      throw new Error('SSH_INVALID_ACTION');
    },
    presentCall: args => ({card: 'generic', title: `SSH ${args.action}${args.host ? ` · ${args.host}` : args.connectionId ? ` · ${args.connectionId}` : ''}`, kind: ['exec', 'write', 'save_connection', 'remove_connection', 'import'].includes(args.action) ? 'execute' : 'read'}),
  }));
  ctx.commands.register({
    name: 'ssh',
    description: 'Inspect, import, or verify an SSH connection and remote root',
    input: {hint: '<host> <absolute-remote-root>'},
    handler: invocation => executeSshCommand(ctx, invocation, config, settingsState),
  });
}
