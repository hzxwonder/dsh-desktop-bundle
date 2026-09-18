#!/usr/bin/env node
// Verify the permission-free window controls: read the frame, resize it, close it.
import { join } from 'node:path'
import { closeRunningApp, quitRunningApp, sleep, startSession, writeJson, BUNDLE } from './driver.mjs'
import { appProcessCount, awaitReady, prepare } from './scenario.mjs'

const HOME = join(BUNDLE, '..', '..', '..', '.qa', 'fixture-home')
const PORT = 9475

const report = {}
await quitRunningApp()
const session = await startSession({ home: HOME, port: PORT })
await session.waitFor('document.readyState === "complete"', { timeoutMs: 60000 })
await awaitReady(session)
await prepare(session)

report.initial = await session.eval('window.__qa.frame ? window.__qa.frame() : null') ?? await session.eval(`({
  x: window.screenX, y: window.screenY, width: window.outerWidth, height: window.outerHeight,
  innerWidth: window.innerWidth, innerHeight: window.innerHeight,
})`)
console.log('initial frame:', JSON.stringify(report.initial))

report.resize = await session.resize(900, 640)
console.log('after resizeTo(900,640):', JSON.stringify(report.resize))
await session.screenshot('probe-resized')

report.resizeBack = await session.resize(1280, 840)
console.log('after resizeTo(1280,840):', JSON.stringify(report.resizeBack))

report.processesBeforeClose = appProcessCount()
await session.closeWindow()
await sleep(6000)
report.processesAfterWindowClose = appProcessCount()
console.log(`window.close(): processes ${report.processesBeforeClose} -> ${report.processesAfterWindowClose}`)

if (report.processesAfterWindowClose > 0) {
  report.browserClose = await closeRunningApp({ port: PORT })
  await sleep(5000)
  report.processesAfterBrowserClose = appProcessCount()
  console.log(`Browser.close(): ${report.browserClose}, processes -> ${report.processesAfterBrowserClose}`)
}

writeJson(join(BUNDLE, 'qa', 'evidence', 'window-controls.json'), report)
await quitRunningApp()
