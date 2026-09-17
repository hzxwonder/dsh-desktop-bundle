/** Host-neutral canonical format consumed by Harness sessionReferenceResolver. */
export function sessionReference(sessionId, label = sessionId) {
  if (typeof sessionId !== 'string' || !sessionId || sessionId.length > 4096) throw new Error('SESSION_REFERENCE_INVALID_ID');
  const uri = 'dsh-session:' + Buffer.from(JSON.stringify(sessionId), 'utf8').toString('base64url');
  return `@[${String(label).replace(/[\\\]]/gu, value => '\\' + value)}](${uri})`;
}
