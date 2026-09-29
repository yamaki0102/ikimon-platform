import assert from "node:assert/strict";
import test from "node:test";
import { EVENT_TEMPLATE_PREVIEW_ROUTES, handleEventTemplatePreviewPage } from "./eventTemplatePages";
import { worker } from "./index";

test("four event preview routes use the shared template contract and remain unlisted", async () => {
  const expectedKeys = ["stamp-rally", "mission-quest", "collaborative-observation", "ryuyo"];
  const routes = Object.values(EVENT_TEMPLATE_PREVIEW_ROUTES);
  assert.equal(routes.length, 4);

  for (let index = 0; index < routes.length; index += 1) {
    const route = routes[index];
    assert.ok(route);
    const response = handleEventTemplatePreviewPage(new Request("https://zukan.test" + route), route);
    assert.ok(response);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/html/u);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex, nofollow, noarchive/u);
    const html = await response.text();
    const expectedKey = expectedKeys[index];
    assert.ok(expectedKey);
    assert.match(html, /name="robots" content="noindex,nofollow,noarchive"/u);
    assert.match(html, /data-event-template-contract="event-template-v1"/u);
    assert.match(html, new RegExp("data-template-key=\"" + expectedKey + "\"", "u"));
    assert.doesNotMatch(html, /<form\b|<input\b|参加者数|参加しました|登録者/u);
    assert.doesNotMatch(html, /site-nav|site-record-link/u);
  }
});

test("Worker dispatch serves all four preview URLs without event data bindings", async () => {
  for (const route of Object.values(EVENT_TEMPLATE_PREVIEW_ROUTES)) {
    const response = await worker.fetch(new Request("https://zukan.test" + route), {} as never);
    assert.equal(response.status, 200, route);
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/u, route);
    assert.match(await response.text(), /data-event-template-contract="event-template-v1"/u, route);
  }
});

test("Ryuyo preview states that event facts and sign-up are not confirmed", async () => {
  const route = EVENT_TEMPLATE_PREVIEW_ROUTES.ryuyo;
  const response = handleEventTemplatePreviewPage(new Request("https://zukan.test" + route), route);
  assert.ok(response);
  const html = await response.text();
  assert.match(html, /竜洋昆虫自然観察公園/u);
  assert.match(html, /公園の公式告知や、開催決定を示すものではありません/u);
  assert.match(html, /開催日<\/dt><dd>未登録/u);
  assert.match(html, /申込み<\/dt><dd>受付なし/u);
  assert.match(html, /費用・定員<\/dt><dd>未確認/u);
});

test("preview route handler only serves GET and HEAD for its exact paths", () => {
  const route = EVENT_TEMPLATE_PREVIEW_ROUTES.stampRally;
  assert.equal(handleEventTemplatePreviewPage(new Request("https://zukan.test" + route, { method: "POST" }), route), null);
  assert.equal(handleEventTemplatePreviewPage(new Request("https://zukan.test/preview/events/unknown"), "/preview/events/unknown"), null);
});

test("HEAD preview has the same metadata and no response body", async () => {
  const route = EVENT_TEMPLATE_PREVIEW_ROUTES.missionQuest;
  const response = handleEventTemplatePreviewPage(new Request("https://zukan.test" + route, { method: "HEAD" }), route);
  assert.ok(response);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/u);
  assert.equal(await response.text(), "");
});
