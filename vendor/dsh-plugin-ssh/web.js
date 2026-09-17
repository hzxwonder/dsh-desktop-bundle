import {mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';

function indexPath(session, connectionId) {
  const cwd = session?.header?.cwd;
  if (typeof cwd !== 'string' || !cwd.startsWith('/') || cwd.includes('\0')) return null;
  const safe = String(connectionId ?? 'unknown').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0,80) || 'unknown';
  return join(cwd, '.dsh', 'ssh-index', `${safe}.json`);
}

async function writeRemoteIndex(session, args, listed, visibleEntries) {
  const file = indexPath(session, args.connectionId);
  if (!file) return null;
  const payload = {version:1, connectionId:args.connectionId, root:listed.path, updatedAt:new Date().toISOString(), entries:visibleEntries.map(item => ({name:item.name, kind:item.kind, size:item.size ?? null, mtime:item.mtime ?? item.modifiedAt ?? null, revision:item.revision ?? null}))};
  try { await mkdir(join(file, '..'), {recursive:true, mode:0o700}); await writeFile(file, JSON.stringify(payload, null, 2)+'\n', {mode:0o600}); return file; } catch { return null; }
}

export function installSshWeb(ctx, service) {
  ctx.inject?.(['connection', 'sessions'], web => {
    web.connection.fetch.register({
      path: '/api/dsh-ssh', methods: ['POST'], requestBody: 'buffered',
      async fetch(request) {
        const headers = {'Cache-Control': 'no-store'};
        try {
          const raw = await request.text();
          if (Buffer.byteLength(raw) > 100000) throw new Error('SSH_REQUEST_TOO_LARGE');
          const args = JSON.parse(raw);
          const session = args.sessionId ? web.sessions.get(args.sessionId) : undefined;
          if (args.sessionId && !session) throw new Error('SSH_SESSION_REQUIRED');
          const policy = web.get('sandboxPolicy')?.resolve(session ? {session} : {});
          if (policy?.mode === 'read-only' && !['status', 'discover', 'browse', 'passwordStatus', 'list', 'read', 'probe'].includes(args.action)) throw new Error('SSH_READ_ONLY');
          const exec = {signal: request.signal, agent: session ? {session} : undefined};
          let result;
          if (args.action === 'status') {
            result = {connections: service.getConnections(), target: service.getTarget(args.sessionId), projects: service.projects()};
          } else if (args.action === 'discover') result = await service.discover();
          else if (args.action === 'import') result = await service.import(args.hosts);
          else if (args.action === 'browse') {
            const listed = await service.run({...args, action:'list', root:args.path ?? '~', path:'.'}, exec);
            const entries=listed.entries.filter(item => item.kind === 'directory').sort((a,b) => a.name.localeCompare(b.name));
            result = {...listed, entries, indexPath: await writeRemoteIndex(session, args, listed, entries)};
          }
          else if (args.action === 'prepareWorkspace') result = await service.prepareWorkspace(args, exec);
          else if (args.action === 'password') {
            const connection = service.resolve(args);
            result = await service.passwords.set(connection, args.password, args.remember === true);
          } else if (args.action === 'passwordStatus') result = await service.passwords.status(service.resolve(args));
          else if (args.action === 'clearPassword') { await service.passwords.remove(service.resolve(args)); result = {configured: false}; }
          else if (args.action === 'clearTarget') { await service.saveTarget(args.sessionId, null); result = {target: null}; }
          else if (args.action === 'setTarget') {
            const connection = service.resolve(args);
            const probe = await service.run({...args, action: 'connect'}, exec);
            result = {target: {connectionId: connection.id, path: probe.path}};
            await service.saveTarget(args.sessionId, result.target);
          } else if (['probe', 'list', 'read', 'write'].includes(args.action)) result = await service.run(args, exec);
          else throw new Error('SSH_INVALID_ACTION');
          return Response.json(result, {headers});
        } catch (error) {
          const code = /^SSH_[A-Z_]+/.exec(String(error.message))?.[0] ?? 'SSH_REQUEST_FAILED';
          return Response.json({error: code}, {status: 400, headers});
        }
      },
    });
  });
}
