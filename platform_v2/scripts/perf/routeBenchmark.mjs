import { pathToFileURL } from "node:url";
import { gunzipSync } from "node:zlib";

export const BENCHMARK_CASES = [
  { name: "home", url: "/", expectedStatus: 200, expectedContent: "ZUKAN" },
  { name: "map", url: "/map?tab=places&lng=137.7279&lat=34.7121&z=13", expectedStatus: 200, expectedContent: "me-map-wrap" },
  { name: "observation-detail", url: "/observations/z3-perf-visit", expectedStatus: 200, expectedContent: "モンシロチョウ" },
  { name: "species-detail", url: "/learn/invasive-species/coreopsis-lanceolata", expectedStatus: 200, expectedContent: "オオキンケイギク" },
];

export function percentile(values, fraction) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index];
}

export function summarizeSamples(samples) {
  const renderDurations = samples.map((sample) => sample.serverRenderMs);
  const materializationDurations = samples.map((sample) => sample.materializationMs);
  const bytes = samples.map((sample) => sample.payloadBytes);
  const wireBytes = samples.map((sample) => sample.wireBytes);
  const sqlCalls = samples.map((sample) => sample.sqlCalls);
  const p50PayloadBytes = percentile(bytes, 0.5);
  const p95PayloadBytes = percentile(bytes, 0.95);
  return {
    samples: samples.length,
    p50ServerRenderMs: percentile(renderDurations, 0.5),
    p95ServerRenderMs: percentile(renderDurations, 0.95),
    p50MaterializationMs: percentile(materializationDurations, 0.5),
    p95MaterializationMs: percentile(materializationDurations, 0.95),
    p50PayloadBytes,
    p95PayloadBytes,
    p50PayloadKiB: Number((p50PayloadBytes / 1024).toFixed(2)),
    p95PayloadKiB: Number((p95PayloadBytes / 1024).toFixed(2)),
    p50WireBytes: percentile(wireBytes, 0.5),
    p95WireBytes: percentile(wireBytes, 0.95),
    p50WireKiB: Number((percentile(wireBytes, 0.5) / 1024).toFixed(2)),
    p95WireKiB: Number((percentile(wireBytes, 0.95) / 1024).toFixed(2)),
    sqlCallsPerRequestP50: percentile(sqlCalls, 0.5),
    sqlCallsPerRequestP95: percentile(sqlCalls, 0.95),
  };
}

export async function benchmarkApp(app, { warmups = 5, samples = 30, acceptEncodings = ["identity", "gzip"], queryCounter = () => 0, resetQueryCounter = () => {} } = {}) {
  if (!Number.isInteger(warmups) || warmups < 0 || !Number.isInteger(samples) || samples < 1) {
    throw new Error("PERF_WARMUPS must be >= 0 and PERF_SAMPLES must be >= 1");
  }
  if (!acceptEncodings.length || acceptEncodings.some((encoding) => !["identity", "gzip"].includes(encoding))) {
    throw new Error("PERF_ACCEPT_ENCODINGS must contain identity and/or gzip");
  }
  const results = [];
  for (const item of BENCHMARK_CASES) {
    for (const acceptEncoding of acceptEncodings) {
      const observations = [];
      let contentEncoding = "identity";
      for (let index = 0; index < warmups + samples; index += 1) {
        resetQueryCounter();
        const startedAt = performance.now();
        const response = await app.inject({ method: "GET", url: item.url, headers: { accept: "text/html", "accept-encoding": acceptEncoding } });
        const materializationMs = performance.now() - startedAt;
        const serverRenderMs = Number(response.headers["x-z3-perf-server-render-ms"]);
        if (!Number.isFinite(serverRenderMs)) throw new Error(`${item.name} did not expose server render timing`);
        const rawPayload = Buffer.isBuffer(response.rawPayload) ? response.rawPayload : Buffer.from(response.body);
        contentEncoding = String(response.headers["content-encoding"] ?? "identity").toLowerCase();
        const decodedPayload = contentEncoding === "gzip" ? gunzipSync(rawPayload) : rawPayload;
        const decodedBody = decodedPayload.toString("utf8");
        const payloadBytes = decodedPayload.byteLength;
        const wireBytes = rawPayload.byteLength;
        if (response.statusCode !== item.expectedStatus) {
          throw new Error(`${item.name} expected HTTP ${item.expectedStatus}; got ${response.statusCode}`);
        }
        if (!decodedBody.includes(item.expectedContent)) {
          throw new Error(`${item.name} did not render expected fixture marker ${JSON.stringify(item.expectedContent)}`);
        }
        if (index >= warmups) observations.push({ serverRenderMs, materializationMs, payloadBytes, wireBytes, sqlCalls: queryCounter() });
      }
      results.push({ name: item.name, url: item.url, acceptEncoding, contentEncoding, ...summarizeSamples(observations) });
    }
  }
  return results;
}

async function run() {
  const { __test__ } = await import("../../src/services/mapSnapshot.ts");
  const { seedDatabaseMocks, buildMapFixtureRows, fixtureMetadata, queryCount, resetQueryCount } = await import("./routeBenchmarkFixtures.mjs");
  process.env.DATABASE_URL ||= "postgres://z3-perf-fixture:fixture@127.0.0.1:1/z3_perf_fixture";
  const { Pool } = await import("pg");
  const mapFixture = __test__.buildPublicMapSnapshotPayload(buildMapFixtureRows(), "2026-10-23T00:00:00.000Z");
  const restoreMocks = seedDatabaseMocks(Pool, mapFixture);
  const { buildApp } = await import("../../src/app.ts");
  const app = buildApp();
  app.log.level = "silent";
  const requestStarted = new WeakMap();
  app.addHook("onRequest", (request, _reply, done) => {
    requestStarted.set(request, performance.now());
    done();
  });
  app.addHook("onSend", async (request, reply, payload) => {
    const startedAt = requestStarted.get(request);
    if (typeof startedAt === "number") {
      reply.header("X-Z3-Perf-Server-Render-Ms", Math.max(0, performance.now() - startedAt).toFixed(2));
    }
    return payload;
  });
  const warmups = Number(process.env.PERF_WARMUPS ?? 5);
  const samples = Number(process.env.PERF_SAMPLES ?? 30);
  const acceptEncodings = String(process.env.PERF_ACCEPT_ENCODINGS ?? "identity,gzip").split(",").map((value) => value.trim()).filter(Boolean);
  try {
    await app.ready();
    const routes = await benchmarkApp(app, { warmups, samples, acceptEncodings, queryCounter: queryCount, resetQueryCounter: resetQueryCount });
    console.log(JSON.stringify({
      schema: "zukan-route-perf/v1",
      sourceRef: process.env.PERF_SOURCE_REF ?? "working-tree",
      treeState: process.env.PERF_TREE_STATE ?? "unspecified",
      measuredAt: new Date().toISOString(),
      runtime: { node: process.version, warmups, samples },
      fixture: fixtureMetadata(mapFixture),
      dbCostsIncluded: false,
      notes: ["serverRenderMs stops at the benchmark app-level onSend hook and may precede route-local encoding; materializationMs covers all of app.inject, including route encoding and post-response transforms.", "Response bytes are measured after decoding; wire bytes come from the encoded raw response. These are HTML route response sizes only, excluding API, tile, CDN asset, and media requests.", "PostgreSQL execution, network, storage, and browser rendering costs are excluded; query call counts are counts of calls answered by the mock."],
      routes,
    }, null, 2));
  } finally {
    await app.close();
    restoreMocks();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch((error) => {
    console.error(error instanceof Error ? error.stack : String(error));
    process.exitCode = 1;
  });
}
