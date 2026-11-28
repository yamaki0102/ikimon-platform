import type { ExtSourceRow } from "./types";
import { sha256Hex } from "./util";

export const EXTERNAL_FETCH_UA = "ZUKAN external events contact: https://zukan.earth";
export const MAX_FETCHES_PER_SOURCE = 3;
export const MAX_BODY_CHARS = 2_000_000;

export type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

export interface FetchOutcome {
  status: "ok" | "not_modified" | "robots_blocked" | "error";
  httpStatus: number | null;
  body: string;
  contentType: string;
  etag: string | null;
  lastModified: string | null;
  contentHash: string | null;
  fetches: number;
}

const empty = (status: FetchOutcome["status"], httpStatus: number | null, fetches: number): FetchOutcome => ({
  status, httpStatus, body: "", contentType: "", etag: null, lastModified: null, contentHash: null, fetches,
});

export function robotsAllows(robotsTxt: string, path: string): boolean {
  let applies = false;
  let seenAgentGroup = false;
  const disallow: string[] = [];
  const allow: string[] = [];
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!seenAgentGroup) applies = false;
      seenAgentGroup = true;
      if (value === "*" || /zukan/i.test(value)) applies = true;
    } else {
      seenAgentGroup = false;
      if (!applies || value === "") continue;
      if (key === "disallow") disallow.push(value);
      else if (key === "allow") allow.push(value);
    }
  }
  const longest = (rules: string[]) => rules.filter(r => path.startsWith(r)).reduce((a, r) => Math.max(a, r.length), -1);
  return longest(allow) >= longest(disallow);
}

export async function fetchSource(source: ExtSourceRow, fetchImpl: FetchImpl): Promise<FetchOutcome> {
  let fetches = 0;
  const url = new URL(source.listing_url);
  const base: RequestInit = { headers: { "user-agent": EXTERNAL_FETCH_UA }, signal: AbortSignal.timeout(10000) };
  try {
    fetches++;
    const robots = await fetchImpl(`${url.origin}/robots.txt`, { ...base, signal: AbortSignal.timeout(10000) });
    if (robots.ok && !robotsAllows((await robots.text()).slice(0, 200_000), `${url.pathname}${url.search}`)) {
      return empty("robots_blocked", robots.status, fetches);
    }
  } catch {
    // robots unreachable: proceed
  }
  let lastStatus: number | null = null;
  while (fetches < MAX_FETCHES_PER_SOURCE) {
    fetches++;
    try {
      const headers: Record<string, string> = { "user-agent": EXTERNAL_FETCH_UA, accept: "text/html,application/xml,application/rss+xml,text/csv,*/*;q=0.5" };
      if (source.etag) headers["if-none-match"] = source.etag;
      if (source.last_modified) headers["if-modified-since"] = source.last_modified;
      const res = await fetchImpl(source.listing_url, { headers, signal: AbortSignal.timeout(10000) });
      lastStatus = res.status;
      if (res.status === 304) return { ...empty("not_modified", 304, fetches), etag: source.etag, lastModified: source.last_modified };
      if (res.ok) {
        const body = (await res.text()).slice(0, MAX_BODY_CHARS);
        return {
          status: "ok", httpStatus: res.status, body, contentType: res.headers.get("content-type") ?? "",
          etag: res.headers.get("etag"), lastModified: res.headers.get("last-modified"),
          contentHash: await sha256Hex(body), fetches,
        };
      }
      if (res.status < 500 && res.status !== 429) return empty("error", res.status, fetches);
    } catch {
      lastStatus = null;
    }
  }
  return empty("error", lastStatus, fetches);
}
