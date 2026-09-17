import {readFile, writeFile} from 'node:fs/promises';
import {resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const marker = '// dsh-plugin-sessions workspace adapter v2';
const previousMarker = '// dsh-plugin-sessions workspace adapter v1';
// DSH Desktop resolves a Profile-local package ahead of its own copy when the
// Profile copy carries a higher version, so the same upstream build is also
// adapted under the overlay version.
const upstreamVersions = ['0.1.5-rc.2', '0.1.5-rc.3'];
const hash = value => createHash('sha256').update(value).digest('hex');
const once = (source, before, after) => {
  if (source.split(before).length !== 2) throw new Error('WORKSPACE_ADAPTER_INCOMPATIBLE: expected one exact anchor');
  return source.replace(before, after);
};

// The chip's chevron gives way to the exit control while the chip is hovered. The
// stable class names keep the plugin stylesheet independent of the module hash.
const chevron = '\t\t\t\t\t(0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChevronDownOutline14, {\n'
  + '\t\t\t\t\t\tclassName: HeroShell_module_css_default.chevron,\n'
  + '\t\t\t\t\t\tsize: 12\n'
  + '\t\t\t\t\t})';
const exitControl = [
  '\t\t\t\t\t(0, react_jsx_runtime.jsx)("span", {',
  '\t\t\t\t\t\tclassName: "dsh-chat-exit",',
  '\t\t\t\t\t\trole: "button",',
  '\t\t\t\t\t\ttabIndex: -1,',
  '\t\t\t\t\t\ttitle: "退出到对话",',
  '\t\t\t\t\t\t"aria-label": "退出到对话",',
  '\t\t\t\t\t\tonClick: (event) => {',
  '\t\t\t\t\t\t\tevent.stopPropagation();',
  '\t\t\t\t\t\t\twindow.__dshSessionActions?.exitToChat();',
  '\t\t\t\t\t\t},',
  '\t\t\t\t\t\tchildren: (0, react_jsx_runtime.jsxs)("svg", {',
  '\t\t\t\t\t\t\twidth: 14,',
  '\t\t\t\t\t\t\theight: 14,',
  '\t\t\t\t\t\t\tviewBox: "0 0 16 16",',
  '\t\t\t\t\t\t\tfill: "none",',
  '\t\t\t\t\t\t\tstroke: "currentColor",',
  '\t\t\t\t\t\t\tstrokeWidth: 1.3,',
  '\t\t\t\t\t\t\tstrokeLinecap: "round",',
  '\t\t\t\t\t\t\t"aria-hidden": true,',
  '\t\t\t\t\t\t\tchildren: [(0, react_jsx_runtime.jsx)("circle", {cx: 8, cy: 8, r: 6.3}), (0, react_jsx_runtime.jsx)("path", {d: "M5.9 5.9l4.2 4.2"}), (0, react_jsx_runtime.jsx)("path", {d: "M10.1 5.9l-4.2 4.2"})]',
  '\t\t\t\t\t\t})',
  '\t\t\t\t\t})'
].join('\n');

export function adaptWorkspace(source) {
  if (source.includes(marker)) return source;
  let next = source;
  // The filtered list must keep its identity between renders: the browser feeds it
  // into memo and effect dependencies, where a fresh array object each render loops.
  next = once(next, 'const workspaces = useWorkspaces((state) => state.items);', 'const allWorkspaces = useWorkspaces((state) => state.items);\n\t\t\tconst workflowPaths = window.__dshWorkflowWorkspacePaths;\n\t\t\tconst workspaces = (0, react.useMemo)(() => workflowPaths === void 0 ? allWorkspaces : allWorkspaces.filter((workspace) => !workflowPaths.has(workspace.path)), [allWorkspaces, workflowPaths]);');
  next = once(next, 'const sessionMenuItems = [', `const sessionMenuItems = [
                ...(window.__dshSessionActions ? [{id: 'dsh-copy-reference', label: '复制会话引用', icon: (0, react_jsx_runtime.jsx)('svg', {width:16,height:16,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.6,children:(0, react_jsx_runtime.jsx)('path',{d:'M9 9h11v11H9zM15 5V3H3v12h2'})})}] : []),`);
  next = once(next, 'if (id === "archive") onArchive(node.id);', `if (id === "archive") onArchive(node.id);
                                    if (id === 'dsh-copy-reference') void window.__dshSessionActions?.copy(node.id, row.title);`);
  return marker + '\n' + next;
}

export function adaptConversation(source) {
  if (source.includes(marker)) return source;
  let next = source;
  // A Session whose directory belongs to no registered Workspace still reads as Chat:
  // its chip carries the Chat label so the composer stays usable without a picker.
  next = once(next,
    'const chipTitle = pendingWorkspace?.title ?? (sessionId === void 0 ? void 0 : sessionWorkspace?.title ?? (workspaces.phase === "ready" || cwd === void 0 || cwd === "" ? void 0 : workspaceLabel(cwd)));',
    'const chipTitle = pendingWorkspace?.title ?? (sessionId === void 0 ? void 0 : sessionWorkspace?.title ?? (cwd === void 0 || cwd === "" ? void 0 : workspaces.phase === "ready" ? "对话" : workspaceLabel(cwd)));');
  next = once(next, 'className: HeroShell_module_css_default.workspace,', 'className: HeroShell_module_css_default.workspace + " dsh-chat-chip",');
  next = once(next, chevron, chevron.replace('HeroShell_module_css_default.chevron,', 'HeroShell_module_css_default.chevron + " dsh-chat-chevron",') + ',\n' + exitControl);
  return marker + '\n' + next;
}

async function readBackup(backupPath, current) {
  const backup = JSON.parse(await readFile(backupPath, 'utf8'));
  if (hash(current) !== backup.adaptedHash) throw new Error('WORKSPACE_ADAPTER_MODIFIED: preserve current changes before continuing');
  if (hash(backup.original) !== backup.originalHash) throw new Error('WORKSPACE_ADAPTER_BACKUP_INVALID');
  return backup;
}

export async function integrate(runtime, action = 'check') {
  const plans = [];
  // Validate every module and replacement before writing any file.
  for (const [name, adapt] of [['dsh-client-ui-workspace', adaptWorkspace], ['dsh-client-ui-conversation', adaptConversation]]) {
    const pkg = join(runtime, 'node_modules/@deepseek-ai', name);
    const meta = JSON.parse(await readFile(join(pkg, 'package.json'), 'utf8'));
    if (!upstreamVersions.includes(meta.version)) throw new Error('WORKSPACE_ADAPTER_VERSION_UNSUPPORTED: ' + meta.version);
    const path = join(pkg, 'lib/client.js');
    const backupPath = path + '.dsh-sessions-backup.json';
    const current = await readFile(path, 'utf8');
    // An earlier adapter revision is replaced from its pristine snapshot, never patched on top.
    const source = current.includes(previousMarker) ? (await readBackup(backupPath, current)).original : current;
    plans.push({path, backupPath, current, source, adapt});
  }
  for (const plan of plans) if (!plan.source.includes(marker)) plan.adapted = plan.adapt(plan.source);
  const results = [];
  for (const plan of plans) {
    if (action === 'restore') {
      const backup = await readBackup(plan.backupPath, plan.current);
      await writeFile(plan.path, backup.original);
      results.push({status: 'restored', path: plan.path});
      continue;
    }
    if (plan.adapted === undefined || plan.adapted === plan.current) {
      results.push({status: 'installed', path: plan.path});
      continue;
    }
    if (action === 'apply') {
      await writeFile(plan.backupPath, JSON.stringify({version: 2, original: plan.source, originalHash: hash(plan.source), adaptedHash: hash(plan.adapted)}), {mode: 0o600});
      await writeFile(plan.path, plan.adapted);
      results.push({status: 'installed', path: plan.path});
      continue;
    }
    results.push({status: 'compatible', path: plan.path});
  }
  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const runtime = resolve(process.argv[2] ?? fileURLToPath(new URL('../../../runtime', import.meta.url)));
  const action = process.argv.includes('--apply') ? 'apply' : process.argv.includes('--restore') ? 'restore' : 'check';
  console.log(JSON.stringify(await integrate(runtime, action)));
}
