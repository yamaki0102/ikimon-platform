import assert from "node:assert/strict";
import test from "node:test";
import Fastify from "fastify";
import { PLATFORM_CONTRACT_VERSION } from "../mobilePlatform/productFamilyContract.js";
import { registerMobileFieldSessionsApiRoutes } from "./mobileFieldSessionsApi.js";

test("well-known descriptor follows canonical mobile platform v1 shape", async () => {
  const app = Fastify();
  await registerMobileFieldSessionsApiRoutes(app);

  try {
    const response = await app.inject({
      method: "GET",
      url: "/.well-known/ikimon-platform",
      headers: { host: "localhost:3200" },
    });
    assert.equal(response.statusCode, 200);
    assert.match(String(response.headers["cache-control"]), /max-age=60/);

    const body = response.json();
    assert.equal(body.platform, "ikimon-cloudflare-os");
    assert.equal(body.environment, "development");
    assert.equal(body.product, "zukan");
    assert.equal(body.capability_endpoint, "/v1/capabilities");
    assert.ok(Array.isArray(body.supported_platform_contracts));
    assert.ok(body.supported_platform_contracts.includes(PLATFORM_CONTRACT_VERSION));
    assert.match(body.descriptor_digest, /^sha256:/);
    assert.doesNotMatch(JSON.stringify(body).toLowerCase(), /r2_bucket|d1_database|durable_object|hyperdrive_config/);
  } finally {
    await app.close();
  }
});

test("canonical capability endpoint distinguishes live current-runtime and disabled future capabilities", async () => {
  const app = Fastify();
  await registerMobileFieldSessionsApiRoutes(app);

  try {
    const response = await app.inject({ method: "GET", url: "/v1/capabilities" });
    assert.equal(response.statusCode, 200);
    assert.equal(String(response.headers["cache-control"]), "no-store");

    const body = response.json();
    assert.equal(body.maintenance_mode, "none");
    assert.equal(body.contracts.platform.min, PLATFORM_CONTRACT_VERSION);
    assert.equal(body.contracts.platform.max, PLATFORM_CONTRACT_VERSION);
    assert.match(body.config_digest, /^sha256:/);
    assert.ok(Date.parse(body.valid_until) > Date.now());

    const byId = new Map<string, { state: string }>(
      (body.capabilities as Array<{ capability_id: string; state: string }>).map((item) => [item.capability_id, item]),
    );
    assert.equal(byId.get("zukan.field_session.start")?.state, "available");
    assert.equal(byId.get("mobile.sync.push")?.state, "disabled");
    assert.equal(byId.get("mobile.media.upload.single")?.state, "disabled");
    assert.equal(byId.get("zukan.exchange.accept_nocosil")?.state, "disabled");
    assert.doesNotMatch(JSON.stringify(body).toLowerCase(), /r2_bucket|d1_database|durable_object|hyperdrive_config/);
  } finally {
    await app.close();
  }
});
