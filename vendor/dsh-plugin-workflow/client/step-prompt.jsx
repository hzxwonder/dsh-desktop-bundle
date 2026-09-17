import React, {useLayoutEffect, useRef, useState} from 'react';
import {canConnect} from '../lib/graph-edit.js';

function serialize(root) {
  const read = node => {
    if (node.nodeType === 3) return node.textContent;
    if (node.dataset?.reference) return `{{input.${node.dataset.reference}}}`;
    if (node.nodeName === 'BR') return '\n';
    const text = [...node.childNodes].map(read).join('');
    return ['DIV', 'P'].includes(node.nodeName) && node !== root ? text + '\n' : text;
  };
  return read(root).replace(/\n$/, '');
}

export function StepPrompt({node, definition, onChange, onReference}) {
  const editor = useRef(null);
  const last = useRef();
  const [picker, setPicker] = useState(false);
  const [query, setQuery] = useState('');
  useLayoutEffect(() => {
    const value = node.prompt ?? '';
    if (last.current === value) return;
    const root = editor.current;
    root.replaceChildren();
    const parts = value.split(/(\{\{input\.[a-zA-Z0-9_-]+\}\})/g);
    for (const part of parts) {
      const key = /^\{\{input\.([a-zA-Z0-9_-]+)\}\}$/.exec(part)?.[1];
      if (!key) { root.append(document.createTextNode(part)); continue; }
      const ref = node.input?.[key];
      const source = definition.nodes.find(n => n.id === ref?.nodeId);
      const chip = document.createElement('span');
      chip.contentEditable = 'false';
      chip.dataset.reference = key;
      chip.className = `wf-inline-reference wf-step-${source?.kind ?? 'input'}`;
      chip.textContent = source?.name ?? (ref?.source === 'workflow' ? '用户材料' : key);
      chip.title = '引用此步骤的结果';
      root.append(chip);
    }
    last.current = value;
  }, [node.prompt, node.input, definition.nodes]);
  const sync = () => { const text = serialize(editor.current); last.current = text; onChange(text); };
  return <div className="wf-prompt-composer">
    <div ref={editor} contentEditable suppressContentEditableWarning role="textbox" aria-label="步骤说明" aria-multiline="true"
      className="wf-step-prompt" data-placeholder="描述这一步要做什么，点击引用添加其他步骤的结果…"
      onInput={sync} onKeyDown={e => {e.stopPropagation(); if (e.key === '@') {e.preventDefault(); setPicker(true);} }}
      onPaste={e => {e.preventDefault(); const text = e.clipboardData.getData('text/plain'); const selection = window.getSelection(); if (!selection?.rangeCount) return; const range = selection.getRangeAt(0); range.deleteContents(); const inserted = document.createTextNode(text); range.insertNode(inserted); range.setStartAfter(inserted); range.collapse(true); selection.removeAllRanges(); selection.addRange(range); sync();}}
    />
    <button type="button" className="wf-add-reference" aria-expanded={picker} onClick={() => setPicker(v => !v)}>＠ 引用步骤</button>
    {picker && <div className="wf-reference-picker">
      <input aria-label="搜索可引用步骤" placeholder="搜索步骤" value={query} onChange={e => setQuery(e.target.value)} />
      {definition.nodes.filter(n => canConnect(definition, n.id, node.id) && n.name.includes(query)).map(source => <button type="button" key={source.id} className={`wf-step-${source.kind}`} onClick={() => {onReference(source.id); setPicker(false); setQuery('');}}>{source.name}</button>)}
    </div>}
  </div>;
}
