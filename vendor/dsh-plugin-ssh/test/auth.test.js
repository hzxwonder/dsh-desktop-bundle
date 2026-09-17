import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {access} from 'node:fs/promises';
import {credentialId, SshPasswords} from '../auth.js';

test('password askpass is request-scoped, one-use and absent from argv and env', async () => {
  const passwords = new SshPasswords(() => undefined);
  const connection = {id: 'fixture', host: 'example.test', authMode: 'password'};
  const canary = 'fixture-password-phrase';
  await passwords.set(connection, canary);
  assert.deepEqual(await passwords.status(connection), {configured: true, remembered: false});
  const auth = await passwords.prepare(connection);
  assert(!JSON.stringify(auth.env).includes(canary));
  const invoke = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [auth.env.SSH_ASKPASS], {env: auth.env});
    let output = '';
    child.stdout.on('data', data => { output += data; });
    child.on('error', reject);
    child.on('close', () => resolve(output));
  });
  try {
    assert.equal(await invoke(), canary + '\n');
    assert.equal(await invoke(), '');
    assert.notEqual(credentialId(connection), credentialId({...connection, host: 'changed.test'}));
    await assert.rejects(passwords.prepare({...connection, host: 'changed.test'}), /SSH_PASSWORD_REQUIRED/);
  } finally { await auth.dispose(); passwords.dispose(); }
  await assert.rejects(access(auth.env.DSH_ASKPASS_SOCKET));
});

test('remembered credentials rotate through the provider and only report status', async () => {
  const records = new Map();
  const provider = {
    modifyRecord: async (id, mutate) => records.set(id, await mutate(records.get(id))),
    describeRecord: async id => ({configured: records.has(id)}),
    deleteRecord: async id => records.delete(id),
  };
  const passwords = new SshPasswords(() => provider);
  const connection = {id: 'fixture', host: 'example.test', authMode: 'password'};
  const status = await passwords.set(connection, 'fixture-one', true);
  assert.deepEqual(status, {configured: true, remembered: true});
  await passwords.set(connection, 'fixture-two', false);
  assert.equal(records.size, 0);
  await passwords.remove(connection);
  assert.equal((await passwords.status(connection)).configured, false);
});
