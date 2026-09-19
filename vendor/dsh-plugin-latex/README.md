# DSH LaTeX Studio

DSH Desktop 的本地论文工作台：并排编辑 LaTeX 与预览 PDF，通过原生 DeepSeek Harness 会话讨论论文、处理审阅和完善行文逻辑。

![论文工作台演示](assets/workbench-demo.gif)

演示由实际 Desktop 操作截图组成，展示项目选择、编译预览、审阅、聊天和导图折叠。

## 使用

1. 从左侧「工作流」下方的「论文工作台」进入，选择已有论文、新建论文，或打开本地项目目录。
2. 在源码右上方点击「编译」，使用本地 TeX 工具生成 PDF。支持 PDF 缩放、下载、取消和错误日志。
3. 选中文字，使用「润色」「缩减」或「评论」。评论保存在审阅栏；点击卡片跳转原文。
4. 在审阅卡片右下角选择单条或多条，也可用列表顶部全选框，再点击「加入对话」。材料追加到最近使用的论文会话草稿，由用户检查后发送。单条箭头可直接追加对应审阅。
5. 打开「行文导图」，模型概括标题、章节、段落和句子。分支圆钮控制折叠，单击选中节点，双击节点跳转源码（键盘 Enter 也可定位），画布支持平移和缩放。
6. 点击「主会话」返回原生界面；论文文件、审阅、会话绑定和成功的 PDF 保留在本地。

进入工作台后，Desktop 外侧导航和标准模式标题栏自动隐藏；返回主会话时恢复。点击文件或文件标签进入源码。写作区左侧在源码与论文对话之间切换，底部复用原生输入框，右侧保留 PDF。侧栏可收起，源码与 PDF 栏宽可通过分隔条拖动或方向键调整。支持浅色、深色与跟随 Desktop。

文件栏使用行内输入创建文件：Enter 创建，Esc 取消。编辑器支持多个标签、撤销和 `⌘/Ctrl+S` 保存。文件被 Agent 或外部编辑器修改时，干净编辑器自动同步；存在未保存草稿时执行冲突检查。草稿在本机浏览器存储中保留，冲突恢复支持导出草稿。

## 安装

推荐使用 [DSH Desktop Bundle](https://github.com/hzxwonder/dsh-desktop-bundle) 的固定版本组合。

独立开发安装：

```sh
git clone https://github.com/hzxwonder-dsh-plugins/dsh-plugin-latex.git
cd dsh-plugin-latex
npm ci
npm run build
```

在 Desktop profile 的 `package.json` 中添加本仓库的本地 `link:` 依赖，并将 `dsh-plugin-latex` 加入 `dsh.profile.bundles`，执行 `pnpm install` 后重启 Desktop。修改配置前保留原文件备份。

验证环境：DSH Desktop 2.0.10、DeepSeek Harness 0.1.5-rc.2、Node.js 24、macOS。原生聊天嵌入使用此 Harness 版本的渲染适配层；升级 Harness 后需复测。

本机需安装 TeX Live 或 MacTeX，并提供 `latexmk` 与所选引擎（pdfLaTeX、XeLaTeX、LuaLaTeX）。中文论文请选择合适的中文文档类、字体和 XeLaTeX。编译所需宏包由本机 TeX 安装提供。

## Agent 与数据

聊天、模型选择、文件工具和权限审批沿用 Desktop 的 deepseek-harness。插件复用已有模型路由；论文会话绑定论文目录。语义分析调用同一路由的原生子代理，并禁用其文件工具，返回结构化结果后由插件检查并写入。

论文工作台使用内部专属 `AGENTS.md`，存放在插件数据目录 `latex-studio/instructions/AGENTS.md`。插件启动时加载其中的写作、审阅和 Overleaf 同步规则，通过 Harness 系统提示词仅注入绑定当前论文目录的会话。文件由插件管理，论文文件栏保持源码与素材视图。

内部指令在插件启动时加载，适用于工作台内的论文会话。默认规则要求先检查 Git，再将每轮论文修改提交并推送到经核实的 Overleaf 项目，检查同步结果。此过程由 Agent 执行，手动保存和编译本身不触发 Git 操作。Harness 原生的全局和项目指令仍按其作用域生效。


模型分析会将相关论文段落发送给用户在 Desktop 中配置的模型服务。普通编辑与编译在本机执行。文件、审阅、PDF、语义缓存和分析前备份保存在所用 DSH home 的 `latex-studio/` 下；导入项目的源码仍位于原目录。插件不包含分析统计上报或独立账号服务。

语义注释使用 `% @c:`、`% @p:`、`% @s:` 描述章节、段落和句子意图。内部定位标识与增量缓存由插件管理。更新时重用未改变段落的分析结果。支持项目根目录相对路径的字面量 `\input{...}`、`\include{...}`，合并章节并保留原文件跳转位置。

## 适用范围

- 结构解析面向 `abstract`、`section`、`subsection`、`subsubsection` 和常规正文。公式、代码、表格、列表等受保护块按源码保留；复杂自定义宏中的文字不保证完整进入语义导图。动态计算的文件引用应先改为字面路径。
- 单文本文件上限 2 MB；编译项目上限 100 MB；PDF 上限 30 MB；语义分析最多递归 64 个 TeX 文件。编译超时约 120 秒，分析任务约 240 秒。
- 编译在临时目录运行，关闭 shell escape；这是编译隔离工作目录，并非操作系统级沙箱。
- 单文件替换采用原子写入和内容哈希检查。多文件分析在写入前校验所有文件并保存原文备份；文件系统级事务、进程崩溃注入与超大论文压力测试尚未完成。
- 首版聚焦本地个人论文与 Agent 协作。

## 验证

```sh
npm test
npm run build
npm run check:privacy
```

自动测试需要 TeX 工具；PDF 正文一致性检查需要 Poppler 的 `pdftotext`。测试中的固定语义数据用于协议和增量逻辑验证；真实模型链路另在 Desktop 界面验收。

详见 [验收计划](https://github.com/hzxwonder-dsh-plugins/dsh-plugin-latex/blob/main/docs/TEST-PLAN.md) 与 [验收报告](https://github.com/hzxwonder-dsh-plugins/dsh-plugin-latex/blob/main/docs/ACCEPTANCE.md)。截图与动图采用合成论文。

## 开发结构

| 路径 | 职责 |
|---|---|
| `index.js` | Cordis Host API、原生模型分析任务与生命周期 |
| `lib/store.js` | 项目与审阅持久化、路径校验、保存冲突 |
| `lib/compiler.js` | 本地编译、超时取消与成功 PDF 保留 |
| `lib/logic.cjs` | 结构解析、语义注释与增量缓存 |
| `lib/project-sources.js` | 多文件引用解析与导图合并 |
| `client/` | CodeMirror 编辑器、PDF.js、审阅与原生聊天抽屉 |
| `test/` | 文件、编译、Host 和语义回归测试 |

MIT License。CodeMirror、PDF.js 等依赖遵循各自许可证。
