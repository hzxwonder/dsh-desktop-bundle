#!/usr/bin/env node
import {spawn, spawnSync} from 'node:child_process';
import {statSync} from 'node:fs';
import {appendFile, mkdir, readFile, unlink, utimes, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(import.meta.url);
const args = process.argv.slice(2);
const action = args[0];
const option = key => {const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1];};
const rootInput = option('--root');
if (!rootInput || !['start', 'serve', 'status', 'stop', 'open'].includes(action)) {
  console.error('Usage: node bin/local.mjs start|status|stop|open --root /absolute/deployment [--port 3099]');
  process.exit(2);
}
const root = resolve(rootInput);
const run = join(root, 'run');
const recordPath = join(run, 'service.json');
const HEARTBEAT_MAX_AGE_MS = 15000;
const port = Number(option('--port') ?? 3099);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid port');
await mkdir(run, {recursive: true, mode: 0o700});
async function record() {
  try { return JSON.parse(await readFile(recordPath, 'utf8')); } catch (error) {if (error.code === 'ENOENT') return undefined; throw error;}
}
function live(value) {
  if (!value || !Number.isInteger(value.pid) || value.pid < 2 || value.script !== script || value.root !== root) return false;
  try { process.kill(value.pid, 0); } catch { return false; }
  const processInfo = spawnSync('ps', ['-p', String(value.pid), '-o', 'command='], {encoding: 'utf8'});
  if (processInfo.status === 0) return processInfo.stdout.includes(script) && processInfo.stdout.includes('serve');
  // Some managed/macOS sandboxes deny process-table inspection. The serve
  // supervisor refreshes its private ownership record while alive, so a fresh
  // heartbeat is a bounded fallback rather than an unchecked PID claim.
  try {
    const metadata = statSync(recordPath);
    return Date.now() - metadata.mtimeMs <= HEARTBEAT_MAX_AGE_MS;
  } catch { return false; }
}
function openBrowser(url) {
  if (args.includes('--no-open')) return;
  const command = process.platform === 'darwin' ? 'open' : 'xdg-open';
  const opener = spawn(command, [url], {stdio: 'ignore'});
  opener.on('error', () => {});
  opener.unref();
}
const previous = await record();
if (action === 'status') {
  console.log(JSON.stringify({running: live(previous), ...(live(previous) ? {pid: previous.pid, url: `http://127.0.0.1:${previous.port}/`} : {})}));
} else if (action === 'open') {
  if (!live(previous)) throw new Error('Service is not running; use start');
  openBrowser(`http://127.0.0.1:${previous.port}/`);
} else if (action === 'stop') {
  if (live(previous)) {
    process.kill(previous.pid, 'SIGTERM');
    for (let i = 0; i < 150 && live(previous); i++) await new Promise(resolve => setTimeout(resolve, 100));
    if (live(previous)) throw new Error('Service is still stopping; inspect run/service.log');
  }
  console.log('Service stopped. Persistent state retained.');
} else if (action === 'start') {
  if (live(previous)) {
    openBrowser(`http://127.0.0.1:${previous.port}/`);
    console.log(`http://127.0.0.1:${previous.port}/`);
  } else {
    if (previous) await unlink(recordPath);
    const supervisor = spawn(process.execPath, [script, 'serve', '--root', root, '--port', String(port), ...(args.includes('--no-open') ? ['--no-open'] : [])], {detached: true, stdio: ['ignore', 'ignore', 'ignore', 'ipc']});
    await new Promise((resolveReady, reject) => {
      const timer = setTimeout(() => {supervisor.kill('SIGTERM'); reject(new Error('Startup timed out; inspect run/service.log'));}, 90000);
      supervisor.once('message', value => {
        clearTimeout(timer);
        if (value.error) reject(new Error(value.error));
        else {console.log(value.url); resolveReady();}
        supervisor.disconnect();
        supervisor.unref();
      });
      supervisor.once('error', error => {clearTimeout(timer); reject(error);});
      supervisor.once('exit', () => {clearTimeout(timer); reject(new Error('Service exited; inspect run/service.log'));});
    });
  }
} else {
  if (previous) throw new Error('Service ownership record already exists');
  await writeFile(recordPath, JSON.stringify({pid: process.pid, script, root, port}), {flag: 'wx', mode: 0o600});
  const cli = join(root, 'runtime/node_modules/@deepseek-ai/dsh/lib/bin.js');
  const child = spawn(process.execPath, [cli, '--profile', 'migration', '--port', String(port), '--no-open'], {cwd: root, env: {...process.env, DSH_HOME: join(root, 'state'), DSH_TELEMETRY_DISABLED: '1', npm_config_manage_package_manager_versions: 'false', npm_config_store_dir: join(root, 'pnpm-store')}, stdio: ['ignore', 'pipe', 'pipe']});
  const heartbeat = setInterval(() => { void utimes(recordPath, new Date(), new Date()).catch(() => {}); }, 2000);
  heartbeat.unref();
  let ready = false;
  let writes = Promise.resolve();
  const buffers = new Map();
  function line(text) {
    const url = text.match(/http:\/\/127\.0\.0\.1:\d+\/\?token=[^\s\x1b]+/)?.[0];
    if (url && !ready) {
      ready = true;
      openBrowser(url);
      process.send?.({url: `http://127.0.0.1:${port}/`});
    }
    const clean = text.replace(/token=[^\s\x1b]+/g, 'token=[redacted]').replace(/((?:api[_-]?key|authorization|password|secret)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]');
    writes = writes.then(() => appendFile(join(run, 'service.log'), clean + '\n', {mode: 0o600}));
  }
  for (const stream of [child.stdout, child.stderr]) {
    buffers.set(stream, '');
    stream.on('data', chunk => {
      const parts = (buffers.get(stream) + chunk.toString()).split('\n');
      buffers.set(stream, parts.pop());
      for (const part of parts) line(part);
    });
  }
  let stopping = false;
  let force;
  const stop = () => {if (stopping) return; stopping = true; child.kill('SIGTERM'); force = setTimeout(() => child.kill('SIGKILL'), 8000);};
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
  child.once('error', error => {line(error.message); process.send?.({error: 'Harness launch failed'});});
  await new Promise(resolveExit => child.once('close', resolveExit));
  clearInterval(heartbeat);
  clearTimeout(force);
  for (const tail of buffers.values()) if (tail) line(tail);
  await writes;
  const current = await record();
  if (current?.pid === process.pid) await unlink(recordPath);
  if (!ready && process.connected) process.send?.({error: 'Harness exited before startup; inspect run/service.log'});
  if (process.connected) process.disconnect();
}
