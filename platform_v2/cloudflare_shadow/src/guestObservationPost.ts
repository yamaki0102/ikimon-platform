import type { Env } from "./core/env";
import {
  assertSameOriginRequest,
  base64ToArrayBuffer,
  finiteNumberOrNull,
  json,
  normalizeOptionalText,
  readJson,
  sanitizeFileName,
  sha256Hex,
} from "./core/http";
import {
  commitGuestReservation,
  findActiveGuestPass,
  guestAdmit,
  isGuestPostingEnabled,
  normalizeGuestDestination,
  releaseGuestReservation,
} from "./guestPosting";

const PHOTO_EXTENSIONS: Readonly<Record<string, readonly string[]>> = {
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
  "image/heic": ["heic"],
  "image/heif": ["heif"],
  "image/avif": ["avif"],
};

function detectPhotoMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    const brand = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!).toLowerCase();
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (["heic", "heix", "hevc", "hevx"].includes(brand)) return "image/heic";
    if (["mif1", "msf1", "heif"].includes(brand)) return "image/heif";
  }
  return null;
}

function validateGuestPhoto(bytes: Uint8Array, declaredMime: string, filename: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(PHOTO_EXTENSIONS, declaredMime)) {
    return "unsupported_image_type";
  }
  const detected = detectPhotoMime(bytes);
  if (!detected || detected !== declaredMime) {
    return "image_content_type_mismatch";
  }
  const ext = filename.includes(".") ? filename.split(".").pop()?.toLowerCase() ?? "" : "";
  if (!ext || !PHOTO_EXTENSIONS[declaredMime]?.includes(ext)) {
    return "image_extension_mismatch";
  }
  return null;
}

function partitionMonthFromIso(iso: string): string {
  const m = iso.match(/^(\d{4}-\d{2})/);
  return m?.[1] ?? new Date().toISOString().slice(0, 7);
}

/**
 * Create a private guest observation owned by `guest:<passId>`.
 * Guest posts are never published to `readmodel_public_observations`.
 */
export async function handleCreateGuestObservation(request: Request, env: Env): Promise<Response> {
  if (!isGuestPostingEnabled(env)) {
    return json({ ok: false, error: "guest_posting_disabled" }, 404, { "cache-control": "no-store" });
  }
  const sameOriginError = assertSameOriginRequest(request);
  if (sameOriginError) return sameOriginError;

  const body = await readJson<{
    destinationKind?: unknown;
    destinationId?: unknown;
    observedAt?: unknown;
    taxonLabel?: unknown;
    note?: unknown;
    latitude?: unknown;
    longitude?: unknown;
  }>(request);

  const dest = normalizeGuestDestination(body.destinationKind, body.destinationId);
  if (!dest) {
    return json({ ok: false, error: "invalid_destination" }, 400, { "cache-control": "no-store" });
  }

  const admit = await guestAdmit(env.OBS_DB, request, dest);
  if (!admit.admitted) {
    return json({ ok: false, error: admit.error }, admit.status, { "cache-control": "no-store" });
  }

  const nowMs = Date.now();
  const observedAtRaw = normalizeOptionalText(body.observedAt);
  const observedAt = observedAtRaw && !Number.isNaN(Date.parse(observedAtRaw))
    ? new Date(observedAtRaw).toISOString()
    : new Date(nowMs).toISOString();
  const partitionMonth = partitionMonthFromIso(observedAt);
  const taxonLabel = normalizeOptionalText(body.taxonLabel)?.slice(0, 120) ?? null;
  const note = normalizeOptionalText(body.note)?.slice(0, 2000) ?? null;
  const latitude = finiteNumberOrNull(body.latitude);
  const longitude = finiteNumberOrNull(body.longitude);

  const observationId = `obs_guest_${crypto.randomUUID()}`;
  const draftId = `draft_guest_${crypto.randomUUID()}`;

  try {
    await env.OBS_DB.batch([
      env.OBS_DB.prepare(
        `INSERT INTO draft_observations
         (draft_id, owner_user_id, observed_at, exact_lat, exact_lng, location_accuracy_m, public_cell, visibility, processing_state, finalized_at)
         VALUES (?, ?, ?, ?, ?, NULL, 'private', 'private', 'finalized', CURRENT_TIMESTAMP)`
      ).bind(draftId, admit.ownerKey, observedAt, latitude, longitude),
      env.OBS_DB.prepare(
        `INSERT INTO observations
         (observation_id, draft_id, owner_user_id, observed_at, taxon_label, note, exact_lat, exact_lng,
          location_accuracy_m, public_cell, visibility, partition_month, processing_state)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'private', 'private', ?, 'accepted')`
      ).bind(observationId, draftId, admit.ownerKey, observedAt, taxonLabel, note, latitude, longitude, partitionMonth),
      env.OBS_DB.prepare(
        `INSERT INTO guest_pass_audit_events (event_id, pass_id, event_type, actor_type, detail_json, created_at)
         VALUES (?, ?, 'observation_created', 'guest', ?, ?)`
      ).bind(`gpa_${crypto.randomUUID()}`, admit.passId, JSON.stringify({ observationId, destination: admit.destinationKey }), nowMs),
    ]);
    await commitGuestReservation(env.OBS_DB, admit.reservationId, admit.destinationKey, nowMs);
  } catch (error) {
    await releaseGuestReservation(env.OBS_DB, admit.reservationId, admit.destinationKey, Date.now()).catch(() => undefined);
    throw error;
  }

  return json(
    {
      ok: true,
      observationId,
      ownerKey: admit.ownerKey,
      visibility: "private",
      inspectionStatus: "pending",
      destinationKey: admit.destinationKey,
      observedAt,
    },
    201,
    { "cache-control": "no-store" }
  );
}

/**
 * Attach a photo to a guest's own observation and mark it `pending_inspection`.
 */
export async function handleUploadGuestObservationPhoto(
  observationId: string,
  request: Request,
  env: Env
): Promise<Response> {
  if (!isGuestPostingEnabled(env)) {
    return json({ ok: false, error: "guest_posting_disabled" }, 404, { "cache-control": "no-store" });
  }
  const sameOriginError = assertSameOriginRequest(request);
  if (sameOriginError) return sameOriginError;

  const pass = await findActiveGuestPass(env.OBS_DB, request);
  if (!pass) {
    return json({ ok: false, error: "guest_pass_required" }, 401, { "cache-control": "no-store" });
  }
  const ownerKey = `guest:${pass.pass_id}`;

  const obs = await env.OBS_DB.prepare(
    "SELECT observation_id, draft_id, owner_user_id, partition_month FROM observations WHERE observation_id = ? LIMIT 1"
  ).bind(observationId).first<{ observation_id: string; draft_id: string; owner_user_id: string; partition_month: string | null }>();
  if (!obs) {
    return json({ ok: false, error: "observation_not_found" }, 404, { "cache-control": "no-store" });
  }
  if (obs.owner_user_id !== ownerKey) {
    return json({ ok: false, error: "forbidden" }, 403, { "cache-control": "no-store" });
  }

  const input = await readJson<{ mimeType?: unknown; filename?: unknown; base64Data?: unknown }>(request);
  const mimeType = (normalizeOptionalText(input.mimeType) ?? "image/jpeg").split(";", 1)[0]!.trim().toLowerCase();
  const filename = sanitizeFileName(normalizeOptionalText(input.filename) ?? "upload.jpg");
  const rawBuffer = base64ToArrayBuffer(normalizeOptionalText(input.base64Data) ?? "");
  if (rawBuffer.byteLength === 0) {
    return json({ ok: false, error: "decoded_image_is_empty" }, 400, { "cache-control": "no-store" });
  }
  if (rawBuffer.byteLength > 10 * 1024 * 1024) {
    return json({ ok: false, error: "image_too_large" }, 400, { "cache-control": "no-store" });
  }
  const validationError = validateGuestPhoto(new Uint8Array(rawBuffer), mimeType, filename);
  if (validationError) {
    return json({ ok: false, error: validationError }, 415, { "cache-control": "no-store" });
  }

  const sha256 = await sha256Hex(rawBuffer);
  const assetId = `asset_guest_${crypto.randomUUID()}`;
  const objectKey = `original/guest/${observationId}/${assetId}-${filename}`;
  const partitionMonth = obs.partition_month ?? partitionMonthFromIso(new Date().toISOString());
  const outboxId = `outbox_${assetId}_media`;

  await env.ASSET_BUCKET.put(objectKey, rawBuffer, {
    httpMetadata: { contentType: mimeType },
  });

  try {
    await env.OBS_DB.batch([
      env.OBS_DB.prepare(
        `INSERT INTO asset_ledger
         (asset_id, draft_id, observation_id, owner_user_id, object_key, sha256, mime, bytes, visibility, processing_state, uploaded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'private', 'pending_inspection', CURRENT_TIMESTAMP)`
      ).bind(assetId, obs.draft_id, observationId, ownerKey, objectKey, sha256, mimeType, rawBuffer.byteLength),
      env.OBS_DB.prepare(
        "INSERT INTO outbox (outbox_id, topic, target_id, payload_json, partition_month) VALUES (?, 'media.process', ?, ?, ?)"
      ).bind(outboxId, observationId, JSON.stringify({ observationId, assetId, guestInspection: true }), partitionMonth),
      env.OBS_DB.prepare(
        `INSERT INTO guest_pass_audit_events (event_id, pass_id, event_type, actor_type, detail_json, created_at)
         VALUES (?, ?, 'photo_uploaded', 'guest', ?, ?)`
      ).bind(`gpa_${crypto.randomUUID()}`, pass.pass_id, JSON.stringify({ observationId, assetId }), Date.now()),
    ]);
  } catch (error) {
    await env.ASSET_BUCKET.delete(objectKey).catch(() => undefined);
    throw error;
  }

  return json(
    {
      ok: true,
      observationId,
      assetId,
      visibility: "private",
      processingState: "pending_inspection",
      inspectionStatus: "pending",
    },
    201,
    { "cache-control": "no-store" }
  );
}

/**
 * List only the current guest's own private observations and their inspection status.
 */
export async function handleListGuestObservations(request: Request, env: Env): Promise<Response> {
  if (!isGuestPostingEnabled(env)) {
    return json({ ok: false, error: "guest_posting_disabled" }, 404, { "cache-control": "no-store" });
  }
  const pass = await findActiveGuestPass(env.OBS_DB, request);
  if (!pass) {
    return json({ ok: false, error: "guest_pass_required" }, 401, { "cache-control": "no-store" });
  }
  const ownerKey = `guest:${pass.pass_id}`;

  const rows = (await env.OBS_DB.prepare(
    `SELECT o.observation_id, o.observed_at, o.taxon_label, o.note, o.visibility, o.created_at,
            COUNT(a.asset_id) AS photo_count,
            SUM(CASE WHEN a.processing_state = 'pending_inspection' THEN 1 ELSE 0 END) AS pending_photo_count
       FROM observations o
       LEFT JOIN asset_ledger a ON a.observation_id = o.observation_id
      WHERE o.owner_user_id = ? AND o.visibility = 'private'
      GROUP BY o.observation_id
      ORDER BY o.created_at DESC
      LIMIT 100`
  ).bind(ownerKey).all<{
    observation_id: string;
    observed_at: string;
    taxon_label: string | null;
    note: string | null;
    visibility: string;
    created_at: string;
    photo_count: number;
    pending_photo_count: number | null;
  }>()).results;

  return json(
    {
      ok: true,
      ownerKey,
      observations: rows.map((row) => ({
        observationId: row.observation_id,
        observedAt: row.observed_at,
        taxonLabel: row.taxon_label,
        note: row.note,
        visibility: row.visibility,
        photoCount: Number(row.photo_count ?? 0),
        inspectionStatus: Number(row.pending_photo_count ?? 0) > 0 || Number(row.photo_count ?? 0) === 0 ? "pending" : "inspected",
        createdAt: row.created_at,
      })),
    },
    200,
    { "cache-control": "no-store" }
  );
}
