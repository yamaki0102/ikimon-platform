import assert from "node:assert/strict";
import test from "node:test";
import { resolveZukanPublicAssetOrigin, zukanOgpDefaultAssetUrl } from "./brandAssets.js";

test("ZUKAN OGP always resolves to the canonical zukan.earth presentation origin", () => {
  assert.equal(resolveZukanPublicAssetOrigin("https://staging.zukan.earth/", []), "https://staging.zukan.earth");
  assert.equal(resolveZukanPublicAssetOrigin("https://staging.ikimon.life/", []), "https://staging.zukan.earth");
  assert.equal(resolveZukanPublicAssetOrigin("https://zukan.earth", []), "https://zukan.earth");
  assert.equal(resolveZukanPublicAssetOrigin("https://ikimon.life", []), "https://zukan.earth");
  assert.equal(resolveZukanPublicAssetOrigin("", ["node", "materialize", "--target-env", "staging"]), "https://staging.zukan.earth");
  assert.equal(resolveZukanPublicAssetOrigin("", ["node", "materialize", "--target-env", "production"]), "https://zukan.earth");
  assert.equal(resolveZukanPublicAssetOrigin("materialize-admin-preview", ["node", "materialize", "--target-env", "staging"]), "");
  assert.equal(resolveZukanPublicAssetOrigin("https://example.invalid", []), "");

  assert.equal(zukanOgpDefaultAssetUrl(""), "/assets/brand/zukan-ogp-default.png");
  assert.equal(
    zukanOgpDefaultAssetUrl("https://staging.zukan.earth"),
    "https://staging.zukan.earth/assets/brand/zukan-ogp-default.png",
  );
  assert.equal(
    zukanOgpDefaultAssetUrl("https://staging.ikimon.life"),
    "https://staging.zukan.earth/assets/brand/zukan-ogp-default.png",
  );
  assert.equal(
    zukanOgpDefaultAssetUrl("https://zukan.earth"),
    "https://zukan.earth/assets/brand/zukan-ogp-default.png",
  );
  assert.equal(
    zukanOgpDefaultAssetUrl("https://ikimon.life"),
    "https://zukan.earth/assets/brand/zukan-ogp-default.png",
  );
  assert.equal(zukanOgpDefaultAssetUrl("materialize-admin-preview"), "/assets/brand/zukan-ogp-default.png");
});
