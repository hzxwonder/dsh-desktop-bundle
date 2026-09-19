import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadPaperInstructions, PAPER_AGENTS } from '../lib/paper-prompt.js';

test('internal instructions persist and archive only matching project templates', async t => {
  const root = await mkdtemp(join(tmpdir(), 'paper-instructions-'));
  t.after(() => rm(root, {recursive:true, force:true}));
  const data = join(root,'data'), paper = join(root,'paper'), custom = join(root,'custom');
  await mkdir(paper); await mkdir(custom);
  await writeFile(join(paper,'AGENTS.md'), PAPER_AGENTS+'\n');
  await writeFile(join(custom,'AGENTS.md'), '# Personal rules\n');
  assert.match(await loadPaperInstructions(data,[{id:'demo',root:paper},{id:'custom',root:custom}]), /Overleaf/);
  await assert.rejects(readFile(join(paper,'AGENTS.md')), {code:'ENOENT'});
  assert.equal(await readFile(join(data,'instructions/project-template-backups/demo/AGENTS.md'),'utf8'), PAPER_AGENTS+'\n');
  assert.equal(await readFile(join(custom,'AGENTS.md'),'utf8'), '# Personal rules\n');
  const internal = join(data,'instructions/AGENTS.md');
  await writeFile(internal,'# Managed workbench rules\n');
  assert.equal(await loadPaperInstructions(data),'# Managed workbench rules\n');
  await rm(internal); await symlink(join(custom,'AGENTS.md'),internal);
  await assert.rejects(loadPaperInstructions(data),/内部指令文件无效/);
});
