import type { ExtractedFact } from "./types";
import { clean, normalizeDateValue, resolveUrl } from "./util";

export const HAMAMATSU_ODPF_URL = "https://prd-hmpf-s3-odpf-01.s3.ap-northeast-1.amazonaws.com/opendata/v01/221309_hamamatsu_event/221309_hamamatsu_event.json";
const EXCLUDED_CATEGORIES = new Set(["そうだん", "おしらせ", "職員募集"]);

const cell = (r: unknown[], i: number): string => (i >= 0 && r[i] !== null && r[i] !== undefined ? String(r[i]).trim() : "");
const stripWeekday = (s: string) => s.replace(/[(（][^)）]*[)）]\s*$/, "").trim();
const jstToday = (iso: string): string => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10);

export async function extractHamamatsuOdpf(body: string, sourceId: string, fetchedAt: string): Promise<ExtractedFact[]> {
  let rows: unknown;
  try { rows = JSON.parse(body.replace(/^﻿/, "")); } catch { return []; }
  if (!Array.isArray(rows) || rows.length < 2 || !Array.isArray(rows[0])) return [];
  const header = (rows[0] as unknown[]).map(h => String(h ?? "").replace(/^﻿/, "").trim());
  const ix = (name: string) => header.indexOf(name);
  const c = {
    no: ix("NO"), title: ix("イベント名"), start: ix("開始日"), end: ix("終了日"), st: ix("開始時間"), et: ix("終了時間"),
    venue: ix("場所名称"), addr: ix("住所"), lat: ix("緯度"), lng: ix("経度"), org: ix("主催者"), cat: ix("カテゴリー"), url: ix("URL"),
  };
  if (c.no < 0 || c.title < 0 || c.start < 0) return [];
  const today = jstToday(fetchedAt);
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();
  for (const r of rows.slice(1)) {
    if (!Array.isArray(r)) continue;
    const category = cell(r, c.cat);
    if (EXCLUDED_CATEGORIES.has(category)) continue;
    const title = clean(cell(r, c.title));
    const ref = clean(cell(r, c.no), 200);
    const startDate = stripWeekday(cell(r, c.start));
    const startTime = cell(r, c.st);
    if (title === null || ref === null || seen.has(ref) || normalizeDateValue(startDate) === null) continue;
    const start = normalizeDateValue(startTime ? `${startDate} ${startTime}` : startDate) ?? normalizeDateValue(startDate)!;
    const endDate = stripWeekday(cell(r, c.end));
    const endDay = endDate === "" ? null : normalizeDateValue(endDate);
    const endTime = cell(r, c.et);
    const end = endDay === null ? null : (endTime ? normalizeDateValue(`${endDate} ${endTime}`) : null) ?? endDay;
    if ((endDay?.value ?? normalizeDateValue(startDate)!.value) < today) continue;
    seen.add(ref);
    const latRaw = cell(r, c.lat);
    const lngRaw = cell(r, c.lng);
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    const geo = latRaw !== "" && lngRaw !== "" && Number.isFinite(lat) && Number.isFinite(lng);
    facts.push({
      kind: "event", source_id: sourceId, external_ref: ref, url: resolveUrl(cell(r, c.url), HAMAMATSU_ODPF_URL) ?? HAMAMATSU_ODPF_URL,
      title, starts_at: start.value, ends_at: end?.value ?? null, all_day: start.allDay,
      venue_name: clean(cell(r, c.venue)), venue_address: clean(cell(r, c.addr)),
      lat: geo ? lat : null, lng: geo ? lng : null, organizer_name: clean(cell(r, c.org)), category: category || null, fetched_at: fetchedAt,
    });
  }
  return facts;
}
