<?php
require_once __DIR__ . '/DataStore.php';

class QuestManager {
    
    private static $quests = [
        ['id' => 'q_daily_1', 'type' => 'daily', 'icon' => 'bug', 'title' => '昆虫ハンター', 'description' => '昆虫を1匹見つけて投稿しよう！', 'target' => ['taxon' => 'Insecta', 'count' => 1], 'reward' => 100],
        ['id' => 'q_daily_2', 'type' => 'daily', 'icon' => 'camera', 'title' => '観察の達人', 'description' => '生き物の写真を3枚投稿しよう！', 'target' => ['count' => 3], 'reward' => 150],
        ['id' => 'q_weekly_1', 'type' => 'weekly', 'icon' => 'map', 'title' => '探検家', 'description' => '3つの違う場所で生き物を見つけよう', 'target' => ['unique_locations' => 3], 'reward' => 500],
    ];

    public static function getActiveQuests() {
        // In a real app, rotate these based on date
        // For MVP, return a fixed daily quest based on day of week
        $day = date('N'); // 1 (Mon) - 7 (Sun)
        $index = ($day - 1) % count(self::$quests);
        return [self::$quests[$index]];
    }

    public static function checkProgress($userId, $questId) {
        // Get Quest Definition
        $quest = null;
        foreach (self::$quests as $q) {
            if ($q['id'] === $questId) {
                $quest = $q;
                break;
            }
        }
        if (!$quest) return 0;

        // Daily Quest: Check Only Today's Activity
        $today = date('Y-m-d');
        
        $todays_activity = DataStore::getLatest('observations', 100, function($item) use ($userId, $today) {
            return ($item['user_id'] ?? '') === $userId && 
                   strpos($item['created_at'], $today) === 0;
        });

        // 1. Count Target
        if (isset($quest['target']['count'])) {
            $count = count($todays_activity);
            $target = $quest['target']['count'];
            return min(100, floor(($count / $target) * 100));
        }

        // 2. Taxon Target (e.g., "Find an Insect")
        if (isset($quest['target']['taxon'])) {
            $found = false;
            foreach ($todays_activity as $obs) {
                // Check if taxon class/order matches (Need enhanced DataStore or simplified check)
                // For MVP, check if 'taxon_name' contains specific text or using simple hierarchy if stored
                // Assuming 'taxon' field has 'class' or 'order'
                // Fallback: Just check if *any* ID was made for now
                if (!empty($obs['taxon']['name'])) {
                    $found = true;
                    break;
                }
            }
            return $found ? 100 : 0;
        }

        return 0;
    }
}
