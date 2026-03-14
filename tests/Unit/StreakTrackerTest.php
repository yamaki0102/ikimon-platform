<?php

use PHPUnit\Framework\TestCase;

class StreakTrackerTest extends TestCase
{
    private string $userId = 'test_user';
    private string $filePath;

    protected function setUp(): void
    {
        $this->filePath = DATA_DIR . '/streaks/' . $this->userId . '.json';
        if (file_exists($this->filePath)) {
            unlink($this->filePath);
        }
    }

    protected function tearDown(): void
    {
        if (file_exists($this->filePath)) {
            unlink($this->filePath);
        }
    }

    public function testConsecutiveDays(): void
    {
        StreakTracker::recordActivity($this->userId, '2026-03-01');
        StreakTracker::recordActivity($this->userId, '2026-03-02');
        $data = StreakTracker::recordActivity($this->userId, '2026-03-03');

        $this->assertSame(3, $data['current_streak']);
    }

    public function testStreakReset(): void
    {
        StreakTracker::recordActivity($this->userId, '2026-03-01');
        $data = StreakTracker::recordActivity($this->userId, '2026-03-03');

        $this->assertSame(1, $data['current_streak']);
    }

    public function testSameDayIdempotent(): void
    {
        $data1 = StreakTracker::recordActivity($this->userId, '2026-03-01');
        $data2 = StreakTracker::recordActivity($this->userId, '2026-03-01');

        $this->assertSame($data1['current_streak'], $data2['current_streak']);
    }

    public function testLongestStreakPreserved(): void
    {
        StreakTracker::recordActivity($this->userId, '2026-03-01');
        StreakTracker::recordActivity($this->userId, '2026-03-02');
        StreakTracker::recordActivity($this->userId, '2026-03-03');
        $data = StreakTracker::recordActivity($this->userId, '2026-03-06');

        $this->assertSame(3, $data['longest_streak']);
        $this->assertSame(1, $data['current_streak']);
    }

    public function testMultipleActivityTypesMergeOnSameDay(): void
    {
        StreakTracker::recordActivity($this->userId, 'post', '2026-03-01');
        StreakTracker::recordActivity($this->userId, 'identification', '2026-03-01', [
            'observation_id' => 'obs_123',
        ]);

        $summary = StreakTracker::getActivitySummary($this->userId, '2026-03-01');

        $this->assertSame(['post', 'identification'], $summary['types']);
        $this->assertSame('obs_123', $summary['context']['identification']['observation_id']);
    }

    public function testLegacyDateSignatureStillWorks(): void
    {
        StreakTracker::recordActivity($this->userId, '2026-03-01');

        $summary = StreakTracker::getActivitySummary($this->userId, '2026-03-01');

        $this->assertSame(['post'], $summary['types']);
    }
}
