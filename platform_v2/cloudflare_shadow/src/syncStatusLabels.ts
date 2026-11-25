export type ZukanSyncStatus = "saving" | "queued" | "delivered" | "failed";

export type ZukanSyncStatusLocale = "ja" | "en";

export const ZUKAN_SYNC_STATUS_LABELS: Readonly<
  Record<ZukanSyncStatus, Readonly<Record<ZukanSyncStatusLocale, string>>>
> = {
  saving: { ja: "保存中", en: "Saving" },
  queued: { ja: "送信待ち", en: "Waiting to send" },
  delivered: { ja: "届いた", en: "Delivered" },
  failed: { ja: "失敗", en: "Failed" },
};

export function getZukanSyncStatusLabel(
  status: ZukanSyncStatus,
  locale: ZukanSyncStatusLocale = "ja",
): string {
  return ZUKAN_SYNC_STATUS_LABELS[status][locale];
}
