import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apply } from "../index.js";
import { verifyMindmap, verifySourceConsistency } from "../skills/paper-mindmap-update/verify.mjs";
async function host(t, outputOverride) {
  const directory = await mkdtemp(join(tmpdir(), "latex-host-"));
  let hook, dispose;
  const events=new Map();
  const variables = new Map(), sections = [];
  const routes = new Map(),
    agents = new Map();
  let modelCalls = 0;
  const skills = new Map(), prompts = [];
  const ctx = {
    skills: { register: skill => skills.set(skill.name, skill) },
    systemPrompt: { variable: (name, fn) => variables.set(name, fn), section: value => sections.push(value) },
    connection: { fetch: { register: (r) => routes.set(r.path, r) } },
    agents: {
      withInitiator: async (a, fn) => fn(),
      get: (id) => agents.get(id),
      resume: async () => {
        throw Error("Unknown session");
      },
    },
    subagents: {
      start: async (mode, args) => {
        modelCalls++;
        prompts.push(args.prompt);
        assert.equal(args.prompt[0].text, skills.get("paper-mindmap-update").content);
        const data = JSON.parse(args.prompt[1].text);
        assert.ok(data.paragraphs.every(p => typeof p.section === "string"));
        return {
          result: Promise.resolve({
            stopReason: "completed",
            output: [
              {
                type: "text",
                text: typeof outputOverride === "function" ? outputOverride(data) : outputOverride ?? JSON.stringify({
                  paragraphs: data.paragraphs.map((p) => ({
                    hash: p.hash,
                    label: "Fixture paragraph intent",
                    sentences: p.sentences.map(() => "Fixture sentence intent"),
                  })),
                  sections: {},
                }),
              },
            ],
          }),
          dispose: async () => {},
        };
      },
    },
    sessionProjections: {
      stateOf: () => ({ pending: { provider: "fixture", model: "fixture" } }),
    },
    on: (n, fn) => {
      events.set(n,fn);
      if(n === "agent/pre-step") hook = fn;
    },
    effect: (fn) => {
      dispose = fn();
    },
  };
  await apply(ctx, { directory, automation:false, pipeline:false });
  t.after(async () => {
    await dispose();
    await rm(directory, { recursive: true, force: true });
  });
  const request = async (body) => {
    const r = await routes.get("/api/latex-studio").fetch(
      new Request("http://localhost/api/latex-studio", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
    return r.json();
  };
  return { request, agents, hook, events, variables, sections, calls: () => modelCalls };
}
test("Host routes report errors and fence conversation roots", async (t) => {
  const h = await host(t),
    p = (await h.request({ action: "create", name: "Host Demo" })).value;
  h.agents.set("wrong", {
    session: { id: "wrong", header: { cwd: tmpdir() } },
  });
  const denied = await h.request({
    action: "update",
    id: p.id,
    patch: { chat: { id: "wrong", title: "Wrong" } },
  });
  assert.equal(denied.ok, false);
  assert.match(denied.detail, /工作目录/);
  assert.equal(
    (await h.request({ action: "open", id: p.id })).value.project.chats.length,
    0,
  );
  assert.equal((await h.request({ action: "unknown" })).ok, false);
});
test("project assets are available for safe read-only preview", async (t) => {
  const h = await host(t);
  const p = (await h.request({ action:"create", name:"Asset Demo" })).value;
  await writeFile(join(p.root, "figure.png"), Buffer.from("89504e470d0a1a0a", "hex"));
  await writeFile(join(p.root, "diagram.eps"), "EPS data");
  const image = await h.request({ action:"asset", id:p.id, file:"figure.png" });
  assert.equal(image.value.mime, "image/png");
  assert.equal(image.value.data, "iVBORw0KGgo=");
  const fallback = await h.request({ action:"asset", id:p.id, file:"diagram.eps" });
  assert.equal(fallback.value.mime, null);
  assert.equal(fallback.value.size, 8);
  assert.equal((await h.request({ action:"asset", id:p.id, file:"../figure.png" })).ok, false);
});
test("mindmap verification rejects duplicate and incomplete semantic rows", () => {
  const batch = [{ paragraphs:[{ hash:"a", sentences:["one", "two"] }] }];
  assert.equal(verifyMindmap(batch, { paragraphs:[{ hash:"a", label:"作用", sentences:["一", "二"] }] }), true);
  assert.throws(() => verifyMindmap(batch, { paragraphs:[] }), /段落覆盖不完整/);
  assert.throws(() => verifyMindmap(batch, { paragraphs:[{ hash:"a", label:"作用", sentences:["一"] }] }), /句子数量不匹配/);
});
test("source consistency allows annotation comments but rejects any TeX edits", () => {
  assert.throws(() => verifySourceConsistency("A sentence.\nNext.", "% @p:段落作用\nA sentence. \n% @s:句子作用\nNext. ", "main.tex"), /main.tex.*正文字符/);
  assert.throws(() => verifySourceConsistency("A sentence.", "% @p:段落作用\nA changed sentence.", "main.tex"), /main.tex.*正文字符/);
});
test("review material expands only for bound sessions", async (t) => {
  const h = await host(t),
    p = (await h.request({ action: "create", name: "Review Demo" })).value;
  const a = { session: { id: "demo", header: { cwd: p.root } } };
  h.agents.set("demo", a);
  const review = {
    id: "abcdefab",
    file: "main.tex",
    text: "Quoted sentence",
    start: 0,
    end: 15,
    messages: ["Clarify evidence"],
  };
  assert.equal(
    (
      await h.request({
        action: "update",
        id: p.id,
        patch: { chat: { id: "demo", title: "Demo" }, reviews: [review] },
      })
    ).ok,
    true,
  );
  const token = "[论文审阅:" + p.id + ":abcdefab]",
    messages = [{ role: "user", content: [{ type: "text", text: token }] }];
  const result = await h.hook({ agent: a, messages }, async () => ({
    kind: "enter",
  }));
  assert.match(result.messages[0].content[0].text, /Clarify evidence/);
  const unrelated = await h.hook(
    { agent: { session: { id: "other" } }, messages },
    async () => ({ kind: "enter" }),
  );
  assert.equal(unrelated.messages, undefined);
});
test("public project responses keep semantic snapshots internal", async (t) => {
  const h = await host(t);
  await h.request({ action: "create", name: "Demo" });
  const list = await h.request({ action: "list" });
  assert.equal("snapshot" in list.value[0], false);
  assert.equal(list.value[0].hasMap, false);
});

test("multi-file analysis annotates source files and reuses all unchanged paragraphs", async (t) => {
  const h = await host(t),
    p = (await h.request({ action: "create", name: "Multi-file Demo" })).value;
  h.agents.set("demo", { session: { id: "demo", header: { cwd: p.root } } });
  await h.request({
    action: "update",
    id: p.id,
    patch: { chat: { id: "demo", title: "Demo" } },
  });
  await h.request({ action: "createFile", id: p.id, file: "body.tex" });
  let f = (await h.request({ action: "read", id: p.id, file: "body.tex" }))
    .value;
  await h.request({
    action: "save",
    id: p.id,
    file: f.name,
    hash: f.hash,
    content: "First sentence. Second sentence.\n",
  });
  f = (await h.request({ action: "read", id: p.id, file: "main.tex" })).value;
  await h.request({
    action: "save",
    id: p.id,
    file: f.name,
    hash: f.hash,
    content: "\\title{Demo}\n\\section{Method}\n\\input{body}\n",
  });
  async function analyze() {
    await h.request({ action: "analyze", id: p.id, sessionId: "demo" });
    for (let i = 0; i < 100; i++) {
      const job = (await h.request({ action: "job", id: p.id })).value;
      if (job.status !== "running") {
        assert.equal(job.status, "completed", job.error);
        assert.deepEqual(
          (
            await h.request({
              action: "job",
              id: p.id,
              after: p.id + ":" + job.version,
            })
          ).value,
          { unchanged: true },
        );
        const state=(await h.request({action:"status",id:p.id})).value;
        if(state.review) assert.equal((await h.request({action:"decide",id:p.id,batchId:state.review.id,decision:"accept"})).ok,true);
        return job.result;
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.fail("Job did not finish");
  }
  const first = await analyze();
  assert.equal((await h.request({action:"status",id:p.id})).value.review, null);
  assert.equal(first.stats.analyzed, 1);
  assert.equal(first.nodes.filter((n) => n.type === "sentence").length, 2);
  assert.ok(
    first.nodes.some((n) => n.type === "paragraph" && n.file === "body.tex"),
  );
  const callCountAfterFirst = h.calls();
  const rendered = await h.request({action:"rerender",id:p.id});
  assert.equal(rendered.ok, true);
  assert.deepEqual(rendered.value.nodes.map(n => [n.type, n.label, n.file, n.line]), first.nodes.map(n => [n.type, n.label, n.file, n.line]));
  assert.equal(rendered.value.nodes.some(n => n.id === n.parent), false);
  assert.equal(h.calls(), callCountAfterFirst);
  assert.equal(first.nodes[0].label, "Demo");
  const body = (await h.request({ action: "read", id: p.id, file: "body.tex" }))
    .value.content;
  assert.match(body, /% @p:Fixture paragraph intent/);
  assert.doesNotMatch(body, /DSH_SOURCE_BODY|\\section|\\title/);
  const calls = h.calls(),
    second = await analyze();
  assert.equal(second.stats.analyzed, 0);
  assert.equal(h.calls(), calls);
  const edited = (await h.request({action:"read",id:p.id,file:"body.tex"})).value;
  await h.request({action:"save",id:p.id,file:"body.tex",hash:edited.hash,content:edited.content.replace("First sentence.","Revised first sentence.")});
  const third = await analyze();
  assert.equal(third.stats.analyzed, 1);
  assert.equal(h.calls(), calls + 1);
  const updated = (await h.request({action:"read",id:p.id,file:"body.tex"})).value;
  assert.match(updated.content, /Revised first sentence/);
  assert.match(updated.content, /% @s:Fixture sentence intent/);
});

test("paper system guidance is restricted to bound project sessions", async t => {
  const h = await host(t);
  const p = (await h.request({ action: "create", name: "Paper prompt fixture" })).value;
  const agent = { session: { id: "paper-guidance", header: { cwd: p.root } } };
  h.agents.set(agent.session.id, agent);
  const render = h.variables.get("latex_paper_guidance");
  assert.equal(render({agent}), "");
  await h.request({ action: "update", id: p.id, patch: { chat: { id: agent.session.id, title: "Paper" } } });
  assert.match(render({agent}), /Overleaf/);

  assert.equal(render({}), "");
  assert.equal(render({agent: {session: {id: "other", header: {cwd: p.root}}}}), "");
  assert.equal(render({agent: {session: {id: agent.session.id, header: {cwd: tmpdir()}}}}), "");
  assert.equal(h.sections.find(s => s.name === "latex-paper-workbench").text, "{{latex_paper_guidance}}");
});

test("paper instructions stay outside project files", async t => {
  const h = await host(t);
  const p = (await h.request({action:"create",name:"Workspace rules"})).value;
  const opened = (await h.request({action:"open",id:p.id})).value;
  assert.ok(!opened.files.some(file => file.name === "AGENTS.md"));
  await assert.rejects(readFile(join(p.root,"AGENTS.md")), {code:"ENOENT"});
});

test("invalid semantic output leaves paper source and map unchanged", async t => {
  for (const output of ['not-json', 'null', '```json\n{}\n```\n```json\n{}\n```', JSON.stringify({paragraphs:[],sections:{}})]) {
    const h = await host(t, output);
    const p = (await h.request({action:"create",name:"Invalid analysis"})).value;
    const agent = {session:{id:"analysis",header:{cwd:p.root}}};
    h.agents.set(agent.session.id, agent);
    await h.request({action:"update",id:p.id,patch:{chat:{id:agent.session.id,title:"Analysis"}}});
    const before = (await h.request({action:"read",id:p.id,file:"main.tex"})).value;
    await h.request({action:"analyze",id:p.id,sessionId:agent.session.id});
    let job;
    for(let i=0;i<100;i++) {
      job=(await h.request({action:"job",id:p.id})).value;
      if(job.status!=="running") break;
      await new Promise(r=>setTimeout(r,10));
    }
    assert.equal(job.status,"failed");
    assert.match(job.error,/模型/);
    assert.equal((await h.request({action:"read",id:p.id,file:"main.tex"})).value.hash,before.hash);
    assert.equal((await h.request({action:"open",id:p.id})).value.project.hasMap,false);
  }
});


test("semantic JSON block accepts a model preface", async t => {
  const h = await host(t, data => "Analysis complete.\n\n```json\n" + JSON.stringify({paragraphs:data.paragraphs.map(p=>({hash:p.hash,label:"Paragraph intent",sentences:p.sentences.map(()=>"Sentence intent")})),sections:{}}) + "\n```");
  const p=(await h.request({action:"create",name:"Model format fixture"})).value;
  const agent={session:{id:"analysis",header:{cwd:p.root}}};
  h.agents.set(agent.session.id,agent);
  await h.request({action:"update",id:p.id,patch:{chat:{id:agent.session.id,title:"Analysis"}}});
  await h.request({action:"analyze",id:p.id,sessionId:agent.session.id});
  let job;
  for(let i=0;i<100;i++) {
    job=(await h.request({action:"job",id:p.id})).value;
    if(job.status!=="running") break;
    await new Promise(r=>setTimeout(r,10));
  }
  assert.equal(job.status,"completed");
  assert.equal((await h.request({action:"open",id:p.id})).value.project.hasMap,true);
});

test("sentence-count mismatch retries the batch and streams progress", async t => {
  let call = 0;
  const h = await host(t, data => {
    call++;
    const wrong = call === 1;
    return JSON.stringify({
      paragraphs: data.paragraphs.map(p => ({
        hash: p.hash,
        label: "Paragraph intent",
        sentences: wrong ? [...p.sentences.map(() => "Sentence intent"), "Extra sentence"] : p.sentences.map(() => "Sentence intent"),
      })),
      sections: {},
    });
  });
  const p=(await h.request({action:"create",name:"Retry fixture"})).value;
  const agent={session:{id:"analysis",header:{cwd:p.root}}};
  h.agents.set(agent.session.id,agent);
  await h.request({action:"update",id:p.id,patch:{chat:{id:agent.session.id,title:"Analysis"}}});
  await h.request({action:"analyze",id:p.id,sessionId:agent.session.id});
  let job;
  for(let i=0;i<100;i++) {
    job=(await h.request({action:"job",id:p.id})).value;
    if(job.status!=="running") break;
    await new Promise(r=>setTimeout(r,10));
  }
  assert.equal(job.status,"completed", job.error);
  assert.equal(call, 2);
  assert.ok(Array.isArray(job.log) && job.log.length >= 2);
  assert.ok(job.log.some(l => /重试/.test(l.message)));
  assert.ok(job.log.some(l => /已完成/.test(l.message)));
});

test("large papers are split across bounded model batches", async t => {
  const h = await host(t);
  const p=(await h.request({action:"create",name:"Batch fixture"})).value;
  const body = Array.from({length: 40}, (_, i) => `Paragraph ${i} opens the argument. Paragraph ${i} closes the argument.`).join("\n\n");
  await h.request({action:"save",id:p.id,file:"main.tex",hash:(await h.request({action:"read",id:p.id,file:"main.tex"})).value.hash,
    content:"\\title{Demo}\n\\begin{document}\n\\section{Intro}\n" + body + "\n\\end{document}\n"});
  const agent={session:{id:"analysis",header:{cwd:p.root}}};
  h.agents.set(agent.session.id,agent);
  await h.request({action:"update",id:p.id,patch:{chat:{id:agent.session.id,title:"Analysis"}}});
  await h.request({action:"analyze",id:p.id,sessionId:agent.session.id});
  let job;
  for(let i=0;i<200;i++) {
    job=(await h.request({action:"job",id:p.id})).value;
    if(job.status!=="running") break;
    await new Promise(r=>setTimeout(r,10));
  }
  assert.equal(job.status,"completed", job.error);
  assert.ok(h.calls() >= 3, "expected at least three batches, got " + h.calls());
  assert.ok(job.log.some(l => /分 3 批/.test(l.message)), job.log?.map(l=>l.message).join(" | "));
  assert.equal(job.result.stats.created >= 40, true);
});

test("global instructions persist and apply to subsequent paper prompts", async t => {
  const h=await host(t);
  const p=(await h.request({action:"create",name:"Settings fixture"})).value;
  const agent={session:{id:"settings-chat",header:{cwd:p.root}}};
  h.agents.set(agent.session.id,agent);
  await h.request({action:"update",id:p.id,patch:{chat:{id:agent.session.id,title:"Paper"}}});
  const config=(await h.request({action:"settings"})).value;
  const updated=await h.request({action:"saveSettings",hash:config.hash,instructions:"# Paper guidance\nPreserve citations."});
  assert.equal(updated.ok,true);
  assert.match(h.variables.get("latex_paper_guidance")({agent}),/^# Paper guidance\nPreserve citations\./);
  assert.equal((await h.request({action:"settings"})).value.instructions,updated.value.instructions);
  assert.equal((await h.request({action:"saveSettings",hash:config.hash,instructions:"stale"})).ok,false);
  assert.equal((await h.request({action:"saveSettings",hash:updated.value.hash,instructions:"x".repeat(131073)})).ok,false);
  await assert.rejects(readFile(join(p.root,"AGENTS.md")),{code:"ENOENT"});
});


test("mindmap launched from a chat can report results while source awaits review",async t=>{
 const h=await host(t),p=(await h.request({action:"create",name:"Chat mindmap"})).value;
 const agent={session:{id:"map-chat",header:{cwd:p.root}}};h.agents.set(agent.session.id,agent);
 await h.request({action:"update",id:p.id,patch:{chat:{id:agent.session.id,title:"Paper"}}});
 await h.hook({agent,messages:[]},async()=>({kind:"enter"}));
 assert.equal((await h.request({action:"analyze",id:p.id})).ok,true);
 let job;
 for(let i=0;i<100;i++){job=(await h.request({action:"job",id:p.id})).value;if(job.status!=="running")break;await new Promise(r=>setTimeout(r,10));}
 assert.equal(job.status,"completed");
 assert.equal((await h.hook({agent,messages:[]},async()=>({kind:"enter"}))).kind,"enter");
 assert.equal((await h.events.get("tools/pre-execute")({agent,arguments:{command:"edit main.tex"}},async()=>({kind:"allow"}))).kind,"allow");
 for(const name of ["job_output","job_list"])assert.equal((await h.events.get("tools/pre-execute")({agent,name,arguments:{job_id:"analysis"}},async()=>({kind:"allow"}))).kind,"allow");
 assert.equal((await h.request({action:"status",id:p.id})).value.review, null);
});

test("mindmap includes a commands-only input without requiring semantic annotations",async t=>{
 const h=await host(t),p=(await h.request({action:"create",name:"Commands input"})).value;
 await writeFile(join(p.root,"main.tex"),"\\documentclass{article}\n\\input{commands}\n\\begin{document}\n\\section{Introduction}\nThe method is reproducible.\n\\end{document}\n");
 const commands="\\newcommand{\\method}{Example}\n";
 await writeFile(join(p.root,"commands.tex"),commands);
 const agent={session:{id:"commands-chat",header:{cwd:p.root}}};h.agents.set(agent.session.id,agent);
 await h.request({action:"update",id:p.id,patch:{chat:{id:agent.session.id,title:"Paper"}}});
 await h.request({action:"analyze",id:p.id});
 let job;
 for(let i=0;i<100;i++){job=(await h.request({action:"job",id:p.id})).value;if(job.status!=="running")break;await new Promise(r=>setTimeout(r,10));}
 assert.equal(job.status,"completed",job.error);
 assert.equal(await readFile(join(p.root,"commands.tex"),"utf8"),commands);
});

test("native Agent edits enter review and Git push is guarded",async t=>{
 const h=await host(t),p=(await h.request({action:"create",name:"Native lifecycle"})).value;
 const agent={session:{id:"native-test",header:{cwd:p.root}}};h.agents.set(agent.session.id,agent);
 await h.request({action:"update",id:p.id,patch:{chat:{id:agent.session.id,title:"Paper"}}});
 await h.hook({agent,messages:[]},async()=>({kind:"enter"}));
 const {writeFile}=await import("node:fs/promises");await writeFile(join(p.root,"main.tex"),"Agent revised text.");
 await h.events.get("tools/post-execute")({agent}, {},async()=>({kind:"accept"}));
 let state=(await h.request({action:"status",id:p.id})).value;assert.ok(state.review.active);assert.ok(state.review.count>0);
 assert.equal((await h.request({action:"save",id:p.id,file:"main.tex",hash:"ignored",content:"manual"})).ok,false);
 const denied=await h.events.get("tools/pre-execute")({agent,arguments:{command:"git push origin HEAD"}},async()=>({kind:"allow"}));assert.equal(denied.kind,"deny");
 h.events.get("session/event")(agent.session,{type:"turn/end"});
 for(let i=0;i<50;i++){state=(await h.request({action:"status",id:p.id})).value;if(!state.review.active)break;await new Promise(r=>setTimeout(r,10));}
 assert.equal(state.review.active,false);assert.equal((await h.request({action:"decide",id:p.id,batchId:state.review.id,decision:"reject"})).ok,true);
 assert.match((await h.request({action:"read",id:p.id,file:"main.tex"})).value.content,/documentclass/);
});
