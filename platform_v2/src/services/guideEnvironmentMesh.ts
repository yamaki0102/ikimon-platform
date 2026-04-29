import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { getPool } from "../db.js";
import { meshCenter100m, meshKey100m } from "./observationEventEffort.js";

export type GuideEnvironmentFeatureType = "vegetation" | "landform" | "structure" | "sound";

export type GuideEnvironmentFeature = {
  type?: string;
  name?: string;
  confidence?: number;
  note?: string;
};

type CountMap = Record<string, number>;

export type GuideEnvironmentMeshInput = {
  guideRecordId: string;
  userId?: string | null;
  lat: number | null;
  lng: number | null;
  detectedFeatures: GuideEnvironmentFeature[];
  seenAt?: string | null;
};

type MeshRow = {
  mesh_key: string;
  guide_record_count: number;
  contributor_hashes: unknown;
  vegetation_counts: unknown;
  landform_counts: unknown;
  structure_counts: unknown;
  sound_counts: unknown;
  sample_record_ids: unknown;
  first_seen_at: string | null;
  last_seen_at: string | null;
};

export type GuideEnvironmentMeshFeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "Point"; coordinates: [number, number] };
    properties: Record<string, unknown>;
  }>;
};

function normalizeCountMap(raw: unknown): CountMap {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: CountMap = {};
  for (const [key, value] of Object.entries(raw)) {
    const count = Number(value);
    if (key && Number.isFinite(count) && count > 0) out[key] = Math.round(count);
  }
  return out;
}

function normalizeStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
}

function mergeCounts(base: CountMap, delta: CountMap): CountMap {
  const next = { ...base };
  for (const [key, value] of Object.entries(delta)) {
    next[key] = (next[key] ?? 0) + value;
  }
  return next;
}

function topEntries(map: CountMap, limit: number): Array<{ name: string; count: number }> {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja"))
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

function contributorHash(userId: string | null | undefined): string | null {
  if (!userId) return null;
  return createHash("sha256").update(`guide-env:${userId}`).digest("hex").slice(0, 16);
}

export function summarizeGuideEnvironmentFeatures(features: GuideEnvironmentFeature[]): Record<GuideEnvironmentFeatureType, CountMap> {
  const grouped: Record<GuideEnvironmentFeatureType, CountMap> = {
    vegetation: {},
    landform: {},
    structure: {},
    sound: {},
  };
  for (const feature of features) {
    const type = String(feature.type ?? "");
    if (!["vegetation", "landform", "structure", "sound"].includes(type)) continue;
    const name = String(feature.name ?? "").trim();
    if (!name) continue;
    const confidence = Number(feature.confidence);
    const weight = Number.isFinite(confidence) ? Math.max(0.2, Math.min(1, confidence)) : 0.6;
    const bucket = grouped[type as GuideEnvironmentFeatureType];
    bucket[name] = Math.round(((bucket[name] ?? 0) + weight) * 1000) / 1000;
  }
  return grouped;
}

export async function upsertGuideEnvironmentMeshFromRecord(input: GuideEnvironmentMeshInput, client?: PoolClient): Promise<void> {
  if (input.lat == null || input.lng == null || !Number.isFinite(input.lat) || !Number.isFinite(input.lng)) return;
  const meshKey = meshKey100m(input.lat, input.lng);
  const center = meshCenter100m(meshKey);
  if (!meshKey || !center) return;

  const poolOrClient = client ?? getPool();
  const features = summarizeGuideEnvironmentFeatures(input.detectedFeatures);
  const seenAt = input.seenAt && Number.isFinite(Date.parse(input.seenAt)) ? input.seenAt : new Date().toISOString();
  const userHash = contributorHash(input.userId);

  const current = await poolOrClient.query<MeshRow>(
    `select mesh_key,
            guide_record_count,
            contributor_hashes,
            vegetation_counts,
            landform_counts,
            structure_counts,
            sound_counts,
            sample_record_ids,
            first_seen_at::text as first_seen_at,
            last_seen_at::text as last_seen_at
       from guide_environment_mesh_cells
      where mesh_key = $1`,
    [meshKey],
  );

  const row = current.rows[0];
  const contributorHashes = new Set(row ? normalizeStringArray(row.contributor_hashes) : []);
  if (userHash) contributorHashes.add(userHash);
  const sampleRecordIds = normalizeStringArray(row?.sample_record_ids);
  if (!sampleRecordIds.includes(input.guideRecordId)) sampleRecordIds.unshift(input.guideRecordId);
  const cappedSampleIds = sampleRecordIds.slice(0, 24);

  const vegetationCounts = mergeCounts(normalizeCountMap(row?.vegetation_counts), features.vegetation);
  const landformCounts = mergeCounts(normalizeCountMap(row?.landform_counts), features.landform);
  const structureCounts = mergeCounts(normalizeCountMap(row?.structure_counts), features.structure);
  const soundCounts = mergeCounts(normalizeCountMap(row?.sound_counts), features.sound);
  const firstSeenAt = row?.first_seen_at && Date.parse(row.first_seen_at) <= Date.parse(seenAt) ? row.first_seen_at : seenAt;
  const lastSeenAt = row?.last_seen_at && Date.parse(row.last_seen_at) >= Date.parse(seenAt) ? row.last_seen_at : seenAt;

  await poolOrClient.query(
    `insert into guide_environment_mesh_cells
       (mesh_key, center_lat, center_lng, guide_record_count, contributor_hashes, contributor_count,
        vegetation_counts, landform_counts, structure_counts, sound_counts, sample_record_ids,
        first_seen_at, last_seen_at, updated_at)
     values ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12, $13, now())
     on conflict (mesh_key) do update set
       center_lat = excluded.center_lat,
       center_lng = excluded.center_lng,
       guide_record_count = excluded.guide_record_count,
       contributor_hashes = excluded.contributor_hashes,
       contributor_count = excluded.contributor_count,
       vegetation_counts = excluded.vegetation_counts,
       landform_counts = excluded.landform_counts,
       structure_counts = excluded.structure_counts,
       sound_counts = excluded.sound_counts,
       sample_record_ids = excluded.sample_record_ids,
       first_seen_at = excluded.first_seen_at,
       last_seen_at = excluded.last_seen_at,
       updated_at = now()`,
    [
      meshKey,
      center.lat,
      center.lng,
      (row?.guide_record_count ?? 0) + 1,
      JSON.stringify(Array.from(contributorHashes).slice(0, 200)),
      contributorHashes.size,
      JSON.stringify(vegetationCounts),
      JSON.stringify(landformCounts),
      JSON.stringify(structureCounts),
      JSON.stringify(soundCounts),
      JSON.stringify(cappedSampleIds),
      firstSeenAt,
      lastSeenAt,
    ],
  );
}

export async function rebuildGuideEnvironmentMesh(opts: { dryRun?: boolean; limit?: number } = {}): Promise<{
  scanned: number;
  aggregatable: number;
  written: number;
}> {
  const limitClause = opts.limit && opts.limit > 0 ? "limit $1" : "";
  const params = opts.limit && opts.limit > 0 ? [Math.round(opts.limit)] : [];
  const rows = await getPool().query<{
    guide_record_id: string;
    user_id: string | null;
    lat: number | null;
    lng: number | null;
    detected_features: unknown;
    captured_at: string | null;
    created_at: string;
  }>(
    `select gr.guide_record_id::text,
            gr.user_id,
            gr.lat,
            gr.lng,
            gr.detected_features,
            gls.captured_at::text as captured_at,
            gr.created_at::text as created_at
       from guide_records gr
       left join guide_record_latency_states gls on gls.guide_record_id = gr.guide_record_id
      order by gr.created_at asc
      ${limitClause}`,
    params,
  );

  let aggregatable = 0;
  let written = 0;
  for (const row of rows.rows) {
    const features = Array.isArray(row.detected_features) ? row.detected_features as GuideEnvironmentFeature[] : [];
    if (row.lat == null || row.lng == null || features.length === 0) continue;
    aggregatable += 1;
    if (opts.dryRun) continue;
    await upsertGuideEnvironmentMeshFromRecord({
      guideRecordId: row.guide_record_id,
      userId: row.user_id,
      lat: row.lat,
      lng: row.lng,
      detectedFeatures: features,
      seenAt: row.captured_at ?? row.created_at,
    });
    written += 1;
  }
  return { scanned: rows.rows.length, aggregatable, written };
}

export async function loadGuideEnvironmentMeshGeoJson(
  limit = 500,
  opts: { publicOnly?: boolean; minRecords?: number; minContributors?: number } = {},
): Promise<GuideEnvironmentMeshFeatureCollection> {
  const cappedLimit = Math.max(1, Math.min(5000, Math.round(limit)));
  const where: string[] = [];
  const params: unknown[] = [cappedLimit];
  if (opts.publicOnly) {
    const minRecords = Math.max(1, Math.round(opts.minRecords ?? 3));
    const minContributors = Math.max(1, Math.round(opts.minContributors ?? 2));
    params.push(minRecords, minContributors);
    where.push(`(guide_record_count >= $2 or contributor_count >= $3)`);
  }
  const rows = await getPool().query<{
    mesh_key: string;
    center_lat: number;
    center_lng: number;
    guide_record_count: number;
    contributor_count: number;
    vegetation_counts: unknown;
    landform_counts: unknown;
    structure_counts: unknown;
    sound_counts: unknown;
    first_seen_at: string | null;
    last_seen_at: string | null;
  }>(
    `select mesh_key,
            center_lat,
            center_lng,
            guide_record_count,
            contributor_count,
            vegetation_counts,
            landform_counts,
            structure_counts,
            sound_counts,
            first_seen_at::text as first_seen_at,
            last_seen_at::text as last_seen_at
       from guide_environment_mesh_cells
      ${where.length ? `where ${where.join(" and ")}` : ""}
      order by last_seen_at desc nulls last, guide_record_count desc
      limit $1`,
    params,
  );

  return {
    type: "FeatureCollection",
    features: rows.rows.map((row) => {
      const vegetation = topEntries(normalizeCountMap(row.vegetation_counts), 8);
      const landform = topEntries(normalizeCountMap(row.landform_counts), 8);
      const structure = topEntries(normalizeCountMap(row.structure_counts), 8);
      const sound = topEntries(normalizeCountMap(row.sound_counts), 8);
      const dominant = [
        ["vegetation", vegetation.reduce((sum, item) => sum + item.count, 0)] as const,
        ["landform", landform.reduce((sum, item) => sum + item.count, 0)] as const,
        ["structure", structure.reduce((sum, item) => sum + item.count, 0)] as const,
        ["sound", sound.reduce((sum, item) => sum + item.count, 0)] as const,
      ].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "structure";
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [row.center_lng, row.center_lat] },
        properties: {
          meshKey: row.mesh_key,
          gridSizeM: 100,
          guideRecordCount: row.guide_record_count,
          contributorCount: row.contributor_count,
          dominantType: dominant,
          vegetation,
          landform,
          structure,
          sound,
          firstSeenAt: row.first_seen_at,
          lastSeenAt: row.last_seen_at,
        },
      };
    }),
  };
}
