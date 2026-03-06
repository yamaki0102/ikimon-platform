<?php
require_once __DIR__ . '/../config/config.php';

class EventLog
{
    const DIR = DATA_DIR . '/user_events';
    const MAX_ENTRIES = 200;

    private static function path(string $userId): string
    {
        if (!is_dir(self::DIR)) mkdir(self::DIR, 0755, true);
        return self::DIR . '/' . $userId . '.json';
    }

    private static function load(string $userId): array
    {
        $file = self::path($userId);
        if (!file_exists($file)) return [];
        return json_decode(file_get_contents($file), true) ?: [];
    }

    private static function save(string $userId, array $entries): void
    {
        if (count($entries) > self::MAX_ENTRIES) {
            $entries = array_slice($entries, -self::MAX_ENTRIES);
        }
        file_put_contents(
            self::path($userId),
            json_encode($entries, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_PRETTY_PRINT),
            LOCK_EX
        );
    }

    public static function log(string $userId, string $type, array $data = []): void
    {
        $entries = self::load($userId);
        $entries[] = [
            'type' => $type,
            'data' => $data,
            'created_at' => date('Y-m-d H:i:s'),
        ];
        self::save($userId, $entries);
    }

    public static function getRecent(string $userId, int $limit = 20): array
    {
        $entries = self::load($userId);
        return array_slice(array_reverse($entries), 0, $limit);
    }

    public static function getByType(string $userId, string $type): array
    {
        return array_values(array_filter(
            self::load($userId),
            fn($e) => ($e['type'] ?? '') === $type
        ));
    }
}
