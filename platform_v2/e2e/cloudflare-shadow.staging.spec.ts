import { expect, test } from "@playwright/test";

test.describe("cloudflare shadow staging proxy", () => {
  test.skip(process.env.EXPECT_CLOUDFLARE_SHADOW_STAGING !== "1", "Set EXPECT_CLOUDFLARE_SHADOW_STAGING=1 after the staging proxy env is configured.");

  test("exposes public shadow health through the staging base path and keeps internals closed", async ({ request }) => {
    const health = await request.get("/cloudflare-shadow/health", {
      headers: { accept: "application/json" },
    });
    expect(health.ok(), await health.text()).toBeTruthy();
    expect(health.headers()["x-ikimon-shadow-proxy"]).toBe("1");
    expect(await health.json()).toEqual({
      ok: true,
      environment: "shadow",
    });

    const internal = await request.get("/cloudflare-shadow/internal/production-import-summary", {
      headers: { accept: "application/json" },
    });
    expect([401, 403, 404]).toContain(internal.status());
    expect(internal.status(), "internal summary must not be exposed through the staging proxy").not.toBe(200);
  });

  test("proves non-ready Stream rows stay out of public-ready media through the staging route", async ({ request }) => {
    const response = await request.get("/cloudflare-shadow/shadow-smoke/stream-nonready-exclusion-proof", {
      headers: {
        accept: "application/json",
        "user-agent": "Python-urllib/3.12",
      },
    });
    expect(response.ok(), await response.text()).toBeTruthy();
    expect(response.headers()["x-ikimon-shadow-proxy"]).toBe("1");

    const payload = await response.json();
    expect(payload.gate).toBe("stream_nonready_excluded_from_public_ready");
    expect(payload.inventory).toMatchObject({
      total: 34,
      existsCount: 34,
      readyCount: 32,
      nonReadyCount: 2,
    });
    expect(payload.invariants).toMatchObject({
      allStreamRowsAccountedFor: true,
      readyCountMatchesExpected: true,
      nonReadyCountMatchesExpected: true,
      nonReadyRowsLedgered: true,
      publicReadyExcludesUnresolved: true,
      unresolvedCoversNonReady: true,
    });
  });
});
