import type { ObservationDetailSnapshot } from "../services/readModels.js";
import type { ObservationVisitSubject, SubjectMediaRegionView } from "../services/observationVisitBundle.js";
import { toThumbnailUrl } from "../services/thumbnailUrl.js";
import { escapeHtml } from "./siteShell.js";

type PhotoAsset = ObservationDetailSnapshot["photoAssets"][number];
type VideoAsset = ObservationDetailSnapshot["videoAssets"][number];
type AudioAsset = ObservationDetailSnapshot["audioAssets"][number];
type MediaRoleView = "primary_subject" | "context" | "sound_motion" | "secondary_candidate";
type RegionSwitchMap = Record<string, Array<{
  assetId: string;
  rect: SubjectMediaRegionView["rect"];
  note: string | null;
  confidenceScore: number | null;
}>>;

export type ObservationMediaAnnotationTarget = {
  key: string;
  occurrenceId: string | null;
  candidateId: string | null;
  displayName: string;
  roleLabel: string;
  trustLabel: string;
  proposalKind: "none" | "community_subject" | "ai_candidate";
  adoptEndpoint: string | null;
  regions: SubjectMediaRegionView[];
};

const MEDIA_ROLE_LABELS: Record<MediaRoleView, string> = {
  primary_subject: "主対象",
  context: "周囲",
  sound_motion: "音・動き",
  secondary_candidate: "別対象候補",
};

export const REGION_DISPLAY_CONF_MIN = 0.5;
export const REGION_LARGE_AREA_MIN = 0.55;
export const OBSERVATION_REGION_SUMMARY_TEXT = "写真上の位置は参考情報です。対象の切り替えは下の一覧から行えます。";

export const OBSERVATION_MEDIA_STYLES = `
  .obs-hero-gallery { display: grid; gap: 10px; border-radius: 20px; background: #ffffff; border: 1px solid rgba(15,23,42,.08); padding: 8px; box-shadow: 0 18px 42px rgba(15,23,42,.07); }
  .obs-hero-preview { position: relative; display: flex; align-items: center; justify-content: center; min-height: clamp(420px, 68vh, 680px); border-radius: 16px; overflow: hidden; background: #f8fafc; cursor: zoom-in; }
  .obs-hero-image-frame { position: relative; display: inline-block; max-width: 100%; max-height: min(68vh, 680px); }
  .obs-hero-image-frame img { width: auto; height: auto; max-width: 100%; max-height: min(68vh, 680px); object-fit: contain; display: block; }
  .obs-hero-preview .obs-region-layer { position: absolute; inset: 0; pointer-events: none; }
  .obs-hero-zoom { position: absolute; top: 14px; right: 14px; width: 44px; height: 44px; border-radius: 50%; background: rgba(15,23,42,.78); color: #fff; border: 0; display: grid; place-items: center; cursor: pointer; transition: transform .18s ease, background .18s ease; box-shadow: 0 6px 16px rgba(0,0,0,.28); }
  .obs-hero-zoom:hover { background: #0f172a; transform: scale(1.06); }
  .obs-hero-zoom svg { width: 22px; height: 22px; stroke: currentColor; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  .obs-hero-thumbs { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .obs-hero-thumb { flex: 0 0 76px; width: 76px; border: 0; padding: 0; aspect-ratio: 1/1; border-radius: 10px; overflow: hidden; cursor: pointer; position: relative; background: none; opacity: .78; transition: opacity .18s ease, transform .18s ease, box-shadow .18s ease; box-shadow: 0 0 0 1px rgba(15,23,42,.08); }
  .obs-hero-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .22s ease; }
  .obs-hero-thumb:hover { opacity: 1; transform: translateY(-2px); }
  .obs-hero-thumb:hover img { transform: scale(1.06); }
  .obs-hero-thumb:focus-visible { outline: none; opacity: 1; box-shadow: 0 0 0 3px rgba(16,185,129,.75); }
  .obs-hero-thumb.is-active { opacity: 1; box-shadow: 0 0 0 3px #10b981, 0 6px 14px rgba(16,185,129,.3); cursor: default; }
  .obs-hero-thumb-ring { position: absolute; inset: 0; border-radius: inherit; pointer-events: none; }
  .obs-hero-thumb-active-label { position: absolute; left: 6px; right: 6px; bottom: 6px; padding: 3px 4px; border-radius: 6px; background: #10b981; color: #fff; font-size: 10px; font-weight: 900; letter-spacing: .06em; text-align: center; opacity: 0; transition: opacity .18s ease; pointer-events: none; }
  .obs-hero-thumb.is-active .obs-hero-thumb-active-label { opacity: 1; }
  .obs-media-role-badge { display: none; }
  .obs-media-role-badge.is-context { background: rgba(3,105,161,.84); }
  .obs-media-role-badge.is-sound-motion { background: rgba(126,34,206,.84); }
  .obs-media-role-badge.is-secondary-candidate { background: rgba(180,83,9,.86); }
  .obs-media-ai-role { display: none; }
  .obs-hero-thumb .obs-media-role-badge { left: 6px; top: 6px; min-height: 22px; padding: 5px 6px; font-size: 9px; max-width: calc(100% - 12px); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .obs-hero-thumb .obs-media-ai-role { left: 6px; top: auto; right: 6px; bottom: 6px; min-height: 20px; padding: 4px 5px; font-size: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .obs-lightbox { position: fixed; inset: 0; z-index: 9999; background: rgba(8,12,20,.94); display: none; overflow: auto; padding: 72px 16px 56px; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
  .obs-lightbox.is-open { display: block; }
  .obs-lightbox-inner { min-height: 100%; width: 100%; display: flex; align-items: center; justify-content: center; }
  .obs-lightbox-img { display: block; border-radius: 8px; box-shadow: 0 24px 60px rgba(0,0,0,.6); user-select: none; cursor: zoom-in; transition: transform .15s ease; }
  .obs-lightbox-img.is-fit { max-width: calc(100vw - 32px); max-height: calc(100vh - 160px); width: auto; height: auto; }
  .obs-lightbox-img.is-actual { max-width: none; max-height: none; cursor: zoom-out; }
  .obs-lightbox-img.is-dragging { cursor: grabbing; transition: none; }
  .obs-lightbox-close { position: fixed; top: 16px; right: 16px; display: inline-flex; align-items: center; gap: 8px; padding: 12px 22px; border-radius: 999px; background: #fff; color: #0f172a; font-weight: 900; font-size: 15px; border: 0; cursor: pointer; box-shadow: 0 8px 24px rgba(0,0,0,.5); z-index: 10010; transition: transform .18s ease, background .18s ease; }
  .obs-lightbox-close:hover { background: #f1f5f9; transform: scale(1.05); }
  .obs-lightbox-close svg { width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 3; stroke-linecap: round; }
  .obs-lightbox-toggle { position: fixed; top: 16px; left: 16px; display: inline-flex; align-items: center; gap: 8px; padding: 10px 18px; border-radius: 999px; background: rgba(15,23,42,.75); color: #fff; font-weight: 800; font-size: 13px; border: 0; cursor: pointer; box-shadow: 0 6px 16px rgba(0,0,0,.35); z-index: 10010; transition: background .18s ease, transform .18s ease; }
  .obs-lightbox-toggle:hover { background: #0f172a; transform: scale(1.04); }
  .obs-lightbox-toggle svg { width: 16px; height: 16px; stroke: currentColor; fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
  .obs-lightbox-hint { position: fixed; left: 0; right: 0; bottom: 16px; text-align: center; color: rgba(255,255,255,.8); font-size: 12px; font-weight: 700; letter-spacing: .04em; pointer-events: none; z-index: 10010; padding: 0 16px; }
  .obs-hero-media-stack { position: relative; z-index: 1; display: grid; gap: 10px; }
  .obs-hero-photo-stack { display: grid; gap: 10px; }
  .obs-hero-video { display: grid; gap: 8px; }
  .obs-hero-video-frame { position: relative; width: 100%; padding-top: 56.25%; border-radius: 20px; overflow: hidden; background: #020617; }
  .obs-hero-video-frame iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; }
  .obs-hero-video-processing { position: absolute; inset: 0; z-index: 2; display: grid; place-items: center; padding: 18px; background: linear-gradient(180deg, rgba(2,6,23,.82), rgba(15,23,42,.72)); color: #fff; text-align: center; }
  .obs-hero-video-processing strong { display: block; font-size: 15px; line-height: 1.45; }
  .obs-hero-video-processing span { display: block; margin-top: 6px; color: rgba(226,232,240,.9); font-size: 12px; line-height: 1.6; font-weight: 750; }
  .obs-hero-video-meta { display: flex; justify-content: space-between; align-items: center; gap: 10px; font-size: 12px; color: #334155; font-weight: 700; }
  .obs-hero-video-meta-main { display: inline-flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .obs-hero-video-meta .obs-media-role-badge { position: static; min-height: 24px; padding: 5px 9px; font-size: 10px; box-shadow: none; }
  .obs-hero-video-meta .obs-media-ai-role { position: static; min-height: 24px; padding: 5px 9px; font-size: 10px; box-shadow: none; pointer-events: auto; }
  .obs-hero-video-meta a { color: #0369a1; text-decoration: underline; text-underline-offset: 2px; }
  .obs-region-video-note { color: #0369a1; font-size: 11px; font-weight: 800; }
  .obs-region-layer { display: block; }
  .obs-region-box { position: absolute; border: 1px solid rgba(20,184,166,.44); border-radius: 12px; background: transparent; box-shadow: inset 0 0 0 1px rgba(255,255,255,.35); }
  .obs-region-box.is-large-region { background: transparent; border-color: rgba(15,23,42,.16); box-shadow: inset 0 0 0 1px rgba(255,255,255,.42); }
  .obs-region-box-label { display: none; }
  .obs-region-summary { margin: 0; color: #0369a1; font-size: 12px; font-weight: 800; }
  .obs-annotation-layer { display: none; }
  .obs-annotation-target { position: absolute; display: inline-flex; align-items: flex-start; justify-content: flex-start; min-width: 34px; min-height: 34px; padding: 0; border: 1px solid rgba(16,185,129,.34); border-radius: 12px; background: transparent; box-shadow: inset 0 0 0 1px rgba(255,255,255,.32); color: #0f172a; cursor: pointer; pointer-events: auto; transition: transform .14s ease, border-color .14s ease, background .14s ease, box-shadow .14s ease; }
  .obs-annotation-target:hover, .obs-annotation-target:focus-visible { transform: translateY(-1px); border-color: rgba(5,150,105,.82); background: rgba(236,253,245,.09); box-shadow: inset 0 0 0 1px rgba(255,255,255,.5), 0 10px 22px rgba(15,23,42,.12); outline: none; }
  .obs-annotation-target.is-current { border-color: rgba(13,148,136,.5); background: transparent; }
  .obs-annotation-target.is-candidate { border-color: rgba(245,158,11,.46); background: transparent; }
  .obs-annotation-target.is-large-region { background: transparent; border-color: rgba(13,148,136,.3); box-shadow: inset 0 0 0 1px rgba(255,255,255,.32); }
  .obs-annotation-target.is-large-region.is-current { background: transparent; border-color: rgba(13,148,136,.42); }
  .obs-annotation-target.is-large-region.is-candidate { background: transparent; border-color: rgba(245,158,11,.36); }
  .obs-annotation-label { position: absolute; left: 6px; top: 6px; max-width: min(170px, 46vw); display: inline-flex; flex-direction: column; align-items: flex-start; gap: 1px; padding: 5px 8px; border-radius: 10px; background: rgba(15,23,42,.86); color: #fff; text-align: left; box-shadow: 0 8px 20px rgba(15,23,42,.18); opacity: 0; transform: translateY(3px); pointer-events: none; transition: opacity .14s ease, transform .14s ease; }
  .obs-annotation-target:hover .obs-annotation-label, .obs-annotation-target:focus-visible .obs-annotation-label { opacity: 1; transform: translateY(0); }
  .obs-annotation-label strong { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; line-height: 1.15; font-weight: 950; }
  .obs-annotation-label small { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: rgba(226,232,240,.9); font-size: 9.5px; line-height: 1.15; font-weight: 850; }
  .obs-annotation-target.is-annotation-focus { animation: obsAnnotationPulse 1.1s ease 2; }
  .obs-video-annotation-rail { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 0 0; }
  .obs-video-annotation-button { min-height: 36px; display: inline-flex; align-items: center; gap: 6px; padding: 7px 10px; border-radius: 999px; border: 1px solid rgba(15,23,42,.1); background: #fff; color: #0f172a; font: inherit; font-size: 11.5px; line-height: 1.25; font-weight: 900; cursor: pointer; }
  .obs-video-annotation-button:hover, .obs-video-annotation-button:focus-visible { background: #ecfdf5; border-color: rgba(16,185,129,.28); outline: none; }
  .obs-video-annotation-button.is-candidate { background: #fffbeb; border-color: rgba(245,158,11,.24); }
  .obs-video-annotation-button small { color: #64748b; font-weight: 850; }
  @keyframes obsAnnotationPulse { 0%, 100% { box-shadow: 0 0 0 1px rgba(255,255,255,.8), 0 12px 28px rgba(15,23,42,.18); } 50% { box-shadow: 0 0 0 5px rgba(16,185,129,.28), 0 16px 32px rgba(15,23,42,.2); } }
  @media (max-width: 640px) {
    .obs-hero-gallery { gap: 6px; padding: 6px; border-radius: 16px; box-shadow: 0 8px 22px rgba(15,23,42,.06); }
    .obs-hero-preview { min-height: 170px; max-height: 180px; border-radius: 12px; }
    .obs-hero-image-frame { max-height: 180px; }
    .obs-hero-image-frame img { max-height: 180px; }
    .obs-hero-zoom { top: 8px; right: 8px; width: 36px; height: 36px; }
    .obs-hero-zoom svg { width: 18px; height: 18px; }
    .obs-hero-thumbs { display: flex; gap: 5px; overflow-x: auto; scrollbar-width: none; }
    .obs-hero-thumbs::-webkit-scrollbar { display: none; }
    .obs-hero-thumb { flex: 0 0 54px; width: 54px; border-radius: 8px; }
    .obs-hero-thumb-active-label { display: none; }
    .obs-media-role-badge { left: 8px; top: 8px; min-height: 24px; padding: 5px 8px; font-size: 10px; }
    .obs-media-ai-role { left: 8px; top: 38px; min-height: 22px; padding: 4px 7px; font-size: 9px; }
    .obs-hero-video { gap: 6px; }
    .obs-hero-video-frame { border-radius: 16px; }
    .obs-hero-video-meta { display: grid; grid-template-columns: auto 1fr; align-items: center; gap: 4px 8px; font-size: 11px; line-height: 1.25; }
    .obs-hero-video-meta-main { min-width: max-content; white-space: nowrap; }
    .obs-region-video-note { min-width: 0; font-size: 10.5px; line-height: 1.35; }
    .obs-hero-video-meta > a { grid-column: 1 / -1; justify-self: end; font-size: 11px; }
    .obs-region-summary { font-size: 10.5px; line-height: 1.35; }
    .obs-video-annotation-rail { gap: 5px; padding-top: 5px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
    .obs-video-annotation-rail::-webkit-scrollbar { display: none; }
    .obs-video-annotation-button { flex: 0 0 auto; min-height: 32px; padding: 6px 8px; font-size: 10.5px; }
    .obs-video-evidence { gap: 7px; padding: 8px; }
    .obs-video-evidence-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 7px; }
    .obs-video-evidence-frame figcaption { font-size: 9.5px; line-height: 1.25; }
    .obs-annotation-label { left: 4px; top: 4px; max-width: min(132px, 42vw); padding: 4px 6px; }
    .obs-annotation-label strong { font-size: 10px; }
    .obs-annotation-label small { display: none; }
  }
  .obs-audio-evidence { display: grid; gap: 10px; padding: 12px; border-radius: 14px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); }
  .obs-audio-evidence div { display: grid; gap: 2px; }
  .obs-audio-evidence strong { color: #0f172a; font-size: 13px; line-height: 1.35; }
  .obs-audio-evidence span,.obs-audio-evidence p { margin: 0; color: #64748b; font-size: 12px; line-height: 1.55; font-weight: 800; }
  .obs-audio-evidence audio { width: 100%; min-height: 40px; }
  .obs-video-evidence { display: grid; gap: 8px; padding: 10px; border-radius: 12px; background: #f8fafc; border: 1px solid rgba(15,23,42,.08); }
  .obs-video-evidence-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; color: #0f172a; font-size: 12px; font-weight: 900; }
  .obs-video-evidence-head span { color: #64748b; font-size: 11px; font-weight: 800; }
  .obs-video-evidence-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 8px; }
  .obs-video-evidence-frame { margin: 0; display: grid; gap: 4px; }
  .obs-video-evidence-preview { width: 100%; border: 0; padding: 0; border-radius: 8px; background: transparent; cursor: zoom-in; overflow: hidden; }
  .obs-video-evidence-preview:focus-visible { outline: 3px solid rgba(16,185,129,.45); outline-offset: 2px; }
  .obs-video-evidence-frame img { width: 100%; aspect-ratio: 4/3; object-fit: cover; border-radius: 8px; background: #e2e8f0; display: block; }
  .obs-video-evidence-frame figcaption { display: grid; gap: 2px; color: #334155; font-size: 10px; line-height: 1.35; font-weight: 800; }
  .obs-video-evidence-frame small { color: #64748b; font-weight: 750; }
  .obs-frame-subjects { min-height: 18px; display: flex; flex-wrap: wrap; gap: 3px; align-items: flex-start; }
  .obs-frame-subjects span { display: inline-flex; align-items: center; min-height: 18px; padding: 2px 6px; border-radius: 999px; background: #ecfdf5; border: 1px solid rgba(16,185,129,.22); color: #047857; font-size: 9.5px; line-height: 1; font-weight: 950; }
  .obs-frame-preview { position: fixed; inset: 0; z-index: 10020; display: none; align-items: center; justify-content: center; padding: 64px 56px 72px; background: rgba(8,12,20,.94); color: #fff; }
  .obs-frame-preview.is-open { display: flex; }
  .obs-frame-preview-inner { width: min(980px, calc(100vw - 112px)); display: grid; gap: 10px; }
  .obs-frame-preview-stage { width: 100%; max-height: calc(100vh - 176px); display: flex; align-items: center; justify-content: center; overflow: auto; overscroll-behavior: contain; border-radius: 12px; background: #020617; box-shadow: 0 26px 70px rgba(0,0,0,.48); cursor: default; }
  .obs-frame-preview-stage.is-zoomed { display: block; text-align: left; }
  .obs-frame-preview-stage.is-dragging { cursor: grabbing; }
  .obs-frame-preview-img { display: block; max-width: 100%; max-height: calc(100vh - 176px); user-select: none; pointer-events: auto; }
  .obs-frame-preview-stage.is-zoomed .obs-frame-preview-img { max-width: none; max-height: none; margin: 0; }
  .obs-frame-preview-caption { display: inline-flex; width: fit-content; max-width: 100%; padding: 5px 9px; border-radius: 999px; background: rgba(255,255,255,.14); color: rgba(255,255,255,.9); font-size: 12px; font-weight: 900; }
  .obs-frame-preview-close { position: fixed; top: 18px; right: 18px; min-height: 44px; padding: 10px 16px; border: 0; border-radius: 999px; background: #fff; color: #0f172a; font: inherit; font-size: 14px; font-weight: 950; cursor: pointer; box-shadow: 0 10px 28px rgba(0,0,0,.35); }
  .obs-frame-preview-toolbar { position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%); display: inline-flex; align-items: center; gap: 6px; padding: 6px; border-radius: 999px; background: rgba(255,255,255,.94); box-shadow: 0 14px 36px rgba(0,0,0,.34); }
  .obs-frame-preview-button { min-width: 38px; height: 38px; border: 0; border-radius: 999px; background: #f8fafc; color: #0f172a; font: inherit; font-size: 14px; font-weight: 950; cursor: pointer; }
  .obs-frame-preview-button:hover, .obs-frame-preview-button:focus-visible { background: #ecfdf5; outline: none; }
  .obs-frame-preview-nav { position: fixed; top: 50%; transform: translateY(-50%); width: 52px; height: 52px; background: rgba(255,255,255,.94); box-shadow: 0 12px 32px rgba(0,0,0,.3); }
  .obs-frame-preview-prev { left: 16px; }
  .obs-frame-preview-next { right: 16px; }
  .obs-frame-preview-count { min-width: 46px; text-align: center; color: #0f172a; font-size: 13px; font-weight: 950; }
  @media (max-width: 640px) {
    .obs-frame-preview { padding: 58px 12px 76px; }
    .obs-frame-preview-inner { width: 100%; }
    .obs-frame-preview-stage { max-height: calc(100vh - 166px); border-radius: 10px; }
    .obs-frame-preview-img { max-height: calc(100vh - 166px); }
    .obs-frame-preview-nav { top: auto; bottom: 76px; width: 42px; height: 42px; }
    .obs-frame-preview-prev { left: 12px; }
    .obs-frame-preview-next { right: 12px; }
    .obs-frame-preview-toolbar { bottom: 14px; }
    .obs-frame-preview-close { top: 12px; right: 12px; min-height: 40px; }
  }
  .obs-media-ledger { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .obs-media-ledger-item { display: grid; gap: 2px; min-height: 62px; padding: 10px 11px; border-radius: 12px; background: #fff; border: 1px solid rgba(15,23,42,.08); }
  .obs-media-ledger-item strong { display: flex; align-items: center; gap: 6px; color: #0f172a; font-size: 11px; line-height: 1.25; font-weight: 950; }
  .obs-media-ledger-item span { color: #0f172a; font-size: 14px; line-height: 1.2; font-weight: 950; }
  .obs-media-ledger-item small { color: #64748b; font-size: 10.5px; line-height: 1.35; font-weight: 750; }
  @media (max-width: 640px) {
    .obs-media-ledger { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
    .obs-media-ledger-item { min-height: 54px; padding: 7px; border-radius: 10px; }
    .obs-media-ledger-item strong { font-size: 10px; }
    .obs-media-ledger-item span { font-size: 12px; }
    .obs-media-ledger-item small { font-size: 9.5px; }
  }
`;

export function isDisplayableRegion(region: Pick<SubjectMediaRegionView, "rect" | "confidenceScore">): boolean {
  return Boolean(region.rect) && (region.confidenceScore ?? 1) >= REGION_DISPLAY_CONF_MIN;
}

function isLargeRegionRect(rect: SubjectMediaRegionView["rect"]): boolean {
  if (!rect) return false;
  return rect.width * rect.height >= REGION_LARGE_AREA_MIN;
}

export function displayableRegionsForAsset(
  subject: Pick<ObservationVisitSubject, "regions">,
  assetId: string,
): SubjectMediaRegionView[] {
  return subject.regions.filter((region) => region.assetId === assetId && isDisplayableRegion(region));
}

export function renderObservationRegionBoxes(
  subject: Pick<ObservationVisitSubject, "regions">,
  assetId: string,
): string {
  return displayableRegionsForAsset(subject, assetId)
    .map((region) => {
      const rect = region.rect;
      if (!rect) return "";
      const className = `obs-region-box${isLargeRegionRect(rect) ? " is-large-region" : ""}`;
      return `<span class="${className}"
        style="left:${(rect.x * 100).toFixed(2)}%;top:${(rect.y * 100).toFixed(2)}%;width:${(rect.width * 100).toFixed(2)}%;height:${(rect.height * 100).toFixed(2)}%;">
        ${region.note ? `<span class="obs-region-box-label">${escapeHtml(region.note)}</span>` : ""}
      </span>`;
    })
    .join("");
}

function annotationTargetDataAttrs(target: ObservationMediaAnnotationTarget): string {
  const attrs = [
    `data-annotation-target="${escapeHtml(target.key)}"`,
    `data-annotation-label="${escapeHtml(target.displayName)}"`,
  ];
  if (target.occurrenceId) attrs.push(`data-annotation-subject-id="${escapeHtml(target.occurrenceId)}"`);
  if (target.candidateId) attrs.push(`data-annotation-candidate-id="${escapeHtml(target.candidateId)}"`);
  if (target.adoptEndpoint) attrs.push(`data-annotation-propose-endpoint="${escapeHtml(target.adoptEndpoint)}"`);
  return attrs.join(" ");
}

function renderObservationAnnotationButtons(
  targets: ObservationMediaAnnotationTarget[],
  assetId: string,
  currentOccurrenceId: string,
): string {
  return targets
    .flatMap((target) => {
      return target.regions
        .filter((region) => region.assetId === assetId && isDisplayableRegion(region))
        .map((region) => ({ target, region }));
    })
    .slice(0, 14)
    .map(({ target, region }) => {
      const rect = region.rect;
      if (!rect) return "";
      const className = [
        "obs-annotation-target",
        target.occurrenceId === currentOccurrenceId ? "is-current" : "",
        target.proposalKind === "ai_candidate" ? "is-candidate" : "",
        isLargeRegionRect(rect) ? "is-large-region" : "",
      ].filter(Boolean).join(" ");
      const meta = [
        target.roleLabel,
        frameTimeLabel(region.frameTimeMs),
        target.trustLabel,
      ].filter(Boolean).join(" · ");
      return `<button type="button"
        class="${className}"
        style="left:${(rect.x * 100).toFixed(2)}%;top:${(rect.y * 100).toFixed(2)}%;width:${(rect.width * 100).toFixed(2)}%;height:${(rect.height * 100).toFixed(2)}%;"
        aria-label="${escapeHtml(`${target.displayName}を選ぶ`)}"
        ${annotationTargetDataAttrs(target)}>
        <span class="obs-annotation-label"><strong>${escapeHtml(target.displayName)}</strong>${meta ? `<small>${escapeHtml(meta)}</small>` : ""}</span>
      </button>`;
    })
    .join("");
}

function renderVideoAnnotationRail(targets: ObservationMediaAnnotationTarget[], assetId: string): string {
  const entries = targets
    .flatMap((target) => target.regions
      .filter((region) => region.assetId === assetId && isDisplayableRegion(region))
      .map((region) => ({ target, region })))
    .slice(0, 10);
  if (entries.length === 0) return "";
  return `<div class="obs-video-annotation-rail" aria-label="映像に写っている対象">
    ${entries.map(({ target, region }) => {
      const timeLabel = frameTimeLabel(region.frameTimeMs);
      const className = `obs-video-annotation-button${target.proposalKind === "ai_candidate" ? " is-candidate" : ""}`;
      return `<button type="button" class="${className}" ${annotationTargetDataAttrs(target)}>
        <span>${escapeHtml(target.displayName)}</span>
        ${timeLabel ? `<small>${escapeHtml(timeLabel)}</small>` : ""}
      </button>`;
    }).join("")}
  </div>`;
}

function targetNamesForVideoFrame(
  targets: ObservationMediaAnnotationTarget[],
  assetId: string,
  frameTimeMs: number | null,
): string[] {
  if (frameTimeMs == null) return [];
  const names: string[] = [];
  for (const target of targets) {
    const hasFrame = target.regions.some((region) => (
      region.assetId === assetId &&
      isDisplayableRegion(region) &&
      region.frameTimeMs != null &&
      Math.abs(Number(region.frameTimeMs) - frameTimeMs) <= 350
    ));
    if (hasFrame && !names.includes(target.displayName)) names.push(target.displayName);
  }
  return names.slice(0, 3);
}

export function toSubjectRegionMap(subjects: Array<Pick<ObservationVisitSubject, "occurrenceId" | "regions">>): RegionSwitchMap {
  return Object.fromEntries(
    subjects.map((subject) => [
      subject.occurrenceId,
      subject.regions.map((region) => ({
        assetId: region.assetId,
        rect: region.rect,
        note: region.note,
        confidenceScore: region.confidenceScore,
      })),
    ]),
  );
}

function photoSizeAttrs(asset: PhotoAsset): string {
  const width = Number(asset.widthPx);
  const height = Number(asset.heightPx);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? ` width="${Math.round(width)}" height="${Math.round(height)}"`
    : "";
}

function photoSizeDataAttrs(asset: PhotoAsset): string {
  const width = Number(asset.widthPx);
  const height = Number(asset.heightPx);
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0
    ? ` data-obs-thumb-width="${Math.round(width)}" data-obs-thumb-height="${Math.round(height)}"`
    : "";
}

function photoDisplayUrl(asset: PhotoAsset, preset: "sm" | "lg"): string {
  return toThumbnailUrl(asset.url, preset) ?? asset.url;
}

function normalizeMediaRoleView(role: string | null | undefined): MediaRoleView | null {
  if (role === "primary_subject" || role === "context" || role === "sound_motion" || role === "secondary_candidate") {
    return role;
  }
  return null;
}

function mediaRoleBadge(asset: Pick<PhotoAsset | VideoAsset, "mediaRole">, compact = false): string {
  const role = normalizeMediaRoleView(asset.mediaRole);
  if (!role) return "";
  const className = role === "primary_subject" ? "" : ` is-${role.replace(/_/g, "-")}`;
  return `<span class="obs-media-role-badge${className}${compact ? " is-compact" : ""}" data-obs-media-role-badge>${escapeHtml(MEDIA_ROLE_LABELS[role])}</span>`;
}

function mediaRoleSuggestionBadge(
  asset: Pick<PhotoAsset | VideoAsset, "mediaRole" | "suggestedMediaRole" | "suggestedMediaRoleSource">,
  compact = false,
): string {
  const role = normalizeMediaRoleView(asset.suggestedMediaRole);
  if (!role) return "";
  if (role === normalizeMediaRoleView(asset.mediaRole)) return "";
  return `<span class="obs-media-ai-role${compact ? " is-compact" : ""}" data-obs-media-role-suggestion>${escapeHtml(MEDIA_ROLE_LABELS[role])}</span>`;
}

function frameTimeLabel(frameTimeMs: number | null): string {
  if (frameTimeMs == null || !Number.isFinite(Number(frameTimeMs))) return "";
  return `${(Number(frameTimeMs) / 1000).toFixed(1).replace(/\.0$/, "")}秒`;
}

function videoFrameThumbUrl(thumbnailUrl: string | null, frameTimeMs: number | null): string | null {
  if (!thumbnailUrl || frameTimeMs == null) return null;
  try {
    const url = new URL(thumbnailUrl);
    const seconds = Number(frameTimeMs) / 1000;
    url.searchParams.set("time", Number.isInteger(seconds) ? `${seconds}s` : `${seconds.toFixed(1).replace(/\.0$/, "")}s`);
    url.searchParams.set("height", "360");
    return url.toString();
  } catch {
    return null;
  }
}

function renderPhotoGallery(
  snapshot: ObservationDetailSnapshot,
  currentSubject: ObservationVisitSubject,
  annotationTargets: ObservationMediaAnnotationTarget[] = [],
): string {
  if (snapshot.photoAssets.length === 0) return "";
  const first = snapshot.photoAssets[0]!;
  const firstDisplayUrl = photoDisplayUrl(first, "lg");
  const firstFullUrl = first.url;
  const firstRegionHtml = renderObservationRegionBoxes(currentSubject, first.assetId);
  const firstRoleBadge = `<span class="obs-media-role-badge" data-obs-media-role-badge hidden></span>`;
  const firstSuggestionBadge = `<span class="obs-media-ai-role" data-obs-media-role-suggestion hidden></span>`;
  const thumbsHtml = snapshot.photoAssets.length >= 2
    ? `<div class="obs-hero-thumbs">${snapshot.photoAssets.map((asset, i) => {
      const previewUrl = photoDisplayUrl(asset, "lg");
      const thumbUrl = photoDisplayUrl(asset, "sm");
      const role = normalizeMediaRoleView(asset.mediaRole);
      const suggestedRole = normalizeMediaRoleView(asset.suggestedMediaRole);
      const suggestedConfidence = typeof asset.suggestedMediaRoleConfidence === "number" ? asset.suggestedMediaRoleConfidence.toFixed(4) : "";
      const suggestedSource = asset.suggestedMediaRoleSource ?? "";
      const regionTemplate = renderObservationRegionBoxes(currentSubject, asset.assetId);
      const annotationTemplate = renderObservationAnnotationButtons(annotationTargets, asset.assetId, currentSubject.occurrenceId);
      return `
         <button type="button" class="obs-hero-thumb${i === 0 ? " is-active" : ""}" data-obs-thumb-index="${i}" data-obs-thumb-src="${escapeHtml(previewUrl)}" data-obs-thumb-full-src="${escapeHtml(asset.url)}" data-obs-thumb-asset-id="${escapeHtml(asset.assetId)}" data-obs-thumb-media-role="${escapeHtml(role ?? "")}" data-obs-thumb-suggested-role="${escapeHtml(suggestedRole ?? "")}" data-obs-thumb-suggested-confidence="${escapeHtml(suggestedConfidence)}" data-obs-thumb-suggested-source="${escapeHtml(suggestedSource)}"${photoSizeDataAttrs(asset)} aria-label="画像 ${i + 1}">
           <img src="${escapeHtml(thumbUrl)}" alt="" loading="lazy"${photoSizeAttrs(asset)} />
           <span class="obs-hero-thumb-ring" aria-hidden="true"></span>
           <span class="obs-hero-thumb-active-label" aria-hidden="true">表示中</span>
         </button>
         <template data-obs-thumb-regions="${escapeHtml(asset.assetId)}">${regionTemplate}</template>
         <template data-obs-thumb-annotations="${escapeHtml(asset.assetId)}">${annotationTemplate}</template>`;
    }).join("")}</div>`
    : "";
  return `<div class="obs-hero-gallery" data-obs-gallery>
    <div class="obs-hero-preview" data-obs-preview data-obs-preview-asset-id="${escapeHtml(first.assetId)}">
      ${firstRoleBadge}
      ${firstSuggestionBadge}
      <span class="obs-hero-image-frame" data-obs-image-frame>
        <img src="${escapeHtml(firstDisplayUrl)}" data-obs-full-src="${escapeHtml(firstFullUrl)}" alt="${escapeHtml(snapshot.displayName)}" loading="eager" data-obs-preview-img${photoSizeAttrs(first)} />
        <span class="obs-region-layer" data-region-layer="${escapeHtml(first.assetId)}" data-obs-preview-regions${firstRegionHtml ? "" : " hidden"}>${firstRegionHtml}</span>
        <span class="obs-annotation-layer" data-obs-preview-annotations hidden></span>
      </span>
      <button type="button" class="obs-hero-zoom" data-obs-zoom aria-label="画像を拡大">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      </button>
    </div>
    ${thumbsHtml}
  </div>`;
}

function renderVideoPlayer(
  snapshot: ObservationDetailSnapshot,
  primaryVideo: VideoAsset | null,
  annotationTargets: ObservationMediaAnnotationTarget[] = [],
  afterVideoHtml = "",
): string {
  if (!primaryVideo) return "";
  const videoEvidence = (snapshot.visualEvidence ?? [])
    .filter((item) => item.mediaKind === "video_frame" && (!item.assetId || item.assetId === primaryVideo.assetId))
    .slice(0, 8);
  const videoEvidenceHtml = videoEvidence.length > 0
    ? `<div class="obs-video-evidence">
        <div class="obs-video-evidence-head"><strong>AIが見た動画フレーム</strong><span>${videoEvidence.length}枚</span></div>
        <div class="obs-video-evidence-grid">
          ${videoEvidence.map((item, index) => {
            const thumbUrl = videoFrameThumbUrl(primaryVideo.thumbnailUrl, item.frameTimeMs);
            const score = typeof item.selectionScore === "number" ? `${Math.round(item.selectionScore * 100)}%` : "";
            const targetNames = targetNamesForVideoFrame(annotationTargets, primaryVideo.assetId, item.frameTimeMs);
            const caption = [frameTimeLabel(item.frameTimeMs) || "動画フレーム", score].filter(Boolean).join(" ");
            const targetBadges = targetNames.length > 0
              ? `<div class="obs-frame-subjects" aria-label="このフレームで見たもの">${targetNames.map((name) => `<span>${escapeHtml(name)}</span>`).join("")}</div>`
              : `<div class="obs-frame-subjects" aria-hidden="true"></div>`;
            return `<figure class="obs-video-evidence-frame">
              ${thumbUrl ? `<button type="button" class="obs-video-evidence-preview" data-video-frame-preview="${escapeHtml(String(index))}" data-frame-src="${escapeHtml(thumbUrl)}" data-frame-caption="${escapeHtml(caption)}"><img src="${escapeHtml(thumbUrl)}" alt="" loading="lazy" /></button>` : ""}
              <figcaption><span>${escapeHtml(caption)}</span>${targetBadges}</figcaption>
            </figure>`;
          }).join("")}
        </div>
      </div>`
    : "";
  const processingOverlay = primaryVideo.readyToStream
    ? ""
    : `<div class="obs-hero-video-processing" aria-live="polite">
         <div><strong>動画を処理しています</strong><span>記録は保存済みです。再生できる状態になるまで少し待ってから開き直してください。</span></div>
       </div>`;
  return `<div class="obs-hero-video">
     <div class="obs-hero-video-frame">
       <iframe
         src="${escapeHtml(primaryVideo.iframeUrl)}"
         title="${escapeHtml(snapshot.displayName)} の動画"
         loading="lazy"
         allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
         allowfullscreen>
       </iframe>
       ${processingOverlay}
     </div>
     ${primaryVideo.watchUrl ? `<div class="obs-hero-video-meta">
       <span class="obs-hero-video-meta-main">${mediaRoleBadge(primaryVideo)}${mediaRoleSuggestionBadge(primaryVideo)}</span>
       <a href="${escapeHtml(primaryVideo.watchUrl)}" target="_blank" rel="noopener noreferrer">別タブで開く</a>
     </div>` : ""}
     ${afterVideoHtml}
     ${renderVideoAnnotationRail(annotationTargets, primaryVideo.assetId)}
     ${videoEvidenceHtml}
   </div>`;
}

function renderAudioEvidence(snapshot: ObservationDetailSnapshot): string {
  const audioAssets = (snapshot.audioAssets ?? []).filter((asset): asset is AudioAsset => Boolean(asset));
  if (audioAssets.length === 0) return "";
  return `<section class="obs-audio-evidence" aria-label="音声証拠">
    <div>
      <strong>音声証拠</strong>
      <span>privacy-safe な録音だけを観察証拠にしています</span>
    </div>
    ${audioAssets.map((asset, index) => {
      const duration = typeof asset.durationSec === "number" && Number.isFinite(asset.durationSec)
        ? `${Math.round(asset.durationSec)}秒`
        : "短い録音";
      const label = `音声 ${index + 1} · ${duration}`;
      return asset.playbackUrl
        ? `<audio controls preload="none" src="${escapeHtml(asset.playbackUrl)}" aria-label="${escapeHtml(label)}"></audio>`
        : `<p>${escapeHtml(label)}。所有者だけが再生できます。</p>`;
    }).join("")}
  </section>`;
}

function renderMediaLedger(snapshot: ObservationDetailSnapshot): string {
  const photoCount = snapshot.photoAssets?.length ?? 0;
  const videoCount = snapshot.videoAssets?.length ?? 0;
  const audioCount = snapshot.audioAssets?.length ?? 0;
  const photoDetail = photoCount >= 3 ? "全体・細部・周囲" : photoCount > 1 ? "複数角度" : photoCount === 1 ? "主写真" : "未記録";
  const videoDetail = videoCount > 0 ? "動きあり" : "動きは未記録";
  const audioDetail = audioCount > 0 ? "音声あり" : "環境音は未記録";
  return `<div class="obs-media-ledger" aria-label="メディア台帳">
    <div class="obs-media-ledger-item"><strong>写真</strong><span>${escapeHtml(`${photoCount}枚`)}</span><small>${escapeHtml(photoDetail)}</small></div>
    <div class="obs-media-ledger-item"><strong>動画</strong><span>${escapeHtml(`${videoCount}本`)}</span><small>${escapeHtml(videoDetail)}</small></div>
    <div class="obs-media-ledger-item"><strong>音</strong><span>${escapeHtml(`${audioCount}件`)}</span><small>${escapeHtml(audioDetail)}</small></div>
  </div>`;
}

export function renderObservationMedia(
  snapshot: ObservationDetailSnapshot,
  currentSubject: ObservationVisitSubject,
  annotationTargets: ObservationMediaAnnotationTarget[] = [],
  options: { afterVideoHtml?: string } = {},
): { mediaBlock: string; galleryScript: string } {
  const photoGallery = renderPhotoGallery(snapshot, currentSubject, annotationTargets);
  const primaryVideo = snapshot.videoAssets[0] ?? null;
  const videoPlayer = renderVideoPlayer(snapshot, primaryVideo, annotationTargets, options.afterVideoHtml ?? "");
  const audioEvidence = renderAudioEvidence(snapshot);
  const mediaLedger = renderMediaLedger(snapshot);
  const mediaBlock = (videoPlayer || photoGallery || audioEvidence)
    ? `<div class="obs-hero-media-stack">${videoPlayer}${photoGallery ? `<div class="${videoPlayer ? "obs-hero-photo-stack" : ""}">${photoGallery}</div>` : ""}${audioEvidence}${mediaLedger}<p class="obs-region-summary" data-region-summary hidden></p></div>`
    : `<div class="obs-hero-placeholder"><span>📷</span><span>${escapeHtml(snapshot.displayName)}</span><small>写真も動画もまだありません</small></div>`;

  return {
    mediaBlock,
    galleryScript: renderObservationGalleryScript({
      hasPhotoAssets: snapshot.photoAssets.length > 0,
      hasVideoFrames: Boolean(snapshot.visualEvidence?.some((item) => item.mediaKind === "video_frame")),
    }),
  };
}

function renderObservationGalleryScript(options: { hasPhotoAssets: boolean; hasVideoFrames: boolean }): string {
  const photoLightbox = options.hasPhotoAssets ? `<div class="obs-lightbox" data-obs-lightbox role="dialog" aria-modal="true" aria-label="画像を拡大表示">
     <button type="button" class="obs-lightbox-close" data-obs-lightbox-close aria-label="閉じる">
       <svg viewBox="0 0 24 24" aria-hidden="true"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
       <span>閉じる</span>
     </button>
     <button type="button" class="obs-lightbox-toggle" data-obs-lightbox-toggle aria-label="表示サイズ切替">
       <svg viewBox="0 0 24 24" aria-hidden="true" data-obs-lightbox-icon-fit><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.5" y2="16.5"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
       <span data-obs-lightbox-toggle-label>等倍で見る</span>
     </button>
     <div class="obs-lightbox-inner" data-obs-lightbox-inner><img class="obs-lightbox-img is-fit" data-obs-lightbox-img alt="" /></div>
     <div class="obs-lightbox-hint" data-obs-lightbox-hint>クリックで等倍 / ドラッグでパン / ホイールでスクロール / Esc で閉じる</div>
   </div>` : "";
  const photoScript = options.hasPhotoAssets ? `
   <script>(function(){
     var gallery = document.querySelector('[data-obs-gallery]');
     if (!gallery) return;
     var preview = gallery.querySelector('[data-obs-preview]');
     var previewImg = preview && preview.querySelector('[data-obs-preview-img]');
     var previewRegions = preview && preview.querySelector('[data-obs-preview-regions]');
     var previewAnnotations = preview && preview.querySelector('[data-obs-preview-annotations]');
     var previewRoleBadge = preview && preview.querySelector('[data-obs-media-role-badge]');
     var previewSuggestionBadge = preview && preview.querySelector('[data-obs-media-role-suggestion]');
     var thumbs = Array.prototype.slice.call(gallery.querySelectorAll('.obs-hero-thumb'));
     var lightbox = document.querySelector('[data-obs-lightbox]');
     var lightboxImg = lightbox && lightbox.querySelector('[data-obs-lightbox-img]');
     var lightboxClose = lightbox && lightbox.querySelector('[data-obs-lightbox-close]');
     var updateRegionSummary = function(regionHtml){
       var summary = document.querySelector('[data-region-summary]');
       if (!summary) return;
       summary.hidden = true;
       summary.textContent = '';
     };
     var cssEscape = function(value) {
       if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(String(value));
       return String(value).replace(/["\\\\]/g, '\\\\$&');
     };
     var templateFor = function(attr, assetId) {
       if (!assetId) return null;
       return gallery.querySelector('template[' + attr + '="' + cssEscape(assetId) + '"]');
     };

     var selectThumb = function(t){
       if (!t || t.classList.contains('is-active')) return;
       var src = t.getAttribute('data-obs-thumb-src');
       var fullSrc = t.getAttribute('data-obs-thumb-full-src');
       var assetId = t.getAttribute('data-obs-thumb-asset-id');
       var imageWidth = t.getAttribute('data-obs-thumb-width');
       var imageHeight = t.getAttribute('data-obs-thumb-height');
       var regions = templateFor('data-obs-thumb-regions', assetId || '');
       var annotations = templateFor('data-obs-thumb-annotations', assetId || '');
       thumbs.forEach(function(x){ x.classList.remove('is-active'); });
       t.classList.add('is-active');
       if (previewImg && imageWidth && imageHeight) {
         previewImg.setAttribute('width', imageWidth);
         previewImg.setAttribute('height', imageHeight);
       } else if (previewImg) {
         previewImg.removeAttribute('width');
         previewImg.removeAttribute('height');
       }
       if (previewImg && src) { previewImg.src = src; }
       if (previewImg) {
         if (fullSrc) previewImg.setAttribute('data-obs-full-src', fullSrc);
         else previewImg.removeAttribute('data-obs-full-src');
       }
       if (preview && assetId) { preview.setAttribute('data-obs-preview-asset-id', assetId); }
       if (previewRoleBadge) {
         var role = t.getAttribute('data-obs-thumb-media-role') || '';
         var roleLabels = {
           primary_subject: '主対象',
           context: '周囲',
           sound_motion: '音・動き',
           secondary_candidate: '別対象候補'
         };
         previewRoleBadge.textContent = roleLabels[role] || '';
         previewRoleBadge.hidden = !roleLabels[role];
         previewRoleBadge.className = 'obs-media-role-badge' + (role && role !== 'primary_subject' ? ' is-' + role.replace(/_/g, '-') : '');
       }
       if (previewSuggestionBadge) {
         var suggestedRole = t.getAttribute('data-obs-thumb-suggested-role') || '';
         var actualRole = t.getAttribute('data-obs-thumb-media-role') || '';
         var roleLabels2 = {
           primary_subject: '主対象',
           context: '周囲',
           sound_motion: '音・動き',
           secondary_candidate: '別対象候補'
         };
         var hasSuggestion = !!roleLabels2[suggestedRole] && suggestedRole !== actualRole;
         previewSuggestionBadge.textContent = hasSuggestion ? roleLabels2[suggestedRole] : '';
         previewSuggestionBadge.hidden = !hasSuggestion;
       }
       if (previewRegions) {
         var regionHtml = regions ? regions.innerHTML : '';
         previewRegions.innerHTML = regionHtml;
         previewRegions.setAttribute('data-region-layer', assetId || '');
         updateRegionSummary(regionHtml);
       }
       if (previewAnnotations) {
         previewAnnotations.innerHTML = annotations ? annotations.innerHTML : '';
       }
       window.dispatchEvent(new CustomEvent('ikimon:media-asset-selected', { detail: { assetId: assetId || '' } }));
     };

     thumbs.forEach(function(t){
       t.addEventListener('click', function(e){ e.preventDefault(); selectThumb(t); });
     });

     var toggleBtn = lightbox && lightbox.querySelector('[data-obs-lightbox-toggle]');
     var toggleLabel = lightbox && lightbox.querySelector('[data-obs-lightbox-toggle-label]');
     var lightboxInner = lightbox && lightbox.querySelector('[data-obs-lightbox-inner]');
     var updateToggleLabel = function(){
       if (!toggleLabel || !lightboxImg) return;
       toggleLabel.textContent = lightboxImg.classList.contains('is-fit') ? '等倍で見る' : '画面に合わせる';
     };
     var setFitMode = function(fit){
       if (!lightboxImg) return;
       lightboxImg.classList.toggle('is-fit', !!fit);
       lightboxImg.classList.toggle('is-actual', !fit);
       updateToggleLabel();
     };
     var openLightbox = function(){
       if (!lightbox || !previewImg) return;
       lightboxImg.src = previewImg.getAttribute('data-obs-full-src') || previewImg.src;
       setFitMode(true);
       lightbox.classList.add('is-open');
       lightbox.scrollTop = 0;
       lightbox.scrollLeft = 0;
       document.body.style.overflow = 'hidden';
     };
     var closeLightbox = function(){
       if (!lightbox) return;
       lightbox.classList.remove('is-open');
       document.body.style.overflow = '';
     };

     if (preview) {
       preview.addEventListener('click', function(e){
         if (e.target.closest && e.target.closest('[data-annotation-target]')) return;
         if (e.target.closest && e.target.closest('[data-obs-zoom]')) { e.preventDefault(); openLightbox(); return; }
         openLightbox();
       });
     }
     if (lightboxClose) lightboxClose.addEventListener('click', function(e){ e.preventDefault(); e.stopPropagation(); closeLightbox(); });
     if (toggleBtn) toggleBtn.addEventListener('click', function(e){
       e.preventDefault(); e.stopPropagation();
       setFitMode(!lightboxImg.classList.contains('is-fit'));
       if (lightboxImg.classList.contains('is-actual')) {
         var r = lightboxImg.getBoundingClientRect();
         lightbox.scrollLeft = Math.max(0, (r.width - lightbox.clientWidth) / 2);
         lightbox.scrollTop = Math.max(0, (r.height - lightbox.clientHeight) / 2);
       }
     });
     if (lightboxImg) {
       lightboxImg.addEventListener('click', function(e){
         e.stopPropagation();
         var wasfit = lightboxImg.classList.contains('is-fit');
         setFitMode(!wasfit);
         if (wasfit) {
           var r = lightboxImg.getBoundingClientRect();
           var cx = e.clientX - r.left;
           var cy = e.clientY - r.top;
           var ratioX = cx / Math.max(1, r.width);
           var ratioY = cy / Math.max(1, r.height);
           requestAnimationFrame(function(){
             var nr = lightboxImg.getBoundingClientRect();
             lightbox.scrollLeft = Math.max(0, ratioX * nr.width - lightbox.clientWidth / 2);
             lightbox.scrollTop = Math.max(0, ratioY * nr.height - lightbox.clientHeight / 2);
           });
         }
       });
       var dragState = null;
       lightboxImg.addEventListener('pointerdown', function(e){
         if (lightboxImg.classList.contains('is-fit')) return;
         dragState = { x: e.clientX, y: e.clientY, sl: lightbox.scrollLeft, st: lightbox.scrollTop };
         lightboxImg.classList.add('is-dragging');
         try { lightboxImg.setPointerCapture(e.pointerId); } catch (_) {}
       });
       lightboxImg.addEventListener('pointermove', function(e){
         if (!dragState) return;
         e.preventDefault();
         lightbox.scrollLeft = dragState.sl - (e.clientX - dragState.x);
         lightbox.scrollTop = dragState.st - (e.clientY - dragState.y);
       });
       var endDrag = function(e){
         if (!dragState) return;
         dragState = null;
         lightboxImg.classList.remove('is-dragging');
         try { lightboxImg.releasePointerCapture(e.pointerId); } catch (_) {}
       };
       lightboxImg.addEventListener('pointerup', endDrag);
       lightboxImg.addEventListener('pointercancel', endDrag);
     }
     if (lightbox) {
       lightbox.addEventListener('click', function(e){
         if (e.target === lightbox || e.target === lightboxInner) closeLightbox();
       });
     }
     document.addEventListener('keydown', function(e){
       if (!lightbox || !lightbox.classList.contains('is-open')) return;
       if (e.key === 'Escape') closeLightbox();
       if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setFitMode(!lightboxImg.classList.contains('is-fit')); }
     });
    })();</script>` : "";
  const frameScript = options.hasVideoFrames ? renderVideoFramePreviewScript() : "";
  return `${photoLightbox}${photoScript}${frameScript}`;
}

function renderVideoFramePreviewScript(): string {
  return `<script>(function(){
    var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-video-frame-preview]'));
    if (!buttons.length) return;
    var preview;
    var currentIndex = 0;
    var zoom = 1;
    var stageDrag = null;
    function ensurePreview() {
      if (preview) return preview;
      preview = document.createElement('div');
      preview.className = 'obs-frame-preview';
      preview.setAttribute('role', 'dialog');
      preview.setAttribute('aria-modal', 'true');
      preview.setAttribute('aria-label', '動画フレームを拡大表示');
      preview.innerHTML = '<button type="button" class="obs-frame-preview-close">閉じる</button><button type="button" class="obs-frame-preview-button obs-frame-preview-nav obs-frame-preview-prev" aria-label="前のフレーム">‹</button><button type="button" class="obs-frame-preview-button obs-frame-preview-nav obs-frame-preview-next" aria-label="次のフレーム">›</button><div class="obs-frame-preview-inner"><div class="obs-frame-preview-stage"><img class="obs-frame-preview-img" alt=""></div><div class="obs-frame-preview-caption"></div></div><div class="obs-frame-preview-toolbar" aria-label="フレーム表示操作"><button type="button" class="obs-frame-preview-button" data-frame-zoom-out aria-label="縮小">−</button><span class="obs-frame-preview-count">1/1</span><button type="button" class="obs-frame-preview-button" data-frame-zoom-in aria-label="拡大">＋</button><button type="button" class="obs-frame-preview-button" data-frame-zoom-reset aria-label="等倍に戻す">等倍</button></div>';
      document.body.appendChild(preview);
      var stage = preview.querySelector('.obs-frame-preview-stage');
      var close = preview.querySelector('.obs-frame-preview-close');
      var prev = preview.querySelector('.obs-frame-preview-prev');
      var next = preview.querySelector('.obs-frame-preview-next');
      var zoomOut = preview.querySelector('[data-frame-zoom-out]');
      var zoomIn = preview.querySelector('[data-frame-zoom-in]');
      var zoomReset = preview.querySelector('[data-frame-zoom-reset]');
      if (close) close.addEventListener('click', closePreview);
      if (prev) prev.addEventListener('click', function(event){ event.preventDefault(); event.stopPropagation(); showFrame(currentIndex - 1); });
      if (next) next.addEventListener('click', function(event){ event.preventDefault(); event.stopPropagation(); showFrame(currentIndex + 1); });
      if (zoomOut) zoomOut.addEventListener('click', function(event){ event.preventDefault(); event.stopPropagation(); setZoom(zoom - 0.5); });
      if (zoomIn) zoomIn.addEventListener('click', function(event){ event.preventDefault(); event.stopPropagation(); setZoom(zoom + 1); });
      if (zoomReset) zoomReset.addEventListener('click', function(event){ event.preventDefault(); event.stopPropagation(); setZoom(1); });
      preview.addEventListener('click', function(event){
        if (event.target === preview) closePreview();
        if (event.target.closest && event.target.closest('.obs-frame-preview-prev')) showFrame(currentIndex - 1);
        if (event.target.closest && event.target.closest('.obs-frame-preview-next')) showFrame(currentIndex + 1);
        if (event.target.closest && event.target.closest('[data-frame-zoom-in]')) setZoom(zoom + 1);
        if (event.target.closest && event.target.closest('[data-frame-zoom-out]')) setZoom(zoom - 0.5);
        if (event.target.closest && event.target.closest('[data-frame-zoom-reset]')) setZoom(1);
      });
      preview.addEventListener('wheel', function(event){
        if (!preview.classList.contains('is-open')) return;
        event.preventDefault();
        setZoom(zoom + (event.deltaY < 0 ? 0.18 : -0.18), event.clientX, event.clientY);
      }, { passive: false });
      if (stage) {
        stage.addEventListener('pointerdown', function(event){
          if (zoom <= 1 || event.button !== 0) return;
          stageDrag = { x: event.clientX, y: event.clientY, left: stage.scrollLeft, top: stage.scrollTop };
          stage.classList.add('is-dragging');
          try { stage.setPointerCapture(event.pointerId); } catch (_) {}
          event.preventDefault();
        });
        stage.addEventListener('pointermove', function(event){
          if (!stageDrag) return;
          stage.scrollLeft = stageDrag.left - (event.clientX - stageDrag.x);
          stage.scrollTop = stageDrag.top - (event.clientY - stageDrag.y);
        });
        var endDrag = function(event){
          if (!stageDrag) return;
          stageDrag = null;
          stage.classList.remove('is-dragging');
          try { stage.releasePointerCapture(event.pointerId); } catch (_) {}
        };
        stage.addEventListener('pointerup', endDrag);
        stage.addEventListener('pointercancel', endDrag);
      }
      document.addEventListener('keydown', function(event){
        if (!preview || !preview.classList.contains('is-open')) return;
        if (event.key === 'Escape') closePreview();
        if (event.key === 'ArrowLeft') showFrame(currentIndex - 1);
        if (event.key === 'ArrowRight') showFrame(currentIndex + 1);
        if (event.key === '+' || event.key === '=') setZoom(zoom + 1);
        if (event.key === '-' || event.key === '_') setZoom(zoom - 0.5);
      });
      return preview;
    }
    function measureFit(img, stage) {
      if (!img || !stage) return { width: 1, height: 1 };
      if (zoom === 1 || !img.dataset.fitWidth || !img.dataset.fitHeight) {
        var rect = img.getBoundingClientRect();
        var width = Math.max(1, rect.width || img.naturalWidth || stage.clientWidth || 1);
        var height = Math.max(1, rect.height || img.naturalHeight || stage.clientHeight || 1);
        img.dataset.fitWidth = String(width);
        img.dataset.fitHeight = String(height);
      }
      return {
        width: Math.max(1, Number(img.dataset.fitWidth) || img.naturalWidth || 1),
        height: Math.max(1, Number(img.dataset.fitHeight) || img.naturalHeight || 1)
      };
    }
    function setZoom(nextZoom, originX, originY) {
      var previousZoom = zoom;
      zoom = Math.max(1, Math.min(4, Number(nextZoom) || 1));
      var img = preview && preview.querySelector('.obs-frame-preview-img');
      var stage = preview && preview.querySelector('.obs-frame-preview-stage');
      if (!img || !stage) return;
      var before = img.getBoundingClientRect();
      var stageRect = stage.getBoundingClientRect();
      var ratioX = typeof originX === 'number' && before.width > 0
        ? (originX - before.left) / before.width
        : (stage.scrollLeft + stage.clientWidth / 2) / Math.max(1, img.offsetWidth || before.width);
      var ratioY = typeof originY === 'number' && before.height > 0
        ? (originY - before.top) / before.height
        : (stage.scrollTop + stage.clientHeight / 2) / Math.max(1, img.offsetHeight || before.height);
      ratioX = Math.max(0, Math.min(1, ratioX));
      ratioY = Math.max(0, Math.min(1, ratioY));
      if (zoom === 1) {
        stage.classList.remove('is-zoomed');
        img.style.width = '';
        img.style.height = '';
        img.style.maxWidth = '';
        img.style.maxHeight = '';
        stage.scrollLeft = 0;
        stage.scrollTop = 0;
        return;
      }
      var fit = measureFit(img, stage);
      stage.classList.add('is-zoomed');
      img.style.width = Math.round(fit.width * zoom) + 'px';
      img.style.height = Math.round(fit.height * zoom) + 'px';
      img.style.maxWidth = 'none';
      img.style.maxHeight = 'none';
      window.requestAnimationFrame(function(){
        if (previousZoom === 1 && typeof originX !== 'number') {
          stage.scrollLeft = Math.max(0, (img.offsetWidth - stage.clientWidth) / 2);
          stage.scrollTop = Math.max(0, (img.offsetHeight - stage.clientHeight) / 2);
          return;
        }
        stage.scrollLeft = Math.max(0, ratioX * img.offsetWidth - (typeof originX === 'number' ? originX - stageRect.left : stage.clientWidth / 2));
        stage.scrollTop = Math.max(0, ratioY * img.offsetHeight - (typeof originY === 'number' ? originY - stageRect.top : stage.clientHeight / 2));
      });
    }
    function showFrame(nextIndex) {
      if (!buttons.length) return;
      currentIndex = (nextIndex + buttons.length) % buttons.length;
      var button = buttons[currentIndex];
      var src = button.getAttribute('data-frame-src') || '';
      var caption = button.getAttribute('data-frame-caption') || '';
      ensurePreview();
      var img = preview.querySelector('.obs-frame-preview-img');
      var cap = preview.querySelector('.obs-frame-preview-caption');
      var count = preview.querySelector('.obs-frame-preview-count');
      if (img && src) {
        img.removeAttribute('data-fit-width');
        img.removeAttribute('data-fit-height');
        img.onload = function(){
          var wantedZoom = zoom;
          img.removeAttribute('data-fit-width');
          img.removeAttribute('data-fit-height');
          img.style.width = '';
          img.style.height = '';
          img.style.maxWidth = '';
          img.style.maxHeight = '';
          var stage = preview.querySelector('.obs-frame-preview-stage');
          if (stage) stage.classList.remove('is-zoomed');
          zoom = 1;
          setZoom(wantedZoom);
        };
        img.src = src;
      }
      if (cap) cap.textContent = caption;
      if (count) count.textContent = (currentIndex + 1) + '/' + buttons.length;
      setZoom(1);
    }
    function openPreview(index) {
      ensurePreview();
      showFrame(index);
      preview.classList.add('is-open');
      document.body.style.overflow = 'hidden';
      var close = preview.querySelector('.obs-frame-preview-close');
      if (close && typeof close.focus === 'function') close.focus({ preventScroll: true });
    }
    function closePreview() {
      if (!preview) return;
      preview.classList.remove('is-open');
      document.body.style.overflow = '';
      var button = buttons[currentIndex];
      if (button && typeof button.focus === 'function') button.focus({ preventScroll: true });
    }
    buttons.forEach(function(button, index){
      button.addEventListener('click', function(event){
        event.preventDefault();
        openPreview(index);
      });
    });
  })();</script>`;
}
