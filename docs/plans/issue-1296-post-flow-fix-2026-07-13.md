# Issue 1296 投稿後フロー修正記録

## 今回の安全な到達点

Cloudflare nativeの写真保存時に、メディア台帳・outbox・再解析受付を同じD1 batchへ入れる。再解析受付は既存の一意制約 `(observation_id, request_kind, actor_user_id)` で冪等にpendingへ戻す。画面は受付時点を「AI完了」と誤表示せず、「AI確認を受け付けました」と表示する。

新しいmigration、secret、production DB操作、production deployは行わない。

## 根本原因

- Cloudflare Workerの `observation_reassessment_requests` は受付台帳だけで、pendingを処理するconsumerがない。
- stagingのWorker secretは `V2_PRIVILEGED_WRITE_API_KEY` のみで、AI provider用secretやWorkers AI bindingはない。
- Fastifyの既存AI処理はPostgreSQLへ直接書き込む。これをCloudflareから呼び戻すと、VPS停止readinessのruntime PostgreSQL依存を再導入する。
- したがって「既存originへ委譲」は不採用。全回帰のarchitecture gateで検出し、実装から撤回した。

## 今回の変更

1. 写真をR2へ置いた後のD1 batchへ再解析受付UPSERTを追加する。
2. D1 batchが失敗した場合は既存どおりR2 objectを補償削除し、孤立を防ぐ。
3. upload応答へ `reassessment.state=pending` とrequest IDを返す。
4. クライアント側の二重POSTを廃止し、受付と完了を区別する文言へ修正する。
5. upload、D1補償、再解析受付、画面文言の回帰テストを追加する。

## 検証基準

- [ ] `platform_v2` typecheck / node testが成功する。
- [ ] `cloudflare_shadow` typecheck / full testが成功する。
- [ ] VPS stop readinessでruntime PostgreSQL依存が増えない。
- [ ] 同一owner・observationの再受付で重複ledger行を作らない。
- [ ] immutable SHAをpushし、command busのdry_run、staging deploy、verify、visual_qaが順に成功する。

## 承認境界として残る実装

AI解析の完了まで進めるには、Cloudflare native consumer、画像対応AI provider/binding、課金判断、試行回数・最終試行・terminal failure・結果書戻しの正本設計が必要。これはruntime設定・課金・DB設計を含むため、今回の許可範囲では実装・実行しない。Issue #1296はcloseしない。

## Rollback

PRをmergeしない。staging異常時もproductionへ進めず、command busのrollback dry-runで候補だけ確認する。DB migrationがないためschema rollbackは不要。
