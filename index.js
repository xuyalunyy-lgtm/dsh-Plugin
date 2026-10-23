import { ACTIONS, createController, initialState, stateSchema } from './state.js';

export const name = 'focus-calendar';
export const inject = ['storageDomain', 'tools', 'connection', 'webServer'];
export const API_PATH = '/focus-calendar/api';

const text = description => ({ type: 'string', description });
export const parameters = {
  type: 'object', additionalProperties: false, required: ['action'],
  properties: {
    action: { type: 'string', enum: ACTIONS, description: 'read读取；add/update/delete管理待办；restore/trashPurge恢复/永久删除；settings设时长；focusStart/Pause/Resume/Reset专注；breakStart休息；remindersStart/Stop健康提醒；ack确认、snooze延后；export/recoveryExport导出备份；importPreview预览、import执行导入。' },
    id: text('update/delete/restore/trashPurge用任务id；focusStart可选关联任务id；ack/snooze用提醒id。'),
    date: text('add必填、update可选；明确的有效日期YYYY-MM-DD。'),
    title: text('add必填、update可选；1至200字符。'),
    time: text('add/update任务时间，HH:mm或空字符串；add默认空。'),
    done: { type: 'boolean', description: '仅update：任务是否完成。' },
    settings: { type: 'object', additionalProperties: false, description: '仅settings：要修改的间隔，整数分钟1至240，至少一项；生效于下一次启动或提醒周期。', properties: Object.fromEntries(['focusMinutes', 'eyeMinutes', 'bodyMinutes', 'breakMinutes'].map(key => [key, { type: 'integer', minimum: 1, maximum: 240 }])) },
    kind: { type: 'string', enum: ['eye', 'body', 'all'], description: '仅remindersStart/Stop；默认all。' },
    minutes: { type: 'integer', enum: [5,10], description: '仅snooze：延后5或10分钟。' },
    backup: { type:'object', additionalProperties:true, description:'仅importPreview/import：export或recoveryExport返回的完整备份对象，JSON最多4MiB；format=dsh-focus-calendar，version=1，含exportedAt、tasks、settings、trash。' },
    mode: { type:'string', enum:['merge','replace'], description:'仅import：merge保留本机同ID项目和设置；replace替换并保留一份替换前备份。两种模式均停止所有计时/提醒。' },
    token: text('仅import必填：同一backup的importPreview返回的preview.token；本机数据改变后需重新预览。'),
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
        if (length > 5*1024*1024) return respond(res, 413, { ok: false, error: '请求不能超过5MiB；备份JSON本身不能超过4MiB' });
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
    description: '管理与日历页面共享的待办、任务专注统计、休息提醒及备份。delete移入30天回收站，trashPurge永久删除不可撤销。导入先预览再确认；替换前备份可用recoveryExport取回。返回状态及可选backup/preview，失败不部分写入。',
    parameters,
    output: {
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, state: { type: 'object', additionalProperties: true }, backup: { type:'object', additionalProperties:true }, preview: { type:'object', additionalProperties:true }, error: { type: 'string' } }, required: ['ok'], additionalProperties: false },
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
