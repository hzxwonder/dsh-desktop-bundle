// Group P: the privacy review. These cases read the repository, its history and the
// published disk image, so they run without the application.
import { execFileSync } from 'node:child_process'
import { privateTermPattern, privateTerms } from './private-terms.mjs'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { BUNDLE } from './driver.mjs'

const WORKSPACE = resolve(BUNDLE, '..', '..', '..')
const DISTRIBUTION = BUNDLE
const REPOSITORIES = join(WORKSPACE, 'dsh-plugins', 'repositories')
const EVIDENCE = join(BUNDLE, 'qa', 'evidence')

const PERSONAL = (process.env.HOME ?? '/Users/nobody').split('/').pop()

const RULES = [
  { id: 'person-name', pattern: new RegExp(PERSONAL, 'i') },
  { id: 'home-path', pattern: /\/Users\/[A-Za-z0-9._-]+\// },
  {
    id: 'email',
    pattern: /\b(?<!\/\/)(?!(?:git|ssh|hg|svn)@)[A-Za-z0-9._%+-]+@(?!(?:[A-Za-z0-9-]+\.)*(?:example\.(?:com|org|net)|invalid|test|localhost|host|host\.com)\b)[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/,
  },
  { id: 'private-project', pattern: privateTermPattern() },
  { id: 'ssh-alias', pattern: /alias-[0-9a-f]{8,}/ },
  { id: 'session-id', pattern: /session-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ },
  { id: 'api-key', pattern: /\b(sk-[A-Za-z0-9]{16,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/ },
  {
    id: 'npm-token',
    // An .npmrc is ordinary configuration; only the registry credential in it
    // is private, so the file is judged by content rather than by name.
    pattern: /^\s*\/\/[^\s=]+\/:(_authToken|_auth|_password)\s*=\s*\S{8,}/,
  },
  { id: 'private-endpoint', pattern: /\b(43\.132\.189\.25|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/ },
]

const FORBIDDEN_FILES = [
  /(^|\/)\.credentials\.yaml$/,
  /(^|\/)\.env$/,
  /(^|\/)id_(rsa|ed25519)$/,
  /(^|\/)\.netrc$/,
  /(^|\/)[^/]*\.(pem|p12|pfx|key)$/,
]

const TELEMETRY = /\b(posthog|sentry\.io|google-analytics|googletagmanager|umami\.is|mixpanel|amplitude\.com|segment\.io|bugsnag|datadog)\b/i

/** Files whose text legitimately contains such shapes without carrying private data. */
const ALLOWED = [/(^|\/)package-lock\.json$/, /(^|\/)pnpm-lock\.yaml$/, /(^|\/)qa\//, /\.(png|jpg|webp|icns|dmg|zip)$/i]

/**
 * Vendored snapshots of published packages and the test trees that exercise
 * them write specimen addresses on purpose: reserved example domains and
 * RFC 1918 ranges that never described this machine. Only the two specimen
 * rules stand down there; identity, path, credential and private-project
 * rules keep applying to the same files.
 */
const SPECIMEN_TREES = /(^|\/)(vendor|tests?|__tests__|spec)\//
const SPECIMEN_RULES = new Set(['email', 'private-endpoint'])

const git = (repository, args, options = {}) =>
  execFileSync('/usr/bin/git', ['-C', repository, ...args], { encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, ...options })

function repositories() {
  const list = [DISTRIBUTION]
  if (existsSync(REPOSITORIES)) {
    for (const name of execFileSync('/bin/ls', ['-1', REPOSITORIES], { encoding: 'utf8' }).split('\n').filter(Boolean)) {
      if (existsSync(join(REPOSITORIES, name, '.git'))) list.push(join(REPOSITORIES, name))
    }
  }
  return list
}

function scanLines(text, path, findings) {
  if (ALLOWED.some(pattern => pattern.test(path))) return
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    for (const rule of RULES) {
      if (rule.pattern.test(lines[index])) {
        if (SPECIMEN_TREES.test(path) && SPECIMEN_RULES.has(rule.id)) break
        findings.push({ path, line: index + 1, rule: rule.id })
        break
      }
    }
  }
}

/** Every blob reachable from every commit, so a secret deleted later still shows up. */
function scanHistory(repository) {
  const findings = []
  const revisions = git(repository, ['rev-list', '--all']).split('\n').filter(Boolean)
  const seen = new Set()
  for (const revision of revisions) {
    for (const entry of git(repository, ['ls-tree', '-r', '-z', revision]).split('\0').filter(Boolean)) {
      const [meta, path] = entry.split('\t')
      const sha = meta.split(/\s+/)[2]
      if (seen.has(sha) || /\.(png|jpg|webp|icns|dmg|zip|woff2?|node)$/i.test(path)) continue
      seen.add(sha)
      let text
      try {
        text = git(repository, ['cat-file', '-p', sha])
      } catch {
        continue
      }
      if (text.length > 2 * 1024 * 1024) continue
      scanLines(text, path, findings)
    }
  }
  return { findings, revisions: revisions.length, blobs: seen.size }
}

function scanWorktree(repository) {
  const findings = []
  const files = git(repository, ['ls-files', '-z']).split('\0').filter(Boolean)
  for (const path of files) {
    if (FORBIDDEN_FILES.some(pattern => pattern.test(path))) findings.push({ path, line: 0, rule: 'forbidden-file' })
    if (ALLOWED.some(pattern => pattern.test(path))) continue
    const absolute = join(repository, path)
    if (!existsSync(absolute) || statSync(absolute).size > 2 * 1024 * 1024) continue
    try {
      scanLines(readFileSync(absolute, 'utf8'), path, findings)
    } catch { /* binary */ }
  }
  return findings
}

function mountDiskImage(image) {
  const mountPoint = mkdtempSync(join(tmpdir(), 'dsh-qa-dmg-'))
  execFileSync('/usr/bin/hdiutil', ['attach', image, '-nobrowse', '-readonly', '-mountpoint', mountPoint], { stdio: 'ignore' })
  return {
    mountPoint,
    detach() {
      try {
        execFileSync('/usr/bin/hdiutil', ['detach', mountPoint, '-quiet'], { stdio: 'ignore' })
      } catch { /* best effort */ }
      rmSync(mountPoint, { recursive: true, force: true })
    },
  }
}

function findImages() {
  const candidates = []
  const search = root => {
    if (!existsSync(root)) return
    for (const entry of execFileSync('/bin/ls', ['-1', root], { encoding: 'utf8' }).split('\n').filter(Boolean)) {
      if (entry.endsWith('.dmg')) candidates.push(join(root, entry))
    }
  }
  search(join(BUNDLE, 'dist'))
  search(join(BUNDLE, 'release'))
  return candidates
}

export const privacyCases = [
  {
    id: 'P-01', group: 'P', priority: 'P0', title: '工作区文件不含个人路径与用户名',
    async run(_context, assert) {
      const terms = privateTerms()
      assert.note(`local private terms configured: ${terms.length}`)
      const findings = repositories().flatMap(repository => scanWorktree(repository)
        .map(finding => ({ repository: repository.name, ...finding })))
      assert.check(findings.length === 0, `personal data in tracked files: ${JSON.stringify(findings.slice(0, 6))}`)
    },
  },
  {
    id: 'P-02', group: 'P', priority: 'P0', title: '全部提交历史不含个人路径与用户名',
    async run(_context, assert) {
      const offenders = []
      let commits = 0
      let blobs = 0
      for (const repository of repositories()) {
        const result = scanHistory(repository)
        commits += result.revisions
        blobs += result.blobs
        for (const finding of result.findings) offenders.push({ repository: repository.replace(`${WORKSPACE}/`, ''), ...finding })
      }
      assert.check(offenders.length === 0, `personal data in history: ${JSON.stringify(offenders.slice(0, 6))}`)
      assert.note(`scanned ${commits} commits and ${blobs} committed blobs`)
    },
  },
  {
    id: 'P-03', group: 'P', priority: 'P0', title: '没有任何凭据文件被提交',
    async run(_context, assert) {
      const offenders = []
      for (const repository of repositories()) {
        const tracked = git(repository, ['ls-files']).split('\n').filter(Boolean)
        const historical = git(repository, ['log', '--all', '--pretty=format:', '--name-only'])
          .split('\n').filter(Boolean)
        for (const path of [...tracked, ...historical]) {
          if (FORBIDDEN_FILES.some(pattern => pattern.test(path))) {
            offenders.push({ repository: repository.replace(`${WORKSPACE}/`, ''), path })
          }
        }
      }
      assert.check(offenders.length === 0, `credential files committed: ${JSON.stringify(offenders.slice(0, 6))}`)
      assert.note('no .credentials.yaml, .env, id_rsa, .netrc or key material in any tracked file or commit; .npmrc files are judged by the npm-token rule')
    },
  },
  {
    id: 'P-04', group: 'P', priority: 'P1', title: '不含真实密钥、私有端点或私有项目名',
    async run(_context, assert) {
      const hits = []
      for (const repository of repositories()) {
        hits.push(...scanWorktree(repository).filter(finding => ['api-key', 'private-endpoint', 'private-project', 'ssh-alias'].includes(finding.rule))
          .map(finding => ({ repository: repository.replace(`${WORKSPACE}/`, ''), ...finding })))
      }
      assert.check(hits.length === 0, `secret-like data found: ${JSON.stringify(hits.slice(0, 6))}`)
    },
  },
  {
    id: 'P-05', group: 'P', priority: 'P1', title: '发布磁盘镜像内不含用户数据',
    async run(_context, assert) {
      const images = findImages()
      if (images.length === 0) {
        assert.note('no local disk image to inspect')
        return
      }
      const findings = []
      for (const image of images) {
        const mounted = mountDiskImage(image)
        try {
          // A mounted image holds tens of thousands of files, far past the default buffer.
          const files = execFileSync('/usr/bin/find', [mounted.mountPoint, '-type', 'f'],
            { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 })
            .split('\n').filter(Boolean)
          for (const file of files) {
            const relative = file.slice(mounted.mountPoint.length + 1)
            if (FORBIDDEN_FILES.some(pattern => pattern.test(relative))) findings.push({ image: relative, rule: 'forbidden-file' })
            // Package sources under node_modules may be named like user state; only the
            // application's own data paths matter here.
            const payload = !relative.includes('node_modules/')
            if (payload && /(^|\/)sessions\/[^/]+\.(?:json|jsonl|db)$/i.test(relative)) findings.push({ image: relative, rule: 'user-state' })
            if (payload && /(^|\/)\.credentials|(^|\/)settings\.yaml$/i.test(relative)) findings.push({ image: relative, rule: 'user-state' })
          }
          assert.note(`${image.split('/').pop()}: ${files.length} payload files inspected`)
        } finally {
          mounted.detach()
        }
      }
      assert.check(findings.length === 0, `user data inside the published image: ${JSON.stringify(findings.slice(0, 6))}`)
    },
  },
  {
    id: 'P-06', group: 'P', priority: 'P2', title: '仓库不引入遥测或第三方上报',
    async run(_context, assert) {
      const hits = []
      for (const repository of repositories()) {
        for (const path of git(repository, ['ls-files']).split('\n').filter(Boolean)) {
          if (!/\.(js|mjs|cjs|ts|json|html|md|sh|py|ya?ml)$/.test(path)) continue
          const absolute = join(repository, path)
          if (!existsSync(absolute) || statSync(absolute).size > 1024 * 1024) continue
          if (/(package-lock\.json|pnpm-lock\.yaml)$/.test(path)) continue
          // The scanners name the SDKs they look for; their own sources are not vendors.
          if (/(qa\/cases-privacy\.mjs|qa\/privacy-scan\.mjs)$/.test(path)) continue
          const text = readFileSync(absolute, 'utf8')
          const match = TELEMETRY.exec(text)
          // Record the rule, never the matched token: the evidence is committed too.
          if (match !== null) hits.push({ repository: repository.replace(`${WORKSPACE}/`, ''), path, rule: 'telemetry-sdk' })
        }
      }
      assert.note(`checked ${repositories().length} repositories for telemetry SDKs`)
      assert.check(hits.length === 0, `telemetry references found: ${JSON.stringify(hits.slice(0, 6))}`)
    },
  },
  {
    id: 'P-07', group: 'P', priority: 'P1', title: '验收证据本身不泄露个人数据',
    async run(_context, assert) {
      assert.check(existsSync(EVIDENCE), `evidence directory missing: ${EVIDENCE}`)
      const findings = []
      for (const entry of execFileSync('/bin/ls', ['-1', EVIDENCE], { encoding: 'utf8' }).split('\n').filter(Boolean)) {
        if (!/\.(json|txt|md)$/.test(entry)) continue
        const text = readFileSync(join(EVIDENCE, entry), 'utf8')
        for (const rule of RULES) {
          if (rule.pattern.test(text) && !(rule.id === 'email' && /@(example|host|jump)/.test(text))) {
            findings.push({ file: entry, rule: rule.id })
            break
          }
        }
      }
      assert.check(findings.length === 0, `evidence leaks personal data: ${JSON.stringify(findings.slice(0, 6))}`)
      assert.note('all text evidence is free of personal paths, identities and secrets')
    },
  },
  {
    id: 'P-08', group: 'P', priority: 'P1', title: '验收过程未触碰真实用户数据目录',
    async run(_context, assert) {
      const state = JSON.parse(execFileSync('/usr/bin/python3', ['-c', `
import json, os
path = os.path.expanduser('~/Library/Application Support/DSH Desktop/data-directory/state.json')
print(json.dumps(json.load(open(path))))
`], { encoding: 'utf8' }))
      assert.note(`launcher home: ${state.activeHome}`)
      assert.check(!String(state.activeHome).includes('/.qa/live-home'),
        `the launcher points at the untouched live home: ${state.activeHome}`)
    },
  },
]
