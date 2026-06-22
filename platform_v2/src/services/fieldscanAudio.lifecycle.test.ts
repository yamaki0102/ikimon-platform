import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

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
