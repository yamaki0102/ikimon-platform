import type { FastifyInstance } from "fastify";
import { getKubiakaExperienceCopy } from "../content/kubiakaExperience.js";
import { getForwardedBasePath, withBasePath } from "../httpBasePath.js";
import { appendLangToHref, detectLangFromUrl, type SiteLang } from "../i18n.js";
import {
  KUBIAKA_EXPERIENCE_STYLES,
  renderKubiakaExperience,
} from "../ui/kubiakaExperience.js";
import { renderSiteDocument } from "../ui/siteShell.js";

const KUBIAKA_UI_FLAG = "KUBIAKA_PRIVATE_PILOT_UI_ENABLED";

function isKubiakaUiEnabled(): boolean {
  return process.env[KUBIAKA_UI_FLAG] === "1";
}

function hideUnavailableRoute(reply: {
  code(statusCode: number): unknown;
  type(contentType: string): unknown;
  send(payload: string): unknown;
}): unknown {
  reply.code(404);
  reply.type("text/plain; charset=utf-8");
  return reply.send("not found");
}

function requestContext(request: {
  headers: Record<string, unknown>;
  url?: string;
  raw?: { url?: string; originalUrl?: string };
}): { basePath: string; lang: SiteLang } {
  const rawUrl = String(request.raw?.originalUrl ?? request.raw?.url ?? request.url ?? "");
  return {
    basePath: getForwardedBasePath(request.headers),
    lang: detectLangFromUrl(rawUrl),
  };
}

function localizedHref(basePath: string, href: string, lang: SiteLang): string {
  return appendLangToHref(withBasePath(basePath, href), lang);
}

export async function registerKubiakaExperienceRoutes(app: FastifyInstance): Promise<void> {
  app.get("/kubiaka", async (request, reply) => {
    if (!isKubiakaUiEnabled()) {
      return hideUnavailableRoute(reply);
    }

    const { basePath, lang } = requestContext(request as unknown as {
      headers: Record<string, unknown>;
      url?: string;
      raw?: { url?: string; originalUrl?: string };
    });
    const copy = getKubiakaExperienceCopy(lang);

    reply
      .type("text/html; charset=utf-8")
      .header("Cache-Control", "private, no-store")
      .header("X-Robots-Tag", "noindex, nofollow");

    return renderSiteDocument({
      basePath,
      title: copy.pageTitle,
      description: copy.description,
      activeNav: copy.activeNav,
      lang,
      noindex: true,
      minimalChrome: true,
      hideGlobalRecordLauncher: true,
      hideFooter: true,
      shellClassName: "shell-bleed kubiaka-shell",
      extraStyles: KUBIAKA_EXPERIENCE_STYLES,
      body: renderKubiakaExperience({ copy, basePath, lang }),
    });
  });

  for (const [path, anchor] of [
    ["/kubiaka/guide", "how-to"],
    ["/kubiaka/about", "about"],
    ["/kubiaka/faq", "faq"],
  ] as const) {
    app.get(path, async (request, reply) => {
      if (!isKubiakaUiEnabled()) {
        return hideUnavailableRoute(reply);
      }
      const { basePath, lang } = requestContext(request as unknown as {
        headers: Record<string, unknown>;
        url?: string;
        raw?: { url?: string; originalUrl?: string };
      });
      reply.header("Cache-Control", "private, no-store");
      return reply.redirect(`${localizedHref(basePath, "/kubiaka", lang)}#${anchor}`, 308);
    });
  }

  app.get("/kubiaka/record", async (request, reply) => {
    if (!isKubiakaUiEnabled()) {
      return hideUnavailableRoute(reply);
    }

    const { basePath, lang } = requestContext(request as unknown as {
      headers: Record<string, unknown>;
      url?: string;
      raw?: { url?: string; originalUrl?: string };
    });
    const recordHref = localizedHref(
      basePath,
      "/record?start=photo&source=kubiaka_watch",
      lang,
    );

    reply
      .header("Cache-Control", "no-store")
      .header("X-Robots-Tag", "noindex, nofollow");
    return reply.redirect(recordHref, 303);
  });
}
