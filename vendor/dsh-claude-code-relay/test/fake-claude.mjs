#!/usr/bin/env node
// A fake `claude` for the adapter tests, speaking the CLI's headless stream-json contract: one
// init frame per process, then one answer per stdin user line — and, like the real CLI in
// `--input-format stream-json` mode, the process stays alive between lines, which is what a
// resident process rides. One-shot callers simply close stdin and the process exits when its
// writes flush. Modes (FAKE_CLAUDE_MODE):
//   answer   stream a text answer with a tool call and its result (default)
//   compact  auto-compaction: boundary frame, synthetic summary, answer, result
//   stale    first process answers "No conversation found" once, then answers normally
//   authfail every turn answers a 401 authentication error
//   noresult init frame only, then the process dies mid-turn without a result
//   hang     init frame, then silence (the watchdog or an abort ends it)
//   denied   refuses to start: unknown option on stderr, exit 1
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const mode = process.env.FAKE_CLAUDE_MODE ?? "answer";
const stateDir = process.env.FAKE_STATE_DIR ?? ".";
const out = (obj) => process.stdout.write(`${JSON.stringify(obj)}\n`);

if (mode === "denied") {
  process.stderr.write("error: unknown option '--nope'\n");
  process.exit(1);
}
if (mode === "hang") {
  // Keep the process alive whatever happens: silence until the watchdog or an abort kills us.
  setInterval(() => {}, 1000);
}

const keyVar =
  process.env.FAKE_EXPECT_TOKEN_VAR === "ANTHROPIC_API_KEY"
    ? process.env.ANTHROPIC_API_KEY
    : process.env.ANTHROPIC_AUTH_TOKEN;
const envOk =
  process.env.ANTHROPIC_BASE_URL === (process.env.FAKE_EXPECT_BASE ?? "") &&
  keyVar === (process.env.FAKE_EXPECT_KEY ?? "") &&
  process.env.ANTHROPIC_API_KEY !== "sk-inherited";

let initialized = false;
let answered = 0;

/** The response to one stdin user line, in the wire shapes captured from the real CLI. */
function answer(turn) {
  const prompt = (turn.message?.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  if (!initialized) {
    initialized = true;
    out({ type: "system", subtype: "init", session_id: "fake-session", tools: [] });
  }
  answered += 1;
  // Answer audit trail when a state dir is provided: one line per answer, so tests can assert
  // exactly how many runs the CLI performed (an early-delivered message must not be sent twice).
  if (process.env.FAKE_STATE_DIR) {
    try {
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(join(stateDir, "answers.log"), `${answered}\t${prompt.slice(0, 40)}\n`, { flag: "a" });
    } catch {}
  }

  if (mode === "stale") {
    const marker = join(stateDir, "ran");
    if (!existsSync(marker)) {
      mkdirSync(stateDir, { recursive: true });
      writeFileSync(marker, "1");
      out({
        type: "result",
        subtype: "error_during_execution",
        is_error: true,
        result: "No conversation found with session ID like x",
      });
      return;
    }
  }
  if (mode === "authfail") {
    out({
      type: "result",
      subtype: "error_during_execution",
      is_error: true,
      api_error_status: 401,
      result: "authentication_error: invalid x-api-key",
    });
    return;
  }
  if (mode === "compact") {
    // Wire shapes captured from a real CLI run: snake_case metadata on stdout, the summary as a
    // synthetic user frame. The answer echoes the injected window so the e2e can assert it.
    out({
      type: "system",
      subtype: "compact_boundary",
      compact_metadata: {
        trigger: "auto",
        pre_tokens: 280000,
        post_tokens: 4096,
        cumulative_dropped_tokens: 275904,
        duration_ms: 61200,
      },
    });
    out({
      type: "user",
      isSynthetic: true,
      message: {
        role: "user",
        content: [
          {
            type: "text",
            text: "This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion of the conversation.",
          },
        ],
      },
    });
    const note = `compact-window=${process.env.CLAUDE_CODE_AUTO_COMPACT_WINDOW ?? "unset"}`;
    out({ type: "assistant", message: { id: `msg_compact_${answered}`, content: [{ type: "text", text: note }] } });
    out({
      type: "result",
      subtype: "success",
      is_error: false,
      result: note,
      usage: { input_tokens: 4100, output_tokens: 9, cache_read_input_tokens: 0, cache_creation_input_tokens: 4096 },
    });
    return;
  }
  if (mode === "noresult") {
    // A CLI that dies mid-turn, without a result frame.
    setTimeout(() => process.exit(0), 20);
    return;
  }
  if (mode === "hang") {
    // Init frame, then silence until the watchdog or an abort ends this process.
    return;
  }

  // The process's own pid rides every answer, so a test can tell a reused resident (same pid)
  // from a respawned one (different pid) without reaching into the adapter.
  const text = `${envOk ? "env-ok" : "env-bad"}:${prompt}::${process.argv.slice(2).join(" ")}::pid=${process.pid}`;
  // Live partials, then the whole assistant frame with the same message id (the echo case).
  const id = `msg_fake_${answered}`;
  out({ type: "stream_event", event: { type: "message_start", message: { id } } });
  out({ type: "stream_event", event: { type: "content_block_start", index: 0, content_block: { type: "text" } } });
  out({ type: "stream_event", event: { type: "content_block_delta", index: 0, delta: { text } } });
  out({ type: "stream_event", event: { type: "content_block_stop", index: 0 } });
  // A tool call the CLI "runs" itself, then its result.
  const toolId = `toolu_${answered}`;
  out({
    type: "stream_event",
    event: { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: toolId, name: "Bash" } },
  });
  out({ type: "stream_event", event: { type: "content_block_delta", index: 1, delta: { partial_json: '{"command":"ls"}' } } });
  out({ type: "stream_event", event: { type: "content_block_stop", index: 1 } });
  out({ type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: toolId, content: "file1\nfile2" }] } });
  out({ type: "assistant", message: { id, content: [{ type: "text", text }] } });
  // A nested-agent frame that must be skipped.
  out({
    type: "assistant",
    parent_tool_use_id: "toolu_0",
    message: { id: `msg_sub_${answered}`, content: [{ type: "text", text: "subagent chatter" }] },
  });
  out({
    type: "result",
    subtype: "success",
    is_error: false,
    result: text,
    usage: { input_tokens: 11, output_tokens: 7, cache_read_input_tokens: 3, cache_creation_input_tokens: 5 },
  });
}

// One answer per complete stdin line: a resident keeps the pipe open and sends turns as they
// come, a one-shot closes it after its batch and this process exits once the writes flush.
let raw = "";
process.stdin.on("data", (chunk) => {
  raw += chunk;
  let at;
  while ((at = raw.indexOf("\n")) !== -1) {
    const line = raw.slice(0, at).trim();
    raw = raw.slice(at + 1);
    if (line) answer(JSON.parse(line));
  }
});
// Stdin closing means the driver is gone (a finished one-shot, or a host that exited): linger
// briefly for the silence modes whose callers end the pipe themselves, then leave.
process.stdin.on("end", () => {
  setTimeout(() => process.exit(0), 30000).unref?.();
});
