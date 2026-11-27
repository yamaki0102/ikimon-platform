import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  circleRing,
  DEFAULTS,
  geometryGeojson,
  normalizePlaceSearchText,
  polygonsAreaHa,
  polygonsBbox,
  renderRollbackSql,
  sqlNumber,
  sqlText,
} from "./import-places-osm.mjs";

const clean = (value) =>
  typeof value === "string" ? value.replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim() : "";

const round6 = (v) => Math.round(v * 1e6) / 1e6;

const MONUMENT_RE = /(?:史跡|名勝|天然記念物|記念物)/u;

/**
 * Parse RFC-4180 CSV text (handles quoted newlines and commas).
 */
export function parseCsvRows(csvText) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    if (inQuotes) {
      if (ch === '"') {
        if (csvText[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r") {
      if (csvText[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function findMostRecentHeaderBounds(lines, idx) {
  for (let j = idx - 1; j >= 0; j -= 1) {
    const l = lines[j];
    const sIdx = l.indexOf("サイト名");
    const aIdx = l.indexOf("申請者");
    if (sIdx >= 0 && aIdx > sIdx) {
      // Allow up to ~8 chars left slack before "サイト名" because centered header labels sit inside wider data columns
      return { siteStart: Math.max(0, sIdx - 14), appStart: Math.max(sIdx + 4, aIdx - 6) };
    }
  }
  return null;
}

function stripMoeSiteColumnWrap(lines, idx, mode) {
  const line = lines[idx];
  const tailMatch = line.match(/^(.*?)\s{2,}(静岡県)\s{2,}([^\s]+)\s{2,}(.+)$/u);
  if (!tailMatch) return null;

  const leftPart = tailMatch[1];
  const municipality = clean(tailMatch[3]);
  const tailParts = tailMatch[4].trim().split(/\s{2,}/u).map(clean).filter(Boolean);
  const period = tailParts[0] ?? "";
  const fourth = tailParts[1] ?? "";

  const rowMatch = leftPart.match(/^\s*(\d{1,4})\s+/u);
  if (!rowMatch) return null;
  const rowNo = rowMatch[1];

  if (mode === "r5r6") {
    const noEnd = leftPart.indexOf(rowNo) + rowNo.length;
    const cols = leftPart.slice(noEnd).trim().split(/\s{2,}/u).map(clean).filter(Boolean);
    return {
      sourceList: "R5R6",
      rowNo,
      name: cols[0] ?? "",
      municipality,
      period,
      transition: fourth,
    };
  }

  const bounds = findMostRecentHeaderBounds(lines, idx);
  if (bounds) {
    // Use header-aligned window on line, plus wrapped continuation lines above/below
    const isWrapLine = (k) =>
      k >= 0 &&
      k < lines.length &&
      lines[k].trim().length > 0 &&
      !/^\s*\d{1,4}\s+/u.test(lines[k]) &&
      !lines[k].includes("都道府県");

    // Extract contiguous middle text inside bounds while avoiding plan/applicant spill
    const pickSlice = (l) => {
      if (!l) return "";
      const raw = l.slice(bounds.siteStart, bounds.appStart);
      return clean(raw);
    };
    const parts = [];
    if (isWrapLine(idx - 1)) parts.push(pickSlice(lines[idx - 1]));
    parts.push(pickSlice(line));
    if (isWrapLine(idx + 1)) parts.push(pickSlice(lines[idx + 1]));
    const joined = clean(parts.filter(Boolean).join(" "));
    if (joined) {
      return {
        sourceList: mode === "r806_renkei" ? "R806_RENKEI" : "R806_ZOSHIN",
        rowNo,
        name: joined,
        municipality,
        period,
        activityType: fourth,
        transition: "",
      };
    }
  }

  // Fallback for headerless snippets (unit tests)
  const noEnd = leftPart.indexOf(rowNo) + rowNo.length;
  const cols = leftPart.slice(noEnd).trim().split(/\s{2,}/u).map(clean).filter(Boolean);
  const prevLine = idx > 0 && !/^\s*\d{1,4}\s+/u.test(lines[idx - 1]) ? lines[idx - 1] : "";
  const nextLine = idx + 1 < lines.length && !/^\s*\d{1,4}\s+/u.test(lines[idx + 1]) ? lines[idx + 1] : "";
  let siteName = cols.length >= 2 ? cols[1] : (cols[0] ?? "");
  if (cols.length <= 1 && (prevLine || nextLine)) {
    const pCols = prevLine.trim().split(/\s{2,}/u).map(clean).filter(Boolean);
    const nCols = nextLine.trim().split(/\s{2,}/u).map(clean).filter(Boolean);
    const pSite = pCols[1] ?? pCols[0] ?? "";
    const nSite = nCols[1] ?? nCols[0] ?? "";
    siteName = clean(`${pSite}${nSite}`);
  }

  return {
    sourceList: mode === "r806_renkei" ? "R806_RENKEI" : "R806_ZOSHIN",
    rowNo,
    name: clean(siteName),
    municipality,
    period,
    activityType: fourth,
    transition: "",
  };
}

export function normalizeMoeEntries(rawEntries) {
  const byKey = new Map();
  const list = [];
  for (const entry of rawEntries) {
    const cleanName = clean(entry.name);
    const key = normalizePlaceSearchText(cleanName);
    if (!key) continue;
    if (entry.sourceList === "R5R6" && entry.transition) {
      const alreadyTransitioned = list.some(
        (existing) =>
          existing.municipality === entry.municipality &&
          (normalizePlaceSearchText(existing.name).includes(key) ||
            key.includes(normalizePlaceSearchText(existing.name)) ||
            normalizePlaceSearchText(existing.name).slice(0, 6) === key.slice(0, 6))
      );
      if (alreadyTransitioned) continue;
    }
    if (byKey.has(key)) continue;
    byKey.set(key, entry);
    const kindLabel = entry.sourceList === "R5R6" ? "自然共生サイト認定" : "増進活動実施計画認定";
    list.push({
      sourceKind: "moe_30by30",
      sourceId: `moe:${entry.sourceList}:${entry.rowNo}`,
      name: cleanName,
      municipality: clean(entry.municipality),
      category: "nature",
      placeKind: "nature_area",
      factSummary: `環境省 ${kindLabel}（${entry.period || "認定"}${entry.activityType ? `・${entry.activityType}` : ""}）`,
      isRegionalHeritage: false,
      metadata: {
        designation: kindLabel,
        certPeriod: entry.period || null,
        activityType: entry.activityType || null,
        municipality: clean(entry.municipality),
      },
    });
  }
  return list;
}

/**
 * Extract deduplicated Shizuoka Nature Symbiosis Sites from MOE PDF text extracts.
 * Facts only: site name, municipality, and certification label; zero prose copied.
 */
export function parseMoeSymbiosisPdfText({ r806ZoshinText = "", r806RenkeiText = "", r5r6Text = "" }) {
  const rawEntries = [];
  for (const [text, mode] of [
    [r806ZoshinText, "r806_zoshin"],
    [r806RenkeiText, "r806_renkei"],
    [r5r6Text, "r5r6"],
  ]) {
    const lines = text.split(/\r?\n/u);
    for (let i = 0; i < lines.length; i += 1) {
      if (!lines[i].includes("静岡県")) continue;
      const parsed = stripMoeSiteColumnWrap(lines, i, mode);
      if (!parsed || !parsed.name || !parsed.municipality) continue;
      rawEntries.push(parsed);
    }
  }
  return normalizeMoeEntries(rawEntries);
}

/**
 * Parse Shizuoka Prefecture or Hamamatsu City Cultural Property CSV,
 * retaining monuments (史跡・名勝・天然記念物・記念物) and excluding 非公開 rows.
 */
export function parseCulturalPropertiesCsv(csvText, sourceKind) {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return [];
  const header = rows[0].map(clean);
  const idx = (name) => header.indexOf(name);

  const items = [];
  for (let r = 1; r < rows.length; r += 1) {
    const row = rows[r];
    if (!row || row.length < 5) continue;

    if (sourceKind === "hamamatsu_cp") {
      const designation = clean(row[idx("指定等")]);
      const division = clean(row[idx("区分")]);
      const subType = clean(row[idx("種別")]);
      const name = clean(row[idx("名称")]).replace(/\s+附\s+.*$/u, "").trim();
      const address = clean(row[idx("所在地")]);
      const designatedDate = clean(row[idx("指定年月日")]);
      const disclosure = clean(row[idx("公開情報")]);
      const rowNo = clean(row[idx("NO")]) || String(r);
      const ward = clean(row[idx("区")]);
      const lat = Number(clean(row[idx("緯度")]));
      const lng = Number(clean(row[idx("経度")]));

      if (!name || disclosure === "非公開") continue;
      if (!MONUMENT_RE.test(division) && !MONUMENT_RE.test(subType)) continue;
      if (address.startsWith("東京都")) continue;

      const municipality = ward ? `浜松市${ward}` : "浜松市";
      items.push({
        sourceKind: "hamamatsu_cultural_property",
        sourceId: `hamamatsu_cp:${rowNo}:${normalizePlaceSearchText(name)}`,
        name,
        municipality: "浜松市",
        address: clean(`静岡県${municipality}${address}`),
        lat: Number.isFinite(lat) && lat > 30 ? round6(lat) : null,
        lng: Number.isFinite(lng) && lng > 130 ? round6(lng) : null,
        category: "heritage",
        placeKind: subType === "天然記念物" ? "nature_area" : "other_named_area",
        factSummary: `${designation || "指定等"} ${subType || division}（浜松市・${disclosure || "認定"}）`,
        isRegionalHeritage: designation === "市認定",
        metadata: {
          designation: designation || null,
          division: division || null,
          subType: subType || null,
          designatedDate: designatedDate || null,
          disclosure: disclosure || null,
          municipality,
        },
      });
      continue;
    }

    // Shizuoka pref format (220001_cultural_property.csv)
    const id = clean(row[idx("ID")]) || String(r);
    const name = clean(row[idx("名称")]);
    const division = clean(row[idx("文化財分類")]);
    const subType = clean(row[idx("種類")]);
    const fullAddr = clean(row[idx("所在地_連結表記")]);
    const muniRaw = clean(row[idx("所在地_市区町村")]);
    const designatedDate = clean(row[idx("文化財指定日")]);
    const lat = Number(clean(row[idx("緯度")]));
    const lng = Number(clean(row[idx("経度")]));

    if (!name) continue;
    if (!MONUMENT_RE.test(division) && !MONUMENT_RE.test(subType)) continue;
    if (fullAddr.includes("浜松市") || muniRaw.includes("浜松市")) continue; // Prefer municipal detail for Hamamatsu

    const muniMatch = (muniRaw || fullAddr).match(/([^\s県郡]+?[市区町村])/u);
    const municipality = muniMatch?.[1] ?? "静岡市";

    items.push({
      sourceKind: "shizuoka_cultural_property",
      sourceId: `shizuoka_cp:${id}:${normalizePlaceSearchText(name)}`,
      name,
      municipality,
      address: fullAddr || `静岡県${municipality}`,
      lat: Number.isFinite(lat) && lat > 30 ? round6(lat) : null,
      lng: Number.isFinite(lng) && lng > 130 ? round6(lng) : null,
      category: "heritage",
      placeKind: subType.includes("天然記念物") ? "nature_area" : "other_named_area",
      factSummary: `静岡県指定・国指定 ${subType || division}（${municipality}）`,
      isRegionalHeritage: false,
      metadata: {
        designation: "国・県指定",
        division: division || null,
        subType: subType || null,
        designatedDate: designatedDate || null,
        municipality,
      },
    });
  }
  return items;
}

function stablePlaceId(sourceKind, sourceId) {
  return `plc_${createHash("sha256").update(`${sourceKind}:${sourceId}`).digest("hex").slice(0, 16)}`;
}

/**
 * Resolve coordinates (exact CSV / OSM match -> municipality centroid + needsCoordinateReview)
 * and deduplicate across datasets and against existing places.
 */
export function buildNonParkPlaceCandidates({
  moeItems = [],
  culturalItems = [],
  osmMatches = {},
  municipalityCenters = {},
  existingNames = [],
}) {
  const seenKeys = new Set(existingNames.map((n) => normalizePlaceSearchText(n)).filter(Boolean));
  const places = [];
  const stats = {
    totalInput: moeItems.length + culturalItems.length,
    imported: 0,
    deduped: 0,
    osmMatched: 0,
    exactCoord: 0,
    municipalityFallbackNeedsReview: 0,
    missingCoordinateSkipped: 0,
    bySourceKind: {},
  };

  for (const item of [...moeItems, ...culturalItems]) {
    const key = normalizePlaceSearchText(item.name);
    if (!key || seenKeys.has(key)) {
      stats.deduped += 1;
      continue;
    }

    const osm = osmMatches[item.name] ?? osmMatches[key] ?? null;
    let lat = null;
    let lng = null;
    let verificationStatus = "unverified";
    let coordinateSource = "municipality_centroid";
    let needsCoordinateReview = true;
    let sourceUrl = null;

    if (item.lat !== null && item.lat !== undefined && item.lng !== null && item.lng !== undefined) {
      lat = round6(item.lat);
      lng = round6(item.lng);
      verificationStatus = "source_verified";
      coordinateSource = "official_opendata";
      needsCoordinateReview = false;
      stats.exactCoord += 1;
    } else if (osm && Number.isFinite(osm.lat) && Number.isFinite(osm.lng)) {
      lat = round6(osm.lat);
      lng = round6(osm.lng);
      if (osm.osmType && osm.osmId) {
        verificationStatus = "source_verified";
        coordinateSource = "osm_name_match";
        needsCoordinateReview = false;
        sourceUrl = `https://www.openstreetmap.org/${osm.osmType}/${osm.osmId}`;
        stats.osmMatched += 1;
      } else {
        verificationStatus = "unverified";
        coordinateSource = "gsi_address_match";
        needsCoordinateReview = true;
        stats.gsiAddressMatched = (stats.gsiAddressMatched ?? 0) + 1;
      }
    } else {
      const center =
        municipalityCenters[item.municipality] ??
        municipalityCenters[item.municipality.replace(/^[^市区町村]+郡/u, "")] ??
        municipalityCenters[item.municipality.replace(/^浜松市.+$/u, "浜松市")];
      if (!center) {
        stats.missingCoordinateSkipped += 1;
        continue;
      }
      lat = round6(center[0]);
      lng = round6(center[1]);
      verificationStatus = "unverified";
      coordinateSource = "municipality_centroid";
      needsCoordinateReview = true;
      stats.municipalityFallbackNeedsReview += 1;
    }

    seenKeys.add(key);
    const ring = circleRing(lat, lng, DEFAULTS.pointRadiusM, DEFAULTS.circlePoints);
    const polygons = [[ring]];
    const bbox = polygonsBbox(polygons);
    const areaHa = polygonsAreaHa(polygons);
    const placeId = stablePlaceId(item.sourceKind, item.sourceId);

    places.push({
      placeId,
      sourceType: item.sourceKind,
      sourceId: item.sourceId,
      sourceUrl,
      name: item.name,
      normalizedName: key,
      localityLabel: clean(`静岡県${item.municipality}`),
      placeKind: item.placeKind,
      verificationStatus,
      officialStatus: "official",
      publicSummary: item.factSummary,
      lat,
      lng,
      polygons,
      bbox,
      areaHa,
      needsCoordinateReview,
      coordinateSource,
      osmMatch: osm ? { osmType: osm.osmType, osmId: osm.osmId } : null,
      isRegionalHeritage: Boolean(item.isRegionalHeritage),
      metadata: {
        ...item.metadata,
        needsCoordinateReview,
        coordinateSource,
        ...(osm?.osmType && osm?.osmId ? { osmMatch: `${osm.osmType}:${osm.osmId}` } : {}),
        ...(item.isRegionalHeritage ? { hamamatsuRegionalHeritage: true } : {}),
      },
    });
    stats.imported += 1;
    stats.bySourceKind[item.sourceKind] = (stats.bySourceKind[item.sourceKind] ?? 0) + 1;
  }

  return { places, stats };
}

export function renderNonParkImportSql(places, { batch, retrievedAt }) {
  const lines = [`-- importBatch=${batch} places=${places.length} retrievedAt=${retrievedAt}`];
  for (const place of places) {
    const pid = sqlText(place.placeId);
    const sourceReferenceId = `src_${place.placeId}`;
    const geometry = geometryGeojson(place.polygons);
    const metadata = {
      importBatch: batch,
      via: "shizuoka_nonpark_import",
      ...place.metadata,
      circleRadiusM: DEFAULTS.pointRadiusM,
    };
    const validation = {
      importBatch: batch,
      circle: { lat: place.lat, lng: place.lng, radiusM: DEFAULTS.pointRadiusM, points: DEFAULTS.circlePoints },
      needsCoordinateReview: place.needsCoordinateReview,
    };
    const guard = `WHERE EXISTS (SELECT 1 FROM places WHERE place_id = ${pid})`;

    lines.push(
      `INSERT OR IGNORE INTO places (place_id, canonical_name, canonical_name_normalized, locality_label, place_kind, verification_status, public_profile_status, official_status, public_summary, metadata_json, valid_from) SELECT ${pid}, ${sqlText(place.name)}, ${sqlText(place.normalizedName)}, ${sqlText(place.localityLabel)}, ${sqlText(place.placeKind)}, ${sqlText(place.verificationStatus)}, 'published', ${sqlText(place.officialStatus)}, ${sqlText(place.publicSummary)}, ${sqlText(JSON.stringify(metadata))}, ${sqlText(retrievedAt)} WHERE NOT EXISTS (SELECT 1 FROM place_source_references WHERE source_type = ${sqlText(place.sourceType)} AND source_id = ${sqlText(place.sourceId)});`
    );
    lines.push(
      `INSERT OR IGNORE INTO place_source_references (source_reference_id, place_id, source_type, source_id, source_url, source_payload_json, source_confidence, verification_status, precedence_rank, observed_at, last_checked_at, valid_from) SELECT ${sqlText(sourceReferenceId)}, ${pid}, ${sqlText(place.sourceType)}, ${sqlText(place.sourceId)}, ${sqlText(place.sourceUrl)}, ${sqlText(JSON.stringify({ importBatch: batch, ...place.metadata }))}, ${place.needsCoordinateReview ? 0.5 : 0.8}, ${sqlText(place.verificationStatus)}, 45, ${sqlText(retrievedAt)}, ${sqlText(retrievedAt)}, ${sqlText(retrievedAt)} ${guard};`
    );
    lines.push(
      `INSERT OR IGNORE INTO place_boundaries (boundary_id, place_id, boundary_kind, geometry_kind, boundary_geojson, source_reference_id, source_type, confidence, precision_kind, valid_from, boundary_version, validation_state, validation_details_json, is_primary, bbox_west, bbox_south, bbox_east, bbox_north, area_ha) SELECT ${sqlText(`bnd_${place.placeId}_v1`)}, ${pid}, 'primary', ${sqlText(geometry.type)}, ${sqlText(JSON.stringify(geometry))}, ${sqlText(sourceReferenceId)}, ${sqlText(place.sourceType)}, ${place.needsCoordinateReview ? 0.4 : 0.75}, 'approximate', ${sqlText(retrievedAt)}, 1, 'valid', ${sqlText(JSON.stringify(validation))}, 1, ${sqlNumber(place.bbox.west)}, ${sqlNumber(place.bbox.south)}, ${sqlNumber(place.bbox.east)}, ${sqlNumber(place.bbox.north)}, ${sqlNumber(Math.round(place.areaHa * 10_000) / 10_000)} ${guard};`
    );
    lines.push(
      `INSERT OR IGNORE INTO place_policies (place_policy_id, place_id, place_visibility, recording_policy, photography_rule_status, public_location_mode, contribution_cta_mode, verification_status, last_checked_at, valid_from) SELECT ${sqlText(`pol_${place.placeId}_v1`)}, ${pid}, 'public', 'check_rules', 'unknown', 'place', 'check_rules', ${sqlText(place.verificationStatus)}, ${sqlText(retrievedAt)}, ${sqlText(retrievedAt)} ${guard};`
    );
  }
  return `${lines.join("\n")}\n`;
}

export function renderNonParkRollbackSql(batch) {
  return renderRollbackSql(batch);
}

function parseCliArgs(argv) {
  const args = {
    out: "data/shizuoka-nonpark-places",
    batch: `shizuoka-nonpark-${new Date().toISOString().slice(0, 10).replace(/-/gu, "")}`,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--r806-zoshin") args.r806Zoshin = argv[++i];
    else if (a === "--r806-renkei") args.r806Renkei = argv[++i];
    else if (a === "--r5r6") args.r5r6 = argv[++i];
    else if (a === "--moe-json") args.moeJson = argv[++i];
    else if (a === "--shizuoka-cp") args.shizuokaCp = argv[++i];
    else if (a === "--hamamatsu-cp") args.hamamatsuCp = argv[++i];
    else if (a === "--osm-matches") args.osmMatches = argv[++i];
    else if (a === "--city-centers") args.cityCenters = argv[++i];
    else if (a === "--out") args.out = argv[++i] ?? args.out;
    else if (a === "--batch") args.batch = argv[++i] ?? args.batch;
  }
  return args;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseCliArgs(process.argv.slice(2));
  const moeItems = args.moeJson
    ? normalizeMoeEntries(JSON.parse(readFileSync(resolve(args.moeJson), "utf8")))
    : parseMoeSymbiosisPdfText({
        r806ZoshinText: args.r806Zoshin ? readFileSync(resolve(args.r806Zoshin), "utf8") : "",
        r806RenkeiText: args.r806Renkei ? readFileSync(resolve(args.r806Renkei), "utf8") : "",
        r5r6Text: args.r5r6 ? readFileSync(resolve(args.r5r6), "utf8") : "",
      });
  const cpShizuoka = args.shizuokaCp
    ? parseCulturalPropertiesCsv(new TextDecoder("shift_jis").decode(readFileSync(resolve(args.shizuokaCp))), "shizuoka_cp")
    : [];
  const cpHamamatsu = args.hamamatsuCp
    ? parseCulturalPropertiesCsv(new TextDecoder("shift_jis").decode(readFileSync(resolve(args.hamamatsuCp))), "hamamatsu_cp")
    : [];
  const osmMatches = args.osmMatches ? JSON.parse(readFileSync(resolve(args.osmMatches), "utf8")) : {};
  const municipalityCenters = args.cityCenters ? JSON.parse(readFileSync(resolve(args.cityCenters), "utf8")) : {};

  const built = buildNonParkPlaceCandidates({
    moeItems,
    culturalItems: [...cpHamamatsu, ...cpShizuoka],
    osmMatches,
    municipalityCenters,
  });
  const outDir = resolve(args.out);
  mkdirSync(outDir, { recursive: true });
  const retrievedAt = new Date().toISOString().slice(0, 19) + "Z";
  const importSql = renderNonParkImportSql(built.places, { batch: args.batch, retrievedAt });
  const rollbackSql = renderNonParkRollbackSql(args.batch);
  writeFileSync(join(outDir, "import.sql"), importSql);
  writeFileSync(join(outDir, "rollback.sql"), rollbackSql);
  writeFileSync(
    join(outDir, "summary.json"),
    `${JSON.stringify({ batch: args.batch, retrievedAt, ...built.stats, sqlBytes: Buffer.byteLength(importSql) }, null, 2)}\n`
  );
  console.log(JSON.stringify({ batch: args.batch, ...built.stats, sqlBytes: Buffer.byteLength(importSql) }));
}
