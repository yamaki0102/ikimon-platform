import assert from "node:assert/strict";
import test from "node:test";
import { isSafeLegacyPublicPagePath, legacyDomainRedirect } from "./legacyDomainRedirect";

function request(url: string, method = "GET", host = new URL(url).host): Request {
  return new Request(url, { method, headers: { host } });
}

test("legacy redirect remains fail-closed until the production switch is enabled", () => {
  assert.equal(legacyDomainRedirect(request("https://ikimon.life/ja/map?from=qr"), { ENVIRONMENT: "production" }), null);
  assert.equal(legacyDomainRedirect(request("https://ikimon.life/ja/map?from=qr"), {
    ENVIRONMENT: "staging",
    LEGACY_HOST_REDIRECT_MODE: "enabled",
  }), null);
});

test("enabled legacy redirect preserves locale, path, and query on safe public GET/HEAD pages", () => {
  for (const [url, method, expected] of [
    ["https://ikimon.life/", "GET", "https://zukan.earth/"],
    ["https://ikimon.life/ja/map?from=qr&x=1", "GET", "https://zukan.earth/ja/map?from=qr&x=1"],
    ["https://www.ikimon.life/en/learn?q=bird", "HEAD", "https://zukan.earth/en/learn?q=bird"],
    ["https://ikimon.life/ja/observations/visit-1", "GET", "https://zukan.earth/ja/observations/visit-1"],
  ] as const) {
    const response = legacyDomainRedirect(request(url, method), {
      ENVIRONMENT: "production",
      LEGACY_HOST_REDIRECT_MODE: "enabled",
    });
    assert.ok(response);
    assert.equal(response.status, 308);
    assert.equal(response.headers.get("location"), expected);
  }
});

test("redirect never captures writes, auth, API, media, static, callback, operations, or session-bound surfaces", () => {
  for (const [method, path] of [
    ["POST", "/record"],
    ["PUT", "/records/1"],
    ["GET", "/api/records"],
    ["GET", "/media/private/1"],
    ["GET", "/assets/app.js"],
    ["GET", "/auth/oauth/google/start"],
    ["GET", "/login"],
    ["GET", "/callback/provider"],
    ["GET", "/webhook/provider"],
    ["GET", "/ops/status"],
    ["GET", "/.well-known/security.txt"],
    ["GET", "/manifest.webmanifest"],
    ["GET", "/robots.txt"],
    ["GET", "/sitemap.xml"],
    ["GET", "/home"],
    ["GET", "/ja/home"],
    ["GET", "/record"],
    ["GET", "/ja/record/photo"],
    ["GET", "/profile/me"],
    ["GET", "/settings"],
    ["GET", "/notifications"],
    ["GET", "/guide"],
    ["GET", "/admin"],
    ["GET", "/specialist/id-workbench"],
  ] as const) {
    assert.equal(
      legacyDomainRedirect(request(`https://ikimon.life${path}`, method), {
        ENVIRONMENT: "production",
        LEGACY_HOST_REDIRECT_MODE: "enabled",
      }),
      null,
      `${method} ${path}`,
    );
  }
});

test("host spoofing and non-HTTPS requests fail closed", () => {
  assert.equal(
    legacyDomainRedirect(request("https://ikimon.life/ja/map", "GET", "evil.example"), {
      ENVIRONMENT: "production",
      LEGACY_HOST_REDIRECT_MODE: "enabled",
    }),
    null,
  );
  assert.equal(
    legacyDomainRedirect(request("http://ikimon.life/ja/map", "GET", "ikimon.life"), {
      ENVIRONMENT: "production",
      LEGACY_HOST_REDIRECT_MODE: "enabled",
    }),
    null,
  );
});

test("safe path classifier keeps public pages separate from static and session-bound surfaces", () => {
  assert.equal(isSafeLegacyPublicPagePath("/ja/map"), true);
  assert.equal(isSafeLegacyPublicPagePath("/records/abc"), true);
  assert.equal(isSafeLegacyPublicPagePath("/observations/abc"), true);
  assert.equal(isSafeLegacyPublicPagePath("/api/records"), false);
  assert.equal(isSafeLegacyPublicPagePath("/ja/auth/oauth/google/start"), false);
  assert.equal(isSafeLegacyPublicPagePath("/ja/home"), false);
  assert.equal(isSafeLegacyPublicPagePath("/profile/me"), false);
  assert.equal(isSafeLegacyPublicPagePath("/app-sw.js"), false);
});
