<?php

require_once __DIR__ . '/DataStore.php';

class AppOAuthStateStore
{
    private const RESOURCE = 'fieldscan_oauth_states';
    private const TTL_SECONDS = 900;

    public static function issue(array $payload): string
    {
        $state = bin2hex(random_bytes(16));
        $rows = DataStore::get(self::RESOURCE) ?? [];
        $rows = self::prune($rows);
        $rows[] = [
            'state' => $state,
            'provider' => (string)($payload['provider'] ?? 'google'),
            'install_id' => (string)($payload['install_id'] ?? ''),
            'platform' => (string)($payload['platform'] ?? 'android'),
            'app_version' => (string)($payload['app_version'] ?? 'unknown'),
            'return_uri' => (string)($payload['return_uri'] ?? 'ikimonfieldscan://auth/callback'),
            'created_at' => time(),
        ];
        DataStore::save(self::RESOURCE, array_values($rows));
        return $state;
    }

    public static function consume(string $state): ?array
    {
        $state = trim($state);
        if ($state === '') {
            return null;
        }

        $rows = DataStore::get(self::RESOURCE) ?? [];
        $rows = self::prune($rows);
        $found = null;
        $remaining = [];

        foreach ($rows as $row) {
            if (($row['state'] ?? '') === $state && $found === null) {
                $found = $row;
                continue;
            }
            $remaining[] = $row;
        }

        DataStore::save(self::RESOURCE, array_values($remaining));
        return $found;
    }

    private static function prune(array $rows): array
    {
        $cutoff = time() - self::TTL_SECONDS;
        return array_values(array_filter($rows, static function ($row) use ($cutoff) {
            return (int)($row['created_at'] ?? 0) >= $cutoff;
        }));
    }
}
