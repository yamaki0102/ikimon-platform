<?php
require_once __DIR__ . '/../../../libs/Auth.php';
require_once __DIR__ . '/../../../libs/DataStore.php';

Auth::init();
if (!Auth::hasRole('Analyst')) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Fetch pending observations
// In a real DB, we would use WHERE status != 'Research Grade' LIMIT 20
// With JSON store, we fetch all and filter.
$all = DataStore::fetchAll('observations');
$pending = [];

foreach ($all as $obs) {
    if (($obs['status'] ?? '') !== 'Research Grade') {
        // Add minimal data needed for verification
        // Fix relative path for Admin view (which is one level deeper)
        $img = $obs['photos'][0] ?? '';
        if ($img && strpos($img, 'http') !== 0 && strpos($img, '/') !== 0) {
            $img = '../' . $img;
        }

        if (!$img) continue;
        $pending[] = [
            'id' => $obs['id'],
            'image_url' => $img,
            'observed_at' => $obs['observed_at'],
            'location_name' => $obs['location_name'] ?? (($obs['lat'] ?? null) ? sprintf('%.4f, %.4f', $obs['lat'], $obs['lng']) : 'Unknown'),
            'taxon' => $obs['taxon'] ?? ['name' => 'Unknown'],
            'user_id' => $obs['user_id']
        ];
        if (count($pending) >= 20) break;
    }
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(['success' => true, 'data' => $pending], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
