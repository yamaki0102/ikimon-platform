<?php

use PHPUnit\Framework\TestCase;

class HabitEngineTest extends TestCase
{
    private string $userId = 'habit_test_user';
    private string $reflectionFile;
    private string $streakFile;

    protected function setUp(): void
    {
        $this->reflectionFile = DATA_DIR . '/habit_reflections/' . $this->userId . '.json';
        $this->streakFile = DATA_DIR . '/streaks/' . $this->userId . '.json';

        if (file_exists($this->reflectionFile)) {
            unlink($this->reflectionFile);
        }
        if (file_exists($this->streakFile)) {
            unlink($this->streakFile);
        }
    }

    protected function tearDown(): void
    {
        if (file_exists($this->reflectionFile)) {
            unlink($this->reflectionFile);
        }
        if (file_exists($this->streakFile)) {
            unlink($this->streakFile);
        }
    }

    public function testRecordReflectionCreatesHabitCompletion(): void
    {
        HabitEngine::recordReflection($this->userId, '雨のあとに鳥の声が増えていた', ['source' => 'dashboard']);

        $state = HabitEngine::getTodayState($this->userId);

        $this->assertTrue($state['today_complete']);
        $this->assertSame(['reflection'], $state['today_types']);
        $this->assertSame('雨のあとに鳥の声が増えていた', $state['reflection_note']);
        $this->assertSame('雨のあとに鳥の声が増えていた', $state['latest_reflection']['note']);
        $this->assertSame('dashboard', $state['latest_reflection']['source']);
    }

    public function testEmptyReflectionIsRejected(): void
    {
        $this->expectException(InvalidArgumentException::class);

        HabitEngine::recordReflection($this->userId, '   ');
    }
}
