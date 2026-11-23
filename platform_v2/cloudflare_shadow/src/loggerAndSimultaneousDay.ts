import type { Env } from "./core/env";

export const PLACE_LOGGER_RECORDS_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS place_logger_records (
  record_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  station_id TEXT NOT NULL DEFAULT '',
  device_kind TEXT NOT NULL,
  observed_date TEXT NOT NULL,
  summary_text TEXT NOT NULL DEFAULT '',
  water_temp_c REAL,
  media_url TEXT NOT NULL DEFAULT '',
  is_rare_species INTEGER NOT NULL DEFAULT 0,
  face_blurred INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
`.trim();

export const SIMULTANEOUS_DAY_ENTRIES_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS simultaneous_day_entries (
  entry_id TEXT PRIMARY KEY,
  day_key TEXT NOT NULL,
  place_id TEXT NOT NULL,
  place_label TEXT NOT NULL,
  coarse_cell TEXT NOT NULL,
  answer_1 TEXT NOT NULL,
  answer_2 TEXT NOT NULL,
  answer_3 TEXT NOT NULL,
  is_rare_species INTEGER NOT NULL DEFAULT 0,
  created_by_user_id TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
`.trim();

export type PlaceLoggerRecordRow = {
  record_id: string;
  place_id: string;
  station_id: string;
  device_kind: "audio_logger" | "camera_trap" | "water_temp";
  observed_date: string;
  summary_text: string;
  water_temp_c: number | null;
  media_url: string;
  is_rare_species: number;
  face_blurred: number;
  created_by_user_id: string;
  created_at: number;
};

export type SimultaneousDayEntryRow = {
  entry_id: string;
  day_key: string;
  place_id: string;
  place_label: string;
  coarse_cell: string;
  answer_1: string;
  answer_2: string;
  answer_3: string;
  is_rare_species: number;
  created_by_user_id: string;
  created_at: number;
};

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function ingestPlaceLoggerRecords(
  env: Env,
  input: {
    placeId: string;
    stationId?: string;
    createdByUserId: string;
    records: Array<{
      deviceKind?: unknown;
      observedDate?: unknown;
      summaryText?: unknown;
      waterTempC?: unknown;
      mediaUrl?: unknown;
      isRareSpecies?: unknown;
    }>;
  }
): Promise<PlaceLoggerRecordRow[]> {
  await env.CORE_DB.prepare(PLACE_LOGGER_RECORDS_CREATE_SQL).run();
  const saved: PlaceLoggerRecordRow[] = [];
  for (const item of input.records.slice(0, 100)) {
    const deviceKind =
      item.deviceKind === "camera_trap" || item.deviceKind === "water_temp"
        ? item.deviceKind
        : "audio_logger";
    const observedDate = typeof item.observedDate === "string" ? item.observedDate.trim().slice(0, 10) : "";
    if (!observedDate) continue;
    const isRare = item.isRareSpecies === true ? 1 : 0;
    const rawMediaUrl = typeof item.mediaUrl === "string" ? item.mediaUrl.trim().slice(0, 400) : "";
    const safeMediaUrl = /^\/(?:media|derived|assets)\//u.test(rawMediaUrl) ? rawMediaUrl : "";
    const row: PlaceLoggerRecordRow = {
      record_id: `logr_${crypto.randomUUID().slice(0, 12)}`,
      place_id: isRare ? "" : input.placeId,
      station_id: isRare ? "" : (input.stationId ?? "").trim().slice(0, 80),
      device_kind: deviceKind,
      observed_date: observedDate,
      summary_text: typeof item.summaryText === "string" ? item.summaryText.trim().slice(0, 200) : "",
      water_temp_c: typeof item.waterTempC === "number" && Number.isFinite(item.waterTempC) ? item.waterTempC : null,
      media_url: safeMediaUrl,
      is_rare_species: isRare,
      face_blurred: deviceKind === "camera_trap" && safeMediaUrl ? 1 : 0,
      created_by_user_id: input.createdByUserId,
      created_at: Date.now()
    };
    await env.CORE_DB.prepare(
      `INSERT INTO place_logger_records (
        record_id, place_id, station_id, device_kind, observed_date, summary_text, water_temp_c,
        media_url, is_rare_species, face_blurred, created_by_user_id, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)`
    ).bind(
      row.record_id,
      row.place_id,
      row.station_id,
      row.device_kind,
      row.observed_date,
      row.summary_text,
      row.water_temp_c,
      row.media_url,
      row.is_rare_species,
      row.face_blurred,
      row.created_by_user_id,
      row.created_at
    ).run();
    saved.push(row);
  }
  return saved;
}

export async function listPlaceLoggerRecords(env: Env, placeId: string): Promise<PlaceLoggerRecordRow[]> {
  await env.CORE_DB.prepare(PLACE_LOGGER_RECORDS_CREATE_SQL).run();
  const res = await env.CORE_DB.prepare(
    "SELECT * FROM place_logger_records WHERE place_id = ?1 ORDER BY observed_date DESC LIMIT 100"
  ).bind(placeId).all<PlaceLoggerRecordRow>();
  return res.results ?? [];
}

export async function recordSimultaneousDayEntry(
  env: Env,
  input: {
    dayKey: string;
    placeId: string;
    placeLabel: string;
    coarseCell: string;
    answer1: string;
    answer2: string;
    answer3: string;
    isRareSpecies: boolean;
    createdByUserId: string;
  }
): Promise<SimultaneousDayEntryRow> {
  await env.CORE_DB.prepare(SIMULTANEOUS_DAY_ENTRIES_CREATE_SQL).run();
  const isRare = input.isRareSpecies ? 1 : 0;
  const row: SimultaneousDayEntryRow = {
    entry_id: `sde_${crypto.randomUUID().slice(0, 12)}`,
    day_key: input.dayKey.slice(0, 32),
    place_id: isRare ? "" : input.placeId.slice(0, 120),
    place_label: isRare ? "広域（希少種保護のため位置非公開）" : input.placeLabel.trim().slice(0, 120) || "登録地点",
    coarse_cell: isRare ? "hidden" : input.coarseCell.slice(0, 40),
    answer_1: input.answer1.trim().slice(0, 120),
    answer_2: input.answer2.trim().slice(0, 120),
    answer_3: input.answer3.trim().slice(0, 120),
    is_rare_species: isRare,
    created_by_user_id: input.createdByUserId,
    created_at: Date.now()
  };
  await env.CORE_DB.prepare(
    `INSERT INTO simultaneous_day_entries (
      entry_id, day_key, place_id, place_label, coarse_cell, answer_1, answer_2, answer_3,
      is_rare_species, created_by_user_id, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`
  ).bind(
    row.entry_id,
    row.day_key,
    row.place_id,
    row.place_label,
    row.coarse_cell,
    row.answer_1,
    row.answer_2,
    row.answer_3,
    row.is_rare_species,
    row.created_by_user_id,
    row.created_at
  ).run();
  return row;
}

export async function loadSimultaneousDayNationalMap(
  env: Env,
  dayKey: string
): Promise<SimultaneousDayEntryRow[]> {
  await env.CORE_DB.prepare(SIMULTANEOUS_DAY_ENTRIES_CREATE_SQL).run();
  const res = await env.CORE_DB.prepare(
    "SELECT * FROM simultaneous_day_entries WHERE day_key = ?1 ORDER BY created_at DESC LIMIT 500"
  ).bind(dayKey).all<SimultaneousDayEntryRow>();
  return res.results ?? [];
}

export function renderSimultaneousDayMapHtml(
  dayKey: string,
  entries: SimultaneousDayEntryRow[],
  cspNonce?: string
): string {
  const nonceAttr = cspNonce ? ` nonce="${escapeHtml(cspNonce)}"` : "";
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>全国一斉の日 ${escapeHtml(dayKey)} | ZUKAN</title>
  <style${nonceAttr}>
    body{margin:0;font-family:"Noto Sans JP",system-ui,sans-serif;background:#fff;color:#17251b;padding:20px}
    .sd-wrap{max-width:960px;margin:0 auto;display:grid;gap:16px}
    .sd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px}
    .sd-card{padding:14px;border-radius:10px;background:#f6f7f6;display:grid;gap:6px}
  </style>
</head>
<body>
  <main class="sd-wrap" data-simultaneous-day-map="${escapeHtml(dayKey)}">
    <h1>全国一斉の日（${escapeHtml(dayKey)}）· 参加地点 ${entries.length}件</h1>
    <div class="sd-grid">
      ${entries.map((e) => `<article class="sd-card">
        <strong>${escapeHtml(e.place_label)}</strong>
        <div>水の色: ${escapeHtml(e.answer_1 || "—")}</div>
        <div>花の数: ${escapeHtml(e.answer_2 || "—")}</div>
        <div>鳥の声: ${escapeHtml(e.answer_3 || "—")}</div>
      </article>`).join("")}
    </div>
  </main>
</body>
</html>`;
}
