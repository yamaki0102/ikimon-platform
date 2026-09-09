import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { worker } from "./index";
import { buildRuntimeIdentity, runtimeIdentityHeaders } from "./runtimeIdentity";

const root = new URL("../", import.meta.url);
const configPath = new URL("wrangler.jsonc", root);
const packagePath = new URL("package.json", root);

test("runtime identity prefers the source SHA and carries native version metadata", () => {
  const identity = buildRuntimeIdentity({
    ENVIRONMENT: "shadow",
    IKIMON_GIT_SHA: "  ec429bec0224b4ec3a579d265a019ce1eb7756dc ",
    GITHUB_SHA: "fallback",
    IKIMON_WORKER_VERSION: "candidate-version",
    CF_VERSION_METADATA: {
      id: "native-version-id",
      tag: "shadow-canary",
      timestamp: "2026-09-09T21:00:00.000Z",
    },
  }, "https://shadow.example");
  assert.equal(identity.sourceSha, "ec429bec0224b4ec3a579d265a019ce1eb7756dc");
  assert.equal(identity.workerVersionId, "native-version-id");
  assert.equal(identity.workerVersionTag, "shadow-canary");
  assert.equal(identity.workerVersionTimestamp, "2026-09-09T21:00:00.000Z");
});
test("existing runtime version exposes source and native Worker Version identity", async () => {
  const env = {
    ENVIRONMENT: "shadow",
    IKIMON_GIT_SHA: "ec429bec0224b4ec3a579d265a019ce1eb7756dc",
    IKIMON_WORKER_VERSION: "candidate-version",
    CF_VERSION_METADATA: {
      id: "native-version-id",
      tag: "shadow-canary",
      timestamp: "2026-09-09T21:00:00.000Z",
    },
  } as never;
  const response = await worker.fetch(new Request("https://shadow.example/api/v1/runtime/version"), env);
  assert.equal(response.status, 200);
  const payload = await response.json() as Record<string, any>;
  assert.equal(payload.sourceSha, undefined);
  assert.equal(payload.gitSha, "ec429bec0224b4ec3a579d265a019ce1eb7756dc");
  assert.equal(payload.workerVersionId, "native-version-id");
  assert.equal(payload.workerVersionTag, "shadow-canary");
  assert.equal(payload.workerVersionTimestamp, "2026-09-09T21:00:00.000Z");
  assert.equal(response.headers.get("x-cloudflare-worker-version"), "native-version-id");
  assert.equal(response.headers.get("x-cloudflare-worker-version-tag"), "shadow-canary");
  assert.equal("privatePayload" in payload, false);
});
test("native Cloudflare version header is omitted without native metadata", () => {
  const identity = buildRuntimeIdentity({
    ENVIRONMENT: "shadow",
    IKIMON_WORKER_VERSION: "legacy-alias-only",
  }, "https://shadow.example");
  const headers = runtimeIdentityHeaders(identity);
  assert.equal(headers["x-cloudflare-worker-version"], undefined);
  assert.equal(headers["x-ikimon-worker-version"], "legacy-alias-only");
});

test("shadow config is the only config with the candidate toolchain flags", async () => {
  const config = JSON.parse(await readFile(configPath, "utf8")) as Record<string, any>;
  assert.equal(config.env.shadow.compatibility_date, "2026-09-09");
  assert.deepEqual(config.env.shadow.compatibility_flags, ["new_module_registry"]);
  assert.deepEqual(config.env.shadow.version_metadata, { binding: "CF_VERSION_METADATA" });
  assert.equal(config.env.staging.compatibility_flags, undefined);
  assert.equal(config.env.production.compatibility_flags, undefined);
  assert.equal(config.env.production.version_metadata, undefined);
});
test("package pins the candidate Wrangler and matching Workers types", async () => {
  const pkg = JSON.parse(await readFile(packagePath, "utf8")) as Record<string, any>;
  assert.equal(pkg.devDependencies.wrangler, "4.130.0");
  assert.equal(pkg.devDependencies["@cloudflare/workers-types"], "5.20260908.1");
});

test("source exposes only the registered Cloudflare boundary set", async () => {
  const source = await readFile(new URL("src/index.ts", root), "utf8");
  for (const marker of [
    "OBS_DB", "ASSET_BUCKET", "MEDIA_QUEUE", "ALERT_QUEUE",
    "IMAGES", "AI", "scheduled(", "queue(", "ALERT_EMAIL",
    "crypto.subtle",
  ]) assert.match(source, new RegExp(marker.replace(/[().]/g, "\\$&")));
  assert.doesNotMatch(source, /node:(?:async_hooks|crypto)/);
});
