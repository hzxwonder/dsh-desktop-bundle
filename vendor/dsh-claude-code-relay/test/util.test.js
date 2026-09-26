// Unit tests for the pure helpers of src/util.js.

import test from "node:test";
import assert from "node:assert/strict";
import {
  accessModeOf,
  accessPolicyFor,
  buildPrompt,
  claudeSessionId,
  compactWindowFor,
  imageRefsOf,
  projectDirName,
  promptMessages,
  selectTurns,
  textOf,
  toolCallLine,
  toolResultLine,
  transcriptPath,
  withCompactWindow,
  SESSION_SALT,
} from "../src/util.js";

test("claudeSessionId derives a stable UUID-shaped id, salted away from other providers", () => {
  const id = claudeSessionId("session-1");
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(claudeSessionId("session-1"), id);
  assert.notEqual(claudeSessionId("session-2"), id);
  // The salt must differ from dsh-oh-my-claude's, or two plugins collide on one dsh session.
  assert.notEqual(claudeSessionId("session-1", "dsh-llm-claude"), id);
  assert.equal(SESSION_SALT, "dsh-claude-code-relay");
});

test("projectDirName and transcriptPath follow Claude Code's layout", () => {
  assert.equal(projectDirName("/Users/xu/work/my repo"), "-Users-xu-work-my-repo");
  assert.equal(
    transcriptPath("/home/u/.claude", "/home/u/proj", "abc"),
    "/home/u/.claude/projects/-home-u-proj/abc.jsonl",
  );
});

test("textOf reads strings and text blocks", () => {
  assert.equal(textOf("hello"), "hello");
  assert.equal(textOf([{ type: "text", text: "a" }, { type: "image" }, { type: "text", text: "b" }]), "a\nb");
  assert.equal(textOf(undefined), "");
});

test("selectTurns keeps user prose and assistant turns, drops tool results", () => {
  const messages = [
    { role: "system", content: "system prompt" },
    { role: "user", source: { kind: "user" }, content: "first" },
    { role: "assistant", source: { kind: "model" }, content: [{ type: "text", text: "hi" }] },
    { role: "user", source: { kind: "tool" }, content: "tool output" },
    { role: "user", source: { kind: "user" }, content: "second" },
  ];
  const fresh = selectTurns(messages, false);
  assert.equal(fresh.length, 3);
  assert.ok(!fresh.some((m) => m.source?.kind === "tool"));
  const resumed = selectTurns(messages, true);
  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].content, "second");
});

test("buildPrompt labels roles only when an assistant turn is in the batch", () => {
  assert.equal(buildPrompt([{ role: "user", content: "hello" }]), "hello");
  const multi = [
    { role: "user", content: "q" },
    { role: "assistant", content: [{ type: "text", text: "a" }] },
    { role: "user", content: "next" },
  ];
  assert.equal(buildPrompt(multi), "[user]\nq\n\n[assistant]\na\n\n[user]\nnext");
});

test("buildPrompt turns an attachment-only turn into a placeholder and rejects an empty one", () => {
  assert.equal(
    buildPrompt([{ role: "user", content: [{ type: "image", attachment: {} }] }]),
    "(see attached)",
  );
  assert.throws(() => buildPrompt([]), /no user message/);
});

test("promptMessages keeps one entry per turn, so the CLI sees real boundaries", () => {
  const messages = promptMessages([
    { role: "user", content: "q" },
    { role: "assistant", content: [{ type: "text", text: "a" }] },
    { role: "user", content: "next" },
  ]);
  assert.deepEqual(messages, [
    { role: "user", text: "q" },
    { role: "assistant", text: "a" },
    { role: "user", text: "next" },
  ]);
  // Text-free entries drop out rather than sending empty messages to the CLI.
  assert.deepEqual(promptMessages([{ role: "user", content: [] }, { role: "user", content: "hi" }]), [
    { role: "user", text: "hi" },
  ]);
  // An attachment-only turn still needs a user message carrying text.
  assert.deepEqual(promptMessages([{ role: "user", content: [{ type: "image", attachment: {} }] }]), [
    { role: "user", text: "(see attached)" },
  ]);
  assert.throws(() => promptMessages([]), /no user message/);
});

test("imageRefsOf collects user image attachments, newest last, capped", () => {
  const img = { type: "image", attachment: { attachmentId: "a" } };
  const turns = [
    { role: "assistant", content: [{ type: "image", attachment: {} }] },
    { role: "user", content: ["text", img] },
  ];
  assert.deepEqual(imageRefsOf(turns), [{ attachmentId: "a" }]);
  const many = Array.from({ length: 30 }, (_, i) => ({
    role: "user",
    content: [{ type: "image", attachment: { attachmentId: String(i) } }],
  }));
  assert.equal(imageRefsOf(many).length, 20);
  assert.equal(imageRefsOf(many)[0].attachmentId, "10");
});

test("accessModeOf reads the last runtime-context snapshot", () => {
  const messages = [
    { role: "user", content: "Current DSH file policy: read-only" },
    { role: "assistant", content: "ok" },
    { role: "user", content: "Current DSH file policy: workspace-write" },
  ];
  assert.equal(accessModeOf(messages), "workspace-write");
  assert.equal(accessModeOf([]), undefined);
});

test("accessPolicyFor maps the shield to a mode plus the tool lists that enforce it", () => {
  const config = { permissionMode: "dsh" };
  // read-only must not lean on the CLI's interactive gate: a -p child cannot answer it, so the
  // mutating tools are named instead and the turn proceeds.
  const readOnly = accessPolicyFor(config, "read-only", new Set(["--permission-mode", "--allowedTools", "--disallowedTools"]));
  assert.equal(readOnly.mode, "default");
  assert.ok(readOnly.allowed.includes("Read"));
  assert.ok(readOnly.allowed.includes("Grep"));
  assert.ok(readOnly.disallowed.includes("Edit"));
  assert.ok(readOnly.disallowed.includes("Bash"));

  assert.equal(accessPolicyFor(config, "workspace-write", new Set(["--permission-mode"])).mode, "acceptEdits");
  assert.equal(accessPolicyFor(config, "danger-full-access", new Set(["--permission-mode"])).mode, "bypassPermissions");
  assert.equal(accessPolicyFor(config, undefined, new Set(["--permission-mode"])).mode, "acceptEdits");

  // workspace-write keeps the bridge allow-everything-else, but hands the CLI its network reads:
  // WebFetch/WebSearch gate on a permission prompt no -p child can answer.
  const workspace = accessPolicyFor(config, "workspace-write", new Set(["--permission-mode", "--allowedTools"]));
  assert.deepEqual(workspace.allowed, []);
  assert.deepEqual(workspace.permit, ["WebFetch", "WebSearch"]);
});

test("a fixed permission mode overrides the shield and drops its tool lists", () => {
  const policy = accessPolicyFor({ permissionMode: "dontAsk" }, "read-only", new Set(["--permission-mode"]));
  assert.equal(policy.mode, "dontAsk");
  assert.deepEqual(policy.allowed, []);
  assert.deepEqual(policy.permit, []);
  assert.deepEqual(policy.disallowed, []);
});

test("an older CLI without a flag gets no flag, not a failed spawn", () => {
  const policy = accessPolicyFor({ permissionMode: "dsh" }, "read-only", new Set([]));
  assert.equal(policy.mode, undefined);
  // The lists survive so the caller can still emit them when only --permission-mode is missing.
  assert.ok(policy.disallowed.includes("Edit"));
});

test("tool call lines name the tool and the argument that identifies it", () => {
  assert.equal(toolCallLine("Bash", '{"command":"ls -la"}'), "▸ Bash ls -la");
  assert.equal(toolCallLine("Read", '{"file_path":"/tmp/a.js"}'), "▸ Read /tmp/a.js");
  assert.equal(toolCallLine("Grep", '{"pattern":"foo","path":"src"}'), "▸ Grep foo");
  // An Edit says how much changed instead of pasting the replacement text.
  assert.equal(
    toolCallLine("Edit", JSON.stringify({ file_path: "/a.js", old_string: "x", new_string: "y\nz" })),
    "▸ Edit /a.js +2 −1",
  );
  // An unknown tool still says something rather than nothing.
  assert.ok(toolCallLine("Mystery", '{"a":1}').startsWith("▸ Mystery "));
  // Malformed or truncated JSON is not an error here.
  assert.equal(toolCallLine("Bash", "{not json"), "▸ Bash {}");
});

test("tool results are single-line, error-marked, and budgeted per tool", () => {
  assert.equal(toolResultLine("Read", "ok", false), "◂ Read ok");
  assert.equal(toolResultLine("Bash", "", true), "✗ Bash failed");
  assert.ok(toolResultLine("Bash", `line1\nline2`, false).includes("line1 line2"));
  // Bash output gets a wider budget than a file dump, so a command's result stays readable.
  const long = "x".repeat(2000);
  assert.ok(toolResultLine("Bash", long, false).length > toolResultLine("Read", long, false).length);
  // Both ends survive the clip: the head identifies, the tail usually carries the failure.
  const tail = toolResultLine("Bash", `${"a".repeat(900)}THE-END`, false);
  assert.ok(tail.includes("THE-END"));
  assert.ok(tail.length < 600);
});

test("the auto-compact window stays strictly inside dsh's own compaction threshold", () => {
  // 0.7 × the advertised window for every realistic window, clamped to the CLI's 100K–1M range.
  assert.equal(compactWindowFor(200000), 140000);
  assert.equal(compactWindowFor(1000000), 700000);
  assert.equal(compactWindowFor(400000), 280000);
  // Below the CLI's floor the clamp applies — documented as the one place the order can invert.
  assert.equal(compactWindowFor(120000), 100000);
  assert.equal(compactWindowFor(30000000), 1000000);
  // Garbage falls back to the default window, not NaN.
  assert.equal(compactWindowFor(undefined), 140000);
  assert.equal(compactWindowFor("junk"), 140000);
});

test("withCompactWindow sets the env var only when the user has not chosen one", () => {
  assert.equal(withCompactWindow({}, 200000).CLAUDE_CODE_AUTO_COMPACT_WINDOW, "140000");
  const chosen = { CLAUDE_CODE_AUTO_COMPACT_WINDOW: "250000" };
  assert.equal(withCompactWindow(chosen, 200000).CLAUDE_CODE_AUTO_COMPACT_WINDOW, "250000");
});
