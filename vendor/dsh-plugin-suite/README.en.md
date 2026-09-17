# DSH Plugin Suite

`dsh-plugin-suite` combines the Browser, SSH, Memory, Terminal, Sidebar, and Workbench
plugins into one installable DeepSeek Harness bundle. A single profile owns
their versions and layer order. Activation has no network or shell side
effects; updates are explicit user actions.

## Host support

DeepSeek Harness has two hosts: the Web host (`dsh web`) and the DSH Desktop host
([`dsh-desktop`](https://github.com/anywhere-labs/dsh-desktop)). This repository
maintains the Web side; `dsh-desktop-suite` maintains the desktop side.

- The Web repository is
  [`dsh-plugin-suite`](https://github.com/hzxwonder-dsh-plugins/dsh-plugin-suite);
  the desktop repository is
  [`dsh-desktop-suite`](https://github.com/hzxwonder-dsh-plugins/dsh-desktop-suite).
  Both cover the same member list: browser, project-memory, ssh, terminal, sidebar, and
  workbench.
- The Web side uses this repository's `bin/manage.mjs`, which prepares the profile
  manifest from caller-supplied absolute paths and runs one `pnpm install`, then
  converges `dsh.profile.bundles` to a single Suite layer.
- The desktop side uses only two public host services. The active profile can only come
  from `desktopProfiles.current`, and package operations go through
  `desktopPnpm.runPlugin()`, which runs the packaged `dsh plugin` CLI and owns both the
  manifest and `dsh.profile.bundles` convergence. Its actions are `status`, `install`,
  and `update`; one package operation per generation, changes require approval, and
  read-only sessions are refused.
- The two sides are separate because the desktop shell owns the profile and the package
  operation path, while this repository's assumptions (caller-supplied absolute paths
  and direct `pnpm`) do not hold on the desktop. The desktop plugin follows the DSH
  Desktop
  [plugin development specification](https://github.com/anywhere-labs/dsh-desktop/blob/master/docs/plugin-development.md):
  plugins are either cross-host or Desktop-only, and a Desktop-only plugin declares
  `desktopProfiles` and `desktopPnpm` in its top-level `inject`.
- Verification boundary: `npm test` here covers Web-side CLI planning and manifest
  writing; the desktop plugin has unit tests in its own repository, but no item-by-item
  acceptance has been performed on a DSH Desktop instance.

## Install all six

Prepare a local source directory containing all seven sibling repositories:

```text
/absolute/path/to/repositories/
├── dsh-plugin-suite/
├── dsh-plugin-browser/
├── dsh-plugin-project-memory/
├── dsh-plugin-ssh/
├── dsh-plugin-terminal/
├── dsh-plugin-sidebar/
└── dsh-plugin-workbench/
```

Run one install command from the Suite checkout:

```sh
cd /absolute/path/to/repositories/dsh-plugin-suite
npm run suite -- install \
  --profile-dir /absolute/path/to/DSH_HOME/profiles/migration \
  --source-dir /absolute/path/to/repositories
```

Both arguments must be absolute paths. The manager first validates each local
package name and bundle declaration. It then writes the Suite as a production
profile dependency, the six members as development dependencies, and runs one
`pnpm install`. Only after every package is installed does it converge
`dsh.profile.bundles` to one Suite layer. Other profile fields and unrelated
dependencies are preserved.

Restart Harness after installation. The profile composes the browser right
Sidebar and browser tools, OpenSSH connections and CAS file operations,
project-scoped memory and credential status, persistent local and remote PTYs,
workspace-aware Files and Terminal views,
and schedule/time-context plus durable session search.

Existing standalone member bundles are replaced by the Suite layer only after
all seven packages are present on disk. If installation is incomplete, the
manager keeps the original bundle order and does not remove working member
layers early.

## Update together

An update resolves all seven packages again from the same local source directory
selected during installation. Run it explicitly during a maintenance window:

```sh
cd /absolute/path/to/repositories/dsh-plugin-suite
npm run suite -- update \
  --profile-dir /absolute/path/to/DSH_HOME/profiles/migration \
  --source-dir /absolute/path/to/repositories
```

The installed package exposes the same command from the profile:

```sh
pnpm --dir /absolute/path/to/DSH_HOME/profiles/migration exec \
  dsh-plugin-suite update \
  --profile-dir /absolute/path/to/DSH_HOME/profiles/migration \
  --source-dir /absolute/path/to/repositories
```

Update requires all seven `file:` declarations in the profile to match
`--source-dir` exactly, then runs `pnpm install --force`. This prevents a single
update from mixing source trees. The script never reads or prints credentials.

The manager snapshots `package.json` and `pnpm-lock.yaml` before invoking pnpm.
It restores both files if pnpm or bundle convergence fails. `node_modules` is
outside this file-level rollback; diagnose the source or dependency issue and
rerun the same command to converge it. Restart Harness after a successful
update.

Inspect the actual installed state first when needed:

```sh
npm run suite -- status --profile-dir /absolute/path/to/DSH_HOME/profiles/migration
```

Status reports whether each package is declared, actually present in
`node_modules`, bundle-capable, directly active in the profile, and which
version/spec is in use.

## Included modules

| Module | Main capability |
| --- | --- |
| `dsh-plugin-browser` | Session-isolated browser tools and a right-Sidebar page |
| `dsh-plugin-ssh` | OpenSSH host probing, remote commands, and CAS file operations |
| `dsh-plugin-project-memory` | Project-namespaced memory and credential status |
| `dsh-plugin-terminal` | Official local PTY plus owner-isolated SSH PTY |
| `dsh-plugin-sidebar` | Workspace-aware file trees, text previews, and terminal views |
| `dsh-plugin-workbench` | Schedule reminders, time context, and durable session search |

The suite only composes these packages. Approval rules, host allowlists,
sandbox policies, and retention boundaries remain owned by each member and the
profile configuration. Read each member's Chinese `README.md` for setup and
security details.

## Capability overview

![Suite capability overview](docs/screenshots/suite-overview.svg)

This diagram describes the current bundle composition and is not a Web UI
capture. See [`docs/screenshots/SOURCES.md`](docs/screenshots/SOURCES.md) for
provenance and validation boundaries.

## Verify

```sh
npm install
npm test
```

Tests parse the bundle patch and verify local source validation, dependency
placement, real `node_modules` state, bundle deduplication, exact-source
updates, and manifest/lockfile rollback. Unit tests inject a pnpm runner;
member runtime health still requires the relevant local or remote integration
checks.

## Development docs

- [`docs/spec.md`](docs/spec.md): suite contract.
- Each member repository's `README.md`: Chinese primary documentation.
- [`README.md`](README.md): 中文主文档。

## License

LGPL-3.0-only. Member plugins and official Harness dependencies retain their own
licenses and notices.
