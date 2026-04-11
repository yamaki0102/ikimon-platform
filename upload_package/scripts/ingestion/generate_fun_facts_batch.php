<?php

/**
 * generate_fun_facts_batch.php — 豆知識バッチ生成スクリプト
 *
 * 種ごとにWikipedia日本語版 + GBIF Descriptions から情報を収集し、
 * Geminiで豆知識（fun_fact）を生成して OmoikaneDB に保存する。
 *
 * データソースとライセンス:
 *   - Wikipedia 日本語版: CC BY-SA 4.0 (MediaWiki API経由、非スクレイピング)
 *     利用規約: https://foundation.wikimedia.org/wiki/Policy:Terms_of_Use
 *   - GBIF Species Descriptions: CC BY 4.0
 *     利用規約: https://www.gbif.org/terms/data-user
 *
 * 使い方:
 *   php generate_fun_facts_batch.php
 *   php generate_fun_facts_batch.php --limit=50
 *   php generate_fun_facts_batch.php --force       # 既存 fun_fact を上書き
 *   php generate_fun_facts_batch.php --dry-run     # 収集のみ、DB保存なし
 *   php generate_fun_facts_batch.php --source=obs  # 観察データの種名も対象に
 */

declare(strict_types=1);

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/OmoikaneDB.php';
require_once __DIR__ . '/../../libs/DataStore.php';

// === CLI引数 ===
$opts = getopt('', ['limit:', 'force', 'dry-run', 'source:']);
$limit     = isset($opts['limit']) ? (int)$opts['limit'] : 0;
$force     = isset($opts['force']);
$dryRun    = isset($opts['dry-run']);
$includeObs = ($opts['source'] ?? '') === 'obs';

// === 定数 ===
define('FF_USER_AGENT',    'ikimon.life FunFactBot/1.1 (https://ikimon.life; contact@ikimon.life) PHP/' . PHP_VERSION);
define('FF_WIKI_API_BASE', 'https://ja.wikipedia.org/w/api.php');
define('FF_GBIF_API_BASE', 'https://api.gbif.org/v1');
define('FF_RATE_SLEEP_US',         900_000); // Wikipedia: 0.9秒 = 約67req/min (推奨範囲内)
define('FF_RATE_SLEEP_GBIF_US',   200_000); // GBIF: 0.2秒 = 5req/sec (公式上限10req/sec)
define('FF_RATE_SLEEP_WIKIDATA_US', 500_000); // Wikidata SPARQL: 0.5秒
define('FF_RATE_SLEEP_INAT_US',   200_000); // iNaturalist: 0.2秒 (ratelimit 100req/min)
define('FF_CHECKPOINT',    rtrim(DATA_DIR, '/') . '/library/fun_fact_progress.json');

// === DB接続 ===
$db  = new OmoikaneDB();
$pdo = $db->getPDO();

// === チェックポイント読み込み ===
$checkpoint = [];
if (file_exists(FF_CHECKPOINT)) {
    $checkpoint = json_decode(file_get_contents(FF_CHECKPOINT), true) ?: [];
}
$processed = $checkpoint['processed'] ?? [];
$errors    = $checkpoint['errors']    ?? [];

function saveCheckpoint(array &$processed, array &$errors): void
{
    file_put_contents(FF_CHECKPOINT, json_encode([
        'processed'  => $processed,
        'errors'     => $errors,
        'updated_at' => date('Y-m-d H:i:s'),
    ], JSON_UNESCAPED_UNICODE));
}

// === 対象種リストを構築 ===
function buildSpeciesList(\PDO $pdo, bool $includeObs): array
{
    $list = [];

    // 1. OmoikaneDB の distilled 種
    $stmt = $pdo->query("
        SELECT id, scientific_name, japanese_name
        FROM species
        WHERE distillation_status = 'distilled'
          AND scientific_name != ''
        ORDER BY id
    ");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $key = $row['scientific_name'];
        if (!isset($list[$key])) {
            $list[$key] = [
                'species_id'      => $row['id'],
                'scientific_name' => $row['scientific_name'],
                'japanese_name'   => $row['japanese_name'] ?? '',
            ];
        }
    }

    // 2. 観察データからユニークな種名（--source=obsのとき）
    if ($includeObs) {
        $observations = DataStore::fetchAll('observations');
        foreach ($observations as $obs) {
            $sciName = (string)($obs['taxon']['scientific_name'] ?? '');
            $jaName  = (string)($obs['taxon']['name'] ?? '');
            if ($sciName !== '' && !isset($list[$sciName])) {
                $list[$sciName] = [
                    'species_id'      => null,
                    'scientific_name' => $sciName,
                    'japanese_name'   => $jaName,
                ];
            }
        }
    }

    return array_values($list);
}

// === 既存 fun_fact チェック ===
function hasCachedFunFact(\PDO $pdo, int|null $speciesId, string $sciName): bool
{
    if ($speciesId !== null) {
        $stmt = $pdo->prepare("
            SELECT 1 FROM distilled_knowledge
            WHERE taxon_key = :id AND knowledge_type = 'fun_fact'
            LIMIT 1
        ");
        $stmt->execute([':id' => (string)$speciesId]);
        if ($stmt->fetchColumn()) return true;
    }
    $stmt = $pdo->prepare("
        SELECT 1 FROM distilled_knowledge
        WHERE taxon_key = :sci AND knowledge_type = 'fun_fact'
        LIMIT 1
    ");
    $stmt->execute([':sci' => $sciName]);
    return (bool)$stmt->fetchColumn();
}

// === HTTP GET (User-Agent設定 + エラーハンドル) ===
function httpGet(string $url): ?string
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HTTPHEADER     => ['User-Agent: ' . FF_USER_AGENT],
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 2,
    ]);
    $body     = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !is_string($body) || $body === '') return null;
    return $body;
}

// === Wikipedia 日本語版 記事概要を取得 ===
function fetchWikipediaJa(string $japaneseName, string $scientificName): ?string
{
    // 候補順: 日本語名 → 学名 → 学名の属名のみ
    $candidates = array_filter(array_unique([
        $japaneseName,
        $scientificName,
        explode(' ', $scientificName)[0] ?? '',
    ]));

    foreach ($candidates as $title) {
        if (empty($title)) continue;
        $url  = FF_WIKI_API_BASE . '?' . http_build_query([
            'action'      => 'query',
            'prop'        => 'extracts',
            'explaintext' => '1',
            'exintro'     => '1',
            'exsentences' => '5',
            'titles'      => $title,
            'format'      => 'json',
            'utf8'        => '1',
        ]);
        usleep(FF_RATE_SLEEP_US);
        $json = httpGet($url);
        if (!$json) continue;
        $data = json_decode($json, true);
        foreach (($data['query']['pages'] ?? []) as $pageId => $page) {
            if ($pageId != -1 && !empty($page['extract'])) {
                // 曖昧さ回避ページは除外
                if (mb_strpos($page['extract'], '曖昧さ回避') !== false) continue;
                return mb_substr(trim($page['extract']), 0, 600);
            }
        }
    }
    return null;
}

// === GBIF Species Descriptions を取得 ===
function fetchGbifDescriptions(string $scientificName): ?string
{
    // Step1: GBIF Species Match で usageKey 取得
    $matchUrl = FF_GBIF_API_BASE . '/species/match?' . http_build_query([
        'name'   => $scientificName,
        'strict' => 'true',
    ]);
    usleep(FF_RATE_SLEEP_GBIF_US);
    $matchJson = httpGet($matchUrl);
    if (!$matchJson) return null;
    $match    = json_decode($matchJson, true);
    $usageKey = $match['usageKey'] ?? null;
    if (!$usageKey) return null;

    // Step2: Descriptions 取得
    $descUrl = FF_GBIF_API_BASE . "/species/{$usageKey}/descriptions?limit=5";
    usleep(FF_RATE_SLEEP_GBIF_US);
    $descJson = httpGet($descUrl);
    if (!$descJson) return null;
    $descData = json_decode($descJson, true);

    $texts = [];
    foreach (($descData['results'] ?? []) as $result) {
        $desc = trim($result['description'] ?? '');
        if (!empty($desc)) {
            // HTMLタグ除去
            $desc = strip_tags($desc);
            $texts[] = mb_substr($desc, 0, 200);
        }
        if (count($texts) >= 3) break;
    }
    return !empty($texts) ? implode(' / ', $texts) : null;
}

// === Wikidata 構造化プロパティを取得して claims に変換 ===
function fetchWikidataProperties(string $scientificName, \PDO $pdo, int|null $speciesId): void
{
    $sparql = 'SELECT ?item ?endemic ?habitatLabel WHERE { ?item wdt:P225 "' . addslashes($scientificName) . '". OPTIONAL { ?item wdt:P183 ?endemic. } OPTIONAL { ?item wdt:P2974 ?habitat. } SERVICE wikibase:label { bd:serviceParam wikibase:language "ja,en". } } LIMIT 1';
    $url = 'https://query.wikidata.org/sparql?' . http_build_query(['query' => $sparql, 'format' => 'json']);
    usleep(FF_RATE_SLEEP_WIKIDATA_US);
    $json = httpGet($url);
    if (!$json) return;

    $data    = json_decode($json, true);
    $results = $data['results']['bindings'] ?? [];
    if (empty($results)) return;

    $row = $results[0];
    $taxonKey = $speciesId !== null ? (string)$speciesId : $scientificName;

    $stmt = $pdo->prepare("
        INSERT OR IGNORE INTO claims
            (taxon_key, claim_type, claim_text, source_tier, doi, source_title, confidence, claim_hash)
        VALUES (:taxon, :type, :text, 'B', NULL, 'Wikidata', 0.55, :hash)
    ");

    if (!empty($row['endemic']['value'])) {
        $text = '固有種: ' . mb_substr($row['endemic']['value'], 0, 80);
        $hash = md5($taxonKey . '|regional_variation|' . $text);
        try { $stmt->execute([':taxon' => $taxonKey, ':type' => 'regional_variation', ':text' => $text, ':hash' => $hash]); } catch (\PDOException $e) {}
    }
    if (!empty($row['habitatLabel']['value'])) {
        $text = '生息環境(Wikidata): ' . mb_substr($row['habitatLabel']['value'], 0, 80);
        $hash = md5($taxonKey . '|habitat|' . $text);
        try { $stmt->execute([':taxon' => $taxonKey, ':type' => 'habitat', ':text' => $text, ':hash' => $hash]); } catch (\PDOException $e) {}
    }
}

// === iNaturalist Taxon Page 情報を取得 ===
function fetchINaturalistInfo(string $scientificName): ?string
{
    $url = 'https://api.inaturalist.org/v1/taxa?' . http_build_query([
        'q'     => $scientificName,
        'rank'  => 'species',
        'limit' => 1,
    ]);
    usleep(FF_RATE_SLEEP_INAT_US);
    $json = httpGet($url);
    if (!$json) return null;

    $data = json_decode($json, true);
    $results = $data['results'] ?? [];
    if (empty($results)) return null;

    $taxon = $results[0];
    $parts = [];

    $wikiSummary = $taxon['wikipedia_summary'] ?? '';
    if (!empty($wikiSummary)) {
        $parts[] = mb_substr(strip_tags($wikiSummary), 0, 400);
    }

    $defaultName = $taxon['default_name']['name'] ?? '';
    if (!empty($defaultName) && $defaultName !== $scientificName) {
        $parts[] = '通称: ' . $defaultName;
    }

    $observationsCount = $taxon['observations_count'] ?? 0;
    if ($observationsCount > 0) {
        $parts[] = 'iNaturalist 観察記録数: ' . number_format($observationsCount);
    }

    return !empty($parts) ? implode(' / ', $parts) : null;
}

// === Gemini で fun_fact 生成 ===
function generateFunFact(string $japaneseName, string $scientificName, string $context): ?array
{
    if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') return null;

    $displayName = $japaneseName ?: $scientificName;
    $prompt = <<<PROMPT
あなたは生物多様性プラットフォーム ikimon.life の知識生成エンジンです。

【対象生物】
和名: {$displayName}
学名: {$scientificName}

【収集した情報（Wikipedia・GBIF・iNaturalist由来）】
{$context}

上記の情報のみを根拠に、以下の2つを生成してください。

## 1. fun_fact（豆知識）
- body: 120文字以内の日本語
- 断定しない語尾（「〜とも言われています」「〜という特徴があります」等）
- 視点の転換・意外な生態・名前の由来・他の生き物との関係 のどれかに絞る
- search_keyword: さらに調べるための日本語キーワード
- source: "wikipedia_ja" / "gbif" / "wikipedia_ja,gbif"

## 2. claims（構造化知識）
収集した情報から抽出できるものだけ。各 claim は80文字以内の日本語。

抽出対象:
- identification_pitfall: 同定の落とし穴（よくある誤同定、紛らわしい類似種）
- photo_target: 同定に重要な撮影部位と理由
- hybridization: 雑種・交雑情報
- cultural: 文化的・歴史的な意義、名前の由来
- ecology_trivia: 意外な生態的事実
- taxonomy_note: 分類の改訂・変更情報
- regional_variation: 地域による形態・生態の違い

該当情報がなければ空配列 [] を返してください。収集情報にない事実は絶対に書かないこと。

JSONのみ返してください:
{
  "body": "...",
  "search_keyword": "...",
  "source": "...",
  "claims": [
    {"type": "identification_pitfall", "text": "..."},
    {"type": "ecology_trivia", "text": "..."}
  ]
}
PROMPT;

    $url     = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=' . GEMINI_API_KEY;
    $request = [
        'contents'         => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => [
            'temperature'      => 0.0,
            'maxOutputTokens'  => 512,
            'responseMimeType' => 'application/json',
            'responseSchema'   => [
                'type'       => 'OBJECT',
                'properties' => [
                    'body'           => ['type' => 'STRING'],
                    'search_keyword' => ['type' => 'STRING'],
                    'source'         => ['type' => 'STRING'],
                    'claims'         => [
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
                'required' => ['body', 'search_keyword', 'source', 'claims'],
            ],
        ],
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST          => true,
        CURLOPT_HTTPHEADER    => ['Content-Type: application/json', 'User-Agent: ' . FF_USER_AGENT],
        CURLOPT_POSTFIELDS    => json_encode($request, JSON_UNESCAPED_UNICODE),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT       => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !is_string($response)) return null;

    $decoded = json_decode($response, true);
    $text    = $decoded['candidates'][0]['content']['parts'][0]['text'] ?? '';
    if (empty($text)) return null;

    $payload = json_decode($text, true);
    if (empty($payload['body'])) return null;
    return $payload;
}

// === distilled_knowledge に保存 ===
function saveFunFact(\PDO $pdo, int|null $speciesId, string $sciName, array $funFact): bool
{
    $taxonKey = $speciesId !== null ? (string)$speciesId : $sciName;
    $content  = json_encode([
        'body'           => $funFact['body'],
        'search_keyword' => $funFact['search_keyword'] ?? '',
        'source'         => $funFact['source'] ?? 'unknown',
    ], JSON_UNESCAPED_UNICODE);

    $stmt = $pdo->prepare("
        INSERT INTO distilled_knowledge (doi, taxon_key, knowledge_type, content, confidence, reviewed_by)
        VALUES (NULL, :taxon_key, 'fun_fact', :content, 0.7, 'generate_fun_facts_batch')
    ");
    return $stmt->execute([':taxon_key' => $taxonKey, ':content' => $content]);
}

// === claims を OmoikaneDB に保存 ===
function saveClaims(\PDO $pdo, int|null $speciesId, string $sciName, array $claims, string $sourceLabel): void
{
    if (empty($claims)) return;

    $taxonKey = $speciesId !== null ? (string)$speciesId : $sciName;
    $validTypes = [
        'identification_pitfall', 'photo_target', 'hybridization',
        'cultural', 'ecology_trivia', 'taxonomy_note', 'regional_variation',
    ];

    $sourceTier = 'B';
    $sourceTitle = match (true) {
        str_contains($sourceLabel, 'wikipedia') && str_contains($sourceLabel, 'gbif') => 'Wikipedia JA / GBIF',
        str_contains($sourceLabel, 'wikipedia') && str_contains($sourceLabel, 'inat') => 'Wikipedia JA / iNaturalist',
        str_contains($sourceLabel, 'wikipedia') => 'Wikipedia JA',
        str_contains($sourceLabel, 'gbif')      => 'GBIF Species Descriptions',
        str_contains($sourceLabel, 'inat')      => 'iNaturalist',
        default                                  => 'Wikipedia JA / GBIF / iNaturalist',
    };

    $stmt = $pdo->prepare("
        INSERT OR IGNORE INTO claims
            (taxon_key, claim_type, claim_text, source_tier, doi, source_title, confidence, claim_hash)
        VALUES (:taxon, :type, :text, :tier, NULL, :title, :conf, :hash)
    ");

    foreach ($claims as $claim) {
        $type = $claim['type'] ?? '';
        $text = trim($claim['text'] ?? '');
        if ($text === '' || !in_array($type, $validTypes, true)) continue;
        $text = mb_substr($text, 0, 200);
        $hash = md5($taxonKey . '|' . $type . '|' . $text);

        try {
            $stmt->execute([
                ':taxon' => $taxonKey,
                ':type'  => $type,
                ':text'  => $text,
                ':tier'  => $sourceTier,
                ':title' => $sourceTitle,
                ':conf'  => 0.6,
                ':hash'  => $hash,
            ]);
        } catch (\PDOException $e) { /* dup */ }
    }
}

// === メイン処理 ===
$species = buildSpeciesList($pdo, $includeObs);
$total   = count($species);
echo "対象種: {$total}件\n";
if ($dryRun) echo "[DRY RUN] DB保存は行いません\n";

$done = $skip = $err = 0;

foreach ($species as $sp) {
    $sci = $sp['scientific_name'];
    $ja  = $sp['japanese_name'];
    $sid = $sp['species_id'];

    // チェックポイントでスキップ (--force 時はバイパス)
    if (!$force && in_array($sci, $processed, true)) {
        $skip++;
        continue;
    }

    // 既存 fun_fact があればスキップ（--force で上書き）
    if (!$force && hasCachedFunFact($pdo, $sid, $sci)) {
        $skip++;
        $processed[] = $sci;
        continue;
    }

    echo "  [{$sci}] ({$ja}) - ";

    // Wikipedia JA 取得
    $wikiText = fetchWikipediaJa($ja, $sci);
    echo $wikiText ? 'wiki✓ ' : 'wiki- ';

    // GBIF Descriptions 取得
    $gbifText = fetchGbifDescriptions($sci);
    echo $gbifText ? 'gbif✓ ' : 'gbif- ';

    // iNaturalist 取得
    $inatText = fetchINaturalistInfo($sci);
    echo $inatText ? 'inat✓ ' : 'inat- ';

    $context = implode("\n\n", array_filter([$wikiText, $gbifText, $inatText]));
    if (empty($context)) {
        echo "→ スキップ（テキストなし）\n";
        $errors[] = $sci;
        $processed[] = $sci;
        $err++;
        saveCheckpoint($processed, $errors);
        continue;
    }

    // Gemini で fun_fact 生成
    $funFact = generateFunFact($ja, $sci, $context);
    if (!$funFact) {
        echo "→ Gemini失敗\n";
        $errors[] = $sci;
        $processed[] = $sci;
        $err++;
        saveCheckpoint($processed, $errors);
        continue;
    }

    $claimCount = count($funFact['claims'] ?? []);
    echo "→ \"{$funFact['body']}\" (claims: {$claimCount})\n";

    if (!$dryRun) {
        saveFunFact($pdo, $sid, $sci, $funFact);
        saveClaims($pdo, $sid, $sci, $funFact['claims'] ?? [], $funFact['source'] ?? 'unknown');
        fetchWikidataProperties($sci, $pdo, $sid);
        // knowledge_coverage を更新
        try {
            $db->refreshKnowledgeCoverage($sci);
        } catch (\Throwable $e) { /* non-fatal */ }
    }
    $processed[] = $sci;
    $done++;
    saveCheckpoint($processed, $errors);

    if ($limit > 0 && ($done + $skip) >= $limit) {
        echo "\n--limit={$limit} に達しました\n";
        break;
    }
}

echo "\n完了: {$done}件生成 / {$skip}件スキップ / {$err}件失敗\n";
echo "チェックポイント: " . FF_CHECKPOINT . "\n";
