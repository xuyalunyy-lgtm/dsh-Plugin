import { createHash } from 'node:crypto';

// Exact 0.2.2-rc.1 built-source transformation. No filesystem write occurs here.
// The caller must apply this to a separate candidate, never the running ASAR.
export const BACKEND_PACKAGE = '@deepseek-ai/dsh-session-persistence-jsonl';
export const REVIEWED_SHA256 = '69efef5f84dddf947032bc1425067878fa610416c8885acde2ded9b01230c9b7';
export function patchSource(source) {
  if (source.includes('async reservePurge(')) throw new Error('JSONL purge patch already applied');
  if (createHash('sha256').update(source).digest('hex') !== REVIEWED_SHA256) throw new Error('JSONL purge patch source hash/anchor mismatch');
  const replace = (oldText, newText) => {
    if (source.split(oldText).length !== 2) throw new Error(`JSONL purge patch anchor mismatch: ${oldText.slice(0, 100)}`);
    source = source.replace(oldText, newText);
  };
  if (source.includes('async reservePurge(')) throw new Error('JSONL purge patch already applied');
  replace('var JsonlSessionPersistence = class extends SessionPersistence {', 'var JsonlSessionPersistence = class extends SessionPersistence {' + METHODS);
  replace('\tasync create(header, options) {\n\t\toptions?.signal?.throwIfAborted();', '\tasync create(header, options) {\n\t\tawait this.assertPurgeAllowed(header.id);\n\t\tif (header.parentSession !== void 0) await this.assertPurgeAllowed(header.parentSession);\n\t\toptions?.signal?.throwIfAborted();');
  replace('\t\tthis.tracker.registerCreated(snapshot, inheritedEventCount);', '\t\tawait this.assertPurgeAllowed(snapshot.id);\n\t\tif (snapshot.parentSession !== void 0) await this.assertPurgeAllowed(snapshot.parentSession);\n\t\tthis.tracker.registerCreated(snapshot, inheritedEventCount);');
  replace('\tasync open(id, access, options) {\n\t\toptions?.signal?.throwIfAborted();', '\tasync open(id, access, options) {\n\t\tawait this.assertPurgeAllowed(id);\n\t\toptions?.signal?.throwIfAborted();');
  replace('\t\t\tlease = await this.acquireLease(id, void 0, dirname(resolved.currentPath));', '\t\t\tlease = await this.acquireLease(id, void 0, dirname(resolved.currentPath));\n\t\t\tawait this.assertPurgeAllowed(id);');
  replace('\tasync stat(id, options) {\n\t\toptions?.signal?.throwIfAborted();', '\tasync stat(id, options) {\n\t\tif (await this.purgeTombstone(id)) return void 0;\n\t\toptions?.signal?.throwIfAborted();');
  replace('\t\treturn snapshots;\n\t}', '\t\tconst deleted = new Set((await this.purgeEntries()).map(entry => entry.request.sessionId));\n\t\treturn snapshots.filter(snapshot => !deleted.has(snapshot.header.id));\n\t}');
  // A previously opened read handle must not serve memoized/primed events after
  // begin. Already returned detached values cannot be recalled.
  replace('\t\tthis.assertOpen("read");', '\t\tthis.assertOpen("read");\n\t\tawait this.storage.assertPurgeAllowed(this.id);');
  replace('\t\tthis.lease ??= await this.storage.acquireWriteLease(this.header);', '\t\tthis.lease ??= await this.storage.acquireWriteLease(this.header);\n\t\tawait this.storage.assertPurgeAllowed(this.id);\n\t\tif (this.header.parentSession !== void 0) await this.storage.assertPurgeAllowed(this.header.parentSession);');
  replace('\t\tconst dir = sessionDir(this.root, meta.cwd, meta.id);\n\t\tconst finalPath', '\t\tconst dir = sessionDir(this.root, meta.cwd, meta.id);\n\t\tawait this.assertPurgeAllowed(meta.id);\n\t\tif (meta.parentSession !== void 0) await this.assertPurgeAllowed(meta.parentSession);\n\t\tconst finalPath');
  return source;
}

export const sourceDigest = source => createHash('sha256').update(source).digest('hex');

const METHODS = String.raw`
	/** Durable purge journal is backend-owned; no plugin receives raw paths. */
	purgeFaultHook;
	purgeClaims = new Set();
	purgeError(code, message, purgeCommitted = false) {
		return Object.assign(new Error(message), { code, purgeCommitted });
	}
	purgeRequest(value) {
		if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !["sessionId", "requestId", "expectedRevision"].includes(key))) throw this.purgeError("PURGE_INVALID_REQUEST", "永久删除请求参数无效。");
		for (const [key, min, max] of [["sessionId", 1, 256], ["requestId", 16, 128], ["expectedRevision", 1, 256]]) if (typeof value[key] !== "string" || value[key].length < min || value[key].length > max || /[\u0000-\u001f\u007f]/.test(value[key])) throw this.purgeError("PURGE_INVALID_REQUEST", "永久删除会话标识、请求凭证或版本无效。");
		return { sessionId: value.sessionId, requestId: value.requestId, expectedRevision: value.expectedRevision };
	}
	purgeSame(a, b) { return a.sessionId === b.sessionId && a.requestId === b.requestId && a.expectedRevision === b.expectedRevision; }
	purgeJournalDir() { return join(this.root, ".dsh-purge"); }
	async purgeBoundary(name) { await this.purgeFaultHook?.(name); }
	async purgeReadFile(path) {
		try { return JSON.parse(await readFile(path, "utf8")); }
		catch (error) { if (isENOENT(error)) return void 0; throw error; }
	}
	purgeValidateRecord(value, filename) {
		const request = this.purgeRequest(value?.request);
		const plan = value?.plan;
		if (value.version !== 1 || !plan || plan.sessionId !== request.sessionId || plan.revision !== request.expectedRevision || typeof plan.dir !== "string" || dirname(dirname(plan.dir)) !== this.root || basename(plan.dir) !== encodeSegment(request.sessionId) || !Array.isArray(plan.files) || !plan.files.length || new Set(plan.files).size !== plan.files.length || plan.files.some(name => typeof name !== "string" || basename(name) !== name || parseGenerationLogFilename(name, this.compression) === void 0) || filename !== encodeSegment(request.requestId) + ".begin.json") throw this.purgeError("PURGE_JOURNAL_CORRUPT", "永久删除日志不完整或目标无效；已拒绝恢复。", true);
		return { version: 1, request, plan };
	}
	async purgeEntries() {
		let files;
		try { files = await readdir(this.purgeJournalDir(), { withFileTypes: true }); }
		catch (error) { if (isENOENT(error)) return []; throw error; }
		const records = [], sessionIds = new Set();
		for (const file of files) {
			if (!file.name.endsWith(".begin.json")) continue;
			if (!file.isFile()) throw this.purgeError("PURGE_JOURNAL_CORRUPT", "永久删除日志目标不是普通文件。", true);
			const value = await this.purgeReadFile(join(this.purgeJournalDir(), file.name));
			const record = this.purgeValidateRecord(value, file.name);
			if (sessionIds.has(record.request.sessionId)) throw this.purgeError("PURGE_JOURNAL_CORRUPT", "同一会话存在多个永久删除凭证。", true);
			sessionIds.add(record.request.sessionId);
			const done = await this.purgeReadFile(join(this.purgeJournalDir(), encodeSegment(record.request.requestId) + ".done.json"));
			if (done !== void 0 && (done.version !== 1 || !this.purgeSame(this.purgeRequest(done.request), record.request))) throw this.purgeError("PURGE_JOURNAL_CORRUPT", "永久删除完成凭证不匹配。", true);
			record.phase = done === void 0 ? "begun" : "done";
			records.push(record);
		}
		return records;
	}
	async purgeTombstone(id) { return (await this.purgeEntries()).find(entry => entry.request.sessionId === id); }
	async purgeStatus(input) {
		const request = this.purgeRequest(input);
		const records = await this.purgeEntries();
		const record = records.find(entry => entry.request.requestId === request.requestId);
		if (record && !this.purgeSame(record.request, request)) throw this.purgeError("PURGE_REQUEST_ID_REUSED", "同一永久删除请求凭证不能用于不同会话或版本。");
		return record;
	}
	async assertPurgeAllowed(id) {
		if (await this.purgeTombstone(id)) throw this.purgeError("PURGE_DELETED", "会话永久删除已开始，不能再次读取、写入或恢复。", true);
		if (this.purgeClaims.has(id)) throw this.purgeError("PURGE_IN_PROGRESS", "会话已有永久删除执行凭证，暂不可读取或写入。", true);
	}
	purgeAssertNoChildren(id) {
		for (const entry of this.tracker.pending.values()) if (entry.header.parentSession === id) throw this.purgeError("PURGE_REFERENCED", "已有待持久化子会话引用此会话，尚未永久删除。");
		for (const writer of this.tracker.writers.values()) if (writer?.header.parentSession === id) throw this.purgeError("PURGE_REFERENCED", "已有活动子会话写入者引用此会话，尚未永久删除。");
	}
	async purgeAssertDirectory(dir) {
		// Every component is backend-derived. Never follow a replaced/reparse
		// directory while removing files authorized by an old durable plan.
		if (dirname(dirname(dir)) !== this.root) throw this.purgeError("PURGE_PATH_CHANGED", "永久删除目录身份已改变。", true);
		for (const path of [this.root, dirname(dir), dir]) {
			const info = await lstat(path);
			if (!info.isDirectory() || info.isSymbolicLink()) throw this.purgeError("PURGE_PATH_CHANGED", "永久删除目录已被替换或是链接。", true);
		}
	}
	async purgePublish(path, value) {
		const dir = dirname(path);
		if (process.platform === "win32") await ensureDurableDirectoryWin32(dir);
		else {
			await mkdir(dir, { recursive: true, mode: 448 });
			await this.syncDirPosix(dirname(dir));
		}
		const tmp = await this.writeSyncedTempFile(path, JSON.stringify(value) + "\n");
		try {
			if (process.platform === "win32") await publishNewFileWin32(tmp, path);
			else { await link(tmp, path); await this.syncDirPosix(dir); }
		} finally { await rm(tmp, { force: true }); }
	}
	/**
	 * Reserve the global request/session journal and the existing target writer.
	 * Retain this object after uncertain begin; release only during exact retry
	 * completion or explicit host shutdown. Permanent guards live on disk.
	 */
	async reservePurge(input) {
		const request = this.purgeRequest(input);
		let journalLease, targetLease, claimed = false, closed = false;
		let committed = false, record;
		const release = async () => {
			if (closed) return;
			const failures = [];
			try { await targetLease?.release(); targetLease = void 0; } catch (error) { failures.push(error); }
			if (claimed && targetLease === void 0) { this.tracker.releaseClaim(request.sessionId); this.purgeClaims.delete(request.sessionId); claimed = false; }
			try { await journalLease?.release(); journalLease = void 0; } catch (error) { failures.push(error); }
			if (failures.length) throw new AggregateError(failures, "永久删除锁释放失败。");
			closed = true;
		};
		try {
			if (this.tracker.writers.has(request.sessionId)) throw this.purgeError("PURGE_WRITER_HELD", "会话仍有写入者，尚未永久删除。");
			journalLease = await this.acquireLease(SessionId("purge-journal"), void 0, this.purgeJournalDir());
			const entries = await this.purgeEntries();
			record = entries.find(entry => entry.request.requestId === request.requestId);
			if (record && !this.purgeSame(record.request, request)) throw this.purgeError("PURGE_REQUEST_ID_REUSED", "同一永久删除请求凭证不能用于不同会话或版本。");
			if (entries.some(entry => entry.request.sessionId === request.sessionId && !this.purgeSame(entry.request, request))) throw this.purgeError("PURGE_REQUEST_ID_REUSED", "会话已经绑定另一永久删除请求。");
			committed = record !== void 0;
			if (!record && entries.length >= 4096) throw this.purgeError("PURGE_JOURNAL_FULL", "永久删除凭证已达上限，未接受新请求。");
			{
				this.purgeAssertNoChildren(request.sessionId);
				this.tracker.claimWrite(request.sessionId); claimed = true;
				this.purgeClaims.add(request.sessionId);
				const selected = record ? void 0 : await this.findLog(request.sessionId);
				if (!record && !selected) throw this.purgeError("PURGE_NOT_FOUND", "会话持久日志不存在，尚未永久删除。");
				const dir = record ? record.plan.dir : dirname(selected.sourcePath);
				await this.purgeAssertDirectory(dir);
				targetLease = await this.acquireLease(request.sessionId, void 0, dir);
				await this.purgeAssertDirectory(dir);
				if (!record) {
					const snapshot = await this.stat(request.sessionId);
					if (!snapshot || snapshot.revision !== request.expectedRevision) throw this.purgeError("PURGE_CONFLICT", "会话持久版本已改变，请重新读取并确认。");
					const files = (await readdir(dir, { withFileTypes: true })).filter(file => parseGenerationLogFilename(file.name, this.compression) !== void 0);
					if (!files.length || files.some(file => !file.isFile())) throw this.purgeError("PURGE_PATH_CHANGED", "会话日志世代不是普通文件。");
					record = { version: 1, request, phase: "prepared", plan: { sessionId: request.sessionId, revision: request.expectedRevision, dir, files: files.map(file => file.name).sort() } };
				}
			}
		} catch (error) {
			try { await release(); } catch (releaseError) { throw Object.assign(new AggregateError([error, releaseError], "永久删除准备失败且锁释放异常。"), { code: "PURGE_RECOVERY_REQUIRED", purgeCommitted: committed }); }
			if (!error.code?.startsWith("PURGE_")) error = this.purgeError(error.name === "SessionAlreadyOwnedError" ? "PURGE_WRITER_HELD" : "PURGE_PRECONDITION_FAILED", error.name === "SessionAlreadyOwnedError" ? "另一进程仍持有会话写入锁。" : "永久删除尚未开始，请核对存储状态。", committed);
			error.purgeCommitted = committed;
			throw error;
		}
		const assertOpen = () => { if (closed) throw this.purgeError("PURGE_RESERVATION_CLOSED", "永久删除执行凭证已释放。", committed); };
		const snapshot = () => record.phase === "prepared" ? void 0 : structuredClone(record);
		return {
			read: async () => { assertOpen(); const current = await this.purgeStatus(request); if (current) { record = current; committed = true; } return snapshot(); },
			begin: async () => {
				assertOpen();
				if (record.phase !== "prepared") return snapshot();
				const latest = await this.stat(request.sessionId);
				if (!latest || latest.revision !== request.expectedRevision) throw this.purgeError("PURGE_CONFLICT", "永久删除开始前会话版本已改变。");
				this.purgeAssertNoChildren(request.sessionId);
				await this.purgeBoundary("before-begin");
				this.purgeAssertNoChildren(request.sessionId);
				committed = true;
				try {
					await this.purgePublish(join(this.purgeJournalDir(), encodeSegment(request.requestId) + ".begin.json"), { version: 1, request, plan: record.plan });
					record.phase = "begun";
					this.coldLogMemo.delete(request.sessionId);
					await this.purgeBoundary("after-begin");
					return snapshot();
				} catch (error) { error.purgeCommitted = true; throw error; }
			},
			remove: async () => {
				assertOpen();
				const stored = await this.purgeStatus(request);
				if (!stored) throw this.purgeError("PURGE_NOT_BEGUN", "永久删除尚未持久开始，拒绝删除日志。");
				record = stored; committed = true;
				await this.purgeAssertDirectory(record.plan.dir);
				const entries = await readdir(record.plan.dir, { withFileTypes: true });
				for (const file of entries) if (parseGenerationLogFilename(file.name, this.compression) !== void 0 && (!record.plan.files.includes(file.name) || !file.isFile())) throw this.purgeError("PURGE_PATH_CHANGED", "永久删除目标出现新世代或链接，已停止清理。", true);
				for (const name of record.plan.files) {
					await this.purgeBoundary("before-generation:" + name);
					await rm(join(record.plan.dir, name), { force: true });
					await this.purgeBoundary("after-generation:" + name);
				}
				if (process.platform !== "win32") await this.syncDirPosix(record.plan.dir);
				this.coldLogMemo.delete(request.sessionId);
				await this.purgeBoundary("after-remove");
			},
			complete: async () => {
				assertOpen();
				const stored = await this.purgeStatus(request);
				if (!stored) throw this.purgeError("PURGE_NOT_BEGUN", "永久删除尚未开始，不能确认完成。");
				record = stored; committed = true;
				if (record.phase === "done") return snapshot();
				const entries = await readdir(record.plan.dir);
				if (entries.some(name => parseGenerationLogFilename(name, this.compression) !== void 0)) throw this.purgeError("PURGE_RECOVERY_REQUIRED", "会话日志尚未全部删除，不能确认完成。", true);
				await this.purgeBoundary("before-complete");
				try {
					await this.purgePublish(join(this.purgeJournalDir(), encodeSegment(request.requestId) + ".done.json"), { version: 1, request });
					record.phase = "done";
					await this.purgeBoundary("after-complete");
					return snapshot();
				} catch (error) { error.purgeCommitted = true; throw error; }
			},
			release
		};
	}
`;
