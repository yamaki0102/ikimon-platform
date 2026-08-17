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

test("production browser and app OAuth starts require exact HTTPS public URL and Host", () => {
  for (const candidate of [
    request("https://ikimon.life/auth/oauth/google/start", "ikimon.life"),
    request("https://www.ikimon.life/auth/oauth/twitter/start", "www.ikimon.life"),
    request("https://zukan.earth/auth/oauth/google/start", "zukan.earth"),
    request("https://ikimon.life/app_oauth_start.php?provider=google", "ikimon.life"),
  ]) {
    assert.notEqual(oauthStartKind(candidate), null);
    assert.equal(authorizeOAuthStart(candidate, { ENVIRONMENT: "production" }), true);
  }

  for (const candidate of [
    request("https://ikimon.life/auth/oauth/google/start", "localhost"),
    request("https://ikimon.life/app_oauth_start.php?provider=google", "localhost"),
    request("https://ikimon.life/auth/oauth/google/start", "ikimon.life,evil.example"),
    request("https://staging.ikimon.life/auth/oauth/google/start", "staging.ikimon.life"),
    request("http://ikimon.life/auth/oauth/google/start", "ikimon.life"),
    request("https://ikimon.life:444/auth/oauth/google/start", "ikimon.life:444"),
  ]) {
    assert.equal(
      authorizeOAuthStart(candidate, { ENVIRONMENT: "production" }),
      false,
      candidate.url,
    );
  }
});

test("staging and local development OAuth boundaries remain explicit", () => {
  for (const candidate of [
    request("https://staging.ikimon.life/auth/oauth/google/start", "staging.ikimon.life"),
    request("https://staging.ikimon.life/app_oauth_start.php?provider=twitter", "staging.ikimon.life"),
  ]) {
    assert.equal(authorizeOAuthStart(candidate, { ENVIRONMENT: "staging" }), true);
  }

  assert.equal(
    authorizeOAuthStart(
      request("https://ikimon.life/auth/oauth/google/start", "ikimon.life"),
      { ENVIRONMENT: "staging" },
    ),
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
  const candidate = request("https://ikimon.life/records/123", "evil.example");
  assert.equal(oauthStartKind(candidate), null);
  assert.equal(authorizeOAuthStart(candidate, { ENVIRONMENT: "production" }), true);
});

test("browser OAuth failures use an environment-pinned friendly redirect", async () => {
  const productionSpoof = request(
    "https://evil.example/auth/oauth/google/start",
    "localhost",
  );
  const productionResponse = oauthErrorResponse(productionSpoof, { ENVIRONMENT: "production" });
  assert.equal(productionResponse.status, 303);
  assert.equal(productionResponse.headers.get("location"), "https://zukan.earth/login?error=oauth");
  assert.equal(productionResponse.headers.get("cache-control"), "no-store");
  assert.equal(productionResponse.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await productionResponse.text(), "");

  const stagingSpoof = request(
    "https://evil.example/auth/oauth/google/start",
    "staging.ikimon.life",
  );
  assert.equal(
    oauthErrorResponse(stagingSpoof, { ENVIRONMENT: "staging" }).headers.get("location"),
    "https://staging.zukan.earth/login?error=oauth",
  );

  const local = request("http://localhost:8787/auth/oauth/google/start", "localhost:8787");
  assert.equal(
    oauthErrorResponse(local, { ENVIRONMENT: "shadow" }).headers.get("location"),
    "http://localhost:8787/login?error=oauth",
  );
});

test("app OAuth failures preserve the mobile callback contract", () => {
  const candidate = request(
    "https://evil.example/app_oauth_start.php?provider=google",
    "localhost",
  );
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
