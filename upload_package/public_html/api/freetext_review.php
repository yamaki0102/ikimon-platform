<?php

/**
 * API: Freetext Review Queue
 * 
 * GET:  レビューキュー取得 (?status=pending|approved|rejected)
 * POST: レビューアクション (approve/reject)
 * 
 * POST body:
 *   { "observation_id": "xxx", "action": "approve", "resolved_taxon": {...} }
 *   { "observation_id": "xxx", "action": "reject", "reason": "..." }
 *   { "observation_id": "xxx", "action": "search", "query": "カルガモ" }
 */

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CSRF.php';
require_once __DIR__ . '/../../libs/FreetextReviewService.php';

header('Content-Type: application/json; charset=utf-8');

// Auth check — admin only
Auth::init();
CSRF::validateRequest();
$currentUser = Auth::user();
if (!$currentUser || ($currentUser['role'] ?? '') !== 'admin') {
    http_response_code(403);
    echo json_encode(['error' => '管理者権限が必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $status = $_GET['status'] ?? null;
    if ($status && !in_array($status, ['pending', 'approved', 'rejected'])) {
        http_response_code(400);
        echo json_encode(['error' => '無効なstatusパラメータ'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }

    $queue = FreetextReviewService::getQueue($status);
    $stats = FreetextReviewService::getStats();

    echo json_encode([
        'success' => true,
        'stats' => $stats,
        'queue' => $queue,
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true);
    if (!$input) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid JSON'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }

    $obsId = $input['observation_id'] ?? '';
    $action = $input['action'] ?? '';

    if (!$obsId || !$action) {
        http_response_code(400);
        echo json_encode(['error' => 'observation_id と action は必須です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }

    switch ($action) {
        case 'approve':
            $resolvedTaxon = $input['resolved_taxon'] ?? null;
            if (!$resolvedTaxon) {
                http_response_code(400);
                echo json_encode(['error' => 'resolved_taxon が必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
                exit;
            }
            $result = FreetextReviewService::approve($obsId, $resolvedTaxon);
            echo json_encode(['success' => $result, 'message' => $result ? '承認しました' : '対象が見つかりません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
            break;

        case 'reject':
            $reason = $input['reason'] ?? '';
            $result = FreetextReviewService::reject($obsId, $reason);
            echo json_encode(['success' => $result, 'message' => '却下しました'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
            break;

        case 'search':
            $query = $input['query'] ?? '';
            if (!$query) {
                http_response_code(400);
                echo json_encode(['error' => 'query が必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
                exit;
            }
            $candidates = FreetextReviewService::searchCandidates($query);
            echo json_encode(['success' => true, 'candidates' => $candidates], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
            break;

        default:
            http_response_code(400);
            echo json_encode(['error' => '無効なaction: ' . $action], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    }
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
