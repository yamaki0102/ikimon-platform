<?php

/**
 * ConsensusEngine バッチ処理
 *
 * 複数レビューが溜まった occurrence を一括で合意判定し、Tier 昇格を実行する。
 * cron で 5分ごとに実行する想定。
 *
 * Usage: php scripts/process_consensus.php
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/ConsensusEngine.php';

echo "=== ConsensusEngine Batch ===\n";
echo "Time: " . date('Y-m-d H:i:s') . "\n\n";

try {
    $result = ConsensusEngine::processQueue(100);
    echo "Processed: {$result['processed']}\n";
    echo "Promoted:  {$result['promoted']}\n";

    if ($result['promoted'] > 0) {
        echo "\nPromotions:\n";
        foreach ($result['details'] as $d) {
            if ($d['promoted'] ?? false) {
                echo "  - {$d['consensus']}: Tier {$d['from_tier']} → {$d['tier']} ({$d['status']})\n";
            }
        }
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n=== Done ===\n";
