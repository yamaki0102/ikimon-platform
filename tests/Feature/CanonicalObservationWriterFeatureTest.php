<?php

use PHPUnit\Framework\TestCase;

class CanonicalObservationWriterFeatureTest extends TestCase
{
    private string $dbPath;

    protected function setUp(): void
    {
        $this->dbPath = DATA_DIR . '/ikimon.db';
        CanonicalBootstrap::resetForTests();
        $this->resetStaticPdo(CanonicalStore::class, 'pdo');
        $this->resetStaticPdo(AuditLog::class, 'pdo');
        $this->cleanupDbFiles();
    }

    public function testWriteFromObservationCreatesCanonicalRowsAndPrivacySnapshot(): void
    {
        $result = CanonicalObservationWriter::writeFromObservation([
            'id' => 'obs-writer-1',
            'user_id' => 'user-1',
            'observed_at' => '2026-04-11 10:00:00',
            'lat' => 35.0,
            'lng' => 138.0,
            'photos' => ['uploads/photos/obs-writer-1/photo_0.webp'],
            'location_granularity' => 'municipality',
            'taxon' => [
                'name' => 'シジュウカラ',
                'scientific_name' => 'Parus minor',
                'rank' => 'species',
            ],
            'identifications' => [
                ['user_id' => 'user-1', 'taxon_name' => 'Parus minor'],
            ],
        ]);

        $pdo = new PDO('sqlite:' . $this->dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        $privacy = $pdo->query("SELECT coordinate_precision, access_tier FROM privacy_access")->fetch(PDO::FETCH_ASSOC);
        $occurrenceId = $result['occurrence_id'];
        $evidenceStmt = $pdo->prepare("SELECT COUNT(*) FROM evidence WHERE occurrence_id = ?");
        $evidenceStmt->execute([$occurrenceId]);
        $evidenceCount = (int)$evidenceStmt->fetchColumn();
        $auditStmt = $pdo->prepare("SELECT COUNT(*) FROM audit_log WHERE occurrence_id = ? AND action = 'sync'");
        $auditStmt->execute([$occurrenceId]);
        $auditCount = (int)$auditStmt->fetchColumn();

        $this->assertFalse($result['skipped']);
        $this->assertNotEmpty($result['occurrence_id']);
        $this->assertSame('municipality', $privacy['coordinate_precision']);
        $this->assertSame('public', $privacy['access_tier']);
        $this->assertSame(1, $evidenceCount);
        $this->assertSame(1, $auditCount);
    }

    public function testWriteFromObservationIsIdempotentByOriginalObservationId(): void
    {
        $observation = [
            'id' => 'obs-writer-2',
            'user_id' => 'user-1',
            'observed_at' => '2026-04-11 10:00:00',
            'lat' => 35.0,
            'lng' => 138.0,
            'photos' => [],
            'note' => 'light',
            'light_mode' => true,
            'location_granularity' => 'hidden',
        ];

        $first = CanonicalObservationWriter::writeFromObservation($observation);
        $second = CanonicalObservationWriter::writeFromObservation($observation);
        $pdo = new PDO('sqlite:' . $this->dbPath);
        $count = (int)$pdo->query("SELECT COUNT(*) FROM occurrences WHERE original_observation_id = 'obs-writer-2'")->fetchColumn();

        $this->assertFalse($first['skipped']);
        $this->assertTrue($second['skipped']);
        $this->assertSame(1, $count);
    }

    public function testWriteFromObservationSkipsTestNamedObservation(): void
    {
        $result = CanonicalObservationWriter::writeFromObservation([
            'id' => 'test-place-intel-guard',
            'user_id' => 'test-user',
            'observed_at' => '2026-04-11 10:00:00',
            'lat' => 34.7,
            'lng' => 137.7,
            'photos' => ['uploads/photos/test-place-intel-guard/photo_0.webp'],
            'taxon' => [
                'scientific_name' => 'Taraxacum officinale',
            ],
        ]);

        $pdo = new PDO('sqlite:' . $this->dbPath);
        $count = (int)$pdo->query("SELECT COUNT(*) FROM occurrences WHERE original_observation_id = 'test-place-intel-guard'")->fetchColumn();

        $this->assertTrue($result['skipped']);
        $this->assertSame('test_named_observation_id', $result['skip_reason']);
        $this->assertSame(0, $count);
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
