import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { reviewedPaperTemplate } from '../lib/paper-workflow.js';
import { validateDefinition } from '../lib/definition.js';
import { Engine } from '../lib/engine.js';
import { Store } from '../lib/store.js';

test('four-stage paper workflow revises, isolates reader input, exports article and publishes once', async t => {
  const root = await mkdtemp('/private/tmp/paper-workflow-'); const cwd = join(root, 'project'); await mkdir(cwd);
  const store = new Store(join(root, 'data.sqlite')); const d = reviewedPaperTemplate(); validateDefinition(d); store.save(d);
  let round = 0, publications = 0; const calls = [];
  const adapter = {
    rootRoute: () => ({ provider: 'fixture', model: 'fixture' }), route: async () => ({ provider: 'fixture', model: 'fixture' }), skills: async () => [],
    agent: async (node, input) => {
      calls.push(node.id);
      if (node.id === 'source') return { text: 'ORIGINAL_PRIVATE_MARKER', title: 'Paper', sourceUrl: 'https://example.org/paper', complete: true };
      if (node.id === 'article') return { title: 'Paper explained', slug: 'paper-explained', text: ('Clear reader article with one concrete example. ').repeat(8) };
      if (node.id === 'ask') return { text: 'Explain the example.' };
      if (node.id === 'answer') { assert(!JSON.stringify(input).includes('ORIGINAL_PRIVATE_MARKER')); assert.deepEqual(Object.keys(input).sort(), ['article', 'questions']); return { text: 'The article explains the example.' }; }
      if (node.id === 'judge') return { score: ++round === 1 ? 70 : 92, text: 'Evidence and reader understanding checked.' };
      throw Error('unexpected aggregator call');
    },
    publish: async input => { publications++; assert.equal(input.review.score, 92); return { status: 'published', url: 'https://example.org/paper-explained' }; },
  };
  const engine = new Engine(store, adapter, join(root, 'artifacts'));
  t.after(async () => { await engine.close(); store.close(); await rm(root, { recursive: true, force: true }); });
  const run = await engine.start({ workflowId: d.id, revision: 1, input: { text: 'uploaded paper' }, parent: { session: { id: 'fixture', header: { cwd } } } });
  assert.equal(run.status, 'completed', run.error); assert.equal(publications, 1); assert.equal(round, 2);
  assert.equal(calls.filter(id => id === 'source').length, 1);
  assert.equal(calls.filter(id => id === 'article').length, 2);
  assert.equal(store.list('artifact').length, 2);
  assert((await readFile(store.list('artifact')[0].path, 'utf8')).includes('concrete example'));
});


test('step skill edits enter prepared execution without changing shared skill', async () => {
 const shared = {name:'paper-explainer',content:'shared instructions',hash:'original'};
 const d=reviewedPaperTemplate(); d.nodes[1].skillOverrides={'paper-explainer':'local instructions'};
 const engine=Object.create(Engine.prototype);
 engine.adapter={route:async()=>({}),skills:async(names)=>names.map(()=>({...shared}))};
 const prepared=await engine.prepare({definition:d,revision:1,hash:'fixture'}, {}, {}, AbortSignal.timeout(1000));
 assert.equal(prepared.skills.article[0].content,'local instructions');
 assert.notEqual(prepared.skills.article[0].hash,'original');
 assert.equal(shared.content,'shared instructions');
});
