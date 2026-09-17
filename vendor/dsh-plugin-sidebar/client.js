window.__ModuleLoader__.load({id: 'dsh-plugin-sidebar', factory: require => {
  const React = require('react');
  const P = require('@deepseek-ai/dsh-client-ui-primitives');
  const h = React.createElement;
  const errors = {
    SIDEBAR_WORKSPACE_CHANGED: '工作区已切换，请重试',
    SIDEBAR_REMOTE_WORKSPACE_UNAVAILABLE: '远程工作区不可用，请检查 SSH 连接',
    SIDEBAR_WORKSPACE_REQUIRED: '尚未选择工作区',
    SIDEBAR_READ_ONLY: '当前会话为只读模式',
    SIDEBAR_BINARY_FILE: '此文件无法作为文本预览',
    SIDEBAR_SSH_PLUGIN_UPDATE_REQUIRED: '请更新 SSH 插件后重启服务',
    SSH_CONNECTION_NOT_FOUND: 'SSH 连接不可用',
    SSH_INVALID_FILE: '此路径不是可预览的普通文件',
    SSH_BINARY_FILE: '此文件无法作为文本预览',
    SSH_FILE_TOO_LARGE: '文件超过读取大小限制',
    SSH_TRANSPORT_FAILED: '远程连接失败，请检查网络与 SSH 配置',
    FS_TOO_LARGE: '文件超过预览大小限制',
  };
  const message = error => errors[error.message] ?? error.message;
  async function request(args, signal) {
    const response = await fetch('/api/dsh-sidebar', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(args), signal});
    const result = await response.json();
    if (!response.ok) throw new Error(result.error ?? 'SIDEBAR_REQUEST_FAILED');
    return result;
  }
  function Tool({icon, label, ...props}) {
    return h('button', {type: 'button', className: 'dsh-side-tool', title: label, 'aria-label': label, ...props}, h(P[icon]));
  }
  function Status({children}) { return h('p', {className: 'dsh-side-status', role: 'status'}, children); }
  function Header({workspace, children}) {
    return h('header', {className: 'dsh-side-header'},
      h(P.IconFolderClose16),
      h('div', {className: 'dsh-side-context', title: `${workspace.label}: ${workspace.root ?? ''}`},
        h('span', {className: 'dsh-side-location'}, workspace.kind === 'ssh' ? `${workspace.label} · SSH` : workspace.label),
        h('span', {className: 'dsh-side-path'}, workspace.root ?? '未选择工作区')),
      children);
  }
  function WorkspacePane({sessionId, session}) {
    const id = sessionId ?? session?.id ?? session?.sessionId;
    const [workspace, setWorkspace] = React.useState(null);
    const [error, setError] = React.useState('');
    const [retry, setRetry] = React.useState(0);
    React.useEffect(() => {
      setWorkspace(null); setError('');
      if (!id) return;
      const controller = new AbortController();
      let timer;
      let running = false;
      const refresh = async () => {
        if (running || controller.signal.aborted) return;
        clearTimeout(timer); running = true;
        try {
          const value = await request({action: 'workspace', sessionId: id}, controller.signal);
          if (!controller.signal.aborted) {
            setWorkspace(old => old?.key === value.key && old.readOnly === value.readOnly ? old : value);
            setError('');
          }
        } catch (err) { if (!controller.signal.aborted) {setError(message(err)); setWorkspace(null);} }
        finally {running = false; if (!controller.signal.aborted) timer = setTimeout(refresh, 1500);}
      };
      void refresh();
      window.addEventListener('dsh-workspace-target-changed', refresh);
      return () => {controller.abort(); clearTimeout(timer); window.removeEventListener('dsh-workspace-target-changed', refresh);};
    }, [id, retry]);
    return h('section', {className: 'dsh-side', 'data-dsh-sidebar': 'files', 'data-workspace-kind': workspace?.kind, 'data-workspace-root': workspace?.root},
      error ? h('div', {className: 'dsh-side-empty'}, h(Status, null, error), h(Tool, {icon: 'IconRefreshOutline16', label: '重试连接', onClick: () => setRetry(n => n + 1)}))
        : workspace ? h(Files, {key: `${id}:${workspace.key}`, sessionId: id, workspace})
          : h(Status, null, id ? '正在读取工作区…' : '尚未打开会话'));
  }
  function Files({sessionId, workspace}) {
    const [revision, setRevision] = React.useState(0);
    const [file, setFile] = React.useState(null);
    const [hidden, setHidden] = React.useState(false);
    const [query, setQuery] = React.useState('');
    const [error, setError] = React.useState('');
    const pending = React.useRef(null);
    React.useEffect(() => () => pending.current?.abort(), []);
    const call = (args, signal) => request({sessionId, workspaceKey: workspace.key, ...args}, signal);
    const open = async path => {
      pending.current?.abort();
      const controller = new AbortController(); pending.current = controller;
      setFile({path, loading: true}); setError('');
      try {
        const value = await call({action: 'read', path}, controller.signal);
        if (!controller.signal.aborted) setFile({path, ...value});
      } catch (err) {if (!controller.signal.aborted) {setFile({path}); setError(message(err));}}
    };
    const close = () => {pending.current?.abort(); setFile(null); setError('');};
    return h(React.Fragment, null,
      h(Header, {workspace}, h(Tool, {icon: 'IconRefreshOutline16', label: '刷新文件', onClick: () => {close(); setRevision(n => n + 1);}})),
      h('div', {className: `dsh-side-files${file ? ' has-preview' : ''}`},
        file && h('div', {className: 'dsh-side-document'},
          h('div', {className: 'dsh-side-filebar'}, h('span', {title: file.path}, file.path.split('/').at(-1)),
            file.size != null && h('small', null, `${(file.size / 1024).toFixed(1)} KB`),
            h(Tool, {icon: 'IconCloseOutline16', label: '关闭文件预览', onClick: close})),
          h('div', {className: 'dsh-side-document-body'}, file.loading ? h(Status, null, '正在读取文件…') : error ? h(Status, null, error)
            : /\.(md|markdown)$/i.test(file.path) ? h('article', {className: 'dsh-side-markdown', 'aria-label': '文件内容'},
              h(P.MarkdownText, {text: file.content, streaming: false, labels: {code: {copyLabel: '复制', copiedLabel: '已复制'}, footnotes: '脚注'}}))
              : h('pre', {className: 'dsh-side-preview', 'aria-label': '文件内容'}, file.content)),
          file.truncated && h(Status, null, '已显示前 256 KB')),
        h('aside', {className: 'dsh-side-explorer', 'aria-label': '工作区文件'},
          h('div', {className: 'dsh-side-filter'},
            h('input', {type: 'search', value: query, 'aria-label': '筛选文件', placeholder: '筛选文件', onChange: e => setQuery(e.target.value)}),
            h('label', null, h('input', {type: 'checkbox', checked: hidden, onChange: e => setHidden(e.target.checked)}), '隐藏文件')),
          workspace.root ? h('div', {className: 'dsh-side-tree'}, h(Level, {key: revision, path: '.', depth: 0, call, open, hidden, query, selected: file?.path})) : h(Status, null, '尚未选择工作区'))),
      h('footer', {className: 'dsh-side-footer'}, workspace.kind === 'ssh' ? 'SSH' : '本机', h('span', null, '只读预览')));
  }
  function Level({path, depth, call, open, hidden, query, selected}) {
    const [value, setValue] = React.useState(null);
    const [error, setError] = React.useState('');
    const [expanded, setExpanded] = React.useState(new Set());
    const [retry, setRetry] = React.useState(0);
    React.useEffect(() => {
      const controller = new AbortController();
      setValue(null); setError('');
      call({action: 'list', path}, controller.signal).then(result => {
        if (!controller.signal.aborted) setValue(result);
      }).catch(err => {if (!controller.signal.aborted) setError(message(err));});
      return () => controller.abort();
    }, [path, retry]);
    if (error) return h('div', {className: 'dsh-side-error'}, h(Status, null, error), h(Tool, {icon: 'IconRefreshOutline16', label: '重试目录', onClick: () => setRetry(n => n + 1)}));
    if (!value) return h(Status, null, '正在加载目录…');
    const entries = value.entries.filter(item => (hidden || !item.name.startsWith('.')) && (!query || item.name.toLowerCase().includes(query.toLowerCase()) || item.kind === 'directory'))
      .sort((a, b) => Number(b.kind === 'directory') - Number(a.kind === 'directory') || a.name.localeCompare(b.name));
    return h('ul', {className: 'dsh-side-level'},
      entries.map(item => {
        const child = path === '.' ? item.name : `${path}/${item.name}`;
        const directory = item.kind === 'directory';
        const isOpen = expanded.has(item.name);
        return h('li', {key: item.name}, h('button', {
          type: 'button', className: `dsh-side-row${selected === child ? ' is-selected' : ''}`, style: {paddingLeft: 8 + depth * 16},
          title: child, 'aria-label': `${directory ? '目录' : '文件'} ${child}`, 'aria-expanded': directory ? isOpen : undefined,
          disabled: !directory && item.kind !== 'file',
          onClick: () => directory ? setExpanded(old => {const next = new Set(old); isOpen ? next.delete(item.name) : next.add(item.name); return next;}) : open(child),
        }, h('span', {className: `dsh-side-caret${isOpen ? ' is-open' : ''}`}, directory && h(P.IconChevronDownOutline14)),
        directory ? h(isOpen ? P.IconFolderOpen16 : P.IconFolderClose16) : h(P.FileTypeIcon, {kind: P.classifyFileType(item.name)}),
        h('span', {className: 'dsh-side-name'}, item.name)),
        directory && isOpen && h(Level, {path: child, depth: depth + 1, call, open, hidden, query, selected}));
      }), !entries.length && h('li', null, h(Status, null, query ? '没有匹配的文件' : '目录为空')),
      value.truncated && h('li', null, h(Status, null, '目录条目已达到显示上限')));
  }
  function apply(ctx) {
    ctx.effect(() => {
      const style = document.createElement('style');
      style.dataset.plugin = 'dsh-plugin-sidebar';
      style.textContent = `
        .dsh-side{--side-text:var(--dsw-alias-label-primary,#292929);--side-muted:var(--dsw-alias-label-secondary,#777);--side-line:var(--dsw-alias-border-l3,#e7e7e7);--side-hover:var(--dsw-alias-interactive-bg-hover,#eee);display:flex;flex-direction:column;height:100%;min-height:0;min-width:0;background:var(--dsw-alias-bg-base,#fafafa);color:var(--side-text);font:13px/1.5 system-ui;letter-spacing:0}
        .dsh-side *{box-sizing:border-box;letter-spacing:0}.dsh-side button,.dsh-side input,.dsh-side select{font:inherit;color:inherit}.dsh-side button{cursor:pointer}.dsh-side button:disabled{opacity:.45;cursor:default}.dsh-side button:focus-visible,.dsh-side input:focus-visible,.dsh-side select:focus-visible{outline:2px solid #6c98ce;outline-offset:-2px}
        .dsh-side-header{display:flex;align-items:center;gap:8px;padding:8px 10px;min-height:56px;border-bottom:1px solid var(--side-line);flex:none}.dsh-side-header>svg{flex:none;color:var(--side-muted)}.dsh-side-context{display:flex;flex:1;min-width:0;flex-direction:column;gap:2px}.dsh-side-location{font-size:11px;color:var(--side-muted)}.dsh-side-path{font-size:12px}.dsh-side-path,.dsh-side-location{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .dsh-side .dsh-side-tool{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:0 0 28px;padding:5px;border:0;border-radius:4px;background:transparent;color:var(--side-muted)}.dsh-side-tool svg{width:16px;height:16px}.dsh-side .dsh-side-tool:hover:not(:disabled){background:var(--side-hover);color:var(--side-text)}
        .dsh-side-filter{display:flex;align-items:center;gap:8px;padding:8px 10px;flex:none}.dsh-side-filter>input{min-width:0;flex:1;width:100%;height:28px;padding:3px 7px;background:var(--side-hover);border:0;border-radius:4px;font-size:12px}.dsh-side-filter label{display:flex;align-items:center;gap:4px;white-space:nowrap;color:var(--side-muted);font-size:11px}.dsh-side-filter label input{width:12px;height:12px;margin:0}
        .dsh-side-tree{flex:1;min-height:0;overflow:auto;padding:0 6px 16px}.dsh-side-level{list-style:none;margin:0;padding:0}.dsh-side .dsh-side-row{display:flex;align-items:center;gap:6px;width:100%;min-width:0;height:29px;padding:3px 8px;border:0;border-radius:3px;background:transparent;text-align:left;font-size:12px}.dsh-side-row:hover:not(:disabled){background:var(--side-hover)}.dsh-side-row>svg{width:16px;height:16px;flex:none;color:var(--side-muted)}.dsh-side-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.dsh-side-caret{display:flex;flex:0 0 12px;width:12px;transform:rotate(-90deg);color:var(--side-muted)}.dsh-side-caret.is-open{transform:rotate(0)}
        .dsh-side-status{padding:12px;margin:0;font-size:12px;color:var(--side-muted);overflow-wrap:anywhere}.dsh-side-empty{display:flex;align-items:center;justify-content:center;flex:1}.dsh-side-error{display:flex;align-items:center}.dsh-side-filebar{display:flex;align-items:center;gap:6px;min-height:38px;padding:4px 8px;border-bottom:1px solid var(--side-line);flex:none}.dsh-side-filebar>span{flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:12px ui-monospace,monospace}.dsh-side-preview{flex:1;min-height:0;overflow:auto;margin:0;padding:12px;font:12px/1.75 ui-monospace,SFMono-Regular,monospace;white-space:pre;tab-size:4}
        .dsh-side-footer{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;min-height:26px;padding:3px 10px;border-top:1px solid var(--side-line);font-size:10px;color:var(--side-muted)}
        .dsh-side{container-type:inline-size;background:var(--dsw-alias-bg-base,#fff)}
        .dsh-side-header{min-height:42px;padding:5px 10px}.dsh-side-context{gap:0}.dsh-side-location{font-size:10px}.dsh-side-path{font-size:11px}
        .dsh-side-files{display:flex;flex:1;min-height:0;min-width:0;overflow:hidden}
        .dsh-side-explorer{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0}
        .dsh-side-files.has-preview .dsh-side-explorer{flex:0 0 36%;border-left:1px solid var(--side-line)}
        .dsh-side-document{display:flex;flex-direction:column;flex:1;min-width:0;min-height:0}
        .dsh-side-document-body{flex:1;min-height:0;overflow:auto}.dsh-side-filebar small{white-space:nowrap;font-size:10px;color:var(--side-muted)}
        .dsh-side-files.has-preview .dsh-side-filter{flex-wrap:wrap;gap:5px;padding:7px}.dsh-side-files.has-preview .dsh-side-filter>input{flex-basis:100%}
        .dsh-side .dsh-side-row.is-selected{background:var(--side-hover);color:var(--side-text)}
        .dsh-side-markdown{padding:16px 20px;font-size:13px;line-height:1.8;overflow-wrap:anywhere}.dsh-side-markdown img{max-width:100%}.dsh-side-markdown pre{overflow:auto}.dsh-side-markdown h1{font-size:22px;line-height:1.35}.dsh-side-markdown h2{font-size:18px;line-height:1.4}.dsh-side-markdown h3{font-size:15px}
        @container(max-width:420px){.dsh-side-files.has-preview{flex-direction:column}.dsh-side-files.has-preview .dsh-side-explorer{flex:0 0 35%;border-left:0;border-top:1px solid var(--side-line)}.dsh-side-files.has-preview .dsh-side-filter{flex-wrap:nowrap}.dsh-side-files.has-preview .dsh-side-filter>input{flex-basis:auto}.dsh-side-markdown{padding:12px}}
      `;
      document.head.appendChild(style); return () => style.remove();
    });
    const id = 'dsh-plugin-sidebar/files';
    ctx.effect(() => ctx.sidebarRightTabs.register({id, kind: 'files', title: () => '文件', guide: [{order: 10, title: () => '文件'}]}));
    ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({name: 'sidebar.right.pane.tab', key: id}, WorkspacePane)));
  }
  return {name: 'dsh-plugin-sidebar', inject: ['slots', 'sidebarRightTabs'], apply};
}});
