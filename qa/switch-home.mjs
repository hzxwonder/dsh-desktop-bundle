#!/usr/bin/env node
// Switch the launcher to another DSH home, then optionally boot the app and run a
// read-only probe. Used to compare fixture behaviour against the live home.
//
//   node qa/switch-home.mjs <home>            # only re-point the launcher
//   node qa/switch-home.mjs <home> --probe    # re-point, boot, probe, quit
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { BUNDLE, quitRunningApp, sleep, startSession } from './driver.mjs'

const [home, ...flags] = process.argv.slice(2)
if (!home) throw new Error('usage: switch-home.mjs <home> [--probe]')
const APP = '/Applications/DSH Desktop.app'
const USER_DATA = join(process.env.HOME, 'Library', 'Application Support', 'DSH Desktop')

await quitRunningApp()
execFileSync(process.execPath, [
  join(BUNDLE, 'scripts', 'register-home.mjs'),
  '--home', home, '--app', APP, '--user-data', USER_DATA, '--port', '43790',
], { stdio: 'inherit' })

if (!flags.includes('--probe')) process.exit(0)

const session = await startSession({ home, app: APP, port: 9466 })
await session.waitFor('document.readyState === "complete"', { timeoutMs: 60000 })
await sleep(12000)

const describe = () => session.eval(`(() => ({
  url: location.href,
  sidebar: (() => {
    const rows = [...document.querySelectorAll('a[href], button')]
      .filter(el => { const r = el.getBoundingClientRect(); return r.x < 300 && r.width > 40 && r.height > 8 })
      .map(el => (el.textContent || '').replace(/\\s+/g, ' ').trim())
      .filter(text => text.length > 0)
    return rows.slice(0, 30)
  })(),
  hero: !!document.querySelector('[class*=hero]'),
  text: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 400),
}))()`)

const clickNew = async () => {
  const index = await session.eval(`[...document.querySelectorAll('button')]
    .findIndex(el => (el.textContent || '').includes('新会话') || (el.getAttribute('aria-label') || '').includes('新建会话'))`)
  if (index < 0) return false
  await session.click('button', { index })
  return true
}

console.log('\n== boot ==')
console.log(JSON.stringify(await describe(), null, 1))
for (let round = 1; round <= 2; round += 1) {
  console.log(`\n== new session ${round} (clicked=${await clickNew()}) ==`)
  await sleep(4000)
  console.log(JSON.stringify(await describe(), null, 1))
}
session.stop()
await sleep(1500)
await quitRunningApp()
