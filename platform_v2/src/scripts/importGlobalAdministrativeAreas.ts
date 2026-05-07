import { readFileSync, readdirSync } from "node:fs";
import { basename, extname, resolve } from "node:path";
import { getPool } from "../db.js";
import { computeBbox } from "../services/geoJsonBbox.js";
import { entityKeyFromGeoProperties } from "../services/observationFieldIdentity.js";

type AdminLevel = "admin_country" | "admin_prefecture" | "admin_municipality";

type GeoGeom = {
  type: string;
  coordinates: unknown;
};

type GeoFeature = {
  type: "Feature";
  geometry: GeoGeom | null;
  properties?: Record<string, unknown> | null;
};

type GeoCollection = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

type ImportJob = {
  entityKey: string;
  name: string;
  adminLevel: AdminLevel;
  certificationId: string;
  prefecture: string;
  city: string;
  polygon: Record<string, unknown>;
  bbox: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  payload: Record<string, unknown>;
};

function parseArgs(): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const arg of process.argv.slice(2)) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.slice(2).split("=");
    out[key!] = rest.length > 0 ? rest.join("=") : true;
  }
  return out;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function slug(value: string): string {
  return clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getProp(props: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = clean(props[key]);
    if (value) return value;
  }
  return "";
}

function titleFromProps(props: Record<string, unknown>): string {
  return getProp(props, [
    "name:ja",
    "name",
    "NAME",
    "NAME_EN",
    "NAME_0",
    "NAME_1",
    "NAME_2",
    "name_local",
    "label",
    "title",
  ]);
}

function centerFromBbox(bbox: ImportJob["bbox"]): { lat: number; lng: number } {
  return {
    lat: (bbox.minLat + bbox.maxLat) / 2,
    lng: (bbox.minLng + bbox.maxLng) / 2,
  };
}

function roughRadiusM(bbox: ImportJob["bbox"]): number {
  const dLat = (bbox.maxLat - bbox.minLat) * 111_000;
  const meanLat = ((bbox.maxLat + bbox.minLat) / 2) * Math.PI / 180;
  const dLng = (bbox.maxLng - bbox.minLng) * 111_000 * Math.cos(meanLat);
  return Math.max(50, Math.min(200000, Math.round(Math.sqrt(dLat * dLat + dLng * dLng) / 2)));
}

function normalizeAdminLevel(value: unknown): AdminLevel {
  const raw = clean(value);
  if (raw === "country" || raw === "admin_country") return "admin_country";
  if (raw === "prefecture" || raw === "state" || raw === "province" || raw === "admin_prefecture") return "admin_prefecture";
  return "admin_municipality";
}

function buildJob(feature: GeoFeature, adminLevel: AdminLevel, fileStem: string, index: number): ImportJob | null {
  const props = feature.properties ?? {};
  if (!feature.geometry || (feature.geometry.type !== "Polygon" && feature.geometry.type !== "MultiPolygon")) return null;
  const polygon = feature.geometry as unknown as Record<string, unknown>;
  const bbox = computeBbox(polygon);
  if (!bbox) return null;
  const name = titleFromProps(props);
  if (!name) return null;
  const entityKey = entityKeyFromGeoProperties(props)
    ?? (getProp(props, ["osm_type", "osm:type"]) && getProp(props, ["osm_id", "osm:id"])
      ? `osm:${slug(getProp(props, ["osm_type", "osm:type"]))}:${slug(getProp(props, ["osm_id", "osm:id"]))}`
      : "");
  const safeEntityKey = entityKey || `admin_import:${fileStem}:${index + 1}`;
  return {
    entityKey: safeEntityKey,
    name,
    adminLevel,
    certificationId: safeEntityKey,
    prefecture: getProp(props, ["prefecture", "province", "state", "NAME_1"]),
    city: getProp(props, ["city", "municipality", "NAME_2"]),
    polygon,
    bbox,
    payload: {
      imported_by: "importGlobalAdministrativeAreas",
      source_file: fileStem,
      raw_properties: props,
      identity_fallback: entityKey ? null : "admin_import_file_index",
    },
  };
}

async function applyJob(job: ImportJob, validFrom: string): Promise<"inserted" | "updated" | "superseded"> {
  const pool = getPool();
  const current = await pool.query<{ field_id: string; valid_from: string | null }>(
    `select field_id, valid_from::text as valid_from
       from observation_fields
      where entity_key = $1
        and valid_to is null
      limit 1`,
    [job.entityKey],
  );
  const existing = current.rows[0];
  const center = centerFromBbox(job.bbox);
  const payload = JSON.stringify(job.payload);

  if (existing && existing.valid_from === validFrom) {
    await pool.query(
      `update observation_fields
          set name = $2,
              prefecture = $3,
              city = $4,
              lat = $5,
              lng = $6,
              radius_m = $7,
              polygon = $8::jsonb,
              payload = observation_fields.payload || $9::jsonb,
              bbox_min_lat = $10,
              bbox_max_lat = $11,
              bbox_min_lng = $12,
              bbox_max_lng = $13,
              admin_level = $14,
              updated_at = now()
        where field_id = $1`,
      [
        existing.field_id,
        job.name,
        job.prefecture,
        job.city,
        center.lat,
        center.lng,
        roughRadiusM(job.bbox),
        JSON.stringify(job.polygon),
        payload,
        job.bbox.minLat,
        job.bbox.maxLat,
        job.bbox.minLng,
        job.bbox.maxLng,
        job.adminLevel,
      ],
    );
    return "updated";
  }

  if (existing) {
    const closedAt = new Date(validFrom);
    closedAt.setUTCDate(closedAt.getUTCDate() - 1);
    await pool.query(
      `update observation_fields
          set valid_to = $2::date,
              updated_at = now()
        where field_id = $1`,
      [existing.field_id, closedAt.toISOString().slice(0, 10)],
    );
  }

  await pool.query(
    `insert into observation_fields (
       source, name, prefecture, city, lat, lng, radius_m,
       polygon, certification_id, official_url, payload,
       bbox_min_lat, bbox_max_lat, bbox_min_lng, bbox_max_lng,
       admin_level, entity_key, valid_from
     ) values (
       'user_defined', $1, $2, $3, $4, $5, $6,
       $7::jsonb, $8, '', $9::jsonb,
       $10, $11, $12, $13,
       $14, $15, $16::date
     )`,
    [
      job.name,
      job.prefecture,
      job.city,
      center.lat,
      center.lng,
      roughRadiusM(job.bbox),
      JSON.stringify(job.polygon),
      job.certificationId,
      payload,
      job.bbox.minLat,
      job.bbox.maxLat,
      job.bbox.minLng,
      job.bbox.maxLng,
      job.adminLevel,
      job.entityKey,
      validFrom,
    ],
  );

  if (existing) {
    await pool.query(
      `update observation_fields
          set superseded_by = (
            select field_id from observation_fields
             where entity_key = $1 and valid_to is null
             limit 1
          )
        where field_id = $2`,
      [job.entityKey, existing.field_id],
    );
  }
  return existing ? "superseded" : "inserted";
}

function filesFromArgs(args: Record<string, string | boolean>): string[] {
  const file = typeof args.file === "string" ? resolve(process.cwd(), args.file) : null;
  const dir = typeof args.dir === "string" ? resolve(process.cwd(), args.dir) : null;
  if (file) return [file];
  if (!dir) return [];
  return readdirSync(dir)
    .filter((entry) => /\.geojson(?:\.json)?$/i.test(entry))
    .map((entry) => resolve(dir, entry));
}

async function main(): Promise<void> {
  const args = parseArgs();
  const files = filesFromArgs(args);
  const adminLevel = normalizeAdminLevel(args["admin-level"]);
  const validFrom = typeof args["valid-from"] === "string" ? args["valid-from"] : new Date().toISOString().slice(0, 10);
  const dryRun = Boolean(args["dry-run"]);
  const limit = typeof args.limit === "string" ? Math.max(1, Number(args.limit)) : Infinity;

  if (files.length === 0) {
    console.log(`usage: npm run import:admin-global -- --file=areas.geojson --admin-level=country|prefecture|municipality [--valid-from=YYYY-MM-DD] [--dry-run]`);
    return;
  }

  let inserted = 0;
  let updated = 0;
  let superseded = 0;
  let skipped = 0;

  for (const file of files) {
    const text = readFileSync(file, "utf8").replace(/^﻿/, "");
    const parsed = JSON.parse(text) as GeoCollection;
    if (!parsed || parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
      console.warn(`[admin-import] skipped non FeatureCollection ${file}`);
      skipped += 1;
      continue;
    }
    const fileStem = basename(file, extname(file)).replace(/[^a-zA-Z0-9_-]+/g, "-");
    for (let i = 0; i < Math.min(parsed.features.length, limit); i += 1) {
      const job = buildJob(parsed.features[i]!, adminLevel, fileStem, i);
      if (!job) {
        skipped += 1;
        continue;
      }
      if (dryRun) {
        console.log(`[dry] ${job.entityKey} ${job.adminLevel} ${job.name}`);
        inserted += 1;
        continue;
      }
      const outcome = await applyJob(job, validFrom);
      if (outcome === "inserted") inserted += 1;
      if (outcome === "updated") updated += 1;
      if (outcome === "superseded") superseded += 1;
    }
  }

  console.log(`[admin-import] inserted=${inserted} updated=${updated} superseded=${superseded} skipped=${skipped} dryRun=${dryRun}`);
}

void main().catch((error) => {
  console.error("[admin-import] failed", error);
  process.exitCode = 1;
});
