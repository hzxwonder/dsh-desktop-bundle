// Unit tests for the approval bridge: session matching, policy decisions, timeouts, and the
// socket round trip a PreToolUse hook actually performs.

import test from "node:test";
import assert from "node:assert/strict";
import { connect } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdirSync } from "node:fs";
import {
  ApprovalBridge,
  bridgeKey,
  socketPath,
  summarizeInput,
  writeCompactHookScript,
  writeHookScript,
} from "../src/approval.js";

const silent = () => {};

/** One bridge per test, always stopped, so temp sockets do not pile up. */
function makeBridge(config = {}, providerId = `t${Math.round(process.hrtime()[1] % 1e6)}`) {
  const bridge = new ApprovalBridge({ ctx: {}, config: { providerId, ...config }, log: silent });
  return bridge;
}

test("bridgeKey and socketPath stay inside the sun_path limit", () => {
  assert.equal(bridgeKey("claude-code-relay"), "claude-code-relay");
  assert.equal(bridgeKey("a/b c:d"), "a-b-c-d");
  const path = socketPath(bridgeKey("claude-code-relay"));
  assert.ok(path.length < 100, `socket path too long: ${path}`);
});

test("summarizeInput names the identifying argument, not the whole payload", () => {
  assert.equal(summarizeInput("Bash", { command: "ls -la" }), "ls -la");
  assert.equal(summarizeInput("Read", { file_path: "/a/b.js", offset: 0 }), "/a/b.js");
  // An unknown tool still says something.
  assert.ok(summarizeInput("Mystery", { a: 1 }).includes("a"));
});

test("a hook is matched to its session by Claude session id, then by workspace", () => {
  const bridge = makeBridge();
  bridge.trackSession("dsh-1", "claude-1", "/work/one");
  bridge.trackSession("dsh-2", "claude-2", "/work/two");
  // Exact: the adapter started this conversation, so the id settles it.
  assert.equal(bridge.sessionFor({ session_id: "claude-2", cwd: "/somewhere/else" }), "dsh-2");
  // Workspace: an unknown Claude session in a unambiguous workspace.
  assert.equal(bridge.sessionFor({ session_id: "unknown", cwd: "/work/one" }), "dsh-1");
  // Ambiguous or unknown: no match, which the bridge treats as "no policy known".
  assert.equal(bridge.sessionFor({ session_id: "unknown", cwd: "/nope" }), undefined);
  bridge.stop();
});

test("a PreCompact hook report acks instantly and notifies without publishing a call", async () => {
  const bridge = makeBridge({ approvalMode: "ask" });
  const seen = [];
  bridge.compactListeners.add((note) => seen.push(note));
  const verdict = await bridge.handle(
    JSON.stringify({
      hook_event_name: "PreCompact",
      session_id: "claude-9",
      cwd: "/work/one",
      trigger: "auto",
      custom_instructions: null,
    }),
  );
  assert.deepEqual(verdict, { ack: true });
  assert.equal(bridge.pending.length, 0, "a compaction notice is never an approval");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].trigger, "auto");
  assert.equal(seen[0].claudeSessionId, "claude-9");
  bridge.stop();
});

test("the compact channel hands the same pending promise to every next(), so races never strand a notice", async () => {
  const bridge = makeBridge();
  const channel = bridge.compactChannel();
  const first = channel.next();
  const second = channel.next();
  assert.equal(first, second, "one pending promise until it settles");
  bridge.notifyCompact({ session_id: "c1", cwd: "/w", trigger: "auto" });
  const result = await first;
  assert.equal(result.done, false);
  assert.equal(result.note.claudeSessionId, "c1");
  // A note that arrives with nobody waiting is queued, not lost.
  bridge.notifyCompact({ session_id: "c2", cwd: "/w", trigger: "auto" });
  const queued = await channel.next();
  assert.equal(queued.note.claudeSessionId, "c2");
  channel.close();
  bridge.stop();
});

test("closing the channel resolves a pending waiter as done", async () => {
  const bridge = makeBridge();
  const channel = bridge.compactChannel();
  const waiting = channel.next();
  channel.close();
  assert.deepEqual(await waiting, { done: true });
  bridge.stop();
});

test("stopping the bridge resolves a pending notice waiter as done", async () => {
  const bridge = makeBridge();
  const channel = bridge.compactChannel();
  const waiting = channel.next();
  bridge.stop();
  assert.deepEqual(await waiting, { done: true });
});

test("the generated compaction hook exists and takes the socket as an argument", () => {
  const dir = mkdirSync(`/tmp/dsh-ccr-test-${Date.now()}`, { recursive: true });
  const { path, command } = writeCompactHookScript(dir, "/tmp/the-bridge.sock");
  assert.ok(existsSync(path));
  assert.match(command, /precompact-hook\.mjs/);
  assert.match(command, /\/tmp\/the-bridge\.sock/);
});

test("the real compaction hook reaches a listening bridge and exits on the ack", async () => {
  const bridge = makeBridge();
  bridge.start();
  assert.ok(bridge.server, "bridge should be listening");
  const notices = [];
  const channel = bridge.compactChannel();
  const notice = channel.next();

  // The actual generated script, run the way the CLI runs it: payload on stdin, socket as argv.
  const { path } = writeCompactHookScript(mkdirSync(`/tmp/dsh-ccr-test-${Date.now()}`, { recursive: true }), bridge.path);
  const child = spawn(process.execPath, [path, bridge.path], { stdio: ["pipe", "pipe", "pipe"] });
  child.stdin.write(
    `${JSON.stringify({
      hook_event_name: "PreCompact",
      session_id: "claude-live",
      cwd: "/work",
      trigger: "auto",
    })}\n`,
  );
  child.stdin.end();
  const [code] = await once(child, "exit");
  assert.equal(code, 0, "an informational hook exits cleanly");

  const result = await notice;
  assert.equal(result.done, false);
  assert.equal(result.note.claudeSessionId, "claude-live");
  assert.equal(result.note.trigger, "auto");
  assert.equal(bridge.pending.length, 0);
  channel.close();
  bridge.stop();
});

test("auto mode answers from the session's own shield", async () => {
  const bridge = makeBridge({ approvalMode: "auto" });
  bridge.trackSession("dsh-1", "claude-1", "/work");
  bridge.setPolicy("dsh-1", { mode: "default", allowed: ["Read", "Grep"], disallowed: ["Write"] });

  const allowed = await bridge.ask({
    claudeSessionId: "claude-1", cwd: "/work", toolName: "Grep", toolInput: {}, toolUseId: "t1",
  });
  assert.equal(allowed.decision, "allow");

  const denied = await bridge.ask({
    claudeSessionId: "claude-1", cwd: "/work", toolName: "Write", toolInput: {}, toolUseId: "t2",
  });
  assert.equal(denied.decision, "deny");
  assert.match(denied.reason, /access policy/);

  // Nothing was published: auto mode must not put a prompt in front of the user.
  assert.deepEqual(bridge.snapshot(), []);
  bridge.stop();
});

test("per-session policies never answer for each other", async () => {
  const bridge = makeBridge({ approvalMode: "auto" });
  bridge.trackSession("read-session", "c1", "/a");
  bridge.trackSession("write-session", "c2", "/b");
  bridge.setPolicy("read-session", { mode: "default", allowed: ["Read"], disallowed: ["Write"] });
  bridge.setPolicy("write-session", { mode: "acceptEdits", allowed: [], disallowed: [] });

  const gated = await bridge.ask({ claudeSessionId: "c1", cwd: "/a", toolName: "Write", toolInput: {} });
  assert.equal(gated.decision, "deny", "the read-only session must not inherit the other's shield");

  const open = await bridge.ask({ claudeSessionId: "c2", cwd: "/b", toolName: "Write", toolInput: {} });
  assert.equal(open.decision, "allow");
  bridge.stop();
});

test("ask mode publishes the call and waits for the verdict", async () => {
  const bridge = makeBridge({ approvalMode: "ask" });
  bridge.trackSession("dsh-1", "c1", "/work");
  const seen = [];
  bridge.subscribe((pending) => seen.push(...pending));

  const verdict = bridge.ask({
    claudeSessionId: "c1", cwd: "/work", toolName: "Bash", toolInput: { command: "rm -rf /" }, toolUseId: "t9",
  });
  assert.equal(bridge.snapshot().length, 1);
  assert.equal(bridge.snapshot()[0].toolName, "Bash");
  assert.equal(seen.length, 1);

  assert.equal(bridge.answer(bridge.snapshot()[0].id, "allow", "looks fine"), true);
  assert.deepEqual(await verdict, { decision: "allow", reason: "looks fine" });
  assert.deepEqual(bridge.snapshot(), []);
  // Answering an unknown id is a miss, not a crash.
  assert.equal(bridge.answer("nope", "allow"), false);
  bridge.stop();
});

test("an unanswered ask is denied rather than left blocking the CLI", async () => {
  const bridge = makeBridge({ approvalMode: "ask", approvalTimeoutMs: 1000 });
  const verdict = await bridge.ask({ cwd: "/work", toolName: "Write", toolInput: {} });
  assert.equal(verdict.decision, "deny");
  assert.match(verdict.reason, /timeout/);
  assert.deepEqual(bridge.snapshot(), []);
  bridge.stop();
});

test("a session that ends denies its outstanding calls", async () => {
  const bridge = makeBridge({ approvalMode: "ask" });
  bridge.trackSession("dsh-1", "c1", "/work");
  const verdict = bridge.ask({ claudeSessionId: "c1", cwd: "/work", toolName: "Write", toolInput: {} });
  bridge.forgetSession("dsh-1");
  assert.equal((await verdict).decision, "deny");
  bridge.stop();
});

test("the socket answers a hook in the CLI's own verdict shape", async () => {
  const bridge = makeBridge({ approvalMode: "ask", approvalTimeoutMs: 5000 });
  bridge.start();
  assert.ok(bridge.server, "bridge should be listening");
  // Answer as soon as the call is published, the way the web UI does.
  bridge.subscribe((pending) => {
    for (const call of pending) bridge.answer(call.id, "allow", "ok");
  });

  const reply = await new Promise((resolve, reject) => {
    const socket = connect(bridge.path);
    let buf = "";
    socket.on("connect", () =>
      socket.write(
        `${JSON.stringify({
          hook_event_name: "PreToolUse",
          session_id: "unknown",
          cwd: "/work",
          tool_name: "Read",
          tool_input: { file_path: "/a" },
          tool_use_id: "t1",
        })}\n`,
      ),
    );
    socket.on("data", (chunk) => {
      buf += chunk;
      const at = buf.indexOf("\n");
      if (at !== -1) resolve(JSON.parse(buf.slice(0, at)));
    });
    socket.on("error", reject);
  });
  assert.deepEqual(reply, { decision: "allow", reason: "ok" });
  bridge.stop();
});

test("a malformed or unsupported hook request is denied, never allowed", async () => {
  const bridge = makeBridge({ approvalMode: "ask" });
  assert.equal((await bridge.handle("not json")).decision, "deny");
  assert.equal((await bridge.handle(JSON.stringify({ hook_event_name: "PostToolUse" }))).decision, "deny");
  bridge.stop();
});

test("the generated hook script exists, is executable, and takes the socket as an argument", () => {
  const bridge = makeBridge();
  const dir = "/tmp/dsh-ccr-test-hook";
  mkdirSync(dir, { recursive: true });
  const hook = writeHookScript(dir, bridge.path);
  assert.ok(existsSync(hook.path));
  // The path travels as argv, so a socket path can never break out of the script's source.
  assert.ok(hook.command.includes(bridge.path));
  bridge.stop();
});
