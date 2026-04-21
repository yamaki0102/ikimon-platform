import type { SiteLang } from "../i18n.js";
import { ja } from "./ja.js";
import { en } from "./en.js";
import { es } from "./es.js";
import { ptBR } from "./pt-BR.js";
import type { AppStrings, FieldLoopStrings, LandingStrings, PartialAppStrings } from "./strings.js";

const overrides: Record<Exclude<SiteLang, "ja">, PartialAppStrings> = {
  en,
  es,
  "pt-BR": ptBR,
};

function mergeLanding(override: PartialAppStrings["landing"] | undefined): LandingStrings {
  if (!override) return ja.landing;
  const { tools: overrideTools, ...rest } = override;
  const lens = { ...ja.landing.tools.lens, ...(overrideTools?.lens ?? {}) };
  const scan = { ...ja.landing.tools.scan, ...(overrideTools?.scan ?? {}) };
  return {
    ...ja.landing,
    ...rest,
    tools: { lens, scan },
  } as LandingStrings;
}

function mergeFieldLoop(override: PartialAppStrings["fieldLoop"] | undefined): FieldLoopStrings {
  if (!override) return ja.fieldLoop;
  return { ...ja.fieldLoop, ...override } as FieldLoopStrings;
}

export function getStrings(lang: SiteLang): AppStrings {
  if (lang === "ja") return ja;
  const src = overrides[lang];
  return {
    landing: mergeLanding(src.landing),
    fieldLoop: mergeFieldLoop(src.fieldLoop),
  };
}

export function formatStatLabel(lang: SiteLang, obs: number, species: number): string {
  const strings = getStrings(lang);
  const loc = strings.landing.numberLocale;
  return strings.landing.statLabelTemplate(obs.toLocaleString(loc), species.toLocaleString(loc));
}
