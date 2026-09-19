import {spawn} from 'node:child_process';
const service='dsh-latex-overleaf';
const quote = s => '"'+s.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"';
function security(args,input) {
  return new Promise((resolve,reject)=>{
    const p=spawn('/usr/bin/security',args,{stdio:['pipe','pipe','pipe']});let out='';
    p.stdout.on('data',b=>out+=b);p.stderr.resume();p.on('error',()=>reject(new Error('系统钥匙串不可用')));
    p.on('close',code=>code===0?resolve(out.trim()):reject(new Error('无法访问 Overleaf 系统凭证')));p.stdin.end(input);
  });
}
export class Credentials {
  async get(){if(process.platform!=='darwin')return null;try{return await security(['find-generic-password','-s',service,'-a','global','-w']);}catch{return null;}}
  async status(){return {configured:!!await this.get(),storage:'macOS Keychain',available:process.platform==='darwin'};}
  async set(token){
    if(process.platform!=='darwin')throw new Error('此平台暂未接入系统凭证存储');
    if(typeof token!=='string'|| !/^olp_[A-Za-z0-9]{10,200}$/.test(token))throw new Error('请输入有效的 Overleaf Git token');
    // Interactive stdin keeps the secret out of process arguments and files.
    await security(['-i'],`add-generic-password -U -s ${service} -a global -w ${quote(token)}\n`);
    if(await this.get()!==token)throw new Error('凭证保存失败，请检查系统钥匙串权限');
    return this.status();
  }
  async remove(){await security(['delete-generic-password','-s',service,'-a','global']).catch(()=>{});return this.status();}
}
