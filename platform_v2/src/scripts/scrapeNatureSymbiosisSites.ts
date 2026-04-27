/**
 * 環境省「自然共生サイト」認定地データを公式 JSON API から取得し、
 * Nominatim でジオコーディングして observation_fields に upsert する。
 *
 * データ源: https://policies.env.go.jp/nature/biodiversity/30by30alliance/kyousei/json/{year}/{region}.json
 *
 * 使い方:
 *   npm run scrape:nature-symbiosis                          # 全件取得・geocode・DB upsert
 *   npm run scrape:nature-symbiosis -- --dry-run             # DB 書き込みなし
 *   npm run scrape:nature-symbiosis -- --no-geocode          # Nominatim をスキップ（座標なしで upsert）
 *   npm run scrape:nature-symbiosis -- --seed=<path.json>    # 既存 JSON から再インポート
 *   npm run scrape:nature-symbiosis -- --out=<path.json>     # 結果 JSON 出力先
 *   npm run scrape:nature-symbiosis -- --resume-from=<n>     # n 番目からジオコーディング再開
 *   npm run scrape:nature-symbiosis -- --limit=<n>           # デバッグ用: n 件だけ処理
 */

import https from "node:https";
import http from "node:http";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { upsertCertifiedField } from "../services/observationFieldRegistry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const BASE_URL = "https://policies.env.go.jp/nature/biodiversity/30by30alliance/kyousei/json";
const YEARS = ["2023first", "2023second", "2024first", "2024second", "2025first", "2025second", "2025third"] as const;
const REGIONS = ["Hokkaido", "Tohoku", "Kanto", "Chubu", "Kinki", "Chugoku", "Shikoku", "Kyushu", "Okinawa"] as const;

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface MoeSiteRaw {
  id: number;
  area: string;
  division: string;
  title: string;
  details: Record<string, string>;
  image?: string;
  pdfLink?: string;
  pdfVolume?: string;
}

interface ProcessedSite {
  certification_id: string;
  name: string;
  operator: string;
  prefecture: string;
  city: string;
  area_ha: number | null;
  lat: number | null;
  lng: number | null;
  geocode_query: string | null;
  geocode_ok: boolean;
  year_batch: string;
  region_batch: string;
}

// --------------------------------------------------------------------------
// HTTP (no extra deps)
// --------------------------------------------------------------------------

function fetchJson<T>(url: string): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const fn = url.startsWith("https:") ? https : http;
    const req = fn.get(url, (res) => {
      if (res.statusCode === 404) { res.resume(); resolve(null); return; }
      if (!res.statusCode || res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const buf: Buffer[] = [];
      res.on("data", (c: Buffer) => buf.push(c));
      res.on("end", () => {
        try { resolve(JSON.parse(Buffer.concat(buf).toString("utf-8")) as T); }
        catch (e) { reject(e); }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

// --------------------------------------------------------------------------
// Parse 【場所・面積】 → { city, area_ha }
// --------------------------------------------------------------------------

function parsePlaceArea(raw: string): { city: string; area_ha: number | null } {
  if (!raw) return { city: "", area_ha: null };
  // 例: "札幌市手稲区、1,230ha"  "苫小牧市、64ha"  "根室市、203.6ha"  "寿都郡黒松内町、51ha"
  const sep = raw.includes("、") ? "、" : raw.includes(",") ? "," : null;
  if (!sep) return { city: raw.trim(), area_ha: null };
  const parts = raw.split(sep);
  const cityRaw = (parts[0] ?? "").trim();
  // 面積: 最後の数値部分を取る（複数の市区町村が並んでいる場合もある）
  const areaStr = (parts[parts.length - 1] ?? "").replace(/ha$/i, "").replace(/[,，]/g, "").trim();
  const area_ha = areaStr ? Number(areaStr) || null : null;
  // city: カンマ区切りで複数市区町村がある場合は最初の1つに絞る
  const city = cityRaw.split("・")[0]!.split("／")[0]!.split("/")[0]!.trim();
  return { city, area_ha: area_ha && Number.isFinite(area_ha) ? area_ha : null };
}

// --------------------------------------------------------------------------
// Nominatim geocoder (1 req/s rate limit)
// --------------------------------------------------------------------------

const GEOCODE_UA = "ikimon.life field-importer/1.0 (https://ikimon.life; yamaki0102@gmail.com)";

async function geocode(name: string, prefecture: string, city: string): Promise<{ lat: number; lng: number } | null> {
  const queries = [
    [name, city, prefecture, "日本"].filter(Boolean).join(" "),
    [city, prefecture, "日本"].filter(Boolean).join(" "),
    [name, prefecture, "日本"].filter(Boolean).join(" "),
  ];
  for (const q of queries) {
    if (!q.trim()) continue;
    await sleep(1100);
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=ja&countrycodes=jp`;
    try {
      const data = await fetchJson<Array<{ lat: string; lon: string }>>(url);
      if (data && data.length > 0 && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    } catch (err) {
      console.warn(`[geocode] "${q}" error: ${(err as Error).message}`);
    }
  }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// --------------------------------------------------------------------------
// Collect all sites from JSON API
// --------------------------------------------------------------------------

async function collectAllSites(): Promise<ProcessedSite[]> {
  const seenCertIds = new Set<string>();
  const sites: ProcessedSite[] = [];

  for (const year of YEARS) {
    for (const region of REGIONS) {
      const url = `${BASE_URL}/${year}/${region}.json`;
      let raw: MoeSiteRaw[] | null = null;
      try {
        raw = await fetchJson<MoeSiteRaw[]>(url);
        await sleep(200);
      } catch (err) {
        console.warn(`[fetch] ${year}/${region}: ${(err as Error).message}`);
        continue;
      }
      if (!raw || raw.length === 0) continue;

      console.log(`[fetch] ${year}/${region}: ${raw.length} sites`);

      for (const item of raw) {
        // 認定 ID: pdfLink のベース名（拡張子なし）を使う — グローバルに一意
        const pdfBase = item.pdfLink ? item.pdfLink.replace(/\.pdf$/i, "").replace(/\s+/g, "_") : null;
        const certId = pdfBase ?? `ns-${year}-${region}-${item.id}`;

        if (seenCertIds.has(certId)) continue; // 同一サイトが複数バッチに出る場合はスキップ
        seenCertIds.add(certId);

        const placeRaw = item.details["【場所・面積】"] ?? item.details["場所・面積"] ?? "";
        const { city, area_ha } = parsePlaceArea(placeRaw);
        const operator = (item.details["【申請者】"] ?? item.details["申請者"] ?? "").trim();

        sites.push({
          certification_id: certId,
          name: item.title.trim(),
          operator,
          prefecture: item.division.trim(),
          city,
          area_ha,
          lat: null,
          lng: null,
          geocode_query: null,
          geocode_ok: false,
          year_batch: year,
          region_batch: region,
        });
      }
    }
  }

  console.log(`[collect] ${sites.length} unique sites across all batches`);
  return sites;
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

function parseArgs(): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (const a of process.argv.slice(2)) {
    if (a.startsWith("--")) {
      const [k, ...rest] = a.slice(2).split("=");
      result[k!] = rest.length > 0 ? rest.join("=") : true;
    }
  }
  return result;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const dryRun = Boolean(args["dry-run"]);
  const noGeocode = Boolean(args["no-geocode"]);
  const seedPath = typeof args["seed"] === "string" ? resolve(process.cwd(), args["seed"]) : null;
  const outPath = typeof args["out"] === "string"
    ? resolve(process.cwd(), args["out"])
    : resolve(__dirname, "data", "nature_symbiosis_scraped.json");
  const resumeFrom = typeof args["resume-from"] === "string" ? parseInt(args["resume-from"], 10) : 0;
  const limit = typeof args["limit"] === "string" ? parseInt(args["limit"], 10) : Infinity;

  // ── A. Load seed or fetch from API ───────────────────────────────────────
  let sites: ProcessedSite[];

  if (seedPath) {
    const raw = readFileSync(seedPath, "utf-8");
    sites = JSON.parse(raw) as ProcessedSite[];
    console.log(`[seed] loaded ${sites.length} sites from ${seedPath}`);
  } else {
    sites = await collectAllSites();
  }

  if (sites.length === 0) {
    console.error("[error] No sites collected.");
    process.exit(1);
  }

  // ── B. Geocode ────────────────────────────────────────────────────────────
  if (!noGeocode) {
    const toGeocode = sites.filter((s) => !s.geocode_ok || s.lat === null);
    if (toGeocode.length > 0) {
      const actualLimit = Math.min(sites.length, resumeFrom + limit);
      console.log(`[geocode] ${toGeocode.length} sites need geocoding (1 req/s)`);
      console.log(`[geocode] estimated: ~${Math.ceil(toGeocode.length * 1.1 / 60)} min`);

      let done = 0;
      for (let i = resumeFrom; i < actualLimit; i++) {
        const site = sites[i]!;
        if (site.geocode_ok && site.lat !== null) { done++; continue; }
        const coords = await geocode(site.name, site.prefecture, site.city);
        if (coords) {
          site.lat = coords.lat;
          site.lng = coords.lng;
          site.geocode_ok = true;
          site.geocode_query = [site.name, site.city, site.prefecture].filter(Boolean).join(" ");
        } else {
          console.warn(`[geocode] MISS: ${site.name} (${site.prefecture} ${site.city})`);
        }
        done++;
        if (done % 20 === 0) {
          const hits = sites.filter((s) => s.geocode_ok).length;
          console.log(`[geocode] ${done} processed, ${hits} geocoded`);
          writeFileSync(outPath, JSON.stringify(sites, null, 2)); // checkpoint
        }
      }
    }
  }

  // Save final JSON
  writeFileSync(outPath, JSON.stringify(sites, null, 2));
  const geocoded = sites.filter((s) => s.geocode_ok && s.lat !== null);
  const missed = sites.filter((s) => !s.geocode_ok || s.lat === null);
  console.log(`\n[result] total=${sites.length} geocoded=${geocoded.length} missed=${missed.length}`);
  if (missed.length > 0 && missed.length <= 30) {
    console.log("[result] missed:");
    for (const m of missed) console.log(`  - ${m.certification_id}: ${m.name} (${m.prefecture} ${m.city})`);
  }
  console.log(`[result] saved to: ${outPath}`);

  if (dryRun) {
    console.log("[dry-run] skipping DB upsert");
    return;
  }

  // ── C. Upsert to DB ───────────────────────────────────────────────────────
  console.log(`\n[db] upserting ${geocoded.length} sites...`);
  let inserted = 0, skipped = 0;
  for (const site of geocoded) {
    const radiusM = site.area_ha
      ? Math.max(200, Math.min(30_000, Math.round(Math.sqrt(site.area_ha * 10_000 / Math.PI))))
      : 500;
    try {
      await upsertCertifiedField({
        source: "nature_symbiosis_site",
        name: site.name,
        nameKana: "",
        summary: site.operator ? `申請者: ${site.operator}` : "",
        prefecture: site.prefecture,
        city: site.city,
        lat: site.lat!,
        lng: site.lng!,
        radiusM,
        polygon: null,
        areaHa: site.area_ha,
        certificationId: site.certification_id,
        officialUrl: "https://policies.env.go.jp/nature/biodiversity/30by30alliance/kyousei/nintei/index.html",
        ownerUserId: null,
        payload: {
          operator: site.operator,
          year_batch: site.year_batch,
          region_batch: site.region_batch,
          geocode_query: site.geocode_query,
          imported_at: new Date().toISOString(),
        },
      });
      inserted++;
    } catch (err) {
      console.error(`[db] ${site.certification_id}: ${(err as Error).message}`);
      skipped++;
    }
    if ((inserted + skipped) % 50 === 0 && (inserted + skipped) > 0) {
      console.log(`[db] ${inserted + skipped}/${geocoded.length}`);
    }
  }
  console.log(`[db] done: inserted=${inserted} skipped=${skipped}`);
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[fatal]", err);
    process.exit(1);
  });
