# 2026-04-14 v2 legacy parity hotfix (staging)

目的:
- staging の /v2 デザインを、staging ルート(legacy)に極力一致させる。

実施内容:
- `platform_v2/src/legacyMirror.ts` を新規追加。
  - `http://127.0.0.1:8081` の legacy HTML を取得。
  - `/v2` 配下にマウントされるよう、`href` / `action` の内部リンクを再書き換え。
- `/v2` 公開導線の主要ページを legacy ミラーへ切替:
  - `/` -> `/?lang=...` (legacy)
  - `/about` -> `/about.php?lang=...`
  - `/learn` -> `/guides.php?lang=...`
  - `/faq` -> `/faq.php?lang=...`
  - `/for-business` -> `/for-business.php?lang=...`

変更ファイル:
- `platform_v2/src/legacyMirror.ts` (new)
- `platform_v2/src/app.ts`
- `platform_v2/src/routes/marketing.ts`

検証結果 (staging root vs /v2):
- top: text similarity 1.0000 / html similarity 0.9966
- about: text similarity 1.0000 / html similarity 0.9922
- learn(guides): text similarity 1.0000 / html similarity 0.9913
- faq: text similarity 1.0000 / html similarity 0.9974
- for-business: text similarity 1.0000 / html similarity 0.9932

HTTP確認:
- `/v2/?lang=ja` 200
- `/v2/about?lang=ja` 200
- `/v2/learn?lang=ja` 200
- `/v2/faq?lang=ja` 200
- `/v2/for-business?lang=ja` 200

補足:
- 内部リンクの /v2 化は有効。
- 例外として `/manifest.php` は root リンクのまま (現状は実害なし)。

結論:
- 指摘の「元ページと全然違う」問題は、主要 public 導線で解消。
- /v2 は staging legacy デザインとほぼ同一表示に復帰。