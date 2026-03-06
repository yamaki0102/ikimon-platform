<?php

use PHPUnit\Framework\TestCase;

class DataStoreTest extends TestCase
{
    private string $testFile = 'datastore_test';

    protected function setUp(): void
    {
        DataStore::setPath(DATA_DIR);
    }

    protected function tearDown(): void
    {
        $path = DATA_DIR . '/' . $this->testFile . '.json';
        if (file_exists($path)) {
            unlink($path);
        }
    }

    public function testSaveAndGet(): void
    {
        $data = [
            ['id' => 'a1', 'name' => 'alpha'],
            ['id' => 'b2', 'name' => 'beta'],
        ];

        $bytes = DataStore::save($this->testFile, $data);
        $this->assertIsInt($bytes);
        $this->assertGreaterThan(0, $bytes);

        $loaded = DataStore::get($this->testFile);
        $this->assertSame($data, $loaded);
    }

    public function testFetchAllReturnsMergedData(): void
    {
        $data = [
            ['id' => 'c3', 'name' => 'gamma'],
        ];
        DataStore::save($this->testFile, $data);

        $all = DataStore::fetchAll($this->testFile);
        $this->assertIsArray($all);
        $this->assertCount(1, $all);
        $this->assertSame('c3', $all[0]['id'] ?? null);
    }
}
