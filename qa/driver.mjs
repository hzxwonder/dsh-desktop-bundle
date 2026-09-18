#!/usr/bin/env node
// Compose, launch and drive an isolated DSH Desktop session over the DevTools
// protocol. The launcher opens the home named by its own locator document, so a
// QA run controls the environment by controlling that home, not the arguments.
//
// Exports:
//   startSession({ home, app, port, keep })  -> session, already connected
//   session.eval(expression)                 -> value
//   session.click(selector, options)         -> dispatch a real mouse click
//   session.type(text)                       -> real key events into the focus
//   session.waitFor(predicate, options)      -> poll a condition
//   session.screenshot(name)                 -> PNG path under the evidence dir
//   session.stop()                           -> quit the application
import { spawn } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
export const BUNDLE = resolve(HERE, '..')
const DEFAULT_APP = '/Applications/DSH Desktop.app'
const DEFAULT_USER_DATA = join(process.env.HOME ?? '', 'Library', 'Application Support', 'DSH Desktop')

export const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms))
export const exists = path => existsSync(path)

export function readJson(path, fallback = undefined) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

/** Point the launcher at another home. The app reads this file, never an env var. */
export function setLauncherHome(home, userData = DEFAULT_USER_DATA) {
  const statePath = join(userData, 'data-directory', 'state.json')
  const state = readJson(statePath, {})
  writeJson(statePath, { ...state, activeHome: home })
  return state.activeHome
}

export function launcherHome(userData = DEFAULT_USER_DATA) {
  return readJson(join(userData, 'data-directory', 'state.json'), {})?.activeHome
}

async function json(url, timeoutMs = 2500) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new Error(`${url} responded ${response.status}`)
  return response.json()
}

/** The browser-level endpoint, used to close the application the way its window would. */
async function waitForBrowserTarget(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const version = await json(`http://127.0.0.1:${port}/json/version`).catch(() => undefined)
    if (version?.webSocketDebuggerUrl !== undefined) return version.webSocketDebuggerUrl
    await sleep(500)
  }
  return undefined
}

/** Close the running application through its own window, as the user would. */
export async function closeRunningApp({ port, timeoutMs = 15000 } = {}) {
  const endpoint = await waitForBrowserTarget(port, timeoutMs)
  if (endpoint === undefined) return false
  const client = await connect(endpoint)
  try {
    await client.send('Browser.close')
  } catch {
    // The socket dies with the application; that is the expected outcome.
  }
  return true
}

async function listTargets(port) {
  return json(`http://127.0.0.1:${port}/json/list`).catch(() => [])
}

const isSessionPage = entry => entry.type === 'page' && typeof entry.webSocketDebuggerUrl === 'string'
  && !entry.url.includes('native-ui/')

async function waitForTarget(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let fallback
  while (Date.now() < deadline) {
    const pages = (await listTargets(port)).filter(entry => entry.type === 'page' && typeof entry.webSocketDebuggerUrl === 'string')
    const session = pages.find(isSessionPage)
    if (session !== undefined) return session
    // A window the app opened on purpose (wizard, recovery) is still attachable: the
    // cases assert on what it shows instead of the harness hiding it.
    fallback = fallback ?? pages.find(entry => !entry.url.includes('setup-wizard'))
    await sleep(500)
  }
  return fallback
}

/**
 * The first run of a profile opens the desktop setup wizard in its own window.
 * Skipping it mirrors what a person does: the skip control asks for confirmation,
 * and the confirmation carries the same label.
 */
export async function dismissSetupWizard({ port, settleMs = 2500 }) {
  const wizard = (await listTargets(port)).find(entry => entry.type === 'page' && entry.url.includes('setup-wizard'))
  if (wizard === undefined) return { shown: false }
  const client = await connect(wizard.webSocketDebuggerUrl)
  const evaluate = async expression => {
    const result = await client.send('Runtime.evaluate', { expression, returnByValue: true })
    return result.result.value
  }
  await client.send('Runtime.enable')
  const skip = async () => evaluate(`(() => {
    const buttons = [...document.querySelectorAll('button, [role=button]')]
      .filter(el => (el.textContent || '').trim() === '跳过设置')
    const target = buttons[buttons.length - 1]
    if (target === undefined) return false
    const rect = target.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  })()`)
  const first = await skip()
  if (first === false) return { shown: true, skipped: false }
  const click = async point => {
    await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', buttons: 1, clickCount: 1 })
    await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', buttons: 0, clickCount: 1 })
  }
  await click(first)
  await sleep(1200)
  const confirmation = await skip()
  if (confirmation !== false) await click(confirmation)
  await sleep(settleMs)
  const stillOpen = (await listTargets(port)).some(entry => entry.url.includes('setup-wizard'))
  return { shown: true, skipped: !stillOpen }
}

// Every launch registers a shutdown hook; one process-level listener keeps the
// count stable no matter how many times a suite restarts the application.
const liveSessions = new Set()
let exitHandlerRegistered = false
function registerExitHandler() {
  if (exitHandlerRegistered) return
  exitHandlerRegistered = true
  process.on('exit', () => {
    for (const stop of liveSessions) stop()
  })
}

/** Minimal DevTools protocol client with event retention for evidence. */
async function connect(webSocketDebuggerUrl) {
  const socket = new WebSocket(webSocketDebuggerUrl)
  const pending = new Map()
  const events = []
  let nextId = 0
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    if (message.id !== undefined) {
      const handler = pending.get(message.id)
      pending.delete(message.id)
      handler?.(message)
      return
    }
    events.push(message)
  })
  await new Promise((resolveOpen, rejectOpen) => {
    // A window that disappeared between listing and connecting must not hang the run.
    const timer = setTimeout(() => rejectOpen(new Error('devtools socket did not open within 10s')), 10000)
    socket.addEventListener('open', () => { clearTimeout(timer); resolveOpen() }, { once: true })
    socket.addEventListener('error', () => { clearTimeout(timer); rejectOpen(new Error('devtools socket failed')) }, { once: true })
  })
  const send = (method, params) => new Promise((resolveSend, rejectSend) => {
    const id = ++nextId
    const timer = setTimeout(() => {
      pending.delete(id)
      rejectSend(new Error(`${method} timed out`))
    }, 30000)
    pending.set(id, message => {
      clearTimeout(timer)
      if (message.error) rejectSend(new Error(`${method}: ${message.error.message}`))
      else resolveSend(message.result)
    })
    socket.send(JSON.stringify({ id, method, params }))
  })
  return { socket, events, send, clearEvents: () => { events.length = 0 } }
}

/**
 * Start the application against the home the launcher currently names and return
 * a driving session. A running instance owns the single-instance lock, so the
 * caller must quit any live app first; this function reports that case instead
 * of hanging.
 */
/**
 * Attach to an application that is already running with its debug port open.
 * Closing the window leaves the process resident, so a case that reopens the
 * window only needs a fresh page connection, not another launch.
 */
export async function attachSession(options = {}) {
  const app = options.app ?? DEFAULT_APP
  const port = options.port ?? 9444
  const evidenceDir = options.evidenceDir ?? join(BUNDLE, 'qa', 'evidence')
  const page = await waitForTarget(port, options.launchTimeoutMs ?? 30000)
  if (page === undefined) throw new Error(`no renderer target on port ${port} to attach to`)
  const client = await connect(page.webSocketDebuggerUrl)
  await client.send('Runtime.enable')
  await client.send('Log.enable')
  await client.send('Page.enable')
  // Without this the response bookkeeping stays empty and every network assertion
  // passes for the wrong reason.
  await client.send('Network.enable')
  return buildSession({ app, home: options.home ?? launcherHome(options.userData ?? DEFAULT_USER_DATA), port, userData: options.userData ?? DEFAULT_USER_DATA, evidenceDir, client, page, logPath: options.logPath })
}

/** Assemble the driving surface shared by a launched and an attached application. */
function buildSession({ app, home, port, userData, logPath, evidenceDir, child, client, page, stop = () => {} }) {
  const session = {
    app, home, port, userData, logPath, evidenceDir, child, client, page,
    async eval(expression, timeoutMs = 30000) {
      const result = await Promise.race([
        client.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }),
        sleep(timeoutMs).then(() => { throw new Error(`evaluate timed out: ${expression.slice(0, 80)}`) }),
      ])
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
      }
      return result.result.value
    },
    async waitFor(expression, { timeoutMs = 30000, intervalMs = 250, message } = {}) {
      const deadline = Date.now() + timeoutMs
      let last
      while (Date.now() < deadline) {
        try {
          last = await session.eval(expression)
          if (last) return last
        } catch (error) { last = error.message }
        await sleep(intervalMs)
      }
      throw new Error(`waitFor timed out: ${message ?? expression.slice(0, 120)} (last=${JSON.stringify(last)})`)
    },
    async rect(selector, { index = 0 } = {}) {
      return session.eval(`(() => {
        const nodes = [...document.querySelectorAll(${JSON.stringify(selector)})]
        const node = nodes[${index}]
        if (!node) return null
        const rect = node.getBoundingClientRect()
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      })()`)
    },
    async click(selector, { index = 0, button = 'left', clickCount = 1 } = {}) {
      const rect = await session.rect(selector, { index })
      if (rect === null) throw new Error(`click target not found: ${selector}[${index}]`)
      const x = rect.x + rect.width / 2
      const y = rect.y + rect.height / 2
      await session.clickAt(x, y, { button, clickCount })
      return { x, y, rect }
    },
    async clickAt(x, y, { button = 'left', clickCount = 1 } = {}) {
      const buttons = button === 'right' ? 2 : 1
      await client.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'none', buttons: 0 })
      await client.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, buttons, clickCount })
      await client.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, buttons: 0, clickCount })
    },
    async type(text, { delayMs = 25 } = {}) {
      for (const character of text) {
        await client.send('Input.dispatchKeyEvent', { type: 'keyDown', text: character, unmodifiedText: character })
        await client.send('Input.dispatchKeyEvent', { type: 'keyUp', text: character, unmodifiedText: character })
        if (delayMs > 0) await sleep(delayMs)
      }
    },
    async press(key, { modifiers = 0 } = {}) {
      const codes = {
        Enter: { windowsVirtualKeyCode: 13, code: 'Enter', key: 'Enter', text: '\r' },
        Tab: { windowsVirtualKeyCode: 9, code: 'Tab', key: 'Tab' },
        Escape: { windowsVirtualKeyCode: 27, code: 'Escape', key: 'Escape' },
        Backspace: { windowsVirtualKeyCode: 8, code: 'Backspace', key: 'Backspace' },
        ArrowDown: { windowsVirtualKeyCode: 40, code: 'ArrowDown', key: 'ArrowDown' },
      }
      const spec = codes[key] ?? { key }
      await client.send('Input.dispatchKeyEvent', { type: 'rawKeyDown', modifiers, ...spec })
      await client.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers, ...spec })
    },
    /** Window frame as the renderer sees it: no window server access required. */
    frame() {
      return {
        x: window.screenX, y: window.screenY,
        width: window.outerWidth, height: window.outerHeight,
        innerWidth: window.innerWidth, innerHeight: window.innerHeight,
        maximized: window.outerWidth >= screen.availWidth && window.outerHeight >= screen.availHeight,
      }
    },

    /** Ask the window to resize itself. Electron maps this onto the real window. */
    async resize(width, height, { settleMs = 1500 } = {}) {
      const directive = `window.resizeTo(${width}, ${height})`
      try {
        await this.eval(directive)
      } catch {
        return { supported: false }
      }
      await new Promise(resolveWait => setTimeout(resolveWait, settleMs))
      const frame = await this.eval('({ width: window.outerWidth, height: window.outerHeight, innerWidth: innerWidth, innerHeight: innerHeight })')
      return { supported: Math.abs(frame.width - width) <= 24 && Math.abs(frame.height - height) <= 24, ...frame }
    },

    /** Put the page in the background the way the OS does when a window is hidden. */
    async setLifecycleState(state) {
      try {
        await client.send('Page.setWebLifecycleState', { state })
        return true
      } catch {
        return false
      }
    },

    /** Close the window from inside, which is what the close control does. */
    async closeWindow() {
      try {
        await this.eval('window.close()')
      } catch {
        // The renderer goes away with the window.
      }
    },

    async screenshot(name, { fullPage = false } = {}) {
      const result = await client.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: fullPage })
      const path = join(evidenceDir, `${name}.png`)
      writeFileSync(path, Buffer.from(result.data, 'base64'))
      return path
    },
    consoleErrors() {
      return client.events
        .filter(event => event.method === 'Log.entryAdded' && event.params.entry.level === 'error')
        .map(event => event.params.entry.text)
    },
    failedResponses() {
      return client.events
        .filter(event => event.method === 'Network.responseReceived' && event.params.response.status >= 400)
        .map(event => `${event.params.response.status} ${event.params.response.url}`)
    },
    /** Every response the renderer saw, so a check can show it observed real traffic. */
    responseCount() {
      return client.events.filter(event => event.method === 'Network.responseReceived').length
    },
    stop,
  }
  return session
}

export async function startSession(options = {}) {
  const app = options.app ?? DEFAULT_APP
  const userData = options.userData ?? DEFAULT_USER_DATA
  const port = options.port ?? 9444
  const evidenceDir = options.evidenceDir ?? join(BUNDLE, 'qa', 'evidence')
  mkdirSync(evidenceDir, { recursive: true })

  if (!existsSync(app)) throw new Error(`application bundle is missing: ${app}`)
  const home = options.home ?? launcherHome(userData)
  if (home === undefined) throw new Error('no launcher locator; cannot decide which home to open')

  const logPath = options.logPath ?? join(evidenceDir, 'app.log')
  const logFd = openSync(logPath, 'w')
  const child = spawn(join(app, 'Contents', 'MacOS', 'DSH Desktop'), [`--remote-debugging-port=${port}`], {
    stdio: ['ignore', logFd, logFd],
  })

  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    try { child.kill('SIGTERM') } catch { /* already gone */ }
    try { closeSync(logFd) } catch { /* already closed */ }
  }
  liveSessions.add(stop)
  registerExitHandler()

  let exited = false
  child.on('exit', () => { exited = true })

  // The first run of a profile shows the setup wizard before the session window, and
  // that window may appear seconds after the process starts, so keep looking for it
  // while waiting for the session window itself.
  const deadline = Date.now() + (options.launchTimeoutMs ?? 90000)
  let page
  let wizardReported = false
  while (page === undefined && Date.now() < deadline) {
    const wizard = await dismissSetupWizard({ port }).catch(() => ({ shown: false }))
    if (wizard.shown && !wizardReported) {
      console.log(`setup wizard: skipped=${wizard.skipped}`)
      wizardReported = true
    }
    page = await waitForTarget(port, Math.min(8000, Math.max(1000, deadline - Date.now())))
  }
  if (page === undefined) {
    const log = readFileSync(logPath, 'utf8').split('\n').slice(-12).join('\n')
    stop()
    throw new Error(exited
      ? `the application exited during startup (another instance may hold the single-instance lock)\n${log}`
      : `no renderer target appeared within the launch timeout\n${log}`)
  }

  const client = await connect(page.webSocketDebuggerUrl)
  await client.send('Runtime.enable')
  await client.send('Log.enable')
  await client.send('Page.enable')
  // Without this the response bookkeeping stays empty and every network assertion
  // passes for the wrong reason.
  await client.send('Network.enable')

  const session = buildSession({ app, home, port, userData, logPath, evidenceDir, child, client, page, stop })
  const originalStop = session.stop
  session.stop = () => { liveSessions.delete(stop); originalStop() }
  return session
}

/** Electron grants one instance per application; make sure the field is clear. */
export async function quitRunningApp({ timeoutMs = 30000 } = {}) {
  const { execFileSync } = await import('node:child_process')
  const pids = () => {
    try {
      return execFileSync('/usr/bin/pgrep', ['-f', 'MacOS/DSH Desktop'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
    } catch {
      return []
    }
  }
  if (pids().length === 0) return false
  try { execFileSync('/bin/kill', ['-TERM', ...pids()]) } catch { /* raced */ }
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline && pids().length > 0) await sleep(400)
  return pids().length === 0
}
