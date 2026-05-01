import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import { getShortCopy } from "../content/index.js";
import { escapeHtml } from "./siteShell.js";

// Lucide icons inlined as SVG (https://lucide.dev) — chosen over CDN to keep SSR
// self-contained and avoid a flash of unstyled icons on first paint.
const SVG_ATTRS = `xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
const ICON_BOOK_OPEN = `<svg ${SVG_ATTRS}><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg>`;
const ICON_PEN_LINE = `<svg ${SVG_ATTRS}><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>`;
const ICON_SEARCH = `<svg ${SVG_ATTRS}><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>`;
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

type QuickNavLabels = {
  notes: string;
  record: string;
  lens: string;
  scan: string;
  map: string;
};

function chips(basePath: string): Record<SiteLang, QuickNavCopy> {
  const jaLabels = getShortCopy<QuickNavLabels>("ja", "shared", "quickNav.labels");
  const enLabels = getShortCopy<QuickNavLabels>("en", "shared", "quickNav.labels");
  const esLabels = getShortCopy<QuickNavLabels>("es", "shared", "quickNav.labels");
  const ptBRLabels = getShortCopy<QuickNavLabels>("pt-BR", "shared", "quickNav.labels");
  return {
    ja: {
      ariaLabel: getShortCopy<string>("ja", "shared", "quickNav.ariaLabel"),
      chips: [
        { icon: ICON_BOOK_OPEN, label: jaLabels.notes, href: withBasePath(basePath, "/notes"), emphasis: "primary" },
        { icon: ICON_PEN_LINE, label: jaLabels.record, href: withBasePath(basePath, "/record") },
        { icon: ICON_SEARCH, label: jaLabels.lens, href: withBasePath(basePath, "/guide") },
        { icon: ICON_MAP, label: jaLabels.map, href: withBasePath(basePath, "/map") },
      ],
    },
    en: {
      ariaLabel: getShortCopy<string>("en", "shared", "quickNav.ariaLabel"),
      chips: [
        { icon: ICON_BOOK_OPEN, label: enLabels.notes, href: withBasePath(basePath, "/notes"), emphasis: "primary" },
        { icon: ICON_PEN_LINE, label: enLabels.record, href: withBasePath(basePath, "/record") },
        { icon: ICON_SEARCH, label: enLabels.lens, href: withBasePath(basePath, "/guide") },
        { icon: ICON_MAP, label: enLabels.map, href: withBasePath(basePath, "/map") },
      ],
    },
    es: {
      ariaLabel: getShortCopy<string>("es", "shared", "quickNav.ariaLabel"),
      chips: [
        { icon: ICON_BOOK_OPEN, label: esLabels.notes, href: withBasePath(basePath, "/notes"), emphasis: "primary" },
        { icon: ICON_PEN_LINE, label: esLabels.record, href: withBasePath(basePath, "/record") },
        { icon: ICON_SEARCH, label: esLabels.lens, href: withBasePath(basePath, "/guide") },
        { icon: ICON_MAP, label: esLabels.map, href: withBasePath(basePath, "/map") },
      ],
    },
    "pt-BR": {
      ariaLabel: getShortCopy<string>("pt-BR", "shared", "quickNav.ariaLabel"),
      chips: [
        { icon: ICON_BOOK_OPEN, label: ptBRLabels.notes, href: withBasePath(basePath, "/notes"), emphasis: "primary" },
        { icon: ICON_PEN_LINE, label: ptBRLabels.record, href: withBasePath(basePath, "/record") },
        { icon: ICON_SEARCH, label: ptBRLabels.lens, href: withBasePath(basePath, "/guide") },
        { icon: ICON_MAP, label: ptBRLabels.map, href: withBasePath(basePath, "/map") },
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
  .quick-nav { margin-top: 14px; }
  .quick-nav-inner {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    max-width: none;
  }
  .quick-nav-chip {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 58px;
    padding: 12px 14px;
    border-radius: 20px;
    background: rgba(255,255,255,.92);
    border: 1px solid rgba(15,23,42,.06);
    box-shadow: 0 8px 20px rgba(15,23,42,.045);
    color: #0f172a;
    font-size: 13px;
    font-weight: 800;
    text-decoration: none;
    transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease;
  }
  .quick-nav-chip:hover { transform: translateY(-2px); box-shadow: 0 14px 26px rgba(15,23,42,.07); border-color: rgba(14,165,233,.24); }
  .quick-nav-chip.is-primary {
    background: #ecfdf5;
    border-color: rgba(16,185,129,.22);
    color: #065f46;
  }
  .quick-nav-chip-icon {
    width: 36px;
    height: 36px;
    border-radius: 999px;
    display: grid;
    place-items: center;
    background: rgba(15,23,42,.04);
    color: #047857;
    flex-shrink: 0;
  }
  .quick-nav-chip-icon svg { display: block; }
  .quick-nav-chip.is-primary .quick-nav-chip-icon { background: rgba(255,255,255,.7); color: #065f46; }
  .quick-nav-chip-label { letter-spacing: -.01em; line-height: 1.35; }
  @media (max-width: 1020px) {
    .quick-nav-inner { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 720px) {
    .quick-nav { margin-top: 12px; }
    .quick-nav-inner { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .quick-nav-chip { min-height: 56px; padding: 10px; border-radius: 16px; }
    .quick-nav-chip-icon { width: 34px; height: 34px; }
  }
  @media (max-width: 360px) {
    .quick-nav-inner { grid-template-columns: 1fr; }
  }
`;
