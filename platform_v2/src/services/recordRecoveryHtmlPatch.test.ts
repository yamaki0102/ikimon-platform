import assert from "node:assert/strict";
import test from "node:test";
import { patchRecordRecoveryHtml } from "./recordRecoveryHtmlPatch.js";

test("record recovery HTML patch opens the internal media input directly", () => {
  const html = `<script>
        const chooseRecordRecoveryMedia = () => {
          const preferred = captureButtons.find((button) => button.getAttribute('data-capture-action') === recordRecoveryStart)
            || captureButtons.find((button) => button.getAttribute('data-capture-action') === 'gallery')
            || captureButtons[0];
          if (preferred && typeof preferred.click === 'function') preferred.click();
        };
  </script>`;
  const patched = patchRecordRecoveryHtml(html);
  assert.match(patched, /data-record-media-input/);
  assert.match(patched, /target\.click\(\)/);
  assert.doesNotMatch(patched, /preferred\.click\(\)/);
  assert.doesNotMatch(patched, /captureButtons\.find/);
});

test("record recovery HTML patch preserves photos when location is missing", () => {
  const html = `<script>
        } else if (message === 'location_required') setStatus('直接記録には地点が必要です。位置情報を許可してからもう一度試してください。');
  </script>`;
  const patched = patchRecordRecoveryHtml(html);
  assert.match(patched, /navigateWithDraft\(selectedPhotoDraftFiles\(\), 'photo', capturedReviewMeta \|\| \{\}, 'location_denied'\)/);
  assert.match(patched, /写真を残したまま場所を選べる画面へ移動します/);
});

test("record recovery HTML patch is idempotent", () => {
  const alreadyPatched = `<script>const target = document.querySelector('[data-record-media-input]');</script>`;
  assert.equal(patchRecordRecoveryHtml(alreadyPatched), alreadyPatched);
});
