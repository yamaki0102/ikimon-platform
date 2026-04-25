# Canonical Rollback Runbook

更新日: 2026-04-11

## 目的

canonical write / read pilot を止めても、既存 JSON 運用を継続できる状態を保つ。

## 即時停止スイッチ

`upload_package/config/secret.php` で以下を設定する。

```php
<?php
define('CANONICAL_DUAL_WRITE_ENABLED_OVERRIDE', false);
define('CANONICAL_READ_PILOT_ENABLED_OVERRIDE', false);
```

## 影響

- `CANONICAL_DUAL_WRITE_ENABLED_OVERRIDE=false`
  新規投稿は JSON のみ保存する
- `CANONICAL_READ_PILOT_ENABLED_OVERRIDE=false`
  観察詳細と一覧 API は JSON 読みへ戻る

既存の `ikimon.db` は削除しない。停止中も監査用に保持する。

## 再開手順

1. override を外す
2. `php upload_package/tools/check_canonical_divergence.php`
3. 必要なら `php upload_package/scripts/migration/002_sync_existing_data.php`
4. `php tools/lint.php`
5. `php vendor/bin/phpunit --testsuite Feature`

## 障害時の切り分け順

1. dual-write だけ止める
2. read pilot も止める
3. divergence を確認する
4. canonical sync を再実行する
