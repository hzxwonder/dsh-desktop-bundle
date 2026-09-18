import React, { useEffect, useState } from 'react';
import { NativeStep } from './native-step.jsx';
import { MarkdownText } from '@deepseek-ai/dsh-client-ui-primitives';
import { ChevronDown, ChevronRight, Check, LoaderCircle, Play, Pause, Square, StepForward, ExternalLink, Pencil, CheckCheck, SkipForward, ArrowLeft } from 'lucide-react';
import { StepInput, IconButton, FileCard } from './step-input.jsx';

const names = { queued: '等待执行', running: '执行中', completed: '已完成', paused: '等待检视', waiting_input: '等待回答', waiting_approval: '等待确认', failed: '失败', cancelled: '已停止', needs_attention: '执行中断', stale: '输出已过期', skipped: '已跳过', pending: '待执行' };
const pretty = value => typeof value === 'string' ? value : JSON.stringify(value ?? null, null, 2);
const prose = value => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value.text === 'string') return value.text;
  if (typeof value.content === 'string') return value.content;
  if (typeof value.material === 'string') return value.material;
  return pretty(value);
};
function Content({ value }) { return <MarkdownText text={prose(value)} labels={{ code: { copyLabel: "复制", copiedLabel: "已复制" }, footnotes: "注释" }} />; }

export function RunTimeline({ ctx, api, runId, openSession, onChange, embedded = false, focusNodeId = null, children }) {
  const [run, setRun] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState({}), [recipient, setRecipient] = useState(''), [message, setMessage] = useState('');
  const [confirm, setConfirm] = useState(null), [editing, setEditing] = useState({});
  const lastActive = React.useRef('');
  useEffect(() => {
    let stopped = false, timer;
    const read = async () => {
      try { const v = await api({ action: 'runRead', id: runId }); if (!stopped) { setRun(v.run); setRecipient(v.run.recipient ?? ''); const active = Object.keys(v.run.nodes).filter(k => v.run.nodes[k].status === 'running').join(','); if (active && active !== lastActive.current) { setExpanded({}); lastActive.current = active; } } }
      catch (e) { if (!stopped) setError(e.message); }
      if (!stopped) timer = setTimeout(read, 1000);
    };
    setRun(null); setExpanded({}); read();
    return () => { stopped = true; clearTimeout(timer); };
  }, [runId]);
  const act = async args => {
    if (busy) return;
    setBusy(true); setError('');
    try { const result = await api(args); const v = await api({ action: 'runRead', id: runId }); setRun(v.run); await onChange?.(); return result; }
    catch (e) { setError(e.message); return false; }
    finally { setBusy(false); }
  };
  const review = async value => {
    try { const latest = (await api({ action: 'runRead', id: runId })).run; setRun(latest); setConfirm({ ...value, expectedRevision: latest.checkpointRevision }); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => {
    if (!confirm) return;
    const previous = document.activeElement;
    const dialog = document.querySelector('.wf-confirm');
    dialog?.querySelector('button')?.focus();
    const keyboard = e => {
      if (e.key === 'Escape' && !busy) { e.preventDefault(); setConfirm(null); }
      if (e.key === 'Tab') {
        const controls = [...(dialog?.querySelectorAll('button:not(:disabled)') ?? [])];
        if (!controls.length) return;
        const index = controls.indexOf(document.activeElement);
        e.preventDefault(); controls[(index + (e.shiftKey ? controls.length - 1 : 1)) % controls.length].focus();
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('keydown', keyboard); previous?.focus(); };
  }, [confirm, busy]);
  if (!run) return <section className="wf wf-timeline"><p role="status">{error || '正在读取运行…'}</p></section>;
  const running = ['running', 'queued'].includes(run.status);
  const resumable = ['paused', 'failed', 'needs_attention', 'cancelled'].includes(run.status);
  const targets = Object.entries(run.nodes).flatMap(([nodeId, n]) => [
    ...(n.sessionId ? [{ nodeId, sessionId: n.sessionId, name: n.name, status: n.status }] : []),
    ...Object.entries(n.subagents ?? {}).filter(([, m]) => m.sessionId).map(([memberId, m]) => ({ nodeId, memberId, sessionId: m.sessionId, name: m.name, status: m.status })),
  ]);
  const currentStep = Object.entries(run.nodes).find(([, n]) => n.status === 'running')?.[0];
  const resume = debug => act({ action: 'resume', runId, sessionId: run.sessionId, debug, response: true, background: true, expectedRevision: run.checkpointRevision });
  return <section className="wf wf-timeline" aria-label="工作流运行时间线">
    <header className="wf-run-header">{focusNodeId && <IconButton label="返回工作流总会话" icon={ArrowLeft} onClick={() => openSession(run.sessionId)} />}<div><h2>{run.prepared.definition.name}</h2><span className="wf-run-caption">v{run.revision} · {names[run.status] ?? run.status} · {run.debug ? '逐步调试' : '连续执行'}</span></div>
      <div className="wf-run-actions">
        <select aria-label="步骤消息接收者" value={recipient} onChange={e => { setRecipient(e.target.value); act({ action: 'setRecipient', sessionId: run.sessionId, recipient: e.target.value }); }}><option value="">当前步骤</option>{targets.map(t => <option key={t.sessionId} value={t.sessionId}>{t.name}</option>)}</select>
        {running && <><IconButton label="暂停" icon={Pause} disabled={busy} onClick={() => act({ action: 'pause', id: runId })} /><IconButton label="停止" icon={Square} disabled={busy} onClick={() => act({ action: 'cancel', id: runId })} /></>}
        {resumable && <><IconButton label="运行一步" icon={StepForward} disabled={busy} onClick={() => resume(true)} /><IconButton label="连续执行" icon={Play} disabled={busy} onClick={() => resume(false)} /></>}
        {!embedded && <button onClick={() => openSession(run.sessionId)}>打开总会话</button>}
      </div>
    </header>
    {error && <p className="wf-error" role="alert">{error}</p>}
    {run.error && <p className="wf-error">{run.error}</p>}
    {run.prepared.definition.nodes.map((node, index) => {
      if (focusNodeId && focusNodeId !== node.id) return null;
      const state = run.nodes[node.id] ?? { status: 'pending' };
      const active = state.status === 'running';
      const show = expanded[node.id] ?? (active || node.id === currentStep);
      return <article className={`wf-run-step ${active ? 'is-running' : ''}`} key={node.id} data-step-id={node.id} style={{ "--wf-cell-hue": [218, 150, 35, 278, 185, 340][index % 6] }}>
        <header><span className="wf-step-number">步骤 {index + 1}</span><h3>{node.name}</h3><span className="wf-step-state">{active ? <LoaderCircle size={13} className="wf-spin" /> : state.status === 'completed' ? <Check size={13} /> : null}{names[state.status]}</span></header>
        <p className="wf-model-line">模型：{state.route ? `${state.route.provider} / ${state.route.model}${state.route.reasoningEffort ? ' · ' + state.route.reasoningEffort : ''}` : node.kind === 'agent' ? '执行时确定' : '流程步骤'}</p>
        <div className="wf-cell-toolbar" role="toolbar" aria-label={`${node.name}操作`}>
          <IconButton label="运行此步骤" icon={Play} disabled={busy || running || Boolean(editing[node.id])} onClick={() => act({ action: 'stepRun', runId, nodeId: node.id, expectedRevision: run.checkpointRevision })} />
          <IconButton label="编辑输入" icon={Pencil} disabled={busy || running} onClick={() => setEditing(v => ({ ...v, [node.id]: !v[node.id] }))} />
          {(state.sessionId || state.status === 'completed') && !focusNodeId && <IconButton label="打开步骤会话" icon={ExternalLink} disabled={busy} onClick={() => act({ action: 'stepOpen', runId, nodeId: node.id }).then(result => result && openSession(result.sessionId))} />}
          {state.status === 'completed' && !running && <IconButton label="更新步骤输出" icon={CheckCheck} disabled={busy || !state.sessionId} onClick={() => review({ action: 'adopt', nodeId: node.id, label: '更新步骤输出', description: '将最新回答保存为步骤输出，并回退依赖步骤的文件改动。' })} />}
          {state.status === 'completed' && !running && <IconButton label="准备后续步骤" icon={SkipForward} disabled={busy} onClick={() => review({ action: 'rewind', nodeId: node.id, include: false, label: '准备后续步骤', description: '保留本步骤，回退依赖步骤的文件改动。' })} />}
        </div>
        <StepInput api={api} run={run} node={node} state={state} busy={busy} act={act} editing={Boolean(editing[node.id])} setEditing={value => setEditing(v => ({ ...v, [node.id]: value }))} />
        {!focusNodeId && (state.sessionId || Object.keys(state.subagents ?? {}).length > 0) && <button className="wf-activity-toggle" aria-label={show ? '收起过程' : '展开过程'} aria-expanded={show} onClick={() => setExpanded(v => ({ ...v, [node.id]: !show }))}>{show ? <ChevronDown size={14} /> : <ChevronRight size={14} />}<span>执行过程{Object.keys(state.subagents ?? {}).length ? ` · ${Object.keys(state.subagents).length} 个子代理` : ''}</span></button>}
        <div className="wf-cell-process">
        {state.interaction?.question && <aside className="wf-interaction"><strong>等待你的回答</strong><p>{state.interaction.question}</p><button onClick={() => openSession(run.sessionId)}>去总会话回答</button></aside>}
        {!focusNodeId && show && Object.entries(state.subagents ?? {}).map(([memberId, m]) => <section className="wf-team-member" key={memberId}><strong>{m.name}</strong><span>{names[m.status]} · {m.route?.provider} / {m.route?.model}</span>
          {m.sessionId && <button onClick={() => act({ action: 'stepOpen', runId, nodeId: node.id, memberId }).then(ok => ok && openSession(m.sessionId))}>打开子代理会话</button>}
          {show && m.sessionId && <NativeStep ctx={ctx} parentSessionId={run.sessionId} sessionId={m.sessionId} />}
        </section>)}
        {!focusNodeId && show && state.sessionId && <NativeStep ctx={ctx} parentSessionId={run.sessionId} sessionId={state.sessionId} />}
        {!focusNodeId && show && !state.sessionId && <p className="wf-muted">此步骤的执行信息记录在输入、输出及检查点中。</p>}
        </div>
        {focusNodeId && children}
        {state.output && !focusNodeId && <div className="wf-step-answer"><small>输出</small><Content value={state.output} /></div>}
        {state.status === 'stale' && <p className="wf-muted">输出已过期，等待重跑。</p>}
        {!!state.output?.attachments?.length && <div className="wf-file-row">{state.output.attachments.map(block => <FileCard key={block.attachment.attachmentId} api={api} runId={run.id} block={block} />)}</div>}
        {!!state.attempts?.length && <details><summary>文件与尝试记录 · {state.attempts.length}</summary>{state.attempts.map(a => <div key={a.index}><strong>尝试 {a.index} · {a.status}{a.reverted ? ' · 已回退' : ''}</strong><p className="wf-path">{a.folder}</p><pre>{pretty(a.checkpoint?.changes ?? [])}</pre></div>)}</details>}
      </article>;
    })}
    {!embedded && !!targets.length && <form className="wf-run-composer" onSubmit={e => { e.preventDefault(); const selected = targets.find(t => t.sessionId === recipient) ?? targets.find(t => t.status === 'running') ?? targets.at(-1); act({ action: 'stepMessage', runId, nodeId: selected.nodeId, memberId: selected.memberId, text: message }).then(ok => ok && setMessage('')); }}>
      <textarea aria-label="与步骤交流" value={message} onChange={e => setMessage(e.target.value)} placeholder="补充要求、提问或检视结果…" />
      <button disabled={busy || !message.trim()} type="submit">发送</button>
    </form>}
    {confirm && <div className="wf-confirm" role="dialog" aria-modal="true" aria-label={confirm.label}><h3>{confirm.label}</h3><p>{confirm.description}</p><button disabled={busy} onClick={async () => { const ok = await act({ ...confirm, label: undefined, description: undefined, runId, expectedRevision: confirm.expectedRevision }); if (ok) setConfirm(null); }}>确认</button><button onClick={() => setConfirm(null)}>取消</button></div>}
  </section>;
}
