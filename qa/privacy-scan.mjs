#!/usr/bin/env node
// Privacy review for the distribution repository and every plugin repository:
// scan the working tree, the index, every commit's tree, and the release assets
// for personal paths, identities, credentials and private project names.
//
//   node qa/privacy-scan.mjs [--repos <file>] [--out <file>]
//
// A match is reported with the repository, the revision (or WORKTREE), the path
// and the matched rule, never with the surrounding secret value.
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { BUNDLE } from './driver.mjs'
import { privateTermPattern } from './private-terms.mjs'

const WORKSPACE = resolve(BUNDLE, '..', '..', '..')
const HOME = process.env.HOME ?? ''

const RULES = [
  { id: 'person-name', description: '本机用户名', pattern: new RegExp(HOME.split('/').pop() ?? '__no_user__', 'i') },
  { id: 'home-path', description: '绝对家目录路径', pattern: /\/Users\/[A-Za-z0-9._-]+\// },
  {
    id: 'email',
    description: '带有真实域名的邮箱地址',
    // Documentation and tests spell out placeholder addresses such as
    // user@example.com; only a routable domain counts as personal data here.
    pattern: /\b[A-Za-z0-9._%+-]+@(?!example\.(com|org|net)\b)(?!host\.com\b)(?!jump\.host\b)(?!localhost\b)(?!test\.com\b)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/,
  },
  { id: 'private-project', description: '私有项目名与内部别名', pattern: privateTermPattern() },
  { id: 'ssh-alias', description: 'SSH 连接标识', pattern: /alias-[0-9a-f]{8,}/ },
  { id: 'session-id', description: '会话 id', pattern: /session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ },
  { id: 'api-key', description: '疑似密钥', pattern: /\b(sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/ },
  { id: 'private-endpoint', description: '私有端点或内网地址', pattern: /\b(43\.132\.189\.25|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})\b/ },
  {
    id: 'secret-assignment',
    description: '源码里写死的密钥赋值',
    pattern: /\b[A-Z][A-Z0-9_]*(API_KEY|TOKEN|SECRET|PASSWORD)[A-Z0-9_]*\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/,
  },
]

/** Credential-bearing files that must never be tracked in any revision. */
const FORBIDDEN_PATHS = [
  /(^|\/)\.credentials\.yaml$/,
  /(^|\/)\.env$/,
  /(^|\/)\.env\.(local|production)$/,
  /(^|\/)id_(rsa|ed25519|ecdsa)$/,
  /(^|\/)\.npmrc$/,
  /(^|\/)\.netrc$/,
  /(^|\/)[^/]*\.(pem|p12|pfx|key)$/,
]

/** Files that legitimately mention such shapes without carrying private data. */
const ALLOWED_PATHS = [
  /(^|\/)package-lock\.json$/,
  /(^|\/)pnpm-lock\.yaml$/,
  /(^|\/)yarn\.lock$/,

  /(^|\/)qa\/cases\.md$/,
  /(^|\/)qa\/privacy-scan\.mjs$/,   // defines the patterns it looks for
  /(^|\/)qa\/cases-privacy\.mjs$/, // and so does the privacy case group
  /(^|\/)qa\/evidence\//,
]

const TEXT_LIMIT = 2 * 1024 * 1024
const BINARY = /\.(png|jpg|jpeg|gif|webp|ico|icns|dmg|zip|gz|zst|woff2?|ttf|otf|node|wasm|pdf|mp4|mov)$/i

function git(repository, args, options = {}) {
  return execFileSync('/usr/bin/git', ['-C', repository, ...args], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, ...options })
}

function ruleFor(line) {
  for (const rule of RULES.filter(rule => rule.pattern !== undefined)) {
    const match = rule.pattern.exec(line)
    if (match !== null) return { rule, match: match[0] }
  }
  return null
}

const allowed = path => ALLOWED_PATHS.some(pattern => pattern.test(path))

function scanText(repository, revision, path, text, findings) {
  if (allowed(path)) return
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const hit = ruleFor(lines[index])
    if (hit === null) continue
    findings.push({
      repository: repository.replace(`${WORKSPACE}/`, ''),
      revision,
      path,
      line: index + 1,
      rule: hit.rule.id,
      description: hit.rule.description,
      // Never echo the matched value: report its shape instead.
      sample: hit.match.replace(/[A-Za-z0-9]/g, ch => (/[0-9]/.test(ch) ? '9' : 'x')).slice(0, 24),
    })
  }
}

function forbiddenPath(path) {
  return FORBIDDEN_PATHS.find(pattern => pattern.test(path))
}

function scanPaths(repository, revision, paths, findings) {
  for (const path of paths) {
    const pattern = forbiddenPath(path)
    if (pattern === undefined) continue
    findings.push({
      repository: repository.replace(`${WORKSPACE}/`, ''),
      revision,
      path,
      line: 0,
      rule: 'forbidden-file',
      description: '仓库中出现凭据文件',
      sample: pattern.source.slice(0, 24),
    })
  }
}

function scanWorktree(repository, findings) {
  const listed = git(repository, ['ls-files', '-z']).split('\0').filter(Boolean)
  scanPaths(repository, 'WORKTREE', listed, findings)
  for (const path of listed) {
    if (BINARY.test(path)) continue
    const absolute = join(repository, path)
    if (!existsSync(absolute)) continue
    if (statSync(absolute).size > TEXT_LIMIT) continue
    scanText(repository, 'WORKTREE', path, readFileSync(absolute, 'utf8'), findings)
  }
  // Untracked files matter too: a stray file is exactly what leaks later.
  const others = git(repository, ['ls-files', '-o', '--exclude-standard', '-z']).split('\0').filter(Boolean)
  for (const path of others) {
    if (BINARY.test(path)) continue
    const absolute = join(repository, path)
    if (!existsSync(absolute) || statSync(absolute).size > TEXT_LIMIT) continue
    scanText(repository, 'UNTRACKED', path, readFileSync(absolute, 'utf8'), findings)
  }
}

function scanHistory(repository, findings, { maxCommits = 400 } = {}) {
  const revisions = git(repository, ['rev-list', `--max-count=${maxCommits}`, '--all']).split('\n').filter(Boolean)
  const seen = new Map() // blob sha -> { path, findings }
  for (const revision of revisions) {
    const listing = git(repository, ['ls-tree', '-r', '-z', revision]).split('\0').filter(Boolean)
    scanPaths(repository, revision.slice(0, 10), listing.map(entry => entry.split('\t')[1]).filter(Boolean), findings)
    for (const entry of listing) {
      const [meta, path] = entry.split('\t')
      const [, , sha] = meta.split(/\s+/)
      if (BINARY.test(path) || allowed(path)) continue
      const key = `${sha}`
      if (seen.has(key)) continue
      let text
      try {
        text = git(repository, ['cat-file', '-p', sha])
      } catch {
        seen.set(key, true)
        continue
      }
      if (text.length > TEXT_LIMIT) {
        seen.set(key, true)
        continue
      }
      const local = []
      scanText(repository, revision.slice(0, 10), path, text, local)
      seen.set(key, true)
      findings.push(...local)
    }
  }
  return revisions.length
}

function listPluginRepos() {
  const root = join(WORKSPACE, 'dsh-plugins', 'repositories')
  if (!existsSync(root)) return []
  return readdirSync(root)
    .filter(name => existsSync(join(root, name, '.git')))
    .map(name => join(root, name))
}

function main() {
  const argument = process.argv.indexOf('--repos')
  const extra = argument >= 0 ? readFileSync(process.argv[argument + 1], 'utf8').split('\n').filter(Boolean) : []
  const repositories = [BUNDLE, ...listPluginRepos(), ...extra]
  const outIndex = process.argv.indexOf('--out')
  const outPath = outIndex >= 0 ? process.argv[outIndex + 1] : join(BUNDLE, 'qa', 'evidence', 'privacy.json')

  const findings = []
  const summary = []
  for (const repository of repositories) {
    if (!existsSync(join(repository, '.git'))) {
      console.log(`skip  ${repository} (not a git repository)`)
      continue
    }
    const before = findings.length
    scanWorktree(repository, findings)
    const commits = scanHistory(repository, findings)
    const count = findings.length - before
    summary.push({ repository: repository.replace(`${WORKSPACE}/`, ''), commits, findings: count })
    console.log(`${count === 0 ? 'ok  ' : 'FAIL'} ${repository.replace(`${WORKSPACE}/`, '')} — ${commits} commits, ${count} finding(s)`)
  }

  writeFileSync(outPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), summary, findings }, null, 2)}\n`)
  console.log(`\ntotal findings: ${findings.length} (report ${outPath})`)
  const byRule = {}
  for (const finding of findings) byRule[finding.rule] = (byRule[finding.rule] ?? 0) + 1
  for (const [rule, count] of Object.entries(byRule).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${rule}: ${count}`)
  }
  for (const finding of findings.slice(0, 40)) {
    console.log(`  ${finding.repository} ${finding.revision} ${finding.path}:${finding.line} [${finding.rule}]`)
  }
  if (findings.length > 0) process.exitCode = 1
}

main()
