<?php
require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/AiObservationAssessment.php';
require_once ROOT_DIR . '/libs/Taxonomy.php';

$obsId = $argv[1] ?? 'b393d391-4ce2-4bc2-95bb-a01df04f68b1';
$obs = DataStore::findById('observations', $obsId);

if (!$obs) {
    echo "NOT FOUND: $obsId\n";
    exit(1);
}

echo "Photos: " . count($obs['photos'] ?? []) . "\n";
echo "Current species: " . ($obs['species_name'] ?? 'unknown') . "\n";

$result = AiObservationAssessment::buildAssessmentForObservation($obs, ['lane' => 'deep']);

if (!$result) {
    echo "FAILED\n";
    exit(1);
}

echo "--- Result ---\n";
echo "confidence: " . ($result['confidence_band'] ?? 'none') . "\n";
echo "photos_used: " . ($result['photo_count_used'] ?? 0) . "\n";
echo "simple_summary: " . ($result['simple_summary'] ?? 'none') . "\n";
echo "recommended: " . json_encode($result['recommended_taxon'] ?? null, JSON_UNESCAPED_UNICODE) . "\n";
echo "best_specific: " . json_encode($result['best_specific_taxon'] ?? null, JSON_UNESCAPED_UNICODE) . "\n";
echo "why_not_more: " . ($result['why_not_more_specific'] ?? 'none') . "\n";
echo "features_seen: " . json_encode($result['diagnostic_features_seen'] ?? [], JSON_UNESCAPED_UNICODE) . "\n";
echo "similar: " . json_encode($result['similar_taxa_to_compare'] ?? [], JSON_UNESCAPED_UNICODE) . "\n";

// Save to observation
$assessments = $obs['ai_assessments'] ?? [];
$assessments[] = $result;
$obs['ai_assessments'] = $assessments;
$obs['ai_assessment_status'] = 'completed';
DataStore::upsert('observations', $obs, 'id');

echo "\nSaved to observation.\n";
