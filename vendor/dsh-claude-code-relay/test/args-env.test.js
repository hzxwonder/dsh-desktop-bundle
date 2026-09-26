// Unit tests for argument construction and child environment wiring.

import test from "node:test";
import assert from "node:assert/strict";
import { childEnv, withClaudeDirs, resolveCommand, unknownFlagIn } from "../src/process.js";
import { buildArgs, userTurn } from "../src/index.js";

const baseConfig = {
  permissionMode: "dsh",
  maxTurns: 0,
  extraArgs: [],
  systemPrompt: true,
};

test("buildArgs assembles the print-mode stream-json command", () => {
  const { args } = buildArgs({
    model: "claude-sonnet-4-5",
    config: baseConfig,
    session: { id: "s1", resuming: false },
    accessMode: "workspace-write",
    flags: new Set(["--session-id", "--resume", "--permission-mode", "--append-system-prompt", "--include-partial-messages", "--no-session-persistence"]),
  });
  assert.deepEqual(args, [
    "-p",
    "--input-format",
    "stream-json",
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--model",
    "claude-sonnet-4-5",
    "--permission-mode",
    "acceptEdits",
    "--session-id",
    "s1",
  ]);
});

test("a resuming session uses --resume; a probed flag gap falls back silently", () => {
  const flags = new Set(["--session-id", "--resume", "--permission-mode"]);
  const { args } = buildArgs({
    model: "m",
    config: baseConfig,
    session: { id: "s1", resuming: true },
    accessMode: undefined,
    flags,
  });
  assert.ok(args.includes("--resume"));
  assert.ok(!args.includes("--include-partial-messages"));
  assert.ok(args.includes("--permission-mode", 0) || args.indexOf("--permission-mode") > 0);
  assert.ok(args.includes("acceptEdits"));
});

test("workspace-write permits the CLI's network reads through --allowedTools", () => {
  const { args } = buildArgs({
    model: "m",
    config: baseConfig,
    session: { id: "s1", resuming: true },
    accessMode: "workspace-write",
    flags: new Set(["--session-id", "--resume", "--permission-mode", "--allowedTools"]),
  });
  const at = args.indexOf("--allowedTools");
  assert.notEqual(at, -1, "--allowedTools present");
  assert.equal(args[at + 1], "WebFetch,WebSearch");
  // read-only keeps its exclusive allowlist, with the network tools on top of it.
  const ro = buildArgs({
    model: "m",
    config: baseConfig,
    accessMode: "read-only",
    flags: new Set(["--permission-mode", "--allowedTools", "--disallowedTools"]),
  });
  const i = ro.args.indexOf("--allowedTools");
  assert.ok(ro.args[i + 1].split(",").includes("WebFetch"));
});

test("auxiliary calls are one-shot: no tools, one turn, no session", () => {
  const { args } = buildArgs({
    model: "m",
    purpose: "session-title",
    config: baseConfig,
    session: { id: "s1", resuming: false },
    accessMode: undefined,
    flags: new Set(["--tools", "--max-turns", "--no-session-persistence"]),
  });
  assert.deepEqual(args.slice(-5), ["--tools", "", "--max-turns", "1", "--no-session-persistence"]);
  assert.ok(!args.some((a) => a === "--session-id" || a === "--resume"));
});

test("the system prompt rides --append-system-prompt, or inline when the flag is missing", () => {
  const withFlag = buildArgs({
    model: "m",
    purpose: "session-title",
    system: "write a title",
    config: baseConfig,
    flags: new Set(["--append-system-prompt"]),
  });
  assert.ok(withFlag.args.includes("--append-system-prompt"));
  assert.equal(withFlag.inlineSystem, false);

  const withoutFlag = buildArgs({
    model: "m",
    purpose: "session-title",
    system: "write a title",
    config: baseConfig,
    flags: new Set(),
  });
  assert.ok(!withoutFlag.args.includes("--append-system-prompt"));
  assert.equal(withoutFlag.inlineSystem, true);
});

test("maxTurns and extraArgs are appended to conversation turns", () => {
  const { args } = buildArgs({
    model: "m",
    config: { ...baseConfig, maxTurns: 12, extraArgs: ["--add-dir", "/tmp"] },
    flags: new Set(),
  });
  assert.deepEqual(args.slice(-4), ["--max-turns", "12", "--add-dir", "/tmp"]);
});

test("childEnv wires the relay and strips conflicting inherited values", () => {
  const env = childEnv(
    {
      PATH: "/usr/bin:/bin",
      HOME: "/home/u",
      ANTHROPIC_BASE_URL: "https://old.example.com",
      ANTHROPIC_API_KEY: "sk-old",
      ANTHROPIC_AUTH_TOKEN: "sk-taken",
      CLAUDE_CONFIG_DIR: "/elsewhere",
      MY_TOOL_SETTING: "keep",
    },
    {
      baseUrl: "https://relay.example.com",
      apiKey: "sk-relay",
      authHeader: "auth-token",
      configDir: "",
      extraEnv: { API_TIMEOUT_MS: "600000" },
    },
  );
  assert.equal(env.ANTHROPIC_BASE_URL, "https://relay.example.com");
  assert.equal(env.ANTHROPIC_AUTH_TOKEN, "sk-relay");
  assert.equal(env.ANTHROPIC_API_KEY, undefined, "inherited key stripped");
  assert.equal(env.CLAUDE_CONFIG_DIR, undefined, "inherited config dir stripped");
  assert.equal(env.MY_TOOL_SETTING, "keep");
  assert.equal(env.API_TIMEOUT_MS, "600000");
  assert.equal(env.CLAUDE_CODE_ENTRYPOINT, "dsh-claude-code-relay");
  assert.equal(env.DISABLE_AUTOUPDATER, "1");
  assert.ok(env.PATH.startsWith("/usr/bin:/bin"));
});

test("childEnv honors the api-key style and a config dir", () => {
  const env = childEnv(
    {},
    {
      baseUrl: "https://r",
      apiKey: "sk-2",
      authHeader: "api-key",
      configDir: "/isolated/.claude",
      extraEnv: {},
    },
  );
  assert.equal(env.ANTHROPIC_API_KEY, "sk-2");
  assert.equal(env.ANTHROPIC_AUTH_TOKEN, undefined);
  assert.equal(env.CLAUDE_CONFIG_DIR, "/isolated/.claude");
});

test("userTurn wraps the prompt and base64 images in one stream-json line", () => {
  const turn = userTurn("look", [{ mediaType: "image/png", data: "AAAA" }]);
  assert.equal(turn.type, "user");
  assert.equal(turn.session_id, "");
  assert.deepEqual(turn.message.content, [
    { type: "text", text: "look" },
    { type: "image", source: { type: "base64", media_type: "image/png", data: "AAAA" } },
  ]);
  assert.equal(turn.parent_tool_use_id, null);
});

test("withClaudeDirs appends only missing dirs; resolveCommand finds a bare name", () => {
  assert.equal(withClaudeDirs("/a:/b", ["/b", "/c"]), "/a:/b:/c");
  assert.equal(withClaudeDirs(undefined, ["/x"]), "/x");
  assert.equal(resolveCommand("/abs/claude", undefined, "darwin"), "/abs/claude");
  assert.equal(resolveCommand("definitely-not-a-cli-xyz", "/nonexistent", "darwin"), "definitely-not-a-cli-xyz");
});

test("unknownFlagIn reads the refused flag out of a CLI error", () => {
  assert.equal(unknownFlagIn("error: unknown option '--nope'"), "--nope");
  assert.equal(unknownFlagIn("nothing here"), undefined);
});
