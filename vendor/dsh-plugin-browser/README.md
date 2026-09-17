# DSH 浏览器插件

`dsh-plugin-browser` 为网页版 DeepSeek Harness 提供按 Session 隔离的 Chromium 浏览器，并在右侧栏显示同一个浏览器页面：

- `browser` 工具使用按 Session 隔离的 Playwright Chromium，适合自动化操作、可访问性快照和截图。
- Web 右侧栏的 `浏览器` 页面通过官方 Sidebar 扩展 API 实时串流同一个页面，并把鼠标、键盘、导航和滚动输入转发回去。
- 右侧栏按真实浏览器组织：标签栏、后退/前进、停止加载、地址栏、工具菜单和右键菜单齐备，标签页数量与当前页状态随 Agent 的操作同步。
- 同一个页面可在右侧栏页签与主页区整页面板之间切换，工具栏的窗口分组给出 `在主页区打开` 与 `收回到侧栏`；两处共享标签、`访问记录` 与画面，缩放和排版档位各面独立。
- 地址栏获得焦点时展开 `访问记录`，按最新在前列出本会话访问过的页面，点一条即可回到该页面；没有记录时显示空态提示。
- 画面带操作提示：Agent 的动作会留下鼠标光标和说明标签，指针悬停会勾出元素并显示角色与名称，聚焦的输入框有描边和光标，键入内容会短暂回显。
- 排版在桌面布局与适配侧栏之间切换，配合缩放档位；画面可点击、拖动、滚动、双击选词、粘贴文本，并支持中文输入法和 Tab、方向键、翻页键等。
- 在 DSH Desktop 这类由 Electron 主进程持有窗口的宿主里，面板改为把页面的位置、缩放与可见性上报给宿主，由原生视图承载真实页面：无编码、无串流，文字按原生分辨率绘制，鼠标和键盘直达页面；任何失败自动回退到串流面板。

工具和右侧栏共享 Cookie、Storage、登录状态与页面历史；Host 自动化仍默认无头运行，右侧栏提供可见操作面板。密码和 MFA 由用户在右侧栏手动输入，工具不会导出凭据。

## 宿主支持

- 两端共用同一个包 `dsh-plugin-browser`，没有桌面端专用包。
- Web 端：右侧栏 `浏览器` 页面用 CDP screencast 串流按 Session 隔离的 Chromium 页面。
- 桌面端：宿主提供 `desktopNativeBrowser` 服务时，同一个面板改为把页面位置、缩放与可见性上报给宿主，由 Electron 主进程的原生视图承载页面（无编码串流、原生分辨率、鼠标键盘直达页面）；服务缺失或失败时自动回退到串流面板。
- 桌面专属能力只用 `ctx.get?.('desktopNativeBrowser')` 在运行时探测，不放进顶层 `inject`，普通 Web 宿主照常加载；这符合 anywhere-labs/dsh-desktop 插件规范的[「兼容 Desktop 和普通 DSH」](https://github.com/anywhere-labs/dsh-desktop/blob/master/docs/plugin-development.md)写法。
- 验证：桌面端已在 DSH Desktop 实例上实测（2026-09-15：agent 的 `browser` 工具打开页面取回标题与可访问性快照、右侧栏与主页区两个承载面的几何与缩放、面板菜单展开时的可见性）；Web 端验收 44 条中 42 条通过，另 2 条需要 `BROWSER_TEST_EXECUTABLE` 指向本机 Chrome。
- 桌面端没有需要单独维护的仓库，两端由本仓库同一份实现维护。

## 功能截图

![右侧栏浏览器页面](docs/screenshots/right-sidebar-browser.png)

图：在 DSH Web 右侧栏中浏览本地 fixture 页面的验收截图，含聚焦描边、元素标签、键入回显与指针光标；来源和验证边界见 [`docs/screenshots/SOURCES.md`](docs/screenshots/SOURCES.md)。

![右侧栏标签栏与工具菜单](docs/screenshots/right-sidebar-browser-tabs.png)

图：同一面板的标签栏、后退与前进状态、地址栏，以及工具菜单中的缩放档位和 `适配侧栏宽度` 选项。

## 安装

需要 Node.js 22.19 或更高版本，以及 Chromium 运行时依赖。安装和启动 Harness 时必须使用同一个 `DSH_HOME`。

```sh
git clone https://github.com/hzxwonder-dsh-plugins/dsh-plugin-browser.git
cd dsh-plugin-browser
npm ci
npm run browser:install
dsh plugin --profile migration add "file:$PWD"
```

保留 `file:` 前缀可让 pnpm 安装插件声明的依赖；裸路径会被当作 `link:`，只链接
插件目录。

修改插件配置后请重启 Harness。Host 自动化使用无头 Chromium，右侧栏显示同一页面。可配置已有 Chrome：

```yaml
- id: dsh-plugin-browser
  config:
    executablePath: /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
    headless: true
```

保持 `headless: true`，在右侧栏 `浏览器` 中查看页面或手动输入密码/MFA。每个 Session 使用独立的临时 BrowserContext，同时最多保留 8 个；调用 `close` 或退出 Harness 后登录状态清除。

`allowedOrigins` 限定浏览器可以访问的站点，省略或留空时不限制：

```yaml
- id: dsh-plugin-browser
  config:
    allowedOrigins:
      - https://example.com
      - https://intranet.example.com:8443
```

列表项按归一化后的 origin 精确匹配（协议、主机与端口；路径和查询会被忽略），非 HTTP(S) 的条目或非数组写法会在插件加载时报错。

插件升级后，Playwright 所需的 Chromium 版本可能变化。请运行 `npm run browser:install` 安装匹配版本，或通过 `executablePath` 指定已有 Chrome，并重启 Harness。缺少运行时时，右侧栏会保留安装提示，直到下一次操作。

## 右侧栏浏览器

安装 Web 客户端扩展后，右侧栏会注册 `浏览器` 页面：

1. 打开 Harness Web 的右侧栏并选择 `浏览器`。工具导航时该页面会自动出现。
2. 地址栏输入目标 HTTP(S) 地址并按 Enter；工具导航也会驱动同一页面。地址栏获得焦点会展开 `访问记录`，按最新在前列出本会话访问过的页面，点一条即可回到该页面；没有记录时显示空态提示。
3. 工具栏按导航、地址、视图和窗口四组组织：后退、前进和刷新（加载中变为停止）在导航组，地址栏与回车 `打开` 在地址组，`⋯` 工具菜单与 `兼容模式` 标注在视图组，窗口组负责右侧栏与主页区之间的切换和 `关闭浏览器`；错误提示独立成行，右侧 `×` 可关闭。
4. 窗口组的 `在主页区打开` 把同一个页面铺到主页区面板，面板工具栏的 `收回到侧栏` 把它放回右侧栏页签：两处是同一个 Session 的同一个页面，标签、`访问记录` 与画面共享，缩放与 `桌面布局 / 适配侧栏宽度` 档位各面独立。
5. 用标签栏管理多个页面：`+` 新开标签，点标签切换，`×` 关闭；网站自行弹出的新窗口会成为受管标签而不是丢失，每个 Session 最多 12 个标签，达到上限后 `+` 会被拒绝，站点弹窗则直接关闭。
6. 后退和前进按当前标签的历史置灰或可用；加载中刷新按钮变为停止按钮，可中止慢页面。点画面即可操作网页，点中的位置会出现波纹和指针，聚焦的输入框会显示描边与光标。
7. 键盘输入发送给当前聚焦的元素，粘贴、拖动和滚动同样生效。`Ctrl/Cmd+C` 把页面中选中的文字复制到系统剪贴板，右键菜单提供复制、粘贴和全选。Agent 操作时画面会显示它点击或输入的位置和标签。
8. `⋯` 菜单切换 `桌面布局（宽 1280）` 与 `适配侧栏宽度`，并提供放大、缩小和恢复 100%。桌面布局保留页面在真实宽屏下的排版，适配侧栏把侧栏宽度当作页面宽度，文字更适合在窄栏中阅读。

页面只接受不带用户名和密码的 HTTP(S) 地址。右侧栏通过已认证的 Host 接口串流 Chromium 画面，无 iframe 嵌入限制；右侧栏页签与主页区面板只有当前可见的一处请求画面。画面按 CDP 事件推送，静止页面不产生流量，动作时即时更新；串流以两秒心跳报告是否仍在推送画面，持续没有新画面时画面右上角提示暂停。串流不可用时自动回退为按次截图并在工具栏标注 `兼容模式`，随后自动重试实时画面。人类输入按画面比例定位，排版或缩放变化不会把点击落到别处。用户输入会使旧的工具 observation 失效；工具需重新 snapshot 后继续操作。不提供音视频流、文件下载和凭据导出。

## 桌面端原生承载面

在 DSH Desktop 这类由 Electron 主进程持有窗口的宿主里，同一个页面可以由宿主的原生视图承载，交给窗口合成器直接绘制。承载方式由宿主在会话的第一个标签建立时选定，并通过面板状态里的 `transport` 告诉客户端：

- `native`：画面来自合成器，没有编码、没有帧流、也没有画布；文字按原生分辨率显示，鼠标和键盘由原生视图直接接收，面板不再转发输入。
- `screencast`：今天的串流面板。Web GUI、远程宿主、只读会话以及任何一次原生失败都留在或回到这一档。

原生承载下面板只负责「洞」：它在舞台里量出原生视图该占的矩形（CSS 像素、相对渲染进程视口）、缩放比例和是否可见，用 `ResizeObserver` 与 `requestAnimationFrame` 合并后按需上报，值没有变化就不发请求。`适配侧栏宽度` 把整个舞台交给页面并取 100%，`桌面布局（宽 1280）` 上报原有缩放后画面的矩形，缩放为洞宽与逻辑宽度之比，缩放档位因此照常生效。窗口尺寸变化、侧栏折叠、底部面板开合、切换会话或标签、以及右侧栏页签与主页区面板互换都会重新测量。标签页不可见、面板被切走、右侧栏折叠、`⋯` 工具菜单或 `访问记录` 下拉或右键菜单打开、错误提示条展开时上报不可见，宿主随之收起原生视图，页面不会浮在这些界面之上。任何失败都会拆掉原生视图并回退到串流，面板不会同时出现两幅画面；标签、访问记录和页面状态在两个承载面上依旧是同一个页面。

## `browser` 工具

工具动作包括 `navigate`、`snapshot`、`screenshot`、`click`、`fill`、`press`、`scroll`、`tabs`、`console`、`evaluate` 和 `close`。`tabs` 用 `op` 选择 `list`、`new`、`select` 或 `close`，配 `tab` 指定标签 ID；`list` 是纯读取，切换和关闭标签会让旧 observation 失效。

先导航或获取快照，再把最新的 `observation`、精确的可访问性 `role` 和 `name` 传给输入动作。页面发生变化后必须重新获取快照。没有可访问性名称的纯视觉目标，可以按快照中的坐标点击：

```json
{"action":"click","x":420,"y":180,"observation":5}
```

`press` 只转发固定按键集合（Enter、Tab、Shift+Tab、Esc、Backspace、Delete、Insert、方向键、Home、End、PageUp、PageDown、F5 以及 Ctrl/Cmd 组合），可打印文本请使用 `fill`。`evaluate` 只接受固定检查项：`title`、`visible_text`、`links` 和 `layout`，不会执行任意 JavaScript。

示例：

```json
{"action":"navigate","url":"http://127.0.0.1:3000"}
```

```json
{"action":"snapshot"}
```

```json
{"action":"fill","role":"textbox","name":"项目名称","text":"demo","observation":3}
```

`screenshot` 返回 Harness attachment，密码和一次性验证码字段会被遮罩。输出会进行有限度的 Token、Cookie、Authorization 等字段脱敏；这不是完整的数据防泄漏系统。

## 权限与数据边界

- 仅允许 HTTP(S) 导航，包括 localhost；拒绝 `file:`、`data:`、`javascript:` 和带凭据的 URL。
- 配置 `allowedOrigins` 后，只有列表内 origin 的顶层导航被放行：`navigate` 返回 `BROWSER_ORIGIN_DENIED`，站点自发的重定向或脚本跳转在提交时被拦回空白页；子资源仍只按 HTTP(S) 协议过滤。
- `read-only` 沙箱允许读取和观察，拒绝 `click`、`fill`、`press`；悬停提示与 `访问记录` 读取仍可用。
- 密码和 MFA 必须由用户在可见浏览器中手动输入；插件不提供凭据导出能力。
- 页面文本、URL、控制台输出和截图可能包含私密内容，会进入 Session 记录或模型上下文；页面内容始终按不可信任务数据处理。
- `访问记录` 只按 Session 保存在内存中，仅记录 HTTP(S) 页面，按 URL 去重、最新的在前，最多 256 条。
- 下载、Service Worker、任意脚本执行和跨 Session 复用均未开放。页面权限请求一律拒绝。
- 每个 Session 最多 12 个标签页：显式新开超限返回 `BROWSER_TAB_LIMIT`，不会挤掉已开标签；站点弹窗超限时直接关闭。

浏览器进程继承宿主网络权限。带登录状态的点击可能修改外部系统，使用前应确认目标和授权范围。

## 验证

```sh
npm test
# 可选：使用已有 Chrome
BROWSER_TEST_EXECUTABLE=/path/to/chrome npm test
```

测试会启动本地 HTTP fixture，覆盖导航、表单输入、过期 observation 拒绝、控制台、截图、固定检查项、Session 隔离，以及右侧栏串流帧、指针与聚焦事件、拖动和坐标点击；标签页新建、切换与关闭，弹窗转标签，历史前进后退状态，停止加载和页面选区读取也在同一套集成测试中运行。`allowedOrigins` 的归一化与拒绝、访问记录的记录与去重上限、标签上限与超限弹窗的处理同样有测试覆盖。桌面原生承载下客户端的几何、缩放与可见性上报，以及回退到串流后的行为，由 `test/client-native.test.js` 在不依赖宿主的情况下渲染真实客户端来覆盖。Harness Web 右侧栏激活和原生 attachment 显示属于独立集成检查，完整场景见 [`docs/e2e.md`](docs/e2e.md)。

## 开发文档

- [`docs/spec.md`](docs/spec.md)：工具和右侧栏页面契约。
- [`docs/e2e.md`](docs/e2e.md)：浏览器引擎及 Web 集成验证场景。
- [`README.en.md`](README.en.md)：English documentation。

## 许可证与来源

LGPL-3.0-only。实现遵循 DeepSeek Harness 官方客户端扩展接口，并参考 PI-Desktop 的浏览器交互契约；完整归属信息见 [`NOTICE`](NOTICE)，依赖项保留各自许可证。
