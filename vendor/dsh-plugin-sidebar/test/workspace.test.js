import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceFor, assertWorkspace, relativePath, assertContained, localFiles} from '../workspace.js';
import {apply} from '../index.js';

function fixture() {
  const state = {target: null};
  const session = {id: 'session-a', header: {cwd: '/local/project'}};
  const connections = [{id: 'a', host: 'server-a', name: 'A'}, {id: 'b', host: 'server-b', name: 'B'}];
  const ssh = {getWorkspaceTarget: () => state.target, allowed: () => true,
    resolve: args => {const connection = connections.find(item => item.id === args.connectionId); if (!connection) throw new Error('SSH_CONNECTION_NOT_FOUND'); return connection;}};
  const services = {sshWorkbench: ssh};
  const ctx = {get: key => services[key]};
  return {ctx, session, state, services, ssh};
}

test('workspace identities isolate local, hosts, directories, sessions and changed connection details', () => {
  const {ctx, session, state, ssh} = fixture();
  const keys = [workspaceFor(ctx, session).key];
  for (const target of [{connectionId: 'a', path: '/project'}, {connectionId: 'b', path: '/project'}, {connectionId: 'b', path: '/other'}]) {
    state.target = target;
    const value = workspaceFor(ctx, session);
    assert.equal(value.kind, 'ssh'); assert.equal(value.root, target.path); keys.push(value.key);
  }
  keys.push(workspaceFor(ctx, {...session, id: 'another'}).key);
  ssh.resolve = () => ({id: 'b', host: 'reconfigured-host'});
  keys.push(workspaceFor(ctx, session).key);
  assert.equal(new Set(keys).size, keys.length);
  assert.throws(() => assertWorkspace(ctx, session, keys[0]), /WORKSPACE_CHANGED/);
});

test('deleted remote connections and metadata anchors never fall back to local', () => {
  const {ctx, session, state, services} = fixture();
  state.target = {connectionId: 'deleted', path: '/remote'};
  assert.throws(() => workspaceFor(ctx, session), /CONNECTION_NOT_FOUND/);
  state.target = null; delete services.sshWorkbench;
  session.header.cwd = '/profile/plugin-data/ssh/workspaces/anchor';
  assert.throws(() => workspaceFor(ctx, session), /REMOTE_WORKSPACE_UNAVAILABLE/);
});

test('incompatible SSH services require an update before workspace operations', () => {
  const {ctx, session, services} = fixture();
  services.sshWorkbench = {};
  assert.throws(() => workspaceFor(ctx, session), /SSH_PLUGIN_UPDATE_REQUIRED/);
});

test('file traversal and symlink escapes are rejected; local reads are bounded', async () => {
  for (const path of ['../secret', 'x/../../secret', '/etc/passwd', 'x\\y', 'x\0']) assert.throws(() => relativePath(path));
  assert.throws(() => assertContained('/workspace', '/workspace-other/secret'));
  assert.throws(() => assertContained('/workspace', '/secret'));
  assertContained('/workspace', '/workspace/nested');
  const fs = {resolve: async path => path, processPath: path => path === '.' ? '/workspace' : path,
    listDir: async () => [{name: 'nested', type: 'directory'}], readBytes: async (_target, _signal, limit) => {assert.equal(limit, 65536); return new Uint8Array([65]);}};
  assert.equal((await localFiles(fs, {root: '/workspace'}, 'list', '.')).entries[0].kind, 'directory');
  assert.equal((await localFiles(fs, {root: '/workspace'}, 'read', '.')).content, 'A');
  fs.readBytes = async () => new Uint8Array([0]);
  await assert.rejects(localFiles(fs, {root: '/workspace'}, 'read', '.'), /BINARY_FILE/);
});

test('API derives remote roots from server state and fences stale calls', async () => {
  const {ctx, session, state, services, ssh} = fixture();
  let handler;
  ctx.sessions = {get: id => id === session.id ? session : null};
  ctx.connection = {fetch: {register: route => {handler = route.fetch;}}};
  ssh.run = async args => {assert.equal(args.root, '/remote'); assert.equal(args.connectionId, 'a'); return {entries: []};};
  apply(ctx);
  const call = async args => handler(new Request('http://localhost/api/dsh-sidebar', {method: 'POST', body: JSON.stringify({sessionId: session.id, ...args})}));
  state.target = {connectionId: 'a', path: '/remote'};
  const workspaceKey = workspaceFor(ctx, session).key;
  assert.equal((await call({action: 'list', workspaceKey, root: '/wrong', connectionId: 'b'})).status, 200);
  assert.equal((await call({action: 'read', workspaceKey, path: 'a.txt'})).status, 200);
  state.target = {connectionId: 'b', path: '/other'};
  assert.equal((await call({action: 'read', workspaceKey, path: 'a.txt'})).status, 409);
});

test('the files API rejects terminal actions and unknown sessions', async () => {
  const {ctx, session, state} = fixture();
  let handler;
  ctx.sessions = {get: id => id === session.id ? session : null};
  ctx.connection = {fetch: {register: route => {handler = route.fetch;}}};
  apply(ctx);
  const call = async args => handler(new Request('http://localhost', {method: 'POST', body: JSON.stringify({...args})}));
  state.target = null;
  const workspaceKey = workspaceFor(ctx, session).key;
  for (const action of ['openTerminal', 'writeTerminal', 'closeTerminal']) {
    const response = await call({sessionId: session.id, action, workspaceKey});
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, 'SIDEBAR_INVALID_ACTION');
  }
  const missing = await call({sessionId: 'session-missing', action: 'workspace'});
  assert.equal((await missing.json()).error, 'SIDEBAR_SESSION_REQUIRED');
});

test('read-only sessions still expose the workspace to the files pane', async () => {
  const {ctx, session, services} = fixture();
  let handler;
  ctx.sessions = {get: () => session};
  ctx.connection = {fetch: {register: route => {handler = route.fetch;}}};
  services.sandboxPolicy = {resolve: () => ({mode: 'read-only'})};
  apply(ctx);
  const response = await handler(new Request('http://localhost', {method: 'POST', body: JSON.stringify({sessionId: session.id, action: 'workspace'})}));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).readOnly, true);
});
