/**
 * 環境省「生物多様性地域連携促進法」自然共生サイト認定地リストをスクレイピングし、
 * Nominatim でジオコーディングして observation_fields に upsert する。
 *
 * 使い方:
 *   npx tsx src/scripts/scrapeNatureSymbiosisSites.ts [options]
 *
 * Options:
 *   --dry-run          DB に書き込まず結果を JSON で表示
 *   --geocode-only     既存 seed JSON を再ジオコーディングして DB upsert
 *   --seed=<path>      既存 seed JSON ファイルを読んで DB upsert（スクレイピングをスキップ）
 *   --resume-from=<n>  n 番目から再開（ジオコーディングが途中で止まった場合）
 *   --out=<path>       結果を JSON ファイルに書き出す（デフォルト: data/nature_symbiosis_scraped.json）
 *   --limit=<n>        デバッグ用: n件だけ処理
 */

import https from "node:https";
import http from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { upsertCertifiedField } from "../services/observationFieldRegistry.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --------------------------------------------------------------------------
// Types
// --------------------------------------------------------------------------

interface ScrapedSite {
  certification_id: string;
  name: string;
  operator: string;
  prefecture: string;
  city: string;
  area_ha: number | null;
  certified_at: string | null;
  lat: number | null;
  lng: number | null;
  geocode_query: string | null;
  geocode_ok: boolean;
  official_url: string;
}

// --------------------------------------------------------------------------
// HTTP Utility (no extra deps)
// --------------------------------------------------------------------------

function fetchUrl(url: string, headers: Record<string, string> = {}, maxRedirects = 5): Promise<string> {
  return new Promise((resolve, reject) => {
    const tryFetch = (u: string, redirectsLeft: number) => {
      const protocol = u.startsWith("https:") ? https : http;
      const req = protocol.get(u, { headers }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft <= 0) { reject(new Error("Too many redirects")); return; }
          const next = res.headers.location.startsWith("http")
            ? res.headers.location
            : new URL(res.headers.location, u).toString();
          res.resume();
          tryFetch(next, redirectsLeft - 1);
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf-8");
          resolve(body);
        });
        res.on("error", reject);
      });
      req.on("error", reject);
    };
    tryFetch(url, maxRedirects);
  });
}

// --------------------------------------------------------------------------
// HTML Table Parser (minimal, no cheerio)
// --------------------------------------------------------------------------

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, "").trim();
}

function extractTableRows(html: string): string[][] {
  const rows: string[][] = [];
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRegex.exec(html)) !== null) {
    const rowHtml = trMatch[1]!;
    const cells: string[] = [];
    const tdRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let tdMatch: RegExpExecArray | null;
    while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
      cells.push(stripTags(tdMatch[1]!).replace(/\s+/g, " ").trim());
    }
    if (cells.length > 0) rows.push(cells);
  }
  return rows;
}

// Try to detect header row and map columns
function detectColumnMap(rows: string[][]): Map<string, number> | null {
  const HEADER_KEYWORDS: Record<string, string[]> = {
    certification_id: ["認定番号", "番号", "No", "No."],
    name: ["名称", "サイト名", "地区名"],
    operator: ["申請主体", "申請者", "管理者", "主体"],
    prefecture: ["都道府県"],
    city: ["市区町村", "市町村", "市区"],
    area_ha: ["面積", "認定面積"],
    certified_at: ["認定日", "認定年月日", "認定年度"],
  };

  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i]!;
    const map = new Map<string, number>();
    for (const [key, keywords] of Object.entries(HEADER_KEYWORDS)) {
      for (let j = 0; j < row.length; j++) {
        if (keywords.some((kw) => row[j]!.includes(kw))) {
          map.set(key, j);
          break;
        }
      }
    }
    if (map.has("name") && map.has("prefecture")) return map;
  }
  return null;
}

// --------------------------------------------------------------------------
// Parse the MOE certification list page
// --------------------------------------------------------------------------

const MOE_CANDIDATE_URLS = [
  "https://policies.env.go.jp/nature/biodiversity/30by30alliance/certified_sites/list/",
  "https://policies.env.go.jp/nature/biodiversity/30by30alliance/certified_sites/",
  "https://policies.env.go.jp/nature/biodiversity/30by30alliance/certified-area/list/",
  "https://www.biodic.go.jp/biodiversity/activity/policy/30x30/list/",
];

async function fetchMoePage(): Promise<string | null> {
  const ua = "Mozilla/5.0 (compatible; ikimon-field-importer/1.0; +https://ikimon.life)";
  for (const url of MOE_CANDIDATE_URLS) {
    try {
      console.log(`[scrape] trying ${url}`);
      const html = await fetchUrl(url, {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "ja,en;q=0.5",
      });
      // Check if we got meaningful content
      if (html.includes("認定") || html.includes("自然共生")) {
        console.log(`[scrape] success: ${url} (${html.length} chars)`);
        return html;
      }
    } catch (err) {
      console.warn(`[scrape] ${url} failed: ${(err as Error).message}`);
    }
    await sleep(500);
  }
  return null;
}

// Some pages paginate — try to collect all page URLs
function extractPaginationUrls(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  const linkRegex = /href=["']([^"']*(?:page|p=|offset=)[^"']*)['"]/gi;
  let m: RegExpExecArray | null;
  while ((m = linkRegex.exec(html)) !== null) {
    try {
      const full = new URL(m[1]!, baseUrl).toString();
      if (!urls.includes(full)) urls.push(full);
    } catch { /* ignore invalid */ }
  }
  return urls;
}

function parseSitesFromHtml(html: string): ScrapedSite[] {
  const rows = extractTableRows(html);
  if (rows.length === 0) {
    console.warn("[parse] no table rows found");
    return [];
  }
  const colMap = detectColumnMap(rows);
  if (!colMap) {
    console.warn("[parse] could not detect column map from headers");
    // Fallback: try row 0 as header regardless
    return [];
  }

  const headerRowIdx = rows.findIndex((r) =>
    r.some((c) => c.includes("名称") || c.includes("認定")),
  );
  const dataRows = rows.slice(headerRowIdx + 1);
  const sites: ScrapedSite[] = [];

  for (const row of dataRows) {
    const get = (key: string): string => {
      const idx = colMap.get(key);
      return idx !== undefined && idx < row.length ? (row[idx] ?? "").trim() : "";
    };
    const name = get("name");
    if (!name || name === "") continue;

    const certId = get("certification_id") || `ns-scraped-${sites.length + 1}`;
    const areaRaw = get("area_ha").replace(/[,，,]/g, "").replace(/ha/i, "").trim();
    const areaHa = areaRaw ? Number(areaRaw) || null : null;
    const certifiedAt = get("certified_at") || null;
    const prefecture = get("prefecture");
    const city = get("city");

    sites.push({
      certification_id: certId.replace(/\s+/g, ""),
      name,
      operator: get("operator"),
      prefecture,
      city,
      area_ha: areaHa,
      certified_at: certifiedAt,
      lat: null,
      lng: null,
      geocode_query: null,
      geocode_ok: false,
      official_url: "",
    });
  }
  return sites;
}

// --------------------------------------------------------------------------
// Nominatim Geocoder (rate-limited 1 req/s)
// --------------------------------------------------------------------------

const GEOCODE_UA = "ikimon.life field-importer/1.0 (https://ikimon.life; yamaki0102@gmail.com)";

async function geocode(site: ScrapedSite): Promise<{ lat: number; lng: number } | null> {
  // Build progressively broader queries; stop at first hit
  const queries = [
    [site.name, site.city, site.prefecture, "日本"].filter(Boolean).join(" "),
    [site.name, site.prefecture, "日本"].filter(Boolean).join(" "),
    [site.city, site.prefecture, "日本"].filter(Boolean).join(" "),
  ];

  for (const q of queries) {
    if (!q.trim()) continue;
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&accept-language=ja&countrycodes=jp`;
    await sleep(1100); // strictly ≥ 1s between requests (OSM ToS)
    try {
      const body = await fetchUrl(url, { "User-Agent": GEOCODE_UA });
      const data = JSON.parse(body) as Array<{ lat: string; lon: string; display_name: string }>;
      if (data.length > 0 && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
      }
    } catch (err) {
      console.warn(`[geocode] error for "${q}": ${(err as Error).message}`);
    }
  }
  return null;
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(): Record<string, string | boolean> {
  const args = process.argv.slice(2);
  const result: Record<string, string | boolean> = {};
  for (const a of args) {
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
  const seedPath = typeof args["seed"] === "string" ? args["seed"] : null;
  const outPath = typeof args["out"] === "string"
    ? resolve(process.cwd(), args["out"])
    : resolve(__dirname, "data", "nature_symbiosis_scraped.json");
  const resumeFrom = typeof args["resume-from"] === "string" ? parseInt(args["resume-from"], 10) : 0;
  const limit = typeof args["limit"] === "string" ? parseInt(args["limit"], 10) : Infinity;

  let sites: ScrapedSite[] = [];

  // ── A. Load from existing seed JSON ──────────────────────────────────────
  if (seedPath) {
    const raw = readFileSync(resolve(process.cwd(), seedPath), "utf-8");
    const parsed = JSON.parse(raw) as ScrapedSite[] | { sites: ScrapedSite[] };
    sites = Array.isArray(parsed) ? parsed : parsed.sites ?? [];
    console.log(`[seed] loaded ${sites.length} sites from ${seedPath}`);
  }

  // ── B. Scrape from MOE if no seed ────────────────────────────────────────
  if (sites.length === 0) {
    const html = await fetchMoePage();
    if (!html) {
      console.error(
        "[scrape] Could not fetch MOE page. Options:\n" +
        "  1. Download the page manually and pass --seed=<path-to-html-extract.json>\n" +
        "  2. Check if the URL has changed at https://policies.env.go.jp/nature/biodiversity/30by30alliance/\n" +
        "  3. Use --seed with the companion seed file: src/scripts/data/nature_symbiosis_sites.seed.json"
      );
      process.exit(1);
    }

    // Try to collect paginated URLs
    const extraPages = extractPaginationUrls(html, MOE_CANDIDATE_URLS[0]!);
    const allHtml = [html];
    for (const url of extraPages) {
      try {
        console.log(`[scrape] fetching page ${url}`);
        allHtml.push(await fetchUrl(url, { "User-Agent": GEOCODE_UA }));
        await sleep(500);
      } catch { /* skip */ }
    }

    const seen = new Set<string>();
    for (const h of allHtml) {
      for (const site of parseSitesFromHtml(h)) {
        if (!seen.has(site.certification_id)) {
          seen.add(site.certification_id);
          sites.push(site);
        }
      }
    }

    if (sites.length === 0) {
      console.error(
        "[parse] Page was fetched but no sites could be extracted.\n" +
        "        The page structure may have changed. Please open the URL in a browser,\n" +
        "        export the table as CSV, and use: importObservationFields.ts --file=<csv> --source=nature_symbiosis_site"
      );
      process.exit(1);
    }
    console.log(`[scrape] extracted ${sites.length} sites from MOE page`);
  }

  // ── C. Geocode missing entries ────────────────────────────────────────────
  const toGeocode = sites.filter((s) => !s.geocode_ok || s.lat === null);
  if (toGeocode.length > 0) {
    console.log(`[geocode] need to geocode ${toGeocode.length} sites (1 req/s)...`);
    console.log(`[geocode] estimated time: ${Math.ceil(toGeocode.length * 1.1 / 60)} min`);
    let done = 0;
    for (let i = resumeFrom; i < Math.min(sites.length, resumeFrom + limit); i++) {
      const site = sites[i]!;
      if (site.geocode_ok && site.lat !== null) { done++; continue; }
      const coords = await geocode(site);
      if (coords) {
        site.lat = coords.lat;
        site.lng = coords.lng;
        site.geocode_ok = true;
        site.geocode_query = [site.name, site.city, site.prefecture].join(" ");
      } else {
        site.geocode_ok = false;
        console.warn(`[geocode] MISS: ${site.name} (${site.prefecture} ${site.city})`);
      }
      done++;
      if (done % 10 === 0) {
        console.log(`[geocode] ${done}/${toGeocode.length} done, ${sites.filter(s => s.geocode_ok).length} hits`);
        // Checkpoint: write intermediate results
        writeFileSync(outPath, JSON.stringify(sites, null, 2));
      }
    }
  }

  // Save final JSON
  writeFileSync(outPath, JSON.stringify(sites, null, 2));
  const hits = sites.filter((s) => s.geocode_ok && s.lat !== null);
  const misses = sites.filter((s) => !s.geocode_ok || s.lat === null);
  console.log(`[result] ${sites.length} total, ${hits.length} geocoded, ${misses.length} missed`);
  if (misses.length > 0) {
    console.log("[result] missed sites (manual coordinates needed):");
    for (const m of misses.slice(0, 20)) {
      console.log(`  - ${m.certification_id}: ${m.name} (${m.prefecture} ${m.city})`);
    }
    if (misses.length > 20) console.log(`  ... and ${misses.length - 20} more`);
  }

  if (dryRun) {
    console.log("[dry-run] skipping DB upsert. Results saved to:", outPath);
    return;
  }

  // ── D. Upsert to DB ───────────────────────────────────────────────────────
  let inserted = 0, skipped = 0;
  for (const site of hits) {
    try {
      await upsertCertifiedField({
        source: "nature_symbiosis_site",
        name: site.name,
        nameKana: "",
        summary: site.operator ? `申請主体: ${site.operator}` : "",
        prefecture: site.prefecture,
        city: site.city,
        lat: site.lat!,
        lng: site.lng!,
        radiusM: site.area_ha ? Math.max(300, Math.min(20000, Math.round(Math.sqrt(site.area_ha * 10000 / Math.PI)))) : 1000,
        polygon: null,
        areaHa: site.area_ha,
        certificationId: site.certification_id,
        officialUrl: site.official_url || "https://policies.env.go.jp/nature/biodiversity/30by30alliance/certified_sites/",
        ownerUserId: null,
        payload: {
          operator: site.operator,
          certified_at: site.certified_at,
          geocode_query: site.geocode_query,
          import_source: "scrapeNatureSymbiosisSites",
          imported_at: new Date().toISOString(),
        },
      });
      inserted++;
    } catch (err) {
      console.error(`[db] failed: ${site.certification_id} ${site.name}:`, err);
      skipped++;
    }
  }
  console.log(`[db] inserted=${inserted} skipped=${skipped}`);
}

void main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[fatal]", err);
    process.exit(1);
  });
