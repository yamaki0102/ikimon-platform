<?php

/**
 * 地域統計API — 世界展開対応アーキテクチャ
 * 
 * GET /api/region_stats.php?region=jp_shizuoka&city=shizuoka
 * 
 * 設計原則:
 * - ハードコード排除: 全データは data/regions/*.json から読み込み
 * - bbox座標フィルタリング: 観察データの lat/lng で地域を判定
 * - キャッシュ: DataStore::getCached() で5分TTL
 * - 世界展開: JSON設定ファイルを追加するだけで新地域に対応
 */
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/DataStore.php';

header('Content-Type: application/json; charset=utf-8');

// --- パラメータ取得 ---
$region_id = $_GET['region'] ?? 'jp_shizuoka';
$city_id   = $_GET['city']   ?? null;
$lang      = $_GET['lang']   ?? 'ja';

// --- 後方互換: 旧API (region=shizuoka) → 新API (region=jp_shizuoka, city=shizuoka) に変換 ---
$legacy_map = [
    'shizuoka'  => ['region' => 'jp_shizuoka', 'city' => 'shizuoka'],
    'hamamatsu' => ['region' => 'jp_shizuoka', 'city' => 'hamamatsu'],
    'fujieda'   => ['region' => 'jp_shizuoka', 'city' => 'fujieda'],
    'yaizu'     => ['region' => 'jp_shizuoka', 'city' => 'yaizu'],
    'iwata'     => ['region' => 'jp_shizuoka', 'city' => 'iwata'],
    'numazu'    => ['region' => 'jp_shizuoka', 'city' => 'numazu'],
    'fuji'      => ['region' => 'jp_shizuoka', 'city' => 'fuji'],
    'default'   => ['region' => 'jp_shizuoka', 'city' => 'shizuoka'],
];

if (isset($legacy_map[$region_id])) {
    $mapped = $legacy_map[$region_id];
    $region_id = $mapped['region'];
    if (!$city_id) $city_id = $mapped['city'];
}

// --- 地域設定ファイル読み込み ---
$region_file = DATA_DIR . '/regions/' . basename($region_id) . '.json';
if (!file_exists($region_file)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'error' => "Region not found: {$region_id}"], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$region_config = json_decode(file_get_contents($region_file), true);
if (!$region_config || !isset($region_config['cities'])) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Invalid region config'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

// city_id が未指定 or 不正なら最初の市を使う
$cities = $region_config['cities'];
if (!$city_id || !isset($cities[$city_id])) {
    $city_id = array_key_first($cities);
}

$city_config = $cities[$city_id];
$bbox = $city_config['bbox']; // [south_lat, west_lng, north_lat, east_lng]
$estimated = $city_config['estimated_species'];

// --- 多言語ラベル解決 ---
function resolve_label($obj, $lang = 'ja')
{
    if (is_string($obj)) return $obj;
    return $obj[$lang] ?? $obj['ja'] ?? $obj['en'] ?? '';
}

$group_labels = $region_config['group_labels'] ?? [];

// --- キャッシュキー ---
$cache_key = "region_stats_{$region_id}_{$city_id}";

try {
    $result = DataStore::getCached($cache_key, 300, function () use ($bbox, $estimated, $group_labels, $cities, $city_id, $region_config, $lang) {
        $observations = DataStore::fetchAll('observations');

        // --- bbox フィルタリング ---
        $species_set = [];
        $monthly_counts = [];
        $total_observations = 0;
        $observers = [];

        foreach ($observations as $obs) {
            $lat = (float)($obs['lat'] ?? 0);
            $lng = (float)($obs['lng'] ?? 0);

            // bbox判定: [south_lat, west_lng, north_lat, east_lng]
            if ($lat < $bbox[0] || $lat > $bbox[2] || $lng < $bbox[1] || $lng > $bbox[3]) {
                continue; // この市の範囲外
            }

            $total_observations++;

            // ユニーク種
            $taxon_name = $obs['taxon']['name'] ?? $obs['species_name'] ?? $obs['taxon_name'] ?? '';
            if (!empty($taxon_name)) {
                $species_set[$taxon_name] = true;
            }

            // ユニーク観察者
            if (!empty($obs['user_id'])) {
                $observers[$obs['user_id']] = true;
            }

            // 月別カウント
            $month = substr($obs['observed_at'] ?? $obs['created_at'] ?? '', 0, 7);
            if ($month) {
                $monthly_counts[$month] = ($monthly_counts[$month] ?? 0) + 1;
            }
        }

        $confirmed_species = count($species_set);
        $estimated_total = array_sum($estimated);
        $completion = min(100, round(($confirmed_species / max(1, $estimated_total)) * 100, 1));

        // --- 分類群別内訳 ---
        $group_detail = [];
        foreach ($estimated as $key => $count) {
            $label_obj = $group_labels[$key] ?? $key;
            $group_detail[] = [
                'key'       => $key,
                'label'     => resolve_label($label_obj, $lang),
                'estimated' => $count,
            ];
        }

        // --- 今月の新規 ---
        $current_month = date('Y-m');
        $this_month_count = $monthly_counts[$current_month] ?? 0;

        // --- 前月 ---
        $prev_month = date('Y-m', strtotime('-1 month'));
        $prev_month_count = $monthly_counts[$prev_month] ?? 0;

        // --- 近隣エリア比較（実データ: 他の市のbboxでもカウント） ---
        $nearby_areas = [];
        foreach ($cities as $other_id => $other_city) {
            if ($other_id === $city_id) continue;
            if (count($nearby_areas) >= 4) break;

            $other_bbox = $other_city['bbox'];
            $other_species = [];
            $other_obs_count = 0;

            foreach ($observations as $obs) {
                $lat = (float)($obs['lat'] ?? 0);
                $lng = (float)($obs['lng'] ?? 0);
                if ($lat < $other_bbox[0] || $lat > $other_bbox[2] || $lng < $other_bbox[1] || $lng > $other_bbox[3]) {
                    continue;
                }
                $other_obs_count++;
                $taxon = $obs['taxon']['name'] ?? $obs['species_name'] ?? '';
                if (!empty($taxon)) $other_species[$taxon] = true;
            }

            $other_estimated = array_sum($other_city['estimated_species']);
            $other_confirmed = count($other_species);
            $other_completion = min(100, round(($other_confirmed / max(1, $other_estimated)) * 100, 1));

            $nearby_areas[] = [
                'id'         => $other_id,
                'name'       => resolve_label($other_city['name'], $lang),
                'completion' => $other_completion,
                'species'    => $other_confirmed,
            ];
        }

        // --- 月別推移（直近6ヶ月） ---
        $trend = [];
        for ($i = 5; $i >= 0; $i--) {
            $m = date('Y-m', strtotime("-{$i} months"));
            $trend[] = [
                'month' => $m,
                'label' => date('n月', strtotime("-{$i} months")),
                'count' => $monthly_counts[$m] ?? 0,
            ];
        }

        return [
            'confirmed_species'       => $confirmed_species,
            'estimated_species'       => $estimated_total,
            'completion_percent'      => $completion,
            'species_breakdown'       => $group_detail,
            'source'                  => resolve_label($region_config['source'] ?? '', $lang),
            'note'                    => resolve_label($region_config['note'] ?? '', $lang),
            'total_observations'      => $total_observations,
            'total_observers'         => count($observers),
            'this_month_observations' => $this_month_count,
            'prev_month_observations' => $prev_month_count,
            'nearby_areas'            => $nearby_areas,
            'monthly_trend'           => $trend,
            'region_id'               => null, // filled outside
            'city_id'                 => null,
        ];
    });

    // キャッシュ外のメタデータを追加
    $result['region_id'] = $region_id;
    $result['city_id']   = $city_id;
    $result['city_name'] = resolve_label($city_config['name'], $lang);

    echo json_encode([
        'success' => true,
        'data'    => $result,
    ], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
}
