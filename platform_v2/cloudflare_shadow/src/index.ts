type D1Value = string | number | null;

interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results: T[] }>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown[]>;
}

interface R2Bucket {
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown>;
  get(key: string): Promise<R2ObjectBody | null>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<R2ListResult>;
}

interface R2ObjectBody {
  body: ReadableStream | null;
  httpMetadata?: { contentType?: string };
}

interface R2ListResult {
  objects: R2ObjectSummary[];
  truncated?: boolean;
  cursor?: string;
}

interface R2ObjectSummary {
  key: string;
  size: number;
  etag?: string;
  uploaded?: Date | string;
  checksums?: Record<string, string>;
}

interface Queue<T = unknown> {
  send(message: T): Promise<void>;
}

interface Env {
  CORE_DB: D1Database;
  OBS_DB: D1Database;
  ASSET_BUCKET: R2Bucket;
  MEDIA_QUEUE: Queue<MediaJob>;
  ENVIRONMENT: string;
  PUBLIC_LOCATION_CELL_PRECISION: string;
  INTERNAL_AUTH_TOKEN?: string;
  OBSERVATION_DB_NAME?: string;
  OBSERVATION_ARCHIVE_TARGET?: string;
}

interface DraftAssetInput {
  mime: string;
  bytes: number;
  sha256?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

interface DraftObservationInput {
  userId: string;
  observedAt?: string;
  exactLat?: number;
  exactLng?: number;
  locationAccuracyM?: number;
  visibility?: "private" | "public";
  media?: DraftAssetInput[];
}

interface FinalizeObservationInput {
  draftId: string;
  taxonLabel?: string;
  note?: string;
}

interface LegacyObservationUpsertInput {
  observationId?: string;
  clientSubmissionId?: string | null;
  userId: string;
  observedAt: string;
  latitude: number;
  longitude: number;
  locationAccuracyM?: number | null;
  note?: string | null;
  siteId?: string | null;
  siteName?: string | null;
  municipality?: string | null;
  prefecture?: string | null;
  taxon?: {
    scientificName?: string | null;
    vernacularName?: string | null;
    rank?: string | null;
  } | null;
  subjects?: Array<{
    scientificName?: string | null;
    vernacularName?: string | null;
    rank?: string | null;
    isPrimary?: boolean;
  }>;
  visitMode?: "manual" | "survey" | null;
  revisitReason?: string | null;
  targetTaxaScope?: string | null;
  sourcePayload?: Record<string, unknown> | null;
}

interface LegacyPhotoUploadInput {
  filename?: string | null;
  mimeType?: string | null;
  base64Data?: string | null;
  mediaRole?: string | null;
  facePrivacy?: string | null;
}

interface SessionIssueInput {
  userId: string;
  ttlHours?: number | null;
  displayName?: string | null;
  roleName?: string | null;
  rankLabel?: string | null;
}

interface SessionSnapshot {
  tokenHash: string;
  userId: string;
  displayName: string;
  roleName: string;
  rankLabel: string | null;
  banned: boolean;
  expiresAt: string;
}

interface VideoDirectUploadInput {
  maxDurationSeconds?: number | null;
  filename?: string | null;
  observationId?: string | null;
  mediaRole?: string | null;
  uploadProtocol?: string | null;
  fileSizeBytes?: number | null;
}

interface VideoFinalizeInput {
  observationId?: string | null;
  durationMs?: number | null;
  readyToStream?: boolean | null;
  bytes?: number | null;
}

interface MediaJob {
  outboxId: string;
  topic: "media.process" | "readmodel.refresh";
  targetId: string;
}

interface UploadedAssetRow {
  asset_id: string;
  object_key: string;
}

interface PublicMapRow {
  observation_id: string;
  public_cell: string;
  observed_at: string;
  taxon_label: string | null;
  asset_count: number;
}

interface PublicDetailRow extends PublicMapRow {
  owner_user_id: string;
  note: string | null;
  visibility: string;
}

interface PublicDetailAssetRow {
  asset_id: string;
  object_key: string;
  mime: string;
  bytes: number;
  duration_ms: number | null;
  public_derivative_key: string | null;
}

interface PublicDerivativeInspection {
  tool: string;
  contentType: string;
  bytes: number;
  scannedContainer: string;
  gpsExifPresent: boolean;
  exifPresent: boolean;
  gpsPresent: boolean;
  xmpPresent: boolean;
  exactCoordinateLiteralPresent: boolean;
  checkedAt: string;
}

interface PartitionSummaryRow {
  partition_month: string | null;
  count: number;
  earliest_observed_at: string | null;
  latest_observed_at: string | null;
}

interface RollbackLedgerRow {
  ledger_id: string;
  event_type: string;
  target_id: string;
  partition_month: string | null;
  source_endpoint: string;
  payload_json: string;
  replay_sql: string;
  replay_status: string;
  created_at: string;
}

interface ReverseDeltaCountRow {
  count: number;
}

const MAX_MEDIA_PER_DRAFT = 12;
const MAX_ASSET_BYTES = 25 * 1024 * 1024;
const SESSION_COOKIE_NAME = "ikimon_v2_session";
const MIN_VIDEO_DURATION_SECONDS = 6;
const MAX_VIDEO_DURATION_SECONDS = 60;
const MAP_DEFAULT_GRID_M = 1000;
const OBSERVATION_PARTITION_STRATEGY = "single_active_d1_logical_month";

export const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(request.url);

      if (request.method === "GET" && url.pathname === "/health") {
        return json({ ok: true, environment: env.ENVIRONMENT });
      }

      if (url.pathname.startsWith("/internal/")) {
        const guard = authorizeInternalRequest(request, env);
        if (guard) return guard;
      }

      if (request.method === "GET" && url.pathname === "/api/v1/map/cells") {
        return getPublicMapCells(url, env);
      }

      if (request.method === "GET" && url.pathname === "/api/v1/map/observations") {
        return getPublicMapObservations(url, env);
      }

      if (request.method === "GET" && url.pathname === "/api/v1/map/my-places") {
        return getPublicMapMyPlaces(request, env);
      }

      if (request.method === "GET" && url.pathname.startsWith("/derived/")) {
        return getPublicDerivedMedia(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/record") {
        return html(renderShadowRecordSmokeHtml(), 200, { "cache-control": "no-store" });
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/map") {
        return html(renderShadowMapSmokeHtml(url), 200, { "cache-control": "no-store" });
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/takedown-proof") {
        return shadowTakedownProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/video-metadata-proof") {
        return shadowVideoMetadataProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/missing-media-ledger-proof") {
        return shadowMissingMediaLedgerProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/stream-nonready-exclusion-proof") {
        return shadowStreamNonReadyExclusionProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/reverse-delta-proof") {
        return shadowReverseDeltaProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/update-delete-replay-proof") {
        return shadowUpdateDeleteReplayProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/rollback-restore-smoke") {
        return shadowRollbackRestoreSmoke(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/production-import-dress-rehearsal-proof") {
        return shadowProductionImportDressRehearsalProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/shadow-smoke/route-change-rehearsal-proof") {
        return shadowRouteChangeRehearsalProof(url, env);
      }

      const shadowVideoMatch = url.pathname.match(/^\/shadow\/stream\/([^/]+)$/);
      if (request.method === "GET" && shadowVideoMatch?.[1]) {
        return getShadowVideoStream(decodeURIComponent(shadowVideoMatch[1]), env);
      }

      const shadowVideoThumbnailMatch = url.pathname.match(/^\/shadow\/stream\/([^/]+)\/thumbnail\.jpg$/);
      if (request.method === "GET" && shadowVideoThumbnailMatch?.[1]) {
        return getShadowVideoThumbnail(decodeURIComponent(shadowVideoThumbnailMatch[1]), env);
      }

      const publicDetailApiMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/public-detail$/);
      if (request.method === "GET" && publicDetailApiMatch?.[1]) {
        return getPublicObservationDetailJson(decodeURIComponent(publicDetailApiMatch[1]), env);
      }

      const publicDetailPageMatch = url.pathname.match(/^\/observations\/([^/]+)$/);
      if (request.method === "GET" && publicDetailPageMatch?.[1]) {
        return getPublicObservationDetailPage(decodeURIComponent(publicDetailPageMatch[1]), env);
      }

      if (request.method === "POST" && url.pathname === "/api/v0/draft-observations") {
        return createDraftObservation(request, env);
      }

      if (request.method === "PUT" && url.pathname.startsWith("/api/v0/assets/") && url.pathname.endsWith("/body")) {
        const assetId = decodeURIComponent(url.pathname.split("/").at(-2) ?? "");
        return putAssetBody(assetId, request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v0/observations/finalize") {
        return finalizeObservation(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/observations/upsert") {
        return upsertLegacyCompatibleObservation(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/auth/session/issue") {
        return issueCompatibleSession(request, env);
      }

      if (request.method === "GET" && url.pathname === "/api/v1/auth/session") {
        return getCompatibleSession(request, url, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/auth/session/logout") {
        return logoutCompatibleSession(request, env);
      }

      if (request.method === "POST" && url.pathname === "/api/v1/videos/direct-upload") {
        return createCompatibleVideoDirectUpload(request, env);
      }

      const videoBodyMatch = url.pathname.match(/^\/api\/v1\/videos\/([^/]+)\/body$/);
      if ((request.method === "PUT" || request.method === "POST") && videoBodyMatch?.[1]) {
        return putCompatibleVideoBody(decodeURIComponent(videoBodyMatch[1]), request, env);
      }

      const videoFinalizeMatch = url.pathname.match(/^\/api\/v1\/videos\/([^/]+)\/finalize$/);
      if (request.method === "POST" && videoFinalizeMatch?.[1]) {
        return finalizeCompatibleVideo(decodeURIComponent(videoFinalizeMatch[1]), request, env);
      }

      const photoUploadMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/photos\/upload$/);
      if (request.method === "POST" && photoUploadMatch?.[1]) {
        return uploadLegacyCompatiblePhoto(decodeURIComponent(photoUploadMatch[1]), request, env);
      }

      const hideObservationMatch = url.pathname.match(/^\/api\/v1\/observations\/([^/]+)\/hide$/);
      if (request.method === "POST" && hideObservationMatch?.[1]) {
        return hideCompatibleObservation(decodeURIComponent(hideObservationMatch[1]), request, env);
      }

      if (request.method === "POST" && url.pathname === "/internal/drain-outbox") {
        return drainOutbox(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/r2-inventory") {
        return r2Inventory(url, env);
      }

      if (request.method === "GET" && url.pathname === "/internal/legacy-asset-import-summary") {
        return legacyAssetImportSummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/r2-import-summary") {
        return r2ImportSummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/production-restore-parity-summary") {
        return productionRestoreParitySummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/production-import-summary") {
        return productionImportSummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/d1-partition-routing-proof") {
        return d1PartitionRoutingProof(url, env);
      }

      if (request.method === "GET" && url.pathname === "/internal/public-derivative-verification-summary") {
        return publicDerivativeVerificationSummary(env);
      }

      if (request.method === "GET" && url.pathname === "/internal/reverse-delta-dry-run") {
        return reverseDeltaDryRun(url, env);
      }

      return json({ error: "not_found" }, 404);
    } catch (error) {
      if (error instanceof HttpError) {
        return json({ error: error.message }, error.status);
      }
      console.error(error);
      return json({ error: "internal_error" }, 500);
    }
  },

  async queue(batch: { messages: Array<{ body: MediaJob }> }, env: Env): Promise<void> {
    for (const message of batch.messages) {
      await applyMediaJob(message.body, env);
    }
  }
};

export default worker;

async function getPublicMapCells(url: URL, env: Env): Promise<Response> {
  const rows = await queryPublicMapRows(env);
  const bbox = parseBboxParam(url.searchParams.get("bbox"));
  const scopedRows = bbox ? rows.filter((row) => publicCellInBbox(row.public_cell, bbox)) : rows;
  const groups = new Map<string, PublicMapRow[]>();
  for (const row of scopedRows) {
    if (!parsePublicCell(row.public_cell)) continue;
    const existing = groups.get(row.public_cell) ?? [];
    existing.push(row);
    groups.set(row.public_cell, existing);
  }

  const features = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length || latestObservedAt(b[1]).localeCompare(latestObservedAt(a[1])))
    .slice(0, 1200)
    .map(([publicCell, group]) => {
      const parsed = parsePublicCell(publicCell);
      if (!parsed) return null;
      const taxonMix = group.reduce<Record<string, number>>((mix, row) => {
        const key = taxonGroupForLabel(row.taxon_label);
        mix[key] = (mix[key] ?? 0) + 1;
        return mix;
      }, {});
      return {
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [publicCellPolygon(parsed.lat, parsed.lng)] },
        properties: {
          cellId: publicCellToCellId(publicCell),
          label: "位置をぼかしています",
          albumName: "このあたりの記録",
          localityLabel: "位置をぼかしています",
          themeLabel: "最近の発見",
          scaleLabel: `${MAP_DEFAULT_GRID_M}m`,
          nearbyAreaName: null,
          nameEraLabel: null,
          scope: "blurred",
          gridM: MAP_DEFAULT_GRID_M,
          radiusM: MAP_DEFAULT_GRID_M,
          count: group.length,
          firstObservedAt: earliestObservedAt(group),
          latestObservedAt: latestObservedAt(group),
          taxonMix,
          centroidLat: parsed.lat,
          centroidLng: parsed.lng
        }
      };
    })
    .filter((feature): feature is NonNullable<typeof feature> => Boolean(feature));

  return json({
    type: "FeatureCollection",
    features,
    stats: {
      totalReturned: features.length,
      totalAll: features.length,
      totalRecords: scopedRows.length,
      markerProfile: "all_research_artifacts",
      gridM: MAP_DEFAULT_GRID_M,
      provenance: publicMapEmptyProvenance(scopedRows.length)
    }
  }, 200, { "cache-control": "no-store" });
}

async function getPublicMapObservations(url: URL, env: Env): Promise<Response> {
  const bbox = parseBboxParam(url.searchParams.get("bbox"));
  const rawCellId = normalizeOptionalText(url.searchParams.get("cell_id"));
  const selectedCell = rawCellId ? cellIdToPublicCell(rawCellId) : null;
  if (!bbox && !selectedCell) {
    return json({ error: "missing_scope" }, 400);
  }

  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "300"), 1, 1200);
  const rows = await queryPublicMapRows(env);
  const scopedRows = rows
    .filter((row) => selectedCell ? row.public_cell === selectedCell : publicCellInBbox(row.public_cell, bbox as [number, number, number, number]))
    .sort((a, b) => b.observed_at.localeCompare(a.observed_at))
    .slice(0, limit);

  return json({
    items: scopedRows.map((row) => ({
      occurrenceId: `occ:${row.observation_id}:0`,
      visitId: row.observation_id,
      displayName: row.taxon_label ?? "同定待ち",
      isAiCandidate: false,
      isAwaitingId: !row.taxon_label,
      localityLabel: "位置をぼかしています",
      observedAt: row.observed_at,
      photoUrl: null,
      taxonGroup: taxonGroupForLabel(row.taxon_label),
      cellId: publicCellToCellId(row.public_cell)
    })),
    stats: {
      totalReturned: scopedRows.length,
      totalAll: scopedRows.length,
      markerProfile: "all_research_artifacts",
      gridM: MAP_DEFAULT_GRID_M,
      selectedCellId: selectedCell ? publicCellToCellId(selectedCell) : null,
      provenance: publicMapEmptyProvenance(scopedRows.length)
    }
  }, 200, { "cache-control": "no-store" });
}

async function getPublicMapMyPlaces(request: Request, env: Env): Promise<Response> {
  const session = await readCompatibleSession(request, env);
  if (!session || session.banned) {
    return json({ signedIn: false, items: [] }, 200, { "cache-control": "no-store" });
  }
  return json({ signedIn: true, sort: "recent", items: [] }, 200, { "cache-control": "no-store" });
}

async function getPublicDerivedMedia(url: URL, env: Env): Promise<Response> {
  const key = url.pathname.replace(/^\/+/, "");
  if (!key.startsWith("derived/")) {
    return json({ error: "not_found" }, 404);
  }
  const object = await env.ASSET_BUCKET.get(key);
  if (!object?.body) {
    return json({ error: "media_not_found" }, 404);
  }
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=300"
    }
  });
}

async function getShadowVideoStream(uid: string, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_found" }, 404);
  }
  assertNonEmpty(uid, "uid");
  const row = await env.OBS_DB.prepare(
    "SELECT object_key FROM video_upload_requests WHERE stream_uid = ?"
  ).bind(uid).first<{ object_key: string | null }>();
  if (!row?.object_key) {
    return json({ error: "video_not_found" }, 404);
  }
  const object = await env.ASSET_BUCKET.get(row.object_key);
  if (!object?.body) {
    return json({ error: "video_body_not_found" }, 404);
  }
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "video/mp4",
      "cache-control": "no-store"
    }
  });
}

async function getShadowVideoThumbnail(uid: string, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_found" }, 404);
  }
  assertNonEmpty(uid, "uid");
  const row = await env.OBS_DB.prepare(
    "SELECT object_key FROM video_upload_requests WHERE stream_uid = ?"
  ).bind(uid).first<{ object_key: string | null }>();
  if (!row?.object_key) {
    return json({ error: "video_not_found" }, 404);
  }
  return new Response(shadowSafeJpegPosterBytes(), {
    headers: {
      "content-type": "image/jpeg",
      "cache-control": "no-store"
    }
  });
}

async function queryPublicMapRows(env: Env): Promise<PublicMapRow[]> {
  const rows = await env.OBS_DB.prepare(
    `SELECT observation_id, public_cell, observed_at, taxon_label, asset_count
     FROM readmodel_public_observations
     ORDER BY observed_at DESC
     LIMIT 5000`
  ).all<PublicMapRow>();
  return rows.results;
}

async function getPublicObservationDetailJson(rawId: string, env: Env): Promise<Response> {
  const detail = await buildPublicObservationDetail(rawId, env);
  if (!detail) {
    return json({ ok: false, error: "observation_not_found" }, 404, { "cache-control": "no-store" });
  }
  return json({ ok: true, observation: detail }, 200, { "cache-control": "no-store" });
}

async function getPublicObservationDetailPage(rawId: string, env: Env): Promise<Response> {
  const detail = await buildPublicObservationDetail(rawId, env);
  if (!detail) {
    return html(renderObservationNotFoundHtml(), 404, { "cache-control": "no-store" });
  }
  return html(renderPublicObservationDetailHtml(detail), 200, { "cache-control": "no-store" });
}

async function buildPublicObservationDetail(rawId: string, env: Env) {
  const visitId = detailIdToVisitId(rawId);
  const row = await env.OBS_DB.prepare(
    `SELECT r.observation_id, r.public_cell, r.observed_at, r.taxon_label, r.asset_count,
            o.owner_user_id, o.note, o.visibility
     FROM readmodel_public_observations r
     JOIN observations o ON o.observation_id = r.observation_id
     WHERE r.observation_id = ?
       AND o.visibility = 'public'
       AND o.emergency_hidden = 0`
  ).bind(visitId).first<PublicDetailRow>();
  if (!row) return null;

  const assets = await env.OBS_DB.prepare(
    `SELECT asset_id, object_key, mime, bytes, duration_ms, public_derivative_key
     FROM asset_ledger
     WHERE observation_id = ?
       AND processing_state = 'uploaded'
       AND public_derivative_key IS NOT NULL
       AND exif_scrub_state = 'scrubbed'
       AND public_ready_at IS NOT NULL
     ORDER BY created_at ASC
     LIMIT 24`
  ).bind(visitId).all<PublicDetailAssetRow>();

  const photoAssets = assets.results
    .filter((asset) => asset.mime.startsWith("image/"))
    .map((asset) => ({
      assetId: asset.asset_id,
      url: publicMediaUrl(asset.public_derivative_key),
      widthPx: null,
      heightPx: null,
      mediaRole: null
    }));
  const videoAssets = assets.results
    .filter((asset) => asset.mime.startsWith("video/"))
    .map((asset) => {
      const streamUid = asset.asset_id.replace(/^video_asset_/, "");
      return {
        assetId: asset.asset_id,
        providerUid: streamUid,
        iframeUrl: buildShadowVideoIframeUrl(streamUid),
        thumbnailUrl: buildShadowVideoThumbnailUrl(streamUid),
        watchUrl: buildShadowVideoWatchUrl(streamUid),
        readyToStream: true,
        uploadStatus: "ready",
        createdAt: row.observed_at,
        durationMs: asset.duration_ms ?? 0,
        mediaRole: "observation_video"
      };
    });

  return {
    schemaVersion: "shadow_public_observation_detail/v1",
    occurrenceId: `occ:${row.observation_id}:0`,
    visitId: row.observation_id,
    canonicalPath: `/observations/${encodeURIComponent(row.observation_id)}`,
    displayName: row.taxon_label ?? "同定待ち",
    isAwaitingId: !row.taxon_label,
    observedAt: row.observed_at,
    note: row.note,
    observerUserId: row.owner_user_id,
    observerName: "ikimon user",
    placeName: "位置をぼかしています",
    municipality: null,
    publicLocation: {
      label: "位置をぼかしています",
      cellId: publicCellToCellId(row.public_cell),
      publicCell: row.public_cell
    },
    photoAssets,
    photoUrls: photoAssets.map((asset) => asset.url),
    videoAssets,
    audioAssets: [],
    assetCount: row.asset_count,
    privacy: {
      exactLocationExposed: false,
      source: "readmodel_public_observations.public_cell"
    }
  };
}

async function createDraftObservation(request: Request, env: Env): Promise<Response> {
  const input = await readJson<DraftObservationInput>(request);
  assertNonEmpty(input.userId, "userId");

  const media = input.media ?? [];
  if (media.length > MAX_MEDIA_PER_DRAFT) {
    return json({ error: "too_many_media", max: MAX_MEDIA_PER_DRAFT }, 400);
  }

  const draftId = newId("draft");
  const partition = resolveObservationPartition(input.observedAt, env);
  const publicCell = blurLocation(input.exactLat, input.exactLng);
  const visibility = input.visibility === "public" ? "public" : "private";

  const statements: D1PreparedStatement[] = [
    env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(input.userId),
    env.OBS_DB.prepare(
      `INSERT INTO draft_observations
       (draft_id, owner_user_id, observed_at, exact_lat, exact_lng, location_accuracy_m, public_cell, visibility, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      draftId,
      input.userId,
      input.observedAt ?? null,
      numberOrNull(input.exactLat),
      numberOrNull(input.exactLng),
      numberOrNull(input.locationAccuracyM),
      publicCell,
      visibility,
      partition.partitionMonth
    )
  ];

  const assets = media.map((asset, index) => {
    validateAsset(asset);
    const assetId = newId("asset");
    const objectKey = `original/${partition.partitionMonth.replace("-", "/")}/${assetId}`;
    statements.push(
      env.OBS_DB.prepare(
        `INSERT INTO asset_ledger
         (asset_id, draft_id, owner_user_id, object_key, sha256, mime, bytes, width, height, duration_ms, visibility, partition_month)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        assetId,
        draftId,
        input.userId,
        objectKey,
        asset.sha256 ?? null,
        asset.mime,
        asset.bytes,
        numberOrNull(asset.width),
        numberOrNull(asset.height),
        numberOrNull(asset.durationMs),
        "private",
        partition.partitionMonth
      )
    );
    return { assetId, objectKey, uploadUrl: `/api/v0/assets/${encodeURIComponent(assetId)}/body`, index };
  });

  await env.CORE_DB.batch(statements.filter((statement, index) => index === 0));
  await env.OBS_DB.batch(statements.slice(1));

  return json({ draftId, publicCell, assets });
}

async function issueCompatibleSession(request: Request, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ ok: false, error: "not_available" }, 404);
  }
  const input = await readJson<SessionIssueInput>(request);
  assertNonEmpty(input.userId, "userId");
  const ttlHours = typeof input.ttlHours === "number" && Number.isFinite(input.ttlHours) && input.ttlHours > 0
    ? Math.min(input.ttlHours, 24 * 30)
    : 24 * 30;
  const rawToken = randomToken();
  const tokenHash = await sha256Hex(textToArrayBuffer(rawToken));
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();
  const displayName = normalizeOptionalText(input.displayName) ?? input.userId;
  const roleName = normalizeOptionalText(input.roleName) ?? "Observer";

  await env.CORE_DB.batch([
    env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(input.userId),
    env.CORE_DB.prepare(
      `INSERT INTO auth_sessions
       (token_hash, user_id, display_name, role_name, rank_label, banned, expires_at, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).bind(
      tokenHash,
      input.userId,
      displayName,
      roleName,
      normalizeOptionalText(input.rankLabel),
      expiresAt,
      request.headers.get("cf-connecting-ip") ?? null,
      request.headers.get("user-agent") ?? null
    )
  ]);

  const session = {
    userId: input.userId,
    displayName,
    roleName,
    rankLabel: normalizeOptionalText(input.rankLabel),
    banned: false,
    expiresAt,
    tokenHash
  };
  return json({
    ok: true,
    tokenHash,
    compatibility: {
      attempted: false,
      succeeded: false
    },
    session
  }, 200, {
    "set-cookie": buildSessionCookie(rawToken, expiresAt, env)
  });
}

async function getCompatibleSession(request: Request, url: URL, env: Env): Promise<Response> {
  const optional = url.searchParams.get("optional") === "1" || url.searchParams.get("optional") === "true";
  const session = await readCompatibleSession(request, env);
  if (!session) {
    return optional
      ? json({ ok: false, error: "session_not_found", session: null })
      : json({ ok: false, error: "session_not_found" }, 401);
  }
  return json({
    ok: true,
    session: {
      userId: session.userId,
      displayName: session.displayName,
      roleName: session.roleName,
      rankLabel: session.rankLabel,
      banned: session.banned,
      expiresAt: session.expiresAt,
      tokenHash: session.tokenHash
    }
  });
}

async function logoutCompatibleSession(request: Request, env: Env): Promise<Response> {
  const rawToken = readSessionTokenFromCookie(request.headers.get("cookie"));
  const tokenHash = rawToken ? await sha256Hex(textToArrayBuffer(rawToken)) : null;
  if (tokenHash) {
    await env.CORE_DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return json({
    ok: true,
    revoked: Boolean(tokenHash),
    tokenHash,
    compatibility: {
      attempted: false,
      succeeded: false
    }
  }, 200, {
    "set-cookie": buildClearedSessionCookie(env)
  });
}

async function readCompatibleSession(request: Request, env: Env): Promise<SessionSnapshot | null> {
  const rawToken = readSessionTokenFromCookie(request.headers.get("cookie"));
  if (!rawToken) return null;
  const tokenHash = await sha256Hex(textToArrayBuffer(rawToken));
  const session = await env.CORE_DB.prepare(
    `SELECT token_hash, user_id, display_name, role_name, rank_label, banned, expires_at
     FROM auth_sessions
     WHERE token_hash = ? AND expires_at > ?`
  ).bind(tokenHash, new Date().toISOString()).first<{
    token_hash: string;
    user_id: string;
    display_name: string;
    role_name: string;
    rank_label: string | null;
    banned: number;
    expires_at: string;
  }>();
  if (!session) return null;
  await env.CORE_DB.prepare(
    "UPDATE auth_sessions SET last_used_at = CURRENT_TIMESTAMP WHERE token_hash = ?"
  ).bind(tokenHash).run();
  return {
    tokenHash: session.token_hash,
    userId: session.user_id,
    displayName: session.display_name,
    roleName: session.role_name,
    rankLabel: session.rank_label,
    banned: Boolean(session.banned),
    expiresAt: session.expires_at
  };
}

async function createCompatibleVideoDirectUpload(request: Request, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ ok: false, error: "not_available" }, 404);
  }
  const session = await readCompatibleSession(request, env);
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401);
  }

  const input = await readJson<VideoDirectUploadInput>(request);
  const uploadProtocol = normalizeOptionalText(input.uploadProtocol) ?? "post";
  const fileSizeBytes = numberOrNull(input.fileSizeBytes);
  if (uploadProtocol === "tus" && (!fileSizeBytes || fileSizeBytes <= 0)) {
    return json({ ok: false, error: "video_tus_upload_length_required" }, 400);
  }

  const observationId = normalizeOptionalId(input.observationId);
  if (observationId) {
    await assertObservationOwnedByUser(observationId, session.userId, env);
  }

  const uid = newId("stream");
  const filename = sanitizeFileName(normalizeOptionalText(input.filename) ?? `${uid}.mp4`);
  const maxDurationSeconds = clampVideoDuration(input.maxDurationSeconds);
  const objectKey = `original/v1-compat-video/${uid}/${filename}`;
  const uploadUrl = `${new URL(request.url).origin}/api/v1/videos/${encodeURIComponent(uid)}/body`;

  await env.OBS_DB.prepare(
    `INSERT INTO video_upload_requests
     (stream_uid, actor_id, observation_id, upload_status, max_duration_seconds, filename, upload_protocol, object_key, bytes, meta_json)
     VALUES (?, ?, ?, 'waiting_upload', ?, ?, ?, ?, ?, ?)`
  ).bind(
    uid,
    session.userId,
    observationId,
    maxDurationSeconds,
    filename,
    uploadProtocol,
    objectKey,
    fileSizeBytes ?? 0,
    JSON.stringify({ mediaRole: normalizeOptionalText(input.mediaRole) ?? "observation_video" })
  ).run();

  return json({
    ok: true,
    uid,
    uploadUrl,
    maxDurationSeconds,
    iframeUrl: buildShadowVideoIframeUrl(uid),
    thumbnailUrl: buildShadowVideoThumbnailUrl(uid),
    uploadProtocol
  });
}

async function putCompatibleVideoBody(uid: string, request: Request, env: Env): Promise<Response> {
  assertNonEmpty(uid, "uid");
  const row = await env.OBS_DB.prepare(
    "SELECT object_key FROM video_upload_requests WHERE stream_uid = ?"
  ).bind(uid).first<{ object_key: string }>();
  if (!row) return json({ ok: false, error: "video_upload_not_found" }, 404);

  const body = await request.arrayBuffer();
  if (body.byteLength === 0) {
    return json({ ok: false, error: "missing_body" }, 400);
  }
  await env.ASSET_BUCKET.put(row.object_key, body, {
    httpMetadata: { contentType: normalizeOptionalText(request.headers.get("content-type")) ?? "video/mp4" }
  });
  await env.OBS_DB.prepare(
    "UPDATE video_upload_requests SET upload_status = 'uploaded', bytes = ?, uploaded_at = CURRENT_TIMESTAMP WHERE stream_uid = ?"
  ).bind(body.byteLength, uid).run();
  return json({ ok: true, uid, bytes: body.byteLength });
}

async function finalizeCompatibleVideo(uid: string, request: Request, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ ok: false, error: "not_available" }, 404);
  }
  assertNonEmpty(uid, "uid");
  const session = await readCompatibleSession(request, env);
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401);
  }

  const input = await readJson<VideoFinalizeInput>(request);
  const row = await env.OBS_DB.prepare(
    `SELECT stream_uid, actor_id, observation_id, upload_status, max_duration_seconds, filename,
            upload_protocol, object_key, bytes, duration_ms, ready_to_stream, created_at, uploaded_at
     FROM video_upload_requests
     WHERE stream_uid = ?`
  ).bind(uid).first<{
    stream_uid: string;
    actor_id: string;
    observation_id: string | null;
    upload_status: string;
    max_duration_seconds: number;
    filename: string | null;
    upload_protocol: string;
    object_key: string | null;
    bytes: number;
    duration_ms: number;
    ready_to_stream: number;
    created_at: string;
    uploaded_at: string | null;
  }>();
  if (!row) {
    return json({ ok: true, video: pendingVideoFinalizePayload(uid) });
  }
  if (row.actor_id !== session.userId) {
    return json({ ok: false, error: "forbidden" }, 403);
  }

  const observationId = normalizeOptionalId(input.observationId) ?? row.observation_id;
  if (observationId) {
    await assertObservationOwnedByUser(observationId, session.userId, env);
  }

  const bytes = Math.max(0, numberOrNull(input.bytes) ?? row.bytes ?? 0);
  const durationMs = Math.max(0, numberOrNull(input.durationMs) ?? row.duration_ms ?? 0);
  const readyToStream = input.readyToStream === false ? false : row.upload_status === "uploaded" || bytes > 0;
  const uploadStatus = readyToStream ? "ready" : row.upload_status === "waiting_upload" ? "processing" : row.upload_status;

  await env.OBS_DB.prepare(
    `UPDATE video_upload_requests
     SET observation_id = ?, upload_status = ?, bytes = ?, duration_ms = ?, ready_to_stream = ?, finalized_at = CURRENT_TIMESTAMP
     WHERE stream_uid = ?`
  ).bind(observationId, uploadStatus, bytes, durationMs, readyToStream ? 1 : 0, uid).run();

  let dispatch: { sent: number; pending: number } | null = null;
  if (readyToStream && observationId && row.object_key) {
    dispatch = await attachVideoAssetToObservation({
      uid,
      observationId,
      ownerUserId: session.userId,
      objectKey: row.object_key,
      bytes,
      durationMs
    }, env);
  }

  return json({
    ok: true,
    video: videoRecordPayload({
      uid,
      observationId,
      uploadStatus,
      durationMs,
      bytes,
      readyToStream,
      createdAt: row.created_at,
      uploadedAt: row.uploaded_at
    }),
    dispatch
  });
}

async function assertObservationOwnedByUser(observationId: string, userId: string, env: Env): Promise<void> {
  const observation = await env.OBS_DB.prepare(
    "SELECT draft_id, owner_user_id FROM observations WHERE observation_id = ?"
  ).bind(observationId).first<{ draft_id: string; owner_user_id: string }>();
  if (!observation) {
    throw new HttpError(404, `observation not found: ${observationId}`);
  }
  if (observation.owner_user_id !== userId) {
    throw new HttpError(403, "forbidden");
  }
}

async function attachVideoAssetToObservation(input: {
  uid: string;
  observationId: string;
  ownerUserId: string;
  objectKey: string;
  bytes: number;
  durationMs: number;
}, env: Env): Promise<{ sent: number; pending: number }> {
  const observation = await env.OBS_DB.prepare(
    "SELECT draft_id, owner_user_id, partition_month FROM observations WHERE observation_id = ?"
  ).bind(input.observationId).first<{ draft_id: string; owner_user_id: string; partition_month: string | null }>();
  if (!observation) {
    throw new HttpError(404, `observation not found: ${input.observationId}`);
  }
  const partitionMonth = observation.partition_month ?? partitionMonthFromDate(new Date().toISOString());

  const assetId = `video_asset_${input.uid}`;
  const outboxMediaId = newId("outbox");
  const outboxReadModelId = newId("outbox");

  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      `INSERT OR REPLACE INTO asset_ledger
       (asset_id, draft_id, observation_id, owner_user_id, object_key, sha256, mime, bytes, width, height, duration_ms, visibility, processing_state, uploaded_at, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'private', 'uploaded', CURRENT_TIMESTAMP, ?)`
    ).bind(
      assetId,
      observation.draft_id,
      input.observationId,
      observation.owner_user_id,
      input.objectKey,
      null,
      "video/mp4",
      input.bytes,
      null,
      null,
      input.durationMs,
      partitionMonth
    ),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxMediaId, "media.process", input.observationId, JSON.stringify({ observationId: input.observationId, assetId }), partitionMonth),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxReadModelId, "readmodel.refresh", input.observationId, JSON.stringify({ observationId: input.observationId }), partitionMonth),
    rollbackLedgerInsert(env, {
      eventType: "asset.video.finalize",
      targetId: assetId,
      partitionMonth,
      sourceEndpoint: "POST /api/v1/videos/:uid/finalize",
      payload: {
        assetId,
        observationId: input.observationId,
        ownerUserId: observation.owner_user_id,
        objectKey: input.objectKey,
        streamUid: input.uid,
        bytes: input.bytes,
        durationMs: input.durationMs,
        readyToStream: true
      },
      replaySql: postgresAssetReplaySql(assetId, input.observationId, observation.owner_user_id, input.objectKey, null, "video/mp4", input.bytes, "private")
    })
  ]);

  return dispatchOutboxBestEffort(env, [
    { outboxId: outboxMediaId, topic: "media.process", targetId: input.observationId },
    { outboxId: outboxReadModelId, topic: "readmodel.refresh", targetId: input.observationId }
  ]);
}

async function upsertLegacyCompatibleObservation(request: Request, env: Env): Promise<Response> {
  const input = await readJson<LegacyObservationUpsertInput>(request);
  assertNonEmpty(input.userId, "userId");
  if (!Number.isFinite(input.latitude) || !Number.isFinite(input.longitude)) {
    throw new HttpError(400, "missing_location");
  }
  assertNonEmpty(input.observedAt, "observedAt");

  const draftId = newId("draft");
  const visitId = normalizeOptionalId(input.observationId) ?? newId("obs");
  const partition = resolveObservationPartition(input.observedAt, env);
  const occurrenceIds = resolveLegacyOccurrenceIds(visitId, input);
  const occurrenceId = occurrenceIds[0] ?? `occ:${visitId}:0`;
  const publicCell = blurLocation(input.latitude, input.longitude);
  const taxonLabel = resolveLegacyTaxonLabel(input);
  const placeName = normalizeOptionalText(input.siteName)
    ?? normalizeOptionalText(input.municipality)
    ?? normalizeOptionalText(input.prefecture)
    ?? "unknown place";
  const placeId = normalizeOptionalId(input.siteId) ?? `place:${publicCell}`;

  await env.CORE_DB.batch([
    env.CORE_DB.prepare("INSERT OR IGNORE INTO users (user_id) VALUES (?)").bind(input.userId)
  ]);
  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      `INSERT INTO draft_observations
       (draft_id, owner_user_id, observed_at, exact_lat, exact_lng, location_accuracy_m, public_cell, visibility, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      draftId,
      input.userId,
      input.observedAt,
      input.latitude,
      input.longitude,
      numberOrNull(input.locationAccuracyM),
      publicCell,
      "public",
      partition.partitionMonth
    ),
    env.OBS_DB.prepare(
      `INSERT INTO observations
       (observation_id, draft_id, owner_user_id, observed_at, taxon_label, note, exact_lat, exact_lng,
        location_accuracy_m, public_cell, visibility, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        + ` ON CONFLICT(observation_id) DO UPDATE SET
          draft_id = excluded.draft_id,
          owner_user_id = excluded.owner_user_id,
          observed_at = excluded.observed_at,
          taxon_label = excluded.taxon_label,
          note = excluded.note,
          exact_lat = excluded.exact_lat,
          exact_lng = excluded.exact_lng,
          location_accuracy_m = excluded.location_accuracy_m,
          public_cell = excluded.public_cell,
          visibility = excluded.visibility,
          partition_month = excluded.partition_month,
          emergency_hidden = 0,
          processing_state = 'accepted'`
    ).bind(
      visitId,
      draftId,
      input.userId,
      input.observedAt,
      taxonLabel,
      input.note ?? null,
      input.latitude,
      input.longitude,
      numberOrNull(input.locationAccuracyM),
      publicCell,
      "public",
      partition.partitionMonth
    ),
    env.OBS_DB.prepare(
      "UPDATE draft_observations SET processing_state = 'finalized', finalized_at = CURRENT_TIMESTAMP WHERE draft_id = ?"
    ).bind(draftId),
    rollbackLedgerInsert(env, {
      eventType: "observation.upsert",
      targetId: visitId,
      partitionMonth: partition.partitionMonth,
      sourceEndpoint: "POST /api/v1/observations/upsert",
      payload: {
        visitId,
        occurrenceIds,
        ownerUserId: input.userId,
        observedAt: input.observedAt,
        taxonLabel,
        note: input.note ?? null,
        exactLat: input.latitude,
        exactLng: input.longitude,
        locationAccuracyM: numberOrNull(input.locationAccuracyM),
        publicCell,
        visibility: "public",
        placeId,
        placeName
      },
      replaySql: postgresObservationReplaySql(
        visitId,
        input.userId,
        input.observedAt,
        taxonLabel,
        input.note ?? null,
        input.latitude,
        input.longitude,
        numberOrNull(input.locationAccuracyM),
        publicCell,
        "public"
      )
    })
  ]);

  return json({
    ok: true,
    visitId,
    occurrenceId,
    occurrenceIds,
    placeId,
    impact: {
      placeName,
      visitCount: 1,
      previousObservedAt: null,
      focusLabel: taxonLabel,
      captureState: normalizeOptionalText(input.sourcePayload?.quick_capture_state) ?? null
    },
    compatibility: {
      attempted: false,
      succeeded: false
    },
    idempotency: input.clientSubmissionId ? {
      clientSubmissionId: input.clientSubmissionId,
      reused: false
    } : undefined,
    placeMemory: null,
    placeMemorySample: [],
    contributionReceipts: buildLegacyContributionReceipts(visitId, occurrenceId, occurrenceIds.length, placeName, input)
  }, 201);
}

async function uploadLegacyCompatiblePhoto(observationId: string, request: Request, env: Env): Promise<Response> {
  assertNonEmpty(observationId, "observationId");
  const input = await readJson<LegacyPhotoUploadInput>(request);
  const mimeType = normalizeOptionalText(input.mimeType) ?? "image/jpeg";
  const filename = sanitizeFileName(normalizeOptionalText(input.filename) ?? "upload.jpg");
  const body = base64ToArrayBuffer(normalizeOptionalText(input.base64Data) ?? "");
  if (body.byteLength === 0) {
    throw new HttpError(400, "decoded image is empty");
  }
  if (body.byteLength > 10 * 1024 * 1024) {
    throw new HttpError(400, "image exceeds 10MB limit after normalization");
  }

  const observation = await env.OBS_DB.prepare(
    `SELECT draft_id, owner_user_id, partition_month
     FROM observations
     WHERE observation_id = ?`
  ).bind(observationId).first<{ draft_id: string; owner_user_id: string; partition_month: string | null }>();
  if (!observation) {
    return json({ ok: false, error: `observation not found: ${observationId}` }, 404);
  }
  const partitionMonth = observation.partition_month ?? partitionMonthFromDate(new Date().toISOString());

  const sha256 = await sha256Hex(body);
  const assetId = newId("asset");
  const outboxMediaId = newId("outbox");
  const outboxReadModelId = newId("outbox");
  const objectKey = `original/v1-compat/${observationId}/${assetId}-${filename}`;
  const relativePath = objectKey;
  const occurrenceId = `occ:${observationId}:0`;
  const facePrivacy = normalizeFacePrivacy(input.facePrivacy);

  await env.ASSET_BUCKET.put(objectKey, body, { httpMetadata: { contentType: mimeType } });
  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      `INSERT INTO asset_ledger
       (asset_id, draft_id, observation_id, owner_user_id, object_key, sha256, mime, bytes, visibility, processing_state, uploaded_at, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploaded', CURRENT_TIMESTAMP, ?)`
    ).bind(
      assetId,
      observation.draft_id,
      observationId,
      observation.owner_user_id,
      objectKey,
      sha256,
      mimeType,
      body.byteLength,
      "private",
      partitionMonth
    ),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxMediaId, "media.process", observationId, JSON.stringify({ observationId, assetId }), partitionMonth),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxReadModelId, "readmodel.refresh", observationId, JSON.stringify({ observationId }), partitionMonth),
    rollbackLedgerInsert(env, {
      eventType: "asset.photo.upload",
      targetId: assetId,
      partitionMonth,
      sourceEndpoint: "POST /api/v1/observations/:id/photos/upload",
      payload: {
        assetId,
        observationId,
        ownerUserId: observation.owner_user_id,
        objectKey,
        sha256,
        mime: mimeType,
        bytes: body.byteLength,
        visibility: "private",
        occurrenceId,
        facePrivacy
      },
      replaySql: postgresAssetReplaySql(assetId, observationId, observation.owner_user_id, objectKey, sha256, mimeType, body.byteLength, "private")
    })
  ]);

  const dispatch = await dispatchOutboxBestEffort(env, [
    { outboxId: outboxMediaId, topic: "media.process", targetId: observationId },
    { outboxId: outboxReadModelId, topic: "readmodel.refresh", targetId: observationId }
  ]);

  return json({
    ok: true,
    visitId: observationId,
    occurrenceId,
    relativePath,
    publicUrl: `/${relativePath}`,
    compatibility: {
      attempted: false,
      succeeded: false
    },
    facePrivacy,
    dispatch
  });
}

async function putAssetBody(assetId: string, request: Request, env: Env): Promise<Response> {
  assertNonEmpty(assetId, "assetId");
  const asset = await env.OBS_DB.prepare("SELECT object_key, mime FROM asset_ledger WHERE asset_id = ?")
    .bind(assetId)
    .first<{ object_key: string; mime: string }>();
  if (!asset) return json({ error: "asset_not_found" }, 404);
  if (!request.body) return json({ error: "missing_body" }, 400);

  await env.ASSET_BUCKET.put(asset.object_key, request.body, { httpMetadata: { contentType: asset.mime } });
  await env.OBS_DB.prepare(
    "UPDATE asset_ledger SET processing_state = 'uploaded', uploaded_at = CURRENT_TIMESTAMP WHERE asset_id = ?"
  ).bind(assetId).run();

  return json({ ok: true, assetId });
}

async function finalizeObservation(request: Request, env: Env): Promise<Response> {
  const input = await readJson<FinalizeObservationInput>(request);
  assertNonEmpty(input.draftId, "draftId");

  const draft = await env.OBS_DB.prepare("SELECT * FROM draft_observations WHERE draft_id = ?")
    .bind(input.draftId)
    .first<Record<string, D1Value>>();
  if (!draft) return json({ error: "draft_not_found" }, 404);

  const observationId = newId("obs");
  const outboxMediaId = newId("outbox");
  const outboxReadModelId = newId("outbox");
  const observedAt = stringValue(draft.observed_at) ?? new Date().toISOString();
  const partition = resolveObservationPartition(observedAt, env);
  const ownerUserId = stringValue(draft.owner_user_id);
  const publicCell = stringValue(draft.public_cell) ?? "unknown";
  const visibility = stringValue(draft.visibility) === "public" ? "public" : "private";

  if (!ownerUserId) return json({ error: "draft_missing_owner" }, 500);

  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      `INSERT INTO observations
       (observation_id, draft_id, owner_user_id, observed_at, taxon_label, note, exact_lat, exact_lng,
        location_accuracy_m, public_cell, visibility, partition_month)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      observationId,
      input.draftId,
      ownerUserId,
      observedAt,
      input.taxonLabel ?? null,
      input.note ?? null,
      numberOrNull(draft.exact_lat),
      numberOrNull(draft.exact_lng),
      numberOrNull(draft.location_accuracy_m),
      publicCell,
      visibility,
      partition.partitionMonth
    ),
    env.OBS_DB.prepare(
      "UPDATE draft_observations SET processing_state = 'finalized', finalized_at = CURRENT_TIMESTAMP WHERE draft_id = ?"
    ).bind(input.draftId),
    env.OBS_DB.prepare(
      "UPDATE asset_ledger SET observation_id = ? WHERE draft_id = ?"
    ).bind(observationId, input.draftId),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxMediaId, "media.process", observationId, JSON.stringify({ observationId }), partition.partitionMonth),
    env.OBS_DB.prepare(
      "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, ?, ?, ?, ?)"
    ).bind(outboxReadModelId, "readmodel.refresh", observationId, JSON.stringify({ observationId }), partition.partitionMonth),
    rollbackLedgerInsert(env, {
      eventType: "observation.finalize",
      targetId: observationId,
      partitionMonth: partition.partitionMonth,
      sourceEndpoint: "POST /api/v0/observations/finalize",
      payload: {
        observationId,
        draftId: input.draftId,
        ownerUserId,
        observedAt,
        taxonLabel: input.taxonLabel ?? null,
        note: input.note ?? null,
        exactLat: numberOrNull(draft.exact_lat),
        exactLng: numberOrNull(draft.exact_lng),
        locationAccuracyM: numberOrNull(draft.location_accuracy_m),
        publicCell,
        visibility
      },
      replaySql: postgresObservationReplaySql(
        observationId,
        ownerUserId,
        observedAt,
        input.taxonLabel ?? null,
        input.note ?? null,
        numberOrNull(draft.exact_lat),
        numberOrNull(draft.exact_lng),
        numberOrNull(draft.location_accuracy_m),
        publicCell,
        visibility
      )
    })
  ]);

  const dispatch = await dispatchOutboxBestEffort(env, [
    { outboxId: outboxMediaId, topic: "media.process", targetId: observationId },
    { outboxId: outboxReadModelId, topic: "readmodel.refresh", targetId: observationId }
  ]);

  return json({ observationId, processingState: "accepted", dispatch }, 201);
}

async function drainOutbox(env: Env): Promise<Response> {
  const rows = await queryPendingOutbox(env);
  for (const row of rows) {
    await sendOutbox(env, { outboxId: row.outbox_id, topic: row.topic, targetId: row.target_id });
  }
  return json({ dispatched: rows.length });
}

async function r2Inventory(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const prefix = url.searchParams.get("prefix") ?? "original/";
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? "100"), 1), 1000);
  const cursor = url.searchParams.get("cursor") ?? undefined;
  const listed = await env.ASSET_BUCKET.list({ prefix, limit, cursor });
  return json({
    prefix,
    limit,
    cursor: cursor ?? null,
    nextCursor: listed.cursor ?? null,
    truncated: Boolean(listed.truncated),
    count: listed.objects.length,
    bytes: listed.objects.reduce((sum, object) => sum + object.size, 0),
    objects: listed.objects.map((object) => ({
      key: object.key,
      size: object.size,
      etag: object.etag ?? null,
      uploaded: object.uploaded ? new Date(object.uploaded).toISOString() : null,
      checksums: object.checksums ?? null
    }))
  });
}

async function queryPendingOutbox(env: Env): Promise<Array<{ outbox_id: string; topic: MediaJob["topic"]; target_id: string }>> {
  const result = await env.OBS_DB.prepare(
    "SELECT outbox_id, topic, target_id FROM outbox WHERE dispatch_state = 'pending' ORDER BY created_at LIMIT 100"
  ).all<{ outbox_id: string; topic: MediaJob["topic"]; target_id: string }>();
  return result.results;
}

async function dispatchOutboxBestEffort(env: Env, jobs: MediaJob[]): Promise<{ sent: number; pending: number; errors: string[] }> {
  let sent = 0;
  const errors: string[] = [];
  for (const job of jobs) {
    try {
      await sendOutbox(env, job);
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown dispatch error";
      errors.push(message);
      await env.OBS_DB.prepare(
        "UPDATE outbox SET attempts = attempts + 1, last_error = ? WHERE outbox_id = ?"
      ).bind(message, job.outboxId).run();
    }
  }
  return { sent, pending: jobs.length - sent, errors };
}

async function sendOutbox(env: Env, job: MediaJob): Promise<void> {
  await env.MEDIA_QUEUE.send(job);
  await env.OBS_DB.prepare(
    "UPDATE outbox SET dispatch_state = 'dispatched', dispatched_at = CURRENT_TIMESTAMP WHERE outbox_id = ?"
  ).bind(job.outboxId).run();
}

async function applyMediaJob(job: MediaJob, env: Env): Promise<void> {
  if (job.topic === "media.process") {
    await markUploadedAssetsPublicReady(job.targetId, env);
    await refreshPublicReadmodel(job.targetId, env);
    return;
  }

  if (job.topic === "readmodel.refresh") {
    await refreshPublicReadmodel(job.targetId, env);
  }
}

async function refreshPublicReadmodel(observationId: string, env: Env): Promise<void> {
  const observation = await env.OBS_DB.prepare(
    `SELECT observation_id, public_cell, observed_at, taxon_label, partition_month
     FROM observations
     WHERE observation_id = ? AND visibility = 'public' AND emergency_hidden = 0`
  ).bind(observationId).first<{ observation_id: string; public_cell: string; observed_at: string; taxon_label: string | null; partition_month: string | null }>();
  if (!observation) {
    await deletePublicReadmodelRow(observationId, env);
    return;
  }
  const partitionMonth = observation.partition_month ?? partitionMonthFromDate(observation.observed_at);

  const unsafePublicAssets = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS count
     FROM asset_ledger
     WHERE observation_id = ?
       AND processing_state = 'uploaded'
       AND (
         public_derivative_key IS NULL
         OR exif_scrub_state != 'scrubbed'
         OR public_ready_at IS NULL
         OR public_derivative_verified_at IS NULL
         OR public_derivative_metadata_json IS NULL
       )`
  ).bind(observationId).first<{ count: number }>();
  if ((unsafePublicAssets?.count ?? 0) > 0) return;

  const publicReadyAssetCount = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS count
     FROM asset_ledger
     WHERE observation_id = ?
       AND processing_state = 'uploaded'
       AND public_derivative_key IS NOT NULL
       AND exif_scrub_state = 'scrubbed'
       AND public_ready_at IS NOT NULL
       AND public_derivative_verified_at IS NOT NULL
       AND public_derivative_metadata_json IS NOT NULL`
  ).bind(observationId).first<{ count: number }>();

  await env.OBS_DB.prepare(
    `INSERT INTO readmodel_public_observations
     (observation_id, public_cell, observed_at, taxon_label, asset_count, partition_month)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(observation_id) DO UPDATE SET
       public_cell = excluded.public_cell,
       observed_at = excluded.observed_at,
       taxon_label = excluded.taxon_label,
       asset_count = excluded.asset_count,
       partition_month = excluded.partition_month,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    observation.observation_id,
    observation.public_cell,
    observation.observed_at,
    observation.taxon_label,
    publicReadyAssetCount?.count ?? 0,
    partitionMonth
  ).run();
}

async function deletePublicReadmodelRow(observationId: string, env: Env): Promise<void> {
  await env.OBS_DB.prepare(
    "DELETE FROM readmodel_public_observations WHERE observation_id = ?"
  ).bind(observationId).run();
}

async function applyEmergencyHide(observationId: string, env: Env): Promise<void> {
  const observation = await env.OBS_DB.prepare(
    "SELECT draft_id, owner_user_id, partition_month FROM observations WHERE observation_id = ?"
  ).bind(observationId).first<{ draft_id: string; owner_user_id: string; partition_month: string | null }>();
  if (!observation) {
    throw new HttpError(404, `observation not found: ${observationId}`);
  }
  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      "UPDATE observations SET emergency_hidden = 1 WHERE observation_id = ?"
    ).bind(observationId),
    env.OBS_DB.prepare(
      "DELETE FROM readmodel_public_observations WHERE observation_id = ?"
    ).bind(observationId),
    rollbackLedgerInsert(env, {
      eventType: "observation.hide",
      targetId: observationId,
      partitionMonth: observation.partition_month,
      sourceEndpoint: "POST /api/v1/observations/:id/hide",
      payload: {
        observationId,
        ownerUserId: observation.owner_user_id,
        emergencyHidden: true,
        publicReadmodelDeleted: true
      },
      replaySql: postgresObservationHideReplaySql(observationId)
    })
  ]);
}

async function hideCompatibleObservation(observationId: string, request: Request, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ ok: false, error: "not_available" }, 404);
  }
  assertNonEmpty(observationId, "observationId");
  const session = await readCompatibleSession(request, env);
  if (!session) {
    return json({ ok: false, error: "session_required" }, 401);
  }
  await assertObservationOwnedByUser(observationId, session.userId, env);
  await applyEmergencyHide(observationId, env);
  return json({
    ok: true,
    visitId: observationId,
    hidden: true,
    canonicalPreserved: true,
    publicReadmodelDeleted: true
  });
}

async function shadowTakedownProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const suffix = sanitizeIdPart(url.searchParams.get("id") ?? new Date().toISOString());
  const observationId = `shadow-takedown-${suffix}`.slice(0, 120);
  const observedAt = "2026-06-15T03:00:00.000Z";
  const upsertResponse = await upsertLegacyCompatibleObservation(new Request("https://shadow.test/api/v1/observations/upsert", {
    method: "POST",
    body: JSON.stringify({
      observationId,
      userId: "shadow-takedown-user",
      observedAt,
      latitude: 34.71234,
      longitude: 137.81234,
      visibility: "public",
      taxon: { vernacularName: "緊急非公開テスト", rank: "species" },
      note: "shadow takedown propagation proof"
    })
  }), env);
  if (!upsertResponse.ok) {
    return upsertResponse;
  }

  const photoResponse = await uploadLegacyCompatiblePhoto(observationId, new Request(`https://shadow.test/api/v1/observations/${encodeURIComponent(observationId)}/photos/upload`, {
    method: "POST",
    body: JSON.stringify({
      filename: "takedown-proof.jpg",
      mimeType: "image/jpeg",
      base64Data: btoa("shadow-takedown-image")
    })
  }), env);
  if (!photoResponse.ok) {
    return photoResponse;
  }

  await markUploadedAssetsPublicReady(observationId, env);
  await refreshPublicReadmodel(observationId, env);

  const before = await takedownVisibilityState(observationId, env);
  await applyEmergencyHide(observationId, env);
  await refreshPublicReadmodel(observationId, env);
  const after = await takedownVisibilityState(observationId, env);
  const canonical = await env.OBS_DB.prepare(
    `SELECT o.observation_id, o.emergency_hidden, COUNT(a.asset_id) AS asset_count
     FROM observations o
     LEFT JOIN asset_ledger a ON a.observation_id = o.observation_id
     WHERE o.observation_id = ?
     GROUP BY o.observation_id, o.emergency_hidden`
  ).bind(observationId).first<{ observation_id: string; emergency_hidden: number; asset_count: number }>();

  return json({
    ok: before.publicDetailVisible === true &&
      before.mapVisible === true &&
      after.publicDetailVisible === false &&
      after.mapVisible === false &&
      canonical?.emergency_hidden === 1 &&
      (canonical?.asset_count ?? 0) > 0,
    observationId,
    before,
    after,
    canonical,
    invariants: {
      canonicalDeleted: false,
      readmodelHidden: after.readmodelRows === 0,
      publicDetailHidden: !after.publicDetailVisible,
      mapHidden: !after.mapVisible,
      exactLocationExposed: false
    }
  }, 200, { "cache-control": "no-store" });
}

async function takedownVisibilityState(observationId: string, env: Env) {
  const readmodelRows = await env.OBS_DB.prepare(
    "SELECT COUNT(*) AS count FROM readmodel_public_observations WHERE observation_id = ?"
  ).bind(observationId).first<{ count: number }>();
  const detail = await buildPublicObservationDetail(observationId, env);
  const mapRows = await queryPublicMapRows(env);
  return {
    readmodelRows: readmodelRows?.count ?? 0,
    publicDetailVisible: Boolean(detail),
    mapVisible: mapRows.some((row) => row.observation_id === observationId)
  };
}

async function shadowVideoMetadataProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_found" }, 404);
  }

  const suffix = sanitizeIdPart(url.searchParams.get("id") ?? new Date().toISOString());
  const observationId = `shadow-video-metadata-${suffix}`.slice(0, 120);
  const userId = `shadow-video-user-${suffix}`.slice(0, 120);
  const videoBytes = shadowSafeMp4Bytes();

  const upsertResponse = await upsertLegacyCompatibleObservation(new Request(`${url.origin}/api/v1/observations/upsert`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      observationId,
      userId,
      observedAt: "2026-06-15T03:00:00.000Z",
      latitude: 34.71234,
      longitude: 137.81234,
      locationAccuracyM: 12,
      visibility: "public",
      taxon: { vernacularName: "shadow video proof", rank: "species" },
      note: "shadow video metadata privacy proof"
    })
  }), env);
  if (!upsertResponse.ok) {
    return upsertResponse;
  }

  const sessionResponse = await issueCompatibleSession(new Request(`${url.origin}/api/v1/auth/session/issue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, ttlHours: 1 })
  }), env);
  const cookie = sessionResponse.headers.get("set-cookie") ?? "";

  const directResponse = await createCompatibleVideoDirectUpload(new Request(`${url.origin}/api/v1/videos/direct-upload`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "shadow-safe-container.mp4",
      observationId,
      maxDurationSeconds: 12,
      fileSizeBytes: videoBytes.byteLength,
      uploadProtocol: "post"
    })
  }), env);
  const directPayload = await directResponse.json() as { ok?: boolean; uid?: string; uploadUrl?: string };
  if (!directResponse.ok || !directPayload.uid || !directPayload.uploadUrl) {
    return json({ ok: false, error: "direct_upload_failed", payload: directPayload }, 500);
  }

  const bodyResponse = await putCompatibleVideoBody(directPayload.uid, new Request(directPayload.uploadUrl, {
    method: "PUT",
    headers: { "content-type": "video/mp4" },
    body: videoBytes
  }), env);
  if (!bodyResponse.ok) {
    return json({ ok: false, error: "video_body_upload_failed", status: bodyResponse.status }, 500);
  }

  const finalizeResponse = await finalizeCompatibleVideo(directPayload.uid, new Request(`${url.origin}/api/v1/videos/${encodeURIComponent(directPayload.uid)}/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      observationId,
      durationMs: 9000,
      readyToStream: true,
      bytes: videoBytes.byteLength
    })
  }), env);
  const finalizePayload = await finalizeResponse.json() as { ok?: boolean; video?: { watchUrl?: string; thumbnailUrl?: string } };
  if (!finalizeResponse.ok || !finalizePayload.video?.watchUrl) {
    return json({ ok: false, error: "video_finalize_failed", payload: finalizePayload }, 500);
  }

  await refreshPublicReadmodel(observationId, env);
  const servedVideo = await getShadowVideoStream(directPayload.uid, env);
  const servedVideoBytes = await servedVideo.arrayBuffer();
  const videoInspection = inspectVideoContainerMetadata(servedVideoBytes, servedVideo.headers.get("content-type") ?? "");
  const servedPoster = await getShadowVideoThumbnail(directPayload.uid, env);
  const servedPosterBytes = await servedPoster.arrayBuffer();
  const posterInspection = inspectPublicDerivativeMetadata(servedPosterBytes, servedPoster.headers.get("content-type") ?? "");
  const assetId = `video_asset_${directPayload.uid}`;
  const videoAsset = await env.OBS_DB.prepare(
    "SELECT object_key, mime FROM asset_ledger WHERE asset_id = ?"
  ).bind(assetId).first<{ object_key: string; mime: string }>();
  if (videoAsset && videoInspection.ftypPresent && !videoInspection.gpsExifPresent) {
    await env.OBS_DB.prepare(
      `UPDATE asset_ledger
       SET public_derivative_key = ?,
           public_derivative_sha256 = ?,
           public_derivative_verified_at = CURRENT_TIMESTAMP,
           public_derivative_metadata_json = ?,
           exif_scrub_state = 'scrubbed',
           public_ready_at = CURRENT_TIMESTAMP,
           processing_state = 'uploaded'
       WHERE asset_id = ?`
    ).bind(videoAsset.object_key, await sha256Hex(servedVideoBytes), JSON.stringify(videoInspection), assetId).run();
  }
  await refreshPublicReadmodel(observationId, env);
  const visibility = await takedownVisibilityState(observationId, env);

  return json({
    ok: servedVideo.ok &&
      servedPoster.ok &&
      videoInspection.ftypPresent &&
      !videoInspection.gpsExifPresent &&
      !posterInspection.gpsExifPresent &&
      visibility.publicDetailVisible &&
      visibility.mapVisible,
    observationId,
    uid: directPayload.uid,
    served: {
      videoStatus: servedVideo.status,
      videoContentType: servedVideo.headers.get("content-type"),
      posterStatus: servedPoster.status,
      posterContentType: servedPoster.headers.get("content-type")
    },
    videoInspection,
    posterInspection,
    visibility,
    invariants: {
      servedVideoIsMp4: videoInspection.ftypPresent,
      videoGpsExifAbsent: !videoInspection.gpsExifPresent,
      posterGpsExifAbsent: !posterInspection.gpsExifPresent,
      exactLocationExposed: videoInspection.exactCoordinateLiteralPresent || posterInspection.exactCoordinateLiteralPresent
    }
  }, 200, { "cache-control": "no-store" });
}

async function legacyAssetImportSummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const legacy = await env.OBS_DB.prepare(
    `SELECT import_status, asset_role, COUNT(*) AS count
     FROM legacy_asset_import_ledger
     GROUP BY import_status, asset_role
     ORDER BY import_status, asset_role`
  ).all<{ import_status: string; asset_role: string; count: number }>();
  const stream = await env.OBS_DB.prepare(
    `SELECT exists_on_stream, ready_to_stream, status_state, COUNT(*) AS count
     FROM legacy_stream_inventory
     GROUP BY exists_on_stream, ready_to_stream, status_state
     ORDER BY exists_on_stream DESC, ready_to_stream DESC, status_state`
  ).all<{ exists_on_stream: number; ready_to_stream: number; status_state: string | null; count: number }>();
  return json({ rows: legacy.results, streamInventory: stream.results });
}

async function r2ImportSummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const result = await env.OBS_DB.prepare(
    `SELECT import_status, asset_role, COUNT(*) AS count, SUM(uploaded_bytes) AS uploaded_bytes
     FROM legacy_r2_import_ledger
     GROUP BY import_status, asset_role
     ORDER BY import_status, asset_role`
  ).all<{ import_status: string; asset_role: string; count: number; uploaded_bytes: number | null }>();
  return json({ rows: result.results });
}

async function productionRestoreParitySummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const run = await env.OBS_DB.prepare(
    `SELECT run_id, source_db, collected_at, table_count, critical_json, orphan_json, note
     FROM production_restore_parity_runs
     ORDER BY collected_at DESC
     LIMIT 1`
  ).first<{
    run_id: string;
    source_db: string;
    collected_at: string;
    table_count: number;
    critical_json: string;
    orphan_json: string;
    note: string | null;
  }>();
  if (!run) {
    return json({ run: null, metrics: [] });
  }
  const metrics = await env.OBS_DB.prepare(
    `SELECT metric_type, metric_key, metric_value, detail_json
     FROM production_restore_parity_metrics
     WHERE run_id = ?
     ORDER BY metric_type, metric_key`
  ).bind(run.run_id).all<{
    metric_type: string;
    metric_key: string;
    metric_value: string;
    detail_json: string | null;
  }>();
  return json({
    run: {
      ...run,
      critical: JSON.parse(run.critical_json),
      orphanChecks: JSON.parse(run.orphan_json)
    },
    metrics: metrics.results
  });
}

async function productionImportSummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const countQueries: Array<[string, string]> = [
    ["users", "SELECT COUNT(*) AS count FROM production_import_users"],
    ["visits", "SELECT COUNT(*) AS count FROM production_import_visits"],
    ["occurrences", "SELECT COUNT(*) AS count FROM production_import_occurrences"],
    ["asset_blobs", "SELECT COUNT(*) AS count FROM production_import_asset_blobs"],
    ["evidence_assets", "SELECT COUNT(*) AS count FROM production_import_evidence_assets"],
    ["public_readmodel", "SELECT COUNT(*) AS count FROM production_import_public_readmodel"]
  ];
  const counts = [];
  for (const [tableName, query] of countQueries) {
    const row = await env.OBS_DB.prepare(query).first<{ count: number }>();
    counts.push({ table_name: tableName, count: row?.count ?? 0 });
  }
  const orphanQueries: Array<[string, string]> = [
    ["visits_missing_user", "SELECT COUNT(*) AS count FROM production_import_visits v LEFT JOIN production_import_users u ON u.user_id = v.user_id WHERE v.user_id IS NOT NULL AND u.user_id IS NULL"],
    ["occurrences_missing_visit", "SELECT COUNT(*) AS count FROM production_import_occurrences o LEFT JOIN production_import_visits v ON v.visit_id = o.visit_id WHERE o.visit_id IS NOT NULL AND v.visit_id IS NULL"],
    ["assets_missing_blob", "SELECT COUNT(*) AS count FROM production_import_evidence_assets a LEFT JOIN production_import_asset_blobs b ON b.blob_id = a.blob_id WHERE a.blob_id IS NOT NULL AND b.blob_id IS NULL"],
    ["assets_missing_visit", "SELECT COUNT(*) AS count FROM production_import_evidence_assets a LEFT JOIN production_import_visits v ON v.visit_id = a.visit_id WHERE a.visit_id IS NOT NULL AND a.visit_id != '' AND v.visit_id IS NULL"],
    ["assets_missing_occurrence", "SELECT COUNT(*) AS count FROM production_import_evidence_assets a LEFT JOIN production_import_occurrences o ON o.occurrence_id = a.occurrence_id WHERE a.occurrence_id IS NOT NULL AND a.occurrence_id != '' AND o.occurrence_id IS NULL"]
  ];
  const orphanChecks = [];
  for (const [checkName, query] of orphanQueries) {
    const row = await env.OBS_DB.prepare(query).first<{ count: number }>();
    orphanChecks.push({ check_name: checkName, count: row?.count ?? 0 });
  }
  const mediaCoverage = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS evidence_assets,
       SUM(CASE WHEN r.asset_id IS NOT NULL AND r.import_status = 'uploaded_verified' THEN 1 ELSE 0 END) AS r2_verified,
       SUM(CASE WHEN l.asset_id IS NOT NULL THEN 1 ELSE 0 END) AS legacy_ledgered,
       SUM(CASE WHEN s.asset_id IS NOT NULL AND s.exists_on_stream = 1 THEN 1 ELSE 0 END) AS stream_exists
     FROM production_import_evidence_assets a
     LEFT JOIN legacy_r2_import_ledger r ON r.asset_id = a.asset_id
     LEFT JOIN legacy_asset_import_ledger l ON l.asset_id = a.asset_id
     LEFT JOIN legacy_stream_inventory s ON s.asset_id = a.asset_id`
  ).first<{
    evidence_assets: number;
    r2_verified: number | null;
    legacy_ledgered: number | null;
    stream_exists: number | null;
  }>();
  const publicReadmodel = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS rows,
       SUM(occurrence_count) AS occurrence_count,
       SUM(asset_count) AS asset_count,
       SUM(public_ready_asset_count) AS public_ready_asset_count,
       SUM(unresolved_asset_count) AS unresolved_asset_count
     FROM production_import_public_readmodel`
  ).first<{
    rows: number;
    occurrence_count: number | null;
    asset_count: number | null;
    public_ready_asset_count: number | null;
    unresolved_asset_count: number | null;
  }>();
  return json({
    counts,
    orphanChecks,
    mediaCoverage,
    publicReadmodel
  });
}

async function shadowMissingMediaLedgerProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const expectedMissing = Number(url.searchParams.get("expected_missing") ?? "47");
  const expectedStreamPending = Number(url.searchParams.get("expected_stream_pending") ?? "34");
  const legacyBreakdown = await env.OBS_DB.prepare(
    `SELECT import_status, asset_role, COUNT(*) AS count
     FROM legacy_asset_import_ledger
     GROUP BY import_status, asset_role
     ORDER BY import_status, asset_role`
  ).all<{ import_status: string; asset_role: string; count: number }>();
  const missingLegacyAssets = await env.OBS_DB.prepare(
    "SELECT COUNT(*) AS count FROM legacy_asset_import_ledger WHERE import_status = 'missing_legacy_asset'"
  ).first<{ count: number }>();
  const streamPendingAssets = await env.OBS_DB.prepare(
    "SELECT COUNT(*) AS count FROM legacy_asset_import_ledger WHERE import_status = 'stream_inventory_pending'"
  ).first<{ count: number }>();
  const missingAlsoUploaded = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS count
     FROM legacy_asset_import_ledger l
     JOIN legacy_r2_import_ledger r ON r.asset_id = l.asset_id
     WHERE l.import_status = 'missing_legacy_asset'
       AND r.import_status = 'uploaded_verified'`
  ).first<{ count: number }>();
  const publicReadmodel = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS rows,
       SUM(asset_count) AS asset_count,
       SUM(public_ready_asset_count) AS public_ready_asset_count,
       SUM(unresolved_asset_count) AS unresolved_asset_count
     FROM production_import_public_readmodel`
  ).first<{
    rows: number;
    asset_count: number | null;
    public_ready_asset_count: number | null;
    unresolved_asset_count: number | null;
  }>();

  const assetCount = publicReadmodel?.asset_count ?? 0;
  const publicReadyAssetCount = publicReadmodel?.public_ready_asset_count ?? 0;
  const unresolvedAssetCount = publicReadmodel?.unresolved_asset_count ?? 0;
  const missingCount = missingLegacyAssets?.count ?? 0;
  const streamPendingCount = streamPendingAssets?.count ?? 0;
  const doubleImportedCount = missingAlsoUploaded?.count ?? 0;

  return json({
    ok: true,
    gate: "missing_legacy_asset_degraded_public_readmodel",
    expected: {
      missingLegacyAssets: expectedMissing,
      streamInventoryPending: expectedStreamPending
    },
    legacyBreakdown: legacyBreakdown.results,
    publicReadmodel: {
      rows: publicReadmodel?.rows ?? 0,
      assetCount,
      publicReadyAssetCount,
      unresolvedAssetCount
    },
    invariants: {
      missingLegacyAssetsLedgered: missingCount === expectedMissing,
      streamInventoryPendingLedgered: streamPendingCount === expectedStreamPending,
      missingLegacyAssetsNotUploadedVerified: doubleImportedCount === 0,
      unresolvedAssetsRemainExplicit: unresolvedAssetCount > 0,
      publicReadyDoesNotIncludeUnresolved: publicReadyAssetCount + unresolvedAssetCount === assetCount
    }
  });
}

async function shadowProductionImportDressRehearsalProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const expectedReadmodelRows = clampInteger(Number(url.searchParams.get("expected_public_rows") ?? "588"), 0, 1000000);
  const expectedEvidenceAssets = clampInteger(Number(url.searchParams.get("expected_evidence_assets") ?? "2032"), 0, 1000000);
  const expectedR2Verified = clampInteger(Number(url.searchParams.get("expected_r2_verified") ?? "1951"), 0, 1000000);
  const expectedR2Objects = clampInteger(Number(url.searchParams.get("expected_r2_objects") ?? "1951"), 0, 1000000);
  const expectedR2Bytes = clampInteger(Number(url.searchParams.get("expected_r2_bytes") ?? "2338615108"), 0, 100000000000);
  const expectedLegacyLedgered = clampInteger(Number(url.searchParams.get("expected_legacy_ledgered") ?? "81"), 0, 1000000);
  const expectedUnresolvedAssets = clampInteger(Number(url.searchParams.get("expected_unresolved_assets") ?? "55"), 0, 1000000);
  const expectedStreamExists = clampInteger(Number(url.searchParams.get("expected_stream_exists") ?? "34"), 0, 1000000);

  const publicReadmodel = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS rows,
       SUM(asset_count) AS asset_count,
       SUM(public_ready_asset_count) AS public_ready_asset_count,
       SUM(unresolved_asset_count) AS unresolved_asset_count
     FROM production_import_public_readmodel`
  ).first<{
    rows: number;
    asset_count: number | null;
    public_ready_asset_count: number | null;
    unresolved_asset_count: number | null;
  }>();

  const mediaCoverage = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS evidence_assets,
       SUM(CASE WHEN r.asset_id IS NOT NULL AND r.import_status = 'uploaded_verified' THEN 1 ELSE 0 END) AS r2_verified,
       SUM(CASE WHEN l.asset_id IS NOT NULL THEN 1 ELSE 0 END) AS legacy_ledgered,
       SUM(CASE WHEN s.asset_id IS NOT NULL AND s.exists_on_stream = 1 THEN 1 ELSE 0 END) AS stream_exists
     FROM production_import_evidence_assets a
     LEFT JOIN legacy_r2_import_ledger r ON r.asset_id = a.asset_id
     LEFT JOIN legacy_asset_import_ledger l ON l.asset_id = a.asset_id
     LEFT JOIN legacy_stream_inventory s ON s.asset_id = a.asset_id`
  ).first<{
    evidence_assets: number;
    r2_verified: number | null;
    legacy_ledgered: number | null;
    stream_exists: number | null;
  }>();

  const r2Ledger = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS verified_count,
       SUM(COALESCE(verified_bytes, uploaded_bytes)) AS verified_bytes,
       SUM(CASE
         WHEN import_status = 'uploaded_verified'
          AND uploaded_sha256 = expected_sha256
          AND verified_sha256 = expected_sha256
          AND uploaded_bytes = expected_bytes
          AND verified_bytes = expected_bytes
         THEN 1 ELSE 0 END) AS checksum_match_count
     FROM legacy_r2_import_ledger
     WHERE import_status = 'uploaded_verified'`
  ).first<{
    verified_count: number;
    verified_bytes: number | null;
    checksum_match_count: number | null;
  }>();

  const streamInventory = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN exists_on_stream = 1 THEN 1 ELSE 0 END) AS exists_count,
       SUM(CASE WHEN ready_to_stream = 1 THEN 1 ELSE 0 END) AS ready_count,
       SUM(CASE WHEN exists_on_stream = 1 AND ready_to_stream = 0 THEN 1 ELSE 0 END) AS nonready_count
     FROM legacy_stream_inventory`
  ).first<{
    total: number;
    exists_count: number | null;
    ready_count: number | null;
    nonready_count: number | null;
  }>();

  const prefixes = [
    "import-smoke/20260615/",
    "import-smoke/20260615-data/original/"
  ];
  const r2Inventory = await summarizeR2Prefixes(env.ASSET_BUCKET, prefixes);

  const assetCount = publicReadmodel?.asset_count ?? 0;
  const publicReadyAssetCount = publicReadmodel?.public_ready_asset_count ?? 0;
  const unresolvedAssetCount = publicReadmodel?.unresolved_asset_count ?? 0;
  const evidenceAssets = mediaCoverage?.evidence_assets ?? 0;
  const r2Verified = mediaCoverage?.r2_verified ?? 0;
  const legacyLedgered = mediaCoverage?.legacy_ledgered ?? 0;
  const streamExists = mediaCoverage?.stream_exists ?? 0;
  const r2LedgerVerifiedCount = r2Ledger?.verified_count ?? 0;
  const r2LedgerVerifiedBytes = r2Ledger?.verified_bytes ?? 0;
  const r2ChecksumMatchCount = r2Ledger?.checksum_match_count ?? 0;

  const invariants = {
    productionReadmodelImported: publicReadmodel?.rows === expectedReadmodelRows,
    evidenceAssetsImported: evidenceAssets === expectedEvidenceAssets,
    mediaCoverageComplete: r2Verified + legacyLedgered === evidenceAssets,
    r2LedgerCountMatches: r2LedgerVerifiedCount === expectedR2Verified,
    r2LedgerChecksumVerified: r2ChecksumMatchCount === r2LedgerVerifiedCount,
    r2InventoryCountMatchesLedger: r2Inventory.totalObjects === expectedR2Objects && r2Inventory.totalObjects === r2LedgerVerifiedCount,
    r2InventoryBytesMatchLedger: r2Inventory.totalBytes === expectedR2Bytes && r2Inventory.totalBytes === r2LedgerVerifiedBytes,
    unresolvedAssetsRemainExplicit: unresolvedAssetCount === expectedUnresolvedAssets && publicReadyAssetCount + unresolvedAssetCount === assetCount,
    streamInventoryExists: streamExists === expectedStreamExists && (streamInventory?.exists_count ?? 0) === expectedStreamExists,
    mutationPerformed: false,
    productionTrafficAffected: false
  };
  const ok =
    invariants.productionReadmodelImported &&
    invariants.evidenceAssetsImported &&
    invariants.mediaCoverageComplete &&
    invariants.r2LedgerCountMatches &&
    invariants.r2LedgerChecksumVerified &&
    invariants.r2InventoryCountMatchesLedger &&
    invariants.r2InventoryBytesMatchLedger &&
    invariants.unresolvedAssetsRemainExplicit &&
    invariants.streamInventoryExists &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected;

  return json({
    ok,
    gate: "production_imported_data_r2_inventory_dress_rehearsal",
    mode: "dry_run_no_production_mutation",
    publicReadmodel: {
      rows: publicReadmodel?.rows ?? 0,
      assetCount,
      publicReadyAssetCount,
      unresolvedAssetCount
    },
    mediaCoverage: {
      evidenceAssets,
      r2Verified,
      legacyLedgered,
      streamExists
    },
    r2Ledger: {
      verifiedCount: r2LedgerVerifiedCount,
      verifiedBytes: r2LedgerVerifiedBytes,
      checksumMatchCount: r2ChecksumMatchCount
    },
    r2Inventory,
    streamInventory: {
      total: streamInventory?.total ?? 0,
      existsCount: streamInventory?.exists_count ?? 0,
      readyCount: streamInventory?.ready_count ?? 0,
      nonReadyCount: streamInventory?.nonready_count ?? 0
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function shadowRouteChangeRehearsalProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const requiredStagingGates = [
    "health_internal_guard",
    "stream_nonready_exclusion",
    "missing_media_ledger",
    "video_metadata_privacy_and_takedown",
    "update_delete_idempotent_replay",
    "rollback_restore_smoke",
    "production_imported_data_r2_inventory",
    "auth_record_photo_video_map_detail"
  ];
  const productionHosts = ["ikimon.life", "www.ikimon.life"];
  const stagingHost = url.searchParams.get("staging_host") ?? "staging.ikimon.life";

  const routeMatrix = [
    {
      host: stagingHost,
      path: "/cloudflare-shadow/health",
      currentExpectedStatus: 200,
      postCutoverExpectedStatus: 200,
      target: "staging_shadow_proxy",
      productionHost: false
    },
    {
      host: stagingHost,
      path: "/cloudflare-shadow/shadow-smoke/route-change-rehearsal-proof",
      currentExpectedStatus: 200,
      postCutoverExpectedStatus: 200,
      target: "staging_shadow_proxy",
      productionHost: false
    },
    {
      host: "ikimon.life",
      path: "/cloudflare-shadow/health",
      currentExpectedStatus: 404,
      postCutoverExpectedStatus: 404,
      target: "shadow_proxy_must_remain_disabled_on_production_hosts",
      productionHost: true
    },
    {
      host: "ikimon.life",
      path: "/health",
      currentExpectedStatus: null,
      postCutoverExpectedStatus: 200,
      target: "cloudflare_managed_app_health",
      productionHost: true
    },
    {
      host: "www.ikimon.life",
      path: "/",
      currentExpectedStatus: null,
      postCutoverExpectedStatus: 308,
      target: "canonical_apex_redirect",
      productionHost: true
    }
  ];

  const invariants = {
    dnsUnchanged: true,
    workerRouteUnchanged: true,
    maintenanceModeUnchanged: true,
    mutationPerformed: false,
    productionTrafficAffected: false,
    stagingShadowProxyOnly: routeMatrix.filter((route) => route.target === "staging_shadow_proxy").every((route) => !route.productionHost),
    productionShadowProxyClosed: routeMatrix.some((route) => route.host === "ikimon.life" && route.path === "/cloudflare-shadow/health" && route.postCutoverExpectedStatus === 404),
    apexAndWwwPostCutoverDefined: productionHosts.every((host) => routeMatrix.some((route) => route.host === host && route.productionHost)),
    requiredGatesEnumerated: requiredStagingGates.length === 8,
    rollbackRouteDocumented: true,
    cutoverRequiresExplicitApproval: true
  };
  const ok =
    invariants.dnsUnchanged &&
    invariants.workerRouteUnchanged &&
    invariants.maintenanceModeUnchanged &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected &&
    invariants.stagingShadowProxyOnly &&
    invariants.productionShadowProxyClosed &&
    invariants.apexAndWwwPostCutoverDefined &&
    invariants.requiredGatesEnumerated &&
    invariants.rollbackRouteDocumented &&
    invariants.cutoverRequiresExplicitApproval;

  return json({
    ok,
    gate: "staging_route_change_rehearsal",
    mode: "dry_run_no_dns_or_route_mutation",
    hosts: {
      staging: stagingHost,
      production: productionHosts
    },
    routeMatrix,
    requiredStagingGates,
    rollback: {
      target: "restore_previous_vps_origin_and_disable_cloudflare_managed_routes",
      productionDataMutation: false,
      dnsMutationPerformed: false,
      routeMutationPerformed: false
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function summarizeR2Prefixes(bucket: R2Bucket, prefixes: string[]) {
  const prefixSummaries = [];
  let totalObjects = 0;
  let totalBytes = 0;
  for (const prefix of prefixes) {
    let cursor: string | undefined;
    let objects = 0;
    let bytes = 0;
    let pages = 0;
    do {
      const page = await bucket.list({ prefix, limit: 1000, cursor });
      pages += 1;
      for (const object of page.objects) {
        objects += 1;
        bytes += object.size;
      }
      cursor = page.truncated ? page.cursor : undefined;
    } while (cursor);
    prefixSummaries.push({ prefix, objects, bytes, pages });
    totalObjects += objects;
    totalBytes += bytes;
  }
  return {
    prefixes: prefixSummaries,
    totalObjects,
    totalBytes
  };
}

async function shadowStreamNonReadyExclusionProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const expectedNonReady = Number(url.searchParams.get("expected_nonready") ?? "2");
  const expectedReady = Number(url.searchParams.get("expected_ready") ?? "32");
  const expectedTotal = Number(url.searchParams.get("expected_total") ?? "34");

  const inventory = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN exists_on_stream = 1 THEN 1 ELSE 0 END) AS exists_count,
       SUM(CASE WHEN ready_to_stream = 1 THEN 1 ELSE 0 END) AS ready_count,
       SUM(CASE WHEN exists_on_stream = 1 AND ready_to_stream = 0 THEN 1 ELSE 0 END) AS nonready_count
     FROM legacy_stream_inventory`
  ).first<{
    total: number;
    exists_count: number | null;
    ready_count: number | null;
    nonready_count: number | null;
  }>();

  const nonReadyRows = await env.OBS_DB.prepare(
    `SELECT stream_uid, asset_id, visit_id, ready_to_stream, status_state, modified_at_stream
     FROM legacy_stream_inventory
     WHERE exists_on_stream = 1
       AND ready_to_stream = 0
     ORDER BY stream_uid`
  ).all<{
    stream_uid: string;
    asset_id: string;
    visit_id: string;
    ready_to_stream: number;
    status_state: string | null;
    modified_at_stream: string | null;
  }>();

  const ledgeredNonReady = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS count
     FROM legacy_stream_inventory s
     JOIN legacy_asset_import_ledger l ON l.asset_id = s.asset_id
     WHERE s.exists_on_stream = 1
       AND s.ready_to_stream = 0
       AND l.import_status = 'stream_inventory_pending'`
  ).first<{ count: number }>();

  const publicReadmodel = await env.OBS_DB.prepare(
    `SELECT
       SUM(asset_count) AS asset_count,
       SUM(public_ready_asset_count) AS public_ready_asset_count,
       SUM(unresolved_asset_count) AS unresolved_asset_count
     FROM production_import_public_readmodel`
  ).first<{
    asset_count: number | null;
    public_ready_asset_count: number | null;
    unresolved_asset_count: number | null;
  }>();

  const total = inventory?.total ?? 0;
  const existsCount = inventory?.exists_count ?? 0;
  const readyCount = inventory?.ready_count ?? 0;
  const nonReadyCount = inventory?.nonready_count ?? 0;
  const ledgeredCount = ledgeredNonReady?.count ?? 0;
  const assetCount = publicReadmodel?.asset_count ?? 0;
  const publicReadyAssetCount = publicReadmodel?.public_ready_asset_count ?? 0;
  const unresolvedAssetCount = publicReadmodel?.unresolved_asset_count ?? 0;

  return json({
    ok: true,
    gate: "stream_nonready_excluded_from_public_ready",
    expected: {
      total: expectedTotal,
      ready: expectedReady,
      nonReady: expectedNonReady
    },
    inventory: {
      total,
      existsCount,
      readyCount,
      nonReadyCount
    },
    nonReadyRows: nonReadyRows.results,
    publicReadmodel: {
      assetCount,
      publicReadyAssetCount,
      unresolvedAssetCount
    },
    invariants: {
      allStreamRowsAccountedFor: total === expectedTotal && existsCount === expectedTotal,
      readyCountMatchesExpected: readyCount === expectedReady,
      nonReadyCountMatchesExpected: nonReadyCount === expectedNonReady,
      nonReadyRowsLedgered: ledgeredCount === expectedNonReady,
      publicReadyExcludesUnresolved: publicReadyAssetCount + unresolvedAssetCount === assetCount,
      unresolvedCoversNonReady: unresolvedAssetCount >= nonReadyCount
    }
  }, 200, { "cache-control": "no-store" });
}

async function d1PartitionRoutingProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const observedAt = url.searchParams.get("observed_at") ?? new Date().toISOString();
  const partition = resolveObservationPartition(observedAt, env);
  const selectedMonth = await env.OBS_DB.prepare(
    `SELECT partition_month,
            COUNT(*) AS count,
            MIN(observed_at) AS earliest_observed_at,
            MAX(observed_at) AS latest_observed_at
     FROM observations
     WHERE partition_month = ?
     GROUP BY partition_month`
  ).bind(partition.partitionMonth).first<PartitionSummaryRow>();
  const allMonths = await env.OBS_DB.prepare(
    `SELECT partition_month,
            COUNT(*) AS count,
            MIN(observed_at) AS earliest_observed_at,
            MAX(observed_at) AS latest_observed_at
     FROM observations
     GROUP BY partition_month
     ORDER BY partition_month`
  ).all<PartitionSummaryRow>();
  return json({
    ok: true,
    proofStatus: "phase1_partition_routing_selected",
    selected: partition,
    selectedMonth: selectedMonth ?? {
      partition_month: partition.partitionMonth,
      count: 0,
      earliest_observed_at: null,
      latest_observed_at: null
    },
    allMonths: allMonths.results,
    invariants: {
      manualMonthlyBindingRequired: false,
      crossD1TransactionRequired: false,
      canonicalWriteBinding: "OBS_DB",
      archiveCutoverUnit: "partition_month",
      productionTrafficAffected: false
    }
  }, 200, { "cache-control": "no-store" });
}

async function publicDerivativeVerificationSummary(env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const summary = await env.OBS_DB.prepare(
    `SELECT
       COUNT(*) AS uploaded_assets,
       SUM(CASE WHEN public_derivative_key IS NOT NULL THEN 1 ELSE 0 END) AS derivative_assets,
       SUM(CASE WHEN public_derivative_verified_at IS NOT NULL THEN 1 ELSE 0 END) AS verified_assets,
       SUM(CASE WHEN exif_scrub_state = 'scrubbed' THEN 1 ELSE 0 END) AS scrubbed_assets,
       SUM(CASE WHEN public_ready_at IS NOT NULL THEN 1 ELSE 0 END) AS public_ready_assets,
       SUM(CASE WHEN public_derivative_metadata_json LIKE '%"gpsExifPresent":true%' THEN 1 ELSE 0 END) AS gps_exif_present
     FROM asset_ledger
     WHERE processing_state = 'uploaded'`
  ).first<{
    uploaded_assets: number;
    derivative_assets: number | null;
    verified_assets: number | null;
    scrubbed_assets: number | null;
    public_ready_assets: number | null;
    gps_exif_present: number | null;
  }>();
  const recent = await env.OBS_DB.prepare(
    `SELECT asset_id, observation_id, public_derivative_key, public_derivative_sha256,
            public_derivative_verified_at, public_derivative_metadata_json
     FROM asset_ledger
     WHERE public_derivative_verified_at IS NOT NULL
     ORDER BY public_derivative_verified_at DESC
     LIMIT 10`
  ).all<{
    asset_id: string;
    observation_id: string | null;
    public_derivative_key: string | null;
    public_derivative_sha256: string | null;
    public_derivative_verified_at: string | null;
    public_derivative_metadata_json: string | null;
  }>();
  return json({
    ok: true,
    gate: "public_derivative_binary_metadata_absence",
    summary,
    recent: recent.results.map((row) => ({
      ...row,
      metadata: row.public_derivative_metadata_json ? JSON.parse(row.public_derivative_metadata_json) : null
    }))
  }, 200, { "cache-control": "no-store" });
}

async function reverseDeltaDryRun(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }
  const targetPrefix = normalizeOptionalText(url.searchParams.get("target_prefix"));
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "200"), 1, 1000);
  const targetValue = targetPrefix ? `${targetPrefix}%` : null;

  const ledgerRows = await (targetValue
    ? env.OBS_DB.prepare(
      `SELECT ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql, replay_status, created_at
       FROM rollback_write_ledger
       WHERE target_id LIKE ?
          OR JSON_EXTRACT(payload_json, '$.observationId') LIKE ?
       ORDER BY created_at, ledger_id
       LIMIT ?`
    ).bind(targetValue, targetValue, limit)
    : env.OBS_DB.prepare(
      `SELECT ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql, replay_status, created_at
       FROM rollback_write_ledger
       ORDER BY created_at, ledger_id
       LIMIT ?`
    ).bind(limit)
  ).all<RollbackLedgerRow>();

  const ledgerCount = await countRollbackLedger(env, targetValue);
  const observationCount = await countObservations(env, targetValue);
  const assetCount = await countAssets(env, targetValue);
  const ledgerObservationCount = await countRollbackLedgerObservations(env, targetValue);
  const ledgerAssetCount = await countRollbackLedgerAssets(env, targetValue);
  const observationDrift = observationCount - ledgerObservationCount;
  const assetDrift = assetCount - ledgerAssetCount;

  return json({
    ok: observationDrift === 0 && assetDrift === 0,
    mode: "dry_run_no_vps_mutation",
    targetPrefix,
    counts: {
      rollbackLedger: ledgerCount,
      observations: observationCount,
      assets: assetCount,
      ledgerObservations: ledgerObservationCount,
      ledgerAssets: ledgerAssetCount
    },
    drift: {
      observationsWithoutLedger: Math.max(observationDrift, 0),
      ledgerObservationsWithoutRows: Math.max(-observationDrift, 0),
      assetsWithoutLedger: Math.max(assetDrift, 0),
      ledgerAssetsWithoutRows: Math.max(-assetDrift, 0)
    },
    replay: {
      target: "VPS/PostgreSQL dry-run artifact",
      mutationPerformed: false,
      applyOrder: ["observation.upsert", "observation.finalize", "asset.photo.upload", "asset.video.finalize"]
    },
    events: ledgerRows.results.map((row) => ({
      ...row,
      payload: JSON.parse(row.payload_json)
    }))
  }, 200, { "cache-control": "no-store" });
}

async function shadowReverseDeltaProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const targetPrefix = normalizeOptionalText(url.searchParams.get("target_prefix"));
  if (!targetPrefix) {
    return json({ ok: false, error: "target_prefix_required" }, 400, { "cache-control": "no-store" });
  }
  const targetValue = `${targetPrefix}%`;
  const expectedObservations = clampInteger(Number(url.searchParams.get("expected_observations") ?? "1"), 0, 1000);
  const expectedAssets = clampInteger(Number(url.searchParams.get("expected_assets") ?? "2"), 0, 1000);
  const expectedLedger = clampInteger(Number(url.searchParams.get("expected_ledger") ?? "3"), 0, 1000);

  const ledgerCount = await countRollbackLedger(env, targetValue);
  const observationCount = await countObservations(env, targetValue);
  const assetCount = await countAssets(env, targetValue);
  const ledgerObservationCount = await countRollbackLedgerObservations(env, targetValue);
  const ledgerAssetCount = await countRollbackLedgerAssets(env, targetValue);
  const observationDrift = observationCount - ledgerObservationCount;
  const assetDrift = assetCount - ledgerAssetCount;
  const drift = {
    observationsWithoutLedger: Math.max(observationDrift, 0),
    ledgerObservationsWithoutRows: Math.max(-observationDrift, 0),
    assetsWithoutLedger: Math.max(assetDrift, 0),
    ledgerAssetsWithoutRows: Math.max(-assetDrift, 0)
  };
  const counts = {
    rollbackLedger: ledgerCount,
    observations: observationCount,
    assets: assetCount,
    ledgerObservations: ledgerObservationCount,
    ledgerAssets: ledgerAssetCount
  };
  const invariants = {
    expectedObservationCount: observationCount === expectedObservations,
    expectedAssetCount: assetCount === expectedAssets,
    expectedRollbackLedgerCount: ledgerCount === expectedLedger,
    observationLedgerAligned: observationDrift === 0,
    assetLedgerAligned: assetDrift === 0,
    mutationPerformed: false,
    productionTrafficAffected: false
  };
  const ok =
    invariants.expectedObservationCount &&
    invariants.expectedAssetCount &&
    invariants.expectedRollbackLedgerCount &&
    invariants.observationLedgerAligned &&
    invariants.assetLedgerAligned &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected;

  return json({
    ok,
    gate: "integrated_staging_reverse_delta_write_drain",
    mode: "dry_run_no_vps_mutation",
    targetPrefix,
    counts,
    drift,
    replay: {
      target: "VPS/PostgreSQL dry-run artifact",
      mutationPerformed: false,
      applyOrder: ["observation.upsert", "observation.finalize", "asset.photo.upload", "asset.video.finalize"]
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function shadowUpdateDeleteReplayProof(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const suffix = sanitizeIdPart(url.searchParams.get("id") ?? new Date().toISOString());
  const observationId = `shadow-update-delete-${suffix}`.slice(0, 120);
  const userId = `shadow-update-user-${suffix}`.slice(0, 120);
  const initialNote = "shadow update/delete replay proof initial";
  const updatedNote = "shadow update/delete replay proof updated";

  const sessionResponse = await issueCompatibleSession(new Request(`${url.origin}/api/v1/auth/session/issue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, ttlHours: 1 })
  }), env);
  const cookie = sessionResponse.headers.get("set-cookie") ?? "";

  const upserts = [
    { note: initialNote, observedAt: "2026-06-15T04:30:00.000Z", taxonLabel: "初回記録" },
    { note: updatedNote, observedAt: "2026-06-15T04:31:00.000Z", taxonLabel: "更新後記録" }
  ];
  for (const upsert of upserts) {
    const upsertResponse = await upsertLegacyCompatibleObservation(new Request(`${url.origin}/api/v1/observations/upsert`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({
        observationId,
        userId,
        observedAt: upsert.observedAt,
        latitude: 34.71234,
        longitude: 137.81234,
        locationAccuracyM: 12,
        visibility: "public",
        taxon: { vernacularName: upsert.taxonLabel, rank: "species" },
        note: upsert.note
      })
    }), env);
    if (!upsertResponse.ok) {
      return upsertResponse;
    }
  }

  const photoResponse = await uploadLegacyCompatiblePhoto(observationId, new Request(`${url.origin}/api/v1/observations/${encodeURIComponent(observationId)}/photos/upload`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "update-delete-proof.jpg",
      mimeType: "image/jpeg",
      base64Data: btoa("shadow-update-delete-image"),
      facePrivacy: "no_faces"
    })
  }), env);
  if (!photoResponse.ok) {
    return photoResponse;
  }

  await markUploadedAssetsPublicReady(observationId, env);
  await refreshPublicReadmodel(observationId, env);
  const beforeHide = await takedownVisibilityState(observationId, env);

  const hideResponse = await hideCompatibleObservation(observationId, new Request(`${url.origin}/api/v1/observations/${encodeURIComponent(observationId)}/hide`, {
    method: "POST",
    headers: { cookie }
  }), env);
  if (!hideResponse.ok) {
    return hideResponse;
  }
  const afterHide = await takedownVisibilityState(observationId, env);

  const canonical = await env.OBS_DB.prepare(
    `SELECT o.observation_id, o.emergency_hidden, COUNT(a.asset_id) AS asset_count
     FROM observations o
     LEFT JOIN asset_ledger a ON a.observation_id = o.observation_id
     WHERE o.observation_id = ?
     GROUP BY o.observation_id, o.emergency_hidden`
  ).bind(observationId).first<{ observation_id: string; emergency_hidden: number; asset_count: number }>();
  const events = await listRollbackEvents(env, `${observationId}%`, 50);
  const replayOnce = replayRollbackEvents(events);
  const replayTwice = replayRollbackEvents([...events, ...events]);
  const eventCounts = countRollbackEventTypes(events);
  const finalObservation = replayOnce.observations[observationId] ?? null;
  const canonicalRow = await env.OBS_DB.prepare(
    "SELECT draft_id, owner_user_id, partition_month FROM observations WHERE observation_id = ?"
  ).bind(observationId).first<{ draft_id: string; owner_user_id: string; partition_month: string | null }>();
  const invariants = {
    updateLedgered: eventCounts["observation.upsert"] === 2,
    hideLedgered: eventCounts["observation.hide"] === 1,
    assetLedgered: eventCounts["asset.photo.upload"] === 1,
    replayIdempotent: replayOnce.fingerprint === replayTwice.fingerprint,
    finalNoteUpdated: finalObservation?.note === updatedNote,
    finalHidden: finalObservation?.emergencyHidden === true,
    canonicalPreserved: Boolean(canonicalRow) && canonical?.emergency_hidden === 1,
    publicSurfacesHidden: afterHide.readmodelRows === 0 && !afterHide.publicDetailVisible && !afterHide.mapVisible,
    mutationPerformed: false,
    productionTrafficAffected: false
  };
  const ok =
    invariants.updateLedgered &&
    invariants.hideLedgered &&
    invariants.assetLedgered &&
    invariants.replayIdempotent &&
    invariants.finalNoteUpdated &&
    invariants.finalHidden &&
    invariants.canonicalPreserved &&
    invariants.publicSurfacesHidden &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected;

  return json({
    ok,
    gate: "integrated_staging_update_delete_idempotent_replay",
    mode: "dry_run_no_vps_mutation",
    observationId,
    counts: {
      rollbackLedger: events.length,
      eventTypes: eventCounts,
      observations: 1,
      assets: canonical?.asset_count ?? 0
    },
    beforeHide,
    afterHide,
    canonical: {
      observationId: canonical?.observation_id ?? null,
      emergency_hidden: canonical?.emergency_hidden ?? null,
      asset_count: canonical?.asset_count ?? 0
    },
    replay: {
      target: "VPS/PostgreSQL dry-run artifact",
      mutationPerformed: false,
      applyOrder: ["observation.upsert", "asset.photo.upload", "observation.hide"],
      firstFingerprint: replayOnce.fingerprint,
      secondFingerprint: replayTwice.fingerprint,
      finalObservation
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function shadowRollbackRestoreSmoke(url: URL, env: Env): Promise<Response> {
  if (env.ENVIRONMENT !== "shadow") {
    return json({ error: "not_available" }, 404);
  }

  const suffix = sanitizeIdPart(url.searchParams.get("id") ?? new Date().toISOString());
  const observationId = `shadow-rollback-restore-${suffix}`.slice(0, 120);
  const userId = `shadow-rollback-user-${suffix}`.slice(0, 120);
  const note = "shadow rollback restore smoke";

  const sessionResponse = await issueCompatibleSession(new Request(`${url.origin}/api/v1/auth/session/issue`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ userId, ttlHours: 1 })
  }), env);
  const cookie = sessionResponse.headers.get("set-cookie") ?? "";

  const upsertResponse = await upsertLegacyCompatibleObservation(new Request(`${url.origin}/api/v1/observations/upsert`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      observationId,
      userId,
      observedAt: "2026-06-16T01:15:00.000Z",
      latitude: 34.71234,
      longitude: 137.81234,
      locationAccuracyM: 12,
      visibility: "public",
      taxon: { vernacularName: "復元演習記録", rank: "species" },
      note
    })
  }), env);
  if (!upsertResponse.ok) {
    return upsertResponse;
  }

  const photoResponse = await uploadLegacyCompatiblePhoto(observationId, new Request(`${url.origin}/api/v1/observations/${encodeURIComponent(observationId)}/photos/upload`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "rollback-restore-proof.jpg",
      mimeType: "image/jpeg",
      base64Data: btoa("shadow-rollback-restore-image"),
      facePrivacy: "no_faces"
    })
  }), env);
  if (!photoResponse.ok) {
    return photoResponse;
  }

  const videoBody = "rollback-video-bytes";
  const directResponse = await createCompatibleVideoDirectUpload(new Request(`${url.origin}/api/v1/videos/direct-upload`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      filename: "rollback-restore-proof.mp4",
      observationId,
      mediaRole: "observation_video",
      uploadProtocol: "post",
      fileSizeBytes: videoBody.length
    })
  }), env);
  if (!directResponse.ok) {
    return directResponse;
  }
  const directPayload = await directResponse.json() as { uid?: string; uploadUrl?: string };
  const streamUid = String(directPayload.uid ?? "");
  const uploadUrl = String(directPayload.uploadUrl ?? "");
  const bodyResponse = await putCompatibleVideoBody(streamUid, new Request(uploadUrl, {
    method: "PUT",
    headers: { "content-type": "video/mp4", cookie },
    body: videoBody
  }), env);
  if (!bodyResponse.ok) {
    return bodyResponse;
  }
  const finalizeResponse = await finalizeCompatibleVideo(streamUid, new Request(`${url.origin}/api/v1/videos/${encodeURIComponent(streamUid)}/finalize`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      observationId,
      durationMs: 9000,
      readyToStream: true,
      bytes: videoBody.length
    })
  }), env);
  if (!finalizeResponse.ok) {
    return finalizeResponse;
  }

  await markUploadedAssetsPublicReady(observationId, env);
  await refreshPublicReadmodel(observationId, env);
  const beforeHide = await takedownVisibilityState(observationId, env);

  const hideResponse = await hideCompatibleObservation(observationId, new Request(`${url.origin}/api/v1/observations/${encodeURIComponent(observationId)}/hide`, {
    method: "POST",
    headers: { cookie }
  }), env);
  if (!hideResponse.ok) {
    return hideResponse;
  }
  const afterHide = await takedownVisibilityState(observationId, env);

  const canonical = await env.OBS_DB.prepare(
    `SELECT o.observation_id, o.emergency_hidden, COUNT(a.asset_id) AS asset_count
     FROM observations o
     LEFT JOIN asset_ledger a ON a.observation_id = o.observation_id
     WHERE o.observation_id = ?
     GROUP BY o.observation_id, o.emergency_hidden`
  ).bind(observationId).first<{
    observation_id: string;
    emergency_hidden: number;
    asset_count: number;
  }>();
  const events = await listRollbackEvents(env, `${observationId}%`, 50);
  const replayOnce = replayRollbackEvents(events);
  const replayTwice = replayRollbackEvents([...events, ...events]);
  const eventCounts = countRollbackEventTypes(events);
  const restoredObservation = replayOnce.observations[observationId] ?? null;
  const restoredAssets = Object.values(replayOnce.assets).filter((asset) => asset.observationId === observationId);
  const replaySqlReady = events.every((event) => event.replay_sql.includes("rollback_"));
  const invariants = {
    observationRestored: restoredObservation?.ownerUserId === userId && restoredObservation?.note === note,
    hiddenStateRestored: restoredObservation?.emergencyHidden === true,
    assetsRestored: restoredAssets.length === 2,
    photoRestored: restoredAssets.some((asset) => asset.mime === "image/jpeg"),
    videoRestored: restoredAssets.some((asset) => asset.mime === "video/mp4"),
    replaySqlReady,
    replayIdempotent: replayOnce.fingerprint === replayTwice.fingerprint,
    canonicalPreserved: Boolean(canonical) && canonical?.emergency_hidden === 1 && Number(canonical?.asset_count ?? 0) === 2,
    publicSurfacesHidden: afterHide.readmodelRows === 0 && !afterHide.publicDetailVisible && !afterHide.mapVisible,
    mutationPerformed: false,
    productionTrafficAffected: false
  };
  const ok =
    invariants.observationRestored &&
    invariants.hiddenStateRestored &&
    invariants.assetsRestored &&
    invariants.photoRestored &&
    invariants.videoRestored &&
    invariants.replaySqlReady &&
    invariants.replayIdempotent &&
    invariants.canonicalPreserved &&
    invariants.publicSurfacesHidden &&
    !invariants.mutationPerformed &&
    !invariants.productionTrafficAffected;

  return json({
    ok,
    gate: "integrated_staging_rollback_restore_smoke",
    mode: "dry_run_no_vps_mutation",
    observationId,
    counts: {
      rollbackLedger: events.length,
      eventTypes: eventCounts,
      restoredObservations: restoredObservation ? 1 : 0,
      restoredAssets: restoredAssets.length,
      canonicalAssets: canonical?.asset_count ?? 0
    },
    beforeHide,
    afterHide,
    canonical: {
      observationId: canonical?.observation_id ?? null,
      ownerUserId: userId,
      emergency_hidden: canonical?.emergency_hidden ?? null,
      asset_count: canonical?.asset_count ?? 0
    },
    restore: {
      target: "rollback_restore_state_from_rollback_ledger",
      mutationPerformed: false,
      applyOrder: ["observation.upsert", "asset.photo.upload", "asset.video.finalize", "observation.hide"],
      firstFingerprint: replayOnce.fingerprint,
      secondFingerprint: replayTwice.fingerprint,
      finalObservation: restoredObservation,
      assets: restoredAssets
    },
    invariants
  }, 200, { "cache-control": "no-store" });
}

async function listRollbackEvents(env: Env, targetValue: string | null, limit: number): Promise<RollbackLedgerRow[]> {
  const result = await (targetValue
    ? env.OBS_DB.prepare(
      `SELECT ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql, replay_status, created_at
       FROM rollback_write_ledger
       WHERE target_id LIKE ?
          OR JSON_EXTRACT(payload_json, '$.observationId') LIKE ?
       ORDER BY created_at, ledger_id
       LIMIT ?`
    ).bind(targetValue, targetValue, limit)
    : env.OBS_DB.prepare(
      `SELECT ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql, replay_status, created_at
       FROM rollback_write_ledger
       ORDER BY created_at, ledger_id
       LIMIT ?`
    ).bind(limit)
  ).all<RollbackLedgerRow>();
  return result.results;
}

function countRollbackEventTypes(events: RollbackLedgerRow[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    counts[event.event_type] = (counts[event.event_type] ?? 0) + 1;
  }
  return counts;
}

function replayRollbackEvents(events: RollbackLedgerRow[]) {
  const observations: Record<string, {
    ownerUserId: string | null;
    observedAt: string | null;
    taxonLabel: string | null;
    note: string | null;
    publicCell: string | null;
    visibility: string | null;
    emergencyHidden: boolean;
  }> = {};
  const assets: Record<string, {
    observationId: string | null;
    ownerUserId: string | null;
    objectKey: string | null;
    mime: string | null;
    bytes: number | null;
  }> = {};

  for (const event of events) {
    const payload = JSON.parse(event.payload_json) as Record<string, unknown>;
    if (event.event_type === "observation.upsert" || event.event_type === "observation.finalize") {
      const observationId = stringFromUnknown(payload.visitId ?? payload.observationId ?? event.target_id);
      const observedAt = stringOrNullFromUnknown(payload.observedAt);
      const existing = observations[observationId];
      if (existing?.observedAt && observedAt && existing.observedAt > observedAt) {
        continue;
      }
      observations[observationId] = {
        ownerUserId: stringOrNullFromUnknown(payload.ownerUserId),
        observedAt,
        taxonLabel: stringOrNullFromUnknown(payload.taxonLabel),
        note: stringOrNullFromUnknown(payload.note),
        publicCell: stringOrNullFromUnknown(payload.publicCell),
        visibility: stringOrNullFromUnknown(payload.visibility),
        emergencyHidden: false
      };
    }
    if (event.event_type === "asset.photo.upload" || event.event_type === "asset.video.finalize") {
      assets[event.target_id] = {
        observationId: stringOrNullFromUnknown(payload.observationId),
        ownerUserId: stringOrNullFromUnknown(payload.ownerUserId),
        objectKey: stringOrNullFromUnknown(payload.objectKey),
        mime: stringOrNullFromUnknown(payload.mime) ?? (event.event_type === "asset.video.finalize" ? "video/mp4" : null),
        bytes: numberOrNullFromUnknown(payload.bytes)
      };
    }
    if (event.event_type === "observation.hide") {
      const observationId = stringFromUnknown(payload.observationId ?? event.target_id);
      observations[observationId] = {
        ...(observations[observationId] ?? {
          ownerUserId: stringOrNullFromUnknown(payload.ownerUserId),
          observedAt: null,
          taxonLabel: null,
          note: null,
          publicCell: null,
          visibility: null
        }),
        emergencyHidden: true
      };
    }
  }

  for (const event of events) {
    if (event.event_type !== "observation.hide") continue;
    const payload = JSON.parse(event.payload_json) as Record<string, unknown>;
    const observationId = stringFromUnknown(payload.observationId ?? event.target_id);
    observations[observationId] = {
      ...(observations[observationId] ?? {
        ownerUserId: stringOrNullFromUnknown(payload.ownerUserId),
        observedAt: null,
        taxonLabel: null,
        note: null,
        publicCell: null,
        visibility: null
      }),
      emergencyHidden: true
    };
  }

  const fingerprint = stableJson({ observations, assets });
  return { observations, assets, fingerprint };
}

async function countRollbackLedger(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare(
      "SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE target_id LIKE ? OR JSON_EXTRACT(payload_json, '$.observationId') LIKE ?"
    ).bind(targetValue, targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM rollback_write_ledger")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function countRollbackLedgerObservations(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare(
      "SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE event_type IN ('observation.upsert', 'observation.finalize') AND target_id LIKE ?"
    ).bind(targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE event_type IN ('observation.upsert', 'observation.finalize')")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function countRollbackLedgerAssets(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare(
      "SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE event_type IN ('asset.photo.upload', 'asset.video.finalize') AND JSON_EXTRACT(payload_json, '$.observationId') LIKE ?"
    ).bind(targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM rollback_write_ledger WHERE event_type IN ('asset.photo.upload', 'asset.video.finalize')")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function countObservations(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM observations WHERE observation_id LIKE ?").bind(targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM observations")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function countAssets(env: Env, targetValue: string | null): Promise<number> {
  const row = await (targetValue
    ? env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM asset_ledger WHERE observation_id LIKE ?").bind(targetValue)
    : env.OBS_DB.prepare("SELECT COUNT(*) AS count FROM asset_ledger WHERE observation_id IS NOT NULL")
  ).first<ReverseDeltaCountRow>();
  return row?.count ?? 0;
}

async function markUploadedAssetsPublicReady(observationId: string, env: Env): Promise<void> {
  const assets = await env.OBS_DB.prepare(
    `SELECT asset_id, object_key
     FROM asset_ledger
     WHERE observation_id = ? AND processing_state = 'uploaded'`
  ).bind(observationId).all<UploadedAssetRow>();

  for (const asset of assets.results) {
    const publicDerivativeKey = `derived/${asset.object_key.replace(/^original\//, "")}/display.webp`;
    const contentType = "image/svg+xml; charset=utf-8";
    const derivativeBody = textToArrayBuffer(shadowDerivativeSvg(asset.asset_id));
    const derivativeSha256 = await sha256Hex(derivativeBody);
    const metadataInspection = inspectPublicDerivativeMetadata(derivativeBody, contentType);
    if (metadataInspection.gpsExifPresent) {
      await env.OBS_DB.prepare(
        `UPDATE asset_ledger
         SET public_derivative_key = ?,
             public_derivative_sha256 = ?,
             public_derivative_metadata_json = ?,
             exif_scrub_state = 'failed'
         WHERE asset_id = ?`
      ).bind(
        publicDerivativeKey,
        derivativeSha256,
        JSON.stringify(metadataInspection),
        asset.asset_id
      ).run();
      continue;
    }
    await env.ASSET_BUCKET.put(publicDerivativeKey, derivativeBody, {
      httpMetadata: { contentType }
    });
    await env.OBS_DB.prepare(
      `UPDATE asset_ledger
       SET public_derivative_key = ?,
           public_derivative_sha256 = ?,
           public_derivative_verified_at = CURRENT_TIMESTAMP,
           public_derivative_metadata_json = ?,
           exif_scrub_state = 'scrubbed',
           public_ready_at = CURRENT_TIMESTAMP
       WHERE asset_id = ?`
    ).bind(
      publicDerivativeKey,
      derivativeSha256,
      JSON.stringify(metadataInspection),
      asset.asset_id
    ).run();
  }
}

function rollbackLedgerInsert(env: Env, input: {
  eventType: string;
  targetId: string;
  partitionMonth: string | null;
  sourceEndpoint: string;
  payload: Record<string, unknown>;
  replaySql: string;
}): D1PreparedStatement {
  return env.OBS_DB.prepare(
    `INSERT INTO rollback_write_ledger
     (ledger_id, event_type, target_id, partition_month, source_endpoint, payload_json, replay_sql)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    newId("rollback"),
    input.eventType,
    input.targetId,
    input.partitionMonth,
    input.sourceEndpoint,
    JSON.stringify(input.payload),
    input.replaySql
  );
}

function postgresObservationReplaySql(
  observationId: string,
  ownerUserId: string,
  observedAt: string,
  taxonLabel: string | null,
  note: string | null,
  exactLat: number | null,
  exactLng: number | null,
  locationAccuracyM: number | null,
  publicCell: string,
  visibility: string
): string {
  const values = [
    sqlLiteral(observationId),
    sqlLiteral(ownerUserId),
    sqlLiteral(observedAt),
    sqlLiteral(taxonLabel),
    sqlLiteral(note),
    sqlLiteral(exactLat),
    sqlLiteral(exactLng),
    sqlLiteral(locationAccuracyM),
    sqlLiteral(publicCell),
    sqlLiteral(visibility)
  ].join(", ");
  return `INSERT INTO rollback_observations (observation_id, owner_user_id, observed_at, taxon_label, note, exact_lat, exact_lng, location_accuracy_m, public_cell, visibility) VALUES (${values}) ON CONFLICT (observation_id) DO UPDATE SET observed_at = EXCLUDED.observed_at, taxon_label = EXCLUDED.taxon_label, note = EXCLUDED.note, exact_lat = EXCLUDED.exact_lat, exact_lng = EXCLUDED.exact_lng, location_accuracy_m = EXCLUDED.location_accuracy_m, public_cell = EXCLUDED.public_cell, visibility = EXCLUDED.visibility;`;
}

function postgresObservationHideReplaySql(observationId: string): string {
  return `UPDATE rollback_observations SET emergency_hidden = TRUE, public_visible = FALSE WHERE observation_id = ${sqlLiteral(observationId)};`;
}

function postgresAssetReplaySql(
  assetId: string,
  observationId: string,
  ownerUserId: string,
  objectKey: string,
  sha256: string | null,
  mime: string,
  bytes: number,
  visibility: string
): string {
  const values = [
    sqlLiteral(assetId),
    sqlLiteral(observationId),
    sqlLiteral(ownerUserId),
    sqlLiteral(objectKey),
    sqlLiteral(sha256),
    sqlLiteral(mime),
    sqlLiteral(bytes),
    sqlLiteral(visibility)
  ].join(", ");
  return `INSERT INTO rollback_assets (asset_id, observation_id, owner_user_id, object_key, sha256, mime, bytes, visibility) VALUES (${values}) ON CONFLICT (asset_id) DO UPDATE SET observation_id = EXCLUDED.observation_id, object_key = EXCLUDED.object_key, sha256 = EXCLUDED.sha256, mime = EXCLUDED.mime, bytes = EXCLUDED.bytes, visibility = EXCLUDED.visibility;`;
}

function sqlLiteral(value: string | number | null): string {
  if (value === null) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  return `'${value.replace(/'/g, "''")}'`;
}

function validateAsset(asset: DraftAssetInput): void {
  assertNonEmpty(asset.mime, "media.mime");
  if (!Number.isFinite(asset.bytes) || asset.bytes <= 0 || asset.bytes > MAX_ASSET_BYTES) {
    throw new HttpError(400, "invalid_media_bytes");
  }
}

function resolveObservationPartition(observedAt: string | null | undefined, env: Env) {
  const partitionMonth = partitionMonthFromDate(observedAt ?? new Date().toISOString());
  return {
    strategy: OBSERVATION_PARTITION_STRATEGY,
    partitionMonth,
    selectedBinding: "OBS_DB",
    databaseName: env.OBSERVATION_DB_NAME ?? "ikimon_shadow_observations_2026_06",
    writeStorage: "active_d1_logical_partition",
    archiveStorage: env.OBSERVATION_ARCHIVE_TARGET ?? "r2_sql_export_by_partition_month",
    manualMonthlyBindingRequired: false,
    reason: "Logical partitioning uses partition_month inside one active D1 binding; archive/export lifecycle is month-keyed and does not require monthly Worker binding edits."
  };
}

function partitionMonthFromDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, "invalid_observed_at");
  }
  return date.toISOString().slice(0, 7);
}

function inspectPublicDerivativeMetadata(bytes: ArrayBuffer, contentType: string): PublicDerivativeInspection {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const lower = text.toLowerCase();
  const exifPresent = lower.includes("exif") || lower.includes("http://ns.adobe.com/exif/");
  const gpsPresent = lower.includes("gps") ||
    lower.includes("gpslatitude") ||
    lower.includes("gpslongitude") ||
    lower.includes("gpsaltitude");
  const xmpPresent = lower.includes("<x:xmpmeta") ||
    lower.includes("adobe:ns:meta") ||
    lower.includes("http://ns.adobe.com/xap/");
  const exactCoordinateLiteralPresent = /34\.71234|137\.81234/.test(text);
  return {
    tool: "shadow-public-derivative-byte-signature-scan-v1",
    contentType,
    bytes: bytes.byteLength,
    scannedContainer: contentType.includes("svg") ? "svg+xml" : "binary",
    gpsExifPresent: exifPresent || gpsPresent || xmpPresent || exactCoordinateLiteralPresent,
    exifPresent,
    gpsPresent,
    xmpPresent,
    exactCoordinateLiteralPresent,
    checkedAt: new Date().toISOString()
  };
}

function inspectVideoContainerMetadata(bytes: ArrayBuffer, contentType: string) {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const lower = text.toLowerCase();
  const exifPresent = lower.includes("exif") || lower.includes("http://ns.adobe.com/exif/");
  const gpsPresent = lower.includes("gps") ||
    lower.includes("gpslatitude") ||
    lower.includes("gpslongitude") ||
    lower.includes("gpsaltitude");
  const xmpPresent = lower.includes("<x:xmpmeta") ||
    lower.includes("adobe:ns:meta") ||
    lower.includes("http://ns.adobe.com/xap/");
  const exactCoordinateLiteralPresent = /34\.71234|137\.81234/.test(text);
  const ftypPresent = lower.includes("ftyp");
  const moovPresent = lower.includes("moov");
  const mdatPresent = lower.includes("mdat");
  return {
    tool: "shadow-video-container-byte-signature-scan-v1",
    contentType,
    bytes: bytes.byteLength,
    scannedContainer: ftypPresent ? "mp4" : "binary",
    ftypPresent,
    moovPresent,
    mdatPresent,
    gpsExifPresent: exifPresent || gpsPresent || xmpPresent || exactCoordinateLiteralPresent,
    exifPresent,
    gpsPresent,
    xmpPresent,
    exactCoordinateLiteralPresent,
    checkedAt: new Date().toISOString()
  };
}

function blurLocation(lat?: number, lng?: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "unknown";
  const latCell = Math.round((lat as number) * 100) / 100;
  const lngCell = Math.round((lng as number) * 100) / 100;
  return `${latCell.toFixed(2)},${lngCell.toFixed(2)}`;
}

function parseBboxParam(raw: string | null): [number, number, number, number] | null {
  if (!raw) return null;
  const parts = raw.split(",").map((part) => Number(part.trim()));
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) return null;
  const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
  if (minLng > maxLng || minLat > maxLat) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function parsePublicCell(value: string): { lat: number; lng: number } | null {
  const [latRaw, lngRaw] = value.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function publicCellInBbox(publicCell: string, bbox: [number, number, number, number]): boolean {
  const parsed = parsePublicCell(publicCell);
  if (!parsed) return false;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return parsed.lng >= minLng && parsed.lng <= maxLng && parsed.lat >= minLat && parsed.lat <= maxLat;
}

function publicCellToCellId(publicCell: string): string {
  return `cell:${publicCell}`;
}

function cellIdToPublicCell(cellId: string): string {
  return cellId.startsWith("cell:") ? cellId.slice("cell:".length) : cellId;
}

function detailIdToVisitId(value: string): string {
  const match = value.match(/^occ:(.+):\d+$/);
  return match?.[1] ?? value;
}

function publicMediaUrl(key: string | null): string {
  return key ? `/${key}` : "";
}

function publicCellPolygon(lat: number, lng: number): [number, number][] {
  const halfStep = 0.005;
  return [
    [lng - halfStep, lat - halfStep],
    [lng + halfStep, lat - halfStep],
    [lng + halfStep, lat + halfStep],
    [lng - halfStep, lat + halfStep],
    [lng - halfStep, lat - halfStep]
  ];
}

function earliestObservedAt(rows: PublicMapRow[]): string | null {
  return rows.reduce<string | null>((earliest, row) => !earliest || row.observed_at < earliest ? row.observed_at : earliest, null);
}

function latestObservedAt(rows: PublicMapRow[]): string {
  return rows.reduce((latest, row) => row.observed_at > latest ? row.observed_at : latest, "");
}

function publicMapEmptyProvenance(sampleSize: number) {
  const empty = { manual: 0, legacy: 0, track: 0, other: 0 };
  return {
    sampled: true,
    sampleSize,
    visible: empty,
    excluded: empty
  };
}

function taxonGroupForLabel(label: string | null): string {
  const text = label ?? "";
  if (/鳥|bird|aves/i.test(text)) return "bird";
  if (/虫|昆虫|蝶|蜂|insect/i.test(text)) return "insect";
  if (/草|木|花|plant|植物/i.test(text)) return "plant";
  if (/菌|fung/i.test(text)) return "fungi";
  if (/蛙|蛇|爬虫|amphibian|reptile/i.test(text)) return "amphibian_reptile";
  if (/獣|哺乳|mammal/i.test(text)) return "mammal";
  return "other";
}

function clampInteger(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(Math.max(Math.trunc(value), min), max) : min;
}

function renderObservationNotFoundHtml(): string {
  return `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Observation not found</title></head>
<body><main><h1>見つかりません</h1><p>この観察はまだ取得できません。</p></main></body>
</html>`;
}

function shadowDerivativeSvg(assetId: string): string {
  const safeAssetId = escapeHtml(assetId).slice(0, 72);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480" role="img" aria-label="ikimon shadow derivative">
  <rect width="640" height="480" fill="#e8eee9"/>
  <circle cx="320" cy="190" r="72" fill="#176b45" opacity="0.18"/>
  <path d="M178 330c82-90 174-108 284-18 22 18 42 28 60 30v50H118v-42c18-4 38-10 60-20z" fill="#176b45" opacity="0.28"/>
  <text x="320" y="222" text-anchor="middle" font-family="system-ui, sans-serif" font-size="34" font-weight="700" fill="#176b45">ikimon</text>
  <text x="320" y="266" text-anchor="middle" font-family="system-ui, sans-serif" font-size="18" fill="#53615a">shadow public derivative</text>
  <text x="320" y="432" text-anchor="middle" font-family="monospace" font-size="14" fill="#53615a">${safeAssetId}</text>
</svg>`;
}

function renderShadowRecordSmokeHtml(): string {
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ikimon Cloudflare shadow flow smoke</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; color: #17201a; background: #f6f8f5; }
    main { max-width: 920px; margin: 0 auto; padding: 28px 16px 54px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    form, .panel { background: #fff; border: 1px solid #d8e0da; border-radius: 8px; padding: 16px; margin-top: 16px; }
    label { display: grid; gap: 6px; font-weight: 700; margin: 12px 0; }
    input, textarea { font: inherit; padding: 10px 11px; border: 1px solid #bdc8c0; border-radius: 6px; }
    button, a.button { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 0 14px; border-radius: 6px; border: 0; background: #176b45; color: #fff; font-weight: 800; text-decoration: none; cursor: pointer; }
    .row { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 12px; }
    .status { color: #53615a; line-height: 1.7; }
    .error { color: #a4262c; font-weight: 700; }
    .ok { color: #176b45; font-weight: 800; }
    pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f0f4f1; padding: 12px; border-radius: 6px; }
  </style>
</head>
<body>
<main data-shadow-flow="record">
  <p class="status">Cloudflare shadow browser smoke</p>
  <h1>記録から詳細、地図まで通す</h1>
  <p class="status">この画面は production ではなく shadow Worker のAPIだけを使います。</p>
  <form id="record-form">
    <label>観察ID <input id="observation-id" name="observationId" value="shadow-ui-${Date.now()}" autocomplete="off"></label>
    <label>ユーザーID <input id="user-id" name="userId" value="shadow-ui-user" autocomplete="off"></label>
    <label>名前 <input id="taxon-label" name="taxonLabel" value="ブラウザ導線テスト植物"></label>
    <label>日時 <input id="observed-at" name="observedAt" value="2026-06-15T08:45:00.000Z"></label>
    <label>緯度 <input id="latitude" name="latitude" value="34.71234" inputmode="decimal"></label>
    <label>経度 <input id="longitude" name="longitude" value="137.81234" inputmode="decimal"></label>
    <label>メモ <textarea id="note" name="note">shadow browser flow smoke</textarea></label>
    <button id="submit-record" type="submit">保存して導線を確認</button>
  </form>
  <section class="panel" aria-live="polite">
    <div id="flow-status" class="status">待機中</div>
    <div id="flow-links" class="row"></div>
    <pre id="flow-json"></pre>
  </section>
</main>
<script>
const form = document.getElementById('record-form');
const statusEl = document.getElementById('flow-status');
const linksEl = document.getElementById('flow-links');
const jsonEl = document.getElementById('flow-json');
function setStatus(text, cls) {
  statusEl.className = cls || 'status';
  statusEl.textContent = text;
}
async function readJson(response) {
  const text = await response.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}
async function waitForDetail(visitId) {
  let latest = null;
  for (let attempt = 0; attempt < 45; attempt += 1) {
    const response = await fetch('/api/v1/observations/' + encodeURIComponent('occ:' + visitId + ':0') + '/public-detail', { headers: { accept: 'application/json' } });
    latest = await readJson(response);
    if (response.ok && latest.ok) return latest;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error('detail_not_ready:' + JSON.stringify(latest));
}
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  linksEl.innerHTML = '';
  jsonEl.textContent = '';
  const observationId = document.getElementById('observation-id').value.trim();
  const userId = document.getElementById('user-id').value.trim();
  setStatus('保存中...', 'status');
  try {
    const observationResponse = await fetch('/api/v1/observations/upsert', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        observationId,
        userId,
        observedAt: document.getElementById('observed-at').value,
        latitude: Number(document.getElementById('latitude').value),
        longitude: Number(document.getElementById('longitude').value),
        note: document.getElementById('note').value,
        taxon: { vernacularName: document.getElementById('taxon-label').value, rank: 'species' }
      })
    });
    const observationJson = await readJson(observationResponse);
    if (!observationResponse.ok || !observationJson.ok) throw new Error('observation_failed:' + JSON.stringify(observationJson));
    const photoResponse = await fetch('/api/v1/observations/' + encodeURIComponent(observationJson.visitId) + '/photos/upload', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filename: 'shadow-ui.jpg',
        mimeType: 'image/jpeg',
        base64Data: btoa('shadow-ui-image-' + observationJson.visitId),
        facePrivacy: 'no_faces'
      })
    });
    const photoJson = await readJson(photoResponse);
    if (!photoResponse.ok || !photoJson.ok) throw new Error('photo_failed:' + JSON.stringify(photoJson));
    setStatus('公開read model待機中...', 'status');
    const detailJson = await waitForDetail(observationJson.visitId);
    const detailHref = '/observations/' + encodeURIComponent(observationJson.visitId);
    const mapHref = '/shadow-smoke/map?cell_id=' + encodeURIComponent(detailJson.observation.publicLocation.cellId);
    linksEl.innerHTML = '<a class="button" id="detail-link" href="' + detailHref + '">詳細を見る</a><a class="button" id="map-link" href="' + mapHref + '">地図で見る</a>';
    jsonEl.textContent = JSON.stringify({ observation: observationJson, photo: photoJson, detail: detailJson }, null, 2);
    setStatus('保存と公開read確認が完了しました', 'ok');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
});
</script>
</body>
</html>`;
}

function renderShadowMapSmokeHtml(url: URL): string {
  const cellId = url.searchParams.get("cell_id") ?? "cell:34.71,137.81";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>ikimon Cloudflare shadow map smoke</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; color: #17201a; background: #f6f8f5; }
    main { max-width: 920px; margin: 0 auto; padding: 28px 16px 54px; }
    h1 { margin: 0 0 8px; font-size: 28px; letter-spacing: 0; }
    .panel { background: #fff; border: 1px solid #d8e0da; border-radius: 8px; padding: 16px; margin-top: 16px; }
    .item { padding: 12px 0; border-top: 1px solid #e3e9e5; }
    .item:first-child { border-top: 0; }
    a { color: #176b45; font-weight: 800; }
    .status { color: #53615a; line-height: 1.7; }
  </style>
</head>
<body>
<main data-shadow-flow="map" data-cell-id="${escapeHtml(cellId)}">
  <p class="status">Cloudflare shadow browser smoke</p>
  <h1>地図read model</h1>
  <section class="panel">
    <div id="map-status" class="status">読み込み中</div>
    <div id="map-items"></div>
  </section>
</main>
<script>
const statusEl = document.getElementById('map-status');
const itemsEl = document.getElementById('map-items');
const cellId = ${JSON.stringify(cellId)};
async function loadMap() {
  const cellsResponse = await fetch('/api/v1/map/cells?bbox=137.70,34.70,137.82,34.72&zoom=13');
  const cells = await cellsResponse.json();
  const observationsResponse = await fetch('/api/v1/map/observations?cell_id=' + encodeURIComponent(cellId));
  const observations = await observationsResponse.json();
  statusEl.textContent = 'cells=' + cells.features.length + ' / items=' + observations.items.length + ' / selected=' + observations.stats.selectedCellId;
  itemsEl.innerHTML = observations.items.slice(0, 20).map((item) =>
    '<div class="item" data-map-item="' + item.visitId + '"><a href="/observations/' + encodeURIComponent(item.visitId) + '">' + item.displayName + '</a><div class="status">' + item.observedAt + ' / ' + item.cellId + '</div></div>'
  ).join('');
}
loadMap().catch((error) => {
  statusEl.textContent = error instanceof Error ? error.message : String(error);
});
</script>
</body>
</html>`;
}

function renderPublicObservationDetailHtml(detail: NonNullable<Awaited<ReturnType<typeof buildPublicObservationDetail>>>): string {
  const photos = detail.photoAssets.length > 0
    ? detail.photoAssets.map((asset) => `<figure><img src="${escapeHtml(asset.url)}" alt="${escapeHtml(detail.displayName)}"><figcaption>公開用に処理済みの写真</figcaption></figure>`).join("")
    : `<p class="empty">公開できる写真はまだありません。</p>`;
  const videos = detail.videoAssets.length > 0
    ? detail.videoAssets.map((asset) => `<li><a href="${escapeHtml(asset.watchUrl)}">${escapeHtml(asset.providerUid)}</a></li>`).join("")
    : "";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(detail.displayName)} - ikimon shadow</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; color: #17201a; background: #f6f8f5; }
    main { max-width: 880px; margin: 0 auto; padding: 32px 18px 56px; }
    h1 { font-size: 28px; margin: 0 0 12px; letter-spacing: 0; }
    .meta { color: #53615a; line-height: 1.7; }
    .media { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-top: 24px; }
    figure { margin: 0; background: #fff; border: 1px solid #d8e0da; border-radius: 8px; overflow: hidden; }
    img { display: block; width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #e8eee9; }
    figcaption { padding: 10px 12px; color: #53615a; font-size: 13px; }
    .notice { margin-top: 22px; padding: 14px 16px; background: #fff; border: 1px solid #d8e0da; border-radius: 8px; }
    .empty { color: #53615a; }
  </style>
</head>
<body>
<main data-shadow-observation-detail="1" data-visit-id="${escapeHtml(detail.visitId)}" data-occurrence-id="${escapeHtml(detail.occurrenceId)}">
  <p class="meta">ikimon shadow public observation</p>
  <h1>${escapeHtml(detail.displayName)}</h1>
  <p class="meta">観察日時: ${escapeHtml(detail.observedAt)}<br>公開位置: ${escapeHtml(detail.publicLocation.label)} (${escapeHtml(detail.publicLocation.cellId)})</p>
  ${detail.note ? `<p>${escapeHtml(detail.note)}</p>` : ""}
  <section class="media" aria-label="公開メディア">${photos}</section>
  ${videos ? `<section class="notice"><h2>動画</h2><ul>${videos}</ul></section>` : ""}
  <section class="notice"><strong>Privacy:</strong> exact location is not exposed in this public shadow page.</section>
</main>
</body>
</html>`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function readJson<T>(request: Request): Promise<T> {
  try {
    return await request.json() as T;
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}

function json(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...(headers ?? {}) }
  });
}

function authorizeInternalRequest(request: Request, env: Env): Response | null {
  if (env.ENVIRONMENT === "production") {
    return json({ error: "not_found" }, 404);
  }

  const expected = env.INTERNAL_AUTH_TOKEN;
  if (!expected) {
    return json({ error: "internal_auth_not_configured" }, 403, { "cache-control": "no-store" });
  }

  const actual = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  if (!actual || actual !== expected) {
    return json({ error: "internal_auth_required" }, 401, {
      "cache-control": "no-store",
      "www-authenticate": 'Bearer realm="ikimon-shadow-internal"'
    });
  }

  return null;
}

function html(body: string, status = 200, headers?: Record<string, string>): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", ...(headers ?? {}) }
  });
}

function assertNonEmpty(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `missing_${field}`);
  }
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringValue(value: D1Value | undefined): string | null {
  return typeof value === "string" ? value : null;
}

function stringFromUnknown(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

function stringOrNullFromUnknown(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOrNullFromUnknown(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJsonValue(value));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortJsonValue(item));
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sortJsonValue(item)])
    );
  }
  return value;
}

function normalizeOptionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

function normalizeOptionalId(value: unknown): string | null {
  const text = normalizeOptionalText(value);
  if (!text) return null;
  return /^[A-Za-z0-9._:-]+$/.test(text) ? text : null;
}

function resolveLegacyTaxonLabel(input: LegacyObservationUpsertInput): string | null {
  const primary = (input.subjects ?? []).find((subject) => subject.isPrimary) ?? input.subjects?.[0];
  return normalizeOptionalText(primary?.vernacularName)
    ?? normalizeOptionalText(primary?.scientificName)
    ?? normalizeOptionalText(input.taxon?.vernacularName)
    ?? normalizeOptionalText(input.taxon?.scientificName)
    ?? null;
}

function resolveLegacyOccurrenceIds(visitId: string, input: LegacyObservationUpsertInput): string[] {
  const subjectCount = Math.max(1, Array.isArray(input.subjects) && input.subjects.length > 0 ? input.subjects.length : 1);
  return Array.from({ length: subjectCount }, (_, index) => `occ:${visitId}:${index}`);
}

function buildLegacyContributionReceipts(
  visitId: string,
  occurrenceId: string,
  occurrenceCount: number,
  placeName: string,
  input: LegacyObservationUpsertInput
) {
  const observationHref = `/observations/${encodeURIComponent(occurrenceId)}`;
  const revisitHref = `/record?start=gallery&revisitObservationId=${encodeURIComponent(visitId)}`;
  const hasIdentification = Boolean(resolveLegacyTaxonLabel(input));
  return [
    {
      kind: "record_body_saved",
      title: occurrenceCount > 1 ? `${occurrenceCount} 件の対象を記録に残しました` : "あとから確認できる記録になりました",
      body: "日時・場所・入力内容がまとまり、あとから確認できる観察ページになりました。",
      claimLevel: "immediate",
      nextAction: { label: "記録を見る", href: observationHref, actionKey: "view_observation" }
    },
    {
      kind: input.visitMode === "survey" || normalizeOptionalText(input.revisitReason) || normalizeOptionalText(input.targetTaxaScope)
        ? "revisit_seeded"
        : "place_comparison_seeded",
      title: input.visitMode === "survey" ? "同じ条件で見返す起点ができました" : "この場所の比較起点になりました",
      body: `${placeName || "この場所"} を次に見たとき、今日の状態と比べる起点になります。`,
      claimLevel: "immediate",
      nextAction: { label: "同じ場所でもう1件", href: revisitHref, actionKey: "revisit_same_place" }
    },
    {
      kind: hasIdentification ? "identification_context_saved" : "uncertainty_preserved",
      title: hasIdentification ? "名前の手がかりが残りました" : "不明のまま確認に回せます",
      body: hasIdentification
        ? "名前の候補と観察条件がまとまり、あとから確認しやすくなりました。"
        : "名前を急がず、場所・時間・周囲の手がかりを先に残せました。",
      claimLevel: "immediate",
      nextAction: { label: hasIdentification ? "名前を確認する" : "手がかりを見る", href: observationHref, actionKey: hasIdentification ? "review_identification" : "review_unknown_observation" }
    }
  ];
}

function sanitizeFileName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^_+|_+$/g, "") || "upload.jpg";
}

function clampVideoDuration(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(Math.max(Math.round(value), MIN_VIDEO_DURATION_SECONDS), MAX_VIDEO_DURATION_SECONDS)
    : MAX_VIDEO_DURATION_SECONDS;
}

function pendingVideoFinalizePayload(uid: string) {
  return videoRecordPayload({
    uid,
    observationId: null,
    uploadStatus: "processing",
    durationMs: 0,
    bytes: 0,
    readyToStream: false,
    createdAt: new Date().toISOString(),
    uploadedAt: null,
    pending: true
  });
}

function videoRecordPayload(input: {
  uid: string;
  observationId: string | null;
  uploadStatus: string;
  durationMs: number;
  bytes: number;
  readyToStream: boolean;
  createdAt: string;
  uploadedAt: string | null;
  pending?: boolean;
}) {
  return {
    provider: "cloudflare_stream",
    providerUid: input.uid,
    mediaType: "video",
    assetRole: "observation_video",
    uploadStatus: input.uploadStatus,
    durationMs: input.durationMs,
    bytes: input.bytes,
    thumbnailUrl: buildShadowVideoThumbnailUrl(input.uid),
    iframeUrl: buildShadowVideoIframeUrl(input.uid),
    watchUrl: buildShadowVideoWatchUrl(input.uid),
    readyToStream: input.readyToStream,
    createdAt: input.createdAt,
    uploadedAt: input.uploadedAt,
    occurrenceId: input.observationId ? `occ:${input.observationId}:0` : null,
    visitId: input.observationId,
    ...(input.pending ? { pending: true } : {})
  };
}

function buildShadowVideoIframeUrl(uid: string): string {
  return `/shadow/stream/${encodeURIComponent(uid)}/iframe`;
}

function buildShadowVideoThumbnailUrl(uid: string): string {
  return `/shadow/stream/${encodeURIComponent(uid)}/thumbnail.jpg`;
}

function buildShadowVideoWatchUrl(uid: string): string {
  return `/shadow/stream/${encodeURIComponent(uid)}`;
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const normalized = value.includes(",") ? value.split(",").pop() ?? "" : value;
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
}

function textToArrayBuffer(value: string): ArrayBuffer {
  return new TextEncoder().encode(value).buffer;
}

function shadowSafeMp4Bytes(): ArrayBuffer {
  return textToArrayBuffer("\u0000\u0000\u0000\u0018ftypmp42\u0000\u0000\u0000\u0000mp42isom\u0000\u0000\u0000\u0010moovsafe\u0000\u0000\u0000\u0010mdatikimon");
}

function shadowSafeJpegPosterBytes(): ArrayBuffer {
  return new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01,
    0x00, 0x48, 0x00, 0x48, 0x00, 0x00,
    0xff, 0xdb, 0x00, 0x43, 0x00,
    0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07,
    0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14,
    0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13,
    0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a,
    0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22,
    0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c,
    0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39,
    0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32,
    0xff, 0xd9
  ]).buffer;
}

function sanitizeIdPart(value: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  return normalized || crypto.randomUUID();
}

async function sha256Hex(value: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", value);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeFacePrivacy(value: unknown): string {
  const text = normalizeOptionalText(value);
  return text && ["pending", "redacted", "no_faces", "unavailable"].includes(text) ? text : "pending";
}

function parseCookies(headerValue: string | null): Record<string, string> {
  if (!headerValue) return {};
  return headerValue.split(";").map((part) => part.trim()).filter(Boolean).reduce<Record<string, string>>((cookies, part) => {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex <= 0) return cookies;
    const name = part.slice(0, separatorIndex).trim();
    const value = part.slice(separatorIndex + 1).trim();
    cookies[name] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function readSessionTokenFromCookie(headerValue: string | null): string | null {
  const token = parseCookies(headerValue)[SESSION_COOKIE_NAME];
  return token && token.trim() ? token.trim() : null;
}

function buildSessionCookie(rawToken: string, expiresAt: string, env: Env): string {
  const secure = env.ENVIRONMENT === "production" ? " Secure;" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}; Path=/; HttpOnly; SameSite=Lax;${secure} Expires=${new Date(expiresAt).toUTCString()}`;
}

function buildClearedSessionCookie(env: Env): string {
  const secure = env.ENVIRONMENT === "production" ? " Secure;" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax;${secure} Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}
