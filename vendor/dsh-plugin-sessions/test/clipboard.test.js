import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

test('clipboard admission starts during the click while verified reference text is still loading', async () => {
  let factory;
  let respond;
  let admitted = false;
  let copied;
  const window = {__ModuleLoader__: {load(spec) {factory = spec.factory;}}};
  const React = {createElement: () => null};
  const context = {window, navigator: {clipboard: {async write(items) {
    admitted = true;
    copied = await (await items[0].values['text/plain']).text();
  }}}, ClipboardItem: class {constructor(values) {this.values = values;}}, Blob,
    fetch: (_url, options) => {
      const {action} = JSON.parse(options.body);
      // The chat workspace probe settles on its own; only the reference call waits for the test.
      if (action === 'chat') return Promise.resolve({ok: true, json: async () => ({root: '/tmp/plain-sessions', workspaceId: 'workspace-chat', title: '对话'})});
      return new Promise(resolve => {respond = resolve;});
    },
    console: {warn() {}},
    document: {createElement: () => ({dataset: {}, remove(){}}), head: {appendChild(){}}, body: {dataset: {}}},
    setTimeout: () => 0, clearTimeout(){}
  };
  vm.runInNewContext(await readFile(new URL('../client.js', import.meta.url), 'utf8'), context);
  const plugin = factory(() => React);
  const entry = {component: () => null};
  const disposers = [];
  plugin.apply({slots:{inject: (_name, install) => disposers.push(install()), register: () => () => {}, entriesOfSlot: () => [entry]}, effect: install => disposers.push(install())});
  const operation = window.__dshSessionActions.copy('session-example', '资料');
  assert.equal(admitted, true, 'browser clipboard admission must happen before the network response');
  const mention = '@[资料](dsh-session:InNlc3Npb24tZXhhbXBsZSI)';
  respond({ok: true, json: async () => ({mention})});
  await operation;
  assert.equal(copied, mention);
  for (const dispose of disposers.reverse()) dispose?.();
});
