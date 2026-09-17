import {createHash} from 'node:crypto';

/**
 * Terminal placement follows the Session's workspace: an SSH-bound workspace
 * opens a remote PTY at that root, anything else opens a local PTY at the
 * Session's own working directory. The identity is content-derived so a stale
 * client cannot act on a workspace the Session has already left.
 */

export function workspaceFor(ctx, session) {
  const ssh = ctx.get?.('sshWorkbench');
  if (ssh && typeof ssh.getWorkspaceTarget !== 'function') throw new Error('TERMINAL_SSH_PLUGIN_UPDATE_REQUIRED');
  const target = ssh?.getWorkspaceTarget(session.id) ?? null;
  const connection = target ? ssh.resolve({connectionId: target.connectionId}) : null;
  if (connection && !ssh.allowed(connection)) throw new Error('TERMINAL_HOST_NOT_ALLOWED');
  const root = target?.path ?? session.header?.cwd ?? null;
  // Metadata anchors must never be presented as a usable terminal root.
  if (!target && root && /[/\\]plugin-data[/\\]ssh[/\\]workspaces[/\\]/.test(root)) {
    throw new Error('TERMINAL_REMOTE_WORKSPACE_UNAVAILABLE');
  }
  const kind = target ? 'ssh' : 'local';
  const key = createHash('sha256').update(JSON.stringify([session.id, kind, root, connection ?? null])).digest('hex');
  return {
    key,
    kind,
    root,
    connectionId: connection?.id,
    host: connection?.host,
    label: connection?.name ?? '本机',
    readOnly: ctx.get?.('sandboxPolicy')?.resolve({session})?.mode === 'read-only',
  };
}

export function assertWorkspace(ctx, session, key) {
  const workspace = workspaceFor(ctx, session);
  if (typeof key !== 'string' || workspace.key !== key) throw new Error('TERMINAL_WORKSPACE_CHANGED');
  return workspace;
}

/** Summarize the saved SSH connections the panel may target. */
export function connectionChoices(ctx) {
  const ssh = ctx.get?.('sshWorkbench');
  if (!ssh || typeof ssh.getConnections !== 'function') return [];
  return ssh.getConnections().filter(connection => ssh.allowed?.(connection) ?? true)
    .map(connection => ({id: connection.id, name: connection.name ?? connection.host, host: connection.host}));
}
