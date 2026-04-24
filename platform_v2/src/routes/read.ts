import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getShortCopy } from "../content/index.js";
import { JA_PUBLIC_SHARED_COPY } from "../copy/jaPublic.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { buildObservationDetailPath } from "../services/observationDetailLink.js";
import {
  getReviewerAccessContext,
  listRecentReviewerAuthorities,
  listReviewerAuthorityAudit,
  type ReviewerAuthority,
  type ReviewerAuthorityAuditAction,
  type ReviewerAuthorityAuditEntry,
  type ReviewerAuthorityEvidenceType,
} from "../services/reviewerAuthorities.js";
import {
  listAuthorityRecommendationsForUser,
  listPendingAuthorityRecommendationsForReviewer,
  type AuthorityRecommendation,
  type AuthorityRecommendationSourceKind,
  type AuthorityRecommendationStatus,
} from "../services/authorityRecommendations.js";
import { resolveViewer } from "../services/viewerIdentity.js";
import { getLandingSnapshot } from "../services/landingSnapshot.js";
import { toThumbnailUrl } from "../services/thumbnailUrl.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";
import { OBSERVATION_CARD_STYLES, renderObservationCard } from "../ui/observationCard.js";
import { getObservationContext, groupFeaturesByLayer } from "../services/observationContext.js";
import { getReactionSummary, type ReactionType } from "../services/observationReactions.js";
import { getObserverStats } from "../services/observerStats.js";
import { getTaxonInsight } from "../services/taxonInsights.js";
import { getSiteBrief, type SiteBrief } from "../services/siteBrief.js";
import { getObservationDetailHeavy, type SiblingSubject } from "../services/observationDetailHeavy.js";
import { confidenceLabel } from "../services/observationAiAssessment.js";
import { getObservationVisitBundle, type ObservationVisitBundle, type ObservationVisitSubject } from "../services/observationVisitBundle.js";
import { buildPublicMapCellHref } from "../services/publicLocation.js";
import {
  getExploreSnapshot,
  getHomeSnapshot,
  getObservationDetailSnapshot,
  getProfileSnapshot,
  getSpecialistSnapshot,
  type HomePlace,
} from "../services/readModels.js";
import {
  assertSpecialistAdminSession,
  assertSpecialistSession,
} from "../services/writeGuards.js";
import {
  MAP_MINI_STYLES,
  mapMiniBootScript,
  renderMapMini,
  toMapMiniCells,
} from "../ui/mapMini.js";
import {
  MAP_EXPLORER_STYLES,
  mapExplorerBootScript,
  renderMapExplorer,
} from "../ui/mapExplorer.js";
import {
  OBSERVATION_MEDIA_STYLES,
  OBSERVATION_REGION_SUMMARY_TEXT,
  REGION_DISPLAY_CONF_MIN,
  renderObservationMedia,
  toSubjectRegionMap,
} from "../ui/observationMedia.js";
import { GUIDE_FLOW_STYLES, renderGuideFlow } from "../ui/guideFlow.js";
import { buildPlaceRecordHref, formatShortDate, pickPlaceFocus } from "../ui/placeRevisit.js";

type LayoutHero = {
  eyebrow: string;
  heading: string;
  headingHtml?: string;
  lead: string;
  actions?: Array<{ href: string; label: string; variant?: "primary" | "secondary" }>;
};

type PublicSharedCopy = {
  cta: {
    record: string;
    openNotebook: string;
    openMap: string;
  };
  ai: {
    support: string;
  };
};

type PublicRouteCard = {
  eyebrow: string;
  title: string;
  body: string;
  meta?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

function layout(
  basePath: string,
  title: string,
  body: string,
  activeNav: string,
  hero?: LayoutHero,
  extraStyles?: string,
): string {
  return renderSiteDocument({
    basePath,
    title,
    activeNav,
    body,
    hero: hero
      ? {
          eyebrow: hero.eyebrow,
          heading: hero.heading,
          headingHtml: hero.headingHtml ?? hero.heading,
          lead: hero.lead,
          tone: "light",
          align: "center",
          actions: hero.actions,
        }
      : undefined,
    extraStyles,
    footerNote: "いつもの道で見つけた自然を、あとで見返せる形に残す。",
  });
}

function renderPublicRouteCardGrid(
  cards: PublicRouteCard[],
  basePath: string,
  lang: SiteLang,
  ctaClass: "btn btn-solid" | "inline-link",
): string {
  return `<div class="grid">${cards
    .map((card) => {
      const ctaHref = card.ctaHref ? appendLangToHref(withBasePath(basePath, card.ctaHref), lang) : "";
      const ctaHtml = card.ctaHref && card.ctaLabel
        ? `<div class="actions" style="margin-top:12px"><a class="${ctaClass}" href="${escapeHtml(ctaHref)}">${escapeHtml(card.ctaLabel)}</a></div>`
        : "";
      const metaHtml = card.meta ? `<p class="meta" style="margin-top:10px">${escapeHtml(card.meta)}</p>` : "";
      return `<div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(card.eyebrow)}</div><h2>${escapeHtml(card.title)}</h2><p>${escapeHtml(card.body)}</p>${metaHtml}${ctaHtml}</div></div>`;
    })
    .join("")}</div>`;
}

function rankLabelJa(rank: string): string {
  const table: Record<string, string> = {
    kingdom: "界",
    phylum: "門",
    class: "綱",
    order: "目",
    family: "科",
    subfamily: "亜科",
    tribe: "族",
    genus: "属",
    subgenus: "亜属",
    species_group: "種群",
    species: "種",
    subspecies: "亜種",
  };
  return table[rank.toLowerCase()] ?? rank;
}

function authorityEvidenceLabel(evidenceType: ReviewerAuthorityEvidenceType): string {
  switch (evidenceType) {
    case "field_event":
      return "観察会";
    case "webinar":
      return "ウェビナー";
    case "literature":
      return "論文・文献";
    case "reference_owned":
      return "図鑑・雑誌";
    default:
      return "その他";
  }
}

function renderAuthoritySummaryChips(authorities: Awaited<ReturnType<typeof getReviewerAccessContext>>["activeAuthorities"]): string {
  if (authorities.length === 0) {
    return `<div class="meta">まだ分類群スコープは付与されていません。</div>`;
  }

  return `<div class="actions">${authorities
    .map((authority) =>
      `<span class="pill">${escapeHtml(authority.scopeTaxonName)}${authority.scopeTaxonRank ? ` · ${escapeHtml(authority.scopeTaxonRank)}` : ""}</span>`,
    )
    .join("")}</div>`;
}

function renderAuthorityCards(authorities: ReviewerAuthority[]): string {
  if (authorities.length === 0) {
    return `<div class="row"><div>まだ authority はありません。</div></div>`;
  }

  return authorities
    .map((authority) => {
      const evidence = authority.evidence.length > 0
        ? authority.evidence.map((entry) =>
            `<li>${escapeHtml(authorityEvidenceLabel(entry.evidenceType))} · ${escapeHtml(entry.title)}${entry.issuerName ? ` <span class="meta">(${escapeHtml(entry.issuerName)})</span>` : ""}</li>`,
          ).join("")
        : `<li>根拠未登録</li>`;
      const statusLabel = authority.status === "active" ? "active" : "revoked";
      return `
        <div class="card is-soft">
          <div class="card-body stack">
            <div class="row">
              <div>
                <div style="font-weight:800">${escapeHtml(authority.scopeTaxonName)}</div>
                <div class="meta">${escapeHtml(authority.scopeTaxonRank || "rank未設定")} · ${escapeHtml(authority.subjectUserId)}</div>
              </div>
              <span class="pill">${escapeHtml(statusLabel)}</span>
            </div>
            <div class="meta">付与: ${escapeHtml(authority.grantedAt)} / 理由: ${escapeHtml(authority.reason || "未記載")}</div>
            <ul class="meta" style="margin:0;padding-left:18px">${evidence}</ul>
            <div class="actions">
              ${authority.status === "active"
                ? `<button class="btn secondary" type="button" data-revoke-authority="${escapeHtml(authority.authorityId)}">Revoke</button>`
                : ""}
              <button class="btn secondary" type="button" data-add-evidence="${escapeHtml(authority.authorityId)}">Add evidence</button>
            </div>
          </div>
        </div>`;
    })
    .join("");
}

function authorityRecommendationStatusLabel(status: AuthorityRecommendationStatus): string {
  switch (status) {
    case "pending":
      return "pending";
    case "granted":
      return "granted";
    case "rejected":
      return "rejected";
    case "revoked":
      return "revoked";
    default:
      return status;
  }
}

function authorityRecommendationSourceLabel(sourceKind: AuthorityRecommendationSourceKind): string {
  return sourceKind === "ops_registered" ? "運営登録" : "自己申告";
}

function renderAuthorityAuditCards(entries: ReviewerAuthorityAuditEntry[]): string {
  if (entries.length === 0) {
    return `<div class="row"><div>監査ログはまだありません。</div></div>`;
  }

  return entries
    .map((entry) => {
      const evidence = entry.evidence.length > 0
        ? entry.evidence.map((item) =>
            `<li>${escapeHtml(authorityEvidenceLabel(item.evidenceType))} · ${escapeHtml(item.title)}${item.issuerName ? ` <span class="meta">(${escapeHtml(item.issuerName)})</span>` : ""}</li>`,
          ).join("")
        : `<li>根拠未登録</li>`;
      return `
        <div class="card is-soft">
          <div class="card-body stack">
            <div class="row">
              <div>
                <div style="font-weight:800">${escapeHtml(entry.scopeTaxonName || "scope未設定")}</div>
                <div class="meta">${escapeHtml(entry.subjectDisplayName || entry.subjectUserId || "subject不明")} · ${escapeHtml(entry.action)}</div>
              </div>
              <span class="pill">${escapeHtml(entry.authorityStatus || "unknown")}</span>
            </div>
            <div class="meta">actor: ${escapeHtml(entry.actorDisplayName || entry.actorUserId || "system")} / created: ${escapeHtml(entry.createdAt)}</div>
            <ul class="meta" style="margin:0;padding-left:18px">${evidence}</ul>
            <details>
              <summary style="cursor:pointer;font-weight:700">payload</summary>
              <pre style="margin:12px 0 0;padding:12px;border-radius:14px;background:#0f172a;color:#e2e8f0;overflow:auto;font-size:12px;line-height:1.6">${escapeHtml(JSON.stringify(entry.payload, null, 2))}</pre>
            </details>
          </div>
        </div>`;
    })
    .join("");
}

function renderAuthorityRecommendationCards(
  recommendations: AuthorityRecommendation[],
  options: {
    currentUserId?: string | null;
    showGrantActions?: boolean;
    canReject?: boolean;
  } = {},
): string {
  if (recommendations.length === 0) {
    return `<div class="row"><div>recommendation はまだありません。</div></div>`;
  }

  return recommendations
    .map((recommendation) => {
      const evidence = recommendation.evidence.length > 0
        ? recommendation.evidence.map((entry) =>
            `<li>${escapeHtml(authorityEvidenceLabel(entry.evidenceType))} · ${escapeHtml(entry.title)}${entry.issuerName ? ` <span class="meta">(${escapeHtml(entry.issuerName)})</span>` : ""}</li>`,
          ).join("")
        : `<li>根拠未登録</li>`;
      const subjectLabel = recommendation.subjectDisplayName || recommendation.subjectUserId;
      const scopeLabel = `${recommendation.scopeTaxonName}${recommendation.scopeTaxonRank ? ` · ${recommendation.scopeTaxonRank}` : ""}`;
      const ownership = options.currentUserId && options.currentUserId === recommendation.subjectUserId ? "あなた" : subjectLabel;
      return `
        <div class="card is-soft">
          <div class="card-body stack">
            <div class="row">
              <div>
                <div style="font-weight:800">${escapeHtml(scopeLabel)}</div>
                <div class="meta">${escapeHtml(ownership || "user不明")} · ${escapeHtml(authorityRecommendationSourceLabel(recommendation.sourceKind))}</div>
              </div>
              <span class="pill">${escapeHtml(authorityRecommendationStatusLabel(recommendation.status))}</span>
            </div>
            <div class="meta">作成: ${escapeHtml(recommendation.createdAt)} / 推薦: ${escapeHtml(recommendation.recommendedByDisplayName || recommendation.recommendedByUserId || "未設定")}</div>
            ${recommendation.resolutionNote ? `<div class="meta">解決メモ: ${escapeHtml(recommendation.resolutionNote)}</div>` : ""}
            <ul class="meta" style="margin:0;padding-left:18px">${evidence}</ul>
            ${(options.showGrantActions || options.canReject) && recommendation.status === "pending"
              ? `<div class="actions">
                  ${options.showGrantActions ? `<button class="btn" type="button" data-grant-recommendation="${escapeHtml(recommendation.recommendationId)}">Grant</button>` : ""}
                  ${options.canReject ? `<button class="btn secondary" type="button" data-reject-recommendation="${escapeHtml(recommendation.recommendationId)}">Reject</button>` : ""}
                </div>`
              : ""}
          </div>
        </div>`;
    })
    .join("");
}

/** Small inline "state" card for 401 / 404 states — replaces the old dark-hero div. */
function seasonFromDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "不明";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "不明";
  const m = d.getMonth() + 1;
  if (m >= 3 && m <= 5) return "春";
  if (m >= 6 && m <= 8) return "夏";
  if (m >= 9 && m <= 11) return "秋";
  return "冬";
}

function formatAbsolute(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${y}.${mo}.${da} ${hh}:${mi}`;
}

const OBSERVATION_DETAIL_STYLES = `
  ${OBSERVATION_MEDIA_STYLES}
  .obs-hero { display: grid; grid-template-columns: 1fr; gap: 20px; margin-top: 18px; margin-bottom: 30px; }
  @media (min-width: 860px) {
    .obs-hero { grid-template-columns: minmax(0, 1.16fr) minmax(320px, .84fr); align-items: start; gap: 36px; }
  }
  .obs-hero-placeholder { aspect-ratio: 4/3; display: grid; place-items: center; text-align: center; font-weight: 800; color: #475569; background: repeating-linear-gradient(0deg, #f0fdf4 0 24px, #ecfdf5 24px 25px); border-radius: 20px; gap: 8px; }
  .obs-hero-placeholder span:first-child { font-size: 40px; }
  .obs-hero-meta { display: flex; flex-direction: column; gap: 15px; padding: 6px 4px 4px; align-self: start; }
  .obs-hero-title { margin: 0; max-width: 18ch; font-size: clamp(30px, 3.1vw, 42px); font-weight: 900; color: #0f172a; letter-spacing: -.02em; line-height: 1.16; }
  .obs-hero-byline { display: flex; flex-wrap: wrap; gap: 14px 18px; align-items: center; color: #475569; font-size: 13px; }
  .obs-hero-observer { display: inline-flex; align-items: center; gap: 8px; font-weight: 800; color: #0f172a; text-decoration: none; }
  .obs-hero-avatar { width: 32px; height: 32px; border-radius: 50%; background: #10b981; color: #fff; display: grid; place-items: center; font-weight: 900; font-size: 14px; flex-shrink: 0; overflow: hidden; }
  .obs-hero-avatar-img { background: transparent; object-fit: cover; }
  .obs-hero-when { font-weight: 700; }
  .obs-hero-place::before { content: "📍 "; }
  .obs-hero-badges { display: flex; flex-wrap: wrap; gap: 6px; }
  .obs-badge { display: inline-flex; align-items: center; gap: 4px; border-radius: 999px; padding: 5px 12px; font-size: 11.5px; font-weight: 800; background: rgba(16,185,129,.1); color: #047857; border: 1px solid rgba(16,185,129,.2); }
  .obs-badge-species { background: rgba(59,130,246,.08); color: #1d4ed8; border-color: rgba(59,130,246,.2); }
  .obs-badge-nearby { background: rgba(168,85,247,.08); color: #7e22ce; border-color: rgba(168,85,247,.2); }
  .obs-badge-video { background: rgba(15,23,42,.08); color: #0f172a; border-color: rgba(15,23,42,.16); }
  .obs-trust-ladder { display: grid; gap: 10px; padding: 0; border-radius: 16px; background: transparent; border: 0; box-shadow: none; }
  .obs-trust-summary { display: flex; align-items: center; justify-content: space-between; gap: 14px; min-height: 58px; padding: 12px 14px; border-radius: 14px; background: #fff; border: 1px solid rgba(15,23,42,.08); cursor: pointer; }
  .obs-trust-summary::-webkit-details-marker { display: none; }
  .obs-trust-summary::marker { content: ""; }
  .obs-trust-summary strong { display: block; margin-top: 2px; color: #0f172a; font-size: 14px; line-height: 1.45; }
  .obs-trust-toggle { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; min-height: 30px; padding: 5px 10px; border-radius: 999px; background: rgba(14,165,233,.1); color: #0369a1; font-size: 11px; font-weight: 900; }
  .obs-trust-ladder[open] .obs-trust-toggle { background: rgba(15,23,42,.08); color: #334155; }
  .obs-trust-lead { margin: 0; padding: 0 4px; font-size: 12.5px; line-height: 1.7; color: #475569; }
  .obs-trust-head { display: grid; gap: 4px; }
  .obs-trust-head strong { font-size: 15px; color: #0f172a; }
  .obs-trust-head p { margin: 0; font-size: 12.5px; line-height: 1.7; color: #475569; }
  .obs-trust-steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
  .obs-trust-step { display: grid; gap: 6px; padding: 10px 12px; border-radius: 14px; background: rgba(255,255,255,.72); border: 1px solid rgba(15,23,42,.08); }
  .obs-trust-step.is-reached { border-color: rgba(16,185,129,.24); background: linear-gradient(135deg, rgba(240,253,244,.96), rgba(255,255,255,.98)); }
  .obs-trust-step.is-current { box-shadow: inset 0 0 0 1px rgba(59,130,246,.2); }
  .obs-trust-step-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .obs-trust-step-label { font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; color: #0f172a; }
  .obs-trust-step-pill { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px; background: rgba(59,130,246,.12); color: #1d4ed8; font-size: 10px; font-weight: 900; }
  .obs-trust-step-meta { font-size: 11.5px; line-height: 1.6; color: #64748b; font-weight: 700; }
  .obs-reaction-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 0; }
  .obs-reaction { display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 7px 12px; border-radius: 999px; border: 1px solid rgba(15,23,42,.1); background: #fff; font-weight: 800; font-size: 12.5px; color: #334155; cursor: pointer; transition: transform .12s ease, background .2s ease; }
  .obs-reaction:hover { background: #f9fafb; transform: translateY(-1px); }
  .obs-reaction.is-reacted { background: rgba(16,185,129,.12); border-color: rgba(16,185,129,.3); color: #047857; }
  .obs-reaction-count { background: rgba(15,23,42,.06); padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 800; }
  .obs-reaction-label { display: none; }
  @media (min-width: 640px) { .obs-reaction-label { display: inline; } }
  .obs-support-panel { display: grid; gap: 14px; padding: 16px; border-radius: 18px; background: rgba(255,255,255,.76); border: 1px solid rgba(15,23,42,.07); box-shadow: 0 10px 26px rgba(15,23,42,.04); }
  .obs-support-actions { display: grid; gap: 10px; }
  .obs-support-title { margin: 0; font-size: 14px; font-weight: 900; color: #0f172a; }
  .obs-support-note { margin: 0; color: #64748b; font-size: 12px; line-height: 1.6; }
  .obs-focus { display: grid; gap: 12px; margin-top: 16px; padding: 16px; border-radius: 18px; background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(236,253,245,.92)); border: 1px solid rgba(16,185,129,.18); box-shadow: 0 10px 28px rgba(16,185,129,.08); }
  .obs-focus-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .obs-focus-title { margin: 0; font-size: 19px; font-weight: 900; color: #0f172a; line-height: 1.35; letter-spacing: -.01em; }
  .obs-focus-copy { margin: 6px 0 0; font-size: 13px; line-height: 1.7; color: #475569; }
  .obs-focus-pill { flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 999px; background: rgba(16,185,129,.12); color: #047857; font-size: 11px; font-weight: 900; letter-spacing: .08em; text-transform: uppercase; }
  .obs-focus-featured { display: flex; align-items: flex-start; justify-content: space-between; gap: 14px; padding: 14px 16px; border-radius: 16px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
  .obs-focus-role { font-size: 10.5px; font-weight: 900; letter-spacing: .12em; color: #64748b; text-transform: uppercase; }
  .obs-focus-name-row { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; margin-top: 6px; }
  .obs-focus-name { font-size: 24px; font-weight: 900; color: #0f172a; line-height: 1.2; letter-spacing: -.02em; }
  .obs-focus-rank { font-size: 12px; font-weight: 800; color: #64748b; }
  .obs-focus-meta { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
  .obs-focus-chip { display: inline-flex; align-items: center; gap: 5px; padding: 5px 10px; border-radius: 999px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); color: #334155; font-size: 11.5px; font-weight: 800; }
  .obs-focus-open { display: inline-flex; align-items: center; justify-content: center; padding: 10px 16px; border-radius: 999px; text-decoration: none; background: #111827; color: #fff; font-size: 12.5px; font-weight: 900; white-space: nowrap; box-shadow: 0 6px 18px rgba(15,23,42,.16); }
  .obs-focus-open:hover { background: #1f2937; }
  .obs-focus-open.is-current { background: rgba(16,185,129,.12); color: #047857; box-shadow: none; }
  .obs-focus-rail { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; }
  .obs-focus-card { display: flex; flex-direction: column; gap: 8px; padding: 13px 14px; border-radius: 14px; border: 1px solid rgba(15,23,42,.08); background: #fff; text-decoration: none; color: inherit; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
  .obs-focus-card:hover { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(15,23,42,.08); }
  .obs-focus-card.is-featured { border-color: rgba(16,185,129,.28); background: linear-gradient(135deg, #f0fdf4, #ffffff); }
  .obs-focus-card.is-current { box-shadow: inset 0 0 0 2px rgba(59,130,246,.16); border-color: rgba(59,130,246,.24); }
  .obs-focus-card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .obs-focus-card-role { font-size: 10px; font-weight: 900; letter-spacing: .12em; text-transform: uppercase; color: #64748b; }
  .obs-focus-card-state { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px; background: rgba(16,185,129,.12); color: #047857; font-size: 10px; font-weight: 900; }
  .obs-focus-card.is-current .obs-focus-card-state { background: rgba(59,130,246,.12); color: #1d4ed8; }
  .obs-focus-card-name { font-size: 15px; font-weight: 900; color: #0f172a; line-height: 1.35; }
  .obs-focus-card-meta { font-size: 11.5px; line-height: 1.6; color: #64748b; font-weight: 700; }
  .obs-layer-note { margin: 0 0 14px; padding: 12px 14px; border-radius: 12px; background: rgba(59,130,246,.07); border: 1px solid rgba(59,130,246,.14); color: #334155; font-size: 13px; line-height: 1.7; }
  @media (max-width: 720px) {
    .obs-focus-featured { flex-direction: column; }
    .obs-focus-open { width: 100%; }
    .obs-focus-rail { display: flex; overflow-x: auto; padding-bottom: 2px; scroll-snap-type: x proximity; }
    .obs-focus-card { min-width: 220px; scroll-snap-align: start; }
  }
  .obs-reassess-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-radius: 14px; background: linear-gradient(135deg, rgba(59,130,246,.08), rgba(16,185,129,.08)); border: 1px dashed rgba(59,130,246,.3); margin: 14px 0 0; }
  .obs-reassess-btn { appearance: none; border: 0; border-radius: 999px; padding: 10px 18px; background: #111827; color: #fff; font-weight: 800; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 14px rgba(15,23,42,.25); }
  .obs-reassess-btn:hover { background: #1f2937; }
  .obs-reassess-btn[disabled] { opacity: .6; cursor: progress; }
  .obs-reassess-hint { color: #475569; font-size: 12px; line-height: 1.4; }
  .obs-reassess-status { font-size: 12px; font-weight: 700; color: #047857; }
  .obs-reassess-status.is-error { color: #b91c1c; }

  .obs-layers-grid { display: grid; grid-template-columns: 1fr; gap: 18px; }
  @media (min-width: 960px) {
    .obs-layers-grid { grid-template-columns: 1fr 1fr; gap: 18px; align-items: start; }
    .obs-layers-grid > .obs-layer { margin: 0 !important; }
    /* 全幅 span (優先度 高 or 内容が横長): 名前と分類 / この生きものについて / 場所の物語 */
    .obs-layers-grid > .obs-layer-2,
    .obs-layers-grid > .obs-layer-6,
    .obs-layers-grid > .obs-layer-3 { grid-column: 1 / -1; }
  }
  .obs-layer { display: flex; flex-direction: column; gap: 14px; margin-bottom: 0; padding: 20px; border-radius: 18px; background: #fff; border: 1px solid rgba(15,23,42,.06); box-shadow: 0 1px 2px rgba(15,23,42,.03); }
  .obs-layer-title { margin: 0; font-size: 17px; font-weight: 900; color: #0f172a; letter-spacing: .01em; }
  .obs-story-block { padding: 14px 16px; background: #f9fafb; border-radius: 12px; border: 1px solid rgba(15,23,42,.05); }
  .obs-story-ai { background: linear-gradient(135deg, #ecfdf5, #f0fdf4); border-color: rgba(16,185,129,.15); }
  .obs-story-eyebrow { font-size: 11px; font-weight: 900; color: #64748b; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 6px; }
  .obs-story-block p { margin: 0 0 6px; color: #334155; font-size: 14px; line-height: 1.7; }
  .obs-ai-note { display: block; margin-top: 6px; color: #94a3b8; font-size: 11.5px; font-weight: 600; }

  .obs-footprint { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; }
  .obs-footprint-row { padding: 12px 14px; background: #fffbeb; border-radius: 12px; border: 1px solid rgba(245,158,11,.2); display: flex; flex-direction: column; align-items: flex-start; gap: 3px; }
  .obs-footprint-num { font-size: 22px; font-weight: 900; color: #b45309; letter-spacing: -.02em; }
  .obs-footprint-label { font-size: 11.5px; color: #78716c; font-weight: 700; }

  .obs-lineage { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 4px; padding: 10px 12px; background: #f1f5f9; border-radius: 10px; font-size: 12.5px; }
  .obs-lineage-item { display: inline-flex; flex-direction: column; gap: 1px; padding: 4px 10px; background: #fff; border-radius: 8px; border: 1px solid rgba(15,23,42,.08); font-weight: 800; color: #1e293b; }
  .obs-lineage-item small { font-size: 9px; color: #94a3b8; letter-spacing: .08em; }
  .obs-lineage-sep { color: #cbd5e1; font-weight: 700; }

  .obs-id-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 10px; }
  .obs-id-item { display: flex; gap: 12px; padding: 12px 14px; background: #f8fafc; border-radius: 12px; border: 1px solid rgba(15,23,42,.05); }
  .obs-id-avatar { width: 36px; height: 36px; border-radius: 50%; background: #3b82f6; color: #fff; display: grid; place-items: center; font-weight: 900; flex-shrink: 0; }
  .obs-id-body { flex: 1; min-width: 0; }
  .obs-id-line { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }
  .obs-id-name { font-size: 15px; font-weight: 900; color: #0f172a; }
  .obs-id-rank { background: rgba(59,130,246,.1); color: #1d4ed8; font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 999px; }
  .obs-id-accepted { background: rgba(16,185,129,.14); color: #047857; font-size: 10.5px; font-weight: 800; padding: 2px 7px; border-radius: 999px; border: 1px solid rgba(16,185,129,.3); }
  .obs-id-meta { font-size: 11.5px; color: #64748b; font-weight: 700; margin-top: 3px; }
  .obs-id-note { margin: 6px 0 0; color: #475569; font-size: 13px; line-height: 1.6; }
  .obs-empty { color: #94a3b8; font-size: 13.5px; text-align: center; padding: 16px; background: #f9fafb; border-radius: 12px; border: 1px dashed rgba(15,23,42,.1); }

  /* ADR-0004: 主種 + 共生種グリッド */
  .obs-subjects { display: flex; flex-direction: column; gap: 8px; padding: 4px 0 8px; }
  .obs-subjects-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px; }
  .obs-subject-card { padding: 12px; border-radius: 12px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); display: flex; flex-direction: column; gap: 4px; }
  .obs-subject-card.is-primary { background: linear-gradient(135deg, #ecfdf5, #f0fdf4); border-color: rgba(16,185,129,.25); }
  .obs-subject-role { font-size: 10.5px; font-weight: 900; letter-spacing: .1em; color: #64748b; text-transform: uppercase; }
  .obs-subject-card.is-primary .obs-subject-role { color: #047857; }
  .obs-subject-name { font-size: 14.5px; font-weight: 900; color: #0f172a; line-height: 1.3; }
  .obs-subject-rank { font-size: 11.5px; color: #64748b; font-weight: 700; }
  .obs-subject-conf { font-size: 11px; font-weight: 800; color: #16a34a; }

  .obs-peers { margin: 0; padding: 10px 14px; background: rgba(168,85,247,.06); border-radius: 10px; font-size: 13px; color: #6b21a8; border: 1px solid rgba(168,85,247,.15); }
  .obs-nearby-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
  .obs-nearby-card { display: flex; flex-direction: column; border-radius: 12px; background: #fff; border: 1px solid rgba(15,23,42,.08); overflow: hidden; text-decoration: none; color: inherit; transition: transform .15s ease; }
  .obs-nearby-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(15,23,42,.06); }
  .obs-nearby-card img { width: 100%; aspect-ratio: 4/3; object-fit: cover; }
  .obs-nearby-nophoto { aspect-ratio: 4/3; display: grid; place-items: center; background: #f1f5f9; color: #94a3b8; font-size: 24px; }
  .obs-nearby-body { padding: 8px 10px; }
  .obs-nearby-name { font-weight: 800; font-size: 12.5px; color: #0f172a; margin-bottom: 2px; }
  .obs-nearby-meta { font-size: 10.5px; color: #94a3b8; font-weight: 700; }

  .obs-seasonal-wrap { padding: 10px 12px; background: #fffbeb; border-radius: 10px; }
  .obs-seasonal { display: grid; grid-template-columns: repeat(12, 1fr); gap: 3px; align-items: end; height: 60px; margin-top: 6px; }
  .obs-seasonal-bar { height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 2px; font-size: 9px; color: #b45309; font-weight: 700; }
  .obs-seasonal-bar::before { content: ""; display: block; width: 100%; height: var(--h, 0%); background: linear-gradient(180deg, #f59e0b, #fbbf24); border-radius: 3px 3px 0 0; min-height: 2px; }

  .obs-cta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; }
  .obs-cta-item { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 16px 12px; border-radius: 14px; background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 1px solid rgba(16,185,129,.15); text-decoration: none; color: #064e3b; font-weight: 800; transition: transform .15s ease; }
  .obs-cta-item:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(16,185,129,.12); }
  .obs-cta-icon { font-size: 26px; }
  .obs-cta-label { font-size: 13px; text-align: center; }

  .obs-insight-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
  .obs-insight-item { padding: 14px 16px; background: #f8fafc; border-radius: 12px; border: 1px solid rgba(15,23,42,.05); }
  .obs-insight-eye { font-size: 11px; font-weight: 900; color: #64748b; letter-spacing: .12em; margin-bottom: 6px; }
  .obs-insight-item p { margin: 0; font-size: 13.5px; line-height: 1.7; color: #334155; }

  /* 観察のヒント (Layer 1 先頭・全幅・必ずユーザー目に入る上段) */
  .obs-hint-section { display: flex; flex-direction: column; gap: 14px; padding: 22px 22px; margin-bottom: 24px; border-radius: 18px; border: 1px solid rgba(16,185,129,.18); background: linear-gradient(180deg, #f0fdf4, #ecfdf5); }
  .obs-hint-section.is-medium { border-color: rgba(245,158,11,.22); background: linear-gradient(180deg, #fffbeb, #fef9c3); }
  .obs-hint-section.is-low, .obs-hint-section.is-tent { border-color: rgba(239,68,68,.18); background: linear-gradient(180deg, #fef2f2, #fff1f2); }
  .obs-hint-head { display: flex; align-items: flex-start; gap: 12px; justify-content: space-between; }
  .obs-hint-eyebrow { margin: 0 0 4px; font-size: 10.5px; font-weight: 900; letter-spacing: .16em; color: #64748b; text-transform: uppercase; }
  .obs-hint-title { margin: 0; font-size: 17px; font-weight: 900; color: #0f172a; line-height: 1.45; }
  .obs-hint-badge { flex-shrink: 0; padding: 5px 12px; border-radius: 999px; font-size: 11.5px; font-weight: 900; background: rgba(16,185,129,.15); color: #065f46; border: 1px solid rgba(16,185,129,.3); white-space: nowrap; }
  .obs-hint-section.is-medium .obs-hint-badge { background: rgba(245,158,11,.15); color: #92400e; border-color: rgba(245,158,11,.3); }
  .obs-hint-section.is-low .obs-hint-badge, .obs-hint-section.is-tent .obs-hint-badge { background: rgba(239,68,68,.1); color: #991b1b; border-color: rgba(239,68,68,.25); }
  .obs-hint-rec { display: inline-flex; align-items: baseline; gap: 10px; padding: 10px 14px; background: #fff; border-radius: 12px; border: 1px solid rgba(15,23,42,.08); align-self: flex-start; }
  .obs-hint-rec-name { font-size: 18px; font-weight: 900; color: #0f172a; }
  .obs-hint-rec-rank { font-size: 12px; font-weight: 700; color: #64748b; }
  .obs-hint-best { margin: 0; font-size: 13.5px; color: #334155; padding: 10px 14px; background: rgba(255,255,255,.7); border-radius: 10px; border: 1px dashed rgba(15,23,42,.12); }
  .obs-hint-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
  .obs-hint-sub { padding: 12px 14px; background: #fff; border-radius: 12px; border: 1px solid rgba(15,23,42,.06); }
  .obs-hint-sub.obs-hint-boost { background: linear-gradient(135deg, #ecfdf5, #f0fdf4); border-color: rgba(16,185,129,.2); }
  .obs-hint-eye { font-size: 10.5px; font-weight: 900; letter-spacing: .14em; color: #64748b; text-transform: uppercase; margin-bottom: 6px; }
  .obs-hint-eye-note { margin-left: 6px; text-transform: none; letter-spacing: 0; font-weight: 700; color: #94a3b8; font-size: 10px; }
  .obs-hint-eye-small { font-size: 10px; font-weight: 800; color: #94a3b8; letter-spacing: .12em; text-transform: uppercase; margin-bottom: 4px; }
  .obs-hint-sub p, .obs-hint-fun p { margin: 0; font-size: 13.5px; line-height: 1.7; color: #334155; }
  .obs-hint-tags { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
  .obs-hint-tags li { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; background: #fff; border: 1px solid rgba(15,23,42,.1); border-radius: 999px; font-size: 12px; font-weight: 700; color: #0f172a; }
  .obs-hint-tags li small { color: #94a3b8; font-size: 10.5px; font-weight: 600; }
  .obs-hint-fun { padding: 12px 14px; background: rgba(99,102,241,.08); border-radius: 12px; border: 1px solid rgba(99,102,241,.18); }
  .obs-hint-similar { padding: 14px 16px; background: rgba(236,72,153,.06); border-radius: 12px; border: 1px solid rgba(236,72,153,.15); display: flex; flex-direction: column; gap: 8px; }
  .obs-hint-inner { margin-top: 4px; }
  .obs-hint-bul { margin: 0; padding-left: 16px; color: #334155; font-size: 13px; line-height: 1.7; }
  .obs-hint-bul li { margin-bottom: 2px; }
  .obs-hint-reminder { margin: 6px 0 0; font-size: 11px; color: #94a3b8; }
  .obs-hint-foot { margin: 4px 0 0; font-size: 11.5px; color: #94a3b8; text-align: right; font-style: italic; }
  .obs-hint-tags.is-muted li { background: rgba(148,163,184,.1); border-color: rgba(148,163,184,.28); color: #475569; font-weight: 600; }
  .obs-hint-missing .obs-hint-eye { color: #64748b; }
  .obs-hint-eye-note { font-weight: 700; font-size: 10px; color: #94a3b8; margin-left: 4px; padding: 1px 6px; border-radius: 999px; background: rgba(148,163,184,.12); }
  .obs-hint-badge-candidate { background: rgba(14,165,233,.12) !important; color: #0369a1 !important; border-color: rgba(14,165,233,.28) !important; }

  .obs-area-card { margin-top: 14px; padding: 16px 18px; border-radius: 16px; background: linear-gradient(135deg, rgba(240,253,244,.7), rgba(239,246,255,.7)); border: 1px solid rgba(14,165,233,.18); display: flex; flex-direction: column; gap: 12px; }
  .obs-area-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .obs-area-head .obs-hint-reminder { margin: 4px 0 0; color: #475569; }
  .obs-area-groups { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
  .obs-area-group { padding: 10px 12px; background: rgba(255,255,255,.65); border-radius: 12px; border: 1px solid rgba(14,165,233,.12); }
  .obs-area-eye { font-size: 11.5px; font-weight: 900; color: #0f172a; letter-spacing: .02em; margin-bottom: 6px; }
  .obs-area-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 6px; }
  .obs-area-item { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; font-size: 12.5px; color: #334155; line-height: 1.5; }
  .obs-area-label { font-weight: 800; color: #0f172a; }
  .obs-area-why { color: #64748b; font-size: 11.5px; }
  .obs-area-conf { padding: 1px 7px; border-radius: 999px; font-size: 10px; font-weight: 900; letter-spacing: .03em; flex-shrink: 0; }
  .obs-area-conf-high { background: rgba(16,185,129,.15); color: #065f46; }
  .obs-area-conf-medium { background: rgba(245,158,11,.15); color: #92400e; }
  .obs-area-conf-low { background: rgba(148,163,184,.18); color: #475569; }
  .obs-area-brief { display: flex; align-items: center; gap: 12px; padding: 10px 14px; border-radius: 12px; background: rgba(255,255,255,.78); border: 1px solid rgba(14,165,233,.2); margin-bottom: 4px; }
  .obs-area-brief.is-match { background: rgba(209,250,229,.9); border-color: rgba(16,185,129,.3); }
  .obs-area-brief.is-near { background: rgba(254,252,232,.9); border-color: rgba(234,179,8,.28); }
  .obs-area-brief.is-divergent { background: rgba(254,242,242,.9); border-color: rgba(239,68,68,.28); }
  .obs-area-brief-icon { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 50%; background: rgba(15,23,42,.08); color: #0f172a; font-size: 15px; font-weight: 900; flex-shrink: 0; }
  .obs-area-brief.is-match .obs-area-brief-icon { background: rgba(16,185,129,.18); color: #065f46; }
  .obs-area-brief.is-near .obs-area-brief-icon { background: rgba(234,179,8,.22); color: #713f12; }
  .obs-area-brief.is-divergent .obs-area-brief-icon { background: rgba(239,68,68,.18); color: #991b1b; }
  .obs-area-brief-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .obs-area-brief-eye { font-size: 10.5px; font-weight: 900; color: #475569; letter-spacing: .04em; text-transform: uppercase; }
  .obs-area-brief-label { font-size: 13.5px; font-weight: 800; color: #0f172a; }
  .obs-area-brief-status { font-size: 11px; font-weight: 900; color: #475569; letter-spacing: .03em; padding: 3px 9px; border-radius: 999px; background: rgba(15,23,42,.06); flex-shrink: 0; }
  .obs-area-brief.is-match .obs-area-brief-status { background: rgba(16,185,129,.2); color: #065f46; }
  .obs-area-brief.is-near .obs-area-brief-status { background: rgba(234,179,8,.22); color: #713f12; }
  .obs-area-brief.is-divergent .obs-area-brief-status { background: rgba(239,68,68,.16); color: #991b1b; }

  .obs-shot-card { margin-top: 14px; padding: 16px 18px; border-radius: 16px; background: linear-gradient(135deg, rgba(254,252,232,.85), rgba(255,237,213,.6)); border: 1px solid rgba(234,179,8,.24); display: flex; flex-direction: column; gap: 10px; }
  .obs-shot-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .obs-shot-head .obs-hint-reminder { margin: 4px 0 0; color: #713f12; }
  .obs-shot-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; }
  .obs-shot-item { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; padding: 10px 12px; background: rgba(255,255,255,.86); border-radius: 12px; border: 1px solid rgba(234,179,8,.2); }
  .obs-shot-role { display: inline-flex; align-items: center; gap: 6px; font-weight: 900; font-size: 12.5px; color: #422006; min-width: 140px; }
  .obs-shot-icon { font-size: 14px; }
  .obs-shot-target { font-weight: 700; color: #0f172a; font-size: 13px; }
  .obs-shot-rationale { color: #64748b; font-size: 11.5px; flex-grow: 1; min-width: 140px; }
  .obs-shot-pri { padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 900; letter-spacing: .04em; flex-shrink: 0; }
  .obs-shot-pri-high { background: rgba(239,68,68,.12); color: #991b1b; }
  .obs-shot-pri-medium { background: rgba(234,179,8,.18); color: #713f12; }
  .obs-role-cov { margin-bottom: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.78); border: 1px solid rgba(234,179,8,.22); display: flex; flex-direction: column; gap: 8px; }
  .obs-role-cov-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .obs-role-cov-eye { font-size: 11.5px; font-weight: 900; color: #713f12; letter-spacing: .04em; text-transform: uppercase; }
  .obs-role-cov-count { font-size: 11.5px; font-weight: 800; color: #64748b; }
  .obs-role-cov-count.is-met { color: #065f46; background: rgba(16,185,129,.14); padding: 2px 9px; border-radius: 999px; }
  .obs-role-cov-bar { position: relative; height: 6px; border-radius: 999px; background: rgba(234,179,8,.15); overflow: hidden; }
  .obs-role-cov-bar span { position: absolute; left: 0; top: 0; bottom: 0; background: linear-gradient(90deg, #f59e0b, #10b981); transition: width .3s ease; }
  .obs-role-cov-chips { display: flex; flex-wrap: wrap; gap: 4px; }
  .obs-role-chip { display: inline-flex; align-items: center; padding: 3px 8px; border-radius: 999px; background: rgba(148,163,184,.15); color: #64748b; font-size: 10.5px; font-weight: 700; letter-spacing: .02em; }
  .obs-role-chip.is-covered { background: rgba(16,185,129,.16); color: #065f46; font-weight: 900; }

  .obs-fold { border-radius: 12px; background: #f9fafb; border: 1px solid rgba(15,23,42,.08); overflow: hidden; margin-bottom: 8px; }
  .obs-fold > summary { padding: 12px 16px; font-weight: 800; color: #111827; cursor: pointer; list-style: none; display: flex; align-items: center; gap: 10px; font-size: 13.5px; }
  .obs-fold > summary::after { content: "+"; color: #9ca3af; font-size: 16px; margin-left: auto; }
  .obs-fold[open] > summary::after { content: "−"; }
  .obs-fold-count { background: rgba(15,23,42,.08); color: #475569; font-size: 10.5px; font-weight: 700; padding: 1px 8px; border-radius: 999px; }
  .obs-chips { padding: 0 16px 14px; margin: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
  .obs-chip { display: inline-flex; align-items: center; gap: 5px; background: #fff; border: 1px solid rgba(15,23,42,.1); border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 700; color: #111827; }
  .obs-chip-conf { color: #16a34a; font-weight: 800; font-size: 10.5px; }
  .obs-chip-src { font-size: 11px; }
`;

function stateCard(eyebrow: string, title: string, body: string): string {
  return `<section class="section">
    <div class="card is-soft">
      <div class="eyebrow">${escapeHtml(eyebrow)}</div>
      <h2 style="margin-top:8px">${escapeHtml(title)}</h2>
      <p style="margin-top:8px;color:#475569;line-height:1.7">${body}</p>
    </div>
  </section>`;
}

type RankedSubject = SiblingSubject & {
  focusScore: number;
  focusReason: string;
  roleLabel: string;
};

function subjectSpecificityScore(rank: string | null): number {
  switch ((rank ?? "").toLowerCase()) {
    case "species":
      return 70;
    case "subspecies":
      return 62;
    case "genus":
      return 48;
    case "family":
      return 30;
    case "order":
      return 20;
    case "class":
      return 12;
    case "lifeform":
      return 8;
    default:
      return 10;
  }
}

function subjectRoleLabel(subject: SiblingSubject): string {
  if (subject.roleHint === "alt_candidate") return "別候補";
  if (subject.roleHint === "vegetation") return "植生";
  if (subject.isPrimary) return "最初に拾われた対象";
  return "同じ観察の別対象";
}

function subjectPriorityScore(subject: SiblingSubject, currentOccurrenceId: string): number {
  let score = 0;

  if (subject.identificationCount > 0) {
    score += 260 + Math.min(subject.identificationCount, 6) * 55;
  }

  if (typeof subject.confidence === "number") {
    score += Math.round(subject.confidence * 70);
  }

  switch (subject.latestAssessmentBand) {
    case "high":
      score += 95;
      break;
    case "medium":
      score += 58;
      break;
    case "low":
      score += 28;
      break;
    case "unknown":
      score += 8;
      break;
    default:
      break;
  }

  score += subjectSpecificityScore(subject.rank);

  if (subject.roleHint === "alt_candidate") {
    score -= 45;
  } else if (subject.roleHint === "vegetation") {
    score -= 18;
  } else if (subject.isPrimary) {
    score += 6;
  }

  if (subject.occurrenceId === currentOccurrenceId) {
    score += 4;
  }

  return score;
}

function subjectFocusReason(subject: SiblingSubject): string {
  if (subject.identificationCount > 0) {
    return `コミュニティ同定が ${subject.identificationCount} 件集まっている対象`;
  }
  if (subject.latestAssessmentBand === "high") {
    return "AI が写真からかなり有力と見ている対象";
  }
  if (typeof subject.confidence === "number" && subject.confidence >= 0.75) {
    return "写真由来の確率が高く、先に見たほうが理解しやすい対象";
  }
  if (subject.roleHint === "vegetation") {
    return "背景ではなく環境手がかりとして読むと意味が出る対象";
  }
  if (subject.roleHint === "alt_candidate") {
    return "同じ被写体を別の分類で見るための候補";
  }
  if (subject.isPrimary) {
    return "最初の対象として保存されている";
  }
  return "同じ観察に写っている別対象";
}

function rankSiblingSubjects(subjects: SiblingSubject[], currentOccurrenceId: string): RankedSubject[] {
  return subjects
    .map((subject) => ({
      ...subject,
      focusScore: subjectPriorityScore(subject, currentOccurrenceId),
      focusReason: subjectFocusReason(subject),
      roleLabel: subjectRoleLabel(subject),
    }))
    .sort((a, b) => {
      if (b.focusScore !== a.focusScore) return b.focusScore - a.focusScore;
      if (b.identificationCount !== a.identificationCount) return b.identificationCount - a.identificationCount;
      const specificityDelta = subjectSpecificityScore(b.rank) - subjectSpecificityScore(a.rank);
      if (specificityDelta !== 0) return specificityDelta;
      const bIsCurrent = b.occurrenceId === currentOccurrenceId ? 1 : 0;
      const aIsCurrent = a.occurrenceId === currentOccurrenceId ? 1 : 0;
      if (bIsCurrent !== aIsCurrent) return bIsCurrent - aIsCurrent;
      if (Number(b.isPrimary) !== Number(a.isPrimary)) return Number(b.isPrimary) - Number(a.isPrimary);
      return a.subjectIndex - b.subjectIndex;
    });
}

function renderReactionBar(
  reactions: Awaited<ReturnType<typeof getReactionSummary>> | null,
  viewerUserId: string | null,
  occurrenceId: string,
): string {
  const reactionMeta: Record<ReactionType, { icon: string; label: string }> = {
    like: { icon: "💚", label: "いいね" },
    helpful: { icon: "✨", label: "参考になった" },
    curious: { icon: "🧭", label: "興味あり" },
    thanks: { icon: "🙏", label: "ありがとう" },
  };
  return reactions
    ? `<div class="obs-reaction-bar" data-occurrence-id="${escapeHtml(occurrenceId)}">
         ${(["like", "helpful", "curious", "thanks"] as ReactionType[])
           .map((type) => `
             <button type="button" class="obs-reaction${reactions.viewerReacted[type] ? " is-reacted" : ""}"
                     data-reaction-type="${type}"
                     ${viewerUserId ? "" : 'data-login-required="1"'}>
               <span>${reactionMeta[type].icon}</span>
               <span class="obs-reaction-label">${reactionMeta[type].label}</span>
               <span class="obs-reaction-count">${reactions.counts[type]}</span>
             </button>`)
           .join("")}
       </div>`
    : "";
}

function renderSubjectHint(
  subject: ObservationVisitSubject,
  siteBrief: SiteBrief | null = null,
  photoAssets: { roleTag: string | null }[] | null = null,
): string {
  const aiAssessment = subject.aiAssessment;
  if (!aiAssessment) {
    return `<section class="section obs-hint-section is-tent">
      <div class="obs-hint-head">
        <div>
          <p class="obs-hint-eyebrow">いっしょに絞るためのメモ</p>
          <h2 class="obs-hint-title">${escapeHtml(subject.displayName)} にはまだ AI 参考情報がありません</h2>
        </div>
        <span class="obs-hint-badge">様子見</span>
      </div>
      <p class="obs-hint-foot">この対象は human / specialist の同定を待っています。別候補は下の折りたたみから確認できます。</p>
    </section>`;
  }

  const band = aiAssessment.confidenceBand;
  const bandClass = band === "high" ? "is-high" : band === "medium" ? "is-medium" : band === "low" ? "is-low" : "is-tent";
  const bandLabel = confidenceLabel(band);
  const headline = aiAssessment.simpleSummary || aiAssessment.narrative || "";
  const rec = aiAssessment.recommendedTaxonName
    ? `<div class="obs-hint-rec"><span class="obs-hint-rec-name">${escapeHtml(aiAssessment.recommendedTaxonName)}</span>${aiAssessment.recommendedRank ? `<span class="obs-hint-rec-rank">${escapeHtml(aiAssessment.recommendedRank)}まで</span>` : ""}</div>`
    : "";
  const best = aiAssessment.bestSpecificTaxonName && aiAssessment.bestSpecificTaxonName !== aiAssessment.recommendedTaxonName
    ? `<p class="obs-hint-best">候補の中では <strong>${escapeHtml(aiAssessment.bestSpecificTaxonName)}</strong> が有力</p>`
    : "";
  const clues = aiAssessment.diagnosticFeaturesSeen.length > 0
    ? `<div class="obs-hint-sub"><div class="obs-hint-eye">写真から拾えている手がかり</div><ul class="obs-hint-tags">${aiAssessment.diagnosticFeaturesSeen.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul></div>`
    : "";
  const missingPhoto = aiAssessment.missingEvidence.length > 0
    ? `<div class="obs-hint-sub obs-hint-missing"><div class="obs-hint-eye">この写真からは読み取れないもの <span class="obs-hint-eye-note">AI参考</span></div><ul class="obs-hint-tags is-muted">${aiAssessment.missingEvidence.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`
    : "";
  const stop = aiAssessment.stopReason
    ? `<div class="obs-hint-sub"><div class="obs-hint-eye">ここで止めておく理由</div><p>${escapeHtml(aiAssessment.stopReason)}</p></div>`
    : "";
  const placeSeason = (aiAssessment.geographicContext || aiAssessment.seasonalContext)
    ? `<div class="obs-hint-sub"><div class="obs-hint-eye">場所と季節のヒント</div>${aiAssessment.geographicContext ? `<p>📍 ${escapeHtml(aiAssessment.geographicContext)}</p>` : ""}${aiAssessment.seasonalContext ? `<p>🗓 ${escapeHtml(aiAssessment.seasonalContext)}</p>` : ""}</div>`
    : "";
  const areaInference = renderAreaInferenceCard(aiAssessment.areaInference, siteBrief);
  const shotSuggestions = renderShotSuggestionsCard(aiAssessment.shotSuggestions, photoAssets);
  const boost = aiAssessment.observerBoost
    ? `<div class="obs-hint-sub obs-hint-boost"><div class="obs-hint-eye">この観察ですでに助かるところ</div><p>${escapeHtml(aiAssessment.observerBoost)}</p></div>`
    : "";
  const nextStep = aiAssessment.nextStepText
    ? `<div class="obs-hint-sub"><div class="obs-hint-eye">次にあると絞りやすいもの</div><p>${escapeHtml(aiAssessment.nextStepText)}</p></div>`
    : "";
  const funFact = aiAssessment.funFact
    ? `<div class="obs-hint-fun"><div class="obs-hint-eye">ちょっとした豆知識</div><p>${escapeHtml(aiAssessment.funFact)}</p></div>`
    : "";
  const similar = aiAssessment.similarTaxa.length > 0 || aiAssessment.distinguishingTips.length > 0 || aiAssessment.confirmMore.length > 0
    ? `<div class="obs-hint-similar">
         <div class="obs-hint-eye">紛らわしい種 <span class="obs-hint-eye-note">AI参考</span></div>
         ${aiAssessment.similarTaxa.length > 0 ? `<ul class="obs-hint-tags">${aiAssessment.similarTaxa.map((taxon) => `<li>${escapeHtml(taxon.name)}${taxon.rank ? ` <small>(${escapeHtml(taxon.rank)})</small>` : ""}</li>`).join("")}</ul>` : ""}
         ${aiAssessment.distinguishingTips.length > 0 ? `<div class="obs-hint-inner"><div class="obs-hint-eye-small">見分け方のポイント</div><ul class="obs-hint-bul">${aiAssessment.distinguishingTips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}</ul></div>` : ""}
         ${aiAssessment.confirmMore.length > 0 ? `<div class="obs-hint-inner"><div class="obs-hint-eye-small">さらに確認するなら</div><ul class="obs-hint-bul">${aiAssessment.confirmMore.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}</ul></div>` : ""}
         <p class="obs-hint-reminder">※ AI による参考情報です。確証を得るには実物の観察や図鑑の確認をおすすめします。</p>
       </div>`
    : "";
  const runMeta = aiAssessment.pipelineVersion || aiAssessment.taxonomyVersion
    ? `<p class="obs-hint-foot">run: ${escapeHtml(aiAssessment.pipelineVersion ?? "unknown")} / taxonomy: ${escapeHtml(aiAssessment.taxonomyVersion ?? "unknown")}</p>`
    : `<p class="obs-hint-foot">このメモは観察を次につなぐための参考情報です。コミュニティ同定の票には入りません。</p>`;
  return `<section class="section obs-hint-section ${bandClass}">
    <div class="obs-hint-head">
      <div>
        <p class="obs-hint-eyebrow">いっしょに絞るためのメモ</p>
        <h2 class="obs-hint-title">${escapeHtml(headline || "観察のヒント")}</h2>
      </div>
      <span class="obs-hint-badge">${escapeHtml(bandLabel)}</span>
    </div>
    ${rec}${best}
    <div class="obs-hint-grid">${clues}${missingPhoto}${stop}${placeSeason}${boost}${nextStep}</div>
    ${areaInference}
    ${shotSuggestions}
    ${funFact}
    ${similar}
    ${runMeta}
  </section>`;
}

const AREA_INFERENCE_LABELS: Array<{
  key: keyof import("../services/observationAiAssessment.js").AreaInference;
  label: string;
  icon: string;
}> = [
  { key: "vegetationStructureCandidates", label: "植生構造", icon: "🌳" },
  { key: "successionStageCandidates", label: "遷移段階", icon: "🌱" },
  { key: "humanInfluenceCandidates", label: "人為影響", icon: "🏘️" },
  { key: "moistureRegimeCandidates", label: "水分環境", icon: "💧" },
  { key: "managementHintCandidates", label: "管理履歴", icon: "🪚" },
];

function siteBriefAgreement(siteBrief: SiteBrief | null, candidates: { label: string }[]): "match" | "near" | "divergent" | "none" {
  if (!siteBrief || candidates.length === 0) return "none";
  const brief = siteBrief.hypothesis.label.toLowerCase();
  for (const cand of candidates) {
    const label = cand.label.toLowerCase();
    if (brief.includes(label) || label.includes(brief)) return "match";
  }
  // 近縁: どちらも 森/林 / 草/草地 / 水/湿 / 田/畑 の同群なら near
  const groups: Array<[string, string[]]> = [
    ["forest", ["森", "林", "樹", "木", "森林"]],
    ["grass", ["草", "草地", "草原", "草本"]],
    ["wet", ["水", "湿", "湿地", "湿原", "沼", "池"]],
    ["crop", ["畑", "農", "田", "耕", "作地"]],
    ["urban", ["市街", "住宅", "公園", "道路", "人為"]],
  ];
  const groupOf = (s: string): string | null => {
    for (const [g, ks] of groups) if (ks.some((k) => s.includes(k))) return g;
    return null;
  };
  const briefGroup = groupOf(brief);
  if (briefGroup) {
    for (const cand of candidates) {
      if (groupOf(cand.label.toLowerCase()) === briefGroup) return "near";
    }
  }
  return "divergent";
}

function renderAreaInferenceCard(
  areaInference: import("../services/observationAiAssessment.js").AreaInference | null | undefined,
  siteBrief: SiteBrief | null = null,
): string {
  if (!areaInference) return "";
  const hasAny = AREA_INFERENCE_LABELS.some(({ key }) => (areaInference[key] ?? []).length > 0);
  const hasSiteBrief = Boolean(siteBrief && siteBrief.hypothesis.label);
  if (!hasAny && !hasSiteBrief) return "";
  const confLabel = (confidence: number | null): string => {
    if (confidence === null) return "";
    if (confidence >= 0.7) return "high";
    if (confidence >= 0.4) return "medium";
    return "low";
  };
  // siteBrief を「地点情報(決定論)」として植生構造カードにバッジ表示
  const vegCands = areaInference.vegetationStructureCandidates ?? [];
  const briefAgreement = siteBriefAgreement(siteBrief, vegCands);
  const briefBanner = hasSiteBrief
    ? (() => {
        const icon =
          briefAgreement === "match" ? "✓" :
          briefAgreement === "near" ? "≈" :
          briefAgreement === "divergent" ? "⚡" : "📍";
        const tone =
          briefAgreement === "match" ? "is-match" :
          briefAgreement === "near" ? "is-near" :
          briefAgreement === "divergent" ? "is-divergent" : "is-info";
        const label =
          briefAgreement === "match" ? "画像推察と一致" :
          briefAgreement === "near" ? "画像推察と近い" :
          briefAgreement === "divergent" ? "画像からは違う候補も" : "参考";
        return `<div class="obs-area-brief ${tone}">
          <span class="obs-area-brief-icon">${icon}</span>
          <div class="obs-area-brief-body">
            <div class="obs-area-brief-eye">地図データから見た場所 <span class="obs-hint-eye-note">決定論</span></div>
            <div class="obs-area-brief-label">${escapeHtml(siteBrief!.hypothesis.label)}</div>
          </div>
          <span class="obs-area-brief-status">${escapeHtml(label)}</span>
        </div>`;
      })()
    : "";
  const groups = AREA_INFERENCE_LABELS
    .map(({ key, label, icon }) => {
      const candidates = areaInference[key] ?? [];
      if (candidates.length === 0) return "";
      return `<div class="obs-area-group">
        <div class="obs-area-eye">${icon} ${escapeHtml(label)}</div>
        <ul class="obs-area-list">
          ${candidates.map((cand) => {
            const band = confLabel(cand.confidence);
            return `<li class="obs-area-item${band ? ` is-${band}` : ""}">
              <span class="obs-area-label">${escapeHtml(cand.label)}</span>
              ${cand.why ? `<span class="obs-area-why">${escapeHtml(cand.why)}</span>` : ""}
              ${band ? `<span class="obs-area-conf obs-area-conf-${band}">${band === "high" ? "可能性高" : band === "medium" ? "可能性中" : "可能性低"}</span>` : ""}
            </li>`;
          }).join("")}
        </ul>
      </div>`;
    })
    .filter(Boolean)
    .join("");
  return `<section class="obs-area-card" aria-label="この1枚からのエリア推察">
    <div class="obs-area-head">
      <div>
        <div class="obs-hint-eyebrow">この 1 枚からのエリア推察</div>
        <p class="obs-hint-reminder">AI が写真から読み取った候補です。**断定ではありません**。地図由来の地点情報と突き合わせてください。</p>
      </div>
      <span class="obs-hint-badge obs-hint-badge-candidate">参考</span>
    </div>
    ${briefBanner}
    ${hasAny ? `<div class="obs-area-groups">${groups}</div>` : ""}
  </section>`;
}

const SHOT_ROLE_META: Record<string, { icon: string; label: string }> = {
  full_body: { icon: "🖼", label: "全景 / 全身" },
  close_up_organ: { icon: "🔍", label: "部位クローズアップ" },
  habitat_wide: { icon: "🌄", label: "生息環境の広角" },
  substrate: { icon: "🪨", label: "基質 / 止まっている物" },
  scale_reference: { icon: "📏", label: "スケール参照" },
};

const SHOT_ROLE_ORDER: Array<{ key: string; label: string; icon: string }> = [
  { key: "full_body", label: "全景/全身", icon: "🖼" },
  { key: "close_up_organ", label: "部位アップ", icon: "🔍" },
  { key: "habitat_wide", label: "生息環境", icon: "🌄" },
  { key: "substrate", label: "基質", icon: "🪨" },
  { key: "scale_reference", label: "スケール", icon: "📏" },
];

function renderRoleCoverageStrip(photoAssets: { roleTag: string | null }[] | null | undefined): string {
  if (!photoAssets || photoAssets.length === 0) return "";
  const covered = new Set<string>();
  for (const p of photoAssets) if (p.roleTag && p.roleTag !== "unknown") covered.add(p.roleTag);
  const chips = SHOT_ROLE_ORDER.map(({ key, label, icon }) => {
    const hit = covered.has(key);
    return `<span class="obs-role-chip${hit ? " is-covered" : ""}" title="${escapeHtml(label)}">${icon} ${escapeHtml(label)}${hit ? " ✓" : ""}</span>`;
  }).join("");
  const hitCount = covered.size;
  const threshold = 3;
  const pct = Math.min(100, Math.round((hitCount / SHOT_ROLE_ORDER.length) * 100));
  const pastThreshold = hitCount >= threshold;
  return `<div class="obs-role-cov">
    <div class="obs-role-cov-head">
      <div class="obs-role-cov-eye">組写真カバレッジ</div>
      <div class="obs-role-cov-count ${pastThreshold ? "is-met" : ""}">${hitCount} / ${SHOT_ROLE_ORDER.length} role${pastThreshold ? " · Tier 1.5 条件OK" : ""}</div>
    </div>
    <div class="obs-role-cov-bar"><span style="width:${pct}%"></span></div>
    <div class="obs-role-cov-chips">${chips}</div>
  </div>`;
}

function renderShotSuggestionsCard(
  shotSuggestions: import("../services/observationAiAssessment.js").ShotSuggestion[] | null | undefined,
  photoAssets: { roleTag: string | null }[] | null | undefined = null,
): string {
  const hasSuggestions = shotSuggestions && shotSuggestions.length > 0;
  const coverageStrip = renderRoleCoverageStrip(photoAssets);
  if (!hasSuggestions && !coverageStrip) return "";
  const items = hasSuggestions ? (shotSuggestions as import("../services/observationAiAssessment.js").ShotSuggestion[]).map((suggestion) => {
    const meta = SHOT_ROLE_META[suggestion.role] ?? { icon: "📸", label: suggestion.role };
    const priorityBadge = suggestion.priority === "high"
      ? `<span class="obs-shot-pri obs-shot-pri-high">必須級</span>`
      : `<span class="obs-shot-pri obs-shot-pri-medium">余裕があれば</span>`;
    return `<li class="obs-shot-item">
      <span class="obs-shot-role"><span class="obs-shot-icon">${meta.icon}</span>${escapeHtml(meta.label)}</span>
      <span class="obs-shot-target">${escapeHtml(suggestion.target)}</span>
      ${suggestion.rationale ? `<span class="obs-shot-rationale">${escapeHtml(suggestion.rationale)}</span>` : ""}
      ${priorityBadge}
    </li>`;
  }).join("") : "";
  return `<section class="obs-shot-card" aria-label="追撮すると研究価値が上がる写真">
    <div class="obs-shot-head">
      <div>
        <div class="obs-hint-eyebrow">こういう写真も撮ると研究的意義が上がる</div>
        <p class="obs-hint-reminder">写真が揃うと、AI 同定の精度とコミュニティ検証のやりやすさが上がります。</p>
      </div>
    </div>
    ${coverageStrip}
    ${items ? `<ul class="obs-shot-list">${items}</ul>` : ""}
  </section>`;
}

function renderSubjectComparison(bundle: ObservationVisitBundle, subject: ObservationVisitSubject): string {
  if (!bundle.selectedRun && !bundle.previousRun) {
    return "";
  }
  const current = subject.aiAssessment;
  const previous = subject.previousAiAssessment;
  const currentText = current
    ? `${current.recommendedTaxonName ?? subject.displayName} / ${confidenceLabel(current.confidenceBand)}`
    : "この run では未評価";
  const previousText = previous
    ? `${previous.recommendedTaxonName ?? subject.displayName} / ${confidenceLabel(previous.confidenceBand)}`
    : "比較用の前 run なし";
  return `<details class="obs-fold">
    <summary>🤖 AI の変化を見る <span class="obs-fold-count">${escapeHtml(bundle.selectedRun?.modelName ?? "run")}</span></summary>
    <div class="obs-hint-sub">
      <div class="obs-hint-eye">現在の解釈</div>
      <p>${escapeHtml(currentText)}</p>
      ${bundle.selectedRun ? `<p class="obs-hint-foot">run: ${escapeHtml(bundle.selectedRun.modelName)} / ${escapeHtml(bundle.selectedRun.generatedAt)}</p>` : ""}
    </div>
    <div class="obs-hint-sub">
      <div class="obs-hint-eye">ひとつ前の解釈</div>
      <p>${escapeHtml(previousText)}</p>
      ${bundle.previousRun ? `<p class="obs-hint-foot">run: ${escapeHtml(bundle.previousRun.modelName)} / ${escapeHtml(bundle.previousRun.generatedAt)}</p>` : ""}
    </div>
  </details>`;
}

function renderAiCandidates(bundle: ObservationVisitBundle): string {
  if (bundle.aiCandidates.length === 0) {
    return "";
  }
  return `<details class="obs-fold">
    <summary>🧪 AI が新しく見つけた候補 <span class="obs-fold-count">${bundle.aiCandidates.length}</span></summary>
    <div class="obs-nearby-grid">
      ${bundle.aiCandidates.map((candidate) => `
        <div class="obs-nearby-card">
          <div class="obs-nearby-body">
            <div class="obs-nearby-name">${escapeHtml(candidate.displayName)}</div>
            <div class="obs-nearby-meta">${escapeHtml([
              candidate.rank,
              typeof candidate.confidence === "number" ? `${Math.round(candidate.confidence * 100)}%` : null,
              candidate.candidateStatus === "matched" && candidate.suggestedOccurrenceId ? "既存対象に対応" : "未採用候補",
            ].filter(Boolean).join(" · "))}</div>
            ${candidate.note ? `<p class="obs-id-note">${escapeHtml(candidate.note)}</p>` : ""}
          </div>
        </div>`).join("")}
    </div>
  </details>`;
}

function renderSubjectTaxonomy(
  subject: ObservationVisitSubject,
  featuredSubject: ObservationVisitSubject | null,
  subjectCount: number,
  bundle: ObservationVisitBundle,
): string {
  const lineageChips = subject.lineage.length > 0
    ? `<div class="obs-lineage">
         ${subject.lineage.map((lineage) => `<span class="obs-lineage-item"><small>${escapeHtml(lineage.rank)}</small>${escapeHtml(lineage.name)}</span>`).join('<span class="obs-lineage-sep">›</span>')}
       </div>`
    : "";
  const layer2Title = subjectCount >= 2 ? "今見ている対象の名前と分類" : "名前と分類";
  const layer2Note = featuredSubject && subject.occurrenceId !== featuredSubject.occurrenceId
    ? `<p class="obs-layer-note">いまは <strong>${escapeHtml(subject.displayName)}</strong> の詳細を表示しています。既定では <strong>${escapeHtml(featuredSubject.displayName)}</strong> が前面ですが、上のレールからすぐ切り替えられます。</p>`
    : bundle.lockedByHuman
      ? `<p class="obs-layer-note">この観察の既定表示は human / specialist の判断を優先して固定しています。</p>`
      : "";
  const idsList = subject.identifications.length > 0
    ? `<ul class="obs-id-list">
         ${subject.identifications.map((item) => `
           <li class="obs-id-item">
             <div class="obs-id-avatar">${escapeHtml((item.actorName || "?").slice(0, 1))}</div>
             <div class="obs-id-body">
               <div class="obs-id-line">
                 <span class="obs-id-name">${escapeHtml(item.proposedName)}</span>
                 ${item.proposedRank ? `<span class="obs-id-rank">${escapeHtml(item.proposedRank)}</span>` : ""}
                 ${item.acceptedRank ? `<span class="obs-id-accepted">✓ ${escapeHtml(rankLabelJa(item.acceptedRank))}で確定</span>` : ""}
               </div>
               <div class="obs-id-meta">${escapeHtml(item.actorName)} · ${escapeHtml(item.createdAt)}</div>
               ${item.notes ? `<p class="obs-id-note">${escapeHtml(item.notes)}</p>` : ""}
             </div>
           </li>`).join("")}
       </ul>`
    : `<p class="obs-empty">まだ名前は確定していません。最初の提案者になれます。</p>`;
  return `
    <section class="section obs-layer obs-layer-2">
      <h2 class="obs-layer-title">${layer2Title}</h2>
      ${layer2Note}
      ${lineageChips}
      ${idsList}
      ${renderSubjectComparison(bundle, subject)}
      ${renderAiCandidates(bundle)}
      <p class="obs-ai-note">🤖 AI は履歴つきの参考情報として保持し、人の同定や専門家レビューが入ると表示の主役はそちらを優先します。</p>
    </section>`;
}

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function buildPlaceCompareLine(place: Pick<HomePlace, "previousObservedAt">): string {
  return place.previousObservedAt
    ? `前回 ${formatShortDate(place.previousObservedAt, "ja-JP")}`
    : "この場所の最初の1件です。";
}

function buildPlaceNextLine(place: Pick<HomePlace, "nextLookFor" | "revisitReason" | "latestDisplayName">): string {
  const focus = pickPlaceFocus(place);
  return focus
    ? `次は ${focus}`
    : "次の散歩で小さな変化を1件残す";
}

function renderPlaceRows(
  basePath: string,
  lang: SiteLang,
  viewerUserId: string | null | undefined,
  places: HomePlace[],
  emptyMessage: string,
): string {
  if (places.length === 0) {
    return `<div class="row"><div>${escapeHtml(emptyMessage)}</div></div>`;
  }

  return places.map((place) => {
    const recordHref = viewerUserId
      ? buildPlaceRecordHref(basePath, lang, viewerUserId, place)
      : null;
    return `<div class="row row-place-revisit">
      <div>
        <div style="font-weight:800">${escapeHtml(place.placeName)}</div>
        <div class="meta">${escapeHtml(place.municipality || "自治体不明")} · ${place.visitCount} 回</div>
        <div class="meta">${escapeHtml(buildPlaceCompareLine(place))}</div>
        <div class="meta">${escapeHtml(buildPlaceNextLine(place))}</div>
      </div>
      <div class="row-place-actions">
        <span class="pill">${escapeHtml(formatShortDate(place.lastObservedAt, "ja-JP") || place.lastObservedAt)}</span>
        ${recordHref ? `<a class="btn btn-ghost" href="${escapeHtml(recordHref)}">ここで記録</a>` : ""}
      </div>
    </div>`;
  }).join("");
}

const PLACE_REVISIT_ROW_STYLES = `
  .row-place-revisit {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }
  .row-place-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: flex-end;
    flex-shrink: 0;
  }
  @media (max-width: 640px) {
    .row-place-revisit { flex-direction: column; }
    .row-place-actions { width: 100%; flex-direction: row; justify-content: space-between; align-items: center; }
  }
`;

export async function registerReadRoutes(app: FastifyInstance): Promise<void> {
  app.get("/record", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const recordPageCopy = getShortCopy<any>(lang, "public", "read.record");
    const session = await getSessionFromCookie(request.headers.cookie);
    const resolution = resolveViewer(request.query, session);
    const viewerUserId = resolution.viewerUserId ?? "";
    const queryUserId = resolution.queryOverrideHonored ? resolution.requestedUserId : "";
    if (!viewerUserId) {
      reply.code(401).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Session required",
        stateCard(
          "Session required",
          "記録するにはサインインが必要です",
          `<p style="margin:0 0 12px">ログイン済みのセッションがまだありません。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ戻る</a>
            <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/faq"))}">サインイン方法</a>
          </div>
          ${process.env.ALLOW_QUERY_USER_ID === "1" ? `<p class="meta" style="margin-top:16px;font-size:12px;color:#94a3b8">staging QA: <code>${escapeHtml(withBasePath(basePath, "/record?userId=..."))}</code></p>` : ""}`,
        ),
        "Record",
      );
    }

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      recordPageCopy.title,
      `<section class="record-page">
        <div class="record-shell">
          <section class="record-card record-sheet">
            <div class="record-card-head">
              <div>
                <div class="eyebrow" id="record-mode-eyebrow">ふだんの記録</div>
                <h2>見つけたことを、その場で残す</h2>
                <p class="meta" id="record-mode-lead">場所・時間・気づいたことを、まず 1 件残すための画面です。名前が分からなくても始められます。</p>
              </div>
              <div class="record-session-pill">
                <span class="record-session-label">ログイン中</span>
                <strong>${escapeHtml(viewerUserId)}</strong>
              </div>
            </div>
            <form id="record-form" data-user-id="${escapeHtml(viewerUserId)}" class="record-form">
              <div class="record-field record-field-wide record-mode-switch">
                <span class="record-label">記録モード</span>
                <div class="record-mode-grid" role="group" aria-label="記録モード">
                  <button type="button" class="record-mode-chip is-active" data-record-mode="quick">
                    <strong>ふだんの記録</strong>
                    <span>いつもの散歩で見つけたことを残す</span>
                  </button>
                  <button type="button" class="record-mode-chip" data-record-mode="survey">
                    <strong>しっかり記録</strong>
                    <span>比べたい観察の条件も一緒に残す</span>
                  </button>
                </div>
                <input type="hidden" name="recordMode" value="quick" />
              </div>
              <label class="record-field record-field-wide"><span class="record-label">観察した日時</span><input id="observedAt" name="observedAt" type="datetime-local" required /></label>
              <div class="record-field record-field-wide record-gps-row">
                <span class="record-label">現在地</span>
                <button type="button" class="btn btn-ghost record-gps-btn" onclick="navigator.geolocation.getCurrentPosition(function(p){document.querySelector('[name=latitude]').value=p.coords.latitude.toFixed(6);document.querySelector('[name=longitude]').value=p.coords.longitude.toFixed(6);},function(){alert('位置情報の取得に失敗しました。手動で入力してください。')})">現在地を自動取得</button>
                <div class="record-gps-inputs">
                  <label class="record-field"><span class="record-label">緯度</span><input name="latitude" type="number" step="0.000001" placeholder="自動取得 or 手入力" required /></label>
                  <label class="record-field"><span class="record-label">経度</span><input name="longitude" type="number" step="0.000001" placeholder="自動取得 or 手入力" required /></label>
                </div>
              </div>
              <label class="record-field"><span class="record-label">市区町村</span><input name="municipality" type="text" placeholder="例: 浜松市" /></label>
              <label class="record-field record-field-wide"><span class="record-label">場所のメモ</span><input name="localityNote" type="text" placeholder="例: 公園の入口付近 / 水辺の柵のそば" /></label>
              <label class="record-field"><span class="record-label">生きもの名（分かれば）</span><input name="scientificName" type="text" placeholder="例: スズメ / Passer montanus" /></label>
              <label class="record-field"><span class="record-label">和名 / 通称</span><input name="vernacularName" type="text" placeholder="例: スズメ" /></label>
              <label class="record-field"><span class="record-label">確信度</span><input name="rank" type="text" value="species" placeholder="species / genus / family" /></label>
              <div class="record-field record-field-wide record-quick-fields" data-quick-only>
                <div class="record-survey-box record-quick-box">
                  <div class="record-survey-head">
                    <div>
                      <span class="record-label">あとで見返すためのメモ</span>
                      <p class="record-help">見つけた / 見なかった / まだ分からない を軽く残すと、次の散歩で比べやすくなります。</p>
                    </div>
                    <span class="record-survey-pill">再訪用</span>
                  </div>
                  <div class="record-survey-grid">
                    <label class="record-field">
                      <span class="record-label">今回の残し方</span>
                      <select name="quickCaptureState">
                        <option value="present">見つけて書く</option>
                        <option value="unknown">まだ分からないまま残す</option>
                        <option value="no_detection_note">今日は見なかったメモを残す</option>
                      </select>
                    </label>
                    <label class="record-field record-field-wide">
                      <span class="record-label">次に探すもの</span>
                      <input name="nextLookFor" type="text" placeholder="例: 先週いた水辺の鳥 / 名前を確かめたい葉 / 同じ木の花" />
                    </label>
                  </div>
                  <div class="record-survey-caution">
                    <strong>「今日は見なかった」は今日のメモです。</strong>
                    <span>この 1 回だけで不在を言い切るためには使いません。次に探す軸として残します。</span>
                  </div>
                </div>
              </div>
              <div class="record-field record-field-wide record-survey-fields" data-survey-only hidden>
                <div class="record-survey-box">
                  <div class="record-survey-head">
                    <div>
                      <span class="record-label">比べるための記録</span>
                      <p class="record-help">同じ場所を見比べたいときの追加入力です。ふだんの記録とは分けて残します。</p>
                    </div>
                    <span class="record-survey-pill">比較用</span>
                  </div>
                  <div class="record-survey-grid">
                    <label class="record-field">
                      <span class="record-label">どこまで見たか</span>
                      <select name="checklistCompletion" data-survey-required disabled>
                        <option value="complete">ひと通り見た</option>
                        <option value="partial">気になるものだけ見た</option>
                      </select>
                    </label>
                    <label class="record-field">
                      <span class="record-label">何を見たかったか</span>
                      <input name="targetTaxaScope" type="text" placeholder="例: 水辺の鳥 / 春のチョウ / 公園の花" data-survey-required disabled />
                    </label>
                    <label class="record-field">
                      <span class="record-label">見た時間（分）</span>
                      <input name="effortMinutes" type="number" min="1" step="1" placeholder="20" data-survey-required disabled />
                    </label>
                    <label class="record-field">
                      <span class="record-label">今回の結果</span>
                      <select name="surveyResult" disabled>
                        <option value="detected">見つけて記録した</option>
                        <option value="no_detection_note">見つからなかったメモだけ残す</option>
                      </select>
                    </label>
                    <label class="record-field record-field-wide">
                      <span class="record-label">また見に行きたい理由</span>
                      <textarea name="revisitReason" rows="3" placeholder="例: 先月と比べたい / 同じ水路の変化を見たい" data-survey-required disabled></textarea>
                    </label>
                  </div>
                  <div class="record-survey-caution">
                    <strong>未観測と不在は別です。</strong>
                    <span>「見つからなかった」はメモとして残しますが、「いない」と言い切る材料には使いません。</span>
                  </div>
                </div>
              </div>
              <label class="record-field record-field-wide record-photo-field"><span class="record-label">写真 / 動画</span><input id="record-media" name="media" type="file" accept="image/*,video/*" /><span class="record-help">写真か動画を 1 つ選択できます。動画は 200MB / 60秒まで対応します。</span></label>
              <div id="record-video-progress" class="record-video-progress" hidden aria-live="polite">
                <div class="record-video-progress-head">
                  <strong>動画アップロード進捗</strong>
                  <button type="button" id="record-video-cancel" class="btn btn-ghost" disabled>キャンセル</button>
                </div>
                <progress id="record-video-progressbar" max="100" value="0" aria-label="動画アップロード進捗"></progress>
                <div class="record-video-progress-meta">
                  <span id="record-video-progress-label">0%</span>
                  <span id="record-video-progress-bytes">0 MB / 0 MB</span>
                </div>
                <div id="record-video-live" class="record-video-live" aria-live="polite">動画を選ぶと進捗を表示します。</div>
              </div>
              <div class="record-actions">
                <button class="btn btn-solid" type="submit">${JA_PUBLIC_SHARED_COPY.cta.record}</button>
                <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/notes"))}">${JA_PUBLIC_SHARED_COPY.cta.openNotebook}</a>
              </div>
            </form>
          </section>
          <aside class="record-sidebar">
            <section class="record-card record-preview-card">
              <div class="eyebrow">記録の見え方</div>
              <h2>あとで見返すと、こう残る</h2>
              <div class="record-preview">
                <div class="record-preview-topline">
                  <span id="record-preview-kicker" class="record-preview-kicker">ふだんの記録</span>
                  <span id="record-preview-date">今日</span>
                </div>
                <h3 id="record-preview-title">名前未確定の観察</h3>
                <p id="record-preview-place">場所メモが入ると、あとから再訪理由として効きます。</p>
                <div class="record-preview-meta">
                  <span id="record-preview-municipality">自治体未入力</span>
                  <span id="record-preview-coords">34.7108, 137.7261</span>
                </div>
                <div id="record-preview-photo" class="record-preview-photo is-empty">写真 / 動画プレビュー</div>
              </div>
            </section>
            <section class="record-card record-guide-card">
              <div class="eyebrow">この 1 件の意味</div>
              <h2>この 1 件が効く理由</h2>
              <div class="list">
                <div class="row"><div><strong>再訪理由が残る</strong><div class="meta">場所メモと日時が、次に同じ道を歩く理由になる。</div></div></div>
                <div class="row"><div><strong>見分け方の仮説が残る</strong><div class="meta">写真と名前の仮説が、次に見返したときの手がかりになる。</div></div></div>
                <div class="row"><div><strong>ノートとして読み返せる</strong><div class="meta">単発投稿ではなく、前回との差分が見える履歴になる。</div></div></div>
              </div>
            </section>
            <section class="record-card">
              <div class="eyebrow">信頼のレーン</div>
              <h2>名前は、段を分けて確かめる</h2>
              <div class="list">
                <div class="row"><div><strong>AI のヒント</strong><div class="meta">${JA_PUBLIC_SHARED_COPY.ai.support}</div></div></div>
                <div class="row"><div><strong>みんなの見立て</strong><div class="meta">人の一致で「強い候補」になる。大きな分類なら正式に残ることもある。</div></div></div>
                <div class="row"><div><strong>任された人の確認</strong><div class="meta">分類群の担当権限を持つ確認者が、細かい種名を通す段階。</div></div></div>
                <div class="row"><div><strong>公開前の確認</strong><div class="meta">確認と証拠がそろったものだけ、外に出す前提で扱う。</div></div></div>
              </div>
            </section>
            <section class="record-card">
              <div class="eyebrow">送信状況</div>
              <h2>送信ステータス</h2>
              <div id="record-status" class="list" style="margin-top:16px">
                <div class="row"><div>入力が完了したら送信してください。</div></div>
              </div>
            </section>
          </aside>
        </div>
      </section>
      <script src="https://cdn.jsdelivr.net/npm/tus-js-client@4.1.0/dist/tus.min.js" integrity="sha384-e14cNjQjd5R4CjmEtpwqhtz1Yr92mbPYc08UpfD17q3OEaOPNnZM0sxye7khgesI" crossorigin="anonymous"></script>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const form = document.getElementById('record-form');
        const status = document.getElementById('record-status');
        const observedAt = document.getElementById('observedAt');
        const modeEyebrow = document.getElementById('record-mode-eyebrow');
        const modeLead = document.getElementById('record-mode-lead');
        const modeInput = form ? form.querySelector('[name=recordMode]') : null;
        const modeButtons = form ? Array.from(form.querySelectorAll('[data-record-mode]')) : [];
        const quickFieldsWrap = form ? form.querySelector('[data-quick-only]') : null;
        const surveyFieldsWrap = form ? form.querySelector('[data-survey-only]') : null;
        const surveyRequiredFields = form ? Array.from(form.querySelectorAll('[data-survey-required]')) : [];
        const previewDate = document.getElementById('record-preview-date');
        const previewKicker = document.getElementById('record-preview-kicker');
        const previewTitle = document.getElementById('record-preview-title');
        const previewPlace = document.getElementById('record-preview-place');
        const previewMunicipality = document.getElementById('record-preview-municipality');
        const previewCoords = document.getElementById('record-preview-coords');
        const previewPhoto = document.getElementById('record-preview-photo');
        const mediaInput = document.getElementById('record-media');
        const videoProgressWrap = document.getElementById('record-video-progress');
        const videoProgressBar = document.getElementById('record-video-progressbar');
        const videoProgressLabel = document.getElementById('record-video-progress-label');
        const videoProgressBytes = document.getElementById('record-video-progress-bytes');
        const videoLive = document.getElementById('record-video-live');
        const videoCancel = document.getElementById('record-video-cancel');
        const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
        const MAX_VIDEO_SECONDS = 60;
        let previewObjectUrl = '';
        let activeTusUpload = null;
        let cancelTusUpload = null;

        if (observedAt && !observedAt.value) {
          const now = new Date();
          observedAt.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }

        const setStatus = (html) => {
          if (status) status.innerHTML = html;
        };

        const isSurveyMode = () => modeInput && modeInput.value === 'survey';

        const syncModeUi = () => {
          const survey = isSurveyMode();
          if (modeEyebrow) modeEyebrow.textContent = survey ? 'しっかり記録' : 'ふだんの記録';
          if (modeLead) {
            modeLead.textContent = survey
              ? '見た条件も一緒に残して、あとで比べやすくするための入力です。'
              : '場所・時間・気づいたことを、まず 1 件残すための入力です。';
          }
          if (previewKicker) previewKicker.textContent = survey ? 'しっかり記録' : 'ふだんの記録';
          if (quickFieldsWrap) quickFieldsWrap.hidden = survey;
          if (surveyFieldsWrap) surveyFieldsWrap.hidden = !survey;
          surveyRequiredFields.forEach((field) => {
            field.disabled = !survey;
            if (survey) field.setAttribute('required', 'required');
            else field.removeAttribute('required');
          });
          modeButtons.forEach((button) => {
            const active = button.getAttribute('data-record-mode') === (modeInput ? modeInput.value : 'quick');
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
        };

        const normalizeError = (error) => {
          if (!error) return 'unknown_error';
          if (typeof error === 'string') return error;
          if (error && typeof error.message === 'string') return error.message;
          return String(error);
        };

        const escapeHtmlText = (value) => String(value == null ? '' : value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

        const formatObservedDate = (value) => {
          if (!value) return '';
          const parsed = new Date(String(value));
          if (Number.isNaN(parsed.getTime())) return String(value);
          return parsed.toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });
        };

        const buildImpactHtml = (impact, extraStatus) => {
          const notes = [];
          if (impact && impact.placeName) {
            notes.push(impact.placeName + ' での記録が ' + String(impact.visitCount || 1) + ' 件目になりました。');
          }
          if (impact && impact.previousObservedAt) {
            notes.push('前回は ' + formatObservedDate(impact.previousObservedAt) + ' に記録しています。');
          } else if (impact && impact.placeName) {
            notes.push('この場所の比較用メモがここから育ちます。');
          }
          if (impact && impact.focusLabel) {
            notes.push('次は「' + String(impact.focusLabel) + '」を見返す軸として残しました。');
          } else if (impact && impact.captureState === 'unknown') {
            notes.push('まだ分からないまま残したので、次回の見分けポイントにできます。');
          } else if (impact && impact.captureState === 'no_detection_note') {
            notes.push('今日は見なかったメモとして残し、次回比較の起点にしました。');
          }
          if (extraStatus) {
            notes.push(extraStatus);
          }
          return notes.map((line) => '<div class="meta" style="margin-top:6px">' + escapeHtmlText(line) + '</div>').join('');
        };

        const applyPrefillFromQuery = () => {
          if (!form) return;
          const params = new URLSearchParams(window.location.search);
          const names = ['latitude', 'longitude', 'municipality', 'localityNote', 'scientificName', 'vernacularName', 'rank', 'nextLookFor', 'targetTaxaScope', 'revisitReason'];
          names.forEach((name) => {
            if (!params.has(name)) return;
            const field = form.elements.namedItem(name);
            if (field && 'value' in field) {
              field.value = params.get(name) || '';
            }
          });
          if (params.has('quickCaptureState')) {
            const field = form.elements.namedItem('quickCaptureState');
            if (field && 'value' in field) {
              field.value = params.get('quickCaptureState') || 'present';
            }
          }
          if (params.has('surveyResult')) {
            const field = form.elements.namedItem('surveyResult');
            if (field && 'value' in field) {
              field.value = params.get('surveyResult') || 'detected';
            }
          }
          if (params.has('recordMode') && modeInput) {
            modeInput.value = params.get('recordMode') === 'survey' ? 'survey' : 'quick';
          }
        };

        const formatBytes = (bytes) => {
          if (!Number.isFinite(bytes) || bytes <= 0) return '0 MB';
          const mb = bytes / (1024 * 1024);
          if (mb >= 1024) return (mb / 1024).toFixed(2) + ' GB';
          return mb.toFixed(1) + ' MB';
        };

        const isVideoFile = (file) => {
          if (!file) return false;
          const type = String(file.type || '').toLowerCase();
          if (type.startsWith('video/')) return true;
          return /\.(mp4|mov|m4v|webm|ogv|avi)$/i.test(String(file.name || ''));
        };

        const isImageFile = (file) => {
          if (!file) return false;
          const type = String(file.type || '').toLowerCase();
          if (type.startsWith('image/')) return true;
          return /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(String(file.name || ''));
        };

        const resetVideoProgress = () => {
          if (videoProgressWrap) videoProgressWrap.hidden = true;
          if (videoProgressBar) videoProgressBar.value = 0;
          if (videoProgressLabel) videoProgressLabel.textContent = '0%';
          if (videoProgressBytes) videoProgressBytes.textContent = '0 MB / 0 MB';
          if (videoLive) videoLive.textContent = '動画を選ぶと進捗を表示します。';
          if (videoCancel) videoCancel.disabled = true;
          activeTusUpload = null;
          cancelTusUpload = null;
        };

        const updateVideoProgress = (uploaded, total) => {
          if (videoProgressWrap) videoProgressWrap.hidden = false;
          const safeTotal = Number(total) > 0 ? Number(total) : 1;
          const percent = Math.max(0, Math.min(100, Math.round((Number(uploaded) / safeTotal) * 100)));
          if (videoProgressBar) videoProgressBar.value = percent;
          if (videoProgressLabel) videoProgressLabel.textContent = percent + '%';
          if (videoProgressBytes) videoProgressBytes.textContent = formatBytes(uploaded) + ' / ' + formatBytes(total);
        };

        const renderPreviewFile = (file) => {
          if (!previewPhoto) return;
          if (previewObjectUrl) {
            URL.revokeObjectURL(previewObjectUrl);
            previewObjectUrl = '';
          }
          if (!file) {
            previewPhoto.className = 'record-preview-photo is-empty';
            previewPhoto.innerHTML = '写真 / 動画プレビュー';
            return;
          }
          if (isVideoFile(file)) {
            previewObjectUrl = URL.createObjectURL(file);
            previewPhoto.className = 'record-preview-photo';
            previewPhoto.innerHTML = '<video controls playsinline muted preload="metadata" src="' + previewObjectUrl + '" aria-label="動画プレビュー"></video>';
            return;
          }
          if (isImageFile(file)) {
            const reader = new FileReader();
            reader.onload = () => {
              previewPhoto.className = 'record-preview-photo';
              previewPhoto.innerHTML = '<img src="' + String(reader.result || '') + '" alt="preview" />';
            };
            reader.onerror = () => {
              previewPhoto.className = 'record-preview-photo is-empty';
              previewPhoto.innerHTML = 'プレビュー読み込みに失敗しました。';
            };
            reader.readAsDataURL(file);
            return;
          }
          previewPhoto.className = 'record-preview-photo is-empty';
          previewPhoto.innerHTML = '対応していないファイル形式です。';
        };

        const syncPreview = () => {
          if (!form) return;
          const data = new FormData(form);
          const survey = String(data.get('recordMode') || '') === 'survey';
          const scientificName = String(data.get('scientificName') || '').trim();
          const vernacularName = String(data.get('vernacularName') || '').trim();
          const localityNote = String(data.get('localityNote') || '').trim();
          const municipality = String(data.get('municipality') || '').trim();
          const revisitReason = String(data.get('revisitReason') || '').trim();
          const nextLookFor = String(data.get('nextLookFor') || '').trim();
          const quickCaptureState = String(data.get('quickCaptureState') || 'present');
          const targetTaxaScope = String(data.get('targetTaxaScope') || '').trim();
          const latitude = String(data.get('latitude') || '').trim();
          const longitude = String(data.get('longitude') || '').trim();
          const observedAtValue = String(data.get('observedAt') || '').trim();
          if (previewTitle) previewTitle.textContent = vernacularName || scientificName || '名前未確定の観察';
          if (previewPlace) {
            previewPlace.textContent = survey
              ? (revisitReason || targetTaxaScope || localityNote || 'また見に行きたい理由や見たかったものを書くと、あとで比べやすくなります。')
              : (nextLookFor
                  || (quickCaptureState === 'no_detection_note'
                    ? '今日は見なかったメモとして残します。'
                    : quickCaptureState === 'unknown'
                      ? 'まだ分からないまま残し、あとで見分け直せます。'
                      : localityNote)
                  || '場所メモが入ると、あとから再訪理由として効きます。');
          }
          if (previewMunicipality) previewMunicipality.textContent = municipality || '自治体未入力';
          if (previewCoords) previewCoords.textContent = latitude && longitude ? latitude + ', ' + longitude : '座標未入力';
          if (previewDate) {
            previewDate.textContent = observedAtValue
              ? new Date(observedAtValue).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' })
              : '今日';
          }
        };

        const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('file_read_failed'));
          reader.readAsDataURL(file);
        });

        const validateVideoDuration = (file) => new Promise((resolve, reject) => {
          const probe = document.createElement('video');
          const objectUrl = URL.createObjectURL(file);
          const cleanup = () => {
            URL.revokeObjectURL(objectUrl);
            probe.removeAttribute('src');
          };
          probe.preload = 'metadata';
          probe.muted = true;
          probe.playsInline = true;
          probe.onloadedmetadata = () => {
            const duration = Number(probe.duration);
            cleanup();
            if (!Number.isFinite(duration) || duration <= 0) {
              reject(new Error('video_duration_unknown'));
              return;
            }
            if (duration > MAX_VIDEO_SECONDS + 0.5) {
              reject(new Error('video_duration_too_long'));
              return;
            }
            resolve(duration);
          };
          probe.onerror = () => {
            cleanup();
            reject(new Error('video_metadata_read_failed'));
          };
          probe.src = objectUrl;
        });

        const uploadVideoWithTus = (directUploadUrl, file) =>
          new Promise((resolve, reject) => {
            if (!(window.tus && typeof window.tus.Upload === 'function')) {
              reject(new Error('video_upload_library_unavailable'));
              return;
            }
            let settled = false;
            const finish = (error) => {
              if (settled) return;
              settled = true;
              if (videoCancel) videoCancel.disabled = true;
              activeTusUpload = null;
              cancelTusUpload = null;
              if (error) reject(error);
              else resolve(true);
            };

            const upload = new window.tus.Upload(file, {
              uploadUrl: directUploadUrl,
              chunkSize: 8 * 1024 * 1024,
              retryDelays: [0, 1200, 3000, 5000, 9000],
              removeFingerprintOnSuccess: true,
              metadata: {
                filename: file.name || 'upload.mp4',
                filetype: file.type || 'video/mp4',
              },
              onProgress: (uploaded, total) => {
                updateVideoProgress(uploaded, total);
                if (videoLive) videoLive.textContent = '動画をアップロード中です。';
              },
              onError: (error) => {
                finish(error instanceof Error ? error : new Error(String(error)));
              },
              onSuccess: () => {
                if (videoLive) videoLive.textContent = '動画アップロードが完了しました。';
                finish(null);
              },
            });

            activeTusUpload = upload;
            cancelTusUpload = () => {
              upload.abort(true);
              finish(new Error('video_upload_cancelled'));
            };
            if (videoCancel) videoCancel.disabled = false;
            updateVideoProgress(0, file.size || 0);
            upload.start();
          });

        if (form) {
          form.addEventListener('input', syncPreview);
        }
        modeButtons.forEach((button) => {
          button.addEventListener('click', () => {
            if (!modeInput) return;
            modeInput.value = button.getAttribute('data-record-mode') || 'quick';
            syncModeUi();
            syncPreview();
          });
        });
        if (mediaInput) {
          mediaInput.addEventListener('change', () => {
            const file = mediaInput.files && mediaInput.files[0];
            renderPreviewFile(file || null);
            if (!file || !isVideoFile(file)) {
              resetVideoProgress();
            } else if (videoProgressWrap) {
              videoProgressWrap.hidden = false;
              if (videoLive) videoLive.textContent = '動画をアップロードできます。送信すると開始します。';
            }
          });
        }
        if (videoCancel) {
          videoCancel.addEventListener('click', () => {
            if (typeof cancelTusUpload === 'function') {
              cancelTusUpload();
              setStatus('<div class="row"><div>動画アップロードをキャンセルしました。</div></div>');
            }
          });
        }

        applyPrefillFromQuery();
        syncModeUi();
        syncPreview();
        resetVideoProgress();

        if (form) {
          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const userId = form.dataset.userId || '';
            const observationId = 'record-' + Date.now();
            if (!userId) {
              setStatus('<div class="row"><div>ログイン情報を確認できませんでした。ページを開き直してから、もう一度お試しください。</div></div>');
              return;
            }
            setStatus('<div class="row"><div>記録を送信中...</div></div>');
            try {
              const recordMode = String(data.get('recordMode') || 'quick') === 'survey' ? 'survey' : 'quick';
              const checklistCompletion = String(data.get('checklistCompletion') || 'complete');
              const targetTaxaScope = String(data.get('targetTaxaScope') || '').trim();
              const effortMinutes = Number(data.get('effortMinutes'));
              const revisitReason = String(data.get('revisitReason') || '').trim();
              const nextLookFor = String(data.get('nextLookFor') || '').trim();
              const quickCaptureState = String(data.get('quickCaptureState') || 'present');
              const surveyResult = String(data.get('surveyResult') || 'detected');
              if (recordMode === 'survey') {
                if (!targetTaxaScope) {
                  throw new Error('survey_target_scope_required');
                }
                if (!Number.isFinite(effortMinutes) || effortMinutes <= 0) {
                  throw new Error('survey_effort_required');
                }
                if (!revisitReason) {
                  throw new Error('survey_revisit_reason_required');
                }
              }
              const speciesNote = recordMode === 'survey'
                ? '[survey] ' + revisitReason + (surveyResult === 'no_detection_note' ? ' / no target detected protocol note' : '')
                : '';
              const scientificName = String(data.get('scientificName') || '').trim();
              const vernacularName = String(data.get('vernacularName') || '').trim();
              const rank = String(data.get('rank') || '').trim();
              const payload = {
                observationId,
                legacyObservationId: observationId,
                userId,
                observedAt: new Date(String(data.get('observedAt'))).toISOString(),
                latitude: Number(data.get('latitude')),
                longitude: Number(data.get('longitude')),
                prefecture: 'Shizuoka',
                municipality: String(data.get('municipality') || ''),
                localityNote: String(data.get('localityNote') || ''),
                note: speciesNote,
                visitMode: recordMode === 'survey' ? 'survey' : 'manual',
                completeChecklistFlag: recordMode === 'survey' ? checklistCompletion === 'complete' : false,
                targetTaxaScope: recordMode === 'survey' ? targetTaxaScope : null,
                effortMinutes: recordMode === 'survey' ? effortMinutes : null,
                revisitReason: recordMode === 'survey' ? revisitReason : nextLookFor || null,
                sourcePayload: {
                  source: 'v2_web',
                  record_mode: recordMode,
                  survey_result: recordMode === 'survey' ? surveyResult : null,
                  quick_capture_state: recordMode === 'survey' ? null : quickCaptureState,
                  next_look_for: recordMode === 'survey' ? null : (nextLookFor || null),
                  absence_semantics: recordMode === 'survey'
                    ? (surveyResult === 'no_detection_note' ? 'protocol_note_only' : null)
                    : (quickCaptureState === 'no_detection_note'
                        ? 'casual_note_only'
                        : quickCaptureState === 'unknown'
                          ? 'needs_followup'
                          : null),
                },
                taxon: scientificName || vernacularName
                  ? {
                      scientificName,
                      vernacularName,
                      rank,
                    }
                  : null,
              };

              const observationResponse = await fetch(withBasePath('/api/v1/observations/upsert'), {
                method: 'POST',
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                credentials: 'include',
                body: JSON.stringify(payload),
              });
              const observationJson = await observationResponse.json();
              if (!observationResponse.ok || !observationJson.ok) {
                throw new Error(observationJson.error || 'observation_upsert_failed');
              }
              const detailId = String(observationJson.occurrenceId || observationId);

              const media = data.get('media');
              const mediaFile = media instanceof File && media.size > 0 ? media : null;
              let extraStatus = '';

              if (mediaFile) {
                if (isImageFile(mediaFile)) {
                  const base64Data = await readFileAsDataUrl(mediaFile);
                  const photoResponse = await fetch(withBasePath('/api/v1/observations/' + encodeURIComponent(detailId) + '/photos/upload'), {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', accept: 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      filename: mediaFile.name || 'upload.jpg',
                      mimeType: mediaFile.type || 'image/jpeg',
                      base64Data,
                    }),
                  });
                  const photoJson = await photoResponse.json();
                  if (!photoResponse.ok || !photoJson.ok) {
                    throw new Error(photoJson.error || 'photo_upload_failed');
                  }
                } else if (isVideoFile(mediaFile)) {
                  if (mediaFile.size > MAX_VIDEO_BYTES) {
                    throw new Error('video_file_too_large');
                  }
                  await validateVideoDuration(mediaFile);

                  setStatus('<div class="row"><div>動画アップロード URL を発行しています...</div></div>');
                  const issueResponse = await fetch(withBasePath('/api/v1/videos/direct-upload'), {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', accept: 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      filename: mediaFile.name || 'upload.mp4',
                      maxDurationSeconds: MAX_VIDEO_SECONDS,
                      observationId: detailId,
                    }),
                  });
                  const issueJson = await issueResponse.json();
                  if (!issueResponse.ok || !issueJson.ok || !issueJson.uploadUrl || !issueJson.uid) {
                    throw new Error(issueJson.error || 'video_issue_failed');
                  }

                  await uploadVideoWithTus(String(issueJson.uploadUrl), mediaFile);
                  setStatus('<div class="row"><div>動画を観察へ紐づけています...</div></div>');

                  const finalizeResponse = await fetch(withBasePath('/api/v1/videos/' + encodeURIComponent(String(issueJson.uid)) + '/finalize'), {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', accept: 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      observationId: detailId,
                    }),
                  });
                  const finalizeJson = await finalizeResponse.json();
                  if (!finalizeResponse.ok || !finalizeJson.ok) {
                    throw new Error(finalizeJson.error || 'video_finalize_failed');
                  }

                  try {
                    const reassessVideoResponse = await fetch(withBasePath('/api/v1/observations/' + encodeURIComponent(detailId) + '/reassess-from-video'), {
                      method: 'POST',
                      credentials: 'include',
                    });
                    const reassessVideoJson = await reassessVideoResponse.json();
                    if (reassessVideoResponse.ok && reassessVideoJson.ok) {
                      extraStatus = '動画サムネイルの AI 解析も更新しました。';
                    } else {
                      extraStatus = '動画は保存済みです（AI 解析は詳細ページから再実行できます）。';
                    }
                  } catch (_error) {
                    extraStatus = '動画は保存済みです（AI 解析は詳細ページから再実行できます）。';
                  }
                } else {
                  throw new Error('unsupported_media_type');
                }
              }

              const suffix = extraStatus
                ? extraStatus
                : '';
              const impactHtml = buildImpactHtml(observationJson.impact || null, suffix);
              setStatus('<div class="row"><div><strong>記録を保存しました。</strong>' + impactHtml + '<div class="meta"><a href="' + withBasePath('/observations/' + encodeURIComponent(detailId)) + '">観察を見る</a> · <a href="' + withBasePath('/notes') + '">ノートを見る</a></div></div></div>');
              form.reset();
              if (modeInput) modeInput.value = 'quick';
              if (observedAt) {
                const now = new Date();
                observedAt.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
              }
              renderPreviewFile(null);
              syncModeUi();
              syncPreview();
              resetVideoProgress();
            } catch (error) {
              const message = normalizeError(error);
              let userMessage = message;
              if (message === 'video_file_too_large') userMessage = '動画サイズは 200MB 以下にしてください。';
              if (message === 'video_duration_too_long') userMessage = '動画の長さは 60 秒以内にしてください。';
              if (message === 'video_upload_cancelled') userMessage = '動画アップロードをキャンセルしました。';
              if (message === 'video_metadata_read_failed' || message === 'video_duration_unknown') userMessage = '動画の長さを確認できませんでした。別の動画で試してください。';
              if (message === 'unsupported_media_type') userMessage = '画像または動画ファイルを選択してください。';
              if (message === 'survey_target_scope_required') userMessage = 'しっかり記録では、何を見たかったかを入力してください。';
              if (message === 'survey_effort_required') userMessage = 'しっかり記録では、見た時間を入力してください。';
              if (message === 'survey_revisit_reason_required') userMessage = 'しっかり記録では、また見に行きたい理由を入力してください。';
              setStatus('<div class="row"><div>送信に失敗しました。<div class="meta">' + userMessage + '</div></div></div>');
            } finally {
              if (videoCancel) videoCancel.disabled = true;
              activeTusUpload = null;
              cancelTusUpload = null;
            }
          });
        }
      </script>`,
      "Record",
      {
        eyebrow: recordPageCopy.hero.eyebrow,
        heading: recordPageCopy.hero.heading,
        lead: recordPageCopy.hero.lead,
        actions: [
          { href: queryUserId ? `/home?userId=${encodeURIComponent(viewerUserId)}` : "/home", label: "ホーム" },
          { href: "/explore", label: "みつける", variant: "secondary" as const },
        ],
      },
      `
        .record-page { margin-top: 24px; }
        .record-shell { display: grid; grid-template-columns: 1fr; gap: 18px; align-items: start; max-width: 860px; }
        .record-card { border-radius: 28px; background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,250,252,.92)); border: 1px solid rgba(15,23,42,.06); box-shadow: 0 16px 36px rgba(15,23,42,.06); padding: 24px; }
        .record-sheet { position: relative; overflow: hidden; }
        .record-sheet::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(180deg, transparent 0, transparent 34px, rgba(14,165,233,.05) 35px, transparent 36px); pointer-events: none; }
        .record-sheet::after { content: ""; position: absolute; inset: 0 auto 0 20px; width: 2px; background: linear-gradient(180deg, rgba(239,68,68,.28), rgba(239,68,68,.14)); pointer-events: none; }
        .record-sheet > * { position: relative; z-index: 1; }
        .record-card-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; flex-wrap: wrap; margin-bottom: 18px; padding-left: 16px; }
        .record-card-head h2 { margin: 10px 0 0; font-size: clamp(24px, 2.8vw, 34px); line-height: 1.26; letter-spacing: -.02em; }
        .record-session-pill { display: inline-flex; flex-direction: column; gap: 4px; padding: 12px 16px; border-radius: 18px; background: rgba(255,255,255,.86); border: 1px solid rgba(15,23,42,.08); min-width: 180px; }
        .record-session-label { font-size: 11px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
        .record-session-pill strong { font-size: 14px; color: #0f172a; word-break: break-all; }
        .record-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding-left: 16px; }
        .record-field { display: flex; flex-direction: column; gap: 8px; }
        .record-field-wide { grid-column: 1 / -1; }
        .record-label { font-weight: 800; color: #0f172a; font-size: 14px; }
        .record-help { font-size: 12px; line-height: 1.6; color: #64748b; }
        .record-mode-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .record-mode-chip { display: grid; gap: 4px; text-align: left; padding: 14px 16px; border-radius: 18px; border: 1px solid rgba(15,23,42,.1); background: rgba(255,255,255,.84); color: #0f172a; cursor: pointer; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
        .record-mode-chip strong { font-size: 14px; }
        .record-mode-chip span { font-size: 12px; line-height: 1.6; color: #64748b; font-weight: 700; }
        .record-mode-chip.is-active { border-color: rgba(14,165,233,.36); box-shadow: 0 10px 24px rgba(14,165,233,.1); transform: translateY(-1px); }
        .record-survey-box { display: grid; gap: 14px; padding: 18px; border-radius: 20px; background: linear-gradient(135deg, rgba(14,165,233,.08), rgba(16,185,129,.08)); border: 1px solid rgba(14,165,233,.18); }
        .record-survey-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
        .record-survey-pill { display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; border-radius: 999px; background: rgba(15,23,42,.08); color: #0f172a; font-size: 10px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
        .record-survey-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .record-survey-caution { display: grid; gap: 4px; padding: 12px 14px; border-radius: 16px; background: rgba(255,255,255,.78); border: 1px solid rgba(15,23,42,.08); }
        .record-survey-caution strong { color: #0f172a; font-size: 13px; }
        .record-survey-caution span { color: #475569; font-size: 12px; line-height: 1.7; font-weight: 700; }
        .record-photo-field input[type="file"] { padding: 14px; border-style: dashed; }
        .record-video-progress { grid-column: 1 / -1; padding: 14px 16px; border-radius: 16px; background: linear-gradient(180deg, rgba(14,165,233,.08), rgba(16,185,129,.08)); border: 1px solid rgba(14,165,233,.2); display: grid; gap: 8px; }
        .record-video-progress-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
        .record-video-progress strong { font-size: 13px; color: #0f172a; }
        .record-video-progress progress { width: 100%; height: 13px; }
        .record-video-progress-meta { display: flex; justify-content: space-between; gap: 12px; color: #334155; font-size: 12px; font-weight: 700; }
        .record-video-live { font-size: 12px; color: #0f766e; line-height: 1.5; }
        .record-actions { grid-column: 1 / -1; display: flex; flex-wrap: wrap; gap: 12px; padding-top: 4px; }
        .record-sidebar { display: grid; gap: 18px; }
        .record-preview-card h2, .record-guide-card h2 { margin: 10px 0 0; font-size: 22px; line-height: 1.3; }
        .record-preview {
          margin-top: 16px;
          padding: 20px 20px 18px 24px;
          border-radius: 24px;
          background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.96));
          border: 1px solid rgba(15,23,42,.06);
          position: relative;
          overflow: hidden;
        }
        .record-preview::before { content: ""; position: absolute; inset: 0; background: repeating-linear-gradient(180deg, transparent 0, transparent 30px, rgba(14,165,233,.06) 31px, transparent 32px); pointer-events: none; }
        .record-preview::after { content: ""; position: absolute; inset: 0 auto 0 16px; width: 2px; background: linear-gradient(180deg, rgba(239,68,68,.24), rgba(239,68,68,.12)); pointer-events: none; }
        .record-preview > * { position: relative; z-index: 1; }
        .record-preview-topline { display: flex; justify-content: space-between; gap: 12px; font-size: 11px; text-transform: uppercase; letter-spacing: .1em; color: #64748b; font-weight: 800; }
        .record-preview-kicker { color: #059669; }
        .record-preview h3 { margin: 14px 0 10px; font-size: 24px; line-height: 1.3; letter-spacing: -.02em; }
        .record-preview p { margin: 0; color: #475569; line-height: 1.8; }
        .record-preview-meta { display: flex; flex-wrap: wrap; gap: 8px 12px; margin-top: 14px; color: #334155; font-size: 13px; font-weight: 700; }
        .record-preview-photo { margin-top: 16px; min-height: 160px; border-radius: 20px; overflow: hidden; background: linear-gradient(135deg, rgba(16,185,129,.12), rgba(14,165,233,.12)); border: 1px solid rgba(14,165,233,.12); display: grid; place-items: center; color: #0f172a; font-weight: 800; }
        .record-preview-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .record-preview-photo video { width: 100%; height: 100%; display: block; object-fit: cover; background: #020617; }
        .record-preview-photo.is-empty { color: #475569; font-size: 13px; }
        @media (max-width: 720px) {
          .record-card { padding: 20px; border-radius: 24px; }
          .record-form { grid-template-columns: 1fr; padding-left: 0; }
          .record-mode-grid, .record-survey-grid { grid-template-columns: 1fr; }
          .record-card-head { padding-left: 0; }
          .record-sheet::after, .record-preview::after { display: none; }
        }
      `,
    );
  });

  app.get("/explore", async (_request, reply) => {
    const basePath = requestBasePath(_request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((_request as unknown as { url?: string }).url ?? ""));
    const explorePageCopy = getShortCopy<any>(lang, "public", "read.explore");
    const snapshot = await getExploreSnapshot();
    const cards = snapshot.recentObservations.map((item) =>
      renderObservationCard(basePath, lang, {
        occurrenceId: item.occurrenceId,
        visitId: item.visitId,
        detailId: item.detailId,
        featuredOccurrenceId: item.featuredOccurrenceId,
        featuredSubjectName: item.featuredSubjectName,
        subjectCount: item.subjectCount,
        isMultiSubject: item.isMultiSubject,
        featuredConfidenceBand: item.featuredConfidenceBand,
        displayStability: item.displayStability,
        displayName: item.displayName,
        observedAt: item.observedAt,
        observerName: item.observerName,
        placeName: item.placeName,
        municipality: item.municipality,
        publicLocation: item.publicLocation,
        photoUrl: item.photoUrl,
        identificationCount: item.identificationCount,
        latitude: null,
        longitude: null,
        observerUserId: null,
        observerAvatarUrl: null,
      }, { locationMode: "public" }),
    ).join("");
    const municipalities = snapshot.municipalities.map((item) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(item.municipality)}</div>
          <div class="meta">最近のまとまり</div>
        </div>
        <span class="pill">${item.observationCount} 件</span>
      </div>`).join("");
    const taxa = snapshot.topTaxa.map((item) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(item.displayName)}</div>
          <div class="meta">この場所で見つかっているもの</div>
        </div>
        <span class="pill">${item.observationCount} 件</span>
      </div>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      explorePageCopy.title,
      `<section class="section">
        <div class="grid">
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(explorePageCopy.sections.placesEyebrow)}</div><div class="list">${municipalities || `<div class="row"><div>${escapeHtml(explorePageCopy.sections.placesEmpty)}</div></div>`}</div></div></div>
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(explorePageCopy.sections.taxaEyebrow)}</div><div class="list">${taxa || `<div class="row"><div>${escapeHtml(explorePageCopy.sections.taxaEmpty)}</div></div>`}</div></div></div>
        </div>
      </section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">${escapeHtml(explorePageCopy.sections.recentEyebrow)}</div><h2>${escapeHtml(explorePageCopy.sections.recentTitle)}</h2></div></div><div class="explore-grid">${cards || `<div class="card"><div class="card-body">${escapeHtml(explorePageCopy.sections.recentEmpty)}</div></div>`}</div></section>`,
      explorePageCopy.activeNav,
      {
        eyebrow: explorePageCopy.hero.eyebrow,
        heading: explorePageCopy.hero.heading,
        lead: explorePageCopy.hero.lead,
        actions: [
          { href: "/map", label: JA_PUBLIC_SHARED_COPY.cta.openMap },
          { href: "/notes", label: JA_PUBLIC_SHARED_COPY.cta.openNotebook, variant: "secondary" as const },
        ],
      },
      `${OBSERVATION_CARD_STYLES}
        .explore-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 14px; }
        @media (max-width: 860px) { .explore-grid { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        @media (max-width: 480px) { .explore-grid { grid-template-columns: 1fr; } }
      `,
    );
  });

  app.get("/home", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    const { viewerUserId } = resolveViewer(request.query, session);
    const snapshot = await getHomeSnapshot(viewerUserId);
    const cards = snapshot.recentObservations.map((item) =>
      renderObservationCard(basePath, lang, {
        occurrenceId: item.occurrenceId,
        visitId: item.visitId,
        detailId: item.detailId,
        featuredOccurrenceId: item.featuredOccurrenceId,
        featuredSubjectName: item.featuredSubjectName,
        subjectCount: item.subjectCount,
        isMultiSubject: item.isMultiSubject,
        featuredConfidenceBand: item.featuredConfidenceBand,
        displayStability: item.displayStability,
        displayName: item.displayName,
        observedAt: item.observedAt,
        observerName: item.observerName,
        placeName: item.placeName,
        municipality: item.municipality,
        publicLocation: item.publicLocation,
        photoUrl: item.photoUrl,
        identificationCount: item.identificationCount,
        latitude: null,
        longitude: null,
        observerUserId: null,
        observerAvatarUrl: null,
      }, { locationMode: "public" }),
    ).join("");
    const myPlaces = renderPlaceRows(
      basePath,
      lang,
      snapshot.viewerUserId,
      snapshot.myPlaces,
      "まだ記録した場所はありません。",
    );
    const revisitCue = snapshot.myPlaces[0]
      ? `${snapshot.myPlaces[0].placeName} · ${buildPlaceCompareLine(snapshot.myPlaces[0])} · ${buildPlaceNextLine(snapshot.myPlaces[0])}。`
      : "まず1件記録すると、場所ごとの再訪理由が育ち始めます。";
    const growthCue = snapshot.recentObservations[0]
      ? `${snapshot.recentObservations[0].displayName} のような最近の観察から、前回より細かく見られた点を積み上げます。`
      : "観察履歴がたまるほど、前回からの成長と見分けポイントが読み返しやすくなります。";

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "ホーム | ikimon",
      `<section class="section">
        <div class="grid">
          <div class="card has-accent is-soft"><div class="card-body"><div class="eyebrow">今回の学び</div><h2>前回より見えた点</h2><p class="meta">${escapeHtml(growthCue)}</p></div></div>
          <div class="card has-accent is-soft"><div class="card-body"><div class="eyebrow">また行く理由</div><h2>次に訪れる場所</h2><p class="meta">${escapeHtml(revisitCue)}</p></div></div>
          <div class="card is-soft"><div class="card-body"><div class="eyebrow">積み上がる意味</div><h2>長く残る観察</h2><p class="meta">今日の観察は、次に見返すための記録であり、長い時間の自然アーカイブにもなっていきます。</p></div></div>
        </div>
      </section>
      ${snapshot.viewerUserId ? `<section class="section"><div class="section-header"><div><div class="eyebrow">よく歩く場所</div><h2>再訪したい場所</h2></div></div><div class="list">${myPlaces}</div></section>` : ""}
      <section class="section"><div class="section-header"><div><div class="eyebrow">ノート</div><h2>最近の観察</h2></div></div><div class="home-grid">${cards}</div></section>`,
      "ホーム",
      {
        eyebrow: "再訪のホーム",
        heading: "前回より、少し見えるようになる",
        lead: "前回からの気づきと、また行きたくなる場所をまとめて返すホームです。",
        actions: [
          { href: "/notes", label: "ノートへ" },
          { href: "/record", label: "1 件記録する", variant: "secondary" as const },
        ],
      },
      `${OBSERVATION_CARD_STYLES}
        .home-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        ${PLACE_REVISIT_ROW_STYLES}
      `,
    );
  });

  app.get<{ Params: { id: string }; Querystring: { subject?: string } }>("/observations/:id", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const viewerSession = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const viewerUserId = viewerSession?.userId ?? null;
    const bundle = await getObservationVisitBundle(request.params.id, request.query.subject);
    if (!bundle) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Observation not found", stateCard("見つかりません", "この観察はまだ取得できません", "リンクが古い、または観察が削除されている可能性があります。"), "みつける");
    }
    const canonicalHref = appendLangToHref(
      withBasePath(basePath, buildObservationDetailPath(bundle.visitId, bundle.canonicalSubjectId)),
      lang,
    );
    if (request.params.id !== bundle.visitId || request.query.subject !== bundle.canonicalSubjectId) {
      return reply.redirect(canonicalHref, 302);
    }

    const snapshot = await getObservationDetailSnapshot(bundle.canonicalSubjectId);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Observation not found", stateCard("見つかりません", "この観察はまだ取得できません", "リンクが古い、または観察が削除されている可能性があります。"), "みつける");
    }

    const currentSubject = bundle.subjects.find((subject) => subject.occurrenceId === bundle.canonicalSubjectId) ?? bundle.subjects[0] ?? null;
    const featuredSubject = bundle.subjects.find((subject) => subject.occurrenceId === bundle.featuredOccurrenceId) ?? bundle.subjects[0] ?? null;
    const subjectCount = bundle.subjects.length;
    if (!currentSubject || !featuredSubject) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Observation not found", stateCard("対象が見つかりません", "この観察の subject を表示できません", "subject 情報がまだ同期中の可能性があります。"), "みつける");
    }

    const [obsContext, heavy, reactions, observerStats, insight, siteBriefResult] = await Promise.all([
      getObservationContext(bundle.canonicalSubjectId, snapshot.visitId ?? null, null).catch(() => null),
      getObservationDetailHeavy(bundle.canonicalSubjectId, snapshot.visitId ?? null, snapshot.placeId ?? null, viewerUserId).catch(() => null),
      subjectCount >= 2 ? Promise.resolve(null) : getReactionSummary(bundle.canonicalSubjectId, viewerUserId).catch(() => null),
      viewerUserId
        ? getObserverStats(viewerUserId, snapshot.placeId ?? null, bundle.canonicalSubjectId).catch(() => null)
        : Promise.resolve(null),
      snapshot.scientificName || snapshot.displayName
        ? getTaxonInsight({
            scientificName: snapshot.scientificName ?? "",
            vernacularName: snapshot.displayName,
            lat: snapshot.latitude ?? undefined,
            lng: snapshot.longitude ?? undefined,
            season: seasonFromDate(snapshot.observedAt),
            lang: "ja",
            cacheOnly: true,
          }).catch(() => null)
        : Promise.resolve(null),
      typeof snapshot.latitude === "number" && typeof snapshot.longitude === "number"
        ? getSiteBrief(snapshot.latitude, snapshot.longitude, "ja").catch(() => null)
        : Promise.resolve(null),
    ]);

    // ===== Layer 0: ヒーロー =====
    const { mediaBlock, galleryScript } = renderObservationMedia(snapshot, currentSubject);

    const badges: string[] = [];
    if (subjectCount >= 2) badges.push(`<span class="obs-badge obs-badge-species">🧩 ${subjectCount} 対象</span>`);
    if (featuredSubject) badges.push(`<span class="obs-badge obs-badge-species">⭐ 有力 ${escapeHtml(featuredSubject.displayName)}</span>`);
    if (currentSubject && featuredSubject && currentSubject.occurrenceId !== featuredSubject.occurrenceId) {
      badges.push(`<span class="obs-badge obs-badge-nearby" data-current-subject-badge>👀 表示中 ${escapeHtml(currentSubject.displayName)}</span>`);
    }
    if (currentSubject.identificationCount > 0) badges.push(`<span class="obs-badge obs-badge-consensus">🧭 同定 ${currentSubject.identificationCount} 件</span>`);
    if (heavy && heavy.nearby.length > 0) badges.push(`<span class="obs-badge obs-badge-nearby">📍 同地点 ${heavy.nearby.length} 件</span>`);
    if (snapshot.videoAssets.length > 0) badges.push(`<span class="obs-badge obs-badge-video">🎬 動画あり</span>`);

    const reactionBar = subjectCount >= 2 ? "" : renderReactionBar(reactions, viewerUserId, bundle.canonicalSubjectId);
    const rankedSubjects = bundle.subjects;
    const isOwner = !!viewerUserId && viewerUserId === snapshot.observerUserId;
    const canSeeCanonicalLocation = isOwner || /admin/i.test(String(viewerSession?.roleName ?? ""));
    const heroPlaceLabel = canSeeCanonicalLocation
      ? (snapshot.placeName || "場所情報なし")
      : (snapshot.publicLocation?.label || "位置をぼかしています");
    const publicMapHref = buildPublicMapCellHref(withBasePath(basePath, "/map"), snapshot.publicLocation);
    const detailMapHref = canSeeCanonicalLocation
      ? withBasePath(basePath, "/map")
      : publicMapHref;
    const trustStage =
      (currentSubject.evidenceTier ?? 0) >= 3
        ? "public_claim"
        : currentSubject.hasSpecialistApproval
          ? "authority_backed"
          : currentSubject.identificationCount > 0
            ? "community_support"
            : currentSubject.latestAssessmentBand && currentSubject.latestAssessmentBand !== "unknown"
              ? "ai_suggestion"
              : "";
    const trustLead =
      trustStage === "public_claim"
        ? "任された人の確認と媒体条件を満たし、公開前提の候補まで進んでいます。"
        : trustStage === "authority_backed"
          ? "分類群を任された人の確認が入り、公開前の確度を担保している段階です。"
          : trustStage === "community_support"
            ? "人の一致で「強い候補」になっている段階です。大きな分類なら正式に残ります。細かい種名の公開判定には、もう一段（任された人の確認）を通します。"
            : "いま見えている名前は仮の候補です。AI が出すヒントと人の確認で、段を上がっていきます。";
    const trustSteps = [
      { id: "ai_suggestion", label: "AI のヒント", meta: "候補と見分けのヒント" },
      { id: "community_support", label: "みんなの同定", meta: "一致で「強い候補」に" },
      { id: "authority_backed", label: "任された人の確認", meta: "細かい種名を通す段" },
      { id: "public_claim", label: "公開前提", meta: "公開用途の候補に進める" },
    ];
    const trustStageLabel = trustSteps.find((step) => step.id === trustStage)?.label ?? "候補";
    const targetTaxaScopeLabel = (() => {
      const scope = (snapshot.targetTaxaScope ?? "").trim();
      if (!scope) return null;
      if (scope === "all_observed_taxa") return "対象: 見つかったものを広く残す";
      if (scope === "plants") return "対象: 植物";
      if (scope === "birds") return "対象: 鳥類";
      if (scope === "insects") return "対象: 昆虫";
      return `対象: ${scope}`;
    })();
    const surveyResultLabel = snapshot.surveyResult === "no_detection_note"
      ? "今回は対象が見つからなかったメモ"
      : snapshot.surveyResult === "detected"
        ? "今回は対象を記録"
        : null;
    const surveySummary =
      snapshot.visitMode === "survey"
        ? (() => {
            const protocolChips: string[] = [];
            protocolChips.push(`<span class="obs-focus-chip">${snapshot.completeChecklistFlag ? "complete checklist" : "partial checklist"}</span>`);
            if (targetTaxaScopeLabel) protocolChips.push(`<span class="obs-focus-chip">${escapeHtml(targetTaxaScopeLabel)}</span>`);
            if (snapshot.effortMinutes != null) protocolChips.push(`<span class="obs-focus-chip">⏱️ ${snapshot.effortMinutes} 分</span>`);
            if (snapshot.distanceMeters != null) protocolChips.push(`<span class="obs-focus-chip">📏 ${Math.round(snapshot.distanceMeters)} m</span>`);
            if (snapshot.revisitReason) protocolChips.push(`<span class="obs-focus-chip">↺ ${escapeHtml(snapshot.revisitReason)}</span>`);
            const boundaryNote = snapshot.surveyResult === "no_detection_note" || snapshot.absenceSemantics === "protocol_note_only"
              ? "この観察は「見つからなかった」を不在の主張としては扱っていません。手順の注記としてだけ保持しています。"
              : "比較したい観察として、どれだけ歩いたか・手順・範囲を残した記録です。比較の精度を上げるための記録で、増減や不在をここだけで断定しません。";
            return `<div class="obs-story-block">
              <div class="obs-story-eyebrow">観察の手順</div>
              <p>この記録はその場の 1 枚ではなく、あとで比べられるように手順を付けて残した観察です。</p>
              ${protocolChips.length > 0 ? `<div class="obs-focus-meta">${protocolChips.join("")}</div>` : ""}
              ${surveyResultLabel ? `<p style="margin-top:10px">${escapeHtml(surveyResultLabel)}</p>` : ""}
              <small class="obs-ai-note">${escapeHtml(boundaryNote)}</small>
            </div>`;
          })()
        : "";
    const trustLadderBlock = `<details class="obs-trust-ladder">
      <summary class="obs-trust-summary">
        <span>
          <span class="obs-story-eyebrow">名前の確かさ</span>
          <strong>いまは「${escapeHtml(trustStageLabel)}」の段階です</strong>
        </span>
        <span class="obs-trust-toggle">詳しく</span>
      </summary>
      <p class="obs-trust-lead">${escapeHtml(trustLead)}</p>
      <div class="obs-trust-steps">
        ${trustSteps.map((step) => {
          const current =
            trustStage === step.id
            || (trustStage === "public_claim" && (step.id === "authority_backed" || step.id === "community_support" || step.id === "ai_suggestion"))
            || (trustStage === "authority_backed" && (step.id === "community_support" || step.id === "ai_suggestion"))
            || (trustStage === "community_support" && step.id === "ai_suggestion");
          const isCurrent = trustStage === step.id;
          return `<div class="obs-trust-step${current ? " is-reached" : ""}${isCurrent ? " is-current" : ""}">
            <div class="obs-trust-step-top">
              <span class="obs-trust-step-label">${escapeHtml(step.label)}</span>
              ${isCurrent ? `<span class="obs-trust-step-pill">現在地</span>` : ""}
            </div>
            <div class="obs-trust-step-meta">${escapeHtml(step.meta)}</div>
          </div>`;
        }).join("")}
      </div>
    </details>`;

    const focusRailBlock = featuredSubject
      ? (() => {
          const focusHeading = currentSubject && currentSubject.occurrenceId !== featuredSubject.occurrenceId
            ? `今見ている ${currentSubject.displayName} だけが主役とは限らず、${featuredSubject.displayName} がいちばん有力です。`
            : `${featuredSubject.displayName} を先に見ると、この観察の意味をつかみやすいです。`;
          const focusLead = `${bundle.selectedReason}。${subjectCount >= 2 ? "カードをタップすると、同定履歴・AIヒント・分類がその場で切り替わります。" : "この観察で見えている対象を、そのまま確かめられます。"}`;
          const featuredChips: string[] = [];
          if (featuredSubject.rank) featuredChips.push(`<span class="obs-focus-chip">${escapeHtml(featuredSubject.rank)}</span>`);
          if (featuredSubject.scientificName) featuredChips.push(`<span class="obs-focus-chip">🔬 ${escapeHtml(featuredSubject.scientificName)}</span>`);
          if (featuredSubject.identificationCount > 0) featuredChips.push(`<span class="obs-focus-chip">🧭 同定 ${featuredSubject.identificationCount} 件</span>`);
          if (featuredSubject.latestAssessmentBand && featuredSubject.latestAssessmentBand !== "unknown") {
            featuredChips.push(`<span class="obs-focus-chip">🤖 ${escapeHtml(confidenceLabel(featuredSubject.latestAssessmentBand))}</span>`);
          } else if (typeof featuredSubject.confidence === "number") {
            featuredChips.push(`<span class="obs-focus-chip">📷 ${Math.round(featuredSubject.confidence * 100)}%</span>`);
          }
          const cards = rankedSubjects.map((subject) => {
            const subjectHref = appendLangToHref(
              withBasePath(basePath, buildObservationDetailPath(bundle.visitId, subject.occurrenceId)),
              lang,
            );
            const subjectMeta: string[] = [];
            if (subject.rank) subjectMeta.push(subject.rank);
            if (subject.identificationCount > 0) subjectMeta.push(`同定 ${subject.identificationCount} 件`);
            else if (subject.latestAssessmentBand && subject.latestAssessmentBand !== "unknown") subjectMeta.push(`AI ${confidenceLabel(subject.latestAssessmentBand)}`);
            else if (typeof subject.confidence === "number") subjectMeta.push(`${Math.round(subject.confidence * 100)}%`);
            const stateLabel = subject.occurrenceId === bundle.canonicalSubjectId
              ? "表示中"
              : subject.occurrenceId === featuredSubject.occurrenceId
                ? "有力"
                : "";
            return `<a class="obs-focus-card${subject.occurrenceId === featuredSubject.occurrenceId ? " is-featured" : ""}${subject.occurrenceId === bundle.canonicalSubjectId ? " is-current" : ""}"
                     href="${escapeHtml(subjectHref)}"
                     data-subject-switch="1"
                     data-subject-id="${escapeHtml(subject.occurrenceId)}">
              <div class="obs-focus-card-top">
                <span class="obs-focus-card-role">${escapeHtml(subject.roleLabel)}</span>
                ${stateLabel ? `<span class="obs-focus-card-state" data-subject-state>${escapeHtml(stateLabel)}</span>` : `<span class="obs-focus-card-state" data-subject-state hidden></span>`}
              </div>
              <div class="obs-focus-card-name">${escapeHtml(subject.displayName)}</div>
              <div class="obs-focus-card-meta">${escapeHtml(subjectMeta.join(" · ") || subject.focusReason)}</div>
            </a>`;
          }).join("");
          return `<div class="obs-focus">
            <div class="obs-focus-head">
              <div>
                <div class="obs-story-eyebrow">この観察で見えている対象</div>
                <h2 class="obs-focus-title">${escapeHtml(focusHeading)}</h2>
                <p class="obs-focus-copy">${escapeHtml(focusLead)}</p>
              </div>
              <span class="obs-focus-pill">${subjectCount} 対象</span>
            </div>
            <div class="obs-focus-featured">
              <div>
                <div class="obs-focus-role">${escapeHtml(featuredSubject.roleLabel)}</div>
                <div class="obs-focus-name-row">
                  <span class="obs-focus-name">${escapeHtml(featuredSubject.displayName)}</span>
                  ${featuredSubject.rank ? `<span class="obs-focus-rank">${escapeHtml(featuredSubject.rank)}</span>` : ""}
                </div>
                <div class="obs-focus-meta">${featuredChips.join("")}</div>
              </div>
              <span class="obs-focus-open${bundle.lockedByHuman ? " is-current" : ""}">${escapeHtml(
                bundle.selectionSource === "specialist_lock"
                  ? "専門家固定"
                  : bundle.selectionSource === "human_consensus"
                    ? "コミュニティ安定"
                    : bundle.selectionSource === "latest_ai_default"
                      ? "AI 既定"
                      : "安定既定",
              )}</span>
            </div>
            ${subjectCount > 1 ? `<div class="obs-focus-rail">${cards}</div>` : ""}
          </div>`;
        })()
      : "";

    const heroBlock = `
      <section class="section obs-hero">
        <div class="obs-hero-media">${mediaBlock}</div>
        <div class="obs-hero-meta">
          <h1 class="obs-hero-title">この観察で見えている生きもの</h1>
          <div class="obs-hero-byline">
            <a class="obs-hero-observer" href="${escapeHtml(snapshot.observerUserId ? withBasePath(basePath, "/profile/" + encodeURIComponent(snapshot.observerUserId)) : "#")}">
              ${snapshot.observerAvatarUrl
                ? `<img class="obs-hero-avatar obs-hero-avatar-img" src="${escapeHtml(snapshot.observerAvatarUrl)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'obs-hero-avatar',textContent:${JSON.stringify((snapshot.observerName || "?").slice(0, 1))}}))" />`
                : `<span class="obs-hero-avatar">${escapeHtml((snapshot.observerName || "?").slice(0, 1))}</span>`}
              <span>${escapeHtml(snapshot.observerName || "観察者")}</span>
            </a>
            <span class="obs-hero-when">${escapeHtml(formatAbsolute(snapshot.observedAt))}</span>
            <span class="obs-hero-place">${escapeHtml(heroPlaceLabel)}</span>
          </div>
          ${badges.length > 0 ? `<div class="obs-hero-badges">${badges.join("")}</div>` : ""}
          ${focusRailBlock}
        </div>
      </section>`;

    const hintBlock = `<div data-obs-switch-hint>${renderSubjectHint(currentSubject, siteBriefResult ?? null, snapshot.photoAssets)}</div>`;

    // ===== Layer 1: 物語 =====
    const ownerNote = snapshot.note
      ? `<div class="obs-story-block">
           <div class="obs-story-eyebrow">観察者のメモ</div>
           <p>${escapeHtml(snapshot.note)}</p>
         </div>`
      : "";
    const aiFirst = obsContext && (obsContext.environmentContexts.length > 0 || obsContext.seasonalNotes.length > 0)
      ? `<div class="obs-story-block obs-story-ai">
           <div class="obs-story-eyebrow">🤖 AI が読み取った様子</div>
           ${obsContext.environmentContexts.map((e) => `<p>${escapeHtml(e)}</p>`).join("")}
           ${obsContext.seasonalNotes.map((e) => `<p>${escapeHtml(e)}</p>`).join("")}
           <small class="obs-ai-note">※ 上記は AI による自動解釈です。市民のみなさんの同定と合わせて確認してください。</small>
         </div>`
      : "";
    const footprintCard = observerStats
      ? `<div class="obs-footprint">
           <div class="obs-footprint-row">
             <span class="obs-footprint-num">#${observerStats.totalObservations}</span>
             <span class="obs-footprint-label">あなたの累計記録</span>
           </div>
           <div class="obs-footprint-row">
             <span class="obs-footprint-num">${observerStats.thisMonthObservations}</span>
             <span class="obs-footprint-label">今月の記録</span>
           </div>
           ${observerStats.placeVisitCount > 1 ? `<div class="obs-footprint-row">
             <span class="obs-footprint-num">${observerStats.placeVisitCount}</span>
             <span class="obs-footprint-label">この場所に来た回数</span>
           </div>` : ""}
           ${observerStats.currentStreakDays > 1 ? `<div class="obs-footprint-row">
             <span class="obs-footprint-num">${observerStats.currentStreakDays}</span>
             <span class="obs-footprint-label">連続観察日数</span>
           </div>` : ""}
         </div>`
      : "";
    const layer1 = (surveySummary || ownerNote || aiFirst || footprintCard)
      ? `<section class="section obs-layer obs-layer-1">
           <h2 class="obs-layer-title">この記録について</h2>
           <div class="obs-layer-body">${surveySummary}${ownerNote}${aiFirst}${footprintCard}</div>
         </section>`
      : "";

    // ===== Layer 2: 同定 =====
    const layer2 = `<div data-obs-switch-taxonomy>${renderSubjectTaxonomy(currentSubject, featuredSubject, subjectCount, bundle)}</div>`;

    // ===== Layer 3: 場所の物語 =====
    const nearbyCards = heavy && heavy.nearby.length > 0
      ? `<div class="obs-nearby-grid">
           ${heavy.nearby.map((n) => `
             <a class="obs-nearby-card" href="${escapeHtml(appendLangToHref(withBasePath(basePath, buildObservationDetailPath(n.occurrenceId, n.occurrenceId)), lang))}">
               ${n.photoUrl ? `<img src="${escapeHtml(toThumbnailUrl(n.photoUrl, "sm") ?? n.photoUrl)}" alt="${escapeHtml(n.displayName)}" loading="lazy" decoding="async" onerror="this.outerHTML='&lt;div class=&quot;obs-nearby-nophoto&quot;&gt;\u{1f4f7}&lt;/div&gt;'" />` : '<div class="obs-nearby-nophoto">📷</div>'}
               <div class="obs-nearby-body">
                 <div class="obs-nearby-name">${escapeHtml(n.displayName)}</div>
                 <div class="obs-nearby-meta">${escapeHtml(n.observerName)} · ${escapeHtml(n.observedAt)}</div>
               </div>
             </a>`).join("")}
         </div>`
      : "";
    const peersLine = heavy && heavy.peers.length > 0
      ? `<p class="obs-peers">この場所で観察した人は <strong>${heavy.peers.length}</strong> 人（${heavy.peers.map((p) => escapeHtml(p.displayName)).slice(0, 3).join(" / ")} 等）</p>`
      : "";
    const seasonalBar = heavy && heavy.seasonalHistory.length > 0
      ? `<div class="obs-seasonal">
           ${Array.from({ length: 12 }, (_, i) => {
             const h = heavy.seasonalHistory.find((s) => s.month === i + 1);
             const n = h ? h.count : 0;
             const max = Math.max(...heavy.seasonalHistory.map((s) => s.count), 1);
             return `<span class="obs-seasonal-bar" style="--h:${Math.round((n / max) * 100)}%" title="${i + 1}月: ${n}件"><small>${i + 1}</small></span>`;
           }).join("")}
         </div>`
      : "";
    const layer3 = (nearbyCards || peersLine || seasonalBar)
      ? `<section class="section obs-layer obs-layer-3">
           <h2 class="obs-layer-title">この場所の物語</h2>
           ${peersLine}
           ${nearbyCards}
           ${seasonalBar ? `<div class="obs-seasonal-wrap"><div class="obs-story-eyebrow">同地点の月別観察数</div>${seasonalBar}</div>` : ""}
         </section>`
      : "";

    // ===== Layer 5: CTA =====
    const ctaBlock = `
      <section class="section obs-layer obs-cta">
        <h2 class="obs-layer-title">次の一歩</h2>
        <div class="obs-cta-grid">
          <a class="obs-cta-item" href="${escapeHtml(withBasePath(basePath, "/record"))}">
            <span class="obs-cta-icon">📝</span>
            <span class="obs-cta-label">似た場面を記録する</span>
          </a>
          ${(snapshot.placeId || snapshot.publicLocation?.cellId) ? `<a class="obs-cta-item" href="${escapeHtml(detailMapHref)}">
            <span class="obs-cta-icon">🗺️</span>
            <span class="obs-cta-label">同じ場所を地図で見る</span>
          </a>` : ""}
          <a class="obs-cta-item" href="${escapeHtml(withBasePath(basePath, "/explore"))}">
            <span class="obs-cta-icon">🔍</span>
            <span class="obs-cta-label">似た観察を探す</span>
          </a>
          <a class="obs-cta-item" href="${escapeHtml(withBasePath(basePath, "/specialist/id-workbench"))}">
            <span class="obs-cta-icon">🔬</span>
            <span class="obs-cta-label">専門家の視点で見る</span>
          </a>
        </div>
      </section>`;

    // ===== Layer 6: 豆知識 =====
    const insightBits: string[] = [];
    if (insight && insight.etymology) insightBits.push(`<div class="obs-insight-item"><div class="obs-insight-eye">📖 名前の由来</div><p>${escapeHtml(insight.etymology)}</p></div>`);
    if (insight && insight.ecologyNote) insightBits.push(`<div class="obs-insight-item"><div class="obs-insight-eye">🌿 生き方</div><p>${escapeHtml(insight.ecologyNote)}</p></div>`);
    if (insight && insight.lookAlikeNote) insightBits.push(`<div class="obs-insight-item"><div class="obs-insight-eye">🔍 似た仲間</div><p>${escapeHtml(insight.lookAlikeNote)}</p></div>`);
    if (insight && insight.rarityNote) insightBits.push(`<div class="obs-insight-item"><div class="obs-insight-eye">📍 出会いやすさ</div><p>${escapeHtml(insight.rarityNote)}</p></div>`);
    const layer6 = insightBits.length > 0
      ? `<section class="section obs-layer obs-layer-6">
           <h2 class="obs-layer-title">この生きものについて</h2>
           <div class="obs-insight-grid">${insightBits.join("")}</div>
           <p class="obs-ai-note">🤖 この記述は AI が自動生成した参考情報です。専門書も合わせてご確認ください。</p>
         </section>`
      : "";

    // ===== コンテキスト折り畳み (Phase D 既存、保持) =====
    const grouped = obsContext ? groupFeaturesByLayer(obsContext.features) : { coexistingTaxa: [], environment: [], sounds: [] };
    const renderFeatureChips = (list: typeof grouped.coexistingTaxa): string =>
      list.map((f) => `<li class="obs-chip" title="${escapeHtml(f.note ?? "")}"><span class="obs-chip-name">${escapeHtml(f.name)}</span>${
        typeof f.confidence === "number" ? `<span class="obs-chip-conf">${Math.round(f.confidence * 100)}%</span>` : ""
      }<span class="obs-chip-src">${f.sourceKind === "audio" ? "🎤" : "📷"}</span></li>`).join("");
    const coexistingSection = grouped.coexistingTaxa.length > 0
      ? `<details class="obs-fold" open>
           <summary>🌿 同地点の生きもの <span class="obs-fold-count">${grouped.coexistingTaxa.length}</span></summary>
           <ul class="obs-chips">${renderFeatureChips(grouped.coexistingTaxa)}</ul>
         </details>` : "";
    const soundsSection = grouped.sounds.length > 0
      ? `<details class="obs-fold"><summary>🎤 音声で拾った <span class="obs-fold-count">${grouped.sounds.length}</span></summary><ul class="obs-chips">${renderFeatureChips(grouped.sounds)}</ul></details>` : "";
    const envSection = grouped.environment.length > 0
      ? `<details class="obs-fold"><summary>🏞️ 環境の情報 <span class="obs-fold-count">${grouped.environment.length}</span></summary><ul class="obs-chips">${renderFeatureChips(grouped.environment)}</ul></details>` : "";
    const contextBlock = (coexistingSection || soundsSection || envSection)
      ? `<section class="section obs-layer"><h2 class="obs-layer-title">写真と音声から拾えたこと</h2>${coexistingSection}${soundsSection}${envSection}</section>` : "";

    const subjectTemplates = bundle.subjects.map((subject) => `
      <template data-subject-hint-template="${escapeHtml(subject.occurrenceId)}">${renderSubjectHint(subject, siteBriefResult ?? null, snapshot.photoAssets)}</template>
      <template data-subject-taxonomy-template="${escapeHtml(subject.occurrenceId)}">${renderSubjectTaxonomy(subject, featuredSubject, subjectCount, bundle)}</template>`).join("");
    const layersGrid = `<div class="obs-layers-grid">${layer2}${layer6}${layer3}${layer1}${contextBlock}${ctaBlock}</div>`;
    const supportBlock = `<section class="section obs-support-panel" aria-label="補助情報">
      ${reactionBar
        ? `<div class="obs-support-actions">
             <h2 class="obs-support-title">この記録への反応</h2>
             ${reactionBar}
           </div>`
        : ""}
      ${trustLadderBlock}
    </section>`;
    const reassessButtons: string[] = [];
    if (isOwner) {
      reassessButtons.push(
        `<button type="button"
                 class="obs-reassess-btn"
                 data-reassess-endpoint="${escapeHtml(withBasePath(basePath, "/api/v1/observations/" + encodeURIComponent(bundle.visitId) + "/reassess"))}"
                 data-loading-text="再判定中…（写真を Gemini に渡しています）">🔄 写真から再判定</button>`,
      );
      if (snapshot.videoAssets.length > 0) {
        reassessButtons.push(
          `<button type="button"
                   class="obs-reassess-btn"
                   data-reassess-endpoint="${escapeHtml(withBasePath(basePath, "/api/v1/observations/" + encodeURIComponent(bundle.visitId) + "/reassess-from-video"))}"
                   data-loading-text="再判定中…（動画サムネイルを Gemini に渡しています）">🎬 動画から再判定</button>`,
        );
      }
    }
    const reassessBlock = isOwner
      ? `<section class="section obs-reassess-row" aria-label="AI 再判定">
           ${reassessButtons.join("")}
           <span class="obs-reassess-hint">${snapshot.videoAssets.length > 0 ? "写真か動画サムネイルを使って判定を更新できます（30秒ほど）。" : "写真から主役とまわりに写る生きものを拾い直します（30秒ほど）。"}</span>
           <span class="obs-reassess-status" data-reassess-status hidden></span>
         </section>`
      : "";
    const subjectRegionMap = toSubjectRegionMap(bundle.subjects);
    const switchScript = subjectCount > 1
      ? `<script>(function(){
           var currentSubjectId = ${JSON.stringify(bundle.canonicalSubjectId)};
           var featuredSubjectId = ${JSON.stringify(featuredSubject.occurrenceId)};
           var regionMap = ${JSON.stringify(subjectRegionMap)};
           var regionDisplayConfMin = ${REGION_DISPLAY_CONF_MIN};
           var links = Array.prototype.slice.call(document.querySelectorAll('[data-subject-switch][data-subject-id]'));
           var hintRoot = document.querySelector('[data-obs-switch-hint]');
           var taxonomyRoot = document.querySelector('[data-obs-switch-taxonomy]');
           var currentBadge = document.querySelector('[data-current-subject-badge]');
           var selectTemplate = function(attr, subjectId){
             return document.querySelector('template[' + attr + '="' + subjectId.replace(/"/g, '\\"') + '"]');
           };
           var renderRegions = function(subjectId){
             Array.prototype.slice.call(document.querySelectorAll('[data-region-layer]')).forEach(function(layer){ layer.innerHTML = ''; });
             var regions = regionMap[subjectId] || [];
             var visibleRegionCount = 0;
             regions.forEach(function(region){
               if (!region || !region.rect || !region.assetId) return;
               if (typeof region.confidenceScore === 'number' && region.confidenceScore < regionDisplayConfMin) return;
               var layer = document.querySelector('[data-region-layer="' + region.assetId.replace(/"/g, '\\"') + '"]');
               if (!layer) return;
               var box = document.createElement('span');
               box.className = 'obs-region-box';
               box.style.left = (region.rect.x * 100) + '%';
               box.style.top = (region.rect.y * 100) + '%';
               box.style.width = (region.rect.width * 100) + '%';
               box.style.height = (region.rect.height * 100) + '%';
               if (region.note) {
                 var label = document.createElement('span');
                 label.className = 'obs-region-box-label';
                 label.textContent = region.note;
                 box.appendChild(label);
               }
               layer.appendChild(box);
               visibleRegionCount += 1;
             });
             var regionSummary = document.querySelector('[data-region-summary]');
             if (regionSummary) {
               regionSummary.hidden = visibleRegionCount === 0;
                regionSummary.textContent = visibleRegionCount > 0 ? ${JSON.stringify(OBSERVATION_REGION_SUMMARY_TEXT)} : '';
             }
           };
           var updateStateLabels = function(subjectId){
             links.forEach(function(link){
               var isCurrent = link.getAttribute('data-subject-id') === subjectId;
               link.classList.toggle('is-current', isCurrent);
               var state = link.querySelector('[data-subject-state]');
               if (!state) return;
               if (isCurrent) {
                 state.hidden = false;
                 state.textContent = '表示中';
               } else if (link.getAttribute('data-subject-id') === featuredSubjectId) {
                 state.hidden = false;
                 state.textContent = '有力';
               } else {
                 state.hidden = true;
                 state.textContent = '';
               }
             });
             if (currentBadge) {
               currentBadge.hidden = subjectId === featuredSubjectId;
               var active = links.find(function(link){ return link.getAttribute('data-subject-id') === subjectId; });
               var nameEl = active ? active.querySelector('.obs-focus-card-name') : null;
               currentBadge.textContent = nameEl ? ('👀 表示中 ' + nameEl.textContent) : '';
             }
           };
           var renderSubject = function(subjectId, push){
             var hintTemplate = selectTemplate('data-subject-hint-template', subjectId);
             var taxonomyTemplate = selectTemplate('data-subject-taxonomy-template', subjectId);
             if (hintRoot && hintTemplate) hintRoot.innerHTML = hintTemplate.innerHTML;
             if (taxonomyRoot && taxonomyTemplate) taxonomyRoot.innerHTML = taxonomyTemplate.innerHTML;
             renderRegions(subjectId);
             updateStateLabels(subjectId);
             currentSubjectId = subjectId;
             if (push) {
               var active = links.find(function(link){ return link.getAttribute('data-subject-id') === subjectId; });
               if (active && active.href) history.pushState({ subject: subjectId }, '', active.href);
             }
           };
           links.forEach(function(link){
             link.addEventListener('click', function(event){
               if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
               event.preventDefault();
               var subjectId = link.getAttribute('data-subject-id');
               if (!subjectId || subjectId === currentSubjectId) return;
               renderSubject(subjectId, true);
             });
           });
           window.addEventListener('popstate', function(){
             var params = new URLSearchParams(window.location.search);
             var subjectId = params.get('subject');
             if (subjectId) renderSubject(subjectId, false);
           });
           renderSubject(currentSubjectId, false);
         })();</script>`
      : "";
    const reassessScript = isOwner
      ? `<script>(function(){
           var buttons = Array.prototype.slice.call(document.querySelectorAll('.obs-reassess-btn[data-reassess-endpoint]'));
           if (!buttons.length) return;
           var statusEl = document.querySelector('[data-reassess-status]');
           var setBusy = function(disabled) {
             buttons.forEach(function(button){ button.disabled = disabled; });
           };
           buttons.forEach(function(btn){
             btn.addEventListener('click', function(){
               var endpoint = btn.getAttribute('data-reassess-endpoint');
               if (!endpoint) return;
               var loadingText = btn.getAttribute('data-loading-text') || '再判定中…';
               setBusy(true);
               if (statusEl) { statusEl.hidden = false; statusEl.classList.remove('is-error'); statusEl.textContent = loadingText; }
               fetch(endpoint, { method: 'POST', credentials: 'include' })
                .then(function(r){ return r.json().then(function(j){ return { ok: r.ok && j && j.ok, j: j }; }); })
                .then(function(res){
                  if (!res.ok) {
                    if (statusEl) { statusEl.classList.add('is-error'); statusEl.textContent = '失敗: ' + ((res.j && res.j.error) || 'unknown_error'); }
                    setBusy(false);
                    return;
                  }
                  if (statusEl) { statusEl.textContent = '判定完了 — ページを更新します'; }
                  setTimeout(function(){ window.location.reload(); }, 600);
                })
                .catch(function(e){
                  if (statusEl) { statusEl.classList.add('is-error'); statusEl.textContent = '通信エラー: ' + (e && e.message || 'network'); }
                  setBusy(false);
                });
             });
           });
          })();</script>`
      : "";
    const detailBody = `${heroBlock}${reassessBlock}${hintBlock}${layersGrid}${supportBlock}<div hidden>${subjectTemplates}</div>${switchScript}${reassessScript}${galleryScript}`;

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${snapshot.displayName} | ikimon`,
      detailBody,
      "みつける",
      undefined,
      OBSERVATION_DETAIL_STYLES,
    );
  });

  app.get<{ Params: { userId: string } }>("/profile/:userId", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const snapshot = await getProfileSnapshot(request.params.userId);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Profile not found", stateCard("プロフィールなし", "このユーザーは見つかりません", "リンクが古い、または非公開の可能性があります。"), "ホーム");
    }
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const viewerSession = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const places = renderPlaceRows(
      basePath,
      lang,
      viewerSession?.userId ?? null,
      snapshot.recentPlaces,
      "まだ場所の記録はありません。",
    );
    const observations = snapshot.recentObservations.map((item) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, buildObservationDetailPath(item.detailId ?? item.visitId ?? item.occurrenceId, item.featuredOccurrenceId ?? item.occurrenceId)))}">
        <div>
          <div style="font-weight:800">${escapeHtml(item.displayName)}</div>
          <div class="meta">${escapeHtml(item.placeName)} · ${escapeHtml(item.observedAt)}</div>
        </div>
        <span class="pill">${item.identificationCount} ids</span>
      </a>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${snapshot.displayName} | ikimon`,
      `<section class="section"><div class="section-header"><div><div class="eyebrow">よく歩く場所</div><h2>最近の My places</h2></div></div><div class="list">${places || '<div class="row"><div>まだ場所の記録はありません。</div></div>'}</div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">ノート</div><h2>最近の観察</h2></div></div><div class="list">${observations || '<div class="row"><div>まだ観察はありません。</div></div>'}</div></section>`,
      "ホーム",
      {
        eyebrow: snapshot.rankLabel || "Observer",
        heading: snapshot.displayName,
        headingHtml: `<span data-testid="profile-heading">${escapeHtml(snapshot.displayName)}</span>`,
        lead: `この人のフィールドノート — 最近の場所と観察を追う。`,
        actions: [
          { href: `/home?userId=${encodeURIComponent(snapshot.userId)}`, label: "このユーザーのホームを見る" },
        ],
      },
      PLACE_REVISIT_ROW_STYLES,
    );
  });

  app.get("/profile", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const session = await getSessionFromCookie(request.headers.cookie);
    if (!session) {
      reply.code(401).type("text/html; charset=utf-8");
      return layout(basePath, "サインインが必要です", stateCard("サインイン", "プロフィールの表示にはサインインが必要です", "ログイン済みのセッションがまだありません。トップページからサインインしてください。"), "ホーム");
    }
    const snapshot = await getProfileSnapshot(session.userId);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Profile not found", stateCard("プロフィールなし", "まだ公開できるプロフィールがありません", "観察を 1 件でも記録するとプロフィールが育ち始めます。"), "ホーム");
    }
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const places = renderPlaceRows(
      basePath,
      lang,
      snapshot.userId,
      snapshot.recentPlaces,
      "まだ場所の記録はありません。",
    );
    const observations = snapshot.recentObservations.map((item) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, buildObservationDetailPath(item.detailId ?? item.visitId ?? item.occurrenceId, item.featuredOccurrenceId ?? item.occurrenceId)))}">
        <div>
          <div style="font-weight:800">${escapeHtml(item.displayName)}</div>
          <div class="meta">${escapeHtml(item.placeName)} · ${escapeHtml(item.observedAt)}</div>
        </div>
        <span class="pill">${item.identificationCount} ids</span>
      </a>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${snapshot.displayName} | ikimon`,
      `<section class="section"><div class="section-header"><div><div class="eyebrow">よく歩く場所</div><h2>最近の My places</h2></div></div><div class="list">${places || '<div class="row"><div>まだ場所の記録はありません。</div></div>'}</div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">ノート</div><h2>最近の観察</h2></div></div><div class="list">${observations || '<div class="row"><div>まだ観察はありません。</div></div>'}</div></section>`,
      "ホーム",
      {
        eyebrow: "あなたのプロフィール",
        heading: snapshot.displayName,
        headingHtml: `<span data-testid="profile-heading">${escapeHtml(snapshot.displayName)}</span>`,
        lead: `${snapshot.rankLabel || "Observer"} — あなたのフィールドノートと場所の記録。`,
        actions: [
          { href: "/notes", label: "ノートへ" },
          { href: "/home", label: "ホームへ", variant: "secondary" as const },
        ],
      },
      PLACE_REVISIT_ROW_STYLES,
    );
  });

  app.get("/api/v1/specialist/me/authorities", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) {
        reply.code(401);
        return {
          ok: false,
          error: "session_required",
        };
      }

      const access = await getReviewerAccessContext(session.userId, session.roleName, session.rankLabel);
      return {
        ok: true,
        globalRole: access.globalRole,
        hasSpecialistAccess: access.hasSpecialistAccess,
        authorities: access.activeAuthorities,
      };
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "specialist_authorities_lookup_failed",
      };
    }
  });

  app.get("/api/v1/authority/recommendations/me", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      if (!session) {
        reply.code(401);
        return {
          ok: false,
          error: "session_required",
        };
      }

      const recommendations = await listAuthorityRecommendationsForUser(session.userId);
      return {
        ok: true,
        recommendations,
      };
    } catch (error) {
      reply.code(400);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "authority_recommendations_lookup_failed",
      };
    }
  });

  app.get("/api/v1/specialist/recommendations/pending", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      const resolvedSession = await assertSpecialistSession(session, session?.userId ?? "");
      const recommendations = await listPendingAuthorityRecommendationsForReviewer({
        actorUserId: resolvedSession.userId,
        actorRoleName: resolvedSession.roleName,
        actorRankLabel: resolvedSession.rankLabel,
      });
      return {
        ok: true,
        recommendations,
      };
    } catch (error) {
      reply.code(error instanceof Error && error.message === "session_required" ? 401 : 403);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "specialist_recommendations_lookup_failed",
      };
    }
  });

  app.get("/api/v1/specialist/authorities/audit", async (request, reply) => {
    try {
      const session = await getSessionFromCookie(request.headers.cookie);
      assertSpecialistAdminSession(session, session?.userId ?? "");
      const query = (typeof request.query === "object" && request.query ? request.query : {}) as Record<string, unknown>;
      const rawAction = typeof query.action === "string" ? query.action.trim() : "";
      const rawStatus = typeof query.status === "string" ? query.status.trim() : "";
      const recommendations = await listReviewerAuthorityAudit({
        subjectUserId: typeof query.subjectUserId === "string" ? query.subjectUserId.trim() : null,
        scopeTaxonName: typeof query.scopeTaxonName === "string" ? query.scopeTaxonName.trim() : null,
        action: (rawAction === "grant" || rawAction === "revoke" || rawAction === "update")
          ? rawAction as ReviewerAuthorityAuditAction
          : null,
        status: rawStatus === "active" || rawStatus === "revoked" ? rawStatus : null,
        limit: typeof query.limit === "string" ? Number(query.limit) : undefined,
      });
      return {
        ok: true,
        audit: recommendations,
      };
    } catch (error) {
      reply.code(error instanceof Error && error.message === "session_required" ? 401 : 403);
      return {
        ok: false,
        error: error instanceof Error ? error.message : "specialist_authority_audit_lookup_failed",
      };
    }
  });

  app.get("/authority/recommendations", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const authorityRecommendationCopy = getShortCopy<any>(lang, "specialist", "authorityRecommendations.hero");
    const session = await getSessionFromCookie(request.headers.cookie);
    if (!session) {
      reply.code(401).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Authority recommendations",
        stateCard(
          "サインイン",
          "authority recommendation の申請にはサインインが必要です",
          `<p style="margin:0 0 12px">自分の学習証跡を積み上げて、分類群ごとの authority 候補として申請できます。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明を見る</a>
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }

    const recommendations = await listAuthorityRecommendationsForUser(session.userId);
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Authority recommendations | ikimon",
      `<section class="section"><div class="card"><div class="card-body">
          <div class="row">
            <div>
              <div class="eyebrow">Self claim</div>
              <h2>authority 候補として申請する</h2>
            </div>
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明</a>
          </div>
          <p class="meta">観察会・ウェビナー・論文・図鑑/雑誌などの学習証跡を添えて、自分の分類群スコープ recommendation を作成します。証跡だけでは自動昇格せず、同じ分類群 authority 保有者または運営の解決が必要です。</p>
          <form id="authority-recommendation-form" class="stack" style="margin-top:14px">
            <label class="stack"><span style="font-weight:700">Scope taxon name</span><input name="scopeTaxonName" type="text" placeholder="タンポポ属 / Taraxacum" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
              <label class="stack"><span style="font-weight:700">Scope taxon rank</span><input name="scopeTaxonRank" type="text" value="genus" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Scope taxon key</span><input name="scopeTaxonKey" type="text" placeholder="optional" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            </div>
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
              <label class="stack"><span style="font-weight:700">Evidence type</span>
                <select name="evidenceType" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8">
                  <option value="">なし</option>
                  <option value="field_event">観察会</option>
                  <option value="webinar">ウェビナー</option>
                  <option value="literature">論文・文献</option>
                  <option value="reference_owned">図鑑・雑誌</option>
                  <option value="other">その他</option>
                </select>
              </label>
              <label class="stack"><span style="font-weight:700">Evidence title</span><input name="evidenceTitle" type="text" placeholder="たんぽぽ観察会 2026-04-10" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Issuer</span><input name="evidenceIssuer" type="text" placeholder="浜松たんぽぽ会" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">URL</span><input name="evidenceUrl" type="url" placeholder="https://..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            </div>
            <label class="stack"><span style="font-weight:700">Evidence notes</span><textarea name="evidenceNotes" rows="3" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" placeholder="どこで学び、何をベースに見分けているか"></textarea></label>
            <div class="actions">
              <button class="btn" type="submit">申請する</button>
              <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の全文を読む</a>
            </div>
          </form>
          <div id="authority-recommendation-status" class="list" style="margin-top:14px"><div class="row"><div>Ready.</div></div></div>
        </div></div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">My recommendations</div><h2>自分の申請状況</h2></div></div>${renderAuthorityRecommendationCards(recommendations, { currentUserId: session.userId })}</section>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const form = document.getElementById('authority-recommendation-form');
        const status = document.getElementById('authority-recommendation-status');
        const setStatus = (html) => { status.innerHTML = html; };
        const reloadSoon = () => { window.setTimeout(() => window.location.reload(), 700); };
        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          const evidenceType = String(data.get('evidenceType') || '').trim();
          const evidenceTitle = String(data.get('evidenceTitle') || '').trim();
          const payload = {
            sourceKind: 'self_claim',
            scopeTaxonName: String(data.get('scopeTaxonName') || '').trim(),
            scopeTaxonRank: String(data.get('scopeTaxonRank') || '').trim() || null,
            scopeTaxonKey: String(data.get('scopeTaxonKey') || '').trim() || null,
            evidence: evidenceType && evidenceTitle ? [{
              evidenceType,
              title: evidenceTitle,
              issuerName: String(data.get('evidenceIssuer') || '').trim() || null,
              url: String(data.get('evidenceUrl') || '').trim() || null,
              notes: String(data.get('evidenceNotes') || '').trim() || null,
            }] : [],
          };
          if (!payload.scopeTaxonName) {
            setStatus('<div class="row"><div>scopeTaxonName は必須です。</div></div>');
            return;
          }
          setStatus('<div class="row"><div>Submitting recommendation...</div></div>');
          const response = await fetch(withBasePath('/api/v1/authority/recommendations'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(payload),
          });
          const json = await response.json();
          if (!response.ok || json.ok === false) {
            setStatus('<div class="row"><div>Submit failed.<div class="meta">' + String(json.error || 'authority_recommendation_create_failed') + '</div></div></div>');
            return;
          }
          setStatus('<div class="row"><div><strong>Recommendation created.</strong><div class="meta">' + String(json.recommendation && json.recommendation.scopeTaxonName || '') + '</div></div></div>');
          reloadSoon();
        });
      </script>`,
      "ホーム",
      {
        eyebrow: authorityRecommendationCopy.eyebrow,
        heading: authorityRecommendationCopy.heading,
        headingHtml: authorityRecommendationCopy.heading,
        lead: authorityRecommendationCopy.lead,
        actions: authorityRecommendationCopy.actions,
      },
    );
  });

  app.get("/specialist/id-workbench", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    try {
      await assertSpecialistSession(session, session?.userId ?? "");
    } catch {
      reply.code(403).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Specialist access required",
        stateCard(
          "Specialist only",
          "この画面は authority 付与済み reviewer 向けです",
          `<p style="margin:0 0 12px">レビュー queue と同定 workbench は、Admin / Analyst か、分類群 authority を持つ reviewer だけが入れます。制度の考え方と authority 候補になる道は説明ページにまとめています。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明を見る</a>
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }
    const requestedLane = typeof request.query === "object" && request.query && "lane" in request.query
      ? String((request.query as Record<string, unknown>).lane || "")
      : "";
    const lane = requestedLane === "public-claim" || requestedLane === "expert-lane" ? requestedLane : "default";
    const reviewerUserId = session?.userId ?? "";
    const access = await getReviewerAccessContext(reviewerUserId, session?.roleName, session?.rankLabel);
    const snapshot = await getSpecialistSnapshot(lane, {
      userId: reviewerUserId,
      roleName: session?.roleName,
      rankLabel: session?.rankLabel,
    });
    const workbenchCopy = getShortCopy<any>(lang, "specialist", "idWorkbench.hero");
    const laneTitle =
      lane === "public-claim"
        ? workbenchCopy.publicClaim.heading
        : lane === "expert-lane"
          ? workbenchCopy.expertLane.heading
          : workbenchCopy.default.heading;
    const laneLead =
      lane === "public-claim"
        ? workbenchCopy.publicClaim.lead
        : lane === "expert-lane"
          ? workbenchCopy.expertLane.lead
          : workbenchCopy.default.lead;
    const scopeSummary = renderAuthoritySummaryChips(access.activeAuthorities);
    const scopeMeta = access.canManageAll
      ? `<div class="meta">Analyst / Admin は全分類群にアクセスできます。authority を付けると reviewer の担当範囲も絞れます。</div>`
      : `<div class="meta">表示中の queue は、あなたに付与された分類群 authority に一致する観察だけです。</div>`;
    const manageAuthorityAction = access.canManageAll
      ? `<a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/authority-admin"))}">Authority admin</a>`
      : `<a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明</a>`;
    const rows = snapshot.queue.map((item) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, buildObservationDetailPath(item.detailId ?? item.visitId ?? item.occurrenceId, item.featuredOccurrenceId ?? item.occurrenceId)))}">
        <div>
          <div style="font-weight:800">${escapeHtml(item.displayName)}</div>
          <div class="meta">${escapeHtml(item.placeName)} · ${escapeHtml(item.observedAt)}</div>
          <div class="meta">${escapeHtml(item.observerName)} · ${escapeHtml(item.municipality || "Municipality unknown")}</div>
        </div>
        <span class="pill">${item.identificationCount} ids</span>
      </a>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${laneTitle} | ikimon`,
      `<section class="section"><div class="card is-soft"><div class="card-body stack">
          <div class="row">
            <div>
              <div class="eyebrow">Current scope</div>
              <h2 style="margin:6px 0 0">担当できる分類群</h2>
            </div>
            ${manageAuthorityAction}
          </div>
          ${scopeSummary}
          ${scopeMeta}
        </div></div></section>
      <section class="section"><div class="card"><div class="card-body">
          <div class="eyebrow">Action</div>
          <h2>Minimal specialist action</h2>
          <form id="specialist-review-form" class="stack" style="margin-top:14px">
            <input name="actorUserId" type="hidden" value="${escapeHtml(reviewerUserId)}" />
            <div class="row"><div><strong>Signed in reviewer</strong><div class="meta">${escapeHtml(reviewerUserId)}</div></div><span class="pill">${escapeHtml(session?.rankLabel || session?.roleName || "reviewer")}</span></div>
            <label class="stack"><span style="font-weight:700">Occurrence ID</span><input name="occurrenceId" type="text" placeholder="occ:..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <label class="stack"><span style="font-weight:700">Proposed name</span><input name="proposedName" type="text" placeholder="Scientific or common name" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <label class="stack"><span style="font-weight:700">Proposed rank</span><input name="proposedRank" type="text" value="species" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            <label class="stack"><span style="font-weight:700">Note</span><textarea name="notes" rows="3" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" placeholder="どの根拠でこの同定にしたか"></textarea></label>
            <div class="actions">
              <button class="btn" type="button" data-decision="approve">Approve</button>
              <button class="btn secondary" type="button" data-decision="reject">Reject</button>
              <button class="btn secondary" type="button" data-decision="note">Note</button>
            </div>
          </form>
          <div id="specialist-review-status" class="list" style="margin-top:14px"><div class="row"><div>Ready.</div></div></div>
        </div></div>
      </section>
      <section class="section">
        <div class="grid">
          <div class="card is-soft"><div class="card-body"><div class="eyebrow">Summary</div><h2>${snapshot.summary.unresolvedOccurrences}</h2><p class="meta">unresolved occurrences / ${snapshot.summary.totalOccurrences} total</p></div></div>
          <div class="card is-soft"><div class="card-body"><div class="eyebrow">Identifications</div><h2>${snapshot.summary.identificationCount}</h2><p class="meta">current identification rows in v2</p></div></div>
          <div class="card is-soft"><div class="card-body"><div class="eyebrow">Observation photos</div><h2>${snapshot.summary.observationPhotoAssets}</h2><p class="meta">photo assets available for review</p></div></div>
        </div>
      </section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">Queue</div><h2>レビュー待ちの観察</h2></div></div><div class="list">${rows || '<div class="row"><div>キューに観察はありません。</div></div>'}</div></section>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const lane = ${JSON.stringify(lane)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const form = document.getElementById('specialist-review-form');
        const status = document.getElementById('specialist-review-status');
        const setStatus = (html) => { status.innerHTML = html; };
        form.querySelectorAll('button[data-decision]').forEach((button) => {
          button.addEventListener('click', async () => {
            const data = new FormData(form);
            const occurrenceId = String(data.get('occurrenceId') || '');
            const actorUserId = String(data.get('actorUserId') || '');
            const proposedName = String(data.get('proposedName') || '').trim();
            const proposedRank = String(data.get('proposedRank') || '');
            const notes = String(data.get('notes') || '');
            const decision = button.getAttribute('data-decision');
            if (!occurrenceId || !actorUserId) {
              setStatus('<div class="row"><div>occurrenceId と actorUserId は必須です。</div></div>');
              return;
            }
            if (decision === 'approve' && !proposedName) {
              setStatus('<div class="row"><div>Approve には proposedName が必要です。</div></div>');
              return;
            }
            setStatus('<div class="row"><div>Submitting specialist review...</div></div>');
            const response = await fetch(withBasePath('/api/v1/specialist/occurrences/' + encodeURIComponent(occurrenceId) + '/review'), {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ actorUserId, lane, decision, proposedName, proposedRank, notes }),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Submit failed.<div class="meta">' + String(json.error || 'specialist_review_failed') + '</div></div></div>');
              return;
            }
            const scope = json.authorityScope && json.authorityScope.scopeTaxonName
              ? ' · ' + String(json.authorityScope.scopeTaxonName)
              : '';
            setStatus('<div class="row"><div><strong>Review saved.</strong><div class="meta">' + String(json.decision || decision) + ' · ' + String(json.reviewClass || 'plain_review') + scope + ' · ' + String(json.occurrenceId || occurrenceId) + '</div></div></div>');
          });
        });
      </script>`,
      "ホーム",
      {
        eyebrow: workbenchCopy.eyebrow,
        heading: laneTitle,
        headingHtml: escapeHtml(laneTitle),
        lead: laneLead,
        actions: workbenchCopy.actions,
      },
    );
  });

  app.get("/specialist/recommendations", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const recommendationsCopy = getShortCopy<any>(lang, "specialist", "recommendations.hero");
    const session = await getSessionFromCookie(request.headers.cookie);
    let resolvedSession;
    try {
      resolvedSession = await assertSpecialistSession(session, session?.userId ?? "");
    } catch {
      reply.code(403).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Specialist access required",
        stateCard(
          "Specialist only",
          "この画面は authority 付与済み reviewer 向けです",
          `<p style="margin:0 0 12px">pending recommendation を解決できるのは、同じ分類群 scope の authority 保有者、または運営権限を持つアカウントです。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明を見る</a>
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }

    const access = await getReviewerAccessContext(
      resolvedSession.userId,
      resolvedSession.roleName,
      resolvedSession.rankLabel,
    );
    const pendingRecommendations = await listPendingAuthorityRecommendationsForReviewer({
      actorUserId: resolvedSession.userId,
      actorRoleName: resolvedSession.roleName,
      actorRankLabel: resolvedSession.rankLabel,
    });

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Specialist recommendations | ikimon",
      `<section class="section"><div class="card is-soft"><div class="card-body stack">
          <div class="row">
            <div>
              <div class="eyebrow">Current scope</div>
              <h2 style="margin:6px 0 0">解決できる分類群</h2>
            </div>
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明</a>
          </div>
          ${renderAuthoritySummaryChips(access.activeAuthorities)}
          <div class="meta">${access.canManageAll ? "Admin / Analyst は全 pending recommendation を横断で確認できます。" : "自分の authority scope に一致する pending recommendation だけが表示されます。"}</div>
        </div></div></section>
      ${access.canManageAll
        ? `<section class="section"><div class="card"><div class="card-body">
            <div class="eyebrow">Ops registered</div>
            <h2>運営が pending recommendation を登録する</h2>
            <form id="ops-recommendation-form" class="stack" style="margin-top:14px">
              <label class="stack"><span style="font-weight:700">Subject user ID</span><input name="subjectUserId" type="text" placeholder="reviewer-user-id" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
              <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
                <label class="stack"><span style="font-weight:700">Scope taxon name</span><input name="scopeTaxonName" type="text" placeholder="タンポポ属 / Taraxacum" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
                <label class="stack"><span style="font-weight:700">Scope taxon rank</span><input name="scopeTaxonRank" type="text" value="genus" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
                <label class="stack"><span style="font-weight:700">Scope taxon key</span><input name="scopeTaxonKey" type="text" placeholder="optional" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              </div>
              <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
                <label class="stack"><span style="font-weight:700">Evidence type</span>
                  <select name="evidenceType" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8">
                    <option value="">なし</option>
                    <option value="field_event">観察会</option>
                    <option value="webinar">ウェビナー</option>
                    <option value="literature">論文・文献</option>
                    <option value="reference_owned">図鑑・雑誌</option>
                    <option value="other">その他</option>
                  </select>
                </label>
                <label class="stack"><span style="font-weight:700">Evidence title</span><input name="evidenceTitle" type="text" placeholder="たんぽぽ観察会 2026-04-10" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
                <label class="stack"><span style="font-weight:700">Issuer</span><input name="evidenceIssuer" type="text" placeholder="浜松たんぽぽ会" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
                <label class="stack"><span style="font-weight:700">URL</span><input name="evidenceUrl" type="url" placeholder="https://..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              </div>
              <label class="stack"><span style="font-weight:700">Evidence notes</span><textarea name="evidenceNotes" rows="3" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" placeholder="参加履歴・読んだ文献・保有資料など"></textarea></label>
              <div class="actions">
                <button class="btn" type="submit">Pending 登録</button>
                <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/authority-admin"))}">Authority admin</a>
              </div>
            </form>
          </div></div></section>`
        : ""}
      <section class="section"><div class="section-header"><div><div class="eyebrow">Pending queue</div><h2>解決待ち recommendation</h2></div></div>${renderAuthorityRecommendationCards(pendingRecommendations, { showGrantActions: true, canReject: access.canManageAll })}</section>
      <div id="specialist-recommendation-status" class="section"><div class="list"><div class="row"><div>Ready.</div></div></div></div>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const actorUserId = ${JSON.stringify(resolvedSession.userId)};
        const canReject = ${JSON.stringify(access.canManageAll)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const statusHost = document.getElementById('specialist-recommendation-status');
        const setStatus = (html) => { statusHost.innerHTML = '<div class="list">' + html + '</div>'; };
        const reloadSoon = () => { window.setTimeout(() => window.location.reload(), 700); };
        document.querySelectorAll('[data-grant-recommendation]').forEach((button) => {
          button.addEventListener('click', async () => {
            const recommendationId = button.getAttribute('data-grant-recommendation');
            const resolutionNote = window.prompt('Grant note (optional)', '') || null;
            if (!recommendationId) return;
            setStatus('<div class="row"><div>Granting recommendation...</div></div>');
            const response = await fetch(withBasePath('/api/v1/specialist/recommendations/' + encodeURIComponent(recommendationId) + '/grant'), {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ actorUserId, resolutionNote }),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Grant failed.<div class="meta">' + String(json.error || 'authority_recommendation_grant_failed') + '</div></div></div>');
              return;
            }
            setStatus('<div class="row"><div><strong>Recommendation granted.</strong><div class="meta">' + String(json.recommendation && json.recommendation.scopeTaxonName || '') + '</div></div></div>');
            reloadSoon();
          });
        });
        if (canReject) {
          document.querySelectorAll('[data-reject-recommendation]').forEach((button) => {
            button.addEventListener('click', async () => {
              const recommendationId = button.getAttribute('data-reject-recommendation');
              const resolutionNote = window.prompt('Reject reason を入力してください', 'needs more evidence');
              if (!recommendationId || !resolutionNote) return;
              setStatus('<div class="row"><div>Rejecting recommendation...</div></div>');
              const response = await fetch(withBasePath('/api/v1/specialist/recommendations/' + encodeURIComponent(recommendationId) + '/reject'), {
                method: 'POST',
                credentials: 'include',
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                body: JSON.stringify({ resolutionNote }),
              });
              const json = await response.json();
              if (!response.ok || json.ok === false) {
                setStatus('<div class="row"><div>Reject failed.<div class="meta">' + String(json.error || 'authority_recommendation_reject_failed') + '</div></div></div>');
                return;
              }
              setStatus('<div class="row"><div><strong>Recommendation rejected.</strong><div class="meta">' + String(json.recommendation && json.recommendation.scopeTaxonName || '') + '</div></div></div>');
              reloadSoon();
            });
          });
        }
        const opsForm = document.getElementById('ops-recommendation-form');
        if (opsForm) {
          opsForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const data = new FormData(opsForm);
            const evidenceType = String(data.get('evidenceType') || '').trim();
            const evidenceTitle = String(data.get('evidenceTitle') || '').trim();
            const payload = {
              sourceKind: 'ops_registered',
              subjectUserId: String(data.get('subjectUserId') || '').trim(),
              scopeTaxonName: String(data.get('scopeTaxonName') || '').trim(),
              scopeTaxonRank: String(data.get('scopeTaxonRank') || '').trim() || null,
              scopeTaxonKey: String(data.get('scopeTaxonKey') || '').trim() || null,
              evidence: evidenceType && evidenceTitle ? [{
                evidenceType,
                title: evidenceTitle,
                issuerName: String(data.get('evidenceIssuer') || '').trim() || null,
                url: String(data.get('evidenceUrl') || '').trim() || null,
                notes: String(data.get('evidenceNotes') || '').trim() || null,
              }] : [],
            };
            if (!payload.subjectUserId || !payload.scopeTaxonName) {
              setStatus('<div class="row"><div>subjectUserId と scopeTaxonName は必須です。</div></div>');
              return;
            }
            setStatus('<div class="row"><div>Creating pending recommendation...</div></div>');
            const response = await fetch(withBasePath('/api/v1/authority/recommendations'), {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify(payload),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Create failed.<div class="meta">' + String(json.error || 'authority_recommendation_create_failed') + '</div></div></div>');
              return;
            }
            setStatus('<div class="row"><div><strong>Pending recommendation created.</strong><div class="meta">' + String(json.recommendation && json.recommendation.scopeTaxonName || '') + '</div></div></div>');
            reloadSoon();
          });
        }
      </script>`,
      "ホーム",
      {
        eyebrow: recommendationsCopy.eyebrow,
        heading: recommendationsCopy.heading,
        headingHtml: recommendationsCopy.heading,
        lead: recommendationsCopy.lead,
        actions: recommendationsCopy.actions,
      },
    );
  });

  app.get("/specialist/authority-audit", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const auditCopy = getShortCopy<any>(lang, "specialist", "authorityAudit.hero");
    const session = await getSessionFromCookie(request.headers.cookie);
    try {
      assertSpecialistAdminSession(session, session?.userId ?? "");
    } catch {
      reply.code(403).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Authority audit required",
        stateCard(
          "Admin only",
          "authority 監査ログは Analyst / Admin 専用です",
          `<p style="margin:0 0 12px">grant / revoke / update の痕跡は一般公開せず、運営が追跡できる面に閉じています。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明を見る</a>
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/specialist/authority-admin"))}">Authority admin へ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }

    const query = (typeof request.query === "object" && request.query ? request.query : {}) as Record<string, unknown>;
    const subjectUserId = typeof query.subjectUserId === "string" ? query.subjectUserId.trim() : "";
    const scopeTaxonName = typeof query.scopeTaxonName === "string" ? query.scopeTaxonName.trim() : "";
    const action = typeof query.action === "string" ? query.action.trim() : "";
    const status = typeof query.status === "string" ? query.status.trim() : "";
    const audit = await listReviewerAuthorityAudit({
      subjectUserId: subjectUserId || null,
      scopeTaxonName: scopeTaxonName || null,
      action: action === "grant" || action === "revoke" || action === "update" ? action as ReviewerAuthorityAuditAction : null,
      status: status === "active" || status === "revoked" ? status : null,
      limit: typeof query.limit === "string" ? Number(query.limit) : 60,
    });

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Authority audit | ikimon",
      `<section class="section"><div class="card"><div class="card-body">
          <div class="row">
            <div>
              <div class="eyebrow">Filters</div>
              <h2>grant / revoke / update を追う</h2>
            </div>
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明</a>
          </div>
          <form class="stack" method="get" action="${escapeHtml(withBasePath(basePath, "/specialist/authority-audit"))}" style="margin-top:14px">
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
              <label class="stack"><span style="font-weight:700">Subject user ID</span><input name="subjectUserId" type="text" value="${escapeHtml(subjectUserId)}" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Scope taxon name</span><input name="scopeTaxonName" type="text" value="${escapeHtml(scopeTaxonName)}" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Action</span>
                <select name="action" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8">
                  <option value="">all</option>
                  <option value="grant"${action === "grant" ? " selected" : ""}>grant</option>
                  <option value="update"${action === "update" ? " selected" : ""}>update</option>
                  <option value="revoke"${action === "revoke" ? " selected" : ""}>revoke</option>
                </select>
              </label>
              <label class="stack"><span style="font-weight:700">Status</span>
                <select name="status" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8">
                  <option value="">all</option>
                  <option value="active"${status === "active" ? " selected" : ""}>active</option>
                  <option value="revoked"${status === "revoked" ? " selected" : ""}>revoked</option>
                </select>
              </label>
            </div>
            <div class="actions">
              <button class="btn" type="submit">絞り込む</button>
              <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/authority-admin"))}">Authority admin</a>
            </div>
          </form>
        </div></div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">Recent-first</div><h2>authority audit</h2></div></div>${renderAuthorityAuditCards(audit)}</section>`,
      "ホーム",
      {
        eyebrow: auditCopy.eyebrow,
        heading: auditCopy.heading,
        headingHtml: auditCopy.heading,
        lead: auditCopy.lead,
        actions: auditCopy.actions,
      },
    );
  });

  app.get("/specialist/authority-admin", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const authorityAdminCopy = getShortCopy<any>(lang, "specialist", "authorityAdmin.hero");
    const session = await getSessionFromCookie(request.headers.cookie);
    try {
      assertSpecialistAdminSession(session, session?.userId ?? "");
    } catch {
      reply.code(403).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Authority admin required",
        stateCard(
          "Admin only",
          "authority 管理は Analyst / Admin 専用です",
          `<p style="margin:0 0 12px">grant / revoke / evidence 追加は運営権限を持つアカウントだけが実行できます。制度の考え方は公開ページにまとめています。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明を見る</a>
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/specialist/id-workbench?lane=expert-lane"))}">専門確認へ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }

    const authorities = await listRecentReviewerAuthorities(24);

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Authority Admin | ikimon",
      `<section class="section"><div class="card"><div class="card-body">
          <div class="eyebrow">Grant authority</div>
          <h2>分類群 authority を付与する</h2>
          <form id="authority-grant-form" class="stack" style="margin-top:14px">
            <label class="stack"><span style="font-weight:700">Subject user ID</span><input name="subjectUserId" type="text" placeholder="reviewer-user-id" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <label class="stack"><span style="font-weight:700">Scope taxon name</span><input name="scopeTaxonName" type="text" placeholder="タンポポ属 / Taraxacum" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <label class="stack"><span style="font-weight:700">Scope taxon rank</span><input name="scopeTaxonRank" type="text" value="genus" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            <label class="stack"><span style="font-weight:700">Scope taxon key</span><input name="scopeTaxonKey" type="text" placeholder="optional" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            <label class="stack"><span style="font-weight:700">Reason</span><textarea name="reason" rows="3" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" placeholder="例: たんぽぽ観察会で見分け方実習を完了"></textarea></label>
            <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
              <label class="stack"><span style="font-weight:700">Evidence type</span>
                <select name="evidenceType" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8">
                  <option value="">なし</option>
                  <option value="field_event">観察会</option>
                  <option value="webinar">ウェビナー</option>
                  <option value="literature">論文・文献</option>
                  <option value="reference_owned">図鑑・雑誌</option>
                  <option value="other">その他</option>
                </select>
              </label>
              <label class="stack"><span style="font-weight:700">Evidence title</span><input name="evidenceTitle" type="text" placeholder="たんぽぽ観察会 2026-04-01" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">Issuer</span><input name="evidenceIssuer" type="text" placeholder="浜松たんぽぽ会" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
              <label class="stack"><span style="font-weight:700">URL</span><input name="evidenceUrl" type="url" placeholder="https://..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            </div>
            <label class="stack"><span style="font-weight:700">Evidence notes</span><textarea name="evidenceNotes" rows="2" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" placeholder="アフィリエイト URL などは sourcePayload 側に後から追記可能"></textarea></label>
            <div class="actions">
              <button class="btn" type="submit">Grant</button>
              <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/authority-audit"))}">Audit を見る</a>
              <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/id-workbench?lane=expert-lane"))}">専門確認へ戻る</a>
            </div>
          </form>
          <div id="authority-admin-status" class="list" style="margin-top:14px"><div class="row"><div>Ready.</div></div></div>
        </div></div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">Recent authorities</div><h2>最近の grant / revoke</h2></div></div>${renderAuthorityCards(authorities)}</section>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const form = document.getElementById('authority-grant-form');
        const status = document.getElementById('authority-admin-status');
        const setStatus = (html) => { status.innerHTML = html; };
        const reloadSoon = () => { window.setTimeout(() => window.location.reload(), 700); };

        form.addEventListener('submit', async (event) => {
          event.preventDefault();
          const data = new FormData(form);
          const evidenceType = String(data.get('evidenceType') || '').trim();
          const evidenceTitle = String(data.get('evidenceTitle') || '').trim();
          const payload = {
            subjectUserId: String(data.get('subjectUserId') || '').trim(),
            scopeTaxonName: String(data.get('scopeTaxonName') || '').trim(),
            scopeTaxonRank: String(data.get('scopeTaxonRank') || '').trim() || null,
            scopeTaxonKey: String(data.get('scopeTaxonKey') || '').trim() || null,
            reason: String(data.get('reason') || '').trim() || null,
            evidence: evidenceType && evidenceTitle ? [{
              evidenceType,
              title: evidenceTitle,
              issuerName: String(data.get('evidenceIssuer') || '').trim() || null,
              url: String(data.get('evidenceUrl') || '').trim() || null,
              notes: String(data.get('evidenceNotes') || '').trim() || null,
            }] : [],
          };
          if (!payload.subjectUserId || !payload.scopeTaxonName) {
            setStatus('<div class="row"><div>subjectUserId と scopeTaxonName は必須です。</div></div>');
            return;
          }
          setStatus('<div class="row"><div>Granting authority...</div></div>');
          const response = await fetch(withBasePath('/api/v1/specialist/authorities/grant'), {
            method: 'POST',
            credentials: 'include',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify(payload),
          });
          const json = await response.json();
          if (!response.ok || json.ok === false) {
            setStatus('<div class="row"><div>Grant failed.<div class="meta">' + String(json.error || 'specialist_authority_grant_failed') + '</div></div></div>');
            return;
          }
          setStatus('<div class="row"><div><strong>Authority granted.</strong><div class="meta">' + String(json.authority && json.authority.scopeTaxonName || '') + ' → ' + String(json.authority && json.authority.subjectUserId || '') + '</div></div></div>');
          reloadSoon();
        });

        document.querySelectorAll('[data-revoke-authority]').forEach((button) => {
          button.addEventListener('click', async () => {
            const authorityId = button.getAttribute('data-revoke-authority');
            const reason = window.prompt('Revoke reason を入力してください', 'scope review completed');
            if (!authorityId || !reason) return;
            setStatus('<div class="row"><div>Revoking authority...</div></div>');
            const response = await fetch(withBasePath('/api/v1/specialist/authorities/' + encodeURIComponent(authorityId) + '/revoke'), {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ reason }),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Revoke failed.<div class="meta">' + String(json.error || 'specialist_authority_revoke_failed') + '</div></div></div>');
              return;
            }
            setStatus('<div class="row"><div><strong>Authority revoked.</strong><div class="meta">' + String(json.authority && json.authority.scopeTaxonName || '') + '</div></div></div>');
            reloadSoon();
          });
        });

        document.querySelectorAll('[data-add-evidence]').forEach((button) => {
          button.addEventListener('click', async () => {
            const authorityId = button.getAttribute('data-add-evidence');
            const evidenceType = window.prompt('Evidence type: field_event / webinar / literature / reference_owned / other', 'field_event');
            if (!authorityId || !evidenceType) return;
            const title = window.prompt('Evidence title', '');
            if (!title) return;
            const issuerName = window.prompt('Issuer name (optional)', '') || null;
            const url = window.prompt('URL (optional)', '') || null;
            const notes = window.prompt('Notes (optional)', '') || null;
            setStatus('<div class="row"><div>Adding evidence...</div></div>');
            const response = await fetch(withBasePath('/api/v1/specialist/authorities/' + encodeURIComponent(authorityId) + '/evidence'), {
              method: 'POST',
              credentials: 'include',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ evidenceType, title, issuerName, url, notes }),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Evidence add failed.<div class="meta">' + String(json.error || 'specialist_authority_evidence_failed') + '</div></div></div>');
              return;
            }
            setStatus('<div class="row"><div><strong>Evidence added.</strong><div class="meta">' + String(json.authority && json.authority.scopeTaxonName || '') + '</div></div></div>');
            reloadSoon();
          });
        });
      </script>`,
      "ホーム",
      {
        eyebrow: authorityAdminCopy.eyebrow,
        heading: authorityAdminCopy.heading,
        headingHtml: authorityAdminCopy.heading,
        lead: authorityAdminCopy.lead,
        actions: authorityAdminCopy.actions,
      },
    );
  });

  app.get("/specialist/review-queue", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const reviewQueueCopy = getShortCopy<any>(lang, "specialist", "reviewQueue.hero");
    const session = await getSessionFromCookie(request.headers.cookie);
    try {
      await assertSpecialistSession(session, session?.userId ?? "");
    } catch {
      reply.code(403).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Specialist access required",
        stateCard(
          "Specialist only",
          "この画面は authority 付与済み reviewer 向けです",
          `<p style="margin:0 0 12px">review-queue は broad triage 面ですが、閲覧できるのは Admin / Analyst か、分類群 authority を持つ reviewer だけです。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明を見る</a>
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }
    const reviewerUserId = session?.userId ?? "";
    const access = await getReviewerAccessContext(reviewerUserId, session?.roleName, session?.rankLabel);
    const snapshot = await getSpecialistSnapshot("review-queue", {
      userId: reviewerUserId,
      roleName: session?.roleName,
      rankLabel: session?.rankLabel,
    });
    const scopeSummary = renderAuthoritySummaryChips(access.activeAuthorities);
    const scopeMeta = access.canManageAll
      ? `<div class="meta">Analyst / Admin は全分類群の broad triage を確認できます。</div>`
      : `<div class="meta">review-queue でも、あなたの authority scope に一致する観察だけが表示されます。</div>`;
    const manageAuthorityAction = access.canManageAll
      ? `<a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/specialist/authority-admin"))}">Authority admin</a>`
      : `<a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/learn/methodology"))}">制度の説明</a>`;
    const rows = snapshot.queue.map((item) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, buildObservationDetailPath(item.detailId ?? item.visitId ?? item.occurrenceId, item.featuredOccurrenceId ?? item.occurrenceId)))}">
        <div>
          <div style="font-weight:800">${escapeHtml(item.displayName)}</div>
          <div class="meta">${escapeHtml(item.placeName)} · ${escapeHtml(item.observedAt)}</div>
          <div class="meta">${escapeHtml(item.observerName)} · ${item.identificationCount} ids</div>
        </div>
        <span class="pill">Open</span>
      </a>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "Review Queue | ikimon",
      `<section class="section"><div class="card is-soft"><div class="card-body stack">
          <div class="row">
            <div>
              <div class="eyebrow">Current scope</div>
              <h2 style="margin:6px 0 0">この queue で見える分類群</h2>
            </div>
            ${manageAuthorityAction}
          </div>
          ${scopeSummary}
          ${scopeMeta}
        </div></div></section>
      <section class="section"><div class="card"><div class="card-body">
          <div class="eyebrow">Action</div>
          <h2>Minimal review action</h2>
          <form id="review-queue-form" class="stack" style="margin-top:14px">
            <input name="actorUserId" type="hidden" value="${escapeHtml(reviewerUserId)}" />
            <div class="row"><div><strong>Signed in reviewer</strong><div class="meta">${escapeHtml(reviewerUserId)}</div></div><span class="pill">${escapeHtml(session?.rankLabel || session?.roleName || "reviewer")}</span></div>
            <label class="stack"><span style="font-weight:700">Occurrence ID</span><input name="occurrenceId" type="text" placeholder="occ:..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <label class="stack"><span style="font-weight:700">Proposed name</span><input name="proposedName" type="text" placeholder="Approve 時に必須" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            <label class="stack"><span style="font-weight:700">Proposed rank</span><input name="proposedRank" type="text" value="species" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            <label class="stack"><span style="font-weight:700">Note</span><textarea name="notes" rows="3" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" placeholder="triage メモや差し戻し理由"></textarea></label>
            <div class="actions">
              <button class="btn" type="button" data-decision="approve">Approve</button>
              <button class="btn secondary" type="button" data-decision="reject">Reject</button>
              <button class="btn secondary" type="button" data-decision="note">Note</button>
            </div>
          </form>
          <div id="review-queue-status" class="list" style="margin-top:14px"><div class="row"><div>Ready.</div></div></div>
        </div></div>
      </section>
      <section class="section"><div class="grid">
        <div class="card is-soft"><div class="card-body"><div class="eyebrow">Queue size</div><h2>${snapshot.queue.length}</h2><p class="meta">review shell に表示中の observation sample</p></div></div>
        <div class="card is-soft"><div class="card-body"><div class="eyebrow">Unresolved</div><h2>${snapshot.summary.unresolvedOccurrences}</h2><p class="meta">unresolved occurrences across v2</p></div></div>
      </div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">Review sample</div><h2>レビュー対象</h2></div></div><div class="list">${rows || '<div class="row"><div>キューに観察はありません。</div></div>'}</div></section>
      <script>
        const basePath = ${JSON.stringify(basePath)};
        const withBasePath = (path) => basePath ? basePath + (path.startsWith('/') ? path : '/' + path) : path;
        const form = document.getElementById('review-queue-form');
        const status = document.getElementById('review-queue-status');
        const setStatus = (html) => { status.innerHTML = html; };
        form.querySelectorAll('button[data-decision]').forEach((button) => {
          button.addEventListener('click', async () => {
            const data = new FormData(form);
            const occurrenceId = String(data.get('occurrenceId') || '');
            const actorUserId = String(data.get('actorUserId') || '');
            const proposedName = String(data.get('proposedName') || '').trim();
            const proposedRank = String(data.get('proposedRank') || '');
            const notes = String(data.get('notes') || '');
            const decision = button.getAttribute('data-decision');
            if (!occurrenceId || !actorUserId) {
              setStatus('<div class="row"><div>occurrenceId と actorUserId は必須です。</div></div>');
              return;
            }
            if (decision === 'approve' && !proposedName) {
              setStatus('<div class="row"><div>Approve には proposedName が必要です。</div></div>');
              return;
            }
            setStatus('<div class="row"><div>Submitting review action...</div></div>');
            const response = await fetch(withBasePath('/api/v1/specialist/occurrences/' + encodeURIComponent(occurrenceId) + '/review'), {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ actorUserId, lane: 'review-queue', decision, proposedName, proposedRank, notes }),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Submit failed.<div class="meta">' + String(json.error || 'specialist_review_failed') + '</div></div></div>');
              return;
            }
            const scope = json.authorityScope && json.authorityScope.scopeTaxonName
              ? ' · ' + String(json.authorityScope.scopeTaxonName)
              : '';
            setStatus('<div class="row"><div><strong>Review saved.</strong><div class="meta">' + String(json.decision || decision) + ' · ' + String(json.reviewClass || 'plain_review') + scope + ' · ' + String(json.occurrenceId || occurrenceId) + '</div></div></div>');
          });
        });
      </script>`,
      "ホーム",
      {
        eyebrow: reviewQueueCopy.eyebrow,
        heading: reviewQueueCopy.heading,
        headingHtml: reviewQueueCopy.heading,
        lead: reviewQueueCopy.lead,
        actions: reviewQueueCopy.actions,
      },
    );
  });

  /* -------------------------------------------------------------- */
  /* Field Note main entry (/notes) — user's own notebook           */
  /* -------------------------------------------------------------- */
  app.get("/notes", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const notesPageCopy = getShortCopy<any>(lang, "public", "read.notes");
    const sharedCopy = getShortCopy<PublicSharedCopy>(lang, "shared", "publicShared");
    const session = await getSessionFromCookie(request.headers.cookie);
    const { viewerUserId } = resolveViewer(request.query, session);
    const snapshot = await getLandingSnapshot(viewerUserId);

    const isLoggedIn = Boolean(viewerUserId);
    const ownCards = snapshot.myFeed
      .map((obs) => renderObservationCard(basePath, lang, obs, { locationMode: "owner" }))
      .join("");
    const nearbyCards = snapshot.feed
      .slice(0, 9)
      .map((obs) => renderObservationCard(basePath, lang, obs, { compact: true, locationMode: "public" }))
      .join("");

    const emptyCopy = notesPageCopy.sections.nearbyEmpty;
    const nearbyCopy = notesPageCopy.sections.nearbyTitle;
    const myCopy = notesPageCopy.sections.ownTitle;
    const placeRows = renderPlaceRows(
      basePath,
      lang,
      viewerUserId,
      snapshot.myPlaces,
      "まだ再訪したい場所はありません。",
    );

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: notesPageCopy.title,
      activeNav: notesPageCopy.activeNav,
      lang,
      extraStyles: `${OBSERVATION_CARD_STYLES}
        .notes-page { margin-top: 24px; }
        .notes-head { display: flex; flex-direction: column; gap: 8px; justify-content: flex-start; align-items: flex-start; margin-bottom: 16px; }
        .notes-head h2 { margin: 0; }
        .notes-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .notes-grid.is-compact { grid-template-columns: 1fr; gap: 12px; }
        ${PLACE_REVISIT_ROW_STYLES}
      `,
      hero: {
        eyebrow: notesPageCopy.hero.eyebrow,
        heading: notesPageCopy.hero.heading,
        headingHtml: notesPageCopy.hero.heading,
        lead: notesPageCopy.hero.lead,
        tone: "light",
        align: "center",
        actions: [
          { href: "/record", label: sharedCopy.cta.record },
          { href: "/map", label: sharedCopy.cta.openMap, variant: "secondary" as const },
        ],
      },
      body: `${isLoggedIn ? `<section class="section notes-page" data-testid="notes-places">
        <div class="notes-head"><div><h2>よく歩く場所</h2></div></div>
        <div class="list">${placeRows}</div>
      </section>` : ""}
      <section class="section notes-page" data-testid="notes-own">
        <div class="notes-head"><div><h2>${escapeHtml(myCopy)}</h2></div></div>
        ${isLoggedIn
          ? (ownCards
              ? `<div class="notes-grid">${ownCards}</div>`
              : `<div class="onboarding-empty">
                  <div class="eyebrow">${escapeHtml(notesPageCopy.sections.loggedInEyebrow)}</div>
                  <h3>${escapeHtml(notesPageCopy.sections.loggedInTitle)}</h3>
                  <p>${escapeHtml(notesPageCopy.sections.loggedInBody)}</p>
                  <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/record"))}">${escapeHtml(sharedCopy.cta.record)}</a>
                </div>`)
          : `<div class="onboarding-empty">
              <div class="eyebrow">${escapeHtml(notesPageCopy.sections.guestEyebrow)}</div>
              <h3>${escapeHtml(notesPageCopy.sections.guestTitle)}</h3>
              <p>${escapeHtml(notesPageCopy.sections.guestBody)}</p>
              <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/record"))}">${escapeHtml(sharedCopy.cta.record)}</a>
            </div>`}
      </section>
      <section class="section notes-page" data-testid="notes-nearby">
        <div class="notes-head"><div><h2>${escapeHtml(nearbyCopy)}</h2></div></div>
        ${nearbyCards
          ? `<div class="notes-grid is-compact">${nearbyCards}</div>`
          : `<div class="card"><div class="card-body"><p class="meta">${escapeHtml(emptyCopy)}</p></div></div>`}
      </section>`,
      footerNote: notesPageCopy.footerNote,
    });
  });

  /* -------------------------------------------------------------- */
  /* AI Lens entry (/lens) — marketing + CTA into /record           */
  /* -------------------------------------------------------------- */
  app.get("/lens", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const lensPageCopy = getShortCopy<any>(lang, "public", "read.lens");
    const sharedCopy = getShortCopy<PublicSharedCopy>(lang, "shared", "publicShared");

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lensPageCopy.title,
      activeNav: lensPageCopy.activeNav,
      lang,
      hero: {
        eyebrow: lensPageCopy.hero.eyebrow,
        heading: lensPageCopy.hero.heading,
        headingHtml: lensPageCopy.hero.heading,
        lead: lensPageCopy.hero.lead,
        tone: "light",
        align: "center",
        actions: [
          { href: "/record", label: sharedCopy.cta.record },
          { href: "/notes", label: sharedCopy.cta.openNotebook, variant: "secondary" as const },
        ],
      },
      body: `<section class="section">
        <div class="list">
          ${lensPageCopy.steps.map((step: { title: string; body: string }) => `<div class="row"><div><strong>${escapeHtml(step.title)}</strong><div class="meta">${escapeHtml(step.body)}</div></div></div>`).join("")}
        </div>
      </section>
      <section class="section">${renderPublicRouteCardGrid(lensPageCopy.guidanceCards as PublicRouteCard[], basePath, lang, "btn btn-solid")}</section>
      <section class="section">${renderPublicRouteCardGrid(lensPageCopy.followupCards as PublicRouteCard[], basePath, lang, "inline-link")}</section>`,
      footerNote: lensPageCopy.footerNote,
    });
  });

  /* -------------------------------------------------------------- */
  /* Map (/map) — full Map Explorer (tabs, filters, basemaps, xlinks)*/
  /* -------------------------------------------------------------- */
  app.get("/map", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const mapPageCopy = getShortCopy<any>(lang, "public", "read.map");

    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 10; y -= 1) years.push(y);

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: mapPageCopy.title,
      activeNav: mapPageCopy.activeNav,
      lang,
      shellClassName: "shell-bleed shell-map",
      extraStyles: MAP_EXPLORER_STYLES,
      // Deliberately no hero: a map page should land on the map, not on
      // a wall of text. The explorer component carries a tight eyebrow
      // strip at the top so context is still one line away.
      body: `${renderMapExplorer({ basePath, lang, years })}
${mapExplorerBootScript({ basePath, lang })}`,
      footerNote: mapPageCopy.footerNote,
    });
  });

  app.get("/guide", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const guidePageCopy = getShortCopy<any>(lang, "public", "read.guide");
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: guidePageCopy.title,
      activeNav: guidePageCopy.activeNav,
      lang,
      extraStyles: GUIDE_FLOW_STYLES,
      body: renderGuideFlow(basePath, lang),
      footerNote: guidePageCopy.footerNote,
    });
  });
}

// Keep the legacy mini map exports accessible so TypeScript doesn't mark them unused.
void MAP_MINI_STYLES;
void mapMiniBootScript;
void renderMapMini;
void toMapMiniCells;
void getLandingSnapshot;
