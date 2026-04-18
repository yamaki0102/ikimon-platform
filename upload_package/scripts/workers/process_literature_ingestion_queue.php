<?php

/**
 * process_literature_ingestion_queue.php — 学術論文取り込みワーカー
 *
 * LiteratureIngestionQueue からジョブを claim し、
 * LiteratureIngestionPipeline で取り込みを実行する。
 *
 * 使い方:
 *   php process_literature_ingestion_queue.php [--limit=30] [--tier-max=2] [--reingest-stale=365]
 *
 * Cron (register on server):
 *   Tier 1+2 every 15 min:
 *     15分おき = "slash15" pattern in crontab
 *     cmd: php .../process_literature_ingestion_queue.php --limit=30 --tier-max=2
 *
 *   Annual re-ingest Sunday 3am:
 *     0 3 * * 0  php .../process_literature_ingestion_queue.php --reingest-stale=365 --limit=200
 */

declare(strict_types=1);

require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/LiteratureIngestionQueue.php';
require_once ROOT_DIR . '/libs/LiteratureIngestionPipeline.php';
require_once ROOT_DIR . '/libs/CrossRefClient.php';
require_once ROOT_DIR . '/libs/JStageClient.php';
require_once ROOT_DIR . '/libs/OmoikaneDB.php';
require_once ROOT_DIR . '/libs/PaperStore.php';
require_once ROOT_DIR . '/libs/TaxonPaperIndex.php';

// === CLI 引数 ===
$opts        = getopt('', ['limit:', 'tier-max:', 'reingest-stale:']);
$limit       = isset($opts['limit'])           ? max(1, (int)$opts['limit'])           : 30;
$tierMax     = isset($opts['tier-max'])        ? max(1, (int)$opts['tier-max'])        : 2;
$reingestDays = isset($opts['reingest-stale']) ? max(1, (int)$opts['reingest-stale'])  : 0;

$queue    = LiteratureIngestionQueue::getInstance();
$pipeline = new LiteratureIngestionPipeline('admin@ikimon.life');

$startedAt = time();
echo '[' . date('Y-m-d H:i:s') . "] literature_ingestion_worker start (limit={$limit} tier_max={$tierMax})\n";

// 年次再取得: stale な done エントリを pending に戻す
if ($reingestDays > 0) {
    $requeued = $queue->requeueStale($reingestDays);
    echo "[{$reingestDays}d stale] {$requeued} entries requeued\n";
}

// バッチ claim
$rows = $queue->claimBatchRows($limit, $tierMax);
if (empty($rows)) {
    echo '[' . date('Y-m-d H:i:s') . '] No pending jobs. Exit.' . PHP_EOL;
    exit(0);
}

echo 'Claimed: ' . count($rows) . " jobs\n";

$done   = 0;
$failed = 0;

foreach ($rows as $row) {
    $taxonKey      = $row['taxon_key'];
    $scientificName = $row['scientific_name'];
    $tier          = (int)$row['tier'];

    echo "  [{$tier}] {$scientificName} ... ";

    try {
        $result = $pipeline->ingestForTaxon($scientificName);

        $queue->markDone(
            $taxonKey,
            $result['new'],
            $result['source_status'] ?? []
        );

        echo "new={$result['new']} dup={$result['duplicate']} err=" . count($result['errors']) . "\n";
        if (!empty($result['errors'])) {
            foreach ($result['errors'] as $err) {
                echo "    [warn] {$err}\n";
            }
        }
        $done++;
    } catch (\Throwable $e) {
        $queue->markFailed($taxonKey, $e->getMessage());
        echo "FAILED: " . $e->getMessage() . "\n";
        $failed++;
    }
}

$elapsed = time() - $startedAt;
echo '[' . date('Y-m-d H:i:s') . "] done={$done} failed={$failed} elapsed={$elapsed}s\n";

// スナップショット
$snap = $queue->snapshot();
$byStatus = [];
foreach ($snap['by_tier_status'] as $s) {
    $byStatus[] = "tier{$s['tier']}:{$s['status']}={$s['count']}";
}
echo 'Queue: ' . implode(' ', $byStatus) . " total={$snap['total']}\n";
