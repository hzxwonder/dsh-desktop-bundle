import { posix } from "node:path";
import { fail, fileName } from "./store.js";
import logic from "./logic.cjs";
// Resolve literal LaTeX inputs within the selected local project.
export async function collectSources(store, id, main) {
  const sources = [],
    seen = new Set(),
    active = new Set();
  async function visit(name, context) {
    fileName(name);
    if (active.has(name)) fail("LaTeX 文件存在循环引用：" + name);
    if (seen.has(name)) return;
    if (seen.size >= 64) fail("论文引用的 TeX 文件超过 64 个");
    const file = await store.read(id, name);
    seen.add(name);
    active.add(name);
    sources.push({ ...file, context });
    const clean = file.content.replace(/(?<!\\)%[^\n]*/g, "");
    for (const match of clean.matchAll(/\\(?:input|include)\s*\{([^}]+)\}/g)) {
      let child = match[1].trim();
      if (/[\\#$]/.test(child))
        fail("动态文件引用需先展开为项目内文件：" + name);
      if (!child.endsWith(".tex")) child += ".tex";
      fileName(child);
      const nearest =
        logic.nearestContext(clean, match.index).section || context;
      await visit(child, nearest);
    }
    active.delete(name);
  }
  await visit(main, null);
  return sources;
}
export function mergeMaps(results, title) {
  const nodes = [
      {
        id: "paper-root",
        type: "paper",
        label: title,
        line: 1,
        file: results[0]?.file,
      },
    ],
    sections = new Map();
  for (const result of results) {
    const ids = new Map([["paper-root", "paper-root"]]);
    for (const node of result.nodes) {
      if (node.type === "paper") continue;
      if (node.type === "section" && sections.has(node.label)) {
        ids.set(node.id, sections.get(node.label));
        continue;
      }
      const id = result.file + ":" + node.id;
      ids.set(node.id, id);
      if (node.type === "section") sections.set(node.label, id);
      nodes.push({
        ...node,
        id,
        parent: ids.get(node.parent),
        file: result.file,
        line: Math.max(1, node.line - result.prefixLines),
      });
    }
  }
  return nodes;
}
