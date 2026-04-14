<?php

use PHPUnit\Framework\TestCase;

class PrivacyFilterFeatureTest extends TestCase
{
    public function testHiddenGranularityRemovesCoordinates(): void
    {
        $filtered = PrivacyFilter::autoFilter([
            'lat' => 35.123456,
            'lng' => 138.987654,
            'location_granularity' => 'hidden',
        ]);

        $this->assertNull($filtered['lat']);
        $this->assertNull($filtered['lng']);
        $this->assertSame('ambient', $filtered['privacy_layer']);
    }

    public function testMunicipalityGranularityUsesAmbientGrid(): void
    {
        $filtered = PrivacyFilter::autoFilter([
            'lat' => 35.123456,
            'lng' => 138.987654,
            'location_granularity' => 'municipality',
            'observed_at' => '2026-04-11 10:23:00',
        ]);

        $this->assertSame(1000, $filtered['grid_m']);
        $this->assertSame('ambient', $filtered['privacy_layer']);
        $this->assertArrayHasKey('cell_id', $filtered);
    }

    public function testPrefectureGranularityUsesCoarserGrid(): void
    {
        $filtered = PrivacyFilter::autoFilter([
            'lat' => 35.123456,
            'lng' => 138.987654,
            'location_granularity' => 'prefecture',
            'observed_at' => '2026-04-11 10:23:00',
        ]);

        $this->assertSame(10000, $filtered['grid_m']);
    }

    public function testApplyTimeDelayRoundsToHour(): void
    {
        $result = PrivacyFilter::applyTimeDelay('2026-04-11 10:23:00', 5400);

        $this->assertSame('2026-04-11T11:00:00+09:00', $result);
    }

    public function testDescribeGranularityReturnsPublicLabel(): void
    {
        $description = PrivacyFilter::describeGranularity('hidden');

        $this->assertSame('位置非公開', $description['label']);
        $this->assertNull($description['grid_m']);
    }
}
