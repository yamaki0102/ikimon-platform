<?php

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/CorporateManager.php';

class BusinessApplicationManager
{
    private const RESOURCE = 'business_applications';

    public static function create(array $payload): array
    {
        $now = date('Y-m-d H:i:s');
        $id = 'bizapp_' . date('Ymd_His') . '_' . substr(bin2hex(random_bytes(3)), 0, 6);
        $reference = self::generateReference();

        $application = [
            'id' => $id,
            'reference' => $reference,
            'status' => 'new',
            'status_label' => self::statusLabel('new'),
            'priority' => self::defaultPriority($payload['plan'] ?? 'public'),
            'company' => trim((string)($payload['company'] ?? '')),
            'contact_name' => trim((string)($payload['contact_name'] ?? '')),
            'department' => trim((string)($payload['department'] ?? '')),
            'email' => trim((string)($payload['email'] ?? '')),
            'phone' => trim((string)($payload['phone'] ?? '')),
            'site_name' => trim((string)($payload['site_name'] ?? '')),
            'site_location' => trim((string)($payload['site_location'] ?? '')),
            'plan' => self::normalizePlan((string)($payload['plan'] ?? 'consultation')),
            'expected_start' => self::normalizeExpectedStart((string)($payload['expected_start'] ?? 'soon')),
            'planned_site_count' => self::normalizeSiteCount((string)($payload['planned_site_count'] ?? '1')),
            'use_mode' => trim((string)($payload['use_mode'] ?? '')),
            'message' => trim((string)($payload['message'] ?? '')),
            'source' => [
                'page' => trim((string)($payload['source_page'] ?? '/for-business/apply.php')),
                'user_agent' => trim((string)($payload['user_agent'] ?? '')),
                'ip' => trim((string)($payload['ip'] ?? '')),
            ],
            'ops' => [
                'owner' => '',
                'next_action' => '初回連絡',
                'next_due_at' => date('Y-m-d', strtotime('+1 weekday')),
                'notes' => [],
            ],
            'workspace' => [
                'corporation_id' => '',
                'corporation_plan' => '',
                'site_id' => '',
                'site_name' => trim((string)($payload['site_name'] ?? '')),
            ],
            'checklist' => self::defaultChecklist(),
            'timeline' => [[
                'at' => $now,
                'type' => 'submitted',
                'label' => '申込みを受け付け',
                'by' => 'system',
                'note' => 'フォームから送信されました。',
            ]],
            'created_at' => $now,
            'updated_at' => $now,
        ];

        DataStore::append(self::RESOURCE, $application, time());
        return $application;
    }

    public static function listAll(): array
    {
        $items = DataStore::fetchAll(self::RESOURCE);
        usort($items, static function (array $a, array $b): int {
            return strtotime($b['created_at'] ?? '1970-01-01') <=> strtotime($a['created_at'] ?? '1970-01-01');
        });
        return $items;
    }

    public static function findById(string $id): ?array
    {
        return DataStore::findById(self::RESOURCE, $id);
    }

    public static function findByReference(string $reference): ?array
    {
        $reference = strtoupper(trim($reference));
        foreach (self::listAll() as $item) {
            if (strtoupper((string)($item['reference'] ?? '')) === $reference) {
                return $item;
            }
        }
        return null;
    }

    public static function findByReferenceAndEmail(string $reference, string $email): ?array
    {
        $item = self::findByReference($reference);
        if (!$item) {
            return null;
        }
        return mb_strtolower((string)($item['email'] ?? '')) === mb_strtolower(trim($email)) ? $item : null;
    }

    public static function updateWorkflow(string $id, array $changes, string $actor = 'system'): ?array
    {
        $item = self::findById($id);
        if (!$item) {
            return null;
        }

        $statusBefore = (string)($item['status'] ?? 'new');
        $nextStatus = isset($changes['status']) ? self::normalizeStatus((string)$changes['status']) : $statusBefore;
        $item['status'] = $nextStatus;
        $item['status_label'] = self::statusLabel($nextStatus);

        if (isset($changes['owner'])) {
            $item['ops']['owner'] = trim((string)$changes['owner']);
        }
        if (isset($changes['next_action'])) {
            $item['ops']['next_action'] = trim((string)$changes['next_action']);
        }
        if (isset($changes['next_due_at'])) {
            $item['ops']['next_due_at'] = trim((string)$changes['next_due_at']);
        }
        if (isset($changes['priority'])) {
            $item['priority'] = self::normalizePriority((string)$changes['priority']);
        }

        if ($statusBefore !== $nextStatus) {
            $item['timeline'][] = [
                'at' => date('Y-m-d H:i:s'),
                'type' => 'status',
                'label' => 'ステータスを更新',
                'by' => $actor,
                'note' => self::statusLabel($statusBefore) . ' → ' . self::statusLabel($nextStatus),
            ];
        }

        $item['updated_at'] = date('Y-m-d H:i:s');
        DataStore::upsert(self::RESOURCE, $item);
        return $item;
    }

    public static function addNote(string $id, string $note, string $actor = 'system'): ?array
    {
        $note = trim($note);
        if ($note === '') {
            return self::findById($id);
        }

        $item = self::findById($id);
        if (!$item) {
            return null;
        }

        $entry = [
            'at' => date('Y-m-d H:i:s'),
            'by' => $actor,
            'note' => $note,
        ];
        $item['ops']['notes'][] = $entry;
        $item['timeline'][] = [
            'at' => $entry['at'],
            'type' => 'note',
            'label' => '運用メモを追加',
            'by' => $actor,
            'note' => $note,
        ];
        $item['updated_at'] = $entry['at'];
        DataStore::upsert(self::RESOURCE, $item);
        return $item;
    }

    public static function toggleChecklist(string $id, string $key, string $actor = 'system'): ?array
    {
        $item = self::findById($id);
        if (!$item) {
            return null;
        }

        foreach ($item['checklist'] as &$step) {
            if (($step['key'] ?? '') !== $key) {
                continue;
            }
            $step['done'] = !empty($step['done']) ? false : true;
            $step['updated_at'] = date('Y-m-d H:i:s');
            $item['timeline'][] = [
                'at' => $step['updated_at'],
                'type' => 'checklist',
                'label' => ($step['done'] ? 'チェック完了' : 'チェックを戻す'),
                'by' => $actor,
                'note' => $step['label'] ?? $key,
            ];
            break;
        }
        unset($step);

        $item['updated_at'] = date('Y-m-d H:i:s');
        DataStore::upsert(self::RESOURCE, $item);
        return $item;
    }

    public static function provisionCorporation(string $id, string $actor = 'system'): ?array
    {
        $item = self::findById($id);
        if (!$item) {
            return null;
        }
        if (!empty($item['workspace']['corporation_id'])) {
            return $item;
        }

        $plan = (($item['plan'] ?? 'public') === 'pro') ? 'pro' : 'public';
        $corpId = CorporateManager::register((string)$item['company'], $plan);
        $item['workspace']['corporation_id'] = $corpId;
        $item['workspace']['corporation_plan'] = $plan;
        $item['status'] = 'onboarding';
        $item['status_label'] = self::statusLabel('onboarding');
        $item['timeline'][] = [
            'at' => date('Y-m-d H:i:s'),
            'type' => 'provision',
            'label' => '契約団体を作成',
            'by' => $actor,
            'note' => $corpId,
        ];
        $item['updated_at'] = date('Y-m-d H:i:s');
        DataStore::upsert(self::RESOURCE, $item);
        return $item;
    }

    public static function claimWorkspace(string $reference, string $email, array $user): ?array
    {
        $item = self::findByReferenceAndEmail($reference, $email);
        if (!$item) {
            return null;
        }

        $corpId = (string)($item['workspace']['corporation_id'] ?? '');
        if ($corpId === '') {
            return null;
        }

        $corporation = CorporateManager::get($corpId);
        if (!$corporation) {
            return null;
        }

        $userId = (string)($user['id'] ?? '');
        if ($userId === '') {
            return null;
        }

        $existingOwner = false;
        foreach (($corporation['members'] ?? []) as $member) {
            if ((string)($member['role'] ?? '') === 'owner') {
                $existingOwner = true;
                break;
            }
        }

        $role = $existingOwner ? 'admin' : 'owner';
        CorporateManager::addMember($corpId, $userId, $role);

        $item['workspace']['owner_user_id'] = $item['workspace']['owner_user_id'] ?? $userId;
        $item['workspace']['claimed_at'] = date('Y-m-d H:i:s');
        $item['status'] = 'active';
        $item['status_label'] = self::statusLabel('active');
        $item['timeline'][] = [
            'at' => date('Y-m-d H:i:s'),
            'type' => 'workspace_claimed',
            'label' => '申込み担当者がワークスペースへ参加',
            'by' => $userId,
            'note' => $role,
        ];
        $item['updated_at'] = date('Y-m-d H:i:s');
        DataStore::upsert(self::RESOURCE, $item);
        return $item;
    }

    public static function stats(): array
    {
        $items = self::listAll();
        $statuses = ['new' => 0, 'reviewing' => 0, 'contacted' => 0, 'onboarding' => 0, 'active' => 0, 'closed' => 0];
        foreach ($items as $item) {
            $status = self::normalizeStatus((string)($item['status'] ?? 'new'));
            $statuses[$status] = ($statuses[$status] ?? 0) + 1;
        }
        return [
            'total' => count($items),
            'statuses' => $statuses,
            'due_today' => count(array_filter($items, static function (array $item): bool {
                $due = (string)($item['ops']['next_due_at'] ?? '');
                return $due !== '' && $due <= date('Y-m-d') && !in_array(($item['status'] ?? ''), ['active', 'closed'], true);
            })),
            'public' => count(array_filter($items, static fn(array $item): bool => ($item['plan'] ?? '') === 'public')),
            'pro' => count(array_filter($items, static fn(array $item): bool => ($item['plan'] ?? '') === 'pro')),
        ];
    }

    public static function statusLabel(string $status): string
    {
        $map = [
            'new' => '新規受付',
            'reviewing' => '内容確認中',
            'contacted' => '初回連絡済み',
            'onboarding' => '立上げ準備中',
            'active' => '運用開始',
            'closed' => '保留・クローズ',
        ];
        return $map[self::normalizeStatus($status)] ?? $map['new'];
    }

    public static function planLabel(string $plan): string
    {
        $map = [
            'pro' => 'Pro',
            'public' => 'Public',
            'consultation' => 'まず相談',
        ];
        $plan = self::normalizePlan($plan);
        return $map[$plan] ?? 'まず相談';
    }

    public static function expectedStartLabel(string $value): string
    {
        $map = [
            'soon' => 'できるだけ早く',
            'this_month' => '今月中',
            'next_quarter' => '1〜3か月以内',
            'exploring' => 'まず相談したい',
        ];
        $value = self::normalizeExpectedStart($value);
        return $map[$value] ?? $map['soon'];
    }

    public static function siteCountLabel(string $value): string
    {
        $map = [
            '1' => '1拠点',
            '2-5' => '2〜5拠点',
            '6+' => '6拠点以上',
        ];
        $value = self::normalizeSiteCount($value);
        return $map[$value] ?? $map['1'];
    }

    private static function defaultChecklist(): array
    {
        return [
            ['key' => 'first_reply_sent', 'label' => '初回返信を送る', 'done' => false, 'updated_at' => null],
            ['key' => 'requirements_reviewed', 'label' => '利用目的を確認する', 'done' => false, 'updated_at' => null],
            ['key' => 'corporation_created', 'label' => '契約団体を作る', 'done' => false, 'updated_at' => null],
            ['key' => 'boundary_requested', 'label' => '拠点境界の入力を依頼する', 'done' => false, 'updated_at' => null],
            ['key' => 'kickoff_sent', 'label' => '運用開始案内を送る', 'done' => false, 'updated_at' => null],
        ];
    }

    private static function generateReference(): string
    {
        return 'IKM-BIZ-' . date('ymd') . '-' . strtoupper(substr(bin2hex(random_bytes(3)), 0, 6));
    }

    private static function normalizePlan(string $plan): string
    {
        $plan = strtolower(trim($plan));
        return in_array($plan, ['pro', 'public', 'consultation'], true) ? $plan : 'consultation';
    }

    private static function normalizeExpectedStart(string $value): string
    {
        $value = strtolower(trim($value));
        $allowed = ['soon', 'this_month', 'next_quarter', 'exploring'];
        return in_array($value, $allowed, true) ? $value : 'soon';
    }

    private static function normalizeSiteCount(string $value): string
    {
        $value = trim($value);
        return in_array($value, ['1', '2-5', '6+'], true) ? $value : '1';
    }

    private static function normalizeStatus(string $status): string
    {
        $status = strtolower(trim($status));
        $allowed = ['new', 'reviewing', 'contacted', 'onboarding', 'active', 'closed'];
        return in_array($status, $allowed, true) ? $status : 'new';
    }

    private static function defaultPriority(string $plan): string
    {
        return $plan === 'public' ? 'high' : 'normal';
    }

    private static function normalizePriority(string $priority): string
    {
        $priority = strtolower(trim($priority));
        return in_array($priority, ['low', 'normal', 'high'], true) ? $priority : 'normal';
    }
}
