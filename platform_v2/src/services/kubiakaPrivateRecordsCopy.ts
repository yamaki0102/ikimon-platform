import type { SiteLang } from "../i18n.js";

export type KubiakaAiState = "complete" | "working" | "failed" | "not_started" | "unknown";

export type KubiakaPrivateRecordsCopy = {
  languageLabel: string;
  skipToContent: string;
  privateLabel: string;
  homeTitle: string;
  homeLead: string;
  countLabel: (count: number) => string;
  latestTitle: string;
  nextTitle: string;
  nextLead: string;
  emptyTitle: string;
  emptyLead: string;
  captureAction: string;
  recordsAction: string;
  detailAction: string;
  guideAction: string;
  recordsTitle: string;
  recordsLead: string;
  limitedNotice: (limit: number) => string;
  detailTitle: string;
  detailLead: string;
  savedLabel: string;
  photoCountLabel: (count: number) => string;
  aiLabel: string;
  aiStates: Record<KubiakaAiState, string>;
  acknowledgementTitle: string;
  acknowledgementLead: string;
  acknowledgementAction: string;
  notFoundTitle: string;
  notFoundLead: string;
  backAction: string;
  photoAlt: (index: number, total: number) => string;
};

export function classifyKubiakaAiStatus(value: unknown): KubiakaAiState {
  const status = String(value ?? "").trim().toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (["completed", "identified", "accepted", "reviewed"].includes(status)) {
    return "complete";
  }
  if (["pending", "queued", "processing", "running", "requested", "in_progress", "reviewing", "candidate_ready", "ai_judgement", "analyzing", "analysing"].includes(status)) {
    return "working";
  }
  if (["failed", "error", "cancelled", "canceled", "failed_retryable", "failed_terminal", "unavailable"].includes(status)) {
    return "failed";
  }
  if (["", "not_requested", "none", "disabled", "not_started"].includes(status)) {
    return "not_started";
  }
  return "unknown";
}

const englishCopy: KubiakaPrivateRecordsCopy = {
  languageLabel: "Language",
  skipToContent: "Skip to content",
  privateLabel: "Private record",
  homeTitle: "My Kubiaka records",
  homeLead: "Your private cherry-tree photo records are kept here for you to revisit.",
  countLabel: (count) => `${count} private record${count === 1 ? "" : "s"}`,
  latestTitle: "Latest record",
  nextTitle: "Next action",
  nextLead: "Return after another safe observation, or review the photos already saved.",
  emptyTitle: "No private records yet",
  emptyLead: "Take one to six photos of a cherry tree to create your first private record.",
  captureAction: "Photograph a tree",
  recordsAction: "View all records",
  detailAction: "View record",
  guideAction: "View guide",
  recordsTitle: "Private record history",
  recordsLead: "Only your Kubiaka records are shown, newest first.",
  limitedNotice: (limit) => `Showing the newest ${limit} records.`,
  detailTitle: "Private record detail",
  detailLead: "This record remains private. This screen does not publish, share, or report it externally.",
  savedLabel: "Saved",
  photoCountLabel: (count) => `${count} photo${count === 1 ? "" : "s"}`,
  aiLabel: "AI processing",
  aiStates: {
    complete: "Completed",
    working: "In progress",
    failed: "Could not complete",
    not_started: "Not started",
    unknown: "Status being checked",
  },
  acknowledgementTitle: "Photos received",
  acknowledgementLead: "The acknowledgement link is still valid. The record is included in your private history.",
  acknowledgementAction: "Open saved record",
  notFoundTitle: "Record not found",
  notFoundLead: "This private record is unavailable or does not belong to the signed-in account.",
  backAction: "Back to my records",
  photoAlt: (index, total) => `Private record photo ${index} of ${total}`,
};

const japaneseCopy: KubiakaPrivateRecordsCopy = {
  languageLabel: "表示言語",
  skipToContent: "本文へ移動",
  privateLabel: "非公開記録",
  homeTitle: "自分のクビアカ記録",
  homeLead: "サクラを撮って保存した非公開記録を、あとからここで見返せます。",
  countLabel: (count) => `非公開記録 ${count}件`,
  latestTitle: "最新の記録",
  nextTitle: "次にできること",
  nextLead: "安全な場所で次のサクラを撮るか、保存済みの写真を見返せます。",
  emptyTitle: "まだ記録はありません",
  emptyLead: "サクラを1〜6枚撮ると、最初の非公開記録が保存されます。",
  captureAction: "サクラを撮る",
  recordsAction: "記録をすべて見る",
  detailAction: "記録を見る",
  guideAction: "説明を見る",
  recordsTitle: "非公開の記録履歴",
  recordsLead: "本人のクビアカ記録だけを、新しい順に表示しています。",
  limitedNotice: (limit) => `新しい記録から最大${limit}件を表示しています。`,
  detailTitle: "非公開記録の詳細",
  detailLead: "この記録は非公開です。この画面から公開・共有・外部通報は行いません。",
  savedLabel: "保存日時",
  photoCountLabel: (count) => `写真 ${count}枚`,
  aiLabel: "AI処理",
  aiStates: {
    complete: "完了",
    working: "処理中",
    failed: "完了できませんでした",
    not_started: "未開始",
    unknown: "状態を確認中",
  },
  acknowledgementTitle: "写真を受け付けました",
  acknowledgementLead: "これまでの受付リンクも利用できます。記録は非公開履歴に保存されています。",
  acknowledgementAction: "保存した記録を開く",
  notFoundTitle: "記録が見つかりません",
  notFoundLead: "この非公開記録は表示できないか、現在のアカウントの記録ではありません。",
  backAction: "自分の記録へ戻る",
  photoAlt: (index, total) => `非公開記録の写真 ${index}/${total}`,
};

export function kubiakaPrivateRecordsCopy(lang: SiteLang): KubiakaPrivateRecordsCopy {
  return lang === "ja" ? japaneseCopy : englishCopy;
}
