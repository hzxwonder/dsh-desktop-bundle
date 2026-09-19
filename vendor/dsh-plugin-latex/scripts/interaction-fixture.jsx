import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor } from '../client/index.jsx';
import css from '../client/style.css';
const style = document.createElement('style'); style.textContent = css; document.head.append(style);
function Fixture() {
  const [file,setFile] = useState({name:'main.tex', loadKey:'fixture', content:'\\begin{abstract}\nScientific workloads exhibit diverse access patterns.\nWe study reproducible local document workflows.\n\\end{abstract}\n'});
  const [selection,setSelection] = useState(null);
  return <div className="lp lp-theme-light" style={{height:500,display:'block'}}>
    <h2>Editor interaction fixture</h2>
    <div style={{height:300}}><Editor file={file} onChange={content => setFile({...file,content})} onSelect={setSelection}/></div>
    <output aria-label="Selected text">{selection?.text || 'Empty selection'}</output>
  </div>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
