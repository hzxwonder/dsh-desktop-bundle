import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const issues = [];
const skip = new Set(["node_modules", ".git"]);
const patterns = [
  /-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{25,}/,
  /\bsk-[A-Za-z0-9_-]{24,}/,
  /\/Users\/[a-z][\w.-]+\//i,
];
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (/\.(?:js|jsx|cjs|mjs|json|md|yml|css|txt|tex|py)$/.test(e.name)) {
      const text = await readFile(p, "utf8");
      if (patterns.some((r) => r.test(text))) issues.push(p);
    }
  }
}
await walk(".");
if (issues.length) {
  console.error("Review potential private data in:", issues.join(", "));
  process.exitCode = 1;
} else
  console.log(
    "Source scan passed. Review screenshots and GIF visually before publication.",
  );
