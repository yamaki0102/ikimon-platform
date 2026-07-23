# ikimon.life Home／「自分」実装 Wレビュー採用ログ

- 日付: 2026-07-24
- 対象: `operations/ai_os/ikimon_home_self_redesign_implementation_2026-07-24.md`
- 結果: `complete`
- Claude: `claude-opus-4-8`
- Gemini: `gemini-3-flash-preview`
- Gemini失敗候補: `gemini-3.5-flash`（180秒timeout）
- model docs確認: 不要
- raw evidence: `operations/ai_os/external_review_evidence/2026-07/ikimon-home-self-implementation-20260724/20260724-061014/`

## 採用

- guest下書きtokenを `crypto.randomUUID()` または `crypto.getRandomValues()` のCSPRNGだけで生成し、`Math.random()` fallbackを廃止。
- guest下書きから認証ユーザーへのrekeyを、実ブラウザ・実IndexedDBで検証するblocking testを追加。
  - tokenと`ownerKey`が一致したguest keyだけを読む。
  - 同一readwrite transactionでuser keyへコピーしてguest keyを削除する。
  - user側の`ownerKey`が認証userIdへ変わる。
  - URLとsessionStorageから継続tokenを消す。
  - 所有者不明の旧共通キー`latest`はclaimしない。
- 既存の所有者不一致E2E、partition source test、端末画像選択契約、カメラ拒否／非対応／track停止testを、実装記録へ具体的な証拠として追記。
- `publicFeedEligible=false`だけで本人写真を消さない。非公開・審査前の本人写真は場所名なし、位置保護または`blocked_public`は写真・タイトル・場所を自動表示しない境界testを追加。

## 不採用

- `pending_review` の本人写真を一律default-denyで非表示にする。
  - `pending_review` は非公開または公開審査前を含み、センシティブ判定そのものではない。本人専用Homeから全私的写真を消すと再設計目的を壊す。
  - 代わりに場所ラベルを非表示にし、既存の位置保護で`blurred`になった記録と`blocked_public`を自動面から除外する。
- 旧共通キー`latest`を無条件で自動削除する。
  - 所有者不明データの自動claimはしないが、同意なし削除は過去の未保存撮影を失わせる。P0では読まない・表示しない・移譲しないをblocking testで固定する。
- 「機能テストが存在しない」という指摘。
  - レビュー対象文書の記載不足であり、実装には所有者不一致の実ブラウザE2Eとsource contractがあった。rekeyの実ブラウザtestを追加し、証拠名を正本へ追記する。

## 保留

- 旧`latest`をユーザー確認付きで削除するcleanup UI。
- session終了後に孤立したguest draftを、本人の明示同意を保ちながら整理する保持期間設計。
- IndexedDB at-rest暗号化。
- 自宅・学校・私有地・希少種を統一判定する専用Home read model。P0は既存の`publicLocation.scope=blurred`と公開gateをfail-closed境界として再利用する。
- 多言語コピーのネイティブレビュー。

## 最終判断

追加blocking testとCSPRNG化を反映後、stagingへ進める。DB migrationは不要。stagingではauthenticated Home、本人用「自分」、guest→login→下書き復帰、端末画像選択、カメラ拒否を確認し、green後に同一immutable SHAをproductionへ昇格する。
