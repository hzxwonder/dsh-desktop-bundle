#!/usr/bin/env node
// Compose one DSH Desktop profile from this bundle.
//
// The profile directory is written from manifest.json: every vendored plugin is
// an exact `file:` dependency inside this bundle, and the runtime packages the
// plugins import are pinned to the versions the installed DSH Desktop build
// ships, so a plugin never drags a second copy of the runtime behind the app's
// back. Re-running is idempotent, with two deliberate exceptions: profile files
// that exist are left alone unless --force is given, and cordis.patch.yml is
// always regenerated from templates/cordis.patch.yml.
//
// Usage: node scripts/compose-profile.mjs --bundle <dir> --profile-dir <dir> [--app <path>] [--force]
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

function parseArgs(argv) {
  const options = { bundle: resolve(HERE, '..'), profileDir: undefined, app: undefined, force: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--bundle') options.bundle = resolve(argv[++index])
    else if (argument === '--profile-dir') options.profileDir = resolve(argv[++index])
    else if (argument === '--app') options.app = argv[++index]
    else if (argument === '--force') options.force = true
    else throw new Error(`unknown argument: ${argument}`)
  }
  if (!options.profileDir) throw new Error('--profile-dir is required')
  return options
}

/**
 * Find the Chrome binary the pinned browser plugin should drive. Without a
 * usable path the plugin reports BROWSER_RUNTIME_MISSING until Chromium is
 * installed, so the composer writes the key only when the file exists.
 */
function chromeExecutable() {
  const candidates = [
    process.env.DSH_CHROME_EXECUTABLE,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    join(process.env.HOME ?? '', 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
  ]
  return candidates.find(candidate => candidate && existsSync(candidate))
}

/** Read the DSH runtime version of one installed Desktop application bundle. */
function runtimeVersionOf(app) {
  if (!app) return undefined
  const manifest = join(app, 'Contents', 'Resources', 'app', 'package.json')
  if (!existsSync(manifest)) return undefined
  try {
    const dependencies = JSON.parse(readFileSync(manifest, 'utf8')).dependencies ?? {}
    return dependencies['@deepseek-ai/dsh']
  } catch {
    return undefined
  }
}

function writeFile(path, contents, force) {
  if (existsSync(path) && !force) return false
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, contents)
  return true
}

function render(template, values) {
  return template.replace(/\{\{([A-Z_]+)\}\}/g, (match, key) => {
    if (!(key in values)) throw new Error(`template placeholder ${match} has no value`)
    return values[key]
  })
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const manifest = JSON.parse(readFileSync(join(options.bundle, 'manifest.json'), 'utf8'))
  const templates = join(options.bundle, 'templates')
  const vendor = join(options.bundle, 'vendor')

  const pluginDependencies = {}
  for (const plugin of manifest.plugins) {
    const source = join(vendor, plugin.name)
    if (!existsSync(join(source, 'package.json'))) {
      throw new Error(`vendored plugin is missing: ${source}`)
    }
    pluginDependencies[plugin.name] = `file:${source}`
  }

  const runtimeVersion = runtimeVersionOf(options.app) ?? manifest.desktop.runtimeVersion
  if (runtimeVersion !== manifest.desktop.runtimeVersion) {
    console.log(`runtime        ${runtimeVersion} (from ${options.app})`)
  } else {
    console.log(`runtime        ${runtimeVersion} (manifest default)`)
  }

  const runtimeDependencies = { ...manifest.profile.runtimeDependencies }
  for (const [name, version] of Object.entries(runtimeDependencies)) {
    if (version === 'app') runtimeDependencies[name] = runtimeVersion
  }

  const declaredBundles = [...new Set(manifest.profile.bundles)]
  for (const name of declaredBundles) {
    if (!(name in pluginDependencies) && !name.startsWith('@deepseek-ai/')) {
      throw new Error(`bundle ${name} is neither a vendored plugin nor a runtime bundle`)
    }
  }

  const values = {
    PROFILE_NAME: manifest.profile.name ?? 'desktop',
    DEPENDENCIES: JSON.stringify({ ...pluginDependencies, ...runtimeDependencies }, null, 4),
    BUNDLES: JSON.stringify(declaredBundles, null, 8).replace(/\n {8}/g, '\n        '),
  }

  // The browser plugin drives a real Chrome when one is present, so the patch
  // layer carries a path only when the composer can see the file. The template
  // spells both outcomes out and the composer drops the branch that does not
  // apply, which keeps the written YAML valid without a runtime template engine.
  const chrome = chromeExecutable()
  const patchTemplate = readFileSync(join(templates, 'cordis.patch.yml'), 'utf8')
  // Drop the whole marker line, newline included: replacing it with its own
  // indentation would leave that indent in front of the next line and quietly
  // write a patch layer whose YAML nests the entry one level too deep.
  const patchLayer = (chrome === undefined
    ? patchTemplate
      .replace(/^[^\S\n]*#if-chrome\n/gm, '')
      .replace(/^[^\S\n]*#else\n[\s\S]*?^[^\S\n]*#endif\n/gm, '')
    : patchTemplate
      .replace(/^[^\S\n]*#if-chrome\n/gm, '')
      .replace(/^[^\S\n]*#else\n[\s\S]*?^[^\S\n]*#endif\n/gm, ''))
    .replace('{{CHROME_EXECUTABLE}}', chrome ?? '')
  if (chrome !== undefined) console.log(`chrome         ${chrome}`)
  else console.log('chrome         not found; browser plugin needs Chromium or DSH_CHROME_EXECUTABLE')

  mkdirSync(options.profileDir, { recursive: true })

  const packageJsonPath = join(options.profileDir, 'package.json')
  const workspacePath = join(options.profileDir, 'pnpm-workspace.yaml')
  const patchPath = join(options.profileDir, 'cordis.patch.yml')

  const composed = writeFile(
    packageJsonPath,
    render(readFileSync(join(templates, 'profile.package.json'), 'utf8'), values),
    options.force,
  )
  const workspace = writeFile(
    workspacePath,
    readFileSync(join(templates, 'profile.pnpm-workspace.yaml'), 'utf8'),
    options.force,
  )
  writeFile(patchPath, patchLayer, true)

  console.log(`package.json   ${composed ? 'written' : 'kept'}   ${packageJsonPath}`)
  console.log(`workspace      ${workspace ? 'written' : 'kept'}   ${workspacePath}`)
  console.log(`patch layer    written   ${patchPath}`)
  console.log(`plugins        ${manifest.plugins.length} vendored`)
  console.log(`bundles        ${declaredBundles.join(', ')}`)

  // Fail loudly instead of leaving a profile that silently drops client code:
  // DSH Desktop resolves a client package manifest through require.resolve in a
  // fallback path, and a package without the "./package.json" export is skipped
  // without any host error.
  const missing = []
  for (const plugin of manifest.plugins) {
    const source = join(vendor, plugin.name)
    const pkg = JSON.parse(readFileSync(join(source, 'package.json'), 'utf8'))
    if (!pkg.dsh?.client) continue
    const exportsField = pkg.exports
    const exported = typeof exportsField === 'string'
      ? false
      : exportsField !== undefined && './package.json' in exportsField
    const requireFromPlugin = createRequire(join(source, 'package.json'))
    let resolvable = exported
    if (!resolvable) {
      try {
        requireFromPlugin.resolve(`${plugin.name}/package.json`)
        resolvable = true
      } catch {
        resolvable = false
      }
    }
    if (!resolvable) missing.push(plugin.name)
  }
  if (missing.length > 0) {
    throw new Error(`client packages must export "./package.json": ${missing.join(', ')}`)
  }
  console.log('client exports ok')
}

main()
