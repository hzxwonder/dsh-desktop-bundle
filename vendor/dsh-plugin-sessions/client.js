window.__ModuleLoader__.load({
  id: 'dsh-plugin-sessions',
  factory: require => {
    const React = require('react');
    const h = React.createElement;
    const inject = ['slots', 'sessions', 'uiWorkspace'];
    function apply(ctx) {
      let notice = null;
      let active = true;
      let timer;
      const listeners = new Set();
      const publish = value => {notice = value; listeners.forEach(fn => fn());};
      const show = (text, mention) => {
        if (!active) return;
        clearTimeout(timer); publish({text, mention});
        if (!mention) timer = setTimeout(() => publish(null), 5000);
      };
      const request = async args => {
        const response = await fetch('/api/dsh-sessions', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(args)});
        const value = await response.json();
        if (!response.ok) throw new Error(value.error);
        return value;
      };
      async function copy(sessionId, title) {
        let mention;
        const prepared = request({action: 'reference', sessionId, label: title || sessionId});
        try {
          // Start clipboard admission in the click gesture; resolve the verified text afterward.
          if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
            await navigator.clipboard.write([new ClipboardItem({'text/plain': prepared.then(value => {
              mention = value.mention;
              return new Blob([mention], {type: 'text/plain'});
            })})]);
          } else {
            ({mention} = await prepared);
            await navigator.clipboard.writeText(mention);
          }
          show('会话引用已复制，可粘贴到其他会话');
        } catch {
          try {({mention} = await prepared);} catch {}
          show(mention ? '请复制下方会话引用' : '暂时无法读取该会话，请确认会话仍可访问后重试', mention);
        }
      }
      const sessions = ctx.sessions ?? ctx.get?.('sessions');
      const navigation = ctx.uiWorkspace ?? ctx.get?.('uiWorkspace');
      // Chat mode is the Workspace the host provisions at the chat directory. The
      // chip label of a chat session is that Workspace's title, so the composer
      // needs no special case; the client only routes the New Session action.
      let chat = null;
      const chatListeners = new Set();
      const subscribeChat = fn => {chatListeners.add(fn); return () => chatListeners.delete(fn);};
      const publishChat = value => {chat = value; chatListeners.forEach(fn => fn());};
      async function loadChat() {
        try {publishChat(await request({action: 'chat'}));}
        catch (error) {publishChat(null); console.warn('chat workspace unavailable:', error?.message ?? error);}
      }
      const isChatPath = cwd => chat !== null && typeof cwd === 'string' && cwd !== '' && (cwd === chat.root || cwd.startsWith(chat.root + '/'));
      // The native 新会话 entries all route through uiWorkspace.startSession: without a
      // Workspace they open Chat, with one they keep that Workspace's own New Session.
      const nativeStartSession = navigation && typeof navigation.startSession === 'function'
        ? navigation.startSession.bind(navigation) : null;
      const exitToChat = () => {if (nativeStartSession && chat !== null) nativeStartSession(chat.workspaceId);};
      const startSession = workspaceId => {
        if (!nativeStartSession) return;
        nativeStartSession(workspaceId ?? chat?.workspaceId);
      };
      if (nativeStartSession) {
        try {navigation.startSession = startSession;}
        catch (error) {console.warn('session routing:', error?.message ?? error);}
      }
      const bridge = {copy, exitToChat};
      window.__dshSessionActions = bridge;
      const subscribe = fn => {listeners.add(fn); return () => listeners.delete(fn);};
      function Icon() {
        return h('svg', {width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true},
          h('path', {d: 'M9 9h11v11H9zM15 5V3H3v12h2'}));
      }
      function CopyButton({sessionId, useSessions}) {
        const title = useSessions(s => s.byId[sessionId]?.title);
        return h('button', {type: 'button', className: 'dsh-sessions-copy', title: '复制会话引用', 'aria-label': '复制会话引用', onClick: () => copy(sessionId, title)}, h(Icon));
      }
      function Notice() {
        const value = React.useSyncExternalStore(subscribe, () => notice);
        const ref = React.useRef(null);
        React.useEffect(() => {if (value?.mention) {ref.current?.focus(); ref.current?.select();}}, [value]);
        if (!value) return null;
        return h('section', {className: 'dsh-sessions-notice', role: value.mention ? 'dialog' : 'status', 'aria-label': value.mention ? '复制会话引用' : undefined},
          h('div', null, value.text), value.mention && h('textarea', {ref, readOnly: true, 'aria-label': '会话引用', value: value.mention, onFocus: e => e.target.select()}),
          value.mention && h('button', {type: 'button', className: 'dsh-sessions-manual-copy', onClick: () => {
            ref.current?.focus(); ref.current?.select();
            if (document.execCommand('copy')) show('会话引用已复制，可粘贴到其他会话');
          }}, '复制引用'),
          h('button', {type: 'button', onClick: () => publish(null), 'aria-label': '关闭提示'}, '×'));
      }
      // The exit control lives in the native workspace chip; this entry only mirrors
      // the current Session's mode onto the shell so that control can hide itself in
      // Chat and stay hidden while no Session is open.
      function ChatChipMode() {
        React.useEffect(() => {
          const update = () => {
            const snapshot = sessions?.list?.getSnapshot?.();
            const current = snapshot?.current;
            const cwd = current === undefined ? undefined : snapshot.byId?.[current]?.cwd;
            const mode = chat !== null && typeof cwd === 'string' && cwd !== '' ? (isChatPath(cwd) ? 'chat' : 'exit') : 'none';
            document.body.dataset.dshChatChip = mode;
          };
          update();
          const offSessions = sessions?.list?.subscribe?.(update);
          const offChat = subscribeChat(update);
          return () => {
            offSessions?.(); offChat();
            delete document.body.dataset.dshChatChip;
          };
        }, []);
        return null;
      }
      ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({name: 'conversation.session.header.actions', id: 'copy-session-reference', order: 20}, CopyButton));
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({name: 'shell.overlay', id: 'session-actions-notice'}, Notice));
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({name: 'shell.overlay', id: 'chat-chip-mode'}, ChatChipMode));
      ctx.effect(() => {
        const style = document.createElement('style');
        style.dataset.plugin = 'dsh-plugin-sessions';
        style.textContent = `.dsh-sessions-copy{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:6px;font:inherit;color:var(--dsw-alias-label-secondary);background:transparent;border:0;cursor:pointer;border-radius:8px}.dsh-sessions-copy:hover{background:var(--dsw-alias-interactive-bg-hover)}.dsh-sessions-notice{pointer-events:auto;position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:10000;max-width:min(560px,calc(100vw - 32px));box-sizing:border-box;padding:14px 42px 14px 18px;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:12px;background:var(--dsw-alias-button-elevated-fill,#fff);color:var(--dsw-alias-label-primary,#222);box-shadow:0 6px 24px #0002;font-size:14px}.dsh-sessions-notice>button{position:absolute;right:10px;top:9px;border:0;background:transparent;color:inherit;font-size:22px;cursor:pointer}.dsh-sessions-notice textarea{box-sizing:border-box;width:100%;min-width:min(420px,65vw);min-height:100px;margin-top:10px;padding:8px;resize:vertical;color:inherit;background:transparent;border:1px solid #aaa;border-radius:6px}`;
        style.textContent += '.dsh-sessions-notice>button.dsh-sessions-manual-copy{position:static;font-size:14px;border:1px solid var(--dsw-alias-border-l3,#ddd);border-radius:6px;padding:5px 12px;margin-top:6px}';
        style.textContent += '.dsh-chat-chip .dsh-chat-exit{display:none;flex:none;align-items:center;justify-content:center;width:16px;height:16px;margin-left:1px;border-radius:50%;color:var(--dsw-alias-label-caption,#8b8b8b);background:transparent;cursor:pointer;transition:background .12s ease,color .12s ease}body[data-dsh-chat-chip="exit"] .dsh-chat-chip:hover .dsh-chat-exit{display:inline-flex}body[data-dsh-chat-chip="exit"] .dsh-chat-chip:hover .dsh-chat-chevron{display:none}.dsh-chat-exit:hover{background:var(--dsw-alias-interactive-bg-pressed,rgba(0,0,0,.1));color:var(--dsw-alias-label-primary,#222)}';
        document.head.appendChild(style);
        void loadChat();
        return () => {
          active = false; clearTimeout(timer); style.remove();
          if (window.__dshSessionActions === bridge) delete window.__dshSessionActions;
        };
      });
    }
    return {inject, apply};
  }
});
