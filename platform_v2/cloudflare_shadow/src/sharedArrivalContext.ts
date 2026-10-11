const SAFE_SHARED_ARRIVAL_KEYS = new Set([
  "from",
  "source",
  "utm_source",
  "utm_medium",
  "share",
  "invite",
  "event",
]);

const SAFE_SHARED_ARRIVAL_VALUE = /^[a-z0-9][a-z0-9_.-]{0,31}$/u;

type QueryInput = URLSearchParams | Record<string, unknown> | null | undefined;

export type SharedArrivalContext = Readonly<Record<string, string>>;

function firstQueryValue(value: unknown): string | null {
  if (Array.isArray(value)) return firstQueryValue(value[0]);
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function isSafeSharedArrivalValue(value: string): boolean {
  const normalized = value.toLowerCase();
  if (!SAFE_SHARED_ARRIVAL_VALUE.test(normalized)) return false;
  if (/https?|www|@|%|:|\/|\\|\s/u.test(value)) return false;
  if (/^-?\d+(?:\.\d+)?$/u.test(value)) return false;
  if (/^[a-f0-9]{24,}$/u.test(normalized)) return false;
  return true;
}

export function collectSharedArrivalContext(query: QueryInput): SharedArrivalContext {
  const result: Record<string, string> = {};
  const entries = query instanceof URLSearchParams
    ? Array.from(query.entries())
    : Object.entries(query ?? {});

  for (const [rawKey, rawValue] of entries) {
    const key = String(rawKey).trim();
    if (!SAFE_SHARED_ARRIVAL_KEYS.has(key) || result[key] !== undefined) continue;
    const value = firstQueryValue(rawValue);
    if (!value || !isSafeSharedArrivalValue(value)) continue;
    result[key] = value.toLowerCase();
  }

  return result;
}

function isLocalPath(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//");
}

export function appendSharedArrivalContext(href: string, context: SharedArrivalContext): string {
  if (!Object.keys(context).length || !isLocalPath(href)) return href;

  const hashIndex = href.indexOf("#");
  const hash = hashIndex >= 0 ? href.slice(hashIndex) : "";
  const withoutHash = hashIndex >= 0 ? href.slice(0, hashIndex) : href;
  const queryIndex = withoutHash.indexOf("?");
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const query = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : "";
  const params = new URLSearchParams(query);

  for (const [key, value] of Object.entries(context)) {
    if (!SAFE_SHARED_ARRIVAL_KEYS.has(key) || !isSafeSharedArrivalValue(value)) continue;
    params.set(key, value.toLowerCase());
  }

  const rewrittenQuery = params.toString();
  return `${path}${rewrittenQuery ? `?${rewrittenQuery}` : ""}${hash}`;
}

export function appendSharedArrivalContextToLocalHrefs(html: string, context: SharedArrivalContext): string {
  if (!Object.keys(context).length) return html;
  return html.split(/(<script\b[\s\S]*?<\/script\s*>)/giu).map((part) => {
    if (/^<script\b/iu.test(part)) return part;
    return part.replace(/<a\b[^>]*>/giu, (anchor) => anchor.replace(/\bhref=(['"])(.*?)\1/iu, (attribute, quote: string, href: string) => {
    const path = href.split(/[?#]/u, 1)[0] ?? "";
    if (!/^\/(?!\/)(?:(?:ja|en|es|pt-br)\/)?(?:observations\/[^/]+|record)(?:\/|$)/u.test(path)) return attribute;
    const decodedHref = href.replace(/&amp;/giu, "&");
    const updated = appendSharedArrivalContext(decodedHref, context);
    return updated === decodedHref ? attribute : `href=${quote}${updated.replaceAll("&", "&amp;")}${quote}`;
    }));
  }).join("");
}
