import { assertSameOriginRequest, json, normalizeOptionalText, numberOrNullFromUnknown, readJson, sha256Hex, stableJson, textToArrayBuffer } from "../core/http";
import type { D1PreparedStatement, Env } from "../core/env";
import { RYUYO_FIELD_ID } from "../areaEncyclopediaNative";
import { DiscoveryError, EventDiscoveryStore, RYUYO_DISCOVERY_GEMINI_NOTICE_VERSION, discoveryHash, discoveryReceipt, isEventDiscoveryProfile, parseDiscoveryCaptureInput, parseDiscoveryPaperInput, parseDiscoveryReviewInput } from "../eventDiscovery";
import { inspectPublicDerivativeMetadata } from "../publicDerivativeMetadata";
import { screenDiscoveryPhoto } from "../eventDiscoveryPrivacy";
import { isCommonEventTemplateConfig } from "../../../src/services/commonEventTemplateContract";
import { buildCommonEventTemplateDraft } from "../../../src/services/commonEventTemplatePresets";
import { RALLY_COUNT_UNITS, RALLY_COURSE_STATUSES, RALLY_LOCATION_BINDINGS, RALLY_MISSION_STATUSES, RALLY_REVISION_ACTIONS, RALLY_SCOPES, RALLY_VERIFICATION_POLICIES, RALLY_WEATHER_SENSITIVITIES, appendObservationEventLive, findObservationEventParticipant, getObservationEventSessionById, isObservationEventActivityOpen, isObservationEventCheckinOpen, isObservationEventParticipatingGroup, mapObservationEventSession, observationEventParticipantContext, observationEventRequestActor, recordObservationEventMeshVisit, requireObservationEventOrganizer, type ObservationEventSessionD1Row, type ObservationEventTemplate, type ObservationRallyCourseD1Row, type ObservationRallyMissionD1Row, type ObservationRallyProgressD1Row, type ObservationRallyStationD1Row, type ObservationRallySubmissionD1Row } from "./runtime";
import { asPlainObject, jsonObject, roundPublicEventCoordinate } from "../core/shared";

export function isPrivateReceivedProgram(
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>,
): boolean {
  return session.config.schema === "zukan.public-program-receiver/v1"
    && session.config.source === "nocosil"
    && session.config.program_receiver_private === true;
}

export function isObservationEventQaFixture(
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>
): boolean {
  const config = session.config;
  const hiddenFlag = [
    config.qa_fixture,
    config.qaFixture,
    config.is_fixture,
    config.isFixture,
    config.test_fixture,
    config.testFixture
  ].some((value) => value === true || (typeof value === "string" && /^(?:1|true|yes|qa|fixture|test|smoke)$/iu.test(value.trim())));
  if (hiddenFlag || config.public_listed === false || config.publicListVisible === false) return true;

  const visibility = normalizeOptionalText(config.public_list_visibility ?? config.publicListVisibility);
  // Draft templates already have invitation codes; a lifecycle transition does
  // not publish their titles or participation links.
  if (visibility && /^(?:private-until-explicit|hidden|internal|qa|fixture|test)$/iu.test(visibility)) return true;
  const sourceMarkers = [config.source, config.fixture_prefix, config.fixturePrefix]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  if (/(?:^|[\s_-])(?:qa|e2e|fixture|smoke|regression|test)(?:$|[\s_-])/iu.test(sourceMarkers)) return true;

  const eventCode = session.eventCode ?? "";
  if (/^(?:qa|e2e|fixture|smoke|regression|test|pr\d+)(?:[-_]|$)/iu.test(eventCode)) return true;
  if (/\bpr\s*#?\d+\b.*\bprod(?:uction)?\b.*\brally\b/iu.test(session.title)) return true;
  return /(?:^|[\s\[(_-])(?:qa|e2e|fixture|smoke|regression|test)(?:$|[\s\])}_:-])|テスト|検証用|動作確認/iu.test(session.title);
}

export function isRyuyoDiscoveryEvent(env: Env, session: ObservationEventTemplate): boolean {
  const template = asPlainObject(session.config.event_template);
  return session.fieldId === RYUYO_FIELD_ID && template?.key === "ryuyo"
    && isEventDiscoveryProfile(session.config) && observationEventGuestMediaEnabled(env, session);
}

interface ObservationRallyAutoMatchCandidateD1Row extends ObservationRallyMissionD1Row {
  session_id: string;
  matched_station_id: string;
  station_lat: number;
  station_lng: number;
  station_radius_m: number;
}

const RALLY_EARTH_RADIUS_M = 6_371_000;

function observationRallyDistanceMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  const toRadians = (value: number) => value * Math.PI / 180;
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const a = sinLat * sinLat + Math.cos(fromLat) * Math.cos(toLat) * sinLng * sinLng;
  const bounded = Math.min(1, Math.max(0, a));
  return 2 * RALLY_EARTH_RADIUS_M * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded));
}

export async function autoMatchObservationToActiveRalliesNative(
  env: Env,
  input: {
    userId: string;
    visitId: string;
    occurrenceId: string;
    lat: number;
    lng: number;
    observedAt: string;
  }
): Promise<{ matchedCandidates: number; createdSubmissions: number }> {
  if (!Number.isFinite(input.lat) || !Number.isFinite(input.lng)) {
    return { matchedCandidates: 0, createdSubmissions: 0 };
  }

  const candidates = await env.OBS_DB.prepare(
    `SELECT
       course.session_id AS session_id,
       course.course_id AS course_id,
       mission.mission_id AS mission_id,
       mission.course_id AS mission_course_id,
       mission.station_id AS station_id,
       mission.replacement_for_mission_id AS replacement_for_mission_id,
       mission.scope AS scope,
       mission.location_binding AS location_binding,
       mission.title AS title,
       mission.target AS target,
       mission.count_unit AS count_unit,
       mission.goal_count AS goal_count,
       mission.counting_policy_json AS counting_policy_json,
       mission.verification_policy AS verification_policy,
       mission.weather_sensitivity AS weather_sensitivity,
       mission.fallback_group AS fallback_group,
       mission.status AS status,
       mission.starts_at AS starts_at,
       mission.ends_at AS ends_at,
       mission.sort_order AS sort_order,
       mission.created_by AS created_by,
       mission.created_at AS created_at,
       mission.updated_at AS updated_at,
       station.station_id AS matched_station_id,
       station.lat AS station_lat,
       station.lng AS station_lng,
       station.radius_m AS station_radius_m
     FROM observation_rally_courses course
     JOIN observation_event_sessions event_session
       ON event_session.session_id = course.session_id
     JOIN observation_rally_missions mission
       ON mission.course_id = course.course_id
     JOIN observation_rally_stations station
       ON station.course_id = course.course_id
      AND (
        mission.station_id = station.station_id
        OR (mission.location_binding = 'any_registered_station' AND mission.station_id IS NULL)
      )
     WHERE course.status = 'live'
       AND mission.status = 'published'
       AND station.status = 'open'
       AND mission.location_binding IN ('station_required', 'any_registered_station')
       AND station.lat IS NOT NULL
       AND station.lng IS NOT NULL
       AND station.radius_m IS NOT NULL
       AND station.radius_m > 0
       AND datetime(event_session.started_at) <= datetime(?)
       AND (event_session.ended_at IS NULL OR datetime(event_session.ended_at) >= datetime(?))
       AND (mission.starts_at IS NULL OR datetime(mission.starts_at) <= datetime(?))
       AND (mission.ends_at IS NULL OR datetime(mission.ends_at) >= datetime(?))
       AND (
         event_session.organizer_user_id = ?
         OR EXISTS (
           SELECT 1
           FROM observation_event_participants participant
           WHERE participant.session_id = course.session_id
             AND participant.user_id = ?
             AND participant.status IN ('registered', 'checked_in')
         )
       )
     ORDER BY mission.sort_order ASC, station.sort_order ASC, station.created_at ASC
     LIMIT 500`
  ).bind(input.observedAt, input.observedAt, input.observedAt, input.observedAt, input.userId, input.userId).all<ObservationRallyAutoMatchCandidateD1Row>();

  let matchedCandidates = 0;
  let createdSubmissions = 0;

  for (const candidate of candidates.results) {
    const stationLat = Number(candidate.station_lat);
    const stationLng = Number(candidate.station_lng);
    const radiusM = Number(candidate.station_radius_m);
    if (!Number.isFinite(stationLat) || !Number.isFinite(stationLng) || !Number.isFinite(radiusM) || radiusM <= 0) continue;

    const distanceM = observationRallyDistanceMeters(
      { lat: input.lat, lng: input.lng },
      { lat: stationLat, lng: stationLng }
    );
    if (!Number.isFinite(distanceM) || distanceM > radiusM) continue;
    matchedCandidates += 1;

    const existing = await env.OBS_DB.prepare(
      `SELECT submission_id
         FROM observation_rally_submissions
        WHERE mission_id = ?
          AND source_type = 'observation_auto_match'
          AND source_ref = ?
          AND IFNULL(user_id, '') = ?
          AND IFNULL(guest_token, '') = ''
        LIMIT 1`
    ).bind(candidate.mission_id, input.visitId, input.userId).first<{ submission_id: string }>();
    if (existing) {
      await env.OBS_DB.batch(observationRallyProgressRefreshStatements(env, candidate.mission_id));
      continue;
    }

    const submissionId = crypto.randomUUID();
    const reviewStatus = candidate.verification_policy === "auto" ? "auto_accepted" : "pending";
    const publicLat = roundPublicEventCoordinate(input.lat);
    const publicLng = roundPublicEventCoordinate(input.lng);
    const insertResults = await env.OBS_DB.batch([env.OBS_DB.prepare(
      `INSERT OR IGNORE INTO observation_rally_submissions (
         submission_id, session_id, course_id, mission_id, station_id, user_id, guest_token, team_id,
         source_type, source_ref, count_value, public_lat, public_lng, payload_json, review_status
       ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 'observation_auto_match', ?, 1, ?, ?, ?, ?)`
    ).bind(
      submissionId,
      candidate.session_id,
      candidate.course_id,
      candidate.mission_id,
      candidate.matched_station_id,
      input.userId,
      input.visitId,
      publicLat,
      publicLng,
      JSON.stringify({
        source: "observation_post_save_auto_match",
        visit_id: input.visitId,
        occurrence_id: input.occurrenceId,
        station_id: candidate.matched_station_id,
        distance_m: Math.round(distanceM * 100) / 100,
        radius_m: radiusM,
        observed_at: input.observedAt,
        exact_location_used: true,
        exact_location_stored: false
      }),
      reviewStatus
    ), ...observationRallyProgressRefreshStatements(env, candidate.mission_id)]);
    const insertResult = insertResults[0] as { meta?: { changes?: number } };
    if (Number(insertResult.meta?.changes ?? 1) === 0) continue;

    createdSubmissions += 1;
    await appendObservationEventLive(env, {
      sessionId: candidate.session_id,
      type: "rally_task_submitted",
      scope: "all",
      actorUserId: input.userId,
      payload: {
        submission_id: submissionId,
        mission_id: candidate.mission_id,
        station_id: candidate.matched_station_id,
        visit_id: input.visitId,
        occurrence_id: input.occurrenceId,
        source_type: "observation_auto_match",
        review_status: reviewStatus,
        public_lat: publicLat,
        public_lng: publicLng,
        exact_location_stored: false
      }
    });
  }

  return { matchedCandidates, createdSubmissions };
}

export async function getObservationEventDiscoveries(request: Request, env: Env, sessionId: string, entryId: string | null): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  const headers = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow, noarchive" };
  if (!session || !isEventDiscoveryProfile(session.config) || !observationEventGuestMediaEnabled(env, session)
    || session.config.cancelled === true || session.config.status === "cancelled" || session.config.state === "cancelled") {
    return json({ error: "not_found" }, 404, headers);
  }
  const course = await getObservationRallyCourseBySession(env, sessionId);
  if (!course || course.status === "draft") return json({ error: "not_found" }, 404, headers);
  const store = new EventDiscoveryStore(env.OBS_DB, env.ASSET_BUCKET);
  if (entryId) {
    const body = await store.content(sessionId, entryId);
    return new Response(body, { headers: {
      ...headers, "content-type": "image/webp", "content-length": String(body.byteLength),
      "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox",
    } });
  }
  const url = new URL(request.url);
  return json(await store.gallery(sessionId, url.searchParams.get("cursor"),
    url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined), 200, headers);
}

export async function handleObservationEventDiscoveryPaper(request: Request, env: Env, sessionId: string, entryId: string | null, action: string): Promise<Response> {
  const headers = { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow, noarchive" };
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const organizer = await requireObservationEventOrganizer(request, env, sessionId);
  if (organizer instanceof Response) return organizer;
  const session = organizer.session;
  if (!isEventDiscoveryProfile(session.config) || !observationEventGuestMediaEnabled(env, session)) return json({ error: "not_found" }, 404, headers);
  const store = new EventDiscoveryStore(env.OBS_DB, env.ASSET_BUCKET);
  if (!entryId && request.method === "POST") {
    const course = await getObservationRallyCourseBySession(env, sessionId);
    // Staff can transcribe the paper sheets after the event ends as well.
    if (!course || course.status === "draft" || session.config.cancelled === true || session.config.status === "cancelled" || session.config.state === "cancelled") return json({ error: "paper_intake_not_started" }, 409, headers);
    const body = await readJson<Record<string, unknown>>(request);
    const result = await store.createPaper(sessionId, organizer.auth.userId, parseDiscoveryPaperInput(body));
    return json(result, result.replay ? 200 : 201, headers);
  }
  const entry = entryId ? await store.get(sessionId, entryId) : null;
  if (!entry || entry.entry_kind !== "paper") return json({ error: "paper_entry_not_found" }, 404, headers);
  if (action === "review" && request.method === "PATCH") {
    return json(await store.review(sessionId, entry.entry_id, organizer.auth.userId,
      parseDiscoveryReviewInput(await readJson<Record<string, unknown>>(request))), 200, headers);
  }
  if (action === "withdraw" && request.method === "POST") {
    await store.withdraw(sessionId, entry.entry_id);
    return json({ receiptId: entry.entry_id, rightsReviewStatus: "withdrawn", galleryStatus: "withdrawn" }, 200, headers);
  }
  return json({ error: "not_found" }, 404, headers);
}

interface ObservationEventGuestMediaRow {
  submission_id: string; session_id: string; participant_id: string; actor_user_id: string | null;
  asset_key: string; request_sha256: string; media_sha256: string; mime: string; bytes: number;
  media_state: "uploading" | "saved" | "failed"; idempotency_key: string;
  rights_review_status: "pending" | "approved" | "rejected" | "withdrawn";
  rights_reviewed_by: string | null; rights_reviewed_at: string | null; rights_review_note: string | null;
  private_delete_pending: number; active_upload_count: number;
  visibility: "private"; created_at: string; updated_at: string;
}

export function observationEventGuestMediaEnabled(env: Env, session: ObservationEventTemplate): boolean {
  const eventCode = normalizeOptionalText(session.eventCode)?.toLowerCase();
  if (!eventCode || session.plan !== "public" || session.config.guest_media_enabled !== true || isPrivateReceivedProgram(session)) return false;
  if (isEventDiscoveryProfile(session.config)) {
    // An organizer's explicit, typed unlisted profile is self-service. The
    // unrelated legacy allowlist remains unchanged. Hidden invitation pages
    // are not synthetic fixtures; actual fixture markers still fail closed.
    const fixtureConfig = { ...session.config };
    delete fixtureConfig.public_list_visibility;
    delete fixtureConfig.publicListVisibility;
    delete fixtureConfig.public_listed;
    delete fixtureConfig.publicListVisible;
    return env.ENVIRONMENT !== "production" || !isObservationEventQaFixture({ ...session, config: fixtureConfig });
  }
  if (env.ENVIRONMENT !== "production") return session.config.qa_fixture === true;
  if (isObservationEventQaFixture(session)) return false;
  const enabledCodes = new Set((env.OBSERVATION_EVENT_GUEST_MEDIA_CODES ?? "").split(",").map((value) => value.trim().toLowerCase()).filter(Boolean));
  return enabledCodes.has(eventCode);
}

function observationEventGuestMediaReceipt(row: ObservationEventGuestMediaRow) {
  return {
    receiptId: row.submission_id, mediaState: row.media_state, mediaType: row.mime, rightsReviewStatus: row.rights_review_status,
    visibility: "private" as const, createdAt: row.created_at, updatedAt: row.updated_at,
    cleanupPending: row.private_delete_pending === 1,
    ...(row.rights_review_status === "withdrawn" ? {} : { privateContentHref: `/api/v1/observation-events/${encodeURIComponent(row.session_id)}/guest-media/${encodeURIComponent(row.submission_id)}/content` })
  };
}

export async function observationEventGuestMediaActor(request: Request, env: Env, sessionId: string) {
  const { auth, guestToken } = await observationEventRequestActor(request, env, sessionId);
  const participant = auth || guestToken ? await findObservationEventParticipant(env, sessionId, auth?.userId ?? null, guestToken) : null;
  return { auth, guestToken, participant };
}

export async function createObservationEventGuestMedia(request: Request, env: Env, sessionId: string): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session || !observationEventGuestMediaEnabled(env, session)) return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
  const discoveryProfile = isEventDiscoveryProfile(session.config);
  if (discoveryProfile && (await getObservationRallyCourseBySession(env, sessionId))?.status !== "live") return json({ error: "event_media_intake_not_started" }, 409, { "cache-control": "no-store" });
  if (!isObservationEventActivityOpen(session)) return json({ error: "event_media_intake_closed" }, 409, { "cache-control": "no-store" });
  const actor = await observationEventGuestMediaActor(request, env, sessionId);
  if (actor.auth?.banned) return json({ error: "event_media_unavailable" }, 403, { "cache-control": "no-store" });
  if (!actor.participant || actor.participant.status !== "checked_in") return json({ error: "checked_in_participant_required" }, 403, { "cache-control": "no-store" });
  if (isRyuyoDiscoveryEvent(env, session)
    && (actor.participant.discovery_gemini_notice_version !== RYUYO_DISCOVERY_GEMINI_NOTICE_VERSION || !actor.participant.discovery_gemini_notice_at)) {
    return json({ error: "discovery_gemini_notice_required" }, 403, { "cache-control": "no-store" });
  }
  if (Number(request.headers.get("content-length") ?? 0) > 13_107_200) return json({ error: "media_too_large" }, 413, { "cache-control": "no-store" });
  let form: FormData;
  try { form = await request.formData(); } catch { return json({ error: "multipart_form_required" }, 400, { "cache-control": "no-store" }); }
  const file = form.get("media");
  if (!(file instanceof File) || file.size < 1 || file.size > 12_582_912) return json({ error: "media_required_or_too_large" }, 400, { "cache-control": "no-store" });
  const mime = file.type.toLowerCase();
  const isImage = new Set(["image/jpeg", "image/png", "image/webp"]).has(mime);
  const isVideo = new Set(["video/mp4", "video/webm"]).has(mime);
  if (!isImage && !isVideo) return json({ error: "unsupported_media_type" }, 415, { "cache-control": "no-store" });
  if (discoveryProfile && !isImage) return json({ error: "discovery_photo_required" }, 415, { "cache-control": "no-store" });
  if (isImage && !env.IMAGES) return json({ error: "private_image_scrubber_unavailable" }, 503, { "cache-control": "no-store" });
  if (form.get("private_storage_consent") !== "yes" || form.get("creator_rights_attestation") !== "yes") return json({ error: "private_storage_and_creator_rights_confirmation_required" }, 400, { "cache-control": "no-store" });
  const idempotencyKey = normalizeOptionalText(request.headers.get("idempotency-key") ?? form.get("idempotency_key"));
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 128 || !/^[a-zA-Z0-9._:-]+$/.test(idempotencyKey)) return json({ error: "valid_idempotency_key_required" }, 400, { "cache-control": "no-store" });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signatureValid = mime === "image/jpeg"
    ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    : mime === "image/png"
      ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      : mime === "image/webp"
        ? bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
        : mime === "video/mp4"
          ? bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70
          : bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  if (!signatureValid) return json({ error: "media_content_mismatch" }, 415, { "cache-control": "no-store" });
  const capture = discoveryProfile ? parseDiscoveryCaptureInput(form, actor.participant.is_minor === 1) : null;
  const sourceSha256 = await sha256Hex(bytes.buffer);
  const requestSha256 = capture ? await discoveryHash(JSON.stringify([sourceSha256, capture])) : sourceSha256;
  const idempotencyDigest = await sha256Hex(textToArrayBuffer(`${sessionId}\0${actor.participant.participant_id}\0${idempotencyKey}`));
  const submissionId = `egm_${idempotencyDigest.slice(0, 40)}`;
  const assetKey = `private/event-guest-media/${encodeURIComponent(sessionId)}/${submissionId}/original`;
  const findByKey = () => env.OBS_DB.prepare(
    `SELECT submission_id, session_id, participant_id, actor_user_id, asset_key, request_sha256, media_sha256,
            mime, bytes, media_state, idempotency_key, rights_review_status, rights_reviewed_by,
            rights_reviewed_at, rights_review_note, visibility, private_delete_pending, active_upload_count, created_at, updated_at
       FROM observation_event_guest_media WHERE session_id = ? AND participant_id = ? AND idempotency_key = ? LIMIT 1`
  ).bind(sessionId, actor.participant!.participant_id, idempotencyKey).first<ObservationEventGuestMediaRow>();
  let row = await findByKey();
  if (row && row.request_sha256 !== requestSha256) return json({ error: "idempotency_key_conflict" }, 409, { "cache-control": "no-store" });
  if (row?.rights_review_status === "withdrawn") return json({ error: "media_withdrawn" }, 410, { "cache-control": "no-store" });
  if (row?.media_state === "saved") {
    if (isRyuyoDiscoveryEvent(env, session)) await autoPublishRyuyoDiscovery(env, sessionId, row.submission_id);
    return json({ receipt: await observationEventGuestMediaProfileReceipt(row, env, discoveryProfile) }, 200, { "cache-control": "no-store" });
  }
  let transformed: ArrayBuffer;
  if (isImage) {
    try {
      const output = await env.IMAGES!.input(new Response(bytes.slice()).body!).transform({ width: 1600 }).output({ format: "image/webp", quality: 82, anim: false });
      const response = output.response();
      const contentType = (response.headers.get("content-type") ?? "").split(";", 1)[0]?.trim().toLowerCase();
      if (!response.ok || contentType !== "image/webp") return json({ error: "private_image_scrub_failed" }, 422, { "cache-control": "no-store" });
      transformed = await response.arrayBuffer();
      if (transformed.byteLength === 0 || transformed.byteLength > 12_582_912) return json({ error: "private_image_output_invalid" }, 422, { "cache-control": "no-store" });
      const inspection = inspectPublicDerivativeMetadata(transformed, contentType);
      if (inspection.scannedContainer !== "webp" || inspection.gpsExifPresent || inspection.exifPresent || inspection.xmpPresent) return json({ error: "private_image_metadata_not_scrubbed" }, 422, { "cache-control": "no-store" });
    } catch {
      return json({ error: "private_image_scrub_failed" }, 422, { "cache-control": "no-store" });
    }
  } else {
    transformed = bytes.slice().buffer as ArrayBuffer;
  }
  const storageMime = isImage ? "image/webp" : mime;
  const mediaSha256 = isImage ? await sha256Hex(transformed) : requestSha256;
  if (row && row.media_sha256 !== mediaSha256) return json({ error: "idempotency_key_conflict" }, 409, { "cache-control": "no-store" });
  if (!row) {
    if (capture) {
      await new EventDiscoveryStore(env.OBS_DB, env.ASSET_BUCKET).reservePhoto({
        sessionId, participantId: actor.participant.participant_id, actorUserId: actor.auth?.userId ?? null,
        submissionId, assetKey, requestSha256, mediaSha256, bytes: transformed.byteLength, idempotencyKey, capture,
      });
    } else {
      await env.OBS_DB.prepare(
        `INSERT OR IGNORE INTO observation_event_guest_media (
           submission_id, session_id, participant_id, actor_user_id, asset_key, request_sha256, media_sha256,
           mime, bytes, idempotency_key, private_storage_consent_at, creator_rights_attested_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).bind(submissionId, sessionId, actor.participant.participant_id, actor.auth?.userId ?? null, assetKey, requestSha256, mediaSha256, storageMime, transformed.byteLength, idempotencyKey).run();
    }
    row = await findByKey();
  }
  if (!row || row.request_sha256 !== requestSha256 || row.media_sha256 !== mediaSha256) return json({ error: "idempotency_key_conflict" }, 409, { "cache-control": "no-store" });
  const replay = row.media_state === "saved";
  if (!replay) {
    const started = await env.OBS_DB.prepare("UPDATE observation_event_guest_media SET active_upload_count = active_upload_count + 1, updated_at = CURRENT_TIMESTAMP WHERE submission_id = ? AND rights_review_status <> 'withdrawn'").bind(row.submission_id).run() as { meta?: { changes?: number } };
    if (Number(started.meta?.changes ?? 0) !== 1) return json({ error: "media_withdrawn" }, 410, { "cache-control": "no-store" });
    let putCompleted = false;
    try {
      await env.ASSET_BUCKET.put(row.asset_key, transformed, { httpMetadata: { contentType: row.mime, cacheControl: "private, no-store" }, customMetadata: { visibility: "private", source: "observation_event_guest_media", metadataScrubbed: isImage ? "true" : "false" } });
      putCompleted = true;
      const saved = await env.OBS_DB.prepare("UPDATE observation_event_guest_media SET media_state = 'saved', updated_at = CURRENT_TIMESTAMP WHERE submission_id = ? AND media_sha256 = ? AND rights_review_status <> 'withdrawn'").bind(row.submission_id, mediaSha256).run() as { meta?: { changes?: number } };
      if (Number(saved.meta?.changes ?? 0) !== 1) {
        await reconcileObservationEventGuestMediaDelete(env, row.submission_id);
        const current = await findByKey();
        return json({ error: current?.rights_review_status === "withdrawn" ? "media_withdrawn" : "media_upload_cancelled" }, current?.rights_review_status === "withdrawn" ? 410 : 409, { "cache-control": "no-store" });
      }
    } catch {
      await env.OBS_DB.prepare("UPDATE observation_event_guest_media SET media_state = 'failed', updated_at = CURRENT_TIMESTAMP WHERE submission_id = ? AND media_sha256 = ? AND rights_review_status <> 'withdrawn' AND media_state <> 'saved'").bind(row.submission_id, mediaSha256).run().catch(() => undefined);
      if (putCompleted) await reconcileObservationEventGuestMediaDelete(env, row.submission_id);
      return json({ error: "private_media_save_failed" }, 503, { "cache-control": "no-store" });
    } finally {
      await env.OBS_DB.prepare("UPDATE observation_event_guest_media SET active_upload_count = MAX(0, active_upload_count - 1), updated_at = CURRENT_TIMESTAMP WHERE submission_id = ?").bind(row.submission_id).run();
      await reconcileObservationEventGuestMediaDelete(env, row.submission_id);
    }
  }
  row = await env.OBS_DB.prepare(
    `SELECT submission_id, session_id, participant_id, actor_user_id, asset_key, request_sha256, media_sha256,
            mime, bytes, media_state, idempotency_key, rights_review_status, rights_reviewed_by,
            rights_reviewed_at, rights_review_note, visibility, private_delete_pending, active_upload_count, created_at, updated_at
       FROM observation_event_guest_media WHERE submission_id = ? LIMIT 1`
  ).bind(row.submission_id).first<ObservationEventGuestMediaRow>();
  if (row?.rights_review_status === "withdrawn") return json({ error: "media_withdrawn" }, 410, { "cache-control": "no-store" });
  if (!row || row.media_state !== "saved") return json({ error: "private_media_save_failed" }, 503, { "cache-control": "no-store" });
  if (isRyuyoDiscoveryEvent(env, session)) await autoPublishRyuyoDiscovery(env, sessionId, row.submission_id);
  return json({ receipt: await observationEventGuestMediaProfileReceipt(row, env, discoveryProfile) }, replay ? 200 : 201, { "cache-control": "no-store" });
}

async function autoPublishRyuyoDiscovery(env: Env, sessionId: string, entryId: string) {
  // Saving the owner's private photo has already succeeded. A publication
  // failure keeps it private/pending; it must not invite a duplicate upload.
  try {
    await new EventDiscoveryStore(env.OBS_DB, env.ASSET_BUCKET).autoPublishPhoto(sessionId, entryId,
      (body, text) => screenDiscoveryPhoto(env.GEMINI_API_KEY, body, text));
  } catch { /* The eligible-gallery gate remains closed. */ }
}

async function observationEventGuestMediaProfileReceipt(row: ObservationEventGuestMediaRow, env: Env, discoveryProfile: boolean) {
  if (!discoveryProfile) return observationEventGuestMediaReceipt(row);
  const entry = await new EventDiscoveryStore(env.OBS_DB, env.ASSET_BUCKET).get(row.session_id, row.submission_id);
  if (!entry) throw new DiscoveryError(409, "discovery_receipt_unavailable");
  return discoveryReceipt(entry, true);
}

export async function getObservationEventGuestMedia(request: Request, env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session || !observationEventGuestMediaEnabled(env, session)) return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
  const actor = await observationEventGuestMediaActor(request, env, sessionId);
  if (actor.auth?.banned) return json({ error: "event_media_unavailable" }, 403, { "cache-control": "no-store" });
  const isOrganizer = actor.auth?.userId === session.organizerUserId;
  if (!isOrganizer && (!actor.participant || !isObservationEventParticipatingGroup(actor.participant))) return json({ error: "checked_in_participant_required" }, 403, { "cache-control": "no-store" });
  if (isEventDiscoveryProfile(session.config)) {
    const url = new URL(request.url);
    const data = await new EventDiscoveryStore(env.OBS_DB, env.ASSET_BUCKET).privateReceipts(
      sessionId, isOrganizer ? null : actor.participant!.participant_id, url.searchParams.get("cursor"),
      url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined,
    );
    return json(data, 200, { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow, noarchive" });
  }
  const rows = await env.OBS_DB.prepare(
    `SELECT submission_id, session_id, participant_id, actor_user_id, asset_key, request_sha256, media_sha256,
            mime, bytes, media_state, idempotency_key, rights_review_status, rights_reviewed_by,
            rights_reviewed_at, rights_review_note, visibility, private_delete_pending, active_upload_count, created_at, updated_at
       FROM observation_event_guest_media WHERE session_id = ? AND ${isOrganizer ? "media_state = 'saved'" : "(media_state = 'saved' OR rights_review_status = 'withdrawn')"} ${isOrganizer ? "" : "AND participant_id = ?"}
      ORDER BY created_at DESC LIMIT 100`
  ).bind(...(isOrganizer ? [sessionId] : [sessionId, actor.participant!.participant_id])).all<ObservationEventGuestMediaRow>();
  const resultRows = await env.OBS_DB.prepare("SELECT rights_review_status, COUNT(*) AS count FROM observation_event_guest_media WHERE session_id = ? AND media_state = 'saved' GROUP BY rights_review_status").bind(sessionId).all<{ rights_review_status: string; count: number }>();
  const counts = Object.fromEntries(resultRows.results.map((entry) => [entry.rights_review_status, Number(entry.count)]));
  return json({
    receipts: rows.results.map(observationEventGuestMediaReceipt),
    results: { pending: counts.pending ?? 0, approved: counts.approved ?? 0, rejected: counts.rejected ?? 0, publicProjection: false },
    reviewQueue: isOrganizer ? rows.results.filter((entry) => entry.media_state === "saved" && entry.rights_review_status === "pending").map((entry) => ({ ...observationEventGuestMediaReceipt(entry), mime: entry.mime, bytes: entry.bytes })) : undefined
  }, 200, { "cache-control": "no-store" });
}

export async function getObservationEventGuestMediaContent(request: Request, env: Env, sessionId: string, submissionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session || !observationEventGuestMediaEnabled(env, session)) return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
  const actor = await observationEventGuestMediaActor(request, env, sessionId);
  if (actor.auth?.banned) return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
  const row = await env.OBS_DB.prepare(
    `SELECT submission_id, session_id, participant_id, actor_user_id, asset_key, request_sha256, media_sha256,
            mime, bytes, media_state, idempotency_key, rights_review_status, rights_reviewed_by,
            rights_reviewed_at, rights_review_note, visibility, private_delete_pending, active_upload_count, created_at, updated_at
       FROM observation_event_guest_media WHERE session_id = ? AND submission_id = ? LIMIT 1`
  ).bind(sessionId, submissionId).first<ObservationEventGuestMediaRow>();
  if (!row || row.media_state !== "saved" || row.rights_review_status === "withdrawn") return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
  const participantOwns = actor.participant?.participant_id === row.participant_id && isObservationEventParticipatingGroup(actor.participant);
  const organizerCanReview = !actor.auth?.banned && actor.auth?.userId === session.organizerUserId
    && (row.rights_review_status === "pending" || isEventDiscoveryProfile(session.config));
  if (!participantOwns && !organizerCanReview) return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
  const object = await env.ASSET_BUCKET.get(row.asset_key);
  if (!object) return json({ error: "private_media_unavailable" }, 404, { "cache-control": "no-store" });
  return new Response(object.body, { headers: { "cache-control": "private, no-store", "content-type": row.mime, "content-length": String(row.bytes), "x-content-type-options": "nosniff", "content-security-policy": "default-src 'none'; sandbox" } });
}

export async function reviewObservationEventGuestMedia(request: Request, env: Env, sessionId: string, submissionId: string): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session || !observationEventGuestMediaEnabled(env, session)) return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  if (isEventDiscoveryProfile(session.config)) {
    const result = await new EventDiscoveryStore(env.OBS_DB, env.ASSET_BUCKET).review(sessionId, submissionId, auth.auth.userId, parseDiscoveryReviewInput(body));
    return json(result, 200, { "cache-control": "no-store", "x-robots-tag": "noindex, nofollow, noarchive" });
  }
  const decision = normalizeOptionalText(body.decision);
  const note = normalizeOptionalText(body.note) ?? "";
  if (!(decision === "approved" || decision === "rejected") || note.length < 8 || note.length > 500) return json({ error: "decision_and_review_note_required" }, 400, { "cache-control": "no-store" });
  const result = await env.OBS_DB.prepare(
    `UPDATE observation_event_guest_media SET rights_review_status = ?, rights_reviewed_by = ?,
       rights_reviewed_at = CURRENT_TIMESTAMP, rights_review_note = ?, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ? AND submission_id = ? AND media_state = 'saved' AND rights_review_status = 'pending'`
  ).bind(decision, auth.auth.userId, note, sessionId, submissionId).run() as { meta?: { changes?: number } };
  if (Number(result.meta?.changes ?? 0) !== 1) return json({ error: "pending_media_not_found" }, 404, { "cache-control": "no-store" });
  return json({ receiptId: submissionId, rightsReviewStatus: decision, visibility: "private", publicProjection: false }, 200, { "cache-control": "no-store" });
}

export async function withdrawObservationEventGuestMedia(request: Request, env: Env, sessionId: string, submissionId: string): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session || !observationEventGuestMediaEnabled(env, session)) return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
  const actor = await observationEventGuestMediaActor(request, env, sessionId);
  if (!actor.participant) return json({ error: "participant_required" }, 403, { "cache-control": "no-store" });
  const row = await env.OBS_DB.prepare(
    "SELECT submission_id, session_id, participant_id, actor_user_id, asset_key, request_sha256, media_sha256, mime, bytes, media_state, idempotency_key, rights_review_status, rights_reviewed_by, rights_reviewed_at, rights_review_note, visibility, private_delete_pending, active_upload_count, created_at, updated_at FROM observation_event_guest_media WHERE session_id = ? AND submission_id = ? LIMIT 1"
  ).bind(sessionId, submissionId).first<ObservationEventGuestMediaRow>();
  if (!row || row.participant_id !== actor.participant.participant_id) return json({ error: "receipt_not_found" }, 404, { "cache-control": "no-store" });
  const fenced = await env.OBS_DB.prepare(
    `UPDATE observation_event_guest_media SET rights_review_status = 'withdrawn', private_delete_pending = 1, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ? AND submission_id = ? AND participant_id = ?`
  ).bind(sessionId, submissionId, actor.participant.participant_id).run() as { meta?: { changes?: number } };
  if (Number(fenced.meta?.changes ?? 0) !== 1) return json({ error: "receipt_claim_changed" }, 409, { "cache-control": "no-store" });
  if (isEventDiscoveryProfile(session.config)) {
    await new EventDiscoveryStore(env.OBS_DB, env.ASSET_BUCKET).withdraw(sessionId, submissionId);
  }
  const cleanup = await reconcileObservationEventGuestMediaDelete(env, submissionId);
  if (cleanup.error) return json({ error: cleanup.error }, 503, { "cache-control": "no-store" });
  if (!cleanup.complete) return json({ error: "withdrawal_cleanup_pending" }, 409, { "cache-control": "no-store" });
  return json({ receiptId: submissionId, rightsReviewStatus: "withdrawn", visibility: "private", publicProjection: false }, 200, { "cache-control": "no-store" });
}

async function reconcileObservationEventGuestMediaDelete(env: Env, submissionId: string): Promise<{ complete: boolean; error?: string }> {
  const row = await env.OBS_DB.prepare("SELECT submission_id, session_id, participant_id, actor_user_id, asset_key, request_sha256, media_sha256, mime, bytes, media_state, idempotency_key, rights_review_status, rights_reviewed_by, rights_reviewed_at, rights_review_note, visibility, private_delete_pending, active_upload_count, created_at, updated_at FROM observation_event_guest_media WHERE submission_id = ? LIMIT 1").bind(submissionId).first<ObservationEventGuestMediaRow>();
  if (!row || row.rights_review_status !== "withdrawn") return { complete: true };
  try {
    await env.ASSET_BUCKET.delete(row.asset_key);
    if (await env.ASSET_BUCKET.head(row.asset_key)) return { complete: false, error: "private_media_delete_unverified" };
  } catch { return { complete: false, error: "private_media_delete_failed" }; }
  if (row.active_upload_count > 0) return { complete: false };
  await env.OBS_DB.prepare("UPDATE observation_event_guest_media SET private_delete_pending = 0, updated_at = CURRENT_TIMESTAMP WHERE submission_id = ? AND rights_review_status = 'withdrawn' AND active_upload_count = 0").bind(submissionId).run();
  const verified = await env.OBS_DB.prepare("SELECT submission_id, session_id, participant_id, actor_user_id, asset_key, request_sha256, media_sha256, mime, bytes, media_state, idempotency_key, rights_review_status, rights_reviewed_by, rights_reviewed_at, rights_review_note, visibility, private_delete_pending, active_upload_count, created_at, updated_at FROM observation_event_guest_media WHERE submission_id = ? LIMIT 1").bind(submissionId).first<ObservationEventGuestMediaRow>();
  if (verified?.rights_review_status !== "withdrawn" || verified.private_delete_pending !== 0 || verified.active_upload_count !== 0) return { complete: false };
  try { if (await env.ASSET_BUCKET.head(row.asset_key)) return { complete: false, error: "private_media_delete_unverified" }; }
  catch { return { complete: false, error: "private_media_delete_unverified" }; }
  return { complete: true };
}

export async function handleObservationEventRallyApi(request: Request, env: Env, sessionId: string, pathRemainder: string): Promise<Response> {
  if (request.method !== "GET") {
    const sameOriginError = assertSameOriginRequest(request);
    if (sameOriginError) return sameOriginError;
  }
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const parts = pathRemainder.split("/").filter(Boolean);
  if (request.method === "GET" && parts.length === 0) {
    const viewer = await observationEventParticipantContext(request, env, session);
    if (!viewer.isOrganizer && !viewer.isCheckedInParticipant) {
      return json({ error: "event participant required" }, 403, { "cache-control": "no-store" });
    }
    const rally = await getObservationRallySnapshot(env, sessionId, viewer, session);
    const receipts = viewer.isOrganizer
      ? await listObservationRallyReviewQueue(env, sessionId, rally.course?.courseId ?? null)
      : await listOwnObservationRallyPendingSubmissions(env, sessionId, rally.course?.courseId ?? null, viewer);
    return json({ rally: { ...rally, ...receipts } }, 200, { "cache-control": "no-store" });
  }
  if (request.method === "POST" && parts[0] === "course" && parts.length === 1) {
    return upsertObservationRallyCourse(request, env, sessionId);
  }
  if (request.method === "POST" && parts[0] === "stations" && parts.length === 1) {
    return createObservationRallyStation(request, env, sessionId);
  }
  if (request.method === "POST" && parts[0] === "missions" && parts.length === 1) {
    return createObservationRallyMission(request, env, sessionId);
  }
  if (request.method === "PATCH" && parts[0] === "missions" && parts[1] && parts.length === 2) {
    return changeObservationRallyMission(request, env, sessionId, parts[1]);
  }
  if (request.method === "POST" && parts[0] === "preflight" && parts[1] === "weather-mode" && parts.length === 2) {
    return switchObservationRallyWeatherMode(request, env, sessionId);
  }
  if (request.method === "POST" && parts[0] === "submissions" && parts.length === 1) {
    return createObservationRallySubmission(request, env, sessionId);
  }
  if (request.method === "PATCH" && parts[0] === "submissions" && parts[1] && parts[2] === "review" && parts.length === 3) {
    return reviewObservationRallySubmission(request, env, sessionId, parts[1]);
  }
  return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
}

async function upsertObservationRallyCourse(request: Request, env: Env, sessionId: string): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request);
  if (sameOriginError) return sameOriginError;
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  if (body.action === "prepare_template") {
    const preparationOriginError = assertSameOriginRequest(request, true);
    if (preparationOriginError) return preparationOriginError;
    if (!isCommonEventTemplateConfig(auth.session.config.event_template)) return json({ error: "event_template_contract_invalid" }, 400, { "cache-control": "no-store" });
    try {
      const course = await prepareCommonObservationEventTemplate(env, auth.session, auth.auth.userId);
      return json({ course }, 200, { "cache-control": "no-store" });
    } catch {
      return json({ error: "event_template_setup_unavailable" }, 503, { "cache-control": "no-store" });
    }
  }
  if (body.action !== undefined) return json({ error: "invalid action" }, 400, { "cache-control": "no-store" });
  const existing = await getObservationRallyCourseBySession(env, sessionId);
  const status = normalizeRallyCourseStatus(body.status) ?? existing?.status ?? "preflight";
  if (status === "live" && !isObservationEventCheckinOpen(auth.session)) return json({ error: "event_rally_closed" }, 409, { "cache-control": "no-store" });
  const course = await ensureObservationRallyCourse(env, sessionId, auth.auth.userId, {
    title: normalizeOptionalText(body.title) ?? existing?.title ?? "観察ラリー",
    status,
    config: asPlainObject(body.config) ?? existing?.config ?? {}
  });
  return json({ course }, 200, { "cache-control": "no-store" });
}

async function createObservationRallyStation(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  const name = normalizeOptionalText(body.name);
  if (!name) return json({ error: "name required" }, 400, { "cache-control": "no-store" });
  const course = await ensureObservationRallyCourse(env, sessionId, auth.auth.userId);
  const stationId = crypto.randomUUID();
  await env.OBS_DB.prepare(
    `INSERT INTO observation_rally_stations (
       station_id, course_id, field_id, code, name, description, lat, lng, radius_m,
       polygon_json, route_geojson, is_private, access_note, danger_note, status, sort_order
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`
  ).bind(
    stationId,
    course.courseId,
    normalizeOptionalText(body.field_id),
    normalizeOptionalText(body.code) ?? "",
    name,
    normalizeOptionalText(body.description) ?? "",
    numberOrNullFromUnknown(body.lat),
    numberOrNullFromUnknown(body.lng),
    numberOrNullFromUnknown(body.radius_m),
    JSON.stringify(asPlainObject(body.polygon) ?? null),
    JSON.stringify(asPlainObject(body.route_geojson) ?? null),
    body.is_private === true ? 1 : 0,
    normalizeOptionalText(body.access_note) ?? "",
    normalizeOptionalText(body.danger_note) ?? "",
    Math.round(numberOrNullFromUnknown(body.sort_order) ?? 0)
  ).run();
  const station = (await listObservationRallyStations(env, course.courseId)).find((row) => row.stationId === stationId);
  await appendObservationEventLive(env, { sessionId, type: "rally_station_opened", scope: "all", actorUserId: auth.auth.userId, payload: { station_id: stationId, name } });
  return json({ station }, 201, { "cache-control": "no-store" });
}

async function createObservationRallyMission(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  const title = normalizeOptionalText(body.title);
  const target = normalizeOptionalText(body.target);
  const goalCount = numberOrNullFromUnknown(body.goal_count);
  if (!title || !target || goalCount === null || goalCount <= 0) {
    return json({ error: "title, target, positive goal_count required" }, 400, { "cache-control": "no-store" });
  }
  const course = await ensureObservationRallyCourse(env, sessionId, auth.auth.userId);
  const stationId = normalizeOptionalText(body.station_id);
  if (stationId && !(await listObservationRallyStations(env, course.courseId)).some((station) => station.stationId === stationId)) {
    return json({ error: "station not found" }, 404, { "cache-control": "no-store" });
  }
  const replacementId = normalizeOptionalText(body.replacement_for_mission_id);
  if (replacementId && (await getObservationRallyMission(env, replacementId))?.course_id !== course.courseId) {
    return json({ error: "replacement mission not found" }, 404, { "cache-control": "no-store" });
  }
  const missionId = crypto.randomUUID();
  const scope = normalizeRallyScope(body.scope) ?? "event";
  const locationBinding = normalizeRallyLocationBinding(body.location_binding) ?? "none";
  const countUnit = normalizeRallyCountUnit(body.count_unit) ?? "scene";
  const verificationPolicy = normalizeRallyVerificationPolicy(body.verification_policy) ?? "auto";
  const weatherSensitivity = normalizeRallyWeatherSensitivity(body.weather_sensitivity) ?? "all_weather";
  const status = normalizeRallyMissionStatus(body.status) ?? "draft";
  await env.OBS_DB.prepare(
    `INSERT INTO observation_rally_missions (
       mission_id, course_id, station_id, replacement_for_mission_id, scope, location_binding,
       title, target, count_unit, goal_count, counting_policy_json, verification_policy,
       weather_sensitivity, fallback_group, status, starts_at, ends_at, sort_order, created_by
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    missionId,
    course.courseId,
    stationId,
    replacementId,
    scope,
    locationBinding,
    title,
    target,
    countUnit,
    goalCount,
    JSON.stringify(asPlainObject(body.counting_policy) ?? {}),
    verificationPolicy,
    weatherSensitivity,
    normalizeOptionalText(body.fallback_group) ?? "",
    status,
    normalizeOptionalText(body.starts_at),
    normalizeOptionalText(body.ends_at),
    Math.round(numberOrNullFromUnknown(body.sort_order) ?? 0),
    auth.auth.userId
  ).run();
  const mission = await getObservationRallyMission(env, missionId);
  await appendObservationEventLive(env, { sessionId, type: "rally_mission_published", scope: "all", actorUserId: auth.auth.userId, payload: { mission_id: missionId, status } });
  return json({ mission: mission ? mapObservationRallyMission(mission) : null }, 201, { "cache-control": "no-store" });
}

async function changeObservationRallyMission(request: Request, env: Env, sessionId: string, missionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const current = await getObservationRallyMission(env, missionId);
  const course = await getObservationRallyCourseBySession(env, sessionId);
  if (!current || current.course_id !== course?.courseId) return json({ error: "mission not found" }, 404, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const action = normalizeRallyRevisionAction(body.action);
  if (!action) return json({ error: "invalid action" }, 400, { "cache-control": "no-store" });
  if (action === "edit") {
    const sameOriginError = assertSameOriginRequest(request, true);
    if (sameOriginError) return sameOriginError;
    if (current.status !== "draft") return json({ error: "draft_mission_required" }, 409, { "cache-control": "no-store" });
    const title = body.title === undefined ? current.title : normalizeOptionalText(body.title);
    const target = body.target === undefined ? current.target : normalizeOptionalText(body.target);
    const goalCount = body.goal_count === undefined ? current.goal_count : numberOrNullFromUnknown(body.goal_count);
    if (!title || title.length > 160 || !target || target.length > 1200 || goalCount === null || !Number.isFinite(goalCount) || goalCount <= 0) {
      return json({ error: "valid_title_target_positive_goal_required" }, 400, { "cache-control": "no-store" });
    }
    if (title === current.title && target === current.target && goalCount === current.goal_count) {
      return json({ mission: mapObservationRallyMission(current) }, 200, { "cache-control": "no-store" });
    }
    const updated = await env.OBS_DB.prepare(
      "UPDATE observation_rally_missions SET title = ?, target = ?, goal_count = ?, updated_at = CURRENT_TIMESTAMP WHERE mission_id = ? AND course_id = ? AND status = 'draft'"
    ).bind(title, target, goalCount, missionId, course.courseId).run() as { meta?: { changes?: number } };
    if (Number(updated.meta?.changes ?? 0) === 0) return json({ error: "draft_mission_required" }, 409, { "cache-control": "no-store" });
    await appendObservationRallyRevision(env, course.courseId, missionId, action, auth.auth.userId, "", mapObservationRallyMission(current), { title, target, goalCount });
    const mission = await getObservationRallyMission(env, missionId);
    return json({ mission: mission ? mapObservationRallyMission(mission) : null }, 200, { "cache-control": "no-store" });
  }
  const nextStatus = action === "publish" ? "published" : action === "pause" ? "paused" : action === "replace" ? "replaced" : action === "close" ? "closed" : current.status;
  const nextGoal = numberOrNullFromUnknown(body.goal_count) ?? current.goal_count;
  if (!Number.isFinite(nextGoal) || nextGoal <= 0) return json({ error: "positive goal_count required" }, 400, { "cache-control": "no-store" });
  const nextEndsAt = body.ends_at === undefined ? current.ends_at : normalizeOptionalText(body.ends_at);
  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
      "UPDATE observation_rally_missions SET status = ?, goal_count = ?, ends_at = ?, updated_at = CURRENT_TIMESTAMP WHERE mission_id = ? AND course_id = ?"
    ).bind(nextStatus, nextGoal, nextEndsAt, missionId, course.courseId),
    ...observationRallyProgressRefreshStatements(env, missionId)
  ]);
  await appendObservationRallyRevision(env, current.course_id, missionId, action, auth.auth.userId, normalizeOptionalText(body.reason) ?? "", mapObservationRallyMission(current), { status: nextStatus, goalCount: nextGoal, endsAt: nextEndsAt });
  const eventType = action === "pause" ? "rally_mission_paused" : action === "replace" ? "rally_mission_replaced" : action === "extend" ? "rally_mission_extended" : action === "close" ? "rally_mission_closed" : "rally_mission_published";
  await appendObservationEventLive(env, { sessionId, type: eventType, scope: "all", actorUserId: auth.auth.userId, payload: { mission_id: missionId, action, status: nextStatus } });
  const mission = await getObservationRallyMission(env, missionId);
  return json({ mission: mission ? mapObservationRallyMission(mission) : null }, 200, { "cache-control": "no-store" });
}

async function switchObservationRallyWeatherMode(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  if (normalizeOptionalText(body.mode) !== "rain") return json({ error: "invalid weather mode" }, 400, { "cache-control": "no-store" });
  const course = await ensureObservationRallyCourse(env, sessionId, auth.auth.userId);
  await appendObservationEventLive(env, { sessionId, type: "rally_next_action", scope: "all", actorUserId: auth.auth.userId, payload: { mode: "rain", reason: normalizeOptionalText(body.reason) ?? "" } });
  return json({ course, mode: "rain", affectedMissions: 0 }, 200, { "cache-control": "no-store" });
}

async function createObservationRallySubmission(request: Request, env: Env, sessionId: string): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const { auth, guestToken } = await observationEventRequestActor(request, env, sessionId);
  const body = await readJson<Record<string, unknown>>(request);
  if (auth?.banned || (!auth && !guestToken)) return json({ error: "participant required" }, 403, { "cache-control": "no-store" });
  const missionId = normalizeOptionalText(body.mission_id);
  if (!missionId) return json({ error: "mission_id required" }, 400, { "cache-control": "no-store" });
  const mission = await getObservationRallyMission(env, missionId);
  if (!mission) return json({ error: "mission not found" }, 404, { "cache-control": "no-store" });
  const course = await getObservationRallyCourseBySession(env, sessionId);
  if (!course || course.courseId !== mission.course_id) return json({ error: "rally course not found" }, 404, { "cache-control": "no-store" });
  const participant = await findObservationEventParticipant(env, sessionId, auth?.userId ?? null, guestToken);
  if (!participant || participant.status !== "checked_in") return json({ error: "checked_in_participant_required" }, 403, { "cache-control": "no-store" });
  const teamId = participant.team_id;
  if (mission.scope === "team" && !teamId) return json({ error: "team_required" }, 400, { "cache-control": "no-store" });
  const countValue = body.count_value === undefined ? 1 : numberOrNullFromUnknown(body.count_value);
  if (countValue === null || countValue <= 0 || !Number.isFinite(countValue)) return json({ error: "positive count_value required" }, 400, { "cache-control": "no-store" });
  const stationId = normalizeOptionalText(body.station_id) ?? mission.station_id;
  if (mission.station_id && stationId !== mission.station_id) return json({ error: "mission_station_mismatch" }, 400, { "cache-control": "no-store" });
  if (stationId && !(await listObservationRallyStations(env, course.courseId)).some((station) => station.stationId === stationId && station.status === "open")) {
    return json({ error: "station not found" }, 404, { "cache-control": "no-store" });
  }
  if (!stationId && ["station_required", "any_registered_station"].includes(mission.location_binding)) return json({ error: "station required" }, 400, { "cache-control": "no-store" });
  const lat = numberOrNullFromUnknown(body.lat);
  const lng = numberOrNullFromUnknown(body.lng);
  if ((lat === null) !== (lng === null) || (lat !== null && (lat < -90 || lat > 90)) || (lng !== null && (lng < -180 || lng > 180))) {
    return json({ error: "invalid coordinates" }, 400, { "cache-control": "no-store" });
  }
  const publicLat = lat === null ? null : roundPublicEventCoordinate(lat);
  const publicLng = lng === null ? null : roundPublicEventCoordinate(lng);
  const requestId = normalizeOptionalText(body.request_id);
  if (body.request_id !== undefined && (!requestId || !/^[A-Za-z0-9_-]{16,128}$/u.test(requestId))) return json({ error: "invalid request_id" }, 400, { "cache-control": "no-store" });
  const sourceType = normalizeOptionalText(body.source_type) ?? "manual_rally";
  if (sourceType !== "manual_rally") return json({ error: "invalid source_type" }, 400, { "cache-control": "no-store" });
  const sourceRef = normalizeOptionalText(body.source_ref);
  const payload = asPlainObject(body.payload) ?? {};
  delete payload._rally_request;
  const fingerprint = await sha256Hex(textToArrayBuffer(stableJson({ stationId, countValue, publicLat, publicLng, sourceType, sourceRef, payload })));
  const submissionId = requestId
    ? `rally_${await sha256Hex(textToArrayBuffer(JSON.stringify([sessionId, participant.participant_id, missionId, requestId])))}`
    : crypto.randomUUID();
  const existing = await getObservationRallySubmission(env, submissionId);
  if (existing && (existing.session_id !== sessionId || jsonObject(existing.payload_json)._rally_request !== fingerprint)) return json({ error: "request_id_conflict" }, 409, { "cache-control": "no-store" });
  // A response can be lost just before an event or mission closes. An exact replay
  // still returns the saved receipt, while a new action must meet the current gates.
  const nowMs = Date.now();
  if (!existing && (!isObservationEventActivityOpen(session, nowMs) || course.status !== "live" || mission.status !== "published" ||
    (mission.starts_at !== null && !(Date.parse(mission.starts_at) <= nowMs)) ||
    (mission.ends_at !== null && !(Date.parse(mission.ends_at) > nowMs)))) {
    return json({ error: "rally_submission_closed" }, 409, { "cache-control": "no-store" });
  }
  const reviewStatus = mission.verification_policy === "auto" ? "auto_accepted" : "pending";
  const results = await env.OBS_DB.batch([
    env.OBS_DB.prepare(
    `INSERT INTO observation_rally_submissions (
       submission_id, session_id, course_id, mission_id, station_id, user_id, guest_token, team_id,
       source_type, source_ref, count_value, public_lat, public_lng, payload_json, review_status
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT DO NOTHING`
  ).bind(
    submissionId,
    sessionId,
    course.courseId,
    missionId,
    stationId,
    auth?.userId ?? null,
    guestToken,
    teamId,
    sourceType,
    sourceRef,
    countValue,
    publicLat,
    publicLng,
    JSON.stringify({ ...payload, _rally_request: fingerprint }),
    reviewStatus
    ),
    ...observationRallyProgressRefreshStatements(env, missionId)
  ]);
  const submission = await getObservationRallySubmission(env, submissionId);
  if (!submission || submission.session_id !== sessionId || jsonObject(submission.payload_json)._rally_request !== fingerprint) return json({ error: "request_id_conflict" }, 409, { "cache-control": "no-store" });
  const created = Number((results[0] as { meta?: { changes?: number } })?.meta?.changes ?? 0) === 1;
  if (created) {
    if (publicLat !== null && publicLng !== null) await recordObservationEventMeshVisit(env, { sessionId, lat: publicLat, lng: publicLng, observationDelta: 1, teamId });
    await appendObservationEventLive(env, { sessionId, type: "rally_task_submitted", scope: "all", actorUserId: auth?.userId ?? null, actorGuestToken: guestToken, teamId, payload: { submission_id: submissionId, mission_id: missionId, review_status: reviewStatus } });
  }
  return json({ submission: mapObservationRallySubmission(submission), replayed: !created }, created ? 201 : 200, { "cache-control": "no-store" });
}

async function reviewObservationRallySubmission(request: Request, env: Env, sessionId: string, submissionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const current = await getObservationRallySubmission(env, submissionId);
  const course = await getObservationRallyCourseBySession(env, sessionId);
  if (!current || current.session_id !== sessionId || current.course_id !== course?.courseId) return json({ error: "submission not found" }, 404, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const next = body.review_status;
  if (next !== "accepted" && next !== "rejected") return json({ error: "invalid review_status" }, 400, { "cache-control": "no-store" });
  await env.OBS_DB.batch([
    env.OBS_DB.prepare(
    "UPDATE observation_rally_submissions SET review_status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE submission_id = ? AND session_id = ?"
    ).bind(next, auth.auth.userId, submissionId, sessionId),
    ...observationRallyProgressRefreshStatements(env, current.mission_id)
  ]);
  if (current.review_status !== next) await appendObservationEventLive(env, { sessionId, type: "rally_task_cleared", scope: "all", actorUserId: auth.auth.userId, payload: { submission_id: submissionId, review_status: next } });
  const submission = await getObservationRallySubmission(env, submissionId);
  return json({ submission: submission ? mapObservationRallySubmission(submission) : null }, 200, { "cache-control": "no-store" });
}

export async function getObservationEventSessionByEventCode(env: Env, eventCode: string) {
  const row = await env.OBS_DB.prepare(
    `SELECT session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id,
            plan, primary_mode, active_modes_json, location_lat, location_lng, location_radius_m,
            started_at, ended_at, target_species_json, config_json, field_id, template_source_session_id,
            created_at, updated_at
       FROM observation_event_sessions
      WHERE event_code = ?`
  ).bind(eventCode).first<ObservationEventSessionD1Row>();
  return row ? mapObservationEventSession(row) : null;
}

export async function getObservationRallySnapshot(
  env: Env,
  sessionId: string,
  viewer?: Awaited<ReturnType<typeof observationEventParticipantContext>>,
  session?: ObservationEventTemplate
) {
  const course = await getObservationRallyCourseBySession(env, sessionId);
  if (!course) return { course: null, stations: [], missions: [], progress: [], readOnly: true };
  const [stations, missions, progress] = await Promise.all([
    listObservationRallyStations(env, course.courseId),
    listObservationRallyMissions(env, course.courseId),
    listObservationRallyProgress(env, course.courseId)
  ]);
  const readOnly = course.status !== "live" || Boolean(session && !isObservationEventActivityOpen(session)) || Boolean(viewer && !viewer.isActiveParticipant);
  if (!viewer || viewer.isOrganizer) return { course, stations, missions, progress, readOnly };
  const visibleMissions = missions.filter((mission) => mission.status !== "draft");
  const missionIds = new Set(visibleMissions.map((mission) => mission.missionId));
  const participantKeys = new Set([
    viewer.userId ? `user:${viewer.userId}` : null,
    viewer.guestToken ? `guest:${viewer.guestToken}` : null
  ].filter((key): key is string => key !== null));
  return {
    course: { ...course, createdBy: null },
    stations: stations.filter((station) => !station.isPrivate),
    missions: visibleMissions.map((mission) => ({ ...mission, createdBy: null })),
    progress: progress.filter((entry) => missionIds.has(entry.missionId) && (
      entry.progressScope === "event" || entry.progressScope === "station" ||
      (entry.progressScope === "team" && entry.teamId === viewer.teamId) ||
      (entry.progressScope === "participant" && participantKeys.has(entry.participantKey ?? ""))
    )).map((entry) => ({ ...entry, participantKey: null })),
    readOnly
  };
}

export async function getObservationRallyCourseBySession(env: Env, sessionId: string) {
  const row = await env.OBS_DB.prepare(
    `SELECT course_id, session_id, title, status, config_json, created_by, created_at, updated_at
       FROM observation_rally_courses
      WHERE session_id = ?`
  ).bind(sessionId).first<ObservationRallyCourseD1Row>();
  return row ? mapObservationRallyCourse(row) : null;
}

export async function prepareCommonObservationEventTemplate(
  env: Env,
  session: ObservationEventTemplate,
  actorUserId: string
) {
  const draft = buildCommonEventTemplateDraft(session.config.event_template, { title: session.title });
  if (!draft) return null;
  const existing = await getObservationRallyCourseBySession(env, session.sessionId);
  if (existing) return existing;
  const identity = await sha256Hex(textToArrayBuffer(JSON.stringify([session.sessionId, draft.presetVersion, draft.template.key])));
  const courseId = `rally_template_${identity}`;
  const statements = [env.OBS_DB.prepare(
    `INSERT INTO observation_rally_courses (course_id, session_id, title, status, config_json, created_by)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO NOTHING`
  ).bind(courseId, session.sessionId, draft.course.title, draft.course.status, JSON.stringify(draft.course.config), actorUserId)];
  for (const mission of draft.missions) {
    statements.push(env.OBS_DB.prepare(
      `INSERT INTO observation_rally_missions (
         mission_id, course_id, station_id, replacement_for_mission_id, scope, location_binding,
         title, target, count_unit, goal_count, counting_policy_json, verification_policy,
         weather_sensitivity, fallback_group, status, starts_at, ends_at, sort_order, created_by
       ) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE EXISTS (SELECT 1 FROM observation_rally_courses WHERE course_id = ? AND session_id = ?)
       ON CONFLICT(mission_id) DO NOTHING`
    ).bind(
      `${courseId}_${mission.presetStepKey}`, courseId, mission.stationId, mission.replacementForMissionId,
      mission.scope, mission.locationBinding, mission.title, mission.target, mission.countUnit, mission.goalCount,
      JSON.stringify(mission.countingPolicy), mission.verificationPolicy, mission.weatherSensitivity,
      mission.fallbackGroup, mission.status, mission.startsAt, mission.endsAt, mission.sortOrder, actorUserId,
      courseId, session.sessionId
    ));
  }
  // Course and all missions commit together. A concurrently created manual
  // course keeps its own ID; the guarded inserts cannot add template missions to it.
  await env.OBS_DB.batch(statements);
  const prepared = await getObservationRallyCourseBySession(env, session.sessionId);
  if (!prepared) throw new Error("event_template_setup_unavailable");
  return prepared;
}

async function ensureObservationRallyCourse(env: Env, sessionId: string, actorUserId: string | null, input?: { title?: string; status?: string; config?: Record<string, unknown> }) {
  const existing = await getObservationRallyCourseBySession(env, sessionId);
  if (existing) {
    if (input) {
      await env.OBS_DB.prepare(
        "UPDATE observation_rally_courses SET title = ?, status = ?, config_json = ?, updated_at = CURRENT_TIMESTAMP WHERE course_id = ?"
      ).bind(input.title ?? existing.title, normalizeRallyCourseStatus(input.status) ?? existing.status, JSON.stringify(input.config ?? existing.config), existing.courseId).run();
      return (await getObservationRallyCourseBySession(env, sessionId)) ?? existing;
    }
    return existing;
  }
  const courseId = crypto.randomUUID();
  await env.OBS_DB.prepare(
    "INSERT INTO observation_rally_courses (course_id, session_id, title, status, config_json, created_by) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(courseId, sessionId, input?.title ?? "観察ラリー", normalizeRallyCourseStatus(input?.status) ?? "preflight", JSON.stringify(input?.config ?? {}), actorUserId).run();
  return (await getObservationRallyCourseBySession(env, sessionId)) ?? {
    courseId,
    sessionId,
    title: input?.title ?? "観察ラリー",
    status: normalizeRallyCourseStatus(input?.status) ?? "preflight",
    config: input?.config ?? {},
    createdBy: actorUserId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function listObservationRallyStations(env: Env, courseId: string) {
  const rows = await env.OBS_DB.prepare(
    `SELECT station_id, course_id, field_id, code, name, description, lat, lng, radius_m,
            polygon_json, route_geojson, is_private, access_note, danger_note, status, sort_order, created_at, updated_at
       FROM observation_rally_stations
      WHERE course_id = ?
      ORDER BY sort_order ASC, created_at ASC`
  ).bind(courseId).all<ObservationRallyStationD1Row>();
  return rows.results.map(mapObservationRallyStation);
}

async function listObservationRallyMissions(env: Env, courseId: string) {
  const rows = await env.OBS_DB.prepare(
    `SELECT mission_id, course_id, station_id, replacement_for_mission_id, scope, location_binding,
            title, target, count_unit, goal_count, counting_policy_json, verification_policy,
            weather_sensitivity, fallback_group, status, starts_at, ends_at, sort_order, created_by, created_at, updated_at
       FROM observation_rally_missions
      WHERE course_id = ?
      ORDER BY sort_order ASC, created_at ASC`
  ).bind(courseId).all<ObservationRallyMissionD1Row>();
  return rows.results.map(mapObservationRallyMission);
}

async function getObservationRallyMission(env: Env, missionId: string) {
  return env.OBS_DB.prepare(
    `SELECT mission_id, course_id, station_id, replacement_for_mission_id, scope, location_binding,
            title, target, count_unit, goal_count, counting_policy_json, verification_policy,
            weather_sensitivity, fallback_group, status, starts_at, ends_at, sort_order, created_by, created_at, updated_at
       FROM observation_rally_missions
      WHERE mission_id = ?`
  ).bind(missionId).first<ObservationRallyMissionD1Row>();
}

async function getObservationRallySubmission(env: Env, submissionId: string) {
  return env.OBS_DB.prepare(
    `SELECT submission_id, session_id, course_id, mission_id, station_id, user_id, guest_token,
            team_id, source_type, source_ref, count_value, public_lat, public_lng, payload_json,
            review_status, created_at
       FROM observation_rally_submissions
      WHERE submission_id = ?`
  ).bind(submissionId).first<ObservationRallySubmissionD1Row>();
}

async function listObservationRallyReviewQueue(env: Env, sessionId: string, courseId: string | null) {
  if (!courseId) return { reviewQueue: [], reviewQueueHasMore: false };
  const rows = await env.OBS_DB.prepare(
    `SELECT submission_id, mission_id, count_value, review_status, created_at
       FROM observation_rally_submissions
      WHERE session_id = ? AND course_id = ? AND source_type = 'manual_rally' AND review_status = 'pending'
      ORDER BY created_at ASC, submission_id ASC LIMIT 101`
  ).bind(sessionId, courseId).all<{ submission_id: string; mission_id: string; count_value: number; review_status: "pending"; created_at: string }>();
  return {
    reviewQueue: rows.results.slice(0, 100).map((row) => ({
      submissionId: row.submission_id, missionId: row.mission_id, countValue: row.count_value,
      reviewStatus: row.review_status, createdAt: row.created_at
    })),
    reviewQueueHasMore: rows.results.length > 100
  };
}

async function listOwnObservationRallyPendingSubmissions(
  env: Env,
  sessionId: string,
  courseId: string | null,
  participant: { participantUserId: string | null; participantGuestToken: string | null }
) {
  if (!courseId || (!participant.participantUserId && !participant.participantGuestToken)) {
    return { pendingSubmissions: [], pendingSubmissionsHasMore: false };
  }
  const rows = await env.OBS_DB.prepare(
    `SELECT submission_id, mission_id, count_value, review_status, created_at
       FROM observation_rally_submissions
      WHERE session_id = ? AND course_id = ? AND source_type = 'manual_rally' AND review_status = 'pending'
        AND ((? IS NOT NULL AND user_id = ?) OR (? IS NOT NULL AND user_id IS NULL AND guest_token = ?))
      ORDER BY created_at DESC, submission_id DESC LIMIT 101`
  ).bind(sessionId, courseId, participant.participantUserId, participant.participantUserId, participant.participantGuestToken, participant.participantGuestToken)
    .all<{ submission_id: string; mission_id: string; count_value: number; review_status: "pending"; created_at: string }>();
  return {
    pendingSubmissions: rows.results.slice(0, 100).map((row) => ({
      submissionId: row.submission_id, missionId: row.mission_id, countValue: row.count_value,
      reviewStatus: row.review_status, createdAt: row.created_at
    })),
    pendingSubmissionsHasMore: rows.results.length > 100
  };
}

async function listObservationRallyProgress(env: Env, courseId: string) {
  const rows = await env.OBS_DB.prepare(
    `SELECT progress_id, course_id, mission_id, progress_scope, team_id, participant_key, station_id,
            actual_count, goal_count, percent, status, updated_at
       FROM observation_rally_progress
      WHERE course_id = ?
      ORDER BY updated_at DESC`
  ).bind(courseId).all<ObservationRallyProgressD1Row>();
  return rows.results.map(mapObservationRallyProgress);
}

function observationRallyProgressRefreshStatements(env: Env, missionId: string): D1PreparedStatement[] {
  // The submission is canonical. Rebuild this mission's projection in the same
  // D1 batch transaction as the write/review, so retries and concurrent writers
  // cannot double-count or overwrite each other's increment. This also repairs
  // older duplicate projection rows caused by SQLite's nullable UNIQUE columns.
  return [
    env.OBS_DB.prepare("DELETE FROM observation_rally_progress WHERE mission_id = ?").bind(missionId),
    env.OBS_DB.prepare(
      `INSERT INTO observation_rally_progress (
         progress_id, course_id, mission_id, progress_scope, team_id, participant_key,
         station_id, actual_count, goal_count, percent, status
       )
       SELECT lower(hex(randomblob(16))),
              course_id, mission_id, progress_scope, team_id, participant_key, station_id,
              actual_count, goal_count, ROUND(100.0 * actual_count / goal_count, 2),
              CASE WHEN actual_count > goal_count THEN 'exceeded' WHEN actual_count >= goal_count THEN 'reached' ELSE 'active' END
       FROM (
         SELECT mission.course_id, mission.mission_id, mission.scope AS progress_scope,
                CASE WHEN mission.scope = 'team' THEN submission.team_id ELSE NULL END AS team_id,
                CASE WHEN mission.scope = 'participant' THEN
                  CASE WHEN submission.user_id IS NOT NULL THEN 'user:' || submission.user_id
                       WHEN submission.guest_token IS NOT NULL THEN 'guest:' || submission.guest_token ELSE NULL END
                  ELSE NULL END AS participant_key,
                CASE WHEN mission.scope = 'station' THEN COALESCE(submission.station_id, mission.station_id) ELSE NULL END AS station_id,
                SUM(CASE WHEN submission.review_status IN ('auto_accepted', 'accepted') THEN submission.count_value ELSE 0 END) AS actual_count,
                mission.goal_count
           FROM observation_rally_missions mission
           JOIN observation_rally_courses course ON course.course_id = mission.course_id
           JOIN observation_rally_submissions submission ON submission.mission_id = mission.mission_id
             AND submission.course_id = mission.course_id AND submission.session_id = course.session_id
          WHERE mission.mission_id = ? AND mission.goal_count > 0
          GROUP BY mission.mission_id, mission.scope,
            CASE WHEN mission.scope = 'team' THEN submission.team_id ELSE NULL END,
            CASE WHEN mission.scope = 'participant' THEN
              CASE WHEN submission.user_id IS NOT NULL THEN 'user:' || submission.user_id
                   WHEN submission.guest_token IS NOT NULL THEN 'guest:' || submission.guest_token ELSE NULL END ELSE NULL END,
            CASE WHEN mission.scope = 'station' THEN COALESCE(submission.station_id, mission.station_id) ELSE NULL END
       )`
    ).bind(missionId)
  ];
}

async function appendObservationRallyRevision(env: Env, courseId: string, missionId: string | null, action: string, actorUserId: string | null, reason: string, before: Record<string, unknown>, after: Record<string, unknown>): Promise<void> {
  await env.OBS_DB.prepare(
    `INSERT INTO observation_rally_revisions (
       revision_id, course_id, mission_id, action, reason, before_payload_json, after_payload_json, actor_user_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(crypto.randomUUID(), courseId, missionId, action, reason, JSON.stringify(before), JSON.stringify(after), actorUserId).run();
}

export function mapObservationRallyCourse(row: ObservationRallyCourseD1Row) {
  return {
    courseId: row.course_id,
    sessionId: row.session_id,
    title: row.title,
    status: normalizeRallyCourseStatus(row.status) ?? "draft",
    config: jsonObject(row.config_json),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapObservationRallyStation(row: ObservationRallyStationD1Row) {
  return {
    stationId: row.station_id,
    courseId: row.course_id,
    fieldId: row.field_id,
    code: row.code,
    name: row.name,
    description: row.description,
    lat: row.lat,
    lng: row.lng,
    radiusM: row.radius_m,
    polygon: row.polygon_json ? jsonObject(row.polygon_json) : null,
    routeGeojson: row.route_geojson ? jsonObject(row.route_geojson) : null,
    isPrivate: row.is_private === 1,
    accessNote: row.access_note,
    dangerNote: row.danger_note,
    status: row.status,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapObservationRallyMission(row: ObservationRallyMissionD1Row) {
  return {
    missionId: row.mission_id,
    courseId: row.course_id,
    stationId: row.station_id,
    replacementForMissionId: row.replacement_for_mission_id,
    scope: normalizeRallyScope(row.scope) ?? "event",
    locationBinding: normalizeRallyLocationBinding(row.location_binding) ?? "none",
    title: row.title,
    target: row.target,
    countUnit: normalizeRallyCountUnit(row.count_unit) ?? "scene",
    goalCount: Number(row.goal_count),
    countingPolicy: jsonObject(row.counting_policy_json),
    verificationPolicy: normalizeRallyVerificationPolicy(row.verification_policy) ?? "auto",
    weatherSensitivity: normalizeRallyWeatherSensitivity(row.weather_sensitivity) ?? "all_weather",
    fallbackGroup: row.fallback_group,
    status: normalizeRallyMissionStatus(row.status) ?? "draft",
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function mapObservationRallyProgress(row: ObservationRallyProgressD1Row) {
  return {
    progressId: row.progress_id,
    courseId: row.course_id,
    missionId: row.mission_id,
    progressScope: normalizeRallyScope(row.progress_scope) ?? "event",
    teamId: row.team_id,
    participantKey: row.participant_key,
    stationId: row.station_id,
    actualCount: Number(row.actual_count),
    goalCount: Number(row.goal_count),
    percent: Number(row.percent),
    status: row.status,
    updatedAt: row.updated_at
  };
}

function mapObservationRallySubmission(row: ObservationRallySubmissionD1Row) {
  const { _rally_request: _requestFingerprint, ...payload } = jsonObject(row.payload_json);
  return {
    submissionId: row.submission_id,
    sessionId: row.session_id,
    courseId: row.course_id,
    missionId: row.mission_id,
    stationId: row.station_id,
    userId: row.user_id,
    teamId: row.team_id,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    countValue: Number(row.count_value),
    publicLat: row.public_lat,
    publicLng: row.public_lng,
    payload,
    reviewStatus: row.review_status,
    createdAt: row.created_at
  };
}

function normalizeRallyCourseStatus(value: unknown): typeof RALLY_COURSE_STATUSES[number] | null {
  return typeof value === "string" && (RALLY_COURSE_STATUSES as readonly string[]).includes(value) ? value as typeof RALLY_COURSE_STATUSES[number] : null;
}

function normalizeRallyScope(value: unknown): typeof RALLY_SCOPES[number] | null {
  return typeof value === "string" && (RALLY_SCOPES as readonly string[]).includes(value) ? value as typeof RALLY_SCOPES[number] : null;
}

function normalizeRallyLocationBinding(value: unknown): typeof RALLY_LOCATION_BINDINGS[number] | null {
  return typeof value === "string" && (RALLY_LOCATION_BINDINGS as readonly string[]).includes(value) ? value as typeof RALLY_LOCATION_BINDINGS[number] : null;
}

function normalizeRallyCountUnit(value: unknown): typeof RALLY_COUNT_UNITS[number] | null {
  return typeof value === "string" && (RALLY_COUNT_UNITS as readonly string[]).includes(value) ? value as typeof RALLY_COUNT_UNITS[number] : null;
}

function normalizeRallyVerificationPolicy(value: unknown): typeof RALLY_VERIFICATION_POLICIES[number] | null {
  return typeof value === "string" && (RALLY_VERIFICATION_POLICIES as readonly string[]).includes(value) ? value as typeof RALLY_VERIFICATION_POLICIES[number] : null;
}

function normalizeRallyWeatherSensitivity(value: unknown): typeof RALLY_WEATHER_SENSITIVITIES[number] | null {
  return typeof value === "string" && (RALLY_WEATHER_SENSITIVITIES as readonly string[]).includes(value) ? value as typeof RALLY_WEATHER_SENSITIVITIES[number] : null;
}

function normalizeRallyMissionStatus(value: unknown): typeof RALLY_MISSION_STATUSES[number] | null {
  return typeof value === "string" && (RALLY_MISSION_STATUSES as readonly string[]).includes(value) ? value as typeof RALLY_MISSION_STATUSES[number] : null;
}

function normalizeRallyRevisionAction(value: unknown): typeof RALLY_REVISION_ACTIONS[number] | null {
  return typeof value === "string" && (RALLY_REVISION_ACTIONS as readonly string[]).includes(value) ? value as typeof RALLY_REVISION_ACTIONS[number] : null;
}
