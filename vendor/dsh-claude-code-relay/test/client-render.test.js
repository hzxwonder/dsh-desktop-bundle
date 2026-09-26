// Renders the shipped browser bundle the way dsh does, against a minimal React stand-in. This is
// the only check that exercises the real client file: a broken hook order, a missing dictionary
// key, or a settings call that throws fails here rather than in the user's browser.

import test from "node:test";
import assert from "node:assert/strict";
import { findAll, loadClient, textOf } from "./support/react-harness.js";

const BUNDLE = new URL("../lib/client.js", import.meta.url);

// The page reads the focused element so a pushed update cannot overwrite a field being typed into.
// There is no DOM here; the smallest honest stand-in is a stub with nothing focused.
globalThis.document = { activeElement: null };

// The approval panel keeps a polling timer for as long as it is mounted; a browser tears it down
// with the page, and nothing here unmounts it. The timer is unref'd, so it never holds the process
// open, and the page still polls normally while a real app runs it.

/** A fully resolved namespace, as the host hands it to the page. Every field the schema declares is
 *  present, so the dirty check has a real baseline to compare against. */
const full = (over = {}) => ({
  baseUrl: "", apiKey: undefined, apiKeyEnv: "", authHeader: "auth-token", autoModels: true,
  models: [], visibleModels: [], command: "claude", configDir: "", contextWindow: 200000,
  permissionMode: "dsh", resume: true, resident: true, maxTurns: 0, idleTimeoutMs: 1800000, toolActivity: true,
  approvalBridge: true, approvalMode: "auto", approvalTimeoutMs: 120000, systemPrompt: true,
  extraEnv: {}, extraArgs: [], debug: false, ...over,
});

const snapshot = (value, extra = {}) => ({
  status: "ready", value, base: {}, user: {}, revision: 7, writable: true, mode: "host", ...extra,
});

/** A settingsScope stand-in that reports one namespace value and records writes. */
function makeScope(value, writes) {
  return {
    getSnapshot: () => snapshot(value),
    subscribe: () => () => {},
    set: (field, v) => { writes.push({ op: "set", path: [field], value: v }); },
    unset: (field) => { writes.push({ op: "unset", path: [field] }); },
    mutate: (ops, revision) => { writes.push({ ops, revision }); },
  };
}

/** Boot the client half and render its Settings section with the given namespace value. */
async function renderPage({ value = {}, fetchImpl, writes = [] } = {}) {
  if (fetchImpl) globalThis.fetch = fetchImpl;
  const client = loadClient(BUNDLE);
  const dictionaries = {};
  let hosted;

  const ctx = {
    effect: (fn) => fn(),
    locale: {
      register: (ns, dict) => { dictionaries[ns] = dict; },
      bind: () => (key) => {
        const dict = dictionaries["settings.claude-code-relay"];
        assert.ok(dict?.en?.[key], `missing locale key: ${key}`);
        return dict.en[key];
      },
    },
    settingsScope: {
      bind: (spec) => { assert.equal(spec.namespace, "claude-code-relay"); return makeScope(value, writes); },
      describe: () => ({ getSnapshot: () => ({ view: { namespaces: [] } }) }),
    },
    slots: {
      inject: (_name, cb) => cb(),
      register: (options, Component) => { hosted = { options, Component }; return () => {}; },
    },
  };

  client.exports.apply(ctx);
  assert.ok(hosted, "the plugin must register a settings section");
  assert.equal(hosted.options.id, "claude-code-relay");

  const props = {
    t: ctx.locale.bind(),
    scope: makeScope(value, writes),
    mirror: { getSnapshot: () => ({ view: { namespaces: [] } }) },
  };
  client.react.__render(hosted.Component, props);
  let tree = await client.react.__flush();
  // A re-render may have replaced the tree while effects settled; take the live one.
  const reread = () => { tree = client.react.tree; return tree; };
  return { client, tree: reread(), reread, dictionaries, hosted, props, writes };
}

/** The controls keyed by their id attribute. */
const controls = (tree) => {
  const byId = new Map();
  for (const input of findAll(tree, "input")) if (input.props.id) byId.set(input.props.id, input.props);
  for (const select of findAll(tree, "select")) if (select.props.id) byId.set(select.props.id, select.props);
  for (const area of findAll(tree, "textarea")) if (area.props.id) byId.set(area.props.id, area.props);
  return byId;
};

test("the bundle registers itself under the plugin id", () => {
  const client = loadClient(BUNDLE);
  assert.equal(client.id, "dsh-claude-code-relay");
  assert.equal(typeof client.exports.apply, "function");
  assert.deepEqual(client.exports.inject, ["slots", "locale", "settingsScope"]);
  assert.equal(client.exports.name, "dsh-claude-code-relay");
});

test("both dictionaries carry the same keys, and the page asks only for keys that exist", async () => {
  const { dictionaries, tree } = await renderPage({ value: {} });
  const dict = dictionaries["settings.claude-code-relay"];
  assert.ok(dict.zh && dict.en, "both locales must be registered");
  assert.deepEqual(Object.keys(dict.zh).sort(), Object.keys(dict.en).sort());
  // Rendering already asserted every requested key exists; prove the page produced content.
  assert.ok(textOf(tree).length > 0);
});

test("the saved namespace is adopted into the controls", async () => {
  const { tree } = await renderPage({
    value: {
      baseUrl: "https://relay.example.com",
      authHeader: "api-key",
      autoModels: false,
      models: [{ id: "m1", name: "Model One" }],
      visibleModels: ["m1"],
      command: "/usr/local/bin/claude",
      configDir: "",
      contextWindow: 123456,
      permissionMode: "dsh",
      approvalBridge: true,
      approvalMode: "ask",
      approvalTimeoutMs: 30000,
      resume: true,
      maxTurns: 0,
      idleTimeoutMs: 1800000,
      toolActivity: true,
      systemPrompt: false,
      extraEnv: {},
      extraArgs: [],
      debug: false,
    },
  });
  const c = controls(tree);
  assert.equal(c.get("baseUrl").value, "https://relay.example.com");
  assert.equal(c.get("command").value, "/usr/local/bin/claude");
  assert.equal(c.get("contextWindow").value, "123456");
  assert.equal(c.get("approvalTimeoutMs").value, "30000");
  assert.equal(c.get("approvalMode").value, "ask");
  assert.equal(c.get("models").value, "m1 | Model One");
  // Checkboxes reflect the saved booleans rather than defaulting to on.
  const checks = findAll(tree, "input").filter((i) => i.props.type === "checkbox");
  assert.ok(checks.some((i) => i.props.checked === true), "an enabled flag must be ticked");
  assert.ok(checks.some((i) => i.props.checked === false), "a disabled flag must be clear");
});

test("Save is the last block, under tool approval, and uses the web button tokens", async () => {
  const { tree } = await renderPage({ value: full() });
  const labels = textOf(tree);
  const approval = labels.indexOf("Tool approval");
  const saveAt = labels.lastIndexOf("Save");
  assert.ok(approval >= 0, "the approval section must render");
  assert.ok(saveAt > approval, "Save must come after tool approval");
  const save = findAll(tree, "button").find((b) => textOf(b).join("") === "Save");
  assert.match(save.props.style.background, /--dsw-alias-button-primary-fill/);
  assert.equal(save.props.style.borderRadius, 18);
  assert.equal(save.props.style.minHeight, 34);
  const page = tree;
  const last = page.children?.at(-1);
  assert.equal(textOf(last).join(""), "SaveDiscard changes", "the commit row is the page's last block");
});

test("the Save button stays disabled until something changes", async () => {
  const { tree } = await renderPage({ value: full({ baseUrl: "https://a.example.com" }) });
  const buttons = findAll(tree, "button").map((b) => ({ label: textOf(b).join(""), props: b.props }));
  const save = buttons.find((b) => b.label === "Save");
  const discard = buttons.find((b) => b.label === "Discard changes");
  assert.ok(save, "the page must carry a Save button");
  assert.ok(discard, "the page must carry a Discard button");
  assert.equal(save.props.disabled, true, "an unedited page has nothing to commit");
});

test("editing a field enables Save, which commits one atomic mutate behind a revision fence", async () => {
  const writes = [];
  const { tree, reread } = await renderPage({ value: full({ baseUrl: "https://a.example.com" }), writes });
  controls(tree).get("baseUrl").onChange({ target: { value: "https://b.example.com" } });

  const live = reread();
  const save = findAll(live, "button").find((b) => textOf(b).join("") === "Save");
  assert.equal(save.props.disabled, false, "an edited field must enable Save");
  save.props.onClick();

  const mutate = writes.find((w) => Array.isArray(w.ops));
  assert.ok(mutate, "Save must commit through mutate, not a per-field set");
  assert.deepEqual(mutate.ops, [{ op: "set", path: ["baseUrl"], value: "https://b.example.com" }]);
  assert.equal(mutate.revision, 7, "the write carries the revision the draft was opened at");
});

test("the approval panel shows a waiting call and posts the verdict", async () => {
  const posted = [];
  const { tree } = await renderPage({
    value: {},
    fetchImpl: async (url, init) => {
      if (init?.method === "POST") {
        posted.push({ url, body: JSON.parse(init.body) });
        return { json: async () => ({ ok: true, pending: [] }) };
      }
      return {
        json: async () => ({
          ok: true,
          pending: [{ id: "p1", toolName: "Bash", toolInput: "rm -rf /tmp/x", cwd: "/work", sessionId: "s1" }],
        }),
      };
    },
  });

  const labels = findAll(tree, "button").map((b) => textOf(b).join(""));
  assert.ok(labels.includes("Allow once"), "the waiting call must offer Allow once");
  assert.ok(labels.includes("Deny"), "the waiting call must offer Deny");
  // Both the tool and its identifying argument are visible, so the decision is an informed one.
  const texts = textOf(tree).join(" | ");
  assert.match(texts, /Bash/);
  assert.match(texts, /rm -rf \/tmp\/x/);

  const allow = findAll(tree, "button").find((b) => textOf(b).join("") === "Allow once");
  await allow.props.onClick();
  assert.equal(posted.length, 1, "clicking Allow must send exactly one verdict");
  assert.equal(posted[0].url, "/dsh-claude-code-relay/approvals");
  assert.deepEqual(posted[0].body, { id: "p1", decision: "allow" });
  delete globalThis.fetch;
});

test("with nothing pending the panel offers no verdict buttons", async () => {
  const { tree } = await renderPage({
    value: {},
    fetchImpl: async () => ({ json: async () => ({ ok: true, pending: [] }) }),
  });
  const labels = findAll(tree, "button").map((b) => textOf(b).join(""));
  assert.ok(!labels.includes("Allow once"));
  assert.ok(labels.includes("Save"), "the rest of the page still renders");
  delete globalThis.fetch;
});
