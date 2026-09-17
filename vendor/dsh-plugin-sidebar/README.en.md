# DSH Workspace Sidebar

[中文主文档](README.md)

`dsh-plugin-sidebar` provides independently enabled workspace views for DeepSeek
Harness Web. It renders the current session's workspace as files, with a compact
toolbar, directory tree, and continuous preview layout. Harness owns the native
tabs, docking, floating, fullscreen, and panel resizing.

Terminals are not part of this plugin: local and SSH terminals belong to
[`dsh-plugin-terminal`](https://github.com/hzxwonder-dsh-plugins/dsh-plugin-terminal),
which renders them in a dock panel under the composer and shares one PTY manager
with the agent tools.

## Host support

Web (`dsh web`) and Desktop (DSH Desktop) share one package, `dsh-plugin-sidebar`; there is no desktop-only repository to maintain, and both hosts are served by this repository's implementation.

- The sidebar registers on the official `sidebar` / `sidebarRight` slots (the right pane uses `sidebar.right.pane.tab` and `ctx.sidebarRightTabs`).
- Local files go through the host workspace and sandbox services, and remote files go through the `sshWorkbench` service. These are official services and slots, so Web and Desktop behave the same.
- The plugin puts no host-specific capability into the top-level `inject` and does not depend on host internals; see the [plugin development guide](https://github.com/anywhere-labs/dsh-desktop/blob/master/docs/plugin-development.md).
- Verification status: Web is covered end to end by unit tests and `dsh-plugins/tests/sidebar-check.mjs`; on Desktop only the plugin load and the client entry were confirmed on a DSH Desktop instance, and file-tree interactions have not yet been verified item by item there.

## Features

- Local workspaces show local directories; remote workspaces show the
  directories of the selected SSH server.
- Directory expansion, name filtering, hidden files, and bounded read-only text
  previews.
- Markdown preview, file size hints, and explicit errors for binary or oversized
  files.
- Switching server, workspace, or session discards stale requests; returning to a
  workspace resumes browsing it.
- Light and dark themes with a narrow layout and hover labels on icon buttons.

## Install

Node.js 22.19 or later and a Harness profile with the official Web sidebar
modules are required. From a local source tree:

```sh
dsh plugin --profile migration add "file:/absolute/path/to/dsh-plugin-sidebar"
```

Remote directories require `dsh-plugin-ssh` from the same source release. The
`dsh-plugin-suite` bundle can enable all six member plugins at once; restart
Harness afterwards.

Configure servers under SSH connections in settings, add a remote workspace, and
open the Files tab in a conversation belonging to that workspace. The sidebar and
the terminal panel share the same server-side workspace target. The browser plugin
can contribute its own tab to the same native sidebar.

## Enabling and disabling

Add this entry to `$DSH_HOME/profiles/migration/cordis.patch.yml` and restart:

```yaml
- id: dsh-plugin-sidebar
  disabled: true
```

Disabling restores the native Files view; the terminal panel is unaffected. Set
`disabled` to `false` to re-enable. Plugin disposal removes its registrations and
styles. Suite-installed members support the same configuration.

## Data and permissions

The sidebar reads remote directories and text for on-page display; remote file
content is never persisted locally. Local indexing and metadata belong to the SSH
plugin. The server derives the host and root from the Session, and a request's
workspace key must match the current target; traversal and paths resolving outside
the local root are rejected. An unavailable remote workspace reports an error and
keeps its remote identity.

Local text previews are limited to 64 KiB and a directory to 2000 entries; remote
limits come from the SSH plugin. Binary and unsupported text encodings report a
preview error. The sidebar is read-only: writes and terminal operations belong to
the terminal panel and the agent tools.

## Feature screenshots

![Remote workspace files](docs/screenshots/remote-workspace.png)

![Files view in the dark theme](docs/screenshots/remote-files-dark.png)

The screenshots come from a locally running Harness Web and Chrome with a
disposable profile and synthetic data. See
[screenshot and acceptance records](docs/screenshots/SOURCES.md) for the
validation scope.

## Verify

```sh
npm test
```

The suite covers workspace identity derivation, stale-request fencing, traversal
and symlink escape rejection, bounded reads, rejection of terminal actions on the
files API, and read-only sessions.

## License

LGPL-3.0-only, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
