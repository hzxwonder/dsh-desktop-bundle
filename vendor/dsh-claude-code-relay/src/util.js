// Pure helpers of dsh-claude-code-relay: id derivation, request assembly, and formatting.
// No state, no I/O beyond node:crypto / node:path, so every function is unit-testable.

import { createHash } from "node:crypto";
import { join } from "node:path";

/** The salt that separates this plugin's Claude Code session ids from every other provider's:
 *  dsh-oh-my-claude derives ids from `dsh-llm-claude:<sessionId>`, and two plugins driving the
 *  same dsh session must never compute the same Claude session id or their transcripts collide. */
export const SESSION_SALT = "dsh-claude-code-relay";

/** A dsh session id turned into a Claude Code–style session id (UUID shape, deterministic), so the
 *  transcript path computed from it matches the one the CLI actually writes and `--resume` finds. */
export function claudeSessionId(sessionId, salt = SESSION_SALT) {
  const h = createHash("sha256").update(`${salt}:${sessionId}`).digest("hex");
  const variant = ((parseInt(h.charAt(16), 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Claude Code stores transcripts under <configDir|~/.claude>/projects/<dir>/<id>.jsonl, where
 *  <dir> is the session cwd with every non-alphanumeric byte replaced by "-". */
export function projectDirName(cwd) {
  return String(cwd).replace(/[^A-Za-z0-9]/g, "-");
}

/** Where the CLI keeps one session's transcript, given the Claude config home and the cwd. */
export function transcriptPath(claudeHome, cwd, id) {
  return join(claudeHome, "projects", projectDirName(cwd), `${id}.jsonl`);
}

// ---------------------------------------------------------------------------
// Request assembly

/** Plain text of one message's content: a plain string as-is, an array as its text blocks joined.
 *  A dsh message is read only through the fields this module touches (role, source.kind, content),
 *  so the shape stays stable across dsh minor versions. */
export function textOf(content) {
  if (!Array.isArray(content)) return typeof content === "string" ? content : "";
  return content
    .flatMap((b) => (b && b.type === "text" && typeof b.text === "string" ? [b.text] : []))
    .join("\n");
}

/** A message the prompt builder treats as conversation: a user message that is not a tool result,
 *  and every assistant message. The leading system-role message and tool-result rows are left out;
 *  Claude Code runs its own harness prompt and its own tools. */
const isTurn = (m) =>
  (m.role === "user" && m.source?.kind !== "tool") || m.role === "assistant";

/** The messages that go into this call. Resuming: only what came after the last assistant turn
 *  (the new prompt plus dsh's context injections), because Claude Code's own session history
 *  already holds everything before it. Fresh: the whole transcript, since `claude -p` is stateless
 *  without a session id. */
export function selectTurns(messages, resuming) {
  const turns = (messages ?? []).filter(isTurn);
  if (!resuming) return turns;
  let last = -1;
  for (let i = 0; i < turns.length; i++) if (turns[i]?.role === "assistant") last = i;
  return turns.slice(last + 1);
}

/** The turn as an ordered message list, each entry `{ role, text }`, plus whether it carries any
 *  image. The stream-json input takes one line per message, so a resumed fresh-session retry keeps
 *  the conversation's own turn boundaries instead of flattening them into one block of prose.
 *  Empty-text entries are dropped; assistant text is kept so a retry rebuilds the real dialogue.
 *  Throws when no user message carries text and no attachment stands in for it: the CLI needs a
 *  prompt. */
export function promptMessages(turns) {
  const messages = turns
    .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", text: textOf(m.content) }))
    .filter((t) => t.text !== "");
  // Attachment-only turns: the images ride in their own message, but the CLI still needs text.
  const attachmentOnly = turns.some(
    (m) =>
      m.role === "user" && Array.isArray(m.content) && m.content.some((b) => b && b.type !== "text"),
  );
  const hasUser = messages.some((m) => m.role === "user");
  if (!hasUser) {
    if (!attachmentOnly) throw new Error("no user message");
    messages.push({ role: "user", text: "(see attached)" });
  }
  return messages;
}

/** The plain-text rendering of {@link promptMessages}, used for the inline-system-prompt path and
 *  kept for callers that want the flattened form. A batch holding an assistant turn is labelled by
 *  role so the boundary is explicit. */
export function buildPrompt(turns) {
  const messages = promptMessages(turns);
  const multi = messages.some((m) => m.role === "assistant");
  return messages.map((m) => (multi ? `[${m.role}]\n${m.text}` : m.text)).join("\n\n");
}

/** Image attachments of the turn's user messages, newest last, capped at the API's comfort limit. */
export function imageRefsOf(turns, cap = 20) {
  const refs = [];
  for (const m of turns) {
    if (m.role !== "user" || !Array.isArray(m.content)) continue;
    for (const b of m.content)
      if (b && b.type === "image" && b.attachment) refs.push(b.attachment);
  }
  return refs.slice(-cap);
}

// ---------------------------------------------------------------------------
// Permission mode

/** The tools a turn may run without asking, by dsh file policy. The CLI's own prompt cannot be
 *  answered here — a `-p` child has no one to ask — so a policy that left the CLI waiting on a
 *  prompt would surface as tools failing for no visible reason. The mapping therefore states the
 *  policy up front instead of relying on an interactive gate that does not exist.
 *
 *  read-only      → only inspection tools; every mutating tool is refused by name.
 *  workspace-write→ edit tools allowed (the CLI still confines writes to the workspace).
 *  danger-full-access → no allowlist and no permission checks, matching dsh's own shield. */
const READ_ONLY_TOOLS = ["Read", "Glob", "Grep", "NotebookRead", "TodoWrite", "Task", "WebFetch", "WebSearch"];
const MUTATING_TOOLS = ["Edit", "Write", "NotebookEdit", "Bash", "BashOutput", "KillShell"];
/** Network reading is part of dsh's workspace-write shield — dsh's own web_fetch/web_search run
 *  there — but the CLI's default gate demands a permission nobody in a -p child can grant, and
 *  the approval bridge never sees that kind of ask. These ride --allowedTools additively (the
 *  shield stays allow-everything-else at the bridge; see approval.js allowedByPolicy). */
const NETWORK_TOOLS = ["WebFetch", "WebSearch"];

/** dsh's access-mode switch arrives as text in the runtime-context injection; the last one wins. */
export function accessModeOf(messages) {
  let mode;
  for (const m of messages ?? []) {
    if (m.role !== "user") continue;
    const found = textOf(m.content).match(/Current DSH file policy: ([a-z-]+)/);
    if (found) mode = found[1];
  }
  return mode;
}

/** The CLI flags enforcing one dsh file policy on a turn: the permission mode plus the tool
 *  allow/deny lists that say the same thing in the CLI's own vocabulary. An explicit
 *  `permissionMode` config overrides the mapping's mode and drops its lists — a fixed mode is the
 *  operator saying they know better than the shield. */
export function accessPolicyFor(config, accessMode, flags) {
  const supports = (flag) => !flags || flags.has(flag);
  const fixed = config.permissionMode !== "dsh";
  if (fixed) {
    return supports("--permission-mode")
      ? { mode: config.permissionMode, allowed: [], permit: [], disallowed: [] }
      : { mode: undefined, allowed: [], permit: [], disallowed: [] };
  }
  const policy =
    accessMode === "read-only"
      ? { mode: "default", allowed: READ_ONLY_TOOLS, permit: [], disallowed: MUTATING_TOOLS }
      : accessMode === "danger-full-access"
        ? { mode: "bypassPermissions", allowed: [], permit: [], disallowed: [] }
        : { mode: "acceptEdits", allowed: [], permit: NETWORK_TOOLS, disallowed: [] };
  return { ...policy, mode: supports("--permission-mode") ? policy.mode : undefined };
}

/** The CLI's permission mode alone, for callers that only need the mode. */
export function permissionModeFor(config, accessMode, flags) {
  return accessPolicyFor(config, accessMode, flags).mode;
}

// ---------------------------------------------------------------------------
// Tool-activity rendering (shown as reasoning lines; the CLI runs its own tools)

/** Collapse every run of whitespace to one space, then clip with an ellipsis. */
export function oneLine(text, limit = 200) {
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > limit ? `${flat.slice(0, limit)}…` : flat;
}

/** Clip to a trailing-anchored excerpt: the head is what identifies a result, but the tail of a
 *  long tool output is usually where the error or the summary sits, so both ends survive. */
export function clip(text, limit) {
  const flat = String(text ?? "").replace(/\s+/g, " ").trim();
  if (flat.length <= limit) return flat;
  const head = Math.max(1, Math.ceil(limit * 0.6));
  const tail = Math.max(1, limit - head - 1);
  return `${flat.slice(0, head)}…${flat.slice(-tail)}`;
}

/** Parse the tool arguments the CLI streamed as JSON; a truncated or absent payload is not an
 *  error here, it just leaves the summary with nothing to show. */
function argsOf(argsJson) {
  if (argsJson && typeof argsJson === "object") return argsJson;
  try {
    const parsed = JSON.parse(String(argsJson ?? ""));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

/** The argument a tool is best identified by: the path it touches, the command it runs, the
 *  pattern it searches. Falls back to the raw JSON so an unknown tool still says something. */
const SUMMARY_ARG = {
  Read: "file_path",
  Write: "file_path",
  Edit: "file_path",
  NotebookEdit: "notebook_path",
  NotebookRead: "notebook_path",
  Bash: "command",
  BashOutput: "bash_id",
  KillShell: "shell_id",
  Glob: "pattern",
  Grep: "pattern",
  WebFetch: "url",
  WebSearch: "query",
  Task: "description",
  TodoWrite: "todos",
};

/** Line counts of an Edit/Write payload, so the summary says how much changed rather than
 *  dumping the replacement text. */
function changeSize(args) {
  const added = typeof args.new_string === "string" ? args.new_string.split("\n").length : 0;
  const removed = typeof args.old_string === "string" ? args.old_string.split("\n").length : 0;
  const written = typeof args.content === "string" ? args.content.split("\n").length : 0;
  if (added || removed) return `+${added} −${removed}`;
  if (written) return `${written} lines`;
  return "";
}

/** One reasoning line for a tool call the CLI is about to run. The line names the tool and the
 *  one argument that identifies the call — a path, a command, a query — instead of the whole
 *  JSON payload, which for Edit meant pages of replacement text. */
export function toolCallLine(name, argsJson) {
  const args = argsOf(argsJson);
  const key = SUMMARY_ARG[name];
  const size = name === "Edit" || name === "Write" || name === "NotebookEdit" ? changeSize(args) : "";
  let detail = key && args[key] !== undefined ? oneLine(args[key], 160) : "";
  if (key === "todos" && Array.isArray(args.todos)) detail = `${args.todos.length} item(s)`;
  if (detail === "") detail = oneLine(JSON.stringify(args), 120);
  const suffix = size ? `${detail ? " " : ""}${size}` : "";
  // A file path is frequently the whole message for the read-only tools, so keep it fully visible.
  return `▸ ${name}${detail ? ` ${detail}` : ""}${suffix}`;
}

/** The CLI's names for its own subagent tool (spelled "Task" upstream, "Agent" on current
 *  stream-json output). Calls to it get a dedicated rendering instead of the generic tool lines,
 *  because their payload is a whole prompt and their result is a whole report. */
export const AGENT_TOOLS = new Set(["Task", "Agent"]);

/** One reasoning line for the CLI launching a subagent: the agent type and its description —
 *  the two fields a reader needs — instead of the whole prompt JSON. */
export function agentCallLine(name, argsJson) {
  const args = argsOf(argsJson);
  const type = oneLine(args.subagent_type ?? args.agent_type ?? "", 60);
  const label = oneLine(args.description ?? "", 80);
  const bits = [name, type, label].filter(Boolean).join(" · ");
  return `▸ ${bits}`;
}

/** One reasoning line for a finished subagent run: the agent's final report, clipped, with its
 *  own token/call usage when the CLI embedded a <usage> block in the result text. */
export function agentResultLine(name, argsJson, text, isError) {
  const args = argsOf(argsJson);
  const type = oneLine(args.subagent_type ?? "", 60);
  const head = [name, type].filter(Boolean).join(" · ");
  const raw = String(text ?? "");
  const usage = /<usage>([\s\S]*?)<\/usage>/.exec(raw);
  const usageBits = usage ? oneLine(usage[1], 120) : "";
  const body = clip(raw.replace(/<usage>[\s\S]*?<\/usage>/g, ""), 300);
  return `${isError ? "✗" : "◂"} ${head}${body ? ` ${body}` : " done"}${usageBits ? ` (${usageBits})` : ""}`;
}

/** Per-tool result budgets: a grep hit list or a command's output is worth reading, while a file
 *  dump is not. The old single 200-character cap made every result equally unreadable. */
const RESULT_LIMIT = {
  Bash: 400,
  BashOutput: 400,
  Grep: 300,
  Glob: 300,
  Read: 160,
  WebSearch: 300,
  WebFetch: 300,
};
const DEFAULT_RESULT_LIMIT = 240;

/** One reasoning line for a tool result the CLI just ran. */
export function toolResultLine(name, text, isError) {
  const body = clip(text, RESULT_LIMIT[name] ?? DEFAULT_RESULT_LIMIT);
  const empty = isError ? "failed" : "done";
  return `${isError ? "✗" : "◂"} ${name}${body ? ` ${body}` : ` ${empty}`}`;
}

// ---------------------------------------------------------------------------
// Compaction (the CLI owns it — it owns the resumed transcript; dsh only watches)

/** The auto-compact window handed to the CLI, in tokens. Compaction must be the CLI's to run,
 *  because a dsh-side compaction would summarize a history the CLI's session still carries in
 *  full — no token saved, two summaries paid. For the same reason the CLI must compact strictly
 *  before dsh's own compactor wakes at 0.8 × the window this plugin advertises: 0.7 keeps that
 *  order for every contextWindow ≥ 144K. The CLI clamps the value to its 100K–1M supported range;
 *  below ~144K windows that clamp can invert the order, which no current model's window hits. */
export function compactWindowFor(contextWindow) {
  const window = Number(contextWindow) > 0 ? Number(contextWindow) : 200000;
  return Math.min(1000000, Math.max(100000, Math.round(window * 0.7)));
}

/** Set the CLI's auto-compact window unless the user already chose one. */
export function withCompactWindow(env, contextWindow) {
  if (env.CLAUDE_CODE_AUTO_COMPACT_WINDOW === undefined) {
    env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = String(compactWindowFor(contextWindow));
  }
  return env;
}

/** One reasoning line for a finished compaction. The `compact_boundary` frame carries snake_case
 *  fields on stdout; the transcript file spells them camelCase — both are tolerated. */
export function compactBoundaryLine(metadata) {
  const md = metadata && typeof metadata === "object" ? metadata : {};
  const pre = md.pre_tokens ?? md.preTokens;
  const post = md.post_tokens ?? md.postTokens;
  const trigger = md.trigger ? ` ${md.trigger}` : "";
  const ms = Number(md.duration_ms ?? md.durationMs);
  const duration = ms > 0 ? `, ${(ms / 1000).toFixed(1)}s` : "";
  const counts =
    pre != null || post != null ? `: ${pre ?? "?"} → ${post ?? "?"} tokens` : "";
  return `⇣ context compacted${trigger}${counts}${duration}`;
}

/** One reasoning line for the instant notice that compaction has started (the PreCompact hook —
 *  the CLI itself prints nothing for the whole compaction, and upstream declined the request to
 *  emit a start event, so the hook is the only immediate signal a chat UI can get). */
export function compactingLine(trigger) {
  return `⇣ compacting context${trigger ? ` (${trigger})` : ""} — the CLI may pause for a minute or two`;
}

/** The compacted-context note: after compaction the CLI restarts the conversation from a summary,
 *  and the synthetic frame carrying it is the only place that summary is described. */
export function compactSummaryLine(text) {
  return `⇣ context continues from a compacted summary: ${oneLine(text, 240)}`;
}

/** One reasoning line for the CLI's `api_retry` system frames. Their field names are pinned by no
 *  contract this plugin has seen, so anything recognizable is used and nothing is assumed. */
export function apiRetryLine(event) {
  const bits = [];
  if (event.attempt != null) bits.push(`#${event.attempt}`);
  const delay = event.delay_ms ?? event.delay ?? event.retry_after_ms;
  if (delay != null) bits.push(`in ${delay}ms`);
  const cause = oneLine(event.error ?? event.message ?? event.reason ?? "", 160);
  return `↻ relay retry${bits.length ? ` ${bits.join(" ")}` : ""}${cause ? `: ${cause}` : ""}`;
}
