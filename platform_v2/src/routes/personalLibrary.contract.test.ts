import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

async function withEnv(
  overrides: Record<string, string | undefined>,
  run: () => Promise<void>,
): Promise<void> {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(overrides)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    await run();
  } finally {
    for (const [key, value] of previous.entries()) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function assertHtmlResponse(response: {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: string;
}, lang: "ja" | "en"): void {
  assert.equal(response.statusCode, 200);
  assert.match(String(response.headers["content-type"] ?? ""), /^text\/html\b/i);
  assert.match(response.body, new RegExp(`<html[^>]+lang=["']${lang}["']`, "i"));
}

test("personal library read route remains registered as GET /records", async () => {
  const app = buildApp();
  try {
    await app.ready();
    assert.equal(app.hasRoute({ method: "GET", url: "/records" }), true);
  } finally {
    await app.close();
  }
});

test("public records route keeps the ja and en HTML contracts", async () => {
  const app = buildApp();
  try {
    const ja = await app.inject({
      method: "GET",
      url: "/records?lang=ja",
      headers: { accept: "text/html" },
    });
    assertHtmlResponse(ja, "ja");

    const en = await app.inject({
      method: "GET",
      url: "/records?lang=en",
      headers: { accept: "text/html" },
    });
    assertHtmlResponse(en, "en");
  } finally {
    await app.close();
  }
});

test("signed-in personal library keeps private caching and language behavior", async () => {
  await withEnv({ ALLOW_QUERY_USER_ID: "1" }, async () => {
    const app = buildApp();
    try {
      const ja = await app.inject({
        method: "GET",
        url: "/records?view=mine&userId=personal-library-contract-user&lang=ja",
        headers: { accept: "text/html" },
      });
      assertHtmlResponse(ja, "ja");
      assert.equal(ja.headers["cache-control"], "private, no-store");

      const en = await app.inject({
        method: "GET",
        url: "/records?view=mine&userId=personal-library-contract-user&lang=en",
        headers: { accept: "text/html" },
      });
      assertHtmlResponse(en, "en");
      assert.equal(en.headers["cache-control"], "private, no-store");
    } finally {
      await app.close();
    }
  });
});

test("personal library keeps forwarded base paths in generated navigation", async () => {
  await withEnv({ ALLOW_QUERY_USER_ID: "1" }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/records?view=mine&userId=personal-library-contract-user&lang=ja",
        headers: {
          accept: "text/html",
          "x-forwarded-prefix": "/v2",
        },
      });

      assertHtmlResponse(response, "ja");
      assert.equal(response.headers["cache-control"], "private, no-store");
      assert.match(response.body, /(?:href|action)=["']\/v2\//);
      assert.doesNotMatch(response.body, /\/v2\/v2\//);
    } finally {
      await app.close();
    }
  });
});
