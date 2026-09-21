import test from 'node:test';
import assert from 'node:assert/strict';
import { harnessAdapter } from '../lib/harness.js';

test('continued steps enqueue a turn on the existing child and return its new output', async () => {
  let starts = 0, request;
  const events = [];
  const child = { whenIdle: async () => {}, cancel: () => {}, session: { snapshotEvents: () => events } };
  const ctx = {
    subagents: { getProvider: () => ({ prepareContinuable: true }), startContinuable: async () => { starts++; return { childId: 'unexpected' }; }, prompt: async r => {
      request = r; events.push({ type: 'assistant/message', data: { message: { content: [{ type: 'text', text: 'Revised article' }] } } }, { type: 'turn/end', data: { reason: { kind: 'completed' } } });
    } },
    agents: { get: id => id === 'existing-child' ? child : undefined, withInitiator: (_p, fn) => fn() },
  };
  const output = await harnessAdapter(ctx).agent({ name: 'Writer', prompt: 'Revise', tools: [] }, { feedback: 'Clarify example' }, { executor: 'spawn' }, [], { session: { id: 'parent' } }, new AbortController().signal, { sessionId: 'existing-child' });
  assert.equal(starts, 0); assert.equal(request.delivery, 'queue'); assert.equal(request.childSessionId, 'existing-child');
  assert.match(request.content[0].text, /Clarify example/); assert.equal(output.text, 'Revised article');
});

test('workflow tool guard covers session-owned tools excluded by the step', async () => {
 let guard;
 const ctx={tools:{guard:f=>{guard=f}},subagents:{getProvider:()=>({})}};
 const adapter=harnessAdapter(ctx);
 await assert.rejects(adapter.agent({name:'Reader',prompt:'Read',tools:[]},{},{executor:'spawn'},[],{session:{id:'root'}},new AbortController().signal,{sessionId:'old'}));
 const agent={session:{header:{parentSession:'root'},snapshotEvents:()=>[{type:'subagent/descriptor',data:{toolFilter:{allow:[]}}}]}};
 assert.equal(guard({agent,name:'subagent'}),'WORKFLOW_TOOL_NOT_ALLOWED');
 assert.equal(guard({agent,name:'bash'}),'WORKFLOW_TOOL_NOT_ALLOWED');
 agent.session.header.parentSession='unrelated';assert.equal(guard({agent,name:'bash'}),undefined);
});

test('structured output accepts a single JSON block and rejects ambiguous blocks', async () => {
 const {parseStructuredOutput}=await import('../lib/harness.js');
 assert.deepEqual(parseStructuredOutput('Summary\n```json\n{"score":90}\n```\nDone'),{score:90});
 assert.throws(()=>parseStructuredOutput('```json\n{"score":90}\n```\n```json\n{"score":40}\n```'),{code:'STRUCTURED_OUTPUT_MISSING'});
});

test('malformed JSON receives one bounded formatting repair in the same session', async () => {
 let prompts=0;const events=[{type:'assistant/message',data:{message:{content:[{type:'text',text:'invalid JSON'}]}}},{type:'turn/end',data:{reason:{kind:'completed'}}}];
 const child={whenIdle:async()=>{},cancel:()=>{},session:{snapshotEvents:()=>events}};
 const ctx={subagents:{getProvider:()=>({prepareContinuable:true}),startContinuable:async()=>({childId:'writer'}),prompt:async()=>{prompts++;events.push({type:'assistant/message',data:{message:{content:[{type:'text',text:'{"score":82,"text":"Evidence"}'}]}}},{type:'turn/end',data:{reason:{kind:'completed'}}})}},agents:{get:()=>child,withInitiator:(_p,fn)=>fn()}};
 const output=await harnessAdapter(ctx).agent({name:'Judge',tools:[],prompt:'Review',outputSchema:{type:'object'}},{},{executor:'spawn'},[],{session:{id:'root'}},new AbortController().signal);
 assert.equal(prompts,1);assert.equal(output.score,82);
});

test('authored subagents instructions enable delegation without granting file tools', async () => {
 const {stepTools}=await import('../lib/harness.js');
 assert.deepEqual(stepTools({prompt:'使用 subagents 分别审阅内容',tools:[]}),['subagent']);
 assert.deepEqual(stepTools({prompt:'读取输入',tools:[]}),[]);
 assert.deepEqual(stepTools({prompt:'使用subagents并行',tools:[]}),['subagent']);
 assert.deepEqual(stepTools({prompt:'使用 subagents',tools:['subagent','web_fetch']}),['subagent','web_fetch']);
});

test('prompt-created descendants cannot expand workflow tool permissions', async () => {
 let guard;
 const owner={session:{header:{parentSession:'root'},snapshotEvents:()=>[{type:'subagent/descriptor',data:{toolFilter:{allow:['subagent']}}}]}};
 const child={session:{header:{parentSession:'step'},snapshotEvents:()=>[]}};
 const ctx={tools:{guard:f=>{guard=f}},agents:{get:id=>id==='step'?owner:undefined},subagents:{getProvider:()=>({})}};
 const adapter=harnessAdapter(ctx);
 await assert.rejects(adapter.agent({prompt:'使用 subagents',tools:[]},{},{executor:'spawn'},[],{session:{id:'root'}},new AbortController().signal,{sessionId:'old'}));
 assert.equal(guard({agent:child,name:'bash'}),'WORKFLOW_TOOL_NOT_ALLOWED');
 assert.equal(guard({agent:child,name:'subagent'}),undefined);
});
