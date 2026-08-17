import { fileURLToPath } from "node:url";
import { PRODUCTION_PUBLIC_ORIGIN } from "../services/trustedPublicOrigin.js";

type FetchResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
};

export type FetchLike = (input: string, init?: { headers?: Record<string, string> }) => Promise<FetchResponse>;

export type PublicMapObservationItem = {
  visitId?: unknown;
  occurrenceId?: unknown;
  observedAt?: unknown;
  displayName?: unknown;
  photoUrl?: unknown;
  cellId?: unknown;
};

export type ObservationImageTarget = {
  path: string;
  visitId: string;
  occurrenceId: string;
  observedAt: string;
  displayName: string;
  photoUrl: string;
  source: "record-path" | "occurrence-path";
};

export type ResolveObservationImageTargetsOptions = {
  baseUrl?: string;
  bbox?: string;
  zoom?: number;
  limit?: number;
  count?: number;
  fetchImpl?: FetchLike;
};

export type ResolveObservationImageTargetsResult = {
  sourceUrl: string;
  totalMapItems: number;
  photoCandidates: number;
  targets: ObservationImageTarget[];
};

const DEFAULT_BASE_URL = PRODUCTION_PUBLIC_ORIGIN;
const DEFAULT_BBOX = "122.9,24.0,146.0,45.6";
const DEFAULT_ZOOM = 6;
const DEFAULT_LIMIT = 1500;
const DEFAULT_TARGET_COUNT = 4;
const PHOTO_ONLY_STACK_RE =
  /class="[^"]*\bobs-hero-media-stack\b[^"]*\bis-photo-only\b[^"]*"|class="[^"]*\bis-photo-only\b[^"]*\bobs-hero-media-stack\b[^"]*"/u;
const VIDEO_FRAME_RE = /class="[^"]*\bobs-hero-video-frame\b[^"]*"/u;
const VIDEO_RAIL_RE = /class="[^"]*\bobs-video-evidence-frame\b[^"]*"/u;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

function normalizedBaseUrl(value: string | undefined): string {
  const raw = (value ?? DEFAULT_BASE_URL).trim().replace(/\/+$/u, "");
  if (!raw) return DEFAULT_BASE_URL;
  return raw;
}

function mapApiUrl(baseUrl: string, bbox: string, zoom: number, limit: number): string {
  const url = new URL("/ja/api/v1/map/observations", baseUrl);
  url.searchParams.set("bbox", bbox);
  url.searchParams.set("zoom", String(zoom));
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("deploy_smoke_target_resolver", String(Date.now()));
  return url.toString();
}

function isRecordVisitId(visitId: string): boolean {
  return /^record-\d+$/u.test(visitId);
}

export function observationImageTargetPath(item: Pick<ObservationImageTarget, "visitId" | "occurrenceId">): string {
  if (isRecordVisitId(item.visitId)) {
    const subject = encodeURIComponent(item.occurrenceId);
    return `/observations/${encodeURIComponent(item.visitId)}?subject=${subject}&lang=ja`;
  }
  return `/observations/${encodeURIComponent(item.occurrenceId)}?lang=ja`;
}

export function observationImageTargetFromMapItem(item: PublicMapObservationItem): ObservationImageTarget | null {
  const visitId = stringValue(item.visitId);
  const occurrenceId = stringValue(item.occurrenceId);
  const photoUrl = stringValue(item.photoUrl);
  if (!visitId || !occurrenceId || !photoUrl) return null;
  return {
    path: observationImageTargetPath({ visitId, occurrenceId }),
    visitId,
    occurrenceId,
    observedAt: stringValue(item.observedAt),
    displayName: stringValue(item.displayName),
    photoUrl,
    source: isRecordVisitId(visitId) ? "record-path" : "occurrence-path",
  };
}

export function detailHtmlMatchesPhotoOnlyObservation(html: string): boolean {
  return PHOTO_ONLY_STACK_RE.test(html)
    && html.includes("data-obs-preview-img")
    && !VIDEO_FRAME_RE.test(html)
    && !VIDEO_RAIL_RE.test(html)
    && !html.includes("この映像で読む対象を切り替える");
}

async function validateTarget(baseUrl: string, target: ObservationImageTarget, fetchImpl: FetchLike): Promise<boolean> {
  const response = await fetchImpl(new URL(target.path, baseUrl).toString(), {
    headers: { accept: "text/html", "cache-control": "no-store" },
  });
  if (response.status !== 200) return false;
  const html = await response.text();
  return detailHtmlMatchesPhotoOnlyObservation(html);
}

async function appendValidatedTargets(
  selected: ObservationImageTarget[],
  candidates: ObservationImageTarget[],
  needed: number,
  baseUrl: string,
  fetchImpl: FetchLike,
  seen: Set<string>,
): Promise<void> {
  for (const candidate of candidates) {
    if (selected.length >= needed) return;
    if (seen.has(candidate.occurrenceId)) continue;
    if (!(await validateTarget(baseUrl, candidate, fetchImpl))) continue;
    selected.push(candidate);
    seen.add(candidate.occurrenceId);
  }
}

export async function resolveObservationImageTargets(
  options: ResolveObservationImageTargetsOptions = {},
): Promise<ResolveObservationImageTargetsResult> {
  const baseUrl = normalizedBaseUrl(options.baseUrl ?? process.env.OBSERVATION_DETAIL_BASE_URL);
  const bbox = options.bbox ?? process.env.OBSERVATION_IMAGE_TARGET_BBOX ?? DEFAULT_BBOX;
  const zoom = positiveInteger(options.zoom ?? process.env.OBSERVATION_IMAGE_TARGET_ZOOM, DEFAULT_ZOOM);
  const limit = positiveInteger(options.limit ?? process.env.OBSERVATION_IMAGE_TARGET_LIMIT, DEFAULT_LIMIT);
  const count = positiveInteger(options.count ?? process.env.OBSERVATION_IMAGE_TARGET_COUNT, DEFAULT_TARGET_COUNT);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const sourceUrl = mapApiUrl(baseUrl, bbox, zoom, limit);

  const response = await fetchImpl(sourceUrl, { headers: { accept: "application/json", "cache-control": "no-store" } });
  if (!response.ok) {
    throw new Error(`Failed to fetch public map observations: ${response.status} ${sourceUrl}`);
  }
  const payload = await response.json() as { items?: unknown };
  const items = Array.isArray(payload.items) ? payload.items as PublicMapObservationItem[] : [];
  const seenCandidates = new Set<string>();
  const candidates: ObservationImageTarget[] = [];
  for (const item of items) {
    const candidate = observationImageTargetFromMapItem(item);
    if (!candidate || seenCandidates.has(candidate.occurrenceId)) continue;
    candidates.push(candidate);
    seenCandidates.add(candidate.occurrenceId);
  }

  if (candidates.length === 0) {
    throw new Error(`Public map API returned no photo candidates: ${sourceUrl}`);
  }

  const recordCandidates = candidates.filter((candidate) => candidate.source === "record-path");
  const occurrenceCandidates = candidates.filter((candidate) => candidate.source === "occurrence-path");
  const selected: ObservationImageTarget[] = [];
  const seenSelected = new Set<string>();
  const recordTargetCount = count >= 4 ? Math.min(3, count - 1) : count;

  await appendValidatedTargets(selected, recordCandidates, recordTargetCount, baseUrl, fetchImpl, seenSelected);
  if (count >= 4) {
    await appendValidatedTargets(selected, occurrenceCandidates, selected.length + 1, baseUrl, fetchImpl, seenSelected);
  }
  await appendValidatedTargets(selected, candidates, count, baseUrl, fetchImpl, seenSelected);

  if (selected.length < count) {
    throw new Error(
      `Only resolved ${selected.length}/${count} photo-only observation detail targets from ${candidates.length} photo candidates.`,
    );
  }

  return {
    sourceUrl,
    totalMapItems: items.length,
    photoCandidates: candidates.length,
    targets: selected,
  };
}

export function targetPathsJson(targets: ObservationImageTarget[]): string {
  return JSON.stringify(targets.map((target) => target.path));
}

function parseCliOptions(argv: string[]): ResolveObservationImageTargetsOptions {
  const options: ResolveObservationImageTargetsOptions = {};
  for (const arg of argv) {
    if (arg.startsWith("--base-url=")) options.baseUrl = arg.slice("--base-url=".length);
    else if (arg.startsWith("--bbox=")) options.bbox = arg.slice("--bbox=".length);
    else if (arg.startsWith("--zoom=")) options.zoom = positiveInteger(arg.slice("--zoom=".length), DEFAULT_ZOOM);
    else if (arg.startsWith("--limit=")) options.limit = positiveInteger(arg.slice("--limit=".length), DEFAULT_LIMIT);
    else if (arg.startsWith("--count=")) options.count = positiveInteger(arg.slice("--count=".length), DEFAULT_TARGET_COUNT);
  }
  return options;
}

async function main(): Promise<void> {
  const result = await resolveObservationImageTargets(parseCliOptions(process.argv.slice(2)));
  console.error(`Resolved ${result.targets.length} observation image targets from ${result.photoCandidates}/${result.totalMapItems} public map records.`);
  for (const target of result.targets) {
    console.error(`- ${target.visitId} ${target.source} ${target.path}`);
  }
  process.stdout.write(`${targetPathsJson(result.targets)}\n`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
