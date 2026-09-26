// dsh-claude-code-relay: the Claude Code CLI as an LLM provider for dsh (DeepSeek Harness),
// driven against an Anthropic-compatible relay station with base_url + api_key. Every turn spawns
// `claude -p --input-format stream-json --output-format stream-json` with ANTHROPIC_BASE_URL and
// the relay key in its environment, so the CLI's own agent loop, tools and sessions do the work
// while the model traffic goes to the relay instead of api.anthropic.com.

import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import Schema from "@deepseek-ai/schemastery";
import { LlmAdapter, LlmError } from "@deepseek-ai/dsh-llm";
import { defineTool } from "@deepseek-ai/dsh-tools";

import {
  CliProcess,
  childEnv,
  probeCli,
  unknownFlagIn,
} from "./process.js";
import {
  accessModeOf,
  accessPolicyFor,
  claudeSessionId,
  compactWindowFor,
  imageRefsOf,
  oneLine,
  promptMessages,
  selectTurns,
  textOf,
  transcriptPath,
  withCompactWindow,
} from "./util.js";
import { ApprovalBridge, writeCompactHookScript, writeHookScript } from "./approval.js";
import { RelayTranslator, isStaleResume } from "./translate.js";
import { ResidentCli } from "./resident.js";

export const inject = ["llm", "sessions", "attachments", "settings", "webServer", "tools"];

/** The reasoning-effort ladder this provider advertises to dsh, and the exact strings it hands the
 *  CLI's `--effort`. dsh keeps effort ids adapter-owned and validates requests against the list a
 *  model declares, so declaring these is what puts a thinking-effort control in the composer; a
 *  model that declares no efforts rejects every explicit effort request before the call is made. */
export const EFFORT_LEVELS = [
  { id: "low", name: "Low", description: "Fastest, least deliberation" },
  { id: "medium", name: "Medium", description: "Balanced deliberation" },
  { id: "high", name: "High", description: "More deliberation on hard turns" },
  { id: "xhigh", name: "Extra high", description: "Deep deliberation, slower" },
  { id: "max", name: "Max", description: "Maximum deliberation, slowest" },
];

/** The default effort, absent from the ladder only if a caller reconfigures the levels. */
export const DEFAULT_EFFORT = "medium";

const ModelEntry = Schema.object({
  id: Schema.string().required().description(
    "Model id passed to `claude --model` verbatim — use the id your relay accepts",
  ),
  name: Schema.string().description("Display name in dsh's model picker (default: the id)"),
  description: Schema.string().description("Optional description shown in the picker"),
  context: Schema.number().min(1000).description(
    "Per-model context window (tokens) advertised to dsh — drives the context meter and dsh's own backstop compactor; empty = the provider-wide contextWindow. The CLI may still clamp its own auto-compact to what it knows about the model id",
  ),
  compact: Schema.number().min(1000).description(
    "Per-model auto-compact trigger (tokens) handed to the CLI as CLAUDE_CODE_AUTO_COMPACT_WINDOW; empty = 0.7 × this model's context",
  ),
});

export const Config = Schema.object({
  baseUrl: Schema.string().default("").description(
    "Relay base URL, e.g. https://relay.example.com — sent to the CLI as ANTHROPIC_BASE_URL; Claude Code requests <baseUrl>/v1/messages. Empty = not configured yet; the Settings page (设置 → Claude Code) is the friendly place to fill it",
  ),
  apiKey: Schema.string().default("").description(
    "Relay API key. Sent as ANTHROPIC_AUTH_TOKEN (authHeader: auth-token) or ANTHROPIC_API_KEY (authHeader: api-key). Prefer apiKeyEnv and leave this empty in shared configs",
  ),
  apiKeyEnv: Schema.string().default("").description(
    "Environment variable that holds the relay API key (e.g. CLAUDE_RELAY_API_KEY), read by the dsh host process. Used when apiKey is empty",
  ),
  authHeader: Schema.union(["auth-token", "api-key"]).default("auth-token").description(
    "How the key is presented: auth-token sends Authorization: Bearer (most new-api/one-api relays); api-key sends the x-api-key header (the Anthropic native style)",
  ),
  command: Schema.string().default("claude").description(
    "Claude Code binary: a name on PATH or an absolute path",
  ),
  providerId: Schema.string().default("claude-code-relay").description(
    "Provider route id in dsh's model picker; a second mount of this plugin uses another id",
  ),
  displayName: Schema.string().default("Claude Code Relay").description(
    "Provider display name in dsh's model picker",
  ),
  models: Schema.array(ModelEntry).default([
    { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
    { id: "claude-opus-4-1", name: "Claude Opus 4.1" },
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
  ]).description(
    "Models offered in the picker; each id goes to `claude --model` verbatim, so list the ids your relay serves",
  ),
  autoModels: Schema.boolean().default(true).description(
    "List models by asking the relay (GET <baseUrl>/v1/models) and use the answer when it comes; the configured models are the fallback and the offline path",
  ),
  visibleModels: Schema.array(Schema.string()).default([]).description(
    "Model ids to offer in dsh's picker; empty offers every model the relay serves. Ticking a subset is what keeps the home picker short — an unticked model stays callable, it is only hidden",
  ),
  contextWindow: Schema.number().step(1).min(1000).default(200000).description(
    "Context window reported to dsh for every model entry",
  ),
  permissionMode: Schema.union([
    "dsh",
    "plan",
    "acceptEdits",
    "bypassPermissions",
    "dontAsk",
  ]).default("dsh").description(
    "Claude Code permission mode. 'dsh' follows the session's access shield: read-only → plan, workspace-write → acceptEdits, danger-full-access → bypassPermissions",
  ),
  resume: Schema.boolean().default(true).description(
    "Keep one Claude Code session per dsh session (--session-id first, --resume after), so context and tool history carry across turns",
  ),
  resident: Schema.boolean().default(true).description(
    "Keep one CLI process per session and send turns over its open stdin, instead of spawning a new CLI every turn",
  ),
  configDir: Schema.string().default("").description(
    "CLAUDE_CONFIG_DIR for the child. Set it to isolate the relay's Claude sessions, settings and skills from your own ~/.claude; empty = default",
  ),
  maxTurns: Schema.number().step(1).min(0).default(0).description(
    "--max-turns cap per request; 0 = CLI default",
  ),
  idleTimeoutMs: Schema.number().step(1).min(1000).default(1800000).description(
    "Kill the child when no stream frame arrives for this long — a running tool is legitimately silent (default 30 minutes)",
  ),
  toolActivity: Schema.boolean().default(true).description(
    "Show Claude Code's own tool calls and results as reasoning lines in the chat",
  ),
  toolCards: Schema.boolean().default(true).description(
    "Render the CLI's tool calls as real dsh tool cards (shadow tools replay the CLI's captured results; nothing is executed twice). Falls back to reasoning lines when the tool registry is unavailable",
  ),
  earlyDeliver: Schema.boolean().default(true).description(
    "Deliver a message queued behind a running turn to the CLI immediately, so its answer starts the moment the current run ends; dsh's next turn for that message replays the CLI's answer instead of re-sending it",
  ),
  approvalBridge: Schema.boolean().default(true).description(
    "Answer the CLI's tool-permission prompts through a PreToolUse hook, so a call the CLI would otherwise refuse becomes a visible decision instead of a silent failure",
  ),
  approvalMode: Schema.union(["auto", "ask"]).default("auto").description(
    "auto answers each prompt from the session's access shield; ask publishes every gated tool call for the user to decide in the dsh web UI",
  ),
  approvalTimeoutMs: Schema.number().step(1).min(1000).default(120000).description(
    "How long an 'ask' prompt waits for an answer before it is denied; an unanswered prompt must not leave the CLI blocked",
  ),
  systemPrompt: Schema.boolean().default(true).description(
    "Forward the call's system prompt to Claude Code via --append-system-prompt (auxiliary calls such as session titles carry one)",
  ),
  extraEnv: Schema.dict(Schema.string()).default({}).description(
    "Extra environment variables for the claude child (e.g. API_TIMEOUT_MS, ANTHROPIC_CUSTOM_HEADERS); beats every built-in value",
  ),
  extraArgs: Schema.array(Schema.string()).default([]).description(
    "Extra CLI arguments appended to every claude -p spawn",
  ),
  debug: Schema.boolean().default(false).description(
    "Log the spawn arguments (prompt excluded) of every call",
  ),
});

/** Whether a flag is known to be supported. Unknown flags (probe failed) mean "assume supported". */
const supports = (flags, flag) => !flags || flags.has(flag);

/** The Settings-page namespace: every field the page edits, without the composition-only
 *  identity fields (providerId, displayName) whose change would move the provider route.
 *  Defaults mirror Config, so a page that only fills baseUrl + apiKey gets the documented
 *  behavior for everything else. */
export const SettingsSchema = Schema.object({
  baseUrl: Schema.string().default("").description(
    "Relay base URL sent to the CLI as ANTHROPIC_BASE_URL, e.g. https://relay.example.com",
  ),
  apiKey: Schema.string().role("secret").description(
    "Relay API key; stored redacted and never echoed back to the page. No default: absent means unset, so the Settings page can tell a real key from an empty one",
  ),
  apiKeyEnv: Schema.string().default("").description(
    "Environment variable of the dsh host process holding the key, used when apiKey is empty",
  ),
  authHeader: Schema.union(["auth-token", "api-key"]).default("auth-token").description(
    "auth-token sends Authorization: Bearer; api-key sends the x-api-key header",
  ),
  autoModels: Schema.boolean().default(true).description(
    "Ask the relay's /v1/models for the picker list and fall back to models when it does not answer",
  ),
  visibleModels: Schema.array(Schema.string()).default([]).description(
    "Model ids shown in dsh's picker; empty shows every available model",
  ),
  models: Schema.array(ModelEntry).default([
    { id: "claude-sonnet-4-5", name: "Claude Sonnet 4.5" },
    { id: "claude-opus-4-1", name: "Claude Opus 4.1" },
    { id: "claude-haiku-4-5", name: "Claude Haiku 4.5" },
  ]).description("Models offered in the picker when the relay's own list is unavailable"),
  command: Schema.string().default("claude").description("Claude Code binary (name on PATH or absolute path)"),
  configDir: Schema.string().default("").description(
    "CLAUDE_CONFIG_DIR for the child; set it to isolate the relay's Claude sessions from your own ~/.claude",
  ),
  contextWindow: Schema.number().step(1).min(1000).default(200000).description(
    "Context window reported to dsh for every model entry",
  ),
  permissionMode: Schema.union([
    "dsh",
    "plan",
    "acceptEdits",
    "bypassPermissions",
    "dontAsk",
  ]).default("dsh").description(
    "Claude Code permission mode; 'dsh' follows the session's access shield",
  ),
  resume: Schema.boolean().default(true).description(
    "Keep one Claude Code session per dsh session so context carries across turns",
  ),
  resident: Schema.boolean().default(true).description(
    "Keep one CLI process per session and send turns over its open stdin, instead of spawning a new CLI every turn",
  ),
  maxTurns: Schema.number().step(1).min(0).default(0).description(
    "--max-turns cap per request; 0 = CLI default",
  ),
  idleTimeoutMs: Schema.number().step(1).min(1000).default(1800000).description(
    "Kill the child when no stream frame arrives for this long (default 30 minutes)",
  ),
  toolActivity: Schema.boolean().default(true).description(
    "Show Claude Code's tool calls and results as reasoning lines in the chat",
  ),
  approvalBridge: Schema.boolean().default(true).description(
    "Answer the CLI's tool-permission prompts through a PreToolUse hook instead of letting them fail silently",
  ),
  approvalMode: Schema.union(["auto", "ask"]).default("auto").description(
    "auto follows the session's access shield; ask publishes every gated call for the user to decide",
  ),
  approvalTimeoutMs: Schema.number().step(1).min(1000).default(120000).description(
    "How long an 'ask' prompt waits for an answer before it is denied",
  ),
  systemPrompt: Schema.boolean().default(true).description(
    "Forward auxiliary system prompts (session titles, compaction) via --append-system-prompt",
  ),
  extraEnv: Schema.dict(Schema.string()).default({}).description(
    "Extra environment variables for the claude child; beats every built-in value",
  ),
  extraArgs: Schema.array(Schema.string()).default([]).description(
    "Extra CLI arguments appended to every claude -p spawn",
  ),
  debug: Schema.boolean().default(false).description(
    "Log the spawn arguments (prompt excluded) of every call",
  ),
});

/** The settings namespace this plugin owns in dsh's user settings document. */
export const SETTINGS_NS = "claude-code-relay";

/** The argument list for one `claude -p` spawn, guarded by what this binary advertises so an
 *  older CLI is never handed a flag it would refuse. Returns the args plus whether the system
 *  prompt must ride inline in the prompt text (no --append-system-prompt support). */
export function buildArgs({
  model,
  system,
  purpose,
  config,
  session,
  accessMode,
  effort,
  flags,
  onPolicy,
}) {
  const args = ["-p", "--input-format", "stream-json", "--output-format", "stream-json", "--verbose"];
  if (supports(flags, "--include-partial-messages")) args.push("--include-partial-messages");
  if (model) args.push("--model", model);
  const sys = system && config.systemPrompt ? String(system) : "";
  const inlineSystem = sys !== "" && !supports(flags, "--append-system-prompt");
  if (sys !== "" && !inlineSystem) args.push("--append-system-prompt", sys);
  if (purpose) {
    // Auxiliary calls (title, compaction): one turn, no tools, no session of their own.
    if (supports(flags, "--tools")) args.push("--tools", "");
    args.push("--max-turns", "1");
    if (supports(flags, "--no-session-persistence")) args.push("--no-session-persistence");
  } else {
    // The session's reasoning effort rides the CLI's own --effort, whose levels are exactly the
    // ids this adapter advertises, so dsh's selector and the CLI agree by construction.
    if (effort && supports(flags, "--effort")) args.push("--effort", effort);
    // Record the policy this turn runs under, so the approval bridge can answer a tool the CLI
    // still had to ask about without contradicting the shield the turn was started with.
    const policy = accessPolicyFor(config, accessMode, flags);
    onPolicy?.(policy, accessMode);
    if (policy.mode !== undefined) args.push("--permission-mode", policy.mode);
    // The allow/deny lists restate dsh's file policy in the CLI's vocabulary. Without them a
    // read-only session would rely on the CLI's interactive gate, which a -p child cannot answer,
    // and every tool would fail with nothing to show for it. `permit` is additive: network
    // reading allowed by the shield that the CLI would otherwise gate behind an unanswerable
    // permission prompt (the bridge never sees that kind of ask).
    const allowed = [...policy.allowed, ...(policy.permit ?? [])];
    if (allowed.length > 0 && supports(flags, "--allowedTools")) {
      args.push("--allowedTools", allowed.join(","));
    }
    if (policy.disallowed.length > 0 && supports(flags, "--disallowedTools")) {
      args.push("--disallowedTools", policy.disallowed.join(","));
    }
    if (config.maxTurns > 0) args.push("--max-turns", String(config.maxTurns));
    if (session && supports(flags, "--session-id") && supports(flags, "--resume")) {
      args.push(session.resuming ? "--resume" : "--session-id", session.id);
    }
  }
  args.push(...(config.extraArgs ?? []));
  return { args, inlineSystem };
}

/** One stream-json stdin line: a message with text and, on a user turn, inline base64 images. */
export function userTurn(prompt, images = [], role = "user") {
  const content = [{ type: "text", text: prompt }];
  for (const img of images) {
    content.push({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.data },
    });
  }
  return { type: role, session_id: "", message: { role, content }, parent_tool_use_id: null };
}

/** The stdin lines for one turn: the conversation's messages in order, with the turn's images
 *  attached to its final user message. The CLI reads one message per line, so a retried turn
 *  carries the dialogue's real boundaries instead of a single flattened prompt. */
export function userTurns(messages, images) {
  return messages.map((m, i) =>
    userTurn(m.text, i === messages.length - 1 ? images : [], m.role),
  );
}

/** The LlmAdapter dsh talks to: one long-lived Claude Code process per session with a dsh turn in
 *  as one stdin line and the CLI's stream-json back out as dsh chunks (side calls stay one-shot
 *  spawns). */
export class ClaudeCodeRelayAdapter extends LlmAdapter {
  constructor(ctx, config) {
    super();
    this.ctx = ctx;
    this.config = config;
    // Claude session ids this adapter started itself; the transcript check covers the rest.
    this.started = new Set();
    // dsh session id → its resident CLI process; a warm process answers the next turn without
    // paying the CLI's startup, and any death costs at most one respawn from the transcript.
    this.residents = new Map();
    // dsh session id → keys of messages already handed to a running CLI (early delivery), so the
    // turn dsh eventually starts for such a message replays the CLI's answer instead of writing
    // the line a second time. The resident process the delivery rode on is recorded with it: a
    // respawned CLI never saw the message, so the record must not match.
    this.earlyDeliveries = new Map();
    // dsh session id → an in-flight CLI run split across steps: the process, its resident slot,
    // and the step number. Tool-call blocks end a step; the shadow tools replay the CLI's
    // captured results; the next step continues consuming the CLI's buffered frames.
    this.cliTurns = new Map();
    // call id → the CLI's captured tool result, consulted by the shadow tools.
    this.captured = new Map();
    this.shadowRegistered = false;
    this.loggedVersion = false;
    // Real-time queue observation: a message spliced into a session's next-turn inbox while this
    // provider still has a turn in flight is written to the running CLI's stdin immediately (the
    // CLI queues it as its very next run), so the answer starts the moment the current run ends.
    if (typeof this.ctx.on === "function") {
      try {
        this.ctx.on("session/event", (session, event) => this.onSessionEvent(session, event));
      } catch (error) {
        this.log("warn", `early delivery disabled: could not subscribe to session events (${errorText(error)})`);
      }
    }
  }

  /** One session-log event: hand next-turn queue inserts to the running CLI while a turn is live. */
  onSessionEvent(session, event) {
    if (this.config.earlyDeliver === false) return;
    if (event?.type !== "agent/inbox/spliced" || event.data?.target !== "next-turn") return;
    const sessionId = session?.id;
    const inserted = (event.data.inserted ?? []).filter((m) => m?.role === "user");
    if (!sessionId || inserted.length === 0) return;
    if ((this.earlyDeliveries.get(sessionId)?.size ?? 0) > 0) return; // one outstanding delivery
    this.deliverQueued(sessionId, inserted).catch(() => {});
  }

  /** Serialize the queued message(s) exactly as the turn path would and write them into the
   *  running CLI's stdin. The CLI queues stdin lines that arrive mid-run and answers them right
   *  after the current run, so this only pipelines — it never interlopes on a running answer. */
  async deliverQueued(sessionId, messages) {
    const resident = this.residents.get(sessionId);
    const proc = resident?.inTurn && resident.alive ? resident.proc : null;
    if (!proc) return;
    const turns = messages.map((m) => ({ role: "user", content: m.content, id: m.id }));
    let lines;
    try {
      const prepared = promptMessages(turns);
      const images = await this.loadImages(imageRefsOf(turns), undefined);
      lines = userTurns(prepared, images);
    } catch {
      return; // an unserializable queue entry falls back to dsh's normal turn-boundary delivery
    }
    if (!resident.inTurn || !resident.alive || resident.proc !== proc) return; // raced the turn's end
    const keys = this.earlyDeliveries.get(sessionId) ?? new Set();
    for (const t of turns) keys.add(t.id ?? oneLine(textOf(t.content), 200));
    this.earlyDeliveries.set(sessionId, keys);
    proc.writeLines(lines);
    this.log("info", `early-delivered ${turns.length} queued message(s) to the running CLI`);
  }

  /** The session's resident, created on first use. The map entry outlives the process it holds:
   *  a retired or crashed resident is simply respawned into the same slot. */
  residentFor(sessionId) {
    let resident = this.residents.get(sessionId);
    if (!resident) {
      resident = new ResidentCli({
        sessionId,
        log: (level, message) => this.log(level, message),
      });
      this.residents.set(sessionId, resident);
    }
    return resident;
  }

  /** Retire every resident (plugin teardown): processes die, the map empties. */
  disposeResidents() {
    for (const resident of this.residents.values()) resident.discard();
    this.residents.clear();
    this.earlyDeliveries.clear();
  }

  get claudeHome() {
    return this.config.configDir || join(homedir(), ".claude");
  }

  log(level, message) {
    try {
      this.ctx.logger?.[level]?.(`dsh-claude-code-relay: ${message}`);
    } catch {
      // cordis throws on service access from an inactive scope; a log line is not worth that
    }
  }

  /** The relay credential, resolved once per call: the literal key, else the named env var. */
  resolveKey() {
    if (this.config.apiKey) return this.config.apiKey;
    if (this.config.apiKeyEnv) return process.env[this.config.apiKeyEnv] ?? "";
    return "";
  }

  providerInfo(provider) {
    return { id: provider, name: this.config.displayName };
  }

  /** The relay's own model list from GET <baseUrl>/v1/models (Anthropic and OpenAI shapes both
   *  carry data[].id), or undefined when the relay did not answer — the configured models then
   *  serve the picker instead. A good answer is cached for a minute so opening settings twice
   *  does not ask twice. */
  async fetchUpstreamModels() {
    const key = this.resolveKey();
    if (!this.config.baseUrl || !key) return undefined;
    if (this.modelsCache && Date.now() - this.modelsCache.at < 60000) return this.modelsCache.list;
    const base = this.config.baseUrl.replace(/\/+$/, "");
    const headers =
      this.config.authHeader === "api-key"
        ? { "x-api-key": key, "anthropic-version": "2023-06-01" }
        : { authorization: `Bearer ${key}`, "anthropic-version": "2023-06-01" };
    try {
      const res = await fetch(`${base}/v1/models?limit=1000`, {
        headers,
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        this.log("warn", `relay /v1/models answered HTTP ${res.status}; the picker has no channel models`);
        return undefined;
      }
      const body = await res.json();
      const rows = Array.isArray(body?.data) ? body.data : [];
      const list = rows
        .filter((m) => typeof m?.id === "string" && m.id !== "")
        .map((m) => ({
          id: m.id,
          name: typeof m.display_name === "string" && m.display_name !== "" ? m.display_name : m.id,
        }));
      if (list.length === 0) {
        this.log("warn", "relay /v1/models returned no model ids");
        return undefined;
      }
      this.modelsCache = { at: Date.now(), list };
      return list;
    } catch (error) {
      this.log("warn", `relay /v1/models failed: ${error instanceof Error ? error.message : String(error)}`);
      return undefined;
    }
  }

  /** The models the relay offers, narrowed to the ones the user ticked. dsh builds its picker
   *  straight from this list, so ticking is what "show this model at home" means — there is no
   *  separate visibility flag in the model catalog, and an entry left out stays callable, it just
   *  no longer appears in the selector. An empty selection means "show everything", so a fresh
   *  install is not left staring at an empty picker. */
  /** Every model this relay can serve, unfiltered by the picker selection. The Settings page reads
   *  this to draw its checkboxes: it has to offer the models that are *not* currently shown, which
   *  the filtered list no longer contains. */
  async availableModels() {
    const entries =
      (this.config.autoModels ? await this.fetchUpstreamModels() : undefined) ??
      this.config.models ??
      [];
    return entries.map((m) => ({
      id: m.id,
      name: m.name || m.id,
      ...(m.description ? { description: m.description } : {}),
    }));
  }

  async listModels(provider) {
    const entries =
      (this.config.autoModels ? await this.fetchUpstreamModels() : undefined) ??
      this.config.models ??
      [];
    const visible = this.config.visibleModels ?? [];
    const shown = visible.length === 0 ? entries : entries.filter((m) => visible.includes(m.id));
    return shown.map((m) => ({
      provider,
      id: m.id,
      name: m.name || m.id,
      ...(m.description ? { description: m.description } : {}),
      inputModalities: ["text", "image"],
    }));
  }

  /** The configured model entry for one id, when any. */
  modelEntry(id) {
    return (this.config.models ?? []).find((m) => m?.id === id);
  }

  async resolveModel(provider, model) {
    const entry = this.modelEntry(model);
    return {
      provider,
      id: model,
      name: entry?.name ?? model,
      inputModalities: ["text", "image"],
      context: { contextWindow: entry?.context ?? this.config.contextWindow },
      // Declaring the ladder is what enables the composer's thinking-effort control; without it
      // dsh rejects any explicit effort request before the turn reaches this adapter.
      reasoning: {
        efforts: EFFORT_LEVELS.map((e) => ({ ...e })),
        defaultEffort: DEFAULT_EFFORT,
      },
    };
  }

  sessionCwd(sessionId) {
    try {
      return this.ctx.sessions?.get(sessionId)?.header?.cwd;
    } catch {
      return undefined;
    }
  }

  /** Inline images of the turn, read from dsh's attachment store; unreadable ones are skipped. */
  async loadImages(refs, signal) {
    const out = [];
    const store = this.ctx.attachments;
    if (!store || refs.length === 0) return out;
    for (const ref of refs) {
      try {
        const stored = await store.readImage(ref, signal);
        out.push({ mediaType: ref.mediaType, data: Buffer.from(stored.data).toString("base64") });
      } catch (error) {
        this.log("warn", `skipping image ${ref.attachmentId ?? "unknown"}: ${errorText(error)}`);
      }
    }
    return out;
  }

  async *stream(options) {
    // A step of an in-flight CLI run continues here: the loop executed the shadow tools for the
    // previous step's tool calls and the same process keeps streaming its remaining frames.
    const ongoing = options.sessionId ? this.cliTurns.get(options.sessionId) : undefined;
    if (ongoing && ongoing.proc && !ongoing.done) {
      yield* this.continueStep(options, ongoing);
      return;
    }
    const config = this.config;
    const apiKey = this.resolveKey();
    if (!config.baseUrl) {
      throw new LlmError(
        "Claude Code Relay is not configured: fill in the relay base URL (and key) under dsh Settings → Claude Code, or the baseUrl config of this plugin",
        "PROVIDER_ERROR",
      );
    }
    if (!apiKey) {
      throw new LlmError(
        "no relay API key: set apiKey, or put it in the env var named by apiKeyEnv",
        "PROVIDER_ERROR",
      );
    }

    // Where this turn runs: the session's workspace, a scratch dir for side calls, else dsh's cwd.
    const cwd = options.purpose
      ? mkdtempSync(join(tmpdir(), "dsh-claude-code-relay-"))
      : (options.sessionId && this.sessionCwd(options.sessionId)) || process.cwd();

    this.registerShadowTools();
    const cli = await probeCli(config.command);
    if (!this.loggedVersion) {
      this.loggedVersion = true;
      this.log("info", `claude ${cli.version} at ${cli.command}`);
    }

    // Session continuity: a deterministic Claude session id per dsh session, resumed once the
    // transcript exists (or this adapter started it and the process restarted meanwhile).
    let session;
    if (!options.purpose && config.resume && options.sessionId) {
      const id = claudeSessionId(options.sessionId);
      const known = this.started.has(id) || existsSync(transcriptPath(this.claudeHome, cwd, id));
      session = { id, resuming: known };
    }
    // A hook only knows its own cwd and the Claude session id, so the bridge needs both to tell
    // which dsh session a tool call belongs to.
    if (!options.purpose && this.bridge) {
      this.bridge.trackSession(options.sessionId, session?.id, cwd);
    }

    // The whole conversation, for spawns that start a Claude session with no history (a fresh
    // session or a stale-resume retry): replaying it as real turns keeps the boundaries the CLI
    // understands. A spawn that resumes — or a reused resident — sends only what is new, picked
    // per attempt below once the process for that attempt is known.
    const allTurns = selectTurns(options.messages, false);
    try {
      promptMessages(allTurns);
    } catch (error) {
      throw new LlmError(error.message, "INVALID_REQUEST");
    }

    const accessMode = accessModeOf(options.messages);
    // The model's own context/compact settings win over the provider-wide ones: the compact
    // window rides to the CLI as CLAUDE_CODE_AUTO_COMPACT_WINDOW (the CLI may still clamp it to
    // what it knows about the model id), and dsh's own backstop compactor follows the advertised
    // per-model context via resolveModel.
    const modelContext = this.modelEntry(options.model)?.context ?? config.contextWindow;
    const compactAt = this.modelEntry(options.model)?.compact ?? compactWindowFor(modelContext);
    const env = childEnv(
      process.env,
      {
        baseUrl: config.baseUrl,
        apiKey,
        authHeader: config.authHeader,
        configDir: config.configDir,
        extraEnv: config.extraEnv,
      },
      process.platform,
    );
    env.CLAUDE_CODE_AUTO_COMPACT_WINDOW = env.CLAUDE_CODE_AUTO_COMPACT_WINDOW ?? String(compactAt);
    // While the CLI compacts it prints nothing for minutes; the PreCompact hook's report reaches
    // the bridge instantly, so the frame loop below races the two and the pause explains itself.
    const notices = this.bridge && !options.purpose ? this.bridge.compactChannel() : null;
    // The session's resident process: one long-lived CLI reused across turns, so a follow-up rides
    // the warm process instead of paying the CLI's startup. Side calls stay one-shot.
    const resident =
      !options.purpose && session !== undefined && config.resident !== false
        ? this.residentFor(options.sessionId)
        : null;
    // What a spawn must match to reuse the resident: a change in any of these mid-session (model,
    // thinking effort, system prompt, access shield, endpoint, credential) respawns it, because
    // they are baked into the process at spawn time.
    const spawnKey = JSON.stringify({
      model: options.model ?? null,
      system: options.system ?? null,
      effort: options.reasoningEffort ?? null,
      accessMode,
      cwd,
      env,
    });
    // A --resume of a transcript Claude Code no longer has fails before any output; the turn is
    // retried once with a fresh session id rather than failing the user's message.
    try {
      for (let attempt = 0; ; attempt++) {
      // The process this attempt runs on: the session's resident when it is alive and this turn
      // would spawn it identically, else a freshly spawned child. Only the first attempt can
      // reuse — a stale-resume retry must not return to the process whose resume failed.
      let proc = null;
      let hasHistory = false;
      let attemptSession;
      if (resident && attempt === 0) {
        proc = resident.begin(spawnKey);
        if (proc) {
          // The live process is the history: this turn sends only its new messages.
          hasHistory = true;
          attemptSession = { id: session.id, resuming: true };
        }
      }
      if (!proc) {
        // Fresh spawn: resume the transcript when one is known; a retry starts a new session id.
        attemptSession =
          attempt === 0
            ? (session && { ...session, resuming: Boolean(session.resuming) })
            : session
              ? { id: randomUUID(), resuming: false }
              : undefined;
        hasHistory = Boolean(attemptSession?.resuming);
      }
      const { args, inlineSystem } = buildArgs({
        model: options.model,
        system: options.system,
        purpose: options.purpose,
        config,
        session: attemptSession,
        accessMode,
        effort: options.reasoningEffort,
        flags: cli.flags,
        // The bridge answers a PreToolUse hook from whatever shield this turn was started under,
        // recorded per session so two concurrent sessions cannot answer for each other.
        onPolicy: (policy) => {
          this.bridge?.setPolicy(options.sessionId, policy);
        },
      });
      // The hook is registered through this turn's own settings document, so the bridge is active
      // exactly while a turn is running and never leaks into the user's global Claude settings.
      if (this.bridgeSettingsPath && supports(cli.flags, "--settings")) {
        args.push("--settings", this.bridgeSettingsPath);
      }
      // What this attempt sends: only the new turns when the process carries the history, the
      // whole conversation when it starts one. Computed before any spawn so a malformed batch
      // fails the call without touching the resident.
      const attemptTurns = hasHistory ? selectTurns(options.messages, true) : allTurns;
      const attemptMessages = promptMessages(attemptTurns);
      const attemptImages = await this.loadImages(imageRefsOf(attemptTurns), options.signal);
      // A CLI without --append-system-prompt gets the system text folded into the first message.
      const lines = userTurns(attemptMessages, attemptImages);
      if (inlineSystem && lines.length > 0) {
        lines[0].message.content[0].text = `${options.system}\n\n${lines[0].message.content[0].text}`;
      }
      // Early delivery: when this turn's new message was already written into the running CLI's
      // stdin while the previous turn streamed, do not write it a second time — the CLI's answer
      // (buffered since that turn's result) is replayed into this turn instead. A fresh spawn
      // never saw the delivery, so its record is dropped and the message is sent normally.
      const deliveries = proc !== null ? this.earlyDeliveries.get(options.sessionId) : undefined;
      const lastNew = attemptTurns.at(-1);
      const newKey = lastNew ? (lastNew.id ?? oneLine(textOf(lastNew.content), 200)) : undefined;
      const already = Boolean(proc !== null && deliveries?.has(newKey));
      if (already) deliveries.delete(newKey);
      else this.earlyDeliveries.delete(options.sessionId);
      if (!proc) {
        if (config.debug) {
          this.log("info", `spawn cwd=${cwd} ${cli.command} ${args.join(" ")}`);
        }
        proc = new CliProcess({
          command: cli.command,
          args,
          cwd,
          env,
          idleMs: config.idleTimeoutMs,
        });
        proc.spawn();
        resident?.adopt(proc, spawnKey);
      } else if (config.debug) {
        this.log("info", `resident reuse for session ${options.sessionId}`);
      }
      const toolCards = config.toolCards !== false && this.shadowRegistered;
      const translator = new RelayTranslator({ toolActivity: config.toolActivity, toolBlocks: toolCards });
      if (!already && resident) {
        // Strays of an ordinary reuse are bookkeeping of a turn already closed: nobody owns them.
        const strays = resident.takeStrays();
        if (strays.length > 0) {
          this.log(
            "warn",
            `dropping ${strays.length} frame(s) that arrived after the previous turn's result: ${strays
              .map((f) => `${f?.type}/${f?.subtype ?? ""}`)
              .join(", ")}`,
          );
        }
      }
      const onAbort = () => {
        // An aborted resident is dropped, not parked: its conversation may be mid-tool.
        if (resident && resident.proc === proc) resident.discard();
        else proc.kill();
      };
      options.signal?.addEventListener("abort", onAbort, { once: true });
      let stale = false;
      // Cleared only on the path that finishes the turn with its result frame: every other exit
      // (abort, crash, idle, a stale resume) tears the resident down rather than parking it.
      let turnDone = false;
      // A step that ended on tool-call blocks hands the turn to the shadow tools and continues
      // with a follow-up stream() on the same process: the resident neither parks nor dies.
      let continues = false;
      try {
        if (!already) {
          proc.writeLines(lines);
        } else {
          // The CLI already holds this message (early delivery). Two shapes exist: it ran the
          // message as its own run (frames buffered since the previous turn's result — replay
          // them, then keep streaming live), or the previous run folded it into its own answer
          // (no buffered frames at all — this turn still needs an answer, so send the line and
          // let the model answer it once more).
          const strays = resident.takeStrays();
          if (strays.length > 0) {
            this.log(
              "info",
              `replaying ${strays.length} buffered frame(s) for an early-delivered message: ${strays
                .map((f) => `${f?.type}/${f?.subtype ?? ""}`)
                .slice(0, 8)
                .join(", ")}`,
            );
            for (const frame of strays) yield* translator.handle(frame);
          } else {
            this.log("info", "early-delivered message was folded into the previous run; sending it again for this turn");
            proc.writeLines(lines);
          }
          if (translator.finished) {
            turnDone = true;
            return;
          }
        }
        // A one-shot child's stdin closes so the CLI finishes and exits; a resident's stays open
        // for the turns to come.
        if (!resident) proc.endInput();
        // One frame promise at a time, raced against the compaction-notice channel: during a
        // compaction no frames arrive at all, so without this race the notice would wait behind a
        // frame that only comes after the compaction it announces.
        let pendingFrame = null;
        for (;;) {
          let event;
          if (!notices) {
            event = await proc.nextEvent();
          } else {
            pendingFrame ??= proc.nextEvent().then(
              (frame) => ({ frame }),
              () => ({ frame: null }),
            );
            const won = await Promise.race([
              pendingFrame,
              notices.next().then((result) => ({ notice: result })),
            ]);
            if (won.notice) {
              if (
                !won.notice.done &&
                this.compactNoteFor(won.notice.note, options, attemptSession, cwd)
              ) {
                yield* translator.handle({
                  type: "system",
                  subtype: "compact_started",
                  trigger: won.notice.note.trigger,
                });
              }
              continue;
            }
            pendingFrame = null;
            event = won.frame;
          }
          if (event === null) break;
          if (isStaleResume(event)) {
            stale = true;
            break;
          }
          yield* translator.handle(event);
          if (translator.finished) {
            if (attemptSession && !attemptSession.resuming) this.started.add(attemptSession.id);
            // A one-shot child's result frame is its last output, but the CLI still flushes its
            // transcript; let it exit on its own for a few seconds before the finally-block kill.
            // A resident stays open: its transcript is written as it goes.
            if (!resident) await proc.waitForExit(5000);
            turnDone = true;
            return;
          }
          // Tool-card mode: the CLI's calls in this segment all completed and their captured
          // results are in — close the step with them so dsh renders cards and runs the shadow
          // tools (pure replays), then continues this same turn on the CLI's remaining frames.
          if (toolCards && translator.emittedCalls.length > 0 && translator.pendingCalls().length === 0) {
            for (const [callId, captured] of translator.results) this.captured.set(callId, captured);
            this.cliTurns.set(options.sessionId, {
              proc, resident, claudeSessionId: attemptSession?.id, cwd,
            });
            continues = true;
            yield { type: "finish", reason: { kind: "tool-calls" } };
            return;
          }
        }
        if (stale && attempt === 0) {
          this.log("warn", "claude no longer has this session's transcript; retrying fresh");
          continue;
        }
        // Exited without a result frame: aborted, dead on spawn, idle-killed, or a CLI refusal.
        const aborted = options.signal?.aborted === true;
        const unknown = unknownFlagIn(proc.stderrTail);
        const failure = aborted
          ? { message: "aborted", code: "ABORTED" }
          : {
              message: proc.spawnError
                ? `cannot run \`${config.command}\` (${proc.spawnError}); install Claude Code or set the command config`
                : proc.idleKilled
                  ? `claude produced no output for ${Math.round(config.idleTimeoutMs / 1000)}s and was stopped`
                  : `claude exited ${proc.exitCode}: ${proc.stderrTail.trim() || "no output"}${
                      unknown ? ` (this Claude Code does not support ${unknown})` : ""
                    }`,
              code: "PROVIDER_ERROR",
            };
        yield { type: "finish", reason: aborted ? { kind: "aborted", failure } : { kind: "error", failure } };
        return;
      } finally {
        options.signal?.removeEventListener("abort", onAbort);
        if (continues) {
          // The run continues on this process in the loop's next step; the continuation entry
          // already carries the process and its resident slot.
        } else if (resident) {
          // A finished turn parks the resident with its retirement timer; anything else — abort,
          // crash, idle kill, a stale resume the next attempt retries — drops it.
          if (turnDone) resident.endTurn();
          else resident.discard();
        } else {
          proc.kill();
        }
      }
      }
    } finally {
      notices?.close();
    }
  }

  /** Register the display-only shadow tools once: one per Claude Code tool name. Their execute
   *  never runs anything — it replays the result the CLI already captured for that call id, so
   *  dsh renders real tool cards without re-executing the work. */
  registerShadowTools() {
    if (this.shadowRegistered || typeof this.ctx?.tools?.register !== "function") return;
    this.shadowRegistered = true;
    for (const name of ["Bash", "Read", "Edit", "Write", "Glob", "Grep", "NotebookEdit", "NotebookRead", "WebFetch", "WebSearch", "TodoWrite", "Task", "Agent", "BashOutput", "KillShell"]) {
      try {
        this.ctx.tools.register(
          defineTool({
            name,
            description: "Runs inside the Claude Code CLI that backs this session; dsh only displays the call and its captured result.",
            parameters: {},
            output: { schema: { type: "json" }, render: (_args, value) => [{ type: "text", text: String(value?.text ?? "") }] },
            execute: async (_args, exec) => {
              const captured = this.captured.get(exec.callId);
              if (captured === undefined) return { text: "(ran inside the Claude Code CLI)" };
              return { text: captured.text, isError: captured.isError };
            },
          }),
        );
      } catch (error) {
        this.log("warn", `shadow tool ${name} not registered: ${errorText(error)}`);
      }
    }
  }

  /** The continuation step of an in-flight CLI run: keep consuming its buffered frames — no new
   *  stdin line, no re-spawn — until the run's result frame closes the turn. */
  async *continueStep(options, step) {
    const config = this.config;
    const { proc, resident } = step;
    const toolCards = config.toolCards !== false;
    const notices = this.bridge ? this.bridge.compactChannel() : null;
    const translator = new RelayTranslator({ toolActivity: config.toolActivity, toolBlocks: toolCards });
    const onAbort = () => {
      this.cliTurns.delete(options.sessionId);
      if (resident && resident.proc === proc) resident.discard();
      else proc.kill();
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });
    let turnDone = false;
    try {
      let pendingFrame = null;
      for (;;) {
        let event;
        if (!notices) {
          event = await proc.nextEvent();
        } else {
          pendingFrame ??= proc.nextEvent().then(
            (frame) => ({ frame }),
            () => ({ frame: null }),
          );
          const won = await Promise.race([pendingFrame, notices.next().then((result) => ({ notice: result }))]);
          if (won.notice) {
            if (!won.notice.done && this.compactNoteFor(won.notice.note, options, { id: step.claudeSessionId, resuming: true }, step.cwd)) {
              yield* translator.handle({ type: "system", subtype: "compact_started", trigger: won.notice.note.trigger });
            }
            continue;
          }
          pendingFrame = null;
          event = won.frame;
        }
        if (event === null) break;
        yield* translator.handle(event);
        if (translator.finished) {
          turnDone = true;
          this.cliTurns.delete(options.sessionId);
          return;
        }
      }
      const aborted = options.signal?.aborted === true;
      yield {
        type: "finish",
        reason: aborted
          ? { kind: "aborted", failure: { message: "aborted", code: "ABORTED" } }
          : { kind: "error", failure: { message: `claude exited ${proc.exitCode}: ${proc.stderrTail.trim() || "no output"}`, code: "PROVIDER_ERROR" } },
      };
      this.cliTurns.delete(options.sessionId);
      return;
    } finally {
      options.signal?.removeEventListener("abort", onAbort);
      notices?.close();
      if (turnDone && resident) resident.endTurn();
      else if (resident && resident.proc === proc) resident.discard();
    }
  }

  /** Whether a compaction notice belongs to the turn being streamed: the bridge resolved the
   *  session when it could, the Claude session id is exact on a resumed turn, and the workspace
   *  covers the first turn of a fresh session where neither id is known yet. */
  compactNoteFor(note, options, attemptSession, cwd) {
    if (note.sessionId != null) return note.sessionId === options.sessionId;
    if (attemptSession && note.claudeSessionId === attemptSession.id) return true;
    return note.cwd === cwd;
  }
}

const errorText = (error) =>
  error instanceof Error ? error.message : String(error);

/** Register the Settings-page namespace and let its resolved value (and later page edits) drive
 *  the adapter: composition config is the base layer, the Settings UI writes the user layer on
 *  top, and each commit re-merges onto the live adapter. Registration failure — for instance a
 *  hand-edited settings document the schema rejects — degrades to config-file-only operation. */
function registerSettings(ctx, config, adapter) {
  // "settings" is declared in inject, so the property access resolves once the provider starts;
  // the ctx.get fallback keeps direct apply() callers (tests, embedders) working without cordis.
  const settings = ctx.settings ?? (typeof ctx.get === "function" ? ctx.get("settings") : undefined);
  if (settings === undefined) {
    degradation("settings service not present on this context");
    return undefined;
  }
  if (typeof settings.register !== "function") {
    degradation(`settings service lacks register (keys: ${Object.keys(settings).join(",")})`);
    return undefined;
  }
  const { providerId: _route, displayName: _name, ...rest } = config;
  // An empty-string key from the composition defaults must not read as a stored secret, or the
  // Settings page would show "configured" for a key nobody set.
  const base = { ...rest, apiKey: rest.apiKey || undefined };
  try {
    const scope = settings.register(SETTINGS_NS, SettingsSchema, { base });
    const adopt = (resolved) => {
      adapter.config = { ...config, ...resolved };
      adapter.modelsCache = undefined; // a new endpoint or key must re-ask /v1/models
    };
    adopt(scope.get());
    scope.watch(adopt);
    return scope;
  } catch (error) {
    degradation(`settings.register failed: ${error instanceof Error ? error.stack : String(error)}`);
    return undefined;
  }
}

/** Surface a settings degradation on stderr too: the host's plugin logger has no guaranteed
 *  sink, and this warning is the only trace of a silent capability loss. */
function degradation(message) {
  const line = `dsh-claude-code-relay: settings unavailable — ${message} (falling back to config file)`;
  try {
    process.stderr.write(`${line}\n`);
  } catch {
    // a closed stderr must not break the plugin
  }
}

/** The same-origin path the Settings page reads the relay's model list from, so the "show in the
 *  picker" checkboxes can name the models the relay actually serves. */
export const MODELS_PATH = "/dsh-claude-code-relay/models";

/** Whether a request came from this machine's own browser session. The route only reveals a model
 *  list the caller could already obtain by asking the relay, but it must not answer a page on
 *  another origin, so the Origin host has to match the Host header (or be absent, as a same-origin
 *  navigation or a non-browser client sends it). */
function isLoopbackOrigin(req) {
  const host = req.headers?.host ?? "";
  const name = host.replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
  if (name !== "127.0.0.1" && name !== "localhost" && name !== "::1") return false;
  const origin = req.headers?.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** The same-origin paths the web UI uses: the relay's model list, and the approval bridge's
 *  pending calls plus their answers. */
export const APPROVALS_PATH = "/dsh-claude-code-relay/approvals";

/** Whether a request came from this machine's own browser. Both routes below are loopback-only;
 *  a caller on the LAN must not enumerate models or answer approvals. */
function isLocalRequest(req) {
  const remote = String(req.socket?.remoteAddress ?? "");
  const local = remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1";
  return local && isLoopbackOrigin(req);
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

/** Register the web UI's routes on the injected webServer. A host that somehow has no register
 *  method keeps working: the Settings page then has no channel list, and approvals never surface. */
function registerRoutes(ctx, { adapter, bridge }) {
  const mount = (webCtx) => {
    const server = webCtx.webServer ?? webCtx.get?.("webServer");
    if (typeof server?.register !== "function") {
      degradation(`web route not mounted (webServer.register missing)`);
      return;
    }
  const routes = [
      {
        path: MODELS_PATH,
        handler: async (req, res) => {
          try {
            sendJson(res, 200, { ok: true, models: await adapter.availableModels() });
          } catch (error) {
            sendJson(res, 200, { ok: false, error: errorText(error) });
          }
        },
      },
      {
        path: APPROVALS_PATH,
        handler: async (req, res) => {
          if (!bridge) {
            sendJson(res, 200, { ok: true, pending: [] });
            return;
          }
          if (req.method === "GET") {
            sendJson(res, 200, { ok: true, pending: bridge.snapshot() });
            return;
          }
          if (req.method !== "POST") {
            sendJson(res, 405, { ok: false, error: "method not allowed" });
            return;
          }
          // The verdict arrives in the body: one small JSON object, read with a hard cap so a
          // malformed or hostile request cannot buffer without bound.
          let raw = "";
          for await (const chunk of req) {
            raw += chunk;
            if (raw.length > 65536) {
              sendJson(res, 413, { ok: false, error: "request too large" });
              return;
            }
          }
          let body;
          try {
            body = JSON.parse(raw || "{}");
          } catch {
            sendJson(res, 400, { ok: false, error: "malformed body" });
            return;
          }
          const accepted = bridge.answer(String(body?.id ?? ""), body?.decision, body?.reason);
          sendJson(res, accepted ? 200 : 404, { ok: accepted, pending: bridge.snapshot() });
        },
      },
    ];
    // effect() runs the callback now and calls whatever it returns when the plugin stops.
    // The disposer must be the return value — calling it inside the callback removes the route
    // before any request arrives.
    for (const route of routes) {
      webCtx.effect(() => server.register({
        kind: "exact",
        path: route.path,
        handler: async (req, res) => {
          if (!isLocalRequest(req)) {
            sendJson(res, 403, { ok: false, error: "forbidden" });
            return;
          }
          try {
            await route.handler(req, res);
          } catch (error) {
            try {
              sendJson(res, 500, { ok: false, error: errorText(error) });
            } catch {
              // the response was already written
            }
          }
        },
      }));
    }
  };
  if (typeof ctx.webServer?.register === "function" || typeof ctx.get?.("webServer")?.register === "function") {
    mount(ctx);
    return;
  }
  if (typeof ctx.inject === "function") {
    ctx.inject(["webServer"], mount);
    return;
  }
  degradation("web route not mounted (no webServer and no ctx.inject)");
}

/** Prepare the hook bridging this plugin's CLI turns: PreToolUse routes permission prompts to
 *  the dsh web UI (when approval bridging is on), PreCompact reports that compaction started so
 *  a minutes-long silent pause can explain itself.
 *
 *  Both hooks are injected through a generated settings document passed on the command line, so
 *  they apply to this plugin's turns only. Writing them into the user's own `~/.claude/settings.json`
 *  would make a plugin the owner of every Claude Code session on the machine, which is not a
 *  decision an LLM provider gets to make. */
function prepareBridge(ctx, config, adapter) {
  const bridge = new ApprovalBridge({
    ctx,
    config,
    log: (level, message) => adapter.log(level, message),
  });
  const dir = mkdtempSync(join(tmpdir(), "dsh-claude-code-relay-hook-"));
  const compact = writeCompactHookScript(dir, bridge.path);
  const hooks = {
    PreCompact: [
      {
        // auto and manual compactions alike: the notice is what keeps the chat legible while
        // the CLI goes quiet, and the hook exits as soon as the bridge acks.
        matcher: "*",
        hooks: [{ type: "command", command: compact.command, timeout: 120 }],
      },
    ],
  };
  if (bridge.enabled) {
    const hook = writeHookScript(dir, bridge.path);
    hooks.PreToolUse = [
      {
        // Every tool is reported, so a call the CLI would refuse on its own still reaches a
        // decision instead of failing with a message nobody can act on.
        matcher: "*",
        hooks: [{ type: "command", command: hook.command, timeout: 600 }],
      },
    ];
  } else {
    adapter.log("info", "approval bridge disabled by config; the CLI keeps its own permission path");
  }
  const settingsPath = join(dir, "settings.json");
  writeFileSync(settingsPath, JSON.stringify({ hooks }, null, 2));
  adapter.bridge = bridge;
  adapter.bridgeSettingsPath = settingsPath;
  // The bridge always listens: with approvals off it still carries compaction notices.
  return { bridge, settingsPath };
}

/** The entry point dsh calls at boot: build the adapter and register its provider route. */
export function apply(ctx, config) {
  const adapter = new ClaudeCodeRelayAdapter(ctx, config);
  const { bridge } = prepareBridge(ctx, config, adapter);
  ctx.llm.registerAdapter([config.providerId], adapter);
  registerRoutes(ctx, { adapter, bridge });
  bridge?.start();
  const scope = registerSettings(ctx, config, adapter);
  ctx.logger?.info?.(
    `dsh-claude-code-relay: provider "${config.providerId}" registered (${config.baseUrl || "no baseUrl yet — configure it in Settings"})` +
      `${scope ? "" : " [settings namespace not registered]"}`,
  );
  // One background probe so a missing CLI is visible in the log before the first turn fails.
  probeCli(config.command)
    .then(({ version, command }) =>
      adapter.log("info", `claude ${version} at ${command}`),
    )
    .catch(() => adapter.log("warn", `cannot probe \`${config.command}\` — is Claude Code installed?`));
  return () => {
    adapter.started.clear();
    adapter.disposeResidents();
    bridge?.stop();
  };
}
