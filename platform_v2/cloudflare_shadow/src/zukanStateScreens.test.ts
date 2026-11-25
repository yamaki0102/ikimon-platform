import assert from "node:assert/strict";
import test from "node:test";
import worker from "./index";

const base = "https://zukan.earth";
const htmlHeaders = { accept: "text/html,application/xhtml+xml" };

test("K1-K4: /ja/state/* が見本の文言で出る", async () => {
  const k1 = await worker.fetch(new Request(`${base}/ja/state/loading`, { headers: htmlHeaders }), {} as never);
  assert.equal(k1.status, 200);
  const k1Html = await k1.text();
  assert.match(k1Html, /読み込んでいます/);
  assert.match(k1Html, /通信状態によっては、少し時間がかかります。/);

  const k2 = await worker.fetch(new Request(`${base}/ja/state/error?from=${encodeURIComponent("/ja/library")}`, { headers: htmlHeaders }), {} as never);
  const k2Html = await k2.text();
  assert.match(k2Html, /読み込めませんでした/);
  assert.match(k2Html, /通信に失敗しました。<br>場所を変えて、もう一度お試しください。/);
  assert.match(k2Html, /href="\/ja\/library">もう一度</);
  assert.match(k2Html, /保存済みの記録/);

  const k3 = await worker.fetch(new Request(`${base}/ja/state/offline`, { headers: htmlHeaders }), {} as never);
  const k3Html = await k3.text();
  assert.match(k3Html, /オフラインです/);
  assert.match(k3Html, /撮る（オフラインでも撮れます）/);

  const k4 = await worker.fetch(new Request(`${base}/ja/state/no-access`, { headers: htmlHeaders }), {} as never);
  assert.match(await k4.text(), /このページは見られません/);
});

test("K2: ページの読み込みで内部エラーになったら、見本のエラー画面を出す（APIはこれまでどおりJSON）", async () => {
  const broken = {} as never;
  const page = await worker.fetch(new Request(`${base}/ja/observations/xyz`, { headers: htmlHeaders }), broken);
  assert.equal(page.status, 500);
  assert.equal(page.headers.get("cache-control"), "no-store");
  const pageHtml = await page.text();
  assert.match(pageHtml, /読み込めませんでした/);
  assert.match(pageHtml, /href="\/ja\/observations\/xyz">もう一度</);
  assert.match(pageHtml, /保存済みの記録/);

  await assert.rejects(
    worker.fetch(new Request(`${base}/ja/observations/xyz`, { headers: { accept: "application/json" } }), broken),
    TypeError
  );
});

test("K4: 見られない共有リンクは、見本の画面で404を返す", async () => {
  const res = await worker.fetch(new Request(`${base}/ja/share/share_${"0".repeat(32)}`, { headers: htmlHeaders }), {} as never);
  assert.equal(res.status, 404);
  const body = await res.text();
  assert.match(body, /このページは見られません/);
  assert.match(body, /公開が取り消されたか、リンクの期限が切れている可能性があります。/);
  assert.match(body, />トップへ戻る</);
  assert.match(body, />.*探す</);
});
