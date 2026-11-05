/** Shared failure boundary for quota, controller and report; never retain raw errors. */
export function quotaFailureSnapshot(value) {
  if (!value || !['transport', 'request', 'body'].includes(value.stage)) return null;
  const allowed = ['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EPIPE', 'ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH', 'EHOSTUNREACH', 'ERR_STREAM_PREMATURE_CLOSE', 'CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_TLS_CERT_ALTNAME_INVALID', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_HEADERS_TIMEOUT', 'UND_ERR_BODY_TIMEOUT', 'UND_ERR_SOCKET', 'no-redirect', 'ABORTED'];
  return {
    stage: value.stage,
    networkCode: allowed.includes(value.networkCode) ? value.networkCode : 'UNKNOWN',
    elapsedMs: typeof value.elapsedMs === 'number' && Number.isFinite(value.elapsedMs) && value.elapsedMs >= 0 && value.elapsedMs <= 86400000 ? value.elapsedMs : null,
  };
}
