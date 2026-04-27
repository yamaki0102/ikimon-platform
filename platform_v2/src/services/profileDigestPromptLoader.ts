// Biodiversity Freshness OS: profile_digest -> prompt summary loader.
//
// Reads the user's profile_note_digests row (Phase 15B Relationship Score
// foundations) and produces a ≤240-char Japanese summary that the Hot-path
// observation prompt can inject. Returns empty string for new users so
// that Hot latency does not degrade.

import { getPool } from "../db.js";

export type ProfileDigestForPrompt = {
  summary: string;
  digestVersion: number;
};

const MAX_SUMMARY_LEN = 240;

function compact(value: string | null | undefined, maxChars: number): string {
  if (!value) return "";
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, maxChars - 1)}…`;
}

function extractFirstPlaceClue(rawChapters: unknown): string {
  if (!Array.isArray(rawChapters)) return "";
  for (const chapter of rawChapters) {
    if (chapter && typeof chapter === "object") {
      const placeName = (chapter as { placeName?: unknown }).placeName;
      const localClue = (chapter as { localClue?: unknown }).localClue;
      if (typeof placeName === "string" && placeName.trim().length > 0) {
        const clue = typeof localClue === "string" ? localClue.trim() : "";
        return clue ? `${placeName.trim()}（${clue}）` : placeName.trim();
      }
    }
  }
  return "";
}

export async function loadProfileDigestForPrompt(
  userId: string | null | undefined,
): Promise<ProfileDigestForPrompt> {
  if (!userId || userId.trim().length === 0) {
    return { summary: "", digestVersion: 0 };
  }
  const pool = getPool();
  const result = await pool.query<{
    digest_version: number;
    today_reading: string;
    learning_highlight: string;
    place_chapters: unknown;
  }>(
    `SELECT digest_version, today_reading, learning_highlight, place_chapters
       FROM profile_note_digests
      WHERE user_id = $1
      LIMIT 1`,
    [userId],
  );
  const row = result.rows[0];
  if (!row) return { summary: "", digestVersion: 0 };

  const parts: string[] = [];
  const reading = compact(row.today_reading, 80);
  if (reading) parts.push(`今: ${reading}`);
  const highlight = compact(row.learning_highlight, 80);
  if (highlight) parts.push(`興: ${highlight}`);
  const place = extractFirstPlaceClue(row.place_chapters);
  if (place) parts.push(`場: ${compact(place, 60)}`);

  const summary = compact(parts.join(" / "), MAX_SUMMARY_LEN);
  return {
    summary,
    digestVersion: Number(row.digest_version ?? 0),
  };
}
