<?php
require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/QuestManager.php';
require_once ROOT_DIR . '/libs/CSRF.php';

Auth::init();
$currentUser = Auth::user();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $catalog = $_GET['catalog'] ?? '';
    $recommended = $_GET['recommended'] ?? '';

    if ($catalog === '1') {
        $goals = QuestManager::getGoalCatalog();
        $categories = [];
        foreach ($goals as $g) {
            $cat = $g['category'] ?? 'other';
            $categories[$cat][] = $g;
        }
        echo json_encode([
            'success' => true,
            'goals' => $goals,
            'categories' => $categories,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($recommended === '1' && $currentUser) {
        $recs = QuestManager::getRecommendedGoals($currentUser['id']);
        echo json_encode([
            'success' => true,
            'recommended' => $recs,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $goalsWithProgress = QuestManager::getActiveGoalsWithProgress($currentUser['id']);
    $fieldSignals = QuestManager::getScanQuests($currentUser['id']);
    $communitySignals = QuestManager::getCommunitySignals($currentUser['id']);

    echo json_encode([
        'success' => true,
        'goals' => $goalsWithProgress,
        'field_signals' => $fieldSignals,
        'community_signals' => $communitySignals,
        'max_goals' => QuestManager::MAX_ACTIVE_GOALS,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($method === 'POST') {
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['success' => false, 'error' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true) ?: $_POST;
    $action = $input['action'] ?? '';
    $goalId = $input['goal_id'] ?? '';

    $csrfToken = $input['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!CSRF::validateToken($csrfToken)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'CSRFトークンが無効です'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if (empty($goalId)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'goal_id が必要です'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $userId = $currentUser['id'];

    switch ($action) {
        case 'activate':
            $result = QuestManager::activateGoal($userId, $goalId);
            if (!$result) {
                $data = QuestManager::getUserGoals($userId);
                $activeCount = count($data['active_goals'] ?? []);
                $error = $activeCount >= QuestManager::MAX_ACTIVE_GOALS
                    ? 'アクティブゴールは最大' . QuestManager::MAX_ACTIVE_GOALS . '個までです'
                    : 'ゴールが見つかりません';
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => $error], JSON_UNESCAPED_UNICODE);
                exit;
            }
            echo json_encode(['success' => true, 'message' => 'ゴールを追加しました'], JSON_UNESCAPED_UNICODE);
            exit;

        case 'deactivate':
            $result = QuestManager::deactivateGoal($userId, $goalId);
            echo json_encode([
                'success' => $result,
                'message' => $result ? 'ゴールを解除しました（進捗は保持されます）' : 'ゴールが見つかりません',
            ], JSON_UNESCAPED_UNICODE);
            exit;

        default:
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => '不明なアクション: ' . htmlspecialchars($action, ENT_QUOTES, 'UTF-8')], JSON_UNESCAPED_UNICODE);
            exit;
    }
}

http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
