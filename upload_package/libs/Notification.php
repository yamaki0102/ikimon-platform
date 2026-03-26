<?php

/**
 * Notification — 通知管理 (v2: ユーザー別ファイル管理)
 * 
 * Ambient Presence の3通知タイプを維持しつつ、
 * いいね・バッジ・RG昇格等の拡張通知もサポート。
 * 
 * v1からの変更点:
 * - 全通知を1ファイル → ユーザー別ファイルに分割（パフォーマンス向上）
 * - 通知タイプの拡張（like, badge, rg_upgrade）
 * - 便利メソッド追加（notifyIdentification, notifyLike等）
 */

require_once __DIR__ . '/DataStore.php';

class Notification
{
    // Ambient Presence: 3 notification types (legacy)
    const TYPE_IDENTIFICATION = 'identification'; // 「誰かが名前をつけた」
    const TYPE_GHOST          = 'ghost';           // 「近くに気配があります」
    const TYPE_FOOTPRINT      = 'footprint';       // 「誰かが足あとを残した」

    // 拡張タイプ
    const TYPE_LIKE       = 'like';        // いいね
    const TYPE_BADGE      = 'badge';       // バッジ獲得
    const TYPE_RG_UPGRADE = 'rg_upgrade';  // Research Grade昇格
    const TYPE_COMMENT    = 'comment';     // コメント
    const TYPE_WELCOME    = 'welcome';     // ウェルカム

    // Allowed types for Ambient Presence
    const AMBIENT_TYPES = [
        self::TYPE_IDENTIFICATION,
        self::TYPE_GHOST,
        self::TYPE_FOOTPRINT,
    ];

    /**
     * Send an ambient notification (restricted to original 3 types)
     * Returns false if type is not ambient.
     */
    public static function sendAmbient($userId, $type, $title, $message, $link = '')
    {
        if (!in_array($type, self::AMBIENT_TYPES, true)) {
            return false;
        }
        return self::send($userId, $type, $title, $message, $link);
    }

    /**
     * Send a notification to a user
     */
    public static function send($userId, $type, $title, $message, $link = '')
    {
        if (empty($userId)) return false;

        $entry = [
            'id' => 'notif_' . bin2hex(random_bytes(8)),
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'link' => $link,
            'is_read' => false,
            'created_at' => date('c')
        ];

        $notifications = self::loadUserNotifications($userId);
        array_unshift($notifications, $entry);

        // 最大200件に制限
        if (count($notifications) > 200) {
            $notifications = array_slice($notifications, 0, 200);
        }

        return self::saveUserNotifications($userId, $notifications);
    }

    /**
     * Get unread count for a user
     */
    public static function getUnreadCount($userId)
    {
        $notifications = self::loadUserNotifications($userId);
        $count = 0;
        foreach ($notifications as $n) {
            if (!($n['is_read'] ?? false)) {
                $count++;
            }
        }
        return $count;
    }

    /**
     * Get recent notifications for a user
     */
    public static function getRecent($userId, $limit = 20)
    {
        $notifications = self::loadUserNotifications($userId);
        // 既に新しい順なのでスライスするだけ
        return array_slice($notifications, 0, $limit);
    }

    /**
     * Mark a single notification as read
     */
    public static function markRead($userId, $notifId)
    {
        $notifications = self::loadUserNotifications($userId);
        $changed = false;
        foreach ($notifications as &$n) {
            if ($n['id'] === $notifId && !$n['is_read']) {
                $n['is_read'] = true;
                $changed = true;
                break;
            }
        }
        unset($n);
        if ($changed) {
            return self::saveUserNotifications($userId, $notifications);
        }
        return true;
    }

    /**
     * Mark all as read
     */
    public static function markAllRead($userId)
    {
        $notifications = self::loadUserNotifications($userId);
        $changed = false;
        foreach ($notifications as &$n) {
            if (!($n['is_read'] ?? false)) {
                $n['is_read'] = true;
                $changed = true;
            }
        }
        unset($n);
        if ($changed) {
            return self::saveUserNotifications($userId, $notifications);
        }
        return true;
    }
    
    // === 便利メソッド ===

    /**
     * 同定通知 — 「○○が名前をつけたよ」
     */
    public static function notifyIdentification($observerId, $actorName, $obsId, $speciesName)
    {
        return self::send(
            $observerId,
            self::TYPE_IDENTIFICATION,
            '同定されたよ',
            "{$actorName}が「{$speciesName}」と同定したよ",
            "observation_detail.php?id={$obsId}"
        );
    }

    /**
     * いいね通知
     */
    public static function notifyLike($observerId, $actorName, $obsId)
    {
        return self::send(
            $observerId,
            self::TYPE_LIKE,
            'いいね！',
            "{$actorName}がキミの観察にいいねしたよ ❤️",
            "observation_detail.php?id={$obsId}"
        );
    }

    /**
     * Research Grade昇格通知
     */
    public static function notifyRGUpgrade($observerId, $obsId, $speciesName)
    {
        return self::send(
            $observerId,
            self::TYPE_RG_UPGRADE,
            'Research Grade！',
            "「{$speciesName}」がResearch Gradeに昇格したよ！🎉",
            "observation_detail.php?id={$obsId}"
        );
    }

    /**
     * バッジ獲得通知
     */
    public static function notifyBadge($userId, $badgeName, $badgeIcon)
    {
        return self::send(
            $userId,
            self::TYPE_BADGE,
            'バッジ獲得！',
            "新バッジ「{$badgeName}」を獲得！{$badgeIcon}",
            "profile.php"
        );
    }

    // === ユーザー別ファイル管理 ===

    private static function getNotificationsDir()
    {
        $dir = DATA_DIR . '/notifications';
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }
        return $dir;
    }

    private static function getUserFilePath($userId)
    {
        return self::getNotificationsDir() . '/' . preg_replace('/[^a-zA-Z0-9_-]/', '', $userId) . '.json';
    }

    private static function loadUserNotifications($userId)
    {
        $file = self::getUserFilePath($userId);
        if (!file_exists($file)) return [];
        $content = file_get_contents($file);
        return json_decode($content, true) ?: [];
    }

    private static function saveUserNotifications($userId, $notifications)
    {
        $file = self::getUserFilePath($userId);
        return file_put_contents($file, json_encode($notifications, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX) !== false;
    }
}
