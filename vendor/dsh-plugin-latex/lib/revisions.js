import {diffLines, diffSentences} from 'diff';
import {randomUUID} from 'node:crypto';
import {writeFile, unlink, mkdir, rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {inside, digest, fail} from './store.js';

export function changes(before, after) {
  if (before === after) return [];
  if (before === null || after === null) return [{id:randomUUID(),before:before || '',after:after || '',decision:null}];
  const result=[];
  function append(parts,refine=false){
    for(let i=0;i<parts.length;i++) {
      const part=parts[i];
      if(!part.added && !part.removed){result.push({equal:part.value});continue;}
      let old='',next='';
      while(i<parts.length && (parts[i].added || parts[i].removed)){
        if(parts[i].removed)old+=parts[i].value;else next+=parts[i].value;i++;
      }
      i--;
      if(refine && old && next && old.length+next.length<200000) append(diffSentences(old,next));
      else result.push({id:randomUUID(),before:old,after:next,decision:null});
    }
  }
  // First isolate changed lines; then split changed prose into sentences.
  append(diffLines(before,after),true);
  return result;
}
export const materialize = file => file.parts.map(p=>p.equal ?? (p.decision==='reject'?p.before:p.after)).join('');
export const unresolved = p => (p.revisionReview?.files || []).flatMap(f=>f.parts.filter(x=>x.id && !x.decision)).length;
export async function snapshot(store,id) {
  const values={};let total=0;
  for(const f of await store.listFiles(id)) if(f.editable) {
    const x=await store.read(id,f.name);total+=Buffer.byteLength(x.content);
    if(total>16*1024*1024) fail('论文可审阅文本超过 16 MB');
    values[f.name]=x.content;
  }
  return values;
}
export async function beginReview(store,id,owner) {
  const p=store.get(id);
  if(p.revisionReview) {
    if(p.revisionReview.active && p.revisionReview.owner===owner)return;
    if(unresolved(p)||p.revisionReview.active)fail('请先处理当前 Agent 修改','REVIEW_PENDING');
  }
  p.revisionReview={id:randomUUID(),owner,active:true,baseline:await snapshot(store,id),files:[],previousSync:p.sync,started:Date.now()};
  if(p.overleaf)p.sync={status:"pending",message:"待审阅修改，尚未推送",time:Date.now()};
  await store.persist();
}
export async function captureReview(store,id,finish=false) {
  const p=store.get(id),r=p.revisionReview;if(!r)return;
  const now=await snapshot(store,id);
  r.files=[...new Set([...Object.keys(r.baseline),...Object.keys(now)])].filter(name=>r.baseline[name]!==now[name]).map(name=>({name,before:r.baseline[name]??null,after:now[name]??null,expected:now[name]===undefined?null:digest(now[name]),parts:changes(r.baseline[name]??null,now[name]??null)}));
  if(finish) r.active=false;
  if(!r.active && !r.files.length){p.sync=r.previousSync;p.revisionReview=null;}
  await store.persist();
}
export async function decideReview(store,id,{batchId,hunkId,decision}) {
  if(!['accept','reject'].includes(decision))fail('无效的审阅决定');
  return store.serial(async()=>{
    const p=store.get(id),r=p.revisionReview;
    if(!r || r.id!==batchId)fail('修改批次已更新，请刷新','CONFLICT');
    if(r.active)fail('Agent 正在修改，请等待本轮结束','BUSY');
    const now=await snapshot(store,id);
    for(const f of r.files) if((now[f.name]===undefined?null:digest(now[f.name]))!==f.expected)fail('审阅期间文件已被外部修改：'+f.name,'CONFLICT');
    let count=0;
    for(const f of r.files) for(const h of f.parts) if(h.id && !h.decision && (!hunkId || h.id===hunkId)){h.decision=decision;count++;}
    if(!count)fail('该修改已处理，请刷新','CONFLICT');
    // Compare every file before applying the selected decisions.
    for(const f of r.files) {
      const content=materialize(f);
      const shouldDelete=(f.before===null && f.parts.every(h=>!h.id || h.decision==='reject')) || (f.after===null && f.parts.every(h=>!h.id || h.decision==='accept'));
      const path=await inside(p.root,f.name,true);
      if(shouldDelete)await unlink(path).catch(e=>{if(e.code!=='ENOENT')throw e;});
      else {await mkdir(dirname(path),{recursive:true});const tmp=path+'.'+randomUUID()+'.tmp';await writeFile(tmp,content,{mode:0o600});await rename(tmp,path);}
      f.expected=shouldDelete?null:digest(content);
    }
    if(decision === "reject") p.snapshot=null;
    const settled=!unresolved(p);
    const paths=r.files.map(f=>f.name);
    if(settled)p.revisionReview=null;
    p.revision++;await store.persist();return {settled,paths};
  });
}
export function reviewView(p) {
  const r=p.revisionReview;
  return r?{id:r.id,active:r.active,count:unresolved(p),files:r.files.map(({name,parts})=>({name,parts}))}:null;
}
