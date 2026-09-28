export type WorkOpportunityKind = "job" | "workplace" | "visit";
export type PublicWorkOpportunity = {
  id: string; editionId: string; kind: WorkOpportunityKind; state: "open" | "closed";
  title: string; organizationName: string; placeName: string; relationshipLabel: string;
  payLabel: string | null; scheduleLabel: string | null; summary: string;
  sourceLabel: string; sourceUrl: string; publishedAt: string; validThrough: string | null; detailPath: string;
};
export type WorkOpportunityQuery = { query?: string; place?: string; kind?: WorkOpportunityKind | "all" };

const normalized = (value?: string) => (value ?? "").normalize("NFKC").trim().toLocaleLowerCase("ja");

export function isCurrentPublicWorkOpportunity(item: PublicWorkOpportunity, now = new Date()): boolean {
  if (item.state !== "open") return false;
  if (!item.validThrough) return true;
  const end = Date.parse(item.validThrough);
  return Number.isFinite(end) && end >= now.getTime();
}

/** Projects approved public editions only. Candidate and application data is deliberately absent. */
export function findPublicWorkOpportunities(items: readonly PublicWorkOpportunity[], input: WorkOpportunityQuery, now = new Date()): PublicWorkOpportunity[] {
  const query = normalized(input.query), place = normalized(input.place);
  return items.filter((item) => isCurrentPublicWorkOpportunity(item, now))
    .filter((item) => !input.kind || input.kind === "all" || item.kind === input.kind)
    .filter((item) => !place || normalized(item.placeName).includes(place))
    .filter((item) => !query || [item.title, item.organizationName, item.placeName, item.relationshipLabel, item.summary].some((value) => normalized(value).includes(query)))
    .sort((a, b) => a.title.localeCompare(b.title, "ja") || a.id.localeCompare(b.id));
}

export const workOpportunityKindLabel = (kind: WorkOpportunityKind): string => kind === "job" ? "仕事" : kind === "workplace" ? "職場" : "見学・仕事体験";
