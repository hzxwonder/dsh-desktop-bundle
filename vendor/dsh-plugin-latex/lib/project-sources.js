import { posix } from "node:path";
import { fail, fileName } from "./store.js";
import logic from "./logic.cjs";
// Resolve literal LaTeX inputs within the selected local project.
export async function collectSources(store, id, main) {
  const sources = [],
    seen = new Set(),
    active = new Set();
  async function visit(name, context, contextHeading = null) {
    fileName(name);
    if (active.has(name)) fail("LaTeX 文件存在循环引用：" + name);
    if (seen.has(name)) return;
    if (seen.size >= 64) fail("论文引用的 TeX 文件超过 64 个");
    const file = await store.read(id, name);
    seen.add(name);
    active.add(name);
    sources.push({ ...file, context, contextHeading });
    const clean = file.content.replace(/(?<!\\)%[^\n]*/g, "");
    for (const match of clean.matchAll(/\\(?:input|include)\s*\{([^}]+)\}/g)) {
      let child = match[1].trim();
      if (/[\\#$]/.test(child))
        fail("动态文件引用需先展开为项目内文件：" + name);
      if (!child.endsWith(".tex")) child += ".tex";
      fileName(child);
      const heading = logic.parse(clean.slice(0, match.index)).sections.at(-1);
      const inherited = heading ? {
        file: name, name: heading.name, headingType: heading.level, level: heading.headingLevel,
        beforeLine: clean.slice(0, match.index).split("\n").length,
      } : contextHeading;
      await visit(child, inherited?.name || context, inherited);
    }
    active.delete(name);
  }
  await visit(main, null);
  return sources;
}
// Prefix only fragments that inherit a containing heading. Real headings keep
// their own type and position; the prefix is never written to the source file.
export function sourceContext(source) {
  if (!source.context || logic.parse(source.content).sections.length) return "";
  const type = source.contextHeading?.headingType || "section";
  return type === "abstract" ? "\\begin{abstract}\n" : "\\" + type + "{" + source.context + "}\n";
}

export function renderSources(sources, snapshots = {}) {
  const title = logic.parse(sources[0].content).title;
  const results = sources.map(source => {
    const context = sourceContext(source);
    const annotated = /% @(?:c|p|s):/.test(source.content) || /% @dsh-logic /.test(source.content);
    return {
      file: source.name, input: source, prefixLines: context ? 1 : 0,
      nodes: annotated ? logic.readAnnotations(context + source.content, snapshots[source.name]) : [],
    };
  });
  return mergeMaps(results, title);
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
    ];
  for (const result of results) {
    const ids = new Map([["paper-root", "paper-root"]]);
    const context = result.input?.contextHeading;
    const owner = context && nodes.filter(n => n.type === "section" && n.file === context.file && n.label === context.name && n.headingType === context.headingType && n.line <= context.beforeLine).at(-1);
    for (const node of result.nodes) {
      if (node.type === "paper") continue;
      const synthetic = node.type === "section" && node.line <= result.prefixLines;
      const inherited = synthetic && (owner || nodes.find(n => n.type === "section" && n.label === node.label && n.headingType === node.headingType));
      if (inherited) {
        ids.set(node.id, inherited.id);
        continue;
      }
      const id = result.file + ":" + node.id;
      ids.set(node.id, id);
      let parent = ids.get(node.parent);
      if (parent === "paper-root" && owner && (node.level ?? Infinity) > owner.level) parent = owner.id;
      nodes.push({
        ...node,
        id,
        parent,
        file: result.file,
        line: Math.max(1, node.line - result.prefixLines),
      });
    }
  }
  return nodes;
}
