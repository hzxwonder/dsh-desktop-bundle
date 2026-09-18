#!/usr/bin/env node
// Determine how the shell follows the system appearance: live, on next launch, or
// only through an explicit preference. Prints the renderer theme for each step.
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { BUNDLE, quitRunningApp, sleep, startSession } from './driver.mjs'

const HOME = join(BUNDLE, '..', '..', '..', '.qa', 'fixture-home')
const read = session => session.eval('window.__qa ? window.__qa.theme() : (() => { const r = document.documentElement; return { dark: r.hasAttribute("data-ds-dark-theme"), colorScheme: r.style.colorScheme, background: getComputedStyle(document.body).backgroundColor } })()')

const setAppearance = value => execFileSync('/usr/bin/osascript', ['-e', `tell application "System Events" to tell appearance preferences to set dark mode to ${value}`], { stdio: 'ignore' })
const currentAppearance = () => execFileSync('/usr/bin/osascript', ['-e', 'tell application "System Events" to tell appearance preferences to get dark mode'], { encoding: 'utf8' }).trim()

const startedDark = currentAppearance() === 'true'
console.log(`system dark mode at start: ${startedDark}`)

await quitRunningApp()
const session = await startSession({ home: HOME, port: 9471 })
await session.waitFor('document.readyState === "complete"', { timeoutMs: 60000 })
await sleep(12000)

console.log('boot theme:', JSON.stringify(await read(session)))
await session.screenshot('theme-probe-boot')

const flipped = !startedDark
setAppearance(flipped)
await sleep(6000)
console.log(`after switching the system to ${flipped ? 'dark' : 'light'} (live):`, JSON.stringify(await read(session)))
await session.screenshot('theme-probe-live-switch')

session.stop()
await sleep(2000)
await quitRunningApp()

const session2 = await startSession({ home: HOME, port: 9472 })
await session2.waitFor('document.readyState === "complete"', { timeoutMs: 60000 })
await sleep(12000)
console.log(`after restarting while the system is ${flipped ? 'dark' : 'light'}:`, JSON.stringify(await read(session2)))
await session2.screenshot('theme-probe-after-restart')
session2.stop()
await sleep(1500)
await quitRunningApp()

setAppearance(startedDark)
console.log(`system appearance restored to ${startedDark ? 'dark' : 'light'}`)
