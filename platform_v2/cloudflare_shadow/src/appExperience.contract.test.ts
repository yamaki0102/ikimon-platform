import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { observationEventPageHtml, renderCloudflareRecordHtml, renderRecordsProductSection } from "./index";
import { isAppExperiencePath, renderAppExperienceNavigation } from "../../src/ui/appExperience";

test("shared chrome preserves language and guest/member record destinations without owner controls", () => {
  for (const lang of ["ja", "en", "es", "pt-br"]) {
    for (const member of [false, true]) {
      const nav = renderAppExperienceNavigation(lang, 4, "bottom", member);
      assert.equal((nav.match(/<a /g) ?? []).length, 5);
      assert.match(nav, new RegExp(`href="/${lang}/records\\?view=${member ? "mine" : "public"}"`));
      assert.match(nav, new RegExp(`href="/${lang}/community/events" aria-current="page"`));
      assert.doesNotMatch(nav, /console|organizer|admin/);
    }
  }
  assert.equal(isAppExperiencePath("/ja/records?view=mine"), true);
  assert.equal(isAppExperiencePath("/ja/admin"), false);
  assert.equal(isAppExperiencePath("/ja/learn"), false);
});

test("event shell navigation uses the request language and membership", async () => {
  const response = observationEventPageHtml("Join", "<h1>Join</h1>", "test", 200, "en", true);
  const html = await response.text();
  assert.match(html, /<html lang="en">/);
  assert.match(html, /href="\/en\/records\?view=mine"/);
  assert.doesNotMatch(html, /href="\/ja\//);
});

test("unavailable records are not reported as an empty collection", () => {
  const url = new URL("https://zukan.earth/ja/records?view=public&q=bird");
  const failed = renderRecordsProductSection([], url, "public", null, true);
  assert.match(failed, /記録を読み込めませんでした/);
  assert.doesNotMatch(failed, /まだ記録はありません|見つかりませんでした|写真から記録する/);
  const empty = renderRecordsProductSection([], url, "public", null);
  assert.match(empty, /検索を解除/);
  assert.doesNotMatch(empty, /記録を読み込めませんでした/);
});

test("native capture has no fabricated coordinates and its browser script parses", () => {
  const html = renderCloudflareRecordHtml({ userId: "fixture", displayName: "fixture" } as never, new URL("https://zukan.earth/ja/record"), "fixture");
  assert.match(html, /name="latitude"[^>]*value=""/);
  assert.match(html, /name="longitude"[^>]*value=""/);
  assert.match(html, /ownerKey: draftOwnerKey/);
  assert.match(html, /const draftStorageKey = "latest:" \+ draftOwnerKey/);
  assert.match(html, /revision !== draftRevision/);
  assert.match(html, /submitRequested = true;[\s\S]*await flushDraftSave/);
  assert.match(html, /form\?\.addEventListener\("input", queueDraftSave\)/);
  assert.match(html, /await draftWrites/);
  assert.match(html, /visibility: "private"/);
  assert.doesNotMatch(html, /value="34\.710800"|value="137\.726100"/);
  for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new vm.Script(match[1]!);
});
