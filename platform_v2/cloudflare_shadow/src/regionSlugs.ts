import { REGION_SLUG_ENTRIES, type RegionSlugEntry, type RegionSlugLevel } from "./regionSlugs.data";

export type RegionSlugResolution =
  | { kind: "current"; label: string; code: string; level: RegionSlugLevel; path: string }
  | { kind: "redirect"; to: string }
  | null;

export const RESERVED_REGION_SLUGS: readonly string[] = ["events", "species", "invasive", "places", "calendar"];

const pathOf =(e: RegionSlugEntry): string =>
  e.level === "country" ? e.slug : e.parent_slug === "jp" ? `jp/${e.slug}` : `jp/${e.parent_slug}/${e.slug}`;

const isActive = (e: RegionSlugEntry, today: string): boolean => e.valid_from <= today && (e.valid_to === null || today <= e.valid_to);

const byPath = new Map<string, RegionSlugEntry[]>();
for (const e of REGION_SLUG_ENTRIES) {
  const p = pathOf(e);
  byPath.set(p, [...(byPath.get(p) ?? []), e]);
}

const nameByPath = new Map<string, string>();
for (const [p, list] of byPath) nameByPath.set(p, list[list.length - 1]!.name_ja);

const labelOf = (e: RegionSlugEntry): string => {
  if (e.level !== "ward") return e.name_ja;
  const parentPath = pathOf(e).split("/").slice(0, -1).join("/");
  return `${nameByPath.get(parentPath) ?? ""}${e.name_ja}`;
};

const todayIso = (): string => new Date().toISOString().slice(0, 10);

const currentLabelIndex = new Map<string, { path: string; entry: RegionSlugEntry }>();
const currentCodeIndex = new Map<string, string>();
for (const e of REGION_SLUG_ENTRIES) {
  if (e.valid_to !== null) continue;
  currentLabelIndex.set(labelOf(e), { path: pathOf(e), entry: e });
  currentCodeIndex.set(e.code, pathOf(e));
}

export function resolveRegionSlugPath(segments: string[], today: string = todayIso()): RegionSlugResolution {
  if (segments.length === 0 || segments.length > 4 || segments[0] !== "jp") return null;
  if (segments.some((s, i) => i > 0 && RESERVED_REGION_SLUGS.includes(s))) return null;
  const path = segments.join("/");
  const list = byPath.get(path);
  if (!list) return null;
  const active = list.find((e) => isActive(e, today));
  if (active) return { kind: "current", label: labelOf(active), code: active.code, level: active.level, path };
  const retired = list.find((e) => e.valid_to !== null && e.valid_to < today);
  if (!retired) return null;
  const successors = retired.successors ?? [];
  if (successors.length === 1) return { kind: "redirect", to: `/regions/jp/${successors[0]}` };
  return { kind: "redirect", to: `/regions/${segments.slice(0, -1).join("/")}` };
}

export function labelToSlugPath(label: string): string | null {
  return currentLabelIndex.get(label)?.path ?? null;
}

export function regionPath(lang: string, labelOrCode: string, suffix: "" | "/species" | "/invasive" | "/events" | "/places" = ""): string {
  const prefix = `/${lang}`;
  const slugPath = labelToSlugPath(labelOrCode) ?? currentCodeIndex.get(labelOrCode) ?? null;
  return slugPath ? `${prefix}/regions/${slugPath}${suffix}` : `${prefix}/regions/${encodeURIComponent(labelOrCode)}${suffix}`;
}

export function regionPathNoLang(label: string, suffix: "" | "/species" | "/invasive" | "/events" | "/places" = ""): string {
  const slugPath = labelToSlugPath(label);
  return slugPath ? `/regions/${slugPath}${suffix}` : `/regions/${encodeURIComponent(label)}${suffix}`;
}
