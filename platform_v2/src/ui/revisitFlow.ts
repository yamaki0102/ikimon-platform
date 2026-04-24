import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import type { LandingSnapshot } from "../services/readModels.js";
import { buildPlaceRecordHref, formatShortDate, pickPlaceFocus } from "./placeRevisit.js";
import { escapeHtml } from "./siteShell.js";

type RevisitCopy = {
  eyebrow: string;
  heading: string;
  lead: string;
  freshLabel: string;
  staleLabel: string;
  visitCountSuffix: (count: number) => string;
  daysAgo: (n: number) => string;
  todayLabel: string;
  yesterdayLabel: string;
  weeksAgo: (n: number) => string;
  monthsAgo: (n: number) => string;
  ariaLabel: string;
  firstVisitLabel: string;
  comparedOn: (date: string) => string;
  nextLook: (focus: string) => string;
  nextLookFallback: string;
  recordLabel: string;
};

const copyByLang: Record<SiteLang, RevisitCopy> = {
  ja: {
    eyebrow: "再訪の入口",
    heading: "前回の場所で、季節はもう動いている。",
    lead: "同じ場所を歩き直すたび、ノートは分厚くなる。最近歩いた場所と、しばらくぶりの場所を並べた。",
    freshLabel: "最近歩いた場所",
    staleLabel: "しばらくぶりの場所",
    visitCountSuffix: (count) => `${count} 回歩いた`,
    daysAgo: (n) => `${n} 日前`,
    todayLabel: "今日",
    yesterdayLabel: "きのう",
    weeksAgo: (n) => `${n} 週前`,
    monthsAgo: (n) => `${n} ヶ月前`,
    ariaLabel: "あなたの場所への再訪導線",
    firstVisitLabel: "この場所の最初のページ",
    comparedOn: (date) => `前回 ${date}`,
    nextLook: (focus) => `次は ${focus}`,
    nextLookFallback: "次の散歩で小さな変化を拾う",
    recordLabel: "ここで記録",
  },
  en: {
    eyebrow: "Reasons to revisit",
    heading: "The same places, with the season moved on.",
    lead: "Walking the same place again is what thickens the notebook. Recent places and ones you have not been to for a while.",
    freshLabel: "Recent places",
    staleLabel: "It has been a while",
    visitCountSuffix: (count) => `${count} visits`,
    daysAgo: (n) => `${n}d ago`,
    todayLabel: "Today",
    yesterdayLabel: "Yesterday",
    weeksAgo: (n) => `${n}w ago`,
    monthsAgo: (n) => `${n}mo ago`,
    ariaLabel: "Your places to revisit",
    firstVisitLabel: "First page for this place",
    comparedOn: (date) => `Last time ${date}`,
    nextLook: (focus) => `Next: ${focus}`,
    nextLookFallback: "Leave one small change next walk",
    recordLabel: "Record here",
  },
  es: {
    eyebrow: "Razones para volver",
    heading: "Los mismos lugares, con la estación en otro punto.",
    lead: "Volver al mismo lugar es lo que engrosa el cuaderno. Lugares recientes y otros donde no has estado por un tiempo.",
    freshLabel: "Lugares recientes",
    staleLabel: "Hace un tiempo",
    visitCountSuffix: (count) => `${count} visitas`,
    daysAgo: (n) => `hace ${n} d`,
    todayLabel: "Hoy",
    yesterdayLabel: "Ayer",
    weeksAgo: (n) => `hace ${n} sem`,
    monthsAgo: (n) => `hace ${n} m`,
    ariaLabel: "Tus lugares para revisitar",
    firstVisitLabel: "Primera página de este lugar",
    comparedOn: (date) => `Última vez ${date}`,
    nextLook: (focus) => `Próximo: ${focus}`,
    nextLookFallback: "Deja un cambio pequeño en la próxima caminata",
    recordLabel: "Registrar aquí",
  },
  "pt-BR": {
    eyebrow: "Motivos para voltar",
    heading: "Os mesmos lugares, com a estação adiante.",
    lead: "Voltar ao mesmo lugar é o que engrossa o caderno. Lugares recentes e outros onde você não vai há um tempo.",
    freshLabel: "Lugares recentes",
    staleLabel: "Faz um tempo",
    visitCountSuffix: (count) => `${count} visitas`,
    daysAgo: (n) => `${n}d atrás`,
    todayLabel: "Hoje",
    yesterdayLabel: "Ontem",
    weeksAgo: (n) => `${n}sem atrás`,
    monthsAgo: (n) => `${n}m atrás`,
    ariaLabel: "Seus lugares para revisitar",
    firstVisitLabel: "Primeira página deste lugar",
    comparedOn: (date) => `Última vez ${date}`,
    nextLook: (focus) => `Próximo: ${focus}`,
    nextLookFallback: "Registre uma pequena mudança na próxima caminhada",
    recordLabel: "Registrar aqui",
  },
};

function relativeLabel(copy: RevisitCopy, lastObservedAt: string, now: Date): string {
  const t = new Date(lastObservedAt);
  if (Number.isNaN(t.getTime())) return "";
  const diffMs = now.getTime() - t.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days <= 0) return copy.todayLabel;
  if (days === 1) return copy.yesterdayLabel;
  if (days < 14) return copy.daysAgo(days);
  if (days < 60) return copy.weeksAgo(Math.floor(days / 7));
  return copy.monthsAgo(Math.floor(days / 30));
}

export function renderRevisitFlow(
  basePath: string,
  lang: SiteLang,
  snapshot: LandingSnapshot,
  now: Date = new Date(),
): string {
  if (!snapshot.viewerUserId) return "";
  if (snapshot.myPlaces.length === 0) return "";

  const copy = copyByLang[lang];

  const annotated = snapshot.myPlaces
    .map((place) => {
      const t = new Date(place.lastObservedAt);
      const days = Number.isNaN(t.getTime())
        ? Number.MAX_SAFE_INTEGER
        : Math.floor((now.getTime() - t.getTime()) / 86_400_000);
      return { ...place, daysSinceLast: days };
    })
    .sort((a, b) => a.daysSinceLast - b.daysSinceLast);

  const fresh = annotated.filter((p) => p.daysSinceLast <= 14).slice(0, 3);
  const stale = annotated.filter((p) => p.daysSinceLast > 14).slice(0, 3);

  if (fresh.length === 0 && stale.length === 0) return "";

  const profileHrefBase = appendLangToHref(
    withBasePath(basePath, `/profile/${encodeURIComponent(snapshot.viewerUserId)}`),
    lang,
  );

  const renderBucket = (label: string, items: typeof annotated, modifier: string) => {
    if (items.length === 0) return "";
    return `<div class="rv-bucket rv-bucket-${modifier}">
      <div class="rv-bucket-label">${escapeHtml(label)}</div>
      <ul class="rv-list">
        ${items
          .map((place) => {
            const compareLabel = place.previousObservedAt
              ? copy.comparedOn(formatShortDate(place.previousObservedAt, lang === "ja" ? "ja-JP" : "en-US"))
              : copy.firstVisitLabel;
            const focus = pickPlaceFocus(place);
            const nextLabel = focus ? copy.nextLook(focus) : copy.nextLookFallback;
            const recordHref = buildPlaceRecordHref(basePath, lang, snapshot.viewerUserId, place);
            return `<li>
              <div class="rv-place" data-kpi-action="revisit:${modifier}">
                <span class="rv-place-main">
                  <a class="rv-place-profile" href="${escapeHtml(profileHrefBase)}">
                    <strong>${escapeHtml(place.placeName)}</strong>
                  </a>
                  <span class="rv-place-meta">${escapeHtml(place.municipality || "")}${place.municipality ? " · " : ""}${escapeHtml(copy.visitCountSuffix(place.visitCount))}</span>
                  <span class="rv-place-note">${escapeHtml(compareLabel)}</span>
                  <span class="rv-place-note">${escapeHtml(nextLabel)}</span>
                </span>
                <span class="rv-place-tail">
                  <span class="rv-place-since">${escapeHtml(relativeLabel(copy, place.lastObservedAt, now))}</span>
                  <a class="rv-place-cta" href="${escapeHtml(recordHref)}">${escapeHtml(copy.recordLabel)}</a>
                </span>
              </div>
            </li>`;
          })
          .join("")}
      </ul>
    </div>`;
  };

  return `<section class="section rv-section" aria-labelledby="rv-heading" aria-label="${escapeHtml(copy.ariaLabel)}">
    <div class="rv-head">
      <span class="rv-eyebrow">${escapeHtml(copy.eyebrow)}</span>
      <h2 id="rv-heading" class="rv-heading">${escapeHtml(copy.heading)}</h2>
      <p class="rv-lead">${escapeHtml(copy.lead)}</p>
    </div>
    <div class="rv-buckets">
      ${renderBucket(copy.freshLabel, fresh, "fresh")}
      ${renderBucket(copy.staleLabel, stale, "stale")}
    </div>
  </section>`;
}

export const REVISIT_FLOW_STYLES = `
  .rv-section { margin-top: 24px; }
  .rv-head { display: flex; flex-direction: column; gap: 6px; max-width: 60ch; }
  .rv-eyebrow {
    align-self: flex-start;
    padding: 4px 12px;
    border-radius: 999px;
    background: rgba(14,165,233,.1);
    color: #0369a1;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
  }
  .rv-heading {
    margin: 8px 0 0;
    font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif;
    font-size: clamp(20px, 2.4vw, 26px);
    line-height: 1.42;
    letter-spacing: -.01em;
    font-weight: 900;
    color: #0f172a;
  }
  .rv-lead { margin: 6px 0 0; color: #475569; font-size: 14px; line-height: 1.8; text-wrap: pretty; }
  .rv-buckets {
    margin-top: 18px;
    display: grid;
    gap: 14px;
    grid-template-columns: 1fr;
  }
  @media (min-width: 720px) {
    .rv-buckets { grid-template-columns: 1fr 1fr; }
  }
  .rv-bucket {
    padding: 18px 18px 14px;
    border-radius: 22px;
    background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
    border: 1px solid rgba(15,23,42,.06);
    box-shadow: 0 12px 26px rgba(15,23,42,.05);
  }
  .rv-bucket-fresh { border-left: 3px solid rgba(16,185,129,.55); }
  .rv-bucket-stale { border-left: 3px solid rgba(14,165,233,.55); }
  .rv-bucket-label {
    font-size: 11px;
    font-weight: 800;
    letter-spacing: .12em;
    text-transform: uppercase;
    color: #475569;
    margin-bottom: 10px;
  }
  .rv-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
  .rv-place {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding: 10px 12px;
    border-radius: 14px;
    color: inherit;
    transition: background .15s ease, border-color .15s ease;
    border: 1px solid transparent;
  }
  .rv-place:hover { background: rgba(15,23,42,.04); border-color: rgba(15,23,42,.06); }
  .rv-place-main { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .rv-place-profile { text-decoration: none; color: inherit; }
  .rv-place-main strong { font-size: 14px; font-weight: 800; color: #0f172a; letter-spacing: -.01em; }
  .rv-place-meta { font-size: 12px; color: #64748b; font-weight: 600; }
  .rv-place-note { font-size: 12px; color: #475569; line-height: 1.45; }
  .rv-place-tail { display: flex; flex-direction: column; gap: 8px; align-items: flex-end; flex-shrink: 0; }
  .rv-place-since {
    flex-shrink: 0;
    font-size: 12px;
    font-weight: 800;
    color: #475569;
    padding: 4px 10px;
    border-radius: 999px;
    background: rgba(15,23,42,.05);
    letter-spacing: -.01em;
  }
  .rv-place-cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 34px;
    padding: 0 12px;
    border-radius: 999px;
    background: #0f172a;
    color: #fff;
    text-decoration: none;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: -.01em;
  }
  .rv-bucket-stale .rv-place-since { background: rgba(14,165,233,.1); color: #0369a1; }
  .rv-bucket-fresh .rv-place-since { background: rgba(16,185,129,.12); color: #047857; }
  @media (max-width: 640px) {
    .rv-place { flex-direction: column; }
    .rv-place-tail { width: 100%; flex-direction: row; justify-content: space-between; align-items: center; }
  }
`;
