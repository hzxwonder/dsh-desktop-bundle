import {PassThrough} from 'node:stream';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply, inject, name} from '../index.js';
import {assertWorkspace, connectionChoices, workspaceFor} from '../workspace.js';

const signal = () => new AbortController().signal;

function fakeAgent() {
  return {id: 'agent-1', session: {header: {cwd: '/tmp'}}};
}

function context() {
  const tools = new Map();
  const routes = new Map();
  const spawned = [];
  const terminated = [];
  let nextPid = 9000;
  // Every spawn is an independent PTY so owner isolation and cleanup are observable.
  function makeTerminal() {
    const output = new PassThrough();
    let resolveDone;
    const terminal = {
      pid: ++nextPid,
      output,
      done: new Promise(resolve => { resolveDone = resolve; }),
      async write(data) { output.write(`remote:${data}`); },
      async signalForeground() { return terminal.pid; },
      async terminate() { terminated.push(terminal.pid); output.end(); resolveDone({exitCode: 0, signal: null}); },
    };
    spawned.push(terminal);
    return terminal;
  }
  const services = {sandboxPolicy: {resolve: () => ({mode: 'danger-full-access'})}};
  const ctx = {
    tools: {register(tool) { tools.set(tool.name, tool); }},
    subprocess: {
      async resolveExecutable() { return '/usr/bin/ssh'; },
      async spawnTerminal() { return makeTerminal(); },
    },
    get(key) { return services[key]; },
    provide() {},
    inject(keys, callback) { callback(ctx); },
    connection: {fetch: {register: route => {routes.set(route.path, route.fetch);}}},
    sessions: {get: () => undefined},
    on() {},
    effect() {},
  };
  return {ctx, tools, routes, services, spawned, terminated, agent: fakeAgent()};
}

test('plugin advertises the expected host capabilities', () => {
  assert.equal(name, 'dsh-plugin-terminal');
  assert.deepEqual(inject, ['tools', 'subprocess', 'sandboxPolicy']);
});

test('plugin registers local composition-facing remote tools with owner fencing', async () => {
  const fixture = context();
  apply(fixture.ctx, {hosts: ['dev'], idleSilenceMs: 20, startupWaitMs: 1});
  for (const tool of ['remote_terminal_open', 'remote_terminal_send', 'remote_terminal_read', 'remote_terminal_signal', 'remote_terminal_close', 'remote_terminal_list']) assert(fixture.tools.has(tool), `missing ${tool}`);
  const open = await fixture.tools.get('remote_terminal_open').execute({host: 'dev', cwd: '/tmp', name: 'dev'}, {agent: fixture.agent, signal: signal()});
  assert.equal(open.host, 'dev');
  assert.match(open.sessionId, /^remote-pty-/);
  const send = await fixture.tools.get('remote_terminal_send').execute({sessionId: open.sessionId, text: 'pwd'}, {agent: fixture.agent, signal: signal()});
  assert.match(send.viewport, /remote:pwd/);
  await assert.rejects(fixture.tools.get('remote_terminal_read').execute({sessionId: open.sessionId}, {agent: fakeAgent(), signal: signal()}), /FOREIGN_SESSION/);
  await fixture.tools.get('remote_terminal_close').execute({sessionId: open.sessionId}, {agent: fixture.agent, signal: signal()});
});

test('failed SSH startup is never published as a usable session', async () => {
  const fixture = context();
  apply(fixture.ctx, {hosts: ['dev'], startupWaitMs: 1});
  fixture.ctx.subprocess.spawnTerminal = async () => {
    const terminal = {pid: 1, output: new PassThrough(), done: Promise.resolve({exitCode: 255, signal: null}),
      async write() {}, async signalForeground() {}, async terminate() {}};
    terminal.output.end();
    return terminal;
  };
  await assert.rejects(
    fixture.tools.get('remote_terminal_open').execute({host: 'dev'}, {agent: fixture.agent, signal: signal()}),
    /START_FAILED/,
  );
  assert.deepEqual(await fixture.tools.get('remote_terminal_list').execute({}, {agent: fixture.agent}), []);
});

test('the panel owns workspace resolution, targets and its own terminal', async () => {
  const fixture = context();
  const session = {id: 'session-a', header: {cwd: '/local/project'}};
  const connections = [{id: 'a', host: 'server-a', name: 'A'}];
  const ssh = {getWorkspaceTarget: () => ({connectionId: 'a', path: '/remote'}), allowed: () => true,
    getConnections: () => connections, resolve: args => connections.find(item => item.id === args.connectionId),
    argv: (program, connection, command) => [program, '-tt', connection.host, command],
    passwords: {prepare: async () => ({env: {}, dispose: async () => {}})}};
  fixture.services.sshWorkbench = ssh;
  fixture.ctx.sessions = {get: id => id === session.id ? session : undefined};
  apply(fixture.ctx, {startupWaitMs: 1});
  const call = async args => {
    const response = await fixture.routes.get('/api/dsh-terminal')(new Request('http://localhost/api/dsh-terminal', {method: 'POST', body: JSON.stringify({sessionId: session.id, ...args})}));
    return {status: response.status, body: await response.json()};
  };
  const facts = await call({action: 'workspace'});
  assert.equal(facts.status, 200);
  assert.equal(facts.body.kind, 'ssh');
  assert.equal(facts.body.root, '/remote');
  assert.equal(facts.body.readOnly, false);
  assert.deepEqual((await call({action: 'connections'})).body, {connections: [{id: 'a', name: 'A', host: 'server-a'}]});
  const workspaceKey = facts.body.key;
  const opened = await call({action: 'openTerminal', workspaceKey});
  assert.equal(opened.status, 200, JSON.stringify(opened.body));
  assert.match(opened.body.sessionId, /^remote-pty-/);
  assert.deepEqual((await call({action: 'listTerminals', workspaceKey})).body.map(item => item.sessionId), [opened.body.sessionId]);
  assert.equal((await call({action: 'writeTerminal', workspaceKey, terminalId: opened.body.sessionId, text: 'echo hi'})).status, 200);
  assert.equal((await call({action: 'resizeTerminal', workspaceKey, terminalId: opened.body.sessionId, cols: 100, rows: 30})).status, 200);
  assert.equal((await call({action: 'closeTerminal', workspaceKey, terminalId: opened.body.sessionId})).status, 200);
  assert.deepEqual((await call({action: 'listTerminals', workspaceKey})).body, []);
});

test('the panel fences stale workspaces, unknown sessions and read-only sessions', async () => {
  const fixture = context();
  const session = {id: 'session-a', header: {cwd: '/local/project'}};
  fixture.ctx.sessions = {get: id => id === session.id ? session : undefined};
  apply(fixture.ctx, {startupWaitMs: 1});
  const call = async args => {
    const response = await fixture.routes.get('/api/dsh-terminal')(new Request('http://localhost', {method: 'POST', body: JSON.stringify({sessionId: session.id, ...args})}));
    return {status: response.status, body: await response.json()};
  };
  const workspaceKey = (await call({action: 'workspace'})).body.key;
  // Reads stay available while the key is stale, so a pane can still show what
  // it already owns; every mutation is fenced by the observed key.
  assert.equal((await call({action: 'listTerminals', workspaceKey: 'stale'})).status, 200);
  const stale = await call({action: 'openTerminal'});
  assert.equal(stale.status, 409);
  assert.equal(stale.body.error, 'TERMINAL_WORKSPACE_CHANGED');
  const staleWrite = await call({action: 'writeTerminal', workspaceKey: 'stale', terminalId: 'local-pty-1', text: 'x'});
  assert.equal(staleWrite.status, 409);
  assert.equal(staleWrite.body.error, 'TERMINAL_WORKSPACE_CHANGED');
  assert.equal((await fixture.routes.get('/api/dsh-terminal')(new Request('http://localhost', {method: 'POST', body: JSON.stringify({sessionId: 'other', action: 'workspace'})}))).status, 400);
  fixture.services.sandboxPolicy = {resolve: () => ({mode: 'read-only'})};
  assert.equal((await call({action: 'listTerminals', workspaceKey: workspaceFor(fixture.ctx, session).key})).status, 200);
  const denied = await call({action: 'openTerminal', workspaceKey: workspaceFor(fixture.ctx, session).key});
  assert.equal(denied.status, 400);
  assert.equal(denied.body.error, 'TERMINAL_READ_ONLY');
});

test('panel terminals are owned by the Session and closed on session and plugin disposal', async () => {
  const fixture = context();
  const session = {id: 'session-a', header: {cwd: '/tmp'}};
  const other = {id: 'session-b', header: {cwd: '/tmp'}};
  let disposeSession;
  let disposePlugin;
  fixture.ctx.sessions = {get: id => [session, other].find(item => item.id === id)};
  fixture.ctx.on = (event, callback) => {if (event === 'session/disposed') disposeSession = callback;};
  fixture.ctx.effect = setup => {disposePlugin = setup();};
  apply(fixture.ctx, {startupWaitMs: 1});
  const call = async (item, action) => {
    const response = await fixture.routes.get('/api/dsh-terminal')(new Request('http://localhost', {method: 'POST', body: JSON.stringify({
      sessionId: item.id, action, workspaceKey: workspaceFor(fixture.ctx, item).key,
    })}));
    return {status: response.status, body: await response.json()};
  };
  const first = await call(session, 'openTerminal');
  const second = await call(other, 'openTerminal');
  assert.equal(first.status, 200, JSON.stringify(first.body));
  assert.equal(second.status, 200, JSON.stringify(second.body));
  assert.equal((await call(session, 'listTerminals')).body.length, 1);
  assert.equal((await call(other, 'listTerminals')).body.length, 1);
  assert.equal(typeof disposeSession, 'function');
  disposeSession(session);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(fixture.terminated, [fixture.spawned[0].pid]);
  assert.deepEqual((await call(session, 'listTerminals')).body, []);
  await disposePlugin();
  assert.deepEqual(fixture.terminated, [fixture.spawned[0].pid, fixture.spawned[1].pid]);
});

test('a panel local terminal runs confined by the Session sandbox policy', async () => {
  const fixture = context();
  const session = {id: 'session-sandbox', header: {cwd: '/local/project'}};
  fixture.ctx.sessions = {get: id => id === session.id ? session : undefined};
  fixture.ctx.subprocess.resolveExecutable = async program => program;
  const confined = [];
  fixture.services.sandboxPolicy = {resolve: () => ({mode: 'workspace-write', workspaceRoot: '/local/project', sessionId: session.id})};
  fixture.services.sandbox = {confine(argv, policy) {
    confined.push({argv, policy});
    return {argv: ['/usr/bin/sandbox-exec', '-p', 'profile', ...argv]};
  }};
  const argv = [];
  const spawnTerminal = fixture.ctx.subprocess.spawnTerminal;
  fixture.ctx.subprocess.spawnTerminal = async spec => {argv.push(spec.argv); return spawnTerminal(spec);};
  apply(fixture.ctx, {startupWaitMs: 1});
  const response = await fixture.routes.get('/api/dsh-terminal')(new Request('http://localhost', {method: 'POST', body: JSON.stringify({
    sessionId: session.id, action: 'openTerminal', workspaceKey: workspaceFor(fixture.ctx, session).key,
  })}));
  assert.equal(response.status, 200, await response.text());
  assert.equal(confined.length, 1);
  assert.equal(confined[0].policy.mode, 'workspace-write');
  assert.equal(confined[0].policy.workspaceRoot, '/local/project');
  assert.deepEqual(argv[0].slice(0, 3), ['/usr/bin/sandbox-exec', '-p', 'profile']);
});

test('a panel local terminal fails closed without a sandbox provider', async () => {
  const fixture = context();
  const session = {id: 'session-no-sandbox', header: {cwd: '/local/project'}};
  fixture.ctx.sessions = {get: id => id === session.id ? session : undefined};
  fixture.services.sandboxPolicy = {resolve: () => ({mode: 'workspace-write', workspaceRoot: '/local/project'})};
  apply(fixture.ctx, {startupWaitMs: 1});
  const response = await fixture.routes.get('/api/dsh-terminal')(new Request('http://localhost', {method: 'POST', body: JSON.stringify({
    sessionId: session.id, action: 'openTerminal', workspaceKey: workspaceFor(fixture.ctx, session).key,
  })}));
  assert.equal(response.status, 400);
  assert.equal((await response.json()).error, 'TERMINAL_SANDBOX_UNAVAILABLE');
});

test('connection choices follow the SSH service allowlist', () => {
  const allowed = {id: 'a', host: 'server-a', name: 'A'};
  const blocked = {id: 'b', host: 'server-b', name: 'B'};
  const ctx = {get: () => ({getConnections: () => [allowed, blocked], allowed: connection => connection.id === 'a'})};
  assert.deepEqual(connectionChoices(ctx), [{id: 'a', name: 'A', host: 'server-a'}]);
  assert.deepEqual(connectionChoices({get: () => undefined}), []);
  assert.throws(() => assertWorkspace({get: () => ({})}, {id: 'session-a', header: {cwd: '/tmp'}}, 'key'), /SSH_PLUGIN_UPDATE_REQUIRED/);
});
