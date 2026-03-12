<?php

/**
 * OMOIKANE - Batch Trust Score Recomputation
 * Run once to score all existing distilled species, then periodically if needed.
 *
 * Usage: php scripts/recompute_trust_scores.php
 */

require_once __DIR__ . '/../libs/TrustScoreCalculator.php';

date_default_timezone_set('Asia/Tokyo');

echo "[" . date('H:i:s') . "] Trust Score recomputation started\n";

$calc = new TrustScoreCalculator();

$result = $calc->recomputeAll(function ($current, $total) {
    echo "\r  Progress: $current / $total (" . round($current / $total * 100) . "%)";
});

echo "\n[" . date('H:i:s') . "] Done. Total: {$result['total']}, Computed: {$result['computed']}, Skipped: {$result['skipped']}\n";

// Quick stats
$db = new OmoikaneDB();
$pdo = $db->getPDO();
$stats = $pdo->query("
    SELECT
        COUNT(*) AS total,
        ROUND(AVG(trust_score), 3) AS avg_score,
        ROUND(MIN(trust_score), 3) AS min_score,
        ROUND(MAX(trust_score), 3) AS max_score,
        SUM(CASE WHEN trust_score >= 0.7 THEN 1 ELSE 0 END) AS high_trust,
        SUM(CASE WHEN trust_score >= 0.4 AND trust_score < 0.7 THEN 1 ELSE 0 END) AS mid_trust,
        SUM(CASE WHEN trust_score < 0.4 THEN 1 ELSE 0 END) AS low_trust
    FROM trust_scores
")->fetch();

echo "\n=== Score Distribution ===\n";
echo "  Total scored : {$stats['total']}\n";
echo "  Average      : {$stats['avg_score']}\n";
echo "  Range        : {$stats['min_score']} - {$stats['max_score']}\n";
echo "  High (>=0.7) : {$stats['high_trust']}\n";
echo "  Mid (0.4-0.7): {$stats['mid_trust']}\n";
echo "  Low (<0.4)   : {$stats['low_trust']}\n";
