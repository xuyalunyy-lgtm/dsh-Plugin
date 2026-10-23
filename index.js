import path from 'node:path';
import { GitReader } from './git-core.mjs';
import { GitActions } from './git-actions.mjs';
import { scanRepositories, selectRepository } from './repository-discovery.mjs';

export const inject = ['connection', 'sessions', 'sandboxPolicy'];

// Shared across plugin instances/sessions: two aliases of one canonical repository
// must not perform overlapping writes. Reads remain available while an action runs.
const busyRepositories = new Set();
let activeRequests = 0;
const MAX_REQUESTS = 4;
const ACTION_PARAMETERS = Object.freeze({
  stage: ['paths'], unstage: ['paths'], commit: ['message'],
  createBranch: ['branch'], deleteBranch: ['branch'], switchBranch: ['branch'],
  fetch: [], pull: [], push: [],
});
const ACTION_COMMON = ['sessionId', 'repository', 'operation', 'confirm', 'expectedHead', 'expectedBranch'];
const has = (object, key) => Object.hasOwn(object, key);
const allowedKeys = (body, keys) => Object.keys(body).every(key => keys.includes(key));

function validateAction(body) {
  if (typeof body.operation !== 'string' || !has(ACTION_PARAMETERS, body.operation)) throw new TypeError('不支持的 Git 操作');
  if (!allowedKeys(body, [...ACTION_COMMON, ...ACTION_PARAMETERS[body.operation]])) throw new TypeError('Git 操作包含不允许的参数');
  if (body.confirm !== true) throw new TypeError('请明确确认此 Git 操作');
  if (typeof body.repository !== 'string' || !body.repository) throw new TypeError('Git 操作必须明确选择仓库');
  for (const key of ['expectedHead', 'expectedBranch']) {
    if (!has(body, key) || body[key] !== null && typeof body[key] !== 'string') throw new TypeError('缺少或无效的仓库状态，请刷新后重试');
  }
  if (body.operation === 'stage' || body.operation === 'unstage') {
    if (!Array.isArray(body.paths) || body.paths.length === 0 || body.paths.length > 200 || body.paths.some(file => typeof file !== 'string' || !file || file.length > 4096 || file.includes('\0'))) throw new TypeError('请选择有效的仓库内文件');
  }
  if (body.operation === 'commit' && (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 8000 || body.message.includes('\0'))) throw new TypeError('请输入有效的提交说明');
  if ((body.operation === 'createBranch' || body.operation === 'deleteBranch' || body.operation === 'switchBranch') && (typeof body.branch !== 'string' || !body.branch || body.branch.length > 1024 || body.branch.includes('\0'))) throw new TypeError('请输入有效的分支名称');
}

function errorStatus(error) {
  if (error?.status === 409 || error?.statusCode === 409 || /^(?:STALE(?:_.*)?|HEAD_CHANGED|BRANCH_CHANGED|ACTION_BUSY|REPOSITORY_BUSY|CONFLICT)$/.test(String(error?.code))) return 409;
  return 400;
}

export function apply(ctx) {
  for (const route of ['repositories', 'snapshot', 'diff', 'details', 'action', 'overview', 'preview', 'summary', 'branchMetadata']) ctx.connection.fetch.register({
    path: '/api/git-visualizer/' + route,
    methods: ['POST'], requestBody: 'buffered',
    async fetch(request) {
      const reply = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
      if (activeRequests >= MAX_REQUESTS) return reply({ error: 'Git 请求过多，请稍后重试' }, 429);
      activeRequests++;
      try {
        const raw = await request.text();
        if (raw.length > 16384) return reply({ error: '请求过大' }, 413);
        let body;
        try { body = JSON.parse(raw); }
        catch { return reply({ error: '无效 JSON 请求' }, 400); }
        if (!body || typeof body !== 'object' || Array.isArray(body) || typeof body.sessionId !== 'string' || !/^session-[a-zA-Z0-9-]{1,100}$/.test(body.sessionId)) return reply({ error: '无效会话' }, 400);
        const live = ctx.sessions.get(body.sessionId)?.header;
        const stored = live ? undefined : await ctx.get('sessionPersistence')?.stat(body.sessionId);
        const header = live ?? stored?.header;
        if (!header) return reply({ error: '会话不存在' }, 404);
        const root = header.cwd ?? ctx.sandboxPolicy.workspaceRoot;
        if (!root) return reply({ error: '会话没有工作区' }, 400);
        if (route === 'action') validateAction(body);
        else if ((route === 'details' || route === 'overview' || route === 'summary' || route === 'branchMetadata') && !allowedKeys(body, ['sessionId', 'repository'])) return reply({ error: '请求包含不允许的参数' }, 400);
        else if (route === 'preview' && (!allowedKeys(body, ['sessionId', 'repository', 'path']) || typeof body.path !== 'string' || !body.path || body.path.length > 4096 || body.path.includes('\0'))) return reply({ error: '无效预览参数' }, 400);
        if (route === 'repositories') return reply({ ...await scanRepositories(root), workspaceRoot: root });
        const repository = await selectRepository(root, body.repository === undefined ? '.' : body.repository);
        if (route === 'action') {
          const key = process.platform === 'win32' ? path.normalize(repository.path).toLowerCase() : repository.path;
          if (busyRepositories.has(key)) return reply({ error: '此仓库正在执行 Git 操作，请稍后刷新重试' }, 409);
          busyRepositories.add(key);
          try {
            const parameters = Object.fromEntries(['operation', 'expectedHead', 'expectedBranch', ...ACTION_PARAMETERS[body.operation]].map(name => [name, body[name]]));
            return reply(await new GitActions(repository.path).execute(parameters));
          } finally { busyRepositories.delete(key); }
        }
        if (route === 'details') return reply(await new GitActions(repository.path).details());
        const reader = new GitReader(repository.path);
        if (route === 'summary') return reply(await reader.summary());
        if (route === 'branchMetadata') return reply(await reader.branchMetadata());
        if (route === 'overview') {
          const result = await reader.overview();
          if (result.snapshot.isRepository === false) return reply({ error: '当前会话工作区不是 Git 仓库。请打开已有仓库的会话。' }, 400);
          return reply(result);
        }
        if (route === 'preview') return reply(await reader.previewUntracked(body.path));
        if (route === 'snapshot') {
          const result = await reader.snapshot();
          if (result.isRepository === false) return reply({ error: '当前会话工作区不是 Git 仓库。请打开已有仓库的会话。' }, 400);
          return reply(result);
        }
        if (body.path !== undefined && typeof body.path !== 'string' || body.commit !== undefined && typeof body.commit !== 'string' || body.staged !== undefined && typeof body.staged !== 'boolean') return reply({ error: '无效差异参数' }, 400);
        return reply({ text: await reader.diff({ path: body.path, commit: body.commit, staged: body.staged }) });
      } catch (error) {
        return reply({ error: String(error?.message || 'Git 请求失败，请刷新后重试').slice(0, 4096) }, errorStatus(error));
      } finally { activeRequests--; }
    }
  });
}
