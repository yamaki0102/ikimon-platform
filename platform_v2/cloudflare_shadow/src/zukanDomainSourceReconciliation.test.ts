import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type Route = string | { pattern?: string; custom_domain?: boolean };
type EnvironmentConfig = {
  routes?: Route[];
  vars?: Record<string, string>;
};

const config = JSON.parse(
  readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8"),
) as { env?: Record<string, EnvironmentConfig> };

function route(config: EnvironmentConfig, pattern: string): Route | undefined {
  return config.routes?.find((candidate) =>
    typeof candidate === "string" ? candidate === pattern : candidate.pattern === pattern,
  );
}

test("Wrangler declares canonical ZUKAN custom domains while retaining rollback routes", () => {
  const staging = config.env?.staging ?? {};
  const production = config.env?.production ?? {};

  assert.deepEqual(route(staging, "staging.zukan.earth"), {
    pattern: "staging.zukan.earth",
    custom_domain: true,
  });
  assert.equal(route(staging, "staging.ikimon.life/*"), "staging.ikimon.life/*");

  assert.deepEqual(route(production, "zukan.earth"), {
    pattern: "zukan.earth",
    custom_domain: true,
  });
  assert.equal(route(production, "ikimon.life/*"), "ikimon.life/*");
  assert.equal(route(production, "www.ikimon.life/*"), "www.ikimon.life/*");
});

test("legacy redirect remains explicitly disabled in staging and production source config", () => {
  const stagingVars = config.env?.staging?.vars ?? {};
  const productionVars = config.env?.production?.vars ?? {};

  assert.equal(stagingVars.LEGACY_HOST_REDIRECT_MODE, "disabled");
  assert.equal(productionVars.LEGACY_HOST_REDIRECT_MODE, "disabled");
  assert.equal(stagingVars.ORIGIN_FALLBACK_BASE_URL, "https://ikimon.life");
  assert.equal(productionVars.ORIGIN_FALLBACK_BASE_URL, "https://ikimon.life");
});
