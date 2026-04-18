import { getPool } from "../db.js";

export type ReactionType = "like" | "helpful" | "curious" | "thanks";

const VALID: ReactionType[] = ["like", "helpful", "curious", "thanks"];

export type ReactionSummary = {
  counts: Record<ReactionType, number>;
  viewerReacted: Record<ReactionType, boolean>;
};

export function isValidReactionType(s: string): s is ReactionType {
  return (VALID as string[]).includes(s);
}

export async function toggleReaction(
  occurrenceId: string,
  userId: string,
  reactionType: ReactionType,
): Promise<{ added: boolean }> {
  if (!isValidReactionType(reactionType)) throw new Error("invalid_reaction_type");
  const pool = getPool();
  const existing = await pool.query(
    `SELECT reaction_id FROM observation_reactions
       WHERE occurrence_id = $1 AND user_id = $2 AND reaction_type = $3 LIMIT 1`,
    [occurrenceId, userId, reactionType],
  );
  if (existing.rows.length > 0) {
    await pool.query(
      `DELETE FROM observation_reactions WHERE reaction_id = $1`,
      [existing.rows[0]!.reaction_id],
    );
    return { added: false };
  }
  await pool.query(
    `INSERT INTO observation_reactions (occurrence_id, user_id, reaction_type)
       VALUES ($1, $2, $3)`,
    [occurrenceId, userId, reactionType],
  );
  return { added: true };
}

export async function getReactionSummary(
  occurrenceId: string,
  viewerUserId: string | null,
): Promise<ReactionSummary> {
  const pool = getPool();
  const rows = await pool.query<{ reaction_type: string; n: string }>(
    `SELECT reaction_type, count(*)::text AS n
       FROM observation_reactions WHERE occurrence_id = $1
       GROUP BY reaction_type`,
    [occurrenceId],
  );
  const counts: Record<ReactionType, number> = { like: 0, helpful: 0, curious: 0, thanks: 0 };
  for (const r of rows.rows) {
    if (isValidReactionType(r.reaction_type)) counts[r.reaction_type] = Number(r.n);
  }
  const viewerReacted: Record<ReactionType, boolean> = { like: false, helpful: false, curious: false, thanks: false };
  if (viewerUserId) {
    const mine = await pool.query<{ reaction_type: string }>(
      `SELECT reaction_type FROM observation_reactions
         WHERE occurrence_id = $1 AND user_id = $2`,
      [occurrenceId, viewerUserId],
    );
    for (const r of mine.rows) {
      if (isValidReactionType(r.reaction_type)) viewerReacted[r.reaction_type] = true;
    }
  }
  return { counts, viewerReacted };
}
