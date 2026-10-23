# Z5-Sol 品質ゲート・リスク検証結果

対象: `platform_v2/src`。基点: `main` / `87b1d7562`。作業ブランチ: `cloud/out-z5-sol`。
2026-10-23 JST。主モデルが優先順位・統合レビューを担当し、GPT-6 Luna（reasoning low）の5レーンで認証、観察保存、メディア、権限、マイグレーションを並行調査した。

## 優先リスク10件

既存のルート・サービスと対応テストを読み、アカウント境界、記録の所有権、非公開メディア、DB整合性への影響を優先した。順位は今回の対象範囲内での判断であり、網羅的監査の結果ではない。

| # | リスク / 既存テストの穴 | 追加した確認と結果 |
|---|---|---|
| 1 | 不正なpercent encodingのCookieで認証処理が例外終了 | 無関係CookieとセッションCookieの双方を試験。修正前にURIErrorを再現し、不正な項目だけ無視する修正後に成功。 |
| 2 | 開発用ダミー管理者が本番で利用される | 開発環境で有効、本番では通常DB経路に進むことを確認。既存実装を維持。 |
| 3 | 期限切れ・失効済みセッションの誤受理 | DB結果0件でnull、期限条件`expires_at > now()`を問い合わせに含むことを確認。既存実装を維持。実DBの時刻判定自体は未実行。 |
| 4 | 他者の観察IDで既存記録を上書き・所有者変更 | 実サービスをDBモックで呼び、修正前に訪問INSERTへ到達する失敗を再現。修正後は書き込み前に拒否、rollback、client解放。 |
| 5 | 未作成の同じ観察IDへ別所有者が同時保存 | 行がない場合も訪問ID単位のtransaction advisory lockで直列化。2つの疑似セッションで待機と後発所有者の拒否を確認。 |
| 6 | 既存symlink経由でpublic/private保存ルート外を読み書き | 実際の一時ファイル・symlinkによる再現テストを追加。canonical path検査後に拒否。 |
| 7 | dangling symlinkや欠落した親階層を使ったルート外書き込み | ファイル書き込み前、親作成前に拒否し、外側にディレクトリを作らないことを確認。 |
| 8 | 重複したAPIキー/Bearerヘッダーの先頭値を採用 | 配列の重複値で修正前の受理を再現。修正後は拒否。結合値と曖昧な優先ヘッダーからのfallback拒否も確認。 |
| 9 | 未認証・停止済みアカウント・別actorによる更新 | `assertSessionUser`の3拒否条件と正当な所有者の許可を実行。既存実装を維持。 |
| 10 | 同時migration runnerが未適用状態を両方読み取る | metadata読み取り前から処理全体を単一session lockで保護。同一clientで実行し、別セッション待機、処理失敗時のunlock、取得失敗、unlock失敗時の接続破棄を試験。 |

## 実装とテストファイル

- 認証: `src/services/authSession.ts`, `authSession.risks.test.ts`
- 観察保存: `src/services/observationWrite.ts`, `writeGuardsPg.ts`, `observationWriteOwnership.test.ts`
- メディア: `src/services/mediaObjectStore.ts`, `mediaObjectStore.test.ts`
- 権限: `src/services/writeGuards.ts`, `writeGuards.test.ts`
- migration: `src/scripts/applyMigrations.ts`, `applyMigrations.source.test.ts`, `migrationLock.ts`, `migrationLock.test.ts`

## 検証結果と測定値

- 10リスク、5つの既存不具合分類を修正（Cookie解析、観察所有権、保存先逸脱、認証ヘッダー曖昧性、migration並行実行）。
- 追加テスト23件。影響範囲16テストファイル、計74件成功、失敗0、skip 0。
- 内訳: 認証6ファイル22件、メディア2ファイル15件、migration/権限3ファイル14件、既存観察関連4ファイル18件、新規観察所有権1ファイル5件。
- `npm run typecheck` 成功。`git diff --check` 成功。
- メディア統合時に導入しかけたmkdir競合も、32並列アップロードの失敗を先に再現してから修正。32/32保存成功。欠落ルートのexists/delete互換性も確認。
- 不具合修正は失敗テストを確認してから適用。観察レーンの初回コマンドがIPC制限で失敗したため、統合時に元実装へ戻してサービスの期待値違反を確認し、修正を再適用した。ツール起動失敗を不具合再現とは数えていない。
- 実行環境では`tsx --test`のIPCソケットがEPERMとなったため、各ファイルを`node --import tsx <test-file>`で実行し、各ファイル内の実テスト数を集計した。

再実行（`platform_v2/`から）:

```bash
for test_file in \
  src/services/authSession.risks.test.ts src/services/authUsers.test.ts \
  src/services/authSecurity.test.ts src/services/oauthFlow.test.ts \
  src/routes/authSession.routes.test.ts src/routes/auth.routes.test.ts \
  src/services/mediaObjectStore.test.ts src/services/observationPhotoUpload.test.ts \
  src/scripts/migrationLock.test.ts src/scripts/applyMigrations.source.test.ts \
  src/services/writeGuards.test.ts src/services/observationWrite.idempotency.test.ts \
  src/services/observationWrite.photoRetention.test.ts src/routes/write.routes.test.ts \
  src/routes/identification.write.routes.test.ts src/services/observationWriteOwnership.test.ts
do
  node --import tsx "$test_file" || exit 1
done
npm run typecheck
```

## 検証の限界

PostgreSQLのロック・expiry判定はモックとSQL契約の検証であり、実DBの並行実行試験ではない。メディアは実ファイル試験だが、パス検査とファイル操作の間のTOCTOU競合は残る。コードカバレッジ率、実環境性能、モデル間の品質・速度比較は未測定。既存テストを弱める変更、migration SQL変更・DB適用、デプロイは行っていない。

## 効率化提案

1. 所有権・セッション・メディア・migrationの今回の小さな試験集合をCIの必須ゲートにする。
2. PostgreSQL一時DBで、同一観察IDと同時migrationの実ロック試験を追加する。
3. モデル比較は同じ基点・課題・検証コマンドに固定し、所要時間、成功テスト数、統合時の修正量を記録する。
