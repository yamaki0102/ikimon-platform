import assert from "node:assert/strict";
import test from "node:test";
import {
  isNormalPublicHomeRequest,
  patchPublicHomePresentation,
  routeFocusedHomePrimaryCtaToPhotoCamera,
  rewriteHomePublicRecordsAvailability,
  stripPassiveIdentificationFromHomeHtml,
} from "./publicPresentationPatch";

test("public home presentation removes passive unresolved labels but keeps real titles", () => {
  const html = `<main>
    <article class="prototype-record-feed-card"><strong>カワセミ</strong></article>
    <article class="prototype-record-feed-card"><strong>名前待ち</strong></article>
    <article class="prototype-record-feed-card"><strong>名前待ちの写真</strong></article>
    <article class="prototype-record-feed-card"><strong>名前待ちの動画</strong></article>
    <article class="prototype-record-feed-card"><strong>名前待ちの音</strong></article>
    <article class="prototype-record-feed-card"><strong>名前待ちのメモ</strong></article>
    <div class="prototype-guest-home-stats"><span><strong>12</strong><small>名前確認中</small></span></div>
    <div class="prototype-guest-home-notes"><span>名前は後で確かめる</span></div>
    <a href="/observations/1#identify">名前を手伝う</a>
  </main>`;

  const patched = stripPassiveIdentificationFromHomeHtml(html);

  assert.match(patched, /カワセミ/);
  assert.doesNotMatch(patched, /名前待ち/);
  assert.doesNotMatch(patched, /名前確認中/);
  assert.doesNotMatch(patched, /名前は後で確かめる/);
  assert.doesNotMatch(patched, /名前を手伝う/);
});

test("focused public home primary CTA opens the shared photo camera trigger", () => {
  const html = `<a class="prototype-guest-home-primary" href="/ja/record?start=gallery" data-kpi-target="/ja/record?start=gallery">写真を残す</a>`;

  const patched = routeFocusedHomePrimaryCtaToPhotoCamera(html);

  assert.match(patched, /href="\/ja\/record\?start=photo"/u);
  assert.match(patched, /data-kpi-target="\/ja\/record\?start=photo"/u);
  assert.match(patched, /data-global-record-trigger="photo"/u);
  assert.match(patched, /data-record-target="\/ja\/record\?start=photo"/u);
  assert.doesNotMatch(patched, /start=gallery/u);
});

test("home public-records proof points guests to the records page", () => {
  const patched = rewriteHomePublicRecordsAvailability(
    '<div data-home-contract="state-split-v1"><strong>ホームで紹介する記録は準備中です。</strong><strong>Featured records are being prepared.</strong><strong>Estamos preparando los registros destacados.</strong><strong>Estamos preparando os registros em destaque.</strong></div>',
  );

  assert.match(patched, /公開記録は、記録のページから見つけられます。/u);
  assert.match(patched, /Public records are available on the records page\./u);
  assert.match(patched, /Los registros públicos están disponibles en la página de registros\./u);
  assert.match(patched, /Os registros públicos estão disponíveis na página de registros\./u);
  assert.doesNotMatch(patched, /準備中|being prepared|preparando/u);
});

test("only public home aliases receive the final presentation patch", () => {
  assert.equal(isNormalPublicHomeRequest(new Request("https://ikimon.life/")), true);
  assert.equal(isNormalPublicHomeRequest(new Request("https://ikimon.life/home")), true);
  assert.equal(isNormalPublicHomeRequest(new Request("https://ikimon.life/ja/")), true);
  assert.equal(isNormalPublicHomeRequest(new Request("https://ikimon.life/en/home")), true);
  assert.equal(isNormalPublicHomeRequest(new Request("https://ikimon.life/records?view=public")), false);
  assert.equal(isNormalPublicHomeRequest(new Request("https://ikimon.life/records?view=needs_id")), false);
  assert.equal(isNormalPublicHomeRequest(new Request("https://ikimon.life/", { method: "POST" })), false);
});

test("final HTML patch sets a no-store presentation contract on home", async () => {
  const request = new Request("https://ikimon.life/ja/");
  const response = new Response("<main><strong>名前待ちの写真</strong><strong>カワセミ</strong></main>", {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-length": "999",
      etag: "stale",
    },
  });

  const patched = await patchPublicHomePresentation(request, response);

  assert.equal(patched.status, 200);
  assert.equal(patched.headers.get("cache-control"), "no-cache, no-store, must-revalidate");
  assert.equal(patched.headers.get("x-ikimon-presentation-contract"), "light-home-v2");
  assert.equal(patched.headers.get("x-ikimon-home-capture-contract"), "camera-first-v1");
  assert.equal(patched.headers.get("etag"), null);
  assert.doesNotMatch(await patched.text(), /名前待ち/);
});

test("state-split home receives the public-records proof patch without materialization", async () => {
  const response = await patchPublicHomePresentation(
    new Request("https://ikimon.life/ja/"),
    new Response('<main data-home-contract="state-split-v1"><strong>ホームで紹介する記録は準備中です。</strong></main>', {
      headers: { "content-type": "text/html; charset=utf-8" },
    }),
  );

  assert.match(await response.text(), /公開記録は、記録のページから見つけられます。/u);
  assert.equal(response.headers.get("x-ikimon-presentation-contract"), "state-split-home-v1");
});

test("dedicated name review and non-HTML responses remain unchanged", async () => {
  const review = new Response("<strong>名前待ち</strong>", { headers: { "content-type": "text/html" } });
  const preservedReview = await patchPublicHomePresentation(
    new Request("https://ikimon.life/ja/records?view=needs_id"),
    review,
  );
  assert.match(await preservedReview.text(), /名前待ち/);

  const api = Response.json({ label: "名前待ち" });
  const preservedApi = await patchPublicHomePresentation(new Request("https://ikimon.life/api/v1/example"), api);
  assert.equal((await preservedApi.json() as { label: string }).label, "名前待ち");
});
