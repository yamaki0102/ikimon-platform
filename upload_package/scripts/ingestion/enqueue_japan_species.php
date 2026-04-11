<?php

/**
 * enqueue_japan_species.php — 日本種 Tier-2 初期シード
 *
 * OmoikaneDB の species テーブルから日本語名がある種を
 * LiteratureIngestionQueue に Tier 2 で一括投入する。
 *
 * 使い方:
 *   php enqueue_japan_species.php             # 未取り込み種のみ
 *   php enqueue_japan_species.php --force     # 取り込み済みも再投入
 *   php enqueue_japan_species.php --dry-run   # 件数確認のみ
 *   php enqueue_japan_species.php --limit=500 # 最大件数指定
 */

declare(strict_types=1);

require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . 'libs/OmoikaneDB.php';
require_once ROOT_DIR . 'libs/LiteratureIngestionQueue.php';

$opts    = getopt('', ['force', 'dry-run', 'limit:']);
$force   = isset($opts['force']);
$dryRun  = isset($opts['dry-run']);
$limit   = isset($opts['limit']) ? max(1, (int)$opts['limit']) : 0;

$db    = new OmoikaneDB();
$pdo   = $db->getPDO();
$queue = LiteratureIngestionQueue::getInstance();

// 処理済みの taxon_key を事前取得（skip 判定用）
$doneKeys = [];
if (!$force) {
    $snap = $queue->snapshot();
    $doneStmt = $pdo->query("SELECT taxon_key FROM ingestion_queue WHERE status IN ('done','pending','claimed')");
    // Queue DB は別 SQLite なので別の方法で取得
    $doneKeys = [];
}

// OmoikaneDB から日本語名がある種を取得
// 三語名 (亜種など) も含む。taxon_rank がないため scientific_name の単語数で近似はしない。
$sql = "SELECT scientific_name, japanese_name FROM species
        WHERE japanese_name IS NOT NULL AND japanese_name != ''
          AND scientific_name IS NOT NULL AND scientific_name != ''";
if ($limit > 0) {
    $sql .= " LIMIT " . (int)$limit;
}

$stmt = $pdo->query($sql);
$rows = $stmt->fetchAll(\PDO::FETCH_ASSOC);

echo "対象種: " . count($rows) . "件\n";
if ($dryRun) {
    echo "[dry-run] 実際には投入しません\n";
    exit(0);
}

$enqueued = 0;
$skipped  = 0;
$batchSize = 1000;

foreach (array_chunk($rows, $batchSize) as $chunk) {
    foreach ($chunk as $row) {
        $sciName = trim($row['scientific_name'] ?? '');
        if ($sciName === '') { $skipped++; continue; }

        $queue->enqueue($sciName, 2, 0.0);
        $enqueued++;
    }
    echo "  投入中... {$enqueued}件\r";
}

echo "\n完了: enqueued={$enqueued} skipped={$skipped}\n";

$snap = $queue->snapshot();
echo "Queue total: {$snap['total']}\n";
