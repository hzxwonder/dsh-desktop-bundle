// Shared primitives for the Desktop workflow acceptance suite.
//
// The suite drives the real DSH Desktop window over the DevTools protocol against
// the isolated QA fixture home. Everything here expresses a user action (open the
// panel, click a card action, switch theme, resize the window) and returns
// observable state, so a case reads as a behaviour rather than as DOM plumbing.
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { BUNDLE, launcherHome, quitRunningApp, setLauncherHome, sleep, startSession } from '../driver.mjs'
import { awaitReady, prepare } from '../scenario.mjs'
import { CONTRAST_HELPERS } from '../contrast.mjs'

export { sleep, quitRunningApp, launcherHome, setLauncherHome }
export const APP = '/Applications/DSH Desktop.app'
export const PORT = 9470
// The QA root sits beside the plugin workspace, outside the bundle, so a run never
// leaves fixture data in the tree that ships. Derived, not hard-coded, so the
// suite carries no machine-specific path.
export const QA_ROOT = process.env.DSH_QA_DIR ?? resolve(BUNDLE, '..', '..', '..', '.qa')
export const HOME_DIR = homedir()
export const FIXTURE_HOME = join(QA_ROOT, 'fixture-home')
export const FIXTURE_WORKSPACE = join(QA_ROOT, 'fixture-workspace')
export const UNSAVED_WORKSPACE = join(QA_ROOT, 'unsaved-workspace')
export const EVIDENCE = join(BUNDLE, 'qa', 'evidence', 'workflow-desktop')

/** Actions the backend exposes to the client; used to seed and verify state. */
export async function studio(session, args) {
  const result = await session.eval(`fetch('/api/workflow-studio',{method:'POST',headers:{'Content-Type':'application/json'},body:${JSON.stringify(JSON.stringify(args))}}).then(r=>r.json())`)
  return result
}

export async function studioOk(session, args) {
  const result = await studio(session, args)
  if (!result?.ok) throw new Error(`studio ${args.action} failed: ${JSON.stringify(result)}`)
  return result.value
}

export async function state(session) {
  return studioOk(session, { action: 'state' })
}

/** Relaunch on the fixture home; the launcher locator decides which home opens. */
export async function launch({ home = FIXTURE_HOME, port = PORT } = {}) {
  await quitRunningApp()
  await sleep(1200)
  if (launcherHome() !== home) setLauncherHome(home)
  const session = await startSession({ home, app: APP, port, evidenceDir: EVIDENCE })
  await session.waitFor('document.readyState === "complete"', { timeoutMs: 90000, message: 'document ready' })
  await awaitReady(session).catch(() => {})
  await installHelpers(session)
  return session
}

/** Extra probes the workflow cases need on top of the shared scenario helpers. */
/**
 * Install both probe sets into the current document. Safe to call again after a
 * reload or a relaunch, which is exactly when the previous document is gone.
 */
export async function installHelpers(session) {
  await prepare(session)
  await session.eval(String.raw`
window.__wf = {
  panel() { return document.querySelector('.wf-main') },
  panelOpen() { return !!document.querySelector('.wf-main') },
  gallery() { return document.querySelector('.wf-gallery') },
  nav() { return document.querySelector('button[aria-label=工作流]') },
  navExpanded() { const n = window.__wf.nav(); return n ? n.getAttribute('aria-expanded') : null },
  cards() { return [...document.querySelectorAll('[data-workflow-card]')] },
  rows() { return [...document.querySelectorAll('[data-workflow-row]')] },
  card(id) { return document.querySelector('[data-workflow-card="' + id + '"]') },
  cardTitle(el) { return el ? (el.querySelector('.wf-card-title')?.textContent || '').trim() : null },
  cardTitles() { return window.__wf.cards().map(window.__wf.cardTitle) },
  cardActions(el) {
    if (!el) return []
    return [...el.querySelectorAll('.wf-card-actions button')].map(b => ({
      label: (b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g, ' ').trim(),
      disabled: b.disabled === true,
    }))
  },
  rowActions(el) {
    if (!el) return []
    return [...el.querySelectorAll('td:last-child button')].map(b => ({
      label: (b.getAttribute('aria-label') || b.textContent || '').replace(/\s+/g, ' ').trim(),
      disabled: b.disabled === true,
    }))
  },
  byLabel(text, scope) {
    const root = scope ? document.querySelector(scope) : document
    if (!root) return null
    return [...root.querySelectorAll('button,[role=button],[role=tab],[role=menuitem],a[href],summary,label')]
      .find(el => window.__qa.visible(el)
        && (((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).includes(text)))
  },
  rectOf(elOrText, scope) {
    const el = typeof elOrText === 'string' ? window.__wf.byLabel(elOrText, scope) : elOrText
    return el ? window.__qa.rect(el) : null
  },
  panelRect() { const p = window.__wf.panel(); return p ? window.__qa.rect(p) : null },
  overflow() {
    const p = window.__wf.panel()
    const scan = root => [...root.querySelectorAll('*')].filter(el => {
      if (!window.__qa.visible(el)) return false
      const r = el.getBoundingClientRect()
      return r.right > window.innerWidth + 1 || r.left < -1
    }).slice(0, 8).map(el => ({
      cls: String(el.className).slice(0, 60),
      text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 40),
      right: Math.round(el.getBoundingClientRect().right),
    }))
    return {
      viewport: [window.innerWidth, window.innerHeight],
      documentScrollWidth: document.documentElement.scrollWidth,
      documentClientWidth: document.documentElement.clientWidth,
      horizontalScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      offenders: p ? scan(p) : scan(document),
    }
  },
  /**
   * Controls that visually collide. A control the layout deliberately lays over
   * another — the delete button on a step row, a badge on a card — is skipped here
   * and judged by its own case, because counting it as a collision would report a
   * working overlay as broken layout.
   */
  overlaps() {
    const panel = window.__wf.panel()
    if (!panel) return { checked: 0, pairs: [], overlaid: 0 }
    const describe = el => ({
      text: (el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 30),
      cls: String(el.className || '').slice(0, 40),
      rect: [Math.round(el.getBoundingClientRect().x), Math.round(el.getBoundingClientRect().y)],
    })
    // A control inside a positioned layer — a floating toolbar, a sticky header, an
    // overlay — is laid over the content on purpose. Those layers get their own case,
    // so judging their children as collisions would report working affordances as bugs.
    const inPositionedLayer = el => {
      for (let node = el; node && node !== panel; node = node.parentElement) {
        const position = getComputedStyle(node).position
        if (position === 'absolute' || position === 'fixed' || position === 'sticky') return true
      }
      return false
    }
    const candidates = [...panel.querySelectorAll('button,[role=tab],input,summary,.wf-card,.wf-outline-step')]
      .filter(window.__qa.visible)
      .map(el => ({ el, r: el.getBoundingClientRect(), layered: inPositionedLayer(el) }))
      .filter(item => item.r.width > 1 && item.r.height > 1)
    const boxes = candidates.filter(item => !item.layered)
    const overlaid = candidates.length - boxes.length
    const pairs = []
    for (let i = 0; i < boxes.length && pairs.length < 8; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j]
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue
        const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left)
        const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
        if (ox > 2 && oy > 2) pairs.push({ a: describe(a.el), b: describe(b.el), overlap: [Math.round(ox), Math.round(oy)] })
      }
    }
    return { checked: boxes.length, overlaid, pairs }
  },
  text() {
    const panel = window.__wf.panel()
    return panel ? (panel.innerText || '').replace(/\s+/g, ' ').trim() : ''
  },
  errorText() {
    return [...document.querySelectorAll('[role=alert],.wf-error,.wf-notice')]
      .filter(window.__qa.visible).map(el => (el.textContent || '').trim()).join(' | ')
  },
}
true`)
}

/** Click by visible label inside the workflow panel (optionally scoped). */
export async function click(session, label, { scope = undefined, settleMs = 450, index = 0 } = {}) {
  const rect = await session.eval(`(() => {
    const root = ${scope ? `document.querySelector(${JSON.stringify(scope)})` : 'document.body'}
    if (!root) return null
    const items = [...root.querySelectorAll('button,[role=button],[role=tab],[role=menuitem],a[href],summary,label')]
      .filter(el => window.__qa.visible(el)
        && (((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).includes(${JSON.stringify(label)})))
    // A card whose *name* contains the label ("验收-拷贝源") would otherwise make the
    // card itself the first match, so the smallest match — the control that carries
    // the label — is clicked, with the caller's index selecting among equals.
    const area = el => { const r = el.getBoundingClientRect(); return r.width * r.height }
    const exact = items.filter(el => ((el.getAttribute('aria-label') || '').trim() === ${JSON.stringify(label)}
      || (el.textContent || '').replace(/\s+/g, ' ').trim() === ${JSON.stringify(label)}))
    const pool = (exact.length > 0 ? exact : items).slice().sort((x, y) => area(x) - area(y))
    const el = pool[${index}]
    if (!el) return null
    el.scrollIntoView({ block: 'center', inline: 'center' })
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  if (!rect) throw new Error(`no clickable element labelled "${label}"`)
  await session.clickAt(rect.x, rect.y)
  await sleep(settleMs)
  return rect
}

/** Click a CSS selector directly (for the segmented control and icon buttons). */
export async function clickSelector(session, selector, { settleMs = 450 } = {}) {
  const rect = await session.eval(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)})
    if (!el) return null
    el.scrollIntoView({ block: 'center', inline: 'center' })
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  if (!rect) throw new Error(`no element for selector ${selector}`)
  await session.clickAt(rect.x, rect.y)
  await sleep(settleMs)
  return rect
}

/** Type into the workflow search field the way a person does: focus, then keys. */
export async function typeSearch(session, text, { settleMs = 500 } = {}) {
  const rect = await session.eval(`(() => {
    const el = document.querySelector('.wf-gallery-search input')
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  })()`)
  if (!rect) throw new Error('workflow search field is missing')
  await session.clickAt(rect.x, rect.y)
  await session.eval(`(() => { const el = document.querySelector('.wf-gallery-search input'); if (el) { el.focus(); el.select?.() } })()`)
  if (text === '') {
    // Clearing is done with real keys first, because a person clears a field by
    // selecting the text and pressing delete. React's value tracker ignores a direct
    // assignment that repeats the value it last rendered, so the prototype setter and
    // an input event stand behind the keys for the case where they do not land.
    await session.press('Backspace')
    await sleep(200)
    const stillFilled = await session.eval(`(() => { const el = document.querySelector('.wf-gallery-search input'); return el ? el.value !== '' : false })()`)
    if (stillFilled) {
      await session.eval(`(() => {
        const el = document.querySelector('.wf-gallery-search input')
        if (!el) return
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(el, '')
        el.dispatchEvent(new Event('input', { bubbles: true }))
      })()`)
    }
    await sleep(settleMs)
    return
  }
  await session.type(text)
  await sleep(settleMs)
}

/**
 * Bring the panel to its overview whatever state the previous case left behind:
 * the entry opens and closes the panel, and creating or copying a workflow moves
 * the panel into that workflow's editor, so a later case has to walk back out.
 */
export async function openPanel(session, { settleMs = 2200 } = {}) {
  if (!(await session.eval('window.__wf.panelOpen()'))) {
    await click(session, '工作流', { settleMs })
    await session.waitFor('window.__wf.panelOpen()', { timeoutMs: 15000, message: 'workflow panel' })
  }
  if (await session.eval('!!document.querySelector(".wf-gallery")')) return
  const back = await session.eval(`window.__wf.byLabel('返回工作流列表') !== null`)
  if (back) {
    await click(session, '返回工作流列表', { settleMs })
  } else {
    await click(session, '工作流', { settleMs })
    await click(session, '工作流', { settleMs })
  }
  await session.waitFor('!!document.querySelector(".wf-gallery")', { timeoutMs: 15000, message: 'workflow gallery' })
  await settle(session, settleMs)
}

async function settle(session, ms) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Put the overview into the state a case describes: the archived filter off, the
 * card layout on. Both are control states rather than remembered preferences, so a
 * case that archived a workflow would otherwise hand the next case an empty list.
 */
export async function ensureCards(session) {
  const archivedOn = await session.eval(`(() => {
    const box = [...document.querySelectorAll('.wf-gallery .wf-check input')][0]
    return box ? box.checked : false
  })()`)
  if (archivedOn) {
    await click(session, '已归档', { scope: '.wf-gallery', settleMs: 900 })
    await session.waitFor(`(() => { const box = [...document.querySelectorAll('.wf-gallery .wf-check input')][0]; return box ? !box.checked : true })()`, { timeoutMs: 8000, message: 'archived filter off' })
  }
  if (!(await session.eval('!!document.querySelector(".wf-card-head")'))) {
    await click(session, '卡片', { scope: '.wf-gallery', settleMs: 900 })
    await session.waitFor('!!document.querySelector(".wf-card-head")', { timeoutMs: 10000, message: 'card layout' })
  }
}

export async function waitForText(session, text, { timeoutMs = 20000 } = {}) {
  await session.waitFor(`window.__wf.text().includes(${JSON.stringify(text)})`, { timeoutMs, message: `panel text ${text}` })
}

export async function waitForCard(session, name, { timeoutMs = 20000 } = {}) {
  await session.waitFor(`window.__wf.cardTitles().includes(${JSON.stringify(name)})`, { timeoutMs, message: `card ${name}` })
}

export async function waitForNoCard(session, name, { timeoutMs = 20000 } = {}) {
  await session.waitFor(`!window.__wf.cardTitles().includes(${JSON.stringify(name)})`, { timeoutMs, message: `card ${name} gone` })
}

/**
 * Resize the window the way the application itself allows: this Electron build
 * implements neither Browser.getWindowForTarget nor Browser.setWindowBounds, so
 * the renderer's own resizeTo is the working route. The result is read back from
 * outerWidth, so a refused resize fails the case instead of passing silently.
 */
export async function setWindowBounds(session, { width, height }) {
  await session.eval(`window.resizeTo(${Math.round(width)}, ${Math.round(height)})`)
  await sleep(1200)
  const measured = await session.eval('({ w: outerWidth, h: outerHeight, iw: innerWidth, ih: innerHeight, screenSize: [screen.availWidth, screen.availHeight] })')
  return measured
}

export async function frame(session) {
  return session.eval('({ w: outerWidth, h: outerHeight, iw: innerWidth, ih: innerHeight, screenSize: [screen.availWidth, screen.availHeight] })')
}

export const SYSTEM_APPEARANCE = () =>
  execFileSync('/usr/bin/osascript', ['-e', 'tell application "System Events" to tell appearance preferences to get dark mode'], { encoding: 'utf8' }).trim() === 'true'

export function setSystemAppearance(dark) {
  execFileSync('/usr/bin/osascript', ['-e', `tell application "System Events" to tell appearance preferences to set dark mode to ${dark}`], { stdio: 'ignore' })
}

/** Apply a theme through the app's own appearance setting, as a user would. */
export async function setAppTheme(session, mode) {
  return session.eval(`(() => {
    const apply = window.__dshSetAppearance ?? window.__dshSetTheme
    if (typeof apply === 'function') { apply(${JSON.stringify(mode)}); return 'api' }
    return null
  })()`)
}

// --------------------------------------------------------------------- evidence

export function ensureEvidence() {
  mkdirSync(EVIDENCE, { recursive: true })
}

export async function shot(session, name) {
  ensureEvidence()
  const path = join(EVIDENCE, `${name}.png`)
  const result = await session.client.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(path, Buffer.from(result.data, 'base64'))
  return path
}

export async function shotPanel(session, name) {
  ensureEvidence()
  const rect = await session.eval('window.__wf.panelRect()')
  const height = await session.eval('innerHeight')
  const result = await session.client.send('Page.captureScreenshot', {
    format: 'png',
    clip: { x: Math.round(rect?.x ?? 0), y: 0, width: Math.round(rect?.width ?? 900), height, scale: 1 },
  })
  const path = join(EVIDENCE, `${name}.png`)
  writeFileSync(path, Buffer.from(result.data, 'base64'))
  return path
}

/**
 * WCAG contrast audit of the real text inside a scope, using the shared contrast
 * probe so the ratio comes from resolved pixels rather than from class names. The
 * shared probe walks the whole document, so the samples are filtered to nodes the
 * scope actually contains.
 */
export async function contrastReport(session, scope = '.wf-main') {
  await session.eval(CONTRAST_HELPERS)
  const summary = await session.eval(`(() => {
    if (!document.querySelector(${JSON.stringify(scope)})) return { error: 'scope missing' }
    return window.__contrast.report(${JSON.stringify(scope)})
  })()`)
  if (summary.error) throw new Error(summary.error)
  const samples = summary.samples ?? []
  const failures = summary.belowThreshold ?? []
  return { ...summary, failures, worst: samples[0] ?? null, sampleCount: summary.count ?? samples.length }
}

export async function consoleErrors(session) {
  return session.consoleErrors()
}
