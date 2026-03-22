<?php

/**
 * API v2: Species Card — 種ミニカード情報
 *
 * GET /api/v2/species_card.php?name=スズメ&scientific_name=Passer+montanus
 *
 * OmoikaneDB から特性・生息環境・形態的特徴を返す。
 * ウォーク・ライブスキャン中の検出時にリアルタイム表示するための軽量API。
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('Method not allowed', 405);
}

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Unauthorized', 401);
}

if (!api_rate_limit('species_card', 60, 60)) {
    api_error('Rate limit exceeded', 429);
}

$name = trim($_GET['name'] ?? '');
$sciName = trim($_GET['scientific_name'] ?? '');

if ($name === '' && $sciName === '') {
    api_error('name or scientific_name required', 400);
}

require_once ROOT_DIR . '/libs/OmoikaneSearchEngine.php';
$engine = new OmoikaneSearchEngine();

$resolvedSciName = $sciName;
$resolvedJaName = $name;

// 学名を解決
if ($sciName !== '') {
    $resolved = $engine->resolveByScientificName($sciName);
    if ($resolved) {
        $resolvedJaName = $resolved['japanese_name'] ?? $name;
    }
} elseif ($name !== '') {
    $resolved = $engine->resolveByJapaneseName($name);
    if ($resolved) {
        $resolvedSciName = $resolved['scientific_name'] ?? '';
        $resolvedJaName = $resolved['japanese_name'] ?? $name;
    }
}

// 特性取得
$traits = null;
if ($resolvedSciName !== '') {
    $traits = $engine->getTraitsByScientificName($resolvedSciName);
}

$card = [
    'japanese_name'       => $resolvedJaName ?: null,
    'scientific_name'     => $resolvedSciName ?: null,
    'habitat'             => $traits['habitat'] ?? null,
    'season'              => $traits['season'] ?? null,
    'altitude'            => $traits['altitude'] ?? null,
    'morphological_traits' => $traits['morphological_traits'] ?? null,
    'similar_species'     => $traits['similar_species'] ?? null,
    'key_differences'     => $traits['key_differences'] ?? null,
    'notes'               => $traits['notes'] ?? null,
    'ai_disclaimer'       => true,
];

api_success($card);
