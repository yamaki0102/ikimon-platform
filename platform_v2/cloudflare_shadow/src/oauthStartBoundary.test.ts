import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeBrowserOAuthStart,
  isBrowserOAuthStart,
  oauthErrorRedirect,
} from "./oauthStartBoundary";

function request(url: string, host?: string): Request {
  return new Request(url, {
    headers: host === undefined ? {} : { host },
  });
}

test("production OAuth start requires exact HTTPS public URL and Host", () => {
  assert.equal(
    authorizeBrowserOAuthStart(
      request("https://ikimon.life/auth/oauth/google/start", "ikimon.life"),
      { ENVIRONMENT: "production" },
    ),
    true,
  );
  assert.equal(
    authorizeBrowserOAuthStart(
      request("https://www.ikimon.life/auth/oauth/twitter/start", "www.ikimon.life"),
      { ENVIRONMENT: "production" },
    ),
    true,
  );

  for (const candidate of [
    request("https://ikimon.life/auth/oauth/google/start", "localhost"),
    request("https://ikimon.life/auth/oauth/google/start", "ikimon.life,evil.example"),
    request("https://staging.ikimon.life/auth/oauth/google/start", "staging.ikimon.life"),
    request("http://ikimon.life/auth/oauth/google/start", "ikimon.life"),
    request("https://ikimon.life:444/auth/oauth/google/start", "ikimon.life:444"),
  ]) {
    assert.equal(
      authorizeBrowserOAuthStart(candidate, { ENVIRONMENT: "production" }),
      false,
      candidate.url,
    );
  }
});

test("staging and local development OAuth boundaries remain explicit", () => {
  assert.equal(
    authorizeBrowserOAuthStart(
      request("https://staging.ikimon.life/auth/oauth/google/start", "staging.ikimon.life"),
      { ENVIRONMENT: "staging" },
    ),
    true,
  );
  assert.equal(
    authorizeBrowserOAuthStart(
      request("https://ikimon.life/auth/oauth/google/start", "ikimon.life"),
      { ENVIRONMENT: "staging" },
    ),
    false,
  );
  assert.equal(
    authorizeBrowserOAuthStart(
      request("http://localhost:8787/auth/oauth/google/start", "localhost:8787"),
      { ENVIRONMENT: "shadow" },
    ),
    true,
  );
});

test("non-OAuth routes are not restricted by the OAuth-specific wrapper", () => {
  const candidate = request("https://ikimon.life/records/123", "evil.example");
  assert.equal(isBrowserOAuthStart(candidate), false);
  assert.equal(authorizeBrowserOAuthStart(candidate, { ENVIRONMENT: "production" }), true);
});

test("OAuth boundary errors use an environment-pinned friendly redirect", async () => {
  const productionSpoof = request(
    "https://evil.example/auth/oauth/google/start",
    "localhost",
  );
  const productionResponse = oauthErrorRedirect(productionSpoof, { ENVIRONMENT: "production" });
  assert.equal(productionResponse.status, 303);
  assert.equal(productionResponse.headers.get("location"), "https://ikimon.life/login?error=oauth");
  assert.equal(productionResponse.headers.get("cache-control"), "no-store");
  assert.equal(productionResponse.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await productionResponse.text(), "");

  const stagingSpoof = request(
    "https://evil.example/auth/oauth/google/start",
    "staging.ikimon.life",
  );
  assert.equal(
    oauthErrorRedirect(stagingSpoof, { ENVIRONMENT: "staging" }).headers.get("location"),
    "https://staging.ikimon.life/login?error=oauth",
  );

  const local = request("http://localhost:8787/auth/oauth/google/start", "localhost:8787");
  assert.equal(
    oauthErrorRedirect(local, { ENVIRONMENT: "shadow" }).headers.get("location"),
    "http://localhost:8787/login?error=oauth",
  );
});
