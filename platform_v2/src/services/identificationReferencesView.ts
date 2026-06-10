export type IdentificationReferenceView = {
  sourceId: string;
  title: string;
  locator: string;
  referenceRole: string;
  citationText: string;
  publisher: string;
  publicationYear: number | null;
};

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readYear(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

export function identificationReferencesFromJson(value: unknown): IdentificationReferenceView[] {
  if (!Array.isArray(value)) return [];
  const references: IdentificationReferenceView[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const sourceId = readString(record, "sourceId") || readString(record, "source_id");
    const title = readString(record, "title");
    if (!sourceId || !title) continue;
    const locator = readString(record, "locator");
    const referenceRole = readString(record, "referenceRole") || readString(record, "reference_role") || "primary_basis";
    const dedupeKey = `${sourceId}:${referenceRole}:${locator}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    references.push({
      sourceId,
      title,
      locator,
      referenceRole,
      citationText: readString(record, "citationText") || readString(record, "citation_text"),
      publisher: readString(record, "publisher"),
      publicationYear: readYear(record, "publicationYear") ?? readYear(record, "publication_year"),
    });
  }
  return references;
}
