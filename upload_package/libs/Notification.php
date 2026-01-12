<?php
require_once __DIR__ . '/DataStore.php';

class Notification {
    /**
     * Send a notification to a user
     */
    public static function send($userId, $type, $title, $message, $link = '') {
        $notifications = DataStore::get('notifications');
        
        $entry = [
            'id' => bin2hex(random_bytes(8)),
            'user_id' => $userId,
            'type' => $type, // 'id_added', 'research_grade', 'badge_earned'
            'title' => $title,
            'message' => $message,
            'link' => $link,
            'is_read' => false,
            'created_at' => date('Y-m-d H:i:s')
        ];
        
        $notifications[] = $entry;
        return DataStore::save('notifications', $notifications);
    }

    /**
     * Get unread count for a user
     */
    public static function getUnreadCount($userId) {
        $notifications = DataStore::get('notifications');
        $count = 0;
        foreach ($notifications as $n) {
            if ($n['user_id'] === $userId && !$n['is_read']) {
                $count++;
            }
        }
        return $count;
    }

    /**
     * Get recent notifications for a user
     */
    public static function getRecent($userId, $limit = 5) {
        $notifications = DataStore::get('notifications');
        $userNotes = array_filter($notifications, function($n) use ($userId) {
            return $n['user_id'] === $userId;
        });
        
        usort($userNotes, function($a, $b) {
            return strtotime($b['created_at']) - strtotime($a['created_at']);
        });
        
        return array_slice($userNotes, 0, $limit);
    }

    /**
     * Mark all as read
     */
    public static function markAllRead($userId) {
        $notifications = DataStore::get('notifications');
        $changed = false;
        foreach ($notifications as &$n) {
            if ($n['user_id'] === $userId && !$n['is_read']) {
                $n['is_read'] = true;
                $changed = true;
            }
        }
        if ($changed) {
            return DataStore::save('notifications', $notifications);
        }
        return true;
    }
}
