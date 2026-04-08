<?php
/**
 * Regenerate AI assessment for a single observation.
 * Usage: php scripts/regen_assessment.php <observation_id>
 */

require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/AiObservationAssessment.php';
require_once ROOT_DIR . '/libs/AiAssessmentQueue.php';

$obsId = $argv[1] ?? '';
if ($obsId === '') {
    echo "Usage: php scripts/regen_assessment.php <observation_id>\n";
    exit(1);
}

$obs = DataStore::findById('observations', $obsId);
if (!$obs) {
    echo "NOT FOUND: $obsId\n";
    exit(1);
}

echo "Found: " . ($obs['taxon']['name'] ?? 'unknown') . "\n";
echo "Photos: " . count($obs['photos'] ?? []) . "\n";

$result = AiAssessmentQueue::processImmediate($obs, ['lane' => 'fast']);
if ($result) {
    echo "OK\n";
    echo "similar: " . json_encode($result['similar_taxa_to_compare'] ?? [], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT) . "\n";
    echo "summary: " . ($result['summary'] ?? '') . "\n";
} else {
    echo "FAILED\n";
}
