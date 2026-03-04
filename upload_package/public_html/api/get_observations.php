<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Taxon.php';

$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 24;
$offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
$query = $_GET['q'] ?? '';

$observations = DataStore::fetchAll('observations');

// Bounding Box (Viewport) Filter — for map performance
$sw_lat = isset($_GET['sw_lat']) ? (float)$_GET['sw_lat'] : null;
$sw_lng = isset($_GET['sw_lng']) ? (float)$_GET['sw_lng'] : null;
$ne_lat = isset($_GET['ne_lat']) ? (float)$_GET['ne_lat'] : null;
$ne_lng = isset($_GET['ne_lng']) ? (float)$_GET['ne_lng'] : null;

if ($sw_lat !== null && $sw_lng !== null && $ne_lat !== null && $ne_lng !== null) {
    $observations = array_filter($observations, function ($obs) use ($sw_lat, $sw_lng, $ne_lat, $ne_lng) {
        $lat = (float)($obs['lat'] ?? 0);
        $lng = (float)($obs['lng'] ?? 0);
        return $lat >= $sw_lat && $lat <= $ne_lat && $lng >= $sw_lng && $lng <= $ne_lng;
    });
}

// Status Filter (Special: unresolved)
$status = $_GET['status'] ?? '';
if ($status === 'unresolved') {
    $observations = array_filter($observations, function ($obs) {
        return ($obs['status'] ?? '') === 'Needs ID' || ($obs['status'] ?? '') === 'Suggested';
    });
} elseif (!empty($status)) {
    $observations = array_filter($observations, function ($obs) use ($status) {
        return ($obs['status'] ?? '') === $status;
    });
}

// User Filter
$userId = $_GET['user_id'] ?? '';
if (!empty($userId)) {
    $observations = array_filter($observations, function ($obs) use ($userId) {
        return ($obs['user_id'] ?? '') === $userId;
    });
}

// Taxon Group Filter (for map filter chips)
$taxonGroup = $_GET['taxon_group'] ?? '';
if (!empty($taxonGroup)) {
    $groupMap = [
        'insect' => ['昆虫', 'Insecta', 'insect'],
        'bird' => ['鳥', 'Aves', 'bird'],
        'plant' => ['植物', 'Plantae', 'plant'],
        'amphibian_reptile' => ['両生類', '爬虫類', 'Amphibia', 'Reptilia', 'amphibian', 'reptile'],
        'mammal' => ['哺乳類', 'Mammalia', 'mammal'],
        'fish' => ['魚', 'Actinopterygii', 'fish'],
        'fungi' => ['菌類', 'Fungi', 'fungi'],
    ];
    $keywords = $groupMap[$taxonGroup] ?? [];
    if (!empty($keywords)) {
        $observations = array_filter($observations, function ($obs) use ($keywords) {
            $group = $obs['taxon']['group'] ?? '';
            $class = $obs['taxon']['class'] ?? '';
            $name = $obs['taxon']['name'] ?? '';
            foreach ($keywords as $kw) {
                if (stripos($group, $kw) !== false || stripos($class, $kw) !== false || stripos($name, $kw) !== false) {
                    return true;
                }
            }
            return false;
        });
    }
}

// Exclude test/E2E users and sample images from public feed
$observations = array_filter($observations, function ($obs) {
    $userName = $obs['user_name'] ?? '';
    if (strpos($userName, 'E2E_') === 0) return false;
    $photo = $obs['photos'][0] ?? '';
    if (strpos($photo, 'sample_') !== false) return false;
    return true;
});

// Reverse sort by date
usort($observations, function ($a, $b) {
    return strtotime($b['updated_at'] ?? $b['observed_at']) - strtotime($a['updated_at'] ?? $a['observed_at']);
});

// Simple search filter
// H003: Hybrid Search Logic (Keyword)
if (!empty($query)) {
    // If query is present, we might want to relax other filters or combine them
    $observations = array_filter($observations, function ($obs) use ($query) {
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
    // Inject fresh user name
    if (isset($obs['user_id'])) {
        $obs['user_name'] = BioUtils::getUserName($obs['user_id']);
    }
}

echo json_encode([
    'total' => $total,
    'data' => $data,
    'has_more' => ($offset + $limit) < $total
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
