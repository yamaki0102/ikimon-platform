export const MAP_EXPLORER_STATE_KEYS = [
  "tab",
  "role",
  "actor",
  "mp",
  "taxon",
  "year",
  "season",
  "bm",
  "ov",
  "lng",
  "lat",
  "z",
  "traces",
  "cell",
] as const;

export type MapExplorerOverlayShareState = {
  id: string;
  enabled: boolean;
  opacity: number | null;
};

export type MapExplorerShareStateInput = {
  tab?: string | null;
  role?: string | null;
  actorClass?: string | null;
  markerProfile?: string | null;
  taxonGroup?: string | null;
  year?: string | number | null;
  season?: string | null;
  basemap?: string | null;
  tracesVisible?: boolean;
  selectedCellId?: string | null;
  overlays?: MapExplorerOverlayShareState[];
  center?: { lng: number; lat: number } | null;
  zoom?: number | null;
};

export type MapExplorerCellsSelectionInput = {
  selectedCellId: string | null;
  availableCellIds: string[];
  responseSeq: number;
  latestRequestSeq: number;
};

export type MapExplorerCellsSelectionOutcome = {
  apply: boolean;
  selectedCellId: string | null;
  clearSelectedPoint: boolean;
};

function normalizeStateText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function normalizeFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pushStateParam(parts: string[], key: string, value: string | null): void {
  if (!value) return;
  parts.push(`${key}=${encodeURIComponent(value)}`);
}

function pushStateFloat(parts: string[], key: string, value: number | null, digits: number): void {
  if (value == null) return;
  parts.push(`${key}=${value.toFixed(digits)}`);
}

function overlayShareEntries(
  overlays: MapExplorerOverlayShareState[] | undefined,
): string[] {
  const entries: string[] = [];
  for (const overlay of overlays ?? []) {
    if (!overlay || overlay.enabled !== true) continue;
    const id = normalizeStateText(overlay.id);
    const opacity = normalizeFiniteNumber(overlay.opacity);
    if (!id || opacity == null) continue;
    entries.push(`${id}:${opacity.toFixed(2)}`);
  }
  return entries;
}

export function shouldApplyAsyncResponse(responseSeq: number, latestRequestSeq: number): boolean {
  return Number.isFinite(responseSeq) && Number.isFinite(latestRequestSeq) && responseSeq === latestRequestSeq;
}

export function reconcileSelectedCellAfterCellsResponse(
  input: MapExplorerCellsSelectionInput,
): MapExplorerCellsSelectionOutcome {
  const selectedCellId = normalizeStateText(input.selectedCellId);
  if (!shouldApplyAsyncResponse(input.responseSeq, input.latestRequestSeq)) {
    return {
      apply: false,
      selectedCellId,
      clearSelectedPoint: false,
    };
  }

  let selectedStillAvailable = false;
  if (selectedCellId) {
    for (const candidate of input.availableCellIds) {
      if (normalizeStateText(candidate) === selectedCellId) {
        selectedStillAvailable = true;
        break;
      }
    }
  }

  return {
    apply: true,
    selectedCellId: selectedStillAvailable ? selectedCellId : null,
    clearSelectedPoint: Boolean(selectedCellId && !selectedStillAvailable),
  };
}

export function serializeSharedMapState(input: MapExplorerShareStateInput): string {
  const parts: string[] = [];
  const tab = normalizeStateText(input.tab);
  const role = normalizeStateText(input.role);
  const actorClass = normalizeStateText(input.actorClass);
  const markerProfile = normalizeStateText(input.markerProfile);
  const taxonGroup = normalizeStateText(input.taxonGroup);
  const year =
    typeof input.year === "number"
      ? String(input.year)
      : normalizeStateText(input.year);
  const season = normalizeStateText(input.season);
  const basemap = normalizeStateText(input.basemap);
  const selectedCellId = normalizeStateText(input.selectedCellId);
  const center = input.center ?? null;
  const zoom = normalizeFiniteNumber(input.zoom);

  pushStateParam(parts, "tab", tab && tab !== "markers" ? tab : null);
  pushStateParam(parts, "role", role && role !== "mixed" ? role : null);
  pushStateParam(parts, "actor", actorClass && actorClass !== "all" ? actorClass : null);
  pushStateParam(parts, "mp", markerProfile && markerProfile !== "all_research_artifacts" ? markerProfile : null);
  pushStateParam(parts, "taxon", taxonGroup);
  pushStateParam(parts, "year", year);
  pushStateParam(parts, "season", season);
  pushStateParam(parts, "bm", basemap && basemap !== "standard" ? basemap : null);
  if (input.tracesVisible) parts.push("traces=1");
  pushStateParam(parts, "cell", selectedCellId);

  const overlayEntries = overlayShareEntries(input.overlays);
  if (overlayEntries.length > 0) {
    parts.push(`ov=${encodeURIComponent(overlayEntries.join(","))}`);
  }

  if (center) {
    pushStateFloat(parts, "lng", normalizeFiniteNumber(center.lng), 4);
    pushStateFloat(parts, "lat", normalizeFiniteNumber(center.lat), 4);
  }
  pushStateFloat(parts, "z", zoom, 1);
  return parts.join("&");
}

const RUNTIME_HELPERS = [
  normalizeStateText,
  normalizeFiniteNumber,
  pushStateParam,
  pushStateFloat,
  overlayShareEntries,
  shouldApplyAsyncResponse,
  reconcileSelectedCellAfterCellsResponse,
  serializeSharedMapState,
];

export const MAP_EXPLORER_STATE_RUNTIME = [
  "var MapExplorerStateHelpers = (function () {",
  `var MAP_STATE_KEYS = ${JSON.stringify(MAP_EXPLORER_STATE_KEYS)};`,
  ...RUNTIME_HELPERS.map((helper) => helper.toString()),
  "return {",
  "  MAP_STATE_KEYS: MAP_STATE_KEYS,",
  "  shouldApplyAsyncResponse: shouldApplyAsyncResponse,",
  "  reconcileSelectedCellAfterCellsResponse: reconcileSelectedCellAfterCellsResponse,",
  "  serializeSharedMapState: serializeSharedMapState",
  "};",
  "})();",
].join("\n");
