#!/usr/bin/env node
// Evidence is published with the report, so local paths that name a person are
// replaced before anything leaves this machine.
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BUNDLE } from './driver.mjs'

const EVIDENCE = join(BUNDLE, 'qa', 'evidence')
const TEXT = /\.(?:json|txt|md|log)$/u

const rules = [
  [/\/Users\/[^/\s"']+/gu, '/Users/<user>'],
  [/\/home\/[^/\s"']+/gu, '/home/<user>'],
]

const targets = [join(BUNDLE, 'qa', 'ACCEPTANCE-REPORT.md'), join(BUNDLE, 'qa', 'README.md')]
for (const name of readdirSync(EVIDENCE)) targets.push(join(EVIDENCE, name))

let changed = 0
for (const path of targets) {
  const name = path.split('/').pop()
  if (!existsSync(path) || !statSync(path).isFile() || !TEXT.test(name)) continue
  const original = readFileSync(path, 'utf8')
  let text = original
  for (const [pattern, replacement] of rules) text = text.replace(pattern, replacement)
  if (text !== original) {
    writeFileSync(path, text)
    changed += 1
  }
}
console.log(`sanitized ${changed} evidence file(s)`)
