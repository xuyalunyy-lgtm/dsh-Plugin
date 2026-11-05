# DSH archived-session purge — reviewed-build patch

## Current status

The real JSONL, workspace, SessionStore, Agent lifecycle, SQLite and projection-cache adapters are implemented. The current isolated suite passes **56 tests**, including real-module deletion, restart recovery, idle-loaded sessions and disabled-search maintenance. This is an exact-build patch, not a Cordis plugin. Actual GUI acceptance is separate from these test results.

- Initial deployment: [INSTALL.md](./INSTALL.md).
- Disabled-search upgrade: [INSTALL-NEVER-FIX.md](./INSTALL-NEVER-FIX.md).
- Run tests from this directory with Node 24: `node --test test/*.mjs`.
- Tests require the matching Desktop archive extracted into `staging/runtime`; this generated directory and candidate archives are intentionally ignored by Git.
- Packaging currently uses the pinned `@electron/asar` 3.4.1 installation at `../../dsh-desktop-quick-actions/node_modules/`. That local prerequisite is not bundled here; do not assume a fresh clone can build without preparing it.
- Installer targets the reviewed Windows installation path and requires Desktop to be fully exited. It does not create backups or force-stop processes.

The material below preserves the original investigation and design notes. **Its pending/not-implemented statements describe that earlier investigation, not current implementation status.** Current implementation and tests above supersede those statements.

## Historical investigation

**State: PURE TRANSACTION COORDINATOR + ISOLATED TESTS IMPLEMENTED / REAL CORE ADAPTERS PENDING. This directory is not an installable plugin or a deployable core patch.**

No runtime ASAR was modified. No user session, index, workspace record, attachment, or project file was deleted. Following explicit user authorization, the isolated transaction tests described below were added; they do not load runtime services or touch user data. The session-manager UI/controller changes remain candidates and must not be presented as a working purge feature until the real host adapters below exist and pass the necessary checks.

## Target and deployment boundary

- Desktop release: `0.2.2-rc.1`, build `c59d10aff167ad7eefead4b3a9082fb57c8fbfe8` (confirmed by Lead).
- Installed implementation root: `D:\xuyl\tool\dsh_app\resources\app.asar\dsh`.
- Built packages are under `node_modules/@deepseek-ai/`. The paths and line numbers below refer to the **unmodified installed build**, not a source checkout.
- A maintainable source checkout and its tests have not been located. Read-only Host file reads can inspect ASAR content; ordinary filesystem tools do not see it as a writable source tree.
- A future exact-build patch must produce a separate ASAR candidate, refuse any other build/hash, and be installed externally while Desktop is fully exited. No in-process ASAR replacement or hot-load promise is appropriate.
- Previous release patches are not reusable proof: their replacement anchors, build hashes, and lifecycle assumptions differ.

## Proposed public Host contract — NOT IMPLEMENTED

```ts
interface PurgeArchivedSessionRequest {
  sessionId: string;
  requestId: string; // unique 16–128 characters, reused verbatim after uncertainty
  expectedRevision: string; // sessionPersistence.stat(id).revision frozen before confirmation
}
interface PurgeArchivedSessionResult {
  sessionId: string;
  requestId: string;
  revision: string; // the original expectedRevision, not a newly invented revision
  status: 'deleted';
}

ctx.workspaceRegistry.purgeArchivedSession(
  request: PurgeArchivedSessionRequest,
): Promise<PurgeArchivedSessionResult>;
```

The registry is the proposed public coordinator because it owns archive state and its serialized mutation chain. This method does not currently appear in Inspect and must not be called by guessing its presence. A completed implementation must add the public declaration, generated Service/Inspect metadata where required by the build, and documentation together.

The authenticated session-manager controller can call this entry after its own frozen session token precheck. The Host must independently validate `expectedRevision`; the plugin token is not an authority for storage state. Once the plugin has recorded `applying`, an exact retry must call the Host receipt path directly instead of requiring the deleted log to remain inspectable.

### Failure and retry contract

Every expected error must have a stable `code` and a user-readable Chinese `message`.

- **Definite refusal before a durable begin marker**: `purgeCommitted: false`. Retrying the same request is permitted after the named precondition is resolved, unless the request itself is invalid or its ID was reused.
- **Begin committed, or whether it committed is uncertain**: `purgeCommitted: true`, or omit this property when the outcome is genuinely unknown. The caller retains the original request and reports `WRITE_UNCERTAIN`; it must not create a new request ID or claim the operation rolled back.
- Completion is acknowledged only after storage deletion, workspace cleanup, and derived-data cleanup settle durably and the completion receipt is durable.
- The permanent receipt binds the exact `requestId + sessionId + expectedRevision`. A matching replay returns the historical completion; the same request ID with different arguments rejects. Receipts/tombstones must survive restart and must not be silently pruned.

Proposed expected error taxonomy (names may be finalized with the implementation, but must stay stable thereafter):

| code | message meaning | committed |
|---|---|---|
| `PURGE_INVALID_REQUEST` | 请求参数或状态凭证无效 | false |
| `PURGE_REQUEST_ID_REUSED` | 同一请求凭证不能用于不同会话或版本 | false for a definitely unrelated pre-existing receipt; never use false to deny an uncertain matching begin |
| `PURGE_NOT_ARCHIVED` | 仅已归档会话可永久删除 | false |
| `PURGE_LIVE_SESSION` | 会话仍已加载，请先关闭或重启后再操作 | false |
| `PURGE_SESSION_BUSY` | 会话仍有运行、排队、提醒或后台活动 | false |
| `PURGE_REFERENCED` | 其他会话或子智能体记录仍引用此会话 | false |
| `PURGE_CONFLICT` | 会话持久版本已改变，请重新读取并确认 | false |
| `PURGE_WRITER_HELD` | 另一个写入者持有会话，尚未删除 | false only if no begin attempt could have committed |
| `PURGE_RECOVERY_REQUIRED` | 永久删除已开始但清理未完成，只能使用原请求继续 | true/unknown |

## Minimum supported scope

A narrow initial implementation can support **cold, already archived, ordinary sessions only**. It need not and should not force-close an Agent to make a session eligible.

Before begin, reject when `ctx.sessions.get(id)` or `ctx.agents.get(id)` exists, even when the Agent status is idle. Recheck after acquiring the lifecycle/storage admission barrier. Reject queued/running/background/scheduled activity and foreign write ownership. Do not treat an archive record as proof that no work exists: an already archived native archive call returns before asking activity providers.

Do not cascade into children. Reject subagent-owned target headers and other session headers whose `parentSession` names the target. Own-log subagent catalog, workflow-child, and Team membership records also need a defined reference policy. Do not rewrite other immutable logs to erase references. Historical copied prefixes do not establish live ownership, but they can still be retained references; the product policy must distinguish these explicitly rather than relying on an arbitrary recursive string search.

The first version should state exactly what it deletes: the target's canonical log generations and its first-party derived session data. Attachments may be shared by forks; project files, shared attachments, spill files, telemetry, external backups, and unrelated plugin-owned data must not be recursively removed. “Permanently delete this session” is not a secure-erasure guarantee.

## Confirmed implementation evidence

All package paths below are relative to `node_modules/@deepseek-ai/` under the installed root above. They were read with the Host file reader.

### JSONL backend and writer ownership

`dsh-session-persistence-jsonl/lib/index.js`:

- **23–26, 117–174**: handle mutations serialize; `close()` drains routed events and its chain, releases the lease, and clears in-process bookkeeping. Deleting while a handle remains alive can race later durable writes.
- **289–317**: created-but-unmaterialized sessions are held in `pending` and `writers`; `claimWrite(id)` rejects an active writer synchronously.
- **361–378**: `adopt` tracks all open handles and maps the writer by ID; release removes the claim and pending entry.
- **399–438**: session event and flush routing is tied to those handles; disposal starts a final asynchronous writer drain. A bare session detach is not an awaited durability/ownership release.
- **617–644, 671–734**: the cross-process lease is held for the whole writer lifecycle. Windows uses a named semaphore derived from the lock path. POSIX uses `session.lock` and verifies inode identity. Removing/recreating that file while held breaks exclusion; keep the lock file and session directory intact.
- **2397–2427**: created sessions can be visible before physical materialization; `coldLogMemo` and migration preparation operations are additional backend state.
- **2465–2479, 2488–2553**: create and write-open take the in-process claim; write-open then acquires the kernel lease before reading or publishing migration.
- **2570–2599, 2607–2649**: stat/list expose pending and physical generations. Purged IDs must disappear consistently from all three of create/open/stat/list, not only from a directory listing.
- **2921–2948**: local writes invalidate `coldLogMemo` before changing storage.
- **2967–2986**: the exact existing directory determines the lease.
- **3055–3060, 3418–3464**: the authoritative artifact is the highest canonical generation in the unique session directory. Removing only the current generation can resurrect an older generation. Duplicate IDs across project directories reject.
- **3110–3145**: listing catches some malformed/unsupported headers and omits them. Therefore a header-only corpus listing is not proof that every physical artifact is readable or that no hidden relationship exists. A purge preflight must fail closed for corpus ambiguity it cannot resolve.
- **3476–3486**: selected path/header ID/cwd identity is validated, including file aliases. A purge implementation must use this backend knowledge, not client paths.
- **3513–3532**: root/project/session enumeration has a specific layout. A new tombstone location must not be accidentally interpreted as a project/session directory.

There is currently **no public delete/purge persistence method**. Extending the abstract persistence seam plus this backend is the correct location; a plugin must not access the backend's private `root`, tracker, or filesystem paths.

### Lifecycle admission and cold-only feasibility

`dsh-session/lib/index.js`:

- **1723–1729**: SessionStore holds live entries.
- **1808–1844**: `prepare` validates duplicate live identity but does not reserve it.
- **1869–1898**: `enter` synchronously rechecks duplicate identity, publishes the store entry, and returns a detach capability.
- **1900–1908**: detach removes the exact entry and emits disposal; it does not itself await Agent teardown or writer release.

`dsh-agent-loop/lib/index.js`:

- **1475–1508**: true Agent teardown cancels and waits for idle, disposes the scope, closes the stored write handle, then detaches Agent and Session in order.
- **1565–1585**: publication occurs only after unstored events append, then Session enter/announce and Agent enter/announce.
- **1616–1648, 1668–1702**: fresh creation obtains durable storage ownership before lifecycle publication.
- **1716–1769**: resume first opens persistence for write, reads/appends recovery closers, prepares, then initializes/publishes.

`dsh-api-session-controller/lib/index.js`:

- **192–216**: resolve/resume deduplication uses a `resumes` map.
- **235–239, 318–327**: named create is serialized through a separate `claims` map/`inOrder` chain.
- These are not an existing shared deletion barrier. A cold snapshot alone is not sufficient: an already accepted resume/create can be in flight before the Session becomes visible.

**Conclusion:** cold-only avoids intentional shutdown logic, but still needs an admission reservation shared with publication and persistence ownership. A synchronous in-memory deletion reservation at SessionStore prepare/enter and a backend writer claim/OS lease can close same-process races. Startup must load durable tombstones before any configured Agent or API activation becomes admissible. Persistent tombstones must also reject creation under a deleted ID and a new child whose `parentSession` points at a purged ID. A fully unpatched foreign process does not understand those tombstones; deployments must not claim safe cross-version concurrent access to the same storage.

### Workspace membership, archive state, and serialization

`dsh-workspace/lib/index.js`:

- **102–104**: exposed session membership is filtered by the registry's path cache.
- **148–153, 173–190**: entity detach and record mutations use the domain table write chain, stamp updatedAt, and update the entity after durability.
- **354–374**: registry holds `headers`, `sessionPaths`, missing/invalid path caches, and `operationTail`.
- **501–540**: archive keeps membership slots, removes pin in the same global state write, and does not ask activity for an already archived ID.
- **553–561**: unarchive merely removes the archive ID and does not verify session existence. It must serialize with purge and refuse a tombstoned ID.
- **614–618**: `sessionKnown` trusts live or cached headers, then indexes fresh persistence headers. Stale cached headers must be forgotten, not merely hidden in the UI.
- **865–898, 916–928**: indexes are explicitly maintained; cached headers can remain after a file disappears.
- **938–948**: `setState` writes before swapping memory; `enqueueOperation` serializes native registry operations and recovers existing pending workspace mutations first.

A proposed registry purge coordinator must run through **that native operation chain**. It needs durable cleanup of each workspace account plus archive/pin state and all in-memory header/path entries. Entity detach alone is not a complete registry forget. Multiple domain writes and log deletion are not one filesystem/SQLite transaction, so a durable irreversible begin marker and idempotent roll-forward cleanup are required.

### Query, SQLite, projections, and read leases

`dsh-session-query-sqlite/lib/index.js`:

- **537–580, 621–643**: searches are serialized on `_tail` and always reconcile before returning.
- **650–705**: reconciliation identifies stored IDs no longer in persistence, deletes rows within `BEGIN IMMEDIATE`, and updates generations/cursor validity.
- **707–755**: the source corpus is listed before and after reading; foreign changes that fail to stabilize reject.
- **760–768**: `_deleteSession` removes both FTS documents and session metadata; live temporary rows are separate.
- The current **public** service has no explicit invalidate/reconcile-delete method. A host implementation can add one through the same serialized database chain rather than running private SQL from a plugin. Lazy next-search reconciliation is not a completion barrier for purge, and a request already holding a source observation remains a concurrency consideration.

`dsh-session-query/lib/index.js`:

- **34–53**: cold reads take a read handle and append in-memory crash closers.
- **128–156**: a logical load prefers live state and can have read/copy work in flight across awaits.
- **369–395, 421–475**: prepared sessions/events are cached by persistence identity/revision; observations are reference-counted leases and can be retained. Invalidating a map entry does not erase already returned observations.
- **903–945**: lineage tracing already permits a missing parent as `complete:false`; that is not a reason to silently break known children during purge.
- **1081–1088**: `readSession` replay-validates and returns cloned raw history. Data already returned to a client cannot be recalled by server purge.

`dsh-session-projection-cache/lib/index.js`:

- **89–101, 143–154**: first-party durable per-session derived projection table.
- **284–289**: cold projections can issue fire-and-forget write-backs.
- **315–318, 348–354**: disposal can issue a final write, and `put` uses the domain chain.
- A purge must gate future cache writes for that ID, serialize after accepted writes, and delete the durable cache record. Removing only FTS rows does not remove cached titles/state; removing a cache row without guarding delayed write-backs lets it reappear.

## Required transaction shape (design, not implemented)

1. Validate exact request shape, frozen storage revision, owner authorization at the calling route, and receipt identity. Exact completed replays must be handled before any now-absent-session precheck.
2. Reserve the ID synchronously in lifecycle admission; refuse live Sessions/Agents and in-flight preparations/writers rather than cancelling them. Acquire the backend's in-process write claim and kernel lease while preserving the stable directory/lock inode.
3. Under the native workspace mutation chain, recheck archived state, activity, target origin, corpus references, and expected durable revision. Close/resolve same-process admission races before final validation. Refuse unreadable/ambiguous physical sources if they prevent a sound reference scan.
4. **Durably publish an immutable begin marker** binding request ID, session ID, expected revision, and the exact validated backend-owned deletion target. The admission reservation becomes irrevocable. A failure during marker publication is unknown unless durability can be proven absent; never report `purgeCommitted:false` merely because an await rejected.
5. Delete every validated canonical generation, not the directory and not `session.lock`. Block concurrent migration publication/create/resume for the tombstoned ID. Invalidate backend read/migration caches. Retain only non-content receipt/tombstone metadata; do not retain the log as a hidden backup.
6. Idempotently remove workspace account IDs, archive/pin entries and registry caches; serialized cleanup must not unarchive the target or create a new logical Session.
7. Gate read/observation admission and projection write-back; settle or reject accepted in-flight work according to a documented linearization rule. Through public core-owned methods, remove prepared-query cache entries, SQLite session/FTS rows and durable projection-cache records. Increment index generations. Do not claim to recall observations/clones already returned before the purge boundary.
8. Durably publish completion. Return the exact receipt result. After begin, any failed stage remains roll-forward pending and exact retry resumes from the receipt, even when all logs are already gone.
9. On startup, load deletion markers and install lifecycle/persistence guards **before consumers become injectable**, then recover incomplete cleanups before reporting purge capability as ready. Corrupt/ambiguous markers fail closed. A completed tombstone prevents ID reuse even after every generation is absent.

## Mechanisms not yet closed — implementation must resolve these

1. **Marker format and durable publication:** choose a placement compatible with current root enumeration and existing durable namespace primitives. Need a single authoritative request-ID journal as well as ID tombstones; a marker only under one cwd is insufficient to enforce global ID reuse rules when a caller tries another cwd. POSIX directory fsync and Windows write-through publication need their native completion semantics, not just `writeFile` plus optimistic memory state.
2. **Startup and restart recovery ordering:** persistence provider activation must load tombstones before configured Agents resume, but registry/query/projection services initialize later. Recovery must not introduce cyclic injection dependencies or report completion before those cleanup participants settle.
3. **Admission and reference races:** guard prepare/enter/create/open and parent-child creation consistently. The registry chain alone cannot serialize an independent backend writer or a Session prepared before reservation. A whole-corpus reference check is not atomic against new child/catalog creation in another process; define and enforce supported writer concurrency.
4. **Reads and leases:** define a deletion linearization point and whether active read handles/observation leases cause a precommit refusal or are allowed to finish an earlier snapshot. Do not let delayed read/write-back resurrect a purged ID or derived row.
5. **Partial physical deletion:** immutable begin authorizes irreversible roll-forward. Exact retry must safely handle some generations missing, preserve the lock inode, refuse path/symlink identity changes, and never rediscover a different artifact as the old target.
6. **Derived persistence cleanup:** public serialized query invalidation and projection write-back barriers are absent today. Add them to the owning core services, not via private plugin field access; include cache-only databases and `openAt:'never'` semantics.
7. **Scope of references and retained copies:** formalize first-party header/catalog/Team/workflow reference policy and user-visible retention scope. Shared attachments, other sessions' inherited copies, arbitrary plugin domains, backups and telemetry cannot be claimed erased.
8. **Required verification:** no implementation has exercised crashes before/after marker publication, partial-generation removal, commit-response loss, writer contention, race-to-resume, parent-child creation, delayed query/cache write-back, or restart recovery. The installed distribution does not include the source test harness. A matching source checkout or explicitly authorized focused test additions are required before declaring an irreversible core extension ready. This is outstanding work, not a claim that the feature is impossible.

## Expected eventual patch scope

At minimum, coordinated changes to these owning packages (plus their public type/Inspect declarations and build metadata):

- `dsh-session`: lifecycle admission reservation/deleted-ID guard.
- `dsh-session-persistence`: explicit purge/tombstone backend contract and failures.
- `dsh-session-persistence-jsonl`: marker journal, writer/lease transaction, generation removal, stat/list/open/create guards and startup loading.
- `dsh-workspace`: archived-only public coordinator, reference preflight, serialized account/state/cache cleanup and recovery.
- `dsh-session-query` and `dsh-session-query-sqlite`: observation-cache invalidation and serialized derived deletion barrier.
- `dsh-session-projection-cache`: deletion/write-back guard and durable cache cleanup.
- API/session activation path or equivalent shared lifecycle reservation integration, so API/configured/subagent factories honor the same admission boundary.

No code in this directory installs a Host capability or directly deletes real storage. The injected-port coordinator exports the proposed control-flow method only; the session-manager plugin must keep permanent deletion unavailable when the exact public Host capability is absent.

## Follow-up acceptance criteria

- Exact supported build and complete auditable diff; no blind private monkey patch.
- Public contract discoverable through Inspect after installation.
- Cold/live/archive/reference and conflict rules verified; request receipts survive restart.
- Failure/uncertainty paths verified without touching pre-existing user records.
- UI second confirmation freezes the exact ID/revision and explains irreversibility; no implicit bulk selection.
- External exited-Desktop installation procedure, actual existing GUI refresh/restart validation, and honest status of remaining limitations.
- No deployment or destructive smoke operation is authorized by this research document alone.

## Executable coordinator progress — 2026-11-05

[transaction.mjs](./transaction.mjs) now exports `createPurgeTransaction(ports)` returning `{ purgeArchivedSession, close }`, and `PurgeTransactionError`. Its injected ports are specified at the top of that module. It contains no filesystem calls, ASAR edits, runtime imports, SQL, or actual storage deletion implementation.

The coordinator uses only durable **begin / done** receipts. Before begin it obtains the journal execution claim and lifecycle/writer reservations, then performs archived/reference checks. Cleanup repeats in `storage → workspaces → query → projections` order; each real adapter must be idempotent. A matching done receipt replays without reading deleted storage. The journal must bind both request and session IDs across instances; local same-request single-flight is not the exclusion authority. Request parameter conflicts do not mutate receipts.

A failed begin is treated as committed/unknown unless the journal explicitly proves `purgeCommitted:false`. Postbegin failures retain the execution reservations for exact retry. `close()` stops admission, waits accepted operations, and releases execution resources with `{purgeCommitted}`; the lifecycle adapter must preserve irreversible durable admission guards even when an execution/OS lock is released. Failed releases are retained for an explicit close retry. This permits subsequent host instances to resume from the immutable stored plan without inspecting already-removed generations.

[test/transaction.test.mjs](./test/transaction.test.mjs) contains isolated in-memory ports and 27 passing `node:test` cases. Covered control-flow paths: successful order and receipt replay, invalid input, every precommit check, definite and unknown begin failure, each cleanup and completion failure, exact replay after lost completion, one-instance same-request single-flight, two-instance native workspace-chain ordering and journal exclusion, different-request rejection, uncertain journal read, explicit close/recovery from a committed plan, and each resource-release failure.

Run from this directory:

```powershell
node --check transaction.mjs
node --test test/transaction.test.mjs
```

Latest run: **27/27 pass**, syntax check passed. The initial fault fixture incorrectly claimed definite noncommit after it had already stored begin; that contradictory fake was corrected before the passing run. These tests verify coordinator control flow and the stated port contract only. They do not demonstrate that real JSONL locking/durability, startup recovery, SQLite cleanup, lifecycle admission, reference scanning, or projection write-back barriers are implemented or safe. Those production adapters and integration/fault checks remain the next implementation work; the evidence and requirements above remain applicable.
