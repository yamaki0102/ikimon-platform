import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import type { QueryResultRow } from "pg";

import { consumeAppOAuthExchangeCode, createAppOAuthExchangeCode } from "./appOAuthExchange.js";

type QueryCall = {
  sql: string;
  params: unknown[];
};

type ExchangeRow = {
  user_id: string;
  session_token_ciphertext: string;
  session_token_iv: string;
  session_token_auth_tag: string;
  display_name: string;
  email: string | null;
  expires_at: string;
  consumed_at: string | null;
};

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

function makeCreatePool(history: QueryCall[]) {
  return {
    async query<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
      history.push({ sql, params });
      return { rows: [] as T[] };
    },
    async connect(): Promise<never> {
      throw new Error("createAppOAuthExchangeCode should not request a transaction client");
    },
  };
}

function makeConsumePool(row: ExchangeRow, history: QueryCall[]) {
  let released = false;
  return {
    released: () => released,
    pool: {
      async connect() {
        return {
          async query<T = unknown>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
            history.push({ sql, params });
            const normalized = sql.trim().toLowerCase();
            if (normalized === "begin" || normalized === "commit" || normalized === "rollback") {
              return { rows: [] };
            }
            if (normalized.startsWith("select user_id")) {
              return { rows: [row as T] };
            }
            if (normalized.startsWith("update app_oauth_exchange_codes")) {
              return { rows: [] };
            }
            throw new Error(`unexpected query: ${sql}`);
          },
          release() {
            released = true;
          },
        };
      },
    },
  };
}

test("app OAuth exchange stores an encrypted session token behind a short-lived code", async () => {
  await withEnv({ V2_OAUTH_STATE_SECRET: "stable-oauth-exchange-test-secret" }, async () => {
    const createHistory: QueryCall[] = [];
    const rawToken = "raw-session-token-that-must-not-enter-the-return-uri";
    const created = await createAppOAuthExchangeCode(
      {
        userId: "user-1",
        displayName: "Observer One",
        email: "observer@example.test",
        rawToken,
      },
      makeCreatePool(createHistory),
    );

    assert.match(created.code, /^[A-Za-z0-9_-]+$/);
    assert.ok(new Date(created.expiresAt).getTime() > Date.now());
    assert.equal(createHistory.length, 1);
    const insert = createHistory[0];
    assert.ok(insert);
    assert.match(insert.sql, /insert into app_oauth_exchange_codes/);
    assert.match(String(insert.params[0]), /^[a-f0-9]{64}$/);
    assert.notEqual(insert.params[0], created.code);
    assert.equal(insert.params.some((param) => param === rawToken), false);

    const row: ExchangeRow = {
      user_id: String(insert.params[1]),
      session_token_ciphertext: String(insert.params[2]),
      session_token_iv: String(insert.params[3]),
      session_token_auth_tag: String(insert.params[4]),
      display_name: String(insert.params[5]),
      email: insert.params[6] === null ? null : String(insert.params[6]),
      expires_at: String(insert.params[7]),
      consumed_at: null,
    };
    const consumeHistory: QueryCall[] = [];
    const consume = makeConsumePool(row, consumeHistory);
    const consumed = await consumeAppOAuthExchangeCode(` ${created.code} `, consume.pool);

    assert.deepEqual(consumed, {
      token: rawToken,
      userId: "user-1",
      displayName: "Observer One",
      email: "observer@example.test",
    });
    assert.equal(consume.released(), true);
    const select = consumeHistory.find((call) => /for update/.test(call.sql));
    const update = consumeHistory.find((call) => /update app_oauth_exchange_codes/.test(call.sql));
    assert.ok(select);
    assert.ok(update);
    assert.equal(select.params[0], insert.params[0]);
    assert.equal(update.params[0], insert.params[0]);
    assert.equal(consumeHistory.some((call) => call.params.some((param) => param === created.code)), false);
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

test("app OAuth exchange rejects a blank code before touching the database", async () => {
  await assert.rejects(
    () => consumeAppOAuthExchangeCode("  ", {
      async connect(): Promise<never> {
        throw new Error("database should not be touched for a blank exchange code");
      },
    }),
    /oauth_exchange_code_required/,
  );
});
