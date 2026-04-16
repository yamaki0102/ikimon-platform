import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import { escapeHtml } from "./siteShell.js";

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
        { icon: "📖", label: "フィールドノート", href: withBasePath(basePath, "/notes"), emphasis: "primary" },
        { icon: "✍️", label: "1件記録する", href: withBasePath(basePath, "/record") },
        { icon: "🔍", label: "AIレンズ", href: withBasePath(basePath, "/lens") },
        { icon: "📡", label: "フィールドスキャン", href: withBasePath(basePath, "/scan") },
        { icon: "🗺️", label: "探索マップ", href: withBasePath(basePath, "/map") },
      ],
    },
    en: {
      ariaLabel: "Primary notebook routes",
      chips: [
        { icon: "📖", label: "Field Note", href: withBasePath(basePath, "/notes"), emphasis: "primary" },
        { icon: "✍️", label: "Record one", href: withBasePath(basePath, "/record") },
        { icon: "🔍", label: "AI Lens", href: withBasePath(basePath, "/lens") },
        { icon: "📡", label: "Field Scan", href: withBasePath(basePath, "/scan") },
        { icon: "🗺️", label: "Map", href: withBasePath(basePath, "/map") },
      ],
    },
    es: {
      ariaLabel: "Rutas principales del cuaderno",
      chips: [
        { icon: "📖", label: "Cuaderno", href: withBasePath(basePath, "/notes"), emphasis: "primary" },
        { icon: "✍️", label: "Registrar", href: withBasePath(basePath, "/record") },
        { icon: "🔍", label: "Lente IA", href: withBasePath(basePath, "/lens") },
        { icon: "📡", label: "Escaneo", href: withBasePath(basePath, "/scan") },
        { icon: "🗺️", label: "Mapa", href: withBasePath(basePath, "/map") },
      ],
    },
    "pt-BR": {
      ariaLabel: "Rotas principais do caderno",
      chips: [
        { icon: "📖", label: "Caderno", href: withBasePath(basePath, "/notes"), emphasis: "primary" },
        { icon: "✍️", label: "Registrar", href: withBasePath(basePath, "/record") },
        { icon: "🔍", label: "Lente IA", href: withBasePath(basePath, "/lens") },
        { icon: "📡", label: "Escaneamento", href: withBasePath(basePath, "/scan") },
        { icon: "🗺️", label: "Mapa", href: withBasePath(basePath, "/map") },
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
      return `<a class="${classes.join(" ")}" href="${escapeHtml(href)}"${rel} data-kpi-action="quicknav:${escapeHtml(chip.label)}">
        <span class="quick-nav-chip-icon" aria-hidden="true">${escapeHtml(chip.icon)}</span>
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
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
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
    font-size: 18px;
    flex-shrink: 0;
  }
  .quick-nav-chip.is-primary .quick-nav-chip-icon { background: rgba(255,255,255,.7); }
  .quick-nav-chip-label { letter-spacing: -.01em; line-height: 1.35; }
  @media (max-width: 980px) {
    .quick-nav-inner { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (max-width: 640px) {
    .quick-nav-inner { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
`;
