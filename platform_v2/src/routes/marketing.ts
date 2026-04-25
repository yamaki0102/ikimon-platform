import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { getShortCopy, renderLongformPage } from "../content/index.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

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

function requestUrl(request: { url?: string; raw?: { url?: string } }): string {
  return String(request.raw?.url ?? request.url ?? "");
}

function requestCurrentPath(request: { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }): string {
  return withBasePath(requestBasePath(request), requestUrl(request));
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

const ARTICLE_STYLES = `
  .doc-article { max-width: 860px; margin: 24px auto 0; }
  .doc-prose { padding: 28px 30px; border-radius: 28px; background: linear-gradient(180deg, rgba(255,255,255,.96), rgba(248,250,252,.94)); border: 1px solid rgba(15,23,42,.08); box-shadow: 0 16px 36px rgba(15,23,42,.06); }
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
`;

function renderPageDocument(basePath: string, lang: SiteLang, currentPath: string, pageKey: string, prependHtml = ""): string {
  const meta = getShortCopy<MarketingPageMeta>(lang, "public", `marketing.pages.${pageKey}`);
  const bodyHtml = localizeInternalLinks(renderLongformPage(lang, meta.bodyPageId), basePath, lang);
  return renderSiteDocument({
    basePath,
    title: meta.title,
    activeNav: activeNavLabel(meta.activeNav, lang),
    lang,
    currentPath,
    extraStyles: ARTICLE_STYLES,
    hero: {
      eyebrow: meta.eyebrow,
      heading: meta.heading,
      lead: meta.lead,
      tone: "light",
      align: "center",
      afterActionsHtml: renderAfterActions(basePath, lang, meta.afterActions),
    },
    body: `${prependHtml}<section class="section doc-article"><article class="doc-prose">${bodyHtml}</article></section>`,
    footerNote: meta.footerNote ?? getShortCopy<string>(lang, "shared", "footerNotes.public"),
  });
}

export async function registerMarketingRoutes(app: FastifyInstance): Promise<void> {
  const redirectMap = new Map<string, string>([
    ["/index.php", "/"],
    ["/scan", "/map"],
    ["/guides.php", "/learn/identification-basics"],
    ["/guidelines.php", "/learn/methodology"],
    ["/learn/authority-policy", "/learn/methodology"],
    ["/updates.php", "/learn/updates"],
    ["/methodology.php", "/learn/methodology"],
    ["/about.php", "/about"],
    ["/faq.php", "/faq"],
    ["/privacy.php", "/privacy"],
    ["/terms.php", "/terms"],
    ["/contact.php", "/contact"],
    ["/for-business.php", "/for-business"],
    ["/pricing.php", "/for-business/pricing"],
    ["/events.php", "/community"],
    ["/survey.php", "/community"],
    ["/bingo.php", "/community"],
    ["/event_detail.php", "/community"],
    ["/for-business/index.php", "/for-business"],
    ["/for-business/pricing.php", "/for-business/pricing"],
    ["/for-business/demo.php", "/for-business/demo"],
    ["/for-business/status.php", "/for-business/status"],
    ["/for-business/apply.php", "/for-business/apply"],
    ["/for-business/create.php", "/for-business/apply"],
    ["/id_workbench.php", "/specialist/id-workbench"],
    ["/id_center.php", "/specialist/id-workbench"],
    ["/needs_id.php", "/specialist/id-workbench"],
    ["/review_queue.php", "/specialist/review-queue"],
    ["/zukan", "/explore"],
    ["/zukan.php", "/explore"],
    ["/for-business/", "/for-business"],
    ["/explore/", "/explore"],
    ["/learn/", "/learn"],
    ["/home/", "/home"],
    ["/notes/", "/notes"],
    ["/map/", "/map"],
  ]);

  for (const [legacyPath, targetPath] of redirectMap) {
    app.get(legacyPath, async (request, reply) => {
      const basePath = requestBasePath(request as { headers: Record<string, unknown> });
      const lang = detectLangFromUrl(requestUrl(request));
      return reply.redirect(appendLangToHref(withBasePath(basePath, targetPath), lang), 308);
    });
  }

  const pageRoutes: Array<{ path: string; pageKey: string; prependHtml?: (basePath: string, lang: SiteLang) => string }> = [
    { path: "/about", pageKey: "about" },
    { path: "/learn", pageKey: "learnIndex" },
    { path: "/learn/field-loop", pageKey: "learnFieldLoop" },
    { path: "/learn/glossary", pageKey: "learnGlossary" },
    { path: "/learn/identification-basics", pageKey: "learnIdentificationBasics" },
    { path: "/learn/methodology", pageKey: "learnMethodology" },
    { path: "/learn/updates", pageKey: "learnUpdates" },
    { path: "/faq", pageKey: "faq" },
    { path: "/privacy", pageKey: "privacy" },
    { path: "/terms", pageKey: "terms" },
    { path: "/contact", pageKey: "contact", prependHtml: (basePath, lang) => renderContactForm(basePath, lang) },
    { path: "/community", pageKey: "community" },
    { path: "/for-business", pageKey: "forBusiness" },
    { path: "/for-business/pricing", pageKey: "forBusinessPricing" },
    { path: "/for-business/demo", pageKey: "forBusinessDemo" },
    { path: "/for-business/status", pageKey: "forBusinessStatus" },
    { path: "/for-business/apply", pageKey: "forBusinessApply" },
    { path: "/for-researcher/apply", pageKey: "forResearcherApply", prependHtml: (basePath, lang) => renderContactForm(basePath, lang) },
  ];

  for (const route of pageRoutes) {
    app.get(route.path, async (request, reply) => {
      const basePath = requestBasePath(request as { headers: Record<string, unknown> });
      const lang = detectLangFromUrl(requestUrl(request));
      reply.type("text/html; charset=utf-8");
      return renderPageDocument(
        basePath,
        lang,
        requestCurrentPath(request as { headers: Record<string, unknown>; url?: string; raw?: { url?: string } }),
        route.pageKey,
        route.prependHtml ? route.prependHtml(basePath, lang) : "",
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
