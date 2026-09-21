import React from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';

const descriptions = {
 input: '提供本次任务的材料', interact: '向用户提问并等待回答', agent: '由 Agent 完成一项任务',
 artifact: '保存结果与文件', publish: '发布审核通过的内容', tool: '调用指定工具',
 condition: '按条件选择后续步骤', join: '汇总前序结果', loop: '按条件重复执行',
 subworkflow: '调用另一工作流', approval: '等待用户确认',
};
export function StepOutline({definition, selected, onSelect, onDelete}) {
 return <section className="wf-outline" aria-label="工作流步骤列表">
  <header><h2>任务步骤</h2></header>
  {!definition.nodes.length && <p className="wf-panel-empty">从上方添加一个步骤</p>}
  {definition.nodes.map((node,index) => {
   const inputs = definition.edges.filter(e=>e.to===node.id).map(e=>definition.nodes.find(n=>n.id===e.from)?.name).filter(Boolean);
   const output = definition.edges.some(e=>e.from===node.id);
   return <div key={node.id} className="wf-outline-row"><button className="wf-outline-step" aria-pressed={selected===node.id} onClick={()=>onSelect(node.id)}>
    <span className="wf-outline-number">{String(index+1).padStart(2,'0')}</span>
    <span className="wf-outline-copy"><strong>{node.name}</strong><span>{node.prompt || descriptions[node.kind] || '配置步骤任务'}</span>
     <small>材料：{inputs.length ? inputs.join('、') : '本次任务输入'}{!output ? ' · 形成最终结果' : ''}</small>
     {node.repeat && <small>评审未通过时返回修订 · 最多 {node.repeat.maxRounds} 轮</small>}
    </span><ChevronRight size={16} aria-hidden="true" />
   </button><button className="wf-outline-delete" aria-label={`删除步骤 ${node.name}`} title="删除步骤，可撤销恢复" onClick={()=>onDelete(node.id)}><Trash2 size={16} /></button></div>;
  })}
 </section>;
}
