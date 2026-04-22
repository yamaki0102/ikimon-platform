import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import type { AmbientInvitation, PhotoHint } from "../services/ambientInvitations.js";
import { escapeHtml } from "./siteShell.js";

type CueAction = {
  href: string;
  label: string;
  eventName?: "cue_opened" | "same_place_link_created";
};

type InvitationCardOptions = {
  cueId: string;
  surface: string;
  eyebrow: string;
  invitation: AmbientInvitation;
  action?: CueAction;
};

type PhotoHintCardOptions = {
  cueId: string;
  surface: string;
  eyebrow: string;
  photoHint: PhotoHint;
  action?: CueAction;
};

type CueDeckOptions = {
  basePath: string;
  lang: SiteLang;
  surface: string;
  sectionEyebrow: string;
  sectionTitle: string;
  cards: string[];
};

function actionHref(basePath: string, lang: SiteLang, href: string): string {
  return appendLangToHref(withBasePath(basePath, href), lang);
}

function dismissLabel(lang: SiteLang): string {
  switch (lang) {
    case "en":
      return "Hide for now";
    case "es":
      return "Ocultar por ahora";
    case "pt-BR":
      return "Ocultar por enquanto";
    default:
      return "いまは閉じる";
  }
}

function reasonLabel(lang: SiteLang): string {
  switch (lang) {
    case "en":
      return "Why it matters";
    case "es":
      return "Por qué importa";
    case "pt-BR":
      return "Por que ajuda";
    default:
      return "これが面白い理由";
  }
}

function tryLabel(lang: SiteLang): string {
  switch (lang) {
    case "en":
      return "If you want to try";
    case "es":
      return "Si te apetece probar";
    case "pt-BR":
      return "Se quiser tentar";
    default:
      return "やってみるなら";
  }
}

function renderCueFrame(
  basePath: string,
  lang: SiteLang,
  cueId: string,
  surface: string,
  cueKind: string,
  basisType: string,
  eyebrow: string,
  heading: string,
  whyText: string,
  tryText: string,
  action?: CueAction,
): string {
  const actionHtml = action
    ? `<a class="btn btn-ghost ambient-cue-link" href="${escapeHtml(actionHref(basePath, lang, action.href))}" data-cue-action="${escapeHtml(action.eventName ?? "cue_opened")}">${escapeHtml(action.label)}</a>`
    : "";

  return `<article class="card is-soft ambient-cue-card" data-cue-id="${escapeHtml(cueId)}" data-cue-kind="${escapeHtml(cueKind)}" data-basis-type="${escapeHtml(basisType)}" data-cue-surface="${escapeHtml(surface)}">
    <div class="card-body">
      <div class="ambient-cue-head">
        <div class="eyebrow">${escapeHtml(eyebrow)}</div>
        <button class="ambient-cue-dismiss" type="button" data-cue-action="cue_dismissed">${escapeHtml(dismissLabel(lang))}</button>
      </div>
      <h2>${escapeHtml(heading)}</h2>
      <div class="ambient-cue-block">
        <strong>${escapeHtml(reasonLabel(lang))}</strong>
        <p>${escapeHtml(whyText)}</p>
      </div>
      <div class="ambient-cue-block">
        <strong>${escapeHtml(tryLabel(lang))}</strong>
        <p>${escapeHtml(tryText)}</p>
      </div>
      ${actionHtml ? `<div class="actions ambient-cue-actions">${actionHtml}</div>` : ""}
    </div>
  </article>`;
}

export function renderInvitationCard(
  basePath: string,
  lang: SiteLang,
  options: InvitationCardOptions,
): string {
  return renderCueFrame(
    basePath,
    lang,
    options.cueId,
    options.surface,
    options.invitation.kind,
    options.invitation.basis[0]?.type ?? "fresh_start",
    options.eyebrow,
    options.invitation.headline,
    options.invitation.whyItMatters,
    options.invitation.tryIfYouWant,
    options.action,
  );
}

export function renderPhotoHintCard(
  basePath: string,
  lang: SiteLang,
  options: PhotoHintCardOptions,
): string {
  return renderCueFrame(
    basePath,
    lang,
    options.cueId,
    options.surface,
    "evidence_hint",
    options.photoHint.basis[0]?.type ?? "same_frame_hint",
    options.eyebrow,
    options.photoHint.focus,
    options.photoHint.whyItHelps,
    options.photoHint.tryIfYouWant,
    options.action,
  );
}

export function renderAmbientCueDeck(
  options: CueDeckOptions,
): string {
  return `<section class="section ambient-cue-section" aria-label="${escapeHtml(options.sectionTitle)}">
    <div class="section-header">
      <div>
        <div class="eyebrow">${escapeHtml(options.sectionEyebrow)}</div>
        <h2>${escapeHtml(options.sectionTitle)}</h2>
      </div>
    </div>
    <div class="ambient-cue-grid">${options.cards.join("")}</div>
  </section>`;
}

export const AMBIENT_CUE_CARD_STYLES = `
  .ambient-cue-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .ambient-cue-card { border-color: rgba(16, 185, 129, .14); background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%); }
  .ambient-cue-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .ambient-cue-dismiss { border: 0; background: transparent; color: #64748b; font-size: 12px; font-weight: 700; cursor: pointer; padding: 0; }
  .ambient-cue-dismiss:hover { color: #0f172a; }
  .ambient-cue-card h2 { margin: 12px 0 14px; font-size: 20px; line-height: 1.45; letter-spacing: -.02em; color: #0f172a; }
  .ambient-cue-block + .ambient-cue-block { margin-top: 12px; }
  .ambient-cue-block strong { display: block; margin-bottom: 4px; font-size: 12px; font-weight: 800; letter-spacing: .04em; text-transform: uppercase; color: #0f766e; }
  .ambient-cue-block p { margin: 0; color: #475569; line-height: 1.8; }
  .ambient-cue-actions { margin-top: 16px; }
  @media (max-width: 860px) {
    .ambient-cue-grid { grid-template-columns: 1fr; }
  }
`;
