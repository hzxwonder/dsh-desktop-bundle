import {assertWorkspace, localFiles, relativePath, workspaceFor} from './workspace.js';

export const name = 'dsh-plugin-sidebar';
export const inject = ['connection', 'sessions', 'fs'];

export function apply(ctx) {
  ctx.connection.fetch.register({path: '/api/dsh-sidebar', methods: ['POST'], requestBody: 'buffered', async fetch(request) {
    const headers = {'Cache-Control': 'no-store'};
    try {
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 100000) throw new Error('SIDEBAR_REQUEST_TOO_LARGE');
      const args = JSON.parse(raw);
      const session = typeof args.sessionId === 'string' && ctx.sessions.get(args.sessionId);
      if (!session) throw new Error('SIDEBAR_SESSION_REQUIRED');
      if (args.action === 'workspace') return Response.json(workspaceFor(ctx, session), {headers});
      const workspace = assertWorkspace(ctx, session, args.workspaceKey);
      if (args.action !== 'list' && args.action !== 'read') throw new Error('SIDEBAR_INVALID_ACTION');
      const path = relativePath(args.path);
      const result = workspace.kind === 'ssh'
        ? await ctx.get('sshWorkbench').run({action: args.action, preview: args.action === 'read', connectionId: workspace.connectionId, root: workspace.root, path}, {signal: request.signal, agent: {session}})
        : await localFiles(ctx.fs, workspace, args.action, path, request.signal);
      assertWorkspace(ctx, session, workspace.key);
      return Response.json(result, {headers});
    } catch (error) {
      const code = /^(?:SIDEBAR|SSH|FS)_[A-Z_]+/.exec(String(error.message))?.[0] ?? 'SIDEBAR_REQUEST_FAILED';
      return Response.json({error: code}, {status: code === 'SIDEBAR_WORKSPACE_CHANGED' ? 409 : 400, headers});
    }
  }});
}
