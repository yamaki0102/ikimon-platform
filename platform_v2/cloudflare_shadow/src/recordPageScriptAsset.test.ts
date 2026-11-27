import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { recordPageScriptAsset } from "./recordPageScriptAsset";
import { renderCloudflareRecordHtml } from "./index";

test("record page loads its script as a hashed external asset with escaped config", () => {
  const html = renderCloudflareRecordHtml({ userId: "u", displayName: "d" } as never, new URL("https://zukan.earth/ja/record"), "n");
  const asset = recordPageScriptAsset();
  assert.match(asset.path, /^\/assets\/ui\/record-page\.[a-f0-9]{12}\.js$/);
  assert.ok(html.includes(`<script src="${asset.path}" defer></script>`));
  assert.ok(!html.includes("ikimonFacePrivacyAssetBase"));
  assert.ok(html.length < 120_000);
  const cfg = /<script type="application\/json" id="record-page-config">([\s\S]*?)<\/script>/.exec(html);
  assert.ok(cfg && !cfg[1]!.includes("</"));
  const parsed = JSON.parse(cfg![1]!);
  assert.equal(parsed.prefix, "/ja");
  assert.ok(parsed.copy && parsed.capture);
  new vm.Script(asset.content.toString("utf8"));
  assert.equal(recordPageScriptAsset(), asset);
});
