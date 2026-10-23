import { z } from 'zod';
import { ThemeRepository, INITIAL_DOCUMENT, validDocument, validImageRecord } from './host-store.js';
import { toolDefinition } from './tool.js';

export const inject = ['storageDomain', 'connection', 'tools'];
export async function apply(ctx) {
  const domain = await ctx.storageDomain.open({
    name: 'local-qinglan-theme', version: 1, layout: 'per-record',
    global: { schema: z.custom(validDocument), initial: INITIAL_DOCUMENT },
    tables: { images: { valueSchema: z.custom(validImageRecord) } },
  });
  const repository = new ThemeRepository(domain);
  let closing = false;
  const service = { execute(input) {
    if (closing) return Promise.reject(Object.assign(new Error('Theme service is closing'), { code: 'UNAVAILABLE' }));
    return repository.execute(input);
  } };
  // Reject new ingress before draining admitted work and closing the domain.
  ctx.effect(() => () => { closing = true; return repository.drain().then(() => domain.close()); });
  const headers = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  const json = (value, status = 200) => Response.json(value, { status, headers });
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/qinglan-theme', methods: ['POST'], requestBody: 'streaming',
    async fetch(request) {
      try {
        if (!(request.headers.get('content-type') || '').toLowerCase().startsWith('application/json')) {
          return json({ ok: false, code: 'INVALID_INPUT', message: 'Expected application/json' }, 415);
        }
        const reader = request.body?.getReader();
        if (!reader) return json({ ok: false, code: 'INVALID_INPUT', message: 'Missing request body' }, 400);
        const chunks = []; let bytes = 0;
        try {
          for (;;) {
            const item = await reader.read(); if (item.done) break;
            bytes += item.value.byteLength;
            if (bytes > 4_300_000) { await reader.cancel(); return json({ ok: false, code: 'TOO_LARGE', message: 'Request exceeds 4.3 MB' }, 413); }
            chunks.push(item.value);
          }
        } finally { reader.releaseLock(); }
        const body = Buffer.concat(chunks).toString('utf8');
        let input;
        try { input = JSON.parse(body); } catch { return json({ ok: false, code: 'INVALID_INPUT', message: 'Invalid JSON' }, 400); }
        if (request.signal.aborted) return json({ ok: false, code: 'ABORTED', message: 'Request aborted' }, 408);
        return json({ ok: true, value: await service.execute(input) });
      } catch (error) {
        const code = error?.code || 'SAVE_FAILED';
        return json({ ok: false, code, message: code === 'SAVE_FAILED' ? 'Host storage operation failed' : String(error.message) }, code === 'CONFLICT' ? 409 : code === 'INVALID_INPUT' ? 400 : 500);
      }
    },
  }));
  ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/qinglan-theme/image', methods: ['GET'], requestBody: 'buffered',
    async fetch(request) {
      const id = new URL(request.url).searchParams.get('id');
      if (!id || !/^[a-f0-9]{64}$/.test(id)) return new Response(null, { status: 404, headers });
      if (closing) return new Response(null, { status: 503, headers });
      const image = await repository.readImage(id);
      if (!image) return new Response(null, { status: 404, headers });
      return new Response(Buffer.from(image.data, 'base64'), { headers: { ...headers, 'Content-Type': image.mime } });
    },
  }));
  ctx.effect(() => ctx.tools.register(toolDefinition(service)));
}
