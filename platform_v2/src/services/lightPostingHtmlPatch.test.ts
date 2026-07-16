import assert from "node:assert/strict";
import test from "node:test";
import { patchLightPostingHtml } from "./lightPostingHtmlPatch.js";

test("light posting patch allows a signed-in photo post without coordinates", () => {
  const html = `<script>
    if (!photoDraftRetryDetailId && !photoDraftRetryVisitId && !(metadata.location && Number.isFinite(Number(metadata.location.latitude)) && Number.isFinite(Number(metadata.location.longitude)))) {
      setStatus('位置情報を取得できなかったため、写真を保持して記録画面へ移動します。');
      await navigateWithDraft(files, 'photo', metadata, 'location_denied');
      return;
    }
        const location = metadata.location || null;
        if (!location || !Number.isFinite(Number(location.latitude)) || !Number.isFinite(Number(location.longitude))) {
          throw new Error('location_required');
        }
        const submissionSeed = [
          userId,
          observedAt,
          Number(location.latitude).toFixed(6),
          Number(location.longitude).toFixed(6),
          uploadHashes.join(','),
        ].join('|');
          body: JSON.stringify({
            latitude: Number(location.latitude),
            longitude: Number(location.longitude),
          });
  </script>`;

  const patched = patchLightPostingHtml(html);

  assert.match(patched, /metadata\.location = null/);
  assert.match(patched, /場所なしで投稿します/);
  assert.match(patched, /location \? Number\(location\.latitude\) : null/);
  assert.match(patched, /location \? Number\(location\.longitude\) : null/);
  assert.match(patched, /'unlocated'/);
  assert.doesNotMatch(patched, /navigateWithDraft\(files, 'photo', metadata, 'location_denied'\)/);
  assert.doesNotMatch(patched, /throw new Error\('location_required'\)/);
});

test("light posting patch uses 投稿 as the only post-capture action", () => {
  const html = `<script>
  const photoDraftSubmitLabel = () => {
    const count = selectedPhotoDraftFiles().length;
    return count > 0 ? 'この' + String(count) + '枚を記録' : '写真を撮る';
  };
  setStatus('写真1枚。右で記録、左でもう1枚撮れます。');
  resetPhotoDraftAfterDirectPost('記録を保存しました。AIが写真を見て主役と周囲を整理します。続けて撮れます。');
  </script>`;

  const patched = patchLightPostingHtml(html);

  assert.match(patched, /\? '投稿' : '写真を撮る'/);
  assert.match(patched, /右で投稿、左でもう1枚撮れます/);
  assert.match(patched, /投稿しました。続けて撮れます。/);
  assert.doesNotMatch(patched, /枚を記録/);
  assert.doesNotMatch(patched, /AIが写真を見て主役と周囲を整理/);
});

test("light posting patch removes passive awaiting-ID pressure from normal cards", () => {
  const html = `<article class="obs-card">
    <a class="obs-card-media" href="/observations/1">
      <span class="obs-card-sketch-name">名前待ち</span>
      <div class="obs-card-species is-awaiting"><span class="obs-card-species-label">名前待ち</span></div>
    </a>
    <footer>
      <div class="obs-card-actions">
        <a href="/observations/1#identify">名前を手伝う</a>
      </div>
    </footer>
  </article>`;

  const patched = patchLightPostingHtml(html);

  assert.doesNotMatch(patched, /is-awaiting/);
  assert.doesNotMatch(patched, /名前待ち/);
  assert.doesNotMatch(patched, /名前を手伝う/);
  assert.doesNotMatch(patched, /obs-card-actions/);
  assert.match(patched, /obs-card-media/);
});

test("light posting patch preserves identification cues when the caller keeps the dedicated lane", () => {
  const html = `<article class="obs-card">
    <div class="obs-card-species is-awaiting"><span>名前待ち</span></div>
    <div class="obs-card-actions"><a href="/observations/1#identify">名前を手伝う</a></div>
  </article>`;

  const patched = patchLightPostingHtml(html, { suppressPassiveIdentification: false });

  assert.match(patched, /is-awaiting/);
  assert.match(patched, /名前待ち/);
  assert.match(patched, /名前を手伝う/);
});

test("light posting patch keeps specialist review while removing the passive identify link", () => {
  const html = `<div class="obs-card-actions">
    <a href="/observations/1#identify">Identify</a>
    <a href="/specialist/id-workbench?occurrenceId=1">専門レビュー</a>
  </div>`;

  const patched = patchLightPostingHtml(html);

  assert.doesNotMatch(patched, />Identify<\/a>/);
  assert.match(patched, /専門レビュー/);
  assert.match(patched, /obs-card-actions/);
});

test("light posting patch is idempotent", () => {
  const html = `<script>const photoDraftSubmitLabel = () => selectedPhotoDraftFiles().length > 0 ? '投稿' : '写真を撮る';</script>`;
  assert.equal(patchLightPostingHtml(patchLightPostingHtml(html)), patchLightPostingHtml(html));
});
