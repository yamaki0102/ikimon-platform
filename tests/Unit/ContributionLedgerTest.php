<?php

use PHPUnit\Framework\TestCase;

/**
 * ContributionLedger の統合テスト
 *
 * passive_event.php → ContributionLedger の接続を検証する。
 * 特に「検出0件セッション」でも session_contributions に記録されることを確認。
 */
class ContributionLedgerTest extends TestCase
{
    private string $sessionId = 'test_session_ledger_001';
    private string $userId = 'user_test_001';

    protected function setUp(): void
    {
        // テスト用の SQLite と DataStore fixtures をクリーン
        $dbPath = DATA_DIR . '/ikimon.db';
        if (file_exists($dbPath)) {
            unlink($dbPath);
        }
        $this->cleanFixture('passive_sessions');
        $this->cleanFixture('observations');
        $this->cleanFixture('environment_logs');
    }

    protected function tearDown(): void
    {
        // 静的PDO接続を切断してからファイルを削除
        $ref = new ReflectionClass(ContributionLedger::class);
        $pdoProp = $ref->getProperty('pdo');
        $pdoProp->setValue(null, null);
        $schemaProp = $ref->getProperty('schemaReady');
        $schemaProp->setValue(null, false);

        $dbPath = DATA_DIR . '/ikimon.db';
        if (file_exists($dbPath)) {
            unlink($dbPath);
        }
        $this->cleanFixture('passive_sessions');
        $this->cleanFixture('observations');
        $this->cleanFixture('environment_logs');
    }

    // ─── テストケース ─────────────────────────────────────────────────────

    /**
     * 基本ケース: セッションログがあれば contribution が返る
     */
    public function testRecordSessionContributionReturnsResult(): void
    {
        $this->seedPassiveSession([
            'session_id' => $this->sessionId,
            'user_id'    => $this->userId,
            'session_meta' => [
                'duration_sec'  => 1800,
                'distance_m'    => 1200,
                'movement_mode' => 'walk',
                'official_record' => true,
            ],
            'started_at' => date('c'),
            'ended_at'   => date('c'),
        ]);

        $result = ContributionLedger::recordSessionContribution($this->sessionId);

        $this->assertNotNull($result, 'contribution result は null であってはならない');
        $this->assertArrayHasKey('summary', $result);
        $this->assertArrayHasKey('headline', $result['summary']);
        $this->assertArrayHasKey('data_collected', $result['summary']);
        $this->assertArrayHasKey('contribution_impact', $result['summary']);
    }

    /**
     * 最重要: 検出0件セッションでも session_contributions に記録される
     */
    public function testZeroDetectionSessionIsRecorded(): void
    {
        $this->seedPassiveSession([
            'session_id' => $this->sessionId,
            'user_id'    => $this->userId,
            'session_meta' => [
                'duration_sec'  => 2100,
                'distance_m'    => 1800,
                'movement_mode' => 'walk',
                'official_record' => true,
            ],
            'summary' => ['by_type' => ['audio' => 0, 'visual' => 0]],
            'started_at' => date('c'),
            'ended_at'   => date('c'),
        ]);
        // observations は意図的に追加しない（0件）

        $result = ContributionLedger::recordSessionContribution($this->sessionId);

        $this->assertNotNull($result, '検出0件でも contribution は記録されるべき');
        $this->assertSame($this->sessionId, $result['session_id']);

        $headline = $result['summary']['headline'] ?? [];
        $this->assertGreaterThan(0, $headline['active_minutes'] ?? 0, '時間は 0 より大きいはず');
    }

    /**
     * effort_quality_score が計算される
     */
    public function testEffortQualityScoreIsCalculated(): void
    {
        $this->seedPassiveSession([
            'session_id' => $this->sessionId,
            'user_id'    => $this->userId,
            'session_meta' => [
                'duration_sec'  => 3600,
                'distance_m'    => 3000,
                'movement_mode' => 'walk',
                'official_record' => true,
            ],
            'started_at' => date('c'),
            'ended_at'   => date('c'),
        ]);

        $result = ContributionLedger::recordSessionContribution($this->sessionId);

        $scores = $result['summary']['scores'] ?? [];
        $this->assertGreaterThan(0, $scores['effort_quality_score'] ?? 0, 'effort_quality_score は 0 より大きいはず');
    }

    /**
     * test セッション（official_record=false）は coverage_slots に書かれない
     */
    public function testTestSessionDoesNotPolluteCoverageSlots(): void
    {
        $this->seedPassiveSession([
            'session_id' => $this->sessionId,
            'user_id'    => $this->userId,
            'session_meta' => [
                'duration_sec'    => 1800,
                'distance_m'      => 1000,
                'movement_mode'   => 'walk',
                'official_record' => false,
                'session_intent'  => 'test',
            ],
            'started_at' => date('c'),
            'ended_at'   => date('c'),
        ]);

        ContributionLedger::recordSessionContribution($this->sessionId);

        $snapshot = ContributionLedger::getCommunitySnapshot();
        $this->assertSame(0, $snapshot['total_sessions'], 'test セッションは total_sessions に含まれない');
    }

    /**
     * 存在しないセッションIDは null を返す
     */
    public function testNonExistentSessionReturnsNull(): void
    {
        $result = ContributionLedger::recordSessionContribution('non_existent_session_id');
        $this->assertNull($result);
    }

    // ─── ヘルパー ─────────────────────────────────────────────────────────

    private function seedPassiveSession(array $override = []): void
    {
        $base = [
            'id'         => 'ps_' . bin2hex(random_bytes(4)),
            'session_id' => $this->sessionId,
            'user_id'    => $this->userId,
            'scan_mode'  => 'walk',
            'events_received' => 0,
            'events_valid'    => 0,
            'observations_created' => 0,
            'summary' => ['species' => [], 'by_type' => []],
            'session_meta' => [],
            'is_incremental' => false,
            'is_final'       => true,
            'batch_index'    => 0,
            'started_at'     => date('c'),
            'ended_at'       => date('c'),
            'created_at'     => date('c'),
        ];
        DataStore::append('passive_sessions', array_merge($base, $override));
    }

    private function cleanFixture(string $store): void
    {
        $dir = DATA_DIR . '/' . $store;
        if (!is_dir($dir)) {
            return;
        }
        foreach (glob($dir . '/*.json') as $file) {
            unlink($file);
        }
    }
}
