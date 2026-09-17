#!/usr/bin/env node
// Prove that a composed home actually boots inside the desktop shell.
//
// The launcher opens the home named by its own locator document, which lives in
// Electron's userData directory and cannot be redirected from the environment.
// This script therefore reads that locator, starts the installed application,
// and checks the renderer through the DevTools protocol: did it request the
// plugin bundle, does the bundle contain every client plugin this repository
// vendors, and did the console or network report a failure. The result describes
// the home the launcher actually opened, which is the home the user will see.
//
// Usage: node scripts/verify-runtime.mjs [--bundle <dir>] [--app <path>] [--home <dir>] [--keep]
import { spawn } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE = resolve(HERE, '..')
const CHROME_PORT = 9444
const DEFAULT_USER_DATA = join(process.env.HOME ?? '', 'Library', 'Application Support', 'DSH Desktop')

function parseArgs(argv) {
  const options = {
    bundle: BUNDLE,
    home: undefined,
    app: '/Applications/DSH Desktop.app',
    userData: DEFAULT_USER_DATA,
    keep: false,
    timeoutMs: 60000,
    settleMs: 30000,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--bundle') options.bundle = resolve(argv[++index])
    else if (argument === '--home') options.home = resolve(argv[++index])
    else if (argument === '--app') options.app = resolve(argv[++index])
    else if (argument === '--user-data') options.userData = resolve(argv[++index])
    else if (argument === '--keep') options.keep = true
    else throw new Error(`unknown argument: ${argument}`)
  }
  if (!existsSync(options.app)) throw new Error(`application bundle is missing: ${options.app}`)
  return options
}

const sleep = ms => new Promise(resolveSleep => setTimeout(resolveSleep, ms))

async function json(url, timeoutMs = 2000) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  if (!response.ok) throw new Error(`${url} responded ${response.status}`)
  return response.json()
}

/** Minimal DevTools protocol client over the browser-level WebSocket. */
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
    socket.addEventListener('open', resolveOpen, { once: true })
    socket.addEventListener('error', () => rejectOpen(new Error('devtools socket failed')), { once: true })
  })
  const send = (method, params, sessionId) => new Promise((resolveSend, rejectSend) => {
    const id = ++nextId
    const timer = setTimeout(() => {
      pending.delete(id)
      rejectSend(new Error(`${method} timed out`))
    }, 15000)
    pending.set(id, message => {
      clearTimeout(timer)
      if (message.error) rejectSend(new Error(`${method}: ${message.error.message}`))
      else resolveSend(message.result)
    })
    socket.send(JSON.stringify({ id, method, params, ...(sessionId === undefined ? {} : { sessionId }) }))
  })
  return { socket, events, send }
}

/** Read the home the launcher's own locator names. */
function launcherHome(userData) {
  const locator = join(userData, 'data-directory', 'state.json')
  if (!existsSync(locator)) return undefined
  try {
    return JSON.parse(readFileSync(locator, 'utf8')).activeHome
  } catch {
    return undefined
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  const manifest = JSON.parse(readFileSync(join(options.bundle, 'manifest.json'), 'utf8'))
  const clientPlugins = manifest.plugins.filter(plugin => {
    const pkg = JSON.parse(readFileSync(join(options.bundle, 'vendor', plugin.name, 'package.json'), 'utf8'))
    return pkg.dsh?.client !== undefined
  })

  const activeHome = launcherHome(options.userData)
  console.log(`application ${options.app}`)
  console.log(`userData    ${options.userData}`)
  console.log(`launcher    ${activeHome ?? '(no locator; the app will ask for a home)'}`)
  if (options.home !== undefined) {
    console.log(`requested   ${options.home}${activeHome === options.home ? '' : ' (the launcher will open the locator home instead)'}`)
  }

  const scratch = join(options.bundle, '.scratch')
  const logPath = join(scratch, 'runtime-app.log')
  mkdirSync(scratch, { recursive: true })
  rmSync(logPath, { force: true })

  let stop = () => {}
  const finish = code => {
    stop()
    process.exit(code)
  }

  const logFd = openSync(logPath, 'w')
  const child = spawn(
    join(options.app, 'Contents', 'MacOS', 'DSH Desktop'),
    [`--remote-debugging-port=${CHROME_PORT}`],
    { env: { ...process.env }, stdio: ['ignore', logFd, logFd] },
  )
  console.log(`launched    pid ${child.pid} (log ${logPath})\n`)

  let stopped = false
  stop = () => {
    if (stopped) return
    stopped = true
    try { child.kill('SIGTERM') } catch { /* already gone */ }
    try { closeSync(logFd) } catch { /* already closed */ }
  }
  process.on('exit', stop)

  // Electron grants the single-instance lock per application, so a running DSH
  // Desktop makes this launch quit immediately. Say so instead of timing out.
  child.on('exit', code => {
    if (stopped) return
    console.log(`FAIL  the application exited immediately (code ${code})`)
    console.log('      another DSH Desktop instance is running; quit it and retry')
    finish(1)
  })

  const deadline = Date.now() + options.timeoutMs
  const tick = setInterval(async () => {
    if (stopped) {
      clearInterval(tick)
      return
    }
    if (Date.now() > deadline) {
      clearInterval(tick)
      console.log('FAIL  the application did not expose a debugging endpoint in time')
      console.log(readFileSync(logPath, 'utf8').split('\n').slice(-10).join('\n'))
      finish(1)
      return
    }
    try {
      await json(`http://127.0.0.1:${CHROME_PORT}/json/version`)
    } catch {
      return
    }
    clearInterval(tick)
    try {
      await inspect()
    } catch (error) {
      console.log(`FAIL  ${error.message}`)
      process.exitCode = 1
    } finally {
      if (options.keep) console.log('kept        the application is still running (--keep)')
      setTimeout(() => finish(process.exitCode ?? 0), options.keep ? 0 : 300)
    }
  }, 1000)

  async function inspect() {
    let page
    const targetDeadline = Date.now() + 60000
    while (page === undefined && Date.now() < targetDeadline) {
      const targets = await json(`http://127.0.0.1:${CHROME_PORT}/json/list`).catch(() => [])
      page = targets.find(target => target.type === 'page' && typeof target.webSocketDebuggerUrl === 'string')
      if (page === undefined) await sleep(1000)
    }
    if (page === undefined) throw new Error('no renderer target appeared within 60s')

    const client = await connect(page.webSocketDebuggerUrl)
    await client.send('Network.enable')
    await client.send('Log.enable')
    await client.send('Runtime.enable')
    await sleep(options.settleMs)

    const requests = client.events
      .filter(event => event.method === 'Network.responseReceived')
      .map(event => ({ url: event.params.response.url, status: event.params.response.status }))
    const failures = requests.filter(entry => entry.status >= 400)
    const consoleErrors = client.events
      .filter(event => event.method === 'Log.entryAdded' && event.params.entry.level === 'error')
      .map(event => event.params.entry.text)

    // The client module bundle is one request whose query lists every registered
    // client entry. The DevTools session attaches after the page has already
    // loaded, so read the request out of the renderer's own performance timeline
    // instead of waiting for a network event that will never arrive again.
    const bundleQuery = await readBundleQuery(client)
    const missing = clientPlugins.filter(plugin => !bundleQuery.includes(`${plugin.name}/client`))
    const present = clientPlugins.filter(plugin => bundleQuery.includes(`${plugin.name}/client`))

    const check = (condition, message) => {
      console.log(`${condition ? 'ok   ' : 'FAIL '} ${message}`)
      if (!condition) process.exitCode = 1
    }
    console.log(`renderer  ${page.url || '(no url reported)'}`)
    console.log(`requests  ${requests.length}\n`)
    check(page.url.startsWith('http://127.0.0.1'), 'the renderer loaded a local session page')
    check(bundleQuery !== '', 'the renderer requested the client plugin bundle')
    check(missing.length === 0,
      `all ${clientPlugins.length} vendored client plugins are registered (${present.length} present${missing.length ? `, missing ${missing.map(plugin => plugin.name).join(', ')}` : ''})`)
    check(failures.length === 0, `no failed responses${failures.length ? `: ${failures.slice(0, 5).map(entry => `${entry.status} ${entry.url}`).join('; ')}` : ''}`)
    check(consoleErrors.length === 0, `no console errors${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(' | ')}` : ''}`)
    client.socket.close()
  }

  /** Ask the renderer which client module bundle it requested. */
  async function readBundleQuery(client) {
    const deadline = Date.now() + 30000
    while (Date.now() < deadline) {
      const result = await client.send('Runtime.evaluate', {
        expression: `JSON.stringify(performance.getEntriesByType('resource').map(entry => entry.name).filter(name => name.includes('/plugins/')))`,
        returnByValue: true,
      }).catch(() => undefined)
      const value = result?.result?.value
      if (typeof value === 'string' && value !== '[]') {
        const [first] = JSON.parse(value)
        return decodeURIComponent(new URL(first).search)
      }
      await sleep(2000)
    }
    return ''
  }
}

main()
