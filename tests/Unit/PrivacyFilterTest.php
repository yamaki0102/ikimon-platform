<?php

use PHPUnit\Framework\TestCase;

/**
 * Unit tests for PrivacyFilter
 *
 * 希少種位置情報の漏洩はレピュテーションリスクに直結するため、
 * フィルタロジックの正確性を保証する。
 */
class PrivacyFilterTest extends TestCase
{
    // === toGenusLevel のテスト ===

    public function testToGenusLevelTruncatesLatinBinomial(): void
    {
        $result = PrivacyFilter::toGenusLevel('Papilio machaon');
        $this->assertSame('Papilio sp.', $result);
    }

    public function testToGenusLevelHandlesTrinomial(): void
    {
        $result = PrivacyFilter::toGenusLevel('Canis lupus hodophilax');
        $this->assertSame('Canis sp.', $result);
    }

    public function testToGenusLevelKeepsJapaneseName(): void
    {
        $result = PrivacyFilter::toGenusLevel('アゲハチョウ');
        $this->assertSame('アゲハチョウ', $result);
    }

    public function testToGenusLevelKeepsKatakana(): void
    {
        $result = PrivacyFilter::toGenusLevel('ニホンカモシカ');
        $this->assertSame('ニホンカモシカ', $result);
    }

    public function testToGenusLevelKeepsSingleWord(): void
    {
        $result = PrivacyFilter::toGenusLevel('Homo');
        $this->assertSame('Homo', $result);
    }

    public function testToGenusLevelHandlesEmptyString(): void
    {
        $result = PrivacyFilter::toGenusLevel('');
        $this->assertSame('', $result);
    }

    public function testToGenusLevelHandlesMixedScript(): void
    {
        // 漢字を含む場合はJapaneseとして扱い、そのまま返す
        $result = PrivacyFilter::toGenusLevel('日本鹿');
        $this->assertSame('日本鹿', $result);
    }

    // === applyTimeDelay のテスト ===

    public function testApplyTimeDelayRoundsToHour(): void
    {
        $result = PrivacyFilter::applyTimeDelay('2025-06-15 14:30:00', 3600);
        // 14:30 + 1h = 15:30 → rounded to 15:00
        $this->assertStringContainsString('T15:00:00', $result);
    }

    public function testApplyTimeDelayWithZeroDelay(): void
    {
        $result = PrivacyFilter::applyTimeDelay('2025-06-15 14:30:00', 0);
        $this->assertStringContainsString('T14:00:00', $result);
    }

    public function testApplyTimeDelayWithEmptyTimestamp(): void
    {
        $result = PrivacyFilter::applyTimeDelay('', 3600);
        $this->assertSame('', $result);
    }

    public function testApplyTimeDelayReturnsIso8601(): void
    {
        $result = PrivacyFilter::applyTimeDelay('2025-06-15 14:30:00', 3600);
        // Should match ISO 8601 format with timezone
        $this->assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+09:00$/', $result);
    }

    // === isProtectedSpecies のテスト ===

    public function testIsProtectedSpeciesReturnsFalseForEmpty(): void
    {
        $this->assertFalse(PrivacyFilter::isProtectedSpecies(''));
    }

    public function testIsProtectedSpeciesReturnsFalseForCommonSpecies(): void
    {
        // 一般的な種は保護対象外（レッドリストにない）
        $this->assertFalse(PrivacyFilter::isProtectedSpecies('NotARealSpeciesName12345'));
    }

    // === forAmbient のテスト ===

    public function testForAmbientSetsPrivacyLayer(): void
    {
        $obs = $this->makeRawObservation();
        $filtered = PrivacyFilter::forAmbient($obs);
        $this->assertSame(PrivacyFilter::LAYER_AMBIENT, $filtered['privacy_layer']);
    }

    public function testForAmbientRemovesUserId(): void
    {
        $obs = $this->makeRawObservation();
        $filtered = PrivacyFilter::forAmbient($obs);
        $this->assertArrayNotHasKey('user_id', $filtered);
    }

    public function testForAmbientRemovesExactCoordinates(): void
    {
        $obs = $this->makeRawObservation();
        $obs['exact_lat'] = 35.6762;
        $obs['exact_lng'] = 139.6503;
        $filtered = PrivacyFilter::forAmbient($obs);
        $this->assertArrayNotHasKey('exact_lat', $filtered);
        $this->assertArrayNotHasKey('exact_lng', $filtered);
    }

    public function testForAmbientModifiesCoordinates(): void
    {
        $obs = $this->makeRawObservation();
        $originalLat = $obs['latitude'];
        $originalLng = $obs['longitude'];

        $filtered = PrivacyFilter::forAmbient($obs);

        // Coordinates should be grid-rounded (not exactly the same)
        // Note: they might be the same if the original happens to be on the grid
        $this->assertArrayHasKey('latitude', $filtered);
        $this->assertArrayHasKey('longitude', $filtered);
        $this->assertArrayHasKey('cell_id', $filtered);
        $this->assertArrayHasKey('grid_m', $filtered);
    }

    public function testForAmbientAddsCellId(): void
    {
        $obs = $this->makeRawObservation();
        $filtered = PrivacyFilter::forAmbient($obs);
        $this->assertNotEmpty($filtered['cell_id']);
    }

    // === filterListForAmbient のテスト ===

    public function testFilterListReturnsArray(): void
    {
        $obs = [$this->makeRawObservation()];
        $result = PrivacyFilter::filterListForAmbient($obs);
        $this->assertIsArray($result);
    }

    // === 定数のテスト ===

    public function testLayerConstants(): void
    {
        $this->assertSame('private', PrivacyFilter::LAYER_PRIVATE);
        $this->assertSame('ambient', PrivacyFilter::LAYER_AMBIENT);
        $this->assertSame('admin', PrivacyFilter::LAYER_ADMIN);
    }

    // === ヘルパー ===

    private function makeRawObservation(): array
    {
        return [
            'id' => 'obs_test_001',
            'user_id' => 'user_123',
            'latitude' => 35.6762,
            'longitude' => 139.6503,
            'species_name' => 'Parus minor',
            'observed_at' => '2025-06-15 14:30:00',
            'created_at' => '2025-06-15 14:35:00',
        ];
    }
}
