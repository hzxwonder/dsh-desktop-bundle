#!/usr/bin/env node
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/** Require the paired Host API and client command in a packaged Desktop runtime. */
export function verifyPromptRuntime(app) {
  const root = join(app, 'Contents', 'Resources', 'app')
  const client = join(root, 'lib', 'client.js')
  if (!existsSync(client)) throw new Error('Packaged Desktop client is missing')
  const code = readFileSync(client, 'utf8')
  if (!code.includes('desktop-prompt: /prompt command') || !code.includes('/_desktop/prompts')) throw new Error('Packaged Desktop prompt client is missing')
  const seen = new Set()
  function visit(path) {
    if (seen.has(path)) return ''
    seen.add(path)
    const source = readFileSync(path, 'utf8')
    let text = source
    for (const match of source.matchAll(/(?:from\s*|import\s*)["'](\.\/[^"']+\.js)["']/g)) text += visit(resolve(path, '..', match[1]))
    return text
  }
  const host = visit(join(root, 'lib', 'index.js'))
  if (!host.includes('desktop-prompt: library API') || !host.includes('/_desktop/prompts')) throw new Error('Packaged Desktop prompt Host API is missing; rebuild the complete application')
  console.log('verify-prompt-runtime: paired Host API and client command are present')
}
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  if (!process.argv[2]) throw new Error('Usage: node scripts/verify-prompt-runtime.mjs <Desktop.app>')
  verifyPromptRuntime(resolve(process.argv[2]))
}
