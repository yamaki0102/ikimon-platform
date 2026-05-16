import assert from "node:assert/strict";
import test from "node:test";
import { buildGuideSessionPublicSummaries, type GuideSessionSummarySourceRow } from "./guideSessionPublicSummary.js";

function row(overrides: Partial<GuideSessionSummarySourceRow> = {}): GuideSessionSummarySourceRow {
  return {
    guideRecordId: overrides.guideRecordId ?? "00000000-0000-4000-8000-000000000001",
    sessionId: overrides.sessionId ?? "guide-session-1",
    userId: overrides.userId ?? "user-1",
    observerName: overrides.observerName ?? "YAMAKI",
    observerAvatarUrl: overrides.observerAvatarUrl ?? "/uploads/avatar.jpg",
    lat: overrides.lat ?? 34.7,
    lng: overrides.lng ?? 137.7,
    sceneSummary: overrides.sceneSummary ?? "草地と街路樹が写っている",
    detectedSpecies: overrides.detectedSpecies ?? [],
    detectedFeatures: overrides.detectedFeatures ?? [
      { type: "vegetation", name: "草地", confidence: 0.82 },
      { type: "vegetation", name: "街路樹", confidence: 0.76 },
    ],
    capturedAt: overrides.capturedAt ?? "2026-05-16T09:00:00.000+09:00",
    returnedAt: overrides.returnedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-05-16T09:00:03.000+09:00",
    frameThumb: overrides.frameThumb ?? "/uploads/guide-frame.jpg",
    primarySubject: overrides.primarySubject ?? null,
    environmentContext: overrides.environmentContext ?? "道路沿いの草地",
    seasonalNote: overrides.seasonalNote ?? null,
    meta: overrides.meta ?? null,
  };
}

test("guide session public summary states achievements without researcher-oriented look-back copy", () => {
  const summaries = buildGuideSessionPublicSummaries([
    row({ guideRecordId: "00000000-0000-4000-8000-000000000001" }),
    row({ guideRecordId: "00000000-0000-4000-8000-000000000002", capturedAt: "2026-05-16T09:00:08.000+09:00" }),
  ], "user-1");

  assert.equal(summaries.length, 1);
  const summary = summaries[0]!;
  assert.equal(summary.observerName, "YAMAKI");
  assert.equal(summary.observerAvatarUrl, "/uploads/avatar.jpg");
  assert.match(`${summary.headline}${summary.body}`, /草地と樹木|樹木と草地/);
  assert.match(summary.body, /記録として残しました|見える記録/);
  assert.match(summary.evidenceLine, /位置と時刻が揃っています/);
  assert.doesNotMatch(`${summary.headline}${summary.body}${summary.evidenceLine}${summary.motivationLine}`, /見返|あとから比べ/);
  assert.doesNotMatch(`${summary.headline}${summary.body}${summary.evidenceLine}`, /同じ流れ|時刻と場所つきのまとまり|までです|これしか/);
  assert.doesNotMatch(`${summary.headline}${summary.body}${summary.evidenceLine}`, /確認できたもの|見つからなかったもの|分けています/);
});

test("guide session public summary treats non-detection as an outcome ingredient", () => {
  const summaries = buildGuideSessionPublicSummaries([
    row({
      meta: {
        guideSignals: {
          absenceBoundary: {
            state: "searched_not_found",
            note: "水路沿いを通過したが、開花個体はこのフレーム束では確認できない。",
          },
        },
      },
    }),
  ], "user-1");

  assert.match(summaries[0]!.evidenceLine, /未検出メモ/);
  assert.match(summaries[0]!.evidenceLine, /開花個体/);
  assert.match(summaries[0]!.motivationLine, /見つからなかった情報/);
});

test("guide session public summary condenses transit absence notes without ellipses", () => {
  const summaries = buildGuideSessionPublicSummaries([
    row({
      meta: {
        guideSignals: {
          absenceBoundary: {
            state: "searched_not_found",
            note: "移動経路上の駅構内で生物個体は検出されませんでした。",
          },
        },
      },
    }),
  ], "user-1");

  const text = `${summaries[0]!.headline}${summaries[0]!.body}${summaries[0]!.evidenceLine}${summaries[0]!.motivationLine}`;
  assert.match(text, /生物個体の未検出メモ/);
  assert.doesNotMatch(text, /移動経路|駅構内|…/);
  assert.doesNotMatch(text, /確認できたもの|見つからなかったもの|分けています/);
});

test("guide session public summary keeps concrete absence targets", () => {
  const summaries = buildGuideSessionPublicSummaries([
    row({
      meta: {
        guideSignals: {
          absenceBoundary: {
            state: "searched_not_found",
            note: "鳥類や昆虫類などの小動物は確認できなかった。",
          },
        },
      },
    }),
  ], "user-1");

  assert.match(summaries[0]!.evidenceLine, /鳥類や昆虫類などの小動物の未検出メモ/);
});

test("guide session public summary uses guide signals as concrete public outcome copy", () => {
  const summaries = buildGuideSessionPublicSummaries([
    row({
      guideRecordId: "00000000-0000-4000-8000-000000000011",
      detectedFeatures: [{ type: "vegetation", name: "樹林", confidence: 0.8 }],
      environmentContext: "歩道沿いの樹林",
      meta: {
        guideSignals: {
          newSignals: ["木陰の下で鳥の声が続いている"],
          continuedSignals: ["樹林が連続して写っている"],
          coverageHints: ["歩道沿いを約20シーン分通過"],
        },
      },
    }),
    row({
      guideRecordId: "00000000-0000-4000-8000-000000000012",
      capturedAt: "2026-05-16T09:00:20.000+09:00",
      detectedFeatures: [{ type: "sound", name: "鳥の声", confidence: 0.74 }],
      environmentContext: "歩道沿いの樹林",
    }),
  ], "user-1");

  const summary = summaries[0]!;
  assert.match(summary.headline, /鳥の声を記録に残せた/);
  assert.match(summary.body, /鳥の声と周辺の樹林/);
  assert.match(summary.evidenceLine, /鳥の声、樹林、周辺音/);
  assert.doesNotMatch(`${summary.headline}${summary.body}${summary.evidenceLine}`, /音と景色|同じ流れ|具体|までです|これしか/);
});

test("guide session public summary varies cards with concrete highlights", () => {
  const summaries = buildGuideSessionPublicSummaries([
    row({
      guideRecordId: "00000000-0000-4000-8000-000000000021",
      sessionId: "session-mound",
      detectedFeatures: [{ type: "vegetation", name: "樹林", confidence: 0.8 }],
      environmentContext: "盛土植生",
    }),
    row({
      guideRecordId: "00000000-0000-4000-8000-000000000022",
      sessionId: "session-roadside",
      detectedFeatures: [{ type: "vegetation", name: "草地", confidence: 0.8 }],
      environmentContext: "道路際歩道の雑草群落構成",
    }),
    row({
      guideRecordId: "00000000-0000-4000-8000-000000000023",
      sessionId: "session-tree",
      detectedFeatures: [{ type: "vegetation", name: "樹木", confidence: 0.8 }],
      environmentContext: "街路樹",
    }),
  ], "user-1");

  const text = summaries.map((summary) => `${summary.headline}${summary.body}`).join("\n");
  assert.match(text, /盛土植生を記録に残せた/);
  assert.match(text, /道路際の雑草群落を記録に残せた/);
  assert.match(text, /街路樹を記録に残せた/);
  assert.doesNotMatch(text, /樹林を写真と音で残せた[\s\S]*草地を写真と音で残せた[\s\S]*樹木を写真と音で残せた/);
});

test("guide session public summary carries genus and family level candidates into top copy", () => {
  const summaries = buildGuideSessionPublicSummaries([
    row({
      guideRecordId: "00000000-0000-4000-8000-000000000031",
      sessionId: "session-taxon",
      detectedSpecies: ["タンポポ属", "イネ科"],
      detectedFeatures: [
        { type: "vegetation", name: "低木", confidence: 0.8 },
        { type: "species", name: "センダングサ属", confidence: 0.68 },
      ],
      environmentContext: "低木",
    }),
  ], "user-1");

  const summary = summaries[0]!;
  const visibleCopy = `${summary.headline}${summary.body}${summary.evidenceLine}`;
  assert.match(visibleCopy, /タンポポ属|イネ科|センダングサ属/);
  assert.match(visibleCopy, /候補/);
  assert.doesNotMatch(visibleCopy, /確認できたもの|見つからなかったもの|分けています/);
});
