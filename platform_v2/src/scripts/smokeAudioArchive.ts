import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type SmokeOptions = {
  baseUrl: string;
  fixturePrefix: string;
  privilegedWriteApiKey: string;
};

type JsonResponse = {
  payload: unknown;
  headers: Headers;
  status: number;
};

type AudioSubmitResponse = {
  ok: true;
  segmentId: string;
  created: boolean;
  privacyStatus: "clean" | "deleted_human_voice" | "pending_voice_check";
};

type SessionRecapPayload = {
  ok: true;
  recap: {
    sessionId: string;
    privacySkippedCount: number;
    soundBundles: Array<{
      bundleId: string;
      representativeSegmentId: string | null;
      candidateTaxon: string | null;
      representativeAudioUrl: string | null;
    }>;
  };
};

function parseArgs(argv: string[]): SmokeOptions {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}`;

  const options: SmokeOptions = {
    baseUrl: process.env.V2_BASE_URL ?? "http://127.0.0.1:3200",
    fixturePrefix: `audio-archive-smoke-${stamp}`,
    privilegedWriteApiKey: process.env.V2_PRIVILEGED_WRITE_API_KEY ?? "",
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
    if (arg.startsWith("--privileged-write-api-key=")) {
      options.privilegedWriteApiKey =
        arg.slice("--privileged-write-api-key=".length).trim() || options.privilegedWriteApiKey;
    }
  }

  return options;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function assertRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(message);
  }
  return value;
}

async function requestJson(url: string, init: RequestInit): Promise<JsonResponse> {
  const response = await fetch(url, {
    ...init,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}: ${JSON.stringify(payload)}`);
  }

  return {
    payload,
    headers: response.headers,
    status: response.status,
  };
}

async function postJson(url: string, payload: unknown, headers?: HeadersInit): Promise<JsonResponse> {
  return requestJson(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
}

async function getJson(url: string, headers?: HeadersInit): Promise<JsonResponse> {
  return requestJson(url, {
    method: "GET",
    headers,
  });
}

async function getBinary(url: string, headers?: HeadersInit): Promise<{ status: number; mimeType: string; bytes: number }> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "*/*",
      ...(headers ?? {}),
    },
  });
  if (!response.ok) {
    const maybeText = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} for ${url}: ${maybeText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  return {
    status: response.status,
    mimeType: response.headers.get("content-type") ?? "",
    bytes: buffer.byteLength,
  };
}

async function getExpected404(url: string, headers?: HeadersInit): Promise<void> {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      accept: "application/json",
      ...(headers ?? {}),
    },
  });
  if (response.status !== 404) {
    const body = await response.text().catch(() => "");
    throw new Error(`Expected 404 for ${url}, got ${response.status}: ${body}`);
  }
}

function privilegedHeaders(options: SmokeOptions): HeadersInit {
  if (!options.privilegedWriteApiKey) {
    throw new Error("V2_PRIVILEGED_WRITE_API_KEY is required for smoke:audio-archive");
  }
  return { "x-ikimon-write-key": options.privilegedWriteApiKey };
}

function withSessionCookie(cookie: string): HeadersInit | undefined {
  return cookie ? { cookie } : undefined;
}

function expectAudioSubmit(payload: unknown, expectedPrivacyStatus: "clean" | "deleted_human_voice"): AudioSubmitResponse {
  const record = assertRecord(payload, "audio submit response is not an object");
  if (record.ok !== true) {
    throw new Error("audio submit response missing ok=true");
  }
  if (typeof record.segmentId !== "string" || record.segmentId === "") {
    throw new Error("audio submit response missing segmentId");
  }
  if (record.privacyStatus !== expectedPrivacyStatus) {
    throw new Error(`audio submit privacyStatus mismatch: expected ${expectedPrivacyStatus}, got ${String(record.privacyStatus)}`);
  }
  return record as unknown as AudioSubmitResponse;
}

function expectSessionRecap(payload: unknown): SessionRecapPayload["recap"] {
  const record = assertRecord(payload, "recap response is not an object");
  if (record.ok !== true) {
    throw new Error("recap response missing ok=true");
  }
  const recap = assertRecord(record.recap, "recap payload missing recap");
  if (!Array.isArray(recap.soundBundles)) {
    throw new Error("recap payload missing soundBundles");
  }
  return recap as unknown as SessionRecapPayload["recap"];
}

function expectDetectionCallback(payload: unknown): { inserted: number; skipped: number } {
  const record = assertRecord(payload, "detection callback response is not an object");
  if (record.ok !== true) {
    throw new Error("detection callback response missing ok=true");
  }
  if (typeof record.inserted !== "number" || typeof record.skipped !== "number") {
    throw new Error("detection callback response missing inserted/skipped");
  }
  return {
    inserted: record.inserted,
    skipped: record.skipped,
  };
}

function expectPrivacyCallback(payload: unknown): { privacyStatus: string } {
  const record = assertRecord(payload, "privacy callback response is not an object");
  if (record.ok !== true || typeof record.privacyStatus !== "string") {
    throw new Error("privacy callback response missing ok=true or privacyStatus");
  }
  return {
    privacyStatus: record.privacyStatus,
  };
}

async function loadFixtureBase64(): Promise<string> {
  const currentFile = fileURLToPath(import.meta.url);
  const fixturePath = path.resolve(path.dirname(currentFile), "fixtures/audio/clean-tone.webm");
  const fixture = await readFile(fixturePath);
  return fixture.toString("base64");
}

async function issueSession(baseUrl: string, userId: string, headers: HeadersInit): Promise<string> {
  const response = await postJson(`${baseUrl}/api/v1/auth/session/issue`, {
    userId,
    ttlHours: 24,
  }, headers);

  const payload = assertRecord(response.payload, "session issue response is not an object");
  if (payload.ok !== true) {
    throw new Error("session issue response missing ok=true");
  }
  const session = assertRecord(payload.session, "session issue payload missing session");
  if (session.userId !== userId) {
    throw new Error("session issue returned unexpected user");
  }

  const rawCookie = response.headers.get("set-cookie") ?? "";
  const cookie = rawCookie.split(";")[0] ?? "";
  if (!cookie) {
    throw new Error("session issue did not return set-cookie");
  }
  return cookie;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const privileged = privilegedHeaders(options);
  const fixtureBase64 = await loadFixtureBase64();
  const userId = `${options.fixturePrefix}-user`;
  const cleanSessionId = `${options.fixturePrefix}-clean-session`;
  const speechSessionId = `${options.fixturePrefix}-speech-session`;
  const nowIso = new Date().toISOString();

  await postJson(`${baseUrl}/api/v1/users/upsert`, {
    userId,
    displayName: "Audio Archive Smoke",
    email: `${userId}@example.invalid`,
    roleName: "Observer",
    rankLabel: "観察者",
    authProvider: "smoke",
    banned: false,
  }, privileged);

  const sessionCookie = await issueSession(baseUrl, userId, privileged);

  const cleanSubmit = expectAudioSubmit((await postJson(
    `${baseUrl}/api/v1/fieldscan/audio/submit`,
    {
      externalId: `${options.fixturePrefix}-clean`,
      sessionId: cleanSessionId,
      recordedAt: nowIso,
      durationSec: 1.2,
      lat: 34.7116,
      lng: 137.7274,
      filename: "clean-tone.webm",
      mimeType: "audio/webm;codecs=opus",
      base64Data: fixtureBase64,
      meta: {
        captureProfile: "opus_mono_24khz_32kbps_2s",
        audioFingerprint: {
          version: "v1",
          frameCount: 8,
          peakHz: 3200,
          centroidHz: 2800,
          rolloffHz: 4200,
          energy: 0.44,
          voiceBandRatio: 0.08,
          bandEnergies: [0.08, 0.22, 0.78, 0.16],
        },
        clientVadResult: {
          speechLikely: false,
          confidence: 0.98,
          reason: "smoke_clear",
          voiceBandRatio: 0.08,
          energy: 0.44,
        },
      },
    },
    withSessionCookie(sessionCookie),
  )).payload, "clean");

  const cleanRecapBeforeDetection = expectSessionRecap((await getJson(
    `${baseUrl}/api/v1/fieldscan/session/${encodeURIComponent(cleanSessionId)}/recap`,
    withSessionCookie(sessionCookie),
  )).payload);
  if (cleanRecapBeforeDetection.soundBundles.length < 1) {
    throw new Error("clean recap did not create any sound bundle");
  }
  if (cleanRecapBeforeDetection.privacySkippedCount !== 0) {
    throw new Error(`clean recap privacySkippedCount mismatch: ${cleanRecapBeforeDetection.privacySkippedCount}`);
  }
  const cleanBundle = cleanRecapBeforeDetection.soundBundles.find((bundle) => bundle.representativeSegmentId === cleanSubmit.segmentId)
    ?? cleanRecapBeforeDetection.soundBundles[0];
  if (!cleanBundle) {
    throw new Error("clean recap missing representative bundle");
  }

  const playbackBeforeDelete = await getBinary(
    `${baseUrl}/api/v1/fieldscan/audio/segment/${encodeURIComponent(cleanSubmit.segmentId)}`,
    withSessionCookie(sessionCookie),
  );
  if (!playbackBeforeDelete.mimeType.startsWith("audio/webm")) {
    throw new Error(`unexpected playback mimeType: ${playbackBeforeDelete.mimeType}`);
  }
  if (playbackBeforeDelete.bytes <= 0) {
    throw new Error("playback returned empty audio");
  }

  const detectionResponse = expectDetectionCallback((await postJson(
    `${baseUrl}/api/v1/fieldscan/audio/callback`,
    {
      segmentId: cleanSubmit.segmentId,
      detections: [
        {
          detectedTaxon: "Pycnonotus sinensis",
          scientificName: "Pycnonotus sinensis",
          confidence: 0.91,
          provider: "smoke_perch",
          offsetSec: 0,
          durationSec: 1.2,
          dualAgree: true,
        },
      ],
    },
    privileged,
  )).payload);
  if (detectionResponse.inserted !== 1 || detectionResponse.skipped !== 0) {
    throw new Error(`unexpected detection callback response: ${JSON.stringify(detectionResponse)}`);
  }

  const cleanRecapAfterDetection = expectSessionRecap((await getJson(
    `${baseUrl}/api/v1/fieldscan/session/${encodeURIComponent(cleanSessionId)}/recap`,
    withSessionCookie(sessionCookie),
  )).payload);
  const detectedBundle = cleanRecapAfterDetection.soundBundles.find((bundle) => bundle.representativeSegmentId === cleanSubmit.segmentId)
    ?? cleanRecapAfterDetection.soundBundles[0];
  if (!detectedBundle || detectedBundle.candidateTaxon !== "Pycnonotus sinensis") {
    throw new Error("bundle did not retain candidate taxon after detection callback");
  }

  const privacyDeleteResponse = expectPrivacyCallback((await postJson(
    `${baseUrl}/api/v1/fieldscan/audio/privacy-callback`,
    {
      segmentId: cleanSubmit.segmentId,
      decision: "deleted_human_voice",
      reason: "smoke_delete_after_detection",
      confidence: 0.99,
    },
    privileged,
  )).payload);
  if (privacyDeleteResponse.privacyStatus !== "deleted_human_voice") {
    throw new Error(`unexpected privacy callback response: ${JSON.stringify(privacyDeleteResponse)}`);
  }

  const cleanRecapAfterDelete = expectSessionRecap((await getJson(
    `${baseUrl}/api/v1/fieldscan/session/${encodeURIComponent(cleanSessionId)}/recap`,
    withSessionCookie(sessionCookie),
  )).payload);
  if (cleanRecapAfterDelete.soundBundles.length !== 0) {
    throw new Error("deleted segment still appears in soundBundles");
  }
  if (cleanRecapAfterDelete.privacySkippedCount < 1) {
    throw new Error("deleted segment did not increase privacySkippedCount");
  }

  await getExpected404(
    `${baseUrl}/api/v1/fieldscan/audio/segment/${encodeURIComponent(cleanSubmit.segmentId)}`,
    withSessionCookie(sessionCookie),
  );

  const detectionAfterDelete = expectDetectionCallback((await postJson(
    `${baseUrl}/api/v1/fieldscan/audio/callback`,
    {
      segmentId: cleanSubmit.segmentId,
      detections: [
        {
          detectedTaxon: "Corvus macrorhynchos",
          scientificName: "Corvus macrorhynchos",
          confidence: 0.82,
          provider: "smoke_perch",
          offsetSec: 0,
          durationSec: 1.2,
          dualAgree: false,
        },
      ],
    },
    privileged,
  )).payload);
  if (detectionAfterDelete.inserted !== 0 || detectionAfterDelete.skipped < 1) {
    throw new Error(`deleted segment unexpectedly accepted detections: ${JSON.stringify(detectionAfterDelete)}`);
  }

  const speechSubmit = expectAudioSubmit((await postJson(
    `${baseUrl}/api/v1/fieldscan/audio/submit`,
    {
      externalId: `${options.fixturePrefix}-speech`,
      sessionId: speechSessionId,
      recordedAt: nowIso,
      durationSec: 1.2,
      lat: 34.7116,
      lng: 137.7274,
      filename: "speech-flagged.webm",
      mimeType: "audio/webm;codecs=opus",
      base64Data: fixtureBase64,
      meta: {
        captureProfile: "opus_mono_24khz_32kbps_2s",
        audioFingerprint: {
          version: "v1",
          frameCount: 8,
          peakHz: 980,
          centroidHz: 1400,
          rolloffHz: 2400,
          energy: 0.32,
          voiceBandRatio: 0.82,
          bandEnergies: [0.22, 0.84, 0.31, 0.04],
        },
        clientVadResult: {
          speechLikely: true,
          confidence: 0.99,
          reason: "smoke_speech",
          voiceBandRatio: 0.82,
          energy: 0.32,
        },
      },
    },
    withSessionCookie(sessionCookie),
  )).payload, "deleted_human_voice");

  const speechRecap = expectSessionRecap((await getJson(
    `${baseUrl}/api/v1/fieldscan/session/${encodeURIComponent(speechSessionId)}/recap`,
    withSessionCookie(sessionCookie),
  )).payload);
  if (speechRecap.soundBundles.length !== 0) {
    throw new Error("speech-flagged recap unexpectedly created sound bundles");
  }
  if (speechRecap.privacySkippedCount < 1) {
    throw new Error("speech-flagged recap did not count privacy-skipped audio");
  }

  await getExpected404(
    `${baseUrl}/api/v1/fieldscan/audio/segment/${encodeURIComponent(speechSubmit.segmentId)}`,
    withSessionCookie(sessionCookie),
  );

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    cleanSessionId,
    speechSessionId,
    cleanSegmentId: cleanSubmit.segmentId,
    speechSegmentId: speechSubmit.segmentId,
  }, null, 2));
}

void main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : "unknown_audio_archive_smoke_failure",
  }, null, 2));
  process.exitCode = 1;
});
