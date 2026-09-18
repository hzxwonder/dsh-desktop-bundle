import { join } from "node:path";
import { homedir } from "node:os";
import { mkdir, readFile } from "node:fs/promises";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { Store, uid } from "./lib/store.js";
import { Engine } from "./lib/engine.js";
import { Scheduler, nextAt } from "./lib/scheduler.js";
import { schema, fail, checkData } from "./lib/definition.js";
import { paperTemplate, blankTemplate } from "./lib/templates.js";
import { harnessAdapter, materialInput } from "./lib/harness.js";

export const name = "dsh-plugin-workflow";
export const inject = [
  "connection",
  "agents",
  "subagents",
  "tools",
  "llm",
  "skills",
  "systemPrompt",
  "sessionProjections",
  "attachments",
  "sandboxPolicy",
];
export async function apply(ctx, config = {}) {
  const directory =
    config.directory ??
    join(
      config.dshHome ?? process.env.DSH_HOME ?? join(homedir(), ".dsh"),
      "workflow-studio",
    );
  // Workspace registration canonicalizes an existing directory but does not
  // create it. The client requests these paths, so make them real on the Host.
  const workflowWorkspaceRoot = join(
    config.dshHome ?? process.env.DSH_HOME ?? join(homedir(), ".dsh"),
    "workflows",
  );
  await mkdir(workflowWorkspaceRoot, { recursive: true });
  const store = new Store(join(directory, "workflows.sqlite"));
  try {
    store.acquireHost();
  } catch (error) {
    store.close();
    throw error;
  }
  const adapter = harnessAdapter(ctx);
  const engine = new Engine(store, adapter, join(directory, "artifacts"));
  const owned = new Map();
  const jobs = new Set();
  const reports = new Set();
  const followups = new Map();
  const stepForSession = id => {
    for (const run of store.list("run")) for (const [nodeId, state] of Object.entries(run.nodes)) {
      if (state.sessionId === id) return { run, nodeId, state };
      for (const [memberId, member] of Object.entries(state.subagents ?? {}))
        if (member.sessionId === id) return { run, nodeId, state: member, memberId };
    }
  };
  const agentFor = async (id) => {
    if (!id) fail("SESSION_REQUIRED");
    const live = ctx.agents.get(id);
    if (live) return live;
    if (!owned.has(id))
      owned.set(id, await ctx.agents.resume({ resumeSessionId: id, setup: (childCtx) => {
        const step = stepForSession(id);
        if (step) {
          const node = step.run.prepared.definition.nodes.find(n => n.id === step.nodeId);
          const spec = step.memberId ? node?.subagents?.find(m => m.id === step.memberId) : node;
          childCtx.tools.restrict({ allow: spec?.tools ?? [] });
        }
      } }));
    return owned.get(id).agent;
  };
  // An interaction node parks the run in `waiting_input` and publishes the one
  // question a person has to answer. The bound conversation is the answer
  // channel: the question is handed to the session agent, and the next user
  // message is handed back to the engine as that answer.
  const pendingInteraction = (nodes = {}) => {
    const entry = Object.entries(nodes).find(
      ([, state]) => state.status === "waiting_input",
    );
    if (!entry) return null;
    const [nodeId, state] = entry;
    const info = state.interaction ?? {};
    return {
      nodeId,
      phase: info.phase ?? "ask",
      turns: info.turns ?? 0,
      maxTurns: info.maxTurns ?? 1,
      question: info.question ?? "",
    };
  };
  const runReport = async (run) => {
    const pending = pendingInteraction(run.nodes);
    if (run.status === "waiting_input" && pending)
      return `\n<workflow_interaction>\n${JSON.stringify({ runId: run.id, workflowId: run.workflowId, ...pending })}\n</workflow_interaction>\n${
        pending.phase === "confirm"
          ? "Restate the question to the user and ask for confirmation. Do not confirm on the user's behalf and do not execute the workflow again."
          : "Ask the user this question verbatim and wait. The user's next message is the answer to this interaction; do not answer it yourself and do not execute the workflow again."
      }`;
    const artifacts = store.list("artifact").filter((a) => a.runId === run.id);
    const result = {
      runId: run.id,
      status: run.status,
      error: run.error,
      result: run.result,
      artifacts: await Promise.all(
        artifacts.map(async (a) => ({
          id: a.id,
          name: a.name,
          content: await readFile(a.path, "utf8"),
        })),
      ),
    };
    return `\n<workflow_result>\n${JSON.stringify(result)}\n</workflow_result>\nPresent the completed artifact faithfully. Report a failed or waiting run accurately. Do not execute the workflow again.`;
  };
  const deliverQuestion = async (run, parent) => {
    if (!parent || run?.status !== "waiting_input") return;
    if (reports.has(parent.session.id)) return;
    reports.add(parent.session.id);
    try {
      parent.followup({
        id: uid("message"),
        role: "user",
        source: { kind: "user" },
        content: [{ type: "text", text: await runReport(run) }],
      });
      await parent.whenIdle();
    } finally {
      reports.delete(parent.session.id);
    }
  };
  const withText = (decision, messages, text) => ({
    ...decision,
    messages: [...(decision.messages ?? messages), {
      id: uid("wf-context"), role: "user",
      source: { kind: "plugin", plugin: "workflow-studio", form: "notice", summary: "工作流状态" },
      content: [{ type: "text", text }],
    }],
  });
  const withNote = withText;
  const scheduler = new Scheduler(store, async (occurrence) => {
    const p = occurrence.plan;
    const handle = await ctx.agents.create({
      sessionId: occurrence.sessionId,
      meta: { cwd: p.cwd },
      agentOptions: p.rootRoute,
    });
    try {
      store.bind(
        handle.agent.session.id,
        p.workflowId,
        p.workflowRevision,
        "run",
      );
      const run = await engine.start({
        workflowId: p.workflowId,
        revision: p.workflowRevision,
        input: p.input,
        parent: handle.agent,
        rootRoute: p.rootRoute,
        unattended: { tools: p.tools },
        runId: occurrence.runId,
      });
      reports.add(handle.agent.session.id);
      const artifacts = await Promise.all(store.list('artifact').filter(a => a.runId === run.id).map(async a => ({name:a.name,content:await readFile(a.path,'utf8')})));
      await handle.agent.followup({
        id: uid("message"),
        role: "user",
        content: [
          {
            type: "text",
            text: `定时工作流执行记录：${JSON.stringify({ runId: run.id, status: run.status, result: run.result, artifacts, error: run.error })}。向用户完整呈现产物并汇报状态。此运行已经执行，不要再次执行或修改工作流。`,
          },
        ],
        source: { kind: "user" },
      });
      await handle.agent.whenIdle();
      return run;
    } finally {
      reports.delete(handle.agent.session.id);
      await handle.dispose();
    }
  });
  await engine.recover();
  scheduler.recover();
  if (!store.list("workflow").length) {
    const item = store.save(paperTemplate());
    store.publish(item.id, item.revision);
  }
  const bundledSkills = [
    ["workflow-builder", "Build, trial and refine visual workflows"],
    ["workflow-discovery", "Clarify workflow requirements before design"],
    ["workflow-refiner", "Repair and finely tune existing workflows"],
    ["workflow-debugger", "Debug workflows one node at a time"],
  ];
  const skillText = {};
  for (const [skillName, description] of bundledSkills) {
    const content = await readFile(
      new URL(`./skills/${skillName}/SKILL.md`, import.meta.url),
      "utf8",
    );
    skillText[skillName] = content;
    ctx.skills.register({ name: skillName, description, content, source: "bundled" });
  }
  const skill = skillText["workflow-builder"];
  const track = (promise) => {
    jobs.add(promise);
    promise.finally(() => jobs.delete(promise)).catch(() => {});
    return promise;
  };
  const operation = async (
    args,
    parent,
    signal = AbortSignal.timeout(60000),
  ) => {
    const { action, ...a } = args;
    if (action === "state")
      return {
        workflows: store.list("workflow"),
        authoring: store.list("authoring"),
        bindings: store.list("binding"),
        stepSessions: store.list("run").flatMap(run => Object.entries(run.nodes).flatMap(([nodeId, n]) => [
          ...(n.sessionId ? [{ sessionId: n.sessionId, parentSessionId: run.sessionId, runId: run.id, nodeId, name: n.name }] : []),
          ...Object.entries(n.subagents ?? {}).filter(([, m]) => m.sessionId).map(([memberId, m]) => ({ sessionId: m.sessionId, parentSessionId: run.sessionId, runId: run.id, nodeId, memberId, name: m.name })),
        ])),
        references: store.list("reference"),
        runs: store
          .list("run")
          .slice(0, 100)
          .map(({ prepared, input, outputs, nodes, ...run }) => ({
            ...run,
            pending: pendingInteraction(nodes),
            nodes: Object.fromEntries(
              Object.entries(nodes).map(([id, n]) => [
                id,
                { status: n.status },
              ]),
            ),
          })),
        schedules: store.list("schedule"),
        schedulerError: scheduler.lastError,
      };
    if (action === "describe")
      return { schema, templates: [paperTemplate(), blankTemplate("custom")] };
    if (action === "read") {
      const wf = store.get("workflow", a.id);
      if (!wf) fail("WORKFLOW_NOT_FOUND");
      return {
        ...wf,
        snapshot: store.get("revision", `${a.id}:${a.revision ?? wf.revision}`),
      };
    }
    if (action === "versions")
      return store.list("revision").filter((x) => x.definition.id === a.id);
    if (action === "runRead")
      return {
        run: (() => {
          const saved = store.get('run', a.id);
          if (!saved) return null;
          const run = structuredClone(saved);
          run.recipient = store.get('binding', run.sessionId)?.recipient ?? '';
          for (const state of Object.values(run.nodes)) {
            delete state.trace;
            for (const member of Object.values(state.subagents ?? {})) delete member.trace;
          }
          return run;
        })(),
        events: store.events(a.id, a.after),
        artifacts: store
          .list("artifact")
          .filter((x) => x.runId === a.id)
          .map(({ path, ...x }) => x),
      };
    if (action === "artifact") {
      const artifact = store.get("artifact", a.id);
      if (!artifact) fail("ARTIFACT_NOT_FOUND");
      return {
        name: artifact.name,
        mediaType: artifact.mediaType,
        content: await readFile(artifact.path, "utf8"),
      };
    }
    if (action === "capabilities") {
      const providers = ctx.llm.listProviders();
      const entries = await Promise.all(
        providers.map(async (p) => {
          try {
            const models = await ctx.llm.listModels(p.id);
            return { ...p, models };
          } catch {
            return { ...p, models: [], error: "MODEL_CATALOG_UNAVAILABLE" };
          }
        }),
      );
      return {
        providers: entries,
        executors: ctx.subagents.list(),
        skills: await ctx.skills.list({ cwd: parent?.session.header.cwd }),
        tools: parent ? ctx.tools.schemas(parent).map((t) => t.name) : [],
      };
    }
    if (action === "modelInfo")
      return ctx.llm.resolveModelInfo(a.provider, a.model, signal);
    if (action === "schedulePreview") {
      let at = Date.now();
      return Array.from({ length: 5 }, () => {
        if (at == null) return null;
        at = nextAt(a.plan, at);
        return at;
      }).filter((x) => x != null);
    }
    if (
      parent &&
      ctx.sandboxPolicy.resolve({ session: parent.session }).mode ===
        "read-only"
    )
      fail("WORKFLOW_SANDBOX_DENIED");
    if (action === "workflowWorkspace") {
      const segment = a.segment;
      if (segment !== "tmp" && !/^[a-zA-Z0-9_-]{1,80}$/.test(segment ?? ""))
        fail("WORKFLOW_WORKSPACE_INVALID");
      const path = join(workflowWorkspaceRoot, segment);
      await mkdir(path, { recursive: true });
      return { path };
    }
    if (action === "authorStart") {
      const sessionId = parent?.session.id ?? a.sessionId;
      if (!sessionId) fail("SESSION_REQUIRED");
      return store.put("authoring", sessionId, { sessionId });
    }
    if (action === "save") {
      const saved = store.save(a.definition, a.expectedRevision);
      if (parent && store.get("authoring", parent.session.id)) {
        store.bind(parent.session.id, saved.id, saved.revision, "author");
        store.remove("authoring", parent.session.id);
      }
      return saved;
    }
    if (action === "create")
      return store.save(
        a.template === "paper"
          ? paperTemplate(uid("workflow"))
          : blankTemplate(uid("workflow"), a.name),
      );
    if (action === "copy") {
      const source = store.get("workflow", a.id);
      if (!source) fail("WORKFLOW_NOT_FOUND");
      const snapshot = store.get("revision", `${a.id}:${a.revision ?? source.revision}`);
      if (!snapshot) fail("REVISION_NOT_FOUND");
      // A copy is a new workflow at the source's newest definition. Runs,
      // schedules, conversation bindings and the published marker stay behind,
      // so the copy starts as an editable draft.
      const definition = structuredClone(snapshot.definition);
      definition.id = uid("workflow");
      definition.name = a.name?.trim() || `${source.name} 副本`;
      return store.save(definition, 0);
    }
    if (action === "publish") return store.publish(a.id, a.revision);
    if (action === "archive") {
      const wf = store.get("workflow", a.id);
      if (!wf) fail("WORKFLOW_NOT_FOUND");
      return store.put("workflow", a.id, {
        ...wf,
        archived: a.archived !== false,
      });
    }
    if (action === "bind") {
      if (!["run", "author"].includes(a.mode ?? "run")) fail("BIND_MODE");
      return store.bind(
        parent?.session.id ?? a.sessionId,
        a.id,
        a.revision,
        a.mode,
      );
    }
    if (action === "unbind") {
      store.remove("binding", parent?.session.id ?? a.sessionId);
      return { unbound: true };
    }
    if (action === "scheduleSave") {
      const plan = a.plan;
      const revision = store.get(
        "revision",
        `${plan.workflowId}:${plan.workflowRevision}`,
      );
      if (!revision) fail("REVISION_NOT_FOUND");
      checkData(revision.definition.inputSchema ?? {}, plan.input);
      await ctx.llm.resolveCallConfig(plan.rootRoute, signal);
      return scheduler.save(plan, a.expectedRevision);
    }
    if (action === "scheduleDelete") {
      store.remove("schedule", a.id);
      return { deleted: true };
    }
    if (action === 'stepEdit' || action === 'stepRun') {
      const run = store.get('run', a.runId);
      if (!run) fail('RUN_NOT_FOUND');
      if (engine.active.has(run.id)) fail('STEP_BUSY');
      if (a.expectedRevision !== run.checkpointRevision) fail('RUN_CONFLICT');
      const node = run.prepared.definition.nodes.find(n => n.id === a.nodeId);
      if (!node) fail('NODE_NOT_FOUND');
      if (action === 'stepEdit') {
        if (typeof a.prompt !== 'string' || a.prompt.length > 100000) fail('PROMPT_INVALID');
        const existing = run.stepOverrides?.[a.nodeId]?.attachments ?? [];
        const kept = a.keep ?? existing.map(b => b.attachment.attachmentId);
        if (!Array.isArray(kept) || kept.some(id => !existing.some(b => b.attachment.attachmentId === id))) fail('ATTACHMENT_INVALID');
        const files = a.files ?? [];
        if (!Array.isArray(files) || files.length + kept.length > 12) fail('ATTACHMENT_LIMIT');
        let total = 0;
        for (const file of files) {
          if (typeof file.name !== 'string' || typeof file.data !== 'string' || file.data.length > 12 * 1024 * 1024 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) fail('ATTACHMENT_INVALID');
          total += Buffer.byteLength(file.data, 'base64');
        }
        if (total > 8 * 1024 * 1024) fail('ATTACHMENT_LIMIT');
        // Hold the same run guard throughout asynchronous attachment admission.
        engine.active.set(run.id, new AbortController());
        try {
          const attachments = existing.filter(b => kept.includes(b.attachment.attachmentId));
          for (const file of files) {
            const data = Buffer.from(file.data, 'base64');
            const image = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.mediaType);
            attachments.push({ type: image ? 'image' : 'file', attachment: image
              ? await ctx.attachments.saveImage({ data, name: file.name, mediaType: file.mediaType })
              : await ctx.attachments.saveFile({ data, name: file.name }) });
          }
          run.stepOverrides ??= {};
          run.stepOverrides[a.nodeId] = { prompt: a.prompt, attachments, updatedAt: Date.now() };
          run.checkpointRevision = (run.checkpointRevision ?? 0) + 1;
          return store.updateRun(run, 'node.input_edited', { nodeId: a.nodeId });
        } finally { engine.active.delete(run.id); }
      }
      const incoming = run.prepared.definition.edges.filter(e => e.to === a.nodeId);
      if (incoming.some(e => !['completed', 'skipped'].includes(run.nodes[e.from]?.status))) fail('STEP_NOT_READY');
      const next = await engine.rewind(run.id, a.nodeId, { expectedRevision: a.expectedRevision });
      const binding = store.get('binding', run.sessionId);
      if (binding) store.put('binding', run.sessionId, { ...binding, recipient: null });
      const root = await agentFor(run.sessionId);
      const promise = engine.resume(run.id, root, undefined, true, { debug: true, nodeId: a.nodeId, expectedRevision: next.checkpointRevision });
      jobs.add(promise); promise.finally(() => jobs.delete(promise)).catch(() => {});
      return { runId: run.id };
    }
    if (action === 'stepFile') {
      const run = store.get('run', a.runId);
      if (!run) fail('RUN_NOT_FOUND');
      const files = Object.values(run.stepOverrides ?? {}).flatMap(v => v.attachments ?? []);
      for (const n of Object.values(run.nodes)) files.push(...(n.input?.attachments ?? []), ...(n.output?.attachments ?? []));
      const block = files.find(b => b.attachment?.attachmentId === a.attachmentId);
      if (!block) fail('ATTACHMENT_NOT_FOUND');
      const ref = block.attachment;
      if (ref.bytes > 8 * 1024 * 1024) fail('ATTACHMENT_LIMIT');
      let data;
      if (block.type === 'image') data = Buffer.from((await ctx.attachments.readImage(ref)).data);
      else { const chunks = []; for await (const chunk of ctx.attachments.readFileStream(ref)) chunks.push(chunk); data = Buffer.concat(chunks); }
      return { name: ref.name, mediaType: ref.mediaType ?? 'application/octet-stream', data: data.toString('base64') };
    }
    if (["stepOpen", "stepMessage", "stepTrace", "adopt", "rewind"].includes(action)) {
      const run = store.get("run", a.runId);
      if (!run) fail("RUN_NOT_FOUND");
      const state = run.nodes[a.nodeId];
      if (!state) fail("NODE_NOT_FOUND");
      const target = a.memberId ? state.subagents?.[a.memberId] : state;
      if (!target) fail("SUBAGENT_NOT_FOUND");
      if (action === "rewind") return engine.rewind(run.id, a.nodeId, { include: a.include !== false, expectedRevision: a.expectedRevision });
      if (!target.sessionId && action === 'stepOpen' && target.status === 'completed') {
        if (engine.active.has(run.id)) fail('STEP_BUSY');
        const parent = await agentFor(run.sessionId);
        const controller = new AbortController(); engine.active.set(run.id, controller); target.reviewing = true;
        try {
          const spec = { id: a.nodeId, name: target.name, prompt: '帮助用户检视这个工作流步骤的输入、输出和结果。回答追问；只有用户明确采用回答后才更新工作流输出。', tools: [] };
          const route = await adapter.route(spec, run.rootRoute, controller.signal);
          await adapter.agent(spec, { input: target.input, output: target.output }, route, [], parent, controller.signal, {
            onSession: info => { Object.assign(target, info); target.route = route; store.updateRun(run, 'node.review_session', { nodeId: a.nodeId }); },
            onTrace: events => { target.trace = events; store.updateRun(run, 'node.review_ready', { nodeId: a.nodeId }); },
          });
        } finally { delete target.reviewing; engine.active.delete(run.id); }
      }
      if (!target.sessionId) fail("STEP_SESSION_UNAVAILABLE");
      if (action === "stepTrace") {
        const live = ctx.agents.get(target.sessionId);
        return { events: live?.session.snapshotEvents() ?? target.trace ?? [], sessionId: target.sessionId };
      }
      await agentFor(run.sessionId);
      if (action === "stepOpen") return { sessionId: target.sessionId };
      const child = ctx.agents.get(target.sessionId);
      if (action === "stepMessage") {
        if (typeof a.text !== "string" || !a.text.trim() || a.text.length > 100000) fail("MESSAGE_REQUIRED");
        const message = { id: uid("message"), role: "user", source: { kind: "user" }, content: [{ type: "text", text: a.text }] };
        if (engine.active.has(run.id) && target.status !== 'running') fail('STEP_BUSY');
        await ctx.subagents.prompt({ requestId: message.id, parentSessionId: run.sessionId, childSessionId: target.sessionId, mode: 'continuable', delivery: 'steer', content: message.content }, signal ?? AbortSignal.timeout(15000));
        store.event(run.id, "message.delivered", { nodeId: a.nodeId, memberId: a.memberId, messageId: message.id });
        return { delivered: true, sessionId: target.sessionId };
      }
      if (child?.status === "running") fail("STEP_BUSY");
      const events = child?.session.snapshotEvents() ?? target.trace ?? [];
      const turn = [...events].reverse().find(e => e.type === "turn/start" || e.type === "turn/end");
      if (turn?.type === "turn/start") fail("STEP_BUSY");
      const last = [...events].reverse().find(e => e.type === "assistant/message" && e.data.message.content.length);
      if (!last) fail("STEP_OUTPUT_MISSING");
      const text = last.data.message.content.filter(b => b.type === "text").map(b => b.text).join("\n");
      const node = run.prepared.definition.nodes.find(n => n.id === a.nodeId);
      let output = { text };
      if (node?.outputSchema) { try { output = JSON.parse(text); } catch { fail("OUTPUT_SCHEMA"); } }
      return engine.adopt(run.id, a.nodeId, output, { expectedRevision: a.expectedRevision });
    }
    if (action === "setRecipient") {
      const binding = store.get("binding", a.sessionId);
      if (!binding) fail("BINDING_NOT_FOUND");
      if (a.recipient) {
        const target = stepForSession(a.recipient);
        if (!target || target.run.sessionId !== a.sessionId) fail("RUN_SESSION_MISMATCH");
      }
      return store.put("binding", a.sessionId, { ...binding, recipient: a.recipient || null });
    }
    if (action === "setDebug") {
      if (a.runId) {
        const run = store.get('run', a.runId);
        if (!run || run.sessionId !== a.sessionId) fail('RUN_SESSION_MISMATCH');
        if (engine.active.has(run.id)) fail('STEP_BUSY');
        run.debug = Boolean(a.debug); store.updateRun(run, 'run.debug_changed');
      }
      const binding = store.get("binding", a.sessionId);
      if (!binding) fail("BINDING_NOT_FOUND");
      return store.put("binding", a.sessionId, { ...binding, debug: Boolean(a.debug) });
    }
    if (action === "cancel" || action === "pause") {
      engine.cancel(a.id, action === "pause");
      return { accepted: true };
    }
    if (!parent) parent = await agentFor(a.sessionId);
    if (action === "run" || action === "resume") {
      if (
        action === "resume" &&
        store.get("run", a.runId)?.sessionId !== parent.session.id
      )
        fail("RUN_SESSION_MISMATCH");
      const runId = a.runId ?? uid("run");
      const promise =
        action === "resume"
          ? engine.resume(runId, parent, undefined, a.response, { debug: a.debug, expectedRevision: a.expectedRevision })
          : engine.start({
              workflowId: a.id,
              revision: a.revision,
              input: a.input,
              parent,
              runId,
              debug: Boolean(a.debug),
            });
      if (a.background) {
        track(promise.then((run) => deliverQuestion(run, parent)));
        return { runId };
      }
      return track(promise);
    }
    fail("UNKNOWN_ACTION");
  };
  ctx.tools.register(
    defineTool({
      name: "workflow_studio",
      description:
        "Create, copy, inspect, save, publish, bind, execute, revise and schedule visual workflows. Call describe for schema and templates; read before save. Payload is a JSON object of action-specific fields. Run uses id, revision, input. Save uses definition and expectedRevision. Bind uses id, revision, mode run/author for this session. Copy uses id and starts a new unpublished draft from the newest definition. Resume uses runId with response; an interact node parks the run in waiting_input and takes its answer from the user's next message in the bound conversation.",
      parameters: {
        action: { type: "string", required: true },
        payload: { type: "string" },
      },
      output: {
        schema: {
          type: "object",
          additionalProperties: false,
          properties: { resultJson: { type: "string", required: true } },
        },
        render: (_args, value) => [{ type: "text", text: value.resultJson }],
      },
      isConcurrencySafe: (a) =>
        [
          "state",
          "read",
          "describe",
          "versions",
          "capabilities",
          "modelInfo",
          "runRead",
          "artifact",
          "schedulePreview",
        ].includes(a.action),
      async execute(a, exec) {
        return {
          resultJson: JSON.stringify(
            await operation(
              { ...JSON.parse(a.payload ?? "{}"), action: a.action },
              exec.agent,
              exec.signal,
            ),
          ),
        };
      },
    }),
  );
  ctx.systemPrompt.variable("workflow_studio_context", ({ agent }) => {
    if (agent && store.get("authoring", agent.session.id))
      return `This is a workflow authoring conversation. First use workflow-discovery when any requirement, input, acceptance criterion, or side effect is unclear. Conduct the one-question-at-a-time Socratic interview and wait for confirmation of the precise actionable question before editing. Then use workflow-builder to derive the name, icon and graph; do not ask the user to configure a graph or supply an identifier. Use workflow-refiner for user-reported problems and workflow-debugger for step-by-step inspection. Read describe and capabilities, save a complete definition with expectedRevision=0; saving binds this conversation automatically. ${skill}\n${skillText["workflow-discovery"]}\n${skillText["workflow-refiner"]}\n${skillText["workflow-debugger"]}`;
    const step = agent && stepForSession(agent.session.id);
    if (step) return `This is an independent workflow step conversation. Workflow ${step.run.workflowId}, step ${step.nodeId}. Answer follow-ups normally. Outputs are adopted explicitly by the user; do not resume or rerun the parent workflow from this step. Public file writes are immediate and checkpointed by the workflow runtime.`;
    const binding = agent && store.get("binding", agent.session.id);
    if (!binding)
      return "Use workflow_studio and workflow-builder skill when the user requests creating or editing a reusable workflow.";
    return `Workflow binding: ${JSON.stringify(binding)}. ${binding.mode === "author" ? `${skill}\n${skillText["workflow-discovery"]}\n${skillText["workflow-refiner"]}\n${skillText["workflow-debugger"]}` : "New material runs the pinned graph automatically. A run that reports waiting_input is parked on an interact node: relay its question verbatim and treat the user's next message as the answer, never answer it yourself. Discuss follow-up questions normally. For workflow changes, bind author mode and use workflow-refiner; use workflow-debugger to inspect intermediate inputs and outputs. Do not rerun a completed graph unless requested."}`;
  });
  ctx.systemPrompt.section({
    name: "workflow-studio",
    order: 80,
    text: "{{workflow_studio_context}}",
  });
  ctx.on("agent/pre-step", async ({ agent, messages, signal }, next) => {
    const decision = await next();
    if (decision.kind !== "enter" || !messages.length || reports.has(agent.session.id)) return decision;
    const step = stepForSession(agent.session.id);
    if (step && engine.active.has(step.run.id) && step.state.status !== "running" && !step.state.reviewing && !followups.has(agent.session.id)) return { kind: "reject" };
    if (step && !engine.active.has(step.run.id) && !followups.has(agent.session.id)) {
      const unlock = await engine.checkpoints.lock(agent.session.header.cwd, step.run.id);
      const controller = new AbortController();
      controller.signal.addEventListener('abort', () => agent.cancel({ kind: 'parent' }), { once: true });
      engine.active.set(step.run.id, controller);
      try {
        const record = { index: (step.run.nodes[step.nodeId].attempts?.length ?? 0) + 1, startedAt: Date.now(), kind: 'followup' };
        record.folder = engine.checkpoints.folder(step.run.id, step.nodeId, record.index);
        const before = await engine.checkpoints.begin(agent.session.header.cwd, record.folder, { messages });
        followups.set(agent.session.id, { runId: step.run.id, nodeId: step.nodeId, record, before, unlock });
        setTimeout(() => track((async () => {
          try {
            await agent.whenIdle();
            record.checkpoint = await engine.checkpoints.finish(before, record.folder, null);
            record.status = 'completed'; record.endedAt = Date.now();
            const run = store.get('run', step.run.id);
            run.nodes[step.nodeId].attempts.push(record);
            const target = step.memberId ? run.nodes[step.nodeId].subagents[step.memberId] : run.nodes[step.nodeId];
            target.trace = agent.session.snapshotEvents();
            run.checkpointRevision++;
            store.updateRun(run, 'node.followup_completed', { nodeId: step.nodeId });
          } finally { unlock(); engine.active.delete(step.run.id); followups.delete(agent.session.id); }
        })()), 0);
      } catch (error) { unlock(); engine.active.delete(step.run.id); throw error; }
      return decision;
    }
    if (!messages.some(m => m.source?.kind === "user")) return decision;
    const waiting = store
      .list("run")
      .find(
        (r) => r.sessionId === agent.session.id && r.status === "waiting_input",
      );
    if (waiting) {
      try {
        const answer = await materialInput(ctx, messages, signal);
        const run = await engine.resume(waiting.id, agent, signal, {
          text: answer.text,
          attachments: answer.attachments,
        });
        return withText(decision, messages, await runReport(run));
      } catch (error) {
        return withNote(
          decision,
          messages,
          `Workflow interaction answer rejected: ${error.code ?? "WORKFLOW_ERROR"}. The run stays at ${waiting.id}. Tell the user what is missing and ask again; do not answer the interaction yourself.`,
        );
      }
    }
    const recipientBinding = store.get("binding", agent.session.id);
    if (recipientBinding?.recipient) {
      const target = stepForSession(recipientBinding.recipient);
      if (target && target.run.sessionId === agent.session.id) {
        if (engine.active.has(target.run.id) && target.state.status !== 'running') return withNote(decision, messages, 'This step is busy with workflow execution. Wait for the workflow to pause before continuing this completed step.');
        for (const message of messages.filter(m => m.source?.kind === 'user')) {
          const live = ctx.agents.get(recipientBinding.recipient);
          if (live) live.steer({ ...message, id: uid('steer') });
          else await ctx.subagents.prompt({ requestId: uid('steer'), parentSessionId: agent.session.id, childSessionId: recipientBinding.recipient, mode: 'continuable', delivery: 'steer', content: message.content }, signal);
        }
        return withText(decision, messages, "User message delivered to the selected workflow step. Acknowledge briefly; do not run any workflow.");
      }
    }
    const liveRun = store.list("run").find(r => r.sessionId === agent.session.id && r.status === "running");
    if (liveRun) {
      const targets = Object.entries(liveRun.nodes).filter(([, n]) => n.status === "running" && n.sessionId && ctx.agents.get(n.sessionId));
      if (targets.length === 1) {
        const [, target] = targets[0];
        for (const message of messages) ctx.agents.get(target.sessionId).steer({ ...message, id: uid("steer") });
        return withText(decision, messages, "The user's message was delivered to the active workflow step. Acknowledge delivery briefly; do not execute the workflow.");
      }
      return withText(decision, messages, "Workflow execution is active. Ask the user to select a running subagent in the workflow timeline to deliver this message to a specific recipient. Do not claim it was delivered.");
    }
    const binding = store.get("binding", agent.session.id);
    if (!binding || binding.mode !== "run") return decision;
    const def = store.get(
      "revision",
      `${binding.workflowId}:${binding.revision}`,
    )?.definition;
    const sessionRuns = store
      .list("run")
      .filter((r) => r.sessionId === agent.session.id);
    const previous = sessionRuns.some(
      (r) => r.workflowId === binding.workflowId,
    );
    const active = sessionRuns.some((r) =>
      ["queued", "running", "waiting_approval", "waiting_input", "paused"].includes(
        r.status,
      ),
    );
    const files = messages.some((m) =>
      m.content.some((b) => b.type === "file"),
    );
    if (
      def?.trigger === "manual" ||
      active ||
      (def?.trigger !== "every-message" && previous && !files)
    )
      return decision;
    try {
      const input = await materialInput(ctx, messages, signal);
      const runId = uid("run");
      const promise = engine.start({
        workflowId: binding.workflowId,
        revision: binding.revision,
        input,
        parent: agent,
        runId,
        debug: Boolean(binding.debug),
      });
      track(promise.then(async run => {
        if (run.status === "waiting_input") await deliverQuestion(run, agent);
      }));
      return withText(decision, messages, `Workflow run ${runId} started in the background. State and step outputs appear in the workflow timeline. Acknowledge briefly; do not execute the graph again.`);
    } catch (error) {
      return withNote(
        decision,
        messages,
        `Workflow execution failed: ${error.code ?? "WORKFLOW_ERROR"}. Inspect workflow_studio state and help resolve it.`,
      );
    }
  });
  ctx.connection.fetch.register({
    path: "/api/workflow-studio",
    methods: ["POST"],
    requestBody: "buffered",
    async fetch(request) {
      try {
        const body = await request.text();
        if (Buffer.byteLength(body) > 2 * 1024 * 1024)
          fail("REQUEST_SIZE_LIMIT");
        const args = JSON.parse(body);
        const parent = args.sessionId
          ? await agentFor(args.sessionId)
          : undefined;
        return Response.json({
          ok: true,
          value: await operation(args, parent),
        });
      } catch (error) {
        return Response.json(
          {
            ok: false,
            error: error.code ?? "WORKFLOW_ERROR",
            detail: String(error.message).slice(0, 1000),
          },
          { status: error.code === "REVISION_CONFLICT" ? 409 : 400 },
        );
      }
    },
  });
  scheduler.start();
  ctx.effect(() => async () => {
    clearInterval(scheduler.timer);
    await engine.close();
    await scheduler.close();
    await Promise.allSettled(jobs);
    for (const h of owned.values()) await h.dispose();
    store.close();
  });
}
