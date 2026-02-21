<?php

/**
 * 探索マップAPI — 地域の観察カバレッジ統計を返す
 * 
 * Parameters:
 *   region  = jp_shizuoka (default) — 地域ファイルID
 *   city    = (optional) — 市区町村スラッグ (e.g. hamamatsu, shizuoka)
 *   lang    = ja|en (default: ja)
 * 
 * Response JSON:
 *   total_observations  — 総観察件数
 *   observed_species    — 記録済みユニーク種数
 *   estimated_species   — 推定種数（地域データ参照）
 *   monthly_trend       — 月別推移（直近12ヶ月）
 *   recent_discoveries  — 直近の新規記録種
 *   top_observers       — 貢献者ランキング（上位5名）
 *   cities              — 各市区町村の概要統計
 */

require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/DataStore.php';
require_once ROOT_DIR . '/libs/Cache.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$regionId = $_GET['region'] ?? 'jp_shizuoka';
$citySlug = $_GET['city'] ?? '';
$lang = ($_GET['lang'] ?? 'ja') === 'en' ? 'en' : 'ja';

// --- 1. Load Region Definition ---
/** @var array{name: array<string,string>, cities: array<string, array{name: array<string,string>, bbox: array{0: float, 1: float, 2: float, 3: float}, estimated_species: list<int>}>} $region */
$regionFile = DATA_DIR . '/regions/' . basename($regionId) . '.json';
if (!file_exists($regionFile)) {
    http_response_code(404);
    echo json_encode(['error' => 'Region not found', 'region' => $regionId], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}
$region = json_decode(file_get_contents($regionFile), true);
$cities = $region['cities'] ?? [];

// Filter to specific city if requested
if ($citySlug && isset($cities[$citySlug])) {
    $cities = [$citySlug => $cities[$citySlug]];
}

// --- 2. Get Observations (cached 10 min) ---
$cacheKey = "exploration_stats_{$regionId}";
$stats = DataStore::getCached($cacheKey, 600, function () use ($cities, $lang, $region) {
    $allObs = DataStore::fetchAll('observations');

    return buildExplorationStats($allObs, $cities, $lang, $region);
});

// If specific city requested, return only that city's detail
if ($citySlug && isset($stats['cities'][$citySlug])) {
    $cityDetail = $stats['cities'][$citySlug];
    $cityDetail['region_name'] = $region['name'][$lang] ?? $region['name']['ja'];
    echo json_encode($cityDetail, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);
    exit;
}

echo json_encode($stats, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG);

// ===================================================================
// Core Stats Builder
// ===================================================================

function buildExplorationStats(array $observations, array $cities, string $lang, array $region): array
{
    $now = time();
    $twelveMonthsAgo = strtotime('-12 months');

    // Per-city accumulators
    /** @var array<string, array{
     *   name: string,
     *   bbox: array{0: float, 1: float, 2: float, 3: float},
     *   observations: int,
     *   species_set: array<string, array{name: string, scientific: string}>,
     *   observers: array<string, array{name: string, count: int}>,
     *   monthly: array<string, int>,
     *   first_seen: array<string, int>,
     *   estimated_species: int,
     *   estimated_by_group: array<mixed>
     * }> $cityStats */
    $cityStats = [];
    foreach ($cities as $slug => $cityDef) {
        $cityStats[$slug] = [
            'name' => $cityDef['name'][$lang] ?? $cityDef['name']['ja'],
            'bbox' => $cityDef['bbox'],
            'observations' => 0,
            'species_set' => [],     // taxon_key => name
            'observers' => [],       // user_id => [name, count]
            'monthly' => [],         // YYYY-MM => count
            'first_seen' => [],      // taxon_key => timestamp (earliest record)
        ];
        // Initialize estimated_species total
        $est = $cityDef['estimated_species'] ?? [];
        $cityStats[$slug]['estimated_species'] = array_sum($est);
        $cityStats[$slug]['estimated_by_group'] = $est;
    }

    // Global accumulators
    $globalSpecies = [];
    $globalObservers = [];
    $globalMonthly = [];
    $globalFirstSeen = [];
    $totalObs = 0;

    // --- Scan all observations ---
    foreach ($observations as $obs) {
        $lat = $obs['lat'] ?? null;
        $lng = $obs['lng'] ?? null;
        $taxonKey = $obs['taxon']['key'] ?? null;
        $taxonName = $obs['taxon']['name'] ?? '不明';
        $sciName = $obs['taxon']['scientific_name'] ?? '';
        $userId = $obs['user_id'] ?? 'unknown';
        $userName = $obs['user_name'] ?? '匿名';
        $observedAt = $obs['observed_at'] ?? $obs['created_at'] ?? '';
        $ts = strtotime($observedAt);

        if (!$lat || !$lng || !$taxonKey) continue;

        // Month key
        $monthKey = date('Y-m', $ts);

        // Global
        $totalObs++;
        $globalSpecies[$taxonKey] = ['name' => $taxonName, 'scientific' => $sciName];
        $globalMonthly[$monthKey] = ($globalMonthly[$monthKey] ?? 0) + 1;
        if (!isset($globalObservers[$userId])) {
            $globalObservers[$userId] = ['name' => $userName, 'count' => 0];
        }
        $globalObservers[$userId]['count']++;
        if (!isset($globalFirstSeen[$taxonKey]) || $ts < $globalFirstSeen[$taxonKey]) {
            $globalFirstSeen[$taxonKey] = $ts;
        }

        // Per-city (bbox check: [south, west, north, east])
        foreach ($cityStats as $slug => &$cs) {
            $bbox = $cs['bbox'];
            if (!isset($bbox[0], $bbox[1], $bbox[2], $bbox[3])) continue;
            if ($lat >= $bbox[0] && $lat <= $bbox[2] && $lng >= $bbox[1] && $lng <= $bbox[3]) {
                $cs['observations']++;
                $cs['species_set'][$taxonKey] = ['name' => $taxonName, 'scientific' => $sciName];
                if (!isset($cs['observers'][$userId])) {
                    $cs['observers'][$userId] = ['name' => $userName, 'count' => 0];
                }
                $cs['observers'][$userId]['count']++;
                $cs['monthly'][$monthKey] = ($cs['monthly'][$monthKey] ?? 0) + 1;
                if (!isset($cs['first_seen'][$taxonKey]) || $ts < $cs['first_seen'][$taxonKey]) {
                    $cs['first_seen'][$taxonKey] = $ts;
                }
                break; // One city per observation
            }
        }
        unset($cs);
    }

    // --- Build response ---
    $totalEstimated = 0;
    foreach ($cities as $slug => $def) {
        $totalEstimated += array_sum($def['estimated_species'] ?? []);
    }

    // Monthly trend (last 12 months, sorted)
    $monthlyTrend = buildMonthlyTrend($globalMonthly);

    // Recent discoveries (last 30 days, species first seen)
    $recentThreshold = strtotime('-30 days');
    $recentDiscoveries = [];
    foreach ($globalFirstSeen as $key => $ts) {
        if ($ts >= $recentThreshold && isset($globalSpecies[$key])) {
            $recentDiscoveries[] = [
                'name' => $globalSpecies[$key]['name'],
                'scientific_name' => $globalSpecies[$key]['scientific'],
                'discovered_at' => date('Y-m-d', $ts),
            ];
        }
    }
    usort($recentDiscoveries, fn($a, $b) => strcmp($b['discovered_at'], $a['discovered_at']));
    $recentDiscoveries = array_slice($recentDiscoveries, 0, 10);

    // Top observers
    uasort($globalObservers, fn($a, $b) => $b['count'] - $a['count']);
    $topObservers = [];
    $rank = 0;
    foreach ($globalObservers as $uid => $data) {
        if (++$rank > 5) break;
        $topObservers[] = [
            'rank' => $rank,
            'name' => $data['name'],
            'observations' => $data['count'],
        ];
    }

    // Month-over-month change
    $currentMonth = date('Y-m');
    $lastMonth = date('Y-m', strtotime('-1 month'));
    $currentCount = $globalMonthly[$currentMonth] ?? 0;
    $lastCount = $globalMonthly[$lastMonth] ?? 0;
    $momChange = $lastCount > 0 ? round(($currentCount - $lastCount) / $lastCount * 100, 1) : 0;

    // Per-city summary
    $citySummary = [];
    foreach ($cityStats as $slug => $cs) {
        $speciesCount = count($cs['species_set']);
        $citySummary[$slug] = [
            'name' => $cs['name'],
            'observed_species' => $speciesCount,
            'estimated_species' => $cs['estimated_species'],
            'total_observations' => $cs['observations'],
            'observer_count' => count($cs['observers']),
            'monthly_trend' => buildMonthlyTrend($cs['monthly']),
        ];

        // Recent discoveries for this city
        $cityRecent = [];
        foreach ($cs['first_seen'] as $key => $ts) {
            if ($ts >= $recentThreshold && isset($cs['species_set'][$key])) {
                $cityRecent[] = [
                    'name' => $cs['species_set'][$key]['name'],
                    'scientific_name' => $cs['species_set'][$key]['scientific'],
                    'discovered_at' => date('Y-m-d', $ts),
                ];
            }
        }
        usort($cityRecent, fn($a, $b) => strcmp($b['discovered_at'], $a['discovered_at']));
        $citySummary[$slug]['recent_discoveries'] = array_slice($cityRecent, 0, 5);

        // Top observers for this city
        uasort($cs['observers'], fn($a, $b) => $b['count'] - $a['count']);
        $cityTop = [];
        $r = 0;
        foreach ($cs['observers'] as $uid => $data) {
            if (++$r > 5) break;
            $cityTop[] = [
                'rank' => $r,
                'name' => $data['name'],
                'observations' => $data['count'],
            ];
        }
        $citySummary[$slug]['top_observers'] = $cityTop;
    }

    return [
        'region_id' => 'jp_shizuoka',
        'region_name' => $region['name'][$lang] ?? $region['name']['ja'],
        'total_observations' => $totalObs,
        'observed_species' => count($globalSpecies),
        'estimated_species' => $totalEstimated,
        'new_species_this_month' => $currentCount,
        'mom_change_percent' => $momChange,
        'monthly_trend' => $monthlyTrend,
        'recent_discoveries' => $recentDiscoveries,
        'top_observers' => $topObservers,
        'cities' => $citySummary,
        'generated_at' => date('c'),
    ];
}

/**
 * Build 12-month trend from monthly counts
 */
function buildMonthlyTrend(array $monthlyCounts): array
{
    $trend = [];
    for ($i = 11; $i >= 0; $i--) {
        $m = date('Y-m', strtotime("-{$i} months"));
        $trend[] = [
            'month' => $m,
            'observations' => $monthlyCounts[$m] ?? 0,
        ];
    }
    return $trend;
}
