import assert from "node:assert/strict";
import test from "node:test";
import { classifyKubiakaAiStatus } from "../services/kubiakaPrivateRecordsCopy.js";
import type {
  KubiakaPrivateRecordDetail,
  KubiakaPrivateRecordSummary,
} from "../services/kubiakaPrivateRecordsReadModel.js";
import {
  renderKubiakaPrivateDocument,
  renderKubiakaPrivateRecordDetail,
  renderKubiakaPrivateRecordList,
  renderKubiakaPrivateRecordsHome,
} from "./kubiakaPrivateRecordsView.js";

function record(overrides: Partial<KubiakaPrivateRecordSummary> = {}): KubiakaPrivateRecordSummary {
  return {
    visitId: "visit-1",
    observedAt: "2026-08-01T09:00:00.000Z",
    savedAt: "2026-08-01T09:02:00.000Z",
    aiAssessmentStatus: "not_requested",
    photoCount: 1,
    ...overrides,
  };
}

test("AI status never treats unfinished or unknown work as complete", () => {
  assert.equal(classifyKubiakaAiStatus("completed"), "complete");
  assert.equal(classifyKubiakaAiStatus("accepted"), "complete");
  assert.equal(classifyKubiakaAiStatus("processing"), "working");
  assert.equal(classifyKubiakaAiStatus("candidate_ready"), "working");
  assert.equal(classifyKubiakaAiStatus("ready"), "unknown");
  assert.equal(classifyKubiakaAiStatus("not_requested"), "not_started");
  assert.equal(classifyKubiakaAiStatus("new-provider-state"), "unknown");
});

test("private document shell has no public navigation or external analytics", () => {
  const html = renderKubiakaPrivateDocument({
    basePath: "/preview",
    lang: "ja",
    currentPath: "/kubiaka/records/visit-private",
    title: "非公開記録",
    description: "本人だけの記録",
    body: "<p>private body</p>",
  });
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<meta name="robots" content="noindex,nofollow,noarchive"/);
  assert.match(html, /<meta name="referrer" content="no-referrer"/);
  assert.match(html, /href="\/preview(?:\/ja)?\/kubiaka\/records\/visit-private"/);
  assert.doesNotMatch(html, /<script\b|googletagmanager|clarity\.ms|google-analytics/i);
  assert.doesNotMatch(html, /href="[^"]*(?:\/map|share|report)/i);
  assert.doesNotMatch(html, /data-global-record|api\/v1\/ui-kpi/i);
  assert.doesNotMatch(html, /\/preview\/preview\//);
});

test("home renders zero, one and multiple record states", () => {
  const empty = renderKubiakaPrivateRecordsHome({
    basePath: "",
    lang: "ja",
    overview: { totalCount: 0, latest: null },
    acknowledgement: null,
  });
  assert.match(empty, /0件/);
  assert.match(empty, /\/kubiaka\/record\?start=photo/);

  const one = renderKubiakaPrivateRecordsHome({
    basePath: "",
    lang: "ja",
    overview: { totalCount: 1, latest: record() },
    acknowledgement: null,
  });
  assert.match(one, /1件/);
  assert.match(one, /\/kubiaka\/records\/visit-1/);

  const multiple = renderKubiakaPrivateRecordsHome({
    basePath: "",
    lang: "ja",
    overview: { totalCount: 3, latest: record({ visitId: "visit-3" }) },
    acknowledgement: null,
  });
  assert.match(multiple, /3件/);
  assert.match(multiple, /\/kubiaka\/me\/records/);
});

test("acknowledgement compatibility points to the saved private record", () => {
  const html = renderKubiakaPrivateRecordsHome({
    basePath: "",
    lang: "en",
    overview: { totalCount: 1, latest: record() },
    acknowledgement: { recordId: "occ:visit-1:0", visitId: "visit-1", photoCount: 1 },
  });
  assert.match(html, /Acknowledgement/);
  assert.match(html, /\/kubiaka\/records\/visit-1/);
  assert.doesNotMatch(html, /occ:visit-1:0/);
});

test("saved timestamps are rendered in Japan time", () => {
  const html = renderKubiakaPrivateRecordsHome({
    basePath: "",
    lang: "ja",
    overview: { totalCount: 1, latest: record() },
    acknowledgement: null,
  });
  assert.match(html, /18:02/);
  assert.doesNotMatch(html, /09:02/);
});

test("record list is photo-centred, private and safely limited", () => {
  const html = renderKubiakaPrivateRecordList({
    basePath: "",
    lang: "ja",
    page: {
      totalCount: 30,
      limit: 24,
      hasMore: true,
      records: [record({ visitId: "visit-2", photoCount: 2 }), record({ visitId: "visit-1" })],
    },
  });
  assert.equal((html.match(/<img /g) ?? []).length, 2);
  assert.match(html, /非公開/);
  assert.match(html, /最大24件/);
  assert.ok(html.indexOf("visit-2") < html.indexOf("visit-1"));
});

test("detail renders one to six owner-gated photo endpoints without sensitive fields", () => {
  for (const photoCount of [1, 6]) {
    const detail: KubiakaPrivateRecordDetail = {
      ...record({ visitId: "visit-private", photoCount }),
      photos: Array.from({ length: photoCount }, (_, index) => ({
        photoIndex: index + 1,
        mimeType: "image/jpeg",
        widthPx: 1200,
        heightPx: 900,
      })),
    };
    const html = renderKubiakaPrivateRecordDetail({ basePath: "", lang: "ja", detail });
    assert.equal((html.match(/<img /g) ?? []).length, photoCount);
    assert.match(html, /\/api\/v1\/kubiaka\/records\/visit-private\/photos\/1/);
    assert.doesNotMatch(html, /34\.7108|137\.7261|owner-a|user_id|point_latitude|point_longitude/i);
    assert.doesNotMatch(html, /href="[^"]*(?:share|map|report)/i);
    assert.doesNotMatch(html, /<button[^>]*(?:share|map|report)/i);
  }
});

test("renderers escape visit IDs and never duplicate forwarded base paths", () => {
  const hostile = record({ visitId: `visit-1\"><script>alert(1)</script>` });
  const root = renderKubiakaPrivateRecordsHome({
    basePath: "",
    lang: "en",
    overview: { totalCount: 1, latest: hostile },
    acknowledgement: null,
  });
  assert.doesNotMatch(root, /<script>alert\(1\)<\/script>/);
  assert.match(root, /%3Cscript%3Ealert/);

  const prefixed = renderKubiakaPrivateRecordsHome({
    basePath: "/preview",
    lang: "en",
    overview: { totalCount: 1, latest: record() },
    acknowledgement: null,
  });
  assert.match(prefixed, /\/preview\/kubiaka\/records\/visit-1/);
  assert.doesNotMatch(prefixed, /\/preview\/preview\//);
});
