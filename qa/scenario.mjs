// Scenario helpers shared by the acceptance groups: they express what a person
// does in the interface (open a conversation, type, switch theme, resize the
// window) in terms the runner can assert on.
import { execFileSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

export const APP = '/Applications/DSH Desktop.app'

/** Selector for anything clickable that carries a label. */
export const CLICKABLE = 'button, [role=button], [role=menuitem], [role=tab], a[href]'

const HELPERS = String.raw`
window.__qa = {
  visible(el) {
    if (!el) return false
    const rect = el.getBoundingClientRect()
    const style = getComputedStyle(el)
    return rect.width > 1 && rect.height > 1 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0'
  },
  all(selector) { return [...document.querySelectorAll(selector)].filter(el => window.__qa.visible(el)) },
  byText(text, selector = 'button, [role=button], [role=menuitem], [role=tab], a[href]') {
    return [...document.querySelectorAll(selector)].filter(el => window.__qa.visible(el)
      && ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).includes(text))
  },
  indexOfText(text, selector = 'button, [role=button], [role=menuitem], [role=tab], a[href]') {
    return [...document.querySelectorAll(selector)]
      .filter(el => window.__qa.visible(el))
      .findIndex(el => ((el.getAttribute('aria-label') || '') + ' ' + (el.textContent || '')).includes(text))
  },
  rect(el) {
    const rect = el.getBoundingClientRect()
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, bottom: rect.bottom, right: rect.right }
  },
  rectOfText(text, selector) {
    const el = window.__qa.byText(text, selector)[0]
    return el ? window.__qa.rect(el) : null
  },
  composer() {
    return document.querySelector('[data-composer-input][contenteditable=true]')
      || document.querySelector('[data-composer-input] textarea')
      || document.querySelector('[data-composer-input] [contenteditable=true]')
  },
  composerText() {
    const node = window.__qa.composer()
    return node ? (node.innerText || node.value || '') : ''
  },
  bodyText() { return (document.body.innerText || '').replace(/\s+/g, ' ').trim() },
  theme() {
    const root = document.documentElement
    return {
      dark: root.hasAttribute('data-ds-dark-theme') || root.style.colorScheme === 'dark',
      colorScheme: root.style.colorScheme || null,
      background: getComputedStyle(document.body).backgroundColor,
    }
  },
  // Conversation rows are the sidebar tree items; the workspace row is the one
  // that also carries aria-expanded.
  conversationRows() {
    return [...document.querySelectorAll('[role=treeitem][aria-selected]')]
      .filter(el => window.__qa.visible(el))
  },
  workspaceRows() {
    return [...document.querySelectorAll('[role=treeitem][aria-expanded]')]
      .filter(el => window.__qa.visible(el))
  },
  conversationTitles() {
    return window.__qa.conversationRows().map(el => (el.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  },
  /** The window frame as the renderer sees it; the window server is not consulted. */
  frame() {
    return {
      x: window.screenX, y: window.screenY,
      width: window.outerWidth, height: window.outerHeight,
      innerWidth: window.innerWidth, innerHeight: window.innerHeight,
    }
  },
  metrics() {
    return {
      viewport: [innerWidth, innerHeight],
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      bodyScrollHeight: document.body.scrollHeight,
      elementCount: document.querySelectorAll('*').length,
    }
  },
  intersects(a, b) {
    return a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom
  },
}
true`

export async function prepare(session) {
  await session.eval(HELPERS)
}

export async function welcomeVisible(session) {
  return session.eval('window.__qa.byText("继续").length > 0')
}

export async function dismissWelcome(session) {
  const index = await session.eval('window.__qa.indexOfText("继续")')
  if (index < 0) return false
  await session.click(CLICKABLE, { index })
  await session.eval(HELPERS)
  return true
}

/** Click the first visible control whose label or text contains `label`. */
export async function clickLabel(session, label, selector = CLICKABLE) {
  const index = await session.eval(`window.__qa.indexOfText(${JSON.stringify(label)}, ${JSON.stringify(selector)})`)
  if (index < 0) return false
  await session.click(selector, { index })
  await session.eval(HELPERS)
  return true
}

export async function focusComposer(session) {
  const rect = await session.eval(`(() => {
    const node = window.__qa.composer()
    return node ? window.__qa.rect(node) : null
  })()`)
  if (rect === null) throw new Error('composer not found')
  session.composerRect = rect
  await session.clickAt(rect.x + Math.min(rect.width / 2, 160), rect.y + Math.min(rect.height / 2, 20))
  await sleep(150)
  const focused = await session.eval(`(() => {
    const node = window.__qa.composer()
    if (node === null) return false
    if (!node.contains(document.activeElement) && node !== document.activeElement) node.focus()
    return node.contains(document.activeElement) || node === document.activeElement
  })()`)
  if (!focused) throw new Error('the composer refused focus')
  return rect
}

/** Select all and delete, so a case never inherits the previous case's draft. */
export async function clearComposer(session) {
  await focusComposer(session)
  await session.press('a', { modifiers: 4 }) // 4 = Meta in the CDP modifier bitmask
  await session.press('Backspace')
  await sleep(200)
}

export async function sendMessage(session, text, { waitMs = 18000 } = {}) {
  await clearComposer(session)
  await session.type(text)
  await session.press('Enter')
  await session.waitFor(`window.__qa.bodyText().includes(${JSON.stringify(text)})`, { timeoutMs: 8000, message: 'message visible in transcript' })
  await sleep(waitMs)
  await prepare(session)
}

export const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms))

export async function startConversation(session, text) {
  await clickLabel(session, '新建会话')
  await sleep(1200)
  await clearComposer(session)
  if (text !== undefined) await sendMessage(session, text)
}

// ------------------------------------------------------------ process controls

export function activateApp() {
  execFileSync('/usr/bin/open', ['-a', APP], { stdio: 'ignore' })
}

export function appProcessCount() {
  try {
    const output = execFileSync('/usr/bin/pgrep', ['-f', 'MacOS/DSH Desktop'], { encoding: 'utf8' })
    return output.trim().split('\n').filter(Boolean).length
  } catch {
    return 0
  }
}

/**
 * The main process, as opposed to its renderer and GPU helpers. The main process
 * carries the launch arguments, so it is the one whose command line is the app
 * executable followed by options rather than a Helper role.
 */
export function mainProcessId() {
  try {
    const output = execFileSync('/usr/bin/pgrep', ['-fl', 'MacOS/DSH Desktop'], { encoding: 'utf8' })
    for (const line of output.trim().split('\n')) {
      const [id, command = ''] = line.split(/\s+/, 2)
      const rest = line.slice(id.length)
      if (rest.includes('Helper')) continue
      return Number(id)
    }
    return 0
  } catch {
    return 0
  }
}

/** Ask the application to shut down the way a logout or ⌘Q does. */
export function requestQuitBySignal(signal = 'SIGTERM') {
  const pid = mainProcessId()
  if (pid === 0) return false
  process.kill(pid, signal)
  return true
}

export function killApp() {
  try {
    execFileSync('/usr/bin/pkill', ['-KILL', '-f', 'MacOS/DSH Desktop'], { stdio: 'ignore' })
  } catch { /* nothing running */ }
}

/**
 * Wait until the client has mounted far enough to accept input.
 *
 * The session page is served before the client plugin bundle finishes mounting, so
 * a case that starts immediately would see an empty document. A first-run modal may
 * also stand in front of the composer; this reports that state rather than clicking
 * through it, because dismissing it is itself a behaviour under test.
 */
export async function awaitReady(session, { timeoutMs = 90000, requireComposer = true } = {}) {
  const deadline = Date.now() + timeoutMs
  let last = ''
  while (Date.now() < deadline) {
    const state = await session.eval(`(() => {
      const composer = document.querySelector('[data-composer-input][contenteditable=true]')
        || document.querySelector('[data-composer-input] textarea')
        || document.querySelector('[data-composer-input] [contenteditable=true]')
      const text = (document.body.innerText || '').replace(/\\s+/g, ' ').trim()
      return {
        composer: composer !== null,
        elements: document.querySelectorAll('*').length,
        apiKeyModal: text.includes('添加一个 API Key'),
        ready: document.readyState,
        text: text.slice(0, 120),
      }
    })()`).catch(() => null)
    if (state !== null) {
      last = JSON.stringify(state)
      // A window that is not the main session window (setup wizard, recovery) is ready
      // once it has rendered its own content.
      if (state.composer && state.elements > 200) return state
      if (!requireComposer && (state.elements > 50 || state.ready === 'complete')) return state
    }
    await sleep(700)
  }
  throw new Error(`client did not become ready within ${timeoutMs}ms (last=${last})`)
}

/**
 * Collapse or expand the sidebar by whatever control is currently on screen: the
 * label flips between the two states and the toggle moves with the rail, so the
 * position has to be looked up again each time.
 */
export async function toggleSidebar(session, { settleMs = 1600 } = {}) {
  for (const label of ['收起侧边栏', '打开侧边栏', '展开侧边栏', '显示侧边栏']) {
    const rect = await session.eval(`window.__qa.rectOfText(${JSON.stringify(label)})`)
    if (rect === null) continue
    await session.clickAt(rect.x + rect.width / 2, rect.y + rect.height / 2)
    await sleep(settleMs)
    return label
  }
  return null
}

/**
 * The last uncaught error the desktop process wrote, which is where an activation
 * against a destroyed window shows up. Returns undefined when the log is quiet.
 */
export function activationCrash() {
  const directory = join(process.env.HOME ?? '', 'Library', 'Application Support', 'DSH Desktop', 'logs')
  try {
    const names = readdirSync(directory).filter(name => name.endsWith('.error.log')).sort()
    const text = readFileSync(join(directory, names[names.length - 1]), 'utf8')
    const index = text.lastIndexOf('TypeError: Object has been destroyed')
    if (index < 0) return undefined
    return text.slice(index, index + 220).split('\n').slice(0, 4).join(' | ')
  } catch {
    return undefined
  }
}
