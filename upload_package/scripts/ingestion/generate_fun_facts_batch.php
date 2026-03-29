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
define('FF_RATE_SLEEP_US', 900_000); // 0.9秒 = 約67req/min (Wikipedia推奨範囲内)
define('FF_CHECKPOINT',    DATA_DIR . 'library/fun_fact_progress.json');

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
    usleep(FF_RATE_SLEEP_US);
    $matchJson = httpGet($matchUrl);
    if (!$matchJson) return null;
    $match    = json_decode($matchJson, true);
    $usageKey = $match['usageKey'] ?? null;
    if (!$usageKey) return null;

    // Step2: Descriptions 取得
    $descUrl = FF_GBIF_API_BASE . "/species/{$usageKey}/descriptions?limit=5";
    usleep(FF_RATE_SLEEP_US);
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

// === Gemini で fun_fact 生成 ===
function generateFunFact(string $japaneseName, string $scientificName, string $context): ?array
{
    if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') return null;

    $displayName = $japaneseName ?: $scientificName;
    $prompt = <<<PROMPT
あなたは生物多様性プラットフォーム ikimon.life の豆知識生成エンジンです。

【対象生物】
和名: {$displayName}
学名: {$scientificName}

【収集した情報（Wikipedia・GBIF由来）】
{$context}

上記の情報のみを根拠に、この生き物について「へえ！」と声が出るような豆知識を1つ生成してください。

要件:
- body: 120文字以内の日本語
- 断定しない語尾（「〜とも言われています」「〜という特徴があります」「〜とされています」等）
- 視点の転換・意外な生態・名前の由来・他の生き物との関係 のどれかに絞る
- 収集した情報にない事実は書かない
- search_keyword: この豆知識をさらに調べるための日本語キーワード（例: "根粒菌 マメ科"）
- source: "wikipedia_ja" または "gbif" または "wikipedia_ja,gbif"（使ったソースを記載）

JSONのみ返してください:
{"body": "...", "search_keyword": "...", "source": "..."}
PROMPT;

    $url     = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=' . GEMINI_API_KEY;
    $request = [
        'contents'         => [['parts' => [['text' => $prompt]]]],
        'generationConfig' => [
            'temperature'      => 0.0,
            'maxOutputTokens'  => 200,
            'responseMimeType' => 'application/json',
            'responseSchema'   => [
                'type'       => 'OBJECT',
                'properties' => [
                    'body'           => ['type' => 'STRING'],
                    'search_keyword' => ['type' => 'STRING'],
                    'source'         => ['type' => 'STRING'],
                ],
                'required' => ['body', 'search_keyword', 'source'],
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

    // チェックポイントでスキップ
    if (in_array($sci, $processed, true)) {
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

    $context = implode("\n\n", array_filter([$wikiText, $gbifText]));
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

    echo "→ \"{$funFact['body']}\"\n";

    if (!$dryRun) {
        saveFunFact($pdo, $sid, $sci, $funFact);
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
