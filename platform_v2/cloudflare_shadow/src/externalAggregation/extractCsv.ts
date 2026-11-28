import type { ExtractedFact } from "./types";
import { clean, normalizeDateValue, resolveUrl, sha256Hex } from "./util";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i]!;
    if (quoted) {
      if (c === '"') { if (src[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some(x => x !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some(x => x !== "")) rows.push(row);
  return rows;
}

const COLS = {
  id: ["id", "external_id", "識別番号", "イベントid", "no", "管理番号"],
  title: ["title", "name", "題名", "イベント名", "行事名", "名称", "件名", "催事名"],
  start: ["start", "starts_at", "start_date", "開始日", "開始日時", "開催日", "開催日時", "日付", "実施日"],
  startTime: ["start_time", "開始時間", "開始時刻", "開催時間"],
  end: ["end", "ends_at", "end_date", "終了日", "終了日時"],
  endTime: ["end_time", "終了時間", "終了時刻"],
  venue: ["venue", "venue_name", "場所", "会場", "会場名", "開催場所", "場所名称"],
  address: ["address", "venue_address", "住所", "所在地", "会場住所"],
  lat: ["lat", "latitude", "緯度"],
  lng: ["lng", "lon", "longitude", "経度"],
  organizer: ["organizer", "organizer_name", "主催", "主催者", "主催団体"],
  url: ["url", "link", "リンク", "詳細url", "url(詳細)", "ホームページ"],
};
type Col = keyof typeof COLS;

function indexOf(header: string[], names: string[]): number {
  const norm = header.map(h => h.trim().toLowerCase());
  for (const n of names) { const i = norm.indexOf(n); if (i >= 0) return i; }
  return -1;
}

const isTime = (s: string) => /^\d{1,2}:\d{2}$/.test(s);
const withTime = (date: string, time: string) => (isTime(time) && !/[T:]/.test(date) ? `${date} ${time}` : date);

export async function extractCsv(text: string, sourceId: string, baseUrl: string, fetchedAt: string): Promise<ExtractedFact[]> {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const header = rows[0]!;
  const col = Object.fromEntries(Object.entries(COLS).map(([k, v]) => [k, indexOf(header, v)])) as Record<Col, number>;
  if (col.title < 0 || col.start < 0) return [];
  const get = (r: string[], k: Col) => (col[k] >= 0 ? (r[col[k]] ?? "").trim() : "");
  const facts: ExtractedFact[] = [];
  const seen = new Set<string>();
  for (const r of rows.slice(1)) {
    const title = clean(get(r, "title"));
    const start = normalizeDateValue(withTime(get(r, "start"), get(r, "startTime")));
    if (title === null || start === null) continue;
    const endRaw = get(r, "end");
    const end = endRaw === "" ? null : normalizeDateValue(withTime(endRaw, get(r, "endTime")));
    const url = resolveUrl(get(r, "url"), baseUrl) ?? baseUrl;
    const id = clean(get(r, "id"), 200);
    const externalRef = id ?? (url !== baseUrl ? url : `h:${(await sha256Hex(`${title}|${start.value}`)).slice(0, 24)}`);
    if (seen.has(externalRef)) continue;
    seen.add(externalRef);
    const lat = Number(get(r, "lat"));
    const lng = Number(get(r, "lng"));
    const hasGeo = get(r, "lat") !== "" && get(r, "lng") !== "" && Number.isFinite(lat) && Number.isFinite(lng);
    facts.push({
      kind: "event", source_id: sourceId, external_ref: externalRef, url, title,
      starts_at: start.value, ends_at: end?.value ?? null, all_day: start.allDay,
      venue_name: clean(get(r, "venue")), venue_address: clean(get(r, "address")),
      lat: hasGeo ? lat : null, lng: hasGeo ? lng : null,
      organizer_name: clean(get(r, "organizer")), fetched_at: fetchedAt,
    });
  }
  return facts;
}
