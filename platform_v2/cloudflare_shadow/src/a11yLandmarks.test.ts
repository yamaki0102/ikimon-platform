import assert from "node:assert/strict";
import test from "node:test";
import { renderMapExplorerV2Document } from "../../src/ui/mapExplorerV2";

test("map v2 has main landmark and single h1", () => {
  const html = renderMapExplorerV2Document({ lang: "ja", authenticated: true, basePath: "" });
  assert.ok(html.includes('role="main"'));
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
  assert.ok(html.includes(".zv2-pcnav a{display:inline-flex;align-items:center;min-height:44px"));
});
