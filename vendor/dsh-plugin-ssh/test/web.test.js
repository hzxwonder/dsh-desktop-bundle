import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {apply,discoverConnections,importConnections} from '../index.js';
import {installSshWeb} from '../web.js';

test('discovery does not write and selected import preserves existing connection settings', async () => {
  const root=await mkdtemp('/private/tmp/dsh-ssh-import-test-');
  try {
    const config={sshConfigPath:join(root,'config')};
    await writeFile(config.sshConfigPath,'Host dev stage\nHost * !skip\n');
    let saved=[{...(await discoverConnections(config))[0],name:'Custom name'}];
    const state={getConnections:()=>saved,saveConnections:async next=>{saved=next;return {connections:next,persisted:true};}};
    assert.deepEqual((await discoverConnections(config)).map(c=>c.host),['dev','stage']);
    assert.equal(saved.length,1);
    await importConnections(state,config,['dev']);
    assert.equal(saved[0].name,'Custom name');
    assert.equal(saved.length,1);
    await importConnections(state,config,['stage']);
    assert.equal(saved.length,2);
    await assert.rejects(importConnections(state,config,['unknown']),/INVALID_IMPORT_SELECTION/);
    assert.deepEqual(await discoverConnections({sshConfigPath:join(root,'missing')}),[]);
    assert.equal((await discoverConnections({...config,hosts:['stage']})).length,1);
  } finally {await rm(root,{recursive:true,force:true});}
});

test('Web discovery, selected import and directory browsing keep read-only and session boundaries',async()=>{
  let handler,mode='read-only',last;
  const service={
    discover:async()=>({connections:[{id:'dev',host:'dev'}]}),
    import:async hosts=>({hosts}),
    run:async args=>{last=args;return {path:'/home/demo',entries:[{name:'file',kind:'file'},{name:'link',kind:'symlink'},{name:'project',kind:'directory'}]};},
    prepareWorkspace:async()=>({localPath:'/tmp/fixture'}),
  };
  const web={connection:{fetch:{register:value=>handler=value.fetch}},sessions:{get:id=>id==='valid'?{id}:null},get:()=>({resolve:()=>({mode})})};
  installSshWeb({inject:(_,callback)=>callback(web)},service);
  const call=async body=>{const r=await handler(new Request('http://local/api/dsh-ssh',{method:'POST',body:JSON.stringify(body)}));return {status:r.status,value:await r.json()};};
  assert.equal((await call({action:'discover'})).status,200);
  assert.equal((await call({action:'import',hosts:['dev']})).value.error,'SSH_READ_ONLY');
  assert.equal((await call({action:'prepareWorkspace'})).value.error,'SSH_READ_ONLY');
  assert.equal((await call({action:'browse',sessionId:'missing'})).value.error,'SSH_SESSION_REQUIRED');
  const listing=await call({action:'browse',connectionId:'dev',path:'~'});
  assert.deepEqual(listing.value.entries,[{name:'project',kind:'directory'}]);
  assert.equal(last.root,'~');assert.equal(last.path,'.');
  mode='workspace-write';
  assert.deepEqual((await call({action:'import',hosts:['dev']})).value,{hosts:['dev']});
});

test('remote workspaces retain independent mappings, inherit targets and honor explicit detach',async()=>{
  const root=await mkdtemp('/private/tmp/dsh-ssh-workspace-test-');
  try {
    let service,current;
    const sessions=new Map();
    const settings={
      installSection(_ctx,_namespace,_schema,base,options) {
        current=structuredClone(base);
        options.setSource(()=>current);
      },
      async mutate(_namespace,operations) {
        await new Promise(resolve=>setTimeout(resolve,1));
        for(const op of operations) current={...current,[op.path[0]]:op.value};
      },
    };
    apply({
      tools:{register(){}},commands:{register(){}},
      provide(name,value){if(name==='sshWorkbench')service=value;},
      inject(deps,callback){if(deps.includes('settings'))callback({settings});},
      get(name){if(name==='sessions')return {get:id=>sessions.get(id)};},
    },{dshHome:root,connections:[{id:'dev',name:'Dev',host:'fixture-dev',directory:'~'}]});
    service.run=async args=>({path:args.root});
    const [first,second]=await Promise.all([
      service.prepareWorkspace({connectionId:'dev',root:'/srv/first'},{}),
      service.prepareWorkspace({connectionId:'dev',root:'/srv/second'},{}),
    ]);
    assert.equal(first.localPath,await realpath(first.localPath));
    assert.notEqual(first.localPath,second.localPath);
    assert.equal(current.workspaces.length,2);
    sessions.set('new',{header:{cwd:first.localPath}});
    assert.equal(service.getTarget('new').path,'/srv/first');
    assert.equal(service.getTarget(undefined),null);
    await service.saveTarget('new',null);
    assert.equal(service.getTarget('new'),null);
    sessions.set('sibling',{header:{cwd:first.localPath}});
    assert.equal(service.getTarget('sibling').path,'/srv/first');
    await service.saveTarget('new',{connectionId:'dev',path:'/srv/override'});
    assert.equal(service.getTarget('new').path,'/srv/override');
    await service.saveConnections(service.getConnections().map(item=>({...item,name:'Renamed'})));
    assert.equal(current.workspaces.length,2);
    assert.equal(service.getTarget('sibling').path,'/srv/first');
    await service.saveConnections([]);
    assert.equal(service.getTarget('new'),null);
    assert.equal(service.getTarget('sibling'),null);
  } finally {await rm(root,{recursive:true,force:true});}
});
