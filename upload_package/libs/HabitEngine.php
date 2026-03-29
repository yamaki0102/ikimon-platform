<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/StreakTracker.php';
require_once __DIR__ . '/DataStore.php';

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
                'message' => '記録、同定、さんぽ、1分メモのどれか1つで今日の継続は成立する。まずは今日の1歩で十分。',
                'summary_line' => '記録 / 同定 / さんぽ / 1分メモ のどれかで継続成立。',
                'progress_line' => '続け方は人それぞれ。今日は小さく始めればいい。',
                'nature_timeline' => null,
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
            'title' => self::buildTitle($todayComplete, $streak),
            'message' => self::buildMessage($todayComplete, $streak),
            'summary_line' => $todayComplete
                ? '今日はもう自然との接続ができている。'
                : '今日は 記録 / 同定 / さんぽ / 1分メモ のどれかで継続成立。',
            'progress_line' => self::buildProgressLine($streak, $todayComplete),
            'nature_timeline' => self::getNatureTimeline($userId),
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
                'href' => 'profile.php',
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

    private static function buildTitle(bool $todayComplete, array $streak): string
    {
        $currentStreak = (int)($streak['current_streak'] ?? 0);

        if ($todayComplete) {
            if ($currentStreak >= 30) {
                return '今日の継続は達成済み。積み重ねがちゃんと形になっている';
            }

            if ($currentStreak >= 7) {
                return '今日の継続は達成済み。いい流れが続いている';
            }

            return '今日の継続は達成済み';
        }

        if ($currentStreak >= 7) {
            return '今日は1つだけでいい。ここまでの流れをつなごう';
        }

        return '今日は1つだけでいい。継続を積もう';
    }

    private static function buildMessage(bool $todayComplete, array $streak): string
    {
        $currentStreak = (int)($streak['current_streak'] ?? 0);
        $longestStreak = (int)($streak['longest_streak'] ?? 0);

        if ($todayComplete) {
            if ($currentStreak > 0 && $currentStreak === $longestStreak) {
                return '今日はもう自然とつながれている。しかも今の継続は自己ベストタイ。この調子で、無理なく続ければいい。';
            }

            if ($currentStreak >= 7) {
                return '今日はもう自然とつながれている。ここまで続いているのは、ちゃんとキミの力だ。このまま気楽に続ければいい。';
            }

            return '今日はもう自然とつながれている。小さくても続いていること自体が、もう十分に価値がある。';
        }

        if ($currentStreak >= 7) {
            return 'ここまで積み上げてきた流れがある。今日は1つだけで、その流れをやさしくつなげばいい。';
        }

        return '記録、同定、さんぽ、1分メモのどれか1つで今日の継続は成立する。まずは今日の1歩で十分。';
    }

    private static function buildProgressLine(array $streak, bool $todayComplete): string
    {
        $currentStreak = (int)($streak['current_streak'] ?? 0);
        $longestStreak = (int)($streak['longest_streak'] ?? 0);
        $recentActivity = $streak['recent_activity'] ?? [];
        $activeDays = is_array($recentActivity) ? count($recentActivity) : 0;

        if ($currentStreak > 0 && $currentStreak === $longestStreak) {
            return '自己ベストタイの ' . $currentStreak . '日連続。この積み重ねは、もう偶然じゃない。';
        }

        if ($activeDays >= 10) {
            $prefix = $todayComplete ? 'この30日で' : 'ここ30日で';
            return $prefix . ' ' . $activeDays . '日つながっている。続ける力は、もうキミの中にある。';
        }

        if ($currentStreak >= 3) {
            return $currentStreak . '日続けてきた流れがある。今日の1つも、その延長でいい。';
        }

        if ($longestStreak >= 3) {
            return 'これまでに最長 ' . $longestStreak . '日続けられている。積み上げられることは、もう証明済み。';
        }

        return $todayComplete
            ? '今日も1つ積めた。小さな継続でも、ちゃんと前に進んでいる。'
            : '続け方は人それぞれ。今日は小さく始めればいい。';
    }

    private static function getNatureTimeline(string $userId): ?array
    {
        return DataStore::getCached('habit_nature_timeline_' . md5($userId), 600, function () use ($userId) {
            $allObservations = DataStore::fetchAll('observations');
            $userObservations = array_values(array_filter($allObservations, function ($observation) use ($userId) {
                return isset($observation['user_id']) && (string)$observation['user_id'] === (string)$userId;
            }));

            if (empty($userObservations)) {
                return null;
            }

            usort($userObservations, function ($a, $b) {
                return strcmp(self::extractObservationTimestamp($a), self::extractObservationTimestamp($b));
            });

            $firstObservation = $userObservations[0];
            $monthCounts = [];
            $recentSpecies = [];
            $seenSpecies = [];

            foreach ($userObservations as $observation) {
                $timestamp = self::extractObservationTimestamp($observation);
                if ($timestamp !== '') {
                    $monthKey = substr($timestamp, 0, 7);
                    if (preg_match('/^\d{4}-\d{2}$/', $monthKey) === 1) {
                        $monthCounts[$monthKey] = ($monthCounts[$monthKey] ?? 0) + 1;
                    }
                }
            }

            for ($i = count($userObservations) - 1; $i >= 0; $i--) {
                $observation = $userObservations[$i];
                $speciesKey = self::extractSpeciesKey($observation);
                if ($speciesKey === '' || isset($seenSpecies[$speciesKey])) {
                    continue;
                }

                $seenSpecies[$speciesKey] = true;
                $recentSpecies[] = [
                    'name' => self::extractSpeciesName($observation),
                    'date' => self::formatDateLabel(self::extractObservationTimestamp($observation)),
                ];

                if (count($recentSpecies) >= 3) {
                    break;
                }
            }

            arsort($monthCounts);
            $bestMonth = array_key_first($monthCounts);

            return [
                'headline' => '連続日数だけじゃない。キミの自然との関係は、ちゃんと積み上がっている。',
                'items' => [
                    [
                        'label' => 'はじまり',
                        'value' => self::formatDateLabel(self::extractObservationTimestamp($firstObservation)),
                        'detail' => '最初の記録を残した日',
                        'icon' => 'sprout',
                    ],
                    [
                        'label' => 'いちばん動いた月',
                        'value' => self::formatMonthLabel((string)$bestMonth),
                        'detail' => ($bestMonth && isset($monthCounts[$bestMonth]))
                            ? $monthCounts[$bestMonth] . '件の記録を重ねた'
                            : 'これから見つかる',
                        'icon' => 'calendar-heart',
                    ],
                    [
                        'label' => '最近見つけた種',
                        'value' => !empty($recentSpecies)
                            ? implode(' / ', array_column($recentSpecies, 'name'))
                            : 'まだこれから',
                        'detail' => !empty($recentSpecies)
                            ? implode(' ・ ', array_filter(array_column($recentSpecies, 'date')))
                            : 'またひとつ見つければ増えていく',
                        'icon' => 'bird',
                    ],
                ],
            ];
        });
    }

    private static function extractObservationTimestamp(array $observation): string
    {
        foreach (['observed_at', 'created_at', 'updated_at'] as $field) {
            $value = trim((string)($observation[$field] ?? ''));
            if ($value !== '') {
                return $value;
            }
        }

        return '';
    }

    private static function extractSpeciesKey(array $observation): string
    {
        $taxon = $observation['taxon'] ?? [];
        if (!is_array($taxon)) {
            return '';
        }

        foreach (['key', 'scientific_name', 'name'] as $field) {
            $value = trim((string)($taxon[$field] ?? ''));
            if ($value !== '' && $value !== '未同定') {
                return $value;
            }
        }

        return '';
    }

    private static function extractSpeciesName(array $observation): string
    {
        $taxon = $observation['taxon'] ?? [];
        if (!is_array($taxon)) {
            return '未同定';
        }

        $name = trim((string)($taxon['name'] ?? ''));
        if ($name !== '') {
            return $name;
        }

        $scientificName = trim((string)($taxon['scientific_name'] ?? ''));
        if ($scientificName !== '') {
            return $scientificName;
        }

        return '未同定';
    }

    private static function formatDateLabel(string $timestamp): string
    {
        if ($timestamp === '') {
            return 'これから';
        }

        try {
            $date = new DateTimeImmutable($timestamp);
            return $date->format('Y年n月j日');
        } catch (Exception $e) {
            return $timestamp;
        }
    }

    private static function formatMonthLabel(string $monthKey): string
    {
        if (preg_match('/^\d{4}-\d{2}$/', $monthKey) !== 1) {
            return 'これから';
        }

        [$year, $month] = explode('-', $monthKey, 2);
        return ((int)$year) . '年' . ((int)$month) . '月';
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
