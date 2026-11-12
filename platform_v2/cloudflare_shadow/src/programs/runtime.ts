import type { Env } from "../core/env";
import { assertSameOriginRequest, json, normalizeOptionalText, readJson, sha256Hex, textToArrayBuffer } from "../core/http";
import type { ObservationEventSessionRow } from "../../../src/services/observationEventModeManager";
import { DiscoveryError, EventDiscoveryStore, isEventDiscoveryProfile } from "../eventDiscovery";
import { credentialDigest, guestCookieName, readGuestCredential } from "../guestCredentialNative";
import { asPlainObject, isD1UniqueConstraintError, jsonArray, jsonObject, readCompatibleSession, stringArray, type SessionSnapshot } from "../core/shared";

type ObservationEventMode = "discovery" | "effort_maximize" | "bingo" | "absence_confirm" | "ai_quest";

export const OBSERVATION_EVENT_MODES: readonly ObservationEventMode[] = ["discovery", "effort_maximize", "bingo", "absence_confirm", "ai_quest"];

export const RALLY_COURSE_STATUSES = ["draft", "preflight", "live", "closed"] as const;

export const RALLY_SCOPES = ["event", "team", "participant", "station"] as const;

export const RALLY_LOCATION_BINDINGS = ["none", "station_required", "within_area", "near_route", "any_registered_station"] as const;

export const RALLY_COUNT_UNITS = ["scene", "individual", "location", "comparison_pair", "station_clear", "team_completion"] as const;

export const RALLY_VERIFICATION_POLICIES = ["auto", "organizer_review", "ai_assisted", "qr"] as const;

export const RALLY_WEATHER_SENSITIVITIES = ["all_weather", "rain_ok", "dry_only", "sunny_only", "wind_sensitive", "temperature_sensitive"] as const;

export const RALLY_MISSION_STATUSES = ["draft", "published", "paused", "replaced", "closed"] as const;

export const RALLY_REVISION_ACTIONS = ["publish", "pause", "replace", "extend", "close", "edit"] as const;

const OBSERVATION_EVENT_FUNNEL_EVENT_NAMES = [
  "event_qr_open",
  "event_join_loaded",
  "event_checkin_started",
  "event_checkin_succeeded",
  "event_checkin_failed",
  "event_registration_started",
  "event_registration_succeeded",
  "event_rally_opened",
  "event_photo_selected",
  "event_observation_submit_started",
  "event_observation_succeeded",
  "event_observation_failed",
  "event_live_viewed",
  "event_recap_viewed",
  "event_offline_queued",
  "event_retry_succeeded"
] as const;

type ObservationEventFunnelEventName = typeof OBSERVATION_EVENT_FUNNEL_EVENT_NAMES[number];

const OBSERVATION_EVENT_CLIENT_FUNNEL_EVENT_NAMES: readonly ObservationEventFunnelEventName[] = [
  "event_registration_started",
  "event_photo_selected",
  "event_observation_submit_started",
  "event_observation_failed",
  "event_offline_queued",
  "event_retry_succeeded"
];

const OBSERVATION_EVENT_CLIENT_FUNNEL_EVENT_NAME_SET = new Set<string>(OBSERVATION_EVENT_CLIENT_FUNNEL_EVENT_NAMES);

const OBSERVATION_EVENT_FUNNEL_MAX_TOTAL = 5_000;

const OBSERVATION_EVENT_FUNNEL_MAX_PER_EVENT_NAME = 1_000;

type ObservationEventFunnelPage = "join" | "rally" | "record" | "live" | "recap";

type ObservationEventFunnelAuthState = "guest" | "signed_in";

type ObservationEventFunnelDeviceClass = "mobile" | "tablet" | "desktop";

type ObservationEventFunnelBrowserFamily = "safari" | "chrome" | "in_app" | "other";

type ObservationEventFunnelNetworkState = "online" | "offline" | "unknown";

type ObservationEventFunnelResultReason = "validation" | "timeout" | "4xx" | "5xx" | "permission" | "unknown";

type ObservationEventFunnelDurationBucket = "<10s" | "10-30s" | "31-120s" | ">120s";

type ObservationEventFunnelRetryKind = "checkin" | "observation" | "upload";

type ObservationEventFunnelPayload = {
  event_name: ObservationEventFunnelEventName;
  page: ObservationEventFunnelPage;
  auth_state: ObservationEventFunnelAuthState;
  device_class?: ObservationEventFunnelDeviceClass;
  browser_family?: ObservationEventFunnelBrowserFamily;
  network_state?: ObservationEventFunnelNetworkState;
  result_reason?: ObservationEventFunnelResultReason;
  duration_bucket?: ObservationEventFunnelDurationBucket;
  retry_kind?: ObservationEventFunnelRetryKind;
};

const OBSERVATION_EVENT_FUNNEL_PAYLOAD_KEYS = new Set([
  "event_name",
  "page",
  "auth_state",
  "device_class",
  "browser_family",
  "network_state",
  "result_reason",
  "duration_bucket",
  "retry_kind"
]);

const OBSERVATION_EVENT_FUNNEL_EVENT_NAME_SET = new Set<string>(OBSERVATION_EVENT_FUNNEL_EVENT_NAMES);

const OBSERVATION_EVENT_FUNNEL_PAGES = new Set<ObservationEventFunnelPage>(["join", "rally", "record", "live", "recap"]);

const OBSERVATION_EVENT_FUNNEL_AUTH_STATES = new Set<ObservationEventFunnelAuthState>(["guest", "signed_in"]);

const OBSERVATION_EVENT_FUNNEL_DEVICE_CLASSES = new Set<ObservationEventFunnelDeviceClass>(["mobile", "tablet", "desktop"]);

const OBSERVATION_EVENT_FUNNEL_BROWSER_FAMILIES = new Set<ObservationEventFunnelBrowserFamily>(["safari", "chrome", "in_app", "other"]);

const OBSERVATION_EVENT_FUNNEL_NETWORK_STATES = new Set<ObservationEventFunnelNetworkState>(["online", "offline", "unknown"]);

const OBSERVATION_EVENT_FUNNEL_RESULT_REASONS = new Set<ObservationEventFunnelResultReason>(["validation", "timeout", "4xx", "5xx", "permission", "unknown"]);

const OBSERVATION_EVENT_FUNNEL_DURATION_BUCKETS = new Set<ObservationEventFunnelDurationBucket>(["<10s", "10-30s", "31-120s", ">120s"]);

const OBSERVATION_EVENT_FUNNEL_RETRY_KINDS = new Set<ObservationEventFunnelRetryKind>(["checkin", "observation", "upload"]);

export interface ObservationEventSessionD1Row {
  session_id: string;
  legacy_event_id: string | null;
  event_code: string | null;
  title: string;
  organizer_user_id: string;
  corporation_id: string | null;
  plan: string;
  primary_mode: string;
  active_modes_json: string;
  location_lat: number | null;
  location_lng: number | null;
  location_radius_m: number;
  started_at: string;
  ended_at: string | null;
  target_species_json: string;
  config_json: string;
  field_id: string | null;
  template_source_session_id: string | null;
  created_at: string;
  updated_at: string;
}

interface ObservationEventLiveD1Row {
  live_event_id: string;
  session_id: string;
  type: string;
  scope: string;
  actor_user_id?: string | null;
  actor_guest_token?: string | null;
  team_id: string | null;
  payload_json: string;
  created_at: string;
}

export interface ObservationEventTeamD1Row {
  team_id: string;
  name: string;
  color: string;
  lead_user_id: string | null;
  target_taxa_json: string;
  created_at: string;
}

export interface ObservationEventParticipantD1Row {
  participant_id: string;
  user_id: string | null;
  guest_token: string | null;
  display_name?: string | null;
  team_id: string | null;
  role: string;
  status: string;
  share_location?: number;
  location_share_until?: string | null;
  is_minor: number;
  discovery_gemini_notice_version?: string | null;
  discovery_gemini_notice_at?: string | null;
}

export interface ObservationEventMeshSummaryRow {
  visited_cells: number;
  visit_seconds_sum: number;
  observation_sum: number;
  absence_sum: number;
}

export interface ObservationEventCapsuleD1Row {
  session_id: string;
  source_counts_json: string;
  source_clusters_json: string;
  private_digest_json: string;
  public_story_draft_json: string;
  record_candidates_json: string;
  privacy_risk_queue_json: string;
  readiness_json: string;
  source_hash: string;
  model_metadata_json: string;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  published_at: string | null;
  generated_at: string;
  updated_at: string;
}

export interface ObservationRallyCourseD1Row {
  course_id: string;
  session_id: string;
  title: string;
  status: string;
  config_json: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObservationRallyStationD1Row {
  station_id: string;
  course_id: string;
  field_id: string | null;
  code: string;
  name: string;
  description: string;
  lat: number | null;
  lng: number | null;
  radius_m: number | null;
  polygon_json: string | null;
  route_geojson: string | null;
  is_private: number;
  access_note: string;
  danger_note: string;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ObservationRallyMissionD1Row {
  mission_id: string;
  course_id: string;
  station_id: string | null;
  replacement_for_mission_id: string | null;
  scope: string;
  location_binding: string;
  title: string;
  target: string;
  count_unit: string;
  goal_count: number;
  counting_policy_json: string;
  verification_policy: string;
  weather_sensitivity: string;
  fallback_group: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  sort_order: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ObservationRallyProgressD1Row {
  progress_id: string;
  course_id: string;
  mission_id: string;
  progress_scope: string;
  team_id: string | null;
  participant_key: string | null;
  station_id: string | null;
  actual_count: number;
  goal_count: number;
  percent: number;
  status: string;
  updated_at: string;
}

export interface ObservationRallySubmissionD1Row {
  submission_id: string;
  session_id: string;
  course_id: string;
  mission_id: string;
  station_id: string | null;
  user_id: string | null;
  guest_token: string | null;
  team_id: string | null;
  source_type: string;
  source_ref: string | null;
  count_value: number;
  public_lat: number | null;
  public_lng: number | null;
  payload_json: string;
  review_status: string;
  created_at: string;
}

export function isObservationEventCheckinOpen(
  session: Pick<ObservationEventTemplate, "endedAt"> & { config?: Record<string, unknown> },
  nowMs = Date.now()
): boolean {
  if (session.config?.cancelled === true || session.config?.status === "cancelled" || session.config?.state === "cancelled") return false;
  if (!session.endedAt) return true;
  const endedAtMs = Date.parse(session.endedAt);
  return Number.isFinite(endedAtMs) && endedAtMs > nowMs;
}

export function isObservationEventActivityOpen(session: ObservationEventTemplate, nowMs = Date.now()): boolean {
  const startedAtMs = Date.parse(session.startedAt);
  return Number.isFinite(startedAtMs) && startedAtMs <= nowMs && isObservationEventCheckinOpen(session, nowMs);
}

export type ObservationEventTemplate = NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>;

export async function observationEventRequestActor(request: Request, env: Env, sessionId: string) {
  const auth = await readCompatibleSession(request, env);
  const guestCredential = auth ? null : await readObservationEventGuestCredential(request.headers.get("cookie"), sessionId);
  const guestToken = guestCredential ? await observationEventGuestCredentialDigest(guestCredential) : null;
  return { auth, guestToken };
}

export function observationEventObservationId(event: Awaited<ReturnType<typeof listObservationEventLiveEvents>>[number]): string | null {
  return normalizeOptionalText(event.payload.observation_id)
    ?? normalizeOptionalText(event.payload.visit_id);
}

export async function getObservationEventSessionById(env: Env, sessionId: string) {
  const row = await env.OBS_DB.prepare(
    `SELECT session_id, legacy_event_id, event_code, title, organizer_user_id, corporation_id,
            plan, primary_mode, active_modes_json, location_lat, location_lng, location_radius_m,
            started_at, ended_at, target_species_json, config_json, field_id, template_source_session_id,
            created_at, updated_at
       FROM observation_event_sessions
      WHERE session_id = ?`
  ).bind(sessionId).first<ObservationEventSessionD1Row>();
  return row ? mapObservationEventSession(row) : null;
}

export function mapObservationEventSession(row: ObservationEventSessionD1Row): ObservationEventSessionRow {
  const activeModes = jsonArray(row.active_modes_json).filter(isObservationEventMode);
  return {
    sessionId: row.session_id,
    legacyEventId: row.legacy_event_id,
    eventCode: row.event_code,
    title: row.title,
    organizerUserId: row.organizer_user_id,
    corporationId: row.corporation_id,
    plan: row.plan === "public" ? "public" : "community",
    primaryMode: isObservationEventMode(row.primary_mode) ? row.primary_mode : "discovery",
    activeModes: activeModes.length > 0 ? activeModes : ["discovery"],
    locationLat: row.location_lat,
    locationLng: row.location_lng,
    locationRadiusM: row.location_radius_m,
    startedAt: row.started_at,
    // Native /end writes SQLite CURRENT_TIMESTAMP in UTC. Preserve that zone
    // when the value reaches a browser or a runtime with a different local TZ.
    endedAt: row.ended_at && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/u.test(row.ended_at)
      ? row.ended_at.replace(" ", "T") + "Z" : row.ended_at,
    targetSpecies: jsonArray(row.target_species_json).filter((value): value is string => typeof value === "string"),
    config: jsonObject(row.config_json),
    fieldId: row.field_id,
    templateSourceSessionId: row.template_source_session_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export async function requireObservationEventOrganizer(request: Request, env: Env, sessionId: string): Promise<{ auth: SessionSnapshot; session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>> } | Response> {
  const auth = await readCompatibleSession(request, env);
  if (!auth) return json({ error: "login required" }, 401, { "cache-control": "no-store" });
  if (auth.banned) return json({ error: "organizer only" }, 403, { "cache-control": "no-store" });
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  if (session.organizerUserId !== auth.userId) return json({ error: "organizer only" }, 403, { "cache-control": "no-store" });
  return { auth, session };
}

function isObservationEventFunnelEventName(value: unknown): value is ObservationEventFunnelEventName {
  return typeof value === "string" && OBSERVATION_EVENT_FUNNEL_EVENT_NAME_SET.has(value);
}

function parseObservationEventFunnelPayload(input: Record<string, unknown>): ObservationEventFunnelPayload | null {
  if (Object.keys(input).some((key) => !OBSERVATION_EVENT_FUNNEL_PAYLOAD_KEYS.has(key))) return null;
  if (!isObservationEventFunnelEventName(input.event_name)) return null;
  if (typeof input.page !== "string" || !OBSERVATION_EVENT_FUNNEL_PAGES.has(input.page as ObservationEventFunnelPage)) return null;
  if (typeof input.auth_state !== "string" || !OBSERVATION_EVENT_FUNNEL_AUTH_STATES.has(input.auth_state as ObservationEventFunnelAuthState)) return null;
  const optionalValues: Array<[unknown, ReadonlySet<string>]> = [
    [input.device_class, OBSERVATION_EVENT_FUNNEL_DEVICE_CLASSES],
    [input.browser_family, OBSERVATION_EVENT_FUNNEL_BROWSER_FAMILIES],
    [input.network_state, OBSERVATION_EVENT_FUNNEL_NETWORK_STATES],
    [input.result_reason, OBSERVATION_EVENT_FUNNEL_RESULT_REASONS],
    [input.duration_bucket, OBSERVATION_EVENT_FUNNEL_DURATION_BUCKETS],
    [input.retry_kind, OBSERVATION_EVENT_FUNNEL_RETRY_KINDS]
  ];
  if (optionalValues.some(([value, allowed]) => value !== undefined && (typeof value !== "string" || !allowed.has(value)))) return null;
  return {
    event_name: input.event_name,
    page: input.page as ObservationEventFunnelPage,
    auth_state: input.auth_state as ObservationEventFunnelAuthState,
    ...(input.device_class ? { device_class: input.device_class as ObservationEventFunnelDeviceClass } : {}),
    ...(input.browser_family ? { browser_family: input.browser_family as ObservationEventFunnelBrowserFamily } : {}),
    ...(input.network_state ? { network_state: input.network_state as ObservationEventFunnelNetworkState } : {}),
    ...(input.result_reason ? { result_reason: input.result_reason as ObservationEventFunnelResultReason } : {}),
    ...(input.duration_bucket ? { duration_bucket: input.duration_bucket as ObservationEventFunnelDurationBucket } : {}),
    ...(input.retry_kind ? { retry_kind: input.retry_kind as ObservationEventFunnelRetryKind } : {})
  };
}

export function serverObservationEventFunnelContext(
  request: Request,
  page: ObservationEventFunnelPage,
  signedIn: boolean
): Omit<ObservationEventFunnelPayload, "event_name"> {
  const userAgent = request.headers.get("user-agent") ?? "";
  const deviceClass: ObservationEventFunnelDeviceClass = /ipad|tablet/i.test(userAgent)
    ? "tablet"
    : /mobile|iphone|ipod|android/i.test(userAgent)
      ? "mobile"
      : "desktop";
  const browserFamily: ObservationEventFunnelBrowserFamily = /line\/|instagram|fban|fbav|; wv\)|webview/i.test(userAgent)
    ? "in_app"
    : /crios|chrome|chromium/i.test(userAgent)
      ? "chrome"
      : /safari/i.test(userAgent)
        ? "safari"
        : "other";
  return {
    page,
    auth_state: signedIn ? "signed_in" : "guest",
    device_class: deviceClass,
    browser_family: browserFamily,
    network_state: "unknown"
  };
}

async function appendObservationEventFunnelMetric(
  env: Env,
  sessionId: string,
  payload: ObservationEventFunnelPayload,
  actorKey: string
) {
  const metricIdentity = await sha256Hex(textToArrayBuffer(
    `observation-event-funnel-v1\u0000${sessionId}\u0000${payload.event_name}\u0000${actorKey}`
  ));
  try {
    const result = await env.OBS_DB.prepare(
      `INSERT INTO observation_event_live_events (
         live_event_id, session_id, type, scope, actor_user_id, actor_guest_token, team_id, payload_json
       )
       SELECT ?, ?, 'funnel_metric', 'organizer', NULL, NULL, NULL, ?
        WHERE (SELECT COUNT(*)
                 FROM observation_event_live_events
                WHERE session_id = ? AND type = 'funnel_metric') < ?
          AND (SELECT COUNT(*)
                 FROM observation_event_live_events
                WHERE session_id = ?
                  AND type = 'funnel_metric'
                  AND json_extract(payload_json, '$.event_name') = ?) < ?`
    ).bind(
      `event-funnel-${metricIdentity}`,
      sessionId,
      JSON.stringify(payload),
      sessionId,
      OBSERVATION_EVENT_FUNNEL_MAX_TOTAL,
      sessionId,
      payload.event_name,
      OBSERVATION_EVENT_FUNNEL_MAX_PER_EVENT_NAME
    ).run() as { meta?: { changes?: number } };
    if (Number(result.meta?.changes ?? 1) === 0) {
      return { created: false, reason: "event_metric_capacity" };
    }
    return { created: true, reason: null };
  } catch (error) {
    if (!isD1UniqueConstraintError(error)) throw error;
    return { created: false, reason: "duplicate_actor_event" };
  }
}

export async function recordObservationEventServerFunnelMetric(
  env: Env,
  sessionId: string,
  payload: ObservationEventFunnelPayload,
  actorKey: string
): Promise<void> {
  try {
    await appendObservationEventFunnelMetric(env, sessionId, payload, actorKey);
  } catch (error) {
    console.warn(JSON.stringify({
      message: "observation_event_funnel_metric_skipped",
      eventName: payload.event_name,
      sessionId,
      error: error instanceof Error ? error.message : "unknown"
    }));
  }
}

export async function recordObservationEventParticipantPageMetric(
  request: Request,
  env: Env,
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>,
  eventName: ObservationEventFunnelEventName,
  page: ObservationEventFunnelPage
): Promise<void> {
  if (request.method !== "GET") return;
  const { auth, guestToken } = await observationEventRequestActor(request, env, session.sessionId);
  const canManage = Boolean(auth?.userId && auth.userId === session.organizerUserId);
  const participant = canManage
    ? null
    : await findObservationEventParticipant(env, session.sessionId, auth?.userId ?? null, guestToken);
  if (!canManage && !participant) return;
  await recordObservationEventServerFunnelMetric(env, session.sessionId, {
    event_name: eventName,
    ...serverObservationEventFunnelContext(request, page, Boolean(auth))
  }, canManage && auth?.userId ? `user:${auth.userId}` : `participant:${participant!.participant_id}`);
}

export async function recordObservationEventFunnelMetric(request: Request, env: Env, sessionId: string): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "session not found" }, 404, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const payload = parseObservationEventFunnelPayload(body);
  if (!payload) return json({ ok: false, error: "invalid_analytics_payload" }, 400, { "cache-control": "no-store" });
  const { auth, guestToken } = await observationEventRequestActor(request, env, sessionId);
  const canManage = Boolean(auth?.userId && auth.userId === session.organizerUserId);
  let participant = canManage
    ? null
    : await findObservationEventParticipant(env, sessionId, auth?.userId ?? null, guestToken);
  if (!canManage && !participant && auth) {
    const registrationGuestCredential = await readObservationEventGuestCredential(request.headers.get("cookie"), sessionId);
    const registrationGuestToken = registrationGuestCredential
      ? await observationEventGuestCredentialDigest(registrationGuestCredential)
      : null;
    participant = registrationGuestToken
      ? await findObservationEventParticipant(env, sessionId, null, registrationGuestToken)
      : null;
  }
  if (!canManage && !participant) {
    return json({ ok: false, error: "event_participant_required" }, auth || guestToken ? 403 : 401, { "cache-control": "no-store" });
  }
  const actualAuthState: ObservationEventFunnelAuthState = auth ? "signed_in" : "guest";
  if (payload.auth_state !== actualAuthState) {
    return json({ ok: false, error: "analytics_auth_state_mismatch" }, 400, { "cache-control": "no-store" });
  }
  if (!OBSERVATION_EVENT_CLIENT_FUNNEL_EVENT_NAME_SET.has(payload.event_name)) {
    return json({ ok: false, error: "server_managed_analytics_event" }, 400, { "cache-control": "no-store" });
  }
  if (payload.event_name === "event_offline_queued") {
    return json({ ok: false, error: "durable_offline_queue_unavailable" }, 409, { "cache-control": "no-store" });
  }
  const actorKey = canManage && auth?.userId
    ? `user:${auth.userId}`
    : `participant:${participant!.participant_id}`;
  await appendObservationEventFunnelMetric(env, sessionId, payload, actorKey);
  return json({ ok: true, event_name: payload.event_name }, 202, { "cache-control": "no-store" });
}

export async function buildObservationEventOperationsDashboard(
  env: Env,
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>
) {
  const [participants, events] = await Promise.all([
    listObservationEventParticipants(env, session.sessionId),
    listObservationEventLiveEvents(env, session.sessionId, 5000, true)
  ]);
  const funnelCounts = new Map<ObservationEventFunnelEventName, number>(
    OBSERVATION_EVENT_FUNNEL_EVENT_NAMES.map((name) => [name, 0])
  );
  for (const event of events) {
    if (event.type !== "funnel_metric" || event.scope !== "organizer") continue;
    const eventName = event.payload.event_name;
    if (!isObservationEventFunnelEventName(eventName)) continue;
    funnelCounts.set(eventName, (funnelCounts.get(eventName) ?? 0) + 1);
  }
  const funnelStages = [
    ["QR entry", "event_qr_open"],
    ["join", "event_join_loaded"],
    ["check-in", "event_checkin_succeeded"],
    ["rally", "event_rally_opened"],
    ["photo selected", "event_photo_selected"],
    ["submit started", "event_observation_submit_started"],
    ["observation saved", "event_observation_succeeded"],
    ["live", "event_live_viewed"],
    ["recap", "event_recap_viewed"]
  ] as const;
  let previousCount: number | null = null;
  const funnel = funnelStages.map(([label, eventName]) => {
    const count = funnelCounts.get(eventName) ?? 0;
    const conversionFromPreviousPct = previousCount && previousCount > 0
      ? Math.round((count / previousCount) * 1000) / 10
      : null;
    previousCount = count;
    return { label, eventName, count, conversionFromPreviousPct };
  });
  const observationIds = new Set(
    events
      .filter((event) => event.type === "observation_added")
      .map(observationEventObservationId)
      .filter((value): value is string => Boolean(value))
  );
  const latestCreatedAt = events
    .map((event) => event.createdAt)
    .filter(Boolean)
    .sort((a, b) => b.localeCompare(a))[0] ?? session.updatedAt;
  const endedAtMs = session.endedAt ? Date.parse(session.endedAt) : Number.NaN;
  return {
    sessionId: session.sessionId,
    allowedEventNames: [...OBSERVATION_EVENT_FUNNEL_EVENT_NAMES],
    funnel,
    failures: {
      checkin: funnelCounts.get("event_checkin_failed") ?? 0,
      observation: funnelCounts.get("event_observation_failed") ?? 0,
      classification: "untrusted_participant_telemetry",
      automaticFallbackEligible: false,
      requiredCorroboration: "staff_reproduction_or_domain_health_signal"
    },
    domain: {
      checkedInFamiliesOrGroups: participants.filter(isObservationEventParticipatingGroup).length,
      observationCount: observationIds.size,
      submissionSucceededCount: observationIds.size,
      submissionFailedSignalCount: funnelCounts.get("event_observation_failed") ?? 0,
      unsynced: { status: "not_measurable", count: null, reason: "durable_queue_not_available" },
      lastUpdatedAt: latestCreatedAt,
      liveAggregationDelay: { status: "not_measurable", seconds: null, reason: "snapshot_delivery_has_no_separate_reflection_timestamp" },
      recapStatus: Number.isFinite(endedAtMs) && endedAtMs <= Date.now() ? "ready" : "not_started"
    }
  };
}

export async function getObservationEventOperationsDashboard(request: Request, env: Env, sessionId: string): Promise<Response> {
  const organizer = await requireObservationEventOrganizer(request, env, sessionId);
  if (organizer instanceof Response) return organizer;
  const dashboard = await buildObservationEventOperationsDashboard(env, organizer.session);
  return json({ dashboard }, 200, { "cache-control": "no-store" });
}

export async function appendObservationEventLive(env: Env, input: {
  sessionId: string;
  type: string;
  scope?: string;
  actorUserId?: string | null;
  actorGuestToken?: string | null;
  teamId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const liveEventId = crypto.randomUUID();
  await env.OBS_DB.prepare(
    `INSERT INTO observation_event_live_events (
       live_event_id, session_id, type, scope, actor_user_id, actor_guest_token, team_id, payload_json
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(liveEventId, input.sessionId, input.type, input.scope ?? "all", input.actorUserId ?? null, input.actorGuestToken ?? null, input.teamId ?? null, JSON.stringify(input.payload ?? {})).run();
  return {
    liveEventId,
    sessionId: input.sessionId,
    type: input.type,
    scope: input.scope ?? "all",
    teamId: input.teamId ?? null,
    payload: input.payload ?? {},
    createdAt: new Date().toISOString()
  };
}

export async function listObservationEventLiveEvents(
  env: Env,
  sessionId: string,
  limit: number,
  includeFunnelMetrics = false
) {
  const rows = await env.OBS_DB.prepare(
    `SELECT live_event_id, session_id, type, scope, actor_user_id, actor_guest_token, team_id, payload_json, created_at
       FROM observation_event_live_events
      WHERE session_id = ?
        AND (? = 1 OR type <> 'funnel_metric')
      ORDER BY created_at DESC
      LIMIT ?`
  ).bind(sessionId, includeFunnelMetrics ? 1 : 0, limit).all<ObservationEventLiveD1Row>();
  return rows.results.map((row) => ({
    liveEventId: row.live_event_id,
    sessionId: row.session_id,
    type: row.type,
    scope: row.scope,
    actorUserId: row.actor_user_id ?? null,
    actorGuestToken: row.actor_guest_token ?? null,
    teamId: row.team_id,
    payload: jsonObject(row.payload_json),
    createdAt: row.created_at
  }));
}

export async function listObservationEventTeams(env: Env, sessionId: string) {
  const rows = await env.OBS_DB.prepare(
    `SELECT team_id, name, color, lead_user_id, target_taxa_json, created_at
       FROM observation_event_teams
      WHERE session_id = ?
      ORDER BY created_at ASC`
  ).bind(sessionId).all<ObservationEventTeamD1Row>();
  return rows.results;
}

export async function listObservationEventParticipants(env: Env, sessionId: string) {
  const rows = await env.OBS_DB.prepare(
    `SELECT participant_id, user_id, guest_token, display_name, team_id, role, status, share_location, location_share_until, is_minor
       FROM observation_event_participants
      WHERE session_id = ?
      ORDER BY checked_in_at ASC, created_at ASC`
  ).bind(sessionId).all<ObservationEventParticipantD1Row>();
  return rows.results;
}

export async function listObservationEventAbsences(env: Env, sessionId: string) {
  const rows = await env.OBS_DB.prepare(
    `SELECT absence_id, session_id, user_id, guest_token, team_id, searched_taxon, public_lat, public_lng
       FROM observation_event_absences
      WHERE session_id = ?
      ORDER BY created_at ASC`
  ).bind(sessionId).all<{
    absence_id: string;
    session_id: string;
    user_id: string | null;
    guest_token: string | null;
    team_id: string | null;
    searched_taxon: string;
    public_lat: number;
    public_lng: number;
  }>();
  return rows.results;
}

export function observationEventTaxonName(payload: Record<string, unknown>): string | null {
  return normalizeOptionalText(payload.taxon_name)
    ?? normalizeOptionalText(payload.taxonName)
    ?? normalizeOptionalText(payload.scientific_name)
    ?? normalizeOptionalText(payload.vernacular_name)
    ?? normalizeOptionalText(payload.taxon)
    ?? normalizeOptionalText(asPlainObject(payload.primary_subject)?.name)
    ?? normalizeOptionalText(asPlainObject(payload.primarySubject)?.name);
}

export function countObservationEventTaxa(events: Array<{ payload: Record<string, unknown> }>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const event of events) {
    const name = observationEventTaxonName(event.payload);
    if (!name) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return new Map([...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ja")));
}

export function durationMinutesBetween(startedAt: string, endedAt: string | null): number | null {
  const start = Date.parse(startedAt);
  const end = endedAt ? Date.parse(endedAt) : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.round((end - start) / 60000));
}

export function isObservationEventParticipatingGroup(participant: ObservationEventParticipantD1Row): boolean {
  if (participant.role === "organizer") return false;
  return participant.status === "checked_in" || participant.status === "offline" || participant.status === "left";
}

export function findObservationEventViewerParticipant(
  participants: ObservationEventParticipantD1Row[],
  userId: string | null,
  guestToken: string | null
): ObservationEventParticipantD1Row | null {
  if (!userId && !guestToken) return null;
  return participants.find((participant) =>
    (userId !== null && participant.user_id === userId) ||
    (guestToken !== null && participant.guest_token === guestToken)
  ) ?? null;
}

export async function recordObservationEventRecapView(env: Env, sessionId: string, userId: string | null, guestToken: string | null): Promise<void> {
  try {
    await env.OBS_DB.prepare(
      "INSERT INTO observation_event_recap_views (view_id, session_id, viewer_user_id, viewer_guest_token) VALUES (?, ?, ?, ?)"
    ).bind(crypto.randomUUID(), sessionId, userId, guestToken).run();
  } catch {
    // Older D1 environments may not have the audit table before the migration is applied.
  }
}

export function observationEventLocationShareUntil(
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>
): string | null {
  const startedAt = Date.parse(session.startedAt);
  if (!Number.isFinite(startedAt)) return null;
  const scheduledEnd = session.endedAt ? Date.parse(session.endedAt) : Number.NaN;
  return new Date(Number.isFinite(scheduledEnd) ? scheduledEnd : startedAt + 4 * 60 * 60 * 1000).toISOString();
}

export async function claimObservationEventGuestParticipant(
  env: Env,
  sessionId: string,
  userId: string,
  guestToken: string,
  retriedAfterConflict = false
): Promise<void> {
  const [guestParticipant, userParticipant] = await Promise.all([
    findObservationEventParticipant(env, sessionId, null, guestToken),
    findObservationEventParticipant(env, sessionId, userId, null)
  ]);
  if (!guestParticipant || (guestParticipant.user_id && guestParticipant.user_id !== userId)) return;
  let discoveryClaim = false;
  const statements = [
    env.OBS_DB.prepare(
      `UPDATE observation_event_live_events
          SET actor_user_id = CASE WHEN actor_guest_token = ? THEN ? ELSE actor_user_id END,
              actor_guest_token = CASE WHEN actor_guest_token = ? THEN NULL ELSE actor_guest_token END,
              payload_json = CASE
                WHEN json_extract(payload_json, '$.target_guest_token') = ?
                  THEN json_set(json_remove(payload_json, '$.target_guest_token'), '$.target_user_id', ?)
                ELSE payload_json
              END
        WHERE session_id = ?
          AND (actor_guest_token = ? OR json_extract(payload_json, '$.target_guest_token') = ?)`
    ).bind(guestToken, userId, guestToken, guestToken, userId, sessionId, guestToken, guestToken),
    env.OBS_DB.prepare(
      `UPDATE observation_event_absences
          SET user_id = ?, guest_token = NULL
        WHERE session_id = ? AND guest_token = ?`
    ).bind(userId, sessionId, guestToken),
    env.OBS_DB.prepare(
      `DELETE FROM observation_rally_submissions
        WHERE submission_id IN (
          SELECT guest.submission_id
            FROM observation_rally_submissions guest
            JOIN observation_rally_submissions account
              ON account.session_id = guest.session_id
             AND account.user_id = ?
             AND account.mission_id = guest.mission_id
             AND account.source_type = guest.source_type
             AND account.source_ref = guest.source_ref
           WHERE guest.session_id = ?
             AND guest.guest_token = ?
             AND guest.source_ref IS NOT NULL
             AND TRIM(guest.source_ref) <> ''
        )`
    ).bind(userId, sessionId, guestToken),
    env.OBS_DB.prepare(
      `UPDATE observation_rally_submissions
          SET user_id = ?, guest_token = NULL
        WHERE session_id = ? AND guest_token = ?`
    ).bind(userId, sessionId, guestToken),
    env.OBS_DB.prepare(
      `UPDATE observation_event_recap_views
          SET viewer_user_id = ?, viewer_guest_token = NULL
        WHERE session_id = ? AND viewer_guest_token = ?`
    ).bind(userId, sessionId, guestToken)
  ];

  if (userParticipant && userParticipant.participant_id !== guestParticipant.participant_id) {
    const eventSession = await getObservationEventSessionById(env, sessionId);
    discoveryClaim = Boolean(eventSession && isEventDiscoveryProfile(eventSession.config));
    if (discoveryClaim) {
      statements.push(...await new EventDiscoveryStore(env.OBS_DB, env.ASSET_BUCKET).participantClaimStatements(
        sessionId, guestParticipant.participant_id, userParticipant.participant_id, userId,
      ));
    } else try {
      await env.OBS_DB.prepare(
        `UPDATE observation_event_guest_media AS guest
            SET participant_id = ?, actor_user_id = ?,
                idempotency_key = CASE WHEN EXISTS (
                  SELECT 1 FROM observation_event_guest_media AS account
                   WHERE account.session_id = guest.session_id
                     AND account.participant_id = ?
                     AND account.idempotency_key = guest.idempotency_key
                     AND account.submission_id <> guest.submission_id
                ) THEN 'claimed:' || guest.submission_id ELSE guest.idempotency_key END
          WHERE guest.session_id = ? AND guest.participant_id = ?`
      ).bind(userParticipant.participant_id, userId, userParticipant.participant_id, sessionId, guestParticipant.participant_id).run();
    } catch (error) {
      if (!/no such table: observation_event_guest_media/iu.test(String(error))) throw error;
    }
    statements.push(
      env.OBS_DB.prepare(
        `UPDATE observation_event_participants
            SET display_name = COALESCE(NULLIF(display_name, ''), (SELECT display_name FROM observation_event_participants WHERE participant_id = ?)),
                team_id = COALESCE(team_id, (SELECT team_id FROM observation_event_participants WHERE participant_id = ?)),
                declared_job = COALESCE(declared_job, (SELECT declared_job FROM observation_event_participants WHERE participant_id = ?)),
                updated_at = CURRENT_TIMESTAMP
          WHERE participant_id = ?`
      ).bind(guestParticipant.participant_id, guestParticipant.participant_id, guestParticipant.participant_id, userParticipant.participant_id),
      env.OBS_DB.prepare(
        `DELETE FROM observation_event_participants
          WHERE participant_id = ?
            AND session_id = ?
            AND (user_id IS NULL OR user_id = ?)
            AND guest_token = ?`
      ).bind(guestParticipant.participant_id, sessionId, userId, guestToken)
    );
  } else {
    statements.push(
      env.OBS_DB.prepare(
        `UPDATE observation_event_participants
            SET user_id = ?, guest_token = NULL, updated_at = CURRENT_TIMESTAMP
          WHERE participant_id = ?
            AND session_id = ?
            AND (user_id IS NULL OR user_id = ?)
            AND guest_token = ?`
      ).bind(userId, guestParticipant.participant_id, sessionId, userId, guestToken)
    );
  }

  try {
    await env.OBS_DB.batch(statements);
  } catch (error) {
    // The source/sidecar reassignments share this transaction. If a concurrent
    // upload filled the last slot, their conditional merge leaves the guest
    // sidecar attached; its FK fences participant deletion and rolls back.
    if (discoveryClaim && /foreign key constraint/iu.test(String(error))) throw new DiscoveryError(409, "discovery_claim_photo_limit");
    if (!isD1UniqueConstraintError(error) || retriedAfterConflict) throw error;
    await claimObservationEventGuestParticipant(env, sessionId, userId, guestToken, true);
  }
}

export async function upsertObservationEventParticipant(env: Env, input: {
  sessionId: string;
  userId: string | null;
  guestToken: string | null;
  displayName: string;
  teamId: string | null;
  isMinor: boolean;
  shareLocation?: boolean;
  locationShareUntil?: string | null;
  locationShareConsentType?: string | null;
  discoveryGeminiConsentVersion?: string | null;
}): Promise<{ participantId: string; created: boolean }> {
  const existing = await findObservationEventParticipant(env, input.sessionId, input.userId, input.guestToken);
  const shareLocation = input.shareLocation === true && (!input.isMinor || input.locationShareConsentType === "guardian") ? 1 : 0;
  const shareUntil = shareLocation ? input.locationShareUntil ?? new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() : null;
  const consentType = shareLocation ? input.locationShareConsentType ?? "self" : null;
  const geminiNoticeVersion = input.discoveryGeminiConsentVersion ?? null;
  if (existing) {
    await env.OBS_DB.prepare(
      `UPDATE observation_event_participants
          SET display_name = ?, team_id = COALESCE(?, team_id), status = 'checked_in',
              checked_in_at = CURRENT_TIMESTAMP, share_location = ?, is_minor = ?,
              location_share_until = ?, location_share_consent_type = ?,
              discovery_gemini_notice_version = CASE WHEN ? IS NOT NULL THEN ? ELSE discovery_gemini_notice_version END,
              discovery_gemini_notice_at = CASE WHEN ? IS NOT NULL THEN CURRENT_TIMESTAMP ELSE discovery_gemini_notice_at END,
              updated_at = CURRENT_TIMESTAMP
        WHERE participant_id = ?`
    ).bind(input.displayName, input.teamId, shareLocation, input.isMinor ? 1 : 0, shareUntil, consentType,
      geminiNoticeVersion, geminiNoticeVersion, geminiNoticeVersion, existing.participant_id).run();
    return { participantId: existing.participant_id, created: false };
  }
  const participantId = crypto.randomUUID();
  try {
    await env.OBS_DB.prepare(
      `INSERT INTO observation_event_participants (
         participant_id, session_id, user_id, guest_token, display_name, team_id, role, status,
         checked_in_at, share_location, is_minor, location_share_until, location_share_consent_type,
         discovery_gemini_notice_version, discovery_gemini_notice_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'participant', 'checked_in', CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, CASE WHEN ? IS NOT NULL THEN CURRENT_TIMESTAMP ELSE NULL END)`
    ).bind(participantId, input.sessionId, input.userId, input.guestToken, input.displayName, input.teamId, shareLocation, input.isMinor ? 1 : 0, shareUntil, consentType, geminiNoticeVersion, geminiNoticeVersion).run();
    return { participantId, created: true };
  } catch (error) {
    if (!isD1UniqueConstraintError(error)) throw error;
    const concurrent = await findObservationEventParticipant(env, input.sessionId, input.userId, input.guestToken);
    if (!concurrent) throw error;
    return { participantId: concurrent.participant_id, created: false };
  }
}

export async function findObservationEventParticipant(env: Env, sessionId: string, userId: string | null, guestToken: string | null) {
  if (!userId && !guestToken) return null;
  return env.OBS_DB.prepare(
    `SELECT participant_id, user_id, guest_token, display_name, team_id, role, status,
            share_location, location_share_until, is_minor, discovery_gemini_notice_version, discovery_gemini_notice_at
       FROM observation_event_participants
      WHERE session_id = ?
        AND ((user_id IS NOT NULL AND user_id = ?) OR (guest_token IS NOT NULL AND guest_token = ?))
      LIMIT 1`
  ).bind(sessionId, userId, guestToken).first<ObservationEventParticipantD1Row>();
}

export async function observationEventParticipantContext(
  request: Request,
  env: Env,
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>
) {
  const auth = await readCompatibleSession(request, env).catch(() => null);
  const guestCredential = await readObservationEventGuestCredential(request.headers.get("cookie"), session.sessionId);
  const guestToken = guestCredential ? await observationEventGuestCredentialDigest(guestCredential) : null;
  const [userParticipant, guestParticipant] = await Promise.all([
    auth?.userId ? findObservationEventParticipant(env, session.sessionId, auth.userId, null) : Promise.resolve(null),
    guestToken ? findObservationEventParticipant(env, session.sessionId, null, guestToken) : Promise.resolve(null)
  ]);
  const participant = [userParticipant, guestParticipant]
    .filter((candidate): candidate is ObservationEventParticipantD1Row => candidate !== null)
    .find(isObservationEventParticipatingGroup) ?? null;
  return {
    userId: auth?.userId ?? null,
    guestToken,
    participantUserId: participant?.user_id ?? null,
    participantGuestToken: participant?.guest_token ?? null,
    teamId: participant?.team_id ?? null,
    isOrganizer: Boolean(auth?.userId && auth.userId === session.organizerUserId),
    isActiveParticipant: participant?.status === "checked_in",
    isCheckedInParticipant: Boolean(participant)
  };
}

export type PublicObservationEventLiveEvent = {
  type: string;
  label: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

const PUBLIC_OBSERVATION_EVENT_LIVE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  observation_added: "観察が追加されました",
  field_scan_added: "フィールド観察が追加されました",
  guide_scene_added: "ガイド観察が追加されました",
  absence_recorded: "見つからなかった記録が追加されました",
  announce: "主催者からのお知らせ",
  mode_switch: "観察モードが変わりました",
  team_update: "観察グループの案内が更新されました",
  checkin: "チェックインがありました",
  participant_location_ping: "参加状況が更新されました",
  quest_offered: "追加の観察ヒント",
  quest_accepted: "観察ヒントに挑戦します",
  quest_declined: "観察ヒントを見送りました",
  quest_completed: "観察ヒントを達成しました",
  rally_station_opened: "観察地点が開きました",
  rally_mission_published: "観察ミッションが始まりました",
  rally_mission_paused: "観察ミッションを一時停止しました",
  rally_mission_replaced: "観察ミッションが更新されました",
  rally_mission_extended: "観察ミッションの時間が延長されました",
  rally_mission_closed: "観察ミッションが終了しました",
  rally_next_action: "次の観察案内があります",
  rally_task_submitted: "観察ミッションの記録が届きました",
  rally_task_cleared: "観察ミッションの確認が終わりました",
  rare_species: "注目のいきものが見つかりました",
  target_hit: "探していたいきものが見つかりました",
  milestone: "観察の節目に到達しました",
  fanfare: "観察会に新しい発見がありました"
});

function publicObservationEventLiveText(value: unknown, maxLength = 240): string | null {
  const normalized = normalizeOptionalText(value);
  return normalized ? normalized.slice(0, maxLength) : null;
}

export function publicObservationEventLiveEvent(
  event: Awaited<ReturnType<typeof listObservationEventLiveEvents>>[number]
): PublicObservationEventLiveEvent | null {
  const label = PUBLIC_OBSERVATION_EVENT_LIVE_LABELS[event.type];
  if (!label) return null;
  const payload: Record<string, unknown> = {};
  const taxonName = observationEventTaxonName(event.payload);
  if (["observation_added", "field_scan_added", "guide_scene_added", "rare_species", "target_hit", "milestone", "fanfare"].includes(event.type)) {
    payload.taxonName = taxonName ?? "未同定";
  }
  if (event.type === "absence_recorded") {
    payload.searchedTaxon = publicObservationEventLiveText(event.payload.searched_taxon) ?? "未指定";
    payload.confidence = publicObservationEventLiveText(event.payload.confidence, 40) ?? "searched";
  }
  if (event.type === "announce") {
    payload.message = publicObservationEventLiveText(event.payload.message, 500) ?? "お知らせがあります。";
  }
  if (["quest_offered", "quest_accepted", "quest_declined", "quest_completed", "rare_species", "target_hit", "milestone", "fanfare"].includes(event.type)) {
    const headline = publicObservationEventLiveText(event.payload.headline, 160);
    if (headline) payload.headline = headline;
  }
  if (event.type === "quest_offered") {
    const prompt = publicObservationEventLiveText(event.payload.prompt, 300);
    if (prompt) payload.prompt = prompt;
  }
  if (event.type === "mode_switch") {
    payload.primaryMode = publicObservationEventLiveText(event.payload.primary_mode, 40) ?? "discovery";
    payload.activeModes = stringArray(event.payload.active_modes).slice(0, OBSERVATION_EVENT_MODES.length);
  }
  if (event.type === "team_update") {
    const updateKind = publicObservationEventLiveText(event.payload.kind, 40);
    const declaredJob = publicObservationEventLiveText(event.payload.declared_job, 80);
    if (updateKind) payload.updateKind = updateKind;
    if (declaredJob) payload.declaredJob = declaredJob;
    const targetTaxa = stringArray(asPlainObject(event.payload.team)?.target_taxa).slice(0, 12);
    if (targetTaxa.length > 0) payload.targetTaxa = targetTaxa;
  }
  if (event.type === "rally_station_opened") {
    const name = publicObservationEventLiveText(event.payload.name, 120);
    if (name) payload.name = name;
  }
  if (["rally_mission_published", "rally_mission_paused", "rally_mission_replaced", "rally_mission_extended", "rally_mission_closed"].includes(event.type)) {
    const status = publicObservationEventLiveText(event.payload.status, 40);
    if (status) payload.status = status;
  }
  if (event.type === "rally_next_action") {
    const mode = publicObservationEventLiveText(event.payload.mode, 40);
    if (mode) payload.mode = mode;
  }
  if (["rally_task_submitted", "rally_task_cleared"].includes(event.type)) {
    const reviewStatus = publicObservationEventLiveText(event.payload.review_status, 40);
    if (reviewStatus) payload.reviewStatus = reviewStatus;
  }
  return {
    type: event.type,
    label,
    payload,
    createdAt: event.createdAt
  };
}

export function publicObservationEventLiveSession(
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>
) {
  const startsAt = Date.parse(session.startedAt);
  const endsAt = session.endedAt ? Date.parse(session.endedAt) : Number.NaN;
  const now = Date.now();
  const status = Number.isFinite(endsAt) && endsAt <= now
    ? "ended"
    : Number.isFinite(startsAt) && startsAt > now
      ? "scheduled"
      : "live";
  return {
    title: session.title,
    primaryMode: session.primaryMode,
    activeModes: session.activeModes,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    status
  };
}

export function summarizePublicObservationEventLive(events: PublicObservationEventLiveEvent[]) {
  const observations = events.filter((event) => ["observation_added", "field_scan_added", "guide_scene_added"].includes(event.type));
  return {
    eventCount: events.length,
    observationCount: observations.length
  };
}

export function observationEventLiveParticipantDetail(event: PublicObservationEventLiveEvent): string | null {
  const candidates = [
    event.payload.message,
    event.payload.headline,
    event.payload.prompt,
    event.payload.taxonName,
    event.payload.searchedTaxon,
    event.payload.name,
    event.payload.primaryMode,
    event.payload.status,
    event.payload.reviewStatus,
    event.payload.declaredJob
  ];
  for (const candidate of candidates) {
    const value = publicObservationEventLiveText(candidate, 500);
    if (value) return value;
  }
  const targetTaxa = stringArray(event.payload.targetTaxa);
  return targetTaxa.length > 0 ? targetTaxa.join("・") : null;
}

export function shouldDeliverObservationEvent(
  event: { scope: string; teamId: string | null; payload: Record<string, unknown> },
  ctx: { userId: string | null; guestToken: string | null; teamId: string | null; isOrganizer: boolean; isCheckedInParticipant: boolean }
): boolean {
  if (ctx.isOrganizer) return true;
  if (!ctx.isCheckedInParticipant) return false;
  if (event.scope === "all") return true;
  if (event.scope === "team") return Boolean(ctx.teamId && ctx.teamId === event.teamId);
  if (event.scope === "self") {
    const targetUser = normalizeOptionalText(event.payload.target_user_id);
    const targetGuest = normalizeOptionalText(event.payload.target_guest_token);
    return Boolean((targetUser && targetUser === ctx.userId) || (targetGuest && targetGuest === ctx.guestToken));
  }
  return false;
}

export async function recordObservationEventMeshVisit(env: Env, input: { sessionId: string; lat: number; lng: number; absenceDelta?: number; observationDelta?: number; visitSeconds?: number; teamId?: string | null }): Promise<void> {
  const meshKey = observationEventMeshKey(input.lat, input.lng);
  if (!meshKey) return;
  const center = observationEventMeshCenter(meshKey);
  if (!center) return;
  const meshId = crypto.randomUUID();
  await env.OBS_DB.prepare(
    `INSERT INTO observation_event_mesh_cells (
       mesh_cell_id, session_id, mesh_key, center_lat, center_lng, visit_seconds,
       observation_count, absence_count, last_visited_at, visited_team_ids_json, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(session_id, mesh_key) DO UPDATE SET
       visit_seconds = visit_seconds + excluded.visit_seconds,
       observation_count = observation_count + excluded.observation_count,
       absence_count = absence_count + excluded.absence_count,
       last_visited_at = CURRENT_TIMESTAMP,
       updated_at = CURRENT_TIMESTAMP`
  ).bind(meshId, input.sessionId, meshKey, center.lat, center.lng, Math.max(0, Math.round(input.visitSeconds ?? 0)), Math.max(0, Math.round(input.observationDelta ?? 0)), Math.max(0, Math.round(input.absenceDelta ?? 0)), JSON.stringify(input.teamId ? [input.teamId] : [])).run();
}

function isObservationEventMode(value: unknown): value is ObservationEventMode {
  return typeof value === "string" && (OBSERVATION_EVENT_MODES as readonly string[]).includes(value);
}

export function observationEventMode(value: unknown): ObservationEventMode | null {
  return isObservationEventMode(value) ? value : null;
}

export function observationEventModes(value: unknown, fallback: ObservationEventMode): ObservationEventMode[] {
  const modes = Array.isArray(value) ? value.filter(isObservationEventMode) : [];
  return modes.length > 0 ? modes : [fallback];
}

function observationEventMeshKey(lat: number, lng: number): string {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return "";
  const rounded = (v: number): string => {
    const sign = v < 0 ? "-" : "";
    const abs = Math.abs(v);
    return `${sign}${Math.floor(abs * 1000) / 1000}`;
  };
  return `${rounded(lat)},${rounded(lng)}`;
}

function observationEventMeshCenter(meshKey: string): { lat: number; lng: number } | null {
  const [latRaw, lngRaw] = meshKey.split(",");
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat: lat + 0.0005, lng: lng + 0.0005 };
}

type NativeObservationEventQuestTrigger =
  | "interval"
  | "new_species"
  | "target_hit"
  | "stuck"
  | "rare_alert"
  | "ending_soon"
  | "manual";

const OBSERVATION_EVENT_QUEST_TRIGGERS = new Set<NativeObservationEventQuestTrigger>([
  "interval",
  "new_species",
  "target_hit",
  "stuck",
  "rare_alert",
  "ending_soon",
  "manual"
]);

function normalizeObservationEventQuestTrigger(value: unknown): NativeObservationEventQuestTrigger {
  return typeof value === "string" && OBSERVATION_EVENT_QUEST_TRIGGERS.has(value as NativeObservationEventQuestTrigger)
    ? value as NativeObservationEventQuestTrigger
    : "manual";
}

export async function runObservationEventQuest(request: Request, env: Env, sessionId: string): Promise<Response> {
  const organizer = await requireObservationEventOrganizer(request, env, sessionId);
  if (organizer instanceof Response) return organizer;
  const body = await readJson<Record<string, unknown>>(request);
  const trigger = normalizeObservationEventQuestTrigger(body.trigger);
  const result = await generateNativeObservationEventQuests(env, organizer.session, {
    trigger,
    skipRecentDedup: true
  });
  return json(result, 200, { "cache-control": "no-store" });
}

export async function decideObservationEventQuest(request: Request, env: Env, sessionId: string, questId: string): Promise<Response> {
  const sameOriginError = assertSameOriginRequest(request, true);
  if (sameOriginError) return sameOriginError;
  const session = await getObservationEventSessionById(env, sessionId);
  if (!session) return json({ error: "quest not found" }, 404, { "cache-control": "no-store" });
  const { auth, guestToken } = await observationEventRequestActor(request, env, sessionId);
  if (auth?.banned) return json({ error: "event participant required" }, 403, { "cache-control": "no-store" });
  const isOrganizer = Boolean(auth?.userId && auth.userId === session.organizerUserId);
  const participant = await findObservationEventParticipant(env, sessionId, auth?.userId ?? null, guestToken);
  if (!isOrganizer && participant?.status !== "checked_in") return json({ error: "event participant required" }, 403, { "cache-control": "no-store" });
  const body = await readJson<Record<string, unknown>>(request);
  const decisionRaw = normalizeOptionalText(body.decision);
  const decision = decisionRaw === "accepted" || decisionRaw === "declined" || decisionRaw === "completed"
    ? decisionRaw
    : null;
  if (!decision) return json({ error: "invalid decision" }, 400, { "cache-control": "no-store" });
  const row = await env.OBS_DB.prepare(
    "SELECT quest_id, session_id, team_id, participant_id, status, payload_json FROM observation_event_quests WHERE quest_id = ? AND session_id = ?"
  ).bind(questId, sessionId).first<{ quest_id: string; session_id: string; team_id: string | null; participant_id: string | null; status: string; payload_json: string }>();
  if (!row) return json({ error: "quest not found" }, 404, { "cache-control": "no-store" });
  if (!isOrganizer && (
    (row.team_id && row.team_id !== participant?.team_id)
    || (row.participant_id && row.participant_id !== participant?.participant_id)
  )) return json({ error: "quest not found" }, 404, { "cache-control": "no-store" });
  if (!isObservationEventActivityOpen(session)) return json({ error: "event_quest_closed" }, 409, { "cache-control": "no-store" });
  if (row.status === decision) return json({ ok: true, replayed: true }, 200, { "cache-control": "no-store" });
  const payload: Record<string, unknown> = {
    ...jsonObject(row.payload_json),
    decision,
    decided_by: auth?.userId ?? null,
    decided_at: new Date().toISOString()
  };
  await env.OBS_DB.prepare(
    "UPDATE observation_event_quests SET status = ?, payload_json = ?, updated_at = CURRENT_TIMESTAMP WHERE quest_id = ? AND session_id = ?"
  ).bind(decision, JSON.stringify(payload), questId, sessionId).run();
  const eventType = decision === "accepted"
    ? "quest_accepted"
    : decision === "declined"
      ? "quest_declined"
      : "quest_completed";
  await appendObservationEventLive(env, {
    sessionId,
    type: eventType,
    scope: row.participant_id ? "organizer" : row.team_id ? "team" : "all",
    teamId: row.team_id,
    actorUserId: auth?.userId ?? null,
    payload: {
      quest_id: questId,
      kind: typeof payload.kind === "string" ? payload.kind : "effort",
      headline: typeof payload.headline === "string" ? payload.headline : ""
    }
  });
  return json({ ok: true }, 200, { "cache-control": "no-store" });
}

export async function generateNativeObservationEventQuests(
  env: Env,
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>,
  options: { trigger: NativeObservationEventQuestTrigger; skipRecentDedup?: boolean }
): Promise<{ quests: number; modelUsed: string | null; trigger: NativeObservationEventQuestTrigger }> {
  if (!isObservationEventCheckinOpen(session)) return { quests: 0, modelUsed: null, trigger: options.trigger };
  if (!options.skipRecentDedup) {
    const recent = await env.OBS_DB.prepare(
      `SELECT COUNT(*) AS recent
         FROM observation_event_quests
        WHERE session_id = ?
          AND status = 'offered'
          AND created_at > datetime('now', '-90 seconds')
          AND json_extract(payload_json, '$.trigger') = ?`
    ).bind(session.sessionId, options.trigger).first<{ recent: number }>();
    if (Number(recent?.recent ?? 0) > 0) {
      return { quests: 0, modelUsed: null, trigger: options.trigger };
    }
  }
  const teams = await listObservationEventTeams(env, session.sessionId).catch(() => []);
  const candidates = buildNativeObservationEventQuestCandidates(session, teams, options.trigger).slice(0, 3);
  let inserted = 0;
  for (const candidate of candidates) {
    const questId = crypto.randomUUID();
    const payload = {
      kind: candidate.kind,
      headline: candidate.headline,
      prompt: candidate.prompt,
      rationale: candidate.rationale,
      team_name: candidate.teamName,
      trigger: options.trigger,
      generated_by: "cloudflare-d1-static-quest",
      expires_in_minutes: candidate.expiresInMinutes
    };
    await env.OBS_DB.prepare(
      `INSERT INTO observation_event_quests
         (quest_id, session_id, team_id, status, payload_json)
       VALUES (?, ?, ?, 'offered', ?)`
    ).bind(questId, session.sessionId, candidate.teamId, JSON.stringify(payload)).run();
    await appendObservationEventLive(env, {
      sessionId: session.sessionId,
      type: "quest_offered",
      scope: candidate.teamId ? "team" : "all",
      teamId: candidate.teamId,
      payload: { quest_id: questId, ...payload }
    });
    inserted += 1;
  }
  return { quests: inserted, modelUsed: "cloudflare-d1-static-quest", trigger: options.trigger };
}

function buildNativeObservationEventQuestCandidates(
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>,
  teams: ObservationEventTeamD1Row[],
  trigger: NativeObservationEventQuestTrigger
): Array<{ teamId: string | null; teamName: string; kind: string; headline: string; prompt: string; rationale: string; expiresInMinutes: number }> {
  const out: Array<{ teamId: string | null; teamName: string; kind: string; headline: string; prompt: string; rationale: string; expiresInMinutes: number }> = [];
  const firstTarget = session.targetSpecies[0] ?? null;
  if (firstTarget) {
    out.push({
      teamId: null,
      teamName: "all",
      kind: "taxa",
      headline: `${firstTarget}の手がかり`,
      prompt: `${firstTarget}がいそうな日なた・日陰・水辺・草地を一つ選んで、数分だけ見てみる。`,
      rationale: "観察会の目標種に近い環境を追加で見ると、種リストと探した範囲の両方が残ります。",
      expiresInMinutes: trigger === "ending_soon" ? 8 : 15
    });
  }
  const firstTeam = teams[0] ?? null;
  if (firstTeam) {
    const targetTaxa = jsonArray(firstTeam.target_taxa_json).filter((value): value is string => typeof value === "string");
    out.push({
      teamId: firstTeam.team_id,
      teamName: firstTeam.name,
      kind: targetTaxa[0] ? "taxa" : "effort",
      headline: targetTaxa[0] ? `${firstTeam.name}: ${targetTaxa[0]}` : `${firstTeam.name}: もう一地点`,
      prompt: targetTaxa[0]
        ? `${firstTeam.name}は${targetTaxa[0]}の手がかりを一つ追加で探す。見つからなくても、探した場所を残す。`
        : `${firstTeam.name}はまだ見ていない方向へ短く移動して、同じ条件で一地点だけ追加する。`,
      rationale: "班ごとの小さな追加行動は、偏りを減らし、主催者が後で状況を整理しやすくします。",
      expiresInMinutes: 12
    });
  }
  out.push({
    teamId: null,
    teamName: "all",
    kind: "absence",
    headline: trigger === "ending_soon" ? "最後に未確認を残す" : "見つからなかった条件",
    prompt: "対象を一つ決めて5分だけ探し、見つからなければ条件と場所を短く残す。",
    rationale: "条件つきの未確認は、次回の観察範囲や季節差を考える材料になります。",
    expiresInMinutes: trigger === "ending_soon" ? 6 : 12
  });
  return out;
}

async function observationEventGuestCookieName(sessionId: string): Promise<string> {
  return guestCookieName(sessionId);
}

export async function readObservationEventGuestCredential(cookieHeader: string | null, sessionId: string): Promise<string | null> {
  return readGuestCredential(cookieHeader, sessionId);
}

export async function observationEventGuestCredentialDigest(credential: string): Promise<string> {
  return credentialDigest(credential);
}

export async function buildObservationEventGuestCookie(
  session: NonNullable<Awaited<ReturnType<typeof getObservationEventSessionById>>>,
  token: string
): Promise<string> {
  const cookieName = await observationEventGuestCookieName(session.sessionId);
  const endedAt = session.endedAt ? Date.parse(session.endedAt) : Number.NaN;
  const expiresAt = new Date(Math.max(
    Date.now() + 60 * 60 * 1000,
    (Number.isFinite(endedAt) ? endedAt : Date.now()) + 30 * 24 * 60 * 60 * 1000
  ));
  return `${cookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Secure; Expires=${expiresAt.toUTCString()}`;
}

export async function buildClearedObservationEventGuestCookie(sessionId: string): Promise<string> {
  const cookieName = await observationEventGuestCookieName(sessionId);
  return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}
