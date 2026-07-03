import type { PublicLocationMode, PublicTimePrecision } from "./observationPublicationPolicy.js";

export type ObservationContributionStatus = "public" | "suppressed" | "internal" | "private";
export type ObservationContributionDisplayStatus = "contributed" | "pending" | "suppressed" | "private";
export type ObservationContributionAiState = "ai_draft" | "human_touched" | "verified";

export type ObservationSiteContributionInput = {
  fieldName?: string | null;
  contributionStatus: ObservationContributionStatus;
  publicLocationMode: PublicLocationMode;
  publicTimePrecision: PublicTimePrecision;
  aiOnly?: boolean | null;
  verified?: boolean | null;
  publicationReason?: string | null;
};

export type ObservationSiteContributionAction = {
  key: "dispute" | "make_private" | "add_evidence";
  label: string;
};

export type ObservationSiteContribution = {
  status: ObservationContributionDisplayStatus;
  aiState: ObservationContributionAiState;
  headline: string;
  body: string;
  publicStateLabel: string;
  publicationReason: string;
  actions: ObservationSiteContributionAction[];
};

const ACTIONS: ObservationSiteContributionAction[] = [
  { key: "dispute", label: "違う" },
  { key: "make_private", label: "非公開" },
  { key: "add_evidence", label: "追加で撮る" },
];

function fieldLabel(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value.trim() : "この場所";
}

function aiState(input: ObservationSiteContributionInput): ObservationContributionAiState {
  if (input.verified === true) return "verified";
  return input.aiOnly === true ? "ai_draft" : "human_touched";
}

function displayStatus(input: ObservationSiteContributionInput): ObservationContributionDisplayStatus {
  if (input.contributionStatus === "public") return "contributed";
  if (input.contributionStatus === "suppressed") return "suppressed";
  if (input.contributionStatus === "private") return "private";
  return "pending";
}

function publicStateLabel(input: ObservationSiteContributionInput): string {
  if (input.publicLocationMode === "hidden") return "非公開";
  if (input.contributionStatus === "suppressed") return "場所を丸めて保留";
  if (input.publicLocationMode === "site") return "場所単位で公開";
  if (input.publicLocationMode === "municipality") return "市区町村単位で公開";
  if (input.publicLocationMode === "grid_250m" || input.publicLocationMode === "grid_1km") return "場所を丸めて公開";
  return "場所単位で公開";
}

export function buildObservationSiteContribution(
  input: ObservationSiteContributionInput,
): ObservationSiteContribution {
  const status = displayStatus(input);
  const label = fieldLabel(input.fieldName);
  const reason = typeof input.publicationReason === "string" ? input.publicationReason : "";
  const state = aiState(input);

  if (status === "contributed") {
    return {
      status,
      aiState: state,
      headline: `この記録は${label}のプロフィールに貢献しました`,
      body: "個別の正確な位置ではなく、場所の季節や生きものリストを育てる材料として扱います。",
      publicStateLabel: publicStateLabel(input),
      publicationReason: reason,
      actions: ACTIONS,
    };
  }
  if (status === "suppressed") {
    return {
      status,
      aiState: state,
      headline: `${label}のプロフィールにはまだ出していません`,
      body: "少数記録、敏感な文脈、または公開条件のため、場所単位の傾向として扱う前に保留しています。",
      publicStateLabel: publicStateLabel(input),
      publicationReason: reason,
      actions: ACTIONS,
    };
  }
  if (status === "private") {
    return {
      status,
      aiState: state,
      headline: "この記録は自分だけに表示されています",
      body: "公開プロフィールや外部資料には使いません。あとから公開範囲を変えるまで内部の記録として残ります。",
      publicStateLabel: publicStateLabel(input),
      publicationReason: reason,
      actions: ACTIONS,
    };
  }
  return {
    status,
    aiState: state,
    headline: `${label}のプロフィールに使えるか確認中です`,
    body: state === "ai_draft"
      ? "AI候補は下書きです。人の確認、同意、公開条件がそろうまで公開プロフィールには出しません。"
      : "同意、公開精度、最小件数の条件がそろうと、場所のプロフィールに反映されます。",
    publicStateLabel: publicStateLabel(input),
    publicationReason: reason,
    actions: ACTIONS,
  };
}
