<?php

/**
 * API v2: Session Recap — セッション完了時のリッチ振り返りデータ
 *
 * POST /api/v2/session_recap.php
 *   - species:      [{name, scientific_name, confidence, count}]
 *   - duration_sec:  セッション秒数
 *   - distance_m:    移動距離
 *   - lat, lng:      中心座標
 *   - scan_mode:     walk|live-scan
 *
 * Returns: { narrative, species_cards[], contribution, rank_progress }
 */

require_once __DIR__ . '/bootstrap.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/DataStore.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    api_error('Unauthorized', 401);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    api_error('POST required', 405);
}

if (!api_rate_limit('session_recap', 5, 60)) {
    api_error('Rate limit exceeded', 429);
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    api_error('Invalid JSON', 400);
}

$species = $input['species'] ?? [];
$durationSec = intval($input['duration_sec'] ?? 0);
$distanceM = intval($input['distance_m'] ?? 0);
$lat = floatval($input['lat'] ?? 0);
$lng = floatval($input['lng'] ?? 0);
$scanMode = $input['scan_mode'] ?? 'walk';
$hour = isset($input['hour']) ? intval($input['hour']) : intval(date('G'));
$weather = $input['weather'] ?? null;

if (empty($species)) {
    api_success([
        'narrative' => 'お疲れさまでした！今回は検出がありませんでしたが、フィールドに出ることが大切です。',
        'species_cards' => [],
        'contribution' => [],
        'rank_progress' => null,
    ]);
}

// --- Species cards from OmoikaneDB ---
$speciesCards = [];
try {
    require_once ROOT_DIR . '/libs/OmoikaneSearchEngine.php';
    $engine = new OmoikaneSearchEngine();

    foreach (array_slice($species, 0, 10) as $sp) {
        $sciName = $sp['scientific_name'] ?? '';
        $jaName = $sp['name'] ?? '';
        $card = ['name' => $jaName, 'scientific_name' => $sciName, 'confidence' => $sp['confidence'] ?? 0, 'count' => $sp['count'] ?? 1];

        if ($sciName) {
            $resolved = $engine->resolveByScientificName($sciName);
            if ($resolved && !empty($resolved['japanese_name'])) {
                $card['name'] = $resolved['japanese_name'];
            }
        }

        if ($sciName) {
            $traits = $engine->getTraitsByScientificName($sciName);
            if ($traits) {
                $card['habitat'] = $traits['habitat'] ?? null;
                $card['season'] = $traits['season'] ?? null;
                $card['morphological_traits'] = $traits['morphological_traits'] ?? null;
                $card['notes'] = $traits['notes'] ?? null;
                $card['similar_species'] = $traits['similar_species'] ?? null;
            }
        }

        $speciesCards[] = $card;
    }
} catch (Throwable $e) {
    error_log("[session_recap] Omoikane error: " . $e->getMessage());
}

// --- GeoContext: 地理的環境文脈 ---
$geoContrib = null;
$geoLabel = '';
if ($lat && $lng) {
    try {
        require_once ROOT_DIR . '/libs/GeoContext.php';
        $geoContrib = GeoContext::getContributionContext($lat, $lng);
        $geoCtx = GeoContext::getContext($lat, $lng);
        $geoLabel = $geoCtx['environment_label'] ?? '';
    } catch (Throwable $e) {
        error_log("[session_recap] GeoContext error: " . $e->getMessage());
    }
}

// --- Contribution metrics (文脈依存8パターン + 地理) ---
$contribution = [];
$userId = Auth::user()['id'] ?? '';
$month = date('Y-m');
$currentMonth = date('n') . '月';

try {
    $allObs = DataStore::fetchAll('observations');

    // (1) この場所が初スキャンかチェック（500m圏内）
    $nearbyObs = [];
    if ($lat && $lng) {
        foreach ($allObs as $o) {
            $oLat = floatval($o['location']['lat'] ?? $o['lat'] ?? 0);
            $oLng = floatval($o['location']['lng'] ?? $o['lng'] ?? 0);
            if ($oLat && $oLng && abs($oLat - $lat) < 0.005 && abs($oLng - $lng) < 0.005) {
                $nearbyObs[] = $o;
            }
        }
    }

    if (empty($nearbyObs)) {
        $contribution[] = [
            'icon' => '🗺️',
            'text' => 'この場所は初めてスキャンされました！ 生物多様性の空白地帯を埋めています',
            'highlight' => true,
        ];
    } else {
        // (2) 前回スキャンからの間隔
        $dates = array_filter(array_map(fn($o) => $o['observed_at'] ?? $o['created_at'] ?? '', $nearbyObs));
        if (!empty($dates)) {
            sort($dates);
            $lastDate = end($dates);
            $daysSince = (time() - strtotime($lastDate)) / 86400;
            if ($daysSince > 14) {
                $weeks = max(1, round($daysSince / 7));
                $contribution[] = [
                    'icon' => '📅',
                    'text' => "前回のスキャンは{$weeks}週間前。季節変化の追跡に貢献しています",
                ];
            }
        }
    }

    // (3) 天候データの価値
    if ($weather && in_array($weather, ['rain', 'cloudy', 'snow', 'fog'])) {
        $weatherLabels = ['rain' => '雨', 'cloudy' => '曇り', 'snow' => '雪', 'fog' => '霧'];
        $wLabel = $weatherLabels[$weather] ?? $weather;
        $contribution[] = [
            'icon' => '🌧️',
            'text' => "{$wLabel}の日のデータは貴重です。天候と生物活動の関係を記録しています",
        ];
    }

    // (4) 時間帯データの価値
    if ($hour < 7) {
        $contribution[] = ['icon' => '🌅', 'text' => '早朝のデータは少なく貴重です。時間帯別の生物活動パターンに貢献'];
    } elseif ($hour >= 18) {
        $contribution[] = ['icon' => '🌆', 'text' => '夕方以降のデータは少なく貴重です。夜行性生物の記録に貢献'];
    }

    // (5) 月間データ密度の向上
    $monthObs = array_filter($allObs, function($o) use ($month) {
        return str_starts_with($o['observed_at'] ?? $o['created_at'] ?? '', $month);
    });
    $beforeCount = count($monthObs);
    $afterCount = $beforeCount + count($species);
    $contribution[] = [
        'icon' => '📊',
        'text' => "{$currentMonth}の地域データが {$beforeCount}件 → {$afterCount}件 に。統計的な信頼性が高まりました",
    ];

    // (6) 植生記録の価値
    $plantCount = count(array_filter($species, fn($s) => ($s['category'] ?? '') === 'plant'));
    if ($plantCount > 0) {
        $contribution[] = [
            'icon' => '🌳',
            'text' => "植生 {$plantCount} 件を記録。森の健康状態モニタリングの基盤データです",
        ];
    }

    // (7) 初記録チェック（既存ロジック維持）
    $existingSpecies = array_unique(array_filter(array_map(
        fn($o) => $o['taxon']['scientific_name'] ?? $o['taxon']['name'] ?? null,
        $allObs
    )));

    foreach ($species as $sp) {
        $key = $sp['scientific_name'] ?? $sp['name'];
        if ($key && !in_array($key, $existingSpecies)) {
            $contribution[] = [
                'icon' => '🌟',
                'text' => ($sp['name'] ?? $key) . ' はこの地点で初記録です！',
                'highlight' => true,
            ];
        }
    }

    // (8) ユーザー累計貢献
    $userObs = array_filter($allObs, fn($o) => ($o['user_id'] ?? '') === $userId);
    $totalUserCount = count($userObs) + count($species);
    $contribution[] = [
        'icon' => '🏅',
        'text' => "キミの累計データ: {$totalUserCount}件。この地域の生態系理解に着実に貢献中",
    ];

    // (9) 地理的環境文脈による貢献メッセージ
    if ($geoContrib) {
        $contribution[] = $geoContrib;
    }
} catch (Throwable $e) {
    error_log("[session_recap] Contribution error: " . $e->getMessage());
    $contribution[] = [
        'icon' => '📊',
        'text' => count($species) . ' 件の観察データを記録しました',
    ];
}

// --- AI Narrative ---
$narrative = '';
try {
    if (defined('GEMINI_API_KEY') && GEMINI_API_KEY && count($speciesCards) > 0) {
        $speciesNames = array_map(fn($c) => $c['name'], $speciesCards);
        $namesList = implode('、', $speciesNames);
        $durationMin = round($durationSec / 60);
        $distanceKm = round($distanceM / 1000, 1);

        $plantNames = array_map(fn($c) => $c['name'], array_filter($speciesCards, fn($c) => ($c['category'] ?? '') === 'plant' || preg_match('/広葉|落葉|常緑|針葉|草本|低木|高木|シダ|つる/', $c['name'])));
        $plantNote = count($plantNames) > 0 ? "\n- 植生記録: " . implode('、', array_slice($plantNames, 0, 3)) . "（植生データは生態系の基盤記録として重要）" : '';
        $currentMonth = date('n');

        $geoNote = $geoLabel ? "\n- 観察地点の環境: {$geoLabel}" : '';

        $narrativePrompt = <<<PROMPT
あなたは自然観察の仲間です。以下の観察セッションについて、参加者への振り返りを書いてください。

- 観察モード: {$scanMode}
- 時間: {$durationMin}分、距離: {$distanceKm}km
- 検出種: {$namesList}{$plantNote}{$geoNote}

要件:
1. 最も印象的な発見について「へぇ！」と思える豆知識を1つ
2. 観察地点の環境（公園、水辺、森林等）と検出種の関係に触れる
3. 植生レベルの記録（広葉樹等）があれば、なぜその記録が大切かを1文
4. 季節（{$currentMonth}月）との関連
5. 温かく前向き、対等なトーン（先生→生徒ではなく仲間として）
6. 300字以内
PROMPT;

        $model = 'gemini-3.1-flash-lite-preview';
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . $model . ':generateContent?key=' . GEMINI_API_KEY;
        $payload = [
            'contents' => [['parts' => [['text' => $narrativePrompt]]]],
            'generationConfig' => ['temperature' => 0.7, 'maxOutputTokens' => 350],
        ];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($payload),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ]);
        $resp = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode === 200 && $resp) {
            $result = json_decode($resp, true);
            $narrative = $result['candidates'][0]['content']['parts'][0]['text'] ?? '';
            $narrative = trim($narrative);
        }
    }
} catch (Throwable $e) {
    error_log("[session_recap] Narrative error: " . $e->getMessage());
}

if (!$narrative) {
    $count = count($species);
    $min = round($durationSec / 60);
    $narrative = "{$min}分の観察で{$count}種を検出しました。フィールドに出て自然と向き合う時間が、地域の生物多様性データを豊かにしていきます。";
}

// --- Gamification progress ---
$rankProgress = null;
try {
    require_once ROOT_DIR . '/libs/Gamification.php';
    $gamResult = Gamification::syncUserStats($userId);
    if ($gamResult) {
        $rankProgress = [
            'current_rank' => $gamResult['rank'] ?? null,
            'score' => $gamResult['total_score'] ?? 0,
            'badges_earned' => $gamResult['new_badges'] ?? [],
            'rank_up' => $gamResult['rank_changed'] ?? false,
        ];
    }
} catch (Throwable $e) {
    error_log("[session_recap] Gamification error: " . $e->getMessage());
}

api_success([
    'narrative' => $narrative,
    'species_cards' => $speciesCards,
    'contribution' => $contribution,
    'rank_progress' => $rankProgress,
    'ai_disclaimer' => true,
]);
