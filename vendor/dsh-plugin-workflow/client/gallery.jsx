import React, {useState} from 'react';
import {Menu} from '@deepseek-ai/dsh-client-ui-primitives';
import {MessageSquare,Copy,Pencil,GitBranch,Archive,ArchiveRestore,MoreHorizontal,Plus,Search,LayoutGrid,List,Settings2,Play,Undo2,X} from 'lucide-react';
import {workflowHistory} from './history.js';

export function createGallery({ctx, api, refresh, openSession, openEditor, bind, beginAuthorSession, useSessions, Icon, glyphFor, timestamp}) {
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
        openSession(childId);
      } else if (action === "archive") {
        await ctx.uiWorkspace.archiveSession(sessionId);
        await ctx.sessions.refresh();
        await refresh();
      }
    };
    const rows = workflowHistory(data, sessions, ctx.workspaces.list.getSnapshot().archivedSessionIds, workflow.id);
    if (!rows.length)
      return <p className="wf-sessions-empty">还没有历史对话</p>;
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
                  openSession(r.sessionId);
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
    const [query, setQuery] = useState("");
    const [detail, setDetail] = useState(new Set());
    // Feedback for actions that change data but leave the screen nearly identical.
    // Archive is reversible by design, so the message carries its own undo instead
    // of a confirmation dialog in front of a harmless action.
    const [feedback, setFeedback] = useState(null);
    const [pending, setPending] = useState("");
    const [creating, setCreating] = useState(false);
    const perform = (fn) =>
      Promise.resolve()
        .then(fn)
        .catch((e) => onError(e.message));
    const choose = (next) => {
      localStorage.setItem("workflow-studio:view", next);
      setView(next);
    };
    const conversations = (id) =>
      workflowHistory(data, sessions, ctx.workspaces.list.getSnapshot().archivedSessionIds, id).length;
    // A copy is a fresh, unpublished workflow at the source's newest revision:
    // runs, schedules and conversation bindings deliberately stay behind.
    const copy = (record) =>
      perform(async () => {
        if (pending) return;
        setPending(record.id);
        try {
          const created = await api({ action: "copy", id: record.id });
          await refresh();
          openEditor(created.id);
        } finally {
          setPending("");
        }
      });
    const archive = (record) =>
      perform(async () => {
        if (pending) return;
        setPending(record.id);
        try {
          await api({ action: "archive", id: record.id, archived: !record.archived });
          await refresh();
          setFeedback({
            workflowId: record.id,
            name: record.name,
            text: record.archived
              ? `已恢复「${record.name}」`
              : `已归档「${record.name}」，可在「已归档」里恢复`,
          });
        } finally {
          setPending("");
        }
      });
    const undoArchive = (entry) =>
      perform(async () => {
        const record = data.workflows.find((w) => w.id === entry.workflowId);
        if (!record) return;
        await api({ action: "archive", id: record.id, archived: !record.archived });
        await refresh();
        setFeedback(null);
      });
    const trimmed = query.trim();
    const rows = data.workflows.filter((w) => w.archived === archived &&
      `${w.name} ${w.description ?? ""}`.toLocaleLowerCase().includes(trimmed.toLocaleLowerCase()));
    const empty = !rows.length;
    const scopeLabel = archived ? "已归档的工作流" : "工作流";
    const countText = empty
      ? (trimmed ? "没有匹配的工作流" : archived ? "没有已归档的工作流" : "还没有工作流")
      : trimmed
        ? `匹配 ${rows.length} / ${data.workflows.filter((w) => w.archived === archived).length} 个`
        : `${rows.length} 个工作流`;
    return (
      <div className="wf-scroll wf-gallery">
        <div className="wf-gallery-bar">
          <label className="wf-gallery-search">
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="搜索工作流"
              placeholder="搜索工作流"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="wf-search-clear"
                aria-label="清除搜索"
                onClick={() => setQuery("")}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </label>
          <span className="wf-gallery-count" role="status" aria-atomic="true">{countText}</span>
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
              <LayoutGrid size={15} aria-hidden="true" />
              卡片
            </button>
            <button
              role="tab"
              aria-selected={view === "list"}
              onClick={() => choose("list")}
            >
              <List size={15} aria-hidden="true" />
              列表
            </button>
          </div>
        </div>
        {feedback && (
          <div className="wf-gallery-feedback" role="status" aria-live="polite">
            <Archive size={15} aria-hidden="true" />
            <span>{feedback.text}</span>
            <button type="button" onClick={() => undoArchive(feedback)}>
              <Undo2 size={14} aria-hidden="true" />
              撤销
            </button>
            <Icon label="关闭提示" icon={X} onClick={() => setFeedback(null)} />
          </div>
        )}
        {empty ? (
          <div className="wf-gallery-empty">
            <p>
              {trimmed
                ? `没有找到匹配「${trimmed}」的${scopeLabel}`
                : archived
                  ? "还没有归档的工作流"
                  : "还没有工作流"}
            </p>
            {trimmed && <button onClick={() => setQuery("")}>清除搜索</button>}
            {!archived && !trimmed && (
              <button
                className="wf-primary"
                disabled={creating}
                aria-busy={creating}
                onClick={() =>
                  perform(async () => {
                    if (creating) return;
                    setCreating(true);
                    try {
                      await beginAuthorSession();
                    } finally {
                      setCreating(false);
                    }
                  })
                }
              >
                <Plus size={16} aria-hidden="true" />
                {creating ? "正在创建…" : "创建工作流"}
              </button>
            )}
            {archived && (
              <button onClick={() => setArchived(false)}>返回工作流列表</button>
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
                  <span className="wf-card-title" title={w.name}>{w.name}</span>
                  <span
                    className={`wf-chip ${w.published === w.revision ? "is-published" : ""}`}
                  >
                    {w.published ? `已发布 v${w.published}` : `草稿 v${w.revision}`}
                  </span>
                </button>
                <p className="wf-card-desc" title={w.description || "还没有描述"}>
                  {w.description || "还没有描述"}
                </p>
                <p className="wf-card-meta">
                  <span>最近修改 {timestamp(w.updatedAt)}</span>
                </p>
                <div className="wf-card-actions">
                  <button onClick={() => openEditor(w.id)}>
                    <Settings2 size={15} aria-hidden="true" />
                    打开
                  </button>
                  <button
                    className="wf-primary"
                    disabled={w.archived}
                    onClick={() => perform(() => bind(w))}
                  >
                    <Play size={15} aria-hidden="true" />
                    运行
                  </button>
                  <button disabled={pending === w.id} onClick={() => copy(w)}>
                    <Copy size={15} aria-hidden="true" />
                    {pending === w.id ? "处理中…" : "拷贝"}
                  </button>
                  <button
                    className="wf-archive-action"
                    aria-label={w.archived ? `恢复 ${w.name}` : `归档 ${w.name}`}
                    disabled={pending === w.id}
                    onClick={() => archive(w)}
                  >
                    {w.archived
                      ? <ArchiveRestore size={15} aria-hidden="true" />
                      : <Archive size={15} aria-hidden="true" />}
                    {w.archived ? "恢复" : "归档"}
                  </button>
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
                      <button
                        className="wf-link wf-list-title"
                        title={w.name}
                        onClick={() => openEditor(w.id)}
                      >
                        {w.name}
                      </button>
                      <small className="wf-list-desc" title={w.description}>
                        {w.description}
                      </small>
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
                        disabled={pending === w.id}
                        onClick={() => copy(w)}
                      />
                      <Icon
                        label={`编辑 ${w.name}`}
                        icon={Settings2}
                        onClick={() => openEditor(w.id)}
                      />
                      <Icon
                        label={w.archived ? `恢复 ${w.name}` : `归档 ${w.name}`}
                        icon={w.archived ? ArchiveRestore : Archive}
                        disabled={pending === w.id}
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


  return Gallery;
}
