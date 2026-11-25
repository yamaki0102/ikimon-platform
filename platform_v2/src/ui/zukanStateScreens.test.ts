import assert from "node:assert/strict";
import test from "node:test";
import { buildApp } from "../app.js";
import { renderZukanStateDocument } from "./zukanStateScreens.js";

test("K3: /offline.html（日本語）は『写真は消えません』を約束する新しい画面で、他言語は従来のまま", async () => {
  const app = buildApp();
  try {
    const ja = await app.inject({ method: "GET", url: "/offline.html?lang=ja" });
    assert.equal(ja.statusCode, 200);
    assert.match(ja.body, /data-zukan-state="k3"/);
    assert.match(ja.body, /オフラインです/);
    assert.match(ja.body, /いまは通信できません。<br>撮った写真は端末に保存され、通信が戻ると自動で送られます。/);
    assert.match(ja.body, /撮る（オフラインでも撮れます）/);
    assert.match(ja.body, /href="\/ja\/record"/);
    assert.match(ja.body, /いま見られるもの/);
    assert.match(ja.body, /保存済みの記録/);
    assert.match(ja.body, /href="\/ja\/records\?view=mine"/);
    assert.match(ja.body, /data-offline-retry/);

    const en = await app.inject({ method: "GET", url: "/offline.html?lang=en" });
    assert.equal(en.statusCode, 200);
    assert.doesNotMatch(en.body, /data-zukan-state="k3"/);
    assert.match(en.body, /You are offline/);
  } finally {
    await app.close();
  }
});

test("K1/K2/K4 の文言と主な行き先", () => {
  const k1 = renderZukanStateDocument("loading", { prefix: "/ja" });
  assert.match(k1, /読み込んでいます/);
  assert.match(k1, /通信状態によっては、少し時間がかかります。/);
  assert.match(k1, /zukan-lockup\.svg/);

  const k2 = renderZukanStateDocument("error", { prefix: "/ja", retryHref: "/ja/library?x=1" });
  assert.match(k2, /読み込めませんでした/);
  assert.match(k2, /href="\/ja\/library\?x=1">もう一度</);
  assert.match(k2, /保存済みの記録/);
  assert.match(k2, />ライブラリへ戻る</);

  const hostile = renderZukanStateDocument("error", { prefix: "/ja", retryHref: "//evil.example/x" });
  assert.doesNotMatch(hostile, /evil\.example/);

  const k4 = renderZukanStateDocument("no-access", { prefix: "/ja" });
  assert.match(k4, /このページは見られません/);
  assert.match(k4, /新しいリンクを聞いてみてください。/);
  assert.match(k4, /href="\/ja\/">トップへ戻る</);
  assert.match(k4, /探す/);
});

test("K3: 状態画面は大きなマークを出さず白地に固定", () => {
  const k3 = renderZukanStateDocument("offline", { prefix: "/ja" });
  assert.doesNotMatch(k3, /class="mark"/);
  assert.match(k3, /html body\[data-zukan-design\]\{display:block;min-height:0;padding:0;background:#fff\}/);
});
