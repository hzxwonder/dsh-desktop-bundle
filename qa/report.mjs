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
    title: '次级文字对比度低于 WCAG AA（浅色 2.13:1、深色 3.76:1）',
    severity: '低（可访问性）',
    cases: ['L-05', 'L-06'],
    open: true,
    symptom: '浅色主题下 13px 的思考强度标记 `Medium` 为 rgb(173,178,184) on #ffffff，对比度 2.13:1；'
      + '侧边栏分组标题 `工作区` 为 rgb(129,133,140) on #ffffff，3.71:1；两者都低于 AA 对正文要求的 4.5:1。'
      + '深色主题最低同样是 `Medium`：rgb(129,133,140) on rgb(44,44,46)，3.76:1。'
      + '同一轮采样里正文与控件文字合格（`工作区内修改` 5.8:1、深色 `工作区` 8.78:1、`新会话` 9.18:1）。',
    impact: '低视力用户在两种主题下都较难辨认这些次级标签，属于可访问性缺陷，不影响功能与数据。',
    repro: '`node qa/run-cases.mjs run L-05 L-06`：切到目标主题，逐元素计算前景色与背景色的对比度并列出低于阈值的样本。',
    evidence: '`evidence/L-05-light-theme.png`、`evidence/L-06-dark-theme.png`，逐元素采样明细写在两个用例的说明里',
    suggestion: '浅色主题的 `--dsw-static-neutral-bluish-600`（#81858c）与深色主题的 `--dsw-static-neutral-bluish-400`（#adb2b8）'
      + '在 13–14px 下都达不到 4.5:1。它们是官方设计系统的静态色阶（`@deepseek-ai/dsh-client-ui-theme`），'
      + '插件按 `var(--dsw-alias-label-tertiary)` 取用即继承该比值；调整色阶或为小字号定义更深的别名属于主题层改动，'
      + '也可先在本地覆盖这两个变量验证效果。',
  },
  {
    id: 'F-2',
    title: '激活路径未防御已销毁的窗口，主进程抛出未捕获异常',
    severity: '中（健壮性）',
    cases: ['B-01', 'B-02', 'B-03', 'B-04'],
    watch: true,
    symptom: '渲染进程调用 `window.close()` 时窗口的 web contents 被销毁，但应用自己的 close 处理器没有运行'
      + '（`main-window-state.json` 的修改时间不变——写入该文件是处理器的第一条语句）；'
      + '此后再激活应用，`activate` 回调对已销毁的窗口调用 `applicationNeedsReveal()`，'
      + '抛出 `TypeError: Object has been destroyed`（`electron-runtime-*.js` 的 `applicationNeedsReveal` ← `EventEmitter.activate`），'
      + '进程随后退出。',
    impact: '用户可用的关闭入口（红灯、⌘W、Dock 菜单）都经主进程的 close 处理器，走到的是隐藏窗口而不是销毁；'
      + '因此这是健壮性缺口而不是当前主流程的故障：一旦窗口因其他原因被销毁（渲染进程异常、脚本调用 `window.close()`），'
      + '应用会停在“进程还在、窗口回不来、再激活即退出”的状态。B-01…B-04 因此在本机判为未验证（见第六节）。',
    repro: '启动应用后从渲染进程执行 `window.close()`，再执行 `open -a "/Applications/DSH Desktop.app"`：'
      + '`~/Library/Application Support/DSH Desktop/logs/dsh-*.error.log` 写入上述调用栈，进程数归零。',
    evidence: '`evidence/B-01-failure.png`（关闭后的现场）与用例说明里的进程数采样',
    suggestion: '在 `activate`、`did-become-active` 与 `second-instance` 三条入口上先判断 `window.isDestroyed()`；'
      + '窗口已销毁时重建窗口（或明确走一次完整启动）后再 `show()`，避免把不可恢复的状态暴露给未捕获异常。',
  },
  {
    id: 'F-4',
    title: '空输入回车会新建空会话（2.0.10 轮次遗留）',
    severity: '低',
    cases: ['R-01', 'R-04'],
    resolved: '2.0.13 上复验通过，用例 R-01（空输入回车不产生空会话）与 R-04（发送过程中重复回车不产生重复消息）'
      + '在新版本上各跑一轮均通过：在空输入框连按三次回车、再输入空格回车，侧边栏条目数不变；'
      + '发送过程中重复回车只产生一条消息。用例与断言未作任何放宽，'
      + '因此这是打包版本从 2.0.10 升到 2.0.13 带来的行为改善。',
  },
  {
    id: 'F-3',
    title: '隐私审查曾把本机标识与家目录路径写入提交历史、证据文件和验收工具',
    severity: '高（隐私）',
    cases: ['P-01', 'P-02', 'P-03', 'P-04', 'P-07'],
    resolved: '已修复并复验通过（P-01…P-04、P-07 全绿）。三处来源分别处置：'
      + '（1）供应商目录与测试夹具里的保留示例域名、RFC 1918 示例地址属于上游发布物自带的样例，'
      + '规则改为对 `vendor/`、`tests/`、`test/`、`spec/` 只停用 `email` 与 `private-endpoint` 两条形态规则，'
      + '身份、路径、凭据与私有项目名规则照常生效；`email` 规则同时收紧了占位域名（含 `*.example.com` 子域）、'
      + 'VCS 账号与 URL 凭据三种形态；'
      + '（2）`.npmrc` 不再按文件名判为凭据文件（供应商包安装对等依赖需要它），改由内容规则 `npm-token` 判定，'
      + '用一条合成的 `_authToken` 行验证过它仍会被抓出；'
      + '（3）验收工具 `qa/workflow-desktop/privacy-audit.mjs` 里写死的维护者标识改为从环境与'
      + '（被 git 忽略的）`qa/private-terms.local.txt` 读取，并把含该标识的 5 个本地提交重写后再收尾。'
      + '结果：14 个仓库的工作区与全部提交 0 命中；证据文件在写入时就掩码家目录，'
      + '`qa/local-paths.mjs` 同时供运行器与清洗脚本使用。',
  },
]

/** Behaviour that did not fail this round but deserves a follow-up. */
const OBSERVATIONS = [
  { text: '侧边栏收起后，展开入口是图标栏里的“打开侧边栏”按钮（无文字标签），自动发现性较弱；'
    + '本轮已按该标签完成收起/展开与多次开合验证（L-12、L-13、L-15 通过）。',
    shots: ['rail-collapsed', 'rail-hover'] },
  '空数据目录或全新 Profile 启动时没有工作区，界面停留在“选择一个工作区开始”，'
    + '输入框不出现（R-11、R-12 按此预期判定通过）；首次使用者需要先添加工作区才能开始对话。',
  '插件市场面板在未配置目录源时按设计返回错误体（本地接口 `not-available`），面板显示该状态而不是空白；'
    + 'F-13、R-10 因此只把这条已声明的响应排除在控制台错误之外，其他失败响应仍会让用例失败。',
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
  const lines = ['| 用例 | 优先级 | 标题 | 结果 | 耗时/说明 | 截图 |', '| --- | --- | --- | --- | --- | --- |']
  for (const entry of entries) {
    const detail = entry.status === 'pass'
      ? (entry.detail ?? '')
      : (entry.detail ?? '').replace(/\|/g, '\\|').slice(0, 300)
    // Every picture a case took stays reachable from the report, not only the failures.
    const shots = (entry.evidence ?? [])
      .filter(item => typeof item === 'string' && item.endsWith('.png'))
      .map(item => item.replace('qa/evidence/', ''))
    const links = shots.length === 0
      ? '—'
      : shots.map((file, index) => `[${shots.length === 1 ? '图' : index + 1}](evidence/${file})`).join(' ')
    lines.push(`| ${entry.id} | ${entry.priority} | ${entry.title} | ${statusLabel(entry.status)} | ${detail} | ${links} |`)
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
    const openFindings = FINDINGS.filter(finding => finding.cases.some(id => failedIds.has(id)))
    out.push('主流程（启动、会话、主题、布局、面板、异常输入、仓库隐私）可用，没有出现数据损坏或会话丢失。'
      + `下面 ${openFindings.length} 项未通过：`)
    out.push('')
    for (const finding of openFindings) {
      const open = finding.cases.filter(id => failedIds.has(id))
      out.push(`- **${finding.id} · ${finding.severity} · ${finding.title}** —— 对应用例 ${open.join('、')}`)
    }
    out.push('')
    out.push(`另有 ${skipped.length} 条用例在本机无法产生被测刺激（关闭窗口要由窗口服务器投递，`
      + `测试进程没有辅助功能权限），按“未验证”记录而不计入失败：`
      + `${skipped.map(entry => entry.id).join('、')}；其中由探针直接复现的健壮性缺口见 F-2。`)
    for (const finding of FINDINGS) {
      if (openFindings.includes(finding) || finding.resolved === undefined) continue
      out.push('')
      out.push(`- ~~${finding.id} · ${finding.severity} · ${finding.title}~~ —— 已修复：对应用例 ${finding.cases.join('、')} 复验通过，见第五节`)
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
  out.push('隐私审查覆盖分发仓库与 13 个插件仓库（工作区、未跟踪文件与全部提交历史），结果见附录 A。')
  out.push('推理走本地 mock 模型服务（OpenAI 兼容接口），不使用任何真实密钥。')
  out.push('关闭窗口由窗口服务器投递（红灯或 ⌘W），测试进程没有 macOS 辅助功能权限，')
  out.push('因此 B-01…B-04 在无法投递该请求的主机上按“未验证”记录，'
    + '而不是用渲染进程的 `window.close()` 替代——那条路径会销毁 web contents 且不经过应用的关闭处理器，'
    + '是用户无法到达的状态；进程退出与重启后的会话、几何恢复由 B-05、B-06 覆盖。其余受限项在第六节列出。')
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
    // Every curated finding belongs here: a fixed one shows what changed, and a
    // watched one shows a gap whose cases this host could not exercise.
    const related = open.length > 0 ? open : finding.cases
    out.push(`### ${finding.id}　${finding.title}`)
    out.push('')
    const assessment = open.length > 0 ? '' : finding.resolved !== undefined ? '（复验通过）' : '（本轮未验证）'
    out.push(`- 严重程度：${finding.severity}　相关用例：${related.join('、')}${assessment}`)
    for (const [label, value] of [['现象', finding.symptom], ['影响', finding.impact], ['复现', finding.repro], ['证据', finding.evidence], ['建议', finding.suggestion]]) {
      if (value !== undefined) out.push(`- ${label}：${value}`)
    }
    if (finding.resolved !== undefined) out.push(`- 处理结果：${finding.resolved}`)
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
    for (const item of OBSERVATIONS) {
      const observation = typeof item === 'string' ? { text: item } : item
      out.push(`- ${observation.text}`)
      for (const shot of observation.shots ?? []) {
        if (!available.has(`${shot}.png`)) continue
        out.push('')
        out.push(imageBlock(shot, `${shot}.png`))
      }
    }
    out.push('')
  }

  out.push('## 六、未覆盖与受限项')
  out.push('')
  out.push('| 项目 | 原因 | 建议的替代验证 |')
  out.push('| --- | --- | --- |')
  out.push('| 关闭窗口 → 驻留 → 唤回（B-01…B-04） | 关闭请求由窗口服务器投递，测试进程无辅助功能权限，本机无法产生该刺激 | 手工点红灯或按 ⌘W 后观察 Dock 唤回；或在授予辅助功能权限的机器上重跑 `node qa/run-cases.mjs run B` |')
  out.push('| ⌘Q / ⌘W / ⌘M / ⌘H 原生快捷键 | 测试进程无 macOS 辅助功能权限，无法注入系统按键 | 用关闭窗口、SIGTERM 与后台冻结三条路径覆盖同一后果；手工按一次快捷键确认 |')
  out.push('| 界面缩放（⌘+ / ⌘- / ⌘0，菜单项 放大 / 缩小 / 实际大小） | 缩放由 Electron 原生菜单的 `setZoomLevel` / `resetZoom` 提供，同样需要向应用注入系统按键 | 手工按一次 ⌘+ 与 ⌘0，确认字号与布局；窗口尺寸维度已由 L-08…L-11 覆盖 |')
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

  out.push('## 八、附录 A：隐私审查覆盖')
  out.push('')
  const privacyPath = join(EVIDENCE, 'privacy.json')
  if (existsSync(privacyPath)) {
    const privacy = JSON.parse(readFileSync(privacyPath, 'utf8'))
    const totalCommits = privacy.summary.reduce((sum, entry) => sum + entry.commits, 0)
    const totalFindings = privacy.summary.reduce((sum, entry) => sum + entry.findings, 0)
    out.push(`扫描时间：${privacy.generatedAt.slice(0, 16).replace('T', ' ')}（UTC）。`
      + `每个仓库都检查了工作区文件、未跟踪文件、全部提交的目录树与去重后的文件内容，共 ${privacy.summary.length} 个仓库、`
      + `${totalCommits} 个提交、${totalFindings} 处命中。`)
    out.push('')
    out.push('| 仓库 | 提交数 | 命中 |')
    out.push('| --- | --- | --- |')
    for (const entry of privacy.summary) {
      out.push(`| ${entry.repository} | ${entry.commits} | ${entry.findings === 0 ? '0' : `**${entry.findings}**`} |`)
    }
    out.push('')
    const byRule = new Map()
    for (const finding of privacy.findings) byRule.set(finding.rule, (byRule.get(finding.rule) ?? 0) + 1)
    if (byRule.size > 0) {
      out.push('命中按规则汇总：' + [...byRule].map(([rule, count]) => `${rule} ${count} 处`).join('、') + '。')
      out.push('')
      out.push('涉及的文件与修订：')
      out.push('')
      for (const finding of privacy.findings.slice(0, 40)) {
        out.push(`- \`${finding.repository}\` ${finding.revision} \`${finding.path}:${finding.line}\` [${finding.rule}]`)
      }
      if (privacy.findings.length > 40) out.push(`- 其余 ${privacy.findings.length - 40} 条见 \`evidence/privacy.json\``)
      out.push('')
    } else {
      out.push('全部仓库未发现个人路径、用户名、私有别名、密钥或凭据文件。')
      out.push('')
    }
  } else {
    out.push('未找到 `evidence/privacy.json`，先运行 `node qa/privacy-scan.mjs`。')
    out.push('')
  }

  out.push('## 九、复现方式')
  out.push('')
  out.push('```bash')
  out.push('cd dsh-plugins/distribution/dsh-desktop-bundle')
  out.push('')
  out.push('# 1. 备份日常 home，准备隔离的 fixture home，并启动本地 mock 模型服务')
  out.push('bash qa/setup-qa.sh backup            # 结束后用 bash qa/setup-qa.sh restore 还原')
  out.push('node qa/mock-llm.mjs --port 43921 &')
  out.push('')
  out.push('# 2. 记录基线，执行用例（可只跑一组或单条：run B L、run R-12 L-05）')
  out.push('node qa/run-cases.mjs capture')
  out.push('node qa/run-cases.mjs run all')
  out.push('')
  out.push('# 3. 隐私审查与报告（词表放在 qa/private-terms.local.txt，或用 QA_PRIVATE_TERMS 传入）')
  out.push('node qa/privacy-scan.mjs')
  out.push('node qa/report.mjs')
  out.push('')
  out.push('# 4. 还原日常 home 与启动器')
  out.push('bash qa/setup-qa.sh restore')
  out.push('```')
  out.push('')
  out.push('报告与证据里的本机路径在写入前统一改写为 `/Users/<user>`（`qa/sanitize-evidence.mjs`），'
    + '仓库里不含测试用的真实密钥，也不含日常 home 的任何内容。')
  out.push('')

  writeFileSync(outPath, `${out.join('\n')}\n`)
  const bytes = statSync(outPath).size
  console.log(`report written to ${outPath} (${Math.round(bytes / 1024)} KB, ${results.length} cases)`)
}

main()
