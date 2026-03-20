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

// Multi-Subject: どの生物に対する同定か
// subject_id が明示指定されていなければ lineage から自動振り分け
$subjectId = $data['subject_id'] ?? null;
$newSubjectLabel = $data['new_subject_label'] ?? null;
$autoAssigned = false;

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

// ── Taxon Normalization ──
// 学名・taxon_key・lineage が不完全な場合、GBIF API で正規化する。
// 「カエル」「Frog」「Anura」等が全て同じ taxon に紐づくようにする。
$taxonName      = trim($data['taxon_name'] ?? '');
$scientificName = trim($data['scientific_name'] ?? '');
$taxonKey       = $data['taxon_key'] ?? '';
$taxonSlug      = $data['taxon_slug'] ?? '';
$taxonRank      = $lineageData['rank'] ?? ($data['taxon_rank'] ?? '');

// Step 1: ローカルDB（オモイカネ2971種 + TaxonSearchService）で即座に和名→学名解決
if ($scientificName === '' && $taxonName !== '') {
    // 1a. オモイカネDB（最速、ネットワーク不要）
    require_once __DIR__ . '/../../libs/OmoikaneSearchEngine.php';
    $omoikane = new OmoikaneSearchEngine();
    $localMatch = $omoikane->resolveByJapaneseName($taxonName);
    if ($localMatch && !empty($localMatch['scientific_name'])) {
        $scientificName = $localMatch['scientific_name'];
    }

    // 1b. TaxonSearchService（iNat/ローカルキャッシュ含む、より広範）
    //     完全一致 or ja_name完全一致を優先（「アリ」で「ユキノシタ目」がヒットする問題を防ぐ）
    if ($scientificName === '') {
        require_once __DIR__ . '/../../libs/TaxonSearchService.php';
        $searchResults = TaxonSearchService::search($taxonName, ['locale' => 'ja', 'limit' => 5]);
        $bestMatch = null;
        foreach ($searchResults as $sr) {
            $jaName = $sr['ja_name'] ?? '';
            if ($jaName === $taxonName) {
                // 完全一致 — 最優先
                $bestMatch = $sr;
                break;
            }
            if ($bestMatch === null && mb_strpos($jaName, $taxonName) === 0) {
                // 前方一致 — 次点
                $bestMatch = $sr;
            }
        }
        if ($bestMatch && !empty($bestMatch['scientific_name'])) {
            $scientificName = $bestMatch['scientific_name'];
            if (empty($taxonSlug) && !empty($bestMatch['slug'])) {
                $taxonSlug = $bestMatch['slug'];
            }
        }
    }
}

// Step 2: GBIF match で学名・lineage・key を補完
if ($scientificName === '' || empty($taxonKey) || empty($lineageData['kingdom'])) {
    $matchQuery = $scientificName !== '' ? $scientificName : $taxonName;
    if ($matchQuery !== '') {
        $gbifMatch = Taxon::match($matchQuery);
        if ($gbifMatch && !empty($gbifMatch['usageKey']) && ($gbifMatch['matchType'] ?? '') !== 'NONE') {
            if ($scientificName === '') {
                $scientificName = $gbifMatch['scientificName'] ?? $scientificName;
            }
            if (empty($taxonKey)) {
                $taxonKey = (string)($gbifMatch['usageKey'] ?? '');
            }
            if ($taxonRank === '' || $taxonRank === 'species') {
                $taxonRank = strtolower($gbifMatch['rank'] ?? $taxonRank);
            }
            if ($taxonSlug === '' && !empty($gbifMatch['canonicalName'])) {
                $taxonSlug = strtolower(str_replace(' ', '-', $gbifMatch['canonicalName']));
            }
            // Lineage 補完
            if (empty($lineageData['kingdom']) && !empty($gbifMatch['kingdom'])) {
                $lineageData['kingdom'] = $gbifMatch['kingdom'];
            }
            if (empty($lineageData['phylum']) && !empty($gbifMatch['phylum'])) {
                $lineageData['phylum'] = $gbifMatch['phylum'];
            }
            if (empty($lineageData['class']) && !empty($gbifMatch['class'])) {
                $lineageData['class'] = $gbifMatch['class'];
            }
            if (empty($lineageData['order']) && !empty($gbifMatch['order'])) {
                $lineageData['order'] = $gbifMatch['order'];
            }
            if (empty($lineageData['family']) && !empty($gbifMatch['family'])) {
                $lineageData['family'] = $gbifMatch['family'];
            }
            if (empty($lineageData['genus']) && !empty($gbifMatch['genus'])) {
                $lineageData['genus'] = $gbifMatch['genus'];
            }
        }
    }
}

// Auto-assign subject（GBIF正規化後の lineage を使う）
if ($subjectId === null || $subjectId === 'primary') {
    SubjectHelper::ensureSubjects($obs);
    if (SubjectHelper::isMultiSubject($obs) && $newSubjectLabel === null) {
        $autoSubject = SubjectHelper::autoAssignSubject($obs, $lineageData, $taxonName);
        if ($autoSubject !== 'primary') {
            $subjectId = $autoSubject;
            $autoAssigned = true;
        }
    }
}
if ($subjectId === null) {
    $subjectId = 'primary';
}

// Create identification entry
$id_entry = [
    'id'              => bin2hex(random_bytes(4)),
    'user_id'         => $currentUser['id'],
    'user_name'       => $currentUser['name'],
    'user_avatar'     => $currentUser['avatar'] ?? '',
    'taxon_key'       => $taxonKey,
    'taxon_name'      => $taxonName,
    'taxon_slug'      => $taxonSlug,
    'scientific_name' => $scientificName,
    'confidence'      => $confidence,
    'life_stage'      => $data['life_stage'] ?? 'unknown',
    'taxon_rank'      => $taxonRank ?: 'species',
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
    'subject_id'     => $subjectId,
];

// Multi-Subject: 新しいサブジェクトの作成が要求された場合
require_once __DIR__ . '/../../libs/SubjectHelper.php';
SubjectHelper::ensureSubjects($obs);

if ($newSubjectLabel !== null && $subjectId === 'primary') {
    // 「新しい生物を追加」→ 新 subject を作成
    $subjectId = SubjectHelper::addSubject($obs, $newSubjectLabel);
    $id_entry['subject_id'] = $subjectId;
} elseif ($subjectId !== 'primary' && SubjectHelper::findSubjectIndex($obs, $subjectId) < 0) {
    echo json_encode(['success' => false, 'message' => 'Subject not found: ' . $subjectId], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// Add to observation — replace existing identification from same user PER SUBJECT
if (!isset($obs['identifications'])) {
    $obs['identifications'] = [];
}

// Remove any existing identification from this user for the SAME subject (overwrite policy)
$obs['identifications'] = array_values(array_filter(
    $obs['identifications'],
    fn($existing) => !(
        ($existing['user_id'] ?? '') === $currentUser['id']
        && ($existing['subject_id'] ?? 'primary') === $subjectId
    )
));

$obs['identifications'][] = $id_entry;

// subjects[] に同定を振り分け
SubjectHelper::distributeIdentifications($obs);

// Update status and primary taxon based on consensus (subject-aware)
BioUtils::updateConsensus($obs);
SubjectHelper::syncPrimaryToLegacy($obs);

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
        'subject_id'     => $subjectId,
        'subject_count'  => SubjectHelper::subjectCount($obs),
        'auto_assigned'  => $autoAssigned,
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to save data'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
}
