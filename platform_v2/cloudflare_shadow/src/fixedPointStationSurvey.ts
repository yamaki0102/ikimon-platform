import {
  APP_EXPERIENCE_STYLES,
  renderAppExperienceHeader,
  renderAppExperienceNavigation,
  renderAppExperienceQuickCamera
} from "../../src/ui/appExperience";
import type { Env } from "./core/env";

export type FixedPointStationRow = {
  station_id: string;
  place_id: string;
  title: string;
  prompt_1: string;
  prompt_2: string;
  prompt_3: string;
  reference_photo_url: string;
  created_by_user_id: string;
  created_at: number;
};

export type FixedPointStationRecordRow = {
  record_id: string;
  station_id: string;
  place_id: string;
  answer_1: string;
  answer_2: string;
  answer_3: string;
  taxon_name: string;
  is_zero_observation: number;
  on_site_verified: number;
  verified_by_label: string;
  photo_url: string;
  observed_at: string;
  created_at: number;
};

export const FIXED_POINT_STATIONS_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS fixed_point_stations (
  station_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  title TEXT NOT NULL,
  prompt_1 TEXT NOT NULL,
  prompt_2 TEXT NOT NULL,
  prompt_3 TEXT NOT NULL,
  reference_photo_url TEXT NOT NULL DEFAULT '',
  created_by_user_id TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
)
`.trim();

export const FIXED_POINT_STATION_RECORDS_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS fixed_point_station_records (
  record_id TEXT PRIMARY KEY,
  station_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  answer_1 TEXT NOT NULL DEFAULT '',
  answer_2 TEXT NOT NULL DEFAULT '',
  answer_3 TEXT NOT NULL DEFAULT '',
  taxon_name TEXT NOT NULL DEFAULT '',
  is_zero_observation INTEGER NOT NULL DEFAULT 0,
  on_site_verified INTEGER NOT NULL DEFAULT 0,
  verified_by_label TEXT NOT NULL DEFAULT '',
  photo_url TEXT NOT NULL DEFAULT '',
  observed_at TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
`.trim();

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export async function upsertFixedPointStation(
  env: Env,
  input: {
    stationId?: string;
    placeId: string;
    title: string;
    prompt1: string;
    prompt2: string;
    prompt3: string;
    referencePhotoUrl?: string;
    createdByUserId?: string;
  }
): Promise<FixedPointStationRow> {
  const createdByUserId = (input.createdByUserId ?? "").trim().slice(0, 120);
  if (!createdByUserId) throw new Error("created_by_user_id_required");
  await env.CORE_DB.prepare(FIXED_POINT_STATIONS_CREATE_SQL).run();
  const stationId = `fps_${crypto.randomUUID().slice(0, 12)}`;
  const row: FixedPointStationRow = {
    station_id: stationId,
    place_id: input.placeId.slice(0, 160),
    title: input.title.trim().slice(0, 120) || "定点",
    prompt_1: input.prompt1.trim().slice(0, 120) || "水の色・ようす",
    prompt_2: input.prompt2.trim().slice(0, 120) || "花の数",
    prompt_3: input.prompt3.trim().slice(0, 120) || "鳥の声の有無",
    reference_photo_url: (input.referencePhotoUrl ?? "").trim().slice(0, 500),
    created_by_user_id: createdByUserId,
    created_at: Date.now()
  };

  await env.CORE_DB.prepare(
    `INSERT INTO fixed_point_stations (
      station_id, place_id, title, prompt_1, prompt_2, prompt_3, reference_photo_url, created_by_user_id, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
    ON CONFLICT(station_id) DO UPDATE SET
      title = excluded.title,
      prompt_1 = excluded.prompt_1,
      prompt_2 = excluded.prompt_2,
      prompt_3 = excluded.prompt_3,
      reference_photo_url = CASE WHEN excluded.reference_photo_url <> '' THEN excluded.reference_photo_url ELSE fixed_point_stations.reference_photo_url END`
  ).bind(
    row.station_id,
    row.place_id,
    row.title,
    row.prompt_1,
    row.prompt_2,
    row.prompt_3,
    row.reference_photo_url,
    row.created_by_user_id,
    row.created_at
  ).run();

  return row;
}

export async function createFixedPointStationRecord(
  env: Env,
  input: {
    stationId: string;
    placeId: string;
    answer1?: string;
    answer2?: string;
    answer3?: string;
    taxonName?: string;
    isZeroObservation?: boolean;
    onSiteVerified?: boolean;
    verifiedByLabel?: string;
    photoUrl?: string;
    observedAt?: string;
  }
): Promise<FixedPointStationRecordRow> {
  await env.CORE_DB.prepare(FIXED_POINT_STATION_RECORDS_CREATE_SQL).run();
  const row: FixedPointStationRecordRow = {
    record_id: `fpr_${crypto.randomUUID().slice(0, 12)}`,
    station_id: input.stationId,
    place_id: input.placeId,
    answer_1: (input.answer1 ?? "").trim().slice(0, 200),
    answer_2: (input.answer2 ?? "").trim().slice(0, 200),
    answer_3: (input.answer3 ?? "").trim().slice(0, 200),
    taxon_name: (input.taxonName ?? "").trim().slice(0, 120),
    is_zero_observation: input.isZeroObservation ? 1 : 0,
    on_site_verified: input.onSiteVerified ? 1 : 0,
    verified_by_label: input.onSiteVerified ? ((input.verifiedByLabel ?? "現地確認者").trim().slice(0, 80) || "現地確認者") : "",
    photo_url: (input.photoUrl ?? "").trim().slice(0, 500),
    observed_at: (input.observedAt ?? "").trim().slice(0, 64) || new Date().toISOString(),
    created_at: Date.now()
  };

  await env.CORE_DB.prepare(
    `INSERT INTO fixed_point_station_records (
      record_id, station_id, place_id, answer_1, answer_2, answer_3, taxon_name,
      is_zero_observation, on_site_verified, verified_by_label, photo_url, observed_at, created_at
    ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`
  ).bind(
    row.record_id,
    row.station_id,
    row.place_id,
    row.answer_1,
    row.answer_2,
    row.answer_3,
    row.taxon_name,
    row.is_zero_observation,
    row.on_site_verified,
    row.verified_by_label,
    row.photo_url,
    row.observed_at,
    row.created_at
  ).run();

  return row;
}

export async function loadFixedPointStationById(env: Env, placeId: string, stationId: string): Promise<FixedPointStationRow | null> {
  try {
    await env.CORE_DB.prepare(FIXED_POINT_STATIONS_CREATE_SQL).run();
    const row = await env.CORE_DB.prepare(
      `SELECT station_id, place_id, title, prompt_1, prompt_2, prompt_3, reference_photo_url, created_by_user_id, created_at
       FROM fixed_point_stations
       WHERE place_id = ?1 AND station_id = ?2
       LIMIT 1`
    ).bind(placeId, stationId).first<FixedPointStationRow>();
    return row ?? null;
  } catch {
    return null;
  }
}

export async function listFixedPointsAndRecordsForPlace(
  env: Env,
  placeId: string,
  stationId?: string
): Promise<{ stations: FixedPointStationRow[]; records: FixedPointStationRecordRow[] }> {
  try {
    await env.CORE_DB.prepare(FIXED_POINT_STATIONS_CREATE_SQL).run();
    await env.CORE_DB.prepare(FIXED_POINT_STATION_RECORDS_CREATE_SQL).run();
    const stationsRes = await env.CORE_DB.prepare(
      `SELECT station_id, place_id, title, prompt_1, prompt_2, prompt_3, reference_photo_url, created_by_user_id, created_at
       FROM fixed_point_stations
       WHERE place_id = ?1
       ORDER BY created_at DESC`
    ).bind(placeId).all<FixedPointStationRow>();
    const recordsStmt = stationId
      ? env.CORE_DB.prepare(
          `SELECT record_id, station_id, place_id, answer_1, answer_2, answer_3, taxon_name,
                  is_zero_observation, on_site_verified, verified_by_label, photo_url, observed_at, created_at
           FROM fixed_point_station_records
           WHERE place_id = ?1 AND station_id = ?2
           ORDER BY observed_at DESC, created_at DESC`
        ).bind(placeId, stationId)
      : env.CORE_DB.prepare(
          `SELECT record_id, station_id, place_id, answer_1, answer_2, answer_3, taxon_name,
                  is_zero_observation, on_site_verified, verified_by_label, photo_url, observed_at, created_at
           FROM fixed_point_station_records
           WHERE place_id = ?1
           ORDER BY observed_at DESC, created_at DESC`
        ).bind(placeId);
    const recordsRes = await recordsStmt.all<FixedPointStationRecordRow>();
    return {
      stations: stationsRes.results ?? [],
      records: recordsRes.results ?? []
    };
  } catch {
    return { stations: [], records: [] };
  }
}

export function renderFixedPointTimelineHtml(
  stations: FixedPointStationRow[],
  records: FixedPointStationRecordRow[],
  lang = "ja",
  placeId = ""
): string {
  if (stations.length === 0 && records.length === 0) return "";
  const prefix = `/${lang === "en" || lang === "es" || lang === "pt-br" ? lang : "ja"}`;
  const stationMap = new Map(stations.map((s) => [s.station_id, s]));

  return `<section class="fps-timeline" data-fixed-point-timeline aria-labelledby="fps-timeline-heading">
    <style>
      .fps-timeline{margin-top:24px;padding:18px;border:1px solid #d7dfd8;border-radius:16px;background:#fff;display:grid;gap:12px}
      .fps-timeline h2{margin:0;font-size:1.2rem}
      .fps-station-chips{display:flex;flex-wrap:wrap;gap:8px}
      .fps-station-chip{min-height:40px;display:inline-flex;align-items:center;padding:6px 14px;border:1px solid #245c3a;border-radius:999px;color:#245c3a;text-decoration:none;font-weight:700;font-size:14px}
      .fps-record-list{margin:0;padding:0;list-style:none;display:grid;gap:10px}
      .fps-record-item{padding:12px;border-radius:12px;background:#f7faf7;border:1px solid #e1e9e2;display:grid;gap:6px}
      .fps-badge{display:inline-block;width:max-content;padding:3px 9px;border-radius:999px;font-size:12px;font-weight:700}
      .fps-badge.is-verified{background:#14532d;color:#fff}
      .fps-badge.is-zero{background:#fef3c7;color:#78350f}
    </style>
    <h2 id="fps-timeline-heading">定点の時系列記録</h2>
    ${stations.length > 0 ? `<div class="fps-station-chips">${stations.map((s) => `<a class="fps-station-chip" href="${escapeHtml(`${prefix}/places/${encodeURIComponent(placeId || s.place_id)}/stations/${encodeURIComponent(s.station_id)}`)}">QR標識: ${escapeHtml(s.title)}</a>`).join("")}</div>` : ""}
    ${records.length > 0 ? `<ul class="fps-record-list">${records.map((r) => {
      const st = stationMap.get(r.station_id);
      return `<li class="fps-record-item" data-fixed-point-record="${escapeHtml(r.record_id)}">
        <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
          <strong>${escapeHtml(st?.title ?? r.station_id)}</strong>
          <span>${escapeHtml(r.observed_at)}</span>
          ${r.on_site_verified ? `<span class="fps-badge is-verified">現地確認済み（写真判定より上位の証拠）: ${escapeHtml(r.verified_by_label)}</span>` : ""}
          ${r.is_zero_observation ? `<span class="fps-badge is-zero">ゼロ記録（確認できず・いないと断定しません）</span>` : ""}
        </div>
        ${r.taxon_name ? `<div><strong>種名（任意）:</strong> ${escapeHtml(r.taxon_name)}</div>` : ""}
        <div>${escapeHtml([
          st ? `${st.prompt_1}: ${r.answer_1 || "-"}` : r.answer_1,
          st ? `${st.prompt_2}: ${r.answer_2 || "-"}` : r.answer_2,
          st ? `${st.prompt_3}: ${r.answer_3 || "-"}` : r.answer_3
        ].filter(Boolean).join(" / "))}</div>
      </li>`;
    }).join("")}</ul>` : `<p>まだ定点の記録はありません。</p>`}
  </section>`;
}

export function renderFixedPointQrSignPage(input: {
  station: FixedPointStationRow;
  records: FixedPointStationRecordRow[];
  lang: string;
  cspNonce?: string;
}): string {
  const lang = input.lang === "en" || input.lang === "es" || input.lang === "pt-br" ? input.lang : "ja";
  const prefix = `/${lang}`;
  const cspNonce = input.cspNonce ?? "";
  const st = input.station;
  const exemplarPhoto = st.reference_photo_url;
  const lastPhoto = input.records.find((r) => r.photo_url)?.photo_url || "";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(lang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(st.title)} — 定点QR標識 | ZUKAN</title>
  <style nonce="${escapeHtml(cspNonce)}">
    ${APP_EXPERIENCE_STYLES}
    .fps-shell{max-width:680px;margin:18px auto 104px;padding:0 16px;display:grid;gap:16px}
    .fps-card{background:#fff;border:1px solid #d8e1d9;border-radius:18px;padding:20px;display:grid;gap:12px}
    .fps-eyebrow{display:inline-block;width:max-content;padding:4px 10px;border-radius:999px;background:#eaf4ee;color:#1e6f4c;font-size:12px;font-weight:700}
    .fps-overlay-box{position:relative;border-radius:14px;overflow:hidden;border:1px solid #c8d3ca;background:#111;min-height:220px;display:grid;place-items:center}
    .fps-overlay-box img.fps-prev{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;pointer-events:none;opacity:.45}
    .fps-overlay-box img.fps-new{width:100%;height:100%;object-fit:cover;display:none}
    .fps-compare{display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:13px;font-weight:600}
    .fps-compare figure{margin:0;display:grid;gap:4px;min-width:0}
    .fps-compare img,.fps-compare .fps-compare-now{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:10px;border:1px solid #c8d3ca;background:#eef2ee;box-sizing:border-box}
    .fps-compare .fps-compare-now{display:grid;place-items:center;color:#5a6b5f;font-weight:400;text-align:center;padding:6px}
    .fps-field{display:grid;gap:6px;font-size:14px;font-weight:600}
    .fps-input{width:100%;box-sizing:border-box;min-height:44px;padding:10px 12px;border-radius:12px;border:1px solid #c8d3ca;font:inherit}
    .fps-btn{min-height:44px;padding:10px 18px;border:0;border-radius:12px;background:#1e6f4c;color:#fff;font:inherit;font-weight:700;cursor:pointer}
  </style>
</head>
<body>
  ${renderAppExperienceHeader(lang, 3, false, "fps-main", { currentPath: `${prefix}/places/${st.place_id}/stations/${st.station_id}` })}
  <main id="fps-main" class="fps-shell" data-fixed-point-qr-sign="${escapeHtml(st.station_id)}">
    <section class="fps-card">
      <span class="fps-eyebrow">定点QR標識</span>
      <h1>${escapeHtml(st.title)}</h1>
      <p><a href="${escapeHtml(`${prefix}/places/${encodeURIComponent(st.place_id)}`)}">← 場所ページに戻る</a></p>
      <div class="fps-overlay-box">
        ${exemplarPhoto ? `<img id="fps-prev-photo" class="fps-prev" src="${escapeHtml(exemplarPhoto)}" alt="この定点の見本写真（半透明重ね）">` : `<span style="color:#fff;padding:12px;text-align:center">この定点の見本写真がまだありません。最初に正しく撮れた1枚が見本になります</span>`}
        <img id="fps-new-photo" class="fps-new" alt="今回の撮影プレビュー">
      </div>
      <label class="fps-field">重ね撮り透明度（見本写真）
        <input id="fps-opacity" type="range" min="0" max="0.9" step="0.05" value="0.45">
      </label>
      ${lastPhoto ? `<div class="fps-compare" data-fps-compare>
        <figure><figcaption>前回</figcaption><img id="fps-last-photo" src="${escapeHtml(lastPhoto)}" alt="前回の同じ定点の写真" loading="lazy"></figure>
        <figure><figcaption>今回</figcaption><div class="fps-compare-now">撮影後にここへ表示されます</div></figure>
      </div>` : ""}
      <form id="fps-record-form" class="fps-card" style="padding:14px;background:#f9fbf9">
        <label class="fps-field"><span>1. ${escapeHtml(st.prompt_1)}</span><input class="fps-input" name="answer1" required></label>
        <label class="fps-field"><span>2. ${escapeHtml(st.prompt_2)}</span><input class="fps-input" name="answer2" required></label>
        <label class="fps-field"><span>3. ${escapeHtml(st.prompt_3)}</span><input class="fps-input" name="answer3" required></label>
        <label class="fps-field"><span>種名（任意）</span><input class="fps-input" name="taxonName" placeholder="わからなければ空欄で構いません"></label>
        <label><input type="checkbox" name="isZeroObservation"> この時間は確認できなかった（ゼロ記録・いないと断定しません）</label>
        <label><input type="checkbox" name="onSiteVerified"> その場で実物を確かめた（現地確認の印）</label>
        <label class="fps-field"><span>確認者名（現地確認時）</span><input class="fps-input" name="verifiedByLabel" placeholder="案内人・確認者"></label>
        <button type="submit" class="fps-btn">この定点の記録を残す</button>
        <div id="fps-status" role="status" aria-live="polite"></div>
      </form>
    </section>
    ${renderFixedPointTimelineHtml([st], input.records, lang, st.place_id)}
  </main>
  ${renderAppExperienceNavigation(lang, 3, "bottom", false)}${renderAppExperienceQuickCamera(lang, { nonce: cspNonce })}
  <script nonce="${escapeHtml(cspNonce)}">
    (function () {
      var range = document.getElementById("fps-opacity");
      var prev = document.getElementById("fps-prev-photo");
      if (range && prev) {
        range.addEventListener("input", function () { prev.style.opacity = String(range.value); });
      }
      var form = document.getElementById("fps-record-form");
      var status = document.getElementById("fps-status");
      if (!form) return;
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var fd = new FormData(form);
        var res = await fetch(${JSON.stringify(`/api/v1/places/${encodeURIComponent(st.place_id)}/stations/${encodeURIComponent(st.station_id)}/records`)}, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            answer1: fd.get("answer1") || "",
            answer2: fd.get("answer2") || "",
            answer3: fd.get("answer3") || "",
            taxonName: fd.get("taxonName") || "",
            isZeroObservation: Boolean(fd.get("isZeroObservation")),
            onSiteVerified: Boolean(fd.get("onSiteVerified")),
            verifiedByLabel: fd.get("verifiedByLabel") || ""
          })
        });
        if (res.ok && status) {
          status.textContent = "定点の記録を保存しました。";
        } else if (status) {
          status.textContent = "保存できませんでした。";
        }
      });
    })();
  </script>
</body>
</html>`;
}
