<?php

use PHPUnit\Framework\TestCase;

/**
 * Unit tests for LiteratureIngestionPipeline
 *
 * 論文取り込みパイプラインの基本ロジックを検証。
 * ネットワーク接続不要のユニットテスト。
 */
class LiteratureIngestionPipelineTest extends TestCase
{
    public function testConstructorCreatesInstance(): void
    {
        $pipeline = new LiteratureIngestionPipeline('test@example.com');
        $this->assertInstanceOf(LiteratureIngestionPipeline::class, $pipeline);
    }

    public function testGetStatsReturnsEmptyInitially(): void
    {
        $pipeline = new LiteratureIngestionPipeline();
        $stats = $pipeline->getStats();

        $this->assertSame(0, $stats['new']);
        $this->assertSame(0, $stats['duplicate']);
        $this->assertSame(0, $stats['total_fetched']);
        $this->assertEmpty($stats['errors']);
    }

    public function testStatsHasRequiredKeys(): void
    {
        $pipeline = new LiteratureIngestionPipeline();
        $stats = $pipeline->getStats();

        $this->assertArrayHasKey('new', $stats);
        $this->assertArrayHasKey('duplicate', $stats);
        $this->assertArrayHasKey('total_fetched', $stats);
        $this->assertArrayHasKey('after_dedup', $stats);
        $this->assertArrayHasKey('errors', $stats);
        $this->assertArrayHasKey('sources', $stats);
    }
}
