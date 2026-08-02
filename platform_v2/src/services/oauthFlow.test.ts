import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyRequest } from "fastify";
import { buildAppOAuthStart, buildOAuthStart, oauthRedirectUri, readOAuthState } from "./oauthFlow.js";

async function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void> | void,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }
}

function request(headers: Record<string, string>, protocol = "http"): FastifyRequest {
  return { headers, protocol } as FastifyRequest;
}

test("google oauth uses the registered legacy-compatible callback URI", () => {
  const req = request({ host: "ikimon.life", "x-forwarded-proto": "https" });
  assert.equal(
    oauthRedirectUri(req, "google"),
    "https://ikimon.life/oauth_callback.php?provider=google",
  );
  assert.equal(
    oauthRedirectUri(req, "twitter"),
    "https://ikimon.life/auth/oauth/twitter/callback",
  );
});

test("oauth callback origin rejects client-supplied forwarded host, proto, and unsigned marker", () => {
  for (const forwardedProto of ["http", "javascript", "https,http"]) {
    const production = request({
      host: "ikimon.life",
      "x-forwarded-host": "staging.ikimon.life",
      "x-forwarded-proto": forwardedProto,
      "x-ikimon-cloudflare-fallback": "origin",
    });
    assert.equal(
      oauthRedirectUri(production, "google"),
      "https://ikimon.life/oauth_callback.php?provider=google",
    );
  }

  const stagingPublic = request({
    host: "staging.ikimon.life",
    "x-forwarded-host": "ikimon.life",
    "x-forwarded-proto": "http",
  });
  assert.equal(
    oauthRedirectUri(stagingPublic, "twitter"),
    "https://staging.ikimon.life/auth/oauth/twitter/callback",
  );

  for (const headers of [
    {
      host: "internal-origin.invalid",
      "x-forwarded-host": "staging.ikimon.life",
      "x-forwarded-proto": "http",
    },
    {
      host: "internal-origin.invalid",
      "x-ikimon-cloudflare-fallback": "origin",
      "x-forwarded-host": "staging.ikimon.life",
      "x-forwarded-proto": "http",
    },
  ]) {
    assert.throws(
      () => oauthRedirectUri(request(headers), "twitter"),
      /public_origin_untrusted/,
    );
  }
});

test("unrecognized and malformed OAuth hosts fail closed before local fallback", () => {
  for (const host of [
    "internal-origin.invalid",
    "ikimon.life.attacker.example",
    "staging.ikimon.life.attacker.example",
    "attacker-ikimon.life",
    "ikimon.life,attacker.example",
    "attacker.example@ikimon.life",
    "ikimon.life/path",
    "ikimon.life:444",
  ]) {
    assert.throws(
      () => oauthRedirectUri(request({
        host,
        "x-forwarded-host": "ikimon.life",
        "x-forwarded-proto": "https",
      }), "google"),
      /public_origin_untrusted/,
      host,
    );
  }
});

test("OAuth local development requires an exact local Host", () => {
  assert.equal(
    oauthRedirectUri(request({ host: "localhost:3200" }), "google"),
    "http://localhost:3200/oauth_callback.php?provider=google",
  );
  assert.equal(
    oauthRedirectUri(request({ host: "127.0.0.1:3200" }), "twitter"),
    "http://127.0.0.1:3200/auth/oauth/twitter/callback",
  );
  assert.throws(
    () => oauthRedirectUri(request({
      host: "internal-origin.invalid",
      "x-forwarded-host": "localhost:3200",
    }), "google"),
    /public_origin_untrusted/,
  );
});

test("google oauth start sends the registered redirect_uri to Google", async () => {
  await withEnv(
    {
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
      V2_OAUTH_STATE_SECRET: "state-secret",
    },
    () => {
      const req = request({ host: "ikimon.life", "x-forwarded-proto": "https" });
      const start = buildOAuthStart("google", req, "/record");
      const authUrl = new URL(start.authorizationUrl);

      assert.equal(authUrl.origin, "https://accounts.google.com");
      assert.equal(authUrl.searchParams.get("client_id"), "google-client");
      assert.equal(authUrl.searchParams.get("redirect_uri"), "https://ikimon.life/oauth_callback.php?provider=google");
      assert.match(start.cookie, /^ikimon_oauth_state=/);
    },
  );
});

test("oauth state reader prefers the newest duplicate state cookie", async () => {
  await withEnv(
    {
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
      V2_OAUTH_STATE_SECRET: "state-secret",
    },
    () => {
      const req = request({ host: "ikimon.life", "x-forwarded-proto": "https" });
      const start = buildOAuthStart("google", req, "/record");
      const freshCookiePair = start.cookie.split(";", 1)[0];
      const state = new URL(start.authorizationUrl).searchParams.get("state");

      const parsed = readOAuthState(`ikimon_oauth_state=stale.invalid; ${freshCookiePair}`);

      assert.equal(parsed?.provider, "google");
      assert.equal(parsed?.state, state);
      assert.equal(parsed?.redirect, "/record");
    },
  );
});

test("app oauth start stores the whitelisted Android return URI in state", async () => {
  await withEnv(
    {
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
      V2_OAUTH_STATE_SECRET: "state-secret",
    },
    () => {
      const req = request({ host: "staging.ikimon.life", "x-forwarded-proto": "https" });
      const start = buildAppOAuthStart("google", req, {
        returnUri: "ikimonfieldscan://auth/callback",
        installId: "install-1",
        platform: "android",
        appVersion: "0.8.1",
      });
      const freshCookiePair = start.cookie.split(";", 1)[0];
      const parsed = readOAuthState(freshCookiePair);
      const authUrl = new URL(start.authorizationUrl);

      assert.equal(authUrl.searchParams.get("redirect_uri"), "https://staging.ikimon.life/oauth_callback.php?provider=google");
      assert.equal(parsed?.provider, "google");
      assert.equal(parsed?.appReturnUri, "ikimonfieldscan://auth/callback");
      assert.equal(parsed?.appInstallId, "install-1");
      assert.equal(parsed?.appPlatform, "android");
      assert.equal(parsed?.appVersion, "0.8.1");
    },
  );
});

test("app oauth rejects non-app return URIs", async () => {
  await withEnv(
    {
      GOOGLE_CLIENT_ID: "google-client",
      GOOGLE_CLIENT_SECRET: "google-secret",
      V2_OAUTH_STATE_SECRET: "state-secret",
    },
    () => {
      const req = request({ host: "ikimon.life", "x-forwarded-proto": "https" });
      assert.throws(
        () => buildAppOAuthStart("google", req, { returnUri: "https://evil.example/callback" }),
        /app_return_uri_invalid/,
      );
    },
  );
});
