<?php

use PHPUnit\Framework\TestCase;

class QuestManagerTest extends TestCase
{
    private string $obsFile;
    private string $tracksDir;

    protected function setUp(): void
    {
        $this->obsFile = DATA_DIR . '/observations.json';
        $this->tracksDir = DATA_DIR . '/tracks';
        if (file_exists($this->obsFile)) {
            unlink($this->obsFile);
        }
        if (is_dir($this->tracksDir)) {
            $this->removeDir($this->tracksDir);
        }
    }

    protected function tearDown(): void
    {
        if (file_exists($this->obsFile)) {
            unlink($this->obsFile);
        }
        if (is_dir($this->tracksDir)) {
            $this->removeDir($this->tracksDir);
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

    public function testWalkQuestIsAlwaysIncluded(): void
    {
        $quests = QuestManager::getActiveQuests('user_walk');

        $this->assertContains('q_walk_light', array_column($quests, 'id'));
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

    public function testWalkQuestProgressUsesTodayTracks(): void
    {
        $userDir = $this->tracksDir . '/u_walk';
        mkdir($userDir, 0777, true);

        file_put_contents($userDir . '/trk_today.json', json_encode([
            'session_id' => 'trk_today',
            'user_id' => 'u_walk',
            'started_at' => date('Y-m-d') . 'T09:00:00+09:00',
            'updated_at' => date('c'),
            'point_count' => 16,
            'total_distance_m' => 420,
            'points' => [],
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);

        $percent = QuestManager::checkProgress('u_walk', 'q_walk_light');
        $this->assertSame(100, $percent);
    }

    private function removeDir(string $dir): void
    {
        $items = scandir($dir);
        if ($items === false) {
            return;
        }

        foreach ($items as $item) {
            if ($item === '.' || $item === '..') {
                continue;
            }

            $path = $dir . '/' . $item;
            if (is_dir($path)) {
                $this->removeDir($path);
            } elseif (file_exists($path)) {
                unlink($path);
            }
        }

        rmdir($dir);
    }
}
