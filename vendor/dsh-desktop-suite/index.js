/**
 * Desktop suite: the DSH Desktop counterpart of `dsh-plugin-suite`.
 *
 * The Web suite is a CLI that prepares a profile manifest and runs pnpm
 * directly. Inside DSH Desktop that work belongs to the shell: the packaged
 * `dsh plugin` CLI runs against the active Profile through `desktopPnpm`, and
 * `desktopProfiles` is the only authority for which profile that is. This
 * plugin therefore performs no manifest editing of its own — it reads the
 * active profile, plans one bounded operation, and reports what changed.
 *
 * It is a Desktop-only row: both services are required, so the plugin stays
 * pending in an ordinary `dsh web` host instead of half-working there. The Web
 * deployment keeps using the `dsh-plugin-suite` CLI for the same plugin set.
 */
import {defineTool} from '@deepseek-ai/dsh-tools';
import {actionArgv, profileInventory, validateConfig} from './lib/inventory.js';
import {DesktopPackageOperations} from './lib/operation.js';

export const name = 'dsh-desktop-suite';
export const inject = ['tools', 'commands', 'desktopProfiles', 'desktopPnpm'];

export const ACTIONS = Object.freeze(['status', 'install', 'update']);
export const DESKTOP_SUITE_USAGE = [
  'Usage: /desktop-suite status | install | update',
  'status  — report the maintained plugins in the active Desktop profile (read-only)',
  'install — add the maintained plugins the active profile does not declare yet',
  'update  — re-resolve the maintained plugins the active profile already declares',
].join('\n');

const PROFILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {type: 'string'},
    dir: {type: 'string'},
  },
};

const MEMBER_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {type: 'string'},
    spec: {type: 'string'},
    declared: {type: 'boolean'},
    declaredSpec: {type: 'string'},
    section: {type: 'string'},
    installedVersion: {type: 'string'},
    bundled: {type: 'boolean'},
  },
};

const INVENTORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    profile: PROFILE_SCHEMA,
    bundles: {type: 'array', items: {type: 'string'}},
    members: {type: 'array', items: MEMBER_SCHEMA},
  },
};

const OUTCOME_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    argv: {type: 'array', items: {type: 'string'}},
    exitCode: {type: 'integer'},
    signal: {type: 'string'},
    ok: {type: 'boolean'},
    timedOut: {type: 'boolean'},
    aborted: {type: 'boolean'},
    truncated: {type: 'boolean'},
    stdoutBytes: {type: 'integer'},
    stderrBytes: {type: 'integer'},
    stdout: {type: 'string'},
    stderr: {type: 'string'},
  },
};

export const DESKTOP_SUITE_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: {type: 'string'},
    profile: PROFILE_SCHEMA,
    bundles: {type: 'array', items: {type: 'string'}},
    members: {type: 'array', items: MEMBER_SCHEMA},
    argv: {type: 'array', items: {type: 'string'}},
    busy: {type: 'boolean'},
    skipped: {type: 'boolean'},
    outcome: OUTCOME_SCHEMA,
    verified: INVENTORY_SCHEMA,
  },
};

/**
 * Package mutations need an explicit human decision. A read-only Session can
 * never mutate the profile; a full-access Session and a user-typed command are
 * already explicit; everything else asks the approval service.
 */
async function requireMutationApproval(ctx, exec, action) {
  const policy = ctx.get?.('sandboxPolicy')?.resolve(exec?.agent ? {session: exec.agent.session} : {});
  if (policy?.mode === 'read-only') throw new Error('DESKTOP_SUITE_READ_ONLY');
  if (policy?.mode === 'danger-full-access' || exec?.agent === undefined) return;
  const approval = ctx.get?.('approval');
  if (approval === undefined) throw new Error('DESKTOP_SUITE_APPROVAL_REQUIRED');
  const outcome = await approval.request({
    agent: exec.agent,
    toolName: 'desktop_suite',
    ...(exec.callId === undefined ? {} : {callId: exec.callId}),
    ...(exec.signal === undefined ? {} : {signal: exec.signal}),
    reason: `${action} maintained plugins in Desktop profile ${ctx.desktopProfiles.current.name}`,
  });
  if (outcome !== 'allowed-once') throw new Error('DESKTOP_SUITE_APPROVAL_REQUIRED');
}

/** Short human summary; the JSON payload stays the authoritative result. */
export function formatSuiteResult(value) {
  const lines = [`profile: ${value.profile.name} (${value.profile.dir})`];
  for (const member of value.members ?? value.verified?.members ?? []) {
    const state = member.declared
      ? `${member.declaredSpec}${member.installedVersion === undefined ? '' : ` → ${member.installedVersion}`}`
      : 'not declared';
    lines.push(`${member.name}: ${state}${member.bundled ? ' · bundle' : ''}`);
  }
  if (value.skipped === true) lines.push(`${value.action}: nothing to do`);
  if (value.outcome !== undefined) {
    const {exitCode, signal, ok} = value.outcome;
    lines.push(`${value.action}: exit=${String(exitCode ?? 'null')} signal=${String(signal ?? 'null')} ok=${String(ok)}`);
  }
  return lines.join('\n');
}

export function apply(ctx, rawConfig = {}) {
  const config = validateConfig(rawConfig);
  const operations = new DesktopPackageOperations(ctx, {timeoutMs: config.timeoutMs, maxOutputChars: config.maxOutputChars});
  ctx.effect(() => () => operations.dispose(), 'dsh-desktop-suite: active package operation teardown');

  const inventory = () => profileInventory(ctx.desktopProfiles.current, config);

  async function runAction(action, exec) {
    if (!ACTIONS.includes(action)) throw new Error('DESKTOP_SUITE_INVALID_ACTION');
    if (action === 'status') {
      const current = await inventory();
      return {
        action,
        ...current,
        busy: operations.busy,
        ...(operations.lastOutcome === undefined ? {} : {outcome: operations.lastOutcome}),
      };
    }
    await requireMutationApproval(ctx, exec, action);
    const current = await inventory();
    const argv = actionArgv(action, current);
    if (argv === undefined) return {action, profile: current.profile, argv: [], skipped: true, busy: operations.busy};
    const outcome = await operations.runPlugin(argv, {
      invokingDir: current.profile.dir,
      ...(exec?.signal === undefined ? {} : {signal: exec.signal}),
    });
    const verified = await inventory();
    return {action, profile: verified.profile, argv, busy: operations.busy, outcome, verified};
  }

  ctx.tools.register(defineTool({
    name: 'desktop_suite',
    description: 'Manage the maintained DeepSeek Harness plugin set inside the active DSH Desktop profile. '
      + '`status` is read-only and reports each member\'s declared spec, installed version, and bundle layer. '
      + '`install` adds the members the profile does not declare yet, and `update` re-resolves the ones it does; both run the packaged `dsh plugin` CLI through the Desktop package service, '
      + 'which owns the profile manifest and bundle reconciliation. A mutation needs approval, only configured member packages can be named, and the profile always comes from `desktopProfiles.current`. '
      + 'Only DSH Desktop provides those services, so this tool does not exist in an ordinary Web host.',
    parameters: {action: {type: 'string', enum: [...ACTIONS], required: true}},
    output: {
      schema: DESKTOP_SUITE_OUTPUT_SCHEMA,
      render: (args, value) => [{type: 'text', text: `${formatSuiteResult(value)}\n\n${JSON.stringify(value, null, 2)}`}],
    },
    isConcurrencySafe: args => args.action === 'status',
    async execute(args, exec) {
      exec.signal?.throwIfAborted?.();
      return runAction(args.action, exec);
    },
    presentCall: args => ({
      card: 'generic',
      title: `Desktop suite ${args.action}`,
      kind: args.action === 'status' ? 'read' : 'execute',
    }),
  }));

  ctx.commands.register({
    name: 'desktop-suite',
    description: 'Inspect or manage the maintained plugins in the active DSH Desktop profile',
    input: {hint: 'status | install | update'},
    async handler(invocation) {
      const action = (invocation?.rawInput ?? '').trim().toLowerCase() || 'status';
      if (action === 'help') return {kind: 'success', text: DESKTOP_SUITE_USAGE};
      if (!ACTIONS.includes(action)) return {kind: 'error', text: DESKTOP_SUITE_USAGE};
      try {
        const value = await runAction(action, invocation);
        return {kind: 'success', text: `${formatSuiteResult(value)}\n\n${JSON.stringify(value, null, 2)}`};
      } catch (error) {
        if (invocation?.signal?.aborted) throw error;
        return {kind: 'error', text: `Desktop suite ${action} failed: ${error?.message ?? error}`};
      }
    },
  });
}
