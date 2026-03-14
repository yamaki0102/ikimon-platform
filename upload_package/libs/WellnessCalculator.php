<?php

/**
 * WellnessCalculator — ウェルネス × 生物多様性 指標計算エンジン
 *
 * 既存の観察データを「読み替え」て以下を算出:
 *   - フィールドセッション（自動グルーピング）
 *   - 自然滞在時間
 *   - 推定歩行距離
 *   - 認知ウェルネス指標（種多様度・新種発見）
 *
 * Evidence:
 *   E1: White et al. 2019 — 週120分の自然滞在で健康・幸福度向上
 *   E2: 筑波大学 — デュアルタスク8週間で認知+身体機能向上
 *   E3: カナダ追跡調査 — 週3日以上歩行でアルツハイマーリスク50%低減
 *   E5: KCL 2024 — 生物多様性が高い環境ほどメンタルヘルス改善
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/GeoUtils.php';

class WellnessCalculator
{
    // セッション判定の閾値
    const SESSION_TIME_GAP_SEC = 7200;  // 2時間以内 → 同一セッション
    const SESSION_DISTANCE_M   = 5000;  // 5km以内 → 同一セッション

    // 週当たりの自然滞在推奨時間（分）— White et al. 2019
    const WEEKLY_NATURE_TARGET_MIN = 120;

    /**
     * ユーザーのウェルネスサマリーを算出
     *
     * @param string $userId
     * @param string $period 'week' | 'month' | 'year' | 'all'
     * @return array
     */
    public static function getSummary(string $userId, string $period = 'month'): array
    {
        $observations = self::getUserObservations($userId, $period);
        $sessions = self::buildSessions($observations);

        // S1: フィジカル指標
        $physical = self::calculatePhysical($sessions);

        // S2: コグニティブ指標
        $cognitive = self::calculateCognitive($sessions, $userId);

        // S3: エモーショナル指標
        $emotional = self::calculateEmotional($sessions, $userId, $period);

        // 週別の自然時間追跡（週120分目標）
        $weeklyNature = self::calculateWeeklyNature($sessions);
        $habitGuidance = self::buildHabitGuidance($weeklyNature);

        return [
            'user_id'    => $userId,
            'period'     => $period,
            'sessions'   => array_map([self::class, 'sessionToSummary'], $sessions),
            'physical'   => $physical,
            'cognitive'  => $cognitive,
            'emotional'  => $emotional,
            'weekly_nature' => $weeklyNature,
            'habit_guidance' => $habitGuidance,
            'generated_at'  => date('c'),
        ];
    }

    /**
     * ユーザーの観察データを期間フィルタして取得
     */
    private static function getUserObservations(string $userId, string $period): array
    {
        $allObs = DataStore::fetchAll('observations');

        // 期間フィルタ
        $since = match ($period) {
            'week'  => strtotime('-7 days'),
            'month' => strtotime('-30 days'),
            'year'  => strtotime('-1 year'),
            default => 0,
        };

        $userObs = [];
        foreach ($allObs as $obs) {
            if (($obs['user_id'] ?? '') !== $userId) continue;

            $date = $obs['observed_at'] ?? $obs['created_at'] ?? '';
            if (!$date) continue;

            $ts = strtotime($date);
            if ($ts < $since) continue;

            // 座標がない投稿は除外
            $lat = (float)($obs['latitude'] ?? $obs['lat'] ?? 0);
            $lng = (float)($obs['longitude'] ?? $obs['lng'] ?? 0);
            if (empty($lat) || empty($lng)) continue;

            $obs['_ts']  = $ts;
            $obs['_lat'] = $lat;
            $obs['_lng'] = $lng;
            $userObs[] = $obs;
        }

        // 時系列ソート
        usort($userObs, fn($a, $b) => $a['_ts'] - $b['_ts']);

        return $userObs;
    }

    /**
     * 観察の「点」を「セッション」に自動グルーピング
     *
     * ルール: 連続する投稿が2時間以内 & 5km以内 → 同一セッション
     */
    public static function buildSessions(array $observations): array
    {
        if (empty($observations)) return [];

        $sessions = [];
        $current = [
            'observations' => [$observations[0]],
            'start_ts'     => $observations[0]['_ts'],
            'end_ts'       => $observations[0]['_ts'],
        ];

        for ($i = 1; $i < count($observations); $i++) {
            $prev = $observations[$i - 1];
            $curr = $observations[$i];

            $timeDiff = $curr['_ts'] - $prev['_ts'];
            $distDiff = GeoUtils::distance(
                $prev['_lat'],
                $prev['_lng'],
                $curr['_lat'],
                $curr['_lng']
            );

            if ($timeDiff <= self::SESSION_TIME_GAP_SEC && $distDiff <= self::SESSION_DISTANCE_M) {
                // 同一セッション
                $current['observations'][] = $curr;
                $current['end_ts'] = $curr['_ts'];
            } else {
                // 新セッション開始
                $sessions[] = $current;
                $current = [
                    'observations' => [$curr],
                    'start_ts'     => $curr['_ts'],
                    'end_ts'       => $curr['_ts'],
                ];
            }
        }
        $sessions[] = $current; // 最後のセッションを追加

        return $sessions;
    }

    /**
     * S1: フィジカル・ウェルネス指標
     */
    private static function calculatePhysical(array $sessions): array
    {
        $totalDurationMin = 0;
        $totalDistanceM   = 0;
        $sessionCount     = count($sessions);

        foreach ($sessions as $session) {
            // セッション滞在時間（最低15分として計上）
            $durationSec = max($session['end_ts'] - $session['start_ts'], 900);
            $totalDurationMin += $durationSec / 60;

            // 観察地点間の直線距離合算
            $obs = $session['observations'];
            for ($i = 1; $i < count($obs); $i++) {
                $totalDistanceM += GeoUtils::distance(
                    $obs[$i - 1]['_lat'],
                    $obs[$i - 1]['_lng'],
                    $obs[$i]['_lat'],
                    $obs[$i]['_lng']
                );
            }
        }

        return [
            'total_nature_minutes' => round($totalDurationMin),
            'total_distance_m'     => round($totalDistanceM),
            'total_distance_km'    => round($totalDistanceM / 1000, 1),
            'session_count'        => $sessionCount,
            'avg_session_minutes'  => $sessionCount > 0
                ? round($totalDurationMin / $sessionCount)
                : 0,
        ];
    }

    /**
     * S2: コグニティブ・ウェルネス指標（デュアルタスク / 認知症予防）
     */
    private static function calculateCognitive(array $sessions, string $userId): array
    {
        // 全ユーザー累計種リスト（新種発見判定に使用）
        $lifelist = self::getLifeList($userId);

        $totalObservations = 0;
        $totalUniqueSpecies = [];
        $newSpeciesCount = 0;
        $totalDurationMin = 0;

        foreach ($sessions as $session) {
            $sessionSpecies = [];
            foreach ($session['observations'] as $obs) {
                $totalObservations++;
                $taxonKey = $obs['taxon']['key'] ?? null;
                if ($taxonKey) {
                    $sessionSpecies[$taxonKey] = true;
                    $totalUniqueSpecies[$taxonKey] = true;
                }
            }
            $durationSec = max($session['end_ts'] - $session['start_ts'], 900);
            $totalDurationMin += $durationSec / 60;
        }

        // 新種発見数（この期間で初めて記録した種）
        // ※ period外の過去データとの比較は簡易計算（ライフリストとの差分）
        $periodSpeciesKeys = array_keys($totalUniqueSpecies);
        $newSpeciesCount = 0;
        foreach ($periodSpeciesKeys as $key) {
            if (!isset($lifelist[$key])) {
                $newSpeciesCount++;
            }
        }

        // 観察密度 = 1時間あたりの発見数
        $observationDensity = $totalDurationMin > 0
            ? round($totalObservations / ($totalDurationMin / 60), 1)
            : 0;

        return [
            'observation_density'   => $observationDensity,  // 件/時間
            'unique_species_count'  => count($totalUniqueSpecies),
            'new_species_count'     => $newSpeciesCount,
            'dual_task_sessions'    => count($sessions),  // 各セッション = 1回のデュアルタスク
            'cognitive_engagement'  => self::cognitiveScore(
                $observationDensity,
                count($totalUniqueSpecies),
                $newSpeciesCount
            ),
        ];
    }

    /**
     * 認知エンゲージメントスコア（0-100）
     * 観察密度・種多様性・新発見のバランスで計算
     */
    private static function cognitiveScore(float $density, int $uniqueSpecies, int $newSpecies): int
    {
        // 各要素を0-33のスケールで正規化して合算
        $densityScore  = min(33, (int)($density * 6.6));         // 5件/h で満点
        $diversityScore = min(33, (int)($uniqueSpecies * 3.3));  // 10種で満点
        $noveltyScore   = min(34, $newSpecies * 11);             // 3種で満点

        return min(100, $densityScore + $diversityScore + $noveltyScore);
    }

    /**
     * S3: エモーショナル・ウェルネス指標
     */
    private static function calculateEmotional(array $sessions, string $userId, string $period): array
    {
        // 直近の成長指標
        $totalSpeciesInPeriod = [];
        foreach ($sessions as $session) {
            foreach ($session['observations'] as $obs) {
                $taxonKey = $obs['taxon']['key'] ?? null;
                if ($taxonKey) {
                    $totalSpeciesInPeriod[$taxonKey] = $obs['taxon']['name'] ?? '不明';
                }
            }
        }

        // ライフリスト総数
        $lifelist = self::getLifeList($userId);

        // マイルストーン判定
        $milestones = [];
        $lifelistCount = count($lifelist);
        $thresholds = [10, 25, 50, 100, 200, 500, 1000];
        foreach ($thresholds as $t) {
            $milestones[] = [
                'threshold'  => $t,
                'label'      => "累計 {$t} 種",
                'achieved'   => $lifelistCount >= $t,
            ];
        }

        // 直近のマイルストーン（次の未達成目標）
        $nextMilestone = null;
        foreach ($milestones as $m) {
            if (!$m['achieved']) {
                $nextMilestone = $m;
                break;
            }
        }

        return [
            'lifelist_total'     => $lifelistCount,
            'period_species'     => count($totalSpeciesInPeriod),
            'milestones'         => $milestones,
            'next_milestone'     => $nextMilestone,
            'streak_days'        => self::calculateStreak($sessions),
        ];
    }

    /**
     * 週ごとの自然滞在時間（E1: 120分/週 目標）
     */
    private static function calculateWeeklyNature(array $sessions): array
    {
        $weeklyMinutes = [];

        foreach ($sessions as $session) {
            $weekKey = date('o-W', $session['start_ts']); // ISO week
            $durationSec = max($session['end_ts'] - $session['start_ts'], 900);

            if (!isset($weeklyMinutes[$weekKey])) {
                $weeklyMinutes[$weekKey] = 0;
            }
            $weeklyMinutes[$weekKey] += $durationSec / 60;
        }

        // 直近4週間の結果
        $result = [];
        for ($i = 3; $i >= 0; $i--) {
            $weekTs = strtotime("-{$i} weeks");
            $weekKey = date('o-W', $weekTs);
            $minutes = round($weeklyMinutes[$weekKey] ?? 0);
            $result[] = [
                'week'       => $weekKey,
                'minutes'    => $minutes,
                'target'     => self::WEEKLY_NATURE_TARGET_MIN,
                'achieved'   => $minutes >= self::WEEKLY_NATURE_TARGET_MIN,
                'percentage' => min(100, round($minutes / self::WEEKLY_NATURE_TARGET_MIN * 100)),
            ];
        }

        return $result;
    }

    private static function buildHabitGuidance(array $weeklyNature): array
    {
        $currentWeek = end($weeklyNature);
        if (!is_array($currentWeek)) {
            return [
                'current_week_minutes' => 0,
                'target_minutes' => self::WEEKLY_NATURE_TARGET_MIN,
                'remaining_minutes' => self::WEEKLY_NATURE_TARGET_MIN,
                'achieved' => false,
                'cta_label' => 'まずは10分だけ外に出よう',
                'cta_message' => '短い散歩でも、今週の自然時間は積み上がる。',
            ];
        }

        $remaining = max(0, (int)$currentWeek['target'] - (int)$currentWeek['minutes']);
        $achieved = !empty($currentWeek['achieved']);

        return [
            'current_week_minutes' => (int)$currentWeek['minutes'],
            'target_minutes' => (int)$currentWeek['target'],
            'remaining_minutes' => $remaining,
            'achieved' => $achieved,
            'cta_label' => $achieved ? '今週の自然時間は達成済み' : '今週の自然時間まであと ' . $remaining . '分',
            'cta_message' => $achieved
                ? '達成済み。このまま無理せず、次の発見を重ねればいい。'
                : ($remaining <= 20
                    ? 'あと少し。短いさんぽでも今週の目標に届く。'
                    : '次の散歩で自然時間を積み上げよう。'),
        ];
    }

    /**
     * ユーザーのライフリスト（累計種リスト）取得
     */
    private static function getLifeList(string $userId): array
    {
        static $cache = [];
        if (isset($cache[$userId])) return $cache[$userId];

        $allObs = DataStore::fetchAll('observations');
        $lifelist = [];
        foreach ($allObs as $obs) {
            if (($obs['user_id'] ?? '') !== $userId) continue;
            $taxonKey = $obs['taxon']['key'] ?? null;
            if ($taxonKey) {
                $lifelist[$taxonKey] = true;
            }
        }

        $cache[$userId] = $lifelist;
        return $lifelist;
    }

    /**
     * 活動ストリーク計算（連続活動日数）
     */
    private static function calculateStreak(array $sessions): int
    {
        if (empty($sessions)) return 0;

        $activeDates = [];
        foreach ($sessions as $s) {
            $activeDates[date('Y-m-d', $s['start_ts'])] = true;
        }

        $streak = 0;
        $date = date('Y-m-d');
        // 今日か昨日からカウント開始
        if (!isset($activeDates[$date])) {
            $date = date('Y-m-d', strtotime('-1 day'));
        }

        while (isset($activeDates[$date])) {
            $streak++;
            $date = date('Y-m-d', strtotime($date . ' -1 day'));
        }

        return $streak;
    }

    /**
     * セッションデータを要約形式に変換
     */
    private static function sessionToSummary(array $session): array
    {
        $obs = $session['observations'];
        $obsCount = count($obs);

        // 歩行距離
        $distanceM = 0;
        for ($i = 1; $i < $obsCount; $i++) {
            $distanceM += GeoUtils::distance(
                $obs[$i - 1]['_lat'],
                $obs[$i - 1]['_lng'],
                $obs[$i]['_lat'],
                $obs[$i]['_lng']
            );
        }

        // 種リスト
        $species = [];
        foreach ($obs as $o) {
            $name = $o['taxon']['name'] ?? '';
            if ($name) $species[$name] = ($species[$name] ?? 0) + 1;
        }

        $durationMin = max(round(($session['end_ts'] - $session['start_ts']) / 60), 15);

        return [
            'date'           => date('Y-m-d', $session['start_ts']),
            'started_at'     => date('c', $session['start_ts']),
            'ended_at'       => date('c', $session['end_ts']),
            'duration_min'   => $durationMin,
            'observation_count' => $obsCount,
            'species_count'  => count($species),
            'distance_m'     => round($distanceM),
            'species'        => $species,
            'center'         => [
                'lat' => $obs[0]['_lat'],
                'lng' => $obs[0]['_lng'],
            ],
            'route' => array_map(fn($o) => [
                'lat' => $o['_lat'],
                'lng' => $o['_lng'],
                'ts'  => $o['_ts'],
            ], $obs),
        ];
    }
}
