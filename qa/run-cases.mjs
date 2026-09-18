#!/usr/bin/env node
// Acceptance runner for the DSH Desktop bundle.
//
// Each group drives the real application through the DevTools protocol against the
// fixture home prepared by qa/setup-qa.sh, restores that home to a captured golden
// state before it starts, and appends one JSON record per case to
// qa/evidence/results.json. Screenshots named by a case land in qa/evidence/.
//
//   node qa/run-cases.mjs list
//   node qa/run-cases.mjs capture        # snapshot the fixture home as the golden state
//   node qa/run-cases.mjs run A L        # run selected groups
//   node qa/run-cases.mjs run all
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { attachSession, BUNDLE, launcherHome, quitRunningApp, setLauncherHome, sleep, startSession, writeJson } from './driver.mjs'
import { appProcessCount, awaitReady, killApp, prepare } from './scenario.mjs'
import { groups as lifecycleGroups } from './cases-lifecycle.mjs'
import { groups as featureGroups } from './cases-features.mjs'
import { groups as layoutGroups } from './cases-layout.mjs'
import { groups as themeGroups } from './cases-theme.mjs'
import { mockCalls, startMock, stopMock } from './cases-robust.mjs'
import { groups as robustnessGroups } from './cases-robust.mjs'
import { privacyCases } from './cases-privacy.mjs'

const WORKSPACE = resolve(BUNDLE, '..', '..', '..')
const QA_DIR = process.env.DSH_QA_DIR ?? join(WORKSPACE, '.qa')
const FIXTURE_HOME = join(QA_DIR, 'fixture-home')
const GOLDEN_DIR = join(QA_DIR, 'fixture-golden')
const EMPTY_HOME = join(QA_DIR, 'empty-home')
const FRESH_HOME = join(QA_DIR, 'fresh-home')
const APP = '/Applications/DSH Desktop.app'
const CHROME_PORT = 9470

const groups = { ...lifecycleGroups, ...themeGroups, ...layoutGroups, ...featureGroups, ...robustnessGroups, P: { title: '仓库隐私与脱敏', cases: privacyCases, noApp: true } }

// Running a subset refreshes those cases and keeps the rest, so a report can be
// assembled from more than one sitting without losing earlier evidence.
const resultsPath = join(BUNDLE, 'qa', 'evidence', 'results.json')
const results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : []
const startedAt = Date.now()

function record(testCase, status, detail, evidence = []) {
  const entry = {
    id: testCase.id, group: testCase.group, title: testCase.title, priority: testCase.priority,
    status, detail, evidence, at: new Date().toISOString(),
  }
  const existing = results.findIndex(item => item.id === entry.id)
  if (existing >= 0) results[existing] = entry
  else results.push(entry)
  const mark = status === 'pass' ? 'ok  ' : status === 'skip' ? 'skip' : 'FAIL'
  console.log(`${mark} ${testCase.id} ${testCase.title}${detail ? ` — ${detail}` : ''}`)
  writeJson(join(BUNDLE, 'qa', 'evidence', 'results.json'), results)
}

function assertions(testCase) {
  const evidence = []
  return {
    evidence,
    screenshot: async (session, name) => {
      const path = await session.screenshot(`${testCase.id}-${name}`)
      evidence.push(path.slice(path.indexOf('qa/')))
      return path
    },
    check(condition, message) {
      if (!condition) throw new Error(message)
    },
    equal(actual, expected, message) {
      if (actual !== expected) throw new Error(`${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    },
    near(actual, expected, tolerance, message) {
      if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${message}: expected ${expected} ±${tolerance}, got ${actual}`)
      }
    },
    note(message) {
      evidence.push(`note: ${message}`)
      console.log(`     · ${message}`)
    },
  }
}

async function runCase(testCase, context) {
  const assert = assertions(testCase)
  const startedCase = Date.now()
  try {
    await testCase.run(context, assert)
    record(testCase, 'pass', `${Date.now() - startedCase}ms`, assert.evidence)
  } catch (error) {
    record(testCase, 'fail', error instanceof Error ? error.message : String(error), assert.evidence)
    if (context.session !== undefined && testCase.captureOnFailure !== false) {
      try {
        const path = await context.session.screenshot(`${testCase.id}-failure`)
        assert.evidence.push(path.slice(path.indexOf('qa/')))
      } catch { /* the window may be gone */ }
    }
  }
}

// ------------------------------------------------------------ home management

function captureGolden() {
  rmSync(GOLDEN_DIR, { recursive: true, force: true })
  mkdirSync(GOLDEN_DIR, { recursive: true })
  cpSync(join(FIXTURE_HOME, 'settings.yaml'), join(GOLDEN_DIR, 'settings.yaml'))
  cpSync(join(FIXTURE_HOME, 'storages'), join(GOLDEN_DIR, 'storages'), { recursive: true })
  console.log(`captured the golden state of ${FIXTURE_HOME}`)
}

/** A home that has never been opened, for the first-run and empty-state cases. */
function prepareEmptyHome() {
  for (const home of [EMPTY_HOME, FRESH_HOME]) {
    rmSync(home, { recursive: true, force: true })
    mkdirSync(home, { recursive: true })
    cpSync(join(FIXTURE_HOME, 'settings.yaml'), join(home, 'settings.yaml'))
    if (existsSync(join(FIXTURE_HOME, '.credentials.yaml'))) {
      cpSync(join(FIXTURE_HOME, '.credentials.yaml'), join(home, '.credentials.yaml'))
    }
  }
}

function resetFixture() {
  if (!existsSync(GOLDEN_DIR)) throw new Error('no golden state; run "node qa/run-cases.mjs capture" first')
  for (const directory of ['sessions', 'plain-sessions', 'storages']) {
    rmSync(join(FIXTURE_HOME, directory), { recursive: true, force: true })
  }
  cpSync(join(GOLDEN_DIR, 'storages'), join(FIXTURE_HOME, 'storages'), { recursive: true })
  cpSync(join(GOLDEN_DIR, 'settings.yaml'), join(FIXTURE_HOME, 'settings.yaml'))
  console.log('fixture home reset to the golden state')
}

const SYSTEM_APPEARANCE = () => execFileSync('/usr/bin/osascript',
  ['-e', 'tell application "System Events" to tell appearance preferences to get dark mode'],
  { encoding: 'utf8' }).trim() === 'true'

function setSystemAppearance(dark) {
  execFileSync('/usr/bin/osascript',
    ['-e', `tell application "System Events" to tell appearance preferences to set dark mode to ${dark}`],
    { stdio: 'ignore' })
}

// ------------------------------------------------------------------- execution

async function main() {
  const [command = 'list', ...selection] = process.argv.slice(2)
  if (command === 'list') {
    const markdownIndex = selection.indexOf('--markdown')
    const lines = []
    for (const [key, group] of Object.entries(groups)) {
      const header = `${key}: ${group.title} (${group.cases.length} cases)`
      console.log(header)
      lines.push(`## ${key}　${group.title}`, '', '| 用例 | 优先级 | 标题 |', '| --- | --- | --- |')
      for (const testCase of group.cases) {
        console.log(`  ${testCase.id} ${testCase.priority} ${testCase.title}`)
        lines.push(`| ${testCase.id} | ${testCase.priority} | ${testCase.title} |`)
      }
      lines.push('')
    }
    if (markdownIndex >= 0) {
      const target = selection[markdownIndex + 1] ?? join(BUNDLE, 'qa', 'cases.md')
      writeFileSync(target, `# DSH Desktop 验收用例清单\n\n共 ${Object.values(groups).reduce((sum, group) => sum + group.cases.length, 0)} 条。\n\n${lines.join('\n')}`)
      console.log(`\ncase list written to ${target}`)
    }
    return
  }
  if (command === 'capture') {
    await quitRunningApp()
    captureGolden()
    return
  }
  if (command !== 'run') throw new Error(`unknown command: ${command}`)

  // Both group letters and single case ids select work: `run R` runs the group,
  // `run R-12 L-05` refreshes just those cases.
  try {
    execFileSync(process.execPath, [join(BUNDLE, 'qa', 'sanitize-evidence.mjs')], { stdio: 'inherit' })
    // The results were read before sanitizing, so take the cleaned copy as the base
    // for this run instead of writing the raw paths back.
    if (existsSync(resultsPath)) {
      const sanitized = JSON.parse(readFileSync(resultsPath, 'utf8'))
      results.length = 0
      results.push(...sanitized)
    }
  } catch { /* sanitizing is best effort, the privacy case reports what is left */ }

  const caseTokens = new Set(selection.filter(token => /^[A-Z]+-\d+$/u.test(token)))
  const groupTokens = selection.filter(token => !/^[A-Z]+-\d+$/u.test(token))
  const keys = groupTokens.includes('all') || (groupTokens.length === 0 && caseTokens.size === 0)
    ? Object.keys(groups)
    : groupTokens.length > 0
      ? groupTokens
      : Object.keys(groups).filter(key => groups[key].cases.some(testCase => caseTokens.has(testCase.id)))
  const casesFor = key => caseTokens.size === 0
    ? groups[key].cases
    : groups[key].cases.filter(testCase => caseTokens.has(testCase.id))
  prepareEmptyHome()
  mkdirSync(join(BUNDLE, 'qa', 'evidence'), { recursive: true })
  const appearanceAtStart = SYSTEM_APPEARANCE()

  for (const key of keys) {
    const group = groups[key]
    if (group === undefined) throw new Error(`unknown group: ${key}`)
    console.log(`\n== ${key}: ${group.title} ==`)
    await quitRunningApp()
    if (key !== 'P' && !group.keepState) resetFixture()
    rmSync(join(BUNDLE, 'qa', 'evidence', 'app.log'), { force: true })
    // A group that only reads the repository needs no window at all.
    if (group.noApp === true) {
      const offline = {
        home: FIXTURE_HOME, app: APP, state: {}, session: undefined,
        systemAppearance: SYSTEM_APPEARANCE,
      }
      for (const testCase of casesFor(key)) await runCase(testCase, offline)
      continue
    }

    if (launcherHome() !== FIXTURE_HOME) setLauncherHome(FIXTURE_HOME)
    let session = await startSession({ home: FIXTURE_HOME, app: APP, port: CHROME_PORT })
    await session.waitFor('document.readyState === "complete"', { timeoutMs: 60000, message: 'document ready' })
    await awaitReady(session)
    await prepare(session)

    const context = {
      session, home: FIXTURE_HOME, app: APP, state: {},
      emptyHome: EMPTY_HOME,
      freshHome: FRESH_HOME,
      systemAppearance: SYSTEM_APPEARANCE,
      killApp,
      stopMock,
      startMock,
      mockCalls,

      /** Change the system appearance and let the renderer repaint. */
      async setAppearance(dark, { settleMs = 2000 } = {}) {
        if (SYSTEM_APPEARANCE() !== dark) setSystemAppearance(dark)
        await sleep(settleMs)
      },

      /** Run `fn` with the system in the requested appearance, then restore it. */
      async withAppearance(dark, fn) {
        const previous = SYSTEM_APPEARANCE()
        if (previous !== dark) {
          setSystemAppearance(dark)
          await sleep(2500)
        }
        try {
          return await fn(context.session)
        } finally {
          if (SYSTEM_APPEARANCE() !== previous) {
            setSystemAppearance(previous)
            await sleep(1800)
          }
        }
      },

      /**
       * Reconnect to a window that was closed and reopened: the previous page target
       * is gone, so the case needs a fresh connection to the same application.
       */
      async attach() {
        session?.stop()
        await sleep(1000)
        session = await attachSession({ home: context.home, app: APP, port: CHROME_PORT })
        await session.waitFor('document.readyState === "complete"', { timeoutMs: 60000, message: 'reattach ready' })
        await awaitReady(session)
        await prepare(session)
        context.session = session
        return session
      },

      /** Attach if a window exists; undefined lets a case report the absence itself. */
      async tryAttach() {
        try {
          return await context.attach()
        } catch {
          return undefined
        }
      },

      /** Restart the app, optionally against a different home. */
      async relaunch({ home, requireComposer = true } = {}) {
        session.stop()
        await sleep(1500)
        await quitRunningApp()
        // Always point the launcher at the intended home: cases that switched homes
        // earlier in the group would otherwise keep the whole group in the wrong one.
        const target = home ?? context.home
        if (launcherHome() !== target) setLauncherHome(target)
        rmSync(join(BUNDLE, 'qa', 'evidence', 'app.log'), { force: true })
        session = await startSession({ home: target, app: APP, port: CHROME_PORT })
        await session.waitFor('document.readyState === "complete"', { timeoutMs: 60000, message: 'relaunch ready' })
        await awaitReady(session, { requireComposer })
        await prepare(session)
        context.session = session
        return session
      },

      /** The setup-wizard outcome the app recorded for a profile, if any. */
      readSetupOutcome(home) {
        const root = join(process.env.HOME ?? '', 'Library', 'Application Support', 'DSH Desktop', 'profile-setup')
        if (!existsSync(root)) return undefined
        const candidates = []
        for (const entry of readdirSync(root)) {
          const statePath = join(root, entry, 'state.json')
          if (!existsSync(statePath)) continue
          const state = JSON.parse(readFileSync(statePath, 'utf8'))
          if (state.profileHash === entry && Date.now() - Date.parse(state.recordedAt) < 30 * 60 * 1000) {
            candidates.push(state)
          }
        }
        return candidates.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))[0]
      },

      /** Corrupt settings.yaml on purpose and hand back the original text. */
      breakSettings() {
        const path = join(context.home, 'settings.yaml')
        const backup = existsSync(path) ? readFileSync(path, 'utf8') : undefined
        writeFileSync(path, 'dsh-desktop: [unclosed\n  bad: : :\n')
        return backup
      },

      restoreSettings(backup) {
        const path = join(context.home, 'settings.yaml')
        if (backup === undefined) rmSync(path, { force: true })
        else writeFileSync(path, backup)
      },
    }

    try {
      for (const testCase of casesFor(key)) await runCase(testCase, context)
    } finally {
      session.stop()
      await sleep(1500)
      await quitRunningApp()
    }
  }

  if (SYSTEM_APPEARANCE() !== appearanceAtStart) setSystemAppearance(appearanceAtStart)
  const selectedIds = new Set(keys.flatMap(key => casesFor(key).map(testCase => testCase.id)))
  const failed = results.filter(entry => entry.status === 'fail' && selectedIds.has(entry.id))
  const passed = results.filter(entry => entry.status === 'pass')
  // Evidence travels with the report, so strip local user paths before it is committed.
  try {
    execFileSync(process.execPath, [join(BUNDLE, 'qa', 'sanitize-evidence.mjs')], { stdio: 'inherit' })
  } catch { /* sanitizing is best effort, the privacy case reports what is left */ }

  const selected = results.filter(entry => selectedIds.has(entry.id))
  console.log(`\nsummary ${selected.filter(entry => entry.status === 'pass').length}/${selected.length} passed in ${Math.round((Date.now() - startedAt) / 1000)}s`)
  console.log(`app processes still running: ${appProcessCount()}`)
  writeJson(join(BUNDLE, 'qa', 'evidence', 'results.json'), results)
  if (failed.length > 0) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exit(2)
})
