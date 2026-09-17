import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir, mkdtemp, writeFile, symlink, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {
  apply,
  buildSshArgv,
  executeSshCommand,
  formatProbeResult,
  importSshAliases,
  importedConnection,
  normalizeConnection,
  parseHosts,
  parseSshCommand,
  parseSshConfig,
  runRemote,
  validateConnection,
  validateConnectionList,
  validateTarget,
} from '../index.js';

test('host discovery excludes patterns, negations and option injection', () => {
  assert.deepEqual(parseHosts('Host prod staging\nHost * !private\nHost prod # comment'), ['prod', 'staging']);
  for (const host of ['-oProxyCommand=x', 'host;id', 'host\nother', 'user@host x']) assert.throws(() => validateTarget(host));
  assert.equal(validateTarget('user@server'), 'user@server');
});

test('/ssh command parses a host and absolute remote root', () => {
  assert.deepEqual(parseSshCommand(' dev /srv/project '), {kind: 'connect', host: 'dev', root: '/srv/project'});
  assert.deepEqual(parseSshCommand('help'), {kind: 'help'});
  assert.deepEqual(parseSshCommand(''), {kind: 'help'});
  assert.throws(() => parseSshCommand('dev relative/path'), /SSH_ABSOLUTE_ROOT_REQUIRED/);
  assert.throws(() => parseSshCommand('dev'), /SSH_COMMAND_USAGE/);
  assert.match(formatProbeResult('dev', '/srv/project', {root: '/srv/project', platform: 'linux', python: [3, 12, 1]}), /SSH connection verified: dev/);
});

test('remote protocol checks revisions, traversal, symlinks, UTF-8 and timeout', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ssh-protocol-'));
  const call = input => {
    const result = spawnSync('python3', [fileURLToPath(new URL('../remote.py', import.meta.url))], {input: JSON.stringify({root, timeout: 1, ...input}), encoding: 'utf8'});
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  };
  try {
    assert.equal(call({action: 'probe'}).ok, true);
    assert.equal(call({action: 'write', path: '.dsh-ssh-write.lock', content: 'x', baseRevision: 'missing'}).error, 'SSH_RESERVED_PATH');
    assert.equal(call({action: 'write', path: 'a.txt', content: 'hello', baseRevision: 'missing'}).ok, true);
    const first = call({action: 'read', path: 'a.txt'}).result;
    assert.equal(first.content, 'hello');
    assert.equal(call({action: 'write', path: 'a.txt', content: 'new', baseRevision: 'missing'}).error, 'SSH_REVISION_CONFLICT');
    assert.equal(call({action: 'write', path: 'a.txt', content: 'new', baseRevision: first.revision}).ok, true);
    assert.equal(call({action: 'read', path: '../outside'}).error, 'SSH_PATH_OUTSIDE_ROOT');
    await symlink(join(root, 'a.txt'), join(root, 'link'));
    assert.equal(call({action: 'read', path: 'link'}).error, 'SSH_SYMLINK_DENIED');
    await writeFile(join(root, 'large'), 'x'.repeat(65537));
    assert.equal(call({action: 'read', path: 'large'}).error, 'SSH_FILE_TOO_LARGE');
    assert.equal(call({action: 'read', path: 'large', preview: true}).result.content.length, 65537);
    await writeFile(join(root, 'large'), 'x'.repeat(300000));
    const preview = call({action: 'read', path: 'large', preview: true}).result;
    assert.equal(preview.content.length, 256 * 1024);
    assert.equal(preview.size, 300000);
    assert.equal(preview.truncated, true);
    assert.equal(call({action: 'read', path: 'link', preview: true}).error, 'SSH_SYMLINK_DENIED');
    assert.equal(call({action: 'read', path: '.', preview: true}).error, 'SSH_INVALID_FILE');
    const command = call({action: 'exec', command: 'printf hello; exit 7'}).result;
    assert.equal(command.exitCode, 7);
    assert.equal(command.stdout.text, 'hello');
    assert.equal(call({action: 'exec', command: 'sleep 5', timeout: 0.1}).result.timedOut, true);
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('DSH subprocess contract uses argv, batch stdin and teardown', async () => {
  let spec, terminated = false;
  const subprocess = {
    resolveExecutable: async () => '/usr/bin/ssh',
    spawn(input) { spec = input; return {
      done: Promise.resolve({exitCode: 0}), collected: {stdout: {readFrom: () => ({text: '{"ok":true,"result":{"root":"/tmp"}}', lossy: false})}},
      terminate() { terminated = true; }, waitForExit: async () => true,
    }; },
  };
  const result = await runRemote(subprocess, {action: 'probe', host: 'test', root: '/tmp'}, {signal: new AbortController().signal});
  assert.equal(result.root, '/tmp');
  assert(spec.argv.includes('StrictHostKeyChecking=yes'));
  assert.equal(JSON.parse(spec.stdio.stdin.data).root, '/tmp');
  assert(terminated);
});

test('saved home directories and explicit tilde roots are accepted', async () => {
  const connection = validateConnection({id: 'dev', name: 'Dev', host: 'dev', directory: '~'});
  const requestedRoots = [];
  const subprocess = {
    resolveExecutable: async () => '/usr/bin/ssh',
    spawn(input) {
      requestedRoots.push(JSON.parse(input.stdio.stdin.data).root);
      return {
        done: Promise.resolve({exitCode: 0}),
        collected: {stdout: {readFrom: () => ({text: '{"ok":true,"result":{"root":"~"}}', lossy: false})}},
        terminate() {},
        waitForExit: async () => true,
      };
    },
  };
  const execution = {signal: new AbortController().signal};
  await runRemote(subprocess, {action: 'probe', host: 'dev', connections: [connection]}, execution);
  await runRemote(subprocess, {action: 'probe', connectionId: 'dev', root: '~', connections: [connection]}, execution);
  assert.deepEqual(requestedRoots, ['~', '~']);
  await assert.rejects(runRemote(subprocess, {action: 'probe', connectionId: 'dev', root: 'relative/path', connections: [connection]}, execution), /SSH_ABSOLUTE_ROOT_REQUIRED/);
});

test('/ssh command probes through the same subprocess contract', async () => {
  let requested;
  const ctx = {
    subprocess: {
      resolveExecutable: async () => '/usr/bin/ssh',
      spawn(input) {
        requested = JSON.parse(input.stdio.stdin.data);
        return {
          done: Promise.resolve({exitCode: 0}),
          collected: {stdout: {readFrom: () => ({text: '{"ok":true,"result":{"root":"/srv/project","platform":"linux","python":[3,12,1]}}', lossy: false})}},
          terminate() {},
          waitForExit: async () => true,
        };
      },
    },
  };
  const result = await executeSshCommand(ctx, {
    rawInput: 'dev /srv/project',
    signal: new AbortController().signal,
  });
  assert.equal(requested.action, 'probe');
  assert.equal(requested.root, '/srv/project');
  assert.match(result.text, /Python: 3\.12\.1/);
});

test('/ssh import command applies the mutation approval gate', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ssh-import-command-'));
  try {
    const configPath = join(root, 'config');
    await writeFile(configPath, 'Host imported\n');
    let approved = 0;
    let saved;
    const state = {
      getConnections: () => [],
      saveConnections: async connections => {
        saved = connections;
        return {connections, persisted: true};
      },
    };
    const ctx = {
      get(name) {
        if (name === 'approval') return {request: async request => {
          approved += 1;
          assert.equal(request.toolName, 'ssh');
          return 'allowed-once';
        }};
        return undefined;
      },
    };
    const result = await executeSshCommand(ctx, {
      rawInput: 'import',
      agent: {session: {header: {cwd: root}}},
      callId: 'command-import',
      signal: new AbortController().signal,
    }, {sshConfigPath: configPath}, state);
    assert.equal(result.kind, 'success');
    assert.equal(approved, 1);
    assert.equal(saved.length, 1);
    assert.equal(saved[0].host, 'imported');
  } finally {
    await rm(root, {recursive: true, force: true});
  }
});

test('tool refuses mutating operations with no approval service', async () => {
  let tool;
  let command;
  apply({
    tools: {register(value) { tool = value; }},
    commands: {register(value) { command = value; return () => {}; }},
    get() { return undefined; },
  });
  await assert.rejects(tool.execute({action: 'exec', host: 'test', root: '/tmp', command: 'true'}, {signal: new AbortController().signal}), /SSH_APPROVAL_REQUIRED/);
  assert.equal(command.name, 'ssh');
  assert.equal(command.input.hint, '<host> <absolute-remote-root>');
});

test('connection validation rejects option injection and duplicate ids', () => {
  const valid = validateConnection({id: 'dev', name: 'Dev', host: 'dev', directory: '/srv/project'});
  assert.equal(valid.port, 22);
  const sanitized = normalizeConnection({...valid, password: 'must-not-persist', token: 'must-not-persist', action: 'save_connection'});
  assert.equal('password' in sanitized, false);
  assert.equal('token' in sanitized, false);
  assert.equal('action' in sanitized, false);
  assert.throws(() => validateConnection({...valid, host: '-oProxyCommand=x'}), /SSH_INVALID_HOST/);
  assert.throws(() => validateConnection({...valid, identityFile: '-oProxyCommand=x'}), /SSH_INVALID_IDENTITY_FILE/);
  assert.throws(() => validateConnection({...valid, authMode: 'key'}), /SSH_IDENTITY_REQUIRED/);
  assert.throws(() => validateConnectionList([valid, valid]), /SSH_DUPLICATE_CONNECTION_ID/);
});

test('SSH config parser imports concrete aliases through bounded Include files', async () => {
  assert.deepEqual(parseSshConfig('Host * !private\nHost dev staging\nHost "quoted"'), ['dev', 'staging']);
  const root = await mkdtemp(join(tmpdir(), 'ssh-config-'));
  try {
    await mkdir(join(root, 'conf.d'));
    await writeFile(join(root, 'config'), 'Include conf.d/*.conf\nHost root-host\n');
    await writeFile(join(root, 'conf.d', 'one.conf'), 'Host included\nHost * !ignored\n');
    assert.deepEqual(await importSshAliases(join(root, 'config')), ['included', 'root-host']);
  } finally { await rm(root, {recursive: true, force: true}); }
});

test('explicit and imported connections produce stable, isolated SSH argv', () => {
  const explicit = validateConnection({id: 'dev', name: 'Dev', host: 'server', user: 'alice', port: 2222, identityFile: '/tmp/id', jumpHost: 'bastion', directory: '/srv'});
  const argv = buildSshArgv('/usr/bin/ssh', explicit, 'worker');
  assert(argv.includes('-F') && argv.includes('/dev/null'));
  assert(argv.includes('-p') && argv.includes('2222'));
  assert(argv.includes('-l') && argv.includes('alice'));
  assert(argv.includes('-i') && argv.includes('/tmp/id'));
  assert(argv.includes('-J') && argv.includes('bastion'));
  const alias = importedConnection('dev');
  assert.equal(importedConnection('dev').id, alias.id);
  assert(!buildSshArgv('/usr/bin/ssh', alias, 'worker').includes('-F'));
  const passwordArgv = buildSshArgv('/usr/bin/ssh', {...alias, authMode: 'password'}, 'worker');
  assert(passwordArgv.includes('PreferredAuthentications=password'));
  assert(passwordArgv.includes('NumberOfPasswordPrompts=1'));
  assert(passwordArgv.includes('StrictHostKeyChecking=yes'));
});

test('settings-backed connection actions save and remove metadata', async () => {
  let tool;
  let document = {connections: []};
  const settings = {
    register(namespace, schema, options) {
      assert.equal(namespace, 'ssh');
      return {get: () => schema(document), replace: async (_section) => { document = _section; }};
    },
  };
  const agent = {session: {header: {cwd: '/tmp'}}};
  const ctx = {
    tools: {register(value) { tool = value; }},
    commands: {register() { return () => {}; }},
    inject(deps, callback) { if (deps.includes('settings')) callback({settings}); },
    get(name) {
      if (name === 'settings') return settings;
      if (name === 'approval') return {request: async () => 'allowed-once'};
      return undefined;
    },
  };
  apply(ctx);
  const execution = {signal: new AbortController().signal, agent, callId: 'test'};
  const saved = await tool.execute({action: 'save_connection', connection: {id: 'dev', name: 'Dev', host: 'dev', directory: '/tmp'}}, execution);
  assert.equal(saved.connection.id, 'dev');
  assert.equal(document.connections[0].host, 'dev');
  const listed = await tool.execute({action: 'connections'}, execution);
  assert.equal(listed.connections.length, 1);
  const removed = await tool.execute({action: 'remove_connection', connectionId: 'dev'}, execution);
  assert.equal(removed.removed, true);
  assert.deepEqual(document.connections, []);
});

test('client bundle declares the SSH settings section in both locales', async () => {
  const {readFile} = await import('node:fs/promises');
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const client = await readFile(new URL('../client.js', import.meta.url), 'utf8');
  assert.equal(packageJson.exports['./client'], './client.js');
  assert.equal(packageJson.dsh.client.platform, 'web');
  assert(packageJson.dsh.client.inject.includes('@deepseek-ai/dsh-client-ui-settings'));
  assert.match(client, /window\.__ModuleLoader__\.load/);
  assert.match(client, /settings\.section/);
  assert.match(client, /SSH连接/);
  assert.match(client, /SSH Connections/);
});
