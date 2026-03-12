<?php

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/CorporateManager.php';
require_once __DIR__ . '/UserStore.php';

class CorporateInviteManager
{
    private const RESOURCE = 'corporate_invites';

    public static function create(string $corpId, string $email, string $role, string $createdBy = ''): ?array
    {
        $corporation = CorporateManager::get($corpId);
        $email = mb_strtolower(trim($email));
        if (!$corporation || $email === '') {
            return null;
        }

        $token = bin2hex(random_bytes(24));
        $now = date('Y-m-d H:i:s');
        $invite = [
            'id' => 'corpinvite_' . date('Ymd_His') . '_' . substr(bin2hex(random_bytes(3)), 0, 6),
            'corporation_id' => $corpId,
            'email' => $email,
            'role' => self::normalizeRole($role),
            'public_token' => $token,
            'token_hash' => hash('sha256', $token),
            'status' => 'pending',
            'created_by' => $createdBy,
            'created_at' => $now,
            'expires_at' => date('Y-m-d H:i:s', strtotime('+14 days')),
            'accepted_by' => '',
            'accepted_at' => '',
            'revoked_at' => '',
        ];

        DataStore::append(self::RESOURCE, $invite, time());

        $invite['token'] = $token;
        $invite['accept_url'] = BASE_URL . '/corporate_invite.php?token=' . urlencode($token);
        return $invite;
    }

    public static function listByCorporation(string $corpId, string $status = 'pending'): array
    {
        $items = [];
        foreach (DataStore::fetchAll(self::RESOURCE) as $invite) {
            $invite = self::normalizeRecord($invite);
            if ((string)($invite['corporation_id'] ?? '') !== $corpId) {
                continue;
            }
            if ($status !== '' && (string)($invite['status'] ?? '') !== $status) {
                continue;
            }
            $items[] = $invite;
        }

        usort($items, static function (array $a, array $b): int {
            return strtotime($b['created_at'] ?? '1970-01-01') <=> strtotime($a['created_at'] ?? '1970-01-01');
        });

        return $items;
    }

    public static function revoke(string $inviteId, string $actor = ''): ?array
    {
        $invite = DataStore::findById(self::RESOURCE, $inviteId);
        if (!$invite) {
            return null;
        }

        $invite = self::normalizeRecord($invite);
        if ($invite['status'] !== 'pending') {
            return $invite;
        }

        $invite['status'] = 'revoked';
        $invite['revoked_at'] = date('Y-m-d H:i:s');
        $invite['revoked_by'] = $actor;
        DataStore::upsert(self::RESOURCE, $invite);
        return $invite;
    }

    public static function findByToken(string $token): ?array
    {
        $tokenHash = hash('sha256', trim($token));
        foreach (DataStore::fetchAll(self::RESOURCE) as $invite) {
            $invite = self::normalizeRecord($invite);
            if (($invite['token_hash'] ?? '') !== $tokenHash) {
                continue;
            }
            return $invite;
        }
        return null;
    }

    public static function accept(string $token, array $user): array
    {
        $invite = self::findByToken($token);
        if (!$invite) {
            return ['success' => false, 'message' => '招待リンクが見つかりません。'];
        }
        if ($invite['status'] !== 'pending') {
            return ['success' => false, 'message' => 'この招待リンクはすでに使われています。', 'invite' => $invite];
        }
        if (strtotime((string)$invite['expires_at']) < time()) {
            $invite['status'] = 'expired';
            DataStore::upsert(self::RESOURCE, $invite);
            return ['success' => false, 'message' => 'この招待リンクは期限切れです。', 'invite' => $invite];
        }

        $userEmail = mb_strtolower(trim((string)($user['email'] ?? '')));
        if ($userEmail === '' || $userEmail !== mb_strtolower((string)$invite['email'])) {
            return ['success' => false, 'message' => '招待されたメールアドレスでログインしてください。', 'invite' => $invite];
        }

        $corpId = (string)($invite['corporation_id'] ?? '');
        $added = CorporateManager::addMember($corpId, (string)($user['id'] ?? ''), (string)($invite['role'] ?? 'viewer'));
        if (!$added) {
            return ['success' => false, 'message' => '団体への参加に失敗しました。', 'invite' => $invite];
        }

        $invite['status'] = 'accepted';
        $invite['accepted_by'] = (string)($user['id'] ?? '');
        $invite['accepted_at'] = date('Y-m-d H:i:s');
        DataStore::upsert(self::RESOURCE, $invite);

        return ['success' => true, 'message' => '団体ワークスペースへ参加しました。', 'invite' => $invite];
    }

    public static function findExistingPending(string $corpId, string $email): ?array
    {
        $email = mb_strtolower(trim($email));
        foreach (self::listByCorporation($corpId, 'pending') as $invite) {
            if (mb_strtolower((string)($invite['email'] ?? '')) === $email) {
                return $invite;
            }
        }
        return null;
    }

    public static function resolveUserPreview(string $email): ?array
    {
        $user = UserStore::findByEmail(trim($email));
        if (!$user) {
            return null;
        }
        return [
            'id' => (string)($user['id'] ?? ''),
            'name' => (string)($user['name'] ?? ''),
            'email' => (string)($user['email'] ?? ''),
        ];
    }

    private static function normalizeRecord(array $invite): array
    {
        $invite['status'] = self::normalizeStatus((string)($invite['status'] ?? 'pending'));
        $invite['role'] = self::normalizeRole((string)($invite['role'] ?? 'viewer'));
        if (!empty($invite['public_token'])) {
            $invite['accept_url'] = BASE_URL . '/corporate_invite.php?token=' . urlencode((string)$invite['public_token']);
        }
        return $invite;
    }

    private static function normalizeRole(string $role): string
    {
        $role = strtolower(trim($role));
        $allowed = ['owner', 'admin', 'editor', 'viewer'];
        return in_array($role, $allowed, true) ? $role : 'viewer';
    }

    private static function normalizeStatus(string $status): string
    {
        $status = strtolower(trim($status));
        $allowed = ['pending', 'accepted', 'revoked', 'expired'];
        return in_array($status, $allowed, true) ? $status : 'pending';
    }
}
