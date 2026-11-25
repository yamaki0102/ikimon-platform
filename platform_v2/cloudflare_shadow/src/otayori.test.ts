import assert from "node:assert/strict";
import test from "node:test";
import {
  OTAYORI_STATUSES,
  renderOtayoriFloatingButton,
  shouldNotifyOtayoriStatus,
  shouldShowOtayoriButton,
} from "./otayori";

test("otayori defines 7 statuses, notifies only on replied, and hides floating button on camera/map", () => {
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

  const visibleBtn = renderOtayoriFloatingButton({ lang: "ja", pathname: "/ja/" });
  assert.match(visibleBtn, /ひとこと送る/);
  assert.equal(renderOtayoriFloatingButton({ lang: "ja", pathname: "/ja/record" }), "");
  assert.equal(renderOtayoriFloatingButton({ lang: "ja", pathname: "/ja/map" }), "");
});
