const PRODUCTION_CANONICAL_ORIGIN = "https://zukan.earth";
const STAGING_CANONICAL_ORIGIN = "https://staging.zukan.earth";
const KNOWN_PUBLIC_ORIGIN_PATTERN = /https:\/\/(?:www\.)?ikimon\.life|https:\/\/staging\.ikimon\.life|https:\/\/zukan\.earth|https:\/\/staging\.zukan\.earth/g;

export type DomainPresentationEnv = {
  ENVIRONMENT?: unknown;
};

function environmentName(env: DomainPresentationEnv): string {
  return String(env.ENVIRONMENT ?? "").trim().toLowerCase();
}

function requestCanonicalOrigin(request: Request, env: DomainPresentationEnv): string | null {
  const environment = environmentName(env);
  if (environment === "production") return PRODUCTION_CANONICAL_ORIGIN;
  if (environment === "staging") return STAGING_CANONICAL_ORIGIN;

  const host = new URL(request.url).hostname.toLowerCase();
  if (host === "zukan.earth" || host === "ikimon.life" || host === "www.ikimon.life") {
    return PRODUCTION_CANONICAL_ORIGIN;
  }
  if (host === "staging.zukan.earth" || host === "staging.ikimon.life") {
    return STAGING_CANONICAL_ORIGIN;
  }
  return null;
}

function canonicalizeKnownOrigins(value: string, canonicalOrigin: string): string {
  return value.replace(KNOWN_PUBLIC_ORIGIN_PATTERN, canonicalOrigin);
}

function patchSeoTags(html: string, canonicalOrigin: string): string {
  return html
    .replace(/<link\b[^>]*>/gi, (tag) => {
      if (!/\brel\s*=\s*["'][^"']*\b(?:canonical|alternate)\b[^"']*["']/i.test(tag)) return tag;
      return canonicalizeKnownOrigins(tag, canonicalOrigin);
    })
    .replace(/<meta\b[^>]*>/gi, (tag) => {
      if (!/\b(?:property|name)\s*=\s*["'](?:og:url|og:image|twitter:image)["']/i.test(tag)) return tag;
      return canonicalizeKnownOrigins(tag, canonicalOrigin);
    })
    .replace(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, (script) =>
      canonicalizeKnownOrigins(script, canonicalOrigin));
}

function patchedHeaders(response: Response, canonicalOrigin: string): Headers {
  const headers = new Headers(response.headers);
  for (const name of ["link", "content-location"]) {
    const value = headers.get(name);
    if (value) headers.set(name, canonicalizeKnownOrigins(value, canonicalOrigin));
  }
  return headers;
}

export async function patchCanonicalDomainPresentation(
  request: Request,
  response: Response,
  env: DomainPresentationEnv,
): Promise<Response> {
  const canonicalOrigin = requestCanonicalOrigin(request, env);
  if (!canonicalOrigin) return response;

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("text/html")) {
    const headers = patchedHeaders(response, canonicalOrigin);
    if ([...headers].every(([name, value]) => response.headers.get(name) === value)) return response;
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }

  const html = await response.text();
  const patched = patchSeoTags(html, canonicalOrigin);
  const headers = patchedHeaders(response, canonicalOrigin);
  headers.delete("content-length");
  return new Response(patched, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
