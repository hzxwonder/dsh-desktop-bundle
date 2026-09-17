# DSH 工作区侧栏

[English](README.en.md)

`dsh-plugin-sidebar` 为 DeepSeek Harness Web 提供可独立启停的工作区侧栏。
侧栏按当前会话的工作区展示文件，采用紧凑工具栏、目录树和连续预览布局。
标签、停靠、浮动、全屏和宽度调整由 Harness 原生框架管理。

终端不属于本插件：本机与 SSH 终端统一由
[`dsh-plugin-terminal`](https://github.com/hzxwonder-dsh-plugins/dsh-plugin-terminal)
在会话输入框下方的终端面板中提供，两者共用同一套 PTY 管理器。

## 宿主支持

Web 端（`dsh web`）与 Desktop 端（DSH Desktop）共用同一个包 `dsh-plugin-sidebar`；桌面端没有需要单独维护的仓库，两端由本仓库同一份实现维护。

- 侧栏注册在官方 `sidebar` / `sidebarRight` 槽位上（右栏为 `sidebar.right.pane.tab` 与 `ctx.sidebarRightTabs`）。
- 本机文件走宿主工作区与沙箱服务，远程文件通过 `sshWorkbench` service。这些都是官方 service 与 slot，因此两端行为一致。
- 插件不把宿主专属能力放进顶层 `inject`，也不依赖宿主内部实现，规范见 [DSH Desktop 插件开发文档](https://github.com/anywhere-labs/dsh-desktop/blob/master/docs/plugin-development.md)。
- 验证状态：Web 端由单元测试与 `dsh-plugins/tests/sidebar-check.mjs` 端到端覆盖；桌面端只在 DSH Desktop 实例上确认过插件加载与客户端入口可用，文件树交互尚未在桌面端逐项验证。

## 功能

- 本机工作区展示本机目录，远程工作区展示所选 SSH 服务器的目录。
- 目录展开、名称筛选、隐藏文件和有界只读文本预览。
- Markdown 预览、文件大小提示、二进制与超限文件的明确错误。
- 切换服务器、工作区或会话时丢弃过期请求；返回原工作区可继续浏览。
- 支持浅色、深色主题和窄屏布局，图标按钮提供悬停提示。

## 安装

需要 Node.js 22.19 或更高版本及包含官方 Web 侧栏模块的 Harness profile。
从本地源码安装：

```sh
dsh plugin --profile migration add "file:/absolute/path/to/dsh-plugin-sidebar"
```

远程目录需要同一源码版本的 `dsh-plugin-ssh`。可通过 `dsh-plugin-suite`
一次安装六个成员插件，然后重启 Harness。

在设置中的“SSH连接”配置服务器，通过“添加远程工作区”选择主机和目录，
进入该工作区的会话后打开右侧“文件”标签。侧栏与终端面板使用服务器端保存的
同一个工作区目标。浏览器插件可以在同一原生侧栏中独立提供浏览器标签。

## 启停

在 `$DSH_HOME/profiles/migration/cordis.patch.yml` 中加入以下条目并重启服务：

```yaml
- id: dsh-plugin-sidebar
  disabled: true
```

停用后恢复 Harness 原生文件视图，终端面板不受影响。重新启用时将
`disabled` 设为 `false`。插件释放会移除注册与样式。Suite 安装的成员
同样支持此配置。

## 数据与权限

侧栏读取远程目录和文本用于当前页面展示，远程文件内容不持久化到本机。
本地索引与元数据由 SSH 插件负责。服务器根据会话推导主机和根目录，
请求中的工作区标识必须匹配当前目标；路径穿越及本机根目录外的解析路径会被拒绝。
不可用的远程工作区会显示错误，并保持远程目标身份。

本机文本预览限制为 64 KiB，单目录最多显示 2000 条；远程限制由 SSH 插件配置。
二进制和不支持的文本编码显示预览错误。侧栏只读：写入与终端操作由终端面板和
agent 工具各自负责。

## 功能截图

![远程工作区文件](docs/screenshots/remote-workspace.png)

![深色主题文件视图](docs/screenshots/remote-files-dark.png)

截图来自本机运行的 Harness Web 和 Chrome，使用临时 profile 与合成数据。
详细验证范围见 [截图与验收记录](docs/screenshots/SOURCES.md)。

## 验证

```sh
npm test
```

测试覆盖工作区身份推导、过期请求围栏、路径穿越与符号链接逃逸拒绝、
有界读取、文件 API 拒绝终端动作以及只读会话。

## 许可证

LGPL-3.0-only，见 [LICENSE](LICENSE) 和 [NOTICE](NOTICE)。
