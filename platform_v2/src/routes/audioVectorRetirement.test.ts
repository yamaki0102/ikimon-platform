import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const root = process.cwd();

function source(path: string): string {
  return readFileSync(join(root, path), "utf8");
}

test("audio vector clustering and similarity routes stay retired without PostgreSQL vector imports", () => {
  const adminAudioApi = source("src/routes/adminAudioApi.ts");
  const fieldscanApi = source("src/routes/fieldscanApi.ts");
  const fieldscanAudio = source("src/services/fieldscanAudio.ts");
  const dispositions = source("cloudflare_shadow/config/vps-stop-p0-dispositions.json");

  assert.equal(existsSync(join(root, "src/services/audioCluster.ts")), false);
  assert.equal(existsSync(join(root, "src/services/audioEmbedding.ts")), false);

  assert.doesNotMatch(adminAudioApi, /audioCluster|runClusterBatch/);
  assert.match(adminAudioApi, /audio_vector_clustering_retired/);
  assert.match(adminAudioApi, /reply\.code\(410\)/);

  assert.doesNotMatch(fieldscanApi, /audioEmbedding|findSimilarSegments/);
  assert.match(fieldscanApi, /audio_vector_similarity_retired/);
  assert.match(fieldscanApi, /reply\.code\(410\)/);

  assert.doesNotMatch(fieldscanAudio, /recordSegmentEmbedding|audioEmbedding/);
  assert.match(fieldscanAudio, /const embeddingsInserted = 0/);
  assert.match(fieldscanAudio, /const embeddingsSkipped = embeddings\.length/);

  assert.match(dispositions, /"key": "audio_cluster_vector_search"[\s\S]*"status": "product-accepted-drop"/);
  assert.match(dispositions, /"key": "audio_embedding_vector_search"[\s\S]*"status": "product-accepted-drop"/);
});
