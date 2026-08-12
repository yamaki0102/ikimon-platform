import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { MOBILE_PLATFORM_CONTRACT_VERSION } from "../mobilePlatform/productFamilyContract.js";
import { registerMobileFieldSessionsApiRoutes } from "./mobileFieldSessionsApi.js";

test("mobile platform well-known discovery is provider opaque", async () => {
  const app = Fastify();
  await registerMobileFieldSessionsApiRoutes(app);

  try {
    const response = await app.inject({ method: "GET", url: "/.well-known/ikimon-platform" });
    assert.equal(response.statusCode, 200);
    assert.match(String(response.headers["cache-control"]), /max-age=300/);

    const body = response.json();
    assert.equal(body.schema, "ikimon.platform-discovery/v1");
    assert.equal(body.product, "zukan");
    assert.equal(body.mobileContractVersion, MOBILE_PLATFORM_CONTRACT_VERSION);
    assert.equal(body.capabilities, "/api/v1/mobile/capabilities");
    assert.equal(body.providerOpaque, true);
    assert.doesNotMatch(JSON.stringify(body).toLowerCase(), /cloudflare|r2_bucket|d1_database|durable_object/);
  } finally {
    await app.close();
  }
});

test("mobile capability endpoint distinguishes available and contract-only capabilities", async () => {
  const app = Fastify();
  await registerMobileFieldSessionsApiRoutes(app);

  try {
    const response = await app.inject({ method: "GET", url: "/api/v1/mobile/capabilities" });
    assert.equal(response.statusCode, 200);

    const body = response.json();
    assert.equal(body.contractVersion, MOBILE_PLATFORM_CONTRACT_VERSION);
    assert.equal(body.product, "zukan");

    const byId = new Map<string, { state: string }>(
      (body.capabilities as Array<{ id: string; state: string }>).map((item) => [item.id, item]),
    );
    assert.equal(byId.get("field-session.start")?.state, "available");
    assert.equal(byId.get("media.upload.intent")?.state, "contract_only");
    assert.equal(byId.get("knowledge-exchange.nocosil-to-zukan")?.state, "contract_only");
  } finally {
    await app.close();
  }
});
