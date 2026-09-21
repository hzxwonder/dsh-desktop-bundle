// Narrative sections of the Desktop workflow acceptance report.
//
// Kept apart from report.mjs so the measured tables stay generated and the
// judgement stays reviewable: a reader can diff the wording without the numbers
// moving, and the numbers can move without the wording drifting.

export const METHOD = `
被测对象是在隔离的 fixture home 中运行的 DSH Desktop 打包版：插件从分发仓库的 \`vendor/dsh-plugin-workflow\`
安装，模型请求指向本机 mock 服务，因此用例不消耗真实额度，也不产生真实内容。工作区、会话与工作流数据库都在
\`.qa/\` 之下，与日常使用环境完全分离。

驱动方式是通过 Chrome DevTools Protocol 连接真实窗口：断言读取真实 DOM 的文本、位置与样式，点击通过坐标派发，
窗口尺寸通过渲染进程的 \`resizeTo\` 改变并读回实际尺寸确认生效。每个用例开始前把 fixture 恢复到一个种子工作流，
因此上一轮的残留不会让断言以错误的理由通过。对比度取自渲染后的颜色与字号，按 WCAG 相对亮度公式计算。

覆盖的用户行为：打开与关闭面板、连续创建多个工作流、拷贝、归档与恢复、搜索与清空、卡片与列表切换、浅色与深色主题、
系统主题跟随、窗口从 1280px 缩放到应用允许的最小宽度、刷新页面、退出并重启应用。
反常行为：狂点创建与运行、创建过程中关闭面板、搜索框输入正则元字符与超长文本、打开不存在的运行记录、
写入结构不完整的工作流定义、后端不可用、页面隐藏时的轮询、超长名称与描述、名称里带脚本片段。
`

export const LIMITATIONS = `
- 最小化与恢复由窗口服务器处理，自动化通道无法触发该按钮：\`W-C-03\` 验证窗口隐藏期间的可见性切换与恢复后的一致性，
  真实最小化仍需要人工点一次标题栏按钮核对。
- 应用自身把窗口宽度限制在 900px 以上，窄窗口结论针对的是这个下限，更窄的布局需要缩小系统分辨率才能到达。
- 对比度按 WCAG 2.1 的 4.5:1（正文）与 3:1（大字）判定；这条规则不衡量层级感、留白与品牌感，
  视觉结论只代表可读性下限。
- 屏幕阅读器、输入法组合输入与触控板手势没有自动化覆盖。
- 截图与记录里的工作流名称带有本轮时间戳前缀，属于合成数据；报告中的本机路径统一写作 \`/Users/<user>\`。
`

export const FINDINGS = [
  {
    id: 'D-1',
    title: '超长名称与描述会撑破卡片，并把整列网格挤变形',
    severity: '高',
    cases: ['W-B-06'],
    symptom: '名称与描述没有长度上限。名称整段换行占到五行以上，描述按原文长度铺开，单张卡片高度可达视口的大半；'
      + '同一行里其余卡片被拉成同样高度，一屏只能看到两三条记录。',
    impact: '用户粘贴一个长标题之后，总览从"扫一眼挑一个"退化成需要滚动阅读的长文，卡片上的操作按钮被推到屏幕之外。',
    repro: '保存一个名称含六段"很长的中国語名称段落"、描述重复 120 次并带 `<script>` 片段的工作流，在卡片样式下观察；'
      + '对应用例 `node qa/workflow-desktop/run.mjs run W-B-06`。',
    evidence: '`evidence/workflow-desktop/B-06-long-name.png`',
    status: '已修复：标题收成一行、描述两行、列表行一行，超出部分省略；完整文本保留在元素的 `title` 属性里，悬停可读。'
      + '用例断言三种截断生效、卡片高度不超过同屏最短卡片的两倍，且完整文本仍可读取。',
  },
  {
    id: 'D-2',
    title: '卡片宽度由容器决定，宽窗口下被拉长，右侧还留下一列空白',
    severity: '中',
    cases: ['W-B-05', 'W-E-01'],
    symptom: '网格用 `1fr` 作为轨道上限时，面板越宽卡片越宽，同一个面板里出现 460px 的卡片；'
      + '改成固定上限后，`auto-fill` 又按上限计算列数，936px 的一行只放两张 336px 卡片，右边空出 250px。',
    impact: '两种情况都影响阅读：前者让四个操作按钮摊成四条宽条，后者让总览右侧出现一块明显的空档。',
    repro: '在 1280×900 与更宽的窗口下打开总览，测量卡片宽度与容器宽度的差值；'
      + '对应用例 `node qa/workflow-desktop/run.mjs run W-E-01`。',
    evidence: '`evidence/workflow-desktop/E-01-1280.png`、`B-05-list-many.png`',
    status: '已修复：轨道上限改为弹性、下限 292px，宽窗口增加列数而不是拉宽卡片；'
      + '936px 一行三列填满，卡片约 303px。用例断言网格列宽之和加上间距不超过容器宽度一个间距，且卡片操作保持在单行。',
  },
  {
    id: 'D-3',
    title: '深色主题下"已发布"状态标签对比度只有 2.93:1',
    severity: '中',
    cases: ['W-D-02'],
    symptom: '已发布与有未保存修改的标签使用写死的绿色和琥珀色。浅色主题下可读，深色主题下前景色 `#1d7d52` 落在'
      + '`#25272b` 的半透明底色上，实测 2.93:1，低于正文所需的 4.5:1；字号只有 11px，属于最小的一档文字。',
    impact: '在深色主题下，最难看清的恰好是判断"这份工作流能不能直接运行"的状态标记。',
    repro: '系统切到深色后打开总览，对已发布的工作流取色计算；'
      + '对应用例 `node qa/workflow-desktop/run.mjs run W-D-02`。',
    evidence: '`evidence/workflow-desktop/D-02-dark-gallery.png`、`evidence/workflow-desktop/results.json` 中 W-D-02 的实测比值',
    status: '已修复：标签颜色改读宿主的 `--dsw-alias-state-success-*` 与 `--dsw-alias-state-warn-*` 语义令牌，随主题变化；'
      + '深色主题复测全部采样不低于 4.5:1。',
  },
  {
    id: 'D-4',
    title: '面板关闭后仍每两秒请求一次后端，重启后又不会自己回来',
    severity: '中',
    cases: ['W-R-10', 'W-C-04', 'W-C-05'],
    symptom: '轮询只判断页面可见性、不判断面板是否打开，面板关掉之后渲染进程依旧每两秒请求一次 `/api/workflow-studio`；'
      + '反过来，面板状态没有被记住，刷新或重启窗口后总是回到关闭的工作流界面。',
    impact: '关掉面板的用户持续承担后台请求；每次重启都要重新找到入口打开面板，工作流不是"上次离开的样子"。',
    repro: '打开面板后关闭，用 `window.fetch` 计数观察请求；再打开面板并重启应用，观察面板是否自动出现。'
      + '对应用例 `node qa/workflow-desktop/run.mjs run W-R-10`、`W-C-04`、`W-C-05`。',
    evidence: '`evidence/workflow-desktop/R-10-visibility.png`、`C-04-after-reload.png`、`C-05-after-restart.png`',
    status: '已修复：开关状态写入 localStorage，轮询在面板关闭或页面隐藏时停转；插件启动时按记录向宿主申请面板。'
      + '实测窗口隐藏 6 秒内请求 0 次、恢复后 4 次；刷新与重启后面板自动回到总览。',
  },
  {
    id: 'D-5',
    title: '归档不可撤销、搜索没有清除入口、计数不区分筛选与总数',
    severity: '中',
    cases: ['W-A-03', 'W-A-05', 'W-C-07', 'W-C-08'],
    symptom: '归档用垃圾桶图标、点完没有任何反馈，记录直接从列表消失，只能自己去"已归档"里找；搜索框没有清除按钮；'
      + '无结果时不解释是"没有匹配"还是"还没有工作流"；计数只报筛选后的条数，看不出被过滤掉多少。',
    impact: '归档看起来像删除，用户不敢用；搜索无结果时不知道该改关键词还是该去创建工作流。',
    repro: '归档任意工作流后观察列表与提示；在搜索框输入不存在的关键词，观察空状态与计数。'
      + '对应用例 `node qa/workflow-desktop/run.mjs run W-A-03`、`W-A-05`、`W-C-07`。',
    evidence: '`evidence/workflow-desktop/A-03-search-empty.png`、`A-05-archive-empty.png`、`C-07-archive-restored.png`',
    status: '已修复：归档改用归档图标并给出带名称的提示条，提示条自带"撤销"；搜索框常驻清除按钮；计数写作"匹配 N / M 个"；'
      + '三种空状态分别说明原因并给出离开该状态的入口。',
  },
  {
    id: 'D-6',
    title: '后端错误直接以英文原文展示，且无法关闭或重试',
    severity: '中',
    cases: ['W-R-03'],
    symptom: '接口失败时面板里出现一行红色英文，例如 `session "…" is already owned by an active write handle`；'
      + '提示无法关闭，也不会在恢复后自动消失。',
    impact: '用户看到的是内部术语，拿不到"重试"或"先关掉"的动作；一次瞬时故障会长期占据界面。',
    repro: '让 `/api/workflow-studio` 的 POST 请求失败，观察面板提示；'
      + '对应用例 `node qa/workflow-desktop/run.mjs run W-R-03`。',
    evidence: '`evidence/workflow-desktop/R-03-offline-recovered.png`',
    status: '已修复：错误改为告警条，带警示图标、可读文案、"重试"按钮与"关闭提示"按钮；后端恢复后自行消失。',
  },
  {
    id: 'D-7',
    title: '创建、拷贝与归档没有进行中状态，连点会重复触发',
    severity: '中',
    cases: ['W-R-01', 'W-R-05'],
    symptom: '创建、拷贝、运行和归档都是一次网络往返，按钮在这段时间里保持可点且外观不变。快速双击会发出两次请求，'
      + '创建会开出两个创作会话，拷贝会生成两份草稿。',
    impact: '手快或网络慢的用户会得到重复记录，还得自己分辨哪一份是想要的。',
    repro: '在创建按钮或卡片操作上连续快速点击五次，观察记录数与按钮状态；'
      + '对应用例 `node qa/workflow-desktop/run.mjs run W-R-01`、`W-R-05`。',
    evidence: '`evidence/workflow-desktop/R-01-rapid-create.png`、`R-05-rapid-run.png`',
    status: '已修复：创建、拷贝与归档在请求进行中禁用并显示"正在创建…/处理中…"，重入调用直接返回；'
      + '用例断言连点后不产生重复记录。',
  },
  {
    id: 'D-8',
    title: '卡片与列表切换、已归档复选是面板里最小的两个控件',
    severity: '低',
    cases: ['W-E-06'],
    symptom: '分段切换按钮高 26px、"已归档"复选框本体 13px，而面板里其他控件都在 32px 上下；'
      + '这两个恰好是使用频率最高的筛选控件。',
    impact: '在触控板和高分辨率屏上更难命中，也让工具栏看起来像两套规格拼在一起。',
    repro: '打开总览并测量工具栏控件的实际高度；对应用例 `node qa/workflow-desktop/run.mjs run W-E-06`。',
    evidence: '`evidence/workflow-desktop/E-06-control-sizes.png`',
    status: '已修复：分段按钮升到 32px，"已归档"复选框放大到 16px 并让整段标签成为点击目标；'
      + '用例按可点击目标测量，面板内不再有低于 28px 的控件。',
  },
  {
    id: 'D-9',
    title: '从卡片开始的会话停在"选择工作区"，运行创建的对话也不出现在卡片里',
    severity: '高',
    cases: ['W-F-02', 'W-F-04'],
    symptom: '在总览点运行、或在编辑器点"对话修改"时，插件创建一个不带工作区的会话就把它打开，用户看到的是一句'
      + '"选择一个工作区开始"，必须先自己挑一个工作区才能说话。会话建好之后，卡片上的"对话"计数仍是零：'
      + '宿主还没有把这个会话列出来，而卡片只显示宿主已经知道的会话，运行产生的对话因此既看不到也点不开。',
    impact: '运行和修改这两条主链路的最后一步落在空页面上：用户以为运行失败，实际上只是会话没有就位；'
      + '离开对话回到总览后，也无法从卡片回到刚才那次对话。',
    repro: '在卡片上点"运行"，观察打开的页面；回到总览展开卡片的"对话"。'
      + '对应用例 `node qa/workflow-desktop/run.mjs run W-F-02`、`W-F-04`。',
    evidence: '`evidence/workflow-desktop/F-01-run-bound.png`、`F-02-sessions.png`、`F-05-authoring.png`',
    status: '已修复：从卡片开始的会话带上工作区——运行使用工作流自己的工作区，对话修改使用共用的"工作流对话"工作区；'
      + '轮询在发现状态里有宿主尚未列出的会话时重新拉取会话列表，运行产生的对话因此出现在卡片里。'
      + '用例在运行会话里发出一条消息，确认它出现在卡片"对话"中并可重新打开，且创作会话带输入区。',
  },
]
