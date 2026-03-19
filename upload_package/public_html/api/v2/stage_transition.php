<?php

/**
 * API v2: Stage Transition Endpoint
 *
 * 観察データの検証ステージを手動遷移する（管理者用）。
 *
 * POST /api/v2/stage_transition.php
 * Body: {
 *   "observation_id": "obs_xxx",
 *   "new_stage": "research_grade",
 *   "reason": "Manual upgrade after expert review"
 * }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/DataQuality.php';
require_once ROOT_DIR . '/libs/DataStageManager.php';

// 認証必須（Analyst以上）
Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Authentication required.', 401);
}

$currentUser = Auth::user();
$userRole = Auth::getRole($currentUser);
if (!in_array($userRole, ['Analyst', 'Admin'], true)) {
    api_error('Insufficient permissions. Analyst role required.', 403);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('POST method required.', 405);
}

$body = api_json_body();
$observationId = $body['observation_id'] ?? '';
$newStage = $body['new_stage'] ?? '';
$reason = $body['reason'] ?? '';

if (empty($observationId) || empty($newStage)) {
    api_error('observation_id and new_stage are required.', 400);
}

// 有効なステージか確認
$validStages = array_keys(DataStageManager::STAGE_META);
if (!in_array($newStage, $validStages, true)) {
    api_error('Invalid stage. Must be one of: ' . implode(', ', $validStages), 400);
}

// 観察データを取得
$obs = DataStore::findById('observations', $observationId);
if (!$obs) {
    api_error('Observation not found.', 404);
}

// ステージ遷移実行
$result = DataStageManager::transition($obs, $newStage, $currentUser['id'] ?? 'unknown', $reason);

if (!$result['success']) {
    api_error($result['error'], 422);
}

// 保存
$updatedObs = $result['observation'];
$updatedObs['updated_at'] = date('Y-m-d H:i:s');
DataStore::upsert('observations', $updatedObs);

api_success([
    'observation_id' => $observationId,
    'previous_stage' => DataStageManager::resolveStage($obs),
    'new_stage'      => $newStage,
    'stage_meta'     => DataStageManager::getStageMeta($newStage),
], [
    'actor' => $currentUser['id'] ?? 'unknown',
    'reason' => $reason,
]);
