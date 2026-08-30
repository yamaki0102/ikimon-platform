import { appendLangToHref } from "../i18n.js";
import { SITE_PAGE_DEFINITIONS, localizedPageLangs } from "../siteMap.js";

function publicMarketingSiteMapPages() {
  return SITE_PAGE_DEFINITIONS.filter((page) =>
    page.auth === "public"
    && !page.path.includes(":")
    && page.path !== "/qa/site-map"
    && Boolean(page.marketing)
  );
}

export function listPublicSiteMapLocalizableBasePaths(): string[] {
  return [...new Set(
    publicMarketingSiteMapPages().map((page) => page.path),
  )];
}

export function listPublicSiteMapMaterializationPaths(): string[] {
  return [...new Set(
    publicMarketingSiteMapPages().flatMap((page) =>
      localizedPageLangs(page).map((lang) => appendLangToHref(page.path, lang))
    ),
  )];
}
