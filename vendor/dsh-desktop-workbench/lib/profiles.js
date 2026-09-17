/**
 * Profile and composition reads for the desktop workbench.
 *
 * The plugin never guesses which profile is active: `desktopProfiles.current`
 * is the only authority, and every other profile comes from
 * `desktopProfiles.list()`. This module only turns those answers plus the
 * profile manifest into the report the tool and command return.
 */
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

/** Web-side package that owns the workbench composition. */
export const WORKBENCH_PACKAGE = 'dsh-plugin-workbench';

const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'optionalDependencies'];
const PACKAGE_NAME = /^[a-z][a-z0-9-]{0,63}$/;

export function validateConfig(rawConfig = {}) {
  const value = rawConfig ?? {};
  const composition = value.composition ?? WORKBENCH_PACKAGE;
  if (typeof composition !== 'string' || !PACKAGE_NAME.test(composition)) throw new Error('DESKTOP_WORKBENCH_INVALID_COMPOSITION');
  return {composition};
}

export function assertProfileName(name) {
  if (typeof name !== 'string' || !PACKAGE_NAME.test(name)) throw new Error('DESKTOP_WORKBENCH_INVALID_PROFILE_NAME');
  return name;
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

/** One read-only summary per discovered profile, with its selection blockers. */
export function summarizeProfiles(profiles) {
  if (!Array.isArray(profiles)) throw new Error('DESKTOP_WORKBENCH_PROFILE_LIST_UNAVAILABLE');
  return profiles.map(profile => ({
    name: String(profile?.name ?? ''),
    dir: String(profile?.dir ?? ''),
    exists: profile?.exists === true,
    webCapable: profile?.webCapable === true,
    bundles: Array.isArray(profile?.bundles) ? profile.bundles.filter(name => typeof name === 'string') : [],
    ...(typeof profile?.problem === 'string' && profile.problem !== '' ? {problem: profile.problem} : {}),
  }));
}

/**
 * Resolve a requested switch against the same list the user can see, so a
 * missing, non-web-capable, or unhealthy profile is refused before the
 * launcher persists anything.
 */
export function selectableProfile(profiles, name) {
  assertProfileName(name);
  const match = profiles.find(profile => profile.name === name);
  if (match === undefined) throw new Error('DESKTOP_WORKBENCH_UNKNOWN_PROFILE');
  if (match.exists !== true) throw new Error('DESKTOP_WORKBENCH_PROFILE_MISSING');
  if (match.webCapable !== true) throw new Error('DESKTOP_WORKBENCH_PROFILE_NOT_WEB_CAPABLE');
  if (typeof match.problem === 'string' && match.problem !== '') throw new Error('DESKTOP_WORKBENCH_PROFILE_UNHEALTHY');
  return match;
}

/** Whether the active profile carries the workbench composition at all. */
export async function compositionStatus(profile, composition = WORKBENCH_PACKAGE) {
  if (typeof profile?.dir !== 'string' || profile.dir === '') throw new Error('DESKTOP_WORKBENCH_PROFILE_UNAVAILABLE');
  const manifest = await readJson(join(profile.dir, 'package.json'));
  if (manifest === undefined || typeof manifest !== 'object' || manifest === null) {
    throw new Error('DESKTOP_WORKBENCH_PROFILE_MANIFEST_MISSING');
  }
  const row = dependencyRow(manifest, composition);
  const installed = await readJson(join(profile.dir, 'node_modules', composition, 'package.json'));
  const bundles = profileBundles(manifest);
  return {
    package: composition,
    declared: row !== undefined,
    ...(row === undefined ? {} : {declaredSpec: row.spec, section: row.section}),
    ...(typeof installed?.version === 'string' ? {installedVersion: installed.version} : {}),
    bundled: bundles.includes(composition),
  };
}
