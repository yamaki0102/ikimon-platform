import type { FastifyInstance } from "fastify";
import { getShortCopy } from "../content/index.js";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import { escapeHtml, renderSiteDocument } from "../ui/siteShell.js";

type PublicSharedCopy = {
  cta: {
    record: string;
    openNotebook: string;
    openMap: string;
  };
  ai: {
    support: string;
  };
};

type PublicRouteCard = {
  eyebrow: string;
  title: string;
  body: string;
  meta?: string;
  ctaHref?: string;
  ctaLabel?: string;
};

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

function renderPublicRouteCardGrid(
  cards: PublicRouteCard[],
  basePath: string,
  lang: SiteLang,
  ctaClass: "btn btn-solid" | "inline-link",
): string {
  return `<div class="grid">${cards
    .map((card) => {
      const ctaHref = card.ctaHref ? appendLangToHref(withBasePath(basePath, card.ctaHref), lang) : "";
      const ctaHtml = card.ctaHref && card.ctaLabel
        ? `<div class="actions" style="margin-top:12px"><a class="${ctaClass}" href="${escapeHtml(ctaHref)}">${escapeHtml(card.ctaLabel)}</a></div>`
        : "";
      const metaHtml = card.meta ? `<p class="meta" style="margin-top:10px">${escapeHtml(card.meta)}</p>` : "";
      return `<div class="card"><div class="card-body"><div class="eyebrow">${escapeHtml(card.eyebrow)}</div><h2>${escapeHtml(card.title)}</h2><p>${escapeHtml(card.body)}</p>${metaHtml}${ctaHtml}</div></div>`;
    })
    .join("")}</div>`;
}

export async function registerPublicEntryReadRoutes(app: FastifyInstance): Promise<void> {
  app.get("/explore", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const url = new URL(String((request as unknown as { url?: string }).url ?? "/explore"), "https://ikimon.local");
    const lang = detectLangFromUrl(url.pathname + url.search);
    url.searchParams.delete("lang");
    const query = url.searchParams.toString();
    return reply.redirect(appendLangToHref(withBasePath(basePath, `/records?view=public${query ? `&${query}` : ""}`), lang), 308);
  });

  app.get("/notes", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const rawUrl = String((request as unknown as { url?: string }).url ?? "");
    const lang = detectLangFromUrl(rawUrl);
    const url = new URL(rawUrl, "https://ikimon.local");
    url.searchParams.delete("lang");
    const query = url.searchParams.toString();
    return reply.redirect(appendLangToHref(withBasePath(basePath, `/records?view=mine${query ? `&${query}` : ""}`), lang), 308);
  });

  app.get("/lens", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const lensPageCopy = getShortCopy<any>(lang, "public", "read.lens");
    const sharedCopy = getShortCopy<PublicSharedCopy>(lang, "shared", "publicShared");

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: lensPageCopy.title,
      activeNav: lensPageCopy.activeNav,
      lang,
      hero: {
        eyebrow: lensPageCopy.hero.eyebrow,
        heading: lensPageCopy.hero.heading,
        headingHtml: lensPageCopy.hero.heading,
        lead: lensPageCopy.hero.lead,
        tone: "light",
        align: "center",
        actions: [
          { href: "/record", label: sharedCopy.cta.record },
          { href: "/records?view=mine", label: sharedCopy.cta.openNotebook, variant: "secondary" as const },
        ],
      },
      body: `<section class="section">
        <div class="list">
          ${lensPageCopy.steps.map((step: { title: string; body: string }) => `<div class="row"><div><strong>${escapeHtml(step.title)}</strong><div class="meta">${escapeHtml(step.body)}</div></div></div>`).join("")}
        </div>
      </section>
      <section class="section">${renderPublicRouteCardGrid(lensPageCopy.guidanceCards as PublicRouteCard[], basePath, lang, "btn btn-solid")}</section>
      <section class="section">${renderPublicRouteCardGrid(lensPageCopy.followupCards as PublicRouteCard[], basePath, lang, "inline-link")}</section>`,
      footerNote: lensPageCopy.footerNote,
    });
  });
}
