import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm, stat, readFile, realpath} from 'node:fs/promises';
import {homedir, tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {createChatService, defaultPlainRoot} from '../index.js';
import {sessionReference} from '../reference.js';
import {adaptWorkspace, adaptConversation} from '../scripts/adapt-workspace.mjs';

const require = createRequire(new URL('../../../runtime/package.json', import.meta.url));
const official = await import(require.resolve('@deepseek-ai/dsh-session-reference'));
const workspaceFixture = [
  'const workspaces = useWorkspaces((state) => state.items);',
  'const sessionMenuItems = [{id: "rename"}];',
  'const after = () => { if (id === "archive") onArchive(node.id); };'
].join('\n');
const conversationFixture = [
  'function chip({pendingWorkspace, sessionId, sessionWorkspace, workspaces, cwd}) {',
  'const chipTitle = pendingWorkspace?.title ?? (sessionId === void 0 ? void 0 : sessionWorkspace?.title ?? (workspaces.phase === "ready" || cwd === void 0 || cwd === "" ? void 0 : workspaceLabel(cwd)));',
  'return (0, react_jsx_runtime.jsxs)("button", {',
  '\t\t\t\t\tclassName: HeroShell_module_css_default.workspace,',
  '\t\t\t\t\tchildren: [',
  '\t\t\t\t\t(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {',
  '\t\t\t\t\t\tclassName: HeroShell_module_css_default.chevron,',
  '\t\t\t\t\t\tsize: 12',
  '\t\t\t\t\t})',
  '\t\t\t\t\t]});',
  '}'
].join('\n');

function fakeRegistry(items = []) {
  return {
    items,
    created: [],
    order: [],
    list() {return this.items;},
    async create(path, title) {
      this.created.push({path, title});
      const workspace = {id: `workspace-${this.items.length + 1}`, path, title};
      this.items = [...this.items, workspace];
      return workspace;
    },
    async insertBefore(id, beforeId) {this.order.push({id, beforeId});}
  };
}

test('copied references round-trip through the official parser, including duplicate titles and Unicode', () => {
  for (const id of ['session-' + randomUUID(), '父会话/分支🙂', 'session with spaces']) {
    const mention = sessionReference(id, '同名 [会话] \\ 资料🙂');
    assert.equal(mention, official.formatSessionReferenceMention({sessionId: id, label: '同名 [会话] \\ 资料🙂'}));
    assert.deepEqual(official.parseSessionReferenceText('读取 ' + mention).references, [{sessionId: id, label: '同名 [会话] \\ 资料🙂'}]);
  }
  assert.throws(() => sessionReference(''));
});

test('the chat workspace owns the chat directory and stays last in registry order', async t => {
  const root = await mkdtemp(join(tmpdir(), 'chat-workspace-test-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const directory = join(root, 'plain-sessions');
  const registry = fakeRegistry();
  const chat = await createChatService({workspaceRegistry: registry}, {plainRoot: directory}).ensure();
  assert.equal((await stat(directory)).isDirectory(), true);
  assert.equal(chat.root, await realpath(directory));
  assert.deepEqual(registry.created, [{path: chat.root, title: '对话'}]);
  assert.deepEqual(registry.order, [{id: chat.workspaceId, beforeId: undefined}]);
});

test('an existing registration for the chat directory is reused without touching order', async t => {
  const root = await mkdtemp(join(tmpdir(), 'chat-workspace-test-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const canonical = await realpath(root);
  const registry = fakeRegistry([{id: 'workspace-existing', path: canonical, title: '我的对话'}]);
  const chat = await createChatService({workspaceRegistry: registry}, {plainRoot: root}).ensure();
  assert.deepEqual(chat, {root: canonical, workspaceId: 'workspace-existing', title: '我的对话'});
  assert.deepEqual(registry.created, []);
  assert.deepEqual(registry.order, []);
});

test('the chat workspace title is configurable', async t => {
  const root = await mkdtemp(join(tmpdir(), 'chat-workspace-test-'));
  t.after(() => rm(root, {recursive: true, force: true}));
  const registry = fakeRegistry();
  const chat = await createChatService({workspaceRegistry: registry}, {plainRoot: root, title: '  Chat  '}).ensure();
  assert.equal(chat.title, 'Chat');
  assert.deepEqual(registry.created, [{path: await realpath(root), title: 'Chat'}]);
});

test('without an explicit plainRoot the chat directory follows the Harness home', () => {
  assert.equal(defaultPlainRoot({DSH_HOME: '/tmp/dsh-home'}), join('/tmp/dsh-home', 'plain-sessions'));
  assert.equal(defaultPlainRoot({DSH_HOME: '   '}), join(homedir(), '.dsh', 'plain-sessions'));
  assert.equal(defaultPlainRoot({}), join(homedir(), '.dsh', 'plain-sessions'));
  // The service resolves the same default, so a Desktop host keeps its own home.
  assert.equal(createChatService({workspaceRegistry: fakeRegistry()}, {}).root, resolve(defaultPlainRoot()));
  assert.equal(createChatService({workspaceRegistry: fakeRegistry()}, {plainRoot: '/tmp/explicit'}).root, '/tmp/explicit');
});

test('unknown references are rejected through exact inspection', async () => {
  const inspected = [];
  const service = createChatService({sessionController: {async inspect(id) {inspected.push(id); if (id === 'missing') throw new Error('not found');}}});
  await assert.rejects(service.reference('missing'), /not found/);
  await assert.rejects(service.reference(''), /INVALID_ID/);
  const result = await service.reference('archived-session', 'same title');
  assert.equal(official.parseSessionReferenceText(result.mention).references[0].sessionId, 'archived-session');
  assert.deepEqual(inspected, ['missing', 'archived-session']);
});

test('the sidebar adapter adds session references and drops the retired plain-session entry', () => {
  const adapted = adaptWorkspace(workspaceFixture);
  assert.match(adapted, /dsh-copy-reference/);
  assert.match(adapted, /__dshWorkflowWorkspacePaths/);
  assert.match(adapted, /const workspaces = \(0, react\.useMemo\)\(/, 'the filtered workspace list keeps a stable identity between renders');
  assert.doesNotMatch(adapted, /dsh-create-plain/);
  assert.equal(adaptWorkspace(adapted), adapted);
  assert.throws(() => adaptWorkspace('unrecognized upstream code'), /INCOMPATIBLE/);
  new Function(adapted);
});

test('the composer adapter labels workspace-less sessions as chat and adds the exit control', () => {
  const adapted = adaptConversation(conversationFixture);
  assert.match(adapted, /workspaces\.phase === "ready" \? "对话" : workspaceLabel\(cwd\)/);
  assert.match(adapted, /dsh-chat-chip/);
  assert.match(adapted, /dsh-chat-chevron/);
  assert.match(adapted, /dsh-chat-exit/);
  assert.match(adapted, /exitToChat/);
  assert.equal(adaptConversation(adapted), adapted);
  assert.throws(() => adaptConversation('unrecognized upstream code'), /INCOMPATIBLE/);
  new Function(adapted);
});

test('the development runtime carries the current adapter revision', async () => {
  const workspace = await readFile(new URL('../../../runtime/node_modules/@deepseek-ai/dsh-client-ui-workspace/lib/client.js', import.meta.url), 'utf8');
  const conversation = await readFile(new URL('../../../runtime/node_modules/@deepseek-ai/dsh-client-ui-conversation/lib/client.js', import.meta.url), 'utf8');
  for (const [name, source] of [['workspace', workspace], ['conversation', conversation]]) {
    assert.match(source, /^\/\/ dsh-plugin-sessions workspace adapter v2$/m, `${name} adapter revision`);
  }
  assert.match(workspace, /dsh-copy-reference/);
  assert.match(conversation, /dsh-chat-exit/);
});
