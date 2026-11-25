import assert from "node:assert/strict";
import test from "node:test";
import { renderZukanLibraryPage, renderZukanProfileHubPage } from "./zukanLibraryAndProfile";

test("library (B1-B3, B6, B7) renders in common ZUKAN shell without changing bundle keys", () => {
  const html = renderZukanLibraryPage(
    {
      libraryGroups: [
        {
          groupKey: "2026-11-25|place-sanaru",
          headerLabel: "2026-11-25 · 佐鳴湖公園",
          placeId: "place-sanaru",
          placeName: "佐鳴湖公園",
          published: false,
          photos: [
            { observationId: "obs-1", title: "アオサギ", observedAt: "2026-11-25T10:00:00Z", photoUrl: "/thumb/1.webp" },
            { observationId: "obs-2", title: "カワセミ", observedAt: "2026-11-25T10:05:00Z", photoUrl: null },
          ],
        },
      ],
      oneYearPair: {
        kind: "year_ago",
        placeName: "佐鳴湖公園",
        photos: [
          { observationId: "obs-1", monthLabel: "今日", href: "/ja/observations/obs-1", photoUrl: "/thumb/1.webp" },
          { observationId: "obs-0", monthLabel: "1年前", href: "/ja/observations/obs-0", photoUrl: "/thumb/0.webp" },
        ],
      },
    },
    { lang: "ja", authenticated: true, displayName: "テスト太郎", searchQuery: "サギ" }
  );

  assert.match(html, /class="zt-shell"/);
  assert.match(html, /href="\/ja\/library" aria-current="page"/);
  assert.match(html, /data-library-group="2026-11-25\|place-sanaru"/);
  assert.match(html, /まとめて確認・公開/);
  assert.match(html, /data-library-one-year-pair="1"/);
  assert.match(html, /1年前のこの場所/);
  assert.match(html, /zt-bottom-nav/);
  assert.match(html, /class="zt-avatar"[^>]*>テ</);
  assert.match(html, /まだ自分だけに見えています/);
  assert.doesNotMatch(html, /data-zukan-otayori-fab="1"/);
  assert.match(html, /data-zukan-otayori-sidebar="1"[^>]*>改善のご要望<\/a>/);
  assert.match(html, /data-zukan-otayori-menu="1"[^>]*>改善のご要望<\/a>/);

  const emptyHtml = renderZukanLibraryPage(
    { libraryGroups: [], oneYearPair: null },
    { lang: "ja", authenticated: true, displayName: "テスト太郎" }
  );
  assert.match(emptyHtml, /data-library-empty="1"/);
  assert.match(emptyHtml, /まだ写真がありません/);
  assert.match(emptyHtml, /記録すると、こうなります/);
  assert.match(emptyHtml, /写真を選んで入れる/);
  assert.match(emptyHtml, /イベントの写真を見る/);
});

test("profile hub (I1) renders in common ZUKAN shell with library, events, and settings destinations", () => {
  const html = renderZukanProfileHubPage({ lang: "ja", displayName: "テスト花子" });

  assert.match(html, /class="zt-shell"/);
  assert.match(html, /href="\/ja\/profile" aria-current="page"/);
  assert.match(html, /data-testid="self-control-hub"/);
  assert.match(html, /data-testid="profile-heading">テスト花子<\/h1>/);
  assert.match(html, /href="\/ja\/library"/);
  assert.match(html, /href="\/ja\/records\?view=mine"/);
  assert.match(html, /href="\/ja\/community\/events"/);
  assert.match(html, /href="\/ja\/profile\/settings"/);
  assert.match(html, /data-zukan-otayori-profile="1"/);
  assert.match(html, /改善のご要望/);
});
