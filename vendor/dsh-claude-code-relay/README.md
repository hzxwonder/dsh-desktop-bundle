# dsh-claude-code-relay

The Claude Code CLI as a first-class LLM provider for [dsh](https://github.com/deepseek-ai/dsh) (DeepSeek Harness), driven against an **Anthropic-compatible relay station with base_url + api_key**.

Every turn spawns one `claude -p --input-format stream-json --output-format stream-json` child with `ANTHROPIC_BASE_URL` and the relay key (`ANTHROPIC_AUTH_TOKEN` or `ANTHROPIC_API_KEY`) in its environment. Claude Code's own agent loop, tools (Bash, Read, Edit, …) and session resume keep working, while all model traffic goes to the relay — no OAuth login, and no need for the relay to know anything about Claude Code's native connection.

Inspired by [dsh-oh-my-claude](https://github.com/lcestou/dsh-oh-my-claude), which reuses the CLI's subscription login. This plugin targets relay channels that only hand out a base_url and an api key: it carries one Settings page (connection, model visibility, tool approval) and stays otherwise lean — no SSH boxes, no cost tracking, zero runtime dependencies, no build step (plain ESM JavaScript). See [README.zh.md](README.zh.md) for the full configuration table in Chinese.

## Prerequisites

- The Claude Code CLI on the machine that runs dsh (`claude --version` works); it does not need to be logged in.
- An Anthropic-compatible relay: serves `<baseUrl>/v1/messages` and accepts `Authorization: Bearer` or `x-api-key`.

## Install

```sh
dsh plugin --profile web add /path/to/dsh-claude-code-relay   # local directory
# or, once published: dsh plugin --profile web add dsh-claude-code-relay
# then restart dsh
```

The package declares `dsh.bundle.patch` and a client bundle, so `dsh plugin add` registers it in the profile's bundle list automatically. After a restart, "Claude Code Relay" appears in dsh's model picker and a dedicated **Claude Code** page appears in Settings.

## Configure

**Recommended: the Settings page.** After a restart, open Settings → Claude Code, fill in the relay base URL and API key, and press **Save** at the bottom of the page. Saves apply live (they land in the `claude-code-relay` namespace of `~/.dsh/settings.yaml`) — no restart. The page commits as one atomic write: every field shares a single revision fence, so a concurrent change from another window is refused rather than silently overwritten, and **Discard changes** restores the draft. The key is stored redacted and saved by its own button: the page shows "configured" instead of the value, and typing a new one replaces it. Settings-page values take precedence over config files.

**Config file (optional):** the bundle row's `config:` in the profile's `cordis.patch.yml` (e.g. `~/.dsh/profiles/web/cordis.patch.yml`) provides the defaults underneath the Settings page:

```yaml
- id: claude-code-relay
  config:
    baseUrl: https://your-relay.example.com
    apiKeyEnv: CLAUDE_RELAY_API_KEY      # recommended: keep the key out of config files
    models:
      - id: claude-sonnet-4-5
        name: Claude Sonnet 4.5
      - id: claude-opus-4-1
        name: Claude Opus 4.1
```

The key comes from `apiKey` (literal) or `apiKeyEnv` (an environment variable of the dsh process); `apiKey` wins when both are set. With no `baseUrl` from either surface the provider still appears, and sending a message yields a clear not-configured error.

Key settings (all keys are documented in [README.zh.md](README.zh.md)):

| Key | Default | Meaning |
| --- | --- | --- |
| `baseUrl` | `""` | Relay URL injected as `ANTHROPIC_BASE_URL`; the CLI requests `<baseUrl>/v1/messages`. Fill it in Settings → Claude Code |
| `apiKey` / `apiKeyEnv` | `""` | The relay key, literal or via an env-var name |
| `authHeader` | `auth-token` | `auth-token` sends `Authorization: Bearer`; `api-key` sends the `x-api-key` header |
| `command` | `claude` | Claude Code binary (PATH name or absolute path) |
| `providerId` / `displayName` | `claude-code-relay` / `Claude Code Relay` | Route id and display name in the picker |
| `models` | sonnet/opus/haiku 4.x | Picker entries; each `id` goes to `claude --model` verbatim |
| `autoModels` | `true` | Prefer the relay's own `/v1/models` answer for the model list (cached for a minute); the configured `models` are the fallback |
| `permissionMode` | `dsh` | `dsh` follows the session's access shield (see below), or a fixed mode |
| `visibleModels` | `[]` | Model ids offered in dsh's picker; empty shows every model. Ticked in the Settings page |
| `approvalBridge` | `true` | Answer the CLI's tool-permission prompts through a `PreToolUse` hook; off leaves the CLI its own path |
| `approvalMode` | `auto` | `auto` decides from the session's access shield; `ask` waits for you in the Settings page |
| `approvalTimeoutMs` | `120000` | How long an `ask` prompt waits before it is denied |
| `resume` | `true` | One Claude Code session per dsh session (`--session-id`, then `--resume`) |
| `configDir` | `""` | `CLAUDE_CONFIG_DIR` for the child; isolates relay sessions/settings/skills from your own `~/.claude` |
| `extraEnv` / `extraArgs` | `{}` / `[]` | Extra child env vars (highest precedence) and CLI arguments |

A second relay is a second row: different `id`, same `name`, its own `providerId`.

## Permissions: how the access shield reaches Claude Code

`claude -p` is a headless child with nobody to answer its permission prompts. Leaving approval to the CLI's own interactive gate is what makes tools fail for no visible reason, so dsh's file policy is translated into CLI flags up front and every turn starts with a settled permission state:

| Session shield | `--permission-mode` | Tool allow / deny lists |
| --- | --- | --- |
| `read-only` | `default` | allows `Read`/`Glob`/`Grep`/`NotebookRead`/`TodoWrite`/`Task`/`WebFetch`/`WebSearch`, denies `Edit`/`Write`/`NotebookEdit`/`Bash`/`BashOutput`/`KillShell` |
| `workspace-write` | `acceptEdits` | allows `WebFetch`/`WebSearch` (network reading; dsh's own `web_fetch` already runs under this shield, while the CLI would stall those calls on a permission prompt no `-p` child can answer) |
| `danger-full-access` | `bypassPermissions` | none |

Pinning `permissionMode` to a fixed value overrides the table above and drops its tool lists.

Those lists settle what Claude Code itself will consider. What backs them up is the approval bridge below — both read the same shield, so they cannot contradict each other.

## Tool approval

Claude Code gates its own tool calls, and a headless run has nobody to answer its prompts: the call simply ends as a failed tool, which is where "the tool broke for no reason" comes from. The plugin takes that path over through a `PreToolUse` hook. Before each tool call the CLI runs a hook process, which forwards the call here and hands the verdict back. The hook is injected through a per-invocation `--settings` document, never written into your own `~/.claude`, so it applies to this plugin's conversations only.

Two decision modes (`approvalMode`):

- **`auto` (default)** — decided from the session's access shield: inside it, allowed; outside it, refused. Nothing interrupts you, and the refusal appears in the conversation verbatim, e.g. `"Write" is outside this session's dsh access policy`.
- **`ask`** — every gated call appears under Tool approval in the Settings page and waits for Allow once or Deny. `approvalTimeoutMs` bounds that wait (120s by default); on timeout the call is denied. **Nothing can leave Claude Code blocked indefinitely.**

A verdict covers one call only. An unreachable bridge, a malformed hook request, or a session that ends early all deny: every failure path lands on the conservative side and never silently allows. Turning `approvalBridge` off only disables tool approval; the compaction-notice hook below stays.

## Context compaction

Long conversations are compacted by **Claude Code itself** — it owns the `--resume` session and transcript, while a dsh-side compaction would save no tokens (the CLI session stays full; you would just pay for a second summary). The plugin makes the process fully visible in dsh web:

- **Threshold ordering** — the CLI is handed `CLAUDE_CODE_AUTO_COMPACT_WINDOW = 0.7 × contextWindow` (clamped to the CLI's 100K–1M range). dsh's own compactor wakes at `0.8 ×` the same window, so the CLI **always compacts first**, usage resets, and dsh's compactor never fires — no two oblivious compactions double-billing. Your own value of that variable wins.
- **Instant start notice** — the CLI prints nothing on stdout while it compacts (upstream declined to add a start event; see [anthropics/claude-code#48740](https://github.com/anthropics/claude-code/issues/48740)), but the `PreCompact` hook fires immediately. The hook reaches the plugin's socket bridge and the notice lands in the streaming conversation at once: "⇣ compacting context…" instead of a one-to-three-minute freeze.
- **Readable outcome** — the post-compaction `compact_boundary` frame renders as "⇣ context compacted: 117766 → 1705 tokens (auto, 33.2s)" (snake_case on the wire, the transcript file's camelCase tolerated), and the CLI's continuation summary (`isSynthetic` frame) as "⇣ context continues from a compacted summary: …". The CLI's `api_retry` frames render as "↻ relay retry" too, so relay retries stop being silent waits.

Context metering trusts the per-turn `result` usage: the CLI also silently drops stale tool results on resume (measured 330K → 118K with no boundary frame at all), so usage is the only honest account — and it is what the plugin already reports.

## Resident process

Each session rides one **long-lived CLI process**: with `claude -p --input-format stream-json` keeping stdin open, later turns arrive as further lines (verified against the real CLI), so from the second turn on nothing respawns. Three wins:

- **Faster** — no 1–3s CLI startup per turn (settings, skills, MCP handshake). Measured 7.7s cold → 4.3s warm within one session.
- **Sounder** — no more "does the transcript exist yet" race to decide `--resume`: the live process *is* the history.
- **Cheaper** — a warm turn's request hits the upstream cache incrementally (measured `cache_read 62K / only 4.4K newly written` on turn two), where a cold spawn misses.

The lifecycle manages itself: retired after 10 idle minutes; respawned when the model, thinking effort, system prompt, or access shield changes mid-session (those are baked in at spawn); dropped on abort or crash — the CLI's persisted transcript is the recovery point, and the next turn `--resume`s it with memory intact (verified: a codeword survived a kill). The Settings page's "Resident process" toggle (`resident`, default on) falls back to one CLI per turn. Side calls (session titles) never touch the resident. When the host exits, the closing stdin pipe is the child's cue to leave — no orphans.

## Reasoning effort

The provider declares its ladder (low / medium / high / xhigh / max, defaulting to medium) through dsh's model-capability contract, so dsh's picker shows a thinking-effort control and the selection rides `claude --effort` verbatim. Declaring the ladder is required: dsh validates every explicit effort against the levels a model reports, so a model that declares none has its effort request rejected before it is ever sent.

## Which models appear at home

dsh builds its model picker straight from the provider's model list, so "which models show" is "what the list returns". The Settings page reads the relay's available models and offers them as checkboxes. **Ticking none shows everything**, so a fresh configuration never ends up with an empty picker; an unticked model stays callable, it is only hidden from the selector.

## What it touches

- **Runs** the configured `claude` binary, one child per turn, with the relay URL and key in its environment.
- **Reads** dsh session info (for the working directory) and the attachment store (images inlined as base64).
- **Writes** Claude Code's own transcripts (`<configDir or ~/.claude>/projects/...`); the key never lands on disk.

## Not included, compared with oh-my-claude

Approval runs through the plugin's own panel (Settings → Claude Code), not dsh's general approval dialog: that channel serves only the tools dsh itself executes, and here the tools run inside the `claude` child — dsh never dispatched them, so no path carries a child's request into it. Also no MCP bridge to dsh subagents, no cost/plan panel, no SSH remote boxes, no CLI update management; Windows untested. A running Task/Agent subagent of the CLI is shown live in the chat as indented reasoning lines (`  ↳ …`) nested under its call line — the subagent's own thinking, tool calls, and results, budgeted at 480 characters per block and 40 lines per run; its final report lands in the `◂` result line. The difference from dsh-native subagents: no separate child session, no "n subagent" entry in the session hierarchy, and nested content renders as reasoning lines rather than structured cards (dsh's provider stream contract only understands text and reasoning blocks, so a native card cannot be faked).

## Tests

```sh
npm install && npm test    # 96 cases: pure helpers, the approval and compaction bridges (real socket round trips and the real hook script), the resident process (reuse/respawn/idle retirement/frame drain), fake-CLI end to end (including a compaction turn), and the shipped client bundle rendered against a fake React
```

## License

MIT. Claude and Claude Code are trademarks of Anthropic, PBC; this is an independent third-party plugin.
