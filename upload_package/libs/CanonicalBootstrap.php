<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/MeshCode.php';

class CanonicalBootstrap
{
    private static bool $ensured = false;

    public static function ensureSchema(): void
    {
        if (self::$ensured) {
            return;
        }

        $dbPath = DATA_DIR . '/ikimon.db';
        $dir = dirname($dbPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        $pdo = new PDO('sqlite:' . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->exec('PRAGMA foreign_keys = ON');
        $pdo->exec('PRAGMA journal_mode = WAL');

        $pdo->exec("
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
                session_mode TEXT,
                complete_checklist_flag INTEGER DEFAULT 0,
                target_taxa_scope TEXT,
                movement_mode TEXT,
                movement_mode_log TEXT,
                route_hash TEXT,
                schema_version TEXT DEFAULT '1.0',
                created_at TEXT DEFAULT (datetime('now'))
            )
        ");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_events_date ON events(event_date)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_events_site ON events(site_id)");
        try { $pdo->exec("ALTER TABLE events ADD COLUMN place_id TEXT"); } catch (\Throwable $e) {}
        try { $pdo->exec("ALTER TABLE events ADD COLUMN locality_label TEXT"); } catch (\Throwable $e) {}
        try { $pdo->exec("ALTER TABLE events ADD COLUMN locality_context TEXT"); } catch (\Throwable $e) {}
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_events_place ON events(place_id)");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS occurrences (
                occurrence_id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL REFERENCES events(event_id),
                scientific_name TEXT,
                vernacular_name TEXT,
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
                occurrence_status TEXT DEFAULT 'present',
                speed_kmh REAL,
                ai_version TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        ");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_occ_event ON occurrences(event_id)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_occ_original ON occurrences(original_observation_id)");

        $pdo->exec("
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

        $pdo->exec("
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

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS privacy_access (
                record_id TEXT PRIMARY KEY,
                coordinate_precision TEXT,
                access_tier TEXT,
                legal_basis TEXT,
                sensitive_species INTEGER DEFAULT 0,
                consent_scope TEXT,
                retention_until TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        ");

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

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version TEXT PRIMARY KEY,
                description TEXT,
                applied_at TEXT DEFAULT (datetime('now'))
            )
        ");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS place_registry (
                place_id TEXT PRIMARY KEY,
                place_key TEXT NOT NULL UNIQUE,
                site_id TEXT,
                source_kind TEXT NOT NULL DEFAULT 'mesh4',
                canonical_name TEXT,
                locality_label TEXT,
                country TEXT,
                prefecture TEXT,
                municipality TEXT,
                mesh3 TEXT,
                mesh4 TEXT,
                center_latitude REAL,
                center_longitude REAL,
                first_event_at TEXT,
                last_event_at TEXT,
                visit_count INTEGER DEFAULT 0,
                occurrence_count INTEGER DEFAULT 0,
                created_at TEXT DEFAULT (datetime('now')),
                updated_at TEXT DEFAULT (datetime('now'))
            )
        ");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_place_registry_site ON place_registry(site_id)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_place_registry_mesh4 ON place_registry(mesh4)");
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS place_condition_logs (
                condition_id TEXT PRIMARY KEY,
                place_id TEXT NOT NULL REFERENCES place_registry(place_id),
                event_id TEXT REFERENCES events(event_id),
                observed_at TEXT,
                biome TEXT,
                substrate_tags TEXT,
                evidence_tags TEXT,
                cultivation TEXT,
                organism_origin TEXT,
                managed_context_type TEXT,
                managed_site_name TEXT,
                locality_note TEXT,
                environment_summary TEXT,
                metadata TEXT,
                created_at TEXT DEFAULT (datetime('now'))
            )
        ");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_place_condition_logs_place ON place_condition_logs(place_id)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_place_condition_logs_event ON place_condition_logs(event_id)");
        $pdo->exec("
            CREATE VIEW IF NOT EXISTS place_revisit_summary AS
            SELECT
                p.place_id,
                p.place_key,
                p.canonical_name,
                p.locality_label,
                p.site_id,
                p.municipality,
                p.mesh4,
                COUNT(DISTINCT e.event_id) AS visit_count,
                COUNT(DISTINCT DATE(e.event_date)) AS visit_days,
                MIN(e.event_date) AS first_visit_at,
                MAX(e.event_date) AS last_visit_at,
                COUNT(DISTINCT o.occurrence_id) AS occurrence_count,
                COUNT(DISTINCT o.scientific_name) AS taxon_count
            FROM place_registry p
            LEFT JOIN events e ON e.place_id = p.place_id
            LEFT JOIN occurrences o ON o.event_id = e.event_id
            GROUP BY
                p.place_id,
                p.place_key,
                p.canonical_name,
                p.locality_label,
                p.site_id,
                p.municipality,
                p.mesh4
        ");
        $stmt = $pdo->prepare("
            INSERT OR IGNORE INTO schema_migrations (version, description)
            VALUES (:version, :description)
        ");
        $stmt->execute([
            ':version' => '001',
            ':description' => 'Canonical schema bootstrapped on demand',
        ]);
        $stmt->execute([
            ':version' => '002',
            ':description' => 'Place intelligence registry and condition logs added',
        ]);

        self::$ensured = true;
    }

    public static function resetForTests(): void
    {
        self::$ensured = false;
    }
}
