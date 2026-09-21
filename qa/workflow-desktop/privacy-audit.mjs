#!/usr/bin/env node
// Repository privacy scan for every repository published from this workspace.
//
// Looks for content that must never leave the machine: absolute home paths,
// personal identifiers, API keys and tokens, private network addresses, private
// project terms and captured runtime identifiers. Each finding carries file,
// line and the matched text with the secret itself masked.
//
//   node qa/workflow-desktop/privacy-audit.mjs [--json <path>]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { privateTerms } from '../private-terms.mjs'

// Both trees are located from this script instead of a literal path, so the audit
// itself never becomes the personal path it is meant to catch.
const HERE = dirname(fileURLToPath(import.meta.url))
const BUNDLE = resolve(HERE, '..', '..')
const WORKSPACE = resolve(BUNDLE, '..', '..')
const REPO = process.env.DSH_WORKFLOW_REPO ?? join(WORKSPACE, 'repositories', 'dsh-plugin-workflow')
const HISTORY_LIMIT = 400
const OUT = join(BUNDLE, 'qa', 'evidence', 'workflow-desktop', 'privacy.json')

// Documentation ships with the repository, so it is scanned like any other content;
// only generated output and dependencies are skipped.
const SKIP_DIRS = new Set(['node_modules', '.git', '.build', '.cache', '.scratch', 'dist'])
const TEXT_EXT = /\.(js|jsx|mjs|cjs|ts|tsx|json|md|css|html|yml|yaml|py|sh|txt|env|toml)$/i
const BINARY_EXT = /\.(png|jpg|jpeg|gif|webp|ico|icns|pdf|zip|tgz|woff2?|ttf|sqlite|db|mp4|mov)$/i

/** Mask the middle of a match so a report never reproduces a live secret. */
const mask = value => {
  const text = String(value)
  if (text.length <= 8) return '*'.repeat(text.length)
  return `${text.slice(0, 4)}${'*'.repeat(Math.min(12, text.length - 8))}${text.slice(-4)}`
}

// The identifiers this audit hunts for are configuration, never source: the
// account name comes from the environment and the rest from the git-ignored
// private-terms file, so the audit cannot become what it is meant to catch.
const ACCOUNT = (process.env.HOME ?? '/Users/nobody').split('/').pop()
const IDENTIFIERS = [ACCOUNT, ...privateTerms()]
  .map(term => term.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
  .join('|')

const RULES = [
  { id: 'home-path', severity: 'high', description: '绝对家目录路径', re: /\/Users\/(?!<user>)[A-Za-z0-9._-]+/g },
  { id: 'personal-name', severity: 'high', description: '维护者个人标识', re: new RegExp(`\\b(?:${IDENTIFIERS})\\b`, 'gi') },
  { id: 'api-key', severity: 'critical', description: '模型服务密钥', re: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  { id: 'bearer-token', severity: 'critical', description: 'Bearer 令牌', re: /\bBearer\s+[A-Za-z0-9._-]{20,}\b/g },
  { id: 'private-ip', severity: 'medium', description: '私有网段地址', re: /\b(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}\b/g },
  { id: 'email', severity: 'medium', description: '邮箱地址', re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.(?:com|cn|net|org|io|dev)\b/g },
  { id: 'session-id', severity: 'low', description: '运行时会话标识', re: /\bsession-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/g },
  { id: 'ssh-alias', severity: 'medium', description: 'SSH 主机别名或主机名', re: /\bsshHost\s*[:=]\s*['"]([A-Za-z0-9._-]+)['"]/g },
  { id: 'credential-file', severity: 'critical', description: '凭据文件内容', re: /(?:api[_-]?key|password|passwd|secret|token)\s*[:=]\s*['"][^'"\s]{12,}['"]/gi },
  { id: 'workspace-path', severity: 'medium', description: '本机工作区绝对路径', re: /\/Users\/[A-Za-z0-9._-]+\/(?:Documents|Desktop|Downloads|Library|Projects)\/[^\s"'`)]*/g },
]

function walk(root, { includeDist = false } = {}) {
  const files = []
  const visit = directory => {
    let entries
    try { entries = readdirSync(directory, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) && !(includeDist && entry.name === 'dist')) continue
        visit(path)
      } else if (entry.isFile() && (TEXT_EXT.test(entry.name) || includeDist)) {
        files.push(path)
      }
    }
  }
  visit(root)
  return files
}

function scanFile(file, findings) {
  let text
  try {
    if (statSync(file).size > 4 * 1024 * 1024) return
    text = readFileSync(file, 'utf8')
  } catch { return }
  const lines = text.split('\n')
  for (const [index, line] of lines.entries()) {
    for (const rule of RULES) {
      rule.re.lastIndex = 0
      let match
      while ((match = rule.re.exec(line)) !== null) {
        findings.push({
          rule: rule.id, severity: rule.severity, description: rule.description,
          file: file, line: index + 1,
          match: mask(match[0]),
          context: line.trim().slice(0, 120).replace(match[0], mask(match[0])),
        })
        if (match[0] === '') break
      }
    }
  }
}

function trackedFiles(repo) {
  try {
    return execFileSync('git', ['-C', repo, 'ls-files'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).map(f => join(repo, f))
  } catch { return [] }
}

function historyScan(repo, findings) {
  let commits = []
  try {
    commits = execFileSync('git', ['-C', repo, 'rev-list', `--max-count=${HISTORY_LIMIT}`, '--all'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  } catch { return { commits: 0 } }
  for (const commit of commits) {
    let diff
    try {
      diff = execFileSync('git', ['-C', repo, 'show', '--format=', '--unified=0', commit], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    } catch { continue }
    for (const line of diff.split('\n')) {
      if (!line.startsWith('+')) continue
      for (const rule of RULES) {
        rule.re.lastIndex = 0
        const match = rule.re.exec(line)
        if (match) {
          findings.push({
            rule: `history:${rule.id}`, severity: rule.severity, description: `历史修订中的${rule.description}`,
            file: `${repo}@${commit.slice(0, 8)}`, line: 0,
            match: mask(match[0]), context: line.trim().slice(0, 120).replace(match[0], mask(match[0])),
          })
        }
      }
    }
  }
  return { commits: commits.length }
}

/** Untracked and ignored files still ship if someone runs `git add -A`. */
function untrackedScan(repo, findings) {
  let listed = []
  try {
    listed = execFileSync('git', ['-C', repo, 'status', '--porcelain', '--ignored'], { encoding: 'utf8' })
      .trim().split('\n').filter(Boolean)
      .map(line => line.slice(3).trim())
      .filter(path => !path.endsWith('/'))
  } catch { return 0 }
  let scanned = 0
  for (const entry of listed) {
    const path = join(repo, entry)
    if (!existsSync(path) || BINARY_EXT.test(path) || !TEXT_EXT.test(path)) continue
    scanFile(path, findings)
    scanned += 1
  }
  return scanned
}

/** Every repository under repositories/ and distribution/, so a scan cannot quietly
    cover less than what gets published. */
function targets() {
  const roots = [join(WORKSPACE, 'repositories'), join(WORKSPACE, 'distribution')]
  const found = []
  for (const root of roots) {
    let entries = []
    try { entries = readdirSync(root, { withFileTypes: true }) } catch { continue }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue
      const path = join(root, entry.name)
      if (existsSync(join(path, '.git'))) found.push(path)
    }
  }
  return found.length > 0 ? found : [REPO, BUNDLE]
}

function main() {
  const argv = process.argv.slice(2)
  const jsonIndex = argv.indexOf('--json')
  const output = jsonIndex >= 0 ? argv[jsonIndex + 1] : OUT
  const findings = []
  const summary = { at: new Date().toISOString(), repositories: {}, findings: [] }

  for (const repo of targets()) {
    const tracked = trackedFiles(repo)
    for (const file of tracked) scanFile(file, findings)
    const untracked = untrackedScan(repo, findings)
    const history = historyScan(repo, findings)
    summary.repositories[repo] = { tracked: tracked.length, untrackedScanned: untracked, historyCommits: history.commits }
  }

  summary.findings = findings
  summary.byRule = findings.reduce((acc, item) => ({ ...acc, [item.rule]: (acc[item.rule] ?? 0) + 1 }), {})
  summary.bySeverity = findings.reduce((acc, item) => ({ ...acc, [item.severity]: (acc[item.severity] ?? 0) + 1 }), {})
  mkdirSync(dirname(output), { recursive: true })
  writeFileSync(output, `${JSON.stringify(summary, null, 2)}\n`)

  console.log(`repositories scanned: ${Object.keys(summary.repositories).length}`)
  for (const [repo, stats] of Object.entries(summary.repositories)) {
    console.log(`  ${relative(WORKSPACE, repo) || repo}: tracked=${stats.tracked} untracked=${stats.untrackedScanned} commits=${stats.historyCommits}`)
  }
  console.log(`findings: ${findings.length}`)
  for (const [rule, count] of Object.entries(summary.byRule)) console.log(`  ${rule}: ${count}`)
  for (const finding of findings.slice(0, 25)) {
    console.log(`  [${finding.severity}] ${finding.rule} ${finding.file.replace(WORKSPACE, '…')}:${finding.line} ${finding.match}`)
  }
  if (findings.length === 0) console.log('no matches')
}

main()
