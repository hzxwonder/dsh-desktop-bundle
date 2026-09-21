#!/usr/bin/env node
// Evidence is published with the report, so local paths that name a person are
// replaced before anything leaves this machine.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BUNDLE } from './driver.mjs'
import { maskLocalPaths } from './local-paths.mjs'

const EVIDENCE = join(BUNDLE, 'qa', 'evidence')
const TEXT = /\.(?:json|txt|md|log)$/u

const targets = [join(BUNDLE, 'qa', 'ACCEPTANCE-REPORT.md'), join(BUNDLE, 'qa', 'README.md')]
for (const name of readdirSync(EVIDENCE)) targets.push(join(EVIDENCE, name))

let changed = 0
for (const path of targets) {
  const name = path.split('/').pop()
  if (!existsSync(path) || !statSync(path).isFile() || !TEXT.test(name)) continue
  const original = readFileSync(path, 'utf8')
  const text = maskLocalPaths(original)
  if (text !== original) {
    writeFileSync(path, text)
    changed += 1
  }
}
console.log(`sanitized ${changed} evidence file(s)`)
