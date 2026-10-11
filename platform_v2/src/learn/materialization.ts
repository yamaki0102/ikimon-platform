import { appendLangToHref } from "../i18n.js";
import { listPublicSiteMapMaterializationPaths } from "../services/originalUiMaterializationRoutes.js";
import { buildLearnCatalog } from "./catalog.js";

/**
 * Node-side delivery projection for the existing localized Learn hubs and every
 * public Japanese article. Eligibility and content existence remain owned by
 * the canonical catalogue; this does not maintain another article inventory.
 */
export function listLearnMaterializationPaths(source: Parameters<typeof buildLearnCatalog>[0] = {}): string[] {
  const hubs = listPublicSiteMapMaterializationPaths().filter((path) => /^\/[^/]+\/learn$/u.test(path));
  const articles = buildLearnCatalog(source).map((entry) => appendLangToHref(entry.path, "ja"));
  return [...new Set([...hubs, ...articles])];
}
