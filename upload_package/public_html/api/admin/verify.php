<?php
require_once __DIR__ . '/../../../libs/Auth.php';
require_once __DIR__ . '/../../../libs/DataStore.php';
require_once __DIR__ . '/../../../libs/BioUtils.php';

Auth::init();
if (!Auth::hasRole('Analyst')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input || !isset($input['id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid ID'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$id = $input['id'];
$obs = DataStore::findById('observations', $id);

if (!$obs) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Not Found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Update fields
$obs['status'] = '種レベル研究用';
$obs['quality_grade'] = 'Research Grade';
$obs['quality_detail'] = 'species_supported';
$obs['verified_by'] = Auth::user()['id'] ?? 'admin';
$obs['verified_at'] = date('Y-m-d H:i:s');

if (!empty($input['species_name'])) {
    if (empty($obs['taxon'])) {
        $obs['taxon'] = ['name' => htmlspecialchars($input['species_name'])];
    } else {
        $obs['taxon']['name'] = htmlspecialchars($input['species_name']);
    }
}

// Save back
DataStore::upsert('observations', $obs);

// TODO: Add comment if provided (would need a separate Comments store or embedded Comments array)

header('Content-Type: application/json; charset=utf-8');
echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
