import { open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

/** Internal only: bounded credential reads shared by status and quota, never an API response. */
export async function readCredentialFile(raw) {
  const file = raw.authFile || join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'auth.json');
  const handle = await open(file, 'r');
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.size > 262144) throw Object.assign(new Error('Invalid credential file'), { code: 'INVALID_CREDENTIAL' });
    const buffer = Buffer.alloc(262145);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (bytesRead > 262144) throw Object.assign(new Error('Invalid credential file'), { code: 'INVALID_CREDENTIAL' });
    const auth = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'));
    if (!auth || typeof auth !== 'object' || Array.isArray(auth)) throw Object.assign(new Error('Invalid credential data'), { code: 'INVALID_CREDENTIAL' });
    return auth;
  } finally { await handle.close(); }
}

/** Return presence and mode only; a local credential is not proof of server acceptance. */
export function summarizeCredentialData(auth) {
  const key = typeof auth.OPENAI_API_KEY === 'string' && auth.OPENAI_API_KEY.trim().length > 0;
  const token = typeof auth.tokens?.access_token === 'string' && auth.tokens.access_token.length > 0;
  if (auth.auth_mode === 'apikey' || (!auth.auth_mode && key && !token)) return { state: key ? 'present' : 'invalid', mode: 'apikey' };
  if (auth.auth_mode === 'chatgpt' || token) return { state: token ? 'present' : 'invalid', mode: 'chatgpt' };
  return { state: 'invalid', mode: 'unknown' };
}
