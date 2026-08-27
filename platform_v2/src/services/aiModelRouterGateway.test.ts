import assert from "node:assert/strict";
import test from "node:test";

import { openAiCompatibleRequestHeaders } from "./aiModelRouter.js";

const CLOUDFLARE_ENDPOINT = "https://api.cloudflare.com/client/v4/accounts/00000000000000000000000000000000/ai/v1/chat/completions";

test("Cloudflare AI Gateway routing is opt-in and preserves existing direct behavior", () => {
  const headers = openAiCompatibleRequestHeaders("token", CLOUDFLARE_ENDPOINT, {});
  assert.equal(headers.authorization, "Bearer token");
  assert.equal(headers["content-type"], "application/json");
  assert.equal("cf-aig-gateway-id" in headers, false);
});

test("explicit existing gateway id is attached only to Cloudflare unified AI endpoint", () => {
  const env = { CLOUDFLARE_AI_GATEWAY_ID: "zukan-bench" };
  const cloudflare = openAiCompatibleRequestHeaders("token", CLOUDFLARE_ENDPOINT, env);
  assert.equal(cloudflare["cf-aig-gateway-id"], "zukan-bench");

  const deepseek = openAiCompatibleRequestHeaders("token", "https://api.deepseek.com/chat/completions", env);
  assert.equal("cf-aig-gateway-id" in deepseek, false);

  const openai = openAiCompatibleRequestHeaders("token", "https://api.openai.com/v1/chat/completions", env);
  assert.equal("cf-aig-gateway-id" in openai, false);
});

test("default gateway id is fail-closed to avoid provider auto-creation", () => {
  assert.throws(
    () => openAiCompatibleRequestHeaders("token", CLOUDFLARE_ENDPOINT, { CLOUDFLARE_AI_GATEWAY_ID: "default" }),
    /cloudflare_ai_gateway_default_disallowed/u,
  );
});

test("gateway id respects provider length limit and rejects header injection", () => {
  const sixtyFour = "g".repeat(64);
  assert.equal(
    openAiCompatibleRequestHeaders("token", CLOUDFLARE_ENDPOINT, { CLOUDFLARE_AI_GATEWAY_ID: sixtyFour })["cf-aig-gateway-id"],
    sixtyFour,
  );
  assert.throws(
    () => openAiCompatibleRequestHeaders("token", CLOUDFLARE_ENDPOINT, { CLOUDFLARE_AI_GATEWAY_ID: "g".repeat(65) }),
    /cloudflare_ai_gateway_id_invalid/u,
  );
  assert.throws(
    () => openAiCompatibleRequestHeaders("token", CLOUDFLARE_ENDPOINT, { CLOUDFLARE_AI_GATEWAY_ID: "zukan\r\nattack" }),
    /cloudflare_ai_gateway_id_invalid/u,
  );
});
