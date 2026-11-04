import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const runFile = promisify(execFile);
const INTERNET_SETTINGS = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';

/** Accept only a credential-free HTTP(S) proxy origin, never paths or URL extras. */
function proxyOrigin(value) {
  if (typeof value !== 'string' || value.length > 512) return null;
  const text = value.trim();
  if (!text || !/^https?:\/\/[^\s/?#\\@]+\/?$/i.test(text)) return null;
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return url.origin;
  } catch { return null; }
}

async function registrySettings(signal) {
  const { stdout } = await runFile('reg.exe', ['query', INTERNET_SETTINGS], {
    timeout: 3000, maxBuffer: 8192, windowsHide: true, encoding: 'utf8', signal,
  });
  return stdout;
}

function systemProxy(server) {
  if (!server) return { state: 'none', source: 'windows-system' };
  let value = server;
  if (server.includes('=')) {
    const entries = server.split(';').map(entry => entry.trim());
    const entry = entries.find(item => /^https\s*=/i.test(item)) ?? entries.find(item => /^http\s*=/i.test(item));
    if (!entry) return { state: 'unsupported', source: 'windows-system' };
    value = entry.slice(entry.indexOf('=') + 1).trim();
  }
  // Windows' `https=host:port` selects HTTPS destinations, not an HTTPS proxy transport.
  const proxy = proxyOrigin(/^https?:\/\//i.test(value) ? value : `http://${value}`);
  return proxy ? { state: 'detected', proxy, source: 'windows-system' } : { state: 'invalid', source: 'windows-system' };
}

/** Local read only: no network, port scanning, PAC execution, registry or config writes. */
export async function detectProxy(signal) {
  for (const name of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy']) {
    const value = process.env[name];
    if (typeof value !== 'string' || !value.trim()) continue;
    const proxy = proxyOrigin(value);
    // An invalid higher-priority environment value must not silently use another source.
    return proxy ? { state: 'detected', proxy, source: 'environment' } : { state: 'invalid', source: 'environment' };
  }
  if (process.platform !== 'win32') return { state: 'unsupported', source: 'windows-system' };
  try {
    const settings = await registrySettings(signal);
    const enabledEntry = settings.match(/^\s*ProxyEnable\s+(\S+)\s+([^\r\n]*)$/mi);
    // Absence is valid only after the containing key was read successfully.
    if (!enabledEntry) return { state: 'none', source: 'windows-system' };
    const enabled = enabledEntry[2].trim();
    if (enabledEntry[1] !== 'REG_DWORD' || !/^(?:0x[0-9a-f]+|\d+)$/i.test(enabled)) return { state: 'invalid', source: 'windows-system' };
    if (Number(enabled) === 0) return { state: 'none', source: 'windows-system' };
    if (Number(enabled) !== 1) return { state: 'invalid', source: 'windows-system' };
    const serverEntry = settings.match(/^\s*ProxyServer\s+REG_SZ\s+([^\r\n]*)$/mi);
    const server = serverEntry?.[1].trim();
    return !server ? { state: 'invalid', source: 'windows-system' } : systemProxy(server);
  } catch {
    // Do not expose registry output, proxy credentials, local paths or child-process errors.
    return { state: 'unavailable', source: 'windows-system' };
  }
}
