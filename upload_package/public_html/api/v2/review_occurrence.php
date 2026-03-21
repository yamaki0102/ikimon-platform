<?php

/**
 * API v2: Review Occurrence — 音響/AI検出の承認・棄却
 *
 * POST /api/v2/review_occurrence.php
 *   - occurrence_id: string (必須)
 *   - action: 'approve' | 'reject' | 'suggest' (必須)
 *   - taxon_name: string (approve/suggest 時必須)
 *   - scientific_name: string (任意)
 *   - notes: string (任意)
 *
 * レスポンス:
 *   { success: true, data: { promoted: bool, tier: float, ... } }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/TrustLevel.php';
require_once ROOT_DIR . '/libs/CanonicalStore.php';
require_once ROOT_DIR . '/libs/EvidenceTierPromoter.php';

// --- Method check ---
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('Method not allowed', 405);
}

// --- Auth ---
Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Unauthorized', 401);
}

$user = Auth::user();
$userId = $user['id'];

// --- Rate limit: 30 reviews/min ---
if (!api_rate_limit('review_occurrence', 30, 60)) {
    api_error('Rate limit exceeded', 429);
}

// --- Input ---
$body = api_json_body();

$occurrenceId = $body['occurrence_id'] ?? '';
$action = $body['action'] ?? '';
$taxonName = $body['taxon_name'] ?? '';
$scientificName = $body['scientific_name'] ?? '';
$notes = $body['notes'] ?? '';

if (empty($occurrenceId)) {
    api_error('occurrence_id is required', 400);
}
if (!in_array($action, ['approve', 'reject', 'suggest'], true)) {
    api_error('action must be approve, reject, or suggest', 400);
}
if ($action !== 'reject' && empty($taxonName)) {
    api_error('taxon_name is required for approve/suggest', 400);
}

// --- Verify occurrence exists ---
$occ = CanonicalStore::getOccurrence($occurrenceId);
if (!$occ) {
    api_error('Occurrence not found', 404);
}

// --- Determine reviewer level (TrustLevel L1-5 → reviewer L0-L3) ---
$trustLevel = TrustLevel::calculate($userId);
$reviewerLevel = match (true) {
    $trustLevel >= 5 => 'L3',  // Sage → Expert reviewer
    $trustLevel >= 4 => 'L2',  // Guardian → Senior reviewer
    $trustLevel >= 3 => 'L1',  // Ranger → Standard reviewer
    default          => 'L0',  // Observer/Naturalist → Novice reviewer
};

// --- Map action ---
$mappedAction = match ($action) {
    'approve' => 'approve',
    'suggest' => 'approve',  // suggest は別分類名での approve
    'reject'  => 'reject',
};

// --- Process review via EvidenceTierPromoter ---
$result = EvidenceTierPromoter::processReview(
    $occurrenceId,
    $userId,
    $mappedAction,
    $taxonName,
    $reviewerLevel
);

// レスポンスに追加情報
$result['reviewer_level'] = $reviewerLevel;
$result['trust_level'] = $trustLevel;
$result['action'] = $action;

api_success($result);
