import { randomUUID } from 'node:crypto';

export const ACTIONS = ['read', 'add', 'update', 'delete', 'settings', 'focusStart', 'focusPause', 'focusResume', 'focusReset', 'remindersStart', 'remindersStop', 'ack', 'breakStart'];
export const DEFAULT_SETTINGS = { focusMinutes: 25, eyeMinutes: 20, bodyMinutes: 60, breakMinutes: 5 };
export function initialState() {
  return { tasks: [], settings: { ...DEFAULT_SETTINGS }, focus: { status: 'idle', kind: 'focus', endsAt: null, remainingMs: 0 }, reminders: { eye: { running: false, nextAt: null }, body: { running: false, nextAt: null } }, alerts: [] };
}
export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + 'T00:00:00Z');
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function validTime(value) { return typeof value === 'string' && (value === '' || /^([01]\d|2[0-3]):[0-5]\d$/.test(value)); }
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
function alert(state, kind, now, id) {
  if (!state.alerts.some(item => item.kind === kind)) state.alerts.push({ id: id(), kind, at: now });
}
export function reconcile(state, now, id = randomUUID) {
  if (state.focus.status === 'running' && state.focus.endsAt <= now) {
    alert(state, state.focus.kind, now, id);
    state.focus = { ...state.focus, status: 'idle', endsAt: null, remainingMs: 0 };
  }
  for (const kind of ['eye', 'body']) {
    const reminder = state.reminders[kind];
    if (reminder.running && reminder.nextAt <= now) {
      alert(state, kind, now, id);
      // Do not replay missed intervals after sleep, restart, or a disconnected UI.
      reminder.nextAt = now + state.settings[kind + 'Minutes'] * 60000;
    }
  }
  return state;
}
export function transition(current, request, now = Date.now(), id = randomUUID) {
  assert(request && typeof request === 'object' && !Array.isArray(request), '操作必须是对象');
  assert(ACTIONS.includes(request.action), '未知操作');
  const allowed = {
    read: [], add: ['date', 'title', 'time'], update: ['id', 'date', 'title', 'time', 'done'], delete: ['id'], settings: ['settings'],
    focusStart: [], focusPause: [], focusResume: [], focusReset: [], remindersStart: ['kind'], remindersStop: ['kind'], ack: ['id'], breakStart: [],
  };
  assert(Object.keys(request).every(key => key === 'action' || allowed[request.action].includes(key)), '操作包含不支持的参数');
  const state = reconcile(structuredClone(current), now, id);
  const taskFields = (input, add) => {
    const patch = {};
    if (add || own(input, 'date')) { assert(validDate(input.date), '日期须为有效 YYYY-MM-DD'); patch.date = input.date; }
    if (add || own(input, 'title')) { assert(typeof input.title === 'string' && input.title.trim().length > 0 && input.title.trim().length <= 200, '标题须为1至200字符'); patch.title = input.title.trim(); }
    if (add || own(input, 'time')) { const time = add && input.time === undefined ? '' : input.time; assert(validTime(time), '时间须为 HH:mm 或空字符串'); patch.time = time; }
    if (own(input, 'done')) { assert(typeof input.done === 'boolean', 'done须为布尔值'); patch.done = input.done; }
    return patch;
  };
  switch (request.action) {
    case 'read': break;
    case 'add':
      assert(state.tasks.length < 2000, '最多保存2000项任务');
      state.tasks.push({ id: id(), ...taskFields(request, true), done: false }); break;
    case 'update': {
      const task = state.tasks.find(item => item.id === request.id);
      assert(task, '任务不存在'); Object.assign(task, taskFields(request, false)); break;
    }
    case 'delete': {
      const index = state.tasks.findIndex(item => item.id === request.id);
      assert(index >= 0, '任务不存在'); state.tasks.splice(index, 1); break;
    }
    case 'settings': {
      const values = request.settings;
      assert(values && typeof values === 'object' && !Array.isArray(values), 'settings须为对象');
      assert(Object.keys(values).length > 0, 'settings不能为空');
      for (const [key, value] of Object.entries(values)) {
        assert(own(DEFAULT_SETTINGS, key), '未知设置项');
        assert(Number.isInteger(value) && value >= 1 && value <= 240, '间隔须为1至240整数分钟');
        state.settings[key] = value;
      }
      break;
    }
    case 'focusStart': case 'breakStart': {
      const kind = request.action === 'breakStart' ? 'break' : 'focus';
      const duration = state.settings[kind + 'Minutes'] * 60000;
      state.focus = { status: 'running', kind, endsAt: now + duration, remainingMs: duration }; break;
    }
    case 'focusPause':
      assert(state.focus.status === 'running', '没有运行中的计时');
      state.focus.remainingMs = Math.max(0, state.focus.endsAt - now);
      state.focus.endsAt = null; state.focus.status = 'paused'; break;
    case 'focusResume':
      assert(state.focus.status === 'paused', '没有暂停的计时');
      state.focus.endsAt = now + state.focus.remainingMs; state.focus.status = 'running'; break;
    case 'focusReset': state.focus = initialState().focus; break;
    case 'remindersStart': case 'remindersStop': {
      const kind = request.kind ?? 'all';
      assert(['eye', 'body', 'all'].includes(kind), 'kind须为eye、body或all');
      for (const key of kind === 'all' ? ['eye', 'body'] : [kind]) {
        const running = request.action === 'remindersStart';
        // Repeated Start is idempotent: polling/retrying must not postpone a reminder.
        if (running && state.reminders[key].running) continue;
        state.reminders[key] = { running, nextAt: running ? now + state.settings[key + 'Minutes'] * 60000 : null };
      }
      break;
    }
    case 'ack':
      assert(typeof request.id === 'string' && request.id.length > 0, '需要提醒id');
      state.alerts = state.alerts.filter(item => item.id !== request.id); break;
  }
  return state;
}

/** Serialized copy-on-write commits: failed storage writes never publish an in-memory success. */
export function createController({ load, save, clock = Date.now, id = randomUUID }) {
  let queue = Promise.resolve();
  let closed = false;
  const dispatch = request => {
    if (closed) return Promise.resolve({ ok: false, error: '插件已停止' });
    const run = queue.then(async () => {
      try {
        const now = clock();
        const current = load();
        const next = transition(current, request, now, id);
        if (JSON.stringify(next) !== JSON.stringify(current)) await save(next);
        return { ok: true, state: { ...structuredClone(next), now } };
      } catch (error) { return { ok: false, error: error instanceof Error ? error.message : '操作失败' }; }
    });
    queue = run.then(() => {});
    return run;
  };
  return { dispatch, async close() { closed = true; await queue; } };
}

/** Inject zod to keep the pure state-machine tests dependency-free. */
export function stateSchema(z) {
  const timestamp = z.number().int().nonnegative().nullable();
  const reminder = z.object({ running: z.boolean(), nextAt: timestamp });
  return z.object({
    tasks: z.array(z.object({ id: z.string().min(1), date: z.string().refine(validDate), title: z.string().min(1).max(200), time: z.string().refine(validTime), done: z.boolean() })).max(2000),
    settings: z.object(Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(key => [key, z.number().int().min(1).max(240)]))),
    focus: z.object({ status: z.enum(['idle', 'running', 'paused']), kind: z.enum(['focus', 'break']), endsAt: timestamp, remainingMs: z.number().int().nonnegative() }),
    reminders: z.object({ eye: reminder, body: reminder }),
    alerts: z.array(z.object({ id: z.string().min(1), kind: z.enum(['focus', 'eye', 'body', 'break']), at: z.number().int().nonnegative() })).max(4),
  });
}
