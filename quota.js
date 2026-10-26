import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

function failure(code) { throw Object.assign(new Error('Quota query failed'), { code }); }
function number(value, min, max) { return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null; }
/** Only allowlisted numeric limits leave the Host; never return raw account data. */
export function normalizeQuota(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) failure('QUOTA_FORMAT');
  const limit = raw.rate_limit;
  const windows = [];
  for (const [kind, key] of [['primary', 'primary_window'], ['secondary', 'secondary_window']]) {
    const w = limit?.[key];
    if (!w || typeof w !== 'object') continue;
    const used = number(w.used_percent, 0, 100);
    const seconds = number(w.limit_window_seconds, 1, 31536000);
    const reset = number(w.reset_at, 0, 4102444800);
    const after = number(w.reset_after_seconds, 0, 31536000);
    windows.push({ kind, usedPercent: used, remainingPercent: used === null ? null : Math.round((100 - used) * 100) / 100, windowSeconds: seconds, resetAt: reset !== null ? new Date(reset * 1000).toISOString() : after !== null ? new Date(now + after * 1000).toISOString() : null });
  }
  const usable = windows.some(w => w.remainingPercent !== null);
  // Plan identifiers are constrained so provider strings cannot carry personal data.
  const plan = typeof raw.plan_type === 'string' && /^[a-z][a-z0-9_-]{0,31}$/i.test(raw.plan_type) ? raw.plan_type : null;
  return { state: usable ? 'available' : 'unavailable', ...(usable ? {} : { reason: 'NO_WINDOWS' }), plan, windows, allowed: typeof limit?.allowed === 'boolean' ? limit.allowed : null, limitReached: typeof limit?.limit_reached === 'boolean' ? limit.limit_reached : null, checkedAt: new Date(now).toISOString() };
}
/** Uses the installed adapter's proxy transport, not a second independent connection setup. */
export async function adapterTransport(config, profileDir = process.env.DSH_PROFILE_DIR) {
  if (!profileDir) failure('QUOTA_TRANSPORT');
  try {
    const require = createRequire(join(profileDir, 'package.json'));
    const entry = require.resolve('dsh-llm-codex');
    const module = await import(pathToFileURL(join(dirname(entry), 'transport.js')).href);
    return await module.createTransport(config);
  } catch (error) { failure('QUOTA_TRANSPORT'); }
}
/** GET only; no refresh, credentials writeback, retry, history or model generation. */
export async function queryQuota(config, signal, { readCredential, transport = adapterTransport } = {}) {
  const auth = await readCredential(config);
  const key = typeof auth?.OPENAI_API_KEY === 'string' && auth.OPENAI_API_KEY.trim().length > 0;
  const token = auth?.tokens?.access_token;
  if (auth?.auth_mode === 'apikey' || (!auth?.auth_mode && key && !token)) return { state: 'unsupported', reason: 'API_KEY', plan: null, windows: [], allowed: null, limitReached: null, checkedAt: new Date().toISOString() };
  if (typeof token !== 'string' || !token.length) failure('MISSING_CREDENTIAL');
  const headers = { authorization: `Bearer ${token}`, accept: 'application/json' };
  if (typeof auth?.tokens?.account_id === 'string' && auth.tokens.account_id.length < 512) headers['chatgpt-account-id'] = auth.tokens.account_id;
  const t = await transport(config);
  let response;
  try { response = await t.fetch('https://chatgpt.com/backend-api/wham/usage', { method: 'GET', headers, signal, redirect: 'error' }); }
  catch (error) { if (signal?.aborted) failure('TIMEOUT'); failure('TRANSPORT'); }
  if (!response.ok) {
    // Do not consume or reflect the provider error body.
    response.body?.destroy?.();
    if (response.body?.cancel) await response.body.cancel().catch(() => {});
    if (response.status === 401 || response.status === 403) failure('AUTH');
    if (response.status === 429) failure('RATE_LIMIT');
    if (response.status === 404) failure('QUOTA_UNAVAILABLE');
    failure('SERVER');
  }
  if (!response.body) failure('QUOTA_FORMAT');
  const parts = []; let bytes = 0;
  try {
    for await (const chunk of response.body) {
      signal?.throwIfAborted();
      const part = Buffer.from(chunk); bytes += part.length;
      if (bytes > 262144) failure('QUOTA_FORMAT');
      parts.push(part);
    }
  } catch (error) { if (signal?.aborted) failure('TIMEOUT'); if (error?.code === 'QUOTA_FORMAT') throw error; failure('TRANSPORT'); }
  let raw;
  try { raw = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch (error) { failure('QUOTA_FORMAT'); }
  return normalizeQuota(raw);
}
