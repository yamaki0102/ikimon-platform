import assert from "node:assert/strict";
import test from "node:test";
import { zukanOgpDefaultAssetUrl } from "./brandAssets.js";

test("ZUKAN OGP stays on the staging host only during staging materialization", () => {
  assert.equal(zukanOgpDefaultAssetUrl(undefined), "/assets/brand/zukan-ogp-default.png");
  assert.equal(
    zukanOgpDefaultAssetUrl("materialize-admin-preview"),
    "https://staging.ikimon.life/assets/brand/zukan-ogp-default.png",
  );
  assert.equal(zukanOgpDefaultAssetUrl("other-token"), "/assets/brand/zukan-ogp-default.png");
});
