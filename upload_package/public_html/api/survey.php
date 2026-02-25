<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/SurveyManager.php';
require_once __DIR__ . '/../../libs/CSRF.php';

Auth::init();
$user = Auth::user();

if (!$user) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Simple response helper
function respond($success, $message, $data = [])
{
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $data), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

if ($method === 'POST') {
    // CSRF Check
    if (!CSRF::validate($_POST['csrf_token'] ?? '')) {
        respond(false, 'Invalid CSRF token');
    }

    if ($action === 'start') {
        // Start new survey
        // Check if already running
        $active = SurveyManager::getActive($user['id']);
        if ($active) {
            respond(false, '既に進行中の調査があります', ['survey' => $active]);
        }

        $protocol = $_POST['protocol'] ?? 'casual';
        $fieldId = !empty($_POST['field_id']) ? $_POST['field_id'] : null;
        $party = !empty($_POST['party']) ? json_decode($_POST['party'], true) : [];

        // Event Tag (New)
        $eventTag = $_POST['event_tag'] ?? null;
        if (trim($eventTag ?? '') === '') $eventTag = null;

        $weatherType = $_POST['weather_type'] ?? '';
        $tempRange = $_POST['temp_range'] ?? '';
        // Legacy fallback
        $weatherLegacy = $_POST['weather'] ?? '';

        try {
            $survey = SurveyManager::create($user['id'], $protocol, $fieldId, $party ?? [], $eventTag);

            // Save initial weather context if provided
            if ($weatherType || $tempRange || $weatherLegacy) {
                $context = $survey['context'] ?? [];
                if ($weatherType) $context['weather_type'] = $weatherType;
                if ($tempRange)   $context['temp_range'] = $tempRange;
                if ($weatherLegacy && !$weatherType) $context['weather'] = $weatherLegacy;
                SurveyManager::update($survey['id'], ['context' => $context]);
                $survey['context'] = $context;
            }

            respond(true, '調査を開始しました', ['survey' => $survey]);
        } catch (Exception $e) {
            respond(false, '調査の開始に失敗しました: ' . $e->getMessage());
        }
    } elseif ($action === 'end') {
        // End survey
        $id = $_POST['id'] ?? '';
        if (!$id) respond(false, 'Survey ID is required');

        // Verify ownership and status
        $survey = SurveyManager::get($id);
        if (!$survey || $survey['user_id'] !== $user['id'] || $survey['status'] !== 'running') {
            respond(false, '有効な調査が見つかりません');
        }

        $stats = [
            'distance_m' => (int)($_POST['distance_m'] ?? 0),
            'obs_count' => (int)($_POST['obs_count'] ?? 0),
            'sp_count' => (int)($_POST['sp_count'] ?? 0),
        ];

        $context = [
            'weather_type' => $_POST['weather_type'] ?? '',
            'temp_range'   => $_POST['temp_range'] ?? '',
            'notes'        => $_POST['notes'] ?? '',
        ];
        // Legacy fallback
        $weatherLegacy = $_POST['weather'] ?? '';
        if ($weatherLegacy && empty($context['weather_type'])) {
            $context['weather'] = $weatherLegacy;
        }

        try {
            $updated = SurveyManager::finish($id, $stats, $context);
            if ($updated) {
                respond(true, '調査を終了しました', ['survey' => $updated]);
            } else {
                respond(false, '調査の終了に失敗しました');
            }
        } catch (Exception $e) {
            respond(false, 'エラーが発生しました: ' . $e->getMessage());
        }
    } elseif ($action === 'update_context') {
        // Update context only
        $id = $_POST['id'] ?? '';
        if (!$id) respond(false, 'Survey ID is required');

        $active = SurveyManager::getActive($user['id']);
        if (!$active || $active['id'] !== $id) {
            respond(false, '進行中の調査が見つかりません');
        }

        $notes = $_POST['notes'] ?? '';
        $weatherType = $_POST['weather_type'] ?? '';
        $tempRange = $_POST['temp_range'] ?? '';
        $weatherLegacy = $_POST['weather'] ?? '';
        $context = $active['context'] ?? [];
        $context['notes'] = $notes;
        if ($weatherType) {
            $context['weather_type'] = $weatherType;
        }
        if ($tempRange) {
            $context['temp_range'] = $tempRange;
        }
        if ($weatherLegacy && !$weatherType) {
            $context['weather'] = $weatherLegacy;
        }

        if (SurveyManager::update($id, ['context' => $context])) {
            respond(true, 'メモを更新しました');
        } else {
            respond(false, '更新に失敗しました');
        }
    } else {
        respond(false, 'Invalid action');
    }
} elseif ($method === 'GET') {
    if ($action === 'active') {
        $active = SurveyManager::getActive($user['id']);
        respond(true, 'success', ['survey' => $active]);
    } elseif ($action === 'history') {
        $limit = (int)($_GET['limit'] ?? 20);
        $offset = (int)($_GET['offset'] ?? 0);
        $history = SurveyManager::listByUser($user['id'], $limit, $offset);
        respond(true, 'success', ['surveys' => $history]);
    } else {
        respond(false, 'Invalid action');
    }
} else {
    respond(false, 'Invalid request method');
}
