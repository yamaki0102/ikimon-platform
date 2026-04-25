<?php

/**
 * Moderation.php — Shadow Ban & Content Moderation Foundation
 *
 * Provides soft moderation capabilities without publicly notifying users.
 * Shadow-banned users can still post, but their content is hidden from others.
 *
 * Usage:
 *   Moderation::isShadowBanned($userId)   -> bool
 *   Moderation::shadowBan($userId, $reason, $adminId)
 *   Moderation::removeShadowBan($userId, $adminId)
 *   Moderation::filterContent($items, $viewerUserId) -> filtered items
 *   Moderation::flagContent($contentId, $type, $reporterUserId, $reason)
 *   Moderation::getFlags($status) -> array
 */

require_once __DIR__ . '/DataStore.php';

class Moderation
{

    const STATUS_ACTIVE   = 'active';
    const STATUS_RESOLVED = 'resolved';
    const STATUS_DISMISSED = 'dismissed';

    const FLAG_SPAM       = 'spam';
    const FLAG_ABUSE      = 'abuse';
    const FLAG_MISID      = 'misidentification';
    const FLAG_PRIVACY    = 'privacy';
    const FLAG_OTHER      = 'other';

    const VALID_FLAGS = [
        self::FLAG_SPAM,
        self::FLAG_ABUSE,
        self::FLAG_MISID,
        self::FLAG_PRIVACY,
        self::FLAG_OTHER,
    ];

    // Auto-flag threshold: number of flags before auto-hiding
    const AUTO_HIDE_THRESHOLD = 3;

    /**
     * Check if a user is shadow banned.
     */
    public static function isShadowBanned(string $userId): bool
    {
        $record = self::getBanRecord($userId);
        return $record !== null && ($record['active'] ?? false);
    }

    /**
     * Apply shadow ban to a user.
     */
    public static function shadowBan(string $userId, string $reason, string $adminId): bool
    {
        $record = [
            'id'         => 'ban_' . $userId,
            'user_id'    => $userId,
            'active'     => true,
            'reason'     => mb_substr($reason, 0, 500),
            'banned_by'  => $adminId,
            'banned_at'  => date('c'),
            'lifted_at'  => null,
            'lifted_by'  => null,
        ];

        return DataStore::upsert('moderation_bans', $record);
    }

    /**
     * Remove shadow ban.
     */
    public static function removeShadowBan(string $userId, string $adminId): bool
    {
        $record = self::getBanRecord($userId);
        if (!$record) return false;

        $record['active'] = false;
        $record['lifted_at'] = date('c');
        $record['lifted_by'] = $adminId;

        return DataStore::upsert('moderation_bans', $record);
    }

    /**
     * Filter an array of items (observations, identifications, etc.)
     * to hide content from shadow-banned users.
     *
     * Items from banned users are only visible to themselves and admins.
     *
     * @param array $items Items to filter (each must have 'user_id')
     * @param string|null $viewerUserId The user viewing the content
     * @param bool $isAdmin Whether the viewer is an admin
     * @return array Filtered items
     */
    public static function filterContent(array $items, ?string $viewerUserId = null, bool $isAdmin = false): array
    {
        if ($isAdmin) return $items; // Admins see everything

        // Pre-load banned users for efficiency
        $bannedUsers = self::getBannedUserIds();
        if (empty($bannedUsers)) return $items;

        return array_values(array_filter($items, function ($item) use ($bannedUsers, $viewerUserId) {
            $itemUserId = $item['user_id'] ?? '';
            if (!in_array($itemUserId, $bannedUsers)) return true; // Not banned
            if ($itemUserId === $viewerUserId) return true; // Own content always visible
            return false; // Hidden from others
        }));
    }

    /**
     * Flag content for moderation review.
     */
    public static function flagContent(
        string $contentId,
        string $contentType,
        string $reporterUserId,
        string $reason,
        string $details = ''
    ): bool {
        $flag = [
            'id'           => uniqid('flag_'),
            'content_id'   => $contentId,
            'content_type' => $contentType, // 'observation', 'identification', 'comment'
            'reporter_id'  => $reporterUserId,
            'reason'       => in_array($reason, self::VALID_FLAGS) ? $reason : self::FLAG_OTHER,
            'details'      => mb_substr($details, 0, 500),
            'status'       => self::STATUS_ACTIVE,
            'created_at'   => date('c'),
            'resolved_at'  => null,
            'resolved_by'  => null,
        ];

        $success = DataStore::append('moderation_flags', $flag);

        // Check auto-hide threshold
        if ($success) {
            self::checkAutoHide($contentId, $contentType);
        }

        return $success;
    }

    /**
     * Get all flags, optionally filtered by status.
     */
    public static function getFlags(string $status = ''): array
    {
        $all = DataStore::fetchAll('moderation_flags');
        if (!$status || $status === 'all') return $all;
        return array_values(array_filter($all, fn($f) => ($f['status'] ?? '') === $status));
    }

    /**
     * Resolve a flag.
     */
    public static function resolveFlag(string $flagId, string $adminId, string $resolution): bool
    {
        $flags = DataStore::fetchAll('moderation_flags');
        foreach ($flags as &$f) {
            if (($f['id'] ?? '') === $flagId) {
                $f['status'] = $resolution === 'dismiss' ? self::STATUS_DISMISSED : self::STATUS_RESOLVED;
                $f['resolved_at'] = date('c');
                $f['resolved_by'] = $adminId;
                DataStore::save('moderation_flags', $flags);
                return true;
            }
        }
        return false;
    }

    /**
     * Get moderation stats summary.
     */
    public static function getStats(): array
    {
        $flags = DataStore::fetchAll('moderation_flags');
        $bans = DataStore::fetchAll('moderation_bans');

        return [
            'active_flags'   => count(array_filter($flags, fn($f) => ($f['status'] ?? '') === self::STATUS_ACTIVE)),
            'resolved_flags' => count(array_filter($flags, fn($f) => ($f['status'] ?? '') === self::STATUS_RESOLVED)),
            'total_flags'    => count($flags),
            'active_bans'    => count(array_filter($bans, fn($b) => ($b['active'] ?? false))),
            'total_bans'     => count($bans),
        ];
    }

    // --- Private Helpers ---

    // --- Public Helpers (Allocated from Private) ---

    public static function getBanRecord(string $userId): ?array
    {
        $bans = DataStore::fetchAll('moderation_bans');
        foreach ($bans as $ban) {
            if (($ban['user_id'] ?? '') === $userId) {
                return $ban;
            }
        }
        return null;
    }

    public static function getBannedUserIds(): array
    {
        $bans = DataStore::fetchAll('moderation_bans');
        $ids = [];
        foreach ($bans as $ban) {
            if ($ban['active'] ?? false) {
                $ids[] = $ban['user_id'];
            }
        }
        return $ids;
    }

    /**
     * Auto-hide content if it exceeds flag threshold.
     */
    private static function checkAutoHide(string $contentId, string $contentType): void
    {
        $flags = DataStore::fetchAll('moderation_flags');
        $count = 0;
        foreach ($flags as $f) {
            if (($f['content_id'] ?? '') === $contentId
                && ($f['content_type'] ?? '') === $contentType
                && ($f['status'] ?? '') === self::STATUS_ACTIVE
            ) {
                $count++;
            }
        }

        if ($count >= self::AUTO_HIDE_THRESHOLD) {
            // Auto-hide the content
            if ($contentType === 'observation') {
                $obs = DataStore::findById('observations', $contentId);
                if ($obs) {
                    $obs['hidden'] = true;
                    $obs['hidden_reason'] = 'auto_flagged';
                    $obs['hidden_at'] = date('c');
                    DataStore::upsert('observations', $obs);
                }
            }
        }
    }
}
