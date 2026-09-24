import { join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { readFile, realpath, mkdir, writeFile, rename, unlink, lstat } from "node:fs/promises";
import { Store, fail, digest, inside, editable } from "./lib/store.js";
import { compile, run } from "./lib/compiler.js";
import logic from "./lib/logic.cjs";
import { collectSources, mergeMaps } from "./lib/project-sources.js";
import { loadPaperInstructions } from "./lib/paper-prompt.js";
import {Credentials} from "./lib/credentials.js";
import {Overleaf} from "./lib/overleaf.js";
import {beginReview,captureReview,decideReview,reviewView,unresolved} from "./lib/revisions.js";
import {automationServer} from "./lib/automation.js";
import {verifyMindmap} from "./skills/paper-mindmap-update/verify.mjs";
export const name = "dsh-plugin-latex";
export const inject = [
  "connection",
  "agents",
  "subagents",
  "sessionProjections",
  "systemPrompt",
  "skills",
];
export async function apply(ctx, config = {}) {
  const store = await new Store(
    config.directory ||
      join(process.env.DSH_HOME || join(homedir(), ".dsh"), "latex-studio"),
  ).init();
  const credentials=config.credentials || new Credentials();
  const overleaf=new Overleaf(store,credentials);
  for(const p of store.projects) if(p.revisionReview?.active) await captureReview(store,p.id,true);
  const automationSkill=await readFile(new URL("./skills/paper-workbench/SKILL.md",import.meta.url),"utf8");
  ctx.skills.register({name:"paper-workbench",description:"论文工作台读写提案、编译与日志接口",content:automationSkill,source:"bundled"});
  const mindmapSkill = await readFile(new URL("./skills/paper-mindmap-update/SKILL.md", import.meta.url), "utf8");
  const skillDigest = digest(mindmapSkill);
  const paperClient = fileURLToPath(new URL("./scripts/paper.mjs", import.meta.url));
  ctx.skills.register({ name: "paper-mindmap-update", description: "更新 LaTeX 论文的语义注释与四级行文导图", content: mindmapSkill, source: "bundled" });
  let paperInstructions = await loadPaperInstructions(store.directory, store.projects);
  ctx.systemPrompt.variable("latex_paper_guidance", ({ agent }) => {
    if (!agent?.session?.header?.cwd) return "";
    const project = store.projects.find(p =>
      p.chats.some(c => c.id === agent.session.id) &&
      p.root === resolve(agent.session.header.cwd));
    return project ? paperInstructions + "\n\n工作台执行约束：所有 Agent 源码修改需由用户接受或拒绝后再同步；不执行 git commit/push/pull/reset，不读取凭证。工作台负责最终编译和 Overleaf 同步。用户要求生成或更新行文导图时，调用 paper-mindmap-update skill：通过 paper-workbench 的 analyze 操作启动当前论文全文分析，轮询 job 至完成并报告结果。不要手动分批改写 main.tex。工作台操作脚本绝对路径：" + paperClient : "";
  });
  ctx.systemPrompt.section({ name: "latex-paper-workbench", order: 85, text: "{{latex_paper_guidance}}" });
  const jobs = new Map(),
    owned = new Map(),
    pending = new Set();
  const publicProject = (p) => {
    const { snapshot, revisionReview, ...rest } = p;
    return { ...rest, hasMap: !!snapshot, pendingChanges:unresolved(p), agentEditing:!!revisionReview?.active };
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
  // Bound one model request to a size the model can answer exactly: sentence
  // counts drift when a single call must echo hundreds of sentences.
  function planBatches(paras, maxParas = 14, maxSentences = 48) {
    const batches = [];
    let current = [],
      sentences = 0;
    for (const para of paras) {
      if (
        current.length &&
        (current.length >= maxParas || sentences + para.sentences.length > maxSentences)
      ) {
        batches.push(current);
        current = [];
        sentences = 0;
      }
      current.push(para);
      sentences += para.sentences.length;
    }
    if (current.length) batches.push(current);
    return batches;
  }
  async function analyze(id, sessionId, signal, progress = () => {}) {
    const p = store.get(id);
    if (!p.chats.some((c) => c.id === sessionId)) fail("请选择当前论文的聊天");
    const main = p.main,
      sources = await collectSources(store, id, main),
      results = [];
    progress(
      sources.length > 1
        ? `解析完成：主文件 ${main} 及 ${sources.length - 1} 个引用文件`
        : `解析完成：${main}`,
    );
    for (const input of sources) {
      const previous =
        (p.snapshot?.skillDigest === skillDigest && p.snapshot?.files?.[input.name]) ||
        (p.snapshot?.skillDigest === skillDigest && input.name === main && p.snapshot?.sections ? p.snapshot : null);
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
        needed = [...new Map(parsed.sections
          .flatMap((s) => s.paragraphs.map(p => ({ ...p, section: s.name })))
          .filter((para) => !old.some((o) => o.hash === para.hash))
          .map(para => [para.hash, para])).values()],
        semantics = { sections: {} };
      if (needed.length) {
        progress(`分析 ${input.name}`);
        const parent = await validateChat(id, sessionId);
        const selection = ctx.sessionProjections.stateOf(
          parent.session,
          "modelSelection",
        );
        const route =
          selection?.pending || selection?.lastUsed || parent.options;
        if (!route.provider || !route.model) fail("请在论文聊天中选择模型");
        const batches = planBatches(needed);
        progress(
          `${input.name}：${parsed.sections.length} 个章节，${needed.length} 段待分析，分 ${batches.length} 批调用模型`,
        );
        let done = 0;
        for (const [index, batch] of batches.entries()) {
          const prompt = JSON.stringify({
            title: parsed.title,
            file: input.name,
            sections: [...new Set(batch.map((p) => p.section))],
            paragraphs: batch.map((p) => ({hash: p.hash, section: p.section, sentences: p.sentences})),
          });
          if (prompt.length > 100000) fail("本次分析内容较多，请拆分论文文件");
          let rows = null,
            reason = "";
          for (let attempt = 0; attempt < 3 && !rows; attempt++) {
            if (attempt) {
              signal.throwIfAborted();
              progress(
                `${input.name}：第 ${index + 1}/${batches.length} 批未通过（${reason}），正在重试`,
              );
            }
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
                prompt: [
                  { type: "text", text: mindmapSkill },
                  { type: "text", text: prompt },
                  ...(attempt
                    ? [
                        {
                          type: "text",
                          text:
                            "上一次输出未通过校验：" +
                            reason +
                            "。请逐段重新输出，每个段落的 sentences 数组长度必须与输入中该段 sentences 的长度完全一致，不得合并或拆分句子。",
                        },
                      ]
                    : []),
                ],
              }),
            );
            try {
              const result = await child.result;
              if (result.stopReason !== "completed") {
                reason = "模型输出未正常结束";
                continue;
              }
              const raw = result.output
                .filter((x) => x.type === "text")
                .map((x) => x.text)
                .join("\n");
              let data;
              try {
                try {
                  data = JSON.parse(raw.trim());
                } catch {
                  // Accept one explicit JSON block when the model adds a preface.
                  const blocks = [...raw.matchAll(/^```(?:json)?[ \t]*\r?\n([\s\S]*?)^```[ \t]*$/gm)];
                  if (blocks.length !== 1) throw new Error("Ambiguous semantic output");
                  data = JSON.parse(blocks[0][1]);
                }
                if (!data || !Array.isArray(data.paragraphs)) throw new Error("Missing paragraphs");
              } catch {
                reason = "输出不是有效的语义 JSON";
                continue;
              }
              try { verifyMindmap([{ paragraphs: batch }], data); }
              catch (e) { reason = e.message; continue; }
              const collected = Object.fromEntries(data.paragraphs.map(row => [row.hash, row]));
              for (const [name, label] of Object.entries(data.sections || {}))
                if (typeof label === "string" && label.length < 500 && !/[\r\n]/.test(label))
                  semantics.sections[name] = label;
              rows = collected;
            } finally {
              await child.dispose();
            }
          }
          if (!rows)
            fail(
              `模型分析覆盖不完整（${input.name} 第 ${index + 1}/${batches.length} 批）：${reason}，请重试`,
            );
          Object.assign(semantics, rows);
          done += batch.length;
          progress(
            `${input.name}：已完成 ${done}/${needed.length} 段`,
          );
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
    progress("全部段落校验通过，正在写入语义注释");
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
    progress(
      `写入完成：本次分析 ${stats.analyzed} 段，复用 ${stats.reused} 段`,
    );
    await store.serial(async () => {
      p.snapshot = {
        schema: 3,
        skillDigest,
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
  function idle(id) {if(store.get(id).revisionReview)fail("请先处理 Agent 修改","REVIEW_PENDING");if(jobs.get(id)?.status==="running")fail("当前论文任务正在运行","BUSY");}
  async function savedPipeline(id,paths) {
    const controller=new AbortController();
    const job={version:randomUUID(),kind:"compile",status:"running",controller};jobs.set(id,job);
    const work=(async()=>{try{
      job.result=await compile(store,id,controller.signal);
      job.result.sync=await overleaf.sync(id,paths);
      store.get(id).lastLog=job.result.log;await store.persist();
      job.status=job.result.ok===false?"failed":"completed";
    }catch(e){job.status="failed";job.error=e.message;}finally{pending.delete(work);}})();pending.add(work);
  }
  async function operation(a) {
    switch (a.action) {
      case "worker":
        return readFile(
          new URL("./dist/pdf.worker.mjs", import.meta.url),
          "utf8",
        );
      case "settings": {
        paperInstructions = await loadPaperInstructions(store.directory);
        return { instructions: paperInstructions, hash: digest(paperInstructions), credential:await credentials.status() };
      }
      case "saveSettings": {
        if (pending.has("settings")) fail("设置正在保存，请稍后重试");
        pending.add("settings");
        try {
          if (typeof a.instructions !== "string" || Buffer.byteLength(a.instructions) > 128 * 1024)
            fail("指令内容须在 128 KB 以内");
          const current = await loadPaperInstructions(store.directory);
          if (a.hash !== digest(current)) fail("设置已更新，请重新打开后编辑");
          const file = join(store.directory, "instructions", "AGENTS.md");
          const temporary = file + "." + randomUUID() + ".tmp";
          await writeFile(temporary, a.instructions, { mode: 0o600, flag: "wx" });
          await rename(temporary, file);
          paperInstructions = a.instructions;
          return { instructions: paperInstructions, hash: digest(paperInstructions), credential:await credentials.status() };
        } finally { pending.delete("settings"); }
      }
      case "credential": return a.token ? credentials.set(a.token) : a.remove ? credentials.remove() : credentials.status();
      case "clone": return publicProject(await overleaf.clone(a.name,a.url));
      case "status": {const p=store.get(a.id);return {review:reviewView(p),sync:p.sync||null,project:publicProject(p)};}
      case "logs": {const p=store.get(a.id),j=jobs.get(a.id);return {compile:j?.result?.log||j?.error||p.lastLog||"",sync:p.sync||null};}
      case "sync": idle(a.id);return overleaf.sync(a.id,store.get(a.id).syncPaths||[]);
      case "propose": {
        idle(a.id);const p=store.get(a.id),files=a.files || [{file:a.file,hash:a.hash,content:a.content}];
        if(!Array.isArray(files)||!files.length||files.length>100)fail("提案文件数量须为 1 至 100");
        const seen=new Set();
        for(const f of files){
          if(seen.has(f.file)||!editable(f.file)||f.content!==null && (typeof f.content!=="string"||Buffer.byteLength(f.content)>2*1024*1024))fail("无效的提案文件");seen.add(f.file);
          await inside(p.root,f.file,true);
          let current;try{current=await store.read(a.id,f.file);}catch(e){if(e.code!=="ENOENT")throw e;}
          if((current?.hash??null)!==f.hash)fail("文件版本已变化："+f.file,"CONFLICT");
        }
        await beginReview(store,a.id,"external");
        try {for(const f of files){
          if(f.content===null)await unlink(await inside(p.root,f.file));
          else {if(f.hash===null)await store.createFile(a.id,f.file);await store.save(a.id,f.file,f.content,f.hash??digest(""));}
        }}finally{await captureReview(store,a.id,true);}
        return reviewView(p);
      }
      case "decide": {
        const result=await decideReview(store,a.id,a);
        if(result.settled && config.pipeline!==false) await savedPipeline(a.id,result.paths);
        return {review:reviewView(store.get(a.id)),...result};
      }
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
      case "asset": {
        const p = store.get(a.id);
        const ext = a.file?.split(".").at(-1)?.toLowerCase();
        const mime = { png:"image/png", jpg:"image/jpeg", jpeg:"image/jpeg", gif:"image/gif", webp:"image/webp", avif:"image/avif", svg:"image/svg+xml", pdf:"application/pdf" }[ext];
        const path = await inside(p.root, a.file);
        const stat = await lstat(path);
        if (!stat.isFile()) fail("素材不是普通文件");
        if (!mime || stat.size > 16 * 1024 * 1024) return { name:a.file, mime:null, size:stat.size };
        return { name:a.file, mime, size:stat.size, data:(await readFile(path)).toString("base64") };
      }
      case "save": {
        idle(a.id);const result=await store.save(a.id,a.file,a.content,a.hash);
        if(config.pipeline!==false)await savedPipeline(a.id,[a.file]);return result;
      }
      case "createFile":
        idle(a.id);return store.createFile(a.id, a.file);
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
              log: j.log?.slice(-80),
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
        if(a.action === "analyze") {
          const owner = store.get(a.id).revisionReview?.owner;
          if (owner === "chat:" + (a.sessionId || store.get(a.id).lastChat)) await captureReview(store,a.id,true);
          await beginReview(store,a.id,"mindmap");
        }
        const controller = new AbortController(),
          job = {
            version: randomUUID(),
            kind: a.action,
            sessionId: a.sessionId || store.get(a.id).lastChat,
            status: "running",
            controller,
            log: [],
          };
        const progress = (message) => {
          job.log.push({ time: Date.now(), message });
          if (job.log.length > 200) job.log.splice(0, job.log.length - 200);
        };
        jobs.set(a.id, job);
        const timer = setTimeout(
          () => controller.abort(),
          a.action === "compile" ? 125000 : 600000,
        );
        const promise = (
          a.action === "compile"
            ? compile(store, a.id, controller.signal)
            : analyze(a.id, a.sessionId || store.get(a.id).lastChat, controller.signal, progress)
        )
          .then(async (result) => {
            if(a.action === "analyze") await captureReview(store,a.id,true);
            job.result = result;
            if(result.log){store.get(a.id).lastLog=result.log;void store.persist();}
            job.status = result.ok === false ? "failed" : "completed";
          })
          .catch(async (e) => {
            if(a.action === "analyze") await captureReview(store,a.id,true);
            job.status = "failed";
            job.error = e.message;
            progress("分析失败：" + e.message);
          })
          .finally(async () => {
            clearTimeout(timer);
            pending.delete(promise);
          });
        pending.add(promise);
        if(a.action === "analyze") progress("已启动行文导图分析");
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
    const project=store.projects.find(p=>p.chats.some(c=>c.id===agent.session.id) && p.root===resolve(agent.session.header.cwd));
    if(project) {
      const job = jobs.get(project.id);
      const reportingMindmap = job?.kind === "analyze" && job.sessionId === agent.session.id &&
        (job.status === "running" || project.revisionReview?.owner === "mindmap");
      if (!reportingMindmap) {
        if(job?.status === "running")return {kind:"reject"};
        try {await beginReview(store,project.id,"chat:"+agent.session.id);} catch {return {kind:"reject"};}
      }
    }
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
  const projectFor=agent=>store.projects.find(p=>agent?.session?.header?.cwd && p.root===resolve(agent.session.header.cwd) && p.revisionReview?.active && p.revisionReview.owner.startsWith("chat:"));
  ctx.on("tools/pre-execute",async(exec,next)=>{
    const mapping = store.projects.find(p => p.chats.some(c => c.id === exec.agent?.session?.id) &&
      p.revisionReview?.owner === "mindmap");
    if (mapping) return {kind:"deny",reason:"导图注释正在生成或等待审阅，请报告当前结果，待用户处理后继续修改。"};
    const p=projectFor(exec.agent);
    if(p && /\bgit\b[\s\S]*\b(push|commit|reset|pull)\b/.test(JSON.stringify(exec.arguments?.cmd || exec.arguments?.command || exec.arguments?.code || exec.arguments?.script || "")))return {kind:"deny",reason:"论文 Git 同步由工作台在审阅结束后执行"};
    return next();
  });
  ctx.on("tools/post-execute",async(exec,result,next)=>{const p=projectFor(exec.agent);if(p)await captureReview(store,p.id);return next();});
  ctx.on("session/event",(session,event)=>{
    if(event.type!=="turn/end")return;
    const p=store.projects.find(p=>p.revisionReview?.active && p.revisionReview.owner==="chat:"+session.id);
    if(p){const work=captureReview(store,p.id,true).finally(()=>pending.delete(work));pending.add(work);}
  });
  let closeAutomation;
  if(config.automation!==false) closeAutomation=await automationServer(store.directory,async a=>{
    if(!["list","open","read","propose","compile","analyze","job","logs","status","map","pdf"].includes(a.action))fail("外部接口不支持此操作","FORBIDDEN");
    return operation(a);
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
    if(closeAutomation)await closeAutomation();
    for (const j of jobs.values()) j.controller.abort();
    await Promise.allSettled([...pending]);
    for (const h of owned.values()) await h.dispose();
  });
}
