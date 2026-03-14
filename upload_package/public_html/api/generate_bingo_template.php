<?php

header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/DataStore.php';
require_once __DIR__ . '/../../libs/EventManager.php';
require_once __DIR__ . '/../../libs/SiteManager.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    echo json_encode(['success' => false, 'message' => 'ログインが必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

function fallback_bingo_species(): array
{
    return ['鳥類', '昆虫', '植物', 'キノコ', 'クモの仲間', 'チョウ', 'トンボ', '木の実', '野草'];
}

function extract_observation_species(array $obs): ?array
{
    $taxon = $obs['taxon'] ?? [];
    $name = trim((string)($taxon['name'] ?? ($obs['identifications'][0]['taxon_name'] ?? ($obs['species_name'] ?? ''))));
    if ($name === '') {
        return null;
    }

    $key = trim((string)($taxon['key'] ?? ($obs['identifications'][0]['taxon_key'] ?? $name)));
    return [
        'key' => $key !== '' ? $key : $name,
        'name' => $name,
    ];
}

function build_species_from_event(array $event): array
{
    $siteId = $event['location']['site_id'] ?? ($event['site_id'] ?? '');
    if ($siteId === '') {
        return [];
    }

    $speciesMap = [];
    foreach (SiteManager::getObservationsInSite($siteId) as $obs) {
        $species = extract_observation_species($obs);
        if ($species === null) {
            continue;
        }

        $key = $species['key'];
        if (!isset($speciesMap[$key])) {
            $speciesMap[$key] = ['name' => $species['name'], 'count' => 0];
        }
        $speciesMap[$key]['count']++;
    }

    if (empty($speciesMap)) {
        return [];
    }

    $speciesList = array_values($speciesMap);
    usort($speciesList, fn(array $a, array $b): int => $b['count'] <=> $a['count']);

    $half = (int)ceil(count($speciesList) / 2);
    $easy = array_slice($speciesList, 0, $half);
    $hard = array_slice($speciesList, $half);

    shuffle($easy);
    shuffle($hard);

    $selected = array_merge(
        array_slice($easy, 0, min(4, count($easy))),
        array_slice($hard, 0, min(4, count($hard)))
    );

    foreach ($speciesList as $entry) {
        if (count($selected) >= 8) {
            break;
        }
        $exists = false;
        foreach ($selected as $picked) {
            if ($picked['name'] === $entry['name']) {
                $exists = true;
                break;
            }
        }
        if (!$exists) {
            $selected[] = $entry;
        }
    }

    $names = array_values(array_map(fn(array $entry): string => $entry['name'], $selected));
    while (count($names) < 8) {
        foreach (fallback_bingo_species() as $fallback) {
            if (!in_array($fallback, $names, true)) {
                $names[] = $fallback;
            }
            if (count($names) >= 8) {
                break;
            }
        }
    }

    shuffle($names);
    return array_slice($names, 0, 8);
}

function build_species_with_ai(float $lat, float $lng, string $locationName, string $eventDate): array
{
    $fallback = ['タンポポ', 'モンシロチョウ', 'ツバメ', 'スズメ', 'シロツメクサ', 'ダンゴムシ', 'アリンコ', 'テントウムシ'];

    if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') {
        return $fallback;
    }

    $month = date('n', strtotime($eventDate));
    $prompt = <<<PROMPT
あなたは自然観察イベントの案内人です。
開催地と時期に合う、生きものビンゴ向けの生き物名を8個だけ JSON 配列で返してください。

開催地: {$locationName} (緯度: {$lat}, 経度: {$lng})
開催日: {$eventDate} ({$month}月)

条件:
- 日本語のわかりやすい名前
- 初心者でも見つけやすい候補を中心にする
- 鳥、昆虫、植物などを少し混ぜる
- JSON配列のみを返す
PROMPT;

    $url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' . GEMINI_API_KEY;
    $payload = [
        'contents' => [[
            'parts' => [['text' => $prompt]],
        ]],
        'generationConfig' => [
            'temperature' => 0.4,
            'maxOutputTokens' => 180,
            'responseMimeType' => 'application/json',
        ],
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $httpCode !== 200) {
        return $fallback;
    }

    $decoded = json_decode($response, true);
    $text = trim((string)($decoded['candidates'][0]['content']['parts'][0]['text'] ?? ''));
    $text = preg_replace('/^```(?:json)?\s*/', '', $text);
    $text = preg_replace('/\s*```$/', '', (string)$text);
    $parsed = json_decode((string)$text, true);

    if (!is_array($parsed)) {
        return $fallback;
    }

    $species = [];
    foreach ($parsed as $name) {
        $name = trim((string)$name);
        if ($name === '' || in_array($name, $species, true)) {
            continue;
        }
        $species[] = $name;
        if (count($species) >= 8) {
            break;
        }
    }

    return count($species) >= 8 ? $species : $fallback;
}

if (session_status() !== PHP_SESSION_ACTIVE) {
    session_start();
}
$now = time();
$rateKey = '_bingo_gen_timestamps';
$_SESSION[$rateKey] = array_filter($_SESSION[$rateKey] ?? [], fn($t) => $t > ($now - 60));
if (count($_SESSION[$rateKey]) >= 5) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'リクエストが多すぎます。1分後に再試行してください。'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}
$_SESSION[$rateKey][] = $now;

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$eventId = trim((string)($input['event_id'] ?? ($_GET['event_id'] ?? '')));
$event = null;

if ($eventId !== '') {
    $event = EventManager::get($eventId);
    if (!$event) {
        echo json_encode(['success' => false, 'message' => 'イベントが見つかりません'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }
}

if ($event) {
    $species = build_species_from_event($event);
    if (empty($species)) {
        $lat = (float)($event['location']['lat'] ?? 0);
        $lng = (float)($event['location']['lng'] ?? 0);
        $locationName = trim((string)($event['location']['name'] ?? '指定なし'));
        $eventDate = trim((string)($event['event_date'] ?? date('Y-m-d')));
        $species = ($lat && $lng)
            ? build_species_with_ai($lat, $lng, $locationName, $eventDate)
            : fallback_bingo_species();
    }
} else {
    $lat = (float)($input['lat'] ?? 0);
    $lng = (float)($input['lng'] ?? 0);
    $locationName = trim((string)($input['location_name'] ?? '指定なし'));
    $eventDate = trim((string)($input['event_date'] ?? date('Y-m-d')));

    if (!$lat || !$lng) {
        echo json_encode(['success' => false, 'message' => '位置情報が必要です'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
        exit;
    }

    $species = build_species_with_ai($lat, $lng, $locationName, $eventDate);
}

$templateId = uniqid('btpl_');
$templateData = [
    'id' => $templateId,
    'cells' => array_values($species),
    'created_at' => date('c'),
    'created_by' => Auth::user()['id'] ?? '',
    'event_id' => $event['id'] ?? null,
];

DataStore::save('bingo_templates/' . $templateId, $templateData);

echo json_encode([
    'success' => true,
    'template_id' => $templateId,
    'cells' => array_values($species),
], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
