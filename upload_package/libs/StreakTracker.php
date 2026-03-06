<?php
require_once __DIR__ . '/../config/config.php';

class StreakTracker
{
    const DIR = DATA_DIR . '/streaks';

    private static function path(string $userId): string
    {
        if (!is_dir(self::DIR)) mkdir(self::DIR, 0755, true);
        return self::DIR . '/' . $userId . '.json';
    }

    public static function getStreak(string $userId): array
    {
        $file = self::path($userId);
        if (!file_exists($file)) {
            return ['current_streak' => 0, 'longest_streak' => 0, 'last_active_date' => null];
        }
        return json_decode(file_get_contents($file), true) ?: [
            'current_streak' => 0,
            'longest_streak' => 0,
            'last_active_date' => null
        ];
    }

    public static function recordActivity(string $userId, ?string $date = null): array
    {
        $today = $date ?? date('Y-m-d');
        $data = self::getStreak($userId);
        $last = $data['last_active_date'];

        if ($last === $today) {
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

        file_put_contents(
            self::path($userId),
            json_encode($data, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_PRETTY_PRINT),
            LOCK_EX
        );

        return $data;
    }
}
