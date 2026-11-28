import { readFileSync, readdirSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import type { ExtDb, ExtStatement } from "./types";

export function migratedDb(): { sqlite: DatabaseSync; db: ExtDb } {
  const sqlite = new DatabaseSync(":memory:");
  const dir = new URL("../../migrations/observations/", import.meta.url);
  for (const file of readdirSync(dir).filter(f => f.endsWith(".sql")).sort()) sqlite.exec(readFileSync(new URL(file, dir), "utf8"));
  const stmt = (query: string, values: unknown[] = []): ExtStatement => ({
    bind: (...v) => stmt(query, v),
    first: async <T>() => ((sqlite.prepare(query).get(...(values as SQLInputValue[])) as T | undefined) ?? null),
    all: async <T>() => ({ results: sqlite.prepare(query).all(...(values as SQLInputValue[])) as T[] }),
    run: async () => ({ meta: { changes: Number(sqlite.prepare(query).run(...(values as SQLInputValue[])).changes) } }),
  });
  return { sqlite, db: { prepare: q => stmt(q) } };
}
