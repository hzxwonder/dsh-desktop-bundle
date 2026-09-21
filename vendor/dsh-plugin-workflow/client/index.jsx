import { StepOutline } from './step-outline.jsx';
import { createGallery } from './gallery.jsx';
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
  AlertTriangle,
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
  publish: "发布",
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
  publish: Send,
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
  // Whether the panel was open belongs to the person, not to the process: the
  // Desktop window is closed and reopened often, and losing the workflow view
  // every time reads as the panel forgetting where it was.
  const panelOpenKey = "workflow-studio:panel-open";
  let panelOpen = (() => {
    try { return localStorage.getItem(panelOpenKey) === "true"; } catch { return false; }
  })();
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
  // A run registers a conversation the host may not have listed yet, and the gallery
  // shows a conversation only once the host knows the session. Whenever the state names
  // a session the list does not hold, ask for the list again so the conversation a run
  // just created becomes visible without reopening the panel.
  const syncSessions = (data) => {
    const known = ctx.sessions.list.getSnapshot().byId;
    const referenced = new Set([
      ...data.references.map((item) => item.sessionId),
      ...data.bindings.map((item) => item.sessionId),
      ...data.runs.map((item) => item.sessionId),
      ...(data.stepSessions ?? []).map((item) => item.sessionId),
    ]);
    if ([...referenced].some((id) => id && !known[id])) void ctx.sessions.refresh();
  };
  const refresh = () => {
    if (stopped) return Promise.resolve();
    if (refreshing) return refreshing;
    refreshing = api({ action: "state" }, AbortSignal.any([
      lifetime.signal, AbortSignal.timeout(15000),
    ]))
      .then((data) => { publish({ ...data, error: "" }); syncSessions(data); })
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
    try { localStorage.setItem(panelOpenKey, String(value)); } catch { /* storage may be unavailable */ }
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
    ctx.uiWorkspace.openSession(id);
    setPanelOpen(false);
    closePicker();
  };
  const bindSession = async (wf, sessionId, mode = "run", revision) => {
    // A session without a workspace opens on the workspace picker, so a conversation
    // started from a card or from 对话修改 is placed in a workspace before it opens:
    // the workflow's own workspace for a run, the shared one for a modification.
    const workspace = sessionId
      ? null
      : mode === "run"
        ? await ensureWorkflowWorkspace(wf.id, wf.name)
        : await ensureWorkflowWorkspace("tmp", "工作流对话");
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
  const Gallery = createGallery({ctx, api, refresh, openSession, openEditor, bind, beginAuthorSession, useSessions, Icon, glyphFor, timestamp});

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
        <Field label="推理强度">
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
  const nodeTypes = {
    workflowNode: ({ data: view, selected: active }) => (
      <div className={`wf-node-card wf-step-${view.kind} ${active ? "is-selected" : ""}`}>
        {view.kind !== 'input' && <Handle type="target" position={Position.Top} />}
        <div className="wf-step-heading">
          <span className="wf-step-glyph">{glyphFor(view.kind, 14)}</span>
          <span className="wf-node-order">{view.order}</span><strong>{view.title}</strong>
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
          {view.repeat && <span className="wf-step-model">未通过返回修订 · 最多 {view.repeat.maxRounds} 轮</span>}
          {view.kind === 'interact' && <span className="wf-step-model">{view.mode}</span>}
        </div>
        <Handle type="source" position={Position.Bottom} />
        <Handle id="retry-in" type="target" position={Position.Right} isConnectable={false} />
        <Handle id="retry-out" type="source" position={Position.Right} isConnectable={false} />
      </div>
    ),
  };

  function Editor({ record, caps, save }) {
    const data = useData();
    const draftKey = `${record.id}:${record.revision}`;
    const [definition, setDefinition] = useState(drafts.get(draftKey) ?? record.snapshot.definition);
    const [selected, setSelected] = useState(definition.nodes[0]?.id);
    const [dirty, setDirty] = useState(drafts.has(draftKey));
    const [panelTab, setPanelTab] = useState("step");
    const [raw, setRaw] = useState(false);
    const [editorView, setEditorView] = useState(() => localStorage.getItem("workflow-studio:editor-view") || "steps");
    const [error, setError] = useState("");
    const [history, setHistory] = useState([]);
    const [clipboard, setClipboard] = useState(null);
    const [run, setRun] = useState(null);
    const [assetsOpen, setAssetsOpen] = useState(false);
    const [notice, setNotice] = useState("");
    const [skillEdit, setSkillEdit] = useState(null);
    const [selectedEdge, setSelectedEdge] = useState(null);
    const flow = React.useRef();
    const flowElement = React.useRef();
    const importInput = React.useRef();
    useEffect(() => {
      if (!flowElement.current) return;
      let frame;
      const observer = new ResizeObserver(() => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => flow.current?.fitView({ padding: 0.18, duration: 0 }));
      });
      observer.observe(flowElement.current);
      return () => { observer.disconnect(); cancelAnimationFrame(frame); };
    }, [raw, editorView]);
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
          x: 100 + (definition.nodes.length % 3) * 400,
          y: 100 + Math.floor(definition.nodes.length / 3) * 300,
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
    const remove = (id = selected) => {
      const index = definition.nodes.findIndex(n => n.id === id);
      if (index < 0) return;
      try {
        const next = removeGraphItems(definition, [id]);
        change(next);
        setSelected(next.nodes[Math.min(index, next.nodes.length - 1)]?.id ?? null);
        setNotice(`已删除“${definition.nodes[index].name}”，可撤销恢复。`);
      } catch (e) { setError(e.message); }
    };
    const undo = () => {
      if (!history.length) return;
      const previous = history.at(-1);
      drafts.set(draftKey, previous);
      setDefinition(previous);
      setHistory(h => h.slice(0, -1));
      setSelected(previous.nodes.some(n => n.id === selected) ? selected : previous.nodes.at(-1)?.id ?? null);
      setDirty(true); setNotice("已撤销，步骤与材料关系已恢复。");
    };
    useEffect(() => {
      const keydown = e => {
        if (!e.target.closest('.wf-editor') || e.target.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
        if (e.key === 'Delete' || e.key === 'Backspace') {
          if (selectedEdge && !selectedEdge.startsWith('repeat:')) { e.preventDefault(); change(removeGraphItems(definition, [], [selectedEdge])); setSelectedEdge(null); setNotice('已删除连接，可撤销恢复。'); }
          else if (selected) { e.preventDefault(); remove(); }
        }
      };
      window.addEventListener('keydown', keydown);
      return () => window.removeEventListener('keydown', keydown);
    }, [definition, selected, selectedEdge]);
    const ranks = Object.fromEntries(definition.nodes.map(n=>[n.id,0]));
    for(let pass=0;pass<definition.nodes.length;pass++) for(const e of definition.edges) if(e.from in ranks && e.to in ranks) ranks[e.to]=Math.max(ranks[e.to],ranks[e.from]+1);
    const lanes = {};
    const graphNodes = definition.nodes.map((n, i) => ({
      id: n.id,
      type: "workflowNode",
      position: {x:80+(lanes[ranks[n.id]]=(lanes[ranks[n.id]] ?? -1)+1)*340,y:60+ranks[n.id]*240},
      data: {
        order: i+1,
        kind: n.kind,
        repeat: n.repeat,
        title: n.name,
        model: n.model?.mode === "explicit" ? n.model.id : "会话模型",
        summary: n.prompt || (n.kind === 'artifact' ? '展示并保存上游步骤的结果' : '配置此步骤的执行行为'),
        mode: n.kind === 'interact' ? (n.interaction === 'goal' ? '交互目标' : '交互一次') : undefined,
        references: Object.values(n.input ?? {}).filter(r => r.source === 'node').map(r => definition.nodes.find(x => x.id === r.nodeId)).filter(Boolean),
      },
      className: `wf-node wf-node-${n.kind}`,
      selected: n.id === selected,
    }));
    const visibleEdges = definition.edges.filter(edge => {
      if (edge.on && edge.on !== 'success') return true;
      const seen = new Set();
      const reaches = id => { if(id===edge.to) return true; if(seen.has(id)) return false; seen.add(id); return definition.edges.filter(e=>e!==edge && e.from===id && (!e.on || e.on==='success')).some(e=>reaches(e.to)); };
      return !reaches(edge.from);
    });
    const graphEdges = visibleEdges.map((e) => ({
      id: `${e.from}:${e.to}`,
      source: e.from,
      target: e.to,
      label: e.on === "true" ? "是" : e.on === "false" ? "否" : undefined,
      className: e.on === "false" ? "wf-edge-dashed" : undefined,
    })).concat(definition.nodes.filter(n=>n.repeat?.target).map(n=>({id:`repeat:${n.id}`,source:n.id,target:n.repeat.target,sourceHandle:'retry-out',targetHandle:'retry-in',type:'smoothstep',label:`未通过，返回修改 · 最多 ${n.repeat.maxRounds} 轮`,className:'wf-edge-loop',deletable:false})));
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
        <div className="wf-editor-viewbar"><div className="wf-segmented" role="tablist" aria-label="步骤展示方式">{[["steps","步骤列表"],["graph","流程图"]].map(([id,label])=><button key={id} role="tab" aria-selected={editorView===id} onClick={()=>{setEditorView(id);setRaw(false);localStorage.setItem("workflow-studio:editor-view",id);}}>{label}</button>)}</div></div>
        {notice && <div className="wf-editor-notice" role="status"><span>{notice}</span><button disabled={!history.length} onClick={undo}>撤销</button><Icon label="关闭提示" icon={X} onClick={()=>setNotice("")} /></div>}
        {skillEdit && <Modal title={`编辑 skill · ${skillEdit.name}`} close={()=>setSkillEdit(null)}><textarea className="wf-skill-content" aria-label="Skill 内容" value={skillEdit.content} onChange={e=>setSkillEdit({...skillEdit,content:e.target.value})}/><button className="wf-primary" onClick={()=>{update({skillOverrides:{...node.skillOverrides,[skillEdit.name]:skillEdit.content}});setSkillEdit(null);}}>应用到步骤</button></Modal>}
        {assetsOpen && <Modal title="添加步骤" close={()=>setAssetsOpen(false)}><div className="wf-modal-body"><div className="wf-step-picker" role="menu" aria-label="更多步骤选项">{Object.entries(labels).filter(([kind])=>!["input","interact","agent","artifact"].includes(kind)).map(([kind,label])=><button key={kind} role="menuitem" onClick={()=>{setAssetsOpen(false);add(kind);}}>{glyphFor(kind,20)}<span>{label}</span></button>)}</div></div></Modal>}
        <div className="wf-editor-body">
          <div className="wf-stage">
            <div className="wf-canvas">
              <div className="wf-addbar" role="toolbar" aria-label="添加步骤">
                {Object.entries(labels).filter(([kind]) => ["input", "interact", "agent", "artifact"].includes(kind)).map(([kind, label]) => (
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
                <button aria-label="更多步骤" aria-expanded={assetsOpen} onClick={()=>setAssetsOpen(true)}><Plus size={14}/>更多步骤</button>

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
              ) : editorView === "steps" ? (
                <StepOutline definition={definition} selected={selected} onDelete={remove} onSelect={id=>{setSelectedEdge(null);setSelected(id);setPanelTab("step");}} />
              ) : (
                <div
                  className="wf-flow"
                  ref={flowElement}
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
                    nodesDraggable={false}
                    deleteKeyCode={null}
                    fitView
                    fitViewOptions={{ padding: 0.18 }}
                    minZoom={0.2}
                    maxZoom={2}
                    onNodeClick={(_, n) => { setSelectedEdge(null); setSelected(n.id); setPanelTab("step"); }}
                    onEdgeClick={(_, e) => { setSelected(null); setSelectedEdge(e.id); }}
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
                        change(removeGraphItems(definition, [], changes.filter(c=>c.type==='remove' && !c.id.startsWith('repeat:')).map(c=>c.id)));
                      }
                    }}
                    onConnect={(connection) => {
                      try {
                        change(connectReference(definition, connection.source, connection.target).definition);
                      } catch (e) { setError(e.message); }
                    }}
                  >
                    <Controls />

                  </ReactFlow>
                </div>
              )}
              <div className="wf-canvas-tools">
                {editorView === 'graph' && <button onClick={()=>flow.current?.fitView({padding:0.22,duration:0})}>查看全图</button>}
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
                  onClick={undo}
                />
                <Icon
                  label={raw ? "返回画布" : "编辑 JSON"}
                  icon={FileText}
                  aria-pressed={raw}
                  onClick={() => setRaw((v) => !v)}
                />
              </div>
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
                <button className="wf-delete-step" aria-label="删除节点" title="删除此步骤，可撤销恢复" onClick={()=>remove()}><Trash2 size={15} />删除</button>
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
                {(node.kind === 'agent' || (node.kind === 'interact' && node.interaction === 'goal')) && (
                  <details className="wf-routing-settings"><summary>模型与执行设置 · {node.model?.mode === 'explicit' ? node.model.id : '继承会话'}</summary><Routing node={node} update={update} caps={caps} /></details>
                )}
                {node.kind === "agent" && (
                  <details className="wf-settings-group"><summary>技能与工具 <small>{(node.skills?.length ?? 0) + (node.tools?.length ?? 0)} 项</small></summary>
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
                    <div className="wf-skill-edit-links">{(node.skills ?? []).map(name=><button key={name} onClick={async()=>{try{const result=await api({action:'skillRead',name});setSkillEdit({name,content:node.skillOverrides?.[name] ?? result.content});}catch(e){setError(e.message);}}}><Pencil size={14}/>编辑 {name}</button>)}</div>
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
                  </details>
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
                  </>
                )}
                <datalist id="wf-tools">
                  {(caps?.tools ?? []).map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>

                {node.kind === 'agent' && <details className="wf-review-settings"><summary><span>评审与循环</span><span className="wf-setting-value">{node.repeat ? "已开启" : "未开启"}</span></summary>
                  <label><input type="checkbox" checked={Boolean(node.repeat)} onChange={e => { if (e.target.checked) update({ repeat: { target: definition.nodes.find(n => n.id !== node.id && n.kind === 'agent')?.id ?? '', until: { '>=': [{ var: 'score' }, 85] }, maxRounds: 3, sessionMode: 'new' } }); else { const next = { ...node }; delete next.repeat; change({ ...definition, nodes: definition.nodes.map(n => n.id === node.id ? next : n) }); } }} />根据结果返回修订</label>
                  {node.repeat && <>
                    <Field label="返回步骤"><select value={node.repeat.target} onChange={e => update({ repeat: { ...node.repeat, target: e.target.value } })}><option value="">选择上游步骤</option>{definition.nodes.filter(n => n.id !== node.id && n.kind === 'agent').map(n => <option key={n.id} value={n.id}>{n.name}</option>)}</select></Field>
                    <Field label="每轮会话"><select value={node.repeat.sessionMode} onChange={e => update({ repeat: { ...node.repeat, sessionMode: e.target.value } })}><option value="new">新建会话，传入材料与反馈</option><option value="continue">接着上次会话继续</option></select></Field>
                    <Field label="最多评审轮数"><input type="number" min="1" max="20" value={node.repeat.maxRounds} onChange={e => update({ repeat: { ...node.repeat, maxRounds: Number(e.target.value) } })} /></Field>
                    <JsonField label="通过条件" value={node.repeat.until} change={until => update({ repeat: { ...node.repeat, until } })} />
                                      </>}
                </details>}
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
                        openSession(r.sessionId);
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
                        openSession(detail.run.sessionId);
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
                  <p>恢复会重新执行未完成节点。</p>
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
    const perform = async (fn, label = "") => {
      if (busy) return;
      if (label) setBusy(label);
      try {
        await fn();
        setError("");
        await refresh();
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy("");
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
              <Field label="推理强度">
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
    // One action at a time: without this a second click during a slow round trip
    // starts a second authoring session, run or copy of the same workflow.
    const [busy, setBusy] = useState("");
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
                  运行记录
                </button>
              </div>
              <button onClick={() => perform(() => bind(record, undefined, "author"))}>
                <MessageSquare size={16} />
                对话修改
              </button>
              <label className="wf-editor-debug"><input type="checkbox" aria-label="逐步调试" checked={Boolean(data.workflows.find(w => w.id === record.id)?.debug)} onChange={e => perform(() => api({ action: 'setWorkflowDebug', id: record.id, debug: e.target.checked }))} />逐步调试</label>
              <button className="wf-primary" onClick={() => setTrial(true)}>
                <Play size={16} />
                试运行
              </button>
              <Icon label="保存版本" icon={Save} onClick={() => void saveFromBar()} />
              <button
                disabled={record.published === record.revision || Boolean(draft?.dirty)}
                title={draft?.dirty ? "先保存修改，再发布版本" : "将保存的版本用于后续任务"}
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
                    }, "copy");
                  if (action === "archive")
                    void perform(
                      () =>
                        api({ action: "archive", id: record.id, archived: !record.archived }),
                      "archive",
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
                disabled={busy === "create"}
                aria-busy={busy === "create"}
                onClick={() => perform(() => beginAuthorSession(), "create")}
              >
                <Plus size={16} />
                {busy === "create" ? "正在创建…" : "创建工作流"}
              </button>
            </>
          )}
        </header>
        {(error || data.error) && (
          <div className="wf-error-bar" role="alert">
            <AlertTriangle size={15} aria-hidden="true" />
            <p className="wf-error">
              {error || data.error}
            </p>
            <button
              type="button"
              onClick={() => {
                setError("");
                void load().catch((e) => setError(e.message));
                void refresh();
              }}
            >
              <RefreshCw size={14} aria-hidden="true" />
              重试
            </button>
            <Icon label="关闭提示" icon={X} onClick={() => setError("")} />
          </div>
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
      if (!run) return <Native {...props} />;
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
    // Polling exists so an Agent's saved revision shows up while a person watches
    // the panel. With the panel closed there is nothing to keep current, so the
    // loop parks and the renderer stops talking to the backend twice a second.
    const poll = async () => {
      if (!document.hidden && panelOpen) await refresh();
      if (!stopped) timer = setTimeout(poll, 2000);
    };
    void refresh();
    void poll();
    if (window.innerWidth < 700) {
      try { ctx.layout.toggleSidebar(); } catch {}
    }
    // The panel is host layout state, so remembering the flag is not enough: after a
    // reload or a window restart the plugin has to ask for the panel back, or the
    // window comes up with the workflow surface closed every time.
    if (panelOpen) {
      try { ctx.layout.selectPanel("workflow-studio"); } catch { /* the host may not offer a panel slot */ }
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
