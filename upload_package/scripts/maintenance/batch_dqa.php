<?php

/**
 * Batch DQA Calculator
 * 
 * 全observationに data_quality フィールドを一括計算・保存する。
 * Usage: php scripts/batch_dqa.php
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/DataQuality.php';

echo "=== Batch DQA Calculator ===\n";

$allObs = DataStore::fetchAll('observations');
$total = count($allObs);
echo "Total observations: {$total}\n";

$updated = 0;
$grades = ['A' => 0, 'B' => 0, 'C' => 0, 'D' => 0];
$partitions = [];

foreach ($allObs as $obs) {
    $grade = DataQuality::calculate($obs);
    $grades[$grade]++;

    // Only update if grade changed or not set
    $existing = $obs['data_quality'] ?? null;
    if ($existing !== $grade) {
        $obs['data_quality'] = $grade;

        // Determine partition key from observation date
        $date = $obs['observed_at'] ?? ($obs['created_at'] ?? '');
        $partition = '';
        if (preg_match('/^(\d{4}-\d{2})/', $date, $m)) {
            $partition = $m[1];
        }

        // Collect by partition for batch save
        if ($partition) {
            $partitions[$partition][$obs['id']] = $obs;
        }
        $updated++;
    }
}

// Save updated observations by partition
foreach ($partitions as $partition => $items) {
    $file = DATA_DIR . "/observations/{$partition}.json";
    if (file_exists($file)) {
        $raw = json_decode(file_get_contents($file), true) ?: [];

        // Index existing by id for fast lookup
        $indexed = [];
        foreach ($raw as $r) {
            $indexed[$r['id']] = $r;
        }

        // Merge updates
        foreach ($items as $id => $obs) {
            $indexed[$id] = $obs;
        }

        // Write back
        file_put_contents($file, json_encode(array_values($indexed), JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        echo "  Updated partition {$partition} (" . count($items) . " records)\n";
    }
}

echo "\n--- Results ---\n";
echo "Grade A (研究用): {$grades['A']}\n";
echo "Grade B (要検証): {$grades['B']}\n";
echo "Grade C (要補足): {$grades['C']}\n";
echo "Grade D (不完全): {$grades['D']}\n";
echo "Updated: {$updated} / {$total}\n";
echo "Done.\n";
