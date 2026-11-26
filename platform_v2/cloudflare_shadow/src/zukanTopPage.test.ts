import assert from "node:assert/strict";
import test from "node:test";
import { renderZukanTopPage, type ZukanTopPageData } from "./zukanTopPage";

const emptyEventsBaseData: ZukanTopPageData = {
  heroPhotos: [
    {
      observationId: "obs_1",
      photoUrl: "https://zukan.earth/derived/hero1.webp",
      placeName: "常盤公園",
      placeHref: "/ja/places/plc_1",
      dateLabel: "11月22日"
    }
  ],
  eventSectionHeading: "最近の記録",
  eventFallbackTier: "recent_records",
  upcomingEvents: [],
  pastEventCards: [],
  recentPublicRecords: [
    {
      observationId: "obs_2",
      title: "カワセミ",
      photoUrl: "https://zukan.earth/derived/rec2.webp",
      dateLabel: "11月21日",
      href: "/ja/observations/obs_2"
    }
  ],
  placesStrip: [
    {
      placeId: "plc_1",
      name: "常盤公園",
      photoUrl: null,
      href: "/ja/places/plc_1",
      recordCount: 128
    }
  ],
  libraryGroups: [],
  oneYearPair: null
};

test("renderZukanTopPage logged-out renders owner hero photos, waitlist CTA, and zero-events fallback without empty-state text", () => {
  const html = renderZukanTopPage(emptyEventsBaseData, {
    lang: "ja",
    authenticated: false,
    cspNonce: "n1"
  });
  assert.match(html, /撮ると、まちの今が図鑑になる。/);
  assert.match(html, /新規登録（無料）/);
  assert.match(html, /写真は最初、自分だけに見えます/);
  assert.match(html, /公開されている場所の図鑑/);
  assert.match(html, /記録 128件/);
  assert.match(html, /近くのイベントを見る/);
  assert.match(html, /data-zk-hero="designed"/);
  assert.doesNotMatch(html, /<section class="zk-hero[^>]*>s*<img/);
  assert.match(html, /zk-place-ph/);
  assert.doesNotMatch(html, /0件|まだありません/);
});

test("renderZukanTopPage logged-out shell has no sidebar and logged-in shell puts sidebar as direct first child", () => {
  const loggedOut = renderZukanTopPage(emptyEventsBaseData, { lang: "ja", authenticated: false, cspNonce: "n1" });
  assert.match(loggedOut, /<div class="zt-shell zt-landing">/);
  assert.doesNotMatch(loggedOut, /class="zt-sidebar"/);
  const loggedIn = renderZukanTopPage(emptyEventsBaseData, { lang: "ja", authenticated: true, cspNonce: "n1" });
  assert.match(loggedIn, /<div class="zt-shell">\s*<aside class="zt-sidebar"/);
});

test("ZUKAN shell CSS applies grid only when a sidebar is a direct child", () => {
  const html = renderZukanTopPage(emptyEventsBaseData, { lang: "ja", authenticated: false, cspNonce: "n1" });
  assert.ok(html.includes(".zt-shell:has(>.zt-sidebar){display:grid"));
  assert.doesNotMatch(html, /\.zt-shell\{[^}]*display:grid/);
});

test("renderZukanTopPage logged-in renders library groups with 圖鑑に載せる / 図鑑に掲載中 and empty-library fallback", () => {
  const withLibrary = renderZukanTopPage(
    {
      ...emptyEventsBaseData,
      oneYearPair: {
        kind: "year_ago",
        placeName: "常盤公園",
        photos: [
          { observationId: "obs_old", photoUrl: "https://zukan.earth/derived/old.webp", monthLabel: "2025年11月", href: "/ja/observations/obs_old" },
          { observationId: "obs_new", photoUrl: "https://zukan.earth/derived/new.webp", monthLabel: "2026年11月", href: "/ja/observations/obs_new" }
        ]
      },
      libraryGroups: [
        {
          groupKey: "2026-11-22__みなと通り 朝市",
          headerLabel: "11月22日（土）・みなと通り 朝市",
          placeName: "みなと通り 朝市",
          published: false,
          photos: [{ observationId: "obs_new", photoUrl: "https://zukan.earth/derived/new.webp", title: "ヤツデ", observedAt: "2026-11-22T09:00:00Z" }]
        }
      ]
    },
    { lang: "ja", authenticated: true, displayName: "ゆい", cspNonce: "n1" }
  );
  assert.match(withLibrary, /1年前のこの場所/);
  assert.match(withLibrary, /11月22日（土）/);
  assert.match(withLibrary, /みなと通り 朝市/);
  assert.match(withLibrary, /自分のみ/);
  assert.match(withLibrary, /図鑑に載せる/);

  const emptyLibrary = renderZukanTopPage(emptyEventsBaseData, {
    lang: "ja",
    authenticated: true,
    displayName: "新人",
    cspNonce: "n1"
  });
  assert.match(emptyLibrary, /まだ写真がありません/);
  assert.match(emptyLibrary, /記録すると、こうなります/);
  assert.match(emptyLibrary, /zt-bottom-nav/);
  assert.doesNotMatch(emptyLibrary, /0件/);
});
