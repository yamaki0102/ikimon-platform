<?php
/**
 * Migration 001: Canonical Schema (5層 + ライブ層)
 *
 * 100年耐久設計に基づく正規データスキーマ。
 * ADR-001, ADR-002, ADR-005 準拠。
 *
 * Layer 1: events       — いつ・どこで・どうやって
 * Layer 2: occurrences  — 何がいたか
 * Layer 3: evidence     — 証拠メディア
 * Layer 4: identifications — 誰が何と同定したか (immutable)
 * Layer 5: privacy_access — 公開制御
 * Layer 6: live_detections — リアルタイムマップ用 (24h TTL)
 *
 * Usage: php scripts/migration/001_canonical_schema.php
 */

require_once __DIR__ . '/../../config/config.php';

$dbPath = DATA_DIR . '/ikimon.db';

echo "=== Canonical Schema Migration ===\n";
echo "Database: {$dbPath}\n\n";

try {
    $db = new PDO('sqlite:' . $dbPath);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('PRAGMA foreign_keys = ON');
    $db->exec('PRAGMA journal_mode = WAL');

    // ========================================
    // Layer 1: Events（いつ・どこで・どうやって）
    // ========================================
    echo "[1/6] Creating events table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS events (
            event_id TEXT PRIMARY KEY,
            parent_event_id TEXT,
            event_date TEXT NOT NULL,
            decimal_latitude REAL,
            decimal_longitude REAL,
            geodetic_datum TEXT DEFAULT 'EPSG:4326',
            coordinate_uncertainty_m REAL,
            uncertainty_type TEXT,
            sampling_protocol TEXT,
            sampling_effort TEXT,
            capture_device TEXT,
            recorded_by TEXT,
            site_id TEXT,
            schema_version TEXT DEFAULT '1.0',
            created_at TEXT DEFAULT (datetime('now'))
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_events_site ON events(site_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_events_parent ON events(parent_event_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_events_protocol ON events(sampling_protocol)");

    // ========================================
    // Layer 2: Occurrences（何がいたか）
    // ========================================
    echo "[2/6] Creating occurrences table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS occurrences (
            occurrence_id TEXT PRIMARY KEY,
            event_id TEXT NOT NULL REFERENCES events(event_id),
            scientific_name TEXT,
            taxon_rank TEXT,
            taxon_concept_version TEXT,
            basis_of_record TEXT,
            individual_count INTEGER,
            evidence_tier REAL DEFAULT 1,
            evidence_tier_at TEXT,
            evidence_tier_by TEXT,
            data_quality TEXT DEFAULT 'C',
            observation_source TEXT,
            original_observation_id TEXT,
            detection_confidence REAL,
            adjusted_confidence REAL,
            confidence_context TEXT,
            detection_model TEXT,
            detection_model_hash TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_occ_event ON occurrences(event_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_occ_tier ON occurrences(evidence_tier)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_occ_source ON occurrences(observation_source)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_occ_species ON occurrences(scientific_name)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_occ_adjusted ON occurrences(adjusted_confidence)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_occ_quality ON occurrences(data_quality)");

    // ========================================
    // Layer 3: Evidence（証拠メディア）
    // ========================================
    echo "[3/6] Creating evidence table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS evidence (
            evidence_id TEXT PRIMARY KEY,
            occurrence_id TEXT NOT NULL REFERENCES occurrences(occurrence_id),
            media_type TEXT NOT NULL,
            media_path TEXT NOT NULL,
            media_hash TEXT,
            capture_timestamp TEXT,
            duration_seconds REAL,
            metadata TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_evidence_occ ON evidence(occurrence_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_evidence_hash ON evidence(media_hash)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence(media_type)");

    // ========================================
    // Layer 4: Identifications（同定ログ — immutable）
    // ========================================
    echo "[4/6] Creating identifications table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS identifications (
            identification_id TEXT PRIMARY KEY,
            occurrence_id TEXT NOT NULL REFERENCES occurrences(occurrence_id),
            identified_by TEXT NOT NULL,
            taxon_name TEXT NOT NULL,
            taxon_concept_version TEXT,
            identification_method TEXT,
            confidence REAL,
            reviewer_level TEXT,
            notes TEXT,
            is_current INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now'))
        )
    ");
    // ★ このテーブルは INSERT のみ。UPDATE 禁止（immutable log）
    $db->exec("CREATE INDEX IF NOT EXISTS idx_id_occ ON identifications(occurrence_id)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_id_current ON identifications(is_current)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_id_method ON identifications(identification_method)");

    // ========================================
    // Layer 5: PrivacyAccess（公開制御）
    // ========================================
    echo "[5/6] Creating privacy_access table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS privacy_access (
            record_id TEXT PRIMARY KEY,
            coordinate_precision TEXT,
            access_tier TEXT,
            legal_basis TEXT,
            sensitive_species INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
        )
    ");

    // ========================================
    // Layer 6: LiveDetections（リアルタイム・揮発性）
    // ========================================
    echo "[6/6] Creating live_detections table...\n";
    $db->exec("
        CREATE TABLE IF NOT EXISTS live_detections (
            detection_id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            scientific_name TEXT,
            common_name TEXT,
            detection_confidence REAL,
            adjusted_confidence REAL,
            detection_type TEXT,
            occurrence_id TEXT,
            detected_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            is_anonymous INTEGER DEFAULT 1
        )
    ");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_live_geo ON live_detections(lat, lng)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_live_time ON live_detections(detected_at)");
    $db->exec("CREATE INDEX IF NOT EXISTS idx_live_expires ON live_detections(expires_at)");

    // ========================================
    // Schema version tracking
    // ========================================
    $db->exec("
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version TEXT PRIMARY KEY,
            description TEXT,
            applied_at TEXT DEFAULT (datetime('now'))
        )
    ");
    $db->exec("
        INSERT OR IGNORE INTO schema_migrations (version, description)
        VALUES ('001', 'Canonical Schema v1.0 — 5 layers + live layer')
    ");

    echo "\n=== Migration Complete ===\n";
    echo "Tables created: events, occurrences, evidence, identifications, privacy_access, live_detections\n";

    // テーブル確認
    $tables = $db->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
    echo "All tables: " . implode(', ', $tables) . "\n";

} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
