<?php
require_once __DIR__ . '/../config/config.php';
require_once ROOT_DIR . '/libs/DataStore.php';

$id = $argv[1] ?? 'b393d391-4ce2-4bc2-95bb-a01df04f68b1';
$obs = DataStore::findById('observations', $id);

if (!$obs) {
    echo "NOT FOUND\n";
    exit(1);
}

echo "species: " . ($obs['species_name'] ?? 'unknown') . "\n";
echo "status: " . ($obs['ai_assessment_status'] ?? 'none') . "\n";
echo "created: " . ($obs['created_at'] ?? 'unknown') . "\n";
echo "photos: " . count($obs['photos'] ?? []) . "\n";

$assessments = $obs['ai_assessments'] ?? [];
echo "assessments count: " . count($assessments) . "\n";

if (!empty($assessments)) {
    $last = end($assessments);
    echo "--- last assessment ---\n";
    echo "assessed_at: " . ($last['assessed_at'] ?? 'unknown') . "\n";
    echo "is_fallback: " . json_encode($last['is_fallback'] ?? false) . "\n";
    echo "confidence_band: " . ($last['confidence_band'] ?? 'none') . "\n";
    echo "simple_summary: " . ($last['simple_summary'] ?? 'none') . "\n";
    echo "recommended_taxon: " . json_encode($last['recommended_taxon'] ?? null, JSON_UNESCAPED_UNICODE) . "\n";
    echo "why_not_more_specific: " . ($last['why_not_more_specific'] ?? 'none') . "\n";
    echo "observer_boost: " . ($last['observer_boost'] ?? 'none') . "\n";
    echo "next_step: " . ($last['next_step'] ?? 'none') . "\n";
    echo "missing_evidence: " . json_encode($last['missing_evidence'] ?? [], JSON_UNESCAPED_UNICODE) . "\n";
} else {
    echo "NO ASSESSMENTS\n";
}
