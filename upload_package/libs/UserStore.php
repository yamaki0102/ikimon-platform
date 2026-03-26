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
     * Find user by secondary email (google_email, emails array)
     */
    public static function findBySecondaryEmail(string $email): ?array
    {
        $email = strtolower(trim($email));
        if (empty($email)) return null;

        foreach (DataStore::get('users') as $u) {
            // Check google_email field
            if (!empty($u['google_email']) && strtolower($u['google_email']) === $email) {
                return $u;
            }
            // Check emails array
            $emails = $u['emails'] ?? [];
            foreach ($emails as $e) {
                if (strtolower(trim($e)) === $email) return $u;
            }
        }
        return null;
    }

    /**
     * Find user by OAuth provider and provider-specific UID.
     * Checks both primary oauth_id and oauth_providers array.
     */
    public static function findByOAuth(string $provider, string $oauthId): ?array
    {
        foreach (DataStore::get('users') as $u) {
            $matched = false;

            // Primary match
            if (($u['auth_provider'] ?? '') === $provider && ($u['oauth_id'] ?? '') === $oauthId) {
                $matched = true;
            }

            // Secondary: check oauth_providers array (multi-provider support)
            if (!$matched) {
                foreach ($u['oauth_providers'] ?? [] as $p) {
                    if (($p['provider'] ?? '') === $provider && ($p['oauth_id'] ?? '') === $oauthId) {
                        $matched = true;
                        break;
                    }
                }
            }

            if ($matched) {
                // If this account was merged into another, return the merge target instead
                if (!empty($u['merged_into'])) {
                    $target = self::findById($u['merged_into']);
                    if ($target && empty($target['banned'])) {
                        return $target;
                    }
                }
                // Skip banned accounts without merge target
                if (!empty($u['banned'])) {
                    continue;
                }
                return $u;
            }
        }
        return null;
    }

    /**
     * Find orphan user by name only (for email/password registration)
     */
    public static function claimOrphanByName(string $name): ?array
    {
        $name = trim($name);
        if (!$name) return null;

        foreach (DataStore::get('users') as $u) {
            if (
                ($u['name'] ?? '') === $name
                && empty($u['email'])
                && empty($u['password_hash'])
                && empty($u['oauth_id'])
            ) {
                return $u;
            }
        }
        return null;
    }

    /**
     * Find orphan user (has observations but no email/password/oauth)
     * and claim it by linking OAuth credentials.
     */
    public static function claimOrphanUser(array $profile): ?array
    {
        $name = trim($profile['name'] ?? '');
        if (!$name) return null;

        $users = DataStore::get('users');
        foreach ($users as $u) {
            // Orphan = no email, no password, no oauth, name matches
            if (
                ($u['name'] ?? '') === $name
                && empty($u['email'])
                && empty($u['password_hash'])
                && empty($u['oauth_id'])
            ) {
                // Claim this record
                $fields = [
                    'email' => strtolower(trim($profile['email'] ?? '')),
                    'auth_provider' => $profile['provider'],
                    'oauth_id' => $profile['id'],
                    'avatar' => $profile['avatar_url'] ?: ($u['avatar'] ?? ''),
                    'last_login_at' => date('Y-m-d H:i:s'),
                ];
                return self::update($u['id'], $fields);
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
     * Link OAuth to existing user (for account merging).
     * Stores in oauth_providers array so multiple providers can coexist.
     * Also sets primary auth_provider/oauth_id if not already set.
     */
    public static function linkOAuth(string $userId, string $provider, string $oauthId, string $avatarUrl = ''): ?array
    {
        $user = self::findById($userId);
        if (!$user) return null;

        // Build oauth_providers array
        $providers = $user['oauth_providers'] ?? [];
        $alreadyLinked = false;
        foreach ($providers as $p) {
            if (($p['provider'] ?? '') === $provider && ($p['oauth_id'] ?? '') === $oauthId) {
                $alreadyLinked = true;
                break;
            }
        }
        if (!$alreadyLinked) {
            $providers[] = [
                'provider' => $provider,
                'oauth_id' => $oauthId,
                'linked_at' => date('Y-m-d H:i:s'),
            ];
        }

        $fields = ['oauth_providers' => $providers];

        // Set primary if not already set or if currently 'local'
        $currentProvider = $user['auth_provider'] ?? '';
        if (empty($currentProvider) || $currentProvider === 'local') {
            $fields['auth_provider'] = $provider;
            $fields['oauth_id'] = $oauthId;
        }

        if ($avatarUrl) {
            $fields['avatar'] = $avatarUrl;
        }

        return self::update($userId, $fields);
    }
}
