import type { Env } from "./core/env";

type D1Db = Env["OBS_DB"];

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export type YearAgoObservationItem = {
  observationId: string;
  title: string;
  observedAt: string;
  placeId: string;
  placeName: string;
  photoUrl: string | null;
};

export function computeYearAgoWindow(referenceDate = new Date()): { startIso: string; endIso: string } {
  const target = new Date(referenceDate.getTime() - 365 * 24 * 60 * 60 * 1000);
  const start = new Date(target.getTime() - 14 * 24 * 60 * 60 * 1000);
  const end = new Date(target.getTime() + 14 * 24 * 60 * 60 * 1000);
  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

/**
 * Owner-scoped lookup of observations at the same place around the same date 1 year ago (±14 days).
 */
export async function findYearAgoSamePlaceObservations(
  obsDb: D1Db,
  input: { userId: string; placeId: string; referenceDate?: Date; limit?: number }
): Promise<YearAgoObservationItem[]> {
  const placeId = input.placeId.trim();
  if (!input.userId || !placeId) return [];
  const { startIso, endIso } = computeYearAgoWindow(input.referenceDate ?? new Date());
  const limit = Math.max(1, Math.min(20, input.limit ?? 6));

  try {
    const res = await obsDb.prepare(
      `SELECT o.observation_id,
              COALESCE(NULLIF(TRIM(o.taxon_label), ''), '自然の記録') AS title,
              o.observed_at,
              c.field_id AS place_id,
              COALESCE(p.canonical_name, c.field_id) AS place_name
         FROM observations o
         JOIN civic_observation_contexts c ON c.visit_id = o.observation_id
         LEFT JOIN places p ON p.place_id = c.field_id
        WHERE o.owner_user_id = ?
          AND c.field_id = ?
          AND o.observed_at >= ?
          AND o.observed_at <= ?
        ORDER BY o.observed_at DESC
        LIMIT ?`
    ).bind(input.userId, placeId, startIso, endIso, limit).all<{
      observation_id: string;
      title: string;
      observed_at: string;
      place_id: string;
      place_name: string;
    }>();
    return (res.results ?? []).map((row) => ({
      observationId: row.observation_id,
      title: row.title,
      observedAt: row.observed_at,
      placeId: row.place_id,
      placeName: row.place_name,
      photoUrl: null,
    }));
  } catch {
    return [];
  }
}

export function renderZukanLibraryYearAgoAndSelectPage(options: {
  lang?: "ja" | "en";
  placeName: string;
  yearAgoItems: YearAgoObservationItem[];
  items: Array<{ observationId: string; title: string; observedAt: string; photoUrl: string | null }>;
}): string {
  const lang = options.lang === "en" ? "en" : "ja";
  const prefix = `/${lang}`;
  const yearAgoHtml = options.yearAgoItems.length > 0
    ? `<section class="zb-card" data-library-year-ago-card="1">
        <h2>${lang === "en" ? `1 year ago at ${escapeHtml(options.placeName)}` : `1年前のこの場所（${escapeHtml(options.placeName)}）`}</h2>
        <ul class="zb-year-list">
          ${options.yearAgoItems
            .map(
              (item) => `<li><a href="${prefix}/observations/${encodeURIComponent(item.observationId)}">${escapeHtml(item.title)}</a> <time>${escapeHtml(item.observedAt.slice(0, 10))}</time></li>`
            )
            .join("")}
        </ul>
      </section>`
    : "";

  const gridHtml = `<section class="zb-select-section" data-library-multiselect="1">
      <div class="zb-select-bar" data-multiselect-bar>
        <strong data-multiselect-count="0">${lang === "en" ? "0 selected" : "0件選択中"}</strong>
      </div>
      <div class="zb-grid">
        ${options.items
          .map(
            (item) => `<label class="zb-item" data-selected="false">
              <input type="checkbox" class="zb-check" data-select-observation="${escapeHtml(item.observationId)}">
              ${item.photoUrl ? `<img src="${escapeHtml(item.photoUrl)}" alt="${escapeHtml(item.title)}">` : `<span class="zb-fallback">${escapeHtml(item.title)}</span>`}
              <span class="zb-title">${escapeHtml(item.title)}</span>
              <time>${escapeHtml(item.observedAt.slice(0, 10))}</time>
            </label>`
          )
          .join("")}
      </div>
    </section>`;

  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${lang === "en" ? "Library selection" : "ライブラリ（1年前・複数選択）"} — ZUKAN</title>
  <style>
    :root{color-scheme:light;--bg:#ffffff;--surface:#f6f7f6;--ink:#17251b;--muted:#485a4e;--green:#245c3a;--line:#dce3dd}
    *{box-sizing:border-box}
    body{margin:0;background:var(--bg);color:var(--ink);font-family:"Noto Sans JP",system-ui,sans-serif;line-height:1.5}
    a,a:visited{color:var(--green)}
    .zb-wrap{max-width:960px;margin:0 auto;padding:20px 16px 72px;display:grid;gap:18px}
    .zb-card,.zb-select-bar{padding:16px;border:1px solid var(--line);border-radius:14px;background:var(--surface)}
    .zb-select-bar{position:sticky;top:8px;z-index:10;display:flex;align-items:center;justify-content:space-between;background:#fff}
    .zb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-top:12px}
    .zb-item{position:relative;display:grid;gap:6px;padding:10px;border:2px solid var(--line);border-radius:12px;background:#fff;opacity:1;cursor:pointer}
    .zb-item[data-selected="true"]{border-color:var(--green);background:#f1f7f3}
    .zb-check{position:absolute;top:10px;right:10px;width:22px;height:22px;accent-color:var(--green)}
    .zb-item img,.zb-fallback{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:8px;background:var(--surface);display:flex;align-items:center;justify-content:center}
    .zb-title{font-weight:700;font-size:14px}
    .zb-item time{font-size:12px;color:var(--muted)}
    @media(prefers-reduced-motion:reduce){*{transition-duration:.01ms!important}}
  </style>
</head>
<body>
  <main class="zb-wrap">
    ${yearAgoHtml}
    ${gridHtml}
  </main>
  <script>
    (() => {
      const countEl = document.querySelector("[data-multiselect-count]");
      const boxes = Array.from(document.querySelectorAll("[data-select-observation]"));
      const update = () => {
        let count = 0;
        for (const box of boxes) {
          const checked = Boolean(box.checked);
          if (checked) count += 1;
          box.closest(".zb-item")?.setAttribute("data-selected", checked ? "true" : "false");
        }
        if (countEl) {
          countEl.setAttribute("data-multiselect-count", String(count));
          countEl.textContent = count + (document.documentElement.lang === "en" ? " selected" : "件選択中");
        }
      };
      boxes.forEach((box) => box.addEventListener("change", update));
    })();
  </script>
</body>
</html>`;
}
