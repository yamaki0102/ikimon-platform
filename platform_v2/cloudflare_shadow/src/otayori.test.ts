import assert from "node:assert/strict";
import test from "node:test";
import {
  OTAYORI_STATUSES,
  renderOtayoriFloatingButton,
  renderOtayoriPage,
  shouldNotifyOtayoriStatus,
  shouldShowOtayoriButton,
} from "./otayori";

test("otayori defines 7 statuses, notifies only on replied, removes floating FAB, and uses 改善のご要望 copy", () => {
  assert.equal(OTAYORI_STATUSES.length, 7);
  for (const status of OTAYORI_STATUSES) {
    assert.equal(shouldNotifyOtayoriStatus(status), status === "replied");
  }

  assert.equal(shouldShowOtayoriButton({ pathname: "/ja/" }), true);
  assert.equal(shouldShowOtayoriButton({ pathname: "/ja/records" }), true);
  assert.equal(shouldShowOtayoriButton({ pathname: "/ja/record" }), false);
  assert.equal(shouldShowOtayoriButton({ pathname: "/record" }), false);
  assert.equal(shouldShowOtayoriButton({ pathname: "/ja/map" }), false);
  assert.equal(shouldShowOtayoriButton({ pathname: "/map" }), false);
  assert.equal(shouldShowOtayoriButton({ pathname: "/ja/", isCamera: true }), false);
  assert.equal(shouldShowOtayoriButton({ pathname: "/ja/", isFullscreenMap: true }), false);

  assert.equal(renderOtayoriFloatingButton({ lang: "ja", pathname: "/ja/" }), "");
  assert.equal(renderOtayoriFloatingButton({ lang: "ja", pathname: "/ja/record" }), "");
  assert.equal(renderOtayoriFloatingButton({ lang: "ja", pathname: "/ja/map" }), "");

  const pageHtml = renderOtayoriPage({ lang: "ja", authenticated: true, letters: [], fromPath: "/ja/" });
  assert.match(pageHtml, /<h1>改善のご要望<\/h1>/);
  assert.match(pageHtml, /改善のご要望を送る/);
  assert.doesNotMatch(pageHtml, /おたより受付|ひとこと送る/);
});
