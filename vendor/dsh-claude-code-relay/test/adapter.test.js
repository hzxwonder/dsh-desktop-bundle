// End-to-end tests of the adapter: a real child process (the fake Claude CLI) is spawned per
// turn, driven through stream(), and its frames must arrive as a well-formed dsh chunk stream.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, chmodSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { ClaudeCodeRelayAdapter, Config } from "../src/index.js";
import { claudeSessionId, transcriptPath } from "../src/util.js";

const FAKE = fileURLToPath(new URL("./fake-claude.mjs", import.meta.url));
chmodSync(FAKE, 0o755);

/** A scratch cwd each test can shape freely. */
const scratch = () => mkdtempSync(join(tmpdir(), "cc-relay-test-"));

/** The adapter under test, pointed at the fake CLI. */
const makeAdapter = (overrides = {}, ctxOverrides = {}) => {
  const ctx = {
    logger: undefined,
    sessions: { get: () => undefined },
    attachments: undefined,
    ...ctxOverrides,
  };
  return new ClaudeCodeRelayAdapter(ctx, {
    ...Config({ baseUrl: "https://relay.test", apiKey: "sk-test" }),
    command: FAKE,
    idleTimeoutMs: 15000,
    ...overrides,
  });
};

/** Drain one stream() call into a chunk list. */
const drain = async (adapter, options) => {
  const chunks = [];
  for await (const chunk of adapter.stream(options)) chunks.push(chunk);
  return chunks;
};

const userTurnOptions = (text, extra = {}) => ({
  provider: "claude-code-relay",
  model: "claude-sonnet-4-5",
  messages: [{ role: "user", source: { kind: "user" }, content: [{ type: "text", text }] }],
  ...extra,
});

test("a turn reaches the CLI with relay env, and its frames arrive as chunks", async () => {
  const cwd = scratch();
  const adapter = makeAdapter({
    extraEnv: { FAKE_CLAUDE_MODE: "answer", FAKE_EXPECT_BASE: "https://relay.test", FAKE_EXPECT_KEY: "sk-test" },
  });
  const chunks = await drain(adapter, userTurnOptions("hello relay", { sessionId: "s-e2e" }));
  const blocks = chunks.filter((c) => c.type === "block-end").map((c) => c.block);
  const text = blocks.map((b) => (b.type === "text" ? b.text : "")).join("");
  assert.ok(text.startsWith("env-ok:hello relay::"), `relay env verified in text: ${text}`);
  assert.ok(text.includes("--session-id"), "first turn opens a session");
  assert.ok(!text.includes("--resume"));
  assert.ok(blocks.some((b) => b.type === "reasoning" && b.text.includes("▸ Bash")));
  assert.ok(blocks.some((b) => b.type === "reasoning" && b.text.includes("◂ Bash file1 file2")));
  const usage = chunks.find((c) => c.type === "usage");
  assert.deepEqual(usage.usage, { inputTokens: 11, outputTokens: 7, cacheReadTokens: 3, cacheWriteTokens: 5 });
  const finish = chunks.at(-1);
  assert.deepEqual(finish.reason, { kind: "stop" });
  assert.equal(chunks.filter((c) => c.type === "finish").length, 1, "exactly one finish, nothing after");
});

test("a compaction turn stays legible: window injected, boundary and summary rendered", async () => {
  const adapter = makeAdapter({
    contextWindow: 400000,
    extraEnv: { FAKE_CLAUDE_MODE: "compact", FAKE_EXPECT_BASE: "https://relay.test", FAKE_EXPECT_KEY: "sk-test" },
  });
  const chunks = await drain(adapter, userTurnOptions("a long conversation", { sessionId: "s-compact" }));
  const blocks = chunks.filter((c) => c.type === "block-end").map((c) => c.block);
  // The CLI was told to compact at 0.7 × the advertised window — strictly before dsh's own 0.8.
  assert.equal(blocks.find((b) => b.type === "text")?.text, "compact-window=280000");
  // The boundary and the continuation summary are both visible, in order, as reasoning notes.
  const boundary = blocks.findIndex((b) => b.type === "reasoning" && /context compacted auto/.test(b.text));
  const summary = blocks.findIndex((b) => b.type === "reasoning" && /compacted summary/.test(b.text));
  const answer = blocks.findIndex((b) => b.type === "text");
  assert.ok(boundary >= 0, `boundary note rendered: ${JSON.stringify(blocks)}`);
  assert.match(blocks[boundary].text, /280000 → 4096 tokens/);
  assert.match(blocks[boundary].text, /61\.2s/);
  assert.ok(summary > boundary, "the summary follows the boundary");
  assert.ok(answer > summary, "the answer follows the summary");
  assert.deepEqual(chunks.at(-1).reason, { kind: "stop" });
});

test("a session rides one resident process; after the host restarts it resumes from the transcript", async () => {
  const cwd = scratch();
  const env = { FAKE_CLAUDE_MODE: "answer", FAKE_EXPECT_BASE: "https://relay.test", FAKE_EXPECT_KEY: "sk-test" };
  const adapter = makeAdapter({ extraEnv: env, configDir: cwd });
  const textOf = (chunks) =>
    chunks.filter((c) => c.type === "block-end" && c.block.type === "text").map((c) => c.block.text).join("");
  const pidOf = (text) => /pid=(\d+)/.exec(text)?.[1];

  // Turn 1, no transcript yet: a fresh session opens with --session-id.
  const first = await drain(adapter, userTurnOptions("one", { sessionId: "s-resume" }));
  const firstText = textOf(first);
  assert.ok(firstText.includes("--session-id"), "first turn opens a session");
  const pid1 = pidOf(firstText);
  assert.ok(pid1, `answer carries the process pid: ${firstText}`);

  // Turn 2 rides the same warm process — no new spawn, so one pid answers both turns — and
  // sends only the new user turn, not the conversation again.
  const second = await drain(adapter, userTurnOptions("two", { sessionId: "s-resume" }));
  const secondText = textOf(second);
  assert.equal(pidOf(secondText), pid1, "the resident was reused, not respawned");
  assert.ok(secondText.startsWith("env-ok:two::"), `only the new turn went out: ${secondText}`);

  // A host restart loses the resident; the transcript the CLI wrote is the recovery point, so
  // turn 3 spawns a new process that --resumes the derived session id.
  adapter.disposeResidents();
  const claudeId = claudeSessionId("s-resume");
  const transcript = transcriptPath(cwd, process.cwd(), claudeId);
  mkdirSync(dirname(transcript), { recursive: true });
  writeFileSync(transcript, "{}");
  // The cwd the adapter uses is process.cwd() (sessions.get returns undefined in this test ctx);
  // place the transcript where the adapter looks for that cwd.
  const third = await drain(adapter, userTurnOptions("three", { sessionId: "s-resume" }));
  const thirdText = textOf(third);
  assert.ok(thirdText.includes("--resume"), `resume used: ${thirdText}`);
  assert.ok(thirdText.includes(claudeId));
  assert.notEqual(pidOf(thirdText), pid1, "a fresh process after the restart");
});

test("a per-turn option change respawns the resident; a finished turn parks it alive", async () => {
  const adapter = makeAdapter({
    extraEnv: { FAKE_CLAUDE_MODE: "answer", FAKE_EXPECT_BASE: "https://relay.test", FAKE_EXPECT_KEY: "sk-test" },
  });
  const textOf = (chunks) =>
    chunks.filter((c) => c.type === "block-end" && c.block.type === "text").map((c) => c.block.text).join("");
  const pidOf = (text) => /pid=(\d+)/.exec(text)?.[1];

  const first = await drain(adapter, userTurnOptions("one", { sessionId: "s-opt" }));
  const pid1 = pidOf(textOf(first));
  // The resident survives its turn parked in the map, not killed like a one-shot child.
  const resident = adapter.residents.get("s-opt");
  assert.ok(resident?.alive, "the resident is parked alive after the turn");

  // The model is baked in at spawn time, so a different model must not ride the old process.
  const second = await drain(adapter, userTurnOptions("two", { sessionId: "s-opt", model: "claude-opus-4-6" }));
  const secondText = textOf(second);
  assert.notEqual(pidOf(secondText), pid1, "a model change respawns the resident");
  assert.ok(secondText.includes("--model"), `spawn args seen by the answer: ${secondText}`);
});

test("a second turn on a session whose resident is mid-turn is refused, not interleaved", async () => {
  const adapter = makeAdapter({ extraEnv: { FAKE_CLAUDE_MODE: "hang" }, idleTimeoutMs: 600000 });
  const controller = new AbortController();
  const options = userTurnOptions("slow", { sessionId: "s-busy", signal: controller.signal });
  // Park the generator inside the (silent) first turn.
  const pending = adapter.stream(options).next();
  await new Promise((r) => setTimeout(r, 200));
  await assert.rejects(
    () => drain(adapter, userTurnOptions("again", { sessionId: "s-busy" })),
    /turn in flight/,
  );
  controller.abort();
  await pending;
});

test("a stale --resume retries once with a fresh session and finishes the turn", async () => {
  const cwd = scratch();
  const adapter = makeAdapter({
    extraEnv: {
      FAKE_CLAUDE_MODE: "stale",
      FAKE_STATE_DIR: cwd,
      FAKE_EXPECT_BASE: "https://relay.test",
      FAKE_EXPECT_KEY: "sk-test",
    },
    configDir: cwd,
  });
  // Make the adapter believe the session exists so the first spawn uses --resume and fails stale.
  const claudeId = claudeSessionId("s-stale");
  const transcript = transcriptPath(cwd, process.cwd(), claudeId);
  mkdirSync(dirname(transcript), { recursive: true });
  writeFileSync(transcript, "{}");
  const chunks = await drain(adapter, userTurnOptions("again", { sessionId: "s-stale" }));
  const finish = chunks.at(-1);
  assert.deepEqual(finish.reason, { kind: "stop" }, "the retry answered the turn");
  const text = chunks.filter((c) => c.type === "block-end" && c.block.type === "text").map((c) => c.block.text).join("");
  assert.ok(text.includes("env-ok:again"), `answered on retry: ${text}`);
});

test("an exit without a result frame becomes a provider error naming the exit", async () => {
  const adapter = makeAdapter({ extraEnv: { FAKE_CLAUDE_MODE: "noresult" } });
  const chunks = await drain(adapter, userTurnOptions("q"));
  const finish = chunks.at(-1);
  assert.equal(finish.type, "finish");
  assert.equal(finish.reason.kind, "error");
  assert.match(finish.reason.failure.message, /claude exited 0/);
  assert.equal(finish.reason.failure.code, "PROVIDER_ERROR");
});

test("a refused CLI flag surfaces its name in the failure", async () => {
  const adapter = makeAdapter({ extraEnv: { FAKE_CLAUDE_MODE: "denied" }, extraArgs: ["--nope"] });
  const chunks = await drain(adapter, userTurnOptions("q"));
  const finish = chunks.at(-1);
  assert.equal(finish.reason.kind, "error");
  assert.match(finish.reason.failure.message, /unknown option '--nope'/);
  assert.match(finish.reason.failure.message, /does not support --nope/);
});

test("an auth failure names the credential, not just the raw error", async () => {
  const adapter = makeAdapter({ extraEnv: { FAKE_CLAUDE_MODE: "authfail" } });
  const chunks = await drain(adapter, userTurnOptions("q"));
  const finish = chunks.at(-1);
  assert.equal(finish.reason.kind, "error");
  assert.match(finish.reason.failure.message, /rejected the credential/);
});

test("aborting a turn kills the child and finishes aborted", async () => {
  const adapter = makeAdapter({ extraEnv: { FAKE_CLAUDE_MODE: "hang" }, idleTimeoutMs: 600000 });
  const controller = new AbortController();
  const collected = [];
  const run = (async () => {
    for await (const chunk of adapter.stream(userTurnOptions("q", { signal: controller.signal })))
      collected.push(chunk);
  })();
  await new Promise((r) => setTimeout(r, 400));
  controller.abort();
  await run;
  const finish = collected.at(-1);
  assert.equal(finish.type, "finish");
  assert.equal(finish.reason.kind, "aborted");
  assert.equal(finish.reason.failure.code, "ABORTED");
});

test("the idle watchdog stops a silent child with a readable error", async () => {
  const adapter = makeAdapter({ extraEnv: { FAKE_CLAUDE_MODE: "hang" }, idleTimeoutMs: 400 });
  const chunks = await drain(adapter, userTurnOptions("q"));
  const finish = chunks.at(-1);
  assert.equal(finish.reason.kind, "error");
  assert.match(finish.reason.failure.message, /no output for 0s/);
});

test("missing relay configuration fails before any spawn", async () => {
  const adapter = makeAdapter({ baseUrl: "" });
  await assert.rejects(
    () => drain(adapter, userTurnOptions("q")),
    /not configured/,
  );
  const keyless = makeAdapter({ apiKey: "", apiKeyEnv: "" });
  await assert.rejects(() => drain(keyless, userTurnOptions("q")), /no relay API key/);
});

test("apiKeyEnv reads the key from the environment", async () => {
  process.env.CC_RELAY_TEST_KEY = "sk-from-env";
  const adapter = makeAdapter({
    apiKey: "",
    apiKeyEnv: "CC_RELAY_TEST_KEY",
    extraEnv: { FAKE_CLAUDE_MODE: "answer", FAKE_EXPECT_BASE: "https://relay.test", FAKE_EXPECT_KEY: "sk-from-env" },
  });
  const chunks = await drain(adapter, userTurnOptions("q"));
  const text = chunks.filter((c) => c.type === "block-end" && c.block.type === "text").map((c) => c.block.text).join("");
  assert.ok(text.startsWith("env-ok:q::"), text);
  delete process.env.CC_RELAY_TEST_KEY;
});

test("auxiliary calls run one-shot with the system prompt inline or appended", async () => {
  const adapter = makeAdapter({
    extraEnv: { FAKE_CLAUDE_MODE: "answer", FAKE_EXPECT_BASE: "https://relay.test", FAKE_EXPECT_KEY: "sk-test" },
  });
  const chunks = await drain(
    adapter,
    userTurnOptions("make a title", {
      purpose: "session-title",
      system: "You write short titles.",
    }),
  );
  const text = chunks.filter((c) => c.type === "block-end" && c.block.type === "text").map((c) => c.block.text).join("");
  assert.ok(text.includes("--append-system-prompt"), `system prompt forwarded: ${text}`);
  assert.ok(text.includes("--no-session-persistence"));
  assert.ok(!text.includes("--session-id"));
  assert.deepEqual(chunks.at(-1).reason, { kind: "stop" });
});

test("listModels prefers the relay's /v1/models answer and falls back on failure", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    calls += 1;
    assert.match(String(url), /\/v1\/models/);
    assert.equal(init.headers.authorization, "Bearer sk-test");
    if (calls === 1) {
      return {
        ok: true,
        json: async () => ({ data: [{ id: "up-1", display_name: "Up One" }, { id: "up-2" }] }),
      };
    }
    throw new Error("network down");
  };
  try {
    const adapter = makeAdapter({
      autoModels: true,
      models: [{ id: "fallback-model" }],
    });
    const upstream = await adapter.listModels("claude-code-relay");
    assert.deepEqual(upstream, [
      { provider: "claude-code-relay", id: "up-1", name: "Up One", inputModalities: ["text", "image"] },
      { provider: "claude-code-relay", id: "up-2", name: "up-2", inputModalities: ["text", "image"] },
    ]);
    // The cached answer serves the second call without another request.
    const cached = await adapter.listModels("claude-code-relay");
    assert.equal(cached[0].id, "up-1");
    assert.equal(calls, 1);
    // A fresh adapter whose fetch fails falls back to the configured models.
    const broken = makeAdapter({ autoModels: true, models: [{ id: "fallback-model" }] });
    broken.modelsCache = undefined;
    globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
    const fell = await broken.listModels("claude-code-relay");
    assert.deepEqual(fell, [
      { provider: "claude-code-relay", id: "fallback-model", name: "fallback-model", inputModalities: ["text", "image"] },
    ]);
    // autoModels off never asks the relay.
    let asked = 0;
    globalThis.fetch = async () => {
      asked += 1;
      throw new Error("must not be called");
    };
    const off = makeAdapter({ autoModels: false, models: [{ id: "configured" }] });
    assert.equal((await off.listModels("claude-code-relay"))[0].id, "configured");
    assert.equal(asked, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("listModels and resolveModel describe the configured catalog", async () => {
  const adapter = makeAdapter({
    models: [{ id: "model-a", name: "Model A" }, { id: "model-b" }],
    contextWindow: 128000,
  });
  const models = await adapter.listModels("claude-code-relay");
  assert.deepEqual(models, [
    { provider: "claude-code-relay", id: "model-a", name: "Model A", inputModalities: ["text", "image"] },
    { provider: "claude-code-relay", id: "model-b", name: "model-b", inputModalities: ["text", "image"] },
  ]);
  const resolved = await adapter.resolveModel("claude-code-relay", "anything-else");
  assert.equal(resolved.id, "anything-else");
  assert.deepEqual(resolved.context, { contextWindow: 128000 });
  assert.deepEqual(adapter.providerInfo("claude-code-relay"), {
    id: "claude-code-relay",
    name: "Claude Code Relay",
  });
});

test("a message queued behind a running turn is early-delivered; its turn replays the buffered answer", async () => {
  const dir = scratch();
  const state = join(dir, "state");
  const sessionId = "s-early";
  const adapter = makeAdapter(
    { extraEnv: { FAKE_STATE_DIR: state } },
    { sessions: { get: () => ({ header: { cwd: dir } }) } },
  );
  const messages = (texts) =>
    texts.map((text) => ({ role: "user", source: { kind: "user" }, content: [{ type: "text", text }] }));

  // Turn 1, consumed lazily so it is still in flight when the queue event lands.
  const gen = adapter.stream(userTurnOptions("first", { sessionId }));
  await gen.next();
  // A second message lands in dsh's next-turn inbox while turn 1 runs: the plugin hands it to the
  // running CLI right away instead of waiting for dsh's turn boundary.
  adapter.onSessionEvent(
    { id: sessionId },
    { type: "agent/inbox/spliced", data: { target: "next-turn", inserted: messages(["second"]) } },
  );
  await new Promise((r) => setTimeout(r, 50));
  const turn1 = [];
  for await (const c of gen) turn1.push(c);
  assert.ok(turn1.some((c) => c.type === "finish" && c.reason.kind === "stop"), "turn 1 finished");

  // dsh starts turn 2 for the queued message: the CLI's buffered answer is replayed, not re-sent.
  const turn2 = await drain(adapter, {
    ...userTurnOptions("second", { sessionId }),
    messages: [
      ...messages(["first"]),
      { role: "assistant", source: { kind: "model" }, content: [{ type: "text", text: "first answer" }] },
      ...messages(["second"]),
    ],
  });
  const text2 = turn2
    .filter((c) => c.type === "block-end")
    .map((c) => c.block)
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  assert.ok(text2.includes(":second::"), `turn 2 replayed the CLI's answer: ${text2}`);
  assert.ok(turn2.some((c) => c.type === "finish" && c.reason.kind === "stop"), "turn 2 finished");
  assert.equal(adapter.earlyDeliveries.get(sessionId)?.size ?? 0, 0, "delivery record consumed");

  // The CLI answered exactly twice: once for "first", once for the early-delivered "second".
  const audit = readFileSync(join(state, "answers.log"), "utf8");
  assert.equal(audit.trim().split("\n").length, 2, `exactly two runs ran: ${JSON.stringify(audit)}`);
});

test("per-model context and compact settings drive resolveModel and the CLI's compact window", async () => {
  const adapter = makeAdapter({
    contextWindow: 1000000,
    models: [{ id: "claude-opus-5-5", name: "Opus 5.5", context: 200000, compact: 140000 }],
  });
  const resolved = await adapter.resolveModel("claude-code-relay", "claude-opus-5-5");
  assert.equal(resolved.context.contextWindow, 200000, "per-model context wins");
  assert.equal(resolved.name, "Opus 5.5");
  const fallback = await adapter.resolveModel("claude-code-relay", "claude-sonnet-5");
  assert.equal(fallback.context.contextWindow, 1000000, "unlisted model falls back to the provider window");

  // The turn hands the CLI the per-model compact trigger (the fake echoes it in compact mode).
  const state = scratch();
  const compactAdapter = makeAdapter(
    {
      contextWindow: 1000000,
      models: [{ id: "claude-opus-5-5", context: 200000, compact: 140000 }],
      extraEnv: { FAKE_CLAUDE_MODE: "compact", FAKE_STATE_DIR: state },
    },
    { sessions: { get: () => ({ header: { cwd: state } }) } },
  );
  const chunks = await drain(compactAdapter, userTurnOptions("hello", { sessionId: "s-permodel", model: "claude-opus-5-5" }));
  const text = chunks
    .filter((c) => c.type === "block-end")
    .map((c) => c.block)
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("");
  assert.ok(text.includes("compact-window=140000"), `per-model compact window on the wire: ${text}`);
});

test("tool calls render as shadow-tool cards: captured results replay without re-execution", async () => {
  const state = scratch();
  const registered = [];
  const adapter = makeAdapter(
    { extraEnv: { FAKE_STATE_DIR: state } },
    {
      sessions: { get: () => ({ header: { cwd: state } }) },
      tools: { register: (t) => registered.push(t) },
    },
  );
  const sessionId = "s-cards";

  // Step 1: the turn ends on the CLI's tool call, as a real tool-call block.
  const step1 = await drain(adapter, userTurnOptions("first", { sessionId }));
  assert.equal(step1.at(-1).reason?.kind, "tool-calls", "step 1 ends with tool-calls");
  const call = step1.find((c) => c.type === "block-end" && c.block.type === "tool-call");
  assert.ok(call, "tool-call block emitted");

  // The loop "executes" the shadow tool: it replays the CLI's captured result.
  const bash = registered.find((t) => t.name === "Bash");
  assert.ok(bash, "shadow Bash registered");
  const replayed = await bash.execute({ command: "ls" }, { callId: call.block.id });
  assert.ok(replayed.text.includes("file1"), `shadow replays the captured result: ${JSON.stringify(replayed)}`);

  // Step 2 continues the same run: no new stdin line, final answer streams, turn completes.
  const step2 = await drain(adapter, {
    ...userTurnOptions("first", { sessionId }),
    messages: [
      { role: "user", source: { kind: "user" }, content: [{ type: "text", text: "first" }] },
      { role: "assistant", source: { kind: "model" }, content: [
        { type: "text", text: "working" },
        { type: "tool-call", id: call.block.id, name: "Bash", arguments: '{"command":"ls"}' },
      ] },
      { role: "user", source: { kind: "tool" }, content: [{ type: "tool-result", toolCallId: call.block.id, content: [{ type: "text", text: "file1\nfile2" }] }] },
    ],
  });
  const text2 = step2.filter((c) => c.type === "block-end").map((c) => c.block).map((b) => (b.type === "text" ? b.text : "")).join("");
  assert.ok(text2.includes(":first::"), `step 2 streams the run's answer: ${text2}`);
  assert.equal(step2.at(-1).reason?.kind, "stop", "turn completed");

  // The CLI ran exactly one run for the whole turn: step 2 did not re-send anything.
  const audit = readFileSync(join(state, "answers.log"), "utf8");
  assert.equal(audit.trim().split("\n").length, 1, `exactly one CLI run: ${JSON.stringify(audit)}`);
});
