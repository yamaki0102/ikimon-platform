import assert from "node:assert/strict";
import test from "node:test";
import { zukanOgpDefaultAssetUrl } from "./brandAssets.js";

test("ZUKAN OGP uses only the explicit allowlisted public asset origin", () => {
  assert.equal(zukanOgpDefaultAssetUrl(""), "/assets/brand/zukan-ogp-default.png");
  assert.equal(
    zukanOgpDefaultAssetUrl("https://staging.ikimon.life/"),
    "https://staging.ikimon.life/assets/brand/zukan-ogp-default.png",
  );
  assert.equal(
    zukanOgpDefaultAssetUrl("https://ikimon.life"),
    "https://ikimon.life/assets/brand/zukan-ogp-default.png",
  );
  assert.equal(zukanOgpDefaultAssetUrl("materialize-admin-preview"), "/assets/brand/zukan-ogp-default.png");
  assert.equal(zukanOgpDefaultAssetUrl("https://example.invalid"), "/assets/brand/zukan-ogp-default.png");
});
