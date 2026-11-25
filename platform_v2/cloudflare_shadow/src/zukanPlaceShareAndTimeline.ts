import { renderZukanCommonShell } from "./zukanLibraryAndProfile";

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]!));

export type FixedPointTimelineFrame = {
  observationId: string;
  assetId: string;
  observedAt: string | null;
  thumbUrl: string;
};

type ObsDbLike = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
    };
  };
};

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}

export async function loadPlaceFixedPointFrames(
  placeId: string,
  db: ObsDbLike
): Promise<{ placeName: string; frames: FixedPointTimelineFrame[] } | null> {
  const place = await db
    .prepare("SELECT place_id, canonical_name, public_profile_status FROM places WHERE place_id = ?")
    .bind(placeId)
    .first<{ place_id: string; canonical_name: string; public_profile_status: string }>();

  if (!place || place.public_profile_status === "private") {
    return null;
  }

  const rows = await db
    .prepare(
      `SELECT
         o.observation_id,
         a.asset_id,
         o.observed_at
       FROM record_place_memberships m
       JOIN observations o
         ON o.observation_id = m.record_id
       JOIN asset_ledger a
         ON a.observation_id = o.observation_id
        AND a.exif_scrub_state = 'scrubbed'
WHERE m.place_id = ?
         AND m.membership_state = 'confirmed'
         AND m.public_precision = 'place'
         AND m.removed_at IS NULL
         AND o.visibility = 'public'
         AND COALESCE(o.emergency_hidden, 0) = 0
       ORDER BY o.observed_at ASC
       LIMIT 60`
    )
    .bind(placeId)
    .all<{ observation_id: string; asset_id: string; observed_at: string | null }>();

  const frames: FixedPointTimelineFrame[] = (rows.results ?? []).map((row) => ({
    observationId: row.observation_id,
    assetId: row.asset_id,
    observedAt: row.observed_at,
    thumbUrl: `/thumb/400/${encodeURIComponent(row.asset_id)}`,
  }));

  return { placeName: place.canonical_name, frames };
}

export async function handlePlaceFixedPointTimelineApi(placeId: string, db: ObsDbLike): Promise<Response> {
  const data = await loadPlaceFixedPointFrames(placeId, db);
  if (!data) {
    return jsonResponse({ ok: false, error: "place_not_found" }, 404);
  }
  return jsonResponse({ ok: true, placeId, frames: data.frames }, 200);
}

export async function handlePlaceTimelinePageRoute(
  placeId: string,
  lang: "ja" | "en" | "es" | "pt-br",
  session: { userId: string; displayName?: string | null; banned?: boolean } | null,
  db: ObsDbLike
): Promise<Response> {
  const data = await loadPlaceFixedPointFrames(placeId, db);
  if (!data) {
    return new Response("Not found", { status: 404 });
  }

  const isEn = lang === "en";
  const prefix = lang === "ja" ? "/ja" : `/${lang}`;
  const encodedPlace = encodeURIComponent(placeId);
  const authenticated = Boolean(session && !session.banned);
  const firstFrame = data.frames[0] ?? null;

  const jstParts = (iso: string | null): { year: number; month: number } | null => {
    const t = iso ? new Date(iso) : null;
    if (!t || Number.isNaN(t.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", year: "numeric", month: "numeric" }).formatToParts(t);
    return { year: Number(parts.find((p) => p.type === "year")?.value), month: Number(parts.find((p) => p.type === "month")?.value) };
  };
  const frameData = data.frames.map((frame) => {
    const ym = jstParts(frame.observedAt);
    return {
      id: frame.observationId,
      src: `/thumb/600/${encodeURIComponent(frame.assetId)}`,
      thumb: frame.thumbUrl,
      year: ym?.year ?? 0,
      label: ym ? (isEn ? `${ym.year}-${String(ym.month).padStart(2, "0")}` : `${ym.year}年${ym.month}月`) : "",
    };
  });
  const n = frameData.length;
  const years = [...new Set(frameData.map((f) => f.year).filter(Boolean))];
  const yearCounts = years.map((y) => ({ year: y, count: frameData.filter((f) => f.year === y).length }));
  const maxYear = Math.max(1, ...yearCounts.map((y) => y.count));
  const sampleIdx = n <= 4 ? frameData.map((_, i) => i) : [0, 1, 2, 3].map((k) => Math.round((k * (n - 1)) / 3));
  const rangeLabel = years.length > 1 ? `${years[0]}${isEn ? "–" : "年〜"}${years[years.length - 1]}${isEn ? "" : "年"}` : "";
  const tickYears = years.map((y) => {
    const first = frameData.findIndex((f) => f.year === y);
    return { y, pos: n > 1 ? (first / (n - 1)) * 100 : 0 };
  });
  const last = frameData[n - 1];
  const shareUrlPath = `${prefix}/places/${encodedPlace}`;
  const clientData = JSON.stringify(frameData.map((f) => ({ s: f.src, l: f.label }))).replace(/</g, "\\u003c");
  const hasFrames = n > 0;
  const copiedText = isEn ? "Link copied." : "URLをコピーしました。";
  const copyFailText = isEn ? "Could not copy. Use the address bar link instead." : "コピーできませんでした。アドレス欄のURLをお使いください。";

  const bodyHtml = `<section class="zt-tl" data-place-share-timeline="e12-e13-e1b">
    <style>
      .zt-tl{display:grid;gap:20px;margin:0 -20px;color:#17251b}
      .zt-tl-hero{position:relative;min-height:240px;background:linear-gradient(135deg,#143F2E,#3f7a58);color:#fff;display:flex;align-items:flex-end}
      .zt-tl-hero img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
      .zt-tl-hero::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,0) 40%,rgba(8,18,12,.72))}
      .zt-tl-hero div{position:relative;z-index:1;padding:20px}
      .zt-tl-hero h1{margin:0;font-size:1.75rem;line-height:1.3;color:#fff}
      .zt-tl-hero p{margin:4px 0 0;font-size:1rem}
      .zt-tl-back,.zt-tl-back:visited{position:absolute;z-index:2;top:14px;left:14px;display:grid;place-items:center;width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,.92);color:#17251b}
      .zt-tl-back svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .zt-tl-card{margin:0 20px;padding:18px 16px;border:1px solid #dde2dc;border-radius:22px;background:#fff;display:grid;gap:12px}
      .zt-tl-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .zt-tl-head strong{font-size:1.5rem}
      .zt-tl-chip{padding:3px 12px;border-radius:999px;background:#e8f0ea;color:#143F2E;font-weight:700;font-size:.875rem}
      .zt-tl-chip[hidden]{display:none}
      .zt-tl-range{margin-left:auto;color:#55615a;font-size:.9375rem}
      .zt-tl-slider{width:100%;min-height:44px;accent-color:#143F2E;margin:0}
      .zt-tl-ticks{position:relative;height:20px;color:#55615a;font-size:.875rem;font-weight:700;margin:-8px 10px 0}
      .zt-tl-ticks span{position:absolute;transform:translateX(-50%);white-space:nowrap}.zt-tl-ticks span:first-child{transform:none}
      .zt-tl-hint{margin:0;text-align:center;color:#55615a;font-size:.9375rem}
      .zt-tl-thumbs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
      .zt-tl-thumb{display:grid;gap:4px;padding:0;border:0;background:none;font:inherit;color:#55615a;cursor:pointer;text-align:center;font-size:.75rem;font-weight:700}
      .zt-tl-thumb img{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:12px;border:3px solid transparent;background:#eef1ed}
      .zt-tl-thumb[aria-pressed="true"]{color:#143F2E}.zt-tl-thumb[aria-pressed="true"] img{border-color:#143F2E}
      .zt-tl-dot{display:block;margin:0 20px;font-weight:700;color:#143F2E}.zt-tl-dot::before{content:"";display:inline-block;width:8px;height:8px;margin-right:8px;border-radius:50%;background:#2f8f63}
      .zt-tl h2{margin:0 20px;font-size:1.25rem}
      .zt-tl-years{margin:0 20px;padding:16px;border:1px solid #dde2dc;border-radius:22px;background:#fff;display:grid;gap:12px}
      .zt-tl-year{display:grid;grid-template-columns:3.5em 1fr 3em;align-items:center;gap:12px;font-weight:700}
      .zt-tl-year i{display:block;height:12px;border-radius:999px;background:#eef1ed;position:relative;overflow:hidden}.zt-tl-year i b{position:absolute;inset:0 auto 0 0;border-radius:999px;background:#143F2E}
      .zt-tl-year span:last-child{text-align:right}
      .zt-tl-actions{margin:0 20px;display:grid;gap:10px}
      .zt-tl-actions .zt-btn-capture,.zt-tl-actions .zt-btn-outline{width:100%;min-height:52px;border-radius:16px}
      .zt-tl-status{margin:0 20px;min-height:1.5em;color:#143F2E;font-weight:700;text-align:center}
      .zt-tl-empty{margin:0 20px;padding:24px 16px;border:1px solid #dde2dc;border-radius:20px;text-align:center;color:#55615a;background:#fff}
      @media(min-width:960px){.zt-tl{margin:0 auto;max-width:720px}.zt-tl-hero{border-radius:22px;overflow:hidden}.zt-tl-card,.zt-tl-years,.zt-tl-actions,.zt-tl-dot,.zt-tl h2,.zt-tl-status,.zt-tl-empty{margin-left:0;margin-right:0}}
      @media (prefers-reduced-motion:reduce){.zt-tl,.zt-tl *{transition:none!important;animation:none!important}}
    </style>
    <div class="zt-tl-hero">
      <a class="zt-tl-back" href="${escapeHtml(`${prefix}/places/${encodedPlace}`)}" aria-label="${isEn ? "Back to the place" : "場所に戻る"}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 6-6 6 6 6"/></svg></a>
      ${hasFrames ? `<img id="place-timeline-hero" src="${escapeHtml(last!.src)}" alt="${escapeHtml(data.placeName)}">` : ""}
      <div><h1>${escapeHtml(data.placeName)}</h1><p>${isEn ? `Fixed point ・ ${n} public photos` : `定点 ・ 公開された写真 ${n}枚`}</p></div>
    </div>
    ${hasFrames ? `<div class="zt-tl-card" data-timeline-card>
      <div class="zt-tl-head"><strong id="place-timeline-date">${escapeHtml(last!.label || "—")}</strong><span class="zt-tl-chip" id="place-timeline-chip">${isEn ? "Latest photo" : "いまの写真"}</span>${rangeLabel ? `<span class="zt-tl-range">${escapeHtml(rangeLabel)}</span>` : ""}</div>
      ${n > 1 ? `<input id="place-timeline-slider" class="zt-tl-slider" type="range" min="0" max="${n - 1}" value="${n - 1}" step="1" aria-label="${isEn ? "Scrub timeline" : "時間をなぞる"}">
      <div class="zt-tl-ticks" aria-hidden="true">${tickYears.map((t) => `<span style="left:${t.pos.toFixed(1)}%">${t.y}${isEn ? "" : "年"}</span>`).join("")}</div>
      <p class="zt-tl-hint">${isEn ? "Drag to switch between seasons and years" : "左右になぞると、季節と年の写真に替わります"}</p>` : ""}
      <div class="zt-tl-thumbs">${sampleIdx.map((i) => `<button type="button" class="zt-tl-thumb" data-frame="${i}" aria-pressed="${i === n - 1 ? "true" : "false"}"><img src="${escapeHtml(frameData[i]!.thumb)}" alt="" loading="lazy" decoding="async"><span>${escapeHtml(frameData[i]!.label)}</span></button>`).join("")}</div>
    </div>
    <p class="zt-tl-dot" data-testid="timeline-count">${isEn ? `${n} public records shot at this place` : `同じ場所で撮られた公開の記録 ${n}件`}</p>
    <h2>${isEn ? "Records by year" : "年ごとの記録"}</h2>
    <div class="zt-tl-years">${yearCounts.map((y) => `<div class="zt-tl-year"><span>${y.year}${isEn ? "" : "年"}</span><i><b style="width:${Math.round((y.count / maxYear) * 100)}%"></b></i><span>${y.count}${isEn ? "" : "件"}</span></div>`).join("")}</div>` : `<p class="zt-tl-empty">${isEn ? "No fixed-point photos yet." : "定点写真はまだありません。"}</p>`}
    <div class="zt-tl-actions">
      <a class="zt-btn-capture" href="${escapeHtml(`${prefix}/record`)}">${isEn ? "Record at this place" : "この場所で記録する"}</a>
      <a class="zt-btn-outline" href="${escapeHtml(shareUrlPath)}">${isEn ? "Save this place" : "この場所を保存する"}</a>
    </div>
    <div class="zt-tl-actions" data-place-share-sheet="e12">
      <button type="button" id="place-share-copy-btn" class="zt-btn-outline" data-share-path="${escapeHtml(shareUrlPath)}">${isEn ? "Copy share link" : "この場所のURLをコピー"}</button>
    </div>
    <p class="zt-tl-status" id="place-share-status" role="status" aria-live="polite"></p>
    <div class="zt-tl-actions" data-place-event-entry="e1b">
      <a class="zt-btn-capture" href="${escapeHtml(`${prefix}/community/events/new?placeId=${encodedPlace}`)}">${isEn ? "Host an observation event here" : "この場所で観察会を開く"}</a>
    </div>
    <script>
    (()=>{
      const frames=${clientData};
      const slider=document.getElementById("place-timeline-slider");
      const hero=document.getElementById("place-timeline-hero");
      const date=document.getElementById("place-timeline-date");
      const chip=document.getElementById("place-timeline-chip");
      const thumbs=[...document.querySelectorAll(".zt-tl-thumb")];
      const show=(i)=>{const f=frames[i];if(!f)return;if(hero)hero.src=f.s;if(date)date.textContent=f.l||"—";if(chip)chip.hidden=i!==frames.length-1;thumbs.forEach((t)=>t.setAttribute("aria-pressed",String(Number(t.dataset.frame)===i)));if(slider&&Number(slider.value)!==i)slider.value=String(i);};
      if(slider)slider.addEventListener("input",()=>show(Number(slider.value)));
      thumbs.forEach((t)=>t.addEventListener("click",()=>show(Number(t.dataset.frame))));
      const btn=document.getElementById("place-share-copy-btn");
      const status=document.getElementById("place-share-status");
      if(btn)btn.addEventListener("click",async()=>{
        const url=location.origin+btn.dataset.sharePath;
        try{await navigator.clipboard.writeText(url);status.textContent=${JSON.stringify(copiedText)};}
        catch{const ta=document.createElement("textarea");ta.value=url;document.body.appendChild(ta);ta.select();let ok=false;try{ok=document.execCommand("copy");}catch{}ta.remove();status.textContent=ok?${JSON.stringify(copiedText)}:${JSON.stringify(copyFailText)};}
      });
    })();
    </script>
  </section>`;

  const pageHtml = renderZukanCommonShell({
    lang,
    title: `${data.placeName} — ${isEn ? "Timeline & Share" : "定点と共有"}`,
    activeNav: "places",
    authenticated,
    displayName: session?.displayName ?? null,
    bodyHtml,
    pathname: `${prefix}/places/${encodedPlace}/timeline`,
  });

  return new Response(pageHtml, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": authenticated ? "private, no-store" : "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
