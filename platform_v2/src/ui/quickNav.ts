import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import { escapeHtml } from "./siteShell.js";

// Lucide icons inlined as SVG (https://lucide.dev) — chosen over CDN to keep SSR
// self-contained and avoid a flash of unstyled icons on first paint.
const SVG_ATTRS = `xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
const ICON_BOOK_OPEN = `<svg ${SVG_ATTRS}><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>`;
const ICON_PEN_LINE = `<svg ${SVG_ATTRS}><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>`;
const ICON_SEARCH = `<svg ${SVG_ATTRS}><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>`;
const ICON_RADAR = `<svg ${SVG_ATTRS}><path d="M19.07 4.93A10 10 0 0 0 6.99 3.34"/><path d="M4 6h.01"/><path d="M2.29 9.62A10 10 0 1 0 21.31 8.35"/><path d="M16.24 7.76A6 6 0 1 0 8.23 16.67"/><path d="M12 18h.01"/><path d="M17.99 11.66A6 6 0 0 1 15.77 16.67"/><circle cx="12" cy="12" r="2"/><path d="m13.41 10.59 5.66-5.66"/></svg>`;
const ICON_MAP = `<svg ${SVG_ATTRS}><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15"/><path d="M9 3.236v15"/></svg>`;

export type QuickNavChip = {
  icon: string;
  label: string;
  href: string;
  external?: boolean;
  emphasis?: "primary" | "neutral";
};

type QuickNavCopy = {
  ariaLabel: string;
  chips: QuickNavChip[];
};

function chips(basePath: string): Record<SiteLang, QuickNavCopy> {
  return {
    ja: {
      ariaLabel: "フィールドノートの主要導線",
      chips: [
        { icon: ICON_BOOK_OPEN, label: "フィールドノート", href: withBasePath(basePath, "/notes"), emphasis: "primary" },
        { icon: ICON_PEN_LINE, label: "1件記録する", href: withBasePath(basePath, "/record") },
        { icon: ICON_SEARCH, label: "AIレンズ", href: withBasePath(basePath, "/lens") },
        { icon: ICON_RADAR, label: "フィールドスキャン", href: withBasePath(basePath, "/scan") },
        { icon: ICON_MAP, label: "探索マップ", href: withBasePath(basePath, "/map") },
      ],
    },
    en: {
      ariaLabel: "Primary notebook routes",
      chips: [
        { icon: ICON_BOOK_OPEN, label: "Field Note", href: withBasePath(basePath, "/notes"), emphasis: "primary" },
        { icon: ICON_PEN_LINE, label: "Record one", href: withBasePath(basePath, "/record") },
        { icon: ICON_SEARCH, label: "AI Lens", href: withBasePath(basePath, "/lens") },
        { icon: ICON_RADAR, label: "Field Scan", href: withBasePath(basePath, "/scan") },
        { icon: ICON_MAP, label: "Map", href: withBasePath(basePath, "/map") },
      ],
    },
    es: {
      ariaLabel: "Rutas principales del cuaderno",
      chips: [
        { icon: ICON_BOOK_OPEN, label: "Cuaderno", href: withBasePath(basePath, "/notes"), emphasis: "primary" },
        { icon: ICON_PEN_LINE, label: "Registrar", href: withBasePath(basePath, "/record") },
        { icon: ICON_SEARCH, label: "Lente IA", href: withBasePath(basePath, "/lens") },
        { icon: ICON_RADAR, label: "Escaneo", href: withBasePath(basePath, "/scan") },
        { icon: ICON_MAP, label: "Mapa", href: withBasePath(basePath, "/map") },
      ],
    },
    "pt-BR": {
      ariaLabel: "Rotas principais do caderno",
      chips: [
        { icon: ICON_BOOK_OPEN, label: "Caderno", href: withBasePath(basePath, "/notes"), emphasis: "primary" },
        { icon: ICON_PEN_LINE, label: "Registrar", href: withBasePath(basePath, "/record") },
        { icon: ICON_SEARCH, label: "Lente IA", href: withBasePath(basePath, "/lens") },
        { icon: ICON_RADAR, label: "Escaneamento", href: withBasePath(basePath, "/scan") },
        { icon: ICON_MAP, label: "Mapa", href: withBasePath(basePath, "/map") },
      ],
    },
  };
}

export function renderQuickNav(basePath: string, lang: SiteLang): string {
  const copy = chips(basePath)[lang];
  const items = copy.chips
    .map((chip) => {
      const classes = ["quick-nav-chip"];
      if (chip.emphasis === "primary") classes.push("is-primary");
      const href = chip.external ? chip.href : appendLangToHref(chip.href, lang);
      const rel = chip.external ? ` rel="nofollow noopener"` : "";
      // chip.icon is a trusted inline SVG string defined as a const in this file
      // (not user input), intentionally not run through escapeHtml.
      return `<a class="${classes.join(" ")}" href="${escapeHtml(href)}"${rel} data-kpi-action="quicknav:${escapeHtml(chip.label)}">
        <span class="quick-nav-chip-icon" aria-hidden="true">${chip.icon}</span>
        <span class="quick-nav-chip-label">${escapeHtml(chip.label)}</span>
      </a>`;
    })
    .join("");
  return `<nav class="quick-nav" aria-label="${escapeHtml(copy.ariaLabel)}">
    <div class="quick-nav-inner">${items}</div>
  </nav>`;
}

export const QUICK_NAV_STYLES = `
  .quick-nav { margin-top: 22px; }
  .quick-nav-inner {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    max-width: 760px;
  }
  .quick-nav-chip {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 62px;
    padding: 14px 16px;
    border-radius: 22px;
    background: rgba(255,255,255,.92);
    border: 1px solid rgba(15,23,42,.06);
    box-shadow: 0 10px 24px rgba(15,23,42,.05);
    color: #0f172a;
    font-size: 13px;
    font-weight: 800;
    text-decoration: none;
    transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
  }
  .quick-nav-chip:hover { transform: translateY(-2px); box-shadow: 0 16px 28px rgba(15,23,42,.08); border-color: rgba(14,165,233,.28); }
  .quick-nav-chip.is-primary {
    background: linear-gradient(135deg, rgba(16,185,129,.12), rgba(14,165,233,.12));
    border-color: rgba(16,185,129,.22);
    color: #065f46;
  }
  .quick-nav-chip-icon {
    width: 38px;
    height: 38px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    background: rgba(15,23,42,.04);
    color: #047857;
    flex-shrink: 0;
  }
  .quick-nav-chip-icon svg { display: block; }
  .quick-nav-chip.is-primary .quick-nav-chip-icon { background: rgba(255,255,255,.7); color: #065f46; }
  .quick-nav-chip-label { letter-spacing: -.01em; line-height: 1.35; }
`;
