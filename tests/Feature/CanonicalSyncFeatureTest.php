<?php

use PHPUnit\Framework\TestCase;

class CanonicalSyncFeatureTest extends TestCase
{
    private string $dbPath;

    protected function setUp(): void
    {
        $this->dbPath = DATA_DIR . '/ikimon.db';
        $this->resetStaticPdo(CanonicalStore::class, 'pdo');
        $this->resetStaticPdo(AuditLog::class, 'pdo');
        DataStore::setPath(DATA_DIR);
        $this->cleanupDbFiles();
        $this->createCanonicalTables();
        $this->truncateCanonicalTables();
    }

    public function testSyncOneCreatesCanonicalRecords(): void
    {
        $observation = [
            'id' => 'obs-sync-1',
            'user_id' => 'user-1',
            'observed_at' => '2026-04-11 09:30:00',
            'lat' => 35.0,
            'lng' => 138.0,
            'photos' => ['uploads/photos/obs-sync-1/photo_0.webp'],
            'identifications' => [
                ['user_id' => 'identifier-1', 'taxon_name' => 'Parus minor'],
            ],
            'taxon' => [
                'scientific_name' => 'Parus minor',
            ],
        ];

        $result = CanonicalSync::syncOne($observation);
        $pdo = new PDO('sqlite:' . $this->dbPath);

        $occurrenceCount = (int)$pdo->query("SELECT COUNT(*) FROM occurrences WHERE original_observation_id = 'obs-sync-1'")->fetchColumn();
        $evidenceCount = (int)$pdo->query("SELECT COUNT(*) FROM evidence")->fetchColumn();
        $auditCount = (int)$pdo->query("SELECT COUNT(*) FROM audit_log WHERE action = 'sync'")->fetchColumn();

        $this->assertTrue($result['synced']);
        $this->assertSame(1, $occurrenceCount);
        $this->assertSame(1, $evidenceCount);
        $this->assertSame(1, $auditCount);
    }

    public function testSyncOneIsIdempotent(): void
    {
        $observation = [
            'id' => 'obs-sync-2',
            'user_id' => 'user-2',
            'observed_at' => '2026-04-11 09:30:00',
            'lat' => 35.1,
            'lng' => 138.1,
            'photos' => [],
            'identifications' => [],
        ];

        $first = CanonicalSync::syncOne($observation);
        $second = CanonicalSync::syncOne($observation);
        $pdo = new PDO('sqlite:' . $this->dbPath);
        $count = (int)$pdo->query("SELECT COUNT(*) FROM occurrences WHERE original_observation_id = 'obs-sync-2'")->fetchColumn();

        $this->assertTrue($first['synced']);
        $this->assertFalse($second['synced']);
        $this->assertSame('already_synced', $second['skip_reason']);
        $this->assertSame(1, $count);
    }

    public function testSyncOneSkipsFixtureStyleObservation(): void
    {
        $observation = [
            'id' => 'o1',
            'user_id' => 'u1',
            'created_at' => '2026-04-11 10:00:00',
            'photos' => [],
            'identifications' => [],
        ];

        $result = CanonicalSync::syncOne($observation);
        $pdo = new PDO('sqlite:' . $this->dbPath);
        $count = (int)$pdo->query("SELECT COUNT(*) FROM occurrences WHERE original_observation_id = 'o1'")->fetchColumn();

        $this->assertFalse($result['synced']);
        $this->assertSame('fixture_style_observation', $result['skip_reason']);
        $this->assertSame(0, $count);
    }

    private function createCanonicalTables(): void
    {
        $pdo = new PDO('sqlite:' . $this->dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

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
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS occurrences (
                occurrence_id TEXT PRIMARY KEY,
                event_id TEXT NOT NULL,
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
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS evidence (
                evidence_id TEXT PRIMARY KEY,
                occurrence_id TEXT NOT NULL,
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
                occurrence_id TEXT NOT NULL,
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
    }

    private function truncateCanonicalTables(): void
    {
        $pdo = new PDO('sqlite:' . $this->dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        foreach (['audit_log', 'identifications', 'evidence', 'occurrences', 'events'] as $table) {
            $pdo->exec("DELETE FROM {$table}");
        }
    }

    private function resetStaticPdo(string $className, string $property): void
    {
        $reflection = new ReflectionProperty($className, $property);
        $reflection->setValue(null, null);
    }

    private function cleanupDbFiles(): void
    {
        foreach ([$this->dbPath, $this->dbPath . '-wal', $this->dbPath . '-shm'] as $path) {
            if (!file_exists($path)) {
                continue;
            }
            for ($attempt = 0; $attempt < 3; $attempt++) {
                if (@unlink($path) || !file_exists($path)) {
                    break;
                }
                usleep(100000);
            }
        }
    }
}
