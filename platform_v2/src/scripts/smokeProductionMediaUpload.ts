import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPool } from "../db.js";
import { loadConfig } from "../config.js";
import { processMediaProcessingJobs } from "../services/mediaProcessingQueue.js";

type SmokeOptions = {
  baseUrl: string;
  fixturePrefix: string;
  logDir: string;
  videoFile: string;
  cleanup: boolean;
  finalizeAttempts: number;
  finalizePollMs: number;
};

type LogLevel = "info" | "warn" | "error";

type SmokeState = {
  startedAt: string;
  status: "running" | "passed" | "failed";
  baseUrl: string;
  fixturePrefix: string;
  logFile: string;
  summaryFile: string;
  userId?: string;
  email?: string;
  observationId?: string;
  visitId?: string;
  occurrenceId?: string;
  photo?: {
    publicUrl?: string;
    relativePath?: string;
  };
  video?: {
    uid?: string;
    readyToStream?: boolean;
    uploadStatus?: string;
    thumbnailUrl?: string;
    watchUrl?: string;
  };
  ai?: {
    mediaJobs?: Array<{ jobType: string; jobStatus: string; attempts: number; lastError: string | null }>;
    aiRunCount?: number;
    assessmentCount?: number;
    candidateCount?: number;
    regionCount?: number;
  };
  cleanup?: Record<string, unknown>;
  error?: string;
};

type JsonResponse = {
  status: number;
  headers: Headers;
  body: unknown;
};

const DEFAULT_BASE_URL = "https://ikimon.life";
const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK8QAAAAASUVORK5CYII=";

function utcStamp(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function parseArgs(argv: string[]): SmokeOptions {
  const fixturePrefix = `prod-media-smoke-${utcStamp()}`;
  const defaultLogDir = path.resolve(process.cwd(), "ops", "reports", "production-media-smoke");
  const options: SmokeOptions = {
    baseUrl: process.env.V2_BASE_URL?.trim() || DEFAULT_BASE_URL,
    fixturePrefix,
    logDir: process.env.SMOKE_LOG_DIR?.trim() || defaultLogDir,
    videoFile: process.env.SMOKE_VIDEO_FILE?.trim() || "",
    cleanup: true,
    finalizeAttempts: 18,
    finalizePollMs: 10_000,
  };

  for (const arg of argv) {
    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length).trim() || options.baseUrl;
      continue;
    }
    if (arg.startsWith("--fixture-prefix=")) {
      options.fixturePrefix = arg.slice("--fixture-prefix=".length).trim() || options.fixturePrefix;
      continue;
    }
    if (arg.startsWith("--log-dir=")) {
      options.logDir = path.resolve(arg.slice("--log-dir=".length).trim() || options.logDir);
      continue;
    }
    if (arg.startsWith("--video-file=")) {
      options.videoFile = path.resolve(arg.slice("--video-file=".length).trim());
      continue;
    }
    if (arg.startsWith("--finalize-attempts=")) {
      const value = Number(arg.slice("--finalize-attempts=".length));
      if (Number.isFinite(value) && value > 0) options.finalizeAttempts = Math.trunc(value);
      continue;
    }
    if (arg.startsWith("--finalize-poll-ms=")) {
      const value = Number(arg.slice("--finalize-poll-ms=".length));
      if (Number.isFinite(value) && value >= 1000) options.finalizePollMs = Math.trunc(value);
      continue;
    }
    if (arg === "--no-cleanup") {
      options.cleanup = false;
    }
  }

  return options;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function publicSummary(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const copy: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (/token|cookie|secret|password|uploadUrl/i.test(key)) {
      copy[key] = "[redacted]";
    } else if (isRecord(raw)) {
      copy[key] = publicSummary(raw);
    } else {
      copy[key] = raw;
    }
  }
  return copy;
}

async function appendLog(logFile: string, level: LogLevel, event: string, fields: Record<string, unknown> = {}): Promise<void> {
  const safeFields = publicSummary(fields) as Record<string, unknown>;
  await writeFile(
    logFile,
    `${JSON.stringify({ ts: new Date().toISOString(), level, event, ...safeFields })}\n`,
    { flag: "a" },
  );
}

async function timed<T>(
  state: SmokeState,
  level: LogLevel,
  event: string,
  fields: Record<string, unknown>,
  action: () => Promise<T>,
): Promise<T> {
  const started = Date.now();
  await appendLog(state.logFile, level, `${event}:start`, fields);
  try {
    const result = await action();
    await appendLog(state.logFile, "info", `${event}:ok`, { ...fields, durationMs: Date.now() - started });
    return result;
  } catch (error) {
    await appendLog(state.logFile, "error", `${event}:failed`, {
      ...fields,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

function joinUrl(baseUrl: string, pathname: string): string {
  return `${baseUrl.replace(/\/+$/, "")}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function cookieFrom(response: Headers): string {
  const raw = response.get("set-cookie") ?? "";
  return raw.split(";", 1)[0] ?? "";
}

async function requestJson(
  state: SmokeState,
  method: string,
  pathname: string,
  payload?: unknown,
  headers: Record<string, string> = {},
): Promise<JsonResponse> {
  const url = joinUrl(state.baseUrl, pathname);
  return timed(state, "info", "http_json", { method, pathname }, async () => {
    const response = await fetch(url, {
      method,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        origin: state.baseUrl,
        ...headers,
      },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    const text = await response.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text.slice(0, 600) };
    }
    await appendLog(state.logFile, "info", "http_json:response", {
      method,
      pathname,
      status: response.status,
      ok: response.ok,
      body: publicSummary(body),
    });
    if (!response.ok || (isRecord(body) && body.ok === false)) {
      throw new Error(`${method} ${pathname} failed with HTTP ${response.status}`);
    }
    return { status: response.status, headers: response.headers, body };
  });
}

async function uploadCloudflareVideo(state: SmokeState, uploadUrl: string, videoFile: string): Promise<number> {
  const bytes = await readFile(videoFile);
  const filename = path.basename(videoFile);
  return timed(state, "info", "cloudflare_upload", { filename, bytes: bytes.byteLength }, async () => {
    const form = new FormData();
    form.append("file", new Blob([bytes], { type: "video/mp4" }), filename);
    const response = await fetch(uploadUrl, { method: "POST", body: form });
    const text = await response.text();
    await appendLog(state.logFile, "info", "cloudflare_upload:response", {
      status: response.status,
      ok: response.ok,
      bodyPreview: text.slice(0, 300),
    });
    if (!response.ok) {
      throw new Error(`cloudflare_upload_failed:${response.status}`);
    }
    return response.status;
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

async function verifyAiState(state: SmokeState): Promise<void> {
  const pool = getPool();
  const visitId = state.visitId ?? "";
  const result = await timed(state, "info", "db_ai_verify", { visitId }, async () => {
    const [jobs, aiRuns, assessments, candidates, regions] = await Promise.all([
      pool.query<{ job_type: string; job_status: string; attempts: number; last_error: string | null }>(
        `select job_type, job_status, attempts, last_error
           from media_processing_jobs
          where observation_id = $1
             or source_payload::text like $2
          order by created_at`,
        [visitId, `%${state.fixturePrefix}%`],
      ),
      pool.query<{ c: string }>(`select count(*)::text as c from observation_ai_runs where visit_id = $1`, [visitId]),
      pool.query<{ c: string }>(`select count(*)::text as c from observation_ai_assessments where visit_id = $1`, [visitId]),
      pool.query<{ c: string }>(`select count(*)::text as c from observation_ai_subject_candidates where visit_id = $1`, [visitId]),
      pool.query<{ c: string }>(
        `select count(*)::text as c
           from subject_media_regions
          where ai_run_id in (select ai_run_id from observation_ai_runs where visit_id = $1)`,
        [visitId],
      ),
    ]);
    return { jobs, aiRuns, assessments, candidates, regions };
  });

  const ai = {
    mediaJobs: result.jobs.rows.map((row) => ({
      jobType: row.job_type,
      jobStatus: row.job_status,
      attempts: Number(row.attempts),
      lastError: row.last_error,
    })),
    aiRunCount: Number(result.aiRuns.rows[0]?.c ?? 0),
    assessmentCount: Number(result.assessments.rows[0]?.c ?? 0),
    candidateCount: Number(result.candidates.rows[0]?.c ?? 0),
    regionCount: Number(result.regions.rows[0]?.c ?? 0),
  };
  state.ai = ai;

  const failedJobs = ai.mediaJobs.filter((job) => job.jobStatus !== "succeeded");
  if (failedJobs.length > 0) {
    throw new Error(`media_jobs_not_succeeded:${JSON.stringify(failedJobs)}`);
  }
  if ((ai.aiRunCount ?? 0) < 2 || (ai.assessmentCount ?? 0) < 2) {
    throw new Error("ai_reassessments_missing");
  }
}

async function drainMediaJobs(state: SmokeState): Promise<void> {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const result = await timed(state, "info", "media_worker", { attempt }, () => processMediaProcessingJobs(10, 60));
    await appendLog(state.logFile, "info", "media_worker:result", { attempt, result });
    if (result.pending === 0 && result.stalePending === 0) {
      return;
    }
    await sleep(3000);
  }
}

function safeUploadPath(legacyPublicRoot: string, relativePath: string): string {
  const normalized = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolute = path.resolve(legacyPublicRoot, ...normalized.split("/"));
  const uploadsRoot = path.resolve(legacyPublicRoot, "uploads", "v2-observations");
  if (!absolute.startsWith(`${uploadsRoot}${path.sep}`)) {
    throw new Error(`unsafe_upload_cleanup_path:${relativePath}`);
  }
  return absolute;
}

async function deleteCloudflareVideo(state: SmokeState): Promise<void> {
  const uid = state.video?.uid;
  if (!uid) return;
  const cfg = loadConfig().cloudflare;
  if (!cfg) {
    await appendLog(state.logFile, "warn", "cleanup_cloudflare:skipped", { reason: "cloudflare_config_missing", uid });
    return;
  }
  await timed(state, "info", "cleanup_cloudflare", { uid }, async () => {
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(cfg.accountId)}/stream/${encodeURIComponent(uid)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${cfg.streamApiToken}` },
    });
    const text = await response.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { raw: text.slice(0, 300) };
    }
    await appendLog(state.logFile, "info", "cleanup_cloudflare:response", { status: response.status, body });
    if (!response.ok && response.status !== 404) {
      throw new Error(`cloudflare_delete_failed:${response.status}`);
    }
  });
}

async function removeLegacyJson(state: SmokeState): Promise<number> {
  const config = loadConfig();
  const observed = new Date();
  const fileName = `${observed.getFullYear()}-${String(observed.getMonth() + 1).padStart(2, "0")}.json`;
  const filePath = path.join(config.legacyDataRoot, "observations", fileName);
  return timed(state, "info", "cleanup_legacy_json", { filePath }, async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(filePath, "utf8"));
    } catch {
      return 0;
    }
    if (!Array.isArray(parsed)) return 0;
    const next = parsed.filter((row) => !JSON.stringify(row).includes(state.fixturePrefix));
    const removed = parsed.length - next.length;
    if (removed > 0) {
      await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    }
    return removed;
  });
}

async function cleanupDatabaseAndFiles(state: SmokeState): Promise<Record<string, unknown>> {
  const config = loadConfig();
  const pool = getPool();
  const client = await pool.connect();
  const summary: Record<string, unknown> = {};
  try {
    await timed(state, "info", "cleanup_db", { fixturePrefix: state.fixturePrefix }, async () => {
      await client.query("begin");
      const targetUsers = await client.query<{ user_id: string }>(
        `select user_id from users where email = $1 or user_id = $2`,
        [state.email ?? "", state.userId ?? ""],
      );
      if (targetUsers.rows.length !== 1) {
        throw new Error(`cleanup_expected_one_user:${targetUsers.rows.length}`);
      }
      const userIds = targetUsers.rows.map((row) => row.user_id);
      const targetVisits = await client.query<{ visit_id: string; place_id: string | null }>(
        `select visit_id, place_id
           from visits
          where visit_id like $1
             or user_id = any($2::text[])
             or source_payload::text like $3`,
        [`${state.fixturePrefix}%`, userIds, `%${state.fixturePrefix}%`],
      );
      if (targetVisits.rows.length !== 1) {
        throw new Error(`cleanup_expected_one_visit:${targetVisits.rows.length}`);
      }
      const visitIds = targetVisits.rows.map((row) => row.visit_id);
      const placeIds = targetVisits.rows.map((row) => row.place_id).filter((value): value is string => Boolean(value));
      const occurrences = await client.query<{ occurrence_id: string }>(
        `select occurrence_id from occurrences where visit_id = any($1::text[])`,
        [visitIds],
      );
      const occurrenceIds = occurrences.rows.map((row) => row.occurrence_id);
      const assets = await client.query<{ asset_id: string; blob_id: string; legacy_relative_path: string | null; storage_path: string | null }>(
        `select ea.asset_id::text, ea.blob_id::text, ea.legacy_relative_path, ab.storage_path
           from evidence_assets ea
           left join asset_blobs ab on ab.blob_id = ea.blob_id
          where ea.visit_id = any($1::text[])
             or ea.occurrence_id = any($2::text[])`,
        [visitIds, occurrenceIds],
      );
      const assetIds = assets.rows.map((row) => row.asset_id);
      const blobIds = assets.rows.map((row) => row.blob_id).filter(Boolean);
      const storagePaths = assets.rows.flatMap((row) => [row.legacy_relative_path, row.storage_path].filter((value): value is string => Boolean(value)));

      const deleted: Record<string, number> = {};
      const deleteCount = async (name: string, sql: string, params: unknown[]) => {
        const result = await client.query<{ c: string }>(
          `with deleted_rows as (${sql} returning 1) select count(*)::text as c from deleted_rows`,
          params,
        );
        deleted[name] = Number(result.rows[0]?.c ?? 0);
      };

      await deleteCount("mediaJobs", `delete from media_processing_jobs where observation_id = any($1::text[]) or occurrence_id = any($2::text[]) or source_payload::text like $3`, [visitIds, occurrenceIds, `%${state.fixturePrefix}%`]);
      await deleteCount("videoRequests", `delete from video_upload_requests where stream_uid = $1 or actor_id = any($2::text[]) or observation_id = any($3::text[])`, [state.video?.uid ?? "", userIds, visitIds]);
      await deleteCount("compatibilityLedger", `delete from compatibility_write_ledger where canonical_id = any($1::text[]) or details::text like $2`, [visitIds, `%${state.fixturePrefix}%`]);
      await deleteCount("rememberTokens", `delete from remember_tokens where user_id = any($1::text[])`, [userIds]);
      await deleteCount("identifications", `delete from identifications where occurrence_id = any($1::text[]) or actor_user_id = any($2::text[])`, [occurrenceIds, userIds]);
      await deleteCount("reactions", `delete from observation_reactions where occurrence_id = any($1::text[]) or user_id = any($2::text[])`, [occurrenceIds, userIds]);
      await deleteCount("assets", `delete from evidence_assets where asset_id = any($1::uuid[])`, [assetIds]);
      await deleteCount("visits", `delete from visits where visit_id = any($1::text[])`, [visitIds]);
      await deleteCount("blobs", `delete from asset_blobs ab where ab.blob_id = any($1::uuid[]) and not exists (select 1 from evidence_assets ea where ea.blob_id = ab.blob_id)`, [blobIds]);
      await deleteCount("users", `delete from users where user_id = any($1::text[])`, [userIds]);
      await deleteCount("places", `delete from places p where p.place_id = any($1::text[]) and not exists (select 1 from visits v where v.place_id = p.place_id)`, [placeIds]);

      await client.query("commit");
      summary.deleted = deleted;
      summary.storagePaths = storagePaths;

      let deletedFiles = 0;
      for (const storagePath of new Set(storagePaths)) {
        const absolute = safeUploadPath(config.legacyPublicRoot, storagePath);
        await rm(absolute, { force: true });
        deletedFiles += 1;
      }
      const observationDir = path.resolve(config.legacyPublicRoot, "uploads", "v2-observations", state.observationId ?? "");
      if (observationDir.startsWith(path.resolve(config.legacyPublicRoot, "uploads", "v2-observations") + path.sep)) {
        await rm(observationDir, { recursive: true, force: true });
      }
      summary.deletedFiles = deletedFiles;
    });
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // no-op
    }
    throw error;
  } finally {
    client.release();
  }
  summary.legacyJsonRemoved = await removeLegacyJson(state);
  await deleteCloudflareVideo(state);
  return summary;
}

async function writeSummary(state: SmokeState): Promise<void> {
  await writeFile(state.summaryFile, `${JSON.stringify(publicSummary(state), null, 2)}\n`, "utf8");
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.videoFile) {
    throw new Error("SMOKE_VIDEO_FILE or --video-file is required for production media smoke");
  }

  await mkdir(options.logDir, { recursive: true });
  const logFile = path.join(options.logDir, `${options.fixturePrefix}.jsonl`);
  const summaryFile = path.join(options.logDir, `${options.fixturePrefix}.summary.json`);
  const state: SmokeState = {
    startedAt: new Date().toISOString(),
    status: "running",
    baseUrl: options.baseUrl,
    fixturePrefix: options.fixturePrefix,
    logFile,
    summaryFile,
    email: `${options.fixturePrefix}@example.invalid`,
    observationId: `${options.fixturePrefix}-obs`,
  };

  try {
    await appendLog(logFile, "info", "smoke:start", {
      baseUrl: options.baseUrl,
      fixturePrefix: options.fixturePrefix,
      cleanup: options.cleanup,
      videoFile: options.videoFile,
    });

    const videoBytes = (await readFile(options.videoFile)).byteLength;
    const password = `IkimonSmoke${createHash("sha256").update(options.fixturePrefix).digest("hex").slice(0, 16)}!`;
    const register = await requestJson(state, "POST", "/api/v1/auth/register", {
      displayName: `本番メディアテスト ${options.fixturePrefix}`,
      email: state.email,
      password,
      redirect: "/record",
    });
    const cookie = cookieFrom(register.headers);
    if (!cookie || !isRecord(register.body) || !isRecord(register.body.session)) {
      throw new Error("register_session_missing");
    }
    state.userId = stringField(register.body.session.userId);
    if (!state.userId) throw new Error("register_user_missing");

    const observation = await requestJson(state, "POST", "/api/v1/observations/upsert", {
      observationId: state.observationId,
      legacyObservationId: state.observationId,
      userId: state.userId,
      observedAt: new Date().toISOString(),
      latitude: 34.7108,
      longitude: 137.7261,
      prefecture: "Shizuoka",
      municipality: "Hamamatsu",
      localityNote: "prod media smoke test - delete after verification",
      note: "prod media smoke test for photo/video/AI; safe to delete",
      visitMode: "manual",
      completeChecklistFlag: false,
      evidenceTags: ["prod-smoke"],
      substrateTags: ["test"],
      taxon: null,
      sourcePayload: {
        source: "prod_media_smoke",
        prefix: options.fixturePrefix,
        delete_after_verification: true,
      },
    }, { cookie });
    if (!isRecord(observation.body)) throw new Error("observation_response_invalid");
    state.visitId = stringField(observation.body.visitId);
    state.occurrenceId = stringField(observation.body.occurrenceId);
    if (!state.visitId || !state.occurrenceId) throw new Error("observation_ids_missing");

    const photo = await requestJson(state, "POST", `/api/v1/observations/${encodeURIComponent(state.occurrenceId)}/photos/upload`, {
      filename: `${options.fixturePrefix}.png`,
      mimeType: "image/png",
      base64Data: TINY_PNG_BASE64,
      mediaRole: "primary_subject",
    }, { cookie });
    if (isRecord(photo.body)) {
      state.photo = {
        publicUrl: stringField(photo.body.publicUrl),
        relativePath: stringField(photo.body.relativePath),
      };
    }

    const direct = await requestJson(state, "POST", "/api/v1/videos/direct-upload", {
      filename: path.basename(options.videoFile),
      maxDurationSeconds: 60,
      observationId: state.occurrenceId,
      mediaRole: "sound_motion",
      uploadProtocol: "post",
      fileSizeBytes: videoBytes,
    }, { cookie });
    if (!isRecord(direct.body)) throw new Error("video_direct_response_invalid");
    const uploadUrl = stringField(direct.body.uploadUrl);
    state.video = { uid: stringField(direct.body.uid) };
    if (!state.video.uid || !uploadUrl) throw new Error("video_direct_upload_missing");
    await uploadCloudflareVideo(state, uploadUrl, options.videoFile);

    for (let attempt = 1; attempt <= options.finalizeAttempts; attempt += 1) {
      const finalize = await requestJson(state, "POST", `/api/v1/videos/${encodeURIComponent(state.video.uid)}/finalize`, {
        observationId: state.occurrenceId,
        mediaRole: "sound_motion",
      }, { cookie });
      const video = isRecord(finalize.body) && isRecord(finalize.body.video) ? finalize.body.video : {};
      state.video.readyToStream = Boolean(video.readyToStream);
      state.video.uploadStatus = stringField(video.uploadStatus);
      state.video.thumbnailUrl = stringField(video.thumbnailUrl);
      state.video.watchUrl = stringField(video.watchUrl);
      await appendLog(state.logFile, "info", "video_finalize:poll", {
        attempt,
        readyToStream: state.video.readyToStream,
        uploadStatus: state.video.uploadStatus,
      });
      if (state.video.readyToStream) break;
      await sleep(options.finalizePollMs);
    }
    if (!state.video.readyToStream) throw new Error("video_not_ready_after_finalize_poll");

    await requestJson(state, "GET", `/observations/${encodeURIComponent(state.occurrenceId)}`, undefined, {
      accept: "text/html",
      cookie,
    });
    await drainMediaJobs(state);
    await verifyAiState(state);

    if (options.cleanup) {
      state.cleanup = await cleanupDatabaseAndFiles(state);
    } else {
      await appendLog(state.logFile, "warn", "cleanup:skipped", { fixturePrefix: state.fixturePrefix });
    }

    state.status = "passed";
    await appendLog(state.logFile, "info", "smoke:passed");
  } catch (error) {
    state.status = "failed";
    state.error = error instanceof Error ? error.message : String(error);
    await appendLog(logFile, "error", "smoke:failed", { error: state.error });
    process.exitCode = 1;
  } finally {
    await writeSummary(state);
    console.log(JSON.stringify(publicSummary(state), null, 2));
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main();
}
