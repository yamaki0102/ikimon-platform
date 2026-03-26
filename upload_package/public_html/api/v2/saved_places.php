<?php
require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/CSRF.php';

Auth::init();
$user = Auth::user();
if (!$user) { http_response_code(401); echo json_encode(['success' => false, 'error' => 'Unauthorized']); exit; }

$userId = $user['id'];
$method = $_SERVER['REQUEST_METHOD'];

$safeUserId = preg_replace('/[^a-zA-Z0-9_\-]/', '', $userId);
$filePath = "saved_places/{$safeUserId}";

header('Content-Type: application/json; charset=utf-8');

if ($method === 'GET') {
    $places = DataStore::get($filePath);
    if (!$places) $places = ['places' => [], 'updated_at' => null];
    echo json_encode(['success' => true, 'data' => $places['places'] ?? []], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) { http_response_code(400); echo json_encode(['success' => false, 'error' => 'Invalid JSON']); exit; }

    $action = $input['action'] ?? 'add';

    $existing = DataStore::get($filePath);
    if (!$existing) $existing = ['places' => [], 'updated_at' => null];
    $places = $existing['places'] ?? [];

    if ($action === 'add') {
        $name = trim($input['name'] ?? '');
        $lat = (float)($input['lat'] ?? 0);
        $lng = (float)($input['lng'] ?? 0);
        $icon = trim($input['icon'] ?? '📍');
        $label = trim($input['label'] ?? '');

        if (empty($name) || ($lat == 0 && $lng == 0)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'name and lat/lng required']);
            exit;
        }

        if (count($places) >= 20) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Max 20 places']);
            exit;
        }

        $id = 'sp_' . bin2hex(random_bytes(4));
        $place = [
            'id' => $id,
            'name' => mb_substr($name, 0, 50),
            'lat' => $lat,
            'lng' => $lng,
            'icon' => mb_substr($icon, 0, 4),
            'label' => mb_substr($label, 0, 20),
            'use_count' => 0,
            'created_at' => date('c'),
        ];

        $places[] = $place;
        DataStore::save($filePath, ['places' => $places, 'updated_at' => date('c')]);

        echo json_encode(['success' => true, 'place' => $place], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'delete') {
        $placeId = $input['place_id'] ?? '';
        $places = array_values(array_filter($places, fn($p) => ($p['id'] ?? '') !== $placeId));
        DataStore::save($filePath, ['places' => $places, 'updated_at' => date('c')]);
        echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($action === 'use') {
        $placeId = $input['place_id'] ?? '';
        foreach ($places as &$p) {
            if (($p['id'] ?? '') === $placeId) {
                $p['use_count'] = ($p['use_count'] ?? 0) + 1;
                $p['last_used_at'] = date('c');
                break;
            }
        }
        unset($p);
        DataStore::save($filePath, ['places' => $places, 'updated_at' => date('c')]);
        echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Unknown action']);
    exit;
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed']);
