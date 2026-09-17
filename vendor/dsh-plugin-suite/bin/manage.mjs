#!/usr/bin/env node
import {readFile, realpath, rename, rm, stat, writeFile} from 'node:fs/promises';
import {join, isAbsolute, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

export const SUITE = 'dsh-plugin-suite';
export const MEMBERS = Object.freeze([
  'dsh-plugin-browser',
  'dsh-plugin-project-memory',
  'dsh-plugin-ssh',
  'dsh-plugin-terminal',
  'dsh-plugin-sidebar',
  'dsh-plugin-workbench',
]);
export const MANAGED = Object.freeze([SUITE, ...MEMBERS]);
export const ACTIONS = new Set(['status', 'install', 'update']);

export function usage() {
  return 'Usage: dsh-plugin-suite status --profile-dir /absolute/profile | '
    + 'dsh-plugin-suite install|update --profile-dir /absolute/profile --source-dir /absolute/repositories';
}

export function parseArgs(argv) {
  const action = argv[0] ?? 'status';
  let profileDir;
  let sourceDir;
  const extras = [];
  for (let index = 1; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--profile-dir') {
      if (profileDir !== undefined || index + 1 >= argv.length) throw new Error(usage());
      profileDir = argv[++index];
    } else if (arg.startsWith('--profile-dir=')) {
      if (profileDir !== undefined || arg.slice('--profile-dir='.length) === '') throw new Error(usage());
      profileDir = arg.slice('--profile-dir='.length);
    } else if (arg === '--source-dir') {
      if (sourceDir !== undefined || index + 1 >= argv.length) throw new Error(usage());
      sourceDir = argv[++index];
    } else if (arg.startsWith('--source-dir=')) {
      if (sourceDir !== undefined || arg.slice('--source-dir='.length) === '') throw new Error(usage());
      sourceDir = arg.slice('--source-dir='.length);
    } else {
      extras.push(arg);
    }
  }
  const needsSource = action === 'install' || action === 'update';
  if (!ACTIONS.has(action) || extras.length > 0 || !profileDir || !isAbsolute(profileDir)
    || needsSource && (!sourceDir || !isAbsolute(sourceDir))
    || !needsSource && sourceDir !== undefined) throw new Error(usage());
  return {
    action,
    profileDir: resolve(profileDir),
    ...(sourceDir === undefined ? {} : {sourceDir: resolve(sourceDir)}),
  };
}

/**
 * Build the only package-manager command this helper is allowed to run. The
 * profile manifest is prepared separately so Suite and members can live in
 * different dependency sections while pnpm performs one coherent install.
 */
export function packageManagerArgs(action) {
  if (action === 'install') return [['install']];
  if (action === 'update') return [['install', '--force']];
  throw new Error(`Unsupported package-manager action: ${action}`);
}

export function localSpecs(sourceDir) {
  if (!isAbsolute(sourceDir)) throw new Error('Suite source directory must be absolute');
  return Object.fromEntries(MANAGED.map(name => [name, `file:${join(sourceDir, name)}`]));
}

function manifestPath(profileDir) {
  return join(profileDir, 'package.json');
}

function packageManifestPath(profileDir, name) {
  return join(profileDir, 'node_modules', ...name.split('/'), 'package.json');
}

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

export async function inspectSourceDirectory(sourceDir) {
  if (!sourceDir || !isAbsolute(sourceDir)) throw new Error('Suite source directory must be absolute');
  let canonical;
  try {
    canonical = await realpath(sourceDir);
    if (!(await stat(canonical)).isDirectory()) throw new Error('not a directory');
  } catch (error) {
    throw new Error(`Cannot read Suite source directory: ${error.message}`);
  }
  const manifests = {};
  for (const name of MANAGED) {
    const directory = join(canonical, name);
    let manifest;
    try {
      manifest = await readJson(join(directory, 'package.json'));
    } catch (error) {
      throw new Error(`Cannot read local source package ${name}: ${error.message}`);
    }
    if (manifest.name !== name) throw new Error(`Local source package name mismatch: expected ${name}`);
    if (typeof manifest.dsh?.bundle?.patch !== 'string' || manifest.dsh.bundle.patch.length === 0) {
      throw new Error(`Local source package has no dsh.bundle patch: ${name}`);
    }
    manifests[name] = manifest;
  }
  return {sourceDir: canonical, specs: localSpecs(canonical), manifests};
}

async function installedPackage(profileDir, name) {
  try {
    const manifest = await readJson(packageManifestPath(profileDir, name));
    if (manifest.name !== name) return {installed: false, reason: 'name-mismatch'};
    return {
      installed: true,
      version: typeof manifest.version === 'string' ? manifest.version : null,
      bundle: Boolean(manifest.dsh?.bundle?.patch),
    };
  } catch (error) {
    if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR' || error instanceof SyntaxError) {
      return {installed: false, reason: error instanceof SyntaxError ? 'invalid-manifest' : 'missing'};
    }
    throw error;
  }
}

function declaredSpec(manifest, name) {
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    if (Object.hasOwn(manifest[section] ?? {}, name)) return {section, spec: manifest[section][name]};
  }
  return {section: null, spec: null};
}

export function validateManagedSource(manifest, specs) {
  const suite = declaredSpec(manifest, SUITE);
  if (suite.section !== 'dependencies' || suite.spec !== specs[SUITE]) {
    throw new Error(`Suite source mismatch for ${SUITE}; run install to select a new local source`);
  }
  for (const name of MEMBERS) {
    const member = declaredSpec(manifest, name);
    if (member.section !== 'devDependencies' || member.spec !== specs[name]) {
      throw new Error(`Suite source mismatch for ${name}; run install to select a new local source`);
    }
  }
  return true;
}

/** Preserve every unrelated profile field while owning the suite package rows. */
export function managedManifest(manifest, specs) {
  validateProfileManifest(manifest);
  const next = structuredClone(manifest);
  next.dependencies = {...(next.dependencies ?? {})};
  next.devDependencies = {...(next.devDependencies ?? {})};
  for (const name of MANAGED) {
    delete next.dependencies[name];
    delete next.devDependencies[name];
    if (next.optionalDependencies) delete next.optionalDependencies[name];
  }
  next.dependencies[SUITE] = specs[SUITE];
  for (const name of MEMBERS) next.devDependencies[name] = specs[name];
  return next;
}

export async function statusRows(profileDir) {
  const manifest = await readJson(manifestPath(profileDir));
  const rows = await Promise.all(MANAGED.map(async name => {
    const declared = declaredSpec(manifest, name);
    const installed = await installedPackage(profileDir, name);
    return {
      declared: declared.section !== null,
      installed: installed.installed,
      bundle: installed.bundle ?? false,
      active: Array.isArray(manifest.dsh?.profile?.bundles) && manifest.dsh.profile.bundles.includes(name),
      spec: declared.spec,
      version: installed.version ?? null,
    };
  }));
  return Object.fromEntries(MANAGED.map((name, index) => [name, rows[index]]));
}

async function writeAtomic(file, value, mode = 0o600) {
  const temporary = `${file}.${process.pid}.${Date.now().toString(36)}.tmp`;
  try {
    await writeFile(temporary, value, {flag: 'wx', mode});
    await rename(temporary, file);
  } catch (error) {
    await rm(temporary, {force: true}).catch(() => {});
    throw error;
  }
}

async function writeJsonAtomic(file, value, mode = 0o600) {
  await writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`, mode);
}

async function snapshotFile(file) {
  try {
    const [data, metadata] = await Promise.all([readFile(file), stat(file)]);
    return {exists: true, data, mode: metadata.mode & 0o777};
  } catch (error) {
    if (error?.code === 'ENOENT') return {exists: false};
    throw error;
  }
}

async function restoreFile(file, snapshot) {
  if (!snapshot.exists) {
    await rm(file, {force: true});
    return;
  }
  await writeAtomic(file, snapshot.data, snapshot.mode);
}

/**
 * Keep the suite as the single composition layer for its members. The member
 * dependencies remain installed for package resolution, but their individual
 * bundle rows are removed so the suite patch cannot duplicate loader ids.
 */
export async function reconcileProfileBundles(profileDir) {
  const file = manifestPath(profileDir);
  const manifest = await readJson(file);
  const installedSuite = await installedPackage(profileDir, SUITE);
  const current = manifest.dsh?.profile?.bundles;
  if (!Array.isArray(current)) throw new Error('Profile package.json has no dsh.profile.bundles array');
  // Never remove an existing member layer unless the replacement Suite layer
  // is present on disk. A successful package-manager command can still leave
  // the Suite unavailable (for example after a partial or filtered install).
  if (!installedSuite.installed || !installedSuite.bundle) {
    return {
      changed: false,
      bundles: current,
      ready: false,
      reason: installedSuite.installed ? 'suite-bundle-missing' : 'suite-not-installed',
    };
  }
  const missingMembers = [];
  for (const name of MEMBERS) {
    if (!(await installedPackage(profileDir, name)).installed) missingMembers.push(name);
  }
  if (missingMembers.length > 0) {
    return {
      changed: false,
      bundles: current,
      ready: false,
      reason: 'members-missing',
      missing: missingMembers,
    };
  }
  const next = [];
  for (const name of current) {
    if (MEMBERS.includes(name)) continue;
    if (name === SUITE) {
      if (!installedSuite.installed || next.includes(SUITE)) continue;
    }
    next.push(name);
  }
  if (installedSuite.installed && !next.includes(SUITE)) next.push(SUITE);
  const changed = next.length !== current.length || next.some((name, index) => name !== current[index]);
  if (changed) {
    manifest.dsh = {
      ...(manifest.dsh ?? {}),
      profile: {
        ...(manifest.dsh?.profile ?? {}),
        bundles: next,
      },
    };
    const mode = (await stat(file)).mode & 0o777;
    await writeJsonAtomic(file, manifest, mode);
  }
  return {changed, bundles: next, ready: true};
}

function runPnpm(profileDir, command) {
  const result = spawnSync('pnpm', command, {
    cwd: profileDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    console.error(`Unable to run pnpm: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

/**
 * Run one explicit install/update action and reconcile the profile only after
 * pnpm succeeds. `runner` is injectable so callers can verify the exact
 * command and post-install state without network access.
 */
export async function executeManagedAction(profileDir, action, {runner = runPnpm, sourceDir} = {}) {
  const profileFile = manifestPath(profileDir);
  const lockFile = join(profileDir, 'pnpm-lock.yaml');
  const originalManifest = validateProfileManifest(await readJson(profileFile));
  const source = await inspectSourceDirectory(sourceDir);
  if (action === 'update') validateManagedSource(originalManifest, source.specs);
  const [profileSnapshot, lockSnapshot] = await Promise.all([
    snapshotFile(profileFile),
    snapshotFile(lockFile),
  ]);
  await writeJsonAtomic(profileFile, managedManifest(originalManifest, source.specs), profileSnapshot.mode);
  const commands = packageManagerArgs(action);
  try {
    for (const command of commands) {
      const exitCode = await runner(profileDir, command);
      if (exitCode !== 0) {
        await Promise.all([restoreFile(profileFile, profileSnapshot), restoreFile(lockFile, lockSnapshot)]);
        return {exitCode, profileDir, sourceDir: source.sourceDir, command, commands, restored: true, reconciled: false};
      }
    }
    const result = await reconcileProfileBundles(profileDir);
    if (!result.ready) {
      const detail = result.reason === 'members-missing'
        ? `missing members: ${result.missing.join(', ')}`
        : result.reason === 'suite-bundle-missing'
          ? 'Suite package has no dsh.bundle patch'
          : 'Suite package is not installed';
      throw new Error(`Cannot reconcile profile bundles (${detail})`);
    }
    return {
      action,
      exitCode: 0,
      profileDir,
      sourceDir: source.sourceDir,
      commands,
      bundles: result.bundles,
      reconciled: result.changed,
    };
  } catch (error) {
    await Promise.all([restoreFile(profileFile, profileSnapshot), restoreFile(lockFile, lockSnapshot)]);
    throw error;
  }
}

export function validateProfileManifest(manifest) {
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.dsh?.profile?.bundles)) {
    throw new Error('Profile package.json has no dsh.profile.bundles array');
  }
  return manifest;
}

export async function main(argv = process.argv.slice(2)) {
  let options;
  try {
    options = parseArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 2;
  }
  const {action, profileDir, sourceDir} = options;
  if (action === 'status') {
    try {
      console.log(JSON.stringify(await statusRows(profileDir)));
      return 0;
    } catch (error) {
      console.error(`Cannot read profile package.json: ${error.message}`);
      return 1;
    }
  }
  try {
    validateProfileManifest(await readJson(manifestPath(profileDir)));
  } catch (error) {
    console.error(`Cannot read profile package.json: ${error.message}`);
    return 1;
  }
  try {
    const result = await executeManagedAction(profileDir, action, {sourceDir});
    if (result.exitCode !== 0) return result.exitCode;
    console.log(JSON.stringify({action, profileDir, bundles: result.bundles}));
    return result.exitCode;
  } catch (error) {
    console.error(`Cannot manage Suite profile: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
