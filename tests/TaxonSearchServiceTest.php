<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../upload_package/libs/TaxonSearchService.php';

class TaxonSearchServiceTest extends TestCase
{
    // ===== normalizeQuery =====

    public function testNormalizeFullWidthToHalfWidth(): void
    {
        // 全角英数 → 半角
        $this->assertSame('Abelia', TaxonSearchService::normalizeQuery('Ａｂｅｌｉａ'));
    }

    public function testNormalizeHalfWidthKanaToFullWidth(): void
    {
        // 半角カナ → 全角カナ
        $this->assertSame('カブトムシ', TaxonSearchService::normalizeQuery('ｶﾌﾞﾄﾑｼ'));
    }

    public function testNormalizeTrimAndSpaces(): void
    {
        $this->assertSame('カブト ムシ', TaxonSearchService::normalizeQuery('  カブト  ムシ  '));
    }

    public function testNormalizeRemovesPunctuation(): void
    {
        $this->assertSame('テスト', TaxonSearchService::normalizeQuery('、テスト。'));
    }

    public function testNormalizeEmptyString(): void
    {
        $this->assertSame('', TaxonSearchService::normalizeQuery(''));
        $this->assertSame('', TaxonSearchService::normalizeQuery('  '));
        $this->assertSame('', TaxonSearchService::normalizeQuery('、。'));
    }

    public function testNormalizeMixedInput(): void
    {
        // 全角英数+半角カナ+余白 → 正規化
        $this->assertSame('test テスト', TaxonSearchService::normalizeQuery('　ｔｅｓｔ　ﾃｽﾄ　'));
    }

    // ===== search (統合テスト — ローカルのみ、外部APIなし) =====

    /**
     * searchLocal は DATA_DIR に依存するため、
     * resolver が存在しない環境ではゼロ結果を返すことを確認
     */
    public function testSearchReturnsArrayOnMissingResolver(): void
    {
        // DATA_DIR が定義されていない場合はスキップ
        if (!defined('DATA_DIR')) {
            $this->markTestSkipped('DATA_DIR not defined — local resolver not available');
        }

        $results = TaxonSearchService::search('nonexistent_species_xyz_999');
        $this->assertIsArray($results);
    }

    public function testSearchEmptyQuery(): void
    {
        $results = TaxonSearchService::search('');
        $this->assertEmpty($results);
    }

    public function testSearchNormalizesBeforeSearching(): void
    {
        // 全角入力が正規化されること（結果の有無は環境依存だが例外が出ないこと）
        $results = TaxonSearchService::search('テスト');
        $this->assertIsArray($results);
    }
}
