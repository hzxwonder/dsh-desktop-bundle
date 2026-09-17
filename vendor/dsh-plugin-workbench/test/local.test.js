import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

test('local supervisor starts, identifies ownership, redacts and stops', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-service-test-'));
  const cliDir = join(root, 'runtime/node_modules/@deepseek-ai/dsh/lib');
  await mkdir(cliDir, {recursive: true});
  await writeFile(join(cliDir, 'bin.js'), "console.log('dsh web: http://127.0.0.1:3099/?token=fixture-only'); setInterval(() => {}, 1000); process.on('SIGTERM', () => process.exit(0));");
  const command = action => promisify(execFile)(process.execPath, [fileURLToPath(new URL('../bin/local.mjs', import.meta.url)), action, '--root', root, '--no-open'], {timeout: 20000});
  try {
    assert.match((await command('start')).stdout, /127.0.0.1:3099/);
    assert.equal(JSON.parse((await command('status')).stdout).running, true);
    assert.match((await command('start')).stdout, /127.0.0.1:3099/);
    await command('stop');
    assert.equal(JSON.parse((await command('status')).stdout).running, false);
    const log = await readFile(join(root, 'run/service.log'), 'utf8');
    assert.match(log, /token=\[redacted\]/);
    assert(!log.includes('fixture-only'));
  } finally {await command('stop'); await rm(root, {recursive: true, force: true});}
});
