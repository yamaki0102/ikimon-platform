<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Taxon.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/BioUtils.php';
require_once __DIR__ . '/../../libs/Notification.php';
require_once __DIR__ . '/../../libs/RateLimiter.php';

Auth::init();

// FB-12: Apply rate limiting
RateLimiter::check();
$currentUser = Auth::user();

if (!$currentUser) {
    echo json_encode(['success' => false, 'message' => 'Login required']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || empty($data['observation_id']) || empty($data['taxon_key'])) {
    echo json_encode(['success' => false, 'message' => 'Invalid data']);
    exit;
}

$obs = DataStore::findById('observations', $data['observation_id']);
if (!$obs) {
    echo json_encode(['success' => false, 'message' => 'Observation not found']);
    exit;
}

$oldStatus = $obs['status'] ?? 'Needs ID';

// Use client-provided data found in Frontend
$taxonFull = $data['lineage'] ?? [];
// $japaneseName is handled by client in $data['taxon_name']

// Create identification entry
$id_entry = [
    'id' => bin2hex(random_bytes(4)),
    'user_id' => $currentUser['id'],
    'user_name' => $currentUser['name'],
    'user_avatar' => $currentUser['avatar'],
    'taxon_key' => $data['taxon_key'],
    'taxon_name' => $data['taxon_name'], 
    'scientific_name' => $data['scientific_name'],
    'scientific_name' => $data['scientific_name'],
    'confidence' => $data['confidence'],
    'life_stage' => $data['life_stage'] ?? 'unknown',
    
    // Fetch and store Lineage (Tree Support)
    'taxon_rank' => $taxonFull['rank'] ?? ($data['taxon_rank'] ?? 'species'),
    'lineage' => [
        'kingdom' => $taxonFull['kingdom'] ?? null,
        'phylum' => $taxonFull['phylum'] ?? null,
        'order' => $taxonFull['order'] ?? null,
        'family' => $taxonFull['family'] ?? null,
        'genus' => $taxonFull['genus'] ?? null,
    ],

    'note' => $data['note'] ?? '',
    'created_at' => date('Y-m-d H:i:s'),
    'weight' => 1.0 
];

// Add to observation
if (!isset($obs['identifications'])) {
    $obs['identifications'] = [];
}
$obs['identifications'][] = $id_entry;

// Update status and primary taxon based on consensus
BioUtils::updateConsensus($obs);

$obs['updated_at'] = date('Y-m-d H:i:s');

if (DataStore::upsert('observations', $obs)) {
    // Send Notification if not owner
    if ($obs['user_id'] !== $currentUser['id']) {
        // Notification for new ID
        Notification::send(
            $obs['user_id'],
            'id_added',
            '新しい名前の提案',
            $currentUser['name'] . ' さんが「' . $data['taxon_name'] . '」と判定しました。',
            'observation_detail.php?id=' . $obs['id']
        );

        // Notification for Research Grade
        if ($oldStatus !== 'Research Grade' && $obs['status'] === 'Research Grade') {
            Notification::send(
                $obs['user_id'],
                'research_grade',
                'Research Grade に到達しました！',
                'あなたの観察がコミュニティの合意により Research Grade に認定されました。',
                'observation_detail.php?id=' . $obs['id']
            );
        }
    }
    
    // Sync Gamification Stats
    require_once __DIR__ . '/../../libs/Gamification.php';
    Gamification::syncUserStats($currentUser['id']);
    
    echo json_encode(['success' => true]);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to save data']);
}
