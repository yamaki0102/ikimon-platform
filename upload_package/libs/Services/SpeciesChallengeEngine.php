<?php

declare(strict_types=1);

require_once __DIR__ . '/../RedListManager.php';

class SpeciesChallengeEngine
{
    private const SEASONS = [
        '春' => [3, 4, 5],
        '夏' => [6, 7, 8],
        '秋' => [9, 10, 11],
        '冬' => [12, 1, 2],
    ];

    private const SEASON_ICONS = [
        '春' => '🌸',
        '夏' => '☀️',
        '秋' => '🍂',
        '冬' => '❄️',
    ];

    private const QUANTITY_MILESTONES = [
        10 => '常連バッジ',
        30 => 'ベストフレンド',
    ];

    /**
     * @param array      $monthCounts     月別観察数 [1=>int,...,12=>int]
     * @param array|null $redList         RedListManager::lookup() の結果
     * @param array|null $userEntry       MyZukanService::getSpeciesDetail() の結果
     * @param array      $coOccurrence    co_occurrence.json 全体
     * @param array      $communityEntry  ZukanService taxon index の該当エントリ
     * @param array|null $userFoundSpecies ユーザーが観察済みの種名リスト (共起チャレンジ用)
     * @return array 最大3件のチャレンジ配列
     */
    public static function compute(
        array $monthCounts,
        ?array $redList,
        ?array $userEntry,
        array $coOccurrence,
        array $communityEntry,
        ?array $userFoundSpecies = null
    ): array {
        $challenges = [];
        $severity = self::getMaxSeverity($redList);
        $isEndangered = $severity >= 3; // VU=3, EN=4, CR=5, EW=6, EX=7

        if ($userEntry === null) {
            $challenges[] = [
                'type' => 'first_record',
                'label' => 'この種を初めて記録しよう！',
                'icon' => 'eye',
                'priority' => 10,
                'progress' => 0,
            ];
        }

        if (!$isEndangered && $userEntry !== null) {
            $challenges = array_merge($challenges, self::seasonChallenges($monthCounts, $userEntry));
        }

        if (!$isEndangered && $userEntry !== null) {
            $challenges = array_merge($challenges, self::quantityChallenges($userEntry, $communityEntry));
        }

        if ($userEntry !== null && $userFoundSpecies !== null) {
            $speciesName = $userEntry['name'] ?? '';
            $challenges = array_merge($challenges, self::coOccurrenceChallenges($speciesName, $coOccurrence, $userFoundSpecies));
        }

        if ($isEndangered && $userEntry !== null) {
            $challenges[] = [
                'type' => 'rare_gratitude',
                'label' => '貴重な記録をありがとう！',
                'icon' => 'shield',
                'priority' => 4,
                'progress' => 100,
            ];
        }

        usort($challenges, fn($a, $b) => $b['priority'] <=> $a['priority']);
        return array_slice($challenges, 0, 3);
    }

    private static function seasonChallenges(array $monthCounts, array $userEntry): array
    {
        $challenges = [];
        $communitySeasons = self::getCommunitySeasons($monthCounts);
        $userSeasons = self::getUserSeasons($userEntry['encounters'] ?? []);

        if (count($communitySeasons) < 2) return [];

        $missingSeasonsAchievable = [];
        foreach (self::SEASONS as $name => $months) {
            if (in_array($name, $communitySeasons) && !in_array($name, $userSeasons)) {
                $missingSeasonsAchievable[] = $name;
            }
        }

        if (empty($missingSeasonsAchievable)) return [];

        $completedCount = count($userSeasons);
        $achievableTotal = count($communitySeasons);

        if (count($missingSeasonsAchievable) === 1) {
            $season = $missingSeasonsAchievable[0];
            $icon = self::SEASON_ICONS[$season] ?? '📅';
            $challenges[] = [
                'type' => 'season_complete',
                'label' => "あと{$season}に記録すれば全シーズン制覇！ {$icon}",
                'icon' => 'trophy',
                'priority' => 9,
                'progress' => $achievableTotal > 0 ? (int)round(($completedCount / $achievableTotal) * 100) : 0,
            ];
        } else {
            $nextSeason = $missingSeasonsAchievable[0];
            $icon = self::SEASON_ICONS[$nextSeason] ?? '📅';
            $challenges[] = [
                'type' => 'season_record',
                'label' => "{$nextSeason}にも記録してみよう {$icon}",
                'icon' => 'calendar',
                'priority' => 5,
                'progress' => $achievableTotal > 0 ? (int)round(($completedCount / $achievableTotal) * 100) : 0,
            ];
        }

        return $challenges;
    }

    private static function quantityChallenges(array $userEntry, array $communityEntry): array
    {
        $challenges = [];
        $userCount = $userEntry['encounter_count'] ?? 0;
        $communityCount = $communityEntry['obs_count'] ?? 0;

        foreach (self::QUANTITY_MILESTONES as $threshold => $badgeName) {
            if ($userCount >= $threshold) continue;
            if ($communityCount < $threshold * 0.3) continue;

            $remaining = $threshold - $userCount;
            $challenges[] = [
                'type' => 'quantity_milestone',
                'label' => "あと{$remaining}回で{$badgeName}！",
                'icon' => 'trending-up',
                'priority' => 7,
                'progress' => (int)round(($userCount / $threshold) * 100),
            ];
            break;
        }

        return $challenges;
    }

    private static function coOccurrenceChallenges(string $speciesName, array $coOccurrence, array $userFoundSpecies): array
    {
        $challenges = [];

        foreach ($coOccurrence as $group) {
            $groupSpecies = $group['species'] ?? [];
            if (!in_array($speciesName, $groupSpecies)) continue;

            $others = array_filter($groupSpecies, fn($s) => $s !== $speciesName);
            $found = 0;
            $total = count($others);
            foreach ($others as $s) {
                if (in_array($s, $userFoundSpecies)) $found++;
            }

            $remaining = $total - $found;
            if ($remaining > 0 && $remaining <= $total && $total >= 2) {
                $groupName = $group['name'] ?? '';
                $challenges[] = [
                    'type' => 'co_occurrence',
                    'label' => "{$groupName}を制覇しよう（{$found}/{$total}種）",
                    'icon' => 'users',
                    'priority' => 6,
                    'progress' => $total > 0 ? (int)round(($found / $total) * 100) : 0,
                ];
                break;
            }
        }

        return $challenges;
    }

    private static function getCommunitySeasons(array $monthCounts): array
    {
        $seasons = [];
        foreach (self::SEASONS as $name => $months) {
            $total = 0;
            foreach ($months as $m) {
                $total += $monthCounts[$m] ?? 0;
            }
            if ($total > 0) $seasons[] = $name;
        }
        return $seasons;
    }

    private static function getUserSeasons(array $encounters): array
    {
        $seasons = [];
        foreach ($encounters as $enc) {
            $date = $enc['date'] ?? '';
            if (!$date) continue;
            $month = (int)date('n', strtotime($date));
            foreach (self::SEASONS as $name => $months) {
                if (in_array($month, $months) && !in_array($name, $seasons)) {
                    $seasons[] = $name;
                }
            }
        }
        return $seasons;
    }

    private static function getMaxSeverity(?array $redList): int
    {
        if (!$redList || !is_array($redList)) return 0;
        $max = 0;
        if (isset($redList['severity'])) return (int)($redList['severity'] ?? 0);
        if (isset($redList['results'])) {
            foreach ($redList['results'] as $entry) {
                $sev = (int)($entry['severity'] ?? 0);
                if ($sev > $max) $max = $sev;
            }
        }
        return $max;
    }
}
