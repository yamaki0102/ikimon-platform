import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildAdminIndex, geometryBbox, pointInRing, resolveAdminCodes, simplifyGeometry } from "../../src/adminUnits.ts";
import { readDbf, readShpPolygons, ringsToPolygons } from "./shp.mjs";

const outDir = process.argv[2] ?? "D:/cx/work/geo/out";
const n03Path = process.argv[3] ?? "D:/cx/work/geo/n03-2024-22/x/N03-20240101_22.geojson";
const estatBase = process.argv[4] ?? "D:/cx/work/geo/estat-2020-22/x/r2ka22";
const VERSION = "n03-20240101+estat-r2ka-2020";
const TOL = 0.0003;
const MAX_ROW = 82000;
const MAX_FILE = 88000;
const SEIREI = { "静岡市": "22100", "浜松市": "22130" };

mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (/^admin_unit.*\.sql$/.test(f)) rmSync(join(outDir, f));

const q = (s) => (s === null || s === undefined ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);

const n03 = JSON.parse(readFileSync(n03Path, "utf8"));
const groups = new Map();
for (const f of n03.features) {
  const p = f.properties;
  const code = p.N03_007;
  if (!code) continue;
  const g = groups.get(code) ?? { code, city: p.N03_004, ward: p.N03_005, gun: p.N03_003, polys: [] };
  g.polys.push(f.geometry.coordinates);
  groups.set(code, g);
}

const units = [];
const boundaries = [];
units.push({ code: "JP", level: "country", parent: null, name: "日本" });
units.push({ code: "22", level: "pref", parent: "JP", name: "静岡県" });
const seiCities = new Set();
const leafUnits = [];
for (const g of groups.values()) {
  const isWard = Boolean(g.ward);
  const isVillage = !isWard && /村$/.test(g.city);
  let level = isWard ? "ward" : isVillage ? "village" : "city";
  let parent = null;
  let name = isWard ? g.ward : g.city;
  if (isWard) {
    parent = SEIREI[g.city];
    if (!parent) throw new Error(`unknown seirei city ${g.city}`);
    if (!seiCities.has(parent)) {
      seiCities.add(parent);
      units.push({ code: parent, level: "city", parent: "22", name: g.city });
    }
  } else parent = "22";
  const geometry = { type: "MultiPolygon", coordinates: g.polys.map((c) => c) };
  const u = { code: g.code, level, parent: isWard ? parent : "22", name, geometry };
  units.push(u);
  leafUnits.push({ code: g.code, level, parent_code: isWard ? parent : null, geometry, bbox: geometryBbox(geometry) });
}

const index0 = buildAdminIndex(leafUnits.map((u) => ({ ...u, bbox: u.bbox })));
const wardOrCityAt = (lng, lat) => {
  const c = resolveAdminCodes(lng, lat, index0);
  return c.ward_code ?? c.city_code;
};

const dbf = readDbf(`${estatBase}.dbf`);
const shp = readShpPolygons(`${estatBase}.shp`);
if (dbf.length !== shp.length) throw new Error("dbf/shp mismatch");
const towns = new Map();
const hcodes = {};
let skipped = 0;
for (let i = 0; i < dbf.length; i++) {
  const r = dbf[i];
  const rings = shp[i];
  hcodes[r.HCODE] = (hcodes[r.HCODE] ?? 0) + 1;
  if (!rings || r._deleted || !r.S_AREA || Number(r.HCODE) >= 8154) {
    skipped++;
    continue;
  }
  const key = r.KEY_CODE.slice(0, 5) + r.S_AREA.slice(0, 4);
  const t = towns.get(key) ?? { key, polys: [], votes: new Map(), names: [], zero: null };
  const polys = ringsToPolygons(rings, pointInRing);
  for (const p of polys) t.polys.push(p);
  const x = Number(r.X_CODE);
  const y = Number(r.Y_CODE);
  let owner = Number.isFinite(x) && Number.isFinite(y) ? wardOrCityAt(x, y) : null;
  if (!owner) for (const ring of rings) { for (const pt of ring) { owner = wardOrCityAt(pt[0], pt[1]); if (owner) break; } if (owner) break; }
  const w = Number(r.AREA) || 1;
  if (owner) t.votes.set(owner, (t.votes.get(owner) ?? 0) + w);
  if (r.S_AREA.slice(4, 6) === "00") t.zero = r.S_NAME;
  t.names.push(r.S_NAME);
  towns.set(key, t);
}

const stripName = (s) => s.replace(/[一二三四五六七八九十〇]+丁目$/, "").replace(/第[一二三四五六七八九十〇]+$/, "").replace(/\s+/g, "");
const unitByCode = new Map(units.map((u) => [u.code, u]));
let townCount = 0;
let townDropped = 0;
for (const t of towns.values()) {
  let owner = null;
  let best = -1;
  for (const [k, v] of t.votes) if (v > best) { best = v; owner = k; }
  const name = stripName(t.zero || t.names[0] || "");
  const ownerUnit = owner ? unitByCode.get(owner) : null;
  if (!owner || !name || !ownerUnit || ownerUnit.level === "village") { townDropped++; continue; }
  units.push({ code: t.key, level: "town", parent: owner, name });
  unitByCode.set(t.key, units[units.length - 1]);
  boundaries.push({ code: t.key, geometry: { type: "MultiPolygon", coordinates: t.polys } });
  townCount++;
}
for (const u of leafUnits) boundaries.push({ code: u.code, geometry: u.geometry });

const simpRows = [];
const widened = [];
for (const b of boundaries) {
  let tol = TOL;
  let geom;
  let json;
  for (;;) {
    geom = simplifyGeometry(b.geometry, tol);
    if (geom.type === "MultiPolygon" && geom.coordinates.length === 1) geom = { type: "Polygon", coordinates: geom.coordinates[0] };
    json = JSON.stringify(geom);
    if (json.length <= MAX_ROW || tol > 0.05) break;
    tol *= 1.5;
  }
  if (tol > TOL) widened.push(`${b.code}:${tol.toFixed(4)}`);
  const bb = geometryBbox(geom);
  simpRows.push({ code: b.code, bb, json, bytes: Buffer.byteLength(json) });
}

function writeChunks(prefix, header, rows, rowSql, maxFile, perStmt) {
  let files = 0;
  let bytes = 0;
  let cur = [];
  let curLen = 0;
  const flush = () => {
    if (!cur.length) return;
    const parts = [];
    for (let i = 0; i < cur.length; i += perStmt) parts.push(header + cur.slice(i, i + perStmt).join(",\n") + ";\n");
    const text = parts.join("");
    files++;
    bytes += Buffer.byteLength(text);
    writeFileSync(join(outDir, `${prefix}_${String(files).padStart(3, "0")}.sql`), text);
    cur = [];
    curLen = 0;
  };
  for (const r of rows) {
    const s = rowSql(r);
    const l = Buffer.byteLength(s);
    if (curLen + l + 200 > maxFile) flush();
    cur.push(s);
    curLen += l + 2;
  }
  flush();
  return { files, bytes };
}

const unitStats = writeChunks(
  "admin_units",
  "INSERT OR REPLACE INTO admin_units (code, level, parent_code, name_ja, name_en, boundary_version, valid_from, valid_to) VALUES\n",
  units,
  (u) => `(${q(u.code)},${q(u.level)},${q(u.parent)},${q(u.name)},NULL,${q(VERSION)},NULL,NULL)`,
  MAX_FILE,
  200
);
const bStats = writeChunks(
  "admin_unit_boundaries",
  "INSERT OR REPLACE INTO admin_unit_boundaries (code, bbox_min_lng, bbox_min_lat, bbox_max_lng, bbox_max_lat, geometry_json) VALUES\n",
  simpRows,
  (r) => `(${q(r.code)},${r.bb[0]},${r.bb[1]},${r.bb[2]},${r.bb[3]},${q(r.json)})`,
  MAX_FILE,
  50
);

const counts = {};
for (const u of units) counts[u.level] = (counts[u.level] ?? 0) + 1;
const report = { version: VERSION, counts, townDropped, skippedRecords: skipped, hcodes, units: unitStats, boundaries: { ...bStats, rows: simpRows.length, jsonBytes: simpRows.reduce((a, r) => a + r.bytes, 0), maxRow: Math.max(...simpRows.map((r) => r.bytes)) }, widened };
writeFileSync(join(outDir, "build-report.json"), JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1));

const indexRows = simpRows.map((r) => {
  const u = unitByCode.get(r.code);
  return { code: r.code, level: u.level, parent_code: u.level === 'ward' || u.level === 'town' ? u.parent : null, bbox: r.bb, geometry: JSON.parse(r.json) };
});
writeFileSync(join(outDir, 'admin-index.json'), JSON.stringify({ version: VERSION, units: indexRows }));
const index = buildAdminIndex(indexRows);
const sample = resolveAdminCodes(137.7261, 34.7108, index);
const names = Object.fromEntries(Object.entries(sample).map(([k, v]) => [k, v && unitByCode.get(v) ? unitByCode.get(v).name : v]));
console.log('hamamatsu-station', JSON.stringify(sample), JSON.stringify(names));
