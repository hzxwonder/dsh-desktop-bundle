window.__ModuleLoader__.load({
  id: "dsh-plugin-ssh",
  factory: (require) => {
    const module = {exports: {}};
    const exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, {value: "Module"});
    const React = require("react");

    const NS = "dshPluginSsh";
    const SETTINGS_NS = "ssh";
    const FALLBACK = {
      nav: "SSH连接",
      title: "SSH连接",
      intro: "管理 OpenSSH 连接，并复用本机 SSH agent、密钥与配置别名。",
      add: "新建连接",
      save: "保存连接",
      remove: "删除连接",
      import: "导入 ~/.ssh/config",
      importHint: "导入操作请在会话中运行 /ssh import。",
      empty: "尚未保存 SSH 连接。",
      unavailable: "当前部署没有可写的 settings 存储。",
      name: "名称",
      host: "主机或别名",
      user: "用户",
      port: "端口",
      identityFile: "私钥路径",
      jumpHost: "跳板主机",
      directory: "远程目录",
      authMode: "认证方式",
      agent: "SSH agent",
      key: "私钥",
      password: "密码",
      remember: "记住密码（Harness 本机凭据存储）",
      test: "测试连接",
      storePassword: "保存密码",
      connectTimeout: "连接超时（秒）",
      keepalive: "保活间隔（秒）",
      alias: "使用本机 SSH 配置",
      select: "选择连接",
      status: "状态",
      memory: "仅当前进程",
      hostRequired: "请填写名称和主机。",
      saved: "已保存。",
      removed: "已删除。",
      failed: "保存失败：",
      ready: "已就绪",
      loading: "加载中",
      english: "SSH Connections",
    };
    const en = {
      ...FALLBACK,
      nav: "SSH Connections",
      title: "SSH Connections",
      intro: "Manage OpenSSH connections and reuse the local agent, keys, and config aliases.",
      add: "New connection",
      save: "Save connection",
      remove: "Delete connection",
      import: "Import ~/.ssh/config",
      importHint: "Run /ssh import in a session to import aliases.",
      empty: "No saved SSH connections.",
      unavailable: "This deployment has no writable settings store.",
      name: "Name",
      host: "Host or alias",
      user: "User",
      port: "Port",
      identityFile: "Identity file",
      jumpHost: "Jump host",
      directory: "Remote directory",
      authMode: "Authentication",
      agent: "SSH agent",
      key: "Identity file",
      password: "Password",
      remember: "Remember password (Harness local credential store)",
      test: "Test connection",
      storePassword: "Save password",
      connectTimeout: "Connect timeout (seconds)",
      keepalive: "Keepalive interval (seconds)",
      alias: "Use local SSH config",
      select: "Select connection",
      status: "Status",
      memory: "Process-local only",
      hostRequired: "Name and host are required.",
      saved: "Saved.",
      removed: "Deleted.",
      failed: "Save failed: ",
      ready: "Ready",
      loading: "Loading",
    };

    const DEFAULT = {
      id: "",
      authMode: "agent",
      name: "",
      host: "",
      user: "",
      port: 22,
      identityFile: "",
      jumpHost: "",
      directory: "~",
      alias: false,
      connectTimeout: 10,
      keepalive: 15,
    };

    function copyValue(value) {
      return value && typeof value === "object" ? JSON.parse(JSON.stringify(value)) : value;
    }

    async function sshRequest(args, signal) {
      const response = await fetch('/api/dsh-ssh', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(args), signal});
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || 'SSH_REQUEST_FAILED');
      return value;
    }

    function useSettingsSnapshot(scope) {
      if (!scope || typeof scope.getSnapshot !== "function") return {status: "unavailable", value: {connections: []}, revision: undefined, writable: false};
      return React.useSyncExternalStore(
        listener => scope.subscribe?.(listener) ?? (() => {}),
        () => scope.getSnapshot(),
        () => scope.getSnapshot(),
      );
    }

    const h = React.createElement;
    function Icon({kind = 'server', size = 18}) {
      const paths = {
        server: 'M4 4h16v12H4z M8 20h8 M12 16v4 M7 8h.01 M7 12h.01',
        plus: 'M12 5v14 M5 12h14', close: 'M6 6l12 12 M18 6L6 18',
        edit: 'M15 5l4 4 M4 20l4-1L20 7l-4-4L4 15z',
        refresh: 'M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 12-1l2 6 M4 12l2 6a7 7 0 0 0 12-1',
        key: 'M15 3a6 6 0 1 1-4 10l-7 7H1v-3l8-8a6 6 0 0 1 6-6z',
        folder: 'M3 6h7l2 3h9v11H3z', check: 'M5 12l4 4L19 6',
      };
      return h('svg', {width:size, height:size, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.6, strokeLinecap:'round', strokeLinejoin:'round', 'aria-hidden':true}, h('path', {d:paths[kind] ?? paths.server}));
    }
    function Sheet({title, onDismiss, children}) {
      const ref = React.useRef(null);
      React.useEffect(() => { const node = ref.current; node.showModal(); return () => node.close(); }, []);
      return h('dialog', {ref, className:'dsh-ssh-dialog', 'aria-label':title,
        onCancel:event => {event.preventDefault(); event.stopPropagation(); onDismiss();},
        onKeyDown:event => {if (event.key === 'Escape') event.stopPropagation();}},
        h('header', {className:'dsh-ssh-dialog-head'}, h('h2', null, title),
          h('button', {type:'button', className:'ssh-icon-button', 'aria-label':'关闭弹窗', onClick:onDismiss}, h(Icon, {kind:'close'}))),
        children);
    }
    function SshSection(props) {
      const scope = props.scope;
      const snapshot = useSettingsSnapshot(scope);
      const connections = snapshot?.value?.connections ?? [];
      const writable = snapshot?.status === 'ready' && snapshot?.writable === true;
      const [mode, setMode] = React.useState(null);
      const [draft, setDraft] = React.useState({...DEFAULT});
      const [original, setOriginal] = React.useState('');
      const [password, setPassword] = React.useState('');
      const [remember, setRemember] = React.useState(false);
      const [busy, setBusy] = React.useState(false);
      const [error, setError] = React.useState('');
      const [notice, setNotice] = React.useState('');
      const [states, setStates] = React.useState({});
      const [candidates, setCandidates] = React.useState([]);
      const [selected, setSelected] = React.useState([]);
      const [query, setQuery] = React.useState('');
      const [discard, setDiscard] = React.useState(false);
      const [removing, setRemoving] = React.useState(false);
      const failure = e => ({
        SSH_PASSWORD_REQUIRED:'请先保存该连接的密码。',
        SSH_READ_ONLY:'当前为只读模式，无法修改连接。',
        SSH_HOST_NOT_ALLOWED:'此主机不在允许的连接列表中。',
        SSH_REQUEST_FAILED:'连接未完成，请检查网络、登录信息和主机指纹。',
      }[e.message] || '操作未完成，请检查连接信息后重试。');
      const edit = connection => {
        const value = {...DEFAULT, ...connection};
        setDraft(value); setOriginal(JSON.stringify(value)); setPassword(''); setRemember(false);
        setError(''); setDiscard(false); setRemoving(false); setMode('edit');
      };
      const dismiss = () => {
        if (busy) return;
        if (mode === 'edit' && (JSON.stringify(draft) !== original || password)) {setDiscard(true); return;}
        setMode(null); setError('');
      };
      const mutate = next => scope.mutate([{op:'set', path:['connections'], value:next}], snapshot.revision);
      const save = async event => {
        event.preventDefault(); if (busy) return;
        const value = {...draft, name:draft.name.trim(), host:draft.host.trim()};
        if (!value.name || !value.host) {setError('请填写显示名称和主机名。'); return;}
        if (/\s/.test(value.host) || value.host.startsWith('-')) {setError('请输入有效主机名、IP 地址或 SSH 别名。'); return;}
        if (value.host.includes('@') && !value.alias) {
          const parts = value.host.split('@');
          if (parts.length !== 2 || !parts[0] || !parts[1]) {setError('请使用 user@host 格式。'); return;}
          value.user = parts[0]; value.host = parts[1];
        }
        for (const [key,min,max] of [['port',1,65535],['connectTimeout',1,60],['keepalive',0,300]]) {
          value[key] = Number(value[key]);
          if (!Number.isInteger(value[key]) || value[key] < min || value[key] > max) {setError('请检查端口、连接超时和保活间隔的范围。'); return;}
        }
        if (value.authMode === 'key' && !value.identityFile.trim()) {setError('请填写私钥文件路径。'); return;}
        value.id ||= 'ssh-' + crypto.randomUUID().replaceAll('-', '').slice(0,24);
        setBusy(true); setError('');
        try {
          await mutate([...connections.filter(item => item.id !== value.id), value]);
          setDraft(value); setOriginal(JSON.stringify(value));
          if (password && value.authMode === 'password') {
            await sshRequest({action:'password', connectionId:value.id, password, remember});
          }
          setStates(previous => ({...previous, [value.id]:undefined}));
          setPassword(''); setMode(null); setNotice('连接已保存');
        } catch (e) {setError(failure(e));} finally {setBusy(false);}
      };
      const probe = async connection => {
        setStates(previous => ({...previous, [connection.id]:{kind:'pending', text:'正在测试…'}}));
        try {
          await sshRequest({action:'probe', connectionId:connection.id});
          setStates(previous => ({...previous, [connection.id]:{kind:'success', text:'连接测试通过'}}));
        } catch(e) {
          setStates(previous => ({...previous, [connection.id]:{kind:'error', text:'连接失败', detail:failure(e)}}));
        }
      };
      const discover = async () => {
        setMode('import'); setError(''); setCandidates([]); setSelected([]); setBusy(true);
        try {setCandidates((await sshRequest({action:'discover'})).connections);}
        catch(e) {setError(failure(e));} finally {setBusy(false);}
      };
      const addSelected = async () => {
        setBusy(true); setError('');
        try {await sshRequest({action:'import', hosts:selected}); setMode(null); setNotice('已添加所选连接');}
        catch(e) {setError(failure(e));} finally {setBusy(false);}
      };
      const remove = async () => {
        setBusy(true); setError('');
        try {
          await sshRequest({action:'clearPassword', connectionId:draft.id});
          await mutate(connections.filter(item => item.id !== draft.id));
          setMode(null); setNotice('连接已删除');
        } catch(e) {setError(failure(e));} finally {setBusy(false);}
      };
      const field = (key,label,placeholder='',type='text') => h('label', {className:'dsh-ssh-field', key},
        h('span', null, label),
        h('input', {type, 'data-dsh-ssh-field':key, value:draft[key] ?? '', placeholder, autoComplete:'off',
          required:['name','host'].includes(key), disabled:busy,
          min:type==='number' ? key==='keepalive' ? 0 : 1 : undefined,
          max:type==='number' ? key==='port' ? 65535 : key==='keepalive' ? 300 : 60 : undefined,
          onChange:event => {setDraft(previous => ({...previous,[key]:event.target.value})); setError('');}}));
      const primary = (text, onClick, disabled) => h('button', {type:'button', className:'ssh-primary', onClick, disabled}, text);
      const filtered = connections.filter(item => (item.name+' '+item.host).toLowerCase().includes(query.toLowerCase()));
      return h('section', {className:'dsh-ssh-settings', 'data-dsh-ssh-settings':true},
        h('header', {className:'dsh-ssh-header'}, h('h2', null, 'SSH连接'), h('p', null, '连接远程开发环境，在会话中访问项目和终端。')),
        h('div', {className:'ssh-list-heading'}, h('span', null, '已保存的连接', h('span', {className:'ssh-count'}, connections.length)),
          h('div', {className:'ssh-actions'},
            h('button', {onClick:discover, disabled:!writable, className:'ssh-quiet'}, h(Icon,{kind:'refresh',size:15}), '导入'),
            h('button', {onClick:() => edit(), disabled:!writable, className:'ssh-primary', 'aria-label':'新建连接'}, h(Icon,{kind:'plus',size:15}), '添加'))),
        connections.length > 5 && h('input', {className:'ssh-search', 'aria-label':'搜索连接', placeholder:'搜索名称或主机…', value:query, onChange:event => setQuery(event.target.value)}),
        h('div', {className:'ssh-connection-list'},
          !connections.length ? h('div', {className:'ssh-empty'}, h('span', {className:'ssh-empty-icon'}, h(Icon,{size:26})),
            h('h3', null, '添加你的第一个连接'), h('p', null, '手动配置服务器，或从本机 SSH 配置中导入。'),
            h('button', {onClick:() => edit(), disabled:!writable, className:'ssh-secondary'}, h(Icon,{kind:'plus',size:16}), '添加 SSH 连接'))
          : filtered.length ? filtered.map(connection => {
            const state = states[connection.id];
            return h('div', {key:connection.id, className:'ssh-connection-row', 'data-connection-id':connection.id},
              h('span', {className:'ssh-server-icon'}, h(Icon)),
              h('div', {className:'ssh-connection-info'}, h('strong', {title:connection.name}, connection.name),
                h('span', {className:'ssh-host', title:connection.host}, (connection.user ? connection.user+'@' : '')+connection.host+(connection.port !== 22 ? ':'+connection.port : '')),
                h('span', {className:'ssh-connection-state', 'data-state':state?.kind ?? 'idle', title:state?.detail}, h('i'), state?.text ?? '尚未测试')),
              h('div', {className:'ssh-row-actions'},
                h('button', {className:'ssh-quiet', disabled:state?.kind==='pending', onClick:() => probe(connection), 'aria-label':'测试连接 '+connection.name}, state?.kind==='error' ? '重试' : '测试'),
                h('button', {className:'ssh-icon-button', disabled:!writable, onClick:() => edit(connection), 'aria-label':'编辑连接 '+connection.name, title:'编辑连接'}, h(Icon,{kind:'edit',size:16}))));
          }) : h('p', {className:'ssh-no-results'}, '没有匹配的连接')),
        h('p', {className:'ssh-footnote'}, '连接信息保存在本机。选择会话右侧栏的 SSH 或终端，即可打开远程项目。'),
        notice && h('p', {role:'status', className:'ssh-notice'}, h(Icon,{kind:'check',size:15}), notice),
        !writable && h('p', {role:'status', className:'ssh-footnote'}, snapshot?.status==='loading' ? '正在加载连接…' : '当前连接设置为只读。'),
        mode && h(Sheet, {title:mode==='import' ? '导入 SSH 连接' : draft.id ? '编辑 SSH 连接' : '添加 SSH 连接', onDismiss:dismiss},
          error && h('p', {role:'alert', className:'ssh-error'}, error, mode==='import' && h('button',{type:'button',onClick:discover,disabled:busy},'重试')),
          mode==='import' ? h(React.Fragment, null,
            h('p', {className:'ssh-dialog-description'}, '选择要添加的本机 SSH 别名。现有连接会自动跳过。'),
            h('div', {className:'ssh-import-list'}, busy ? h('p', {role:'status', className:'ssh-no-results'}, '正在读取 SSH 配置…') :
              candidates.length ? candidates.map(item => {
                const exists = connections.some(old => old.host===item.host);
                return h('label', {className:'ssh-import-row', key:item.id}, h(Icon), h('span', null, h('strong', null, item.name), h('small', null, exists ? '已添加' : item.host)),
                  h('input', {type:'checkbox', disabled:exists, checked:exists || selected.includes(item.host), 'aria-label':item.name, onChange:event => setSelected(previous => event.target.checked ? [...previous,item.host] : previous.filter(host => host!==item.host))}));
              }) : !error && h('div', {className:'ssh-empty'}, h(Icon,{size:26}), h('h3',null,'没有发现可导入的连接'), h('p',null,'你可以手动添加主机信息。'))),
            h('footer', {className:'ssh-dialog-footer'}, h('button',{type:'button',className:'ssh-quiet',disabled:busy,onClick:() => edit()},'手动添加'),
              primary(selected.length ? '添加所选（'+selected.length+'）' : '添加所选', addSelected, busy || !selected.length)))
          : discard || removing ? h('div', {className:'ssh-confirm'},
              h('h3', null, removing ? '删除这个连接？' : '放弃未保存的修改？'),
              h('p', null, removing ? '连接记录和保存的密码将从本机移除，远程文件不受影响。' : '关闭后，本次编辑的内容将不会保存。'),
              h('footer', {className:'ssh-dialog-footer'}, h('button', {className:'ssh-quiet', disabled:busy,onClick:() => {setDiscard(false);setRemoving(false);}}, '继续编辑'),
                h('button', {className:removing ? 'ssh-danger' : 'ssh-primary', disabled:busy,onClick:removing ? remove : () => setMode(null)}, removing ? '确认删除' : '放弃修改')))
          : h('form', {onSubmit:save},
              h('div', {className:'ssh-form-body'},
                field('name','显示名称','例如：开发服务器'),
                field('host','主机名','host.com 或 user@host.com'),
                h('div', {className:'ssh-form-grid'}, field('user','用户名（可选）','使用默认用户'), field('port','SSH 端口','','number')),
                h('fieldset', {className:'ssh-auth'}, h('legend',null,'身份验证'),
                  h('div', {className:'ssh-segments'}, [['agent','SSH agent'],['key','身份文件'],['password','密码']].map(([value,label]) => h('button',{type:'button',key:value,'aria-pressed':draft.authMode===value,onClick:() => setDraft(previous => ({...previous,authMode:value})),disabled:busy},label))),
                  draft.authMode==='agent' ? h('p',{className:'ssh-help'},'使用本机 SSH agent 或 OpenSSH 默认密钥。') :
                  draft.authMode==='key' ? field('identityFile','私钥路径','~/.ssh/id_ed25519') :
                  h('div', {className:'ssh-password-fields'}, h('label',{className:'dsh-ssh-field'}, h('span',null,'密码'), h('input',{type:'password',value:password,autoComplete:'new-password',placeholder:draft.id ? '留空以保留已保存密码' : '输入连接密码',disabled:busy,onChange:event => setPassword(event.target.value)})),
                    h('label',{className:'ssh-checkbox'},h('input',{type:'checkbox',checked:remember,disabled:busy,onChange:event => setRemember(event.target.checked)}),'记住密码'),
                    h('p',{className:'ssh-help'},remember ? '保存在 Harness 本机凭据存储中。' : '仅在本次服务运行期间保留。'))),
                h('details',{className:'ssh-advanced'},h('summary',null,'高级设置'),h('div',{className:'ssh-form-grid'},
                  field('directory','远程目录','~'),field('jumpHost','跳板主机（可选）','user@jump.host'),
                  field('connectTimeout','连接超时（秒）','','number'),field('keepalive','保活间隔（秒）','','number')),
                  h('label',{className:'ssh-checkbox'},h('input',{type:'checkbox',checked:draft.alias,disabled:busy,onChange:event => setDraft(previous => ({...previous,alias:event.target.checked}))}),'使用本机 SSH 配置'))),
              h('footer',{className:'ssh-dialog-footer'},
                draft.id && h('button',{type:'button',className:'ssh-delete-link',disabled:busy,onClick:() => setRemoving(true)},'删除连接'),
                h('span',{className:'ssh-footer-spacer'}),
                h('button',{type:'button',className:'ssh-quiet',disabled:busy,onClick:dismiss},'取消'),
                h('button',{type:'submit',className:'ssh-primary',disabled:busy || !writable},busy ? '正在保存…' : '保存连接')))));
    }


    const targetListeners = new Set();
    const pickerListeners = new Set();
    const notifyTarget = id => {
      targetListeners.forEach(listener => listener(id));
      window.dispatchEvent(new CustomEvent('dsh-workspace-target-changed', {detail: {sessionId: id}}));
    };
    const readableError = error => ({
      SSH_INVALID_ACTION:'当前服务版本不支持此操作，请刷新页面后重试。',
      SSH_CONFIG_IMPORT_LIMIT:'SSH 配置包含过多嵌套文件，请简化 Include 后重试。',
      SSH_CONFIG_TOO_LARGE:'SSH 配置过大，暂时无法导入。',
      SSH_PASSWORD_REQUIRED:'请在 SSH 设置中保存该连接的密码。',
      SSH_READ_ONLY:'当前会话为只读模式，无法更改远程目标。',
      SSH_HOST_NOT_ALLOWED:'此主机不在允许的连接列表中。',
      SSH_PROMPT_INSERT_FAILED:'远程目录已连接，输入框暂时无法插入引用，请重试。',
    }[error.message] || '无法完成连接。请检查网络、SSH 登录配置和主机指纹后重试。');

    function RemotePicker({ctx, sessionId, onClose, createWorkspace = false, chooseLocation = false, onLocal}) {
      const [stage, setStage] = React.useState(chooseLocation ? 'location' : 'connections');
      const [connections, setConnections] = React.useState([]);
      const [connectionId, setConnectionId] = React.useState('');
      const [path, setPath] = React.useState('~');
      const [listing, setListing] = React.useState(null);
      const [query, setQuery] = React.useState('');
      const [hidden, setHidden] = React.useState(false);
      const [error, setError] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const controller = React.useRef(null);
      const commit = React.useRef(false);
      const alive = React.useRef(true);
      const current = connections.find(item => item.id === connectionId);
      const settingsScope = ctx.settingsScope.bind({namespace:SETTINGS_NS});
      const load = React.useCallback(async () => {
        try { const result = await sshRequest({action:'status', sessionId}); if (alive.current) setConnections(result.connections); }
        catch(e) {if (alive.current) setError(readableError(e));}
      }, [sessionId]);
      React.useEffect(() => {alive.current=true; void load(); return () => {alive.current=false;controller.current?.abort();};}, [load]);
      const dismiss = () => {if (!commit.current) {controller.current?.abort();onClose();}};
      const browse = async (id, directory) => {
        controller.current?.abort();
        const task = new AbortController(); controller.current = task;
        setConnectionId(id); setPath(directory); setStage('directory'); setBusy(true); setError(''); setListing(null);
        try {
          const result = await sshRequest({action:'browse', sessionId, connectionId:id, path:directory}, task.signal);
          if (!task.signal.aborted) {setListing(result);setPath(result.path);}
        } catch(e) {if (!task.signal.aborted) setError(readableError(e));}
        finally {if (!task.signal.aborted) setBusy(false);}
      };
      const useDirectory = async () => {
        if (!listing || busy || commit.current) return;
        commit.current = true; setBusy(true); setError('');
        try {
          if (createWorkspace) {
            const prepared = await sshRequest({action:'prepareWorkspace', connectionId, root:listing.path});
            const workspace = await ctx.workspaces.create({path:prepared.localPath});
            await ctx.workspaces.rename(workspace.workspaceId, prepared.title);
            const id = await ctx.sessions.create({workspaceId:workspace.workspaceId});
            // Workspace metadata is the inherited target for subsequent sessions.
            ctx.uiWorkspace.openSession(id);
            notifyTarget(id);
          } else {
            await sshRequest({action:'setTarget', sessionId, connectionId, root:listing.path});
            // Mirror PI-Desktop: the selected remote project is an inline,
            // removable reference in this prompt, not a second composer rail.
            if (!insertSshPromptReference(ctx, sessionId, connectionId, listing.path)) throw new Error('SSH_PROMPT_INSERT_FAILED');
            notifyTarget(sessionId);
          }
          onClose();
        } catch(e) {if (alive.current) setError(readableError(e));}
        finally {commit.current=false;if (alive.current) setBusy(false);}
      };
      const entries = listing?.entries.filter(item => (hidden || !item.name.startsWith('.')) && item.name.toLowerCase().includes(query.toLowerCase())) ?? [];
      const local = async () => {
        setBusy(true);
        try {const path = await ctx.uiWorkspace.pickDirectory();if (path) onLocal(path);else onClose();}
        catch {setError('无法打开本机目录选择器，请重试。');setBusy(false);}
      };
      const title = stage === 'location' ? '添加工作区' : stage === 'manage' ? '管理 SSH 连接' : 'SSH 连接';
      return h(Sheet, {title, onDismiss:dismiss},
        error && h('div',{className:'ssh-error',role:'alert'},error),
        stage === 'location' ? h('div',{className:'ssh-location-options'},
          h('p',{className:'ssh-dialog-description'},'选择项目所在的位置'),
          h('button',{className:'ssh-location-option','aria-label':'本机工作区',disabled:busy,onClick:local},h(Icon,{kind:'folder',size:22}),h('span',null,h('strong',null,'本机工作区'),h('small',null,'打开这台电脑上的项目文件夹')),h('span',null,'›')),
          h('button',{className:'ssh-location-option','aria-label':'远程工作区',disabled:busy,onClick:() => setStage('connections')},h(Icon,{size:22}),h('span',null,h('strong',null,'远程工作区'),h('small',null,'通过 SSH 连接服务器上的项目')),h('span',null,'›')))
        : stage === 'manage' ? h(React.Fragment,null,
          h(SshSection,{scope:settingsScope}),
          h('footer',{className:'ssh-dialog-footer'},h('button',{className:'ssh-secondary',onClick:() => {void load();setStage('connections');}},'返回连接列表')))
        : stage === 'connections' ? h(React.Fragment,null,
          h('input',{className:'ssh-search','aria-label':'搜索连接',placeholder:'搜索连接',value:query,onChange:event => setQuery(event.target.value)}),
          h('div',{className:'ssh-picker-connections'},
            connections.filter(item => (item.name+' '+item.host).toLowerCase().includes(query.toLowerCase())).map(item => h('button',{
              className:'ssh-picker-connection',key:item.id,onClick:() => {setQuery('');void browse(item.id,item.directory || '~');},'aria-label':'浏览远程目录 '+item.name},
              h(Icon),h('span',null,h('strong',null,item.name),h('small',null,item.host)),h(Icon,{kind:'folder'}),h('span',null,'›'))),
            !connections.length && h('div',{className:'ssh-empty'},h(Icon,{size:28}),h('h3',null,'还没有 SSH 连接'),h('p',null,'添加服务器信息，或导入本机 SSH 配置。'))),
          h('footer',{className:'ssh-dialog-footer'},h('button',{className:'ssh-secondary',onClick:() => {setQuery('');setStage('manage');}},'管理连接 / 导入')))
        : h(React.Fragment,null,
          h('label',{className:'dsh-ssh-field'},h('span',null,'远程主机'),h('select',{'aria-label':'远程主机',value:connectionId,disabled:busy,onChange:event => {setQuery('');const item=connections.find(c=>c.id===event.target.value);void browse(item.id,item.directory || '~');}},connections.map(item => h('option',{key:item.id,value:item.id},item.name)))),
          h('label',{className:'dsh-ssh-field ssh-directory-field'},h('span',null,'远程目录'),
            h('form',{className:'ssh-path-bar',onSubmit:event => {event.preventDefault();void browse(connectionId,path);}},
              h('button',{type:'button','aria-label':'上级目录',disabled:busy || !listing || listing.path==='/',onClick:() => {setQuery('');void browse(connectionId,listing.path.split('/').slice(0,-1).join('/') || '/');}},'↑'),
              h('input',{'aria-label':'远程路径',value:path,disabled:busy,spellCheck:false,onChange:event=>setPath(event.target.value)}),
              h('button',{type:'submit','aria-label':'转到目录',disabled:busy || !path.trim()},'→'))),
          h('div',{className:'ssh-directory-meta'},h('span',null,busy ? '正在读取目录…' : listing ? entries.length+' 个文件夹' : '尚未读取目录'),
            h('label',{className:'ssh-checkbox'},h('input',{type:'checkbox',checked:hidden,onChange:event=>setHidden(event.target.checked)}),'隐藏文件'),
            h('button',{'aria-label':'刷新目录',disabled:busy,onClick:()=>browse(connectionId,path)},h(Icon,{kind:'refresh',size:16}))),
          h('input',{className:'ssh-search','aria-label':'筛选文件夹',placeholder:'筛选当前目录中的文件夹',value:query,onChange:event=>setQuery(event.target.value)}),
          h('div',{className:'ssh-folder-list','aria-label':'远程文件夹'},
            entries.map(item=>h('button',{className:'ssh-folder-row',key:item.name,disabled:busy,onClick:()=>{setQuery('');void browse(connectionId,(listing.path==='/'?'':listing.path)+'/'+item.name);}},h(Icon,{kind:'folder',size:17}),h('span',null,item.name),h('span',null,'›'))),
            !busy && listing && !entries.length && h('p',{className:'ssh-no-results'},'当前目录没有匹配的子文件夹。'),
            busy && h('p',{className:'ssh-no-results',role:'status'},'正在连接 '+(current?.name ?? '')+'…')),
          listing?.truncated && h('p',{className:'ssh-help'},'目录较大，仅显示前 500 项。可在路径栏输入完整目录。'),
          h('footer',{className:'ssh-dialog-footer'},h('button',{className:'ssh-quiet',disabled:busy,onClick:()=>{setQuery('');setStage('connections');}},'返回'),
            h('span',{className:'ssh-footer-spacer'}),h('button',{className:'ssh-primary',disabled:busy || !listing || path!==listing.path,onClick:useDirectory},busy && commit.current ? '正在打开…' : '使用此目录'))));
    }
    function insertSshPromptReference(ctx, sessionId, connectionId, remotePath) {
      try {
        if (!sessionId) throw new Error('SSH_PROMPT_SESSION_UNAVAILABLE');
        const read = (owner, key) => { try { return owner?.[key]; } catch { return undefined; } };
        const sessions = read(ctx, 'sessions');
        const actx = sessions?.scope?.(sessionId) ?? read(ctx, 'scope')?.(sessionId) ?? ctx;
        const resolver = read(read(actx, 'conversation'), 'input')
          ?? actx?.get?.('conversation.input')
          ?? read(read(ctx, 'conversation'), 'input')
          ?? ctx?.get?.('conversation.input');
        const input = resolver?.for?.(actx) ?? (resolver?.state ? resolver : null);
        const snapshot = input?.state?.getSnapshot?.();
        if (!input || !snapshot) throw new Error('SSH_PROMPT_INPUT_UNAVAILABLE');
        const label = remotePath.split('/').filter(Boolean).at(-1) || '/';
        const ref = `@ssh://${encodeURIComponent(connectionId)}${remotePath}`;
        // Each existing chip occupies one detect-coordinate, regardless of its clipboard length.
        const end = snapshot.draft.length - (snapshot.occurrences ?? []).reduce((sum, item) => sum + item.length - 1, 0);
        return input.insertReference({source: 'reference', ref, label, appearance: 'folder', clipboardText: ref}, {start: end, end, draftRev: snapshot.draftRev});
      } catch (error) {console.warn('SSH prompt insertion:', error.message); return false;}
    }
    function WorkspaceFlow({ctx,open,onPicked,onCancel}) {
      return open ? h(RemotePicker,{ctx,createWorkspace:true,chooseLocation:true,onClose:onCancel,onLocal:onPicked}) : null;
    }
    function RemoteControl({ctx,sessionId,session}) {
      sessionId = sessionId ?? session?.id ?? session?.sessionId ?? ctx.sessions?.scopeOf?.(ctx);
      const [open,setOpen]=React.useState(false);
      const [target,setTarget]=React.useState(null);
      const [connections,setConnections]=React.useState([]);
      React.useEffect(()=>{
        let alive=true;
        const refresh=async id=>{
          if(id && id!==sessionId)return;
          try {const value=await sshRequest({action:'status',sessionId});if(alive){setTarget(value.target);setConnections(value.connections);}}catch{}
        };
        const show=id=>{if(id===sessionId)setOpen(true);};
        void refresh();
        targetListeners.add(refresh); pickerListeners.add(show);
        return ()=>{alive=false;targetListeners.delete(refresh);pickerListeners.delete(show);};
      },[sessionId]);
      const connection=connections.find(item=>item.id===target?.connectionId);
      return open ? h(RemotePicker,{ctx,sessionId,onClose:()=>setOpen(false)}) : null;
    }
    function RemotePickerHost({ctx,sessionId,session}) {
      const id=sessionId ?? session?.id ?? session?.sessionId;
      const [targetId,setTargetId]=React.useState(null);
      React.useEffect(()=>{const show=target=>{if(target && (!id || target===id))setTargetId(target);}; pickerListeners.add(show); return()=>pickerListeners.delete(show);},[id]);
      return targetId ? h(RemotePicker,{ctx,sessionId:targetId,onClose:()=>setTargetId(null)}) : null;
    }
    function SshFiles({sessionId, useTabInfo}) {
      const {tab} = useTabInfo();
      const [connections, setConnections] = React.useState([]);
      const [connectionId, setConnectionId] = React.useState('');
      const [root, setRoot] = React.useState('~');
      const [folder, setFolder] = React.useState('.');
      const [entries, setEntries] = React.useState([]);
      const [file, setFile] = React.useState(null);
      const [content, setContent] = React.useState('');
      const [projects, setProjects] = React.useState([]);
      const [status, setStatus] = React.useState('');
      const [busy, setBusy] = React.useState(false);
      const call = args => sshRequest({sessionId, connectionId, root, ...args});
      const run = async task => {
        setBusy(true);
        try { await task(); } catch (error) { setStatus(error.message); }
        finally { setBusy(false); }
      };
      React.useEffect(() => {
        if (!tab.visible) return;
        let alive = true;
        const refresh = id => {
        if (id && id !== sessionId) return;
        sshRequest({action: 'status', sessionId}).then(value => {
          if (!alive) return;
          setConnections(value.connections); setProjects(value.projects);
          setConnectionId(value.target?.connectionId ?? value.connections[0]?.id ?? '');
          setRoot(value.target?.path ?? value.connections[0]?.directory ?? '~');
          setStatus(value.target ? `${value.target.connectionId}: ${value.target.path}` : '未绑定远程项目');
        }).catch(error => { if (alive) setStatus(error.message); });
        };
        refresh(); targetListeners.add(refresh);
        return () => { alive = false; targetListeners.delete(refresh); };
      }, [sessionId, tab.visible]);
      const leaveFile = () => !file || content === file.content || window.confirm('放弃未保存的文件修改？');
      const changeTarget = (id, path) => {
        if (!leaveFile()) return;
        setConnectionId(id); setRoot(path); setFile(null); setContent(''); setEntries([]); setFolder('.');
      };
      const list = async (path = '.', extra = {}) => {
        const result = await call({action: 'list', path, ...extra});
        setEntries(result.entries); setFolder(path); setFile(null);
      };
      const connect = () => run(async () => {
        if (!leaveFile()) return;
        const result = await call({action: 'setTarget'});
        notifyTarget(sessionId);
        setRoot(result.target.path); setStatus(`已连接: ${result.target.path}`);
        await list('.', {root: result.target.path});
      });
      const open = entry => run(async () => {
        if (!leaveFile()) return;
        const path = folder === '.' ? entry.name : `${folder}/${entry.name}`;
        if (entry.kind === 'directory' || entry.isDirectory) await list(path);
        else {
          const result = await call({action: 'read', path});
          setFile({...result, relativePath: path, connectionId, root}); setContent(result.content);
        }
      });
      return React.createElement('section', {className: 'dsh-ssh-files', 'data-dsh-ssh-files': true},
        React.createElement('div', {className: 'dsh-ssh-file-toolbar'},
          React.createElement('select', {'aria-label': 'SSH连接', disabled: busy, value: connectionId, onChange: event => { const connection = connections.find(item => item.id === event.target.value); changeTarget(event.target.value, connection?.directory ?? '~'); }},
            React.createElement('option', {value: ''}, '选择连接'), connections.map(item => React.createElement('option', {key: item.id, value: item.id}, item.name))),
          React.createElement('input', {'aria-label': '远程目录', disabled: busy, value: root, onChange: event => changeTarget(connectionId, event.target.value)}),
          React.createElement('button', {disabled: busy || !connectionId, onClick: connect}, '连接'),
          React.createElement('button', {disabled: busy, onClick: () => run(async () => { if (!leaveFile()) return; await call({action: 'clearTarget'}); notifyTarget(sessionId); setEntries([]); setFile(null); setStatus('未绑定远程项目'); })}, '断开')),
        projects.length > 0 && React.createElement('select', {'aria-label': '远程项目历史', disabled: busy, value: '', onChange: event => { const item = projects[Number(event.target.value)]; if (item) changeTarget(item.connectionId, item.path); }}, React.createElement('option', {value: ''}, '远程项目历史'), projects.map((item, index) => React.createElement('option', {key: index, value: index}, `${item.connectionId}: ${item.path}`))),
        React.createElement('p', {role: 'status'}, busy ? '处理中' : status),
        React.createElement('div', {className: 'dsh-ssh-file-toolbar'},
          React.createElement('button', {disabled: busy || folder === '.', title: '上级目录', onClick: () => run(async () => { if (leaveFile()) await list(folder.split('/').slice(0, -1).join('/') || '.'); })}, '\u2191'),
          React.createElement('button', {disabled: busy, title: '刷新', onClick: () => run(async () => { if (leaveFile()) await list(folder); })}, '\u21bb'),
          React.createElement('span', null, file?.relativePath ?? folder)),
        file ? React.createElement(React.Fragment, null,
          React.createElement('textarea', {className: 'dsh-ssh-editor', 'aria-label': '远程文件', value: content, spellCheck: false, onChange: event => setContent(event.target.value)}),
          React.createElement('button', {disabled: busy || file.content === content, onClick: () => run(async () => { const saved = await call({action: 'write', connectionId: file.connectionId, root: file.root, path: file.relativePath, content, baseRevision: file.revision}); setFile({...file, content, revision: saved.revision}); setStatus('已保存'); })}, '保存文件'))
          : React.createElement('ul', {className: 'dsh-ssh-entries'}, entries.map(entry => React.createElement('li', {key: entry.name}, React.createElement('button', {disabled: busy, onClick: () => open(entry)}, `${entry.kind === 'directory' ? '\u25b8 ' : ''}${entry.name}`)))));
    }

    function installStyles() {
      if (typeof document === "undefined" || document.querySelector("style[data-dsh-ssh-style]") !== null) return;
      const style = document.createElement("style");
      style.dataset.dshSshStyle = "true";
      style.textContent = `

        .dsh-ssh-settings,.dsh-ssh-dialog,.dsh-ssh-files,.ssh-composer-control {
          --ssh-bg:var(--dsw-alias-bg-base,#fff);--ssh-panel:var(--dsw-alias-bg-layer-1,#fafafa);
          --ssh-text:var(--dsw-alias-label-primary,#202124);--ssh-muted:var(--dsw-alias-label-secondary,#75777e);
          --ssh-line:var(--dsw-alias-border-l3,#dedee2);--ssh-hover:var(--dsw-alias-interactive-bg-hover,#f0f0f3);
          color:var(--ssh-text);font:13px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;box-sizing:border-box;
        }
        .dsh-ssh-settings{max-width:860px;margin:0 auto;padding:28px 32px 34px}
        .dsh-ssh-header{margin:0 0 26px}.dsh-ssh-header h2{margin:0 0 8px;font-size:23px;line-height:1.35;letter-spacing:-.025em}.dsh-ssh-header p{margin:0;color:var(--ssh-muted);font-size:13px}
        .ssh-list-heading{display:flex;align-items:center;justify-content:space-between;margin:0 0 12px;font-weight:500}.ssh-count{margin-left:8px;color:var(--ssh-muted);font-size:12px}
        .ssh-actions,.ssh-row-actions{display:flex;align-items:center;gap:6px}
        :is(.dsh-ssh-settings,.dsh-ssh-dialog,.dsh-ssh-files) button{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:34px;padding:6px 12px;border:1px solid var(--ssh-line);border-radius:8px;background:transparent;color:inherit;font:inherit;cursor:pointer;transition:background .12s,border-color .12s}
        :is(.dsh-ssh-settings,.dsh-ssh-dialog,.dsh-ssh-files) button:hover:not(:disabled){background:var(--ssh-hover)}
        :is(.dsh-ssh-settings,.dsh-ssh-dialog,.dsh-ssh-files) button:disabled{opacity:.42;cursor:default}
        :is(.dsh-ssh-settings,.dsh-ssh-dialog) button.ssh-primary{background:var(--ssh-text);color:var(--ssh-bg);border-color:var(--ssh-text);border-radius:18px;padding:6px 17px;font-weight:500}
        :is(.dsh-ssh-settings,.dsh-ssh-dialog) button.ssh-primary:hover:not(:disabled){opacity:.88}
        :is(.dsh-ssh-settings,.dsh-ssh-dialog) button.ssh-quiet,:is(.dsh-ssh-settings,.dsh-ssh-dialog) button.ssh-icon-button{border-color:transparent;color:var(--ssh-muted)}
        button.ssh-icon-button{width:34px;padding:6px!important;flex:none}
        :is(.dsh-ssh-settings,.dsh-ssh-dialog,.dsh-ssh-files) :is(button,input,select,summary):focus-visible{outline:2px solid #79aef5;outline-offset:3px}
        .ssh-connection-list{border:1px solid var(--ssh-line);border-radius:14px;overflow:hidden;background:var(--ssh-panel)}
        .ssh-connection-row{display:flex;align-items:center;gap:12px;margin:0 16px;padding:15px 0;border-bottom:1px solid var(--ssh-line);min-width:0}.ssh-connection-row:last-child{border-bottom:0}
        .ssh-server-icon{display:grid;place-items:center;width:32px;height:32px;color:var(--ssh-muted);flex:none}
        .ssh-connection-info{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}.ssh-connection-info strong{font-size:14px;font-weight:500}.ssh-connection-info strong,.ssh-host{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ssh-host{font-size:12px;color:var(--ssh-muted)}
        .ssh-connection-state{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--ssh-muted)}.ssh-connection-state i{width:6px;height:6px;border-radius:50%;background:#8b8e95}.ssh-connection-state[data-state=success] i{background:#35b878}.ssh-connection-state[data-state=error] i{background:#ee6971}.ssh-connection-state[data-state=pending] i{background:#79aef5}
        .ssh-empty{text-align:center;padding:40px 20px;color:var(--ssh-muted)}.ssh-empty-icon{display:inline-flex}.ssh-empty h3{margin:12px 0 6px;color:var(--ssh-text);font-size:15px;font-weight:500}.ssh-empty p{margin:0 0 16px;font-size:12px}.ssh-empty>svg{margin:auto}
        .ssh-footnote,.ssh-notice{font-size:12px;color:var(--ssh-muted);margin:14px 0 0;line-height:1.65}.ssh-notice{display:flex;gap:6px;align-items:center}
        .dsh-ssh-dialog{width:min(540px,calc(100vw - 32px));max-height:calc(100dvh - 48px);padding:24px;border:1px solid var(--ssh-line);border-radius:20px;background:var(--ssh-bg);box-shadow:0 24px 80px #0004;overflow:auto;margin:auto}
        .dsh-ssh-dialog::backdrop{background:#0006;backdrop-filter:blur(2px)}
        .dsh-ssh-dialog-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin:0 0 22px}.dsh-ssh-dialog-head h2{margin:0;font-size:20px;line-height:1.4;letter-spacing:-.02em;font-weight:600}
        .ssh-form-body{display:flex;flex-direction:column;gap:18px}
        .dsh-ssh-field{display:flex;flex-direction:column;gap:7px;flex:1;min-width:0;margin:0;font-size:12px;font-weight:400;color:var(--ssh-muted)}
        .dsh-ssh-field>span{line-height:18px}
        :is(.dsh-ssh-dialog,.dsh-ssh-settings) :is(input:not([type=checkbox]),select){box-sizing:border-box;width:100%;height:38px;margin:0;padding:8px 11px;border:1px solid var(--ssh-line);border-radius:8px;background:transparent;color:var(--ssh-text);font:inherit;line-height:20px;outline:none}
        :is(.dsh-ssh-dialog,.dsh-ssh-settings) input::placeholder{color:var(--ssh-muted);opacity:.65}
        :is(.dsh-ssh-dialog,.dsh-ssh-settings) input:focus{border-color:#79aef5;box-shadow:0 0 0 2px #79aef51a}
        .ssh-form-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:16px}
        .ssh-auth{border:0;padding:0;margin:0;min-width:0}.ssh-auth legend{font-size:12px;line-height:18px;color:var(--ssh-muted);padding:0;margin:0 0 7px}
        .ssh-segments{display:flex;gap:3px;background:var(--ssh-hover);border-radius:9px;padding:3px}
        .dsh-ssh-dialog .ssh-segments button{flex:1;min-width:0;justify-content:center;border:0;background:transparent;padding:6px;min-height:30px;font-size:12px;color:var(--ssh-muted)}
        .dsh-ssh-dialog .ssh-segments button[aria-pressed=true]{background:var(--ssh-bg);color:var(--ssh-text);box-shadow:0 1px 4px #0002;border-radius:7px}
        .ssh-help{margin:8px 0 0;color:var(--ssh-muted);font-size:11px;line-height:1.6}.ssh-auth>.dsh-ssh-field,.ssh-password-fields{margin-top:14px}.ssh-password-fields{display:flex;flex-direction:column;gap:10px}
        .ssh-checkbox{display:flex;align-items:center;gap:7px;font-size:12px;color:var(--ssh-muted);line-height:20px;margin:0}.ssh-checkbox input,.ssh-import-row input{width:14px;height:14px;margin:0;accent-color:var(--ssh-text);flex:none}
        .ssh-advanced{border-top:1px solid var(--ssh-line);padding-top:16px;font-size:12px;color:var(--ssh-muted)}.ssh-advanced summary{cursor:pointer;line-height:22px}.ssh-advanced[open]>.ssh-form-grid{margin-top:16px}.ssh-advanced>.ssh-checkbox{margin-top:14px}
        .ssh-dialog-footer{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin:24px 0 0}.ssh-footer-spacer{flex:1}
        .dsh-ssh-dialog button.ssh-delete-link{color:#d65d65;border-color:transparent}.dsh-ssh-dialog button.ssh-danger{background:#c54451;color:#fff;border-color:#c54451}
        .ssh-error{padding:10px 12px;margin:0 0 16px;border-radius:8px;background:#ef626215;color:var(--dsw-alias-state-error-primary,#ce4552);font-size:12px;line-height:1.6}
        .ssh-dialog-description{margin:0 0 16px;color:var(--ssh-muted);font-size:12px}
        .ssh-import-list{max-height:330px;overflow:auto;border:1px solid var(--ssh-line);border-radius:12px}
        .ssh-import-row{display:flex;align-items:center;gap:12px;padding:13px 15px;border-bottom:1px solid var(--ssh-line);font-size:13px;cursor:pointer}.ssh-import-row:last-child{border-bottom:0}.ssh-import-row>span{display:flex;flex-direction:column;gap:3px;flex:1;min-width:0}.ssh-import-row strong{font-weight:500}.ssh-import-row small{color:var(--ssh-muted)}.ssh-import-row:hover{background:var(--ssh-hover)}
        .ssh-confirm h3{margin:0 0 8px;font-size:16px;font-weight:500}.ssh-confirm p{font-size:13px;color:var(--ssh-muted);line-height:1.6}
        .ssh-search{margin-bottom:14px!important}.ssh-no-results{margin:0;text-align:center;padding:28px 14px;font-size:12px;color:var(--ssh-muted)}
        .ssh-location-options{display:flex;flex-direction:column;gap:10px}.ssh-location-options p{margin-bottom:6px}.dsh-ssh-dialog .ssh-location-option,.dsh-ssh-dialog .ssh-picker-connection{display:flex;width:100%;justify-content:flex-start;text-align:left;gap:14px;padding:16px;border-radius:12px}
        .ssh-location-option>span:nth-child(2),.ssh-picker-connection>span:nth-child(2){display:flex;flex-direction:column;gap:4px;flex:1;min-width:0}.ssh-location-option strong,.ssh-picker-connection strong{font-size:14px;font-weight:500}.ssh-location-option small,.ssh-picker-connection small{color:var(--ssh-muted);font-size:12px;overflow-wrap:anywhere}
        .ssh-picker-connections{display:flex;flex-direction:column;gap:8px;max-height:340px;overflow:auto}.ssh-directory-field{margin-top:18px}
        .ssh-path-bar{display:flex;gap:6px;align-items:center}.ssh-path-bar input{flex:1;min-width:0}.ssh-path-bar button{border:0;padding:6px;min-width:28px}
        .ssh-directory-meta{display:flex;gap:10px;align-items:center;justify-content:space-between;margin:12px 0;color:var(--ssh-muted);font-size:11px}.ssh-directory-meta .ssh-checkbox{margin-left:auto}.ssh-directory-meta button{border:0;padding:3px;min-height:26px}
        .ssh-folder-list{border:1px solid var(--ssh-line);border-radius:12px;height:240px;overflow:auto;padding:5px}
        .dsh-ssh-dialog .ssh-folder-row{display:flex;width:100%;text-align:left;justify-content:flex-start;gap:12px;border:0;min-height:40px;padding:8px 12px}.ssh-folder-row span:nth-child(2){flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ssh-folder-row span:last-child{color:var(--ssh-muted)}.dsh-ssh-dialog .dsh-ssh-settings{padding:0}.dsh-ssh-dialog .dsh-ssh-settings>.dsh-ssh-header{display:none}
        .ssh-composer-control{display:inline-flex;align-items:center;flex:0 1 auto;min-width:0;max-width:180px}
        .ssh-target-chip{display:inline-flex;align-items:center;gap:6px;min-width:0;max-width:100%;height:28px;padding:0 6px;border:0;border-radius:8px;background:transparent;color:var(--ssh-muted);font:inherit;line-height:20px;white-space:nowrap;cursor:pointer;transition:background .12s,color .12s}
        .ssh-target-chip>svg,.ssh-control-label{flex:none}.ssh-target-chip:hover,.ssh-target-chip[aria-expanded=true]{background:var(--ssh-hover);color:var(--ssh-text)}.ssh-target-chip:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#79aef5);outline-offset:2px}
        .ssh-target-name{min-width:0;overflow:hidden;text-overflow:ellipsis;color:var(--ssh-text)}.ssh-chip-chevron{color:var(--ssh-muted)}
        @container(max-width:680px){.ssh-target-name{display:none}}
        @container(max-width:440px){.ssh-control-label{display:none}.ssh-target-chip{gap:3px;padding:0 4px}}
        .dsh-ssh-files{padding:14px;display:flex;flex-direction:column;gap:12px;height:100%;min-width:0;overflow:auto}.dsh-ssh-file-toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center;min-width:0}.dsh-ssh-files input,.dsh-ssh-files select{min-width:0;max-width:100%;flex:1;height:34px;padding:6px 9px;color:inherit;background:var(--ssh-bg);border:1px solid var(--ssh-line);border-radius:8px;font:inherit}.dsh-ssh-files p,.dsh-ssh-files span{overflow-wrap:anywhere;margin:0;font-size:12px;color:var(--ssh-muted)}.dsh-ssh-editor{flex:1;min-height:240px;padding:12px;border:1px solid var(--ssh-line);border-radius:8px;resize:vertical;font:12px/1.7 ui-monospace,monospace;color:inherit;background:var(--ssh-bg)}.dsh-ssh-entries{list-style:none;padding:0;margin:0}.dsh-ssh-entries button{border:0;width:100%;justify-content:flex-start;text-align:left;overflow-wrap:anywhere}
        @media(max-width:600px){.dsh-ssh-settings{padding:20px 16px}.dsh-ssh-dialog{padding:20px;width:calc(100vw - 24px);max-height:calc(100dvh - 24px)}.ssh-form-grid{grid-template-columns:1fr}.ssh-connection-row{margin:0 12px}}
        @media(prefers-reduced-motion:reduce){.dsh-ssh-settings *,.dsh-ssh-dialog *{transition:none!important}}
      `;
      document.head.appendChild(style);
    }

    const inject = ["slots", "locale", "settingsScope", "sidebarRightTabs", "sessions", "conversation"];
    function apply(ctx) {
      installStyles();
      const t = ctx.locale?.bind(NS);
      ctx.effect?.(() => ctx.locale?.register(NS, {zh: FALLBACK, en}), "dsh-plugin-ssh: dictionaries");
      const scope = ctx.settingsScope?.bind({namespace: SETTINGS_NS});
      const injected = () => ({scope});
      ctx.effect?.(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
        name: "settings.section",
        id: "ssh-connections",
        order: 30,
        label: () => t?.("nav") || FALLBACK.nav,
        locale: NS,
        inject: injected,
      }, SshSection)), "dsh-plugin-ssh: settings section");
      ctx.inject(['commandUi','sessions','workspaces','uiWorkspace'], scope => {
        ctx.slots.inject('conversation.input.overlay',()=>ctx.slots.register({name:'conversation.input.overlay',id:'ssh-picker-host',order:-100},props=>h(RemotePickerHost,{...props,ctx:scope})));
        scope.commandUi.decorate({name:'ssh',available:()=>true,ui:{kind:'action',run:session=>pickerListeners.forEach(listener=>listener(session.sessionId))}});
        for(const name of ['conversation.hero.workspace.directoryFlow','sidebar.workspaces.directoryFlow']) {
          scope.slots.inject(name,()=>scope.slots.register({name,priority:-1000},props=>h(WorkspaceFlow,{...props,ctx:scope})));
        }
      });
    }

    exports.apply = apply;
    exports.inject = inject;
    exports.name = "dsh-plugin-ssh";
    return module.exports;
  }
});
