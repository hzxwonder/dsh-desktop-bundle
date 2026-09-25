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
  Decoration,
  WidgetType,
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
import { zoomAt, fitMap } from "./map-viewport.js";
import { Icon } from "./icons.jsx";
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

function CompileProgress({ job, onCancel }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - (job.startedAt || now)) / 1000));
  const stage = job.log?.at(-1)?.message || "正在准备 LaTeX 编译环境";
  const time = elapsed < 60 ? `${elapsed} 秒` : `${Math.floor(elapsed / 60)} 分 ${elapsed % 60} 秒`;
  return <div className="lp-progress" role="status" aria-live="polite">
    <span className="lp-progress-indicator" aria-hidden="true"><i /></span>
    <span className="lp-progress-copy">
      <strong>正在编译论文</strong>
      <span className="lp-progress-stage">{stage}</span>
    </span>
    <span className="lp-progress-time">已运行 {time}</span>
    <button onClick={onCancel}><Icon name="close"/><span>取消</span></button>
    <span className="lp-progress-track" aria-hidden="true"><i /></span>
  </div>;
}
const uid = () => crypto.randomUUID();
class RevisionWidget extends WidgetType {
  constructor(hunk, active, decide) { super(); this.hunk=hunk; this.active=active; this.decide=decide; }
  toDOM() {
    const root=document.createElement("div"); root.className="lp-inline-change";
    const tools=document.createElement("div"); tools.className="lp-change-tools";
    const label=document.createElement("span"); label.textContent=this.active ? "Agent 正在修改…" : "修改建议"; tools.append(label);
    for(const [decision,text] of [["accept","接受"],["reject","拒绝"]]) {
      const button=document.createElement("button"); button.textContent=text; button.disabled=this.active;
      button.setAttribute("aria-label",text+"当前修改"); button.onclick=()=>this.decide(decision,this.hunk.id); tools.append(button);
    }
    root.append(tools);
    if(this.hunk.before) { const before=document.createElement("pre"); before.className="lp-before"; before.textContent=this.hunk.before; root.append(before); }
    return root;
  }
  ignoreEvent() { return true; }
}
export function Editor({ file, onChange, onSelect, jump, revision, active, onDecide }) {
  const host = useRef(),
    view = useRef(),
    viewport = useRef(null),
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
    const doc = revision ? revision.parts.map(h=>h.equal ?? (h.decision==="reject"?h.before:h.after)).join("") : file.content;
    const decorations=[]; let offset=0;
    for(const h of revision?.parts || []) {
      const text=h.equal ?? (h.decision==="reject"?h.before:h.after);
      if(h.id && !h.decision) {
        decorations.push(Decoration.widget({widget:new RevisionWidget(h,active,onDecide),side:-1}).range(offset));
        if(text.length) decorations.push(Decoration.mark({class:"lp-inline-added"}).range(offset,offset+text.length));
      }
      offset+=text.length;
    }
    const v = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc,
        extensions: [
          lineNumbers(),
          EditorState.readOnly.of(!!revision || !!active),
          EditorView.editable.of(!revision && !active),
          EditorView.decorations.of(Decoration.set(decorations,true)),
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
    if(viewport.current?.name===file.name) v.scrollDOM.scrollTop=viewport.current.top;
    return () => {
      document.removeEventListener("pointerup", finishSelection);
      document.removeEventListener("pointercancel", finishSelection);
      viewport.current={name:file.name,top:v.scrollDOM.scrollTop};
      v.destroy();
      view.current = null;
    };
  }, [file?.name, file?.loadKey, JSON.stringify(revision), active]);
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
    [view, setView] = useState({ x: 32, y: 32, scale: 0.8 }),
    [dragging, setDragging] = useState(false),
    [selected, setSelected] = useState(null),
    [edges, setEdges] = useState([]);
  const { scale } = view;
  const zoom = (nextScale, point) => {
    const area = scroll.current;
    setView(old => zoomAt(old, nextScale, point || { x: area.clientWidth / 2, y: area.clientHeight / 2 }));
  };
  const fit = () => {
    const area = scroll.current, plane = canvas.current;
    setView(fitMap(plane.offsetWidth, plane.offsetHeight, area.clientWidth, area.clientHeight));
  };
  useEffect(() => {
    const area = scroll.current;
    const wheel = (event) => {
      event.preventDefault();
      if (!event.deltaY || drag.current?.active) return;
      const rect = area.getBoundingClientRect();
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? area.clientHeight : 1);
      const factor = Math.exp(-Math.max(-150, Math.min(150, delta)) * 0.002);
      setView(old => zoomAt(old, old.scale * factor, { x: event.clientX - rect.left, y: event.clientY - rect.top }));
    };
    area.addEventListener("wheel", wheel, { passive: false });
    return () => area.removeEventListener("wheel", wheel);
  }, []);
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
        const parentCenter = a.left + a.width / 2;
        const childCenter = b.left + b.width / 2;
        const leftward = childCenter < parentCenter;
        const x1 = ((leftward ? a.left : a.right) - base.left) / scale;
        const x2 = ((leftward ? b.right : b.left) - base.left) / scale;
        const y1 = (a.top + a.height / 2 - base.top) / scale;
        const y2 = (b.top + b.height / 2 - base.top) / scale;
        const mid = (x1 + x2) / 2;
        return [{ id: n.id, d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}` }];
      }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(plane);
    return () => observer.disconnect();
  }, [data, fold, scale]);
  const headingLabels = { chapter: "章", section: "节", subsection: "小节", subsubsection: "四级标题", paragraph: "段标题", subparagraph: "子段标题", abstract: "摘要" };
  const branch = (n, depth = 0, side = "right", includeChildren = true) => (
    <div className={"lp-branch depth-" + depth + " side-" + side} key={n.id}>
      <div className="lp-node-wrap">
        <button data-node-id={n.id} className="lp-node" aria-pressed={selected === n.id}
          onClick={() => setSelected(n.id)} onDoubleClick={() => onLocate(n)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onLocate(n); } }}
          title="双击定位原文">
          <span className="lp-node-label">{n.label}</span>
          {n.headingType && n.type === "section" && <small className="lp-node-type">{headingLabels[n.headingType] || n.headingType}</small>}
        </button>
        {includeChildren && children(n.id).length > 0 && (
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
      {includeChildren && !fold.has(n.id) && children(n.id).length > 0 && (
        <div className="lp-children">
          {children(n.id).map((c) => branch(c, depth + 1, side))}
        </div>
      )}
    </div>
  );
  const rootChildren = root && !fold.has(root.id) ? children(root.id) : [];
  const subtreeWeight = (n) => 1 + (fold.has(n.id) ? 0 : children(n.id).reduce((sum, child) => sum + subtreeWeight(child), 0));
  const balancedSides = rootChildren.reduce((sides, child) => {
    const target = sides.leftWeight <= sides.rightWeight ? "left" : "right";
    sides[target].push(child);
    sides[target + "Weight"] += subtreeWeight(child);
    return sides;
  }, { left: [], right: [], leftWeight: 0, rightWeight: 0 });
  return (
    <div className="lp-map">
      <div
        ref={scroll}
        className={"lp-map-scroll" + (dragging ? " is-dragging" : "")}
        tabIndex={0}
        role="region"
        aria-label="行文导图画布：拖拽移动，滚轮缩放，方向键移动，加减键缩放，0 适合画布"
        onPointerDown={(e) => {
          if (e.button !== 0 || e.target.closest(".lp-fold")) return;
          drag.current = {
            x: e.clientX, y: e.clientY, origin: view, pointerId: e.pointerId, active: true, moved: false,
          };
          if (!e.target.closest("button")) e.currentTarget.focus({ preventScroll: true });
        }}
        onPointerMove={(e) => {
          const start = drag.current;
          if (!start?.active || start.pointerId !== e.pointerId) return;
          const dx = e.clientX - start.x, dy = e.clientY - start.y;
          if (!start.moved && Math.hypot(dx, dy) < 4) return;
          start.moved = true;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragging(true);
          setView({ ...start.origin, x: start.origin.x + dx, y: start.origin.y + dy });
        }}
        onPointerUp={(e) => {
          if (drag.current) drag.current.active = false;
          if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
        }}
        onLostPointerCapture={() => { if (drag.current) drag.current.active = false; setDragging(false); }}
        onClickCapture={(e) => {
          if (drag.current?.moved) { e.preventDefault(); e.stopPropagation(); drag.current = null; }
        }}
        onKeyDown={(e) => {
          if (e.target !== e.currentTarget) return;
          const moves = { ArrowLeft: [60, 0], ArrowRight: [-60, 0], ArrowUp: [0, 60], ArrowDown: [0, -60] };
          if (moves[e.key]) {
            e.preventDefault();
            const [x, y] = moves[e.key];
            setView(old => ({ ...old, x: old.x + x, y: old.y + y }));
          } else if (["+", "=", "-", "0"].includes(e.key)) {
            e.preventDefault();
            if (e.key === "0") fit(); else zoom(scale * (e.key === "-" ? 1 / 1.2 : 1.2));
          }
        }}
      >
        <div
          ref={canvas}
          className="lp-map-plane"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${scale})`, width: "max-content" }}
        >
          <svg className="lp-map-edges" aria-hidden="true">{edges.map(e => <path key={e.id} d={e.d} />)}</svg>
          {root ? (
            <div className="lp-map-two-sided">
              <div className="lp-map-side lp-map-side-left">
                {balancedSides.left.map((child) => branch(child, 1, "left"))}
              </div>
              <div className="lp-map-center">{branch(root, 0, "center", false)}</div>
              <div className="lp-map-side lp-map-side-right">
                {balancedSides.right.map((child) => branch(child, 1, "right"))}
              </div>
            </div>
          ) : <p>生成导图，梳理文章的章节、段落与句子。</p>}
        </div>
      </div>
      <div className="lp-map-hint">拖拽移动 · 滚轮缩放</div>
      <div className="lp-map-zoom">
        <button aria-label="缩小导图" onClick={() => zoom(scale / 1.2)}><Icon name="minus"/></button>
        <span>{Math.round(scale * 100)}%</span>
        <button aria-label="放大导图" onClick={() => zoom(scale * 1.2)}><Icon name="plus"/></button>
        <button
          onClick={fit}
        >
          适合画布
        </button>
      </div>
    </div>
  );
}
function ImagePreview({ asset }) {
  const [scale, setScale] = useState(1), [offset, setOffset] = useState({ x:0, y:0 });
  const drag = useRef(null);
  const zoom = value => setScale(Math.max(0.25, Math.min(5, value)));
  return <div className="lp-image-viewer">
    <div className="lp-image-tools" aria-label="图片缩放">
      <button title="缩小" aria-label="缩小" onClick={() => zoom(scale - 0.2)}><Icon name="minus"/></button>
      <span>{Math.round(scale * 100)}%</span>
      <button title="放大" aria-label="放大" onClick={() => zoom(scale + 0.2)}><Icon name="plus"/></button>
      <button title="适合窗口" onClick={() => { zoom(1); setOffset({x:0,y:0}); }}>适合窗口</button>
    </div>
    <div className="lp-image-stage" onWheel={e => { if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoom(scale + (e.deltaY < 0 ? 0.1 : -0.1)); } }}
      onPointerDown={e => { if (scale <= 1) return; drag.current = { x:e.clientX, y:e.clientY, x0:offset.x, y0:offset.y }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={e => { if (drag.current) setOffset({x:drag.current.x0 + e.clientX - drag.current.x, y:drag.current.y0 + e.clientY - drag.current.y}); }}
      onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
      <img src={`data:${asset.mime};base64,${asset.data}`} alt={asset.name} style={{ transform:`translate(${offset.x}px, ${offset.y}px) scale(${scale})` }} />
    </div>
  </div>;
}
function FileTree({ items, active, openDirs, onToggle, onOpen, badgeOf }) {
  const root = { dirs: new Map(), files: [] };
  for (const item of items) {
    const parts = item.name.split("/");
    let node = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.dirs.has(parts[i])) node.dirs.set(parts[i], { dirs: new Map(), files: [] });
      node = node.dirs.get(parts[i]);
    }
    node.files.push(item);
  }
  const byName = (a, b) => a.localeCompare(b);
  const render = (node, prefix, depth) => {
    const rows = [];
    for (const [name, child] of [...node.dirs.entries()].sort((a, b) => byName(a[0], b[0]))) {
      const path = prefix ? prefix + "/" + name : name;
      const open = openDirs.has(path);
      rows.push(
        <button
          key={path + "/"}
          className="lp-file lp-tree-dir"
          style={{ paddingLeft: 6 + depth * 14 }}
          aria-expanded={open}
          title={path}
          onClick={() => onToggle(path)}
        >
          <span className={"lp-tree-caret" + (open ? " open" : "")}><Icon name="chevron" size={13}/></span>
          <Icon name="folder"/><span>{name}</span>
        </button>,
      );
      if (open) rows.push(...render(child, path, depth + 1));
    }
    for (const item of node.files.sort((a, b) => byName(a.name, b.name))) {
      const badge = badgeOf(item.name);
      rows.push(
        <button
          key={item.name}
          className={"lp-file" + (active === item.name ? " active" : "") + (!item.editable ? " lp-file-asset" : "")}
          style={{ paddingLeft: 6 + depth * 14 }}
          title={item.name}
          onClick={() => onOpen(item.name, item)}
        >
          <Icon name="file"/><span>{item.name.split("/").at(-1)}</span>
          {badge && (() => {
            const kind = badge.kind;
            return <span className={"lp-file-badge " + kind} title={{added:"新增",modified:"修改",deleted:"删除"}[kind]} aria-label={{added:"新增",modified:"修改",deleted:"删除"}[kind]}>{{added:"A",modified:"M",deleted:"D"}[kind]}</span>;
          })()}
        </button>,
      );
    }
    return rows;
  };
  return <>{render(root, "", 0)}</>;
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
  function Entry({ wide = true }) {
    return (
      <button
        className={"lp-entry lp-sidebar-entry" + (wide ? "" : " is-rail")}
        title="论文工作台"
        aria-label="论文工作台"
        onClick={open}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h6"/></svg>{wide && <span>论文工作台</span>}
      </button>
    );
  }
  function NativeChat({ sessionId, browser = false }) {
    const surface = useMemo(() => {
      const registry = ctx.slots;
      if (!registry.hostFace || !registry._renderer) return null;
      const base = registry.hostFace(),
        adapter = base.scope("session"),
        binding = adapter?.resolve(sessionId);
      if (!binding) return null;
      const current = { getSnapshot: () => binding, subscribe: () => () => {} };
      const slot = browser ? (registry.entriesOfSlot("desktop.browser.embedded").length ? "desktop.browser.embedded" : "paper.browser") : "main.conversation";
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
    }, [sessionId, browser]);
    return (
      surface || <p>当前 Harness 版本未提供嵌入聊天接口，请返回主会话继续。</p>
    );
  }
  function Panel() {
    const [projects, setProjects] = useState([]),
      [p, setP] = useState(null),
      [files, setFiles] = useState([]),
      [file, setFile] = useState(null),
      [asset, setAsset] = useState(null),
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
      [rightOpen,setRightOpen]=useState(true),
      [rightTab,setRightTab]=useState("pdf"),
      [review,setReview]=useState(null),
      [logs,setLogs]=useState({}),
      [token,setToken]=useState(""),
      [draftTheme,setDraftTheme]=useState("system"),
      [formError,setFormError]=useState(""),
      [form, setForm] = useState(null),
      [title, setTitle] = useState(""),
      [path, setPath] = useState(""),
      [query, setQuery] = useState(""),
      [theme, setTheme] = useState(
        () => localStorage.getItem("dsh-latex-theme") || "system",
      ),
      [settings, setSettings] = useState(null),
      [globalConfig, setGlobalConfig] = useState(null),
      [settingsBusy, setSettingsBusy] = useState(false),
      [settingsMessage, setSettingsMessage] = useState(""),
      [mapRun, setMapRun] = useState(null),
      [openDirs, setOpenDirs] = useState(() => new Set()),
      [conflict, setConflict] = useState(null);
    const formTrigger = useRef(null);
    const openForm = kind => {formTrigger.current=document.activeElement;setTitle("");setPath("");setFormError("");setForm(kind);};
    const closeForm = () => {setForm(null);requestAnimationFrame(()=>formTrigger.current?.focus());};
    const settingsTrigger = useRef(null);
    const closeSettings = () => { setSettings(null); requestAnimationFrame(()=>settingsTrigger.current?.focus()); };
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
    async function save(explicit = false) {
      const current = fileRef.current,
        project = pRef.current;
      if (!current || !current.dirty || (!explicit && !project.autoSave)) return current;
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
        setStatus("已保存 · 正在编译");
        setJob({kind:"compile",status:"running",startedAt:Date.now(),log:[]});
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
          cache || (review?.files.find(f=>f.name===name && f.kind==="deleted")
            ? {name,content:"",hash:null} : await api({ action: "read", id: project.id, file: name }));
      if (token !== serial.current || pRef.current?.id !== project.id) return;
      const next = { ...loaded, loadKey: uid() };
      fileRef.current = next;
      setFile(next);
      setAsset(null);
      setChatOpen(false);
      setView("source");
      setTabs((v) => (v.includes(name) ? v : [...v, name]));
      setSelection(null);
      setStatus(cache?.dirty ? "未保存" : "已保存");
    }
    async function loadAsset(name) {
      await save();
      const project = pRef.current;
      const token = ++serial.current;
      setAsset({ name, loading:true });
      setChatOpen(false);
      setView("source");
      try {
        const preview = await api({ action:"asset", id:project.id, file:name });
        if (token === serial.current && pRef.current?.id === project.id) setAsset(preview);
      } catch (e) {
        if (token === serial.current) setAsset({ name, error:e.message });
      }
    }
    async function choose(project) {
      await save();
      setForm(null);
      serial.current++;
      setP(project);
      pRef.current = project;
      activeId = project.id;
      setFile(null);
      setAsset(null);
      fileRef.current = null;
      setPdf(null);
      setMap(null);
      setTabs([]);
      setSelected(new Set());
      setChatOpen(false);
      setView("source");
      setStatus("");
      setConflict(null);
      setReview(null);
      const data = await api({ action: "open", id: project.id });
      if (pRef.current?.id !== project.id) return;
      setP(data.project);
      pRef.current = data.project;
      setFiles(data.files);
      setMapRun(null);
      const savedDirs = (() => {
        try {
          const v = JSON.parse(
            localStorage.getItem("dsh-latex-tree:" + project.id),
          );
          return Array.isArray(v) ? new Set(v) : null;
        } catch {
          return null;
        }
      })();
      setOpenDirs(
        savedDirs ||
          new Set(
            data.files
              .filter((f) => f.name.includes("/"))
              .map((f) => f.name.split("/")[0]),
          ),
      );
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
    async function connectChat(force = false, mindmap = false) {
      await save();
      const project = pRef.current;
      let id = force ? null : mindmap
        ? (project.mindmapChatId || project.chats.find(c => c.kind === "mindmap")?.id)
        : project.lastChat;
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
          chat: { id, title: mindmap ? "行文导图" : "论文对话 " + (project.chats.length + 1), ...(mindmap ? { kind:"mindmap" } : {}) },
        });
      } else if (mindmap && !project.chats.find(c => c.id === id)?.kind) {
        await update({ chat:{ id, title:project.chats.find(c=>c.id===id)?.title || "论文导图会话", kind:"mindmap" } });
      }
      await ctx.sessions.open(id);
      ctx.layout.selectPanel("latex-studio");
      setView("source");
      setChatOpen(true);
      return id;
    }
    async function ensureMindmapChat() {
      if (chatPending.current) return chatPending.current;
      const work = connectChat(false, true);
      chatPending.current = work;
      try { return await work; } finally { chatPending.current = null; }
    }
    async function draft(text) {
      const showChat=chatOpen;
      const sessionId = await ensureChat();
      setChatOpen(showChat);
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
          if (j?.kind === "analyze")
            setMapRun({
              status: j.status,
              error: j.error,
              log: (j.log || []).filter(line => !line.message.includes("批")),
              stats: j.result?.stats,
            });
          if (
            j?.status === "completed" &&
            jobHandled.current !== p.id + ":" + j.version
          ) {
            jobHandled.current = p.id + ":" + j.version;
            if (j.kind === "compile") {
              setPdf(j.result.pdf);
              if(j.result.sync?.status === "error"){setRightOpen(true);setRightTab("logs");}
              setStatus(
                j.result.sync?.status === "error" ? "已保存 · 同步失败" : j.result.sync?.status === "synced" ? "已同步 Overleaf" : j.result.stale ? "PDF 已生成 · 源码有更新" : "编译完成",
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
          (fileRef.current?.dirty ? save(true) : start("compile")).catch((e) => setError(e.message));
        }
      };
      window.addEventListener("keydown", handle);
      return () => window.removeEventListener("keydown", handle);
    }, []);
    useEffect(()=>{
      if(!p?.autoSave || !file?.dirty || review || job?.status==="running")return;
      const timer=setTimeout(()=>save(true).catch(e=>setError(e.message)),1000);
      return ()=>clearTimeout(timer);
    },[p?.autoSave,file?.content,file?.dirty,job?.status,review]);
    useEffect(()=>{
      if(!p)return;let stopped=false;
      const poll=async()=>{try{const [state,log,opened]=await Promise.all([api({action:"status",id:p.id}),api({action:"logs",id:p.id}),api({action:"open",id:p.id})]);if(stopped)return;setReview(state.review);setLogs(log);setFiles(opened.files);}catch{}};
      poll();const timer=setInterval(poll,1800);return()=>{stopped=true;clearInterval(timer);};
    },[p?.id]);
    async function decide(decision,hunkId){
      if(fileRef.current?.dirty)throw new Error("请先保留当前草稿，再处理 Agent 修改");
      const result=await api({action:"decide",id:pRef.current.id,batchId:review.id,hunkId,decision});
      setReview(result.review);
      const liveFiles=(await api({action:"open",id:pRef.current.id})).files;
      setFiles(liveFiles);
      setTabs(v=>v.filter(name=>liveFiles.some(f=>f.name===name)||result.review?.files.some(f=>f.name===name&&f.parts.some(h=>h.id&&!h.decision))));
      if(fileRef.current){try{const f=await api({action:"read",id:pRef.current.id,file:fileRef.current.name});fileRef.current={...f,loadKey:uid()};setFile(fileRef.current);}catch{setFile(null);fileRef.current=null;}}
      if(result.settled){setMap(null);setStatus("修改已整合 · 正在编译");setJob({kind:"compile",status:"running",startedAt:Date.now(),log:[]});}
    }
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
      if(fileRef.current?.dirty){await save(true);if(kind!=="compile")setStatus("已保存 · 编译完成后可更新导图");return;}
      let sessionId;
      if (kind === "analyze") {
        sessionId = await ensureMindmapChat();
        setView("source");
        setChatOpen(true);
        setMapRun({
          status: "running",
          log: [{ time: Date.now(), message: "正在向行文导图会话发送全文任务" }],
        });
        const session = ctx.sessions.binding(sessionId)?.session;
        if (!session) throw new Error("行文导图会话尚未就绪，请重试");
        try {
          await session.prompt(
            "请根据 paper-mindmap-update skill，对当前论文全文（主文件及所有引用文本文件）生成或更新行文导图。请调用 paper-workbench 的 list 找到当前论文，再调用 analyze 启动全文分析并轮询 job 直到完成；不得手动拆分或编辑 TeX 文件。严格遵守 skill 中只写入导图注释、原文字符完全一致、运行规范验证并报告结果的要求。",
            "queue",
          );
        } catch (error) {
          setMapRun({ status: "failed", error: error.message, log: [] });
          throw error;
        }
        return;
      } else {
        setChatOpen(false);
      }
      await api({ action: kind, id: pRef.current.id, sessionId });
      setJob({ kind, status: "running", startedAt: Date.now(), log: [] });
      setShowLog(false);
    }
    const toggleDir = (path) =>
      setOpenDirs((v) => {
        const next = new Set(v);
        if (next.has(path)) next.delete(path);
        else next.add(path);
        try {
          localStorage.setItem(
            "dsh-latex-tree:" + pRef.current.id,
            JSON.stringify([...next]),
          );
        } catch {}
        return next;
      });
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
    const gear = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m9 3-.6 2.3-2 .9-2.1-.7-2 3.5 1.6 1.7v2.6L2.3 15l2 3.5 2.1-.7 2 .9L9 21h4l.6-2.3 2-.9 2.1.7 2-3.5-1.6-1.7v-2.6L19.7 9l-2-3.5-2.1.7-2-.9L13 3Z"/><circle cx="11" cy="12" r="3"/></svg>;
    const openGlobal = safe(async () => {
      settingsTrigger.current=document.activeElement;
      setToken("");setDraftTheme(theme);
      setGlobalConfig(await api({action:"settings"}));
      setSettingsMessage("");
      setSettings("global");
    });
    const workspaceChrome = <>
          <header className="lp-toolbar">
            {sideHidden && <button aria-label="展开论文侧栏" onClick={() => setSideHidden(false)}><Icon name="panelLeft"/></button>}
            <button title="论文对话" aria-label="论文对话" aria-pressed={chatOpen} onClick={safe(() => ensureChat())}>
              <Icon name="chat"/><span className="lp-label">论文对话</span>
            </button>
            <button
              className="lp-source-tab" title={asset?.name || file?.name || "源码"}
              aria-pressed={view === "source" && !chatOpen}
              onClick={() => { setView("source"); setChatOpen(false); }}
            >
              <Icon name="file"/><span className="lp-filename">{asset?.name || file?.name || "源码"}</span>
            </button>
            <span className="lp-status" role="status" title={status}>{status}</span>
            {review && <button onClick={safe(async()=>{setNav("files");const first=review.files.find(f=>f.parts.some(h=>h.id&&!h.decision));if(first)await load(first.name);})}>变更 {review.count}</button>}
            <button aria-label={rightOpen?"收起右侧面板":"展开右侧面板"} onClick={()=>setRightOpen(v=>!v)}><Icon name="panelRight"/></button>
            <button className="lp-compile" title="编译论文" aria-label="编译论文"
              disabled={job?.status === "running"}
              onClick={safe(() => start("compile"))}
            >
              <Icon name="play"/><span className="lp-label">编译</span>
            </button>
            <button title="行文导图" aria-label="行文导图" aria-pressed={view === "map"}
              onClick={safe(async () => {
                if (view === "map") { setView("source"); return; }
                if (job?.status === "running" && job.kind === "analyze") {
                  setView("source");
                  setChatOpen(true);
                  return;
                }
                if (!map) { await start("analyze"); return; }
                setView("map");
              })}
            >
              <Icon name="map"/><span className="lp-label">行文导图</span>
            </button>

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
          {job?.status === "running" && job.kind === "compile" && (
            <CompileProgress job={job} onCancel={safe(() => api({ action: "cancel", id: p.id }))} />
          )}
    </>;
    const settingsPanel = settings && <div className="lp-settings-overlay">
      <section className={"lp-settings-panel"+(settings==="project"?" lp-project-settings":"")} role="dialog" aria-modal="true" aria-label={settings === "global" ? "全局设置" : "论文设置"} onKeyDown={e => {
        if(e.key === "Escape" && !settingsBusy) closeSettings();
        if(e.key === "Tab") {
          const items=[...e.currentTarget.querySelectorAll('button:not(:disabled),select:not(:disabled),input:not(:disabled),textarea')];
          const first=items[0],last=items.at(-1);
          if(e.shiftKey && document.activeElement===first){e.preventDefault();last?.focus();}
          else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first?.focus();}
        }
      }}>
        {error && <p role="alert" className="lp-error">{error}</p>}
        <header><h2>{settings === "global" ? "全局设置" : "论文设置"}</h2><button autoFocus aria-label="关闭设置" disabled={settingsBusy} onClick={()=>closeSettings()}><Icon name="close"/></button></header>
        {settings === "global" ? <div className="lp-global-fields">
          <section className="lp-setting-section"><h3>外观</h3><label>工作台主题<select disabled={settingsBusy} value={draftTheme} onChange={e=>setDraftTheme(e.target.value)}><option value="system">跟随 Desktop</option><option value="light">浅色</option><option value="dark">深色</option></select></label></section>
          <section className="lp-setting-section"><h3>Overleaf 同步</h3><label>访问凭证<input disabled={settingsBusy} type="password" aria-label="Overleaf 凭证" autoComplete="off" placeholder={globalConfig?.credential?.configured ? "已保存在系统钥匙串" : "Overleaf Git token"} value={token} onChange={e=>setToken(e.target.value)}/></label>
          </section>
          <section className="lp-setting-section"><h3>Agent 协作</h3><label className="lp-instructions">AGENTS.md<textarea disabled={settingsBusy} aria-label="论文工作台全局指令" value={globalConfig?.instructions || ""} onChange={e=>{setGlobalConfig(v=>({...v,instructions:e.target.value}));setSettingsMessage("");}} spellCheck={false}/></label>
          <p className="lp-help">适用于所有论文会话，保存在工作台内部。保存后用于后续 Agent 调用。</p></section>
          <footer><span role="status">{settingsMessage}</span><button disabled={settingsBusy} onClick={async()=>{setSettingsBusy(true);try{const saved=await api({action:"saveSettings",instructions:globalConfig.instructions,hash:globalConfig.hash});setGlobalConfig(saved);if(token.trim()){try{const credential=await api({action:"credential",token:token.trim()});setGlobalConfig(v=>({...v,credential}));setToken("");}catch(e){setSettingsMessage("指令已保存；凭证保存失败："+e.message);return;}}setTheme(draftTheme);localStorage.setItem("dsh-latex-theme",draftTheme);setSettingsMessage("已保存设置");}catch(e){setSettingsMessage(e.message);}finally{setSettingsBusy(false);}}}>保存设置</button></footer>
        </div> : <>
          <label>编译主文件<select value={p.main} disabled={job?.status === "running"} onChange={safe(e=>update({main:e.target.value}))}>{files.filter(f=>f.name.endsWith(".tex")).map(f=><option key={f.name}>{f.name}</option>)}</select></label>
          <label>编译器<select value={p.engine} disabled={job?.status === "running"} onChange={safe(e=>update({engine:e.target.value}))}>{["pdflatex","xelatex","lualatex"].map(x=><option key={x}>{x}</option>)}</select></label>
          <label className="lp-auto-save"><span>自动保存并编译</span><input type="checkbox" checked={!!p.autoSave} onChange={safe(e=>update({autoSave:e.target.checked}))}/></label>
          <p className="lp-help">关闭后使用 Ctrl / ⌘ + S 保存并编译。Overleaf 项目在修改整合后自动同步。</p>
        </>}
      </section>
    </div>;
    if (!p)
      return (
        <div className={"lp lp-theme-" + theme}>
          <header className="lp-picker-head">
            <button onClick={back}><Icon name="back"/>主会话</button>
            <h2>论文工作台</h2>
            <button className="lp-global-settings" onClick={openGlobal}>{gear} 全局设置</button>
          </header>
          {error && (
            <p className="lp-error" role="alert">
              {error}
            </p>
          )}
          {settingsPanel}
          <div className="lp-picker">
            <h1>继续你的论文</h1>
            <input
              aria-label="搜索论文"
              placeholder="搜索论文项目…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="lp-project-list">
              {projects
                .filter((x) => x.name.toLowerCase().includes(query.toLowerCase()))
                .map((x) => (
                  <button
                    className="lp-project"
                    key={x.id}
                    onClick={safe(() => choose(x))}
                  >
                    <span className="lp-project-icon"><Icon name="file" size={22}/></span>
                    <span className="lp-project-info"><b>{x.name}</b><small>{x.main}</small></span>
                    <Icon name="forward"/>
                  </button>
                ))}
              {!projects.some(x=>x.name.toLowerCase().includes(query.toLowerCase())) && <div className="lp-picker-empty"><Icon name="file" size={28}/><strong>{query ? "没有找到匹配的论文" : "开始你的第一篇论文"}</strong><p className="lp-help">{query ? "换一个关键词，或打开新的论文项目。" : "新建论文，或从本地目录与 Overleaf 导入。"}</p>{query && <button onClick={()=>setQuery("")}>清空搜索</button>}</div>}
            </div>
            <div className="lp-row">
              <button className="lp-primary" onClick={() => openForm("create")}><Icon name="plus"/>新建论文</button>
              <button onClick={() => openForm("import")}><Icon name="folder"/>打开本地项目</button>
              <button onClick={() => openForm("overleaf")}><Icon name="git"/>从 Overleaf Git 创建</button>
            </div>
            {form && <div className="lp-settings-overlay">
              <section className="lp-settings-panel lp-create-dialog" role="dialog" aria-modal="true" aria-label={form === "overleaf" ? "从 Overleaf Git 创建" : form === "import" ? "打开本地项目" : "新建论文"} onKeyDown={e=>{
                if(e.key==="Escape"&&!busy){e.stopPropagation();closeForm();}
                if(e.key==="Tab"){const items=[...e.currentTarget.querySelectorAll('button:not(:disabled),input:not(:disabled)')];const first=items[0],last=items.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
              }}>
                <header><h2>{form === "overleaf" ? "从 Overleaf Git 创建" : form === "import" ? "打开本地项目" : "新建论文"}</h2><button aria-label="关闭创建窗口" disabled={busy} onClick={closeForm}><Icon name="close"/></button></header>
                <form onSubmit={async e=>{
                  e.preventDefault();if(busy)return;setBusy(true);setFormError("");
                  try{const created=await api(form==="overleaf"?{action:"clone",url:path.trim()}:{action:"create",name:title.trim(),...(form==="import"?{path:path.trim()}:{})});setProjects(v=>[...v.filter(x=>x.id!==created.id),created]);await choose(created);}
                  catch(e){setFormError(e.message);}finally{setBusy(false);}
                }}>
                  {form!=="overleaf"&&<label>论文名称<input autoFocus required maxLength={120} disabled={busy} value={title} onChange={e=>setTitle(e.target.value)}/></label>}
                  {form!=="create"&&<label>{form==="overleaf"?"Overleaf Git 链接":"本地目录"}<input autoFocus={form==="overleaf"} required disabled={busy} placeholder={form==="overleaf"?"https://git@git.overleaf.com/项目ID":"论文项目目录的完整路径"} value={path} onChange={e=>setPath(e.target.value)}/></label>}
                  {formError&&<p role="alert" className="lp-error">{formError}</p>}
                  <footer><button type="button" disabled={busy} onClick={closeForm}>取消</button><button className="lp-primary" disabled={busy}>{busy?"正在打开…":"打开工作台"}</button></footer>
                </form>
              </section>
            </div>}

          </div>
        </div>
      );
    return (
      <div className={"lp lp-theme-" + theme}>
        {settingsPanel}
        <aside className="lp-sidebar" hidden={sideHidden}>
          <button className="lp-collapse" aria-label="收起论文侧栏" onClick={() => setSideHidden(true)}><Icon name="panelLeft"/></button>
          <button className="lp-back" onClick={back}>
            <Icon name="back"/>主会话
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
            <span>{p.name}</span><Icon name="chevron" className="lp-project-chevron"/>
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
                <Icon name="plus"/>
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
                <FileTree
                  items={[
                    ...files,
                    ...(review?.files || [])
                      .filter(r=>!files.some(f=>f.name===r.name))
                      .map(r=>({name:r.name,editable:true})),
                  ]}
                  active={asset?.name || file?.name}
                  openDirs={openDirs}
                  onToggle={toggleDir}
                  onOpen={(name, item) => safe(() => item?.editable ? load(name) : loadAsset(name))()}
                  badgeOf={(name) =>
                    review?.files.find(r=>r.name===name && r.parts.some(h=>h.id&&!h.decision))
                  }
                />
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
                    <Icon name="chat"/><span>{sessions.byId?.[c.id]?.title || c.title}</span>
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
                          <Icon name="send"/>
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
          <footer className="lp-side-footer"><button className="lp-gear" aria-label="论文设置" title="论文设置" onClick={()=>{settingsTrigger.current=document.activeElement;setSettings("project");}}>{gear}</button></footer>
        </aside>
        <main className={"lp-main " + (view === "map" ? "lp-mapping" : "") + (!rightOpen ? " lp-panel-closed" : "")} style={{"--lp-split": split + "%"}}>
          {view === "map" && workspaceChrome}
          {view === "map" && (
            <>
              <div className="lp-map-toolbar">
                <button onClick={() => setView("source")}>← 源码</button>
                <button
                  disabled={job?.status === "running" || mapRun?.status === "running"}
                  onClick={safe(() => start("analyze"))}
                >
                  更新导图
                </button>
                <button disabled={!map || job?.status === "running" || mapRun?.status === "running"} onClick={safe(async () => {
                  const rendered = await api({ action:"rerender", id:pRef.current.id });
                  setMap(rendered);
                })}>重新渲染</button>
              </div>
              <MindMap data={map} onLocate={safe(locate)} />
            </>
          )}
            <div className={"lp-split"+(rightOpen?"":" lp-right-closed")} hidden={view === "map"}>
              <section className="lp-source">
                {workspaceChrome}
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
                {review && <div className="lp-review-summary"><span role="status">{review.active ? "Agent 正在修改…" : `待审阅 · ${review.count} 处`}</span><button className="lp-accept" disabled={review.active} onClick={safe(()=>decide("accept"))}>接受全部</button><button disabled={review.active} onClick={safe(()=>decide("reject"))}>拒绝全部</button></div>}
                <div className="lp-editor-wrap">
                {asset ? (
                  <div className="lp-asset-preview" aria-label={"素材预览 " + asset.name}>
                    <header><Icon name="file"/><strong>{asset.name}</strong>{asset.size != null && <small>{(asset.size / 1024).toFixed(1)} KB</small>}</header>
                    {asset.loading ? <p role="status">正在载入素材…</p> : asset.error ? <p role="alert">{asset.error}</p> : asset.mime?.startsWith("image/") ? <ImagePreview asset={asset}/> : asset.mime === "application/pdf" ? <PDF base64={asset.data}/> : <p>此文件可随论文同步，当前格式无法在工作台内显示。</p>}
                  </div>
                ) : file ? (
                  <Editor
                    file={file}
                    onChange={changed}
                    onSelect={setSelection}
                    jump={jump}
                    revision={review?.files.find(r=>r.name===file.name)}
                    active={!!review?.active}
                    onDecide={(decision,id)=>safe(()=>decide(decision,id))()}
                  />
                ) : (
                  <div className="lp-empty">选择文件开始编辑</div>
                )}
                </div></div>
                {p.lastChat ? <div className={"lp-native " + (chatOpen ? "lp-conversation" : "lp-composer")}>
                  <NativeChat sessionId={p.lastChat} />
                </div> : <button className="lp-start-chat" onClick={safe(() => ensureChat())}>继续讨论论文…</button>}
              </section>
              <div hidden={!rightOpen} className="lp-splitter" role="separator" tabIndex={0} aria-label="调整源码和 PDF 宽度" aria-orientation="vertical" aria-valuenow={split} aria-valuemin={35} aria-valuemax={70}
                onKeyDown={e => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setSplit(v => Math.max(35, Math.min(70, v + (e.key === "ArrowLeft" ? -2 : 2)))); } }}
                onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault(); }}
                onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) { const rect = e.currentTarget.parentElement.getBoundingClientRect(); setSplit(Math.max(35, Math.min(70, 100 * (e.clientX - rect.left) / rect.width))); } }}
                onPointerUp={e => { if(e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }} />
              <section className="lp-pdf lp-right" hidden={!rightOpen}>
                <nav className="lp-right-tabs">{[["pdf","PDF"],["logs","日志"],["browser","浏览器"]].map(([key,label])=><button key={key} aria-pressed={rightTab===key} onClick={()=>setRightTab(key)}>{label}</button>)}
                  {rightTab === "pdf" && <div className="lp-pdf-actions" aria-label="PDF 工具">
                    <button aria-label="缩小 PDF" onClick={() => setPdfZoom((z) => Math.max(0.5, z - 0.25))}><Icon name="minus"/></button>
                    <button aria-label="PDF 适合宽度" onClick={() => setPdfZoom(1)}>{Math.round(pdfZoom * 100)}%</button>
                    <button aria-label="放大 PDF" onClick={() => setPdfZoom((z) => Math.min(3, z + 0.25))}><Icon name="plus"/></button>
                    {pdf && <button aria-label="下载 PDF" title="下载 PDF" onClick={() => {
                      const blob = new Blob([Uint8Array.from(atob(pdf), (x) => x.charCodeAt(0))], { type: "application/pdf" });
                      const url = URL.createObjectURL(blob), a = document.createElement("a");
                      a.href = url; a.download = p.name + ".pdf"; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
                    }}><Icon name="download"/></button>}
                  </div>}
                  <button aria-label="关闭右侧面板" onClick={()=>setRightOpen(false)}><Icon name="close"/></button>
                </nav>
                <div className="lp-right-page" hidden={rightTab!=="pdf"}>
                <PDF base64={pdf} zoom={pdfZoom} />
                </div>
                {rightTab==="logs" && <div className="lp-log-page"><header><span>编译与同步</span><button onClick={safe(async()=>{await api({action:"sync",id:p.id});setLogs(await api({action:"logs",id:p.id}));})}>重试同步</button></header><pre>{logs.sync?.message || ""}{"\n\n"}{logs.compile || "暂无编译日志"}</pre></div>}
                {rightTab==="browser" && rightOpen && !settings && (p.lastChat ? <NativeChat sessionId={p.lastChat} browser/> : <div className="lp-empty"><button onClick={safe(()=>ensureChat())}>连接论文会话浏览器</button></div>)}
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
    ctx.slots.register({ name: "main", key: "latex-studio", children:{"desktop.browser.embedded":{kind:"single",scope:"session-maybe"},"paper.browser":{kind:"single",scope:"session-maybe"}} }, Panel),
  );
  ctx.slots.inject("conversation.input.left", () =>
    ctx.slots.register(
      { name: "conversation.input.left", id: name + "-input" },
      InputBridge,
    ),
  );
  ctx.slots.inject("sidebar.workspaces", () => {
    const native = ctx.slots.entriesOfSlot("sidebar.workspaces")[0];
    if (!native?.component) return;
    const Native = native.component;
    let active = true;
    const listeners = new Set();
    const Wrapped = props => {
      const enabled = useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => active);
      return enabled ? <div className="lp-workspaces-host"><Native {...props} /><Entry wide={props.wide} /></div> : <Native {...props} />;
    };
    native.component = Wrapped;
    return () => {
      active = false;
      if (native.component === Wrapped) native.component = Native;
      listeners.forEach(fn => fn());
    };
  });
}
