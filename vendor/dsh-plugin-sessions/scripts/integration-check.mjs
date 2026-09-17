import {spawn} from 'node:child_process';
import {mkdtemp, mkdir, writeFile, symlink, rm, readdir, stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const plugin = fileURLToPath(new URL('../', import.meta.url));
const temporary = await mkdtemp('/private/tmp/dsh-sessions-check-');
const chatRoot = join(temporary, 'plain-sessions');
const demoRoot = join(temporary, 'demo');
const profile = join(temporary, 'profiles/check');
await mkdir(join(profile, 'node_modules'), {recursive:true});
await writeFile(join(profile, 'package.json'), JSON.stringify({name:'session-check',private:true,dependencies:{'dsh-plugin-sessions':`link:${plugin}`},dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app','dsh-plugin-sessions'],patchReload:'startup'}}}));
await writeFile(join(profile, 'cordis.yml'), '[]\n');
await symlink(join(root,'runtime/node_modules/@deepseek-ai'),join(profile,'node_modules/@deepseek-ai'));
await symlink(plugin,join(profile,'node_modules/dsh-plugin-sessions'));
await writeFile(join(profile, 'cordis.patch.yml'), `- id: dsh-plugin-sessions\n  config:\n    plainRoot: ${JSON.stringify(chatRoot)}\n- insert:\n    - id: session-verification-fixture\n      name: ${JSON.stringify(join(plugin,'scripts/fixture.js'))}\n`);
const port = 3397;
let child;
let cookie;
let logs = '';
let exitPromise;
async function start() {
  child = spawn(process.execPath,[join(root,'runtime/node_modules/@deepseek-ai/dsh/lib/bin.js'),'--profile','check','--port',String(port),'--no-open'],{cwd:root,env:{...process.env,DSH_HOME:temporary,DSH_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
  exitPromise = new Promise(resolve => child.once('exit', resolve));
  const url = await new Promise((resolve,reject) => {
    const timeout = setTimeout(()=>reject(new Error('STARTUP_TIMEOUT')),45000);
    let output = '';
    const read = data => {
      output += data;
      logs = output.replace(/token=[^\s\x1b]+/g,'token=[redacted]').slice(-6000);
      const match = new RegExp(`http://(?:localhost|127\\.0\\.0\\.1):${port}/\\?token=[^\\s\\x1b]+`).exec(output);
      if (match) {clearTimeout(timeout);resolve(match[0]);}
    };
    child.stdout.on('data',read);child.stderr.on('data',read);
    child.once('exit',()=>{clearTimeout(timeout);reject(new Error('STARTUP_EXIT'));});
  });
  const auth = await fetch(url,{redirect:'manual'});
  cookie = auth.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
  assert(cookie, 'fixture authentication cookie');
}
async function stop() {if (child && child.exitCode === null) {child.kill('SIGTERM'); await exitPromise;}}
async function call(args, path = '/api/dsh-sessions', ok = true) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(args)});
  const value = await response.json();
  if (ok) assert(response.ok, JSON.stringify(value));
  return value;
}
const fixture = args => call(args,'/api/session-fixture');
const projects = async () => (await fixture({action:'status'})).workspaces;
try {
  await start();
  const chat = await call({action:'chat'});
  assert.deepEqual(chat, {root: chatRoot, workspaceId: chat.workspaceId, title: '对话'});
  assert.equal((await stat(chatRoot)).isDirectory(), true, 'the chat directory is created');
  assert.deepEqual(await call({action:'chat'}), chat, 'provisioning is idempotent');
  const [only] = await projects();
  assert.equal(only.id, chat.workspaceId);
  assert.equal(only.path, chatRoot);
  assert.equal(only.title, '对话');
  const aId = 'session-' + randomUUID();
  assert.equal((await fixture({action:'create',sessionId:aId,workspaceId:chat.workspaceId})).cwd, chatRoot, 'a chat session runs in the chat directory');
  assert.deepEqual((await projects())[0].sessionIds, [aId]);
  await mkdir(demoRoot, {recursive:true});
  const demo = await fixture({action:'addWorkspace',path:demoRoot,title:'demo'});
  assert.equal((await fixture({action:'addWorkspace',path:demoRoot,title:'demo'})).workspace.id, demo.workspace.id, 'workspace registration is path-keyed');
  const evidence = 'REFERENCE_EVIDENCE_' + randomUUID();
  await fixture({action:'prompt',sessionId:aId,text:evidence});
  const {mention} = await call({action:'reference',sessionId:aId,label:'相同名称 [资料]'});
  const bId = 'session-' + randomUUID();
  await fixture({action:'create',sessionId:bId,cwd:demoRoot});
  const target = await fixture({action:'prompt',sessionId:bId,text:'请读取 '+mention});
  assert(target.calls.some(call => call.includes(evidence) && call.includes('session-reference') && call.includes(aId)), 'source content and provenance must reach the actual model adapter input');
  assert(JSON.stringify(target.events).includes('session-reference'),'target must persist reference provenance');
  assert((await call({action:'reference',sessionId:'missing'},undefined,false)).error);
  const fork = await fixture({action:'fork',sessionId:aId});
  assert((await call({action:'reference',sessionId:fork.sessionId})).mention);
  await fixture({action:'archive',sessionId:aId});
  assert((await call({action:'reference',sessionId:aId})).mention);
  await stop();
  await start();
  assert.equal((await call({action:'reference',sessionId:aId})).sessionId,aId);
  assert.deepEqual((await projects()).map(workspace => workspace.id), [demo.workspace.id, chat.workspaceId], 'chat stays last without re-provisioning');
  const cId='session-'+randomUUID();
  await fixture({action:'create',sessionId:cId,workspaceId:chat.workspaceId});
  const cold = await fixture({action:'prompt',sessionId:cId,text:'请读取 '+mention});
  assert(cold.calls.some(call => call.includes(evidence) && call.includes('session-reference') && call.includes(aId)), 'archived cold session content must reach model input after restart');
  assert((await readdir(join(temporary,'sessions'))).length >= 2);
  console.log(JSON.stringify({passed:true,checks:['chat workspace provisioned','chat directory created','idempotent provisioning','chat stays last in workspace order','sessions run in the chat directory','official reference in model input','durable provenance','missing session rejection','fork reference','archived reference','cold read after restart','original log storage']}));
} catch (error) {console.error(logs);throw error;}
finally {await stop();await rm(temporary,{recursive:true,force:true});}
