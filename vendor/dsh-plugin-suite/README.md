# DSH 插件整合包

`dsh-plugin-suite` 将浏览器、SSH、Memory、Terminal、Sidebar 和 Workbench 六个插件
组合为一个可安装的 DeepSeek Harness bundle。安装后由同一个 profile 管理
版本和启动顺序；更新由用户显式执行，插件激活不会自行联网或运行 shell 命令。

## 宿主支持

DeepSeek Harness 有 Web 端（`dsh web`）与桌面端 DSH Desktop
（[`dsh-desktop`](https://github.com/anywhere-labs/dsh-desktop)）两条宿主路径：
Web 端由本仓库维护，桌面端由 `dsh-desktop-suite` 维护。

- Web 端仓库是
  [`dsh-plugin-suite`](https://github.com/hzxwonder-dsh-plugins/dsh-plugin-suite)，
  桌面端仓库是
  [`dsh-desktop-suite`](https://github.com/hzxwonder-dsh-plugins/dsh-desktop-suite)；
  两端成员清单一致，都是 browser、project-memory、ssh、terminal、sidebar 和
  workbench 六个插件。
- Web 端用本仓库的 `bin/manage.mjs`，按调用方给出的绝对路径准备 profile 清单，直接
  执行一次 `pnpm install`，再把 `dsh.profile.bundles` 收敛成一个 Suite 层。
- 桌面端只使用宿主公开的两个 Host service：活动 profile 只能来自
  `desktopProfiles.current`，包操作交给 `desktopPnpm.runPlugin()` 执行打包的
  `dsh plugin` CLI，由它负责清单与 `dsh.profile.bundles` 收敛；动作是 `status`、
  `install`、`update`，每代只允许一个包操作，变更需要 approval，只读会话拒绝。
- 两端分开维护，是因为桌面壳自己持有 profile 与包操作路径，本仓库对绝对路径和直接
  `pnpm` 的假设在桌面端不成立。桌面端实现依据 DSH Desktop 的
  [插件开发规范](https://github.com/anywhere-labs/dsh-desktop/blob/master/docs/plugin-development.md)：
  插件分「两端通用」与「Desktop 专用」两类，Desktop 专用插件在顶层 `inject` 中声明
  `desktopProfiles` 与 `desktopPnpm`。
- 验证边界：本仓库的 `npm test` 覆盖 Web 端 CLI 的规划与清单写入逻辑；桌面端插件在其
  自己仓库里有单元测试，没有在 DSH Desktop 实例上做过逐项验收。

## 一键安装

准备一个包含七个同级仓库的本地源码目录：

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

从 Suite 仓库执行一次安装命令：

```sh
cd /absolute/path/to/repositories/dsh-plugin-suite
npm run suite -- install \
  --profile-dir /absolute/path/to/DSH_HOME/profiles/migration \
  --source-dir /absolute/path/to/repositories
```

两个目录参数都必须是绝对路径。管理器先校验七个目录中的包名和 bundle
声明，再把 Suite 作为 profile 的正式依赖、六个成员作为开发依赖写入，并执行
一次 `pnpm install`。安装全部成功后，`dsh.profile.bundles` 才会收敛为一个
Suite 层；profile 的其他字段和非 Suite 依赖保持不变。

安装后重启 Harness。profile 会同时组合：

- 浏览器右侧栏页面和 Session 隔离的浏览器工具；
- OpenSSH 连接、远程命令和 CAS 文件操作；
- 项目隔离的持久记忆与凭据状态；
- 本机和远程持久 PTY 终端；
- 随会话工作区切换的文件和终端侧栏；
- 定时提醒、时间上下文和会话全文搜索。

已有的独立成员 bundle 会在七个包全部落盘后由 Suite 层替代。若安装未完成，
管理器保留原有 bundle 顺序，不会提前移除可工作的成员层。

## 一键更新

更新会从安装时的同一本地源码目录重新解析七个包，请在维护窗口显式执行：

```sh
cd /absolute/path/to/repositories/dsh-plugin-suite
npm run suite -- update \
  --profile-dir /absolute/path/to/DSH_HOME/profiles/migration \
  --source-dir /absolute/path/to/repositories
```

也可以从 profile 调用已安装的命令：

```sh
pnpm --dir /absolute/path/to/DSH_HOME/profiles/migration exec \
  dsh-plugin-suite update \
  --profile-dir /absolute/path/to/DSH_HOME/profiles/migration \
  --source-dir /absolute/path/to/repositories
```

更新要求 profile 中七个 `file:` 依赖与 `--source-dir` 完全一致，然后执行
`pnpm install --force`。这避免一次更新混用不同源码树。脚本不读取或打印凭据。

管理器会在包管理命令前保存 `package.json` 和 `pnpm-lock.yaml`；pnpm 失败或
bundle 收敛失败时会恢复这两个文件。`node_modules` 不在文件级回滚范围内，失败后
应排查源码或依赖问题，再使用同一命令重新收敛。更新成功后重启 Harness。

可先查看实际安装状态：

```sh
npm run suite -- status --profile-dir /absolute/path/to/DSH_HOME/profiles/migration
```

状态输出分别报告每个包是否已声明、是否真实存在于 `node_modules`、版本、bundle
能力和当前是否直接出现在 profile 的 bundle 列表中。

## 组成清单

| 模块 | 主要能力 |
| --- | --- |
| `dsh-plugin-browser` | Session 隔离的浏览器工具和右侧栏页面 |
| `dsh-plugin-ssh` | OpenSSH 主机探测、远程命令和 CAS 文件操作 |
| `dsh-plugin-project-memory` | 项目命名空间记忆和凭据状态 |
| `dsh-plugin-terminal` | 官方本机 PTY 与 owner 隔离的 SSH PTY |
| `dsh-plugin-sidebar` | 随工作区切换的文件树、文本预览和终端视图 |
| `dsh-plugin-workbench` | 定时提醒、时间上下文和持久会话搜索 |

整合包只负责组合；成员插件的审批规则、主机白名单、沙箱策略和数据保留
边界仍由各自插件与 profile 配置决定。单独安装某个成员时，可直接阅读其
中文 README 了解配置和权限。

## 能力总览图

![整合包能力总览](docs/screenshots/suite-overview.svg)

这是根据当前 bundle 清单绘制的组合关系图，不模拟 Web 页面。来源和验证边界
见 [`docs/screenshots/SOURCES.md`](docs/screenshots/SOURCES.md)。

## 验证

```sh
npm install
npm test
```

测试解析 bundle patch，检查本地源码校验、依赖分层、实际 `node_modules` 状态、
bundle 去重、同源更新和 manifest/lockfile 回滚。单元测试使用注入的 pnpm
执行器；真正的成员运行态仍需按各插件文档完成对应的本机或远程集成检查。

## 开发文档

- [`docs/spec.md`](docs/spec.md)：整合包契约。
- 六个成员仓库中的 `README.md`：中文配置和安全说明。
- [`README.en.md`](README.en.md)：English documentation。

## 许可证

LGPL-3.0-only。成员插件和官方 Harness 依赖保留各自许可证和声明。
