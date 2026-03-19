<?php

use PHPUnit\Framework\TestCase;

/**
 * Unit tests for KnowledgeAutoReviewer
 *
 * 自動承認ロジックの正確性を保証する。
 * デフォルト承認 + 異常検知アラートの動作確認。
 */
class KnowledgeAutoReviewerTest extends TestCase
{
    // === 自動承認テスト ===

    public function testNormalPaperIsAutoApproved(): void
    {
        $extracted = [
            'ecological_constraints' => [
                'habitat' => ['Forest', 'Grassland'],
                'altitude_range' => '500m - 1500m',
                'active_season' => ['Spring', 'Summer'],
                'notes' => '',
            ],
            'identification_keys' => [
                ['feature' => 'Wing color', 'description' => 'Blue tint', 'comparison_species' => ['Species B']],
            ],
        ];
        $paperMeta = ['doi' => '10.1234/test', 'source' => 'crossref', 'year' => 2020];

        $result = KnowledgeAutoReviewer::review($extracted, $paperMeta);
        $this->assertSame('auto_approved', $result['decision']);
        $this->assertGreaterThanOrEqual(0.6, $result['confidence']);
    }

    public function testTrustedSourcesAreAllAccepted(): void
    {
        $extracted = ['ecological_constraints' => ['habitat' => ['Forest']], 'identification_keys' => []];
        foreach (['crossref', 'jstage', 'cinii', 'gbif_lit'] as $source) {
            $result = KnowledgeAutoReviewer::review($extracted, ['doi' => '10.1234/x', 'source' => $source]);
            $this->assertSame('auto_approved', $result['decision'], "Source {$source} should be auto-approved");
        }
    }

    // === アラート・要レビューテスト ===

    public function testUntrustedSourceReducesConfidence(): void
    {
        $extracted = ['ecological_constraints' => ['habitat' => ['Forest']], 'identification_keys' => []];
        $result = KnowledgeAutoReviewer::review($extracted, ['doi' => '10.1234/x', 'source' => 'unknown_blog']);
        $this->assertLessThan(1.0, $result['confidence']);
        $this->assertTrue($this->hasAlertCode($result['alerts'], 'untrusted_source'));
    }

    public function testNoDoisFlagged(): void
    {
        $extracted = ['ecological_constraints' => ['habitat' => ['Forest']], 'identification_keys' => []];
        $result = KnowledgeAutoReviewer::review($extracted, ['source' => 'crossref']);
        $this->assertTrue($this->hasAlertCode($result['alerts'], 'no_doi'));
    }

    public function testOldPaperFlagged(): void
    {
        $extracted = ['ecological_constraints' => ['habitat' => ['Forest']], 'identification_keys' => []];
        $result = KnowledgeAutoReviewer::review($extracted, ['doi' => '10.1234/x', 'source' => 'crossref', 'year' => 1960]);
        $this->assertTrue($this->hasAlertCode($result['alerts'], 'old_paper'));
    }

    public function testAllEmptyTriggersWarning(): void
    {
        $extracted = [
            'ecological_constraints' => ['habitat' => [], 'altitude_range' => '', 'active_season' => [], 'notes' => ''],
            'identification_keys' => [],
        ];
        $result = KnowledgeAutoReviewer::review($extracted, ['doi' => '10.1234/x', 'source' => 'crossref']);
        $this->assertTrue($this->hasAlertCode($result['alerts'], 'all_empty'));
    }

    public function testTooManyHabitatsNeedsReview(): void
    {
        $habitats = ['Forest', 'Grassland', 'Desert', 'Wetland', 'Marine', 'Alpine', 'Urban', 'Cave', 'Coral Reef'];
        $extracted = [
            'ecological_constraints' => ['habitat' => $habitats],
            'identification_keys' => [],
        ];
        $result = KnowledgeAutoReviewer::review($extracted, ['doi' => '10.1234/x', 'source' => 'crossref']);
        $this->assertSame('needs_review', $result['decision']);
        $this->assertTrue($this->hasAlertCode($result['alerts'], 'too_many_habitats'));
    }

    public function testTooManyKeysNeedsReview(): void
    {
        $keys = array_fill(0, 12, ['feature' => 'test', 'description' => 'test', 'comparison_species' => []]);
        $extracted = [
            'ecological_constraints' => ['habitat' => ['Forest']],
            'identification_keys' => $keys,
        ];
        $result = KnowledgeAutoReviewer::review($extracted, ['doi' => '10.1234/x', 'source' => 'crossref']);
        $this->assertSame('needs_review', $result['decision']);
        $this->assertTrue($this->hasAlertCode($result['alerts'], 'too_many_keys'));
    }

    public function testInvalidAltitudeNeedsReview(): void
    {
        $extracted = [
            'ecological_constraints' => ['habitat' => ['Mountain'], 'altitude_range' => '100m - 50000m'],
            'identification_keys' => [],
        ];
        $result = KnowledgeAutoReviewer::review($extracted, ['doi' => '10.1234/x', 'source' => 'crossref']);
        $this->assertSame('needs_review', $result['decision']);
        $this->assertTrue($this->hasAlertCode($result['alerts'], 'invalid_altitude'));
    }

    public function testAiRefusalPatternNeedsReview(): void
    {
        $extracted = [
            'ecological_constraints' => ['habitat' => ["I'm sorry, I cannot extract this information"], 'altitude_range' => ''],
            'identification_keys' => [],
        ];
        $result = KnowledgeAutoReviewer::review($extracted, ['doi' => '10.1234/x', 'source' => 'crossref']);
        $this->assertSame('needs_review', $result['decision']);
        $this->assertTrue($this->hasAlertCode($result['alerts'], 'ai_refusal'));
    }

    // === 信頼度テスト ===

    public function testConfidenceIsBounded(): void
    {
        // 最悪ケース: 全アラート
        $extracted = [
            'ecological_constraints' => ['habitat' => array_fill(0, 15, 'bad'), 'altitude_range' => '0m - 99999m'],
            'identification_keys' => array_fill(0, 15, ['feature' => "I'm sorry"]),
        ];
        $result = KnowledgeAutoReviewer::review($extracted, ['source' => 'unknown', 'year' => 1950]);
        $this->assertGreaterThanOrEqual(0.0, $result['confidence']);
        $this->assertLessThanOrEqual(1.0, $result['confidence']);
    }

    public function testPerfectPaperHasHighConfidence(): void
    {
        $extracted = [
            'ecological_constraints' => ['habitat' => ['Deciduous Forest'], 'altitude_range' => '200m - 800m', 'active_season' => ['Spring']],
            'identification_keys' => [['feature' => 'Beak', 'description' => 'Short and thick']],
        ];
        $result = KnowledgeAutoReviewer::review($extracted, ['doi' => '10.1234/good', 'source' => 'crossref', 'year' => 2023]);
        $this->assertSame(1.0, $result['confidence']);
        $this->assertEmpty($result['alerts']);
    }

    // === バッチ審査テスト ===

    public function testBatchReviewProcessesPendingOnly(): void
    {
        $data = [
            'doi1' => [
                'status' => 'distilled',
                'review_status' => 'pending',
                'data' => ['ecological_constraints' => ['habitat' => ['Forest']], 'identification_keys' => []],
            ],
            'doi2' => [
                'status' => 'distilled',
                'review_status' => 'approved', // already approved
                'data' => ['ecological_constraints' => [], 'identification_keys' => []],
            ],
        ];

        $stats = KnowledgeAutoReviewer::batchReview($data, [
            'doi1' => ['doi' => 'doi1', 'source' => 'crossref'],
        ]);

        $this->assertSame(1, $stats['auto_approved']);
        $this->assertSame(1, $stats['skipped']);
        $this->assertSame('approved', $data['doi1']['review_status']);
        $this->assertSame('auto_reviewer', $data['doi1']['reviewed_by']);
    }

    // === ヘルパー ===

    private function hasAlertCode(array $alerts, string $code): bool
    {
        foreach ($alerts as $alert) {
            if ($alert['code'] === $code) return true;
        }
        return false;
    }
}
