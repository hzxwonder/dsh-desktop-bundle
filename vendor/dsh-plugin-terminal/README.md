# DSH 终端插件

`dsh-plugin-terminal` 为 DeepSeek Harness 提供完整的终端能力：会话标题栏右侧的
终端开关，点击后沿页面底部展开的交互式终端面板，以及 agent 可直接调用的本机与
远程 PTY 工具。面板终端和工具终端共用同一个 PTY 管理器，每个会话绑定到创建它的
owner，其他 owner 即使知道 `sessionId` 也不能读取或操作。

## 宿主支持

- 两端共用同一个包 `dsh-plugin-terminal`，没有桌面端专用包，也没有桌面端专属代码
  分支；桌面端没有需要单独维护的仓库，两端由本仓库同一份实现维护。
- 面板终端与 agent 工具终端共用同一个 PTY 管理器：本机 PTY 走宿主提供的 subprocess
  服务并按 `sandboxPolicy` 包装，SSH PTY 复用 `sshWorkbench` 的工作区事实；这些都是
  宿主无关的官方 service，因此在 Web 端与 Desktop 端行为一致。
- 插件只依赖官方 service、slot 与 patch，桌面专属能力不放进顶层 `inject`，规范见
  [dsh-desktop 插件开发文档](https://github.com/anywhere-labs/dsh-desktop/blob/master/docs/plugin-development.md)。
- 桌面端已在 DSH Desktop 实例上用终端面板行为评测脚本实测，全新实例单轮 66/66
  通过（本机与 SSH 工作区、新建与关闭、中断、退让布局）；Web 端由单元测试与
  `tests/web-check.mjs` 覆盖。

## 功能

- 底部终端面板：点击会话标题栏右侧的终端按钮展开，面板占满左侧栏以外的整幅
  宽度并贴在页面底部，主区与右侧栏收窄到面板上沿让位；上沿可拖拽调整高度，标签
  栏切换多个终端，右侧有新建、关闭和收起按钮。
- 交互式终端：xterm.js 渲染，直接键盘输入、ANSI/UTF-8、光标与全屏 TUI、
  scrollback、尺寸同步，`Ctrl/Cmd+Shift+C` 复制、`Ctrl/Cmd+Shift+V` 粘贴。
- 多会话：同一工作区可同时打开多个终端，面板内的每个终端都运行在该会话自己的
  环境里；面板会话在页面刷新后仍然存在，重新打开面板即可继续。
- 本机终端组合官方 `@deepseek-ai/dsh-terminal`、`@deepseek-ai/dsh-terminal-bash`
  和 `@deepseek-ai/dsh-tool-terminal`，提供 `terminal_open`、`terminal_send`、
  `terminal_read`、`terminal_signal`、`terminal_close`、`terminal_list`。
- 远程终端提供 `remote_terminal_open`、`remote_terminal_send`、
  `remote_terminal_read`、`remote_terminal_signal`、`remote_terminal_close`、
  `remote_terminal_list`。
- 终端跟随工作区：SSH 插件绑定远程工作区后，面板以该连接的对应目录启动远程
  PTY；未绑定时启动本机 PTY。面板在只读会话中只允许查看，不允许新建或写入。
- 远程连接复用本机 `~/.ssh/config`、SSH agent 和 `known_hosts`，工具参数
  不接收密码、私钥或凭据值。
- SSH 使用 `-tt`、`BatchMode=yes`、`StrictHostKeyChecking=yes` 和保活
  参数；面向 agent 的输出经过 ANSI 清理、常见 Token 脱敏和大小限制。
- agent、Session 和插件释放时会等待对应 PTY 进程完成清理。

远程 PTY 的就绪判断基于输出静默时间。返回 `inferred_idle` 或
`timeout` 只表示本次调用交还控制权，不代表远程前台命令已经退出；需要
确定状态时请再次 `remote_terminal_read` 或发送明确的后续输入。

## 安装

需要 Node.js 22.19 或更高版本、本机 OpenSSH，以及已经配置并信任 host key
的 SSH 别名。首次使用前请在系统终端完成 SSH agent、`known_hosts` 和登录配置。

```sh
dsh plugin --profile migration add "file:/absolute/path/to/dsh-plugin-terminal"
```

本地路径请保留 `file:` 前缀，否则 pnpm 会只建立 `link:` 而不安装插件依赖。
安装后重启 Harness。也可以安装 `dsh-plugin-suite`，一次启用浏览器、SSH、
记忆、终端、工作区侧栏和工作台 bundle。

面板的 xterm 资源随包分发在 `assets/terminal.js` 与 `assets/terminal.css`。
修改 `client.js` 或 xterm 版本后运行 `npm run build` 重新生成；`prepack`
会自动执行同一步骤。

## 终端面板

会话标题栏右侧的终端按钮打开面板：面板贴在页面底部，从左侧栏右缘延伸到窗口
右缘，主区与右侧栏收窄到面板上沿让位，再次点击按钮收起。

面板按会话自己的工作区新建终端，工具栏只显示当前环境（`本机` 或 `SSH · <连接
名>`），不需要先选目标：本地工作区启动本机终端，SSH 远程工作区在对应连接的目录
里启动远程终端。标签左侧的圆点表示会话仍在运行，灰色表示已退出。面板是否展开、
高度和当前标签保存在浏览器本地，不写入项目或服务器。

本机面板终端以当前会话的沙箱策略包装后启动，与会话显示的模式一致；策略需要本
部署不具备的沙箱提供方时会直接失败并提示 `TERMINAL_SANDBOX_UNAVAILABLE`，不会
退回未受约束的 shell。

面板与 agent 工具共用终端管理器，但 owner 不同：面板终端属于 Session，
agent 工具终端属于 Agent。两者的会话 id 都带有 `local-pty-` 或 `remote-pty-`
前缀，并且不能跨 owner 访问。

## 本机终端

```json
{"type":"shell","name":"main"}
```

打开后使用返回的 `sessionId` 调用 `terminal_send`、`terminal_read` 等
工具。需要保留当前目录、环境变量或 REPL 状态时使用持久终端；一次性命令
优先使用普通 shell 工具。

## 远程终端

```json
{"host":"dev","cwd":"/srv/project","name":"dev-shell"}
```

打开后：

1. 使用返回的 `sessionId` 调用 `remote_terminal_send`。
2. 使用 `remote_terminal_read` 读取有界 scrollback。
3. 使用 `remote_terminal_signal` 发送允许的信号，例如 `SIGINT`。
4. 工作完成后调用 `remote_terminal_close`。

可以在 profile patch 中配置主机白名单：

```yaml
- id: dsh-plugin-terminal
  config:
    hosts: [dev, staging]
```

工作区路径、文件读写和一次性远程批量操作仍分别由 Harness 工作区服务和
`dsh-plugin-ssh` 负责；远程终端保持为显式 PTY 会话，不伪装成本地工作区。

## 功能截图

![本机 PTY 终端参考](docs/screenshots/local-terminal.png)

![远程 SSH 终端参考](docs/screenshots/remote-terminal.png)

图片来自可复现的验收脚本或外部交互参考；来源和验证边界见
[`docs/screenshots/SOURCES.md`](docs/screenshots/SOURCES.md)。截图不包含
密码、私钥、Token 或其他凭据。

## 安全边界

远程会话需要 OpenSSH 可用，并继承 Harness 的 sandbox/approval 策略。只读
策略拒绝远程终端操作；受限策略会在打开、发送、发送信号和关闭前请求 Harness
approval。面板终端按当前 Session 的沙箱策略包装后启动，只读会话不能新建、
写入、发送信号或关闭终端。远端账户仍拥有服务器侧权限，别名中的 `ProxyCommand`
等配置必须可信。

## 验证

```sh
npm ci
npm test
```

测试覆盖主机和路径校验、SSH 参数、输出边界、Token 脱敏、会话所有者隔离、
面板工作区解算、只读拒绝、信号和清理。测试不连接真实服务器；真实连通性需要
用户自己的 SSH 配置和明确授权。

## 开发文档

- [`docs/spec.md`](docs/spec.md)：面板、工具和会话契约。
- [`docs/e2e.md`](docs/e2e.md)：面板与本机/远程终端验证场景。
- [`README.en.md`](README.en.md)：English documentation。

## 许可证

LGPL-3.0-only。官方 Harness 依赖保留各自许可证和声明。
