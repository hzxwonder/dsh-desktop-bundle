# 官方 Desktop 插件验收与功能比较

验收日期：2026-09-26。官方应用：DeepSeek Harness 0.1.7-rc.2，macOS arm64。
来源：`https://download.deepseek.com/dsh-desk/feeds/mac-arm64/nightly-mac.yml`，安装包 SHA-512 已核对，Developer ID 为 Hangzhou DeepSeek Artificial Intelligence Co., Ltd，含公证票据。
源码基线：[dsh-v0.1.7-rc.2](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.7-rc.2)，提交 `477b4f420553e8a52c2fbccc464d7561b239c443`。

## 实机验收

通过官方应用的插件管理页直接从公开 GitHub 仓库安装，使用独立测试数据目录。以下为实际结果；安装、启用、核心交互与完整验收分别记录。

| 公开插件 | 版本 | 结果 |
| --- | --- | --- |
| dsh-plugin-latex | 0.1.14 | 安装、启用、创建论文与编译 PDF 通过；点击行文导图后主区空白，整体验收未通过 |
| dsh-plugin-browser | 0.5.2 | 安装、启用、面板通过；默认缺少 Chromium，配置本机 Chrome 后成功导航至 Example Domain；Agent 工具与完整交互待验收 |
| dsh-plugin-workflow | 0.3.0 | 官方安装器拒绝：skill/tools peerDependencies 限定 0.1.5-rc.2 |
| dsh-plugin-project-memory | 0.2.2 | 官方安装器拒绝：credentials/sandbox-policy/session-projection/tools 限定 0.1.5-rc.2 |
| dsh-plugin-terminal | 0.5.0 | 安装和启用通过；会话标题栏按钮出现，打开后底部留白、没有终端控件，核心面板验收未通过 |
| dsh-plugin-ssh | 0.1.0 | 安装后 Host 显示运行；冷启动失败：客户端等待 settingsScope。测试配置已停用该组件 |
| dsh-plugin-sessions | 0.1.1 | 安装、启用、“对话”分组与新会话通过；跨会话模型上下文待验收 |

公开源码提交：latex `f94e0da`、browser `5e041a0`、terminal `145860f`、SSH `12a88c0`、sessions `df7ca0f`。实际安装锁文件保留完整 SHA。没有以本地未提交源码替换这些公开版本作为验收依据。

## 官方能力与插件差异

功能重叠表示官方存在对应能力；不代表已证明官方代码来自这些第三方仓库。

| 插件 | 官方对应能力 | 插件额外能力与差异 | 保留评估 |
| --- | --- | --- | --- |
| dsh-plugin-latex | 文档/图片预览、文件编辑及通用 Agent | 论文项目、Overleaf Git、TeX 编译、审阅、行文注释导图与论文会话 | 官方未提供完整论文工作台，建议保留并适配 |
| dsh-plugin-browser | ui-sidebar-browser 的 Electron webview；browser-use 注册层及可选 Playwright/Chrome DevTools/Stagehand 提供方 | 按会话隔离 Playwright；Agent 与人共享同一页面、串流、指针提示和主页区面板。官方内嵌网页与 Agent 后端并非自动同一会话 | 部分重叠；按是否需要共享自动化页面决定 |
| dsh-plugin-workflow | workflow、tool-workflow、workflow-ptc；ui-workflow-run 显示持久化运行/阶段/成员 | 可视化 Studio、可复用定义版本、步骤编辑、调试、输入/输出和暂停恢复。官方运行卡不提供完整拓扑编辑器 | 部分重叠，建议保留 Studio |
| dsh-plugin-project-memory | AGENTS.md/skills、会话持久化与查询 | 按真实项目路径隔离 memory.md、版本校验写入、流程记忆、项目凭据工具和自动注入 | 未找到等价项目记忆插件，建议保留并适配 |
| dsh-plugin-terminal | ui-sidebar-terminal、api-terminal-controller、terminal/tool-terminal；支持 shell 标签、重命名、重连、后台进程、主题 | 底部停靠布局、共享 PTY 管理与自定义 sshWorkbench。官方用户终端独立于 Agent 权限，插件本机 PTY 按 sandboxPolicy 包装 | 重叠较高；比较布局、权限和 SSH 需求后决定 |
| dsh-plugin-ssh | ssh/fs-ssh/subprocess-ssh/sandbox-ssh 提供 POSIX 远程执行、文件及沙箱 | 连接管理、远程目录选择、会话工作区和远程文件 UI。官方 SSH 提供方文档面向 headless/自定义组合 | 底层重叠；保留远程工作区 UI 的价值较大 |
| dsh-plugin-sessions | session-reference 与 @ 会话选择、默认工作区、会话查询 | 一键复制引用、单独“对话”分组和退出项目工作区交互 | 重叠较高；可考虑缩减为复制引用/分组增强 |

## 核验来源

所有源码链接固定到验收版本：

- [官方内嵌浏览器](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/client/ui-sidebar-browser/README.zh.md)
- [官方交互终端](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/client/ui-sidebar-terminal/README.zh.md)
- [官方 SSH 提供方](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/ssh/README.zh.md)
- [官方工作流](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/workflow/workflow/README.zh.md)
- [官方工作流界面](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/client/ui-workflow-run/README.zh.md)
- [官方会话引用](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.7-rc.2/packages/context/session-reference/README.zh.md)

## 模型验收

官方模型在最小请求中返回 `OFFICIAL_MODEL_OK`。跨会话引用试验中粘贴结果未包含有效引用，不能作为引用功能通过的证据。

## 官方终端实机核验

官方侧栏“新建终端”成功启动 zsh；输入 `printf 'OFFICIAL_TERMINAL_OK\n'` 得到预期输出，确认这是可交互的官方终端。该结果不等同于第三方底部终端插件通过验收。

## 维护与发布

DSH Omni 集成版本在 dsh-omni 内维护；公开插件仓库维护官方 Desktop 适配版。每次改动依次完成 Omni 实机验收、Omni 仓库更新、官方适配与实机验收，再发布公开插件。仅放宽版本范围不构成兼容性验证。

## macOS installation status

Applications retains DSH Omni and official DeepSeek Harness. The previous DSH Desktop and community DSH NEXT application bundles were moved to a recoverable local backup. The former Desktop application, data home and Electron user data also have ZIP backups with verified CRC and SHA-256 manifests.

DSH Omni uses io.github.hzxwonder.dsh.omni and ~/.dsh-omni, based on community NEXT 2.0.15-next. Bundle signing and Host readiness were checked. Computer Use still denies access to this application; graphical acceptance is incomplete and no new Omni installer release has been published.

The official default profile was backed up and replaced with the public plugin configuration tested here. SSH and third-party terminal bundles remain installed but disabled. Default application launch succeeded, with existing workspaces and conversations visible.

A later model test without a valid pasted session reference failed during a command with Cannot read properties of undefined (reading prepare). Tool execution and cross-session context remain unverified for the tested combination; this observation does not isolate a single responsible plugin.
