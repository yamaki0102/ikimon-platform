export type InvasiveLawParsedRow = {
  scientific_name: string;
  vernacular_jp?: string;
  mhlw_category: "iaspecified" | "priority" | "industrial" | "prevention";
  source_excerpt: string;
};

export type ValidationResult<T> = {
  accepted: T[];
  dropped: Array<{ index: number; reason: string }>;
};

const MHLW_CATEGORIES = new Set(["iaspecified", "priority", "industrial", "prevention"]);
const MIN_EXACT_SECRET_LENGTH = 20;

function shouldCheckExactSecret(value: string): boolean {
  return value.length >= MIN_EXACT_SECRET_LENGTH;
}

export function assertNoSecretLeak(payloadText: string, secrets: Array<string | undefined | null>): void {
  for (const secret of secrets) {
    const trimmed = secret?.trim();
    if (trimmed && shouldCheckExactSecret(trimmed) && payloadText.includes(trimmed)) {
      throw new Error("curator_payload_secret_leak_detected");
    }
  }
  if (/sk-[A-Za-z0-9_-]{20,}/.test(payloadText)) {
    throw new Error("curator_payload_secret_pattern_detected");
  }
}

export function looksLikeScientificName(value: string): boolean {
  const text = value.trim();
  return /^[A-Z][a-z-]+(?:\s+(?:[a-z][a-z-]+|spp\.?|sp\.)){0,2}$/.test(text);
}

export function validateInvasiveLawRows(rows: unknown[]): ValidationResult<InvasiveLawParsedRow> {
  const accepted: InvasiveLawParsedRow[] = [];
  const dropped: Array<{ index: number; reason: string }> = [];
  rows.forEach((row, index) => {
    if (!row || typeof row !== "object") {
      dropped.push({ index, reason: "row_not_object" });
      return;
    }
    const obj = row as Record<string, unknown>;
    const scientificName = typeof obj.scientific_name === "string" ? obj.scientific_name.trim() : "";
    const category = typeof obj.mhlw_category === "string" ? obj.mhlw_category.trim() : "";
    const sourceExcerpt = typeof obj.source_excerpt === "string" ? obj.source_excerpt.trim() : "";
    const vernacularJp = typeof obj.vernacular_jp === "string" ? obj.vernacular_jp.trim() : "";

    if (!scientificName) {
      dropped.push({ index, reason: "missing_scientific_name" });
      return;
    }
    if (!looksLikeScientificName(scientificName)) {
      dropped.push({ index, reason: "invalid_scientific_name" });
      return;
    }
    if (!MHLW_CATEGORIES.has(category)) {
      dropped.push({ index, reason: "invalid_mhlw_category" });
      return;
    }
    if (!sourceExcerpt) {
      dropped.push({ index, reason: "missing_source_excerpt" });
      return;
    }
    if (sourceExcerpt.length > 600) {
      dropped.push({ index, reason: "source_excerpt_too_long" });
      return;
    }

    accepted.push({
      scientific_name: scientificName,
      vernacular_jp: vernacularJp || undefined,
      mhlw_category: category as InvasiveLawParsedRow["mhlw_category"],
      source_excerpt: sourceExcerpt,
    });
  });
  return { accepted, dropped };
}

export function dedupeInvasiveRows(rows: InvasiveLawParsedRow[]): InvasiveLawParsedRow[] {
  const seen = new Set<string>();
  const out: InvasiveLawParsedRow[] = [];
  for (const row of rows) {
    const key = `${row.scientific_name.toLowerCase()}|${row.mhlw_category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}
