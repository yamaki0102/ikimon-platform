# Issue #1247 写真投稿整合性・モバイル記録カード実装計画

**目標**: Cloudflare Worker/D1/R2 の写真投稿を失敗で成功表示しない整合性契約へ直し、所有者のマイページで安全に写真を表示し、モバイル記録カードと固定ランチャーの重なりを解消する。

**調査結果（2026-07-10、読み取りのみ）**:

- `POST /api/v1/observations/:id/photos/upload` は R2 `put` 後に D1 `batch()` を実行する。D1失敗時のR2削除補償が現mainにない。
- 所有者マイページは `asset_ledger.public_derivative_key` と公開用検証済み条件だけを採用するため、本人だけが見られるべき写真の表示可否を公開derivative処理に依存している。
- 対象日の集計では、7月7日2観察・3 asset、7月10日1観察・1 assetのD1 metadataがあり、対応するoriginal/derivative R2 object全8件も存在した。個人識別子・object keyは記録しない。
- よって既存対象はR2消失ではなく表示・紐付け診断対象である。実体のないassetは復元済みと扱わない。

**アーキテクチャ**:

1. 写真assetをD1上で明示的なupload lifecycle（予約、R2保存、metadata確定、failed/compensated）として扱い、成功レスポンスはR2・D1確定後だけ返す。R2成功/D1失敗はR2削除、D1確定後にR2不在が検出された場合はassetを失敗状態へ遷移させる。
2. 所有者のカードは、同一owner・同一visit・有効な画像assetだけを対象に、認可済みのowner media URLで表示する。公開URLへのprivate media流出、別visit・他owner・非公開assetの混入を禁止する。occurrence直結assetがない場合だけ、同一visitの有効assetをowner表示に限ってfallbackする。
3. dry-run既定の診断/修復CLIは対象userId/visitIdを必須絞り込み可能にし、R2存在を確認した既存assetだけを再紐付けする。変更時はD1監査ログを残し、削除は行わない。

**影響範囲（調査後に最小化）**:

- `platform_v2/cloudflare_shadow/src/index.ts`
- `platform_v2/cloudflare_shadow/src/index.test.ts`
- `platform_v2/cloudflare_shadow/migrations/observations/0065_*`（必要なaudit/lifecycle列またはtableのみ）
- `platform_v2/cloudflare_shadow/scripts/reconcile-owner-photo-assets.mjs`（新規）
- `platform_v2/cloudflare_shadow/scripts/*.test.*` または既存Worker test
- `platform_v2/e2e/*`（mobile profile/record regression）

## 検証基準（Verification Criteria）

- [ ] `npm --prefix platform_v2/cloudflare_shadow run check` → TypeScript error 0件。
- [ ] `npm --prefix platform_v2/cloudflare_shadow run test:quick` → Worker契約テストが全件PASS。
- [ ] 対象テスト: 観察成功＋写真成功、観察成功＋写真API失敗、R2成功＋D1失敗、R2失敗＋D1予約/確定補償、同一visit複数subject、他owner/非公開asset拒否 → 全件PASS。
- [ ] `npm --prefix platform_v2 run typecheck` と該当unit/integration tests → PASS。
- [ ] `npm --prefix platform_v2/cloudflare_shadow run deploy:staging:dry-run` → guard PASS。
- [ ] Playwrightで360/393/412px: 写真あり、写真なし、画像404、最終カード、横スクロールなし、launcher非重複 → PASS。
- [ ] staging実投稿→写真表示→テストデータcleanup → 証跡でcleanup zero。
- [ ] production smokeはread/write最小scopeで写真投稿→マイページ確認し、テスト投稿のみcleanup成功。

## タスク

1. 現mainのupload、media worker、owner card、D1 schemaとPR #1240の補償差分を比較し、asset lifecycleの最小schemaを確定する。
2. R2/D1失敗を注入する失敗テストを追加し、現mainで失敗することを確認する。
3. upload lifecycleとR2/D1補償を実装し、成功条件と再試行用エラーpayloadを固定する。
4. owner限定media解決・同一visitfallback・認可境界の失敗テストを追加して実装する。
5. dry-run診断・限定repair・audit logを実装し、実体なしをskipするテストを追加する。
6. mobile cardを横長化し、画像なし/404を控えめにし、launcher + safe-areaぶんの下余白を付与する。PC CSSは変更しない。
7. Worker/unit/integration/typecheck/Playwrightを実行する。
8. staging deploy・実投稿・cleanup、PR、required checks、admin merge、GitHub Actions deploy、production smokeを順に実行する。

## リスク一覧

| リスク | 影響 | 対策 | Rollback |
|---|---|---|---|
| private photoを公開URLで返す | 高 | owner/session/visitを毎回照合する専用media route、拒否テスト | Worker version rollback。データ削除なし |
| 補償失敗でR2 orphanが残る | 中 | auditを`compensation_pending`として記録し、診断で検出 | retry可能なrepairのみ。R2自動削除はしない |
| repairが別visit/他ownerに接続する | 高 | userId/visitId限定、owner一致、R2 head、dry-run既定 | repair前後auditから対象assetのみ戻す。データ削除なし |
| fixed launcherが小画面で遮蔽 | 中 | 360/393/412pxのPlaywright viewport、safe-area padding | CSS差分をrevertしPCは未変更 |

## Rollback Plan

- **トリガー**: production smokeで認可漏れ、投稿不能、または表示回帰を検出した場合。
- **手順**: GitHub Actionsで直前Worker versionへrollbackし、診断CLIをdry-runで対象upload lifecycleを確認する。D1/R2の削除・一括更新はしない。
- **データ影響**: rollback自体はデータを削除しない。失敗uploadはauditに残り、後続の限定repair対象になる。
