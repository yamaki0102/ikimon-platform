import assert from "node:assert/strict";
import test from "node:test";
import {
  OFFICIAL_NOTICE_SOURCES,
  parseHamamatsuNutriaPage,
  resolveOfficialNoticeCards,
} from "./officialNotices.js";
import type { SiteSignals } from "./siteBrief.js";

const HAMAMATSU_NUTRIA_HTML = `
<!doctype html>
<html lang="ja">
<body>
  <p>更新日：2026年2月12日</p>
  <h1>ヌートリア</h1>
  <h2>ヌートリアについて</h2>
  <p>ヌートリアは南米原産の、大型のネズミの仲間です。西日本を中心に分布が広がっていましたが、近年浜松市内でも確認されるようになりました。水辺を好み、河川や水路、ため池の近くでよく見かけます。</p>
  <p><a href="/documents/116720/r6nutria_mokugeki.pdf">令和6年度ヌートリア目撃情報（PDF：1,235KB）</a></p>
  <p><a href="/documents/116720/nutoria_20250109.pdf">チラシ（PDF：1,235KB）</a></p>
  <p><a href="https://logoform.jp/f/SApoz">入力フォーム（別ウィンドウが開きます）</a></p>
  <p>野生生物ですので見かけても触らないでください。</p>
  <p>法律により許可なく捕獲、飼育、運搬、放出することなどが禁止されています。</p>
</body>
</html>
`;

function mockFetchFactory(html = HAMAMATSU_NUTRIA_HTML): typeof fetch {
  return (async () => new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  })) as typeof fetch;
}

test("hamamatsu nutria parser extracts canonical notice fields", () => {
  const source = OFFICIAL_NOTICE_SOURCES[0]!;
  const snapshot = parseHamamatsuNutriaPage({
    html: HAMAMATSU_NUTRIA_HTML,
    source,
    fetchedAt: "2026-04-20T12:00:00.000Z",
  });

  assert.equal(snapshot.updatedAt, "2026-02-12");
  assert.equal(snapshot.pageUrl, source.sourcePageUrl);
  assert.equal(snapshot.reportUrl, "https://logoform.jp/f/SApoz");
  assert.ok(snapshot.attachments.some((attachment) => attachment.url.endsWith("/nutoria_20250109.pdf")));
  assert.ok(snapshot.summary.includes("浜松市内でも確認されるようになりました"));
});

test("official notice resolver only returns cards for hamamatsu waterside context", async () => {
  const watersideSignals: SiteSignals = {
    landcover: ["built_up"],
    nearbyLandcover: ["water"],
    waterDistanceM: 120,
    elevationM: 8,
  };
  const drySignals: SiteSignals = {
    landcover: ["built_up"],
    nearbyLandcover: [],
    waterDistanceM: 680,
    elevationM: 22,
  };

  const watersideCards = await resolveOfficialNoticeCards(34.7219, 137.8589, watersideSignals, "ja", mockFetchFactory());
  assert.equal(watersideCards.length, 1);
  assert.equal(watersideCards[0]?.id, "hamamatsu_nutria");

  const dryCards = await resolveOfficialNoticeCards(34.7219, 137.8589, drySignals, "ja", mockFetchFactory());
  assert.equal(dryCards.length, 0);

  const outsideCards = await resolveOfficialNoticeCards(35.101, 138.383, watersideSignals, "ja", mockFetchFactory());
  assert.equal(outsideCards.length, 0);
});
