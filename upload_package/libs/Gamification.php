<?php
require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/Notification.php';

class Gamification {
    
    // Point Rules
    const POINTS_POST = 10;
    const POINTS_ID = 5;
    const POINTS_RG = 20; // Bonus for reaching Research Grade

    // Badge Definitions (Thresholds)
    const BADGES = [
        'beginner_observer' => [
            'name' => 'ビギナー観察者',
            'icon' => 'camera',
            'color' => 'text-green-400',
            'condition' => ['type' => 'post', 'count' => 1]
        ],
        'observer' => [
            'name' => '観察者',
            'icon' => 'camera',
            'color' => 'text-blue-400',
            'condition' => ['type' => 'post', 'count' => 5]
        ],
        'pro_observer' => [
            'name' => 'プロ観察者',
            'icon' => 'star',
            'color' => 'text-yellow-400',
            'condition' => ['type' => 'post', 'count' => 20]
        ],
        'beginner_identifier' => [
            'name' => 'ビギナーガイド',
            'icon' => 'search',
            'color' => 'text-purple-400',
            'condition' => ['type' => 'id', 'count' => 1]
        ],
        'identifier' => [
            'name' => 'ガイド',
            'icon' => 'search-check',
            'color' => 'text-pink-400',
            'condition' => ['type' => 'id', 'count' => 10]
        ],
        'expert' => [
            'name' => '博士',
            'icon' => 'award',
            'color' => 'text-red-500',
            'condition' => ['type' => 'id', 'count' => 50]
        ]
    ];

    /**
     * Update user score and badges
     */
    public static function syncUserStats($userId) {
        $observations = DataStore::fetchAll('observations');
        
        $postCount = 0;
        $idCount = 0;
        $rgCount = 0;

        foreach ($observations as $obs) {
            // Count Posts
            if ($obs['user_id'] === $userId) {
                $postCount++;
                if ($obs['status'] === 'Research Grade') {
                    $rgCount++;
                }
            }
            
            // Count IDs
            if (isset($obs['identifications'])) {
                foreach ($obs['identifications'] as $id) {
                    if ($id['user_id'] === $userId) {
                        $idCount++;
                    }
                }
            }
        }

        // Calculate Score
        $score = ($postCount * self::POINTS_POST) + 
                 ($idCount * self::POINTS_ID) + 
                 ($rgCount * self::POINTS_RG);

        // Check Badges
        $user = DataStore::findById('users', $userId);
        if (!$user) return;

        $currentBadges = $user['badges'] ?? [];
        $newBadges = [];

        foreach (self::BADGES as $key => $badge) {
            if (in_array($key, $currentBadges)) continue;

            $earned = false;
            if ($badge['condition']['type'] === 'post' && $postCount >= $badge['condition']['count']) $earned = true;
            if ($badge['condition']['type'] === 'id' && $idCount >= $badge['condition']['count']) $earned = true;

            if ($earned) {
                $newBadges[] = $key;
                $currentBadges[] = $key;
                
                // Notify
                Notification::send(
                    $userId,
                    'badge_earned',
                    'バッジ獲得！: ' . $badge['name'],
                    '新しいバッジ「' . $badge['name'] . '」を獲得しました。',
                    'profile.php'
                );
            }
        }

        // Save
        $user['score'] = $score;
        $user['post_count'] = $postCount;
        $user['id_count'] = $idCount;
        $user['badges'] = $currentBadges;

        DataStore::upsert('users', $user);
        
        // Update Session if it's the current user
        if (session_status() === PHP_SESSION_NONE) session_start();
        if (isset($_SESSION['user']) && $_SESSION['user']['id'] === $userId) {
            $_SESSION['user'] = array_merge($_SESSION['user'], $user);
        }

        return $user;
    }

    public static function getBadgeDetails($key) {
        return self::BADGES[$key] ?? null;
    }
}
