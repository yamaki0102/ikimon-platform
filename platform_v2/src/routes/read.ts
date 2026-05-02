import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl } from "../i18n.js";
import { getSessionFromCookie } from "../services/authSession.js";
import { assertSpecialistSession } from "../services/writeGuards.js";
import { resolveViewer } from "../services/viewerIdentity.js";
import { getLandingSnapshot } from "../services/landingSnapshot.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";
import { OBSERVATION_CARD_STYLES, renderObservationCard } from "../ui/observationCard.js";
import { getObservationContext, groupFeaturesByLayer } from "../services/observationContext.js";
import { getReactionSummary, type ReactionType } from "../services/observationReactions.js";
import { getObserverStats } from "../services/observerStats.js";
import { getTaxonInsight } from "../services/taxonInsights.js";
import { getObservationDetailHeavy } from "../services/observationDetailHeavy.js";
import { getLatestAiAssessment, confidenceLabel } from "../services/observationAiAssessment.js";
import {
  getExploreSnapshot,
  getHomeSnapshot,
  getObservationDetailSnapshot,
  getProfileSnapshot,
  getSpecialistSnapshot,
} from "../services/readModels.js";
import {
  MAP_MINI_STYLES,
  mapMiniBootScript,
  renderMapMini,
  toMapPoints,
} from "../ui/mapMini.js";
import {
  MAP_EXPLORER_STYLES,
  mapExplorerBootScript,
  renderMapExplorer,
} from "../ui/mapExplorer.js";
import { GUIDE_FLOW_STYLES, renderGuideFlow } from "../ui/guideFlow.js";

type LayoutHero = {
  eyebrow: string;
  heading: string;
  headingHtml?: string;
  lead: string;
  actions?: Array<{ href: string; label: string; variant?: "primary" | "secondary" }>;
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
  .obs-hero { display: grid; grid-template-columns: 1fr; gap: 18px; margin-bottom: 24px; }
  @media (min-width: 860px) {
    .obs-hero { grid-template-columns: minmax(0, 1.3fr) minmax(280px, 1fr); align-items: start; gap: 28px; }
    .obs-hero-meta { position: sticky; top: 16px; }
  }
  .obs-hero-gallery { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 5px; border-radius: 20px; overflow: hidden; background: linear-gradient(135deg,#ecfdf5,#e0f2fe); max-height: 620px; }
  .obs-hero-gallery .is-main { grid-column: 1 / -1; aspect-ratio: 4/3; max-height: 520px; }
  .obs-hero-gallery .is-thumb { aspect-ratio: 1/1; }
  .obs-hero-media-stack { display: grid; gap: 10px; }
  .obs-hero-photo-stack { display: grid; gap: 10px; }
  .obs-hero-video { display: grid; gap: 8px; }
  .obs-hero-video-frame { position: relative; width: 100%; padding-top: 56.25%; border-radius: 20px; overflow: hidden; background: #020617; }
  .obs-hero-video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; }
  .obs-hero-video-meta { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 12px; color: #334155; font-weight: 700; }
  .obs-hero-video-meta a { color: #0369a1; text-decoration: underline; text-underline-offset: 2px; }
  .obs-hero-photo { border: 0; padding: 0; background: none; overflow: hidden; cursor: zoom-in; position: relative; }
  .obs-hero-photo img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .3s ease; }
  .obs-hero-photo:hover img { transform: scale(1.04); }
  .obs-hero-placeholder { aspect-ratio: 4/3; display: grid; place-items: center; text-align: center; font-weight: 800; color: #475569; background: repeating-linear-gradient(0deg, #f0fdf4 0 24px, #ecfdf5 24px 25px); border-radius: 20px; gap: 8px; }
  .obs-hero-placeholder span:first-child { font-size: 40px; }
  .obs-hero-meta { display: flex; flex-direction: column; gap: 14px; padding: 4px; }
  .obs-hero-title { margin: 0; font-size: 28px; font-weight: 900; color: #0f172a; letter-spacing: -.02em; line-height: 1.15; }
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
  .obs-reaction-bar { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
  .obs-reaction { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; border: 1px solid rgba(15,23,42,.1); background: #fff; font-weight: 700; font-size: 13px; color: #334155; cursor: pointer; transition: transform .12s ease, background .2s ease; }
  .obs-reaction:hover { background: #f9fafb; transform: translateY(-1px); }
  .obs-reaction.is-reacted { background: rgba(16,185,129,.12); border-color: rgba(16,185,129,.3); color: #047857; }
  .obs-reaction-count { background: rgba(15,23,42,.06); padding: 1px 7px; border-radius: 10px; font-size: 11px; font-weight: 800; }
  .obs-reaction-label { display: none; }
  @media (min-width: 640px) { .obs-reaction-label { display: inline; } }
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

  .obs-fold { border-radius: 12px; background: #f9fafb; border: 1px solid rgba(15,23,42,.08); overflow: hidden; margin-bottom: 8px; }
  .obs-fold > summary { padding: 12px 16px; font-weight: 800; color: #111827; cursor: pointer; list-style: none; display: flex; align-items: center; gap: 10px; font-size: 13.5px; }
  .obs-fold > summary::after { content: "+"; color: #9ca3af; font-size: 16px; margin-left: auto; }
  .obs-fold[open] > summary::after { content: "−"; }
  .obs-fold-count { background: rgba(15,23,42,.08); color: #475569; font-size: 10.5px; font-weight: 700; padding: 1px 8px; border-radius: 999px; }
  .obs-chips { padding: 0 16px 14px; margin: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 6px; }
  .obs-chip { display: inline-flex; align-items: center; gap: 5px; background: #fff; border: 1px solid rgba(15,23,42,.1); border-radius: 999px; padding: 5px 10px; font-size: 12px; font-weight: 700; color: #111827; }
  .obs-chip-conf { color: #16a34a; font-weight: 800; font-size: 10.5px; }
  .obs-chip-src { font-size: 11px; }

  /* === 観察詳細リデザイン (2026-05) === */
  .obs-flow { display: flex; flex-direction: column; gap: 14px; }
  .obs-section { padding: 18px 20px; border-radius: 16px; background: #fff; border: 1px solid rgba(15,23,42,.06); box-shadow: 0 1px 2px rgba(15,23,42,.03); }
  .obs-section-title { margin: 0 0 12px; font-size: 16px; font-weight: 900; color: #0f172a; letter-spacing: .005em; display: flex; align-items: center; gap: 8px; }
  .obs-section-title small { font-size: 11px; font-weight: 700; color: #94a3b8; letter-spacing: .04em; }
  .obs-section-eyebrow { font-size: 10.5px; font-weight: 900; color: #64748b; letter-spacing: .14em; text-transform: uppercase; margin-bottom: 6px; }

  /* AI ヒント — スリム版 */
  .obs-ai-hint { padding: 18px 20px; border-radius: 16px; border: 1px solid rgba(16,185,129,.18); background: linear-gradient(180deg, #f0fdf4, #ecfdf5); display: flex; flex-direction: column; gap: 12px; }
  .obs-ai-hint.is-medium { border-color: rgba(245,158,11,.22); background: linear-gradient(180deg, #fffbeb, #fef9c3); }
  .obs-ai-hint.is-low, .obs-ai-hint.is-tent { border-color: rgba(239,68,68,.18); background: linear-gradient(180deg, #fef2f2, #fff1f2); }
  .obs-ai-hint-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .obs-ai-hint-rec { font-size: 17px; font-weight: 900; color: #0f172a; line-height: 1.3; }
  .obs-ai-hint-rec small { font-size: 11.5px; font-weight: 700; color: #64748b; margin-left: 6px; }
  .obs-ai-hint-summary { margin: 0; font-size: 13.5px; line-height: 1.65; color: #334155; }
  .obs-ai-hint-cols { display: grid; grid-template-columns: 1fr; gap: 10px; }
  @media (min-width: 720px) {
    .obs-ai-hint-cols { grid-template-columns: 1fr 1fr; gap: 12px; }
  }
  .obs-ai-hint-col { padding: 12px 14px; background: rgba(255,255,255,.72); border-radius: 12px; border: 1px solid rgba(15,23,42,.06); }
  .obs-ai-hint-col h3 { margin: 0 0 6px; font-size: 11px; font-weight: 900; color: #64748b; letter-spacing: .12em; text-transform: uppercase; }
  .obs-ai-hint-col ul { margin: 0; padding-left: 16px; font-size: 13px; line-height: 1.65; color: #334155; }
  .obs-ai-hint-col ul li { margin-bottom: 2px; }
  .obs-ai-hint-col p { margin: 0; font-size: 13px; line-height: 1.65; color: #334155; }
  .obs-ai-hint-fun { padding: 10px 14px; background: rgba(99,102,241,.08); border-radius: 10px; border: 1px solid rgba(99,102,241,.16); font-size: 13px; line-height: 1.65; color: #312e81; }
  .obs-ai-hint-fun strong { color: #4338ca; margin-right: 4px; }
  .obs-ai-hint-foot { margin: 0; font-size: 11px; color: #94a3b8; line-height: 1.5; }

  /* 観察者メモ */
  .obs-note-block { padding: 14px 16px; border-radius: 12px; background: #fffbeb; border-left: 4px solid #f59e0b; }
  .obs-note-block p { margin: 0; font-size: 14px; line-height: 1.7; color: #422006; }

  /* アクションレール */
  .obs-action-rail { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; padding: 12px; border-radius: 14px; background: linear-gradient(135deg, #f8fafc, #f1f5f9); border: 1px solid rgba(15,23,42,.06); }
  .obs-action { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 10px 8px; border: 0; border-radius: 12px; background: #fff; color: #0f172a; text-decoration: none; font-weight: 800; font-size: 12.5px; box-shadow: 0 1px 2px rgba(15,23,42,.04); cursor: pointer; transition: transform .12s ease, box-shadow .2s ease; }
  .obs-action:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(15,23,42,.08); }
  .obs-action[disabled] { opacity: .55; cursor: progress; }
  .obs-action-icon { font-size: 20px; line-height: 1; }
  .obs-action-label { font-size: 12px; text-align: center; }
  .obs-action.is-primary { background: #111827; color: #fff; }
  .obs-action.is-primary:hover { background: #1f2937; }

  /* 折り畳み詳細 */
  .obs-details-acc { border-radius: 14px; border: 1px solid rgba(15,23,42,.08); background: #fff; overflow: hidden; }
  .obs-details-acc > summary { list-style: none; padding: 14px 18px; font-weight: 900; font-size: 14px; color: #0f172a; cursor: pointer; display: flex; align-items: center; gap: 8px; }
  .obs-details-acc > summary::-webkit-details-marker { display: none; }
  .obs-details-acc > summary::after { content: "▾"; margin-left: auto; color: #94a3b8; transition: transform .2s ease; }
  .obs-details-acc[open] > summary::after { transform: rotate(180deg); }
  .obs-details-acc[open] > summary { border-bottom: 1px solid rgba(15,23,42,.06); }
  .obs-details-body { padding: 14px 18px 18px; display: flex; flex-direction: column; gap: 14px; }
  .obs-details-sub { padding: 12px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid rgba(15,23,42,.05); }
  .obs-details-sub h4 { margin: 0 0 6px; font-size: 12px; font-weight: 900; color: #64748b; letter-spacing: .1em; text-transform: uppercase; }
  .obs-details-sub p { margin: 0 0 4px; font-size: 13px; line-height: 1.65; color: #334155; }
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

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

export async function registerReadRoutes(app: FastifyInstance): Promise<void> {
  app.get("/record", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
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
      "ikimon v2 record",
      `<section class="record-page">
        <div class="record-shell">
          <section class="record-card record-sheet">
            <div class="record-card-head">
              <div>
                <div class="eyebrow">Quick capture</div>
                <h2>観察を 1 ページとして残す</h2>
                <p class="meta">場所・時刻・名前の仮説を最小入力で残し、あとからノートで育てる前提の入力画面です。</p>
              </div>
              <div class="record-session-pill">
                <span class="record-session-label">Signed in</span>
                <strong>${escapeHtml(viewerUserId)}</strong>
              </div>
            </div>
            <form id="record-form" data-user-id="${escapeHtml(viewerUserId)}" class="record-form">
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
                <button class="btn btn-solid" type="submit">観察を記録する</button>
                <a class="btn btn-ghost" href="${escapeHtml(withBasePath(basePath, "/notes"))}">ノートへ戻る</a>
              </div>
            </form>
          </section>
          <aside class="record-sidebar">
            <section class="record-card record-preview-card">
              <div class="eyebrow">Notebook preview</div>
              <h2>この記録が残る形</h2>
              <div class="record-preview">
                <div class="record-preview-topline">
                  <span class="record-preview-kicker">field note</span>
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
              <div class="eyebrow">Why this matters</div>
              <h2>この 1 件が効く理由</h2>
              <div class="list">
                <div class="row"><div><strong>再訪理由が残る</strong><div class="meta">場所メモと日時が、次に同じ道を歩く理由になる。</div></div></div>
                <div class="row"><div><strong>見分け方の仮説が残る</strong><div class="meta">写真と名前の仮説が、次に見返したときの手がかりになる。</div></div></div>
                <div class="row"><div><strong>ノートとして読み返せる</strong><div class="meta">単発投稿ではなく、前回との差分が見える履歴になる。</div></div></div>
              </div>
            </section>
            <section class="record-card">
              <div class="eyebrow">Status</div>
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
        const previewDate = document.getElementById('record-preview-date');
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

        const normalizeError = (error) => {
          if (!error) return 'unknown_error';
          if (typeof error === 'string') return error;
          if (error && typeof error.message === 'string') return error.message;
          return String(error);
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
          const scientificName = String(data.get('scientificName') || '').trim();
          const vernacularName = String(data.get('vernacularName') || '').trim();
          const localityNote = String(data.get('localityNote') || '').trim();
          const municipality = String(data.get('municipality') || '').trim();
          const latitude = String(data.get('latitude') || '').trim();
          const longitude = String(data.get('longitude') || '').trim();
          const observedAtValue = String(data.get('observedAt') || '').trim();
          if (previewTitle) previewTitle.textContent = vernacularName || scientificName || '名前未確定の観察';
          if (previewPlace) previewPlace.textContent = localityNote || '場所メモが入ると、あとから再訪理由として効きます。';
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

        syncPreview();
        resetVideoProgress();

        if (form) {
          form.addEventListener('submit', async (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const userId = form.dataset.userId || '';
            const observationId = 'record-' + Date.now();
            if (!userId) {
              setStatus('<div class="row"><div>User context is missing.</div></div>');
              return;
            }
            setStatus('<div class="row"><div>記録を送信中...</div></div>');
            try {
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
                note: '',
                sourcePayload: { source: 'v2_web' },
                taxon: {
                  scientificName: String(data.get('scientificName') || ''),
                  vernacularName: String(data.get('vernacularName') || ''),
                  rank: String(data.get('rank') || ''),
                },
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
                ? '<div class="meta" style="margin-top:6px">' + extraStatus + '</div>'
                : '';
              setStatus('<div class="row"><div><strong>記録を保存しました。</strong>' + suffix + '<div class="meta"><a href="' + withBasePath('/observations/' + encodeURIComponent(detailId)) + '">観察を見る</a> · <a href="' + withBasePath('/notes') + '">ノートへ戻る</a></div></div></div>');
              form.reset();
              if (observedAt) {
                const now = new Date();
                observedAt.value = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
              }
              renderPreviewFile(null);
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
        eyebrow: "記録する",
        heading: "今日の 1 ページを書く",
        lead: "観察した場所・時刻・気づいた生きものを、そのまま 1 件のノートに残します。まずは再訪できる形で残すことを優先します。",
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
          .record-card-head { padding-left: 0; }
          .record-sheet::after, .record-preview::after { display: none; }
        }
      `,
    );
  });

  app.get("/explore", async (_request, reply) => {
    const basePath = requestBasePath(_request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((_request as unknown as { url?: string }).url ?? ""));
    const snapshot = await getExploreSnapshot();
    const cards = snapshot.recentObservations.map((item) =>
      renderObservationCard(basePath, lang, {
        occurrenceId: item.occurrenceId,
        visitId: item.visitId,
        displayName: item.displayName,
        observedAt: item.observedAt,
        observerName: item.observerName,
        placeName: item.placeName,
        municipality: item.municipality,
        photoUrl: item.photoUrl,
        identificationCount: item.identificationCount,
        latitude: null,
        longitude: null,
        observerUserId: null,
        observerAvatarUrl: null,
      }),
    ).join("");
    const municipalities = snapshot.municipalities.map((item) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(item.municipality)}</div>
          <div class="meta">観察クラスター</div>
        </div>
        <span class="pill">${item.observationCount} 件</span>
      </div>`).join("");
    const taxa = snapshot.topTaxa.map((item) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(item.displayName)}</div>
          <div class="meta">よく観察されている種</div>
        </div>
        <span class="pill">${item.observationCount} 件</span>
      </div>`).join("");

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      "みつける | ikimon",
      `<section class="section">
        <div class="grid">
          <div class="card"><div class="card-body"><div class="eyebrow">また見に行ける場所</div><div class="list">${municipalities || '<div class="row"><div>まだ場所データがありません。</div></div>'}</div></div></div>
          <div class="card"><div class="card-body"><div class="eyebrow">そこで目立つ生きもの</div><div class="list">${taxa || '<div class="row"><div>まだ種データがありません。</div></div>'}</div></div></div>
        </div>
      </section>
      <section class="section"><div class="section-header"><div><div class="eyebrow">直近の観察</div><h2>次に歩く理由を探す</h2></div></div><div class="explore-grid">${cards || '<div class="card"><div class="card-body">まだ観察がありません。</div></div>'}</div></section>`,
      "みつける",
      {
        eyebrow: "みつける",
        heading: "次に歩く場所を探す",
        lead: "場所ごとの観察の積み重なりから、どこを再訪すると発見が増えそうかを見つけます。",
        actions: [
          { href: "/map", label: "マップで見る" },
          { href: "/notes", label: "ノートに戻る", variant: "secondary" as const },
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
        displayName: item.displayName,
        observedAt: item.observedAt,
        observerName: item.observerName,
        placeName: item.placeName,
        municipality: item.municipality,
        photoUrl: item.photoUrl,
        identificationCount: item.identificationCount,
        latitude: null,
        longitude: null,
        observerUserId: null,
        observerAvatarUrl: null,
      }),
    ).join("");
    const myPlaces = snapshot.myPlaces.map((place) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, `/profile/${encodeURIComponent(snapshot.viewerUserId || "")}`))}">
        <div>
          <div style="font-weight:800">${escapeHtml(place.placeName)}</div>
          <div class="meta">${escapeHtml(place.municipality || "自治体不明")} · 前回 ${escapeHtml(place.lastObservedAt)}</div>
        </div>
        <span class="pill">${place.visitCount} 回</span>
      </a>`).join("");
    const revisitCue = snapshot.myPlaces[0]
      ? `${snapshot.myPlaces[0].placeName} を起点に、前回の記録と今季の変化を見返せます。`
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
      ${snapshot.viewerUserId ? `<section class="section"><div class="section-header"><div><div class="eyebrow">よく歩く場所</div><h2>再訪したい場所</h2></div></div><div class="list">${myPlaces || '<div class="row"><div>まだ記録した場所はありません。</div></div>'}</div></section>` : ""}
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
      `,
    );
  });

  app.get<{ Params: { id: string } }>("/observations/:id", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const snapshot = await getObservationDetailSnapshot(request.params.id);
    if (!snapshot) {
      reply.code(404).type("text/html; charset=utf-8");
      return layout(basePath, "Observation not found", stateCard("見つかりません", "この観察はまだ取得できません", "リンクが古い、または観察が削除されている可能性があります。"), "みつける");
    }

    const viewerSession = await getSessionFromCookie(request.headers.cookie ?? "").catch(() => null);
    const viewerUserId = viewerSession?.userId ?? null;

    // 並列取得: context / heavy / reactions / observer stats / insight / AI assessment
    const [obsContext, heavy, reactions, observerStats, insight, aiAssessment] = await Promise.all([
      getObservationContext(request.params.id, snapshot.visitId ?? null, null).catch(() => null),
      getObservationDetailHeavy(request.params.id, snapshot.visitId ?? null, snapshot.placeId ?? null, viewerUserId).catch(() => null),
      getReactionSummary(request.params.id, viewerUserId).catch(() => null),
      viewerUserId
        ? getObserverStats(viewerUserId, snapshot.placeId ?? null, request.params.id).catch(() => null)
        : Promise.resolve(null),
      snapshot.scientificName || snapshot.displayName
        ? getTaxonInsight({
            scientificName: snapshot.scientificName ?? "",
            vernacularName: snapshot.displayName,
            lat: snapshot.latitude ?? undefined,
            lng: snapshot.longitude ?? undefined,
            season: seasonFromDate(snapshot.observedAt),
            lang: "ja",
          }).catch(() => null)
        : Promise.resolve(null),
      getLatestAiAssessment(request.params.id).catch(() => null),
    ]);

    // ===== Layer 0: ヒーロー =====
    const photoGallery = snapshot.photoUrls.length > 0
      ? `<div class="obs-hero-gallery" data-obs-gallery>
           ${snapshot.photoUrls.map((url, i) => `
             <button type="button" class="obs-hero-photo${i === 0 ? " is-main" : " is-thumb"}" data-obs-photo-index="${i}" data-obs-photo-src="${escapeHtml(url)}">
               <img src="${escapeHtml(url)}" alt="${escapeHtml(snapshot.displayName)}" loading="${i === 0 ? "eager" : "lazy"}" />
             </button>`).join("")}
         </div>`
      : "";
    const primaryVideo = snapshot.videoAssets[0] ?? null;
    const videoPlayer = primaryVideo
      ? `<div class="obs-hero-video">
           <div class="obs-hero-video-frame">
             <iframe
               src="${escapeHtml(primaryVideo.iframeUrl)}"
               title="${escapeHtml(snapshot.displayName)} の動画"
               loading="lazy"
               allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
               allowfullscreen>
             </iframe>
           </div>
           <div class="obs-hero-video-meta">
             <strong>動画</strong>
             ${primaryVideo.watchUrl ? `<a href="${escapeHtml(primaryVideo.watchUrl)}" target="_blank" rel="noopener noreferrer">別タブで開く</a>` : ""}
           </div>
         </div>`
      : "";
    const mediaBlock = (videoPlayer || photoGallery)
      ? `<div class="obs-hero-media-stack">${videoPlayer}${photoGallery ? `<div class="${videoPlayer ? "obs-hero-photo-stack" : ""}">${photoGallery}</div>` : ""}</div>`
      : `<div class="obs-hero-placeholder"><span>📷</span><span>${escapeHtml(snapshot.displayName)}</span><small>写真も動画もまだありません</small></div>`;

    const badges: string[] = [];
    if (snapshot.scientificName) badges.push(`<span class="obs-badge obs-badge-species">🔬 ${escapeHtml(snapshot.scientificName)}</span>`);
    if (snapshot.identifications.length > 0) badges.push(`<span class="obs-badge obs-badge-consensus">🧭 同定 ${snapshot.identifications.length} 件</span>`);
    if (heavy && heavy.nearby.length > 0) badges.push(`<span class="obs-badge obs-badge-nearby">📍 同地点 ${heavy.nearby.length} 件</span>`);
    if (snapshot.videoAssets.length > 0) badges.push(`<span class="obs-badge obs-badge-video">🎬 動画あり</span>`);

    const REACTION_META: Record<ReactionType, { icon: string; label: string }> = {
      like: { icon: "💚", label: "いいね" },
      helpful: { icon: "✨", label: "参考になった" },
      curious: { icon: "🧭", label: "興味あり" },
      thanks: { icon: "🙏", label: "ありがとう" },
    };
    const reactionBar = reactions
      ? `<div class="obs-reaction-bar" data-occurrence-id="${escapeHtml(request.params.id)}">
           ${(["like", "helpful", "curious", "thanks"] as ReactionType[])
             .map((t) => `
               <button type="button" class="obs-reaction${reactions.viewerReacted[t] ? " is-reacted" : ""}"
                       data-reaction-type="${t}"
                       ${viewerUserId ? "" : 'data-login-required="1"'}>
                 <span>${REACTION_META[t].icon}</span>
                 <span class="obs-reaction-label">${REACTION_META[t].label}</span>
                 <span class="obs-reaction-count">${reactions.counts[t]}</span>
               </button>`)
             .join("")}
         </div>`
      : "";

    const heroBlock = `
      <section class="section obs-hero">
        <div class="obs-hero-media">${mediaBlock}</div>
        <div class="obs-hero-meta">
          <h1 class="obs-hero-title">${escapeHtml(snapshot.displayName)}</h1>
          <div class="obs-hero-byline">
            <a class="obs-hero-observer" href="${escapeHtml(snapshot.observerUserId ? withBasePath(basePath, "/profile/" + encodeURIComponent(snapshot.observerUserId)) : "#")}">
              ${snapshot.observerAvatarUrl
                ? `<img class="obs-hero-avatar obs-hero-avatar-img" src="${escapeHtml(snapshot.observerAvatarUrl)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'obs-hero-avatar',textContent:${JSON.stringify((snapshot.observerName || "?").slice(0, 1))}}))" />`
                : `<span class="obs-hero-avatar">${escapeHtml((snapshot.observerName || "?").slice(0, 1))}</span>`}
              <span>${escapeHtml(snapshot.observerName || "観察者")}</span>
            </a>
            <span class="obs-hero-when">${escapeHtml(formatAbsolute(snapshot.observedAt))}</span>
            <span class="obs-hero-place">${escapeHtml(snapshot.placeName || "場所情報なし")}</span>
          </div>
          ${badges.length > 0 ? `<div class="obs-hero-badges">${badges.join("")}</div>` : ""}
          ${reactionBar}
        </div>
      </section>`;

    const isOwner = !!viewerUserId && viewerUserId === snapshot.observerUserId;

    // ===== AI ヒント — 統合スリム版 =====
    // 統合方針: 推奨種は冒頭、見分け方/紛らわしい種は1ブロック、
    //           次の手がかりは「次に撮るべき写真」として nextStepText + confirmMore を1個に統合、
    //           場所/季節/観察者ブースト/止める理由 は折り畳みへ
    const aiHintBlock = aiAssessment
      ? (() => {
          const band = aiAssessment.confidenceBand;
          const bandClass = band === "high" ? "is-high" : band === "medium" ? "is-medium" : band === "low" ? "is-low" : "is-tent";
          const bandLabel = confidenceLabel(band);
          const recName = aiAssessment.recommendedTaxonName;
          const recRank = aiAssessment.recommendedRank;
          const summary = aiAssessment.simpleSummary || aiAssessment.narrative || "";
          const head = `<div class="obs-ai-hint-head">
            ${recName ? `<span class="obs-ai-hint-rec">${escapeHtml(recName)}${recRank ? `<small>${escapeHtml(recRank)}まで</small>` : ""}</span>` : `<span class="obs-ai-hint-rec">観察のヒント</span>`}
            <span class="obs-hint-badge">${escapeHtml(bandLabel)}</span>
          </div>`;
          const summaryP = summary ? `<p class="obs-ai-hint-summary">${escapeHtml(summary)}</p>` : "";

          // 見分け方 + 紛らわしい種 を 1 列に
          const tipsCol = (aiAssessment.distinguishingTips.length > 0 || aiAssessment.similarTaxa.length > 0)
            ? `<div class="obs-ai-hint-col">
                 <h3>見分け方のポイント</h3>
                 ${aiAssessment.distinguishingTips.length > 0 ? `<ul>${aiAssessment.distinguishingTips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>` : ""}
                 ${aiAssessment.similarTaxa.length > 0 ? `<ul class="obs-hint-tags" style="margin-top:8px">${aiAssessment.similarTaxa.map((t) => `<li>${escapeHtml(t.name)}${t.rank ? ` <small>(${escapeHtml(t.rank)})</small>` : ""}</li>`).join("")}</ul>` : ""}
               </div>`
            : "";

          // 写真から拾えた + 拾えていない を1列に
          const cluesCol = (aiAssessment.diagnosticFeaturesSeen.length > 0 || aiAssessment.missingEvidence.length > 0)
            ? `<div class="obs-ai-hint-col">
                 <h3>写真の手がかり</h3>
                 ${aiAssessment.diagnosticFeaturesSeen.length > 0 ? `<ul class="obs-hint-tags">${aiAssessment.diagnosticFeaturesSeen.map((f) => `<li>✓ ${escapeHtml(f)}</li>`).join("")}</ul>` : ""}
                 ${aiAssessment.missingEvidence.length > 0 ? `<ul class="obs-hint-tags" style="margin-top:8px;opacity:.75">${aiAssessment.missingEvidence.map((f) => `<li>— ${escapeHtml(f)}</li>`).join("")}</ul>` : ""}
               </div>`
            : "";

          // 次に撮るべき写真 — nextStepText + confirmMore を統合（1セクションのみ）
          const nextItems: string[] = [];
          if (aiAssessment.nextStepText) nextItems.push(aiAssessment.nextStepText);
          aiAssessment.confirmMore.forEach((c) => { if (c) nextItems.push(c); });
          const nextCol = nextItems.length > 0
            ? `<div class="obs-ai-hint-col">
                 <h3>次に撮るべき写真</h3>
                 ${nextItems.length === 1 ? `<p>${escapeHtml(nextItems[0])}</p>` : `<ul>${nextItems.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`}
               </div>`
            : "";

          const cols = [tipsCol, cluesCol, nextCol].filter(Boolean).join("");
          const colsBlock = cols ? `<div class="obs-ai-hint-cols">${cols}</div>` : "";

          const funFact = aiAssessment.funFact
            ? `<div class="obs-ai-hint-fun"><strong>豆知識:</strong>${escapeHtml(aiAssessment.funFact)}</div>`
            : "";

          return `<section class="obs-ai-hint ${bandClass}">${head}${summaryP}${colsBlock}${funFact}<p class="obs-ai-hint-foot">※ AI 参考情報。コミュニティ同定の票には入りません。</p></section>`;
        })()
      : "";

    // ===== 観察者メモ =====
    const ownerNoteBlock = snapshot.note
      ? `<section class="obs-note-block"><div class="obs-section-eyebrow">観察者のメモ</div><p>${escapeHtml(snapshot.note)}</p></section>`
      : "";

    // ===== 組写真カバレッジ (subjects ≥ 2 のみ) =====
    const subjectsBlock = heavy && heavy.subjects.length >= 2
      ? `<section class="obs-section">
           <h2 class="obs-section-title">組写真カバレッジ <small>${heavy.subjects.length} 個体</small></h2>
           <div class="obs-subjects-grid">
             ${heavy.subjects.map((s) => `
               <div class="obs-subject-card${s.isPrimary ? " is-primary" : ""}" data-role="${escapeHtml(s.roleHint)}">
                 <div class="obs-subject-role">${s.isPrimary ? "🎯 主被写体" : s.roleHint === "vegetation" ? "🌿 植生" : s.roleHint === "alt_candidate" ? "🔀 別候補" : "🐾 同時に居た"}</div>
                 <div class="obs-subject-name">${escapeHtml(s.displayName)}</div>
                 ${s.rank ? `<div class="obs-subject-rank">${escapeHtml(s.rank)}</div>` : ""}
                 ${typeof s.confidence === "number" ? `<div class="obs-subject-conf">${Math.round(s.confidence * 100)}%</div>` : ""}
               </div>`).join("")}
           </div>
         </section>`
      : "";

    // ===== 同定セクション =====
    const lineageChips = heavy && heavy.lineage.length > 0
      ? `<div class="obs-lineage">${heavy.lineage.map((l) => `<span class="obs-lineage-item"><small>${escapeHtml(l.rank)}</small>${escapeHtml(l.name)}</span>`).join('<span class="obs-lineage-sep">›</span>')}</div>`
      : "";
    const idsList = snapshot.identifications.length > 0
      ? `<ul class="obs-id-list">
           ${snapshot.identifications.map((item) => `
             <li class="obs-id-item">
               <div class="obs-id-avatar">${escapeHtml((item.actorName || "?").slice(0, 1))}</div>
               <div class="obs-id-body">
                 <div class="obs-id-line">
                   <span class="obs-id-name">${escapeHtml(item.proposedName)}</span>
                   ${item.proposedRank ? `<span class="obs-id-rank">${escapeHtml(item.proposedRank)}</span>` : ""}
                 </div>
                 <div class="obs-id-meta">${escapeHtml(item.actorName)} · ${escapeHtml(item.createdAt)}</div>
                 ${item.notes ? `<p class="obs-id-note">${escapeHtml(item.notes)}</p>` : ""}
               </div>
             </li>`).join("")}
         </ul>`
      : `<p class="obs-empty">まだ名前は確定していません。最初の提案者になれます。</p>`;
    const idBlock = `<section class="obs-section">
        <h2 class="obs-section-title">同定 <small>${snapshot.identifications.length} 件</small></h2>
        ${lineageChips}
        ${idsList}
      </section>`;

    // ===== 豆知識 (1個のみ・compact) =====
    const insightBits: string[] = [];
    if (insight && insight.etymology) insightBits.push(`<div class="obs-insight-item"><div class="obs-insight-eye">📖 名前の由来</div><p>${escapeHtml(insight.etymology)}</p></div>`);
    if (insight && insight.ecologyNote) insightBits.push(`<div class="obs-insight-item"><div class="obs-insight-eye">🌿 生き方</div><p>${escapeHtml(insight.ecologyNote)}</p></div>`);
    if (insight && insight.lookAlikeNote) insightBits.push(`<div class="obs-insight-item"><div class="obs-insight-eye">🔍 似た仲間</div><p>${escapeHtml(insight.lookAlikeNote)}</p></div>`);
    if (insight && insight.rarityNote) insightBits.push(`<div class="obs-insight-item"><div class="obs-insight-eye">📍 出会いやすさ</div><p>${escapeHtml(insight.rarityNote)}</p></div>`);
    const insightBlock = insightBits.length > 0
      ? `<section class="obs-section">
           <h2 class="obs-section-title">この生きものについて</h2>
           <div class="obs-insight-grid">${insightBits.join("")}</div>
         </section>`
      : "";

    // ===== アクションレール (アイコンボタン1行) =====
    const actionItems: string[] = [];
    if (snapshot.placeId) {
      actionItems.push(`<a class="obs-action" href="${escapeHtml(withBasePath(basePath, "/map"))}"><span class="obs-action-icon">📍</span><span class="obs-action-label">この場所を再訪</span></a>`);
    }
    actionItems.push(`<a class="obs-action" href="${escapeHtml(withBasePath(basePath, "/record"))}"><span class="obs-action-icon">📝</span><span class="obs-action-label">似た場面を記録</span></a>`);
    actionItems.push(`<a class="obs-action" href="${escapeHtml(withBasePath(basePath, "/explore"))}"><span class="obs-action-icon">🔍</span><span class="obs-action-label">似た観察を見る</span></a>`);
    if (isOwner) {
      actionItems.push(`<button type="button" class="obs-action is-primary obs-reassess-btn" data-reassess-endpoint="${escapeHtml(withBasePath(basePath, "/api/v1/observations/" + encodeURIComponent(request.params.id) + "/reassess"))}" data-loading-text="再判定中…"><span class="obs-action-icon">🔄</span><span class="obs-action-label">写真から再判定</span></button>`);
      if (snapshot.videoAssets.length > 0) {
        actionItems.push(`<button type="button" class="obs-action is-primary obs-reassess-btn" data-reassess-endpoint="${escapeHtml(withBasePath(basePath, "/api/v1/observations/" + encodeURIComponent(request.params.id) + "/reassess-from-video"))}" data-loading-text="再判定中…"><span class="obs-action-icon">🎬</span><span class="obs-action-label">動画から再判定</span></button>`);
      }
    }
    const actionRail = `<nav class="obs-action-rail" aria-label="アクション">${actionItems.join("")}</nav>${isOwner ? `<span class="obs-reassess-status" data-reassess-status hidden style="display:block;text-align:center;margin-top:8px"></span>` : ""}`;

    // ===== 詳細（折り畳み） =====
    // エリア推察 / 場所と季節 / 共生種 / 観察者統計 / AI 環境読み取り を1個のアコーディオンに集約
    const grouped = obsContext ? groupFeaturesByLayer(obsContext.features) : { coexistingTaxa: [], environment: [], sounds: [] };
    const renderFeatureChips = (list: typeof grouped.coexistingTaxa): string =>
      list.map((f) => `<li class="obs-chip" title="${escapeHtml(f.note ?? "")}"><span class="obs-chip-name">${escapeHtml(f.name)}</span>${
        typeof f.confidence === "number" ? `<span class="obs-chip-conf">${Math.round(f.confidence * 100)}%</span>` : ""
      }<span class="obs-chip-src">${f.sourceKind === "audio" ? "🎤" : "📷"}</span></li>`).join("");

    const placeSeasonSub = (aiAssessment && (aiAssessment.geographicContext || aiAssessment.seasonalContext))
      ? `<div class="obs-details-sub">
           <h4>場所と季節のヒント</h4>
           ${aiAssessment.geographicContext ? `<p>📍 ${escapeHtml(aiAssessment.geographicContext)}</p>` : ""}
           ${aiAssessment.seasonalContext ? `<p>🗓 ${escapeHtml(aiAssessment.seasonalContext)}</p>` : ""}
         </div>` : "";

    const nearbySub = heavy && (heavy.nearby.length > 0 || heavy.peers.length > 0 || heavy.seasonalHistory.length > 0)
      ? `<div class="obs-details-sub">
           <h4>この場所の物語</h4>
           ${heavy.peers.length > 0 ? `<p class="obs-peers">この場所で観察した人は <strong>${heavy.peers.length}</strong> 人（${heavy.peers.map((p) => escapeHtml(p.displayName)).slice(0, 3).join(" / ")} 等）</p>` : ""}
           ${heavy.nearby.length > 0 ? `<div class="obs-nearby-grid">${heavy.nearby.map((n) => `
             <a class="obs-nearby-card" href="${escapeHtml(withBasePath(basePath, "/observations/" + encodeURIComponent(n.occurrenceId)))}">
               ${n.photoUrl ? `<img src="${escapeHtml(n.photoUrl)}" alt="${escapeHtml(n.displayName)}" loading="lazy" />` : '<div class="obs-nearby-nophoto">📷</div>'}
               <div class="obs-nearby-body">
                 <div class="obs-nearby-name">${escapeHtml(n.displayName)}</div>
                 <div class="obs-nearby-meta">${escapeHtml(n.observerName)} · ${escapeHtml(n.observedAt)}</div>
               </div>
             </a>`).join("")}</div>` : ""}
           ${heavy.seasonalHistory.length > 0 ? `<div class="obs-seasonal-wrap" style="margin-top:10px"><div class="obs-story-eyebrow">同地点の月別観察数</div><div class="obs-seasonal">${
             Array.from({ length: 12 }, (_, i) => {
               const h = heavy.seasonalHistory.find((s) => s.month === i + 1);
               const n = h ? h.count : 0;
               const max = Math.max(...heavy.seasonalHistory.map((s) => s.count), 1);
               return `<span class="obs-seasonal-bar" style="--h:${Math.round((n / max) * 100)}%" title="${i + 1}月: ${n}件"><small>${i + 1}</small></span>`;
             }).join("")
           }</div></div>` : ""}
         </div>` : "";

    const featuresSub = (grouped.coexistingTaxa.length > 0 || grouped.sounds.length > 0 || grouped.environment.length > 0)
      ? `<div class="obs-details-sub">
           <h4>写真と音声から拾えたこと</h4>
           ${grouped.coexistingTaxa.length > 0 ? `<details class="obs-fold" open><summary>🌿 同地点の生きもの <span class="obs-fold-count">${grouped.coexistingTaxa.length}</span></summary><ul class="obs-chips">${renderFeatureChips(grouped.coexistingTaxa)}</ul></details>` : ""}
           ${grouped.sounds.length > 0 ? `<details class="obs-fold"><summary>🎤 音声で拾った <span class="obs-fold-count">${grouped.sounds.length}</span></summary><ul class="obs-chips">${renderFeatureChips(grouped.sounds)}</ul></details>` : ""}
           ${grouped.environment.length > 0 ? `<details class="obs-fold"><summary>🏞️ 環境の情報 <span class="obs-fold-count">${grouped.environment.length}</span></summary><ul class="obs-chips">${renderFeatureChips(grouped.environment)}</ul></details>` : ""}
         </div>` : "";

    const aiEnvSub = obsContext && (obsContext.environmentContexts.length > 0 || obsContext.seasonalNotes.length > 0)
      ? `<div class="obs-details-sub">
           <h4>🤖 AI が読み取った様子</h4>
           ${obsContext.environmentContexts.map((e) => `<p>${escapeHtml(e)}</p>`).join("")}
           ${obsContext.seasonalNotes.map((e) => `<p>${escapeHtml(e)}</p>`).join("")}
         </div>` : "";

    const observerSub = observerStats
      ? `<div class="obs-details-sub">
           <h4>あなたの観察フットプリント</h4>
           <div class="obs-footprint">
             <div class="obs-footprint-row"><span class="obs-footprint-num">#${observerStats.totalObservations}</span><span class="obs-footprint-label">累計記録</span></div>
             <div class="obs-footprint-row"><span class="obs-footprint-num">${observerStats.thisMonthObservations}</span><span class="obs-footprint-label">今月の記録</span></div>
             ${observerStats.placeVisitCount > 1 ? `<div class="obs-footprint-row"><span class="obs-footprint-num">${observerStats.placeVisitCount}</span><span class="obs-footprint-label">この場所</span></div>` : ""}
             ${observerStats.currentStreakDays > 1 ? `<div class="obs-footprint-row"><span class="obs-footprint-num">${observerStats.currentStreakDays}</span><span class="obs-footprint-label">連続日数</span></div>` : ""}
           </div>
         </div>` : "";

    const stopReasonSub = aiAssessment && aiAssessment.stopReason
      ? `<div class="obs-details-sub"><h4>ここで止めておく理由</h4><p>${escapeHtml(aiAssessment.stopReason)}</p></div>`
      : "";
    const observerBoostSub = aiAssessment && aiAssessment.observerBoost
      ? `<div class="obs-details-sub"><h4>この観察ですでに助かるところ</h4><p>${escapeHtml(aiAssessment.observerBoost)}</p></div>`
      : "";

    const detailsBlocks = [placeSeasonSub, nearbySub, featuresSub, aiEnvSub, observerSub, stopReasonSub, observerBoostSub].filter(Boolean).join("");
    const detailsAccordion = detailsBlocks
      ? `<details class="obs-details-acc">
           <summary>📚 詳細情報・エリア推察</summary>
           <div class="obs-details-body">${detailsBlocks}</div>
         </details>` : "";

    const reassessScript = isOwner
      ? `<script>(function(){
           var buttons = Array.prototype.slice.call(document.querySelectorAll('.obs-reassess-btn[data-reassess-endpoint]'));
           if (!buttons.length) return;
           var statusEl = document.querySelector('[data-reassess-status]');
           var setBusy = function(disabled) { buttons.forEach(function(b){ b.disabled = disabled; }); };
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

    // 表示順:
    //   1) heroBlock (写真 + タイトル + メタ + リアクション)
    //   2) aiHintBlock (見分け方 + 紛らわしい種 + 写真の手がかり + 次に撮るべき写真 + 豆知識)
    //   3) ownerNoteBlock (観察者メモ)
    //   4) subjectsBlock (組写真カバレッジ)
    //   5) insightBlock (この生きものについて — 1個に圧縮)
    //   6) idBlock (同定セクション)
    //   7) actionRail (アイコンボタン1行 + reassess)
    //   8) detailsAccordion (折り畳み: エリア推察・場所季節・共生種・観察者統計)
    const detailBody = `${heroBlock}<div class="obs-flow">${aiHintBlock}${ownerNoteBlock}${subjectsBlock}${insightBlock}${idBlock}${actionRail}${detailsAccordion}</div>${reassessScript}`;

    reply.type("text/html; charset=utf-8");
    return layout(
      basePath,
      `${snapshot.displayName} | ikimon`,
      detailBody,
      "みつける",
      {
        eyebrow: "観察",
        heading: escapeHtml(snapshot.displayName),
        headingHtml: "",
        lead: "",
        actions: [],
      },
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
    const places = snapshot.recentPlaces.map((place) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(place.placeName)}</div>
          <div class="meta">${escapeHtml(place.municipality || "自治体不明")} · ${escapeHtml(place.lastObservedAt)}</div>
        </div>
        <span class="pill">${place.visitCount} 回</span>
      </div>`).join("");
    const observations = snapshot.recentObservations.map((item) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, `/observations/${encodeURIComponent(item.occurrenceId)}`))}">
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
        headingHtml: escapeHtml(snapshot.displayName),
        lead: `この人のフィールドノート — 最近の場所と観察を追う。`,
        actions: [
          { href: `/home?userId=${encodeURIComponent(snapshot.userId)}`, label: "このユーザーのホームを見る" },
        ],
      },
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
    const places = snapshot.recentPlaces.map((place) => `
      <div class="row">
        <div>
          <div style="font-weight:800">${escapeHtml(place.placeName)}</div>
          <div class="meta">${escapeHtml(place.municipality || "自治体不明")} · ${escapeHtml(place.lastObservedAt)}</div>
        </div>
        <span class="pill">${place.visitCount} 回</span>
      </div>`).join("");
    const observations = snapshot.recentObservations.map((item) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, `/observations/${encodeURIComponent(item.occurrenceId)}`))}">
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
        headingHtml: escapeHtml(snapshot.displayName),
        lead: `${snapshot.rankLabel || "Observer"} — あなたのフィールドノートと場所の記録。`,
        actions: [
          { href: "/notes", label: "ノートへ" },
          { href: "/home", label: "ホームへ", variant: "secondary" as const },
        ],
      },
    );
  });

  app.get("/specialist/id-workbench", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const session = await getSessionFromCookie(request.headers.cookie);
    try {
      assertSpecialistSession(session, session?.userId ?? "");
    } catch {
      reply.code(403).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Specialist access required",
        stateCard(
          "Specialist only",
          "この画面は専門家ロール専用です",
          `<p style="margin:0 0 12px">レビュー queue と同定 workbench は、サインイン済みの専門家アカウントからのみ閲覧できます。</p>
          <div class="actions" style="margin-top:16px">
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
    const snapshot = await getSpecialistSnapshot(lane);
    const laneTitle =
      lane === "public-claim"
        ? "Public Claim Lane"
        : lane === "expert-lane"
          ? "Expert Lane"
          : "Identification Workbench";
    const rows = snapshot.queue.map((item) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, `/observations/${encodeURIComponent(item.occurrenceId)}`))}">
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
      `<section class="section"><div class="card"><div class="card-body">
          <div class="eyebrow">Action</div>
          <h2>Minimal specialist action</h2>
          <form id="specialist-review-form" class="stack" style="margin-top:14px">
            <input name="actorUserId" type="hidden" value="${escapeHtml(reviewerUserId)}" />
            <div class="row"><div><strong>Signed in reviewer</strong><div class="meta">${escapeHtml(reviewerUserId)}</div></div><span class="pill">${escapeHtml(session?.rankLabel || session?.roleName || "specialist")}</span></div>
            <label class="stack"><span style="font-weight:700">Occurrence ID</span><input name="occurrenceId" type="text" placeholder="occ:..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <label class="stack"><span style="font-weight:700">Proposed name</span><input name="proposedName" type="text" placeholder="Scientific or common name" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            <label class="stack"><span style="font-weight:700">Proposed rank</span><input name="proposedRank" type="text" value="species" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" /></label>
            <label class="stack"><span style="font-weight:700">Note</span><textarea name="notes" rows="3" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8"></textarea></label>
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
            const proposedName = String(data.get('proposedName') || '');
            const proposedRank = String(data.get('proposedRank') || '');
            const notes = String(data.get('notes') || '');
            const decision = button.getAttribute('data-decision');
            if (!occurrenceId || !actorUserId) {
              setStatus('<div class="row"><div>occurrenceId と actorUserId は必須です。</div></div>');
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
            setStatus('<div class="row"><div><strong>Review saved.</strong><div class="meta">' + String(json.decision || decision) + ' · ' + String(json.occurrenceId || occurrenceId) + '</div></div></div>');
          });
        });
      </script>`,
      "ホーム",
      {
        eyebrow: "専門家向け",
        heading: laneTitle,
        headingHtml: escapeHtml(laneTitle),
        lead: "観察の正式な同定や確認を行う、専門家向けの作業画面です。一般の方にはこの画面は表示されません。",
        actions: [
          { href: "/specialist/id-workbench?lane=public-claim", label: "公開同定" },
          { href: "/specialist/id-workbench?lane=expert-lane", label: "Expert lane", variant: "secondary" as const },
          { href: "/specialist/review-queue", label: "レビュー待ち", variant: "secondary" as const },
        ],
      },
    );
  });

  app.get("/specialist/review-queue", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const session = await getSessionFromCookie(request.headers.cookie);
    try {
      assertSpecialistSession(session, session?.userId ?? "");
    } catch {
      reply.code(403).type("text/html; charset=utf-8");
      return layout(
        basePath,
        "Specialist access required",
        stateCard(
          "Specialist only",
          "この画面は専門家ロール専用です",
          `<p style="margin:0 0 12px">レビュー queue は一般公開しません。</p>
          <div class="actions" style="margin-top:16px">
            <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/"))}">トップへ戻る</a>
          </div>`,
        ),
        "ホーム",
      );
    }
    const snapshot = await getSpecialistSnapshot("review-queue");
    const reviewerUserId = session?.userId ?? "";
    const rows = snapshot.queue.map((item) => `
      <a class="row" href="${escapeHtml(withBasePath(basePath, `/observations/${encodeURIComponent(item.occurrenceId)}`))}">
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
      `<section class="section"><div class="card"><div class="card-body">
          <div class="eyebrow">Action</div>
          <h2>Minimal review action</h2>
          <form id="review-queue-form" class="stack" style="margin-top:14px">
            <input name="actorUserId" type="hidden" value="${escapeHtml(reviewerUserId)}" />
            <div class="row"><div><strong>Signed in reviewer</strong><div class="meta">${escapeHtml(reviewerUserId)}</div></div><span class="pill">${escapeHtml(session?.rankLabel || session?.roleName || "specialist")}</span></div>
            <label class="stack"><span style="font-weight:700">Occurrence ID</span><input name="occurrenceId" type="text" placeholder="occ:..." style="padding:12px;border-radius:14px;border:1px solid #d8e6d8" required /></label>
            <label class="stack"><span style="font-weight:700">Note</span><textarea name="notes" rows="3" style="padding:12px;border-radius:14px;border:1px solid #d8e6d8"></textarea></label>
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
            const notes = String(data.get('notes') || '');
            const decision = button.getAttribute('data-decision');
            if (!occurrenceId || !actorUserId) {
              setStatus('<div class="row"><div>occurrenceId と actorUserId は必須です。</div></div>');
              return;
            }
            setStatus('<div class="row"><div>Submitting review action...</div></div>');
            const response = await fetch(withBasePath('/api/v1/specialist/occurrences/' + encodeURIComponent(occurrenceId) + '/review'), {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify({ actorUserId, lane: 'review-queue', decision, notes }),
            });
            const json = await response.json();
            if (!response.ok || json.ok === false) {
              setStatus('<div class="row"><div>Submit failed.<div class="meta">' + String(json.error || 'specialist_review_failed') + '</div></div></div>');
              return;
            }
            setStatus('<div class="row"><div><strong>Review saved.</strong><div class="meta">' + String(json.decision || decision) + ' · ' + String(json.occurrenceId || occurrenceId) + '</div></div></div>');
          });
        });
      </script>`,
      "ホーム",
      {
        eyebrow: "専門家向け",
        heading: "レビュー待ちの観察",
        headingHtml: "レビュー待ちの観察",
        lead: "公開同定に進める前に、専門家が内容を確認するための画面です。",
        actions: [
          { href: "/specialist/id-workbench?lane=expert-lane", label: "Expert lane" },
          { href: "/specialist/id-workbench?lane=public-claim", label: "公開同定", variant: "secondary" as const },
        ],
      },
    );
  });

  /* -------------------------------------------------------------- */
  /* Field Note main entry (/notes) — user's own notebook           */
  /* -------------------------------------------------------------- */
  app.get("/notes", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const session = await getSessionFromCookie(request.headers.cookie);
    const { viewerUserId } = resolveViewer(request.query, session);
    const snapshot = await getLandingSnapshot(viewerUserId);

    const isLoggedIn = Boolean(viewerUserId);
    const ownCards = snapshot.myFeed
      .map((obs) => renderObservationCard(basePath, lang, obs))
      .join("");
    const nearbyCards = snapshot.feed
      .slice(0, 9)
      .map((obs) => renderObservationCard(basePath, lang, obs, { compact: true }))
      .join("");

    const emptyCopy = lang === "ja"
      ? "まだノートは真っ白です。1 件記録すると、あなたの観察がここに積み上がります。"
      : "The notebook is blank. Record one observation to stack pages here.";
    const nearbyCopy = lang === "ja" ? "近くで書かれているノート" : "Nearby pages";
    const myCopy = lang === "ja" ? "あなたのノート" : "Your pages";

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lang === "ja" ? "フィールドノート | ikimon" : "Field Note | ikimon",
      activeNav: lang === "ja" ? "ホーム" : "Home",
      lang,
      extraStyles: `${OBSERVATION_CARD_STYLES}
        .notes-page { margin-top: 24px; }
        .notes-head { display: flex; flex-direction: column; gap: 8px; justify-content: flex-start; align-items: flex-start; margin-bottom: 16px; }
        .notes-head h2 { margin: 0; }
        .notes-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
        .notes-grid.is-compact { grid-template-columns: 1fr; gap: 12px; }
      `,
      hero: {
        eyebrow: lang === "ja" ? "あなたの 1 冊" : "Your notebook",
        heading: lang === "ja" ? "📖 フィールドノート" : "📖 Field Note",
        headingHtml: lang === "ja" ? "📖 フィールドノート" : "📖 Field Note",
        lead: lang === "ja"
          ? "あなたの観察が積み上がるノート。あとから読み返すほど、同じ道が違って見えてきます。"
          : "Your notebook where observations stack up. The more you re-read it, the more the same path changes.",
        tone: "light",
        align: "center",
        actions: [
          { href: "/record", label: lang === "ja" ? "続きを書く" : "Keep writing" },
          { href: "/map", label: lang === "ja" ? "マップで見る" : "See on the map", variant: "secondary" as const },
        ],
      },
      body: `<section class="section notes-page">
        <div class="notes-head"><div><h2>${escapeHtml(myCopy)}</h2></div></div>
        ${isLoggedIn
          ? (ownCards
              ? `<div class="notes-grid">${ownCards}</div>`
              : `<div class="onboarding-empty">
                  <div class="eyebrow">${escapeHtml(lang === "ja" ? "まだ 0 ページ" : "0 pages so far")}</div>
                  <h3>${escapeHtml(lang === "ja" ? "最初の 1 枚を書いてみる" : "Write your first page")}</h3>
                  <p>${escapeHtml(lang === "ja" ? "名前が分からなくても大丈夫。場所とメモだけで、あとから読み返せる記録になります。" : "You don't need the name. Place and a note is enough to make something worth revisiting.")}</p>
                  <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/record"))}">${escapeHtml(lang === "ja" ? "観察を記録する" : "Record an observation")}</a>
                </div>`)
          : `<div class="onboarding-empty">
              <div class="eyebrow">${escapeHtml(lang === "ja" ? "ゲスト" : "Guest")}</div>
              <h3>${escapeHtml(lang === "ja" ? "ノートを始める" : "Start a notebook")}</h3>
              <p>${escapeHtml(lang === "ja" ? "記録すると、あなた専用のフィールドノートがここに積み上がります。" : "Start recording and your personal field notebook will build up here.")}</p>
              <a class="btn btn-solid" href="${escapeHtml(withBasePath(basePath, "/record"))}">${escapeHtml(lang === "ja" ? "観察を記録する" : "Record an observation")}</a>
            </div>`}
      </section>
      <section class="section notes-page">
        <div class="notes-head"><div><h2>${escapeHtml(nearbyCopy)}</h2></div></div>
        ${nearbyCards
          ? `<div class="notes-grid is-compact">${nearbyCards}</div>`
          : `<div class="card"><div class="card-body"><p class="meta">${escapeHtml(emptyCopy)}</p></div></div>`}
      </section>`,
      footerNote: lang === "ja" ? "フィールドノート — 歩いて、見つけて、1 冊に残す。" : "Field Note — walk, find, write it in one notebook.",
    });
  });

  /* -------------------------------------------------------------- */
  /* AI Lens entry (/lens) — marketing + CTA into /record           */
  /* -------------------------------------------------------------- */
  app.get("/lens", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const recordHref = appendLangToHref(withBasePath(basePath, "/record"), lang);
    const notesHref = appendLangToHref(withBasePath(basePath, "/notes"), lang);
    const mapHref = appendLangToHref(withBasePath(basePath, "/map"), lang);

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lang === "ja" ? "フィールドガイド | ikimon" : "Field Guide | ikimon",
      activeNav: lang === "ja" ? "ホーム" : "Home",
      lang,
      hero: {
        eyebrow: lang === "ja" ? "歩きながら、世界を読み解く" : "Read the world around you as you walk",
        heading: lang === "ja" ? "🔍 フィールドガイド" : "🔍 Field Guide",
        headingHtml: lang === "ja" ? "🔍 フィールドガイド" : "🔍 Field Guide",
        lead: lang === "ja"
          ? "散歩中に気になったものにカメラを向けると、AI が何かを教えてくれます。名前が分からなくても、その場で写真と場所を記録として残せます。"
          : "Point your camera at anything that catches your eye — the AI will offer clues. Even without a name, you can save the photo and location as a record.",
        tone: "light",
        align: "center",
        actions: [
          { href: "/record", label: lang === "ja" ? "このまま記録する" : "Record this now" },
          { href: "/notes", label: lang === "ja" ? "ノートへ戻る" : "Back to Field Note", variant: "secondary" as const },
        ],
      },
      body: `<section class="section">
        <div class="list">
          <div class="row"><div><strong>${escapeHtml(lang === "ja" ? "1. まず写真かメモを残す" : "1. Save a photo or note first")}</strong><div class="meta">${escapeHtml(lang === "ja" ? "分からなくても構いません。場所・時刻・見た印象を失わないことが先です。" : "Do not wait for certainty. Preserve place, time, and first impression.")}</div></div></div>
          <div class="row"><div><strong>${escapeHtml(lang === "ja" ? "2. AI が出した名前より『次に何を確認すればいいか』を見る" : "2. Look for what to check next, not just the name")}</strong><div class="meta">${escapeHtml(lang === "ja" ? "名前が合っているかどうかより、次に確認すべきポイントを絞るのがここの使い方です。" : "The useful part is not certainty but what to check next.")}</div></div></div>
          <div class="row"><div><strong>${escapeHtml(lang === "ja" ? "3. 気づいたことを record 画面で記録として残す" : "3. Save the observation in the record screen")}</strong><div class="meta">${escapeHtml(lang === "ja" ? "このページだけでは記録は保存されません。写真と場所は record 画面で 1 件にまとめて残してください。" : "This page does not save records. Save your photo and location in the record screen.")}</div></div></div>
        </div>
      </section>
      <section class="section">
        <div class="grid">
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "向いている場面" : "Best for")}</div><h2>${escapeHtml(lang === "ja" ? "道端で名前が気になったとき" : "When you wonder what something is in the field")}</h2><p>${escapeHtml(lang === "ja" ? "その場で調べ込むより、とりあえず記録しておいて後から確認したいときに向いています。" : "Use it when it is better to keep moving and look it up later.")}</p></div></div>
          <details class="card"><summary style="padding:16px 20px;cursor:pointer;font-weight:700">${escapeHtml(lang === "ja" ? "期待しすぎないこと" : "Limitations")}</summary><div class="card-body" style="padding-top:0"><p>${escapeHtml(lang === "ja" ? "正確な名前を自動で確定する機能ではありません。候補と手がかりを返す補助として使ってください。名前の確定はコミュニティの合意で決まります。" : "This does not automatically confirm a name. Use it as a hint, not a verdict. Names are confirmed by the community.")}</p></div></details>
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "次の一歩" : "Next step")}</div><h2>${escapeHtml(lang === "ja" ? "写真と場所を record 画面で残す" : "Save photo and location in the record screen")}</h2><p>${escapeHtml(lang === "ja" ? "このページ単体では記録は残りません。場所・時刻・写真は record 画面で 1 件にまとめてください。" : "This page does not save records. Go to the record screen to save place, time, and photo.")}</p><div class="actions" style="margin-top:12px"><a class="btn btn-solid" href="${escapeHtml(recordHref)}">${escapeHtml(lang === "ja" ? "記録する" : "Record")}</a></div></div></div>
        </div>
      </section>
      <section class="section">
        <div class="grid">
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "記録の置き場所" : "Where records live")}</div><h2>${escapeHtml(lang === "ja" ? "このページで記録は完結しない" : "This page does not complete the record")}</h2><p>${escapeHtml(lang === "ja" ? "散歩中に見たものは、record 画面で写真・場所・メモを 1 件にまとめて残します。そこに残った記録が、あとで読み返せる観察になります。" : "Save what you saw in the record screen — photo, location, and note together. That is what becomes a revisitable observation.")}</p><p class="meta" style="margin-top:10px">${escapeHtml(lang === "ja" ? "記録を残す場所は record、積み重ねて読み返す場所は notes です。" : "Record is where you save. Notes is where you revisit.")}</p><div class="actions" style="margin-top:12px"><a class="inline-link" href="${escapeHtml(notesHref)}">${escapeHtml(lang === "ja" ? "記録一覧を見る" : "View notes")}</a></div></div></div>
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "どこを歩くか迷っているなら" : "Not sure where to walk?")}</div><h2>${escapeHtml(lang === "ja" ? "先に地図で場所を選ぶ" : "Choose a place on the map first")}</h2><p>${escapeHtml(lang === "ja" ? "名前を調べるより先に、どこを歩くか決まっていないなら地図で確認してから出発する方がスムーズです。" : "If you have not decided where to walk yet, checking the map first makes things smoother.")}</p><p class="meta" style="margin-top:10px">${escapeHtml(lang === "ja" ? "このページが『その場で見たものを調べる入口』なら、地図は『次にどこへ行くかを決める入口』です。" : "This page is for identifying what you see. The map is for deciding where to go next.")}</p><div class="actions" style="margin-top:12px"><a class="inline-link" href="${escapeHtml(mapHref)}">${escapeHtml(lang === "ja" ? "マップで場所を見る" : "See on the map")}</a></div></div></div>
        </div>
      </section>`,
      footerNote: lang === "ja" ? "カメラで見たものを AI が分析します。名前の確定より、まずその場の記録を残すことを優先してください。" : "The AI analyzes what your camera sees. Prioritize saving the record over getting the name right.",
    });
  });

  /* -------------------------------------------------------------- */
  /* Field Scan entry (/scan) — marketing + CTA into map/explore    */
  /* -------------------------------------------------------------- */
  app.get("/scan", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const mapHref = appendLangToHref(withBasePath(basePath, "/map"), lang);
    const exploreHref = appendLangToHref(withBasePath(basePath, "/explore"), lang);

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lang === "ja" ? "フィールドスキャン | ikimon" : "Field Scan | ikimon",
      activeNav: lang === "ja" ? "ホーム" : "Home",
      lang,
      hero: {
        eyebrow: lang === "ja" ? "次にどこへ行くか決める" : "Decide where to go next",
        heading: lang === "ja" ? "📡 フィールドスキャン" : "📡 Field Scan",
        headingHtml: lang === "ja" ? "📡 フィールドスキャン" : "📡 Field Scan",
        lead: lang === "ja"
          ? "以前歩いたことがある場所に、また行く理由を見つけるためのページです。地図で記録が積み上がっている場所を確認して、次の散歩先を決めます。"
          : "Use this page to find a reason to return somewhere you have walked before. Check the map and decide where to go next.",
        tone: "light",
        align: "center",
        actions: [
          { href: "/map", label: lang === "ja" ? "マップで見る" : "See on the map" },
          { href: "/notes", label: lang === "ja" ? "ノートへ戻る" : "Back to notebook", variant: "secondary" as const },
        ],
      },
      body: `<section class="section">
        <div class="list">
          <div class="row"><div><strong>${escapeHtml(lang === "ja" ? "1. 地図でどの場所に記録が多いか見る" : "1. See which places have the most records on the map")}</strong><div class="meta">${escapeHtml(lang === "ja" ? "記録が多い場所・少ない場所の偏りから、次に歩く候補が見つかります。" : "Clusters and gaps on the map show you where to go next.")}</div></div></div>
          <div class="row"><div><strong>${escapeHtml(lang === "ja" ? "2. そこで何が見られているかをざっくり確認する" : "2. Get a rough sense of what has been seen there")}</strong><div class="meta">${escapeHtml(lang === "ja" ? "細かい名前より、その場所の雰囲気をつかむ感覚で見てください。" : "Focus on the feel of the place, not precise identification.")}</div></div></div>
          <div class="row"><div><strong>${escapeHtml(lang === "ja" ? "3. 歩く場所が決まったら、実際の観察を record 画面で記録する" : "3. Once you decide where to go, record observations in the record screen")}</strong><div class="meta">${escapeHtml(lang === "ja" ? "このページには記録を保存する機能がありません。実際に歩いて見たものは record 画面で残してください。" : "This page does not save records. Use the record screen to save what you actually observe.")}</div></div></div>
        </div>
      </section>
      <section class="section">
        <div class="grid">
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "向いている場面" : "Best for")}</div><h2>${escapeHtml(lang === "ja" ? "今日どこを歩くか迷っているとき" : "When you are not sure where to walk today")}</h2><p>${escapeHtml(lang === "ja" ? "前に行ったことがある場所にまた行く理由を見つけたいとき、次の 20 分をどこで過ごすか決めるのに向いています。" : "Use it when you want a reason to return somewhere, or to decide where to spend the next 20 minutes.")}</p><p class="meta" style="margin-top:10px">${escapeHtml(lang === "ja" ? "たとえば、今日は水辺側へ寄るか、公園の奥まで入るか、住宅地の縁を回るかを、ここで確認してから出発できます。" : "Decide today — waterside, deep park, or neighborhood edge — before you set out.")}</p></div></div>
          <details class="card"><summary><div class="card-body"><strong>${escapeHtml(lang === "ja" ? "期待しすぎないこと" : "Limitations")}</strong></div></summary><div class="card-body" style="padding-top:0"><p>${escapeHtml(lang === "ja" ? "このページには記録を保存する機能がありません。場所を決める入口として使い、実際の観察は record 画面で残してください。" : "This page does not save records. Use it to choose a place, then record your observations in the record screen.")}</p></div></details>
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "次の一歩" : "Next step")}</div><h2>${escapeHtml(lang === "ja" ? "マップで場所を決めて、そこで記録する" : "Pick a place on the map, then go record")}</h2><p>${escapeHtml(lang === "ja" ? "行き先が決まったら、実際にその場所を歩いて record 画面で 1 件記録してください。" : "Once you choose a place, go there and save at least one observation in the record screen.")}</p><div class="actions" style="margin-top:12px"><a class="btn btn-solid" href="${escapeHtml(mapHref)}">${escapeHtml(lang === "ja" ? "マップで見る" : "See on the map")}</a></div></div></div>
        </div>
      </section>
      <section class="section">
        <div class="grid">
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "使い方の流れ" : "How it fits in")}</div><h2>${escapeHtml(lang === "ja" ? "場所を決めて、そこで実際に記録する" : "Choose a place, then go record there")}</h2><p>${escapeHtml(lang === "ja" ? "ここで気になる場所を見つけたら、次のステップはその場所を実際に歩いて観察を 1 件残すことです。" : "Once you find an interesting place here, the next step is to walk there and save an observation.")}</p><p class="meta" style="margin-top:10px">${escapeHtml(lang === "ja" ? "場所を決める → 歩く → 記録する。この順番がikimon の基本的な使い方です。" : "Choose a place → walk → record. That is the basic flow.")}</p><div class="actions" style="margin-top:12px"><a class="inline-link" href="${escapeHtml(exploreHref)}">${escapeHtml(lang === "ja" ? "場所と種の広がりを見る" : "Browse place and species spread")}</a></div></div></div>
          <div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(lang === "ja" ? "実際に残すなら" : "Ready to record?")}</div><h2>${escapeHtml(lang === "ja" ? "record 画面で写真と場所を残す" : "Save photo and location in the record screen")}</h2><p>${escapeHtml(lang === "ja" ? "場所が決まったら、その場の写真・時刻・メモを record 画面で 1 件にまとめてください。" : "Once you choose a place, save the photo, time, and note in the record screen.")}</p><p class="meta" style="margin-top:10px">${escapeHtml(lang === "ja" ? "ここで場所を決め、record で記録し、records に積み上げる。この繰り返しが散歩を観察に変えます。" : "Choose here, record there, accumulate in notes — the cycle that turns walks into observations.")}</p><div class="actions" style="margin-top:12px"><a class="inline-link" href="${escapeHtml(withBasePath(basePath, "/record"))}">${escapeHtml(lang === "ja" ? "記録する" : "Record")}</a></div></div></div>
        </div>
      </section>`,
      footerNote: lang === "ja" ? "次の散歩先を決めるためのページです。記録そのものは record 画面で残してください。" : "Use this page to decide where to walk next. Save your actual observations in the record screen.",
    });
  });

  /* -------------------------------------------------------------- */
  /* Map (/map) — full Map Explorer (tabs, filters, basemaps, xlinks)*/
  /* -------------------------------------------------------------- */
  app.get("/map", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));

    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 10; y -= 1) years.push(y);

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lang === "ja" ? "探索マップ | ikimon" : "Explore Map | ikimon",
      activeNav: lang === "ja" ? "ホーム" : "Home",
      lang,
      extraStyles: MAP_EXPLORER_STYLES,
      // Deliberately no hero: a map page should land on the map, not on
      // a wall of text. The explorer component carries a tight eyebrow
      // strip at the top so context is still one line away.
      body: `${renderMapExplorer({ basePath, lang, years })}
${mapExplorerBootScript({ basePath, lang })}`,
      footerNote: lang === "ja"
        ? "観察の広がりを、次に歩く理由に変える地図。"
        : "A map that turns the spread of observations into your next reason to walk.",
    });
  });

  app.get("/guide", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lang === "ja" ? "フィールドガイド | ikimon" : "Field Guide | ikimon",
      activeNav: lang === "ja" ? "フィールドガイド" : "Field Guide",
      lang,
      extraStyles: GUIDE_FLOW_STYLES,
      body: renderGuideFlow(basePath, lang),
      footerNote: lang === "ja"
        ? "映像と音声で、土地の物語を聴く。"
        : "Listen to the land's story through video and sound.",
    });
  });
}

// Keep the legacy mini map exports accessible so TypeScript doesn't mark them unused.
void MAP_MINI_STYLES;
void mapMiniBootScript;
void renderMapMini;
void toMapPoints;
void getLandingSnapshot;
