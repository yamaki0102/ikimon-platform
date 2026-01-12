<?php
header('Content-Type: application/json');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';

Auth::init();
$user = Auth::user();

// simple admin check
if (!$user || !in_array($user['rank'] ?? '', ['Analyst', 'Specialist'])) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Unauthorized']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';
$flag_id = $input['flag_id'] ?? '';
$target_id = $input['target_id'] ?? '';

if ($action === 'hide') {
    // Hide the observation
    if ($target_id) {
        $obs = DataStore::find('observations', $target_id);
        if ($obs) {
            $obs['status'] = 'hidden'; // Mark as hidden
            DataStore::upsert('observations', $obs);
            
            // Also mark flag as resolved
            if ($flag_id) {
                $flag = DataStore::find('flags', $flag_id);
                if ($flag) {
                    $flag['status'] = 'resolved';
                    DataStore::upsert('flags', $flag);
                }
            }
            
            echo json_encode(['success' => true]);
            exit;
        }
    }
    echo json_encode(['success' => false, 'message' => 'Target not found']);
    exit;
}

if ($action === 'dismiss') {
    // Dismiss the flag (mark as rejected/safe)
    if ($flag_id) {
        $flag = DataStore::find('flags', $flag_id);
        if ($flag) {
            $flag['status'] = 'rejected'; // dismissed
            DataStore::upsert('flags', $flag);
            echo json_encode(['success' => true]);
            exit;
        }
    }
    echo json_encode(['success' => false, 'message' => 'Flag not found']);
    exit;
}

echo json_encode(['success' => false, 'message' => 'Invalid action']);
