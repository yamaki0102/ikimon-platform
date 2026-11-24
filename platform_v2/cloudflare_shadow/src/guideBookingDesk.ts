import type { Env } from "./core/env";

export const GUIDE_PROFILES_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS guide_profiles (
  guide_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  display_name TEXT NOT NULL,
  specialties_json TEXT NOT NULL,
  places_json TEXT NOT NULL,
  is_nacsj_instructor INTEGER NOT NULL DEFAULT 0,
  verified_expert_count INTEGER NOT NULL DEFAULT 0,
  publish_status TEXT NOT NULL DEFAULT 'draft',
  updated_at INTEGER NOT NULL
)
`.trim();

export const GUIDE_BOOKING_REQUESTS_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS guide_booking_requests (
  request_id TEXT PRIMARY KEY,
  guide_id TEXT NOT NULL,
  requester_user_id TEXT NOT NULL,
  requester_kind TEXT NOT NULL,
  organization_name TEXT NOT NULL,
  place_id TEXT NOT NULL,
  preferred_date TEXT NOT NULL,
  grade TEXT NOT NULL DEFAULT '',
  unit TEXT NOT NULL DEFAULT '',
  nocosil_session_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested',
  created_at INTEGER NOT NULL
)
`.trim();

export const PLACE_SUPPORT_SEATS_CREATE_SQL = `
CREATE TABLE IF NOT EXISTS place_support_seats (
  seat_id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  sponsor_user_id TEXT NOT NULL,
  sponsor_name TEXT NOT NULL,
  equipment_note TEXT NOT NULL,
  created_at INTEGER NOT NULL
)
`.trim();

export type GuideProfileRow = {
  guide_id: string;
  user_id: string;
  display_name: string;
  specialties_json: string;
  places_json: string;
  is_nacsj_instructor: number;
  verified_expert_count: number;
  publish_status: string;
  updated_at: number;
};

export type School45MinTemplate = {
  grade: string;
  unit: string;
  stationSpots: string[];
  timeline: Array<{ minuteRange: string; step: string }>;
};

function escapeHtml(value: string): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function getSchool45MinTemplate(grade: string, unit: string): School45MinTemplate {
  const g = grade.trim() || "3年";
  const u = unit.trim() || "身近な自然の観察";
  return {
    grade: g,
    unit: u,
    stationSpots: ["校庭のすみ（草はら）", "正門まわりの樹木", "通学路の用水路・植え込み"],
    timeline: [
      { minuteRange: "0-5分", step: "案内人あいさつ・見るポイント3つを共有" },
      { minuteRange: "5-30分", step: "定点3か所をまわり写真・声・数を記録（種名は任意）" },
      { minuteRange: "30-40分", step: "見つけた違い・ゼロだった場所をクラスでふり返る" },
      { minuteRange: "40-45分", step: "持ち帰りカード確認・次の季節の見どころ案内" }
    ]
  };
}

export async function loadGuideProfileById(env: Env, guideId: string): Promise<GuideProfileRow | null> {
  await env.CORE_DB.prepare(GUIDE_PROFILES_CREATE_SQL).run();
  return env.CORE_DB.prepare(
    "SELECT * FROM guide_profiles WHERE guide_id = ?1 LIMIT 1"
  ).bind(guideId).first<GuideProfileRow>();
}

export function renderGuidePublicPage(
  guide: GuideProfileRow,
  options: {
    annualReportLinks?: Array<{ placeId: string; title: string; href: string }>;
    supportSeats?: Array<{ sponsor_name: string; equipment_note: string }>;
    cspNonce?: string;
  } = {}
): string {
  const nonceAttr = options.cspNonce ? ` nonce="${escapeHtml(options.cspNonce)}"` : "";
  let specialties: string[] = [];
  let places: string[] = [];
  try { specialties = JSON.parse(guide.specialties_json) as string[]; } catch { specialties = []; }
  try { places = JSON.parse(guide.places_json) as string[]; } catch { places = []; }
  const schoolPlan = getSchool45MinTemplate("3年", "身近な生きもの");

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(guide.display_name)} — 案内人 | ZUKAN</title>
  <style${nonceAttr}>
    body{margin:0;font-family:"Noto Sans JP",system-ui,sans-serif;background:#fff;color:#17251b;padding:20px}
    .gp-wrap{max-width:860px;margin:0 auto;display:grid;gap:20px}
    .gp-card{padding:18px;border-radius:12px;background:#f6f7f6;display:grid;gap:10px}
    .gp-meta{color:#485a4e;font-size:14px}
    .gp-list{margin:0;padding-left:20px}
    label{display:grid;gap:4px;font-size:14px;font-weight:700}
    input,select{min-height:44px;padding:8px 12px;border:1px solid #c5d1c8;border-radius:8px;font:inherit}
    button{min-height:44px;padding:10px 18px;border:0;border-radius:8px;background:#245c3a;color:#fff;font-weight:700;cursor:pointer}
  </style>
</head>
<body>
  <main class="gp-wrap" data-guide-public-page="1">
    <section class="gp-card">
      <h1>${escapeHtml(guide.display_name)}</h1>
      <div class="gp-meta">案内人${guide.is_nacsj_instructor ? " · 属性: NACS-J自然観察指導員" : ""} · 目利き確認 ${guide.verified_expert_count}件</div>
      <div><strong>得意分野:</strong> ${escapeHtml(specialties.join("、") || "地域の自然観察")}</div>
      <div><strong>歩ける場所:</strong> ${escapeHtml(places.join("、") || "相談のうえ決定")}</div>
      ${options.annualReportLinks?.length ? `<div><strong>年報:</strong> ${options.annualReportLinks.map((r) => `<a href="${escapeHtml(r.href)}">${escapeHtml(r.title)}</a>`).join(" / ")}</div>` : ""}
    </section>

    <section class="gp-card" aria-labelledby="gp-school-heading">
      <h2 id="gp-school-heading">学校の45分の型（${escapeHtml(schoolPlan.grade)}・${escapeHtml(schoolPlan.unit)}）</h2>
      <div><strong>校庭・通学路の定点:</strong> ${escapeHtml(schoolPlan.stationSpots.join(" / "))}</div>
      <ul class="gp-list">
        ${schoolPlan.timeline.map((t) => `<li><strong>${escapeHtml(t.minuteRange)}:</strong> ${escapeHtml(t.step)}</li>`).join("")}
      </ul>
    </section>

    <section class="gp-card" aria-labelledby="gp-book-heading">
      <h2 id="gp-book-heading">案内を頼む窓口（参加費・条件は案内人と主催者で直接決定）</h2>
      <form method="post" action="/api/v1/guides/${encodeURIComponent(guide.guide_id)}/requests">
        <label>種別<select name="requesterKind"><option value="school">学校</option><option value="nursery">保育園・幼稚園</option><option value="company">企業</option><option value="association">管理組合・地域団体</option></select></label>
        <label>学校・団体名<input name="organizationName" required></label>
        <label>希望日<input type="date" name="preferredDate" required></label>
        <label>場所ID<input name="placeId" required></label>
        <button type="submit">案内を依頼する</button>
      </form>
    </section>

    ${options.supportSeats?.length ? `<section class="gp-card"><h2>道具を支える席</h2><ul class="gp-list">${options.supportSeats.map((s) => `<li>${escapeHtml(s.sponsor_name)}（${escapeHtml(s.equipment_note)}）</li>`).join("")}</ul></section>` : ""}
  </main>
</body>
</html>`;
}
