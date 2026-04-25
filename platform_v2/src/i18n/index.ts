import type { SiteLang } from "../i18n.js";
import { buildAppStrings } from "../content/index.js";
import type { AppStrings } from "./strings.js";

export function getStrings(lang: SiteLang): AppStrings {
  return buildAppStrings(lang);
}

export function formatStatLabel(lang: SiteLang, obs: number, species: number): string {
  const strings = getStrings(lang);
  const loc = strings.landing.numberLocale;
  return strings.landing.statLabelTemplate(obs.toLocaleString(loc), species.toLocaleString(loc));
}
