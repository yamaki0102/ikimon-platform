# TASK BRIEF: オモイカネ抽出ワーカー監視・回復・完了促進

## 目的
抽出パイプラインの稼働状態を監視し、stuck（停止）した処理を回復させ、完了件数を最大化する。

## 現状（2026-02-26時点）
- literature_ready: ~8,800件（処理待ち）
- completed: ~1,587件
- processing: ~149件（stuck含む可能性あり）
- Ollamaローカル推論（GTX 1660 SUPER）が抽出LLMとして稼働中

## ⚠️ 絶対ルール
- **外部API呼び出し禁止**（Gemini API等）
- ローカルのPHPスクリプト + Ollama + SQLiteのみで作業すること
- コードの変更・パッチは禁止。既存スクリプトをそのまま使うこと

## 実行手順

### Step 1: 作業ディレクトリへ移動
```bash
cd ~/projects/ikimon-platform/upload_package/scripts
```

### Step 2: stuckアイテムをリセット
```bash
php reset_stuck_items.php
```

### Step 3: ワーカーセッション確認
```bash
tmux ls
```
期待: `extractor`, `prefetcher`, `dbwriter` の3セッションが存在すること

### Step 4: 抽出ログ確認
```bash
tail -30 /tmp/extractor.log
```
期待: 種名の処理ログが流れていること。止まっていたらStep 5へ

### Step 5: ワーカーが停止していた場合の再起動
```bash
bash start_omoikane.sh
```

### Step 6: DB Writerのスプール処理確認
```bash
ls -la ../data/spool/
tail -20 /tmp/dbwriter.log
```
スプールにJSONが溜まっていたらDB Writerが処理していることを確認

### Step 7: キュー状態の最終レポート
```bash
cd ~/projects/ikimon-platform/upload_package
php -r 'require_once "config/config.php"; require_once "libs/ExtractionQueue.php"; $eq = ExtractionQueue::getInstance(); $c = $eq->getCounts(); foreach($c as $k=>$v) echo "  $k: $v\n";'
```

### Step 8: 繰り返し（任意）
5分後にStep 2〜7を繰り返し、completedが増加していることを確認する。

## 成功基準
- stuckしたprocessingアイテムが0件になっていること
- extractor/prefetcher/dbwriterが全て稼働中であること
- completed件数が実行前より増加していること
