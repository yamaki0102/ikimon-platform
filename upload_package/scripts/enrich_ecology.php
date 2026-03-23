<?php
/**
 * 生態系知識エンリッチメントスクリプト
 *
 * 権威あるソースから種の生態学的知識を収集し、ecosystem_roles.json を強化する
 *
 * ソース:
 *   - Wikipedia 日本語版 (MediaWiki API, CC BY-SA 3.0)
 *   - GBIF (REST API, CC BY 4.0)
 *   - Semantic Scholar (REST API, 研究目的無料)
 *   - J-STAGE (公開論文メタデータ)
 *
 * 使い方:
 *   php scripts/enrich_ecology.php [--species "シジュウカラ"] [--batch 10] [--dry-run]
 *
 * レート制限を守るため、バッチサイズと待機時間を設定
 */

require_once __DIR__ . '/../config/config.php';

$opts = getopt('', ['species:', 'batch:', 'dry-run', 'source:']);
$targetSpecies = $opts['species'] ?? null;
$batchSize = intval($opts['batch'] ?? 5);
$dryRun = isset($opts['dry-run']);
$sourceFilter = $opts['source'] ?? 'all'; // all|wikipedia|gbif|papers

$ecologyFile = DATA_DIR . '/ecology/ecosystem_roles.json';
if (!file_exists($ecologyFile)) {
    echo "ERROR: ecosystem_roles.json not found\n";
    exit(1);
}

$roles = json_decode(file_get_contents($ecologyFile), true);
echo "Loaded " . count($roles) . " species from ecosystem_roles.json\n";

$apiKey = defined('GEMINI_API_KEY') ? GEMINI_API_KEY : '';
if (!$apiKey) {
    echo "WARNING: GEMINI_API_KEY not set. Will collect raw data without structuring.\n";
}

// フィルタ: 特定種のみ or 全種
$targets = [];
if ($targetSpecies) {
    foreach ($roles as $sciName => $data) {
        if ($data['ja'] === $targetSpecies || $sciName === $targetSpecies) {
            $targets[$sciName] = $data;
        }
    }
} else {
    $targets = $roles;
}

echo "Processing " . count($targets) . " species (batch size: {$batchSize})\n";
if ($dryRun) echo "*** DRY RUN — no files will be modified ***\n";
echo str_repeat('-', 60) . "\n";

$enrichedCount = 0;
$processed = 0;

foreach ($targets as $sciName => $data) {
    $jaName = $data['ja'] ?? '';
    echo "\n[" . ($processed + 1) . "/" . count($targets) . "] {$jaName} ({$sciName})\n";

    $rawSources = [];

    // --- Wikipedia 日本語版 ---
    if ($sourceFilter === 'all' || $sourceFilter === 'wikipedia') {
        $wikiText = _fetchWikipedia($jaName);
        if ($wikiText) {
            $rawSources['wikipedia'] = $wikiText;
            echo "  ✓ Wikipedia: " . mb_strlen($wikiText) . " chars\n";
        } else {
            echo "  ✗ Wikipedia: not found\n";
        }
        usleep(500000); // 0.5秒待機
    }

    // --- GBIF ---
    if ($sourceFilter === 'all' || $sourceFilter === 'gbif') {
        $gbifData = _fetchGBIF($sciName);
        if ($gbifData) {
            $rawSources['gbif'] = $gbifData;
            echo "  ✓ GBIF: conservation={$gbifData['conservation_status']}\n";
        } else {
            echo "  ✗ GBIF: not found\n";
        }
        usleep(300000);
    }

    // --- Semantic Scholar (研究論文) ---
    if ($sourceFilter === 'all' || $sourceFilter === 'papers') {
        $papers = _fetchSemanticScholar($sciName, $jaName);
        if (!empty($papers)) {
            $rawSources['papers'] = $papers;
            echo "  ✓ Papers: " . count($papers) . " found\n";
        } else {
            echo "  ✗ Papers: none found\n";
        }
        usleep(1000000); // 1秒待機（Semantic Scholar は厳しめ）
    }

    // --- J-STAGE (国内論文) ---
    if ($sourceFilter === 'all' || $sourceFilter === 'papers') {
        $jstage = _fetchJStage($jaName);
        if (!empty($jstage)) {
            $rawSources['jstage'] = $jstage;
            echo "  ✓ J-STAGE: " . count($jstage) . " found\n";
        }
        usleep(500000);
    }

    if (empty($rawSources)) {
        echo "  → No data collected, skipping\n";
        $processed++;
        continue;
    }

    // Gemini で構造化抽出
    if ($apiKey && !$dryRun) {
        $newFacts = _extractFactsWithGemini($jaName, $sciName, $rawSources, $data);
        if (!empty($newFacts)) {
            // 既存の facts に追加（重複除去）
            $existingFacts = $data['facts'] ?? [$data['ecosystem_role'] ?? ''];
            $existingIndicates = $data['indicates'] ?? [];
            if (is_string($existingIndicates)) $existingIndicates = [$existingIndicates];

            $roles[$sciName]['facts'] = _mergeFacts($existingFacts, $newFacts['facts'] ?? []);
            $roles[$sciName]['indicates'] = _mergeFacts($existingIndicates, $newFacts['indicates'] ?? []);
            if (!empty($newFacts['conservation_status'])) {
                $roles[$sciName]['conservation_status'] = $newFacts['conservation_status'];
            }
            if (!empty($newFacts['research_note'])) {
                $roles[$sciName]['research_note'] = $newFacts['research_note'];
            }

            $enrichedCount++;
            echo "  → Enriched! facts: " . count($roles[$sciName]['facts']) . ", indicates: " . count($roles[$sciName]['indicates']) . "\n";
        }
        usleep(500000);
    } else {
        // Gemini なし → raw data を保存
        $rawDir = DATA_DIR . '/ecology/raw';
        if (!is_dir($rawDir)) mkdir($rawDir, 0755, true);
        $safeKey = preg_replace('/[^a-zA-Z0-9_]/', '_', $sciName);
        file_put_contents("{$rawDir}/{$safeKey}.json",
            json_encode($rawSources, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        echo "  → Raw data saved to raw/{$safeKey}.json\n";
    }

    $processed++;

    // バッチ制限
    if ($batchSize > 0 && $processed >= $batchSize) {
        echo "\n=== Batch limit ({$batchSize}) reached. Run again to continue. ===\n";
        break;
    }
}

// 保存
if (!$dryRun && $enrichedCount > 0) {
    file_put_contents($ecologyFile,
        json_encode($roles, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo "\n✅ Saved {$enrichedCount} enriched species to ecosystem_roles.json\n";
} else {
    echo "\n📊 Processed: {$processed}, Enriched: {$enrichedCount}\n";
}

// ====================================================================
// Helper Functions
// ====================================================================

function _curlGet(string $url, int $timeout = 10): ?string
{
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => $timeout,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_HTTPHEADER => ['User-Agent: ikimon.life/1.0 (biodiversity research; contact@ikimon.life)'],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ($httpCode === 200 && $response) ? $response : null;
}

function _fetchWikipedia(string $jaName): ?string
{
    $url = 'https://ja.wikipedia.org/w/api.php?' . http_build_query([
        'action' => 'query',
        'titles' => $jaName,
        'prop' => 'extracts',
        'exintro' => false,
        'explaintext' => true,
        'exsectionformat' => 'plain',
        'format' => 'json',
        'redirects' => 1,
    ]);

    $response = _curlGet($url);
    if (!$response) return null;

    $data = json_decode($response, true);
    $pages = $data['query']['pages'] ?? [];
    foreach ($pages as $page) {
        if (isset($page['extract']) && mb_strlen($page['extract']) > 100) {
            return mb_substr($page['extract'], 0, 3000);
        }
    }
    return null;
}

function _fetchGBIF(string $sciName): ?array
{
    $url = 'https://api.gbif.org/v1/species/match?' . http_build_query([
        'name' => $sciName,
        'strict' => 'true',
    ]);

    $response = _curlGet($url);
    if (!$response) return null;

    $match = json_decode($response, true);
    if (empty($match['usageKey'])) return null;

    $speciesKey = $match['usageKey'];
    $detailResp = _curlGet("https://api.gbif.org/v1/species/{$speciesKey}");
    $detail = $detailResp ? json_decode($detailResp, true) : [];

    return [
        'gbif_key' => $speciesKey,
        'kingdom' => $detail['kingdom'] ?? '',
        'phylum' => $detail['phylum'] ?? '',
        'class' => $detail['class'] ?? '',
        'order' => $detail['order'] ?? '',
        'family' => $detail['family'] ?? '',
        'conservation_status' => $match['status'] ?? 'unknown',
        'taxonomic_status' => $detail['taxonomicStatus'] ?? '',
    ];
}

function _fetchSemanticScholar(string $sciName, string $jaName): array
{
    $query = urlencode("{$sciName} ecology Japan");
    $url = "https://api.semanticscholar.org/graph/v1/paper/search?query={$query}&limit=5&fields=title,abstract,year,citationCount";

    $response = _curlGet($url, 15);
    if (!$response) return [];

    $data = json_decode($response, true);
    $papers = [];
    foreach (($data['data'] ?? []) as $paper) {
        if (!empty($paper['abstract'])) {
            $papers[] = [
                'title' => $paper['title'],
                'year' => $paper['year'] ?? null,
                'citations' => $paper['citationCount'] ?? 0,
                'abstract' => mb_substr($paper['abstract'], 0, 500),
            ];
        }
    }
    return $papers;
}

function _fetchJStage(string $jaName): array
{
    $query = urlencode("{$jaName} 生態");
    $url = "https://api.jstage.jst.go.jp/searchapi/do?service=3&keyword={$query}&count=5";

    $response = _curlGet($url);
    if (!$response) return [];

    // J-STAGE returns XML
    libxml_use_internal_errors(true);
    $xml = @simplexml_load_string($response);
    if (!$xml) return [];

    $papers = [];
    foreach ($xml->entry ?? [] as $entry) {
        $title = (string)($entry->article_title->ja ?? $entry->article_title->en ?? '');
        $abstract = (string)($entry->abstract->ja ?? $entry->abstract->en ?? '');
        if ($title) {
            $papers[] = [
                'title' => $title,
                'year' => (string)($entry->pubyear ?? ''),
                'abstract' => mb_substr($abstract, 0, 500),
                'source' => 'J-STAGE',
            ];
        }
    }
    return $papers;
}

function _extractFactsWithGemini(string $jaName, string $sciName, array $sources, array $existing): ?array
{
    $apiKey = GEMINI_API_KEY;
    $sourceText = '';

    if (!empty($sources['wikipedia'])) {
        $sourceText .= "【Wikipedia】\n{$sources['wikipedia']}\n\n";
    }
    if (!empty($sources['gbif'])) {
        $sourceText .= "【GBIF】\n" . json_encode($sources['gbif'], JSON_UNESCAPED_UNICODE) . "\n\n";
    }
    if (!empty($sources['papers'])) {
        $sourceText .= "【研究論文（Semantic Scholar）】\n";
        foreach ($sources['papers'] as $p) {
            $sourceText .= "- {$p['title']} ({$p['year']}, 被引用{$p['citations']}回)\n  {$p['abstract']}\n";
        }
        $sourceText .= "\n";
    }
    if (!empty($sources['jstage'])) {
        $sourceText .= "【国内論文（J-STAGE）】\n";
        foreach ($sources['jstage'] as $p) {
            $sourceText .= "- {$p['title']} ({$p['year']})\n  {$p['abstract']}\n";
        }
    }

    $existingFacts = json_encode($existing['facts'] ?? [$existing['ecosystem_role'] ?? ''], JSON_UNESCAPED_UNICODE);

    $prompt = <<<PROMPT
以下は {$jaName}（{$sciName}）に関する権威あるソースからの情報です。

{$sourceText}

すでに持っている事実:
{$existingFacts}

上記のソースから、音声自然ガイドで使える **新しい** 生態学的事実を抽出してください。
すでに持っている事実と重複しないものだけ。

以下のJSON形式で出力:
{{
  "facts": [
    "（ソースに基づいた事実1。1-2文、具体的に）",
    "（ソースに基づいた事実2）",
    "（ソースに基づいた事実3）"
  ],
  "indicates": [
    "（この種がいることが示す環境の状態1）",
    "（この種がいることが示す環境の状態2）"
  ],
  "conservation_status": "（保全上の状態。該当する場合のみ）",
  "research_note": "（最新の研究で分かった特に面白い事実があれば1つ）"
}}

条件:
- ソースに書かれていないことは書かない（ハルシネーション厳禁）
- 日本語で、音声読み上げに適した平易な表現で
- facts は3-5個、indicates は1-3個
- JSONのみ出力。説明文は不要
PROMPT;

    $payload = [
        'contents' => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => [
            'temperature' => 0.3,
            'maxOutputTokens' => 500,
            'responseMimeType' => 'application/json',
        ],
    ];

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL => "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={$apiKey}",
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$response) return null;

    $data = json_decode($response, true);
    $text = $data['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if (!$text) return null;

    $result = json_decode($text, true);
    return is_array($result) ? $result : null;
}

function _mergeFacts(array $existing, array $new): array
{
    $merged = $existing;
    foreach ($new as $fact) {
        $fact = trim($fact);
        if (empty($fact)) continue;
        // 簡易重複チェック: 既存の事実と30%以上一致したらスキップ
        $dominated = false;
        foreach ($merged as $e) {
            similar_text($e, $fact, $pct);
            if ($pct > 30) { $dominated = true; break; }
        }
        if (!$dominated) $merged[] = $fact;
    }
    return $merged;
}
