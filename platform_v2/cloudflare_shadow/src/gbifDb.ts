export type GbifRow = Record<string, unknown>;
export type GbifStatement = { sql: string; values: unknown[] };
export type GbifDb = {
  query: (sql: string, values: unknown[]) => Promise<GbifRow[]>;
  run: (sql: string, values: unknown[]) => Promise<{ changes: number }>;
  batch: (statements: GbifStatement[]) => Promise<void>;
};

export type GbifD1Like = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all<T = GbifRow>(): Promise<{ results: T[] }>;
      run(): Promise<unknown>;
    };
  };
  batch(statements: unknown[]): Promise<unknown[]>;
};

export function gbifDbFromD1(d1: GbifD1Like): GbifDb {
  const bound = (sql: string, values: unknown[]) => d1.prepare(sql).bind(...values);
  return {
    query: async (sql, values) => (await bound(sql, values).all()).results,
    run: async (sql, values) => ({ changes: Number(((await bound(sql, values).run()) as { meta?: { changes?: number } }).meta?.changes ?? 0) }),
    batch: async (statements) => {
      await d1.batch(statements.map((statement) => bound(statement.sql, statement.values)));
    },
  };
}

export const chunkOf = <T>(items: readonly T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
};

export const marks = (count: number) => Array.from({ length: count }, () => "?").join(",");
export const isMissingSchema = (error: unknown) => error instanceof Error && /no such table|no such column/i.test(error.message);

export async function sha256Text(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomUuid(): string {
  return crypto.randomUUID();
}
