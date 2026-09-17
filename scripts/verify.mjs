#!/usr/bin/env node
// Verify a composed DSH Desktop environment.
//
// The checks answer the questions a failing launch would otherwise hide: is the
// profile complete, does every vendored plugin resolve from the bundle rather
// than from the sealed application, and does every client package expose the
// manifest path the Desktop shell needs. Installing Chromium for the browser
// plugin is the one thing a real page load also needs, and it is reported as a
// warning rather than a failure.
//
// Usage: node scripts/verify.mjs --bundle <dir> --home <dsh-home> [--profile desktop] [--app <path>]
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE = resolve(HERE, '..')

function parseArgs(argv) {
  const options = { bundle: BUNDLE, home: undefined, profile: 'desktop', app: undefined }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--bundle') options.bundle = resolve(argv[++index])
    else if (argument === '--home') options.home = resolve(argv[++index])
    else if (argument === '--profile') options.profile = argv[++index]
    else if (argument === '--app') options.app = resolve(argv[++index])
    else throw new Error(`unknown argument: ${argument}`)
  }
  if (!options.home) throw new Error('--home is required')
  return options
}

const failures = []
const warnings = []
const pass = message => console.log(`ok    ${message}`)
const fail = message => { failures.push(message); console.log(`FAIL  ${message}`) }
const warn = message => { warnings.push(message); console.log(`warn  ${message}`) }

function check(condition, message) {
  if (condition) pass(message)
  else fail(message)
  return condition
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const manifest = JSON.parse(readFileSync(join(options.bundle, 'manifest.json'), 'utf8'))
  const vendor = join(options.bundle, 'vendor')
  const profileDir = join(options.home, 'profiles', options.profile)

  console.log(`bundle ${options.bundle}`)
  console.log(`home   ${options.home}`)
  console.log(`profile ${profileDir}\n`)

  check(existsSync(join(options.bundle, 'vendor')), 'bundle carries a vendor directory')
  check(existsSync(join(profileDir, 'package.json')), 'profile manifest exists')
  check(existsSync(join(profileDir, 'cordis.patch.yml')), 'profile patch layer exists')
  check(existsSync(join(profileDir, 'pnpm-workspace.yaml')), 'profile workspace file exists')

  const workspace = existsSync(join(profileDir, 'pnpm-workspace.yaml'))
    ? readFileSync(join(profileDir, 'pnpm-workspace.yaml'), 'utf8')
    : ''
  check(/nodeLinker:\s*hoisted/.test(workspace), 'workspace pins nodeLinker: hoisted')

  const profileManifest = existsSync(join(profileDir, 'package.json'))
    ? JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'))
    : { dependencies: {} }
  const dependencies = profileManifest.dependencies ?? {}

  const appPrefix = options.app === undefined ? undefined : `${options.app}${sep}`
  let resolved = 0
  let vendored = 0
  for (const plugin of manifest.plugins) {
    const dependency = dependencies[plugin.name]
    if (typeof dependency !== 'string' || !dependency.startsWith('file:')) {
      fail(`${plugin.name} is not a file: dependency of the profile`)
      continue
    }
    const source = join(vendor, plugin.name)
    if (!existsSync(join(source, 'package.json'))) {
      fail(`${plugin.name} is missing from vendor/`)
      continue
    }
    const link = join(profileDir, 'node_modules', plugin.name)
    if (!existsSync(link)) {
      fail(`${plugin.name} is not installed in the profile`)
      continue
    }
    const target = (() => {
      try {
        return createRequire(join(profileDir, 'package.json')).resolve(`${plugin.name}/package.json`)
      } catch {
        return undefined
      }
    })()
    if (target === undefined) {
      fail(`${plugin.name} does not resolve from the profile`)
      continue
    }
    if (appPrefix !== undefined && target.startsWith(appPrefix)) {
      fail(`${plugin.name} resolves into the sealed application instead of the profile`)
      continue
    }
    if (target.includes(`${sep}vendor${sep}`)) vendored += 1
    resolved += 1
    const pkg = JSON.parse(readFileSync(target, 'utf8'))
    if (pkg.version !== plugin.version) {
      warn(`${plugin.name} reports ${pkg.version} but the manifest pins ${plugin.version}`)
    }
    if (pkg.dsh?.client) {
      const exported = typeof pkg.exports === 'object' && pkg.exports !== null
        && './package.json' in pkg.exports
      if (!exported) fail(`${plugin.name} declares a client but does not export ./package.json`)
      const entry = pkg.exports?.['./client']
      if (typeof entry === 'string') {
        const entryPath = join(dirname(target), entry)
        if (!existsSync(entryPath)) fail(`${plugin.name} client entry is missing: ${entry}`)
      }
    }
  }
  pass(`${resolved}/${manifest.plugins.length} plugins resolve from the profile`)
  if (resolved !== manifest.plugins.length) {
    fail('not every vendored plugin is wired into the profile')
  }

  const runtimeDependencies = dependencies
  for (const name of Object.keys(manifest.profile.runtimeDependencies)) {
    check(name in runtimeDependencies, `runtime package ${name} is declared`)
    check(existsSync(join(profileDir, 'node_modules', name)), `runtime package ${name} is installed`)
  }

  const bundles = profileManifest.dsh?.profile?.bundles ?? []
  check(bundles.includes('dsh-plugin-suite'), 'bundle list loads the plugin suite')
  check(bundles.length === manifest.profile.bundles.length, 'bundle list matches the manifest')

  const patch = existsSync(join(profileDir, 'cordis.patch.yml'))
    ? readFileSync(join(profileDir, 'cordis.patch.yml'), 'utf8')
    : ''
  check(/- id: client-hmr\n  disabled: true/.test(patch), 'patch layer disables the client HMR watcher')
  if (patch.includes('{{')) fail('patch layer still contains an unrendered placeholder')
  else pass('patch layer has no unrendered placeholder')

  const chromium = [
    join(profileDir, 'node_modules', 'playwright-core', '.local-browsers'),
    join(process.env.HOME ?? '', 'Library', 'Caches', 'ms-playwright'),
  ].find(candidate => existsSync(candidate))
  const chromeConfigured = /executablePath: \S/.test(patch)
  if (chromium !== undefined || chromeConfigured) pass('browser plugin has a runtime (Chromium cache or executablePath)')
  else warn('browser plugin has no Chromium: run `npm run browser:install` inside vendor/dsh-plugin-browser or set DSH_CHROME_EXECUTABLE')

  console.log('')
  if (failures.length > 0) {
    console.log(`verify: ${failures.length} failure(s), ${warnings.length} warning(s)`)
    for (const failure of failures) console.log(`  - ${failure}`)
    process.exitCode = 1
    return
  }
  console.log(`verify: passed with ${warnings.length} warning(s)`)
}

main()
