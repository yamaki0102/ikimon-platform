import assert from "node:assert/strict";
import test from "node:test";
import {
  applyFocusedPublicHomeRedesign,
  FOCUSED_PUBLIC_HOME_PRESENTATION,
} from "./publicFocusedHomeRedesign";
import { patchPublicHomePresentation } from "./publicPresentationPatch";

const japaneseHome = `<!doctype html>
<html lang="ja">
<head><title>ikimon</title></head>
<body>
  <aside data-app-install-prompt>ikimon を端末に追加</aside>
  <section class="prototype-guest-home" aria-labelledby="prototype-guest-home-heading">
    <div class="prototype-guest-home-copy">
      <span>ikimon.life</span>
      <h1 id="prototype-guest-home-heading">地域の記録から始める</h1>
      <p>地図、フィールド、みんなの公開記録から、今日歩く場所やあとで見返す手がかりを探せます。名前が分からない記録も、地域の記憶として残ります。</p>
      <div class="prototype-guest-home-actions">
        <a class="prototype-guest-home-primary" href="/ja/records?view=public">地域の記録を見る</a>
        <a href="/ja/map">地図で探す</a>
        <a href="/ja/community/fields">フィールドを探す</a>
      </div>
    </div>
    <div class="prototype-guest-home-panel">
      <div class="prototype-guest-home-proof"><div class="prototype-guest-home-proof-grid"><a class="prototype-guest-home-proof-card"><img src="/thumb/1.webp" alt="カワセミ" /><span>写真</span></a></div></div>
      <div class="prototype-guest-home-stats"><span><strong>12</strong><small>公開記録</small></span></div>
      <div class="prototype-guest-home-notes"><span>地域の記録から入る</span></div>
      <a class="prototype-guest-home-guide" href="/ja/guide">歩きながらAIガイド</a>
    </div>
  </section>
  <section class="prototype-record-feed is-guest" data-record-feed><div class="prototype-record-feed-list"><article class="prototype-record-feed-card"><strong>カワセミ</strong></article></div></section>
</body>
</html>`;

test("focused Japanese home makes one photo the primary action and preserves real records", () => {
  const redesigned = applyFocusedPublicHomeRedesign(japaneseHome);

  assert.match(redesigned, /見つけたものを、<span>写真1枚から。<\/span>/u);
  assert.match(redesigned, /名前が分からなくても大丈夫。身近な発見を、地域の記録として残せます。/u);
  assert.match(redesigned, /href="\/ja\/record\?start=gallery"[^>]*>写真を残す<\/a>/u);
  assert.match(redesigned, /href="\/ja\/map"[^>]*>近くを地図で見る<\/a>/u);
  assert.match(redesigned, /名前はあとで。位置はおおまかに表示されます。/u);
  assert.match(redesigned, /prototype-focused-feed-heading"><strong>今日届いた記録<\/strong>/u);
  assert.match(redesigned, /id="ikimon-focused-home-v3"/u);
  assert.match(redesigned, /\[data-app-install-prompt\][\s\S]*display: none !important/u);
  assert.match(redesigned, /カワセミ/u);
  assert.match(redesigned, /\/thumb\/1\.webp/u);
  assert.doesNotMatch(redesigned, />フィールドを探す<\/a>/u);
  assert.doesNotMatch(redesigned, />地域の記録を見る<\/a>/u);
});

test("focused mobile CSS contains full-width actions and media at 320px", () => {
  const redesigned = applyFocusedPublicHomeRedesign(japaneseHome);

  assert.match(redesigned, /\.prototype-guest-home-actions\.is-focused a \{[\s\S]*max-width: 100%;[\s\S]*box-sizing: border-box;/u);
  assert.match(redesigned, /@media \(max-width: 360px\)[\s\S]*max-width: calc\(100vw - 24px\)/u);
  assert.match(redesigned, /\.prototype-guest-home-proof-card:first-child \{[\s\S]*width: 100%;/u);
  assert.match(redesigned, /\.prototype-record-feed\.is-guest,[\s\S]*max-width: 100%;[\s\S]*box-sizing: border-box;/u);
});

test("focused home redesign is idempotent", () => {
  const once = applyFocusedPublicHomeRedesign(japaneseHome);
  const twice = applyFocusedPublicHomeRedesign(once);

  assert.equal(twice, once);
  assert.equal((twice.match(/id="ikimon-focused-home-v3"/gu) ?? []).length, 1);
  assert.equal((twice.match(/<div class="prototype-focused-feed-heading">/gu) ?? []).length, 1);
});

test("focused English home keeps localized routes", () => {
  const html = japaneseHome
    .replace('lang="ja"', 'lang="en"')
    .replace("地域の記録から始める", "Start from local records")
    .replace(
      "地図、フィールド、みんなの公開記録から、今日歩く場所やあとで見返す手がかりを探せます。名前が分からない記録も、地域の記憶として残ります。",
      "Browse public records, the map, and fields to choose where to walk today and what to revisit later.",
    )
    .replace("/ja/records?view=public", "/en/records?view=public")
    .replace("/ja/map", "/en/map")
    .replace("/ja/community/fields", "/en/community/fields");

  const redesigned = applyFocusedPublicHomeRedesign(html);

  assert.match(redesigned, /Begin with <span>one photo.<\/span>/u);
  assert.match(redesigned, /href="\/en\/record\?start=gallery"[^>]*>Save a photo<\/a>/u);
  assert.match(redesigned, /href="\/en\/map"[^>]*>Explore nearby<\/a>/u);
  assert.match(redesigned, /Recent local records/u);
});

test("response patch publishes the focused home contract", async () => {
  const response = await patchPublicHomePresentation(
    new Request("https://ikimon.life/ja/"),
    new Response(japaneseHome, { headers: { "content-type": "text/html; charset=utf-8" } }),
  );

  assert.equal(response.headers.get("x-ikimon-home-redesign"), FOCUSED_PUBLIC_HOME_PRESENTATION);
  assert.match(await response.text(), /写真を残す/u);
});

test("Spanish and Portuguese home layouts stay outside the focused redesign", async () => {
  for (const lang of ["es", "pt-br"] as const) {
    const response = await patchPublicHomePresentation(
      new Request(`https://ikimon.life/${lang}/`),
      new Response(japaneseHome.replace('lang="ja"', `lang="${lang}"`), {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
    );
    const body = await response.text();

    assert.equal(response.headers.get("x-ikimon-home-redesign"), null);
    assert.match(body, /地域の記録から始める/u);
    assert.doesNotMatch(body, /ikimon-focused-home-v3/u);
  }
});
