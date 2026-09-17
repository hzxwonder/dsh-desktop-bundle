# DSH Workbench Plugin

`dsh-plugin-workbench` is an external composition bundle for DeepSeek Harness
Web. It enables the official time-context, reminders, and durable full-text
session search services. The bundle does not replace Harness; persistent data
remains owned by `DSH_HOME`.

## Host support

- The composition itself is host-agnostic and stays in this repository:
  `cordis.patch.yml` inserts the official `time-context` and `schedule` services
  and configures full-text session search, so both plain `dsh web` and DSH
  Desktop can load it.
- On the Web side, this repository's local service supervisor `bin/local.mjs`
  (`start`/`serve`/`status`/`stop`/`open`) starts Harness when no desktop shell
  is present.
- The desktop side has no counterpart supervisor: the shell owns the services
  and the `profile`, so what it needs is the shell's own control surface, the
  `desktopProfiles` service the host exposes.
- Desktop-specific profile and service control lives in another repository,
  [`dsh-desktop-workbench`](https://github.com/hzxwonder-dsh-plugins/dsh-desktop-workbench).
  Following the DSH Desktop contract it uses only the public `desktopProfiles`
  service offered by the desktop host: it reads the active `profile`, lists
  optional profiles (`exists`/`webCapable`/`problem`), and requests one safe
  switch that may require a restart (`select`, with `restartRequired`). It only
  reports whether the active `profile` has this composition installed and never
  inserts the composition rows itself. The
  [DSH Desktop plugin development](https://github.com/anywhere-labs/dsh-desktop/blob/master/docs/plugin-development.md)
  document covers the layering rules: shared versus Desktop-only plugins,
  `ctx.get?.('<service>')` instead of top-level `inject`, and
  `desktopProfiles.current` as the only source of the active `profile`.
- Validation boundary: `npm test` covers the local supervisor and the
  composition patch; this repository has not run item-by-item acceptance of this
  composition on DSH Desktop.

## Feature screenshots

![Reminders and schedules](docs/screenshots/schedule.webp)

Figure: reference layout for reminders and schedules.

![Session search](docs/screenshots/search.webp)

Figure: reference layout for full-text session search. See
[`docs/screenshots/SOURCES.md`](docs/screenshots/SOURCES.md) for provenance and
validation boundaries.

## Install

Use the same `DSH_HOME` for installation and startup, then restart Harness in
the Web profile:

```sh
git clone https://github.com/hzxwonder-dsh-plugins/dsh-plugin-workbench.git
cd dsh-plugin-workbench
npm ci
dsh plugin --profile migration add "file:$PWD"
```

Keep the `file:` prefix so pnpm installs declared dependencies; a bare path is
treated as a directory-only `link:`.

The bundle targets DeepSeek Harness `0.1.5-rc.2`. Review dependency changes
and test a disposable profile before switching a production profile.

## Capability map

| Capability | Implementation | Scope |
| --- | --- | --- |
| Reminders and schedules | Official `schedule` + `time-context` | Current Session / Harness Web |
| Full-text session search | Official `session-query-sqlite` | Local `DSH_HOME` |
| SSH operations | `dsh-plugin-ssh` | Explicit remote tool calls |
| Browser automation and screenshots | `dsh-plugin-browser` | Session-isolated Chromium |
| Project memory | `dsh-plugin-project-memory` | Canonical project-path namespace |
| Local terminal and files | Official Harness Web preset | Local workspace authority |
| Subtasks, plans, goals, and skills | Official Harness Web preset | Shipped preset capabilities |

The schedule tools are `schedule_create`, `schedule_list`, and
`schedule_delete`. They support one-time and fixed-interval reminders. A
closed Session keeps overdue reminders until it resumes; reminders do not
create unattended background Sessions and are not a cron replacement. Desktop
push notifications, cold-session execution, and bulk database conversion
require separate deployment design.

## Local service supervisor

For a deployment containing
`runtime/node_modules/@deepseek-ai/dsh`,
`state/profiles/migration`, and these repositories, the optional supervisor
runs the official CLI independently of a desktop shell:

```sh
node bin/local.mjs start --root /absolute/deployment --port 3099
node bin/local.mjs status --root /absolute/deployment
node bin/local.mjs open --root /absolute/deployment
node bin/local.mjs stop --root /absolute/deployment
```

The supervisor binds loopback, disables telemetry, uses `state` as
`DSH_HOME`, and keeps the PID record and logs in `run`. Startup creates an
ephemeral browser launch token; logs redact it and the supervisor does not
persist it. Later `open` calls reuse the browser's signed cookie. To
authenticate a new browser, stop and start the service. Stopping preserves
durable state. macOS and Linux require `ps` plus `open` or `xdg-open`.

## Data and update boundaries

- The search index defaults to `$DSH_HOME/workbench-session-search.sqlite` and
  contains conversation content; protect and back it up with Harness home.
- Removing the bundle disables the composition but leaves existing indexes and
  reminders intact.
- Production updates should pin exact dependency versions and lockfiles, then
  run tests in a disposable profile.
- Supervisor log redaction is heuristic; keep log files private.
- Tests establish configuration and local-supervisor contracts. Unattended
  scheduling requires the Web integration scenarios in
  [`docs/e2e.md`](docs/e2e.md).

## Verify

```sh
npm test
```

Tests parse the patch, check official dependency versions, verify Web
activation and durable search configuration, and cover supervisor start,
status, log redaction, and stop behavior.

## Development docs

- [`docs/spec.md`](docs/spec.md): composition contract.
- [`docs/e2e.md`](docs/e2e.md): Web integration and local-supervisor scenarios.
- [`README.md`](README.md): 中文主文档。

## License

LGPL-3.0-only. Official dependencies retain their respective licenses and
copyright notices.
