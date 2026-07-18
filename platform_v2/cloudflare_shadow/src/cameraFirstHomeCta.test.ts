import assert from "node:assert/strict";
import test from "node:test";
import {
  enforceCameraFirstHomeCta,
  enforceCameraFirstHomeCtaHtml,
} from "./cameraFirstHomeCta";

const focusedAnchor = `<a data-kpi-target='/ja/record?start=gallery' href='/ja/record?start=gallery' class='other prototype-guest-home-primary' data-kpi-action='landing:guest_home:focused_record'>写真を残す</a>`;

test("camera-first guard rewrites the final focused CTA independent of attribute order and quote style", () => {
  const patched = enforceCameraFirstHomeCtaHtml(focusedAnchor);

  assert.match(patched, /href="\/ja\/record\?start=photo"/u);
  assert.match(patched, /data-kpi-target="\/ja\/record\?start=photo"/u);
  assert.match(patched, /data-global-record-trigger="photo"/u);
  assert.match(patched, /data-record-target="\/ja\/record\?start=photo"/u);
  assert.doesNotMatch(patched, /start=gallery/u);
});

test("camera-first guard is idempotent and preserves non-primary links", () => {
  const html = `${focusedAnchor}<a class="prototype-guest-home-secondary" href="/ja/map">近くを地図で見る</a>`;
  const once = enforceCameraFirstHomeCtaHtml(html);
  const twice = enforceCameraFirstHomeCtaHtml(once);

  assert.equal(twice, once);
  assert.match(twice, /href="\/ja\/map"/u);
  assert.equal((twice.match(/data-global-record-trigger="photo"/gu) ?? []).length, 1);
  assert.equal((twice.match(/data-record-target="\/ja\/record\?start=photo"/gu) ?? []).length, 1);
});

test("camera-first response guard applies only to Japanese and English public homes", async () => {
  for (const path of ["/ja/", "/ja/home", "/en/", "/en/home"] as const) {
    const response = await enforceCameraFirstHomeCta(
      new Request(`https://ikimon.life${path}`),
      new Response(focusedAnchor, { headers: { "content-type": "text/html; charset=utf-8", etag: "old" } }),
    );
    const body = await response.text();

    assert.equal(response.headers.get("x-ikimon-home-capture-entry"), "camera-first-v2");
    assert.equal(response.headers.get("etag"), null);
    assert.match(body, /start=photo/u);
    assert.doesNotMatch(body, /start=gallery/u);
  }

  const spanish = await enforceCameraFirstHomeCta(
    new Request("https://ikimon.life/es/"),
    new Response(focusedAnchor, { headers: { "content-type": "text/html" } }),
  );
  assert.equal(spanish.headers.get("x-ikimon-home-capture-entry"), null);
  assert.match(await spanish.text(), /start=gallery/u);

  const records = await enforceCameraFirstHomeCta(
    new Request("https://ikimon.life/ja/records"),
    new Response(focusedAnchor, { headers: { "content-type": "text/html" } }),
  );
  assert.equal(records.headers.get("x-ikimon-home-capture-entry"), null);
  assert.match(await records.text(), /start=gallery/u);
});

test("non-HTML responses are preserved", async () => {
  const response = await enforceCameraFirstHomeCta(
    new Request("https://ikimon.life/ja/"),
    Response.json({ href: "/ja/record?start=gallery" }),
  );

  assert.deepEqual(await response.json(), { href: "/ja/record?start=gallery" });
  assert.equal(response.headers.get("x-ikimon-home-capture-entry"), null);
});
