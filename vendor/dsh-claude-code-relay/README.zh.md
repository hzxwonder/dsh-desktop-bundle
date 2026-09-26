# dsh-claude-code-relay

把 Claude Code CLI 作为 [dsh](https://github.com/deepseek-ai/dsh)（DeepSeek Harness）的一等模型提供方，通过 **base_url + api_key** 接入 Anthropic 兼容的中转站。

每一轮对话都会启动一个 `claude -p --input-format stream-json --output-format stream-json` 子进程，并在其环境中注入 `ANTHROPIC_BASE_URL` 与密钥（`ANTHROPIC_AUTH_TOKEN` 或 `ANTHROPIC_API_KEY`）。Claude Code 自己的智能体循环、工具（Bash、Read、Edit……）与会话续接照常工作，模型流量则全部走中转站——不需要 OAuth 登录，也不需要中转站了解 Claude Code 的外接方式。

本项目受 [dsh-oh-my-claude](https://github.com/lcestou/dsh-oh-my-claude) 启发。oh-my-claude 复用 CLI 已有的订阅登录；本插件面向只有 base_url + api_key 的中转站渠道：带一个设置页（连接、模型可见性、工具审批），无 SSH 主机、无费用统计，零运行时依赖、无构建步骤（纯 ESM JavaScript）。

## 前置条件

- 运行 dsh 的机器上装有 Claude Code CLI（`claude --version` 可运行），无需登录。
- 一个 Anthropic 兼容中转站：暴露 `<baseUrl>/v1/messages`，接受 `Authorization: Bearer` 或 `x-api-key`。

## 安装

```sh
dsh plugin --profile web add /path/to/dsh-claude-code-relay   # 本地目录
# 或发布后：dsh plugin --profile web add dsh-claude-code-relay
# 重启 dsh（例如 systemctl --user restart dsh-web.service，或你的启动方式）
```

包声明了 `dsh.bundle.patch` 与一个 client bundle，`dsh plugin add` 会自动把它登记进 profile 的 bundle 列表。重启后模型选择器里会出现 “Claude Code Relay”，设置界面里会出现独立的 **Claude Code** 页。

## 配置

**推荐：在设置界面里填。** 重启 dsh 后打开 设置 → Claude Code，填入中转站地址与 API Key，按页面底部的**保存**提交（写入 `~/.dsh/settings.yaml` 的 `claude-code-relay` 命名空间），无需重启。整页一次提交：所有字段共享同一个修订号围栏，因此另一个窗口的并发修改会被拒绝而不是静默覆盖；旁边的**放弃修改**会把草稿还原成已保存的值。API Key 脱敏存储，且由它自己的按钮独立保存：保存后页面不再回显，只显示“已配置”，随时可以输入新值覆盖或一键清除。设置页里的值优先于配置文件。

**配置文件方式（可选）：** 也可以写在 profile 的 `cordis.patch.yml`（如 `~/.dsh/profiles/web/cordis.patch.yml`）中该 bundle 行的 `config:` 下，作为设置页的底层默认值：

```yaml
- id: claude-code-relay
  config:
    baseUrl: https://your-relay.example.com
    apiKeyEnv: CLAUDE_RELAY_API_KEY      # 推荐：密钥放环境变量，不进配置文件
    models:
      - id: claude-sonnet-4-5
        name: Claude Sonnet 4.5
      - id: claude-opus-4-1
        name: Claude Opus 4.1
```

密钥来源：`apiKey` 直接写明文，或 `apiKeyEnv` 指向 dsh 进程环境里的变量名（二选一，`apiKey` 优先）。设置页与配置文件都未提供 `baseUrl` 时，选择器仍会出现，但发消息会得到明确的“未配置”错误。

可选：让新会话默认使用该提供方（`~/.dsh/settings.yaml`）：

```yaml
agent-default-model:
  provider: claude-code-relay
  model: claude-sonnet-4-5
```

### 全部配置键

| 键 | 默认 | 说明 |
| --- | --- | --- |
| `baseUrl` | `""` | 中转站地址，注入 `ANTHROPIC_BASE_URL`；Claude Code 请求 `<baseUrl>/v1/messages`。设置页 → 连接里填写 |
| `apiKey` | `""` | 中转站密钥明文 |
| `apiKeyEnv` | `""` | 存放密钥的环境变量名（如 `CLAUDE_RELAY_API_KEY`），`apiKey` 为空时生效 |
| `authHeader` | `auth-token` | 密钥的呈现方式：`auth-token` 发 `Authorization: Bearer`（`ANTHROPIC_AUTH_TOKEN`，多数 new-api/one-api 站点）；`api-key` 发 `x-api-key`（`ANTHROPIC_API_KEY`，Anthropic 原生风格） |
| `command` | `claude` | Claude Code 可执行文件：PATH 上的名字或绝对路径 |
| `providerId` | `claude-code-relay` | 模型选择器里的提供方路由 id；挂第二个中转站时换一个 id |
| `displayName` | `Claude Code Relay` | 选择器中的显示名 |
| `models` | sonnet/opus/haiku 4.x 三条 | 选择器中列出的模型；`id` 原样传给 `claude --model`，填中转站实际接受的 id |
| `autoModels` | `true` | 模型列表优先从中转站的 `/v1/models` 接口自动获取（问得到就用上游答案，缓存一分钟）；问不到时回退到 `models` 配置 |
| `visibleModels` | `[]` | 出现在 dsh 模型选择器里的模型 id；留空表示全部显示。勾选在设置页「主页显示的模型」区完成 |
| `contextWindow` | `200000` | 报告给 dsh 的上下文窗口 |
| `permissionMode` | `dsh` | Claude Code 权限模式；`dsh` 跟随会话访问盾（见「权限」节），也可固定为 `plan`/`acceptEdits`/`bypassPermissions`/`dontAsk` |
| `approvalBridge` | `true` | 用 `PreToolUse` 钩子接管 CLI 的工具权限询问；关闭后 CLI 走它自己的路径 |
| `approvalMode` | `auto` | `auto` 按会话访问盾自动裁决；`ask` 让每个被拦下的调用等你在设置页决定 |
| `approvalTimeoutMs` | `120000` | `ask` 模式下的等待上限，超时即拒绝 |
| `resume` | `true` | 每个 dsh 会话对应一个 Claude Code 会话（首轮 `--session-id`，之后 `--resume`），上下文与工具历史跨轮保留 |
| `configDir` | `""` | 子进程的 `CLAUDE_CONFIG_DIR`；设一个独立目录可把中转站的会话/设置/技能与你自己的 `~/.claude` 隔离 |
| `maxTurns` | `0` | 每次请求的 `--max-turns` 上限；0 = CLI 默认 |
| `idleTimeoutMs` | `1800000` | 多久没有任何输出帧就杀掉子进程（运行中的工具本来就会长时间静默，默认 30 分钟） |
| `toolActivity` | `true` | 把 Claude Code 自己的工具调用/结果显示为聊天中的思考行 |
| `toolCards` | `true` | 把 CLI 的工具调用渲染为真正的 dsh 工具卡片（影子工具只回放 CLI 已捕获的结果，不重复执行）；工具注册表不可用时回退为思考行 |
| `earlyDeliver` | `true` | 回合进行中入队的消息立即写给运行中的 CLI（CLI 排队为下一轮）：当前回合一结束就开始作答，dsh 为该消息开启的回合直接回放缓冲的应答帧，不再重复发送 |
| `systemPrompt` | `true` | 请求自带 system prompt（如会话标题这类辅助调用）时经 `--append-system-prompt` 转发 |
| `extraEnv` | `{}` | 附加子进程环境变量（如 `API_TIMEOUT_MS`、`ANTHROPIC_CUSTOM_HEADERS`），优先级最高 |
| `extraArgs` | `[]` | 附加 CLI 参数，追加在每次 `claude -p` 之后 |
| `debug` | `false` | 记录每次调用的启动参数（不含提示词） |

### 挂多个中转站

`cordis.patch.yml` 里加第二行（`id` 不同、`name` 相同），并给各自不同的 `providerId`，即可同时接两个站点或账号。设置页编辑的是第一个挂载点（`claude-code-relay` 命名空间）；额外挂载点仍用配置文件管理。

## 权限：访问盾如何落到 Claude Code

`claude -p` 是无头子进程，没有人可以回答它的权限询问；若把审批留给 CLI 自己的交互闸门，表现就是工具莫名其妙地失败。因此 dsh 的访问盾会**提前**翻译成 CLI 的标志，让每轮的权限状态在一开始就是确定的：

| 会话访问盾 | `--permission-mode` | 工具白名单/黑名单 |
| --- | --- | --- |
| `read-only` | `default` | 放行 `Read`/`Glob`/`Grep`/`NotebookRead`/`TodoWrite`/`Task`/`WebFetch`/`WebSearch`，拒绝 `Edit`/`Write`/`NotebookEdit`/`Bash`/`BashOutput`/`KillShell` |
| `workspace-write` | `acceptEdits` | 放行 `WebFetch`/`WebSearch`（网络读取；dsh 的 `web_fetch` 在此盾下本就可用，而 CLI 会把这类调用卡在无头模式无人应答的权限询问上） |
| `danger-full-access` | `bypassPermissions` | 无 |

把 `permissionMode` 固定为某个值时，该值优先于上表，且不再下发工具名单。

上面的工具名单只约束 Claude Code 自己的判断；真正让"读得到的读、写不了的写不了"落地的是下面的审批桥接——两者用同一份访问盾，因此不会互相矛盾。

## 工具审批

Claude Code 会按自己的规则拦截工具调用，而无头运行（`claude -p`）没有人能回答它的询问——被拦下的调用会直接以"工具执行失败"结束，这就是工具莫名其妙报错的来源。本插件通过 `PreToolUse` 钩子接管这条路径：每次工具调用前，CLI 启动的钩子进程会把调用详情发给插件，插件给出裁决后再由钩子回传给 CLI。钩子通过**本次调用专属的 `--settings` 文件**注入，不会写入你自己的 `~/.claude` 设置，因此只对本插件的对话生效。

两种决策方式（`approvalMode`）：

- **`auto`（默认）**：按会话的访问盾裁决——盾内放行、盾外拒绝，不打断你。被拒的理由会原样出现在对话里，例如 `"Write" is outside this session's dsh access policy`。
- **`ask`**：每个被拦下的调用都出现在设置页的「工具审批」区，等你点「允许一次」或「拒绝」。等待答复的上限由 `approvalTimeoutMs` 控制（默认 120 秒），超时即拒绝——**任何情况下都不会让 Claude Code 无限期阻塞**。

裁决只对单次调用有效。桥接不可达、钩子请求格式错误、会话提前结束，一律按拒绝处理：失败方向永远是"更保守"，绝不静默放行。关闭 `approvalBridge` 只停用工具审批；下述的压缩通知钩子仍然保留。

## 上下文压缩

长对话的压缩由 **Claude Code 自己执行**——它拥有 `--resume` 的会话与 transcript，dsh 侧压缩省不了一个 token（CLI 会话仍是全量，只会多付一次摘要调用）。插件做三件事让这个过程在 dsh web 里完全可见：

- **阈值排序**：为 CLI 注入 `CLAUDE_CODE_AUTO_COMPACT_WINDOW = 0.7 × contextWindow`（CLI 支持范围 100K–1M，自动收敛）。dsh 自己的压缩器在 `0.8 ×` 同一窗口触发，因此 CLI **永远先压**、用量随即归零，dsh 的压缩器不会醒来——不会出现两套压缩互不知情地重复计费。你自己设置了该环境变量时以你的为准。
- **开始即提示**：压缩期间 CLI 在 stdout 上一言不发（官方已拒绝在流里加"开始压缩"事件，见 [anthropics/claude-code#48740](https://github.com/anthropics/claude-code/issues/48740)），但 `PreCompact` 钩子会立刻触发。钩子经插件常驻的 socket 桥把通知即时送进正在流的对话，聊天里马上出现"⇣ compacting context…"而不是冻结一到三分钟。
- **结果可读**：压缩完成后的 `compact_boundary` 帧渲染为一行"⇣ context compacted: 117766 → 1705 tokens (auto, 33.2s)"（wire 上是 snake_case 字段，transcript 文件的 camelCase 也兼容）；随后 CLI 的续接摘要（`isSynthetic` 帧）渲染为"⇣ context continues from a compacted summary: …"。CLI 的 `api_retry` 帧同样渲染为"↻ relay retry"，中转站重试不再是无声的等待。

上下文计量以每轮 `result` 帧的 usage 为准：CLI 在 resume 时也会静默丢弃过旧的工具结果（实测 330K → 118K，无任何边界帧），只有 usage 数字是唯一可信的口径，而这正是插件一直在上报的。

## 常驻进程

每个会话对应一个**常驻 CLI 进程**：`claude -p --input-format stream-json` 的 stdin 保持打开时可以逐行接收后续轮次（实测验证），所以第二轮起直接写进同一个进程，不再每轮重启 CLI。收益有三层：

- **快**：省掉每轮 1–3 秒的 CLI 启动（设置加载、技能、MCP 握手）。实测同一会话冷轮 7.7s → 暖轮 4.3s。
- **稳**：不再依赖「transcript 文件是否已落盘」来决定 `--resume`——活进程本身就是历史，竞态窗口消失。
- **省**：暖轮的请求直接增量命中上游缓存（实测第二轮 `cache_read 62K / 仅新增写 4.4K`），冷启动反而不命中。

进程的生命周期完全自治：空闲 10 分钟自动回收；模型、思考强度、系统提示词或访问盾在会话中途变化会自动重拉（这些参数在 spawn 时固化）；中止或崩溃直接丢弃——CLI 落盘的 transcript 就是恢复点，下一轮以 `--resume` 重拉后记忆完整（实测杀进程后暗号仍记得）。设置页的「常驻进程」开关（`resident`，默认开）可退回每轮独立启动。辅助调用（会话标题等）不经常驻进程，仍走一次性子进程。宿主退出时关闭的 stdin 管道就是子进程的退场信号，不会留孤儿进程。

## 推理强度

提供方按 dsh 的模型能力契约声明了推理档位（`low` / `medium` / `high` / `xhigh` / `max`，默认 `medium`），因此 dsh 的模型选择器会显示思考强度控件，选择结果会原样传给 `claude --effort`。声明档位是必须的：dsh 会用模型自报的档位校验请求，未声明的模型上任何显式档位都会在请求发出前被拒。

## 主页显示哪些模型

dsh 的模型选择器直接由提供方的模型列表构建，因此「显示哪些模型」就是「列表返回哪些」。设置页的「主页显示的模型」区会从中转站读取可用的模型并逐项勾选；**不勾选任何一项表示全部显示**——这样初次配置不会得到一个空选择器。未勾选的模型仍然可以直接调用，只是不再出现在选择器里。

## 它会接触什么

- **运行** 你配置的 `claude` 可执行文件，每个对话轮次一个子进程，环境里带上中转站地址与密钥。
- **读取** dsh 的会话信息（取工作目录）与附件存储（用户消息里的图片转 base64 内联）。
- **写入** Claude Code 自己的会话记录（`<configDir 或 ~/.claude>/projects/...`）；密钥只出现在子进程环境与发往中转站的请求头里，不写盘。

## 排障

- **报 401 / authentication_error**：先在设置页切换鉴权方式（Bearer ↔ x-api-key），再核对 `baseUrl` 是否少了或多了路径段。
- **模型不可用**：`models` 里的 `id` 必须是中转站接受的模型名，原样传给 `--model`。
- **CLI 不在 PATH**：设 `command` 为绝对路径；Dock 启动的 dsh 也会自动在常见安装目录里找。
- **`claude exited N: ...`**：开 `debug: true` 看启动参数；错误尾文里会带上 CLI 的 stderr。
- **会话恢复失败自动重试**：`--resume` 找不到记录时，该轮会以新会话 id 重发完整对话并继续，日志里有 `retrying fresh` 警告。

## 与 oh-my-claude 相比没有的内容

审批走本插件自己的面板（设置页 → Claude Code → 工具审批），不走 dsh 通用的审批对话框：dsh 的审批通道只服务于 dsh 自己执行的工具，而这里的工具由 `claude` 子进程执行，dsh 从未派发过它们，因此没有一条把子进程的审批请求送进 dsh 通用审批 UI 的通路。另无 MCP 桥接 dsh 子智能体、无费用/套餐面板、无 SSH 远程主机、无 CLI 自动更新管理；Windows 未测试。Claude Code 内部 Task/Agent 子智能体的运行过程会以缩进的思考行（`  ↳ …`）实时显示在其调用行下方——包括子代理自己的思考、工具调用与结果，带每块 480 字符、每次运行 40 行的预算上限；其最终报告出现在 `◂` 结果行里。与 dsh 原生子代理的差别：没有独立的子会话记录、没有会话层级的 "n subagent" 入口，嵌套内容以思考行而非结构化卡片呈现（dsh 的提供方流式契约只理解文本与思考块，无法伪造原生卡片）。

## 测试

```sh
npm install && npm test    # 96 项：纯函数、审批与压缩桥接（含真实 socket 往返与真实钩子脚本）、常驻进程（复用/重拉/空闲回收/帧排空）、假 CLI 端到端（含压缩轮次）、以及用假 React 渲染真实客户端 bundle
```

## 许可证

MIT。Claude 与 Claude Code 是 Anthropic, PBC 的商标；本项目是独立第三方插件。
