<?php
require_once __DIR__ . '/Auth.php';
require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/Notification.php';
require_once __DIR__ . '/TrustLevel.php';
require_once __DIR__ . '/BadgeManager.php';
require_once __DIR__ . '/MyFieldManager.php';
require_once __DIR__ . '/ObserverRank.php';
require_once __DIR__ . '/QuestManager.php';

class Gamification
{

    // Point Rules
    const POINTS_POST = 10;
    const POINTS_ID = 5;
    const POINTS_RG = 20; // Bonus for reaching 研究用 (Research Grade)

    /**
     * Update user score and badges
     * @param string $userId
     * @param array $events (Reference) Collects 'badge_earned', 'rank_up', 'quest_complete' events
     */
    public static function syncUserStats($userId, &$events = [])
    {
        $observations = DataStore::fetchAll('observations');
        $myFields = MyFieldManager::listByUser($userId);

        $postCount = 0;
        $idCount = 0;
        $rgCount = 0;
        $idAgreedCount = 0; // For ObserverRank identifier axis
        $taxonIdCounts = []; // group => count for taxonomy-specific badges

        // My Field Stats
        $myFieldCount = count($myFields);
        $myFieldUserObsIds = []; // Track unique observations in user's fields
        $myFieldMaxScore = 0.0;

        // 1. Calculate Field Scores (for Field Researcher badge)
        foreach ($myFields as $field) {
            $stats = MyFieldManager::calculateStats($field);
            $val = $stats['shannon_index'] ?? 0;
            if ($val > $myFieldMaxScore) {
                $myFieldMaxScore = $val;
            }
        }

        $uniqueSpecies = [];

        // 2. Iterate Observations
        foreach ($observations as $obs) {
            $obsId = $obs['id'];

            // Count Posts
            if (($obs['user_id'] ?? '') === $userId) {
                $postCount++;
                $obsStatus = $obs['quality_grade'] ?? ($obs['status'] ?? '');
                if (in_array($obsStatus, ['Research Grade', '研究用'])) {
                    $rgCount++;
                }

                // Track Unique Species
                if (isset($obs['taxon']['key'])) {
                    $uniqueSpecies[$obs['taxon']['key']] = true;
                } elseif (isset($obs['taxon']['name'])) {
                    $uniqueSpecies[$obs['taxon']['name']] = true;
                }

                // Check if this obs is inside any of My Fields
                $lat = (float)($obs['latitude'] ?? $obs['lat'] ?? 0);
                $lng = (float)($obs['longitude'] ?? $obs['lng'] ?? 0);
                if ($lat && $lng) {
                    foreach ($myFields as $field) {
                        if (MyFieldManager::contains($field, $lat, $lng)) {
                            $myFieldUserObsIds[$obsId] = true;
                            break;
                        }
                    }
                }
            }

            // Count IDs
            if (isset($obs['identifications'])) {
                foreach ($obs['identifications'] as $id) {
                    if (($id['user_id'] ?? '') === $userId) {
                        $idCount++;
                        $taxGroup = $obs['taxon']['lineage']['order'] ?? ($obs['taxon_group'] ?? '');
                        if ($taxGroup) {
                            $taxonIdCounts[$taxGroup] = ($taxonIdCounts[$taxGroup] ?? 0) + 1;
                        }
                        // Agreement check
                        $finalTaxon = $obs['taxon']['name'] ?? '';
                        $idTaxon = $id['taxon_name'] ?? '';
                        if ($finalTaxon && $idTaxon && $finalTaxon === $idTaxon) {
                            $idAgreedCount++;
                        }
                    }
                }
            }
        }

        // Calculate Score
        $score = ($postCount * self::POINTS_POST) +
            ($idCount * self::POINTS_ID) +
            ($rgCount * self::POINTS_RG);

        // TrustLevel
        $trustLevel = TrustLevel::calculate($userId);

        // --- NEW BADGE MANAGER Integration ---
        $context = [
            'post_count' => $postCount,
            'id_count' => $idCount,
            'species_count' => count($uniqueSpecies),
            'taxon_id_counts' => $taxonIdCounts,
            'trust_level' => $trustLevel,
            'my_field_count' => $myFieldCount,
            'my_field_total_obs' => count($myFieldUserObsIds),
            'my_field_score' => $myFieldMaxScore,
            'my_field_max_score' => $myFieldMaxScore,
        ];

        // Award Badges
        $newBadges = [];
        $types = [
            'post_count',
            'id_count',
            'species_count',
            'taxon_id',
            'taxon_diversity',
            'trust_level',
            'my_field_count',
            'my_field_obs_count',
            'my_field_score'
        ];
        foreach ($types as $type) {
            $awarded = BadgeManager::checkAndAward($userId, $type, $context);
            $newBadges = array_merge($newBadges, $awarded);
        }

        // Process New Badges
        foreach ($newBadges as $badge) {
            $events[] = [
                'type' => 'badge_earned',
                'badge' => $badge
            ];
            Notification::send(
                $userId,
                'badge_earned',
                'バッジ獲得！: ' . $badge['name'],
                '新しいバッジ「' . $badge['name'] . '」を獲得しました。',
                'profile.php'
            );
        }

        // Save User Stats
        $user = DataStore::findById('users', $userId);
        if ($user) {
            $oldScore = $user['score'] ?? 0; // Track old score for diff

            $user['score'] = $score;
            $user['post_count'] = $postCount;
            $user['id_count'] = $idCount;
            $userBadges = BadgeManager::getUserBadges($userId);
            $user['badges'] = array_column($userBadges, 'id');

            // === Observer Rank System ===
            $trackSessionCount = 0;
            $totalWalkDistanceKm = 0;
            foreach ($myFields as $field) {
                $trackStats = MyFieldManager::getTrackStats($field['id']);
                $trackSessionCount += $trackStats['session_count'] ?? 0;
                $totalWalkDistanceKm += ($trackStats['total_distance_m'] ?? 0) / 1000;
            }

            $orsContext = [
                'post_count'             => $postCount,
                'species_count'          => count($uniqueSpecies),
                'rg_count'               => $rgCount,
                'streak_days'            => ObserverRank::calculateStreakFromObs($userId, $observations),
                'id_count'               => $idCount,
                'id_agreed_count'        => $idAgreedCount,
                'trust_level'            => $trustLevel,
                'my_field_count'         => $myFieldCount,
                'my_field_total_obs'     => count($myFieldUserObsIds),
                'track_session_count'    => $trackSessionCount,
                'total_walk_distance_km' => $totalWalkDistanceKm,
                'badges_count'           => count($userBadges),
            ];
            $rankData = ObserverRank::calculate($userId, $orsContext);
            $user['observer_rank'] = $rankData;

            // Check for rank-up
            $oldLevel = $user['observer_rank_level'] ?? 1;
            $newLevel = $rankData['level'];
            if ($newLevel > $oldLevel) {
                $rankInfo = $rankData['rank'];
                $events[] = [
                    'type' => 'rank_up',
                    'rank' => $rankInfo,
                    'level' => $newLevel
                ];
                Notification::send(
                    $userId,
                    'rank_up',
                    'ランクアップ！: ' . ($rankInfo['icon'] ?? '') . ' ' . ($rankInfo['name_ja'] ?? $rankInfo['name_en']),
                    ($rankInfo['name_ja'] ?? $rankInfo['name_en']) . 'に昇格しました！',
                    'profile.php'
                );
            }
            $user['observer_rank_level'] = $newLevel;

            // === Quest Progress Check ===
            $activeQuests = QuestManager::getActiveQuests();
            $questLog = $user['quest_log'] ?? [];
            $today = date('Y-m-d');
            $questScoreAdded = 0;

            foreach ($activeQuests as $quest) {
                $qId = $quest['id'];
                if (isset($questLog[$today][$qId])) continue;

                $progress = QuestManager::checkProgress($userId, $qId);
                if ($progress >= 100) {
                    $reward = $quest['reward'] ?? 0;
                    $questScoreAdded += $reward;

                    // Log completion
                    if (!isset($questLog[$today])) $questLog[$today] = [];
                    $questLog[$today][$qId] = [
                        'completed_at' => date('Y-m-d H:i:s'),
                        'reward' => $reward
                    ];

                    $events[] = [
                        'type' => 'quest_complete',
                        'quest' => $quest,
                        'reward' => $reward
                    ];

                    Notification::send(
                        $userId,
                        'quest_complete',
                        'クエスト達成！',
                        '「' . $quest['title'] . '」を達成しました！ +' . $reward . 'pt',
                        'index.php'
                    );
                }
            }
            $user['quest_log'] = $questLog;
            $user['score'] += $questScoreAdded;

            DataStore::upsert('users', $user);

            // Update Session
            Auth::init();
            if (isset($_SESSION['user']) && $_SESSION['user']['id'] === $userId) {
                $_SESSION['user'] = array_merge($_SESSION['user'], $user);
            }
        }

        return $user;
    }

    public static function getBadgeDetails($key)
    {
        $defs = BadgeManager::getDefinitions();
        // Since definitions are list, we need to map by ID
        foreach ($defs as $def) {
            if ($def['id'] === $key) return $def;
        }
        return null;
    }

    /**
     * Return all badge definitions.
     */
    public static function getBadges(): array
    {
        return BadgeManager::getDefinitions();
    }

    /**
     * Return badges the user is eligible for based on their stats.
     * Pure eligibility check — no disk writes or session side effects.
     *
     * @param array $user Must contain: post_count, id_count (and optionally species_count, etc.)
     */
    public static function getEarnedBadges(array $user): array
    {
        $definitions = BadgeManager::getDefinitions();
        $earned = [];

        $context = [
            'post_count'         => $user['post_count'] ?? 0,
            'id_count'           => $user['id_count'] ?? 0,
            'species_count'      => $user['species_count'] ?? 0,
            'trust_level'        => $user['trust_level'] ?? 0,
            'my_field_count'     => $user['my_field_count'] ?? 0,
            'my_field_total_obs' => $user['my_field_total_obs'] ?? 0,
            'my_field_max_score' => $user['my_field_max_score'] ?? 0,
            'taxon_id_counts'    => $user['taxon_id_counts'] ?? [],
            'survey_count'       => $user['survey_count'] ?? 0,
        ];

        foreach ($definitions as $badge) {
            $condition = $badge['condition'] ?? [];
            $type      = $condition['type'] ?? '';
            $threshold = $condition['threshold'] ?? PHP_INT_MAX;
            $awarded   = false;

            switch ($type) {
                case 'post_count':
                    $awarded = $context['post_count'] >= $threshold;
                    break;
                case 'species_count':
                    $awarded = $context['species_count'] >= $threshold;
                    break;
                case 'id_count':
                    $awarded = $context['id_count'] >= $threshold;
                    break;
                case 'taxon_id':
                    $count = 0;
                    foreach ($condition['groups'] ?? [] as $group) {
                        $count += $context['taxon_id_counts'][$group] ?? 0;
                    }
                    $awarded = $count >= $threshold;
                    break;
                case 'taxon_diversity':
                    $diverseCount = count(array_filter($context['taxon_id_counts'], fn($c) => $c >= 1));
                    $awarded = $diverseCount >= $threshold;
                    break;
                case 'trust_level':
                    $awarded = $context['trust_level'] >= $threshold;
                    break;
                case 'my_field_count':
                    $awarded = $context['my_field_count'] >= $threshold;
                    break;
                case 'my_field_obs_count':
                    $awarded = $context['my_field_total_obs'] >= $threshold;
                    break;
                case 'my_field_score':
                    $awarded = $context['my_field_max_score'] >= $threshold;
                    break;
                case 'survey_count':
                    $awarded = $context['survey_count'] >= $threshold;
                    break;
            }

            if ($awarded) {
                $earned[] = $badge;
            }
        }

        return $earned;
    }
}
