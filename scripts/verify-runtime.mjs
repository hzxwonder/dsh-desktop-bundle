#!/usr/bin/env node
// Prove that a composed home actually boots inside the desktop shell.
//
// The script starts the installed application against a private HOME and a
// private port, so the launcher reads the composed home without touching the
// home a user is already running, then asks the renderer through the DevTools
// protocol whether every vendored client plugin registered and whether the
// console or network reported a failure. Re-running setup and restarting the
// app is the normal way to recover; this check only reports.
//
// Usage: node scripts/verify-runtime.mjs --home <dsh-home> [--app <path>] [--port <n>] [--keep]
import { spawn, execFileSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE = resolve(HERE, '..')
const CHROME_PORT = 9444

function parseArgs(argv) {
  const options = {
    bundle: BUNDLE,
    home: undefined,
    app: '/Applications/DSH Desktop.app',
    port: 43000 + Math.floor(Math.random() * 900),
    userData: undefined,
    keep: false,
    timeoutMs: 120000,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--bundle') options.bundle = resolve(argv[++index])
    else if (argument === '--home') options.home = resolve(argv[++index])
    else if (argument === '--app') options.app = resolve(argv[++index])
    else if (argument === '--port') options.port = Number(argv[++index])
    else if (argument === '--user-data') options.userData = resolve(argv[++index])
    else if (argument === '--keep') options.keep = true
    else throw new Error(`unknown argument: ${argument}`)
  }
  if (!options.home) throw new Error('--home is required')
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

function main() {
  const options = parseArgs(process.argv.slice(2))
  const scratch = join(options.bundle, '.scratch')
  const privateHome = join(scratch, 'runtime-home')
  const userData = options.userData ?? join(privateHome, 'Library', 'Application Support', 'DSH Desktop')
  const logPath = join(scratch, 'runtime-app.log')
  rmSync(privateHome, { recursive: true, force: true })
  mkdirSync(userData, { recursive: true })
  mkdirSync(options.home, { recursive: true })

  // The launcher only opens the home its own data-directory locator names, so
  // register the composed home in the private userData directory first. Set the
  // Setup marker too: a fresh profile would otherwise wait in the native wizard
  // and never start the Host.
  execFileSync(process.execPath, [
    join(HERE, 'register-home.mjs'),
    '--home', options.home,
    '--app', options.app,
    '--user-data', userData,
  ], { stdio: 'inherit' })

  const logFd = openSync(logPath, 'w')
  const child = spawn(
    join(options.app, 'Contents', 'MacOS', 'DSH Desktop'),
    [`--remote-debugging-port=${CHROME_PORT}`, `--dsh-home=${options.home}`, `--port=${options.port}`],
    {
      env: { ...process.env, HOME: privateHome, DSH_HOME: options.home, DSH_DESKTOP_HOME: options.home },
      stdio: ['ignore', logFd, logFd],
      detached: false,
    },
  )
  console.log(`launched  pid ${child.pid} (log ${logPath})`)
  console.log(`home      ${options.home}`)
  console.log(`port      ${options.port}`)

  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    try { process.kill(-child.pid, 'SIGTERM') } catch { /* already gone */ }
    try { child.kill('SIGTERM') } catch { /* already gone */ }
    try { closeSync(logFd) } catch { /* already closed */ }
  }
  process.on('exit', stop)

  // Electron grants the single-instance lock to the first process that owns the
  // application's userData directory, so a running DSH Desktop makes this launch
  // quit immediately. Report that instead of waiting out the timeout.
  let exitedEarly = false
  child.on('exit', code => {
    exitedEarly = true
    if (!stopped) {
      console.log(`FAIL  the application exited immediately (code ${code})`)
      console.log('      another DSH Desktop instance owns the single-instance lock; quit it and retry')
      console.log(readFileSync(logPath, 'utf8').split('\n').filter(Boolean).slice(-5).join('\n'))
      stop()
      process.exit(1)
    }
  })

  const deadline = Date.now() + options.timeoutMs
  const tick = setInterval(async () => {
    if (exitedEarly) {
      clearInterval(tick)
      return
    }
    if (Date.now() > deadline) {
      console.log('FAIL  the application did not expose a debugging endpoint in time')
      console.log(readFileSync(logPath, 'utf8').split('\n').slice(-20).join('\n'))
      stop()
      process.exit(1)
    }
    let version
    try {
      version = await json(`http://127.0.0.1:${CHROME_PORT}/json/version`)
    } catch {
      return
    }
    clearInterval(tick)
    try {
      await inspect(version)
    } catch (error) {
      console.log(`FAIL  ${error.message}`)
      process.exitCode = 1
    } finally {
      if (!options.keep) stop()
      else console.log('kept      the application is still running (--keep)')
      setTimeout(() => process.exit(process.exitCode ?? 0), 500)
    }
  }, 1000)

  async function inspect() {
    const targets = await json(`http://127.0.0.1:${CHROME_PORT}/json/list`)
    const page = targets.find(target => target.type === 'page' && typeof target.webSocketDebuggerUrl === 'string')
    if (page === undefined) throw new Error('no renderer target appeared')
    const client = await connect(page.webSocketDebuggerUrl)
    await client.send('Log.enable')
    await client.send('Runtime.enable')
    await client.send('Network.enable')
    await sleep(8000)

    const requests = client.events
      .filter(event => event.method === 'Network.responseReceived')
      .map(event => ({ url: event.params.response.url, status: event.params.response.status }))
    const failures = requests.filter(entry => entry.status >= 400)
    const consoleErrors = client.events
      .filter(event => event.method === 'Log.entryAdded' && event.params.entry.level === 'error')
      .map(event => event.params.entry.text)
    const pluginRequests = requests.filter(entry => entry.url.includes('/plugins/'))

    const manifest = JSON.parse(readFileSync(join(options.bundle, 'manifest.json'), 'utf8'))
    const missing = manifest.plugins
      .filter(plugin => {
        const pkg = JSON.parse(readFileSync(join(options.bundle, 'vendor', plugin.name, 'package.json'), 'utf8'))
        if (!pkg.dsh?.client) return false
        return !pluginRequests.some(entry => entry.url.includes(plugin.name))
      })

    console.log(`requests  ${requests.length} (plugins ${pluginRequests.length})`)
    if (pluginRequests.length > 0) {
      console.log(`plugin bundle ${pluginRequests[0].url.slice(0, 160)}`)
    }
    const check = (condition, message) => {
      console.log(`${condition ? 'ok   ' : 'FAIL '} ${message}`)
      if (!condition) process.exitCode = 1
    }
    check(/^\/plugins\//.test(new URL(pluginRequests[0]?.url ?? 'http://x/').pathname) || pluginRequests.length > 0,
      'the renderer requested a composed plugin bundle')
    check(missing.length === 0, `every client plugin registered${missing.length ? ` (missing ${missing.join(', ')})` : ''}`)
    check(failures.length === 0, `no failed responses${failures.length ? `: ${failures.slice(0, 5).map(entry => `${entry.status} ${entry.url}`).join('; ')}` : ''}`)
    check(consoleErrors.length === 0, `no console errors${consoleErrors.length ? `: ${consoleErrors.slice(0, 3).join(' | ')}` : ''}`)
    client.socket.close()
  }
}

main()
