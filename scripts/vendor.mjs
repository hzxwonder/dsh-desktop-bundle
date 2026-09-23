#!/usr/bin/env node
// Refresh vendor/ from the maintained plugin repositories and re-pin versions.
//
// Each entry in manifest.json names a repository and the commit the bundle
// vendors. This script copies that commit out of a temporary clone, so the
// vendored tree is exactly the released source: no build output of this machine
// and no working-tree edits leak into the bundle. A local checkout with the
// same commit is reused when one is available, which keeps the common
// `--from <repo-root>` path offline.
//
// Usage: node scripts/vendor.mjs [--from <plugin-root>] [--only <name,name>] [--check]
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE = resolve(HERE, '..')

function parseArgs(argv) {
  const options = { bundle: BUNDLE, from: undefined, only: undefined, check: false }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--bundle') options.bundle = resolve(argv[++index])
    else if (argument === '--from') options.from = resolve(argv[++index])
    else if (argument === '--only') options.only = argv[++index].split(',').map(name => name.trim())
    else if (argument === '--check') options.check = true
    else throw new Error(`unknown argument: ${argument}`)
  }
  return options
}

function git(cwd, args) {
  return execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }).trim()
}

function headOf(cwd) {
  try {
    return git(cwd, ['rev-parse', 'HEAD'])
  } catch {
    return undefined
  }
}

/**
 * Copy one commit's tree without git metadata, build output or release evidence.
 * `docs/` holds each plugin's own acceptance records and screenshots, which
 * describe the maintainer's machine and belong to the plugin repositories; the
 * bundle keeps code, manifests, `cordis.patch.yml` and READMEs only. A local
 * source checkout is stashed around the copy so an in-progress edit can never
 * leak into the bundle; the stash is restored even when the copy fails.
 */
const EXCLUDED_ENTRIES = new Set(['.git', 'node_modules', 'docs'])

/**
 * Export one commit's plugin tree. Plugins whose repository nests the package
 * inside a subdirectory (manifest entry `subdir`) export that directory's
 * contents, so `vendor/<name>/` is always the package root.
 */
function exportCommit(repository, commit, destination, subdir = undefined) {
  const isLocal = existsSync(join(repository, '.git'))
  const stashed = isLocal && git(repository, ['status', '--porcelain']) !== ''
  if (stashed) git(repository, ['stash', 'push', '--quiet', '--include-untracked'])
  try {
    const staging = mkdtempSync(join(tmpdir(), 'dsh-desktop-bundle-'))
    try {
      execFileSync('git', ['clone', '--quiet', '--no-checkout', repository, staging], { stdio: 'inherit' })
      execFileSync('git', ['-C', staging, 'checkout', '--quiet', commit], { stdio: 'inherit' })
      const tree = subdir === undefined ? staging : join(staging, subdir)
      const entries = readdirSync(tree).filter(entry => !EXCLUDED_ENTRIES.has(entry))
      rmSync(destination, { recursive: true, force: true })
      for (const entry of entries) {
        cpSync(join(tree, entry), join(destination, entry), { recursive: true, dereference: false })
      }
    } finally {
      rmSync(staging, { recursive: true, force: true })
    }
  } finally {
    if (stashed) {
      git(repository, ['stash', 'pop', '--quiet'])
      console.log(`  restored the working tree of ${repository}`)
    }
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const manifestPath = join(options.bundle, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const vendor = join(options.bundle, 'vendor')
  const selected = options.only === undefined
    ? manifest.plugins
    : manifest.plugins.filter(plugin => options.only.includes(plugin.name))
  if (selected.length === 0) throw new Error('no plugin matched --only')

  let changed = 0
  for (const plugin of selected) {
    const local = options.from === undefined ? undefined : join(options.from, plugin.name)
    const localHead = local === undefined ? undefined : headOf(local)
    const vendorDir = join(vendor, plugin.name)

    if (options.check) {
      const vendoredVersion = existsSync(join(vendorDir, 'package.json'))
        ? JSON.parse(readFileSync(join(vendorDir, 'package.json'), 'utf8')).version
        : undefined
      const status = localHead === undefined
        ? 'source checkout missing'
        : localHead === plugin.commit
          ? 'in sync'
          : `source moved to ${localHead.slice(0, 7)}`
      console.log(`${plugin.name.padEnd(26)} vendored ${plugin.version.padEnd(8)} ${status}`)
      if (vendoredVersion !== undefined && vendoredVersion !== plugin.version) changed += 1
      continue
    }

    const sourceCommit = localHead ?? plugin.commit
    console.log(`${plugin.name.padEnd(26)} ${sourceCommit.slice(0, 7)}`)
    // A nested package (manifest `subdir`) still resolves `--from` at the
    // repository root — that is where `.git` and the stash safety live.
    exportCommit(local === undefined ? plugin.repository : local, sourceCommit, vendorDir, plugin.subdir)
    const version = JSON.parse(readFileSync(join(vendorDir, 'package.json'), 'utf8')).version
    if (version !== plugin.version || sourceCommit !== plugin.commit) changed += 1
    plugin.version = version
    plugin.commit = sourceCommit
  }

  if (!options.check) {
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    console.log(`\nmanifest updated: ${changed} pin(s) changed in ${manifestPath}`)
  } else if (changed > 0) {
    console.log(`\n${changed} vendored version(s) differ from the manifest; run without --check to refresh`)
    process.exitCode = 1
  }
}

main()
