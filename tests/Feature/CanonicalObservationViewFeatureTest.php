<?php

use PHPUnit\Framework\TestCase;

class CanonicalObservationViewFeatureTest extends TestCase
{
    private string $dbPath;

    protected function setUp(): void
    {
        $this->dbPath = DATA_DIR . '/ikimon.db';
        CanonicalBootstrap::resetForTests();
        $this->resetStaticPdo(CanonicalStore::class, 'pdo');
        $this->resetStaticPdo(AuditLog::class, 'pdo');

        if (file_exists($this->dbPath)) {
            unlink($this->dbPath);
        }

        CanonicalObservationWriter::writeFromObservation([
            'id' => 'obs-view-1',
            'user_id' => 'user-1',
            'observed_at' => '2026-04-11 12:34:00',
            'lat' => 35.5,
            'lng' => 138.5,
            'photos' => ['uploads/photos/obs-view-1/photo_0.webp'],
            'location_granularity' => 'prefecture',
            'taxon' => [
                'name' => 'シジュウカラ',
                'scientific_name' => 'Parus minor',
                'rank' => 'species',
            ],
            'identifications' => [
                ['user_id' => 'user-1', 'taxon_name' => 'Parus minor'],
            ],
        ]);
    }

    public function testHydrateUsesCanonicalAggregateWhenAvailable(): void
    {
        $hydrated = CanonicalObservationView::hydrate([
            'id' => 'obs-view-1',
            'observed_at' => '2000-01-01 00:00:00',
            'lat' => 0,
            'lng' => 0,
            'photos' => [],
            'identifications' => [],
        ]);

        $this->assertTrue($hydrated['canonical_view']['enabled']);
        $this->assertSame('2026-04-11 12:34:00', $hydrated['observed_at']);
        $this->assertSame(35.5, $hydrated['lat']);
        $this->assertSame(138.5, $hydrated['lng']);
        $this->assertSame('prefecture', $hydrated['location_granularity']);
        $this->assertSame(['uploads/photos/obs-view-1/photo_0.webp'], $hydrated['photos']);
    }

    public function testHydrateSummaryModePreservesCanonicalSummaryWithoutExpandingIds(): void
    {
        $hydrated = CanonicalObservationView::hydrate([
            'id' => 'obs-view-1',
            'identifications' => [['taxon_name' => 'legacy']],
        ], true);

        $this->assertTrue($hydrated['canonical_view']['enabled']);
        $this->assertTrue($hydrated['canonical_view']['summary_mode']);
        $this->assertSame('legacy', $hydrated['identifications'][0]['taxon_name']);
    }

    private function resetStaticPdo(string $className, string $property): void
    {
        $reflection = new ReflectionProperty($className, $property);
        $reflection->setValue(null, null);
    }
}
