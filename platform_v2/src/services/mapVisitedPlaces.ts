import { listPlaceMemoryVisits, type PlaceMemoryVisitSort } from "./placeMemory.js";

export type MapVisitedPlace = {
  placeId: string;
  placeName: string;
  municipality: string | null;
  lastObservedAt: string | null;
  visitCount: number;
  latestVisitId: string | null;
  latestDisplayName: string | null;
  revisitReason: string | null;
  nextLookFor: string | null;
  lastRecordMode: string | null;
  lastSurveyResult: string | null;
  absenceSemantics: string | null;
  latitude: number;
  longitude: number;
  seasonalVisitCount: number;
  currentSeasonVisited: boolean;
};

function isPrefectureOnlyLabel(value: string): boolean {
  return /(?:都|道|府|県)$/.test(value.trim());
}

export function normalizeMapVisitedPlaceName(input: {
  placeName?: string | null;
  municipality?: string | null;
}): string {
  const placeName = String(input.placeName ?? "").trim();
  const municipality = String(input.municipality ?? "").trim();
  if (municipality && (!placeName || isPrefectureOnlyLabel(placeName))) {
    return municipality;
  }
  return placeName || municipality;
}

export async function listMapVisitedPlaces(
  userId: string,
  options: { limit?: number; sort?: PlaceMemoryVisitSort } = {},
): Promise<MapVisitedPlace[]> {
  return (await listPlaceMemoryVisits(userId, options))
    .map((row) => ({
      placeId: row.placeId,
      placeName: normalizeMapVisitedPlaceName({
        placeName: row.placeName,
        municipality: row.municipality,
      }),
      municipality: row.municipality,
      lastObservedAt: row.lastObservedAt,
      visitCount: row.visitCount,
      latestVisitId: row.latestVisitId,
      latestDisplayName: row.latestDisplayName,
      revisitReason: row.revisitReason,
      nextLookFor: row.nextLookFor,
      lastRecordMode: row.lastRecordMode,
      lastSurveyResult: row.lastSurveyResult,
      absenceSemantics: row.absenceSemantics,
      latitude: Number(row.latitude),
      longitude: Number(row.longitude),
      seasonalVisitCount: row.seasonalVisitCount,
      currentSeasonVisited: row.currentSeasonVisited,
    }))
    .filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude));
}
