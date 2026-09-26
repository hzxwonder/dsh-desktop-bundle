// Unit tests of the resident process holder: reuse while alive and unchanged, respawn on an
// option change, idle retirement, and the drain of frames that trail a turn — all against a real
// fake-claude child, so the process plumbing is exercised for real.

import test from "node:test";
import assert from "node:assert/strict";
import { chmodSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { ResidentCli } from "../src/resident.js";
import { CliProcess } from "../src/process.js";

const FAKE = fileURLToPath(new URL("./fake-claude.mjs", import.meta.url));
chmodSync(FAKE, 0o755);

const spawnFake = () =>
  new CliProcess({
    command: process.execPath,
    args: [FAKE],
    cwd: process.cwd(),
    env: {
      ...process.env,
      FAKE_CLAUDE_MODE: "answer",
      FAKE_EXPECT_BASE: "https://relay.test",
      FAKE_EXPECT_KEY: "sk-test",
    },
    idleMs: 0,
  });

const userLine = (text) => ({ type: "user", message: { role: "user", content: [{ type: "text", text }] } });

/** One turn over `proc`: write the line, read frames until the result (or the child's death). */
const runTurn = async (proc, text) => {
  proc.writeLines([userLine(text)]);
  for (;;) {
    const event = await proc.nextEvent();
    if (event === null || event.type === "result") return event;
  }
};

const waitExited = async (proc) => {
  for (let i = 0; i < 100 && !proc.exited; i++) await new Promise((r) => setTimeout(r, 20));
  return proc.exited;
};

test("a turn parks the resident; the next turn reuses the same process", async () => {
  const resident = new ResidentCli({ sessionId: "s" });
  const proc = spawnFake();
  proc.spawn();
  resident.adopt(proc, "key-a");
  assert.ok((await runTurn(proc, "one"))?.type === "result");
  resident.endTurn();
  assert.ok(resident.alive);

  assert.equal(resident.begin("key-a"), proc, "same key and alive: the same process");
  resident.endTurn();
  resident.discard();
});

test("an option change or a death refuses reuse, killing what is there", async () => {
  const resident = new ResidentCli({ sessionId: "s" });
  const proc = spawnFake();
  proc.spawn();
  resident.adopt(proc, "key-a");
  resident.endTurn();

  assert.equal(resident.begin("key-b"), null, "a different spawn key never reuses");
  assert.ok(await waitExited(proc), "the replaced process was killed");
  assert.ok(!resident.alive);
});

test("idle retirement after a turn drops the process for the next spawn", async () => {
  const resident = new ResidentCli({ sessionId: "s", idleMs: 120 });
  const proc = spawnFake();
  proc.spawn();
  resident.adopt(proc, "key-a");
  resident.endTurn();

  await new Promise((r) => setTimeout(r, 350));
  assert.equal(resident.begin("key-a"), null, "retired on idle; the next turn spawns fresh");
  assert.ok(await waitExited(proc));
});

test("frames that trail a turn's result are dropped at the next turn's start", async () => {
  const resident = new ResidentCli({ sessionId: "s" });
  const proc = spawnFake();
  proc.spawn();
  resident.adopt(proc, "key-a");
  assert.ok((await runTurn(proc, "one"))?.type === "result");
  resident.endTurn();

  // Bookkeeping a real CLI may emit after the result frame: they belong to the closed turn.
  proc.events.push({ type: "system", subtype: "status" });
  proc.events.push({ type: "stream_event", event: { type: "ping" } });

  assert.equal(resident.begin("key-a"), proc);
  const answer = await runTurn(proc, "two");
  assert.equal(answer?.type, "result", "the strays never surfaced as this turn's frames");
  resident.endTurn();
  resident.discard();
});

test("a resident mid-turn refuses a second begin instead of interleaving turns", async () => {
  const resident = new ResidentCli({ sessionId: "s" });
  const proc = spawnFake();
  proc.spawn();
  resident.adopt(proc, "key-a");
  assert.throws(() => resident.begin("key-a"), /turn in flight/);
  resident.discard();
});
