#!/usr/bin/env node
import {readdir, readFile, mkdir, rename, symlink} from 'node:fs/promises';
import {join, resolve} from 'node:path';
const [profileArg, appArg] = process.argv.slice(2);
if (!profileArg || !appArg) throw new Error('Usage: align-runtime.mjs <profile> <DSH Omni.app>');
const profile = resolve(profileArg);
const runtime = join(resolve(appArg), 'Contents/Resources/app/node_modules/@deepseek-ai');
const overlays = join(profile, 'node_modules/@deepseek-ai');
const backup = join(profile, 'runtime-backups', new Date().toISOString().replaceAll(':', '-'));
for (const name of await readdir(overlays)) {
  if (!name.startsWith('dsh-')) continue;
  let bundled, local;
  try {
    bundled = JSON.parse(await readFile(join(runtime, name, 'package.json'), 'utf8'));
    local = JSON.parse(await readFile(join(overlays, name, 'package.json'), 'utf8'));
  } catch { continue; }
  if (bundled.version === local.version) continue;
  await mkdir(backup, {recursive:true});
  await rename(join(overlays, name), join(backup, name));
  await symlink(join(runtime, name), join(overlays, name), 'dir');
  console.log(`${name}: ${local.version} → ${bundled.version}`);
}
