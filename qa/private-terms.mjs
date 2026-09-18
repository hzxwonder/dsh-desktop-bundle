// The words that must never reach a published repository — private project names,
// internal host aliases — are configuration, not source: the repository ships the
// mechanism, the machine supplies the list.
//
//   QA_PRIVATE_TERMS="term-a,term-b" node qa/run-cases.mjs run P
//   qa/private-terms.local.txt       (one term per line, git-ignored)
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BUNDLE } from './driver.mjs'

export const LOCAL_TERMS = join(BUNDLE, 'qa', 'private-terms.local.txt')

export function privateTerms() {
  const sources = [process.env.QA_PRIVATE_TERMS]
  if (existsSync(LOCAL_TERMS)) sources.push(readFileSync(LOCAL_TERMS, 'utf8'))
  const terms = new Set()
  for (const source of sources) {
    for (const line of String(source ?? '').split(/[\n,]/u)) {
      const term = line.trim()
      if (term.length > 1 && !term.startsWith('#')) terms.add(term)
    }
  }
  return [...terms]
}

/** A regular expression matching any configured term, or undefined when none is set. */
export function privateTermPattern() {
  const terms = privateTerms()
  if (terms.length === 0) return undefined
  return new RegExp(`\\b(?:${terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|')})\\b`, 'iu')
}
