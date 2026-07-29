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

test("kubiaka private-pilot UI is hidden by default", async () => {
  await withEnv({ KUBIAKA_PRIVATE_PILOT_UI_ENABLED: undefined }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/kubiaka?lang=ja",
        headers: { accept: "text/html" },
      });

      assert.equal(response.statusCode, 404);
      assert.equal(response.body, "not found");
    } finally {
      await app.close();
    }
  });
});

test("kubiaka landing keeps the casual one-photo and private-receipt boundary", async () => {
  await withEnv({ KUBIAKA_PRIVATE_PILOT_UI_ENABLED: "1" }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/kubiaka?lang=ja",
        headers: { accept: "text/html" },
      });

      assert.equal(response.statusCode, 200);
      assert.match(response.body, /<html lang="ja">/);
      assert.match(response.body, /近くのサクラを/);
      assert.match(response.body, /撮ってみよう。/);
      assert.match(response.body, /虫を見つけなくても大丈夫/);
      assert.match(response.body, /追加撮影なし/);
      assert.match(response.body, /専門知識なし/);
      assert.match(response.body, /場所はそのまま公開しない/);
      assert.match(response.body, /data-kubiaka-primary-action/);
      assert.match(response.body, /href="\/ja\/kubiaka\/record"/);
      assert.match(response.body, /data-kubiaka-private-receipt/);
      assert.match(response.body, /写真1枚・確認待ち/);
      assert.match(response.body, /この時点では、クビアカツヤカミキリの有無は判断していません。/);
      assert.match(response.body, /勝手に公開・通報しません。/);
      assert.doesNotMatch(response.body, /href="[^"]*\/map(?:[?#"])/);
      assert.doesNotMatch(response.body, /\/kubiaka\/area/);
      assert.equal(response.headers["x-robots-tag"], "noindex, nofollow");
      assert.match(String(response.headers["cache-control"]), /no-store/);
    } finally {
      await app.close();
    }
  });
});

test("kubiaka landing honors English language context", async () => {
  await withEnv({ KUBIAKA_PRIVATE_PILOT_UI_ENABLED: "1" }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/kubiaka?lang=en",
        headers: { accept: "text/html" },
      });

      assert.equal(response.statusCode, 200);
      assert.match(response.body, /<html lang="en">/);
      assert.match(response.body, /Photograph a/);
      assert.match(response.body, /nearby cherry tree\./);
      assert.match(response.body, /No extra shots/);
      assert.match(response.body, /href="\/en\/kubiaka\/record"/);
      assert.doesNotMatch(response.body, /近くのサクラを/);
    } finally {
      await app.close();
    }
  });
});

test("kubiaka guide, about, and faq routes resolve to focused page anchors", async () => {
  await withEnv({ KUBIAKA_PRIVATE_PILOT_UI_ENABLED: "1" }, async () => {
    const app = buildApp();
    try {
      const expectations = [
        ["/kubiaka/guide?lang=ja", "/ja/kubiaka#how-to"],
        ["/kubiaka/about?lang=en", "/en/kubiaka#about"],
        ["/kubiaka/faq?lang=pt-BR", "/pt-br/kubiaka#faq"],
      ] as const;

      for (const [url, location] of expectations) {
        const response = await app.inject({ method: "GET", url });
        assert.equal(response.statusCode, 308);
        assert.equal(response.headers.location, location);
      }
    } finally {
      await app.close();
    }
  });
});

test("kubiaka record entry reuses the existing composer without enabling routing", async () => {
  await withEnv({ KUBIAKA_PRIVATE_PILOT_UI_ENABLED: "1" }, async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/kubiaka/record?lang=ja",
      });

      assert.equal(response.statusCode, 303);
      assert.equal(
        response.headers.location,
        "/ja/record?start=photo&source=kubiaka_watch",
      );
      assert.equal(response.headers["x-robots-tag"], "noindex, nofollow");
      assert.equal(response.headers["cache-control"], "no-store");
    } finally {
      await app.close();
    }
  });
});
