<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';

class UserStore
{
    public static function getAll($includeSeed = false)
    {
        $users = DataStore::get('users');
        if ($includeSeed) return $users;
        return array_values(array_filter($users, function ($u) {
            return empty($u['is_seed']);
        }));
    }

    public static function saveAll($users)
    {
        return DataStore::save('users', $users);
    }

    public static function findByEmail($email)
    {
        $email = strtolower(trim($email));
        foreach (DataStore::get('users') as $u) {
            if (!empty($u['email']) && strtolower($u['email']) === $email) return $u;
        }
        return null;
    }

    public static function findById($id)
    {
        foreach (DataStore::get('users') as $u) {
            if (($u['id'] ?? '') === $id) return $u;
        }
        return null;
    }

    public static function create($name, $email, $password, $role = 'Observer', $rank = '観察者')
    {
        $users = DataStore::get('users');
        $email = strtolower(trim($email));
        $id = uniqid('user_');

        $users[] = [
            'id' => $id,
            'name' => $name,
            'email' => $email,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'role' => $role,
            'rank' => $rank,
            'auth_provider' => 'local',
            'oauth_id' => null,
            'avatar' => "https://i.pravatar.cc/150?u={$id}",
            'created_at' => date('Y-m-d H:i:s'),
            'last_login_at' => null,
            'banned' => false
        ];

        DataStore::save('users', $users);
        return end($users);
    }

    public static function update($id, $fields)
    {
        $users = DataStore::get('users');
        $updated = null;
        foreach ($users as $i => $u) {
            if (($u['id'] ?? '') !== $id) continue;
            $users[$i] = array_merge($u, $fields);
            $updated = $users[$i];
            break;
        }
        DataStore::save('users', $users);
        return $updated;
    }

    /**
     * Find user by OAuth provider and provider-specific UID
     */
    public static function findByOAuth(string $provider, string $oauthId): ?array
    {
        foreach (DataStore::get('users') as $u) {
            if (($u['auth_provider'] ?? '') === $provider && ($u['oauth_id'] ?? '') === $oauthId) {
                return $u;
            }
        }
        return null;
    }

    /**
     * Create a user from OAuth profile (no password)
     */
    public static function createFromOAuth(array $profile): array
    {
        $users = DataStore::get('users');
        $id = uniqid('user_');
        $email = strtolower(trim($profile['email'] ?? ''));

        $user = [
            'id' => $id,
            'name' => $profile['name'] ?? 'ikimon user',
            'email' => $email,
            'password_hash' => null,
            'role' => 'Observer',
            'rank' => '観察者',
            'auth_provider' => $profile['provider'],
            'oauth_id' => $profile['id'],
            'avatar' => $profile['avatar_url'] ?: "https://i.pravatar.cc/150?u={$id}",
            'created_at' => date('Y-m-d H:i:s'),
            'last_login_at' => null,
            'banned' => false
        ];

        $users[] = $user;
        DataStore::save('users', $users);
        return $user;
    }

    /**
     * Link OAuth to existing user (for account merging)
     */
    public static function linkOAuth(string $userId, string $provider, string $oauthId, string $avatarUrl = ''): ?array
    {
        $fields = [
            'auth_provider' => $provider,
            'oauth_id' => $oauthId,
        ];
        if ($avatarUrl) {
            $fields['avatar'] = $avatarUrl;
        }
        return self::update($userId, $fields);
    }
}
