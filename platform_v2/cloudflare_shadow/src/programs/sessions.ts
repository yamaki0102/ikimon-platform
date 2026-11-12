import type { Env } from "../core/env";
import { assertSameOriginRequest, clampInteger, json, normalizeOptionalText, numberOrNullFromUnknown, readJson, sha256Hex, textToArrayBuffer } from "../core/http";
import { isCommonEventTemplateConfig } from "../../../src/services/commonEventTemplateContract";
import { RYUYO_DISCOVERY_GEMINI_NOTICE_VERSION, discoveryNickname, isDiscoveryJournalConfig, isEventDiscoveryProfile } from "../eventDiscovery";
import { asPlainObject, isSafePublicDerivedImageKey, jsonArray, jsonObject, presentablePublicPhotoSql, publicAreaApproxPolygon, readCompatibleSession, roundPublicEventCoordinate, stringArray, type PublicDetailAssetRow } from "../core/shared";
import { appendObservationEventLive, buildClearedObservationEventGuestCookie, buildObservationEventGuestCookie, claimObservationEventGuestParticipant, countObservationEventTaxa, durationMinutesBetween, findObservationEventParticipant, findObservationEventViewerParticipant, getObservationEventSessionById, isObservationEventActivityOpen, isObservationEventCheckinOpen, isObservationEventParticipatingGroup, listObservationEventAbsences, listObservationEventLiveEvents, listObservationEventParticipants, listObservationEventTeams, observationEventGuestCredentialDigest, observationEventLocationShareUntil, observationEventMode, observationEventModes, observationEventObservationId, observationEventParticipantContext, observationEventRequestActor, observationEventTaxonName, publicObservationEventLiveEvent, publicObservationEventLiveSession, readObservationEventGuestCredential, recordObservationEventMeshVisit, recordObservationEventRecapView, recordObservationEventServerFunnelMetric, requireObservationEventOrganizer, serverObservationEventFunnelContext, shouldDeliverObservationEvent, summarizePublicObservationEventLive, type ObservationEventCapsuleD1Row, type ObservationEventMeshSummaryRow, type ObservationEventParticipantD1Row, type PublicObservationEventLiveEvent, upsertObservationEventParticipant } from "./runtime";
import { getObservationRallyCourseBySession, isRyuyoDiscoveryEvent, observationEventGuestMediaEnabled, prepareCommonObservationEventTemplate } from "./rally";

export const DISCOVERY_CAMPAIGN_VERSION = "ryuyo-campaign-v1";

type DiscoveryCampaignConfig = { version: typeof DISCOVERY_CAMPAIGN_VERSION; listed: boolean; applications_open: boolean };

export function discoveryCampaignConfig(config: Record<string, unknown>): DiscoveryCampaignConfig | null {
  const value = asPlainObject(config.discovery_campaign);
  return value?.version === DISCOVERY_CAMPAIGN_VERSION && typeof value.listed === "boolean" && typeof value.applications_open === "boolean"
    && Object.keys(value).every((key) => ["version", "listed", "applications_open"].includes(key))
    ? { version: DISCOVERY_CAMPAIGN_VERSION, listed: value.listed, applications_open: value.applications_open } : null;
}

export function hasProfessionalReportEntitlement(
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>,
): boolean {
  return session.config.derived_output_entitlement === "professional_report";
}

export async function suggestObservationEventArea(request: Request, env: Env): Promise<Response> {
  const session = await readCompatibleSession(request, env);
  if (!session) return json({ error: "login required" }, 401, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const center = asPlainObject(body.center);
  const lat = numberOrNullFromUnknown(center?.lat);
  const lng = numberOrNullFromUnknown(center?.lng);
  if (lat === null || lng === null) {
    return json({ error: "center.lat and center.lng required" }, 400, { "cache-control": "no-store" });
  }
  const radiusM = clampObservationEventAreaRadius(numberOrNullFromUnknown(body.radius_m) ?? numberOrNullFromUnknown(body.radiusM) ?? 300);
  const placeLabel = normalizeOptionalText(body.place_label) ?? normalizeOptionalText(body.placeLabel);
  const suggestions = [
    observationEventAreaSuggestion("facility", placeLabel ? `${placeLabel}敷地寄せ` : "施設・集合場所寄せ", "集合場所と施設周辺を中心に、迷いにくい範囲へ寄せます。", lat, lng, Math.max(100, Math.round(radiusM * 0.9)), [
      "施設管理者の案内と立入可能範囲を現地で確認してください。"
    ]),
    observationEventAreaSuggestion("safe_walk", "安全な徒歩圏", "親子や初参加者が歩きやすいように、範囲を締めます。", lat, lng, Math.max(180, Math.round(radiusM * 0.72)), [
      "道路横断や私有地への立ち入りは現地で確認してください。"
    ]),
    observationEventAreaSuggestion("nature_rich", "自然観察寄せ", "周辺の緑や水辺も見に行けるよう、観察範囲を広げます。", lat, lng, Math.max(220, Math.round(radiusM * 1.35)), [
      "公園・緑地を含める場合は集合場所と移動時間を確認してください。"
    ])
  ];
  return json({
    suggestions,
    provider: "fallback",
    promptVersion: "cloudflare_worker_area_fallback/v1",
    compatibility: {
      source: "cloudflare_d1_native",
      userId: session.userId
    }
  }, 200, { "cache-control": "no-store" });
}

function clampObservationEventAreaRadius(radiusM: number): number {
  return Math.max(80, Math.min(1500, Math.round(Number.isFinite(radiusM) ? radiusM : 300)));
}

function observationEventAreaSuggestion(
  id: "facility" | "safe_walk" | "nature_rich",
  label: string,
  reason: string,
  lat: number,
  lng: number,
  radiusM: number,
  warnings: string[]
) {
  const polygon = publicAreaApproxPolygon(lat, lng, radiusM, null);
  return {
    id,
    label,
    reason,
    geometry: {
      type: "Polygon",
      coordinates: [polygon]
    },
    center: { lat, lng },
    radiusM,
    areaHa: Math.round((Math.PI * radiusM * radiusM / 10000) * 10) / 10,
    warnings,
    source: "fallback"
  };
}

export async function createObservationEventSession(request: Request, env: Env): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request);
  if (sameOriginError) return sameOriginError;
  const session = await readCompatibleSession(request, env);
  if (!session) return json({ error: "login required" }, 401, { "cache-control": "no-store" });
  if (session.banned) return json({ error: "event_creation_unavailable" }, 403, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const config = asPlainObject(body.config) ?? {};
  if (Object.hasOwn(config, "discovery_campaign")) return json({ error: "discovery_campaign_settings_endpoint_required" }, 400, { "cache-control": "no-store" });
  if (config.event_template !== undefined && !isCommonEventTemplateConfig(config.event_template)) return json({ error: "event_template_contract_invalid" }, 400, { "cache-control": "no-store" });
  if (config.discovery_journal !== undefined && (!isDiscoveryJournalConfig(config.discovery_journal) || config.guest_media_enabled !== true || body.plan !== "public")) {
    return json({ error: "discovery_journal_contract_invalid" }, 400, { "cache-control": "no-store" });
  }
  if (isEventDiscoveryProfile(config)) {
    config.public_list_visibility = "hidden";
    config.public_listed = false;
  }
  const eventCode = normalizeOptionalText(body.event_code);
  if (!eventCode) {
    return json({ error: "event_code activation key required" }, 400, { "cache-control": "no-store" });
  }
  const startedAt = normalizeOptionalText(body.started_at);
  const endedAt = normalizeOptionalText(body.ended_at);
  const title = normalizeOptionalText(body.title);
  if (!startedAt) return json({ error: "started_at required" }, 400, { "cache-control": "no-store" });
  if (!title) return json({ error: "title required" }, 400, { "cache-control": "no-store" });
  if (!Number.isFinite(Date.parse(startedAt)) || (endedAt !== null && !(Date.parse(endedAt) > Date.parse(startedAt)))) return json({ error: "invalid event dates" }, 400, { "cache-control": "no-store" });
  const fieldId = normalizeOptionalText(body.field_id);
  const lat = numberOrNullFromUnknown(body.location_lat);
  const lng = numberOrNullFromUnknown(body.location_lng);
  if (!fieldId && (lat === null || lng === null)) {
    return json({ error: "field_id or location_lat/location_lng required" }, 400, { "cache-control": "no-store" });
  }
  const primaryMode = observationEventMode(body.primary_mode) ?? "discovery";
  const activeModes = observationEventModes(body.active_modes, primaryMode);
  const id = crypto.randomUUID();
  // Activation is a semantic upsert keyed on the invite code (event_code UNIQUE), not a
  // plain insert: identical retries of the same activation must converge on one session
  // instead of colliding on the unique constraint, while a changed payload replaying the
  // same code must be rejected as a conflict rather than silently reusing the old session.
  const activated = await env.OBS_DB.prepare(
    `INSERT INTO observation_event_sessions AS activated (
       session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id,
       plan, primary_mode, active_modes_json, location_lat, location_lng, location_radius_m,
       started_at, ended_at, target_species_json, config_json, field_id, template_source_session_id
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(event_code) DO UPDATE SET event_code = excluded.event_code
     WHERE activated.organizer_user_id IS excluded.organizer_user_id
       AND activated.legacy_event_id IS excluded.legacy_event_id
       AND activated.title IS excluded.title
       AND activated.corporation_id IS excluded.corporation_id
       AND activated.plan IS excluded.plan
       AND activated.primary_mode IS excluded.primary_mode
       AND activated.active_modes_json IS excluded.active_modes_json
       AND activated.location_lat IS excluded.location_lat
       AND activated.location_lng IS excluded.location_lng
       AND activated.location_radius_m IS excluded.location_radius_m
       AND activated.started_at IS excluded.started_at
       AND activated.ended_at IS excluded.ended_at
       AND activated.target_species_json IS excluded.target_species_json
       AND activated.config_json IS excluded.config_json
       AND activated.field_id IS excluded.field_id
       AND activated.template_source_session_id IS excluded.template_source_session_id
     RETURNING session_id`
  ).bind(
    id,
    normalizeOptionalText(body.legacy_event_id),
    eventCode,
    title,
    session.userId,
    normalizeOptionalText(body.corporation_id),
    body.plan === "public" ? "public" : "community",
    primaryMode,
    JSON.stringify(activeModes),
    lat,
    lng,
    Math.round(numberOrNullFromUnknown(body.location_radius_m) ?? 1000),
    startedAt,
    endedAt,
    JSON.stringify(stringArray(body.target_species)),
    JSON.stringify(config),
    fieldId,
    normalizeOptionalText(body.template_source_session_id)
  ).first<{ session_id: string }>();
  if (!activated) {
    return json({ error: "observation_event_activation_conflict" }, 409, { "cache-control": "no-store" });
  }
  const created = await getObservationEventSessionById(env, activated.session_id);
  if (!created) return json({ error: "observation_event_activation_unavailable" }, 503, { "cache-control": "no-store" });
  if (isCommonEventTemplateConfig(created.config.event_template)) {
    try {
      await prepareCommonObservationEventTemplate(env, created, session.userId);
    } catch {
      // The invite-code activation remains the retry receipt if this draft-only
      // transaction fails. Reusing that code resumes the same event's setup.
      return json({ error: "event_template_setup_unavailable" }, 503, { "cache-control": "no-store" });
    }
  }
  return json(created, 201, { "cache-control": "no-store" });
}

export async function updateObservationEventSession(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  const current = auth.session;
  const nextConfig = asPlainObject(body.config) ?? current.config;
  if (Object.hasOwn(nextConfig, "discovery_campaign") && (!discoveryCampaignConfig(nextConfig)
    || JSON.stringify(discoveryCampaignConfig(nextConfig)) !== JSON.stringify(discoveryCampaignConfig(current.config)))) {
    return json({ error: "discovery_campaign_settings_endpoint_required" }, 400, { "cache-control": "no-store" });
  }
  if (nextConfig.event_template !== undefined && !isCommonEventTemplateConfig(nextConfig.event_template)) return json({ error: "event_template_contract_invalid" }, 400, { "cache-control": "no-store" });
  if (nextConfig.discovery_journal !== undefined && (!isDiscoveryJournalConfig(nextConfig.discovery_journal) || nextConfig.guest_media_enabled !== true || (body.plan ?? current.plan) !== "public")) {
    return json({ error: "discovery_journal_contract_invalid" }, 400, { "cache-control": "no-store" });
  }
  if (isEventDiscoveryProfile(nextConfig)) {
    nextConfig.public_list_visibility = "hidden";
    nextConfig.public_listed = false;
  }
  if (typeof body.event_code === "string") {
    const requestedEventCode = body.event_code.trim();
    if (!requestedEventCode) {
      return json({ error: "event_code required" }, 400, { "cache-control": "no-store" });
    }
    if (current.eventCode) {
      if (requestedEventCode !== current.eventCode) {
        return json({ error: "event_code is immutable after activation" }, 409, { "cache-control": "no-store" });
      }
    } else {
      // The `current` snapshot above can go stale before this write lands, so the
      // one-time invite-code claim is its own conditional statement (event_code IS
      // NULL) rather than folded into the combined UPDATE below — otherwise two
      // concurrent PATCH requests could both pass a null-check and the later write
      // would silently overwrite the first organizer's code.
      const claimed = await env.OBS_DB.prepare(
        "UPDATE observation_event_sessions SET event_code = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ? AND event_code IS NULL"
      ).bind(requestedEventCode, sessionId).run() as { meta?: { changes?: number } };
      if (Number(claimed.meta?.changes ?? 0) === 0) {
        return json({ error: "event_code is immutable after activation" }, 409, { "cache-control": "no-store" });
      }
    }
  }
  const primaryMode = observationEventMode(body.primary_mode) ?? current.primaryMode;
  await env.OBS_DB.prepare(
    `UPDATE observation_event_sessions
        SET title = ?, primary_mode = ?, active_modes_json = ?,
            location_lat = ?, location_lng = ?, location_radius_m = ?, started_at = ?,
            target_species_json = ?, plan = ?,
            config_json = json_patch(?, json_object('discovery_campaign', json_extract(config_json, '$.discovery_campaign'))),
            field_id = ?, updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?`
  ).bind(
    typeof body.title === "string" ? body.title : current.title,
    primaryMode,
    JSON.stringify(Array.isArray(body.active_modes) ? observationEventModes(body.active_modes, primaryMode) : current.activeModes),
    body.location_lat === undefined ? current.locationLat : numberOrNullFromUnknown(body.location_lat),
    body.location_lng === undefined ? current.locationLng : numberOrNullFromUnknown(body.location_lng),
    body.location_radius_m === undefined ? current.locationRadiusM : Math.round(numberOrNullFromUnknown(body.location_radius_m) ?? current.locationRadiusM),
    typeof body.started_at === "string" ? body.started_at : current.startedAt,
    JSON.stringify(Array.isArray(body.target_species) ? stringArray(body.target_species) : current.targetSpecies),
    body.plan === "public" || body.plan === "community" ? body.plan : current.plan,
    JSON.stringify(nextConfig),
    body.field_id === undefined ? current.fieldId : normalizeOptionalText(body.field_id),
    sessionId
  ).run();
  return json({ session: await getObservationEventSessionById(env, sessionId) }, 200, { "cache-control": "no-store" });
}

export async function switchObservationEventMode(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  const next = observationEventMode(body.primary_mode);
  if (!next) return json({ error: "invalid primary_mode" }, 400, { "cache-control": "no-store" });
  const activeModes = [...new Set([...auth.session.activeModes, next])];
  await env.OBS_DB.prepare(
    "UPDATE observation_event_sessions SET primary_mode = ?, active_modes_json = ?, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?"
  ).bind(next, JSON.stringify(activeModes), sessionId).run();
  await appendObservationEventLive(env, { sessionId, type: "mode_switch", scope: "all", actorUserId: auth.auth.userId, payload: { primary_mode: next, active_modes: activeModes } });
  return json({ session: await getObservationEventSessionById(env, sessionId) }, 200, { "cache-control": "no-store" });
}

export async function endObservationEventSession(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  await env.OBS_DB.prepare(
    "UPDATE observation_event_sessions SET ended_at = CASE WHEN ended_at IS NULL OR datetime(ended_at) > CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP ELSE ended_at END, updated_at = CURRENT_TIMESTAMP WHERE session_id = ?"
  ).bind(sessionId).run();
  return json({ session: await getObservationEventSessionById(env, sessionId) }, 200, { "cache-control": "no-store" });
}

export async function createObservationEventTeam(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  const name = normalizeOptionalText(body.name);
  if (!name) return json({ error: "name required" }, 400, { "cache-control": "no-store" });
  const teamId = crypto.randomUUID();
  const team = {
    team_id: teamId,
    name,
    color: normalizeOptionalText(body.color) ?? "#4f9d69",
    lead_user_id: normalizeOptionalText(body.lead_user_id),
    target_taxa: stringArray(body.target_taxa)
  };
  await env.OBS_DB.prepare(
    "INSERT INTO observation_event_teams (team_id, session_id, name, color, lead_user_id, target_taxa_json) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(teamId, sessionId, team.name, team.color, team.lead_user_id, JSON.stringify(team.target_taxa)).run();
  await appendObservationEventLive(env, { sessionId, type: "team_update", scope: "all", actorUserId: auth.auth.userId, teamId, payload: { kind: "created", team } });
  return json({ team }, 201, { "cache-control": "no-store" });
}

export async function checkinObservationEvent(request: Request, env: Env, sessionId: string): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const discoveryProfile = isEventDiscoveryProfile(session.config);
  if (discoveryProfile && (!observationEventGuestMediaEnabled(env, session) || (await getObservationRallyCourseBySession(env, sessionId))?.status !== "live")) {
    return json({ error: "event_checkin_not_started" }, 409, { "cache-control": "no-store" });
  }
  if (!isObservationEventCheckinOpen(session)) {
    return json({ error: "event_checkin_closed" }, 409, { "cache-control": "no-store" });
  }
  if (discoveryProfile && !isObservationEventActivityOpen(session)) return json({ error: "event_checkin_not_started" }, 409, { "cache-control": "no-store" });
  const auth = await readCompatibleSession(request, env);
  if (auth?.banned) return json({ error: "event_checkin_unavailable" }, 403, { "cache-control": "no-store" });
  const metricContext = serverObservationEventFunnelContext(request, "join", Boolean(auth));
  const browserGuestCredential = await readObservationEventGuestCredential(request.headers.get("cookie"), sessionId);
  if (!auth && !browserGuestCredential) {
    return json({ error: "event_guest_cookie_required" }, 428, { "cache-control": "no-store" });
  }
  const browserGuestToken = browserGuestCredential ? await observationEventGuestCredentialDigest(browserGuestCredential) : null;
  const metricActorKey = auth ? `user:${auth.userId}` : `guest:${browserGuestToken!}`;
  await recordObservationEventServerFunnelMetric(env, sessionId, {
    event_name: "event_checkin_started",
    ...metricContext
  }, metricActorKey);
  const body = await readJson<Record<string, unknown>>(request);
  const discoveryGeminiConsentVersion = isRyuyoDiscoveryEvent(env, session) ? RYUYO_DISCOVERY_GEMINI_NOTICE_VERSION : null;
  if (discoveryGeminiConsentVersion && body.discovery_gemini_notice_version !== discoveryGeminiConsentVersion) {
    return json({ error: "discovery_gemini_notice_required" }, 400, { "cache-control": "no-store" });
  }
  const teamId = normalizeOptionalText(body.team_id);
  if (teamId && !(await listObservationEventTeams(env, sessionId)).some((team) => team.team_id === teamId)) {
    return json({ error: "event_team_not_found" }, 400, { "cache-control": "no-store" });
  }
  const isMinor = body.is_minor === true;
  const shareLocation = !discoveryProfile && body.share_location === true;
  const guardianConsent = body.guardian_location_consent === true;
  if (isMinor && shareLocation && !guardianConsent) {
    await recordObservationEventServerFunnelMetric(env, sessionId, {
      event_name: "event_checkin_failed",
      ...metricContext,
      result_reason: "validation"
    }, metricActorKey);
    return json({ error: "guardian_location_consent_required" }, 400, { "cache-control": "no-store" });
  }
  if (auth && browserGuestToken) {
    await claimObservationEventGuestParticipant(env, sessionId, auth.userId, browserGuestToken);
  }
  const guestCredential = auth ? null : browserGuestCredential;
  const guestToken = auth ? null : browserGuestToken;
  const displayName = discoveryProfile ? discoveryNickname(body.display_name) ?? "" : normalizeOptionalText(body.display_name) ?? "";
  const participant = await upsertObservationEventParticipant(env, {
    sessionId,
    userId: auth?.userId ?? null,
    guestToken,
    displayName,
    teamId,
    isMinor,
    shareLocation,
    locationShareUntil: shareLocation ? observationEventLocationShareUntil(session) : null,
    locationShareConsentType: shareLocation ? (isMinor ? "guardian" : "self") : null,
    discoveryGeminiConsentVersion
  });
  if (participant.created) {
    await appendObservationEventLive(env, {
      sessionId,
      type: "checkin",
      scope: "organizer",
      actorUserId: auth?.userId ?? null,
      actorGuestToken: guestToken,
      teamId,
      payload: { participant_id: participant.participantId, display_name: normalizeOptionalText(body.display_name) ?? "", team_id: teamId, location_share: shareLocation }
    });
    await recordObservationEventServerFunnelMetric(env, sessionId, {
      event_name: "event_checkin_succeeded",
      ...metricContext
    }, `participant:${participant.participantId}`);
  }
  const headers: Record<string, string> = { "cache-control": "no-store" };
  if (auth && browserGuestCredential) {
    headers["set-cookie"] = await buildClearedObservationEventGuestCookie(sessionId);
  } else if (!auth && guestCredential) {
    headers["set-cookie"] = await buildObservationEventGuestCookie(session, guestCredential);
  }
  return json({ participant_id: participant.participantId }, 200, headers);
}

export async function updateObservationEventRole(request: Request, env: Env, sessionId: string): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const { auth, guestToken } = await observationEventRequestActor(request, env, sessionId);
  const body = await readJson<Record<string, unknown>>(request);
  const declaredJob = normalizeOptionalText(body.declared_job);
  if (!declaredJob || !["shoot", "identify", "map", "record", "absence", "free"].includes(declaredJob)) {
    return json({ error: "invalid declared_job" }, 400, { "cache-control": "no-store" });
  }
  if (!auth && !guestToken) return json({ error: "user or guest_token required" }, 400, { "cache-control": "no-store" });
  const participant = await findObservationEventParticipant(env, sessionId, auth?.userId ?? null, guestToken);
  if (!participant) return json({ error: "participant not found" }, 404, { "cache-control": "no-store" });
  await env.OBS_DB.prepare(
    "UPDATE observation_event_participants SET declared_job = ?, updated_at = CURRENT_TIMESTAMP WHERE participant_id = ?"
  ).bind(declaredJob, participant.participant_id).run();
  await appendObservationEventLive(env, { sessionId, type: "team_update", scope: "team", teamId: participant.team_id, actorUserId: auth?.userId ?? null, actorGuestToken: guestToken, payload: { kind: "role", participant_id: participant.participant_id, declared_job: declaredJob } });
  return json({ participant_id: participant.participant_id, declared_job: declaredJob }, 200, { "cache-control": "no-store" });
}

export async function announceObservationEvent(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const body = await readJson<Record<string, unknown>>(request);
  const message = normalizeOptionalText(body.message);
  if (!message) return json({ error: "message required" }, 400, { "cache-control": "no-store" });
  const event = await appendObservationEventLive(env, { sessionId, type: "announce", scope: "all", actorUserId: auth.auth.userId, payload: { message, template: normalizeOptionalText(body.template) } });
  return json({ event }, 200, { "cache-control": "no-store" });
}

export async function createObservationEventAbsence(request: Request, env: Env, sessionId: string): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const { auth, guestToken } = await observationEventRequestActor(request, env, sessionId);
  const body = await readJson<Record<string, unknown>>(request);
  const taxon = normalizeOptionalText(body.searched_taxon);
  const lat = numberOrNullFromUnknown(body.lat);
  const lng = numberOrNullFromUnknown(body.lng);
  if (!taxon || lat === null || lng === null) return json({ error: "searched_taxon, lat, lng required" }, 400, { "cache-control": "no-store" });
  if (!auth && !guestToken) return json({ error: "user or guest_token required" }, 400, { "cache-control": "no-store" });
  const participant = await findObservationEventParticipant(env, sessionId, auth?.userId ?? null, guestToken);
  if (!participant) return json({ error: "participant required" }, 403, { "cache-control": "no-store" });
  const teamId = participant.team_id;
  const absenceId = crypto.randomUUID();
  const confidenceRaw = normalizeOptionalText(body.confidence) ?? "searched";
  const confidence = ["searched", "confirmed_absent", "expert_verified"].includes(confidenceRaw) ? confidenceRaw : "searched";
  const publicLat = roundPublicEventCoordinate(lat);
  const publicLng = roundPublicEventCoordinate(lng);
  await env.OBS_DB.prepare(
    `INSERT INTO observation_event_absences (
       absence_id, session_id, user_id, guest_token, team_id, searched_taxon,
       effort_seconds, public_lat, public_lng, confidence, notes
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(absenceId, sessionId, auth?.userId ?? null, guestToken, teamId, taxon, Math.max(0, Math.round(numberOrNullFromUnknown(body.effort_seconds) ?? 0)), publicLat, publicLng, confidence, normalizeOptionalText(body.notes) ?? "").run();
  await recordObservationEventMeshVisit(env, { sessionId, lat: publicLat, lng: publicLng, absenceDelta: 1, teamId });
  const event = await appendObservationEventLive(env, { sessionId, type: "absence_recorded", scope: "all", actorUserId: auth?.userId ?? null, actorGuestToken: guestToken, teamId, payload: { absence_id: absenceId, searched_taxon: taxon, confidence } });
  return json({ absence_id: absenceId, event }, 201, { "cache-control": "no-store" });
}

export async function getObservationEventRecent(request: Request, url: URL, env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "100"), 1, 500);
  const ctx = await observationEventParticipantContext(request, env, session);
  if (!ctx.isOrganizer && !ctx.isCheckedInParticipant) {
    return json({ error: "event participant required" }, 403, { "cache-control": "no-store" });
  }
  const events = (await listObservationEventLiveEvents(env, sessionId, limit))
    .filter((event) => shouldDeliverObservationEvent(event, ctx))
    .map(publicObservationEventLiveEvent)
    .filter((event): event is PublicObservationEventLiveEvent => event !== null);
  return json({
    session: publicObservationEventLiveSession(session),
    summary: summarizePublicObservationEventLive(events),
    events
  }, 200, { "cache-control": "no-store" });
}

export async function getObservationEventLiveSnapshot(request: Request, env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const ctx = await observationEventParticipantContext(request, env, session);
  if (!ctx.isOrganizer && !ctx.isCheckedInParticipant) {
    return json({ error: "event participant required" }, 403, { "cache-control": "no-store" });
  }
  const events = (await listObservationEventLiveEvents(env, sessionId, 50))
    .filter((event) => shouldDeliverObservationEvent(event, ctx))
    .reverse()
    .map(publicObservationEventLiveEvent)
    .filter((event): event is PublicObservationEventLiveEvent => event !== null);
  const payload = `event: snapshot\ndata: ${JSON.stringify({
    session: publicObservationEventLiveSession(session),
    summary: summarizePublicObservationEventLive(events),
    events
  })}\n\nevent: ping\ndata: ${JSON.stringify({ now: new Date().toISOString(), mode: "snapshot_only" })}\n\n`;
  return new Response(payload, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-ikimon-observation-event-live-mode": "snapshot-only"
    }
  });
}

export async function summarizeObservationEventEffort(env: Env, session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>) {
  const target = Math.max(1, Number(session.config.coverage_target_cells ?? 100) || 100);
  const row = await env.OBS_DB.prepare(
    `SELECT COUNT(*) AS visited_cells,
            COALESCE(SUM(visit_seconds), 0) AS visit_seconds_sum,
            COALESCE(SUM(observation_count), 0) AS observation_sum,
            COALESCE(SUM(absence_count), 0) AS absence_sum
       FROM observation_event_mesh_cells
      WHERE session_id = ?`
  ).bind(session.sessionId).first<ObservationEventMeshSummaryRow>();
  const visited = Number(row?.visited_cells ?? 0);
  const seconds = Number(row?.visit_seconds_sum ?? 0);
  const observations = Number(row?.observation_sum ?? 0);
  const absences = Number(row?.absence_sum ?? 0);
  return {
    sessionId: session.sessionId,
    totalVisitedCells: visited,
    totalEffortSeconds: seconds,
    totalEffortPersonHours: Math.round((seconds / 3600) * 100) / 100,
    totalObservations: observations,
    totalAbsences: absences,
    coveragePct: Math.min(100, Math.round((visited / target) * 1000) / 10)
  };
}

export async function getObservationEventEffort(env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const effort = await summarizeObservationEventEffort(env, session);
  return json({
    session: publicObservationEventRecapSession(session),
    effort
  }, 200, { "cache-control": "no-store" });
}

async function observationEventRecapPhotoRef(sessionId: string, observationId: string): Promise<string> {
  const digest = await sha256Hex(textToArrayBuffer(`event-recap-photo|${sessionId}|${observationId}`));
  return digest.slice(0, 32);
}

async function buildObservationEventRecapPhotos(
  env: Env,
  sessionId: string,
  observationEvents: Awaited<ReturnType<typeof listObservationEventLiveEvents>>
) {
  const availablePhotos = await queryObservationEventRecapPhotoIds(
    env,
    observationEvents.map(observationEventObservationId).filter((id): id is string => Boolean(id))
  );
  const seen = new Set<string>();
  const photos: Array<{ photoUrl: string; observedAt: string }> = [];
  for (const event of observationEvents) {
    const observationId = observationEventObservationId(event);
    if (!observationId || seen.has(observationId) || !availablePhotos.has(observationId)) continue;
    seen.add(observationId);
    const photoRef = await observationEventRecapPhotoRef(sessionId, observationId);
    photos.push({
      photoUrl: `/api/v1/observation-events/${encodeURIComponent(sessionId)}/photos/${photoRef}`,
      observedAt: event.createdAt
    });
    if (photos.length >= 60) break;
  }
  return photos;
}

async function queryObservationEventRecapPhotoIds(env: Env, observationIds: string[]): Promise<Set<string>> {
  // Event recap media stays behind the participant check in both the recap and
  // photo routes, so private event observations retain their scoped access.
  const ids = [...new Set(observationIds)].slice(0, 500);
  if (ids.length === 0) return new Set();
  const rows = await env.OBS_DB.prepare(
    `SELECT DISTINCT observation_id
       FROM asset_ledger
      WHERE observation_id IN (${ids.map(() => "?").join(",")})
        AND processing_state = 'uploaded'
        AND public_derivative_key IS NOT NULL
        AND public_derivative_verified_at IS NOT NULL
        AND public_derivative_metadata_json IS NOT NULL
        AND public_derivative_metadata_json NOT LIKE '%"scannedContainer":"svg+xml"%'
        AND public_derivative_metadata_json NOT LIKE '%"contentType":"image/svg%'
        AND exif_scrub_state = 'scrubbed'
        AND public_ready_at IS NOT NULL
        AND mime LIKE 'image/%'
        ${presentablePublicPhotoSql()}
      LIMIT 500`
  ).bind(...ids).all<{ observation_id: string }>();
  return new Set(rows.results.map((row) => row.observation_id));
}

function publicObservationEventRecapSession(session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>) {
  return {
    sessionId: session.sessionId,
    eventCode: session.eventCode,
    title: session.title,
    plan: session.plan,
    primaryMode: session.primaryMode,
    activeModes: session.activeModes,
    startedAt: session.startedAt,
    endedAt: session.endedAt
  };
}

function publicObservationEventRecapTimeline(
  events: Awaited<ReturnType<typeof listObservationEventLiveEvents>>
) {
  const timeline: Array<{ type: string; payload: Record<string, unknown>; createdAt: string }> = [];
  for (const event of events) {
    if (["observation_added", "guide_scene_added", "field_scan_added"].includes(event.type)) {
      timeline.push({ type: event.type, payload: { kind: "record" }, createdAt: event.createdAt });
      continue;
    }
    if (event.type === "absence_recorded") {
      timeline.push({
        type: event.type,
        payload: {
          kind: "absence",
          confidence: normalizeOptionalText(event.payload.confidence) ?? "searched"
        },
        createdAt: event.createdAt
      });
      continue;
    }
    if (event.type === "announce") {
      const message = normalizeOptionalText(event.payload.message);
      if (message) timeline.push({ type: event.type, payload: { message }, createdAt: event.createdAt });
      continue;
    }
    if (["rare_species", "target_hit", "milestone", "fanfare"].includes(event.type)) {
      timeline.push({
        type: event.type,
        payload: {
          headline: normalizeOptionalText(event.payload.headline) ?? null
        },
        createdAt: event.createdAt
      });
    }
  }
  return timeline;
}

export async function getObservationEventRecapPhoto(
  request: Request,
  env: Env,
  sessionId: string,
  photoRef: string
): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const auth = await readCompatibleSession(request, env).catch(() => null);
  const guestCredential = auth ? null : await readObservationEventGuestCredential(request.headers.get("cookie"), sessionId);
  const guestToken = guestCredential ? await observationEventGuestCredentialDigest(guestCredential) : null;
  const participant = await findObservationEventParticipant(env, sessionId, auth?.userId ?? null, guestToken);
  const canManage = Boolean(auth?.userId && auth.userId === session.organizerUserId);
  if (!canManage && !participant) {
    return json({ error: "event participant required" }, 403, { "cache-control": "no-store" });
  }

  const events = await listObservationEventLiveEvents(env, sessionId, 500);
  let observationId: string | null = null;
  for (const event of events) {
    if (event.type !== "observation_added") continue;
    const candidateId = observationEventObservationId(event);
    if (!candidateId) continue;
    if (await observationEventRecapPhotoRef(sessionId, candidateId) === photoRef) {
      observationId = candidateId;
      break;
    }
  }
  if (!observationId) return json({ error: "photo not found" }, 404, { "cache-control": "no-store" });

  const assets = await env.OBS_DB.prepare(
    `SELECT asset_id, object_key, mime, bytes, duration_ms, public_derivative_key
       FROM asset_ledger
      WHERE observation_id = ?
        AND processing_state = 'uploaded'
        AND public_derivative_key IS NOT NULL
        AND public_derivative_verified_at IS NOT NULL
        AND public_derivative_metadata_json IS NOT NULL
        AND public_derivative_metadata_json NOT LIKE '%"scannedContainer":"svg+xml"%'
        AND public_derivative_metadata_json NOT LIKE '%"contentType":"image/svg%'
        AND exif_scrub_state = 'scrubbed'
        AND public_ready_at IS NOT NULL
        AND mime LIKE 'image/%'
        ${presentablePublicPhotoSql()}
      ORDER BY created_at ASC
      LIMIT 1`
  ).bind(observationId).all<PublicDetailAssetRow>();
  const asset = assets.results[0];
  if (!asset?.public_derivative_key || !isSafePublicDerivedImageKey(asset.public_derivative_key)) {
    return json({ error: "photo not ready" }, 404, { "cache-control": "no-store" });
  }
  const object = await env.ASSET_BUCKET.get(asset.public_derivative_key);
  if (!object?.body) return json({ error: "photo not ready" }, 404, { "cache-control": "no-store" });
  return new Response(object.body, {
    headers: {
      "content-type": object.httpMetadata?.contentType ?? "image/webp",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff"
    }
  });
}

export async function getObservationEventRecap(request: Request, url: URL, env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const auth = await readCompatibleSession(request, env).catch(() => null);
  const guestCredential = auth ? null : await readObservationEventGuestCredential(request.headers.get("cookie"), sessionId);
  const guestToken = guestCredential ? await observationEventGuestCredentialDigest(guestCredential) : null;
  const limit = clampInteger(Number(url.searchParams.get("limit") ?? "200"), 20, 500);
  const [eventsDesc, teams, participants, absenceRows, effort] = await Promise.all([
    listObservationEventLiveEvents(env, sessionId, limit),
    listObservationEventTeams(env, sessionId),
    listObservationEventParticipants(env, sessionId),
    listObservationEventAbsences(env, sessionId),
    summarizeObservationEventEffort(env, session)
  ]);
  const events = eventsDesc.reverse();
  const observationEvents = events.filter((event) => event.type === "observation_added");
  const guideSceneCount = events.filter((event) => event.type === "guide_scene_added").length;
  const fieldScanCount = events.filter((event) => event.type === "field_scan_added").length;
  const fanfareCount = events.filter((event) => ["rare_species", "target_hit", "milestone", "fanfare"].includes(event.type)).length;
  const startedAt = session.startedAt;
  const endedAt = session.endedAt;
  const durationMinutes = durationMinutesBetween(startedAt, endedAt);
  const participatingGroups = participants.filter(isObservationEventParticipatingGroup);
  const viewer = findObservationEventViewerParticipant(participants, auth?.userId ?? null, guestToken);
  const canManage = Boolean(auth?.userId && auth.userId === session.organizerUserId);
  if (!canManage && !viewer) {
    return json({ error: "event participant required" }, 403, { "cache-control": "no-store" });
  }
  const myEvents = viewer
    ? observationEvents.filter((event) => (viewer.user_id && event.actorUserId === viewer.user_id) || (viewer.guest_token && event.actorGuestToken === viewer.guest_token))
    : [];
  const photos = await buildObservationEventRecapPhotos(env, sessionId, observationEvents);
  await recordObservationEventRecapView(env, sessionId, auth?.userId ?? null, guestToken);
  return json({
    session: publicObservationEventRecapSession(session),
    permissions: { canManage },
    highlights: {
      observationCount: observationEvents.length,
      guideSceneCount,
      fieldScanCount,
      absencesCount: absenceRows.length,
      participantsCount: participatingGroups.length,
      participantCountUnit: "families_or_groups",
      questsOffered: 0,
      questsAccepted: 0,
      questsCompleted: 0,
      fanfareCount,
      totalEffortPersonHours: effort.totalEffortPersonHours,
      meshCoveragePct: effort.coveragePct,
      startedAt,
      endedAt,
      durationMinutes
    },
    effort,
    teams: teams.map((team) => {
      const teamEvents = observationEvents.filter((event) => event.teamId === team.team_id);
      return {
        name: team.name,
        color: team.color,
        memberCount: participatingGroups.filter((participant) => participant.team_id === team.team_id).length,
        observationsCount: teamEvents.length,
        absencesCount: absenceRows.filter((absence) => absence.team_id === team.team_id).length,
        questsAccepted: 0
      };
    }),
    timeline: publicObservationEventRecapTimeline(events),
    photos,
    impacts: [],
    myContribution: viewer ? {
      displayName: viewer.display_name ?? null,
      observationsCount: myEvents.length,
      absencesCount: absenceRows.filter((absence) => (viewer.user_id && absence.user_id === viewer.user_id) || (viewer.guest_token && absence.guest_token === viewer.guest_token)).length,
      questsAccepted: 0
    } : null
  }, 200, { "cache-control": "no-store" });
}

export async function getObservationEventSpeciesCsv(request: Request, env: Env, sessionId: string): Promise<Response> {
  const report = await buildObservationEventOfficialReport(request, env, sessionId);
  if (report instanceof Response) return report;
  const header = ["observed_at", "taxon_name", "team_id", "record_kind", "match_source", "evidence_ref"];
  const rows = report.speciesRecords.map((record) => [
    record.observedAt,
    record.taxonName,
    record.teamId ?? "",
    record.recordKind,
    record.matchSource,
    record.evidenceRef ?? ""
  ]);
  const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
  return new Response(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="observation-event-${sessionId}-species.csv"`,
      "cache-control": "no-store"
    }
  });
}

export async function buildObservationEventOfficialReport(request: Request, env: Env, sessionId: string) {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const auth = await readCompatibleSession(request, env).catch(() => null);
  if (!auth || auth.userId !== session.organizerUserId || !hasProfessionalReportEntitlement(session)) {
    return json({ error: "professional_report_requires_separate_contract" }, 403, { "cache-control": "no-store" });
  }
  const rows = (await listObservationEventLiveEvents(env, sessionId, 500))
    .filter((event) => ["observation_added", "guide_scene_added", "field_scan_added"].includes(event.type))
    .reverse();
  const speciesRecords = rows
    .filter((event) => event.type === "observation_added")
    .map((event) => {
      const taxonName = observationEventTaxonName(event.payload);
      if (!taxonName) return null;
      return {
        liveEventId: event.liveEventId,
        observedAt: event.createdAt,
        teamId: event.teamId,
        taxonName,
        recordKind: "observation_added" as const,
        matchSource: "explicit_session_event" as const,
        evidenceRef: normalizeOptionalText(event.payload.observation_id)
          ?? normalizeOptionalText(event.payload.visit_id)
          ?? normalizeOptionalText(event.payload.occurrence_id)
          ?? normalizeOptionalText(event.payload.asset_id)
      };
    })
    .filter((record): record is NonNullable<typeof record> => record !== null);
  const topTaxa = [...countObservationEventTaxa(rows.filter((event) => event.type === "observation_added")).entries()]
    .map(([taxonName, count]) => ({ taxonName, count }))
    .slice(0, 30);
  return {
    schemaVersion: "observation_event_official_report/v1",
    session,
    generatedAt: new Date().toISOString(),
    claimBoundary: {
      canSay: [
        "この観察会セッションに明示的に紐づいた記録の集計",
        "観察会中に記録された種名候補と件数",
        "公式提出前の確認用リスト"
      ],
      cannotSay: [
        "半径内に存在しただけの第三者記録を観察会成果として扱うこと",
        "AI候補だけで種同定が確定したと表現すること",
        "希少種や配慮対象種の正確な位置を未確認のまま公開すること"
      ]
    },
    privacyBoundary: {
      exactCoordinatesIncluded: false,
      sensitiveSpeciesRequiresOrganizerReview: true
    },
    stats: {
      officialObservationCount: speciesRecords.length,
      uniqueTaxaCount: topTaxa.length,
      guideSceneCount: rows.filter((event) => event.type === "guide_scene_added").length,
      fieldScanCount: rows.filter((event) => event.type === "field_scan_added").length
    },
    topTaxa,
    speciesRecords
  };
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export async function generateObservationEventCapsule(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  await readJson<Record<string, unknown>>(request).catch(() => ({}));
  const [eventsDesc, participants, absences] = await Promise.all([
    listObservationEventLiveEvents(env, sessionId, 500),
    listObservationEventParticipants(env, sessionId),
    listObservationEventAbsences(env, sessionId)
  ]);
  const events = eventsDesc.reverse();
  const capsule = buildObservationEventCapsulePayload(auth.session, events, participants, absences, auth.auth.userId);
  await upsertObservationEventCapsule(env, capsule);
  return json({ capsule }, 201, { "cache-control": "no-store" });
}

export async function getObservationEventCapsule(request: Request, env: Env, sessionId: string): Promise<Response> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const row = await getObservationEventCapsuleRow(env, sessionId);
  if (!row) return json({ error: "capsule not found" }, 404, { "cache-control": "no-store" });
  const capsule = mapObservationEventCapsule(row);
  const auth = await readCompatibleSession(request, env).catch(() => null);
  const canManage = Boolean(auth?.userId && auth.userId === session.organizerUserId);
  if (canManage) return json({ capsule }, 200, { "cache-control": "no-store" });
  if (!["approved_public", "published"].includes(capsule.reviewStatus)) {
    return json({ error: "capsule not public" }, 403, { "cache-control": "no-store" });
  }
  return json({
    capsule: {
      sessionId: capsule.sessionId,
      publicStoryDraft: capsule.publicStoryDraft,
      sourceCounts: capsule.sourceCounts,
      sourceClusters: capsule.sourceClusters,
      reviewStatus: capsule.reviewStatus,
      publishedAt: capsule.publishedAt,
      generatedAt: capsule.generatedAt
    }
  }, 200, { "cache-control": "no-store" });
}

export async function reviewObservationEventCapsule(request: Request, env: Env, sessionId: string): Promise<Response> {
  const auth = await requireObservationEventOrganizer(request, env, sessionId);
  if (auth instanceof Response) return auth;
  const row = await getObservationEventCapsuleRow(env, sessionId);
  if (!row) return json({ error: "capsule not found" }, 404, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const reviewStatus = normalizeCapsuleReviewStatus(body.review_status ?? body.reviewStatus);
  if (!reviewStatus) return json({ error: "invalid review_status" }, 400, { "cache-control": "no-store" });
  const capsule = mapObservationEventCapsule(row);
  if (["approved_public", "published"].includes(reviewStatus) && capsule.privacyRiskQueue.length > 0) {
    return json({ error: "privacy review blockers remain", blockers: capsule.privacyRiskQueue }, 409, { "cache-control": "no-store" });
  }
  await env.OBS_DB.prepare(
    `UPDATE observation_event_capsules
        SET review_status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP,
            published_at = CASE WHEN ? = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END,
            updated_at = CURRENT_TIMESTAMP
      WHERE session_id = ?`
  ).bind(reviewStatus, auth.auth.userId, reviewStatus, sessionId).run();
  const updated = await getObservationEventCapsuleRow(env, sessionId);
  return json({ capsule: updated ? mapObservationEventCapsule(updated) : null }, 200, { "cache-control": "no-store" });
}

function normalizeCapsuleReviewStatus(value: unknown): "draft" | "needs_review" | "approved_private" | "approved_public" | "published" | null {
  const text = normalizeOptionalText(value);
  if (text === "draft" || text === "needs_review" || text === "approved_private" || text === "approved_public" || text === "published") return text;
  return null;
}

function buildObservationEventCapsulePayload(
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>,
  events: Awaited<ReturnType<typeof listObservationEventLiveEvents>>,
  participants: ObservationEventParticipantD1Row[],
  absences: Awaited<ReturnType<typeof listObservationEventAbsences>>,
  generatedBy: string
) {
  const observationEvents = events.filter((event) => event.type === "observation_added");
  const guideEvents = events.filter((event) => event.type === "guide_scene_added");
  const scanEvents = events.filter((event) => event.type === "field_scan_added");
  const taxonCounts = countObservationEventTaxa(observationEvents);
  const sourceRefs = events
    .filter((event) => ["observation_added", "guide_scene_added", "field_scan_added", "absence_recorded"].includes(event.type))
    .map((event) => ({
      sourceRef: `live:${event.liveEventId}`,
      sourceType: event.type === "guide_scene_added" ? "guide_scene" : event.type === "field_scan_added" ? "field_scan" : event.type === "absence_recorded" ? "absence" : "observation",
      label: observationEventTaxonName(event.payload) ?? normalizeOptionalText(event.payload.summary) ?? normalizeOptionalText(event.payload.scene_summary) ?? event.type,
      createdAt: event.createdAt
    }));
  const privacyRiskQueue = detectObservationEventCapsuleRisks(events, participants);
  const publicReady = privacyRiskQueue.length === 0;
  const sourceCounts = {
    observations: observationEvents.length,
    guideScenes: guideEvents.length,
    fieldScans: scanEvents.length,
    absences: absences.length,
    participants: participants.length,
    minors: participants.filter((participant) => participant.is_minor === 1).length,
    risks: privacyRiskQueue.length
  };
  const generatedAt = new Date().toISOString();
  return {
    sessionId: session.sessionId,
    sourceCounts,
    sourceClusters: {
      topTaxa: [...taxonCounts.entries()].map(([label, count]) => ({ label, count, sourceRefs: observationEvents.filter((event) => observationEventTaxonName(event.payload) === label).map((event) => `live:${event.liveEventId}`).slice(0, 8) })).slice(0, 8),
      guideThemes: guideEvents.reduce<Array<{ label: string; count: number; sourceRefs: string[] }>>((acc, event) => {
        const label = normalizeOptionalText(event.payload.theme) ?? normalizeOptionalText(event.payload.scene_summary) ?? "ガイドで見た場面";
        const existing = acc.find((item) => item.label === label);
        if (existing) {
          existing.count += 1;
          existing.sourceRefs.push(`live:${event.liveEventId}`);
        } else {
          acc.push({ label, count: 1, sourceRefs: [`live:${event.liveEventId}`] });
        }
        return acc;
      }, []).slice(0, 8),
      scanModes: scanEvents.reduce<Array<{ label: string; count: number; sourceRefs: string[] }>>((acc, event) => {
        const label = normalizeOptionalText(event.payload.scan_mode) ?? normalizeOptionalText(event.payload.mode) ?? "field_scan";
        const existing = acc.find((item) => item.label === label);
        if (existing) {
          existing.count += 1;
          existing.sourceRefs.push(`live:${event.liveEventId}`);
        } else {
          acc.push({ label, count: 1, sourceRefs: [`live:${event.liveEventId}`] });
        }
        return acc;
      }, []).slice(0, 8),
      sourceRefs
    },
    privateDigest: {
      title: `${session.title} まとめ`,
      summary: `${sourceCounts.observations}件の観察、${sourceCounts.absences}件の不在確認、${sourceCounts.participants}人の参加をD1上のイベントから集計しました。`,
      organizerNotes: privacyRiskQueue.length > 0 ? ["公開前に人物・音声・正確な位置の確認が必要です。"] : ["公開候補として確認できます。"],
      nextActions: ["種名候補を確認する", "公開範囲を確認する"],
      sourceRefs: sourceRefs.map((ref) => ref.sourceRef).slice(0, 50)
    },
    publicStoryDraft: {
      title: session.title,
      lead: sourceCounts.observations > 0 ? `${session.title}で記録された観察の概要です。` : `${session.title}の実施概要です。`,
      sections: [
        {
          heading: "記録",
          body: `${sourceCounts.observations}件の観察候補と${sourceCounts.absences}件の不在確認が残っています。`,
          sourceRefs: sourceRefs.map((ref) => ref.sourceRef).slice(0, 12)
        }
      ],
      claimLimit: publicReady ? "draft_requires_review" : "privacy_review_required"
    },
    recordCandidates: observationEvents.map((event) => ({
      candidateId: `candidate:${event.liveEventId}`,
      sourceType: "observation",
      taxonLabel: observationEventTaxonName(event.payload) ?? "未同定の記録",
      identificationStatus: "suggested",
      confidence: numberOrNullFromUnknown(event.payload.confidence),
      sourceRefs: [`live:${event.liveEventId}`],
      notes: []
    })).slice(0, 50),
    privacyRiskQueue,
    readiness: {
      privateReady: true,
      publicReady,
      reportReady: true,
      exportReady: publicReady,
      blockers: privacyRiskQueue.map((risk) => risk.riskType),
      warnings: publicReady ? [] : ["公開前レビューが必要です。"]
    },
    sourceHash: `native:${session.sessionId}:${events.length}:${participants.length}:${absences.length}`,
    modelMetadata: {
      provider: "fallback",
      model: "cloudflare-d1-deterministic-capsule",
      promptVersion: "place_event_capsule/v1",
      aiAttempted: false,
      fallbackReason: "cloudflare_worker_native_no_ai",
      paidOrVertexRequired: false
    },
    reviewStatus: privacyRiskQueue.length > 0 ? "needs_review" : "draft",
    reviewedBy: null,
    reviewedAt: null,
    publishedAt: null,
    generatedBy,
    generatedAt,
    updatedAt: generatedAt
  };
}

function detectObservationEventCapsuleRisks(events: Awaited<ReturnType<typeof listObservationEventLiveEvents>>, participants: ObservationEventParticipantD1Row[]) {
  const risks: Array<{ riskId: string; riskType: string; blockingLevel: string; reason: string; sourceRefs: string[] }> = [];
  const minorRefs = participants.filter((participant) => participant.is_minor === 1).map((participant) => `participant:${participant.participant_id}`);
  if (minorRefs.length > 0) {
    risks.push({ riskId: "risk:minor_present", riskType: "minor_present", blockingLevel: "public_display", reason: "未成年の参加者が含まれるため公開前確認が必要です。", sourceRefs: minorRefs });
  }
  for (const event of events) {
    const payload = event.payload;
    const ref = `live:${event.liveEventId}`;
    const faceCount = numberOrNullFromUnknown(asPlainObject(payload.face_privacy)?.face_count) ?? 0;
    if (truthyPayloadFlag(payload, ["person_present", "face_present", "has_face"]) || faceCount > 0) {
      risks.push({ riskId: `risk:face:${event.liveEventId}`, riskType: "face_present", blockingLevel: "public_display", reason: "人物または顔が含まれる可能性があります。", sourceRefs: [ref] });
    }
    if (truthyPayloadFlag(payload, ["human_voice", "voice_flag", "speech_likely"]) || normalizeOptionalText(payload.audio_privacy_status) === "deleted_human_voice") {
      risks.push({ riskId: `risk:voice:${event.liveEventId}`, riskType: "human_voice", blockingLevel: "public_display", reason: "人声が含まれる可能性があります。", sourceRefs: [ref] });
    }
    if (truthyPayloadFlag(payload, ["exact_location", "exact_location_stored"]) || numberOrNullFromUnknown(payload.exact_lat) !== null || numberOrNullFromUnknown(payload.exact_lng) !== null) {
      risks.push({ riskId: `risk:location:${event.liveEventId}`, riskType: "exact_location", blockingLevel: "public_display", reason: "正確な位置が含まれる可能性があります。", sourceRefs: [ref] });
    }
  }
  return risks;
}

function truthyPayloadFlag(payload: Record<string, unknown>, keys: string[]): boolean {
  return keys.some((key) => {
    const value = payload[key];
    return value === true || value === "true" || value === 1 || value === "1";
  });
}

async function getObservationEventCapsuleRow(env: Env, sessionId: string) {
  return env.OBS_DB.prepare(
    `SELECT session_id, source_counts_json, source_clusters_json, private_digest_json,
            public_story_draft_json, record_candidates_json, privacy_risk_queue_json,
            readiness_json, source_hash, model_metadata_json, review_status, reviewed_by,
            reviewed_at, published_at, generated_at, updated_at
       FROM observation_event_capsules
      WHERE session_id = ?`
  ).bind(sessionId).first<ObservationEventCapsuleD1Row>();
}

async function upsertObservationEventCapsule(env: Env, capsule: ReturnType<typeof buildObservationEventCapsulePayload>): Promise<void> {
  await env.OBS_DB.prepare(
    `INSERT INTO observation_event_capsules (
       capsule_id, session_id, source_counts_json, source_clusters_json, private_digest_json,
       public_story_draft_json, record_candidates_json, privacy_risk_queue_json, readiness_json,
       source_hash, model_metadata_json, review_status, generated_by, generated_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(session_id) DO UPDATE SET
       source_counts_json = excluded.source_counts_json,
       source_clusters_json = excluded.source_clusters_json,
       private_digest_json = excluded.private_digest_json,
       public_story_draft_json = excluded.public_story_draft_json,
       record_candidates_json = excluded.record_candidates_json,
       privacy_risk_queue_json = excluded.privacy_risk_queue_json,
       readiness_json = excluded.readiness_json,
       source_hash = excluded.source_hash,
       model_metadata_json = excluded.model_metadata_json,
       review_status = excluded.review_status,
       generated_by = excluded.generated_by,
       generated_at = excluded.generated_at,
       updated_at = excluded.updated_at`
  ).bind(
    crypto.randomUUID(),
    capsule.sessionId,
    JSON.stringify(capsule.sourceCounts),
    JSON.stringify(capsule.sourceClusters),
    JSON.stringify(capsule.privateDigest),
    JSON.stringify(capsule.publicStoryDraft),
    JSON.stringify(capsule.recordCandidates),
    JSON.stringify(capsule.privacyRiskQueue),
    JSON.stringify(capsule.readiness),
    capsule.sourceHash,
    JSON.stringify(capsule.modelMetadata),
    capsule.reviewStatus,
    capsule.generatedBy,
    capsule.generatedAt,
    capsule.updatedAt
  ).run();
}

function mapObservationEventCapsule(row: ObservationEventCapsuleD1Row) {
  return {
    sessionId: row.session_id,
    sourceCounts: jsonObject(row.source_counts_json),
    sourceClusters: jsonObject(row.source_clusters_json),
    privateDigest: jsonObject(row.private_digest_json),
    publicStoryDraft: jsonObject(row.public_story_draft_json),
    recordCandidates: jsonArray(row.record_candidates_json),
    privacyRiskQueue: jsonArray(row.privacy_risk_queue_json) as Array<Record<string, unknown>>,
    readiness: jsonObject(row.readiness_json),
    sourceHash: row.source_hash,
    modelMetadata: jsonObject(row.model_metadata_json),
    reviewStatus: normalizeCapsuleReviewStatus(row.review_status) ?? "draft",
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    publishedAt: row.published_at,
    generatedAt: row.generated_at,
    updatedAt: row.updated_at
  };
}

export async function pingObservationEventLocation(request: Request, env: Env, sessionId: string): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  if (!isObservationEventLocationShareOpen(session)) {
    return json({ error: "location sharing is outside event time" }, 403, { "cache-control": "no-store" });
  }
  const { auth, guestToken } = await observationEventRequestActor(request, env, sessionId);
  const body = await readJson<Record<string, unknown>>(request);
  if (!auth && !guestToken) return json({ error: "user or guest_token required" }, 400, { "cache-control": "no-store" });
  const lat = numberOrNullFromUnknown(body.lat);
  const lng = numberOrNullFromUnknown(body.lng);
  if (lat === null || lng === null) return json({ error: "lat and lng required" }, 400, { "cache-control": "no-store" });
  const participant = await findObservationEventParticipant(env, sessionId, auth?.userId ?? null, guestToken);
  if (!participant) return json({ error: "participant not found" }, 404, { "cache-control": "no-store" });
  const shareUntil = participant.location_share_until ? Date.parse(participant.location_share_until) : 0;
  if (participant.share_location !== 1 || !Number.isFinite(shareUntil) || shareUntil < Date.now()) {
    return json({ error: "location sharing is not enabled" }, 403, { "cache-control": "no-store" });
  }
  const publicLat = roundPublicEventCoordinate(lat);
  const publicLng = roundPublicEventCoordinate(lng);
  await recordObservationEventMeshVisit(env, {
    sessionId,
    lat: publicLat,
    lng: publicLng,
    visitSeconds: numberOrNullFromUnknown(body.visit_seconds) ?? 0,
    teamId: participant.team_id
  });
  const event = await appendObservationEventLive(env, {
    sessionId,
    type: "participant_location_ping",
    scope: "organizer",
    actorUserId: auth?.userId ?? null,
    actorGuestToken: guestToken,
    teamId: participant.team_id,
    payload: {
      participant_id: participant.participant_id,
      display_name: participant.display_name ?? "",
      team_id: participant.team_id,
      public_lat: publicLat,
      public_lng: publicLng,
      precision: "public_3_decimal",
      exact_location_stored: false
    }
  });
  return json({ ok: true, event }, 200, { "cache-control": "no-store" });
}

function isObservationEventLocationShareOpen(session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>): boolean {
  return isObservationEventActivityOpen(session);
}
