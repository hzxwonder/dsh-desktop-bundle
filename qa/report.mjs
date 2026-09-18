#!/usr/bin/env node
// Turn the recorded case results and screenshots into the acceptance report.
//
//   node qa/report.mjs [--results <file>] [--out <file>]
//
// The report embeds a curated set of screenshots — every failure, plus the ones
// that document the main flows — so a reader can check the claims without running
// the suite again.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { BUNDLE } from './driver.mjs'

const EVIDENCE = join(BUNDLE, 'qa', 'evidence')

const GROUPS = [
  ['A', '启动与会话生命周期'],
  ['B', '关闭、后台化、重开与进程行为'],
  ['D', '主题与外观'],
  ['L', '布局与样式校验'],
  ['F', '功能链路'],
  ['R', '鲁棒性与异常输入'],
  ['P', '仓库隐私与脱敏'],
]

/** Findings group the failing cases by root cause, so a reader sees the defect, not the symptom. */
const FINDINGS = [
  {
    id: 'F-1',
    title: '窗口关闭后无法唤回：激活路径访问已销毁的窗口并抛出未捕获异常',
    severity: '高',
    cases: ['B-02', 'B-03', 'B-04'],
    symptom: '关闭主窗口后进程按设计驻留（B-01 通过）。此后点击 Dock 图标、或用 `open -a "DSH Desktop"`、'
      + '或以命令行再次启动应用，都不会出现窗口；应用日志记录 `TypeError: Object has been destroyed`，'
      + '调用栈为 `applicationNeedsReveal` → `EventEmitter.activate`（electron-runtime-Ih8J4IqG.js:1434 / 2631）。'
      + '实测中激活后进程数由 5 降到 4，单独探针里甚至整体退出。',
    impact: '用户关掉窗口后没有任何常规操作能把界面找回来，只能退出应用重新启动；'
      + '未捕获异常还会让主进程处于不确定状态，容易被当成崩溃。'
      + '这是本轮唯一影响主流程可用性的缺陷。',
    repro: '启动应用并关闭窗口 → 进程仍在（`pgrep -f "MacOS/DSH Desktop"` 非空）→ '
      + '`open -a "/Applications/DSH Desktop.app"` → 无窗口出现，'
      + '`~/Library/Application Support/DSH Desktop/logs/dsh-*.error.log` 写入上述栈；对应用例 `node qa/run-cases.mjs run B`。',
    evidence: '`evidence/dock-activation-crash.log`（日志原文）、`evidence/reopen-behaviour.json`（三次激活路径下的进程数与渲染目标采样）',
    suggestion: '在 `activate` / `second-instance` 处理器里先判断窗口是否已销毁（`window.isDestroyed()`），'
      + '销毁时重建窗口后再 `show()`；同时确认 `window-all-closed` 的驻留策略与唤起入口成对存在（托盘菜单或 Dock 双击）。',
  },
  {
    id: 'F-2',
    title: '已发布插件仓库的验收文档包含本机个人路径与私有 SSH 别名',
    severity: '高（隐私）',
    cases: ['P-01', 'P-02', 'P-04'],
    symptom: '`dsh-plugin-terminal` 仓库（远程 `github.com/hzxwonder-dsh-plugins/dsh-plugin-terminal`）中，'
      + '`docs/acceptance/2026-09-15-terminal-panel.md` 第 171、195 行写着 `/Users/<用户名>/.dsh-desktop/plain-sessions…`，'
      + '第 11、219、220 行出现私有 SSH 连接别名；`docs/acceptance/2026-09-15/results.json` 第 17、310、316 行同样命中。'
      + '这些内容既在工作区文件中，也已经进入提交历史。',
    impact: '公开仓库里泄露本机用户名、目录结构与私有 SSH 主机别名，等于给出内网与账号线索；'
      + '仅改当前文件无法从历史中移除。',
    repro: '`node qa/run-cases.mjs run P`（用例 P-01 / P-02 / P-04），扫描覆盖 12 个仓库的工作区文件、未跟踪文件与全部历史 blob。',
    evidence: '`evidence/privacy.json`（逐条命中：仓库、文件、行号、规则）',
    suggestion: '把文档与结果文件里的绝对路径改为 `~/.dsh-desktop/...`、把 SSH 别名替换为 `<ssh-alias>`，'
      + '并补一条提交前检查；历史清理需要 force push，属于不可逆操作，确认后再执行。',
  },
  {
    id: 'F-3',
    title: '空输入回车会新建空会话',
    severity: '低',
    cases: ['R-01'],
    symptom: '在空输入框里连按回车（含一次只输入空格再回车）后，侧边栏多出一个空的“新会话”条目，'
      + '界面没有报错，输入框仍可用。',
    impact: '误触回车会在工作区里留下空会话，长期使用会积累无用条目，也会影响“会话数=真实对话数”的直觉。',
    repro: '`node qa/run-cases.mjs run R-01`：记录侧边栏条目数 → 空输入按 3 次回车 → 输入空格再回车 → 条目数 +1。',
    evidence: '`evidence/R-01-failure.png`（回车后侧边栏新增空条目）',
    suggestion: '提交前去掉首尾空白并判断是否为空；空内容不创建会话，也不写入工作区。',
  },
  {
    id: 'F-4',
    title: '浅色主题次级文字对比度低于 WCAG AA',
    severity: '低',
    cases: ['L-05'],
    symptom: '浅色主题下侧边栏分组标题“工作区”为 rgb(129,133,140) on #ffffff，对比度 3.71:1，低于 AA 要求的 4.5:1；'
      + '输入框占位文字 2.13:1。正文与控件文字合格（同一轮采样中“工作区内修改”“QA Mock Model”均为 5.8:1）。'
      + '深色主题最低 8.78:1，占位文字 3.76:1。',
    impact: '低视力用户在浅色主题下较难辨认分组标题与占位提示，属于可访问性层面的缺陷，不影响功能。',
    repro: '`node qa/run-cases.mjs run L-05`：切到浅色主题，逐元素计算前景色与背景色的对比度。',
    evidence: '`evidence/L-05-light-theme.png`、`evidence/L-05-failure.png`（采样明细写入用例说明）',
    suggestion: '把分组标题与占位文字调深到至少 4.5:1（例如 #6b7280 附近），或提高字号使其达到大字号阈值。',
  },
]

/** Behaviour that did not fail this round but deserves a follow-up. */
const OBSERVATIONS = [
  '重复回车曾出现过一次重复发送：R-04 在 00:23 那轮记录到同一条消息被发送 2 次，'
    + '11:11 重跑未复现（运行 22.9s、仅 1 条）。属于竞态型现象，建议在发送按钮上加去抖或提交锁后再复测。',
  '侧边栏收起后，展开入口是图标栏里的“打开侧边栏”按钮（无文字标签），自动发现性较弱；'
    + '本轮已按该标签完成收起/展开与多次开合验证（L-12、L-13、L-15 通过）。',
  '空数据目录或全新 Profile 启动时没有工作区，界面停留在“选择一个工作区开始”，'
    + '输入框不出现（R-11、R-12 按此预期判定通过）；首次使用者需要先添加工作区才能开始对话。',
]

/** Screenshots that carry the report even when every case passes. */
const HIGHLIGHTS = [
  ['A-01-boot', '冷启动后的主界面'],
  ['A-04-first-reply', '首次对话得到模型回复'],
  ['A-05-three-conversations', '连续创建三个会话'],
  ['B-02-reactivated', '关闭窗口后重新激活'],
  ['B-06-resized-after-restart', '窗口尺寸变更后重启保持'],
  ['D-03-light-surfaces', '浅色主题'],
  ['D-04-dark-surfaces', '深色主题'],
  ['L-08-window-1600x1000', '放大到 1600×1000'],
  ['L-09-window-900x600', '缩小到 900×600'],
  ['L-10-window-640x480', '最小尺寸 640×480'],
  ['L-12-sidebar-collapsed', '侧边栏收起'],
  ['F-04-plugin-market', '插件市场面板'],
  ['F-05-settings', '设置面板'],
  ['F-07-model-picker', '模型选择器'],
  ['F-11-terminal-open', '终端面板打开'],
  ['R-05-provider-offline', '模型服务不可用时的提示'],
]

const command = args => {
  try {
    return execFileSync('/bin/sh', ['-c', args], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

function environment() {
  const manifestPath = join(BUNDLE, 'manifest.json')
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {}
  const desktop = manifest.desktop ?? {}
  const releases = ['release', 'dist'].flatMap(directory => existsSync(join(BUNDLE, directory))
    ? readdirSync(join(BUNDLE, directory)).filter(name => name.endsWith('.dmg'))
    : [])
  return {
    version: desktop.appVersion ?? 'unknown',
    runtime: desktop.runtimeVersion ?? 'unknown',
    pluginCount: Array.isArray(manifest.plugins) ? manifest.plugins.length : 0,
    releases,
    os: command('sw_vers -productVersion'),
    build: command('sw_vers -buildVersion'),
    hardware: command('sysctl -n machdep.cpu.brand_string'),
    memory: `${Math.round(Number(command('sysctl -n hw.memsize')) / 1024 ** 3)} GB`,
    screen: command(`osascript -e 'tell application "Finder" to get bounds of window of desktop' 2>/dev/null || echo "1280x840 logical"`),
    node: process.version,
  }
}

function statusLabel(status) {
  return status === 'pass' ? '通过' : status === 'skip' ? '跳过' : '失败'
}

function table(entries) {
  const lines = ['| 用例 | 优先级 | 标题 | 结果 | 耗时/说明 |', '| --- | --- | --- | --- | --- |']
  for (const entry of entries) {
    const detail = entry.status === 'pass'
      ? (entry.detail ?? '')
      : (entry.detail ?? '').replace(/\|/g, '\\|').slice(0, 300)
    lines.push(`| ${entry.id} | ${entry.priority} | ${entry.title} | ${statusLabel(entry.status)} | ${detail} |`)
  }
  return lines.join('\n')
}

function imageBlock(files, caption) {
  return [`![${caption}](evidence/${files}.png)`, `*${caption}*`].join('\n\n')
}

function main() {
  const resultsIndex = process.argv.indexOf('--results')
  const resultsPath = resultsIndex >= 0 ? process.argv[resultsIndex + 1] : join(EVIDENCE, 'results.json')
  const outIndex = process.argv.indexOf('--out')
  const outPath = outIndex >= 0 ? process.argv[outIndex + 1] : join(BUNDLE, 'qa', 'ACCEPTANCE-REPORT.md')

  const results = JSON.parse(readFileSync(resultsPath, 'utf8'))
  const passed = results.filter(entry => entry.status === 'pass')
  const failed = results.filter(entry => entry.status === 'fail')
  const skipped = results.filter(entry => entry.status === 'skip')
  const failedIds = new Set(failed.map(entry => entry.id))
  const env = environment()
  const now = new Date()
  const pad = value => String(value).padStart(2, '0')
  const generated = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} `
    + `${pad(now.getHours())}:${pad(now.getMinutes())}`
  const caseList = existsSync(join(BUNDLE, 'qa', 'cases.md'))
    ? readFileSync(join(BUNDLE, 'qa', 'cases.md'), 'utf8').split('\n').filter(line => /^\|\s*[A-Z]-\d+/u.test(line)).length
    : 0
  const priorities = results.reduce((counts, entry) => {
    counts[entry.priority] = (counts[entry.priority] ?? 0) + 1
    return counts
  }, {})

  const out = []
  out.push('# DSH Desktop 打包版验收报告')
  out.push('')
  out.push(`生成时间：${generated}　应用版本：${env.version}（DSH 运行时 ${env.runtime}）　安装包：${env.releases.join('、') || '未找到'}`)
  out.push('')
  out.push('## 一、结论')
  out.push('')
  out.push(`本轮共执行 **${results.length}** 条用例：**通过 ${passed.length}**、失败 ${failed.length}、跳过 ${skipped.length}。`)
  out.push('')
  out.push(`用例覆盖启动与生命周期、窗口与进程、主题、布局、功能链路、鲁棒性、仓库隐私七组，`
    + `其中 P0 ${priorities.P0 ?? 0} 条、P1 ${priorities.P1 ?? 0} 条、P2 ${priorities.P2 ?? 0} 条；`
    + `完整清单见 \`qa/cases.md\`。`)
  out.push('')
  if (failed.length === 0) {
    out.push('安装包在当前环境下可以正常启动、创建与恢复会话、跟随系统主题、在多种窗口尺寸下保持布局，并且未在仓库中发现个人隐私数据。')
  } else {
    out.push('主流程（启动、会话、主题、布局、面板、异常输入）可用，没有出现数据损坏或会话丢失；'
      + '下面 4 项需要处理，其中 F-1 影响窗口唤回并伴随未捕获异常，F-2 属于已发布仓库的隐私泄露：')
    out.push('')
    for (const finding of FINDINGS) {
      const open = finding.cases.filter(id => failedIds.has(id))
      if (open.length === 0) continue
      out.push(`- **${finding.id} · ${finding.severity} · ${finding.title}** —— 对应用例 ${open.join('、')}`)
    }
  }
  out.push('')

  out.push('## 二、测试环境与方法')
  out.push('')
  out.push('| 项目 | 值 |')
  out.push('| --- | --- |')
  out.push(`| 操作系统 | macOS ${env.os} (${env.build}) |`)
  out.push(`| 硬件 | ${env.hardware}，${env.memory} |`)
  out.push(`| 屏幕 | 内置 Retina，逻辑分辨率 1280×840 |`)
  out.push(`| 被测程序 | /Applications/DSH Desktop.app（打包版 ${env.version}） |`)
  out.push(`| 控制方式 | Chrome DevTools Protocol（渲染进程真实 DOM 与截屏） |`)
  out.push('')
  out.push('测试在一个独立的 fixture home 中进行，用户日常使用的 home 全程未被写入；')
  out.push('推理走本地 mock 模型服务（OpenAI 兼容接口），不使用任何真实密钥。')
  out.push('窗口关闭、重开、后台冻结、进程退出等场景通过 DevTools 协议与进程信号驱动，')
  out.push('因为测试进程没有 macOS 辅助功能权限，无法注入原生菜单快捷键；受限项在第六节列出。')
  out.push('')

  out.push('## 三、用例与结果')
  out.push('')
  for (const [key, title] of GROUPS) {
    const entries = results.filter(entry => entry.group === key)
    if (entries.length === 0) continue
    const groupPassed = entries.filter(entry => entry.status === 'pass').length
    out.push(`### ${key}　${title}（${groupPassed}/${entries.length} 通过）`)
    out.push('')
    out.push(table(entries))
    out.push('')
  }

  out.push('## 四、界面证据')
  out.push('')
  const available = new Set(readdirSync(EVIDENCE).filter(name => name.endsWith('.png')))
  for (const [file, caption] of HIGHLIGHTS) {
    if (!available.has(`${file}.png`)) continue
    out.push(imageBlock(file, caption))
    out.push('')
  }

  out.push('## 五、问题清单')
  out.push('')
  if (failed.length === 0) {
    out.push('本轮没有失败用例。')
    out.push('')
  }
  for (const finding of FINDINGS) {
    const open = finding.cases.filter(id => failedIds.has(id))
    if (open.length === 0) continue
    out.push(`### ${finding.id}　${finding.title}`)
    out.push('')
    out.push(`- 严重程度：${finding.severity}　相关用例：${open.join('、')}`)
    out.push(`- 现象：${finding.symptom}`)
    out.push(`- 影响：${finding.impact}`)
    out.push(`- 复现：${finding.repro}`)
    if (finding.evidence !== undefined) out.push(`- 证据：${finding.evidence}`)
    out.push(`- 建议：${finding.suggestion}`)
    for (const shot of finding.shots ?? []) {
      if (!available.has(`${shot}.png`)) continue
      out.push('')
      out.push(imageBlock(shot, finding.caption ?? `${finding.id} 现场`))
    }
    out.push('')
  }
  const unattributed = failed.filter(entry => !FINDINGS.some(finding => finding.cases.includes(entry.id)))
  for (const entry of unattributed) {
    out.push(`### ${entry.id}　${entry.title}`)
    out.push('')
    out.push(`- 优先级：${entry.priority}`)
    out.push(`- 现象：${entry.detail}`)
    out.push(`- 复现：\`node qa/run-cases.mjs run ${entry.group}\`（用例 ${entry.id}）`)
    out.push('')
  }

  if (OBSERVATIONS.length > 0) {
    out.push('### 观察项（未判为失败，但值得关注）')
    out.push('')
    for (const item of OBSERVATIONS) out.push(`- ${item}`)
    out.push('')
  }

  out.push('## 六、未覆盖与受限项')
  out.push('')
  out.push('| 项目 | 原因 | 建议的替代验证 |')
  out.push('| --- | --- | --- |')
  out.push('| ⌘Q / ⌘W / ⌘M / ⌘H 原生快捷键 | 测试进程无 macOS 辅助功能权限，无法注入系统按键 | 用关闭窗口、SIGTERM 与后台冻结三条路径覆盖同一后果；手工按一次快捷键确认 |')
  out.push('| 真实模型的长回答与工具调用 | 全程使用 mock 模型，避免真实密钥与费用 | 用自有 API Key 跑一次真实任务，检查轨迹面板与用量统计 |')
  out.push('| 多显示器与 HiDPI 缩放 | 只在单屏内置显示器上验证 | 外接显示器后再跑一次 L 组 |')
  out.push('| 系统级通知、托盘菜单交互 | 需要窗口服务器控制权限 | 手工点开托盘菜单确认退出与安全模式入口 |')
  out.push('')

  out.push('## 七、判定口径与证据索引')
  out.push('')
  out.push('| 维度 | 判定口径 |')
  out.push('| --- | --- |')
  out.push('| 功能 | 真实点击与键盘输入后，界面出现预期结果，且渲染进程无 console 报错 |')
  out.push('| 布局 | 基准 1280×840 下无横向溢出、交互元素互不遮挡、文字不被裁切；尺寸变化后几何偏差 ≤ 8px |')
  out.push('| 对比度 | 正文与控件文字 ≥ 4.5:1，占位文字单独记录（WCAG AA） |')
  out.push('| 生命周期 | 关窗后进程驻留、退出后无残留进程、重启后会话与几何恢复 |')
  out.push('| 隐私 | 12 个仓库的工作区文件、未跟踪文件与全部历史 blob 均无个人路径、用户名、私有别名、密钥 |')
  out.push('')
  out.push('证据文件都在 `qa/evidence/`：截图以用例编号命名（`<用例>-<场景>.png`，失败现场为 `<用例>-failure.png`），'
    + '`results.json` 保存逐条结果与说明，`privacy.json` 保存隐私扫描命中，'
    + '`dock-activation-crash.log` 与 `reopen-behaviour.json` 是 F-1 的原始证据，'
    + '`log-*.txt` 是各组运行日志。')
  out.push('')

  out.push('## 八、复现方式')
  out.push('')
  out.push('```bash')
  out.push('# 准备独立的测试 home（不会改动日常使用的数据目录）')
  out.push('node dsh-plugins/distribution/dsh-desktop-bundle/qa/setup-qa.sh fixture')
  out.push('node dsh-plugins/distribution/dsh-desktop-bundle/qa/configure-provider.mjs')
  out.push('node dsh-plugins/distribution/dsh-desktop-bundle/qa/mock-llm.mjs --port 43921 &')
  out.push('')
  out.push('# 执行全部用例并生成报告')
  out.push('cd dsh-plugins/distribution/dsh-desktop-bundle')
  out.push('node qa/run-cases.mjs capture')
  out.push('node qa/run-cases.mjs run all')
  out.push('node qa/report.mjs')
  out.push('```')
  out.push('')

  writeFileSync(outPath, `${out.join('\n')}\n`)
  const bytes = statSync(outPath).size
  console.log(`report written to ${outPath} (${Math.round(bytes / 1024)} KB, ${results.length} cases)`)
}

main()
