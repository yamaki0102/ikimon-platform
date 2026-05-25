export const CONTINUOUS_VISIT_GAP_HOURS = 3;
export const CONTINUOUS_VISIT_GAP_MS = CONTINUOUS_VISIT_GAP_HOURS * 60 * 60 * 1000;
export const CONTINUOUS_VISIT_GAP_INTERVAL_SQL = `interval '${CONTINUOUS_VISIT_GAP_HOURS} hours'`;

export type VisitWindowRecord = {
  observedAt: string | Date;
};

function observedAtMs(value: string | Date): number {
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : Number.NaN;
}

export function countContinuousVisitWindows(
  records: VisitWindowRecord[],
  gapMs = CONTINUOUS_VISIT_GAP_MS,
): number {
  const observedTimes = records
    .map((record) => observedAtMs(record.observedAt))
    .filter((ms) => Number.isFinite(ms))
    .sort((a, b) => a - b);

  if (observedTimes.length === 0) {
    return 0;
  }

  let windowCount = 1;
  for (let index = 1; index < observedTimes.length; index += 1) {
    if (observedTimes[index]! - observedTimes[index - 1]! > gapMs) {
      windowCount += 1;
    }
  }
  return windowCount;
}
