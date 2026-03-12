<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/StreakTracker.php';

class HabitEngine
{
    const REFLECTION_DIR = DATA_DIR . '/habit_reflections';
    const REFLECTION_LIMIT = 50;
    const REFLECTION_MAX_LENGTH = 120;

    public static function getTodayState(?string $userId): array
    {
        $labels = self::getLabels();
        $emptyActivity = [
            'date' => date('Y-m-d'),
            'types' => [],
            'last_recorded_at' => null,
            'context' => [],
        ];
        $emptyStreak = [
            'current_streak' => 0,
            'longest_streak' => 0,
            'last_active_date' => null,
            'recent_activity' => [],
        ];

        if (!$userId) {
            return [
                'labels' => $labels,
                'today_activity' => $emptyActivity,
                'streak' => $emptyStreak,
                'today_types' => [],
                'today_complete' => false,
                'remaining' => array_keys($labels),
                'title' => '今日は1つだけでいい。継続を積もう',
                'message' => '記録、同定、さんぽ、1分メモのどれか1つで今日の継続は成立する。',
                'summary_line' => '記録 / 同定 / さんぽ / 1分メモ のどれかで継続成立。',
                'reflection_note' => '',
                'latest_reflection' => null,
                'cta_options' => self::getCtaOptions([]),
            ];
        }

        $streak = StreakTracker::getStreak($userId);
        $todayActivity = StreakTracker::getActivitySummary($userId);
        $todayTypes = array_values($todayActivity['types'] ?? []);
        $todayComplete = !empty($todayTypes);
        $remaining = array_values(array_diff(array_keys($labels), $todayTypes));
        $reflectionNote = trim((string)($todayActivity['context']['reflection']['note'] ?? ''));

        return [
            'labels' => $labels,
            'today_activity' => $todayActivity,
            'streak' => $streak,
            'today_types' => $todayTypes,
            'today_complete' => $todayComplete,
            'remaining' => $remaining,
            'title' => $todayComplete ? '今日の継続は達成済み' : '今日は1つだけでいい。継続を積もう',
            'message' => $todayComplete
                ? '今日はもう自然との接続ができている。このまま気楽に続ければいい。'
                : '記録、同定、さんぽ、1分メモのどれか1つで今日の継続は成立する。',
            'summary_line' => $todayComplete
                ? '今日はもう自然との接続ができている。'
                : '今日は 記録 / 同定 / さんぽ / 1分メモ のどれかで継続成立。',
            'reflection_note' => $reflectionNote,
            'latest_reflection' => self::getLatestReflection($userId),
            'cta_options' => self::getCtaOptions($todayTypes),
        ];
    }

    public static function recordReflection(string $userId, string $note, array $meta = []): array
    {
        $cleanNote = self::sanitizeReflection($note);
        if ($cleanNote === '') {
            throw new InvalidArgumentException('ひとことメモを入力してください。');
        }

        $entry = [
            'id' => 'ref_' . bin2hex(random_bytes(4)),
            'user_id' => $userId,
            'note' => $cleanNote,
            'created_at' => date('c'),
        ];

        $source = trim((string)($meta['source'] ?? ''));
        if ($source !== '') {
            $entry['source'] = mb_substr($source, 0, 40);
        }

        $reflectionData = self::loadReflectionEntries($userId);
        $reflectionData[] = $entry;
        if (count($reflectionData) > self::REFLECTION_LIMIT) {
            $reflectionData = array_slice($reflectionData, -self::REFLECTION_LIMIT);
        }

        self::saveReflectionEntries($userId, $reflectionData);

        StreakTracker::recordActivity($userId, 'reflection', null, [
            'note' => $cleanNote,
            'entry_id' => $entry['id'],
        ]);

        return $entry;
    }

    public static function getLatestReflection(string $userId): ?array
    {
        $entries = self::loadReflectionEntries($userId);
        if (empty($entries)) {
            return null;
        }

        $latest = end($entries);
        return is_array($latest) ? $latest : null;
    }

    public static function getLabels(): array
    {
        return [
            'post' => '記録',
            'identification' => '同定',
            'walk' => 'さんぽ',
            'reflection' => '1分メモ',
        ];
    }

    public static function getCtaOptions(array $todayTypes = []): array
    {
        $done = array_fill_keys($todayTypes, true);

        return [
            'post' => [
                'type' => 'link',
                'href' => 'post.php',
                'icon' => 'camera',
                'label' => '記録する',
                'detail' => '1件で継続成立',
                'icon_class' => !empty($done['post']) ? 'text-emerald-600' : 'text-primary',
            ],
            'walk' => [
                'type' => 'link',
                'href' => 'ikimon_walk.php',
                'icon' => 'footprints',
                'label' => 'さんぽする',
                'detail' => '短い外出でもOK',
                'icon_class' => !empty($done['walk']) ? 'text-emerald-600' : 'text-emerald-600',
            ],
            'identification' => [
                'type' => 'link',
                'href' => 'id_workbench.php',
                'icon' => 'search',
                'label' => '同定する',
                'detail' => '他の人を助ける',
                'icon_class' => !empty($done['identification']) ? 'text-emerald-600' : 'text-sky-600',
            ],
            'reflection' => [
                'type' => 'button',
                'icon' => 'pen-square',
                'label' => '1分メモ',
                'detail' => '雨の日の継続',
                'icon_class' => !empty($done['reflection']) ? 'text-emerald-600' : 'text-amber-600',
            ],
        ];
    }

    public static function previewNote(?string $note, int $length = 48): string
    {
        $value = trim((string)$note);
        if ($value === '') {
            return '';
        }

        if (function_exists('mb_strimwidth')) {
            return mb_strimwidth($value, 0, $length, '…', 'UTF-8');
        }

        return strlen($value) > $length ? substr($value, 0, $length) . '...' : $value;
    }

    private static function sanitizeReflection(string $note): string
    {
        $cleanNote = preg_replace('/\s+/u', ' ', trim($note));
        return mb_substr((string)$cleanNote, 0, self::REFLECTION_MAX_LENGTH);
    }

    private static function loadReflectionEntries(string $userId): array
    {
        $file = self::reflectionPath($userId);
        if (!file_exists($file)) {
            return [];
        }

        $data = json_decode(file_get_contents($file), true);
        return is_array($data) ? $data : [];
    }

    private static function saveReflectionEntries(string $userId, array $entries): void
    {
        file_put_contents(
            self::reflectionPath($userId),
            json_encode(array_values($entries), JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_PRETTY_PRINT),
            LOCK_EX
        );
    }

    private static function reflectionPath(string $userId): string
    {
        if (!is_dir(self::REFLECTION_DIR)) {
            mkdir(self::REFLECTION_DIR, 0755, true);
        }

        return self::REFLECTION_DIR . '/' . $userId . '.json';
    }
}
