import {createHash} from 'node:crypto';
import {isAbsolute, relative, sep} from 'node:path';

export function workspaceFor(ctx, session) {
  const ssh = ctx.get('sshWorkbench');
  if (ssh && typeof ssh.getWorkspaceTarget !== 'function') throw new Error('SIDEBAR_SSH_PLUGIN_UPDATE_REQUIRED');
  const target = ssh?.getWorkspaceTarget(session.id) ?? null;
  const connection = target ? ssh.resolve({connectionId: target.connectionId}) : null;
  if (connection && !ssh.allowed(connection)) throw new Error('SSH_HOST_NOT_ALLOWED');
  const root = target?.path ?? session.header.cwd ?? null;
  // Metadata anchors must never be presented as local source trees.
  if (!target && root && /[/\\]plugin-data[/\\]ssh[/\\]workspaces[/\\]/.test(root)) {
    throw new Error('SIDEBAR_REMOTE_WORKSPACE_UNAVAILABLE');
  }
  const kind = target ? 'ssh' : 'local';
  const key = createHash('sha256').update(JSON.stringify([session.id, kind, root, connection])).digest('hex');
  return {key, kind, root, connectionId: connection?.id, host: connection?.host,
    label: connection?.name ?? '本机',
    readOnly: ctx.get('sandboxPolicy')?.resolve({session})?.mode === 'read-only'};
}

export function assertWorkspace(ctx, session, key) {
  const workspace = workspaceFor(ctx, session);
  if (typeof key !== 'string' || workspace.key !== key) throw new Error('SIDEBAR_WORKSPACE_CHANGED');
  return workspace;
}

export function relativePath(value = '.') {
  if (typeof value !== 'string' || value.length > 4096 || value.includes('\0') || value.includes('\\') || isAbsolute(value)
    || value.split('/').includes('..')) throw new Error('SIDEBAR_INVALID_PATH');
  return value || '.';
}

export function assertContained(root, path) {
  const child = relative(root, path);
  if (child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child)) throw new Error('SIDEBAR_PATH_OUTSIDE_WORKSPACE');
}

export async function localFiles(fs, workspace, action, path, signal) {
  if (!workspace.root) throw new Error('SIDEBAR_WORKSPACE_REQUIRED');
  const root = await fs.resolve(workspace.root, {signal});
  const target = await fs.resolve(relativePath(path), {cwd: workspace.root, signal});
  assertContained(await fs.processPath(root, signal), await fs.processPath(target, signal));
  if (action === 'list') {
    const entries = await fs.listDir(target, signal);
    return {entries: entries.slice(0, 2000).map(({name, type}) => ({name, kind: type})), truncated: entries.length > 2000};
  }
  const bytes = await fs.readBytes(target, signal, 65536);
  if (bytes.includes(0)) throw new Error('SIDEBAR_BINARY_FILE');
  try { return {content: new TextDecoder('utf-8', {fatal: true}).decode(bytes)}; }
  catch { throw new Error('SIDEBAR_BINARY_FILE'); }
}
