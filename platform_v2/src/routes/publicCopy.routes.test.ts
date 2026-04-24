import assert from "node:assert/strict";
import test from "node:test";
import { JA_PUBLIC_INTERNAL_JARGON } from "../copy/jaPublic.js";
import { buildApp } from "../app.js";

const shallowJaRoutes = [
  "/?lang=ja",
  "/notes?lang=ja",
  "/lens?lang=ja",
  "/map?lang=ja",
  "/about?lang=ja",
  "/faq?lang=ja",
  "/contact?lang=ja",
];

test("shallow public ja routes avoid internal jargon", async () => {
  const app = buildApp();
  try {
    for (const url of shallowJaRoutes) {
      const response = await app.inject({ method: "GET", url, headers: { accept: "text/html" } });
      assert.equal(response.statusCode, 200, `${url} should render`);
      const visibleBody = response.body.replace(/href="[^"]+"/g, 'href=""');
      for (const jargon of JA_PUBLIC_INTERNAL_JARGON) {
        assert.doesNotMatch(visibleBody, new RegExp(jargon, "i"), `${url} should not include ${jargon}`);
      }
      assert.doesNotMatch(visibleBody, /AI が自動で(決め|確定)/, `${url} should keep AI as a hint`);
    }
  } finally {
    await app.close();
  }
});

test("general and group-help pages use the updated ja entry copy", async () => {
  const app = buildApp();
  try {
    const about = await app.inject({ method: "GET", url: "/about?lang=ja" });
    assert.equal(about.statusCode, 200);
    assert.match(about.body, /自然を楽しむ入口から始める/);
    assert.match(about.body, /研究と信頼性を見る/);

    const business = await app.inject({ method: "GET", url: "/for-business?lang=ja" });
    assert.equal(business.statusCode, 200);
    assert.match(business.body, /学校や地域で始めたいときの相談窓口/);
    assert.match(business.body, /団体相談を見る/);

    const businessDemo = await app.inject({ method: "GET", url: "/for-business/demo?lang=ja" });
    assert.equal(businessDemo.statusCode, 200);
    assert.doesNotMatch(businessDemo.body, /ops\/readiness/i);

    const businessStatus = await app.inject({ method: "GET", url: "/for-business/status?lang=ja" });
    assert.equal(businessStatus.statusCode, 200);
    assert.doesNotMatch(businessStatus.body, /readiness/i);
    assert.doesNotMatch(businessStatus.body, /rollback/i);
  } finally {
    await app.close();
  }
});

test("home hero and how-it-works copy match the canonical ja surface", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/?lang=ja", headers: { accept: "text/html" } });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /ENJOY NATURE/);
    assert.match(response.body, /見つける。調べる。残す。だれかの役に立つ。/);
    assert.doesNotMatch(response.body, /フィールドループ/);
  } finally {
    await app.close();
  }
});

test("contact page renders content-backed form copy", async () => {
  const app = buildApp();
  try {
    const response = await app.inject({ method: "GET", url: "/contact?lang=ja" });
    assert.equal(response.statusCode, 200);
    assert.match(response.body, /カテゴリ/);
    assert.match(response.body, /送信する/);
    assert.match(response.body, /受付番号/);
  } finally {
    await app.close();
  }
});
