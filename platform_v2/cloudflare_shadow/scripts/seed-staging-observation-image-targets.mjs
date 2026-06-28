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

function publicDerivativeKey(photoUrl) {
  return String(photoUrl ?? "").replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "");
}

function tempFileNameForKey(key) {
  return key.replace(/[^\w.-]+/g, "__");
}

function recordToSql(item) {
  const observationId = String(item.visitId ?? "");
  const draftId = `staging-image-target-${observationId}`;
  const assetId = `${draftId}-photo-1`;
  const observedAt = String(item.observedAt ?? new Date().toISOString());
  const month = partitionMonth(observedAt);
  const publicCell = publicCellFromCellId(item.cellId);
  const photoKey = publicDerivativeKey(item.photoUrl);
  const taxonLabel = item.displayName && item.displayName !== "同定待ち" ? String(item.displayName) : null;
  const note = "Cloudflare staging image detail parity target seeded from public map API.";
  const metadata = JSON.stringify({ source: "public_map_api", seeded_for: "observation-image-target-e2e" });

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

function run(command, commandArgs, options = {}) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const executable = process.platform === "win32" ? "cmd.exe" : command;
    const argsForSpawn = process.platform === "win32"
      ? ["/d", "/s", "/c", [command, ...commandArgs].map((value) => `"${String(value).replaceAll('"', '""')}"`).join(" ")]
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

const sql = `-- Generated by seed-staging-observation-image-targets.mjs
BEGIN;
${selected.map(recordToSql).join("\n")}
COMMIT;
`;
const summary = {
  ok: true,
  execute,
  source: url,
  database: stagingObservationDb,
  bucket: stagingBucket,
  targetIds,
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
    for (const item of selected) {
      const key = publicDerivativeKey(item.photoUrl);
      const imageUrl = `${sourceBase}/${key}`;
      const imageResponse = await fetch(imageUrl, {
        headers: { accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8", "cache-control": "no-store" }
      });
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch source image for ${item.visitId}: ${imageResponse.status} ${imageUrl}`);
      }
      const contentType = String(imageResponse.headers.get("content-type") ?? "image/webp").split(";")[0].trim() || "image/webp";
      const bytes = new Uint8Array(await imageResponse.arrayBuffer());
      const imagePath = join(tempDir, tempFileNameForKey(key));
      await writeFile(imagePath, bytes);
      await run("npx", [
        "wrangler",
        "r2",
        "object",
        "put",
        `${stagingBucket}/${key}`,
        "--remote",
        "--file",
        imagePath,
        "--content-type",
        contentType,
        "--cache-control",
        "public, max-age=31536000",
        "--force"
      ]);
      copiedImages.push({ visitId: item.visitId, key, bytes: bytes.byteLength, contentType });
    }
    summary.copiedImages = copiedImages;
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
