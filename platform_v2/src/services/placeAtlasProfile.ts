import { computeBbox } from "./geoJsonBbox.js";
import { getPool } from "../db.js";
import {
  resolveOsmAreaByRef,
  type ResolvedOsmArea,
} from "./areaPolygons.js";
import {
  loadAreaSnapshotVisitIds,
  type AreaSnapshotScopeField,
} from "./areaSnapshotVisitScope.js";
import { resolveFieldProfileView } from "./fieldProfilePolicy.js";
import { getField, type ObservationField } from "./observationFieldRegistry.js";
import { getMapObservations, type PublicMapObservationList } from "./mapSnapshot.js";
import { buildPublicCellId } from "./publicLocation.js";
import { listMapGuideSpotsForBbox } from "./mapGuideSpots.js";
import { listPublicPlaceMemories } from "./placeMemory.js";
import {
  buildPlaceAtlasProfile,
  type PlaceAtlasBuildInput,
  type PlaceAtlasProfile,
  type PlaceAtlasRef,
  type PlaceAtlasSourceRecord,
} from "./placeAtlasContract.js";
import {
  defaultPlacePolicy,
  initialCanonicalPlaceId,
  type PlaceKind,
} from "./placeDomain.js";
import {
  loadRegisteredPlaceProfileByOsmRef,
  type RegisteredPlaceProfileProjection,
} from "./placeRegistry.js";

type Bbox = [number, number, number, number];

export type PlaceAtlasProfileContext = {
  viewerUserId?: string | null;
};

export type PlaceAtlasProfileDependencies = {
  getField: typeof getField;
  getMapObservations: typeof getMapObservations;
  loadAreaVisitIds: typeof loadAreaSnapshotVisitIds;
  resolveOsmArea: typeof resolveOsmAreaByRef;
  listGuideSpots: typeof listMapGuideSpotsForBbox;
  listPublicMemories: typeof listPublicPlaceMemories;
  loadRecordThemes: (recordIds: string[]) => Promise<Map<string, NonNullable<PlaceAtlasSourceRecord["themes"]>>>;
  loadRegisteredPlace: (
    osmType: "way" | "relation",
    osmId: number,
  ) => Promise<RegisteredPlaceProfileProjection | null>;
  now: () => string;
};

async function loadAcceptedRecordThemes(
  recordIds: string[],
): Promise<Map<string, NonNullable<PlaceAtlasSourceRecord["themes"]>>> {
  const output = new Map<string, NonNullable<PlaceAtlasSourceRecord["themes"]>>();
  if (recordIds.length === 0) return output;
  try {
    const result = await getPool().query<{ record_id: string; theme: string }>(
      `SELECT record_id, theme
         FROM record_theme_assertions
        WHERE record_id = ANY($1::text[])
          AND assertion_status = 'accepted'
        ORDER BY confidence DESC, updated_at DESC`,
      [recordIds],
    );
    for (const row of result.rows) {
      if (![
        "nature", "scenery", "daily_life", "facility", "activity",
        "history", "audio_visual", "insight", "unclassified",
      ].includes(row.theme)) continue;
      const current = output.get(row.record_id) ?? [];
      const theme = row.theme as NonNullable<PlaceAtlasSourceRecord["themes"]>[number];
      if (!current.includes(theme)) current.push(theme);
      output.set(row.record_id, current);
    }
  } catch (error) {
    if (/record_theme_assertions|does not exist/i.test(error instanceof Error ? error.message : String(error))) {
      return output;
    }
    throw error;
  }
  return output;
}

const defaultDependencies: PlaceAtlasProfileDependencies = {
  getField,
  getMapObservations,
  loadAreaVisitIds: loadAreaSnapshotVisitIds,
  resolveOsmArea: resolveOsmAreaByRef,
  listGuideSpots: listMapGuideSpotsForBbox,
  listPublicMemories: listPublicPlaceMemories,
  loadRecordThemes: loadAcceptedRecordThemes,
  loadRegisteredPlace: loadRegisteredPlaceProfileByOsmRef,
  now: () => new Date().toISOString(),
};

function areaBbox(field: Pick<AreaSnapshotScopeField, "lat" | "lng" | "radiusM" | "polygon">): Bbox {
  const polygonBbox = computeBbox(field.polygon);
  if (polygonBbox) {
    return [polygonBbox.minLng, polygonBbox.minLat, polygonBbox.maxLng, polygonBbox.maxLat];
  }
  const radiusM = Math.max(50, Math.min(field.radiusM || 1000, 200_000));
  const latPad = radiusM / 111_000;
  const lngPad = radiusM / (111_000 * Math.max(0.05, Math.cos((field.lat * Math.PI) / 180)));
  return [field.lng - lngPad, field.lat - latPad, field.lng + lngPad, field.lat + latPad];
}

function fieldType(field: ObservationField): string {
  const level = field.adminLevel || field.source;
  if (level === "osm_park") return "park";
  if (level === "school") return "school";
  if (level === "nature_symbiosis_site") return "nature_symbiosis_site";
  if (level === "protected_area" || level === "oecm") return "protected_area";
  if (level === "admin_municipality" || level === "admin_prefecture" || level === "admin_country") {
    return "administrative_area";
  }
  return "observation_field";
}

function fieldPlaceKind(field: ObservationField): PlaceKind {
  const type = fieldType(field);
  if (type === "nature_symbiosis_site" || type === "protected_area") return "nature_area";
  if (type === "observation_field") return "other_named_area";
  return type as PlaceKind;
}

function fieldLocalityLabel(field: ObservationField): string | null {
  return [field.prefecture, field.city].filter(Boolean).join(" ") || null;
}

function recordIdentificationStatus(
  record: PublicMapObservationList["items"][number],
): PlaceAtlasSourceRecord["identificationStatus"] {
  if (record.isAiCandidate) return "ai_candidate";
  if (record.isAwaitingId) return "awaiting_identification";
  return "confirmed";
}

function sourceRecords(
  list: PublicMapObservationList,
  themes: Map<string, NonNullable<PlaceAtlasSourceRecord["themes"]>> = new Map(),
): PlaceAtlasSourceRecord[] {
  return list.items.map((record) => ({
    recordId: record.visitId,
    observedAt: record.observedAt,
    displayName: record.displayName,
    href: `/observations/${encodeURIComponent(record.occurrenceId)}`,
    mediaUrl: record.photoUrl,
    mediaKind: record.photoUrl ? "photo" : "record",
    taxonGroup: record.taxonGroup,
    themes: themes.get(record.visitId) ?? [],
    identificationStatus: recordIdentificationStatus(record),
  }));
}

function filteredSourceRecords(
  list: PublicMapObservationList,
  visitIds: Set<string> | null,
  themes: Map<string, NonNullable<PlaceAtlasSourceRecord["themes"]>> = new Map(),
): PlaceAtlasSourceRecord[] {
  const records = sourceRecords(list, themes);
  return visitIds ? records.filter((record) => visitIds.has(record.recordId)) : records;
}

function recordsComplete(list: PublicMapObservationList): boolean {
  return list.stats.totalAll <= list.items.length;
}

function guidePayloadForBbox(
  bbox: Bbox,
  dependencies: PlaceAtlasProfileDependencies,
): Record<string, unknown> | null {
  const guide = dependencies.listGuideSpots({ bbox, limit: 8 }).features[0]?.properties;
  if (!guide || guide.visibilityStatus === "hidden" || guide.sensitiveReviewStatus !== "cleared") return null;
  return {
    id: guide.id,
    title: guide.title,
    subtitle: guide.subtitle,
    category: guide.category,
    preview: guide.preview,
    storyPoints: guide.storyPoints.slice(0, 4),
    safetyStatus: guide.safetyStatus ?? "active",
    sourceLinks: guide.sourceLinks
      .filter((link) => /^https:\/\//i.test(link.url))
      .slice(0, 4),
    href: `/guide?spot=${encodeURIComponent(guide.id)}`,
  };
}

function sanitizeFacilities(field: ObservationField): Array<Record<string, string>> {
  const raw = field.payload.facilities;
  if (!Array.isArray(raw)) return [];
  const output: Array<Record<string, string>> = [];
  for (const value of raw) {
    if (typeof value === "string") {
      const label = value.replace(/\s+/g, " ").trim().slice(0, 80);
      if (label) output.push({ label, sourceLabel: "field_registry" });
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      const label = typeof record.label === "string"
        ? record.label.replace(/\s+/g, " ").trim().slice(0, 80)
        : "";
      const kind = typeof record.kind === "string"
        ? record.kind.replace(/[^a-z0-9_-]/gi, "").slice(0, 48)
        : "";
      if (label) output.push({ label, ...(kind ? { kind } : {}), sourceLabel: "field_registry" });
    }
    if (output.length >= 12) break;
  }
  return output;
}

async function memoriesForCell(
  cellId: string,
  dependencies: PlaceAtlasProfileDependencies,
): Promise<unknown[]> {
  try {
    return await dependencies.listPublicMemories({
      cellId,
      limit: 12,
    });
  } catch {
    return [];
  }
}

async function loadAreaRecords(
  scope: AreaSnapshotScopeField,
  bbox: Bbox,
  fallbackCellId: string,
  dependencies: PlaceAtlasProfileDependencies,
): Promise<{
  records: PlaceAtlasSourceRecord[];
  complete: boolean;
  locationMode: "field" | "osm_area" | "public_cell_derived";
  directScopeAvailable: boolean;
}> {
  try {
    const visitIds = new Set(await dependencies.loadAreaVisitIds(scope, null));
    const list = await dependencies.getMapObservations({ bbox, zoom: 16, limit: 1200 });
    const themes = await dependencies.loadRecordThemes(list.items.map((record) => record.visitId));
    return {
      records: filteredSourceRecords(list, visitIds, themes),
      complete: recordsComplete(list),
      locationMode: scope.fieldId.startsWith("osm-live:") ? "osm_area" : "field",
      directScopeAvailable: true,
    };
  } catch {
    const list = await dependencies.getMapObservations({ cellId: fallbackCellId, limit: 1200 });
    const themes = await dependencies.loadRecordThemes(list.items.map((record) => record.visitId));
    return {
      records: filteredSourceRecords(list, null, themes),
      complete: recordsComplete(list),
      locationMode: "public_cell_derived",
      directScopeAvailable: false,
    };
  }
}

function fieldPolicySuppression(field: ObservationField): {
  sections: string[];
  dataGaps: PlaceAtlasBuildInput["dataGaps"];
} {
  const view = resolveFieldProfileView({
    profileStatus: field.profileStatus ?? "draft",
    defaultPublicLocationMode: field.defaultPublicLocationMode ?? "site",
    publicProfileEnabled: field.publicProfileEnabled === true,
    profilePolicyVersion: field.profilePolicyVersion ?? "site_intelligence_p0_v1",
    profileNotes: field.profileNotes ?? "",
  }, "public");
  if (!view.suppressionReason) return { sections: [], dataGaps: [] };
  return {
    sections: ["confirmed_life", "seasonal_trends", "observation_density", "field_editorial_profile"],
    dataGaps: [{
      key: "field_public_profile",
      label: "確認済みの生きもの・季節傾向",
      reason: "fieldの公開プロフィール条件を満たすまで、確定生物や詳細傾向を表示していません。",
    }],
  };
}

async function buildFieldProfile(
  ref: Extract<PlaceAtlasRef, { kind: "field" }>,
  context: PlaceAtlasProfileContext,
  dependencies: PlaceAtlasProfileDependencies,
): Promise<PlaceAtlasProfile | null> {
  const field = await dependencies.getField(ref.fieldId);
  if (!field || field.profileStatus === "hidden" || field.profileStatus === "private") return null;
  const bbox = areaBbox(field);
  const cellId = buildPublicCellId(field.lat, field.lng, 1000);
  const [areaRecords, memories] = await Promise.all([
    loadAreaRecords(field, bbox, cellId, dependencies),
    memoriesForCell(cellId, dependencies),
  ]);
  const policy = fieldPolicySuppression(field);
  const kind = fieldPlaceKind(field);
  const directScopeGap = areaRecords.directScopeAvailable ? [] : [{
    key: "field_exact_aggregation",
    label: "field内Record",
    reason: "場所へのdirect linkageを確認できないため、公開セル内のRecordを場所周辺として表示しています。",
  }];
  return buildPlaceAtlasProfile({
    placeRef: ref,
    place: {
      name: field.name,
      type: kind,
      localityLabel: fieldLocalityLabel(field),
      description: field.publicProfileEnabled ? field.summary : "公開できる場所情報と地域の記録を束ねた場所図鑑です。",
      canonicalPlaceId: initialCanonicalPlaceId({
        canonicalName: field.name,
        localityLabel: fieldLocalityLabel(field) ?? "",
        placeKind: kind,
      }),
      aliases: field.nameKana ? [field.nameKana] : [],
      verificationStatus: field.verificationLevel === "registry_matched"
        ? "source_verified"
        : "unverified",
      officialStatus: field.ownerUrl || field.officialUrl ? "official" : "unknown",
    },
    records: areaRecords.records,
    recordSetComplete: areaRecords.complete,
    locationMode: areaRecords.locationMode,
    contributorCountAllowed: false,
    guide: guidePayloadForBbox(bbox, dependencies),
    memories,
    facilities: sanitizeFacilities(field),
    policy: defaultPlacePolicy({ placeKind: kind }),
    suppressedSections: [
      ...policy.sections,
      ...(areaRecords.directScopeAvailable ? [] : ["field_exact_aggregation"]),
      ...((field.adminLevel || field.source) === "school" ? ["contribution_cta"] : []),
    ],
    dataGaps: [...(policy.dataGaps ?? []), ...directScopeGap],
    sources: [
      "observation_field_registry",
      "public_map_snapshot",
      ...(areaRecords.directScopeAvailable ? ["area_snapshot_visit_scope"] : ["public_cell_derived"]),
      ...(memories.length > 0 ? ["place_memory"] : []),
    ],
    generatedAt: dependencies.now(),
  });
}

function osmTypeLabel(area: ResolvedOsmArea): string {
  return area.placeKind ?? (area.source === "school" ? "school" : "park");
}

function registeredOsmArea(
  ref: Extract<PlaceAtlasRef, { kind: "osm_area" }>,
  registered: RegisteredPlaceProfileProjection | null,
): ResolvedOsmArea | null {
  if (!registered?.boundary) return null;
  const source = registered.placeKind === "school"
    ? "school"
    : registered.placeKind === "park"
      ? "osm_park"
      : "osm_named_area";
  return {
    entityKey: ref.entityKey,
    osmType: ref.osmType,
    osmId: ref.osmId,
    name: registered.canonicalName,
    source,
    sourceLabel: "IKIMON canonical place registry",
    placeKind: registered.placeKind,
    aliases: registered.aliases,
    multilingualNames: {},
    recordingPolicy: registered.policy.recordingPolicy,
    contributionCtaMode: registered.policy.contributionCtaMode,
    policyReason: registered.policy.reason,
    canonicalPlaceId: registered.placeId,
    access: "",
    center: registered.boundary.center,
    geometry: registered.boundary.geometry,
  };
}

async function buildOsmAreaProfile(
  ref: Extract<PlaceAtlasRef, { kind: "osm_area" }>,
  context: PlaceAtlasProfileContext,
  dependencies: PlaceAtlasProfileDependencies,
): Promise<PlaceAtlasProfile | null> {
  const registered = await dependencies.loadRegisteredPlace(ref.osmType, ref.osmId);
  const registeredArea = registeredOsmArea(ref, registered);
  const area = registeredArea ?? await dependencies.resolveOsmArea(ref.osmType, ref.osmId);
  if (!area || area.entityKey !== ref.entityKey) return null;
  const scope: AreaSnapshotScopeField = {
    fieldId: `osm-live:${area.osmType}:${area.osmId}`,
    lat: area.center.lat,
    lng: area.center.lng,
    radiusM: 1000,
    polygon: area.geometry,
  };
  const bbox = areaBbox(scope);
  const cellId = buildPublicCellId(area.center.lat, area.center.lng, 1000);
  const [areaRecords, memories] = await Promise.all([
    loadAreaRecords(scope, bbox, cellId, dependencies),
    memoriesForCell(cellId, dependencies),
  ]);
  const effectivePolicy = registered?.policy ?? {
    placeVisibility: "public" as const,
    recordingPolicy: area.recordingPolicy ?? "check_rules",
    publicLocationMode: "place" as const,
    contributionCtaMode: area.contributionCtaMode ?? "check_rules",
    ruleSource: "default" as const,
    ruleUrl: null,
    reason: area.policyReason ?? "osm_access_does_not_imply_recording_permission",
  };
  const restricted = effectivePolicy.contributionCtaMode === "suppressed" ||
    area.source === "school" ||
    ["private", "no", "restricted", "customers", "permit"].includes(area.access);
  return buildPlaceAtlasProfile({
    placeRef: ref,
    place: {
      name: registered?.canonicalName ?? area.name,
      type: registered?.placeKind ?? osmTypeLabel(area),
      localityLabel: registered?.localityLabel ?? null,
      description: registered?.description ?? "OpenStreetMapの範囲情報と、公開できる地域のRecordを束ねた場所図鑑です。",
      canonicalPlaceId: registered?.placeId ?? area.canonicalPlaceId,
      aliases: [...(registered?.aliases ?? []), ...(area.aliases ?? [])],
      multilingualNames: area.multilingualNames ?? {},
      verificationStatus: registered?.verificationStatus ?? "unverified",
      officialStatus: registered?.officialStatus ?? "unknown",
    },
    records: areaRecords.records,
    recordSetComplete: areaRecords.complete,
    locationMode: areaRecords.locationMode,
    contributorCountAllowed: false,
    guide: guidePayloadForBbox(bbox, dependencies),
    memories,
    facilities: registered?.facilities ?? [],
    activities: registered?.activities ?? [],
    stories: registered?.stories ?? [],
    policy: effectivePolicy,
    suppressedSections: [
      "confirmed_life",
      ...(areaRecords.directScopeAvailable ? [] : ["osm_exact_aggregation"]),
      ...(restricted ? ["contribution_cta"] : []),
    ],
    dataGaps: areaRecords.directScopeAvailable ? [] : [{
      key: "osm_exact_aggregation",
      label: "OSM area内Record",
      reason: "場所へのdirect linkageを確認できないため、公開セル内のRecordを場所周辺として表示しています。",
    }],
    sources: [
      "openstreetmap",
      "public_map_snapshot",
      ...(areaRecords.directScopeAvailable ? ["area_snapshot_visit_scope"] : ["public_cell_derived"]),
      ...(memories.length > 0 ? ["place_memory"] : []),
      ...(registered ? ["canonical_place_registry"] : []),
    ],
    sourceReferences: registered?.sourceReferences ?? [{
      sourceType: `osm_${ref.osmType}`,
      sourceId: `${ref.osmType}:${ref.osmId}`,
      sourceUrl: `https://www.openstreetmap.org/${ref.osmType}/${ref.osmId}`,
      confidence: 0.75,
      verificationStatus: "unverified",
      lastCheckedAt: dependencies.now(),
    }],
    generatedAt: dependencies.now(),
  });
}

async function buildPublicCellProfile(
  ref: Extract<PlaceAtlasRef, { kind: "public_cell" }>,
  context: PlaceAtlasProfileContext,
  dependencies: PlaceAtlasProfileDependencies,
): Promise<PlaceAtlasProfile> {
  const [list, memories] = await Promise.all([
    dependencies.getMapObservations({ cellId: ref.cellId, limit: 1200 }),
    memoriesForCell(ref.cellId, dependencies),
  ]);
  const themes = await dependencies.loadRecordThemes(list.items.map((record) => record.visitId));
  return buildPlaceAtlasProfile({
    placeRef: ref,
    place: {
      name: "このあたりの地域図鑑",
      type: "public_cell",
      localityLabel: "位置をぼかして表示しています",
      description: "公開位置を保護した範囲で、このあたりのRecordをまとめています。",
    },
    records: sourceRecords(list, themes),
    recordSetComplete: recordsComplete(list),
    locationMode: "public_cell",
    contributorCountAllowed: false,
    memories,
    policy: {
      ...defaultPlacePolicy({ placeKind: "administrative_area" }),
      publicLocationMode: "public_cell",
    },
    suppressedSections: ["exact_location", "confirmed_life"],
    dataGaps: [{
      key: "exact_location",
      label: "正確な位置",
      reason: "投稿者、私有地、学校、希少種等を守るため、公開セルより細かい位置は表示しません。",
    }],
    sources: ["public_map_snapshot", ...(memories.length > 0 ? ["place_memory"] : [])],
    generatedAt: dependencies.now(),
  });
}

export async function getPlaceAtlasProfile(
  ref: PlaceAtlasRef,
  context: PlaceAtlasProfileContext = {},
  dependencies: PlaceAtlasProfileDependencies = defaultDependencies,
): Promise<PlaceAtlasProfile | null> {
  if (ref.kind === "field") return buildFieldProfile(ref, context, dependencies);
  if (ref.kind === "osm_area") return buildOsmAreaProfile(ref, context, dependencies);
  return buildPublicCellProfile(ref, context, dependencies);
}

export const __test__ = {
  areaBbox,
  fieldPolicySuppression,
  fieldType,
  recordsComplete,
  sanitizeFacilities,
  sourceRecords,
  registeredOsmArea,
};
