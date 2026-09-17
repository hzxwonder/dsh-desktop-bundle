/**
 * Desktop workbench: profile and composition control for the workbench
 * deployment of DSH Desktop.
 *
 * The Web workbench deployment is a composition bundle plus a local service
 * supervisor CLI (`bin/local.mjs`) that starts and stops its own Harness
 * service. Inside DSH Desktop the shell already owns that service and its
 * profile, so the supervisor has no counterpart here. What the desktop end
 * needs instead is the shell's own control surface: read the active profile,
 * see which profiles the launcher can layer itself over, and request one
 * restart-safe switch.
 *
 * The composition itself stays in `dsh-plugin-workbench`, which is host
 * agnostic; this plugin reports whether the active profile carries it and adds
 * no second copy of the same rows.
 */
import {defineTool} from '@deepseek-ai/dsh-tools';
import {compositionStatus, selectableProfile, summarizeProfiles, validateConfig} from './lib/profiles.js';

export const name = 'dsh-desktop-workbench';
export const inject = ['tools', 'commands', 'desktopProfiles'];

export const ACTIONS = Object.freeze(['status', 'list', 'select']);
export const DESKTOP_WORKBENCH_USAGE = [
  'Usage: /desktop-workbench status | list | select <profile>',
  'status        — report the active Desktop profile and its workbench composition (read-only)',
  'list          — list the profiles the launcher can select, with their blockers (read-only)',
  'select <name> — persist one profile and restart DSH Desktop into it',
].join('\n');

const PROFILE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {type: 'string'},
    dir: {type: 'string'},
  },
};

const COMPOSITION_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    package: {type: 'string'},
    declared: {type: 'boolean'},
    declaredSpec: {type: 'string'},
    section: {type: 'string'},
    installedVersion: {type: 'string'},
    bundled: {type: 'boolean'},
  },
};

const SUMMARY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    name: {type: 'string'},
    dir: {type: 'string'},
    exists: {type: 'boolean'},
    webCapable: {type: 'boolean'},
    bundles: {type: 'array', items: {type: 'string'}},
    problem: {type: 'string'},
  },
};

export const DESKTOP_WORKBENCH_OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    action: {type: 'string'},
    profile: PROFILE_SCHEMA,
    composition: COMPOSITION_SCHEMA,
    profiles: {type: 'array', items: SUMMARY_SCHEMA},
    selected: {type: 'string'},
    restartRequired: {type: 'boolean'},
  },
};

/**
 * A switch is a restart, so it needs an explicit decision. A read-only Session
 * never switches; full-access mode and a user-typed command are already
 * explicit; everything else asks the approval service.
 */
async function requireSwitchApproval(ctx, exec, target) {
  const policy = ctx.get?.('sandboxPolicy')?.resolve(exec?.agent ? {session: exec.agent.session} : {});
  if (policy?.mode === 'read-only') throw new Error('DESKTOP_WORKBENCH_READ_ONLY');
  if (policy?.mode === 'danger-full-access' || exec?.agent === undefined) return;
  const approval = ctx.get?.('approval');
  if (approval === undefined) throw new Error('DESKTOP_WORKBENCH_APPROVAL_REQUIRED');
  const outcome = await approval.request({
    agent: exec.agent,
    toolName: 'desktop_workbench',
    ...(exec.callId === undefined ? {} : {callId: exec.callId}),
    ...(exec.signal === undefined ? {} : {signal: exec.signal}),
    reason: `Switch DSH Desktop to profile ${target}`,
  });
  if (outcome !== 'allowed-once') throw new Error('DESKTOP_WORKBENCH_APPROVAL_REQUIRED');
}

export function formatWorkbenchResult(value) {
  const lines = [`profile: ${value.profile.name} (${value.profile.dir})`];
  if (value.composition !== undefined) {
    const state = value.composition.declared
      ? `${value.composition.declaredSpec}${value.composition.installedVersion === undefined ? '' : ` → ${value.composition.installedVersion}`}`
      : 'not declared';
    lines.push(`${value.composition.package}: ${state}${value.composition.bundled ? ' · bundle' : ''}`);
  }
  for (const profile of value.profiles ?? []) {
    const flags = [profile.webCapable ? 'web' : 'not-web', profile.exists ? 'on-disk' : 'missing'];
    if (profile.problem !== undefined) flags.push(profile.problem);
    lines.push(`${profile.name}${profile.name === value.profile.name ? ' (active)' : ''}: ${flags.join(' · ')}`);
  }
  if (value.selected !== undefined) lines.push(`selected: ${value.selected} (restart required)`);
  return lines.join('\n');
}

export function apply(ctx, rawConfig = {}) {
  const config = validateConfig(rawConfig);

  async function runAction(action, args, exec) {
    if (!ACTIONS.includes(action)) throw new Error('DESKTOP_WORKBENCH_INVALID_ACTION');
    const current = ctx.desktopProfiles.current;
    const profile = {name: current.name, dir: current.dir};
    if (action === 'status') {
      return {action, profile, composition: await compositionStatus(current, config.composition)};
    }
    const profiles = summarizeProfiles(ctx.desktopProfiles.list());
    if (action === 'list') return {action, profile, profiles};
    const target = selectableProfile(profiles, args?.profile);
    await requireSwitchApproval(ctx, exec, target.name);
    await ctx.desktopProfiles.select(target.name);
    // `select()` persists the target and requests an orderly restart, so the
    // old generation must not keep assuming the new profile is live.
    return {action, profile, profiles, selected: target.name, restartRequired: true};
  }

  ctx.tools.register(defineTool({
    name: 'desktop_workbench',
    description: 'Report and control the DSH Desktop profile that carries the workbench deployment. '
      + '`status` is read-only and shows the active profile plus whether it declares the workbench composition package; '
      + '`list` is read-only and lists the profiles the launcher can layer itself over, with each blocker; '
      + '`select` persists one profile and restarts DSH Desktop into it, so it needs approval and the answer carries `restartRequired`. '
      + 'The Web workbench keeps its own local service supervisor; that supervisor has no desktop counterpart because the shell owns the service and profile here. '
      + 'Only DSH Desktop provides `desktopProfiles`, so this tool does not exist in an ordinary Web host.',
    parameters: {
      action: {type: 'string', enum: [...ACTIONS], required: true},
      profile: {type: 'string'},
    },
    output: {
      schema: DESKTOP_WORKBENCH_OUTPUT_SCHEMA,
      render: (args, value) => [{type: 'text', text: `${formatWorkbenchResult(value)}\n\n${JSON.stringify(value, null, 2)}`}],
    },
    isConcurrencySafe: args => args.action !== 'select',
    async execute(args, exec) {
      exec.signal?.throwIfAborted?.();
      if (args.action === 'select' && (typeof args.profile !== 'string' || args.profile === '')) {
        throw new Error('DESKTOP_WORKBENCH_PROFILE_REQUIRED');
      }
      return runAction(args.action, args, exec);
    },
    presentCall: args => ({
      card: 'generic',
      title: `Desktop workbench ${args.action}${args.action === 'select' && args.profile ? ` · ${args.profile}` : ''}`,
      kind: args.action === 'select' ? 'execute' : 'read',
    }),
  }));

  ctx.commands.register({
    name: 'desktop-workbench',
    description: 'Report or switch the DSH Desktop profile behind the workbench deployment',
    input: {hint: 'status | list | select <profile>'},
    async handler(invocation) {
      const words = (invocation?.rawInput ?? '').trim().split(/\s+/).filter(word => word !== '');
      const action = (words[0] ?? 'status').toLowerCase();
      if (action === 'help') return {kind: 'success', text: DESKTOP_WORKBENCH_USAGE};
      if (!ACTIONS.includes(action)) return {kind: 'error', text: DESKTOP_WORKBENCH_USAGE};
      const profile = words[1];
      if (action === 'select' && profile === undefined) return {kind: 'error', text: DESKTOP_WORKBENCH_USAGE};
      if (action === 'select' && words.length > 2) return {kind: 'error', text: DESKTOP_WORKBENCH_USAGE};
      try {
        const value = await runAction(action, {profile}, invocation);
        return {kind: 'success', text: `${formatWorkbenchResult(value)}\n\n${JSON.stringify(value, null, 2)}`};
      } catch (error) {
        if (invocation?.signal?.aborted) throw error;
        return {kind: 'error', text: `Desktop workbench ${action} failed: ${error?.message ?? error}`};
      }
    },
  });
}
