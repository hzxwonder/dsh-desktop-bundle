/* Conservative prose parser: commands and display environments remain byte-preserved. */
(function (root) {
  "use strict";
  const prefix = "% @dsh-logic ";
  function hash(text) {
    let h = 2166136261;
    for (const c of text) {
      h ^= c.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, "0");
  }
  function strip(text) {
    return text
      .split("\n")
      .filter((l) => !l.startsWith(prefix) && !/^\s*% @[tcps]:/.test(l))
      .map((l) => l.replace(/ % @s:[0-9]+$/, ""))
      .join("\n");
  }
  function splitSentences(text) {
    const input = text.replace(/\s*\n\s*/g, " ").trim(),
      out = [];
    let start = 0,
      braces = 0,
      math = false;
    for (let i = 0; i < input.length; i++) {
      const c = input[i];
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === "$") {
        math = !math;
        continue;
      }
      if (c === "{") braces++;
      if (c === "}") braces = Math.max(0, braces - 1);
      if (
        !math &&
        !braces &&
        /[.!?。！？]/.test(c) &&
        /\s/.test(input[i + 1] || "") &&
        /^[\s]+[A-Z\u4e00-\u9fff]/.test(input.slice(i + 1))
      ) {
        const tail = input.slice(start, i + 1);
        if (
          /(?:\b(?:e\.g|i\.e|et al|Fig|Eq|Dr|Prof|vs|Sec)|\b[A-Z])\.$/i.test(
            tail,
          )
        )
          continue;
        out.push(tail.trim());
        start = i + 1;
      }
    }
    if (input.slice(start).trim()) out.push(input.slice(start).trim());
    return out;
  }
  function parse(text) {
    const clean = strip(text),
      lines = clean.split("\n"),
      sections = [],
      segments = [];
    let sec = null,
      protectedDepth = 0,
      displayEnd = null;
    const title =
      clean.match(/\\title\{([^}]+)\}/)?.[1]?.replace(/\s+/g, " ") ||
      "论文标题";
    for (let i = 0; i < lines.length; ) {
      const line = lines[i],
        m = line.match(
          /^\s*\\(section|subsection|subsubsection)\*?\{([^}]+)\}/,
        );
      if (displayEnd) {
        segments.push({ kind: "raw", line });
        if (line.includes(displayEnd)) displayEnd = null;
        i++;
        continue;
      }
      if (protectedDepth) {
        segments.push({ kind: "raw", line });
        protectedDepth +=
          [...line.matchAll(/\\begin\{/g)].length -
          [...line.matchAll(/\\end\{/g)].length;
        protectedDepth = Math.max(0, protectedDepth);
        i++;
        continue;
      }
      if (/^\s*(?:\\\[|\$\$)/.test(line)) {
        const end = line.trim().startsWith("$$") ? "$$" : "\\]";
        if (!line.trim().slice(2).includes(end)) displayEnd = end;
        segments.push({ kind: "raw", line });
        i++;
        continue;
      }
      if (m || /^\s*\\begin\{abstract\}/.test(line)) {
        sec = {
          name: m ? m[2] : "Abstract",
          command: line,
          level: m ? m[1] : "abstract",
          paragraphs: [],
          line: i,
        };
        sections.push(sec);
        segments.push({ kind: "section", section: sec, line });
        i++;
        continue;
      }
      if (
        /^\s*\\begin\{(?:equation\*?|align\*?|alignat\*?|gather\*?|multline\*?|displaymath|verbatim|lstlisting|tikzpicture|tabular|figure\*?|table\*?|itemize|enumerate|algorithm)\}/.test(
          line,
        )
      ) {
        protectedDepth =
          [...line.matchAll(/\\begin\{/g)].length -
          [...line.matchAll(/\\end\{/g)].length;
        segments.push({ kind: "raw", line });
        i++;
        continue;
      }
      if (/^\s*\\end\{abstract\}/.test(line)) sec = null;
      if (
        sec &&
        line.trim() &&
        !/^\s*(?:\\|%)/.test(line) &&
        !/(?<!\\)%/.test(line)
      ) {
        const chunk = [];
        let j = i;
        while (
          j < lines.length &&
          lines[j].trim() &&
          !/^\s*(?:\\|%)/.test(lines[j]) &&
          !/(?<!\\)%/.test(lines[j])
        )
          chunk.push(lines[j++]);
        const source = chunk.join("\n"),
          normalized = source.replace(/\s+/g, " ").trim(),
          para = {
            source,
            normalized,
            hash: hash(normalized),
            line: i,
            sentences: splitSentences(source),
          };
        sec.paragraphs.push(para);
        segments.push({ kind: "paragraph", paragraph: para, section: sec });
        i = j;
        continue;
      }
      segments.push({ kind: "raw", line });
      i++;
    }
    return { clean, title, sections, segments };
  }
  function generate(source, previous, semantics = {}) {
    const semantic = (key) => {
      const value = semantics[key];
      if (!value) throw new Error("缺少段落语义，请重新生成");
      return value;
    };
    const parsed = parse(source);
    let next = previous?.nextId || 1;
    const alloc = (kind) => kind + "-" + String(next++).padStart(4, "0");
    const usedSections = new Set();
    const used = new Set(),
      old = previous?.sections.flatMap((s) => s.paragraphs) || [];
    const changes = [];
    let reused = 0,
      created = 0,
      changed = 0;
    const sections = parsed.sections.map((s, si) => {
      let match = previous?.sections.find(
        (x) => x.name === s.name && !usedSections.has(x.id),
      );
      if (!match) {
        const candidate = previous?.sections[si];
        if (
          candidate &&
          !usedSections.has(candidate.id) &&
          !parsed.sections.some((x) => x.name === candidate.name)
        )
          match = candidate;
      }
      if (match) usedSections.add(match.id);
      s.id = match?.id || alloc("sec");
      const paragraphs = s.paragraphs.map((p, pi) => {
        let prior = old.find((x) => x.hash === p.hash && !used.has(x.id));
        if (!prior) {
          const candidate = match?.paragraphs[pi];
          if (
            candidate &&
            !used.has(candidate.id) &&
            !parsed.sections.some((section) =>
              section.paragraphs.some((y) => y.hash === candidate.hash),
            )
          )
            prior = candidate;
        }
        if (prior) used.add(prior.id);
        p.id = prior?.id || alloc("para");
        if (prior && prior.hash === p.hash) {
          p.label = prior.label;
          p.sentenceNodes = prior.sentenceNodes;
          p.reused = true;
          reused++;
        } else {
          p.label = semantic(p.hash).label;
          const usedSent = new Set();
          p.sentenceNodes = p.sentences.map((t) => {
            const priorSent = prior?.sentenceNodes.find(
              (n) => n.source === t && !usedSent.has(n.id),
            );
            if (priorSent) usedSent.add(priorSent.id);
            return {
              id: priorSent?.id || alloc("sent"),
              source: t,
              label: semantic(p.hash).sentences[p.sentences.indexOf(t)],
            };
          });
          if (prior) changed++;
          else created++;
          changes.push({
            id: p.id,
            kind: prior ? "modified" : "added",
            section: s.name,
          });
        }
        return {
          id: p.id,
          hash: p.hash,
          source: p.source,
          normalized: p.normalized,
          label: p.label,
          sentenceNodes: p.sentenceNodes,
        };
      });
      return { id: s.id, name: s.name, paragraphs };
    });
    const removed = old.filter((x) => !used.has(x.id)).map((x) => x.id);
    const output = [];
    const meta = (o) => prefix + JSON.stringify(o);
    output.push(
      meta({
        v: 1,
        type: "paper",
        id: previous?.rootId || "paper-root",
        label: parsed.title,
      }),
    );
    for (const item of parsed.segments) {
      if (item.kind === "raw") {
        output.push(item.line);
        continue;
      }
      if (item.kind === "section") {
        output.push(
          meta({
            v: 1,
            type: "section",
            id: item.section.id,
            parent: "paper-root",
            label: item.section.name,
          }),
          item.line,
        );
        continue;
      }
      const p = item.paragraph;
      output.push(
        meta({
          v: 1,
          type: "paragraph",
          id: p.id,
          parent: item.section.id,
          label: p.label,
        }),
      );
      for (const sentence of p.sentenceNodes)
        output.push(
          meta({
            v: 1,
            type: "sentence",
            id: sentence.id,
            parent: p.id,
            label: sentence.label,
          }),
          sentence.source + " ",
        );
    }
    const annotationIndex = readAnnotations(output.join("\n"));
    const compact = output
      .map((line) => {
        if (!line.startsWith(prefix)) return line;
        const n = JSON.parse(line.slice(prefix.length));
        if (n.type === "paper") return null;
        const label =
          n.type === "section"
            ? semantics.sections?.[n.label] ||
              previous?.sectionIntents?.[n.label] ||
              n.label
            : n.label;
        return (
          "% @" +
          { section: "c", paragraph: "p", sentence: "s" }[n.type] +
          ":" +
          label.replace(/[\r\n]+/g, " ")
        );
      })
      .filter((x) => x !== null);
    const annotated = compact.join("\n");
    const snapshot = {
      schema: 2,
      sectionIntents: { ...previous?.sectionIntents, ...semantics.sections },
      rootId: "paper-root",
      version: (previous?.version || 0) + 1,
      nextId: next,
      title: parsed.title,
      sourceHash: hash(parsed.clean),
      annotatedHash: hash(annotated),
      sections,
      annotatedSource: annotated,
      annotationIndex,
      stats: {
        analyzed: changed + created,
        changed,
        created,
        reused,
        removed: removed.length,
      },
      changes,
      removed,
    };
    return { annotated, snapshot, nodes: readSemanticAnnotations(annotated, snapshot) };
  }
  function readSemanticAnnotations(source, snapshot) {
    const lines = source.split("\n"),
      title = parse(source).title,
      nodes = [
        {
          v: 1,
          type: "paper",
          id: "paper-root",
          label: title,
          line: 1,
          source: title,
        },
      ],
      used = new Set();
    let section = null,
      paragraph = null,
      pendingSection = null,
      pendingParagraph = null,
      serial = 0;
    const add = (type, label, line, parent, body) => {
      const prior = snapshot?.annotationIndex?.find(
        (n) => n.type === type && !used.has(n.id),
      );
      const id = prior?.id || "node-" + ++serial;
      used.add(id);
      const n = { v: 1, type, id, label, line: line + 1, parent, source: body };
      nodes.push(n);
      return n;
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i],
        mark = line.match(/^\s*% @([cps]):(.+)$/),
        command = line.match(
          /^\s*\\(?:section|subsection|subsubsection)\*?\{([^}]+)\}/,
        );
      if (mark) {
        const label = mark[2].trim();
        if (mark[1] === "c") pendingSection = { label, line: i };
        if (mark[1] === "p") pendingParagraph = { label, line: i };
        if (mark[1] === "s") {
          if (pendingParagraph && section) {
            paragraph = add(
              "paragraph",
              pendingParagraph.label,
              pendingParagraph.line,
              section.id,
              lines[i + 1] || "",
            );
            pendingParagraph = null;
          }
          if (!section || !paragraph)
            throw new Error("句子注释需要所属章节和段落");
          add("sentence", label, i, paragraph.id, lines[i + 1] || "");
        }
        continue;
      }
      if (command || /^\s*\\begin\{abstract\}/.test(line)) {
        section = add(
          "section",
          command?.[1] || "Abstract",
          pendingSection?.line ?? i,
          "paper-root",
          line,
        );
        section.intent = pendingSection?.label || section.label;
        pendingSection = null;
        paragraph = null;
        pendingParagraph = null;
        continue;
      }
      if (/^\s*\\end\{abstract\}/.test(line)) {
        section = null;
        paragraph = null;
        continue;
      }
      if (!line.trim()) {
        paragraph = null;
        continue;
      }
      if (pendingParagraph && section && !/^\s*%/.test(line)) {
        paragraph = add(
          "paragraph",
          pendingParagraph.label,
          pendingParagraph.line,
          section.id,
          line,
        );
        pendingParagraph = null;
      }
    }
    return nodes;
  }
  function readAnnotations(source, snapshot) {
    if (/^\s*% @[cps]:(?![0-9]+$).+/m.test(source))
      return readSemanticAnnotations(source, snapshot);
    if (/^(?:% @[tcps]:[0-9]+|[^%\n]+ % @s:[0-9]+)$/m.test(source)) {
      if (!snapshot?.annotationIndex)
        throw new Error("需要配套语义快照读取短标识");
      const found = [];
      for (const [i, line] of source.split("\n").entries()) {
        const token = line.match(/(?:^% | % )(@[tcps]:[0-9]+)$/)?.[1];
        if (!token) continue;
        const n = snapshot.annotationIndex.find((x) => x.marker === token);
        if (!n) throw new Error("未知标识：" + token);
        found.push({
          ...n,
          line: i + 1,
          source:
            n.type === "sentence" && !line.startsWith("% ")
              ? line.replace(/ % @s:[0-9]+$/, "")
              : source.split("\n")[i + 1] || "",
        });
      }
      const validated = readAnnotations(
        found.map((n) => prefix + JSON.stringify(n)).join("\n"),
      );
      return found;
    }
    const lines = source.split("\n"),
      nodes = [],
      ids = new Set();
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i].startsWith(prefix)) continue;
      let n;
      try {
        n = JSON.parse(lines[i].slice(prefix.length));
      } catch {
        throw new Error("标注格式无法解析，第 " + (i + 1) + " 行");
      }
      if (
        n.v !== 1 ||
        !["paper", "section", "paragraph", "sentence"].includes(n.type) ||
        typeof n.id !== "string" ||
        typeof n.label !== "string"
      )
        throw new Error("标注结构不完整");
      if (ids.has(n.id)) throw new Error("标识重复：" + n.id);
      ids.add(n.id);
      nodes.push({ ...n, line: i + 1, source: lines[i + 1] || "" });
    }
    const roots = nodes.filter((n) => n.type === "paper");
    if (roots.length !== 1 || roots[0].parent)
      throw new Error("标注必须有唯一论文根节点");
    const parentType = {
      section: "paper",
      paragraph: "section",
      sentence: "paragraph",
    };
    for (const n of nodes) {
      if (n.type === "paper") continue;
      const parent = nodes.find((p) => p.id === n.parent);
      if (!parent) throw new Error("标注父节点不存在：" + n.parent);
      if (parent.type !== parentType[n.type])
        throw new Error("标注层级不正确：" + n.id);
    }
    return nodes;
  }
  function nearestContext(source, offset) {
    const prefixText = strip(source.slice(0, offset)),
      parsed = parse(source),
      line = prefixText.split("\n").length - 1;
    const section = parsed.sections.filter((s) => s.line <= line).at(-1);
    const paragraph =
      section?.paragraphs.find(
        (p) => line >= p.line && line < p.line + p.source.split("\n").length,
      ) ||
      section?.paragraphs.filter((p) => p.line <= line).at(-1) ||
      section?.paragraphs[0];
    return {
      section: section?.name || null,
      paragraph: paragraph?.normalized || null,
    };
  }
  const api = { hash, strip, parse, generate, readAnnotations, nearestContext };
  root.LogicMapCore = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window === "undefined" ? globalThis : window);
