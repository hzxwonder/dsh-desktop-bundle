import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowHistory} from '../client/history.js';
test('history retains original used session ids and excludes unused bindings',()=>{
 const ids=['empty','messages','execution','archived','missing','other'];
 const data={references:ids.map(sessionId=>({sessionId,workflowId:sessionId==='other'?'other':'paper'})),runs:[{sessionId:'execution',workflowId:'paper'}]};
 const sessions={byId:{empty:{blank:true},messages:{blank:false},execution:{blank:true},archived:{blank:false},other:{blank:false}}};
 assert.deepEqual(workflowHistory(data,sessions,['archived'],'paper').map(r=>r.sessionId),['messages','execution']);
});

test('history remains available outside the recent run window', () => {
 assert.equal(workflowHistory({references:[{sessionId:'old',workflowId:'paper',hasHistory:true}],runs:[]},{byId:{old:{blank:true}}},[],'paper')[0].sessionId,'old');
});
