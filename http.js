function respond(res, status, value) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(value));
}
/** Authenticate before body reading. Accept only small same-origin JSON operations. */
export function createHttpHandler(connection, dispatch) {
  return async (req, res) => {
    const rejection = connection.requestRejection(req);
    if (rejection) return respond(res, rejection, { ok: false, code: 'UNAUTHORIZED', error: '连接未获授权。' });
    if (req.method !== 'POST') return respond(res, 405, { ok: false, code: 'METHOD', error: '仅支持 POST。' });
    if ((req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase() !== 'application/json') return respond(res, 415, { ok: false, code: 'CONTENT_TYPE', error: '需要 JSON 请求。' });
    const abort = new AbortController();
    const onClose = () => { if (!res.writableEnded) abort.abort(); };
    res.on('close', onClose);
    try {
      const parts = []; let size = 0;
      for await (const chunk of req) {
        const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += part.length;
        if (size > 8192) return respond(res, 413, { ok: false, code: 'TOO_LARGE', error: '请求不能超过 8 KiB。' });
        parts.push(part);
      }
      let request;
      try { request = JSON.parse(Buffer.concat(parts).toString('utf8')); }
      catch (error) { return respond(res, 400, { ok: false, code: 'INVALID_JSON', error: 'JSON 格式无效。' }); }
      const result = await dispatch(request, abort.signal);
      if (!res.destroyed) respond(res, 200, result);
    } catch (error) {
      if (!res.headersSent && !res.destroyed) respond(res, 500, { ok: false, code: 'FAILED', error: '操作失败，请重新读取状态。' });
    } finally { res.off('close', onClose); }
  };
}
