import { renderZukanCommonShell } from "./zukanLibraryAndProfile";
import { OBSERVATION_EVENT_LIST_STYLES } from "../../src/ui/observationEventList";

type Lang = "ja" | "en" | "es" | "pt-br";

const LIST_SKIN = `
.zl{max-width:720px;margin:0 auto;width:100%}
.zl .zukan-participation-shell{width:100%;margin:0;padding:0 0 24px;color:#17251b}
.zl .zukan-participation-header{padding:0 0 8px;border:0}
.zl .zukan-participation-eyebrow,.zl .zukan-participation-header p{display:none}
.zl .zukan-participation-header h1{font-size:1.5rem;line-height:1.4;letter-spacing:0}
.zl .zukan-participation-section{margin-top:20px}
.zl .zukan-participation-section h2{font-size:1.125rem;margin:0 0 8px}
.zl .zukan-participation-list{border-top:0}
.zl .zukan-participation-row{grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"time act" "body act";gap:4px 12px;padding:16px 0;align-items:start}
.zl .zukan-participation-time{grid-area:time;display:flex;gap:8px;align-items:baseline;flex-wrap:wrap;color:#55615a;font-size:.9375rem}
.zl .zukan-participation-time time{font-weight:700;color:#17251b}
.zl .zukan-participation-row>div:nth-child(2){grid-area:body;min-width:0}
.zl .zukan-participation-row-action{grid-area:act;align-self:center}
.zl .zukan-participation-row h3{font-size:1.0625rem}
.zl .zukan-participation-status{display:inline-block;margin:0;padding:2px 10px;border-radius:999px;background:#e8f0ea;color:#143F2E;font-size:.8125rem}
.zl .zukan-participation-facts{display:flex;flex-wrap:wrap;gap:2px 14px}
.zl .zukan-participation-facts div{display:flex;gap:6px}
.zl .zukan-participation-facts dt,.zl .zukan-participation-facts dd{margin:0;font-size:.9375rem}
.zl .zukan-participation-action,.zl .zukan-participation-action:visited{border-radius:999px;border-color:#143F2E;background:#143F2E;color:#fff;min-height:44px;padding:9px 20px}
.zl .zukan-participation-secondary-action,.zl .zukan-participation-secondary-action:visited{border-radius:999px;border:1.5px solid #143F2E;color:#143F2E}
.zl .zukan-participation-notice{margin:12px 0;padding:14px 16px;border-radius:16px;background:#f7f7f3}
.zl .zukan-participation-organizer{margin-top:24px;padding-top:16px;border-top:1px solid #dde2dc}
.zl .zukan-participation-organizer h2{font-size:1.125rem;margin:0 0 8px}
.zl .zukan-participation-empty{padding:24px 16px;border:1px solid #dde2dc;border-radius:20px;justify-items:center;text-align:center;background:#fff}
@media(max-width:480px){.zl .zukan-participation-row{grid-template-columns:minmax(0,1fr);grid-template-areas:"time" "body" "act"}.zl .zukan-participation-row-action{align-self:start}}
`;

export function renderZukanEventListDocument(options: {
  lang: Lang;
  title: string;
  bodyHtml: string;
  authenticated: boolean;
  displayName?: string | null;
}): string {
  const prefix = options.lang === "ja" ? "/ja" : `/${options.lang}`;
  return renderZukanCommonShell({
    lang: options.lang,
    title: options.title,
    activeNav: "events",
    authenticated: options.authenticated,
    displayName: options.displayName ?? null,
    bodyHtml: `<style>${OBSERVATION_EVENT_LIST_STYLES}${LIST_SKIN}</style><div class="zl" data-event-view="f5-list">${options.bodyHtml}</div>`,
    pathname: `${prefix}/community/events`,
  });
}

