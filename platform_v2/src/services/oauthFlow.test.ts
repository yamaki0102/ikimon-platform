import assert from "node:assert/strict";
import test from "node:test";
import type { FastifyRequest } from "fastify";
import { buildOAuthStart, oauthRedirectUri, readOAuthState } from "./oauthFlow.js";

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

function request(headers: Record<string, string>): FastifyRequest {
  return { headers, protocol: "http" } as FastifyRequest;
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
