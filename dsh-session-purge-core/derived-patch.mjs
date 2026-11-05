import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

export const packages = ['dsh-session-query', 'dsh-session-query-sqlite', 'dsh-session-projection-cache'];
const guard = `
	async _requirePurgeTombstone(id) {
		if (typeof id !== "string" || !id.length) throw new TypeError("invalid session id");
		if (this.ctx.sessions.get(id) !== void 0) throw Object.assign(new Error("仅可清理未加载会话"), { code: "PURGE_LIVE_SESSION" });
		const persistence = this.ctx.get("sessionPersistence");
		if (typeof persistence?.purgeEntries !== "function") throw Object.assign(new Error("持久后端不支持永久删除"), { code: "PURGE_UNSUPPORTED" });
		const entries = await persistence.purgeEntries();
		if (!entries.some(entry => entry.request.sessionId === id)) throw Object.assign(new Error("缺少持久删除标记"), { code: "PURGE_NOT_BEGUN" });
		if (this.ctx.sessions.get(id) !== void 0) throw Object.assign(new Error("仅可清理未加载会话"), { code: "PURGE_LIVE_SESSION" });
	}
`;
function replace(source, from, to) {
  if (source.split(from).length !== 2) throw new Error('exact-build patch anchor mismatch: ' + from.slice(0, 100));
  return source.replace(from, to);
}
/** Exact 0.2.2-rc.1 built source transforms; caller must verify release/build hashes. */
export function patchSource(sources) {
  const out = { ...sources };
  let s = out[packages[0]];
  s = replace(s, '\tcacheCapacity;\n\tcache =', '\tcacheCapacity;\n\tpurged = new Set();\n\tpurgeSessionData(id) { this.purged.add(id); this.cache.delete(id); }\n\tcache =');
  s = replace(s, '\tasync read(sessionId, options = {}) {', '\tasync read(sessionId, options = {}) {\n\t\tif (this.purged.has(sessionId)) throw notFound(sessionId);');
  s = replace(s, '\tstore(sessionId, entry) {', '\tstore(sessionId, entry) {\n\t\tif (this.purged.has(sessionId)) return;');
  s = replace(s, '\t_observations;\n', '\t_observations;\n' + guard + '\tassertPurgeSupported() {\n\t\tthrow Object.assign(new Error("查询后端不支持永久删除"), { code: "PURGE_UNSUPPORTED" });\n\t}\n\tasync purgeSessionData(id) { this.assertPurgeSupported(); }\n');
  out[packages[0]] = s;
  s = out[packages[1]];
  s = replace(s, '\tasync searchSessions(request, exec) {', `	assertPurgeSupported() { this._assertSearchEnabled(); }
	async purgeSessionData(id) {
		this.assertPurgeSupported();
		await this._requirePurgeTombstone(id);
		this._observations.purgeSessionData(id);
		// Never-mode promises not to open SQLite, so cleanup must explicitly refuse.
		this._assertSearchEnabled();
		return this._serialized(void 0, async () => {
			await this._ensureReady(void 0);
			const db = this._requireDb();
			db.exec("BEGIN IMMEDIATE");
			try {
				this._deleteSession("persisted", id);
				this._deleteSession("live", id);
				db.prepare("UPDATE search_state SET global_generation = global_generation + 1 WHERE singleton = 1").run();
				db.exec("COMMIT");
			} catch (error) {
				db.exec("ROLLBACK");
				throw error;
			}
			this._globalGeneration += 1;
			this._localGeneration = Math.max(this._localGeneration, this._mainGeneration()) + 1;
		});
	}
	async searchSessions(request, exec) {`);
  out[packages[1]] = upgradeNeverPurgeSource(s);
  s = out[packages[2]];
  s = replace(s, '\ttable;\n', '\ttable;\n\tpurged = new Set();\n' + guard + `	async purgeSessionData(id) {
		await this._requirePurgeTombstone(id);
		this.purged.add(id);
		for (const session of this.dirty.keys()) if (session.id === id) {
			this.markClean(session);
			this.dirty.delete(session);
		}
		await this.requireTable().delete(id);
	}
`);
  s = replace(s, '\tasync put(id, identity, rows) {', `	async put(id, identity, rows) {
		// Recheck after asynchronous tombstone lookup and immediately before enqueue.
		const persistence = this.ctx.get("sessionPersistence");
		if (typeof persistence?.purgeEntries === "function") {
			const entries = await persistence.purgeEntries();
			if (entries.some(entry => entry.request.sessionId === id)) this.purged.add(id);
		}
		if (this.purged.has(id)) return;`);
  out[packages[2]] = s;
  return out;
}
/** Upgrade the previous reviewed SQLite purge candidate; rejects changed/repeated anchors. */
export function upgradeNeverPurgeSource(source) {
  let s = replace(source, 'async function openSearchDatabase(path, journalMode) {', 'async function openSearchDatabase(path, journalMode, existingOnly = false) {');
  s = replace(s, '\tif (actual !== ":memory:") {\n\t\tawait mkdir', '\tif (existingOnly) {\n\t\tif (actual === ":memory:") return;\n\t\ttry { await (await open(actual, "r+")).close(); } catch (error) {\n\t\t\tif (error.code === "ENOENT") return;\n\t\t\tthrow error;\n\t\t}\n\t}\n\tif (!existingOnly && actual !== ":memory:") {\n\t\tawait mkdir');
  s = replace(s, '\tassertPurgeSupported() { this._assertSearchEnabled(); }', '\tassertPurgeSupported() { if (this._isClosed()) throw indexClosed(); }');
  s = replace(s, '\t\t// Never-mode promises not to open SQLite, so cleanup must explicitly refuse.\n\t\tthis._assertSearchEnabled();\n\t\treturn this._serialized(void 0, async () => {\n\t\t\tawait this._ensureReady(void 0);', `\t\treturn this._serialized(void 0, async () => {
			// Search remains disabled. Maintenance opens only an existing configured index.
			if (this.config.openAt === "never" && this._db === void 0) {
				this._db = await openSearchDatabase(this.config.path, this.config.journalMode, true);
				if (this._db === void 0) return;
				this._globalGeneration = this._mainGeneration();
				this._localGeneration = this._globalGeneration;
			} else if (this.config.openAt !== "never") await this._ensureReady(void 0);`);
  return s;
}
export async function applyDerivedPatch(root) {
  const sources = Object.fromEntries(await Promise.all(packages.map(async name => [name, await readFile(resolve(root, name, 'lib/index.js'), 'utf8')])));
  const patched = patchSource(sources);
  for (const name of packages) await writeFile(resolve(root, name, 'lib/index.js'), patched[name]);
}
if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  if (!process.argv[2]) throw new Error('Usage: node derived-patch.mjs <staged @deepseek-ai directory>');
  await applyDerivedPatch(process.argv[2]);
}
