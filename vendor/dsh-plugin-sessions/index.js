import {homedir} from 'node:os';
import {join, resolve} from 'node:path';
import {mkdir, realpath} from 'node:fs/promises';
import {sessionReference} from './reference.js';

export const name = 'dsh-plugin-sessions';
export const inject = ['connection', 'sessionController', 'sessionReferenceResolver', 'workspaceRegistry'];
const defaultTitle = '对话';

/**
 * Chat directory used when the configuration names no explicit `plainRoot`.
 * The Harness home decides it, so a Web host and a Desktop host each keep their
 * own chat files; `~/.dsh` stays the historical fallback for a host that
 * exports no DSH_HOME.
 */
export function defaultPlainRoot(env = process.env) {
  const home = typeof env?.DSH_HOME === 'string' && env.DSH_HOME.trim() !== '' ? env.DSH_HOME : join(homedir(), '.dsh');
  return join(home, 'plain-sessions');
}

export function createChatService(ctx, config = {}) {
  const root = resolve(config.plainRoot ?? defaultPlainRoot());
  const title = typeof config.title === 'string' && config.title.trim() !== '' ? config.title.trim() : defaultTitle;
  // The Chat workspace is an ordinary Workspace rooted at the chat directory: sessions
  // created inside it are owned by the registry and reachable from the workspace
  // sidebar, while their files stay outside every source tree.
  async function ensure() {
    await mkdir(root, {recursive: true, mode: 0o700});
    const canonical = await realpath(root);
    const registry = ctx.workspaceRegistry;
    const existing = registry.list().find(item => item.path === canonical);
    if (existing !== undefined) return {root: canonical, workspaceId: existing.id, title: existing.title};
    const created = await registry.create(canonical, title);
    // Registration prepends; the chat group belongs after every source workspace.
    await registry.insertBefore(created.id);
    return {root: canonical, workspaceId: created.id, title: created.title};
  }
  async function reference(sessionId, label, signal) {
    if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 4096) throw new Error('SESSION_REFERENCE_INVALID_ID');
    // Inspect cold/archived/forked sessions through the authoritative service, never title matching.
    await ctx.sessionController.inspect(sessionId, signal);
    return {sessionId, mention: sessionReference(sessionId, typeof label === 'string' ? label.slice(0, 512) : sessionId)};
  }
  return {root, title, ensure, reference};
}

export function apply(ctx, config = {}) {
  const service = createChatService(ctx, config);
  // Provision at startup so the chat group is present before the first page load.
  void service.ensure().catch(error => ctx.logger?.warn?.(`chat workspace unavailable: ${error?.message ?? error}`));
  ctx.connection.fetch.register({
    path: '/api/dsh-sessions', methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      const headers = {'Cache-Control': 'no-store'};
      try {
        const raw = await request.text();
        if (Buffer.byteLength(raw) > 16384) throw new Error('SESSION_REQUEST_TOO_LARGE');
        const args = JSON.parse(raw);
        let result;
        if (args.action === 'chat') result = await service.ensure();
        else if (args.action === 'reference') result = await service.reference(args.sessionId, args.label, request.signal);
        else throw new Error('SESSION_INVALID_ACTION');
        return Response.json(result, {headers});
      } catch (error) {
        const code = /^(?:SESSION|WORKSPACE)_[A-Z_]+$/.test(error.message) ? error.message : 'SESSION_REQUEST_FAILED';
        return Response.json({error: code}, {status: 400, headers});
      }
    }
  });
}
