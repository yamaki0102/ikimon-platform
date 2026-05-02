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

    public function testPublicDisplayExactFallsBackToMunicipalityArea(): void
    {
        $summary = PrivacyFilter::buildPublicLocationSummary([
            'lat' => 35.123456,
            'lng' => 138.987654,
            'location_granularity' => 'exact',
            'municipality' => '浜松市',
            'prefecture' => '静岡県',
            'observed_at' => '2026-04-11 10:23:00',
        ]);

        $this->assertSame('municipality', $summary['scope']);
        $this->assertSame(1000, $summary['grid_m']);
        $this->assertSame(500, $summary['radius_m']);
        $this->assertSame('area', $summary['display_mode']);
        $this->assertSame('浜松市', $summary['label']);
    }

    public function testPublicDisplayUsesPrefectureGridForPrefectureGranularity(): void
    {
        $summary = PrivacyFilter::buildPublicLocationSummary([
            'lat' => 35.123456,
            'lng' => 138.987654,
            'location_granularity' => 'prefecture',
            'municipality' => '浜松市',
            'prefecture' => '静岡県',
            'observed_at' => '2026-04-11 10:23:00',
        ]);

        $this->assertSame('prefecture', $summary['scope']);
        $this->assertSame(10000, $summary['grid_m']);
        $this->assertSame(5000, $summary['radius_m']);
        $this->assertSame('area', $summary['display_mode']);
    }

    public function testPublicDisplayHiddenRemovesCoordinates(): void
    {
        $summary = PrivacyFilter::buildPublicLocationSummary([
            'lat' => 35.123456,
            'lng' => 138.987654,
            'location_granularity' => 'hidden',
            'municipality' => '浜松市',
            'prefecture' => '静岡県',
        ]);

        $this->assertTrue($summary['is_hidden']);
        $this->assertNull($summary['lat']);
        $this->assertNull($summary['lng']);
        $this->assertNull($summary['grid_m']);
        $this->assertSame('hidden', $summary['display_mode']);
    }

    public function testPublicLabelSuppressesSiteNameUnlessExplicitlyAllowed(): void
    {
        $summary = PrivacyFilter::buildPublicLocationSummary([
            'site_id' => 'ikan_hq',
            'site_name' => '愛管株式会社 連理の木コミュニティーエリア',
            'managed_context' => ['site_name' => '管理施設の固有名'],
            'location_granularity' => 'municipality',
            'municipality' => '浜松市',
            'prefecture' => '静岡県',
            'lat' => 34.8142,
            'lng' => 137.7327,
            'observed_at' => '2026-04-11 10:23:00',
        ]);

        $this->assertSame('浜松市', $summary['label']);
        $this->assertFalse($summary['detail_allowed']);
    }

    public function testPublicLabelAllowsRegisteredParkDetail(): void
    {
        $summary = PrivacyFilter::buildPublicLocationSummary([
            'site_id' => 'hamamatsu_park',
            'site_name' => '浜松城公園 共生エリア',
            'location_granularity' => 'municipality',
            'municipality' => '浜松市',
            'prefecture' => '静岡県',
            'lat' => 34.711,
            'lng' => 137.733,
            'observed_at' => '2026-04-11 10:23:00',
        ]);

        $this->assertSame('浜松城公園 共生エリア', $summary['label']);
        $this->assertTrue($summary['detail_allowed']);
    }

    public function testRegisteredParkDetailDoesNotOverridePrefectureScope(): void
    {
        $summary = PrivacyFilter::buildPublicLocationSummary([
            'site_id' => 'hamamatsu_park',
            'site_name' => '浜松城公園 共生エリア',
            'location_granularity' => 'prefecture',
            'municipality' => '浜松市',
            'prefecture' => '静岡県',
            'lat' => 34.711,
            'lng' => 137.733,
            'observed_at' => '2026-04-11 10:23:00',
        ]);

        $this->assertSame('静岡県', $summary['label']);
        $this->assertTrue($summary['detail_allowed']);
    }

    public function testDecoratePublicObservationRemovesManagedSiteName(): void
    {
        $obs = [
            'site_id' => 'ikan_hq',
            'site_name' => '愛管株式会社 連理の木コミュニティーエリア',
            'managed_site_name' => '愛管株式会社 連理の木コミュニティーエリア',
            'managed_context_note' => '施設内の詳細メモ',
            'managed_context' => [
                'type' => 'park_planting',
                'site_name' => '愛管株式会社 連理の木コミュニティーエリア',
                'note' => '施設内の詳細メモ',
            ],
            'location_granularity' => 'municipality',
            'municipality' => '浜松市',
            'prefecture' => '静岡県',
            'lat' => 34.8142,
            'lng' => 137.7327,
            'observed_at' => '2026-04-11 10:23:00',
        ];

        $filtered = PrivacyFilter::filterForPublicDisplay($obs);
        $decorated = PrivacyFilter::decoratePublicObservation($filtered, $filtered);

        $this->assertSame('浜松市', $decorated['location_name']);
        $this->assertNull($decorated['site_name']);
        $this->assertNull($decorated['managed_site_name']);
        $this->assertNull($decorated['managed_context_note']);
        $this->assertNull($decorated['managed_context']['site_name']);
        $this->assertNull($decorated['managed_context']['note']);
        $this->assertSame('浜松市', $decorated['public_location']['label']);
    }
}
