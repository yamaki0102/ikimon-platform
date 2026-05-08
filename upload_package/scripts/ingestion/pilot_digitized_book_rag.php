<?php

declare(strict_types=1);

require_once dirname(__DIR__, 2) . '/config/config.php';

const DEFAULT_MODEL = 'gemini-3.1-flash-lite-preview';
const CA_BUNDLE_CANDIDATES = [
    'C:/Program Files (x86)/Google/Cloud SDK/google-cloud-sdk/lib/third_party/certifi/cacert.pem',
    'C:/Program Files/Blender Foundation/Blender 3.0/3.0/python/lib/site-packages/certifi/cacert.pem',
];

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only.\n");
    exit(1);
}

$args = $argv;
array_shift($args);
$resume = false;
$outputSuffix = '';
$positionals = [];
foreach ($args as $arg) {
    if ($arg === '--resume') {
        $resume = true;
        continue;
    }
    if (str_starts_with($arg, '--output-suffix=')) {
        $outputSuffix = preg_replace('/[^a-z0-9._-]+/i', '-', substr($arg, 16)) ?? '';
        $outputSuffix = trim($outputSuffix, '-.');
        continue;
    }
    $positionals[] = $arg;
}

[$bookDir, $startArg, $endArg] = array_pad($positionals, 3, null);

if (!$bookDir) {
    fwrite(STDERR, "Usage: php pilot_digitized_book_rag.php <book_dir> [start_page] [end_page] [--resume]\n");
    exit(1);
}

if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') {
    fwrite(STDERR, "GEMINI_API_KEY is not configured.\n");
    exit(1);
}

$resolvedBookDir = realpath($bookDir);
if ($resolvedBookDir === false || !is_dir($resolvedBookDir)) {
    fwrite(STDERR, "Book directory not found: {$bookDir}\n");
    exit(1);
}

$imageFiles = array_values(array_filter(
    scandir($resolvedBookDir) ?: [],
    static function (string $fileName) use ($resolvedBookDir): bool {
        if ($fileName === '.' || $fileName === '..') {
            return false;
        }
        $fullPath = $resolvedBookDir . DIRECTORY_SEPARATOR . $fileName;
        if (!is_file($fullPath)) {
            return false;
        }
        return (bool) preg_match('/\.(jpg|jpeg|png|webp)$/i', $fileName);
    }
));
sort($imageFiles, SORT_NATURAL | SORT_FLAG_CASE);

if ($imageFiles === []) {
    fwrite(STDERR, "No image files found in {$resolvedBookDir}\n");
    exit(1);
}

$startPage = max(1, (int) ($startArg ?? 1));
$endPage = min(count($imageFiles), (int) ($endArg ?? count($imageFiles)));
if ($endPage < $startPage) {
    fwrite(STDERR, "Invalid page range: {$startPage}-{$endPage}\n");
    exit(1);
}

$bookTitle = basename($resolvedBookDir);
$bookId = 'book_' . substr(sha1(mb_strtolower($bookTitle, 'UTF-8')), 0, 12);
$outputRoot = DATA_DIR . '/library/digitized_rag_pilot';
$suffixSegment = $outputSuffix !== '' ? '.' . $outputSuffix : '';
$rawRoot = $outputRoot . '/raw/' . $bookId . $suffixSegment;
$outputFile = $outputRoot . '/' . $bookId . $suffixSegment . '.json';

@mkdir($outputRoot, 0775, true);
@mkdir($rawRoot, 0775, true);

echo "=== Digitized Book RAG Pilot ===\n";
echo "Book   : {$bookTitle}\n";
echo "BookId : {$bookId}\n";
echo "Pages  : {$startPage}-{$endPage} / " . count($imageFiles) . "\n";
echo "Model  : " . DEFAULT_MODEL . "\n";
echo "Resume : " . ($resume ? "yes" : "no") . "\n";
echo "Suffix : " . ($outputSuffix !== '' ? $outputSuffix : 'none') . "\n";

$pages = [];
$usage = [
    'promptTokenCount' => 0,
    'candidatesTokenCount' => 0,
    'totalTokenCount' => 0,
];

for ($pageNumber = $startPage; $pageNumber <= $endPage; $pageNumber++) {
    $pageIndex = $pageNumber - 1;
    $currentFile = $imageFiles[$pageIndex];
    $previousFile = $pageIndex > 0 ? $imageFiles[$pageIndex - 1] : null;
    $nextFile = $pageIndex + 1 < count($imageFiles) ? $imageFiles[$pageIndex + 1] : null;

    echo sprintf("[%03d/%03d] %s\n", $pageNumber, $endPage, $currentFile);

    $rawPath = $rawRoot . '/page_' . str_pad((string) $pageNumber, 3, '0', STR_PAD_LEFT) . '.json';
    if ($resume && is_file($rawPath)) {
        $response = json_decode((string) file_get_contents($rawPath), true);
        if (!is_array($response)) {
            fwrite(STDERR, "Cached raw response is invalid for page {$pageNumber}; refetching.\n");
            $response = null;
        }
    } else {
        $response = null;
    }

    if ($response === null) {
        try {
            $response = callGeminiForPageWindow(
                $resolvedBookDir,
                $bookTitle,
                $pageNumber,
                $currentFile,
                $previousFile,
                $nextFile
            );
        } catch (Throwable $exception) {
            fwrite(STDERR, "Page {$pageNumber} failed: " . $exception->getMessage() . "\n");
            continue;
        }

        file_put_contents($rawPath, json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }

    $parsed = parseGeminiJson($response);
    if ($parsed === null) {
        fwrite(STDERR, "Failed to parse Gemini JSON for page {$pageNumber}\n");
        continue;
    }

    $pages[] = normalizePageResult(
        $parsed,
        $pageNumber,
        $currentFile,
        $previousFile,
        $nextFile
    );

    $usage['promptTokenCount'] += (int) ($response['usageMetadata']['promptTokenCount'] ?? 0);
    $usage['candidatesTokenCount'] += (int) ($response['usageMetadata']['candidatesTokenCount'] ?? 0);
    $usage['totalTokenCount'] += (int) ($response['usageMetadata']['totalTokenCount'] ?? 0);

    usleep(350000);
}

$chains = buildContinuityChains($pages);
$retrievalUnits = buildRetrievalUnits($pages, $chains);

$manifest = [
    'schemaVersion' => 'digitized-rag-pilot/v2',
    'book' => [
        'id' => $bookId,
        'title' => $bookTitle,
        'sourceDir' => $resolvedBookDir,
        'pageCount' => count($imageFiles),
        'processedRange' => [
            'startPage' => $startPage,
            'endPage' => $endPage,
        ],
    ],
    'processing' => [
        'model' => DEFAULT_MODEL,
        'processedAt' => gmdate(DATE_ATOM),
        'usage' => $usage,
        'note' => 'Pages are analyzed with adjacent-page context. Retrieval units are continuity-aware and should be preferred over isolated page text. Stable article ids are used when the model can infer them.',
    ],
    'pages' => $pages,
    'continuityChains' => $chains,
    'retrievalUnits' => $retrievalUnits,
];

file_put_contents($outputFile, json_encode($manifest, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

echo "Saved: {$outputFile}\n";
echo "Parsed pages: " . count($pages) . "\n";
echo "Continuity chains: " . count($chains) . "\n";
echo "Retrieval units: " . count($retrievalUnits) . "\n";

function callGeminiForPageWindow(
    string $bookDir,
    string $bookTitle,
    int $pageNumber,
    string $currentFile,
    ?string $previousFile,
    ?string $nextFile
): array {
    $parts = [[
        'text' => buildPrompt($bookTitle, $pageNumber, $currentFile, $previousFile, $nextFile),
    ]];

    if ($previousFile !== null) {
        $parts[] = ['text' => "PREVIOUS_PAGE_IMAGE ({$previousFile})"];
        $parts[] = inlineImagePart($bookDir . DIRECTORY_SEPARATOR . $previousFile);
    }

    $parts[] = ['text' => "CURRENT_PAGE_IMAGE ({$currentFile})"];
    $parts[] = inlineImagePart($bookDir . DIRECTORY_SEPARATOR . $currentFile);

    if ($nextFile !== null) {
        $parts[] = ['text' => "NEXT_PAGE_IMAGE ({$nextFile})"];
        $parts[] = inlineImagePart($bookDir . DIRECTORY_SEPARATOR . $nextFile);
    }

    $payload = [
        'contents' => [[
            'parts' => $parts,
        ]],
        'generationConfig' => [
            'response_mime_type' => 'application/json',
            'temperature' => 0.2,
            'topP' => 0.8,
        ],
    ];

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . DEFAULT_MODEL . ':generateContent?key=' . GEMINI_API_KEY;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_TIMEOUT => 120,
    ]);

    $caBundle = findCaBundle();
    if ($caBundle !== null) {
        curl_setopt($ch, CURLOPT_CAINFO, $caBundle);
    }

    for ($attempt = 1; $attempt <= 4; $attempt++) {
        $raw = curl_exec($ch);
        $httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $curlError = curl_error($ch);

        if ($raw === false || $curlError !== '') {
            if ($attempt === 4) {
                throw new RuntimeException("Gemini request failed for page {$pageNumber}: {$curlError}");
            }
            sleep($attempt * 2);
            continue;
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded)) {
            if ($attempt === 4) {
                throw new RuntimeException("Gemini returned non-JSON response for page {$pageNumber}: HTTP {$httpCode}");
            }
            sleep($attempt * 2);
            continue;
        }

        if ($httpCode >= 400 || isset($decoded['error'])) {
            $message = $decoded['error']['message'] ?? 'unknown_error';
            $isRetriable = in_array($httpCode, [429, 500, 503], true);
            if ($isRetriable && $attempt < 4) {
                sleep($attempt * 3);
                continue;
            }
            throw new RuntimeException("Gemini error for page {$pageNumber}: HTTP {$httpCode} {$message}");
        }

        return $decoded;
    }

    throw new RuntimeException("Gemini request exhausted retries for page {$pageNumber}");
}

function findCaBundle(): ?string
{
    foreach (CA_BUNDLE_CANDIDATES as $candidate) {
        if (is_file($candidate)) {
            return $candidate;
        }
    }
    return null;
}

function buildPrompt(string $bookTitle, int $pageNumber, string $currentFile, ?string $previousFile, ?string $nextFile): string
{
    $previousLabel = $previousFile ? "page " . ($pageNumber - 1) . " / {$previousFile}" : 'none';
    $nextLabel = $nextFile ? "page " . ($pageNumber + 1) . " / {$nextFile}" : 'none';

    return <<<PROMPT
You are building an INTERNAL-ONLY retrieval index for a digitized biological book. This is not for public redistribution.

Book title: {$bookTitle}
Current page number: {$pageNumber}
Current file: {$currentFile}
Previous page context: {$previousLabel}
Next page context: {$nextLabel}

Important rules:
- The CURRENT page is the anchor page.
- Use PREVIOUS/NEXT only to understand continuity, section boundaries, and sentence flow.
- Do not treat each page as independent if the text clearly continues across pages.
- If text is unreadable, say so briefly instead of inventing details.
- Summaries must be compact paraphrases, not long verbatim transcription.
- Focus on content useful for future RAG retrieval: taxa, morphology, habitat, behavior, life stage, identification, glossary, index, distribution, and section meaning.
- Return a SINGLE JSON OBJECT only. Never return an array as the root value.
- Always emit a non-empty page_summary when the page is not blank.
- If the page belongs to the same article/section as adjacent pages, reuse the same article_id even when subheadings vary.

Return strict JSON with this shape:
{
  "page_role": "cover|toc|content|index|plate|glossary|advertisement|unknown",
  "content_density": "dense_text|mixed|figure_plate|sparse|unknown",
  "article_id": "stable-short-id|null",
  "span_status": "single|start|middle|end",
  "section_title": "string|null",
  "section_id_hint": "stable-short-id|null",
  "continues_from_previous": true,
  "continues_to_next": false,
  "reading_order_notes": "string",
  "page_summary": "short Japanese summary for the anchor page with adjacent continuity awareness",
  "retrieval_units": [
    {
      "unit_id_hint": "stable-short-id",
      "article_id": "stable-short-id|null",
      "page_span_start": {$pageNumber},
      "page_span_end": {$pageNumber},
      "title": "string",
      "summary": "Japanese paraphrase, 1-3 sentences",
      "facts": ["short factual bullets"],
      "keywords": ["keyword"],
      "taxa": [
        {
          "japanese_name": "string|null",
          "scientific_name": "string|null",
          "group": "string|null",
          "mention_type": "explicit|inferred",
          "confidence": 0.0
        }
      ]
    }
  ]
}
PROMPT;
}

function inlineImagePart(string $path): array
{
    $extension = strtolower((string) pathinfo($path, PATHINFO_EXTENSION));
    $mime = match ($extension) {
        'png' => 'image/png',
        'webp' => 'image/webp',
        default => 'image/jpeg',
    };
    return [
        'inline_data' => [
            'mime_type' => $mime,
            'data' => base64_encode((string) file_get_contents($path)),
        ],
    ];
}

function parseGeminiJson(array $response): ?array
{
    $text = $response['candidates'][0]['content']['parts'][0]['text'] ?? null;
    if (!is_string($text) || trim($text) === '') {
        return null;
    }

    $clean = trim($text);
    $clean = preg_replace('/^```json\s*/i', '', $clean) ?? $clean;
    $clean = preg_replace('/\s*```$/', '', $clean) ?? $clean;
    $decoded = json_decode($clean, true);
    if (!is_array($decoded)) {
        return null;
    }

    // Gemini sometimes wraps the payload in a singleton array even when the
    // prompt requests a single JSON object. Unwrap that shape so dense pages
    // do not silently collapse into empty manifests.
    if (array_is_list($decoded) && count($decoded) === 1 && is_array($decoded[0])) {
        $decoded = $decoded[0];
    }

    return $decoded;
}

function normalizePageResult(array $parsed, int $pageNumber, string $fileName, ?string $previousFile, ?string $nextFile): array
{
    $units = [];
    foreach (($parsed['retrieval_units'] ?? []) as $index => $unit) {
        if (!is_array($unit)) {
            continue;
        }

        $units[] = [
            'unitIdHint' => trim((string) ($unit['unit_id_hint'] ?? ('unit-' . $pageNumber . '-' . ($index + 1)))),
            'articleId' => nullableString($unit['article_id'] ?? ($parsed['article_id'] ?? null)),
            'pageSpanStart' => max(1, (int) ($unit['page_span_start'] ?? $pageNumber)),
            'pageSpanEnd' => max(1, (int) ($unit['page_span_end'] ?? $pageNumber)),
            'title' => nullableString($unit['title'] ?? null),
            'summary' => trim((string) ($unit['summary'] ?? '')),
            'facts' => normalizeStringList($unit['facts'] ?? []),
            'keywords' => normalizeStringList($unit['keywords'] ?? []),
            'taxa' => normalizeTaxa($unit['taxa'] ?? []),
        ];
    }

    return [
        'pageNumber' => $pageNumber,
        'fileName' => $fileName,
        'previousFile' => $previousFile,
        'nextFile' => $nextFile,
        'pageRole' => trim((string) ($parsed['page_role'] ?? 'unknown')),
        'contentDensity' => normalizeEnum((string) ($parsed['content_density'] ?? 'unknown'), ['dense_text', 'mixed', 'figure_plate', 'sparse', 'unknown'], 'unknown'),
        'articleId' => nullableString($parsed['article_id'] ?? null),
        'spanStatus' => normalizeEnum((string) ($parsed['span_status'] ?? 'single'), ['single', 'start', 'middle', 'end'], 'single'),
        'sectionTitle' => nullableString($parsed['section_title'] ?? null),
        'sectionIdHint' => nullableString($parsed['section_id_hint'] ?? null),
        'continuesFromPrevious' => (bool) ($parsed['continues_from_previous'] ?? false),
        'continuesToNext' => (bool) ($parsed['continues_to_next'] ?? false),
        'readingOrderNotes' => trim((string) ($parsed['reading_order_notes'] ?? '')),
        'pageSummary' => trim((string) ($parsed['page_summary'] ?? '')),
        'retrievalUnits' => $units,
    ];
}

function normalizeStringList(mixed $value): array
{
    if (!is_array($value)) {
        return [];
    }
    $items = [];
    foreach ($value as $item) {
        $text = trim((string) $item);
        if ($text !== '') {
            $items[] = $text;
        }
    }
    return array_values(array_unique($items));
}

function normalizeTaxa(mixed $value): array
{
    if (!is_array($value)) {
        return [];
    }
    $items = [];
    foreach ($value as $item) {
        if (!is_array($item)) {
            continue;
        }
        $items[] = [
            'japaneseName' => nullableString($item['japanese_name'] ?? null),
            'scientificName' => nullableString($item['scientific_name'] ?? null),
            'group' => nullableString($item['group'] ?? null),
            'mentionType' => in_array(($item['mention_type'] ?? ''), ['explicit', 'inferred'], true) ? $item['mention_type'] : 'explicit',
            'confidence' => max(0.0, min(1.0, (float) ($item['confidence'] ?? 0.0))),
        ];
    }
    return $items;
}

function nullableString(mixed $value): ?string
{
    $text = trim((string) $value);
    return $text === '' || strtolower($text) === 'null' ? null : $text;
}

function normalizeEnum(string $value, array $allowed, string $fallback): string
{
    $normalized = trim(mb_strtolower($value, 'UTF-8'));
    return in_array($normalized, $allowed, true) ? $normalized : $fallback;
}

function buildContinuityChains(array $pages): array
{
    $chains = [];
    $current = null;

    foreach ($pages as $page) {
        $pageKey = continuityKey($page);
        $joinCurrent = $current !== null
            && (
                $pageKey !== null
                && $pageKey === $current['continuityKey']
                || ($current['continuesToNext'] && $page['continuesFromPrevious'])
            );

        if (!$joinCurrent) {
            if ($current !== null) {
                $chains[] = finalizeChain($current);
            }
            $current = [
                'continuityKey' => $pageKey,
                'articleId' => $page['articleId'],
                'sectionTitle' => $page['sectionTitle'],
                'startPage' => $page['pageNumber'],
                'endPage' => $page['pageNumber'],
                'continuesToNext' => $page['continuesToNext'],
                'spanStatuses' => [$page['spanStatus']],
                'pageNumbers' => [$page['pageNumber']],
                'summaries' => [$page['pageSummary']],
                'keywords' => collectKeywords($page['retrievalUnits']),
                'taxa' => collectTaxa($page['retrievalUnits']),
            ];
            continue;
        }

        $current['endPage'] = $page['pageNumber'];
        $current['continuesToNext'] = $page['continuesToNext'];
        $current['spanStatuses'][] = $page['spanStatus'];
        $current['pageNumbers'][] = $page['pageNumber'];
        $current['summaries'][] = $page['pageSummary'];
        $current['keywords'] = array_values(array_unique(array_merge($current['keywords'], collectKeywords($page['retrievalUnits']))));
        $current['taxa'] = mergeTaxa($current['taxa'], collectTaxa($page['retrievalUnits']));
        if ($current['articleId'] === null && $page['articleId'] !== null) {
            $current['articleId'] = $page['articleId'];
        }
        if ($current['sectionTitle'] === null && $page['sectionTitle'] !== null) {
            $current['sectionTitle'] = $page['sectionTitle'];
        }
    }

    if ($current !== null) {
        $chains[] = finalizeChain($current);
    }

    foreach ($chains as $index => &$chain) {
        $chain['chainId'] = 'chain-' . str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT);
    }

    return $chains;
}

function continuityKey(array $page): ?string
{
    if (!empty($page['articleId'])) {
        return (string) $page['articleId'];
    }
    if (!empty($page['sectionIdHint'])) {
        return (string) $page['sectionIdHint'];
    }
    if (!empty($page['sectionTitle'])) {
        return mb_strtolower((string) $page['sectionTitle'], 'UTF-8');
    }
    return null;
}

function finalizeChain(array $chain): array
{
    return [
        'chainId' => '',
        'articleId' => $chain['articleId'],
        'sectionTitle' => $chain['sectionTitle'],
        'pageStart' => $chain['startPage'],
        'pageEnd' => $chain['endPage'],
        'pageNumbers' => $chain['pageNumbers'],
        'spanStatuses' => $chain['spanStatuses'],
        'summary' => trim(implode(' ', array_filter(array_unique($chain['summaries'])))),
        'keywords' => $chain['keywords'],
        'taxa' => array_values($chain['taxa']),
    ];
}

function buildRetrievalUnits(array $pages, array $chains): array
{
    $units = [];

    foreach ($chains as $chain) {
        $units[] = [
            'unitId' => $chain['chainId'],
            'type' => 'continuity_chain',
            'articleId' => $chain['articleId'],
            'pageStart' => $chain['pageStart'],
            'pageEnd' => $chain['pageEnd'],
            'title' => $chain['sectionTitle'] ?? ('pages ' . $chain['pageStart'] . '-' . $chain['pageEnd']),
            'summary' => $chain['summary'],
            'keywords' => $chain['keywords'],
            'taxa' => array_values($chain['taxa']),
        ];
    }

    foreach ($pages as $page) {
        foreach ($page['retrievalUnits'] as $unit) {
            $units[] = [
                'unitId' => $page['pageNumber'] . ':' . $unit['unitIdHint'],
                'type' => 'page_anchor',
                'articleId' => $unit['articleId'] ?? $page['articleId'],
                'pageStart' => $unit['pageSpanStart'],
                'pageEnd' => $unit['pageSpanEnd'],
                'anchorPage' => $page['pageNumber'],
                'title' => $unit['title'],
                'summary' => $unit['summary'],
                'facts' => $unit['facts'],
                'keywords' => $unit['keywords'],
                'taxa' => $unit['taxa'],
            ];
        }
    }

    return $units;
}

function collectKeywords(array $units): array
{
    $keywords = [];
    foreach ($units as $unit) {
        $keywords = array_merge($keywords, $unit['keywords'] ?? []);
    }
    return array_values(array_unique(array_filter($keywords)));
}

function collectTaxa(array $units): array
{
    $taxa = [];
    foreach ($units as $unit) {
        foreach (($unit['taxa'] ?? []) as $taxon) {
            $key = ($taxon['scientificName'] ?? '') . '|' . ($taxon['japaneseName'] ?? '');
            if ($key === '|') {
                continue;
            }
            $taxa[$key] = $taxon;
        }
    }
    return $taxa;
}

function mergeTaxa(array $left, array $right): array
{
    foreach ($right as $key => $value) {
        $left[$key] = $value;
    }
    return $left;
}
