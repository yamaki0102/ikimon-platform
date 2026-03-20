<?php

use PHPUnit\Framework\TestCase;

/**
 * Unit tests for SubjectHelper — Multi-Subject Observation
 *
 * 1つの観察に複数の生物（サブジェクト）を持てる機能のテスト。
 * 後方互換性の維持と、subjects[] の正しい操作を検証する。
 */
class SubjectHelperTest extends TestCase
{
    // === ensureSubjects ===

    public function testEnsureSubjectsCreatesDefault(): void
    {
        $obs = [
            'photos' => ['photo1.jpg', 'photo2.jpg'],
        ];

        SubjectHelper::ensureSubjects($obs);

        $this->assertCount(1, $obs['subjects']);
        $this->assertSame('primary', $obs['subjects'][0]['id']);
        $this->assertNull($obs['subjects'][0]['label']);
        $this->assertSame([0, 1], $obs['subjects'][0]['photos']);
        $this->assertNull($obs['subjects'][0]['taxon']);
        $this->assertSame([], $obs['subjects'][0]['identifications']);
        $this->assertSame([], $obs['subjects'][0]['ai_assessments']);
    }

    public function testEnsureSubjectsPreservesExisting(): void
    {
        $existingSubjects = [
            [
                'id' => 'primary',
                'label' => null,
                'photos' => [0],
                'taxon' => ['name' => 'Parus major'],
                'identifications' => [],
                'ai_assessments' => [],
                'consensus' => null,
                'verification_stage' => 'unverified',
            ],
            [
                'id' => 'subj-abcd1234',
                'label' => 'Background bird',
                'photos' => [1],
                'taxon' => null,
                'identifications' => [],
                'ai_assessments' => [],
                'consensus' => null,
                'verification_stage' => 'unverified',
            ],
        ];

        $obs = ['subjects' => $existingSubjects];

        SubjectHelper::ensureSubjects($obs);

        $this->assertCount(2, $obs['subjects']);
        $this->assertSame('primary', $obs['subjects'][0]['id']);
        $this->assertSame('subj-abcd1234', $obs['subjects'][1]['id']);
    }

    public function testEnsureSubjectsMigratesLegacyIdentifications(): void
    {
        $obs = [
            'photos' => ['photo1.jpg'],
            'taxon' => ['name' => 'Corvus corone'],
            'identifications' => [
                ['user_id' => 'user1', 'taxon_name' => 'Corvus corone'],
                ['user_id' => 'user2', 'taxon_name' => 'Corvus corone'],
            ],
        ];

        SubjectHelper::ensureSubjects($obs);

        $this->assertCount(1, $obs['subjects']);
        $this->assertSame('primary', $obs['subjects'][0]['id']);
        // Legacy identifications (no subject_id) should go to primary
        $this->assertCount(2, $obs['subjects'][0]['identifications']);
        $this->assertSame('user1', $obs['subjects'][0]['identifications'][0]['user_id']);
        $this->assertSame('user2', $obs['subjects'][0]['identifications'][1]['user_id']);
    }

    // === findSubject ===

    public function testFindSubjectByPrimary(): void
    {
        $obs = [
            'subjects' => [
                ['id' => 'primary', 'label' => null, 'taxon' => ['name' => 'Passer montanus']],
                ['id' => 'subj-0001', 'label' => 'Flower', 'taxon' => null],
            ],
        ];

        $result = SubjectHelper::findSubject($obs, 'primary');

        $this->assertNotNull($result);
        $this->assertSame('primary', $result['id']);
        $this->assertSame('Passer montanus', $result['taxon']['name']);
    }

    public function testFindSubjectReturnsNullForMissing(): void
    {
        $obs = [
            'subjects' => [
                ['id' => 'primary', 'label' => null],
            ],
        ];

        $result = SubjectHelper::findSubject($obs, 'subj-nonexistent');

        $this->assertNull($result);
    }

    // === findSubjectIndex ===

    public function testFindSubjectIndexReturnsCorrectIndex(): void
    {
        $obs = [
            'subjects' => [
                ['id' => 'primary'],
                ['id' => 'subj-0001'],
                ['id' => 'subj-0002'],
            ],
        ];

        $this->assertSame(0, SubjectHelper::findSubjectIndex($obs, 'primary'));
        $this->assertSame(1, SubjectHelper::findSubjectIndex($obs, 'subj-0001'));
        $this->assertSame(2, SubjectHelper::findSubjectIndex($obs, 'subj-0002'));
        $this->assertSame(-1, SubjectHelper::findSubjectIndex($obs, 'subj-missing'));
    }

    // === addSubject ===

    public function testAddSubjectGeneratesId(): void
    {
        $obs = ['photos' => ['a.jpg']];

        $id = SubjectHelper::addSubject($obs);

        $this->assertStringStartsWith('subj-', $id);
        $this->assertSame(13, strlen($id)); // 'subj-' + 8 hex chars
        // ensureSubjects creates primary + addSubject adds one more
        $this->assertCount(2, $obs['subjects']);
        $this->assertSame('primary', $obs['subjects'][0]['id']);
        $this->assertSame($id, $obs['subjects'][1]['id']);
    }

    public function testAddSubjectWithLabel(): void
    {
        $obs = ['photos' => ['a.jpg', 'b.jpg']];

        $id = SubjectHelper::addSubject($obs, 'Background insect', [1]);

        $subject = SubjectHelper::findSubject($obs, $id);
        $this->assertNotNull($subject);
        $this->assertSame('Background insect', $subject['label']);
        $this->assertSame([1], $subject['photos']);
        $this->assertNull($subject['taxon']);
        $this->assertSame([], $subject['identifications']);
        $this->assertSame('unverified', $subject['verification_stage']);
    }

    // === syncPrimaryToLegacy ===

    public function testSyncPrimaryToLegacy(): void
    {
        $obs = [
            'taxon' => null,
            'consensus' => null,
            'subjects' => [
                [
                    'id' => 'primary',
                    'taxon' => ['name' => 'Hirundo rustica', 'rank' => 'species'],
                    'consensus' => ['total_votes' => 3, 'agreement_rate' => 1.0],
                    'verification_stage' => 'research_grade',
                ],
                [
                    'id' => 'subj-0001',
                    'taxon' => ['name' => 'Apis mellifera'],
                    'consensus' => ['total_votes' => 1],
                    'verification_stage' => 'ai_classified',
                ],
            ],
        ];

        SubjectHelper::syncPrimaryToLegacy($obs);

        $this->assertSame('Hirundo rustica', $obs['taxon']['name']);
        $this->assertSame(3, $obs['consensus']['total_votes']);
        // verification_stage should be the highest across all subjects
        $this->assertSame('research_grade', $obs['verification_stage']);
    }

    // === distributeIdentifications ===

    public function testDistributeIdentificationsToCorrectSubjects(): void
    {
        $obs = [
            'photos' => ['a.jpg'],
            'subjects' => [
                [
                    'id' => 'primary',
                    'label' => null,
                    'photos' => [0],
                    'taxon' => null,
                    'identifications' => [],
                    'ai_assessments' => [],
                    'consensus' => null,
                    'verification_stage' => 'unverified',
                ],
                [
                    'id' => 'subj-0001',
                    'label' => 'Bug',
                    'photos' => [0],
                    'taxon' => null,
                    'identifications' => [],
                    'ai_assessments' => [],
                    'consensus' => null,
                    'verification_stage' => 'unverified',
                ],
            ],
            'identifications' => [
                ['user_id' => 'u1', 'taxon_name' => 'Bird', 'subject_id' => 'primary'],
                ['user_id' => 'u2', 'taxon_name' => 'Beetle', 'subject_id' => 'subj-0001'],
                ['user_id' => 'u3', 'taxon_name' => 'Sparrow'],  // no subject_id -> primary
            ],
        ];

        SubjectHelper::distributeIdentifications($obs);

        $this->assertCount(2, $obs['subjects'][0]['identifications']);
        $this->assertSame('Bird', $obs['subjects'][0]['identifications'][0]['taxon_name']);
        $this->assertSame('Sparrow', $obs['subjects'][0]['identifications'][1]['taxon_name']);

        $this->assertCount(1, $obs['subjects'][1]['identifications']);
        $this->assertSame('Beetle', $obs['subjects'][1]['identifications'][0]['taxon_name']);
    }

    // === distributeAiAssessments ===

    public function testDistributeAiAssessmentsToCorrectSubjects(): void
    {
        $obs = [
            'photos' => ['a.jpg'],
            'subjects' => [
                [
                    'id' => 'primary',
                    'label' => null,
                    'photos' => [0],
                    'taxon' => null,
                    'identifications' => [],
                    'ai_assessments' => [],
                    'consensus' => null,
                    'verification_stage' => 'unverified',
                ],
                [
                    'id' => 'subj-0001',
                    'label' => 'Plant',
                    'photos' => [0],
                    'taxon' => null,
                    'identifications' => [],
                    'ai_assessments' => [],
                    'consensus' => null,
                    'verification_stage' => 'unverified',
                ],
            ],
            'ai_assessments' => [
                ['taxon_name' => 'Bird AI', 'subject_id' => 'primary'],
                ['taxon_name' => 'Plant AI', 'subject_id' => 'subj-0001'],
                ['taxon_name' => 'Unknown AI'],  // no subject_id -> primary
            ],
        ];

        SubjectHelper::distributeAiAssessments($obs);

        $this->assertCount(2, $obs['subjects'][0]['ai_assessments']);
        $this->assertCount(1, $obs['subjects'][1]['ai_assessments']);
        $this->assertSame('Plant AI', $obs['subjects'][1]['ai_assessments'][0]['taxon_name']);
    }

    // === subjectCount / isMultiSubject ===

    public function testSubjectCount(): void
    {
        $single = ['subjects' => [['id' => 'primary']]];
        $multi = ['subjects' => [['id' => 'primary'], ['id' => 'subj-0001']]];
        $empty = [];

        $this->assertSame(1, SubjectHelper::subjectCount($single));
        $this->assertSame(2, SubjectHelper::subjectCount($multi));
        $this->assertSame(0, SubjectHelper::subjectCount($empty));
    }

    public function testIsMultiSubject(): void
    {
        $single = ['subjects' => [['id' => 'primary']]];
        $multi = ['subjects' => [['id' => 'primary'], ['id' => 'subj-0001']]];

        $this->assertFalse(SubjectHelper::isMultiSubject($single));
        $this->assertTrue(SubjectHelper::isMultiSubject($multi));
    }

    // === removeSubject ===

    public function testRemoveSubjectCannotRemovePrimary(): void
    {
        $obs = [
            'subjects' => [['id' => 'primary']],
        ];

        $result = SubjectHelper::removeSubject($obs, 'primary');

        $this->assertFalse($result);
        $this->assertCount(1, $obs['subjects']);
    }

    public function testRemoveSubjectRemovesNonPrimary(): void
    {
        $obs = [
            'subjects' => [
                ['id' => 'primary'],
                ['id' => 'subj-0001'],
            ],
            'identifications' => [
                ['user_id' => 'u1', 'taxon_name' => 'Bird', 'subject_id' => 'primary'],
                ['user_id' => 'u2', 'taxon_name' => 'Bug', 'subject_id' => 'subj-0001'],
            ],
            'ai_assessments' => [
                ['taxon_name' => 'AI Bird', 'subject_id' => 'primary'],
                ['taxon_name' => 'AI Bug', 'subject_id' => 'subj-0001'],
            ],
        ];

        $result = SubjectHelper::removeSubject($obs, 'subj-0001');

        $this->assertTrue($result);
        $this->assertCount(1, $obs['subjects']);
        $this->assertSame('primary', $obs['subjects'][0]['id']);

        // Flat identifications/ai_assessments for removed subject should also be gone
        $this->assertCount(1, $obs['identifications']);
        $this->assertSame('primary', $obs['identifications'][0]['subject_id']);
        $this->assertCount(1, $obs['ai_assessments']);
        $this->assertSame('primary', $obs['ai_assessments'][0]['subject_id']);
    }

    public function testRemoveSubjectReturnsFalseForMissing(): void
    {
        $obs = [
            'subjects' => [['id' => 'primary']],
        ];

        $result = SubjectHelper::removeSubject($obs, 'subj-nonexistent');
        $this->assertFalse($result);
    }
}
