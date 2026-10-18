import type { PublicParticipation, PublicParticipationSource } from "./genrePortal";

interface GenrePortalDatabase {
  prepare(sql: string): { bind(...values: string[]): { all<T>(): Promise<{ results: T[] }> } };
}

type Row = { participation_id: string; participation_kind: PublicParticipation["kind"]; genre_slug: string; region_slug: string | null; name: string; description: string | null; public_url: string | null; starts_at: string | null; location_name: string | null; publisher_name: string | null };

export function createD1PublicParticipationSource(db: GenrePortalDatabase): PublicParticipationSource {
  return { async listPublic(filter) {
    const clauses = ["publication_status = 'public'"];
    const values: string[] = [];
    if (filter.genre) { clauses.push("genre_slug = ?"); values.push(filter.genre); }
    if (filter.region) { clauses.push("region_slug = ?"); values.push(filter.region); }
    let results: Row[];
    try {
      ({ results } = await db.prepare(`SELECT participation_id, participation_kind, genre_slug, region_slug, name, description, public_url, starts_at, location_name, publisher_name FROM zukan_public_participations WHERE ${clauses.join(" AND ")} ORDER BY starts_at DESC, participation_id`).bind(...values).all<Row>());
    } catch (error) {
      if (/no such table|does not exist/i.test(String(error))) return [];
      throw error;
    }
    return results.map((row) => ({ id: row.participation_id, kind: row.participation_kind, genre: row.genre_slug, region: row.region_slug, name: row.name, description: row.description, url: row.public_url, startDate: row.starts_at, location: row.location_name, publisher: row.publisher_name }));
  } };
}
