import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import { escapeHtml } from "./siteShell.js";

export type ToolCardProps = {
  icon: string;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  href: string;
  badge?: string | null;
};

export function renderToolCard(basePath: string, lang: SiteLang, props: ToolCardProps): string {
  const href = appendLangToHref(withBasePath(basePath, props.href), lang);
  return `<a class="tool-card" href="${escapeHtml(href)}" data-kpi-action="tool:${escapeHtml(props.eyebrow)}">
    <div class="tool-card-icon" aria-hidden="true">${escapeHtml(props.icon)}</div>
    <div class="tool-card-body">
      <div class="tool-card-head">
        <span class="tool-card-eyebrow">${escapeHtml(props.eyebrow)}</span>
        ${props.badge ? `<span class="tool-card-badge">${escapeHtml(props.badge)}</span>` : ""}
      </div>
      <h3 class="tool-card-title">${escapeHtml(props.title)}</h3>
      <p class="tool-card-desc">${escapeHtml(props.body)}</p>
      <span class="tool-card-cta">${escapeHtml(props.ctaLabel)} <span aria-hidden="true">→</span></span>
    </div>
  </a>`;
}

export const TOOL_CARD_STYLES = `
  .tool-card { display: flex; gap: 14px; padding: 18px 20px; border-radius: 20px; background: #fff; border: 1px solid rgba(15,23,42,.06); box-shadow: 0 8px 20px rgba(15,23,42,.04); text-decoration: none; color: inherit; transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease; }
  .tool-card:hover { transform: translateY(-2px); box-shadow: 0 14px 28px rgba(15,23,42,.07); border-color: rgba(14,165,233,.24); }
  .tool-card-icon { flex-shrink: 0; width: 44px; height: 44px; border-radius: 999px; background: #ecfdf5; color: #047857; display: grid; place-items: center; font-size: 11px; font-weight: 950; letter-spacing: 0; }
  .tool-card-body { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
  .tool-card-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .tool-card-eyebrow { font-size: 11px; font-weight: 850; letter-spacing: 0; text-transform: none; color: #059669; }
  .tool-card-badge { font-size: 10px; font-weight: 850; letter-spacing: 0; text-transform: none; padding: 3px 8px; border-radius: 999px; background: rgba(14,165,233,.1); color: #0369a1; }
  .tool-card-title { margin: 0; font-family: "Zen Kaku Gothic New", "Inter", "Noto Sans JP", sans-serif; font-size: 17px; font-weight: 850; line-height: 1.35; letter-spacing: 0; color: #0f172a; }
  .tool-card-desc { margin: 0; font-size: 13px; line-height: 1.75; color: #475569; }
  .tool-card-cta { margin-top: 4px; font-size: 13px; font-weight: 800; color: #0ea5e9; display: inline-flex; align-items: center; gap: 6px; }
`;
