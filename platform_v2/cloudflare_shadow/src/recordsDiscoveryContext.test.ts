import assert from "node:assert/strict";
import test from "node:test";
import { renderRecordsProductSection } from "./index";
import { collectRecordsDiscoveryContext, recordsDiscoveryDetailHref, recordsDiscoveryListHref, recordsSearchQuery } from "./recordsDiscoveryContext";
import { renderObservationFirstRecordDetailHtml } from "./observationFirstRecordDetailHtml";

const origin = "https://zukan.earth";
const record = { visitId: "record-one", displayName: "地域の記録", observedAt: "2026-10-01", mediaKind: "photo", isAwaitingId: false, photoUrl: null, publicAreaLabel: "地域" };
const detail = { recordId: record.visitId, owner: false, visibility: "public", observations: [], privacy: { publicLocationLabel: "地域" }, proposalPolicy: { identification: false, media: false } };
const decodeHref = (value: string) => value.replaceAll("&amp;", "&");

test("four-language public and owner searches return from detail with the same query, without re-entry", () => {
  for (const lang of ["ja", "en", "es", "pt-br"] as const) for (const view of ["public", "mine"] as const) {
    const query = '浜松 & café + <写真> "記録"';
    const listUrl = new URL(`/${lang}/records`, origin);
    listUrl.search = new URLSearchParams({ view, q: query, lat: "35.123456", token: "must-not-travel", redirect: "https://other.example" }).toString();
    const list = renderRecordsProductSection([record] as never, listUrl, view, null);
    const href = decodeHref(list.match(/class="cf-records-native-card" href="([^"]+)"/)![1]!);
    const next = new URL(href, origin);
    assert.equal(next.origin, origin);
    assert.deepEqual([...next.searchParams.keys()], ["records_view", "records_q"]);
    assert.equal(next.searchParams.get("records_q"), query, "encode once, decode once");
    assert.doesNotMatch(href, /must-not-travel|35\.123456|other\.example/);
    const html = renderObservationFirstRecordDetailHtml(detail as never, { lang, title: record.displayName, observedLabel: "2026-10-01", note: null, media: [], actionNonce: "fixture", recordsDiscoveryContext: collectRecordsDiscoveryContext(next.searchParams) });
    const back = new URL(decodeHref(html.match(/class="of-back" href="([^"]+)"/)![1]!), origin);
    assert.equal(back.pathname, `/${lang}/records`);
    assert.equal(back.searchParams.get("view"), view);
    assert.equal(back.searchParams.get("q"), query);
    assert.deepEqual([...back.searchParams.keys()], ["view", "q"]);
    assert.doesNotMatch(html, /&amp;amp;|<写真>/);
    const share = html.match(/href="(mailto:[^"]+)"/)![1]!;
    assert.doesNotMatch(share, /records_q|records_view|浜松/, "private discovery terms are not shared");
    for (const languageHref of html.matchAll(/href="([^"]+)" lang="([^"]+)"/g)) {
      const destination = new URL(decodeHref(languageHref[1]!), origin);
      assert.equal(destination.searchParams.get("records_q"), query);
      assert.ok(destination.pathname.startsWith(`/${languageHref[2]}/`));
    }
  }
});

test("only explicit supported view creates a return context; external URL, GPS and token keys are ignored", () => {
  for (const view of ["", "saved", "Public", "../../login", "https://other.example"]) {
    assert.equal(collectRecordsDiscoveryContext(new URLSearchParams({ records_view: view, records_q: "private", return: "//other.example" })), null);
  }
  assert.equal(collectRecordsDiscoveryContext(new URLSearchParams({ records_q: "orphan" })), null);
  const context = collectRecordsDiscoveryContext(new URLSearchParams({ records_view: "public", records_q: "地域", lat: "35.123", token: "private", return: "//other.example" }));
  assert.deepEqual(context, { view: "public", query: "地域" });
  assert.equal(recordsDiscoveryListHref("ja", context), "/ja/records?view=public&q=%E5%9C%B0%E5%9F%9F");
});

test("query limits agree at the list, detail and return boundaries", () => {
  const query = "あ".repeat(100);
  assert.equal(recordsSearchQuery(`  ${query}  `).length, 80);
  const context = collectRecordsDiscoveryContext(new URLSearchParams({ records_view: "mine", records_q: query }))!;
  assert.equal(context.query.length, 80);
  assert.equal(new URL(recordsDiscoveryListHref("es", context), origin).searchParams.get("q")?.length, 80);
  assert.equal(new URL(recordsDiscoveryDetailHref("record/id", "es", context), origin).pathname, "/es/observations/record%2Fid");
  assert.equal(recordsDiscoveryListHref("en", { view: "public", query: "   " }), "/en/records?view=public");
  assert.equal(recordsDiscoveryDetailHref("one", "en", null), "/en/observations/one");
  assert.equal(recordsDiscoveryListHref("en", null), "/en/records");
});
