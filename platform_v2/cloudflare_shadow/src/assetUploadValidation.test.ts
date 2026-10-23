import assert from "node:assert/strict";
import test from "node:test";
import { MAX_ASSET_UPLOAD_BYTES, readAndValidateAssetUploadBody } from "./assetUploadValidation";

test("v0 asset uploads enforce exact declared length and sniff common media containers", async () => {
  await assert.rejects(
    readAndValidateAssetUploadBody(new Blob(["longer than declared"]).stream(), "text/plain", 1),
    /uploaded_media_too_large/,
  );
  await assert.rejects(
    readAndValidateAssetUploadBody(new Blob(["short"]).stream(), "text/plain", 6),
    /uploaded_media_size_mismatch/,
  );
  await assert.rejects(
    readAndValidateAssetUploadBody(new Blob(["not jpeg"]).stream(), "image/jpeg", 8),
    /uploaded_media_type_mismatch/,
  );
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0x00]);
  assert.deepEqual(await readAndValidateAssetUploadBody(new Blob([jpeg]).stream(), "image/jpeg", jpeg.length), jpeg);
});

test("v0 asset uploads stop reading as soon as the configured cap is crossed", async () => {
  let canceled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new Uint8Array(MAX_ASSET_UPLOAD_BYTES + 1)); },
    cancel() { canceled = true; },
  });
  await assert.rejects(readAndValidateAssetUploadBody(body, "text/plain", MAX_ASSET_UPLOAD_BYTES), /uploaded_media_too_large/);
  assert.equal(canceled, true);
});
