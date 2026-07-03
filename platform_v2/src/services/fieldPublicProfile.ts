import type {
  FieldPublicProfileReadiness,
  FieldPublicProfileSuppressionReason,
} from "./fieldPublicProfileRules.js";

export type FieldPublicProfileTaxon = {
  name: string;
  observationCount: number;
  seasonLabels: string[];
};

export type FieldPublicProfileInput = {
  field: {
    fieldId: string;
    name: string;
    placeType: string;
    prefecture?: string | null;
    city?: string | null;
    lat?: number | null;
    lng?: number | null;
    radiusM?: number | null;
  };
  readiness: FieldPublicProfileReadiness;
  confirmedTaxa: FieldPublicProfileTaxon[];
  environmentTypes: string[];
  observationDensityLabel: string;
  nextObservationPrompts: string[];
};

export type FieldPublicProfile = {
  fieldId: string;
  placeName: string;
  placeType: string;
  publicLocation: {
    mode: "site";
    label: string;
    radiusM: number | null;
    exactLat?: never;
    exactLng?: never;
  };
  confirmedTaxa: FieldPublicProfileTaxon[];
  seasonTendencyLabels: string[];
  environmentTypes: string[];
  observationDensityLabel: string;
  confidence: {
    label: string;
    canPublishDetails: boolean;
  };
  limitations: Array<{
    reason: FieldPublicProfileSuppressionReason;
    label: string;
  }>;
  nextObservationPrompts: string[];
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanList(values: string[]): string[] {
  return Array.from(new Set(values.map(clean).filter(Boolean))).slice(0, 12);
}

function locationLabel(field: FieldPublicProfileInput["field"]): string {
  return [clean(field.prefecture), clean(field.city), clean(field.name)].filter(Boolean).join(" / ");
}

function taxaForPublic(input: FieldPublicProfileInput): FieldPublicProfileTaxon[] {
  if (!input.readiness.canPublishDetails) return [];
  return [...input.confirmedTaxa]
    .filter((taxon) => clean(taxon.name))
    .sort((a, b) => b.observationCount - a.observationCount || clean(a.name).localeCompare(clean(b.name), "ja-JP"))
    .slice(0, 24)
    .map((taxon) => ({
      name: clean(taxon.name),
      observationCount: Math.max(0, Math.floor(taxon.observationCount)),
      seasonLabels: cleanList(taxon.seasonLabels),
    }));
}

export function buildFieldPublicProfile(input: FieldPublicProfileInput): FieldPublicProfile {
  const confirmedTaxa = taxaForPublic(input);
  const seasonTendencyLabels = cleanList(confirmedTaxa.flatMap((taxon) => taxon.seasonLabels));
  const limitations = input.readiness.canPublishDetails || !input.readiness.suppressionReason
    ? []
    : [{
        reason: input.readiness.suppressionReason,
        label: input.readiness.displaySuppressionReason ?? "確認記録が少ないため、詳細な傾向はまだ表示していません",
      }];

  return {
    fieldId: clean(input.field.fieldId),
    placeName: clean(input.field.name) || "登録エリア",
    placeType: clean(input.field.placeType) || "area",
    publicLocation: {
      mode: "site",
      label: locationLabel(input.field),
      radiusM: typeof input.field.radiusM === "number" && Number.isFinite(input.field.radiusM)
        ? Math.max(0, Math.floor(input.field.radiusM))
        : null,
    },
    confirmedTaxa,
    seasonTendencyLabels,
    environmentTypes: cleanList(input.environmentTypes),
    observationDensityLabel: clean(input.observationDensityLabel) || "確認中",
    confidence: {
      label: input.readiness.canPublishDetails
        ? "公開条件を満たした記録から作成"
        : "公開条件を満たすまで詳細を抑制",
      canPublishDetails: input.readiness.canPublishDetails,
    },
    limitations,
    nextObservationPrompts: cleanList(input.nextObservationPrompts).slice(0, 6),
  };
}
