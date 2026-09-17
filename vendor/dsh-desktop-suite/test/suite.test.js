import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable} from 'node:stream';
import yaml from 'js-yaml';
import {apply, DESKTOP_SUITE_USAGE, formatSuiteResult} from '../index.js';
import {actionArgv, defaultSpec, DEFAULT_MEMBERS, profileInventory, validateConfig} from '../lib/inventory.js';
import {DesktopPackageOperations} from '../lib/operation.js';

const PROFILE = {name: 'desktop', dir: '/tmp/desktop-profile'};

async function profileFixture({declared = {}, bundles = [], installed = {}} = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'desktop-suite-'));
  await writeFile(join(dir, 'package.json'), JSON.stringify({
    name: 'dsh-profile-desktop',
    dependencies: {...declared},
    dsh: {profile: {bundles: [...bundles]}},
  }));
  for (const [name, version] of Object.entries(installed)) {
    await mkdir(join(dir, 'node_modules', name), {recursive: true});
    await writeFile(join(dir, 'node_modules', name, 'package.json'), JSON.stringify({name, version}));
  }
  return dir;
}

function fakeHandle({exitCode = 0, signal = null, stdout = '', stderr = '', fail} = {}) {
  let cancelled = false;
  return {
    handle: {
      stdout: Readable.from(stdout === '' ? [] : [stdout]),
      stderr: Readable.from(stderr === '' ? [] : [stderr]),
      done: fail === undefined ? Promise.resolve({exitCode, signal}) : Promise.reject(fail),
      cancel() { cancelled = true; },
    },
    cancelled: () => cancelled,
  };
}

function fakeContext({profile = PROFILE, runPlugin, policy, approval} = {}) {
  const registered = {tools: [], commands: [], effects: []};
  const calls = {runPlugin: []};
  const ctx = {
    desktopProfiles: {current: profile, list: () => [], select: async () => {}},
    desktopPnpm: {
      runPlugin(argv, invokingDir, signal) {
        calls.runPlugin.push({argv: [...argv], invokingDir, signal});
        if (runPlugin === undefined) throw new Error('unexpected runPlugin call');
        return runPlugin(argv, invokingDir, signal);
      },
    },
    tools: {register(tool) { registered.tools.push(tool); }},
    commands: {register(command) { registered.commands.push(command); }},
    effect(factory) { registered.effects.push(factory); },
    get(name) {
      if (name === 'sandboxPolicy') return policy === undefined ? undefined : {resolve: () => policy};
      if (name === 'approval') return approval;
      return undefined;
    },
  };
  return {ctx, registered, calls};
}

const agentExec = (overrides = {}) => ({agent: {session: {id: 'session-1'}}, signal: new AbortController().signal, ...overrides});

test('configuration keeps members an allowlist and resolves one spec per member', () => {
  const config = validateConfig();
  assert.deepEqual(config.members, [...DEFAULT_MEMBERS]);
  assert.equal(config.specs['dsh-plugin-terminal'], defaultSpec('dsh-plugin-terminal'));
  assert.equal(defaultSpec('dsh-plugin-terminal'), 'github:hzxwonder-dsh-plugins/dsh-plugin-terminal');
  const custom = validateConfig({members: ['example-plugin'], specs: {'example-plugin': 'github:owner/example-plugin#v1.2.3'}});
  assert.deepEqual(custom.specs, {'example-plugin': 'github:owner/example-plugin#v1.2.3'});
  assert.throws(() => validateConfig({members: []}), /INVALID_MEMBERS/);
  assert.throws(() => validateConfig({members: ['Example']}), /INVALID_MEMBERS/);
  assert.throws(() => validateConfig({members: ['example-plugin', 'example-plugin']}), /INVALID_MEMBERS/);
  assert.throws(() => validateConfig({members: ['example-plugin'], specs: {other: 'github:owner/other'}}), /INVALID_SPECS/);
  assert.throws(() => validateConfig({members: ['example-plugin'], specs: {'example-plugin': 'two words'}}), /INVALID_SPECS/);
  assert.throws(() => validateConfig({timeoutMs: 0}), /INVALID_TIMEOUT/);
  assert.throws(() => validateConfig({maxOutputChars: 8}), /INVALID_OUTPUT_LIMIT/);
});

test('the profile inventory reports declared specs, installed versions, and bundle layers', async t => {
  const dir = await profileFixture({
    declared: {'dsh-plugin-terminal': 'link:/repositories/dsh-plugin-terminal'},
    bundles: ['dsh-plugin-suite', 'dsh-plugin-terminal'],
    installed: {'dsh-plugin-terminal': '0.5.0'},
  });
  t.after(() => rm(dir, {recursive: true, force: true}));
  const config = validateConfig({members: ['dsh-plugin-terminal', 'dsh-plugin-browser']});
  const inventory = await profileInventory({name: 'desktop', dir}, config);
  assert.deepEqual(inventory.profile, {name: 'desktop', dir});
  assert.deepEqual(inventory.bundles, ['dsh-plugin-suite', 'dsh-plugin-terminal']);
  assert.deepEqual(inventory.members, [
    {name: 'dsh-plugin-terminal', spec: defaultSpec('dsh-plugin-terminal'), declared: true, declaredSpec: 'link:/repositories/dsh-plugin-terminal', section: 'dependencies', installedVersion: '0.5.0', bundled: true},
    {name: 'dsh-plugin-browser', spec: defaultSpec('dsh-plugin-browser'), declared: false, bundled: false},
  ]);
  await assert.rejects(profileInventory({name: 'desktop', dir: join(dir, 'missing')}, config), /PROFILE_MANIFEST_MISSING/);
  await assert.rejects(profileInventory({name: 'desktop', dir: ''}, config), /PROFILE_UNAVAILABLE/);
});

test('an action only names what the profile is still missing, or what it already declares', async t => {
  const dir = await profileFixture({declared: {'dsh-plugin-sidebar': 'link:/sidebar'}});
  t.after(() => rm(dir, {recursive: true, force: true}));
  const config = validateConfig({members: ['dsh-plugin-sidebar', 'dsh-plugin-browser']});
  const inventory = await profileInventory({name: 'desktop', dir}, config);
  assert.deepEqual(actionArgv('install', inventory), ['add', defaultSpec('dsh-plugin-browser')]);
  assert.deepEqual(actionArgv('update', inventory), ['update', 'dsh-plugin-sidebar']);
  const satisfied = await profileInventory({name: 'desktop', dir: await profileFixture({
    declared: {'dsh-plugin-sidebar': 'link:/sidebar', 'dsh-plugin-browser': 'link:/browser'},
  })}, config);
  assert.equal(actionArgv('install', satisfied), undefined);
  assert.throws(() => actionArgv('remove', inventory), /INVALID_ACTION/);
});

test('the plugin registers one tool and one command whose status read touches no package manager', async () => {
  const dir = await profileFixture({declared: {'dsh-plugin-terminal': 'link:/terminal'}, bundles: ['dsh-plugin-terminal']});
  const {ctx, registered, calls} = fakeContext({profile: {name: 'desktop', dir}});
  apply(ctx, {members: ['dsh-plugin-terminal']});
  assert.equal(registered.tools.length, 1);
  assert.equal(registered.commands.length, 1);
  assert.equal(registered.tools[0].name, 'desktop_suite');
  assert.deepEqual(registered.commands[0].name, 'desktop-suite');
  const value = await registered.tools[0].execute({action: 'status'}, agentExec());
  assert.equal(value.action, 'status');
  assert.equal(value.busy, false);
  assert.deepEqual(value.members, [{
    name: 'dsh-plugin-terminal',
    spec: defaultSpec('dsh-plugin-terminal'),
    declared: true,
    declaredSpec: 'link:/terminal',
    section: 'dependencies',
    bundled: true,
  }]);
  assert.equal(calls.runPlugin.length, 0);
  const help = await registered.commands[0].handler({rawInput: 'help'});
  assert.deepEqual(help, {kind: 'success', text: DESKTOP_SUITE_USAGE});
  const unknown = await registered.commands[0].handler({rawInput: 'purge'});
  assert.equal(unknown.kind, 'error');
});

test('install adds exactly the missing member specs through the Desktop package service', async () => {
  const dir = await profileFixture({declared: {'dsh-plugin-sidebar': 'link:/sidebar'}});
  const pending = {value: undefined};
  const {ctx, registered, calls} = fakeContext({
    profile: {name: 'desktop', dir},
    runPlugin: () => {
      pending.value = fakeHandle({stdout: 'Progress: resolved 1\n', stderr: ''});
      return pending.value.handle;
    },
    approval: {request: async () => 'allowed-once'},
  });
  apply(ctx, {members: ['dsh-plugin-sidebar', 'dsh-plugin-browser']});
  const value = await registered.tools[0].execute({action: 'install'}, agentExec());
  assert.deepEqual(calls.runPlugin[0].argv, ['add', defaultSpec('dsh-plugin-browser')]);
  assert.equal(calls.runPlugin[0].invokingDir, dir);
  assert.equal(value.outcome.ok, true);
  assert.equal(value.outcome.exitCode, 0);
  assert.equal(value.outcome.stdout, 'Progress: resolved 1\n');
  assert.equal(value.outcome.stdoutBytes, 21);
  assert.equal(value.verified.members[1].name, 'dsh-plugin-browser');
  // Post-operation verification re-reads the profile instead of trusting pnpm.
  assert.equal(value.verified.members[1].declared, false);
});

test('a read-only Session, a denied approval, and a missing approval service all block the mutation', async () => {
  const dir = await profileFixture();
  const make = options => fakeContext({profile: {name: 'desktop', dir}, runPlugin: () => fakeHandle().handle, ...options});
  const readOnly = make({policy: {mode: 'read-only'}});
  apply(readOnly.ctx, {members: ['dsh-plugin-browser']});
  await assert.rejects(readOnly.registered.tools[0].execute({action: 'install'}, agentExec()), /READ_ONLY/);
  assert.equal(readOnly.calls.runPlugin.length, 0);
  const denied = make({policy: {mode: 'workspace-write'}, approval: {request: async () => 'denied'}});
  apply(denied.ctx, {members: ['dsh-plugin-browser']});
  await assert.rejects(denied.registered.tools[0].execute({action: 'install'}, agentExec()), /APPROVAL_REQUIRED/);
  assert.equal(denied.calls.runPlugin.length, 0);
  const missing = make({policy: {mode: 'workspace-write'}});
  apply(missing.ctx, {members: ['dsh-plugin-browser']});
  await assert.rejects(missing.registered.tools[0].execute({action: 'install'}, agentExec()), /APPROVAL_REQUIRED/);
  // A full-access Session is already an explicit decision, and a user-typed
  // command carries no agent at all.
  const fullAccess = make({policy: {mode: 'danger-full-access'}});
  apply(fullAccess.ctx, {members: ['dsh-plugin-browser']});
  const value = await fullAccess.registered.tools[0].execute({action: 'install'}, agentExec());
  assert.equal(value.action, 'install');
  const command = make({policy: {mode: 'workspace-write'}, approval: {request: async () => 'denied'}});
  apply(command.ctx, {members: ['dsh-plugin-browser']});
  const result = await command.registered.commands[0].handler({rawInput: 'install', signal: new AbortController().signal});
  assert.equal(result.kind, 'success');
});

test('update re-resolves declared members and an already satisfied action is skipped', async () => {
  const dir = await profileFixture({declared: {'dsh-plugin-terminal': 'link:/terminal', 'dsh-plugin-sidebar': 'link:/sidebar'}});
  const {ctx, registered, calls} = fakeContext({profile: {name: 'desktop', dir}, runPlugin: () => fakeHandle().handle});
  apply(ctx, {members: ['dsh-plugin-terminal', 'dsh-plugin-sidebar']});
  const value = await registered.tools[0].execute({action: 'update'}, {signal: new AbortController().signal});
  assert.deepEqual(calls.runPlugin[0].argv, ['update', 'dsh-plugin-terminal', 'dsh-plugin-sidebar']);
  assert.equal(value.verified.members.length, 2);

  const empty = await profileFixture();
  const skipped = fakeContext({profile: {name: 'desktop', dir: empty}});
  apply(skipped.ctx, {members: ['dsh-plugin-terminal']});
  const result = await skipped.registered.tools[0].execute({action: 'update'}, {signal: new AbortController().signal});
  assert.deepEqual({action: result.action, skipped: result.skipped, argv: result.argv}, {action: 'update', skipped: true, argv: []});
  assert.equal(skipped.calls.runPlugin.length, 0);
});

test('operation outcomes separate a nonzero exit, a terminating signal, and a spawn failure', async () => {
  const nonzero = fakeHandle({exitCode: 1, stdout: 'ERR_PNPM\n'});
  const first = fakeContext({runPlugin: () => nonzero.handle});
  first.ctx.desktopProfiles.current = PROFILE;
  const operations = new DesktopPackageOperations(first.ctx, {timeoutMs: 1000, maxOutputChars: 4096});
  const outcome = await operations.runPlugin(['install'], {invokingDir: '/tmp/profile'});
  assert.equal(outcome.ok, false);
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.stdout, 'ERR_PNPM\n');
  assert.equal(operations.busy, false);
  assert.equal(operations.lastOutcome, outcome);

  const killed = fakeHandle({exitCode: 0, signal: 'SIGTERM'});
  const second = fakeContext({runPlugin: () => killed.handle});
  const secondOperations = new DesktopPackageOperations(second.ctx, {timeoutMs: 1000});
  const terminated = await secondOperations.runPlugin(['update'], {invokingDir: '/tmp/profile'});
  assert.equal(terminated.ok, false);
  assert.equal(terminated.signal, 'SIGTERM');

  const broken = fakeContext({runPlugin: () => fakeHandle({fail: new Error('spawn ENOENT')}).handle});
  const brokenOperations = new DesktopPackageOperations(broken.ctx, {timeoutMs: 1000});
  await assert.rejects(brokenOperations.runPlugin(['update'], {invokingDir: '/tmp/profile'}), /SPAWN_FAILED/);
  assert.equal(brokenOperations.busy, false);

  const rejected = fakeContext({runPlugin: () => { throw new Error('desktopPnpm: operation already active'); }});
  const rejectedOperations = new DesktopPackageOperations(rejected.ctx, {timeoutMs: 1000});
  await assert.rejects(rejectedOperations.runPlugin(['update'], {invokingDir: '/tmp/profile'}), /REJECTED/);
});

test('one operation at a time, and teardown cancels and waits for the subprocess tree', async () => {
  let settle;
  const slow = fakeHandle();
  slow.handle.done = new Promise(resolve => { settle = resolve; });
  let cancelled = false;
  slow.handle.cancel = () => { cancelled = true; };
  const {ctx} = fakeContext({runPlugin: () => slow.handle});
  const operations = new DesktopPackageOperations(ctx, {timeoutMs: 1000});
  const running = operations.runPlugin(['install'], {invokingDir: '/tmp/profile'});
  await Promise.resolve();
  assert.equal(operations.busy, true);
  await assert.rejects(operations.runPlugin(['update'], {invokingDir: '/tmp/profile'}), /BUSY/);
  const disposed = operations.dispose();
  await Promise.resolve();
  assert.equal(cancelled, true);
  settle({exitCode: null, signal: 'SIGTERM'});
  await running;
  await disposed;
  assert.equal(operations.busy, false);
});

test('the tool result renders a short summary beside the JSON payload', () => {
  const text = formatSuiteResult({
    action: 'install',
    profile: {name: 'desktop', dir: '/tmp/profile'},
    members: [
      {name: 'dsh-plugin-browser', spec: 'github:owner/browser', declared: false, bundled: false},
      {name: 'dsh-plugin-terminal', spec: 'github:owner/terminal', declared: true, declaredSpec: 'link:/terminal', installedVersion: '0.5.0', bundled: true},
    ],
    outcome: {exitCode: 0, signal: null, ok: true},
  });
  assert.match(text, /profile: desktop \(\/tmp\/profile\)/);
  assert.match(text, /dsh-plugin-browser: not declared/);
  assert.match(text, /dsh-plugin-terminal: link:\/terminal → 0\.5\.0 · bundle/);
  assert.match(text, /install: exit=0 signal=null ok=true/);
});

test('the bundle patch inserts exactly this plugin row', async () => {
  const patch = yaml.load(await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8'));
  assert.deepEqual(patch, [{insert: [{id: 'dsh-desktop-suite', name: 'dsh-desktop-suite'}]}]);
  assert.deepEqual(JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).dsh.bundle.patch, './cordis.patch.yml');
});
