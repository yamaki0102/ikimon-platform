<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';

$id = trim((string)($_GET['id'] ?? ''));
if ($id === '') {
    echo json_encode(['success' => false, 'message' => 'id_required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$obs = DataStore::findById('observations', $id);
if (!$obs) {
    echo json_encode(['success' => false, 'message' => 'not_found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$machine = [];
foreach (($obs['ai_assessments'] ?? []) as $assessment) {
    if (($assessment['kind'] ?? '') === 'machine_assessment') {
        $machine[] = $assessment;
    }
}
$latest = end($machine) ?: null;

$ready = is_array($latest) && !empty($latest['summary']);
$summary = '';
if ($ready) {
    $summary = (string)($latest['simple_summary'] ?? $latest['summary'] ?? '');
}

echo json_encode([
    'success' => true,
    'status' => $obs['ai_assessment_status'] ?? 'queued',
    'ready' => $ready,
    'summary' => $summary,
    'model' => $latest['model'] ?? null,
    'recommended_taxon' => $latest['recommended_taxon']['name'] ?? null,
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
