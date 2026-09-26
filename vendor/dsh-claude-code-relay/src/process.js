// Process plumbing of dsh-claude-code-relay: spawn the Claude Code CLI per turn, feed it one
// stream-json user line, and expose its stream-json output as an async event queue.

import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { createInterface } from "node:readline";

/** Where Claude Code's installers put `claude` (native installer, old local install, Homebrew, npm
 *  and bun globals, Volta). A dsh started from the macOS Dock gets a PATH of /usr/bin:/bin and
 *  finds none of these, so they are appended to whatever PATH the child inherits. */
export function claudeDirs(home = homedir()) {
  return [
    join(home, ".local", "bin"),
    join(home, ".claude", "local"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    join(home, ".npm-global", "bin"),
    join(home, ".bun", "bin"),
    join(home, ".volta", "bin"),
  ];
}

/** `path` with every claude directory it lacks appended: a name found on the caller's PATH keeps
 *  winning, and an npm-installed claude (#!/usr/bin/env node) still finds its node. */
export function withClaudeDirs(path, dirs = claudeDirs()) {
  const have = (path ?? "").split(delimiter).filter(Boolean);
  return [...have, ...dirs.filter((d) => !have.includes(d))].join(delimiter);
}

/** The absolute path of a bare `command` found on PATH or in the known install dirs, else the
 *  command unchanged: a path is trusted as given, and a name found nowhere is left for spawn to
 *  fail on with the usual ENOENT (which surfaces as a readable error, not a crash). */
export function resolveCommand(command, path, platform) {
  if (!command || command.includes("/")) return command;
  const names = platform === "win32" ? [command, `${command}.exe`] : [command];
  for (const dir of (path ?? "").split(delimiter).filter(Boolean).concat(claudeDirs()))
    for (const name of names) if (existsSync(join(dir, name))) return join(dir, name);
  return command;
}

/** Parent-env keys stripped from every child: this plugin owns the relay endpoint and the
 *  credential, and a stale inherited value (a leftover OAuth base URL, someone's own
 *  ANTHROPIC_API_KEY, a CLAUDE_CONFIG_DIR from another tool) must not leak into the turn. */
const STRIPPED_ENV = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_CUSTOM_HEADERS",
  "ANTHROPIC_MODEL",
  "ANTHROPIC_SMALL_FAST_MODEL",
  "ANTHROPIC_DEFAULT_HAIKU_MODEL",
  "ANTHROPIC_DEFAULT_SONNET_MODEL",
  "ANTHROPIC_DEFAULT_OPUS_MODEL",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CONFIG_DIR",
];

/** The environment a claude child runs with: dsh's own minus the stripped keys, this plugin's
 *  additions, then the user's extraEnv (the escape hatch: a caller that means to override wins). */
export function childEnv(base, { baseUrl, apiKey, authHeader, configDir, extraEnv }, platform) {
  const env = {};
  for (const [k, v] of Object.entries(base)) if (v !== undefined) env[k] = v;
  for (const k of STRIPPED_ENV) delete env[k];
  if (platform !== "win32") env.PATH = withClaudeDirs(env.PATH);
  env.ANTHROPIC_BASE_URL = baseUrl;
  if (authHeader === "api-key") env.ANTHROPIC_API_KEY = apiKey;
  else env.ANTHROPIC_AUTH_TOKEN = apiKey;
  env.CLAUDE_CODE_ENTRYPOINT = "dsh-claude-code-relay";
  // A relay-driven CLI has no business phoning home: no updater probes, no telemetry/statsig.
  // Both are documented Claude Code env vars and can be re-enabled via extraEnv.
  env.DISABLE_AUTOUPDATER = "1";
  env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = "1";
  if (configDir) env.CLAUDE_CONFIG_DIR = configDir;
  Object.assign(env, extraEnv ?? {});
  return env;
}

// ---------------------------------------------------------------------------
// CLI probe

/** The flag in an `error: unknown option '--x'` line, however the CLI wrapped it. */
export function unknownFlagIn(text) {
  return /unknown option '(--[a-zA-Z][\w-]*)'/.exec(String(text ?? ""))?.[1];
}

/** One probe per binary per process: Claude Code auto-updates itself, so flags are checked against
 *  `claude --help` once and anything missing is left out. A probe that answers nothing is not an
 *  answer — unknown flags mean "assume supported" and the spawn itself will say otherwise. */
const probes = new Map();

export function probeCli(command, platform) {
  let probe = probes.get(command);
  if (!probe) {
    probe = (async () => {
      const run = (args) =>
        new Promise((resolve) => {
          execFile(command, args, { timeout: 8000 }, (err, stdout) => resolve(err ? "" : String(stdout)));
        });
      const [help, version] = await Promise.all([run(["--help"]), run(["--version"])]);
      const flags = new Set(help.match(/--[a-zA-Z-]+/g) ?? []);
      return { flags: flags.size > 0 ? flags : null, version: (version || "").trim() || "unknown" };
    })();
    probes.set(command, probe);
  }
  return probe.then(({ flags, version }) => ({
    flags,
    version,
    command: resolveCommand(command, process.env.PATH, platform ?? process.platform),
  }));
}

// ---------------------------------------------------------------------------
// Event queue

/** FIFO of parsed stdout frames with async reads; closes when the stream ends. */
class EventQueue {
  constructor() {
    this.items = [];
    this.waiters = [];
    this.closed = false;
  }

  push(item) {
    const waiter = this.waiters.shift();
    if (waiter) waiter(item);
    else this.items.push(item);
  }

  close() {
    this.closed = true;
    while (this.waiters.length) this.waiters.shift()(null);
  }

  next() {
    if (this.items.length > 0) return Promise.resolve(this.items.shift());
    if (this.closed) return Promise.resolve(null);
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  /** Hand back everything already buffered without waiting — a resident process drains these at
   *  turn start: frames that trailed the previous turn's result belong to nobody. */
  drain() {
    const out = this.items;
    this.items = [];
    return out;
  }
}

/** One `claude -p` child for one turn: stream-json in on stdin, parsed frames out of stdout, a
 *  bounded stderr tail for error messages, and an idle watchdog for a child that goes silent. */
export class CliProcess {
  constructor({ command, args, cwd, env, idleMs, debug }) {
    this.command = command;
    this.args = args;
    this.cwd = cwd;
    this.env = env;
    this.idleMs = idleMs;
    this.debug = debug ?? false;
    this.events = new EventQueue();
    this.child = null;
    this.exitCode = null;
    this.spawnError = "";
    this.stderrTail = "";
    this.idleKilled = false;
    this.idleTimer = null;
    // When suspended, every armIdle is a no-op: a resident process parks its silence watchdog
    // between turns (its own, longer idle kill owns that gap) and re-arms it per turn.
    this.idleSuspended = false;
    this.exited = false;
    this.exitWaiters = [];
  }

  spawn() {
    const child = spawn(this.command, this.args, {
      cwd: this.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      env: this.env,
    });
    this.child = child;
    // A resident outlives its turn, so nothing about the child may pin dsh's event loop: an
    // unref'd child lets the host exit whenever its own work is done, and the closing stdin pipe
    // is the child's cue to leave — the same EOF a one-shot's endInput() delivers.
    child.unref?.();
    for (const stream of [child.stdin, child.stdout, child.stderr]) stream?.unref?.();
    // Node emits `error` on the child for ENOENT/EACCES, and an EventEmitter error with no
    // listener takes the whole dsh host down; it resolves as an exit here instead.
    child.on("error", (e) => {
      this.spawnError = e.message;
      this.settle(child.exitCode);
    });
    child.on("close", (code) => this.settle(code));
    child.stderr?.on("data", (chunk) => {
      this.stderrTail = (this.stderrTail + String(chunk)).slice(-8192);
    });
    createInterface({ input: child.stdout }).on("line", (line) => {
      const text = line.trim();
      if (text === "") return;
      let event;
      try {
        event = JSON.parse(text);
      } catch {
        // The CLI prints occasional non-JSON lines (update notices, warnings); they are not frames.
        this.stderrTail = (this.stderrTail + `\n${text}`).slice(-8192);
        return;
      }
      this.armIdle();
      this.events.push(event);
    });
    this.armIdle();
    return this;
  }

  settle(code) {
    if (this.exited) return;
    this.exited = true;
    this.exitCode = code ?? null;
    this.disarmIdle();
    this.events.close();
    for (const waiter of this.exitWaiters) waiter();
    this.exitWaiters = [];
  }

  /** Resolves when the child has exited, or after `ms` — a grace window for a child that already
   *  answered and only needs a moment to flush its transcript before a kill. */
  waitForExit(ms) {
    if (this.exited) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => {
        clearTimeout(timer);
        const i = this.exitWaiters.indexOf(waiter);
        if (i >= 0) this.exitWaiters.splice(i, 1);
        resolve();
      };
      const waiter = done;
      const timer = setTimeout(done, ms);
      timer.unref?.();
      this.exitWaiters.push(waiter);
    });
  }

  armIdle() {
    if (this.idleSuspended) return;
    this.disarmIdle();
    if (!this.idleMs || this.exited) return;
    this.idleTimer = setTimeout(() => {
      this.idleKilled = true;
      this.kill();
    }, this.idleMs);
    this.idleTimer.unref?.();
  }

  disarmIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  /** Park the silence watchdog (between a resident's turns) and hand the gap to the caller's own
   *  idle kill; resumeIdle re-arms it for the turn ahead. */
  suspendIdle() {
    this.idleSuspended = true;
    this.disarmIdle();
  }

  resumeIdle() {
    this.idleSuspended = false;
    this.armIdle();
  }

  /** Frames already buffered, without waiting: what a resident drains at turn start. */
  drainPending() {
    return this.events.drain();
  }

  /** One stdin line: a JSON user turn. EPIPE after an early exit is swallowed; the exit itself is
   *  the failure the caller reports. */
  writeLine(line) {
    try {
      this.child?.stdin?.write(`${JSON.stringify(line)}\n`);
    } catch {
      // ignore
    }
  }

  /** Several stdin lines at once: the stream-json input carries one message per line, so a retry
   *  that resends the conversation replays its real turn boundaries instead of one flattened
   *  prompt. Written as a single chunk so the CLI cannot observe a half-delivered batch. */
  writeLines(lines) {
    if (!Array.isArray(lines) || lines.length === 0) return;
    try {
      this.child?.stdin?.write(lines.map((line) => `${JSON.stringify(line)}\n`).join(""));
    } catch {
      // ignore
    }
  }

  endInput() {
    try {
      this.child?.stdin?.end();
    } catch {
      // ignore
    }
  }

  nextEvent() {
    return this.events.next();
  }

  /** SIGTERM, then SIGKILL if it is still there in 5s; never keeps the dsh process alive. */
  kill() {
    const child = this.child;
    if (!child || child.exitCode !== null || child.signalCode !== null) return;
    try {
      child.kill();
    } catch {
      // ignore
    }
    const escalate = setTimeout(() => {
      if (child.exitCode === null && child.signalCode === null) {
        try {
          child.kill("SIGKILL");
        } catch {
          // ignore
        }
      }
    }, 5000);
    escalate.unref?.();
  }
}
