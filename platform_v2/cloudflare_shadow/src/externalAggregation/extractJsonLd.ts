import type { ExtractedFact } from "./types";
import { clean, normalizeDateValue, resolveUrl, sha256Hex } from "./util";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

function isEventType(t: unknown): boolean {
  const types = Array.isArray(t) ? t : [t];
  return types.some(x => typeof x === "string" && /(^|[/#])[A-Za-z]*Event$/.test(x));
}

function nameOf(v: unknown): string | null {
  if (typeof v === "string") return clean(v);
  if (Array.isArray(v)) return v.map(nameOf).find(x => x !== null) ?? null;
  if (isObj(v)) return clean(v.name);
  return null;
}

function addressOf(v: unknown): string | null {
  if (typeof v === "string") return clean(v);
  if (Array.isArray(v)) return v.map(addressOf).find(x => x !== null) ?? null;
  if (isObj(v)) {
    const parts = [v.addressRegion, v.addressLocality, v.streetAddress].filter(p => typeof p === "string") as string[];
    return clean(parts.join(""));
  }
  return null;
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function collect(node: unknown, out: Obj[]): void {
  if (Array.isArray(node)) { for (const x of node) collect(x, out); return; }
  if (!isObj(node)) return;
  if (isEventType(node["@type"])) out.push(node);
  for (const value of Object.values(node)) if (typeof value === "object" && value !== null) collect(value, out);
}

export async function extractJsonLd(html: string, sourceId: string, baseUrl: string, fetchedAt: string): Promise<ExtractedFact[]> {
  const events: Obj[] = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    try { collect(JSON.parse(m[1]!.trim()), events); } catch { continue; }
  }
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();
  for (const e of events) {
    const title = clean(e.name);
    const start = normalizeDateValue(e.startDate);
    if (title === null || start === null) continue;
    const end = normalizeDateValue(e.endDate);
    const url = resolveUrl(e.url, baseUrl) ?? resolveUrl(e["@id"], baseUrl) ?? baseUrl;
    const location = Array.isArray(e.location) ? e.location[0] : e.location;
    const loc = isObj(location) ? location : null;
    const geo = loc && isObj(loc.geo) ? loc.geo : null;
    const externalRef = (typeof e["@id"] === "string" && clean(e["@id"], 500)) || (url !== baseUrl ? url : `h:${(await sha256Hex(`${title}|${start.value}`)).slice(0, 24)}`);
    if (seen.has(externalRef)) continue;
    seen.add(externalRef);
    facts.push({
      kind: "event", source_id: sourceId, external_ref: externalRef, url, title,
      starts_at: start.value, ends_at: end?.value ?? null, all_day: start.allDay,
      venue_name: loc ? clean(loc.name) : typeof location === "string" ? clean(location) : null,
      venue_address: loc ? addressOf(loc.address) : null,
      lat: geo ? num(geo.latitude) : null, lng: geo ? num(geo.longitude) : null,
      organizer_name: nameOf(e.organizer), fetched_at: fetchedAt,
    });
  }
  return facts;
}
