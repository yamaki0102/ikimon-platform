import type { ScheduledController } from "../core/env";
import { extractCsv } from "./extractCsv";
import { extractJsonLd } from "./extractJsonLd";
import { extractRss } from "./extractRss";
import { fetchSource, type FetchImpl, type FetchOutcome } from "./fetchSource";
import { ingestFacts, touchSourceRecords } from "./ingest";
import type { ExternalAggregationEnv, ExtractedFact, ExtSourceRow } from "./types";

export const MAX_SOURCES_PER_TICK = 2;
export const MIN_REFETCH_MS = 6 * 60 * 60 * 1000;

export interface TickDeps {
  fetchImpl?: FetchImpl;
  now?: number;
}

async function extract(source: ExtSourceRow, out: FetchOutcome, fetchedAt: string): Promise<ExtractedFact[]> {
  const { body, contentType } = out;
  const path = new URL(source.listing_url).pathname.toLowerCase();
  if (source.method === "rss" || /xml|rss|atom/i.test(contentType) || /^\s*<\?xml|^\s*<rss|^\s*<feed/i.test(body)) {
    return extractRss(body, source.source_id, source.listing_url, fetchedAt);
  }
  if (/csv/i.test(contentType) || path.endsWith(".csv")) return extractCsv(body, source.source_id, source.listing_url, fetchedAt);
  return extractJsonLd(body, source.source_id, source.listing_url, fetchedAt);
}

export async function runExternalAggregationTick(env: ExternalAggregationEnv, _controller?: ScheduledController, deps: TickDeps = {}): Promise<void> {
  if (env.EXTERNAL_FETCH_ENABLED !== "on") return;
  try {
    const nowMs = deps.now ?? Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const cutoff = new Date(nowMs - MIN_REFETCH_MS).toISOString();
    const fetchImpl: FetchImpl = deps.fetchImpl ?? ((input, init) => fetch(input, init));
    const due = (await env.OBS_DB.prepare(
      `SELECT s.source_id,s.listing_url,s.method,f.etag,f.last_modified FROM ext_sources s
       LEFT JOIN ext_fetch_state f ON f.source_id=s.source_id
       WHERE s.enabled=1 AND s.terms_status IN ('allowed','conditional') AND (f.last_fetched_at IS NULL OR f.last_fetched_at<?)
       ORDER BY f.last_fetched_at IS NOT NULL, f.last_fetched_at, s.source_id LIMIT ?`,
    ).bind(cutoff, MAX_SOURCES_PER_TICK).all<ExtSourceRow>()).results;
    for (const source of due) {
      let status = "error";
      let etag: string | null = source.etag;
      let lastModified: string | null = source.last_modified;
      try {
        const out = await fetchSource(source, fetchImpl);
        status = out.status === "ok" ? "ok" : out.status === "not_modified" ? "not_modified" : out.status === "robots_blocked" ? "robots_blocked" : `error:${out.httpStatus ?? "network"}`;
        if (out.status === "ok") {
          etag = out.etag;
          lastModified = out.lastModified;
          const facts = await extract(source, out, nowIso);
          await ingestFacts(env.OBS_DB, source.source_id, facts, nowIso);
        } else if (out.status === "not_modified") {
          await touchSourceRecords(env.OBS_DB, source.source_id, nowIso);
        }
      } catch {
        status = "error:exception";
      }
      await env.OBS_DB.prepare(
        `INSERT INTO ext_fetch_state (source_id,last_fetched_at,etag,last_modified,last_status) VALUES (?,?,?,?,?)
         ON CONFLICT(source_id) DO UPDATE SET last_fetched_at=excluded.last_fetched_at,etag=excluded.etag,last_modified=excluded.last_modified,last_status=excluded.last_status`,
      ).bind(source.source_id, nowIso, etag, lastModified, status).run();
    }
  } catch {
    console.warn("external_aggregation_tick_pending");
  }
}
