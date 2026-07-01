import type { ObservationUpsertInput, ObservationWriteResult } from "./observationWrite.js";
import { hasUsableObservationCoordinates } from "./localityNormalization.js";
import type { GuideUnlockSummary } from "./guideUnlocks.js";

export type ContributionReceiptKind =
  | "record_body_saved"
  | "place_comparison_seeded"
  | "identification_context_saved"
  | "uncertainty_preserved"
  | "absence_context_saved"
  | "revisit_seeded"
  | "guide_unlocked";

export type ContributionReceipt = {
  kind: ContributionReceiptKind;
  title: string;
  body: string;
  claimLevel: "immediate";
  nextAction: {
    label: string;
    href: string;
    actionKey: string;
  };
};

export type RecordFeedbackLoop = {
  kind: "record_feedback_loop";
  status: "queued";
  claimLevel: "deferred";
  title: string;
  body: string;
  signalKinds: Array<"season" | "place" | "environment">;
  nextAction: {
    label: string;
    href: string;
    actionKey: "open_record_feedback";
  };
};

export type ContributionReceiptInput = {
  input: ObservationUpsertInput;
  result: ObservationWriteResult;
  guideUnlocks?: GuideUnlockSummary[];
};

function sourcePayload(input: ObservationUpsertInput): Record<string, unknown> {
  return input.sourcePayload && typeof input.sourcePayload === "object" ? input.sourcePayload : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasIdentificationHint(input: ObservationUpsertInput): boolean {
  if (input.taxon && (text(input.taxon.scientificName) || text(input.taxon.vernacularName) || text(input.taxon.rank))) {
    return true;
  }
  return (Array.isArray(input.subjects) ? input.subjects : []).some((subject) =>
    Boolean(text(subject.scientificName) || text(subject.vernacularName) || text(subject.rank)),
  );
}

function hasPlaceAnchor(input: ObservationUpsertInput): boolean {
  return hasUsableObservationCoordinates(input.latitude, input.longitude)
    || Boolean(text(input.siteId))
    || Boolean(text(input.siteName))
    || Boolean(text(input.prefecture))
    || Boolean(text(input.municipality));
}

function receipt(input: Omit<ContributionReceipt, "claimLevel">): ContributionReceipt {
  return {
    ...input,
    claimLevel: "immediate",
  };
}

export function buildContributionReceipts({ input, result, guideUnlocks = [] }: ContributionReceiptInput): ContributionReceipt[] {
  const payload = sourcePayload(input);
  const quickCaptureState = text(payload.quick_capture_state) || result.impact.captureState || "";
  const surveyResult = text(payload.survey_result);
  const hasIdentification = hasIdentificationHint(input);
  const isAbsenceRecord = quickCaptureState === "no_detection_note" || surveyResult === "no_detection_note";
  const isUnknownRecord = quickCaptureState === "unknown" || !hasIdentification;
  const hasRevisitFrame = input.visitMode === "survey" || Boolean(text(input.revisitReason) || text(input.targetTaxaScope));
  const hasLocationAnchor = hasPlaceAnchor(input);
  const observationHref = `/observations/${encodeURIComponent(result.visitId)}?subject=${encodeURIComponent(result.occurrenceId)}`;
  const revisitHref = `/record?start=gallery&revisitObservationId=${encodeURIComponent(result.visitId)}`;
  const placeName = text(result.impact.placeName);
  const occurrenceCount = Math.max(1, result.occurrenceIds.length);

  const receipts: ContributionReceipt[] = [
    receipt({
      kind: "record_body_saved",
      title: occurrenceCount > 1 ? `${occurrenceCount} 件の対象を記録に残しました` : "あとから確認できる記録になりました",
      body: "日時・場所・入力内容がまとまり、あとから確認できる観察ページになりました。",
      nextAction: {
        label: "記録を見る",
        href: observationHref,
        actionKey: "view_observation",
      },
    }),
  ];

  if (!hasLocationAnchor) {
    receipts.push(receipt({
      kind: "place_comparison_seeded",
      title: "地点なしのメモとして保存しました",
      body: "場所を決めずに、日時・メモ・名前の手がかりをあとから確認できる状態で残しました。",
      nextAction: {
        label: "記録を見る",
        href: observationHref,
        actionKey: "view_unlocated_observation",
      },
    }));
  } else if (hasRevisitFrame) {
    receipts.push(receipt({
      kind: "revisit_seeded",
      title: "同じ条件で見返す起点ができました",
      body: input.visitMode === "survey"
        ? "見た範囲・目的・時間がまとまり、次回の観察と比べやすくなりました。"
        : "次に見たい観点が残り、同じ場所で続きの観察へ戻りやすくなりました。",
      nextAction: {
        label: "同じ場所で続ける",
        href: revisitHref,
        actionKey: "revisit_same_place",
      },
    }));
  } else {
    receipts.push(receipt({
      kind: "place_comparison_seeded",
      title: result.impact.previousObservedAt ? "前回との差分を比べる手がかりです" : "この場所の比較起点になりました",
      body: result.impact.previousObservedAt
        ? `${placeName || "この場所"} の前回記録と比べる材料が増えました。`
        : "この場所を次に見たとき、今日の状態と比べる起点になります。",
      nextAction: {
        label: "同じ場所でもう1件",
        href: revisitHref,
        actionKey: "revisit_same_place",
      },
    }));
  }

  const guideUnlock = guideUnlocks[0] ?? null;
  if (guideUnlock) {
    receipts.push(receipt({
      kind: "guide_unlocked",
      title: "近くの現地ガイドが聞けるようになりました",
      body: `${guideUnlock.guideTitle} をマイガイドに保存しました。公開投稿や正確な位置共有をしなくても、本人用にあとから聞けます。`,
      nextAction: {
        label: "マイガイドを開く",
        href: guideUnlock.href,
        actionKey: "open_my_guides",
      },
    }));
  } else if (isAbsenceRecord) {
    receipts.push(receipt({
      kind: "absence_context_saved",
      title: "見なかった状況も比較材料です",
      body: "今日は見なかったことを、同じ条件で見返すための記録として残しました。",
      nextAction: {
        label: "記録を確認する",
        href: observationHref,
        actionKey: "review_absence_context",
      },
    }));
  } else if (isUnknownRecord) {
    receipts.push(receipt({
      kind: "uncertainty_preserved",
      title: "不明のまま確認に回せます",
      body: "名前を急がず、場所・時間・周囲の手がかりを先に残せました。",
      nextAction: {
        label: "手がかりを見る",
        href: observationHref,
        actionKey: "review_unknown_observation",
      },
    }));
  } else {
    receipts.push(receipt({
      kind: "identification_context_saved",
      title: "名前の手がかりが残りました",
      body: "名前の候補と観察条件がまとまり、あとから確認しやすくなりました。",
      nextAction: {
        label: "名前を確認する",
        href: observationHref,
        actionKey: "review_identification",
      },
    }));
  }

  return receipts.slice(0, 3);
}

export function buildRecordFeedbackLoop({ result }: Pick<ContributionReceiptInput, "result">): RecordFeedbackLoop {
  const observationHref = `/observations/${encodeURIComponent(result.visitId)}?subject=${encodeURIComponent(result.occurrenceId)}`;
  return {
    kind: "record_feedback_loop",
    status: "queued",
    claimLevel: "deferred",
    title: "ヒント待ち",
    body: "季節・場所・環境の手がかりを、記録ページで見返せます。",
    signalKinds: ["season", "place", "environment"],
    nextAction: {
      label: "記録を見る",
      href: observationHref,
      actionKey: "open_record_feedback",
    },
  };
}
