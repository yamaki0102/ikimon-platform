export type EventRecordVisibility = "private" | "event" | "public";

export function normalizeEventRecordVisibility(
  input: unknown,
  fallback: EventRecordVisibility = "event",
): EventRecordVisibility | null {
  if (input === undefined || input === null || input === "") return fallback;
  if (input === "private" || input === "event" || input === "public") return input;
  return null;
}

export function isSensitiveOrRareEventRecord(payload: Record<string, unknown>): boolean {
  if (
    payload.sensitive_precheck_failed === true
    || payload.is_sensitive === true
    || payload.isSensitive === true
    || payload.is_rare === true
    || payload.isRare === true
    || payload.rare === true
    || payload.visibility === "limited"
  ) {
    return true;
  }
  const redList = typeof payload.red_list_rank === "string"
    ? payload.red_list_rank.trim()
    : typeof payload.redListRank === "string"
      ? payload.redListRank.trim()
      : "";
  return redList.length > 0;
}

export function resolveEventRecordVisibility(payload: Record<string, unknown>): EventRecordVisibility {
  const raw = normalizeEventRecordVisibility(payload.record_visibility ?? payload.visibility, "event") ?? "event";
  if (raw === "public" && isSensitiveOrRareEventRecord(payload)) return "event";
  return raw;
}

export function canViewEventRecord(
  record: {
    visibility: EventRecordVisibility;
    actorUserId: string | null;
    actorGuestToken: string | null;
    isSensitiveOrRare: boolean;
  },
  viewer: {
    userId: string | null;
    guestToken: string | null;
    isOrganizer: boolean;
    isCheckedInParticipant: boolean;
  },
): boolean {
  const isRecorder = Boolean(
    (viewer.userId && record.actorUserId && viewer.userId === record.actorUserId)
    || (viewer.guestToken && record.actorGuestToken && viewer.guestToken === record.actorGuestToken),
  );
  if (record.visibility === "private") return isRecorder;
  if (record.visibility === "event") return isRecorder || viewer.isOrganizer || viewer.isCheckedInParticipant;
  if (record.isSensitiveOrRare) return isRecorder || viewer.isOrganizer || viewer.isCheckedInParticipant;
  return true;
}

export function buildPostEventPublishPrompt(
  session: { endedAt: string | null },
  myRecords: ReadonlyArray<{ visibility: EventRecordVisibility; isSensitiveOrRare: boolean }>,
  nowMs = Date.now(),
): { eligibleCount: number; excludedRareCount: number; message: string } | null {
  if (!session.endedAt) return null;
  const endedMs = Date.parse(session.endedAt);
  if (!Number.isFinite(endedMs) || endedMs > nowMs) return null;
  let eligibleCount = 0;
  let excludedRareCount = 0;
  for (const rec of myRecords) {
    if (rec.visibility === "public") continue;
    if (rec.isSensitiveOrRare) {
      excludedRareCount += 1;
    } else {
      eligibleCount += 1;
    }
  }
  if (eligibleCount === 0) return null;
  return {
    eligibleCount,
    excludedRareCount,
    message: `今日の記録${eligibleCount}件、公開しますか？`,
  };
}
