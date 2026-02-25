<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;

// Bootstrap: config defines DATA_DIR etc.
require_once __DIR__ . '/../upload_package/libs/TaxonData.php';

class TaxonDataTest extends TestCase
{
    // ===== fromResolver =====

    public function testFromResolverBasic(): void
    {
        $data = [
            'slug' => 'papilio-xuthus',
            'accepted_name' => 'Papilio xuthus',
            'gbif_key' => 1936018,
            'ja_name' => 'アゲハチョウ',
        ];

        $td = TaxonData::fromResolver($data);

        $this->assertSame('papilio-xuthus', $td->slug);
        $this->assertSame('Papilio xuthus', $td->scientificName);
        $this->assertSame('species', $td->rank);
        $this->assertSame(1936018, $td->gbifKey);
        $this->assertSame('local', $td->source);
        $this->assertSame(1.0, $td->confidence);
        $this->assertSame('アゲハチョウ', $td->commonNames['ja']);
    }

    public function testFromResolverMinimalData(): void
    {
        $td = TaxonData::fromResolver([
            'slug' => 'unknown-sp',
            'accepted_name' => 'Unknown sp.',
        ]);

        $this->assertSame('unknown-sp', $td->slug);
        $this->assertNull($td->gbifKey);
        $this->assertEmpty($td->commonNames);
    }

    // ===== fromINat =====

    public function testFromINatFull(): void
    {
        $apiResult = [
            'id' => 47219,
            'name' => 'Papilio xuthus',
            'rank' => 'species',
            'preferred_common_name' => 'アゲハチョウ',
            'english_common_name' => 'Asian Swallowtail',
            'default_photo' => [
                'square_url' => 'https://inaturalist.org/photos/12345/square.jpg',
            ],
            'ancestors' => [
                ['rank' => 'kingdom', 'name' => 'Animalia'],
                ['rank' => 'phylum', 'name' => 'Arthropoda'],
                ['rank' => 'class', 'name' => 'Insecta'],
                ['rank' => 'order', 'name' => 'Lepidoptera'],
                ['rank' => 'family', 'name' => 'Papilionidae'],
                ['rank' => 'genus', 'name' => 'Papilio'],
            ],
        ];

        $td = TaxonData::fromINat($apiResult);

        $this->assertSame('Papilio xuthus', $td->scientificName);
        $this->assertSame('papilio-xuthus', $td->slug);
        $this->assertSame(47219, $td->inatTaxonId);
        $this->assertSame('inat', $td->source);
        $this->assertSame(0.9, $td->confidence);
        $this->assertSame('アゲハチョウ', $td->commonNames['ja']);
        $this->assertSame('Asian Swallowtail', $td->commonNames['en']);
        $this->assertSame('https://inaturalist.org/photos/12345/square.jpg', $td->thumbnailUrl);
        $this->assertSame('Animalia', $td->lineage['kingdom']);
        $this->assertSame('Lepidoptera', $td->lineage['order']);
    }

    public function testFromINatMinimal(): void
    {
        $td = TaxonData::fromINat([
            'id' => 999,
            'name' => 'Homo sapiens',
            'rank' => 'species',
        ]);

        $this->assertSame('Homo sapiens', $td->scientificName);
        $this->assertSame(999, $td->inatTaxonId);
        $this->assertNull($td->thumbnailUrl);
        $this->assertNull($td->lineage);
    }

    // ===== fromGBIF =====

    public function testFromGBIF(): void
    {
        $apiResult = [
            'key' => 5231190,
            'canonicalName' => 'Papilio xuthus',
            'scientificName' => 'Papilio xuthus Linnaeus, 1767',
            'rank' => 'SPECIES',
            'kingdom' => 'Animalia',
            'phylum' => 'Arthropoda',
            'class' => 'Insecta',
            'order' => 'Lepidoptera',
            'family' => 'Papilionidae',
            'genus' => 'Papilio',
        ];

        $td = TaxonData::fromGBIF($apiResult);

        $this->assertSame('Papilio xuthus', $td->scientificName);
        $this->assertSame(5231190, $td->gbifKey);
        $this->assertSame('species', $td->rank);
        $this->assertSame('gbif', $td->source);
        $this->assertSame(0.8, $td->confidence);
        $this->assertSame('Animalia', $td->lineage['kingdom']);
    }

    // ===== toArray / toObservationTaxon =====

    public function testToArrayPreservesAllFields(): void
    {
        $td = TaxonData::fromResolver([
            'slug' => 'test-slug',
            'accepted_name' => 'Test species',
            'gbif_key' => 123,
            'ja_name' => 'テスト',
        ]);

        $arr = $td->toArray();

        $this->assertArrayHasKey('slug', $arr);
        $this->assertArrayHasKey('scientific_name', $arr);
        $this->assertArrayHasKey('rank', $arr);
        $this->assertArrayHasKey('common_names', $arr);
        $this->assertArrayHasKey('lineage', $arr);
        $this->assertArrayHasKey('gbif_key', $arr);
        $this->assertArrayHasKey('inat_taxon_id', $arr);
        $this->assertArrayHasKey('thumbnail_url', $arr);
        $this->assertArrayHasKey('source', $arr);
        $this->assertArrayHasKey('confidence', $arr);
    }

    public function testToObservationTaxonBackwardCompatible(): void
    {
        $td = TaxonData::fromResolver([
            'slug' => 'test-slug',
            'accepted_name' => 'Test species',
            'gbif_key' => 123,
            'ja_name' => 'テスト種',
        ]);

        $obs = $td->toObservationTaxon();

        // 旧4フィールドが存在
        $this->assertArrayHasKey('id', $obs);
        $this->assertArrayHasKey('name', $obs);
        $this->assertArrayHasKey('scientific_name', $obs);
        $this->assertArrayHasKey('slug', $obs);

        // 新フィールドも存在
        $this->assertArrayHasKey('rank', $obs);
        $this->assertArrayHasKey('inat_taxon_id', $obs);
        $this->assertArrayHasKey('source', $obs);

        // name は和名優先
        $this->assertSame('テスト種', $obs['name']);
    }

    public function testToSearchResultFormat(): void
    {
        $td = TaxonData::fromINat([
            'id' => 100,
            'name' => 'Quercus crispula',
            'rank' => 'species',
            'preferred_common_name' => 'ミズナラ',
        ]);

        $sr = $td->toSearchResult();

        $this->assertSame('quercus-crispula', $sr['slug']);
        $this->assertSame('Quercus crispula', $sr['scientific_name']);
        $this->assertSame('ミズナラ', $sr['ja_name']);
        $this->assertSame('inat', $sr['source']);
        $this->assertSame(100, $sr['inat_taxon_id']);
    }
}
