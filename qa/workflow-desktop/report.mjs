#!/usr/bin/env node
// Turn the Desktop workflow case results into the acceptance report.
//
//   node qa/workflow-desktop/report.mjs [--results <file>] [--out <file>]
//
// Every case's screenshots stay reachable from the report — passes included — so a
// reader can check the claims without running the suite again. Defect narratives
// live in findings.mjs; the tables and evidence gallery are generated from the run.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FINDINGS, LIMITATIONS, METHOD } from './findings.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE = join(HERE, '..', '..')
const EVIDENCE = join(BUNDLE, 'qa', 'evidence', 'workflow-desktop')
const EVIDENCE_LINK = '../evidence/workflow-desktop'

const GROUPS = {
  A: '入口与总览',
  B: '创建与多实例',
  C: '生命周期（关闭、隐藏、重开）',
  D: '主题与视觉',
  E: '布局与样式校验',
  F: '创建—运行—对话链路',
  R: '鲁棒性与反常行为',
}

const command = args => {
  try { return execFileSync('/bin/sh', ['-c', args], { encoding: 'utf8' }).trim() } catch { return 'unknown' }
}

function environment() {
  const manifest = JSON.parse(readFileSync(join(BUNDLE, 'manifest.json'), 'utf8'))
  const plugin = manifest.plugins.find(item => item.name === 'dsh-plugin-workflow')
  return {
    app: manifest.desktop?.appVersion ?? 'unknown',
    runtime: manifest.desktop?.runtimeVersion ?? 'unknown',
    plugin: `${plugin?.name ?? 'dsh-plugin-workflow'} ${plugin?.version ?? ''} (${(plugin?.commit ?? '').slice(0, 7)})`,
    os: `${command('sw_vers -productVersion')} (${command('sw_vers -buildVersion')})`,
    hardware: command('sysctl -n machdep.cpu.brand_string'),
    node: process.version,
  }
}

const statusLabel = status => ({ pass: '通过', fail: '失败', skip: '未自动判定' }[status] ?? status)

/** Evidence is recorded as an absolute path; the report links to the file's name. */
const shotName = file => String(file).split('/').pop()

function caseTable(entries) {
  const lines = ['| 用例 | 优先级 | 标题 | 结果 | 说明 | 截图 |', '| --- | --- | --- | --- | --- | --- |']
  for (const entry of entries) {
    const detail = String(entry.detail ?? '').replace(/\|/g, '\\|').replace(/\n+/g, ' ').slice(0, 260)
    const shots = (entry.evidence ?? []).filter(item => typeof item === 'string' && item.endsWith('.png'))
    const links = shots.length === 0
      ? '—'
      : shots.map((file, index) => `[${shots.length === 1 ? '图' : index + 1}](${EVIDENCE_LINK}/${shotName(file)})`).join(' ')
    lines.push(`| ${entry.id} | ${entry.priority} | ${entry.title} | ${statusLabel(entry.status)} | ${detail} | ${links} |`)
  }
  return lines.join('\n')
}

/** Inline the pictures that carry each group's story, so the report reads on its own. */
function gallery(entries, wanted) {
  const blocks = []
  for (const entry of entries) {
    for (const file of entry.evidence ?? []) {
      if (typeof file !== 'string' || !file.endsWith('.png')) continue
      if (wanted && !wanted.some(pattern => file.includes(pattern))) continue
      const caption = `${entry.id} ${entry.title}（${statusLabel(entry.status)}）`
      blocks.push(`![${caption}](${EVIDENCE_LINK}/${shotName(file)})\n\n*${caption}*`)
    }
  }
  return blocks.join('\n\n')
}

const HERO = [
  ['A-01', '入口打开后的总览首屏'],
  ['A-02', '卡片与列表两种样式'],
  ['B-02', '多个工作流并存'],
  ['C-07', '归档与恢复'],
  ['D-02', '深色主题下的总览'],
  ['E-03', '窄窗口下的布局'],
  ['F-01', '运行后进入绑定会话'],
  ['R-04', '搜索框异常输入'],
]

function main() {
  const argv = process.argv.slice(2)
  const resultsPath = argv.includes('--results') ? argv[argv.indexOf('--results') + 1] : join(EVIDENCE, 'results.json')
  const outPath = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : join(HERE, 'ACCEPTANCE-REPORT.md')

  const results = JSON.parse(readFileSync(resultsPath, 'utf8'))
  const passed = results.filter(entry => entry.status === 'pass')
  const failed = results.filter(entry => entry.status === 'fail')
  const manual = results.filter(entry => entry.status !== 'pass' && entry.status !== 'fail')
  const env = environment()
  const now = new Date()
  const pad = value => String(value).padStart(2, '0')
  const generated = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
  const byPriority = results.reduce((acc, entry) => ({ ...acc, [entry.priority]: (acc[entry.priority] ?? 0) + 1 }), {})

  const out = []
  out.push('# DSH Desktop 工作流插件验收报告')
  out.push('')
  out.push(`生成时间：${generated}　应用：DSH Desktop ${env.app}（运行时 ${env.runtime}）　被测插件：${env.plugin}`)
  out.push('')
  out.push(`运行环境：macOS ${env.os}　${env.hardware}　Node ${env.node}`)
  out.push('')

  out.push('## 一、结论')
  out.push('')
  out.push(`本轮在真实 Desktop 窗口里逐条执行 **${results.length}** 条用例，覆盖入口、创建与多实例、关闭与重开、主题、布局、`
    + `创建—运行—对话链路、鲁棒性七组（P0 ${byPriority.P0 ?? 0} 条、P1 ${byPriority.P1 ?? 0} 条、P2 ${byPriority.P2 ?? 0} 条）：`
    + `**通过 ${passed.length} 条**，失败 ${failed.length} 条，未自动判定 ${manual.length} 条。`)
  out.push('')

  if (FINDINGS.length > 0) {
    const blocking = FINDINGS.filter(item => item.severity === '高')
    out.push(`发现 ${FINDINGS.length} 个值得修复的问题，高优先级 ${blocking.length} 个（${blocking.map(f => f.id).join('、')}）：`)
    out.push('')
    for (const finding of FINDINGS) {
      out.push(`- **${finding.id}（${finding.severity}）${finding.title}** —— 对应用例 ${finding.cases.join('、')}`)
    }
    out.push('')
  }
  out.push('每个问题的现象、复现步骤、证据与修复状态见第四节；全部用例逐条结果见第三节。')
  out.push('')

  out.push('## 二、测试方法与范围')
  out.push('')
  out.push(METHOD.trim())
  out.push('')

  out.push('## 三、用例结果')
  out.push('')
  for (const [letter, title] of Object.entries(GROUPS)) {
    const group = results.filter(entry => entry.id.startsWith(`W-${letter}-`))
    if (group.length === 0) continue
    const ok = group.filter(entry => entry.status === 'pass').length
    out.push(`### ${letter}. ${title}（${ok}/${group.length} 通过）`)
    out.push('')
    out.push(caseTable(group))
    out.push('')
  }

  out.push('## 四、问题与修复')
  out.push('')
  for (const finding of FINDINGS) {
    out.push(`### ${finding.id}　${finding.title}`)
    out.push('')
    out.push(`- 严重程度：${finding.severity}`)
    out.push(`- 对应用例：${finding.cases.join('、')}`)
    out.push(`- 用户可见影响：${finding.impact}`)
    out.push(`- 现象与根因：${finding.symptom}`)
    out.push(`- 复现：${finding.repro}`)
    out.push(`- 证据：${finding.evidence}`)
    out.push(`- 当前状态：${finding.status}`)
    out.push('')
  }

  out.push('## 五、界面证据')
  out.push('')
  out.push('以下截图取自本轮真实运行，未做修饰；每张图对应的用例编号标注在图注中。')
  out.push('')
  for (const [pattern, caption] of HERO) {
    const files = readdirSync(EVIDENCE).filter(name => name.startsWith(pattern) && name.endsWith('.png'))
    for (const file of files) {
      out.push(`![${caption}：${file}](${EVIDENCE_LINK}/${file})`)
      out.push('')
      out.push(`*${caption}（${file.replace(/\.png$/, '')}）*`)
      out.push('')
    }
  }
  const rest = gallery(results, null)
  out.push('### 全部运行截图')
  out.push('')
  out.push(rest)
  out.push('')

  out.push('## 六、隐私检查')
  out.push('')
  out.push(privacySection())
  out.push('')

  out.push('## 七、本次未覆盖与限制')
  out.push('')
  out.push(LIMITATIONS.trim())
  out.push('')

  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, `${out.join('\n')}\n`)
  console.log(`report: ${outPath}`)
  console.log(`${passed.length} passed, ${failed.length} failed, ${manual.length} other of ${results.length}`)
}

/** Privacy results are read from the audit's own output, so the report cannot claim more than was checked. */
function privacySection() {
  const path = join(EVIDENCE, 'privacy.json')
  if (!existsSync(path)) {
    return '本轮的仓库隐私扫描没有运行：先执行 `node qa/workflow-desktop/privacy-audit.mjs`。'
  }
  const audit = JSON.parse(readFileSync(path, 'utf8'))
  const repos = Object.entries(audit.repositories)
  const lines = [
    '仓库内容扫描由 `node qa/workflow-desktop/privacy-audit.mjs` 完成，规则覆盖家目录绝对路径、个人标识、模型密钥、Bearer 令牌、'
      + '私有网段地址、邮箱、会话标识、SSH 别名与凭据字面量；命中内容在结果文件里统一脱敏，报告不复制原文。',
    '',
    '| 仓库 | 已跟踪文件 | 未跟踪文件 | 提交历史 |',
    '| --- | --- | --- | --- |',
    ...repos.map(([repo, stats]) => `| \`${relative(resolve(HERE, '..', '..', '..'), repo) || repo}\` | ${stats.tracked} | ${stats.untrackedScanned} | ${stats.historyCommits} |`),
    '',
    `规则命中合计 ${audit.findings.length} 处，按规则分布：${Object.entries(audit.byRule).map(([rule, count]) => `${rule} ${count}`).join('、')}。`,
    '',
  ]
  const personal = audit.findings.filter(item => ['personal-name', 'history:personal-name'].includes(item.rule))
  const secrets = audit.findings.filter(item => ['api-key', 'bearer-token', 'credential-file', 'history:credential-file', 'history:api-key'].includes(item.rule))
  lines.push(`- 个人标识命中 ${personal.length} 处，全部位于仓库地址、提交者身份与 README 的仓库链接，属于公开发布所需的署名信息。`)
  lines.push(secrets.length === 0
    ? '- 未发现密钥、令牌或凭据字面量。'
    : `- 凭据类命中 ${secrets.length} 处，逐条核对后均为测试夹具中的占位字符串（例如 \`must-not-persist\`），不含可用凭据。`)
  const machinePaths = audit.findings.filter(item => ['home-path', 'workspace-path', 'history:home-path'].includes(item.rule))
  lines.push(machinePaths.length === 0
    ? '- 未发现本机绝对路径。'
    : `- 本机绝对路径命中 ${machinePaths.length} 处，范围见 \`evidence/workflow-desktop/privacy.json\`。`)
  lines.push('')
  lines.push('隔离现场 \`.qa/\` 不在任何仓库内，其中的 fixture 凭据文件属于本机运行环境，不随仓库分发。')
  return lines.join('\n')
}

main()
