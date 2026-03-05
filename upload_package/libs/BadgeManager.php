<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/Auth.php';

class BadgeManager
{
    const CONFIG_FILE = ROOT_DIR . '/data/config/badges.json';
    const USER_BADGES_DIR = DATA_DIR . '/user_badges';

    private static $badges = null;

    /**
     * Load badge definitions
     */
    public static function getDefinitions(): array
    {
        if (self::$badges === null) {
            if (file_exists(self::CONFIG_FILE)) {
                self::$badges = json_decode(file_get_contents(self::CONFIG_FILE), true);
            } else {
                self::$badges = [];
            }
        }
        return self::$badges;
    }

    /**
     * Get badges for a specific user
     */
    public static function getUserBadges(string $userId): array
    {
        $file = self::USER_BADGES_DIR . '/' . $userId . '.json';
        if (file_exists($file)) {
            $content = file_get_contents($file);
            $data = json_decode($content, true);
            return $data ?? [];
        }
        return [];
    }

    /**
     * Check and award badges based on action
     * Returns array of newly awarded badges
     */
    public static function checkAndAward(string $userId, string $actionType, array $context = []): array
    {
        // Ensure storage directory exists
        if (!is_dir(self::USER_BADGES_DIR)) {
            mkdir(self::USER_BADGES_DIR, 0755, true);
        }

        $definitions = self::getDefinitions();
        $userBadges = self::getUserBadges($userId);
        $ownedIds = array_column($userBadges, 'id');

        $newBadges = [];

        foreach ($definitions as $badge) {
            // Skip if already owned
            if (in_array($badge['id'], $ownedIds)) continue;

            // Check condition matches action
            $condition = $badge['condition'] ?? [];
            if (($condition['type'] ?? '') !== $actionType) {
                // Some badges might be checked on every post regardless of type mismatch if logic requires (e.g. time range)
                // But for simplicity, we map action types or generic checks.
            }

            $awarded = false;

            switch ($condition['type'] ?? '') {
                case 'post_count':
                    if (isset($context['post_count']) && $context['post_count'] >= $condition['threshold']) {
                        $awarded = true;
                    }
                    break;

                case 'species_count':
                    if (isset($context['species_count']) && $context['species_count'] >= $condition['threshold']) {
                        $awarded = true;
                    }
                    break;

                case 'id_count':
                    if (isset($context['id_count']) && $context['id_count'] >= $condition['threshold']) {
                        $awarded = true;
                    }
                    break;

                case 'taxon_id':
                    if (isset($context['taxon_id_counts'])) {
                        $count = 0;
                        foreach ($condition['groups'] as $group) {
                            $count += $context['taxon_id_counts'][$group] ?? 0;
                        }
                        if ($count >= $condition['threshold']) {
                            $awarded = true;
                        }
                    }
                    break;

                case 'taxon_diversity':
                    if (isset($context['taxon_id_counts'])) {
                        $diverseCount = count(array_filter($context['taxon_id_counts'], fn($c) => $c >= 1));
                        if ($diverseCount >= $condition['threshold']) {
                            $awarded = true;
                        }
                    }
                    break;

                case 'trust_level':
                    if (isset($context['trust_level']) && $context['trust_level'] >= $condition['threshold']) {
                        $awarded = true;
                    }
                    break;

                case 'my_field_count':
                    if (isset($context['my_field_count']) && $context['my_field_count'] >= $condition['threshold']) {
                        $awarded = true;
                    }
                    break;

                case 'my_field_obs_count':
                    if (isset($context['my_field_total_obs']) && $context['my_field_total_obs'] >= $condition['threshold']) {
                        $awarded = true;
                    }
                    break;

                case 'my_field_score':
                    if (isset($context['my_field_max_score']) && $context['my_field_max_score'] >= $condition['threshold']) {
                        $awarded = true;
                    }
                    break;

                case 'time_range':
                    // Check if current post time fits
                    if ($actionType === 'post_created' && isset($context['timestamp'])) {
                        $time = date('H:i', $context['timestamp']);
                        $start = $condition['start'];
                        $end = $condition['end'];
                        // Handle overnight range (e.g. 20:00 - 04:00)
                        if ($start > $end) {
                            if ($time >= $start || $time <= $end) $awarded = true;
                        } else {
                            if ($time >= $start && $time <= $end) $awarded = true;
                        }
                    }
                    break;
                case 'survey_count':
                    if (isset($context['survey_count']) && $context['survey_count'] >= $condition['threshold']) {
                        $awarded = true;
                    }
                    break;
            }

            if ($awarded) {
                $awardData = [
                    'id' => $badge['id'],
                    'awarded_at' => time(),
                    'definition' => $badge // cache definition in case it changes
                ];
                $userBadges[] = $awardData;
                $newBadges[] = $badge;
            }
        }

        if (!empty($newBadges)) {
            $savePath = self::USER_BADGES_DIR . '/' . $userId . '.json';
            $res = file_put_contents($savePath, json_encode($userBadges, JSON_PRETTY_PRINT), LOCK_EX);

            // Flash to session for UI notification
            Auth::init();
            $_SESSION['new_badges'] = array_merge($_SESSION['new_badges'] ?? [], $newBadges);
        }

        return $newBadges;
    }
}
