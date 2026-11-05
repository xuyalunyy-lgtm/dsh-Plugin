// Exact-anchor patch for the reviewed Desktop 0.2.2-rc.1 SessionStore.
function replaceOnce(source, before, after) {
  if(source.split(before).length!==2)throw Error('SessionStore patch baseline mismatch');
  return source.replace(before,after);
}
export function patchSessionStore(source) {
  source=replaceOnce(source,'\tprepare(id, options) {',`\tpurgeReservations = new Set();
\treservePurge(id, { allowLoaded = false } = {}) {
\t\tif ((!allowLoaded && this.store.has(id)) || this.purgeReservations.has(id)) throw Object.assign(new Error('会话仍被加载或正在删除。'), { code: 'PURGE_LIVE_SESSION', purgeCommitted: false });
\t\tthis.purgeReservations.add(id);
\t\treturn { release: ({ purgeCommitted } = {}) => { if (!purgeCommitted) this.purgeReservations.delete(id); } };
\t}
\tassertPurgeAdmission(id, parent) {
\t\tif (this.purgeReservations.has(id) || parent && this.purgeReservations.has(parent)) throw new Error('会话已删除或正在删除，不能重新加载。');
\t}
\tprepare(id, options) {`);
  source=replaceOnce(source,'\t\tif (this.store.has(sessionId)) throw new Error(`session "${sessionId}" already exists`);','\t\tthis.assertPurgeAdmission(sessionId, options?.meta?.parentSession);\n\t\tif (this.store.has(sessionId)) throw new Error(`session "${sessionId}" already exists`);');
  source=replaceOnce(source,'\tenter(session) {\n\t\tconst id = session.id;','\tenter(session) {\n\t\tconst id = session.id;\n\t\tthis.assertPurgeAdmission(id, session.header.parentSession);');
  return source;
}
