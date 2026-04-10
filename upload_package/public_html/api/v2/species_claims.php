<?php

/**
 * API v2: Species Claims — 種の構造化知識を返す
 *
 * GET /api/v2/species_claims.php?scientific_name=Taraxacum+officinale
 * GET /api/v2/species_claims.php?japanese_name=セイヨウタンポポ
 * GET /api/v2/species_claims.php?taxon_key=123
 *
 * OmoikaneDB claims テーブルから claim_type 別にグルーピングして返す。
 */

require_once __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    api_error('Method not allowed', 405);
}

if (!api_rate_limit('species_claims', 120, 60)) {
    api_error('Rate limit exceeded', 429);
}

$sciName = trim($_GET['scientific_name'] ?? '');
$jaName  = trim($_GET['japanese_name'] ?? '');
$taxonKey = trim($_GET['taxon_key'] ?? '');

if ($sciName === '' && $jaName === '' && $taxonKey === '') {
    api_error('scientific_name, japanese_name, or taxon_key required', 400);
}

require_once ROOT_DIR . '/libs/OmoikaneDB.php';

/**
 * claims が0件の種に対してオンデマンドで Gemini Flash Lite から知識を生成・保存する。
 * 生成結果は claims テーブルに保存され、次回以降はキャッシュとして使われる。
 */
function generateClaimsOnDemand(\PDO $pdo, string $sciName, string $jaName): array
{
    $displayName = $jaName ?: $sciName;

    $prompt = <<<PROMPT
あなたは生物多様性プラットフォーム ikimon.life の知識生成エンジンです。

【対象生物】
和名: {$displayName}
学名: {$sciName}

この生き物について、以下の情報を広く知られている事実のみから生成してください。
確信がない情報は絶対に書かないこと。各 claim は80文字以内の日本語。

抽出対象 claim_type:
- identification_pitfall: よくある誤同定・紛らわしい類似種
- photo_target: 同定に重要な撮影部位と理由
- hybridization: 既知の交雑種・雑種情報
- cultural: 文化的・歴史的意義、名前の由来
- ecology_trivia: 意外な生態的事実
- taxonomy_note: 最近の分類改訂
- regional_variation: 地域による違い

情報が不確かな項目は空にしてください。

JSONのみ返してください:
{
  "claims": [
    {"type": "identification_pitfall", "text": "..."},
    {"type": "ecology_trivia", "text": "..."}
  ]
}
PROMPT;

    $ch = curl_init('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=' . GEMINI_API_KEY);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode([
            'contents'         => [['parts' => [['text' => $prompt]]]],
            'generationConfig' => [
                'temperature'      => 0.0,
                'maxOutputTokens'  => 512,
                'responseMimeType' => 'application/json',
                'responseSchema'   => [
                    'type'       => 'OBJECT',
                    'properties' => [
                        'claims' => [
                            'type'  => 'ARRAY',
                            'items' => [
                                'type'       => 'OBJECT',
                                'properties' => [
                                    'type' => ['type' => 'STRING'],
                                    'text' => ['type' => 'STRING'],
                                ],
                                'required' => ['type', 'text'],
                            ],
                        ],
                    ],
                    'required' => ['claims'],
                ],
            ],
        ], JSON_UNESCAPED_UNICODE),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) return [];

    $decoded = json_decode($response, true);
    $text    = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if (empty($text)) return [];

    $payload = json_decode($text, true);
    $claims  = $payload['claims'] ?? [];
    if (empty($claims)) return [];

    $validTypes = ['identification_pitfall','photo_target','hybridization','cultural','ecology_trivia','taxonomy_note','regional_variation'];
    $inserted = [];

    $stmt = $pdo->prepare("
        INSERT OR IGNORE INTO claims
            (taxon_key, claim_type, claim_text, source_tier, doi, source_title, confidence, claim_hash)
        VALUES (:taxon, :type, :text, 'B', NULL, 'AI (on-demand)', 0.5, :hash)
    ");

    foreach ($claims as $claim) {
        $type = $claim['type'] ?? '';
        $text = mb_substr(trim($claim['text'] ?? ''), 0, 200);
        if ($text === '' || !in_array($type, $validTypes, true)) continue;
        $hash = md5($sciName . '|' . $type . '|' . $text);
        try {
            $stmt->execute([':taxon' => $sciName, ':type' => $type, ':text' => $text, ':hash' => $hash]);
            $inserted[] = [
                'claim_type'   => $type,
                'claim_text'   => $text,
                'source_tier'  => 'B',
                'doi'          => null,
                'source_title' => 'AI (on-demand)',
                'confidence'   => '0.5',
                'region_scope' => null,
            ];
        } catch (\PDOException $e) { /* dup */ }
    }

    return $inserted;
}

try {
    $db  = new OmoikaneDB();
    $pdo = $db->getPDO();
} catch (Throwable $e) {
    api_error('Database unavailable', 503);
}

$conditions = [];
$params = [];

if ($taxonKey !== '') {
    $conditions[] = 'c.taxon_key = :taxon_key';
    $params[':taxon_key'] = $taxonKey;
}
if ($sciName !== '') {
    $conditions[] = '(c.taxon_key = :sci_name OR c.taxon_key IN (SELECT CAST(id AS TEXT) FROM species WHERE scientific_name = :sci_name2))';
    $params[':sci_name'] = $sciName;
    $params[':sci_name2'] = $sciName;
}
if ($jaName !== '') {
    $conditions[] = 'c.taxon_key IN (SELECT CAST(id AS TEXT) FROM species WHERE japanese_name = :ja_name)';
    $params[':ja_name'] = $jaName;
}

$where = implode(' OR ', $conditions);

$stmt = $pdo->prepare("
    SELECT c.claim_type, c.claim_text, c.source_tier, c.doi, c.source_title, c.confidence, c.region_scope
    FROM claims c
    WHERE ({$where})
    ORDER BY c.confidence DESC, c.id ASC
    LIMIT 100
");
$stmt->execute($params);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

// --- オンデマンド生成: claims が0件かつ学名がある場合に Gemini Flash Lite で即時生成 ---
if (empty($rows) && $sciName !== '' && defined('GEMINI_API_KEY') && GEMINI_API_KEY !== '') {
    $rows = generateClaimsOnDemand($pdo, $sciName, $jaName);
    if (!empty($rows)) {
        $db->refreshKnowledgeCoverage($sciName);
    }
}

$grouped = [];
foreach ($rows as $row) {
    $type = $row['claim_type'];
    if (!isset($grouped[$type])) {
        $grouped[$type] = [];
    }
    $grouped[$type][] = [
        'text'         => $row['claim_text'],
        'source_tier'  => $row['source_tier'],
        'doi'          => $row['doi'],
        'source_title' => $row['source_title'],
        'confidence'   => (float)$row['confidence'],
        'region_scope' => $row['region_scope'],
    ];
}

$typeLabels = [
    'identification_pitfall' => '同定の注意点',
    'hybridization'          => '雑種・交雑情報',
    'photo_target'           => '撮影ガイド',
    'cultural'               => '文化・歴史',
    'ecology_trivia'         => '生態トリビア',
    'taxonomy_note'          => '分類ノート',
    'regional_variation'     => '地域変異',
    'habitat'                => '生息環境',
    'season'                 => '活動時期',
    'morphology'             => '形態・同定',
    'conservation'           => '保全状況',
    'behavior'               => '行動',
    'distribution'           => '分布',
];

$result = [];
foreach ($grouped as $type => $claims) {
    $result[] = [
        'type'   => $type,
        'label'  => $typeLabels[$type] ?? $type,
        'claims' => $claims,
    ];
}

$priorityOrder = [
    'identification_pitfall', 'photo_target', 'hybridization',
    'ecology_trivia', 'cultural', 'taxonomy_note', 'regional_variation',
    'morphology', 'habitat', 'season', 'conservation', 'behavior', 'distribution',
];
usort($result, function ($a, $b) use ($priorityOrder) {
    $ia = array_search($a['type'], $priorityOrder);
    $ib = array_search($b['type'], $priorityOrder);
    if ($ia === false) $ia = 999;
    if ($ib === false) $ib = 999;
    return $ia - $ib;
});

echo json_encode([
    'success'     => true,
    'total_claims' => count($rows),
    'groups'      => $result,
], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
