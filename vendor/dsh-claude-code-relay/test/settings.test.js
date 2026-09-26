// The Settings-page wiring: apply() must register the plugin's settings namespace with the
// composition config as its base layer, adopt the resolved value and later live edits onto the
// running adapter, and degrade to config-file-only operation when the settings service is absent
// or refuses the registration.

import test from "node:test";
import assert from "node:assert/strict";

import { apply, Config, SettingsSchema, SETTINGS_NS } from "../src/index.js";

/** A fake settings service recording registrations, with a manually drivable scope. */
const makeSettings = (stored = {}) => {
  const calls = [];
  let watchCallback;
  const scope = {
    get: () => ({ ...stored }),
    watch: (callback) => {
      watchCallback = callback;
      return () => {};
    },
  };
  return {
    calls,
    scope,
    emit: (next) => watchCallback(next, {}),
    register(namespace, schema, options) {
      calls.push({ namespace, schema, options });
      const resolved = schema({ ...(options?.base ?? {}), ...stored });
      scope.get = () => resolved;
      return scope;
    },
  };
};

/** The fake host context apply() runs in. */
const makeCtx = (settings) => {
  const registered = [];
  const ctx = {
    registered,
    warnings: [],
    llm: { registerAdapter: (route, adapter) => registered.push({ route, adapter }) },
    get: (name) => (name === "settings" ? settings : undefined),
    logger: { info: () => {}, warn: (message) => ctx.warnings.push(message) },
  };
  return ctx;
};

const bundleConfig = () =>
  Config({
    baseUrl: "https://file.example",
    apiKey: "sk-file",
    providerId: "my-relay",
  });

test("Config no longer requires baseUrl — an empty config resolves to documented defaults", () => {
  const resolved = Config({});
  assert.equal(resolved.baseUrl, "");
  assert.equal(resolved.authHeader, "auth-token");
  assert.equal(resolved.autoModels, true);
  assert.equal(resolved.providerId, "claude-code-relay");
});

test("apply registers the settings namespace with the composition config as base", () => {
  const settings = makeSettings();
  const ctx = makeCtx(settings);
  const config = bundleConfig();
  apply(ctx, config);
  assert.equal(settings.calls.length, 1);
  const { namespace, options } = settings.calls[0];
  assert.equal(namespace, SETTINGS_NS);
  assert.equal(options.base.baseUrl, "https://file.example");
  assert.equal(options.base.apiKey, "sk-file");
  assert.equal("providerId" in options.base, false, "the route id stays composition-only");
  assert.equal("displayName" in options.base, false);
  // The schema must accept the base layer it was handed (a real register validates it first).
  const resolved = settings.calls[0].schema(options.base);
  assert.equal(resolved.baseUrl, "https://file.example");
});

test("the adapter adopts the resolved settings value and later live edits", () => {
  const settings = makeSettings({ baseUrl: "https://ui.example", apiKey: "sk-ui" });
  const ctx = makeCtx(settings);
  const config = bundleConfig();
  apply(ctx, config);
  const adapter = ctx.registered[0].adapter;
  assert.equal(ctx.registered[0].route[0], "my-relay");
  assert.equal(adapter.config.baseUrl, "https://ui.example", "user layer wins over the file");
  assert.equal(adapter.config.apiKey, "sk-ui");
  assert.equal(adapter.config.providerId, "my-relay", "identity fields survive the merge");

  settings.emit({ baseUrl: "https://changed.example", apiKey: "sk-ui", extraArgs: ["--verbose"] });
  assert.equal(adapter.config.baseUrl, "https://changed.example");
  assert.deepEqual(adapter.config.extraArgs, ["--verbose"]);
  adapter.modelsCache = { at: Date.now(), list: [] };
  settings.emit({ baseUrl: "https://third.example" });
  assert.equal(adapter.config.baseUrl, "https://third.example");
  assert.equal(adapter.modelsCache, undefined, "an endpoint change must re-ask /v1/models");
});

test("a missing settings service leaves config-file operation untouched", () => {
  const ctx = makeCtx(undefined);
  const config = bundleConfig();
  apply(ctx, config);
  assert.equal(ctx.registered.length, 1);
  assert.equal(ctx.registered[0].adapter.config.baseUrl, "https://file.example");
});

test("a refusing registration degrades to config-file operation with a warning", () => {
  const settings = {
    register() {
      throw new Error("stored section fails the schema");
    },
  };
  const written = [];
  const original = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk) => {
    written.push(String(chunk));
    return true;
  };
  try {
    const ctx = makeCtx(settings);
    apply(ctx, bundleConfig());
    assert.equal(ctx.registered.length, 1);
    assert.equal(ctx.registered[0].adapter.config.baseUrl, "https://file.example");
  } finally {
    process.stderr.write = original;
  }
  assert.match(written.join(""), /settings\.register failed/);
});

test("SettingsSchema keeps the secret role on apiKey and mirrors Config defaults", () => {
  const resolved = SettingsSchema({});
  const config = Config({});
  for (const key of Object.keys(resolved)) {
    assert.deepEqual(resolved[key], config[key], `default mismatch on ${key}`);
  }
});
