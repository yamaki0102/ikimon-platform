import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { renderCloudflareRecordRecoverySignedHtml, resolveCloudflareRecordRecoveryState } from "./recordRecoveryHtml";

function render(): string {
  const url = new URL("https://ikimon.life/ja/record?draft=1");
  return renderCloudflareRecordRecoverySignedHtml({ userId: "user-1", displayName: "x" }, url, "n", resolveCloudflareRecordRecoveryState(url));
}

test("discard clears orphan and failed record outbox items", () => {
  const html = render();
  assert.match(html, /clearOrphanOutbox/);
  assert.match(html, /ikimon-app-outbox-v1/);
  assert.match(html, /item\.source !== "record"/);
  assert.match(html, /item\.status === "failed"/);
  assert.match(html, /getAllKeys\(\)/);
  assert.match(html, /!draftKeys\.includes\(id\.slice\(7\)\)/);
  assert.match(html, /await deleteDraft\(\);\s*await clearOrphanOutbox\(\);/);
});

test("recovery inline scripts parse", () => {
  const html = render();
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).filter((s) => s.trim());
  assert.ok(scripts.length > 0);
  for (const s of scripts) new vm.Script(s);
});
