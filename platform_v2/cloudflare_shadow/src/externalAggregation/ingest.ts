import type { ExtDb, ExtractedFact } from "./types";
import { sha256Hex } from "./util";

export interface IngestResult {
  upserted: number;
  gone: number;
}

export async function ingestFacts(db: ExtDb, sourceId: string, facts: ExtractedFact[], nowIso: string): Promise<IngestResult> {
  const upsert = `INSERT INTO ext_source_records (record_id,source_id,external_ref,url,kind,raw_json,content_hash,first_seen_at,last_seen_at,gone_at)
    VALUES (?,?,?,?,?,?,?,?,?,NULL)
    ON CONFLICT(source_id,external_ref) DO UPDATE SET url=excluded.url,kind=excluded.kind,raw_json=excluded.raw_json,
      content_hash=excluded.content_hash,last_seen_at=excluded.last_seen_at,gone_at=NULL`;
  for (const fact of facts) {
    const { fetched_at: _omit, ...stable } = fact;
    const raw = JSON.stringify(stable);
    const recordId = `xr_${(await sha256Hex(`${sourceId}\n${fact.external_ref}`)).slice(0, 32)}`;
    await db.prepare(upsert).bind(recordId, sourceId, fact.external_ref, fact.url, fact.kind, raw, await sha256Hex(raw), nowIso, nowIso).run();
  }
  let gone = 0;
  if (facts.length > 0) {
    const res = await db.prepare("UPDATE ext_source_records SET gone_at=? WHERE source_id=? AND gone_at IS NULL AND last_seen_at<?")
      .bind(nowIso, sourceId, nowIso).run();
    gone = Number(res.meta?.changes ?? 0);
  }
  return { upserted: facts.length, gone };
}

export async function touchSourceRecords(db: ExtDb, sourceId: string, nowIso: string): Promise<void> {
  await db.prepare("UPDATE ext_source_records SET last_seen_at=? WHERE source_id=? AND gone_at IS NULL").bind(nowIso, sourceId).run();
}
