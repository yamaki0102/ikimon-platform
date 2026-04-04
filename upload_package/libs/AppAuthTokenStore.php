<?php

require_once __DIR__ . '/DataStore.php';

class AppAuthTokenStore
{
    private const RESOURCE = 'fieldscan_app_tokens';
    private const TTL_SECONDS = 7776000; // 90 days

    public static function issue(string $userId, ?string $installId = null): array
    {
        $token = bin2hex(random_bytes(32));
        $record = [
            'id' => uniqid('fat_'),
            'token_hash' => hash('sha256', $token),
            'user_id' => $userId,
            'install_id' => $installId,
            'status' => 'active',
            'expires_at' => date('c', time() + self::TTL_SECONDS),
            'created_at' => date('c'),
            'last_used_at' => null,
        ];

        $tokens = DataStore::get(self::RESOURCE) ?? [];
        $tokens[] = $record;
        DataStore::save(self::RESOURCE, array_values($tokens));

        return [
            'token' => $token,
            'expires_at' => $record['expires_at'],
        ];
    }

    public static function resolve(?string $token): ?array
    {
        $token = trim((string)$token);
        if ($token === '') {
            return null;
        }

        $hash = hash('sha256', $token);
        $tokens = DataStore::get(self::RESOURCE) ?? [];
        $found = null;

        foreach ($tokens as $index => $record) {
            if (($record['token_hash'] ?? '') !== $hash) {
                continue;
            }
            if (($record['status'] ?? 'active') !== 'active') {
                return null;
            }
            $expiresAt = strtotime((string)($record['expires_at'] ?? ''));
            if (!$expiresAt || $expiresAt < time()) {
                $tokens[$index]['status'] = 'expired';
                DataStore::save(self::RESOURCE, array_values($tokens));
                return null;
            }
            $tokens[$index]['last_used_at'] = date('c');
            $found = $tokens[$index];
            DataStore::save(self::RESOURCE, array_values($tokens));
            break;
        }

        return $found;
    }
}
