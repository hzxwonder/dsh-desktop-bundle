import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

async function load(options = {}) {
  let factory;
  const native = [];
  const requests = [];
  const window = {__ModuleLoader__: {load(spec) {factory = spec.factory;}}};
  const context = {
    window,
    navigator: {clipboard: {}},
    Blob,
    fetch: (_url, init) => {
      const args = JSON.parse(init.body);
      requests.push(args);
      if (options.chat === false) return Promise.resolve({ok: false, json: async () => ({error: 'SESSION_REQUEST_FAILED'})});
      if (args.action === 'chat') return Promise.resolve({ok: true, json: async () => ({root: '/tmp/plain-sessions', workspaceId: 'workspace-chat', title: '对话'})});
      return Promise.resolve({ok: false, json: async () => ({error: 'SESSION_INVALID_ACTION'})});
    },
    console: {warn() {}},
    document: {createElement: () => ({dataset: {}, remove() {}}), head: {appendChild() {}}, body: {dataset: {}}},
    setTimeout: () => 0,
    clearTimeout() {}
  };
  vm.runInNewContext(await readFile(new URL('../client.js', import.meta.url), 'utf8'), context);
  const uiWorkspace = {startSession(workspaceId) {native.push(workspaceId);}};
  const ctx = {
    uiWorkspace,
    sessions: {list: {getSnapshot: () => ({ids: [], byId: {}, phase: 'ready'}), subscribe: () => () => {}}},
    slots: {inject: (_name, install) => install(), register: () => () => {}},
    effect: install => install()
  };
  factory(() => ({createElement: () => null})).apply(ctx);
  await new Promise(resolve => setImmediate(resolve));
  return {window, ctx, native, requests};
}

test('a workspace entry opens its own New Session and a workspace-less entry opens chat', async () => {
  const {window, ctx, native, requests} = await load();
  assert.deepEqual(requests, [{action: 'chat'}]);
  ctx.uiWorkspace.startSession('workspace-demo');
  assert.deepEqual(native, ['workspace-demo']);
  ctx.uiWorkspace.startSession();
  assert.deepEqual(native, ['workspace-demo', 'workspace-chat'], 'the global New Session must land in the chat workspace');
  window.__dshSessionActions.exitToChat();
  assert.deepEqual(native, ['workspace-demo', 'workspace-chat', 'workspace-chat'], 'leaving a workspace session opens a chat session');
});

test('session routing stays inert while the chat workspace is unavailable', async () => {
  const {window, ctx, native} = await load({chat: false});
  ctx.uiWorkspace.startSession();
  assert.deepEqual(native, [undefined], 'the native default must stay untouched');
  window.__dshSessionActions.exitToChat();
  assert.deepEqual(native, [undefined]);
});
