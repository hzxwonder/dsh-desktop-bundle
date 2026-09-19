import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {Store} from '../lib/store.js';
import {Overleaf,git} from '../lib/overleaf.js';
async function fixture(t){
 const d=await mkdtemp(join(tmpdir(),'overleaf-git-test-'));t.after(()=>rm(d,{recursive:true,force:true}));
 const exec=async(args,cwd=d)=>{const r=await git(args,{cwd});assert.equal(r.code,0,r.output);return r.output.trim();};
 await exec(['init','--bare','--initial-branch=main','remote.git']);await exec(['clone','remote.git','work']);const root=join(d,'work');await writeFile(join(root,'main.tex'),'Initial text.\n');await exec(['add','.'],root);await exec(['-c','user.name=Test','-c','user.email=test@localhost','commit','-m','Initial'],root);await exec(['push','origin','HEAD'],root);
 const store=await new Store(join(d,'data')).init(),p=await store.add({name:'Git fixture',path:root});const url='https://git@git.overleaf.com/'+'a'.repeat(24);p.overleaf={remote:'origin',url};
 const sync=new Overleaf(store,{get:async()=> 'fixture-password'},{runGit:async(args,options)=>args[0]==='remote'&&args[1]==='get-url'?{code:0,output:url}:git(args,options)});
 return {store,p,sync,exec,d,root};
}
test('Overleaf sync commits only selected files and preserves unrelated staged content',async t=>{
 const {p,sync,exec,root}=await fixture(t);await writeFile(join(root,'main.tex'),'Manual change.\n');await writeFile(join(root,'private.txt'),'Unrelated local draft');await exec(['add','private.txt'],root);
 const result=await sync.sync(p.id,['main.tex']);assert.equal(result.status,'synced',result.message);assert.equal(await exec(['diff','--cached','--name-only'],root),'private.txt');assert.equal(await exec(['rev-parse','HEAD'],root),await exec(['rev-parse','origin/main'],root));
});
test('pending reviews block push and remote divergence reports changed files',async t=>{
 const {p,sync,exec,d,root}=await fixture(t);p.revisionReview={active:false,files:[]};assert.equal((await sync.sync(p.id,['main.tex'])).status,'pending');p.revisionReview=null;
 await exec(['clone','remote.git','other']);const other=join(d,'other');await writeFile(join(other,'main.tex'),'Remote change.\n');await exec(['add','.'],other);await exec(['-c','user.name=Test','-c','user.email=test@localhost','commit','-m','Remote'],other);await exec(['push','origin','HEAD'],other);
 await writeFile(join(root,'main.tex'),'Local change.\n');const result=await sync.sync(p.id,['main.tex']);assert.equal(result.code,'GIT_CONFLICT');assert.match(result.message,/main.tex/);assert.equal(await readFile(join(root,'main.tex'),'utf8'),'Local change.\n');
});
test('missing global credentials reports a recoverable sync error',async t=>{
 const {p,store}=await fixture(t);const sync=new Overleaf(store,{get:async()=>null});assert.equal((await sync.sync(p.id,['main.tex'])).code,'CREDENTIAL_REQUIRED');
});


test('rejecting a newly proposed file leaves synchronization clean',async t=>{
 const {p,sync}=await fixture(t);const result=await sync.sync(p.id,['discarded.tex']);assert.equal(result.status,'synced',result.message);
});
