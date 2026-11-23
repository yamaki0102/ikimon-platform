import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { renderAppExperienceNavigation, renderAppExperienceQuickCamera } from "../../src/ui/appExperience";
import { renderBiosecurityPage } from "../../src/ui/biosecurity";
import { renderObservationFirstRecordDetailHtml } from "./observationFirstRecordDetailHtml";
import { renderGlobalPlaceDetailPage } from "./placeDetailPage";
import { renderCloudflareRecordRecoveryGuestHtml } from "./recordRecoveryHtml";

test("renderAppExperienceQuickCamera opens capture=environment in 1 tap and gallery on contextmenu", () => {
  const nav = renderAppExperienceNavigation("ja", 1, "bottom", false);
  const quick = renderAppExperienceQuickCamera("ja", { nonce: "test-nonce" });
  assert.match(nav, /data-global-record-trigger="photo"/);
  assert.match(quick, /data-global-record-input="photo"[^>]*capture="environment"/);
  assert.match(quick, /nonce="test-nonce"/);

  const scriptMatch = quick.match(/<script[^>]*>([\s\S]*?)<\/script>/);
  assert.ok(scriptMatch);

  let photoClicks = 0;
  let galleryClicks = 0;
  const triggerListeners = new Map<string, Array<(e: { preventDefault(): void }) => void>>();
  const trigger = {
    closest: () => null,
    addEventListener(type: string, fn: (e: { preventDefault(): void }) => void) {
      const list = triggerListeners.get(type) ?? [];
      list.push(fn);
      triggerListeners.set(type, list);
    },
  };
  const photoInput = {
    files: [],
    value: "",
    click() { photoClicks += 1; },
    addEventListener() {},
  };
  const galleryInput = {
    files: [],
    value: "",
    click() { galleryClicks += 1; },
    addEventListener() {},
  };
  const document = {
    querySelector: (selector: string) => (
      selector === '[data-global-record-input="photo"]' ? photoInput :
      selector === '[data-global-record-input="gallery"]' ? galleryInput : null
    ),
    querySelectorAll: (selector: string) => (
      selector === '[data-global-record-trigger="photo"]' ? [trigger] : []
    ),
  };
  const windowObj: Record<string, unknown> = { location: { assign() {} } };
  runInNewContext(scriptMatch[1]!, { document, window: windowObj, setTimeout, clearTimeout });

  let prevented = false;
  for (const fn of triggerListeners.get("click") ?? []) {
    fn({ preventDefault() { prevented = true; } });
  }
  assert.equal(prevented, true);
  assert.equal(photoClicks, 1);
  assert.equal(galleryClicks, 0);

  for (const fn of triggerListeners.get("contextmenu") ?? []) {
    fn({ preventDefault() {} });
  }
  assert.equal(galleryClicks, 1);
});

test("native page renderers include quick camera trigger and capture=environment", () => {
  const bioGuide = renderBiosecurityPage("guide");
  assert.match(bioGuide, /data-global-record-trigger="photo"/);
  assert.match(bioGuide, /data-global-record-input="photo"[^>]*capture="environment"/);

  const obsHtml = renderObservationFirstRecordDetailHtml(
    {
      schema: "ikimon.observation-first-record-detail/v1",
      recordId: "obs-1",
      owner: false,
      visibility: "public",
      observationCount: 0,
      proposalPolicy: { identification: false, media: false, disabledReason: null },
      privacy: { exactLocationExposed: false, publicLocationLabel: "位置情報は公開範囲に合わせて保護されています" },
      observations: [],
    },
    {
      lang: "ja",
      title: "スズメ",
      observedLabel: "2026-11-23",
      publicLocationLabel: "静岡県浜松市",
      note: "",
      actionNonce: "",
      media: [],
    },
  );
  assert.match(obsHtml, /data-global-record-trigger="photo"/);
  assert.match(obsHtml, /data-global-record-input="photo"[^>]*capture="environment"/);

  const placeHtml = renderGlobalPlaceDetailPage({
    lang: "ja",
    profile: {
      schema: "ikimon.place-atlas/v1",
      place: {
        placeId: "place-1",
        canonicalPlaceId: "place-1",
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
    } as unknown as Parameters<typeof renderGlobalPlaceDetailPage>[0]["profile"],
    viewerAuthenticated: false,
  });
  assert.match(placeHtml, /data-global-record-trigger="photo"/);
  assert.match(placeHtml, /data-global-record-input="photo"[^>]*capture="environment"/);

  const recoveryHtml = renderCloudflareRecordRecoveryGuestHtml(new URL("https://zukan.earth/ja/record"), "n1");
  assert.match(recoveryHtml, /data-global-record-trigger="photo"/);
  assert.match(recoveryHtml, /data-global-record-input="photo"[^>]*capture="environment"/);
});
