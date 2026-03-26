<?php

require_once __DIR__ . '/DataStore.php';

class CorporateManager
{
    private const FILE = 'corporations';

    public static function list(): array
    {
        $items = DataStore::get(self::FILE);
        return array_map([self::class, 'normalizeRecord'], is_array($items) ? $items : []);
    }

    public static function get(string $corpId): ?array
    {
        foreach (self::list() as $corporation) {
            if ((string)($corporation['id'] ?? '') === $corpId) {
                return $corporation;
            }
        }
        return null;
    }

    public static function register(string $name, string $plan = 'community'): string
    {
        $id = uniqid('corp_');
        $data = self::normalizeRecord([
            'id' => $id,
            'name' => trim($name),
            'plan' => $plan,
            'created_at' => date('Y-m-d H:i:s'),
            'members' => [],
            'activity' => [[
                'at' => date('Y-m-d H:i:s'),
                'type' => 'created',
                'label' => '契約団体を作成',
                'by' => 'system',
                'note' => '',
            ]],
        ]);

        $all = self::list();
        $all[] = $data;
        self::saveAll($all);

        return $id;
    }

    public static function addMember(string $corpId, string $userId, string $role = 'viewer'): bool
    {
        $all = self::list();
        $updated = false;
        foreach ($all as &$corporation) {
            if ((string)($corporation['id'] ?? '') !== $corpId) {
                continue;
            }
            $existing = $corporation['members'][$userId] ?? [];
            $corporation['members'][$userId] = [
                'role' => self::normalizeMemberRole($role),
                'joined_at' => $existing['joined_at'] ?? date('Y-m-d H:i:s'),
            ];
            $corporation['updated_at'] = date('Y-m-d H:i:s');
            $updated = true;
            break;
        }
        unset($corporation);

        if ($updated) {
            self::saveAll($all);
        }
        return $updated;
    }

    public static function updateMemberRole(string $corpId, string $userId, string $role): bool
    {
        $all = self::list();
        $updated = false;
        foreach ($all as &$corporation) {
            if ((string)($corporation['id'] ?? '') !== $corpId) {
                continue;
            }
            if (!isset($corporation['members'][$userId])) {
                break;
            }
            $corporation['members'][$userId]['role'] = self::normalizeMemberRole($role);
            $corporation['updated_at'] = date('Y-m-d H:i:s');
            $updated = true;
            break;
        }
        unset($corporation);

        if ($updated) {
            self::saveAll($all);
        }
        return $updated;
    }

    public static function removeMember(string $corpId, string $userId): bool
    {
        $all = self::list();
        $updated = false;
        foreach ($all as &$corporation) {
            if ((string)($corporation['id'] ?? '') !== $corpId) {
                continue;
            }
            if (!isset($corporation['members'][$userId])) {
                break;
            }
            unset($corporation['members'][$userId]);
            $corporation['updated_at'] = date('Y-m-d H:i:s');
            $updated = true;
            break;
        }
        unset($corporation);

        if ($updated) {
            self::saveAll($all);
        }
        return $updated;
    }

    public static function getMembers(string $corpId): array
    {
        $corporation = self::get($corpId);
        return $corporation['members'] ?? [];
    }

    public static function getUserAffiliation(string $userId): ?array
    {
        $items = self::getUserAffiliations($userId);
        return $items[0] ?? null;
    }

    public static function getUserAffiliations(string $userId): array
    {
        $affiliations = [];
        foreach (self::list() as $corporation) {
            if (!isset($corporation['members'][$userId])) {
                continue;
            }
            $affiliations[] = [
                'corp_id' => (string)($corporation['id'] ?? ''),
                'corp_name' => (string)($corporation['name'] ?? ''),
                'role' => (string)($corporation['members'][$userId]['role'] ?? 'viewer'),
                'status' => (string)($corporation['lifecycle']['status'] ?? 'active'),
            ];
        }
        return $affiliations;
    }

    public static function updateSettings(string $corpId, array $changes, string $actor = 'system'): ?array
    {
        $all = self::list();
        $updated = null;
        foreach ($all as &$corporation) {
            if ((string)($corporation['id'] ?? '') !== $corpId) {
                continue;
            }

            $before = $corporation['settings'];
            $corporation['settings']['locale'] = self::normalizeLocale((string)($changes['locale'] ?? $before['locale']));
            $corporation['settings']['timezone'] = self::normalizeTimezone((string)($changes['timezone'] ?? $before['timezone']));
            $corporation['settings']['workspace_label'] = trim((string)($changes['workspace_label'] ?? $before['workspace_label']));
            $corporation['updated_at'] = date('Y-m-d H:i:s');

            if ($before !== $corporation['settings']) {
                $corporation['activity'][] = [
                    'at' => $corporation['updated_at'],
                    'type' => 'settings',
                    'label' => 'ワークスペース設定を更新',
                    'by' => $actor,
                    'note' => '',
                ];
            }

            $updated = $corporation;
            break;
        }
        unset($corporation);

        if ($updated) {
            self::saveAll($all);
        }

        return $updated;
    }

    public static function updateLifecycle(string $corpId, array $changes, string $actor = 'system'): ?array
    {
        $all = self::list();
        $updated = null;
        foreach ($all as &$corporation) {
            if ((string)($corporation['id'] ?? '') !== $corpId) {
                continue;
            }

            $beforeStatus = (string)($corporation['lifecycle']['status'] ?? 'active');
            $corporation['lifecycle']['status'] = self::normalizeLifecycleStatus((string)($changes['status'] ?? $beforeStatus));
            if (array_key_exists('pause_reason', $changes)) {
                $corporation['lifecycle']['pause_reason'] = trim((string)$changes['pause_reason']);
            }
            if (array_key_exists('cancel_effective_at', $changes)) {
                $corporation['lifecycle']['cancel_effective_at'] = trim((string)$changes['cancel_effective_at']);
            }
            if (array_key_exists('archive_policy', $changes)) {
                $corporation['lifecycle']['archive_policy'] = self::normalizeArchivePolicy((string)$changes['archive_policy']);
            }
            if (array_key_exists('note', $changes)) {
                $corporation['lifecycle']['last_note'] = trim((string)$changes['note']);
            }

            if ($corporation['lifecycle']['status'] === 'cancel_requested' && empty($corporation['lifecycle']['cancel_requested_at'])) {
                $corporation['lifecycle']['cancel_requested_at'] = date('Y-m-d H:i:s');
            }
            if ($corporation['lifecycle']['status'] === 'paused' && empty($corporation['lifecycle']['paused_at'])) {
                $corporation['lifecycle']['paused_at'] = date('Y-m-d H:i:s');
            }
            if ($corporation['lifecycle']['status'] === 'active') {
                $corporation['lifecycle']['paused_at'] = null;
            }

            $corporation['updated_at'] = date('Y-m-d H:i:s');
            if ($beforeStatus !== $corporation['lifecycle']['status'] || !empty($changes['note'])) {
                $corporation['activity'][] = [
                    'at' => $corporation['updated_at'],
                    'type' => 'lifecycle',
                    'label' => self::lifecycleLabel($corporation['lifecycle']['status']),
                    'by' => $actor,
                    'note' => trim((string)($changes['note'] ?? '')),
                ];
            }

            $updated = $corporation;
            break;
        }
        unset($corporation);

        if ($updated) {
            self::saveAll($all);
        }

        return $updated;
    }

    public static function lifecycleLabel(string $status): string
    {
        $labels = [
            'active' => '運用中',
            'paused' => '一時停止',
            'cancel_requested' => '解約相談中',
            'cancelled' => '解約済み',
            'archived' => 'アーカイブ',
        ];
        $status = self::normalizeLifecycleStatus($status);
        return $labels[$status] ?? $labels['active'];
    }

    public static function getPlanDefinition(string $plan): array
    {
        $plan = self::normalizePlan($plan);
        $definitions = [
            'community' => [
                'label' => 'Community',
                'site_limit' => 10,
                'member_limit' => 20,
                'advanced_outputs' => false,
                'full_species_visibility' => false,
                'priority_support' => false,
            ],
            'public' => [
                'label' => 'Public',
                'site_limit' => 50,
                'member_limit' => 50,
                'advanced_outputs' => true,
                'full_species_visibility' => true,
                'priority_support' => true,
            ],
        ];

        return $definitions[$plan] ?? $definitions['community'];
    }

    public static function planHasFeature(string $plan, string $feature): bool
    {
        $definition = self::getPlanDefinition($plan);
        return !empty($definition[$feature]);
    }

    public static function corporationHasFeature(?array $corporation, string $feature): bool
    {
        if (!$corporation) {
            return true;
        }

        return self::planHasFeature((string)($corporation['plan'] ?? 'community'), $feature);
    }

    private static function normalizeRecord(array $corporation): array
    {
        $plan = self::normalizePlan((string)($corporation['plan'] ?? 'community'));
        $definition = self::getPlanDefinition($plan);

        $corporation['plan'] = $plan;
        $corporation['created_at'] = (string)($corporation['created_at'] ?? date('Y-m-d H:i:s'));
        $corporation['updated_at'] = (string)($corporation['updated_at'] ?? $corporation['created_at']);
        $corporation['members'] = is_array($corporation['members'] ?? null) ? $corporation['members'] : [];
        foreach ($corporation['members'] as $memberId => $member) {
            $corporation['members'][$memberId] = [
                'role' => self::normalizeMemberRole((string)($member['role'] ?? 'viewer')),
                'joined_at' => (string)($member['joined_at'] ?? $corporation['created_at']),
            ];
        }

        $corporation['settings'] = array_merge([
            'locale' => 'ja',
            'timezone' => 'Asia/Tokyo',
            'workspace_label' => trim((string)($corporation['name'] ?? '')),
            'site_limit' => $definition['site_limit'],
            'member_limit' => $definition['member_limit'],
        ], is_array($corporation['settings'] ?? null) ? $corporation['settings'] : []);
        $corporation['settings']['locale'] = self::normalizeLocale((string)$corporation['settings']['locale']);
        $corporation['settings']['timezone'] = self::normalizeTimezone((string)$corporation['settings']['timezone']);
        $corporation['settings']['site_limit'] = max((int)$definition['site_limit'], (int)($corporation['settings']['site_limit'] ?? 0));
        $corporation['settings']['member_limit'] = max((int)$definition['member_limit'], (int)($corporation['settings']['member_limit'] ?? 0));

        $corporation['lifecycle'] = array_merge([
            'status' => 'active',
            'pause_reason' => '',
            'paused_at' => null,
            'cancel_requested_at' => null,
            'cancel_effective_at' => '',
            'archive_policy' => 'keep_public',
            'last_note' => '',
        ], is_array($corporation['lifecycle'] ?? null) ? $corporation['lifecycle'] : []);
        $corporation['lifecycle']['status'] = self::normalizeLifecycleStatus((string)$corporation['lifecycle']['status']);
        $corporation['lifecycle']['archive_policy'] = self::normalizeArchivePolicy((string)$corporation['lifecycle']['archive_policy']);

        $corporation['activity'] = array_values(is_array($corporation['activity'] ?? null) ? $corporation['activity'] : []);

        return $corporation;
    }

    private static function saveAll(array $items): bool
    {
        return (bool)DataStore::save(self::FILE, array_values($items));
    }

    private static function normalizePlan(string $plan): string
    {
        $plan = strtolower(trim($plan));
        return match ($plan) {
            'community', 'free' => 'community',
            'public', 'pro' => 'public',
            default => 'community',
        };
    }

    private static function normalizeMemberRole(string $role): string
    {
        $role = strtolower(trim($role));
        $allowed = ['owner', 'admin', 'editor', 'viewer'];
        return in_array($role, $allowed, true) ? $role : 'viewer';
    }

    private static function normalizeLocale(string $locale): string
    {
        $locale = strtolower(trim($locale));
        return in_array($locale, ['ja', 'en', 'es', 'pt'], true) ? $locale : 'ja';
    }

    private static function normalizeTimezone(string $timezone): string
    {
        $allowed = ['Asia/Tokyo', 'UTC', 'Europe/London', 'America/Los_Angeles', 'Asia/Singapore'];
        return in_array($timezone, $allowed, true) ? $timezone : 'Asia/Tokyo';
    }

    private static function normalizeLifecycleStatus(string $status): string
    {
        $status = strtolower(trim($status));
        $allowed = ['active', 'paused', 'cancel_requested', 'cancelled', 'archived'];
        return in_array($status, $allowed, true) ? $status : 'active';
    }

    private static function normalizeArchivePolicy(string $policy): string
    {
        $policy = strtolower(trim($policy));
        $allowed = ['keep_public', 'make_private', 'handover_requested'];
        return in_array($policy, $allowed, true) ? $policy : 'keep_public';
    }
}
