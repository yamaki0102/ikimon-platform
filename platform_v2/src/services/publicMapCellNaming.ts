import type { PublicLocalityScope } from "./publicLocation.js";
import type { TaxonGroup } from "./mapSnapshot.js";

export type PublicMapCellNameInput = {
  localityLabel: string;
  localityScope: PublicLocalityScope;
  gridM: number;
  count: number;
  taxonMix?: Partial<Record<TaxonGroup, number>>;
  nearbyAreaName?: string | null;
  nameEraLabel?: string | null;
};

export type PublicMapCellName = {
  albumName: string;
  localityLabel: string;
  themeLabel: string;
  scaleLabel: string;
  nearbyAreaName: string | null;
  nameEraLabel: string | null;
};

function cleanLabel(value: string | null | undefined): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function dominantTaxonGroup(taxonMix: Partial<Record<TaxonGroup, number>> | undefined): TaxonGroup {
  let best: TaxonGroup = "other";
  let bestCount = -1;
  for (const [key, raw] of Object.entries(taxonMix ?? {})) {
    const count = Number(raw);
    if (Number.isFinite(count) && count > bestCount) {
      best = key as TaxonGroup;
      bestCount = count;
    }
  }
  return best;
}

function themeFor(input: PublicMapCellNameInput): string {
  const group = dominantTaxonGroup(input.taxonMix);
  const gridM = Number(input.gridM);
  if (gridM > 3000) {
    switch (group) {
      case "bird": return "鳥声の遠景区";
      case "plant": return "緑の遠景区";
      case "insect": return "虫の遠景区";
      case "amphibian_reptile": return "水辺の遠景区";
      case "mammal": return "足あと遠景区";
      case "fungi": return "木陰の遠景区";
      case "other": return "発見の遠景区";
    }
  }
  if (gridM > 1000) {
    switch (group) {
      case "bird": return "鳥声の探索区";
      case "plant": return "草花の探索区";
      case "insect": return "虫の探索区";
      case "amphibian_reptile": return "水辺の探索区";
      case "mammal": return "足あと探索区";
      case "fungi": return "木陰の探索区";
      case "other": return "発見の探索区";
    }
  }
  switch (group) {
    case "bird": return "鳥声の小径";
    case "plant": return "草花の小径";
    case "insect": return "虫の小径";
    case "amphibian_reptile": return "水辺の入口";
    case "mammal": return "足あと回廊";
    case "fungi": return "木陰の胞子庭";
    case "other": return "発見の小径";
  }
}

function scaleLabel(gridM: number): string {
  if (!Number.isFinite(gridM)) return "メッシュ図鑑";
  if (gridM <= 1000) return "近所メッシュ";
  if (gridM <= 3000) return "まちメッシュ";
  return "広域メッシュ";
}

function basePlaceName(input: PublicMapCellNameInput): string {
  const nearby = cleanLabel(input.nearbyAreaName);
  if (nearby) return `${nearby}周辺`;

  const locality = cleanLabel(input.localityLabel);
  if (locality && locality !== "位置をぼかしています") return locality;
  return input.gridM > 3000 ? "この広いあたり" : "このあたり";
}

export function buildPublicMapCellName(input: PublicMapCellNameInput): PublicMapCellName {
  const themeLabel = themeFor(input);
  const localityLabel = cleanLabel(input.localityLabel) || "位置をぼかしています";
  const nearbyAreaName = cleanLabel(input.nearbyAreaName) || null;
  const nameEraLabel = cleanLabel(input.nameEraLabel) || null;
  return {
    albumName: `${basePlaceName(input)}・${themeLabel}`,
    localityLabel,
    themeLabel,
    scaleLabel: scaleLabel(input.gridM),
    nearbyAreaName,
    nameEraLabel,
  };
}

export function isGenericMeshAlbumName(name: string): boolean {
  const normalized = cleanLabel(name);
  if (!normalized) return true;
  if (/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/.test(normalized)) return true;
  if (/^(?:mesh|メッシュ|100mメッシュ|観察エリア|この場所|このあたり)$/i.test(normalized)) return true;
  if (/^\d+(?:m|km)?\s*(?:mesh|メッシュ)$/i.test(normalized)) return true;
  return false;
}
