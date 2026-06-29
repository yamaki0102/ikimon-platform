import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

import {
  consumeAppOAuthExchangeCode,
  createAppOAuthExchangeCode,
  resetAppOAuthExchangeForTests,
} from "./appOAuthExchange.js";

async function withEnv(overrides: Record<string, string | undefined>, run: () => Promise<void>): Promise<void> {
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

test("app OAuth exchange seals the session token behind a short-lived app code", async () => {
  const oauthSecretKey = "V2_OAUTH_STATE_" + "SECRET";
  await withEnv({ [oauthSecretKey]: "stable-oauth-exchange-fixture" }, async () => {
    resetAppOAuthExchangeForTests();
    const rawToken = ["raw", "session", "token", "fixture"].join("-");
    const created = await createAppOAuthExchangeCode({
      userId: "user-1",
      displayName: "Observer One",
      email: "observer@example.test",
      rawToken,
    });

    assert.match(created.code, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.ok(new Date(created.expiresAt).getTime() > Date.now());
    assert.equal(created.code.includes(rawToken), false);
    assert.equal(created.code.includes("observer@example.test"), false);

    const consumed = await consumeAppOAuthExchangeCode(` ${created.code} `);
    assert.deepEqual(consumed, {
      token: rawToken,
      userId: "user-1",
      displayName: "Observer One",
      email: "observer@example.test",
    });
    await assert.rejects(() => consumeAppOAuthExchangeCode(created.code), /oauth_exchange_code_invalid/);
    resetAppOAuthExchangeForTests();
  });
});

test("app OAuth callback returns an exchange code instead of the raw session token", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "routes", "auth.ts"), "utf8");
  const callbackStart = source.indexOf("async function handleOAuthCallback");
  const callbackEnd = source.indexOf("export async function registerAuthRoutes", callbackStart);
  const callbackSource = source.slice(callbackStart, callbackEnd);

  assert.ok(callbackStart >= 0, "OAuth callback handler missing");
  assert.ok(callbackEnd > callbackStart, "OAuth callback handler boundary missing");
  assert.match(callbackSource, /createAppOAuthExchangeCode\(/);
  assert.match(callbackSource, /appUrl\.searchParams\.set\("code", exchange\.code\)/);
  assert.match(callbackSource, /appUrl\.searchParams\.set\("code_expires_at", exchange\.expiresAt\)/);
  assert.doesNotMatch(callbackSource, /appUrl\.searchParams\.set\("token", session\.rawToken\)/);
});

test("app OAuth exchange rejects blank or tampered codes before returning a token", async () => {
  await assert.rejects(() => consumeAppOAuthExchangeCode("  "), /oauth_exchange_code_required/);

  const oauthSecretKey = "V2_OAUTH_STATE_" + "SECRET";
  await withEnv({ [oauthSecretKey]: "stable-oauth-exchange-fixture" }, async () => {
    resetAppOAuthExchangeForTests();
    const created = await createAppOAuthExchangeCode({
      userId: "user-1",
      displayName: "Observer One",
      rawToken: ["raw", "session", "token", "fixture"].join("-"),
    });
    const tampered = `${created.code.slice(0, -1)}${created.code.endsWith("x") ? "y" : "x"}`;
    await assert.rejects(() => consumeAppOAuthExchangeCode(tampered), /oauth_exchange_code_invalid/);
    resetAppOAuthExchangeForTests();
  });
});

test("app OAuth exchange stays free of PostgreSQL runtime dependencies", async () => {
  const [exchangeSource, authSecuritySource] = await Promise.all([
    readFile(path.join(process.cwd(), "src", "services", "appOAuthExchange.ts"), "utf8"),
    readFile(path.join(process.cwd(), "src", "services", "authSecurity.ts"), "utf8"),
  ]);
  assert.doesNotMatch(exchangeSource, /from ["']pg["']|from ["']\.\.\/db\.js["']|getPool\(|\.query\(/);
  assert.doesNotMatch(authSecuritySource, /from ["']pg["']|from ["']\.\.\/db\.js["']|getPool\(|\.query\(/);
});
