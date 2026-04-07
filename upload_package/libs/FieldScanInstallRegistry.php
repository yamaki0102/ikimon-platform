<?php

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/UserStore.php';

class FieldScanInstallRegistry
{
    public static function register(array $payload, ?array $authUser = null): array
    {
        $installId = trim((string)($payload['install_id'] ?? ''));
        if ($installId === '') {
            $installId = 'fsi_' . bin2hex(random_bytes(16));
        }

        $installs = DataStore::get('fieldscan_installs') ?? [];
        $existingIndex = null;
        $existing = null;

        foreach ($installs as $index => $install) {
            if (($install['install_id'] ?? '') === $installId) {
                $existingIndex = $index;
                $existing = $install;
                break;
            }
        }

        $user = $authUser ?: null;
        if ($user === null && $existing) {
            $user = UserStore::findById((string)($existing['user_id'] ?? ''));
        }
        if ($user === null) {
            $user = self::createAnonymousFieldScanUser($payload);
        }

        $now = date('c');
        $record = array_merge($existing ?? [], [
            'install_id' => $installId,
            'user_id' => $user['id'],
            'device' => (string)($payload['device'] ?? ($existing['device'] ?? 'unknown')),
            'platform' => (string)($payload['platform'] ?? ($existing['platform'] ?? 'android')),
            'app_version' => (string)($payload['app_version'] ?? ($existing['app_version'] ?? 'unknown')),
            'status' => 'active',
            'last_seen_at' => $now,
        ]);

        if (empty($record['created_at'])) {
            $record['created_at'] = $now;
        }

        if ($existingIndex === null) {
            $installs[] = $record;
        } else {
            $installs[$existingIndex] = $record;
        }

        DataStore::save('fieldscan_installs', array_values($installs));

        return [
            'install_id' => $installId,
            'status' => 'active',
            'user' => [
                'id' => $user['id'],
                'name' => $user['name'] ?? 'FieldScan User',
                'is_anonymous' => (bool)($user['is_anonymous'] ?? false),
            ],
        ];
    }

    public static function linkInstallToUser(string $installId, array $user): void
    {
        $installId = trim($installId);
        if ($installId === '' || empty($user['id'])) {
            return;
        }

        $installs = DataStore::get('fieldscan_installs') ?? [];
        foreach ($installs as $index => $install) {
            if (($install['install_id'] ?? '') !== $installId) {
                continue;
            }
            $installs[$index]['user_id'] = $user['id'];
            $installs[$index]['status'] = 'active';
            $installs[$index]['last_seen_at'] = date('c');
            DataStore::save('fieldscan_installs', array_values($installs));
            return;
        }

        self::register([
            'install_id' => $installId,
            'device' => 'unknown',
            'platform' => 'android',
            'app_version' => 'unknown',
        ], $user);
    }

    private static function createAnonymousFieldScanUser(array $payload): array
    {
        $users = DataStore::get('users') ?? [];
        $id = 'field_user_' . bin2hex(random_bytes(8));
        $installIdClean = preg_replace('/[^A-Za-z0-9]/', '', (string)($payload['install_id'] ?? ''));
        $suffix = strtoupper(substr($installIdClean, -4));
        if (strlen($suffix) < 4) {
            $suffix = strtoupper(substr(bin2hex(random_bytes(2)), 0, 4));
        }

        $user = [
            'id' => $id,
            'name' => 'FieldScan利用者 ' . $suffix,
            'email' => null,
            'password_hash' => null,
            'role' => 'Observer',
            'rank' => '観察者',
            'auth_provider' => 'fieldscan_install',
            'oauth_id' => (string)($payload['install_id'] ?? ''),
            'avatar' => "https://i.pravatar.cc/150?u={$id}",
            'created_at' => date('c'),
            'last_login_at' => null,
            'banned' => false,
            'is_anonymous' => true,
            'source' => 'fieldscan_app',
        ];

        $users[] = $user;
        DataStore::save('users', $users);
        return $user;
    }
}
