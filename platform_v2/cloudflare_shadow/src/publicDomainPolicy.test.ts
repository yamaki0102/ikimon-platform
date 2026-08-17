import assert from "node:assert/strict";
import test from "node:test";
import { canonicalPublicHostRedirect, rewriteCanonicalPublicOrigins } from "./index";

const env = (mode: string): any => ({ ENVIRONMENT: "production", LEGACY_HOST_REDIRECT_MODE: mode });

test("legacy redirect remains disabled until the production binding is verified", () => {
  const response = canonicalPublicHostRedirect(
    new Request("https://www.ikimon.life/ja/records?view=public&from=legacy"),
    new URL("https://www.ikimon.life/ja/records?view=public&from=legacy"),
    env("disabled"),
  );
  assert.ok(response);
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://ikimon.life/ja/records?view=public&from=legacy");

  assert.equal(
    canonicalPublicHostRedirect(
      new Request("https://ikimon.life/ja/records?view=public"),
      new URL("https://ikimon.life/ja/records?view=public"),
      env("disabled"),
    ),
    null,
  );
});

test("canonical www host redirects to the canonical apex", () => {
  const response = canonicalPublicHostRedirect(
    new Request("https://www.zukan.earth/ja/records?view=public"),
    new URL("https://www.zukan.earth/ja/records?view=public"),
    env("disabled"),
  );
  assert.ok(response);
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://zukan.earth/ja/records?view=public");
});

test("enabled legacy redirect preserves path/query and excludes protected routes", () => {
  const response = canonicalPublicHostRedirect(
    new Request("https://ikimon.life/ja/records?view=public&from=legacy"),
    new URL("https://ikimon.life/ja/records?view=public&from=legacy"),
    env("enabled"),
  );
  assert.ok(response);
  assert.equal(response.status, 308);
  assert.equal(response.headers.get("location"), "https://zukan.earth/ja/records?view=public&from=legacy");

  for (const path of ["/api/v1/runtime/version", "/auth/oauth/google/start", "/oauth_callback.php", "/webhooks/provider"]) {
    assert.equal(
      canonicalPublicHostRedirect(
        new Request(`https://ikimon.life${path}`),
        new URL(`https://ikimon.life${path}`),
        env("enabled"),
      ),
      null,
      path,
    );
  }

  assert.equal(
    canonicalPublicHostRedirect(
      new Request("https://ikimon.life/ja/records", { method: "POST" }),
      new URL("https://ikimon.life/ja/records"),
      env("enabled"),
    ),
    null,
  );
});

test("materialized public text is canonicalized at the existing Worker edge", () => {
  assert.equal(
    rewriteCanonicalPublicOrigins(
      "https://ikimon.life/ja/ https://www.ikimon.life/robots.txt https://staging.ikimon.life/",
      env("disabled"),
    ),
    "https://zukan.earth/ja/ https://zukan.earth/robots.txt https://zukan.earth/",
  );
  assert.equal(
    rewriteCanonicalPublicOrigins("https://ikimon.life/ja/", { ENVIRONMENT: "staging" } as any),
    "https://staging.zukan.earth/ja/",
  );
});
