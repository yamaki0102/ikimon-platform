import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { canonicalPublicHostRedirect, isPublicAiReferencePath, rewriteCanonicalPublicOrigins, withAiContentPolicy, withRobotsContentSignal } from "./index";

const env = (mode: string): any => ({ ENVIRONMENT: "production", LEGACY_HOST_REDIRECT_MODE: mode });
const wrangler = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
const envStart = wrangler.indexOf('"env": {');
const shadowStart = wrangler.indexOf('"shadow": {', envStart);
const stagingStart = wrangler.indexOf('"staging": {', shadowStart);
const productionStart = wrangler.indexOf('"production": {', stagingStart);
const environmentBlocks = {
  staging: wrangler.slice(stagingStart, productionStart),
  production: wrangler.slice(productionStart),
};

test("legacy redirect mode is enabled only in production configuration", () => {
  assert.ok(envStart >= 0 && shadowStart > envStart && stagingStart > shadowStart && productionStart > stagingStart);
  assert.match(environmentBlocks.production, /"LEGACY_HOST_REDIRECT_MODE": "enabled"/);
  assert.match(environmentBlocks.staging, /"LEGACY_HOST_REDIRECT_MODE": "disabled"/);
});

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


test("AI content policy allows only explicit public references and denies private/staging surfaces", () => {
  for (const path of [
    "/", "/ja/records", "/map", "/ja/community/fields/example",
    "/observations/example", "/ja/places/example", "/walk-maps/example",
    "/community/events/example", "/robots.txt", "/sitemap.xml",
  ]) {
    assert.equal(isPublicAiReferencePath(path), true, path);
    const response = withAiContentPolicy(
      new Response("public", { status: 200 }),
      new Request(`https://zukan.earth${path}`),
      { ENVIRONMENT: "production" },
    );
    assert.equal(response.headers.get("content-signal"), "search=yes, ai-input=yes, ai-train=no, use=reference", path);
    assert.equal(response.headers.get("x-robots-tag"), null, path);
  }

  for (const path of [
    "/profile", "/ja/profile/settings", "/record", "/my-guides",
    "/community/events/new", "/admin/municipal-walk-maps", "/api/v1/me",
    "/auth/oauth/google/start", "/internal/r2-inventory",
  ]) {
    assert.equal(isPublicAiReferencePath(path), false, path);
    const response = withAiContentPolicy(
      new Response("private", { status: 200 }),
      new Request(`https://zukan.earth${path}`),
      { ENVIRONMENT: "production" },
    );
    assert.equal(response.headers.get("content-signal"), "search=no, ai-input=no, ai-train=no, use=immediate", path);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow", path);
  }

  for (const request of [
    new Request("https://zukan.earth/ja/records", { headers: { cookie: "session=opaque" } }),
    new Request("https://zukan.earth/ja/records", { headers: { authorization: "Bearer opaque" } }),
    new Request("https://zukan.earth/ja/records?view=mine"),
  ]) {
    const response = withAiContentPolicy(new Response("session-aware", { status: 200 }), request, { ENVIRONMENT: "production" });
    assert.equal(response.headers.get("content-signal"), "search=no, ai-input=no, ai-train=no, use=immediate");
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
  }

  const staging = withAiContentPolicy(
    new Response("staging", { status: 200 }),
    new Request("https://staging.zukan.earth/ja/records"),
    { ENVIRONMENT: "staging" },
  );
  assert.equal(staging.headers.get("content-signal"), "search=no, ai-input=no, ai-train=no, use=immediate");
  assert.equal(staging.headers.get("x-robots-tag"), "noindex, nofollow");

  const preexistingNoindex = withAiContentPolicy(
    new Response("hidden", { status: 200, headers: { "x-robots-tag": "noindex" } }),
    new Request("https://zukan.earth/ja/records"),
    { ENVIRONMENT: "production" },
  );
  assert.equal(preexistingNoindex.headers.get("content-signal"), "search=no, ai-input=no, ai-train=no, use=immediate");

  const strongerNoindex = withAiContentPolicy(
    new Response("hidden", { status: 200, headers: { "x-robots-tag": "noindex, nofollow, noarchive, nosnippet" } }),
    new Request("https://zukan.earth/ja/records"),
    { ENVIRONMENT: "production" },
  );
  assert.equal(strongerNoindex.headers.get("x-robots-tag"), "noindex, nofollow, noarchive, nosnippet");
});


test("robots content signal is enforced at the active Worker edge", () => {
  const oldBody = "User-agent: *\nAllow: /\n\nSitemap: https://zukan.earth/sitemap.xml\n";
  const production = withRobotsContentSignal(oldBody, "production");
  assert.match(production, /^User-agent: \*\nContent-Signal: search=yes, ai-input=yes, ai-train=no, use=reference\nAllow: \/\n/u);
  assert.equal((production.match(/Content-Signal:/gu) ?? []).length, 1);

  const stale = "User-agent: *\nContent-Signal: ai-train=yes\nDisallow: /\n";
  const staging = withRobotsContentSignal(stale, "staging");
  assert.match(staging, /^User-agent: \*\nContent-Signal: search=no, ai-input=no, ai-train=no, use=immediate\nDisallow: \/\n/u);
  assert.equal((staging.match(/Content-Signal:/gu) ?? []).length, 1);
});
