import type {
  PlaceAtlasFacet,
  PlaceAtlasProfile,
  PlaceAtlasProfileRecord,
} from "./placeAtlasContract.js";
import {
  defaultPlacePolicy,
  initialCanonicalPlaceId,
  type PlaceKind,
  type PlacePolicyProjection,
} from "./placeDomain.js";

export const PLACE_ATLAS_PROFILE_V2_VERSION = "place_atlas_profile/v2" as const;

export type PlaceRelationshipProjection = {
  relationshipType: "parent" | "child" | "contains" | "part_of" | "overlaps" | "replaces" | "same_as_candidate";
  placeId: string;
  name: string;
  placeKind: PlaceKind;
  verificationStatus: string;
};

export type PlaceSourceProjection = {
  sourceType: string;
  sourceId: string;
  sourceUrl: string | null;
  confidence: number;
  verificationStatus: string;
  lastCheckedAt: string | null;
};

export type PlaceAtlasV2Identity = {
  canonicalPlaceId?: string | null;
  aliases?: string[];
  multilingualNames?: Record<string, string>;
  placeKind?: PlaceKind | null;
  verificationStatus?: "unverified" | "source_verified" | "administrator_verified";
  officialStatus?: "official" | "unofficial" | "unknown";
  boundary?: {
    available: boolean;
    geometryKind: "Polygon" | "MultiPolygon" | "none";
    precision: "exact" | "approximate" | "public_cell" | "suppressed";
    confidence: number | null;
    validationState: string;
  };
  relationships?: PlaceRelationshipProjection[];
  sourceReferences?: PlaceSourceProjection[];
  policy?: PlacePolicyProjection;
};

export type PlaceAtlasProfileV2 = {
  version: 2;
  contract: typeof PLACE_ATLAS_PROFILE_V2_VERSION;
  placeRef: PlaceAtlasProfile["placeRef"];
  place: {
    canonicalPlaceId: string;
    canonicalName: string;
    aliases: string[];
    multilingualNames: Record<string, string>;
    placeKind: PlaceKind;
    localityLabel: string | null;
    summary: string | null;
    verificationStatus: "unverified" | "source_verified" | "administrator_verified";
    officialStatus: "official" | "unofficial" | "unknown";
    boundary: NonNullable<PlaceAtlasV2Identity["boundary"]>;
  };
  hierarchy: {
    relationships: PlaceRelationshipProjection[];
    hasChildren: boolean;
  };
  recordSummary: PlaceAtlasProfile["summary"];
  representativeMedia: PlaceAtlasProfile["place"]["representativeMedia"];
  themes: PlaceAtlasFacet[];
  highlights: PlaceAtlasProfile["highlights"];
  recentRecords: PlaceAtlasProfileRecord[];
  guide: unknown | null;
  facilities: unknown[];
  activities: unknown[];
  stories: unknown[];
  publicMemories: unknown[];
  dataGaps: PlaceAtlasProfile["dataGaps"];
  policy: PlacePolicyProjection;
  publication: PlaceAtlasProfile["publication"] & {
    responseState: "complete" | "partial" | "empty" | "suppressed";
  };
  provenance: PlaceAtlasProfile["provenance"] & {
    sourceReferences: PlaceSourceProjection[];
  };
};

function isPlaceKind(value: string): value is PlaceKind {
  return [
    "park",
    "school",
    "nature_area",
    "theme_park",
    "shopping_mall",
    "commercial_complex",
    "museum",
    "zoo",
    "aquarium",
    "stadium",
    "sports_facility",
    "resort",
    "market",
    "farm",
    "temple_shrine",
    "cultural_facility",
    "public_facility",
    "event_venue",
    "neighborhood",
    "administrative_area",
    "other_named_area",
  ].includes(value);
}

function asPlaceKind(value: string): PlaceKind {
  return isPlaceKind(value) ? value : "other_named_area";
}

function uniqueNames(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const name = value.replace(/\s+/g, " ").trim().slice(0, 160);
    const key = name.normalize("NFKC").toLocaleLowerCase("ja-JP");
    if (!name || seen.has(key)) continue;
    seen.add(key);
    output.push(name);
  }
  return output.slice(0, 32);
}

function responseState(profile: PlaceAtlasProfile): PlaceAtlasProfileV2["publication"]["responseState"] {
  if (profile.publication.status === "suppressed") return "suppressed";
  if (profile.publication.status === "partial") return "partial";
  const hasContent =
    (profile.summary.recordCount ?? 0) > 0 ||
    profile.facets.length > 0 ||
    profile.memories.length > 0 ||
    profile.facilities.length > 0 ||
    (profile.activities?.length ?? 0) > 0 ||
    (profile.stories?.length ?? 0) > 0 ||
    Boolean(profile.guide);
  return hasContent ? "complete" : "empty";
}

export function buildPlaceAtlasProfileV2(
  profile: PlaceAtlasProfile,
  identity: PlaceAtlasV2Identity = {},
): PlaceAtlasProfileV2 {
  const placeKind = identity.placeKind ?? asPlaceKind(profile.place.type);
  const canonicalPlaceId =
    identity.canonicalPlaceId ??
    profile.place.canonicalPlaceId ??
    initialCanonicalPlaceId({
      canonicalName: profile.place.name,
      localityLabel: profile.place.localityLabel ?? "",
      placeKind,
    });
  const policy =
    identity.policy ??
    profile.policy ??
    defaultPlacePolicy({ placeKind });
  const aliases = uniqueNames([
    ...(profile.place.aliases ?? []),
    ...(identity.aliases ?? []),
  ]).filter((alias) => alias !== profile.place.name);
  const relationships = (identity.relationships ?? []).slice(0, 64);
  return {
    version: 2,
    contract: PLACE_ATLAS_PROFILE_V2_VERSION,
    placeRef: profile.placeRef,
    place: {
      canonicalPlaceId,
      canonicalName: profile.place.name,
      aliases,
      multilingualNames: {
        ...(profile.place.multilingualNames ?? {}),
        ...(identity.multilingualNames ?? {}),
      },
      placeKind,
      localityLabel: profile.place.localityLabel,
      summary: profile.place.description,
      verificationStatus:
        identity.verificationStatus ??
        profile.place.verificationStatus ??
        "unverified",
      officialStatus:
        identity.officialStatus ??
        profile.place.officialStatus ??
        "unknown",
      boundary: identity.boundary ?? {
        available: profile.placeRef.kind !== "public_cell",
        geometryKind: profile.placeRef.kind === "public_cell" ? "none" : "Polygon",
        precision: profile.placeRef.kind === "public_cell"
          ? "public_cell"
          : profile.placeRef.kind === "osm_area"
            ? "exact"
            : "approximate",
        confidence: profile.placeRef.kind === "osm_area" ? 0.75 : null,
        validationState: profile.placeRef.kind === "osm_area"
          ? "source_validated"
          : "unverified",
      },
    },
    hierarchy: {
      relationships,
      hasChildren: relationships.some((relationship) =>
        relationship.relationshipType === "child" || relationship.relationshipType === "contains"
      ),
    },
    recordSummary: profile.summary,
    representativeMedia: profile.place.representativeMedia,
    themes: profile.facets,
    highlights: profile.highlights,
    recentRecords: profile.recentRecords,
    guide: profile.guide,
    facilities: profile.facilities,
    activities: profile.activities ?? [],
    stories: profile.stories ?? [],
    publicMemories: profile.memories,
    dataGaps: profile.dataGaps,
    policy,
    publication: {
      ...profile.publication,
      responseState: responseState(profile),
    },
    provenance: {
      ...profile.provenance,
      sourceReferences: (identity.sourceReferences ?? profile.provenance.sourceReferences ?? []).slice(0, 32),
    },
  };
}
