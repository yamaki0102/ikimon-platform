import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderGuidePublicPage } from "./guideBookingDesk";
import { renderZukanTopPage } from "./zukanTopPage";
import { renderGlobalPlaceDetailPage } from "./placeDetailPage";
import { renderPersonPublication } from "./personPublication";
import { PERSON_PUBLICATIONS } from "../../src/content/personPublications";
import { handleGenrePortalRequest } from "./genrePortal";
import { handleEventTemplatePreviewPage, EVENT_TEMPLATE_PREVIEW_ROUTES } from "./eventTemplatePages";
import { handleSyntheticRenriBrowserQa } from "./programs/pages";
import { renderZukanWaitlistPage } from "./waitlistPage";
import { renderObservationFirstRecordDetailHtml } from "./observationFirstRecordDetailHtml";

test("mobile 375px audit: ZUKAN UI renderers prevent purple :visited links and 375px horizontal overflow", async () => {
  const guideHtml = renderGuidePublicPage({
    guide_id: "g-1",
    user_id: "u-1",
    display_name: "テスト案内人",
    bio: "自然案内",
    specialties_json: "[]",
    places_json: "[]",
    is_nacsj_instructor: 0,
    nacsj_instructor_verified: 0,
    verified_expert_count: 0,
    status: "active",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  } as never);
  assert.match(guideHtml, /\*\{box-sizing:border-box\}/);
  assert.match(guideHtml, /a,a:visited\{color:#245c3a\}/);
  assert.match(guideHtml, /input,select\{width:100%;max-width:100%/);

  const waitlistHtml = renderZukanWaitlistPage("ja");
  assert.match(waitlistHtml, /\.zukan-app-nav\.is-bottom\{box-sizing:border-box;/);
  assert.match(waitlistHtml, /\.zukan-app-nav a,\.zukan-app-nav a:visited/);

  const topHtml = renderZukanTopPage(
    {
      heroPhotos: [],
      eventSectionHeading: "いまの観察会",
      eventFallbackTier: "upcoming",
      upcomingEvents: [],
      pastEventCards: [],
      recentPublicRecords: [],
      placesStrip: [],
      libraryGroups: [],
      oneYearPair: null,
    },
    { lang: "ja", authenticated: false }
  );
  assert.match(topHtml, /a,a:visited\{color:var\(--green\)\}/);

  const genreRes = await handleGenrePortalRequest(
    new Request("https://ikimon.life/ja/birds"),
    { PUBLIC_SITE_URL: "https://ikimon.life" } as never,
    { listParticipations: async () => [] } as never
  );
  if (genreRes) {
    assert.match(await genreRes.text(), /a,a:visited\{color:#17664c/);
  }

  const templateKey = Object.values(EVENT_TEMPLATE_PREVIEW_ROUTES)[0]!;
  const templateRes = handleEventTemplatePreviewPage(new Request(`https://ikimon.life${templateKey}`), templateKey);
  assert.ok(templateRes);
  assert.match(await templateRes.text(), /a,a:visited\{color:#0055ad/);

  const personHtml = renderPersonPublication(PERSON_PUBLICATIONS[0]!, true);
  assert.match(personHtml, /\.person-page a,\.person-page a:visited\{color:inherit/);

  const placeHtml = renderGlobalPlaceDetailPage({
    profile: {
      schema: "ikimon.place-atlas/v1",
      place: {
        placeId: "place-test",
        canonicalPlaceId: "place-test",
        name: "テスト公園",
        localName: "テスト公園",
        locality: "浜松市",
        placeKind: "park",
        latitude: 34.7,
        longitude: 137.7,
        summary: "",
        sourceCount: 1,
      },
      policy: { placeVisibility: "public" },
      provenance: { sourceCount: 1, latestCheckedAt: null, generatedAt: null },
      sections: [],
    } as never,
    lang: "ja",
  });
  assert.match(placeHtml, /\.gpd-back,\.gpd-back:visited/);

  const qaRes = handleSyntheticRenriBrowserQa(
    new Request("https://staging.ikimon.life/__qa/renri/join"),
    new URL("https://staging.ikimon.life/__qa/renri/join"),
    "staging"
  );
  if (qaRes) {
    assert.match(await qaRes.text(), /a,a:visited\{color:var\(--brand\)\}/);
  }
  const pagesSource = await readFile(new URL("./programs/pages.ts", import.meta.url), "utf8");
  assert.match(pagesSource, /a,a:visited\{color:#0b6b54\}/);
  assert.match(pagesSource, /a,a:visited\{color:var\(--brand\)\}/);

  const detailHtml = renderObservationFirstRecordDetailHtml(
    {
      schema: "ikimon.observation-first-record-detail/v1",
      recordId: "obs-1",
      owner: false,
      visibility: "public",
      observationCount: 0,
      proposalPolicy: { identification: false, media: false, disabledReason: null },
      observations: [],
      privacy: { exactLocationExposed: false, publicLocationLabel: "非公開" },
    } as never,
    { lang: "ja", title: "テスト", observedLabel: "2026-11-25", note: null, media: [], actionNonce: "n1", viewerAuthenticated: false }
  );
  assert.match(detailHtml, /a,a:visited\{color:#0b6f61\}/);
  assert.match(detailHtml, /button,input,select,textarea\{font:inherit;max-width:100%;min-width:0\}/);
});
