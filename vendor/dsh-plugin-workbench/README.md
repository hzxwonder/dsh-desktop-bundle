# DSH Workbench 插件

`dsh-plugin-workbench` 是 DeepSeek Harness Web 的外置配置组合包，启用官方的时间上下文、提醒和会话全文搜索能力。它不替换 Harness 主程序，持久化数据仍由 Harness 的 `DSH_HOME` 管理。

## 宿主支持

- 组合包本体与宿主无关，仍留在本仓库：`cordis.patch.yml` 插入官方 `time-context`、`schedule`，并配置会话全文搜索，普通 `dsh web` 与 DSH Desktop 都可以加载。
- Web 端由本仓库的本地服务监督器 `bin/local.mjs`（`start`/`serve`/`status`/`stop`/`open`）在没有桌面壳时自行拉起 Harness 服务。
- 桌面端没有对应的监督器：桌面壳自己持有 service 与 `profile`，需要的是壳自己的控制面，即宿主公开的 `desktopProfiles` service。
- Desktop 专用的 `profile` 与服务控制放在另一个仓库 [`dsh-desktop-workbench`](https://github.com/hzxwonder-dsh-plugins/dsh-desktop-workbench)：它按 DSH Desktop 规范只使用桌面宿主公开的 `desktopProfiles` service，提供活动 `profile` 读取、可选 `profile` 清单（`exists`/`webCapable`/`problem` 判据）与一次可重启的安全切换（`select`，带 `restartRequired`），并且只报告活动 `profile` 是否安装了本组合包，不重复插入组合行。分层规则（两端通用与 Desktop 专用、`ctx.get?.('<service>')` 与顶层 `inject`、以 `desktopProfiles.current` 作为活动 `profile` 的唯一来源）见 [DSH Desktop 插件开发](https://github.com/anywhere-labs/dsh-desktop/blob/master/docs/plugin-development.md)。
- 验证边界：`npm test` 覆盖的是本地监督器与组合插入；本仓库没有在 DSH Desktop 上对本组合包做过逐项验收。

## 功能截图

![提醒与定时任务](docs/screenshots/schedule.webp)

图：提醒/定时任务页面参考。

![会话搜索](docs/screenshots/search.webp)

图：会话全文搜索页面参考。截图来源和验证边界见 [`docs/screenshots/SOURCES.md`](docs/screenshots/SOURCES.md)。

## 安装

安装和启动时使用同一个 `DSH_HOME`，并在 Web profile 中重启 Harness：

```sh
git clone https://github.com/hzxwonder-dsh-plugins/dsh-plugin-workbench.git
cd dsh-plugin-workbench
npm ci
dsh plugin --profile migration add "file:$PWD"
```

请保留 `file:` 前缀，让 pnpm 安装插件声明的依赖；裸路径会变成只链接目录的
`link:`。

插件目标版本为 DeepSeek Harness `0.1.5-rc.2`。更新依赖或配置后请在临时 profile 中验证，再切换生产 profile。

## 能力清单

| 能力 | 实现 | 作用域 |
| --- | --- | --- |
| 提醒与定时任务 | 官方 `schedule` + `time-context` | 当前 Session / Harness Web |
| 会话全文搜索 | 官方 `session-query-sqlite` | 本地 `DSH_HOME` |
| SSH 远程操作 | `dsh-plugin-ssh` | 显式远端工具调用 |
| 浏览器操作和截图 | `dsh-plugin-browser` | 按 Session 隔离的 Chromium |
| 项目记忆 | `dsh-plugin-project-memory` | 按规范化项目路径隔离 |
| 本地终端与文件 | Harness Web 官方 preset | 本地工作区权限 |
| 子任务、计划、目标与技能 | Harness Web 官方 preset | 官方 preset 能力 |

提醒工具为 `schedule_create`、`schedule_list` 和 `schedule_delete`，支持一次性和固定间隔。关闭的 Session 会在恢复后处理逾期提醒；提醒不会自行创建无人值守的后台 Session，也不是 cron 替代品。桌面推送、冷 Session 自动执行、整库迁移等行为需要单独的部署设计。

## 本地服务监督器

当部署目录包含 `runtime/node_modules/@deepseek-ai/dsh`、`state/profiles/migration` 和插件仓库时，可以使用可选的本地监督器：

```sh
node bin/local.mjs start --root /absolute/deployment --port 3099
node bin/local.mjs status --root /absolute/deployment
node bin/local.mjs open --root /absolute/deployment
node bin/local.mjs stop --root /absolute/deployment
```

监督器仅绑定 loopback，关闭遥测，使用 `state` 作为 `DSH_HOME`，并将 PID 与日志放在 `run`。启动时会生成临时浏览器令牌：日志会脱敏，监督器不会保存令牌。后续 `open` 复用浏览器签名 Cookie；需要新认证时先 `stop` 再 `start`。停止服务会保留持久化状态。macOS 和 Linux 需要 `ps` 以及 `open` 或 `xdg-open`。

## 数据与更新边界

- 搜索索引默认写入 `$DSH_HOME/workbench-session-search.sqlite`，其中包含会话内容，应按 Harness 主目录保护和备份。
- 卸载插件只停止能力组合，不删除已有索引或提醒记录。
- 生产更新应锁定确切依赖版本和 lockfile，并先在一次性 profile 中执行测试。
- 监督器日志仅做启发式脱敏，仍应限制日志文件权限。
- 通过测试只能证明配置和本地服务契约；是否实现无人值守调度，需要按 [`docs/e2e.md`](docs/e2e.md) 完成 Web 集成验证。

## 验证

```sh
npm test
```

测试会解析补丁、检查官方依赖版本、确认 Web 激活及持久化搜索配置，并覆盖监督器启动、状态、日志脱敏和停止流程。

## 开发文档

- [`docs/spec.md`](docs/spec.md)：组合包契约。
- [`docs/e2e.md`](docs/e2e.md)：Web 集成和本地服务场景。
- [`README.en.md`](README.en.md)：English documentation。

## 许可证

LGPL-3.0-only。官方依赖保留其各自的许可证和版权声明。
