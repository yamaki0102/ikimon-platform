import type { FocusedExperienceDefinition, LocalizedText } from "./focusedExperienceRegistry.js";

export const KUBIAKA_EXPERIENCE_KEY = "kubiaka-watch" as const;
export const KUBIAKA_CANONICAL_PATH = "/kubiaka" as const;
export const KUBIAKA_TAXON_ID = "Aromia bungii" as const;
export const KUBIAKA_PROTOCOL_PROFILE = "zukan-kubiaka-photo-review" as const;
export const KUBIAKA_PROTOCOL_VERSION = "1.0.0" as const;
export const KUBIAKA_SEASONAL_CONTENT_VERSION = "2026.1" as const;

export const KUBIAKA_TITLE: LocalizedText = {
  ja: "クビアカツヤカミキリ見守り",
  en: "Red-necked longhorn beetle watch",
  es: "Vigilancia del escarabajo longicornio de cuello rojo",
  "pt-BR": "Monitoramento do besouro longicórnio de pescoço vermelho",
};

export const KUBIAKA_SHORT_TITLE: LocalizedText = {
  ja: "クビアカ見守り",
  en: "Kubiaka watch",
  es: "Vigilancia Kubiaka",
  "pt-BR": "Monitoramento Kubiaka",
};

export const KUBIAKA_FOCUSED_EXPERIENCE: FocusedExperienceDefinition = Object.freeze({
  experienceKey: KUBIAKA_EXPERIENCE_KEY,
  canonicalPath: KUBIAKA_CANONICAL_PATH,
  title: KUBIAKA_TITLE,
  shortTitle: KUBIAKA_SHORT_TITLE,
  taxonId: KUBIAKA_TAXON_ID,
  protocolProfile: KUBIAKA_PROTOCOL_PROFILE,
  protocolVersion: KUBIAKA_PROTOCOL_VERSION,
  seasonalContentVersion: KUBIAKA_SEASONAL_CONTENT_VERSION,
  shell: "focused",
  publicAreaPrecision: "aggregate_only",
  enabled: true,
});
