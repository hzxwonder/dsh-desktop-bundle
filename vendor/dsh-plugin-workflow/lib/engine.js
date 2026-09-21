import { mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import {
  checkData,
  evaluateCondition,
  fail,
  mapInputs,
  validateDefinition,
} from "./definition.js";
import { uid, hash } from "./store.js";
import { Checkpoints } from "./checkpoints.js";
import { renderMaterial } from "./graph-edit.js";

const done = new Set(["completed", "skipped"]);
const paused = (state) =>
  state?.status === "waiting_approval" || state?.status === "waiting_input";
const isPresent = (value) => {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return Boolean(value.trim());
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
};
const textOf = (value) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(textOf).filter(Boolean).join("\n");
  if (value && typeof value === "object" && typeof value.text === "string")
    return value.text;
  return "";
};
const normalizeAnswer = (response) =>
  typeof response === "string"
    ? { text: response, attachments: [] }
    : {
        text: typeof response?.text === "string" ? response.text : "",
        attachments: Array.isArray(response?.attachments)
          ? response.attachments
          : [],
      };
const transcript = (answers = []) =>
  answers
    .map((answer, index) => {
      const files = (answer.attachments ?? []).map((a) => a.name).join(", ");
      return `${index + 1}. 用户：${answer.text}${files ? `（附件：${files}）` : ""}`;
    })
    .join("\n");
function judgePrompt(node, info) {
  return [
    "你是工作流里的交互判定 Agent，负责推进一次目标明确的双向澄清对话。用户看不到这段说明，只会看到你产出的 question 或 summary。",
    `交互目标：\n${node.prompt ?? ""}`,
    info.answers.length
      ? `已收集的对话：\n${transcript(info.answers)}`
      : "目前还没有收到用户的回答。",
    info.phase === "confirm" && info.summary
      ? `你上一轮提交的理解摘要（正在等待用户确认）：\n${info.summary}\n用户的最后一次回复就是对它的回应。`
      : "",
    `允许的用户回答轮次上限 ${info.maxTurns}，已使用 ${info.turns}。`,
    node.outputSchema
      ? `当 status=complete 时，必须同时返回符合这个 JSON Schema 的 result：\n${JSON.stringify(node.outputSchema)}`
      : "",
    [
      "判定规则：",
      "1. 只要还有影响目标达成的关键未知，返回 status=ask 与 question：只问一个具体问题，question 会原样呈现给用户。",
      "2. 当你有把握已经完全理解用户意图时，返回 status=confirm 与 summary：用可核对的语言完整复述你的理解（目标、范围、约束、验收标准、边界），结尾请用户确认。",
      "3. 上一轮已给出 summary 且用户认可、没有实质修正时，返回 status=complete 与同样的 summary。",
      "4. 用户对 summary 提出修正或否定时，按修正后的理解重新判断，返回 status=ask（新的问题）或 status=confirm（修正后的 summary）。",
      "5. 不要替用户编造答案，不要把工作流材料当成已经澄清的用户意图；不确定时继续提问。",
    ].join("\n"),
  ]
    .filter(Boolean)
    .join("\n\n");
}
const judgeSchema = (node) => ({
  type: "object",
  additionalProperties: false,
  required: ["status", "question", "summary"],
  properties: {
    status: { enum: ["ask", "confirm", "complete"] },
    question: { type: "string" },
    summary: { type: "string" },
    ...(node.outputSchema ? { result: node.outputSchema } : {}),
  },
});

export class Engine {
  constructor(store, adapter, directory) {
    this.store = store;
    this.adapter = adapter;
    this.directory = directory;
    this.active = new Map();
    this.starting = new Set();
    this.checkpoints = new Checkpoints(join(directory, "checkpoints"));
  }
  async prepare(snapshot, parent, rootRoute, signal, chain = []) {
    const def = snapshot.definition;
    validateDefinition(def);
    if (chain.includes(def.id) || chain.length > 8)
      fail("RECURSIVE_WORKFLOW", def.id);
    const prepared = {
      definition: def,
      revision: snapshot.revision,
      hash: snapshot.hash,
      routes: {},
      skills: {},
      children: {},
    };
    for (const node of def.nodes) {
      if (
        node.kind === "agent" ||
        (node.kind === "interact" && node.interaction === "goal")
      ) {
        prepared.routes[node.id] = await this.adapter.route(
          node,
          rootRoute,
          signal,
        );
        prepared.skills[node.id] = await this.adapter.skills(
          node.skills ?? [],
          parent,
          signal,
        );
        prepared.skills[node.id] = prepared.skills[node.id].map(skill => node.skillOverrides?.[skill.name] === undefined ? skill : {...skill, content:node.skillOverrides[skill.name], hash:hash(node.skillOverrides[skill.name])});
      }
      if (node.subagents?.length) {
        prepared.teams ??= {};
        prepared.teams[node.id] = await Promise.all(node.subagents.map(async member => ({
          node: member, route: await this.adapter.route(member, rootRoute, signal),
          skills: await this.adapter.skills(member.skills ?? [], parent, signal),
        })));
      }
      if (node.workflow) {
        const child = this.store.get(
          "revision",
          `${node.workflow.id}:${node.workflow.revision}`,
        );
        if (!child) fail("REVISION_NOT_FOUND", node.workflow.id);
        prepared.children[node.id] = await this.prepare(
          child,
          parent,
          rootRoute,
          signal,
          [...chain, def.id],
        );
      }
    }
    return prepared;
  }
  async start({
    workflowId,
    revision,
    input,
    parent,
    signal,
    rootRoute,
    unattended,
    runId,
    debug = false,
  }) {
    if (this.starting.has(parent.session.id) || this.store.list("run").some(r => r.sessionId === parent.session.id && ["queued", "running", "paused", "waiting_input", "waiting_approval"].includes(r.status))) fail("SESSION_RUN_ACTIVE");
    this.starting.add(parent.session.id);
    try {
    const snapshot = this.store.get("revision", `${workflowId}:${revision}`);
    if (!snapshot) fail("REVISION_NOT_FOUND");
    const options = rootRoute ?? this.adapter.rootRoute(parent);
    const prepared = await this.prepare(snapshot, parent, options, signal);
    checkData(prepared.definition.inputSchema ?? {}, input);
    const run = {
      id: runId ?? uid("run"),
      workflowId,
      revision,
      sessionId: parent.session.id,
      prepared,
      rootRoute: options,
      input,
      inputHash: hash(input),
      unattended: unattended ?? null,
      status: "queued",
      debug,
      checkpointRevision: 0,
      outputs: {},
      nodes: {},
      createdAt: Date.now(),
      calls: 0,
    };
    if (this.store.get("run", run.id)) fail("RUN_EXISTS");
    this.store.updateRun(run, "run.queued");
    return await this.drive(run, parent, signal);
    } finally { this.starting.delete(parent.session.id); }
  }
  async resume(id, parent, signal, response, options = {}) {
    const run = this.store.get("run", id);
    if (!run || this.active.has(id)) fail("RUN_NOT_RESUMABLE");
    if (
      ![
        "paused",
        "failed",
        "needs_attention",
        "waiting_approval",
        "waiting_input",
        "cancelled",
      ].includes(run.status)
    )
      fail("RUN_NOT_RESUMABLE");
    if (options.expectedRevision !== undefined && options.expectedRevision !== run.checkpointRevision) fail("RUN_CONFLICT");
    if (options.debug !== undefined) run.debug = options.debug;
    if (options.nodeId) run.nextNode = options.nodeId;
    run.debugBoundary = false;
    for (const [key, state] of Object.entries(run.nodes)) {
      if (state.status === "waiting_approval") {
        if (response === undefined) fail("APPROVAL_RESPONSE_REQUIRED", key);
        if (response === false) {
          run.status = "cancelled";
          return this.store.updateRun(run, "run.cancelled");
        }
        if (state.permissionGate) {
          state.status = "pending";
          run.approvedTools ??= [];
          run.approvedTools.push(key);
        } else {
          state.status = "completed";
          state.output = { approved: true, response };
          run.outputs[key] = state.output;
        }
      } else if (state.status === "waiting_input") {
        if (response === undefined) fail("INTERACTION_RESPONSE_REQUIRED", key);
        if (response === false) {
          run.status = "cancelled";
          return this.store.updateRun(run, "run.cancelled");
        }
        state.interaction ??= { answers: [], turns: 0, started: false };
        state.interaction.answers.push(normalizeAnswer(response));
        state.interaction.pending = true;
        state.status = "pending";
      } else if (!done.has(state.status)) {
        if (state.effects === "write" && response !== true)
          fail("EFFECT_RECONCILIATION_REQUIRED", key);
        if (state.status !== "stale") state.status = "pending";
      }
    }
    return this.drive(run, parent, signal);
  }
  async drive(run, parent, signal) {
    if (this.active.has(run.id)) fail("RUN_ACTIVE");
    const controller = new AbortController();
    const timeout = AbortSignal.timeout(
      (run.prepared.definition.limits?.timeoutSeconds ?? 3600) * 1000,
    );
    const combined = AbortSignal.any([
      controller.signal,
      timeout,
      ...(signal ? [signal] : []),
    ]);
    this.active.set(run.id, controller);
    let unlock;
    run.stepBudget = run.debug ? 1 : null;
    run.status = "running";
    run.startedAt ??= Date.now();
    run.error = null;
    this.store.updateRun(run, "run.started");
    try {
      if (parent.session.header?.cwd) unlock = await this.checkpoints.lock(parent.session.header.cwd, run.id);
      await this.executeGraph(
        run.prepared,
        run.input,
        run,
        parent,
        combined,
        "",
      );
      if (Object.values(run.nodes).some((n) => n.status === "waiting_approval"))
        run.status = "waiting_approval";
      else if (Object.values(run.nodes).some((n) => n.status === "waiting_input"))
        run.status = "waiting_input";
      else if (run.debugBoundary) run.status = "paused";
      else if (controller.signal.reason?.code === "PAUSED")
        run.status = "paused";
      else {
        run.status = "completed";
        run.result = run.prepared.definition.outputs
          ? mapInputs(run.prepared.definition.outputs, run.input, run.outputs)
          : run.outputs;
      }
    } catch (error) {
      const reason = combined.aborted ? combined.reason : error;
      run.status =
        reason?.code === "PAUSED"
          ? "paused"
          : combined.aborted && !timeout.aborted
            ? "cancelled"
            : error.code === "APPROVAL_REQUIRED"
              ? "waiting_approval"
              : error.code === 'REVIEW_LIMIT' ? 'needs_attention' : "failed";
      run.error = String(reason?.message ?? reason).slice(0, 3000);
    } finally {
      run.endedAt = Date.now();
      this.store.updateRun(run, `run.${run.status}`);
      this.active.delete(run.id);
      unlock?.();
    }
    return run;
  }
  async executeGraph(prepared, input, run, parent, signal, prefix) {
    const def = prepared.definition;
    checkData(def.inputSchema ?? {}, input);
    const local = {};
    for (const n of def.nodes)
      if (run.nodes[prefix + n.id]?.status === "completed")
        local[n.id] = run.nodes[prefix + n.id].output;
    const pending = new Set(
      def.nodes
        .filter((n) => !done.has(run.nodes[prefix + n.id]?.status))
        .map((n) => n.id),
    );
    while (pending.size) {
      signal.throwIfAborted();
      const ready = def.nodes.filter(
        (n) =>
          pending.has(n.id) &&
          def.edges
            .filter((e) => e.to === n.id)
            .every((e) => done.has(run.nodes[prefix + e.from]?.status)),
      );
      if (!ready.length) {
        if (Object.values(run.nodes).some(paused)) return local;
        fail("GRAPH_BLOCKED");
      }
      if (run.debug && run.stepBudget === 0) { run.debugBoundary = true; return local; }
      // Shared-directory checkpoints serialize graph steps; each step may run a parallel team.
      if (run.nextNode && !prefix) ready.sort((a, b) => (b.id === run.nextNode) - (a.id === run.nextNode));
      const batch = ready.slice(0, parent.session.header?.cwd || run.debug ? 1 : (def.limits?.concurrency ?? 2));
      const results = await Promise.allSettled(
        batch.map(async (node) => {
          const key = prefix + node.id;
          if (run.nextNode === key) delete run.nextNode;
          const incoming = def.edges.filter((e) => e.to === node.id);
          const activeEdges = incoming.filter(
            (e) =>
              run.nodes[prefix + e.from]?.status === "completed" &&
              (!e.on ||
                e.on === "success" ||
                String(local[e.from]?.condition) === e.on),
          );
          if (incoming.length && activeEdges.length === 0) {
            run.nodes[key] = { status: "skipped" };
            this.store.updateRun(run, "node.skipped", { nodeId: key });
            return;
          }
          if (paused(run.nodes[key])) return;
          if (node.repeat && (run.reviews?.[key]?.length ?? 0) >= node.repeat.maxRounds && !run.reviews[key].at(-1).accepted) fail('REVIEW_LIMIT', key);
          if (run.debug && !["subworkflow", "loop"].includes(node.kind)) run.stepBudget--;
          const mapped = mapInputs(node.input, input, local);
          const output = await this.executeNode(
            node,
            mapped,
            prepared,
            run,
            parent,
            signal,
            key,
            { input, local },
          );
          if (run.nodes[key].status === "completed") {
            local[node.id] = output;
            run.outputs[key] = output;
          }
        }),
      );
      batch.forEach((n) => pending.delete(n.id));
      const rejected = results.find((r) => r.status === "rejected");
      if (rejected) throw rejected.reason;
      for (const node of batch) {
        const key = prefix + node.id;
        if (!node.repeat || run.nodes[key]?.status !== 'completed') continue;
        const history = (run.reviews ??= {})[key] ??= [];
        const attempt = run.nodes[key].attempts.length;
        if (history.at(-1)?.attempt === attempt) continue;
        const accepted = evaluateCondition(node.repeat.until, local[node.id]);
        history.push({ round: history.length + 1, attempt, accepted, output: structuredClone(local[node.id]) });
        this.store.updateRun(run, 'review.completed', { nodeId: key, round: history.length, accepted });
        if (accepted) continue;
        if (history.length >= node.repeat.maxRounds) {
          // Keep the review pending so resuming cannot bypass the quality gate.
          run.nodes[key].status = 'needs_attention';
          fail('REVIEW_LIMIT', key);
        }
        const affected = new Set([node.repeat.target]);
        let changed = true;
        while (changed) { changed = false; for (const e of def.edges) if (affected.has(e.from) && !affected.has(e.to)) { affected.add(e.to); changed = true; } }
        for (const id of affected) {
          const state = run.nodes[prefix + id];
          if (state) {
            state.status = 'pending';
            state.resumeSessionId = node.repeat.sessionMode === 'continue' ? state.sessionId : undefined;
            state.resumeMemberSessions = node.repeat.sessionMode === 'continue' ? Object.fromEntries(Object.entries(state.subagents ?? {}).filter(([, m]) => m.sessionId).map(([id, m]) => [id, m.sessionId])) : {};
            state.feedback = { round: history.length + 1, review: local[node.id] };
          }
          delete run.outputs[prefix + id];
          pending.add(id);
        }
        for (const id of affected) delete local[id];
        this.store.updateRun(run, 'review.repeating', { nodeId: key, target: node.repeat.target, sessionMode: node.repeat.sessionMode });
      }
      if (Object.values(run.nodes).some(paused) || run.debugBoundary) return local;
    }
    return def.outputs ? mapInputs(def.outputs, input, local) : local;
  }
  async executeNode(node, input, prepared, run, parent, signal, key, scope = {}) {
    const override = run.stepOverrides?.[key];
    if (override) node = { ...node, prompt: override.prompt };
    const inherited = [];
    const collect = value => {
      if (!value || typeof value !== 'object') return;
      if (value.type && ['file', 'image'].includes(value.type) && value.attachment?.attachmentId) inherited.push(value);
      else if (value.artifact) {
        const artifact = this.store.get('artifact', value.artifact);
        if (artifact?.attachment) inherited.push(artifact.attachment);
      }
      for (const [name, child] of Object.entries(value)) if (name !== 'attachment') {
        if (Array.isArray(child)) child.forEach(collect); else if (child && typeof child === 'object') collect(child);
      }
    };
    collect(input);
    // Files produced by an incoming step remain material even when its text is mapped separately.
    for (const edge of prepared.definition.edges.filter(e => e.to === node.id)) collect(run.outputs[key.slice(0, -node.id.length) + edge.from]);
    const attachments = [...new Map([...inherited, ...(override?.attachments ?? [])].map(a => [a.attachment.attachmentId, a])).values()];
    if (attachments.length) input = { ...input, attachments };
    const old = run.nodes[key];
    if (old?.feedback) input = { ...input, revisionFeedback: old.feedback };
    const attempts = old?.attempts ?? [];
    const state = (run.nodes[key] = {
      status: "running",
      input,
      prompt: node.prompt ?? "",
      effects:
        node.kind === "tool" || node.kind === 'publish' || node.tools?.length
          ? "write"
          : (node.effects ?? "read-only"),
      attempts,
      ...(old?.resumeSessionId ? { resumeSessionId: old.resumeSessionId } : {}),
      ...(old?.resumeMemberSessions ? { resumeMemberSessions: old.resumeMemberSessions } : {}),
      ...(old?.feedback ? { feedback: old.feedback } : {}),
      ...(old?.interaction ? { interaction: old.interaction } : {}),
      name: node.name, kind: node.kind, route: prepared.routes[node.id] ?? null,
    });
    if (node.kind === "approval") {
      state.status = "waiting_approval";
      const record = { index: attempts.length + 1, startedAt: Date.now(), status: 'waiting_approval' };
      record.folder = this.checkpoints.folder(run.id, key, record.index); attempts.push(record);
      await this.checkpoints.begin(null, record.folder, { prompt: node.prompt ?? "", material: input });
      record.checkpoint = await this.checkpoints.finish(null, record.folder, { awaitingApproval: true });
      this.store.updateRun(run, "node.waiting_approval", { nodeId: key });
      return;
    }
    if (node.kind === "interact") {
      if (run.unattended) {
        state.status = "failed";
        state.error = "INTERACTION_UNATTENDED";
        this.store.updateRun(run, "node.failed", {
          nodeId: key,
          error: state.error,
        });
        fail("INTERACTION_UNATTENDED", key);
      }
      const record = { index: attempts.length + 1, startedAt: Date.now() };
      record.folder = this.checkpoints.folder(run.id, key, record.index); attempts.push(record);
      const before = await this.checkpoints.begin(parent.session.header?.cwd, record.folder, { prompt: node.prompt ?? "", material: input });
      try {
        const output = await this.executeInteraction(node, state, input, scope, prepared, run, parent, signal, key);
        record.checkpoint = await this.checkpoints.finish(before, record.folder, output ?? state.interaction);
        record.status = state.status; record.endedAt = Date.now(); run.checkpointRevision++;
        this.store.updateRun(run, 'node.interaction_checkpoint', { nodeId: key });
        return output;
      } catch (error) {
        record.status = 'failed'; record.error = String(error.message);
        record.checkpoint = await this.checkpoints.finish(before, record.folder, null).catch(e => ({ folder: record.folder, error: e.code ?? e.message }));
        this.store.updateRun(run, 'node.failed', { nodeId: key }); throw error;
      }
    }
    const allowed = run.unattended?.tools ?? [];
    if (
      run.unattended &&
      !run.approvedTools?.includes(key) &&
      ((node.kind === 'publish' && !allowed.includes('halo_publish')) || (node.kind === "tool" && !allowed.includes(node.tool)) ||
        node.tools?.some((t) => !allowed.includes(t)) ||
        node.subagents?.some(m => m.tools?.some(t => !allowed.includes(t))))
    ) {
      state.status = "waiting_approval";
      state.permissionGate = true;
      this.store.updateRun(run, "node.waiting_approval", { nodeId: key });
      return;
    }
    const maximum = state.effects === "write" ? 1 : (node.maxAttempts ?? 1);
    for (let attempt = 0; attempt < maximum; attempt++) {
      signal.throwIfAborted();
      if (++run.calls > (run.prepared.definition.limits?.maxNodeCalls ?? 100))
        fail("CALL_BUDGET");
      const record = {
        index: attempts.length + 1,
        startedAt: Date.now(),
        route: prepared.routes[node.id] ?? null,
      };
      record.folder = this.checkpoints.folder(run.id, key, record.index);
      attempts.push(record);
      this.store.updateRun(run, "node.started", {
        nodeId: key,
        attempt: record.index,
      });
      const deadline = AbortSignal.any([
        signal,
        AbortSignal.timeout((node.timeoutSeconds ?? 600) * 1000),
      ]);
      let before;
      try {
        // Container steps delegate checkpoints to their leaf steps to avoid overlapping patches.
        before = await this.checkpoints.begin(['subworkflow', 'loop'].includes(node.kind) ? null : parent.session.header?.cwd, record.folder, { prompt: node.prompt ?? "", material: input });
        let output;
        if (node.kind === "agent") {
          if (prepared.teams?.[node.id]?.length) {
            state.subagents = {};
            const remaining = new Set(prepared.teams[node.id].map(m => m.node.id));
            const memberOutputs = {};
            while (remaining.size) {
              const ready = prepared.teams[node.id].filter(m => remaining.has(m.node.id) && (m.node.dependsOn ?? []).every(id => Object.hasOwn(memberOutputs, id)));
              if (!ready.length) fail('SUBAGENT_GRAPH_BLOCKED', key);
              const team = await Promise.allSettled(ready.map(async member => {
              if (++run.calls > (run.prepared.definition.limits?.maxNodeCalls ?? 100)) fail('CALL_BUDGET');
              const memberState = state.subagents[member.node.id] = { name: member.node.name, status: "running", route: member.route };
              try {
                const memberInput = member.node.input === undefined ? input : mapInputs(member.node.input, input, memberOutputs);
                memberState.input = memberInput;
                memberState.output = await this.adapter.agent(member.node, memberInput, member.route, member.skills, parent, deadline, {
                  sessionId: old?.resumeMemberSessions?.[member.node.id],
                  onTrace: events => { memberState.trace = events; },
                  onSession: info => { Object.assign(memberState, info); this.store.updateRun(run, "subagent.started", { nodeId: key, memberId: member.node.id }); },
                });
                memberState.status = "completed";
                return [member.node.id, memberState.output];
              } catch (error) { memberState.status = "failed"; memberState.error = String(error.message); throw error; }
              finally { this.store.updateRun(run, "subagent.settled", { nodeId: key, memberId: member.node.id }); }
            }));
            const failure = team.find(r => r.status === "rejected");
            if (failure) throw failure.reason;
              for (const result of team) { memberOutputs[result.value[0]] = result.value[1]; remaining.delete(result.value[0]); }
            }
            input = { ...input, subagents: memberOutputs };
          }
          output = node.resultMember ? input.subagents[node.resultMember] : await this.adapter.agent(
            node,
            input,
            prepared.routes[node.id],
            prepared.skills[node.id],
            parent,
            deadline,
            { sessionId: old?.resumeSessionId, onTrace: events => { state.trace = events; }, onSession: info => { Object.assign(state, info); record.sessionId = info.sessionId; this.store.updateRun(run, "node.session", { nodeId: key }); } },
          );
        } else if (node.kind === 'publish') {
          if (!this.adapter.publish) fail('PUBLISH_UNAVAILABLE');
          output = await this.adapter.publish(input, deadline);
        } else if (node.kind === "tool")
          output = await this.adapter.tool(node.tool, input, parent, deadline);
        else if (node.kind === "condition")
          output = { condition: evaluateCondition(node.condition, input) };
        else if (node.kind === "artifact") {
          const folder = record.folder;
          await mkdir(folder, { recursive: true, mode: 0o700 });
          const extension =
            node.format === "application/json"
              ? "json"
              : node.format === "text/plain"
                ? "txt"
                : "md";
          const path = join(
            folder,
            `${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.${extension}`,
          );
          const content =
            typeof input.content === "string"
              ? input.content
              : JSON.stringify(input.content ?? input, null, 2);
          await writeFile(path, content, { mode: 0o600 });
          await stat(path);
          const artifact = {
            id: uid("artifact"),
            runId: run.id,
            path,
            name: `${node.name}.${extension}`,
            mediaType: node.format ?? "text/markdown",
            bytes: Buffer.byteLength(content),
          };
          if (this.adapter.file) artifact.attachment = await this.adapter.file(path, artifact.name);
          this.store.put("artifact", artifact.id, artifact);
          output = { artifact: artifact.id, text: content, ...(artifact.attachment ? { attachments: [artifact.attachment] } : {}) };
        } else if (node.kind === "subworkflow")
          output = await this.executeGraph(
            prepared.children[node.id],
            input,
            run,
            parent,
            deadline,
            `${key}/`,
          );
        else if (node.kind === "loop") {
          if (!Array.isArray(input.items) || input.items.length > node.maxItems)
            fail("LOOP_INPUT_LIMIT", key);
          const values = [];
          for (let i = 0; i < input.items.length; i++)
            values.push(
              await this.executeGraph(
                prepared.children[node.id],
                { item: input.items[i], index: i, ...input.context },
                run,
                parent,
                deadline,
                `${key}/${i}/`,
              ),
            );
          output = { items: values };
        } else output = input;
        deadline.throwIfAborted();
        if (run.debugBoundary ||
          Object.entries(run.nodes).some(
            ([id, s]) =>
              id.startsWith(`${key}/`) && paused(s),
          )
        ) {
          state.status = "pending";
          return;
        }
        if (node.outputSchema)
          checkData(node.outputSchema, output, "OUTPUT_SCHEMA");
        record.output = structuredClone(output);
        if (state.subagents) record.subagents = Object.fromEntries(Object.entries(state.subagents).map(([id, { trace, ...member }]) => [id, structuredClone(member)]));
        if (node.exportMarkdown && typeof output?.text === 'string') {
          const path = join(record.folder, 'article.md');
          await writeFile(path, output.text, { mode: 0o600 });
          const artifact = { id: uid('artifact'), runId: run.id, path, name: 'article.md', mediaType: 'text/markdown', bytes: Buffer.byteLength(output.text) };
          if (this.adapter.file) { artifact.attachment = await this.adapter.file(path, artifact.name); output.attachments = [artifact.attachment]; }
          this.store.put('artifact', artifact.id, artifact);
        }
        record.checkpoint = await this.checkpoints.finish(before, record.folder, output);
        if (this.adapter.file && output && typeof output === 'object' && record.checkpoint.root) {
          const files = [];
          for (const change of record.checkpoint.changes.filter(c => c.afterHash && !/(^|\/)(\.env(?:\.|$)|\.ssh|credentials|secrets)(\/|\.|$)|\.(pem|key|p12|pfx)$/i.test(c.path)).slice(0, 12)) {
            const path = join(record.checkpoint.root, change.path);
            if ((await stat(path)).size <= 8 * 1024 * 1024) files.push(await this.adapter.file(path, change.path.split('/').at(-1)));
          }
          if (files.length) {
            output = { ...output, attachments: [...new Map([...(output.attachments ?? []), ...files].map(b => [b.attachment.attachmentId, b])).values()] };
            await this.checkpoints.save(record.folder, 'output.json', output);
          }
        }
        record.endedAt = Date.now();
        record.status = "completed";
        run.checkpointRevision = (run.checkpointRevision ?? 0) + 1;
        state.output = output;
        state.status = "completed";
        this.store.updateRun(run, "node.completed", { nodeId: key });
        return output;
      } catch (error) {
        if (before) record.checkpoint = await this.checkpoints.finish(before, record.folder, null).catch(e => ({ folder: record.folder, error: e.code ?? e.message }));
        record.status = "failed";
        record.endedAt = Date.now();
        record.error = String(error.message).slice(0, 2000);
        state.status = "failed";
        this.store.updateRun(run, "node.failed", {
          nodeId: key,
          error: record.error,
        });
        const transient = /429|503|502|ECONNRESET|ETIMEDOUT|RATE_LIMIT/.test(
          String(error.message),
        );
        if (deadline.aborted || !transient || attempt + 1 >= maximum)
          throw error;
        state.status = "retrying";
        await delay(Math.min(1000 * 2 ** attempt, 8000), undefined, { signal });
      }
    }
  }
  // A person answers inside the bound conversation: the node parks in
  // `waiting_input`, the Host hands the next user message to `resume`, and the
  // graph continues from this node. `once` accepts a single answer; `goal`
  // keeps asking until the judging agent understands the intent and the user
  // confirms that understanding.
  async executeInteraction(
    node,
    state,
    input,
    scope,
    prepared,
    run,
    parent,
    signal,
    key,
  ) {
    try {
      const mode = node.interaction === "goal" ? "goal" : "once";
      const maxTurns = node.maxTurns ?? (mode === "goal" ? 8 : 1);
      const info = (state.interaction ??= {
        mode,
        started: false,
        turns: 0,
        answers: [],
        pending: false,
        phase: "ask",
        question: null,
        summary: null,
      });
      info.mode = mode;
      info.maxTurns = maxTurns;
      if (!info.started) {
        info.started = true;
        const provided = this.providedValue(node, scope);
        if (isPresent(provided))
          return this.completeInteraction(node, state, run, key, {
            provided: true,
            complete: true,
            turns: 0,
            text: this.providedText(input, provided),
            answers: [],
          });
        if (mode === "once") {
          info.question = renderMaterial(node.prompt ?? "", input);
          info.phase = "ask";
          return this.waitForInput(state, run, key, info);
        }
      } else if (!info.pending)
        return this.waitForInput(state, run, key, info);
      else {
        info.pending = false;
        info.turns += 1;
      }
      if (mode === "once")
        return this.completeInteraction(node, state, run, key, {
          provided: false,
          complete: true,
          turns: info.turns,
          text: info.answers.map((a) => a.text).join("\n\n"),
          answers: info.answers,
        });
      const decision = await this.judge(
        node,
        info,
        input,
        prepared,
        run,
        parent,
        signal,
      );
      const output = {
        provided: false,
        complete: decision.status === "complete",
        turns: info.turns,
        text: info.answers.map((a) => a.text).join("\n\n"),
        answers: info.answers,
        summary:
          decision.status === "ask" ? null : (decision.summary ?? null),
        ...(node.outputSchema && decision.status === "complete"
          ? { result: decision.result }
          : {}),
      };
      if (decision.status === "complete") {
        if (node.outputSchema)
          checkData(node.outputSchema, decision.result, "OUTPUT_SCHEMA");
        return this.completeInteraction(node, state, run, key, output);
      }
      if (info.turns >= maxTurns) {
        this.store.updateRun(run, "node.interaction_limit", {
          nodeId: key,
          turns: info.turns,
          maxTurns,
        });
        return this.completeInteraction(node, state, run, key, output);
      }
      info.phase = decision.status;
      info.question =
        decision.status === "confirm" ? decision.summary : decision.question;
      if (decision.status === "confirm") info.summary = decision.summary;
      return this.waitForInput(state, run, key, info);
    } catch (error) {
      state.status = "failed";
      state.error = String(error.message).slice(0, 2000);
      this.store.updateRun(run, "node.failed", {
        nodeId: key,
        error: state.error,
      });
      throw error;
    }
  }
  providedValue(node, scope) {
    if (!node.provided) return undefined;
    try {
      return mapInputs(
        { provided: node.provided },
        scope.input,
        scope.local,
      ).provided;
    } catch {
      return undefined;
    }
  }
  providedText(input, provided) {
    for (const value of Object.values(input ?? {}))
      if (typeof value === "string" && value.trim()) return value;
    const text = textOf(provided);
    return text.trim() ? text : JSON.stringify(provided ?? null);
  }
  waitForInput(state, run, key, info) {
    state.status = "waiting_input";
    this.store.updateRun(run, "node.waiting_input", {
      nodeId: key,
      phase: info.phase,
      turns: info.turns,
      maxTurns: info.maxTurns,
      question: info.question,
    });
  }
  completeInteraction(node, state, run, key, output) {
    state.status = "completed";
    state.output = output;
    state.interaction.phase = "done";
    state.interaction.question = null;
    this.store.updateRun(run, "node.completed", { nodeId: key });
    return output;
  }
  async judge(node, info, input, prepared, run, parent, signal) {
    if (++run.calls > (run.prepared.definition.limits?.maxNodeCalls ?? 100))
      fail("CALL_BUDGET");
    const decision = await this.adapter.agent(
      {
        ...node,
        kind: "agent",
        name: `${node.name} · 判定`,
        prompt: judgePrompt(node, info),
        tools: [],
        outputSchema: judgeSchema(node),
      },
      input,
      prepared.routes[node.id],
      prepared.skills[node.id] ?? [],
      parent,
      signal,
    );
    if (!["ask", "confirm", "complete"].includes(decision?.status))
      fail("INTERACTION_DECISION", String(decision?.status));
    if (decision.status === "ask" && !decision.question?.trim())
      fail("INTERACTION_DECISION", "ask without question");
    if (decision.status !== "ask" && !decision.summary?.trim())
      fail("INTERACTION_DECISION", `${decision.status} without summary`);
    if (decision.status === "complete" && node.outputSchema && decision.result === undefined)
      fail("STRUCTURED_OUTPUT_MISSING");
    return decision;
  }
  descendants(run, nodeId, include = true) {
    const ids = new Set(include ? [nodeId] : []), queue = [nodeId];
    while (queue.length) {
      const id = queue.shift();
      for (const edge of run.prepared.definition.edges.filter(e => e.from === id))
        if (!ids.has(edge.to)) { ids.add(edge.to); queue.push(edge.to); }
    }
    return ids;
  }
  async rewind(id, nodeId, options = {}) {
    const run = this.store.get('run', id);
    if (!run || this.active.has(id)) fail('RUN_NOT_RESUMABLE');
    if (options.expectedRevision !== undefined && options.expectedRevision !== run.checkpointRevision) fail('RUN_CONFLICT');
    if (!run.prepared.definition.nodes.some(n => n.id === nodeId)) fail('NODE_NOT_FOUND');
    const ids = this.descendants(run, nodeId, options.include !== false);
    const entries = Object.entries(run.nodes).filter(([key]) => ids.has(key.split('/')[0]));
    if (entries.some(([, n]) => (n.attempts ?? []).some(a => !a.reverted && a.checkpoint?.error))) fail('CHECKPOINT_INCOMPLETE');
    const checkpoints = entries.flatMap(([, n]) => (n.attempts ?? []).filter(a => !a.reverted && a.checkpoint).map(a => ({ a, ...a.checkpoint })))
      .sort((a, b) => b.a.startedAt - a.a.startedAt);
    this.active.set(id, new AbortController());
    let unlock;
    try {
      if (checkpoints[0]?.root) unlock = await this.checkpoints.lock(checkpoints[0].root, id);
      await this.checkpoints.rollback(checkpoints);
      for (const { a } of checkpoints) a.reverted = true;
      for (const [key, state] of entries) {
        state.previousOutput = state.output;
        state.status = 'stale';
        delete state.output;
        delete state.interaction;
        delete state.resumeSessionId;
        delete state.resumeMemberSessions;
        delete state.feedback;
        if (run.reviews?.[key]) {
          (run.reviewHistory ??= []).push({ nodeId: key, rounds: run.reviews[key] });
          delete run.reviews[key];
        }
        delete run.outputs[key];
      }
      run.status = 'paused';
      run.debugBoundary = false;
      run.result = null;
      run.checkpointRevision = (run.checkpointRevision ?? 0) + 1;
      options.commit?.(run);
      return this.store.updateRun(run, options.commit ? 'node.output_adopted' : 'run.rewound', { nodeId, include: options.include !== false });
    } finally { unlock?.(); this.active.delete(id); }
  }
  async adopt(id, nodeId, output, options = {}) {
    const initial = this.store.get('run', id);
    if (!initial || this.active.has(id)) fail('RUN_NOT_RESUMABLE');
    const node = initial.prepared.definition.nodes.find(n => n.id === nodeId);
    if (!node || !initial.nodes[nodeId] || initial.nodes[nodeId].status !== 'completed') fail('NODE_NOT_COMPLETED');
    if (node.outputSchema) checkData(node.outputSchema, output, 'OUTPUT_SCHEMA');
    return this.rewind(id, nodeId, { ...options, include: false, commit: run => {
      run.nodes[nodeId].outputHistory ??= [];
      run.nodes[nodeId].outputHistory.push({ output: run.nodes[nodeId].output, at: Date.now() });
      run.nodes[nodeId].output = output;
      run.outputs[nodeId] = output;
    } });
  }

  cancel(id, pause = false) {
    const c = this.active.get(id);
    if (!c) fail("RUN_NOT_ACTIVE");
    c.abort(
      Object.assign(new Error(pause ? "Paused" : "Cancelled"), {
        code: pause ? "PAUSED" : "CANCELLED",
      }),
    );
  }
  async recover() {
    const recoveryError = await this.checkpoints.recover();
    for (const run of this.store.list("run"))
      if (recoveryError || ["queued", "running"].includes(run.status)) {
        run.status = "needs_attention";
        run.error = recoveryError ? 'CHECKPOINT_RECOVERY_REQUIRED: inspect the rollback journal and workspace before continuing.' : "Host restarted; review interrupted nodes before resuming.";
        this.store.updateRun(run, "run.interrupted");
      }
  }
  async close() {
    for (const c of this.active.values()) c.abort(new Error("Host stopped"));
    while (this.active.size) await delay(25);
  }
}
