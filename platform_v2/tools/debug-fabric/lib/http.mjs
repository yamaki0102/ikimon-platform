import { DebugError, normalizeHost, safeHeaderValue, safePath } from './contract.mjs';
import { sha256 } from './evidence.mjs';

export async function request(manifest, spec, secrets, fetchImpl) {
  if (typeof fetchImpl !== 'function') throw new DebugError('BLOCKED', 'fetch_unavailable');
  const url = new URL(safePath(spec.path), manifest.base_url);
  if (!manifest.allowed_hosts.includes(normalizeHost(url.hostname))) throw new DebugError('UNSAFE', 'probe_host_not_allowlisted');
  const profile = manifest.header_profiles[spec.headers_profile];
  const headers = { accept: '*/*', 'cache-control': 'no-store', 'user-agent': 'ikimon-debug-fabric/1' };
  for (const [name, source] of Object.entries(profile.headers)) {
    headers[name] = source.type === 'literal' ? source.value : `${source.prefix}${safeHeaderValue(secrets[source.secret])}`;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), manifest.timeout_ms);
  const started = performance.now();
  try {
    const response = await fetchImpl(url, { method: spec.method, headers, redirect: 'manual', cache: 'no-store', signal: controller.signal });
    if (response.status >= 300 && response.status < 400) throw new DebugError('UNSAFE', 'redirect_response_forbidden');
    const responseHeaders = Object.fromEntries([...response.headers.entries()].map(([name, value]) => [name.toLowerCase(), value]));
    const body = spec.method === 'HEAD' ? Buffer.alloc(0) : await boundedBody(response.body, manifest.max_response_bytes, responseHeaders['content-length']);
    return {
      status: response.status,
      headers: responseHeaders,
      bodyText: body.toString('utf8'),
      bodyBytes: body.length,
      bodySha256: sha256(body),
      durationMs: Math.max(0, Math.round(performance.now() - started)),
    };
  } catch (error) {
    if (error instanceof DebugError) throw error;
    throw new DebugError('BLOCKED', controller.signal.aborted ? 'http_timeout' : 'http_transport_error');
  } finally {
    clearTimeout(timer);
  }
}

async function boundedBody(stream, limit, contentLength) {
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > limit) throw new DebugError('UNSAFE', 'response_body_declared_too_large');
  if (!stream) return Buffer.alloc(0);
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel().catch(() => undefined);
        throw new DebugError('UNSAFE', 'response_body_too_large');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}
