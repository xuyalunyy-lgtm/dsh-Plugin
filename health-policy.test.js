import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { healthWindow, validateHealthPolicy, MAX_SCAN_MINUTES } from './health-policy.js';

const at = text => Date.parse(text);
const policy = overrides => validateHealthPolicy({ enabled: true, ...overrides });
const check = (p, instant, reason, next = null) => {
  const result = healthWindow(p, at(instant));
  assert.deepEqual(result, {
    allowed: reason === 'working' || reason === 'unrestricted',
    nextAllowedAt: next === null ? null : at(next), reason,
  });
};

test('defaults, canonicalization, partial input and no input mutation', () => {
  const defaults = validateHealthPolicy();
  assert.deepEqual(defaults, { enabled: false, timeZone: 'Asia/Shanghai', weekdays: [1, 2, 3, 4, 5],
    start: '09:00', end: '18:00', breakEnabled: true, breakStart: '12:00', breakEnd: '13:00' });
  const input = Object.freeze({ weekdays: Object.freeze([7, 1, 4]) });
  const normalized = validateHealthPolicy(input);
  assert.deepEqual(normalized.weekdays, [1, 4, 7]);
  assert.deepEqual(input.weekdays, [7, 1, 4]);
  normalized.weekdays.push(2);
  assert.deepEqual(validateHealthPolicy().weekdays, [1, 2, 3, 4, 5]);
  assert.equal(validateHealthPolicy({ timeZone: 'US/Eastern' }).timeZone, 'America/New_York');
  assert.equal(validateHealthPolicy(Object.create(null)).enabled, false);
});

test('Shanghai work and lunch boundaries are half-open, including milliseconds', () => {
  const p = policy();
  check(p, '2026-10-23T08:59:59.999+08:00', 'outsideHours', '2026-10-23T09:00:00+08:00');
  check(p, '2026-10-23T09:00:00+08:00', 'working');
  check(p, '2026-10-23T11:59:59.999+08:00', 'working');
  check(p, '2026-10-23T12:00:00+08:00', 'break', '2026-10-23T13:00:00+08:00');
  check(p, '2026-10-23T12:59:59.999+08:00', 'break', '2026-10-23T13:00:00+08:00');
  check(p, '2026-10-23T13:00:00+08:00', 'working');
  check(p, '2026-10-23T17:59:59.999+08:00', 'working');
  check(p, '2026-10-23T18:00:00+08:00', 'outsideHours', '2026-10-26T09:00:00+08:00');
});

test('weekend advances to next Monday and dayOff takes precedence over break', () => {
  check(policy(), '2026-10-24T10:00:00+08:00', 'dayOff', '2026-10-26T09:00:00+08:00');
  check(policy(), '2026-10-25T12:30:00+08:00', 'dayOff', '2026-10-26T09:00:00+08:00');
});

test('every ISO weekday is correctly mapped, including all-days and one-day schedules', () => {
  for (let day = 1; day <= 7; day++) {
    const date = `2026-10-${18 + day}`;
    check(policy({ weekdays: [day] }), `${date}T10:00:00+08:00`, 'working');
    check(policy({ weekdays: [1, 2, 3, 4, 5, 6, 7] }), `${date}T10:00:00+08:00`, 'working');
    const denied = healthWindow(policy({ weekdays: [day === 7 ? 1 : day + 1] }), at(`${date}T10:00:00+08:00`));
    assert.equal(denied.reason, 'dayOff');
    assert.ok(denied.nextAllowedAt > at(`${date}T10:00:00+08:00`));
  }
  check(policy({ weekdays: [1] }), '2026-10-19T18:00:00+08:00', 'outsideHours', '2026-10-26T09:00:00+08:00');
});

test('disabled policy is unrestricted; disabling break only removes lunch exclusion', () => {
  check(validateHealthPolicy(), '2026-10-25T03:00:00Z', 'unrestricted');
  check(policy({ enabled: false }), '2026-10-23T12:30:00+08:00', 'unrestricted');
  check(policy({ breakEnabled: false }), '2026-10-23T12:30:00+08:00', 'working');
  assert.doesNotThrow(() => policy({ breakEnabled: false, breakStart: '19:00', breakEnd: '01:00' }));
  check(policy({ breakStart: '09:00', breakEnd: '13:00' }), '2026-10-23T09:00:00+08:00', 'break', '2026-10-23T13:00:00+08:00');
  check(policy({ breakStart: '12:00', breakEnd: '18:00' }), '2026-10-23T12:00:00+08:00', 'break', '2026-10-26T09:00:00+08:00');
});

test('custom fractional-offset IANA zone and host-local timezone independence', () => {
  const p = policy({ timeZone: 'Asia/Kathmandu' });
  const previous = process.env.TZ;
  try {
    for (const hostZone of ['UTC', 'America/Los_Angeles', 'Asia/Tokyo']) {
      process.env.TZ = hostZone;
      check(p, '2026-10-23T03:14:59Z', 'outsideHours', '2026-10-23T03:15:00Z');
      check(p, '2026-10-23T03:15:00Z', 'working');
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

const ny = overrides => policy({ timeZone: 'America/New_York', weekdays: [7], breakEnabled: false, ...overrides });
test('New York spring gap skips nonexistent wall minutes', () => {
  const p = ny({ start: '02:30', end: '03:30' });
  check(p, '2024-03-10T06:59:59.999Z', 'outsideHours', '2024-03-10T07:00:00Z');
  check(p, '2024-03-10T07:00:00Z', 'working');
  check(p, '2024-03-10T07:30:00Z', 'outsideHours', '2024-03-17T06:30:00Z');
  check(ny({ start: '02:30', end: '02:31' }), '2024-03-10T06:59:59Z', 'outsideHours', '2024-03-17T06:30:00Z');
});

test('New York autumn fold admits both copies and discovers the second copy', () => {
  const p = ny({ start: '01:30', end: '01:45' });
  check(p, '2024-11-03T05:29:59.999Z', 'outsideHours', '2024-11-03T05:30:00Z');
  check(p, '2024-11-03T05:30:00Z', 'working');
  check(p, '2024-11-03T05:45:00Z', 'outsideHours', '2024-11-03T06:30:00Z');
  check(p, '2024-11-03T06:00:00Z', 'outsideHours', '2024-11-03T06:30:00Z');
  check(p, '2024-11-03T06:30:00Z', 'working');
  check(p, '2024-11-03T06:45:00Z', 'outsideHours', '2024-11-10T06:30:00Z');
  check(ny({ start: '01:00', end: '03:00', breakEnabled: true, breakStart: '01:30', breakEnd: '01:45' }),
    '2024-11-03T06:30:00Z', 'break', '2024-11-03T06:45:00Z');
});

test('strict invalid policy rejection', () => {
  const invalid = [null, [], true, 1, '', new Date(), { unknown: true }, { [Symbol('extra')]: 1 },
    { enabled: 1 }, { enabled: undefined }, { breakEnabled: 'true' },
    { timeZone: 'Not/AZone' }, { timeZone: '+08:00' }, { timeZone: '' }, { timeZone: null },
    { weekdays: [] }, { weekdays: [1, 1] }, { weekdays: [0] }, { weekdays: [8] },
    { weekdays: ['1'] }, { weekdays: [1.5] }, { weekdays: Array(1) }, { weekdays: null },
    { start: '9:00' }, { start: '24:00' }, { end: '18:60' }, { start: '09:00:00' },
    { start: ' 09:00' }, { start: 900 }, { end: '09:00' }, { start: '19:00', end: '08:00' },
    { breakStart: '13:00', breakEnd: '12:00' }, { breakStart: '12:00', breakEnd: '12:00' },
    { breakStart: '08:00' }, { breakEnd: '19:00' }, { breakStart: '09:00', breakEnd: '18:00' },
    { breakEnabled: false, breakStart: 'invalid' }];
  for (const input of invalid) assert.throws(() => validateHealthPolicy(input), TypeError);
  // Disabled rules must not allow malformed persisted data through validation.
  assert.throws(() => validateHealthPolicy({ enabled: false, start: 'bad' }), TypeError);
});

test('now is explicit, finite and in range even for disabled rules', () => {
  for (const now of [undefined, null, NaN, Infinity, -Infinity, '2026-10-23', new Date(), 8_640_000_000_000_001]) {
    assert.throws(() => healthWindow({}, now), TypeError);
  }
  const original = Date.now;
  try {
    Date.now = () => { throw new Error('implicit clock read'); };
    check(policy(), '2026-10-23T10:00:00+08:00', 'working');
  } finally { Date.now = original; }
  assert.doesNotThrow(() => healthWindow(policy(), 8_640_000_000_000_000));
});

test('eight-day maximum scan returns null and has a fixed probe ceiling', t => {
  // The Sunday one-minute window is entirely removed by the spring gap.
  // From Saturday midnight, the following Sunday lies beyond the 8-day cap.
  const p = ny({ start: '02:30', end: '02:31' });
  const now = at('2024-03-09T05:00:00Z');
  check(p, '2024-03-09T06:30:00Z', 'dayOff', '2024-03-17T06:30:00Z'); // exactly 8 days
  check(p, '2024-03-09T06:29:59.999Z', 'dayOff'); // one ms beyond horizon
  const original = Intl.DateTimeFormat.prototype.formatToParts;
  let probes = 0;
  Intl.DateTimeFormat.prototype.formatToParts = function (...args) {
    probes++;
    return original.apply(this, args);
  };
  const began = performance.now();
  try {
    assert.deepEqual(healthWindow(p, now), { allowed: false, nextAllowedAt: null, reason: 'dayOff' });
  } finally { Intl.DateTimeFormat.prototype.formatToParts = original; }
  const elapsed = performance.now() - began;
  assert.equal(MAX_SCAN_MINUTES, 11_520);
  assert.equal(probes, MAX_SCAN_MINUTES + 1);
  t.diagnostic(`Worst-case full scan: ${probes} probes, ${elapsed.toFixed(2)} ms`);
  // Deterministic operation bound is the guarantee, not a hardware-dependent time SLA.
  const durations = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    healthWindow(p, now);
    durations.push(performance.now() - start);
  }
  t.diagnostic(`Five warm full scans (ms): ${durations.map(n => n.toFixed(2)).join(', ')}`);
});
