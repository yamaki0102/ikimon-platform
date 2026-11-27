import test from "node:test";
import assert from "node:assert/strict";
import { renderLibraryGroupDetailPage } from "./zukanLibraryDetail";

test("B6 group detail shows info table and actions", () => {
  const html = renderLibraryGroupDetailPage(
    { groupKey: "2026-05-01__p1", headerLabel: "5月1日・金", placeId: "p1", placeName: "浜松城公園", published: false, photos: [{ observationId: "o1", photoUrl: "https://x/1.jpg", title: "a", observedAt: "2026-05-01T00:00:00Z" }] } as never,
    { lang: "ja" },
  );
  assert.match(html, /状態/);
  assert.match(html, /日付/);
  assert.match(html, /枚数/);
  assert.match(html, /1枚/);
  assert.ok(html.includes('href="/ja/places/p1"'));
  assert.match(html, /図鑑に載せる/);
  assert.match(html, /共有する/);
});

test("year-ago empty state is a single centered note with a capture action", async () => {
  const { renderLibraryYearAgoListPage } = await import("./zukanLibraryDetail");
  const html = renderLibraryYearAgoListPage([], { lang: "ja" });
  assert.match(html, /data-year-ago-empty="1"/);
  assert.match(html, /href="\/ja\/record"[^>]*>撮る</);
  assert.doesNotMatch(html, /class="zd-lead"/);
});
