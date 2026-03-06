<?php

use PHPUnit\Framework\TestCase;

class QuestManagerTest extends TestCase
{
    private string $obsFile;

    protected function setUp(): void
    {
        $this->obsFile = DATA_DIR . '/observations.json';
        if (file_exists($this->obsFile)) {
            unlink($this->obsFile);
        }
    }

    protected function tearDown(): void
    {
        if (file_exists($this->obsFile)) {
            unlink($this->obsFile);
        }
    }

    public function testGetDefinitionsReturnsArray(): void
    {
        $defs = QuestManager::getDefinitions();
        $this->assertIsArray($defs);
        $this->assertNotEmpty($defs);
    }

    public function testGetActiveQuestsReturnsThree(): void
    {
        $quests = QuestManager::getActiveQuests('user_a');
        $this->assertCount(3, $quests);
    }

    public function testDeterministicSelection(): void
    {
        $q1 = QuestManager::getActiveQuests('user_b');
        $q2 = QuestManager::getActiveQuests('user_b');
        $this->assertSame(
            array_column($q1, 'id'),
            array_column($q2, 'id')
        );
    }

    public function testCheckProgressReturnsPercentage(): void
    {
        $today = date('Y-m-d');
        $data = [
            ['id' => 'o1', 'user_id' => 'u1', 'created_at' => $today . ' 10:00:00'],
            ['id' => 'o2', 'user_id' => 'u1', 'created_at' => $today . ' 11:00:00'],
            ['id' => 'o3', 'user_id' => 'u1', 'created_at' => $today . ' 12:00:00'],
        ];
        DataStore::save('observations', $data);

        $percent = QuestManager::checkProgress('u1', 'q_photos_3');
        $this->assertSame(100, $percent);
    }
}
