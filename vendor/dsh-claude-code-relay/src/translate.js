// The translator of dsh-claude-code-relay: incremental conversion of Claude Code stream-json
// frames into dsh StreamChunks. Prefers partial `stream_event` frames (live token streaming) and
// falls back to whole `assistant` frames when the CLI produced no partials; the CLI runs its own
// tools, so dsh only watches — tool activity is rendered as reasoning lines. Frames of the CLI's
// own subagents (Task/Agent calls, tagged with a parent_tool_use_id) are rendered as indented
// lines nested under their call, so the chat follows a subagent's work live instead of showing
// only its launch and its final report.

import {
  AGENT_TOOLS,
  agentCallLine,
  agentResultLine,
  apiRetryLine,
  clip,
  compactBoundaryLine,
  compactSummaryLine,
  compactingLine,
  textOf,
  toolCallLine,
  toolResultLine,
  oneLine,
} from "./util.js";

/** dsh's own StreamChunk vocabulary is merge-extensible; the two block types this translator
 *  emits are the two every dsh understands. */
const TEXT = "text";
const REASONING = "reasoning";

/** Indent marker for lines that belong to the CLI's own subagent, not the main thread. */
const NESTED_PREFIX = "  ↳ ";

/** Budgets that keep a chatty subagent from flooding the chat: per nested streamed block and per
 *  agent run. After either is hit the agent's remaining activity collapses into one ellipsis
 *  line; the final result line always gets through. */
const NESTED_TEXT_LIMIT = 480;
const NESTED_MAX_LINES = 40;

/** A `result` frame that says the CLI no longer has the conversation `--resume` named. */
export function isStaleResume(event) {
  if (event?.type !== "result" || !event.is_error) return false;
  return /No conversation found/i.test(JSON.stringify(event.errors ?? event.result ?? ""));
}

/** A turn the relay refused to authenticate: the API's 401, or the CLI's own wording. */
const AUTH_FAILURE_RE =
  /authentication_error|invalid x-api-key|invalid api key|not logged in|failed to authenticate|unauthorized/i;

const resultMessage = (result) => {
  const errors = Array.isArray(result.errors) ? result.errors.join("; ") : "";
  return String(result.result ?? errors ?? result.subtype ?? "claude error");
};

/** The terminal reason of a finished turn, with a relay-specific hint on auth failures. */
export function finishReason(result) {
  if (result.is_error) {
    let message = resultMessage(result);
    if (result.api_error_status === 401 || AUTH_FAILURE_RE.test(message)) {
      message = `the endpoint rejected the credential (check baseUrl, apiKey and authHeader): ${message}`;
    }
    return { kind: "error", failure: { message, code: "PROVIDER_ERROR" } };
  }
  if (result.stop_reason === "max_tokens") return { kind: "max-tokens" };
  return { kind: "stop" };
}

/** Claude usage fields → dsh TokenUsage. The Anthropic API reports uncached prompt tokens in
 *  input_tokens, cache reads and writes separately; the three are disjoint, which is exactly
 *  dsh's contract. */
export function usageOf(u) {
  if (!u || typeof u !== "object") return undefined;
  const usage = {
    inputTokens: Number(u.input_tokens) || 0,
    outputTokens: Number(u.output_tokens) || 0,
  };
  const read = Number(u.cache_read_input_tokens) || 0;
  const write = Number(u.cache_creation_input_tokens) || 0;
  if (read > 0) usage.cacheReadTokens = read;
  if (write > 0) usage.cacheWriteTokens = write;
  return usage;
}

// One open streamed block: the dsh block index it owns, its type, and the text accumulated so far.
class OpenBlock {
  constructor(index, blockType) {
    this.index = index;
    this.blockType = blockType;
    this.text = "";
  }
}

/** Live state of one running CLI subagent: its streamed nested blocks, the message ids already
 *  streamed via partials, its tools' names, and the drawing budget that bounds its line count. */
class AgentStream {
  constructor() {
    this.open = new Map();
    this.streamedIds = new Set();
    this.toolNames = new Map();
    this.lines = 0;
    this.collapsed = false;
  }
}

/** Incremental translator from Claude Code stream-json frames to dsh StreamChunks. `handle` is a
 *  generator yielding the chunks of one frame; the adapter stops calling it after the finish
 *  chunk, because nothing may follow it. */
export class RelayTranslator {
  constructor({ toolActivity = true, toolBlocks = false } = {}) {
    this.toolActivity = toolActivity;
    // toolBlocks mode: CLI tool calls become real dsh tool-call blocks (rendered as tool cards)
    // and their captured results ride a lookup keyed by call id, instead of reasoning lines. The
    // adapter pairs this with shadow tools so dsh never re-executes what the CLI already ran.
    this.toolBlocks = toolBlocks;
    this.emittedCalls = [];
    this.results = new Map();
    this.finished = false;
    // Next dsh block index; correlates block-start/delta/block-end triples.
    this.index = 0;
    // CLI content-block index → streamed open block (text/reasoning only).
    this.open = new Map();
    // CLI content-block index → { id, name, input } of a tool_use block being streamed.
    this.cbMeta = new Map();
    // Message ids already streamed via partials, so their whole `assistant` echo is dropped.
    this.streamedIds = new Set();
    // tool_use id → tool name, so tool_result frames can name their tool.
    this.toolNames = new Map();
    // tool_use id → the call's input args, for subagent result lines that name the agent type.
    this.agentArgs = new Map();
    // parent_tool_use_id → live state of one running CLI subagent.
    this.agents = new Map();
    this.resultUsage = undefined;
  }

  /** Chunks that open a dsh block. */
  start(blockType) {
    const index = this.index++;
    return { chunks: [{ type: "block-start", index, blockType }], block: new OpenBlock(index, blockType) };
  }

  /** Chunks that close a streamed block. */
  end(block) {
    return {
      type: "block-end",
      index: block.index,
      block: block.blockType === TEXT ? { type: TEXT, text: block.text } : { type: REASONING, text: block.text },
    };
  }

  /** Chunks of one whole text or reasoning block, used when no partials streamed it. */
  *whole(blockType, text) {
    if (text === "") return;
    const { chunks, block } = this.start(blockType);
    block.text = text;
    yield chunks[0];
    yield {
      type: blockType === TEXT ? "text-delta" : "reasoning-delta",
      index: block.index,
      text,
    };
    yield this.end(block);
  }

  /** A reasoning line for tool activity, when tool activity is shown at all. */
  *toolNote(text) {
    if (!this.toolActivity) return;
    yield* this.whole(REASONING, text);
  }

  /** A reasoning line for a conversation-state event (compaction, retries): shown even when tool
   *  activity is hidden, because these explain pauses the context meter cannot. */
  *note(text) {
    yield* this.whole(REASONING, text);
  }

  /** The handle entry point: one parsed stdout frame → its chunks. */
  *handle(event) {
    if (!event || typeof event !== "object") return;
    switch (event.type) {
      case "system":
        // Conversation-state frames: a finished compaction (wire fields are snake_case), the
        // bridge's instant compaction-started notice, and relay retries the CLI rides out.
        if (event.subtype === "compact_boundary") {
          yield* this.note(compactBoundaryLine(event.compact_metadata ?? event.compactMetadata));
        } else if (event.subtype === "compact_started") {
          yield* this.note(compactingLine(event.trigger));
        } else if (event.subtype === "api_retry") {
          yield* this.note(apiRetryLine(event));
        }
        return;
      case "stream_event":
        // Frames tagged with a parent_tool_use_id belong to the CLI's own subagent; they render
        // as indented lines nested under that agent's call instead of being dropped.
        if (event.parent_tool_use_id != null) {
          yield* this.nestedPartial(event.parent_tool_use_id, event.event ?? {});
          return;
        }
        yield* this.partial(event.event ?? {});
        return;
      case "assistant":
        if (event.parent_tool_use_id != null) {
          yield* this.nestedAssistant(event.parent_tool_use_id, event.message ?? {});
          return;
        }
        yield* this.assistant(event.message ?? {});
        return;
      case "user":
        if (event.parent_tool_use_id != null) {
          yield* this.nestedToolResults(event.parent_tool_use_id, event.message?.content);
          return;
        }
        // After a compaction the CLI restarts its conversation from a summary; that synthetic
        // frame describes the new context and is not a tool result.
        if (event.isSynthetic === true) {
          yield* this.note(compactSummaryLine(textOf(event.message?.content)));
          return;
        }
        yield* this.toolResults(event.message?.content);
        return;
      case "result":
        yield* this.result(event);
        return;
      default:
        return; // rate_limit_event and future frames: nothing to draw
    }
  }

  /** One streaming partial frame (`--include-partial-messages`). */
  *partial(ev) {
    switch (ev.type) {
      case "message_start": {
        // A new message begins: whatever is still open belongs to the previous one and closes now.
        yield* this.closeOpen();
        const id = ev.message?.id;
        if (id) this.streamedIds.add(id);
        return;
      }
      case "content_block_start": {
        const at = ev.index ?? -1;
        const cb = ev.content_block ?? {};
        if (cb.type === "text" || cb.type === "thinking") {
          const { chunks, block } = this.start(cb.type === "text" ? TEXT : REASONING);
          this.open.set(at, block);
          yield chunks[0];
        } else if (cb.type === "tool_use") {
          // Hidden while it streams: its call line is drawn complete at content_block_stop.
          this.cbMeta.set(at, { id: cb.id, name: cb.name, input: "" });
          if (cb.id && cb.name) this.toolNames.set(cb.id, cb.name);
        }
        return;
      }
      case "content_block_delta": {
        const at = ev.index ?? -1;
        const delta = ev.delta ?? {};
        const block = this.open.get(at);
        if (block) {
          const text = typeof delta.text === "string" ? delta.text : typeof delta.thinking === "string" ? delta.thinking : "";
          if (text !== "") {
            block.text += text;
            yield {
              type: block.blockType === TEXT ? "text-delta" : "reasoning-delta",
              index: block.index,
              text,
            };
          }
          return;
        }
        const meta = this.cbMeta.get(at);
        if (meta && typeof delta.partial_json === "string") meta.input += delta.partial_json;
        return;
      }
      case "content_block_stop": {
        const at = ev.index ?? -1;
        const block = this.open.get(at);
        if (block) {
          this.open.delete(at);
          yield this.end(block);
          return;
        }
        const meta = this.cbMeta.get(at);
        if (meta) {
          this.cbMeta.delete(at);
          if (meta.id && AGENT_TOOLS.has(meta.name ?? "")) this.agentArgs.set(meta.id, meta.input || "{}");
          if (this.toolBlocks) {
            yield* this.toolCallBlock(meta.id ?? `call_${this.index}`, meta.name ?? "tool", meta.input || "{}");
          } else {
            yield* this.toolUseNote(meta.name ?? "tool", meta.input || "{}");
          }
        }
        return;
      }
      default:
        return; // message_delta / message_stop / ping: bookkeeping only
    }
  }

  /** The note for one tool call: the CLI's own subagent launches get a line naming the agent
   *  type and description instead of the raw prompt JSON. */
  *toolUseNote(name, argsJson) {
    if (AGENT_TOOLS.has(name)) yield* this.toolNote(agentCallLine(name, argsJson));
    else yield* this.toolNote(toolCallLine(name, argsJson));
  }

  /** Close every block still open (a message ended without stops, or one never arrived). */
  *closeOpen() {
    for (const block of this.open.values()) yield this.end(block);
    this.open.clear();
  }

  /** One real dsh tool-call block for a tool the CLI runs itself. dsh's loop will route the call
   *  to this plugin's shadow tool, which replays the CLI's captured result without executing. */
  *toolCallBlock(id, name, argsJson) {
    const { chunks, block } = this.start("tool-call");
    yield chunks[0];
    yield { type: "tool-call-delta", index: block.index, id, name, argumentsDelta: argsJson };
    yield { type: "block-end", index: block.index, block: { type: "tool-call", id, name, arguments: argsJson } };
    this.emittedCalls.push(id);
  }

  /** Tool calls emitted as blocks whose captured results have not arrived yet. */
  pendingCalls() {
    return this.emittedCalls.filter((id) => !this.results.has(id));
  }

  /** One whole `assistant` frame. Skipped when partials already streamed this message id. */
  *assistant(message) {
    if (message.id && this.streamedIds.has(message.id)) return;
    if (message.id) this.streamedIds.add(message.id);
    yield* this.closeOpen();
    const content = Array.isArray(message.content) ? message.content : [];
    for (const cb of content) {
      if (!cb || typeof cb !== "object") continue;
      if (cb.type === "text" && typeof cb.text === "string") {
        yield* this.whole(TEXT, cb.text);
      } else if (cb.type === "thinking" && typeof cb.thinking === "string") {
        yield* this.whole(REASONING, cb.thinking);
      } else if (cb.type === "tool_use") {
        if (cb.id && cb.name) this.toolNames.set(cb.id, cb.name);
        if (cb.id && AGENT_TOOLS.has(cb.name ?? "")) this.agentArgs.set(cb.id, cb.input ?? {});
        if (this.toolBlocks) {
          yield* this.toolCallBlock(cb.id ?? `call_${this.index}`, cb.name ?? "tool", JSON.stringify(cb.input ?? {}));
        } else {
          yield* this.toolUseNote(cb.name ?? "tool", JSON.stringify(cb.input ?? {}));
        }
      }
    }
  }

  /** One `user` frame: the results of the tools the CLI ran itself. A subagent's result retires
   *  the agent's live view — its remaining nested state is flushed and dropped. */
  *toolResults(content) {
    if (!Array.isArray(content)) return;
    for (const cb of content) {
      if (!cb || cb !== Object(cb) || cb.type !== "tool_result") continue;
      if (this.toolBlocks) {
        this.results.set(cb.tool_use_id, { text: textOf(cb.content), isError: cb.is_error === true });
        continue;
      }
      const name = this.toolNames.get(cb.tool_use_id) ?? "tool";
      if (AGENT_TOOLS.has(name)) {
        yield* this.toolNote(
          agentResultLine(name, this.agentArgs.get(cb.tool_use_id), textOf(cb.content), cb.is_error === true),
        );
        this.agentArgs.delete(cb.tool_use_id);
        const agent = this.agents.get(cb.tool_use_id);
        if (agent) {
          yield* this.closeAgent(agent);
          this.agents.delete(cb.tool_use_id);
        }
        continue;
      }
      yield* this.toolNote(toolResultLine(name, textOf(cb.content), cb.is_error === true));
    }
  }

  // -------------------------------------------------------------------------
  // The CLI's own subagents (frames carrying a parent_tool_use_id)

  /** Live state of one agent, created on its first nested frame. */
  agentOf(parentId) {
    if (parentId == null) return undefined;
    let agent = this.agents.get(parentId);
    if (!agent) {
      if (this.agents.size >= 8) return undefined; // a runaway fan-out stops drawing, not the turn
      agent = new AgentStream();
      this.agents.set(parentId, agent);
    }
    return agent;
  }

  /** One budget-guarded indented line of agent activity. */
  *agentNote(agent, text) {
    if (!this.toolActivity || agent.collapsed) return;
    if (agent.lines >= NESTED_MAX_LINES) {
      agent.collapsed = true;
      yield* this.whole(REASONING, `${NESTED_PREFIX}… (further agent activity hidden)`);
      return;
    }
    agent.lines += 1;
    yield* this.whole(REASONING, `${NESTED_PREFIX}${text}`);
  }

  /** Close an agent's streamed blocks and silence it (its result has arrived, or the turn ended). */
  *closeAgent(agent) {
    for (const block of agent.open.values()) yield this.end(block);
    agent.open.clear();
  }

  /** One nested streaming partial frame — the agent's own message being written live. */
  *nestedPartial(parentId, ev) {
    const agent = this.agentOf(parentId);
    if (!agent) return;
    switch (ev.type) {
      case "message_start": {
        yield* this.closeAgent(agent);
        const id = ev.message?.id;
        if (id) agent.streamedIds.add(id);
        return;
      }
      case "content_block_start": {
        const cb = ev.content_block ?? {};
        if (cb.type !== "text" && cb.type !== "thinking") return;
        if (!this.toolActivity || agent.collapsed) return;
        const { chunks, block } = this.start(REASONING);
        agent.open.set(ev.index ?? -1, block);
        yield chunks[0];
        yield { type: "reasoning-delta", index: block.index, text: NESTED_PREFIX };
        block.text = NESTED_PREFIX;
        return;
      }
      case "content_block_delta": {
        const block = agent.open.get(ev.index ?? -1);
        if (!block) return;
        const delta = ev.delta ?? {};
        const text = typeof delta.text === "string" ? delta.text : typeof delta.thinking === "string" ? delta.thinking : "";
        if (text === "" || block.text.length >= NESTED_TEXT_LIMIT) return;
        const room = NESTED_TEXT_LIMIT - block.text.length;
        const shown = text.length > room ? text.slice(0, room) : text;
        block.text += shown;
        yield { type: "reasoning-delta", index: block.index, text: shown };
        return;
      }
      case "content_block_stop": {
        const block = agent.open.get(ev.index ?? -1);
        if (!block) return;
        agent.open.delete(ev.index ?? -1);
        if (block.text.length >= NESTED_TEXT_LIMIT) block.text += "…";
        yield this.end(block);
        return;
      }
      default:
        return; // message_delta / message_stop / ping: bookkeeping only
    }
  }

  /** One nested whole `assistant` frame — the agent's message when the CLI emitted no partials. */
  *nestedAssistant(parentId, message) {
    const agent = this.agentOf(parentId);
    if (!agent) return;
    if (message.id && agent.streamedIds.has(message.id)) return;
    if (message.id) agent.streamedIds.add(message.id);
    yield* this.closeAgent(agent);
    const content = Array.isArray(message.content) ? message.content : [];
    for (const cb of content) {
      if (!cb || typeof cb !== "object") continue;
      if ((cb.type === "text" || cb.type === "thinking") && typeof (cb.text ?? cb.thinking) === "string") {
        yield* this.agentNote(agent, clip(cb.text ?? cb.thinking, NESTED_TEXT_LIMIT));
      } else if (cb.type === "tool_use") {
        if (cb.id && cb.name) agent.toolNames.set(cb.id, cb.name);
        yield* this.agentNote(agent, toolCallLine(cb.name ?? "tool", JSON.stringify(cb.input ?? {})));
      }
    }
  }

  /** One nested `user` frame: a tool result from inside the agent's own run. */
  *nestedToolResults(parentId, content) {
    const agent = this.agentOf(parentId);
    if (!agent || !Array.isArray(content)) return;
    for (const cb of content) {
      if (!cb || cb !== Object(cb) || cb.type !== "tool_result") continue;
      const name = agent.toolNames.get(cb.tool_use_id) ?? "tool";
      yield* this.agentNote(agent, toolResultLine(name, textOf(cb.content), cb.is_error === true));
    }
  }

  /** The final `result` frame: usage, then the terminal finish (nothing may follow it). */
  *result(event) {
    this.finished = true;
    yield* this.closeOpen();
    for (const agent of this.agents.values()) yield* this.closeAgent(agent);
    this.agents.clear();
    const usage = usageOf(event.usage);
    if (usage) {
      this.resultUsage = usage;
      yield { type: "usage", usage };
    }
    yield { type: "finish", reason: finishReason(event) };
  }
}

export { oneLine };
