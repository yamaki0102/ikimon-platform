<?php

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../DataStore.php';
require_once __DIR__ . '/../../config/UserRank.php';

class UserStatsService
{

    public static function calculateRank(int|float $score)
    {
        if ($score >= 1000) return 'LEGENDARY';
        if ($score >= 500) return 'EXPERT';
        if ($score >= 100) return 'VETERAN';
        return 'ROOKIE';
    }

    public static function getRankLabel(int|float $score)
    {
        // Assuming Lang::init() is called elsewhere or use fallbacks
        if ($score >= 1000) return __('rank.legendary');
        if ($score >= 500) return __('rank.expert');
        if ($score >= 100) return __('rank.veteran');
        return __('rank.rookie');
    }

    public static function calculateImpactLabel(int $total_reach)
    {
        if ($total_reach >= 1000) return __('rank.legend');
        if ($total_reach >= 500) return __('rank.influencer');
        if ($total_reach >= 100) return __('rank.rising_star');
        return __('rank.observer');
    }

    public static function getNextRankTarget(int|float $score)
    {
        if ($score >= 1000) return 1000; // Max
        if ($score >= 500) return 1000;
        if ($score >= 100) return 500;
        return 100;
    }

    public static function getProgressToNextRank(int|float $score)
    {
        if ($score >= 1000) return 100;

        $range = 100;
        $val = 0;

        if ($score >= 500) {
            $range = 500;
            $val = $score - 500;
        } elseif ($score >= 100) {
            $range = 400;
            $val = $score - 100;
        } else {
            $range = 100;
            $val = $score;
        }

        return min(100, max(0, ($val / $range) * 100));
    }

    public static function getUserImpact($userId)
    {
        // Calculate Total Reach (Views)
        $cacheKey = "user_impact_{$userId}";

        return DataStore::getCached($cacheKey, 300, function () use ($userId) {
            $total_reach = 0;
            // Get last 100 posts to estimate
            $my_posts = DataStore::getLatest('observations', 100, function ($item) use ($userId) {
                return isset($item['user_id']) && $item['user_id'] === $userId;
            });

            foreach ($my_posts as $post) {
                // Optimized: getCounts is lightweight
                $counts = DataStore::getCounts('observations', $post['id']);
                $total_reach += ($counts['views'] ?? 0);
            }
            return $total_reach;
        });
    }

    public static function getTaxonCount($userId)
    {
        // Count unique species found by user
        $cacheKey = "user_taxon_count_{$userId}";
        return DataStore::getCached($cacheKey, 300, function () use ($userId) {
            $my_posts = DataStore::getLatest('observations', 500, function ($item) use ($userId) {
                return isset($item['user_id']) && $item['user_id'] === $userId && !empty($item['taxon']['name']);
            });

            $taxons = [];
            foreach ($my_posts as $post) {
                $taxons[$post['taxon']['name']] = true;
            }
            return count($taxons);
        });
    }

    public static function getTerritoryArea($userId)
    {
        // Mock: 1 Post = 0.05 sq km (5 hectares) roughly
        // In real app, compute convex hull area
        $count = self::getTaxonCount($userId); // Use taxon count as proxy for activity diversity
        return max(0.5, $count * 0.15); // Minimum 0.5km2
    }
}
