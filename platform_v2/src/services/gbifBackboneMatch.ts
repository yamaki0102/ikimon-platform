import { getPool } from "../db.js";

export type GbifMatch = {
  usageKey: number | null;
  acceptedUsageKey: number | null;
  canonicalName: string | null;
  rank: string | null;
  status: string | null;
  matchType: "EXACT" | "FUZZY" | "HIGHERRANK" | "NONE" | string;
  confidence: number | null;
  kingdom: string | null;
  phylum: string | null;
  className: string | null;
  orderName: string | null;
  family: string | null;
  genus: string | null;
  species: string | null;
  fromCache: boolean;
};

export type GbifMatchRequest = {
  name: string;
  rank?: string | null;
  kingdom?: string | null;
};

type GbifCacheRow = {
  gbif_usage_key: number | string | null;
  gbif_accepted_usage_key: number | string | null;
  canonical_name: string | null;
  rank: string | null;
  status: string | null;
  match_type: string | null;
  confidence: number | string | null;
  kingdom: string | null;
  phylum: string | null;
  class_name: string | null;
  order_name: string | null;
  family: string | null;
  genus: string | null;
  species: string | null;
};

type GbifApiResponse = {
  usageKey?: unknown;
  acceptedUsageKey?: unknown;
  canonicalName?: unknown;
  rank?: unknown;
  status?: unknown;
  matchType?: unknown;
  confidence?: unknown;
  kingdom?: unknown;
  phylum?: unknown;
  class?: unknown;
  order?: unknown;
  family?: unknown;
  genus?: unknown;
  species?: unknown;
};

const GBIF_MATCH_ENDPOINT = "https://api.gbif.org/v1/species/match";
const FETCH_TIMEOUT_MS = 8_000;
const BATCH_CONCURRENCY = 5;

function toNullableString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toNullableNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function noneMatch(): GbifMatch {
  return {
    usageKey: null,
    acceptedUsageKey: null,
    canonicalName: null,
    rank: null,
    status: null,
    matchType: "NONE",
    confidence: null,
    kingdom: null,
    phylum: null,
    className: null,
    orderName: null,
    family: null,
    genus: null,
    species: null,
    fromCache: false,
  };
}

function normalizeName(name: string): { queryName: string; normalizedName: string } {
  const queryName = name.trim();
  return {
    queryName,
    normalizedName: queryName.toLowerCase(),
  };
}

function normalizeOptionalValue(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeQueryRank(value: string | null): string | null {
  return value ? value.toLowerCase() : null;
}

function buildMatchUrl(name: string, rank: string | null, kingdom: string | null): string {
  const url = new URL(GBIF_MATCH_ENDPOINT);
  url.searchParams.set("name", name);
  if (rank) {
    url.searchParams.set("rank", rank);
  }
  if (kingdom) {
    url.searchParams.set("kingdom", kingdom);
  }
  url.searchParams.set("strict", "false");
  url.searchParams.set("verbose", "false");
  return url.toString();
}

function toMatchFromCacheRow(row: GbifCacheRow): GbifMatch {
  return {
    usageKey: toNullableNumber(row.gbif_usage_key),
    acceptedUsageKey: toNullableNumber(row.gbif_accepted_usage_key),
    canonicalName: toNullableString(row.canonical_name),
    rank: toNullableString(row.rank),
    status: toNullableString(row.status),
    matchType: toNullableString(row.match_type) ?? "NONE",
    confidence: toNullableNumber(row.confidence),
    kingdom: toNullableString(row.kingdom),
    phylum: toNullableString(row.phylum),
    className: toNullableString(row.class_name),
    orderName: toNullableString(row.order_name),
    family: toNullableString(row.family),
    genus: toNullableString(row.genus),
    species: toNullableString(row.species),
    fromCache: true,
  };
}

function toMatchFromApiPayload(payload: GbifApiResponse): GbifMatch {
  return {
    usageKey: toNullableNumber(payload.usageKey),
    acceptedUsageKey: toNullableNumber(payload.acceptedUsageKey),
    canonicalName: toNullableString(payload.canonicalName),
    rank: toNullableString(payload.rank),
    status: toNullableString(payload.status),
    matchType: toNullableString(payload.matchType) ?? "NONE",
    confidence: toNullableNumber(payload.confidence),
    kingdom: toNullableString(payload.kingdom),
    phylum: toNullableString(payload.phylum),
    className: toNullableString(payload.class),
    orderName: toNullableString(payload.order),
    family: toNullableString(payload.family),
    genus: toNullableString(payload.genus),
    species: toNullableString(payload.species),
    fromCache: false,
  };
}

async function fetchGbifMatch(
  queryName: string,
  rank: string | null,
  kingdom: string | null,
): Promise<GbifApiResponse | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(buildMatchUrl(queryName, rank, kingdom), {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (typeof payload !== "object" || payload === null) {
      return null;
    }
    return payload as GbifApiResponse;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  if (tasks.length === 0) {
    return [];
  }

  const results: T[] = new Array(tasks.length);
  let index = 0;
  const workerCount = Math.min(Math.max(concurrency, 1), tasks.length);

  const workers = Array.from({ length: workerCount }, async () => {
    while (true) {
      const currentIndex = index;
      index += 1;

      if (currentIndex >= tasks.length) {
        return;
      }

      const task = tasks[currentIndex];
      if (!task) {
        continue;
      }
      results[currentIndex] = await task();
    }
  });

  await Promise.all(workers);
  return results;
}

export async function matchTaxon(req: GbifMatchRequest): Promise<GbifMatch> {
  const { queryName, normalizedName } = normalizeName(req.name);
  if (!queryName) {
    return noneMatch();
  }

  const rankHint = normalizeOptionalValue(req.rank);
  const normalizedRank = normalizeQueryRank(rankHint);
  const kingdomHint = normalizeOptionalValue(req.kingdom);

  let pool: ReturnType<typeof getPool> | null = null;
  try {
    pool = getPool();
  } catch {
    pool = null;
  }

  if (pool) {
    try {
      const cached = await pool.query<GbifCacheRow>(
        `SELECT
           gbif_usage_key,
           gbif_accepted_usage_key,
           canonical_name,
           rank,
           status,
           match_type,
           confidence,
           kingdom,
           phylum,
           class_name,
           order_name,
           family,
           genus,
           species
         FROM taxa_gbif_cache
         WHERE normalized_name = $1
           AND coalesce(query_rank, '') = $2
           AND fetched_at >= NOW() - (ttl_days::text || ' days')::interval
         LIMIT 1`,
        [normalizedName, normalizedRank ?? ""],
      );

      const row = cached.rows[0];
      if (row) {
        return toMatchFromCacheRow(row);
      }
    } catch {
      // cache read failure should not block remote lookup
    }
  }

  const apiPayload = await fetchGbifMatch(queryName, rankHint, kingdomHint);
  if (!apiPayload) {
    return noneMatch();
  }

  const match = toMatchFromApiPayload(apiPayload);
  if (!pool) {
    return match;
  }

  try {
    await pool.query(
      `INSERT INTO taxa_gbif_cache (
         query_name,
         normalized_name,
         query_rank,
         gbif_usage_key,
         gbif_accepted_usage_key,
         canonical_name,
         rank,
         status,
         match_type,
         confidence,
         kingdom,
         phylum,
         class_name,
         order_name,
         family,
         genus,
         species,
         raw_payload
       ) VALUES (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15, $16, $17, $18::jsonb
       )
       ON CONFLICT (normalized_name, (coalesce(query_rank, '')))
       DO UPDATE SET
         query_name = EXCLUDED.query_name,
         query_rank = EXCLUDED.query_rank,
         gbif_usage_key = EXCLUDED.gbif_usage_key,
         gbif_accepted_usage_key = EXCLUDED.gbif_accepted_usage_key,
         canonical_name = EXCLUDED.canonical_name,
         rank = EXCLUDED.rank,
         status = EXCLUDED.status,
         match_type = EXCLUDED.match_type,
         confidence = EXCLUDED.confidence,
         kingdom = EXCLUDED.kingdom,
         phylum = EXCLUDED.phylum,
         class_name = EXCLUDED.class_name,
         order_name = EXCLUDED.order_name,
         family = EXCLUDED.family,
         genus = EXCLUDED.genus,
         species = EXCLUDED.species,
         raw_payload = EXCLUDED.raw_payload,
         fetched_at = NOW()`,
      [
        queryName,
        normalizedName,
        normalizedRank,
        match.usageKey,
        match.acceptedUsageKey,
        match.canonicalName,
        match.rank,
        match.status,
        match.matchType,
        match.confidence,
        match.kingdom,
        match.phylum,
        match.className,
        match.orderName,
        match.family,
        match.genus,
        match.species,
        JSON.stringify(apiPayload),
      ],
    );
  } catch {
    // cache write failure is non-fatal
  }

  return match;
}

export async function matchTaxonBatch(reqs: GbifMatchRequest[]): Promise<GbifMatch[]> {
  const tasks = reqs.map((req) => {
    const hasName = req.name.trim().length > 0;
    if (!hasName) {
      return async () => noneMatch();
    }
    return async () => matchTaxon(req);
  });

  return runWithConcurrency(tasks, BATCH_CONCURRENCY);
}
