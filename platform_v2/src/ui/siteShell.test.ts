import assert from "node:assert/strict";
import test from "node:test";
import { renderSiteDocument } from "./siteShell.js";

test("site shell hydrates the login link from the v2 session endpoint", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "ja",
  });

  assert.match(html, /class="btn btn-ghost site-login-link"/);
  assert.match(html, /\/login\?redirect=%2Fprofile/);
  assert.match(html, /\/api\/v1\/auth\/session/);
  assert.match(html, /credentials: 'same-origin'/);
  assert.match(html, /マイページ/);
});

test("site shell renders a global record footer nav outside the record flow", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Test",
    body: "<p>body</p>",
    lang: "ja",
    currentPath: "/?lang=ja",
  });

  assert.match(html, /class="global-record-launcher"/);
  assert.equal(html.match(/<a class="global-record-choice/g)?.length, 4);
  assert.doesNotMatch(html, /class="global-record-entry"/);
  assert.doesNotMatch(html, /aria-expanded="false"/);
  assert.match(html, /data-kpi-action="global_record_photo"/);
  assert.match(html, /data-kpi-action="global_record_video"/);
  assert.match(html, /data-kpi-action="global_record_gallery"/);
  assert.match(html, /data-kpi-action="global_record_guide"/);
  assert.match(html, /href="\/record\?start=photo&amp;lang=ja"/);
  assert.match(html, /href="\/record\?start=video&amp;lang=ja"/);
  assert.match(html, /href="\/record\?start=gallery&amp;lang=ja"/);
  assert.match(html, /href="\/guide\?lang=ja"/);
});

test("site shell does not duplicate the record entry on the record page", () => {
  const html = renderSiteDocument({
    basePath: "",
    title: "Record",
    body: "<p>record</p>",
    lang: "ja",
    currentPath: "/record?lang=ja",
  });

  assert.doesNotMatch(html, /class="global-record-launcher"/);
  assert.doesNotMatch(html, /class="global-record-entry"/);
});
