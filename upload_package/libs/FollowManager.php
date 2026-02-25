<?php

/**
 * FollowManager - Manages follow relationships (user→user, user→site)
 * 
 * Data is stored as JSON in data/follows/{userId}.json
 * Structure: { "users": ["user_id_1", ...], "sites": ["site_id_1", ...] }
 */

require_once __DIR__ . '/../config/config.php';

class FollowManager
{
    private const FOLLOWS_DIR = DATA_DIR . '/follows';

    /**
     * Get all follows for a user
     */
    public static function getFollows(string $userId): array
    {
        $file = self::getFilePath($userId);
        if (!file_exists($file)) {
            return ['users' => [], 'sites' => []];
        }
        $data = json_decode(file_get_contents($file), true);
        return [
            'users' => $data['users'] ?? [],
            'sites' => $data['sites'] ?? [],
        ];
    }

    /**
     * Follow a user or site
     */
    public static function follow(string $userId, string $targetId, string $type = 'users'): bool
    {
        if (!in_array($type, ['users', 'sites'])) return false;
        if ($type === 'users' && $userId === $targetId) return false; // Can't follow yourself

        $follows = self::getFollows($userId);
        if (!in_array($targetId, $follows[$type])) {
            $follows[$type][] = $targetId;
            self::save($userId, $follows);
        }
        return true;
    }

    /**
     * Unfollow a user or site
     */
    public static function unfollow(string $userId, string $targetId, string $type = 'users'): bool
    {
        if (!in_array($type, ['users', 'sites'])) return false;

        $follows = self::getFollows($userId);
        $follows[$type] = array_values(array_filter($follows[$type], fn($id) => $id !== $targetId));
        self::save($userId, $follows);
        return true;
    }

    /**
     * Check if a user is following a target
     */
    public static function isFollowing(string $userId, string $targetId, string $type = 'users'): bool
    {
        $follows = self::getFollows($userId);
        return in_array($targetId, $follows[$type] ?? []);
    }

    /**
     * Get follower count for a user
     */
    public static function getFollowerCount(string $targetUserId): int
    {
        $dir = self::FOLLOWS_DIR;
        if (!is_dir($dir)) return 0;

        $count = 0;
        foreach (glob($dir . '/*.json') as $file) {
            $data = json_decode(file_get_contents($file), true);
            if (in_array($targetUserId, $data['users'] ?? [])) {
                $count++;
            }
        }
        return $count;
    }

    /**
     * Get followed user IDs (for feed filtering)
     */
    public static function getFollowedUserIds(string $userId): array
    {
        return self::getFollows($userId)['users'];
    }

    /**
     * Get followed site IDs (for feed filtering)
     */
    public static function getFollowedSiteIds(string $userId): array
    {
        return self::getFollows($userId)['sites'];
    }

    // --- Private ---

    private static function getFilePath(string $userId): string
    {
        return self::FOLLOWS_DIR . '/' . $userId . '.json';
    }

    private static function save(string $userId, array $follows): void
    {
        $dir = self::FOLLOWS_DIR;
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        file_put_contents(
            self::getFilePath($userId),
            json_encode($follows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE),
            LOCK_EX
        );
    }
}
