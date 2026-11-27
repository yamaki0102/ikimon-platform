import assert from "node:assert/strict";
import test from "node:test";
import type { ObservationFirstRecordDetail } from "./cloudflareObservationReadModel";
import { renderObservationFirstRecordDetailHtml } from "./observationFirstRecordDetailHtml";

const base: ObservationFirstRecordDetail = {
  schema: "ikimon.observation-first-record-detail/v1",
  recordId: "visit-d",
  owner: true,
  visibility: "public",
  observationCount: 0,
  proposalPolicy: { identification: true, media: true, disabledReason: null },
  observations: [],
  privacy: { exactLocationExposed: false, publicLocationLabel: "位置情報は公開範囲に合わせて保護されています" },
};
const pres = (extra = {}) => ({
  lang: "ja" as const,
  title: "カワセミ",
  observedLabel: "2026年11月15日",
  note: null,
  media: [
    { mediaId: "a1", mediaKind: "photo" as const, url: "https://media.example/1.webp" },
    { mediaId: "a2", mediaKind: "photo" as const, url: "https://media.example/2.webp" },
  ],
  actionNonce: "n",
  ...extra,
});

test("D4 owner sees delete entry with confirm dialog calling hide", () => {
  const h = renderObservationFirstRecordDetailHtml(base, pres());
  assert.match(h, /data-of-delete-open[^>]*>この記録を消す</);
  assert.match(h, /この記録を消しますか?/);
  assert.match(h, /data-endpoint="\/api\/v1\/observations\/visit-d\/hide"/);
  assert.match(h, /data-of-delete-script/);
  const o = renderObservationFirstRecordDetailHtml({ ...base, owner: false }, pres());
  assert.doesNotMatch(o, /data-of-delete-open/);
  assert.doesNotMatch(o, /data-of-delete-script/);
});

test("B7 viewer has prev/next, counter and owner-only edit link", () => {
  const h = renderObservationFirstRecordDetailHtml(base, pres());
  assert.match(h, /data-of-lb-prev/);
  assert.match(h, /data-of-lb-next/);
  assert.match(h, /<a class="of-lb-edit"/);
  assert.match(h, /ArrowRight/);
  const o = renderObservationFirstRecordDetailHtml({ ...base, owner: false }, pres());
  assert.doesNotMatch(o, /<a class="of-lb-edit"/);
});

test("D2 other's record header shows poster and place card only when provided", () => {
  const o = { ...base, owner: false };
  const h = renderObservationFirstRecordDetailHtml(o, pres({ posterName: "山田 健さん", placeHref: "/ja/places/plc_x" }));
  assert.match(h, /of-poster/);
  assert.match(h, /class="of-place-card" href="\/ja\/places\/plc_x"/);
  assert.doesNotMatch(renderObservationFirstRecordDetailHtml(o, pres()), /of-other-head"/);
});
