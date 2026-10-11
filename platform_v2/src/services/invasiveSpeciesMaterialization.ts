import { appendLangToHref } from "../i18n.js";
import {
  INVASIVE_SPECIES_LIST_PATH,
  invasiveSpeciesDetailPath,
  listInvasiveSpecies,
} from "./invasiveSpeciesCatalog.js";

/**
 * Existing Japanese invasive-species pages use their own canonical catalogue,
 * outside the marketing Learn article projection. Keep their materialization
 * inventory derived from that catalogue so the Worker manifest admits exactly
 * the public list and registered detail pages.
 */
export function listInvasiveSpeciesMaterializationPaths(): string[] {
  return [
    appendLangToHref(INVASIVE_SPECIES_LIST_PATH, "ja"),
    ...listInvasiveSpecies().map((item) => appendLangToHref(invasiveSpeciesDetailPath(item), "ja")),
  ];
}
