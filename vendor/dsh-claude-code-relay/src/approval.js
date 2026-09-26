// The approval bridge of dsh-claude-code-relay: a Unix socket the Claude Code CLI's PreToolUse
// hook calls before every tool call, and the requests it publishes for the dsh web UI to answer.
//
// The CLI runs its own tools, so dsh's approval service never sees them — but a PreToolUse hook is
// a real, documented interception point that runs as its own process and can block until answered.
// That is the channel: the hook connects here, this module parks the request until the browser (or
// the timeout) decides, and the hook hands the verdict back to the CLI.

import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** One intercepted tool call awaiting a verdict. */
class PendingCall {
  constructor({ sessionId, claudeSessionId, toolName, toolInput, toolUseId, cwd, permissionMode }) {
    this.id = `${Date.now().toString(36)}-${(this.seq = (PendingCall.seq = (PendingCall.seq ?? 0) + 1))}`;
    this.sessionId = sessionId;
    this.claudeSessionId = claudeSessionId;
    this.toolName = toolName;
    this.toolInput = toolInput;
    this.toolUseId = toolUseId;
    this.cwd = cwd;
    this.permissionMode = permissionMode;
    this.createdAt = Date.now();
    // These must be initialized before the promise below: the executor closes over `settle`, and a
    // caller may settle the call synchronously from inside the constructor's own microtask.
    this.timer = null;
    this.done = false;
    // Resolved by the UI, the timeout, or session teardown. A never-settled promise would hang the
    // CLI's tool call, which is worse than a denial: the timeout guarantees an answer.
    this.verdict = new Promise((resolve) => {
      this.settle = (decision, reason) => {
        if (this.done) return;
        this.done = true;
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        resolve({ decision, reason: reason ?? "" });
      };
    });
  }
}

/** The bridge's own socket path. Kept short on purpose: macOS caps sun_path at ~104 bytes, and the
 *  project directory can be long. */
export function socketPath(key) {
  return join(tmpdir(), `dsh-ccr-${key}.sock`);
}

/** A token identifying one plugin mount, so two mounts never share a socket. */
export function bridgeKey(providerId) {
  return String(providerId ?? "claude-code-relay").replace(/[^A-Za-z0-9]/g, "-").slice(0, 40);
}

/**
 * Bridges PreToolUse hooks to the dsh web UI.
 *
 * Two policies coexist:
 *  - `auto` (the default): the turn's access shield already decided what may run, so a call the CLI
 *    still had to ask about is answered from that policy — allowed inside the shield, denied
 *    outside it. No prompt, no silent failure, and the transcript says which it was.
 *  - `ask`: every gated call is published and waits for the browser. This is the mode for a user
 *    who wants to see each write.
 */
export class ApprovalBridge {
  constructor({ ctx, config, log }) {
    this.ctx = ctx;
    this.config = config;
    this.log = log;
    this.key = bridgeKey(config?.providerId);
    this.path = socketPath(this.key);
    this.server = null;
    // Session id → the workspace the CLI sees, so a hook (which only knows its cwd) can be matched
    // to the dsh session that started it.
    this.sessions = new Map();
    // The newest calls first: the UI shows the head of this list.
    this.pending = [];
    this.listeners = new Set();
    // Claude Code session id → dsh session id, so the exact session is matched when known.
    this.byClaudeSession = new Map();
    // Turn-scoped consumers of compaction notices (PreCompact hook reports).
    this.compactListeners = new Set();
    this.noteQueue = [];
    this.waitingNote = null;
  }

  get enabled() {
    return this.config?.approvalBridge !== false;
  }

  /** The Settings/CLI-facing snippet that installs the hook. */
  hookCommand(hookScriptPath) {
    return `${hookScriptPath} ${this.path}`;
  }

  /** Note that one dsh session is running with a given Claude session id and workspace. */
  trackSession(sessionId, claudeSessionId, cwd) {
    if (!sessionId) return;
    this.sessions.set(sessionId, { cwd, claudeSessionId, at: Date.now() });
    if (claudeSessionId) this.byClaudeSession.set(claudeSessionId, sessionId);
  }

  forgetSession(sessionId) {
    const entry = this.sessions.get(sessionId);
    if (entry?.claudeSessionId) this.byClaudeSession.delete(entry.claudeSessionId);
    this.sessions.delete(sessionId);
    // A session that goes away must not leave the CLI blocked on an answer that can never come.
    for (const call of this.pending.filter((c) => c.sessionId === sessionId)) {
      call.settle("deny", "the session ended before the call was approved");
    }
    this.pending = this.pending.filter((c) => c.sessionId !== sessionId);
    this.publish();
  }

  /** Match a hook's report to a dsh session. The Claude session id is exact when the adapter
   *  started that conversation; otherwise the workspace narrows it, and an unambiguous single
   *  match wins. */
  sessionFor({ session_id: claudeSessionId, cwd }) {
    if (claudeSessionId && this.byClaudeSession.has(claudeSessionId)) {
      return this.byClaudeSession.get(claudeSessionId);
    }
    const sameCwd = [...this.sessions.entries()].filter(([, s]) => s.cwd === cwd);
    if (sameCwd.length === 1) return sameCwd[0][0];
    return undefined;
  }

  /** Whether the access shield a turn is running under permits this tool. The policy is looked up
   *  per session: two sessions can run concurrently with different shields, so a single shared
   *  field would let one session's policy answer the other's tool call. Unknown policies allow —
   *  the CLI's own gate already refused or permitted by the time a hook is consulted. */
  allowedByPolicy(sessionId, toolName) {
    const policy = sessionId ? this.sessions.get(sessionId)?.policy : undefined;
    if (!policy || policy.mode === "bypassPermissions") return true;
    if (Array.isArray(policy.allowed) && policy.allowed.length > 0) {
      return policy.allowed.includes(toolName);
    }
    return true;
  }

  /** Record the shield one session's next turn runs under. */
  setPolicy(sessionId, policy) {
    if (!sessionId) return;
    const entry = this.sessions.get(sessionId);
    if (entry) entry.policy = policy;
  }

  /** Deliver a PreCompact report to whoever is streaming the session it belongs to. The CLI
   *  prints nothing on stdout while it compacts — for minutes — and upstream declined the
   *  request to emit a start event, so this hook report is the only immediate signal there is. */
  notifyCompact(facts) {
    const note = {
      sessionId: this.sessionFor(facts),
      claudeSessionId: facts.session_id ?? null,
      cwd: String(facts.cwd ?? ""),
      trigger: facts.trigger === "manual" ? "manual" : "auto",
      at: Date.now(),
    };
    for (const listener of this.compactListeners) {
      try {
        listener(note);
      } catch {
        // a throwing consumer must not take the bridge down
      }
    }
  }

  /** A one-consumer channel of compaction notices. `next()` hands back the same pending promise
   *  until it settles, so racing it against CLI frame events never strands a notice on a waiter
   *  the racer has already abandoned. */
  compactChannel() {
    const deliver = (note) => {
      if (this.waitingNote) {
        const pending = this.waitingNote;
        this.waitingNote = null;
        pending.resolve({ done: false, note });
      } else {
        this.noteQueue.push(note);
      }
    };
    this.compactListeners.add(deliver);
    return {
      next: () => {
        if (this.noteQueue.length > 0) return Promise.resolve({ done: false, note: this.noteQueue.shift() });
        if (!this.waitingNote) {
          let resolve;
          const promise = new Promise((r) => (resolve = r));
          this.waitingNote = { promise, resolve };
        }
        return this.waitingNote.promise;
      },
      close: () => {
        this.compactListeners.delete(deliver);
        this.noteQueue = [];
        if (this.waitingNote) {
          const pending = this.waitingNote;
          this.waitingNote = null;
          pending.resolve({ done: true });
        }
      },
    };
  }

  /** Publish one pending call and wait for its verdict. */
  async ask(facts) {
    const sessionId = this.sessionFor(facts);
    const call = new PendingCall({ ...facts, sessionId });
    const timeoutMs = this.config?.approvalTimeoutMs ?? 120000;

    // Auto policy: answer from the shield the turn is already running under. The CLI asked because
    // its own prompt had nobody to answer it, not because dsh's user has to decide.
    if (this.config?.approvalMode !== "ask") {
      const ok = this.allowedByPolicy(call.sessionId, call.toolName);
      call.settle(
        ok ? "allow" : "deny",
        ok
          ? "allowed by this session's dsh access policy"
          : `"${call.toolName}" is outside this session's dsh access policy`,
      );
      return call.verdict;
    }

    this.pending.unshift(call);
    this.publish();
    // Deliberately NOT unref'd: the CLI's tool call is blocked until this fires, and a timer that
    // the event loop is free to skip would leave the turn hanging instead of failing safe.
    call.timer = setTimeout(() => {
      call.settle("deny", "no answer within the approval timeout");
      this.pending = this.pending.filter((c) => c !== call);
      this.publish();
    }, timeoutMs);
    return call.verdict;
  }

  /** Answer one published call. */
  answer(id, decision, reason) {
    const call = this.pending.find((c) => c.id === id);
    if (!call) return false;
    call.settle(decision === "allow" ? "allow" : "deny", reason ?? "");
    this.pending = this.pending.filter((c) => c !== call);
    this.publish();
    return true;
  }

  /** The wire view the Settings page (and any other consumer) reads. */
  snapshot() {
    return this.pending.map((call) => ({
      id: call.id,
      sessionId: call.sessionId ?? null,
      toolName: call.toolName,
      toolInput: summarizeInput(call.toolName, call.toolInput),
      cwd: call.cwd ?? "",
      createdAt: call.createdAt,
    }));
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  publish() {
    const snap = this.snapshot();
    for (const listener of this.listeners) {
      try {
        listener(snap);
      } catch {
        // a throwing consumer must not take the bridge down
      }
    }
  }

  /** Start listening. A socket left behind by a killed host is removed first: it has no listener,
   *  so keeping it would make every hook fail. */
  start() {
    if (!this.enabled) return;
    const dir = tmpdir();
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    try {
      if (existsSync(this.path)) rmSync(this.path, { force: true });
    } catch {
      // an unremovable stale socket surfaces as a listen failure below
    }
    this.server = createServer((socket) => {
      let buf = "";
      socket.on("data", (chunk) => {
        buf += chunk;
        const at = buf.indexOf("\n");
        if (at === -1) return;
        const line = buf.slice(0, at);
        buf = buf.slice(at + 1);
        this.handle(line)
          .then((verdict) => {
            socket.end(`${JSON.stringify(verdict)}\n`);
          })
          .catch((error) => {
            socket.end(`${JSON.stringify({ decision: "deny", reason: String(error?.message ?? error) })}\n`);
          });
      });
      socket.on("error", () => {
        // the hook process died waiting; nothing to answer
      });
    });
    this.server.on("error", (error) => {
      this.log("warn", `approval bridge socket unavailable (${error.message}); the CLI will run its own permission path`);
      this.server = null;
    });
    this.server.listen(this.path, () => {
      try {
        chmodSync(this.path, 0o600); // only this user's processes may ask
      } catch {
        // a permissive socket is still loopback-only in practice; not worth failing the boot
      }
      this.log("info", `approval bridge listening at ${this.path}`);
    });
    this.server.unref?.();
  }

  /** One hook request: parse it, decide it, answer it. */
  async handle(line) {
    let facts;
    try {
      facts = JSON.parse(line);
    } catch {
      return { decision: "deny", reason: "malformed hook request" };
    }
    if (facts?.hook_event_name === "PreCompact") {
      // Informational only: no verdict to return, nothing published — the streaming turn gets
      // the notice through its channel and the hook exits on the ack.
      this.notifyCompact(facts);
      return { ack: true };
    }
    if (facts?.hook_event_name !== "PreToolUse") {
      return { decision: "deny", reason: `unsupported hook event ${facts?.hook_event_name}` };
    }
    return this.ask({
      claudeSessionId: facts.session_id,
      toolName: String(facts.tool_name ?? "tool"),
      toolInput: facts.tool_input ?? {},
      toolUseId: facts.tool_use_id ?? "",
      cwd: String(facts.cwd ?? ""),
      permissionMode: facts.permission_mode ?? "",
    });
  }

  stop() {
    for (const call of this.pending) call.settle("deny", "the relay plugin shut down");
    this.pending = [];
    this.sessions.clear();
    this.byClaudeSession.clear();
    this.noteQueue = [];
    if (this.waitingNote) {
      const pending = this.waitingNote;
      this.waitingNote = null;
      pending.resolve({ done: true });
    }
    try {
      this.server?.close();
    } catch {
      // already closed
    }
    this.server = null;
    try {
      if (existsSync(this.path)) rmSync(this.path, { force: true });
    } catch {
      // a leftover socket is cleared on the next boot
    }
  }
}

/** The one-line view of a tool call the approval list shows: the same "identifying argument"
 *  idea the chat transcript uses, so both surfaces describe a call the same way. */
export function summarizeInput(toolName, input) {
  const args = input && typeof input === "object" ? input : {};
  const key = {
    Read: "file_path", Write: "file_path", Edit: "file_path", NotebookEdit: "notebook_path",
    Bash: "command", Glob: "pattern", Grep: "pattern", WebFetch: "url", WebSearch: "query",
    Task: "description",
  }[toolName];
  const value = key ? args[key] : undefined;
  const text = typeof value === "string" ? value : JSON.stringify(args);
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > 240 ? `${flat.slice(0, 239)}…` : flat;
}

/** Write the hook script the CLI will run, and return its path. The script is the plugin's own
 *  file so the socket path never has to appear in a user's settings document. */
export function writeHookScript(dir, socket) {
  const path = join(dir, "pretooluse-hook.mjs");
  writeFileSync(path, HOOK_SOURCE, { mode: 0o700 });
  return { path, command: `${JSON.stringify(process.execPath)} ${JSON.stringify(path)} ${JSON.stringify(socket)}` };
}

/** The compaction hook: report that the CLI started compacting, then exit. Informational only —
 *  nothing is printed (the CLI expects no verdict from PreCompact here) and every failure path is
 *  a silent exit, because a missing notice must never disturb the turn it describes. */
export function writeCompactHookScript(dir, socket) {
  const path = join(dir, "precompact-hook.mjs");
  writeFileSync(path, COMPACT_HOOK_SOURCE, { mode: 0o700 });
  return { path, command: `${JSON.stringify(process.execPath)} ${JSON.stringify(path)} ${JSON.stringify(socket)}` };
}

/** The hook: forward the CLI's payload to the bridge, print the verdict as the CLI expects.
 *  Every failure path denies — a hook that cannot reach the host must not silently widen access. */
const HOOK_SOURCE = `#!/usr/bin/env node
// Generated by dsh-claude-code-relay. Forwards one PreToolUse event to the plugin's bridge and
// prints the verdict in the shape Claude Code expects.
import { connect } from "node:net";

const socketPath = process.argv[2] ?? "";
const deny = (reason) =>
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
    }),
  );

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  const socket = connect(socketPath);
  let buf = "";
  let answered = false;
  const finish = (verdict) => {
    if (answered) return;
    answered = true;
    try { socket.destroy(); } catch {}
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: verdict.decision === "allow" ? "allow" : "deny",
          ...(verdict.reason ? { permissionDecisionReason: verdict.reason } : {}),
        },
      }),
    );
  };
  socket.on("connect", () => socket.write(raw.replace(/\\n+$/, "") + "\\n"));
  socket.on("data", (chunk) => {
    buf += chunk;
    const at = buf.indexOf("\\n");
    if (at === -1) return;
    try { finish(JSON.parse(buf.slice(0, at))); } catch { finish({ decision: "deny", reason: "bad verdict" }); }
  });
  socket.on("error", (error) => deny(\`the dsh approval bridge is unreachable: \${error.message}\`));
  socket.on("close", () => { if (!answered) deny("the dsh approval bridge closed without answering"); });
});
`;

const COMPACT_HOOK_SOURCE = `#!/usr/bin/env node
// Generated by dsh-claude-code-relay. Reports that the CLI started compacting, then exits:
// informational only, so nothing is printed and no verdict is expected.
import { connect } from "node:net";

const socketPath = process.argv[2] ?? "";
const done = () => process.exit(0);
setTimeout(done, 10000).unref?.(); // a bridge that never answers must not hold the hook open

let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  const socket = connect(socketPath);
  socket.on("connect", () => socket.write(raw.replace(/\\n+$/, "") + "\\n"));
  socket.on("data", done); // the ack is all we came for
  socket.on("error", done); // nothing to report to, and nothing to disturb
  socket.on("close", done);
});
`;
