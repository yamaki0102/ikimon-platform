import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, langFromPathPrefix, type SiteLang } from "../i18n.js";
import { getShortCopy, renderLongformPage } from "../content/index.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";
import {
  legacyRedirectEntries,
  listMarketingPages,
  listPagesByLane,
  localizedPageLangs,
  sitePageLabel,
  sitePageSummary,
  type RouteLane,
  type SitePageDefinition,
} from "../siteMap.js";

type MarketingPageMeta = {
  title: string;
  eyebrow: string;
  heading: string;
  lead: string;
  activeNav: "home" | "learn" | "business" | "explore" | "community";
  bodyPageId: string;
  footerNote?: string;
  afterActions?: Array<{ href: string; label: string }>;
};

type ContactFormCopy = {
  categories: Array<{ value: string; label: string }>;
  fields: {
    category: string;
    message: string;
    messagePlaceholder: string;
    messageHint: string;
    name: string;
    namePlaceholder: string;
    organization: string;
    organizationPlaceholder: string;
    email: string;
    emailPlaceholder: string;
    emailHint: string;
  };
  submit: string;
  noscript: string;
  status: {
    loading: string;
    successPrefix: string;
    successSuffix: string;
    errorPrefix: string;
    network: string;
  };
};

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function requestUrl(request: { url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return String(request.raw?.originalUrl ?? request.raw?.url ?? request.url ?? "");
}

function requestCurrentPath(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }): string {
  return withBasePath(requestBasePath(request), requestUrl(request));
}

function isLanguagePrefixedRequest(url: string): boolean {
  const queryIndex = url.indexOf("?");
  const path = queryIndex >= 0 ? url.slice(0, queryIndex) : url;
  return Boolean(langFromPathPrefix(path));
}

function activeNavLabel(activeNav: MarketingPageMeta["activeNav"], lang: SiteLang): string {
  switch (activeNav) {
    case "business":
      return getShortCopy<string>(lang, "shared", "shell.nav.business");
    case "community":
      return getShortCopy<string>(lang, "shared", "shell.nav.community");
    case "explore":
      return getShortCopy<string>(lang, "shared", "shell.nav.explore");
    case "learn":
      return getShortCopy<string>(lang, "shared", "shell.nav.learn");
    default:
      return getShortCopy<string>(lang, "shared", "shell.nav.home");
  }
}

function localizeInternalLinks(html: string, basePath: string, lang: SiteLang): string {
  return html.replace(/href="([^"]+)"/g, (_match, href: string) => {
    if (!href.startsWith("/")) {
      return `href="${escapeHtml(href)}"`;
    }
    return `href="${escapeHtml(appendLangToHref(withBasePath(basePath, href), lang))}"`;
  });
}

function renderAfterActions(basePath: string, lang: SiteLang, actions?: Array<{ href: string; label: string }>): string {
  if (!actions || actions.length === 0) {
    return "";
  }
  return `<div class="doc-link-strip">${actions
    .map((action) => `<a class="inline-link" href="${escapeHtml(appendLangToHref(withBasePath(basePath, action.href), lang))}">${escapeHtml(action.label)}</a>`)
    .join("")}</div>`;
}

function renderContactForm(basePath: string, lang: SiteLang): string {
  const copy = getShortCopy<ContactFormCopy>(lang, "public", "contactForm");
  const submitEndpoint = withBasePath(basePath, "/api/v1/contact/submit");
  const optionsHtml = copy.categories
    .map((category) => `<option value="${escapeHtml(category.value)}">${escapeHtml(category.label)}</option>`)
    .join("");

  return `<section class="section">
    <style>
      .cf-form { display: grid; gap: 14px; max-width: 720px; margin: 0 auto 24px; padding: 24px; border-radius: 22px; background: linear-gradient(180deg, #ffffff, #f8fafc); border: 1px solid rgba(15,23,42,.08); }
      .cf-form label { display: grid; gap: 6px; font-size: 13px; font-weight: 700; color: #111827; }
      .cf-form input, .cf-form select, .cf-form textarea { padding: 10px 12px; border: 1px solid rgba(15,23,42,.15); border-radius: 12px; font-size: 14px; background: #fff; font-family: inherit; }
      .cf-form textarea { min-height: 140px; resize: vertical; }
      .cf-form .cf-required::after { content: " *"; color: #dc2626; }
      .cf-form .cf-hint { font-size: 12px; color: #6b7280; font-weight: 400; }
      .cf-form .cf-actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .cf-form button[type=submit] { padding: 12px 22px; border-radius: 999px; border: none; background: #111827; color: #fff; font-size: 14px; font-weight: 800; cursor: pointer; }
      .cf-form button[type=submit]:disabled { opacity: .5; cursor: not-allowed; }
      .cf-form .cf-status { font-size: 13px; color: #4b5563; }
      .cf-form .cf-status.cf-err { color: #dc2626; font-weight: 700; }
      .cf-form .cf-status.cf-ok { color: #16a34a; font-weight: 700; }
    </style>
    <form class="cf-form" id="cf-form" onsubmit="return false;">
      <label><span class="cf-required">${escapeHtml(copy.fields.category)}</span>
        <select name="category" required>${optionsHtml}</select>
      </label>
      <label><span class="cf-required">${escapeHtml(copy.fields.message)}</span>
        <textarea name="message" required minlength="5" maxlength="8000" placeholder="${escapeHtml(copy.fields.messagePlaceholder)}"></textarea>
        <span class="cf-hint">${escapeHtml(copy.fields.messageHint)}</span>
      </label>
      <label>${escapeHtml(copy.fields.name)}
        <input name="name" type="text" maxlength="200" placeholder="${escapeHtml(copy.fields.namePlaceholder)}" />
      </label>
      <label>${escapeHtml(copy.fields.organization)}
        <input name="organization" type="text" maxlength="200" placeholder="${escapeHtml(copy.fields.organizationPlaceholder)}" />
      </label>
      <label>${escapeHtml(copy.fields.email)}
        <input name="email" type="email" maxlength="200" placeholder="${escapeHtml(copy.fields.emailPlaceholder)}" />
        <span class="cf-hint">${escapeHtml(copy.fields.emailHint)}</span>
      </label>
      <div class="cf-actions">
        <button type="submit" id="cf-submit">${escapeHtml(copy.submit)}</button>
        <span class="cf-status" id="cf-status"></span>
      </div>
      <noscript><p class="cf-status cf-err">${escapeHtml(copy.noscript)}</p></noscript>
    </form>
    <script>
      (function(){
        var form = document.getElementById('cf-form');
        if (!form) return;
        var btn = document.getElementById('cf-submit');
        var status = document.getElementById('cf-status');
        form.addEventListener('submit', async function(ev){
          ev.preventDefault();
          btn.disabled = true;
          status.className = 'cf-status';
          status.textContent = ${JSON.stringify(copy.status.loading)};
          var fd = new FormData(form);
          var payload = {
            category: fd.get('category') || 'question',
            message: fd.get('message') || '',
            name: fd.get('name') || '',
            organization: fd.get('organization') || '',
            email: fd.get('email') || '',
            sourceUrl: location.href,
            userAgent: navigator.userAgent
          };
          try {
            var res = await fetch(${JSON.stringify(submitEndpoint)}, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
              credentials: 'same-origin'
            });
            var data = await res.json().catch(function(){ return {}; });
            if (res.ok && data && data.ok) {
              status.className = 'cf-status cf-ok';
              status.textContent = ${JSON.stringify(copy.status.successPrefix)} + (data.submissionId || '').slice(0, 8) + ${JSON.stringify(copy.status.successSuffix)};
              form.reset();
            } else {
              status.className = 'cf-status cf-err';
              status.textContent = ${JSON.stringify(copy.status.errorPrefix)} + ((data && data.error) ? data.error : ('HTTP ' + res.status));
            }
          } catch (_error) {
            status.className = 'cf-status cf-err';
            status.textContent = ${JSON.stringify(copy.status.network)};
          } finally {
            btn.disabled = false;
          }
        });
      })();
    </script>
  </section>`;
}

const LOWER_PAGE_STYLES = `
  .lower-page { display: grid; gap: 22px; }
  .lower-route-intro { margin-top: 8px; }
  .lower-route-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .lower-route-tile { min-height: 118px; padding: 18px; border-radius: 20px; background: rgba(255,255,255,.82); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 12px 28px rgba(15,23,42,.04); }
  .lower-route-tile strong { display: block; margin: 5px 0 6px; color: #0f172a; font-size: 16px; }
  .lower-route-tile span { display: inline-flex; color: #047857; font-size: 11px; font-weight: 900; letter-spacing: .06em; text-transform: uppercase; }
  .lower-route-tile p { margin: 0; color: #64748b; font-size: 13px; line-height: 1.65; }
  .doc-article { max-width: 880px; margin: 0 auto; }
  .doc-prose { padding: 30px clamp(20px, 4vw, 36px); border-radius: 24px; background: linear-gradient(180deg, rgba(255,255,255,.97), rgba(248,250,252,.94)); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 16px 36px rgba(15,23,42,.06); }
  .doc-prose h1, .doc-prose h2, .doc-prose h3 { margin: 0 0 14px; color: #0f172a; letter-spacing: -.02em; }
  .doc-prose h1 { font-size: 28px; line-height: 1.24; }
  .doc-prose h2 { margin-top: 28px; font-size: 21px; line-height: 1.32; }
  .doc-prose h3 { margin-top: 22px; font-size: 17px; line-height: 1.4; }
  .doc-prose p, .doc-prose li { color: #475569; font-size: 15px; line-height: 1.9; }
  .doc-prose ul, .doc-prose ol { margin: 0 0 18px; padding-left: 22px; display: grid; gap: 10px; }
  .doc-prose a { color: #047857; font-weight: 800; text-decoration: none; }
  .doc-prose a:hover { text-decoration: underline; }
  .doc-prose blockquote { margin: 20px 0; padding: 16px 18px; border-left: 4px solid #10b981; background: rgba(16,185,129,.06); border-radius: 0 16px 16px 0; }
  .doc-link-strip { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; margin-top: 16px; }
  .route-gateway { margin-top: 4px; }
  .route-gateway .section-header p { max-width: 680px; }
  .route-gateway-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  .route-gateway-card { display: flex; flex-direction: column; min-height: 176px; padding: 20px; border-radius: 20px; background: rgba(255,255,255,.86); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 12px 28px rgba(15,23,42,.04); }
  .route-gateway-card h3 { margin: 8px 0 8px; color: #0f172a; font-size: 18px; line-height: 1.35; }
  .route-gateway-card p { margin: 0; color: #64748b; font-size: 13px; line-height: 1.7; }
  .route-gateway-card span:last-child { margin-top: auto; padding-top: 14px; color: #047857; font-weight: 900; font-size: 13px; }
  @media (max-width: 820px) {
    .lower-route-grid, .route-gateway-grid { grid-template-columns: 1fr; }
  }
`;

function laneForMeta(meta: MarketingPageMeta): RouteLane {
  switch (meta.activeNav) {
    case "business":
      return "business";
    case "community":
      return "group";
    case "learn":
      return meta.bodyPageId === "privacy" || meta.bodyPageId === "terms" || meta.bodyPageId === "faq" || meta.bodyPageId === "contact"
        ? "trust"
        : "learn";
    default:
      return "start";
  }
}

function relatedLanesFor(lane: RouteLane): RouteLane[] {
  switch (lane) {
    case "business":
      return ["business", "research", "trust"];
    case "group":
      return ["group", "start", "business"];
    case "trust":
      return ["trust", "learn", "business"];
    case "research":
      return ["research", "learn", "trust"];
    default:
      return ["learn", "start", "trust"];
  }
}

function renderLaneIntro(meta: MarketingPageMeta): string {
  const lane = laneForMeta(meta);
  const tiles: Record<RouteLane, Array<{ label: string; title: string; body: string }>> = {
    start: [
      { label: "start", title: "まず1件残す", body: "名前が分からなくても、写真・場所・時刻・メモから始められます。" },
      { label: "map", title: "次に歩く場所を見る", body: "地図とノートから、再訪しやすい場所を見つけます。" },
      { label: "trust", title: "あとから確かめる", body: "同定や公開範囲は、記録後にも整えられます。" },
    ],
    learn: [
      { label: "guide", title: "使い方を先に読む", body: "操作説明ではなく、どんな記録が後から育つかをまとめています。" },
      { label: "identify", title: "名前は途中でよい", body: "候補、似た種類、見分けるヒントを残せる状態をつくります。" },
      { label: "method", title: "強い主張は確認つき", body: "AI と人の役割、信頼レーン、研究利用の線引きを明示します。" },
    ],
    trust: [
      { label: "privacy", title: "場所を見せすぎない", body: "希少種や個人の行動が読めすぎる情報は安全側に寄せます。" },
      { label: "terms", title: "自然と人に配慮する", body: "採集や立入を促さず、観察を残すための前提をそろえます。" },
      { label: "contact", title: "迷ったら相談する", body: "個人利用、団体利用、研究利用を同じ入口から整理します。" },
    ],
    group: [
      { label: "thin", title: "濃いSNSにしない", body: "主役は一人の観察。つながりは、場所を見直すために薄く置きます。" },
      { label: "walk", title: "同じ場所を歩く", body: "観察会やテーマ調査は、同じ場所を複数人で見るための入口です。" },
      { label: "record", title: "まず通常記録へ", body: "特別なイベント機能より先に、1件ずつ残せる導線を優先します。" },
    ],
    business: [
      { label: "small", title: "小さく始める", body: "最初から重い専用画面を作らず、対象場所と運用を先に決めます。" },
      { label: "school", title: "学校・地域で使う", body: "観察会、授業、地域調査に必要な準備を短く整理します。" },
      { label: "contact", title: "相談内容を具体化する", body: "場所、人数、期間、公開範囲が分かると始め方を設計できます。" },
    ],
    research: [
      { label: "scope", title: "研究目的を先に置く", body: "必要な粒度、対象地域、公開範囲を最初に確認します。" },
      { label: "method", title: "言いすぎない", body: "努力量や確認状態のない強い主張は避けます。" },
      { label: "contact", title: "相談から始める", body: "既存データの扱いと新しい記録設計を分けて考えます。" },
    ],
    specialist: [
      { label: "scope", title: "権限範囲で見る", body: "authority scope に合う観察だけを確認対象にします。" },
      { label: "review", title: "根拠を残す", body: "approve / reject / note の理由を記録に残します。" },
      { label: "public", title: "公開面から説明する", body: "制度の考え方は methodology に寄せ、権限画面だけで閉じません。" },
    ],
    ops: [
      { label: "qa", title: "導線を一巡する", body: "ページ、状態、redirect、health を分けて確認します。" },
      { label: "sitemap", title: "正準を固定する", body: "XML sitemap と QA sitemap を同じ定義から生成します。" },
      { label: "release", title: "本番は PR 経由", body: "直接デプロイではなく、main merge 後の CI に任せます。" },
    ],
  };
  return `<section class="section lower-route-intro">
    <div class="lower-route-grid">
      ${tiles[lane].map((tile) => `<div class="lower-route-tile">
        <span>${escapeHtml(tile.label)}</span>
        <strong>${escapeHtml(tile.title)}</strong>
        <p>${escapeHtml(tile.body)}</p>
      </div>`).join("")}
    </div>
  </section>`;
}

function renderGatewayGrid(basePath: string, lang: SiteLang, meta: MarketingPageMeta, currentRoutePath: string): string {
  const pages = relatedLanesFor(laneForMeta(meta))
    .flatMap((lane) => listPagesByLane(lane, "footer"))
    .filter((page) => page.path !== currentRoutePath)
    .slice(0, 6);
  if (pages.length === 0) {
    return "";
  }
  return `<section class="section route-gateway">
    <div class="section-header">
      <div>
        <div class="eyebrow">next route</div>
        <h2>次に見るページ</h2>
        <p>このページで終わらず、記録・信頼性・相談のどこへ進むべきかを近い順に置いています。</p>
      </div>
    </div>
    <div class="route-gateway-grid">
      ${pages.map((page) => `<a class="route-gateway-card" href="${escapeHtml(appendLangToHref(withBasePath(basePath, page.path), lang))}">
        <span class="eyebrow">${escapeHtml(page.lane)}</span>
        <h3>${escapeHtml(sitePageLabel(page, lang))}</h3>
        <p>${escapeHtml(sitePageSummary(page, lang))}</p>
        <span>開く</span>
      </a>`).join("")}
    </div>
  </section>`;
}

function renderPageDocument(basePath: string, lang: SiteLang, currentPath: string, page: SitePageDefinition, prependHtml = ""): string {
  const pageKey = page.marketing?.pageKey;
  if (!pageKey) {
    throw new Error(`missing_marketing_page_key:${page.path}`);
  }
  const availableLangs = localizedPageLangs(page);
  const hasLocalizedSeoPage = availableLangs.includes(lang);
  const meta = getShortCopy<MarketingPageMeta>(lang, "public", `marketing.pages.${pageKey}`);
  const bodyHtml = localizeInternalLinks(renderLongformPage(lang, meta.bodyPageId), basePath, lang);
  return renderSiteDocument({
    basePath,
    title: meta.title,
    description: meta.lead,
    activeNav: activeNavLabel(meta.activeNav, lang),
    lang,
    currentPath,
    canonicalPath: appendLangToHref(page.path, hasLocalizedSeoPage ? lang : "ja"),
    alternateLangs: availableLangs,
    noindex: !hasLocalizedSeoPage,
    extraStyles: LOWER_PAGE_STYLES,
    hero: {
      eyebrow: meta.eyebrow,
      heading: meta.heading,
      lead: meta.lead,
      tone: "light",
      align: "center",
      afterActionsHtml: renderAfterActions(basePath, lang, meta.afterActions),
    },
    body: `<div class="lower-page">
      ${renderLaneIntro(meta)}
      ${prependHtml}
      <section class="section doc-article"><article class="doc-prose">${bodyHtml}</article></section>
      ${renderGatewayGrid(basePath, lang, meta, page.path)}
    </div>`,
    footerNote: meta.footerNote ?? getShortCopy<string>(lang, "shared", "footerNotes.public"),
  });
}

export async function registerMarketingRoutes(app: FastifyInstance): Promise<void> {
  const redirectMap = new Map<string, string>([
    ...legacyRedirectEntries().map((entry) => [entry.source, entry.target] as const),
    ["/for-business/", "/for-business"],
    ["/explore/", "/explore"],
    ["/learn/", "/learn"],
    ["/home/", "/home"],
    ["/notes/", "/notes"],
    ["/map/", "/map"],
    ["/sitemap", "/sitemap.xml"],
    ["/sitemap.php", "/sitemap.xml"],
  ]);

  for (const [legacyPath, targetPath] of redirectMap) {
    app.get(legacyPath, async (request, reply) => {
      const basePath = requestBasePath(request as { headers: Record<string, unknown> });
      const lang = detectLangFromUrl(requestUrl(request));
      return reply.redirect(appendLangToHref(withBasePath(basePath, targetPath), lang), 308);
    });
  }

  for (const page of listMarketingPages()) {
    app.get(page.path, async (request, reply) => {
      const basePath = requestBasePath(request as { headers: Record<string, unknown> });
      const url = requestUrl(request);
      const lang = detectLangFromUrl(url);
      const availableLangs = localizedPageLangs(page);
      if (isLanguagePrefixedRequest(url) && !availableLangs.includes(lang)) {
        return reply.redirect(appendLangToHref(withBasePath(basePath, "/"), lang), 302);
      }
      const prependHtml = page.marketing?.prepend === "contactForm" ? renderContactForm(basePath, lang) : "";
      reply.type("text/html; charset=utf-8");
      return renderPageDocument(
        basePath,
        lang,
        requestCurrentPath(request as { headers: Record<string, unknown>; url?: string; raw?: { url?: string; originalUrl?: string } }),
        page,
        prependHtml,
      );
    });
  }

  app.post<{ Body: { category?: string; name?: string; email?: string; organization?: string; message?: string; sourceUrl?: string } }>(
    "/contact",
    async (_request, reply) => {
      reply.code(400);
      reply.type("application/json");
      return { ok: false, error: "use_api_endpoint", hint: "POST /api/v1/contact/submit" };
    },
  );
}
