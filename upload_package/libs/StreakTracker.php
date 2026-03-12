<?php
require_once __DIR__ . '/../config/config.php';

class StreakTracker
{
    const DIR = DATA_DIR . '/streaks';
    const RECENT_ACTIVITY_DAYS = 30;

    private static function path(string $userId): string
    {
        if (!is_dir(self::DIR)) mkdir(self::DIR, 0755, true);
        return self::DIR . '/' . $userId . '.json';
    }

    public static function getStreak(string $userId): array
    {
        $file = self::path($userId);
        if (!file_exists($file)) {
            return self::defaultData();
        }
        $data = json_decode(file_get_contents($file), true);
        if (!is_array($data)) {
            return self::defaultData();
        }

        return array_merge(self::defaultData(), $data);
    }

    public static function recordActivity(string $userId, ?string $typeOrDate = null, ?string $date = null, array $context = []): array
    {
        [$activityType, $activityDate] = self::normalizeArgs($typeOrDate, $date);

        $today = $activityDate ?? date('Y-m-d');
        $activityType = self::normalizeType($activityType);
        $data = self::getStreak($userId);
        $last = $data['last_active_date'];
        $data['recent_activity'] = self::trimRecentActivity($data['recent_activity'] ?? []);

        if ($last === $today) {
            $data['recent_activity'][$today] = self::mergeActivityDay(
                $data['recent_activity'][$today] ?? null,
                $activityType,
                $context
            );
            self::save($userId, $data);
            return $data;
        }

        $yesterday = date('Y-m-d', strtotime($today . ' -1 day'));

        if ($last === $yesterday) {
            $data['current_streak']++;
        } else {
            $data['current_streak'] = 1;
        }

        $data['last_active_date'] = $today;
        if ($data['current_streak'] > $data['longest_streak']) {
            $data['longest_streak'] = $data['current_streak'];
        }
        $data['recent_activity'][$today] = self::mergeActivityDay(
            $data['recent_activity'][$today] ?? null,
            $activityType,
            $context
        );
        $data['recent_activity'] = self::trimRecentActivity($data['recent_activity']);

        self::save($userId, $data);

        return $data;
    }

    public static function getActivitySummary(string $userId, ?string $date = null): array
    {
        $targetDate = $date ?? date('Y-m-d');
        $data = self::getStreak($userId);
        $day = $data['recent_activity'][$targetDate] ?? null;

        return [
            'date' => $targetDate,
            'types' => array_values($day['types'] ?? []),
            'last_recorded_at' => $day['last_recorded_at'] ?? null,
            'context' => $day['context'] ?? [],
        ];
    }

    private static function defaultData(): array
    {
        return [
            'current_streak' => 0,
            'longest_streak' => 0,
            'last_active_date' => null,
            'recent_activity' => [],
        ];
    }

    private static function save(string $userId, array $data): void
    {
        file_put_contents(
            self::path($userId),
            json_encode($data, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_PRETTY_PRINT),
            LOCK_EX
        );
    }

    private static function normalizeArgs(?string $typeOrDate, ?string $date): array
    {
        if ($date === null && self::isDateString($typeOrDate)) {
            return ['post', $typeOrDate];
        }

        return [$typeOrDate ?? 'post', $date];
    }

    private static function isDateString(?string $value): bool
    {
        return is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) === 1;
    }

    private static function normalizeType(?string $type): string
    {
        $allowed = ['post', 'identification', 'walk', 'reflection'];
        return in_array($type, $allowed, true) ? $type : 'post';
    }

    private static function mergeActivityDay(?array $existing, string $activityType, array $context): array
    {
        $types = $existing['types'] ?? [];
        if (!is_array($types)) {
            $types = [];
        }
        $types[$activityType] = $activityType;

        $mergedContext = $existing['context'] ?? [];
        if (!is_array($mergedContext)) {
            $mergedContext = [];
        }
        if (!empty($context)) {
            $mergedContext[$activityType] = $context;
        }

        return [
            'types' => $types,
            'last_recorded_at' => date('c'),
            'context' => $mergedContext,
        ];
    }

    private static function trimRecentActivity(array $recentActivity): array
    {
        if (empty($recentActivity)) {
            return [];
        }

        ksort($recentActivity);
        return array_slice($recentActivity, -self::RECENT_ACTIVITY_DAYS, null, true);
    }
}
