<?php

/**
 * ObserverRank.php — Observer Rank System (観測員ランクシステム)
 *
 * Unified ranking that evaluates users on 3 axes:
 *   - Recorder   (記録者): posting, species diversity, quality
 *   - Identifier (同定者): identification contributions, accuracy
 *   - Fieldwork  (フィールドワーク): surveys, field research, walking, territory
 *
 * Produces an ORS (Observer Rank Score) that maps to 10 rank tiers.
 *
 * NOTE: TrustLevel remains a separate, hidden backend system for
 *       Research Grade weighting. ORS is the user-facing rank.
 */

class ObserverRank
{
    /** @var array|null Cached rank definitions */
    private static ?array $rankDefs = null;

    /** @var array|null Cached scoring rules */
    private static ?array $scoringRules = null;

    /**
     * Load rank definitions from config JSON.
     */
    private static function loadConfig(): void
    {
        if (self::$rankDefs !== null) return;

        $configFile = DATA_DIR . '/config/observer_ranks.json';
        if (!file_exists($configFile)) {
            // Fallback to hardcoded defaults
            self::$rankDefs = self::defaultRanks();
            self::$scoringRules = self::defaultScoring();
            return;
        }

        $config = json_decode(file_get_contents($configFile), true);
        self::$rankDefs = $config['ranks'] ?? self::defaultRanks();
        self::$scoringRules = $config['scoring'] ?? self::defaultScoring();
    }

    /**
     * Calculate a user's complete Observer Rank data.
     *
     * @param string $userId
     * @param array|null $precomputedContext  Optional pre-computed gamification context
     *                                        (to avoid double-computing in Gamification::syncUserStats)
     * @return array {
     *   ors: int,
     *   level: int,
     *   rank: array,
     *   axes: {recorder: int, identifier: int, fieldwork: int},
     *   next_threshold: int,
     *   progress: float,
     *   badges_count: int
     * }
     */
    public static function calculate(string $userId, ?array $precomputedContext = null): array
    {
        self::loadConfig();
        $rules = self::$scoringRules;

        // Gather raw data (reuse context if provided by Gamification)
        $ctx = $precomputedContext ?? self::gatherContext($userId);

        // === Recorder Axis ===
        $rr = $rules['recorder'];
        $recorderScore = 0;
        $recorderScore += ($ctx['post_count'] ?? 0) * $rr['post'];
        $recorderScore += ($ctx['species_count'] ?? 0) * $rr['unique_species'];
        $recorderScore += ($ctx['rg_count'] ?? 0) * $rr['research_grade'];
        $recorderScore += ($ctx['streak_days'] ?? 0) * $rr['streak_day'];

        // === Identifier Axis ===
        $ir = $rules['identifier'];
        $identifierScore = 0;
        $idCount = $ctx['id_count'] ?? 0;
        $agreedCount = $ctx['id_agreed_count'] ?? 0;
        $agreementRate = $idCount > 0 ? ($agreedCount / $idCount) : 0;

        // Base identification points
        $identifierScore += $idCount * $ir['identification'];

        // Agreement bonus: multiply by rate if > 50%
        if ($agreementRate > 0.5) {
            $identifierScore = (int)round($identifierScore * $ir['agreement_bonus_multiplier']);
        }

        // TrustLevel bonus (levels 2-5 each grant bonus)
        $trustLevel = $ctx['trust_level'] ?? 1;
        if ($trustLevel > 1) {
            $identifierScore += ($trustLevel - 1) * $ir['trust_level_bonus'];
        }

        // === Fieldwork Axis ===
        $er = $rules['fieldwork'] ?? [];
        $fieldworkScore = 0;
        $fieldworkScore += ($ctx['my_field_count'] ?? 0) * $er['field_created'];
        $fieldworkScore += ($ctx['track_session_count'] ?? 0) * $er['track_session'];
        $fieldworkScore += (int)(($ctx['total_walk_distance_km'] ?? 0) * $er['walk_distance_km']);
        $fieldworkScore += ($ctx['my_field_total_obs'] ?? 0) * $er['field_observation'];

        // Survey (Phase 15C)
        $fieldworkScore += ($ctx['survey_count'] ?? 0) * ($er['survey_session'] ?? 30);
        $fieldworkScore += (int)(($ctx['survey_distance_km'] ?? 0) * ($er['survey_km'] ?? 10));

        // === Bonus ===
        $br = $rules['bonus'];
        $badgeCount = $ctx['badges_count'] ?? 0;
        $bonusScore = $badgeCount * $br['badge_earned'];

        // === Total ORS ===
        $ors = $recorderScore + $identifierScore + $fieldworkScore + $bonusScore;

        // === Determine Level ===
        $level = self::orsToLevel($ors);
        $rankInfo = self::getRankInfo($level);

        // === Progress to next level ===
        $nextThreshold = self::getNextThreshold($level);
        $currentThreshold = $rankInfo['threshold'];
        $progress = 100.0;
        if ($nextThreshold > $currentThreshold) {
            $progress = min(100.0, max(
                0.0,
                (($ors - $currentThreshold) / ($nextThreshold - $currentThreshold)) * 100
            ));
        }

        return [
            'ors'            => $ors,
            'level'          => $level,
            'rank'           => $rankInfo,
            'axes'           => [
                'recorder'   => $recorderScore,
                'identifier' => $identifierScore,
                'fieldwork'  => $fieldworkScore,
                'bonus'      => $bonusScore,
            ],
            'next_threshold' => $nextThreshold,
            'progress'       => round($progress, 1),
            'badges_count'   => $badgeCount,
        ];
    }

    /**
     * Gather all context data needed for ORS calculation.
     * Used when called standalone (not from Gamification).
     */
    private static function gatherContext(string $userId): array
    {
        $observations = DataStore::fetchAll('observations');
        $myFields = MyFieldManager::listByUser($userId);

        $postCount = 0;
        $rgCount = 0;
        $idCount = 0;
        $agreedCount = 0;
        $uniqueSpecies = [];
        $fieldObsCount = 0;

        foreach ($observations as $obs) {
            // Count user's posts
            if (($obs['user_id'] ?? '') === $userId) {
                $postCount++;
                $status = $obs['quality_grade'] ?? ($obs['status'] ?? '');
                if (in_array($status, ['Research Grade', '研究用'])) {
                    $rgCount++;
                }
                // Track species
                $taxonKey = $obs['taxon']['key'] ?? ($obs['taxon']['name'] ?? null);
                if ($taxonKey) {
                    $uniqueSpecies[$taxonKey] = true;
                }

                // Check field membership
                $lat = (float)($obs['latitude'] ?? $obs['lat'] ?? 0);
                $lng = (float)($obs['longitude'] ?? $obs['lng'] ?? 0);
                if ($lat && $lng) {
                    foreach ($myFields as $field) {
                        if (MyFieldManager::contains($field, $lat, $lng)) {
                            $fieldObsCount++;
                            break;
                        }
                    }
                }
            }

            // Count identifications on others' observations
            if (($obs['user_id'] ?? '') !== $userId) {
                foreach ($obs['identifications'] ?? [] as $identification) {
                    if (($identification['user_id'] ?? '') !== $userId) continue;
                    $idCount++;
                    $finalTaxon = $obs['taxon']['name'] ?? '';
                    $idTaxon = $identification['taxon_name'] ?? '';
                    if ($finalTaxon && $idTaxon && $finalTaxon === $idTaxon) {
                        $agreedCount++;
                    }
                }
            }
        }

        // Track stats (fieldwork axis)
        $trackSessionCount = 0;
        $totalWalkDistanceKm = 0;
        foreach ($myFields as $field) {
            $trackStats = MyFieldManager::getTrackStats($field['id']);
            $trackSessionCount += $trackStats['session_count'] ?? 0;
            $totalWalkDistanceKm += ($trackStats['total_distance_m'] ?? 0) / 1000;
        }

        // Survey stats (Phase 15C)
        // require_once __DIR__ . '/SurveyManager.php'; // Already loaded via autoloader or DataStore chain? Better require to be safe if not using composer fully
        if (file_exists(__DIR__ . '/SurveyManager.php')) {
            require_once __DIR__ . '/SurveyManager.php';
            $surveys = SurveyManager::listByUser($userId, 1000); // Fetch mostly all for scoring
            $surveyCount = count($surveys);
            $surveyDistanceKm = 0;
            foreach ($surveys as $s) {
                if (($s['status'] ?? '') === 'completed') {
                    $surveyDistanceKm += ($s['stats']['distance_m'] ?? 0) / 1000;
                }
            }
        } else {
            $surveyCount = 0;
            $surveyDistanceKm = 0;
        }

        // Badge count
        $userBadges = BadgeManager::getUserBadges($userId);
        $badgeCount = count($userBadges);

        // TrustLevel
        $trustLevel = TrustLevel::calculate($userId);

        // Streak days (simplified: count distinct dates of posts in last 30 days)
        $streakDays = self::calculateStreakFromObs($userId, $observations);

        return [
            'post_count'             => $postCount,
            'species_count'          => count($uniqueSpecies),
            'rg_count'               => $rgCount,
            'streak_days'            => $streakDays,
            'id_count'               => $idCount,
            'id_agreed_count'        => $agreedCount,
            'trust_level'            => $trustLevel,
            'my_field_count'         => count($myFields),
            'my_field_total_obs'     => $fieldObsCount,
            'track_session_count'    => $trackSessionCount,
            'total_walk_distance_km' => $totalWalkDistanceKm,
            'survey_count'           => $surveyCount,
            'survey_distance_km'     => $surveyDistanceKm,
            'badges_count'           => $badgeCount,
        ];
    }

    /**
     * Calculate consecutive posting days (streak).
     * Public so Gamification can call directly with pre-fetched observations.
     */
    public static function calculateStreakFromObs(string $userId, array $observations): int
    {
        $dates = [];
        foreach ($observations as $obs) {
            if (($obs['user_id'] ?? '') !== $userId) continue;
            $dateStr = $obs['observed_at'] ?? ($obs['created_at'] ?? null);
            if (!$dateStr) continue;
            $date = date('Y-m-d', strtotime($dateStr));
            $dates[$date] = true;
        }

        if (empty($dates)) return 0;

        // Sort dates descending
        $sortedDates = array_keys($dates);
        rsort($sortedDates);

        // Count from today backwards
        $streak = 0;
        $checkDate = date('Y-m-d');

        // Allow starting from yesterday if no post today
        if (!isset($dates[$checkDate])) {
            $checkDate = date('Y-m-d', strtotime('-1 day'));
        }

        while (isset($dates[$checkDate])) {
            $streak++;
            $checkDate = date('Y-m-d', strtotime($checkDate . ' -1 day'));
        }

        return $streak;
    }

    /**
     * Convert ORS to level (1-10).
     */
    public static function orsToLevel(int $ors): int
    {
        self::loadConfig();
        $level = 1;
        foreach (self::$rankDefs as $rank) {
            if ($ors >= $rank['threshold']) {
                $level = $rank['level'];
            }
        }
        return $level;
    }

    /**
     * Get rank metadata for a given level.
     */
    public static function getRankInfo(int $level): array
    {
        self::loadConfig();
        foreach (self::$rankDefs as $rank) {
            if ($rank['level'] === $level) {
                return $rank;
            }
        }
        return self::$rankDefs[0]; // Fallback to level 1
    }

    /**
     * Get the ORS threshold for the next level.
     */
    public static function getNextThreshold(int $currentLevel): int
    {
        self::loadConfig();
        foreach (self::$rankDefs as $rank) {
            if ($rank['level'] === $currentLevel + 1) {
                return $rank['threshold'];
            }
        }
        // Already at max level
        $maxRank = end(self::$rankDefs);
        return $maxRank['threshold'];
    }

    /**
     * Get all rank definitions (for UI rendering).
     */
    public static function getAllRanks(): array
    {
        self::loadConfig();
        return self::$rankDefs;
    }

    /**
     * Get appropriate rank label based on language.
     */
    public static function getRankLabel(int $level, string $lang = 'ja'): string
    {
        $info = self::getRankInfo($level);
        return $lang === 'ja' ? ($info['name_ja'] ?? $info['name_en']) : $info['name_en'];
    }

    // ========================================
    // Fallback Defaults
    // ========================================

    private static function defaultRanks(): array
    {
        return [
            ['level' => 1,  'name_en' => 'Apprentice',   'name_ja' => '見習い調査員',         'icon' => '🌱', 'color' => '#6B7280', 'bg' => 'rgba(107,114,128,0.15)', 'threshold' => 0],
            ['level' => 2,  'name_en' => 'Observer',      'name_ja' => '観察者',              'icon' => '🔍', 'color' => '#22C55E', 'bg' => 'rgba(34,197,94,0.15)',   'threshold' => 50],
            ['level' => 3,  'name_en' => 'Recorder',      'name_ja' => 'フィールド記録員',     'icon' => '📋', 'color' => '#10B981', 'bg' => 'rgba(16,185,129,0.15)',  'threshold' => 150],
            ['level' => 4,  'name_en' => 'Naturalist',    'name_ja' => 'ナチュラリスト',       'icon' => '🦋', 'color' => '#0EA5E9', 'bg' => 'rgba(14,165,233,0.15)',  'threshold' => 350],
            ['level' => 5,  'name_en' => 'Fieldworker',   'name_ja' => 'フィールドワーカー',   'icon' => '🥾', 'color' => '#3B82F6', 'bg' => 'rgba(59,130,246,0.15)',  'threshold' => 600],
            ['level' => 6,  'name_en' => 'Ranger',        'name_ja' => 'レンジャー',          'icon' => '🔭', 'color' => '#8B5CF6', 'bg' => 'rgba(139,92,246,0.15)',  'threshold' => 1000],
            ['level' => 7,  'name_en' => 'Lead Ranger',   'name_ja' => '上級レンジャー',       'icon' => '🧬', 'color' => '#A855F7', 'bg' => 'rgba(168,85,247,0.15)',  'threshold' => 1500],
            ['level' => 8,  'name_en' => 'Technician',    'name_ja' => 'フィールド技師',       'icon' => '🛡️', 'color' => '#F59E0B', 'bg' => 'rgba(245,158,11,0.15)',  'threshold' => 2500],
            ['level' => 9,  'name_en' => 'Master',        'name_ja' => 'マスター調査員',       'icon' => '🏔️', 'color' => '#EF4444', 'bg' => 'rgba(239,68,68,0.15)',   'threshold' => 4000],
            ['level' => 10, 'name_en' => 'Fellow',        'name_ja' => '主幹研究員',          'icon' => '🦉', 'color' => '#FFD700', 'bg' => 'rgba(255,215,0,0.20)',   'threshold' => 6000],
        ];
    }

    private static function defaultScoring(): array
    {
        return [
            'recorder' => ['post' => 10, 'unique_species' => 15, 'research_grade' => 20, 'streak_day' => 5],
            'identifier' => ['identification' => 5, 'agreement_bonus_multiplier' => 1.5, 'trust_level_bonus' => 100],
            'fieldwork' => [
                'field_created' => 30,
                'track_session' => 10,
                'walk_distance_km' => 5,
                'field_observation' => 8,
                'survey_session' => 30,
                'survey_km' => 10
            ],
            'bonus' => ['badge_earned' => 20],
        ];
    }
}
