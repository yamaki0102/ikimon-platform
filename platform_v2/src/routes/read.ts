import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getShortCopy } from "../content/index.js";
import { JA_PUBLIC_SHARED_COPY } from "../copy/jaPublic.js";
import { getSessionFromCookie, type SessionSnapshot } from "../services/authSession.js";
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
import { getIdentificationConsensus, type IdentificationConsensusResult } from "../services/identificationConsensus.js";
import { getObserverStats } from "../services/observerStats.js";
import { buildObserverProfileHref } from "../services/observerProfileLink.js";
import { getTaxonInsight } from "../services/taxonInsights.js";
import { getSiteBrief, type SiteBrief } from "../services/siteBrief.js";
import { getObservationDetailHeavy, type SiblingSubject } from "../services/observationDetailHeavy.js";
import {
  confidenceLabel,
  invasiveActionLabel,
  mhlwCategoryLabel,
  sizeClassLabel,
  type InvasiveResponse,
  type NoveltyHint,
  type SizeAssessment,
} from "../services/observationAiAssessment.js";
import {
  getObservationVisitBundle,
  type ObservationVisitBundle,
  type ObservationVisitCandidate,
  type ObservationVisitSubject,
} from "../services/observationVisitBundle.js";
import { buildPublicMapCellHref } from "../services/publicLocation.js";
import {
  getExploreSnapshot,
  getHomeSnapshot,
  getObservationDetailSnapshot,
  getProfileSnapshot,
  getSpecialistSnapshot,
  type HomePlace,
  type LandingObservation,
  type LandingSnapshot,
  type ProfileSnapshot,
} from "../services/readModels.js";
import { getProfileNoteDigest, type ProfileNoteDigest } from "../services/profileNoteDigest.js";
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
  currentPath?: string,
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
    currentPath,
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

function canUseSpecialistWorkbench(session: SessionSnapshot | null | undefined): boolean {
  if (!session || session.banned) return false;
  const role = `${session.roleName ?? ""} ${session.rankLabel ?? ""}`.toLowerCase();
  return /admin|analyst|specialist|reviewer|authority|expert|curator/.test(role);
}

function consensusStatusLabel(status: IdentificationConsensusResult["consensusStatus"] | null | undefined): string {
  switch (status) {
    case "community_consensus":
      return "分類合意あり";
    case "authority_backed":
      return "専門確認あり";
    case "open_dispute":
      return "反対意見あり";
    case "gbif_match_failed":
      return "分類名の照合待ち";
    case "lineage_conflict":
      return "分類系列の整理待ち";
    case "single_identification":
      return "同定1件";
    default:
      return "同定待ち";
  }
}

function verificationStatusLabel(status: IdentificationConsensusResult["identificationVerificationStatus"] | null | undefined): string {
  switch (status) {
    case "authority_reviewed":
      return "authority / expert review 済み";
    case "community_consensus":
      return "community consensus 済み";
    case "blocked_open_dispute":
      return "open dispute により保留";
    case "blocked_taxonomy_match":
      return "GBIF backbone 照合待ち";
    case "blocked_lineage_conflict":
      return "分類系列の衝突を確認中";
    case "needs_media":
      return "証拠メディア待ち";
    case "needs_identification":
      return "同定待ち";
    default:
      return "追加レビュー待ち";
  }
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
  .obs-identify-panel { grid-column: 1 / -1; border-color: rgba(14,165,233,.18); background: linear-gradient(180deg, #ffffff, #f8fafc); }
  .obs-identify-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
  .obs-identify-pill { display: inline-flex; align-items: center; min-height: 30px; padding: 5px 12px; border-radius: 999px; background: rgba(14,165,233,.1); color: #0369a1; font-size: 11.5px; font-weight: 900; white-space: nowrap; }
  .obs-consensus-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 10px; }
  .obs-consensus-card { display: grid; gap: 5px; padding: 13px 14px; border-radius: 13px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
  .obs-consensus-card span { font-size: 10.5px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; color: #64748b; }
  .obs-consensus-card strong { font-size: 14px; color: #0f172a; line-height: 1.45; }
  .obs-needed-box { padding: 13px 15px; border-radius: 13px; background: rgba(254,249,195,.62); border: 1px solid rgba(234,179,8,.22); }
  .obs-needed-box ul { margin: 6px 0 0; padding-left: 18px; color: #713f12; font-size: 13px; line-height: 1.7; }
  .obs-identify-split { display: grid; grid-template-columns: 1fr; gap: 14px; }
  @media (min-width: 880px) { .obs-identify-split { grid-template-columns: .92fr 1.08fr; } }
  .obs-identify-split h3 { margin: 0 0 9px; font-size: 14px; color: #0f172a; font-weight: 900; }
  .obs-dispute-list { display: grid; gap: 8px; }
  .obs-dispute-item { padding: 12px 13px; border-radius: 12px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
  .obs-dispute-item.is-open { border-color: rgba(239,68,68,.28); background: rgba(254,242,242,.72); }
  .obs-dispute-top { display: flex; justify-content: space-between; gap: 8px; align-items: center; }
  .obs-dispute-top strong { font-size: 13px; color: #0f172a; }
  .obs-dispute-top span { padding: 2px 8px; border-radius: 999px; background: rgba(15,23,42,.08); color: #475569; font-size: 10px; font-weight: 900; }
  .obs-dispute-name { margin-top: 5px; font-size: 13px; font-weight: 900; color: #991b1b; }
  .obs-dispute-item p { margin: 6px 0 0; color: #475569; font-size: 12.5px; line-height: 1.6; }
  .obs-identify-form { display: grid; gap: 11px; }
  .obs-identify-fields { display: grid; grid-template-columns: 1fr; gap: 10px; }
  @media (min-width: 720px) { .obs-identify-fields { grid-template-columns: 1fr 160px; } .obs-identify-fields .is-wide { grid-column: 1 / -1; } }
  .obs-identify-fields label { display: grid; gap: 5px; font-size: 12px; font-weight: 900; color: #334155; }
  .obs-identify-fields input, .obs-identify-fields textarea { width: 100%; border: 1px solid rgba(15,23,42,.14); border-radius: 12px; padding: 12px 13px; font: inherit; background: #fff; color: #0f172a; }
  .obs-identify-fields input { min-height: 50px; }
  .obs-identify-fields textarea { min-height: 104px; resize: vertical; }
  .obs-identify-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .obs-identify-actions .btn { min-height: 52px; padding-inline: 16px; }
  .obs-identify-status { min-height: 32px; padding: 8px 10px; border-radius: 10px; background: #f8fafc; color: #475569; font-size: 12px; font-weight: 800; }
  .obs-identify-status.is-error { color: #b91c1c; background: #fef2f2; }
  .obs-identify-login { padding: 13px 14px; border-radius: 12px; background: #f8fafc; border: 1px dashed rgba(15,23,42,.14); }
  .obs-identify-login p { margin: 5px 0 0; color: #64748b; font-size: 12.5px; line-height: 1.6; }
  .obs-specialist-link { display: inline-flex; margin-top: 10px; font-weight: 900; color: #0369a1; text-decoration: none; }
  @media (max-width: 640px) {
    .obs-identify-panel { padding: 16px; border-radius: 16px; }
    .obs-identify-head { flex-direction: column; align-items: stretch; }
    .obs-identify-pill { align-self: flex-start; min-height: 34px; }
    .obs-consensus-grid { grid-template-columns: 1fr; }
    .obs-identify-actions { display: grid; grid-template-columns: 1fr; }
    .obs-identify-actions .btn { width: 100%; min-height: 56px; white-space: normal; border-radius: 14px; }
    .obs-needed-box { padding: 12px 13px; }
    .obs-identify-split { gap: 18px; }
    .obs-ai-cutout { padding: 14px; border-radius: 16px; }
    .obs-ai-cutout-head { display: grid; }
    .obs-ai-cutout-card { grid-template-columns: 1fr; }
    .obs-ai-cutout-action, .obs-ai-cutout-learn { width: 100%; min-height: 52px; border-radius: 14px; white-space: normal; }
  }

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
  .obs-ai-cutout { margin-top: 16px; padding: 16px; border-radius: 18px; background: linear-gradient(135deg, rgba(236,253,245,.94), rgba(239,246,255,.94)); border: 1px solid rgba(16,185,129,.2); display: grid; gap: 12px; box-shadow: 0 12px 28px rgba(15,23,42,.06); }
  .obs-ai-cutout-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .obs-ai-cutout-eye { margin: 0 0 4px; color: #047857; font-size: 10.5px; font-weight: 950; letter-spacing: .12em; text-transform: uppercase; }
  .obs-ai-cutout-title { margin: 0; color: #0f172a; font-size: 15.5px; line-height: 1.45; font-weight: 950; }
  .obs-ai-cutout-copy { margin: 5px 0 0; color: #475569; font-size: 12.5px; line-height: 1.65; font-weight: 750; }
  .obs-ai-cutout-pill { flex-shrink: 0; display: inline-flex; align-items: center; min-height: 30px; padding: 6px 10px; border-radius: 999px; background: rgba(16,185,129,.14); color: #065f46; font-size: 11px; line-height: 1; font-weight: 950; white-space: nowrap; }
  .obs-ai-cutout-grid { display: grid; gap: 9px; }
  .obs-ai-cutout-card { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 12px; border-radius: 14px; background: rgba(255,255,255,.86); border: 1px solid rgba(15,23,42,.08); }
  .obs-ai-cutout-card strong { display: block; color: #0f172a; font-size: 14px; line-height: 1.35; }
  .obs-ai-cutout-meta { margin-top: 5px; display: flex; flex-wrap: wrap; gap: 6px; }
  .obs-ai-cutout-meta span { display: inline-flex; align-items: center; min-height: 24px; padding: 4px 8px; border-radius: 999px; background: rgba(15,23,42,.06); color: #475569; font-size: 10.5px; line-height: 1; font-weight: 900; }
  .obs-ai-cutout-note { margin: 7px 0 0; color: #64748b; font-size: 11.5px; line-height: 1.55; font-weight: 700; }
  .obs-ai-cutout-action { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 10px 13px; border: 0; border-radius: 999px; background: #059669; color: #fff; font-size: 12px; line-height: 1.25; font-weight: 950; cursor: pointer; box-shadow: 0 8px 18px rgba(5,150,105,.18); white-space: nowrap; }
  .obs-ai-cutout-action:disabled { cursor: wait; opacity: .72; }
  .obs-ai-cutout-learn { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; padding: 9px 12px; border-radius: 999px; background: rgba(255,255,255,.8); border: 1px solid rgba(15,23,42,.1); color: #0369a1; font-size: 12px; font-weight: 950; text-decoration: none; white-space: nowrap; }
  .obs-ai-cutout-status { min-height: 28px; padding: 7px 10px; border-radius: 10px; background: rgba(255,255,255,.74); color: #475569; font-size: 11.5px; font-weight: 850; }
  .obs-ai-cutout-status.is-error { background: #fef2f2; color: #b91c1c; }

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
  .obs-cta-item { min-height: 82px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; padding: 16px 12px; border-radius: 14px; background: linear-gradient(135deg, #f0fdf4, #ecfdf5); border: 1px solid rgba(16,185,129,.15); text-decoration: none; color: #064e3b; font-weight: 800; transition: transform .15s ease; }
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
    <div class="card is-soft" style="padding:24px;border-radius:24px;background:linear-gradient(135deg,rgba(236,253,245,.92),rgba(240,249,255,.94));border:1px solid rgba(16,185,129,.18);box-shadow:0 16px 36px rgba(15,23,42,.06)">
      <div class="eyebrow">${escapeHtml(eyebrow)}</div>
      <h2 style="margin-top:8px">${escapeHtml(title)}</h2>
      <div style="margin-top:8px;color:#475569;line-height:1.7">${body}</div>
    </div>
  </section>`;
}

type RankedSubject = SiblingSubject & {
  focusScore: number;
  focusReason: string;
  roleLabel: string;
};

const AI_CANDIDATE_CUTOUT_CONFIDENCE_MIN = 0.78;

function candidateHasVisibleRegion(candidate: ObservationVisitCandidate): boolean {
  return candidate.regions.some((region) => {
    if (!region.rect) return false;
    return (region.confidenceScore ?? 1) >= 0.5;
  });
}

function highLearningCandidates(candidates: ObservationVisitCandidate[]): ObservationVisitCandidate[] {
  return candidates
    .filter((candidate) => {
      if (candidate.suggestedOccurrenceId) return false;
      if (candidate.candidateStatus !== "proposed" && candidate.candidateStatus !== "matched") return false;
      if ((candidate.confidence ?? 0) < AI_CANDIDATE_CUTOUT_CONFIDENCE_MIN) return false;
      return candidateHasVisibleRegion(candidate);
    })
    .slice(0, 3);
}

function renderAiCandidateLearningPanel(options: {
  basePath: string;
  lang: SiteLang;
  visitId: string;
  candidates: ObservationVisitCandidate[];
  isOwner: boolean;
}): string {
  const candidates = highLearningCandidates(options.candidates);
  if (candidates.length === 0) return "";
  const identifyHref = appendLangToHref(withBasePath(options.basePath, `/observations/${encodeURIComponent(options.visitId)}#identify`), options.lang);
  return `<section class="obs-ai-cutout" data-ai-cutout-panel>
    <div class="obs-ai-cutout-head">
      <div>
        <p class="obs-ai-cutout-eye">AI が見つけたかもしれないもの</p>
        <h2 class="obs-ai-cutout-title">写真の中に、別の観察として残せそうな候補があります</h2>
        <p class="obs-ai-cutout-copy">いきものに詳しくなくても大丈夫です。AI が自信の高いものだけ先に整理しています。名前は候補なので、あとから人の確認で直せます。</p>
      </div>
      <span class="obs-ai-cutout-pill">${candidates.length} 件</span>
    </div>
    <div class="obs-ai-cutout-grid">
      ${candidates.map((candidate) => {
        const confidence = typeof candidate.confidence === "number" ? Math.round(candidate.confidence * 100) : null;
        const meta = [
          confidence != null ? `${confidence}%` : null,
          candidate.rank || null,
          candidate.regions.length > 0 ? "位置の手がかりあり" : null,
        ].filter((item): item is string => Boolean(item));
        const action = options.isOwner
          ? `<button type="button"
               class="obs-ai-cutout-action"
               data-adopt-candidate="${escapeHtml(candidate.candidateId)}"
               data-adopt-endpoint="${escapeHtml(withBasePath(options.basePath, `/api/v1/observations/${encodeURIComponent(options.visitId)}/candidates/${encodeURIComponent(candidate.candidateId)}/adopt`))}">
               別の観察として残す
             </button>`
          : `<a class="obs-ai-cutout-learn" href="${escapeHtml(identifyHref)}">見分けに参加する</a>`;
        return `<div class="obs-ai-cutout-card">
          <div>
            <strong>${escapeHtml(candidate.displayName)}</strong>
            ${meta.length > 0 ? `<div class="obs-ai-cutout-meta">${meta.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
            ${candidate.note ? `<p class="obs-ai-cutout-note">${escapeHtml(candidate.note)}</p>` : `<p class="obs-ai-cutout-note">同じ写真から切り出せる候補です。まずは仮の観察として残し、あとで確かめます。</p>`}
          </div>
          ${action}
        </div>`;
      }).join("")}
    </div>
    <div class="obs-ai-cutout-status" data-adopt-candidate-status>${options.isOwner ? "残すと、同じ日時・同じ場所・同じ写真に紐づく別対象として追加されます。" : "記録者以外は同定で手伝えます。候補は確定名ではありません。"}</div>
  </section>`;
}

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

function renderInvasiveCard(invasive: InvasiveResponse, subjectName: string): string {
  const categoryLabel = mhlwCategoryLabel(invasive.mhlwCategory);
  const pillClass = invasive.mhlwCategory ? `detail-pill detail-pill--${invasive.mhlwCategory}` : "detail-pill detail-pill--prevention";
  const actionLabel = invasiveActionLabel(invasive.recommendedAction);
  const isStrict = invasive.mhlwCategory === "iaspecified";
  const legalBlock = invasive.legalWarning
    ? `<div class="detail-warning-box">⚖️ ${escapeHtml(invasive.legalWarning)}</div>`
    : "";
  const regional = invasive.regionalCaveat
    ? `<p class="detail-card-meta">📍 地域差: ${escapeHtml(invasive.regionalCaveat)}</p>`
    : "";
  const basis = invasive.actionBasis
    ? `<p class="detail-card-meta">出典: ${escapeHtml(invasive.actionBasis)}</p>`
    : "";
  const followBtn = subjectName
    ? `<button class="detail-action-btn" type="button" data-follow-taxon="${escapeHtml(subjectName)}">この種をフォロー</button>`
    : "";
  const reportBtn = isStrict
    ? `<a class="detail-action-btn detail-action-btn--danger" href="https://www.env.go.jp/nature/intro/4control/list.html" target="_blank" rel="noopener">環境省に通報</a>`
    : "";
  return `<section class="detail-card detail-card--lens-invasive">
    <h3 class="detail-card-title">🚨 外来種の可能性 <span class="${pillClass}">${escapeHtml(categoryLabel || "外来種")}</span></h3>
    <div class="detail-card-body">
      ${actionLabel ? `<p style="font-size:18px;font-weight:800;margin:6px 0 4px">推奨対応: ${escapeHtml(actionLabel)}</p>` : ""}
      ${legalBlock}
      ${basis}
      ${regional}
    </div>
    <div class="detail-action-row">
      ${followBtn}
      ${reportBtn}
    </div>
    <p class="detail-card-hedge">${escapeHtml(invasive.hedge)} 駆除前に必ずお住まいの自治体（環境部局）にご確認ください。</p>
  </section>`;
}

function renderSizeCard(size: SizeAssessment, subjectName: string): string {
  const cls = size.sizeClass;
  const isExceptional = cls === "exceptional";
  const pill = isExceptional
    ? `<span class="detail-pill detail-pill--exceptional">${escapeHtml(sizeClassLabel(cls))}</span>`
    : cls
      ? `<span class="detail-pill" style="background:rgba(59,130,246,.10);color:#1e3a8a">${escapeHtml(sizeClassLabel(cls))}</span>`
      : "";
  const typical = size.typicalSizeCm !== null
    ? `<p style="margin:4px 0;font-size:15px">平均サイズ: <strong>${size.typicalSizeCm.toFixed(1)} cm</strong></p>`
    : "";
  const observed = size.observedSizeEstimateCm !== null
    ? `<p style="margin:4px 0;font-size:18px">この個体: <strong>${size.observedSizeEstimateCm.toFixed(1)} cm</strong></p>`
    : `<p class="detail-card-meta">画像内のスケール参照（手・指・コインなど）が見当たらず、長さ推定はできていません。</p>`;
  const ranking = size.rankingHint
    ? `<p style="margin:4px 0;color:var(--accent-hover);font-weight:700">${escapeHtml(size.rankingHint)}</p>`
    : "";
  const basis = size.basis
    ? `<p class="detail-card-meta">推定根拠: ${escapeHtml(size.basis)}</p>`
    : "";
  const _name = subjectName;
  void _name;
  return `<section class="detail-card detail-card--lens-size">
    <h3 class="detail-card-title">📏 大きさの目安 ${pill}</h3>
    <div class="detail-card-body">
      ${typical}
      ${observed}
      ${ranking}
      ${basis}
    </div>
    <p class="detail-card-hedge">${escapeHtml(size.hedge)}</p>
  </section>`;
}

function renderNoveltyCard(novelty: NoveltyHint): string {
  const pct = novelty.noveltyScore !== null ? Math.round(novelty.noveltyScore * 100) : null;
  return `<section class="detail-card detail-card--lens-novelty">
    <h3 class="detail-card-title">🔍 もしかして新種？ <span class="detail-pill detail-pill--novelty">${pct !== null ? `${pct}% の可能性（参考）` : "可能性あり"}</span></h3>
    <div class="detail-card-body">
      <div class="detail-warning-box" style="background:rgba(168,85,247,.10);border-color:rgba(168,85,247,.25);color:#581c87">これはAIの仮説です。新種判定はAIにはできず、専門研究者による形態・遺伝子解析を経て初めて確定します。</div>
      ${novelty.reasoning ? `<p style="margin-top:10px">${escapeHtml(novelty.reasoning)}</p>` : ""}
    </div>
    <p class="detail-card-hedge">${escapeHtml(novelty.hedge)}</p>
  </section>`;
}

function renderThreeLensCards(subject: ObservationVisitSubject): string {
  const ai = subject.aiAssessment;
  if (!ai) return "";
  const subjectName = ai.recommendedTaxonName || subject.displayName || "";
  const cards: string[] = [];
  if (ai.invasiveResponse) cards.push(renderInvasiveCard(ai.invasiveResponse, subjectName));
  if (ai.sizeAssessment) cards.push(renderSizeCard(ai.sizeAssessment, subjectName));
  if (ai.noveltyHint) cards.push(renderNoveltyCard(ai.noveltyHint));
  if (cards.length === 0) return "";
  return `<div class="detail-three-lens" style="margin-top:14px">${cards.join("")}</div>`;
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
  const threeLens = renderThreeLensCards(subject);
  return `<section class="section obs-hint-section ${bandClass}">
    <div class="obs-hint-head">
      <div>
        <p class="obs-hint-eyebrow">いっしょに絞るためのメモ</p>
        <h2 class="obs-hint-title">${escapeHtml(headline || "観察のヒント")}</h2>
      </div>
      <span class="obs-hint-badge">${escapeHtml(bandLabel)}</span>
    </div>
    ${threeLens}
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

const START_STATE_STYLES = `
  .start-guide { display: grid; gap: 20px; }
  .start-guide-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  .start-guide-card { min-height: 168px; padding: 22px; border-radius: 22px; background: rgba(255,255,255,.9); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 14px 32px rgba(15,23,42,.05); }
  .start-guide-card strong { display: block; margin: 8px 0; color: #0f172a; font-size: 18px; }
  .start-guide-card p { margin: 0; color: #64748b; font-size: 13.5px; line-height: 1.75; }
  .start-guide-panel { padding: 24px; border-radius: 24px; background: linear-gradient(135deg, rgba(236,253,245,.9), rgba(240,249,255,.92)); border: 1px solid rgba(16,185,129,.18); }
  .start-guide-panel h2 { margin: 8px 0; color: #0f172a; }
  .start-guide-panel p { margin: 0; color: #475569; line-height: 1.8; }
  .start-guide-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; }
  .start-guide-auth-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 18px; padding: 14px; border-radius: 18px; background: rgba(255,255,255,.68); border: 1px solid rgba(15,23,42,.08); }
  .record-capture-dock { position: fixed; left: 12px; right: 12px; bottom: max(10px, env(safe-area-inset-bottom)); z-index: 40; padding: 8px; border-radius: 24px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 20px 44px rgba(15,23,42,.2); display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
  .record-dock-action { min-height: 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 7px 6px; border-radius: 17px; border: 1px solid transparent; background: rgba(248,250,252,.9); color: #0f172a; text-decoration: none; font-size: 11px; font-weight: 900; line-height: 1.2; }
  .record-dock-primary { background: #ecfdf5; color: #065f46; }
  .record-dock-icon { width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center; background: rgba(15,23,42,.06); flex: 0 0 auto; }
  .record-dock-primary .record-dock-icon { background: rgba(16,185,129,.14); }
  .record-dock-icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .site-footer { padding-bottom: 104px; }
  .site-mobile-menu-panel { max-height: calc(100dvh - 184px); overflow-y: auto; overscroll-behavior: contain; }
  @media (max-width: 430px) { .brand { flex: 0 0 36px; min-width: 36px; max-width: 36px; } .brand > span:last-child { display: none; } }
  @media (max-width: 720px) { .start-guide { padding-bottom: 104px; } }
  @media (max-width: 980px) { .start-guide-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 620px) { .start-guide-grid { grid-template-columns: 1fr; } }
`;

function renderRecordStartGuide(basePath: string, lang: SiteLang, currentUrl = "/record"): string {
  const currentParams = new URL(currentUrl, "https://ikimon.local").searchParams;
  const start = currentParams.get("start");
  const recordStart = start === "photo" || start === "video" || start === "gallery" ? start : "";
  const recordParams = new URLSearchParams();
  if (recordStart) recordParams.set("start", recordStart);
  if (currentParams.get("draft") === "1") recordParams.set("draft", "1");
  if (lang) recordParams.set("lang", lang);
  const recordTarget = `/record${recordParams.toString() ? `?${recordParams.toString()}` : ""}`;
  const recordTargetForStart = (kind: "photo" | "video" | "gallery") => {
    const params = new URLSearchParams();
    params.set("start", kind);
    if (currentParams.get("draft") === "1" && recordStart === kind) params.set("draft", "1");
    if (lang) params.set("lang", lang);
    return `/record?${params.toString()}`;
  };
  const loginFor = (target: string) => withBasePath(basePath, `/login?redirect=${encodeURIComponent(target)}`);
  const loginHref = loginFor(recordTarget);
  const registerHref = withBasePath(basePath, `/register?redirect=${encodeURIComponent(recordTarget)}`);
  const qaHint = process.env.ALLOW_QUERY_USER_ID === "1"
    ? `<p class="meta" style="margin-top:14px;font-size:12px;color:#64748b">staging QA: <code>${escapeHtml(withBasePath(basePath, "/record?userId=..."))}</code></p>`
    : "";
  return renderSiteDocument({
    basePath,
    title: "記録を始める準備 | ikimon",
    activeNav: "記録する",
    lang,
    currentPath: withBasePath(basePath, "/record"),
    extraStyles: START_STATE_STYLES,
    hero: {
      eyebrow: "record",
      heading: "記録を始める準備",
      lead: "名前が分からなくても、記録は始められる。まず主役を1つ決め、周囲の様子も手がかりとして残せば、今日の発見はあとから育てられます。",
      tone: "light",
      align: "center",
      actions: [
        { href: loginHref, label: "ログインして記録する" },
        { href: registerHref, label: "新しく登録して記録する", variant: "secondary" },
      ],
    },
    body: `<div class="start-guide">
      <section class="section">
        <div class="start-guide-grid">
          <div class="start-guide-card"><div class="eyebrow">photo</div><strong>まず写真を残す</strong><p>全体、近くから見た特徴、いた場所の雰囲気を残すと、あとから確かめやすくなります。</p></div>
          <div class="start-guide-card"><div class="eyebrow">place</div><strong>場所と時間を残す</strong><p>散歩道、公園、水辺、庭先など、どこでいつ見たかが記録の価値を支えます。</p></div>
          <div class="start-guide-card"><div class="eyebrow">subject</div><strong>主役と周囲を分ける</strong><p>投稿では主役を1つ選べば十分です。周囲に写った生きものや環境は、AIと人が読む手がかりになります。</p></div>
          <div class="start-guide-card"><div class="eyebrow">note</div><strong>分からないまま書く</strong><p>名前が未確定でも、色、動き、数、周りの環境を短く書けば次の確認につながります。</p></div>
        </div>
      </section>
      <section class="section">
        <div class="start-guide-panel">
          <div class="eyebrow">sign in required</div>
          <h2>記録本体は、セッションがあると開きます。</h2>
          <p>観察はあとから見返せる個人ノートとして残すため、投稿画面はログイン済みの状態で使います。未ログイン時は、ここで準備だけ確認できます。</p>
          <div class="start-guide-auth-actions">
            <a class="btn btn-solid" href="${escapeHtml(loginHref)}">ログインして記録する</a>
            <a class="btn btn-ghost" href="${escapeHtml(registerHref)}">新しく登録して記録する</a>
          </div>
          <div class="start-guide-actions">
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ戻る</a>
            <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/faq"))}">FAQを見る</a>
            <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/map"))}">地図を見る</a>
          </div>
          ${qaHint}
        </div>
      </section>
      <nav class="record-capture-dock" aria-label="ログインして投稿を始める">
        <a class="record-dock-action record-dock-primary" href="${escapeHtml(loginFor(recordTargetForStart("photo")))}">
          <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/></svg></span>
          <span>写真</span>
        </a>
        <a class="record-dock-action" href="${escapeHtml(loginFor(recordTargetForStart("video")))}">
          <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11"/><rect x="3" y="6" width="13" height="12" rx="2"/></svg></span>
          <span>動画</span>
        </a>
        <a class="record-dock-action" href="${escapeHtml(loginFor(recordTargetForStart("gallery")))}">
          <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></span>
          <span>選ぶ</span>
        </a>
        <a class="record-dock-action" href="${escapeHtml(loginFor("/guide"))}">
          <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 16 0"/><path d="M12 4v4"/><path d="M6.3 6.3 9 9"/><path d="M17.7 6.3 15 9"/><path d="M3 13h4"/><path d="M17 13h4"/><path d="M9 17h6"/><path d="M10 21h4"/></svg></span>
          <span>ガイド</span>
        </a>
      </nav>
    </div>`,
    footerNote: "記録はログイン後に保存されます。未ログイン時は、準備と使い方を先に確認できます。",
  });
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

function renderIdentificationParticipation(options: {
  basePath: string;
  snapshot: NonNullable<Awaited<ReturnType<typeof getObservationDetailSnapshot>>>;
  consensus: IdentificationConsensusResult | null;
  viewerSession: SessionSnapshot | null;
  canUseSpecialistWorkbench: boolean;
}): string {
  const { basePath, snapshot, consensus, viewerSession } = options;
  const community = consensus?.communityTaxon;
  const currentConsensus = community
    ? `${community.name}（${rankLabelJa(community.rank)}、${community.supporterCount}名 / ${Math.round(community.supportRatio * 100)}%）`
    : "まだ分類系列上の合意点はありません";
  const targetLabel = snapshot.scientificName
    ? `${snapshot.displayName} · ${snapshot.scientificName}`
    : snapshot.displayName;
  const needed = consensus?.neededEvidence.length
    ? consensus.neededEvidence
    : ["独立した同定、根拠メモ、または専門家レビューを追加する"];
  const defaultName = snapshot.scientificName || (snapshot.displayName === "同定待ち" ? "" : snapshot.displayName);
  const defaultRank = snapshot.scientificName ? "species" : "";
  const endpointId = encodeURIComponent(snapshot.occurrenceId);
  const identifyEndpoint = withBasePath(basePath, `/api/v1/observations/${endpointId}/identifications`);
  const disputeEndpoint = withBasePath(basePath, `/api/v1/observations/${endpointId}/disputes`);
  const specialistHref = withBasePath(basePath, `/specialist/id-workbench?occurrenceId=${endpointId}`);
  const disputes = snapshot.disputes.length > 0
    ? `<div class="obs-dispute-list">
        ${snapshot.disputes.map((item) => `
          <div class="obs-dispute-item${item.status === "open" ? " is-open" : ""}">
            <div class="obs-dispute-top">
              <strong>${escapeHtml(item.kind === "alternative_id" ? "別分類の提案" : item.kind === "needs_more_evidence" ? "証拠不足" : item.kind)}</strong>
              <span>${escapeHtml(item.status)}</span>
            </div>
            ${item.proposedName ? `<div class="obs-dispute-name">${escapeHtml(item.proposedName)}${item.proposedRank ? ` · ${escapeHtml(item.proposedRank)}` : ""}</div>` : ""}
            ${item.reason ? `<p>${escapeHtml(item.reason)}</p>` : ""}
            <div class="obs-id-meta">${escapeHtml(item.actorName)} · ${escapeHtml(item.createdAt)}</div>
          </div>`).join("")}
       </div>`
    : `<p class="obs-empty">反対意見はまだありません。別分類や証拠不足に気づいたら、ここから記録できます。</p>`;

  const form = viewerSession
    ? `<form class="obs-identify-form" data-identify-form data-identify-endpoint="${escapeHtml(identifyEndpoint)}" data-dispute-endpoint="${escapeHtml(disputeEndpoint)}">
        <div class="obs-identify-fields">
          <label><span>提案する名前</span><input name="proposedName" type="text" value="${escapeHtml(defaultName)}" placeholder="例: Pieris rapae / モンシロチョウ" /></label>
          <label><span>分類階級</span><input name="proposedRank" type="text" value="${escapeHtml(defaultRank)}" placeholder="species / genus / family" /></label>
          <label class="is-wide"><span>根拠メモ</span><textarea name="notes" rows="3" placeholder="見えた形質、似ている種との差、追加で必要な写真など"></textarea></label>
        </div>
        <div class="obs-identify-actions">
          <button type="button" class="btn btn-solid" data-identify-action="support">同じだと思う</button>
          <button type="button" class="btn secondary" data-identify-action="alternative">別の分類だと思う</button>
          <button type="button" class="btn secondary" data-identify-action="needs_more_evidence">証拠が足りない</button>
          <button type="button" class="btn secondary" data-identify-action="note">根拠メモを追加</button>
        </div>
        <div class="obs-identify-status" data-identify-status>Ready.</div>
      </form>`
    : `<div class="obs-identify-login">
        <strong>ログインすると同定・反対意見を書けます。</strong>
        <p>閲覧だけならこのまま見られます。書き込みは、誰の判断かを追跡するため session が必要です。</p>
       </div>`;

  return `<section id="identify" class="section obs-layer obs-identify-panel">
    <div class="obs-identify-head">
      <div>
        <div class="obs-story-eyebrow">Identification consensus</div>
        <h2 class="obs-layer-title">同定に参加</h2>
      </div>
      <span class="obs-identify-pill">${escapeHtml(consensusStatusLabel(consensus?.consensusStatus))}</span>
    </div>
    <div class="obs-consensus-grid">
      <div class="obs-consensus-card">
        <span>いま判断する対象</span>
        <strong>${escapeHtml(targetLabel)}</strong>
      </div>
      <div class="obs-consensus-card">
        <span>現在の合意分類</span>
        <strong>${escapeHtml(currentConsensus)}</strong>
      </div>
      <div class="obs-consensus-card">
        <span>研究公開ゲート</span>
        <strong>${escapeHtml(verificationStatusLabel(consensus?.identificationVerificationStatus))}</strong>
      </div>
      <div class="obs-consensus-card">
        <span>精度ポリシー</span>
        <strong>${escapeHtml(consensus ? `${rankLabelJa(consensus.precisionCeilingRank)}まで市民合意可` : "確認中")}</strong>
      </div>
    </div>
    <div class="obs-needed-box">
      <div class="obs-story-eyebrow">次に必要な証拠</div>
      <ul>${needed.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
    <div class="obs-identify-split">
      <div>
        <h3>反対意見</h3>
        ${disputes}
      </div>
      <div>
        <h3>この観察に判断を足す</h3>
        ${form}
        ${options.canUseSpecialistWorkbench
          ? `<a class="obs-specialist-link" href="${escapeHtml(specialistHref)}">specialist batch review で開く</a>`
          : ""}
      </div>
    </div>
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

const PROFILE_HUB_STYLES = `
  ${PLACE_REVISIT_ROW_STYLES}
  .profile-hub-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
  .profile-hub-actions .btn { min-height: 44px; }
  .profile-summary-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
  .profile-summary-card { min-height: 118px; padding: 18px; border-radius: 18px; background: rgba(255,255,255,.9); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 10px 24px rgba(15,23,42,.045); }
  .profile-summary-card strong { display: block; margin-top: 8px; font-size: 28px; line-height: 1.05; color: #0f172a; letter-spacing: 0; }
  .profile-summary-card span { display: block; margin-top: 7px; color: #64748b; font-size: 12px; font-weight: 750; line-height: 1.55; }
  .profile-next-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .profile-reading-digest { padding: 22px; border-radius: 8px; border: 1px solid rgba(16,185,129,.16); background: linear-gradient(135deg, rgba(236,253,245,.82), rgba(255,255,255,.92) 54%, rgba(240,249,255,.76)); box-shadow: 0 16px 38px rgba(15,23,42,.06); display: grid; gap: 16px; }
  .profile-reading-main h3 { margin: 8px 0 0; color: #1a2e1f; font-size: clamp(28px, 3.2vw, 44px); line-height: 1.1; letter-spacing: 0; max-width: 18ch; }
  .profile-reading-main p { margin: 12px 0 0; color: #475569; line-height: 1.8; font-weight: 720; max-width: 68em; }
  .profile-reading-points { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .profile-reading-points div { min-height: 142px; padding: 14px; border-radius: 8px; border: 1px solid rgba(16,185,129,.14); background: rgba(255,255,255,.78); }
  .profile-reading-points span { display: block; color: #047857; font-size: 12px; font-weight: 950; }
  .profile-reading-points strong { display: block; margin-top: 8px; color: #1a2e1f; font-size: 16px; line-height: 1.35; }
  .profile-reading-points p { margin: 8px 0 0; color: #64748b; font-size: 13px; line-height: 1.65; font-weight: 700; }
  .profile-reading-actions { display: flex; flex-wrap: wrap; gap: 10px; }
  .profile-history-shell, .profile-growth-shell, .profile-contribution-shell { display: grid; gap: 14px; padding: 22px; border-radius: 8px; border: 1px solid rgba(16,185,129,.16); background: rgba(255,255,255,.84); box-shadow: 0 14px 32px rgba(15,23,42,.05); }
  .profile-history-line { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .profile-history-step { min-height: 116px; padding: 14px; border-radius: 8px; background: linear-gradient(135deg, rgba(236,253,245,.78), rgba(248,250,252,.92)); border: 1px solid rgba(16,185,129,.13); }
  .profile-history-step span, .profile-growth-card span, .profile-contribution-card span { display: block; color: #047857; font-size: 11px; line-height: 1.2; font-weight: 950; }
  .profile-history-step strong, .profile-growth-card strong, .profile-contribution-card strong { display: block; margin-top: 8px; color: #10251a; font-size: 20px; line-height: 1.2; font-weight: 950; }
  .profile-history-step p, .profile-growth-card p, .profile-contribution-card p { margin: 8px 0 0; color: #64748b; font-size: 12.5px; line-height: 1.65; font-weight: 720; }
  .profile-growth-grid, .profile-contribution-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
  .profile-growth-card, .profile-contribution-card { min-height: 132px; padding: 15px; border-radius: 8px; border: 1px solid rgba(16,185,129,.13); background: rgba(248,250,252,.82); }
  .profile-life-strip { display: flex; flex-wrap: wrap; gap: 8px; }
  .profile-life-pill { display: inline-flex; align-items: center; min-height: 34px; padding: 7px 10px; border-radius: 999px; background: #ecfdf5; color: #065f46; font-size: 12px; font-weight: 900; }
  .profile-library-link { display: inline-flex; align-items: center; justify-content: center; width: fit-content; min-height: 42px; padding: 10px 14px; border-radius: 999px; background: #10251a; color: #fff; font-weight: 950; text-decoration: none; }
  .profile-action-card { display: grid; gap: 10px; min-height: 176px; padding: 20px; border-radius: 20px; background: rgba(255,255,255,.92); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 12px 28px rgba(15,23,42,.05); }
  .profile-action-card h3 { margin: 0; font-size: 19px; line-height: 1.35; color: #0f172a; }
  .profile-action-card p { margin: 0; color: #64748b; line-height: 1.7; }
  .profile-intro-heading { display: flex; align-items: center; gap: 14px; min-width: 0; }
  .profile-avatar { width: 58px; height: 58px; border-radius: 999px; overflow: hidden; display: grid; place-items: center; flex: 0 0 auto; background: #ecfdf5; color: #047857; border: 1px solid rgba(16,185,129,.18); font-size: 22px; font-weight: 950; }
  .profile-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .profile-intro-heading h2 { min-width: 0; overflow-wrap: anywhere; }
  .profile-life-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .profile-life-card { display: grid; grid-template-rows: auto 1fr; min-height: 210px; overflow: hidden; border-radius: 18px; background: rgba(255,255,255,.9); border: 1px solid rgba(15,23,42,.08); }
  .profile-life-media { position: relative; width: 100%; aspect-ratio: 4 / 3; background: #e2e8f0; }
  .profile-life-thumb { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; background: #e2e8f0; display: block; }
  .profile-life-placeholder { width: 100%; aspect-ratio: 4 / 3; display: grid; place-items: center; background: linear-gradient(135deg, #ecfdf5, #f8fafc); color: #047857; font-weight: 900; }
  .profile-life-media .profile-life-thumb, .profile-life-media .profile-life-placeholder { position: absolute; inset: 0; width: 100%; height: 100%; aspect-ratio: auto; }
  .profile-life-body { padding: 14px; }
  .profile-life-body strong { display: block; color: #0f172a; line-height: 1.4; }
  .profile-life-body span { display: block; margin-top: 6px; color: #64748b; font-size: 12px; line-height: 1.55; }
  .profile-settings-card { max-width: 760px; margin: 0 auto; padding: 24px; border-radius: 20px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 14px 32px rgba(15,23,42,.055); }
  .profile-settings-form { display: grid; gap: 18px; }
  .profile-settings-field { display: grid; gap: 8px; }
  .profile-settings-field label { font-weight: 850; color: #0f172a; }
  .profile-settings-field input, .profile-settings-field textarea { width: 100%; min-height: 48px; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(15,23,42,.16); background: #fff; color: #0f172a; font: inherit; line-height: 1.6; box-sizing: border-box; }
  .profile-settings-avatar { display: flex; gap: 16px; align-items: center; flex-wrap: wrap; padding: 14px; border-radius: 18px; border: 1px solid rgba(15,23,42,.1); background: rgba(248,250,252,.82); }
  .profile-settings-avatar-preview { width: 76px; height: 76px; border-radius: 999px; overflow: hidden; display: grid; place-items: center; background: #ecfdf5; color: #047857; font-size: 24px; font-weight: 950; flex: 0 0 auto; }
  .profile-settings-avatar-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .profile-settings-avatar-control { display: grid; gap: 8px; min-width: min(260px, 100%); flex: 1; }
  .profile-settings-avatar-control input { min-height: auto; padding: 10px; }
  .profile-settings-field textarea { min-height: 148px; resize: vertical; }
  .profile-settings-help { margin: 0; color: #64748b; font-size: 13px; line-height: 1.65; }
  .profile-settings-status { min-height: 24px; color: #475569; font-weight: 800; }
  .profile-settings-status.is-error { color: #b91c1c; }
  .profile-settings-status.is-success { color: #047857; }
  @media (max-width: 980px) {
    .profile-summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .profile-next-grid, .profile-life-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .profile-reading-points { grid-template-columns: 1fr; }
    .profile-history-line, .profile-growth-grid, .profile-contribution-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 620px) {
    .profile-summary-grid, .profile-next-grid, .profile-life-grid { grid-template-columns: 1fr; }
    .profile-history-line, .profile-growth-grid, .profile-contribution-grid { grid-template-columns: 1fr; }
    .profile-summary-card { min-height: 96px; }
  }
`;

function formatProfileNumber(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}

function formatProfileDate(value: string | null | undefined): string {
  if (!value) return "これから";
  return formatShortDate(value, "ja-JP") || value.slice(0, 10);
}

function profileObservationYears(snapshot: ProfileSnapshot): number {
  if (!snapshot.stats.firstObservedAt) return 0;
  const first = new Date(snapshot.stats.firstObservedAt).getTime();
  if (!Number.isFinite(first)) return 0;
  const days = Math.max(1, Math.round((Date.now() - first) / 86400000));
  return Math.max(1, Math.ceil(days / 365));
}

function profileRevisitCount(snapshot: ProfileSnapshot): number {
  return snapshot.recentPlaces.reduce((sum, place) => sum + Math.max(0, place.visitCount - 1), 0);
}

function renderProfileSummary(snapshot: ProfileSnapshot): string {
  const stats = snapshot.stats;
  const cards = [
    { eyebrow: "Total", value: stats.totalObservations, label: "総観察数" },
    { eyebrow: "This month", value: stats.thisMonthObservations, label: "今月の観察" },
    { eyebrow: "Places", value: stats.placeCount, label: "記録した場所" },
    { eyebrow: "Life List", value: stats.uniqueTaxaAllTime, label: "見てきた生きもの" },
    { eyebrow: "Streak", value: stats.currentStreakDays, label: "現在ストリーク" },
  ];
  return `<section class="section" data-testid="profile-summary">
    <div class="profile-summary-grid">
      ${cards.map((card) => `<div class="profile-summary-card">
        <div class="eyebrow">${escapeHtml(card.eyebrow)}</div>
        <strong>${escapeHtml(formatProfileNumber(card.value))}</strong>
        <span>${escapeHtml(card.label)}</span>
      </div>`).join("")}
    </div>
  </section>`;
}

function renderProfileIntro(basePath: string, snapshot: ProfileSnapshot, editable = false): string {
  if (!snapshot.avatarUrl && !snapshot.profileBio && !snapshot.expertise && !editable) {
    return "";
  }
  const editLink = editable
    ? `<a class="btn secondary" href="${escapeHtml(withBasePath(basePath, "/profile/settings"))}">編集する</a>`
    : "";
  const avatarFallback = (snapshot.displayName || "?").slice(0, 1);
  const avatar = snapshot.avatarUrl
    ? `<span class="profile-avatar"><img src="${escapeHtml(snapshot.avatarUrl)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'profile-avatar',textContent:${JSON.stringify(avatarFallback)}}))" /></span>`
    : `<span class="profile-avatar">${escapeHtml(avatarFallback)}</span>`;
  return `<section class="section" data-testid="profile-intro">
    <div class="card is-soft">
      <div class="card-body stack">
        <div class="section-header">
          <div class="profile-intro-heading">
            ${avatar}
            <div>
              <div class="eyebrow">プロフィール</div>
              <h2>${escapeHtml(snapshot.displayName)} の観察メモ</h2>
            </div>
          </div>
          ${editLink}
        </div>
        ${snapshot.expertise ? `<p class="meta"><strong>関心分野:</strong> ${escapeHtml(snapshot.expertise)}</p>` : ""}
        ${snapshot.profileBio ? `<p style="margin:0;white-space:pre-wrap">${escapeHtml(snapshot.profileBio)}</p>` : `<p class="meta" style="margin:0">自己紹介はまだありません。</p>`}
      </div>
    </div>
  </section>`;
}

function renderProfileNextActions(basePath: string, snapshot: ProfileSnapshot, digest: ProfileNoteDigest | null = null): string {
  const firstPlace = snapshot.recentPlaces[0] ?? null;
  const latestObservation = snapshot.recentObservations[0] ?? null;
  const latestHref = latestObservation
    ? withBasePath(basePath, buildObservationDetailPath(
      latestObservation.detailId ?? latestObservation.visitId ?? latestObservation.occurrenceId,
      latestObservation.featuredOccurrenceId ?? latestObservation.occurrenceId,
    ))
    : withBasePath(basePath, "/notes#notes-own");
  const latestBody = digest?.todayReading || (latestObservation
    ? `${latestObservation.displayName} を見返すと、${latestObservation.placeName} の前回のページから読み始められます。`
    : "まだ自分のページはありません。近くの記録や場所の章から、ノートの読み方を先に眺められます。");
  const placeBody = digest?.placeChapters[0]?.readingAngle || (firstPlace
    ? `${firstPlace.placeName} は ${firstPlace.visitCount} 回分の記憶があります。${buildPlaceNextLine(firstPlace)}。`
    : "場所が増えるほど、同じ道の季節差や小さな変化を章として読み返せます。");
  const learningBody = digest?.learningHighlight || "Life List は数ではなく、見分ける観点が増えてきた履歴として読み返せます。";
  const contributionBody = digest?.localContribution || `${formatProfileNumber(snapshot.stats.placeCount)} か所の記憶が、地域の自然ノートを少し厚くしています。`;
  const contributionValue = digest
    ? `${escapeHtml(formatProfileNumber(digest.sourceStats.observationCount))} ページ`
    : `${escapeHtml(formatProfileNumber(snapshot.stats.totalObservations))} ページ`;
  return `<section class="section" data-testid="profile-next-actions">
    <div class="section-header"><div><div class="eyebrow">My history</div><h2>自分の観察史</h2></div></div>
    <div class="profile-reading-digest">
      <div class="profile-reading-main">
        <div class="eyebrow">Story</div>
        <h3>積み上がった時間から、今日の自分を読み直す</h3>
        <p>${escapeHtml(latestBody)}</p>
      </div>
      <div class="profile-reading-points">
        <div><span>はじまり</span><strong>${escapeHtml(formatProfileDate(snapshot.stats.firstObservedAt))}</strong><p>${escapeHtml(snapshot.stats.firstObservedAt ? `${profileObservationYears(snapshot)} 年分の観察史として読み返せます。` : "最初の観察が入ると、ここから自分の歴史が始まります。")}</p></div>
        <div><span>見えてきたこと</span><strong>${escapeHtml(formatProfileNumber(snapshot.stats.uniqueTaxaAllTime))} 種を見てきた</strong><p>${escapeHtml(learningBody)}</p></div>
        <div><span>地域への手がかり</span><strong>${contributionValue}</strong><p>${escapeHtml(contributionBody)}</p></div>
      </div>
      <div class="profile-reading-actions">
        <a class="btn btn-solid" href="${escapeHtml(latestHref)}">前回のページを読む</a>
        <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/notes#notes-own"))}">観察ライブラリを開く</a>
        <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/notes#notes-places"))}">場所アルバムを見る</a>
      </div>
    </div>
  </section>`;
}

function renderProfileHistory(snapshot: ProfileSnapshot): string {
  const latest = snapshot.recentObservations[0] ?? null;
  const firstPlace = snapshot.recentPlaces[0] ?? null;
  const years = profileObservationYears(snapshot);
  const revisitCount = profileRevisitCount(snapshot);
  return `<section class="section" data-testid="profile-history">
    <div class="section-header"><div><div class="eyebrow">Timeline</div><h2>積み上がった履歴</h2></div></div>
    <div class="profile-history-shell">
      <div class="profile-history-line">
        <div class="profile-history-step"><span>最初の観察</span><strong>${escapeHtml(formatProfileDate(snapshot.stats.firstObservedAt))}</strong><p>${escapeHtml(years > 0 ? `${years} 年分のフィールドノートとして残っています。` : "ここから観察史が始まります。")}</p></div>
        <div class="profile-history-step"><span>最近のページ</span><strong>${escapeHtml(latest?.displayName ?? "これから")}</strong><p>${escapeHtml(latest ? `${latest.placeName} の ${formatProfileDate(latest.observedAt)} の記録。` : "観察が入ると、前回のページとして読めます。")}</p></div>
        <div class="profile-history-step"><span>再訪</span><strong>${escapeHtml(formatProfileNumber(revisitCount))} 回</strong><p>${escapeHtml(firstPlace ? `${firstPlace.placeName} など、同じ場所を重ねて見ています。` : "同じ場所をもう一度見るほど、変化が読めます。")}</p></div>
        <div class="profile-history-step"><span>今月</span><strong>${escapeHtml(formatProfileNumber(snapshot.stats.thisMonthObservations))} 件</strong><p>最近の関心がどこに向いているかを示す短い章です。</p></div>
      </div>
    </div>
  </section>`;
}

function renderProfileGrowth(snapshot: ProfileSnapshot, digest: ProfileNoteDigest | null = null): string {
  const topLife = snapshot.lifeListPreview.slice(0, 6);
  return `<section class="section" data-testid="profile-growth">
    <div class="section-header"><div><div class="eyebrow">Growth</div><h2>前より見えてきたこと</h2></div></div>
    <div class="profile-growth-shell">
      <div class="profile-growth-grid">
        <div class="profile-growth-card"><span>Life List</span><strong>${escapeHtml(formatProfileNumber(snapshot.stats.uniqueTaxaAllTime))} 種</strong><p>数を競うためではなく、見分ける観点が増えてきた履歴です。</p></div>
        <div class="profile-growth-card"><span>手がかりが濃い記録</span><strong>${escapeHtml(formatProfileNumber(snapshot.stats.tier2PlusCount))} 件</strong><p>写真や文脈が残り、あとから確かめやすい記録です。</p></div>
        <div class="profile-growth-card"><span>学びの要約</span><strong>${escapeHtml(digest ? "更新済み" : "準備中")}</strong><p>${escapeHtml(digest?.learningHighlight || "記録が増えるほど、よく見る生きものや名前が揺れている対象を要約できます。")}</p></div>
      </div>
      ${topLife.length > 0
        ? `<div class="profile-life-strip">${topLife.map((item) => `<span class="profile-life-pill">${escapeHtml(item.displayName)}</span>`).join("")}</div>`
        : `<div class="profile-life-strip"><span class="profile-life-pill">名前が付くとここに並びます</span></div>`}
    </div>
  </section>`;
}

function renderProfileContribution(basePath: string, snapshot: ProfileSnapshot, digest: ProfileNoteDigest | null = null): string {
  const revisitCount = profileRevisitCount(snapshot);
  return `<section class="section" data-testid="profile-contribution">
    <div class="section-header"><div><div class="eyebrow">Contribution</div><h2>地域に残った手がかり</h2></div></div>
    <div class="profile-contribution-shell">
      <div class="profile-contribution-grid">
        <div class="profile-contribution-card"><span>観察ページ</span><strong>${escapeHtml(formatProfileNumber(snapshot.stats.totalObservations))}</strong><p>キミの記録で、この地域のノートが少し厚くなっています。</p></div>
        <div class="profile-contribution-card"><span>場所</span><strong>${escapeHtml(formatProfileNumber(snapshot.stats.placeCount))}</strong><p>見た場所が増えるほど、地域の自然を読み返す入口が増えます。</p></div>
        <div class="profile-contribution-card"><span>再訪の厚み</span><strong>${escapeHtml(formatProfileNumber(revisitCount))}</strong><p>${escapeHtml(digest?.localContribution || "同じ場所を重ねて見ることが、変化の手がかりになります。")}</p></div>
      </div>
      <a class="profile-library-link" href="${escapeHtml(withBasePath(basePath, "/notes#notes-own"))}">観察データ一覧を見る</a>
    </div>
  </section>`;
}

function renderProfileLifeList(snapshot: ProfileSnapshot): string {
  const items = snapshot.lifeListPreview;
  if (items.length === 0) {
    return `<section class="section" data-testid="profile-life-list">
      <div class="section-header"><div><div class="eyebrow">Life List</div><h2>見てきた生きもの</h2></div></div>
      <div class="onboarding-empty">
        <div class="eyebrow">まだ 0 種</div>
        <h3>名前が分からない記録から始められます</h3>
        <p>観察に名前が付くと、ここに自分の Life List としてまとまります。</p>
      </div>
    </section>`;
  }
  return `<section class="section" data-testid="profile-life-list">
    <div class="section-header"><div><div class="eyebrow">Life List</div><h2>見てきた生きもの</h2></div></div>
    <div class="profile-life-grid">
      ${items.map((item) => `<div class="profile-life-card">
        ${item.photoUrl
          ? `<div class="profile-life-media"><img class="profile-life-thumb" src="${escapeHtml(item.photoUrl)}" alt="${escapeHtml(item.displayName)}" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><div class="profile-life-placeholder" hidden>Life List</div></div>`
          : `<div class="profile-life-placeholder">Life List</div>`}
        <div class="profile-life-body">
          <strong>${escapeHtml(item.displayName)}</strong>
          <span>${item.scientificName ? escapeHtml(item.scientificName) + " · " : ""}${escapeHtml(formatProfileNumber(item.observationCount))} 件</span>
          <span>最新: ${escapeHtml(formatShortDate(item.latestObservedAt, "ja-JP") || item.latestObservedAt)}</span>
        </div>
      </div>`).join("")}
    </div>
  </section>`;
}

function renderSelfProfileHub(basePath: string, lang: SiteLang, snapshot: ProfileSnapshot, digest: ProfileNoteDigest | null = null): string {
  return `${renderProfileSummary(snapshot)}
    ${renderProfileIntro(basePath, snapshot, true)}
    ${renderProfileNextActions(basePath, snapshot, digest)}
    ${renderProfileHistory(snapshot)}
    ${renderProfileGrowth(snapshot, digest)}
    ${renderProfileContribution(basePath, snapshot, digest)}`;
}

function renderProfileSettingsForm(basePath: string, snapshot: ProfileSnapshot): string {
  const endpoint = withBasePath(basePath, "/api/v1/profile/me");
  const backHref = withBasePath(basePath, "/profile");
  const avatarFallback = (snapshot.displayName || "?").slice(0, 1);
  return `<section class="section" data-testid="profile-settings">
    <div class="profile-settings-card">
      <form class="profile-settings-form" data-profile-settings data-endpoint="${escapeHtml(endpoint)}">
        <div>
          <div class="eyebrow">Profile settings</div>
          <h2 style="margin:8px 0 0">プロフィール編集</h2>
          <p class="profile-settings-help" style="margin-top:8px">公開プロフィールとマイページの表示名、アイコン、自己紹介を更新します。</p>
        </div>
        <div class="profile-settings-field">
          <label for="profile-avatar">アイコン</label>
          <div class="profile-settings-avatar">
            <div class="profile-settings-avatar-preview" data-avatar-preview>
              ${snapshot.avatarUrl ? `<img src="${escapeHtml(snapshot.avatarUrl)}" alt="" onerror="this.remove();this.parentElement.textContent=${escapeHtml(JSON.stringify(avatarFallback))}" />` : escapeHtml(avatarFallback)}
            </div>
            <div class="profile-settings-avatar-control">
              <input id="profile-avatar" name="avatar" type="file" accept="image/jpeg,image/png,image/webp,image/gif" />
              <p class="profile-settings-help">5MBまで。JPG / PNG / WebP / GIF を使えます。</p>
            </div>
          </div>
        </div>
        <div class="profile-settings-field">
          <label for="profile-display-name">表示名</label>
          <input id="profile-display-name" name="displayName" value="${escapeHtml(snapshot.displayName)}" maxlength="50" required autocomplete="name" />
          <p class="profile-settings-help">1-50文字。ヘッダー、マイページ、公開プロフィールに表示されます。</p>
        </div>
        <div class="profile-settings-field">
          <label for="profile-expertise">関心分野</label>
          <input id="profile-expertise" name="expertise" value="${escapeHtml(snapshot.expertise ?? "")}" maxlength="120" placeholder="例: 里山の植物、都市鳥類、昆虫写真" />
          <p class="profile-settings-help">自分がよく見る対象や得意な観察領域を短く残します。</p>
        </div>
        <div class="profile-settings-field">
          <label for="profile-bio">自己紹介</label>
          <textarea id="profile-bio" name="profileBio" maxlength="500" placeholder="観察している場所、見ている生きもの、記録の方針など">${escapeHtml(snapshot.profileBio ?? "")}</textarea>
          <p class="profile-settings-help">500文字まで。公開プロフィールの説明として使えます。</p>
        </div>
        <div class="actions">
          <button class="btn btn-solid" type="submit">保存する</button>
          <a class="btn btn-ghost" href="${escapeHtml(backHref)}">マイページへ戻る</a>
        </div>
        <div class="profile-settings-status" data-profile-settings-status role="status" aria-live="polite"></div>
      </form>
    </div>
  </section>
  <script>
(function () {
  const form = document.querySelector('[data-profile-settings]');
  if (!form) return;
  const status = form.querySelector('[data-profile-settings-status]');
  const endpoint = form.getAttribute('data-endpoint');
  const messages = {
    display_name_required: '表示名を入力してください。',
    display_name_too_long: '表示名は50文字以内で入力してください。',
    profile_bio_too_long: '自己紹介は500文字以内で入力してください。',
    expertise_too_long: '関心分野は120文字以内で入力してください。',
    avatar_invalid: 'アイコン画像を読み込めませんでした。',
    avatar_empty: 'アイコン画像が空です。',
    avatar_too_large: 'アイコン画像は5MB以内にしてください。',
    avatar_invalid_type: 'アイコンは JPG / PNG / WebP / GIF を選んでください。',
    session_required: 'ログインし直してください。'
  };
  const setStatus = (message, kind) => {
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', kind === 'error');
    status.classList.toggle('is-success', kind === 'success');
  };
  const avatarInput = form.querySelector('input[name="avatar"]');
  const avatarPreview = form.querySelector('[data-avatar-preview]');
  let selectedAvatar = null;
  const readAvatar = (file) => new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (!/^image\\/(jpeg|png|webp|gif)$/.test(file.type || '')) {
      return reject(new Error(messages.avatar_invalid_type));
    }
    if (file.size > 5 * 1024 * 1024) {
      return reject(new Error(messages.avatar_too_large));
    }
    const reader = new FileReader();
    reader.onload = () => resolve({
      filename: file.name || 'avatar',
      mimeType: file.type || 'image/jpeg',
      base64Data: String(reader.result || '')
    });
    reader.onerror = () => reject(new Error(messages.avatar_invalid));
    reader.readAsDataURL(file);
  });
  if (avatarInput) {
    avatarInput.addEventListener('change', async () => {
      const file = avatarInput.files ? Array.from(avatarInput.files)[0] || null : null;
      try {
        selectedAvatar = await readAvatar(file);
        if (selectedAvatar && avatarPreview) {
          avatarPreview.innerHTML = '';
          const image = document.createElement('img');
          image.alt = '';
          image.src = selectedAvatar.base64Data;
          avatarPreview.appendChild(image);
        }
        setStatus('', '');
      } catch (error) {
        selectedAvatar = null;
        avatarInput.value = '';
        setStatus(error instanceof Error ? error.message : messages.avatar_invalid, 'error');
      }
    });
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!endpoint) return;
    const submit = form.querySelector('button[type="submit"]');
    if (submit) submit.disabled = true;
    setStatus('保存しています。', '');
    const data = new FormData(form);
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json'
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          displayName: String(data.get('displayName') || ''),
          expertise: String(data.get('expertise') || ''),
          profileBio: String(data.get('profileBio') || ''),
          avatar: selectedAvatar
        })
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload || payload.ok === false) {
        const key = payload && payload.error ? payload.error : 'profile_update_failed';
        throw new Error(messages[key] || '保存に失敗しました。入力内容を確認してください。');
      }
      setStatus('保存しました。マイページへ戻れます。', 'success');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '保存に失敗しました。', 'error');
    } finally {
      if (submit) submit.disabled = false;
    }
  });
})();
</script>`;
}

function renderProfileSnapshotBody(
  basePath: string,
  lang: SiteLang,
  viewerUserId: string | null | undefined,
  snapshot: ProfileSnapshot,
  mode: "registered" | "guest" = "registered",
): string {
  const places = renderPlaceRows(
    basePath,
    lang,
    viewerUserId,
    snapshot.recentPlaces,
    "まだ場所の記録はありません。",
  );
  const observations = snapshot.recentObservations.map((item) => `
      <div class="row">
        <div>
          <a style="font-weight:800;color:inherit;text-decoration:none" href="${escapeHtml(withBasePath(basePath, buildObservationDetailPath(item.detailId ?? item.visitId ?? item.occurrenceId, item.featuredOccurrenceId ?? item.occurrenceId)))}">${escapeHtml(item.displayName)}</a>
          <div class="meta">${escapeHtml(item.placeName)} · ${escapeHtml(item.observedAt)}</div>
        </div>
        <div class="actions">
          <span class="pill">${item.identificationCount} ids</span>
          <a class="btn secondary" href="${escapeHtml(withBasePath(basePath, buildObservationDetailPath(item.detailId ?? item.visitId ?? item.occurrenceId, item.featuredOccurrenceId ?? item.occurrenceId)) + "#identify")}">同定する</a>
        </div>
      </div>`).join("");
  const guestIntro = mode === "guest"
    ? `<section class="section"><div class="card is-soft"><div class="card-body stack">
        <div class="eyebrow">Guest notebook</div>
        <h2>匿名のまま残された、小さなフィールドノート</h2>
        <p class="meta">Guest の記録はアカウントのプロフィールではなく、投稿された観察と場所の履歴だけで読める簡易ノートとして表示します。名前よりも、何を見つけ、どこを歩いたかを中心に残します。</p>
      </div></div></section>`
    : "";

  return `${guestIntro}
      ${mode === "registered" ? renderProfileIntro(basePath, snapshot) : ""}
      <section class="section"><div class="section-header"><div><div class="eyebrow">よく歩く場所</div><h2>最近の My places</h2></div></div><div class="list">${places || '<div class="row"><div>まだ場所の記録はありません。</div></div>'}</div></section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">ノート</div><h2>最近の観察</h2></div></div><div class="list">${observations || '<div class="row"><div>まだ観察はありません。</div></div>'}</div></section>`;
}

function notesEntryDate(obs: LandingObservation): string {
  return (obs.entryType === "identification" ? obs.identifiedAt : obs.observedAt) ?? obs.observedAt;
}

function notesEntryKind(obs: LandingObservation): string {
  return obs.entryType === "identification" ? "同定メモ" : "観察ページ";
}

function notesDetailHref(basePath: string, lang: SiteLang, obs: LandingObservation): string {
  return appendLangToHref(
    withBasePath(
      basePath,
      buildObservationDetailPath(obs.detailId ?? obs.visitId ?? obs.occurrenceId, obs.featuredOccurrenceId ?? obs.occurrenceId),
    ),
    lang,
  );
}

function notesPlaceLine(obs: LandingObservation, locationMode: "owner" | "public"): string {
  if (locationMode === "owner") {
    return [obs.placeName, obs.municipality].filter(Boolean).join(" · ");
  }
  return obs.publicLocation?.label || obs.municipality || "場所をぼかしています";
}

function renderNotesMiniCard(
  basePath: string,
  lang: SiteLang,
  obs: LandingObservation,
  options: { locationMode: "owner" | "public" },
): string {
  const href = notesDetailHref(basePath, lang, obs);
  const displayName = obs.displayName || obs.proposedName || "名前を確かめているページ";
  const dateLabel = formatShortDate(notesEntryDate(obs), lang === "ja" ? "ja-JP" : "en-US") || notesEntryDate(obs);
  const placeLine = notesPlaceLine(obs, options.locationMode);
  const photoUrl = obs.photoUrl ? (toThumbnailUrl(obs.photoUrl, "sm") ?? obs.photoUrl) : null;
  const photo = photoUrl
    ? `<span class="notes-thumb"><img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(displayName)}" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><span hidden>${escapeHtml(notesEntryKind(obs).slice(0, 1))}</span></span>`
    : `<span class="notes-thumb notes-thumb-empty">${escapeHtml(notesEntryKind(obs).slice(0, 1))}</span>`;
  const observerLine = obs.observerName ? `${obs.observerName} · ` : "";
  const supportLine = obs.entryType === "identification"
    ? `${observerLine}${obs.proposedName ? `${obs.proposedName} · ` : ""}${dateLabel}`
    : `${observerLine}${obs.identificationCount > 0 ? `同定 ${obs.identificationCount} 件 · ` : "名前を見返す余地あり · "}${dateLabel}`;
  return `<a class="notes-page-card" href="${escapeHtml(href)}" data-entry-type="${escapeHtml(obs.entryType ?? "observation")}">
    ${photo}
    <span class="notes-page-copy">
      <span class="notes-page-kicker">${escapeHtml(notesEntryKind(obs))}</span>
      <strong>${escapeHtml(displayName)}</strong>
      <span>${escapeHtml(placeLine)}</span>
      <em>${escapeHtml(supportLine)}</em>
    </span>
  </a>`;
}

function notesLibraryMonthKey(obs: LandingObservation): string {
  const date = notesEntryDate(obs);
  return /^\d{4}-\d{2}/.test(date) ? date.slice(0, 7) : "unknown";
}

function notesLibraryMonthLabel(key: string, lang: SiteLang): string {
  if (key === "unknown") return lang === "ja" ? "日付なし" : "Undated";
  const [year, month] = key.split("-");
  if (lang === "ja") return `${year}年${Number(month)}月`;
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long" }).format(new Date(`${key}-01T00:00:00Z`));
}

function notesLibraryDateLabel(obs: LandingObservation, lang: SiteLang): string {
  return formatShortDate(notesEntryDate(obs), lang === "ja" ? "ja-JP" : "en-US") || notesEntryDate(obs);
}

function notesLibraryIsUncertain(obs: LandingObservation): boolean {
  const name = (obs.displayName || obs.proposedName || "").trim();
  return obs.isAiCandidate === true
    || obs.identificationCount === 0
    || name === ""
    || name === "同定待ち"
    || /awaiting id|unknown|unresolved/i.test(name);
}

function notesLibrarySourceKind(obs: LandingObservation): NonNullable<LandingObservation["librarySourceKind"]> {
  if (obs.librarySourceKind) return obs.librarySourceKind;
  if (obs.hasVideo) return "video";
  if (obs.photoUrl) return "photo";
  return "note";
}

function notesLibrarySourceLabel(kind: NonNullable<LandingObservation["librarySourceKind"]>): string {
  switch (kind) {
    case "video":
      return "動画";
    case "guide":
      return "ガイド";
    case "scan":
      return "スキャン";
    case "photo":
      return "写真";
    default:
      return "記録";
  }
}

function renderNotesLibraryCard(basePath: string, lang: SiteLang, obs: LandingObservation, options: { locationMode: "owner" | "public" }): string {
  const href = notesDetailHref(basePath, lang, obs);
  const displayName = obs.displayName || obs.proposedName || "名前を確かめている観察";
  const placeLine = notesPlaceLine(obs, options.locationMode);
  const photoUrl = obs.photoUrl ? (toThumbnailUrl(obs.photoUrl, "md") ?? obs.photoUrl) : null;
  const dateLabel = notesLibraryDateLabel(obs, lang);
  const isUncertain = notesLibraryIsUncertain(obs);
  const sourceKind = notesLibrarySourceKind(obs);
  const sourceLabel = notesLibrarySourceLabel(sourceKind);
  const filters = [
    "all",
    sourceKind,
    photoUrl ? "photos" : "no-photo",
    isUncertain ? "uncertain" : "named",
    obs.identificationCount > 0 || obs.entryType === "identification" ? "identified" : "needs-id",
  ].join(" ");
  const searchable = `${displayName} ${placeLine} ${obs.observerName} ${dateLabel} ${sourceLabel}`.toLowerCase();
  const photo = photoUrl
    ? `<img src="${escapeHtml(photoUrl)}" alt="${escapeHtml(displayName)}" loading="lazy" decoding="async" onerror="this.closest('.notes-library-card').classList.add('is-photo-missing');this.remove()" />`
    : `<span class="notes-library-placeholder">${escapeHtml(sourceLabel.slice(0, 1))}</span>`;
  return `<a class="notes-library-card is-source-${escapeHtml(sourceKind)}${photoUrl ? "" : " is-photo-missing"}" href="${escapeHtml(href)}" data-library-card data-filter="${escapeHtml(filters)}" data-search="${escapeHtml(searchable)}">
    <span class="notes-library-photo">${photo}</span>
    <span class="notes-library-overlay">
      <span class="notes-library-badges">
        <b class="notes-source-badge is-source-${escapeHtml(sourceKind)}">${escapeHtml(sourceLabel)}</b>
        ${isUncertain ? `<b>名前未確定</b>` : `<b>名前あり</b>`}
        ${obs.identificationCount > 0 ? `<b>${escapeHtml(String(obs.identificationCount))} ids</b>` : ""}
      </span>
      <strong>${escapeHtml(displayName)}</strong>
      <em>${escapeHtml(placeLine || "場所未設定")} · ${escapeHtml(dateLabel)}</em>
    </span>
  </a>`;
}

function renderNotesLibraryMonths(basePath: string, lang: SiteLang, entries: LandingObservation[], options: { locationMode: "owner" | "public" }): string {
  if (entries.length === 0) {
    return `<div class="notes-library-empty">まだ観察ライブラリに並べる記録がありません。</div>`;
  }
  const groups = new Map<string, LandingObservation[]>();
  for (const entry of entries) {
    const key = notesLibraryMonthKey(entry);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(entry);
  }
  return Array.from(groups.entries()).map(([key, items]) => `<section class="notes-library-month" data-library-month>
    <div class="notes-library-month-head">
      <h2>${escapeHtml(notesLibraryMonthLabel(key, lang))}</h2>
      <span>${escapeHtml(String(items.length))} 件</span>
    </div>
    <div class="notes-library-grid">
      ${items.map((obs) => renderNotesLibraryCard(basePath, lang, obs, options)).join("")}
    </div>
  </section>`).join("");
}

function renderNotesLibraryControls(entryCount: number, placeCount: number): string {
  return `<section class="notes-library-controls" aria-label="観察ライブラリの絞り込み">
    <div class="notes-library-search">
      <span aria-hidden="true">⌕</span>
      <input type="search" placeholder="名前・場所で探す" data-library-search />
    </div>
    <div class="notes-library-filters" role="group" aria-label="表示切り替え">
      <button type="button" class="is-active" data-library-filter="all">すべて</button>
      <button type="button" data-library-filter="photo">写真</button>
      <button type="button" data-library-filter="video">動画</button>
      <button type="button" data-library-filter="guide">ガイド</button>
      <button type="button" data-library-filter="scan">スキャン</button>
      <button type="button" data-library-filter="uncertain">名前未確定</button>
      <button type="button" data-library-filter="identified">同定あり</button>
    </div>
    <div class="notes-library-count" aria-live="polite"><strong data-library-visible-count>${escapeHtml(String(entryCount))}</strong><span>件 / ${escapeHtml(String(placeCount))} 場所</span></div>
  </section>`;
}

function renderNotesLibrarySourceLanes(entries: LandingObservation[]): string {
  const counts = new Map<NonNullable<LandingObservation["librarySourceKind"]>, number>();
  for (const entry of entries) {
    const kind = notesLibrarySourceKind(entry);
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const lanes: Array<NonNullable<LandingObservation["librarySourceKind"]>> = ["photo", "video", "guide", "scan", "note"];
  return `<div class="notes-library-source-lanes" aria-label="データの種類">
    ${lanes.map((kind) => `<button type="button" class="notes-library-source-lane is-source-${escapeHtml(kind)}" data-library-filter="${escapeHtml(kind)}">
      <span>${escapeHtml(notesLibrarySourceLabel(kind))}</span>
      <strong>${escapeHtml(String(counts.get(kind) ?? 0))}</strong>
    </button>`).join("")}
  </div>`;
}

function renderNotesLibraryPlaceAlbums(snapshot: LandingSnapshot): string {
  if (!snapshot.viewerUserId || snapshot.myPlaces.length === 0) {
    return `<section id="notes-places" class="section notes-library-albums" data-testid="notes-places">
      <div class="notes-library-section-head"><div><span>Albums</span><h2>場所アルバム</h2></div></div>
      <div class="notes-library-empty">場所アルバムはまだありません。</div>
    </section>`;
  }
  const albums = snapshot.myPlaces.slice(0, 10).map((place) => {
    const focus = pickPlaceFocus(place);
    return `<button type="button" class="notes-library-album" data-library-place="${escapeHtml(place.placeName)}">
      <span>${escapeHtml(place.municipality || "場所")}</span>
      <strong>${escapeHtml(place.placeName)}</strong>
      <em>${escapeHtml(String(place.visitCount))} 件${focus ? ` · ${escapeHtml(focus)}` : ""}</em>
    </button>`;
  }).join("");
  return `<section id="notes-places" class="section notes-library-albums" data-testid="notes-places">
    <div class="notes-library-section-head"><div><span>Albums</span><h2>場所アルバム</h2></div><p>よく行く場所をフォルダみたいに開く。</p></div>
    <div class="notes-library-album-row">${albums}</div>
  </section>`;
}

function renderNotesLibraryScript(): string {
  return `<script>
(function () {
  const root = document.querySelector('[data-notes-library]');
  if (!root) return;
  const search = root.querySelector('[data-library-search]');
  const count = root.querySelector('[data-library-visible-count]');
  const cards = Array.from(root.querySelectorAll('[data-library-card]'));
  const months = Array.from(root.querySelectorAll('[data-library-month]'));
  const filterButtons = Array.from(root.querySelectorAll('[data-library-filter]'));
  let activeFilter = 'all';
  function apply() {
    const query = search ? String(search.value || '').trim().toLowerCase() : '';
    let visible = 0;
    cards.forEach(function (card) {
      const filters = String(card.getAttribute('data-filter') || '');
      const haystack = String(card.getAttribute('data-search') || '');
      const okFilter = activeFilter === 'all' || filters.split(/\\s+/).indexOf(activeFilter) >= 0;
      const okSearch = !query || haystack.indexOf(query) >= 0;
      const show = okFilter && okSearch;
      card.hidden = !show;
      if (show) visible += 1;
    });
    months.forEach(function (month) {
      month.hidden = !month.querySelector('[data-library-card]:not([hidden])');
    });
    if (count) count.textContent = String(visible);
  }
  filterButtons.forEach(function (button) {
    button.addEventListener('click', function () {
      activeFilter = button.getAttribute('data-library-filter') || 'all';
      filterButtons.forEach(function (b) { b.classList.toggle('is-active', b === button); });
      apply();
    });
  });
  if (search) search.addEventListener('input', apply);
  document.querySelectorAll('[data-library-place]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (!search) return;
      search.value = button.getAttribute('data-library-place') || '';
      activeFilter = 'all';
      filterButtons.forEach(function (b) { b.classList.toggle('is-active', b.getAttribute('data-library-filter') === 'all'); });
      root.scrollIntoView({ behavior: 'smooth', block: 'start' });
      apply();
    });
  });
  apply();
})();
</script>`;
}

function renderNotesReadingBrief(basePath: string, lang: SiteLang, snapshot: LandingSnapshot, digest: ProfileNoteDigest | null = null): string {
  const latest = snapshot.myFeed[0] ?? snapshot.feed[0] ?? null;
  const firstPlace = snapshot.myPlaces[0] ?? null;
  const supportedCount = snapshot.myFeed.filter((obs) => obs.identificationCount > 0 || obs.entryType === "identification").length;
  const ownObservationPages = snapshot.myFeed.filter((obs) => obs.entryType !== "identification").length;
  const latestHref = latest ? notesDetailHref(basePath, lang, latest) : appendLangToHref(withBasePath(basePath, "/notes#notes-nearby"), lang);
  const latestName = latest?.displayName || "近くのページ";
  const latestPlace = latest ? notesPlaceLine(latest, snapshot.viewerUserId ? "owner" : "public") : "この地域";
  const latestDate = latest ? (formatShortDate(notesEntryDate(latest), "ja-JP") || "最近") : "今日";
  const placeName = firstPlace?.placeName ?? "まだ章になっていない場所";
  const digestPlace = digest?.placeChapters[0] ?? null;
  const placeMemory = digestPlace?.readingAngle || (firstPlace
    ? `${firstPlace.visitCount} 回分の記憶があり、${buildPlaceNextLine(firstPlace)}。`
    : "場所の章はまだ薄い。でも近くのページを読むだけでも、同じ道を見返す感覚は先に掴める。");
  const learningLine = digest?.learningHighlight || (supportedCount > 0
    ? `${supportedCount} 件のページで、名前や同定の手がかりが育っています。`
    : "名前が揺れているページも、次に分かる楽しみとして残っています。");
  const contributionLine = digest?.localContribution || (snapshot.viewerUserId
    ? `${formatProfileNumber(ownObservationPages)} ページと ${formatProfileNumber(snapshot.myPlaces.length)} つの場所が、地域を読み返す材料になっています。`
    : `${formatProfileNumber(snapshot.stats.observationCount)} 件の公開ページが、地域の自然を読める形で残っています。`);
  const digestLead = digest?.todayReading
    || `${latestPlace} の ${latestDate} のページを起点に読むと、ただの一覧ではなく「前に何を見て、何が分かり、地域に何が残ったか」までつながって見えます。`;
  const digestQuote = digest?.growthStory || "ノートは投稿履歴ではなく、同じ場所をもう一度おもしろくするための読み物です。";
  const readingOrder = [
    { label: "前回のページ", value: `${latestDate} の ${latestName}` },
    { label: "場所の章", value: placeName },
    { label: "学び", value: supportedCount > 0 ? "名前が育ったページ" : "まだ名前が揺れているページ" },
    { label: "地域への効き方", value: snapshot.viewerUserId ? "自分の足あとが残した手がかり" : "公開ノートが残した手がかり" },
  ];
  return `<section id="notes-reading" class="section notes-reading" data-testid="notes-reading-brief">
    <div class="notes-section-head">
      <div><div class="notes-eyebrow">読むためのノート</div><h2>今日読むページ</h2></div>
      <p>ここだけ読めば、前回のページ、場所の記憶、学び、地域への効き方までひと通り分かるようにします。</p>
    </div>
    <div class="notes-digest-shell">
      <article class="notes-digest-main">
        <div class="notes-digest-kicker">今日の読み筋</div>
        <h3>${escapeHtml(latestName)}から読む、今日のノート</h3>
        <p>${escapeHtml(digestLead)}</p>
        <blockquote>${escapeHtml(digestQuote)}</blockquote>
        <div class="notes-digest-story-grid">
          <div>
            <span>前回からの続き</span>
            <strong>${escapeHtml(placeName)}</strong>
            <p>${escapeHtml(placeMemory)}</p>
          </div>
          <div>
            <span>見えてきたこと</span>
            <strong>${escapeHtml(supportedCount > 0 ? "名前の手がかりが増えた" : "分からなさも残っている")}</strong>
            <p>${escapeHtml(learningLine)}</p>
          </div>
          <div>
            <span>世界や地域への効き方</span>
            <strong>この地域のノートが少し厚くなった</strong>
            <p>${escapeHtml(contributionLine)}</p>
          </div>
        </div>
        <a class="notes-digest-link" href="${escapeHtml(latestHref)}">${escapeHtml(latest ? "このページを詳しく読む" : "近くのページを読む")}</a>
      </article>
      <aside class="notes-digest-rail" aria-label="今日の読み順">
        <div class="notes-digest-rail-head">今日の読み順</div>
        ${readingOrder.map((item, index) => `<div class="notes-reading-step">
          <b>${index + 1}</b>
          <span><em>${escapeHtml(item.label)}</em><strong>${escapeHtml(item.value)}</strong></span>
        </div>`).join("")}
        <div class="notes-digest-score">
          <strong>${escapeHtml(formatProfileNumber(snapshot.viewerUserId ? ownObservationPages : snapshot.stats.observationCount))}</strong>
          <span>${escapeHtml(snapshot.viewerUserId ? "自分のページ" : "公開ページ")}</span>
        </div>
      </aside>
    </div>
  </section>`;
}

function renderNotesLearningHighlights(snapshot: LandingSnapshot, digest: ProfileNoteDigest | null = null): string {
  const ownEntries = snapshot.myFeed;
  const uniqueNames = new Set(ownEntries.map((obs) => obs.displayName).filter(Boolean));
  const supportedCount = ownEntries.filter((obs) => obs.identificationCount > 0).length;
  const identificationMemos = ownEntries.filter((obs) => obs.entryType === "identification").length;
  const openQuestions = ownEntries.filter((obs) => obs.identificationCount === 0 && obs.entryType !== "identification").length;
  const cards = [
    {
      value: formatProfileNumber(uniqueNames.size),
      label: "よく見返せる生きもの",
      body: uniqueNames.size > 0 ? "名前の並びが、自分の観察テーマになっていきます。" : "近くのページを読むほど、見たい対象が見つかります。",
    },
    {
      value: formatProfileNumber(supportedCount),
      label: "同定が育ったページ",
      body: supportedCount > 0 ? "候補名や人の同定が、読み返す手がかりになります。" : "まだ揺れている名前も、学びの余白として残ります。",
    },
    {
      value: formatProfileNumber(openQuestions),
      label: "まだ名前が揺れている記録",
      body: "分からないまま残るページは、次に分かる楽しみを作ります。",
    },
    {
      value: formatProfileNumber(identificationMemos),
      label: "自分が残した同定メモ",
      body: "誰かのページに残した見立ても、自分の学びの履歴です。",
    },
  ];
  return `<section id="notes-learning" class="section notes-page" data-testid="notes-learning">
    <div class="notes-section-head">
      <div><div class="notes-eyebrow">学びのハイライト</div><h2>前より見えてきたこと</h2></div>
      <p>${escapeHtml(digest?.learningHighlight || "正解数ではなく、見返すたびに増える観点を並べます。")}</p>
    </div>
    <div class="notes-metric-grid">
      ${cards.map((card) => `<div class="notes-metric-card">
        <strong>${escapeHtml(card.value)}</strong>
        <span>${escapeHtml(card.label)}</span>
        <p>${escapeHtml(card.body)}</p>
      </div>`).join("")}
    </div>
  </section>`;
}

function renderNotesContributionSummary(snapshot: LandingSnapshot, digest: ProfileNoteDigest | null = null): string {
  const ownObservationPages = snapshot.myFeed.filter((obs) => obs.entryType !== "identification").length;
  const placeCount = snapshot.myPlaces.length;
  const weekCount = snapshot.habit?.thisWeekCount ?? 0;
  const supportedPages = snapshot.myFeed.filter((obs) => obs.identificationCount > 0 || obs.entryType === "identification").length;
  const cards = snapshot.viewerUserId
    ? [
      { value: formatProfileNumber(ownObservationPages), label: "地域に残したページ" },
      { value: formatProfileNumber(placeCount), label: "場所の章" },
      { value: formatProfileNumber(weekCount), label: "今週読める足あと" },
      { value: formatProfileNumber(supportedPages), label: "同定の手がかり" },
    ]
    : [
      { value: formatProfileNumber(snapshot.stats.observationCount), label: "公開されているページ" },
      { value: formatProfileNumber(snapshot.stats.speciesCount), label: "見えてきた生きもの" },
      { value: formatProfileNumber(snapshot.stats.placeCount), label: "場所の記憶" },
      { value: formatProfileNumber(snapshot.feed.filter((obs) => obs.identificationCount > 0).length), label: "同定の手がかり" },
    ];
  return `<section id="notes-impact" class="section notes-impact" data-testid="notes-impact">
    <div class="notes-impact-band">
      <div>
        <div class="notes-eyebrow">地域に残った手がかり</div>
        <h2>キミの記録で、この地域のノートが少し厚くなった</h2>
        <p>${escapeHtml(digest?.contributionStory || "大げさに言い切らず、いま見えている観察・場所・同定の範囲で、役立ったことだけを返します。")}</p>
      </div>
      <div class="notes-impact-grid">
        ${cards.map((card) => `<div><strong>${escapeHtml(card.value)}</strong><span>${escapeHtml(card.label)}</span></div>`).join("")}
      </div>
    </div>
  </section>`;
}

function renderNotesPlaceChapters(basePath: string, lang: SiteLang, snapshot: LandingSnapshot, digest: ProfileNoteDigest | null = null): string {
  if (!snapshot.viewerUserId || snapshot.myPlaces.length === 0) {
    return `<section id="notes-places" class="section notes-page" data-testid="notes-places">
      <div class="notes-section-head"><div><div class="notes-eyebrow">場所の章</div><h2>読み返す場所</h2></div></div>
      <div class="notes-empty-reading">場所の章はまだありません。近くのページを読むと、同じ場所を何度も見返す面白さが分かります。</div>
    </section>`;
  }
  const digestByPlace = new Map((digest?.placeChapters ?? []).map((chapter) => [chapter.placeName, chapter]));
  const chapters = snapshot.myPlaces.map((place) => {
    const focus = pickPlaceFocus(place);
    const digestChapter = digestByPlace.get(place.placeName);
    const compared = place.previousObservedAt
      ? `前回 ${formatShortDate(place.previousObservedAt, "ja-JP")}`
      : "この場所の最初のページ";
    const href = appendLangToHref(withBasePath(basePath, "/notes#notes-own"), lang);
    const localClue = digestChapter?.localClue
      || `${place.visitCount} 回分のページが、この場所をあとから読める手がかりになっています。`;
    return `<a class="notes-place-chapter" href="${escapeHtml(href)}">
      <span class="notes-place-topline">${escapeHtml(place.municipality || "地域")}</span>
      <strong>${escapeHtml(place.placeName)}</strong>
      <span>前回見たもの: ${escapeHtml(place.latestDisplayName || "まだ名前を確かめているページ")}</span>
      <span>${escapeHtml(compared)} · ${escapeHtml(String(place.visitCount))} 回分</span>
      <em>${escapeHtml(digestChapter?.readingAngle || (focus ? `次に読む観点: ${focus}` : "次に読む観点: 小さな変化"))}</em>
      <span>地域への手がかり: ${escapeHtml(localClue)}</span>
      <b>この場所を読む</b>
    </a>`;
  }).join("");
  return `<section id="notes-places" class="section notes-page" data-testid="notes-places">
    <div class="notes-section-head">
      <div><div class="notes-eyebrow">場所の章</div><h2>読み返す場所</h2></div>
      <p>よく歩く場所を、行き先ではなく読み返す章として並べます。</p>
    </div>
    <div class="notes-place-grid">${chapters}</div>
  </section>`;
}

const NOTES_READING_STYLES = `
  .notes-page { margin-top: 24px; }
  .notes-section-head { display: grid; grid-template-columns: minmax(0,.74fr) minmax(240px,.26fr); gap: 18px; align-items: end; margin-bottom: 18px; }
  .notes-section-head h2 { margin: 6px 0 0; color: #1a2e1f; font-size: clamp(27px,3vw,42px); line-height: 1.12; letter-spacing: 0; }
  .notes-section-head p { margin: 0; color: #64748b; line-height: 1.75; font-weight: 680; }
  .notes-eyebrow { color: #047857; font-size: 12px; font-weight: 950; }
  .notes-digest-shell {
    display: grid;
    grid-template-columns: minmax(0, .68fr) minmax(280px, .32fr);
    gap: 14px;
    align-items: stretch;
  }
  .notes-digest-main, .notes-digest-rail {
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 8px;
    background: rgba(255,255,255,.84);
    box-shadow: 0 16px 38px rgba(15,23,42,.06);
  }
  .notes-digest-main {
    min-height: 360px;
    padding: clamp(20px, 3vw, 30px);
    display: grid;
    gap: 16px;
    align-content: start;
    background:
      linear-gradient(135deg, rgba(236,253,245,.74), rgba(255,255,255,.9) 45%, rgba(240,249,255,.72)),
      rgba(255,255,255,.86);
  }
  .notes-digest-kicker, .notes-digest-rail-head {
    color: #047857;
    font-size: 12px;
    font-weight: 950;
  }
  .notes-digest-main h3 {
    margin: 0;
    max-width: 16ch;
    color: #1a2e1f;
    font-size: clamp(30px, 4.1vw, 56px);
    line-height: 1.05;
    letter-spacing: 0;
  }
  .notes-digest-main > p {
    margin: 0;
    max-width: 58em;
    color: #374151;
    line-height: 1.85;
    font-weight: 720;
  }
  .notes-digest-main blockquote {
    margin: 0;
    padding: 14px 16px;
    border-left: 4px solid #10b981;
    border-radius: 8px;
    background: rgba(255,255,255,.72);
    color: #1a2e1f;
    font-size: 17px;
    line-height: 1.7;
    font-weight: 900;
  }
  .notes-digest-story-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .notes-digest-story-grid div {
    min-height: 154px;
    padding: 14px;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: rgba(255,255,255,.78);
  }
  .notes-digest-story-grid span {
    display: block;
    color: #047857;
    font-size: 12px;
    font-weight: 950;
  }
  .notes-digest-story-grid strong {
    display: block;
    margin-top: 8px;
    color: #1a2e1f;
    font-size: 16px;
    line-height: 1.35;
  }
  .notes-digest-story-grid p {
    margin: 8px 0 0;
    color: #64748b;
    font-size: 13px;
    line-height: 1.65;
    font-weight: 700;
  }
  .notes-digest-link {
    width: fit-content;
    min-height: 42px;
    display: inline-flex;
    align-items: center;
    padding: 10px 14px;
    border-radius: 999px;
    background: #10251a;
    color: #fff;
    text-decoration: none;
    font-size: 13px;
    font-weight: 900;
    box-shadow: 0 14px 30px rgba(16,37,26,.16);
  }
  .notes-digest-rail {
    padding: 16px;
    display: grid;
    gap: 10px;
    align-content: start;
  }
  .notes-reading-step {
    display: grid;
    grid-template-columns: 32px minmax(0, 1fr);
    gap: 10px;
    align-items: start;
    padding: 10px;
    border-radius: 8px;
    background: rgba(236,253,245,.72);
  }
  .notes-reading-step b {
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 999px;
    background: #10b981;
    color: #fff;
    line-height: 1;
  }
  .notes-reading-step em {
    display: block;
    color: #047857;
    font-style: normal;
    font-size: 11px;
    font-weight: 950;
  }
  .notes-reading-step strong {
    display: block;
    margin-top: 3px;
    color: #1a2e1f;
    font-size: 13px;
    line-height: 1.45;
  }
  .notes-digest-score {
    margin-top: 4px;
    padding: 14px;
    border-radius: 8px;
    background: rgba(255,255,255,.82);
    border: 1px solid rgba(16,185,129,.14);
  }
  .notes-digest-score strong { display: block; color: #1a2e1f; font-size: 32px; line-height: 1; font-weight: 950; }
  .notes-digest-score span { display: block; margin-top: 7px; color: #64748b; font-size: 12px; font-weight: 850; }
  .notes-metric-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
  .notes-metric-card, .notes-place-chapter {
    min-height: 138px;
    padding: 16px;
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 8px;
    background: rgba(255,255,255,.82);
    box-shadow: 0 12px 30px rgba(15,23,42,.055);
    text-decoration: none;
    color: inherit;
  }
  .notes-place-chapter:hover { transform: translateY(-2px); box-shadow: 0 16px 34px rgba(16,185,129,.1); }
  .notes-page-kicker, .notes-place-topline { color: #047857; font-size: 12px; font-weight: 950; }
  .notes-metric-card strong { display: block; color: #1a2e1f; font-size: 30px; line-height: 1.05; font-weight: 950; }
  .notes-metric-card span { display: block; margin-top: 8px; color: #047857; font-size: 12px; font-weight: 900; }
  .notes-metric-card p { margin: 8px 0 0; color: #64748b; line-height: 1.65; font-size: 13px; }
  .notes-impact-band {
    display: grid;
    grid-template-columns: minmax(0,.62fr) minmax(320px,.38fr);
    gap: 18px;
    align-items: center;
    padding: 22px;
    border: 1px solid rgba(16,185,129,.16);
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(236,253,245,.9), rgba(240,249,255,.88));
    box-shadow: 0 18px 42px rgba(16,185,129,.09);
  }
  .notes-impact-band h2 { margin: 8px 0 0; color: #1a2e1f; font-size: clamp(26px,3vw,40px); line-height: 1.14; letter-spacing: 0; }
  .notes-impact-band p { margin: 12px 0 0; color: #475569; line-height: 1.8; font-weight: 700; }
  .notes-impact-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .notes-impact-grid div { padding: 14px; border-radius: 8px; background: rgba(255,255,255,.78); border: 1px solid rgba(16,185,129,.14); }
  .notes-impact-grid strong { display: block; color: #1a2e1f; font-size: 25px; line-height: 1.05; font-weight: 950; }
  .notes-impact-grid span { display: block; margin-top: 6px; color: #64748b; font-size: 12px; font-weight: 850; }
  .notes-place-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .notes-place-chapter { display: grid; gap: 7px; min-height: 190px; }
  .notes-place-chapter strong { color: #1a2e1f; font-size: 19px; line-height: 1.32; }
  .notes-place-chapter span, .notes-place-chapter em { color: #64748b; font-style: normal; font-size: 13px; line-height: 1.55; }
  .notes-place-chapter b { width: fit-content; margin-top: 4px; color: #047857; font-size: 13px; }
  .notes-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
  .notes-grid.is-compact { grid-template-columns: 1fr; }
  .notes-page-card {
    display: grid;
    grid-template-columns: 58px minmax(0, 1fr);
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid rgba(16,185,129,.14);
    border-radius: 8px;
    background: rgba(255,255,255,.86);
    box-shadow: 0 10px 24px rgba(15,23,42,.045);
    color: inherit;
    text-decoration: none;
  }
  .notes-thumb { width: 58px; height: 58px; border-radius: 6px; overflow: hidden; display: grid; place-items: center; background: #ecfdf5; color: #047857; font-weight: 950; }
  .notes-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .notes-page-copy { min-width: 0; display: grid; gap: 3px; }
  .notes-page-copy strong { color: #1a2e1f; font-size: 16px; line-height: 1.35; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .notes-page-copy span:not(.notes-page-kicker), .notes-page-copy em { color: #64748b; font-size: 12px; line-height: 1.45; font-style: normal; font-weight: 720; }
  .notes-empty-reading { padding: 18px; border-radius: 8px; border: 1px solid rgba(16,185,129,.14); background: rgba(255,255,255,.82); color: #64748b; font-weight: 720; line-height: 1.75; }
  @media (max-width: 980px) {
    .notes-digest-shell, .notes-impact-band, .notes-section-head { grid-template-columns: 1fr; }
    .notes-digest-story-grid, .notes-metric-grid, .notes-place-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 620px) {
    .notes-digest-story-grid, .notes-metric-grid, .notes-place-grid, .notes-impact-grid { grid-template-columns: 1fr; }
    .notes-section-head h2 { font-size: 28px; }
    .notes-digest-main h3 { font-size: 34px; max-width: 100%; }
  }
`;

const NOTES_LIBRARY_STYLES = `
  .notes-library-shell { display: grid; gap: 24px; }
  .notes-library-hero {
    display: grid;
    grid-template-columns: minmax(0, .72fr) minmax(240px, .28fr);
    gap: 20px;
    align-items: end;
    padding: clamp(22px, 4vw, 42px);
    border-radius: 8px;
    background: linear-gradient(135deg, rgba(236,253,245,.92), rgba(240,249,255,.78));
    border: 1px solid rgba(16,185,129,.16);
  }
  .notes-library-hero span, .notes-library-section-head span { color: #047857; font-size: 12px; font-weight: 950; }
  .notes-library-hero h1 { margin: 8px 0 0; color: #10251a; font-size: clamp(34px, 5vw, 64px); line-height: 1.03; letter-spacing: 0; }
  .notes-library-hero p { margin: 14px 0 0; max-width: 50em; color: #475569; line-height: 1.8; font-weight: 720; }
  .notes-library-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .notes-library-stats div { padding: 13px; border-radius: 8px; background: rgba(255,255,255,.82); border: 1px solid rgba(16,185,129,.13); }
  .notes-library-stats strong { display: block; color: #10251a; font-size: 24px; line-height: 1; font-weight: 950; }
  .notes-library-stats em { display: block; margin-top: 7px; color: #64748b; font-size: 12px; font-style: normal; font-weight: 850; }
  .notes-library-controls { position: sticky; top: 68px; z-index: 5; display: grid; grid-template-columns: minmax(220px, .34fr) minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 10px; border-radius: 8px; background: rgba(255,255,255,.9); border: 1px solid rgba(16,185,129,.14); box-shadow: 0 12px 30px rgba(15,23,42,.055); backdrop-filter: blur(16px); }
  .notes-library-search { min-height: 42px; display: flex; align-items: center; gap: 8px; padding: 0 12px; border-radius: 8px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); }
  .notes-library-search span { color: #047857; font-weight: 950; }
  .notes-library-search input { width: 100%; border: 0; outline: 0; background: transparent; color: #0f172a; font: inherit; font-weight: 750; }
  .notes-library-filters { display: flex; flex-wrap: wrap; gap: 8px; }
  .notes-library-filters button { min-height: 38px; padding: 8px 12px; border-radius: 999px; border: 1px solid rgba(15,23,42,.08); background: #fff; color: #334155; font: inherit; font-size: 12px; font-weight: 900; cursor: pointer; }
  .notes-library-filters button.is-active { background: #10251a; color: #fff; border-color: #10251a; }
  .notes-library-count { min-height: 42px; display: flex; align-items: center; gap: 7px; padding: 0 12px; border-radius: 8px; background: #ecfdf5; color: #047857; font-size: 12px; font-weight: 900; white-space: nowrap; }
  .notes-library-count strong { color: #10251a; font-size: 18px; }
  .notes-library-source-lanes { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; }
  .notes-library-source-lane { min-height: 72px; display: grid; align-content: center; gap: 5px; text-align: left; padding: 11px; border-radius: 8px; border: 1px solid rgba(15,23,42,.08); background: rgba(255,255,255,.86); color: #334155; font: inherit; cursor: pointer; }
  .notes-library-source-lane span { font-size: 11px; line-height: 1; font-weight: 950; }
  .notes-library-source-lane strong { color: #10251a; font-size: 22px; line-height: 1; font-weight: 950; }
  .notes-library-source-lane.is-source-photo { border-color: rgba(16,185,129,.18); background: #ecfdf5; }
  .notes-library-source-lane.is-source-video { border-color: rgba(14,165,233,.18); background: #f0f9ff; }
  .notes-library-source-lane.is-source-guide { border-color: rgba(245,158,11,.2); background: #fffbeb; }
  .notes-library-source-lane.is-source-scan { border-color: rgba(20,184,166,.2); background: #f0fdfa; }
  .notes-library-source-lane.is-source-note { border-color: rgba(100,116,139,.16); background: #f8fafc; }
  .notes-library-section-head { display: grid; grid-template-columns: minmax(0, .7fr) minmax(220px, .3fr); gap: 16px; align-items: end; margin-bottom: 14px; }
  .notes-library-section-head h2, .notes-library-month-head h2 { margin: 5px 0 0; color: #10251a; font-size: clamp(24px, 2.6vw, 36px); line-height: 1.14; letter-spacing: 0; }
  .notes-library-section-head p { margin: 0; color: #64748b; line-height: 1.75; font-weight: 700; }
  .notes-library-album-row { display: flex; gap: 10px; overflow-x: auto; padding-bottom: 3px; scroll-snap-type: x proximity; }
  .notes-library-album { flex: 0 0 240px; min-height: 112px; display: grid; gap: 6px; text-align: left; padding: 14px; border-radius: 8px; border: 1px solid rgba(16,185,129,.16); background: rgba(255,255,255,.86); color: inherit; font: inherit; cursor: pointer; scroll-snap-align: start; }
  .notes-library-album span { color: #047857; font-size: 11px; font-weight: 950; }
  .notes-library-album strong { color: #10251a; font-size: 16px; line-height: 1.35; }
  .notes-library-album em { color: #64748b; font-size: 12px; line-height: 1.45; font-style: normal; font-weight: 800; }
  .notes-library-month { display: grid; gap: 12px; }
  .notes-library-month[hidden], .notes-library-card[hidden] { display: none; }
  .notes-library-month-head { display: flex; justify-content: space-between; gap: 12px; align-items: end; }
  .notes-library-month-head span { color: #64748b; font-size: 12px; font-weight: 900; }
  .notes-library-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(158px, 1fr)); grid-auto-flow: dense; gap: 10px; }
  .notes-library-card { position: relative; min-height: 184px; aspect-ratio: 1 / 1.12; overflow: hidden; border-radius: 8px; background: #ecfdf5; color: #fff; text-decoration: none; border: 1px solid rgba(16,185,129,.14); box-shadow: 0 12px 28px rgba(15,23,42,.06); }
  .notes-library-card:nth-child(7n + 1) { grid-row: span 2; aspect-ratio: 1 / 1.35; }
  .notes-library-card:hover { transform: translateY(-2px); box-shadow: 0 18px 36px rgba(16,185,129,.12); }
  .notes-library-photo { position: absolute; inset: 0; display: grid; place-items: center; background: linear-gradient(135deg, rgba(236,253,245,.96), rgba(219,234,254,.9)); color: #047857; font-size: 34px; font-weight: 950; }
  .notes-library-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .notes-library-card::after { content: ""; position: absolute; inset: 34% 0 0; background: linear-gradient(180deg, transparent, rgba(15,23,42,.78)); pointer-events: none; }
  .notes-library-card.is-photo-missing::after { background: linear-gradient(180deg, rgba(255,255,255,0), rgba(16,37,26,.18)); }
  .notes-library-overlay { position: absolute; inset: auto 0 0; z-index: 1; display: grid; gap: 5px; padding: 12px; }
  .notes-library-overlay strong { color: #fff; font-size: 15px; line-height: 1.25; text-shadow: 0 1px 9px rgba(0,0,0,.34); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .notes-library-overlay em { color: rgba(255,255,255,.86); font-size: 11px; line-height: 1.35; font-style: normal; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .notes-library-card.is-photo-missing .notes-library-overlay strong { color: #10251a; text-shadow: none; }
  .notes-library-card.is-photo-missing .notes-library-overlay em { color: #475569; }
  .notes-library-badges { display: flex; flex-wrap: wrap; gap: 5px; }
  .notes-library-badges b { width: fit-content; padding: 4px 7px; border-radius: 999px; background: rgba(255,255,255,.86); color: #065f46; font-size: 10px; line-height: 1; font-weight: 950; }
  .notes-source-badge.is-source-video { color: #0369a1; }
  .notes-source-badge.is-source-guide { color: #92400e; }
  .notes-source-badge.is-source-scan { color: #0f766e; }
  .notes-source-badge.is-source-note { color: #475569; }
  .notes-library-empty { padding: 20px; border-radius: 8px; border: 1px solid rgba(16,185,129,.14); background: rgba(255,255,255,.82); color: #64748b; font-weight: 720; line-height: 1.75; }
  .notes-nearby-library { opacity: .9; }
  .notes-nearby-library .notes-library-grid { grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); }
  .notes-nearby-library .notes-library-card { min-height: 150px; }
  @media (max-width: 980px) {
    .notes-library-hero, .notes-library-controls, .notes-library-section-head { grid-template-columns: 1fr; }
    .notes-library-controls { position: static; }
  }
  @media (max-width: 620px) {
    .notes-library-hero { padding: 22px; }
    .notes-library-hero h1 { font-size: 38px; }
    .notes-library-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .notes-library-stats div { padding: 10px; }
    .notes-library-stats strong { font-size: 19px; }
    .notes-library-source-lanes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .notes-library-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .notes-library-card, .notes-library-card:nth-child(7n + 1) { min-height: 168px; aspect-ratio: 1 / 1.18; grid-row: auto; }
    .notes-library-album { flex-basis: 210px; }
  }
`;

export async function registerReadRoutes(app: FastifyInstance): Promise<void> {
  app.get("/record", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    const resolution = resolveViewer(request.query, session);
    const viewerUserId = resolution.viewerUserId ?? "";
    if (!viewerUserId) {
      reply.type("text/html; charset=utf-8");
      return renderRecordStartGuide(basePath, lang, String((request as unknown as { url?: string }).url ?? "/record"));
    }

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "記録する | ikimon",
      `<section class="record-page">
        <div class="record-shell">
          <section class="record-card record-sheet">
            <div class="record-card-head">
              <div>
                <div class="eyebrow" id="record-mode-eyebrow">投稿入口</div>
                <h2>まず、どう残すかを選ぶ</h2>
                <p class="meta" id="record-mode-lead">写真、動画、手元のファイル、ライブガイドから始められます。まず主役を1つ決め、周囲の様子も手がかりとして残します。</p>
              </div>
              <div class="record-session-pill">
                <span class="record-session-label">ログイン中</span>
                <strong>${escapeHtml(viewerUserId)}</strong>
              </div>
            </div>
            <div class="record-capture-launcher" aria-label="投稿の始め方">
              <button type="button" class="record-capture-option is-primary" data-capture-action="photo">
                <span class="record-capture-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/></svg></span>
                <strong>写真</strong>
                <span>その場の1枚をすぐ残す</span>
              </button>
              <button type="button" class="record-capture-option" data-capture-action="video">
                <span class="record-capture-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11"/><rect x="3" y="6" width="13" height="12" rx="2"/></svg></span>
                <strong>動画</strong>
                <span>動きや鳴き方ごと残す</span>
              </button>
              <button type="button" class="record-capture-option" data-capture-action="gallery">
                <span class="record-capture-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></span>
                <strong>選ぶ</strong>
                <span>撮影済みの写真や動画を使う</span>
              </button>
              <a class="record-capture-option record-capture-link" href="${escapeHtml(withBasePath(basePath, "/guide"))}">
                <span class="record-capture-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 16 0"/><path d="M12 4v4"/><path d="M6.3 6.3 9 9"/><path d="M17.7 6.3 15 9"/><path d="M3 13h4"/><path d="M17 13h4"/><path d="M9 17h6"/><path d="M10 21h4"/></svg></span>
                <strong>ガイド</strong>
                <span>AIのヒントを見ながら探す</span>
              </a>
            </div>
            <div class="record-subject-context" aria-label="主役と周囲の残し方">
              <div>
                <span class="record-label">主役と周囲</span>
                <strong>主役は1つ選べばOK</strong>
                <p>広角写真、環境、鳴き声、同じ画面に写った別の生きものも、AIが補助的な手がかりとして見ます。あとで別の観察に切り出せる余地も残します。</p>
              </div>
              <div class="record-subject-context-tags" aria-label="メディアの役割">
                <span>主役</span>
                <span>周囲</span>
                <span>音・動き</span>
                <span>別対象の候補</span>
              </div>
            </div>
            <div class="record-capture-dock" aria-label="すぐ投稿する">
              <button type="button" class="record-dock-action record-dock-primary" data-capture-action="photo">
                <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M14.5 4h-5L8 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="12.5" r="3.5"/></svg></span>
                <span>写真</span>
              </button>
              <button type="button" class="record-dock-action" data-capture-action="video">
                <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m16 13 5.2 3.1a.5.5 0 0 0 .8-.4V8.3a.5.5 0 0 0-.8-.4L16 11"/><rect x="3" y="6" width="13" height="12" rx="2"/></svg></span>
                <span>動画</span>
              </button>
              <button type="button" class="record-dock-action" data-capture-action="gallery">
                <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg></span>
                <span>選ぶ</span>
              </button>
              <a class="record-dock-action" href="${escapeHtml(withBasePath(basePath, "/guide"))}">
                <span class="record-dock-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 16 0"/><path d="M12 4v4"/><path d="M6.3 6.3 9 9"/><path d="M17.7 6.3 15 9"/><path d="M3 13h4"/><path d="M17 13h4"/><path d="M9 17h6"/><path d="M10 21h4"/></svg></span>
                <span>ガイド</span>
              </a>
            </div>
            <div id="record-capture-result" class="record-capture-result" hidden>
              <div>
                <span class="record-label">選択中</span>
                <strong id="record-capture-result-title">未選択</strong>
                <p id="record-capture-result-help">ファイルを選ぶと入力欄が開きます。主役以外の周囲も、AIが手がかりとして見ます。</p>
              </div>
              <button type="button" class="btn btn-ghost" id="record-capture-change">選び直す</button>
            </div>
            <div id="record-location-nudge" class="record-location-nudge" hidden>
              <div>
                <strong>写真に場所も入れる</strong>
                <p>現在地を入れると、あとで同じ場所を見返しやすくなります。</p>
              </div>
              <button type="button" data-record-locate>現在地を入れる</button>
            </div>
            <div id="record-autofill-status" class="record-autofill-status" hidden aria-live="polite"></div>
            <form id="record-form" data-user-id="${escapeHtml(viewerUserId)}" class="record-form" hidden>
              <input id="record-media-photo" data-record-media-input data-capture-kind="photo" type="file" accept="image/*" capture="environment" multiple hidden />
              <input id="record-media-video" data-record-media-input data-capture-kind="video" type="file" accept="video/*" capture="environment" hidden />
              <input id="record-media" data-record-media-input data-capture-kind="gallery" type="file" accept="image/*,video/*" multiple hidden />
              <input id="record-video-primary-photo-input" type="file" accept="image/*" capture="environment" hidden />
              <input type="hidden" name="recordMode" value="quick" />
              <div id="record-submit-panel" class="record-submit-panel" hidden>
                <div>
                  <span class="record-label">送信前チェック</span>
                  <strong id="record-submit-panel-title">メディア未選択</strong>
                  <p id="record-submit-panel-help">写真や動画を選ぶと、ここから投稿できます。</p>
                </div>
                <button type="submit" class="btn btn-solid">投稿する</button>
              </div>
              <div id="record-video-primary-photo" class="record-video-primary-photo" hidden>
                <div>
                  <span class="record-label">動画の主役写真</span>
                  <strong id="record-video-primary-photo-title">主役写真を追加</strong>
                  <p id="record-video-primary-photo-help">動画だけでは「どれが主役か」が曖昧になりやすいので、主役がよく写った写真を1枚添えると同定しやすくなります。</p>
                </div>
                <div class="record-video-primary-photo-actions">
                  <button type="button" class="btn btn-solid" id="record-video-primary-photo-pick">主役写真を追加</button>
                  <button type="button" class="btn btn-ghost" id="record-video-primary-photo-clear" hidden>外す</button>
                </div>
              </div>
              <div class="record-field record-field-wide record-media-role">
                <span class="record-label">このメディアの役割</span>
                <div class="record-media-role-grid" role="radiogroup" aria-label="このメディアの役割">
                  <label class="record-media-role-chip">
                    <input type="radio" name="mediaRole" value="primary_subject" checked />
                    <strong>主役</strong>
                    <span>この記録の中心</span>
                  </label>
                  <label class="record-media-role-chip">
                    <input type="radio" name="mediaRole" value="context" />
                    <strong>周囲</strong>
                    <span>場所・環境の手がかり</span>
                  </label>
                  <label class="record-media-role-chip">
                    <input type="radio" name="mediaRole" value="sound_motion" />
                    <strong>音・動き</strong>
                    <span>鳴き声や行動</span>
                  </label>
                  <label class="record-media-role-chip">
                    <input type="radio" name="mediaRole" value="secondary_candidate" />
                    <strong>別対象候補</strong>
                    <span>同じ画面の別の生きもの</span>
                  </label>
                </div>
                <p class="record-help">あとで同じ写真や動画から別の観察を切り出せるよう、保存データにも役割を残します。</p>
              </div>
              <div id="record-video-trim" class="record-video-trim" hidden>
                <div class="record-video-trim-head">
                  <div>
                    <strong>投稿する最大60秒を選ぶ</strong>
                    <p>動画投稿は最大60秒です。長めに撮った動画から、見せたい動きや鳴き声の区間だけを切り出します。</p>
                  </div>
                  <span id="record-video-trim-duration">0.0秒</span>
                </div>
                <div class="record-video-trim-preview">
                  <video id="record-video-trim-player" controls playsinline preload="metadata" aria-label="動画トリミングプレビュー"></video>
                </div>
                <div class="record-video-trim-controls">
                  <label>
                    <span>開始 <output id="record-video-trim-start-label">0.0秒</output></span>
                    <input id="record-video-trim-start" type="range" min="0" max="0" step="0.1" value="0" />
                  </label>
                  <label>
                    <span>終了 <output id="record-video-trim-end-label">0.0秒</output></span>
                    <input id="record-video-trim-end" type="range" min="0" max="0" step="0.1" value="0" />
                  </label>
                </div>
                <div class="record-video-trim-actions">
                  <button type="button" class="btn btn-solid" id="record-video-trim-apply">この区間で使う</button>
                  <span id="record-video-trim-status" aria-live="polite">投稿は最大60秒です。区間を選ぶと投稿前に短い動画を作ります。</span>
                </div>
              </div>
              <label class="record-field record-field-wide"><span class="record-label">観察した日時</span><input id="observedAt" name="observedAt" type="datetime-local" required /></label>
              <div class="record-field record-field-wide record-gps-row">
                <span class="record-label">撮影地点</span>
                <div class="record-place-picker">
                  <div class="record-place-head">
                    <div>
                      <strong id="record-location-label">地点未指定</strong>
                      <p id="record-location-help">現在地、検索、地図タップで撮影地点を決められます。</p>
                    </div>
                    <button type="button" class="btn btn-ghost record-gps-btn" data-record-locate>現在地</button>
                  </div>
                  <div class="record-place-search">
                    <input id="record-location-search" type="search" placeholder="公園名・駅名・住所で探す" autocomplete="off" />
                    <button type="button" id="record-location-search-btn">検索</button>
                  </div>
                  <div id="record-location-results" class="record-location-results" hidden></div>
                  <div id="record-location-map" class="record-location-map" aria-label="撮影地点を地図で指定">
                    <div class="record-location-map-fallback">地図を読み込み中。表示されたらタップして地点を指定できます。</div>
                  </div>
                  <details class="record-coordinate-details">
                    <summary>座標を直接編集</summary>
                    <div class="record-gps-inputs">
                      <label class="record-field"><span class="record-label">緯度</span><input name="latitude" type="number" step="0.000001" placeholder="自動取得 or 手入力" required /></label>
                      <label class="record-field"><span class="record-label">経度</span><input name="longitude" type="number" step="0.000001" placeholder="自動取得 or 手入力" required /></label>
                    </div>
                  </details>
                </div>
              </div>
              <label class="record-field record-field-wide"><span class="record-label">場所のメモ</span><input name="localityNote" type="text" placeholder="例: 公園の入口付近 / 水辺の柵のそば" /></label>
              <details class="record-field record-field-wide record-advanced">
                <summary>詳しく残す</summary>
                <div class="record-advanced-grid">
                  <label class="record-field"><span class="record-label">和名 / 通称（分かれば）</span><input name="vernacularName" type="text" placeholder="例: スズメ" /></label>
                  <label class="record-field"><span class="record-label">学名 / 分類（分かれば）</span><input name="scientificName" type="text" placeholder="例: Passer montanus" /></label>
                  <label class="record-field"><span class="record-label">市区町村</span><input name="municipality" type="text" placeholder="例: 浜松市" /></label>
                  <label class="record-field"><span class="record-label">確信度</span><input name="rank" type="text" value="species" placeholder="species / genus / family" /></label>
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
                  </div>
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
                </div>
              </details>
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
              <div class="record-submit-dock" aria-label="記録を送信する">
                <button type="button" class="record-submit-location" data-record-locate>現在地</button>
                <span id="record-submit-dock-meta" class="record-submit-dock-meta">メディア未選択</span>
                <button type="submit" class="record-submit-primary">投稿する</button>
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
                <div class="row"><div><strong>周囲も手がかりになる</strong><div class="meta">広角、背景、鳴き声、同じ画面の別対象も、AIが補助情報として読む。</div></div></div>
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
        const mediaRoleInputs = form ? Array.from(form.querySelectorAll('input[name="mediaRole"]')) : [];
        const previewDate = document.getElementById('record-preview-date');
        const previewKicker = document.getElementById('record-preview-kicker');
        const previewTitle = document.getElementById('record-preview-title');
        const previewPlace = document.getElementById('record-preview-place');
        const previewMunicipality = document.getElementById('record-preview-municipality');
        const previewCoords = document.getElementById('record-preview-coords');
        const previewPhoto = document.getElementById('record-preview-photo');
        const mediaInput = document.getElementById('record-media');
        const mediaInputs = Array.from(document.querySelectorAll('[data-record-media-input]'));
        const captureButtons = Array.from(document.querySelectorAll('[data-capture-action]'));
        const captureResult = document.getElementById('record-capture-result');
        const captureResultTitle = document.getElementById('record-capture-result-title');
        const captureResultHelp = document.getElementById('record-capture-result-help');
        const captureChange = document.getElementById('record-capture-change');
        const locationNudge = document.getElementById('record-location-nudge');
        const autofillStatus = document.getElementById('record-autofill-status');
        const locateButtons = Array.from(document.querySelectorAll('[data-record-locate]'));
        const locationLabel = document.getElementById('record-location-label');
        const locationHelp = document.getElementById('record-location-help');
        const locationMapEl = document.getElementById('record-location-map');
        const locationSearchInput = document.getElementById('record-location-search');
        const locationSearchButton = document.getElementById('record-location-search-btn');
        const locationResults = document.getElementById('record-location-results');
        const videoProgressWrap = document.getElementById('record-video-progress');
        const videoProgressBar = document.getElementById('record-video-progressbar');
        const videoProgressLabel = document.getElementById('record-video-progress-label');
        const videoProgressBytes = document.getElementById('record-video-progress-bytes');
        const videoLive = document.getElementById('record-video-live');
        const videoCancel = document.getElementById('record-video-cancel');
        const videoTrimWrap = document.getElementById('record-video-trim');
        const videoTrimPlayer = document.getElementById('record-video-trim-player');
        const videoTrimStart = document.getElementById('record-video-trim-start');
        const videoTrimEnd = document.getElementById('record-video-trim-end');
        const videoTrimStartLabel = document.getElementById('record-video-trim-start-label');
        const videoTrimEndLabel = document.getElementById('record-video-trim-end-label');
        const videoTrimDuration = document.getElementById('record-video-trim-duration');
        const videoTrimApply = document.getElementById('record-video-trim-apply');
        const videoTrimStatus = document.getElementById('record-video-trim-status');
        const videoPrimaryPhotoWrap = document.getElementById('record-video-primary-photo');
        const videoPrimaryPhotoInput = document.getElementById('record-video-primary-photo-input');
        const videoPrimaryPhotoPick = document.getElementById('record-video-primary-photo-pick');
        const videoPrimaryPhotoClear = document.getElementById('record-video-primary-photo-clear');
        const videoPrimaryPhotoTitle = document.getElementById('record-video-primary-photo-title');
        const videoPrimaryPhotoHelp = document.getElementById('record-video-primary-photo-help');
        const submitPanel = document.getElementById('record-submit-panel');
        const submitPanelTitle = document.getElementById('record-submit-panel-title');
        const submitPanelHelp = document.getElementById('record-submit-panel-help');
        const submitDockMeta = document.getElementById('record-submit-dock-meta');
        const MAX_PHOTO_FILES = 6;
        const PHOTO_UPLOAD_MAX_EDGE = 2560;
        const PHOTO_UPLOAD_JPEG_QUALITY = 0.88;
        const MAX_VIDEO_BASIC_POST_BYTES = 200000000;
        const MAX_VIDEO_TUS_BYTES = 1024 * 1024 * 1024;
        const TUS_CHUNK_BYTES = 8 * 1024 * 1024;
        const MAX_VIDEO_SECONDS = 60;
        let previewObjectUrl = '';
        let videoTrimObjectUrl = '';
        let activeTusUpload = null;
        let cancelTusUpload = null;
        let selectedMediaFiles = [];
        let selectedVideoFile = null;
        let selectedPrimaryPhotoFile = null;
        let selectedCaptureKind = '';
        let selectedMediaCapturedAt = null;
        let selectedMediaRole = 'primary_subject';
        let selectedOriginalVideoFile = null;
        let selectedVideoWasTrimmed = false;
        let mediaAutofillSequence = 0;
        let pendingMediaRetryObservationId = '';
        let videoTrimState = null;
        let recordMap = null;
        let recordMapMarker = null;
        let recordMapReady = false;
        let locationSearchAbort = null;
        let recordSubmitInFlight = false;
        const DEFAULT_RECORD_LOCATION = { lat: 34.7108, lng: 137.7261, zoom: 13 };
        const captureLabels = {
          photo: { title: '写真を追加', help: '撮影した写真、または端末上の写真を記録に添付します。' },
          video: { title: '動画を追加', help: '動画投稿は最大60秒まで。大きい動画や不安定な通信では分割送信します。' },
          gallery: { title: 'ファイルを選ぶ', help: '撮影済みの写真または動画を記録に添付します。' },
        };

        if (observedAt && !observedAt.value) {
          const now = new Date();
          observedAt.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        }

        const setStatus = (html) => {
          if (status) status.innerHTML = html;
        };
        const recordSubmitButtons = () => form ? Array.from(form.querySelectorAll('button[type="submit"]')) : [];
        const setRecordSubmitting = (submitting) => {
          recordSubmitInFlight = Boolean(submitting);
          recordSubmitButtons().forEach((button) => {
            button.disabled = Boolean(submitting);
            if (submitting) {
              if (!button.dataset.idleLabel) button.dataset.idleLabel = button.textContent || '';
              button.textContent = '送信中...';
            } else if (button.dataset.idleLabel) {
              button.textContent = button.dataset.idleLabel;
            }
          });
        };

        const isSurveyMode = () => modeInput && modeInput.value === 'survey';

        const coordsMissing = () => {
          if (!form) return true;
          const lat = form.elements.namedItem('latitude');
          const lng = form.elements.namedItem('longitude');
          const latValue = lat && 'value' in lat ? String(lat.value || '').trim() : '';
          const lngValue = lng && 'value' in lng ? String(lng.value || '').trim() : '';
          return !latValue || !lngValue;
        };

        const readCoords = () => {
          if (!form) return null;
          const latField = form.elements.namedItem('latitude');
          const lngField = form.elements.namedItem('longitude');
          const lat = latField && 'value' in latField ? Number(latField.value) : NaN;
          const lng = lngField && 'value' in lngField ? Number(lngField.value) : NaN;
          return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
        };

        const isFreshMedia = () => {
          const capturedAt = selectedMediaCapturedAt instanceof Date ? selectedMediaCapturedAt : null;
          const firstMedia = firstSelectedMediaFile();
          const baseTime = capturedAt || (firstMedia && firstMedia.lastModified ? new Date(firstMedia.lastModified) : null);
          if (!baseTime || Number.isNaN(baseTime.getTime())) return selectedCaptureKind === 'photo';
          return Math.abs(Date.now() - baseTime.getTime()) <= 10 * 60 * 1000;
        };

        const syncLocationNudge = () => {
          if (!locationNudge) return;
          const firstMedia = firstSelectedMediaFile();
          locationNudge.hidden = !(firstMedia && (isImageFile(firstMedia) || isVideoFile(firstMedia)) && coordsMissing() && isFreshMedia());
          syncSubmitCta();
        };

        const updateLocationText = (sourceLabel) => {
          const coords = readCoords();
          if (!locationLabel || !locationHelp) return;
          if (!coords) {
            locationLabel.textContent = '地点未指定';
            locationHelp.textContent = '現在地、検索、地図タップで撮影地点を決められます。';
            return;
          }
          locationLabel.textContent = sourceLabel || '撮影地点を指定済み';
          locationHelp.textContent = coords.lat.toFixed(6) + ', ' + coords.lng.toFixed(6);
        };

        const setRecordLocation = (lat, lng, sourceLabel, opts) => {
          if (!form || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
          const latField = form.elements.namedItem('latitude');
          const lngField = form.elements.namedItem('longitude');
          if (latField && 'value' in latField) latField.value = Number(lat).toFixed(6);
          if (lngField && 'value' in lngField) lngField.value = Number(lng).toFixed(6);
          updateLocationText(sourceLabel);
          syncPreview();
          syncLocationNudge();
          if (recordMapReady && recordMap && window.maplibregl) {
            recordMap.jumpTo({ center: [Number(lng), Number(lat)], zoom: opts && opts.zoom ? opts.zoom : Math.max(recordMap.getZoom(), 15) });
            if (!recordMapMarker) recordMapMarker = new window.maplibregl.Marker({ color: '#047857' }).addTo(recordMap);
            recordMapMarker.setLngLat([Number(lng), Number(lat)]);
          }
        };

        const setAutofillStatus = (items) => {
          if (!autofillStatus) return;
          if (!items || !items.length) {
            autofillStatus.hidden = true;
            autofillStatus.textContent = '';
            return;
          }
          autofillStatus.hidden = false;
          autofillStatus.textContent = '自動入力: ' + items.join(' / ');
        };

        const syncModeUi = () => {
          const survey = isSurveyMode();
          if (modeEyebrow) modeEyebrow.textContent = selectedCaptureKind
            ? (survey ? 'しっかり記録' : 'ふだんの記録')
            : '投稿入口';
          if (modeLead) {
            modeLead.textContent = selectedCaptureKind
              ? (survey
                  ? '見た条件も一緒に残して、あとで比べやすくするための入力です。'
                  : '場所・時間・気づいたことを、まず 1 件残すための入力です。')
              : '写真、動画、手元のファイル、ライブガイドから始められます。選んだあとに必要な入力だけを出します。';
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
          syncLocationNudge();
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

        const dateToLocalInputValue = (date) => {
          if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
          return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        };

        const parseMetadataDate = (value) => {
          const date = new Date(String(value || ''));
          return Number.isNaN(date.getTime()) ? null : date;
        };

        const normalizeDraftMetadata = (metadata) => metadata && typeof metadata === 'object' ? metadata : {};
        const normalizeMediaRole = (value) => {
          const raw = String(value || '').trim();
          return ['primary_subject', 'context', 'sound_motion', 'secondary_candidate'].includes(raw) ? raw : 'primary_subject';
        };

        const syncMediaRoleInputs = () => {
          mediaRoleInputs.forEach((input) => {
            input.checked = input.value === selectedMediaRole;
          });
        };

        const setSelectedMediaRole = (role) => {
          selectedMediaRole = normalizeMediaRole(role);
          syncMediaRoleInputs();
        };

        const selectedPhotoFiles = () => selectedMediaFiles.filter((file) => file instanceof File && isImageFile(file));
        const allSelectedMediaFiles = () => [
          ...selectedPhotoFiles(),
          ...(selectedVideoFile instanceof File ? [selectedVideoFile] : []),
        ];
        const firstSelectedMediaFile = () => allSelectedMediaFiles()[0] || null;
        const hasSelectedMedia = () => allSelectedMediaFiles().length > 0;
        const selectedMediaSummaryText = () => {
          const parts = [];
          const photoCount = selectedPhotoFiles().length + (selectedPrimaryPhotoFile instanceof File ? 1 : 0);
          if (photoCount > 0) parts.push('写真' + String(photoCount) + '枚');
          if (selectedVideoFile instanceof File) parts.push('動画あり');
          if (coordsMissing()) parts.push('地点未指定');
          return parts.length ? parts.join(' / ') : 'メディア未選択';
        };

        const syncSubmitCta = () => {
          const hasMedia = hasSelectedMedia();
          if (submitPanel) submitPanel.hidden = !hasMedia;
          const summary = selectedMediaSummaryText();
          if (submitPanelTitle) submitPanelTitle.textContent = summary;
          if (submitPanelHelp) {
            submitPanelHelp.textContent = hasMedia
              ? 'この1件の観察に、選んだ写真と動画をまとめて保存します。'
              : '写真や動画を選ぶと、ここから投稿できます。';
          }
          if (submitDockMeta) submitDockMeta.textContent = summary;
        };

        const syncVideoPrimaryPhotoUi = () => {
          const hasVideo = selectedVideoFile instanceof File && isVideoFile(selectedVideoFile);
          if (videoPrimaryPhotoWrap) videoPrimaryPhotoWrap.hidden = !hasVideo;
          if (!hasVideo) selectedPrimaryPhotoFile = null;
          if (videoPrimaryPhotoTitle) {
            videoPrimaryPhotoTitle.textContent = selectedPrimaryPhotoFile
              ? '主役写真: ' + (selectedPrimaryPhotoFile.name || '選択済み')
              : '主役写真を追加';
          }
          if (videoPrimaryPhotoHelp) {
            videoPrimaryPhotoHelp.textContent = selectedPrimaryPhotoFile
              ? 'この写真を主役として保存し、動画は音・動きの証拠として同じ観察に添付します。'
              : '動画だけでは「どれが主役か」が曖昧になりやすいので、主役がよく写った写真を1枚添えると同定しやすくなります。';
          }
          if (videoPrimaryPhotoClear) videoPrimaryPhotoClear.hidden = !selectedPrimaryPhotoFile;
        };

        const readMetadataLocation = (metadata) => {
          const location = metadata && metadata.location && typeof metadata.location === 'object' ? metadata.location : null;
          if (!location) return null;
          const lat = Number(location.latitude);
          const lng = Number(location.longitude);
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
          return { lat, lng };
        };

        const parseExifDate = (value) => {
          const match = String(value || '').match(/^(\\d{4}):(\\d{2}):(\\d{2})\\s+(\\d{2}):(\\d{2})(?::(\\d{2}))?/);
          if (!match) return null;
          const date = new Date(
            Number(match[1]),
            Number(match[2]) - 1,
            Number(match[3]),
            Number(match[4]),
            Number(match[5]),
            Number(match[6] || '0'),
          );
          return Number.isNaN(date.getTime()) ? null : date;
        };

        const parseJpegExif = async (file) => {
          if (!file || !isImageFile(file)) return {};
          const type = String(file.type || '').toLowerCase();
          if (type && type !== 'image/jpeg' && type !== 'image/jpg' && !/\\.jpe?g$/i.test(String(file.name || ''))) {
            return {};
          }
          const buffer = await file.slice(0, Math.min(file.size || 0, 512 * 1024)).arrayBuffer();
          const view = new DataView(buffer);
          if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return {};
          let offset = 2;
          while (offset + 4 <= view.byteLength) {
            if (view.getUint8(offset) !== 0xff) break;
            const marker = view.getUint8(offset + 1);
            const segmentLength = view.getUint16(offset + 2, false);
            if (segmentLength < 2 || offset + 2 + segmentLength > view.byteLength) break;
            if (marker === 0xe1 && segmentLength >= 8) {
              const exifHeader = String.fromCharCode(
                view.getUint8(offset + 4),
                view.getUint8(offset + 5),
                view.getUint8(offset + 6),
                view.getUint8(offset + 7),
              );
              if (exifHeader === 'Exif') {
                return readExifTiff(view, offset + 10);
              }
            }
            offset += 2 + segmentLength;
          }
          return {};
        };

        const readExifTiff = (view, tiffStart) => {
          if (tiffStart + 8 > view.byteLength) return {};
          const byteOrder = view.getUint16(tiffStart, false);
          const littleEndian = byteOrder === 0x4949;
          if (!littleEndian && byteOrder !== 0x4d4d) return {};
          if (view.getUint16(tiffStart + 2, littleEndian) !== 42) return {};
          const firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
          const typeBytes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

          const readString = (start, count) => {
            const chars = [];
            for (let i = 0; i < count && start + i < view.byteLength; i += 1) {
              const code = view.getUint8(start + i);
              if (code === 0) break;
              chars.push(String.fromCharCode(code));
            }
            return chars.join('').trim();
          };
          const readNumber = (start, type) => {
            if (start < 0 || start >= view.byteLength) return null;
            if (type === 3 && start + 2 <= view.byteLength) return view.getUint16(start, littleEndian);
            if (type === 4 && start + 4 <= view.byteLength) return view.getUint32(start, littleEndian);
            if (type === 9 && start + 4 <= view.byteLength) return view.getInt32(start, littleEndian);
            if ((type === 5 || type === 10) && start + 8 <= view.byteLength) {
              const numerator = type === 5 ? view.getUint32(start, littleEndian) : view.getInt32(start, littleEndian);
              const denominator = type === 5 ? view.getUint32(start + 4, littleEndian) : view.getInt32(start + 4, littleEndian);
              return denominator ? numerator / denominator : 0;
            }
            if ((type === 1 || type === 7) && start + 1 <= view.byteLength) return view.getUint8(start);
            return null;
          };
          const readValue = (entryOffset) => {
            const type = view.getUint16(entryOffset + 2, littleEndian);
            const count = view.getUint32(entryOffset + 4, littleEndian);
            const totalBytes = (typeBytes[type] || 0) * count;
            if (!totalBytes) return null;
            const valueStart = totalBytes <= 4 ? entryOffset + 8 : tiffStart + view.getUint32(entryOffset + 8, littleEndian);
            if (valueStart < tiffStart || valueStart + totalBytes > view.byteLength) return null;
            if (type === 2) return readString(valueStart, count);
            const values = [];
            for (let i = 0; i < count; i += 1) {
              const value = readNumber(valueStart + i * (typeBytes[type] || 0), type);
              if (value !== null) values.push(value);
            }
            return count === 1 ? values[0] : values;
          };
          const readIfd = (ifdOffset) => {
            const start = tiffStart + ifdOffset;
            if (start < tiffStart || start + 2 > view.byteLength) return {};
            const count = view.getUint16(start, littleEndian);
            const values = {};
            for (let i = 0; i < count; i += 1) {
              const entryOffset = start + 2 + i * 12;
              if (entryOffset + 12 > view.byteLength) break;
              const tag = view.getUint16(entryOffset, littleEndian);
              values[tag] = readValue(entryOffset);
            }
            return values;
          };
          const ifd0 = readIfd(firstIfdOffset);
          const exifIfd = ifd0[0x8769] ? readIfd(Number(ifd0[0x8769])) : {};
          const gpsIfd = ifd0[0x8825] ? readIfd(Number(ifd0[0x8825])) : {};
          const toDecimal = (parts, ref) => {
            if (!Array.isArray(parts) || parts.length < 3) return null;
            const decimal = Number(parts[0]) + Number(parts[1]) / 60 + Number(parts[2]) / 3600;
            if (!Number.isFinite(decimal)) return null;
            return String(ref || '').toUpperCase() === 'S' || String(ref || '').toUpperCase() === 'W' ? -decimal : decimal;
          };
          return {
            capturedAt: parseExifDate(exifIfd[0x9003] || exifIfd[0x9004] || ifd0[0x0132]),
            latitude: toDecimal(gpsIfd[2], gpsIfd[1]),
            longitude: toDecimal(gpsIfd[4], gpsIfd[3]),
          };
        };

        const readCurrentPosition = (options) => new Promise((resolve, reject) => {
          if (!navigator.geolocation) {
            reject(new Error('geolocation_unavailable'));
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (position) => resolve(position),
            () => reject(new Error('geolocation_failed')),
            {
              enableHighAccuracy: options && Object.prototype.hasOwnProperty.call(options, 'enableHighAccuracy') ? Boolean(options.enableHighAccuracy) : true,
              maximumAge: options && Number.isFinite(Number(options.maximumAge)) ? Number(options.maximumAge) : 30000,
              timeout: options && Number.isFinite(Number(options.timeout)) ? Number(options.timeout) : 10000,
            },
          );
        });

        const applyCurrentLocation = async (sourceLabel, silent, options) => {
          if (!form) return false;
          locateButtons.forEach((button) => { button.disabled = true; });
          try {
            const position = await readCurrentPosition(options);
            if (options && typeof options.guard === 'function' && !options.guard()) return false;
            setRecordLocation(position.coords.latitude, position.coords.longitude, sourceLabel, { zoom: 16 });
            return true;
          } catch (_) {
            if (!silent) alert('位置情報の取得に失敗しました。手動で入力してください。');
            return false;
          } finally {
            locateButtons.forEach((button) => { button.disabled = false; });
          }
        };

        const applyMediaAutofill = async (file, metadata, opts) => {
          if (!file || !form) {
            setAutofillStatus([]);
            return;
          }
          const guard = opts && typeof opts.guard === 'function' ? opts.guard : () => true;
          const filled = [];
          const draftMetadata = normalizeDraftMetadata(metadata);
          let exif = {};
          try {
            exif = await parseJpegExif(file);
          } catch (_) {
            exif = {};
          }
          if (!guard()) return;
          const metadataCapturedAt = parseMetadataDate(draftMetadata.capturedAt);
          const capturedAt = exif.capturedAt || metadataCapturedAt || (file.lastModified ? new Date(file.lastModified) : null);
          const observedValue = dateToLocalInputValue(capturedAt);
          if (observedAt && observedValue) {
            observedAt.value = observedValue;
            selectedMediaCapturedAt = capturedAt;
            filled.push(exif.capturedAt || metadataCapturedAt ? '撮影日時' : 'ファイル日時');
          }
          if (Number.isFinite(exif.latitude) && Number.isFinite(exif.longitude)) {
            setRecordLocation(Number(exif.latitude), Number(exif.longitude), '写真の撮影地点', { zoom: 16 });
            filled.push('写真の位置');
          } else {
            const metadataLocation = readMetadataLocation(draftMetadata);
            if (metadataLocation) {
              setRecordLocation(metadataLocation.lat, metadataLocation.lng, '撮影時の現在地', { zoom: 16 });
              filled.push('撮影時の位置');
            } else if (opts && opts.autoLocateFreshCapture && coordsMissing() && isFreshMedia()) {
              const located = await applyCurrentLocation('撮影時の現在地', true, {
                enableHighAccuracy: false,
                maximumAge: 60000,
                timeout: 2500,
                guard,
              });
              if (!guard()) return;
              if (located) filled.push('現在地');
            }
          }
          if (!guard()) return;
          setAutofillStatus(filled);
          syncPreview();
          syncLocationNudge();
        };

        const scheduleMediaAutofill = (file, metadata, opts) => {
          const sequence = ++mediaAutofillSequence;
          const guard = () => sequence === mediaAutofillSequence;
          window.requestAnimationFrame(() => {
            window.setTimeout(() => {
              if (!guard()) return;
              void applyMediaAutofill(file, metadata, { ...(opts || {}), guard }).catch(() => {
                if (!guard()) return;
                setAutofillStatus([]);
                syncLocationNudge();
              });
            }, 0);
          });
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

        const applyStartModeFromQuery = () => {
          const params = new URLSearchParams(window.location.search);
          const start = params.get('start');
          if (start === 'photo' || start === 'video' || start === 'gallery') {
            setPendingCaptureKind(start);
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

        const formatVideoSeconds = (seconds) => {
          const value = Number(seconds);
          if (!Number.isFinite(value) || value < 0) return '0.0秒';
          return value.toFixed(1) + '秒';
        };

        const getVideoDuration = (file) => new Promise((resolve, reject) => {
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
            resolve(duration);
          };
          probe.onerror = () => {
            cleanup();
            reject(new Error('video_metadata_read_failed'));
          };
          probe.src = objectUrl;
        });

        const resetVideoTrim = (opts) => {
          if (videoTrimObjectUrl) {
            URL.revokeObjectURL(videoTrimObjectUrl);
            videoTrimObjectUrl = '';
          }
          if (videoTrimPlayer) {
            videoTrimPlayer.pause();
            videoTrimPlayer.removeAttribute('src');
            videoTrimPlayer.load();
          }
          if (videoTrimWrap) videoTrimWrap.hidden = true;
          if (videoTrimStatus) videoTrimStatus.textContent = '投稿は最大60秒です。区間を選ぶと投稿前に短い動画を作ります。';
          if (videoTrimApply) videoTrimApply.disabled = false;
          videoTrimState = null;
          selectedOriginalVideoFile = null;
          if (!(opts && opts.keepTrimmedFlag)) selectedVideoWasTrimmed = false;
        };

        const syncVideoTrimControls = (changed) => {
          if (!videoTrimState || !videoTrimStart || !videoTrimEnd) return;
          const duration = videoTrimState.duration;
          let start = Number(videoTrimStart.value);
          let end = Number(videoTrimEnd.value);
          if (!Number.isFinite(start)) start = 0;
          if (!Number.isFinite(end)) end = Math.min(duration, MAX_VIDEO_SECONDS);
          start = Math.max(0, Math.min(start, Math.max(0, duration - 0.1)));
          end = Math.max(0.1, Math.min(end, duration));
          if (end <= start + 0.2) {
            if (changed === 'start') end = Math.min(duration, start + 0.2);
            else start = Math.max(0, end - 0.2);
          }
          if (end - start > MAX_VIDEO_SECONDS) {
            if (changed === 'start') end = Math.min(duration, start + MAX_VIDEO_SECONDS);
            else start = Math.max(0, end - MAX_VIDEO_SECONDS);
          }
          videoTrimState.start = start;
          videoTrimState.end = end;
          videoTrimStart.value = String(start);
          videoTrimEnd.value = String(end);
          if (videoTrimStartLabel) videoTrimStartLabel.textContent = formatVideoSeconds(start);
          if (videoTrimEndLabel) videoTrimEndLabel.textContent = formatVideoSeconds(end);
          if (videoTrimDuration) videoTrimDuration.textContent = formatVideoSeconds(end - start);
          if (videoTrimPlayer && Math.abs(Number(videoTrimPlayer.currentTime || 0) - start) > 0.4) {
            videoTrimPlayer.currentTime = start;
          }
          const needsClip = duration > MAX_VIDEO_SECONDS + 0.5 || start > 0.15 || end < duration - 0.15;
          if (videoTrimStatus) {
            videoTrimStatus.textContent = needsClip
              ? '選んだ最大60秒だけの動画を作ってから投稿できます。'
              : '60秒以内なのでこのまま投稿できます。必要なら区間を選べます。';
          }
        };

        const loadVideoTrimEditor = async (file) => {
          resetVideoTrim();
          if (!file || !isVideoFile(file) || !videoTrimWrap || !videoTrimStart || !videoTrimEnd) return;
          const duration = await getVideoDuration(file);
          selectedOriginalVideoFile = file;
          selectedVideoWasTrimmed = false;
          videoTrimState = { sourceFile: file, duration, start: 0, end: Math.min(duration, MAX_VIDEO_SECONDS) };
          videoTrimStart.max = String(duration);
          videoTrimEnd.max = String(duration);
          videoTrimStart.value = '0';
          videoTrimEnd.value = String(Math.min(duration, MAX_VIDEO_SECONDS));
          if (videoTrimObjectUrl) URL.revokeObjectURL(videoTrimObjectUrl);
          videoTrimObjectUrl = URL.createObjectURL(file);
          if (videoTrimPlayer) {
            videoTrimPlayer.src = videoTrimObjectUrl;
            videoTrimPlayer.currentTime = 0;
          }
          videoTrimWrap.hidden = false;
          syncVideoTrimControls();
        };

        const createTrimmedVideoFile = () => new Promise((resolve, reject) => {
          if (!videoTrimState || !videoTrimState.sourceFile) {
            reject(new Error('video_trim_source_missing'));
            return;
          }
          const start = Number(videoTrimState.start || 0);
          const end = Number(videoTrimState.end || 0);
          if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > MAX_VIDEO_SECONDS + 0.5) {
            reject(new Error('video_trim_range_invalid'));
            return;
          }
          const sourceFile = videoTrimState.sourceFile;
          const sourceUrl = URL.createObjectURL(sourceFile);
          const sourceVideo = document.createElement('video');
          const cleanup = () => {
            URL.revokeObjectURL(sourceUrl);
            sourceVideo.pause();
            sourceVideo.removeAttribute('src');
            sourceVideo.load();
          };
          const captureStream = () => {
            const capture = sourceVideo.captureStream || sourceVideo.mozCaptureStream;
            return capture ? capture.call(sourceVideo) : null;
          };
          sourceVideo.preload = 'auto';
          sourceVideo.playsInline = true;
          sourceVideo.volume = 0;
          sourceVideo.src = sourceUrl;
          sourceVideo.onerror = () => {
            cleanup();
            reject(new Error('video_trim_failed'));
          };
          sourceVideo.onloadedmetadata = async () => {
            try {
              sourceVideo.currentTime = start;
              await new Promise((seekResolve, seekReject) => {
                if (Math.abs(Number(sourceVideo.currentTime || 0) - start) < 0.05) {
                  seekResolve(true);
                  return;
                }
                const timer = window.setTimeout(() => seekReject(new Error('video_trim_seek_failed')), 8000);
                sourceVideo.onseeked = () => {
                  window.clearTimeout(timer);
                  seekResolve(true);
                };
              });
              const stream = captureStream();
              if (!stream || typeof MediaRecorder === 'undefined') {
                cleanup();
                reject(new Error('video_trim_unsupported'));
                return;
              }
              const mimeType = MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
                ? 'video/webm;codecs=vp9'
                : MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('video/webm')
                  ? 'video/webm'
                  : '';
              const chunks = [];
              const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
              let settled = false;
              const finish = (error) => {
                if (settled) return;
                settled = true;
                stream.getTracks().forEach((track) => track.stop());
                cleanup();
                if (error) {
                  reject(error);
                  return;
                }
                const type = chunks[0] ? chunks[0].type || 'video/webm' : 'video/webm';
                const blob = new Blob(chunks, { type });
                resolve(new File([blob], 'ikimon-video-trim-' + Date.now() + '.webm', { type, lastModified: Date.now() }));
              };
              recorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) chunks.push(event.data);
              };
              recorder.onerror = () => finish(new Error('video_trim_failed'));
              recorder.onstop = () => finish(null);
              recorder.start(1000);
              await sourceVideo.play();
              const timer = window.setInterval(() => {
                if (sourceVideo.currentTime >= end || sourceVideo.ended) {
                  window.clearInterval(timer);
                  if (recorder.state === 'recording') recorder.stop();
                }
              }, 100);
            } catch (error) {
              cleanup();
              reject(error instanceof Error ? error : new Error('video_trim_failed'));
            }
          };
        });

        const ensureVideoReadyForUpload = async (file) => {
          if (!file || !isVideoFile(file)) return file;
          const duration = await getVideoDuration(file);
          if (duration > MAX_VIDEO_SECONDS + 0.5 && !selectedVideoWasTrimmed) {
            throw new Error('video_trim_required');
          }
          return file;
        };

        const applyVideoTrim = async () => {
          if (!videoTrimState || !selectedOriginalVideoFile) return;
          const duration = Number(videoTrimState.duration || 0);
          const start = Number(videoTrimState.start || 0);
          const end = Number(videoTrimState.end || 0);
          const needsClip = duration > MAX_VIDEO_SECONDS + 0.5 || start > 0.15 || end < duration - 0.15;
          if (!needsClip) {
            selectedVideoFile = selectedOriginalVideoFile;
            selectedVideoWasTrimmed = false;
            if (videoTrimStatus) videoTrimStatus.textContent = 'このまま投稿できます。';
            if (videoLive) videoLive.textContent = '動画をアップロードできます。送信すると開始します。';
            syncSubmitCta();
            return;
          }
          if (videoTrimApply) videoTrimApply.disabled = true;
          if (videoTrimStatus) videoTrimStatus.textContent = '選んだ区間の動画を作成中です...';
          try {
            const trimmedFile = await createTrimmedVideoFile();
            selectedVideoFile = trimmedFile;
            selectedVideoWasTrimmed = true;
            renderPreviewFile(trimmedFile);
            showRecordFormForMedia(allSelectedMediaFiles(), selectedCaptureKind || 'video');
            resetVideoTrim({ keepTrimmedFlag: true });
            if (videoProgressWrap) videoProgressWrap.hidden = false;
            if (videoLive) videoLive.textContent = '切り出した動画をアップロードできます。送信すると開始します。';
          } catch (error) {
            if (videoTrimApply) videoTrimApply.disabled = false;
            const message = normalizeError(error);
            if (videoTrimStatus) {
              videoTrimStatus.textContent = message === 'video_trim_unsupported'
                ? 'このブラウザでは動画の切り出しに対応していません。60秒以内の動画を選んでください。'
                : '動画の切り出しに失敗しました。別の区間か動画で試してください。';
            }
          }
        };

        const hydrateRecordMap = () => {
          if (!locationMapEl || recordMapReady || !window.maplibregl) return;
          recordMapReady = true;
          const fallback = locationMapEl.querySelector('.record-location-map-fallback');
          if (fallback) fallback.style.display = 'none';
          const coords = readCoords();
          const center = coords ? [coords.lng, coords.lat] : [DEFAULT_RECORD_LOCATION.lng, DEFAULT_RECORD_LOCATION.lat];
          recordMap = new window.maplibregl.Map({
            container: locationMapEl,
            style: {
              version: 8,
              sources: {
                osm: {
                  type: 'raster',
                  tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                  tileSize: 256,
                  attribution: '© OpenStreetMap contributors',
                },
              },
              layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
            },
            center,
            zoom: coords ? 15 : DEFAULT_RECORD_LOCATION.zoom,
            attributionControl: false,
          });
          recordMap.addControl(new window.maplibregl.NavigationControl({ showCompass: false }), 'top-right');
          recordMap.on('load', () => {
            if (coords) {
              const currentLabel = locationLabel && locationLabel.textContent && locationLabel.textContent !== '地点未指定'
                ? locationLabel.textContent
                : '撮影地点を指定済み';
              setRecordLocation(coords.lat, coords.lng, currentLabel, { zoom: 15 });
            }
            recordMap.resize();
          });
          recordMap.on('click', (event) => {
            if (!event || !event.lngLat) return;
            setRecordLocation(event.lngLat.lat, event.lngLat.lng, '地図で指定した撮影地点', { zoom: Math.max(recordMap.getZoom(), 15) });
          });
        };

        const ensureRecordMap = () => {
          if (!locationMapEl) return;
          if (window.maplibregl) {
            hydrateRecordMap();
            return;
          }
          if (!document.querySelector('link[data-maplibre="1"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
            link.integrity = 'sha384-MinO0mNliZ3vwppuPOUnGa+iq619pfMhLVUXfC4LHwSCvF9H+6P/KO4Q7qBOYV5V';
            link.crossOrigin = 'anonymous';
            link.referrerPolicy = 'no-referrer';
            link.setAttribute('data-maplibre', '1');
            document.head.appendChild(link);
          }
          if (document.querySelector('script[data-record-maplibre="1"]')) return;
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
          script.integrity = 'sha384-SYKAG6cglRMN0RVvhNeBY0r3FYKNOJtznwA0v7B5Vp9tr31xAHsZC0DqkQ/pZDmj';
          script.crossOrigin = 'anonymous';
          script.referrerPolicy = 'no-referrer';
          script.defer = true;
          script.setAttribute('data-record-maplibre', '1');
          script.onload = hydrateRecordMap;
          script.onerror = () => {
            if (locationMapEl) locationMapEl.classList.add('is-fallback');
          };
          document.head.appendChild(script);
        };

        const renderLocationResults = (rows) => {
          if (!locationResults) return;
          if (!rows || !rows.length) {
            locationResults.innerHTML = '<div class="record-location-empty">候補が見つかりませんでした。</div>';
            locationResults.hidden = false;
            return;
          }
          locationResults.innerHTML = rows.map((row, index) =>
            '<button type="button" class="record-location-result" data-index="' + String(index) + '">' +
              '<strong>' + escapeHtmlText(row.display_name || '地点候補') + '</strong>' +
              '<span>' + escapeHtmlText(Number(row.lat).toFixed(5) + ', ' + Number(row.lon).toFixed(5)) + '</span>' +
            '</button>'
          ).join('');
          locationResults.hidden = false;
          Array.from(locationResults.querySelectorAll('.record-location-result')).forEach((button, index) => {
            button.addEventListener('click', () => {
              const row = rows[index];
              const lat = Number(row && row.lat);
              const lng = Number(row && row.lon);
              if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
              setRecordLocation(lat, lng, '検索で選んだ撮影地点', { zoom: 16 });
              if (locationSearchInput) locationSearchInput.value = row.display_name || '';
              locationResults.innerHTML = '';
              locationResults.hidden = true;
            });
          });
        };

        const searchRecordLocation = async () => {
          if (!locationSearchInput) return;
          const query = String(locationSearchInput.value || '').trim();
          if (query.length < 2) {
            renderLocationResults([]);
            return;
          }
          if (locationSearchAbort) locationSearchAbort.abort();
          locationSearchAbort = new AbortController();
          if (locationResults) {
            locationResults.hidden = false;
            locationResults.innerHTML = '<div class="record-location-empty">検索中...</div>';
          }
          try {
            const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&accept-language=ja&q=' + encodeURIComponent(query);
            const response = await fetch(url, { signal: locationSearchAbort.signal, headers: { Accept: 'application/json' } });
            if (!response.ok) throw new Error('place_search_failed');
            const rows = await response.json();
            renderLocationResults(Array.isArray(rows) ? rows : []);
          } catch (error) {
            if (error && error.name === 'AbortError') return;
            if (locationResults) {
              locationResults.hidden = false;
              locationResults.innerHTML = '<div class="record-location-empty">検索に失敗しました。現在地か地図で指定してください。</div>';
            }
          }
        };

        const fillCurrentLocation = () => {
          if (!navigator.geolocation || !form) {
            alert('位置情報を利用できません。手動で入力してください。');
            return;
          }
          void applyCurrentLocation('現在地を撮影地点に設定', false);
        };

        const clearMediaInputsExcept = (activeInput) => {
          mediaInputs.forEach((input) => {
            if (input !== activeInput) input.value = '';
          });
        };

        const normalizeSelectedFiles = (files, kind) => {
          const incoming = Array.isArray(files) ? files.filter((file) => file instanceof File && file.size > 0) : [];
          const photos = [];
          let video = null;
          const notices = [];
          incoming.forEach((file) => {
            if (isImageFile(file)) {
              if (photos.length < MAX_PHOTO_FILES) photos.push(file);
              else notices.push('写真は最大' + String(MAX_PHOTO_FILES) + '枚までです。超過分は外しました。');
              return;
            }
            if (isVideoFile(file)) {
              if (!video) video = file;
              else notices.push('動画は1本までです。2本目以降は外しました。');
              return;
            }
            notices.push('画像または動画ではないファイルを外しました。');
          });
          if (kind === 'video' && video) {
            return { photos, video, notices };
          }
          return { photos, video, notices };
        };

        const showRecordFormForMedia = (files, kind, notices) => {
          const normalized = normalizeSelectedFiles(files, kind);
          selectedMediaFiles = normalized.photos;
          selectedVideoFile = normalized.video;
          selectedCaptureKind = kind || '';
          const hasMedia = hasSelectedMedia();
          if (hasMedia && !selectedMediaRole) setSelectedMediaRole('primary_subject');
          if (selectedVideoFile && selectedMediaFiles.length === 0) setSelectedMediaRole('sound_motion');
          if (selectedMediaFiles.length > 0) selectedPrimaryPhotoFile = null;
          if (form) form.hidden = !hasMedia;
          if (captureResult) captureResult.hidden = !hasMedia;
          document.documentElement.classList.toggle('record-has-media', hasMedia);
          if (hasMedia) window.requestAnimationFrame(ensureRecordMap);
          const label = captureLabels[selectedCaptureKind] || captureLabels.gallery;
          const photoCount = selectedMediaFiles.length;
          const mediaSummary = [
            photoCount > 0 ? '写真' + String(photoCount) + '枚' : '',
            selectedVideoFile ? '動画1本' : '',
          ].filter(Boolean).join(' / ');
          if (captureResultTitle) captureResultTitle.textContent = hasMedia
            ? label.title + ' - ' + mediaSummary
            : '未選択';
          const noticeText = [...(notices || []), ...normalized.notices].filter(Boolean).join(' ');
          if (captureResultHelp) captureResultHelp.textContent = hasMedia
            ? (noticeText || label.help)
            : 'ファイルを選ぶと入力欄が開きます。';
          captureButtons.forEach((button) => {
            const active = button.getAttribute('data-capture-action') === selectedCaptureKind;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
          syncModeUi();
          syncSubmitCta();
          if (hasMedia && form) {
            window.requestAnimationFrame(() => form.scrollIntoView({ block: 'start', behavior: 'auto' }));
          }
          syncVideoPrimaryPhotoUi();
        };

        const setPendingCaptureKind = (kind) => {
          if (!captureLabels[kind]) return;
          selectedMediaFiles = [];
          selectedVideoFile = null;
          selectedCaptureKind = kind;
          if (form) form.hidden = true;
          if (captureResult) captureResult.hidden = false;
          document.documentElement.classList.remove('record-has-media');
          const label = captureLabels[kind];
          if (captureResultTitle) captureResultTitle.textContent = label.title + 'で始める';
          if (captureResultHelp) captureResultHelp.textContent = 'ログイン後の続きです。下の「' + label.title.replace('を撮る', '').replace('から選ぶ', '') + '」を押すと始められます。';
          syncLocationNudge();
          captureButtons.forEach((button) => {
            const active = button.getAttribute('data-capture-action') === kind;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
          syncVideoPrimaryPhotoUi();
          syncSubmitCta();
          syncModeUi();
        };

        const clearSelectedMedia = () => {
          mediaAutofillSequence += 1;
          selectedMediaFiles = [];
          selectedVideoFile = null;
          selectedPrimaryPhotoFile = null;
          pendingMediaRetryObservationId = '';
          selectedCaptureKind = '';
          mediaInputs.forEach((input) => { input.value = ''; });
          if (videoPrimaryPhotoInput) videoPrimaryPhotoInput.value = '';
          if (form) form.hidden = true;
          if (captureResult) captureResult.hidden = true;
          if (locationNudge) locationNudge.hidden = true;
          setAutofillStatus([]);
          selectedMediaCapturedAt = null;
          setSelectedMediaRole('primary_subject');
          updateLocationText();
          document.documentElement.classList.remove('record-has-media');
          captureButtons.forEach((button) => {
            button.classList.remove('is-active');
            button.setAttribute('aria-pressed', 'false');
          });
          renderPreviewFile(null);
          resetVideoTrim();
          resetVideoProgress();
          syncVideoPrimaryPhotoUi();
          syncSubmitCta();
          syncModeUi();
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
            previewObjectUrl = URL.createObjectURL(file);
            previewPhoto.className = 'record-preview-photo';
            previewPhoto.innerHTML = '<img src="' + previewObjectUrl + '" alt="preview" />';
            return;
          }
          previewPhoto.className = 'record-preview-photo is-empty';
          previewPhoto.innerHTML = '対応していないファイル形式です。';
        };

        const renderPreviewSelection = () => {
          const files = allSelectedMediaFiles();
          const [first = null] = files;
          renderPreviewFile(first);
          if (previewPhoto && files.length > 1) {
            const badge = document.createElement('span');
            badge.className = 'record-preview-count';
            badge.textContent = selectedMediaSummaryText();
            previewPhoto.appendChild(badge);
          }
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
          syncLocationNudge();
        };

        const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('file_read_failed'));
          reader.readAsDataURL(file);
        });
        const loadImageForUpload = (file) => new Promise((resolve, reject) => {
          const url = URL.createObjectURL(file);
          const image = new Image();
          image.onload = () => {
            URL.revokeObjectURL(url);
            resolve(image);
          };
          image.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('photo_decode_failed'));
          };
          image.src = url;
        });
        const preparePhotoUpload = async (file) => {
          const originalType = String(file && file.type || 'image/jpeg').toLowerCase();
          if (originalType === 'image/gif') {
            return {
              filename: file.name || 'upload.gif',
              mimeType: originalType,
              base64Data: await readFileAsDataUrl(file),
            };
          }
          try {
            const image = await loadImageForUpload(file);
            const width = Number(image.naturalWidth || image.width || 0);
            const height = Number(image.naturalHeight || image.height || 0);
            if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('photo_decode_failed');
            const scale = Math.min(1, PHOTO_UPLOAD_MAX_EDGE / Math.max(width, height));
            const targetWidth = Math.max(1, Math.round(width * scale));
            const targetHeight = Math.max(1, Math.round(height * scale));
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const context = canvas.getContext('2d');
            if (!context) throw new Error('photo_canvas_unavailable');
            context.drawImage(image, 0, 0, targetWidth, targetHeight);
            const base64Data = canvas.toDataURL('image/jpeg', PHOTO_UPLOAD_JPEG_QUALITY);
            const safeName = String(file.name || 'upload.jpg').replace(/\.[A-Za-z0-9]+$/, '') || 'upload';
            return {
              filename: safeName + '.jpg',
              mimeType: 'image/jpeg',
              base64Data,
            };
          } catch (_) {
            return {
              filename: file.name || 'upload.jpg',
              mimeType: file.type || 'image/jpeg',
              base64Data: await readFileAsDataUrl(file),
            };
          }
        };
        const sha256Hex = async (value) => {
          if (!(window.crypto && window.crypto.subtle && typeof TextEncoder !== 'undefined')) return '';
          const bytes = new TextEncoder().encode(String(value || ''));
          const digest = await window.crypto.subtle.digest('SHA-256', bytes);
          return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
        };

        const RECORD_DRAFT_DB = 'ikimon-record-draft';
        const RECORD_DRAFT_STORE = 'drafts';
        const RECORD_DRAFT_KEY = 'latest';
        const openRecordDraftDb = () => new Promise((resolve, reject) => {
          if (!('indexedDB' in window)) {
            reject(new Error('indexeddb_unavailable'));
            return;
          }
          const request = indexedDB.open(RECORD_DRAFT_DB, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(RECORD_DRAFT_STORE)) db.createObjectStore(RECORD_DRAFT_STORE);
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || new Error('indexeddb_open_failed'));
        });
        const consumeRecordDraft = async () => {
          const db = await openRecordDraftDb();
          try {
            return await new Promise((resolve, reject) => {
              const transaction = db.transaction(RECORD_DRAFT_STORE, 'readwrite');
              const store = transaction.objectStore(RECORD_DRAFT_STORE);
              const request = store.get(RECORD_DRAFT_KEY);
              let value = null;
              request.onsuccess = () => {
                value = request.result || null;
                store.delete(RECORD_DRAFT_KEY);
              };
              request.onerror = () => reject(request.error || new Error('indexeddb_read_failed'));
              transaction.oncomplete = () => resolve(value);
              transaction.onerror = () => reject(transaction.error || new Error('indexeddb_transaction_failed'));
            });
          } finally {
            db.close();
          }
        };
        const importGlobalRecordDraft = async () => {
          const params = new URLSearchParams(window.location.search);
          if (params.get('draft') !== '1') return;
          let draft = null;
          try {
            draft = await consumeRecordDraft();
          } catch (_) {
            draft = null;
          }
          const draftFiles = draft && Array.isArray(draft.files) ? draft.files.filter((file) => file instanceof File) : [];
          const file = draft && draft.file instanceof File ? draft.file : null;
          const files = draftFiles.length ? draftFiles : (file ? [file] : []);
          const kind = draft && captureLabels[draft.kind] ? draft.kind : (params.get('start') || 'gallery');
          const metadata = normalizeDraftMetadata(draft && draft.metadata);
          setSelectedMediaRole(metadata.mediaRole || (kind === 'video' ? 'sound_motion' : 'primary_subject'));
          if (!files.length) {
            setPendingCaptureKind(kind);
            return;
          }
          selectedMediaCapturedAt = null;
          clearMediaInputsExcept(null);
          const normalized = normalizeSelectedFiles(files, kind);
          showRecordFormForMedia(files, kind);
          renderPreviewSelection();
          const firstAutofillFile = normalized.photos[0] || normalized.video || null;
          if (!normalized.video) {
            resetVideoTrim();
            resetVideoProgress();
            scheduleMediaAutofill(firstAutofillFile, metadata, { autoLocateFreshCapture: kind === 'photo' });
          } else if (videoProgressWrap) {
            scheduleMediaAutofill(firstAutofillFile, metadata, { autoLocateFreshCapture: kind === 'video' });
            let trimReady = true;
            try {
              await loadVideoTrimEditor(normalized.video);
            } catch (_) {
              trimReady = false;
              resetVideoTrim();
              if (videoLive) videoLive.textContent = '動画の長さを確認できませんでした。別の動画で試してください。';
            }
            videoProgressWrap.hidden = false;
            if (trimReady && videoLive) videoLive.textContent = '動画をアップロードできます。送信すると開始します。';
          }
        };

        const validateVideoDuration = async (file) => {
          const duration = await getVideoDuration(file);
          if (duration > MAX_VIDEO_SECONDS + 0.5) {
            throw new Error('video_duration_too_long');
          }
          return duration;
        };

        const uploadVideoWithDirectPost = (directUploadUrl, file) =>
          new Promise((resolve, reject) => {
            let settled = false;
            const request = new XMLHttpRequest();
            const finish = (error) => {
              if (settled) return;
              settled = true;
              if (videoCancel) videoCancel.disabled = true;
              activeTusUpload = null;
              cancelTusUpload = null;
              if (error) reject(error);
              else resolve(true);
            };
            request.upload.onprogress = (event) => {
              updateVideoProgress(event.loaded || 0, event.lengthComputable ? event.total : (file.size || 0));
              if (videoLive) videoLive.textContent = '動画をアップロード中です。';
            };
            request.onerror = () => finish(new Error('video_upload_network_failed'));
            request.onabort = () => finish(new Error('video_upload_cancelled'));
            request.onload = () => {
              if (request.status >= 200 && request.status < 300) {
                updateVideoProgress(file.size || 0, file.size || 0);
                if (videoLive) videoLive.textContent = '動画アップロードが完了しました。';
                finish(null);
                return;
              }
              finish(new Error('video_upload_failed:' + String(request.status) + ':' + String(request.responseText || '').slice(0, 120)));
            };

            activeTusUpload = request;
            cancelTusUpload = () => {
              request.abort();
            };
            if (videoCancel) videoCancel.disabled = false;
            updateVideoProgress(0, file.size || 0);
            const formData = new FormData();
            formData.append('file', file, file.name || 'upload.mp4');
            request.open('POST', directUploadUrl, true);
            request.send(formData);
          });

        const requestTusOffset = (uploadUrl) =>
          new Promise((resolve, reject) => {
            const request = new XMLHttpRequest();
            request.onload = () => {
              if (request.status >= 200 && request.status < 300) {
                const offset = Number(request.getResponseHeader('Upload-Offset') || '0');
                resolve(Number.isFinite(offset) && offset >= 0 ? offset : 0);
                return;
              }
              reject(new Error('video_tus_offset_failed:' + String(request.status)));
            };
            request.onerror = () => reject(new Error('video_tus_offset_network_failed'));
            request.open('HEAD', uploadUrl, true);
            request.setRequestHeader('Tus-Resumable', '1.0.0');
            request.send();
          });

        const uploadVideoWithTus = (uploadUrl, file) =>
          new Promise((resolve, reject) => {
            let settled = false;
            let offset = 0;
            let currentRequest = null;
            const finish = (error) => {
              if (settled) return;
              settled = true;
              if (videoCancel) videoCancel.disabled = true;
              activeTusUpload = null;
              cancelTusUpload = null;
              if (error) reject(error);
              else resolve(true);
            };
            const sendChunk = async () => {
              if (settled) return;
              if (offset >= file.size) {
                updateVideoProgress(file.size || 0, file.size || 0);
                if (videoLive) videoLive.textContent = '動画アップロードが完了しました。処理が終わるまで少し待ってください。';
                finish(null);
                return;
              }
              const end = Math.min(file.size, offset + TUS_CHUNK_BYTES);
              const chunk = file.slice(offset, end);
              let attempts = 0;
              const patch = () => {
                attempts += 1;
                const request = new XMLHttpRequest();
                currentRequest = request;
                activeTusUpload = request;
                request.upload.onprogress = (event) => {
                  updateVideoProgress(offset + (event.loaded || 0), file.size || 0);
                  if (videoLive) videoLive.textContent = '動画を分割してアップロード中です。通信が途切れても途中から続けます。';
                };
                request.onerror = async () => {
                  if (settled) return;
                  if (attempts <= 3) {
                    try {
                      offset = await requestTusOffset(uploadUrl);
                    } catch (_) {
                      // keep local offset and retry
                    }
                    window.setTimeout(patch, 600 * attempts);
                    return;
                  }
                  finish(new Error('video_tus_upload_network_failed'));
                };
                request.onabort = () => finish(new Error('video_upload_cancelled'));
                request.onload = () => {
                  if (request.status >= 200 && request.status < 300) {
                    const nextOffset = Number(request.getResponseHeader('Upload-Offset') || String(end));
                    offset = Number.isFinite(nextOffset) && nextOffset > offset ? nextOffset : end;
                    updateVideoProgress(offset, file.size || 0);
                    sendChunk();
                    return;
                  }
                  finish(new Error('video_tus_upload_failed:' + String(request.status) + ':' + String(request.responseText || '').slice(0, 120)));
                };
                request.open('PATCH', uploadUrl, true);
                request.setRequestHeader('Tus-Resumable', '1.0.0');
                request.setRequestHeader('Upload-Offset', String(offset));
                request.setRequestHeader('Content-Type', 'application/offset+octet-stream');
                request.send(chunk);
              };
              patch();
            };
            cancelTusUpload = () => {
              if (currentRequest) currentRequest.abort();
              else finish(new Error('video_upload_cancelled'));
            };
            if (videoCancel) videoCancel.disabled = false;
            updateVideoProgress(0, file.size || 0);
            sendChunk();
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
        captureButtons.forEach((button) => {
          button.addEventListener('click', () => {
            const action = button.getAttribute('data-capture-action') || 'gallery';
            const target = document.querySelector('[data-record-media-input][data-capture-kind="' + action + '"]') || mediaInput;
            if (target && typeof target.click === 'function') target.click();
          });
        });
        mediaInputs.forEach((input) => {
          input.addEventListener('change', async () => {
            const files = input.files ? Array.from(input.files) : [];
            const kind = input.getAttribute('data-capture-kind') || 'gallery';
            selectedMediaCapturedAt = null;
            mediaAutofillSequence += 1;
            clearMediaInputsExcept(input);
            const normalized = normalizeSelectedFiles(files, kind);
            if (!files.length || (!normalized.photos.length && !normalized.video)) {
              selectedMediaFiles = [];
              selectedVideoFile = null;
              renderPreviewFile(null);
              showRecordFormForMedia([], '');
              resetVideoProgress();
              resetVideoTrim();
              setAutofillStatus([]);
            } else if (!normalized.video) {
              setSelectedMediaRole('primary_subject');
              showRecordFormForMedia(files, kind);
              renderPreviewSelection();
              resetVideoProgress();
              resetVideoTrim();
              scheduleMediaAutofill(normalized.photos[0] || null, {}, { autoLocateFreshCapture: kind === 'photo' });
            } else if (videoProgressWrap) {
              setSelectedMediaRole(kind === 'video' ? 'sound_motion' : 'primary_subject');
              showRecordFormForMedia(files, kind);
              renderPreviewSelection();
              scheduleMediaAutofill(normalized.photos[0] || normalized.video, {}, { autoLocateFreshCapture: kind === 'video' });
              let trimReady = true;
              try {
                await loadVideoTrimEditor(normalized.video);
              } catch (_) {
                trimReady = false;
                resetVideoTrim();
                if (videoLive) videoLive.textContent = '動画の長さを確認できませんでした。別の動画で試してください。';
              }
              videoProgressWrap.hidden = false;
              if (trimReady && videoLive) videoLive.textContent = '動画をアップロードできます。送信すると開始します。';
            }
          });
        });
        if (videoPrimaryPhotoPick && videoPrimaryPhotoInput) {
          videoPrimaryPhotoPick.addEventListener('click', () => {
            if (typeof videoPrimaryPhotoInput.click === 'function') videoPrimaryPhotoInput.click();
          });
        }
        if (videoPrimaryPhotoInput) {
          videoPrimaryPhotoInput.addEventListener('change', async () => {
            const file = videoPrimaryPhotoInput.files ? Array.from(videoPrimaryPhotoInput.files)[0] || null : null;
            if (!file) return;
            if (!isImageFile(file)) {
              selectedPrimaryPhotoFile = null;
              syncVideoPrimaryPhotoUi();
              setStatus('<div class="row"><div>主役写真には画像ファイルを選んでください。</div></div>');
              return;
            }
            selectedPrimaryPhotoFile = file;
            syncVideoPrimaryPhotoUi();
            scheduleMediaAutofill(file, {}, { autoLocateFreshCapture: false });
          });
        }
        if (videoPrimaryPhotoClear) {
          videoPrimaryPhotoClear.addEventListener('click', () => {
            selectedPrimaryPhotoFile = null;
            if (videoPrimaryPhotoInput) videoPrimaryPhotoInput.value = '';
            syncVideoPrimaryPhotoUi();
          });
        }
        if (captureChange) {
          captureChange.addEventListener('click', clearSelectedMedia);
        }
        if (videoTrimStart) {
          videoTrimStart.addEventListener('input', () => syncVideoTrimControls('start'));
        }
        if (videoTrimEnd) {
          videoTrimEnd.addEventListener('input', () => syncVideoTrimControls('end'));
        }
        if (videoTrimPlayer) {
          videoTrimPlayer.addEventListener('timeupdate', () => {
            if (!videoTrimState) return;
            const end = Number(videoTrimState.end || 0);
            if (Number(videoTrimPlayer.currentTime || 0) > end) {
              videoTrimPlayer.pause();
              videoTrimPlayer.currentTime = Number(videoTrimState.start || 0);
            }
          });
        }
        if (videoTrimApply) {
          videoTrimApply.addEventListener('click', applyVideoTrim);
        }
        mediaRoleInputs.forEach((input) => {
          input.addEventListener('change', () => {
            if (input.checked) setSelectedMediaRole(input.value);
          });
        });
        locateButtons.forEach((button) => {
          button.addEventListener('click', fillCurrentLocation);
        });
        if (locationSearchButton) {
          locationSearchButton.addEventListener('click', searchRecordLocation);
        }
        if (locationSearchInput) {
          locationSearchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              searchRecordLocation();
            }
          });
        }
        if (form) {
          const latField = form.elements.namedItem('latitude');
          const lngField = form.elements.namedItem('longitude');
          [latField, lngField].forEach((field) => {
            if (field && field.addEventListener) {
              field.addEventListener('input', () => {
                updateLocationText('座標を直接編集');
                syncPreview();
                syncLocationNudge();
              });
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
        applyStartModeFromQuery();
        importGlobalRecordDraft();

        if (form) {
          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (recordSubmitInFlight) return;
            const data = new FormData(form);
            const userId = form.dataset.userId || '';
            const observationId = pendingMediaRetryObservationId || 'record-' + Date.now();
            let savedDetailId = '';
            if (!userId) {
              setStatus('<div class="row"><div>ログイン情報を確認できませんでした。ページを開き直してから、もう一度お試しください。</div></div>');
              return;
            }
            setRecordSubmitting(true);
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
              const mediaRole = normalizeMediaRole(data.get('mediaRole') || selectedMediaRole);
              const photoFiles = selectedPhotoFiles();
              const primaryPhotoFile = selectedPrimaryPhotoFile instanceof File && selectedPrimaryPhotoFile.size > 0 ? selectedPrimaryPhotoFile : null;
              const photoUploadList = [
                ...photoFiles.map((file, index) => ({
                  file,
                  role: index === 0 ? (mediaRole === 'sound_motion' ? 'primary_subject' : mediaRole) : 'context',
                })),
                ...(primaryPhotoFile ? [{ file: primaryPhotoFile, role: 'primary_subject' }] : []),
              ];
              const preparedPhotoUploads = [];
              const clientPhotoHashes = [];
              if (photoUploadList.length > 0) {
                setStatus('<div class="row"><div>写真を投稿用に整えています...</div></div>');
              }
              for (let index = 0; index < photoUploadList.length; index += 1) {
                const item = photoUploadList[index];
                const upload = await preparePhotoUpload(item.file);
                const hash = await sha256Hex(upload.base64Data);
                preparedPhotoUploads.push({ upload, role: item.role });
                clientPhotoHashes.push(hash || [upload.filename, upload.mimeType, String(item.file && item.file.size || 0)].join(':'));
              }
              const observedAtIso = new Date(String(data.get('observedAt'))).toISOString();
              const latitude = Number(data.get('latitude'));
              const longitude = Number(data.get('longitude'));
              const videoFingerprint = selectedVideoFile instanceof File
                ? ['video', selectedVideoFile.name || '', String(selectedVideoFile.size || 0), String(selectedVideoFile.lastModified || 0)].join(':')
                : '';
              const clientSubmissionSeed = [
                userId,
                observedAtIso,
                Number.isFinite(latitude) ? latitude.toFixed(6) : '',
                Number.isFinite(longitude) ? longitude.toFixed(6) : '',
                clientPhotoHashes.join(','),
                videoFingerprint,
              ].join('|');
              const clientSubmissionId = 'record-form:' + ((await sha256Hex(clientSubmissionSeed)) || observationId);
              const payload = {
                observationId,
                legacyObservationId: observationId,
                clientSubmissionId,
                userId,
                observedAt: observedAtIso,
                latitude,
                longitude,
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
                  media_role: mediaRole,
                  client_submission_id: clientSubmissionId,
                  client_photo_sha256s: clientPhotoHashes,
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
              savedDetailId = detailId;
              let extraStatus = '';

              const uploadPhotoFile = async (upload, mediaRoleForPhoto, index, total) => {
                setStatus('<div class="row"><div>写真を保存しています... ' + String(index) + '/' + String(total) + '</div></div>');
                const photoResponse = await fetch(withBasePath('/api/v1/observations/' + encodeURIComponent(detailId) + '/photos/upload'), {
                  method: 'POST',
                  headers: { 'content-type': 'application/json', accept: 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    filename: upload.filename,
                    mimeType: upload.mimeType,
                    base64Data: upload.base64Data,
                    mediaRole: mediaRoleForPhoto,
                  }),
                });
                const photoJson = await photoResponse.json();
                if (!photoResponse.ok || !photoJson.ok) {
                  throw new Error('photo_upload_failed_at_' + String(index) + ':' + (photoJson.error || 'photo_upload_failed'));
                }
              };

              for (let index = 0; index < preparedPhotoUploads.length; index += 1) {
                const item = preparedPhotoUploads[index];
                await uploadPhotoFile(item.upload, item.role, index + 1, preparedPhotoUploads.length);
              }
              if (preparedPhotoUploads.length > 0) {
                extraStatus = '写真' + String(preparedPhotoUploads.length) + '枚を同じ観察に保存しました。';
              }

              let videoFile = selectedVideoFile instanceof File && selectedVideoFile.size > 0 ? selectedVideoFile : null;
              if (videoFile) {
                  videoFile = await ensureVideoReadyForUpload(videoFile);
                  if (videoFile.size > MAX_VIDEO_TUS_BYTES) {
                    throw new Error('video_file_too_large');
                  }
                  await validateVideoDuration(videoFile);
                  const uploadProtocol = videoFile.size >= MAX_VIDEO_BASIC_POST_BYTES ? 'tus' : 'post';

                  setStatus('<div class="row"><div>動画アップロードの準備をしています...</div></div>');
                  const issueResponse = await fetch(withBasePath('/api/v1/videos/direct-upload'), {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', accept: 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      filename: videoFile.name || 'upload.mp4',
                      maxDurationSeconds: MAX_VIDEO_SECONDS,
                      observationId: detailId,
                      mediaRole: 'sound_motion',
                      uploadProtocol,
                      fileSizeBytes: videoFile.size,
                    }),
                  });
                  const issueJson = await issueResponse.json();
                  if (!issueResponse.ok || !issueJson.ok || !issueJson.uploadUrl || !issueJson.uid) {
                    throw new Error(issueJson.error || 'video_issue_failed');
                  }

                  if (String(issueJson.uploadProtocol || uploadProtocol) === 'tus') {
                    await uploadVideoWithTus(String(issueJson.uploadUrl), videoFile);
                  } else {
                    await uploadVideoWithDirectPost(String(issueJson.uploadUrl), videoFile);
                  }
                  setStatus('<div class="row"><div>動画を記録に紐づけています...</div></div>');

                  const finalizeResponse = await fetch(withBasePath('/api/v1/videos/' + encodeURIComponent(String(issueJson.uid)) + '/finalize'), {
                    method: 'POST',
                    headers: { 'content-type': 'application/json', accept: 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({
                      observationId: detailId,
                      mediaRole: 'sound_motion',
                    }),
                  });
                  const finalizeJson = await finalizeResponse.json();
                  if (!finalizeResponse.ok || !finalizeJson.ok) {
                    throw new Error(finalizeJson.error || 'video_finalize_failed');
                  }
                  const videoReady = Boolean(finalizeJson.video && finalizeJson.video.readyToStream);
                  if (videoReady) {
                    extraStatus = [extraStatus, '動画は保存済みです。AI 解析は裏側で進めています。'].filter(Boolean).join(' ');
                  } else {
                    extraStatus = [extraStatus, '動画は保存済みです。再生準備が終わるまで少し待ってから詳細ページを開いてください。'].filter(Boolean).join(' ');
                  }
              }

              const suffix = extraStatus
                ? extraStatus
                : '';
              const impactHtml = buildImpactHtml(observationJson.impact || null, suffix);
              setStatus('<div class="row"><div><strong>記録を保存しました。</strong>' + impactHtml + '<div class="meta"><a href="' + withBasePath('/observations/' + encodeURIComponent(detailId)) + '">観察を見る</a> · <a href="' + withBasePath('/notes') + '">ノートを見る</a></div></div></div>');
              pendingMediaRetryObservationId = '';
              form.reset();
              if (modeInput) modeInput.value = 'quick';
              if (observedAt) {
                const now = new Date();
                observedAt.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
              }
              clearSelectedMedia();
              syncModeUi();
              syncPreview();
            } catch (error) {
              const message = normalizeError(error);
              let userMessage = message;
              if (message === 'video_file_too_large') userMessage = '動画サイズが大きすぎます。短く切り出すか、画質を下げてください。';
              if (message === 'video_duration_too_long') userMessage = '動画の長さは 60 秒以内にしてください。';
              if (message === 'video_trim_required') userMessage = '動画は投稿前に最大60秒の区間を選んでください。';
              if (message === 'video_trim_range_invalid') userMessage = '動画の切り出し範囲は最大60秒にしてください。';
              if (message === 'video_trim_unsupported') userMessage = 'このブラウザでは動画の切り出しに対応していません。60秒以内の動画を選んでください。';
              if (message === 'video_upload_library_unavailable') userMessage = '動画アップロード部品を読み込めませんでした。通信状態を確認して再読み込みしてください。';
              if (message === 'video_upload_cancelled') userMessage = '動画アップロードをキャンセルしました。';
              if (message.startsWith('photo_upload_failed_at_')) {
                const match = message.match(/^photo_upload_failed_at_(\\d+)/);
                userMessage = '写真' + (match ? match[1] : '') + '枚目の保存に失敗しました。観察本体は保存済みなら、詳細ページから確認できます。';
              }
              if (message === 'cloudflare_stream_not_configured') userMessage = '動画アップロードの設定が有効ではありません。写真と記録本体は保存済みなら、詳細ページから確認できます。';
              if (message.startsWith('cloudflare_error') || message.startsWith('cloudflare_tus_error') || message === 'video_issue_failed') userMessage = '動画アップロードの準備ができませんでした。時間をおいて動画だけ再試行してください。';
              const isGenericVideoUploadError = (message.indexOf('tus') >= 0 || message.indexOf('upload') >= 0)
                && message.indexOf('photo_upload_failed_at_') < 0
                && message !== 'video_upload_library_unavailable'
                && message !== 'video_upload_cancelled'
                && message !== 'cloudflare_stream_not_configured'
                && message !== 'video_issue_failed'
                && !message.startsWith('cloudflare_error');
              if (isGenericVideoUploadError) userMessage = '動画アップロードに失敗しました。通信状態を確認して動画だけ再試行してください。';
              if (message === 'video_metadata_read_failed' || message === 'video_duration_unknown') userMessage = '動画の長さを確認できませんでした。別の動画で試してください。';
              if (message === 'unsupported_media_type') userMessage = '画像または動画ファイルを選択してください。';
              if (message === 'survey_target_scope_required') userMessage = 'しっかり記録では、何を見たかったかを入力してください。';
              if (message === 'survey_effort_required') userMessage = 'しっかり記録では、見た時間を入力してください。';
              if (message === 'survey_revisit_reason_required') userMessage = 'しっかり記録では、また見に行きたい理由を入力してください。';
              const partialLink = savedDetailId
                ? '<div class="meta"><a href="' + withBasePath('/observations/' + encodeURIComponent(savedDetailId)) + '">保存済みの観察を見る</a> · メディアだけ再試行する場合はこの画面のまま再送信してください。</div>'
                : '';
              if (savedDetailId) pendingMediaRetryObservationId = observationId;
              setStatus('<div class="row"><div>送信に失敗しました。<div class="meta">' + userMessage + '</div>' + partialLink + '</div></div>');
            } finally {
              if (videoCancel) videoCancel.disabled = true;
              activeTusUpload = null;
              cancelTusUpload = null;
              setRecordSubmitting(false);
            }
          });
        }
      </script>`,
      "Record",
      undefined,
      `
        .record-page { margin-top: 24px; }
        .record-shell { display: grid; grid-template-columns: 1fr; gap: 18px; align-items: start; max-width: 1180px; }
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
        .record-capture-launcher { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; padding-left: 16px; margin: 0 0 18px; }
        .record-capture-option { min-height: 132px; display: grid; align-content: start; gap: 8px; text-align: left; padding: 16px; border-radius: 22px; background: rgba(255,255,255,.9); border: 1px solid rgba(15,23,42,.08); color: #0f172a; text-decoration: none; cursor: pointer; box-shadow: 0 10px 24px rgba(15,23,42,.045); transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
        .record-capture-option:hover, .record-capture-option.is-active { transform: translateY(-2px); border-color: rgba(14,165,233,.34); box-shadow: 0 16px 32px rgba(14,165,233,.1); }
        .record-capture-option.is-primary { background: linear-gradient(180deg, rgba(236,253,245,.96), rgba(240,249,255,.96)); border-color: rgba(16,185,129,.24); }
        .record-capture-icon { width: 42px; height: 42px; border-radius: 999px; display: grid; place-items: center; background: rgba(15,23,42,.05); color: #047857; }
        .record-capture-icon svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .record-capture-option strong { font-size: 15px; line-height: 1.25; }
        .record-capture-option span:last-child { font-size: 12px; line-height: 1.55; color: #64748b; font-weight: 700; }
        .record-subject-context { margin: -2px 0 18px 16px; padding: 16px; border-radius: 20px; background: linear-gradient(135deg, rgba(236,253,245,.9), rgba(239,246,255,.9)); border: 1px solid rgba(16,185,129,.2); display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 14px; align-items: center; }
        .record-subject-context strong { display: block; margin-top: 4px; color: #0f172a; font-size: 15px; line-height: 1.35; }
        .record-subject-context p { margin: 5px 0 0; color: #475569; font-size: 12px; line-height: 1.7; font-weight: 750; }
        .record-subject-context-tags { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 7px; max-width: 250px; }
        .record-subject-context-tags span { padding: 7px 9px; border-radius: 999px; background: rgba(255,255,255,.82); border: 1px solid rgba(15,23,42,.08); color: #064e3b; font-size: 11px; line-height: 1.2; font-weight: 950; white-space: nowrap; }
        .record-capture-result { margin: -2px 0 18px 16px; padding: 14px 16px; border-radius: 18px; background: rgba(236,253,245,.82); border: 1px solid rgba(16,185,129,.24); display: flex; justify-content: space-between; gap: 12px; align-items: center; }
        .record-capture-result[hidden] { display: none; }
        .record-capture-result strong { display: block; margin-top: 4px; color: #0f172a; font-size: 14px; word-break: break-word; }
        .record-capture-result p { margin: 4px 0 0; color: #475569; font-size: 12px; line-height: 1.6; font-weight: 700; }
        .record-location-nudge { margin: -2px 0 18px 16px; padding: 14px 16px; border-radius: 18px; background: linear-gradient(135deg, rgba(240,253,250,.95), rgba(239,246,255,.95)); border: 1px solid rgba(14,165,233,.22); display: flex; justify-content: space-between; gap: 12px; align-items: center; }
        .record-location-nudge[hidden] { display: none; }
        .record-location-nudge strong { color: #0f172a; font-size: 14px; }
        .record-location-nudge p { margin: 4px 0 0; color: #475569; font-size: 12px; line-height: 1.6; font-weight: 700; }
        .record-location-nudge button { min-height: 44px; padding: 0 14px; border-radius: 999px; border: 0; background: #0f766e; color: #fff; font: inherit; font-size: 12px; font-weight: 950; white-space: nowrap; }
        .record-autofill-status { margin: -6px 0 16px 16px; padding: 10px 13px; border-radius: 999px; width: fit-content; max-width: calc(100% - 16px); background: rgba(236,253,245,.9); border: 1px solid rgba(16,185,129,.24); color: #065f46; font-size: 12px; font-weight: 900; line-height: 1.5; }
        .record-autofill-status[hidden] { display: none; }
        .record-place-picker { display: grid; gap: 12px; padding: 14px; border-radius: 20px; background: rgba(255,255,255,.78); border: 1px solid rgba(15,23,42,.08); }
        .record-place-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
        .record-place-head strong { display: block; color: #0f172a; font-size: 15px; line-height: 1.45; }
        .record-place-head p { margin: 3px 0 0; color: #64748b; font-size: 12px; line-height: 1.6; font-weight: 750; }
        .record-place-search { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; }
        .record-place-search input { min-height: 48px; padding: 0 14px; border-radius: 16px; border: 1px solid rgba(15,23,42,.12); background: #fff; font: inherit; }
        .record-place-search button { min-height: 48px; padding: 0 16px; border-radius: 16px; border: 0; background: #0f766e; color: #fff; font: inherit; font-weight: 950; cursor: pointer; }
        .record-location-results { display: grid; gap: 8px; }
        .record-location-results[hidden] { display: none; }
        .record-location-result { display: grid; gap: 3px; text-align: left; padding: 11px 12px; border-radius: 14px; border: 1px solid rgba(15,23,42,.08); background: #fff; color: #0f172a; font: inherit; cursor: pointer; }
        .record-location-result strong { font-size: 13px; line-height: 1.45; }
        .record-location-result span, .record-location-empty { color: #64748b; font-size: 12px; line-height: 1.55; font-weight: 750; }
        .record-location-map { position: relative; min-height: 240px; border-radius: 18px; overflow: hidden; background: linear-gradient(135deg,#ecfdf5,#eff6ff); border: 1px solid rgba(15,23,42,.08); }
        .record-location-map-fallback { position: absolute; inset: 0; display: grid; place-items: center; padding: 18px; text-align: center; color: #475569; font-size: 12px; line-height: 1.6; font-weight: 850; }
        .record-coordinate-details { display: grid; gap: 10px; }
        .record-coordinate-details summary { min-height: 44px; display: flex; align-items: center; padding: 0 12px; border-radius: 14px; background: rgba(248,250,252,.9); border: 1px solid rgba(15,23,42,.08); color: #0f172a; font-size: 13px; font-weight: 900; cursor: pointer; }
        .record-coordinate-details .record-gps-inputs { margin-top: 10px; }
        .record-capture-dock { margin: -6px 0 18px 16px; padding: 8px; border-radius: 22px; background: rgba(255,255,255,.94); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 18px 38px rgba(15,23,42,.08); display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
        .record-dock-action { min-height: 58px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 7px 6px; border-radius: 17px; border: 1px solid transparent; background: rgba(248,250,252,.9); color: #0f172a; text-decoration: none; font-size: 11px; font-weight: 900; cursor: pointer; line-height: 1.2; }
        .record-dock-action:hover, .record-dock-action.is-active { border-color: rgba(14,165,233,.28); background: #f0f9ff; }
        .record-dock-primary { background: #ecfdf5; color: #065f46; }
        .record-dock-primary:hover, .record-dock-primary.is-active { background: #ecfdf5; border-color: rgba(16,185,129,.24); }
        .record-dock-icon { width: 30px; height: 30px; border-radius: 999px; display: grid; place-items: center; background: rgba(15,23,42,.06); flex: 0 0 auto; }
        .record-dock-primary .record-dock-icon { background: rgba(16,185,129,.14); }
        .record-dock-icon svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
        .record-submit-dock { display: none; }
        .record-submit-panel { grid-column: 1 / -1; display: flex; align-items: center; justify-content: space-between; gap: 14px; padding: 14px 16px; border-radius: 20px; background: #ecfdf5; border: 1px solid rgba(16,185,129,.24); }
        .record-submit-panel[hidden] { display: none; }
        .record-submit-panel strong { display: block; margin-top: 4px; color: #0f172a; font-size: 15px; line-height: 1.35; }
        .record-submit-panel p { margin: 4px 0 0; color: #475569; font-size: 12px; line-height: 1.6; font-weight: 750; }
        .record-submit-panel .btn { min-width: 140px; }
        .site-footer { padding-bottom: 104px; }
        .site-mobile-menu-panel { max-height: calc(100dvh - 184px); overflow-y: auto; overscroll-behavior: contain; }
        @media (max-width: 430px) { .brand { flex: 0 0 36px; min-width: 36px; max-width: 36px; } .brand > span:last-child { display: none; } }
        .record-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding-left: 16px; scroll-margin-top: 92px; }
        .record-form[hidden] { display: none; }
        .record-field { display: flex; flex-direction: column; gap: 8px; }
        .record-field-wide { grid-column: 1 / -1; }
        .record-label { font-weight: 800; color: #0f172a; font-size: 14px; }
        .record-help { font-size: 12px; line-height: 1.6; color: #64748b; }
        .record-advanced { padding: 0; }
        .record-advanced summary { min-height: 52px; display: flex; align-items: center; padding: 0 14px; border-radius: 16px; background: rgba(255,255,255,.78); border: 1px solid rgba(15,23,42,.08); color: #0f172a; font-weight: 900; cursor: pointer; }
        .record-advanced-grid { margin-top: 12px; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; padding: 16px; border-radius: 20px; background: rgba(248,250,252,.7); border: 1px solid rgba(15,23,42,.06); }
        .record-mode-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
        .record-mode-chip { display: grid; gap: 4px; text-align: left; padding: 14px 16px; border-radius: 18px; border: 1px solid rgba(15,23,42,.1); background: rgba(255,255,255,.84); color: #0f172a; cursor: pointer; transition: border-color .18s ease, box-shadow .18s ease, transform .18s ease; }
        .record-mode-chip strong { font-size: 14px; }
        .record-mode-chip span { font-size: 12px; line-height: 1.6; color: #64748b; font-weight: 700; }
        .record-mode-chip.is-active { border-color: rgba(14,165,233,.36); box-shadow: 0 10px 24px rgba(14,165,233,.1); transform: translateY(-1px); }
        .record-media-role { padding: 14px; border-radius: 20px; background: rgba(255,255,255,.78); border: 1px solid rgba(15,23,42,.08); }
        .record-video-primary-photo { grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 14px; border-radius: 20px; background: linear-gradient(135deg, rgba(236,253,245,.95), rgba(239,246,255,.95)); border: 1px solid rgba(16,185,129,.22); }
        .record-video-primary-photo[hidden] { display: none; }
        .record-video-primary-photo strong { display: block; margin-top: 4px; color: #0f172a; font-size: 14px; line-height: 1.4; word-break: break-word; }
        .record-video-primary-photo p { margin: 4px 0 0; color: #475569; font-size: 12px; line-height: 1.6; font-weight: 750; }
        .record-video-primary-photo-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
        .record-media-role-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
        .record-media-role-chip { position: relative; display: grid; gap: 4px; min-height: 76px; padding: 12px; border-radius: 16px; border: 1px solid rgba(15,23,42,.1); background: rgba(248,250,252,.92); cursor: pointer; }
        .record-media-role-chip input { position: absolute; opacity: 0; pointer-events: none; }
        .record-media-role-chip strong { color: #0f172a; font-size: 13px; line-height: 1.3; }
        .record-media-role-chip span { color: #64748b; font-size: 11px; line-height: 1.45; font-weight: 750; }
        .record-media-role-chip:has(input:checked) { border-color: rgba(16,185,129,.34); background: #ecfdf5; box-shadow: 0 8px 18px rgba(16,185,129,.1); }
        .record-media-role-chip:has(input:focus-visible) { outline: 3px solid #0284c7; outline-offset: 2px; }
        .record-survey-box { display: grid; gap: 14px; padding: 18px; border-radius: 20px; background: linear-gradient(135deg, rgba(14,165,233,.08), rgba(16,185,129,.08)); border: 1px solid rgba(14,165,233,.18); }
        .record-survey-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
        .record-survey-pill { display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; border-radius: 999px; background: rgba(15,23,42,.08); color: #0f172a; font-size: 10px; font-weight: 900; letter-spacing: .1em; text-transform: uppercase; }
        .record-survey-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .record-survey-caution { display: grid; gap: 4px; padding: 12px 14px; border-radius: 16px; background: rgba(255,255,255,.78); border: 1px solid rgba(15,23,42,.08); }
        .record-survey-caution strong { color: #0f172a; font-size: 13px; }
        .record-survey-caution span { color: #475569; font-size: 12px; line-height: 1.7; font-weight: 700; }
        .record-video-trim { grid-column: 1 / -1; display: grid; gap: 12px; padding: 14px; border-radius: 18px; background: linear-gradient(180deg, rgba(236,253,245,.92), rgba(239,246,255,.92)); border: 1px solid rgba(14,165,233,.2); }
        .record-video-trim[hidden] { display: none; }
        .record-video-trim-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
        .record-video-trim-head strong { display: block; color: #0f172a; font-size: 15px; }
        .record-video-trim-head p { margin: 4px 0 0; color: #475569; font-size: 12px; line-height: 1.55; font-weight: 750; }
        .record-video-trim-head span { flex: 0 0 auto; padding: 6px 10px; border-radius: 999px; background: #fff; color: #047857; font-size: 12px; font-weight: 950; border: 1px solid rgba(16,185,129,.2); }
        .record-video-trim-preview { aspect-ratio: 16 / 9; min-height: 160px; border-radius: 16px; overflow: hidden; background: #020617; }
        .record-video-trim-preview video { width: 100%; height: 100%; display: block; object-fit: contain; background: #020617; }
        .record-video-trim-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .record-video-trim-controls label { display: grid; gap: 7px; color: #0f172a; font-size: 12px; font-weight: 900; }
        .record-video-trim-controls label span { display: flex; justify-content: space-between; gap: 8px; }
        .record-video-trim-controls input { width: 100%; accent-color: #047857; }
        .record-video-trim-actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .record-video-trim-actions span { color: #0f766e; font-size: 12px; line-height: 1.55; font-weight: 800; }
        .record-video-progress { grid-column: 1 / -1; padding: 14px 16px; border-radius: 16px; background: linear-gradient(180deg, rgba(14,165,233,.08), rgba(16,185,129,.08)); border: 1px solid rgba(14,165,233,.2); display: grid; gap: 8px; }
        .record-video-progress[hidden] { display: none; }
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
        .record-preview-photo { position: relative; margin-top: 16px; min-height: 160px; border-radius: 20px; overflow: hidden; background: linear-gradient(135deg, rgba(16,185,129,.12), rgba(14,165,233,.12)); border: 1px solid rgba(14,165,233,.12); display: grid; place-items: center; color: #0f172a; font-weight: 800; }
        .record-preview-photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .record-preview-photo video { width: 100%; height: 100%; display: block; object-fit: cover; background: #020617; }
        .record-preview-photo.is-empty { color: #475569; font-size: 13px; }
        .record-preview-count { position: absolute; right: 10px; bottom: 10px; padding: 6px 10px; border-radius: 999px; background: rgba(15,23,42,.78); color: #fff; font-size: 11px; font-weight: 950; }
        @media (min-width: 1024px) {
          .record-shell { grid-template-columns: minmax(0, 1.12fr) minmax(320px, .88fr); }
          .record-sidebar { position: sticky; top: 92px; }
        }
        @media (max-width: 720px) {
          .record-page { padding-bottom: 104px; }
          .record-has-media .record-page { padding-bottom: 118px; }
          .record-has-media .hero-panel { display: none; }
          .record-card { padding: 20px; border-radius: 24px; }
          .record-capture-launcher { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding-left: 0; }
          .record-has-media .record-capture-launcher,
          .record-has-media .record-card-head { display: none; }
          .record-capture-option { min-height: 124px; padding: 14px; border-radius: 18px; }
          .record-subject-context { margin-left: 0; grid-template-columns: 1fr; align-items: start; }
          .record-subject-context-tags { justify-content: flex-start; max-width: none; }
          .record-has-media .record-subject-context { display: none; }
          .record-capture-dock { position: fixed; left: 12px; right: 12px; bottom: max(10px, env(safe-area-inset-bottom)); z-index: 40; margin: 0; grid-template-columns: repeat(4, minmax(0, 1fr)); border-radius: 24px; padding: 8px; box-shadow: 0 20px 44px rgba(15,23,42,.2); }
          .record-has-media .record-capture-dock { display: none; }
          .record-dock-action { min-height: 58px; }
          .record-dock-icon { width: 28px; height: 28px; }
          .record-location-nudge { margin-left: 0; align-items: flex-start; flex-direction: column; }
          .record-location-nudge button { width: 100%; }
          .record-autofill-status { margin-left: 0; max-width: 100%; border-radius: 16px; }
          .record-place-head { flex-direction: column; }
          .record-place-head .record-gps-btn { width: 100%; }
          .record-place-search { grid-template-columns: 1fr; }
          .record-location-map { min-height: 220px; }
          .record-submit-dock { position: fixed; left: 12px; right: 12px; bottom: max(10px, env(safe-area-inset-bottom)); z-index: 42; display: grid; grid-template-columns: minmax(0, .65fr) minmax(0, .95fr) minmax(0, 1.1fr); gap: 8px; padding: 8px; border-radius: 24px; background: rgba(255,255,255,.96); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 20px 44px rgba(15,23,42,.2); }
          .record-submit-location, .record-submit-primary { min-height: 58px; border-radius: 17px; border: 0; font: inherit; font-weight: 950; cursor: pointer; }
          .record-submit-location { background: #f1f5f9; color: #0f172a; }
          .record-submit-primary { background: #064e3b; color: #fff; box-shadow: 0 10px 24px rgba(6,78,59,.22); }
          .record-submit-location:disabled, .record-submit-primary:disabled { opacity: .55; cursor: wait; }
          .record-submit-dock-meta { min-height: 58px; display: flex; align-items: center; justify-content: center; text-align: center; padding: 6px 8px; border-radius: 17px; background: #ecfdf5; color: #064e3b; font-size: 11px; line-height: 1.25; font-weight: 950; }
          .record-submit-panel { align-items: flex-start; flex-direction: column; }
          .record-submit-panel .btn { width: 100%; }
          .record-capture-result { margin-left: 0; align-items: flex-start; flex-direction: column; }
          .record-form { grid-template-columns: 1fr; padding-left: 0; }
          .record-video-primary-photo { align-items: flex-start; flex-direction: column; }
          .record-video-primary-photo-actions, .record-video-primary-photo-actions .btn { width: 100%; }
          .record-video-trim-controls { grid-template-columns: 1fr; }
          .record-video-trim-actions .btn { width: 100%; }
          .record-mode-grid, .record-survey-grid, .record-advanced-grid, .record-media-role-grid { grid-template-columns: 1fr; }
          .record-card-head { padding-left: 0; }
          .record-sheet::after, .record-preview::after { display: none; }
        }
      `,
    );
  });

  app.get("/explore", async (_request, reply) => {
    const basePath = requestBasePath(_request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((_request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(_request.headers.cookie);
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
      }, { locationMode: "public", showSpecialistCta: canUseSpecialistWorkbench(session) }),
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
      }, { locationMode: "public", showSpecialistCta: canUseSpecialistWorkbench(session) }),
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

    const [obsContext, heavy, reactions, observerStats, insight, siteBriefResult, consensus] = await Promise.all([
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
      getIdentificationConsensus(bundle.canonicalSubjectId).catch(() => null),
    ]);
    const subjectIdentifyEntries = await Promise.all(
      bundle.subjects.map(async (subject) => {
        if (subject.occurrenceId === snapshot.occurrenceId) {
          return [subject.occurrenceId, { snapshot, consensus }] as const;
        }
        const [subjectSnapshot, subjectConsensus] = await Promise.all([
          getObservationDetailSnapshot(subject.occurrenceId).catch(() => null),
          getIdentificationConsensus(subject.occurrenceId).catch(() => null),
        ]);
        return [
          subject.occurrenceId,
          {
            snapshot: subjectSnapshot ?? {
              ...snapshot,
              occurrenceId: subject.occurrenceId,
              displayName: subject.displayName,
              scientificName: subject.scientificName,
              identifications: subject.identifications,
              disputes: [],
            },
            consensus: subjectConsensus,
          },
        ] as const;
      }),
    );
    const subjectIdentifyMap = new Map(subjectIdentifyEntries);

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
    const aiCandidateLearningPanel = renderAiCandidateLearningPanel({
      basePath,
      lang,
      visitId: bundle.visitId,
      candidates: bundle.aiCandidates,
      isOwner,
    });
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
            <a class="obs-hero-observer" href="${escapeHtml(appendLangToHref(buildObserverProfileHref(basePath, snapshot.observerUserId) ?? "#", lang))}">
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
          ${aiCandidateLearningPanel}
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
    const identifyBlock = `<div data-obs-switch-identify>${renderIdentificationParticipation({
      basePath,
      snapshot,
      consensus,
      viewerSession,
      canUseSpecialistWorkbench: canUseSpecialistWorkbench(viewerSession),
    })}</div>`;

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
          <a class="obs-cta-item" href="#identify">
            <span class="obs-cta-icon">🧭</span>
            <span class="obs-cta-label">同定に参加する</span>
          </a>
          <a class="obs-cta-item" href="${escapeHtml(withBasePath(basePath, "/specialist/id-workbench?occurrenceId=" + encodeURIComponent(bundle.canonicalSubjectId)))}">
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
      <template data-subject-taxonomy-template="${escapeHtml(subject.occurrenceId)}">${renderSubjectTaxonomy(subject, featuredSubject, subjectCount, bundle)}</template>
      <template data-subject-identify-template="${escapeHtml(subject.occurrenceId)}">${renderIdentificationParticipation({
        basePath,
        snapshot: subjectIdentifyMap.get(subject.occurrenceId)?.snapshot ?? snapshot,
        consensus: subjectIdentifyMap.get(subject.occurrenceId)?.consensus ?? null,
        viewerSession,
        canUseSpecialistWorkbench: canUseSpecialistWorkbench(viewerSession),
      })}</template>`).join("");
    const layersGrid = `<div class="obs-layers-grid">${layer2}${identifyBlock}${layer6}${layer3}${layer1}${contextBlock}${ctaBlock}</div>`;
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
           var identifyRoot = document.querySelector('[data-obs-switch-identify]');
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
             var identifyTemplate = selectTemplate('data-subject-identify-template', subjectId);
             if (hintRoot && hintTemplate) hintRoot.innerHTML = hintTemplate.innerHTML;
             if (taxonomyRoot && taxonomyTemplate) taxonomyRoot.innerHTML = taxonomyTemplate.innerHTML;
             if (identifyRoot && identifyTemplate) identifyRoot.innerHTML = identifyTemplate.innerHTML;
             renderRegions(subjectId);
             updateStateLabels(subjectId);
             window.dispatchEvent(new CustomEvent('ikimon:identify-panel-replaced'));
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
    const candidateAdoptionScript = isOwner && aiCandidateLearningPanel
      ? `<script>(function(){
           var panel = document.querySelector('[data-ai-cutout-panel]');
           if (!panel) return;
           var buttons = Array.prototype.slice.call(panel.querySelectorAll('[data-adopt-candidate][data-adopt-endpoint]'));
           var status = panel.querySelector('[data-adopt-candidate-status]');
           var setStatus = function(message, isError) {
             if (!status) return;
             status.textContent = message;
             status.classList.toggle('is-error', Boolean(isError));
           };
           buttons.forEach(function(button){
             button.addEventListener('click', function(){
               var endpoint = button.getAttribute('data-adopt-endpoint');
               if (!endpoint) return;
               buttons.forEach(function(item){ item.disabled = true; });
               var original = button.textContent;
               button.textContent = '追加しています…';
               setStatus('同じ日時・場所・写真に紐づく別対象として追加しています。', false);
               fetch(endpoint, {
                 method: 'POST',
                 headers: { accept: 'application/json' },
                 credentials: 'same-origin',
               })
               .then(function(response){
                 return response.json().then(function(json){ return { ok: response.ok && json && json.ok, json: json }; });
               })
               .then(function(result){
                 if (!result.ok) {
                   throw new Error(String((result.json && result.json.error) || 'candidate_adoption_failed'));
                 }
                 setStatus('追加しました。新しい対象を開きます。', false);
                 var occurrenceId = String(result.json.occurrenceId || '');
                 var visitId = String(result.json.visitId || ${JSON.stringify(bundle.visitId)});
                 var next = ${JSON.stringify(appendLangToHref(withBasePath(basePath, `/observations/${encodeURIComponent(bundle.visitId)}`), lang))};
                 if (occurrenceId) {
                   next = ${JSON.stringify(withBasePath(basePath, "/observations/"))} + encodeURIComponent(visitId) + '?subject=' + encodeURIComponent(occurrenceId) + ${JSON.stringify(lang === "ja" ? "&lang=ja" : lang === "en" ? "&lang=en" : "")};
                 }
                 setTimeout(function(){ window.location.href = next; }, 550);
               })
               .catch(function(error){
                 button.textContent = original;
                 buttons.forEach(function(item){ item.disabled = false; });
                 setStatus('追加できませんでした: ' + String(error && error.message || 'network'), true);
               });
             });
           });
         })();</script>`
      : "";
    const identifyScript = `<script>(function(){
      var bindIdentifyForms = function(){
        Array.prototype.slice.call(document.querySelectorAll('[data-identify-form]')).forEach(function(form){
          if (form.getAttribute('data-identify-bound') === '1') return;
          form.setAttribute('data-identify-bound', '1');
          var status = form.querySelector('[data-identify-status]');
          var setStatus = function(message, isError) {
            if (!status) return;
            status.textContent = message;
            status.classList.toggle('is-error', Boolean(isError));
          };
          var submit = function(action) {
            var data = new FormData(form);
            var proposedName = String(data.get('proposedName') || '').trim();
            var proposedRank = String(data.get('proposedRank') || '').trim();
            var notes = String(data.get('notes') || '').trim();
            var identifyEndpoint = form.getAttribute('data-identify-endpoint') || '';
            var disputeEndpoint = form.getAttribute('data-dispute-endpoint') || '';
            var isAlternative = action === 'alternative';
            var isNeedsEvidence = action === 'needs_more_evidence';
            if (!isNeedsEvidence && !proposedName) {
              setStatus('名前を入れてください。証拠不足だけを伝える場合は「証拠が足りない」を使えます。', true);
              return;
            }
            var endpoint = isAlternative || isNeedsEvidence ? disputeEndpoint : identifyEndpoint;
            var body = isAlternative
              ? { kind: 'alternative_id', proposedName: proposedName, proposedRank: proposedRank, reason: notes }
              : isNeedsEvidence
                ? { kind: 'needs_more_evidence', reason: notes || '証拠が足りない' }
                : { proposedName: proposedName, proposedRank: proposedRank, notes: notes, stance: 'support' };
            setStatus('保存中...', false);
            fetch(endpoint, {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify(body),
            })
            .then(function(response) {
              return response.json().then(function(json) { return { ok: response.ok && json && json.ok !== false, json: json }; });
            })
            .then(function(result) {
              if (!result.ok) {
                setStatus('保存できませんでした: ' + String((result.json && result.json.error) || 'unknown_error'), true);
                return;
              }
              setStatus('保存しました。表示を更新します。', false);
              setTimeout(function(){ window.location.reload(); }, 700);
            })
            .catch(function(error) {
              setStatus('通信エラー: ' + String(error && error.message || 'network'), true);
            });
          };
          form.querySelectorAll('[data-identify-action]').forEach(function(button) {
            button.addEventListener('click', function() {
              submit(button.getAttribute('data-identify-action') || 'support');
            });
          });
        });
      };
      bindIdentifyForms();
      window.addEventListener('ikimon:identify-panel-replaced', bindIdentifyForms);
    })();</script>`;
    const detailBody = `${heroBlock}${reassessBlock}${hintBlock}${layersGrid}${supportBlock}<div hidden>${subjectTemplates}</div>${switchScript}${reassessScript}${candidateAdoptionScript}${identifyScript}${galleryScript}`;

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

  app.get<{ Params: { userId: string } }>("/guest/:userId", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    if (!request.params.userId.startsWith("guest_")) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Guest notebook not found", stateCard("Guest ノートなし", "この Guest ノートは見つかりません", "Guest ノートのURLではない、または記録が非公開の可能性があります。"), "ホーム");
    }
    const snapshot = await getProfileSnapshot(request.params.userId);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Guest notebook not found", stateCard("Guest ノートなし", "この Guest ノートは見つかりません", "リンクが古い、または公開できる観察がまだありません。"), "ホーム");
    }
    const viewerSession = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${snapshot.displayName} notebook | ikimon`,
      renderProfileSnapshotBody(basePath, lang, viewerSession?.userId ?? null, snapshot, "guest"),
      "ホーム",
      {
        eyebrow: "Guest observer",
        heading: snapshot.displayName,
        headingHtml: `<span data-testid="profile-heading">${escapeHtml(snapshot.displayName)}</span>`,
        lead: "匿名の観察者が残した、最近の場所と観察のノート。",
        actions: [
          { href: `/home?userId=${encodeURIComponent(snapshot.userId)}`, label: "このGuestのホームを見る" },
        ],
      },
      PLACE_REVISIT_ROW_STYLES,
      appendLangToHref(withBasePath(basePath, `/guest/${encodeURIComponent(request.params.userId)}`), lang),
    );
  });

  app.get<{ Params: { userId: string } }>("/profile/:userId", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    if (request.params.userId.startsWith("guest_")) {
      const guestHref = appendLangToHref(withBasePath(basePath, `/guest/${encodeURIComponent(request.params.userId)}`), lang);
      return reply.redirect(guestHref, 302);
    }
    const snapshot = await getProfileSnapshot(request.params.userId);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Profile not found", stateCard("プロフィールなし", "このユーザーは見つかりません", "リンクが古い、または非公開の可能性があります。"), "ホーム");
    }
    const viewerSession = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${snapshot.displayName} | ikimon`,
      renderProfileSnapshotBody(basePath, lang, viewerSession?.userId ?? null, snapshot),
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
      appendLangToHref(withBasePath(basePath, `/profile/${encodeURIComponent(request.params.userId)}`), lang),
    );
  });

  app.get("/profile", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const session = await getSessionFromCookie(request.headers.cookie);
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    if (!session) {
      reply.type("text/html; charset=utf-8");
      return layout(
        basePath,
        "マイページ | ikimon",
        stateCard(
          "マイページ",
          "ログインすると、自分の観察史を読み返せます",
          `<p style="margin:0 0 12px">観察データ一覧はライブラリへ。マイページでは、積み上げた時間、前より見えてきたこと、地域に残った手がかりを確認できます。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/login?redirect=/profile"))}">ログインしてマイページへ</a>
            <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/register?redirect=/profile"))}">新しく登録する</a>
          </div>`,
        ),
        "ホーム",
        undefined,
        undefined,
        appendLangToHref(withBasePath(basePath, "/profile"), lang),
      );
    }
    const [snapshot, digest] = await Promise.all([
      getProfileSnapshot(session.userId),
      getProfileNoteDigest(session.userId),
    ]);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Profile not found", stateCard("プロフィールなし", "まだ公開できるプロフィールがありません", "ノートに読めるページが増えると、ここに場所と学びの履歴が育ち始めます。"), "ホーム");
    }
    const heroActions = [
      { href: "/notes#notes-own", label: "観察ライブラリを開く" },
      { href: "/notes#notes-places", label: "場所アルバムを見る", variant: "secondary" as const },
      { href: "/profile/settings", label: "プロフィール編集", variant: "secondary" as const },
      { href: "/logout", label: "ログアウト", variant: "secondary" as const },
    ];

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `マイページ | ${snapshot.displayName} | ikimon`,
      renderSelfProfileHub(basePath, lang, snapshot, digest),
      "ホーム",
      {
        eyebrow: snapshot.rankLabel || "観察者",
        heading: snapshot.displayName,
        headingHtml: `<span data-testid="profile-heading">${escapeHtml(snapshot.displayName)}</span>`,
        lead: "あなたのマイページ。観察データ一覧ではなく、積み上げた歴史、学び、地域に残った手がかりを気持ちよく読み返します。",
        actions: heroActions,
      },
      PROFILE_HUB_STYLES,
      appendLangToHref(withBasePath(basePath, "/profile"), lang),
    );
  });

  app.get("/profile/settings", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const session = await getSessionFromCookie(request.headers.cookie);
    if (!session) {
      reply.type("text/html; charset=utf-8");
      return layout(
        basePath,
        "プロフィール編集 | ikimon",
        stateCard(
          "プロフィール編集",
          "プロフィール編集にはログインが必要です",
          `<div class="actions" style="margin-top:16px">
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/login?redirect=/profile/settings"))}">ログインする</a>
            <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/profile"))}">マイページへ</a>
          </div>`,
        ),
        "ホーム",
      );
    }
    const snapshot = await getProfileSnapshot(session.userId);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "プロフィール編集 | ikimon", stateCard("プロフィールなし", "編集できるプロフィールがありません", "観察を 1 件でも記録するとプロフィールが育ち始めます。"), "ホーム");
    }
    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "プロフィール編集 | ikimon",
      renderProfileSettingsForm(basePath, snapshot),
      "ホーム",
      {
        eyebrow: snapshot.rankLabel || "観察者",
        heading: "プロフィール編集",
        lead: "表示名、関心分野、自己紹介を整えて、マイページと公開プロフィールの文脈をそろえます。",
        actions: [
          { href: "/profile", label: "マイページへ戻る", variant: "secondary" as const },
          { href: "/record", label: "記録する" },
        ],
      },
      PROFILE_HUB_STYLES,
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
        "専門家レビューの入口 | ikimon",
        stateCard(
          "専門家レビュー",
          "この画面は、担当範囲が確認された reviewer 向けです",
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
    const requestedOccurrenceId = typeof request.query === "object" && request.query && "occurrenceId" in request.query
      ? String((request.query as Record<string, unknown>).occurrenceId || "").trim()
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
    const rows = snapshot.queue.map((item) => {
      const detailHref = withBasePath(basePath, buildObservationDetailPath(item.detailId ?? item.visitId ?? item.occurrenceId, item.featuredOccurrenceId ?? item.occurrenceId));
      const disputeLabel = (item.openDisputeCount ?? 0) > 0 ? ` · open dispute ${item.openDisputeCount}` : "";
      return `
      <div class="row specialist-queue-row" data-occurrence-id="${escapeHtml(item.occurrenceId)}" data-display-name="${escapeHtml(item.displayName)}">
        <div>
          <div style="font-weight:800">${escapeHtml(item.displayName)}</div>
          <div class="meta">${escapeHtml(item.placeName)} · ${escapeHtml(item.observedAt)}</div>
          <div class="meta">${escapeHtml(item.observerName)} · ${escapeHtml(item.municipality || "Municipality unknown")}${escapeHtml(disputeLabel)}</div>
        </div>
        <div class="actions">
          <span class="pill">${item.identificationCount} ids</span>
          <button class="btn secondary" type="button" data-queue-action="approve">approve</button>
          <button class="btn secondary" type="button" data-queue-action="alternative">alternative</button>
          <button class="btn secondary" type="button" data-queue-action="needs_more_evidence">needs evidence</button>
          <a class="btn btn-ghost" href="${escapeHtml(detailHref)}">詳細</a>
        </div>
      </div>`;
    }).join("");

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
            <label class="stack"><span style="font-weight:700">Occurrence ID</span><input name="occurrenceId" type="text" value="${escapeHtml(requestedOccurrenceId)}" placeholder="occ:..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
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
        const fillWorkbench = (occurrenceId, displayName, mode) => {
          form.elements.occurrenceId.value = occurrenceId || '';
          if (mode === 'alternative') {
            form.elements.proposedName.value = '';
            form.elements.notes.value = '別分類候補: ';
            form.elements.proposedName.focus();
            setStatus('<div class="row"><div>Alternative mode: 別分類名と根拠を入れて approve か note を選んでください。</div></div>');
            return;
          }
          form.elements.proposedName.value = displayName && displayName !== '同定待ち' ? displayName : '';
          form.elements.proposedRank.value = form.elements.proposedRank.value || 'species';
          if (mode === 'needs_more_evidence') {
            form.elements.notes.value = '証拠不足: 追加写真・形質情報が必要';
          }
        };
        document.querySelectorAll('[data-queue-action]').forEach((button) => {
          button.addEventListener('click', async () => {
            const row = button.closest('[data-occurrence-id]');
            const occurrenceId = row ? row.getAttribute('data-occurrence-id') : '';
            const displayName = row ? row.getAttribute('data-display-name') : '';
            const action = button.getAttribute('data-queue-action');
            if (!occurrenceId) return;
            if (action === 'alternative') {
              fillWorkbench(occurrenceId, displayName, 'alternative');
              return;
            }
            if (action === 'needs_more_evidence') {
              fillWorkbench(occurrenceId, displayName, 'needs_more_evidence');
              setStatus('<div class="row"><div>Opening needs-evidence dispute...</div></div>');
              const response = await fetch(withBasePath('/api/v1/observations/' + encodeURIComponent(occurrenceId) + '/disputes'), {
                method: 'POST',
                headers: { 'content-type': 'application/json', accept: 'application/json' },
                body: JSON.stringify({ kind: 'needs_more_evidence', reason: '専門レビュー: 追加証拠が必要' }),
              });
              const json = await response.json();
              if (!response.ok || json.ok === false) {
                setStatus('<div class="row"><div>Needs-evidence failed.<div class="meta">' + String(json.error || 'dispute_submit_failed') + '</div></div></div>');
                return;
              }
              setStatus('<div class="row"><div><strong>Needs-evidence dispute opened.</strong><div class="meta">' + String(json.occurrenceId || occurrenceId) + '</div></div></div>');
              return;
            }
            fillWorkbench(occurrenceId, displayName, 'approve');
            form.querySelector('button[data-decision="approve"]').click();
          });
        });
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
        "専門家推薦の入口 | ikimon",
        stateCard(
          "専門家レビュー",
          "この画面は、担当範囲が確認された reviewer 向けです",
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
        "レビューキューの入口 | ikimon",
        stateCard(
          "専門家レビュー",
          "この画面は、担当範囲が確認された reviewer 向けです",
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
    const session = await getSessionFromCookie(request.headers.cookie);
    const { viewerUserId } = resolveViewer(request.query, session);
    const snapshot = await getLandingSnapshot(viewerUserId);

    const isLoggedIn = Boolean(viewerUserId);
    const libraryEntries = isLoggedIn ? snapshot.myFeed : snapshot.feed;
    const nearbyEntries = isLoggedIn ? snapshot.feed.slice(0, 12) : [];
    const uniquePlaces = new Set(libraryEntries.map((obs) => notesPlaceLine(obs, isLoggedIn ? "owner" : "public")).filter(Boolean));
    const placeCount = isLoggedIn ? snapshot.myPlaces.length : uniquePlaces.size;
    const photoCount = libraryEntries.filter((obs) => Boolean(obs.photoUrl)).length;
    const namedCount = libraryEntries.filter((obs) => !notesLibraryIsUncertain(obs)).length;
    const latest = libraryEntries[0] ?? null;
    const latestLine = latest
      ? `${notesLibraryDateLabel(latest, lang)} · ${latest.displayName || latest.proposedName || "名前を確かめている観察"}`
      : "観察が増えるほど、ここに月ごとの棚が育ちます。";
    const emptyCopy = "まだ近くの公開記録は表示できません。自分の観察ライブラリを主役にします。";

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: "観察ライブラリ | ikimon",
      activeNav: notesPageCopy.activeNav,
      lang,
      currentPath: appendLangToHref(withBasePath(basePath, "/notes"), lang),
      extraStyles: NOTES_LIBRARY_STYLES,
      body: `<div class="notes-library-shell">
        <section class="notes-library-hero">
          <div>
            <span>Observation Library</span>
            <h1>観察ライブラリ</h1>
            <p>写真、動画、ガイド、フィールドスキャンを混ぜずに棚分けして、自分の観察データを Google フォトみたいに月ごとに見返す場所です。学びや貢献の物語はマイページに寄せ、ここは探す・眺める・開くに絞ります。</p>
          </div>
          <div class="notes-library-stats" aria-label="観察ライブラリの概要">
            <div><strong>${escapeHtml(formatProfileNumber(libraryEntries.length))}</strong><em>観察データ</em></div>
            <div><strong>${escapeHtml(formatProfileNumber(photoCount))}</strong><em>画像つき</em></div>
            <div><strong>${escapeHtml(formatProfileNumber(namedCount))}</strong><em>名前あり</em></div>
          </div>
        </section>
        <section id="notes-own" class="section notes-library-main" data-notes-library data-testid="notes-own">
          <div class="notes-library-section-head">
            <div><span>${escapeHtml(isLoggedIn ? "My observations" : "Public sample")}</span><h2>${escapeHtml(isLoggedIn ? "自分の観察データ" : "公開されている観察データ")}</h2></div>
            <p>${escapeHtml(latestLine)}</p>
          </div>
          ${renderNotesLibraryControls(libraryEntries.length, placeCount)}
          ${renderNotesLibrarySourceLanes(libraryEntries)}
          ${renderNotesLibraryMonths(basePath, lang, libraryEntries, { locationMode: isLoggedIn ? "owner" : "public" })}
        </section>
        ${renderNotesLibraryPlaceAlbums(snapshot)}
        <section id="notes-nearby" class="section notes-nearby-library" data-testid="notes-nearby">
          <div class="notes-library-section-head"><div><span>Nearby traces</span><h2>近くの公開記録</h2></div><p>自分の棚とは分けて、地域の背景として薄く見る。</p></div>
          ${nearbyEntries.length > 0
            ? renderNotesLibraryMonths(basePath, lang, nearbyEntries, { locationMode: "public" })
            : `<div class="notes-library-empty">${escapeHtml(emptyCopy)}</div>`}
        </section>
        ${renderNotesLibraryScript()}
      </div>`,
      footerNote: "観察データの棚はこのページ、成長や地域への効き方はマイページに分けています。",
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
