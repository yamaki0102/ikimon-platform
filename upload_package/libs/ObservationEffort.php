<?php
declare(strict_types=1);

/**
 * ObservationEffort — 観測努力量と不在データ推定エンジン
 *
 * Walk/FieldScanセッションの努力量（時間・距離・歩数）から、
 * 「見たけどいなかった（暗黙的不在）」を推定し、
 * presence-only → presence-absence モデルへの橋渡しを行う。
 *
 * 不在データは分布モデルの精度を劇的に向上させる。
 * - presence-only: 「ここにいた」しか分からない → 偏りが大きい
 * - presence-absence: 「ここにいなかった」も分かる → 真の分布推定
 */

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/MyFieldManager.php';

class ObservationEffort
{
    /**
     * セッションの観測努力量メトリクスを算出
     *
     * @param array $session Track session data
     * @param array $observations Observations made during session
     * @return array Effort metrics
     */
    public static function calculateSessionEffort(array $session, array $observations): array
    {
        $startTs = strtotime($session['started_at'] ?? '');
        $endTs = strtotime($session['updated_at'] ?? '');
        $durationSec = max(0, $endTs - $startTs);
        $distanceM = (float)($session['total_distance_m'] ?? 0);

        // Species observed during session
        $speciesObserved = [];
        foreach ($observations as $obs) {
            $name = $obs['taxon']['name'] ?? null;
            if ($name && $name !== 'Unknown') {
                $speciesObserved[$name] = ($speciesObserved[$name] ?? 0) + 1;
            }
        }

        // Effort intensity: observations per hour per km
        $hours = $durationSec / 3600;
        $km = $distanceM / 1000;
        $obsPerHour = $hours > 0 ? count($observations) / $hours : 0;
        $obsPerKm = $km > 0 ? count($observations) / $km : 0;
        $speciesPerHour = $hours > 0 ? count($speciesObserved) / $hours : 0;

        // Effort classification
        $effortClass = self::classifyEffort($durationSec, $distanceM, count($observations));

        return [
            'session_id' => $session['session_id'] ?? null,
            'duration_sec' => $durationSec,
            'duration_min' => (int)round($durationSec / 60),
            'distance_m' => round($distanceM, 1),
            'step_count' => $session['step_count'] ?? null,
            'observation_count' => count($observations),
            'species_count' => count($speciesObserved),
            'species_observed' => array_keys($speciesObserved),
            'obs_per_hour' => round($obsPerHour, 2),
            'obs_per_km' => round($obsPerKm, 2),
            'species_per_hour' => round($speciesPerHour, 2),
            'effort_class' => $effortClass,
            'is_survey_quality' => $effortClass !== 'casual',
        ];
    }

    /**
     * 努力量を分類
     * casual: 短時間/短距離の散歩
     * moderate: 30分以上 or 1km以上のフィールドワーク
     * intensive: 1時間以上 AND 2km以上の本格調査
     */
    private static function classifyEffort(int $durationSec, float $distanceM, int $obsCount): string
    {
        $minutes = $durationSec / 60;

        if ($minutes >= 60 && $distanceM >= 2000) {
            return 'intensive';
        }
        if ($minutes >= 30 || $distanceM >= 1000 || $obsCount >= 5) {
            return 'moderate';
        }
        return 'casual';
    }

    /**
     * セッションから暗黙的不在データを推定
     *
     * ロジック:
     * 1. セッション実施地点の過去データから「期待される種」リストを作成
     * 2. セッション中に観測されなかった期待種 = 暗黙的不在
     * 3. 努力量が十分（moderate以上）な場合のみ有効
     *
     * @param array $session Track session
     * @param array $observations Observations during session
     * @param array $siteSpecies Historical species at this location (from SiteTwinSnapshot or direct query)
     * @return array Inferred absences
     */
    public static function inferAbsences(
        array $session,
        array $observations,
        array $siteSpecies
    ): array {
        $effort = self::calculateSessionEffort($session, $observations);

        // Only infer absences from sufficient effort
        if ($effort['effort_class'] === 'casual') {
            return [
                'valid' => false,
                'reason' => 'insufficient_effort',
                'effort' => $effort,
                'absences' => [],
            ];
        }

        $observedSpecies = $effort['species_observed'];
        $currentMonth = (int)date('n', strtotime($session['started_at'] ?? 'now'));

        $absences = [];
        foreach ($siteSpecies as $name => $speciesData) {
            if (in_array($name, $observedSpecies, true)) continue;

            // Only consider species expected in current month
            $activeMonths = $speciesData['active_months'] ?? [];
            if (!empty($activeMonths) && !in_array($currentMonth, $activeMonths, true)) {
                continue;
            }

            // Only high-presence species (threshold: score > 0.3)
            $presenceScore = $speciesData['presence_score'] ?? 0;
            if ($presenceScore < 0.3) continue;

            $absences[] = [
                'species_name' => $name,
                'scientific_name' => $speciesData['scientific_name'] ?? '',
                'expected_presence_score' => $presenceScore,
                'inference_type' => 'implicit_absence',
                'confidence' => self::absenceConfidence($effort, $presenceScore),
            ];
        }

        return [
            'valid' => true,
            'session_id' => $session['session_id'] ?? null,
            'date' => substr($session['started_at'] ?? '', 0, 10),
            'effort' => $effort,
            'species_observed_count' => count($observedSpecies),
            'absences_inferred_count' => count($absences),
            'absences' => $absences,
        ];
    }

    /**
     * 不在推定の信頼度
     *
     * 高い努力量 × 高い期待出現率 = 高信頼度の不在
     */
    private static function absenceConfidence(array $effort, float $presenceScore): float
    {
        $effortMultiplier = match ($effort['effort_class']) {
            'intensive' => 0.9,
            'moderate' => 0.6,
            default => 0.3,
        };

        return round(min(1.0, $presenceScore * $effortMultiplier), 3);
    }

    /**
     * ユーザーの全セッションから努力量メトリクスを集約
     */
    public static function getUserEffortSummary(string $userId): array
    {
        $tracks = MyFieldManager::getUserTracks($userId);
        $totalDuration = 0;
        $totalDistance = 0;
        $totalObs = 0;
        $surveyCount = 0;

        foreach ($tracks as $track) {
            $totalDuration += $track['duration_sec'] ?? 0;
            $totalDistance += $track['total_distance'] ?? 0;
            $totalObs += $track['observation_count'] ?? 0;

            $effort = self::classifyEffort(
                $track['duration_sec'] ?? 0,
                (float)($track['total_distance'] ?? 0),
                $track['observation_count'] ?? 0
            );
            if ($effort !== 'casual') $surveyCount++;
        }

        return [
            'total_sessions' => count($tracks),
            'survey_quality_sessions' => $surveyCount,
            'total_duration_hours' => round($totalDuration / 3600, 1),
            'total_distance_km' => round($totalDistance / 1000, 1),
            'total_observations' => $totalObs,
            'avg_obs_per_session' => count($tracks) > 0
                ? round($totalObs / count($tracks), 1) : 0,
        ];
    }
}
