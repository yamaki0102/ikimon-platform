import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildAdminIndex, publishedLevelFor, resolveAdminCodes } from "../../src/adminUnits.ts";

const [indexPath, inputPath, outDir] = process.argv.slice(2);
if (!indexPath || !inputPath || !outDir) {
  console.error("usage: assign.mjs <admin-index.json> <export.json {observations:[],places:[]}> <outDir>");
  process.exit(2);
}
const MAX_FILE = 88000;
const { version, units } = JSON.parse(readFileSync(indexPath, "utf8"));
const { observations = [], places = [] } = JSON.parse(readFileSync(inputPath, "utf8"));
const index = buildAdminIndex(units);
const now = new Date().toISOString();
const q = (s) => (s === null || s === undefined ? "NULL" : `'${String(s).replace(/'/g, "''")}'`);
const num = (v) => (v === null || v === undefined || v === "" ? NaN : Number(v));

mkdirSync(outDir, { recursive: true });
for (const f of readdirSync(outDir)) if (/^(observation|place)_admin_assignment.*\.sql$/.test(f)) rmSync(join(outDir, f));

function write(prefix, header, rows) {
  let n = 0;
  let cur = [];
  let len = 0;
  const flush = () => {
    if (!cur.length) return;
    n++;
    writeFileSync(join(outDir, `${prefix}_${String(n).padStart(4, "0")}.sql`), header + cur.join(",\n") + ";\n");
    cur = [];
    len = 0;
  };
  for (const r of rows) {
    if (len + r.length + 300 > MAX_FILE) flush();
    cur.push(r);
    len += r.length + 2;
  }
  flush();
  return n;
}

const stats = { observations: 0, observationsUnresolved: 0, places: 0, placesUnresolved: 0, publishedLevels: {} };
const obsRows = [];
for (const o of observations) {
  const lat = num(o.exact_lat);
  const lng = num(o.exact_lng);
  const codes = resolveAdminCodes(lng, lat, index);
  const level = publishedLevelFor(codes, {
    location_share_mode: o.location_share_mode,
    is_child_or_rare: o.is_child_or_rare,
    coarsened: o.coarsened,
    audience_scope: o.audience_scope,
    public_precision: o.public_precision,
    risk_lane: o.risk_lane,
    municipality: o.municipality
  });
  stats.observations++;
  if (!codes.pref_code) stats.observationsUnresolved++;
  stats.publishedLevels[level] = (stats.publishedLevels[level] ?? 0) + 1;
  obsRows.push(`(${q(o.observation_id)},${q(codes.country_code)},${q(codes.pref_code)},${q(codes.city_code)},${q(codes.ward_code)},${q(codes.town_code)},${q(level)},${q(version)},${q(now)})`);
}
const placeRows = [];
for (const p of places) {
  const lat = num(p.center_lat);
  const lng = num(p.center_lng);
  const codes = resolveAdminCodes(lng, lat, index);
  stats.places++;
  if (!codes.pref_code) stats.placesUnresolved++;
  placeRows.push(`(${q(p.place_id)},${q(codes.country_code)},${q(codes.pref_code)},${q(codes.city_code)},${q(codes.ward_code)},${q(codes.town_code)},${q(version)},${q(now)})`);
}
const files = {
  observations: write("observation_admin_assignment", "INSERT OR REPLACE INTO observation_admin_assignment (observation_id, country_code, pref_code, city_code, ward_code, town_code, published_level, boundary_version, assigned_at) VALUES\n", obsRows),
  places: write("place_admin_assignment", "INSERT OR REPLACE INTO place_admin_assignment (place_id, country_code, pref_code, city_code, ward_code, town_code, boundary_version, assigned_at) VALUES\n", placeRows)
};
console.log(JSON.stringify({ ...stats, files }));
