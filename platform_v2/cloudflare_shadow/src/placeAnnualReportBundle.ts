import type { Env } from "./core/env";

export const PLACE_STEWARDSHIP_LOGS_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS place_stewardship_logs (
  log_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  activity_year INTEGER NOT NULL,
  occurred_date TEXT NOT NULL,
  participant_label TEXT NOT NULL,
  session_count INTEGER NOT NULL DEFAULT 1,
  hours REAL NOT NULL DEFAULT 0,
  work_summary TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
`.trim();

export type PlaceAnnualObservationItem = {
  id: string;
  observedDate: string;
  taxonLabel: string;
  note: string;
  photoUrl: string;
};

export type PlaceAnnualStewardshipItem = {
  logId: string;
  occurredDate: string;
  participantLabel: string;
  sessionCount: number;
  hours: number;
  workSummary: string;
};

export type PlaceAnnualArchiveItem = {
  pageId: string;
  observedYear: number;
  observedDate: string;
  placeName: string;
  species: string[];
  sourceImageUrl: string;
};

export type PlaceAnnualReportData = {
  placeId: string;
  placeName: string;
  year: number;
  generatedAt: string;
  observations: PlaceAnnualObservationItem[];
  stewardship: PlaceAnnualStewardshipItem[];
  archives: PlaceAnnualArchiveItem[];
  totals: {
    observationCount: number;
    stewardshipSessions: number;
    stewardshipHours: number;
    archiveCount: number;
  };
};

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function csvCell(value: unknown): string {
  const raw = value == null ? "" : String(value);
  return /[",\n\r]/.test(raw) ? `"${raw.replaceAll('"', '""')}"` : raw;
}

export async function loadPlaceAnnualReportData(
  env: Env,
  placeId: string,
  year: number,
  placeNameFallback = ""
): Promise<PlaceAnnualReportData> {
  let placeName = placeNameFallback || placeId;
  try {
    const placeRow = await env.OBS_DB.prepare(
      "SELECT canonical_name FROM places WHERE place_id = ?1 LIMIT 1"
    ).bind(placeId).first<{ canonical_name?: string }>();
    if (placeRow?.canonical_name) placeName = placeRow.canonical_name;
  } catch {}

  const observations: PlaceAnnualObservationItem[] = [];
  try {
    const fpRows = await env.CORE_DB.prepare(
      `SELECT record_id, observed_at, taxon_name, answer_1, answer_2, answer_3, photo_url
       FROM fixed_point_station_records
       WHERE place_id = ?1 AND substr(observed_at, 1, 4) = ?2
       ORDER BY observed_at DESC LIMIT 200`
    ).bind(placeId, String(year)).all<{
      record_id: string;
      observed_at: string;
      taxon_name: string;
      answer_1: string;
      answer_2: string;
      answer_3: string;
      photo_url: string;
    }>();
    for (const r of fpRows.results ?? []) {
      observations.push({
        id: r.record_id,
        observedDate: String(r.observed_at ?? "").slice(0, 10),
        taxonLabel: r.taxon_name || "定点記録",
        note: [r.answer_1, r.answer_2, r.answer_3].filter(Boolean).join(" / "),
        photoUrl: r.photo_url || ""
      });
    }
  } catch {}

  const stewardship: PlaceAnnualStewardshipItem[] = [];
  try {
    await env.CORE_DB.prepare(PLACE_STEWARDSHIP_LOGS_CREATE_SQL).run();
    const stRows = await env.CORE_DB.prepare(
      `SELECT log_id, occurred_date, participant_label, session_count, hours, work_summary
       FROM place_stewardship_logs
       WHERE place_id = ?1 AND activity_year = ?2
       ORDER BY occurred_date DESC`
    ).bind(placeId, year).all<{
      log_id: string;
      occurred_date: string;
      participant_label: string;
      session_count: number;
      hours: number;
      work_summary: string;
    }>();
    for (const s of stRows.results ?? []) {
      stewardship.push({
        logId: s.log_id,
        occurredDate: s.occurred_date,
        participantLabel: s.participant_label,
        sessionCount: Number(s.session_count ?? 1),
        hours: Number(s.hours ?? 0),
        workSummary: s.work_summary
      });
    }
  } catch {}

  const archives: PlaceAnnualArchiveItem[] = [];
  try {
    const arRows = await env.CORE_DB.prepare(
      `SELECT page_id, observed_year, observed_date, place_name, species_json, source_image_url
       FROM paper_archive_pages
       WHERE place_id = ?1 AND publish_status = 'published'
       ORDER BY observed_year DESC, observed_date DESC LIMIT 100`
    ).bind(placeId).all<{
      page_id: string;
      observed_year: number;
      observed_date: string;
      place_name: string;
      species_json: string;
      source_image_url: string;
    }>();
    for (const a of arRows.results ?? []) {
      let species: string[] = [];
      try { species = JSON.parse(a.species_json) as string[]; } catch { species = []; }
      archives.push({
        pageId: a.page_id,
        observedYear: a.observed_year,
        observedDate: a.observed_date,
        placeName: a.place_name,
        species,
        sourceImageUrl: a.source_image_url
      });
    }
  } catch {}

  return {
    placeId,
    placeName,
    year,
    generatedAt: new Date().toISOString().slice(0, 10),
    observations,
    stewardship,
    archives,
    totals: {
      observationCount: observations.length,
      stewardshipSessions: stewardship.reduce((sum, s) => sum + s.sessionCount, 0),
      stewardshipHours: Math.round(stewardship.reduce((sum, s) => sum + s.hours, 0) * 10) / 10,
      archiveCount: archives.length
    }
  };
}

export function renderPlaceAnnualReportHtml(report: PlaceAnnualReportData): string {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(report.placeName)} ${report.year}年 年報</title>
  <style>
    :root{color-scheme:light;--ink:#17211b;--muted:#4b5a51;--line:#cfd9d2;--accent:#1e6f4c}
    *{box-sizing:border-box}
    body{margin:0;padding:24px 16px 48px;font-family:system-ui,-apple-system,sans-serif;color:var(--ink);background:#fff;line-height:1.6}
    main{max-width:860px;margin:0 auto;display:grid;gap:20px}
    header{border-bottom:2px solid var(--accent);padding-bottom:12px}
    h1{margin:0 0 6px;font-size:1.6rem}
    h2{margin:0 0 10px;font-size:1.15rem;color:var(--accent)}
    .summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:10px}
    .stat{padding:12px;border:1px solid var(--line);border-radius:10px;background:#f7faf7}
    .stat strong{display:block;font-size:1.3rem}
    table{width:100%;border-collapse:collapse;font-size:14px}
    th,td{border:1px solid var(--line);padding:8px 10px;text-align:left;vertical-align:top}
    th{background:#f1f6f3}
    @media print{body{padding:0}.no-print{display:none}}
  </style>
</head>
<body>
  <main data-place-annual-report="${escapeHtml(report.placeId)}">
    <header>
      <h1>${escapeHtml(report.placeName)} — ${report.year}年 年報</h1>
      <p>作成日: ${escapeHtml(report.generatedAt)} / 総会・助成金報告・自然共生サイト活動報告用（単体閲覧可能）</p>
    </header>

    <section class="summary-grid" aria-label="年間まとめ">
      <div class="stat"><span>生きもの・定点記録</span><strong>${report.totals.observationCount}件</strong></div>
      <div class="stat"><span>世話・観察会の開催</span><strong>${report.totals.stewardshipSessions}回</strong></div>
      <div class="stat"><span>延べ活動時間</span><strong>${report.totals.stewardshipHours}時間</strong></div>
      <div class="stat"><span>取り込んだ過去資料</span><strong>${report.totals.archiveCount}件</strong></div>
    </section>

    <section>
      <h2>1. 誰が何回集まり、何時間、何の世話をしたか</h2>
      ${report.stewardship.length > 0 ? `<table><thead><tr><th>日付</th><th>担当者・班</th><th>回数</th><th>時間</th><th>内容</th></tr></thead><tbody>
        ${report.stewardship.map((s) => `<tr><td>${escapeHtml(s.occurredDate)}</td><td>${escapeHtml(s.participantLabel)}</td><td>${s.sessionCount}</td><td>${s.hours}h</td><td>${escapeHtml(s.workSummary)}</td></tr>`).join("")}
      </tbody></table>` : `<p>この年の世話・出欠記録はまだありません。</p>`}
    </section>

    <section>
      <h2>2. 生きもの・定点の記録</h2>
      ${report.observations.length > 0 ? `<table><thead><tr><th>日付</th><th>対象</th><th>メモ</th></tr></thead><tbody>
        ${report.observations.map((o) => `<tr><td>${escapeHtml(o.observedDate)}</td><td>${escapeHtml(o.taxonLabel)}</td><td>${escapeHtml(o.note)}</td></tr>`).join("")}
      </tbody></table>` : `<p>この年の観察記録はまだありません。</p>`}
    </section>

    <section>
      <h2>3. 過去の記録年表（場所×年）</h2>
      ${report.archives.length > 0 ? `<table><thead><tr><th>年・日付</th><th>場所</th><th>生きもの</th></tr></thead><tbody>
        ${report.archives.map((a) => `<tr><td>${a.observedYear}年（${escapeHtml(a.observedDate)}）</td><td>${escapeHtml(a.placeName)}</td><td>${escapeHtml(a.species.join("、"))}</td></tr>`).join("")}
      </tbody></table>` : `<p>取り込んだ過去資料はまだありません。</p>`}
    </section>
  </main>
</body>
</html>`;
}

export function buildPortableTakeawayBundle(report: PlaceAnnualReportData): {
  format: "zukan-portable-bundle/v1";
  placeId: string;
  year: number;
  files: {
    "index.html": string;
    "observations.csv": string;
    "stewardship.csv": string;
    "manifest.json": string;
  };
} {
  const obsLines = [
    ["id", "observed_date", "taxon_label", "note", "photo_url"].map(csvCell).join(","),
    ...report.observations.map((o) => [o.id, o.observedDate, o.taxonLabel, o.note, o.photoUrl].map(csvCell).join(","))
  ];
  const stLines = [
    ["log_id", "occurred_date", "participant_label", "session_count", "hours", "work_summary"].map(csvCell).join(","),
    ...report.stewardship.map((s) => [s.logId, s.occurredDate, s.participantLabel, s.sessionCount, s.hours, s.workSummary].map(csvCell).join(","))
  ];
  const standaloneHtml = renderPlaceAnnualReportHtml(report);
  const manifest = JSON.stringify({
    format: "zukan-portable-bundle/v1",
    placeId: report.placeId,
    placeName: report.placeName,
    year: report.year,
    generatedAt: report.generatedAt,
    totals: report.totals,
    standaloneReadableWithoutIkimon: true
  }, null, 2);

  return {
    format: "zukan-portable-bundle/v1",
    placeId: report.placeId,
    year: report.year,
    files: {
      "index.html": standaloneHtml,
      "observations.csv": `\uFEFF${obsLines.join("\n")}\n`,
      "stewardship.csv": `\uFEFF${stLines.join("\n")}\n`,
      "manifest.json": manifest
    }
  };
}
