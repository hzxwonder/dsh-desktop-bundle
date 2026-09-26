// Unit tests for the stream-json → dsh StreamChunk translator.

import test from "node:test";
import assert from "node:assert/strict";
import { RelayTranslator, finishReason, isStaleResume, usageOf } from "../src/translate.js";

/** Drain a translator over frames into a chunk list. */
const run = (frames, opts) => {
  const tr = new RelayTranslator(opts ?? {});
  const chunks = [];
  for (const frame of frames) for (const c of tr.handle(frame)) chunks.push(c);
  return { tr, chunks };
};

/** One whole block squeezed out of a chunk run. */
const blocksOf = (chunks) =>
  chunks.filter((c) => c.type === "block-end").map((c) => c.block);

const textFrame = (text, id = "m1") => ({
  type: "assistant",
  message: { id, content: [{ type: "text", text }] },
});

test("a whole assistant text frame becomes one text block", () => {
  const { tr, chunks } = run([textFrame("hello")]);
  assert.deepEqual(blocksOf(chunks), [{ type: "text", text: "hello" }]);
  assert.equal(tr.finished, false);
  const indexes = new Set(chunks.filter((c) => c.type.startsWith("text-delta")).map((c) => c.index));
  assert.ok(indexes.size <= 1, "one block index");
});

test("thinking becomes a reasoning block and tool_use a reasoning note", () => {
  const { chunks } = run([
    {
      type: "assistant",
      message: {
        id: "m1",
        content: [
          { type: "thinking", thinking: "pondering" },
          { type: "tool_use", id: "t1", name: "Bash", input: { command: "ls" } },
        ],
      },
    },
  ]);
  assert.deepEqual(blocksOf(chunks), [
    { type: "reasoning", text: "pondering" },
    { type: "reasoning", text: "▸ Bash ls" },
  ]);
});

test("a tool_result user frame names its tool and carries the error flag", () => {
  const { chunks } = run([
    { type: "assistant", message: { id: "m1", content: [{ type: "tool_use", id: "t1", name: "Bash", input: {} }] } },
    { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: "t1", content: "boom", is_error: true }] } },
  ]);
  const blocks = blocksOf(chunks);
  assert.equal(blocks.at(-1).type, "reasoning");
  assert.equal(blocks.at(-1).text, "✗ Bash boom");
});

test("a compact_boundary system frame becomes a visible note with the token counts", () => {
  // Wire shape captured from a real CLI run: snake_case on stdout.
  const { chunks } = run([
    {
      type: "system",
      subtype: "compact_boundary",
      compact_metadata: { trigger: "auto", pre_tokens: 117766, post_tokens: 1705, duration_ms: 33247 },
    },
  ]);
  const blocks = blocksOf(chunks);
  assert.equal(blocks.length, 1);
  assert.match(blocks[0].text, /context compacted auto/);
  assert.match(blocks[0].text, /117766 → 1705 tokens/);
  assert.match(blocks[0].text, /33\.2s/);
});

test("compact_boundary tolerates the transcript file's camelCase spelling", () => {
  const { chunks } = run([
    {
      type: "system",
      subtype: "compact_boundary",
      compactMetadata: { trigger: "auto", preTokens: 141136, postTokens: 12030 },
    },
  ]);
  assert.match(blocksOf(chunks)[0].text, /141136 → 12030 tokens/);
});

test("state notes render even when tool activity is hidden", () => {
  const { chunks } = run(
    [
      {
        type: "system",
        subtype: "compact_boundary",
        compact_metadata: { trigger: "auto", pre_tokens: 10, post_tokens: 2 },
      },
    ],
    { toolActivity: false },
  );
  assert.equal(blocksOf(chunks).length, 1);
});

test("the bridge's compact_started notice becomes a pause-explaining note", () => {
  const { chunks } = run([{ type: "system", subtype: "compact_started", trigger: "auto" }]);
  const text = blocksOf(chunks)[0].text;
  assert.match(text, /compacting context \(auto\)/);
  assert.match(text, /pause/);
});

test("the post-compaction summary frame is a note, not a tool result", () => {
  // Shape captured from a real run: isSynthetic marks the CLI's own continuation message.
  const { chunks } = run([
    {
      type: "user",
      isSynthetic: true,
      message: {
        role: "user",
        content: [
          {
            type: "text",
            text: "This session is being continued from a previous conversation that ran out of context. The summary below covers the earlier portion.",
          },
        ],
      },
    },
  ]);
  const blocks = blocksOf(chunks);
  assert.equal(blocks.length, 1);
  assert.match(blocks[0].text, /compacted summary/);
  assert.ok(!/[◂✗] /.test(blocks[0].text), "not rendered as a tool result line");
});

test("an api_retry system frame becomes a retry note with whatever fields it carries", () => {
  const withFields = run([
    { type: "system", subtype: "api_retry", attempt: 2, delay_ms: 1500, error: "upstream 503" },
  ]);
  assert.match(blocksOf(withFields.chunks)[0].text, /#2/);
  assert.match(blocksOf(withFields.chunks)[0].text, /in 1500ms/);
  assert.match(blocksOf(withFields.chunks)[0].text, /upstream 503/);
  const bare = run([{ type: "system", subtype: "api_retry" }]);
  assert.match(blocksOf(bare.chunks)[0].text, /relay retry/);
});

test("unknown system subtypes stay silent", () => {
  const { chunks } = run([{ type: "system", subtype: "thinking_tokens" }]);
  assert.equal(blocksOf(chunks).length, 0);
});

test("tool activity can be silenced", () => {
  const { chunks } = run(
    [{ type: "assistant", message: { id: "m1", content: [{ type: "tool_use", id: "t1", name: "Bash", input: {} }] } }],
    { toolActivity: false },
  );
  assert.deepEqual(blocksOf(chunks), []);
});

test("partial frames stream deltas and the assistant echo of the same id is dropped", () => {
  const id = "msg_9";
  const { chunks } = run([
    { type: "stream_event", event: { type: "message_start", message: { id } } },
    { type: "stream_event", event: { type: "content_block_start", index: 0, content_block: { type: "text" } } },
    { type: "stream_event", event: { type: "content_block_delta", index: 0, delta: { text: "he" } } },
    { type: "stream_event", event: { type: "content_block_delta", index: 0, delta: { text: "llo" } } },
    { type: "stream_event", event: { type: "content_block_stop", index: 0 } },
    textFrame("hello", id),
  ]);
  const deltas = chunks.filter((c) => c.type === "text-delta");
  assert.deepEqual(deltas.map((d) => d.text), ["he", "llo"]);
  assert.equal(deltas.every((d) => d.index === deltas[0].index), true);
  assert.deepEqual(blocksOf(chunks), [{ type: "text", text: "hello" }], "echo dropped, block closed once");
});

test("a partial tool_use emits its call note at stop, from accumulated partial_json", () => {
  const { chunks } = run([
    { type: "stream_event", event: { type: "message_start", message: { id: "m" } } },
    { type: "stream_event", event: { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "t9", name: "Read" } } },
    { type: "stream_event", event: { type: "content_block_delta", index: 1, delta: { partial_json: '{"path":"a' } } },
    { type: "stream_event", event: { type: "content_block_delta", index: 1, delta: { partial_json: '.txt"}' } } },
    { type: "stream_event", event: { type: "content_block_stop", index: 1 } },
  ]);
  assert.deepEqual(blocksOf(chunks), [{ type: "reasoning", text: '▸ Read {"path":"a.txt"}' }]);
});

test("nested-agent frames render as indented lines under the agent's run", () => {
  const { chunks } = run([
    { type: "assistant", message: { id: "m1", content: [{ type: "tool_use", id: "t0", name: "Task", input: { description: "count files", subagent_type: "general-purpose", prompt: "do it" } }] } },
    { type: "assistant", parent_tool_use_id: "t0", message: { id: "sub", content: [{ type: "text", text: "half done" }] } },
    { type: "assistant", parent_tool_use_id: "t0", message: { id: "sub", content: [{ type: "text", text: "half done" }] } },
    { type: "assistant", parent_tool_use_id: "t0", message: { id: "sub2", content: [{ type: "tool_use", id: "x", name: "Bash", input: { command: "ls" } }] } },
    { type: "user", parent_tool_use_id: "t0", message: { content: [{ type: "tool_result", tool_use_id: "x", content: "a.txt" }] } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t0", content: "2 files <usage>subagent_tokens: 900</usage>" }] } },
  ]);
  const texts = blocksOf(chunks).filter((b) => b.type === "reasoning").map((b) => b.text);
  assert.deepEqual(texts, [
    "▸ Task · general-purpose · count files",
    "  ↳ half done",
    "  ↳ ▸ Bash ls",
    "  ↳ ◂ Bash a.txt",
    "◂ Task · general-purpose 2 files (subagent_tokens: 900)",
  ]);
});

test("nested partial frames stream the agent's message live with an indent prefix", () => {
  const { chunks } = run([
    { type: "stream_event", parent_tool_use_id: "t0", event: { type: "message_start", message: { id: "sub" } } },
    { type: "stream_event", parent_tool_use_id: "t0", event: { type: "content_block_start", index: 0, content_block: { type: "text" } } },
    { type: "stream_event", parent_tool_use_id: "t0", event: { type: "content_block_delta", index: 0, delta: { text: "work" } } },
    { type: "stream_event", parent_tool_use_id: "t0", event: { type: "content_block_delta", index: 0, delta: { text: "ing" } } },
    { type: "stream_event", parent_tool_use_id: "t0", event: { type: "content_block_stop", index: 0 } },
  ]);
  const deltas = chunks.filter((c) => c.type === "reasoning-delta");
  assert.deepEqual(deltas.map((d) => d.text), ["  ↳ ", "work", "ing"]);
  assert.deepEqual(blocksOf(chunks), [{ type: "reasoning", text: "  ↳ working" }]);
});

test("nested activity obeys toolActivity=false and the per-run line budget", () => {
  const frame = (i) => ({ type: "assistant", parent_tool_use_id: "t0", message: { id: `s${i}`, content: [{ type: "text", text: `line ${i}` }] } });
  const hidden = run(Array.from({ length: 60 }, (_, i) => frame(i)), { toolActivity: false });
  assert.deepEqual(blocksOf(hidden.chunks), []);
  const { chunks } = run(Array.from({ length: 60 }, (_, i) => frame(i)));
  const texts = blocksOf(chunks).map((b) => b.text);
  assert.equal(texts.length, 41, "40 lines + one collapse marker");
  assert.equal(texts.at(-1), "  ↳ … (further agent activity hidden)");
});

test("an Agent-named streamed tool_use stores its args for the result line", () => {
  const { chunks } = run([
    { type: "stream_event", event: { type: "message_start", message: { id: "m" } } },
    { type: "stream_event", event: { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "t0", name: "Agent" } } },
    { type: "stream_event", event: { type: "content_block_delta", index: 1, delta: { partial_json: '{"subagent_type":"general-purpose","description":"Echo test"}' } } },
    { type: "stream_event", event: { type: "content_block_stop", index: 1 } },
    { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t0", content: "subagent-ok" }] } },
  ]);
  const texts = blocksOf(chunks).map((b) => b.text);
  assert.deepEqual(texts, [
    "▸ Agent · general-purpose · Echo test",
    "◂ Agent · general-purpose subagent-ok",
  ]);
});

test("the result frame emits usage before the terminal finish and nothing after", () => {
  const { tr, chunks } = run([
    textFrame("done"),
    { type: "result", subtype: "success", is_error: false, usage: { input_tokens: 10, output_tokens: 4, cache_read_input_tokens: 2, cache_creation_input_tokens: 3 } },
  ]);
  const finish = chunks.at(-1);
  assert.equal(finish.type, "finish");
  assert.deepEqual(finish.reason, { kind: "stop" });
  const usage = chunks[chunks.length - 2];
  assert.equal(usage.type, "usage");
  assert.deepEqual(usage.usage, {
    inputTokens: 10,
    outputTokens: 4,
    cacheReadTokens: 2,
    cacheWriteTokens: 3,
  });
  assert.equal(tr.finished, true);
});

test("finishReason maps errors, auth failures, and max_tokens", () => {
  assert.deepEqual(finishReason({ is_error: true, result: "boom" }), {
    kind: "error",
    failure: { message: "boom", code: "PROVIDER_ERROR" },
  });
  const auth = finishReason({ is_error: true, api_error_status: 401, result: "authentication_error: bad key" });
  assert.match(auth.failure.message, /rejected the credential/);
  assert.deepEqual(finishReason({ is_error: false, stop_reason: "max_tokens" }), { kind: "max-tokens" });
  assert.deepEqual(finishReason({ is_error: false }), { kind: "stop" });
});

test("usageOf leaves cache counters out when the frame has none", () => {
  assert.deepEqual(usageOf({ input_tokens: 5, output_tokens: 1 }), { inputTokens: 5, outputTokens: 1 });
  assert.equal(usageOf(undefined), undefined);
});

test("isStaleResume recognizes the missing-conversation result", () => {
  assert.equal(isStaleResume({ type: "result", is_error: true, result: "No conversation found with session ID x" }), true);
  assert.equal(isStaleResume({ type: "result", is_error: true, result: "other" }), false);
  assert.equal(isStaleResume({ type: "assistant" }), false);
});

test("a message that never stopped closes its open blocks at the next message_start", () => {
  const { chunks } = run([
    { type: "stream_event", event: { type: "message_start", message: { id: "a" } } },
    { type: "stream_event", event: { type: "content_block_start", index: 0, content_block: { type: "text" } } },
    { type: "stream_event", event: { type: "content_block_delta", index: 0, delta: { text: "half" } } },
    { type: "stream_event", event: { type: "message_start", message: { id: "b" } } },
    { type: "stream_event", event: { type: "content_block_start", index: 1, content_block: { type: "text" } } },
    { type: "stream_event", event: { type: "content_block_delta", index: 1, delta: { text: "next" } } },
    { type: "stream_event", event: { type: "content_block_stop", index: 1 } },
    { type: "result", is_error: false },
  ]);
  const blocks = blocksOf(chunks);
  assert.deepEqual(blocks.map((b) => b.text), ["half", "next"]);
  // Every block-start got exactly one block-end, in order, before the finish.
  const starts = chunks.filter((c) => c.type === "block-start").length;
  const ends = chunks.filter((c) => c.type === "block-end").length;
  assert.equal(starts, ends);
});
