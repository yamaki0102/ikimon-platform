<?php

/**
 * TrustLevel.php — Trust Level System (Hidden)
 *
 * Calculates and manages user trust levels for identification quality.
 * This is a BACKEND-ONLY system - trust levels are NEVER shown to users.
 * Used internally to weight identifications in Research Grade decisions.
 *
 * Trust levels:
 *   1 = New observer (default)
 *   2 = Regular contributor (10+ observations)
 *   3 = Experienced identifier (20+ identifications with agreement)
 *   4 = Expert (50+ identifications with high agreement rate)
 *   5 = Verified expert (manually elevated by admin)
 */

class TrustLevel
{

    /** Trust level thresholds */
    const LEVEL_NEW = 1;
    const LEVEL_REGULAR = 2;
    const LEVEL_EXPERIENCED = 3;
    const LEVEL_EXPERT = 4;
    const LEVEL_VERIFIED = 5;

    /** Weight multipliers for Research Grade calculation */
    const WEIGHTS = [
        1 => 0.5,
        2 => 1.0,
        3 => 1.5,
        4 => 2.0,
        5 => 3.0,
    ];

    /** Rank Definitions (Name, Icon, Color) */
    const RANKS = [
        1 => ['name' => 'Observer',    'label' => '観察者',       'icon' => '🌱', 'color' => 'text-gray-500',   'bg' => 'bg-gray-100',   'border' => 'border-gray-200'],
        2 => ['name' => 'Naturalist',  'label' => 'ナチュラリスト', 'icon' => '🦋', 'color' => 'text-green-600',  'bg' => 'bg-green-50',   'border' => 'border-green-200'],
        3 => ['name' => 'Ranger',      'label' => 'レンジャー',     'icon' => '🔭', 'color' => 'text-blue-600',   'bg' => 'bg-blue-50',    'border' => 'border-blue-200'],
        4 => ['name' => 'Guardian',    'label' => 'ガーディアン',   'icon' => '🛡️', 'color' => 'text-purple-600', 'bg' => 'bg-purple-50',  'border' => 'border-purple-200'],
        5 => ['name' => 'Sage',        'label' => '賢者',         'icon' => '🦉', 'color' => 'text-amber-600',  'bg' => 'bg-amber-50',   'border' => 'border-amber-200'],
    ];

    /**
     * Calculate a user's trust level based on their activity.
     *
     * @param string $userId
     * @return int Trust level (1-5)
     */
    public static function calculate(string $userId): int
    {
        // Check if manually elevated
        $overrideFile = DATA_DIR . '/trust_overrides/' . $userId . '.json';
        if (file_exists($overrideFile)) {
            $override = json_decode(file_get_contents($overrideFile), true);
            if (isset($override['level'])) {
                return (int)$override['level'];
            }
        }

        $allObs = DataStore::fetchAll('observations');

        // Count user's observations
        $obsCount = count(array_filter($allObs, fn($o) => ($o['user_id'] ?? '') === $userId));

        // Count identifications AND agreement rate
        $idCount = 0;
        $agreedCount = 0;

        foreach ($allObs as $obs) {
            if (($obs['user_id'] ?? '') === $userId) continue;

            foreach ($obs['identifications'] ?? [] as $identification) {
                if (($identification['user_id'] ?? '') !== $userId) continue;

                $idCount++;

                // Check if this identification was agreed upon
                // (if the final taxon matches this identification)
                $finalTaxon = $obs['taxon']['name'] ?? '';
                $idTaxon = $identification['taxon_name'] ?? '';
                if ($finalTaxon && $idTaxon && $finalTaxon === $idTaxon) {
                    $agreedCount++;
                }
            }
        }

        // Determine level
        if ($idCount >= 50 && ($agreedCount / $idCount) >= 0.7) {
            return self::LEVEL_EXPERT;
        }
        if ($idCount >= 20 && ($agreedCount / $idCount) >= 0.5) {
            return self::LEVEL_EXPERIENCED;
        }
        if ($obsCount >= 10) {
            return self::LEVEL_REGULAR;
        }

        return self::LEVEL_NEW;
    }

    /**
     * Get the weight multiplier for a user's trust level.
     *
     * @param string $userId
     * @return float
     */
    public static function getWeight(string $userId): float
    {
        $level = self::calculate($userId);
        return self::WEIGHTS[$level] ?? 1.0;
    }

    /**
     * Get rank metadata for a given level.
     *
     * @param int $level
     * @return array
     */
    public static function getRankInfo(int $level): array
    {
        return self::RANKS[$level] ?? self::RANKS[self::LEVEL_NEW];
    }

    /**
     * Check if identifications meet Research Grade threshold.
     * Uses weighted votes based on trust levels.
     *
     * @param array $identifications Array of identification records
     * @param string $proposedTaxon The taxon name being evaluated
     * @return array ['is_research_grade' => bool, 'weighted_score' => float, 'threshold' => float]
     */
    public static function evaluateResearchGrade(array $identifications, string $proposedTaxon): array
    {
        $threshold = 2.0; // Weighted votes needed for Research Grade
        $weightedFor = 0.0;
        $weightedAgainst = 0.0;

        foreach ($identifications as $id) {
            $userId = $id['user_id'] ?? '';
            $weight = self::getWeight($userId);

            if (($id['taxon_name'] ?? '') === $proposedTaxon) {
                $weightedFor += $weight;
            } else {
                $weightedAgainst += $weight;
            }
        }

        $netScore = $weightedFor - $weightedAgainst;

        return [
            'is_research_grade' => $netScore >= $threshold,
            'weighted_score'    => $netScore,
            'threshold'         => $threshold,
            'votes_for'         => $weightedFor,
            'votes_against'     => $weightedAgainst,
        ];
    }

    /**
     * Set a manual trust level override (admin only).
     *
     * @param string $userId
     * @param int $level
     * @param string $reason
     * @return bool
     */
    public static function setOverride(string $userId, int $level, string $reason = ''): bool
    {
        $dir = DATA_DIR . '/trust_overrides';
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        $data = [
            'level'  => max(1, min(5, $level)),
            'reason' => $reason,
            'set_at' => date('c'),
        ];

        return file_put_contents($dir . '/' . $userId . '.json', json_encode($data, JSON_PRETTY_PRINT)) !== false;
    }
}
