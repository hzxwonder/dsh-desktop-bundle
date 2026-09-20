# DSH Desktop Bundle

A DSH Desktop environment assembled from pinned versions: this repository carries
the source snapshots of eleven released plugins, `setup.sh` composes them into one
Desktop profile, and Releases carry the matching application installer. Users do
not install plugins one by one and do not have to reconcile plugin versions — one
repository, one tested version set.

## Layout

| Path | Contents |
| --- | --- |
| `setup.sh` | Assembles plugins, profile and launcher state into a target DSH home |
| `build-dmg.sh` | Builds the dmg from a pinned desktop revision (maintainers) |
| `vendor/` | Source snapshots of the eleven plugins, each pinned to a release |
| `templates/` | Profile manifest, pnpm workspace and `cordis.patch.yml` templates |
| `scripts/` | Compose, register, verify and sync scripts |
| `docs/` | Install, build and plugin-update notes |
| `manifest.json` | The single version manifest: desktop revision, plugin versions and commits, runtime dependencies |

Plugin set: `dsh-plugin-suite`, `dsh-plugin-browser`, `dsh-plugin-project-memory`,
`dsh-plugin-ssh`, `dsh-plugin-terminal`, `dsh-plugin-sidebar`, `dsh-plugin-workbench`,
`dsh-plugin-workflow`, `dsh-plugin-sessions`, `dsh-desktop-suite`, `dsh-desktop-workbench`.

## Install

Requirements: macOS arm64, Node.js ≥ 24, npm, pnpm (`npm i -g pnpm`).

```bash
# 1. install the desktop application (dmg from Releases, see "Application source")
# 2. fetch this repository
git clone https://github.com/hzxwonder/dsh-desktop-bundle.git
cd dsh-desktop-bundle

# 3. one command
./setup.sh --app ~/Downloads/DSH-Desktop-2.0.10-arm64.dmg
```

`setup.sh` installs the application (when `--app` points at a dmg), installs each
plugin's dependencies, writes the manifest and patch layer of
`~/.dsh-desktop/profiles/desktop`, resolves profile dependencies, registers the
home with the launcher, and runs its own checks. Model providers, credentials, SSH
connections and workspaces are then configured inside the application.

| Option | Effect |
| --- | --- |
| `--home <dir>` | Target DSH home, default `~/.dsh-desktop` |
| `--profile <name>` | Desktop profile name, default `desktop` |
| `--app <dmg\|app>` | Install the application into `/Applications` first |
| `--skip-deps` | Skip plugin dependency installation |
| `--dry-run` | Print the actions without changing anything |

With an application already installed, `./setup.sh` alone is enough: it finds
`/Applications/DSH Desktop.app` and pins the profile's `@deepseek-ai/*`
dependencies to that build's runtime version.

## Application source

`DSH-Desktop-<version>-arm64.dmg` in Releases is built by `build-dmg.sh` from a
pinned revision of [hzxwonder/dsh-desktop](https://github.com/hzxwonder/dsh-desktop),
a fork that adds the native transport behind the browser panel
(`feat(shell): host a native browser view from the desktop main process`). It is
ad-hoc signed and not notarized, so the first launch needs an explicit allow;
[docs/install.md](docs/install.md) has the steps.

The official installer works too: install it, then run `./setup.sh` for the same
plugin set. The shell-side browser panel and its native transport live in the fork,
so that part needs `build-dmg.sh` — see [docs/build.md](docs/build.md).

## Same setup, without the personal parts

The bundle deliberately separates two kinds of content:

- **Shipped here**: plugin roster and versions, profile structure, the generic
  `cordis.patch.yml` overrides (client HMR disabled, headless browser with a
  Chrome path), and the interface and runtime settings template.
- **Left to the user**: model providers and gateways, API keys, SSH connections,
  workspaces and sessions. The repository contains no personal path, credential or
  historical session.

Interface state (browser zoom, terminal panel height, sidebar tabs) lives in
localStorage per origin; the port is derived from the home path, written once into
`~/.dsh-desktop/settings.yaml`, and owned by the application afterwards.

## Verify

```bash
node scripts/verify.mjs --home ~/.dsh-desktop --app "/Applications/DSH Desktop.app"
```

The output confirms the profile files exist, all eleven plugins resolve from this
repository's `vendor/`, no plugin falls back to the application's own copy, every
package that declares `dsh.client` exports `./package.json`, runtime dependencies
are installed, and the patch layer has no unrendered placeholder. A missing
Chromium is a warning, not a failure: point `DSH_CHROME_EXECUTABLE` at a local
Chrome instead.

To confirm plugin registration inside the real shell, run the runtime check:

```bash
# Quit a running DSH Desktop first: the single-instance lock is per application,
# so a second instance exits immediately.
node scripts/verify-runtime.mjs --app "/Applications/DSH Desktop.app"
```

The home the launcher opens is named by its own locator document in Electron's
userData directory and cannot be redirected from the environment, so the script
reads that home first and then checks through the DevTools protocol whether the
client plugin bundle the renderer requested contains every client plugin this
repository vendors, and whether the console or network reported a failure. The
`launcher` line of the output names the home actually inspected; `--home` only
declares the expected value.

## Maintenance

```bash
node scripts/vendor.mjs --from <plugin-source-root>   # refresh vendor/ and versions from each repository HEAD
node scripts/vendor.mjs --check                       # report drift only
./build-dmg.sh --ref <revision>                       # produce a new dmg
```

See [docs/vendor.md](docs/vendor.md) for the sync and release flow.

## License

Each plugin under `vendor/` keeps its own license (LGPL-3.0-only,
LGPL-3.0-or-later and MIT; see each `LICENSE`). The scripts and documents here
follow the plugin family and use LGPL-3.0-only. The desktop shell comes from a
fork of [anywhere-labs/dsh-desktop](https://github.com/anywhere-labs/dsh-desktop)
under the upstream MIT license.

## Prompt library

Type `/prompt` in the composer and choose a saved template directly from the suggestion menu to insert its text. Choose “新建 Prompt 模板” to open the two-pane template editor: select or create templates on the left, edit their name and body on the right, and duplicate, delete, or save from the footer. Duplicating immediately creates and selects a saved template named “Original - copy” with the current body; matching copy names receive a numeric suffix. Includes retryable saves, deletion confirmation, and unsaved edit protection.

The complete Desktop 2.0.11 application includes the paired client and Host API. Builds use the exact manifest commit and verify both prompt components in the packaged application.
