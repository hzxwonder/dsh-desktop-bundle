import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm,mkdir,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {fail} from './store.js';
export function overleafURL(value){
  let u;try{u=new URL(value);}catch{fail('请输入 Overleaf Git HTTPS 链接');}
  if(u.protocol!=='https:'||u.hostname!=='git.overleaf.com'||u.port||u.password||u.search||u.hash||!/^\/[a-f0-9]{24}\/?$/i.test(u.pathname)||u.username && u.username!=='git')fail('只支持 git.overleaf.com 的项目 Git 链接');
  return 'https://git@git.overleaf.com'+u.pathname.replace(/\/$/,'');
}
export function redact(s,token){let v=String(s);if(token)v=v.replaceAll(token,'[凭证已隐藏]');return v.replace(/olp_[A-Za-z0-9]+/g,'[凭证已隐藏]').replace(/https:\/\/[^\s]*git\.overleaf\.com\/[^\s]+/g,'<Overleaf>');}
export function git(args,{cwd,token,askpass,signal}={}){
  return new Promise((resolve,reject)=>{
    const child=spawn('git',['-c','credential.helper=','-c','core.hooksPath=/dev/null',...args],{cwd,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_ASKPASS:askpass||'/usr/bin/false',DSH_OVERLEAF_TOKEN:token||'',GIT_TRACE:'0',GIT_TRACE_CURL:'0'},stdio:['ignore','pipe','pipe']});
    let output='';const timer=setTimeout(()=>child.kill('SIGKILL'),90000);const stop=()=>child.kill('SIGKILL');signal?.addEventListener('abort',stop,{once:true});
    for(const stream of [child.stdout,child.stderr])stream.on('data',b=>{output=(output+b).slice(-100000);});
    child.on('error',()=>{clearTimeout(timer);reject(new Error('Git 不可用'));});child.on('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',stop);resolve({code,output:code===0?output:redact(output,token)});});
  });
}
export class Overleaf {
  constructor(store,credentials,{runGit=git}={}){this.store=store;this.credentials=credentials;this.runGit=runGit;this.locks=new Set();}
  async auth(fn){const token=await this.credentials.get();if(!token)fail('尚未配置 Overleaf 凭证','CREDENTIAL_REQUIRED');const dir=await mkdtemp(join(tmpdir(),'dsh-git-auth-'));try{const askpass=join(dir,'askpass');await writeFile(askpass,'#!/bin/sh\ncase "$1" in *sername*) printf "%s" git;; *) printf "%s" "$DSH_OVERLEAF_TOKEN";; esac\n',{mode:0o700});return await fn({token,askpass});}finally{await rm(dir,{recursive:true,force:true});}}
  async clone(name,url){url=overleafURL(url);const dest=join(this.store.directory,'papers',randomUUID());await mkdir(join(this.store.directory,'papers'),{recursive:true});try{
    await this.auth(async auth=>{const r=await this.runGit(['clone','--',url,dest],auth);if(r.code!==0)fail('Overleaf 克隆失败：'+r.output,'GIT_ERROR');});
    const p=await this.store.add({name,path:dest});p.overleaf={remote:'origin',url};const files=await this.store.listFiles(p.id);p.main=files.find(f=>f.name==='main.tex')?.name||files.find(f=>f.name.endsWith('.tex'))?.name||'main.tex';await this.store.persist();return p;
  }catch(e){await rm(dest,{recursive:true,force:true});throw e;}}
  async sync(id,paths){const p=this.store.get(id);if(!p.overleaf)return {status:'local',message:'本地论文'};
    if(p.revisionReview) return {status:'pending',message:'待处理 Agent 修改，暂不推送'};
    if(this.locks.has(id))fail('Overleaf 同步正在进行','BUSY');this.locks.add(id);
    p.syncPaths=[...new Set([...(p.syncPaths||[]),...paths])];
    try{return await this.auth(async auth=>{
      const call=async args=>{const r=await this.runGit(args,{cwd:p.root,...auth});if(r.code!==0)fail(r.output||'Git 操作失败','GIT_ERROR');return r.output.trim();};
      const url=overleafURL(await call(['remote','get-url',p.overleaf.remote]));if(url!==p.overleaf.url)fail('Overleaf 远端与项目绑定不一致');
      const unresolved=await call(['diff','--name-only','--diff-filter=U']);if(unresolved)fail('存在未解决的 Git 冲突：\n'+unresolved,'GIT_CONFLICT');
      await call(['fetch',p.overleaf.remote]);const branch=await call(['symbolic-ref','--short','HEAD']);
      const remote=p.overleaf.remote+'/'+branch;
      const ancestry=await this.runGit(['merge-base','--is-ancestor',remote,'HEAD'],{cwd:p.root,...auth});
      if(ancestry.code!==0){const names=await call(['diff','--name-only','HEAD',remote]);fail('远端有尚未合并的提交，请先合并后重试。涉及文件：\n'+names,'GIT_CONFLICT');}
      const paths=[];
      for(const name of p.syncPaths){
        const exists=await lstat(join(p.root,name)).then(()=>true,()=>false);
        const tracked=await call(['ls-files','--',name]);
        if(exists || tracked)paths.push(name);
      }
      if(paths.length){
        await call(['add','--',...paths]);const changed=await call(['diff','--cached','--name-only','--',...paths]);
        if(changed)await call(['-c','user.name=Paper Workbench','-c','user.email=paper-workbench@localhost','commit','--only','-m','Update paper sources','--',...paths]);
      }
      await call(['push',p.overleaf.remote,'HEAD:refs/heads/'+branch]);
      p.syncPaths=[];p.sync={status:'synced',message:'已同步 Overleaf',time:Date.now()};await this.store.persist();return p.sync;
    });}catch(e){p.sync={status:'error',message:redact(e.message),code:e.code||'GIT_ERROR',time:Date.now()};await this.store.persist();return p.sync;}finally{this.locks.delete(id);}
  }
}
