import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";

const HAMAMATSU_NUTRIA_HTML = `
<!doctype html>
<html lang="ja">
<body>
  <p>更新日：2026年2月12日</p>
  <h1>ヌートリア</h1>
  <h2>ヌートリアについて</h2>
  <p>ヌートリアは南米原産の、大型のネズミの仲間です。近年浜松市内でも確認されるようになりました。水辺を好み、河川や水路、ため池の近くでよく見かけます。</p>
  <p><a href="/documents/116720/nutoria_20250109.pdf">チラシ（PDF：1,235KB）</a></p>
  <p><a href="https://logoform.jp/f/SApoz">入力フォーム</a></p>
  <p>野生生物ですので見かけても触らないでください。</p>
</body>
</html>
`;

async function withMockedFetch(
  fetchImpl: typeof fetch,
  run: () => Promise<void>,
): Promise<void> {
  const previous = global.fetch;
  global.fetch = fetchImpl;
  try {
    await run();
  } finally {
    global.fetch = previous;
  }
}

function successFetch(): typeof fetch {
  return (async (input) => {
    const url = String(input);
    if (url.includes("overpass-api.de")) {
      return new Response(JSON.stringify({
        elements: [
          { tags: { natural: "water" }, center: { lat: 34.7222, lon: 137.8592 } },
          { tags: { landuse: "residential" }, center: { lat: 34.7221, lon: 137.8588 } },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("cyberjapandata.gsi.go.jp")) {
      return new Response(JSON.stringify({ elevation: 9 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("city.hamamatsu.shizuoka.jp")) {
      return new Response(HAMAMATSU_NUTRIA_HTML, {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
    throw new Error(`unexpected_fetch:${url}`);
  }) as typeof fetch;
}

function municipalFailureFetch(): typeof fetch {
  return (async (input) => {
    const url = String(input);
    if (url.includes("overpass-api.de")) {
      return new Response(JSON.stringify({
        elements: [
          { tags: { natural: "water" }, center: { lat: 34.7222, lon: 137.8592 } },
        ],
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("cyberjapandata.gsi.go.jp")) {
      return new Response(JSON.stringify({ elevation: 9 }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("city.hamamatsu.shizuoka.jp")) {
      throw new Error("municipal_page_failed");
    }
    throw new Error(`unexpected_fetch:${url}`);
  }) as typeof fetch;
}

test("site brief route returns official notices for relevant hamamatsu waterside points", async () => {
  await withMockedFetch(successFetch(), async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/map/site-brief?lat=34.7219&lng=137.8589&lang=ja",
      });
      assert.equal(response.statusCode, 200);
      const payload = response.json();
      assert.ok(payload.hypothesis);
      assert.ok(Array.isArray(payload.officialNotices));
      assert.equal(payload.officialNotices.length, 1);
      assert.equal(payload.officialNotices[0]?.id, "hamamatsu_nutria");
      assert.ok(payload.officialNotices[0]?.attachments.some((attachment: { url: string }) => attachment.url.endsWith("/nutoria_20250109.pdf")));
    } finally {
      await app.close();
    }
  });
});

test("site brief route stays 200 and returns an empty notice list when municipal fetch fails", async () => {
  await withMockedFetch(municipalFailureFetch(), async () => {
    const app = buildApp();
    try {
      const response = await app.inject({
        method: "GET",
        url: "/api/v1/map/site-brief?lat=34.7219&lng=137.8589&lang=ja",
      });
      assert.equal(response.statusCode, 200);
      const payload = response.json();
      assert.ok(payload.hypothesis);
      assert.deepEqual(payload.officialNotices, []);
    } finally {
      await app.close();
    }
  });
});
