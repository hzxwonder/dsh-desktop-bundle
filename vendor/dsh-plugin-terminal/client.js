window.__ModuleLoader__.load({id: 'dsh-plugin-terminal', factory: require => {
  const React = require('react');
  const h = React.createElement;

  const STATE_KEY = 'dsh-plugin-terminal/dock';
  const MIN_HEIGHT = 160;
  const DEFAULT_HEIGHT = 320;
  // The dock draws a one pixel top border, so the space it really takes from the
  // columns is the stored height plus that border.
  const DOCK_BORDER = 1;
  const MESSAGES = {
    TERMINAL_SESSION_REQUIRED: '会话不可用，请重新打开标签页',
    TERMINAL_WORKSPACE_CHANGED: '工作区已切换，请重试',
    TERMINAL_READ_ONLY: '当前会话为只读模式',
    TERMINAL_SSH_PLUGIN_UPDATE_REQUIRED: '请更新 SSH 插件后重启服务',
    TERMINAL_REMOTE_WORKSPACE_UNAVAILABLE: '远程工作区不可用，请检查 SSH 连接',
    TERMINAL_HOST_NOT_ALLOWED: '该 SSH 主机不在允许列表内',
    TERMINAL_INVALID_SESSION: '终端会话不存在',
    TERMINAL_SANDBOX_UNAVAILABLE: '当前沙箱策略无法启动本机终端',
    TERMINAL_START_FAILED: '本机终端启动失败',
    REMOTE_TERMINAL_START_FAILED: '远程终端启动失败，请检查 SSH 配置',
    SSH_CONNECTION_NOT_FOUND: 'SSH 连接不可用',
    REMOTE_TERMINAL_SESSION_CLOSED: '终端已退出',
    TERMINAL_SESSION_CLOSED: '终端已退出',
  };
  const message = error => MESSAGES[error?.message] ?? error?.message ?? '终端请求失败';

  function readState() {
    try { return JSON.parse(window.localStorage.getItem(STATE_KEY) ?? '{}'); } catch { return {}; }
  }
  function writeState(value) {
    try { window.localStorage.setItem(STATE_KEY, JSON.stringify(value)); } catch { /* storage is optional */ }
  }

  // The dock spans two registrations: the Session header toggle and the
  // frame-wide panel. One module-level store keeps both in sync.
  const stored = readState();
  const dock = {
    open: stored.open === true,
    height: Number.isFinite(stored.height) ? Math.max(MIN_HEIGHT, stored.height) : DEFAULT_HEIGHT,
  };
  const subscribers = new Set();
  function updateDock(patch) {
    Object.assign(dock, patch);
    writeState({open: dock.open, height: dock.height});
    for (const notify of [...subscribers]) notify();
  }
  function useDock() {
    const [, bump] = React.useReducer(count => count + 1, 0);
    React.useEffect(() => {
      subscribers.add(bump);
      return () => {subscribers.delete(bump);};
    }, [bump]);
    return dock;
  }

  const TERMINAL_STYLE = `
    .dsh-term-toggle{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:none;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#777);cursor:pointer}
    .dsh-term-toggle:hover{background:var(--dsw-alias-interactive-bg-hover,#eee);color:var(--dsw-alias-label-primary,#292929)}
    .dsh-term-toggle[aria-pressed="true"]{background:var(--dsw-alias-interactive-bg-hover,#eee);color:var(--dsw-alias-label-primary,#292929)}
    .dsh-term-toggle svg{width:16px;height:16px;display:block}
    .dsh-term-dock{--term-line:var(--dsw-alias-border-l3,#e7e7e7);--term-muted:var(--dsw-alias-label-secondary,#777);--term-hover:var(--dsw-alias-interactive-bg-hover,#eee);position:absolute;right:0;bottom:0;z-index:1;display:flex;flex-direction:column;min-width:0;max-height:calc(100% - 40px);color:var(--dsw-alias-label-primary,#292929);background:var(--dsw-alias-bg-base,#fff);border-top:1px solid var(--term-line);overflow:hidden;letter-spacing:0}
    .dsh-term-dock *{box-sizing:border-box;letter-spacing:0}
    .dsh-term-grip{height:5px;flex:none;cursor:ns-resize;background:transparent}
    .dsh-term-dock .dsh-term-grip:hover{background:var(--term-hover)}
    .dsh-term-bar{display:flex;align-items:center;gap:6px;min-height:34px;padding:2px 8px;flex:none;border-bottom:1px solid var(--term-line)}
    .dsh-term-tabs{display:flex;align-items:center;gap:4px;flex:1;min-width:0;overflow-x:auto;scrollbar-width:none}
    .dsh-term-tabs::-webkit-scrollbar{display:none}
    .dsh-term-dock .dsh-term-tab{display:inline-flex;align-items:center;gap:6px;max-width:190px;height:26px;padding:0 10px;border:0;border-radius:7px;background:transparent;color:var(--term-muted);font:12px/1 system-ui;cursor:pointer;white-space:nowrap}
    .dsh-term-tab.is-active{background:var(--term-hover);color:var(--dsw-alias-label-primary,#292929)}
    .dsh-term-tab.is-running::before{content:'';width:6px;height:6px;flex:none;border-radius:50%;background:#38965e}
    .dsh-term-tab.is-exited::before{content:'';width:6px;height:6px;flex:none;border-radius:50%;background:#c9c9c9}
    .dsh-term-tab-label{overflow:hidden;text-overflow:ellipsis}
    .dsh-term-dock .dsh-term-action{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;flex:none;padding:0;border:0;border-radius:7px;background:transparent;color:var(--term-muted);font:14px/1 system-ui;cursor:pointer}
    .dsh-term-dock .dsh-term-action svg{width:14px;height:14px;display:block}
    .dsh-term-dock .dsh-term-action:hover:not(:disabled){background:var(--term-hover);color:var(--dsw-alias-label-primary,#292929)}
    .dsh-term-dock .dsh-term-action:disabled{opacity:.4;cursor:default}
    .dsh-term-where{max-width:150px;flex:none;padding:0 6px;color:var(--term-muted);font:12px/1 system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dsh-term-body{display:flex;flex-direction:column;flex:1;min-height:0;position:relative}
    .dsh-term-view{flex:1;min-height:0;padding:6px 10px;overflow:hidden}
    .dsh-term-view .xterm{height:100%}
    .dsh-term-view .xterm-viewport{overflow-y:auto!important}
    .dsh-term-empty{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:var(--term-muted);font:12px system-ui}
    .dsh-term-status{display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none;min-height:22px;padding:2px 12px;border-top:1px solid var(--term-line);color:var(--term-muted);font:11px system-ui}
    .dsh-term-status span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  `;

  function themeFor(element) {
    const css = getComputedStyle(element);
    const background = css.getPropertyValue('--dsw-alias-bg-base').trim() || '#ffffff';
    const foreground = css.getPropertyValue('--dsw-alias-label-primary').trim() || '#292929';
    return {background, foreground, cursor: foreground, selectionBackground: '#739ac540', green: '#38965e', brightGreen: '#58b77f'};
  }

  let asset;
  /** xterm is one Host-served asset; both halves load once per page. */
  function loadAsset() {
    return asset ??= Promise.all([
      fetch('/api/dsh-terminal/panel.js').then(response => {
        if (!response.ok) throw new Error('TERMINAL_ASSET_FAILED');
        return response.text();
      }).then(async source => {
        const url = URL.createObjectURL(new Blob([source], {type: 'text/javascript'}));
        try { return await import(url); } finally {URL.revokeObjectURL(url);}
      }),
      fetch('/api/dsh-terminal/panel.css').then(response => response.ok ? response.text() : '')
        .then(css => {
          const style = document.createElement('style');
          style.dataset.plugin = 'dsh-plugin-terminal/xterm';
          style.textContent = css;
          document.head.appendChild(style);
        }),
    ]).then(([module]) => module).catch(error => { asset = null; throw error; });
  }

  /**
   * The shell frame that lays out the left column, the content and the right
   * column, the overlay layer the frame renders above them, and the left column
   * that keeps its own height. Which child is the left column depends on the
   * shell — a shell may lead the frame with a caption strip — so it is found by
   * position: the full-height child on the frame's left edge.
   */
  function shellFrame() {
    const layer = document.querySelector('[data-shell-overlay]');
    const frame = layer?.parentElement;
    if (!layer || !frame) return null;
    const bounds = frame.getBoundingClientRect();
    let sidebar = null;
    let width = -1;
    for (const child of frame.children) {
      if (child === layer) continue;
      const rect = child.getBoundingClientRect();
      if (rect.width <= 0 || rect.height < bounds.height - 1) continue;
      if (Math.abs(rect.left - bounds.left) > 1) continue;
      if (rect.width > width) {sidebar = child; width = rect.width;}
    }
    return {layer, frame, sidebar};
  }

  // The toggle and every dock action share one 16-unit stroke set. Text glyphs
  // (`+`, `×`, `⌄`) render at a different optical size in every font, which is
  // what makes a toolbar look misaligned.
  const ICON_PATHS = {
    terminal: ['M3 4.3 6.2 7.5 3 10.7', 'M7.8 10.7h5.4'],
    plus: ['M8 3.4v9.2', 'M3.4 8h9.2'],
    close: ['M4.6 4.6 11.4 11.4', 'M11.4 4.6 4.6 11.4'],
    chevron: ['M4.8 6.6 8 9.8l3.2-3.2'],
  };
  function glyph(name) {
    return h('svg', {
      viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5,
      strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
    }, ICON_PATHS[name].map(d => h('path', {key: d, d})));
  }

  /** Session header control: the top-right entry point into the dock. */
  function TerminalToggle() {
    const state = useDock();
    return h('button', {
      type: 'button',
      className: 'dsh-term-toggle',
      'data-dsh-terminal': 'toggle',
      'aria-label': '终端面板',
      'aria-pressed': state.open,
      title: state.open ? '收起终端面板' : '打开终端面板',
      onClick: () => updateDock({open: !dock.open}),
    }, glyph('terminal'));
  }

  /** Frame-wide panel docked to the bottom of the content area. */
  function TerminalDock({useSessions}) {
    const state = useDock();
    const sessionId = useSessions?.(snapshot => snapshot?.current) ?? undefined;
    const open = state.open;
    const height = state.height;
    const [offset, setOffset] = React.useState(0);
    const [connections, setConnections] = React.useState([]);
    const [sessions, setSessions] = React.useState([]);
    // The attach path awaits the xterm asset, so it reads the tab list through a
    // ref: by the time the await returns, state may already have dropped this tab.
    const liveSessions = React.useRef([]);
    React.useEffect(() => {liveSessions.current = sessions;}, [sessions]);
    const [active, setActive] = React.useState('');
    const [status, setStatus] = React.useState('');
    const [activity, setActivity] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    // The view node is state, not a ref: attaching has to run again when the
    // element appears, or a panel that renders late never gets its terminal.
    const [viewNode, setViewNode] = React.useState(null);
    const [limit, setLimit] = React.useState(() => Math.round(Math.max(MIN_HEIGHT, (window.innerHeight || DEFAULT_HEIGHT * 2) * 0.85)));
    const terminals = React.useRef(new Map());
    const performing = React.useRef(false);
    const alive = React.useRef(null);
    const lifetime = React.useRef(null);
    const workspace = React.useRef(null);
    const opening = React.useRef(false);
    const seeded = React.useRef('');

    React.useEffect(() => {
      const controller = new AbortController();
      lifetime.current = controller;
      return () => {controller.abort(); lifetime.current = null;};
    }, []);

    // A stored height belongs to the window it was dragged in; a smaller window
    // clamps it instead of pushing the panel's footer below the frame.
    React.useEffect(() => {
      const measure = () => setLimit(Math.round(Math.max(MIN_HEIGHT, window.innerHeight * 0.85)));
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }, []);
    const panelHeight = Math.min(height, limit);

    const call = React.useCallback(async (args, signal) => {
      if (typeof sessionId !== 'string') throw new Error('TERMINAL_SESSION_REQUIRED');
      const response = await fetch('/api/dsh-terminal', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({sessionId, workspaceKey: workspace.current?.key, ...args}),
        signal,
      });
      const value = await response.json();
      if (!response.ok) throw new Error(value.detail ?? value.error ?? 'TERMINAL_REQUEST_FAILED');
      return value;
    }, [sessionId]);

    const report = React.useCallback(error => setStatus(message(error)), []);

    // The panel starts where the left column ends, and follows its width.
    React.useEffect(() => {
      const shell = shellFrame();
      if (!shell) return undefined;
      const measure = () => {
        const left = shell.sidebar
          ? Math.round(shell.sidebar.getBoundingClientRect().right - shell.frame.getBoundingClientRect().left)
          : 0;
        setOffset(left);
      };
      measure();
      const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
      if (shell.sidebar) resize?.observe(shell.sidebar);
      const mutate = new MutationObserver(measure);
      mutate.observe(shell.frame, {attributes: true, attributeFilter: ['style', 'data-sidebar-collapsed']});
      window.addEventListener('resize', measure);
      return () => {resize?.disconnect(); mutate.disconnect(); window.removeEventListener('resize', measure);};
    }, []);

    // Reserve the strip the panel occupies by shortening the columns that reach
    // the frame's bottom edge, so the composer and the right column end above the
    // panel instead of hiding behind it. Padding is not enough: a column lays its
    // own content out at the frame's full height, so the lower part of the right
    // column stays under the panel. The left column keeps its height, and a
    // column that appears later (a right column that was collapsed) is reserved
    // when it mounts.
    React.useEffect(() => {
      if (!open) return undefined;
      const shell = shellFrame();
      if (!shell) return undefined;
      const reserved = new Map();
      const reserve = () => {
        const bounds = shell.frame.getBoundingClientRect();
        for (const child of shell.frame.children) {
          if (child === shell.layer || child === shell.sidebar || reserved.has(child)) continue;
          const rect = child.getBoundingClientRect();
          if (rect.width <= 0 || rect.bottom < bounds.bottom - 1) continue;
          const style = getComputedStyle(child);
          const floating = style.position === 'absolute' || style.position === 'fixed';
          const previous = floating
            ? {bottom: child.style.bottom}
            : {height: child.style.height, alignSelf: child.style.alignSelf, boxSizing: child.style.boxSizing};
          if (floating) child.style.bottom = `${panelHeight + DOCK_BORDER}px`;
          else {
            child.style.boxSizing = 'border-box';
            child.style.height = `calc(100% - ${panelHeight + DOCK_BORDER}px)`;
            child.style.alignSelf = 'start';
          }
          reserved.set(child, previous);
        }
      };
      reserve();
      // A column that was collapsed when the panel opened is reserved as soon as
      // it takes up width again, and one that mounts later is caught by the child
      // list watch.
      const sizes = typeof ResizeObserver === 'function' ? new ResizeObserver(() => reserve()) : null;
      const observe = () => {
        if (!sizes) return;
        sizes.disconnect();
        for (const child of shell.frame.children) sizes.observe(child);
      };
      const watch = new MutationObserver(() => {observe(); reserve();});
      watch.observe(shell.frame, {childList: true, attributes: true, attributeFilter: ['class', 'style', 'data-sidebar-collapsed']});
      observe();
      return () => {
        watch.disconnect();
        sizes?.disconnect();
        for (const [child, previous] of reserved) {
          child.style.bottom = previous.bottom ?? '';
          child.style.height = previous.height ?? '';
          child.style.alignSelf = previous.alignSelf ?? '';
          child.style.boxSizing = previous.boxSizing ?? '';
        }
      };
    }, [open, panelHeight]);

    // A terminal belongs to the Session that opened it, so switching Sessions
    // empties the panel before the new Session's own list arrives.
    React.useEffect(() => {
      setSessions([]);
      setActive('');
      setStatus('');
    }, [sessionId]);

    // Workspace facts, the terminals of the Session, and the environment a new
    // terminal will use. Facts are tagged with the Session they describe: a
    // Session that just changed has none yet, and acting on the previous one's
    // facts is what the Host refuses as a changed workspace.
    React.useEffect(() => {
      if (!open || typeof sessionId !== 'string') return undefined;
      const controller = new AbortController();
      alive.current = controller;
      let timer;
      const poll = async () => {
        try {
          const facts = await call({action: 'workspace'}, controller.signal);
          if (controller.signal.aborted) return;
          workspace.current = {...facts, session: sessionId};
          const listed = await call({action: 'listTerminals'}, controller.signal);
          if (controller.signal.aborted) return;
          setSessions(listed);
          setActive(old => listed.some(item => item.sessionId === old) ? old : listed[0]?.sessionId ?? '');
        } catch (error) {
          if (!controller.signal.aborted) report(error);
        }
        if (!controller.signal.aborted) timer = setTimeout(poll, 2000);
      };
      void poll();
      call({action: 'connections'}, controller.signal).then(value => {
        if (!controller.signal.aborted) setConnections(value.connections ?? []);
      }).catch(() => {});
      return () => {
        controller.abort();
        clearTimeout(timer);
        if (alive.current === controller) alive.current = null;
      };
    }, [open, sessionId, call, report]);

    // Attach xterm for the active terminal and pump its output stream.
    React.useEffect(() => {
      if (!open || !active || !viewNode) return undefined;
      const id = active;
      const controller = new AbortController();
      const send = (args, signal) => call({terminalId: id, ...args}, signal);
      let timer;
      const attach = async () => {
        try {
          const module = await loadAsset();
          if (controller.signal.aborted) return;
          // The tab can be closed while the asset is still loading; building an
          // xterm for it here would leave one nobody disposes.
          if (!liveSessions.current.some(item => item.sessionId === id)) return;
          let entry = terminals.current.get(id);
          if (!entry) {
            const terminal = new module.Terminal({
              cursorBlink: true,
              fontSize: 13,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              scrollback: 5000,
              screenReaderMode: true,
              theme: themeFor(viewNode),
            });
            const fitAddon = new module.FitAddon();
            terminal.loadAddon(fitAddon);
            terminal.open(viewNode);
            terminal.textarea?.setAttribute('aria-label', '终端输入');
            terminal.attachCustomKeyEventHandler(event => {
              if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return true;
              if (event.key === 'C' || event.key === 'c') {
                const selection = terminal.getSelection();
                if (selection) { void navigator.clipboard?.writeText(selection); return false; }
              }
              if (event.key === 'V' || event.key === 'v') {
                void navigator.clipboard?.readText().then(text => text && terminal.paste(text)).catch(() => {});
                return false;
              }
              return true;
            });
            entry = {
              id, terminal, fit: fitAddon, cursor: 0, pumped: false, exited: false, queue: Promise.resolve(),
              writes: new AbortController(), observer: undefined, themeObserver: undefined,
            };
            terminals.current.set(id, entry);
            // Keystrokes ride the entry's own signal, in order. The attach
            // controller dies on every tab switch, and a write bound to it is
            // rejected from then on — the terminal looks connected and refuses
            // to type.
            terminal.onData(text => {
              // A shell that has exited keeps its prompt on screen, so typing
              // into it would only produce one refused request per keystroke.
              if (workspace.current?.readOnly || entry.exited) return;
              const signal = entry.writes.signal;
              entry.queue = entry.queue
                .then(() => call({terminalId: id, action: 'writeTerminal', text}, signal))
                .catch(error => {
                  if (signal.aborted) return;
                  if (String(error?.message).includes('SESSION_CLOSED')) { entry.exited = true; setStatus('终端已退出'); return; }
                  report(error);
                });
            });
            entry.themeObserver = new MutationObserver(() => {terminal.options.theme = themeFor(viewNode);});
            entry.themeObserver.observe(document.documentElement, {attributes: true});
          }
          // Only the terminal on screen holds a box in the view. Stacked xterms
          // leave the inactive one showing and push the active one — the one
          // that takes the focus — below the dock, out of sight.
          //
          // The view box is recreated whenever the panel is collapsed and
          // reopened, while these instances survive it, so an element that
          // belongs to a previous box has to move back into the current one.
          // Without that the terminal stays connected and typable while nothing
          // of it is on screen.
          // A terminal that is closed while its xterm is still loading leaves an
          // element nobody owns behind, and a stray element still counts as
          // visible: it pushes the live terminal out of the box. Only elements
          // that belong to a terminal the panel still shows may stay.
          const owned = new Set([...terminals.current.values()].map(item => item.terminal.element));
          for (const node of [...viewNode.children]) {
            if (node.classList?.contains('xterm') && !owned.has(node)) node.remove();
          }
          for (const [key, item] of terminals.current) {
            const node = item.terminal.element;
            if (!node) continue;
            const wanted = key === id;
            if (node.parentElement !== viewNode) {
              viewNode.appendChild(node);
              item.terminal.refresh(0, item.terminal.rows - 1);
            } else if (wanted && !item.shown) {
              // A hidden terminal stops painting, so the rows it kept from an
              // earlier visit are repainted only when it is asked to.
              item.terminal.refresh(0, item.terminal.rows - 1);
            }
            item.shown = wanted;
            node.style.display = wanted ? '' : 'none';
          }
          entry.terminal.focus();
          const fit = () => {
            if (!viewNode.clientWidth || !viewNode.clientHeight) return;
            entry.fit.fit();
            // No pty is left to size once the shell has exited.
            if (!entry.pumped || entry.exited || workspace.current?.readOnly) return;
            void call({terminalId: id, action: 'resizeTerminal', cols: entry.terminal.cols, rows: entry.terminal.rows}, entry.writes.signal).catch(() => {});
          };
          entry.observer?.disconnect();
          entry.observer = new ResizeObserver(fit);
          entry.observer.observe(viewNode);
          const pump = async () => {
            try {
              const result = await send({action: 'readTerminal', cursor: entry.cursor}, controller.signal);
              if (controller.signal.aborted) return;
              if (result.reset) entry.terminal.reset();
              const first = !entry.pumped;
              entry.cursor = result.cursor;
              entry.pumped = true;
              if (result.text) await new Promise(resolve => entry.terminal.write(result.text, resolve));
              // The first read is the earliest moment the panel knows this
              // terminal is alive, and the fit before it could not size the PTY.
              // Without this the shell keeps the size of whatever client sized it
              // before until the container happens to be resized again.
              if (first) fit();
              if (result.status?.kind === 'exited') {
                entry.exited = true;
                setStatus('终端已退出');
                // Mark the tab and the label from the stream itself instead of
                // leaving them on the previous state until the next poll.
                setSessions(old => old.map(item => (item.sessionId === id ? {...item, status: result.status} : item)));
                return;
              }
            } catch (error) {
              if (!controller.signal.aborted) report(error);
            }
            if (!controller.signal.aborted) timer = setTimeout(pump, 120);
          };
          fit();
          void pump();
        } catch (error) {
          if (!controller.signal.aborted) report(error);
        }
      };
      void attach();
      return () => {
        controller.abort();
        clearTimeout(timer);
        for (const entry of terminals.current.values()) {
          entry.observer?.disconnect();
          entry.observer = undefined;
        }
      };
    }, [open, active, viewNode, call, report]);

    // Terminal instances outlive tab switches; the panel disposes them.
    React.useEffect(() => () => {
      for (const entry of terminals.current.values()) {
        entry.observer?.disconnect();
        entry.themeObserver?.disconnect();
        entry.writes?.abort();
        entry.terminal.dispose();
      }
      terminals.current.clear();
    }, []);

    const perform = React.useCallback(async args => {
      // In flight, not merely busy: the panel states what it is doing instead of
      // swallowing the request, so a slow Host never looks like a dead button.
      if (performing.current) return false;
      performing.current = true;
      setBusy(true);
      setStatus('');
      setActivity({openTerminal: '正在新建终端…', closeTerminal: '正在关闭终端…'}[args.action] ?? '');
      // Every action but opening addresses one terminal, and the Host refuses a
      // request without that id.
      const scoped = args.action === 'openTerminal' ? args : {terminalId: active, ...args};
      try {
        const result = await call(scoped, lifetime.current?.signal);
        if (args.action === 'openTerminal') {
          setSessions(old => [...old, result]);
          setActive(result.sessionId);
          updateDock({open: true});
        } else if (args.action === 'closeTerminal') {
          const closed = terminals.current.get(active);
          terminals.current.delete(active);
          closed?.observer?.disconnect();
          closed?.themeObserver?.disconnect();
          closed?.writes?.abort();
          closed?.terminal?.element?.remove();
          closed?.terminal?.dispose();
          setSessions(old => old.filter(item => item.sessionId !== active));
          setActive('');
        }
        return true;
      } catch (error) {
        if (!lifetime.current?.signal.aborted) {
          // A terminal the Host no longer knows is dropped instead of being left
          // as a tab that fails every action until the next poll agrees.
          if (error?.message === 'TERMINAL_INVALID_SESSION') {
            setSessions(old => old.filter(item => item.sessionId !== active));
            setActive('');
          }
          // A workspace that moved under the request is retried by the next poll
          // with the facts of the Session the panel is showing now.
          if (error?.message === 'TERMINAL_WORKSPACE_CHANGED') seeded.current = '';
          report(error);
        }
        return false;
      } finally {
        performing.current = false;
        if (!lifetime.current?.signal.aborted) { setBusy(false); setActivity(''); }
      }
    }, [active, call, report]);

    const create = React.useCallback(() => {
      if (opening.current) return Promise.resolve(false);
      opening.current = true;
      // Where the terminal opens is the Session's own workspace — the local
      // directory or the SSH host it is bound to — so no target has to be
      // chosen before the panel can be used.
      return perform({action: 'openTerminal'}).finally(() => {opening.current = false;});
    }, [perform]);

    // Opening the dock on a Session without terminals starts one in that
    // Session's own workspace, which is what the toggle promises. The workspace
    // facts have to describe this Session: the previous Session's key would be
    // refused as a changed workspace, so the attempt waits for the poll instead
    // of being marked as done. It is marked only once the request really starts,
    // so an attempt that never left the client is retried by the next poll.
    React.useEffect(() => {
      if (!open || typeof sessionId !== 'string' || seeded.current === sessionId) return;
      if (workspace.current?.session !== sessionId) return;
      if (workspace.current.readOnly || !workspace.current.root) return;
      if (sessions.length) return;
      void create().then(started => {if (started) seeded.current = sessionId;});
    }, [open, sessionId, sessions, create]);

    const startResize = event => {
      event.preventDefault();
      const startY = event.clientY;
      const startHeight = dock.height;
      const move = moveEvent => updateDock({
        height: Math.max(MIN_HEIGHT, Math.min(startHeight + (startY - moveEvent.clientY), limit)),
      });
      const finish = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', finish);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', finish);
    };

    if (!open || typeof sessionId !== 'string') return null;
    // Only facts that describe the Session on screen count: a Session that just
    // changed shows its own environment as soon as the poll returns.
    const facts = workspace.current?.session === sessionId ? workspace.current : null;
    const readOnly = facts?.readOnly === true;
    const unavailable = facts !== null && !facts.root;
    const tabLabel = item => item.host === 'localhost' ? '本机' : (connections.find(connection => connection.id === item.connectionId)?.name ?? item.host);
    const current = sessions.find(item => item.sessionId === active);
    // A terminal lives in the Session's own workspace — the local directory or
    // the SSH host the workspace is bound to — so the bar states where a new one
    // opens instead of asking for a target first.
    const location = facts?.kind === 'ssh' ? `SSH · ${facts.label}` : (facts?.label ?? '本机');
    const button = (label, title, disabled, onClick, extra = {}) => h('button', {
      type: 'button', className: 'dsh-term-action', 'aria-label': title, title, disabled, onClick, ...extra,
    }, label);

    return h('section', {
      className: 'dsh-term-dock', 'data-dsh-terminal': 'dock',
      style: {height: panelHeight, left: offset}, 'aria-label': '终端面板',
    },
      h('div', {className: 'dsh-term-grip', role: 'separator', 'aria-label': '调整终端高度', onPointerDown: startResize}),
      h('div', {className: 'dsh-term-bar'},
        h('div', {className: 'dsh-term-tabs'},
          sessions.map(item => h('button', {
            key: item.sessionId, type: 'button',
            className: `dsh-term-tab${item.sessionId === active ? ' is-active' : ''}${item.status?.kind === 'exited' ? ' is-exited' : ' is-running'}`,
            title: `${item.host}${item.cwd ? ` · ${item.cwd}` : ''} · 点击切换`,
            onClick: () => setActive(item.sessionId),
          }, h('span', {className: 'dsh-term-tab-label'}, tabLabel(item)))),
          !sessions.length && h('span', {style: {color: 'var(--term-muted)', font: '12px system-ui', paddingLeft: 6}}, '终端')),
        h('span', {
          className: 'dsh-term-where', 'data-dsh-terminal': 'where',
          title: `终端跟随当前工作区：${location}`,
        }, location),
        button(glyph('plus'), '新建终端', busy || readOnly || unavailable, create),
        button(glyph('close'), '关闭当前终端', busy || readOnly || !active, () => void perform({action: 'closeTerminal'})),
        button(glyph('chevron'), '收起终端面板', false, () => updateDock({open: false}))),
      h('div', {className: 'dsh-term-body'},
        h('div', {className: 'dsh-term-view', ref: setViewNode, 'aria-label': '终端输出'}),
        !active && h('div', {className: 'dsh-term-empty'}, unavailable ? '当前工作区不可用' : '点击 + 新建终端')),
      h('div', {className: 'dsh-term-status'},
        h('span', null, status || activity || current?.cwd || (readOnly ? '只读模式' : '')),
        h('span', null, readOnly ? '只读' : !active ? '未连接' : current?.status?.kind === 'exited' ? '已退出' : '已连接')));
  }

  function apply(ctx) {
    ctx.effect(() => {
      const style = document.createElement('style');
      style.dataset.plugin = 'dsh-plugin-terminal';
      style.textContent = TERMINAL_STYLE;
      document.head.appendChild(style);
      return () => style.remove();
    });
    ctx.effect(() => ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
      name: 'conversation.session.header.utilities',
      id: 'dsh-plugin-terminal/toggle',
      order: 5,
    }, TerminalToggle)));
    ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
      name: 'shell.overlay',
      id: 'dsh-plugin-terminal/dock',
      order: 30,
    }, TerminalDock)));
  }

  return {name: 'dsh-plugin-terminal', inject: ['slots'], apply};
}});
