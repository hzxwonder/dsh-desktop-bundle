import React, { useState, useEffect, useSyncExternalStore } from "react";
import { Menu } from "@deepseek-ai/dsh-client-ui-primitives";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
} from "@xyflow/react";
import {
  Plus,
  ChevronRight,
  ChevronDown,
  Play,
  Pause,
  Square,
  Save,
  Download,
  Upload,
  GitBranch,
  Settings2,
  Trash2,
  X,
  MessageSquare,
  Clock,
  FileText,
  Undo2,
  Check,
  Search,
  Copy,
  ClipboardPaste,
  MoreHorizontal,
  Pencil,
  Archive,
  Sparkles,
  TextCursorInput,
  PanelsTopLeft,
  ArrowLeft,
  BookOpen,
  Code,
  Send,
  RefreshCw,
  Workflow,
  LayoutGrid,
  List,
} from "lucide-react";
import { Handle, Position, MarkerType } from "@xyflow/react";
import flowCss from "@xyflow/react/dist/style.css";
import css from "./style.css";
import { canConnect, connectReference, pasteNodes, removeGraphItems } from "../lib/graph-edit.js";
import { RunTimeline } from "./run-timeline.jsx";
import { StepPrompt } from "./step-prompt.jsx";

export const name = "dsh-plugin-workflow";
export const inject = [
  "slots",
  "layout",
  "sessions",
  "commandUi",
  "workspaces",
  "uiWorkspace",
];
const labels = {
  input: "用户输入",
  interact: "交互",
  agent: "生成",
  tool: "工具",
  condition: "条件",
  join: "汇合",
  loop: "循环",
  subworkflow: "子工作流",
  approval: "确认",
  artifact: "输出",
};
const statuses = {
  queued: "等待执行",
  running: "执行中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
  paused: "已暂停",
  waiting_approval: "等待确认",
  waiting_input: "等待输入",
  needs_attention: "需要处理",
  skipped: "已跳过",
  pending: "待执行",
  stale: "输出已过期",
};
const glyphs = {
  workflow: GitBranch,
  book: BookOpen,
  search: Search,
  code: Code,
  file: FileText,
  sparkles: Sparkles,
  input: TextCursorInput,
  interact: MessageSquare,
  agent: Sparkles,
  tool: Settings2,
  condition: GitBranch,
  join: PanelsTopLeft,
  loop: RefreshCw,
  subworkflow: GitBranch,
  approval: Check,
  artifact: FileText,
};
const glyphFor = (glyph, size) => {
  const Glyph = glyphs[glyph] ?? GitBranch;
  return <Glyph size={size} />;
};
const pretty = (value) => JSON.stringify(value, null, 2);
const timestamp = (time) => (time ? new Date(time).toLocaleString() : "-");
const download = (name, content, type = "application/json") => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
function Icon({ label, icon: Symbol, className, size = 16, ...props }) {
  return (
    <button
      type="button"
      className={`wf-icon${className ? ` ${className}` : ""}`}
      title={label}
      aria-label={label}
      {...props}
    >
      <Symbol size={size} />
    </button>
  );
}
function Field({ label, children }) {
  return (
    <div className="wf-field" role="group" aria-label={label}>
      <span>{label}</span>
      {React.Children.map(children, child => React.isValidElement(child) && ['input','textarea','select'].includes(child.type) ? React.cloneElement(child, {'aria-label':child.props['aria-label'] ?? label}) : child)}
    </div>
  );
}
function TeamEditor({ members, update }) {
  const patch = (index, changes) => update(members.map((member, i) => i === index ? { ...member, ...changes } : member));
  return <section className="wf-team-editor" aria-label="并行子代理配置"><h3>并行子代理</h3><p className="wf-muted">先并行执行各成员，再由本步骤汇总结果。每个成员保留独立会话。</p>
    {members.map((member, index) => <details key={member.id} open><summary>{member.name || `子代理 ${index + 1}`}</summary>
      <Field label="子代理名称"><input value={member.name} onChange={e => patch(index, { name: e.target.value })} /></Field>
      <Field label="子代理任务"><textarea value={member.prompt} onChange={e => patch(index, { prompt: e.target.value })} /></Field>
      <Field label="子代理模型"><input placeholder="留空继承主会话" value={member.model?.mode === 'explicit' ? member.model.id : ''} onChange={e => patch(index, { model: e.target.value ? { mode: 'explicit', id: e.target.value } : { mode: 'inherit' } })} /></Field>
      <Field label="子代理工具"><input placeholder="工具名称，以逗号分隔" value={(member.tools ?? []).join(', ')} onChange={e => patch(index, { tools: [...new Set(e.target.value.split(',').map(t => t.trim()).filter(Boolean))] })} /></Field>
      <button type="button" onClick={() => update(members.filter((_, i) => i !== index))}>移除子代理</button>
    </details>)}
    <button type="button" disabled={members.length >= 8} onClick={() => update([...members, { id: `member-${crypto.randomUUID().slice(0, 8)}`, name: `子代理 ${members.length + 1}`, prompt: '' }])}><Plus size={14} />添加子代理</button>
  </section>;
}
function JsonField({ label, value, change, rows = 5 }) {
  const [text, setText] = useState(pretty(value ?? {}));
  const [error, setError] = useState("");
  const last = React.useRef(pretty(value ?? {}));
  useEffect(() => {
    const next = pretty(value ?? {});
    if (next !== last.current) {
      last.current = next;
      setText(next);
      setError("");
    }
  }, [value]);
  return (
    <Field label={label}>
      <textarea
        rows={rows}
        value={text}
        aria-invalid={Boolean(error)}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const parsed = JSON.parse(e.target.value);
            last.current = pretty(parsed);
            change(parsed);
            setError("");
          } catch {
            setError("JSON 格式不完整");
          }
        }}
      />
      {error && <small role="alert">{error}</small>}
    </Field>
  );
}
function Modal({ title, close, children }) {
  const ref = React.useRef();
  useEffect(() => {
    const el = ref.current;
    el.showModal();
    return () => el.close();
  }, []);
  return (
    <dialog className="wf-modal wf" ref={ref} onCancel={close}>
      <header>
        <h2>{title}</h2>
        <Icon label="关闭" icon={X} onClick={close} />
      </header>
      {children}
    </dialog>
  );
}

export function apply(ctx) {
  let snapshot = {
    workflows: [],
    references: [],
    bindings: [],
    authoring: [],
    runs: [],
    schedules: [],
    error: "",
  };
  const listeners = new Set();
  let panelOpen = false;
  let panel = { id: null, tab: "graph" };
  const panelListeners = new Set();
  let picker = null;
  const pickerListeners = new Set();
  let stopped = false;
  let sidebarWide = true;
  const drafts = new Map();
  const fitNarrowPanel = () => {
    if (window.innerWidth < 700 && sidebarWide) ctx.layout.toggleSidebar();
  };
  const api = async (args, signal) => {
    if (
      ["save", "run", "scheduleSave"].includes(args.action) &&
      document.querySelector('.wf textarea[aria-invalid="true"]')
    )
      throw new Error("请先修正 JSON 格式");
    const response = await fetch("/api/workflow-studio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
      signal,
    });
    const result = await response.json();
    if (!result.ok) throw new Error(result.detail ?? result.error);
    return result.value;
  };
  let refreshing;
  const lifetime = new AbortController();
  const publish = (next) => {
    if (stopped || JSON.stringify(next) === JSON.stringify(snapshot)) return;
    snapshot = next;
    listeners.forEach((f) => f());
  };
  const refresh = () => {
    if (stopped) return Promise.resolve();
    if (refreshing) return refreshing;
    refreshing = api({ action: "state" }, AbortSignal.any([
      lifetime.signal, AbortSignal.timeout(15000),
    ]))
      .then((data) => publish({ ...data, error: "" }))
      .catch((e) => publish({ ...snapshot, error: e.message }))
      .finally(() => { refreshing = undefined; });
    return refreshing;
  };
  const useData = () =>
    useSyncExternalStore(
      (fn) => {
        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      () => snapshot,
    );
  const useSessions = () =>
    useSyncExternalStore(
      ctx.sessions.list.subscribe,
      ctx.sessions.list.getSnapshot,
    );
  const usePanel = () =>
    useSyncExternalStore(
      (fn) => {
        panelListeners.add(fn);
        return () => panelListeners.delete(fn);
      },
      () => panel,
    );
  const setPanelOpen = (value) => {
    if (panelOpen === value) return;
    panelOpen = value;
    panelListeners.forEach((f) => f());
  };
  const openEditor = (id, tab = "graph") => {
    void refresh();
    panel = { id, tab };
    setPanelOpen(true);
    panelListeners.forEach((f) => f());
    ctx.layout.selectPanel("workflow-studio");
    fitNarrowPanel();
  };
  const openPicker = (sessionId) => {
    picker = { sessionId };
    pickerListeners.forEach((f) => f());
  };
  const closePicker = () => {
    picker = null;
    pickerListeners.forEach((f) => f());
  };
  const current = () => ctx.sessions.list.getSnapshot().current;
  // A workflow conversation lives in its own directory under $DSH_HOME/workflows.
  // The directory name is an id (or the shared "tmp" segment), so the Workspace is
  // renamed to the workflow name once; a title the user chose is never overwritten.
  const ensureWorkflowWorkspace = async (segment, title) => {
    const { path } = await api({ action: "workflowWorkspace", segment });
    if (!window.__dshWorkflowWorkspacePaths) window.__dshWorkflowWorkspacePaths = new Set();
    window.__dshWorkflowWorkspacePaths.add(path);
    const existing = ctx.workspaces.list.getSnapshot().items.find((w) => w.path === path);
    if (existing) {
      if (title && existing.title === segment) {
        try {
          return await ctx.uiWorkspace.workspaces.rename(existing.workspaceId, title);
        } catch {
          return existing;
        }
      }
      return existing;
    }
    const workspace = await ctx.uiWorkspace.workspaces.create({ path });
    if (!title) return workspace;
    try {
      return await ctx.uiWorkspace.workspaces.rename(workspace.workspaceId, title);
    } catch {
      return workspace;
    }
  };
  const newSession = async (workspaceId) => {
    const state = ctx.sessions.list.getSnapshot();
    const source = state.byId[state.current];
    if (workspaceId) return ctx.sessions.create({ workspaceId });
    return ctx.sessions.create(source?.cwd ? { cwd: source.cwd } : {});
  };
  // A fresh session only becomes addressable after the list refresh settles, so
  // resolve the binding with a bounded wait instead of failing on the first try.
  const sessionFor = async (id, timeoutMs = 8000) => {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const session = ctx.sessions.binding(id)?.session;
      if (session) return session;
      if (Date.now() > deadline) throw new Error("会话尚未就绪");
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  };
  // The Client Session face takes prompt content parts, never a bare string:
  // passing text directly is rejected by the RPC codec ("session/prompt rejected").
  const send = async (id, text, mode = "queue") => {
    const session = await sessionFor(id);
    const result = await session.prompt([{ type: "text", text }], mode);
    if (result && result.ok === false)
      throw new Error(result.error?.message ?? "会话拒绝了本次输入");
    return id;
  };
  const openSession = (id) => {
    ctx.sessions.open(id);
    ctx.layout.selectPanel(null);
    setPanelOpen(false);
    closePicker();
  };
  const bindSession = async (wf, sessionId, mode = "run", revision) => {
    const workspace =
      mode === "run" && !sessionId ? await ensureWorkflowWorkspace(wf.id, wf.name) : null;
    const id = sessionId ?? (await newSession(workspace?.workspaceId));
    await api({
      action: "bind",
      sessionId: id,
      id: wf.id,
      revision:
        revision ??
        (mode === "author" ? wf.revision : (wf.published ?? wf.revision)),
      mode,
    });
    await ctx.sessions.refresh();
    await refresh();
    return id;
  };
  const bind = async (wf, sessionId, mode = "run", revision) => {
    const id = await bindSession(wf, sessionId, mode, revision);
    openSession(id);
    return id;
  };
  const beginAuthorSession = async (sessionId) => {
    const tmp = await ensureWorkflowWorkspace("tmp", "工作流对话");
    const id = sessionId ?? (await newSession(tmp.workspaceId));
    await api({ action: "authorStart", sessionId: id });
    await ctx.sessions.refresh();
    ctx.sessions.open(id);
    ctx.layout.selectPanel(null);
    setPanelOpen(false);
    closePicker();
    await send(id, "我想创建一个新的工作流。");
    await refresh();
    return id;
  };
  // The editor's "编辑这些步骤" composer reuses one authoring conversation per
  // workflow, creating it on first use without stealing the current panel.
  const ensureAuthorSession = async (workflowId, revision) => {
    const existing = snapshot.bindings.find(
      (item) => item.workflowId === workflowId && item.mode === "author",
    );
    const listed =
      existing && ctx.sessions.list.getSnapshot().byId[existing.sessionId];
    if (listed) return existing.sessionId;
    const tmp = await ensureWorkflowWorkspace("tmp", "工作流对话");
    const id = await newSession(tmp.workspaceId);
    await api({ action: "authorStart", sessionId: id });
    await api({
      action: "bind",
      sessionId: id,
      id: workflowId,
      revision,
      mode: "author",
    });
    await ctx.sessions.refresh();
    await refresh();
    return id;
  };
  const unbind = async (sessionId) => {
    await api({ action: "unbind", sessionId });
    await refresh();
  };
  // The app bar renders the draft the editor owns: one writer, no forked state.
  let headerDraft = { key: null, definition: null, dirty: false, rename: null, save: null };
  const headerListeners = new Set();
  const setHeaderDraft = (next) => {
    headerDraft = next;
    headerListeners.forEach((listener) => listener());
  };
  const useHeaderDraft = () =>
    useSyncExternalStore(
      (fn) => {
        headerListeners.add(fn);
        return () => headerListeners.delete(fn);
      },
      () => headerDraft,
    );
  // Conversation rows for one workflow, shared by the gallery card and the list
  // row. The sidebar keeps a single entry, so these actions live here.
  function WorkflowSessions({ workflow, data, sessions, onError }) {
    const [menuSession, setMenuSession] = useState(null);
    const perform = (fn) =>
      Promise.resolve()
        .then(fn)
        .catch((e) => onError(e.message));
    const act = async (action, sessionId, title) => {
      setMenuSession(null);
      if (action === "copy") {
        if (window.__dshSessionActions?.copy) {
          await window.__dshSessionActions.copy(sessionId, title);
        } else {
          throw new Error("复制会话引用需要安装会话工具插件");
        }
      } else if (action === "rename") {
        const next = window.prompt("重命名会话", title || "");
        if (next?.trim()) {
          const session = ctx.sessions.binding(sessionId)?.session;
          if (!session) throw new Error("会话尚未就绪");
          const result = await session.rename(next.trim());
          if (!result.ok) throw new Error(result.error.message);
          await ctx.sessions.refresh();
        }
      } else if (action === "fork") {
        const childId = await ctx.sessions.fork({ sessionId, increaseTitle: true });
        const binding = data.bindings.find((item) => item.sessionId === sessionId);
        if (binding)
          await api({
            action: "bind",
            sessionId: childId,
            id: binding.workflowId,
            revision: binding.revision,
            mode: binding.mode,
          });
        await ctx.sessions.refresh();
        await refresh();
        ctx.sessions.open(childId);
        setPanelOpen(false);
      } else if (action === "archive") {
        await ctx.uiWorkspace.archiveSession(sessionId);
        await ctx.sessions.refresh();
        await refresh();
      }
    };
    const rows = data.references.filter(
      (r) =>
        r.workflowId === workflow.id &&
        sessions.byId[r.sessionId] &&
        !ctx.workspaces.list
          .getSnapshot()
          .archivedSessionIds.includes(r.sessionId),
    );
    if (!rows.length)
      return <p className="wf-sessions-empty">还没有对话，点「运行」开始一个。</p>;
    return (
      <div className="wf-sessions">
        {rows.map((r) => {
          const title = sessions.byId[r.sessionId].displayTitle;
          const openMenu = menuSession === r.sessionId;
          return (
            <div
              key={r.sessionId}
              className={
                "wf-session-row " +
                (sessions.current === r.sessionId ? "selected" : "")
              }
            >
              <button
                type="button"
                className="wf-session-name"
                title={title}
                onClick={() => {
                  ctx.sessions.open(r.sessionId);
                  setPanelOpen(false);
                }}
              >
                <MessageSquare size={13} aria-hidden="true" />
                <span>{title}</span>
              </button>
              <Menu
                open={openMenu}
                onClose={() => setMenuSession(null)}
                onSelect={(action) => perform(() => act(action, r.sessionId, title))}
                items={[
                  { id: "copy", label: "复制会话引用", icon: <Copy size={16} /> },
                  { id: "rename", label: "重命名", icon: <Pencil size={16} /> },
                  { id: "fork", label: "分叉会话", icon: <GitBranch size={16} /> },
                  { id: "archive", label: "归档会话", icon: <Archive size={16} /> },
                ]}
                anchor={
                  <button
                    type="button"
                    className="wf-session-menu-trigger wf-row-action"
                    aria-label={`会话“${title}”的操作`}
                    aria-expanded={openMenu}
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuSession(openMenu ? null : r.sessionId);
                    }}
                  >
                    <MoreHorizontal size={15} />
                  </button>
                }
              />
              <Icon
                className="wf-row-action"
                label={`新建 ${workflow.name} 会话`}
                icon={Plus}
                onClick={() => perform(() => bind(workflow))}
              />
            </div>
          );
        })}
      </div>
    );
  }

  // The workflow gallery: the same records as cards or as rows, with per-record
  // copy, run, archive and its conversation list. It replaces the sidebar list.
  function Gallery({ data, onError }) {
    const sessions = useSessions();
    const [view, setView] = useState(
      () => localStorage.getItem("workflow-studio:view") ?? "cards",
    );
    const [archived, setArchived] = useState(false);
    const [detail, setDetail] = useState(new Set());
    const perform = (fn) =>
      Promise.resolve()
        .then(fn)
        .catch((e) => onError(e.message));
    const choose = (next) => {
      localStorage.setItem("workflow-studio:view", next);
      setView(next);
    };
    const conversations = (id) =>
      data.references.filter((r) => r.workflowId === id && sessions.byId[r.sessionId])
        .length;
    // A copy is a fresh, unpublished workflow at the source's newest revision:
    // runs, schedules and conversation bindings deliberately stay behind.
    const copy = (record) =>
      perform(async () => {
        const created = await api({ action: "copy", id: record.id });
        await refresh();
        openEditor(created.id);
      });
    const archive = (record) =>
      perform(() =>
        api({ action: "archive", id: record.id, archived: !record.archived }),
      );
    const rows = data.workflows.filter((w) => w.archived === archived);
    const empty = !rows.length;
    return (
      <div className="wf-scroll">
        <div className="wf-gallery-bar">
          <span>
            {empty ? (archived ? "没有已归档的工作流" : "还没有工作流") : `${rows.length} 个工作流`}
          </span>
          <span className="wf-spacer" />
          <label className="wf-check">
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
            已归档
          </label>
          <div className="wf-segmented" role="tablist" aria-label="工作流样式">
            <button
              role="tab"
              aria-selected={view === "cards"}
              onClick={() => choose("cards")}
            >
              <LayoutGrid size={15} />
              卡片
            </button>
            <button
              role="tab"
              aria-selected={view === "list"}
              onClick={() => choose("list")}
            >
              <List size={15} />
              列表
            </button>
          </div>
        </div>
        {empty ? (
          <div className="wf-gallery-empty">
            <p>
              {archived
                ? "归档的工作流会出现在这里。"
                : "工作流把一段固定的做法变成可复用的步骤：先在对话里描述目标，Agent 会生成一个初步版本。"}
            </p>
            {!archived && (
              <button className="wf-primary" onClick={() => perform(() => beginAuthorSession())}>
                <Plus size={16} />
                创建工作流
              </button>
            )}
          </div>
        ) : view === "cards" ? (
          <div className="wf-cards">
            {rows.map((w) => (
              <article className="wf-card" key={w.id} data-workflow-card={w.id}>
                <button
                  type="button"
                  className="wf-card-head"
                  onClick={() => openEditor(w.id)}
                >
                  <span
                    className={`wf-workflow-icon wf-icon-${w.icon ?? "workflow"}`}
                    aria-hidden="true"
                  >
                    {glyphFor(w.icon ?? "workflow", 15)}
                  </span>
                  <span className="wf-card-title">{w.name}</span>
                  <span
                    className={`wf-chip ${w.published === w.revision ? "is-published" : ""}`}
                  >
                    {w.published ? `已发布 v${w.published}` : `草稿 v${w.revision}`}
                  </span>
                </button>
                <p className="wf-card-desc">{w.description || "还没有描述"}</p>
                <p className="wf-card-meta">
                  <span>{conversations(w.id)} 个对话</span>
                  <span>最近修改 {timestamp(w.updatedAt)}</span>
                </p>
                <div className="wf-card-actions">
                  <button onClick={() => openEditor(w.id)}>
                    <Settings2 size={15} />
                    打开
                  </button>
                  <button
                    disabled={w.archived}
                    onClick={() => perform(() => bind(w))}
                  >
                    <Play size={15} />
                    运行
                  </button>
                  <button onClick={() => copy(w)}>
                    <Copy size={15} />
                    拷贝
                  </button>
                  <Icon
                    label={w.archived ? `恢复 ${w.name}` : `归档 ${w.name}`}
                    icon={w.archived ? Undo2 : Trash2}
                    onClick={() => archive(w)}
                  />
                </div>
                <details className="wf-card-sessions">
                  <summary>
                    对话 {conversations(w.id) ? `(${conversations(w.id)})` : ""}
                  </summary>
                  <WorkflowSessions
                    workflow={w}
                    data={data}
                    sessions={sessions}
                    onError={onError}
                  />
                </details>
              </article>
            ))}
          </div>
        ) : (
          <table className="wf-table">
            <thead>
              <tr>
                <th>工作流</th>
                <th>版本</th>
                <th>对话</th>
                <th>最近修改</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => (
                <React.Fragment key={w.id}>
                  <tr data-workflow-row={w.id}>
                    <td>
                      <button className="wf-link" onClick={() => openEditor(w.id)}>
                        {w.name}
                      </button>
                      <small>{w.description}</small>
                    </td>
                    <td>
                      {w.published ? `已发布 v${w.published}` : `草稿 v${w.revision}`}
                    </td>
                    <td>
                      <button
                        className="wf-link"
                        aria-expanded={detail.has(w.id)}
                        onClick={() =>
                          setDetail((old) => {
                            const next = new Set(old);
                            next.has(w.id) ? next.delete(w.id) : next.add(w.id);
                            return next;
                          })
                        }
                      >
                        {conversations(w.id)} 个对话
                      </button>
                    </td>
                    <td>{timestamp(w.updatedAt)}</td>
                    <td>
                      <Icon
                        label={`运行 ${w.name}`}
                        icon={Play}
                        disabled={w.archived}
                        onClick={() => perform(() => bind(w))}
                      />
                      <Icon
                        label={`拷贝 ${w.name}`}
                        icon={Copy}
                        onClick={() => copy(w)}
                      />
                      <Icon
                        label={`编辑 ${w.name}`}
                        icon={Settings2}
                        onClick={() => openEditor(w.id)}
                      />
                      <Icon
                        label={w.archived ? `恢复 ${w.name}` : `归档 ${w.name}`}
                        icon={w.archived ? Undo2 : Trash2}
                        onClick={() => archive(w)}
                      />
                    </td>
                  </tr>
                  {detail.has(w.id) && (
                    <tr className="wf-detail-row">
                      <td colSpan={5}>
                        <WorkflowSessions
                          workflow={w}
                          data={data}
                          sessions={sessions}
                          onError={onError}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

  // The sidebar keeps one entry for the whole feature: it toggles the main
  // workflow panel and reports its count.
  function Tree({ wide = true, usePanelInfo }) {
    const data = useData();
    const fallback = useSyncExternalStore(
      (fn) => {
        panelListeners.add(fn);
        return () => panelListeners.delete(fn);
      },
      () => panelOpen,
    );
    const active =
      typeof usePanelInfo === "function"
        ? usePanelInfo((info) => info.activePanelId === "workflow-studio")
        : fallback;
    const count = data.workflows.filter((w) => !w.archived).length;
    return (
      <div className="wf wf-tree">
        <button
          type="button"
          className={`wf-nav-button${active ? " is-active" : ""}${wide ? "" : " is-rail"}`}
          aria-expanded={active}
          aria-label="工作流"
          title="工作流"
          onClick={() => {
            if (active) {
              ctx.layout.selectPanel(null);
              setPanelOpen(false);
            } else {
              openEditor(null);
            }
          }}
        >
          <GitBranch size={16} aria-hidden="true" />
          {wide && <span>工作流</span>}
          {wide && count > 0 && <span className="wf-nav-count">{count}</span>}
        </button>
      </div>
    );
  }

  function Picker() {
    const value = useSyncExternalStore(
      (fn) => {
        pickerListeners.add(fn);
        return () => pickerListeners.delete(fn);
      },
      () => picker,
    );
    const data = useData();
    const [query, setQuery] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
      setError("");
      setQuery("");
    }, [value]);
    if (!value) return null;
    const act = async (fn) => {
      setBusy(true);
      setError("");
      try {
        await fn();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    };
    return (
      <Modal title="选择工作流" close={closePicker}>
        <div className="wf-modal-body">
          {
            <>
              <div className="wf-search">
                <Search size={16} />
                <input
                  aria-label="搜索工作流"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="wf-picker-list">
                {data.workflows
                  .filter((w) => !w.archived && w.name.includes(query))
                  .map((w) => (
                    <button
                      key={w.id}
                      disabled={busy}
                      onClick={() => act(() => bind(w, value.sessionId))}
                    >
                      <GitBranch size={18} />
                      <span>
                        <strong>{w.name}</strong>
                        <small>{w.description}</small>
                      </span>
                      <span>v{w.published ?? w.revision}</span>
                    </button>
                  ))}
              </div>
              <button onClick={() => act(() => beginAuthorSession(value.sessionId))}>
                <Plus size={16} />
                创建工作流
              </button>
            </>
          }
          {error && (
            <p className="wf-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>
    );
  }
  function Routing({ node, update, caps }) {
    const [info, setInfo] = useState(null);
    const provider = node.provider?.mode === "explicit" ? node.provider.id : "";
    const model = node.model?.mode === "explicit" ? node.model.id : "";
    useEffect(() => {
      let live = true;
      setInfo(null);
      if (provider && model)
        api({ action: "modelInfo", provider, model })
          .then((v) => {
            if (live) setInfo(v);
          })
          .catch(() => {});
      return () => {
        live = false;
      };
    }, [provider, model]);
    const providers = caps?.providers ?? [];
    const models = providers.find((p) => p.id === provider)?.models ?? [];
    const route = (field, value) =>
      update({
        [field]: value ? { mode: "explicit", id: value } : { mode: "inherit" },
      });
    return (
      <>
        <Field label="Executor">
          <select
            value={node.executor ?? "spawn"}
            onChange={(e) => update({ executor: e.target.value })}
          >
            {(caps?.executors ?? ["spawn"]).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Provider">
          <select
            value={provider}
            onChange={(e) => {
              route("provider", e.target.value);
              update({
                provider: e.target.value
                  ? { mode: "explicit", id: e.target.value }
                  : { mode: "inherit" },
                model: { mode: "inherit" },
                effort: { mode: "inherit" },
              });
            }}
          >
            <option value="">继承会话</option>
            {providers.map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Model">
          <input
            list="wf-models"
            value={model}
            placeholder="继承会话"
            onChange={(e) => route("model", e.target.value)}
          />
          <datalist id="wf-models">
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </datalist>
        </Field>
        <Field label="Effort">
          <input
            list="wf-efforts"
            value={node.effort?.mode === "explicit" ? node.effort.id : ""}
            placeholder="继承会话"
            onChange={(e) => route("effort", e.target.value)}
          />
          <datalist id="wf-efforts">
            {info?.reasoning?.efforts.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </datalist>
        </Field>
      </>
    );
  }
  function Editor({ record, caps, save }) {
    const data = useData();
    const draftKey = `${record.id}:${record.revision}`;
    const [definition, setDefinition] = useState(drafts.get(draftKey) ?? record.snapshot.definition);
    const [selected, setSelected] = useState(definition.nodes[0]?.id);
    const [dirty, setDirty] = useState(drafts.has(draftKey));
    const [panelTab, setPanelTab] = useState("step");
    const [raw, setRaw] = useState(false);
    const [error, setError] = useState("");
    const [history, setHistory] = useState([]);
    const [clipboard, setClipboard] = useState(null);
    const [instruction, setInstruction] = useState("");
    const [sending, setSending] = useState(false);
    const [notice, setNotice] = useState("");
    const [run, setRun] = useState(null);
    const [assetsOpen, setAssetsOpen] = useState(false);
    const flow = React.useRef();
    const importInput = React.useRef();
    useEffect(() => {
      setDefinition(drafts.get(draftKey) ?? record.snapshot.definition);
      setDirty(drafts.has(draftKey));
    }, [record]);
    useEffect(() => {
      const fn = (e) => {
        if (dirty) {
          e.preventDefault();
          e.returnValue = "";
        }
      };
      window.addEventListener("beforeunload", fn);
      return () => window.removeEventListener("beforeunload", fn);
    }, [dirty]);
    const change = (value) => {
      drafts.set(draftKey, value);
      setHistory((old) => [...old.slice(-29), definition]);
      setDefinition(value);
      setDirty(true);
    };
    useEffect(() => {
      setHeaderDraft({
        key: draftKey,
        definition,
        dirty,
        rename: (name) => change({ ...definition, name }),
        save: () => save(definition, record.revision),
      });
    }, [definition, dirty, draftKey]);
    useEffect(
      () => () => setHeaderDraft({ key: null, definition: null, dirty: false }),
      [],
    );
    const node = definition.nodes.find((n) => n.id === selected);
    useEffect(() => {
      const onKey = (e) => {
        if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "c" && node) {
          e.preventDefault();
          setClipboard({ ...node, id: `node_${crypto.randomUUID().slice(0, 8)}`, name: `${node.name} 副本` });
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "v" && clipboard) {
          e.preventDefault();
          const pasted = { ...clipboard, position: { x: (clipboard.position?.x ?? 100) + 40, y: (clipboard.position?.y ?? 100) + 40 } };
          change({ ...definition, nodes: [...definition.nodes, pasted] });
          setSelected(pasted.id);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [node, clipboard, definition]);
    const update = (patch) =>
      change({
        ...definition,
        nodes: definition.nodes.map((n) =>
          n.id === selected ? { ...n, ...patch } : n,
        ),
      });
    const add = (kind, position) => {
      const id = `node_${crypto.randomUUID().slice(0, 8)}`;
      const n = {
        id,
        name: labels[kind],
        kind,
        position: position ?? {
          x: 100 + (definition.nodes.length % 3) * 240,
          y: 100 + Math.floor(definition.nodes.length / 3) * 150,
        },
      };
      if (kind === "agent") {
        n.prompt = "根据输入完成此步骤，返回完整结果。";
        n.input = { material: { source: "workflow", path: "/text" } };
        n.tools = [];
        n.skills = [];
      }
      if (kind === "input") {
        n.prompt = "请提供本次任务需要的材料。";
        n.input = { text: { source: "workflow", path: "/text" } };
      }
      if (kind === "interact") {
        n.interaction = "once";
        n.prompt = "请提供完成任务需要的材料。";
        n.input = { material: { source: "workflow", path: "/text" } };
      }
      if (kind === "condition") n.condition = { "!!": [{ var: "value" }] };
      if (kind === "artifact") {
        n.format = "text/markdown";
        n.input = { content: { source: "workflow", path: "/text" } };
      }
      change({ ...definition, nodes: [...definition.nodes, n] });
      setSelected(id);
    };
    const remove = () => {
      change(removeGraphItems(definition, [selected]));
      setSelected(null);
    };
    const graphNodes = definition.nodes.map((n, i) => ({
      id: n.id,
      type: "workflowNode",
      position: n.position ?? {
        x: 80 + (i % 3) * 240,
        y: 80 + Math.floor(i / 3) * 160,
      },
      data: {
        kind: n.kind,
        title: n.name,
        model: n.model?.mode === "explicit" ? n.model.id : "会话模型",
        summary: n.prompt || (n.kind === 'artifact' ? '展示并保存上游步骤的结果' : '配置此步骤的执行行为'),
        mode: n.kind === 'interact' ? (n.interaction === 'goal' ? '交互目标' : '交互一次') : undefined,
        references: Object.values(n.input ?? {}).filter(r => r.source === 'node').map(r => definition.nodes.find(x => x.id === r.nodeId)).filter(Boolean),
      },
      className: `wf-node wf-node-${n.kind}`,
      selected: n.id === selected,
    }));
    const graphEdges = definition.edges.map((e) => ({
      id: `${e.from}:${e.to}`,
      source: e.from,
      target: e.to,
      label: e.on === "true" ? "是" : e.on === "false" ? "否" : undefined,
      className: e.on === "false" ? "wf-edge-dashed" : undefined,
    }));
    const nodeTypes = {
      workflowNode: ({ data: view, selected: active }) => (
        <div className={`wf-node-card wf-step-${view.kind} ${active ? "is-selected" : ""}`}>
          {view.kind !== 'input' && <Handle type="target" position={Position.Left} />}
          <div className="wf-step-heading">
            <span className="wf-step-glyph">{glyphFor(view.kind, 14)}</span>
            <strong>{view.title}</strong>
            <em>{labels[view.kind]}</em>
          </div>
          <div className="wf-step-body">
            <p>{view.summary}</p>
            {view.references.length > 0 && (
              <div className="wf-step-references">
                {view.references.map((ref, i) => (
                  <span key={`${ref.id}-${i}`} className={`wf-inline-reference wf-step-${ref.kind}`}>{ref.name}</span>
                ))}
              </div>
            )}
            {view.kind === 'agent' && <span className="wf-step-model">{view.model}</span>}
            {view.kind === 'interact' && <span className="wf-step-model">{view.mode}</span>}
          </div>
          <Handle type="source" position={Position.Right} />
        </div>
      ),
    };
    const latestRun = data.runs.find((item) => item.workflowId === record.id);
    useEffect(() => {
      let live = true;
      if (!latestRun) {
        setRun(null);
        return () => { live = false; };
      }
      api({ action: "runRead", id: latestRun.id })
        .then((value) => { if (live) setRun(value); })
        .catch(() => {});
      return () => { live = false; };
    }, [latestRun?.id, latestRun?.status, panelTab]);
    const submitInstruction = async () => {
      const text = instruction.trim();
      if (!text || sending) return;
      setSending(true);
      setNotice("");
      try {
        const sessionId = await ensureAuthorSession(record.id, record.revision);
        await send(sessionId, text);
        setInstruction("");
        setNotice("已交给对话修改会话；Agent 保存后画布会自动刷新。");
      } catch (e) {
        setNotice(e.message);
      } finally {
        setSending(false);
      }
    };
    const stepRun = run?.run?.nodes?.[selected];
    const stepEvents = (run?.events ?? []).filter((e) => !e.nodeId || e.nodeId === selected);
    const importDefinition = async (file) => {
      if (!file) return;
      try {
        const next = JSON.parse(await file.text());
        next.id = `workflow-${crypto.randomUUID()}`;
        const saved = await api({ action: "save", definition: next, expectedRevision: 0 });
        openEditor(saved.id);
      } catch (e) {
        setError(e.message);
      }
    };
    const saveDraft = async () => {
      try {
        await save(definition, record.revision);
        setError("");
      } catch (e) {
        setError(e.message);
      }
    };
    return (
      <div className="wf-editor">
        <div className="wf-editor-body">
          <div className="wf-stage">
            <div className="wf-canvas">
              <div className="wf-addbar" role="toolbar" aria-label="添加步骤">
                {Object.entries(labels).map(([kind, label]) => (
                  <button
                    key={kind}
                    draggable
                    onDragStart={(e) =>
                      e.dataTransfer.setData("application/workflow-node", kind)
                    }
                    onClick={() => add(kind)}
                  >
                    {glyphFor(kind, 14)}
                    {label}
                  </button>
                ))}
                <span className="wf-addbar-divider" aria-hidden="true" />
                <Menu
                  open={assetsOpen}
                  onClose={() => setAssetsOpen(false)}
                  items={[
                    { id: "save", label: "保存版本", icon: <Save size={16} /> },
                    { id: "import", label: "导入工作流", icon: <Upload size={16} /> },
                    { id: "export", label: "导出定义", icon: <Download size={16} /> },
                    { id: "json", label: raw ? "返回画布" : "编辑 JSON", icon: <FileText size={16} /> },
                  ]}
                  onSelect={(action) => {
                    setAssetsOpen(false);
                    if (action === "save") void saveDraft();
                    if (action === "export") download(`${definition.id}.json`, pretty(definition));
                    if (action === "json") setRaw((v) => !v);
                    if (action === "import") importInput?.click();
                  }}
                  anchor={
                    <button
                      type="button"
                      aria-label="添加资源"
                      aria-expanded={assetsOpen}
                      onClick={() => setAssetsOpen((v) => !v)}
                    >
                      <Plus size={14} />
                      添加资源
                    </button>
                  }
                />
              </div>
              <input
                ref={importInput}
                type="file"
                accept="application/json,.json"
                hidden
                aria-label="导入工作流文件"
                onChange={(e) => { void importDefinition(e.target.files?.[0]); e.target.value = ""; }}
              />
              {raw ? (
                <div className="wf-json">
                  <JsonField
                    label="工作流定义"
                    value={definition}
                    change={change}
                    rows={30}
                  />
                </div>
              ) : (
                <div
                  className="wf-flow"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const kind = e.dataTransfer.getData("application/workflow-node");
                    if (labels[kind]) add(kind, flow.current?.screenToFlowPosition({ x: e.clientX, y: e.clientY }));
                  }}
                >
                  <ReactFlow
                    onInit={(instance) => { flow.current = instance; }}
                    nodeTypes={nodeTypes}
                    nodes={graphNodes}
                    edges={graphEdges}
                    defaultEdgeOptions={{
                      type: "smoothstep",
                      markerEnd: { type: MarkerType.ArrowClosed },
                    }}
                    fitView
                    fitViewOptions={{ padding: 0.18 }}
                    minZoom={0.2}
                    maxZoom={2}
                    onNodeClick={(_, n) => { setSelected(n.id); setPanelTab("step"); }}
                    onNodesChange={(changes) => {
                      const nodes = applyNodeChanges(changes, graphNodes);
                      if (
                        changes.some(
                          (c) => c.type === "position" || c.type === "remove",
                        )
                      )
                        change({
                          ...definition,
                          nodes: definition.nodes
                            .filter((n) => nodes.some((x) => x.id === n.id))
                            .map((n) => ({
                              ...n,
                              position: nodes.find((x) => x.id === n.id).position,
                            })),
                          edges: definition.edges.filter(
                            (e) =>
                              nodes.some((n) => n.id === e.from) &&
                              nodes.some((n) => n.id === e.to),
                          ),
                        });
                    }}
                    onEdgesChange={(changes) => {
                      if (changes.some((c) => c.type === "remove")) {
                        const edges = applyEdgeChanges(changes, graphEdges);
                        change({
                          ...definition,
                          edges: definition.edges.filter((e) =>
                            edges.some((x) => x.id === `${e.from}:${e.to}`),
                          ),
                        });
                      }
                    }}
                    onConnect={(connection) => {
                      try {
                        change(connectReference(definition, connection.source, connection.target).definition);
                      } catch (e) { setError(e.message); }
                    }}
                  >
                    <Controls />
                    <MiniMap pannable zoomable />
                  </ReactFlow>
                </div>
              )}
              <div className="wf-canvas-tools">
                <Icon
                  label="复制节点"
                  icon={Copy}
                  disabled={!node}
                  onClick={() => node && setClipboard({ nodes: [structuredClone(node)], edges: definition.edges.filter((e) => e.from === node.id || e.to === node.id) })}
                />
                <Icon
                  label="粘贴节点"
                  icon={ClipboardPaste}
                  disabled={!clipboard}
                  onClick={() => {
                    if (!clipboard) return;
                    const next = pasteNodes(definition, clipboard);
                    const pasted = next.nodes.at(-1);
                    change(next);
                    setSelected(pasted.id);
                  }}
                />
                <Icon
                  label="撤销"
                  icon={Undo2}
                  disabled={!history.length}
                  onClick={() => {
                    setDefinition(history.at(-1));
                    setHistory((h) => h.slice(0, -1));
                    setDirty(true);
                  }}
                />
                <Icon
                  label={raw ? "返回画布" : "编辑 JSON"}
                  icon={FileText}
                  aria-pressed={raw}
                  onClick={() => setRaw((v) => !v)}
                />
              </div>
            </div>
            <div className="wf-step-composer">
              <div className="wf-instruction">
                <input
                  aria-label="编辑这些步骤"
                  placeholder="编辑这些步骤"
                  value={instruction}
                  disabled={sending}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void submitInstruction();
                    }
                  }}
                />
                <button
                  type="button"
                  className="wf-send"
                  aria-label="发送修改指令"
                  disabled={sending || !instruction.trim()}
                  onClick={() => void submitInstruction()}
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="wf-composer-note" role="status">
                {notice || "用一句话说明要改什么，Agent 会更新步骤定义；保存后生成新版本。"}
              </p>
            </div>
          </div>
          <aside className="wf-inspector" aria-label="步骤设置">
            <div className="wf-panel-tabs" role="tablist" aria-label="步骤面板">
              {[["step", "步骤"], ["preview", "预览"], ["console", "控制台"], ["theme", "主题"]].map(([key, label]) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={panelTab === key}
                  onClick={() => setPanelTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {panelTab !== "theme" && node && (
              <div className={`wf-panel-head wf-step-${node.kind}`}>
                <span className="wf-step-glyph">{glyphFor(node.kind, 14)}</span>
                <strong>{node.name}</strong>
                <em>{labels[node.kind]}</em>
                <Icon label="删除节点" icon={Trash2} onClick={remove} />
              </div>
            )}
            {panelTab === "theme" ? (
              <div className="wf-panel-body">
                <Field label="工作流图标">
                  <div className="wf-icon-picker">
                    {["workflow", "book", "search", "code", "file", "sparkles"].map((name) => (
                      <button
                        key={name}
                        type="button"
                        aria-label={`图标 ${name}`}
                        aria-pressed={(definition.icon ?? "workflow") === name}
                        onClick={() => change({ ...definition, icon: name })}
                      >
                        {glyphFor(name, 16)}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label="步骤配色">
                  <div className="wf-swatches">
                    {Object.entries(labels).map(([kind, label]) => (
                      <span key={kind} className={`wf-swatch wf-step-${kind}`}>{label}</span>
                    ))}
                  </div>
                </Field>
                <p className="wf-muted">图标与配色写在定义里，保存后对所有会话生效。</p>
              </div>
            ) : panelTab === "preview" ? (
              <div className="wf-panel-body">
                {!run ? (
                  <p className="wf-panel-empty">还没有运行记录</p>
                ) : (
                  <>
                    <p className="wf-panel-note">
                      最近一次运行 · {statuses[run.run.status] ?? run.run.status} · {timestamp(run.run.createdAt)}
                    </p>
                    {stepRun ? (
                      <>
                        <p className="wf-panel-note">
                          <span className={`wf-status ${stepRun.status}`}>{statuses[stepRun.status] ?? stepRun.status}</span>
                        </p>
                        {stepRun.error && <p className="wf-error">{stepRun.error}</p>}
                        <pre className="wf-output">{typeof stepRun.output === "string" ? stepRun.output : pretty(stepRun.output ?? null)}</pre>
                      </>
                    ) : (
                      <p className="wf-panel-empty">该步骤还没有输出</p>
                    )}
                  </>
                )}
              </div>
            ) : panelTab === "console" ? (
              <div className="wf-panel-body">
                {stepEvents.length === 0 ? (
                  <p className="wf-panel-empty">暂无该步骤的事件</p>
                ) : (
                  <ul className="wf-console">
                    {stepEvents.map((event, index) => (
                      <li key={`${event.type ?? "event"}-${index}`}>
                        <time>{timestamp(event.at ?? event.createdAt)}</time>
                        <span>
                          {event.type ?? event.kind ?? "event"}
                          {event.error ? ` · ${event.error}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {run?.run?.nodes && (
                  <details className="wf-advanced">
                    <summary>运行详情</summary>
                    <pre className="wf-output">{pretty(run.run.nodes)}</pre>
                  </details>
                )}
              </div>
            ) : node ? (
              <div className="wf-panel-body">
                {!(node.kind === "interact" && node.interaction !== "goal") && (
                  <Routing node={node} update={update} caps={caps} />
                )}
                <div className="wf-prompt-label">
                  <Sparkles size={12} />
                  <span>
                    {node.kind === "interact"
                      ? node.interaction === "goal"
                        ? "交互目标"
                        : "提问内容"
                      : "步骤说明"}
                  </span>
                  <Icon
                    label="编辑步骤说明"
                    icon={Pencil}
                    size={12}
                    onClick={() => document.querySelector(".wf-panel-body .wf-step-prompt")?.focus()}
                  />
                </div>
                <StepPrompt
                  key={node.id}
                  node={node}
                  definition={definition}
                  onChange={(prompt) => update({ prompt })}
                  onReference={(source) => {
                    try { change(connectReference(definition, source, node.id).definition); } catch (e) { setError(e.message); }
                  }}
                />
                {node.kind === "agent" && (
                  <>
                    <Field label="技能">
                      <input
                        list="wf-skills"
                        value={(node.skills ?? []).join(", ")}
                        onChange={(e) =>
                          update({
                            skills: e.target.value
                              .split(",")
                              .map((v) => v.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                      <datalist id="wf-skills">
                        {(caps?.skills ?? []).map((s) => (
                          <option key={s.name} value={s.name} />
                        ))}
                      </datalist>
                    </Field>
                    <Field label="工具">
                      <input
                        list="wf-tools"
                        value={(node.tools ?? []).join(", ")}
                        onChange={(e) =>
                          update({
                            tools: e.target.value
                              .split(",")
                              .map((v) => v.trim())
                              .filter(Boolean),
                          })
                        }
                      />
                    </Field>
                  </>
                )}
                {node.kind === "tool" && (
                  <Field label="Tool">
                    <input
                      list="wf-tools"
                      value={node.tool ?? ""}
                      onChange={(e) => update({ tool: e.target.value })}
                    />
                  </Field>
                )}
                {node.kind === "interact" && (
                  <>
                    <Field label="交互方式">
                      <select
                        value={node.interaction ?? "once"}
                        onChange={(e) =>
                          update({
                            interaction: e.target.value,
                            ...(e.target.value === "once"
                              ? { maxTurns: undefined }
                              : {}),
                          })
                        }
                      >
                        <option value="once">交互一次：用户回答一次后继续</option>
                        <option value="goal">交互目标：反复澄清直到确认理解</option>
                      </select>
                    </Field>
                    {node.interaction === "goal" && (
                      <Field label="最多回答轮次">
                        <input
                          type="number"
                          min="1"
                          max="20"
                          value={node.maxTurns ?? 8}
                          onChange={(e) =>
                            update({ maxTurns: Number(e.target.value) })
                          }
                        />
                      </Field>
                    )}
                    <Field label="已有材料时跳过提问">
                      <select
                        value={
                          node.provided
                            ? ["/text", "/attachments"].includes(node.provided.path)
                              ? node.provided.path
                              : "custom"
                            : ""
                        }
                        onChange={(e) =>
                          update({
                            provided: e.target.value
                              ? e.target.value === "custom"
                                ? node.provided
                                : { source: "workflow", path: e.target.value }
                              : undefined,
                          })
                        }
                      >
                        <option value="">每次提问</option>
                        <option value="/attachments">消息已带附件时直接采用</option>
                        <option value="/text">消息文本就是材料时直接采用</option>
                        {node.provided &&
                          !["/text", "/attachments"].includes(node.provided.path) && (
                            <option value="custom">自定义引用</option>
                          )}
                      </select>
                    </Field>
                    <p className="wf-muted">
                      交互节点会暂停运行，把问题交给绑定会话里的 Agent；用户的下一条消息就是这次交互的回答。
                      {node.interaction === "goal"
                        ? "判定 Agent 认为已经理解意图后，会先请你确认，确认后才进入下一步。"
                        : ""}
                    </p>
                  </>
                )}
                <datalist id="wf-tools">
                  {(caps?.tools ?? []).map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
                {node.kind === 'agent' && <TeamEditor members={node.subagents ?? []} update={subagents => update({ subagents })} />}
                <details className="wf-advanced">
                  <summary>高级设置</summary>
                  <Field label="步骤标识"><input value={node.id} readOnly /></Field>
                  <JsonField
                    label="输入映射"
                    value={node.input}
                    change={(input) => update({ input })}
                  />
                  {node.kind === "condition" && (
                    <JsonField
                      label="条件"
                      value={node.condition}
                      change={(condition) => update({ condition })}
                    />
                  )}
                  {!(node.kind === "interact" && node.interaction !== "goal") && (
                    <JsonField
                      label="输出数据结构"
                      value={node.outputSchema ?? { type: "object" }}
                      change={(outputSchema) => update({ outputSchema })}
                    />
                  )}
                  {["loop", "subworkflow"].includes(node.kind) && (
                    <JsonField
                      label="子工作流版本"
                      value={node.workflow ?? { id: "", revision: 1 }}
                      change={(workflow) => update({ workflow })}
                    />
                  )}
                  {node.kind !== "interact" && (
                    <Field label="超时（秒）">
                      <input
                        type="number"
                        min="1"
                        max="3600"
                        value={node.timeoutSeconds ?? 600}
                        onChange={(e) => update({ timeoutSeconds: Number(e.target.value) })}
                      />
                    </Field>
                  )}
                  {node.kind === "loop" && (
                    <Field label="最大条目数">
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={node.maxItems ?? 10}
                        onChange={(e) => update({ maxItems: Number(e.target.value) })}
                      />
                    </Field>
                  )}
                  {definition.edges
                    .filter((e) => e.from === node.id)
                    .map((e) => (
                      <Field
                        key={e.to}
                        label={`连接至 ${definition.nodes.find((n) => n.id === e.to)?.name}`}
                      >
                        <select
                          value={e.on ?? "success"}
                          onChange={(event) =>
                            change({
                              ...definition,
                              edges: definition.edges.map((x) =>
                                x === e ? { ...e, on: event.target.value } : x,
                              ),
                            })
                          }
                        >
                          <option value="success">成功</option>
                          {node.kind === "condition" && (
                            <>
                              <option value="true">是</option>
                              <option value="false">否</option>
                            </>
                          )}
                        </select>
                      </Field>
                    ))}
                </details>
              </div>
            ) : (
              <p className="wf-panel-empty">未选择步骤</p>
            )}
            {error && (
              <p className="wf-error" role="alert">{error}</p>
            )}
          </aside>
        </div>
      </div>
    );
  }
  function Runs({ id }) {
    const data = useData();
    const [detail, setDetail] = useState(null);
    const [error, setError] = useState("");
    const action = async (args) => {
      try {
        await api(args);
        await refresh();
        if (detail)
          setDetail(await api({ action: "runRead", id: detail.run.id }));
      } catch (e) {
        setError(e.message);
      }
    };
    return (
      <div className="wf-scroll">
        <table>
          <thead>
            <tr>
              <th>运行</th>
              <th>版本</th>
              <th>状态</th>
              <th>时间</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.runs
              .filter((r) => r.workflowId === id)
              .map((r) => (
                <tr key={r.id}>
                  <td>
                    <button
                      onClick={async () =>
                        setDetail(await api({ action: "runRead", id: r.id }))
                      }
                    >
                      {r.id.slice(0, 18)}
                    </button>
                  </td>
                  <td>v{r.revision}</td>
                  <td>
                    <span className={`wf-status ${r.status}`}>
                      {statuses[r.status] ?? r.status}
                    </span>
                  </td>
                  <td>{timestamp(r.createdAt)}</td>
                  <td>
                    <Icon
                      label="打开运行会话"
                      icon={MessageSquare}
                      onClick={async () => {
                        await ctx.sessions.refresh();
                        ctx.sessions.open(r.sessionId);
                        ctx.layout.selectPanel(null);
                      }}
                    />
                    {r.status === "running" ? (
                      <>
                        <Icon
                          label="暂停运行"
                          icon={Pause}
                          onClick={() => action({ action: "pause", id: r.id })}
                        />
                        <Icon
                          label="取消运行"
                          icon={Square}
                          onClick={() => action({ action: "cancel", id: r.id })}
                        />
                      </>
                    ) : (
                      [
                        "paused",
                        "failed",
                        "needs_attention",
                        "waiting_approval",
                        "cancelled",
                      ].includes(r.status) && (
                        <Icon
                          label="恢复运行"
                          icon={Play}
                          onClick={() =>
                            setDetail({ run: r, events: [], artifacts: [] })
                          }
                        />
                      )
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!data.runs.some((r) => r.workflowId === id) && (
          <p className="wf-muted">暂无运行记录</p>
        )}
        {error && (
          <p role="alert" className="wf-error">
            {error}
          </p>
        )}
        {detail && (
          <Modal title="运行详情" close={() => setDetail(null)}>
            <div className="wf-modal-body">
              <p>
                {statuses[detail.run.status]} · v{detail.run.revision}
              </p>
              {detail.run.error && (
                <p className="wf-error">{detail.run.error}</p>
              )}
              {(() => {
                const entry = Object.entries(detail.run.nodes ?? {}).find(
                  ([, n]) => n.status === "waiting_input",
                );
                if (detail.run.status !== "waiting_input" || !entry) return null;
                const [nodeId, state] = entry;
                const info = state.interaction ?? {};
                return (
                  <div className="wf-interaction" data-wf-interaction={nodeId}>
                    <strong>
                      {info.phase === "confirm" ? "等待你确认理解" : "等待你的回答"}
                    </strong>
                    <p>{info.question}</p>
                    <small>
                      第 {info.turns ?? 0} / {info.maxTurns ?? 1} 轮 · 在运行会话里回答，或在这里跳过去回复
                    </small>
                    <button
                      className="wf-primary"
                      onClick={async () => {
                        await ctx.sessions.refresh();
                        ctx.sessions.open(detail.run.sessionId);
                        ctx.layout.selectPanel(null);
                      }}
                    >
                      <MessageSquare size={16} />
                      去对话回答
                    </button>
                  </div>
                );
              })()}
              <RunTimeline ctx={ctx} api={api} runId={detail.run.id} openSession={openSession} onChange={refresh} />
              {detail.artifacts.map((a) => (
                <button
                  key={a.id}
                  onClick={async () => {
                    const artifact = await api({
                      action: "artifact",
                      id: a.id,
                    });
                    download(
                      artifact.name,
                      artifact.content,
                      artifact.mediaType,
                    );
                  }}
                >
                  <Download size={16} />
                  {a.name}
                </button>
              ))}
              {[
                "paused",
                "failed",
                "needs_attention",
                "waiting_approval",
                "cancelled",
              ].includes(detail.run.status) && (
                <>
                  <p>
                    恢复将保留已完成节点，并重新执行未完成节点。涉及写入的步骤需要核对外部执行结果。
                  </p>
                  <button
                    className="wf-primary"
                    onClick={() =>
                      action({
                        action: "resume",
                        runId: detail.run.id,
                        sessionId: detail.run.sessionId,
                        response: true,
                        background: true,
                      })
                    }
                  >
                    <Play size={16} />
                    确认并恢复
                  </button>
                </>
              )}
              <details>
                <summary>事件记录</summary>
                <pre>{pretty(detail.events)}</pre>
              </details>
            </div>
          </Modal>
        )}
      </div>
    );
  }
  function Schedules({ record, caps }) {
    const data = useData();
    const [plan, setPlan] = useState(null);
    const [preview, setPreview] = useState([]);
    const [error, setError] = useState("");
    const perform = async (fn) => {
      try {
        await fn();
        setError("");
        await refresh();
      } catch (e) {
        setError(e.message);
      }
    };
    const update = (patch) => setPlan((p) => ({ ...p, ...patch }));
    return (
      <div className="wf-scroll">
        <div className="wf-toolbar">
          <h3>定时任务</h3>
          <span className="wf-spacer" />
          <button
            onClick={() =>
              setPlan({
                workflowId: record.id,
                workflowRevision: record.published ?? record.revision,
                kind: "cron",
                cron: "0 9 * * *",
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                cwd: ctx.sessions.list.getSnapshot().byId[current()]?.cwd ?? "",
                input: { text: "" },
                rootRoute: { provider: "", model: "" },
                enabled: true,
                missed: "skip",
                overlap: "skip",
                tools: [],
              })
            }
          >
            <Plus size={16} />
            添加定时任务
          </button>
        </div>
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>下次执行</th>
              <th>版本</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data.schedules
              .filter((p) => p.workflowId === record.id)
              .map((p) => (
                <tr key={p.id}>
                  <td>
                    {p.cron ?? p.at ?? `${p.seconds}s`}
                    <small>{p.timezone}</small>
                  </td>
                  <td>{timestamp(p.nextAt)}</td>
                  <td>v{p.workflowRevision}</td>
                  <td>{p.enabled ? "启用" : "停用"}</td>
                  <td>
                    <Icon
                      label="编辑定时任务"
                      icon={Settings2}
                      onClick={() => setPlan(p)}
                    />
                    <Icon
                      label="删除定时任务"
                      icon={Trash2}
                      onClick={() =>
                        perform(() =>
                          api({ action: "scheduleDelete", id: p.id }),
                        )
                      }
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {error && (
          <p role="alert" className="wf-error">
            {error}
          </p>
        )}
        {plan && (
          <Modal title="定时任务" close={() => setPlan(null)}>
            <div className="wf-modal-body">
              <Field label="类型">
                <select
                  value={plan.kind}
                  onChange={(e) => update({ kind: e.target.value })}
                >
                  <option value="cron">固定日程</option>
                  <option value="once">单次</option>
                  <option value="interval">固定间隔</option>
                </select>
              </Field>
              {plan.kind === "cron" ? (
                <>
                  <Field label="Cron">
                    <input
                      value={plan.cron ?? ""}
                      onChange={(e) => update({ cron: e.target.value })}
                    />
                  </Field>
                  <Field label="时区">
                    <input
                      value={plan.timezone ?? ""}
                      onChange={(e) => update({ timezone: e.target.value })}
                    />
                  </Field>
                </>
              ) : plan.kind === "once" ? (
                <Field label="执行时间（含时区）">
                  <input
                    value={plan.at ?? ""}
                    placeholder="2026-09-14T09:00:00+08:00"
                    onChange={(e) => update({ at: e.target.value })}
                  />
                </Field>
              ) : (
                <Field label="间隔（秒）">
                  <input
                    type="number"
                    min="60"
                    value={plan.seconds ?? 3600}
                    onChange={(e) =>
                      update({ seconds: Number(e.target.value) })
                    }
                  />
                </Field>
              )}
              <Field label="工作目录">
                <input
                  value={plan.cwd}
                  onChange={(e) => update({ cwd: e.target.value })}
                />
              </Field>
              <Field label="固定版本">
                <input
                  type="number"
                  min="1"
                  max={record.revision}
                  value={plan.workflowRevision}
                  onChange={(e) =>
                    update({ workflowRevision: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Provider">
                <select
                  value={plan.rootRoute.provider}
                  onChange={(e) =>
                    update({
                      rootRoute: { provider: e.target.value, model: "" },
                    })
                  }
                >
                  <option value="">选择 Provider</option>
                  {caps?.providers?.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Model">
                <input
                  value={plan.rootRoute.model}
                  onChange={(e) =>
                    update({
                      rootRoute: { ...plan.rootRoute, model: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label="Effort">
                <input
                  value={plan.rootRoute.reasoningEffort ?? ""}
                  onChange={(e) =>
                    update({
                      rootRoute: {
                        ...plan.rootRoute,
                        reasoningEffort: e.target.value || undefined,
                      },
                    })
                  }
                />
              </Field>
              <JsonField
                label="输入"
                value={plan.input}
                change={(input) => update({ input })}
              />
              <Field label="错过执行">
                <select
                  value={plan.missed}
                  onChange={(e) => update({ missed: e.target.value })}
                >
                  <option value="skip">跳过</option>
                  <option value="latest">补执行最近一次</option>
                </select>
              </Field>
              <Field label="运行重叠">
                <select
                  value={plan.overlap}
                  onChange={(e) => update({ overlap: e.target.value })}
                >
                  <option value="skip">跳过</option>
                  <option value="latest">排队最近一次</option>
                </select>
              </Field>
              <Field label="允许的工具">
                <input
                  value={(plan.tools ?? []).join(", ")}
                  onChange={(e) =>
                    update({
                      tools: e.target.value
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </Field>
              <label>
                <input
                  type="checkbox"
                  checked={plan.enabled}
                  onChange={(e) => update({ enabled: e.target.checked })}
                />
                启用
              </label>
              <p className="wf-muted">Host 在线时执行 · {plan.timezone}</p>
              <button
                onClick={() =>
                  perform(async () =>
                    setPreview(await api({ action: "schedulePreview", plan })),
                  )
                }
              >
                <Clock size={16} />
                预览执行时间
              </button>
              {preview.map((at) => (
                <p key={at}>{timestamp(at)}</p>
              ))}
              <button
                className="wf-primary"
                onClick={() =>
                  perform(async () => {
                    await api({
                      action: "scheduleSave",
                      plan,
                      expectedRevision: plan.revision ?? 0,
                    });
                    setPlan(null);
                  })
                }
              >
                <Save size={16} />
                保存定时任务
              </button>
              {error && (
                <p role="alert" className="wf-error">
                  {error}
                </p>
              )}
            </div>
          </Modal>
        )}
      </div>
    );
  }
  function Panel() {
    const selected = usePanel();
    const data = useData();
    const header = useHeaderDraft();
    const [record, setRecord] = useState(null);
    const [caps, setCaps] = useState(null);
    const [error, setError] = useState("");
    const [trial, setTrial] = useState(false);
    const [input, setInput] = useState({ text: "" });
    const [versions, setVersions] = useState([]);
    const [archived, setArchived] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const load = async () => {
      if (selected.id)
        setRecord(await api({ action: "read", id: selected.id }));
    };
    const revision = data.workflows.find((w) => w.id === selected.id)?.revision;
    useEffect(() => {
      setRecord(null);
      setError("");
      load().catch((e) => setError(e.message));
      api({ action: "capabilities", sessionId: current() })
        .then(setCaps)
        .catch((e) => setError(e.message));
    }, [selected.id]);
    // A conversational edit lands as a new revision through the poll; reload so
    // the canvas and inspector follow the Agent's saved definition.
    useEffect(() => {
      if (selected.id) load().catch((e) => setError(e.message));
    }, [revision]);
    useEffect(() => {
      if (selected.tab === "versions" && selected.id)
        api({ action: "versions", id: selected.id })
          .then(setVersions)
          .catch((e) => setError(e.message));
    }, [selected]);
    const perform = async (fn) => {
      try {
        await fn();
        setError("");
        await refresh();
      } catch (e) {
        setError(e.message);
      }
    };
    const section = selected.tab === "graph" ? "editor" : "app";
    const draft = header.key === `${record?.id}:${record?.revision}` ? header : null;
    const saveFromBar = () =>
      perform(async () => {
        if (draft?.save) await draft.save();
        else
          await api({
            action: "save",
            definition: record.snapshot.definition,
            expectedRevision: record.revision,
          });
        await load();
      });
    return (
      <main className="wf wf-main">
        <header className="wf-appbar">
          {record ? (
            <>
              <Icon
                label="返回工作流列表"
                icon={ArrowLeft}
                onClick={() => openEditor(null)}
              />
              <span
                className={`wf-workflow-icon wf-icon-${record.icon ?? "workflow"}`}
                aria-hidden="true"
              >
                {glyphFor(record.icon, 15)}
              </span>
              <input
                className="wf-appbar-name"
                aria-label="工作流名称"
                disabled={!draft?.rename}
                value={draft?.definition?.name ?? record.name}
                onChange={(e) => draft?.rename?.(e.target.value)}
              />
              <span
                className={`wf-chip ${record.published === record.revision ? "is-published" : ""}`}
              >
                {record.published === record.revision
                  ? `已发布 v${record.revision}`
                  : `草稿 v${record.revision}`}
              </span>
              {section === "editor" && draft && (
                <span className={`wf-chip ${draft.dirty ? "is-dirty" : ""}`}>
                  {draft.dirty ? "未保存" : "已保存"}
                </span>
              )}
              <span className="wf-spacer" />
              <div className="wf-segmented" role="tablist" aria-label="工作流视图">
                <button
                  role="tab"
                  aria-selected={section === "editor"}
                  onClick={() => openEditor(record.id, "graph")}
                >
                  编辑器
                </button>
                <button
                  role="tab"
                  aria-selected={section === "app"}
                  onClick={() => openEditor(record.id, "runs")}
                >
                  应用
                </button>
              </div>
              <button onClick={() => perform(() => bind(record, undefined, "author"))}>
                <MessageSquare size={16} />
                对话修改
              </button>
              <button onClick={() => setTrial(true)}>
                <Play size={16} />
                试运行
              </button>
              <Icon label="保存版本" icon={Save} onClick={() => void saveFromBar()} />
              <button
                className="wf-primary"
                onClick={() =>
                  perform(async () => {
                    await api({
                      action: "publish",
                      id: record.id,
                      revision: record.revision,
                    });
                    await load();
                  })
                }
              >
                <Check size={16} />
                {record.published === record.revision ? "已发布" : "发布版本"}
              </button>
              <Menu
                open={moreOpen}
                onClose={() => setMoreOpen(false)}
                items={[
                  { id: "export", label: "导出定义", icon: <Download size={16} /> },
                  { id: "copy", label: "拷贝工作流", icon: <Copy size={16} /> },
                  { id: "archive", label: record.archived ? "恢复工作流" : "归档工作流", icon: record.archived ? <Undo2 size={16} /> : <Archive size={16} /> },
                  { id: "manage", label: "管理工作流", icon: <Settings2 size={16} /> },
                ]}
                onSelect={(action) => {
                  setMoreOpen(false);
                  if (action === "export")
                    download(`${record.id}.json`, pretty(record.snapshot.definition));
                  if (action === "copy")
                    void perform(async () => {
                      const created = await api({ action: "copy", id: record.id });
                      await refresh();
                      openEditor(created.id);
                    });
                  if (action === "archive")
                    void perform(() =>
                      api({ action: "archive", id: record.id, archived: !record.archived }),
                    );
                  if (action === "manage") openEditor(null);
                }}
                anchor={
                  <button
                    type="button"
                    aria-label="更多工作流操作"
                    aria-expanded={moreOpen}
                    onClick={() => setMoreOpen((v) => !v)}
                  >
                    <MoreHorizontal size={16} />
                  </button>
                }
              />
            </>
          ) : (
            <>
              <span className="wf-workflow-icon" aria-hidden="true">
                <GitBranch size={15} />
              </span>
              <h1>工作流</h1>
              <span className="wf-spacer" />
              <label className="wf-import" title="导入工作流">
                <Upload size={16} />
                <input
                  aria-label="导入工作流"
                  type="file"
                  accept="application/json,.json"
                  onChange={(e) =>
                    perform(async () => {
                      const definition = JSON.parse(
                        await e.target.files[0].text(),
                      );
                      definition.id = `workflow-${crypto.randomUUID()}`;
                      const w = await api({
                        action: "save",
                        definition,
                        expectedRevision: 0,
                      });
                      openEditor(w.id);
                    })
                  }
                />
              </label>
              <button
                className="wf-primary"
                onClick={() => perform(() => beginAuthorSession())}
              >
                <Plus size={16} />
                创建工作流
              </button>
            </>
          )}
        </header>
        {(error || data.error) && (
          <p className="wf-error" role="alert">
            {error || data.error}
          </p>
        )}
        {record ? (
          section === "editor" ? (
            <Editor
              record={record}
              caps={caps}
              save={async (definition, expectedRevision) => {
                await api({ action: "save", definition, expectedRevision });
                await load();
                await refresh();
              }}
            />
          ) : (
            <>
              <nav className="wf-tabs" aria-label="工作流视图">
                {[
                  ["runs", "运行记录"],
                  ["schedules", "定时任务"],
                  ["versions", "版本历史"],
                ].map(([tab, label]) => (
                  <button
                    key={tab}
                    aria-current={selected.tab === tab ? "page" : undefined}
                    onClick={() => openEditor(record.id, tab)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              {selected.tab === "runs" && <Runs id={record.id} />}{" "}
              {selected.tab === "schedules" && (
                <Schedules record={record} caps={caps} />
              )}{" "}
              {selected.tab === "versions" && (
                <div className="wf-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>版本</th>
                        <th>名称</th>
                        <th>时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {versions.map((v) => (
                        <tr key={v.revision}>
                          <td>v{v.revision}</td>
                          <td>{v.definition.name}</td>
                          <td>{timestamp(v.createdAt)}</td>
                          <td>
                            <Icon
                              label={`导出 v${v.revision}`}
                              icon={Download}
                              onClick={() =>
                                download(
                                  `${record.id}-v${v.revision}.json`,
                                  pretty(v.definition),
                                )
                              }
                            />
                            <button
                              onClick={() =>
                                perform(async () => {
                                  await api({
                                    action: "save",
                                    definition: v.definition,
                                    expectedRevision: record.revision,
                                  });
                                  await load();
                                  openEditor(record.id);
                                })
                              }
                            >
                              恢复为新版本
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )
        ) : (
          <Gallery data={data} onError={setError} />
        )}
        {trial && record && (
          <Modal title="试运行" close={() => setTrial(false)}>
            <div className="wf-modal-body">
              <JsonField
                label="输入材料"
                value={input}
                change={setInput}
                rows={12}
              />
              <button
                className="wf-primary"
                onClick={() =>
                  perform(async () => {
                    const sessionId = current() ?? (await newSession());
                    await api({
                      action: "bind",
                      id: record.id,
                      revision: record.revision,
                      sessionId,
                      mode: "author",
                    });
                    await api({
                      action: "run",
                      id: record.id,
                      revision: record.revision,
                      input,
                      sessionId,
                      background: true,
                    });
                    setTrial(false);
                    openEditor(record.id, "runs");
                  })
                }
              >
                <Play size={16} />
                执行 v{record.revision}
              </button>
            </div>
          </Modal>
        )}
      </main>
    );
  }
  // Conversation-side workflow identity: every bound session shows what it is
  // creating, modifying or running as a highlighted composer tag (inside the input
  // card, beside the composer controls), with a way back to the editor.
  function BindingTag({ sessionId }) {
    const data = useData();
    const binding = data.bindings.find((item) => item.sessionId === sessionId);
    const creating = (data.authoring ?? []).some((item) => item.sessionId === sessionId);
    const step = data.stepSessions?.find(item => item.sessionId === sessionId);
    if (step) return null;
    if (!binding && !creating) return null;
    const workflow = binding
      ? data.workflows.find((w) => w.id === binding.workflowId)
      : undefined;
    const authoring = creating || binding?.mode === "author";
    const active = data.runs.find(
      (item) =>
        item.sessionId === sessionId &&
        ["running", "waiting_approval", "waiting_input", "paused"].includes(
          item.status,
        ),
    );
    const latest = data.runs.find(r => r.sessionId === sessionId);
    const recipients = (data.stepSessions ?? []).filter(s => s.runId === latest?.id);
    if (!authoring) return null;
    const name = workflow?.name ?? "新工作流";
    const label = authoring
      ? creating
        ? "正在创建工作流"
        : "正在修改工作流"
      : "工作流运行会话";
    return (
      <span
        className="wf-composer-tag"
        data-mode={authoring ? "author" : "run"}
        data-workflow-tag={binding?.workflowId ?? "new"}
        title={`${label} · ${name}`}
      >
        <button
          type="button"
          className="wf-composer-tag-open"
          aria-label={`${label}：${name}`}
          onClick={() => openEditor(binding?.workflowId ?? null)}
        >
          <Workflow size={13} aria-hidden="true" />
          <strong>{name}</strong>
          {binding && <small>v{binding.revision}</small>}
        </button>
        {!authoring && recipients.length > 0 && <select aria-label="步骤消息接收者" className="wf-recipient" value={binding?.recipient ?? ''} onChange={async e => { await api({ action: 'setRecipient', sessionId, recipient: e.target.value }); await refresh(); }}><option value="">当前步骤</option>{recipients.map(r => <option key={r.sessionId} value={r.sessionId}>{r.name}</option>)}</select>}
        {!authoring && binding && !active && <label className="wf-debug-toggle"><input type="checkbox" checked={Boolean(binding.debug)} onChange={async e => { await api({ action: "setDebug", sessionId, debug: e.target.checked }); await refresh(); }} />逐步调试</label>}
        {active && (
          <span className={`wf-status ${active.status}`}>
            {statuses[active.status] ?? active.status}
          </span>
        )}
        {binding && (
          <button
            type="button"
            className="wf-composer-tag-clear"
            aria-label="结束绑定"
            title="结束绑定"
            onClick={() => void unbind(sessionId)}
          >
            <X size={12} aria-hidden="true" />
          </button>
        )}
      </span>
    );
  }
  ctx.effect(() => {
    const style = document.createElement("style");
    style.dataset.plugin = name;
    style.textContent = flowCss + "\n" + css;
    document.head.appendChild(style);
    return () => style.remove();
  });
  ctx.slots.inject("main", () =>
    ctx.slots.register({ name: "main", key: "workflow-studio" }, Panel),
  );
  ctx.slots.inject("conversation.session", () => {
    const native = ctx.slots.entriesOfSlot("conversation.session")[0];
    if (!native?.component) return;
    const Native = native.component;
    const Wrapped = props => {
      const data = useData();
      const run = data.runs.find(r => r.sessionId === props.sessionId);
      const view = props.useStore(s => s.view);
      const step = data.stepSessions?.find(s => s.sessionId === props.sessionId);
      if (step) return <RunTimeline ctx={ctx} api={api} runId={step.runId} focusNodeId={step.nodeId} openSession={openSession} onChange={refresh} embedded><Native {...props} /></RunTimeline>;
      if (!run) {
        const binding = data.bindings.find(b => b.sessionId === props.sessionId && b.mode !== 'author');
        if (binding) return <><div className="wf wf-timeline"><header className="wf-run-header"><strong>{data.workflows.find(w => w.id === binding.workflowId)?.name}</strong><label className="wf-debug-toggle"><input type="checkbox" checked={Boolean(binding.debug)} onChange={async e => { await api({action:'setDebug',sessionId:props.sessionId,debug:e.target.checked}); await refresh(); }} />逐步调试</label></header></div><Native {...props} /></>;
        return <Native {...props} />;
      }
      if (view === 'trajectory') return <Native {...props} />;
      return <><RunTimeline ctx={ctx} api={api} runId={run.id} openSession={openSession} onChange={refresh} embedded /><details className="wf-root-conversation"><summary>总会话交流</summary><Native {...props} /></details></>;
    };
    native.component = Wrapped;
    return () => { if (native.component === Wrapped) native.component = Native; };
  });
  ctx.slots.inject("conversation.input.left", () =>
    ctx.slots.register(
      {
        name: "conversation.input.left",
        id: "workflow-binding",
        order: 15,
        inject: (sessionId) => ({ sessionId }),
      },
      BindingTag,
    ),
  );
  ctx.slots.inject("shell.overlay", () =>
    ctx.slots.register(
      { name: "shell.overlay", id: "workflow-studio-picker" },
      Picker,
    ),
  );
  ctx.slots.inject("sidebar.workspaces", () => {
    const native = ctx.slots.entriesOfSlot("sidebar.workspaces")[0];
    if (!native?.component)
      throw new Error(
        "Workflow sidebar adapter requires Harness 0.1.5-rc.2 workspace slot",
      );
    // Pinned adapter preserves the native entry's child ownership and store.
    const Native = native.component;
    let enabled = true;
    const subscribers = new Set();
    const Wrapped = (props) => {
      sidebarWide = props.wide;
      const visible = useSyncExternalStore(
        (fn) => {
          subscribers.add(fn);
          return () => subscribers.delete(fn);
        },
        () => enabled,
      );
      return visible ? (
        <div className="wf-workspace-wrapper">
          <Tree wide={props.wide} usePanelInfo={props.usePanelInfo} />
          <Native {...props} />
        </div>
      ) : (
        <Native {...props} />
      );
    };
    native.component = Wrapped;
    return () => {
      enabled = false;
      if (native.component === Wrapped) native.component = Native;
      subscribers.forEach((fn) => fn());
    };
  });
  ctx.commandUi.register({
    name: "workflow",
    description: () => "创建工作流、修改工作流，或选择工作流开始运行",
    available: () => true,
    ui: {
      kind: "popupSelect",
      options: async () => {
        await refresh();
        const items = [
          {
            id: "create",
            label: "创建工作流",
            detail: "通过对话描述目标，Agent 自动生成步骤定义",
          },
        ];
        for (const workflow of snapshot.workflows.filter((w) => !w.archived)) {
          const version = workflow.published ?? workflow.revision;
          items.push({
            id: `run:${workflow.id}`,
            label: `运行「${workflow.name}」`,
            detail: `v${version} · 绑定到当前会话，下一条消息开始运行`,
            active: snapshot.bindings.some(
              (item) => item.workflowId === workflow.id && item.mode === "run",
            ),
          });
          items.push({
            id: `modify:${workflow.id}`,
            label: `修改「${workflow.name}」`,
            detail: `v${workflow.revision} · 开始一个对话修改会话`,
          });
        }
        return items;
      },
      onSelect: async (option, session) => {
        if (option.id === "create") {
          // Authoring continues the conversation that invoked /workflow, so the
          // agent already has the material the user was looking at.
          await beginAuthorSession(session.sessionId);
          return;
        }
        const [action, id] = option.id.split(":");
        const workflow = snapshot.workflows.find((w) => w.id === id);
        if (!workflow) throw new Error("WORKFLOW_NOT_FOUND");
        const authoring = action === "modify";
        await bind(
          workflow,
          authoring ? undefined : session.sessionId,
          authoring ? "author" : "run",
        );
      },
    },
  });
  ctx.effect(() => {
    let timer;
    const poll = async () => {
      if (!document.hidden) await refresh();
      if (!stopped) timer = setTimeout(poll, 2000);
    };
    void refresh();
    void poll();
    if (window.innerWidth < 700) {
      try { ctx.layout.toggleSidebar(); } catch {}
    }
    const resize = () => {if (document.querySelector('.wf-main')) fitNarrowPanel();};
    window.addEventListener('resize', resize);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => {
      stopped = true;
      lifetime.abort();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', visible);
      clearTimeout(timer);
    };
  });
}
