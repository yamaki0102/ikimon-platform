import { withBasePath } from "../httpBasePath.js";
import type { SiteLang } from "../i18n.js";
import { appendLangToHref } from "../i18n.js";
import { buildObservationDetailPath } from "../services/observationDetailLink.js";
import type { LandingObservation } from "../services/readModels.js";
import { toThumbnailUrl } from "../services/thumbnailUrl.js";
import { escapeHtml } from "./siteShell.js";

function formatObservedAt(raw: string, lang: SiteLang): string {
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  if (lang === "ja") return `${y}.${m}.${d} ${hh}:${mm}`;
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

type KindCopy = { badge: string; attribution: (observer: string) => string };

const kindCopy: Record<SiteLang, { observation: KindCopy; identification: KindCopy }> = {
  ja: {
    observation: { badge: "📷 観察", attribution: (o) => o },
    identification: { badge: "📝 同定", attribution: (o) => `${o} さんの観察` },
  },
  en: {
    observation: { badge: "📷 Observation", attribution: (o) => o },
    identification: { badge: "📝 Identification", attribution: (o) => `${o}'s observation` },
  },
  es: {
    observation: { badge: "📷 Observación", attribution: (o) => o },
    identification: { badge: "📝 Identificación", attribution: (o) => `Observación de ${o}` },
  },
  "pt-BR": {
    observation: { badge: "📷 Observação", attribution: (o) => o },
    identification: { badge: "📝 Identificação", attribution: (o) => `Observação de ${o}` },
  },
};

export function renderObservationCard(
  basePath: string,
  lang: SiteLang,
  obs: LandingObservation,
  options: { compact?: boolean; locationMode?: "public" | "owner" } = {},
): string {
  const entryType = obs.entryType ?? "observation";
  const kind = kindCopy[lang][entryType];
  const isIdentification = entryType === "identification";
  const detailHref = withBasePath(
    basePath,
    buildObservationDetailPath(obs.detailId ?? obs.visitId ?? obs.occurrenceId, obs.featuredOccurrenceId ?? obs.occurrenceId),
  );
  const profileHref = obs.observerUserId
    ? withBasePath(basePath, `/profile/${encodeURIComponent(obs.observerUserId)}`)
    : null;
  const avatar = obs.observerAvatarUrl
    ? `<img class="obs-card-avatar" src="${escapeHtml(obs.observerAvatarUrl)}" alt="" loading="lazy" />`
    : `<span class="obs-card-avatar is-placeholder">${escapeHtml((obs.observerName || "?").slice(0, 1))}</span>`;
  // Broken / missing photo fallback: hand-drawn-style sketch card that looks
  // intentional, not a broken <img>. onerror swaps in the sketch if the URL
  // returns 404 (e.g. when /uploads/ is not yet mounted).
  const sketchFallback = `<div class="obs-card-photo is-sketch" aria-hidden="true">
    <span class="obs-card-sketch-icon">${isIdentification ? "📝" : "📷"}</span>
    <span class="obs-card-sketch-name">${escapeHtml(obs.displayName)}</span>
    <span class="obs-card-sketch-note">${lang === "ja" ? "写真なし" : lang === "es" ? "Sin foto" : lang === "pt-BR" ? "Sem foto" : "No photo"}</span>
  </div>`;
  const photo = obs.photoUrl
    ? `<img class="obs-card-photo" src="${escapeHtml(toThumbnailUrl(obs.photoUrl, "md") ?? obs.photoUrl)}" alt="${escapeHtml(obs.displayName)}" loading="lazy" decoding="async" onerror="this.style.display='none';this.nextElementSibling?.classList.add('is-visible');" />${sketchFallback.replace('class="obs-card-photo is-sketch"', 'class="obs-card-photo is-sketch obs-card-photo-fallback"')}`
    : sketchFallback;
  const locationMode = options.locationMode ?? "public";
  const placeLine = locationMode === "owner"
    ? [obs.placeName, obs.municipality].filter(Boolean).join(" · ")
    : obs.publicLocation?.label || "位置をぼかしています";
  const timestamp = isIdentification ? (obs.identifiedAt ?? obs.observedAt) : obs.observedAt;
  const attribution = kind.attribution(obs.observerName || "");
  const multiBadge = obs.isMultiSubject
    ? `<span class="obs-card-multi">${lang === "ja" ? `複数対象 ${obs.subjectCount ?? ""}`.trim() : "Multi-subject"}</span>`
    : "";
  const focusMeta = obs.isMultiSubject
    ? `<div class="obs-card-focus">
         <span class="obs-card-focus-label">${lang === "ja" ? "有力対象" : "Featured"}</span>
         <strong>${escapeHtml(obs.featuredSubjectName ?? obs.displayName)}</strong>
         ${obs.displayStability
           ? `<span class="obs-card-stability is-${escapeHtml(obs.displayStability)}">${escapeHtml(
             obs.displayStability === "locked"
               ? (lang === "ja" ? "安定表示" : "Stable")
               : obs.displayStability === "adaptive"
                 ? (lang === "ja" ? "AI 既定" : "AI default")
                 : (lang === "ja" ? "既定表示" : "Default"),
           )}</span>`
           : ""}
       </div>`
    : "";

  const tier = obs.evidenceTier;
  const tierBadge = tier != null
    ? `<span class="obs-card-tier" title="Evidence Tier ${tier}">T${tier}</span>`
    : "";
  return `<article class="obs-card${options.compact ? " is-compact" : ""}${isIdentification ? " is-identification" : ""}" data-entry-type="${escapeHtml(entryType)}">
    <a class="obs-card-media" href="${escapeHtml(appendLangToHref(detailHref, lang))}" aria-label="${escapeHtml(obs.displayName)}">
      ${photo}
      <span class="obs-card-kind">${escapeHtml(kind.badge)}</span>
      ${multiBadge}
      ${tierBadge}
      <div class="obs-card-species">${escapeHtml(obs.displayName)}</div>
    </a>
    <div class="obs-card-meta">
      ${focusMeta}
      <div class="obs-card-who">
        ${profileHref ? `<a class="obs-card-observer" href="${escapeHtml(appendLangToHref(profileHref, lang))}">${avatar}<span>${escapeHtml(attribution)}</span></a>` : `<span class="obs-card-observer">${avatar}<span>${escapeHtml(attribution)}</span></span>`}
        <time class="obs-card-when">${escapeHtml(formatObservedAt(timestamp, lang))}</time>
      </div>
      <div class="obs-card-place">${escapeHtml(placeLine || "Unknown place")}</div>
    </div>
  </article>`;
}

export const OBSERVATION_CARD_STYLES = `
  .obs-card { display: flex; flex-direction: column; background: #fff; border: 1px solid rgba(15,23,42,.06); border-radius: 20px; overflow: hidden; box-shadow: 0 6px 18px rgba(15,23,42,.05); transition: transform .18s ease, box-shadow .18s ease; }
  .obs-card:hover { transform: translateY(-2px); box-shadow: 0 14px 28px rgba(15,23,42,.08); }
  .obs-card-media { position: relative; display: block; aspect-ratio: 1 / 1; background: linear-gradient(135deg,#ecfdf5,#e0f2fe); }
  .obs-card-photo { width: 100%; height: 100%; object-fit: cover; display: block; }
  .obs-card-photo.is-empty { width: 100%; height: 100%; display: grid; place-items: center; font-size: 38px; opacity: .5; }
  .obs-card-photo.is-sketch {
    width: 100%; height: 100%;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
    padding: 16px;
    background:
      repeating-linear-gradient(0deg, transparent 0 24px, rgba(15,23,42,.04) 24px 25px),
      linear-gradient(135deg, #fefce8 0%, #ecfdf5 60%, #e0f2fe 100%);
    color: #0f172a;
    text-align: center;
    position: relative;
  }
  .obs-card-photo.is-sketch::before {
    content: ""; position: absolute; inset: 10px;
    border: 1px dashed rgba(15,23,42,.18); border-radius: 10px;
    pointer-events: none;
  }
  .obs-card-sketch-icon { font-size: 28px; opacity: .68; }
  .obs-card-sketch-name { font-size: 13px; font-weight: 800; line-height: 1.3; max-width: 90%; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .obs-card-sketch-note { font-size: 10px; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; color: #94a3b8; }
  .obs-card-photo-fallback { display: none; }
  .obs-card-photo-fallback.is-visible { display: flex; }
  .obs-card-species { position: absolute; left: 10px; bottom: 10px; padding: 6px 12px; border-radius: 999px; background: rgba(15,23,42,.72); color: #fff; font-size: 12px; font-weight: 800; letter-spacing: -.01em; backdrop-filter: blur(6px); max-width: calc(100% - 20px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .obs-card-meta { padding: 12px 14px 14px; display: flex; flex-direction: column; gap: 6px; }
  .obs-card-who { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  .obs-card-observer { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; color: #0f172a; min-width: 0; }
  .obs-card-observer > span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 10ch; }
  .obs-card-avatar { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; background: #e2e8f0; display: inline-flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 800; color: #475569; flex-shrink: 0; }
  .obs-card-avatar.is-placeholder { background: linear-gradient(135deg,#d1fae5,#bae6fd); color: #065f46; }
  .obs-card-when { font-size: 11px; color: #64748b; letter-spacing: .02em; flex-shrink: 0; }
  .obs-card-place { font-size: 12px; color: #475569; line-height: 1.5; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .obs-card.is-compact .obs-card-media { aspect-ratio: 4 / 3; }
  .obs-card.is-compact .obs-card-meta { padding: 10px 12px 12px; }
  .obs-card-kind { position: absolute; left: 10px; top: 10px; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,.92); color: #0f172a; font-size: 11px; font-weight: 800; letter-spacing: .01em; box-shadow: 0 4px 10px rgba(15,23,42,.08); backdrop-filter: blur(6px); }
  .obs-card-multi { position: absolute; right: 10px; bottom: 46px; padding: 4px 10px; border-radius: 999px; background: rgba(2,132,199,.86); color: #fff; font-size: 10px; font-weight: 900; letter-spacing: .05em; backdrop-filter: blur(6px); }
  .obs-card-focus { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 11px; color: #0f172a; }
  .obs-card-focus-label { font-weight: 900; letter-spacing: .06em; text-transform: uppercase; color: #0369a1; }
  .obs-card-focus strong { font-size: 12px; }
  .obs-card-stability { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-weight: 800; background: rgba(15,23,42,.06); color: #334155; }
  .obs-card-stability.is-locked { background: rgba(16,185,129,.12); color: #047857; }
  .obs-card-stability.is-adaptive { background: rgba(59,130,246,.12); color: #1d4ed8; }
  .obs-card-tier { position: absolute; right: 10px; top: 10px; padding: 3px 8px; border-radius: 999px; background: rgba(15,23,42,.62); color: #fff; font-size: 10px; font-weight: 900; letter-spacing: .05em; backdrop-filter: blur(6px); }
  .obs-card.is-identification .obs-card-tier { background: rgba(14,165,233,.7); }
  .obs-card.is-identification { border-color: rgba(14,165,233,.26); box-shadow: 0 6px 18px rgba(14,165,233,.12); }
  .obs-card.is-identification .obs-card-kind { background: linear-gradient(135deg, rgba(224,242,254,.96), rgba(236,253,245,.96)); color: #0369a1; }
  .obs-card.is-identification .obs-card-species { background: rgba(14,165,233,.86); }
  .obs-card.is-identification .obs-card-photo.is-empty { background: linear-gradient(135deg, #e0f2fe, #f0fdf4); color: #0369a1; }
`;
