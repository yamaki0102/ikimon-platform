<?php

/**
 * AuditLog — Canonical Schema 監査ログ
 *
 * Evidence Tier の変更、レビュー、同定の全操作を記録する。
 * 100年耐久設計: 一度記録したログは削除・変更しない（append-only）。
 *
 * 全メソッド static。
 */

require_once __DIR__ . '/../config/config.php';

class AuditLog
{
    // アクション種別
    const ACTION_TIER_CHANGE    = 'tier_change';
    const ACTION_REVIEW         = 'review';
    const ACTION_IDENTIFICATION = 'identification';
    const ACTION_PRIVACY_CHANGE = 'privacy_change';
    const ACTION_EVIDENCE_ADD   = 'evidence_add';
    const ACTION_SYNC           = 'sync';

    private static ?PDO $pdo = null;

    /**
     * テーブルを作成（マイグレーション用）
     */
    public static function createTable(): void
    {
        $pdo = self::getPDO();
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS audit_log (
                log_id TEXT PRIMARY KEY,
                occurrence_id TEXT,
                event_id TEXT,
                action TEXT NOT NULL,
                actor TEXT NOT NULL,
                old_value TEXT,
                new_value TEXT,
                details TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        ");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_audit_occ ON audit_log(occurrence_id)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_audit_time ON audit_log(created_at)");
    }

    /**
     * 監査ログを記録
     */
    public static function log(
        string $action,
        string $actor,
        ?string $occurrenceId = null,
        ?string $eventId = null,
        ?string $oldValue = null,
        ?string $newValue = null,
        ?array $details = null
    ): string {
        $logId = self::uuid();
        $pdo = self::getPDO();

        $stmt = $pdo->prepare("
            INSERT INTO audit_log (
                log_id, occurrence_id, event_id, action, actor,
                old_value, new_value, details
            ) VALUES (
                :id, :occ_id, :event_id, :action, :actor,
                :old, :new, :details
            )
        ");

        $stmt->execute([
            ':id'       => $logId,
            ':occ_id'   => $occurrenceId,
            ':event_id' => $eventId,
            ':action'   => $action,
            ':actor'    => $actor,
            ':old'      => $oldValue,
            ':new'      => $newValue,
            ':details'  => $details ? json_encode($details, JSON_UNESCAPED_UNICODE) : null,
        ]);

        return $logId;
    }

    /**
     * Tier 変更を記録
     */
    public static function logTierChange(
        string $occurrenceId,
        string $actor,
        float $oldTier,
        float $newTier,
        string $reason = ''
    ): string {
        return self::log(
            self::ACTION_TIER_CHANGE,
            $actor,
            $occurrenceId,
            null,
            (string) $oldTier,
            (string) $newTier,
            ['reason' => $reason]
        );
    }

    /**
     * レビュー操作を記録
     */
    public static function logReview(
        string $occurrenceId,
        string $reviewerId,
        string $action,
        string $taxonName,
        string $reviewerLevel
    ): string {
        return self::log(
            self::ACTION_REVIEW,
            $reviewerId,
            $occurrenceId,
            null,
            null,
            $action,
            [
                'taxon_name'     => $taxonName,
                'reviewer_level' => $reviewerLevel,
            ]
        );
    }

    /**
     * occurrence の監査履歴を取得
     */
    public static function getHistory(string $occurrenceId, int $limit = 100): array
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("
            SELECT * FROM audit_log
            WHERE occurrence_id = :id
            ORDER BY created_at DESC
            LIMIT :limit
        ");
        $stmt->execute([':id' => $occurrenceId, ':limit' => $limit]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        foreach ($rows as &$row) {
            if ($row['details']) {
                $row['details'] = json_decode($row['details'], true);
            }
        }

        return $rows;
    }

    /**
     * 最近の監査ログを取得（ダッシュボード用）
     */
    public static function getRecent(int $limit = 50, ?string $action = null): array
    {
        $pdo = self::getPDO();

        $sql = "SELECT * FROM audit_log";
        $params = [];

        if ($action) {
            $sql .= " WHERE action = :action";
            $params[':action'] = $action;
        }

        $sql .= " ORDER BY created_at DESC LIMIT :limit";
        $params[':limit'] = $limit;

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // ─── Internal ───────────────────────────────────────────────

    private static function getPDO(): PDO
    {
        if (self::$pdo === null) {
            $dbPath = DATA_DIR . '/ikimon.db';
            self::$pdo = new PDO('sqlite:' . $dbPath);
            self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            self::$pdo->exec('PRAGMA journal_mode = WAL');
        }
        return self::$pdo;
    }

    private static function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
