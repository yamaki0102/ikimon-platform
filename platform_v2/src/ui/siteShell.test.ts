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
  assert.match(html, /\/api\/v1\/auth\/session/);
  assert.match(html, /credentials: 'same-origin'/);
  assert.match(html, /マイページ/);
});
