<?php

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/DataStore.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('Method not allowed', 405);
}

$page   = api_param('page', 1, 'int');
$limit  = min(api_param('limit', 20, 'int'), 50);
$sort   = api_param('sort', 'newest');
$status = api_param('status', 'all');
$area   = api_param('area', '');

$all = DataStore::fetchAll('sound_archive');
if (!is_array($all)) $all = [];

$filtered = array_filter($all, function ($item) use ($status, $area) {
    if (!empty($item['hidden'])) return false;
    if ($status !== 'all' && ($item['identification_status'] ?? '') !== $status) return false;
    if ($area && stripos($item['location']['area_name'] ?? '', $area) === false) return false;
    return true;
});

if ($sort === 'most_ids') {
    usort($filtered, function ($a, $b) {
        return count($b['identifications'] ?? []) - count($a['identifications'] ?? []);
    });
} else {
    usort($filtered, function ($a, $b) {
        return strcmp($b['created_at'] ?? '', $a['created_at'] ?? '');
    });
}

$total  = count($filtered);
$offset = ($page - 1) * $limit;
$items  = array_slice($filtered, $offset, $limit);

api_success([
    'items'    => array_values($items),
    'total'    => $total,
    'page'     => $page,
    'has_more' => ($offset + $limit) < $total,
]);
