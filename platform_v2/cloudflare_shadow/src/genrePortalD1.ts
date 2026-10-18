import type { PublicParticipation, PublicParticipationSource } from "./genrePortal";

interface GenrePortalDatabase {
  prepare(sql: string): { bind(...values: string[]): { all<T>(): Promise<{ results: T[] }> } };
}

type Row = {
  participation_id: string;
  participation_kind: PublicParticipation["kind"];
  payload_json: string;
};

type ParticipationPayload = {
  genre: string;
  region?: string | null;
  title: string;
  description?: string | null;
  url?: string | null;
  startsAt?: string | null;
  locationName?: string | null;
  publisherName?: string | null;
};

const isOptionalString = (value: unknown): value is string | null | undefined =>
  value === undefined || value === null || typeof value === "string";

function parsePayload(payloadJson: string): ParticipationPayload | null {
  try {
    const payload: unknown = JSON.parse(payloadJson);
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const candidate = payload as Record<string, unknown>;
    if (
      typeof candidate.genre !== "string"
      || typeof candidate.title !== "string"
      || !isOptionalString(candidate.region)
      || !isOptionalString(candidate.description)
      || !isOptionalString(candidate.url)
      || !isOptionalString(candidate.startsAt)
      || !isOptionalString(candidate.locationName)
      || !isOptionalString(candidate.publisherName)
    ) return null;
    return candidate as ParticipationPayload;
  } catch {
    return null;
  }
}

function isParticipationKind(value: unknown): value is PublicParticipation["kind"] {
  return value === "event" || value === "site" || value === "record";
}

export function createD1PublicParticipationSource(db: GenrePortalDatabase): PublicParticipationSource {
  return { async listPublic(filter) {
    let results: Row[];
    try {
      ({ results } = await db.prepare(
        "SELECT participation_kind, participation_id, payload_json FROM zukan_public_participations WHERE withdrawn_at IS NULL ORDER BY published_at DESC",
      ).bind().all<Row>());
    } catch (error) {
      if (/no such table:\s*[`"']?zukan_public_participations\b/i.test(String(error))) return [];
      throw error;
    }

    const items: PublicParticipation[] = [];
    for (const row of results) {
      const payload = parsePayload(row.payload_json);
      if (!payload || typeof row.participation_id !== "string" || !isParticipationKind(row.participation_kind)) continue;
      if (filter.genre && payload.genre !== filter.genre) continue;
      if (filter.region && payload.region !== filter.region) continue;
      items.push({
        id: row.participation_id,
        kind: row.participation_kind,
        genre: payload.genre,
        region: payload.region,
        name: payload.title,
        description: payload.description,
        url: payload.url,
        startDate: payload.startsAt,
        location: payload.locationName,
        publisher: payload.publisherName,
      });
    }
    return items;
  } };
}
