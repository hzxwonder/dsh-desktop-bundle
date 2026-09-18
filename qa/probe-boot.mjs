#!/usr/bin/env node
// Follow a boot step by step with generous waits, so a case never has to guess
// whether the Host has finished mounting the client.
import { join } from 'node:path'
import { BUNDLE, quitRunningApp, sleep, startSession, writeJson } from './driver.mjs'

const HOME = join(BUNDLE, '..', '..', '..', '.qa', 'fixture-home')

const state = session => session.eval(`(() => ({
  text: (document.body.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 260),
  composer: !!document.querySelector('[data-composer-input]'),
  composerVisible: (() => { const n = document.querySelector('[data-composer-input]'); if (!n) return false; const r = n.getBoundingClientRect(); return r.width > 1 && r.height > 1 })(),
  buttons: [...document.querySelectorAll('button')].map(el => (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 16)).filter(Boolean).slice(0, 14),
  modal: !!document.querySelector('[role=dialog], [class*=modal], [class*=Modal], [class*=notice], [class*=Notice]'),
  elements: document.querySelectorAll('*').length,
}))()`)

await quitRunningApp()
const session = await startSession({ home: HOME, port: 9473 })
await session.waitFor('document.readyState === "complete"', { timeoutMs: 60000 })

const timeline = []
for (let second = 1; second <= 8; second += 1) {
  await sleep(5000)
  const snapshot = await state(session)
  timeline.push({ seconds: second * 5, ...snapshot })
  console.log(`t+${second * 5}s composer=${snapshot.composer}/${snapshot.composerVisible} modal=${snapshot.modal} elements=${snapshot.elements}`)
  console.log(`      text: ${snapshot.text.slice(0, 120)}`)
  console.log(`      buttons: ${snapshot.buttons.join(' / ')}`)
}

await session.screenshot('boot-timeline')
writeJson(join(BUNDLE, 'qa', 'evidence', 'boot-timeline.json'), timeline)
session.stop()
await sleep(1500)
await quitRunningApp()
