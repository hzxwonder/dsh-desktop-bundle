import {createHash, randomBytes} from 'node:crypto';
import {createServer} from 'node:net';
import {mkdtemp, chmod, rm} from 'node:fs/promises';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

export function credentialId(connection) {
  const destination = [connection.id, connection.host, connection.user, connection.port, connection.authMode, connection.alias, connection.identityFile, connection.jumpHost];
  return `dsh-plugin-ssh/connection-${createHash('sha256').update(JSON.stringify(destination)).digest('hex')}`;
}

export class SshPasswords {
  constructor(credentials) { this.credentials = credentials; this.temporary = new Map(); }
  async set(connection, value, remember = false) {
    if (typeof value !== 'string' || !value || value.length > 4096 || /[\r\n\0]/.test(value)) throw new Error('SSH_INVALID_PASSWORD');
    const id = credentialId(connection);
    if (remember) {
      if (!this.credentials()) throw new Error('SSH_CREDENTIALS_UNAVAILABLE');
      await this.credentials().modifyRecord(id, async () => ({kind: 'api-key', key: value}));
      this.temporary.delete(id);
    } else {
      await this.credentials()?.deleteRecord(id);
      this.temporary.set(id, value);
    }
    return this.status(connection);
  }
  async status(connection) {
    const id = credentialId(connection);
    if (this.temporary.has(id)) return {configured: true, remembered: false};
    return {configured: Boolean((await this.credentials()?.describeRecord(id))?.configured), remembered: true};
  }
  async remove(connection) {
    const id = credentialId(connection);
    this.temporary.delete(id);
    await this.credentials()?.deleteRecord(id);
  }
  async prepare(connection) {
    if (connection.authMode !== 'password') return {env: undefined, dispose: async () => {}};
    if (process.platform === 'win32') throw new Error('SSH_PASSWORD_REQUIRES_UNIX');
    const id = credentialId(connection);
    const password = this.temporary.get(id) ?? (await this.credentials()?.readRecord(id))?.key;
    if (!password) throw new Error('SSH_PASSWORD_REQUIRED');
    // A request-specific private socket keeps the password out of argv and env.
    const directory = await mkdtemp('/tmp/dsh-askpass-');
    await chmod(directory, 0o700);
    const socketPath = join(directory, 's');
    const nonce = randomBytes(24).toString('hex');
    const clients = new Set();
    let answered = false;
    const server = createServer(socket => {
      clients.add(socket);
      socket.setTimeout(5000, () => socket.destroy());
      socket.on('close', () => clients.delete(socket));
      socket.on('error', () => {});
      let input = '';
      socket.on('data', data => {
        input += data.toString('utf8');
        if (input.length > 256) return socket.destroy();
        if (!input.includes('\n')) return;
        if (answered || input.trim() !== nonce) return socket.destroy();
        answered = true;
        socket.end(password + '\n');
      });
    });
    const dispose = async () => {
      for (const socket of clients) socket.destroy();
      if (server.listening) await new Promise(resolve => server.close(resolve));
      await rm(directory, {recursive: true, force: true});
    };
    try {
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(socketPath, resolve); });
      await chmod(socketPath, 0o600);
      return {env: {SSH_ASKPASS: fileURLToPath(new URL('./askpass.mjs', import.meta.url)), SSH_ASKPASS_REQUIRE: 'force', DISPLAY: ':0', DSH_ASKPASS_SOCKET: socketPath, DSH_ASKPASS_NONCE: nonce}, dispose};
    } catch (error) { await dispose(); throw error; }
  }
  dispose() { this.temporary.clear(); }
}
