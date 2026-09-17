# DSH Desktop Workbench 插件

`dsh-desktop-workbench` 是基于 [anywhere-labs/dsh-desktop](https://github.com/anywhere-labs/dsh-desktop) 仓库的插件，按该仓库的插件规范编写：只使用宿主公开的 `desktopProfiles` Host service，为 workbench 部署提供桌面端的 profile 与服务控制。

Web 端的对应仓库是 [`dsh-plugin-workbench`](https://github.com/hzxwonder-dsh-plugins/dsh-plugin-workbench)。该仓库负责组合本身（官方 `time-context`、`schedule` 与会话全文搜索），并带一个本地服务监督器 `bin/local.mjs`，用于启动和停止自己的 Harness 服务。在 DSH Desktop 里这两件事都不属于插件：服务与 profile 由桌面壳持有，监督器没有对应物。桌面端需要的是壳自己的控制面——读取活动 profile、看清哪些 profile 可以被壳叠加载入、并请求一次可重启的安全切换——这正是本插件提供的能力。

组合本身不在这里复制一份：本插件只报告活动 profile 是否安装了 `dsh-plugin-workbench`。这是一个 Desktop 专用插件：`desktopProfiles` 是必需注入，插件在普通 `dsh web` 宿主里保持 pending。

## 使用

```sh
# 在 DSH Desktop 的终端里安装到活动 profile，然后重启 Desktop
dsh plugin --profile desktop add github:hzxwonder-dsh-plugins/dsh-desktop-workbench
```

重启后有两种入口，动作一致：

- 会话内斜杠命令：`/desktop-workbench status`、`/desktop-workbench list`、`/desktop-workbench select <profile>`；
- agent 工具 `desktop_workbench`，参数 `action` 为 `status`、`list` 或 `select`，`select` 另需 `profile`。

`status` 只读：给出活动 profile 的名称与目录，以及该 profile 是否声明、安装并组合了 workbench 组合包。`list` 只读：列出 `desktopProfiles.list()` 的每个 profile 及其可选择性判据（是否存在、是否可被壳叠加载入、bundle 数量、阻止选择的诊断）。`select` 会先按同一份清单校验目标，再持久化并请求一次有序重启，返回 `restartRequired: true`。

## 与 Web 端的差异

| 方面 | Web 端 `dsh-plugin-workbench` | 桌面端 `dsh-desktop-workbench` |
| --- | --- | --- |
| 角色 | 组合包：插入官方 time-context、schedule，并配置会话全文搜索 | 控制面：活动 profile 与组合落位情况 |
| 服务生命周期 | `bin/local.mjs` 本地服务监督器启动/停止自己的 Harness 服务 | 服务与 profile 由 DSH Desktop 持有；切换走 `desktopProfiles.select()`，是一次重启 |
| profile 归属 | 由调用方给出 `DSH_HOME` 与 profile | `desktopProfiles.current`，不接受其他来源 |
| 组合行 | 由自己的 `cordis.patch.yml` 插入 | 不重复插入；只读取并报告 |

## 配置

profile 的 patch 层可以覆盖组合包名（默认 `dsh-plugin-workbench`）：

```yaml
- id: dsh-desktop-workbench
  config:
    composition: dsh-plugin-workbench
```

## 安全边界

- 只读会话不能切换 profile；带 agent 的调用需要 approval 确认；完全访问模式与用户直接输入的命令本身已是显式动作。
- 切换前必须通过 `desktopProfiles.list()` 校验：不存在的 profile、不能叠加载入的 profile、带诊断问题的 profile 都会被拒绝，不会写入选择状态。
- 只读取活动 profile 的清单与 `node_modules`，不修改任何 profile 文件；持久化选择由 Desktop 自己完成。
- 切换会重启应用：结果里始终带 `restartRequired`，当前 Cordis generation 结束后不要复用旧 service 引用。

## 验证

```sh
npm test
```

10 项单元测试覆盖：配置与 profile 名校验、profile 摘要映射、可选择性判据、组合落位读取、只读动作不触碰选择状态、切换只持久化一个已校验目标、approval 与只读与会话门控、命令语法与用法输出、结果渲染，以及 bundle patch 与 `dsh.bundle.patch` 落点。桌面实例上的真实切换需要在 DSH Desktop 内实测，步骤见 [`docs/desktop-contract.md`](docs/desktop-contract.md)。

## 许可证

LGPL-3.0-only。
