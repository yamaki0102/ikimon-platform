export function buildObservationDetailPath(detailId: string, selectedOccurrenceId?: string | null): string {
  const path = `/observations/${encodeURIComponent(detailId)}`;
  if (!selectedOccurrenceId) {
    return path;
  }
  return `${path}?subject=${encodeURIComponent(selectedOccurrenceId)}`;
}
