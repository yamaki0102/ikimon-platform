import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const TINY_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK8QAAAAASUVORK5CYII=";
const args = new Map(process.argv.slice(2).map((item) => {
  const [key, ...rest] = item.split("=");
  return [key, rest.join("=") || "true"];
}));
const execute = args.get("--execute") === "true";
const baseUrl = String(args.get("--base-url") || process.env.STAGING_BASE_URL || "https://staging.zukan.earth").replace(/\/$/, "");
const durationSeconds = Number(args.get("--duration-seconds") || 600);
const evidencePath = String(args.get("--evidence") || "").trim();
const writeKey = String(process.env.V2_PRIVILEGED_WRITE_API_KEY || "").trim();
const basicUser = String(process.env.STAGING_BASIC_AUTH_USER || "").trim();
const basicPass = String(process.env.STAGING_BASIC_AUTH_PASS || "").trim();

function assertTargetGuard() {
  const url = new URL(baseUrl);
  const allowLocal = process.env.RENRI_LOAD_ALLOW_LOCAL === "1" && ["localhost", "127.0.0.1"].includes(url.hostname);
  if (url.protocol !== "https:" && !allowLocal) throw new Error("https_staging_target_required");
  if (url.hostname === "ikimon.life" || url.hostname === "www.ikimon.life") throw new Error("production_target_forbidden");
  if (!["staging.zukan.earth", "staging.ikimon.life"].includes(url.hostname) && !allowLocal) throw new Error("staging_target_required");
  if (!Number.isFinite(durationSeconds) || durationSeconds < 1 || durationSeconds > 900) throw new Error("invalid_duration_seconds");
  if (execute && durationSeconds < 600 && process.env.RENRI_LOAD_ALLOW_SHORT !== "1") {
    throw new Error("execute_requires_600_seconds");
  }
  if (execute && !writeKey) throw new Error("V2_PRIVILEGED_WRITE_API_KEY_required");
}

function fixturePrefix() {
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return `renri-e2e-load-${stamp}-${randomUUID().slice(0, 8)}`;
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] || 0;
}

function cookieHeader(response) {
  const values = typeof response.headers.getSetCookie === "function" ? response.headers.getSetCookie() : [];
  const raw = values[0] || response.headers.get("set-cookie") || "";
  return raw.split(";", 1)[0] || "";
}

function commonHeaders(extra = {}) {
  const headers = { accept: "application/json", ...extra };
  if (basicUser && basicPass) headers.authorization = `Basic ${Buffer.from(`${basicUser}:${basicPass}`).toString("base64")}`;
  return headers;
}

async function jsonFetch(route, options = {}, metrics = null, metricName = route) {
  const started = performance.now();
  let response;
  try {
    response = await fetch(`${baseUrl}${route}`, {
      ...options,
      headers: commonHeaders(options.headers || {}),
      signal: AbortSignal.timeout(30_000),
    });
  } finally {
    if (metrics) metrics.push({ name: metricName, durationMs: Math.round(performance.now() - started), status: response?.status || 0 });
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${metricName}_failed_${response.status}_${String(payload.error || "unknown")}`);
  return { response, payload };
}

async function issueSession(prefix, index, metrics) {
  const userId = `${prefix}-participant-${String(index + 1).padStart(2, "0")}`;
  const { response } = await jsonFetch("/api/v1/auth/session/issue", {
    method: "POST",
    headers: { "content-type": "application/json", "x-ikimon-write-key": writeKey },
    body: JSON.stringify({ userId, displayName: `負荷試験家族${index + 1}`, ttlHours: 2 }),
  }, metrics, "session_issue");
  const cookie = cookieHeader(response);
  if (!cookie) throw new Error("session_cookie_missing");
  return { userId, cookie };
}

async function createEvent(prefix, organizerCookie, metrics) {
  const code = `RL${Date.now().toString(36).toUpperCase()}`.slice(0, 14);
  const { payload } = await jsonFetch("/api/v1/observation-events", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: baseUrl,
      cookie: organizerCookie,
    },
    body: JSON.stringify({
      event_code: code,
      title: `連理負荷試験 ${prefix}`,
      started_at: new Date(Date.now() - 60_000).toISOString(),
      field_id: "aikan-renri-ikan-hq",
      plan: "community",
      primary_mode: "discovery",
      active_modes: ["discovery", "rally"],
      config: { qa_fixture: true, fixture_prefix: prefix, public_list_visibility: "hidden" },
    }),
  }, metrics, "event_create");
  const sessionId = payload.sessionId || payload.session_id;
  const eventCode = payload.eventCode || payload.event_code || code;
  if (!sessionId) throw new Error("event_session_id_missing");
  return { sessionId, eventCode };
}

async function inventory(prefix, action, metrics) {
  const { payload } = await jsonFetch(`/api/v1/ops/staging/renri-fixtures/${action}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-ikimon-write-key": writeKey },
    body: JSON.stringify({ fixturePrefix: prefix }),
  }, metrics, `fixture_${action}`);
  return payload.inventory || {};
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  assertTargetGuard();
  const plan = {
    target: baseUrl,
    execute,
    participantSessions: 20,
    liveViewers: 20,
    photoPosts: 40,
    durationSeconds,
    thresholds: { successRate: 1, max429: 0, max5xx: 0, checkinP95Ms: 2_000, photoPostP95Ms: 8_000 },
    productionMutation: false,
  };
  if (!execute) {
    process.stdout.write(`${JSON.stringify({ ok: true, mode: "dry-run", plan }, null, 2)}\n`);
    return;
  }

  const prefix = fixturePrefix();
  const metrics = [];
  const startedAt = new Date().toISOString();
  let cleanupInventory = null;
  let primaryError = null;
  const result = { ok: false, plan, prefix, startedAt };
  try {
    const initialInventory = await inventory(prefix, "inventory", metrics);
    if (!Object.values(initialInventory).every((count) => Number(count) === 0)) throw new Error("fixture_prefix_not_empty");

    const organizer = await issueSession(`${prefix}-organizer`, 0, metrics);
    const event = await createEvent(prefix, organizer.cookie, metrics);
    const participants = await Promise.all(Array.from({ length: 20 }, (_, index) => issueSession(prefix, index, metrics)));

    const checkins = await Promise.all(participants.map(async (participant, index) => {
      const { payload } = await jsonFetch(`/api/v1/observation-events/${encodeURIComponent(event.sessionId)}/checkin`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: baseUrl, cookie: participant.cookie },
        body: JSON.stringify({ display_name: `負荷試験家族${index + 1}`, share_location: false, is_minor: false }),
      }, metrics, "checkin");
      return payload.participant?.participantId || payload.participant?.participant_id;
    }));
    if (new Set(checkins).size !== 20 || checkins.some((id) => !id)) throw new Error("checkin_duplicate_or_missing");

    const duplicate = await jsonFetch(`/api/v1/observation-events/${encodeURIComponent(event.sessionId)}/checkin`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie: participants[0].cookie },
      body: JSON.stringify({ display_name: "負荷試験家族1", share_location: false, is_minor: false }),
    }, metrics, "checkin_retry");
    const duplicateId = duplicate.payload.participant?.participantId || duplicate.payload.participant?.participant_id;
    if (duplicateId !== checkins[0]) throw new Error("checkin_retry_not_idempotent");

    const intervalMs = (durationSeconds * 1000) / 40;
    const postStartedAt = performance.now();
    const observationIds = [];
    let firstObservationPayload = null;
    for (let index = 0; index < 40; index += 1) {
      const scheduledAt = postStartedAt + intervalMs * index;
      const waitMs = scheduledAt - performance.now();
      if (waitMs > 0) await sleep(waitMs);
      const participant = participants[index % 10];
      const observationId = `${prefix}-observation-${String(index + 1).padStart(2, "0")}`;
      const submissionId = `${prefix}-submission-${String(index + 1).padStart(2, "0")}`;
      const postMetricStart = performance.now();
      const observationPayload = {
        observationId,
        clientSubmissionId: submissionId,
        userId: participant.userId,
        observedAt: new Date().toISOString(),
        latitude: 34.8,
        longitude: 137.733333,
        visibility: "private",
        note: "synthetic load fixture",
        taxon: { vernacularName: "未同定", rank: "unknown" },
        eventCode: event.eventCode,
        eventSessionId: event.sessionId,
        participantRole: "participant",
        sourcePayload: { source: "renri_staging_load_fixture", fixturePrefix: prefix },
      };
      if (index === 0) firstObservationPayload = observationPayload;
      await jsonFetch("/api/v1/observations/upsert", {
        method: "POST",
        headers: { "content-type": "application/json", origin: baseUrl, cookie: participant.cookie },
        body: JSON.stringify(observationPayload),
      }, metrics, "observation_upsert");
      await jsonFetch(`/api/v1/observations/${encodeURIComponent(observationId)}/photos/upload`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: baseUrl, cookie: participant.cookie },
        body: JSON.stringify({
          filename: `${prefix}-${index + 1}.png`,
          mimeType: "image/png",
          base64Data: TINY_PNG_BASE64,
          mediaRole: "primary",
          facePrivacy: "no_faces",
        }),
      }, metrics, "photo_upload");
      metrics.push({ name: "photo_post", durationMs: Math.round(performance.now() - postMetricStart), status: 200 });
      observationIds.push(observationId);
    }

    const repeated = participants[0];
    if (!firstObservationPayload) throw new Error("first_observation_payload_missing");
    await jsonFetch("/api/v1/observations/upsert", {
      method: "POST",
      headers: { "content-type": "application/json", origin: baseUrl, cookie: repeated.cookie },
      body: JSON.stringify(firstObservationPayload),
    }, metrics, "observation_retry");

    await Promise.all(Array.from({ length: 20 }, () => jsonFetch(
      `/api/v1/observation-events/${encodeURIComponent(event.sessionId)}/live`,
      { headers: { cookie: participants[0].cookie } },
      metrics,
      "live_view",
    )));
    const recap = await jsonFetch(
      `/api/v1/observation-events/${encodeURIComponent(event.sessionId)}/recap`,
      { headers: { cookie: participants[0].cookie } },
      metrics,
      "recap",
    );
    const observationCount = Number(recap.payload.highlights?.observationCount || recap.payload.highlights?.observation_count || 0);
    if (observationCount !== 40) throw new Error(`recap_observation_count_${observationCount}`);

    const statuses = metrics.map((item) => item.status).filter(Boolean);
    const checkinDurations = metrics.filter((item) => item.name === "checkin").map((item) => item.durationMs);
    const postDurations = metrics.filter((item) => item.name === "photo_post").map((item) => item.durationMs);
    const summary = {
      requests: statuses.length,
      successful: statuses.filter((status) => status >= 200 && status < 400).length,
      rate429: statuses.filter((status) => status === 429).length,
      rate5xx: statuses.filter((status) => status >= 500).length,
      checkinP95Ms: percentile(checkinDurations, 0.95),
      photoPostP95Ms: percentile(postDurations, 0.95),
      participantCount: new Set(checkins).size,
      observationCount,
    };
    const successRate = summary.successful / Math.max(1, summary.requests);
    result.summary = summary;
    result.ok = successRate === 1 && summary.rate429 === 0 && summary.rate5xx === 0 &&
      summary.checkinP95Ms <= plan.thresholds.checkinP95Ms &&
      summary.photoPostP95Ms <= plan.thresholds.photoPostP95Ms;
    if (!result.ok) throw new Error("load_threshold_failed");
  } catch (error) {
    primaryError = error;
    result.error = error instanceof Error ? error.message : String(error);
  } finally {
    try {
      cleanupInventory = await inventory(prefix, "cleanup", metrics);
      result.cleanupInventory = cleanupInventory;
      result.cleanupZero = Object.values(cleanupInventory).every((count) => Number(count) === 0);
    } catch (cleanupError) {
      result.cleanupZero = false;
      result.cleanupError = cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
    }
    result.finishedAt = new Date().toISOString();
    result.metrics = metrics;
    result.ok = Boolean(result.ok && result.cleanupZero);
    if (evidencePath) {
      await mkdir(path.dirname(path.resolve(evidencePath)), { recursive: true });
      await writeFile(path.resolve(evidencePath), `${JSON.stringify(result, null, 2)}\n`, "utf8");
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
  if (primaryError || !result.ok) process.exitCode = 1;
}

await main();
