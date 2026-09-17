# DSH Terminal Plugin

`dsh-plugin-terminal` gives DeepSeek Harness complete terminal capability: a
terminal toggle in the Session header that opens an interactive panel along the
bottom of the frame, plus local and remote PTY tools an agent can call directly.
The panel and the tools share one PTY manager, and every session is bound to the
owner that created it, so another owner cannot read or operate a session even
when it knows the `sessionId`.

## Host support

- Both hosts share one package, `dsh-plugin-terminal`: no desktop-only package or
  code branch, no separate repository, and one implementation for both.
- The dock and agent tools share one PTY manager: a local PTY runs via the host's
  subprocess service wrapped by `sandboxPolicy`, an SSH PTY reuses `sshWorkbench`
  workspace facts — host-agnostic official services, so both hosts behave the same.
- The plugin uses only official services, slots, and patches; desktop-only
  capability never enters the top-level `inject` — see [dsh-desktop plugin development](https://github.com/anywhere-labs/dsh-desktop/blob/master/docs/plugin-development.md).
- A fresh DSH Desktop instance passed the terminal panel suite 66/66 in one round
  (local and SSH workspaces, create and close, interrupt, reserved layout); the Web
  host is covered by unit tests and `tests/web-check.mjs`.

## Features

- Bottom dock: the toggle in the Session header opens one panel across the full
  width right of the left column, pinned to the bottom of the frame, and pushes
  the composer and the right column up so both stay visible. The top edge drags
  to resize, the tab strip switches between terminals, and the new, close, and
  collapse controls sit on the right.
- Interactive terminal: xterm.js rendering with direct keyboard input,
  ANSI/UTF-8, cursor addressing and fullscreen TUIs, scrollback, and size
  synchronization. `Ctrl/Cmd+Shift+C` copies and `Ctrl/Cmd+Shift+V` pastes.
- Multiple sessions: one workspace can hold several terminals, and each of them
  runs in the Session's own environment. Panel sessions survive a page refresh;
  the panel reattaches to them when reopened.
- Local sessions compose `@deepseek-ai/dsh-terminal`,
  `@deepseek-ai/dsh-terminal-bash`, and
  `@deepseek-ai/dsh-tool-terminal`, exposing `terminal_open`,
  `terminal_send`, `terminal_read`, `terminal_signal`,
  `terminal_close`, and `terminal_list`.
- Remote sessions expose `remote_terminal_open`,
  `remote_terminal_send`, `remote_terminal_read`,
  `remote_terminal_signal`, `remote_terminal_close`, and
  `remote_terminal_list`.
- Terminals follow the workspace: when SSH binds a remote workspace, the panel
  starts a remote PTY on that connection in its directory; otherwise it starts a
  local PTY. A read-only Session may inspect terminals but not create or write.
- Remote connections reuse `~/.ssh/config`, the SSH agent, and
  `known_hosts`; tool arguments never accept passwords, private keys, or
  credential values.
- SSH uses `-tt`, `BatchMode=yes`, `StrictHostKeyChecking=yes`, and
  keep-alive options. Agent-facing output is ANSI-cleaned, bounded, and redacted
  for common token shapes.
- Agent, Session, and plugin disposal waits for the owned PTY process to
  terminate.

Remote readiness is inferred from output silence. `inferred_idle` and
`timeout` return control to the caller but do not prove that a remote
foreground command exited. Read again or send an explicit follow-up when that
distinction matters.

## Install

Node.js 22.19 or later, local OpenSSH, and a configured SSH alias with trusted
host keys are required. Complete SSH-agent, `known_hosts`, and login setup in a
system terminal before opening a remote session.

```sh
dsh plugin --profile migration add "file:/absolute/path/to/dsh-plugin-terminal"
```

Keep the `file:` prefix for a local path; otherwise pnpm creates only a
`link:` and does not install the plugin dependencies.

Restart Harness after installation. The `dsh-plugin-suite` bundle can enable
the browser, SSH, memory, terminal, sidebar, and workbench bundles together.

The panel ships its xterm asset as `assets/terminal.js` and
`assets/terminal.css`. Run `npm run build` after changing `client.js` or the
xterm versions; `prepack` runs the same step.

## The terminal dock

The terminal toggle in the Session header opens the dock: it spans from the right
edge of the left column to the window edge, sits on the bottom of the frame, and
reserves its strip so the composer and any open right column stay visible. The
same toggle collapses it again.

`+` creates a terminal in the Session's own workspace, and the bar states that
environment (`本机` or `SSH · <connection>`): a local workspace starts a local
terminal, an SSH workspace starts a remote terminal in that connection's
directory, and no target has to be chosen first. A dot on a tab means the session
is still running; a grey dot means it exited. Open state, height, and the current
tab are stored in the browser only.

A local dock terminal is wrapped by the current Session's sandbox policy before it
is spawned, matching the mode the Session shows. A policy that needs a sandbox
provider this deployment does not have fails with `TERMINAL_SANDBOX_UNAVAILABLE`
instead of falling back to an unconfined shell.

The dock and the agent tools share the terminal manager but not their owners:
dock terminals belong to the Session, agent terminals belong to the Agent.
Both carry `local-pty-` or `remote-pty-` ids and cannot cross owners.

## Local sessions

```json
{"type":"shell","name":"main"}
```

Use the returned `sessionId` with `terminal_send`, `terminal_read`, and the
other local tools. Persistent sessions preserve the working directory,
environment, and REPL state; use a one-shot shell tool for bounded commands.

## Remote sessions

```json
{"host":"dev","cwd":"/srv/project","name":"dev-shell"}
```

After opening a session:

1. Send input with `remote_terminal_send`.
2. Inspect bounded scrollback with `remote_terminal_read`.
3. Deliver an allowed signal with `remote_terminal_signal`.
4. Close it with `remote_terminal_close`.

An optional host allowlist can be supplied in the profile patch:

```yaml
- id: dsh-plugin-terminal
  config:
    hosts: [dev, staging]
```

Workspace paths, file operations, and one-shot remote batch operations remain the
responsibility of the Harness workspace service and `dsh-plugin-ssh`; a remote
terminal is an explicit PTY session, not a local workspace.

## Feature screenshots

![Local PTY terminal reference](docs/screenshots/local-terminal.png)

![Remote SSH terminal reference](docs/screenshots/remote-terminal.png)

These are traceable PI-Desktop interaction references. See
[`docs/screenshots/SOURCES.md`](docs/screenshots/SOURCES.md) for provenance and
validation boundaries. They contain no passwords, private keys, tokens, or other
credentials.

## Security boundary

Remote sessions require a working OpenSSH installation and inherit the Harness
sandbox and approval policy. Read-only sessions reject remote terminal actions;
constrained sessions request Harness approval before opening, sending, signalling,
or closing. Panel terminals follow the current Session policy: a read-only
Session cannot create, write, signal, or close them. The remote account retains
its server-side authority, and aliases containing `ProxyCommand` or similar
directives must be trusted.

## Verify

```sh
npm ci
npm test
```

The suite covers host and path validation, SSH arguments, output bounds, token
redaction, owner fencing, panel workspace resolution, read-only rejection,
signalling, and cleanup. It does not authenticate to a real server; live
connectivity requires the user's SSH configuration and explicit authorization.

## Development docs

- [`docs/spec.md`](docs/spec.md): panel, tool, and session contract.
- [`docs/e2e.md`](docs/e2e.md): panel and local/remote terminal scenarios.
- [`README.md`](README.md): 中文主文档。

## License

LGPL-3.0-only. Official Harness dependencies retain their own licenses and notices.
