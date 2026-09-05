/** Shared, dependency-free chrome for materialized pages and native Worker readers. */
export function isAppExperiencePath(path: string): boolean {
  const pathname = (path.split(/[?#]/, 1)[0] ?? "/").replace(/^\/(ja|en|es|pt-br)(?=\/|$)/i, "") || "/";
  return /^\/(?:$|home\/?$|records(?:\/|$)|observations\/|record(?:\/|$)|map(?:\/|$)|profile(?:\/|$)|community\/events(?:\/|$))/.test(pathname);
}

const labels = {
  ja: ["ホーム", "記録", "撮る", "場所", "参加", "自分", "本文へ", "主なページ"],
  en: ["Home", "Records", "Capture", "Places", "Join", "Account", "Skip to content", "Main pages"],
  es: ["Inicio", "Registros", "Capturar", "Lugares", "Participar", "Cuenta", "Ir al contenido", "Páginas principales"],
  "pt-br": ["Início", "Registros", "Capturar", "Lugares", "Participar", "Conta", "Ir ao conteúdo", "Páginas principais"],
};
const icons = [
  '<path d="m3 11 9-7 9 7M5 10v10h14V10M9 20v-6h6v6"/>',
  '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M8 9h8M8 13h8M8 17h5"/>',
  '<path d="M8 6 9 3h6l1 3h4v15H4V6Z"/><circle cx="12" cy="13" r="4"/>',
  '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  '<circle cx="9" cy="8" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4M17 5a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 5v2"/>',
];

export function renderAppExperienceNavigation(lang: string, active: number, placement: "header" | "bottom", member = false): string {
  const language = lang.toLowerCase() as keyof typeof labels;
  const copy = labels[language] ?? labels.ja;
  const prefix = `/${labels[language] ? language : "ja"}`;
  const paths = ["/", `/records?view=${member ? "mine" : "public"}`, "/record", "/map?tab=places", "/community/events"];
  return `<nav class="zukan-app-nav is-${placement}" aria-label="${copy[7]}">${(placement === "header" ? [0, 1, 3, 4, 2] : [0, 1, 2, 3, 4]).map((index) => `<a href="${prefix}${paths[index]}"${active === index ? ' aria-current="page"' : ""}${index === 2 ? ' class="is-capture"' : ""}><svg viewBox="0 0 24 24" aria-hidden="true">${icons[index]}</svg><span>${copy[index]}</span></a>`).join("")}</nav>`;
}

export function renderAppExperienceHeader(lang: string, active: number, member = false, mainId = "main-content"): string {
  const language = lang.toLowerCase() as keyof typeof labels;
  const copy = labels[language] ?? labels.ja;
  const prefix = `/${labels[language] ? language : "ja"}`;
  return `<a class="zukan-app-skip" href="#${mainId}">${copy[6]}</a><header class="zukan-app-header"><div><a class="zukan-app-brand" href="${prefix}/" aria-label="ZUKAN"><img src="/assets/brand/zukan-app-icon-192.png" alt="" width="32" height="32"><img src="/assets/brand/zukan-wordmark.svg" alt="" width="92" height="29"></a>${renderAppExperienceNavigation(lang, active, "header", member)}<a class="zukan-app-account" href="${prefix}/profile">${copy[5]}</a></div></header>`;
}

export const APP_EXPERIENCE_STYLES = `
/* Adopted app surface: one primary navigation at each viewport. */
body[data-zukan-app-experience]{--zukan-green:#143f2e;--zukan-ink:#17211b;--zukan-muted:#55615a;--zukan-line:#dce2dc;--zukan-paper:#f7f7f3;color:var(--zukan-ink);background:#fff;font-size:16px;line-height:1.65}
body[data-zukan-app-experience] *{box-sizing:border-box}
body[data-zukan-app-experience] :is(button,input,textarea,select){font:inherit}
body[data-zukan-app-experience] :is(button,summary,input:not([type=hidden]),select){min-height:44px}
body[data-zukan-app-experience] :is(a,button,input,select,textarea,summary):focus-visible{outline:3px solid #c18100;outline-offset:3px}
body[data-zukan-app-experience] :is(h1,h2,h3){text-wrap:balance;overflow-wrap:anywhere;line-height:1.3}
body[data-zukan-app-experience] h1{letter-spacing:-.025em}
body[data-zukan-app-experience] [hidden]{display:none!important}
body[data-zukan-app-experience] .site-shell{padding-left:0;padding-right:0}
body[data-zukan-app-experience] .site-shell>.shell{margin-left:auto;margin-right:auto;width:100%;max-width:1200px}
body[data-zukan-app-experience] .site-header{position:sticky;top:0;z-index:80;background:#fff;border-bottom:1px solid var(--zukan-line);backdrop-filter:none}
body[data-zukan-app-experience] .site-header-inner{display:flex!important;align-items:center;justify-content:space-between;height:72px;max-width:1248px;margin:auto;padding:0 24px;gap:24px}
body[data-zukan-app-experience] .home-header-actions.is-member{display:none}
body[data-zukan-app-experience] [data-home-auth-state=member] .home-header-actions.is-member{display:flex}
body[data-zukan-app-experience] [data-home-auth-state=member] .home-header-actions.is-guest{display:none}
html[data-auth=signed-in] body[data-zukan-app-experience] .home-header-actions.is-member{display:flex}
html[data-auth=signed-in] body[data-zukan-app-experience] .home-header-actions.is-guest{display:none}
body[data-zukan-app-experience] .zukan-app-language .lang-switch-desktop{display:flex!important}
body[data-zukan-app-experience] .zukan-app-language{margin-left:auto}
body[data-zukan-app-experience] .site-brand-cluster{flex:0 0 auto;width:auto;min-width:0}
body[data-zukan-app-experience] .site-core-nav{display:flex;margin:auto;gap:6px}
body[data-zukan-app-experience] .site-core-nav-link{min-height:44px;padding:10px 16px;font-size:15px;font-weight:650;color:var(--zukan-muted);border-radius:8px}
body[data-zukan-app-experience] .site-core-nav-link[aria-current=page]{color:var(--zukan-green);background:#edf3ee}
body[data-zukan-app-experience] .site-core-nav-link.is-capture{color:#fff;background:var(--zukan-green)}
.zukan-app-header{position:sticky;top:0;z-index:80;background:#fff;border-bottom:1px solid var(--zukan-line)}
.zukan-app-header>div{display:flex;align-items:center;justify-content:space-between;gap:24px;max-width:1248px;height:72px;margin:auto;padding:0 24px}
.zukan-app-brand{display:inline-flex;align-items:center;gap:8px;min-height:44px;flex-shrink:0}.zukan-app-brand img{object-fit:contain}
.zukan-app-account{display:inline-flex;align-items:center;justify-content:center;min-height:44px;min-width:44px;padding:0 12px;color:var(--zukan-green);font-size:14px;text-decoration:none}
.zukan-app-nav{display:flex;gap:6px}.zukan-app-nav a{display:flex;align-items:center;justify-content:center;gap:8px;min-height:44px;padding:8px 16px;text-decoration:none;color:var(--zukan-muted);font-size:15px;font-weight:650;border-radius:8px}.zukan-app-nav a[aria-current=page]{color:var(--zukan-green);background:#edf3ee}.zukan-app-nav a.is-capture{background:var(--zukan-green);color:#fff}.zukan-app-nav svg{width:21px;height:21px;stroke:currentColor;fill:none;stroke-width:1.7;stroke-linejoin:round;stroke-linecap:round;flex-shrink:0}.zukan-app-nav.is-header svg{display:none}.zukan-app-nav.is-bottom{display:none}
.zukan-app-skip{position:fixed;top:-120px;left:16px;z-index:200;padding:12px 20px;background:#fff;color:var(--zukan-green)}.zukan-app-skip:focus{top:8px}
body[data-zukan-app-experience] .home-state-view{gap:56px;padding-top:32px}
body[data-zukan-app-experience] .home-guest-hero{min-height:0;gap:32px;padding-block:20px}
body[data-zukan-app-experience] .home-guest-hero.has-visual{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
body[data-zukan-app-experience] .home-guest-hero h1{font-size:clamp(32px,3.5vw,48px);line-height:1.35}
body[data-zukan-app-experience] .home-guest-proof{min-height:0;aspect-ratio:4/3;grid-template-columns:1fr;grid-template-rows:1fr;border-radius:16px}
body[data-zukan-app-experience] .home-guest-proof .is-item-1{grid-column:1;grid-row:1}
body[data-zukan-app-experience] .home-guest-proof.is-empty{aspect-ratio:auto;border:1px solid var(--zukan-line);background:var(--zukan-paper);grid-template-rows:auto}
body[data-zukan-app-experience] .home-empty-proof-copy{padding:20px;gap:10px;background:none}
body[data-zukan-app-experience] .home-empty-proof-copy strong{font-size:20px}
body[data-zukan-app-experience] .home-empty-proof-copy p{font-size:15px!important}
body[data-zukan-app-experience] .home-place-section{grid-template-columns:1fr;border-block:1px solid var(--zukan-line);border-radius:0;background:#fff}
body[data-zukan-app-experience] .home-place-section>div:last-child{padding:28px 0}
body[data-zukan-app-experience] .home-community-section{border:0;border-top:1px solid var(--zukan-line);border-radius:0;background:#fff;padding:28px 0}
body[data-zukan-app-experience] .home-member-primary{border-radius:16px}
body[data-zukan-app-experience] .home-member-primary.is-memory{grid-template-columns:1fr 1fr}
body[data-zukan-app-experience] .home-member-primary-media .home-card-media{min-height:0;aspect-ratio:4/3;height:auto}
body[data-zukan-app-experience] .home-recent-grid{display:grid;grid-auto-flow:row;grid-template-columns:repeat(3,minmax(0,1fr));overflow:visible;gap:20px}
body[data-zukan-app-experience] .home-recent-card .home-card-media{aspect-ratio:4/3}
body[data-zukan-app-experience] .cf-record-shell{max-width:680px;margin-block:32px 64px}
body[data-zukan-app-experience] :is(.cf-record-form,.cf-record-pick){box-shadow:none;border-color:var(--zukan-line);border-radius:12px}
body[data-zukan-app-experience] .cf-record-submit button{background:var(--zukan-green)}
body[data-zukan-app-experience] .cf-record-coordinates{background:var(--zukan-paper)}
body[data-zukan-app-experience] .cf-record-status{color:var(--zukan-green);font-weight:600}
body[data-zukan-app-experience] .cf-recovery-card{background:#fff;border:1px solid var(--zukan-line);border-radius:12px;box-shadow:none}
body[data-zukan-app-experience] .cf-recovery-actions .primary{background:var(--zukan-green)}
body[data-zukan-app-experience] .of-header{position:static;border:0;max-width:1160px;margin:auto;height:auto;padding:12px 24px}
body[data-zukan-app-experience] .of-page{max-width:1160px;margin:0 auto}
body[data-zukan-app-experience] .of-layout{grid-template-columns:minmax(0,1.05fr) minmax(0,1fr)}
body[data-zukan-app-experience] .of-media-column{top:88px}
body[data-zukan-app-experience] .of-media-stage{min-height:0;background:var(--zukan-paper);border-radius:12px;overflow:hidden}
body[data-zukan-app-experience] .of-media-slide{min-height:0;aspect-ratio:4/3}
body[data-zukan-app-experience] .of-media-slide :is(img,video){width:100%;height:100%;max-height:65vh;object-fit:contain}
body[data-zukan-app-experience] .of-panel{padding:0 24px 32px;border:0;min-height:0}
body[data-zukan-app-experience] .of-record-info h1{font-size:30px}
body[data-zukan-app-experience] :is(.of-summary,.of-scene,.of-environment,.of-comparison,.of-note,.of-manage,.of-capture){border-radius:8px;box-shadow:none}
body[data-zukan-app-experience] .of-note{background:#fff;border:0;border-block:1px solid var(--zukan-line);border-radius:0;padding:20px 0}
body[data-zukan-app-experience] .of-meta{font-size:14px}
@media(min-width:1161px){body[data-zukan-app-experience] .global-record-launcher{display:none!important}body[data-zukan-app-experience] .site-shell.has-global-record-launcher{padding-bottom:24px}}
@media(max-width:1160px){
 body[data-zukan-app-experience]{padding-bottom:calc(76px + env(safe-area-inset-bottom))}
 body[data-zukan-app-experience] .site-header-inner,.zukan-app-header>div{height:64px;padding:0 16px}
 body[data-zukan-app-experience] .site-core-nav,.zukan-app-nav.is-header{display:none!important}
 body[data-zukan-app-experience] .global-record-launcher,.zukan-app-nav.is-bottom{display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr));position:fixed;z-index:85;left:0;right:0;bottom:0;width:100%;max-width:none;transform:none;gap:4px;padding:6px 8px calc(6px + env(safe-area-inset-bottom));border:0;border-top:1px solid var(--zukan-line);border-radius:0;background:#fff;box-shadow:none}
 .zukan-app-nav.is-bottom a{flex-direction:column;gap:3px;font-size:12px;min-height:56px;padding:6px 0}
 body[data-zukan-app-experience] .global-record-choice{min-height:56px;padding:5px 0;border-radius:8px;font-size:12px}
 body[data-zukan-app-experience] .site-shell.has-global-record-launcher{padding-bottom:0}
 body[data-zukan-app-experience] .home-recent-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
 body[data-zukan-app-experience] .of-media-column{top:80px}
}
@media(max-width:767px){
 body[data-zukan-app-experience] .home-state-view{gap:36px;padding-top:16px}
 body[data-zukan-app-experience] .home-guest-hero.has-visual,body[data-zukan-app-experience] .home-member-primary.is-memory{grid-template-columns:1fr}
 body[data-zukan-app-experience] .home-guest-hero h1{font-size:32px}
 body[data-zukan-app-experience] .home-recent-grid{grid-template-columns:1fr;gap:12px}
 body[data-zukan-app-experience] .home-recent-card{grid-template-columns:104px minmax(0,1fr);gap:14px;align-items:center}
 body[data-zukan-app-experience] .home-recent-card .home-card-media{aspect-ratio:1}
 body[data-zukan-app-experience] .of-layout{display:grid;grid-template-columns:1fr}
 body[data-zukan-app-experience] .of-panel{display:contents}
 body[data-zukan-app-experience] .of-record-info{grid-row:1;padding:8px 16px 16px}
 body[data-zukan-app-experience] .of-media-column{position:static;grid-row:2;padding:0 16px 16px}
 body[data-zukan-app-experience] .of-panel> :not(.of-record-info){margin:0 16px 16px}
 body[data-zukan-app-experience] .of-record-info h1{font-size:26px}
 body[data-zukan-app-experience] .of-observation-details[open],body[data-zukan-app-experience] .of-manage[open]{position:static;inset:auto;overflow:visible;padding:16px;border-radius:8px}
 body[data-zukan-app-experience] .of-header{padding:8px 16px}
}
@media(prefers-reduced-motion:reduce){body[data-zukan-app-experience] *{scroll-behavior:auto!important}}
@media(max-width:430px){body[data-zukan-app-experience] .site-header-inner{gap:8px}body[data-zukan-app-experience] .home-header-login{padding-inline:8px}}
`;
