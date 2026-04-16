import { withBasePath } from "../httpBasePath.js";
import { appendLangToHref, type SiteLang } from "../i18n.js";
import { escapeHtml } from "./siteShell.js";

type DemoLoginCopy = {
  eyebrowStaging: string;
  enterLabel: string;
  exitLabel: string;
  activeLabel: string;
};

const copyByLang: Record<SiteLang, DemoLoginCopy> = {
  ja: {
    eyebrowStaging: "staging 限定 · 本番では表示されません",
    enterLabel: "demo ユーザーで表示する",
    exitLabel: "demo を終える",
    activeLabel: "demo ユーザーで表示中",
  },
  en: {
    eyebrowStaging: "staging only — hidden in production",
    enterLabel: "View as demo user",
    exitLabel: "Exit demo",
    activeLabel: "Viewing as demo user",
  },
  es: {
    eyebrowStaging: "solo staging — oculto en producción",
    enterLabel: "Ver como usuario demo",
    exitLabel: "Salir del demo",
    activeLabel: "Viendo como usuario demo",
  },
  "pt-BR": {
    eyebrowStaging: "apenas staging — oculto em produção",
    enterLabel: "Ver como usuário demo",
    exitLabel: "Sair do demo",
    activeLabel: "Vendo como usuário demo",
  },
};

/**
 * Demo login banner. Only rendered when ALLOW_QUERY_USER_ID=1 is set on the
 * server (staging opt-in, see services/viewerIdentity.ts). In production the
 * flag is not set, so this banner never renders and the demo link cannot be
 * followed — `?userId=` is silently ignored by resolveViewer there.
 */
export function renderDemoLoginBanner(
  basePath: string,
  lang: SiteLang,
  options: {
    demoUserId: string;
    isDemoView: boolean;
  },
): string {
  if (process.env.ALLOW_QUERY_USER_ID !== "1") return "";
  if (!options.demoUserId) return "";

  const copy = copyByLang[lang];
  const enterHref = appendLangToHref(
    withBasePath(basePath, `/?userId=${encodeURIComponent(options.demoUserId)}`),
    lang,
  );
  const exitHref = appendLangToHref(withBasePath(basePath, "/"), lang);

  if (options.isDemoView) {
    return `<aside class="demo-login-banner is-active" role="note" aria-label="${escapeHtml(copy.activeLabel)}">
      <span class="demo-login-banner-dot" aria-hidden="true"></span>
      <span class="demo-login-banner-eyebrow">${escapeHtml(copy.eyebrowStaging)}</span>
      <span class="demo-login-banner-active">${escapeHtml(copy.activeLabel)}</span>
      <a class="demo-login-banner-cta" href="${escapeHtml(exitHref)}" data-kpi-action="demologin:exit">${escapeHtml(copy.exitLabel)} →</a>
    </aside>`;
  }

  return `<aside class="demo-login-banner" role="note" aria-label="${escapeHtml(copy.eyebrowStaging)}">
    <span class="demo-login-banner-dot" aria-hidden="true"></span>
    <span class="demo-login-banner-eyebrow">${escapeHtml(copy.eyebrowStaging)}</span>
    <a class="demo-login-banner-cta" href="${escapeHtml(enterHref)}" data-kpi-action="demologin:enter">${escapeHtml(copy.enterLabel)} →</a>
  </aside>`;
}

export const DEMO_LOGIN_BANNER_STYLES = `
  .demo-login-banner {
    margin: 14px auto 0;
    max-width: 760px;
    padding: 10px 18px;
    border-radius: 14px;
    background: linear-gradient(135deg, rgba(234,179,8,.06), rgba(16,185,129,.06));
    border: 1px dashed rgba(234,179,8,.4);
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    flex-wrap: wrap;
    font-size: 12px;
  }
  .demo-login-banner.is-active {
    background: linear-gradient(135deg, rgba(99,102,241,.08), rgba(16,185,129,.08));
    border-color: rgba(99,102,241,.4);
    border-style: solid;
  }
  .demo-login-banner-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #eab308;
    box-shadow: 0 0 0 3px rgba(234,179,8,.18);
    flex-shrink: 0;
  }
  .demo-login-banner.is-active .demo-login-banner-dot {
    background: #6366f1;
    box-shadow: 0 0 0 3px rgba(99,102,241,.18);
  }
  .demo-login-banner-eyebrow {
    font-weight: 800;
    letter-spacing: .06em;
    text-transform: uppercase;
    color: #713f12;
    font-size: 10px;
  }
  .demo-login-banner.is-active .demo-login-banner-eyebrow { color: #3730a3; }
  .demo-login-banner-active { font-weight: 800; color: #1e1b4b; flex: 1 1 auto; }
  .demo-login-banner-cta {
    margin-left: auto;
    font-weight: 800;
    color: #0f172a;
    text-decoration: underline;
    text-underline-offset: 3px;
  }
  .demo-login-banner-cta:hover { color: #334155; }
`;
