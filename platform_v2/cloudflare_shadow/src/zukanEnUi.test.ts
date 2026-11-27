import assert from "node:assert/strict";
import test from "node:test";
import { renderMapExplorerV2Document } from "../../src/ui/mapExplorerV2.js";
import { renderIdentifyV3Page, type IdentifyV3WorkspaceData } from "./identifyV3";
import { renderLibraryV2Page } from "./zukanLibraryV2";
import { renderProfileHub } from "./zukanProfileHub";
import { renderZukanChrome } from "./zukanShellChrome";

const JA = /[぀-ヿ一-鿿]/u;
const visible = (html: string): string =>
  html.replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<[^>]+>/g, " ");
const attrs = (html: string): string => (html.match(/(?:aria-label|placeholder|title|alt)="[^"]*"/g) ?? []).join(" ");

test("shell chrome has no Japanese in en/es/pt-br and keeps ja", () => {
  for (const lang of ["en", "es", "pt-br"] as const) {
    for (const authenticated of [true, false]) {
      const c = renderZukanChrome({ lang, activeNav: "library", authenticated, searchAction: `/${lang}/library` });
      const all = Object.values(c).join("");
      assert.equal(JA.test(visible(all) + attrs(all)), false, `${lang}/${authenticated}`);
    }
  }
  const ja = renderZukanChrome({ lang: "ja", activeNav: "library", authenticated: true });
  assert.match(ja.bottomNavHtml, /ライブラリ/);
  assert.match(ja.bottomNavHtml, /撮る/);
});

test("library en empty and search states are English, ja unchanged", () => {
  const en = renderLibraryV2Page({ visits: [], lang: "en", authenticated: true });
  assert.equal(JA.test(visible(en) + attrs(en)), false);
  assert.match(en, /No records yet/);
  const enSearch = renderLibraryV2Page({ visits: [], lang: "en", authenticated: true, searchQuery: "owl" });
  assert.equal(JA.test(visible(enSearch) + attrs(enSearch)), false);
  const ja = renderLibraryV2Page({ visits: [], lang: "ja", authenticated: true });
  assert.match(ja, /まだ記録がありません/);
  assert.match(ja, /記録を足す/);
});

test("map en has no Japanese UI strings, ja unchanged", () => {
  const en = renderMapExplorerV2Document({ lang: "en", authenticated: true, basePath: "" });
  assert.equal(JA.test(visible(en) + attrs(en)), false);
  assert.match(en, /Search places or records/);
  assert.match(en, /Go to my location/);
  const ja = renderMapExplorerV2Document({ lang: "ja", authenticated: true, basePath: "" });
  assert.match(ja, /場所や記録を探す/);
  assert.match(ja, /現在地へ移動/);
});

test("profile hub en has no Japanese UI strings", () => {
  const data = { displayName: "Mori", bio: "", recordCount: 0, savedPlaceCount: 0, joinedEventCount: 0, unreadCount: 0, records: [] };
  const en = renderProfileHub("en", data);
  assert.equal(JA.test(visible(en) + attrs(en)), false);
  assert.match(renderProfileHub("ja", data), /自分の記録/);
});

const identifyBase = (lang: "ja" | "en"): IdentifyV3WorkspaceData => ({
  view: "feed",
  lang,
  displayName: "Mori",
  skills: [],
  autoGrown: [],
  promotionSuggestions: [],
  confirmedCountsByNode: {},
  feedItems: [],
  savedItems: [],
  settledSavedItems: [],
  savedCount: 0,
  nextCursor: null,
} as unknown as IdentifyV3WorkspaceData);

test("identify en feed, skills and saved views have no Japanese UI strings", () => {
  for (const view of ["feed", "saved"] as const) {
    const en = renderIdentifyV3Page({ ...identifyBase("en"), view });
    assert.equal(JA.test(visible(en) + attrs(en)), false, view);
  }
  assert.match(renderIdentifyV3Page(identifyBase("ja")), /同定の作業場/);
});
