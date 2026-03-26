<?php

require_once __DIR__ . '/Auth.php';
require_once __DIR__ . '/UserStore.php';

class AuthBridge
{
    private const TOKEN_TTL = 300;

    public static function issue(string $userId, string $redirect = 'index.php'): string
    {
        $token = bin2hex(random_bytes(32));
        $tokenHash = hash('sha256', $token);
        $records = self::loadTokens();
        $now = time();

        $records = array_values(array_filter($records, static function ($record) use ($now) {
            return ($record['expires'] ?? 0) > $now;
        }));

        $records[] = [
            'token_hash' => $tokenHash,
            'user_id' => $userId,
            'redirect' => self::sanitizeRedirect($redirect),
            'expires' => $now + self::TOKEN_TTL,
            'created_at' => date('Y-m-d H:i:s'),
        ];

        self::saveTokens($records);
        return $token;
    }

    public static function consume(string $token): ?array
    {
        if ($token === '' || !preg_match('/^[a-f0-9]{64}$/', $token)) {
            return null;
        }

        $tokenHash = hash('sha256', $token);
        $records = self::loadTokens();
        $now = time();
        $match = null;
        $remaining = [];

        foreach ($records as $record) {
            $expires = (int)($record['expires'] ?? 0);
            if ($expires <= $now) {
                continue;
            }
            if (($record['token_hash'] ?? '') === $tokenHash && $match === null) {
                $match = $record;
                continue;
            }
            $remaining[] = $record;
        }

        self::saveTokens($remaining);
        return $match;
    }

    public static function loginWithToken(string $token): ?array
    {
        $record = self::consume($token);
        if (!$record) {
            return null;
        }

        $user = UserStore::findById((string)($record['user_id'] ?? ''));
        if (!$user || !empty($user['banned'])) {
            return null;
        }

        $loginUser = $user;
        unset($loginUser['password_hash']);
        $loginUser['rank'] = $loginUser['rank'] ?? Auth::getRankLabel($loginUser);
        Auth::login($loginUser);

        return [
            'user' => $loginUser,
            'redirect' => self::sanitizeRedirect((string)($record['redirect'] ?? 'index.php')),
        ];
    }

    private static function sanitizeRedirect(string $redirect): string
    {
        if ($redirect === '' || preg_match('#^(//)#', $redirect) || strpos($redirect, ':') !== false || strpos($redirect, '\\') !== false) {
            return 'index.php';
        }
        return $redirect;
    }

    private static function getFilePath(): string
    {
        return DATA_DIR . '/auth_bridge_tokens.json';
    }

    private static function loadTokens(): array
    {
        $filePath = self::getFilePath();
        if (!file_exists($filePath)) {
            return [];
        }

        $fp = @fopen($filePath, 'r');
        if ($fp === false) {
            return [];
        }

        flock($fp, LOCK_SH);
        $json = stream_get_contents($fp);
        flock($fp, LOCK_UN);
        fclose($fp);

        if ($json === false || $json === '') {
            return [];
        }

        $records = json_decode($json, true);
        return is_array($records) ? $records : [];
    }

    private static function saveTokens(array $records): void
    {
        $filePath = self::getFilePath();
        $dir = dirname($filePath);
        if (!is_dir($dir)) {
            @mkdir($dir, 0700, true);
        }
        @file_put_contents($filePath, json_encode(array_values($records), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES), LOCK_EX);
    }
}
