<?php

use PHPUnit\Framework\TestCase;

/**
 * Unit tests for DataQuality
 *
 * 品質グレード（A/B/C/D）の計算ロジックを検証。
 */
class DataQualityTest extends TestCase
{
    public function testGradeDWhenNoPhotosAndNoLocation(): void
    {
        $obs = ['photos' => [], 'lat' => null, 'lng' => null];
        $this->assertSame('D', DataQuality::calculate($obs));
    }

    public function testGradeCWhenNoPhotos(): void
    {
        $obs = ['photos' => [], 'lat' => 35.6, 'lng' => 139.7];
        $this->assertSame('C', DataQuality::calculate($obs));
    }

    public function testGradeCWhenNoLocation(): void
    {
        $obs = ['photos' => [['url' => 'photo.jpg']], 'lat' => null, 'lng' => null];
        $this->assertSame('C', DataQuality::calculate($obs));
    }

    public function testGradeBWhenPhotosAndLocationButNoId(): void
    {
        $obs = ['photos' => [['url' => 'photo.jpg']], 'lat' => 35.6, 'lng' => 139.7];
        $this->assertSame('B', DataQuality::calculate($obs));
    }

    public function testGradeAWithResearchGradeStatus(): void
    {
        $obs = [
            'photos' => [['url' => 'photo.jpg']],
            'lat' => 35.6, 'lng' => 139.7,
            'status' => '研究用',
        ];
        $this->assertSame('A', DataQuality::calculate($obs));
    }

    public function testGradeAWithTwoAgreeingIdentifications(): void
    {
        $obs = [
            'photos' => [['url' => 'photo.jpg']],
            'lat' => 35.6, 'lng' => 139.7,
            'identifications' => [
                ['user_id' => 'u1', 'taxon_name' => 'Parus minor'],
                ['user_id' => 'u2', 'taxon_name' => 'Parus minor'],
            ],
        ];
        $this->assertSame('A', DataQuality::calculate($obs));
    }

    public function testGradeBWithDisagreeingIdentifications(): void
    {
        $obs = [
            'photos' => [['url' => 'photo.jpg']],
            'lat' => 35.6, 'lng' => 139.7,
            'identifications' => [
                ['user_id' => 'u1', 'taxon_name' => 'Parus minor'],
                ['user_id' => 'u2', 'taxon_name' => 'Parus major'],
            ],
        ];
        $this->assertSame('B', DataQuality::calculate($obs));
    }

    public function testGetGradeInfoReturnsMetadata(): void
    {
        $info = DataQuality::getGradeInfo('A');
        $this->assertSame('研究利用可', $info['label']);
        $this->assertArrayHasKey('icon', $info);
        $this->assertArrayHasKey('color', $info);
    }

    public function testGetGradeInfoFallbackForInvalid(): void
    {
        $info = DataQuality::getGradeInfo('Z');
        $this->assertSame('情報不足', $info['label']); // Falls back to D
    }

    public function testGetImprovementHintsForGradeD(): void
    {
        $obs = ['photos' => [], 'lat' => null, 'lng' => null];
        $hints = DataQuality::getImprovementHints($obs);
        $this->assertCount(2, $hints); // photo + location hints
    }

    public function testGetImprovementHintsForGradeB(): void
    {
        $obs = [
            'photos' => [['url' => 'photo.jpg']],
            'lat' => 35.6, 'lng' => 139.7,
            'identifications' => [],
        ];
        $hints = DataQuality::getImprovementHints($obs);
        $this->assertNotEmpty($hints);
    }

    public function testNoHintsForGradeA(): void
    {
        $obs = [
            'photos' => [['url' => 'photo.jpg']],
            'lat' => 35.6, 'lng' => 139.7,
            'status' => '研究用',
        ];
        $hints = DataQuality::getImprovementHints($obs);
        $this->assertEmpty($hints);
    }

    public function testGradeConstantsExist(): void
    {
        $this->assertSame('A', DataQuality::GRADE_A);
        $this->assertSame('B', DataQuality::GRADE_B);
        $this->assertSame('C', DataQuality::GRADE_C);
        $this->assertSame('D', DataQuality::GRADE_D);
    }

    public function testAllGradesHaveMetadata(): void
    {
        foreach (['A', 'B', 'C', 'D'] as $grade) {
            $this->assertArrayHasKey($grade, DataQuality::GRADES);
            $this->assertArrayHasKey('label', DataQuality::GRADES[$grade]);
            $this->assertArrayHasKey('description', DataQuality::GRADES[$grade]);
        }
    }
}
