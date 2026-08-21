import assert from "node:assert/strict";
import test from "node:test";
import { resolveZukanPublicAssetOrigin, zukanOgpDefaultAssetUrl } from "./brandAssets.js";

test("ZUKAN OGP resolves from explicit origin or explicit materialization target, never the dummy token", () => {
  assert.equal(resolveZukanPublicAssetOrigin("https://staging.ikimon.life/", []), "https://staging.zukan.earth");
  assert.equal(resolveZukanPublicAssetOrigin("https://ikimon.life", []), "https://zukan.earth");
  assert.equal(resolveZukanPublicAssetOrigin("", ["node", "materialize", "--target-env", "staging"]), "https://staging.zukan.earth");
  assert.equal(resolveZukanPublicAssetOrigin("", ["node", "materialize", "--target-env", "production"]), "https://zukan.earth");
  assert.equal(resolveZukanPublicAssetOrigin("materialize-admin-preview", ["node", "materialize", "--target-env", "staging"]), "");
  assert.equal(resolveZukanPublicAssetOrigin("https://example.invalid", []), "");

  assert.equal(zukanOgpDefaultAssetUrl(""), "/assets/brand/zukan-ogp-default.png");
  assert.equal(
    zukanOgpDefaultAssetUrl("https://staging.ikimon.life"),
    "https://staging.zukan.earth/assets/brand/zukan-ogp-default.png",
  );
  assert.equal(
    zukanOgpDefaultAssetUrl("https://ikimon.life"),
    "https://zukan.earth/assets/brand/zukan-ogp-default.png",
  );
  assert.equal(zukanOgpDefaultAssetUrl("materialize-admin-preview"), "/assets/brand/zukan-ogp-default.png");
});
