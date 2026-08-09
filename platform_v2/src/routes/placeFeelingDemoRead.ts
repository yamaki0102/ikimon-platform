import type { FastifyInstance } from "fastify";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl } from "../i18n.js";
import { renderSiteDocument } from "../ui/siteShell.js";
import {
  PLACE_FEELING_DEMO_STYLES,
  renderPlaceFeelingTagDemo,
} from "../ui/placeFeelingTagDemo.js";

function requestBasePath(request: { headers: Record<string, unknown> }): string {
  return getForwardedBasePath(request.headers);
}

export async function registerPlaceFeelingDemoReadRoutes(app: FastifyInstance): Promise<void> {
  app.get("/demo/place-feeling-tags", async (request, reply) => {
    const basePath = requestBasePath(request as unknown as { headers: Record<string, unknown> });
    const url = new URL(String((request as unknown as { url?: string }).url ?? "/demo/place-feeling-tags"), "https://ikimon.local");
    const lang = detectLangFromUrl(url.pathname + url.search);
    const recordHref = appendLangToHref(withBasePath(basePath, "/record?start=photo"), lang);
    const currentPath = appendLangToHref(withBasePath(basePath, "/demo/place-feeling-tags"), lang);
    return reply
      .type("text/html")
      .send(renderSiteDocument({
        basePath,
        title: lang === "ja" ? "ひとことタグ デモ | ZUKAN" : "Place feeling tag demo | ZUKAN",
        activeNav: "記録する",
        lang,
        body: renderPlaceFeelingTagDemo({ lang, recordHref }),
        extraStyles: PLACE_FEELING_DEMO_STYLES,
        currentPath,
        shellClassName: "shell-place-feeling-demo",
        footerNote: lang === "ja"
          ? "いつもの道で見つけた自然を、その場で読み解く。"
          : "Read nearby nature from the scene you found.",
      }));
  });
}
