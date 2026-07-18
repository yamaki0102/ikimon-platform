import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPublicHomeUxPolish,
  polishPublicHomeUx,
  PUBLIC_HOME_UX_POLISH_PRESENTATION,
} from "./publicHomeUxPolish";

function recordCards(count: number): string {
  return Array.from({ length: count }, (_, index) => (
    `<article class="prototype-record-feed-card"><div><strong>記録${index + 1}</strong></div></article>`
  )).join("");
}

const japaneseHome = `<!doctype html>
<html lang="ja">
<head><title>ikimon</title></head>
<body>
  <aside class="app-install-prompt" data-app-install-prompt hidden>
    <div class="app-install-copy">
      <strong>ikimon を端末に追加</strong>
      <p>ガイド、記録、地図をすぐ開けます。</p>
    </div>
    <div class="app-install-actions">
      <button type="button" data-app-install-action>追加</button>
      <button type="button" data-app-install-dismiss>あとで</button>
    </div>
  </aside>
  <section class="prototype-guest-home">
    <div class="prototype-guest-home-copy">
      <h1>見つけたものを、<span>写真1枚から。</span></h1>
      <p class="prototype-guest-home-lead">名前が分からなくても大丈夫。身近な発見を、地域の記録として残せます。</p>
      <div class="prototype-guest-home-actions is-focused">
        <a class="prototype-guest-home-primary" href="/ja/record?start=photo" data-global-record-trigger="photo">写真を残す</a>
        <a class="prototype-guest-home-secondary" href="/ja/map">近くを地図で見る</a>
      </div>
      <p class="prototype-guest-home-trust">名前はあとで。位置はおおまかに表示されます。</p>
    </div>
    <div class="prototype-guest-home-panel">
      <div class="prototype-guest-home-proof"><div class="prototype-guest-home-proof-grid"><a class="prototype-guest-home-proof-card"><img src="/thumb/1.webp" alt="カワセミ" /><span>写真</span></a></div></div>
      <a class="prototype-guest-home-guide" href="/ja/guide">歩きながらAIガイド</a>
    </div>
  </section>
  <section class="prototype-record-feed is-guest" data-record-feed>
    <div class="prototype-focused-feed-heading"><strong>今日届いた記録</strong><span>身近な発見を、そのまま見られます。</span></div>
    <div class="prototype-record-feed-list">${recordCards(8)}</div>
  </section>
</body>
</html>`;

test("public home suppresses the complete nested install prompt without removing or unbalancing its DOM", () => {
  const polished = applyPublicHomeUxPolish(japaneseHome, "ja");

  assert.match(polished, /<aside[^>]*data-app-install-prompt[^>]*aria-hidden="true"[^>]*hidden[^>]*inert[^>]*data-public-home-install-suppressed="true"[^>]*>/u);
  assert.match(polished, /<div class="app-install-copy">[\s\S]*?<\/div>[\s\S]*?<div class="app-install-actions">[\s\S]*?<\/div>[\s\S]*?<\/aside>/u);
  assert.match(polished, /data-app-install-action>追加<\/button>/u);
  assert.match(polished, /data-app-install-dismiss>あとで<\/button>/u);
  assert.match(polished, /\[data-app-install-prompt\],[\s\S]*\[data-app-install-action\],[\s\S]*\[data-app-install-dismiss\][\s\S]*display: none !important;/u);
  assert.doesNotMatch(polished, /<button[^>]*>追加<\/button>\s*<button[^>]*>あとで<\/button>\s*<\/body>/u);
});

test("public home polish reduces first-visit noise and keeps the camera-first action", () => {
  const polished = applyPublicHomeUxPolish(japaneseHome, "ja");

  assert.doesNotMatch(polished, /prototype-guest-home-guide/u);
  assert.match(polished, /まずは自分の記録として残し、あとから見返せます。/u);
  assert.match(polished, /href="\/ja\/record\?start=photo"[^>]*data-global-record-trigger="photo"/u);
  assert.match(polished, />近くの記録を見る<\/a>/u);
  assert.match(polished, /公開画面では、正確な場所をそのまま表示しません。/u);
  assert.match(polished, /aria-describedby="prototype-guest-home-trust"/u);
  assert.match(polished, /id="prototype-guest-home-trust"/u);
  assert.match(polished, /実際の公開記録/u);
});

test("public home polish shows an honest recent-record heading and limits the first view to six cards", () => {
  const polished = applyPublicHomeUxPolish(japaneseHome, "ja");

  assert.match(polished, /最近の公開記録/u);
  assert.match(polished, /公開されている記録を、最大6件紹介します。/u);
  assert.equal((polished.match(/<article\b[^>]*\bprototype-record-feed-card\b/gu) ?? []).length, 6);
  assert.match(polished, /href="\/ja\/records\?view=public"[^>]*>もっと記録を見る<\/a>/u);
  assert.match(polished, /id="ikimon-public-home-ux-v2"/u);
  assert.match(polished, /:focus-visible/u);
  assert.match(polished, /min-height: 48px/u);
});

test("public home polish is idempotent", () => {
  const once = applyPublicHomeUxPolish(japaneseHome, "ja");
  const twice = applyPublicHomeUxPolish(once, "ja");

  assert.equal(twice, once);
  assert.equal((twice.match(/class="prototype-home-records-more"/gu) ?? []).length, 1);
  assert.equal((twice.match(/id="ikimon-public-home-ux-v2"/gu) ?? []).length, 1);
  assert.equal((twice.match(/data-public-home-install-suppressed="true"/gu) ?? []).length, 1);
});

test("English public home keeps localized routes and copy", () => {
  const englishHome = japaneseHome
    .replace('lang="ja"', 'lang="en"')
    .replace("名前が分からなくても大丈夫。身近な発見を、地域の記録として残せます。", "You do not need the name first. Save a nearby discovery now and let it grow into a local record.")
    .replace("写真を残す", "Save a photo")
    .replace("近くを地図で見る", "Explore nearby")
    .replace("名前はあとで。位置はおおまかに表示されます。", "Names can come later. Public locations are generalized.")
    .replace("今日届いた記録", "Recent local records")
    .replace("身近な発見を、そのまま見られます。", "See what people have noticed nearby.")
    .replaceAll("/ja/", "/en/")
    .replace("<span>写真</span>", "<span>Photo</span>");

  const polished = applyPublicHomeUxPolish(englishHome, "en");

  assert.match(polished, /Save it for yourself now and return to it later\./u);
  assert.match(polished, />See nearby records<\/a>/u);
  assert.match(polished, /Recent public records/u);
  assert.match(polished, /href="\/en\/records\?view=public"/u);
});

test("response wrapper publishes the UX contract only on Japanese and English public home routes", async () => {
  const homeResponse = await polishPublicHomeUx(
    new Request("https://ikimon.life/ja/"),
    new Response(japaneseHome, { headers: { "content-type": "text/html; charset=utf-8" } }),
  );
  assert.equal(homeResponse.headers.get("x-ikimon-home-ux-polish"), PUBLIC_HOME_UX_POLISH_PRESENTATION);
  assert.match(await homeResponse.text(), /data-public-home-install-suppressed="true"/u);

  const mapResponse = await polishPublicHomeUx(
    new Request("https://ikimon.life/ja/map"),
    new Response(japaneseHome, { headers: { "content-type": "text/html; charset=utf-8" } }),
  );
  assert.equal(mapResponse.headers.get("x-ikimon-home-ux-polish"), null);
  assert.match(await mapResponse.text(), /data-app-install-prompt/u);
});
