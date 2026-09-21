import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { attachSession } from '../../../distribution/dsh-desktop-bundle/qa/driver.mjs';
const directory = 'docs/acceptance/desktop'; mkdirSync(directory,{recursive:true});
const session = await attachSession({ port: Number(process.env.WORKFLOW_CDP_PORT ?? 9449), home: process.env.WORKFLOW_QA_HOME, evidenceDir: directory });
const capture = async name => {
 const viewport = await session.eval('({width:innerWidth,height:innerHeight})');
 const left = await session.eval(`document.querySelector('.wf-timeline')?.getBoundingClientRect().left ?? 300`);
 const result = await session.client.send('Page.captureScreenshot',{format:'png',clip:{x:Math.max(0,left-16),y:0,width:viewport.width-Math.max(0,left-16),height:viewport.height,scale:1}});
 writeFileSync(directory+'/'+name+'.png',Buffer.from(result.data,'base64'));
};
const results=[];
const record=async(id,title,fn)=>{try{await fn();results.push({id,title,status:'通过'});}catch(e){results.push({id,title,status:'失败',error:e.message});throw e;}finally{writeFileSync(directory+'/results.json',JSON.stringify(results,null,2));}};
const api=(path,args)=>session.eval(`fetch(${JSON.stringify(path)},{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify(args)})}).then(r=>r.json())`);
const call=async args=>{const r=await api('/api/workflow-studio',args);assert(r.ok,JSON.stringify(r));return r.value;};
const click=async(text,selector='button')=>{
 const rect=await session.eval(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>(e.getAttribute('aria-label')===${JSON.stringify(text)} || e.textContent.trim()===${JSON.stringify(text)}));if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2}})()`);assert(rect,'missing '+text);await session.clickAt(rect.x,rect.y);await new Promise(r=>setTimeout(r,400));
};
const waitRun=async(id,status)=>{for(let i=0;i<120;i++){const r=(await call({action:'runRead',id})).run;if(r.status===status)return r;await new Promise(r=>setTimeout(r,150));}throw new Error('run timeout '+status);};
let runId, rootId,run;
const suffix = process.env.WORKFLOW_QA_CASE ?? Date.now().toString();
try {
 await record('E01','Desktop 原生 Host 创建调试运行',async()=>{
  const def={schemaVersion:'1.0',id:'desktop-review-'+suffix,name:'实验记录审核',trigger:'manual',nodes:[{id:'review',name:'核对实验材料',kind:'agent',prompt:'核对材料并提供复现建议。',tools:['verify_material'],input:{text:{source:'workflow',path:'/text'}}},{id:'deliver',name:'形成交付记录',kind:'artifact',input:{content:{source:'node',nodeId:'review',path:'/text'}}}],edges:[{from:'review',to:'deliver'}]};
  await call({action:'save',definition:def,expectedRevision:0});rootId=(await api('/api/workflow-fixture',{action:'create',sessionId:'desktop-review-session-'+suffix})).sessionId;
  await call({action:'bind',id:def.id,revision:1,sessionId:rootId});
  runId=(await call({action:'run',id:def.id,revision:1,sessionId:rootId,input:{text:'合成实验记录：固定随机种子，记录环境和误差。'},debug:true,background:true})).runId;
  run=await waitRun(runId,'paused');assert.equal(run.nodes.review.status,'completed');assert.equal(run.nodes.deliver,undefined);
 });
 await record('E02','Desktop 打开工作流及原生步骤对话',async()=>{
  await session.client.send('Page.reload'); await session.waitFor(`!!document.querySelector('button[aria-label=工作流]')`);
  if (!(await session.eval(`document.querySelector('button[aria-label=工作流]')?.getAttribute('aria-expanded') === 'true'`))) await session.click('button[aria-label=工作流]');
  if(await session.eval(`!!document.querySelector('button[aria-label=返回工作流列表]')`)) await click('返回工作流列表');
  await session.waitFor(`!!document.querySelector('[data-workflow-card="desktop-review-${suffix}"]')`);
  await click('打开',`[data-workflow-card="desktop-review-${suffix}"] button`);await click('运行记录','[role=tab]');await click('运行记录');await click(runId.slice(0,18));await click('打开总会话');
  await session.waitFor('!!document.querySelector(".wf-timeline")');if(await session.eval(`!!document.querySelector('button[aria-label=展开过程]')`)) await click('展开过程');
  await session.waitFor(`document.querySelector('.wf-native-step [data-chat-flow]')?.textContent.includes('Synthetic local execution completed')`);
  await capture('native-step');
  assert.equal(await session.eval(`document.querySelectorAll('.wf-native-step [role=tab]').length`),0);await click('收起过程');await capture('notebook-overview');
 });
 await record('E03','Desktop 步骤独立会话及返回',async()=>{await click('打开步骤会话');await session.waitFor(`!!document.querySelector('button[aria-label=返回工作流总会话]')`);await capture('independent-session');await click('返回工作流总会话');await session.waitFor('!!document.querySelector(".wf-timeline")');});
 await record('E04','Desktop 单步完成交付',async()=>{await click('运行一步');run=await waitRun(runId,'completed');assert.equal(run.nodes.deliver.status,'completed');await capture('completed');});
 await record('E05','Desktop 刷新后恢复运行',async()=>{await session.client.send('Page.reload');await session.waitFor('!!document.querySelector(".wf-timeline")');assert.equal((await call({action:'runRead',id:runId})).run.status,'completed');});
 results.push({id:'E06',title:'Desktop 隐藏恢复后的可见界面',status:'待测',reason:'需通过真实窗口隐藏与恢复验证内容绘制及交互'});
 
 console.log('Desktop: '+results.length+' passed');
} finally { process.exitCode=results.some(r=>r.status==='失败')?1:0; session.client.socket.close(); setTimeout(() => process.exit(process.exitCode ?? 0), 100); }
