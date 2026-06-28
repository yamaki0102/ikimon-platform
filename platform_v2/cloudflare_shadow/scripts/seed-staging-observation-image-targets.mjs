import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const requiredApproval = "APPROVE_IKIMON_CF_STAGING_WORKER_DEPLOY";
const stagingObservationDb = "ikimon_shadow_observations_2026_06";
const stagingBucket = "ikimon-shadow-media";
const targetIds = [
  "record-1781252770584",
  "record-1780982506049",
  "record-1780970378665"
];
const videoRegressionRecordSpecs = [
  {
    visitId: "record-1778829649026",
    observedAt: "2026-05-15T07:20:00.000Z",
    displayName: "カワラヒワ",
    cellId: "cell:34.81,137.73",
    sourceImageTargetIndex: 0,
    seedKind: "video_regression"
  },
  {
    visitId: "record-1778829649026-near-a",
    observedAt: "2026-05-15T07:25:00.000Z",
    displayName: "セイヨウタンポポ",
    cellId: "cell:34.81,137.73",
    sourceImageTargetIndex: 1,
    seedKind: "video_regression_nearby"
  },
  {
    visitId: "record-1778829649026-near-b",
    observedAt: "2026-05-15T07:27:00.000Z",
    displayName: "スズメ",
    cellId: "cell:34.81,137.73",
    sourceImageTargetIndex: 2,
    seedKind: "video_regression_nearby"
  }
];
const targetThumbPaths = {
  "record-1781252770584": [
    "/thumb/lg/v2-observations/record-1781252770584/ikimon-photo-1781252749798-631bef1d7e7c.jpg",
    "/thumb/sm/v2-observations/record-1781252770584/ikimon-photo-1781252749798-631bef1d7e7c.jpg",
    "/thumb/lg/v2-observations/record-1781252770584/ikimon-photo-1781252756096-1bd8bf2769f3.jpg",
    "/thumb/sm/v2-observations/record-1781252770584/ikimon-photo-1781252756096-1bd8bf2769f3.jpg",
    "/thumb/lg/v2-observations/record-1781252770584/ikimon-photo-1781252768025-909c7e6310ae.jpg",
    "/thumb/sm/v2-observations/record-1781252770584/ikimon-photo-1781252768025-909c7e6310ae.jpg",
    "/thumb/sm/v2-observations/record-1779005636197/ikimon-photo-1779005589177-a2b46533bedd.jpg"
  ],
  "record-1780982506049": [
    "/thumb/lg/v2-observations/record-1780982506049/ikimon-photo-1780982481796-b8dd5185edb9.jpg",
    "/thumb/sm/v2-observations/record-1780982506049/ikimon-photo-1780982481796-b8dd5185edb9.jpg",
    "/thumb/lg/v2-observations/record-1780982506049/ikimon-photo-1780982496061-e2527e63bfdc.jpg",
    "/thumb/sm/v2-observations/record-1780982506049/ikimon-photo-1780982496061-e2527e63bfdc.jpg",
    "/thumb/lg/v2-observations/record-1780982506049/ikimon-photo-1780982504695-fcac8136e77f.jpg",
    "/thumb/sm/v2-observations/record-1780982506049/ikimon-photo-1780982504695-fcac8136e77f.jpg"
  ],
  "record-1780970378665": [
    "/thumb/lg/v2-observations/record-1780970378665/ikimon-photo-1780970363543-cbb7b0c7dabc.jpg",
    "/thumb/sm/v2-observations/record-1780970378665/ikimon-photo-1780970363543-cbb7b0c7dabc.jpg",
    "/thumb/lg/v2-observations/record-1780970378665/ikimon-photo-1780970369866-d253aaa48077.jpg",
    "/thumb/sm/v2-observations/record-1780970378665/ikimon-photo-1780970369866-d253aaa48077.jpg",
    "/thumb/lg/v2-observations/record-1780970378665/ikimon-photo-1780970375648-6efa850bbc90.jpg",
    "/thumb/sm/v2-observations/record-1780970378665/ikimon-photo-1780970375648-6efa850bbc90.jpg"
  ]
};

const allowedArgs = new Set(["--execute", "--approval", "--output"]);
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  const key = process.argv[index];
  const value = process.argv[index + 1];
  if (!key.startsWith("--")) throw new Error(`Unexpected argument: ${key}`);
  if (!allowedArgs.has(key)) throw new Error(`Unknown seed argument: ${key}`);
  args.set(key, value && !value.startsWith("--") ? value : "true");
  if (value && !value.startsWith("--")) index += 1;
}

const execute = args.get("--execute") === "true";
const approval = args.get("--approval") ?? process.env.IKIMON_CF_STAGING_DEPLOY_APPROVAL ?? "";
const outputPath = args.get("--output") ?? "";
const sourceBase = (process.env.OBSERVATION_IMAGE_TARGET_SOURCE_BASE ?? "https://ikimon.life").replace(/\/+$/, "");

if (execute && approval !== requiredApproval) {
  throw new Error(`Refusing staging D1 seed. Pass --approval ${requiredApproval}.`);
}

function sqlString(value) {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(Math.trunc(parsed)) : "0";
}

function publicCellFromCellId(cellId) {
  const value = String(cellId ?? "");
  return value.startsWith("cell:") ? value.slice("cell:".length) : value;
}

function partitionMonth(observedAt) {
  const match = String(observedAt ?? "").match(/^(\d{4}-\d{2})/);
  return match?.[1] ?? new Date().toISOString().slice(0, 7);
}

function observedYear(observedAt) {
  const match = String(observedAt ?? "").match(/^(\d{4})/);
  return match ? Number(match[1]) : Number(new Date().toISOString().slice(0, 4));
}

function publicDerivativeKey(photoUrl) {
  return String(photoUrl ?? "").replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "");
}

function tempFileNameForKey(key) {
  return key.replace(/[^\w.-]+/g, "__");
}

function originalUiThumbKey(pathname) {
  return `original-ui/thumb/${String(pathname).replace(/^\/thumb\/?/, "")}`;
}

async function copyPublicObjectToR2({ sourcePath, objectKey, tempDir, visitId }) {
  const imageUrl = `${sourceBase}/${String(sourcePath).replace(/^\/+/, "")}`;
  const imageResponse = await fetch(imageUrl, {
    headers: { accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8", "cache-control": "no-store" }
  });
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch source image for ${visitId}: ${imageResponse.status} ${imageUrl}`);
  }
  const contentType = String(imageResponse.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim() || "image/jpeg";
  const bytes = new Uint8Array(await imageResponse.arrayBuffer());
  const imagePath = join(tempDir, tempFileNameForKey(objectKey));
  await writeFile(imagePath, bytes);
  await run("npx", [
    "wrangler",
    "r2",
    "object",
    "put",
    `${stagingBucket}/${objectKey}`,
    "--remote",
    "--file",
    imagePath,
    "--content-type",
    contentType,
    "--cache-control",
    "public,max-age=31536000",
    "--force"
  ]);
  return { visitId, sourcePath, key: objectKey, bytes: bytes.byteLength, contentType };
}

function recordToSql(item) {
  const observationId = String(item.visitId ?? "");
  const isVideoRegression = String(item.seedKind ?? "").startsWith("video_regression");
  const draftId = `${isVideoRegression ? "staging-video-regression" : "staging-image-target"}-${observationId}`;
  const assetId = `${draftId}-photo-1`;
  const observedAt = String(item.observedAt ?? new Date().toISOString());
  const month = partitionMonth(observedAt);
  const publicCell = publicCellFromCellId(item.cellId);
  const photoKey = publicDerivativeKey(item.photoUrl);
  const taxonLabel = item.displayName && item.displayName !== "同定待ち" ? String(item.displayName) : null;
  const note = isVideoRegression
    ? "Cloudflare staging video detail regression target seeded for observation parity E2E."
    : "Cloudflare staging image detail parity target seeded from public map API.";
  const metadata = JSON.stringify({
    source: isVideoRegression ? "staging_fixture" : "public_map_api",
    seeded_for: isVideoRegression ? "observation-video-target-e2e" : "observation-image-target-e2e"
  });

  return `
INSERT INTO observations
  (observation_id, draft_id, owner_user_id, observed_at, taxon_label, note, exact_lat, exact_lng, location_accuracy_m, public_cell, visibility, emergency_hidden, processing_state, partition_month)
VALUES
  (${sqlString(observationId)}, ${sqlString(draftId)}, 'staging-public-readmodel-seed', ${sqlString(observedAt)}, ${sqlString(taxonLabel)}, ${sqlString(note)}, NULL, NULL, NULL, ${sqlString(publicCell)}, 'public', 0, 'accepted', ${sqlString(month)})
ON CONFLICT(observation_id) DO UPDATE SET
  observed_at = excluded.observed_at,
  taxon_label = excluded.taxon_label,
  note = excluded.note,
  public_cell = excluded.public_cell,
  visibility = 'public',
  emergency_hidden = 0,
  processing_state = 'accepted',
  partition_month = excluded.partition_month;

INSERT INTO readmodel_public_observations
  (observation_id, public_cell, observed_at, taxon_label, asset_count, partition_month)
VALUES
  (${sqlString(observationId)}, ${sqlString(publicCell)}, ${sqlString(observedAt)}, ${sqlString(taxonLabel)}, 1, ${sqlString(month)})
ON CONFLICT(observation_id) DO UPDATE SET
  public_cell = excluded.public_cell,
  observed_at = excluded.observed_at,
  taxon_label = excluded.taxon_label,
  asset_count = excluded.asset_count,
  partition_month = excluded.partition_month,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO asset_ledger
  (asset_id, draft_id, observation_id, owner_user_id, object_key, sha256, mime, bytes, width, height, duration_ms, visibility, processing_state, uploaded_at, public_derivative_key, public_derivative_sha256, exif_scrub_state, public_ready_at, public_derivative_verified_at, public_derivative_metadata_json, partition_month)
VALUES
  (${sqlString(assetId)}, ${sqlString(draftId)}, ${sqlString(observationId)}, 'staging-public-readmodel-seed', ${sqlString(photoKey)}, NULL, 'image/webp', ${sqlNumber(item.bytes)}, NULL, NULL, NULL, 'public', 'uploaded', CURRENT_TIMESTAMP, ${sqlString(photoKey)}, NULL, 'scrubbed', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ${sqlString(metadata)}, ${sqlString(month)})
ON CONFLICT(asset_id) DO UPDATE SET
  observation_id = excluded.observation_id,
  object_key = excluded.object_key,
  mime = excluded.mime,
  visibility = 'public',
  processing_state = 'uploaded',
  public_derivative_key = excluded.public_derivative_key,
  exif_scrub_state = 'scrubbed',
  public_ready_at = CURRENT_TIMESTAMP,
  public_derivative_verified_at = CURRENT_TIMESTAMP,
  public_derivative_metadata_json = excluded.public_derivative_metadata_json,
  partition_month = excluded.partition_month;
`;
}

function recordToSnapshotSql(item) {
  const observationId = String(item.visitId ?? "");
  const observedAt = String(item.stagingSnapshotObservedAt ?? item.observedAt ?? new Date().toISOString());
  const publicCell = publicCellFromCellId(item.cellId);
  const displayName = item.displayName && item.displayName !== "同定待ち" ? String(item.displayName) : "同定待ち";
  return `
INSERT INTO public_map_snapshot_records_v1
  (snapshot_key, occurrence_id, visit_id, observed_at, observed_year, taxon_group, display_name, is_ai_candidate, is_awaiting_id, locality_label, locality_scope, municipality, prefecture, photo_url, source_kind, session_mode, visit_mode, quality_grade, public_coord_mode, public_coord_reason, cell_1000, cell_3000, cell_10000, asset_count)
VALUES
  ('public-map:v1:global', ${sqlString(`occ:${observationId}:0`)}, ${sqlString(observationId)}, ${sqlString(observedAt)}, ${sqlNumber(observedYear(observedAt))}, 'other', ${sqlString(displayName)}, 0, 1, '位置をぼかしています', 'blurred', NULL, NULL, ${sqlString(item.photoUrl)}, 'staging_fixture', 'single', 'observation', 'research', 'cell', 'staging_image_target_seed', ${sqlString(publicCell)}, ${sqlString(publicCell)}, ${sqlString(publicCell)}, 1)
ON CONFLICT(snapshot_key, occurrence_id) DO UPDATE SET
  visit_id = excluded.visit_id,
  observed_at = excluded.observed_at,
  observed_year = excluded.observed_year,
  display_name = excluded.display_name,
  is_awaiting_id = excluded.is_awaiting_id,
  photo_url = excluded.photo_url,
  cell_1000 = excluded.cell_1000,
  cell_3000 = excluded.cell_3000,
  cell_10000 = excluded.cell_10000,
  asset_count = excluded.asset_count;
`;
}

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const quoteWindowsArg = (value) => {
      const raw = String(value);
      if (!/[ \t&()^%!"]/u.test(raw)) return raw;
      return `"${raw.replaceAll('"', '""')}"`;
    };
    const executable = process.platform === "win32" ? "cmd.exe" : command;
    const argsForSpawn = process.platform === "win32"
      ? ["/d", "/c", [command, ...commandArgs.map(quoteWindowsArg)].join(" ")]
      : commandArgs;
    const child = spawn(executable, argsForSpawn, {
      cwd: process.cwd(),
      stdio: ["ignore", "pipe", "pipe"],
      ...options
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(chunk);
    });
    child.on("close", (code) => {
      const event = {
        command: [command, ...commandArgs].join(" "),
        exitCode: code,
        durationMs: Date.now() - startedAt
      };
      if (code === 0) resolve({ stdout, stderr, event });
      else reject(new Error(`${event.command} failed with exit code ${code}`));
    });
  });
}

const url = `${sourceBase}/api/v1/map/observations?bbox=122.9,24.0,146.0,45.6&zoom=6&limit=1500`;
const response = await fetch(url, { headers: { accept: "application/json", "cache-control": "no-store" } });
if (!response.ok) {
  throw new Error(`Failed to fetch public map observations: ${response.status}`);
}
const payload = await response.json();
const items = Array.isArray(payload.items) ? payload.items : [];
const selected = targetIds.map((id) => items.find((item) => item?.visitId === id));
const missing = selected
  .map((item, index) => item ? null : targetIds[index])
  .filter(Boolean);
if (missing.length > 0) {
  throw new Error(`Public map API missing target observations: ${missing.join(", ")}`);
}
for (const item of selected) {
  if (!item.photoUrl) throw new Error(`Target observation has no photoUrl: ${item.visitId}`);
  if (!item.cellId) throw new Error(`Target observation has no cellId: ${item.visitId}`);
}
selected.forEach((item, index) => {
  item.stagingSnapshotObservedAt = `2026-06-29T00:0${index}:00.000Z`;
});
const videoRegressionRecords = videoRegressionRecordSpecs.map((spec) => {
  const source = selected[spec.sourceImageTargetIndex] ?? selected[0];
  if (!source?.photoUrl) throw new Error(`Missing source image for video regression seed: ${spec.visitId}`);
  return {
    ...spec,
    photoUrl: source.photoUrl
  };
});

const sql = `-- Generated by seed-staging-observation-image-targets.mjs
-- Intentionally no BEGIN/COMMIT: wrangler remote D1 execute rejects SQL transaction wrappers.
${[...selected, ...videoRegressionRecords].map(recordToSql).join("\n")}
${selected.map(recordToSnapshotSql).join("\n")}
`;
const summary = {
  ok: true,
  execute,
  source: url,
  database: stagingObservationDb,
  bucket: stagingBucket,
  targetIds,
  videoRegressionTargetIds: videoRegressionRecords.map((item) => item.visitId),
  selected: selected.map((item) => ({
    visitId: item.visitId,
    observedAt: item.observedAt,
    displayName: item.displayName,
    cellId: item.cellId,
    photoUrl: item.photoUrl,
    photoKey: publicDerivativeKey(item.photoUrl)
  }))
};

if (execute) {
  const tempDir = await mkdtemp(join(tmpdir(), "ikimon-staging-image-target-seed-"));
  try {
    const sqlPath = join(tempDir, "seed.sql");
    await writeFile(sqlPath, sql, "utf8");
    await run("npx", ["wrangler", "d1", "execute", stagingObservationDb, "--remote", "--file", sqlPath]);
    summary.sqlBytes = (await readFile(sqlPath)).byteLength;
    const copiedImages = [];
    const copiedThumbs = [];
    for (const item of [...selected, ...videoRegressionRecords]) {
      const key = publicDerivativeKey(item.photoUrl);
      copiedImages.push(await copyPublicObjectToR2({ sourcePath: key, objectKey: key, tempDir, visitId: item.visitId }));
      for (const thumbPath of targetThumbPaths[item.visitId] ?? []) {
        copiedThumbs.push(await copyPublicObjectToR2({
          sourcePath: thumbPath,
          objectKey: originalUiThumbKey(thumbPath),
          tempDir,
          visitId: item.visitId
        }));
      }
    }
    summary.copiedImages = copiedImages;
    summary.copiedThumbs = copiedThumbs;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
} else {
  summary.sql = sql;
}

if (outputPath) {
  await writeFile(outputPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
}
console.log(JSON.stringify(summary, null, 2));
