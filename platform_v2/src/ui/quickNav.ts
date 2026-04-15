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
      ariaLabel: "主要機能",
      chips: [
        { icon: "🔍", label: "AIレンズ", href: withBasePath(basePath, "/lens"), emphasis: "primary" },
        { icon: "📡", label: "フィールドスキャン", href: withBasePath(basePath, "/scan") },
        { icon: "🗺️", label: "探索マップ", href: withBasePath(basePath, "/map") },
        { icon: "📚", label: "図鑑", href: "/zukan.php", external: true },
        { icon: "🧭", label: "コンパス", href: "/compass.php", external: true },
      ],
    },
    en: {
      ariaLabel: "Primary features",
      chips: [
        { icon: "🔍", label: "AI Lens", href: withBasePath(basePath, "/lens"), emphasis: "primary" },
        { icon: "📡", label: "Field Scan", href: withBasePath(basePath, "/scan") },
        { icon: "🗺️", label: "Map", href: withBasePath(basePath, "/map") },
        { icon: "📚", label: "Field Guide", href: "/zukan.php", external: true },
        { icon: "🧭", label: "Compass", href: "/compass.php", external: true },
      ],
    },
    es: {
      ariaLabel: "Funciones principales",
      chips: [
        { icon: "🔍", label: "Lente IA", href: withBasePath(basePath, "/lens"), emphasis: "primary" },
        { icon: "📡", label: "Escaneo", href: withBasePath(basePath, "/scan") },
        { icon: "🗺️", label: "Mapa", href: withBasePath(basePath, "/map") },
        { icon: "📚", label: "Guía", href: "/zukan.php", external: true },
        { icon: "🧭", label: "Brújula", href: "/compass.php", external: true },
      ],
    },
    "pt-BR": {
      ariaLabel: "Funcionalidades principais",
      chips: [
        { icon: "🔍", label: "Lente IA", href: withBasePath(basePath, "/lens"), emphasis: "primary" },
        { icon: "📡", label: "Escaneamento", href: withBasePath(basePath, "/scan") },
        { icon: "🗺️", label: "Mapa", href: withBasePath(basePath, "/map") },
        { icon: "📚", label: "Guia", href: "/zukan.php", external: true },
        { icon: "🧭", label: "Bússola", href: "/compass.php", external: true },
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
  .quick-nav { margin-top: 20px; }
  .quick-nav-inner { display: flex; flex-wrap: wrap; gap: 10px; }
  .quick-nav-chip { display: inline-flex; align-items: center; gap: 8px; padding: 10px 16px; border-radius: 999px; background: #fff; border: 1px solid rgba(15,23,42,.06); box-shadow: 0 4px 10px rgba(15,23,42,.04); color: #0f172a; font-size: 13px; font-weight: 800; text-decoration: none; transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease; }
  .quick-nav-chip:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(15,23,42,.08); border-color: rgba(14,165,233,.28); }
  .quick-nav-chip.is-primary { background: linear-gradient(135deg,#ecfdf5,#e0f2fe); border-color: rgba(16,185,129,.24); color: #065f46; }
  .quick-nav-chip-icon { font-size: 16px; }
  .quick-nav-chip-label { letter-spacing: -.01em; }
`;
