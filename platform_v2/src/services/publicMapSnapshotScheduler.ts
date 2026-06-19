import {
  refreshPublicMapSnapshotIfStale,
  resolvePublicMapSnapshotMaxAgeMs,
} from "./mapSnapshot.js";

let schedulerHandle: NodeJS.Timeout | null = null;
let queuedRefresh: Promise<void> | null = null;
let lastWriteRefreshMs = 0;

const DEFAULT_REFRESH_INTERVAL_MS = 60 * 60 * 1000;
const MIN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const DEFAULT_WRITE_REFRESH_DEBOUNCE_MS = 2 * 60 * 1000;
const MIN_WRITE_REFRESH_DEBOUNCE_MS = 30 * 1000;

function resolveRefreshIntervalMs(env: Record<string, string | undefined> = process.env): number {
  const rawMinutes = Number(env.IKIMON_PUBLIC_MAP_SNAPSHOT_REFRESH_INTERVAL_MINUTES);
  if (Number.isFinite(rawMinutes) && rawMinutes > 0) {
    return Math.max(MIN_REFRESH_INTERVAL_MS, Math.trunc(rawMinutes * 60 * 1000));
  }
  return DEFAULT_REFRESH_INTERVAL_MS;
}

function publicMapSnapshotRefreshDisabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.IKIMON_PUBLIC_MAP_SNAPSHOT_REFRESH_DISABLED === "1";
}

function resolveWriteRefreshDebounceMs(env: Record<string, string | undefined> = process.env): number {
  const rawSeconds = Number(env.IKIMON_PUBLIC_MAP_SNAPSHOT_WRITE_REFRESH_DEBOUNCE_SECONDS);
  if (Number.isFinite(rawSeconds) && rawSeconds > 0) {
    return Math.max(MIN_WRITE_REFRESH_DEBOUNCE_MS, Math.trunc(rawSeconds * 1000));
  }
  return DEFAULT_WRITE_REFRESH_DEBOUNCE_MS;
}

export async function runPublicMapSnapshotSchedulerTick(
  options: { force?: boolean; refreshedBy?: string } = {},
): Promise<void> {
  if (publicMapSnapshotRefreshDisabled()) return;
  const result = await refreshPublicMapSnapshotIfStale({
    force: options.force,
    maxAgeMs: resolvePublicMapSnapshotMaxAgeMs(),
    refreshedBy: options.refreshedBy ?? "scheduler:public-map-snapshot",
  });
  if (result.refreshed) {
    console.info("[public-map-snapshot] refreshed", {
      snapshotKey: result.refresh?.snapshotKey,
      generatedAt: result.refresh?.generatedAt,
      sourceSampleSize: result.refresh?.sourceSampleSize,
      publicRecordCount: result.refresh?.publicRecordCount,
    });
  }
}

export function queuePublicMapSnapshotRefresh(reason: string, options: { force?: boolean } = {}): void {
  if (publicMapSnapshotRefreshDisabled() || queuedRefresh) return;
  if (options.force) {
    const now = Date.now();
    if (now - lastWriteRefreshMs < resolveWriteRefreshDebounceMs()) return;
    lastWriteRefreshMs = now;
  }
  queuedRefresh = runPublicMapSnapshotSchedulerTick({
    force: options.force,
    refreshedBy: `write:${reason}`,
  })
    .catch((error) => {
      console.warn("[public-map-snapshot] queued refresh failed", error);
    })
    .finally(() => {
      queuedRefresh = null;
    });
}

export function startPublicMapSnapshotScheduler(): void {
  if (schedulerHandle || publicMapSnapshotRefreshDisabled()) return;
  schedulerHandle = setInterval(() => {
    void runPublicMapSnapshotSchedulerTick().catch((error) => {
      console.warn("[public-map-snapshot] scheduler tick failed", error);
    });
  }, resolveRefreshIntervalMs());
  if (typeof schedulerHandle.unref === "function") schedulerHandle.unref();
}

export function stopPublicMapSnapshotScheduler(): void {
  if (!schedulerHandle) return;
  clearInterval(schedulerHandle);
  schedulerHandle = null;
}

export const __test__ = {
  resolveRefreshIntervalMs,
  resolveWriteRefreshDebounceMs,
  publicMapSnapshotRefreshDisabled,
};
