#!/usr/bin/env node
// How does the application behave after its window is closed?
// The three ways a person could bring it back are tried in turn, and each one is
// recorded with the process count and the renderer targets it leaves behind.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { attachSession, BUNDLE, quitRunningApp, sleep, startSession, writeJson } from './driver.mjs'
import { appProcessCount, awaitReady, mainProcessId, prepare } from './scenario.mjs'

const HOME = join(BUNDLE, '..', '..', '..', '.qa', 'fixture-home')
const PORT = 9481
const APP = '/Applications/DSH Desktop.app'

const targets = async () => {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    return list.filter(entry => entry.type === 'page').map(entry => entry.url.replace(/^file:.*native-ui\//, 'native-ui/').slice(0, 50))
  } catch {
    return ['<no debugger endpoint>']
  }
}

const snapshot = async label => {
  const entry = { label, processes: appProcessCount(), mainPid: mainProcessId(), targets: await targets() }
  console.log(`${label}: processes=${entry.processes} mainPid=${entry.mainPid} targets=${JSON.stringify(entry.targets)}`)
  return entry
}

const timeline = []
await quitRunningApp()
const session = await startSession({ home: HOME, port: PORT })
await session.waitFor('document.readyState === "complete"', { timeoutMs: 60000 })
await awaitReady(session)
await prepare(session)
const frame = await session.eval('({ x: window.screenX, y: window.screenY, width: window.outerWidth, height: window.outerHeight })')
timeline.push(await snapshot('running'))
console.log('frame:', JSON.stringify(frame))

await session.closeWindow()
await sleep(6000)
timeline.push(await snapshot('after window.close()'))

const tryAttach = async label => {
  try {
    const attached = await attachSession({ home: HOME, app: APP, port: PORT, launchTimeoutMs: 15000 })
    await awaitReady(attached, { timeoutMs: 30000 })
    await prepare(attached)
    const rows = await attached.eval('window.__qa.conversationRows().length')
    console.log(`  ${label}: attached, sidebar rows=${rows}`)
    attached.stop()
    return true
  } catch (error) {
    console.log(`  ${label}: ${error.message}`)
    return false
  }
}

// 1. Clicking the Dock icon / opening the app the normal way.
try { execFileSync('/usr/bin/open', ['-a', APP], { stdio: 'ignore' }) } catch { /* reported by the timeline */ }
await sleep(8000)
timeline.push(await snapshot('after open -a (Dock activation)'))
const dockWorked = await tryAttach('attach after Dock activation')
timeline.push({ label: 'dock activation reopened a window', value: dockWorked })

// 2. Launching the application again, which the single-instance lock forwards.
try {
  execFileSync(join(APP, 'Contents', 'MacOS', 'DSH Desktop'), [], { stdio: 'ignore', timeout: 20000 })
} catch { /* the second process exits by design */ }
await sleep(8000)
timeline.push(await snapshot('after launching the app again'))
const relaunchWorked = await tryAttach('attach after a second launch')
timeline.push({ label: 'second launch reopened a window', value: relaunchWorked })

writeJson(join(BUNDLE, 'qa', 'evidence', 'reopen-behaviour.json'), timeline)
await quitRunningApp()
