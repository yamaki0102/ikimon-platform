export type WorkOpportunityKind = "job" | "workplace" | "visit";

export type PublicWorkOpportunity = {
  id: string;
  editionId: string;
  kind: WorkOpportunityKind;
  state: "open" | "closed";
  title: string;
  organizationName: string;
  placeName: string;
  relationshipLabel: string;
  payLabel: string | null;
  scheduleLabel: string | null;
  summary: string;
  sourceLabel: string;
  sourceUrl: string;
  publishedAt: string;
  validThrough: string | null;
  detailPath: string;
};

export type WorkOpportunityQuery = { query?: string; place?: string; kind?: WorkOpportunityKind | "all" };

const normalized = (value?: string) => (value ?? "").normalize("NFKC").trim().toLocaleLowerCase("ja");
const PUBLIC_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export function isPublicWorkOpportunityId(value: unknown): value is string {
  return typeof value === "string" && value !== "." && value !== ".." && PUBLIC_ID.test(value);
}

export function publicWorkOpportunitySourceUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0 || value.length > 2048) return null;
  try {
    const parsed = new URL(value);
    if ((parsed.protocol !== "https:" && parsed.protocol !== "http:") || parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

function optionalText(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && value.length <= 1000);
}

/** Parse only the public-edition fields used by ZUKAN; ignore any extra payload data. */
export function parsePublicWorkOpportunity(value: unknown, publishedAtFallback?: string | null): PublicWorkOpportunity | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const publishedAt = input.publishedAt === undefined || input.publishedAt === null ? publishedAtFallback : input.publishedAt;
  const sourceUrl = publicWorkOpportunitySourceUrl(input.sourceUrl);
  const kind = input.kind;
  if (!isPublicWorkOpportunityId(input.id)
    || typeof input.editionId !== "string" || !input.editionId.trim() || input.editionId.length > 128
    || (kind !== "job" && kind !== "workplace" && kind !== "visit")
    || (input.state !== "open" && input.state !== "closed")
    || typeof input.title !== "string" || !input.title.trim() || input.title.length > 1000
    || typeof input.organizationName !== "string" || !input.organizationName.trim() || input.organizationName.length > 1000
    || typeof input.placeName !== "string" || !input.placeName.trim() || input.placeName.length > 1000
    || typeof input.relationshipLabel !== "string" || !input.relationshipLabel.trim() || input.relationshipLabel.length > 1000
    || !optionalText(input.payLabel)
    || !optionalText(input.scheduleLabel)
    || typeof input.summary !== "string" || !input.summary.trim() || input.summary.length > 4000
    || typeof input.sourceLabel !== "string" || !input.sourceLabel.trim() || input.sourceLabel.length > 1000
    || !sourceUrl
    || typeof publishedAt !== "string" || !Number.isFinite(Date.parse(publishedAt))
    || !(input.validThrough === null || (typeof input.validThrough === "string" && Number.isFinite(Date.parse(input.validThrough))))
    || typeof input.detailPath !== "string" || input.detailPath.length > 2048) {
    return null;
  }
  return {
    id: input.id,
    editionId: input.editionId,
    kind,
    state: input.state,
    title: input.title,
    organizationName: input.organizationName,
    placeName: input.placeName,
    relationshipLabel: input.relationshipLabel,
    payLabel: typeof input.payLabel === "string" ? input.payLabel.trim() || null : input.payLabel,
    scheduleLabel: typeof input.scheduleLabel === "string" ? input.scheduleLabel.trim() || null : input.scheduleLabel,
    summary: input.summary,
    sourceLabel: input.sourceLabel,
    sourceUrl,
    publishedAt,
    validThrough: input.validThrough,
    detailPath: input.detailPath,
  };
}

export function isCurrentPublicWorkOpportunity(item: PublicWorkOpportunity, now = new Date()): boolean {
  if (item.state !== "open") return false;
  if (item.validThrough === null) return true;
  const end = Date.parse(item.validThrough);
  return Number.isFinite(end) && end > now.getTime();
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
