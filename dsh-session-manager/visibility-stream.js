/** Owner-only visibility SSE: one baseline and committed state notifications.
 * No Session listing, polling, credentials or request receipts cross this route. */
export function createVisibilityStream(connection, controller) {
  const streams = new Set();
  let closed = false;
  const reply = (res, status, error) => {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify({ ok: false, error }));
  };
  function handler(req, res) {
    const admission = connection.admit(req);
    if (admission.rejection) return reply(res, admission.rejection, '请求未通过连接鉴权。');
    if (admission.peer?.principal?.kind !== 'owner') return reply(res, 403, '仅当前 Harness 所有者可读取工作区显示设置。');
    if (req.method !== 'GET') return reply(res, 405, '仅支持 GET。');
    if (closed) return reply(res, 503, '会话管理服务正在关闭。');
    const signal = admission.peer.signal;
    if (signal?.aborted || req.aborted || res.destroyed) return res.end();
    let disposed = false, unsubscribe;
    const cleanup = () => {
      if (disposed) return;
      disposed = true;
      streams.delete(cleanup);
      unsubscribe?.();
      req.off('aborted', cleanup);
      res.off('close', cleanup);
      res.off('error', cleanup);
      signal?.removeEventListener('abort', cleanup);
      if (!res.destroyed && !res.writableEnded) res.end();
    };
    const send = snapshot => {
      if (disposed) return;
      try {
        // A slow/disconnected subscriber must not buffer unbounded future state.
        // EventSource reconnect receives the latest complete baseline instead.
        if (!res.write(`data: ${JSON.stringify(snapshot)}\n\n`)) cleanup();
      } catch { cleanup(); }
    };
    try {
      streams.add(cleanup);
      req.once('aborted', cleanup);
      res.once('close', cleanup);
      res.once('error', cleanup);
      signal?.addEventListener('abort', cleanup, { once: true });
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Content-Type-Options': 'nosniff',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders?.();
      // Both subscription and snapshot read are synchronous, so no committed
      // revision can land between a baseline read and subscription setup.
      unsubscribe = controller.subscribeVisibility(send);
      send(controller.readVisibility());
    } catch (error) {
      cleanup();
      throw error;
    }
  }
  return { handler, close() { closed = true; for (const cleanup of [...streams]) cleanup(); } };
}
