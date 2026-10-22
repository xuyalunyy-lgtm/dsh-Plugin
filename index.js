import { ACTIONS, createController, initialState, stateSchema } from './state.js';

export const name = 'focus-calendar';
export const inject = ['storageDomain', 'tools', 'connection', 'webServer'];
export const API_PATH = '/focus-calendar/api';

const text = description => ({ type: 'string', description });
export const parameters = {
  type: 'object', additionalProperties: false, required: ['action'],
  properties: {
    action: { type: 'string', enum: ACTIONS, description: 'read读取；add/update/delete管理日历任务；settings更新间隔；focusStart/Pause/Resume/Reset管理专注；breakStart开始休息；remindersStart/Stop控制独立提醒；ack确认提醒。' },
    id: text('update/delete使用任务id；ack使用提醒id。'),
    date: text('add必填、update可选；明确的有效日期YYYY-MM-DD。'),
    title: text('add必填、update可选；1至200字符。'),
    time: text('add/update任务时间，HH:mm或空字符串；add默认空。'),
    done: { type: 'boolean', description: '仅update：任务是否完成。' },
    settings: { type: 'object', additionalProperties: false, description: '仅settings：要修改的间隔，整数分钟1至240，至少一项；生效于下一次启动或提醒周期。', properties: Object.fromEntries(['focusMinutes', 'eyeMinutes', 'bodyMinutes', 'breakMinutes'].map(key => [key, { type: 'integer', minimum: 1, maximum: 240 }])) },
    kind: { type: 'string', enum: ['eye', 'body', 'all'], description: '仅remindersStart/Stop；默认all。' },
  },
};

function respond(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
/** Exported for transport tests; authentication precedes body reading and every operation. */
export function createHttpHandler(connection, dispatch) {
  return async (req, res) => {
    const rejection = connection.requestRejection(req);
    if (rejection) return respond(res, rejection, { ok: false, error: '请求未通过连接鉴权' });
    if (req.method !== 'POST') return respond(res, 405, { ok: false, error: '仅支持POST' });
    if (!(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return respond(res, 415, { ok: false, error: '需要application/json' });
    try {
      const parts = []; let length = 0;
      for await (const chunk of req) {
        length += Buffer.byteLength(chunk);
        if (length > 32768) return respond(res, 413, { ok: false, error: '请求不能超过32KiB' });
        parts.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      let request;
      try { request = JSON.parse(Buffer.concat(parts).toString('utf8')); }
      catch { return respond(res, 400, { ok: false, error: 'JSON格式无效' }); }
      respond(res, 200, await dispatch(request));
    } catch {
      if (!res.headersSent) respond(res, 500, { ok: false, error: '请求处理失败' });
    }
  };
}

export async function apply(ctx) {
  const { z } = await import('zod');
  const domain = await ctx.storageDomain.open({
    // Storage UNIT_NAME_RE is /^[a-z][a-z0-9_]*$/ (hyphens are invalid).
    name: 'focus_calendar', version: 1, layout: 'single', tables: {},
    global: { schema: stateSchema(z), initial: initialState() },
  });
  const controller = createController({ load: () => domain.global.get(), save: value => domain.global.set(value) });
  ctx.effect(() => async () => { await controller.close(); await domain.close(); });

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact', path: API_PATH,
    handler: createHttpHandler(ctx.connection, controller.dispatch),
  }));
  ctx.effect(() => ctx.tools.register({
    name: 'focus_calendar',
    description: '管理跨会话持久保存的日历待办、专注/休息计时与护眼/活动提醒。与日历页面共享状态；返回当前状态或失败原因。删除任务不可撤销。提醒显示在打开的日历页面，不会唤醒agent。',
    parameters,
    output: {
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, state: { type: 'object', additionalProperties: true }, error: { type: 'string' } }, required: ['ok'], additionalProperties: false },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }],
    },
    execute: request => controller.dispatch(request),
  }));
  // Real timestamps make this resilient to event-loop delays and machine sleep.
  // Read only writes when reconciliation produces a change, not on every tick.
  ctx.effect(() => {
    const timer = setInterval(() => { void controller.dispatch({ action: 'read' }); }, 1000);
    timer.unref?.();
    return () => clearInterval(timer);
  });
}
