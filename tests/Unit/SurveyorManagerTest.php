<?php

use PHPUnit\Framework\TestCase;

class SurveyorManagerTest extends TestCase
{
    protected function setUp(): void
    {
        DataStore::setPath(DATA_DIR);
        DataStore::save('users', [
            [
                'id' => 'user_surveyor_1',
                'name' => '調査員A',
                'avatar' => 'avatar-a.png',
                'bio' => '湿地帯の調査が得意です',
                'surveyor_status' => 'approved',
                'surveyor_profile' => [
                    'headline' => '湿地・両生類調査',
                    'summary' => '要約',
                    'areas' => ['浜松市', '磐田市'],
                    'specialties' => ['両生類', '夜間調査'],
                    'price_band' => '案件規模で見積もり',
                    'available_days' => ['土曜', '日曜'],
                    'travel_range' => '県内広域',
                    'contact_label' => 'メールで連絡',
                    'contact_url' => 'mailto:test@example.com',
                    'public_visible' => true,
                ],
            ],
            [
                'id' => 'user_pending_1',
                'name' => '申請中',
                'surveyor_status' => 'pending',
            ],
        ]);

        DataStore::save('observations/2026-03', [
            [
                'id' => 'obs_1',
                'user_id' => 'user_surveyor_1',
                'record_mode' => 'surveyor_official',
                'taxon' => ['name' => 'トノサマガエル'],
            ],
            [
                'id' => 'obs_2',
                'user_id' => 'user_surveyor_1',
                'record_mode' => 'standard',
                'taxon' => ['name' => 'アマガエル'],
            ],
        ]);
    }

    protected function tearDown(): void
    {
        foreach (['users.json', 'observations/2026-03.json'] as $file) {
            $path = DATA_DIR . '/' . $file;
            if (file_exists($path)) {
                unlink($path);
            }
        }
        $obsDir = DATA_DIR . '/observations';
        if (is_dir($obsDir)) {
            @rmdir($obsDir);
        }
    }

    public function testListPublicSurveyorsReturnsApprovedOnly(): void
    {
        $surveyors = SurveyorManager::listPublicSurveyors();
        $this->assertCount(1, $surveyors);
        $this->assertSame('user_surveyor_1', $surveyors[0]['id']);
        $this->assertSame(1, $surveyors[0]['official_record_count']);
        $this->assertSame(2, $surveyors[0]['observation_count']);
    }

    public function testNormalizeProfileInputTrimsAndPrefixesUrl(): void
    {
        $profile = SurveyorManager::normalizeProfileInput([
            'headline' => '  里山調査  ',
            'areas' => "浜松市, 磐田市\n浜松市",
            'specialties' => '鳥類、植物',
            'price_band' => '半日相当',
            'available_days' => '平日、土曜',
            'travel_range' => '隣県まで',
            'contact_url' => 'example.com/contact',
            'public_visible' => true,
        ]);

        $this->assertSame('里山調査', $profile['headline']);
        $this->assertSame(['浜松市', '磐田市'], $profile['areas']);
        $this->assertSame(['鳥類', '植物'], $profile['specialties']);
        $this->assertSame('半日相当', $profile['price_band']);
        $this->assertSame(['平日', '土曜'], $profile['available_days']);
        $this->assertSame('隣県まで', $profile['travel_range']);
        $this->assertSame('https://example.com/contact', $profile['contact_url']);
        $this->assertTrue($profile['public_visible']);
    }

    public function testMatchSurveyorsFindsByAreaAndSpecialty(): void
    {
        $matches = SurveyorManager::matchSurveyors([
            'area' => '浜松',
            'specialty' => '両生類',
            'preferred_days' => ['土曜'],
            'travel_condition' => '市内中心',
            'budget_stance' => '案件規模で見積もり',
        ]);

        $this->assertNotEmpty($matches);
        $this->assertSame('user_surveyor_1', $matches[0]['id']);
        $this->assertGreaterThan(0, $matches[0]['match_score']);
        $this->assertContains('希望曜日と対応可能曜日が重なる', $matches[0]['match_reasons']);
        $this->assertContains('移動可能範囲が依頼条件を満たす', $matches[0]['match_reasons']);
        $this->assertContains('予算スタンスと対応単価帯が一致している', $matches[0]['match_reasons']);
    }
}
