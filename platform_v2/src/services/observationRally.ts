import { getPool } from "../db.js";
import { appendLiveEvent } from "./observationEventLive.js";
import type { ObservationEventSessionRow } from "./observationEventModeManager.js";

export const RALLY_SCOPES = ["event", "team", "participant", "station"] as const;
export type RallyScope = typeof RALLY_SCOPES[number];

export const RALLY_LOCATION_BINDINGS = [
  "none",
  "station_required",
  "within_area",
  "near_route",
  "any_registered_station",
] as const;
export type RallyLocationBinding = typeof RALLY_LOCATION_BINDINGS[number];

export const RALLY_COUNT_UNITS = [
  "scene",
  "individual",
  "location",
  "comparison_pair",
  "station_clear",
  "team_completion",
] as const;
export type RallyCountUnit = typeof RALLY_COUNT_UNITS[number];

export const RALLY_VERIFICATION_POLICIES = ["auto", "organizer_review", "ai_assisted", "qr"] as const;
export type RallyVerificationPolicy = typeof RALLY_VERIFICATION_POLICIES[number];

export const RALLY_WEATHER_SENSITIVITIES = [
  "all_weather",
  "rain_ok",
  "dry_only",
  "sunny_only",
  "wind_sensitive",
  "temperature_sensitive",
] as const;
export type RallyWeatherSensitivity = typeof RALLY_WEATHER_SENSITIVITIES[number];

export const RALLY_MISSION_STATUSES = ["draft", "published", "paused", "replaced", "closed"] as const;
export type RallyMissionStatus = typeof RALLY_MISSION_STATUSES[number];

export const RALLY_REVISION_ACTIONS = ["publish", "pause", "replace", "extend", "close", "create", "station_create"] as const;
export type RallyRevisionAction = typeof RALLY_REVISION_ACTIONS[number];

export const RALLY_WEATHER_MODES = ["rain"] as const;
export type RallyWeatherMode = typeof RALLY_WEATHER_MODES[number];

export interface RallyCourse {
  courseId: string;
  sessionId: string;
  title: string;
  status: "draft" | "preflight" | "live" | "closed";
  config: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RallyStation {
  stationId: string;
  courseId: string;
  fieldId: string | null;
  code: string;
  name: string;
  description: string;
  lat: number | null;
  lng: number | null;
  radiusM: number | null;
  polygon: Record<string, unknown> | null;
  routeGeojson: Record<string, unknown> | null;
  isPrivate: boolean;
  accessNote: string;
  dangerNote: string;
  status: "open" | "paused" | "closed";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RallyMission {
  missionId: string;
  courseId: string;
  stationId: string | null;
  replacementForMissionId: string | null;
  scope: RallyScope;
  locationBinding: RallyLocationBinding;
  title: string;
  target: string;
  countUnit: RallyCountUnit;
  goalCount: number;
  countingPolicy: Record<string, unknown>;
  verificationPolicy: RallyVerificationPolicy;
  weatherSensitivity: RallyWeatherSensitivity;
  fallbackGroup: string;
  status: RallyMissionStatus;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RallyProgress {
  progressId: string;
  courseId: string;
  missionId: string;
  progressScope: RallyScope;
  teamId: string | null;
  participantKey: string | null;
  stationId: string | null;
  actualCount: number;
  goalCount: number;
  percent: number;
  status: "active" | "reached" | "exceeded" | "closed";
  updatedAt: string;
}

export interface RallySubmission {
  submissionId: string;
  sessionId: string;
  courseId: string;
  missionId: string;
  stationId: string | null;
  userId: string | null;
  guestToken: string | null;
  teamId: string | null;
  sourceType: string;
  sourceRef: string | null;
  countValue: number;
  lat: number | null;
  lng: number | null;
  payload: Record<string, unknown>;
  reviewStatus: "pending" | "auto_accepted" | "accepted" | "rejected";
  createdAt: string;
}

export interface RallySnapshot {
  course: RallyCourse | null;
  stations: RallyStation[];
  missions: RallyMission[];
  progress: RallyProgress[];
}

type RawCourse = {
  course_id: string;
  session_id: string;
  title: string;
  status: string;
  config: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type RawStation = {
  station_id: string;
  course_id: string;
  field_id: string | null;
  code: string;
  name: string;
  description: string;
  lat: string | number | null;
  lng: string | number | null;
  radius_m: number | null;
  polygon: Record<string, unknown> | null;
  route_geojson: Record<string, unknown> | null;
  is_private: boolean;
  access_note: string;
  danger_note: string;
  status: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type RawMission = {
  mission_id: string;
  course_id: string;
  station_id: string | null;
  replacement_for_mission_id: string | null;
  scope: string;
  location_binding: string;
  title: string;
  target: string;
  count_unit: string;
  goal_count: string | number;
  counting_policy: Record<string, unknown> | null;
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
};

type RawProgress = {
  progress_id: string;
  course_id: string;
  mission_id: string;
  progress_scope: string;
  team_id: string | null;
  participant_key: string | null;
  station_id: string | null;
  actual_count: string | number;
  goal_count: string | number;
  percent: string | number;
  status: string;
  updated_at: string;
};

type RawSubmission = {
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
  count_value: string | number;
  lat: string | number | null;
  lng: string | number | null;
  payload: Record<string, unknown> | null;
  review_status: string;
  created_at: string;
};

function oneOf<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T[number] : fallback;
}

function numberOrNull(value: string | number | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapCourse(row: RawCourse): RallyCourse {
  return {
    courseId: row.course_id,
    sessionId: row.session_id,
    title: row.title,
    status: oneOf(row.status, ["draft", "preflight", "live", "closed"] as const, "draft"),
    config: row.config ?? {},
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStation(row: RawStation): RallyStation {
  return {
    stationId: row.station_id,
    courseId: row.course_id,
    fieldId: row.field_id,
    code: row.code,
    name: row.name,
    description: row.description,
    lat: numberOrNull(row.lat),
    lng: numberOrNull(row.lng),
    radiusM: row.radius_m,
    polygon: row.polygon,
    routeGeojson: row.route_geojson,
    isPrivate: row.is_private,
    accessNote: row.access_note,
    dangerNote: row.danger_note,
    status: oneOf(row.status, ["open", "paused", "closed"] as const, "open"),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMission(row: RawMission): RallyMission {
  return {
    missionId: row.mission_id,
    courseId: row.course_id,
    stationId: row.station_id,
    replacementForMissionId: row.replacement_for_mission_id,
    scope: oneOf(row.scope, RALLY_SCOPES, "event"),
    locationBinding: oneOf(row.location_binding, RALLY_LOCATION_BINDINGS, "none"),
    title: row.title,
    target: row.target,
    countUnit: oneOf(row.count_unit, RALLY_COUNT_UNITS, "scene"),
    goalCount: Number(row.goal_count),
    countingPolicy: row.counting_policy ?? {},
    verificationPolicy: oneOf(row.verification_policy, RALLY_VERIFICATION_POLICIES, "auto"),
    weatherSensitivity: oneOf(row.weather_sensitivity, RALLY_WEATHER_SENSITIVITIES, "all_weather"),
    fallbackGroup: row.fallback_group,
    status: oneOf(row.status, RALLY_MISSION_STATUSES, "draft"),
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapProgress(row: RawProgress): RallyProgress {
  return {
    progressId: row.progress_id,
    courseId: row.course_id,
    missionId: row.mission_id,
    progressScope: oneOf(row.progress_scope, RALLY_SCOPES, "event"),
    teamId: row.team_id,
    participantKey: row.participant_key,
    stationId: row.station_id,
    actualCount: Number(row.actual_count),
    goalCount: Number(row.goal_count),
    percent: Number(row.percent),
    status: oneOf(row.status, ["active", "reached", "exceeded", "closed"] as const, "active"),
    updatedAt: row.updated_at,
  };
}

function mapSubmission(row: RawSubmission): RallySubmission {
  return {
    submissionId: row.submission_id,
    sessionId: row.session_id,
    courseId: row.course_id,
    missionId: row.mission_id,
    stationId: row.station_id,
    userId: row.user_id,
    guestToken: row.guest_token,
    teamId: row.team_id,
    sourceType: row.source_type,
    sourceRef: row.source_ref,
    countValue: Number(row.count_value),
    lat: numberOrNull(row.lat),
    lng: numberOrNull(row.lng),
    payload: row.payload ?? {},
    reviewStatus: oneOf(row.review_status, ["pending", "auto_accepted", "accepted", "rejected"] as const, "pending"),
    createdAt: row.created_at,
  };
}

export function calculateProgressPercent(actualCount: number, goalCount: number): number {
  if (!Number.isFinite(actualCount) || !Number.isFinite(goalCount) || goalCount <= 0) return 0;
  return Math.round((actualCount / goalCount) * 10000) / 100;
}

export function progressStatus(percent: number): RallyProgress["status"] {
  if (percent > 100) return "exceeded";
  if (percent >= 100) return "reached";
  return "active";
}

export function defaultCountingPolicy(countUnit: RallyCountUnit): Record<string, unknown> {
  switch (countUnit) {
    case "individual":
      return {
        one_count: "主対象として分かる1個体",
        multi_subject_photo: "初期は1カウント。分割確認後のみ複数カウント。",
        duplicate_hint: "近接位置、撮影時刻、同じ班、見た目特徴で重複候補を出す。",
      };
    case "location":
      return {
        one_count: "重複しない1地点",
        duplicate_hint: "近接地点の連写は重複候補にする。",
      };
    case "comparison_pair":
      return {
        one_count: "比較対象が2つ揃った1組",
        note: "比較コメントは必須にしない。",
      };
    case "station_clear":
      return { one_count: "指定地点のクリア条件達成" };
    case "team_completion":
      return { one_count: "1班が条件を満たす" };
    case "scene":
    default:
      return {
        one_count: "対象が分かる1シーン",
        multi_subject_photo: "1枚に複数対象が写っても1カウント。",
      };
  }
}

export function resolveLocationShareConsent(input: {
  wantsShare: boolean;
  isMinor: boolean;
  consentType?: string | null;
  guardianConsent?: boolean;
}): "self" | "guardian" | "organizer" | null {
  if (!input.wantsShare) return null;
  if (input.isMinor) {
    return input.guardianConsent || input.consentType === "guardian" ? "guardian" : null;
  }
  if (input.consentType === "organizer") return "organizer";
  return "self";
}

export function locationShareUntil(session: Pick<ObservationEventSessionRow, "startedAt" | "endedAt">): Date | null {
  const startedAtMs = Date.parse(session.startedAt);
  if (!Number.isFinite(startedAtMs)) return null;
  if (session.endedAt) {
    const endedAtMs = Date.parse(session.endedAt);
    return Number.isFinite(endedAtMs) ? new Date(endedAtMs) : null;
  }
  return new Date(startedAtMs + 4 * 60 * 60 * 1000);
}

export function isLocationShareOpen(
  session: Pick<ObservationEventSessionRow, "startedAt" | "endedAt">,
  now = new Date(),
): boolean {
  const startedAtMs = Date.parse(session.startedAt);
  const until = locationShareUntil(session);
  if (!Number.isFinite(startedAtMs) || !until) return false;
  const nowMs = now.getTime();
  return nowMs >= startedAtMs && nowMs <= until.getTime();
}

export function shouldReplaceMissionForWeatherMode(
  mission: Pick<RallyMission, "fallbackGroup" | "status" | "weatherSensitivity">,
  mode: RallyWeatherMode,
): boolean {
  if (mode !== "rain") return false;
  return mission.fallbackGroup.length > 0 &&
    mission.status === "published" &&
    (mission.weatherSensitivity === "sunny_only" || mission.weatherSensitivity === "dry_only");
}

export function shouldPublishMissionForWeatherMode(
  mission: Pick<RallyMission, "fallbackGroup" | "status" | "weatherSensitivity">,
  mode: RallyWeatherMode,
  activeFallbackGroups: Set<string>,
): boolean {
  if (mode !== "rain") return false;
  return mission.fallbackGroup.length > 0 &&
    activeFallbackGroups.has(mission.fallbackGroup) &&
    (mission.status === "draft" || mission.status === "paused") &&
    (mission.weatherSensitivity === "rain_ok" || mission.weatherSensitivity === "all_weather");
}

export function planRallyWeatherModeSwitch(
  missions: Array<Pick<RallyMission, "missionId" | "fallbackGroup" | "status" | "weatherSensitivity">>,
  mode: RallyWeatherMode,
): { replaceMissionIds: string[]; publishMissionIds: string[]; fallbackGroups: string[] } {
  const replaceTargets = missions.filter((mission) =>
    shouldReplaceMissionForWeatherMode(mission, mode),
  );
  const activeFallbackGroups = new Set(replaceTargets.map((mission) => mission.fallbackGroup));
  const publishTargets = missions.filter((mission) =>
    shouldPublishMissionForWeatherMode(mission, mode, activeFallbackGroups),
  );
  return {
    replaceMissionIds: replaceTargets.map((mission) => mission.missionId),
    publishMissionIds: publishTargets.map((mission) => mission.missionId),
    fallbackGroups: Array.from(activeFallbackGroups),
  };
}

export async function getRallySnapshot(sessionId: string): Promise<RallySnapshot> {
  const pool = getPool();
  const courseResult = await pool.query<RawCourse>(
    `SELECT course_id, session_id, title, status, config, created_by,
            created_at::text AS created_at, updated_at::text AS updated_at
     FROM observation_rally_courses
     WHERE session_id = $1`,
    [sessionId],
  );
  const courseRow = courseResult.rows[0];
  if (!courseRow) return { course: null, stations: [], missions: [], progress: [] };
  const course = mapCourse(courseRow);
  const [stationsResult, missionsResult, progressResult] = await Promise.all([
    pool.query<RawStation>(
      `SELECT station_id, course_id, field_id, code, name, description,
              lat::text AS lat, lng::text AS lng, radius_m, polygon, route_geojson,
              is_private, access_note, danger_note, status, sort_order,
              created_at::text AS created_at, updated_at::text AS updated_at
       FROM observation_rally_stations
       WHERE course_id = $1
       ORDER BY sort_order, created_at`,
      [course.courseId],
    ),
    pool.query<RawMission>(
      `SELECT mission_id, course_id, station_id, replacement_for_mission_id,
              scope, location_binding, title, target, count_unit, goal_count::text AS goal_count,
              counting_policy, verification_policy, weather_sensitivity, fallback_group,
              status, starts_at::text AS starts_at, ends_at::text AS ends_at,
              sort_order, created_by,
              created_at::text AS created_at, updated_at::text AS updated_at
       FROM observation_rally_missions
       WHERE course_id = $1
       ORDER BY status = 'published' DESC, sort_order, created_at`,
      [course.courseId],
    ),
    pool.query<RawProgress>(
      `SELECT progress_id, course_id, mission_id, progress_scope, team_id, participant_key,
              station_id, actual_count::text AS actual_count, goal_count::text AS goal_count,
              percent::text AS percent, status, updated_at::text AS updated_at
       FROM observation_rally_progress
       WHERE course_id = $1
       ORDER BY updated_at DESC`,
      [course.courseId],
    ),
  ]);
  return {
    course,
    stations: stationsResult.rows.map(mapStation),
    missions: missionsResult.rows.map(mapMission),
    progress: progressResult.rows.map(mapProgress),
  };
}

export async function ensureRallyCourse(input: {
  sessionId: string;
  title?: string | null;
  status?: RallyCourse["status"];
  config?: Record<string, unknown>;
  actorUserId?: string | null;
}): Promise<RallyCourse> {
  const result = await getPool().query<RawCourse>(
    `INSERT INTO observation_rally_courses (session_id, title, status, config, created_by)
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (session_id) DO UPDATE SET
       title = COALESCE(NULLIF(EXCLUDED.title, ''), observation_rally_courses.title),
       status = EXCLUDED.status,
       config = observation_rally_courses.config || EXCLUDED.config,
       updated_at = NOW()
     RETURNING course_id, session_id, title, status, config, created_by,
               created_at::text AS created_at, updated_at::text AS updated_at`,
    [
      input.sessionId,
      input.title ?? "観察ラリー",
      input.status ?? "preflight",
      JSON.stringify(input.config ?? {}),
      input.actorUserId ?? null,
    ],
  );
  const row = result.rows[0];
  if (!row) throw new Error("failed_to_ensure_rally_course");
  return mapCourse(row);
}

export async function createRallyStation(input: {
  sessionId: string;
  actorUserId: string | null;
  station: {
    fieldId?: string | null;
    code?: string | null;
    name: string;
    description?: string | null;
    lat?: number | null;
    lng?: number | null;
    radiusM?: number | null;
    polygon?: Record<string, unknown> | null;
    routeGeojson?: Record<string, unknown> | null;
    isPrivate?: boolean;
    accessNote?: string | null;
    dangerNote?: string | null;
    sortOrder?: number;
  };
}): Promise<RallyStation> {
  const course = await ensureRallyCourse({ sessionId: input.sessionId, actorUserId: input.actorUserId });
  const result = await getPool().query<RawStation>(
    `INSERT INTO observation_rally_stations (
       course_id, field_id, code, name, description, lat, lng, radius_m,
       polygon, route_geojson, is_private, access_note, danger_note, sort_order
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13, $14)
     RETURNING station_id, course_id, field_id, code, name, description,
               lat::text AS lat, lng::text AS lng, radius_m, polygon, route_geojson,
               is_private, access_note, danger_note, status, sort_order,
               created_at::text AS created_at, updated_at::text AS updated_at`,
    [
      course.courseId,
      input.station.fieldId ?? null,
      input.station.code ?? "",
      input.station.name,
      input.station.description ?? "",
      input.station.lat ?? null,
      input.station.lng ?? null,
      input.station.radiusM ?? null,
      JSON.stringify(input.station.polygon ?? null),
      JSON.stringify(input.station.routeGeojson ?? null),
      input.station.isPrivate ?? false,
      input.station.accessNote ?? "",
      input.station.dangerNote ?? "",
      input.station.sortOrder ?? 0,
    ],
  );
  const station = mapStation(result.rows[0]!);
  await recordRallyRevision({
    courseId: course.courseId,
    action: "station_create",
    actorUserId: input.actorUserId,
    afterPayload: station as unknown as Record<string, unknown>,
  });
  await appendLiveEvent({
    sessionId: input.sessionId,
    type: "rally_station_opened",
    scope: "all",
    actorUserId: input.actorUserId,
    payload: { station },
  });
  return station;
}

export async function createRallyMission(input: {
  sessionId: string;
  actorUserId: string | null;
  mission: {
    stationId?: string | null;
    replacementForMissionId?: string | null;
    scope?: string | null;
    locationBinding?: string | null;
    title: string;
    target: string;
    countUnit?: string | null;
    goalCount: number;
    countingPolicy?: Record<string, unknown> | null;
    verificationPolicy?: string | null;
    weatherSensitivity?: string | null;
    fallbackGroup?: string | null;
    status?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
    sortOrder?: number;
  };
}): Promise<RallyMission> {
  const course = await ensureRallyCourse({ sessionId: input.sessionId, actorUserId: input.actorUserId });
  const countUnit = oneOf(input.mission.countUnit, RALLY_COUNT_UNITS, "scene");
  const locationBinding = oneOf(input.mission.locationBinding, RALLY_LOCATION_BINDINGS, "none");
  if (locationBinding === "station_required" && !input.mission.stationId) {
    throw new Error("station_required_mission_needs_station_id");
  }
  const status = oneOf(input.mission.status, RALLY_MISSION_STATUSES, "published");
  const countingPolicy = {
    ...defaultCountingPolicy(countUnit),
    ...(input.mission.countingPolicy ?? {}),
  };
  const result = await getPool().query<RawMission>(
    `INSERT INTO observation_rally_missions (
       course_id, station_id, replacement_for_mission_id,
       scope, location_binding, title, target, count_unit, goal_count,
       counting_policy, verification_policy, weather_sensitivity, fallback_group,
       status, starts_at, ends_at, sort_order, created_by
     ) VALUES (
       $1, $2, $3,
       $4, $5, $6, $7, $8, $9,
       $10::jsonb, $11, $12, $13,
       $14, $15, $16, $17, $18
     )
     RETURNING mission_id, course_id, station_id, replacement_for_mission_id,
               scope, location_binding, title, target, count_unit, goal_count::text AS goal_count,
               counting_policy, verification_policy, weather_sensitivity, fallback_group,
               status, starts_at::text AS starts_at, ends_at::text AS ends_at,
               sort_order, created_by,
               created_at::text AS created_at, updated_at::text AS updated_at`,
    [
      course.courseId,
      input.mission.stationId ?? null,
      input.mission.replacementForMissionId ?? null,
      oneOf(input.mission.scope, RALLY_SCOPES, input.mission.stationId ? "station" : "event"),
      locationBinding,
      input.mission.title,
      input.mission.target,
      countUnit,
      Math.max(1, Number(input.mission.goalCount) || 1),
      JSON.stringify(countingPolicy),
      oneOf(input.mission.verificationPolicy, RALLY_VERIFICATION_POLICIES, "auto"),
      oneOf(input.mission.weatherSensitivity, RALLY_WEATHER_SENSITIVITIES, "all_weather"),
      input.mission.fallbackGroup ?? "",
      status,
      input.mission.startsAt ?? null,
      input.mission.endsAt ?? null,
      input.mission.sortOrder ?? 0,
      input.actorUserId,
    ],
  );
  const mission = mapMission(result.rows[0]!);
  await recordRallyRevision({
    courseId: course.courseId,
    missionId: mission.missionId,
    action: "create",
    actorUserId: input.actorUserId,
    afterPayload: mission as unknown as Record<string, unknown>,
  });
  await refreshMissionProgress(input.sessionId, mission.missionId, { emit: false });
  if (mission.status === "published") {
    await appendLiveEvent({
      sessionId: input.sessionId,
      type: "rally_mission_published",
      scope: "all",
      actorUserId: input.actorUserId,
      payload: { mission },
    });
  }
  return mission;
}

export async function changeRallyMission(input: {
  sessionId: string;
  missionId: string;
  action: RallyRevisionAction;
  actorUserId: string | null;
  reason?: string | null;
  goalCount?: number | null;
  endsAt?: string | null;
}): Promise<RallyMission> {
  const before = await getMissionForSession(input.sessionId, input.missionId);
  if (!before) throw new Error("mission_not_found");
  let nextStatus: RallyMissionStatus = before.status;
  if (input.action === "publish") nextStatus = "published";
  if (input.action === "pause") nextStatus = "paused";
  if (input.action === "replace") nextStatus = "replaced";
  if (input.action === "close") nextStatus = "closed";
  const result = await getPool().query<RawMission>(
    `UPDATE observation_rally_missions
     SET status = $2,
         goal_count = COALESCE($3, goal_count),
         ends_at = COALESCE($4, ends_at),
         updated_at = NOW()
     WHERE mission_id = $1
     RETURNING mission_id, course_id, station_id, replacement_for_mission_id,
               scope, location_binding, title, target, count_unit, goal_count::text AS goal_count,
               counting_policy, verification_policy, weather_sensitivity, fallback_group,
               status, starts_at::text AS starts_at, ends_at::text AS ends_at,
               sort_order, created_by,
               created_at::text AS created_at, updated_at::text AS updated_at`,
    [
      input.missionId,
      input.action === "extend" ? before.status : nextStatus,
      input.goalCount && input.goalCount > 0 ? input.goalCount : null,
      input.endsAt ?? null,
    ],
  );
  const mission = mapMission(result.rows[0]!);
  await recordRallyRevision({
    courseId: mission.courseId,
    missionId: mission.missionId,
    action: input.action,
    reason: input.reason ?? "",
    actorUserId: input.actorUserId,
    beforePayload: before as unknown as Record<string, unknown>,
    afterPayload: mission as unknown as Record<string, unknown>,
  });
  await refreshMissionProgress(input.sessionId, mission.missionId, { emit: true });
  const type =
    input.action === "publish" ? "rally_mission_published" :
    input.action === "pause" ? "rally_mission_paused" :
    input.action === "replace" ? "rally_mission_replaced" :
    input.action === "extend" ? "rally_mission_extended" :
    input.action === "close" ? "rally_mission_closed" :
    "rally_mission_published";
  await appendLiveEvent({
    sessionId: input.sessionId,
    type,
    scope: "all",
    actorUserId: input.actorUserId,
    payload: { mission, reason: input.reason ?? "" },
  });
  return mission;
}

export async function switchRallyWeatherMode(input: {
  sessionId: string;
  actorUserId: string | null;
  mode: RallyWeatherMode;
  reason?: string | null;
}): Promise<{ mode: RallyWeatherMode; replaced: RallyMission[]; published: RallyMission[] }> {
  const snapshot = await getRallySnapshot(input.sessionId);
  const course = snapshot.course;
  if (!course) throw new Error("rally_course_not_found");
  const plan = planRallyWeatherModeSwitch(snapshot.missions, input.mode);
  const replaceTargetIds = new Set(plan.replaceMissionIds);
  const publishTargetIds = new Set(plan.publishMissionIds);
  const replaceTargets = snapshot.missions.filter((mission) => replaceTargetIds.has(mission.missionId));
  const publishTargets = snapshot.missions.filter((mission) => publishTargetIds.has(mission.missionId));
  const reason = input.reason ?? "雨天モードへの一括切替";
  const replaced: RallyMission[] = [];
  const published: RallyMission[] = [];
  for (const mission of replaceTargets) {
    replaced.push(await changeRallyMission({
      sessionId: input.sessionId,
      missionId: mission.missionId,
      action: "replace",
      actorUserId: input.actorUserId,
      reason,
    }));
  }
  for (const mission of publishTargets) {
    published.push(await changeRallyMission({
      sessionId: input.sessionId,
      missionId: mission.missionId,
      action: "publish",
      actorUserId: input.actorUserId,
      reason,
    }));
  }
  await appendLiveEvent({
    sessionId: input.sessionId,
    type: "rally_next_action",
    scope: "all",
    actorUserId: input.actorUserId,
    payload: {
      mode: input.mode,
      reason,
      replaced_count: replaced.length,
      published_count: published.length,
      fallback_groups: plan.fallbackGroups,
    },
  });
  return { mode: input.mode, replaced, published };
}

async function getMissionForSession(sessionId: string, missionId: string): Promise<RallyMission | null> {
  const result = await getPool().query<RawMission>(
    `SELECT m.mission_id, m.course_id, m.station_id, m.replacement_for_mission_id,
            m.scope, m.location_binding, m.title, m.target, m.count_unit, m.goal_count::text AS goal_count,
            m.counting_policy, m.verification_policy, m.weather_sensitivity, m.fallback_group,
            m.status, m.starts_at::text AS starts_at, m.ends_at::text AS ends_at,
            m.sort_order, m.created_by,
            m.created_at::text AS created_at, m.updated_at::text AS updated_at
     FROM observation_rally_missions m
     JOIN observation_rally_courses c ON c.course_id = m.course_id
     WHERE c.session_id = $1 AND m.mission_id = $2`,
    [sessionId, missionId],
  );
  return result.rows[0] ? mapMission(result.rows[0]) : null;
}

export async function recordRallySubmission(input: {
  sessionId: string;
  missionId: string;
  userId: string | null;
  guestToken: string | null;
  teamId?: string | null;
  stationId?: string | null;
  sourceType?: string | null;
  sourceRef?: string | null;
  countValue?: number | null;
  lat?: number | null;
  lng?: number | null;
  payload?: Record<string, unknown>;
}): Promise<{ submission: RallySubmission; progress: RallyProgress | null }> {
  if (!input.userId && !input.guestToken) throw new Error("user_or_guest_required");
  const mission = await getMissionForSession(input.sessionId, input.missionId);
  if (!mission) throw new Error("mission_not_found");
  if (mission.status !== "published") throw new Error("mission_not_published");
  const countValue = Math.max(0.01, Number(input.countValue ?? 1) || 1);
  const reviewStatus = mission.verificationPolicy === "auto" || mission.verificationPolicy === "qr"
    ? "auto_accepted"
    : "pending";
  const result = await getPool().query<RawSubmission>(
    `INSERT INTO observation_rally_submissions (
       session_id, course_id, mission_id, station_id, user_id, guest_token, team_id,
       source_type, source_ref, count_value, lat, lng, payload, review_status
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14)
     RETURNING submission_id, session_id, course_id, mission_id, station_id,
               user_id, guest_token, team_id, source_type, source_ref, count_value::text AS count_value,
               lat::text AS lat, lng::text AS lng, payload, review_status, created_at::text AS created_at`,
    [
      input.sessionId,
      mission.courseId,
      mission.missionId,
      input.stationId ?? mission.stationId,
      input.userId,
      input.guestToken,
      input.teamId ?? null,
      input.sourceType ?? "manual_rally",
      input.sourceRef ?? null,
      countValue,
      input.lat ?? null,
      input.lng ?? null,
      JSON.stringify(input.payload ?? {}),
      reviewStatus,
    ],
  );
  const submission = mapSubmission(result.rows[0]!);
  await appendLiveEvent({
    sessionId: input.sessionId,
    type: "rally_task_submitted",
    scope: "all",
    actorUserId: input.userId,
    actorGuestToken: input.guestToken,
    teamId: input.teamId ?? null,
    payload: { submission, mission_id: mission.missionId, title: mission.title },
  });
  const progress = reviewStatus === "auto_accepted"
    ? await refreshMissionProgress(input.sessionId, mission.missionId, { emit: true })
    : await refreshMissionProgress(input.sessionId, mission.missionId, { emit: false });
  return { submission, progress };
}

export async function reviewRallySubmission(input: {
  sessionId: string;
  submissionId: string;
  reviewStatus: "accepted" | "rejected";
  actorUserId: string;
}): Promise<{ submission: RallySubmission; progress: RallyProgress | null }> {
  const result = await getPool().query<RawSubmission>(
    `UPDATE observation_rally_submissions s
     SET review_status = $3,
         reviewed_by = $4,
         reviewed_at = NOW()
     FROM observation_rally_courses c
     WHERE s.course_id = c.course_id
       AND c.session_id = $1
       AND s.submission_id = $2
     RETURNING s.submission_id, s.session_id, s.course_id, s.mission_id, s.station_id,
               s.user_id, s.guest_token, s.team_id, s.source_type, s.source_ref,
               s.count_value::text AS count_value, s.lat::text AS lat, s.lng::text AS lng,
               s.payload, s.review_status, s.created_at::text AS created_at`,
    [input.sessionId, input.submissionId, input.reviewStatus, input.actorUserId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("submission_not_found");
  const submission = mapSubmission(row);
  const progress = await refreshMissionProgress(input.sessionId, submission.missionId, { emit: true });
  if (input.reviewStatus === "accepted") {
    await appendLiveEvent({
      sessionId: input.sessionId,
      type: "rally_task_cleared",
      scope: "all",
      actorUserId: input.actorUserId,
      teamId: submission.teamId,
      payload: { submission_id: submission.submissionId, mission_id: submission.missionId },
    });
  }
  return { submission, progress };
}

export async function refreshMissionProgress(
  sessionId: string,
  missionId: string,
  options: { emit: boolean },
): Promise<RallyProgress | null> {
  const mission = await getMissionForSession(sessionId, missionId);
  if (!mission) return null;
  const pool = getPool();
  const previousResult = await pool.query<RawProgress>(
    `SELECT progress_id, course_id, mission_id, progress_scope, team_id, participant_key,
            station_id, actual_count::text AS actual_count, goal_count::text AS goal_count,
            percent::text AS percent, status, updated_at::text AS updated_at
     FROM observation_rally_progress
     WHERE mission_id = $1 AND progress_scope = 'event'
     LIMIT 1`,
    [missionId],
  );
  const previous = previousResult.rows[0] ? mapProgress(previousResult.rows[0]) : null;
  const sumResult = await pool.query<{ actual_count: string }>(
    `SELECT COALESCE(SUM(count_value), 0)::text AS actual_count
     FROM observation_rally_submissions
     WHERE mission_id = $1
       AND review_status IN ('auto_accepted', 'accepted')`,
    [missionId],
  );
  const actualCount = Number(sumResult.rows[0]?.actual_count ?? 0);
  const percent = calculateProgressPercent(actualCount, mission.goalCount);
  const status = mission.status === "closed" ? "closed" : progressStatus(percent);
  const result = await pool.query<RawProgress>(
    `INSERT INTO observation_rally_progress (
       course_id, mission_id, progress_scope, station_id,
       actual_count, goal_count, percent, status, updated_at
     ) VALUES ($1, $2, 'event', $3, $4, $5, $6, $7, NOW())
     ON CONFLICT (
       mission_id, progress_scope,
       COALESCE(team_id::text, ''),
       COALESCE(participant_key, ''),
       COALESCE(station_id::text, '')
     ) DO UPDATE SET
       actual_count = EXCLUDED.actual_count,
       goal_count = EXCLUDED.goal_count,
       percent = EXCLUDED.percent,
       status = EXCLUDED.status,
       updated_at = NOW()
     RETURNING progress_id, course_id, mission_id, progress_scope, team_id, participant_key,
               station_id, actual_count::text AS actual_count, goal_count::text AS goal_count,
               percent::text AS percent, status, updated_at::text AS updated_at`,
    [mission.courseId, mission.missionId, mission.stationId, actualCount, mission.goalCount, percent, status],
  );
  const progress = mapProgress(result.rows[0]!);
  if (options.emit) {
    await emitProgressEvents(sessionId, mission, previous, progress);
  }
  return progress;
}

async function emitProgressEvents(
  sessionId: string,
  mission: RallyMission,
  previous: RallyProgress | null,
  progress: RallyProgress,
): Promise<void> {
  const previousPercent = previous?.percent ?? 0;
  await appendLiveEvent({
    sessionId,
    type: "rally_progress_updated",
    scope: "all",
    payload: { mission, progress },
  });
  if (previousPercent < 100 && progress.percent >= 100) {
    await appendLiveEvent({
      sessionId,
      type: "rally_goal_reached",
      scope: "all",
      payload: { mission, progress },
    });
  }
  for (const threshold of [120, 150, 200, 300]) {
    if (previousPercent < threshold && progress.percent >= threshold) {
      await appendLiveEvent({
        sessionId,
        type: "rally_goal_exceeded",
        scope: "all",
        payload: { mission, progress, threshold },
      });
    }
  }
}

async function recordRallyRevision(input: {
  courseId: string;
  missionId?: string | null;
  action: RallyRevisionAction;
  reason?: string;
  beforePayload?: Record<string, unknown>;
  afterPayload?: Record<string, unknown>;
  actorUserId?: string | null;
}): Promise<void> {
  await getPool().query(
    `INSERT INTO observation_rally_revisions (
       course_id, mission_id, action, reason, before_payload, after_payload, actor_user_id
     ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7)`,
    [
      input.courseId,
      input.missionId ?? null,
      input.action,
      input.reason ?? "",
      JSON.stringify(input.beforePayload ?? {}),
      JSON.stringify(input.afterPayload ?? {}),
      input.actorUserId ?? null,
    ],
  );
}
