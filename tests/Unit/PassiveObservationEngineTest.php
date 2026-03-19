<?php

use PHPUnit\Framework\TestCase;

/**
 * Unit tests for PassiveObservationEngine
 *
 * パッシブ観察エンジンの検出処理・信頼度判定・サマリー生成を検証。
 */
class PassiveObservationEngineTest extends TestCase
{
    // === 単一イベント処理 ===

    public function testHighConfidenceEventIsRecorded(): void
    {
        $event = $this->makeEvent('audio', 'シジュウカラ', 0.85);
        $result = PassiveObservationEngine::processEvent($event);

        $this->assertSame('record', $result['action']);
        $this->assertGreaterThanOrEqual(0.70, $result['confidence']);
    }

    public function testMediumConfidenceEventIsSuggested(): void
    {
        $event = $this->makeEvent('audio', 'Unknown Bird', 0.55);
        $result = PassiveObservationEngine::processEvent($event);

        $this->assertSame('suggest', $result['action']);
    }

    public function testLowConfidenceEventIsDiscarded(): void
    {
        $event = $this->makeEvent('audio', 'Noise', 0.20);
        $result = PassiveObservationEngine::processEvent($event);

        $this->assertSame('discard', $result['action']);
    }

    public function testNoLocationReducesConfidence(): void
    {
        $withLocation = $this->makeEvent('audio', 'Test', 0.75);
        $withoutLocation = $this->makeEvent('audio', 'Test', 0.75);
        $withoutLocation['lat'] = null;
        $withoutLocation['lng'] = null;

        $r1 = PassiveObservationEngine::processEvent($withLocation);
        $r2 = PassiveObservationEngine::processEvent($withoutLocation);

        $this->assertGreaterThan($r2['confidence'], $r1['confidence']);
    }

    public function testProcessEventPreservesMetadata(): void
    {
        $event = $this->makeEvent('visual', 'アゲハチョウ', 0.90);
        $event['model'] = 'yolo_v8_nano';
        $event['photo_ref'] = 'scan_abc123.jpg';

        $result = PassiveObservationEngine::processEvent($event);

        $this->assertSame('visual', $result['type']);
        $this->assertSame('yolo_v8_nano', $result['model']);
        $this->assertSame('scan_abc123.jpg', $result['photo_ref']);
    }

    // === バッチ処理 ===

    public function testBatchProcessDeduplicatesSameSpecies(): void
    {
        $events = [
            $this->makeEvent('audio', 'シジュウカラ', 0.80),
            $this->makeEvent('audio', 'シジュウカラ', 0.90), // 同一種、高信頼度
            $this->makeEvent('audio', 'シジュウカラ', 0.75),
            $this->makeEvent('audio', 'メジロ', 0.85),
        ];

        $result = PassiveObservationEngine::processEventBatch($events, 'user_test');

        // 2種に統合される
        $this->assertCount(2, $result['observations']);
    }

    public function testBatchProcessReturnsSessionId(): void
    {
        $events = [$this->makeEvent('audio', 'Test', 0.80)];
        $result = PassiveObservationEngine::processEventBatch($events, 'user_test');

        $this->assertStringStartsWith('ps_', $result['session_id']);
    }

    public function testBatchProcessDiscardsBelowThreshold(): void
    {
        $events = [
            $this->makeEvent('audio', 'Low', 0.10),
            $this->makeEvent('audio', 'VeryLow', 0.05),
        ];

        $result = PassiveObservationEngine::processEventBatch($events, 'user_test');
        $this->assertEmpty($result['observations']);
    }

    // === サマリー ===

    public function testSummaryCountsSpecies(): void
    {
        $events = [
            $this->makeEvent('audio', 'Species A', 0.80),
            $this->makeEvent('audio', 'Species B', 0.85),
            $this->makeEvent('visual', 'Species C', 0.90),
        ];

        $result = PassiveObservationEngine::processEventBatch($events, 'user_test', [
            'duration_sec' => 1800,
            'distance_m' => 1200,
        ]);

        $this->assertSame(3, $result['summary']['species_count']);
        $this->assertSame(1800, $result['summary']['duration_sec']);
        $this->assertSame(1200, $result['summary']['distance_m']);
    }

    public function testSummaryByType(): void
    {
        $events = [
            $this->makeEvent('audio', 'Bird A', 0.80),
            $this->makeEvent('audio', 'Bird B', 0.85),
            $this->makeEvent('visual', 'Butterfly', 0.90),
        ];

        $result = PassiveObservationEngine::processEventBatch($events, 'user_test');

        $this->assertSame(2, $result['summary']['by_type']['audio']);
        $this->assertSame(1, $result['summary']['by_type']['visual']);
    }

    // === 観察レコード変換 ===

    public function testObservationHasRequiredFields(): void
    {
        $events = [$this->makeEvent('audio', 'シジュウカラ', 0.85)];
        $result = PassiveObservationEngine::processEventBatch($events, 'user_123');
        $obs = $result['observations'][0];

        $this->assertStringStartsWith('pobs_', $obs['id']);
        $this->assertSame('user_123', $obs['user_id']);
        $this->assertSame('シジュウカラ', $obs['species_name']);
        $this->assertSame('passive', $obs['source']);
        $this->assertSame('pocket', $obs['record_mode']);
        $this->assertSame('ai_classified', $obs['verification_stage']);
        $this->assertNotEmpty($obs['stage_history']);
    }

    public function testVisualDetectionIsScanMode(): void
    {
        $events = [$this->makeEvent('visual', 'アゲハチョウ', 0.90)];
        $result = PassiveObservationEngine::processEventBatch($events, 'user_test');
        $obs = $result['observations'][0];

        $this->assertSame('scan', $obs['record_mode']);
    }

    // === 定数テスト ===

    public function testConfidenceThresholds(): void
    {
        $this->assertGreaterThan(
            PassiveObservationEngine::CONFIDENCE_SUGGEST,
            PassiveObservationEngine::CONFIDENCE_AUTO_RECORD
        );
        $this->assertGreaterThan(
            PassiveObservationEngine::CONFIDENCE_DISCARD,
            PassiveObservationEngine::CONFIDENCE_SUGGEST
        );
    }

    // === ヘルパー ===

    private function makeEvent(string $type, string $taxonName, float $confidence): array
    {
        return [
            'type' => $type,
            'taxon_name' => $taxonName,
            'scientific_name' => '',
            'confidence' => $confidence,
            'lat' => 35.6762,
            'lng' => 139.6503,
            'timestamp' => '2026-03-19T10:30:00+09:00',
            'model' => 'test_model',
        ];
    }
}
