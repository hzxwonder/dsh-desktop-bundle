# 验收测试（acceptance QA）

这一组脚本对打包后的 DSH Desktop 做端到端验收：在真实的 Electron 窗口里操作界面，
用 Chrome DevTools Protocol 读取 DOM 与截屏，再用进程与磁盘状态交叉验证结果。
测试全程跑在独立的 fixture home 上，不会写入日常使用的数据目录，也不会调用真实模型
（推理走 `mock-llm.mjs` 提供的本地 OpenAI 兼容服务）。

## 目录

| 文件 | 作用 |
| --- | --- |
| `setup-qa.sh` | 备份日常 home、合成 fixture home、注册启动器指向、起 mock 服务；`restore` 还原现场 |
| `run-cases.mjs` | 用例运行器：`list` / `capture` / `run [all\|A\|B\|…]` |
| `cases-lifecycle.mjs` | A 启动与会话生命周期，B 关闭、后台化、重开与进程行为 |
| `cases-theme.mjs` | D 主题与外观 |
| `cases-layout.mjs` | L 布局与样式校验（几何、溢出、对比度） |
| `cases-features.mjs` | F 功能链路（面板、选择器、指令入口） |
| `cases-robust.mjs` | R 鲁棒性与异常输入（空输入、超长粘贴、服务不可用、狂点） |
| `cases-privacy.mjs` | P 仓库隐私与脱敏（工作区、全部历史、发布镜像） |
| `scenario.mjs` | 页面内探针与交互原语（输入、点击、就绪等待、窗口控制） |
| `contrast.mjs` | 对比度测量：解析真实前景与背景，按 WCAG 计算比值 |
| `mock-llm.mjs` | 本地 mock 模型服务（流式与非流式） |
| `configure-provider.mjs` | 把 mock 供应商写进 fixture 的 `settings.yaml` 与 `.credentials.yaml` |
| `privacy-scan.mjs` | 独立可跑的隐私扫描，输出 `evidence/privacy.json` |
| `private-terms.mjs` | 读取本机私有词表（私有项目名、内部连接别名），词表本身不入库 |
| `sanitize-evidence.mjs` | 出报告前把证据里的本机路径改写成 `/Users/<user> |
| `report.mjs` | 把结果与截图汇总成 `ACCEPTANCE-REPORT.md` |

## 运行

```bash
cd dsh-plugins/distribution/dsh-desktop-bundle

# 1. 备份日常 home 并准备测试环境（会把启动器暂时指向 fixture home）
bash qa/setup-qa.sh backup

# 2. 记录基线，然后执行用例
node qa/run-cases.mjs capture
node qa/run-cases.mjs run all

# 3. 生成报告
node qa/report.mjs

# 4. 还原日常 home 与启动器
bash qa/setup-qa.sh restore
```

只跑某一组时把 `all` 换成组名，例如 `node qa/run-cases.mjs run B L`；
也可以只刷新单条用例：`node qa/run-cases.mjs run R-12 L-05`（结果按用例号合并进 `results.json`）。

隐私用例需要一份本机私有词表，放在 `qa/private-terms.local.txt`（已被 `.gitignore` 忽略，
一行一个词），或用环境变量传入：

```bash
QA_PRIVATE_TERMS="term-a,term-b" node qa/run-cases.mjs run P
```

没有配置词表时 `private-project` 规则不生效，其余规则照常执行。

## 结果

- `evidence/results.json`：每条用例的状态、耗时与断言细节
- `evidence/<用例号>-<名称>.png`：失败现场与关键流程截图
- `evidence/privacy.json`：隐私扫描的逐条命中（含仓库、修订、路径、行号）
- `ACCEPTANCE-REPORT.md`：可直接阅读的验收报告

## 工作流插件验收（`workflow-desktop/`）

针对 `vendor/dsh-plugin-workflow` 的界面与行为另有一套用例，跑在同一套 fixture 现场上：

```bash
node qa/workflow-desktop/run.mjs list          # 列出 44 条用例
node qa/workflow-desktop/run.mjs run all       # 执行并写入 evidence/workflow-desktop/results.json
node qa/workflow-desktop/privacy-audit.mjs     # 扫描 repositories/ 与 distribution/ 下全部仓库
node qa/workflow-desktop/report.mjs            # 生成 workflow-desktop/ACCEPTANCE-REPORT.md
```

用例分七组：入口与总览、创建与多实例、关闭与重开、主题、布局、创建—运行—对话、鲁棒性。
判定可见性用 `Element.checkVisibility`，因为折叠 `<details>` 的子元素仍保留布局盒。
报告里的问题叙述写在 `workflow-desktop/findings.mjs`，与自动生成的用例表分开维护。

## 环境要求

- macOS，已安装 `/Applications/DSH Desktop.app`
- Node.js 20 以上（使用内置 `WebSocket` 与 `fetch`）
- 无需 macOS 辅助功能权限：窗口尺寸、关闭与后台化通过 DevTools 协议与进程信号驱动，
  因此原生菜单快捷键（⌘Q/⌘W/⌘M/⌘H）不在自动化覆盖范围内，报告里列为手工核对项
