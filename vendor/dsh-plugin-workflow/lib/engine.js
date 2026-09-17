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
  }) {
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
      outputs: {},
      nodes: {},
      createdAt: Date.now(),
      calls: 0,
    };
    if (this.store.get("run", run.id)) fail("RUN_EXISTS");
    this.store.updateRun(run, "run.queued");
    return this.drive(run, parent, signal);
  }
  async resume(id, parent, signal, response) {
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
        state.status = "pending";
      }
    }
    return this.drive(run, parent, signal);
  }
  async drive(run, parent, signal) {
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
    run.status = "running";
    run.startedAt ??= Date.now();
    run.error = null;
    this.store.updateRun(run, "run.started");
    try {
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
              : "failed";
      run.error = String(reason?.message ?? reason).slice(0, 3000);
    } finally {
      run.endedAt = Date.now();
      this.store.updateRun(run, `run.${run.status}`);
      this.active.delete(run.id);
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
      const batch = ready.slice(0, def.limits?.concurrency ?? 2);
      const results = await Promise.allSettled(
        batch.map(async (node) => {
          const key = prefix + node.id;
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
      if (Object.values(run.nodes).some(paused)) return local;
    }
    return def.outputs ? mapInputs(def.outputs, input, local) : local;
  }
  async executeNode(node, input, prepared, run, parent, signal, key, scope = {}) {
    const old = run.nodes[key];
    const attempts = old?.attempts ?? [];
    const state = (run.nodes[key] = {
      status: "running",
      input,
      effects:
        node.kind === "tool" || node.tools?.length
          ? "write"
          : (node.effects ?? "read-only"),
      attempts,
      ...(old?.interaction ? { interaction: old.interaction } : {}),
    });
    if (node.kind === "approval") {
      state.status = "waiting_approval";
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
      return this.executeInteraction(
        node,
        state,
        input,
        scope,
        prepared,
        run,
        parent,
        signal,
        key,
      );
    }
    const allowed = run.unattended?.tools ?? [];
    if (
      run.unattended &&
      !run.approvedTools?.includes(key) &&
      ((node.kind === "tool" && !allowed.includes(node.tool)) ||
        node.tools?.some((t) => !allowed.includes(t)))
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
      attempts.push(record);
      this.store.updateRun(run, "node.started", {
        nodeId: key,
        attempt: record.index,
      });
      const deadline = AbortSignal.any([
        signal,
        AbortSignal.timeout((node.timeoutSeconds ?? 600) * 1000),
      ]);
      try {
        let output;
        if (node.kind === "agent")
          output = await this.adapter.agent(
            node,
            input,
            prepared.routes[node.id],
            prepared.skills[node.id],
            parent,
            deadline,
          );
        else if (node.kind === "tool")
          output = await this.adapter.tool(node.tool, input, parent, deadline);
        else if (node.kind === "condition")
          output = { condition: evaluateCondition(node.condition, input) };
        else if (node.kind === "artifact") {
          const folder = join(this.directory, run.id);
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
          this.store.put("artifact", artifact.id, artifact);
          output = { artifact: artifact.id, text: content };
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
        if (
          Object.entries(run.nodes).some(
            ([id, s]) =>
              id.startsWith(`${key}/`) && s.status === "waiting_approval",
          )
        ) {
          state.status = "pending";
          return;
        }
        if (node.outputSchema)
          checkData(node.outputSchema, output, "OUTPUT_SCHEMA");
        record.endedAt = Date.now();
        record.status = "completed";
        state.output = output;
        state.status = "completed";
        this.store.updateRun(run, "node.completed", { nodeId: key });
        return output;
      } catch (error) {
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
  cancel(id, pause = false) {
    const c = this.active.get(id);
    if (!c) fail("RUN_NOT_ACTIVE");
    c.abort(
      Object.assign(new Error(pause ? "Paused" : "Cancelled"), {
        code: pause ? "PAUSED" : "CANCELLED",
      }),
    );
  }
  recover() {
    for (const run of this.store.list("run"))
      if (["queued", "running"].includes(run.status)) {
        run.status = "needs_attention";
        run.error = "Host restarted; review interrupted nodes before resuming.";
        this.store.updateRun(run, "run.interrupted");
      }
  }
  async close() {
    for (const c of this.active.values()) c.abort(new Error("Host stopped"));
    while (this.active.size) await delay(25);
  }
}
