import assert from "node:assert/strict";
import test from "node:test";
import {
  CloudflareD1HttpDatabase,
  type FoundationD1HttpFetch,
} from "./zukanFoundationV2CloudflareD1HttpDatabase.js";

const ACCOUNT_ID = "a".repeat(32);
const DATABASE_ID = "e06a7372-6964-4db1-92dd-3491d058f412";
const DATABASE_NAME = "ikimon_shadow_core";
const API_TOKEN = "test-token-not-a-secret";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

test("D1 HTTP adapter binds values and uses the single-query endpoint", async () => {
  const calls: Array<{ input: string; init: RequestInit }> = [];
  const fetcher: FoundationD1HttpFetch = async (input, init) => {
    calls.push({ input, init });
    return jsonResponse({
      success: true,
      result: [{ success: true, results: [{ value: "ok" }] }],
    });
  };
  const database = new CloudflareD1HttpDatabase({
    accountId: ACCOUNT_ID,
    databaseId: DATABASE_ID,
    expectedDatabaseName: DATABASE_NAME,
    apiToken: API_TOKEN,
    fetcher,
    requestTimeoutMs: 1_000,
  });
  const result = await database.prepare(
    "SELECT ? AS text_value, ? AS nullable_value, ? AS number_value",
  ).bind("value", null, 7).all<{ value: string }>();
  assert.deepEqual(result.results, [{ value: "ok" }]);
  assert.equal(calls.length, 1);
  assert.equal(
    calls[0]!.input,
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
  );
  assert.deepEqual(JSON.parse(String(calls[0]!.init.body)), {
    sql: "SELECT ? AS text_value, ? AS nullable_value, ? AS number_value",
    params: ["value", null, 7],
  });
  assert.equal(
    (calls[0]!.init.headers as Record<string, string>).Authorization,
    `Bearer ${API_TOKEN}`,
  );
});

test("D1 HTTP adapter sends repository statements as one bounded batch", async () => {
  let requestBody: unknown;
  const database = new CloudflareD1HttpDatabase({
    accountId: ACCOUNT_ID,
    databaseId: DATABASE_ID,
    expectedDatabaseName: DATABASE_NAME,
    apiToken: API_TOKEN,
    requestTimeoutMs: 1_000,
    fetcher: async (_input, init) => {
      requestBody = JSON.parse(String(init.body));
      return jsonResponse({
        success: true,
        result: [
          { success: true, results: [] },
          { success: true, results: [] },
        ],
      });
    },
  });
  const statements = [
    database.prepare("INSERT INTO example(value) VALUES (?)").bind("one"),
    database.prepare("UPDATE example SET value = ?").bind("two"),
  ];
  const results = await database.batch(statements);
  assert.equal(results.length, 2);
  assert.deepEqual(requestBody, {
    batch: [
      {
        sql: "INSERT INTO example(value) VALUES (?)",
        params: ["one"],
      },
      {
        sql: "UPDATE example SET value = ?",
        params: ["two"],
      },
    ],
  });
});

test("D1 HTTP adapter verifies database UUID and name before use", async () => {
  const database = new CloudflareD1HttpDatabase({
    accountId: ACCOUNT_ID,
    databaseId: DATABASE_ID,
    expectedDatabaseName: DATABASE_NAME,
    apiToken: API_TOKEN,
    requestTimeoutMs: 1_000,
    fetcher: async (_input, init) => {
      assert.equal(init.method, "GET");
      return jsonResponse({
        success: true,
        result: {
          uuid: DATABASE_ID,
          name: DATABASE_NAME,
        },
      });
    },
  });
  assert.deepEqual(await database.assertExpectedDatabaseIdentity(), {
    uuid: DATABASE_ID,
    name: DATABASE_NAME,
  });
});

test("D1 HTTP adapter fails closed on API errors, partial batches, and foreign statements", async () => {
  const failing = new CloudflareD1HttpDatabase({
    accountId: ACCOUNT_ID,
    databaseId: DATABASE_ID,
    expectedDatabaseName: DATABASE_NAME,
    apiToken: API_TOKEN,
    requestTimeoutMs: 1_000,
    fetcher: async () => jsonResponse({
      success: false,
      errors: [{ code: 7403 }],
    }, 403),
  });
  await assert.rejects(
    failing.prepare("SELECT 1").all(),
    /foundation_d1_api_request_failed:403:7403/u,
  );

  const partial = new CloudflareD1HttpDatabase({
    accountId: ACCOUNT_ID,
    databaseId: DATABASE_ID,
    expectedDatabaseName: DATABASE_NAME,
    apiToken: API_TOKEN,
    requestTimeoutMs: 1_000,
    fetcher: async () => jsonResponse({
      success: true,
      result: [{ success: true, results: [] }],
    }),
  });
  await assert.rejects(
    partial.batch([
      partial.prepare("SELECT 1"),
      partial.prepare("SELECT 2"),
    ]),
    /foundation_d1_batch_result_count_mismatch/u,
  );
  await assert.rejects(
    partial.batch([failing.prepare("SELECT 1")]),
    /foundation_d1_batch_statement_owner_mismatch/u,
  );
});
