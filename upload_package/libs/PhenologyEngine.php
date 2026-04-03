<?php
declare(strict_types=1);

/**
 * PhenologyEngine — 種別出現確率モデル + フェノロジー異常検知
 *
 * 生態デジタルツインの予測層。
 * 過去の観測パターンから「今この場所でこの種が見られる確率」を推定し、
 * フェノロジーシフト（季節進行の異常）を検出する。
 *
 * モデル:
 * - 月別出現確率: Beta分布近似 (observed_months / total_months_with_effort)
 * - 気象補正: 気温・降水量による出現確率の調整（WeatherContextデータがある場合）
 * - 異常検知: 期待出現月に出現しない or 非期待月に出現 → anomaly flag
 */

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/SiteManager.php';

class PhenologyEngine
{
    private const EARTH_RADIUS_KM = 6371.0;
    private const SEARCH_RADIUS_KM = 5.0;

    /**
     * 指定地点における種別の出現確率マップを生成
     *
     * @param float $lat 緯度
     * @param float $lng 経度
     * @param int|null $targetMonth 対象月 (null = 現在月)
     * @return array species_name => { probability, confidence, phenology_phase, anomaly_flag }
     */
    public static function getPredictions(float $lat, float $lng, ?int $targetMonth = null): array
    {
        $targetMonth = $targetMonth ?? (int)date('n');
        $profiles = self::buildSpeciesProfiles($lat, $lng);

        $predictions = [];
        foreach ($profiles as $name => $profile) {
            $monthProb = $profile['month_probabilities'][$targetMonth] ?? 0;
            $weatherAdjusted = self::applyWeatherAdjustment($monthProb, $profile, $targetMonth);

            $confidence = self::calculateConfidence($profile);
            $phenoPhase = self::detectPhenophase($profile, $targetMonth);
            $anomaly = self::checkAnomaly($profile, $targetMonth);

            $predictions[$name] = [
                'probability' => round($weatherAdjusted, 3),
                'base_probability' => round($monthProb, 3),
                'confidence' => round($confidence, 3),
                'total_observations' => $profile['total_obs'],
                'phenology_phase' => $phenoPhase,
                'peak_months' => $profile['peak_months'],
                'anomaly' => $anomaly,
                'scientific_name' => $profile['scientific_name'],
                'group' => $profile['group'],
                'first_seen' => $profile['first_seen'],
                'last_seen' => $profile['last_seen'],
            ];
        }

        // Sort by probability descending
        uasort($predictions, fn($a, $b) => $b['probability'] <=> $a['probability']);

        return $predictions;
    }

    /**
     * 指定地点の全種の月別プロファイルを構築
     */
    private static function buildSpeciesProfiles(float $lat, float $lng): array
    {
        $observations = DataStore::fetchAll('observations');
        $species = [];

        foreach ($observations as $obs) {
            $oLat = (float)($obs['lat'] ?? 0);
            $oLng = (float)($obs['lng'] ?? 0);
            if (!$oLat || !$oLng) continue;

            $dist = self::haversineDistance($lat, $lng, $oLat, $oLng);
            if ($dist > self::SEARCH_RADIUS_KM) continue;

            $name = $obs['taxon']['name'] ?? null;
            if (!$name || $name === 'Unknown') continue;

            $observedAt = $obs['observed_at'] ?? $obs['created_at'] ?? '';
            if (!$observedAt) continue;

            $month = (int)date('n', strtotime($observedAt));
            $year = (int)date('Y', strtotime($observedAt));

            if (!isset($species[$name])) {
                $species[$name] = [
                    'scientific_name' => $obs['taxon']['scientific_name'] ?? '',
                    'group' => $obs['taxon']['group'] ?? 'その他',
                    'total_obs' => 0,
                    'month_counts' => array_fill(1, 12, 0),
                    'year_months' => [], // "YYYY-MM" => count
                    'years_observed' => [],
                    'weather_at_obs' => [],
                    'first_seen' => $observedAt,
                    'last_seen' => $observedAt,
                ];
            }

            $species[$name]['total_obs']++;
            $species[$name]['month_counts'][$month]++;
            $yearMonth = $year . '-' . str_pad((string)$month, 2, '0', STR_PAD_LEFT);
            $species[$name]['year_months'][$yearMonth] = ($species[$name]['year_months'][$yearMonth] ?? 0) + 1;
            $species[$name]['years_observed'][$year] = true;

            if ($observedAt < $species[$name]['first_seen']) $species[$name]['first_seen'] = $observedAt;
            if ($observedAt > $species[$name]['last_seen']) $species[$name]['last_seen'] = $observedAt;

            // Collect weather data for correlation
            if (!empty($obs['weather_context']['temperature_c'])) {
                $species[$name]['weather_at_obs'][] = [
                    'month' => $month,
                    'temperature_c' => $obs['weather_context']['temperature_c'],
                    'precipitation_mm' => $obs['weather_context']['precipitation_mm'] ?? 0,
                ];
            }
        }

        // Calculate derived fields
        foreach ($species as $name => &$profile) {
            $totalMonthObs = array_sum($profile['month_counts']);

            // Month probabilities (simple frequency-based)
            $profile['month_probabilities'] = [];
            for ($m = 1; $m <= 12; $m++) {
                $profile['month_probabilities'][$m] = $totalMonthObs > 0
                    ? $profile['month_counts'][$m] / $totalMonthObs
                    : 0;
            }

            // Peak months (top 3 by observation count)
            $sorted = $profile['month_counts'];
            arsort($sorted);
            $profile['peak_months'] = array_slice(array_keys($sorted), 0, 3);

            // Active months (any observations)
            $profile['active_months'] = array_keys(array_filter($profile['month_counts']));

            // Years span
            $profile['years_span'] = count($profile['years_observed']);

            // Temperature range from weather data
            if (!empty($profile['weather_at_obs'])) {
                $temps = array_column($profile['weather_at_obs'], 'temperature_c');
                $profile['temp_range'] = [
                    'min' => round(min($temps), 1),
                    'max' => round(max($temps), 1),
                    'mean' => round(array_sum($temps) / count($temps), 1),
                ];
            }
        }
        unset($profile);

        return $species;
    }

    /**
     * 気象データによる出現確率の補正
     *
     * 種が過去に観測された気温範囲外の場合、確率を下げる
     */
    private static function applyWeatherAdjustment(float $baseProb, array $profile, int $month): float
    {
        // No weather data = no adjustment
        if (empty($profile['temp_range'])) {
            return $baseProb;
        }

        // Rough monthly temperature expectations for Japan (central, sea level)
        $avgTemps = [
            1 => 5, 2 => 6, 3 => 10, 4 => 15, 5 => 20, 6 => 23,
            7 => 27, 8 => 28, 9 => 25, 10 => 19, 11 => 13, 12 => 8,
        ];

        $expectedTemp = $avgTemps[$month] ?? 15;
        $speciesMinTemp = $profile['temp_range']['min'];
        $speciesMaxTemp = $profile['temp_range']['max'];

        // If expected temperature is within species' observed range, no adjustment
        if ($expectedTemp >= $speciesMinTemp && $expectedTemp <= $speciesMaxTemp) {
            return $baseProb;
        }

        // Outside range: reduce probability proportionally
        $deviation = 0;
        if ($expectedTemp < $speciesMinTemp) {
            $deviation = $speciesMinTemp - $expectedTemp;
        } else {
            $deviation = $expectedTemp - $speciesMaxTemp;
        }

        $penalty = max(0, 1 - ($deviation / 15)); // 15°C deviation = zero probability
        return $baseProb * $penalty;
    }

    /**
     * 予測の信頼度
     *
     * 高い信頼度 = 多くの観測 × 複数年 × 一貫したパターン
     */
    private static function calculateConfidence(array $profile): float
    {
        $obsScore = min(1.0, $profile['total_obs'] / 20); // 20+ observations = max
        $yearScore = min(1.0, $profile['years_span'] / 3); // 3+ years = max

        // Pattern consistency: how peaked is the distribution
        $maxMonthPct = max($profile['month_probabilities']);
        $patternScore = min(1.0, $maxMonthPct * 3); // Strong seasonal pattern = high confidence

        return ($obsScore * 0.4 + $yearScore * 0.3 + $patternScore * 0.3);
    }

    /**
     * 種の現在のフェノフェーズ（季節的生活段階）を検出
     */
    private static function detectPhenophase(array $profile, int $month): string
    {
        $prob = $profile['month_probabilities'][$month] ?? 0;
        $maxProb = max($profile['month_probabilities']);
        $avgProb = array_sum($profile['month_probabilities']) / 12;

        if ($maxProb === 0) return 'no_data';
        if ($prob === 0) return 'absent';

        $ratio = $prob / $maxProb;
        if ($ratio >= 0.8) return 'peak';
        if ($ratio >= 0.4) return 'active';
        if ($prob > $avgProb) return 'emerging';
        return 'declining';
    }

    /**
     * フェノロジー異常検知
     *
     * 3つのタイプ:
     * 1. unexpected_presence: 非期待月に出現
     * 2. missing_expected: 期待月に不在（不在データがある場合）
     * 3. early_arrival / late_departure: ピーク時期のシフト
     */
    private static function checkAnomaly(array $profile, int $month): ?array
    {
        if ($profile['total_obs'] < 5) return null; // Not enough data

        $prob = $profile['month_probabilities'][$month] ?? 0;
        $peakMonths = $profile['peak_months'];
        $activeMonths = $profile['active_months'];

        // Check for early/late shift
        if (!empty($peakMonths)) {
            $expectedPeak = $peakMonths[0];
            $currentYear = (int)date('Y');
            $lastYearKey = ($currentYear - 1) . '-' . str_pad((string)$month, 2, '0', STR_PAD_LEFT);
            $thisYearKey = $currentYear . '-' . str_pad((string)$month, 2, '0', STR_PAD_LEFT);

            $lastYearObs = $profile['year_months'][$lastYearKey] ?? 0;
            $thisYearObs = $profile['year_months'][$thisYearKey] ?? 0;

            // If appearing earlier than historical peak
            if ($month < $expectedPeak && $thisYearObs > 0 && $prob < 0.1) {
                return [
                    'type' => 'early_arrival',
                    'expected_peak_month' => $expectedPeak,
                    'current_month' => $month,
                    'shift_months' => $expectedPeak - $month,
                    'severity' => 'low',
                ];
            }

            // Significant year-over-year change
            if ($lastYearObs > 0 && $thisYearObs === 0 && in_array($month, $activeMonths, true)) {
                return [
                    'type' => 'missing_expected',
                    'last_year_count' => $lastYearObs,
                    'this_year_count' => 0,
                    'severity' => 'medium',
                ];
            }
        }

        return null;
    }

    /**
     * サイト単位のフェノロジーサマリー
     * ダッシュボードでの表示用
     */
    public static function getSitePhenologySummary(string $siteId, ?int $targetMonth = null): array
    {
        $site = SiteManager::load($siteId);
        if (!$site) return [];

        $center = $site['center'];
        $lat = (float)($center[1] ?? $center['lat'] ?? 0);
        $lng = (float)($center[0] ?? $center['lng'] ?? 0);

        $predictions = self::getPredictions($lat, $lng, $targetMonth);

        // Summary stats
        $highProb = array_filter($predictions, fn($p) => $p['probability'] >= 0.5);
        $anomalies = array_filter($predictions, fn($p) => $p['anomaly'] !== null);
        $peakSpecies = array_filter($predictions, fn($p) => $p['phenology_phase'] === 'peak');
        $emergingSpecies = array_filter($predictions, fn($p) => $p['phenology_phase'] === 'emerging');

        return [
            'site_id' => $siteId,
            'target_month' => $targetMonth ?? (int)date('n'),
            'total_species_modeled' => count($predictions),
            'likely_present' => count($highProb),
            'at_peak' => count($peakSpecies),
            'emerging' => count($emergingSpecies),
            'anomalies_detected' => count($anomalies),
            'top_predictions' => array_slice($predictions, 0, 20, true),
            'anomaly_details' => $anomalies,
        ];
    }

    /**
     * 12か月分の出現カレンダーを生成（種単位）
     */
    public static function getSpeciesCalendar(float $lat, float $lng, string $speciesName): array
    {
        $profiles = self::buildSpeciesProfiles($lat, $lng);
        $profile = $profiles[$speciesName] ?? null;

        if (!$profile) {
            return ['found' => false];
        }

        $calendar = [];
        for ($m = 1; $m <= 12; $m++) {
            $calendar[$m] = [
                'month' => $m,
                'probability' => round($profile['month_probabilities'][$m] ?? 0, 3),
                'observation_count' => $profile['month_counts'][$m] ?? 0,
                'phenophase' => self::detectPhenophase($profile, $m),
                'is_peak' => in_array($m, $profile['peak_months'], true),
            ];
        }

        return [
            'found' => true,
            'species_name' => $speciesName,
            'scientific_name' => $profile['scientific_name'],
            'group' => $profile['group'],
            'total_observations' => $profile['total_obs'],
            'years_observed' => $profile['years_span'],
            'temp_range' => $profile['temp_range'] ?? null,
            'calendar' => $calendar,
        ];
    }

    private static function haversineDistance(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;
        return self::EARTH_RADIUS_KM * 2 * asin(sqrt($a));
    }
}
