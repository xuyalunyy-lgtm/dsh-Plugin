/**
 * 传输层:可选 HTTP CONNECT 代理(Clash 等)。
 *
 * 背景:Node 的原生 fetch(undici)不读取系统代理/代理环境变量,而 ChatGPT
 * 后端通常需要走本地代理。部署依赖树中已有 node-fetch + https-proxy-agent,
 * 这里组合它们:配置了代理时经 CONNECT 隧道转发,否则直接用原生 fetch。
 *
 * 代理解析优先级:显式配置 proxy > 首个非空代理环境变量 > Windows 已启用静态系统代理。
 * 每次获取传输时重新读取本地设置;NO_PROXY 命中的主机直连。
 */

import { Readable } from 'node:stream';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { LlmError } from '@deepseek-ai/dsh-llm';

const runFile = promisify(execFile);
const INTERNET_SETTINGS = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';

function invalidProxy() {
  return new LlmError('代理配置无效，请检查 HTTP(S) 代理地址。', 'TRANSPORT');
}

/** Validate at the selected source; never include credentials or raw values in errors. */
function proxyUrl(value, system = false) {
  const text = value.trim();
  if (!text || /[\s\\]/.test(text)) throw invalidProxy();
  let url;
  try { url = new URL(text); } catch { throw invalidProxy(); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw invalidProxy();
  if (system && (url.username || url.password || url.pathname !== '/' || url.search || url.hash)) throw invalidProxy();
  return text;
}

async function registrySettings() {
  try {
    const { stdout } = await runFile('reg.exe', ['query', INTERNET_SETTINGS], {
      timeout: 3000, maxBuffer: 8192, windowsHide: true, encoding: 'utf8',
    });
    return stdout;
  } catch {
    throw new LlmError('无法读取 Windows 系统代理，请检查系统设置或显式配置代理。', 'TRANSPORT');
  }
}

/** Resolve the current proxy locally. Empty config does not disable system proxy discovery. */
export async function resolveProxyUrl(config) {
  if (typeof config?.proxy === 'string' && config.proxy.trim()) return proxyUrl(config.proxy);
  for (const name of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy']) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) return proxyUrl(value);
  }
  if (process.platform !== 'win32') return undefined;
  const settings = await registrySettings();
  const enabledEntry = settings.match(/^\s*ProxyEnable\s+(\S+)\s+([^\r\n]*)$/mi);
  // A successful key read without ProxyEnable means no static proxy was configured.
  if (!enabledEntry) return undefined;
  const enabled = enabledEntry[2].trim();
  if (enabledEntry[1] !== 'REG_DWORD' || !/^(?:0x[0-9a-f]+|\d+)$/i.test(enabled)) throw invalidProxy();
  if (Number(enabled) === 0) return undefined;
  if (Number(enabled) !== 1) throw invalidProxy();
  const serverEntry = settings.match(/^\s*ProxyServer\s+REG_SZ\s+([^\r\n]*)$/mi);
  const server = serverEntry?.[1].trim();
  if (!server) throw invalidProxy();
  let value = server;
  if (server.includes('=')) {
    const entries = server.split(';').map(entry => entry.trim());
    const entry = entries.find(item => /^https\s*=/i.test(item)) ?? entries.find(item => /^http\s*=/i.test(item));
    if (!entry) throw new LlmError('Windows 静态代理未提供 HTTP(S) 条目，请显式配置 HTTP(S) 代理。', 'TRANSPORT');
    value = entry.slice(entry.indexOf('=') + 1).trim();
  }
  // `https=host:port` selects HTTPS targets, not an HTTPS connection to the proxy.
  return proxyUrl(/^https?:\/\//i.test(value) ? value : `http://${value}`, true);
}

/** NO_PROXY 判定:逗号分隔条目,支持精确 host 与 *.suffix。 */
export function shouldBypassProxy(hostname, noProxyValue) {
  if (typeof noProxyValue !== 'string' || noProxyValue.trim().length === 0) return false;
  const host = String(hostname ?? '').toLowerCase();
  for (const raw of noProxyValue.split(',')) {
    const entry = raw.trim().toLowerCase();
    if (entry.length === 0) continue;
    if (entry === host) return true;
    if (entry.startsWith('*') && host.endsWith(entry.slice(1))) return true;
    if (entry.startsWith('.') && host.endsWith(entry)) return true;
  }
  return false;
}

/** 把 fetch 响应体统一为 Web ReadableStream(node-fetch 的 body 是 Node Readable)。 */
export function toWebStream(body) {
  if (body === undefined || body === null) return body;
  if (typeof body.pipeThrough === 'function') return body; // 原生 fetch:已是 Web ReadableStream
  return Readable.toWeb(body); // node-fetch:Node Readable → Web ReadableStream
}

/** Build transport; an internal resolved key avoids reading changing system settings twice. */
export async function createTransport(config, resolvedProxyUrl) {
  const proxyUrl = resolvedProxyUrl === undefined ? await resolveProxyUrl(config) : resolvedProxyUrl;
  if (!proxyUrl) {
    return { fetch, toWebStream };
  }
  try {
    const proxyMod = await import('https-proxy-agent');
    const HttpsProxyAgent = proxyMod.HttpsProxyAgent ?? proxyMod.default?.HttpsProxyAgent;
    const { default: nodeFetch } = await import('node-fetch');
    if (typeof HttpsProxyAgent !== 'function' || typeof nodeFetch !== 'function') {
      throw new Error('unexpected module shape');
    }
    const agent = new HttpsProxyAgent(proxyUrl);
    const proxyFetch = (url, init = {}) => {
      const target = typeof url === 'string' ? new URL(url) : url;
      if (shouldBypassProxy(target.hostname, process.env.NO_PROXY ?? process.env.no_proxy)) {
        return fetch(url, init);
      }
      return nodeFetch(url, { ...init, agent });
    };
    return { fetch: proxyFetch, toWebStream };
  } catch {
    throw new LlmError('无法初始化 HTTP(S) 代理传输，请检查代理设置和适配器依赖。', 'TRANSPORT');
  }
}
