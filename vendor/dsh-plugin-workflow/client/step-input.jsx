import React, { useEffect, useRef, useState } from 'react';
import { FileText, Paperclip, X, Check, Pencil } from 'lucide-react';

export function IconButton({ label, icon: Icon, ...props }) {
  return <button type="button" aria-label={label} title={label} {...props}><Icon size={16} aria-hidden="true" /></button>;
}
export function FileCard({ api, runId, block }) {
  const ref = block.attachment, [preview, setPreview] = useState('');
  useEffect(() => {
    if (block.type !== 'image') return;
    let alive = true;
    api({ action: 'stepFile', runId, attachmentId: ref.attachmentId }).then(file => { if (alive) setPreview(`data:${file.mediaType};base64,${file.data}`); }).catch(() => {});
    return () => { alive = false; };
  }, [ref.attachmentId, runId]);
  const [error, setError] = useState('');
  const download = async () => {
    try {
      const file = await api({ action: 'stepFile', runId, attachmentId: ref.attachmentId });
      const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: file.mediaType }));
      const link = document.createElement('a'); link.href = url; link.download = file.name; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) { setError(e.message); }
  };
  return <button type="button" className={`wf-file-card ${preview ? 'is-image' : ''}`} onClick={download} title={error || ref.name} aria-label={`下载 ${ref.name}`}>
    {preview ? <img src={preview} alt={ref.name} /> : <><FileText size={24} /><span><strong>{ref.name}</strong><small>{Math.max(1, Math.round(ref.bytes / 1024))} KB</small></span></>}
  </button>;
}
export function StepInput({ api, run, node, state, busy, act, editing, setEditing }) {
  const saved = run.stepOverrides?.[node.id], [prompt, setPrompt] = useState(''), [files, setFiles] = useState([]), [keep, setKeep] = useState([]), [error, setError] = useState('');
  const picker = useRef(null);
  useEffect(() => { if (editing) { setPrompt(saved?.prompt ?? node.prompt ?? ''); setKeep((saved?.attachments ?? []).map(a => a.attachment.attachmentId)); setFiles([]); setError(''); } }, [editing]);
  const inherited = state.input?.attachments ?? [];
  const cards = [...new Map([...inherited, ...(saved?.attachments ?? [])].map(b => [b.attachment.attachmentId, b])).values()];
  const material = Object.entries(state.input ?? {}).filter(([k]) => k !== 'attachments').map(([k, v]) => typeof v === 'string' ? v : `${k}: ${JSON.stringify(v)}`).join('\n\n');
  const add = async items => {
    if (files.length + keep.length + items.length > 12 || [...files, ...items].reduce((sum, f) => sum + (f.size ?? f.bytes ?? 0), 0) > 8 * 1024 * 1024) { setError('最多 12 个附件，合计不超过 8 MB'); return; }
    const uploaded = await Promise.all([...items].map(file => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onerror = reject; reader.onload = () => resolve({ name: file.name, mediaType: file.type, bytes: file.size, data: String(reader.result).split(',')[1] }); reader.readAsDataURL(file); })));
    setFiles(v => [...v, ...uploaded]);
  };
  return <section className="wf-cell-input" aria-label="步骤输入">
    {cards.length > 0 && <div className="wf-file-row">{cards.map(block => <FileCard key={block.attachment.attachmentId} api={api} runId={run.id} block={block} />)}</div>}
    {editing ? <div className="wf-input-editor">
      <textarea aria-label="步骤输入 prompt" value={prompt} onChange={e => setPrompt(e.target.value)} autoFocus />
      <div className="wf-input-files">{(saved?.attachments ?? []).filter(b => keep.includes(b.attachment.attachmentId)).map(b => <span key={b.attachment.attachmentId}>{b.attachment.name}<IconButton label={`移除 ${b.attachment.name}`} icon={X} onClick={() => setKeep(v => v.filter(id => id !== b.attachment.attachmentId))} /></span>)}{files.map((f, i) => <span key={i}>{f.name}<IconButton label={`移除 ${f.name}`} icon={X} onClick={() => setFiles(v => v.filter((_, index) => index !== i))} /></span>)}</div>
      <input ref={picker} type="file" multiple hidden aria-label="添加步骤文件" onChange={e => { add(e.target.files).catch(() => setError('文件读取失败')); e.target.value = ''; }} />
      <div className="wf-cell-toolbar"><IconButton label="添加文件" icon={Paperclip} onClick={() => picker.current?.click()} /><span className="wf-muted">本次运行</span><IconButton label="保存输入" icon={Check} disabled={busy} onClick={async () => { const result = await act({ action: 'stepEdit', runId: run.id, nodeId: node.id, prompt, keep, files, expectedRevision: run.checkpointRevision }); if (result) setEditing(false); }} /><IconButton label="取消编辑" icon={X} onClick={() => setEditing(false)} /></div>
      {error && <p role="alert">{error}</p>}
    </div> : <div className="wf-input-bubble"><span className="wf-cell-label">输入</span><p>{saved?.prompt || state.prompt || node.prompt || node.name}</p>{material && <details className="wf-input-material"><summary>输入材料</summary><div>{material}</div></details>}</div>}
  </section>;
}
