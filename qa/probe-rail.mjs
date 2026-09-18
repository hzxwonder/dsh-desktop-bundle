#!/usr/bin/env node
// How does a person bring the collapsed sidebar back?
import { join } from 'node:path'
import { BUNDLE, quitRunningApp, sleep, startSession, writeJson } from './driver.mjs'
import { awaitReady, prepare } from './scenario.mjs'

const HOME = join(BUNDLE, '..', '..', '..', '.qa', 'fixture-home')
const PORT = 9482

const width = session => session.eval(`
  Math.round(document.querySelector('[class*=EXfQ3q_root]')?.getBoundingClientRect().width ?? -1)`)
const rail = session => session.eval(`(() => {
  const sidebar = document.querySelector('[class*=EXfQ3q_root]')
  if (sidebar === null) return null
  return [...sidebar.querySelectorAll('button, [role=button], a[href]')].map(el => {
    const rect = el.getBoundingClientRect()
    return {
      label: el.getAttribute('aria-label') ?? (el.textContent || '').trim().slice(0, 12),
      rect: [Math.round(rect.x), Math.round(rect.y), Math.round(rect.width), Math.round(rect.height)],
    }
  })
})()`)

const report = []
await quitRunningApp()
const session = await startSession({ home: HOME, port: PORT })
await session.waitFor('document.readyState === "complete"', { timeoutMs: 60000 })
await awaitReady(session)
await prepare(session)

report.push({ step: 'expanded', width: await width(session) })
const toggle = await session.eval('window.__qa.rectOfText("收起侧边栏")')
if (toggle !== null) await session.clickAt(toggle.x + toggle.width / 2, toggle.y + toggle.height / 2)
await sleep(2000)
report.push({ step: 'collapsed', width: await width(session), controls: await rail(session) })
await session.screenshot('rail-collapsed')

// Hovering the rail.
await session.clickAt(28, 400)
for (const ms of [500, 1500, 3000]) {
  await sleep(ms === 500 ? 500 : 1000)
  report.push({ step: `hover ${ms}ms`, width: await width(session) })
}
await session.screenshot('rail-hover')

// The keyboard shortcut a desktop app usually offers.
for (const [key, modifiers, name] of [['b', 4, 'cmd+b'], ['\\', 4, 'cmd+\\'], ['B', 4, 'cmd+shift+b']]) {
  await session.press(key, { modifiers: key === 'B' ? 12 : modifiers })
  await sleep(1200)
  report.push({ step: name, width: await width(session) })
}

// The logo, and any control that only exists in the collapsed state.
await session.clickAt(28, 33)
await sleep(1500)
report.push({ step: 'click logo', width: await width(session) })
const labels = await session.eval(`
  [...document.querySelectorAll('button, [role=button]')]
    .map(el => el.getAttribute('aria-label') ?? (el.textContent || '').trim().slice(0, 10))`)
report.push({ step: 'button labels', labels })

writeJson(join(BUNDLE, 'qa', 'evidence', 'sidebar-rail.json'), report)
console.log(JSON.stringify(report, null, 1))
await quitRunningApp()
