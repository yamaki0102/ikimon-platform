import type { Env } from "../core/env";
import { assertSameOriginRequest, json, normalizeOptionalText, readJson } from "../core/http";
import { receivePublicProgram } from "../publicProgramReceiver";
import { ProgramHandoverApplyRuntime } from "../../../src/services/programHandoverApplyRuntime";
import { readCompatibleSession, stripPublicLangPrefix } from "../core/shared";
import { OBSERVATION_EVENT_MODES, decideObservationEventQuest, getObservationEventOperationsDashboard, getObservationEventSessionById, recordObservationEventFunnelMetric, runObservationEventQuest } from "./runtime";
import { createObservationEventGuestMedia, getObservationEventDiscoveries, getObservationEventGuestMedia, getObservationEventGuestMediaContent, getObservationEventSessionByEventCode, getObservationRallySnapshot, handleObservationEventDiscoveryPaper, handleObservationEventRallyApi, isPrivateReceivedProgram, reviewObservationEventGuestMedia, withdrawObservationEventGuestMedia } from "./rally";
import { announceObservationEvent, checkinObservationEvent, createObservationEventAbsence, createObservationEventSession, createObservationEventTeam, endObservationEventSession, generateObservationEventCapsule, getObservationEventCapsule, getObservationEventEffort, getObservationEventLiveSnapshot, getObservationEventRecap, getObservationEventRecapPhoto, getObservationEventRecent, getObservationEventSpeciesCsv, pingObservationEventLocation, reviewObservationEventCapsule, suggestObservationEventArea, switchObservationEventMode, updateObservationEventRole, updateObservationEventSession } from "./sessions";
import { applyToObservationEvent, getObservationEventApplicationStatus, getRyuyoDiscoveryCampaign, manageObservationEventDiscoveryCampaign } from "./pages";

export async function handlePublicProgramReceiverApi(request: Request, url: URL, env: Env): Promise<Response | null> {
  const pathname = stripPublicLangPrefix(url.pathname);
  if (pathname !== "/api/v1/programs/receive") return null;
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { "cache-control": "no-store" });
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const auth = await readCompatibleSession(request, env);
  if (!auth) return json({ error: "login required" }, 401, { "cache-control": "no-store" });
  if (auth.banned) return json({ error: "event_creation_unavailable" }, 403, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const result = await receivePublicProgram({
    actorUserId: auth.userId,
    body,
    database: env.OBS_DB,
    loadSession: async (sessionId) => getObservationEventSessionById(env, sessionId),
    loadSessionByEventCode: async (eventCode) => getObservationEventSessionByEventCode(env, eventCode),
    loadRally: async (sessionId) => getObservationRallySnapshot(env, sessionId),
  });
  return json(result.body, result.status, { "cache-control": "no-store" });
}

async function applyObservationEventHandover(request: Request, env: Env, targetProgramId: string): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const auth = await readCompatibleSession(request, env);
  if (!auth) return json({ error: "login required" }, 401, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const logicalAcceptanceId = normalizeOptionalText(body.logical_acceptance_id);
  const acceptanceIdentity = normalizeOptionalText(body.acceptance_identity);
  const tenantId = normalizeOptionalText(body.tenant_id);
  const expectedTargetRevision = normalizeOptionalText(body.expected_target_revision);
  const idempotencyKey = normalizeOptionalText(body.idempotency_key);
  const actorAuditRef = normalizeOptionalText(body.actor_audit_ref);
  if (!logicalAcceptanceId || !acceptanceIdentity || !tenantId || !expectedTargetRevision || !idempotencyKey || !actorAuditRef) {
    return json({ error: "handover_apply_fields_required" }, 400, { "cache-control": "no-store" });
  }
  const runtime = new ProgramHandoverApplyRuntime(env.CORE_DB, env.OBS_DB);
  const outcome = await runtime.apply({
    tenantId,
    workspaceId: normalizeOptionalText(body.workspace_id),
    targetProgramId,
    logicalAcceptanceId,
    acceptanceIdentity,
    actorUserId: auth.userId,
    expectedTargetRevision,
    idempotencyKey,
    actorAuditRef,
    occurredAt: new Date().toISOString(),
  });
  const status = outcome.status === "succeeded" || outcome.status === "replayed" ? 200
    : outcome.status === "conflict" ? 409 : 422;
  return json({ handover: outcome }, status, { "cache-control": "no-store" });
}

async function rollbackObservationEventHandover(request: Request, env: Env, targetProgramId: string): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const auth = await readCompatibleSession(request, env);
  if (!auth) return json({ error: "login required" }, 401, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const logicalApplyId = normalizeOptionalText(body.logical_apply_id);
  const applyIdentity = normalizeOptionalText(body.apply_identity);
  const expectedTargetRevision = normalizeOptionalText(body.expected_target_revision);
  const idempotencyKey = normalizeOptionalText(body.idempotency_key);
  const actorAuditRef = normalizeOptionalText(body.actor_audit_ref);
  if (!logicalApplyId || !applyIdentity || !expectedTargetRevision || !idempotencyKey || !actorAuditRef) {
    return json({ error: "handover_rollback_fields_required" }, 400, { "cache-control": "no-store" });
  }
  const runtime = new ProgramHandoverApplyRuntime(env.CORE_DB, env.OBS_DB);
  const outcome = await runtime.rollback({
    targetProgramId,
    logicalApplyId,
    applyIdentity,
    actorUserId: auth.userId,
    expectedTargetRevision,
    idempotencyKey,
    actorAuditRef,
    occurredAt: new Date().toISOString(),
  });
  const status = outcome.status === "succeeded" || outcome.status === "replayed" ? 200
    : outcome.status === "conflict" ? 409 : 422;
  return json({ handover: outcome }, status, { "cache-control": "no-store" });
}

async function privateReceivedProgramGuard(
  request: Request,
  env: Env,
  sessionId: string,
): Promise<Response | null> {
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session || !isPrivateReceivedProgram(session)) return null;
  const auth = await readCompatibleSession(request, env);
  return auth?.userId === session.organizerUserId
    ? null
    : json({ error: "session not found" }, 404, { "cache-control": "no-store" });
}

export async function handleObservationEventApi(request: Request, url: URL, env: Env): Promise<Response | null> {
  const pathname = stripPublicLangPrefix(url.pathname);
  if (!pathname.startsWith("/api/v1/observation-events")) return null;
  if (request.method === "POST" && pathname === "/api/v1/observation-events/area-suggestions") {
    return suggestObservationEventArea(request, env);
  }

  if (request.method === "POST" && pathname === "/api/v1/observation-events") {
    return createObservationEventSession(request, env);
  }
  if (request.method === "GET" && pathname === "/api/v1/observation-events/campaigns/ryuyo") {
    return getRyuyoDiscoveryCampaign(request, url, env);
  }
  const discoveryCampaignMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/discovery-campaign$/);
  if (discoveryCampaignMatch?.[1] && (request.method === "GET" || request.method === "PATCH")) {
    return manageObservationEventDiscoveryCampaign(request, env, decodeURIComponent(discoveryCampaignMatch[1]));
  }
  const applicationMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/application$/);
  if (request.method === "GET" && applicationMatch?.[1]) {
    return getObservationEventApplicationStatus(request, env, decodeURIComponent(applicationMatch[1]));
  }
  if (request.method === "POST" && applicationMatch?.[1]) {
    return applyToObservationEvent(request, env, decodeURIComponent(applicationMatch[1]));
  }
  const handoverApplyMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/handover-apply$/);
  if (request.method === "POST" && handoverApplyMatch?.[1]) {
    return applyObservationEventHandover(request, env, decodeURIComponent(handoverApplyMatch[1]));
  }
  const handoverRollbackMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/handover-rollback$/);
  if (request.method === "POST" && handoverRollbackMatch?.[1]) {
    return rollbackObservationEventHandover(request, env, decodeURIComponent(handoverRollbackMatch[1]));
  }
  const guestMediaMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/guest-media(?:\/([^/]+)(?:\/(content|review|withdraw))?)?$/);
  if (guestMediaMatch?.[1]) {
    const sessionId = decodeURIComponent(guestMediaMatch[1]);
    const submissionId = guestMediaMatch[2] ? decodeURIComponent(guestMediaMatch[2]) : null;
    const action = guestMediaMatch[3] ?? "";
    if (!submissionId && request.method === "POST") return createObservationEventGuestMedia(request, env, sessionId);
    if (!submissionId && request.method === "GET") return getObservationEventGuestMedia(request, env, sessionId);
    if (submissionId && action === "content" && request.method === "GET") return getObservationEventGuestMediaContent(request, env, sessionId, submissionId);
    if (submissionId && action === "review" && request.method === "PATCH") return reviewObservationEventGuestMedia(request, env, sessionId, submissionId);
    if (submissionId && action === "withdraw" && request.method === "POST") return withdrawObservationEventGuestMedia(request, env, sessionId, submissionId);
    return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
  }
  const discoveriesMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/discoveries(?:\/([^/]+)\/(content))?$/);
  if (discoveriesMatch?.[1]) {
    if (request.method !== "GET") return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
    return getObservationEventDiscoveries(request, env, decodeURIComponent(discoveriesMatch[1]), discoveriesMatch[2] ? decodeURIComponent(discoveriesMatch[2]) : null);
  }
  const discoveryPaperMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/discovery-paper(?:\/([^/]+)\/(review|withdraw))?$/);
  if (discoveryPaperMatch?.[1]) {
    return handleObservationEventDiscoveryPaper(request, env, decodeURIComponent(discoveryPaperMatch[1]),
      discoveryPaperMatch[2] ? decodeURIComponent(discoveryPaperMatch[2]) : null, discoveryPaperMatch[3] ?? "");
  }
  const privateSessionMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)/);
  if (privateSessionMatch?.[1] && !["by-code", "area-suggestions"].includes(privateSessionMatch[1])) {
    const privateGuard = await privateReceivedProgramGuard(request, env, decodeURIComponent(privateSessionMatch[1]));
    if (privateGuard) return privateGuard;
  }
  const byCodeRecapMatch = pathname.match(/^\/api\/v1\/observation-events\/by-code\/([^/]+)\/recap$/);
  if (request.method === "GET" && byCodeRecapMatch?.[1]) {
    const session = await getObservationEventSessionByEventCode(env, decodeURIComponent(byCodeRecapMatch[1]));
    return session ? getObservationEventRecap(request, url, env, session.sessionId) : json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  }
  const byCodeMatch = pathname.match(/^\/api\/v1\/observation-events\/by-code\/([^/]+)$/);
  if (request.method === "GET" && byCodeMatch?.[1]) {
    const session = await getObservationEventSessionByEventCode(env, decodeURIComponent(byCodeMatch[1]));
    return session ? json({ session }, 200, { "cache-control": "no-store" }) : json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  }
  const locationMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/location$/);
  if (request.method === "POST" && locationMatch?.[1]) {
    return pingObservationEventLocation(request, env, decodeURIComponent(locationMatch[1]));
  }
  const recapPhotoMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/photos\/([a-f0-9]{32})$/);
  if (request.method === "GET" && recapPhotoMatch?.[1] && recapPhotoMatch[2]) {
    return getObservationEventRecapPhoto(
      request,
      env,
      decodeURIComponent(recapPhotoMatch[1]),
      recapPhotoMatch[2]
    );
  }
  const rallyMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/rally(?:\/(.*))?$/);
  if (rallyMatch?.[1]) {
    return handleObservationEventRallyApi(request, env, decodeURIComponent(rallyMatch[1]), rallyMatch[2] ? decodeURIComponent(rallyMatch[2]) : "");
  }
  const capsuleMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/capsule(?:\/(generate|review))?$/);
  if (capsuleMatch?.[1]) {
    const sessionId = decodeURIComponent(capsuleMatch[1]);
    const action = capsuleMatch[2] ? decodeURIComponent(capsuleMatch[2]) : "";
    if (request.method === "GET" && action === "") return getObservationEventCapsule(request, env, sessionId);
    if (request.method === "POST" && action === "generate") return generateObservationEventCapsule(request, env, sessionId);
    if (request.method === "PATCH" && action === "review") return reviewObservationEventCapsule(request, env, sessionId);
    return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
  }
  const questRunMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/quests\/run$/);
  if (request.method === "POST" && questRunMatch?.[1]) {
    return runObservationEventQuest(request, env, decodeURIComponent(questRunMatch[1]));
  }
  const questDecisionMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)\/quests\/([^/]+)$/);
  if (request.method === "PATCH" && questDecisionMatch?.[1] && questDecisionMatch[2]) {
    return decideObservationEventQuest(request, env, decodeURIComponent(questDecisionMatch[1]), decodeURIComponent(questDecisionMatch[2]));
  }
  const sessionMatch = pathname.match(/^\/api\/v1\/observation-events\/([^/]+)(?:\/([^/]+))?$/);
  if (!sessionMatch?.[1]) return json({ error: "not_found" }, 404, { "cache-control": "no-store" });

  const sessionId = decodeURIComponent(sessionMatch[1]);
  const action = sessionMatch[2] ? decodeURIComponent(sessionMatch[2]) : "";
  if (request.method === "GET" && action === "") {
    const session = await getObservationEventSessionById(env, sessionId);
    return session ? json({ session, modes: OBSERVATION_EVENT_MODES }, 200, { "cache-control": "no-store" }) : json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  }
  if (request.method === "PATCH" && action === "") return updateObservationEventSession(request, env, sessionId);
  if (request.method === "GET" && action === "recent") return getObservationEventRecent(request, url, env, sessionId);
  if (request.method === "GET" && action === "live") return getObservationEventLiveSnapshot(request, env, sessionId);
  if (request.method === "POST" && action === "analytics") return recordObservationEventFunnelMetric(request, env, sessionId);
  if (request.method === "GET" && action === "dashboard") return getObservationEventOperationsDashboard(request, env, sessionId);
  if (request.method === "POST" && action === "announce") return announceObservationEvent(request, env, sessionId);
  if (request.method === "POST" && action === "teams") return createObservationEventTeam(request, env, sessionId);
  if (request.method === "POST" && action === "checkin") return checkinObservationEvent(request, env, sessionId);
  if (request.method === "POST" && action === "absences") return createObservationEventAbsence(request, env, sessionId);
  if (request.method === "PATCH" && action === "mode") return switchObservationEventMode(request, env, sessionId);
  if (request.method === "PATCH" && action === "role") return updateObservationEventRole(request, env, sessionId);
  if (request.method === "POST" && action === "end") return endObservationEventSession(request, env, sessionId);
  if (request.method === "GET" && action === "effort") return getObservationEventEffort(env, sessionId);
  if (request.method === "GET" && action === "recap") return getObservationEventRecap(request, url, env, sessionId);
  if (request.method === "GET" && action === "species.csv") return getObservationEventSpeciesCsv(request, env, sessionId);
  return json({ error: "not_found" }, 404, { "cache-control": "no-store" });
}
