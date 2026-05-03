import type { CivicObservationContext } from "./civicNatureContext.js";
import { civicContextLabel } from "./civicNatureContext.js";

export type CivicReportKind =
  | "event_recap"
  | "school_monthly_note"
  | "satoyama_management_record"
  | "risk_confirmation_memo"
  | "site_initial_summary";

export type CivicReportInput = {
  kind: CivicReportKind;
  title?: string | null;
  context?: CivicObservationContext | null;
  observations?: Array<{
    label?: string | null;
    observedAt?: string | null;
    evidence?: string[] | null;
    note?: string | null;
  }>;
  managementActions?: Array<{
    label: string;
    happenedAt?: string | null;
    note?: string | null;
  }>;
  limitations?: string[];
};

export type CivicReportDraft = {
  kind: CivicReportKind;
  title: string;
  audience: string;
  decisionUse: string;
  publicSummary: string[];
  internalNotes: string[];
  limitations: string[];
};

function nonEmpty(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function observationLine(input: NonNullable<CivicReportInput["observations"]>[number]): string {
  const label = nonEmpty(input.label) ?? "名前を確認中の記録";
  const date = nonEmpty(input.observedAt);
  const evidence = Array.isArray(input.evidence) && input.evidence.length > 0
    ? ` / 証拠: ${input.evidence.slice(0, 4).join("・")}`
    : "";
  return `${date ? `${date}: ` : ""}${label}${evidence}`;
}

export function buildCivicReportDraft(input: CivicReportInput): CivicReportDraft {
  const contextLabel = input.context ? civicContextLabel(input.context) : "地域自然ノート";
  const observations = (input.observations ?? []).slice(0, 8).map(observationLine);
  const limitations = input.limitations?.filter(Boolean).slice(0, 8) ?? [];
  const title = nonEmpty(input.title) ?? contextLabel;

  if (input.kind === "event_recap") {
    return {
      kind: input.kind,
      title,
      audience: "参加者・主催者",
      decisionUse: "次回の観察会で見る場所と足す証拠を決める",
      publicSummary: observations.length > 0 ? observations : ["この観察会で見つけたものを、確認状況つきで整理する。"],
      internalNotes: ["個人成績ではなく、共同で残せた証拠と次回の確認点を中心にする。"],
      limitations,
    };
  }
  if (input.kind === "school_monthly_note") {
    return {
      kind: input.kind,
      title,
      audience: "子ども・先生",
      decisionUse: "授業で前月との違いを話し、次に見るテーマを選ぶ",
      publicSummary: observations.length > 0 ? observations : ["クラスで見つけた自然を月ごとに振り返る。"],
      internalNotes: ["児童の個人情報、顔、正確な集合場所は公開版に出さない。"],
      limitations,
    };
  }
  if (input.kind === "satoyama_management_record") {
    const actions = (input.managementActions ?? []).slice(0, 6).map((action) =>
      `${action.happenedAt ? `${action.happenedAt}: ` : ""}${action.label}${action.note ? ` / ${action.note}` : ""}`,
    );
    return {
      kind: input.kind,
      title,
      audience: "里山・農園管理者、地域団体",
      decisionUse: "管理作業の前後で状態がどう変わったかを見直す",
      publicSummary: observations.length > 0 ? observations : ["管理行為と観察を同じ時間軸に並べる。"],
      internalNotes: actions.length > 0 ? actions : ["草刈り、間伐、水路管理などの管理行為を観察と一緒に残す。"],
      limitations,
    };
  }
  if (input.kind === "risk_confirmation_memo") {
    return {
      kind: input.kind,
      title,
      audience: "自治体・管理者・観察会主催者",
      decisionUse: "危険・外来種・街路樹異常を断定せず、確認対象として扱う",
      publicSummary: observations.length > 0 ? observations : ["確認が必要な記録を証拠と限界つきで整理する。"],
      internalNotes: ["駆除・危険・法令判断は本文で断定しない。確認者、証拠、未確認点を残す。"],
      limitations: limitations.length > 0 ? limitations : ["このメモは現地確認と専門確認の前段であり、行政判断そのものではない。"],
    };
  }
  return {
    kind: input.kind,
    title,
    audience: "拠点担当者・自治体・研究者",
    decisionUse: "初回調査で分かったことと、次に追加すべき証拠を整理する",
    publicSummary: observations.length > 0 ? observations : ["初回の自然サマリーを、証拠と限界つきで残す。"],
    internalNotes: ["公開版では希少種位置、児童情報、管理上の詳細位置を必要に応じて丸める。"],
    limitations,
  };
}
