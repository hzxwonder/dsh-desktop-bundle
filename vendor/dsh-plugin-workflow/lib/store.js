import { DatabaseSync } from "node:sqlite";
import { mkdirSync, chmodSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { fail, validateDefinition } from "./definition.js";

export const hash = (value) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export class Store {
  constructor(path) {
    if (path !== ":memory:")
      mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
    if (path !== ":memory:") chmodSync(path, 0o600);
    this.db
      .exec(`CREATE TABLE IF NOT EXISTS documents (kind TEXT NOT NULL,id TEXT NOT NULL,value TEXT NOT NULL,PRIMARY KEY(kind,id));
      CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT,run_id TEXT NOT NULL,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS claims (id TEXT PRIMARY KEY,owner TEXT NOT NULL,until_ms INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY,value TEXT NOT NULL);
      INSERT OR IGNORE INTO metadata VALUES ('schema','1');`);
    if (
      this.db.prepare("SELECT value FROM metadata WHERE key='schema'").get()
        .value !== "1"
    )
      fail("STORE_VERSION");
  }
  transaction(fn) {
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const value = fn();
      this.db.exec("COMMIT");
      return value;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  get(kind, id) {
    const row = this.db
      .prepare("SELECT value FROM documents WHERE kind=? AND id=?")
      .get(kind, id);
    return row && JSON.parse(row.value);
  }
  list(kind) {
    return this.db
      .prepare("SELECT value FROM documents WHERE kind=? ORDER BY rowid DESC")
      .all(kind)
      .map((r) => JSON.parse(r.value));
  }
  put(kind, id, value) {
    this.db
      .prepare(
        "INSERT INTO documents VALUES (?,?,?) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value",
      )
      .run(kind, id, JSON.stringify(value));
    return value;
  }
  remove(kind, id) {
    this.db
      .prepare("DELETE FROM documents WHERE kind=? AND id=?")
      .run(kind, id);
  }
  save(def, expectedRevision = 0) {
    validateDefinition(def);
    return this.transaction(() => {
      const old = this.get("workflow", def.id);
      if ((old?.revision ?? 0) !== expectedRevision)
        fail("REVISION_CONFLICT", String(old?.revision ?? 0));
      const revision = expectedRevision + 1;
      const snapshot = {
        definition: structuredClone(def),
        revision,
        hash: hash(def),
        createdAt: Date.now(),
      };
      this.put("revision", `${def.id}:${revision}`, snapshot);
      return this.put("workflow", def.id, {
        id: def.id,
        name: def.name,
        description: def.description ?? "",
        icon: def.icon ?? "workflow",
        revision,
        published: old?.published ?? null,
        archived: old?.archived ?? false,
        updatedAt: Date.now(),
      });
    });
  }
  publish(id, revision) {
    return this.transaction(() => {
      const item = this.get("workflow", id);
      if (!item || item.revision !== revision) fail("REVISION_CONFLICT");
      validateDefinition(this.get("revision", `${id}:${revision}`).definition);
      return this.put("workflow", id, { ...item, published: revision });
    });
  }
  bind(sessionId, id, revision, mode = "run") {
    const workflow = this.get("workflow", id);
    if (!workflow || workflow.archived) fail("WORKFLOW_UNAVAILABLE");
    if (!this.get("revision", `${id}:${revision}`)) fail("REVISION_NOT_FOUND");
    this.put("reference", `${sessionId}:${id}`, {
      sessionId,
      workflowId: id,
      createdAt: Date.now(),
    });
    return this.put("binding", sessionId, {
      sessionId,
      workflowId: id,
      revision,
      mode,
    });
  }
  event(runId, type, data = {}) {
    this.db
      .prepare("INSERT INTO events(run_id,value) VALUES (?,?)")
      .run(runId, JSON.stringify({ type, time: Date.now(), ...data }));
  }
  events(runId, after = 0) {
    return this.db
      .prepare(
        "SELECT seq,value FROM events WHERE run_id=? AND seq>? ORDER BY seq LIMIT 2000",
      )
      .all(runId, after)
      .map((r) => ({ seq: r.seq, ...JSON.parse(r.value) }));
  }
  updateRun(run, type, data = {}) {
    return this.transaction(() => {
      this.put("run", run.id, run);
      this.event(run.id, type, data);
      return run;
    });
  }
  claim(id, owner, now, duration) {
    return this.transaction(() => {
      const row = this.db.prepare("SELECT * FROM claims WHERE id=?").get(id);
      if (row && row.owner !== owner && row.until_ms > now) return false;
      this.db
        .prepare(
          "INSERT INTO claims VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,until_ms=excluded.until_ms",
        )
        .run(id, owner, now + duration);
      return true;
    });
  }
  release(id, owner) {
    this.db.prepare("DELETE FROM claims WHERE id=? AND owner=?").run(id, owner);
  }
  acquireHost() {
    this.transaction(() => {
      const old = this.get("host", "local");
      if (old) {
        let alive = true;
        try {
          process.kill(old.pid, 0);
        } catch (error) {
          if (error.code === "ESRCH") alive = false;
        }
        if (alive) fail("HOST_ALREADY_RUNNING");
      }
      this.put("host", "local", { pid: process.pid });
    });
    this.ownsHost = true;
  }
  close() {
    if (this.ownsHost) this.remove("host", "local");
    this.db.close();
  }
}
export const uid = (prefix) => `${prefix}-${randomUUID()}`;
