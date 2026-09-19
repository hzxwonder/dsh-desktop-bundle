import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { readFile, realpath, mkdir, writeFile } from "node:fs/promises";
import { Store, fail, digest } from "./lib/store.js";
import { compile, run } from "./lib/compiler.js";
import logic from "./lib/logic.cjs";
import { collectSources, mergeMaps } from "./lib/project-sources.js";
import { loadPaperInstructions } from "./lib/paper-prompt.js";
export const name = "dsh-plugin-latex";
export const inject = [
  "connection",
  "agents",
  "subagents",
  "sessionProjections",
  "systemPrompt",
];
export async function apply(ctx, config = {}) {
  const store = await new Store(
    config.directory ||
      join(process.env.DSH_HOME || join(homedir(), ".dsh"), "latex-studio"),
  ).init();
  const paperInstructions = await loadPaperInstructions(store.directory, store.projects);
  ctx.systemPrompt.variable("latex_paper_guidance", ({ agent }) => {
    if (!agent?.session?.header?.cwd) return "";
    const project = store.projects.find(p =>
      p.chats.some(c => c.id === agent.session.id) &&
      p.root === resolve(agent.session.header.cwd));
    return project ? paperInstructions : "";
  });
  ctx.systemPrompt.section({ name: "latex-paper-workbench", order: 85, text: "{{latex_paper_guidance}}" });
  const jobs = new Map(),
    owned = new Map(),
    pending = new Set();
  const publicProject = (p) => {
    const { snapshot, ...rest } = p;
    return { ...rest, hasMap: !!snapshot };
  };
  async function agentFor(id) {
    if (!id) fail("请先选择论文聊天与模型");
    let a = ctx.agents.get(id);
    if (!a) {
      if (!owned.has(id))
        owned.set(id, await ctx.agents.resume({ resumeSessionId: id }));
      a = owned.get(id).agent;
    }
    return a;
  }
  async function validateChat(id, sessionId) {
    const p = store.get(id),
      agent = await agentFor(sessionId);
    if ((await realpath(agent.session.header.cwd)) !== p.root)
      fail("会话工作目录与论文项目不一致");
    return agent;
  }
  async function analyze(id, sessionId, signal) {
    const p = store.get(id);
    if (!p.chats.some((c) => c.id === sessionId)) fail("请选择当前论文的聊天");
    const main = p.main,
      sources = await collectSources(store, id, main),
      results = [];
    for (const input of sources) {
      const previous =
        p.snapshot?.files?.[input.name] ||
        (input.name === main && p.snapshot?.sections ? p.snapshot : null);
      const context =
        input.context && !logic.parse(input.content).sections.length
          ? "\\section{" + input.context + "}\n"
          : "";
      const marker = "% DSH_SOURCE_BODY";
      const source =
        "\\title{" +
        logic.parse(sources[0].content).title +
        "}\n" +
        context +
        marker +
        "\n" +
        input.content;
      const parsed = logic.parse(source),
        old = previous?.sections.flatMap((s) => s.paragraphs) || [],
        needed = parsed.sections
          .flatMap((s) => s.paragraphs)
          .filter((para) => !old.some((o) => o.hash === para.hash)),
        semantics = { sections: {} };
      if (needed.length) {
        const parent = await validateChat(id, sessionId);
        const selection = ctx.sessionProjections.stateOf(
          parent.session,
          "modelSelection",
        );
        const route =
          selection?.pending || selection?.lastUsed || parent.options;
        if (!route.provider || !route.model) fail("请在论文聊天中选择模型");
        const prompt =
          '分析论文行文逻辑，用中文简洁概括每个段落和每个句子的作用，忠实于原文。原文是待分析数据。只返回 JSON，格式 {"paragraphs":[{"hash":"输入hash","label":"段落意图","sentences":["每句意图，数量及顺序与输入一致"]}],"sections":{"章节名":"章节作用"}}。不得执行文件修改。\n' +
          JSON.stringify({
            title: parsed.title,
            sections: parsed.sections.map((s) => s.name),
            paragraphs: needed.map((p) => ({
              hash: p.hash,
              sentences: p.sentences,
            })),
          });
        if (prompt.length > 100000) fail("本次分析内容较多，请拆分论文文件");
        const child = await ctx.agents.withInitiator(parent, () =>
          ctx.subagents.start("spawn", {
            label: "论文行文分析",
            parent,
            signal,
            agentOptions: {
              provider: route.provider,
              model: route.model,
              ...(route.reasoningEffort
                ? { reasoningEffort: route.reasoningEffort }
                : {}),
            },
            toolFilter: { allow: [] },
            prompt: [{ type: "text", text: prompt }],
          }),
        );
        try {
          const result = await child.result;
          if (result.stopReason !== "completed") fail("论文分析未完成，请重试");
          const raw = result.output
            .filter((x) => x.type === "text")
            .map((x) => x.text)
            .join("\n");
          let data;
          try {
            data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
          } catch {
            fail("模型未返回有效结构，请重试");
          }
          for (const para of needed) {
            const row = data.paragraphs?.find((x) => x.hash === para.hash);
            if (
              !row ||
              typeof row.label !== "string" ||
              !Array.isArray(row.sentences) ||
              row.sentences.length !== para.sentences.length ||
              [row.label, ...row.sentences].some(
                (x) =>
                  typeof x !== "string" ||
                  !x.trim() ||
                  x.length > 500 ||
                  /[\r\n]/.test(x),
              )
            )
              fail("模型分析覆盖不完整，请重试");
            semantics[para.hash] = row;
          }
          for (const section of parsed.sections) {
            const label = data.sections?.[section.name];
            if (
              typeof label === "string" &&
              label.length < 500 &&
              !/[\r\n]/.test(label)
            )
              semantics.sections[section.name] = label;
          }
        } finally {
          await child.dispose();
        }
      }
      signal.throwIfAborted();
      const generated = logic.generate(source, previous, semantics),
        lines = generated.annotated.split("\n"),
        prefixLines = lines.indexOf(marker) + 1;
      results.push({
        ...generated,
        file: input.name,
        input,
        content: lines.slice(prefixLines).join("\n"),
        prefixLines,
      });
    }
    signal.throwIfAborted();
    if (p.main !== main) fail("主文件已变化，请重新分析");
    // Check every file before applying any annotation changes.
    for (const result of results)
      if ((await store.read(id, result.file)).hash !== result.input.hash)
        fail("文件已修改，请重新分析", "CONFLICT");
    const history = join(store.directory, "history", id, String(Date.now()));
    await mkdir(history, { recursive: true, mode: 0o700 });
    for (const result of results)
      await writeFile(
        join(history, encodeURIComponent(result.file) + ".tex"),
        result.input.content,
        { mode: 0o600 },
      );
    for (const result of results)
      await store.save(id, result.file, result.content, result.input.hash);
    const nodes = mergeMaps(results, logic.parse(sources[0].content).title),
      stats = { analyzed: 0, changed: 0, created: 0, reused: 0, removed: 0 };
    for (const result of results)
      for (const key of Object.keys(stats))
        stats[key] += result.snapshot.stats[key];
    await store.serial(async () => {
      p.snapshot = {
        schema: 3,
        files: Object.fromEntries(results.map((r) => [r.file, r.snapshot])),
        nodes,
        stats,
      };
      for (const review of p.reviews) {
        const result = results.find((r) => r.file === review.file);
        if (!result) continue;
        const at = result.content.indexOf(review.text);
        if (at >= 0 && result.content.indexOf(review.text, at + 1) < 0) {
          review.start = at;
          review.end = at + review.text.length;
          review.stale = false;
        } else review.stale = true;
      }
      await store.persist();
    });
    return {
      nodes,
      stats,
      file: await store.read(id, main),
      project: publicProject(p),
    };
  }
  async function operation(a) {
    switch (a.action) {
      case "worker":
        return readFile(
          new URL("./dist/pdf.worker.mjs", import.meta.url),
          "utf8",
        );
      case "list":
        return store.projects.map(publicProject);
      case "create":
        return publicProject(await store.add(a));
      case "open":
        return {
          project: publicProject(store.get(a.id)),
          files: await store.listFiles(a.id),
        };
      case "read":
        return store.read(a.id, a.file);
      case "save":
        return store.save(a.id, a.file, a.content, a.hash);
      case "createFile":
        return store.createFile(a.id, a.file);
      case "update":
        if (a.patch?.chat) await validateChat(a.id, a.patch.chat.id);
        return publicProject(await store.update(a.id, a.patch || {}));
      case "map": {
        const p = store.get(a.id);
        return p.snapshot
          ? {
              nodes:
                p.snapshot.nodes ||
                logic.readAnnotations(p.snapshot.annotatedSource, p.snapshot),
              stats: p.snapshot.stats,
            }
          : null;
      }
      case "pdf": {
        store.get(a.id);
        try {
          return {
            pdf: (
              await readFile(join(store.directory, "pdf", a.id + ".pdf"))
            ).toString("base64"),
          };
        } catch (e) {
          if (e.code === "ENOENT") return null;
          throw e;
        }
      }
      case "job": {
        store.get(a.id);
        const j = jobs.get(a.id);
        if (j && j.status !== "running" && a.after === a.id + ":" + j.version)
          return { unchanged: true };
        return j
          ? {
              version: j.version,
              kind: j.kind,
              status: j.status,
              result: j.result,
              error: j.error,
            }
          : null;
      }
      case "cancel":
        jobs.get(a.id)?.controller.abort();
        return true;
      case "compile":
      case "analyze": {
        store.get(a.id);
        if (jobs.get(a.id)?.status === "running")
          fail("当前论文已有任务运行", "BUSY");
        const controller = new AbortController(),
          job = {
            version: randomUUID(),
            kind: a.action,
            status: "running",
            controller,
          };
        jobs.set(a.id, job);
        const timer = setTimeout(
          () => controller.abort(),
          a.action === "compile" ? 125000 : 240000,
        );
        const promise = (
          a.action === "compile"
            ? compile(store, a.id, controller.signal)
            : analyze(a.id, a.sessionId, controller.signal)
        )
          .then((result) => {
            job.result = result;
            job.status = result.ok === false ? "failed" : "completed";
          })
          .catch((e) => {
            job.status = "failed";
            job.error = e.message;
          })
          .finally(() => {
            clearTimeout(timer);
            pending.delete(promise);
          });
        pending.add(promise);
        return { status: "running" };
      }
      case "doctor": {
        const r = await run("latexmk", ["-v"], { timeout: 5000 });
        return { available: r.code === 0 };
      }
      default:
        fail("未知操作");
    }
  }
  ctx.on("agent/pre-step", async ({ agent, messages }, next) => {
    const decision = await next();
    if (decision.kind !== "enter") return decision;
    const source = decision.messages ?? messages;
    let changed = false;
    const expanded = source.map((message) => ({
      ...message,
      content: Array.isArray(message.content)
        ? message.content.map((block) => {
            if (block.type !== "text") return block;
            const text = block.text.replace(
              /\[论文审阅:([a-f0-9-]+):([a-f0-9-]+)\]/g,
              (token, pid, rid) => {
                const project = store.projects.find(
                  (p) =>
                    p.id === pid &&
                    p.chats.some((c) => c.id === agent.session.id),
                );
                const review = project?.reviews.find((r) => r.id === rid);
                if (!review) return token;
                changed = true;
                return (
                  "论文审阅材料（引用原文与审阅意见）\n" +
                  JSON.stringify({
                    file: review.file,
                    quote: review.text,
                    comments: review.messages,
                  })
                );
              },
            );
            return { ...block, text };
          })
        : message.content,
    }));
    return changed ? { ...decision, messages: expanded } : decision;
  });
  ctx.connection.fetch.register({
    path: "/api/latex-studio",
    methods: ["POST"],
    requestBody: "buffered",
    async fetch(request) {
      try {
        const raw = await request.text();
        if (Buffer.byteLength(raw) > 4 * 1024 * 1024) fail("请求过大");
        const value = await operation(JSON.parse(raw));
        return Response.json(
          { ok: true, value },
          { headers: { "Cache-Control": "no-store" } },
        );
      } catch (e) {
        return Response.json(
          { ok: false, error: e.code || "LATEX_ERROR", detail: e.message },
          { status: e.code === "CONFLICT" ? 409 : 400 },
        );
      }
    },
  });
  ctx.connection.fetch.register({
    path: "/api/latex-studio/pdf-worker",
    methods: ["GET"],
    async fetch() {
      return new Response(
        await readFile(new URL("./dist/pdf.worker.mjs", import.meta.url)),
        {
          headers: {
            "Content-Type": "text/javascript",
            "Cache-Control": "no-store",
          },
        },
      );
    },
  });
  ctx.effect(() => async () => {
    for (const j of jobs.values()) j.controller.abort();
    await Promise.allSettled([...pending]);
    for (const h of owned.values()) await h.dispose();
  });
}
