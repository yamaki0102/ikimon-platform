import type { FastifyInstance } from "fastify";
import { getShortCopy } from "../content/index.js";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl } from "../i18n.js";
import { MAP_EXPLORER_STYLES, mapExplorerBootScript, renderMapExplorer } from "../ui/mapExplorer.js";
import { renderSiteDocument } from "../ui/siteShell.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

export async function registerMapReadRoutes(app: FastifyInstance): Promise<void> {
  app.get("/map", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const lang = detectLangFromUrl(String((request as unknown as { url?: string }).url ?? ""));
    const mapPageCopy = getShortCopy<any>(lang, "public", "read.map");

    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 10; y -= 1) years.push(y);

    reply.type("text/html; charset=utf-8");
    return renderSiteDocument({
      basePath,
      title: mapPageCopy.title,
      activeNav: mapPageCopy.activeNav,
      lang,
      currentPath: appendLangToHref(withBasePath(basePath, "/map"), lang),
      shellClassName: "shell-bleed shell-map",
      extraStyles: MAP_EXPLORER_STYLES,
      // Deliberately no hero: the map page should land on the map canvas,
      // while the explorer component carries a one-line context strip.
      hideFooter: true,
      body: `${renderMapExplorer({ basePath, lang, years })}
${mapExplorerBootScript({ basePath, lang })}`,
      footerNote: mapPageCopy.footerNote,
    });
  });
}
