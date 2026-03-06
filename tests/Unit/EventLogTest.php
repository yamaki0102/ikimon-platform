<?php

use PHPUnit\Framework\TestCase;

class EventLogTest extends TestCase
{
    private string $userId = 'test_user';
    private string $filePath;

    protected function setUp(): void
    {
        $this->filePath = DATA_DIR . '/user_events/' . $this->userId . '.json';
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

    public function testLogAndGetRecent(): void
    {
        EventLog::log($this->userId, 'a', ['n' => 1]);
        EventLog::log($this->userId, 'b', ['n' => 2]);
        EventLog::log($this->userId, 'c', ['n' => 3]);

        $recent = EventLog::getRecent($this->userId, 2);
        $this->assertCount(2, $recent);
        $this->assertSame('c', $recent[0]['type'] ?? null);
        $this->assertSame('b', $recent[1]['type'] ?? null);
    }

    public function testGetByType(): void
    {
        EventLog::log($this->userId, 'badge_earned');
        EventLog::log($this->userId, 'rank_up');
        EventLog::log($this->userId, 'badge_earned');

        $badges = EventLog::getByType($this->userId, 'badge_earned');
        $this->assertCount(2, $badges);
    }

    public function testMaxEntriesEnforced(): void
    {
        for ($i = 0; $i < 210; $i++) {
            EventLog::log($this->userId, 'evt', ['i' => $i]);
        }

        $entries = json_decode(file_get_contents($this->filePath), true) ?: [];
        $this->assertLessThanOrEqual(200, count($entries));
    }
}
