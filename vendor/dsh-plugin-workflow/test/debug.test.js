import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { Store } from '../lib/store.js';
import { Engine } from '../lib/engine.js';
import { Checkpoints } from '../lib/checkpoints.js';
import { validateDefinition } from '../lib/definition.js';
const definition = () => ({ schemaVersion: '1.0', id: 'debug', name: 'Editorial workflow', nodes: [
  { id: 'draft', name: 'Draft', kind: 'agent', prompt: 'Draft', input: { text: { source: 'workflow', path: '/text' } } },
  { id: 'review', name: 'Review', kind: 'agent', prompt: 'Review', input: { text: { source: 'node', nodeId: 'draft', path: '/text' } } },
  { id: 'publish', name: 'Publish', kind: 'artifact', input: { content: { source: 'node', nodeId: 'review', path: '/text' } } },
], edges: [{ from: 'draft', to: 'review' }, { from: 'review', to: 'publish' }] });
async function setup(t, overrides = {}) {
  const root = await mkdtemp('/private/tmp/workflow-debug-'), cwd = join(root, 'project');
  await mkdir(cwd);
  const store = new Store(join(root, 'data.sqlite'));
  const calls = [];
  const adapter = { rootRoute: () => ({ provider: 'local', model: 'test' }), route: async n => ({ provider: 'local', model: n.model?.id ?? 'test' }), skills: async () => [],
    agent: async (node, input) => { calls.push(node.id); return { text: input.text + ':' + node.id }; }, ...overrides };
  const engine = new Engine(store, adapter, join(root, 'artifacts'));
  store.save(definition());
  const parent = { session: { id: 'root-session', header: { cwd } } };
  const start = (extra = {}) => engine.start({ workflowId: 'debug', revision: 1, input: { text: 'material' }, parent, ...extra });
  t.after(async () => { await engine.close(); store.close(); await rm(root, { recursive: true, force: true }); });
  return { engine, store, start, calls, parent, cwd, root };
}
test('D01 D02: debug advances one ready step and finishes at the last step', async t => {
  const f = await setup(t); let r = await f.start({ debug: true });
  assert.equal(r.status, 'paused'); assert.deepEqual(f.calls, ['draft']);
  r = await f.engine.resume(r.id, f.parent, undefined, true);
  assert.equal(r.status, 'paused'); assert.deepEqual(f.calls, ['draft', 'review']);
  r = await f.engine.resume(r.id, f.parent, undefined, true);
  assert.equal(r.status, 'completed'); assert.equal(r.nodes.publish.status, 'completed');
});
test('D03 R02: concurrent start and resume refuse duplicate execution', async t => {
  const f = await setup(t);
  const results = await Promise.allSettled([f.start({ debug: true }), f.start({ debug: true })]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const r = results.find(r => r.status === 'fulfilled').value;
  const resumed = await Promise.allSettled([f.engine.resume(r.id, f.parent, undefined, true), f.engine.resume(r.id, f.parent, undefined, true)]);
  assert.equal(resumed.filter(r => r.status === 'fulfilled').length, 1);
  assert.deepEqual(f.calls, ['draft', 'review']);
});
test('D06 F03: rewind restores files and preserves prior attempts', async t => {
  let cwd;
  const f = await setup(t, { agent: async (n, input) => { await writeFile(join(cwd, 'shared.txt'), n.id); return { text: input.text }; } });
  cwd = f.cwd; await writeFile(join(cwd, 'shared.txt'), 'original');
  let r = await f.start();
  assert.equal(r.status, 'completed', r.error);
  r = await f.engine.rewind(r.id, 'draft');
  assert.equal(await readFile(join(cwd, 'shared.txt'), 'utf8'), 'original');
  assert.equal(r.nodes.draft.status, 'stale');
  assert.equal(r.nodes.draft.attempts[0].reverted, true);
  r = await f.engine.resume(r.id, f.parent, undefined, true, { debug: true });
  assert.equal(r.nodes.draft.attempts.length, 2); assert.equal(r.status, 'paused');
});
test('F05: conflicting user edits block the entire rollback before writing', async t => {
  let cwd; const f = await setup(t, { agent: async (n) => { await writeFile(join(cwd, n.id + '.txt'), n.id); return { text: n.id }; } });
  cwd = f.cwd; const r = await f.start();
  await writeFile(join(cwd, 'draft.txt'), 'user edit');
  await assert.rejects(f.engine.rewind(r.id, 'draft'), /CHECKPOINT_CONFLICT/);
  assert.equal(await readFile(join(cwd, 'review.txt'), 'utf8'), 'review');
  assert.equal(await readFile(join(cwd, 'draft.txt'), 'utf8'), 'user edit');
  assert.equal(f.store.get('run', r.id).status, 'completed');
});
test('D12 D14: explicit adoption invalidates descendants and rejects stale revisions', async t => {
  const f = await setup(t); let r = await f.start(); const rev = r.checkpointRevision;
  r = await f.engine.adopt(r.id, 'draft', { text: 'revised' }, { expectedRevision: rev });
  assert.equal(r.nodes.draft.output.text, 'revised'); assert.equal(r.nodes.review.status, 'stale');
  await assert.rejects(f.engine.rewind(r.id, 'draft', { expectedRevision: rev }), /RUN_CONFLICT/);
  r = await f.engine.resume(r.id, f.parent, undefined, true, { debug: false });
  assert.equal(r.nodes.review.output.text, 'revised:review');
});
test('S07 S08: parallel subagents overlap and feed their named results to the step', async t => {
  let active = 0, maximum = 0, gathered;
  const f = await setup(t, { agent: async (node, input) => {
    if (['facts', 'style'].includes(node.id)) { active++; maximum = Math.max(maximum, active); await new Promise(r => setTimeout(r, 20)); active--; return { text: node.id }; }
    gathered ??= input.subagents; return { text: 'complete' };
  } });
  const d = definition(); d.nodes[0].subagents = [{ id: 'facts', name: 'Facts', prompt: 'Check facts', model: { mode: 'explicit', id: 'facts-model' } }, { id: 'style', name: 'Style', prompt: 'Check style' }];
  f.store.save(d, 1);
  const r = await f.start({ revision: 2, debug: true });
  assert.equal(r.status, 'paused', r.error); assert.equal(maximum, 2);
  assert.deepEqual(Object.keys(gathered), ['facts', 'style']);
  assert.equal(r.nodes.draft.subagents.facts.route.model, 'facts-model');
});
test('R09 F12: overlapping public roots are excluded from simultaneous workflow writes', async t => {
  const f = await setup(t);
  const unlock = await f.engine.checkpoints.lock(f.cwd, 'one');
  await assert.rejects(f.engine.checkpoints.lock(f.cwd, 'two'), /WORKSPACE_BUSY/);
  await mkdir(join(f.cwd, 'nested'));
  await assert.rejects(f.engine.checkpoints.lock(join(f.cwd, 'nested'), 'two'), /WORKSPACE_BUSY/);
  unlock(); const release = await f.engine.checkpoints.lock(f.cwd, 'two'); release();
});
test('F07 F08: binary content and modes restore, symlink replacement is rejected', async t => {
  const f = await setup(t), c = new Checkpoints(join(f.root, 'checkpoints')), folder = join(f.root, 'checkpoints', 'one');
  const file = join(f.cwd, 'binary'); await writeFile(file, Buffer.from([0, 255, 1]), { mode: 0o640 });
  const before = await c.begin(f.cwd, folder, {}); await writeFile(file, Buffer.from([1, 2, 3]));
  const checkpoint = await c.finish(before, folder, {}); await c.rollback([checkpoint]);
  assert.deepEqual(await readFile(file), Buffer.from([0, 255, 1])); assert.equal((await stat(file)).mode & 0o777, 0o640);
  const b = await c.begin(f.cwd, folder + '2', {}); await writeFile(file, 'changed'); const p = await c.finish(b, folder + '2', {});
  await rm(file); await symlink(join(f.root, 'outside'), file);
  await assert.rejects(c.rollback([p]), /CHECKPOINT_CONFLICT/);
});
test('C11 S07: invalid team definitions fail before execution', () => {
  const d = definition(); d.nodes[0].subagents = [{ id: 'x', name: 'X', prompt: 'X' }, { id: 'x', name: 'Y', prompt: 'Y' }];
  assert.throws(() => validateDefinition(d), /DUPLICATE_SUBAGENT/);
});

test('D08: debug branch executes one ready node and waits for both before joining', async t => {
  const f = await setup(t), d = definition();
  d.nodes[1].input = { text: { source: 'workflow', path: '/text' } };
  d.edges = [{ from: 'draft', to: 'publish' }, { from: 'review', to: 'publish' }];
  f.store.save(d, 1);
  let r = await f.start({ revision: 2, debug: true });
  assert.deepEqual(f.calls, ['draft']); assert.equal(r.nodes.publish, undefined);
  r = await f.engine.resume(r.id, f.parent, undefined, true); assert.deepEqual(f.calls, ['draft', 'review']);
  r = await f.engine.resume(r.id, f.parent, undefined, true); assert.equal(r.status, 'completed');
});
test('D15 F04: nested debug leaves resume and rollback without overlapping patches', async t => {
  let cwd; const f = await setup(t, { agent: async n => { await writeFile(join(cwd, 'shared.txt'), n.id); return { text: n.id }; } }); cwd = f.cwd;
  await writeFile(join(cwd, 'shared.txt'), 'original');
  const child = definition(); child.id = 'child'; child.nodes = child.nodes.slice(0, 2); child.edges = child.edges.slice(0, 1); f.store.save(child);
  const d = definition(); d.nodes = [{ id: 'nested', name: 'Nested', kind: 'subworkflow', workflow: { id: 'child', revision: 1 }, input: { text: { source: 'workflow', path: '/text' } } }]; d.edges = []; f.store.save(d, 1);
  let r = await f.start({ revision: 2, debug: true }); assert.equal(r.status, 'paused'); assert.equal(r.nodes['nested/draft'].status, 'completed');
  r = await f.engine.resume(r.id, f.parent, undefined, true); assert.equal(r.status, 'completed', r.error);
  await f.engine.rewind(r.id, 'nested'); assert.equal(await readFile(join(cwd, 'shared.txt'), 'utf8'), 'original');
});
test('D14: adoption rejects simultaneous resume while its rollback is in progress', async t => {
  const f = await setup(t), r = await f.start();
  const adopted = f.engine.adopt(r.id, 'draft', { text: 'new' });
  await assert.rejects(f.engine.resume(r.id, f.parent, undefined, true), /RUN_NOT_RESUMABLE/);
  assert.equal((await adopted).nodes.draft.output.text, 'new');
});
test('R06 R07 S12: pause cancels active work and resumes completed steps only once', async t => {
  let entered; const ready = new Promise(r => entered = r); let count = 0;
  const f = await setup(t, { agent: async (_n, input, _r, _s, _p, signal) => { count++; if (count === 1) { entered(); await new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })); } return { text: input.text }; } });
  const pending = f.start(); await ready; const run = f.store.list('run')[0]; f.engine.cancel(run.id, true);
  assert.equal((await pending).status, 'paused');
  assert.equal((await f.engine.resume(run.id, f.parent, undefined, true)).status, 'completed'); assert.equal(count, 3);
});
test('F02: unified text patch is applicable by git and preserves missing newline', async t => {
  const { execFileSync } = await import('node:child_process');
  const f = await setup(t), c = f.engine.checkpoints, folder = c.folder('patch', 'step', 1), file = join(f.cwd, 'notes with spaces.txt');
  await writeFile(file, 'before'); const before = await c.begin(f.cwd, folder, {}); await writeFile(file, 'after\nsecond\n');
  await c.finish(before, folder, {}); await writeFile(file, 'before');
  execFileSync('git', ['apply', '--check', join(folder, 'changes.patch')], { cwd: f.cwd });
  execFileSync('git', ['apply', join(folder, 'changes.patch')], { cwd: f.cwd });
  assert.equal(await readFile(file, 'utf8'), 'after\nsecond\n');
});
test('C05 S08: whitespace team prompts and missing explicit model ids fail validation', () => {
  const d = definition(); d.nodes[0].subagents = [{ id: 'x', name: 'X', prompt: '   ' }]; assert.throws(() => validateDefinition(d), /PROMPT_REQUIRED/);
  d.nodes[0].subagents[0].prompt = 'Check'; d.nodes[0].subagents[0].model = { mode: 'explicit' }; assert.throws(() => validateDefinition(d), /ROUTE_ID_REQUIRED/);
});
test('F10: unfinished rollback recovers originals and refuses external edits', async t => {
  const f = await setup(t), c = f.engine.checkpoints, folder = c.folder('crash', 'step', 1), path = join(f.cwd, 'file');
  await writeFile(path, 'original'); const before = await c.begin(f.cwd, folder, {}); await writeFile(path, 'changed'); await c.finish(before, folder, {});
  const patch = JSON.parse(await readFile(join(folder, 'patch.json'), 'utf8')).changes[0];
  const journal = join(c.directory, 'rollback-test');
  await c.save(journal, 'transaction.json', { status: 'prepared', originals: [[path, patch.after]], targets: [[path, patch.before]] });
  await writeFile(path, 'original'); assert.equal(await c.recover(), null); assert.equal(await readFile(path, 'utf8'), 'changed');
  await c.save(journal, 'transaction.json', { status: 'prepared', originals: [[path, patch.after]], targets: [[path, patch.before]] });
  await writeFile(path, 'external'); assert.equal(await c.recover(), 'CHECKPOINT_CONFLICT');
  await assert.rejects(c.lock(f.cwd, 'other'), /CHECKPOINT_RECOVERY_REQUIRED/); assert.equal(await readFile(path, 'utf8'), 'external');
});
test('N05: edited prompt is run-local and durable attachment blocks reach the executor', async t => {
  let seen;
  const f = await setup(t, { agent: async (node, input) => { seen = {node, input}; return {text:'done'}; } });
  let r = await f.start({debug:true});
  const block = {type:'file', attachment:{attachmentId:'synthetic-id',name:'notes.txt',bytes:5}};
  r.stepOverrides = {draft:{prompt:'Revised prompt',attachments:[block]}}; f.store.updateRun(r,'test.edited');
  r = await f.engine.rewind(r.id,'draft');
  r = await f.engine.resume(r.id,f.parent,undefined,true,{debug:true,nodeId:'draft'});
  assert.equal(seen.node.prompt,'Revised prompt'); assert.deepEqual(seen.input.attachments,[block]);
  assert.equal(f.store.get('revision','debug:1').definition.nodes[0].prompt,'Draft');
  assert.equal(r.nodes.review,undefined);
});
test('N06: input files are inherited through graph edges and deduplicated', async t => {
  const block = {type:'file',attachment:{attachmentId:'id',name:'report.txt',bytes:12}};
  let seen;
  const f = await setup(t,{agent:async(node,input)=>{ if(node.id==='review')seen=input; return {text:'done',attachments:[block]}; }});
  const r=await f.start(); assert.equal(r.status,'completed');assert.deepEqual(seen.attachments,[block]);
});
test('N07: changed public files become output attachments available to downstream steps', async t => {
  let cwd, downstream;
  const f=await setup(t,{file:async(path,name)=>({type:'file',attachment:{attachmentId:name,name,bytes:(await stat(path)).size}}),agent:async(node,input)=>{
    if(node.id==='draft') await writeFile(join(cwd,'result.txt'),'synthetic artifact');
    else downstream=input;
    return {text:'result'};
  }});cwd=f.cwd;
  const r=await f.start();assert.equal(r.status,'completed');
  assert(r.nodes.draft.output.attachments.some(b=>b.attachment.name==='result.txt'));
  assert(downstream.attachments.some(b=>b.attachment.name==='result.txt'));
});
