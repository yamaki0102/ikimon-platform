<?php
declare(strict_types=1);

/**
 * SiteTwinSnapshot — 生態デジタルツインの状態スナップショットエンジン
 *
 * サイト単位で「その時点の生態状態」を焼き固めて保存。
 * 生観測データからの毎回再計算を不要にし、時系列比較・差分検出・予測モデル入力を可能にする。
 *
 * スナップショットは data/twin_snapshots/{site_id}/{YYYY-Www}.json に保存（週次）。
 */

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/SiteManager.php';
require_once __DIR__ . '/WeatherContext.php';

class SiteTwinSnapshot
{
    private const SNAPSHOTS_DIR = 'twin_snapshots';

    /**
     * サイトの現時点スナップショットを生成・保存
     */
    public static function generate(string $siteId): ?array
    {
        $site = SiteManager::load($siteId);
        if (!$site) return null;

        $observations = SiteManager::getObservationsInSite($siteId);
        $now = new DateTime();
        $weekKey = $now->format('Y-\\WW'); // e.g., "2026-W14"

        $snapshot = [
            'site_id' => $siteId,
            'site_name' => $site['name'],
            'generated_at' => $now->format('c'),
            'week' => $weekKey,
            'period' => [
                'start' => $now->modify('-7 days')->format('Y-m-d'),
                'end' => (new DateTime())->format('Y-m-d'),
            ],
            'species_state' => self::buildSpeciesState($observations),
            'activity' => self::buildActivityMetrics($observations),
            'seasonal_phase' => self::detectSeasonalPhase($observations, (int)$now->format('n')),
            'weather_summary' => self::buildWeatherSummary($observations),
            'confidence_envelope' => self::buildConfidenceEnvelope($observations),
            'comparison' => null,
        ];

        // 前回スナップショットとの差分
        $previous = self::getLatest($siteId, $weekKey);
        if ($previous) {
            $snapshot['comparison'] = self::compareSnapshots($previous, $snapshot);
        }

        self::save($siteId, $weekKey, $snapshot);
        return $snapshot;
    }

    /**
     * 種の存在状態マップ
     * species_name → { presence_score, last_seen, observation_count, trend }
     */
    private static function buildSpeciesState(array $observations): array
    {
        $now = time();
        $speciesData = [];

        foreach ($observations as $obs) {
            $name = $obs['taxon']['name'] ?? null;
            if (!$name || $name === 'Unknown') continue;

            $observedAt = strtotime($obs['observed_at'] ?? $obs['created_at'] ?? '');
            if (!$observedAt) continue;

            if (!isset($speciesData[$name])) {
                $speciesData[$name] = [
                    'count' => 0,
                    'last_seen' => '',
                    'last_seen_ts' => 0,
                    'months' => [],
                    'recent_30d' => 0,
                    'recent_90d' => 0,
                    'scientific_name' => $obs['taxon']['scientific_name'] ?? '',
                    'group' => $obs['taxon']['group'] ?? 'その他',
                ];
            }

            $speciesData[$name]['count']++;
            if ($observedAt > $speciesData[$name]['last_seen_ts']) {
                $speciesData[$name]['last_seen'] = $obs['observed_at'];
                $speciesData[$name]['last_seen_ts'] = $observedAt;
            }

            $month = (int)date('n', $observedAt);
            $speciesData[$name]['months'][$month] = ($speciesData[$name]['months'][$month] ?? 0) + 1;

            $daysAgo = ($now - $observedAt) / 86400;
            if ($daysAgo <= 30) $speciesData[$name]['recent_30d']++;
            if ($daysAgo <= 90) $speciesData[$name]['recent_90d']++;
        }

        $result = [];
        foreach ($speciesData as $name => $data) {
            $daysSinceLastSeen = $data['last_seen_ts'] > 0
                ? (int)(($now - $data['last_seen_ts']) / 86400)
                : 999;

            // presence_score: 0-1 based on recency and frequency
            $recencyScore = max(0, 1 - ($daysSinceLastSeen / 365));
            $frequencyScore = min(1, $data['count'] / 10);
            $presenceScore = round(($recencyScore * 0.6 + $frequencyScore * 0.4), 3);

            // trend: recent activity vs historical average
            $monthlyAvg = $data['count'] / max(1, count($data['months']));
            $recentRate = $data['recent_90d'] / 3; // per month rate
            $trend = 'stable';
            if ($recentRate > $monthlyAvg * 1.5) $trend = 'increasing';
            elseif ($recentRate < $monthlyAvg * 0.5 && $data['count'] > 3) $trend = 'decreasing';

            $result[$name] = [
                'presence_score' => $presenceScore,
                'last_seen' => $data['last_seen'],
                'days_since_last_seen' => $daysSinceLastSeen,
                'total_observations' => $data['count'],
                'recent_30d' => $data['recent_30d'],
                'recent_90d' => $data['recent_90d'],
                'trend' => $trend,
                'active_months' => array_keys($data['months']),
                'scientific_name' => $data['scientific_name'],
                'group' => $data['group'],
            ];
        }

        // Sort by presence_score descending
        uasort($result, fn($a, $b) => $b['presence_score'] <=> $a['presence_score']);

        return $result;
    }

    /**
     * サイトの活動指標
     */
    private static function buildActivityMetrics(array $observations): array
    {
        $now = time();
        $last7d = 0;
        $last30d = 0;
        $last90d = 0;
        $observers7d = [];
        $observers30d = [];

        foreach ($observations as $obs) {
            $ts = strtotime($obs['observed_at'] ?? $obs['created_at'] ?? '');
            if (!$ts) continue;
            $daysAgo = ($now - $ts) / 86400;

            if ($daysAgo <= 7) {
                $last7d++;
                $observers7d[$obs['user_id'] ?? ''] = true;
            }
            if ($daysAgo <= 30) {
                $last30d++;
                $observers30d[$obs['user_id'] ?? ''] = true;
            }
            if ($daysAgo <= 90) {
                $last90d++;
            }
        }

        // activity_level: 0-1 normalized
        $activityLevel = min(1.0, round($last30d / max(1, 30) * 0.5 + count($observers30d) / max(1, 5) * 0.5, 3));

        return [
            'observations_7d' => $last7d,
            'observations_30d' => $last30d,
            'observations_90d' => $last90d,
            'observers_7d' => count($observers7d),
            'observers_30d' => count($observers30d),
            'activity_level' => $activityLevel,
            'total_observations' => count($observations),
        ];
    }

    /**
     * 季節フェーズ検出
     */
    private static function detectSeasonalPhase(array $observations, int $currentMonth): array
    {
        $phases = [
            1 => 'winter', 2 => 'winter', 3 => 'early_spring',
            4 => 'spring', 5 => 'late_spring', 6 => 'early_summer',
            7 => 'summer', 8 => 'summer', 9 => 'early_autumn',
            10 => 'autumn', 11 => 'late_autumn', 12 => 'winter',
        ];

        // Count observations by month to detect phenological anomalies
        $monthCounts = array_fill(1, 12, 0);
        foreach ($observations as $obs) {
            $month = (int)date('n', strtotime($obs['observed_at'] ?? $obs['created_at'] ?? 'now'));
            $monthCounts[$month]++;
        }

        // Peak month detection
        $peakMonth = array_search(max($monthCounts), $monthCounts);

        // Groups active this month vs expected
        $groupsThisMonth = [];
        $groupsExpected = [];
        foreach ($observations as $obs) {
            $group = $obs['taxon']['group'] ?? 'その他';
            $obsMonth = (int)date('n', strtotime($obs['observed_at'] ?? $obs['created_at'] ?? 'now'));
            if ($obsMonth === $currentMonth) {
                $groupsThisMonth[$group] = ($groupsThisMonth[$group] ?? 0) + 1;
            }
            // Same month last year = expected
            $obsYear = (int)date('Y', strtotime($obs['observed_at'] ?? $obs['created_at'] ?? 'now'));
            if ($obsMonth === $currentMonth && $obsYear < (int)date('Y')) {
                $groupsExpected[$group] = ($groupsExpected[$group] ?? 0) + 1;
            }
        }

        return [
            'current_phase' => $phases[$currentMonth] ?? 'unknown',
            'current_month' => $currentMonth,
            'peak_observation_month' => $peakMonth,
            'observations_this_month' => $monthCounts[$currentMonth] ?? 0,
            'groups_active' => array_keys($groupsThisMonth),
            'groups_expected' => array_keys($groupsExpected),
            'month_distribution' => $monthCounts,
        ];
    }

    /**
     * 観測に紐づく気象データの集約
     */
    private static function buildWeatherSummary(array $observations): array
    {
        $temps = [];
        $humidity = [];
        $precipitation = [];
        $weatherCodes = [];

        foreach ($observations as $obs) {
            $w = $obs['weather_context'] ?? null;
            if (!$w) continue;

            if ($w['temperature_c'] !== null) $temps[] = $w['temperature_c'];
            if ($w['humidity_pct'] !== null) $humidity[] = $w['humidity_pct'];
            if ($w['precipitation_mm'] !== null) $precipitation[] = $w['precipitation_mm'];
            if ($w['weather_code'] !== null) $weatherCodes[] = $w['weather_code'];
        }

        $count = count($temps);
        if ($count === 0) {
            return ['available' => false, 'enriched_observations' => 0];
        }

        return [
            'available' => true,
            'enriched_observations' => $count,
            'temperature' => [
                'mean' => round(array_sum($temps) / $count, 1),
                'min' => round(min($temps), 1),
                'max' => round(max($temps), 1),
            ],
            'humidity_mean_pct' => $humidity ? (int)round(array_sum($humidity) / count($humidity)) : null,
            'total_precipitation_mm' => round(array_sum($precipitation), 1),
            'dominant_weather' => $weatherCodes
                ? WeatherContext::weatherCodeToLabel(self::mode($weatherCodes))
                : null,
        ];
    }

    /**
     * 信頼度エンベロープ
     */
    private static function buildConfidenceEnvelope(array $observations): array
    {
        $total = count($observations);
        if ($total === 0) {
            return [
                'data_quality_grade' => 'N/A',
                'grade_distribution' => [],
                'id_confidence' => 0,
                'spatial_coverage' => 0,
                'temporal_coverage' => 0,
            ];
        }

        // Quality grade distribution
        $grades = ['A' => 0, 'B' => 0, 'C' => 0, 'D' => 0];
        $hasId = 0;
        $months = [];
        $lats = [];
        $lngs = [];

        foreach ($observations as $obs) {
            $dq = $obs['data_quality'] ?? null;
            if ($dq && isset($grades[$dq])) {
                $grades[$dq]++;
            } else {
                $grades['D']++;
            }

            if (!empty($obs['taxon']['name']) && $obs['taxon']['name'] !== 'Unknown') {
                $hasId++;
            }

            $month = substr($obs['observed_at'] ?? '', 0, 7);
            if ($month) $months[$month] = true;

            if (!empty($obs['lat'])) $lats[] = (float)$obs['lat'];
            if (!empty($obs['lng'])) $lngs[] = (float)$obs['lng'];
        }

        // Overall grade
        $bestGrade = 'D';
        if ($grades['A'] > $total * 0.5) $bestGrade = 'A';
        elseif (($grades['A'] + $grades['B']) > $total * 0.5) $bestGrade = 'B';
        elseif (($grades['A'] + $grades['B'] + $grades['C']) > $total * 0.5) $bestGrade = 'C';

        // Spatial coverage: bounding box area as proxy
        $spatialCoverage = 0;
        if (count($lats) > 1 && count($lngs) > 1) {
            $latRange = max($lats) - min($lats);
            $lngRange = max($lngs) - min($lngs);
            $spatialCoverage = min(1.0, round(($latRange * $lngRange) * 10000, 3));
        }

        return [
            'data_quality_grade' => $bestGrade,
            'grade_distribution' => $grades,
            'id_confidence' => round($hasId / $total, 3),
            'spatial_coverage' => $spatialCoverage,
            'temporal_coverage' => min(1.0, round(count($months) / 12, 3)),
        ];
    }

    /**
     * 2つのスナップショット間の差分
     */
    private static function compareSnapshots(array $previous, array $current): array
    {
        $prevSpecies = array_keys($previous['species_state'] ?? []);
        $currSpecies = array_keys($current['species_state'] ?? []);

        $newSpecies = array_diff($currSpecies, $prevSpecies);
        $lostSpecies = array_diff($prevSpecies, $currSpecies);

        $prevActivity = $previous['activity']['activity_level'] ?? 0;
        $currActivity = $current['activity']['activity_level'] ?? 0;

        $trendChanges = [];
        foreach ($current['species_state'] as $name => $state) {
            $prevTrend = $previous['species_state'][$name]['trend'] ?? null;
            if ($prevTrend && $prevTrend !== $state['trend']) {
                $trendChanges[$name] = [
                    'from' => $prevTrend,
                    'to' => $state['trend'],
                ];
            }
        }

        return [
            'previous_week' => $previous['week'] ?? 'unknown',
            'species_gained' => array_values($newSpecies),
            'species_lost' => array_values($lostSpecies),
            'species_count_delta' => count($currSpecies) - count($prevSpecies),
            'activity_delta' => round($currActivity - $prevActivity, 3),
            'trend_changes' => $trendChanges,
        ];
    }

    // --- Storage ---

    private static function getDir(string $siteId): string
    {
        return DATA_DIR . '/' . self::SNAPSHOTS_DIR . '/' . $siteId;
    }

    private static function save(string $siteId, string $weekKey, array $snapshot): void
    {
        $dir = self::getDir($siteId);
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        $filename = $dir . '/' . $weekKey . '.json';
        file_put_contents(
            $filename,
            json_encode($snapshot, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_HEX_TAG)
        );
    }

    /**
     * 最新のスナップショットを取得（指定週を除外可能）
     */
    public static function getLatest(string $siteId, ?string $excludeWeek = null): ?array
    {
        $dir = self::getDir($siteId);
        if (!is_dir($dir)) return null;

        $files = glob($dir . '/*.json');
        if (empty($files)) return null;

        rsort($files); // newest first
        foreach ($files as $file) {
            $basename = basename($file, '.json');
            if ($excludeWeek && $basename === $excludeWeek) continue;

            $data = json_decode(file_get_contents($file), true);
            if ($data) return $data;
        }

        return null;
    }

    /**
     * 指定期間のスナップショット履歴を取得
     */
    public static function getHistory(string $siteId, int $weeks = 12): array
    {
        $dir = self::getDir($siteId);
        if (!is_dir($dir)) return [];

        $files = glob($dir . '/*.json');
        if (empty($files)) return [];

        rsort($files);
        $history = [];
        foreach (array_slice($files, 0, $weeks) as $file) {
            $data = json_decode(file_get_contents($file), true);
            if ($data) $history[] = $data;
        }

        return $history;
    }

    /**
     * 全登録サイトのスナップショットを一括生成
     */
    public static function generateAll(): array
    {
        $sites = SiteManager::listAll();
        $results = [];

        foreach ($sites as $site) {
            $snapshot = self::generate($site['id']);
            $results[$site['id']] = $snapshot !== null;
        }

        return $results;
    }

    /**
     * 最頻値
     */
    private static function mode(array $values): mixed
    {
        $counts = array_count_values($values);
        arsort($counts);
        return array_key_first($counts);
    }
}
