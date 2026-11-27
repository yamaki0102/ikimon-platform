import assert from "node:assert/strict";
import test from "node:test";
import { loadZukanTopPageData, renderZukanTopPage, type ZukanTopPageData } from "./zukanTopPage";

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

const v2Options = { lang: "ja" as const, authenticated: false, cspNonce: "n1", guestTopV2: true };

test("guest top v2 off or not applicable renders exactly the current page", () => {
  const current = renderZukanTopPage(emptyEventsBaseData, { lang: "ja", authenticated: false, cspNonce: "n1" });
  assert.equal(renderZukanTopPage(emptyEventsBaseData, { ...v2Options, guestTopV2: false }), current);
  assert.doesNotMatch(current, /data-zk-guest-top|zg2-/);
  const en = renderZukanTopPage(emptyEventsBaseData, { lang: "en", authenticated: false, cspNonce: "n1" });
  assert.equal(renderZukanTopPage(emptyEventsBaseData, { lang: "en", authenticated: false, cspNonce: "n1", guestTopV2: false }), en);
  const member = renderZukanTopPage(emptyEventsBaseData, { lang: "ja", authenticated: true, cspNonce: "n1" });
  assert.equal(renderZukanTopPage(emptyEventsBaseData, { ...v2Options, authenticated: true }), member);
});

test("guest top v2 renders the reviewed structure with development frames, no present-tense integration claims", () => {
  const html = renderZukanTopPage(emptyEventsBaseData, v2Options);
  assert.match(html, /data-zk-guest-top="v2"/);
  assert.match(html, /<style nonce="n1">/);
  assert.match(html, /<img src="\/assets\/brand\/zukan-lockup\.svg"/);
  assert.match(html, /<h1 id="zg2-h1"><span>撮ると、<\/span><span>まちの今が<\/span><span>図鑑になる。<\/span><\/h1>/);
  assert.match(html, /href="\/ja\/register">順番待ちに登録する</);
  assert.equal((html.match(/写真はイメージです/g) ?? []).length, (html.match(/class="zg2-mock-photo"/g) ?? []).length);
  assert.match(html, /いまは招待制です/);
  assert.doesNotMatch(html, /ズカン/);
  assert.match(html, /.zg2-cta>a{[^}]*white-space:nowrap/);
  assert.doesNotMatch(html, />はじめる</);
  assert.match(html, /広葉樹の葉の記録、2026年5月25日/);
  assert.match(html, /常盤公園/);
  assert.match(html, /class="zk-place-row"[^]*記録 128件/);

  const frames = html.match(/<div class="zg2-dev">[\s\S]*?<\/div><\/div><\/div>/g) ?? [];
  assert.equal(frames.length, 4);
  for (const frame of frames) assert.equal((frame.match(/<span class="zg2-dev-badge">開発中<\/span>/g) ?? []).length, 1);
  assert.equal((html.match(/<span class="zg2-dev-badge">/g) ?? []).length, 4);
  assert.equal((html.match(/class="zg2-status/g) ?? []).length, 0);
  assert.match(html, /border:2px dashed var\(--dev-line\)/);

  assert.equal((html.match(/<details class="zg2-ex"/g) ?? []).length, 4);
  assert.equal((html.match(/<details class="zg2-ex" open>/g) ?? []).length, 1);
  assert.match(html, /<details class="zg2-ex" open><summary><h3>記録が、活動の成果として使われたことが分かる</);

  assert.match(html, /NOCOSIL/);
  assert.doesNotMatch(html, /ノコシル/);
  assert.doesNotMatch(html, /受け付けます|つながる場所です|につながります|NOCOSILで続きます|段取りはNOCOSILで|ノコシルで/);
  assert.match(html, /NOCOSILとの連携は開発中です。/);
  assert.match(html, /12月14日（月）/);
  assert.match(html, /1月20日（水）/);
  assert.doesNotMatch(html, /12月14日（日）|1月20日（火）/);

  assert.equal((html.match(/class="zg2-card"/g) ?? []).length, 3);
  assert.match(html, /お店・団体・学校の方へ/);
  assert.equal((html.match(/href="\/ja\/otayori\?from=%2Fja%2F"/g) ?? []).length, 2);

  assert.doesNotMatch(html, /[¥￥]|円|月額|料金|プラン/);
  assert.doesNotMatch(html, /0件|まだありません|公開中のイベントはありません/);
  assert.doesNotMatch(html, /community\/events/);
  assert.doesNotMatch(html, /Notion|Slack|LINE|Googleマップ|食べログ/);
});

test("guest top v2 images carry dimensions, only the first is eager, and places stay real", () => {
  const html = renderZukanTopPage(emptyEventsBaseData, v2Options);
  const images = [...html.matchAll(/<img [^>]*src="\/assets\/img\/landing\/zukan-guest-v2-[^"]+"[^>]*>/g)].map((m) => m[0]);
  assert.equal(images.length, 5);
  for (const img of images) assert.match(img, /width="\d+" height="\d+"/);
  assert.equal(images.filter((img) => !img.includes('loading="lazy"')).length, 1);
  assert.match(images[0]!, /zukan-guest-v2-record\.webp/);
  assert.match(images[0]!, /fetchpriority="high"/);
  const noPlaces = renderZukanTopPage({ ...emptyEventsBaseData, placesStrip: [] }, v2Options);
  assert.doesNotMatch(noPlaces, /class="zk-place-row"/);
  assert.match(noPlaces, /data-zk-guest-top="v2"/);
});

test("renderZukanTopPage logged-in library shows a more link to older records when a cursor exists", () => {
  const group = { groupKey: "2026-06-01__浜松市", headerLabel: "6月1日・浜松市", placeName: "浜松市", published: false, photos: [{ observationId: "o1", title: "x", observedAt: "2026-06-01T00:00:00Z", photoUrl: "https://example.test/a.webp" }] };
  const withMore = renderZukanTopPage({ ...emptyEventsBaseData, libraryGroups: [group], libraryNextCursor: "abc" } as ZukanTopPageData, { lang: "ja", authenticated: true, cspNonce: "n1" });
  assert.match(withMore, /data-library-more="1"/);
  assert.match(withMore, /href="\/ja\/library\?before=abc"/);
  const atEnd = renderZukanTopPage({ ...emptyEventsBaseData, libraryGroups: [group], libraryNextCursor: null } as ZukanTopPageData, { lang: "ja", authenticated: true, cspNonce: "n1" });
  assert.doesNotMatch(atEnd, /data-library-more="1"/);
});

test("renderZukanTopPage distinguishes fetch failure from 0 records with 読み込めませんでした［もう一度］", async () => {
  const failingEnv = {
    OBS_DB: {
      prepare() {
        return {
          bind() { return this; },
          async all() { throw new Error("D1_TIMEOUT"); },
          async first() { throw new Error("D1_TIMEOUT"); },
          async run() { throw new Error("D1_TIMEOUT"); },
        };
      },
    },
    CORE_DB: {
      prepare() {
        return {
          bind() { return this; },
          async all() { throw new Error("D1_TIMEOUT"); },
          async first() { throw new Error("D1_TIMEOUT"); },
          async run() { throw new Error("D1_TIMEOUT"); },
        };
      },
    },
  } as never;

  const memberFailed = await loadZukanTopPageData(failingEnv, "user-1", "", "ja");
  assert.equal(memberFailed.libraryLoadError, true);
  assert.equal(memberFailed.placesLoadError, true);

  const memberHtml = renderZukanTopPage(memberFailed, { lang: "ja", authenticated: true, displayName: "ゆい", cspNonce: "n1" });
  assert.match(memberHtml, /data-zukan-fetch-error="1"/);
  assert.match(memberHtml, /読み込めませんでした/);
  assert.match(memberHtml, />もう一度</);
  assert.doesNotMatch(memberHtml, /まだ写真がありません|0件/);

  const guestHtml = renderZukanTopPage(memberFailed, { lang: "ja", authenticated: false, cspNonce: "n1" });
  assert.match(guestHtml, /data-zukan-fetch-error="1"/);
  assert.match(guestHtml, /読み込めませんでした/);
  assert.match(guestHtml, />もう一度</);
  assert.doesNotMatch(guestHtml, /0件/);
});

test("guest top v2 renders in English for en/es/pt-br with invite-only wording and no Japanese UI copy", () => {
  const ja = renderZukanTopPage(emptyEventsBaseData, v2Options);
  for (const lang of ["en", "es", "pt-br"] as const) {
    const html = renderZukanTopPage(emptyEventsBaseData, { lang, authenticated: false, cspNonce: "n1", guestTopV2: true });
    assert.match(html, /data-zk-guest-top="v2"/);
    assert.match(html, /Join the waitlist/);
    assert.match(html, /invite-only/);
    assert.match(html, new RegExp(`href="/${lang}/register"`));
    assert.doesNotMatch(html, /Sign up \(free\)/);
    const main = html.slice(html.indexOf('<div class="zg2"'), html.indexOf('<footer class="zg2-foot-bar">'));
    assert.doesNotMatch(main.replace(/<img[^>]*>/g, "").replace(/<strong>[^<]*<\/strong>/g, ""), /[぀-ヿ一-鿿]/);
    assert.equal((html.match(/<span class="zg2-dev-badge">In development<\/span>/g) ?? []).length, 4);
  }
  assert.match(ja, /順番待ちに登録する/);
});
