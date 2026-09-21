# DSH Desktop 工作流插件验收报告

生成时间：2026-09-21 10:46　应用：DSH Desktop 2.0.11（运行时 0.1.5-rc.2）　被测插件：dsh-plugin-workflow 0.3.0 (f7eef1d)

运行环境：macOS 26.5.1 (25F80)　Apple M2 Pro　Node v24.11.1

## 一、结论

本轮在真实 Desktop 窗口里逐条执行 **44** 条用例，覆盖入口、创建与多实例、关闭与重开、主题、布局、创建—运行—对话链路、鲁棒性七组（P0 12 条、P1 22 条、P2 10 条）：**通过 44 条**，失败 0 条，未自动判定 0 条。

发现 9 个值得修复的问题，高优先级 2 个（D-1、D-9）：

- **D-1（高）超长名称与描述会撑破卡片，并把整列网格挤变形** —— 对应用例 W-B-06
- **D-2（中）卡片宽度由容器决定，宽窗口下被拉长，右侧还留下一列空白** —— 对应用例 W-B-05、W-E-01
- **D-3（中）深色主题下"已发布"状态标签对比度只有 2.93:1** —— 对应用例 W-D-02
- **D-4（中）面板关闭后仍每两秒请求一次后端，重启后又不会自己回来** —— 对应用例 W-R-10、W-C-04、W-C-05
- **D-5（中）归档不可撤销、搜索没有清除入口、计数不区分筛选与总数** —— 对应用例 W-A-03、W-A-05、W-C-07、W-C-08
- **D-6（中）后端错误直接以英文原文展示，且无法关闭或重试** —— 对应用例 W-R-03
- **D-7（中）创建、拷贝与归档没有进行中状态，连点会重复触发** —— 对应用例 W-R-01、W-R-05
- **D-8（低）卡片与列表切换、已归档复选是面板里最小的两个控件** —— 对应用例 W-E-06
- **D-9（高）从卡片开始的会话停在"选择工作区"，运行创建的对话也不出现在卡片里** —— 对应用例 W-F-02、W-F-04

每个问题的现象、复现步骤、证据与修复状态见第四节；全部用例逐条结果见第三节。

## 二、测试方法与范围

被测对象是在隔离的 fixture home 中运行的 DSH Desktop 打包版：插件从分发仓库的 `vendor/dsh-plugin-workflow`
安装，模型请求指向本机 mock 服务，因此用例不消耗真实额度，也不产生真实内容。工作区、会话与工作流数据库都在
`.qa/` 之下，与日常使用环境完全分离。

驱动方式是通过 Chrome DevTools Protocol 连接真实窗口：断言读取真实 DOM 的文本、位置与样式，点击通过坐标派发，
窗口尺寸通过渲染进程的 `resizeTo` 改变并读回实际尺寸确认生效。每个用例开始前把 fixture 恢复到一个种子工作流，
因此上一轮的残留不会让断言以错误的理由通过。对比度取自渲染后的颜色与字号，按 WCAG 相对亮度公式计算。

覆盖的用户行为：打开与关闭面板、连续创建多个工作流、拷贝、归档与恢复、搜索与清空、卡片与列表切换、浅色与深色主题、
系统主题跟随、窗口从 1280px 缩放到应用允许的最小宽度、刷新页面、退出并重启应用。
反常行为：狂点创建与运行、创建过程中关闭面板、搜索框输入正则元字符与超长文本、打开不存在的运行记录、
写入结构不完整的工作流定义、后端不可用、页面隐藏时的轮询、超长名称与描述、名称里带脚本片段。

## 三、用例结果

### A. 入口与总览（5/5 通过）

| 用例 | 优先级 | 标题 | 结果 | 说明 | 截图 |
| --- | --- | --- | --- | --- | --- |
| W-A-01 | P0 | 侧栏入口打开工作流面板并显示总览 | 通过 | 95ms | [图](../evidence/workflow-desktop/A-01-panel-open.png) |
| W-A-02 | P1 | 卡片与列表两种样式切换且偏好保留 | 通过 | 1015ms | [图](../evidence/workflow-desktop/A-02-list-view.png) |
| W-A-03 | P1 | 空状态：搜索无结果给出解释与清除入口 | 通过 | 1488ms | [图](../evidence/workflow-desktop/A-03-search-empty.png) |
| W-A-04 | P2 | 搜索匹配名称与描述且大小写无关 | 通过 | 1282ms | — |
| W-A-05 | P2 | 归档视图为空时解释归档含义 | 通过 | 976ms | [图](../evidence/workflow-desktop/A-05-archive-empty.png) |

### B. 创建与多实例（6/6 通过）

| 用例 | 优先级 | 标题 | 结果 | 说明 | 截图 |
| --- | --- | --- | --- | --- | --- |
| W-B-01 | P0 | 创建工作流进入对话并在输入区显示工作流标签 | 通过 | 3610ms | [图](../evidence/workflow-desktop/B-01-create-conversation.png) |
| W-B-02 | P1 | 从总览创建第二个工作流互不干扰 | 通过 | 5825ms | [图](../evidence/workflow-desktop/B-02-second-create.png) |
| W-B-03 | P1 | 拷贝工作流产生未发布草稿且不带走运行记录 | 通过 | 4845ms | [图](../evidence/workflow-desktop/B-03-copy-result.png) |
| W-B-04 | P0 | 连续创建多个工作流后列表完整且名称唯一 | 通过 | 4529ms | [图](../evidence/workflow-desktop/B-04-many-workflows.png) |
| W-B-05 | P1 | 列表样式在多个工作流下逐行对齐操作可用 | 通过 | 1025ms | [图](../evidence/workflow-desktop/B-05-list-many.png) |
| W-B-06 | P2 | 超长与特殊字符名称不破坏布局 | 通过 | 1866ms | [图](../evidence/workflow-desktop/B-06-long-name.png) |

### C. 生命周期（关闭、隐藏、重开）（8/8 通过）

| 用例 | 优先级 | 标题 | 结果 | 说明 | 截图 |
| --- | --- | --- | --- | --- | --- |
| W-C-01 | P0 | 再次点击入口关闭面板回到对话 | 通过 | 1917ms | [图](../evidence/workflow-desktop/C-01-panel-closed.png) |
| W-C-02 | P1 | Escape 关闭面板且不误触其他操作 | 通过 | 3541ms | [图](../evidence/workflow-desktop/C-02-escape.png) |
| W-C-03 | P0 | 隐藏窗口再恢复后面板与数据保持一致 | 通过 | 5239ms | [1](../evidence/workflow-desktop/C-03-hidden.png) [2](../evidence/workflow-desktop/C-03-restored.png) |
| W-C-04 | P1 | 页面刷新后面板与视图偏好恢复 | 通过 | 3663ms | [图](../evidence/workflow-desktop/C-04-after-reload.png) |
| W-C-05 | P0 | 退出并重开应用后面板状态与数据一致 | 通过 | 102123ms | [图](../evidence/workflow-desktop/C-05-after-restart.png) |
| W-C-06 | P1 | 编辑态：切换面板视图后草稿与选中步骤保留 | 通过 | 5342ms | [图](../evidence/workflow-desktop/C-06-graph-view.png) |
| W-C-07 | P1 | 归档后从总览消失、在归档视图可恢复 | 通过 | 8444ms | [图](../evidence/workflow-desktop/C-07-archived.png) |
| W-C-08 | P2 | 归档状态跨应用重启保留 | 通过 | 102882ms | — |

### D. 主题与视觉（5/5 通过）

| 用例 | 优先级 | 标题 | 结果 | 说明 | 截图 |
| --- | --- | --- | --- | --- | --- |
| W-D-01 | P0 | 浅色主题下工作流总览可读且文字对比度达标 | 通过 | 3909ms | [图](../evidence/workflow-desktop/D-01-light-gallery.png) |
| W-D-02 | P0 | 深色主题下工作流总览可读且文字对比度达标 | 通过 | 2938ms | [图](../evidence/workflow-desktop/D-02-dark-gallery.png) |
| W-D-03 | P1 | 面板打开时切换主题不丢状态也不残留旧配色 | 通过 | 4556ms | [图](../evidence/workflow-desktop/D-03-theme-cycled.png) |
| W-D-04 | P1 | 深色主题下编辑器步骤列表与设置面板对比度达标 | 通过 | 4825ms | [图](../evidence/workflow-desktop/D-04-dark-editor.png) |
| W-D-05 | P2 | 系统主题跟随：系统改变时应用同步且无闪烁残留 | 通过 | 11809ms | [图](../evidence/workflow-desktop/D-05-theme-follow.png) |

### E. 布局与样式校验（6/6 通过）

| 用例 | 优先级 | 标题 | 结果 | 说明 | 截图 |
| --- | --- | --- | --- | --- | --- |
| W-E-01 | P0 | 1280×900 下总览无横向溢出、无控件重叠 | 通过 | 1338ms | [图](../evidence/workflow-desktop/E-01-1280.png) |
| W-E-02 | P1 | 1024×768 下操作入口仍可达 | 通过 | 1313ms | [图](../evidence/workflow-desktop/E-02-1024.png) |
| W-E-03 | P0 | 窗口收窄到应用下限时侧栏与面板不重叠且主要操作可见 | 通过 | 2988ms | [图](../evidence/workflow-desktop/E-03-640.png) |
| W-E-04 | P2 | 请求极窄宽度时窗口停在下限且无横向滚动 | 通过 | 3107ms | [图](../evidence/workflow-desktop/E-04-narrow.png) |
| W-E-05 | P1 | 编辑器在两栏布局下资源面板与步骤列表不重叠 | 通过 | 2626ms | [图](../evidence/workflow-desktop/E-05-editor-1280.png) |
| W-E-06 | P1 | 关键控件触达尺寸不低于 32px 且图标按钮有可访问名称 | 通过 | 4541ms | [图](../evidence/workflow-desktop/E-06-control-sizes.png) |

### F. 创建—运行—对话链路（4/4 通过）

| 用例 | 优先级 | 标题 | 结果 | 说明 | 截图 |
| --- | --- | --- | --- | --- | --- |
| W-F-01 | P0 | 从卡片运行工作流进入绑定会话 | 通过 | 15906ms | [图](../evidence/workflow-desktop/F-01-run-bound.png) |
| W-F-02 | P1 | 运行会话在工作流对话列表中可重新打开 | 通过 | 5122ms | [1](../evidence/workflow-desktop/F-02-sessions.png) [2](../evidence/workflow-desktop/F-03-conversation-open.png) |
| W-F-03 | P1 | 编辑器修改任务说明后未保存提示与保存生效 | 通过 | 9468ms | [1](../evidence/workflow-desktop/F-04-dirty-editor.png) [2](../evidence/workflow-desktop/F-03-saved-editor.png) |
| W-F-04 | P2 | 对话修改入口打开创作会话并标注工作流 | 通过 | 11068ms | [图](../evidence/workflow-desktop/F-05-authoring.png) |

### R. 鲁棒性与反常行为（10/10 通过）

| 用例 | 优先级 | 标题 | 结果 | 说明 | 截图 |
| --- | --- | --- | --- | --- | --- |
| W-R-01 | P0 | 狂点创建入口不会重复创建或卡死 | 通过 | 8386ms | [图](../evidence/workflow-desktop/R-01-rapid-create.png) |
| W-R-02 | P1 | 创建过程中关闭面板不产生半成品或报错 | 通过 | 5095ms | [图](../evidence/workflow-desktop/R-02-interrupt-create.png) |
| W-R-03 | P1 | 后端不可用时报错可读且清空输入可恢复 | 通过 | 9134ms | [图](../evidence/workflow-desktop/R-03-offline-recovered.png) |
| W-R-04 | P1 | 搜索框输入正则与超长文本不崩溃 | 通过 | 24083ms | [图](../evidence/workflow-desktop/R-04-search-fuzz.png) |
| W-R-05 | P1 | 重复点击卡片动作不会重复执行 | 通过 | 5138ms | [图](../evidence/workflow-desktop/R-05-rapid-run.png) |
| W-R-06 | P2 | 窗口在面板打开时连续缩放不残留布局错误 | 通过 | 8435ms | [图](../evidence/workflow-desktop/R-06-resize-cycle.png) |
| W-R-07 | P1 | 面板打开时退出应用不产生未捕获错误 | 通过 | 100479ms | [图](../evidence/workflow-desktop/R-07-reopen.png) |
| W-R-08 | P2 | 打开不存在的运行记录不破坏面板 | 通过 | 96ms | [图](../evidence/workflow-desktop/R-08-bad-run.png) |
| W-R-09 | P2 | 损坏的工作流定义不阻塞总览加载 | 通过 | 2701ms | [图](../evidence/workflow-desktop/R-09-degenerate.png) |
| W-R-10 | P1 | 后台标签页期间面板不高频轮询（可见性节流） | 通过 | 12136ms | [图](../evidence/workflow-desktop/R-10-visibility.png) |

## 四、问题与修复

### D-1　超长名称与描述会撑破卡片，并把整列网格挤变形

- 严重程度：高
- 对应用例：W-B-06
- 用户可见影响：用户粘贴一个长标题之后，总览从"扫一眼挑一个"退化成需要滚动阅读的长文，卡片上的操作按钮被推到屏幕之外。
- 现象与根因：名称与描述没有长度上限。名称整段换行占到五行以上，描述按原文长度铺开，单张卡片高度可达视口的大半；同一行里其余卡片被拉成同样高度，一屏只能看到两三条记录。
- 复现：保存一个名称含六段"很长的中国語名称段落"、描述重复 120 次并带 `<script>` 片段的工作流，在卡片样式下观察；对应用例 `node qa/workflow-desktop/run.mjs run W-B-06`。
- 证据：`evidence/workflow-desktop/B-06-long-name.png`
- 当前状态：已修复：标题收成一行、描述两行、列表行一行，超出部分省略；完整文本保留在元素的 `title` 属性里，悬停可读。用例断言三种截断生效、卡片高度不超过同屏最短卡片的两倍，且完整文本仍可读取。

### D-2　卡片宽度由容器决定，宽窗口下被拉长，右侧还留下一列空白

- 严重程度：中
- 对应用例：W-B-05、W-E-01
- 用户可见影响：两种情况都影响阅读：前者让四个操作按钮摊成四条宽条，后者让总览右侧出现一块明显的空档。
- 现象与根因：网格用 `1fr` 作为轨道上限时，面板越宽卡片越宽，同一个面板里出现 460px 的卡片；改成固定上限后，`auto-fill` 又按上限计算列数，936px 的一行只放两张 336px 卡片，右边空出 250px。
- 复现：在 1280×900 与更宽的窗口下打开总览，测量卡片宽度与容器宽度的差值；对应用例 `node qa/workflow-desktop/run.mjs run W-E-01`。
- 证据：`evidence/workflow-desktop/E-01-1280.png`、`B-05-list-many.png`
- 当前状态：已修复：轨道上限改为弹性、下限 292px，宽窗口增加列数而不是拉宽卡片；936px 一行三列填满，卡片约 303px。用例断言网格列宽之和加上间距不超过容器宽度一个间距，且卡片操作保持在单行。

### D-3　深色主题下"已发布"状态标签对比度只有 2.93:1

- 严重程度：中
- 对应用例：W-D-02
- 用户可见影响：在深色主题下，最难看清的恰好是判断"这份工作流能不能直接运行"的状态标记。
- 现象与根因：已发布与有未保存修改的标签使用写死的绿色和琥珀色。浅色主题下可读，深色主题下前景色 `#1d7d52` 落在`#25272b` 的半透明底色上，实测 2.93:1，低于正文所需的 4.5:1；字号只有 11px，属于最小的一档文字。
- 复现：系统切到深色后打开总览，对已发布的工作流取色计算；对应用例 `node qa/workflow-desktop/run.mjs run W-D-02`。
- 证据：`evidence/workflow-desktop/D-02-dark-gallery.png`、`evidence/workflow-desktop/results.json` 中 W-D-02 的实测比值
- 当前状态：已修复：标签颜色改读宿主的 `--dsw-alias-state-success-*` 与 `--dsw-alias-state-warn-*` 语义令牌，随主题变化；深色主题复测全部采样不低于 4.5:1。

### D-4　面板关闭后仍每两秒请求一次后端，重启后又不会自己回来

- 严重程度：中
- 对应用例：W-R-10、W-C-04、W-C-05
- 用户可见影响：关掉面板的用户持续承担后台请求；每次重启都要重新找到入口打开面板，工作流不是"上次离开的样子"。
- 现象与根因：轮询只判断页面可见性、不判断面板是否打开，面板关掉之后渲染进程依旧每两秒请求一次 `/api/workflow-studio`；反过来，面板状态没有被记住，刷新或重启窗口后总是回到关闭的工作流界面。
- 复现：打开面板后关闭，用 `window.fetch` 计数观察请求；再打开面板并重启应用，观察面板是否自动出现。对应用例 `node qa/workflow-desktop/run.mjs run W-R-10`、`W-C-04`、`W-C-05`。
- 证据：`evidence/workflow-desktop/R-10-visibility.png`、`C-04-after-reload.png`、`C-05-after-restart.png`
- 当前状态：已修复：开关状态写入 localStorage，轮询在面板关闭或页面隐藏时停转；插件启动时按记录向宿主申请面板。实测窗口隐藏 6 秒内请求 0 次、恢复后 4 次；刷新与重启后面板自动回到总览。

### D-5　归档不可撤销、搜索没有清除入口、计数不区分筛选与总数

- 严重程度：中
- 对应用例：W-A-03、W-A-05、W-C-07、W-C-08
- 用户可见影响：归档看起来像删除，用户不敢用；搜索无结果时不知道该改关键词还是该去创建工作流。
- 现象与根因：归档用垃圾桶图标、点完没有任何反馈，记录直接从列表消失，只能自己去"已归档"里找；搜索框没有清除按钮；无结果时不解释是"没有匹配"还是"还没有工作流"；计数只报筛选后的条数，看不出被过滤掉多少。
- 复现：归档任意工作流后观察列表与提示；在搜索框输入不存在的关键词，观察空状态与计数。对应用例 `node qa/workflow-desktop/run.mjs run W-A-03`、`W-A-05`、`W-C-07`。
- 证据：`evidence/workflow-desktop/A-03-search-empty.png`、`A-05-archive-empty.png`、`C-07-archive-restored.png`
- 当前状态：已修复：归档改用归档图标并给出带名称的提示条，提示条自带"撤销"；搜索框常驻清除按钮；计数写作"匹配 N / M 个"；三种空状态分别说明原因并给出离开该状态的入口。

### D-6　后端错误直接以英文原文展示，且无法关闭或重试

- 严重程度：中
- 对应用例：W-R-03
- 用户可见影响：用户看到的是内部术语，拿不到"重试"或"先关掉"的动作；一次瞬时故障会长期占据界面。
- 现象与根因：接口失败时面板里出现一行红色英文，例如 `session "…" is already owned by an active write handle`；提示无法关闭，也不会在恢复后自动消失。
- 复现：让 `/api/workflow-studio` 的 POST 请求失败，观察面板提示；对应用例 `node qa/workflow-desktop/run.mjs run W-R-03`。
- 证据：`evidence/workflow-desktop/R-03-offline-recovered.png`
- 当前状态：已修复：错误改为告警条，带警示图标、可读文案、"重试"按钮与"关闭提示"按钮；后端恢复后自行消失。

### D-7　创建、拷贝与归档没有进行中状态，连点会重复触发

- 严重程度：中
- 对应用例：W-R-01、W-R-05
- 用户可见影响：手快或网络慢的用户会得到重复记录，还得自己分辨哪一份是想要的。
- 现象与根因：创建、拷贝、运行和归档都是一次网络往返，按钮在这段时间里保持可点且外观不变。快速双击会发出两次请求，创建会开出两个创作会话，拷贝会生成两份草稿。
- 复现：在创建按钮或卡片操作上连续快速点击五次，观察记录数与按钮状态；对应用例 `node qa/workflow-desktop/run.mjs run W-R-01`、`W-R-05`。
- 证据：`evidence/workflow-desktop/R-01-rapid-create.png`、`R-05-rapid-run.png`
- 当前状态：已修复：创建、拷贝与归档在请求进行中禁用并显示"正在创建…/处理中…"，重入调用直接返回；用例断言连点后不产生重复记录。

### D-8　卡片与列表切换、已归档复选是面板里最小的两个控件

- 严重程度：低
- 对应用例：W-E-06
- 用户可见影响：在触控板和高分辨率屏上更难命中，也让工具栏看起来像两套规格拼在一起。
- 现象与根因：分段切换按钮高 26px、"已归档"复选框本体 13px，而面板里其他控件都在 32px 上下；这两个恰好是使用频率最高的筛选控件。
- 复现：打开总览并测量工具栏控件的实际高度；对应用例 `node qa/workflow-desktop/run.mjs run W-E-06`。
- 证据：`evidence/workflow-desktop/E-06-control-sizes.png`
- 当前状态：已修复：分段按钮升到 32px，"已归档"复选框放大到 16px 并让整段标签成为点击目标；用例按可点击目标测量，面板内不再有低于 28px 的控件。

### D-9　从卡片开始的会话停在"选择工作区"，运行创建的对话也不出现在卡片里

- 严重程度：高
- 对应用例：W-F-02、W-F-04
- 用户可见影响：运行和修改这两条主链路的最后一步落在空页面上：用户以为运行失败，实际上只是会话没有就位；离开对话回到总览后，也无法从卡片回到刚才那次对话。
- 现象与根因：在总览点运行、或在编辑器点"对话修改"时，插件创建一个不带工作区的会话就把它打开，用户看到的是一句"选择一个工作区开始"，必须先自己挑一个工作区才能说话。会话建好之后，卡片上的"对话"计数仍是零：宿主还没有把这个会话列出来，而卡片只显示宿主已经知道的会话，运行产生的对话因此既看不到也点不开。
- 复现：在卡片上点"运行"，观察打开的页面；回到总览展开卡片的"对话"。对应用例 `node qa/workflow-desktop/run.mjs run W-F-02`、`W-F-04`。
- 证据：`evidence/workflow-desktop/F-01-run-bound.png`、`F-02-sessions.png`、`F-05-authoring.png`
- 当前状态：已修复：从卡片开始的会话带上工作区——运行使用工作流自己的工作区，对话修改使用共用的"工作流对话"工作区；轮询在发现状态里有宿主尚未列出的会话时重新拉取会话列表，运行产生的对话因此出现在卡片里。用例在运行会话里发出一条消息，确认它出现在卡片"对话"中并可重新打开，且创作会话带输入区。

## 五、界面证据

以下截图取自本轮真实运行，未做修饰；每张图对应的用例编号标注在图注中。

![入口打开后的总览首屏：A-01-panel-open.png](../evidence/workflow-desktop/A-01-panel-open.png)

*入口打开后的总览首屏（A-01-panel-open）*

![卡片与列表两种样式：A-02-list-view.png](../evidence/workflow-desktop/A-02-list-view.png)

*卡片与列表两种样式（A-02-list-view）*

![多个工作流并存：B-02-second-create.png](../evidence/workflow-desktop/B-02-second-create.png)

*多个工作流并存（B-02-second-create）*

![归档与恢复：C-07-archived.png](../evidence/workflow-desktop/C-07-archived.png)

*归档与恢复（C-07-archived）*

![深色主题下的总览：D-02-dark-gallery.png](../evidence/workflow-desktop/D-02-dark-gallery.png)

*深色主题下的总览（D-02-dark-gallery）*

![窄窗口下的布局：E-03-640.png](../evidence/workflow-desktop/E-03-640.png)

*窄窗口下的布局（E-03-640）*

![运行后进入绑定会话：F-01-run-bound.png](../evidence/workflow-desktop/F-01-run-bound.png)

*运行后进入绑定会话（F-01-run-bound）*

![搜索框异常输入：R-04-search-fuzz.png](../evidence/workflow-desktop/R-04-search-fuzz.png)

*搜索框异常输入（R-04-search-fuzz）*

### 全部运行截图

![W-A-01 侧栏入口打开工作流面板并显示总览（通过）](../evidence/workflow-desktop/A-01-panel-open.png)

*W-A-01 侧栏入口打开工作流面板并显示总览（通过）*

![W-A-02 卡片与列表两种样式切换且偏好保留（通过）](../evidence/workflow-desktop/A-02-list-view.png)

*W-A-02 卡片与列表两种样式切换且偏好保留（通过）*

![W-A-03 空状态：搜索无结果给出解释与清除入口（通过）](../evidence/workflow-desktop/A-03-search-empty.png)

*W-A-03 空状态：搜索无结果给出解释与清除入口（通过）*

![W-A-05 归档视图为空时解释归档含义（通过）](../evidence/workflow-desktop/A-05-archive-empty.png)

*W-A-05 归档视图为空时解释归档含义（通过）*

![W-B-01 创建工作流进入对话并在输入区显示工作流标签（通过）](../evidence/workflow-desktop/B-01-create-conversation.png)

*W-B-01 创建工作流进入对话并在输入区显示工作流标签（通过）*

![W-B-02 从总览创建第二个工作流互不干扰（通过）](../evidence/workflow-desktop/B-02-second-create.png)

*W-B-02 从总览创建第二个工作流互不干扰（通过）*

![W-B-03 拷贝工作流产生未发布草稿且不带走运行记录（通过）](../evidence/workflow-desktop/B-03-copy-result.png)

*W-B-03 拷贝工作流产生未发布草稿且不带走运行记录（通过）*

![W-B-04 连续创建多个工作流后列表完整且名称唯一（通过）](../evidence/workflow-desktop/B-04-many-workflows.png)

*W-B-04 连续创建多个工作流后列表完整且名称唯一（通过）*

![W-B-05 列表样式在多个工作流下逐行对齐操作可用（通过）](../evidence/workflow-desktop/B-05-list-many.png)

*W-B-05 列表样式在多个工作流下逐行对齐操作可用（通过）*

![W-B-06 超长与特殊字符名称不破坏布局（通过）](../evidence/workflow-desktop/B-06-long-name.png)

*W-B-06 超长与特殊字符名称不破坏布局（通过）*

![W-C-01 再次点击入口关闭面板回到对话（通过）](../evidence/workflow-desktop/C-01-panel-closed.png)

*W-C-01 再次点击入口关闭面板回到对话（通过）*

![W-C-02 Escape 关闭面板且不误触其他操作（通过）](../evidence/workflow-desktop/C-02-escape.png)

*W-C-02 Escape 关闭面板且不误触其他操作（通过）*

![W-C-03 隐藏窗口再恢复后面板与数据保持一致（通过）](../evidence/workflow-desktop/C-03-hidden.png)

*W-C-03 隐藏窗口再恢复后面板与数据保持一致（通过）*

![W-C-03 隐藏窗口再恢复后面板与数据保持一致（通过）](../evidence/workflow-desktop/C-03-restored.png)

*W-C-03 隐藏窗口再恢复后面板与数据保持一致（通过）*

![W-C-04 页面刷新后面板与视图偏好恢复（通过）](../evidence/workflow-desktop/C-04-after-reload.png)

*W-C-04 页面刷新后面板与视图偏好恢复（通过）*

![W-C-05 退出并重开应用后面板状态与数据一致（通过）](../evidence/workflow-desktop/C-05-after-restart.png)

*W-C-05 退出并重开应用后面板状态与数据一致（通过）*

![W-C-06 编辑态：切换面板视图后草稿与选中步骤保留（通过）](../evidence/workflow-desktop/C-06-graph-view.png)

*W-C-06 编辑态：切换面板视图后草稿与选中步骤保留（通过）*

![W-C-07 归档后从总览消失、在归档视图可恢复（通过）](../evidence/workflow-desktop/C-07-archived.png)

*W-C-07 归档后从总览消失、在归档视图可恢复（通过）*

![W-D-01 浅色主题下工作流总览可读且文字对比度达标（通过）](../evidence/workflow-desktop/D-01-light-gallery.png)

*W-D-01 浅色主题下工作流总览可读且文字对比度达标（通过）*

![W-D-02 深色主题下工作流总览可读且文字对比度达标（通过）](../evidence/workflow-desktop/D-02-dark-gallery.png)

*W-D-02 深色主题下工作流总览可读且文字对比度达标（通过）*

![W-D-03 面板打开时切换主题不丢状态也不残留旧配色（通过）](../evidence/workflow-desktop/D-03-theme-cycled.png)

*W-D-03 面板打开时切换主题不丢状态也不残留旧配色（通过）*

![W-D-04 深色主题下编辑器步骤列表与设置面板对比度达标（通过）](../evidence/workflow-desktop/D-04-dark-editor.png)

*W-D-04 深色主题下编辑器步骤列表与设置面板对比度达标（通过）*

![W-D-05 系统主题跟随：系统改变时应用同步且无闪烁残留（通过）](../evidence/workflow-desktop/D-05-theme-follow.png)

*W-D-05 系统主题跟随：系统改变时应用同步且无闪烁残留（通过）*

![W-E-01 1280×900 下总览无横向溢出、无控件重叠（通过）](../evidence/workflow-desktop/E-01-1280.png)

*W-E-01 1280×900 下总览无横向溢出、无控件重叠（通过）*

![W-E-02 1024×768 下操作入口仍可达（通过）](../evidence/workflow-desktop/E-02-1024.png)

*W-E-02 1024×768 下操作入口仍可达（通过）*

![W-E-03 窗口收窄到应用下限时侧栏与面板不重叠且主要操作可见（通过）](../evidence/workflow-desktop/E-03-640.png)

*W-E-03 窗口收窄到应用下限时侧栏与面板不重叠且主要操作可见（通过）*

![W-E-04 请求极窄宽度时窗口停在下限且无横向滚动（通过）](../evidence/workflow-desktop/E-04-narrow.png)

*W-E-04 请求极窄宽度时窗口停在下限且无横向滚动（通过）*

![W-E-05 编辑器在两栏布局下资源面板与步骤列表不重叠（通过）](../evidence/workflow-desktop/E-05-editor-1280.png)

*W-E-05 编辑器在两栏布局下资源面板与步骤列表不重叠（通过）*

![W-E-06 关键控件触达尺寸不低于 32px 且图标按钮有可访问名称（通过）](../evidence/workflow-desktop/E-06-control-sizes.png)

*W-E-06 关键控件触达尺寸不低于 32px 且图标按钮有可访问名称（通过）*

![W-F-01 从卡片运行工作流进入绑定会话（通过）](../evidence/workflow-desktop/F-01-run-bound.png)

*W-F-01 从卡片运行工作流进入绑定会话（通过）*

![W-F-02 运行会话在工作流对话列表中可重新打开（通过）](../evidence/workflow-desktop/F-02-sessions.png)

*W-F-02 运行会话在工作流对话列表中可重新打开（通过）*

![W-F-02 运行会话在工作流对话列表中可重新打开（通过）](../evidence/workflow-desktop/F-03-conversation-open.png)

*W-F-02 运行会话在工作流对话列表中可重新打开（通过）*

![W-F-03 编辑器修改任务说明后未保存提示与保存生效（通过）](../evidence/workflow-desktop/F-04-dirty-editor.png)

*W-F-03 编辑器修改任务说明后未保存提示与保存生效（通过）*

![W-F-03 编辑器修改任务说明后未保存提示与保存生效（通过）](../evidence/workflow-desktop/F-03-saved-editor.png)

*W-F-03 编辑器修改任务说明后未保存提示与保存生效（通过）*

![W-F-04 对话修改入口打开创作会话并标注工作流（通过）](../evidence/workflow-desktop/F-05-authoring.png)

*W-F-04 对话修改入口打开创作会话并标注工作流（通过）*

![W-R-01 狂点创建入口不会重复创建或卡死（通过）](../evidence/workflow-desktop/R-01-rapid-create.png)

*W-R-01 狂点创建入口不会重复创建或卡死（通过）*

![W-R-02 创建过程中关闭面板不产生半成品或报错（通过）](../evidence/workflow-desktop/R-02-interrupt-create.png)

*W-R-02 创建过程中关闭面板不产生半成品或报错（通过）*

![W-R-03 后端不可用时报错可读且清空输入可恢复（通过）](../evidence/workflow-desktop/R-03-offline-recovered.png)

*W-R-03 后端不可用时报错可读且清空输入可恢复（通过）*

![W-R-04 搜索框输入正则与超长文本不崩溃（通过）](../evidence/workflow-desktop/R-04-search-fuzz.png)

*W-R-04 搜索框输入正则与超长文本不崩溃（通过）*

![W-R-05 重复点击卡片动作不会重复执行（通过）](../evidence/workflow-desktop/R-05-rapid-run.png)

*W-R-05 重复点击卡片动作不会重复执行（通过）*

![W-R-06 窗口在面板打开时连续缩放不残留布局错误（通过）](../evidence/workflow-desktop/R-06-resize-cycle.png)

*W-R-06 窗口在面板打开时连续缩放不残留布局错误（通过）*

![W-R-07 面板打开时退出应用不产生未捕获错误（通过）](../evidence/workflow-desktop/R-07-reopen.png)

*W-R-07 面板打开时退出应用不产生未捕获错误（通过）*

![W-R-08 打开不存在的运行记录不破坏面板（通过）](../evidence/workflow-desktop/R-08-bad-run.png)

*W-R-08 打开不存在的运行记录不破坏面板（通过）*

![W-R-09 损坏的工作流定义不阻塞总览加载（通过）](../evidence/workflow-desktop/R-09-degenerate.png)

*W-R-09 损坏的工作流定义不阻塞总览加载（通过）*

![W-R-10 后台标签页期间面板不高频轮询（可见性节流）（通过）](../evidence/workflow-desktop/R-10-visibility.png)

*W-R-10 后台标签页期间面板不高频轮询（可见性节流）（通过）*

## 六、隐私检查

仓库内容扫描由 `node qa/workflow-desktop/privacy-audit.mjs` 完成，规则覆盖家目录绝对路径、个人标识、模型密钥、Bearer 令牌、私有网段地址、邮箱、会话标识、SSH 别名与凭据字面量；命中内容在结果文件里统一脱敏，报告不复制原文。

| 仓库 | 已跟踪文件 | 未跟踪文件 | 提交历史 |
| --- | --- | --- | --- |
| `../repositories/dsh-better-reasoning-effort` | 64 | 0 | 158 |
| `../repositories/dsh-desktop-suite` | 13 | 0 | 3 |
| `../repositories/dsh-desktop-workbench` | 12 | 0 | 3 |
| `../repositories/dsh-plugin-browser` | 22 | 0 | 13 |
| `../repositories/dsh-plugin-latex` | 92 | 0 | 16 |
| `../repositories/dsh-plugin-project-memory` | 18 | 0 | 11 |
| `../repositories/dsh-plugin-sessions` | 15 | 0 | 3 |
| `../repositories/dsh-plugin-sidebar` | 18 | 0 | 4 |
| `../repositories/dsh-plugin-ssh` | 37 | 0 | 5 |
| `../repositories/dsh-plugin-suite` | 14 | 0 | 1 |
| `../repositories/dsh-plugin-terminal` | 24 | 0 | 10 |
| `../repositories/dsh-plugin-workbench` | 16 | 0 | 4 |
| `../repositories/dsh-plugin-workflow` | 99 | 0 | 21 |
| `dsh-desktop-bundle` | 436 | 31 | 34 |

规则命中合计 466 处，按规则分布：private-ip 32、email 27、history:private-ip 52、history:email 28、personal-name 156、history:personal-name 160、credential-file 4、history:credential-file 2、ssh-alias 2、history:ssh-alias 1、home-path 1、history:home-path 1。

- 个人标识命中 316 处，全部位于仓库地址、提交者身份与 README 的仓库链接，属于公开发布所需的署名信息。
- 凭据类命中 6 处，逐条核对后均为测试夹具中的占位字符串（例如 `must-not-persist`），不含可用凭据。
- 本机绝对路径命中 2 处，范围见 `evidence/workflow-desktop/privacy.json`。

隔离现场 `.qa/` 不在任何仓库内，其中的 fixture 凭据文件属于本机运行环境，不随仓库分发。

## 七、本次未覆盖与限制

- 最小化与恢复由窗口服务器处理，自动化通道无法触发该按钮：`W-C-03` 验证窗口隐藏期间的可见性切换与恢复后的一致性，
  真实最小化仍需要人工点一次标题栏按钮核对。
- 应用自身把窗口宽度限制在 900px 以上，窄窗口结论针对的是这个下限，更窄的布局需要缩小系统分辨率才能到达。
- 对比度按 WCAG 2.1 的 4.5:1（正文）与 3:1（大字）判定；这条规则不衡量层级感、留白与品牌感，
  视觉结论只代表可读性下限。
- 屏幕阅读器、输入法组合输入与触控板手势没有自动化覆盖。
- 截图与记录里的工作流名称带有本轮时间戳前缀，属于合成数据；报告中的本机路径统一写作 `/Users/<user>`。

