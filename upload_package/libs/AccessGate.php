<?php

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/InviteManager.php';

class AccessGate
{
    private const POLICY_FILE = 'system/access_policy';
    private const INVITE_COOKIE = 'invite_code';

    public static function getPolicy(): array
    {
        $stored = DataStore::get(self::POLICY_FILE);
        if (!is_array($stored)) {
            $stored = [];
        }

        return array_merge([
            'invite_only' => false,
            'invite_message' => '現在は招待リンク経由の新規参加のみ受け付けています。',
        ], $stored);
    }

    public static function isInviteOnlyEnabled(): bool
    {
        return !empty(self::getPolicy()['invite_only']);
    }

    public static function getInviteOnlyMessage(): string
    {
        return (string)(self::getPolicy()['invite_message'] ?? '現在は招待リンク経由の新規参加のみ受け付けています。');
    }

    public static function rememberInviteCode(string $code): void
    {
        $normalized = self::normalizeInviteCode($code);
        if ($normalized === '') {
            return;
        }

        $_SESSION['invite_code'] = $normalized;

        $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
            || (($_SERVER['SERVER_PORT'] ?? null) == 443);

        setcookie(self::INVITE_COOKIE, $normalized, [
            'expires' => time() + 86400 * 7,
            'path' => '/',
            'secure' => $isHttps,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    }

    public static function getRememberedInviteCode(): string
    {
        $raw = $_SESSION['invite_code'] ?? $_COOKIE[self::INVITE_COOKIE] ?? '';
        return self::normalizeInviteCode((string)$raw);
    }

    public static function validateInviteCode(?string $code = null): array
    {
        $normalized = self::normalizeInviteCode($code ?? self::getRememberedInviteCode());
        if ($normalized === '') {
            return [
                'valid' => false,
                'code' => '',
                'inviter' => null,
                'error' => '招待コードが必要です。招待リンクからアクセスしてください。',
            ];
        }

        $inviter = InviteManager::resolveCode($normalized);
        if (!$inviter) {
            return [
                'valid' => false,
                'code' => $normalized,
                'inviter' => null,
                'error' => '招待コードが無効です。招待リンクを確認してください。',
            ];
        }

        if (!empty($inviter['is_exhausted'])) {
            return [
                'valid' => false,
                'code' => $normalized,
                'inviter' => $inviter,
                'error' => 'この招待コードは上限に達しました。別の招待リンクを受け取ってください。',
            ];
        }

        self::rememberInviteCode($normalized);

        return [
            'valid' => true,
            'code' => $normalized,
            'inviter' => $inviter,
            'error' => null,
        ];
    }

    private static function normalizeInviteCode(string $code): string
    {
        return strtoupper(trim($code));
    }
}
