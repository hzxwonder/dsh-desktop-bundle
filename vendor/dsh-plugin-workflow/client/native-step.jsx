import React, { useEffect, useMemo, useState } from 'react';

// Harness 0.1.5-rc.2 renderer adapter. Each nested view receives its own fixed
// session scope while using the registered native Chat and tool renderers.
export function NativeStep({ ctx, sessionId, parentSessionId }) {
  const view = 'chat';
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    const connect = async () => {
      try {
        await ctx.sessions.refresh();
        await ctx.sessions.refreshSubagents(parentSessionId);
        for (let i = 0; i < 60; i++) {
          const binding = ctx.sessions.binding(sessionId);
          if (binding) {
            // The pinned controller opens history only for the selected session.
            // Embedded seats explicitly open that same event window without changing selection.
            if (typeof binding.session.open !== 'function') throw new Error('当前 Harness 版本不支持嵌入步骤会话');
            const catalog = ctx.sessions.list.getSnapshot().subagentsByParent[parentSessionId];
            const member = catalog?.entries.find(e => e.kind === 'child' && e.id === sessionId);
            const address = member && { parentSessionId, childSessionId: sessionId, mode: member.mode };
            if (!address) throw new Error('步骤会话地址尚未就绪');
            binding.session.configureSubagent(address, true);
            await binding.session.open();
            const snapshot = binding.session.getSnapshot();
            if (snapshot.openState === 'error') throw new Error(snapshot.openError?.message ?? '步骤历史加载失败');
            if (alive) setReady(true);
            return;
          }
          await new Promise(r => setTimeout(r, 100));
        }
        throw new Error('步骤会话尚未就绪');
      } catch (e) { if (alive) setError(e.message); }
    };
    connect(); return () => { alive = false; };
  }, [ctx, sessionId, parentSessionId]);
  const surface = useMemo(() => {
    if (!ready) return null;
    const registry = ctx.slots;
    if (!registry.hostFace || !registry._renderer) return null;
    const base = registry.hostFace(), adapter = base.scope('session'), binding = adapter?.resolve(sessionId);
    if (!binding) return null;
    const current = { getSnapshot: () => binding, subscribe: () => () => {} };
    const Entry = props => props.renderSlot('conversation.view', { openView: () => {}, completeViewRequest: () => {} }, { only: view });
    const entry = { component: Entry, options: {}, children: { 'conversation.view': { kind: 'list', scope: 'session' } } };
    const host = { ...base,
      scope: () => ({ ...adapter, current, resolve: id => adapter.resolve(id) }),
      entriesOf: key => key === 'root' ? [entry] : base.entriesOf(key),
      entriesOfSlot: key => key === 'root' ? [entry] : base.entriesOfSlot(key),
      isLive: value => value === entry || base.isLive(value),
      storeOf: (value, scope) => value === entry ? undefined : base.storeOf(value, scope),
    };
    return registry._renderer.renderRoot(host, {});
  }, [ready, ctx, sessionId, view]);
  return <div className="wf-native-step" data-native-step={sessionId}><div data-conversation-scroll="" className="wf-native-scroll">{error ? <p role="alert">{error}</p> : surface ?? <p className="wf-muted">正在读取步骤会话…</p>}</div></div>;
}
