import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, symlink, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, fileName } from "../lib/store.js";
import { compile, run } from "../lib/compiler.js";
import logic from "../lib/logic.cjs";
async function setup(t) {
  const dir = await mkdtemp(join(tmpdir(), "latex-test-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const s = await new Store(dir).init();
  return { s, p: await s.add({ name: "Research Demo" }) };
}
test("projects persist and duplicate imports reuse identity", async (t) => {
  const { s, p } = await setup(t);
  assert.equal((await s.add({ name: "Imported", path: p.root })).id, p.id);
  assert.equal((await new Store(s.directory).init()).projects.length, 1);
});
test("file writes preserve external edits using compare-and-swap", async (t) => {
  const { s, p } = await setup(t),
    f = await s.read(p.id, "main.tex");
  await writeFile(join(p.root, "main.tex"), "external");
  await assert.rejects(s.save(p.id, "main.tex", "draft", f.hash), {
    code: "CONFLICT",
  });
  assert.equal((await s.read(p.id, "main.tex")).content, "external");
});
test("inline creation rejects duplicate, traversal and symlink escape", async (t) => {
  const { s, p } = await setup(t);
  await s.createFile(p.id, "sections/method.tex");
  await assert.rejects(s.createFile(p.id, "sections/method.tex"), {
    code: "CONFLICT",
  });
  for (const f of ["../x.tex", "/tmp/x.tex", ".env", "a/../x.tex", "a\\x.tex"])
    assert.throws(() => fileName(f));
  await symlink(tmpdir(), join(p.root, "escape"));
  await assert.rejects(s.createFile(p.id, "escape/outside.tex"));
});
test("review metadata and chat membership persist", async (t) => {
  const { s, p } = await setup(t);
  await s.update(p.id, { chat: { id: "demo", title: "Paper chat" } });
  await assert.rejects(s.update(p.id, { lastChat: "other" }));
  assert.equal(
    (await new Store(s.directory).init()).get(p.id).lastChat,
    "demo",
  );
});
test("semantic annotations reuse unchanged paragraphs and locate sections", () => {
  const src = String.raw`\title{Demo}
\begin{abstract}
First sentence. Second sentence.
\end{abstract}
\section{Method}
A method is proposed.
`;
  const parsed = logic.parse(src),
    semantics = {};
  for (const p of parsed.sections.flatMap((s) => s.paragraphs))
    semantics[p.hash] = {
      label: "Paragraph intent",
      sentences: p.sentences.map(() => "Sentence intent"),
    };
  const first = logic.generate(src, null, semantics),
    second = logic.generate(first.annotated, first.snapshot, {});
  assert.equal(second.snapshot.stats.analyzed, 0);
  assert.equal(second.snapshot.stats.reused, 2);
  assert.equal(second.nodes.filter((n) => n.type === "sentence").length, 3);
  assert.equal(
    logic.nearestContext(src, src.indexOf("A method")).section,
    "Method",
  );
  assert.match(first.annotated, /% @p:Paragraph intent/);
  assert.doesNotMatch(first.annotated, /% @dsh-logic/);
});
test("compiler creates real PDF and retains last successful result after error", async (t) => {
  const { s, p } = await setup(t);
  const good = await compile(s, p.id, new AbortController().signal);
  assert.equal(good.ok, true, good.log);
  assert.ok(
    Buffer.from(good.pdf, "base64").subarray(0, 5).equals(Buffer.from("%PDF-")),
  );
  const f = await s.read(p.id, "main.tex");
  await s.save(
    p.id,
    "main.tex",
    "\\documentclass{article}\n\\begin{document}\n\\unknowncommand\n\\end{document}",
    f.hash,
  );
  const bad = await compile(s, p.id, new AbortController().signal);
  assert.equal(bad.ok, false);
  assert.equal(
    (await readFile(join(s.directory, "pdf", p.id + ".pdf"))).toString(
      "base64",
    ),
    good.pdf,
  );
});
test("subprocess cancellation, timeout and missing executable", async () => {
  const c = new AbortController();
  const r = run(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
    signal: c.signal,
  });
  c.abort();
  assert.equal((await r).reason, "编译已取消");
  assert.equal(
    (
      await run(process.execPath, ["-e", "setInterval(()=>{},1000)"], {
        timeout: 50,
      })
    ).reason,
    "编译超时",
  );
  await assert.rejects(run("dsh-latex-missing-executable", []), /LaTeX/);
});
test("semantic splitting preserves abbreviations, inline math and comments", () => {
  const src = String.raw`\title{Demo}
\section{Method}
Dr. Smith uses $x. Y$ for evidence. Another sentence follows.

Text % keep comment
Follow-up line.

  \begin{equation}
x = 2.
  \end{equation}
`;
  const p = logic.parse(src),
    semantics = {};
  for (const para of p.sections.flatMap((s) => s.paragraphs))
    semantics[para.hash] = {
      label: "Intent",
      sentences: para.sentences.map(() => "Meaning"),
    };
  assert.equal(p.sections[0].paragraphs[0].sentences.length, 2);
  const result = logic.generate(src, null, semantics);
  assert.match(result.annotated, /Text % keep comment\n/);
  assert.match(
    result.annotated,
    /  \\begin\{equation\}\nx = 2\.\n  \\end\{equation\}/,
  );
});
test("analysis requires complete model data and does not invent semantics", () => {
  assert.throws(
    () => logic.generate("\\section{Method}\nA result.", null, {}),
    /语义/,
  );
});
test("nested main file compiles with root-relative input", async (t) => {
  const { s, p } = await setup(t);
  await s.createFile(p.id, "sections/main.tex");
  const f = await s.read(p.id, "sections/main.tex");
  await s.save(
    p.id,
    f.name,
    "\\documentclass{article}\n\\begin{document}\nNested main.\n\\end{document}",
    f.hash,
  );
  await s.update(p.id, { main: f.name });
  assert.equal((await compile(s, p.id, new AbortController().signal)).ok, true);
});
test("multi-file traversal inherits section context and rejects cycles", async (t) => {
  const { s, p } = await setup(t);
  await s.createFile(p.id, "sections/body.tex");
  let main = await s.read(p.id, "main.tex");
  await s.save(
    p.id,
    "main.tex",
    "\\title{Demo}\n\\section{Method}\n\\input{sections/body}",
    main.hash,
  );
  const { collectSources } = await import("../lib/project-sources.js");
  const sources = await collectSources(s, p.id, "main.tex");
  assert.equal(sources.length, 2);
  assert.equal(sources[1].context, "Method");
  const child = await s.read(p.id, "sections/body.tex");
  await s.save(p.id, child.name, "\\input{main}", child.hash);
  await assert.rejects(collectSources(s, p.id, "main.tex"), /循环/);
});
test("merged maps retain file locations and group common sections", async () => {
  const { mergeMaps } = await import("../lib/project-sources.js");
  const base = [
    { id: "paper-root", type: "paper", label: "Demo" },
    {
      id: "sec",
      type: "section",
      parent: "paper-root",
      label: "Method",
      line: 2,
    },
    { id: "para", type: "paragraph", parent: "sec", label: "Intent", line: 4 },
  ];
  const nodes = mergeMaps(
    [
      { file: "main.tex", nodes: base, prefixLines: 0 },
      { file: "part.tex", nodes: base, prefixLines: 2 },
    ],
    "Demo",
  );
  assert.equal(nodes.filter((x) => x.type === "section").length, 1);
  assert.equal(nodes.at(-1).file, "part.tex");
  assert.equal(nodes.at(-1).line, 2);
  assert.equal(nodes.at(-1).parent, "main.tex:sec");
});
test("annotation preserves compiled prose and paragraph boundaries", async (t) => {
  const { s, p } = await setup(t);
  let f = await s.read(p.id, "main.tex");
  const src =
    "\\documentclass{article}\n\\begin{document}\n\\section{Method}\nFirst sentence. Another sentence follows.\n\nA second paragraph has $x = 2$.\n\\end{document}\n";
  await s.save(p.id, "main.tex", src, f.hash);
  const original = await compile(s, p.id, new AbortController().signal);
  const semantics = {};
  for (const para of logic.parse(src).sections.flatMap((s) => s.paragraphs))
    semantics[para.hash] = {
      label: "Intent",
      sentences: para.sentences.map(() => "Meaning"),
    };
  const generated = logic.generate(src, null, semantics);
  f = await s.read(p.id, "main.tex");
  await s.save(p.id, "main.tex", generated.annotated, f.hash);
  const annotated = await compile(s, p.id, new AbortController().signal);
  assert.equal(annotated.ok, true, annotated.log);
  const first = join(s.directory, "before.pdf"),
    second = join(s.directory, "after.pdf");
  await writeFile(first, Buffer.from(original.pdf, "base64"));
  await writeFile(second, Buffer.from(annotated.pdf, "base64"));
  const before = await run("pdftotext", [first, "-"]),
    after = await run("pdftotext", [second, "-"]);
  assert.equal(after.output, before.output);
});
