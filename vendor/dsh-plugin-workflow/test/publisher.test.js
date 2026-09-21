import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {publishHalo} from '../lib/publisher.js';

test('publisher rejects changed update targets and insufficient reviews before connecting',async t=>{
 const dir=await mkdtemp('/private/tmp/workflow-publication-');t.after(()=>rm(dir,{recursive:true,force:true}));
 const path=join(dir,'destination.json');await writeFile(path,JSON.stringify({sshHost:'example.invalid',helper:'/opt/site/publish.py'}));
 const input={article:{title:'Paper',slug:'new-paper',text:'Reader article'},review:{score:90},request:{publication:{slug:'existing-paper',postId:'post-original'}}};
 await assert.rejects(publishHalo(input,path),{code:'PUBLISH_TARGET_MISMATCH'});
 input.article.slug='existing-paper';input.review.score=84;
 await assert.rejects(publishHalo(input,path),{code:'PUBLISH_REVIEW_REQUIRED'});
 input.review.score=90;input.request.publication.postId='../post';
 await assert.rejects(publishHalo(input,path),{code:'PUBLISH_TARGET_INVALID'});
});
