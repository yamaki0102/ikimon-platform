<?php
/**
 * Migration 002: Sync existing JSON observations → Canonical Schema
 *
 * 既存の DataStore (JSON) に蓄積された観察データを
 * Canonical Schema (SQLite) に一括同期する。
 *
 * 冪等: 既に同期済みのデータはスキップされる。
 *
 * Usage: php scripts/migration/002_sync_existing_data.php
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/CanonicalSync.php';
require_once __DIR__ . '/../../libs/AuditLog.php';

echo "=== Sync Existing Data → Canonical Schema ===\n\n";

// AuditLog テーブルを確認（なければ作成）
AuditLog::createTable();

$start = microtime(true);
$result = CanonicalSync::syncAll();
$elapsed = round(microtime(true) - $start, 2);

echo "Synced:  {$result['synced']}\n";
echo "Skipped: {$result['skipped']} (already in Canonical)\n";
echo "Errors:  {$result['errors']}\n";
echo "Time:    {$elapsed}s\n";
if (!empty($result['skip_reasons'])) {
    echo "Skip reasons:\n";
    foreach ($result['skip_reasons'] as $reason => $count) {
        echo "  - {$reason}: {$count}\n";
    }
}

// Canonical Store の状態を表示
require_once __DIR__ . '/../../libs/CanonicalStore.php';
$kpi = CanonicalStore::getKPIMetrics();
echo "\n--- Canonical Schema Status ---\n";
echo "Total occurrences: {$kpi['total_occurrences']}\n";
echo "Unique species:    {$kpi['unique_species']}\n";
echo "Research Grade:    {$kpi['research_grade_count']}\n";
echo "By source: " . json_encode($kpi['by_source']) . "\n";
echo "By tier:   " . json_encode($kpi['by_tier']) . "\n";
