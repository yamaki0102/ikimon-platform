<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Taxon.php';

$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 24;
$offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
$query = $_GET['q'] ?? '';

$observations = DataStore::fetchAll('observations');

// Status Filter (Special: unresolved)
$status = $_GET['status'] ?? '';
if ($status === 'unresolved') {
    $observations = array_filter($observations, function($obs) {
        return ($obs['status'] ?? '') === 'Needs ID' || ($obs['status'] ?? '') === 'Suggested';
    });
} elseif (!empty($status)) {
    $observations = array_filter($observations, function($obs) use ($status) {
        return ($obs['status'] ?? '') === $status;
    });
}

// User Filter
$userId = $_GET['user_id'] ?? '';
if (!empty($userId)) {
    $observations = array_filter($observations, function($obs) use ($userId) {
        return ($obs['user_id'] ?? '') === $userId;
    });
}

// Reverse sort by date
usort($observations, function($a, $b) {
    return strtotime($b['updated_at'] ?? $b['observed_at']) - strtotime($a['updated_at'] ?? $a['observed_at']);
});

// Simple search filter
// H003: Hybrid Search Logic (Keyword)
if (!empty($query)) {
    // If query is present, we might want to relax other filters or combine them
    $observations = array_filter($observations, function($obs) use ($query) {
        $name = $obs['taxon']['name'] ?? '';
        $sName = $obs['taxon']['scientific_name'] ?? '';
        $note = $obs['note'] ?? '';
        $place = $obs['place_name'] ?? '';
        
        // Match against multiple fields
        return stripos($name, $query) !== false || 
               stripos($sName, $query) !== false || 
               stripos($note, $query) !== false ||
               stripos($place, $query) !== false;
    });
}

$total = count($observations);
$data = array_slice(array_values($observations), $offset, $limit);

// Apply Privacy / Obscuring
require_once __DIR__ . '/../../libs/BioUtils.php';
require_once __DIR__ . '/../../libs/RedList.php';

foreach ($data as &$obs) {
    if (isset($obs['taxon']['name'])) {
        $rl = RedList::check($obs['taxon']['name']);
        if ($rl) {
            $obscured = BioUtils::getObscuredLocation($obs['lat'], $obs['lng'], $rl['category']);
            $obs['lat'] = $obscured['lat'];
            $obs['lng'] = $obscured['lng'];
            $obs['obscured_radius'] = $obscured['radius'];
            $obs['is_obscured'] = true;
            $obs['red_list'] = $rl;
        }
    }
}

echo json_encode([
    'total' => $total,
    'data' => $data,
    'has_more' => ($offset + $limit) < $total
]);
