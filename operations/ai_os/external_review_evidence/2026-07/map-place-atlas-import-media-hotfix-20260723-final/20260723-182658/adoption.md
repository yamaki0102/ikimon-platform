# Wレビュー採用ログ

## 判定

- 最終判定: `green`
- Claude: `claude-opus-4-8` / 条件付き承認
- Gemini: `gemini-3.5-flash` / 承認
- production blocker: なし

Raw review:

- `claude-review.md`
- `gemini-review.md`

## 採用

1. `/derived/import/.../display.webp` だけを直接配信経路へ通し、import配下の原画像や他形式は従来の変換経路へ残した。
2. 早期returnより前に、空文字、protocol-relative URL、制御文字を拒否する順序を維持した。
3. 制御文字を含むURLを拒否し、`original.jpg` が直接配信を迂回できない回帰テストを追加した。
4. public derivativeのプライバシー境界をコードと本番実データで再確認した。

## 条件確認

Claudeの唯一の投入条件だったガード順序は、`atlasSafeImageUrl` で次の順に実装されている。

1. 文字列型の確認
2. `trim`
3. 空文字、`//`、制御文字の拒否
4. `/derived/import/.../display.webp` の直接配信判定

Place Atlasの画像取得は `asset_ledger` 上で次を満たす行だけを対象にする。

- `public_derivative_verified_at IS NOT NULL`
- `public_derivative_metadata_json IS NOT NULL`
- SVGではない
- `exif_scrub_state = 'scrubbed'`
- `public_ready_at IS NOT NULL`
- `mime LIKE 'image/%'`

public derivative生成側はWebPチャンクを検査し、EXIF、XMP、GPS情報を検出した場合は公開準備を失敗扱いにする。

2026-07-23に本番の常磐公園プロフィールが返した代表画像3件を直接取得し、RIFF/WebPチャンクを検査した。

| 結果 | 値 |
|---|---|
| HTTP | 3件すべて200 |
| Content-Type | 3件すべて`image/webp` |
| WebP container | 3件すべてvalid |
| chunk | 3件すべて`VP8 `のみ |
| EXIF/XMP | 3件すべてなし |

## 不採用・保留

- query/hash付き `display.webp` の直接配信対応: 今回は不採用。現行Read ModelはDBの `public_derivative_key` からクエリなし相対パスを生成し、query/hash付きURLはcontract外である。ホットフィックスで許可面を広げない。
- `/derived-transform/` 側のimport資産正式対応: 恒久対応候補として保留。今回の止血範囲を超える。
- 画像失敗時のプレースホルダー/再試行: UX改善として保留。今回の根本原因修正とは別変数。
- responsive imageの再最適化: 既生成 `display.webp` はbounded public derivativeであり、今回の本番表示回復を優先して保留。

## 検証

- Node target test: 8/8
- Node typecheck: green
- Node full suite: 1367/1367
- Worker check: green
- Worker full suite: 391/391
- Node build/copy gate: green
- Wrangler staging dry-run: green
- 本番の直接画像URL: 3/3 HTTP 200

上記を満たすため、exact-SHA gateを前提にstagingからproductionへ進めてよい。
