<?php

/**
 * post_dispute.php — Disagreement & Escalation API
 *
 * 3-step flow for identification disputes:
 * 1. Disagree: post alternative identification with evidence
 * 2. Discussion: community weighs in (auto via identifications)
 * 3. Escalation: if 3+ conflicting IDs, flag for review
 *
 * POST body (JSON):
 *   - observation_id (str): target observation
 *   - type (str): "disagree" | "withdraw" | "escalate"
 *   - reason (str): reason for dispute
 *   - alternative_taxon (str): optional alternative species name
 *
 * Response: JSON with dispute result
 */

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/Notification.php';
require_once __DIR__ . '/../../libs/BioUtils.php';
require_once __DIR__ . '/../../libs/CSRF.php';

Auth::init();
CSRF::validateRequest();

if (!Auth::isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'Login required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$obsId = $input['observation_id'] ?? '';
$action = $_POST['action'] ?? '';
$triggeredEscalation = false;
$type = $input['type'] ?? 'disagree';
$reason = mb_substr(trim($input['reason'] ?? ''), 0, 300);
$altTaxon = trim($input['alternative_taxon'] ?? '');

if (!$obsId) {
    echo json_encode(['success' => false, 'message' => '観察IDが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$validTypes = ['disagree', 'withdraw', 'escalate'];
if (!in_array($type, $validTypes)) {
    echo json_encode(['success' => false, 'message' => '無効なタイプです'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$user = Auth::user();
$userId = $user['id'];

$obs = DataStore::findById('observations', $obsId);
if (!$obs) {
    echo json_encode(['success' => false, 'message' => '観察が見つかりません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$disputes = $obs['disputes'] ?? [];
$identifications = $obs['identifications'] ?? [];

switch ($type) {
    case 'disagree':
        // Step 1: Register disagreement
        $disputes[] = [
            'id'         => uniqid('disp_'),
            'user_id'    => $userId,
            'user_name'  => $user['name'],
            'type'       => 'disagree',
            'reason'     => $reason,
            'alternative' => $altTaxon,
            'created_at' => date('c'),
            'status'     => 'open',
        ];

        // If providing alternative, also add as an identification
        if ($altTaxon) {
            $identifications[] = [
                'id'          => uniqid('id_'),
                'user_id'     => $userId,
                'user_name'   => $user['name'],
                'taxon_name'  => $altTaxon,
                'evidence'    => ['type' => 'visual', 'details' => [], 'notes' => $reason],
                'confidence'  => 'likely',
                'created_at'  => date('c'),
                'is_dispute'  => true,
            ];
        }

        // Auto-escalate if 3+ conflicting unique taxa
        $uniqueTaxa = array_unique(array_filter(array_map(fn($id) => $id['taxon_name'] ?? '', $identifications)));
        $needsEscalation = count($uniqueTaxa) >= 3;

        if ($needsEscalation) {
            $triggeredEscalation = true;
            $obs['escalated_at'] = date('c');
        }

        break;

    case 'withdraw':
        // Withdraw own identification
        $identifications = array_values(array_filter(
            $identifications,
            fn($id) => ($id['user_id'] ?? '') !== $userId
        ));
        break;

    case 'escalate':
        // Manual escalation request
        $disputes[] = [
            'id'         => uniqid('esc_'),
            'user_id'    => $userId,
            'user_name'  => $user['name'],
            'type'       => 'escalate',
            'reason'     => $reason,
            'created_at' => date('c'),
            'status'     => 'pending',
        ];
        $triggeredEscalation = true;
        $obs['escalated_at'] = date('c');
        break;
}

$obs['disputes'] = $disputes;
$obs['identifications'] = $identifications;

// Re-calculate consensus with the new dispute/identification state
BioUtils::updateConsensus($obs);

DataStore::upsert('observations', $obs);

// Notify observation owner about dispute
if (($obs['user_id'] ?? '') !== $userId && $type !== 'withdraw') {
    Notification::sendAmbient(
        $obs['user_id'],
        Notification::TYPE_IDENTIFICATION,
        '同定に新しい視点 🔬',
        $user['name'] . ' さんが別の見解を提案しています。',
        'observation_detail.php?id=' . $obsId
    );
}

echo json_encode([
    'success'   => true,
    'type'      => $type,
    'escalated' => $triggeredEscalation,
    'disputes'  => count($disputes),
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
