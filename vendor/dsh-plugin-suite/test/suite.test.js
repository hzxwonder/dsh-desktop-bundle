import {mkdir, mkdtemp, readFile, realpath, rm, writeFile} from 'node:fs/promises';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import yaml from 'js-yaml';
import {
  MANAGED,
  MEMBERS,
  SUITE,
  executeManagedAction,
  inspectSourceDirectory,
  localSpecs,
  managedManifest,
  packageManagerArgs,
  parseArgs,
  reconcileProfileBundles,
  statusRows,
  validateManagedSource,
  validateProfileManifest,
} from '../bin/manage.mjs';

async function makeTemporaryDirectory(t, prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  t.after(() => rm(directory, {recursive: true, force: true}));
  return directory;
}

async function makeSourceDirectory(t, options = {}) {
  const directory = await makeTemporaryDirectory(t, 'dsh-suite-source-');
  for (const name of MANAGED) {
    if (name === options.missing) continue;
    const packageDirectory = join(directory, name);
    await mkdir(packageDirectory, {recursive: true});
    await writeFile(join(packageDirectory, 'package.json'), JSON.stringify({
      name: name === options.mismatch ? `${name}-other` : name,
      version: '0.1.0',
      ...(name === options.noBundle ? {} : {dsh: {bundle: {patch: './cordis.patch.yml'}}}),
    }));
  }
  return directory;
}

async function makeProfile(t, manifest, lockfile = 'lockfile-before\n') {
  const directory = await makeTemporaryDirectory(t, 'dsh-suite-profile-');
  await writeFile(join(directory, 'package.json'), JSON.stringify(manifest, null, 2));
  await writeFile(join(directory, 'pnpm-lock.yaml'), lockfile);
  return directory;
}

async function installPackages(profileDir, {missing} = {}) {
  for (const name of MANAGED) {
    if (name === missing) continue;
    const directory = join(profileDir, 'node_modules', ...name.split('/'));
    await mkdir(directory, {recursive: true});
    await writeFile(join(directory, 'package.json'), JSON.stringify({
      name,
      version: '0.1.0',
      ...(name === SUITE ? {dsh: {bundle: {patch: './cordis.patch.yml'}}} : {}),
    }));
  }
}

function profileForSource(specs, bundles = ['@deepseek-ai/dsh-base', SUITE]) {
  return {
    name: 'fixture-profile',
    private: true,
    dependencies: {unrelated: '1.2.3', [SUITE]: specs[SUITE]},
    devDependencies: Object.fromEntries(MEMBERS.map(name => [name, specs[name]])),
    dsh: {profile: {bundles, patchReload: 'startup'}},
  };
}

test('suite patch composes member bundles and Workbench services through one package entry point', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.bin[SUITE], './bin/manage.mjs');
  const schema = yaml.DEFAULT_SCHEMA.extend([
    new yaml.Type('tag:yaml.org,2002:js', {kind: 'scalar', construct: value => value}),
  ]);
  const patch = yaml.load(await readFile(new URL('../cordis.patch.yml', import.meta.url), 'utf8'), {schema});
  const rows = patch.flatMap(entry => entry.insert ?? [entry]);
  const names = rows.map(row => row.name).filter(Boolean);
  for (const name of MEMBERS.filter(name => name !== 'dsh-plugin-workbench')) {
    assert(names.includes(name), `missing ${name}`);
  }
  assert(names.includes('@deepseek-ai/dsh-time-context'));
  assert(names.includes('@deepseek-ai/dsh-schedule'));
  assert.equal(patch.find(row => row.id === 'ui-schedule').disabled, false);
  assert.equal(patch.find(row => row.id === 'session-query-sqlite').config.openAt, 'first-search');
  const PEER_VERSIONS = {'dsh-plugin-project-memory': '0.2.0'};
  for (const name of MEMBERS) {
    assert.equal(packageJson.peerDependencies[name], PEER_VERSIONS[name] ?? '0.1.0');
    assert.equal(packageJson.peerDependenciesMeta[name].optional, true);
    assert.equal(packageJson.dependencies?.[name], undefined);
  }
});

test('argument parser requires absolute profile and source directories for managed writes', () => {
  assert.deepEqual(parseArgs(['status', '--profile-dir', '/tmp/profile']), {
    action: 'status', profileDir: '/tmp/profile',
  });
  assert.deepEqual(parseArgs([
    'install', '--profile-dir=/tmp/profile', '--source-dir=/tmp/repositories',
  ]), {
    action: 'install', profileDir: '/tmp/profile', sourceDir: '/tmp/repositories',
  });
  assert.deepEqual(parseArgs([
    'update', '--profile-dir', '/tmp/profile', '--source-dir', '/tmp/repositories',
  ]), {
    action: 'update', profileDir: '/tmp/profile', sourceDir: '/tmp/repositories',
  });
  assert.throws(() => parseArgs(['install', '--profile-dir', 'relative', '--source-dir', '/tmp/source']), /Usage/);
  assert.throws(() => parseArgs(['install', '--profile-dir', '/tmp/profile']), /Usage/);
  assert.throws(() => parseArgs(['install', '--profile-dir', '/tmp/profile', '--source-dir', 'relative']), /Usage/);
  assert.throws(() => parseArgs(['status', '--profile-dir', '/tmp/profile', '--source-dir', '/tmp/source']), /Usage/);
  assert.throws(() => parseArgs(['update', '--profile-dir', '/tmp/profile', '--extra']), /Usage/);
});

test('source preflight accepts one absolute directory containing all seven bundle packages', async t => {
  const sourceDir = await makeSourceDirectory(t);
  const canonical = await realpath(sourceDir);
  const inspected = await inspectSourceDirectory(sourceDir);
  assert.equal(inspected.sourceDir, canonical);
  assert.deepEqual(inspected.specs, localSpecs(canonical));
  assert.deepEqual(Object.keys(inspected.manifests), MANAGED);
  for (const name of MANAGED) {
    assert.equal(inspected.manifests[name].name, name);
    assert.equal(inspected.manifests[name].dsh.bundle.patch, './cordis.patch.yml');
  }
});

test('source preflight rejects every missing package before changing the profile', async t => {
  for (const missing of MANAGED) {
    await t.test(missing, async t => {
      const sourceDir = await makeSourceDirectory(t, {missing});
      const profileDir = await makeProfile(t, {
        name: 'fixture-profile', dsh: {profile: {bundles: ['@deepseek-ai/dsh-base', missing]}},
      });
      const packageBefore = await readFile(join(profileDir, 'package.json'));
      const lockBefore = await readFile(join(profileDir, 'pnpm-lock.yaml'));
      let ranPackageManager = false;
      await assert.rejects(executeManagedAction(profileDir, 'install', {
        sourceDir,
        runner: async () => {
          ranPackageManager = true;
          return 0;
        },
      }), new RegExp(`Cannot read local source package ${missing}`));
      assert.equal(ranPackageManager, false);
      assert.deepEqual(await readFile(join(profileDir, 'package.json')), packageBefore);
      assert.deepEqual(await readFile(join(profileDir, 'pnpm-lock.yaml')), lockBefore);
    });
  }
});

test('source preflight rejects package name and bundle metadata mismatches', async t => {
  const mismatchedSource = await makeSourceDirectory(t, {mismatch: 'dsh-plugin-project-memory'});
  await assert.rejects(inspectSourceDirectory(mismatchedSource), /name mismatch: expected dsh-plugin-project-memory/);
  const missingBundleSource = await makeSourceDirectory(t, {noBundle: SUITE});
  await assert.rejects(
    inspectSourceDirectory(missingBundleSource),
    new RegExp(`no dsh\\.bundle patch: ${SUITE}`),
  );
  assert.throws(() => localSpecs('relative/source'), /must be absolute/);
});

test('managed manifest places Suite in dependencies and members in devDependencies', async t => {
  const source = await inspectSourceDirectory(await makeSourceDirectory(t));
  const original = {
    name: 'fixture-profile',
    private: true,
    scripts: {serve: 'dsh web'},
    dependencies: {alpha: '1.0.0', [MEMBERS[0]]: 'old-member-spec'},
    devDependencies: {beta: '2.0.0', [SUITE]: 'old-suite-spec'},
    optionalDependencies: {gamma: '3.0.0', [MEMBERS[1]]: 'old-optional-spec'},
    pnpm: {onlyBuiltDependencies: ['native-addon']},
    custom: {retained: true},
    dsh: {profile: {bundles: ['@deepseek-ai/dsh-base', MEMBERS[0]], patchReload: 'startup'}},
  };
  const before = structuredClone(original);
  const result = managedManifest(original, source.specs);
  assert.deepEqual(original, before, 'input manifest must not be mutated');
  assert.equal(result.dependencies[SUITE], source.specs[SUITE]);
  assert.equal(result.dependencies.alpha, '1.0.0');
  for (const name of MEMBERS) {
    assert.equal(result.devDependencies[name], source.specs[name]);
    assert.equal(Object.hasOwn(result.dependencies, name), false);
    assert.equal(Object.hasOwn(result.optionalDependencies, name), false);
  }
  assert.equal(Object.hasOwn(result.devDependencies, SUITE), false);
  assert.equal(Object.hasOwn(result.optionalDependencies, SUITE), false);
  assert.deepEqual(result.scripts, before.scripts);
  assert.deepEqual(result.pnpm, before.pnpm);
  assert.deepEqual(result.custom, before.custom);
  assert.deepEqual(result.dsh, before.dsh);
  assert.equal(result.devDependencies.beta, '2.0.0');
  assert.equal(result.optionalDependencies.gamma, '3.0.0');
});

test('install runs pnpm install and converges standalone members to one Suite layer', async t => {
  const source = await inspectSourceDirectory(await makeSourceDirectory(t));
  const profileDir = await makeProfile(t, {
    name: 'fixture-profile',
    private: true,
    dependencies: {unrelated: '1.0.0'},
    dsh: {profile: {bundles: [
      '@deepseek-ai/dsh-base', MEMBERS[0], MEMBERS[2], SUITE, SUITE, MEMBERS[4],
    ], patchReload: 'startup'}},
  });
  const received = [];
  const result = await executeManagedAction(profileDir, 'install', {
    sourceDir: source.sourceDir,
    runner: async (cwd, args) => {
      assert.equal(cwd, profileDir);
      received.push(args);
      const manifest = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'));
      assert.equal(manifest.dependencies[SUITE], source.specs[SUITE]);
      for (const name of MEMBERS) assert.equal(manifest.devDependencies[name], source.specs[name]);
      await installPackages(profileDir);
      await writeFile(join(profileDir, 'pnpm-lock.yaml'), 'lockfile-after-install\n');
      return 0;
    },
  });
  assert.deepEqual(received, [['install']]);
  assert.deepEqual(packageManagerArgs('install'), [['install']]);
  assert.deepEqual(result.bundles, ['@deepseek-ai/dsh-base', SUITE]);
  const manifest = JSON.parse(await readFile(join(profileDir, 'package.json'), 'utf8'));
  assert.deepEqual(manifest.dsh.profile.bundles, ['@deepseek-ai/dsh-base', SUITE]);
  assert.equal(manifest.dsh.profile.patchReload, 'startup');
  assert.equal(manifest.dependencies.unrelated, '1.0.0');
  const rows = await statusRows(profileDir);
  assert.equal(rows[SUITE].active, true);
  for (const name of MEMBERS) {
    assert.equal(rows[name].installed, true);
    assert.equal(rows[name].active, false);
  }
});

test('partial installation preserves all existing standalone bundle layers', async t => {
  const missing = MEMBERS[3];
  const bundles = ['@deepseek-ai/dsh-base', MEMBERS[0], missing, MEMBERS[4]];
  const profileDir = await makeProfile(t, {
    name: 'fixture-profile', dsh: {profile: {bundles, patchReload: 'startup'}},
  });
  await installPackages(profileDir, {missing});
  const before = await readFile(join(profileDir, 'package.json'));
  const result = await reconcileProfileBundles(profileDir);
  assert.equal(result.ready, false);
  assert.equal(result.changed, false);
  assert.equal(result.reason, 'members-missing');
  assert.deepEqual(result.missing, [missing]);
  assert.deepEqual(result.bundles, bundles);
  assert.deepEqual(await readFile(join(profileDir, 'package.json')), before);
});

test('update accepts only the same local source already recorded in the profile', async t => {
  const source = await inspectSourceDirectory(await makeSourceDirectory(t));
  assert.equal(validateManagedSource(profileForSource(source.specs), source.specs), true);
  for (const [label, mutate] of [
    ['Suite source', manifest => { manifest.dependencies[SUITE] = 'file:/another/source/dsh-plugin-suite'; }],
    ['member source', manifest => { manifest.devDependencies[MEMBERS[1]] = 'file:/another/source/dsh-plugin-project-memory'; }],
    ['member section', manifest => {
      manifest.dependencies[MEMBERS[2]] = manifest.devDependencies[MEMBERS[2]];
      delete manifest.devDependencies[MEMBERS[2]];
    }],
  ]) {
    await t.test(label, async t => {
      const manifest = profileForSource(source.specs);
      mutate(manifest);
      const profileDir = await makeProfile(t, manifest);
      const packageBefore = await readFile(join(profileDir, 'package.json'));
      const lockBefore = await readFile(join(profileDir, 'pnpm-lock.yaml'));
      let ranPackageManager = false;
      await assert.rejects(executeManagedAction(profileDir, 'update', {
        sourceDir: source.sourceDir,
        runner: async () => {
          ranPackageManager = true;
          return 0;
        },
      }), /Suite source mismatch/);
      assert.equal(ranPackageManager, false);
      assert.deepEqual(await readFile(join(profileDir, 'package.json')), packageBefore);
      assert.deepEqual(await readFile(join(profileDir, 'pnpm-lock.yaml')), lockBefore);
    });
  }
});

test('same-source update runs pnpm install --force', async t => {
  const source = await inspectSourceDirectory(await makeSourceDirectory(t));
  const profileDir = await makeProfile(t, profileForSource(source.specs));
  const received = [];
  const result = await executeManagedAction(profileDir, 'update', {
    sourceDir: source.sourceDir,
    runner: async (cwd, args) => {
      assert.equal(cwd, profileDir);
      received.push(args);
      await installPackages(profileDir);
      await writeFile(join(profileDir, 'pnpm-lock.yaml'), 'lockfile-after-update\n');
      return 0;
    },
  });
  assert.deepEqual(received, [['install', '--force']]);
  assert.deepEqual(packageManagerArgs('update'), [['install', '--force']]);
  assert.equal(result.exitCode, 0);
  assert.equal(result.sourceDir, source.sourceDir);
  assert.deepEqual(result.bundles, ['@deepseek-ai/dsh-base', SUITE]);
});

test('non-zero pnpm exit restores package.json and lockfile byte for byte', async t => {
  const source = await inspectSourceDirectory(await makeSourceDirectory(t));
  const profileDir = await makeProfile(t, {
    name: 'fixture-profile',
    private: true,
    dependencies: {unrelated: '1.0.0'},
    dsh: {profile: {bundles: ['@deepseek-ai/dsh-base', MEMBERS[0]]}},
  }, 'lockfile-before-without-final-newline');
  const packageBefore = await readFile(join(profileDir, 'package.json'));
  const lockBefore = await readFile(join(profileDir, 'pnpm-lock.yaml'));
  const result = await executeManagedAction(profileDir, 'install', {
    sourceDir: source.sourceDir,
    runner: async () => {
      await writeFile(join(profileDir, 'package.json'), '{"changedBy":"pnpm"}\n');
      await writeFile(join(profileDir, 'pnpm-lock.yaml'), 'changed-by-pnpm\n');
      return 23;
    },
  });
  assert.equal(result.exitCode, 23);
  assert.equal(result.restored, true);
  assert.equal(result.reconciled, false);
  assert.deepEqual(await readFile(join(profileDir, 'package.json')), packageBefore);
  assert.deepEqual(await readFile(join(profileDir, 'pnpm-lock.yaml')), lockBefore);
});

test('post-install validation failure also restores package.json and lockfile', async t => {
  const source = await inspectSourceDirectory(await makeSourceDirectory(t));
  const profileDir = await makeProfile(t, {
    name: 'fixture-profile',
    dependencies: {unrelated: '1.0.0'},
    dsh: {profile: {bundles: ['@deepseek-ai/dsh-base', MEMBERS[0]]}},
  });
  const packageBefore = await readFile(join(profileDir, 'package.json'));
  const lockBefore = await readFile(join(profileDir, 'pnpm-lock.yaml'));
  await assert.rejects(executeManagedAction(profileDir, 'install', {
    sourceDir: source.sourceDir,
    runner: async () => {
      await installPackages(profileDir, {missing: MEMBERS[4]});
      await writeFile(join(profileDir, 'pnpm-lock.yaml'), 'partial-lockfile\n');
      return 0;
    },
  }), new RegExp(`missing members: ${MEMBERS[4]}`));
  assert.deepEqual(await readFile(join(profileDir, 'package.json')), packageBefore);
  assert.deepEqual(await readFile(join(profileDir, 'pnpm-lock.yaml')), lockBefore);
});

test('profile validation rejects arbitrary package directories', () => {
  const profile = {dsh: {profile: {bundles: []}}};
  assert.deepEqual(validateProfileManifest(profile), profile);
  assert.throws(() => validateProfileManifest({name: 'not-a-profile'}), /dsh\.profile\.bundles/);
});
