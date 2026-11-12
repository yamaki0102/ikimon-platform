import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import test from "node:test";
import entry from "./publicPresentationEntry";

const snapshotUrl = new URL("./__snapshots__/route-replay.json", import.meta.url);
const HP = `hp_${"0".repeat(64)}`;
const ORIGIN = "https://staging.example.test";

type Case = [method: string, path: string, init?: { body?: string; headers?: Record<string, string> }];

const CASES: Case[] = [
  ["GET", "/"],
  ["GET", "/healthz"],
  ["HEAD", "/healthz"],
  ["GET", "/api/v1/auth/session"],
  ["POST", "/api/v1/auth/session"],
  ["GET", "/api/v1/integrations/nocosil/sites"],
  ["POST", "/api/v1/integrations/nocosil/sites"],
  ["GET", "/internal/r2-inventory"],
  ["GET", "/zzz"],
  ["GET", "/api/v1/zzz"],
  ["POST", "/api/v1/observations"],
  ["POST", "/api/v1/observations/draft"],
  ["POST", "/api/v1/observations/finalize"],
  ["POST", "/api/v1/auth/login"],
  ["POST", "/api/v1/auth/logout"],
  ["POST", "/api/v1/auth/register"],
  ["POST", "/api/v1/saved-items"],
  ["GET", "/api/v1/saved-items"],
  ["POST", "/api/v1/biosecurity/reports"],
  ["POST", "/api/v1/contact"],
  ["POST", "/api/v1/events"],
  ["GET", "/api/v1/runtime/version"],
  ["GET", `/sites/${HP}/`],
  ["GET", `/sites/${HP}/assets/site.css`],
  ["POST", `/sites/${HP}/`],
  ["GET", "/robots.txt"],
  ["GET", "/sitemap.xml"],
  ["GET", "/llms.txt"],
  ["GET", "/home"],
  ["GET", "/records"],
  ["GET", "/record"],
  ["GET", "/record/obs_missing"],
  ["GET", "/observations/obs_missing"],
  ["GET", "/map"],
  ["GET", "/explore"],
  ["GET", "/saved"],
  ["GET", "/events"],
  ["GET", "/events/new"],
  ["GET", "/login"],
  ["GET", "/register"],
  ["GET", "/about"],
  ["GET", "/privacy"],
  ["GET", "/terms"],
  ["GET", "/contact"],
  ["GET", "/learn"],
  ["GET", "/en/"],
  ["GET", "/en/records"],
  ["GET", "/es/"],
  ["GET", "/zh-hans/"],
  ["GET", "/ko/"],
  ["GET", "/api/v1/places"],
  ["GET", "/places"],
  ["GET", "/places/missing"],
  ["GET", "/favicon.ico"],
  ["GET", "/manifest.webmanifest"],
  ["GET", "/auth/google/start"],
  ["GET", "/auth/twitter/start"],
  ["OPTIONS", "/api/v1/observations"],
  ["PUT", "/api/v1/observations"],
];

const statement: Record<string, unknown> = {
  bind: () => statement,
  first: async () => null,
  all: async () => ({ results: [] }),
  run: async () => ({ meta: { changes: 0 } }),
};
const emptyDb = { prepare: () => statement, batch: async () => [] };
const emptyBucket = {
  get: async () => null,
  head: async () => null,
  put: async () => null,
  delete: async () => undefined,
  list: async () => ({ objects: [], truncated: false }),
};

const env = {
  ENVIRONMENT: "staging",
  PUBLIC_LOCATION_CELL_PRECISION: "3",
  CORE_DB: emptyDb,
  OBS_DB: emptyDb,
  ASSET_BUCKET: emptyBucket,
  MEDIA_QUEUE: { send: async () => undefined },
} as never;

const ctx = { waitUntil() {}, passThroughOnException() {} } as never;

async function replay() {
  const realNow = Date.now;
  const frozen = Date.parse("2026-01-01T00:00:00.000Z");
  Date.now = () => frozen;
  const out: Record<string, { status: number; contentType: string | null; sha256: string }> = {};
  try {
    for (const [method, path, init] of CASES) {
      const request = new Request(`${ORIGIN}${path}`, { method, body: init?.body, headers: init?.headers });
      let record: { status: number; contentType: string | null; sha256: string };
      try {
        const response = await entry.fetch(request, env, ctx);
        const text = await response.text();
        record = {
          status: response.status,
          contentType: response.headers.get("content-type"),
          sha256: createHash("sha256").update(text).digest("hex"),
        };
      } catch (error) {
        record = { status: -1, contentType: null, sha256: createHash("sha256").update(`${(error as Error).name}:${(error as Error).message}`).digest("hex") };
      }
      out[`${method} ${path}`] = record;
    }
  } finally {
    Date.now = realNow;
  }
  return out;
}

test("route replay responses are unchanged", async () => {
  const actual = await replay();
  if (process.env.P0_SNAPSHOT_WRITE === "1") {
    const second = await replay();
    assert.deepEqual(second, actual, "replay is not deterministic");
    writeFileSync(snapshotUrl, `${JSON.stringify(actual, null, 1)}\n`);
  }
  assert.deepEqual(actual, JSON.parse(readFileSync(snapshotUrl, "utf8")));
});
