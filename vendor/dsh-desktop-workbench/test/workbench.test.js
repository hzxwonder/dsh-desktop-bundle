import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import yaml from 'js-yaml';
import {apply, DESKTOP_WORKBENCH_USAGE, formatWorkbenchResult} from '../index.js';
import {assertProfileName, compositionStatus, selectableProfile, summarizeProfiles, validateConfig} from '../lib/profiles.js';

async function profileFixture({declared = {}, bundles = [], installed = {}, name = 'desktop'} = {}) {
  const dir = await mkdtemp(join(tmpdir(), `desktop-workbench-${name}-`));
  await writeFile(join(dir, 'package.json'), JSON.stringify({
    name: `dsh-profile-${name}`,
    dependencies: {...declared},
    dsh: {profile: {bundles: [...bundles]}},
  }));
  for (const [packageName, version] of Object.entries(installed)) {
    await mkdir(join(dir, 'node_modules', packageName), {recursive: true});
    await writeFile(join(dir, 'node_modules', packageName, 'package.json'), JSON.stringify({name: packageName, version}));
  }
  return dir;
}

const PROFILES = [
  {name: 'web', dir: '/home/.dsh/profiles/web', exists: true, webCapable: true, bundles: ['dsh-base', 'dsh-plugin-workbench']},
  {name: 'desktop', dir: '/home/.dsh/profiles/desktop', exists: true, webCapable: true, bundles: ['dsh-base']},
  {name: 'broken', dir: '/home/.dsh/profiles/broken', exists: true, webCapable: true, bundles: [], problem: 'manifest declares an unknown field'},
  {name: 'empty', dir: '/home/.dsh/profiles/empty', exists: false, webCapable: true, bundles: []},
  {name: 'tui', dir: '/home/.dsh/profiles/tui', exists: true, webCapable: false, bundles: []},
];

function fakeContext({profile, list = PROFILES, select, policy, approval} = {}) {
  const registered = {tools: [], commands: []};
  const calls = {select: []};
  const ctx = {
    desktopProfiles: {
      current: profile,
      list: () => list,
      select: async name => {
        calls.select.push(name);
        if (select !== undefined) return select(name);
        return undefined;
      },
    },
    tools: {register(tool) { registered.tools.push(tool); }},
    commands: {register(command) { registered.commands.push(command); }},
    effect() {},
    get(name) {
      if (name === 'sandboxPolicy') return policy === undefined ? undefined : {resolve: () => policy};
      if (name === 'approval') return approval;
      return undefined;
    },
  };
  return {ctx, registered, calls};
}

const agentExec = (overrides = {}) => ({agent: {session: {id: 'session-1'}}, signal: new AbortController().signal, ...overrides});

test('configuration and profile names stay inside the launcher contract', () => {
  assert.deepEqual(validateConfig(), {composition: 'dsh-plugin-workbench'});
  assert.deepEqual(validateConfig({composition: 'example-composition'}), {composition: 'example-composition'});
  assert.throws(() => validateConfig({composition: 'Example'}), /INVALID_COMPOSITION/);
  assert.equal(assertProfileName('desktop'), 'desktop');
  assert.throws(() => assertProfileName(''), /INVALID_PROFILE_NAME/);
  assert.throws(() => assertProfileName('a b'), /INVALID_PROFILE_NAME/);
});

test('a profile summary keeps the launcher fields and drops empty problems', () => {
  const summaries = summarizeProfiles(PROFILES);
  assert.deepEqual(summaries[0], {name: 'web', dir: '/home/.dsh/profiles/web', exists: true, webCapable: true, bundles: ['dsh-base', 'dsh-plugin-workbench']});
  assert.equal(summaries[2].problem, 'manifest declares an unknown field');
  assert.equal('problem' in summaries[1], false);
  assert.throws(() => summarizeProfiles(undefined), /PROFILE_LIST_UNAVAILABLE/);
});

test('only a present, web-capable, healthy profile can be selected', () => {
  const summaries = summarizeProfiles(PROFILES);
  assert.equal(selectableProfile(summaries, 'desktop').name, 'desktop');
  assert.throws(() => selectableProfile(summaries, 'missing'), /UNKNOWN_PROFILE/);
  assert.throws(() => selectableProfile(summaries, 'empty'), /PROFILE_MISSING/);
  assert.throws(() => selectableProfile(summaries, 'tui'), /NOT_WEB_CAPABLE/);
  assert.throws(() => selectableProfile(summaries, 'broken'), /PROFILE_UNHEALTHY/);
  assert.throws(() => selectableProfile(summaries, '../etc'), /INVALID_PROFILE_NAME/);
});

test('the composition status reads the active profile instead of assuming one', async t => {
  const dir = await profileFixture({
    declared: {'dsh-plugin-workbench': 'link:/repositories/dsh-plugin-workbench'},
    bundles: ['dsh-base', 'dsh-plugin-workbench'],
    installed: {'dsh-plugin-workbench': '0.1.0'},
  });
  t.after(() => rm(dir, {recursive: true, force: true}));
  assert.deepEqual(await compositionStatus({name: 'desktop', dir}), {
    package: 'dsh-plugin-workbench',
    declared: true,
    declaredSpec: 'link:/repositories/dsh-plugin-workbench',
    section: 'dependencies',
    installedVersion: '0.1.0',
    bundled: true,
  });
  const bare = await profileFixture();
  t.after(() => rm(bare, {recursive: true, force: true}));
  assert.deepEqual(await compositionStatus({name: 'desktop', dir: bare}), {
    package: 'dsh-plugin-workbench',
    declared: false,
    bundled: false,
  });
  await assert.rejects(compositionStatus({name: 'desktop', dir: join(bare, 'nope')}), /MANIFEST_MISSING/);
  await assert.rejects(compositionStatus({name: 'desktop', dir: ''}), /PROFILE_UNAVAILABLE/);
});

test('status and list are read-only surfaces that never touch the launcher selection', async t => {
  const dir = await profileFixture({bundles: ['dsh-base']});
  t.after(() => rm(dir, {recursive: true, force: true}));
  const {ctx, registered, calls} = fakeContext({profile: {name: 'desktop', dir}});
  apply(ctx);
  assert.equal(registered.tools[0].name, 'desktop_workbench');
  assert.equal(registered.commands[0].name, 'desktop-workbench');
  const status = await registered.tools[0].execute({action: 'status'}, agentExec());
  assert.deepEqual(status, {
    action: 'status',
    profile: {name: 'desktop', dir},
    composition: {package: 'dsh-plugin-workbench', declared: false, bundled: false},
  });
  const list = await registered.tools[0].execute({action: 'list'}, agentExec());
  assert.equal(list.profiles.length, PROFILES.length);
  assert.equal(list.action, 'list');
  assert.equal(calls.select.length, 0);
});

test('select persists exactly one validated target and reports the restart boundary', async () => {
  const {ctx, registered, calls} = fakeContext({profile: {name: 'web', dir: '/home/.dsh/profiles/web'}});
  apply(ctx);
  const value = await registered.tools[0].execute({action: 'select', profile: 'desktop'}, {signal: new AbortController().signal});
  assert.deepEqual(calls.select, ['desktop']);
  assert.equal(value.selected, 'desktop');
  assert.equal(value.restartRequired, true);
  await assert.rejects(registered.tools[0].execute({action: 'select'}, agentExec()), /PROFILE_REQUIRED/);
  await assert.rejects(registered.tools[0].execute({action: 'select', profile: 'tui'}, agentExec()), /NOT_WEB_CAPABLE/);
  assert.deepEqual(calls.select, ['desktop']);
});

test('a switch needs an explicit decision: read-only, denied, and missing approval all refuse', async () => {
  const make = options => fakeContext({profile: {name: 'web', dir: '/home/.dsh/profiles/web'}, ...options});
  const readOnly = make({policy: {mode: 'read-only'}});
  apply(readOnly.ctx);
  await assert.rejects(readOnly.registered.tools[0].execute({action: 'select', profile: 'desktop'}, agentExec()), /READ_ONLY/);
  assert.equal(readOnly.calls.select.length, 0);
  const denied = make({policy: {mode: 'workspace-write'}, approval: {request: async () => 'denied'}});
  apply(denied.ctx);
  await assert.rejects(denied.registered.tools[0].execute({action: 'select', profile: 'desktop'}, agentExec()), /APPROVAL_REQUIRED/);
  assert.equal(denied.calls.select.length, 0);
  const missing = make({policy: {mode: 'workspace-write'}});
  apply(missing.ctx);
  await assert.rejects(missing.registered.tools[0].execute({action: 'select', profile: 'desktop'}, agentExec()), /APPROVAL_REQUIRED/);
  const fullAccess = make({policy: {mode: 'danger-full-access'}});
  apply(fullAccess.ctx);
  const allowed = await fullAccess.registered.tools[0].execute({action: 'select', profile: 'desktop'}, agentExec());
  assert.equal(allowed.selected, 'desktop');
  const typed = make({policy: {mode: 'workspace-write'}, approval: {request: async () => 'denied'}});
  apply(typed.ctx);
  const result = await typed.registered.commands[0].handler({rawInput: 'select desktop', signal: new AbortController().signal});
  assert.equal(result.kind, 'success');
});

test('the command parses the documented grammar and reports usage for anything else', async t => {
  const dir = await profileFixture({bundles: ['dsh-base']});
  t.after(() => rm(dir, {recursive: true, force: true}));
  const {ctx, registered} = fakeContext({profile: {name: 'web', dir}});
  apply(ctx);
  const handler = registered.commands[0].handler;
  assert.deepEqual(await handler({rawInput: 'help'}), {kind: 'success', text: DESKTOP_WORKBENCH_USAGE});
  // An empty command line is the read-only status, never a switch.
  const bare = await handler({rawInput: '   '});
  assert.equal(bare.kind, 'success');
  assert.match(bare.text, /profile: web/);
  assert.deepEqual(await handler({rawInput: 'destroy'}), {kind: 'error', text: DESKTOP_WORKBENCH_USAGE});
  assert.deepEqual(await handler({rawInput: 'select'}), {kind: 'error', text: DESKTOP_WORKBENCH_USAGE});
  assert.deepEqual(await handler({rawInput: 'select desktop extra'}), {kind: 'error', text: DESKTOP_WORKBENCH_USAGE});
  const failed = await handler({rawInput: 'select missing', signal: new AbortController().signal});
  assert.equal(failed.kind, 'error');
  assert.match(failed.text, /UNKNOWN_PROFILE/);
});

test('the rendered summary names the active profile, its composition, and the restart', () => {
  const text = formatWorkbenchResult({
    action: 'select',
    profile: {name: 'web', dir: '/home/.dsh/profiles/web'},
    composition: {package: 'dsh-plugin-workbench', declared: true, declaredSpec: 'link:/workbench', installedVersion: '0.1.0', bundled: true},
    profiles: summarizeProfiles(PROFILES),
    selected: 'desktop',
    restartRequired: true,
  });
  assert.match(text, /profile: web \(\/home\/\.dsh\/profiles\/web\)/);
  assert.match(text, /dsh-plugin-workbench: link:\/workbench → 0\.1\.0 · bundle/);
  assert.match(text, /web \(active\): web · on-disk/);
  assert.match(text, /broken: web · on-disk · manifest declares an unknown field/);
  assert.match(text, /selected: desktop \(restart required\)/);
});

test('the bundle patch inserts exactly this plugin row', async () => {
  const patch = yaml.load(await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8'));
  assert.deepEqual(patch, [{insert: [{id: 'dsh-desktop-workbench', name: 'dsh-desktop-workbench'}]}]);
  assert.deepEqual(JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8')).dsh.bundle.patch, './cordis.patch.yml');
});
