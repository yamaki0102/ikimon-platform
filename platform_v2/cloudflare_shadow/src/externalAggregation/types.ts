export interface ExtractedFact {
  kind: "event" | "job";
  source_id: string;
  external_ref: string;
  url: string;
  title: string;
  starts_at: string;
  ends_at: string | null;
  all_day: boolean;
  venue_name: string | null;
  venue_address: string | null;
  lat: number | null;
  lng: number | null;
  organizer_name: string | null;
  fetched_at: string;
}

export interface ExtStatement {
  bind(...values: unknown[]): ExtStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta?: { changes?: number } }>;
}
export interface ExtDb {
  prepare(query: string): ExtStatement;
  batch?(statements: ExtStatement[]): Promise<unknown>;
}
export interface ExternalAggregationEnv {
  EXTERNAL_FETCH_ENABLED?: string;
  OBS_DB: ExtDb;
}
export interface ExtSourceRow {
  source_id: string;
  listing_url: string;
  method: string;
  etag: string | null;
  last_modified: string | null;
}
