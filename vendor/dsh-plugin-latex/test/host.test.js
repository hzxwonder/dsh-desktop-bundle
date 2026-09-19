import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { apply } from "../index.js";
async function host(t) {
  const directory = await mkdtemp(join(tmpdir(), "latex-host-"));
  let hook, dispose;
  const routes = new Map(),
    agents = new Map();
  let modelCalls = 0;
  const ctx = {
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
        const data = JSON.parse(
          args.prompt[0].text.slice(args.prompt[0].text.indexOf("\n") + 1),
        );
        return {
          result: Promise.resolve({
            stopReason: "completed",
            output: [
              {
                type: "text",
                text: JSON.stringify({
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
      hook = fn;
    },
    effect: (fn) => {
      dispose = fn();
    },
  };
  await apply(ctx, { directory });
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
  return { request, agents, hook, calls: () => modelCalls };
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
        return job.result;
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    assert.fail("Job did not finish");
  }
  const first = await analyze();
  assert.equal(first.stats.analyzed, 1);
  assert.equal(first.nodes.filter((n) => n.type === "sentence").length, 2);
  assert.ok(
    first.nodes.some((n) => n.type === "paragraph" && n.file === "body.tex"),
  );
  assert.equal(first.nodes[0].label, "Demo");
  const body = (await h.request({ action: "read", id: p.id, file: "body.tex" }))
    .value.content;
  assert.match(body, /% @p:Fixture paragraph intent/);
  assert.doesNotMatch(body, /DSH_SOURCE_BODY|\\section|\\title/);
  const calls = h.calls(),
    second = await analyze();
  assert.equal(second.stats.analyzed, 0);
  assert.equal(h.calls(), calls);
});
