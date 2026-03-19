<?php

use PHPUnit\Framework\TestCase;

/**
 * Unit tests for DataStageManager
 *
 * データ検証ステージの遷移ルールと整合性を保証する。
 * 100年データ設計の中核ロジック。
 */
class DataStageManagerTest extends TestCase
{
    // === ステージ解決テスト ===

    public function testEmptyObservationReturnsUnverified(): void
    {
        $result = DataStageManager::resolveStage([]);
        $this->assertSame('unverified', $result);
    }

    public function testExplicitStageIsRespected(): void
    {
        $obs = ['verification_stage' => 'research_grade'];
        $result = DataStageManager::resolveStage($obs);
        $this->assertSame('research_grade', $result);
    }

    public function testObservationWithAiHighConfidenceIsAiClassified(): void
    {
        $obs = [
            'data_quality' => 'B',
            'ai_assessment' => ['confidence' => 0.85, 'taxon_name' => 'Parus minor'],
        ];
        $result = DataStageManager::resolveStage($obs);
        $this->assertSame('ai_classified', $result);
    }

    public function testObservationWithAiLowConfidenceIsNeedsReview(): void
    {
        $obs = [
            'data_quality' => 'B',
            'ai_assessment' => ['confidence' => 0.4, 'taxon_name' => 'Unknown'],
        ];
        $result = DataStageManager::resolveStage($obs);
        $this->assertSame('needs_review', $result);
    }

    public function testObservationWithIdentificationsIsHumanVerified(): void
    {
        $obs = [
            'data_quality' => 'B',
            'identifications' => [
                ['user_id' => 'u1', 'taxon_name' => 'Parus minor'],
            ],
        ];
        $result = DataStageManager::resolveStage($obs);
        $this->assertSame('human_verified', $result);
    }

    public function testGradeAWithTwoIdIsResearchGrade(): void
    {
        $obs = [
            'data_quality' => 'A',
            'identifications' => [
                ['user_id' => 'u1', 'taxon_name' => 'Parus minor'],
                ['user_id' => 'u2', 'taxon_name' => 'Parus minor'],
            ],
        ];
        $result = DataStageManager::resolveStage($obs);
        $this->assertSame('research_grade', $result);
    }

    // === 遷移テスト ===

    public function testValidTransition(): void
    {
        $obs = ['verification_stage' => 'unverified'];
        $result = DataStageManager::transition($obs, 'ai_classified', 'ai', 'test');

        $this->assertTrue($result['success']);
        $this->assertSame('ai_classified', $result['observation']['verification_stage']);
        $this->assertNotEmpty($result['observation']['stage_history']);
    }

    public function testInvalidTransitionFails(): void
    {
        $obs = ['verification_stage' => 'unverified'];
        $result = DataStageManager::transition($obs, 'research_grade', 'system', 'skip');

        $this->assertFalse($result['success']);
        $this->assertStringContainsString('遷移不可', $result['error']);
    }

    public function testSameStageTransitionIsNoop(): void
    {
        $obs = ['verification_stage' => 'ai_classified'];
        $result = DataStageManager::transition($obs, 'ai_classified', 'ai', 'retry');

        $this->assertTrue($result['success']);
        $this->assertArrayNotHasKey('stage_history', $result['observation']);
    }

    public function testTransitionAddsAuditLog(): void
    {
        $obs = ['verification_stage' => 'ai_classified'];
        $result = DataStageManager::transition($obs, 'human_verified', 'user_123', 'Manual ID');

        $history = $result['observation']['stage_history'];
        $this->assertCount(1, $history);
        $this->assertSame('ai_classified', $history[0]['from']);
        $this->assertSame('human_verified', $history[0]['to']);
        $this->assertSame('user_123', $history[0]['actor']);
    }

    public function testResearchGradeCanOnlyDemote(): void
    {
        $obs = ['verification_stage' => 'research_grade'];

        // Can demote to needs_review
        $result = DataStageManager::transition($obs, 'needs_review', 'admin', 'Dispute');
        $this->assertTrue($result['success']);

        // Cannot go to human_verified (not in allowed transitions)
        $result2 = DataStageManager::transition($obs, 'human_verified', 'admin', 'Test');
        $this->assertFalse($result2['success']);
    }

    // === AI分類適用テスト ===

    public function testApplyAiHighConfidence(): void
    {
        $obs = ['verification_stage' => 'unverified'];
        $aiResult = ['confidence' => 0.9, 'model' => 'gemini-2.0', 'taxon_name' => 'Parus minor'];

        $result = DataStageManager::applyAiClassification($obs, $aiResult);
        $this->assertTrue($result['success']);
        $this->assertSame('ai_classified', $result['observation']['verification_stage']);
    }

    public function testApplyAiLowConfidence(): void
    {
        $obs = ['verification_stage' => 'unverified'];
        $aiResult = ['confidence' => 0.3, 'model' => 'gemini-2.0', 'taxon_name' => 'Unknown'];

        $result = DataStageManager::applyAiClassification($obs, $aiResult);
        $this->assertTrue($result['success']);
        $this->assertSame('needs_review', $result['observation']['verification_stage']);
    }

    // === メタデータテスト ===

    public function testGetStageMetaReturnsValidData(): void
    {
        $meta = DataStageManager::getStageMeta('research_grade');
        $this->assertSame('研究用', $meta['label']);
        $this->assertArrayHasKey('icon', $meta);
        $this->assertArrayHasKey('color', $meta);
    }

    public function testGetStageMetaFallbackForUnknown(): void
    {
        $meta = DataStageManager::getStageMeta('nonexistent');
        $this->assertSame('未検証', $meta['label']);
    }

    public function testGetStageWeight(): void
    {
        $this->assertSame(0.0, DataStageManager::getStageWeight('unverified'));
        $this->assertSame(1.0, DataStageManager::getStageWeight('research_grade'));
    }

    // === 集計テスト ===

    public function testSummarize(): void
    {
        $observations = [
            ['verification_stage' => 'unverified'],
            ['verification_stage' => 'unverified'],
            ['verification_stage' => 'ai_classified'],
            ['verification_stage' => 'research_grade'],
        ];

        $summary = DataStageManager::summarize($observations);
        $this->assertSame(2, $summary['unverified']);
        $this->assertSame(1, $summary['ai_classified']);
        $this->assertSame(1, $summary['research_grade']);
        $this->assertSame(0, $summary['human_verified']);
    }

    // === 遷移マップの整合性テスト ===

    public function testAllStagesHaveTransitions(): void
    {
        $stages = array_keys(DataStageManager::STAGE_META);
        foreach ($stages as $stage) {
            $this->assertArrayHasKey($stage, DataStageManager::TRANSITIONS, "Missing transitions for: {$stage}");
        }
    }

    public function testAllStagesHaveMeta(): void
    {
        $stages = array_keys(DataStageManager::TRANSITIONS);
        foreach ($stages as $stage) {
            $this->assertArrayHasKey($stage, DataStageManager::STAGE_META, "Missing meta for: {$stage}");
        }
    }
}
