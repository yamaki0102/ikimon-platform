<?php
/**
 * Migration 003: Effort Normalization + Absence Data
 *
 * Sprint A: Codex C0-1 対応
 * - events: session_mode, complete_checklist_flag, target_taxa_scope 追加
 * - occurrences: occurrence_status 追加 (present/absent/uncertain)
 * - privacy_access: consent_scope, retention_until 追加
 *
 * Usage: php scripts/migration/003_effort_and_absence.php
 */

require_once __DIR__ . '/../../config/config.php';

$dbPath = DATA_DIR . '/ikimon.db';

echo "=== Migration 003: Effort & Absence ===\n";
echo "Database: {$dbPath}\n\n";

try {
    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('PRAGMA foreign_keys = ON');

    // Check if already applied
    $applied = $db->query("SELECT version FROM schema_migrations WHERE version = '003'")->fetchColumn();
    if ($applied) {
        echo "Migration 003 already applied. Skipping.\n";
        exit(0);
    }

    $db->beginTransaction();

    // ─── events: セッション単位の努力量フィールド ───
    echo "[1/5] Adding session_mode to events...\n";
    $db->exec("ALTER TABLE events ADD COLUMN session_mode TEXT");

    echo "[2/5] Adding complete_checklist_flag to events...\n";
    $db->exec("ALTER TABLE events ADD COLUMN complete_checklist_flag INTEGER DEFAULT 0");

    echo "[3/5] Adding target_taxa_scope to events...\n";
    $db->exec("ALTER TABLE events ADD COLUMN target_taxa_scope TEXT");

    // ─── occurrences: 在/不在ステータス ───
    echo "[4/5] Adding occurrence_status to occurrences...\n";
    $db->exec("ALTER TABLE occurrences ADD COLUMN occurrence_status TEXT DEFAULT 'present'");

    // ─── privacy_access: 同意スコープ + 保持期限 ───
    echo "[5/5] Adding consent_scope, retention_until to privacy_access...\n";
    $db->exec("ALTER TABLE privacy_access ADD COLUMN consent_scope TEXT");
    $db->exec("ALTER TABLE privacy_access ADD COLUMN retention_until TEXT");

    // インデックス追加
    $db->exec("CREATE INDEX IF NOT EXISTS idx_events_mode ON events(session_mode)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_occ_status ON occurrences(occurrence_status)");

    // バージョン記録
    $db->exec("
        INSERT INTO schema_migrations (version, description)
        VALUES ('003', 'Effort normalization + absence data + consent scope')
    ");

    $db->commit();

    echo "\n=== Migration 003 Complete ===\n";
    echo "Added: events.session_mode, events.complete_checklist_flag, events.target_taxa_scope\n";
    echo "Added: occurrences.occurrence_status\n";
    echo "Added: privacy_access.consent_scope, privacy_access.retention_until\n";

} catch (PDOException $e) {
    if (isset($db) && $db->inTransaction()) {
        $db->rollBack();
    }
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
