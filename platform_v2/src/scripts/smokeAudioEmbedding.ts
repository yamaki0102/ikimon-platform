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

const EMBEDDING_DIM = 1280;

function parseArgs(argv: string[]): SmokeOptions {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}${String(now.getUTCSeconds()).padStart(2, "0")}`;

  const options: SmokeOptions = {
    baseUrl: process.env.V2_BASE_URL ?? "http://127.0.0.1:3200",
    fixturePrefix: `audio-embedding-smoke-${stamp}`,
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
  if (!isRecord(value)) throw new Error(message);
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
  return { payload, headers: response.headers, status: response.status };
}

async function postJson(url: string, payload: unknown, headers?: HeadersInit): Promise<JsonResponse> {
  return requestJson(url, { method: "POST", headers, body: JSON.stringify(payload) });
}

async function getJson(url: string, headers?: HeadersInit): Promise<JsonResponse> {
  return requestJson(url, { method: "GET", headers });
}

function privilegedHeaders(options: SmokeOptions): HeadersInit {
  if (!options.privilegedWriteApiKey) {
    throw new Error("V2_PRIVILEGED_WRITE_API_KEY is required for smoke:audio-embedding");
  }
  return { "x-ikimon-write-key": options.privilegedWriteApiKey };
}

function withSessionCookie(cookie: string): HeadersInit | undefined {
  return cookie ? { cookie } : undefined;
}

async function loadFixtureBase64(): Promise<string> {
  const currentFile = fileURLToPath(import.meta.url);
  const fixturePath = path.resolve(path.dirname(currentFile), "fixtures/audio/clean-tone.webm");
  const fixture = await readFile(fixturePath);
  return fixture.toString("base64");
}

function makeVector(seed: number): number[] {
  const out = new Array<number>(EMBEDDING_DIM);
  let s = seed;
  for (let i = 0; i < EMBEDDING_DIM; i += 1) {
    s = (s * 9301 + 49297) % 233280;
    out[i] = (s / 233280) * 2 - 1;
  }
  return out;
}

function shiftVector(base: number[], delta: number): number[] {
  return base.map((value, index) => (index < 8 ? value + delta : value));
}

async function issueSession(baseUrl: string, userId: string, headers: HeadersInit): Promise<string> {
  const response = await postJson(`${baseUrl}/api/v1/auth/session/issue`, {
    userId,
    ttlHours: 24,
  }, headers);
  const payload = assertRecord(response.payload, "session issue response is not an object");
  if (payload.ok !== true) throw new Error("session issue response missing ok=true");
  const rawCookie = response.headers.get("set-cookie") ?? "";
  const cookie = rawCookie.split(";")[0] ?? "";
  if (!cookie) throw new Error("session issue did not return set-cookie");
  return cookie;
}

async function submitSegment(
  baseUrl: string,
  cookie: string,
  body: Record<string, unknown>,
): Promise<string> {
  const response = await postJson(`${baseUrl}/api/v1/fieldscan/audio/submit`, body, withSessionCookie(cookie));
  const payload = assertRecord(response.payload, "audio submit response is not an object");
  if (payload.ok !== true) throw new Error("audio submit response missing ok=true");
  if (typeof payload.segmentId !== "string") throw new Error("audio submit missing segmentId");
  return payload.segmentId;
}

async function postCallbackWithEmbedding(
  baseUrl: string,
  privileged: HeadersInit,
  segmentId: string,
  vector: number[],
  taxon: string,
): Promise<{ inserted: number; embeddingsInserted: number }> {
  const response = await postJson(
    `${baseUrl}/api/v1/fieldscan/audio/callback`,
    {
      segmentId,
      detections: [
        {
          detectedTaxon: taxon,
          scientificName: taxon,
          confidence: 0.85,
          provider: "smoke_perch",
          offsetSec: 0,
          durationSec: 1.2,
          dualAgree: false,
        },
      ],
      embeddings: [
        {
          modelName: "perch_v2",
          modelVersion: "v2",
          frameOffsetSec: 0,
          frameDurationSec: 5.0,
          qualityScore: 0.9,
          vector,
        },
      ],
    },
    privileged,
  );
  const payload = assertRecord(response.payload, "callback response is not an object");
  if (payload.ok !== true) throw new Error("callback response missing ok=true");
  return {
    inserted: Number(payload.inserted ?? 0),
    embeddingsInserted: Number(payload.embeddingsInserted ?? 0),
  };
}

async function getSimilar(
  baseUrl: string,
  privileged: HeadersInit,
  segmentId: string,
): Promise<Array<{ segmentId: string; similarity: number; candidateTaxon: string | null }>> {
  const url = `${baseUrl}/api/v1/fieldscan/audio/segment/${encodeURIComponent(segmentId)}/similar?limit=10`;
  const response = await getJson(url, privileged);
  const payload = assertRecord(response.payload, "similar response is not an object");
  if (payload.ok !== true) throw new Error("similar response missing ok=true");
  if (!Array.isArray(payload.results)) throw new Error("similar response missing results");
  return (payload.results as Array<Record<string, unknown>>).map((row) => ({
    segmentId: String(row.segmentId ?? ""),
    similarity: Number(row.similarity ?? 0),
    candidateTaxon: typeof row.candidateTaxon === "string" ? row.candidateTaxon : null,
  }));
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const baseUrl = options.baseUrl.replace(/\/+$/, "");
  const privileged = privilegedHeaders(options);
  const fixtureBase64 = await loadFixtureBase64();
  const userId = `${options.fixturePrefix}-user`;
  const sessionId = `${options.fixturePrefix}-session`;
  const nowIso = new Date().toISOString();

  await postJson(`${baseUrl}/api/v1/users/upsert`, {
    userId,
    displayName: "Audio Embedding Smoke",
    email: `${userId}@example.invalid`,
    roleName: "Observer",
    rankLabel: "観察者",
    authProvider: "smoke",
    banned: false,
  }, privileged);

  const cookie = await issueSession(baseUrl, userId, privileged);

  const baseVector = makeVector(42);
  const nearVector = shiftVector(baseVector, 0.001);
  const farVector = makeVector(9999);

  const submitBody = (externalSuffix: string, fingerprintSeed: number): Record<string, unknown> => ({
    externalId: `${options.fixturePrefix}-${externalSuffix}`,
    sessionId,
    recordedAt: nowIso,
    durationSec: 1.2,
    lat: 34.7116,
    lng: 137.7274,
    filename: `${externalSuffix}.webm`,
    mimeType: "audio/webm;codecs=opus",
    base64Data: fixtureBase64,
    meta: {
      captureProfile: "opus_mono_24khz_32kbps_2s",
      audioFingerprint: {
        version: "v1",
        frameCount: 8,
        peakHz: 3200 + fingerprintSeed,
        centroidHz: 2800,
        rolloffHz: 4200,
        energy: 0.4,
        voiceBandRatio: 0.05,
        bandEnergies: [0.05, 0.2, 0.7, 0.05],
      },
      clientVadResult: {
        speechLikely: false,
        confidence: 0.99,
        reason: "smoke_clear",
        voiceBandRatio: 0.05,
        energy: 0.4,
      },
    },
  });

  const seedSegmentId = await submitSegment(baseUrl, cookie, submitBody("seed", 0));
  const nearSegmentId = await submitSegment(baseUrl, cookie, submitBody("near", 1));
  const farSegmentId = await submitSegment(baseUrl, cookie, submitBody("far", 2));

  const seedCallback = await postCallbackWithEmbedding(baseUrl, privileged, seedSegmentId, baseVector, "Pycnonotus sinensis");
  if (seedCallback.embeddingsInserted !== 1) {
    throw new Error(`seed callback embeddingsInserted mismatch: ${seedCallback.embeddingsInserted}`);
  }
  const nearCallback = await postCallbackWithEmbedding(baseUrl, privileged, nearSegmentId, nearVector, "Pycnonotus sinensis");
  if (nearCallback.embeddingsInserted !== 1) {
    throw new Error(`near callback embeddingsInserted mismatch: ${nearCallback.embeddingsInserted}`);
  }
  const farCallback = await postCallbackWithEmbedding(baseUrl, privileged, farSegmentId, farVector, "Corvus macrorhynchos");
  if (farCallback.embeddingsInserted !== 1) {
    throw new Error(`far callback embeddingsInserted mismatch: ${farCallback.embeddingsInserted}`);
  }

  const results = await getSimilar(baseUrl, privileged, seedSegmentId);
  if (results.length === 0) {
    throw new Error("similar search returned no results");
  }
  const nearMatch = results.find((row) => row.segmentId === nearSegmentId);
  const farMatch = results.find((row) => row.segmentId === farSegmentId);
  if (!nearMatch) {
    throw new Error("similar search did not include near segment");
  }
  if (farMatch && nearMatch.similarity <= farMatch.similarity) {
    throw new Error(`near segment did not rank higher than far segment: near=${nearMatch.similarity}, far=${farMatch.similarity}`);
  }

  console.log(JSON.stringify({
    ok: true,
    baseUrl,
    sessionId,
    seedSegmentId,
    nearSegmentId,
    farSegmentId,
    nearSimilarity: nearMatch.similarity,
    farSimilarity: farMatch?.similarity ?? null,
    resultCount: results.length,
  }, null, 2));
}

void main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : "unknown_audio_embedding_smoke_failure",
  }, null, 2));
  process.exitCode = 1;
});
