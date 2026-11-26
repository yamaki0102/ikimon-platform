import { PLACE_SLOTS, type PlaceSlot, type ReadingFoundItem, type ReadingPlaceFields, type ReadingState, type RecordReading } from "./recordReading";

export type RecordPageMediaRef = { mediaId: string; mediaKind: "photo" | "video" | "audio" };
export type RecordPageTimeRange = { startMs: number; endMs: number };
export type RecordPageFoundItem = { kind: "organism" | "feature"; label: string; state: ReadingState; timeRange?: RecordPageTimeRange };
export type RecordPagePlaceField = { slot: PlaceSlot; code: string; label: string; state: ReadingState };
export type RecordPageMediaSection = {
  assetId: string;
  kind: RecordPageMediaRef["mediaKind"];
  found: RecordPageFoundItem[];
  place: RecordPagePlaceField[] | null;
  placeState: "read" | "pending";
  fromReading: boolean;
};
export type RecordPageSections = { media: RecordPageMediaSection[] };

export type RecordPageInput = {
  reading: RecordReading | null | undefined;
  media: readonly RecordPageMediaRef[];
  protectedRecord?: boolean;
};

function foundLabel(item: ReadingFoundItem): string | null {
  const label = item.kind === "feature" ? item.labelJa : (item.name?.vernacular || item.name?.scientific || null);
  const trimmed = label?.trim();
  return trimmed ? trimmed : null;
}

function foundItems(items: readonly ReadingFoundItem[], protectedRecord: boolean): RecordPageFoundItem[] {
  const seen = new Set<string>();
  const out: RecordPageFoundItem[] = [];
  for (const item of items) {
    const label = foundLabel(item);
    if (!label) continue;
    const key = `${item.kind}:${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const entry: RecordPageFoundItem = { kind: item.kind, label, state: item.state };
    if (item.locator.kind === "time_range" && !(protectedRecord && item.kind === "organism")) {
      entry.timeRange = { startMs: item.locator.startMs ?? 0, endMs: item.locator.endMs ?? 0 };
    }
    out.push(entry);
  }
  return out;
}

function placeFields(place: ReadingPlaceFields): RecordPagePlaceField[] | null {
  const fields: RecordPagePlaceField[] = [];
  for (const slot of PLACE_SLOTS) {
    const value = place[slot];
    if (!value || value.code === "unknown" || !value.labelJa) continue;
    fields.push({ slot, code: value.code, label: value.labelJa, state: value.state });
  }
  return fields.length > 0 ? fields : null;
}

export function buildRecordPageSections(input: RecordPageInput): RecordPageSections {
  const protectedRecord = Boolean(input.protectedRecord);
  const byAsset = new Map((input.reading?.media ?? []).map((entry) => [entry.assetId, entry]));
  const recordFound = input.reading ? foundItems(input.reading.recordLevel.found, protectedRecord) : [];
  const recordPlace = input.reading ? placeFields(input.reading.recordLevel.place) : null;
  const media = input.media.map((ref): RecordPageMediaSection => {
    const entry = byAsset.get(ref.mediaId);
    const ownFound = entry ? foundItems(entry.found, protectedRecord) : [];
    const ownPlace = entry ? placeFields(entry.place) : null;
    const found = ownFound.length > 0 ? ownFound : recordFound;
    const place = ownPlace ?? recordPlace;
    const fromReading = found.length > 0 || place !== null;
    return { assetId: ref.mediaId, kind: ref.mediaKind, found, place, placeState: place ? "read" : "pending", fromReading };
  });
  return { media };
}

export function recordPageSectionsJson(sections: RecordPageSections): { media: Array<{ assetId: string; kind: string; found: RecordPageFoundItem[]; place: RecordPagePlaceField[] | null; placeState: "read" | "pending" }> } {
  return { media: sections.media.map(({ assetId, kind, found, place, placeState }) => ({ assetId, kind, found, place, placeState })) };
}
