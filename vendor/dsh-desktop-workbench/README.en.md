# DSH Desktop Workbench plugin

`dsh-desktop-workbench` is a plugin based on the [anywhere-labs/dsh-desktop](https://github.com/anywhere-labs/dsh-desktop) repository and written against its plugin guide: it uses only the public `desktopProfiles` Host service and gives the workbench deployment its desktop-side profile and service control.

Its Web counterpart is [`dsh-plugin-workbench`](https://github.com/hzxwonder-dsh-plugins/dsh-plugin-workbench). That repository owns the composition itself (the official `time-context` and `schedule` rows plus session full-text search) and ships a local service supervisor, `bin/local.mjs`, which starts and stops its own Harness service. Inside DSH Desktop neither belongs to a plugin: the shell owns the service and the profile, so the supervisor has no counterpart here. What the desktop side needs is the shell's own control surface — read the active profile, see which profiles the launcher can layer itself over, and request one restart-safe switch — and that is what this plugin provides.

The composition is not duplicated here: the plugin only reports whether the active profile carries `dsh-plugin-workbench`. This is a desktop-only plugin: `desktopProfiles` is a required injection, so an ordinary `dsh web` host keeps it pending.

## Usage

```sh
# In the DSH Desktop terminal, install it into the active profile, then restart Desktop
dsh plugin --profile desktop add github:hzxwonder-dsh-plugins/dsh-desktop-workbench
```

After the restart there are two entry points with identical behavior:

- the in-session slash command `/desktop-workbench status`, `/desktop-workbench list`, `/desktop-workbench select <profile>`;
- the agent tool `desktop_workbench` with `action` set to `status`, `list`, or `select`; `select` also needs `profile`.

`status` is read-only: it reports the active profile name and directory and whether that profile declares, installs, and composes the workbench package. `list` is read-only: it lists every profile from `desktopProfiles.list()` with its selectability facts (whether it exists, whether the launcher can layer itself over it, its bundle count, and any blocking diagnostic). `select` validates the target against that same list, persists it, and requests one orderly restart, answering with `restartRequired: true`.

## Differences from the Web side

| Aspect | Web `dsh-plugin-workbench` | Desktop `dsh-desktop-workbench` |
| --- | --- | --- |
| Role | Composition bundle: inserts the official time-context and schedule rows and configures session full-text search | Control surface: the active profile and whether the composition is in place |
| Service lifecycle | `bin/local.mjs` supervisor starts and stops its own Harness service | The shell owns service and profile; a switch goes through `desktopProfiles.select()` and is a restart |
| Profile identity | Caller-supplied `DSH_HOME` and profile | `desktopProfiles.current`, no other source |
| Composition rows | Inserted by its own `cordis.patch.yml` | Not inserted again; only read and reported |

## Configuration

A profile patch layer can override the composition package name (default `dsh-plugin-workbench`):

```yaml
- id: dsh-desktop-workbench
  config:
    composition: dsh-plugin-workbench
```

## Safety boundary

- A read-only Session cannot switch profiles; an invocation that carries an agent needs approval; full-access mode and a command the user typed are already explicit decisions.
- A switch is validated against `desktopProfiles.list()` first: an unknown profile, a profile the launcher cannot layer itself over, and a profile with a blocking diagnostic are all refused before any selection state is written.
- It only reads the active profile manifest and `node_modules` and never edits profile files; persisting the selection stays with Desktop.
- A switch restarts the application: the result always carries `restartRequired`, and no service reference survives the current Cordis generation.

## Verification

```sh
npm test
```

Ten unit tests cover configuration and profile-name validation, profile summary mapping, the selectability facts, the composition read, read-only actions that never touch the selection state, a switch that persists exactly one validated target, approval plus read-only and Session gating, the command grammar and its usage output, result rendering, and the bundle patch the package declares. A real switch still needs a live DSH Desktop run; the procedure is in [`docs/desktop-contract.md`](docs/desktop-contract.md).

## License

LGPL-3.0-only.
