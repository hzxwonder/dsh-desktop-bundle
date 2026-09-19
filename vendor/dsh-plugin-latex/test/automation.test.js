import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {automationServer} from '../lib/automation.js';
test('automation socket supports structured responses, private permissions and stale-owner protection',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'paper-api-'));t.after(()=>rm(dir,{recursive:true,force:true}));const close=await automationServer(dir,async a=>{if(a.action!=='list')throw Error('unsupported');return ['paper'];});t.after(close);
 const {socket}=JSON.parse(await readFile(join(dir,'automation.json'),'utf8'));assert.equal((await stat(socket)).mode&0o777,0o600);
 await assert.rejects(automationServer(dir,async()=>{}),/另一个进程/);
 const request=body=>new Promise((resolve,reject)=>{const c=net.connect(socket);let s='';c.on('connect',()=>c.write(body+'\n'));c.on('data',b=>s+=b);c.on('end',()=>resolve(JSON.parse(s)));c.on('error',reject);});
 assert.deepEqual(await request('{"action":"list"}'),{ok:true,value:['paper']});assert.equal((await request('invalid-json')).ok,false);assert.equal((await request('{"action":"credential"}')).ok,false);
});
