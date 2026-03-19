<?php

/**
 * post_identification.php — 統合同定API (v1 + v2機能マージ)
 *
 * 同定を投稿する際の主要エンドポイント。
 * v1の lineage/BioUtils.updateConsensus と v2の evidence/TrustLevel を統合。
 *
 * POST body (JSON):
 *   - observation_id (str): 対象の観察ID
 *   - taxon_key (str|int): GBIF taxon key
 *   - taxon_name (str): 種名（和名 or 学名）
 *   - scientific_name (str): 学名
 *   - taxon_rank (str): 分類ランク (species, genus, etc.)
 *   - taxon_slug (str): URL用スラッグ
 *   - confidence (str): sure | likely | maybe | literature
 *   - life_stage (str): adult | juvenile | egg | trace | unknown
 *   - note (str): コメント（max 500 chars）
 *   - lineage (obj): { kingdom, phylum, class, order, family, genus }
 *   - evidence_type (str): visual | habitat | behavior | reference | sound
 *   - evidence_details (arr): エビデンス詳細（max 5件）
 */

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Taxon.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/BioUtils.php';
require_once __DIR__ . '/../../libs/Notification.php';
require_once __DIR__ . '/../../libs/DataQuality.php';
require_once __DIR__ . '/../../libs/RateLimiter.php';
require_once __DIR__ . '/../../libs/TrustLevel.php';
require_once __DIR__ . '/../../libs/CSRF.php';
require_once __DIR__ . '/../../libs/DataStageManager.php';

Auth::init();
CSRF::validateRequest();

// Rate limiting
RateLimiter::check();
$currentUser = Auth::user();

if (!$currentUser) {
    echo json_encode(['success' => false, 'message' => 'Login required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);

if (!$data || empty($data['observation_id']) || (empty($data['taxon_key']) && empty($data['taxon_name']))) {
    echo json_encode(['success' => false, 'message' => 'Invalid data: observation_id and taxon_key or taxon_name required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$obs = DataStore::findById('observations', $data['observation_id']);
if (!$obs) {
    echo json_encode(['success' => false, 'message' => 'Observation not found'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$oldStatus = $obs['status'] ?? '未同定';

// Lineage from client
$lineageData = $data['lineage'] ?? [];

// Evidence (v2 feature)
$evidenceType = $data['evidence_type'] ?? 'visual';
$validEvidenceTypes = ['visual', 'habitat', 'behavior', 'reference', 'sound'];
if (!in_array($evidenceType, $validEvidenceTypes)) {
    $evidenceType = 'visual';
}
$evidenceDetails = array_slice($data['evidence_details'] ?? [], 0, 5);
$notes = mb_substr(trim($data['note'] ?? $data['notes'] ?? ''), 0, 500);

// Confidence — accepted for backward compatibility but NOT used in quality assessment
// (v2: all votes are equal weight regardless of confidence)
$confidence = $data['confidence'] ?? null;

// Trust weight — stored for analytics only, NOT used in consensus calculation
$trustWeight = TrustLevel::getWeight($currentUser['id']);

// Create identification entry
$id_entry = [
    'id'              => bin2hex(random_bytes(4)),
    'user_id'         => $currentUser['id'],
    'user_name'       => $currentUser['name'],
    'user_avatar'     => $currentUser['avatar'] ?? '',
    'taxon_key'       => $data['taxon_key'] ?? '',
    'taxon_name'      => $data['taxon_name'] ?? '',
    'taxon_slug'      => $data['taxon_slug'] ?? '',
    'scientific_name' => $data['scientific_name'] ?? '',
    'confidence'      => $confidence,
    'life_stage'      => $data['life_stage'] ?? 'unknown',
    'taxon_rank'      => $lineageData['rank'] ?? ($data['taxon_rank'] ?? 'species'),
    'lineage'         => [
        'kingdom' => $lineageData['kingdom'] ?? null,
        'phylum'  => $lineageData['phylum'] ?? null,
        'class'   => $lineageData['class'] ?? null,
        'order'   => $lineageData['order'] ?? null,
        'family'  => $lineageData['family'] ?? null,
        'genus'   => $lineageData['genus'] ?? null,
    ],
    'evidence' => [
        'type'    => $evidenceType,
        'details' => $evidenceDetails,
        'notes'   => $notes,
    ],
    'note'           => $notes,
    'created_at'     => date('Y-m-d H:i:s'),
    'weight'         => $trustWeight,
    'trust_weight'   => $trustWeight,
];

// Add to observation — replace existing identification from same user (1 per user)
if (!isset($obs['identifications'])) {
    $obs['identifications'] = [];
}

// Remove any existing identification from this user (overwrite policy)
$obs['identifications'] = array_values(array_filter(
    $obs['identifications'],
    fn($existing) => ($existing['user_id'] ?? '') !== $currentUser['id']
));

$obs['identifications'][] = $id_entry;

// Update status and primary taxon based on consensus
BioUtils::updateConsensus($obs);

// Recalculate Data Quality Grade
$obs['data_quality'] = DataQuality::calculate($obs);

// Phase 2: Verification Stage Transition
$stageResult = DataStageManager::applyHumanIdentification($obs, $currentUser['id'], $data['taxon_name'] ?? '');
if ($stageResult['success']) {
    $obs = $stageResult['observation'];
}

// Phase A2: Update quality flags on identification change
if (!isset($obs['quality_flags'])) $obs['quality_flags'] = [];
$obs['quality_flags']['has_id'] = !empty($obs['identifications']);

$obs['updated_at'] = date('Y-m-d H:i:s');

if (DataStore::upsert('observations', $obs)) {
    // Send Notification if not owner
    if (($obs['user_id'] ?? '') !== $currentUser['id']) {
        Notification::sendAmbient(
            $obs['user_id'],
            Notification::TYPE_IDENTIFICATION,
            '名前がついた 🏷️',
            $currentUser['name'] . ' さんが「' . ($data['taxon_name'] ?? '') . '」と教えてくれました。',
            'observation_detail.php?id=' . $obs['id']
        );

        // Research Grade (研究用) 到達通知
        if ($oldStatus !== '研究用' && $obs['status'] === '研究用') {
            Notification::sendAmbient(
                $obs['user_id'],
                Notification::TYPE_IDENTIFICATION,
                'みんなの知恵が集まった',
                'あなたの記録がコミュニティの力で「研究用」に到達しました。',
                'observation_detail.php?id=' . $obs['id']
            );
        }
    }

    // Sync Gamification Stats
    require_once __DIR__ . '/../../libs/Gamification.php';
    Gamification::syncUserStats($currentUser['id']);

    echo json_encode([
        'success'        => true,
        'identification' => $id_entry,
        'new_status'     => $obs['status'],
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to save data'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
}
