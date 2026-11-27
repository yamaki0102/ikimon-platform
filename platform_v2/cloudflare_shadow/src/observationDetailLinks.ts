import type { ObservationRecordLang } from "./observationFirstRecordDetailI18n";
import { isHigherRankName, regionKeyFromLabel } from "./regionSurfaceV1";
import { canonicalSpeciesKey, resolveSpeciesKey } from "./speciesSurfaceV1";

const LOCATION_LABELS: Readonly<Record<string, Readonly<Record<Exclude<ObservationRecordLang, "ja">, string>>>> = {
  "位置をぼかしています": { en: "Location is blurred", es: "La ubicación está difuminada", "pt-br": "A localização está desfocada" },
  "位置は非公開です": { en: "Location is private", es: "La ubicación es privada", "pt-br": "A localização é privada" },
  "位置は24時間後に公開されます": { en: "Location is shown after 24 hours", es: "La ubicación se mostrará en 24 horas", "pt-br": "A localização será exibida em 24 horas" },
  "場所未設定": { en: "No place set", es: "Sin lugar definido", "pt-br": "Sem local definido" },
};

export function localizePublicLocationLabel(label: string | null | undefined, lang: ObservationRecordLang): string | null {
  if (label == null) return null;
  if (lang === "ja") return label;
  return LOCATION_LABELS[label.trim()]?.[lang] ?? label;
}

export type ObservationDetailLinkInput = {
  lang: ObservationRecordLang;
  speciesName?: string | null;
  speciesOn?: boolean;
  areaLabel?: string | null;
  regionOn?: boolean;
  place?: { id: string; name: string } | null;
};

export type ObservationDetailLinks = {
  species: { href: string; name: string } | null;
  region: { href: string; area: string } | null;
  place: { href: string; name: string } | null;
};

export function observationDetailLinks(input: ObservationDetailLinkInput): ObservationDetailLinks {
  const prefix = `/${input.lang}`;
  let species: ObservationDetailLinks["species"] = null;
  if (input.speciesOn && input.speciesName) {
    const name = canonicalSpeciesKey(input.speciesName);
    if (name && !isHigherRankName(name) && resolveSpeciesKey(encodeURIComponent(name)).kind === "ok") {
      species = { href: `${prefix}/species/${encodeURIComponent(name)}`, name };
    }
  }
  let region: ObservationDetailLinks["region"] = null;
  if (input.regionOn) {
    const key = regionKeyFromLabel(input.areaLabel);
    if (key) region = { href: `${prefix}/regions/${encodeURIComponent(key)}`, area: key };
  }
  const placeId = input.place?.id?.trim();
  const placeName = input.place?.name?.trim();
  const place = placeId && placeName ? { href: `${prefix}/places/${encodeURIComponent(placeId)}`, name: placeName } : null;
  return { species, region, place };
}
