import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { EditorState } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  drawSelection,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  StreamLanguage,
  syntaxHighlighting,
  HighlightStyle,
} from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import * as pdfjs from "pdfjs-dist";
import css from "./style.css";
import logic from "../lib/logic.cjs";
export const name = "dsh-plugin-latex";
export const inject = [
  "slots",
  "layout",
  "sessions",
  "workspaces",
  "uiWorkspace",
];
const api = async (args) => {
  const r = await fetch("/api/latex-studio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const data = await r.json();
  if (!data.ok)
    throw Object.assign(new Error(data.detail || data.error), {
      code: data.error,
    });
  return data.value;
};
const uid = () => crypto.randomUUID();
export function Editor({ file, onChange, onSelect, jump }) {
  const host = useRef(),
    view = useRef(),
    handlers = useRef({ onChange, onSelect });
  handlers.current = { onChange, onSelect };
  useEffect(() => {
    if (!file) return;
    let selecting = false, pointerAnchor = null;
    const reportSelection = (v) => v.requestMeasure({
      read: () => {
        const { from, to } = v.state.selection.main;
        const rect = from !== to ? v.coordsAtPos(to) : null;
        return rect ? { start: from, end: to, text: v.state.sliceDoc(from, to), x: rect.left, y: rect.bottom } : null;
      },
      write: (value) => { if (!selecting) handlers.current.onSelect(value); },
    });
    const finishSelection = () => { selecting = false; reportSelection(v); };
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: file.content,
        extensions: [
          lineNumbers(),
          EditorView.contentAttributes.of({ "aria-label": "LaTeX 源码", spellcheck: "false" }),
          EditorView.domEventHandlers({
            pointerdown: (event, editor) => {
              if (event.button !== 0 || event.pointerType === "touch" || !event.target.closest(".cm-content")) return false;
              const pos = editor.posAtCoords({ x: event.clientX, y: event.clientY });
              if (pos == null) return false;
              selecting = true;
              handlers.current.onSelect(null);
              pointerAnchor = event.shiftKey ? editor.state.selection.main.anchor : pos;
              editor.focus();
              editor.dispatch({ selection: { anchor: pointerAnchor, head: pos } });
              editor.contentDOM.setPointerCapture(event.pointerId);
              event.preventDefault();
              return true;
            },
            pointermove: (event, editor) => {
              if (!selecting || pointerAnchor == null) return false;
              const pos = editor.posAtCoords({ x: event.clientX, y: event.clientY }, false);
              if (pos != null) editor.dispatch({ selection: { anchor: pointerAnchor, head: pos }, scrollIntoView: true });
              return true;
            },
            pointerup: (event, editor) => {
              if (editor.contentDOM.hasPointerCapture(event.pointerId)) editor.contentDOM.releasePointerCapture(event.pointerId);
              pointerAnchor = null;
              return false;
            },
            dblclick: (event, editor) => {
              const pos = editor.posAtCoords({ x: event.clientX, y: event.clientY });
              const word = pos == null ? null : editor.state.wordAt(pos);
              if (word) editor.dispatch({ selection: { anchor: word.from, head: word.to } });
              return !!word;
            },
          }),
          history(),
          drawSelection(),
          highlightActiveLine(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          StreamLanguage.define(stex),
          syntaxHighlighting(
            HighlightStyle.define([
              { tag: tags.comment, color: "var(--lp-code-comment)" },
              {
                tag: [
                  tags.keyword,
                  tags.tagName,
                  tags.function(tags.variableName),
                ],
                color: "var(--lp-code-command)",
              },
              {
                tag: [tags.string, tags.atom, tags.number],
                color: "var(--lp-code-value)",
              },
              { tag: tags.bracket, color: "var(--lp-text)" },
            ]),
          ),
          EditorView.lineWrapping,
          EditorView.theme({
            "&": { height: "100%" },
            ".cm-scroller": {
              overflow: "auto",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "13px",
            },
            ".cm-content": { padding: "14px 0" },
            ".cm-gutters": {
              backgroundColor: "var(--lp-editor)",
              color: "var(--lp-muted)",
              border: "none",
            },
            ".cm-activeLine": { backgroundColor: "var(--lp-hover)" },
            ".cm-activeLineGutter": { backgroundColor: "var(--lp-hover)" },
          }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) handlers.current.onChange(u.state.doc.toString());
            if (u.selectionSet || u.docChanged || u.viewportChanged) {
              if (!selecting) reportSelection(u.view);
            }
          }),
        ],
      }),
    });
    document.addEventListener("pointerup", finishSelection);
    document.addEventListener("pointercancel", finishSelection);
    view.current = v;
    return () => {
      document.removeEventListener("pointerup", finishSelection);
      document.removeEventListener("pointercancel", finishSelection);
      v.destroy();
      view.current = null;
    };
  }, [file?.name, file?.loadKey]);
  useEffect(() => {
    if (!jump || !view.current) return;
    const v = view.current;
    v.dispatch({
      selection: {
        anchor: Math.min(jump.start, v.state.doc.length),
        head: Math.min(jump.end, v.state.doc.length),
      },
      effects: EditorView.scrollIntoView(
        Math.min(jump.start, v.state.doc.length),
        { y: "center" },
      ),
    });
    v.focus();
  }, [jump]);
  return <div className="lp-editor" ref={host} />;
}
function PDF({ base64, zoom = 1 }) {
  const host = useRef();
  const [error, setError] = useState("");
  useEffect(() => {
    if (!base64) return;
    let stopped = false,
      doc,
      task,
      workerURL;
    const renders = [];
    setError("");
    host.current.replaceChildren();
    (async () => {
      try {
        workerURL = URL.createObjectURL(
          new Blob([await api({ action: "worker" })], {
            type: "text/javascript",
          }),
        );
        if (stopped) {
          URL.revokeObjectURL(workerURL);
          return;
        }
        pdfjs.GlobalWorkerOptions.workerSrc = workerURL;
        task = pdfjs.getDocument({
          data: Uint8Array.from(atob(base64), (x) => x.charCodeAt(0)),
          isEvalSupported: false,
        });
        doc = await task.promise;
        for (let i = 1; i <= doc.numPages && !stopped; i++) {
          const page = await doc.getPage(i);
          if (stopped) break;
          const width = Math.max(250, host.current.clientWidth - 32),
            unit = page.getViewport({ scale: 1 }),
            vp = page.getViewport({
              scale:
                Math.min(1.7, width / unit.width) * zoom * devicePixelRatio,
            }),
            canvas = document.createElement("canvas");
          canvas.width = vp.width;
          canvas.height = vp.height;
          canvas.style.width = vp.width / devicePixelRatio + "px";
          canvas.style.maxWidth = "none";
          canvas.style.height = "auto";
          canvas.setAttribute("aria-label", "PDF 第 " + i + " 页");
          host.current.append(canvas);
          const render = page.render({
            canvasContext: canvas.getContext("2d"),
            viewport: vp,
          });
          renders.push(render);
          await render.promise;
        }
      } catch (e) {
        if (!stopped) setError(e.message);
      }
    })();
    return () => {
      stopped = true;
      renders.forEach((t) => t.cancel());
      task?.destroy();
      if (workerURL) URL.revokeObjectURL(workerURL);
    };
  }, [base64, zoom]);
  return (
    <div className="lp-pdf-scroll">
      <div role="alert">{error}</div>
      <div ref={host} />
      {!base64 && (
        <div className="lp-empty">点击源码右上角「编译」预览论文</div>
      )}
    </div>
  );
}
export function MindMap({ data, onLocate }) {
  const scroll = useRef(),
    canvas = useRef(),
    drag = useRef();
  const [fold, setFold] = useState(new Set()),
    [scale, setScale] = useState(0.8),
    [selected, setSelected] = useState(null),
    [edges, setEdges] = useState([]);
  const nodes = data?.nodes || [],
    root = nodes.find((n) => n.type === "paper"),
    children = (id) => nodes.filter((n) => n.parent === id);
  useLayoutEffect(() => {
    const plane = canvas.current;
    const measure = () => {
      const base = plane.getBoundingClientRect();
      const visible = new Map([...plane.querySelectorAll("[data-node-id]")].map(el => [el.dataset.nodeId, el.getBoundingClientRect()]));
      setEdges(nodes.flatMap(n => {
        const a = visible.get(n.parent), b = visible.get(n.id);
        if (!a || !b) return [];
        const x1 = (a.right - base.left) / scale, y1 = (a.top + a.height / 2 - base.top) / scale;
        const x2 = (b.left - base.left) / scale, y2 = (b.top + b.height / 2 - base.top) / scale;
        const mid = (x1 + x2) / 2;
        return [{ id: n.id, d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}` }];
      }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(plane);
    return () => observer.disconnect();
  }, [data, fold, scale]);
  const branch = (n, depth = 0) => (
    <div className={"lp-branch depth-" + depth} key={n.id}>
      <div className="lp-node-wrap">
        <button data-node-id={n.id} className="lp-node" aria-pressed={selected === n.id}
          onClick={() => setSelected(n.id)} onDoubleClick={() => onLocate(n)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onLocate(n); } }}
          title="双击定位原文">
          {n.label}
        </button>
        {children(n.id).length > 0 && (
          <button
            className="lp-fold"
            aria-label={(fold.has(n.id) ? "展开 " : "收起 ") + n.label}
            aria-expanded={!fold.has(n.id)}
            onClick={() =>
              setFold((old) => {
                const v = new Set(old);
                v.has(n.id) ? v.delete(n.id) : v.add(n.id);
                return v;
              })
            }
          >
            {fold.has(n.id) ? "+" : "−"}
          </button>
        )}
      </div>
      {!fold.has(n.id) && children(n.id).length > 0 && (
        <div className="lp-children">
          {children(n.id).map((c) => branch(c, depth + 1))}
        </div>
      )}
    </div>
  );
  return (
    <div className="lp-map">
      <div
        ref={scroll}
        className="lp-map-scroll"
        onPointerDown={(e) => {
          if (e.target.closest("button")) return;
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            left: e.currentTarget.scrollLeft,
            top: e.currentTarget.scrollTop,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          e.currentTarget.scrollLeft =
            drag.current.left - e.clientX + drag.current.x;
          e.currentTarget.scrollTop =
            drag.current.top - e.clientY + drag.current.y;
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey)
            setScale((v) =>
              Math.max(0.3, Math.min(1.6, v + (e.deltaY > 0 ? -0.05 : 0.05))),
            );
        }}
      >
        <div
          ref={canvas}
          className="lp-map-plane"
          style={{ zoom: scale, padding: 40, width: "max-content" }}
        >
          <svg className="lp-map-edges" aria-hidden="true">{edges.map(e => <path key={e.id} d={e.d} />)}</svg>
          {root ? branch(root) : <p>生成导图，梳理论文的章节、段落与句子。</p>}
        </div>
      </div>
      <div className="lp-map-zoom">
        <button onClick={() => setScale(Math.max(0.3, scale - 0.1))}>−</button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale(Math.min(1.6, scale + 0.1))}>＋</button>
        <button
          onClick={() => {
            const area = scroll.current,
              rect = canvas.current.getBoundingClientRect();
            setScale(
              Math.max(
                0.3,
                Math.min(
                  1.2,
                  scale *
                    Math.min(
                      area.clientWidth / rect.width,
                      area.clientHeight / rect.height,
                    ),
                ),
              ),
            );
            area.scrollTo(0, 0);
          }}
        >
          适合画布
        </button>
      </div>
    </div>
  );
}
export function apply(ctx) {
  let pendingDraft = null,
    returnSession = null;
  const draftKey = "dsh-latex-drafts-v1";
  let cached = [];
  try {
    cached = JSON.parse(localStorage.getItem(draftKey) || "[]");
  } catch {}
  const drafts = new Map(cached);
  const persistDrafts = () => {
    try {
      localStorage.setItem(draftKey, JSON.stringify([...drafts]));
    } catch {}
  };
  let activeId = null;
  const bus = new EventTarget();
  function InputBridge({ sessionId, useInput, inputActions }) {
    const draft = useInput((s) => s.draft);
    const latest = useRef(draft);
    latest.current = draft;
    useEffect(() => {
      const apply = () => {
        if (pendingDraft?.sessionId === sessionId) {
          const next = pendingDraft;
          pendingDraft = null;
          latest.current = [latest.current, next.text]
            .filter(Boolean)
            .join("\n\n");
          inputActions.setDraft(latest.current);
        }
      };
      bus.addEventListener("draft", apply);
      apply();
      return () => bus.removeEventListener("draft", apply);
    }, [sessionId, inputActions]);
    return null;
  }
  const open = () => {
    if (!activeId) returnSession = ctx.sessions.list.getSnapshot().current;
    ctx.layout.selectPanel("latex-studio");
  };
  function Entry() {
    return (
      <button
        className="lp-entry"
        title="论文工作台"
        aria-label="论文工作台"
        onClick={open}
      >
        ▧ 论文工作台
      </button>
    );
  }
  function NativeChat({ sessionId }) {
    const surface = useMemo(() => {
      const registry = ctx.slots;
      if (!registry.hostFace || !registry._renderer) return null;
      const base = registry.hostFace(),
        adapter = base.scope("session"),
        binding = adapter?.resolve(sessionId);
      if (!binding) return null;
      const current = { getSnapshot: () => binding, subscribe: () => () => {} };
      const slot = "main.conversation";
      const entry = {
        component: (props) => props.renderSlot(slot, {}),
        options: {},
        children: {
          [slot]: { kind: "single", scope: "session-maybe" },
        },
      };
      const host = {
        ...base,
        scope: () => ({
          ...adapter,
          current,
          resolve: (id) => adapter.resolve(id),
        }),
        entriesOf: (key) => (key === "root" ? [entry] : base.entriesOf(key)),
        entriesOfSlot: (key) =>
          key === "root" ? [entry] : base.entriesOfSlot(key),
        isLive: (value) => value === entry || base.isLive(value),
        storeOf: (value, scope) =>
          value === entry ? undefined : base.storeOf(value, scope),
      };
      return registry._renderer.renderRoot(host, {});
    }, [sessionId]);
    return (
      surface || <p>当前 Harness 版本未提供嵌入聊天接口，请返回主会话继续。</p>
    );
  }
  function Panel() {
    const [projects, setProjects] = useState([]),
      [p, setP] = useState(null),
      [files, setFiles] = useState([]),
      [file, setFile] = useState(null),
      [tabs, setTabs] = useState([]),
      [nav, setNav] = useState("files"),
      [chatOpen, setChatOpen] = useState(false),
      [newName, setNewName] = useState(null),
      [newError, setNewError] = useState(""),
      [selected, setSelected] = useState(new Set()),
      [selection, setSelection] = useState(null),
      [comment, setComment] = useState(null),
      [commentText, setCommentText] = useState(""),
      [jump, setJump] = useState(null),
      [busy, setBusy] = useState(false),
      [status, setStatus] = useState(""),
      [error, setError] = useState(""),
      [pdf, setPdf] = useState(null),
      [pdfZoom, setPdfZoom] = useState(1),
      [map, setMap] = useState(null),
      [view, setView] = useState("source"),
      [split, setSplit] = useState(55),
      [sideHidden, setSideHidden] = useState(false),
      [job, setJob] = useState(null),
      [showLog, setShowLog] = useState(false),
      [form, setForm] = useState(null),
      [title, setTitle] = useState(""),
      [path, setPath] = useState(""),
      [query, setQuery] = useState(""),
      [theme, setTheme] = useState(
        () => localStorage.getItem("dsh-latex-theme") || "system",
      ),
      [conflict, setConflict] = useState(null);
    const pRef = useRef(p),
      fileRef = useRef(file),
      serial = useRef(0),
      selectedAll = useRef(),
      jobHandled = useRef(""),
      chatPending = useRef(null),
      mounted = useRef(true);
    pRef.current = p;
    fileRef.current = file;
    const sessions = useSyncExternalStore(
      ctx.sessions.list.subscribe,
      ctx.sessions.list.getSnapshot,
    );
    useEffect(() => {
      mounted.current = true;
      api({ action: "list" })
        .then(setProjects)
        .catch((e) => setError(e.message));
      return () => {
        mounted.current = false;
        const f = fileRef.current;
        if (f && pRef.current) drafts.set(pRef.current.id + ":" + f.name, f);
      };
    }, []);
    useEffect(() => {
      if (selectedAll.current) {
        selectedAll.current.indeterminate =
          selected.size > 0 && selected.size < (p?.reviews?.length || 0);
      }
    }, [selected, p]);
    const safe =
      (fn) =>
      async (...args) => {
        setError("");
        try {
          return await fn(...args);
        } catch (e) {
          setError(e.message);
          return null;
        }
      };
    async function save() {
      const current = fileRef.current,
        project = pRef.current;
      if (!current || !current.dirty) return current;
      try {
        const saved = await api({
          action: "save",
          id: project.id,
          file: current.name,
          content: current.content,
          hash: current.hash,
        });
        drafts.delete(project.id + ":" + current.name);
        persistDrafts();
        if (
          pRef.current?.id === project.id &&
          fileRef.current?.name === current.name
        ) {
          if (fileRef.current.content === current.content)
            setFile({ ...saved, loadKey: current.loadKey });
          else setFile((f) => ({ ...f, hash: saved.hash, dirty: true }));
        }
        setStatus("已保存");
        return saved;
      } catch (e) {
        if (e.code === "CONFLICT") setConflict(current);
        throw e;
      }
    }
    async function load(name, project = pRef.current) {
      if (!project || !name) return;
      await save();
      const token = ++serial.current,
        cache = drafts.get(project.id + ":" + name),
        loaded =
          cache || (await api({ action: "read", id: project.id, file: name }));
      if (token !== serial.current || pRef.current?.id !== project.id) return;
      const next = { ...loaded, loadKey: uid() };
      fileRef.current = next;
      setFile(next);
      setTabs((v) => (v.includes(name) ? v : [...v, name]));
      setSelection(null);
      setStatus(cache?.dirty ? "未保存" : "已保存");
    }
    async function choose(project) {
      await save();
      setForm(null);
      serial.current++;
      setP(project);
      pRef.current = project;
      activeId = project.id;
      setFile(null);
      fileRef.current = null;
      setPdf(null);
      setMap(null);
      setTabs([]);
      setSelected(new Set());
      setChatOpen(false);
      setView("source");
      setStatus("");
      setConflict(null);
      const data = await api({ action: "open", id: project.id });
      if (pRef.current?.id !== project.id) return;
      setP(data.project);
      pRef.current = data.project;
      setFiles(data.files);
      await load(
        data.files.find((f) => f.name === data.project.main)?.name ||
          data.files.find((f) => f.editable)?.name,
        data.project,
      );
      const old = await api({ action: "pdf", id: project.id });
      if (pRef.current?.id === project.id) setPdf(old?.pdf || null);
      const m = await api({ action: "map", id: project.id });
      if (pRef.current?.id === project.id) setMap(m);
    }
    async function update(patch) {
      const project = pRef.current,
        result = await api({ action: "update", id: project.id, patch });
      if (pRef.current?.id === project.id) {
        setP(result);
        pRef.current = result;
      }
      return result;
    }
    async function ensureChat(force = false) {
      if (chatPending.current) return chatPending.current;
      const work = connectChat(force);
      chatPending.current = work;
      try {
        return await work;
      } finally {
        chatPending.current = null;
      }
    }
    async function connectChat(force = false) {
      await save();
      const project = pRef.current;
      let id = force ? null : project.lastChat;
      if (!id) {
        const existing = ctx.workspaces.list
          .getSnapshot()
          .items.find((w) => w.path === project.root);
        const workspace =
          existing ||
          (await ctx.uiWorkspace.workspaces.create({ path: project.root }));
        if (!existing)
          await ctx.uiWorkspace.workspaces.rename(
            workspace.workspaceId,
            project.name,
          );
        const created = await ctx.sessions.create({
          workspaceId: workspace.workspaceId,
        });
        id =
          typeof created === "string"
            ? created
            : created.sessionId || created.id;
        await update({
          chat: { id, title: "论文对话 " + (project.chats.length + 1) },
        });
      }
      await ctx.sessions.open(id);
      ctx.layout.selectPanel("latex-studio");
      setView("source");
      setChatOpen(true);
      return id;
    }
    async function draft(text) {
      const sessionId = await ensureChat();
      pendingDraft = {
        sessionId,
        text:
          pendingDraft?.sessionId === sessionId
            ? pendingDraft.text + "\n\n" + text
            : text,
      };
      bus.dispatchEvent(new Event("draft"));
    }
    async function reviewDraft(items) {
      if (!items.length) return;
      await draft(
        "请根据以下审阅意见完善论文，先说明修改方案，核对原文后修改：\n" +
          items
            .map(
              (r) =>
                "文件：" +
                r.file +
                "\n原文：" +
                r.text +
                "\n审阅意见：" +
                r.messages.join("；"),
            )
            .join("\n\n"),
      );
    }
    useEffect(() => {
      if (!p) return;
      let stopped = false;
      const poll = async () => {
        try {
          const j = await api({
            action: "job",
            id: p.id,
            after: jobHandled.current,
          });
          if (stopped || j?.unchanged) return;
          setJob(j);
          if (
            j?.status === "completed" &&
            jobHandled.current !== p.id + ":" + j.version
          ) {
            jobHandled.current = p.id + ":" + j.version;
            if (j.kind === "compile") {
              setPdf(j.result.pdf);
              setStatus(
                j.result.stale ? "PDF 已生成 · 源码有更新" : "编译完成",
              );
            } else {
              setMap(j.result);
              const latest = await api({ action: "open", id: p.id });
              if (stopped) return;
              setP(latest.project);
              pRef.current = latest.project;
              const liveFile = await api({
                action: "read",
                id: p.id,
                file: j.result.file.name,
              });
              if (
                !stopped &&
                fileRef.current?.name === liveFile.name &&
                !fileRef.current.dirty
              ) {
                const next = { ...liveFile, loadKey: uid() };
                fileRef.current = next;
                setFile(next);
              }
              setStatus("行文导图已更新");
            }
          }
          if (j?.status === "failed") {
            jobHandled.current = p.id + ":" + j.version;
            setError(j.error || j.result?.error || "任务失败");
          }
        } catch (e) {
          if (!stopped) setError(e.message);
        }
      };
      poll();
      const timer = setInterval(poll, 1600);
      return () => {
        stopped = true;
        clearInterval(timer);
      };
    }, [p?.id]);
    useEffect(() => {
      if (!p || !file) return;
      const id = p.id,
        name = file.name;
      let stopped = false;
      const timer = setInterval(async () => {
        try {
          const disk = await api({ action: "read", id, file: name });
          if (stopped || fileRef.current?.name !== name) return;
          const current = fileRef.current;
          if (disk.hash !== current.hash) {
            if (current.dirty) setStatus("磁盘文件已变化 · 保存前请合并");
            else {
              setFile({ ...disk, loadKey: uid() });
              setStatus("已同步 Agent / 外部修改");
            }
          }
        } catch {}
      }, 3500);
      return () => {
        stopped = true;
        clearInterval(timer);
      };
    }, [p?.id, file?.name]);
    useEffect(() => {
      const handle = (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "s" && pRef.current) {
          e.preventDefault();
          save().catch((e) => setError(e.message));
        }
      };
      window.addEventListener("keydown", handle);
      return () => window.removeEventListener("keydown", handle);
    }, []);
    const changed = (text) => {
      const f = fileRef.current;
      if (!f) return;
      const next = { ...f, content: text, dirty: true };
      setFile(next);
      fileRef.current = next;
      drafts.set(pRef.current.id + ":" + f.name, next);
      persistDrafts();
      setStatus("未保存");
    };
    async function start(kind) {
      await save();
      let sessionId;
      if (kind === "analyze") sessionId = await ensureChat();
      setChatOpen(false);
      if (kind === "analyze") setView("map");
      await api({ action: kind, id: pRef.current.id, sessionId });
      setJob({ kind, status: "running" });
      setShowLog(false);
    }
    async function addComment() {
      if (!commentText.trim()) return;
      const f = fileRef.current;
      if (!f || f.content.slice(comment.start, comment.end) !== comment.text)
        throw new Error("原文已变化，请重新选择");
      await save();
      await update({
        reviews: [
          ...pRef.current.reviews,
          {
            id: uid(),
            file: f.name,
            ...comment,
            messages: [commentText.trim()],
            resolved: false,
          },
        ],
      });
      setComment(null);
      setCommentText("");
      setNav("reviews");
      setSelection(null);
    }
    async function jumpReview(r) {
      await load(r.file);
      const doc = fileRef.current;
      const data = await api({
        action: "read",
        id: pRef.current.id,
        file: r.file,
      });
      let start = r.start;
      if (data.content.slice(start, r.end) !== r.text) {
        start = data.content.indexOf(r.text);
        if (start < 0 || data.content.indexOf(r.text, start + 1) >= 0)
          throw new Error("引用已变化，请核对原文");
      }
      setJump({ start, end: start + r.text.length, key: uid() });
      setView("source");
    }
    async function locate(n) {
      await load(n.file || pRef.current.main);
      const content = fileRef.current?.content || "",
        lines = content.split("\n");
      let i = Math.max(0, n.line - 1);
      if (n.type === "paper")
        i = lines.findIndex((l) => l.startsWith("\\title{"));
      while (/^\s*% @[cps]:/.test(lines[i] || "")) i++;
      const start = lines.slice(0, i).join("\n").length + (i ? 1 : 0);
      setJump({ start, end: start + (lines[i]?.length || 0), key: uid() });
      setView("source");
    }
    const back = safe(async () => {
      await save();
      activeId = null;
      setChatOpen(false);
      if (returnSession) await ctx.sessions.open(returnSession);
      ctx.layout.selectPanel(null);
    });
    const saveButton = (
      <button onClick={safe(save)} disabled={!file?.dirty}>
        保存
      </button>
    );
    if (!p)
      return (
        <div className={"lp lp-theme-" + theme}>
          <header className="lp-picker-head">
            <button onClick={back}>← 主会话</button>
            <h2>论文工作台</h2>
          </header>
          {error && (
            <p className="lp-error" role="alert">
              {error}
            </p>
          )}
          <div className="lp-picker">
            <h1>继续你的论文</h1>
            <input
              aria-label="搜索论文"
              placeholder="搜索论文项目…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {projects
              .filter((x) => x.name.toLowerCase().includes(query.toLowerCase()))
              .map((x) => (
                <button
                  className="lp-project"
                  key={x.id}
                  onClick={safe(() => choose(x))}
                >
                  <b>▧ {x.name}</b>
                  <small>{x.main}</small>
                  <span>→</span>
                </button>
              ))}
            <div className="lp-row">
              <button onClick={() => setForm("create")}>＋ 新建论文</button>
              <button onClick={() => setForm("import")}>打开本地项目</button>
            </div>
            {form && (
              <form
                onSubmit={safe(async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  try {
                    const created = await api({
                      action: "create",
                      name: title,
                      ...(form === "import" ? { path } : {}),
                    });
                    setProjects((v) => [
                      ...v.filter((x) => x.id !== created.id),
                      created,
                    ]);
                    await choose(created);
                  } finally {
                    setBusy(false);
                  }
                })}
              >
                <label>
                  论文名称
                  <input
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </label>
                {form === "import" && (
                  <label>
                    本地目录
                    <input
                      required
                      placeholder="论文项目目录的完整路径"
                      value={path}
                      onChange={(e) => setPath(e.target.value)}
                    />
                  </label>
                )}
                <button disabled={busy}>打开工作台</button>
                <button type="button" onClick={() => setForm(null)}>
                  取消
                </button>
              </form>
            )}
          </div>
        </div>
      );
    return (
      <div className={"lp lp-theme-" + theme}>
        <aside className="lp-sidebar" hidden={sideHidden}>
          <button className="lp-collapse" aria-label="收起论文侧栏" onClick={() => setSideHidden(true)}>◫</button>
          <button className="lp-back" onClick={back}>
            ← 主会话
          </button>
          <button
            className="lp-project-title"
            onClick={safe(async () => {
              await save();
              setP(null);
              pRef.current = null;
              activeId = null;
              setProjects(await api({ action: "list" }));
            })}
          >
            {p.name} ⌄
          </button>
          <div className="lp-nav">
            {[
              ["files", "文件"],
              ["chats", "聊天"],
              ["reviews", "审阅"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={nav === id}
                onClick={() => setNav(id)}
              >
                {label}
                {id === "reviews"
                  ? " " + p.reviews.filter((r) => !r.resolved).length
                  : ""}
              </button>
            ))}
            {nav !== "reviews" && (
              <button
                aria-label={nav === "files" ? "添加文件" : "新建论文对话"}
                onClick={
                  nav === "files"
                    ? () => {
                        setNewName("");
                        setNewError("");
                      }
                    : safe(() => ensureChat(true))
                }
              >
                ＋
              </button>
            )}
          </div>
          <div className="lp-side-content">
            {nav === "files" && (
              <>
                {newName !== null && (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      try {
                        const f = await api({
                          action: "createFile",
                          id: p.id,
                          file: newName,
                        });
                        setFiles(
                          await api({ action: "open", id: p.id }).then(
                            (v) => v.files,
                          ),
                        );
                        setNewName(null);
                        await load(f.name);
                      } catch (e) {
                        setNewError(e.message);
                      }
                    }}
                  >
                    <input
                      autoFocus
                      aria-label="新文件名称"
                      className="lp-inline-file"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setNewName(null);
                          setNewError("");
                        }
                      }}
                    />
                    {newError && (
                      <small role="alert" className="lp-error">
                        {newError}
                      </small>
                    )}
                  </form>
                )}
                {files.map((f) => (
                  <button
                    key={f.name}
                    className={
                      "lp-file " + (file?.name === f.name ? "active" : "")
                    }
                    disabled={!f.editable}
                    title={f.name}
                    onClick={safe(() => load(f.name))}
                  >
                    {f.name}
                  </button>
                ))}
              </>
            )}
            {nav === "chats" && (
              <>
                {p.chats.map((c) => (
                  <button
                    className={
                      "lp-file " + (p.lastChat === c.id ? "active" : "")
                    }
                    key={c.id}
                    onClick={safe(async () => {
                      await update({ lastChat: c.id });
                      await ensureChat();
                    })}
                  >
                    ◌ {sessions.byId?.[c.id]?.title || c.title}
                  </button>
                ))}
                {!p.chats.length && <p>打开论文对话开始讨论。</p>}
              </>
            )}
            {nav === "reviews" && (
              <>
                <div className="lp-review-bar">
                  <label>
                    <input
                      ref={selectedAll}
                      type="checkbox"
                      aria-label="全选审阅"
                      checked={
                        !!p.reviews.length && selected.size === p.reviews.length
                      }
                      onChange={(e) =>
                        setSelected(
                          new Set(
                            e.target.checked ? p.reviews.map((r) => r.id) : [],
                          ),
                        )
                      }
                    />
                    全选
                  </label>
                  <small>已选 {selected.size}</small>
                  <button
                    disabled={!selected.size}
                    onClick={safe(() =>
                      reviewDraft(p.reviews.filter((r) => selected.has(r.id))),
                    )}
                  >
                    加入对话
                  </button>
                </div>
                {p.reviews.map((r) => (
                  <article className="lp-review" key={r.id}>
                    <button
                      className="lp-review-jump"
                      onClick={safe(() => jumpReview(r))}
                    >
                      <small>{r.file}</small>
                      <blockquote>{r.text}</blockquote>
                      <p>{r.messages.join("\n")}</p>
                    </button>
                    <footer>
                      <button
                        className="lp-state"
                        onClick={safe(() =>
                          update({
                            reviews: p.reviews.map((x) =>
                              x.id === r.id
                                ? { ...x, resolved: !x.resolved }
                                : x,
                            ),
                          }),
                        )}
                      >
                        {r.resolved ? "已解决" : "待处理"}
                      </button>
                      <div>
                        <input
                          type="checkbox"
                          aria-label={"选择审阅：" + r.messages[0]}
                          checked={selected.has(r.id)}
                          onChange={(e) =>
                            setSelected((v) => {
                              const s = new Set(v);
                              e.target.checked ? s.add(r.id) : s.delete(r.id);
                              return s;
                            })
                          }
                        />
                        <button
                          title="加入最近使用的对话"
                          aria-label={"加入对话：" + r.messages[0]}
                          onClick={safe(() => reviewDraft([r]))}
                        >
                          ↗
                        </button>
                      </div>
                    </footer>
                  </article>
                ))}
                {!p.reviews.length && (
                  <p className="lp-muted">选中文字并添加评论。</p>
                )}
              </>
            )}
          </div>
          <footer className="lp-side-footer">
            <small>本地论文</small>
            <select
              aria-label="工作台主题"
              value={theme}
              onChange={(e) => {
                setTheme(e.target.value);
                localStorage.setItem("dsh-latex-theme", e.target.value);
              }}
            >
              <option value="system">跟随 Desktop</option>
              <option value="light">浅色</option>
              <option value="dark">深色</option>
            </select>
          </footer>
        </aside>
        <main className={"lp-main " + (view === "map" ? "lp-mapping" : "")} style={{"--lp-split": split + "%"}}>
          <header className="lp-toolbar">
            {sideHidden && <button aria-label="展开论文侧栏" onClick={() => setSideHidden(false)}>◫</button>}
            <button aria-pressed={chatOpen} onClick={safe(() => ensureChat())}>
              ◌ 论文对话
            </button>
            <button
              aria-pressed={view === "source" && !chatOpen}
              onClick={() => { setView("source"); setChatOpen(false); }}
            >
              ▧ {file?.name || "源码"}
            </button>
            <span className="lp-status">{status}</span>
            <button
              disabled={job?.status === "running"}
              onClick={safe(() => start("compile"))}
            >
              ↻ 编译
            </button>
            <button
              onClick={safe(async () => {
                setView(view === "map" ? "source" : "map");
                if (!map && view !== "map") await start("analyze");
              })}
            >
              ⌘ 行文导图
            </button>
            <details className="lp-settings">
              <summary>设置</summary>
              <div>
                {saveButton}
                <label>
                  主文件
                  <select
                    value={p.main}
                    onChange={safe((e) => update({ main: e.target.value }))}
                  >
                    {files
                      .filter((f) => f.name.endsWith(".tex"))
                      .map((f) => (
                        <option key={f.name}>{f.name}</option>
                      ))}
                  </select>
                </label>
                <label>
                  编译器
                  <select
                    value={p.engine}
                    onChange={safe((e) => update({ engine: e.target.value }))}
                  >
                    {["pdflatex", "xelatex", "lualatex"].map((x) => (
                      <option key={x}>{x}</option>
                    ))}
                  </select>
                </label>
                <button onClick={() => setShowLog((v) => !v)}>编译日志</button>
                <button
                  onClick={safe(async () => {
                    await save();
                    setFiles((await api({ action: "open", id: p.id })).files);
                    if (file) await load(file.name);
                  })}
                >
                  刷新文件
                </button>
              </div>
            </details>
          </header>
          {error && (
            <div className="lp-error" role="alert">
              {error}
              <button aria-label="关闭错误提示" onClick={() => setError("")}>
                ×
              </button>
            </div>
          )}
          {conflict && (
            <div className="lp-conflict">
              磁盘内容已更新。草稿仍保留，请复制草稿或另存文件后重新读取。
              <button
                onClick={() => {
                  navigator.clipboard
                    .writeText(fileRef.current.content)
                    .catch((e) => setError(e.message));
                }}
              >
                复制草稿
              </button>
              <button
                onClick={safe(async () => {
                  const disk = await api({
                    action: "read",
                    id: p.id,
                    file: conflict.name,
                  });
                  const recovery = fileRef.current;
                  const url = URL.createObjectURL(
                    new Blob([recovery.content], { type: "text/plain" }),
                  );
                  const link = document.createElement("a");
                  link.href = url;
                  link.download =
                    recovery.name.split("/").at(-1) + ".draft.txt";
                  link.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                  drafts.delete(p.id + ":" + recovery.name);
                  persistDrafts();
                  setFile({ ...disk, loadKey: uid() });
                  fileRef.current = disk;
                  setConflict(null);
                  setStatus("已读取磁盘版本");
                })}
              >
                导出草稿并重新读取
              </button>
            </div>
          )}
          {job?.status === "running" && (
            <div className="lp-progress">
              {job.kind === "compile" ? "正在编译…" : "Agent 正在分析行文结构…"}
              <button onClick={safe(() => api({ action: "cancel", id: p.id }))}>
                取消
              </button>
            </div>
          )}
          {view === "map" && (
            <>
              <div className="lp-map-toolbar">
                <button onClick={() => setView("source")}>← 源码</button>
                <button
                  disabled={job?.status === "running"}
                  onClick={safe(() => start("analyze"))}
                >
                  更新导图
                </button>
              </div>
              <MindMap data={map} onLocate={safe(locate)} />
            </>
          )}
            <div className="lp-split" hidden={view === "map"}>
              <section className="lp-source">
                <div className="lp-tabs" hidden={chatOpen || tabs.length < 2}>
                  {tabs.map((t) => (
                    <span key={t}>
                      <button
                        aria-pressed={file?.name === t}
                        onClick={safe(() => load(t))}
                      >
                        {t}
                      </button>
                      <button
                        aria-label={"关闭 " + t}
                        onClick={safe(async () => {
                          await save();
                          const remaining = tabs.filter((x) => x !== t);
                          setTabs(remaining);
                          if (file?.name === t) {
                            setFile(null);
                            fileRef.current = null;
                            if (remaining.length) await load(remaining.at(-1));
                          }
                        })}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="lp-source-body" hidden={chatOpen}>
                {file ? (
                  <Editor
                    file={file}
                    onChange={changed}
                    onSelect={setSelection}
                    jump={jump}
                  />
                ) : (
                  <div className="lp-empty">选择文件开始编辑</div>
                )}
                </div>
                {p.lastChat ? <div className={"lp-native " + (chatOpen ? "lp-conversation" : "lp-composer")}>
                  <NativeChat sessionId={p.lastChat} />
                </div> : <button className="lp-start-chat" onClick={safe(() => ensureChat())}>继续讨论论文…</button>}
              </section>
              <div className="lp-splitter" role="separator" tabIndex={0} aria-label="调整源码和 PDF 宽度" aria-orientation="vertical" aria-valuenow={split} aria-valuemin={35} aria-valuemax={70}
                onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setSplit(v => Math.max(35, Math.min(70, v + (e.key === "ArrowLeft" ? -2 : 2)))); } }}
                onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); }}
                onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) { const rect = e.currentTarget.parentElement.getBoundingClientRect(); setSplit(Math.max(35, Math.min(70, 100 * (e.clientX - rect.left) / rect.width))); } }}
                onPointerUp={e => { if(e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }} />
              <section className="lp-pdf">
                <header>
                  <span>PDF</span>
                  <button
                    aria-label="缩小 PDF"
                    onClick={() => setPdfZoom((z) => Math.max(0.5, z - 0.25))}
                  >
                    −
                  </button>
                  <button
                    aria-label="PDF 适合宽度"
                    onClick={() => setPdfZoom(1)}
                  >
                    {Math.round(pdfZoom * 100)}%
                  </button>
                  <button
                    aria-label="放大 PDF"
                    onClick={() => setPdfZoom((z) => Math.min(3, z + 0.25))}
                  >
                    ＋
                  </button>
                  <button onClick={() => setShowLog((v) => !v)}>日志</button>
                  {pdf && (
                    <button
                      onClick={() => {
                        const blob = new Blob(
                            [
                              Uint8Array.from(atob(pdf), (x) =>
                                x.charCodeAt(0),
                              ),
                            ],
                            { type: "application/pdf" },
                          ),
                          url = URL.createObjectURL(blob),
                          a = document.createElement("a");
                        a.href = url;
                        a.download = p.name + ".pdf";
                        a.click();
                        setTimeout(() => URL.revokeObjectURL(url), 1000);
                      }}
                    >
                      下载
                    </button>
                  )}
                </header>
                <PDF base64={pdf} zoom={pdfZoom} />
              </section>
            </div>
          {showLog && (
            <pre className="lp-log">
              {job?.result?.log || job?.error || "暂无编译日志"}
            </pre>
          )}
        </main>
        {selection && !chatOpen && !comment && view === "source" && (
          <div
            className="lp-selection"
            style={{
              left: Math.max(235, Math.min(selection.x, innerWidth - 220)),
              top: Math.min(selection.y + 6, innerHeight - 70),
            }}
            onMouseDown={(e) => e.preventDefault()}
          >
            {["润色", "缩减", "评论"].map((action) => (
              <button
                key={action}
                onClick={
                  action === "评论"
                    ? () => {
                        setComment({ ...selection });
                        setCommentText("");
                      }
                    : safe(() =>
                        draft(
                          "请" +
                            action +
                            "以下论文选区，保持技术含义、公式和引用，先给出建议。\n文件：" +
                            file.name +
                            "\n上下文：" +
                            JSON.stringify(
                              logic.nearestContext(
                                file.content,
                                selection.start,
                              ),
                            ) +
                            "\n原文：\n" +
                            selection.text,
                        ),
                      )
                }
              >
                {action}
              </button>
            ))}
          </div>
        )}
        {comment && (
          <div
            className="lp-comment"
            style={{
              left: Math.max(235, Math.min(comment.x, innerWidth - 350)),
              top: Math.min(comment.y + 6, innerHeight - 300),
            }}
          >
            <header>
              添加评论<button onClick={() => setComment(null)}>×</button>
            </header>
            <blockquote>{comment.text}</blockquote>
            <textarea
              autoFocus
              aria-label="审阅意见"
              placeholder="填写审阅意见…"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            />
            <button disabled={!commentText.trim()} onClick={safe(addComment)}>
              添加评论
            </button>
          </div>
        )}

      </div>
    );
  }
  ctx.effect(() => {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.append(style);
    return () => style.remove();
  });
  ctx.slots.inject("main", () =>
    ctx.slots.register({ name: "main", key: "latex-studio" }, Panel),
  );
  ctx.slots.inject("conversation.session.header.utilities", () =>
    ctx.slots.register(
      { name: "conversation.session.header.utilities", id: name },
      Entry,
    ),
  );
  ctx.slots.inject("conversation.input.left", () =>
    ctx.slots.register(
      { name: "conversation.input.left", id: name + "-input" },
      InputBridge,
    ),
  );
  ctx.slots.inject("shell.overlay", () =>
    ctx.slots.register({ name: "shell.overlay", id: name + "-home-entry" }, () => (
      <div className="lp-home-entry"><Entry /></div>
    )),
  );
}
