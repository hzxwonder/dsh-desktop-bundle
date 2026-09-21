#!/usr/bin/env node
// Runner for the Desktop workflow acceptance suite.
//
//   node qa/workflow-desktop/run.mjs list
//   node qa/workflow-desktop/run.mjs run all
//   node qa/workflow-desktop/run.mjs run A B
//   node qa/workflow-desktop/run.mjs run W-C-05
//
// One case is one behaviour in the real Desktop window. Results and screenshots
// land in qa/evidence/workflow-desktop/ and qa/evidence/workflow-results.json.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import * as h from './helper.mjs'
import { groups, allCases } from './cases.mjs'
import { rmSync } from 'node:fs'

const RESULTS = join(h.EVIDENCE, 'results.json')
mkdirSync(h.EVIDENCE, { recursive: true })

const results = existsSync(RESULTS) ? JSON.parse(readFileSync(RESULTS, 'utf8')) : []

function record(entry) {
  const existing = results.findIndex(item => item.id === entry.id)
  if (existing >= 0) results[existing] = entry
  else results.push(entry)
  writeFileSync(RESULTS, `${JSON.stringify(results, null, 2)}\n`)
  const mark = entry.status === 'pass' ? 'ok  ' : entry.status === 'skip' ? 'skip' : 'FAIL'
  console.log(`${mark} ${entry.id} ${entry.title}${entry.detail ? ` — ${entry.detail}` : ''}`)
}

function makeAssert() {
  const evidence = []
  return {
    evidence,
    check(condition, message) { if (!condition) throw new Error(message) },
    equal(actual, expected, message) {
      if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    },
    note(message) { evidence.push(`note: ${message}`); console.log(`     · ${message}`) },
  }
}

/**
 * Return the fixture home to its seed state before a run: sessions and the
 * workflow database both start from one synthetic workflow, so a previous run's
 * records can never make a later assertion pass or fail for the wrong reason.
 */
function resetFixture() {
  for (const directory of ['sessions', 'plain-sessions']) {
    rmSync(join(h.FIXTURE_HOME, directory), { recursive: true, force: true })
  }
  const seed = join(h.QA_ROOT, 'workflow-seed')
  if (!existsSync(seed)) {
    console.log('no workflow seed; run "node qa/workflow-desktop/run.mjs seed" once to capture it')
    return
  }
  const studio = join(h.FIXTURE_HOME, 'workflow-studio')
  rmSync(studio, { recursive: true, force: true })
  cpSync(seed, join(studio, '..', 'workflow-studio'), { recursive: true })
  writeFileSync(join(h.EVIDENCE, 'reset.txt'), new Date().toISOString())
}

/** Capture the current workflow database as the state every run starts from. */
function captureSeed() {
  const studio = join(h.FIXTURE_HOME, 'workflow-studio')
  const seed = join(h.QA_ROOT, 'workflow-seed')
  rmSync(seed, { recursive: true, force: true })
  cpSync(studio, seed, { recursive: true })
  for (const leftover of ['workflows.sqlite-wal', 'workflows.sqlite-shm']) {
    rmSync(join(seed, leftover), { force: true })
  }
  console.log(`captured workflow seed from ${studio}`)
}

async function main() {
  const [command = 'list', ...selection] = process.argv.slice(2)
  if (command === 'list') {
    for (const [key, group] of Object.entries(groups)) {
      console.log(`\n${key}: ${group.title} (${group.cases.length})`)
      for (const testCase of group.cases) console.log(`  ${testCase.id} ${testCase.priority} ${testCase.title}`)
    }
    console.log(`\ntotal ${allCases.length} cases`)
    return
  }
  if (command === 'seed') { captureSeed(); return }
  if (command !== 'run') throw new Error(`unknown command: ${command}`)

  const caseTokens = new Set(selection.filter(token => /^W-[A-Z]+-\d+$/.test(token)))
  const groupTokens = selection.filter(token => !/^W-[A-Z]+-\d+$/.test(token)).map(t => t.replace(/^W-/, ''))
  const keys = groupTokens.includes('all') || (groupTokens.length === 0 && caseTokens.size === 0)
    ? Object.keys(groups)
    : groupTokens.length > 0
      ? groupTokens
      : Object.keys(groups).filter(key => groups[key].cases.some(c => caseTokens.has(c.id)))
  const casesFor = key => caseTokens.size === 0 ? groups[key].cases : groups[key].cases.filter(c => caseTokens.has(c.id))

  resetFixture()
  let session = await h.launch()
  const relaunch = async () => {
    session = await h.launch()
    return session
  }

  for (const key of keys) {
    const group = groups[key]
    if (group === undefined) throw new Error(`unknown group ${key}`)
    console.log(`\n== ${key}: ${group.title} ==`)
    for (const testCase of casesFor(key)) {
      const assert = makeAssert()
      const started = Date.now()
      try {
        await testCase.run({ assert, session, h, relaunch })
        record({ id: testCase.id, group: testCase.group ?? key, title: testCase.title, priority: testCase.priority, status: 'pass', detail: `${Date.now() - started}ms`, evidence: assert.evidence, at: new Date().toISOString() })
      } catch (error) {
        record({ id: testCase.id, group: testCase.group ?? key, title: testCase.title, priority: testCase.priority, status: 'fail', detail: error instanceof Error ? error.message : String(error), evidence: assert.evidence, at: new Date().toISOString() })
        try { assert.evidence.push(await h.shot(session, `${testCase.id}-failure`)) } catch { /* window may be gone */ }
      }
    }
  }
  await h.quitRunningApp()
  const failed = results.filter(r => r.status === 'fail')
  console.log(`\n${results.filter(r => r.status === 'pass').length} passed, ${failed.length} failed`)
  process.exit(failed.length > 0 ? 1 : 0)
}

await main()
