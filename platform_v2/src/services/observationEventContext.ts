import { getPool } from "../db.js";

/**
 * 観察会の AI Quest 推論に渡す「現場 context」を組み立てるサービス。
 *
 * 入力レイヤー:
 *   - 観察会セッション位置(lat/lng)
 *   - 気象庁 forecast API (無料・無認証)
 *   - GSI 標高 API (無料・無認証)
 *   - 過去観察データ(observations / observation_event_live_events)
 *   - メッシュカバレッジ (observation_event_mesh_cells)
 *   - 班・参加者・残り時間
 *
 * Sentinel-2 NDVI / OSM は将来 enrich で。
 * すべて TTL キャッシュ+ graceful degradation。
 */

// ---------------------------------------------------------------------------
// 軽量メモリキャッシュ
// ---------------------------------------------------------------------------
interface CacheEntry<T> { value: T; expiresAt: number }
const memoryCache = new Map<string, CacheEntry<unknown>>();

function getCache<T>(key: string): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function setCache<T>(key: string, value: T, ttlMs: number): void {
  memoryCache.set(key, { value, expiresAt: Date.now() + ttlMs });
  if (memoryCache.size > 2_000) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) memoryCache.delete(firstKey);
  }
}

// ---------------------------------------------------------------------------
// 気象庁 (オフィスコードによる地域別 forecast)
// ---------------------------------------------------------------------------
interface JmaWeatherSnapshot {
  weather: string;
  windDir: string;
  temp: { min: number | null; max: number | null };
  precipitation: string;
  source: "jma" | "fallback";
}

const PREFECTURE_OFFICES: Array<{ code: string; latMin: number; latMax: number; lngMin: number; lngMax: number; name: string }> = [
  // ざっくり代表的な気象庁オフィスコード(国内主要地域カバー)
  { code: "011000", latMin: 41.3, latMax: 45.5, lngMin: 139.5, lngMax: 145.7, name: "札幌" },
  { code: "040000", latMin: 37.5, latMax: 41.6, lngMin: 139.0, lngMax: 142.1, name: "仙台" },
  { code: "130000", latMin: 35.0, latMax: 36.4, lngMin: 138.7, lngMax: 140.2, name: "東京" },
  { code: "140000", latMin: 35.0, latMax: 35.7, lngMin: 138.9, lngMax: 139.8, name: "横浜" },
  { code: "230000", latMin: 34.5, latMax: 35.4, lngMin: 136.5, lngMax: 137.8, name: "名古屋" },
  { code: "270000", latMin: 33.6, latMax: 35.5, lngMin: 134.2, lngMax: 136.0, name: "大阪" },
  { code: "340000", latMin: 33.8, latMax: 35.0, lngMin: 132.0, lngMax: 134.0, name: "広島" },
  { code: "390000", latMin: 32.8, latMax: 34.5, lngMin: 132.5, lngMax: 134.7, name: "高知" },
  { code: "400000", latMin: 33.0, latMax: 34.4, lngMin: 130.0, lngMax: 132.0, name: "福岡" },
  { code: "471000", latMin: 24.0, latMax: 27.0, lngMin: 122.5, lngMax: 131.4, name: "那覇" },
];

function pickPrefectureOfficeCode(lat: number, lng: number): string {
  for (const office of PREFECTURE_OFFICES) {
    if (lat >= office.latMin && lat <= office.latMax && lng >= office.lngMin && lng <= office.lngMax) {
      return office.code;
    }
  }
  return "130000";
}

interface JmaForecastBlock {
  timeSeries?: Array<{
    timeDefines?: string[];
    areas?: Array<{
      area?: { name?: string };
      weathers?: string[];
      winds?: string[];
      tempsMin?: string[];
      tempsMax?: string[];
      pops?: string[];
    }>;
  }>;
}

export async function fetchWeatherSnapshot(lat: number, lng: number): Promise<JmaWeatherSnapshot> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { weather: "晴れ", windDir: "北東", temp: { min: null, max: null }, precipitation: "0%", source: "fallback" };
  }
  const key = `weather:${pickPrefectureOfficeCode(lat, lng)}`;
  const cached = getCache<JmaWeatherSnapshot>(key);
  if (cached) return cached;

  const code = pickPrefectureOfficeCode(lat, lng);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4_000);
  try {
    const resp = await fetch(`https://www.jma.go.jp/bosai/forecast/data/forecast/${code}.json`, {
      signal: controller.signal,
      headers: { "User-Agent": "ikimon-platform-v2/observation-event-context" },
    });
    if (!resp.ok) throw new Error(`jma_${resp.status}`);
    const data = (await resp.json()) as JmaForecastBlock[];
    const today = data?.[0]?.timeSeries?.[0]?.areas?.[0];
    const tempBlock = data?.[1]?.timeSeries?.[1]?.areas?.[0];
    const popBlock = data?.[0]?.timeSeries?.[1]?.areas?.[0];
    const snapshot: JmaWeatherSnapshot = {
      weather: today?.weathers?.[0]?.replace(/\s+/g, "") ?? "情報なし",
      windDir: today?.winds?.[0] ?? "情報なし",
      temp: {
        min: tempBlock?.tempsMin?.[0] ? Number(tempBlock.tempsMin[0]) : null,
        max: tempBlock?.tempsMax?.[0] ? Number(tempBlock.tempsMax[0]) : null,
      },
      precipitation: popBlock?.pops?.[0] ? `${popBlock.pops[0]}%` : "情報なし",
      source: "jma",
    };
    setCache(key, snapshot, 5 * 60 * 1000);
    return snapshot;
  } catch {
    const snapshot: JmaWeatherSnapshot = {
      weather: "情報なし",
      windDir: "情報なし",
      temp: { min: null, max: null },
      precipitation: "情報なし",
      source: "fallback",
    };
    setCache(key, snapshot, 60 * 1000);
    return snapshot;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// GSI 標高(国土地理院 公開 API)
// ---------------------------------------------------------------------------
export async function fetchElevation(lat: number, lng: number): Promise<number | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const key = `elev:${Math.round(lat * 1000) / 1000}:${Math.round(lng * 1000) / 1000}`;
  const cached = getCache<number | null>(key);
  if (cached !== null) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try {
    const resp = await fetch(
      `https://cyberjapandata2.gsi.go.jp/general/dem/scripts/getelevation.php?lon=${lng}&lat=${lat}&outtype=JSON`,
      { signal: controller.signal },
    );
    if (!resp.ok) throw new Error(`gsi_${resp.status}`);
    const data = (await resp.json()) as { elevation?: number | null };
    const elev = typeof data.elevation === "number" && Number.isFinite(data.elevation) ? data.elevation : null;
    setCache(key, elev, 7 * 24 * 60 * 60 * 1000);
    return elev;
  } catch {
    setCache(key, null, 5 * 60 * 1000);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// シーズン推定(LLM への補助 hint)
// ---------------------------------------------------------------------------
export function inferSeasonLabel(lat: number, isoDate: string): string {
  const month = new Date(isoDate).getUTCMonth() + 1;
  const south = lat < 30; // 沖縄ライン
  if (south) {
    if (month >= 12 || month <= 2) return "亜熱帯・乾季";
    if (month <= 5) return "亜熱帯・春";
    if (month <= 9) return "亜熱帯・雨季";
    return "亜熱帯・秋";
  }
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}

// ---------------------------------------------------------------------------
// セッション現状サマリ(過去観察・メッシュ・班 effort)
// ---------------------------------------------------------------------------
export interface SessionContextSummary {
  sessionId: string;
  startedAt: string;
  primaryMode: string;
  remainingMinutes: number | null;
  totalParticipants: number;
  checkedInParticipants: number;
  observationsCount: number;
  uniqueSpeciesCount: number;
  absencesCount: number;
  recentObservationTaxa: string[];
  remainingTargetSpecies: string[];
  meshCoverage: { visitedCells: number; emptyCellsHint: number; sampleEmptyCenters: Array<{ lat: number; lng: number }> };
  teams: Array<{
    teamId: string;
    name: string;
    color: string;
    centroidLat: number | null;
    centroidLng: number | null;
    memberCount: number;
    observationsCount: number;
    targetTaxa: string[];
  }>;
}

export async function buildSessionContext(sessionId: string): Promise<SessionContextSummary | null> {
  const pool = getPool();
  const sessionResult = await pool.query<{
    session_id: string;
    started_at: string;
    ended_at: string | null;
    primary_mode: string;
    target_species: string[];
    config: Record<string, unknown> | null;
  }>(
    `SELECT session_id, started_at::text AS started_at, ended_at::text AS ended_at,
            primary_mode, target_species, config
     FROM observation_event_sessions
     WHERE session_id = $1`,
    [sessionId],
  );
  const session = sessionResult.rows[0];
  if (!session) return null;

  const startedAtMs = Date.parse(session.started_at);
  const endsAtMs = session.ended_at ? Date.parse(session.ended_at) : (Number.isFinite(startedAtMs) ? startedAtMs + 3 * 60 * 60 * 1000 : null);
  const remainingMinutes = endsAtMs ? Math.max(0, Math.round((endsAtMs - Date.now()) / 60000)) : null;

  const [participantsRow, observationsRow, recentTaxaResult, absencesRow, teamsResult, meshAggResult] = await Promise.all([
    pool.query<{ total: string; checked_in: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE status = 'checked_in')::text AS checked_in
       FROM observation_event_participants
       WHERE session_id = $1`,
      [sessionId],
    ),
    pool.query<{ obs_count: string; species_count: string }>(
      `WITH live AS (
         SELECT payload FROM observation_event_live_events
         WHERE session_id = $1 AND type = 'observation_added'
       )
       SELECT COUNT(*)::text AS obs_count,
              COUNT(DISTINCT (payload->>'taxon_name'))::text AS species_count
       FROM live
       WHERE payload->>'taxon_name' IS NOT NULL`,
      [sessionId],
    ),
    pool.query<{ taxon_name: string }>(
      `SELECT DISTINCT payload->>'taxon_name' AS taxon_name
       FROM observation_event_live_events
       WHERE session_id = $1
         AND type = 'observation_added'
         AND payload->>'taxon_name' IS NOT NULL
       ORDER BY taxon_name
       LIMIT 30`,
      [sessionId],
    ),
    pool.query<{ absence_count: string }>(
      `SELECT COUNT(*)::text AS absence_count
       FROM observation_event_absences
       WHERE session_id = $1`,
      [sessionId],
    ),
    pool.query<{
      team_id: string;
      name: string;
      color: string;
      centroid_lat: string | null;
      centroid_lng: string | null;
      target_taxa: string[];
      member_count: string;
      observations_count: string;
    }>(
      `SELECT t.team_id, t.name, t.color,
              t.centroid_lat::text AS centroid_lat,
              t.centroid_lng::text AS centroid_lng,
              t.target_taxa,
              COALESCE((SELECT COUNT(*)::text FROM observation_event_participants p WHERE p.team_id = t.team_id), '0') AS member_count,
              COALESCE((
                SELECT COUNT(*)::text FROM observation_event_live_events e
                WHERE e.session_id = t.session_id AND e.team_id = t.team_id AND e.type = 'observation_added'
              ), '0') AS observations_count
       FROM observation_event_teams t
       WHERE t.session_id = $1
       ORDER BY t.created_at`,
      [sessionId],
    ),
    pool.query<{
      visited_cells: string;
      sample_centers: Array<{ lat: number; lng: number }>;
    }>(
      `WITH agg AS (
         SELECT center_lat, center_lng, observation_count, absence_count
         FROM observation_event_mesh_cells
         WHERE session_id = $1
       )
       SELECT COUNT(*)::text AS visited_cells,
              COALESCE(json_agg(json_build_object('lat', center_lat, 'lng', center_lng))
                FILTER (WHERE observation_count = 0 AND absence_count = 0), '[]'::json) AS sample_centers
       FROM agg`,
      [sessionId],
    ),
  ]);

  const participants = participantsRow.rows[0];
  const obsRow = observationsRow.rows[0];
  const absenceRow = absencesRow.rows[0];
  const meshAgg = meshAggResult.rows[0];

  const recentTaxa = recentTaxaResult.rows.map((r) => r.taxon_name).filter(Boolean);
  const remainingTargets = (session.target_species ?? []).filter((target) => !recentTaxa.includes(target));

  const sampleEmptyCenters = Array.isArray(meshAgg?.sample_centers)
    ? meshAgg.sample_centers.slice(0, 3)
    : [];

  const teams = teamsResult.rows.map((row) => ({
    teamId: row.team_id,
    name: row.name,
    color: row.color,
    centroidLat: row.centroid_lat ? Number(row.centroid_lat) : null,
    centroidLng: row.centroid_lng ? Number(row.centroid_lng) : null,
    memberCount: Number(row.member_count),
    observationsCount: Number(row.observations_count),
    targetTaxa: row.target_taxa ?? [],
  }));

  return {
    sessionId,
    startedAt: session.started_at,
    primaryMode: session.primary_mode,
    remainingMinutes,
    totalParticipants: Number(participants?.total ?? 0),
    checkedInParticipants: Number(participants?.checked_in ?? 0),
    observationsCount: Number(obsRow?.obs_count ?? 0),
    uniqueSpeciesCount: Number(obsRow?.species_count ?? 0),
    absencesCount: Number(absenceRow?.absence_count ?? 0),
    recentObservationTaxa: recentTaxa,
    remainingTargetSpecies: remainingTargets,
    meshCoverage: {
      visitedCells: Number(meshAgg?.visited_cells ?? 0),
      emptyCellsHint: sampleEmptyCenters.length,
      sampleEmptyCenters,
    },
    teams,
  };
}

// ---------------------------------------------------------------------------
// すべて統合した「LLM プロンプト用 context」(200 トークン以内目標)
// ---------------------------------------------------------------------------
export interface QuestPromptContext {
  sessionId: string;
  primaryMode: string;
  seasonLabel: string;
  weather: JmaWeatherSnapshot;
  elevationMeters: number | null;
  remainingMinutes: number | null;
  observations: { count: number; species: number; recentTaxa: string[] };
  remainingTargets: string[];
  absencesCount: number;
  meshHint: { visited: number; sampleEmpty: Array<{ lat: number; lng: number }> };
  teams: Array<{
    teamId: string;
    name: string;
    color: string;
    members: number;
    observationsCount: number;
    centroidLat: number | null;
    centroidLng: number | null;
    targetTaxa: string[];
  }>;
}

export async function buildQuestPromptContext(
  sessionId: string,
  fallbackLat: number | null,
  fallbackLng: number | null,
): Promise<QuestPromptContext | null> {
  const summary = await buildSessionContext(sessionId);
  if (!summary) return null;

  const lat = summary.teams.find((t) => t.centroidLat !== null)?.centroidLat ?? fallbackLat ?? null;
  const lng = summary.teams.find((t) => t.centroidLng !== null)?.centroidLng ?? fallbackLng ?? null;
  const seasonLabel = lat !== null ? inferSeasonLabel(lat, summary.startedAt) : "情報なし";

  const [weather, elevation] = await Promise.all([
    lat !== null && lng !== null ? fetchWeatherSnapshot(lat, lng) : Promise.resolve<JmaWeatherSnapshot>({
      weather: "情報なし", windDir: "情報なし", temp: { min: null, max: null }, precipitation: "情報なし", source: "fallback",
    }),
    lat !== null && lng !== null ? fetchElevation(lat, lng) : Promise.resolve(null),
  ]);

  return {
    sessionId,
    primaryMode: summary.primaryMode,
    seasonLabel,
    weather,
    elevationMeters: elevation,
    remainingMinutes: summary.remainingMinutes,
    observations: {
      count: summary.observationsCount,
      species: summary.uniqueSpeciesCount,
      recentTaxa: summary.recentObservationTaxa.slice(0, 12),
    },
    remainingTargets: summary.remainingTargetSpecies.slice(0, 12),
    absencesCount: summary.absencesCount,
    meshHint: {
      visited: summary.meshCoverage.visitedCells,
      sampleEmpty: summary.meshCoverage.sampleEmptyCenters,
    },
    teams: summary.teams.map((t) => ({
      teamId: t.teamId,
      name: t.name,
      color: t.color,
      members: t.memberCount,
      observationsCount: t.observationsCount,
      centroidLat: t.centroidLat,
      centroidLng: t.centroidLng,
      targetTaxa: t.targetTaxa,
    })),
  };
}

/**
 * Quest プロンプト埋め込み用に context を 1 文字列に圧縮。
 * 200 トークン以内が目標(日本語で 600~700 文字想定)。
 */
export function summarizeContextForPrompt(ctx: QuestPromptContext): string {
  const lines: string[] = [];
  lines.push(`mode=${ctx.primaryMode} season=${ctx.seasonLabel} remain=${ctx.remainingMinutes ?? "?"}min`);
  lines.push(
    `weather=${ctx.weather.weather}/${ctx.weather.windDir}/min${ctx.weather.temp.min ?? "?"}max${ctx.weather.temp.max ?? "?"}/pop${ctx.weather.precipitation}`,
  );
  lines.push(`elev=${ctx.elevationMeters ?? "?"}m`);
  lines.push(`obs=${ctx.observations.count} species=${ctx.observations.species} absences=${ctx.absencesCount}`);
  if (ctx.observations.recentTaxa.length > 0) {
    lines.push(`recent_taxa=${ctx.observations.recentTaxa.slice(0, 8).join(",")}`);
  }
  if (ctx.remainingTargets.length > 0) {
    lines.push(`remaining_targets=${ctx.remainingTargets.join(",")}`);
  }
  if (ctx.meshHint.sampleEmpty.length > 0) {
    const emptyStr = ctx.meshHint.sampleEmpty
      .map((p) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`)
      .join(";");
    lines.push(`empty_mesh=${emptyStr}`);
  }
  if (ctx.teams.length > 0) {
    const teamStr = ctx.teams
      .map((t) => `${t.name}(m${t.members}/o${t.observationsCount})`)
      .join("|");
    lines.push(`teams=${teamStr}`);
  }
  return lines.join("\n");
}
