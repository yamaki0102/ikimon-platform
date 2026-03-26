<?php

/**
 * InviteManager — ユーザー招待コード管理
 *
 * ロイヤルカスタマーが QR コードでリアルに口コミ紹介するための基盤。
 * 1ユーザー1コード（永続、何度でも使える）。
 */

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/UserStore.php';

class InviteManager
{
    private const RESOURCE = 'invites';

    /**
     * ユーザーの招待コードを取得（なければ生成）
     */
    public static function getOrCreateCode(string $userId): string
    {
        $invites = DataStore::get(self::RESOURCE) ?: [];

        // 既存コードを検索
        foreach ($invites as $invite) {
            if (($invite['user_id'] ?? '') === $userId) {
                return (string)$invite['code'];
            }
        }

        // 新規生成: 8文字の英数字（覚えやすい、URL-safe）
        $code = self::generateCode();

        // 衝突チェック
        $maxRetries = 5;
        for ($i = 0; $i < $maxRetries; $i++) {
            $exists = false;
            foreach ($invites as $invite) {
                if (($invite['code'] ?? '') === $code) {
                    $exists = true;
                    break;
                }
            }
            if (!$exists) break;
            $code = self::generateCode();
        }

        $invites[] = [
            'id' => 'invite_' . substr(bin2hex(random_bytes(6)), 0, 12),
            'code' => $code,
            'user_id' => $userId,
            'created_at' => date('Y-m-d H:i:s'),
            'accept_count' => 0,
            'accepted_users' => [],
        ];

        DataStore::save(self::RESOURCE, $invites);
        return $code;
    }

    /**
     * 招待コードからユーザー情報を解決
     */
    public static function resolveCode(string $code): ?array
    {
        $code = trim($code);
        if ($code === '') return null;

        $invites = DataStore::get(self::RESOURCE) ?: [];
        foreach ($invites as $invite) {
            if (strcasecmp($invite['code'] ?? '', $code) === 0) {
                $user = UserStore::findById($invite['user_id'] ?? '');
                if (!$user) return null;
                return [
                    'user_id' => $user['id'],
                    'user_name' => $user['name'] ?? '',
                    'user_avatar' => $user['avatar'] ?? '',
                    'code' => $invite['code'],
                    'accept_count' => (int)($invite['accept_count'] ?? 0),
                ];
            }
        }
        return null;
    }

    /**
     * 招待受け入れを記録
     */
    public static function recordAcceptance(string $code, string $newUserId, string $newUserName = ''): void
    {
        $invites = DataStore::get(self::RESOURCE) ?: [];
        foreach ($invites as &$invite) {
            if (strcasecmp($invite['code'] ?? '', $code) === 0) {
                $invite['accept_count'] = ((int)($invite['accept_count'] ?? 0)) + 1;
                $accepted = $invite['accepted_users'] ?? [];
                $accepted[] = [
                    'user_id' => $newUserId,
                    'name' => $newUserName,
                    'joined_at' => date('Y-m-d H:i:s'),
                ];
                // 最新50人まで保持
                if (count($accepted) > 50) {
                    $accepted = array_slice($accepted, -50);
                }
                $invite['accepted_users'] = $accepted;
                break;
            }
        }
        unset($invite);
        DataStore::save(self::RESOURCE, $invites);
    }

    /**
     * ユーザーの招待実績を取得
     */
    public static function getStats(string $userId): array
    {
        $invites = DataStore::get(self::RESOURCE) ?: [];
        foreach ($invites as $invite) {
            if (($invite['user_id'] ?? '') === $userId) {
                return [
                    'code' => $invite['code'],
                    'accept_count' => (int)($invite['accept_count'] ?? 0),
                    'accepted_users' => $invite['accepted_users'] ?? [],
                ];
            }
        }
        return ['code' => '', 'accept_count' => 0, 'accepted_users' => []];
    }

    /**
     * 招待URLを生成
     */
    public static function getInviteUrl(string $code): string
    {
        return (defined('BASE_URL') ? BASE_URL : 'https://ikimon.life') . '/invite.php?code=' . urlencode($code);
    }

    /**
     * 8文字の英数字コードを生成（覚えやすい）
     */
    private static function generateCode(): string
    {
        // 紛らわしい文字を除外（0/O, 1/l/I）
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $code = '';
        $bytes = random_bytes(8);
        for ($i = 0; $i < 8; $i++) {
            $code .= $chars[ord($bytes[$i]) % strlen($chars)];
        }
        return $code;
    }
}
