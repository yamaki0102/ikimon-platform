<?php

require_once __DIR__ . '/DataStore.php';

class CorporateManager
{
    private const FILE = 'corporations'; // .json is added by DataStore

    /**
     * Get all registered corporations
     */
    public static function list(): array
    {
        return DataStore::get(self::FILE); // corporations.json
    }

    /**
     * Get corporation by ID
     */
    public static function get(string $corpId): ?array
    {
        $all = self::list();
        foreach ($all as $c) {
            if (($c['id'] ?? '') === $corpId) return $c;
        }
        return null;
    }

    /**
     * Register a new corporation
     */
    public static function register(string $name, string $plan = 'standard'): string
    {
        $id = uniqid('corp_');
        $data = [
            'id' => $id,
            'name' => $name,
            'plan' => $plan, // standard, pro, enterprise
            'created_at' => date('Y-m-d H:i:s'),
            'members' => [] // userId => role
        ];

        // Atomic-like read-modify-write
        $all = self::list();
        $all[] = $data;
        DataStore::save(self::FILE, $all);

        return $id;
    }

    /**
     * Add member to corporation
     */
    public static function addMember(string $corpId, string $userId, string $role = 'member'): bool
    {
        $all = self::list();
        $updated = false;
        foreach ($all as &$c) {
            if ($c['id'] === $corpId) {
                $c['members'][$userId] = [
                    'role' => $role,
                    'joined_at' => date('Y-m-d H:i:s')
                ];
                $updated = true;
                break;
            }
        }
        if ($updated) {
            DataStore::save(self::FILE, $all);
        }
        return $updated;
    }

    /**
     * Get members of a corporation
     */
    public static function getMembers(string $corpId): array
    {
        $corp = self::get($corpId);
        return $corp['members'] ?? [];
    }

    /**
     * Check if user is a member of any corporation
     * @return array|null ['corp_id' => ..., 'role' => ...]
     */
    public static function getUserAffiliation(string $userId): ?array
    {
        $all = self::list();
        foreach ($all as $c) {
            if (isset($c['members'][$userId])) {
                return [
                    'corp_id' => $c['id'],
                    'corp_name' => $c['name'],
                    'role' => $c['members'][$userId]['role']
                ];
            }
        }
        return null;
    }
}
