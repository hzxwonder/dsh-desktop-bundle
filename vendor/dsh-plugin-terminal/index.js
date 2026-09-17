import {readFile} from 'node:fs/promises';
import {defineTool} from '@deepseek-ai/dsh-tools';
import {DEFAULT_REMOTE_CONFIG, RemoteTerminalManager, validateRemoteHost} from './remote.js';
import {assertWorkspace, connectionChoices, workspaceFor} from './workspace.js';

export const name = 'dsh-plugin-terminal';
export const inject = ['tools', 'subprocess', 'sandboxPolicy'];

export {DEFAULT_REMOTE_CONFIG, RemoteTerminalManager} from './remote.js';
export {assertWorkspace, connectionChoices, workspaceFor} from './workspace.js';

/** Actions that never change a running terminal, so read-only Sessions may use them. */
const PANEL_READS = new Set(['workspace', 'connections', 'listTerminals', 'readTerminal']);

function validateConfig(config) {
  const value = config ?? {};
  if (value.hosts !== undefined && (!Array.isArray(value.hosts) || value.hosts.some(host => {
    try { validateRemoteHost(host); return false; } catch { return true; }
  }))) throw new Error('REMOTE_TERMINAL_INVALID_HOST_ALLOWLIST');
  for (const key of ['rows', 'cols', 'maxBytes', 'maxLines', 'idleSilenceMs', 'startupWaitMs', 'timeoutMs', 'graceMs']) {
    if (value[key] !== undefined && (!Number.isSafeInteger(value[key]) || value[key] <= 0)) {
      throw new Error(`REMOTE_TERMINAL_INVALID_${key.toUpperCase()}`);
    }
  }
  return value;
}

function requireAgent(exec) {
  if (!exec.agent) throw new Error('REMOTE_TERMINAL_AGENT_REQUIRED');
  return exec.agent;
}

async function requireApproval(ctx, exec, action, host) {
  const policy = ctx.get('sandboxPolicy')?.resolve(exec.agent ? {session: exec.agent.session} : {});
  if (policy?.mode === 'read-only') throw new Error('REMOTE_TERMINAL_READ_ONLY');
  if (policy?.mode === 'danger-full-access') return;
  const approval = ctx.get('approval');
  if (!approval || !exec.agent) throw new Error('REMOTE_TERMINAL_APPROVAL_REQUIRED');
  const result = await approval.request({
    agent: exec.agent,
    toolName: `remote_terminal_${action}`,
    callId: exec.callId,
    signal: exec.signal,
    reason: `Open or operate an SSH terminal on ${host}`,
  });
  if (result !== 'allowed-once') throw new Error('REMOTE_TERMINAL_APPROVAL_REQUIRED');
}

function registerRemoteTools(ctx, manager) {
  ctx.tools.register(defineTool({
    name: 'remote_terminal_open',
    description: 'Open an owner-isolated persistent terminal on a configured OpenSSH host. The host alias must already work with local OpenSSH and strict host-key checking; passwords and private keys are never accepted as arguments.',
    parameters: {
      host: {type: 'string'},
      connectionId: {type: 'string', description: 'Saved SSH connection. Reuses port, user, identity file, jump host and authentication.'},
      cwd: {type: 'string', description: 'Absolute remote working directory.'},
      name: {type: 'string', description: 'Optional owner-local display name.'},
    },
    output: {schema: {type: 'json'}, render: (_args, value) => [{type: 'text', text: JSON.stringify(value)}]},
    async execute(args, exec) {
      const owner = requireAgent(exec);
      await requireApproval(ctx, exec, 'open', args.host ?? args.connectionId ?? 'session SSH target');
      return manager.open(owner, args, exec.signal);
    },
    presentCall: args => ({card: 'generic', title: `Open remote terminal · ${args.host}`, kind: 'execute'}),
  }));

  ctx.tools.register(defineTool({
    name: 'remote_terminal_send',
    description: 'Send bounded UTF-8 input to an owner-isolated SSH terminal. Enter is submitted by default; readiness is inferred from output silence and does not prove that a remote command exited.',
    parameters: {
      sessionId: {type: 'string', required: true},
      text: {type: 'string', required: true},
      submit: {type: 'boolean'},
    },
    output: {schema: {type: 'json'}, render: (_args, value) => [{type: 'text', text: JSON.stringify(value)}]},
    async execute(args, exec) {
      const owner = requireAgent(exec);
      const record = manager.sessions.get(args.sessionId);
      await requireApproval(ctx, exec, 'send', record?.host ?? 'configured host');
      const operation = manager.send(owner, args.sessionId, args, exec.signal);
      return {kind: 'foreground', ...(await operation.done)};
    },
    presentCall: args => ({card: 'terminal', title: args.text || '(send input)', description: `Remote terminal ${args.sessionId}`}),
  }));

  ctx.tools.register(defineTool({
    name: 'remote_terminal_read',
    description: 'Read a bounded page of retained output from an SSH terminal without sending input.',
    parameters: {
      sessionId: {type: 'string', required: true},
      offset: {type: 'integer'},
      count: {type: 'integer'},
    },
    output: {schema: {type: 'json'}, render: (_args, value) => [{type: 'text', text: JSON.stringify(value)}]},
    execute(args, exec) {
      return manager.read(requireAgent(exec), args.sessionId, args);
    },
    presentCall: args => ({card: 'generic', title: `Read remote terminal ${args.sessionId}`, kind: 'read'}),
  }));

  ctx.tools.register(defineTool({
    name: 'remote_terminal_signal',
    description: 'Deliver one allowed POSIX signal to the foreground process group of an SSH terminal.',
    parameters: {
      sessionId: {type: 'string', required: true},
      signal: {type: 'string', enum: ['SIGINT', 'SIGTERM', 'SIGKILL', 'SIGTSTP', 'SIGHUP'], required: true},
    },
    output: {schema: {type: 'json'}, render: (_args, value) => [{type: 'text', text: JSON.stringify(value)}]},
    async execute(args, exec) {
      const owner = requireAgent(exec);
      const record = manager.sessions.get(args.sessionId);
      await requireApproval(ctx, exec, 'signal', record?.host ?? 'configured host');
      return manager.signal(owner, args.sessionId, args.signal);
    },
    presentCall: args => ({card: 'generic', title: `Signal remote terminal ${args.sessionId}`, kind: 'execute'}),
  }));

  ctx.tools.register(defineTool({
    name: 'remote_terminal_close',
    description: 'Close an SSH terminal and wait for its local ssh process and PTY to terminate.',
    parameters: {sessionId: {type: 'string', required: true}},
    output: {schema: {type: 'json'}, render: (_args, value) => [{type: 'text', text: JSON.stringify(value)}]},
    async execute(args, exec) {
      const owner = requireAgent(exec);
      const record = manager.sessions.get(args.sessionId);
      await requireApproval(ctx, exec, 'close', record?.host ?? 'configured host');
      return manager.close(owner, args.sessionId);
    },
    presentCall: args => ({card: 'generic', title: `Close remote terminal ${args.sessionId}`, kind: 'delete'}),
  }));

  ctx.tools.register(defineTool({
    name: 'remote_terminal_list',
    description: 'List the current agent\'s SSH terminal sessions. Session ids cannot be used by another agent.',
    parameters: {},
    output: {schema: {type: 'json'}, render: (_args, value) => [{type: 'text', text: JSON.stringify(value)}]},
    execute(_args, exec) {
      return manager.list(requireAgent(exec));
    },
    presentCall: () => ({card: 'generic', title: 'List remote terminals', kind: 'read'}),
  }));
}

function readText(value) {
  if (typeof value !== 'string' || value.length > 65536) throw new Error('TERMINAL_INVALID_TEXT');
  return value;
}

function readCursor(value) {
  if (value === undefined) return 0;
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('TERMINAL_INVALID_READ');
  return value;
}

/**
 * The browser panel is Session-owned: its terminals run through the same
 * manager and the same per-owner fence as agent terminals, but the owner token
 * is the Session, so the panel works before any agent exists. One owner per
 * Session keeps every panel surface of that Session on the same terminals.
 */
function panelOwners() {
  const owners = new Map();
  return {
    for(session) {
      let owner = owners.get(session.id);
      if (!owner) {
        owner = {session};
        owners.set(session.id, owner);
      }
      return owner;
    },
    release(session) {
      owners.delete(session.id);
    },
    all() {
      return [...owners.values()];
    },
  };
}

async function runPanelAction(ctx, manager, owners, args, signal) {
  const session = typeof args.sessionId === 'string' ? ctx.sessions?.get(args.sessionId) : undefined;
  if (!session) throw new Error('TERMINAL_SESSION_REQUIRED');
  if (args.action === 'workspace') return workspaceFor(ctx, session);
  if (args.action === 'connections') return {connections: connectionChoices(ctx)};

  const owner = owners.for(session);
  // Reads stay available on a workspace that just changed; mutations are fenced
  // by the key the client last observed and fail closed when read-only.
  let workspace;
  if (!PANEL_READS.has(args.action)) {
    workspace = assertWorkspace(ctx, session, args.workspaceKey);
    if (workspace.readOnly) throw new Error('TERMINAL_READ_ONLY');
  }
  if (args.action === 'listTerminals') return manager.list(owner);
  if (args.action === 'openTerminal') {
    // The connection id and root come from server state, never from the client.
    const opened = workspace.kind === 'ssh'
      ? await manager.open(owner, {connectionId: workspace.connectionId, cwd: workspace.root}, signal)
      : await manager.openLocal(owner, signal);
    try {
      assertWorkspace(ctx, session, args.workspaceKey);
    } catch (error) {
      await manager.close(owner, opened.sessionId);
      throw error;
    }
    return opened;
  }
  if (typeof args.terminalId !== 'string' || args.terminalId.length === 0) throw new Error('TERMINAL_INVALID_SESSION');
  if (args.action === 'readTerminal') return manager.readStream(owner, args.terminalId, readCursor(args.cursor));
  if (args.action === 'writeTerminal') return manager.write(owner, args.terminalId, readText(args.text));
  if (args.action === 'resizeTerminal') {
    if (!Number.isInteger(args.cols) || !Number.isInteger(args.rows)) throw new Error('TERMINAL_INVALID_SIZE');
    return manager.resize(owner, args.terminalId, args.cols, args.rows);
  }
  if (args.action === 'sendTerminal') return manager.send(owner, args.terminalId, {text: readText(args.text), submit: args.submit !== false}, signal).done;
  if (args.action === 'signalTerminal') return manager.signal(owner, args.terminalId, args.signal ?? 'SIGINT');
  if (args.action === 'closeTerminal') return manager.close(owner, args.terminalId);
  throw new Error('TERMINAL_INVALID_ACTION');
}

function errorCode(error) {
  return /^(?:TERMINAL|REMOTE_TERMINAL|SSH)_[A-Z_]+/.exec(String(error?.message))?.[0] ?? 'TERMINAL_REQUEST_FAILED';
}

export function apply(ctx, rawConfig = {}) {
  const config = validateConfig(rawConfig);
  const manager = new RemoteTerminalManager(ctx, {...DEFAULT_REMOTE_CONFIG, ...config});
  const owners = panelOwners();
  ctx.provide?.('terminalWorkbench', manager);
  registerRemoteTools(ctx, manager);
  ctx.inject?.(['connection', 'sessions'], web => {
    // xterm ships as one Host-served asset because the client module system
    // wraps plugin client code verbatim instead of bundling its imports.
    for (const [name, type] of [['panel.js', 'text/javascript'], ['panel.css', 'text/css']]) {
      web.connection.fetch.register({path: `/api/dsh-terminal/${name}`, methods: ['GET'], requestBody: 'buffered', async fetch() {
        const file = name === 'panel.js' ? 'terminal.js' : 'terminal.css';
        return new Response(await readFile(new URL(`./assets/${file}`, import.meta.url)), {headers: {'Content-Type': type, 'Cache-Control': 'no-cache'}});
      }});
    }
    web.connection.fetch.register({path: '/api/dsh-terminal', methods: ['POST'], requestBody: 'buffered', async fetch(request) {
      const headers = {'Cache-Control': 'no-store'};
      try {
        const raw = await request.text();
        if (Buffer.byteLength(raw) > 100000) throw new Error('TERMINAL_INPUT_TOO_LARGE');
        const args = JSON.parse(raw);
        return Response.json(await runPanelAction(web, manager, owners, args, request.signal), {headers});
      } catch (error) {
        const code = errorCode(error);
        // Coded failures keep their stable code; an unexpected failure also
        // carries its message so the panel can show what actually went wrong.
        return Response.json({error: code, detail: String(error?.message ?? error)}, {status: code === 'TERMINAL_WORKSPACE_CHANGED' ? 409 : 400, headers});
      }
    }});
  });
  // Agent disposal is the owner boundary for agent-held terminals. Panel
  // terminals belong to their Session instead, and plugin disposal closes
  // whatever is left.
  ctx.on('agent/disposed', ({agent}) => { void manager.closeOwner(agent).catch(() => {}); });
  ctx.on('session/disposed', session => {
    const owner = owners.all().find(candidate => candidate.session === session);
    if (!owner) return;
    owners.release(session);
    void manager.closeOwner(owner).catch(() => {});
  });
  ctx.effect(() => () => Promise.allSettled([
    ...owners.all().map(owner => manager.closeOwner(owner)),
    manager.dispose(),
  ]));
}
