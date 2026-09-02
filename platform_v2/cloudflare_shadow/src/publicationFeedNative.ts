import { isMeaningfulPublicObservationLabel } from "../../src/services/observationQualityGate";
import { PUBLICATION_FEED_DEFINITIONS } from "../../src/services/publicationFeedDefinitions";
import { PRODUCTION_PUBLIC_ORIGIN, STAGING_PUBLIC_ORIGIN } from "../../src/services/trustedPublicOrigin";
import type {
  PublicationFeedChannelKey,
  PublicationFeedCursor,
  PublicationFeedItem,
  PublicationFeedLocale,
  PublicationFeedResponse,
} from "../../src/services/publicationFeed";

const PUBLICATION_FEED_CACHE_CONTROL = "public, max-age=30, must-revalidate";
const PUBLICATION_FEED_DEFAULT_LIMIT = 12;
const PUBLICATION_FEED_MAX_LIMIT = 24;
const PUBLICATION_FEED_QUERY_LIMIT = 96;

export const PUBLIC_CIVIC_VISIBILITY_SQL = "COALESCE(civic.audience_scope, 'public') = 'public' " +
  "AND COALESCE(civic.public_precision, 'municipality') NOT IN ('hidden', 'exact_private') " +
  "AND civic.risk_lane = 'normal'";

type D1Value = string | number | null;

export interface PublicationFeedNativePreparedStatement {
  bind(...values: D1Value[]): PublicationFeedNativePreparedStatement;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface PublicationFeedNativeDatabase {
  prepare(sql: string): PublicationFeedNativePreparedStatement;
}

export type PublicationFeedNativeRow = {
  observation_id: string;
  observed_at: string;
  source_updated_at: string | null;
  taxon_label: string | null;
  public_area_label: string | null;
  exact_lat: number | null;
  exact_lng: number | null;
  boundary_name: string;
  boundary_geometry_json: string;
  record_consent: string | null;
  research_use_consent: string | null;
  dataset_license: string | null;
  media_license: string | null;
  external_export_allowed: number | boolean | null;
  consent_source: string | null;
  rights_policy_version: string | null;
  withdrawal_status: string | null;
  audience_scope: string | null;
  public_precision: string | null;
  risk_lane: string | null;
  living_derivative_key: string | null;
  living_width: number | null;
  living_height: number | null;
  living_metadata_json: string | null;
  community_derivative_key: string | null;
  community_width: number | null;
  community_height: number | null;
  community_metadata_json: string | null;
  ai_assessment_status: string | null;
  ai_candidate_label: string | null;
  ai_confidence: number | null;
  human_label: string | null;
};

const PUBLICATION_FEED_NATIVE_SQL = `
  WITH ranked_living_assets AS (
    SELECT asset.observation_id,
           asset.public_derivative_key,
           asset.width,
           asset.height,
           asset.public_derivative_metadata_json,
           ROW_NUMBER() OVER (
             PARTITION BY asset.observation_id
             ORDER BY COALESCE(asset.public_ready_at, asset.uploaded_at, '') DESC, asset.asset_id
           ) AS asset_rank
      FROM asset_ledger asset
     WHERE asset.processing_state = 'uploaded'
       AND asset.public_derivative_key IS NOT NULL
       AND asset.public_derivative_verified_at IS NOT NULL
       AND asset.public_derivative_metadata_json IS NOT NULL
       AND asset.public_derivative_metadata_json NOT LIKE '%"scannedContainer":"svg+xml"%'
       AND asset.public_derivative_metadata_json NOT LIKE '%"contentType":"image/svg%'
       AND asset.exif_scrub_state = 'scrubbed'
       AND asset.public_ready_at IS NOT NULL
       AND asset.mime LIKE 'image/%'
       AND NOT (COALESCE(asset.width, 0) = 320 AND COALESCE(asset.height, 0) = 240 AND COALESCE(asset.bytes, 0) BETWEEN 1 AND 12000)
       AND NOT (COALESCE(asset.width, 0) = 1 AND COALESCE(asset.height, 0) = 1)
  ),
  ranked_community_assets AS (
    SELECT asset.observation_id,
           asset.public_derivative_key,
           asset.width,
           asset.height,
           asset.public_derivative_metadata_json,
           ROW_NUMBER() OVER (
             PARTITION BY asset.observation_id
             ORDER BY COALESCE(asset.public_ready_at, asset.uploaded_at, '') DESC, asset.asset_id
           ) AS asset_rank
      FROM asset_ledger asset
     WHERE asset.processing_state = 'uploaded'
       AND asset.public_derivative_key IS NOT NULL
       AND asset.public_derivative_verified_at IS NOT NULL
       AND asset.public_derivative_metadata_json IS NOT NULL
       AND asset.public_derivative_metadata_json NOT LIKE '%"scannedContainer":"svg+xml"%'
       AND asset.public_derivative_metadata_json NOT LIKE '%"contentType":"image/svg%'
       AND asset.exif_scrub_state = 'scrubbed'
       AND asset.public_ready_at IS NOT NULL
       AND asset.mime LIKE 'image/%'
       AND NOT (COALESCE(asset.width, 0) = 320 AND COALESCE(asset.height, 0) = 240 AND COALESCE(asset.bytes, 0) BETWEEN 1 AND 12000)
       AND NOT (COALESCE(asset.width, 0) = 1 AND COALESCE(asset.height, 0) = 1)
       AND EXISTS (
         SELECT 1
           FROM record_observation_source_map source_map
           JOIN record_observation_media media ON media.observation_id = source_map.observation_id
          WHERE source_map.source_entity_id = asset.observation_id
            AND source_map.ambiguity_state = 'clear'
            AND media.media_id = asset.asset_id
            AND media.active = 1
            AND media.role = 'context'
       )
  )
  SELECT o.observation_id,
         o.observed_at,
         COALESCE(r.updated_at, o.created_at, o.observed_at) AS source_updated_at,
         o.taxon_label,
         r.public_area_label,
         o.exact_lat,
         o.exact_lng,
         boundary.name AS boundary_name,
         boundary.geometry_json AS boundary_geometry_json,
         rights.record_consent,
         rights.research_use_consent,
         rights.dataset_license,
         rights.media_license,
         rights.external_export_allowed,
         rights.consent_source,
         rights.rights_policy_version,
         rights.withdrawal_status,
         civic.audience_scope,
         civic.public_precision,
         civic.risk_lane,
         living.public_derivative_key AS living_derivative_key,
         living.width AS living_width,
         living.height AS living_height,
         living.public_derivative_metadata_json AS living_metadata_json,
         community.public_derivative_key AS community_derivative_key,
         community.width AS community_width,
         community.height AS community_height,
         community.public_derivative_metadata_json AS community_metadata_json,
         ai.ai_assessment_status,
         COALESCE(ai.candidate_vernacular_name, ai.candidate_scientific_name, ai.ai_recommended_taxon_name) AS ai_candidate_label,
         CAST(json_extract(ai.source_payload_json, '$.confidence_score') AS REAL) AS ai_confidence,
         (
           SELECT COALESCE(accepted_claim.accepted_name, accepted_claim.proposed_name)
             FROM record_observation_source_map source_map
             JOIN record_observations record_observation
               ON record_observation.observation_id = source_map.observation_id
             JOIN observation_identification_claims accepted_claim
               ON accepted_claim.observation_id = record_observation.observation_id
              AND accepted_claim.identification_id = record_observation.accepted_identification_id
              AND accepted_claim.claim_status = 'accepted'
            WHERE source_map.source_entity_id = o.observation_id
              AND source_map.ambiguity_state = 'clear'
              AND record_observation.lifecycle_status = 'active'
              AND record_observation.verification_status IN ('owner_confirmed', 'community_review', 'verified')
            ORDER BY COALESCE(accepted_claim.decided_at, accepted_claim.updated_at, accepted_claim.created_at) DESC,
                     accepted_claim.identification_id
            LIMIT 1
         ) AS human_label
    FROM observations o
    JOIN readmodel_public_observations r ON r.observation_id = o.observation_id
    JOIN observation_data_rights rights ON rights.visit_id = o.observation_id
    JOIN production_import_area_polygon_readmodel boundary ON boundary.entity_key = ?
    LEFT JOIN civic_observation_contexts civic ON civic.visit_id = o.observation_id
    LEFT JOIN observation_ai_review_targets ai ON ai.occurrence_id = 'occ:' || o.observation_id || ':0'
    LEFT JOIN ranked_living_assets living ON living.observation_id = o.observation_id AND living.asset_rank = 1
    LEFT JOIN ranked_community_assets community ON community.observation_id = o.observation_id AND community.asset_rank = 1
   WHERE o.visibility = 'public'
     AND o.emergency_hidden = 0
     AND o.exact_lat BETWEEN boundary.bbox_min_lat AND boundary.bbox_max_lat
     AND o.exact_lng BETWEEN boundary.bbox_min_lng AND boundary.bbox_max_lng
     AND rights.external_export_allowed = 1
     AND rights.record_consent = 'external_export'
     AND (
       (
         rights.consent_source = 'user_selected'
         AND rights.rights_policy_version = 'site_intelligence_p0_v2'
         AND rights.research_use_consent = 'none'
       )
       OR (
         rights.research_use_consent = 'public_export'
         AND rights.dataset_license IS NOT NULL
         AND rights.media_license IS NOT NULL
       )
     )
     AND rights.withdrawal_status = 'active'
     AND ${PUBLIC_CIVIC_VISIBILITY_SQL}
     AND EXISTS (
       SELECT 1
         FROM record_observation_source_map publication_source
         JOIN record_observations publication_record
           ON publication_record.observation_id = publication_source.observation_id
        WHERE publication_source.source_entity_id = o.observation_id
          AND publication_source.ambiguity_state = 'clear'
          AND publication_record.lifecycle_status = 'active'
          AND publication_record.verification_status IN ('owner_confirmed', 'community_review', 'verified')
     )
   ORDER BY o.observed_at DESC, o.observation_id
   LIMIT ?
`;

type PolygonGeometry = {
  type: "Polygon";
  coordinates: number[][][];
};

type MultiPolygonGeometry = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

type SupportedGeometry = PolygonGeometry | MultiPolygonGeometry;

type ParsedQuery = {
  channel?: PublicationFeedChannelKey;
  locale: PublicationFeedLocale;
  limit: number;
  cursor: PublicationFeedCursor | null;
};

type NativeItem = PublicationFeedItem & { sourceUpdatedAt: string };

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function normalizedDate(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function boundedConfidence(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : null;
}

function positiveInteger(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseGeometry(value: unknown): SupportedGeometry | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = JSON.parse(value) as { type?: unknown; coordinates?: unknown };
    if ((parsed.type !== "Polygon" && parsed.type !== "MultiPolygon") || !Array.isArray(parsed.coordinates)) return null;
    return parsed as SupportedGeometry;
  } catch {
    return null;
  }
}

function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const current = ring[i];
    const previous = ring[j];
    if (!current || !previous || current.length < 2 || previous.length < 2) continue;
    const xi = Number(current[0]);
    const yi = Number(current[1]);
    const xj = Number(previous[0]);
    const yj = Number(previous[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersects = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lng: number, lat: number, polygon: number[][][]): boolean {
  const outer = polygon[0];
  if (!outer || !pointInRing(lng, lat, outer)) return false;
  return !polygon.slice(1).some((hole) => pointInRing(lng, lat, hole));
}

function pointInGeometry(lng: unknown, lat: unknown, geometry: SupportedGeometry | null): boolean {
  if (typeof lng !== "number" || typeof lat !== "number" || !Number.isFinite(lng) || !Number.isFinite(lat) || !geometry) return false;
  return geometry.type === "Polygon"
    ? pointInPolygon(lng, lat, geometry.coordinates)
    : geometry.coordinates.some((polygon) => pointInPolygon(lng, lat, polygon));
}

export function metadataProvesPublicFaceSafety(value: string | null): boolean {
  if (!value) return false;
  try {
    const metadata = JSON.parse(value) as Record<string, unknown>;
    const facePrivacy = metadata.facePrivacy;
    if (facePrivacy === "no_faces" || facePrivacy === "redacted") return true;
    if (facePrivacy && typeof facePrivacy === "object" && !Array.isArray(facePrivacy)) {
      const status = cleanText((facePrivacy as Record<string, unknown>).status);
      if (status === "no_faces" || status === "redacted") return true;
    }
    const status = cleanText(metadata.facePrivacyStatus ?? metadata.face_privacy_status);
    return status === "no_faces" || status === "redacted";
  } catch {
    return false;
  }
}

function safeDerivedKey(value: unknown): string | null {
  const key = cleanText(value);
  if (!key || !key.startsWith("derived/") || key.includes("..") || key.includes("\\") || /%(?:2e|5c)/i.test(key)) return null;
  return key;
}

function publicOrigin(url: URL): string {
  return url.hostname === "staging.zukan.earth" || url.hostname === "staging.ikimon.life"
    ? STAGING_PUBLIC_ORIGIN
    : PRODUCTION_PUBLIC_ORIGIN;
}

function isEligible(row: PublicationFeedNativeRow): boolean {
  if (!(row.external_export_allowed === true || Number(row.external_export_allowed) === 1)) return false;
  if (row.record_consent !== "external_export" || row.withdrawal_status !== "active") return false;
  const directExternalConsent = row.consent_source === "user_selected"
    && row.rights_policy_version === "site_intelligence_p0_v2"
    && row.research_use_consent === "none";
  const legacyOpenLicenseConsent = row.research_use_consent === "public_export"
    && Boolean(cleanText(row.dataset_license))
    && Boolean(cleanText(row.media_license));
  if (!directExternalConsent && !legacyOpenLicenseConsent) return false;
  if (row.audience_scope && row.audience_scope !== "public") return false;
  if (row.public_precision === "hidden" || row.public_precision === "exact_private") return false;
  if (row.risk_lane !== "normal") return false;
  return pointInGeometry(row.exact_lng, row.exact_lat, parseGeometry(row.boundary_geometry_json));
}

function classification(row: PublicationFeedNativeRow, title: string): PublicationFeedItem["classification"] {
  if (cleanText(row.human_label)) {
    return { state: "verified", source: "human_review", confidence: null };
  }
  const candidate = cleanText(row.ai_candidate_label);
  if (row.ai_assessment_status === "ai_judgement" && candidate && title === candidate) {
    return { state: "candidate", source: "ai", confidence: boundedConfidence(row.ai_confidence) };
  }
  return { state: "accepted", source: "record", confidence: null };
}

function nativeItems(row: PublicationFeedNativeRow, origin: string, scopeLabel: string): NativeItem[] {
  if (!isEligible(row)) return [];
  const observedAt = normalizedDate(row.observed_at);
  if (!observedAt) return [];
  const sourceUpdatedAt = normalizedDate(row.source_updated_at) ?? observedAt;
  const placeLabel = cleanText(row.public_area_label) ?? scopeLabel;
  const humanTitle = cleanText(row.human_label);
  const recordTitle = cleanText(row.taxon_label);
  const candidateTitle = row.ai_assessment_status === "ai_judgement" ? cleanText(row.ai_candidate_label) : null;
  const title = humanTitle ?? candidateTitle ?? recordTitle;
  const items: NativeItem[] = [];

  const livingKey = safeDerivedKey(row.living_derivative_key);
  if (livingKey && title && isMeaningfulPublicObservationLabel(title) && metadataProvesPublicFaceSafety(row.living_metadata_json)) {
    items.push({
      id: `living:${row.observation_id}`,
      record_id: row.observation_id,
      channel: "living",
      media: {
        url: `${origin}/${livingKey}`,
        alt: `${title}の写真`,
        width: positiveInteger(row.living_width),
        height: positiveInteger(row.living_height),
      },
      title,
      subtitle: placeLabel,
      observed_at: observedAt,
      place_label: placeLabel,
      detail_url: `${PRODUCTION_PUBLIC_ORIGIN}/observations/${encodeURIComponent(row.observation_id)}`,
      subject: { kind: "taxon", label: title },
      classification: classification(row, title),
      rights: { republication_allowed: true, attribution: null },
      sourceUpdatedAt,
    });
  }

  const communityKey = safeDerivedKey(row.community_derivative_key);
  if (communityKey && metadataProvesPublicFaceSafety(row.community_metadata_json)) {
    items.push({
      id: `community_photo:${row.observation_id}`,
      record_id: row.observation_id,
      channel: "community_photo",
      media: {
        url: `${origin}/${communityKey}`,
        alt: `${placeLabel}の周辺環境の写真`,
        width: positiveInteger(row.community_width),
        height: positiveInteger(row.community_height),
      },
      title: placeLabel,
      subtitle: cleanText(row.boundary_name),
      observed_at: observedAt,
      place_label: placeLabel,
      detail_url: `${PRODUCTION_PUBLIC_ORIGIN}/observations/${encodeURIComponent(row.observation_id)}`,
      subject: { kind: "environment", label: "周辺環境" },
      classification: { state: "not_applicable", source: "record", confidence: null },
      rights: { republication_allowed: true, attribution: null },
      sourceUpdatedAt,
    });
  }
  return items;
}

function channelPriority(channel: PublicationFeedChannelKey): number {
  return channel === "living" ? 0 : 1;
}

function compareItems(left: NativeItem, right: NativeItem): number {
  const observed = Date.parse(right.observed_at) - Date.parse(left.observed_at);
  if (observed !== 0) return observed;
  const channel = channelPriority(left.channel) - channelPriority(right.channel);
  if (channel !== 0) return channel;
  return left.record_id.localeCompare(right.record_id);
}

function isAfterCursor(item: NativeItem, cursor: PublicationFeedCursor): boolean {
  const observed = Date.parse(item.observed_at) - Date.parse(cursor.observedAt);
  if (observed !== 0) return observed < 0;
  const channel = channelPriority(item.channel) - channelPriority(cursor.channel);
  if (channel !== 0) return channel > 0;
  return item.record_id.localeCompare(cursor.recordId) > 0;
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function encodeCursor(item: NativeItem): string {
  return encodeBase64Url(JSON.stringify({ v: 1, observedAt: item.observed_at, recordId: item.record_id, channel: item.channel }));
}

function decodeCursor(value: string | null, supportedChannels: readonly string[]): PublicationFeedCursor | null {
  if (value == null || value === "") return null;
  if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error("invalid_publication_feed_cursor");
  try {
    const parsed = JSON.parse(decodeBase64Url(value)) as Record<string, unknown>;
    const observedAt = normalizedDate(parsed.observedAt);
    const recordId = cleanText(parsed.recordId);
    const channel = cleanText(parsed.channel);
    if (parsed.v !== 1 || !observedAt || !recordId || !channel || !supportedChannels.includes(channel)) {
      throw new Error("invalid_publication_feed_cursor");
    }
    return { observedAt, recordId, channel };
  } catch {
    throw new Error("invalid_publication_feed_cursor");
  }
}

function singleParam(params: URLSearchParams, name: string): string | undefined {
  const values = params.getAll(name);
  if (values.length === 0) return undefined;
  if (values.length !== 1) throw new Error(`invalid_publication_feed_${name}`);
  return values[0];
}

function parseQuery(url: URL, supportedChannels: readonly string[], defaultLocale: PublicationFeedLocale): ParsedQuery {
  const channel = singleParam(url.searchParams, "channel");
  if (channel !== undefined && !supportedChannels.includes(channel)) throw new Error("invalid_publication_feed_channel");
  const limitValue = singleParam(url.searchParams, "limit");
  const limit = limitValue === undefined ? PUBLICATION_FEED_DEFAULT_LIMIT : /^\d+$/.test(limitValue) ? Number(limitValue) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > PUBLICATION_FEED_MAX_LIMIT) throw new Error("invalid_publication_feed_limit");
  const localeValue = singleParam(url.searchParams, "locale") ?? defaultLocale;
  if (localeValue !== "ja" && localeValue !== "en") throw new Error("invalid_publication_feed_locale");
  return {
    channel,
    locale: localeValue,
    limit,
    cursor: decodeCursor(singleParam(url.searchParams, "cursor") ?? null, supportedChannels),
  };
}

function localized(value: Readonly<Record<string, string>>, locale: PublicationFeedLocale): string {
  return value[locale] ?? value.ja ?? value.en ?? "";
}

function responseFor(
  definition: (typeof PUBLICATION_FEED_DEFINITIONS)[keyof typeof PUBLICATION_FEED_DEFINITIONS],
  rows: PublicationFeedNativeRow[],
  parsed: ParsedQuery,
  origin: string,
): PublicationFeedResponse {
  const supportedChannels = definition.channels.filter((channel) => !parsed.channel || channel.key === parsed.channel);
  const items = rows
    .flatMap((row) => nativeItems(row, origin, localized(definition.scopeLabel, parsed.locale)))
    .filter((item) => supportedChannels.some((channel) => channel.key === item.channel))
    .sort(compareItems);
  const afterCursor = parsed.cursor ? items.filter((item) => isAfterCursor(item, parsed.cursor!)) : items;
  const page = afterCursor.slice(0, parsed.limit + 1);
  const hasMore = page.length > parsed.limit;
  const visible = hasMore ? page.slice(0, parsed.limit) : page;
  const updatedAt = [definition.updatedAt, ...items.map((item) => item.sourceUpdatedAt)].sort().at(-1) ?? definition.updatedAt;
  return {
    api_version: "1",
    feed: {
      feed_key: definition.feedKey,
      title: localized(definition.title, parsed.locale),
      scope_label: localized(definition.scopeLabel, parsed.locale),
      updated_at: updatedAt,
      publication_policy_version: definition.publicationPolicyVersion,
    },
    channels: supportedChannels.map((channel) => ({
      key: channel.key,
      label: localized(channel.label, parsed.locale),
      items: visible.map(({ sourceUpdatedAt: _sourceUpdatedAt, ...item }) => item).filter((item) => item.channel === channel.key),
    })),
    next_cursor: hasMore && visible.at(-1) ? encodeCursor(visible.at(-1)!) : null,
  };
}

async function etag(body: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body));
  return `"${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}"`;
}

function ifNoneMatch(value: string | null, expected: string): boolean {
  return Boolean(value?.split(",").some((candidate) => {
    const normalized = candidate.trim();
    return normalized === "*" || normalized === expected || normalized.replace(/^W\//, "") === expected;
  }));
}

function jsonResponse(payload: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export async function handlePublicationFeedNativeRequest(
  request: Request,
  db: PublicationFeedNativeDatabase,
  pathname = new URL(request.url).pathname,
): Promise<Response | null> {
  const route = pathname.match(/^\/api\/v1\/publication-feeds\/([^/]+)$/);
  if (!route?.[1] || request.method !== "GET") return null;
  let feedKey: string;
  try {
    feedKey = decodeURIComponent(route[1]);
  } catch {
    return jsonResponse({ ok: false, error: "invalid_publication_feed_key" }, 400);
  }
  if (!Object.prototype.hasOwnProperty.call(PUBLICATION_FEED_DEFINITIONS, feedKey)) {
    return jsonResponse({ ok: false, error: "publication_feed_not_found" }, 404);
  }
  const definition = PUBLICATION_FEED_DEFINITIONS[feedKey as keyof typeof PUBLICATION_FEED_DEFINITIONS];
  const supportedChannels = definition.channels.map((channel) => channel.key);
  const url = new URL(request.url);
  let parsed: ParsedQuery;
  try {
    parsed = parseQuery(url, supportedChannels, definition.locale);
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: error instanceof Error ? error.message : "invalid_publication_feed_query",
    }, 400);
  }

  let rows: PublicationFeedNativeRow[];
  try {
    const entityKey = definition.scope.find((scope) => scope.kind === "entity")?.id;
    if (!entityKey) throw new Error("publication_feed_scope_unavailable");
    rows = (await db.prepare(PUBLICATION_FEED_NATIVE_SQL).bind(entityKey, PUBLICATION_FEED_QUERY_LIMIT).all<PublicationFeedNativeRow>()).results;
  } catch {
    console.error(JSON.stringify({ message: "publication feed unavailable", feedKey }));
    return jsonResponse({ ok: false, error: "publication_feed_unavailable" }, 503, { "cache-control": "no-store" });
  }

  const payload = responseFor(definition, rows, parsed, publicOrigin(url));
  const body = JSON.stringify(payload);
  const responseEtag = await etag(body);
  const origin = cleanText(request.headers.get("origin"));
  const allowedOrigin = origin && definition.allowedConsumerOrigins.includes(origin) ? origin : null;
  const headers: Record<string, string> = {
    "cache-control": PUBLICATION_FEED_CACHE_CONTROL,
    etag: responseEtag,
    vary: "Origin",
    "x-ikimon-cloudflare-native": "publication-feed-v2",
  };
  if (allowedOrigin) headers["access-control-allow-origin"] = allowedOrigin;
  if (ifNoneMatch(request.headers.get("if-none-match"), responseEtag)) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(body, {
    status: 200,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}

export const __test__ = {
  pointInGeometry,
  responseFor,
};
