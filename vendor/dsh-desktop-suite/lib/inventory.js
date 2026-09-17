/**
 * Profile inventory for the Desktop suite.
 *
 * Every read here is a plain file read of the active Desktop profile. The suite
 * never infers a profile from argv, `$DSH_HOME`, settings, or the Loader
 * inventory, so `desktopProfiles.current` stays the single authority for the
 * profile a package operation is allowed to touch.
 */
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

/** Plugins the Desktop suite maintains unless configuration replaces the list. */
export const DEFAULT_MEMBERS = Object.freeze([
  'dsh-plugin-browser',
  'dsh-plugin-project-memory',
  'dsh-plugin-sidebar',
  'dsh-plugin-ssh',
  'dsh-plugin-terminal',
  'dsh-plugin-workbench',
]);

/** Canonical install target for a maintained plugin without a configured spec. */
export const DEFAULT_SPEC_PREFIX = 'github:hzxwonder-dsh-plugins/';

const PACKAGE_NAME = /^[a-z][a-z0-9-]{0,63}$/;
const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];
const DEFAULT_TIMEOUT_MS = 10 * 60_000;
const DEFAULT_MAX_OUTPUT_CHARS = 16 * 1024;

export function defaultSpec(name) {
  return `${DEFAULT_SPEC_PREFIX}${name}`;
}

/**
 * Normalize plugin configuration. Members are an allowlist, never a free-form
 * package target, so an operator or a model can only ever name a plugin this
 * deployment already decided to maintain.
 */
export function validateConfig(rawConfig = {}) {
  const value = rawConfig ?? {};
  const members = value.members === undefined ? [...DEFAULT_MEMBERS] : value.members;
  if (!Array.isArray(members) || members.length === 0
    || members.some(name => typeof name !== 'string' || !PACKAGE_NAME.test(name))
    || new Set(members).size !== members.length) {
    throw new Error('DESKTOP_SUITE_INVALID_MEMBERS');
  }
  const specs = value.specs ?? {};
  if (typeof specs !== 'object' || specs === null || Array.isArray(specs)) throw new Error('DESKTOP_SUITE_INVALID_SPECS');
  const resolved = {};
  for (const name of members) {
    const spec = specs[name] ?? defaultSpec(name);
    if (typeof spec !== 'string' || spec.trim() === '' || spec.length > 512 || /[\s\0]/.test(spec)) {
      throw new Error('DESKTOP_SUITE_INVALID_SPECS');
    }
    resolved[name] = spec;
  }
  if (Object.keys(specs).some(name => !members.includes(name))) throw new Error('DESKTOP_SUITE_INVALID_SPECS');
  const timeoutMs = value.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error('DESKTOP_SUITE_INVALID_TIMEOUT');
  const maxOutputChars = value.maxOutputChars ?? DEFAULT_MAX_OUTPUT_CHARS;
  if (!Number.isSafeInteger(maxOutputChars) || maxOutputChars < 256) throw new Error('DESKTOP_SUITE_INVALID_OUTPUT_LIMIT');
  return {members: [...members], specs: resolved, timeoutMs, maxOutputChars};
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

function dependencyRow(manifest, name) {
  for (const section of DEPENDENCY_SECTIONS) {
    const spec = manifest?.[section]?.[name];
    if (typeof spec === 'string' && spec !== '') return {section, spec};
  }
  return undefined;
}

export function profileBundles(manifest) {
  const bundles = manifest?.dsh?.profile?.bundles;
  return Array.isArray(bundles) ? bundles.filter(name => typeof name === 'string') : [];
}

/**
 * Read the active profile once: which members it declares, which of them are
 * materialized under `node_modules`, and which layers its bundle list names.
 */
export async function profileInventory(profile, config) {
  if (typeof profile?.name !== 'string' || typeof profile?.dir !== 'string' || profile.dir === '') {
    throw new Error('DESKTOP_SUITE_PROFILE_UNAVAILABLE');
  }
  const manifest = await readJson(join(profile.dir, 'package.json'));
  if (manifest === undefined || typeof manifest !== 'object' || manifest === null) {
    throw new Error('DESKTOP_SUITE_PROFILE_MANIFEST_MISSING');
  }
  const bundles = profileBundles(manifest);
  const members = [];
  for (const name of config.members) {
    const row = dependencyRow(manifest, name);
    const installed = await readJson(join(profile.dir, 'node_modules', name, 'package.json'));
    members.push({
      name,
      spec: config.specs[name],
      declared: row !== undefined,
      ...(row === undefined ? {} : {declaredSpec: row.spec, section: row.section}),
      ...(typeof installed?.version === 'string' ? {installedVersion: installed.version} : {}),
      bundled: bundles.includes(name),
    });
  }
  return {profile: {name: profile.name, dir: profile.dir}, bundles, members};
}

/**
 * Argv for one action, or `undefined` when the profile already satisfies it.
 * Both shapes stay inside the packaged `dsh plugin` CLI, which owns the profile
 * manifest, pnpm, and `dsh.profile.bundles` reconciliation.
 */
export function actionArgv(action, inventory) {
  if (action === 'install') {
    const missing = inventory.members.filter(member => !member.declared);
    return missing.length === 0 ? undefined : ['add', ...missing.map(member => member.spec)];
  }
  if (action === 'update') {
    const declared = inventory.members.filter(member => member.declared);
    return declared.length === 0 ? undefined : ['update', ...declared.map(member => member.name)];
  }
  throw new Error('DESKTOP_SUITE_INVALID_ACTION');
}
