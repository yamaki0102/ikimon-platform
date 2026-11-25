import type { Env } from "./core/env";
import { assertSameOriginRequest, json, normalizeOptionalText, readJson } from "./core/http";
import { findActiveGuestPass, isGuestPostingEnabled } from "./guestPosting";

export type EventActorContext = {
  sessionUserId: string | null;
  isAdmin: boolean;
};

async function checkEventParticipantOrOrganizer(
  db: Env["OBS_DB"],
  eventId: string,
  request: Request,
  actor: EventActorContext
): Promise<{ allowed: true; isOrganizer: boolean } | { allowed: false; status: 401 | 403 | 404; error: string }> {
  const eventRow = await db.prepare(
    "SELECT session_id, organizer_user_id FROM observation_event_sessions WHERE session_id = ? LIMIT 1"
  ).bind(eventId).first<{ session_id: string; organizer_user_id: string }>();
  if (!eventRow) {
    return { allowed: false, status: 404, error: "event_not_found" };
  }
  if (actor.sessionUserId && (actor.isAdmin || eventRow.organizer_user_id === actor.sessionUserId)) {
    return { allowed: true, isOrganizer: true };
  }
  if (actor.sessionUserId) {
    const part = await db.prepare(
      "SELECT 1 AS ok FROM observation_event_participants WHERE session_id = ? AND user_id = ? AND status = 'checked_in' LIMIT 1"
    ).bind(eventId, actor.sessionUserId).first();
    if (part) {
      return { allowed: true, isOrganizer: false };
    }
  }
  const pass = await findActiveGuestPass(db, request);
  if (pass) {
    const dest = await db.prepare(
      "SELECT 1 AS ok FROM guest_pass_destinations WHERE pass_id = ? AND destination_kind = 'event' AND destination_id = ? LIMIT 1"
    ).bind(pass.pass_id, eventId).first();
    if (dest) {
      return { allowed: true, isOrganizer: false };
    }
    return { allowed: false, status: 403, error: "forbidden" };
  }
  if (actor.sessionUserId) {
    return { allowed: false, status: 403, error: "forbidden" };
  }
  return { allowed: false, status: 401, error: "unauthorized" };
}

/**
 * Update a guest observation's share scope (`private` or `event_members`) and optional Gemini consent.
 * Guests can never publish to `public`.
 */
export async function handleSetGuestObservationShareScope(
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
    "SELECT observation_id, owner_user_id FROM observations WHERE observation_id = ? LIMIT 1"
  ).bind(observationId).first<{ observation_id: string; owner_user_id: string }>();
  if (!obs) {
    return json({ ok: false, error: "observation_not_found" }, 404, { "cache-control": "no-store" });
  }
  if (obs.owner_user_id !== ownerKey) {
    return json({ ok: false, error: "forbidden" }, 403, { "cache-control": "no-store" });
  }

  const body = await readJson<{ eventId?: unknown; shareScope?: unknown; geminiConsent?: unknown }>(request);
  const eventId = normalizeOptionalText(body.eventId);
  if (!eventId) {
    return json({ ok: false, error: "event_id_required" }, 400, { "cache-control": "no-store" });
  }
  if (body.shareScope === "public") {
    return json({ ok: false, error: "guest_public_not_allowed" }, 403, { "cache-control": "no-store" });
  }
  if (body.shareScope !== "private" && body.shareScope !== "event_members") {
    return json({ ok: false, error: "invalid_share_scope" }, 400, { "cache-control": "no-store" });
  }

  const hasDest = await env.OBS_DB.prepare(
    "SELECT 1 AS ok FROM guest_pass_destinations WHERE pass_id = ? AND destination_kind = 'event' AND destination_id = ? LIMIT 1"
  ).bind(pass.pass_id, eventId).first();
  if (!hasDest) {
    return json({ ok: false, error: "forbidden" }, 403, { "cache-control": "no-store" });
  }

  const existing = await env.OBS_DB.prepare(
    "SELECT removed_by_organizer_at, gemini_consent_at FROM guest_event_observation_shares WHERE observation_id = ? LIMIT 1"
  ).bind(observationId).first<{ removed_by_organizer_at: string | null; gemini_consent_at: string | null }>();
  if (existing?.removed_by_organizer_at && body.shareScope === "event_members") {
    return json({ ok: false, error: "removed_by_organizer" }, 403, { "cache-control": "no-store" });
  }

  const geminiConsentAt = body.geminiConsent === true
    ? (existing?.gemini_consent_at ?? new Date().toISOString())
    : (existing?.gemini_consent_at ?? null);

  await env.OBS_DB.prepare(
    `INSERT INTO guest_event_observation_shares
       (observation_id, event_id, owner_user_id, share_scope, gemini_consent_at, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(observation_id) DO UPDATE SET
       share_scope = excluded.share_scope,
       gemini_consent_at = COALESCE(excluded.gemini_consent_at, guest_event_observation_shares.gemini_consent_at),
       updated_at = CURRENT_TIMESTAMP`
  ).bind(observationId, eventId, ownerKey, body.shareScope, geminiConsentAt).run();

  return json(
    {
      ok: true,
      observationId,
      eventId,
      shareScope: body.shareScope,
      geminiConsent: Boolean(geminiConsentAt),
    },
    200,
    { "cache-control": "no-store" }
  );
}

/**
 * List inspected-only guest observations shared with `event_members` for current participants/organizers.
 * Used uniformly for feed, map, live bulletin, and summary counts.
 */
export async function handleListEventGuestObservations(
  eventId: string,
  request: Request,
  env: Env,
  actor: EventActorContext
): Promise<Response> {
  if (!isGuestPostingEnabled(env)) {
    return json({ ok: false, error: "guest_posting_disabled" }, 404, { "cache-control": "no-store" });
  }
  const access = await checkEventParticipantOrOrganizer(env.OBS_DB, eventId, request, actor);
  if (!access.allowed) {
    return json({ ok: false, error: access.error }, access.status, { "cache-control": "no-store" });
  }

  const rows = (await env.OBS_DB.prepare(
    `SELECT o.observation_id, o.observed_at, o.taxon_label, o.note, o.created_at,
            COUNT(a.asset_id) AS photo_count
       FROM guest_event_observation_shares s
       JOIN observations o ON o.observation_id = s.observation_id
       LEFT JOIN asset_ledger a ON a.observation_id = o.observation_id
      WHERE s.event_id = ?
        AND s.share_scope = 'event_members'
        AND s.removed_by_organizer_at IS NULL
        AND o.visibility = 'private'
        AND NOT EXISTS (
          SELECT 1 FROM asset_ledger a2
           WHERE a2.observation_id = o.observation_id
             AND a2.processing_state <> 'inspected'
        )
      GROUP BY o.observation_id
      ORDER BY o.created_at DESC
      LIMIT 200`
  ).bind(eventId).all<{
    observation_id: string;
    observed_at: string;
    taxon_label: string | null;
    note: string | null;
    created_at: string;
    photo_count: number;
  }>()).results;

  return json(
    {
      ok: true,
      eventId,
      observations: rows.map((row) => ({
        observationId: row.observation_id,
        observedAt: row.observed_at,
        taxonLabel: row.taxon_label,
        note: row.note,
        photoCount: Number(row.photo_count ?? 0),
        createdAt: row.created_at,
      })),
      summary: {
        totalInspectedCount: rows.length,
      },
    },
    200,
    { "cache-control": "private, no-store" }
  );
}

/**
 * Serve a direct image link for an event-shared guest photo only if the caller is a current participant
 * and the photo is inspected and not removed by the organizer.
 */
export async function handleGetEventGuestPhoto(
  eventId: string,
  observationId: string,
  assetId: string,
  request: Request,
  env: Env,
  actor: EventActorContext
): Promise<Response> {
  if (!isGuestPostingEnabled(env)) {
    return json({ ok: false, error: "guest_posting_disabled" }, 404, { "cache-control": "no-store" });
  }
  const access = await checkEventParticipantOrOrganizer(env.OBS_DB, eventId, request, actor);
  if (!access.allowed) {
    return json({ ok: false, error: access.error }, access.status, { "cache-control": "no-store" });
  }

  const row = await env.OBS_DB.prepare(
    `SELECT a.object_key, a.mime
       FROM guest_event_observation_shares s
       JOIN observations o ON o.observation_id = s.observation_id
       JOIN asset_ledger a ON a.observation_id = o.observation_id AND a.asset_id = ?
      WHERE s.event_id = ?
        AND s.observation_id = ?
        AND s.share_scope = 'event_members'
        AND s.removed_by_organizer_at IS NULL
        AND o.visibility = 'private'
        AND a.processing_state = 'inspected'
      LIMIT 1`
  ).bind(assetId, eventId, observationId).first<{ object_key: string; mime: string }>();

  if (!row) {
    return json({ ok: false, error: "photo_not_available" }, 404, { "cache-control": "no-store" });
  }
  const obj = await env.ASSET_BUCKET.get(row.object_key);
  if (!obj) {
    return json({ ok: false, error: "photo_not_found" }, 404, { "cache-control": "no-store" });
  }
  return new Response(obj.body, {
    status: 200,
    headers: {
      "content-type": row.mime || "application/octet-stream",
      "cache-control": "private, no-store",
    },
  });
}

/**
 * Organizer-only operation to remove a guest observation from the event share feed.
 */
export async function handleOrganizerRemoveGuestObservation(
  eventId: string,
  observationId: string,
  request: Request,
  env: Env,
  actor: EventActorContext
): Promise<Response> {
  if (!isGuestPostingEnabled(env)) {
    return json({ ok: false, error: "guest_posting_disabled" }, 404, { "cache-control": "no-store" });
  }
  const sameOriginError = assertSameOriginRequest(request);
  if (sameOriginError) return sameOriginError;

  if (!actor.sessionUserId) {
    return json({ ok: false, error: "unauthorized" }, 401, { "cache-control": "no-store" });
  }
  const eventRow = await env.OBS_DB.prepare(
    "SELECT organizer_user_id FROM observation_event_sessions WHERE session_id = ? LIMIT 1"
  ).bind(eventId).first<{ organizer_user_id: string }>();
  if (!eventRow) {
    return json({ ok: false, error: "event_not_found" }, 404, { "cache-control": "no-store" });
  }
  if (!actor.isAdmin && eventRow.organizer_user_id !== actor.sessionUserId) {
    return json({ ok: false, error: "forbidden" }, 403, { "cache-control": "no-store" });
  }

  const res = await env.OBS_DB.prepare(
    `UPDATE guest_event_observation_shares
        SET share_scope = 'private',
            removed_by_organizer_at = CURRENT_TIMESTAMP,
            removed_by_user_id = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE event_id = ? AND observation_id = ?`
  ).bind(actor.sessionUserId, eventId, observationId).run();
  const changes = Number((res as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0);
  if (changes === 0) {
    return json({ ok: false, error: "share_not_found" }, 404, { "cache-control": "no-store" });
  }
  return json({ ok: true, eventId, observationId, removed: true }, 200, { "cache-control": "no-store" });
}

/**
 * Build a sanitized Gemini input payload only when explicit Gemini consent was recorded,
 * dropping exact location coordinates and guest identity.
 */
export async function buildGuestObservationGeminiPayload(
  db: Env["OBS_DB"],
  observationId: string
): Promise<
  | { ok: true; payload: { observationId: string; taxonLabel: string | null; note: string | null; observedAt: string } }
  | { ok: false; error: "gemini_consent_required" | "observation_not_found" }
> {
  const row = await db.prepare(
    `SELECT o.observation_id, o.taxon_label, o.note, o.observed_at, s.gemini_consent_at
       FROM observations o
       LEFT JOIN guest_event_observation_shares s ON s.observation_id = o.observation_id
      WHERE o.observation_id = ?
      LIMIT 1`
  ).bind(observationId).first<{
    observation_id: string;
    taxon_label: string | null;
    note: string | null;
    observed_at: string;
    gemini_consent_at: string | null;
  }>();
  if (!row) {
    return { ok: false, error: "observation_not_found" };
  }
  if (!row.gemini_consent_at) {
    return { ok: false, error: "gemini_consent_required" };
  }
  return {
    ok: true,
    payload: {
      observationId: row.observation_id,
      taxonLabel: row.taxon_label,
      note: row.note,
      observedAt: row.observed_at,
    },
  };
}
