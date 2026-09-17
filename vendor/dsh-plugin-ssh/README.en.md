# DSH SSH Plugin

[中文（主文档）](README.md)

SSH connections, remote workspaces, directory selection, and remote file operations for DeepSeek Harness Web. Settings, the composer, and the right file panel share the active remote project.

## Host support

DeepSeek Harness runs as a Web host (`dsh web`) and as DSH Desktop, and this plugin serves both.

- One package for both hosts: a single implementation in this repository provides `dsh-plugin-ssh` to Web and desktop, with no desktop-specific branch.
- No separate desktop repository: the plugin repository is [hzxwonder-dsh-plugins/dsh-plugin-ssh](https://github.com/hzxwonder-dsh-plugins/dsh-plugin-ssh), and the desktop host repository is [anywhere-labs/dsh-desktop](https://github.com/anywhere-labs/dsh-desktop).
- Desktop-only capabilities stay out of the top-level `inject`: it declares `tools`, `subprocess`, and `commands` only. Per the [desktop plugin specification](https://github.com/anywhere-labs/dsh-desktop/blob/master/docs/plugin-development.md), a plugin shared by both hosts must probe desktop-only capabilities behind `ctx.get?.('<service>')`, because only Desktop-only plugins declare `desktopProfiles` and `desktopPnpm` there. This plugin likewise reads services such as `settings`, `sessions`, and `credentials` as optional capabilities.
- Verification boundary: `npm test` and the checks in the [acceptance notes](docs/e2e.md) target the Web host and local OpenSSH and cover the implementation both hosts share. This revision has no itemized acceptance record on a DSH Desktop instance.

## Install

Requires Node.js 22.19+, local OpenSSH, and remote Python 3. Use the same DSH_HOME for installation and startup:

~~~sh
git clone https://github.com/hzxwonder-dsh-plugins/dsh-plugin-ssh.git
cd dsh-plugin-ssh
npm ci
dsh plugin --profile migration add "file:$PWD"
~~~

Keep the file: prefix to install dependencies. Restart Harness after installing or editing the plugin; connection settings apply live. Verify the server fingerprint in a system terminal and establish a trusted known_hosts entry before connecting.

## Connections

Open Settings → SSH Connections to add a connection or import selected aliases. Discovery reads concrete aliases from ~/.ssh/config and bounded Include files. Import preserves existing names and settings. Loading failures display an error and a retry action.

![Connection settings](docs/screenshots/ssh-settings.png)

![Select aliases to import](docs/screenshots/ssh-import.png)

The form supports display name, host, account, port, SSH agent, identity file, and password authentication. Advanced settings include a default directory (~ or an absolute path), jump host, timeout, and keepalive interval.

Enter passwords only in the settings form. Temporary passwords remain in process memory; remembered passwords use the Harness local credential service. Settings and tool results do not contain password values.

![Add a connection](docs/screenshots/ssh-add-connection.png)

## Remote workspaces and sessions

Choose Add Workspace → Remote Workspace, select a connection, and browse to a directory. The picker supports direct path entry, parent navigation, refresh, filtering, and hidden directories. Confirming creates a workspace and session. New sessions in that workspace inherit its remote target, which persists across reloads.

![Remote directory picker](docs/screenshots/remote-directory.png)

![Remote workspace](docs/screenshots/remote-workspace.png)

In an existing session, type `/ssh` and press Enter to open the same picker. The selected directory is inserted into the prompt as a PI-Desktop-style inline reference chip. Click the chip to choose again; detaching affects only the current session.

![Remote session target](docs/screenshots/remote-composer.png)

The model uses the ssh tool for remote files and commands. Install [DSH Terminal](https://github.com/hzxwonder-dsh-plugins/dsh-plugin-terminal) for interactive shells. Ordinary local file and shell tools continue to operate on the local machine; the remote target does not redirect them.

## Tools and commands

| Actions | Purpose |
| --- | --- |
| connections, import, save_connection, remove_connection | Manage saved connections |
| connect, probe, hosts | Probe connections and discover hosts |
| setTarget, getTarget, clearTarget, projects | Session targets and project history |
| listFiles / list, readFile / read, write | Remote directories and files |
| exec | Remote commands with bounded output and exit status |
| passwordStatus | Check whether a password is configured |

Select a connection with connectionId or target: {connectionId, path}. Calls without a connection selector inherit the session target. File paths are relative to root; text is capped at 64 KiB. Read before writing and pass its revision as baseRevision, or "missing" to create a file.

~~~json
{"action":"readFile","connectionId":"dev","root":"/srv/project","path":"README.md"}
~~~

Commands with arguments remain available:

~~~text
/ssh list
/ssh import
/ssh connect <connection-id> [~|/absolute/root]
/ssh <host> <absolute-remote-root>
~~~

Connection commands verify the directory and can bind the current session when using a saved connection. Command and model-tool mutations follow Harness sandbox and approval policy.

## Runtime boundaries

OpenSSH enforces strict host-key checks. File operations stay within the selected root and reject traversal, symlinks, hard links, and reserved lock paths. Writes use revision checks and atomic replacement. The picker permits explicit root changes. Remote commands run with the remote account's permissions; root is their working directory.

Read-only mode blocks configuration changes, target binding, file writes, and remote commands. Web actions use an authenticated Harness connection; constrained model actions additionally require approval. Interrupted operations can leave an unknown remote outcome; inspect before retrying writes.

## Verification and development

~~~sh
npm test
~~~

Tests cover alias import, authentication transport, the file protocol, safety boundaries, Web routes, workspace inheritance, and explicit detach. Screenshots come from Harness Web running in local Chrome with synthetic remote data. Real-server authentication requires the separate [acceptance checks](docs/e2e.md).

- [Interface and storage contract](docs/spec.md)
- [Screenshot provenance](docs/screenshots/SOURCES.md)

LGPL-3.0-only. The implementation follows PI-Desktop remote-workspace interactions and uses official DeepSeek Harness services. See [NOTICE](NOTICE) for attribution.
