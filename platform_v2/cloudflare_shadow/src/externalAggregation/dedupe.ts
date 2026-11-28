import { sha256Hex } from "./util";
import type { ExtractedFact } from "./types";

const norm = (s: string | null | undefined) => (s ?? "").normalize("NFKC").toLowerCase().replace(/\s+/g, "");

function startKey(startsAt: string): string {
  const t = startsAt.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return t;
  return new Date(ms + 9 * 3600_000).toISOString().slice(0, 16);
}

export async function dedupeKey(fact: Pick<ExtractedFact, "title" | "starts_at" | "venue_name">): Promise<string> {
  return sha256Hex(`${norm(fact.title)}|${startKey(fact.starts_at)}|${norm(fact.venue_name)}`);
}
