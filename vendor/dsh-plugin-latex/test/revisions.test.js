import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,unlink,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Store} from '../lib/store.js';
import {changes,materialize,beginReview,captureReview,decideReview,reviewView,unresolved} from '../lib/revisions.js';
import {overleafURL,redact} from '../lib/overleaf.js';
async function setup(t){const d=await mkdtemp(join(tmpdir(),'paper-reviews-'));t.after(()=>rm(d,{recursive:true,force:true}));const store=await new Store(d).init(),p=await store.add({name:'Review fixture'});return {store,p};}
test('sentence changes preserve exact text and allow mixed decisions',()=>{
 const before='First sentence. Middle stays. Third sentence.\n',after='Revised first. Middle stays. Revised third.\n';
 const parts=changes(before,after),h=parts.filter(x=>x.id);assert.equal(h.length,2);assert.equal(materialize({parts}),after);h[0].decision='reject';assert.equal(materialize({parts}),'First sentence. Middle stays. Revised third.\n');h[1].decision='reject';assert.equal(materialize({parts}),before);
});
test('review blocks overlap and applies single and bulk decisions',async t=>{
 const {store,p}=await setup(t);const f=await store.read(p.id,'main.tex');await store.save(p.id,'main.tex','One sentence. Stable sentence. Last sentence.',f.hash);
 await beginReview(store,p.id,'external');await writeFile(join(p.root,'main.tex'),'New first. Stable sentence. New last.');await captureReview(store,p.id,true);
 assert.equal(unresolved(p),2);await assert.rejects(beginReview(store,p.id,'other'),/先处理/);const r=reviewView(p);
 await decideReview(store,p.id,{batchId:r.id,hunkId:r.files[0].parts.find(x=>x.id).id,decision:'reject'});assert.equal(unresolved(p),1);
 const done=await decideReview(store,p.id,{batchId:r.id,decision:'accept'});assert.equal(done.settled,true);assert.equal((await store.read(p.id,'main.tex')).content,'One sentence. Stable sentence. New last.');
});
test('review survives restart and rejects external edits without overwrite',async t=>{
 const {store,p}=await setup(t);await beginReview(store,p.id,'external');await writeFile(join(p.root,'main.tex'),'Agent candidate.');await captureReview(store,p.id,true);
 const reloaded=await new Store(store.directory).init();assert.ok(unresolved(reloaded.get(p.id))>0);await writeFile(join(p.root,'main.tex'),'External content.');
 await assert.rejects(decideReview(reloaded,p.id,{batchId:p.revisionReview.id,decision:'reject'}),/外部修改/);assert.equal(await readFile(join(p.root,'main.tex'),'utf8'),'External content.');
});
test('new and deleted source files can be rejected as one batch',async t=>{
 const {store,p}=await setup(t);const original=(await store.read(p.id,'main.tex')).content;await beginReview(store,p.id,'external');await unlink(join(p.root,'main.tex'));await writeFile(join(p.root,'notes.tex'),'New source.');await captureReview(store,p.id,true);
 await decideReview(store,p.id,{batchId:p.revisionReview.id,decision:'reject'});assert.equal((await store.read(p.id,'main.tex')).content,original);await assert.rejects(readFile(join(p.root,'notes.tex')),{code:'ENOENT'});
});
test('active Agent changes cannot be accepted before capture completes',async t=>{
 const {store,p}=await setup(t);await beginReview(store,p.id,'chat:test');await assert.rejects(decideReview(store,p.id,{batchId:p.revisionReview.id,decision:'accept'}),/等待/);await captureReview(store,p.id,true);assert.equal(p.revisionReview,null);
});
test('Overleaf address validator restricts protocol, host and credentials',()=>{
 assert.equal(overleafURL('https://git@git.overleaf.com/'+'a'.repeat(24)),'https://git@git.overleaf.com/'+'a'.repeat(24));
 for(const u of ['http://git.overleaf.com/'+'a'.repeat(24),'https://git.overleaf.com.evil.test/'+'a'.repeat(24),'https://u:secret@git.overleaf.com/'+'a'.repeat(24),'file:///tmp/project']) assert.throws(()=>overleafURL(u));
 assert.equal(redact('olp_'+'A'.repeat(32)),'[凭证已隐藏]');
});

test('review diffs exclude unchanged LaTeX preamble and section commands',()=>{
 const before='\\documentclass{article}\n\\begin{document}\n\\section{Introduction}\nOriginal sentence.\n\\end{document}\n';const after=before.replace('Original sentence.','Revised sentence.');
 const parts=changes(before,after),h=parts.filter(p=>p.id);assert.equal(h.length,1);assert.equal(h[0].before,'Original sentence.');assert.equal(h[0].after,'Revised sentence.');assert.equal(materialize({parts}),after);
});
