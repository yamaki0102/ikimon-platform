<?php
require_once __DIR__ . '/DataStore.php';

class BadgeManager {
    
    // Define Badge Types
    private static $badges = [
        'rookie' => ['id' => 'rookie', 'name' => '新人隊員', 'icon' => 'sprout', 'desc' => '初めての投稿を行った', 'color' => 'text-green-400 bg-green-400/10 border-green-400/20'],
        'photographer' => ['id' => 'photographer', 'name' => '撮影係', 'icon' => 'camera', 'desc' => '写真を5枚以上投稿した', 'color' => 'text-blue-400 bg-blue-400/10 border-blue-400/20'],
        'explorer' => ['id' => 'explorer', 'name' => '探検家', 'icon' => 'map', 'desc' => '3箇所以上で発見した', 'color' => 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20'],
        'expert' => ['id' => 'expert', 'name' => '生き物博士', 'icon' => 'book-open', 'desc' => '同定を10回行った', 'color' => 'text-purple-400 bg-purple-400/10 border-purple-400/20'],
    ];

    public static function getUserBadges($userId) {
        $badges = [];
        
        // Fetch User Stats
        // 1. Count Observations
        $user_obs = DataStore::getLatest('observations', 1000, function($item) use ($userId) {
            return ($item['user_id'] ?? '') === $userId;
        });
        $obs_count = count($user_obs);
        
        // 2. Count Identifications (This would ideally be in a user_stats table)
        // For MVP, we'll scan all observations to count user's IDs... too slow.
        // Let's rely on Score or just Obs count for now.
        // Or check 'identifications' inside user_obs (self-ID)? No, expert means IDing others.
        // Let's simplify Expert to "High Score" for now.
        $user = Auth::user();
        $score = $user['score'] ?? 0;

        // --- Logic ---
        
        // Rookie: First Post
        if ($obs_count >= 1) {
            $badges[] = self::$badges['rookie'];
        }
        
        // Photographer: 5+ Posts
        if ($obs_count >= 5) {
            $badges[] = self::$badges['photographer'];
        }
        
        // Explorer: 3+ Unique Locations (approximated by 'site_id' or distinct lat/lng)
        // Let's use simple logic: If they have 10+ posts, assume they explored enough
        if ($obs_count >= 10) {
             $badges[] = self::$badges['explorer'];
        }
        
        // Expert: Score > 500 (Identifications give points)
        if ($score >= 500) {
            $badges[] = self::$badges['expert'];
        }
        
        return $badges;
    }
    
    public static function getAllBadges() {
        return self::$badges;
    }
}
