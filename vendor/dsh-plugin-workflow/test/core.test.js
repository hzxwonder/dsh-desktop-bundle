import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { Store } from "../lib/store.js";
import { Engine } from "../lib/engine.js";
import { Scheduler, nextAt } from "../lib/scheduler.js";
import { blankTemplate, paperTemplate } from "../lib/templates.js";
import { validateDefinition, pointer } from "../lib/definition.js";
const parent = { session: { id: "session" } };
const adapter = {
  rootRoute: () => ({ provider: "test", model: "root" }),
  route: async (n) => ({
    provider: n.provider?.id ?? "test",
    model: n.model?.id ?? "root",
  }),
  skills: async () => [],
  agent: async (_n, input) => ({ text: input.material }),
  tool: async () => ({ done: true }),
};
async function fixture(t, custom = adapter) {
  const directory = await mkdtemp("/private/tmp/workflow-core-");
  const store = new Store(`${directory}/db.sqlite`);
  const engine = new Engine(store, custom, directory);
  t.after(async () => {
    await store.beforeClose?.();
    await engine.close();
    store.close();
    await rm(directory, { recursive: true, force: true });
  });
  return { store, engine, directory };
}
test("definition validates templates, rejects cycles and undeclared dependencies", () => {
  validateDefinition(paperTemplate());
  const d = blankTemplate("x");
  d.edges.push({ from: "output", to: "task" });
  assert.throws(() => validateDefinition(d), /CYCLE/);
  d.edges = [];
  assert.throws(() => validateDefinition(d), /INPUT_DEPENDENCY/);
  assert.throws(() => pointer({}, "/__proto__"), /MISSING_INPUT/);
});
test("revision CAS and session references preserve immutable versions", async (t) => {
  const { store } = await fixture(t);
  const d = blankTemplate("x");
  store.save(d);
  store.publish("x", 1);
  store.bind("s", "x", 1);
  d.name = "Changed";
  store.save(d, 1);
  assert.equal(store.get("revision", "x:1").definition.name, "新工作流");
  assert.equal(store.get("binding", "s").revision, 1);
  assert.throws(() => store.save(d, 1), /REVISION_CONFLICT/);
  assert.equal(store.list("reference").length, 1);
});
test("graph runs with frozen routing and durable artifact", async (t) => {
  const { store, engine } = await fixture(t);
  const d = blankTemplate("x");
  d.nodes[0].model = { mode: "explicit", id: "special" };
  store.save(d);
  const run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: { text: "article" },
    parent,
  });
  assert.equal(run.status, "completed", run.error);
  assert.equal(run.prepared.routes.task.model, "special");
  assert.equal(store.list("artifact").length, 1);
  assert.equal(run.nodes.output.output.text, "article");
  assert(store.events(run.id).some((e) => e.type === "node.completed"));
});
test("schema mismatch fails downstream without producing artifact", async (t) => {
  const { store, engine } = await fixture(t);
  const d = blankTemplate("x");
  d.nodes[0].outputSchema = {
    type: "object",
    required: ["evidence"],
    properties: { evidence: { type: "array" } },
  };
  store.save(d);
  const run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: { text: "article" },
    parent,
  });
  assert.equal(run.status, "failed");
  assert.match(run.error, /OUTPUT_SCHEMA/);
  assert.equal(store.list("artifact").length, 0);
});
test("approval resumes with completed checkpoints intact", async (t) => {
  let calls = 0;
  const { store, engine } = await fixture(t, {
    ...adapter,
    agent: async () => {
      calls++;
      return { text: "done" };
    },
  });
  const d = blankTemplate("x");
  d.nodes.push({ id: "gate", name: "Approve", kind: "approval" });
  d.edges = [
    { from: "task", to: "gate" },
    { from: "gate", to: "output" },
  ];
  store.save(d);
  let run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: { text: "x" },
    parent,
  });
  assert.equal(run.status, "waiting_approval");
  run = await engine.resume(run.id, parent, undefined, true);
  assert.equal(run.status, "completed", run.error);
  assert.equal(calls, 1);
});
test("unattended tool permission is persisted and can be resumed explicitly", async (t) => {
  let calls = 0;
  const { store, engine } = await fixture(t, {
    ...adapter,
    tool: async () => {
      calls++;
      return { done: true };
    },
  });
  store.save({
    schemaVersion: "1.0",
    id: "x",
    name: "x",
    nodes: [{ id: "t", kind: "tool", name: "t", tool: "write", input: {} }],
    edges: [],
  });
  let run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: {},
    parent,
    unattended: { tools: [] },
  });
  assert.equal(run.status, "waiting_approval");
  assert.equal(calls, 0);
  run = await engine.resume(run.id, parent, undefined, true);
  assert.equal(run.status, "completed");
  assert.equal(calls, 1);
});
test("condition skips inactive branch", async (t) => {
  const { store, engine } = await fixture(t);
  store.save({
    schemaVersion: "1.0",
    id: "x",
    name: "x",
    nodes: [
      { id: "c", name: "c", kind: "condition", condition: { "==": [1, 1] } },
      { id: "yes", name: "yes", kind: "input" },
      { id: "no", name: "no", kind: "input" },
    ],
    edges: [
      { from: "c", to: "yes", on: "true" },
      { from: "c", to: "no", on: "false" },
    ],
  });
  const run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: {},
    parent,
  });
  assert.equal(run.status, "completed");
  assert.equal(run.nodes.no.status, "skipped");
  assert.equal(run.nodes.yes.status, "completed");
});
test("process ownership excludes a second live Host", async (t) => {
  const { store, directory } = await fixture(t);
  store.acquireHost();
  const other = new Store(`${directory}/db.sqlite`);
  assert.throws(() => other.acquireHost(), /HOST_ALREADY_RUNNING/);
  other.close();
});
test("scheduler validates IANA zone and DST gap/overlap semantics", () => {
  const plan = {
    kind: "cron",
    cron: "30 2 * * *",
    timezone: "America/New_York",
  };
  assert.equal(
    new Date(nextAt(plan, Date.parse("2026-03-08T05:00Z"))).toISOString(),
    "2026-03-09T06:30:00.000Z",
  );
  plan.cron = "30 1 * * *";
  assert.equal(
    new Date(nextAt(plan, Date.parse("2026-11-01T04:00Z"))).toISOString(),
    "2026-11-01T05:30:00.000Z",
  );
  assert.equal(
    new Date(nextAt(plan, Date.parse("2026-11-01T05:31Z"))).toISOString(),
    "2026-11-02T06:30:00.000Z",
  );
  assert.throws(() => nextAt({ ...plan, timezone: "Not/AZone" }));
});
test("scheduler claims once, queues latest overlap and dispatches after settlement", async (t) => {
  const { store } = await fixture(t);
  store.save(blankTemplate("x"));
  let now = 1000000;
  let finish;
  const fired = [];
  const scheduler = new Scheduler(
    store,
    async (o) => {
      fired.push(o);
      await new Promise((r) => {
        finish = r;
      });
      return { id: o.runId, status: "completed" };
    },
    { clock: () => now },
  );
  store.beforeClose = () => scheduler.close();
  const plan = scheduler.save({
    workflowId: "x",
    workflowRevision: 1,
    rootRoute: { provider: "test", model: "root" },
    cwd: "/tmp",
    input: { text: "x" },
    enabled: true,
    kind: "interval",
    seconds: 60,
    overlap: "latest",
    missed: "skip",
  });
  now += 60000;
  await scheduler.tick();
  await scheduler.tick();
  assert.equal(fired.length, 1);
  now += 60000;
  await scheduler.tick();
  assert.equal(fired.length, 1);
  finish();
  await Promise.all(scheduler.pending);
  await scheduler.tick();
  assert.equal(fired.length, 2);
  finish();
  await Promise.all(scheduler.pending);
  assert.equal(store.list("occurrence").length, 2);
  assert(store.get("schedule", plan.id).nextAt > now);
});
test("parallel approval preserves completed sibling without repeating its effects", async (t) => {
  let calls = 0;
  const { store, engine } = await fixture(t, {
    ...adapter,
    tool: async () => {
      calls++;
      return { done: true };
    },
  });
  store.save({
    schemaVersion: "1.0",
    id: "x",
    name: "x",
    nodes: [
      { id: "gate", kind: "approval", name: "gate" },
      { id: "write", kind: "tool", name: "write", tool: "write" },
    ],
    edges: [],
  });
  let run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: {},
    parent,
  });
  assert.equal(run.status, "waiting_approval");
  assert.equal(run.nodes.write.status, "completed");
  run = await engine.resume(run.id, parent, undefined, true);
  assert.equal(run.status, "completed");
  assert.equal(calls, 1);
});
test("restart marks interrupted runs for inspection", async (t) => {
  const { store, engine } = await fixture(t);
  store.put("run", "interrupted", { id: "interrupted", status: "running" });
  await engine.recover();
  assert.equal(store.get("run", "interrupted").status, "needs_attention");
});
const interactionDefinition = (node, edges) => ({
  schemaVersion: "1.0",
  id: "x",
  name: "x",
  nodes: [node, ...edges.nodes],
  edges: edges.edges,
});
test("one-shot interaction parks the run and continues with the user's answer", async (t) => {
  const { store, engine } = await fixture(t);
  store.save(
    interactionDefinition(
      {
        id: "ask",
        name: "材料",
        kind: "interact",
        prompt: "请提供论文 PDF 或链接。",
        input: { material: { source: "workflow", path: "/text" } },
      },
      {
        nodes: [
          {
            id: "task",
            name: "task",
            kind: "agent",
            prompt: "总结 {{input.material}}",
            input: { material: { source: "node", nodeId: "ask", path: "/text" } },
          },
        ],
        edges: [{ from: "ask", to: "task" }],
      },
    ),
  );
  let run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: { text: "帮我读论文" },
    parent,
  });
  assert.equal(run.status, "waiting_input");
  assert.equal(run.nodes.ask.status, "waiting_input");
  assert.equal(run.nodes.ask.interaction.question, "请提供论文 PDF 或链接。");
  assert(
    store.events(run.id).some((e) => e.type === "node.waiting_input"),
  );
  run = await engine.resume(run.id, parent, undefined, {
    text: "论文正文内容",
  });
  assert.equal(run.status, "completed", run.error);
  assert.equal(run.nodes.ask.status, "completed");
  assert.equal(run.nodes.ask.output.text, "论文正文内容");
  assert.equal(run.nodes.ask.output.complete, true);
  assert.equal(run.nodes.task.output.text, "论文正文内容");
  assert.equal(store.list("artifact").length, 0);
});
test("interaction skips the question when material is already provided", async (t) => {
  const { store, engine } = await fixture(t);
  store.save(
    interactionDefinition(
      {
        id: "ask",
        name: "材料",
        kind: "interact",
        prompt: "请提供论文 PDF 或链接。",
        provided: { source: "workflow", path: "/attachments" },
        input: { material: { source: "workflow", path: "/text" } },
      },
      { nodes: [], edges: [] },
    ),
  );
  const run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: { text: "论文正文", attachments: [{ id: "a", name: "p.pdf" }] },
    parent,
  });
  assert.equal(run.status, "completed", run.error);
  assert.equal(run.nodes.ask.output.provided, true);
  assert.equal(run.nodes.ask.output.turns, 0);
  assert.equal(run.nodes.ask.output.text, "论文正文");
});
test("goal interaction asks, requires confirmation and reports the understanding", async (t) => {
  const decisions = [
    { status: "ask", question: "你要解决什么问题？", summary: "" },
    { status: "confirm", question: "", summary: "你要做 X，验收标准是 Y。" },
    { status: "complete", question: "", summary: "你要做 X，验收标准是 Y。" },
  ];
  const prompts = [];
  const { store, engine } = await fixture(t, {
    ...adapter,
    agent: async (node) => {
      if (!node.prompt.includes("交互判定")) return { text: "done" };
      prompts.push(node.prompt);
      return decisions.shift();
    },
  });
  store.save(
    interactionDefinition(
      {
        id: "talk",
        name: "讨论想法",
        kind: "interact",
        interaction: "goal",
        maxTurns: 4,
        prompt: "弄清用户想做的 idea：目标、约束、验收标准。",
      },
      { nodes: [], edges: [] },
    ),
  );
  let run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: { text: "我有个想法" },
    parent,
  });
  assert.equal(run.status, "waiting_input");
  assert.equal(run.nodes.talk.interaction.question, "你要解决什么问题？");
  assert.equal(run.nodes.talk.interaction.phase, "ask");
  run = await engine.resume(run.id, parent, undefined, { text: "做 X" });
  assert.equal(run.status, "waiting_input");
  assert.equal(run.nodes.talk.interaction.phase, "confirm");
  assert.equal(run.nodes.talk.interaction.question, "你要做 X，验收标准是 Y。");
  assert.match(prompts[1], /1\. 用户：做 X/);
  run = await engine.resume(run.id, parent, undefined, { text: "对" });
  assert.match(prompts[2], /正在等待用户确认/);
  assert.equal(run.status, "completed", run.error);
  assert.equal(run.nodes.talk.status, "completed");
  assert.equal(run.nodes.talk.output.complete, true);
  assert.equal(run.nodes.talk.output.turns, 2);
  assert.equal(run.nodes.talk.output.summary, "你要做 X，验收标准是 Y。");
  assert.equal(run.nodes.talk.output.answers.length, 2);
});
test("goal interaction stops at the turn limit with an explicit incomplete output", async (t) => {
  const { store, engine } = await fixture(t, {
    ...adapter,
    agent: async (node) =>
      node.prompt.includes("交互判定")
        ? { status: "ask", question: "还有呢？", summary: "" }
        : { text: "done" },
  });
  store.save(
    interactionDefinition(
      {
        id: "talk",
        name: "讨论想法",
        kind: "interact",
        interaction: "goal",
        maxTurns: 1,
        prompt: "弄清用户意图。",
      },
      { nodes: [], edges: [] },
    ),
  );
  let run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: {},
    parent,
  });
  assert.equal(run.status, "waiting_input");
  run = await engine.resume(run.id, parent, undefined, { text: "第一次回答" });
  assert.equal(run.status, "completed", run.error);
  assert.equal(run.nodes.talk.output.complete, false);
  assert.equal(run.nodes.talk.output.turns, 1);
  assert(
    store.events(run.id).some((e) => e.type === "node.interaction_limit"),
  );
});
test("interaction cannot wait for a person in an unattended run", async (t) => {
  const { store, engine } = await fixture(t);
  store.save(
    interactionDefinition(
      {
        id: "ask",
        name: "材料",
        kind: "interact",
        prompt: "请提供材料。",
      },
      { nodes: [], edges: [] },
    ),
  );
  const run = await engine.start({
    workflowId: "x",
    revision: 1,
    input: {},
    parent,
    unattended: { tools: [] },
  });
  assert.equal(run.status, "failed");
  assert.match(run.error, /INTERACTION_UNATTENDED/);
  assert.equal(run.nodes.ask.status, "failed");
});
test("interaction definition rules require a prompt and a used turn limit", () => {
  const definition = (node) => ({
    schemaVersion: "1.0",
    id: "x",
    name: "x",
    nodes: [node],
    edges: [],
  });
  assert.throws(
    () => validateDefinition(definition({ id: "a", name: "a", kind: "interact" })),
    /PROMPT_REQUIRED/,
  );
  assert.throws(
    () =>
      validateDefinition(
        definition({
          id: "a",
          name: "a",
          kind: "interact",
          prompt: "请提供材料。",
          maxTurns: 3,
        }),
      ),
    /INTERACTION_TURNS_UNUSED/,
  );
  assert.throws(
    () =>
      validateDefinition(
        definition({
          id: "a",
          name: "a",
          kind: "interact",
          prompt: "请提供材料。",
          provided: { source: "node", nodeId: "upstream" },
        }),
      ),
    /INPUT_DEPENDENCY_REQUIRED/,
  );
  validateDefinition(
    definition({
      id: "a",
      name: "a",
      kind: "interact",
      prompt: "请提供材料。",
      interaction: "goal",
      maxTurns: 3,
    }),
  );
});
test("paper template asks for the paper only when the message carries none", async (t) => {
  const { store, engine } = await fixture(t);
  const item = store.save(paperTemplate());
  assert.equal(item.revision, 1);
  const definition = store.get("revision", `${item.id}:1`).definition;
  const run = await engine.start({
    workflowId: item.id,
    revision: 1,
    input: { text: "帮我读这篇论文" },
    parent,
  });
  assert.equal(run.status, "waiting_input", run.error);
  assert.equal(run.nodes.material.interaction.question, "请提供论文 PDF 附件或论文链接。");
  assert.deepEqual(
    definition.nodes.map((n) => n.kind),
    ["interact", "agent", "agent", "agent", "agent", "artifact"],
  );
});
