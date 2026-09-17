export const tokenFor = (key) => `{{input.${key}}}`;
export function canConnect(def, from, to) {
  if (from === to || !def.nodes.some(n => n.id === from) || !def.nodes.some(n => n.id === to)) return false;
  const seen = new Set();
  const visit = id => {
    if (id === from) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return def.edges.filter(e => e.from === id).some(e => visit(e.to));
  };
  return !visit(to);
}
export function connectReference(def, from, to, append = true) {
  if (!canConnect(def, from, to)) throw new Error("此连接会形成循环");
  const source = def.nodes.find(n => n.id === from);
  const target = def.nodes.find(n => n.id === to);
  const existing = Object.entries(target.input ?? {}).find(([, r]) => r.source === "node" && r.nodeId === from);
  let key = existing?.[0] ?? (target.kind === "artifact" && !target.input?.content ? "content" : from);
  while (!existing && Object.hasOwn(target.input ?? {}, key)) key += "_output";
  const ref = existing?.[1] ?? { source: "node", nodeId: from, path: source.kind === "agent" && !source.outputSchema ? "/text" : "" };
  const token = tokenFor(key);
  return { definition: { ...def,
    edges: def.edges.some(e => e.from === from && e.to === to) ? def.edges : [...def.edges, { from, to }],
    nodes: def.nodes.map(n => n.id !== to ? n : { ...n, input: { ...n.input, [key]: ref },
      ...(n.kind === "agent" && append && !n.prompt?.includes(token) ? { prompt: `${n.prompt ?? ""}\n${token}`.trim() } : {}) }),
  }, key };
}
export function removeGraphItems(def, ids = [], edges = []) {
  const removed = new Set(ids);
  const next = { ...def, nodes: def.nodes.filter(n => !removed.has(n.id)), edges: def.edges.filter(e => !removed.has(e.from) && !removed.has(e.to) && !edges.includes(`${e.from}:${e.to}`)) };
  const ancestors = id => {
    const seen = new Set();
    const visit = target => next.edges.filter(e => e.to === target).forEach(e => { if (!seen.has(e.from)) { seen.add(e.from); visit(e.from); } });
    visit(id); return seen;
  };
  next.nodes = next.nodes.map(n => {
    let prompt = n.prompt;
    const upstream = ancestors(n.id);
    const input = Object.fromEntries(Object.entries(n.input ?? {}).filter(([key, ref]) => {
      if (ref.source !== "node" || upstream.has(ref.nodeId)) return true;
      prompt = prompt?.split(tokenFor(key)).join("").split(`{{node.${ref.nodeId}}}`).join("");
      return false;
    }));
    return { ...n, input, ...(prompt === undefined ? {} : { prompt }) };
  });
  next.outputs = Object.fromEntries(Object.entries(next.outputs ?? {}).filter(([, r]) => r.source !== "node" || !removed.has(r.nodeId)));
  return next;
}
export function pasteNodes(def, copied) {
  const ids = new Map(copied.nodes.map(n => [n.id, `node_${crypto.randomUUID().slice(0, 8)}`]));
  const nodes = copied.nodes.map(original => {
    const n = structuredClone(original);
    return { ...n, id: ids.get(n.id), name: `${n.name} 副本`, position: { x: (n.position?.x ?? 80) + 48, y: (n.position?.y ?? 80) + 48 },
      input: Object.fromEntries(Object.entries(n.input ?? {}).map(([k,r]) => [k, r.source === "node" && ids.has(r.nodeId) ? { ...r, nodeId: ids.get(r.nodeId) } : r])) };
  });
  const edges = copied.edges.filter(e => ids.has(e.to) && (ids.has(e.from) || def.nodes.some(n => n.id === e.from))).map(e => ({...e, from: ids.get(e.from) ?? e.from, to: ids.get(e.to)}));
  return { ...def, nodes: [...def.nodes, ...nodes], edges: [...def.edges, ...edges] };
}
export function renderPrompt(prompt = "", input = {}) {
  return prompt.replace(/\{\{(?:input|node)\.([a-zA-Z0-9_-]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(input, key)) throw new Error(`PROMPT_INPUT_MISSING: ${key}`);
    const value = input[key];
    return JSON.stringify(value);
  });
}
// A question shown to a person reads as prose, so interpolated values are
// inserted verbatim instead of as JSON literals.
export function renderMaterial(prompt = "", input = {}) {
  return prompt.replace(/\{\{(?:input|node)\.([a-zA-Z0-9_-]+)\}\}/g, (_, key) => {
    if (!Object.hasOwn(input, key)) throw new Error(`PROMPT_INPUT_MISSING: ${key}`);
    const value = input[key];
    return typeof value === "string" ? value : JSON.stringify(value);
  });
}
