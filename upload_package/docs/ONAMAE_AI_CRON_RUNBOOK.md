# Onamae AI Cron Runbook

ikimon.life の AI考察 queue を、今のお名前.com 共有サーバーで無理なく回すための運用手順。

## 前提

- サーバー: `production`
- PHP CLI: `/usr/bin/php`
- サイトルート: `~/public_html/ikimon.life/`
- AI queue スクリプト:
  - `scripts/process_ai_fast_queue.php`
  - `scripts/process_ai_batch_queue.php`
  - `scripts/process_ai_deep_queue.php`
  - `scripts/check_ai_assessment_queue.php`

## 目的

- 投稿直後の体感は保つ
- shared hosting でタイムアウトしない
- API 予算を日次で固定する
- queue 詰まりを cron だけで運用できるようにする

## 現在の基本方針

- `fast`
  - 新規の未同定投稿だけ
  - 軽いモデル、1枚、短い出力
- `batch`
  - 写真追加、同定更新、AI複数候補など
  - 夜間に整理
- `deep`
  - 手動レビューや難問だけ

## 推奨 cron

### 1. fast

5分おき。まずはこれだけで十分。

```cron
*/5 * * * * /usr/bin/php /home/r1522484/public_html/ikimon.life/scripts/process_ai_fast_queue.php 3 >> /home/r1522484/public_html/ikimon.life/data/logs/ai_fast.log 2>&1
```

### 2. batch

夜間に2回。投稿数が少ないうちは1回でもよい。

```cron
20 2 * * * /usr/bin/php /home/r1522484/public_html/ikimon.life/scripts/process_ai_batch_queue.php 8 >> /home/r1522484/public_html/ikimon.life/data/logs/ai_batch.log 2>&1
50 4 * * * /usr/bin/php /home/r1522484/public_html/ikimon.life/scripts/process_ai_batch_queue.php 8 >> /home/r1522484/public_html/ikimon.life/data/logs/ai_batch.log 2>&1
```

### 3. deep

毎日回す必要はない。手動 deep review を使うようになってからでよい。

```cron
35 5 * * * /usr/bin/php /home/r1522484/public_html/ikimon.life/scripts/process_ai_deep_queue.php 2 >> /home/r1522484/public_html/ikimon.life/data/logs/ai_deep.log 2>&1
```

## 最初の導入順

1. `fast` だけ登録
2. 2〜3日様子を見る
3. queue が夜まで残るなら `batch` を追加
4. `deep` は最後

## 運用確認コマンド

### queue 全体

```bash
/usr/bin/php /home/r1522484/public_html/ikimon.life/scripts/check_ai_assessment_queue.php
```

見るポイント:

- `status.pending`
- `lane.fast`
- `lane_status.batch:pending`
- `oldest_pending`
- `budget.spent`

### fast を手動で1回流す

```bash
/usr/bin/php /home/r1522484/public_html/ikimon.life/scripts/process_ai_fast_queue.php 3
```

### batch を手動で1回流す

```bash
/usr/bin/php /home/r1522484/public_html/ikimon.life/scripts/process_ai_batch_queue.php 8
```

## ログの見方

- `data/logs/ai_fast.log`
- `data/logs/ai_batch.log`
- `data/logs/ai_deep.log`

`budget_deferred` が出るのは異常ではない。  
日次予算に達したので翌日に回しただけ。

## 異常時の判断

### pending が増え続ける

- `fast` limit を `3 -> 5`
- それでも残るなら `batch` を追加

### failed が増える

- APIキー切れ
- レート制限
- 一時的な Gemini 側エラー

まず `ai_fast.log` を確認。

### 月額をもっと下げたい

- `IKIMON_AI_FAST_DAILY_BUDGET_USD`
- `IKIMON_AI_BATCH_DAILY_BUDGET_USD`
- `IKIMON_AI_DEEP_DAILY_BUDGET_USD`

をサーバー側で下げる。

## いまの推奨予算

- fast: `$0.06/day`
- batch: `$0.09/day`
- deep: `$0.03/day`

合計: `$0.18/day`  
30日で約 `$5.4/month`

## いまはやらないこと

- true Batch API への全面移行
- deep の常用
- 投稿中の同期AI処理
- 全件再生成の定期実行

今の規模では、複雑化のほうがコストより高い。

## 見直し条件

次のどれかが起きたら、Batch API への本格移行を検討する。

- 1日投稿数が大きく増える
- `batch:pending` が毎朝残る
- 月額をさらに半分近く落としたい
- AI考察の再整理対象が増える
