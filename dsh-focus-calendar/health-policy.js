/** Pure, dependency-free health-reminder scheduling rules (ES module).
 * Intervals are [start, end), in policy.timeZone, with ISO weekdays 1..7.
 * No I/O, timers, DOM, Date.now(), focus-timer state, or quietUntil handling.
 * now is an explicit finite epoch-millisecond number within the Date range.
 * Allowed results use nextAllowedAt=null. Denied results contain the first
 * allowed absolute minute after now, or null if none exists within 8 days.
 * Host MUST cache a future nextAllowedAt; invalidate on policy/time changes.
 * Minute resolution targets modern IANA zones (historical second offsets are
 * not modeled). Both occurrences of a DST fold are independently eligible;
 * nonexistent gap minutes never occur and therefore never become eligible.
 */
export const MAX_SCAN_MINUTES = 8 * 24 * 60;
const MINUTE = 60_000;
const DATE_LIMIT = 8_640_000_000_000_000;
const MAX_FORMATTERS = 32;
const formatters = new Map();
const DEFAULTS = Object.freeze({
  enabled: false,
  timeZone: 'Asia/Shanghai',
  weekdays: Object.freeze([1, 2, 3, 4, 5]),
  start: '09:00',
  end: '18:00',
  breakEnabled: true,
  breakStart: '12:00',
  breakEnd: '13:00',
});
const KEYS = new Set(Object.keys(DEFAULTS));
const WEEKDAYS = Object.freeze({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 });

function fail(message) { throw new TypeError(`Invalid health policy: ${message}`); }
function minuteOfDay(value, key) {
  if (typeof value !== 'string' || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    fail(`${key} must be HH:mm (00:00..23:59)`);
  }
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
}
function formatter(timeZone) {
  let result = formatters.get(timeZone);
  if (result) return result;
  // Reject fixed-offset identifiers; this API intentionally requires an IANA zone.
  if (typeof timeZone !== 'string' || !timeZone || /^[+-]/.test(timeZone)) {
    fail('timeZone must be a valid IANA identifier');
  }
  try {
    result = new Intl.DateTimeFormat('en-US-u-ca-gregory-nu-latn', {
      timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    });
  } catch {
    fail('timeZone must be a valid IANA identifier');
  }
  if (formatters.size >= MAX_FORMATTERS) formatters.delete(formatters.keys().next().value);
  formatters.set(timeZone, result);
  return result;
}

/** Missing fields receive defaults; unknown keys, undefined supplied values,
 * and non-plain objects are rejected. Validates even when disabled. Returns a
 * fresh canonical object and sorted, unique, nonempty weekdays (no mutation).
 * An inactive break still requires valid HH:mm fields, but its ordering and
 * containment are checked only when breakEnabled=true.
 */
export function validateHealthPolicy(value = {}) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    fail('expected a plain object');
  }
  for (const key of Reflect.ownKeys(value)) {
    if (!KEYS.has(key)) fail(`unknown key ${String(key)}`);
  }
  const policy = { ...DEFAULTS, ...value };
  for (const key of ['enabled', 'breakEnabled']) {
    if (typeof policy[key] !== 'boolean') fail(`${key} must be boolean`);
  }
  const zone = formatter(policy.timeZone);
  policy.timeZone = zone.resolvedOptions().timeZone;
  if (!Array.isArray(policy.weekdays) || policy.weekdays.length === 0
      || policy.weekdays.length > 7
      || !Array.from(policy.weekdays).every(day => Number.isInteger(day) && day >= 1 && day <= 7)
      || new Set(policy.weekdays).size !== policy.weekdays.length) {
    fail('weekdays must be nonempty unique ISO weekdays (1..7)');
  }
  policy.weekdays = [...policy.weekdays].sort((a, b) => a - b);
  const start = minuteOfDay(policy.start, 'start');
  const end = minuteOfDay(policy.end, 'end');
  const breakStart = minuteOfDay(policy.breakStart, 'breakStart');
  const breakEnd = minuteOfDay(policy.breakEnd, 'breakEnd');
  if (start >= end) fail('start must precede end; overnight windows are unsupported');
  if (policy.breakEnabled && (breakStart >= breakEnd || breakStart < start || breakEnd > end
      || (breakStart === start && breakEnd === end))) {
    fail('break must be ordered, contained in work hours, and leave a nonempty work window');
  }
  return policy;
}

/** Bounded to MAX_SCAN_MINUTES future probes + one current-time probe.
 * IANA conversion is always from an absolute instant; never constructs a
 * host-local Date or guesses how a nonexistent/ambiguous wall time maps to UTC.
 */
function checkNow(now) {
  if (typeof now !== 'number' || !Number.isFinite(now) || Math.abs(now) > DATE_LIMIT) {
    throw new TypeError('now must be a finite epoch-millisecond number within the Date range');
  }
}
function compile(policy) {
  if (!policy.enabled) return () => 'unrestricted';
  const fmt = formatter(policy.timeZone);
  const days = new Set(policy.weekdays);
  const start = minuteOfDay(policy.start, 'start');
  const end = minuteOfDay(policy.end, 'end');
  const breakStart = minuteOfDay(policy.breakStart, 'breakStart');
  const breakEnd = minuteOfDay(policy.breakEnd, 'breakEnd');
  const reasonAt = timestamp => {
    let day, hour, minute;
    for (const part of fmt.formatToParts(timestamp)) {
      if (part.type === 'weekday') day = WEEKDAYS[part.value];
      else if (part.type === 'hour') hour = Number(part.value);
      else if (part.type === 'minute') minute = Number(part.value);
    }
    const localMinute = hour * 60 + minute;
    if (!days.has(day)) return 'dayOff';
    if (localMinute < start || localMinute >= end) return 'outsideHours';
    if (policy.breakEnabled && localMinute >= breakStart && localMinute < breakEnd) return 'break';
    return 'working';
  };
  return reasonAt;
}
const isAllowed = reason => reason === 'working' || reason === 'unrestricted';
function nextBoundary(reasonAt, now, allowed) {
  const first = (Math.floor(now / MINUTE) + 1) * MINUTE;
  for (let step = 0; step < MAX_SCAN_MINUTES; step++) {
    const candidate = first + step * MINUTE;
    if (candidate > DATE_LIMIT) break;
    if (isAllowed(reasonAt(candidate)) !== allowed) return candidate;
  }
  return null;
}
export function healthWindow(value, now) {
  const policy = validateHealthPolicy(value);
  checkNow(now);
  const reasonAt = compile(policy), reason = reasonAt(now), allowed = isAllowed(reason);
  return { allowed, nextAllowedAt: allowed ? null : nextBoundary(reasonAt, now, false), reason };
}

/** Host-owned bounded derived cache. One current-time probe per hit; scans only
 * at an eligibility boundary. Cached intervals are absolute (DST-safe), and
 * reason is refreshed on every hit, including midnight during a weekend.
 * Four entries allow querying both now and quietUntil without cache thrashing.
 * Null future boundaries expire after one hour. Nothing is persisted here.
 */
export function createHealthWindowCache() {
  let key = null, reasonAt, enabled = false, entries = [];
  const evaluate = (value, now) => {
    checkNow(now);
    const policy = validateHealthPolicy(value), nextKey = JSON.stringify(policy);
    if (key !== nextKey) { key = nextKey; reasonAt = compile(policy); enabled = policy.enabled; entries = []; }
    const reason = reasonAt(now), allowed = isAllowed(reason);
    if (!enabled) return { allowed, reason, nextAllowedAt: null, boundaryAt: null };
    let entry = entries.find(item => item.from <= now && now < item.until && item.allowed === allowed);
    if (!entry) {
      const boundaryAt = nextBoundary(reasonAt, now, allowed);
      entry = { from: now, until: boundaryAt ?? Math.min(DATE_LIMIT, now + 3600000), boundaryAt, allowed };
      entries.push(entry); if (entries.length > 4) entries.shift();
    }
    return { allowed, reason, nextAllowedAt: allowed ? null : entry.boundaryAt, boundaryAt: allowed ? entry.boundaryAt : null };
  };
  evaluate.clear = () => { entries = []; };
  return evaluate;
}
