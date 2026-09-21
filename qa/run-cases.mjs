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
import { chmodSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { attachSession, BUNDLE, launcherHome, quitRunningApp, setLauncherHome, sleep, startSession, StimulusUnavailable, writeJson } from './driver.mjs'
import { maskLocalPaths } from './local-paths.mjs'
import { appProcessCount, awaitReady, dismissWelcome, killApp, prepare, welcomeVisible } from './scenario.mjs'
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
    // Masked at the source: a result file that names this machine's account
    // would otherwise fail the privacy group it is published next to.
    status, detail: maskLocalPaths(detail), evidence: evidence.map(maskLocalPaths), at: new Date().toISOString(),
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
    const skipped = error instanceof AppearanceUnavailable || error instanceof StimulusUnavailable
    record(
      testCase,
      skipped ? 'skip' : 'fail',
      error instanceof Error ? error.message : String(error),
      assert.evidence,
    )
    if (!skipped && context.session !== undefined && testCase.captureOnFailure !== false) {
      try {
        const path = await context.session.screenshot(`${testCase.id}-failure`)
        assert.evidence.push(path.slice(path.indexOf('qa/')))
      } catch { /* the window may be gone */ }
    }
  }
}

// ------------------------------------------------------------ home management

/**
 * A composed home that the application has not opened yet holds only its
 * profile, so the golden state and every reset copy the runtime directories the
 * composition produced and nothing more.
 */
function copyWhenPresent(source, destination, options) {
  if (existsSync(source)) cpSync(source, destination, options)
}

/**
 * Snapshot the fixture home as the state every group starts from. The home is
 * opened once first: the internal-testing notice is acknowledged into the home's
 * settings document, so the snapshot is a home that has been used rather than one
 * that still owes the first-run overlay. A-02 reads whichever state it gets.
 */
async function captureGolden() {
  await quitRunningApp()
  if (launcherHome() !== FIXTURE_HOME) setLauncherHome(FIXTURE_HOME)
  const session = await startSession({ home: FIXTURE_HOME, app: APP, port: CHROME_PORT })
  try {
    await session.waitFor('document.readyState === "complete"', { timeoutMs: 60000, message: 'document ready' })
    await startFromMainView(session)
    await awaitReady(session)
    await prepare(session)
    if (await welcomeVisible(session)) {
      console.log(`acknowledging the welcome notice: ${await dismissWelcome(session)}`)
      await sleep(2500)
    }
  } finally {
    session.stop()
    await sleep(1200)
    await quitRunningApp()
    await restorePanelState(session)
  }
  rmSync(GOLDEN_DIR, { recursive: true, force: true })
  mkdirSync(GOLDEN_DIR, { recursive: true })
  cpSync(join(FIXTURE_HOME, 'settings.yaml'), join(GOLDEN_DIR, 'settings.yaml'))
  copyWhenPresent(join(FIXTURE_HOME, 'storages'), join(GOLDEN_DIR, 'storages'), { recursive: true })
  console.log(`captured the golden state of ${FIXTURE_HOME}`)
}

/** A home that has never been opened, for the first-run and empty-state cases. */
function prepareEmptyHome() {
  for (const home of [EMPTY_HOME, FRESH_HOME]) {
    rmSync(home, { recursive: true, force: true })
    mkdirSync(home, { recursive: true })
    cpSync(join(FIXTURE_HOME, 'settings.yaml'), join(home, 'settings.yaml'))
    if (existsSync(join(FIXTURE_HOME, '.credentials.yaml'))) {
      // The credentials plugin loads an owner-only document, so every copy keeps
      // that mode regardless of the umask this run inherited.
      cpSync(join(FIXTURE_HOME, '.credentials.yaml'), join(home, '.credentials.yaml'))
      chmodSync(join(home, '.credentials.yaml'), 0o600)
    }
  }
}

/**
 * The fixture home differences that belong to the setup rather than to a run:
 * the document the app owns, the QA credentials, the composed profile and the
 * anonymous identity. Everything else a run writes is throwaway.
 */
const FIXTURE_PROVISIONING = new Set(['settings.yaml', '.credentials.yaml', '.anonymous-user-id', 'profiles'])

function resetFixture() {
  if (!existsSync(GOLDEN_DIR)) throw new Error('no golden state; run "node qa/run-cases.mjs capture" first')
  // A run leaves more than sessions behind: plugin-owned directories decide which
  // view the next launch opens, so the reset keeps only the provisioning and
  // hands every group a home that has never been opened.
  for (const entry of readdirSync(FIXTURE_HOME)) {
    if (!FIXTURE_PROVISIONING.has(entry)) rmSync(join(FIXTURE_HOME, entry), { recursive: true, force: true })
  }
  copyWhenPresent(join(GOLDEN_DIR, 'storages'), join(FIXTURE_HOME, 'storages'), { recursive: true })
  cpSync(join(GOLDEN_DIR, 'settings.yaml'), join(FIXTURE_HOME, 'settings.yaml'))
  console.log('fixture home reset to the golden state')
}

/**
 * Raised when the host driving this run may not ask System Events for the
 * system appearance. Such a case is skipped rather than failed: the interface
 * under test was never given the appearance it asks about.
 */
class AppearanceUnavailable extends Error {}

/** Live style through System Events; undefined when the host may not ask. */
function appleScriptAppearance() {
  try {
    return execFileSync('/usr/bin/osascript',
      ['-e', 'tell application "System Events" to tell appearance preferences to get dark mode'],
      { encoding: 'utf8', timeout: 15000, killSignal: 'SIGKILL' }).trim() === 'true'
  } catch {
    return undefined
  }
}

/**
 * The system appearance as the global domain records it, which needs no Apple
 * Events. Automatic switching follows the clock rather than the preference, so
 * that mode asks System Events for the live style and keeps the raw preference
 * when the host may not.
 */
const SYSTEM_APPEARANCE = () => {
  const read = key => {
    try {
      return execFileSync('/usr/bin/defaults', ['read', '-g', key], { encoding: 'utf8' }).trim()
    } catch {
      return ''
    }
  }
  if (read('AppleInterfaceStyleSwitchesAutomatically') === '1') {
    const live = appleScriptAppearance()
    if (live !== undefined) return live
  }
  return read('AppleInterfaceStyle') === 'Dark'
}

function setSystemAppearance(dark) {
  try {
    execFileSync('/usr/bin/osascript',
      ['-e', `tell application "System Events" to tell appearance preferences to set dark mode to ${dark}`],
      { stdio: 'ignore', timeout: 20000, killSignal: 'SIGKILL' })
  } catch (error) {
    throw new AppearanceUnavailable(`the host cannot change the system appearance: ${error instanceof Error ? error.message : String(error)}`)
  }
  if (SYSTEM_APPEARANCE() !== dark) {
    throw new AppearanceUnavailable('the system appearance did not follow the request')
  }
}

/**
 * Studio panels remember being open in the renderer's local storage, which
 * belongs to the application rather than to a home, so the panel a previous
 * group (or the live user) left open would decide where the next launch lands.
 * The keys are lifted into `panelState` and put back when the run ends.
 */
const panelState = new Map()

async function startFromMainView(session) {
  const opened = await session.eval(`(() => {
    const keys = []
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (key.endsWith(':panel-open')) keys.push([key, localStorage.getItem(key)])
    }
    return keys
  })()`)
  if (opened.length === 0) return
  for (const [key, value] of opened) {
    if (!panelState.has(key)) panelState.set(key, value)
    console.log(`closing the studio panel left open by ${key}`)
  }
  await session.eval(`(() => {
    for (const [key] of ${JSON.stringify(opened)}) localStorage.removeItem(key)
  })()`)
  await session.eval('location.reload()')
  await session.waitFor('document.readyState === "complete"', { timeoutMs: 60000, message: 'reload after closing the studio panel' })
}

/** Put the panel preferences back the way the run found them. */
async function restorePanelState(session) {
  if (panelState.size === 0) return
  const entries = [...panelState]
  await session.eval(`(() => {
    for (const [key, value] of ${JSON.stringify(entries)}) localStorage.setItem(key, value)
  })()`).catch(() => { /* the window may already be gone */ })
  panelState.clear()
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
    await captureGolden()
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
    await startFromMainView(session)
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
       * Read the interface theme until it reports the expected colour scheme. The
       * operating system delivers the appearance notification asynchronously, so a
       * single read can land before the interface has repainted.
       */
      async waitForTheme(scheme, timeoutMs = 10000) {
        const deadline = Date.now() + timeoutMs
        let last
        for (;;) {
          last = await context.session.eval('window.__qa.theme()')
          if (last.colorScheme === scheme || Date.now() >= deadline) return last
          await sleep(400)
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
      await restorePanelState(session)
      session.stop()
      await sleep(1500)
      await quitRunningApp()
    }
  }

  if (SYSTEM_APPEARANCE() !== appearanceAtStart) setSystemAppearance(appearanceAtStart)
  const selectedIds = new Set(keys.flatMap(key => casesFor(key).map(testCase => testCase.id)))
  const failed = results.filter(entry => entry.status === 'fail' && selectedIds.has(entry.id))
  const passed = results.filter(entry => entry.status === 'pass')
  const selected = results.filter(entry => selectedIds.has(entry.id))
  console.log(`\nsummary ${selected.filter(entry => entry.status === 'pass').length}/${selected.length} passed in ${Math.round((Date.now() - startedAt) / 1000)}s`)
  console.log(`app processes still running: ${appProcessCount()}`)
  writeJson(join(BUNDLE, 'qa', 'evidence', 'results.json'), results)
  // Evidence travels with the report, so strip local user paths once the run has
  // written its last file — sanitizing any earlier would be overwritten below.
  try {
    execFileSync(process.execPath, [join(BUNDLE, 'qa', 'sanitize-evidence.mjs')], { stdio: 'inherit' })
  } catch { /* sanitizing is best effort, the privacy case reports what is left */ }
  if (failed.length > 0) process.exitCode = 1
}

main().catch(error => {
  console.error(error)
  process.exit(2)
})
