#!/usr/bin/env node
// Register a composed DSH home with the Desktop launcher.
//
// The launcher keeps the home it uses in Electron's userData directory, so a
// home that was never opened by the app is not enough on its own. This script
// writes only two launcher-side documents — the data-directory locator and the
// per-profile Setup marker — and writes the shared settings document only when
// it does not exist yet, so an existing installation keeps every choice it
// already recorded.
//
// Usage: node scripts/register-home.mjs --home <dsh-home> --profile <name> --app <path> [--dry-run]
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

function parseArgs(argv) {
  const options = { home: undefined, profile: 'desktop', app: undefined, dryRun: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--home') options.home = resolve(argv[++index])
    else if (argument === '--profile') options.profile = argv[++index]
    else if (argument === '--app') options.app = resolve(argv[++index])
    else if (argument === '--user-data') options.userData = resolve(argv[++index])
    else if (argument === '--dry-run') options.dryRun = true
    else throw new Error(`unknown argument: ${argument}`)
  }
  if (!options.home) throw new Error('--home is required')
  if (!options.app) throw new Error('--app is required')
  return options
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const userData = options.userData
    ?? join(process.env.HOME ?? '', 'Library', 'Application Support', 'DSH Desktop')

  const profileDir = join(options.home, 'profiles', options.profile)
  if (!existsSync(join(profileDir, 'package.json'))) {
    throw new Error(`composed profile is missing: ${profileDir}`)
  }
  if (!existsSync(join(options.app, 'Contents', 'Info.plist'))) {
    throw new Error(`application bundle is missing: ${options.app}`)
  }

  const args = [
    join(HERE, 'register-home.py'),
    '--home', options.home,
    '--profile-dir', profileDir,
    '--app', options.app,
    '--user-data', userData,
  ]
  if (options.dryRun) args.push('--dry-run')
  const output = execFileSync('/usr/bin/python3', args, { encoding: 'utf8' })
  process.stdout.write(output)
}

main()
