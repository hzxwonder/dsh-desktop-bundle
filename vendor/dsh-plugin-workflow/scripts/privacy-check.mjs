import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
const findings = [];
const patterns = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['credential-token', /\b(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['personal-path', /\/(?:Users|home)\/(?!example\b|user\b|username\b|test\b)[A-Za-z][A-Za-z0-9_-]{2,}\//],
  ['credential-url', /https?:\/\/[^\s/:]+:[^\s/@]+@/],
];
const scan = (data, path, revision) => {
  if (data.includes(0)) return;
  data.toString('utf8').split('\n').forEach((line, i) => {
    for (const [category, pattern] of patterns) if (pattern.test(line)) findings.push({ path, line: i + 1, category, ...(revision ? { revision } : {}) });
  });
};
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).toString().split('\0').filter(Boolean);
for (const path of files) if (existsSync(path)) scan(readFileSync(path), path);
const revisions = execFileSync('git', ['rev-list', '--all']).toString().trim().split('\n').filter(Boolean);
const seen = new Set();
for (const rev of revisions) {
  for (const row of execFileSync('git', ['ls-tree', '-r', rev]).toString().split('\n')) {
    const match = /^\d+ blob (\w+)\t(.+)$/.exec(row); if (!match || seen.has(match[1])) continue;
    seen.add(match[1]); scan(execFileSync('git', ['cat-file', 'blob', match[1]], { maxBuffer: 32 * 1024 * 1024 }), match[2], rev);
  }
}
const result = { files: files.length, revisions: revisions.length, uniqueHistoricalBlobs: seen.size, findings };
if (process.env.PRIVACY_REPORT) writeFileSync(process.env.PRIVACY_REPORT, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
