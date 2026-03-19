<?php

use PHPUnit\Framework\TestCase;

/**
 * Unit tests for MonitoringReferenceScorer (BiodiversityScorer)
 *
 * B2B収益の根幹となるスコア計算の正確性を保証する。
 * 5軸モデル: Richness(30%), DataConfidence(20%), ConservationValue(25%),
 *           TaxonomicCoverage(15%), MonitoringEffort(10%)
 */
class BiodiversityScorerTest extends TestCase
{
    // === 空データのテスト ===

    public function testEmptyObservationsReturnsZeroScore(): void
    {
        $result = MonitoringReferenceScorer::calculate([]);

        $this->assertSame(0, $result['total_score']);
        $this->assertSame(0, $result['species_count']);
        $this->assertSame(0.0, $result['shannon_index']);
        $this->assertEmpty($result['top_species']);
    }

    public function testEmptyResultHasAllBreakdownKeys(): void
    {
        $result = MonitoringReferenceScorer::calculate([]);

        $this->assertArrayHasKey('richness', $result['breakdown']);
        $this->assertArrayHasKey('data_confidence', $result['breakdown']);
        $this->assertArrayHasKey('conservation_value', $result['breakdown']);
        $this->assertArrayHasKey('taxonomic_coverage', $result['breakdown']);
        $this->assertArrayHasKey('monitoring_effort', $result['breakdown']);
    }

    public function testEmptyResultHasMethodology(): void
    {
        $result = MonitoringReferenceScorer::calculate([]);

        $this->assertArrayHasKey('methodology', $result);
        $this->assertSame('MRI', $result['methodology']['short_name']);
        $this->assertNotEmpty($result['methodology']['limitations']);
    }

    // === 単一観察のテスト ===

    public function testSingleObservationProducesLowScore(): void
    {
        $obs = [$this->makeObservation('Parus minor', 'シジュウカラ')];
        $result = MonitoringReferenceScorer::calculate($obs);

        $this->assertSame(1, $result['species_count']);
        // 1種だけなのでシャノン指数は0
        $this->assertSame(0.0, $result['shannon_index']);
        // スコアは低い（リッチネスが0）
        $this->assertLessThan(50, $result['total_score']);
    }

    // === シャノン指数のテスト ===

    public function testShannonIndexWithEqualDistribution(): void
    {
        // 4種 × 各5個体 → H' = ln(4) ≈ 1.39
        $obs = [];
        foreach (['Species A', 'Species B', 'Species C', 'Species D'] as $sp) {
            for ($i = 0; $i < 5; $i++) {
                $obs[] = $this->makeObservation($sp, $sp);
            }
        }

        $result = MonitoringReferenceScorer::calculate($obs);
        $this->assertSame(4, $result['species_count']);
        // ln(4) ≈ 1.39
        $this->assertEqualsWithDelta(1.39, $result['shannon_index'], 0.01);
    }

    public function testShannonIndexWithDominantSpecies(): void
    {
        // 1種が90個体、残り3種が各1個体 → H'は低い
        $obs = [];
        for ($i = 0; $i < 90; $i++) {
            $obs[] = $this->makeObservation('Dominant', 'ドミナント');
        }
        $obs[] = $this->makeObservation('Rare A', 'レアA');
        $obs[] = $this->makeObservation('Rare B', 'レアB');
        $obs[] = $this->makeObservation('Rare C', 'レアC');

        $result = MonitoringReferenceScorer::calculate($obs);
        $this->assertSame(4, $result['species_count']);
        $this->assertLessThan(0.5, $result['shannon_index']);
    }

    // === 重み配分のテスト ===

    public function testWeightsSumToOne(): void
    {
        $obs = [$this->makeObservation('Test', 'テスト')];
        $result = MonitoringReferenceScorer::calculate($obs);

        $totalWeight = 0;
        foreach ($result['breakdown'] as $axis) {
            $totalWeight += $axis['weight'];
        }
        $this->assertEqualsWithDelta(1.0, $totalWeight, 0.001);
    }

    public function testTotalScoreIsBoundedZeroToHundred(): void
    {
        // 大量の多様なデータ
        $obs = [];
        $groups = ['Aves', 'Insecta', 'Mammalia', 'Reptilia', 'Amphibia', 'Actinopterygii', 'Plantae', 'Fungi'];
        for ($i = 0; $i < 200; $i++) {
            $o = $this->makeObservation("Species {$i}", "種{$i}");
            $o['taxon']['group'] = $groups[$i % count($groups)];
            $o['data_quality'] = 'A';
            $o['observed_at'] = sprintf('2024-%02d-15', ($i % 12) + 1);
            $obs[] = $o;
        }

        $result = MonitoringReferenceScorer::calculate($obs);
        $this->assertGreaterThanOrEqual(0, $result['total_score']);
        $this->assertLessThanOrEqual(100, $result['total_score']);
    }

    // === データ信頼性のテスト ===

    public function testDataConfidenceWithAllRG(): void
    {
        $obs = [];
        for ($i = 0; $i < 10; $i++) {
            $o = $this->makeObservation("Species {$i}", "種{$i}");
            $o['data_quality'] = 'A';
            $obs[] = $o;
        }

        $result = MonitoringReferenceScorer::calculate($obs);
        $dcRaw = $result['breakdown']['data_confidence']['raw'];
        $this->assertEquals(100, $dcRaw); // 100% RG率
    }

    public function testDataConfidenceWithNoRG(): void
    {
        $obs = [];
        for ($i = 0; $i < 10; $i++) {
            $o = $this->makeObservation("Species {$i}", "種{$i}");
            $o['data_quality'] = 'C';
            $obs[] = $o;
        }

        $result = MonitoringReferenceScorer::calculate($obs);
        $dcRaw = $result['breakdown']['data_confidence']['raw'];
        $this->assertEquals(0, $dcRaw); // 0% RG率
    }

    // === 分類群カバレッジのテスト ===

    public function testTaxonomicCoverageIncreasesWithGroups(): void
    {
        $obs1 = [$this->makeObservationWithGroup('Bird', 'トリ', 'Aves')];
        $result1 = MonitoringReferenceScorer::calculate($obs1);

        $obs2 = [
            $this->makeObservationWithGroup('Bird', 'トリ', 'Aves'),
            $this->makeObservationWithGroup('Insect', 'ムシ', 'Insecta'),
            $this->makeObservationWithGroup('Plant', 'クサ', 'Plantae'),
        ];
        $result2 = MonitoringReferenceScorer::calculate($obs2);

        $tc1 = $result1['breakdown']['taxonomic_coverage']['score'];
        $tc2 = $result2['breakdown']['taxonomic_coverage']['score'];
        $this->assertGreaterThan($tc1, $tc2);
    }

    // === トップ種のテスト ===

    public function testTopSpeciesLimitedToFive(): void
    {
        $obs = [];
        for ($i = 0; $i < 10; $i++) {
            for ($j = 0; $j <= $i; $j++) {
                $obs[] = $this->makeObservation("Species {$i}", "種{$i}");
            }
        }

        $result = MonitoringReferenceScorer::calculate($obs);
        $this->assertCount(5, $result['top_species']);
    }

    public function testTopSpeciesSortedByCount(): void
    {
        $obs = [];
        for ($i = 0; $i < 10; $i++) $obs[] = $this->makeObservation('Common', 'コモン');
        for ($i = 0; $i < 3; $i++) $obs[] = $this->makeObservation('Rare', 'レア');

        $result = MonitoringReferenceScorer::calculate($obs);
        $this->assertSame('コモン', $result['top_species'][0]['name']);
        $this->assertSame(10, $result['top_species'][0]['count']);
    }

    // === 評価コメントのテスト ===

    public function testEvaluationStrings(): void
    {
        $empty = MonitoringReferenceScorer::calculate([]);
        $this->assertStringContainsString('少ない', $empty['evaluation']);
    }

    // === BiodiversityScorer後方互換のテスト ===

    public function testBiodiversityScorerClassExists(): void
    {
        $this->assertTrue(class_exists('BiodiversityScorer'));
    }

    public function testBiodiversityScorerExtendsMonitoringReferenceScorer(): void
    {
        $reflection = new \ReflectionClass('BiodiversityScorer');
        $this->assertSame('MonitoringReferenceScorer', $reflection->getParentClass()->getName());
    }

    // === ヘルパー ===

    private function makeObservation(string $scientificName, string $jaName, string $date = '2025-06-15'): array
    {
        return [
            'id' => 'obs_' . md5($scientificName . $date . mt_rand()),
            'taxon' => [
                'name' => $jaName,
                'scientific_name' => $scientificName,
            ],
            'species_name' => $jaName,
            'observed_at' => $date,
            'data_quality' => 'B',
        ];
    }

    private function makeObservationWithGroup(string $scientificName, string $jaName, string $group): array
    {
        $obs = $this->makeObservation($scientificName, $jaName);
        $obs['taxon']['group'] = $group;
        return $obs;
    }
}
