import type { SiteLang } from "../i18n.js";

export type OfficialNoticeRenderCopy = {
  eyebrow: string;
  updatedLabel: string;
  whatLabel: string;
  whyLabel: string;
  doLabel: string;
  avoidLabel: string;
  attachmentsLabel: string;
  sourceLabel: string;
};

const COPY: Record<SiteLang, OfficialNoticeRenderCopy> = {
  ja: {
    eyebrow: "自治体からのお知らせ",
    updatedLabel: "更新",
    whatLabel: "何が起きているか",
    whyLabel: "この場所で関係する理由",
    doLabel: "次に見るもの",
    avoidLabel: "してはいけないこと",
    attachmentsLabel: "添付資料",
    sourceLabel: "出典",
  },
  en: {
    eyebrow: "Municipal notice",
    updatedLabel: "Updated",
    whatLabel: "What is happening",
    whyLabel: "Why it matters here",
    doLabel: "Next action",
    avoidLabel: "Do not",
    attachmentsLabel: "Attachments",
    sourceLabel: "Source",
  },
  es: {
    eyebrow: "Aviso municipal",
    updatedLabel: "Actualizado",
    whatLabel: "Qué está pasando",
    whyLabel: "Por qué importa aquí",
    doLabel: "Siguiente acción",
    avoidLabel: "No hacer",
    attachmentsLabel: "Adjuntos",
    sourceLabel: "Fuente",
  },
  "pt-BR": {
    eyebrow: "Aviso municipal",
    updatedLabel: "Atualizado",
    whatLabel: "O que está acontecendo",
    whyLabel: "Por que importa aqui",
    doLabel: "Próxima ação",
    avoidLabel: "Não fazer",
    attachmentsLabel: "Anexos",
    sourceLabel: "Fonte",
  },
};

export function getOfficialNoticeRenderCopy(lang: SiteLang): OfficialNoticeRenderCopy {
  return COPY[lang];
}

export function buildOfficialNoticeClientRenderer(
  functionName: string,
  copy: OfficialNoticeRenderCopy,
  options: { kpiNamespace: string },
): string {
  return `
function ${functionName}(notices) {
  var COPY = ${JSON.stringify(copy)};
  var KPI_NAMESPACE = ${JSON.stringify(options.kpiNamespace)};
  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function list(items) {
    if (!Array.isArray(items) || items.length === 0) return '';
    return '<ul>' + items.map(function (item) { return '<li>' + esc(item) + '</li>'; }).join('') + '</ul>';
  }
  function actionKey(kind) {
    return KPI_NAMESPACE + ':' + (kind === 'report' ? 'notice-report' : 'notice-open');
  }
  if (!Array.isArray(notices) || notices.length === 0) return '';
  return '<div class="io-notice-list">' + notices.map(function (notice) {
    var meta = notice.updatedAt
      ? '<span class="io-notice-meta-item">' + esc(COPY.updatedLabel) + ' ' + esc(notice.updatedAt) + '</span>'
      : '';
    var summary = notice.summary
      ? '<div class="io-notice-section"><div class="io-notice-sublabel">' + esc(COPY.whatLabel) + '</div><p>' + esc(notice.summary) + '</p></div>'
      : '';
    var why = Array.isArray(notice.whyRelevant) && notice.whyRelevant.length > 0
      ? '<div class="io-notice-section"><div class="io-notice-sublabel">' + esc(COPY.whyLabel) + '</div>' + list(notice.whyRelevant) + '</div>'
      : '';
    var limits = Array.isArray(notice.limits) && notice.limits.length > 0
      ? '<div class="io-notice-section"><div class="io-notice-sublabel">' + esc(COPY.avoidLabel) + '</div>' + list(notice.limits) + '</div>'
      : '';
    var actions = Array.isArray(notice.actions) && notice.actions.length > 0
      ? '<div class="io-notice-section"><div class="io-notice-sublabel">' + esc(COPY.doLabel) + '</div><div class="io-notice-actions">' + notice.actions.map(function (action) {
          return '<a class="io-notice-action' + (action.kind === 'open_source' ? ' is-primary' : '') + '" href="' + esc(action.url) + '" target="_blank" rel="noreferrer noopener" data-kpi-action="' + esc(actionKey(action.kind)) + '">' + esc(action.label) + '</a>';
        }).join('') + '</div></div>'
      : '';
    var attachments = Array.isArray(notice.attachments) && notice.attachments.length > 0
      ? '<div class="io-notice-section"><div class="io-notice-sublabel">' + esc(COPY.attachmentsLabel) + '</div><div class="io-notice-attachments">' + notice.attachments.map(function (attachment) {
          return '<a class="io-notice-attachment" href="' + esc(attachment.url) + '" target="_blank" rel="noreferrer noopener">' + esc(attachment.label) + '</a>';
        }).join('') + '</div></div>'
      : '';
    var source = notice.sourceUrl
      ? '<a class="io-notice-source" href="' + esc(notice.sourceUrl) + '" target="_blank" rel="noreferrer noopener" data-kpi-action="' + esc(actionKey('open_source')) + '">' + esc(COPY.sourceLabel) + '</a>'
      : '';
    return '<article class="io-notice-card">' +
      '<div class="io-notice-head">' +
        '<div class="io-notice-heading">' +
          '<span class="io-notice-eyebrow">' + esc(COPY.eyebrow) + '</span>' +
          '<strong class="io-notice-title">' + esc(notice.title || notice.issuer || '') + '</strong>' +
          '<div class="io-notice-meta"><span class="io-notice-meta-item">' + esc(notice.issuer || '') + '</span>' + meta + '</div>' +
        '</div>' +
        source +
      '</div>' +
      summary +
      why +
      actions +
      limits +
      attachments +
    '</article>';
  }).join('') + '</div>';
}
`;
}

export const OFFICIAL_NOTICE_CARD_STYLES = `
  .io-notice-list { display: grid; gap: 12px; margin-top: 12px; }
  .io-notice-card { padding: 14px 16px; border-radius: 18px; background: linear-gradient(180deg, rgba(255,255,255,.98), rgba(248,250,252,.96)); border: 1px solid rgba(148,163,184,.18); box-shadow: 0 10px 24px rgba(15,23,42,.06); }
  .io-notice-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
  .io-notice-heading { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
  .io-notice-eyebrow { display: inline-flex; align-items: center; min-height: 24px; width: fit-content; padding: 2px 8px; border-radius: 999px; background: rgba(14,165,233,.1); color: #0369a1; font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; }
  .io-notice-title { font-size: 15px; font-weight: 900; letter-spacing: -.01em; color: #0f172a; line-height: 1.35; }
  .io-notice-meta { display: flex; flex-wrap: wrap; gap: 6px 10px; }
  .io-notice-meta-item { font-size: 11px; color: #64748b; font-weight: 700; }
  .io-notice-source { flex-shrink: 0; font-size: 12px; font-weight: 800; color: #0369a1; text-decoration: none; }
  .io-notice-section { margin-top: 10px; }
  .io-notice-sublabel { font-size: 10px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase; color: #475569; margin-bottom: 4px; }
  .io-notice-section p { margin: 0; font-size: 12px; color: #334155; line-height: 1.65; }
  .io-notice-section ul { margin: 0; padding-left: 18px; display: grid; gap: 4px; }
  .io-notice-section li { font-size: 12px; color: #334155; line-height: 1.55; }
  .io-notice-actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .io-notice-action { display: inline-flex; align-items: center; justify-content: center; min-height: 40px; padding: 10px 14px; border-radius: 999px; border: 1px solid rgba(14,165,233,.18); background: rgba(255,255,255,.94); color: #0f172a; font-size: 12px; font-weight: 800; text-decoration: none; }
  .io-notice-action.is-primary { background: #0f172a; color: #fff; border-color: #0f172a; }
  .io-notice-attachments { display: flex; flex-wrap: wrap; gap: 8px; }
  .io-notice-attachment { display: inline-flex; align-items: center; min-height: 34px; padding: 8px 12px; border-radius: 999px; background: rgba(226,232,240,.56); color: #0f172a; font-size: 12px; font-weight: 700; text-decoration: none; }
  @media (max-width: 640px) {
    .io-notice-head { flex-direction: column; }
    .io-notice-source { align-self: flex-start; }
  }
`;
