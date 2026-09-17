# DSH Desktop plugin-set management

`dsh-desktop-suite` is a plugin based on the [anywhere-labs/dsh-desktop](https://github.com/anywhere-labs/dsh-desktop) repository and written against its plugin guide: it uses only the public `desktopProfiles` and `desktopPnpm` Host services, and maintains one fixed set of DeepSeek Harness plugins through the desktop shell's own profile and package-manager path.

Its Web counterpart is [`dsh-plugin-suite`](https://github.com/hzxwonder-dsh-plugins/dsh-plugin-suite). There the `bin/manage.mjs` CLI prepares the profile manifest and runs pnpm directly; the desktop side does not repeat that work. It hands the same member set to the shell's package service, takes the profile from `desktopProfiles.current`, and lets the packaged `dsh plugin` CLI own the manifest and `dsh.profile.bundles` reconciliation.

This is a desktop-only plugin: both services are required injections, so an ordinary `dsh web` host keeps it pending instead of loading it half-working.

## Usage

```sh
# In the DSH Desktop terminal, install it into the active profile, then restart Desktop
dsh plugin --profile desktop add github:hzxwonder-dsh-plugins/dsh-desktop-suite
```

After the restart there are two entry points with identical behavior:

- the in-session slash command `/desktop-suite status`, `/desktop-suite install`, `/desktop-suite update`;
- the agent tool `desktop_suite` with `action` set to `status`, `install`, or `update`.

`status` is read-only: it reports the active profile name and directory, each member's declared target (`declaredSpec`), installed version, whether it entered `dsh.profile.bundles`, and whether a package operation is running. `install` adds only the members the profile does not declare; `update` re-resolves only the members it does. Both run one packaged `dsh plugin` operation and re-read the profile afterwards, returning the real state as `verified` rather than repeating the package manager's own output.

## Differences from the Web side

| Aspect | Web `dsh-plugin-suite` | Desktop `dsh-desktop-suite` |
| --- | --- | --- |
| Entry point | `npm run suite -- install\|update --profile-dir <abs> --source-dir <abs>` | `/desktop-suite …` and the `desktop_suite` tool |
| Profile identity | Caller-supplied absolute path | `desktopProfiles.current`, no other source |
| Package operation | Writes the profile manifest, then one `pnpm install` | `desktopPnpm.runPlugin()`, where the packaged `dsh plugin` owns the manifest and bundle reconciliation |
| Member set | Seven sibling repositories in a source directory | Configured member list, by default the same six plugins; member names are also the install allowlist |
| Concurrency | Unconstrained | One package operation per generation; a second call is rejected synchronously |

## Configuration

A profile patch layer can override these fields:

```yaml
- id: dsh-desktop-suite
  config:
    members: [dsh-plugin-terminal, dsh-plugin-sidebar]
    specs:
      dsh-plugin-terminal: github:hzxwonder-dsh-plugins/dsh-plugin-terminal#v0.5.0
    timeoutMs: 600000
    maxOutputChars: 16384
```

`members` holds unique, valid package names; `specs` may name an install target only for a configured member, and a member without one uses `github:hzxwonder-dsh-plugins/<name>`. `timeoutMs` is the deadline of one operation, and `maxOutputChars` bounds the retained tail of each output stream.

## Safety boundary

- A read-only Session cannot run `install` or `update`; other Sessions and command invocations that carry an agent need approval; full-access mode and a command the user typed are already explicit decisions.
- Install targets can only come from the `members` allowlist, so a model cannot install arbitrary packages through this plugin.
- It only reads the active profile manifest and `node_modules` and never edits profile files; every write happens inside the desktop package service.
- One package operation per generation, and unloading the plugin cancels the active operation and waits for its subprocess tree.
- stdout and stderr are always drained but only a bounded tail is kept, so a long operation cannot grow memory without limit.

## Verification

```sh
npm test
```

Eleven unit tests cover configuration validation, profile inventory reads, action planning, tool and command registration, approval and read-only rejection, the separation of a nonzero exit, a terminating signal and a spawn failure, concurrency rejection, teardown cancellation and waiting, result rendering, and the bundle patch the package declares. The install and update paths still need a live DSH Desktop run; the procedure is in [`docs/desktop-contract.md`](docs/desktop-contract.md).

## License

LGPL-3.0-only.
