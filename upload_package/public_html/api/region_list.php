<?php

/**
 * 地域一覧API — セレクター用
 * GET /api/region_list.php
 * 
 * Returns: _index.json の内容 (全地域のメタデータ)
 * フロントエンドがこれを読んでセレクターを動的に構築する
 */
require_once __DIR__ . '/../../config/config.php';

header('Content-Type: application/json; charset=utf-8');

$index_path = DATA_DIR . '/regions/_index.json';

if (!file_exists($index_path)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'Region index not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$index = json_decode(file_get_contents($index_path), true);

if ($index === null) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Invalid region index'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

echo json_encode([
    'success' => true,
    'data' => $index
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
