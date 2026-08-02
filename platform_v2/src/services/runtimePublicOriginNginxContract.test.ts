import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const productionNginx = readFileSync(
  new URL("../../ops/nginx/ikimon.life-v2-cutover.conf", import.meta.url),
  "utf8",
);
const stagingNginx = readFileSync(
  new URL("../../../ops/deploy/staging_ikimon_life_tls_reference.conf", import.meta.url),
  "utf8",
);

function assertEveryFastifyProxyHasRuntimeOrigin(
  config: string,
  expectedOrigin: string,
): void {
  const fastifyProxyCount = [...config.matchAll(
    /proxy_pass http:\/\/127\.0\.0\.1:3200(?:\/[^;\s]+)?;/g,
  )].length;
  const escapedOrigin = expectedOrigin.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const runtimeHeaderCount = [...config.matchAll(new RegExp(
    `proxy_set_header X-Ikimon-Runtime-Public-Origin ${escapedOrigin};`,
    "g",
  ))].length;

  assert.ok(fastifyProxyCount > 0);
  assert.equal(runtimeHeaderCount, fastifyProxyCount);
  assert.doesNotMatch(
    config,
    /proxy_set_header X-Ikimon-Runtime-Public-Origin \$http_/,
  );
}

test("production nginx binds every localhost Fastify proxy to production", () => {
  assertEveryFastifyProxyHasRuntimeOrigin(productionNginx, "https://ikimon.life");
});

test("staging nginx binds every localhost Fastify proxy to staging", () => {
  assertEveryFastifyProxyHasRuntimeOrigin(stagingNginx, "https://staging.ikimon.life");
});
