import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeOAuthStart,
  oauthErrorResponse,
  oauthStartKind,
} from "./oauthStartBoundary";

function request(url: string, host?: string): Request {
  return new Request(url, {
    headers: host === undefined ? {} : { host },
  });
}

test("production browser and app OAuth starts accept canonical and legacy production hosts", () => {
  for (const candidate of [
    request("https://zukan.earth/auth/oauth/google/start", "zukan.earth"),
    request("https://ikimon.life/auth/oauth/google/start", "ikimon.life"),
    request("https://www.ikimon.life/auth/oauth/twitter/start", "www.ikimon.life"),
    request("https://zukan.earth/app_oauth_start.php?provider=google", "zukan.earth"),
    request("https://ikimon.life/app_oauth_start.php?provider=google", "ikimon.life"),
  ]) {
    assert.notEqual(oauthStartKind(candidate), null);
    assert.equal(authorizeOAuthStart(candidate, { ENVIRONMENT: "production" }), true);
  }

  for (const candidate of [
    request("https://zukan.earth/auth/oauth/google/start", "localhost"),
    request("https://zukan.earth/app_oauth_start.php?provider=google", "localhost"),
    request("https://zukan.earth/auth/oauth/google/start", "zukan.earth,evil.example"),
    request("https://staging.zukan.earth/auth/oauth/google/start", "staging.zukan.earth"),
    request("http://zukan.earth/auth/oauth/google/start", "zukan.earth"),
    request("https://zukan.earth:444/auth/oauth/google/start", "zukan.earth:444"),
  ]) {
    assert.equal(authorizeOAuthStart(candidate, { ENVIRONMENT: "production" }), false, candidate.url);
  }
});

test("staging OAuth accepts canonical and rollback-compatible staging hosts", () => {
  for (const candidate of [
    request("https://staging.zukan.earth/auth/oauth/google/start", "staging.zukan.earth"),
    request("https://staging.ikimon.life/auth/oauth/google/start", "staging.ikimon.life"),
    request("https://staging.zukan.earth/app_oauth_start.php?provider=twitter", "staging.zukan.earth"),
    request("https://staging.ikimon.life/app_oauth_start.php?provider=twitter", "staging.ikimon.life"),
  ]) {
    assert.equal(authorizeOAuthStart(candidate, { ENVIRONMENT: "staging" }), true);
  }

  assert.equal(
    authorizeOAuthStart(request("https://zukan.earth/auth/oauth/google/start", "zukan.earth"), { ENVIRONMENT: "staging" }),
    false,
  );
  assert.equal(
    authorizeOAuthStart(
      request("http://localhost:8787/app_oauth_start.php?provider=google", "localhost:8787"),
      { ENVIRONMENT: "shadow" },
    ),
    true,
  );
});

test("non-OAuth routes are not restricted by the OAuth-specific wrapper", () => {
  const candidate = request("https://zukan.earth/records/123", "evil.example");
  assert.equal(oauthStartKind(candidate), null);
  assert.equal(authorizeOAuthStart(candidate, { ENVIRONMENT: "production" }), true);
});

test("browser OAuth failures stay on the actual allowed host and otherwise fail to canonical zukan host", async () => {
  for (const [url, host, expected] of [
    ["https://zukan.earth/auth/oauth/google/start", "zukan.earth", "https://zukan.earth/login?error=oauth"],
    ["https://ikimon.life/auth/oauth/google/start", "ikimon.life", "https://ikimon.life/login?error=oauth"],
  ] as const) {
    const response = oauthErrorResponse(request(url, host), { ENVIRONMENT: "production" });
    assert.equal(response.status, 303);
    assert.equal(response.headers.get("location"), expected);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(await response.text(), "");
  }

  const productionSpoof = request("https://evil.example/auth/oauth/google/start", "localhost");
  assert.equal(
    oauthErrorResponse(productionSpoof, { ENVIRONMENT: "production" }).headers.get("location"),
    "https://zukan.earth/login?error=oauth",
  );

  const stagingSpoof = request("https://evil.example/auth/oauth/google/start", "staging.ikimon.life");
  assert.equal(
    oauthErrorResponse(stagingSpoof, { ENVIRONMENT: "staging" }).headers.get("location"),
    "https://staging.zukan.earth/login?error=oauth",
  );

  const legacyStaging = request("https://staging.ikimon.life/auth/oauth/google/start", "staging.ikimon.life");
  assert.equal(
    oauthErrorResponse(legacyStaging, { ENVIRONMENT: "staging" }).headers.get("location"),
    "https://staging.ikimon.life/login?error=oauth",
  );

  const local = request("http://localhost:8787/auth/oauth/google/start", "localhost:8787");
  assert.equal(
    oauthErrorResponse(local, { ENVIRONMENT: "shadow" }).headers.get("location"),
    "http://localhost:8787/login?error=oauth",
  );
});

test("app OAuth failures preserve the mobile callback contract", () => {
  const candidate = request("https://evil.example/app_oauth_start.php?provider=google", "localhost");
  const response = oauthErrorResponse(candidate, { ENVIRONMENT: "production" });
  assert.equal(response.status, 303);
  const location = response.headers.get("location");
  assert.ok(location);
  const target = new URL(location);
  assert.equal(target.protocol, "ikimonfieldscan:");
  assert.equal(target.host, "auth");
  assert.equal(target.pathname, "/callback");
  assert.equal(target.searchParams.get("error"), "oauth");
  assert.equal(target.searchParams.get("message"), "ソーシャルログインに失敗した");
});
