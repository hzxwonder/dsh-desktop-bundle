// Bindings select a workflow; only used sessions belong in conversation history.
export function workflowHistory(data, sessions, archivedIds, workflowId) {
  const archived = new Set(archivedIds);
  const runs = new Set(data.runs.filter(r => r.workflowId === workflowId).map(r => r.sessionId));
  return data.references.filter(r => {
    const session = sessions.byId[r.sessionId];
    return r.workflowId === workflowId && session && !archived.has(r.sessionId) &&
      (session.blank === false || r.hasHistory === true || runs.has(r.sessionId));
  });
}
