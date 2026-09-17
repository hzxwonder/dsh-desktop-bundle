import { Cron } from "croner";
import { fail } from "./definition.js";
import { uid } from "./store.js";

export function nextAt(plan, after = Date.now()) {
  if (plan.kind === "once") {
    const at = Date.parse(plan.at);
    if (!Number.isFinite(at)) fail("INVALID_DATE");
    return at > after ? at : null;
  }
  if (plan.kind === "interval") {
    if (!Number.isSafeInteger(plan.seconds) || plan.seconds < 60)
      fail("INTERVAL_MINIMUM_60");
    const period = plan.seconds * 1000;
    const anchor = plan.anchorAt ?? after;
    return anchor + (Math.floor((after - anchor) / period) + 1) * period;
  }
  if (plan.kind !== "cron") fail("SCHEDULE_KIND");
  new Intl.DateTimeFormat("en", { timeZone: plan.timezone }).format();
  if (
    typeof plan.cron !== "string" ||
    plan.cron.trim().split(/\s+/).length !== 5
  )
    fail("CRON_FIVE_FIELDS");
  const cron = new Cron(plan.cron, { timezone: plan.timezone, paused: true });
  const wallCron = new Cron(plan.cron, { timezone: "UTC", paused: true });
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: plan.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  try {
    let candidate = cron.nextRun(new Date(after));
    // Check the actual wall time to skip nonexistent DST times shifted by Croner.
    for (let i = 0; candidate && i < 5; i++) {
      const parts = Object.fromEntries(
        formatter.formatToParts(candidate).map((p) => [p.type, p.value]),
      );
      const wall = Date.UTC(
        +parts.year,
        +parts.month - 1,
        +parts.day,
        +parts.hour,
        +parts.minute,
      );
      if (wallCron.nextRun(new Date(wall - 1))?.getTime() === wall)
        return candidate.getTime();
      candidate = cron.nextRun(candidate);
    }
    if (candidate) fail("SCHEDULE_TIME_RESOLUTION");
    return null;
  } finally {
    cron.stop();
    wallCron.stop();
  }
}
export class Scheduler {
  constructor(store, dispatch, { clock = Date.now } = {}) {
    this.store = store;
    this.dispatch = dispatch;
    this.clock = clock;
    this.owner = uid("host");
    this.busy = false;
    this.pending = new Set();
  }
  save(plan, expectedRevision = 0) {
    plan = {...plan, ...(plan.kind === 'interval' ? {anchorAt: plan.anchorAt ?? this.clock()} : {}), pendingAt: null};
    const workflow = this.store.get("workflow", plan.workflowId);
    if (
      !workflow ||
      workflow.archived ||
      !this.store.get("revision", `${plan.workflowId}:${plan.workflowRevision}`)
    )
      fail("WORKFLOW_UNAVAILABLE");
    if (!plan.cwd?.startsWith("/")) fail("WORKSPACE_REQUIRED");
    if (!plan.rootRoute?.provider || !plan.rootRoute?.model)
      fail("SCHEDULE_MODEL_REQUIRED");
    if (!plan.input || typeof plan.input !== "object")
      fail("SCHEDULE_INPUT_REQUIRED");
    if (
      !["skip", "latest"].includes(plan.missed ?? "skip") ||
      !["skip", "latest"].includes(plan.overlap ?? "skip")
    )
      fail("SCHEDULE_POLICY");
    const next = nextAt(plan, this.clock());
    if (plan.enabled && next === null) fail("SCHEDULE_NO_FUTURE");
    return this.store.transaction(() => {
      const id = plan.id ?? uid("schedule");
      const old = this.store.get("schedule", id);
      if ((old?.revision ?? 0) !== expectedRevision) fail("REVISION_CONFLICT");
      return this.store.put("schedule", id, {
        ...plan,
        id,
        revision: expectedRevision + 1,
        nextAt: next,
        missed: plan.missed ?? "skip",
        overlap: plan.overlap ?? "skip",
        tools: plan.tools ?? [],
        updatedAt: this.clock(),
      });
    });
  }
  async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      const now = this.clock();
      if (!this.store.claim("scheduler", this.owner, now, 15000)) return;
      for (const plan of this.store.list("schedule").filter((p) => p.enabled)) {
        const wf = this.store.get("workflow", plan.workflowId);
        if (!wf || wf.archived) {
          this.store.put("schedule", plan.id, {
            ...plan,
            enabled: false,
            error: "WORKFLOW_UNAVAILABLE",
          });
          continue;
        }
        const active = this.store
          .list("occurrence")
          .some(
            (o) =>
              o.scheduleId === plan.id &&
              ["queued", "running", "paused", "waiting_approval", "needs_attention"].includes(this.store.get('run', o.runId)?.status ?? o.status),
          );
        const due = plan.nextAt != null && plan.nextAt <= now;
        const pending = plan.pendingAt != null && !active;
        if (!due && !pending) continue;
        let at = due ? plan.nextAt : plan.pendingAt;
        if (due && plan.missed === 'latest' && plan.kind === 'interval') at += Math.floor((now-at)/(plan.seconds*1000))*plan.seconds*1000;
        const id = `${plan.id}:${at}`;
        const late =
          due && now - at > (plan.maxLatenessSeconds ?? 120) * 1000;
        const occurrence = this.store.transaction(() => {
          const current = this.store.get("schedule", plan.id);
          if (
            current.revision !== plan.revision ||
            this.store.get("occurrence", id)
          )
            return;
          if (active && plan.overlap === "latest") current.pendingAt = at;
          if (pending) current.pendingAt = null;
          if (due) current.nextAt = nextAt(plan, now);
          if (current.nextAt == null && current.pendingAt == null)
            current.enabled = false;
          this.store.put("schedule", plan.id, current);
          const status = active
            ? "skipped"
            : late && plan.missed === "skip"
              ? "missed"
              : "queued";
          const item = {
            id,
            scheduleId: plan.id,
            scheduledAt: at,
            status,
            createdAt: now,
            plan: structuredClone(plan),
            sessionId: uid("scheduled"),
            runId: uid("run"),
          };
          if (active && plan.overlap === "latest") return;
          this.store.put("occurrence", id, item);
          return item;
        });
        if (occurrence?.status === "queued") this.launch(occurrence);
      }
    } finally {
      this.busy = false;
    }
  }
  launch(occurrence) {
    const task = (async () => {
      occurrence.status = "running";
      this.store.put("occurrence", occurrence.id, occurrence);
      try {
        const result = await this.dispatch(occurrence);
        occurrence.status = result.status;
        occurrence.runId = result.id;
      } catch (error) {
        occurrence.status = "failed";
        occurrence.error = String(error.message).slice(0, 2000);
      } finally {
        occurrence.endedAt = this.clock();
        this.store.put("occurrence", occurrence.id, occurrence);
      }
    })();
    this.pending.add(task);
    task.finally(() => this.pending.delete(task));
  }
  recover() {
    for (const o of this.store.list("occurrence"))
      if (["queued", "running"].includes(o.status))
        this.store.put("occurrence", o.id, {
          ...o,
          status: "needs_attention",
          error: "Interrupted dispatch; inspect the linked session and run.",
        });
  }
  start() {
    this.timer = setInterval(
      () =>
        void this.tick().catch((error) => {
          this.lastError = error.message;
        }),
      1000,
    );
    this.timer.unref();
  }
  async close() {
    clearInterval(this.timer);
    await Promise.allSettled(this.pending);
    this.store.release("scheduler", this.owner);
  }
}
