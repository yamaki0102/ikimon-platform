<?php

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/Taxonomy.php';

if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') {
    fwrite(STDERR, "GEMINI_API_KEY is not configured.\n");
    exit(1);
}

$ids = [];
foreach (array_slice($argv, 1) as $arg) {
    foreach (preg_split('/[,\s]+/', (string)$arg) ?: [] as $id) {
        $id = trim((string)$id);
        if ($id !== '') {
            $ids[$id] = $id;
        }
    }
}

if ($ids === []) {
    fwrite(STDERR, "Usage: php scripts/repair_failed_ai_assessments.php <observation-id> [<observation-id> ...]\n");
    exit(1);
}

$rows = DataStore::fetchAll('observations');
$indexById = [];
foreach ($rows as $index => $row) {
    $indexById[(string)($row['id'] ?? '')] = $index;
}

$summary = [
    'requested' => array_values($ids),
    'updated' => 0,
    'failed' => 0,
    'missing' => 0,
];

foreach (array_values($ids) as $id) {
    if (!array_key_exists($id, $indexById)) {
        $summary['missing']++;
        fwrite(STDERR, '[' . $id . "] observation not found\n");
        continue;
    }

    $index = $indexById[$id];
    $observation = $rows[$index];
    try {
        $assessment = buildMinimalAssessment($observation);
        if ($assessment === null) {
            throw new RuntimeException('minimal assessment returned null');
        }

        $rows[$index]['ai_assessment_status'] = 'completed';
        $rows[$index]['ai_assessment_updated_at'] = date('Y-m-d H:i:s');
        $rows[$index]['ai_assessments'] = array_values(array_filter(
            $rows[$index]['ai_assessments'] ?? [],
            fn($entry) => (string)($entry['kind'] ?? '') !== 'machine_assessment'
        ));
        $rows[$index]['ai_assessments'][] = $assessment;
        $rows[$index]['updated_at'] = date('Y-m-d H:i:s');
        $summary['updated']++;
    } catch (\Throwable $e) {
        $summary['failed']++;
        fwrite(STDERR, '[' . $id . '] ' . mb_substr($e->getMessage(), 0, 200) . PHP_EOL);
    }
}

DataStore::save('observations/2026-03', DataStore::get('observations/2026-03', 0));
$partitions = [];
foreach ($rows as $row) {
    $createdAt = (string)($row['created_at'] ?? '');
    $key = partitionKeyFor($createdAt);
    $partitions[$key] ??= [];
    $partitions[$key][] = $row;
}
foreach ($partitions as $file => $payload) {
    DataStore::save($file, $payload);
}

echo json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL;

function partitionKeyFor(string $createdAt): string
{
    $ts = strtotime($createdAt);
    if (!$ts) {
        return 'observations';
    }
    return 'observations/' . date('Y-m', $ts);
}

function buildMinimalAssessment(array $observation): ?array
{
    $images = loadImages($observation, 1, 640);
    if ($images === []) {
        return null;
    }

    $observedAt = (string)($observation['observed_at'] ?? '');
    $prompt = <<<PROMPT
Return JSON only.
Keys:
confidence_band,recommended_rank,summary,next_step,suggestions
suggestions must be 0-2 items with label,confidence,reason,emoji.
Prefer conservative ranks like family or genus. Use unknown if unsure.
PROMPT;

    $parts = [['text' => $prompt]];
    foreach ($images as $image) {
        $parts[] = [
            'inline_data' => [
                'mime_type' => $image['mime'],
                'data' => $image['data'],
            ],
        ];
    }

    $request = [
        'contents' => [[
            'parts' => $parts,
        ]],
        'generationConfig' => [
            'temperature' => 0.05,
            'maxOutputTokens' => 300,
            'responseMimeType' => 'application/json',
        ],
    ];

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . GEMINI_API_KEY;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($request, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);
    if (!is_string($response) || $response === '' || $httpCode !== 200) {
        throw new RuntimeException('repair API failed: HTTP ' . $httpCode . ' ' . $error);
    }

    $decoded = json_decode($response, true);
    $text = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? '';
    $payload = decodeLooseJson((string)$text);
    if (!is_array($payload)) {
        throw new RuntimeException('repair JSON parse failed');
    }

    $suggestions = [];
    foreach (array_slice((array)($payload['suggestions'] ?? []), 0, 2) as $suggestion) {
        if (!is_array($suggestion) || trim((string)($suggestion['label'] ?? '')) === '') {
            continue;
        }
        $suggestions[] = [
            'label' => clip((string)($suggestion['label'] ?? ''), 60),
            'confidence' => in_array(($suggestion['confidence'] ?? ''), ['high', 'medium', 'low'], true) ? $suggestion['confidence'] : 'low',
            'reason' => clip((string)($suggestion['reason'] ?? ''), 40),
            'emoji' => clip((string)($suggestion['emoji'] ?? '🔎'), 4),
        ];
    }

    $recommended = null;
    if ($suggestions !== []) {
        $resolved = Taxonomy::resolveSuggestion($suggestions[0]);
        if (is_array($resolved)) {
            $recommended = Taxonomy::toObservationTaxon($resolved);
        }
    }

    return [
        'id' => 'ai-repair-' . substr(bin2hex(random_bytes(8)), 0, 12),
        'kind' => 'machine_assessment',
        'created_at' => date('Y-m-d H:i:s'),
        'visibility' => 'public',
        'model' => 'gemini-2.5-flash',
        'processing_lane' => 'repair',
        'prompt_version' => 'repair_minimal_v1',
        'pipeline_version' => 'repair_minimal_v1',
        'taxonomy_version' => $recommended['taxonomy_version'] ?? ($observation['taxon']['taxonomy_version'] ?? null),
        'recommended_taxon' => $recommended,
        'recommended_rank' => normalizeRank($payload['recommended_rank'] ?? null),
        'best_specific_taxon' => $recommended,
        'stable_taxon' => $recommended,
        'candidate_disagreement' => 'unresolved',
        'routing_hint' => $recommended['rank'] ?? 'unknown',
        'provider_candidates' => array_map(fn($item) => [
            'provider' => 'gemini',
            'model' => 'gemini-2.5-flash',
            'label' => $item['label'],
            'confidence' => $item['confidence'],
            'reason' => $item['reason'],
            'emoji' => $item['emoji'],
            'resolved_taxon' => $recommended,
        ], $suggestions),
        'confidence_band' => in_array(($payload['confidence_band'] ?? ''), ['high', 'medium', 'low'], true) ? $payload['confidence_band'] : 'low',
        'summary' => clip((string)($payload['summary'] ?? ''), 80),
        'why_not_more_specific' => '',
        'diagnostic_features_seen' => [],
        'similar_taxa_to_compare' => [],
        'missing_evidence' => [],
        'geographic_context' => '',
        'seasonal_context' => '',
        'observer_boost' => '',
        'next_step' => clip((string)($payload['next_step'] ?? ''), 80),
        'cautionary_note' => '',
        'references' => [],
        'photo_count_used' => count($images),
        'simple_summary' => clip((string)($payload['summary'] ?? ''), 120),
        'text' => buildPublicText($recommended, $payload),
    ];
}

function buildPublicText(?array $recommended, array $payload): string
{
    $lines = [];
    if ($recommended) {
        $lines[] = '推奨: ' . ($recommended['name'] ?? '未確定') . '（' . ($recommended['rank'] ?? 'unknown') . '）';
    }
    if (!empty($payload['summary'])) {
        $lines[] = 'いま見えていること: ' . clip((string)$payload['summary'], 80);
    }
    if (!empty($payload['next_step'])) {
        $lines[] = '次に試すと良さそう: ' . clip((string)$payload['next_step'], 80);
    }
    return implode("\n", $lines);
}

function normalizeRank(mixed $value): string
{
    $rank = is_string($value) ? strtolower(trim($value)) : '';
    return in_array($rank, ['kingdom', 'phylum', 'class', 'order', 'family', 'genus', 'species', 'unknown'], true)
        ? $rank
        : 'unknown';
}

function decodeLooseJson(string $text): ?array
{
    $text = trim($text);
    if ($text === '') {
        return null;
    }
    if (str_starts_with($text, '```')) {
        $text = preg_replace('/^```(?:json)?\s*/u', '', $text);
        $text = preg_replace('/\s*```$/u', '', $text);
        $text = trim((string)$text);
    }
    $payload = json_decode($text, true);
    if (is_array($payload)) {
        return $payload;
    }
    $start = strpos($text, '{');
    $end = strrpos($text, '}');
    if ($start === false || $end === false || $end <= $start) {
        return null;
    }
    $candidate = substr($text, $start, $end - $start + 1);
    $candidate = preg_replace('/,\s*([}\]])/u', '$1', (string)$candidate);
    $payload = json_decode((string)$candidate, true);
    return is_array($payload) ? $payload : null;
}

function loadImages(array $observation, int $limit, int $maxDim): array
{
    $images = [];
    foreach (array_slice($observation['photos'] ?? [], 0, $limit) as $relativePath) {
        $relativePath = ltrim((string)$relativePath, '/');
        $fullPath = PUBLIC_DIR . '/' . $relativePath;
        if (!is_file($fullPath)) {
            continue;
        }
        $mimeType = mime_content_type($fullPath) ?: 'image/jpeg';
        $img = match ($mimeType) {
            'image/jpeg' => @imagecreatefromjpeg($fullPath),
            'image/png' => @imagecreatefrompng($fullPath),
            'image/webp' => @imagecreatefromwebp($fullPath),
            'image/gif' => @imagecreatefromgif($fullPath),
            default => false,
        };
        if (!$img) {
            continue;
        }
        $width = imagesx($img);
        $height = imagesy($img);
        if ($width > $maxDim || $height > $maxDim) {
            $ratio = min($maxDim / $width, $maxDim / $height);
            $newWidth = max(1, (int)round($width * $ratio));
            $newHeight = max(1, (int)round($height * $ratio));
            $resized = imagecreatetruecolor($newWidth, $newHeight);
            imagecopyresampled($resized, $img, 0, 0, 0, 0, $newWidth, $newHeight, $width, $height);
            imagedestroy($img);
            $img = $resized;
        }
        ob_start();
        imagejpeg($img, null, 82);
        $binary = ob_get_clean();
        imagedestroy($img);
        if (!is_string($binary) || $binary === '') {
            continue;
        }
        $images[] = ['mime' => 'image/jpeg', 'data' => base64_encode($binary)];
    }
    return $images;
}

function clip(string $value, int $limit): string
{
    return mb_substr(trim(strip_tags($value)), 0, $limit);
}
