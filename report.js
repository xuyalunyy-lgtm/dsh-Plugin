const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,4}(?:[-+][a-zA-Z0-9.-]{1,48})?$/;
const ACTIONS = new Set(['status', 'models', 'saveSettings', 'test', 'quota']);
const CODES = new Set(['INVALID_REQUEST', 'ADAPTER_MISSING', 'ENTRY_AMBIGUOUS', 'CONFLICT', 'INVALID_SETTINGS', 'EXPRESSION_CONFIG', 'BUSY', 'CLOSED', 'MODEL_REQUIRED', 'TIMEOUT', 'AUTH', 'MISSING_CREDENTIAL', 'RATE_LIMIT', 'INVALID_REQUEST_PROVIDER', 'TRANSPORT', 'SERVER', 'QUOTA_FORMAT', 'QUOTA_UNAVAILABLE', 'QUOTA_TRANSPORT', 'FAILED']);
const enumOf = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;
const numeric = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
function timestamp(value) {
  if (typeof value !== 'string' || value.length > 40) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}
export function safeCode(code) { return CODES.has(code) ? code : 'FAILED'; }
/** Allowlist a text check; omit model names, generated text and provider messages. */
export function testSnapshot(value) {
  if (!value || typeof value.ok !== 'boolean') return null;
  const usage = {};
  for (const key of ['inputTokens', 'outputTokens', 'totalTokens', 'cacheReadTokens', 'reasoningTokens']) {
    const count = numeric(value.usage?.[key], 0, Number.MAX_SAFE_INTEGER);
    if (count !== null) usage[key] = count;
  }
  return { ok: value.ok, latencyMs: numeric(value.latencyMs, 0, 86400000), finishedAt: timestamp(value.finishedAt), ...(value.ok ? {} : { code: safeCode(value.code) }), usage };
}
/** Retain percentages/timestamps only, never account, plan, credit or free-text data. */
export function quotaSnapshot(value) {
  if (!value) return null;
  const windows = Array.isArray(value.windows) ? value.windows.slice(0, 2).filter(w => w && ['primary', 'secondary'].includes(w.kind)).map(w => ({
    kind: w.kind, remainingPercent: numeric(w.remainingPercent, 0, 100), windowSeconds: numeric(w.windowSeconds, 1, 31536000), resetAt: timestamp(w.resetAt),
  })) : [];
  return { state: enumOf(value.state, ['available', 'unavailable', 'unsupported'], 'unavailable'), windows, checkedAt: timestamp(value.checkedAt) };
}
export function errorSnapshot(action, code, at) {
  return { action: ACTIONS.has(action) ? action : 'unknown', code: safeCode(code), at: timestamp(at) };
}
/** Build a bounded, explicit report; never serialize raw config or errors by spreading them. */
export function buildReport({ state, metadata, latest, configurationError, now = new Date().toISOString() }) {
  const version = value => typeof value === 'string' && VERSION.test(value) ? value : null;
  return {
    format: 'dsh-codex-manager-diagnostic', version: 1, generatedAt: timestamp(now),
    scope: 'manual-checks-in-current-host-lifetime',
    managerVersion: version(metadata?.managerVersion),
    adapter: { provider: 'codex', active: typeof state?.adapter?.active === 'boolean' ? state.adapter.active : null, version: version(metadata?.adapterVersion) },
    credential: {
      state: enumOf(state?.credential?.state, ['present', 'missing', 'invalid', 'unavailable'], 'unavailable'),
      mode: enumOf(state?.credential?.mode, ['chatgpt', 'apikey'], 'unknown'),
    },
    connection: state ? {
      proxyConfigured: typeof state.settings?.proxy === 'string' && state.settings.proxy.length > 0,
      // An empty value may mean environment proxy OR direct; do not claim to know which.
      proxySource: state.settings?.proxy ? 'explicit' : 'environment-or-direct',
      clientVersion: version(state.settings?.clientVersion),
      streamIdleTimeoutMs: numeric(state.settings?.streamIdleTimeoutMs, 5000, 600000),
      // Saved preference only, not evidence of the tier actually served.
      fastMode: typeof state.settings?.fastMode === 'boolean' ? state.settings.fastMode : null,
      fastModeMeaning: 'configured-preference-not-observed-service-tier',
      checkedAt: timestamp(state.checkedAt),
    } : null,
    configurationError: configurationError ? safeCode(configurationError) : null,
    latest: {
      textTest: testSnapshot(latest?.textTest), quota: quotaSnapshot(latest?.quota),
      error: latest?.error ? errorSnapshot(latest.error.action, latest.error.code, latest.error.at) : null,
    },
  };
}
