import type { AreaPlaceSnapshot } from "./areaPlaceSnapshot.js";
import {
  buildFieldPublicProfile,
  type FieldPublicProfile,
} from "./fieldPublicProfile.js";
import {
  evaluateFieldPublicProfileReadiness,
  normalizeFieldPublicProfileRules,
} from "./fieldPublicProfileRules.js";
import type { ObservationField, FieldStats } from "./observationFieldRegistry.js";
import {
  buildSiteBriefMvp,
  type SiteBriefMvp,
} from "./siteBriefMvp.js";

export type FieldPublicProfileView = {
  profile: FieldPublicProfile;
  publicBrief: SiteBriefMvp;
};

function isAreaSnapshot(snapshot: unknown): snapshot is AreaPlaceSnapshot {
  return Boolean(
    snapshot
    && typeof snapshot === "object"
    && "effortIndicators" in snapshot
    && "seasonalCoverage" in snapshot,
  );
}

function cleanList(values: unknown[]): string[] {
  return Array.from(new Set(
    values
      .map((value) => typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "")
      .filter(Boolean),
  )).slice(0, 12);
}

function payloadTags(field: ObservationField): string[] {
  const payload = field.payload && typeof field.payload === "object" ? field.payload : {};
  const encyclopedia = payload.area_encyclopedia;
  if (!encyclopedia || typeof encyclopedia !== "object" || Array.isArray(encyclopedia)) return [];
  const tags = (encyclopedia as { tags?: unknown }).tags;
  return Array.isArray(tags) ? cleanList(tags) : [];
}

function observationCount(stats: FieldStats, snapshot: AreaPlaceSnapshot | null): number {
  return Math.max(0, snapshot?.observationSummary.totalObservations ?? stats.totalObservations ?? 0);
}

function observationDensityLabel(count: number): string {
  if (count >= 50) return "記録密度: 高";
  if (count >= 12) return "記録密度: 中";
  if (count >= 1) return "記録密度: 低";
  return "記録密度: 確認中";
}

function nextObservationPrompts(snapshot: AreaPlaceSnapshot | null): string[] {
  const missingSeasons = snapshot?.seasonalCoverage
    ?.filter((row) => row.observations <= 0)
    .map((row) => row.label)
    .filter(Boolean) ?? [];
  if (missingSeasons.length > 0) {
    return [
      `${missingSeasons.slice(0, 2).join("・")}の記録を足す`,
      "同じ場所を別の日にも記録する",
      "写真と短いメモを一緒に残す",
    ];
  }
  return [
    "同じ場所を別の日にも記録する",
    "季節が変わった時にもう一度見る",
    "写真と短いメモを一緒に残す",
  ];
}

export function buildFieldPublicProfileView(input: {
  field: ObservationField;
  stats: FieldStats;
  snapshot?: AreaPlaceSnapshot | null;
}): FieldPublicProfileView {
  const areaSnapshot = isAreaSnapshot(input.snapshot) ? input.snapshot : null;
  const count = observationCount(input.stats, areaSnapshot);
  const observerCount = areaSnapshot?.effortIndicators.observerCount ?? 0;
  const timeSpanDays = (areaSnapshot?.effortIndicators.monthsCovered ?? 0) * 30;
  const sensitiveContextCount = areaSnapshot?.sensitiveMasking.totalRare ?? 0;
  const readiness = evaluateFieldPublicProfileReadiness(
    normalizeFieldPublicProfileRules({}),
    {
      observationCount: count,
      observerCount,
      timeSpanDays,
      sourceRecordCount: count,
      sensitiveContextCount,
    },
  );
  const profile = buildFieldPublicProfile({
    field: {
      fieldId: input.field.fieldId,
      name: input.field.name,
      placeType: input.field.adminLevel || input.field.source,
      prefecture: input.field.prefecture,
      city: input.field.city,
      lat: input.field.lat,
      lng: input.field.lng,
      radiusM: input.field.radiusM,
    },
    readiness,
    confirmedTaxa: input.stats.topTaxa.map((taxon) => ({
      name: taxon.name,
      observationCount: taxon.count,
      seasonLabels: areaSnapshot?.observationSummary.seasonLabels ?? [],
    })),
    environmentTypes: payloadTags(input.field),
    observationDensityLabel: observationDensityLabel(count),
    nextObservationPrompts: nextObservationPrompts(areaSnapshot),
  });
  const evidenceSummary = [
    `${count}件の公開候補記録`,
    `${observerCount}人以上の観察者`,
    ...profile.environmentTypes.slice(0, 3),
  ].filter(Boolean);
  const publicBrief = buildSiteBriefMvp({
    audience: "public",
    profile,
    evidenceSummary,
    managerGaps: [],
    nextActions: profile.nextObservationPrompts,
  });
  return { profile, publicBrief };
}
