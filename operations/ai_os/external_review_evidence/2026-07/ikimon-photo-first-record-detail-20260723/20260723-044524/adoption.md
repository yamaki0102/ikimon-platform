# Photo-first record detail review adoption

- task: `ikimon-photo-first-record-detail-20260723`
- Claude model: `claude-opus-4-8`（初回rawは実装読取の宣言で途切れたため、packet-only制約で再実行）
- Gemini model: `gemini-3-flash-preview`（`gemini-3.5-flash`はtimeout）
- review scope: defensive UX / privacy review。最終判断はlocal source、tests、rendered browser QAで照合した

## Adopted and verified

- media dedup keyをURLではなく`mediaId`へ固定していることを正本へ明記した。
- public photoがverified public derivative、EXIF scrubbed、public readyの全条件を満たすqueryだけから来る契約testを追加した。
- media URLに座標、cell、mesh、geohash等が含まれる場合はrender前に除外する既存防御とrendered-output scanを維持した。
- accepted human identificationを優先し、AIだけの場合は4言語のAI見出しと「かもしれない」表現を使い、community proposalをaccepted名に使わないsource規律を正本へ明記した。
- N observationsは最大3件のsummaryと、全active observationへ到達する「すべて見る」を持つことを正本へ明記した。

## Rejected or refined

- AI候補へ大きな管理badgeを追加する案は採用しない。既に「AIが見つけたもの」＋「かもしれません」＋`data-ai-candidate`で視覚・文言・DOMを分離し、管理状態を主役にしない製品要件を優先する。
- N件数を強調する案は採用しない。最大3件を直接列挙し、全件へ進めるという確定要件を優先する。
- renderer内でCloudflare image変換URLを組み立てる案は採用しない。EXIF防御はverified public derivative projectionの責務であり、rendererは安全なprojectionとlocator拒否を二重確認する。
- 0件で「特定中」等のplaceholderを出す案は採用しない。0件はobservation sectionを非表示にする確定要件に反する。

## Deferred outside this UI-only PR

- seasonality、ecology、similar-species、regional learningの保存/read-model拡張。
- rare/sensitive speciesに応じた時刻粒度の追加policyとenvironment microhabitat scrub強化。現行の共通public projectionを変更する場合は別privacy contractとして扱う。
- `place_environment_snapshots`のprivacy-safe record link contract。

## Verification after reconciliation

- HTML contract: 0 / 1 / N、owner / guest、public/private、AI / accepted / community、pet/group、photo/video/audio、4言語。
- browser QA: 320 / 375 / 390 / 768 / 1280、overflow 0、44px未満0、visible focus、collapsed no-JS disclosures、exact-location finding 0。
- full test and deploy evidence are recorded in the PR and central release command.
