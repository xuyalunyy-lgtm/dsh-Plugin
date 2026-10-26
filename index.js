import { ACTIONS, createController, initialState, stateSchema } from './state.js';

export const name = 'focus-calendar';
export const inject = ['storageDomain', 'tools', 'connection', 'webServer'];
export const API_PATH = '/focus-calendar/api';

const text = description => ({ type: 'string', description });
export const parameters = {
  type: 'object', additionalProperties: false, required: ['action'],
  properties: {
    action: { type: 'string', enum: ACTIONS, description: 'read读取；add/update/delete管理待办；restore/trashPurge恢复/永久删除；settings设时长；focusStart/Pause/Resume/Reset专注；breakStart休息；remindersStart/Stop健康提醒；healthPolicy设置工作规则；quietStart/quietCancel临时健康勿扰/取消；ack确认、snooze延后；export/recoveryExport导出备份；importPreview预览、import执行导入。' },
    id: text('update/delete/restore/trashPurge用任务id；focusStart可选关联任务id；ack/snooze用提醒id。'),
    date: text('add必填、update可选；明确的有效日期YYYY-MM-DD。'),
    title: text('add必填、update可选；1至200字符。'),
    time: text('add/update任务时间，HH:mm或空字符串；add默认空。'),
    done: { type: 'boolean', description: '仅update：任务是否完成。' },
    requestId: text('add/update/delete/restore/trashPurge可选，16至128字符。新任务写入应生成唯一ID，结果不明确时用同ID和完全相同参数重试；成功回执原子保留7天，最多4096条，满时拒绝新请求。同ID不同参数拒绝，超过保留期不保证去重。'),
    expectedToken: text('update/delete/restore/trashPurge可选。新调用应传读取时对应task.editToken；编辑时冻结开始编辑的token，不能拿后台刷新token覆盖旧草稿。冲突会返回CONFLICT，应重新读取并人工核对；专注统计变化不会使token失效。'),
    settings: { type: 'object', additionalProperties: false, description: '仅settings：要修改的间隔，整数分钟1至240，至少一项；生效于下一次启动或提醒周期。', properties: Object.fromEntries(['focusMinutes', 'eyeMinutes', 'bodyMinutes', 'breakMinutes'].map(key => [key, { type: 'integer', minimum: 1, maximum: 240 }])) },
    kind: { type: 'string', enum: ['eye', 'body', 'all'], description: '仅remindersStart/Stop；默认all。' },
    minutes: { type: 'integer', enum: [5,10,30,60], description: 'snooze仅5或10分钟；quietStart仅30或60分钟，从当前时间重新计算，不累加。' },
    policy: { type:'object', additionalProperties:false, required:['enabled','timeZone','weekdays','start','end','breakEnabled','breakStart','breakEnd'], description:'仅healthPolicy：完整替换健康工作规则；同日左闭右开，不支持跨午夜。午休须包含于工作时段且不能占满。先read获取现值；保存重启已开启的健康周期，不开启已关闭项。', properties:{
      enabled:{type:'boolean',description:'是否限制到工作时段；默认false。'},
      timeZone:text('有效IANA时区，例如Asia/Shanghai；不跟随浏览器时区。'),
      weekdays:{type:'array',minItems:1,maxItems:7,uniqueItems:true,items:{type:'integer',minimum:1,maximum:7},description:'非空且不重复的ISO工作日，周一1至周日7。'},
      start:text('工作开始HH:mm（00:00至23:59），须早于end。'),end:text('工作结束HH:mm。'),
      breakEnabled:{type:'boolean',description:'是否排除午休时段。'},breakStart:text('午休开始HH:mm。'),breakEnd:text('午休结束HH:mm。'),
    } },
    backup: { type:'object', additionalProperties:true, description:'仅importPreview/import：export或recoveryExport返回的完整备份对象，JSON最多4MiB；format=dsh-focus-calendar，version=1，含exportedAt、tasks、settings、trash及可选healthPolicy（缺省关闭工作规则）；不含临时勿扰。' },
    mode: { type:'string', enum:['merge','replace'], description:'仅import：merge保留本机同ID项目、设置和工作规则；replace替换并保留一份替换前备份。两种模式均停止所有计时/提醒并清除临时勿扰。' },
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
    description: '管理与日历页面共享的待办、任务专注统计、休息提醒及备份。delete移入30天回收站，trashPurge永久删除不可撤销。导入先预览再确认；替换前备份可用recoveryExport取回。返回状态（含healthStatus健康允许原因/恢复时间）、任务editToken及可选backup/preview/receipt。工作规则和临时勿扰只影响护眼/活动提醒，不影响专注或休息计时；恢复新周期，不补发。旧调用兼容；推荐任务写入使用requestId和expectedToken防重复及冲突。WRITE_UNCERTAIN表示结果待确认，只能重试原请求，勿换ID。',
    parameters,
    output: {
      schema: { type: 'object', properties: { ok: { type: 'boolean' }, state: { type: 'object', additionalProperties: true }, backup: { type:'object', additionalProperties:true }, preview: { type:'object', additionalProperties:true }, receipt: { type:'object', additionalProperties:true }, conflict: { type:'object', additionalProperties:true }, code: {type:'string'}, error: { type: 'string' } }, required: ['ok'], additionalProperties: false },
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
