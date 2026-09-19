import net from 'node:net';
import {mkdir,chmod,writeFile,unlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {digest} from './store.js';
export async function automationServer(directory,execute){
  const folder=join(tmpdir(),'dsh-paper-'+(process.getuid?.()??'local'));await mkdir(folder,{recursive:true,mode:0o700});await chmod(folder,0o700);
  const socket=join(folder,digest(directory).slice(0,20)+'.sock');
  // Probe live owners before removing a stale endpoint.
  const live=await new Promise(resolve=>{const s=net.connect(socket);s.on('connect',()=>{s.destroy();resolve(true);});s.on('error',()=>resolve(false));});
  if(live)throw new Error('论文自动化接口已由另一个进程运行');
  await unlink(socket).catch(()=>{});
  const server=net.createServer(stream=>{let raw='',handled=false;stream.setTimeout(30000,()=>stream.destroy());stream.on('error',()=>{});stream.on('data',async b=>{if(handled)return;raw+=b;if(Buffer.byteLength(raw)>4*1024*1024){handled=true;stream.end(JSON.stringify({ok:false,error:'REQUEST_TOO_LARGE'})+'\n');return;}if(!raw.includes('\n'))return;handled=true;try{const value=await execute(JSON.parse(raw.slice(0,raw.indexOf('\n'))));stream.end(JSON.stringify({ok:true,value})+'\n');}catch(e){stream.end(JSON.stringify({ok:false,error:e.code||'ERROR',detail:e.message})+'\n');}});});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(socket,resolve);});await chmod(socket,0o600);await writeFile(join(directory,'automation.json'),JSON.stringify({version:1,socket}),{mode:0o600});
  return async()=>{await new Promise(resolve=>server.close(resolve));await unlink(socket).catch(()=>{});};
}
