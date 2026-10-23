import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { __test__ } from "./fieldscanAudio.js";

test("live guide analysis-only audio deletes raw media after detections", async () => {
  const source = await readFile(path.join(process.cwd(), "src", "services", "fieldscanAudio.ts"), "utf8");

  assert.match(source, /rawAudioPolicy\?: string/);
  assert.match(source, /function isAnalysisOnlyRawAudio/);
  assert.match(source, /analysis_only_delete_after_detection/);
  assert.match(source, /function markAnalysisOnlyRawAudioDeleted/);
  assert.match(source, /function createAudioMediaObjectStore/);
  assert.match(source, /privateStorageBackend: AUDIO_STORAGE_BACKEND/);
  assert.match(source, /mediaObjectStore\.write\(\{/);
  assert.match(source, /mediaObjectStore\.delete\(\{/);
  assert.match(source, /createAudioMediaObjectStore\(\)\.read\(\{/);
  assert.match(source, /delete from asset_blobs where blob_id = \$1/);
  assert.match(source, /storage_provider = 'analysis_deleted'/);
  assert.match(source, /rawAudioStored: false/);
  assert.match(source, /commitDeletions\.push\(\.\.\.await markAnalysisOnlyRawAudioDeleted\(client, segment\)\)/);
});

test("FieldScan recap denies anonymous and foreign sessions before reading aggregates", async () => {
  const calls: Array<{ sql: string; values?: unknown[] }> = [];
  let allowOwner = false;
  const pool = { query: async (sql: string, values?: unknown[]) => {
    calls.push({ sql, values });
    if (sql.includes("select 1 from audio_segments")) {
      return { rows: allowOwner && values?.[1] === "owner" ? [{ "1": 1 }] : [] };
    }
    if (sql.includes("count(*)::text as segment_count")) return { rows: [{ segment_count: "1", clean_segment_count: "1", total_duration_sec: "2", natural_duration_sec: "2", privacy_skipped_count: "0", last_recorded_at: null, min_lat: null, max_lat: null, min_lng: null, max_lng: null }] };
    if (sql.includes("from audio_detections")) return { rows: [] };
    if (sql.includes("from sound_bundles")) return { rows: [] };
    throw new Error("aggregate query should not run for a foreign session");
  } } as never;

  await assert.rejects(__test__.getSessionRecapWithPool(pool, "session", null), /fieldscan_session_not_found/);
  await assert.rejects(__test__.getSessionRecapWithPool(pool, "session", "other"), /fieldscan_session_not_found/);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /user_id = \$2/);
  assert.deepEqual(calls[0]!.values, ["session", "other"]);

  allowOwner = true;
  calls.length = 0;
  const recap = await __test__.getSessionRecapWithPool(pool, "session", "owner");
  assert.equal(recap.segmentCount, 1);
  assert.equal(recap.cleanSegmentCount, 1);
  assert.equal(calls.length, 4);
  for (const call of calls) {
    assert.match(call.sql, /user_id = \$2/);
    assert.deepEqual(call.values, ["session", "owner"]);
  }
});
