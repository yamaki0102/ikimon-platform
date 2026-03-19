<?php

use PHPUnit\Framework\TestCase;

/**
 * Unit tests for BioUtils::updateConsensus with multi-subject observations.
 *
 * 複数サブジェクト観察でのコンセンサス計算が、各サブジェクト独立で
 * 正しく動作し、レガシーフィールドとの後方互換も維持されることを検証する。
 */
class MultiSubjectConsensusTest extends TestCase
{
    /**
     * Helper: build a verifiable observation base with required fields.
     */
    private function makeVerifiableObs(array $overrides = []): array
    {
        return array_merge([
            'user_id'     => 'owner1',
            'observed_at' => '2026-03-01T10:00:00+09:00',
            'lat'         => 35.6762,
            'lng'         => 139.6503,
            'photos'      => ['photo1.jpg'],
        ], $overrides);
    }

    public function testSingleSubjectConsensusUnchanged(): void
    {
        $obs = $this->makeVerifiableObs([
            'identifications' => [
                [
                    'user_id'         => 'owner1',
                    'taxon_name'      => 'Passer montanus',
                    'taxon_key'       => 'passer-montanus',
                    'scientific_name' => 'Passer montanus',
                    'taxon_rank'      => 'species',
                ],
                [
                    'user_id'         => 'expert1',
                    'taxon_name'      => 'Passer montanus',
                    'taxon_key'       => 'passer-montanus',
                    'scientific_name' => 'Passer montanus',
                    'taxon_rank'      => 'species',
                ],
            ],
        ]);

        $status = BioUtils::updateConsensus($obs);

        // Should have subjects array created
        $this->assertNotEmpty($obs['subjects']);
        $this->assertSame('primary', $obs['subjects'][0]['id']);

        // Taxon should be set on both subject and legacy field
        $this->assertSame('Passer montanus', $obs['subjects'][0]['taxon']['name']);
        $this->assertSame('Passer montanus', $obs['taxon']['name']);

        // Status should be meaningful (not empty)
        $this->assertNotEmpty($status);
    }

    public function testMultiSubjectIndependentConsensus(): void
    {
        $obs = $this->makeVerifiableObs([
            'subjects' => [
                [
                    'id'                 => 'primary',
                    'label'              => null,
                    'photos'             => [0],
                    'taxon'              => null,
                    'identifications'    => [],
                    'ai_assessments'     => [],
                    'consensus'          => null,
                    'verification_stage' => 'unverified',
                ],
                [
                    'id'                 => 'subj-0001',
                    'label'              => 'Background insect',
                    'photos'             => [0],
                    'taxon'              => null,
                    'identifications'    => [],
                    'ai_assessments'     => [],
                    'consensus'          => null,
                    'verification_stage' => 'unverified',
                ],
            ],
            'identifications' => [
                [
                    'user_id'         => 'owner1',
                    'taxon_name'      => 'Parus major',
                    'taxon_key'       => 'parus-major',
                    'scientific_name' => 'Parus major',
                    'taxon_rank'      => 'species',
                    'subject_id'      => 'primary',
                ],
                [
                    'user_id'         => 'owner1',
                    'taxon_name'      => 'Papilio machaon',
                    'taxon_key'       => 'papilio-machaon',
                    'scientific_name' => 'Papilio machaon',
                    'taxon_rank'      => 'species',
                    'subject_id'      => 'subj-0001',
                ],
            ],
        ]);

        BioUtils::updateConsensus($obs);

        // Each subject should have its own taxon
        $this->assertSame('Parus major', $obs['subjects'][0]['taxon']['name']);
        $this->assertSame('Papilio machaon', $obs['subjects'][1]['taxon']['name']);

        // They should be independent
        $this->assertNotSame(
            $obs['subjects'][0]['taxon']['name'],
            $obs['subjects'][1]['taxon']['name']
        );
    }

    public function testSameUserDifferentSubjects(): void
    {
        $obs = $this->makeVerifiableObs([
            'subjects' => [
                [
                    'id'                 => 'primary',
                    'label'              => null,
                    'photos'             => [0],
                    'taxon'              => null,
                    'identifications'    => [],
                    'ai_assessments'     => [],
                    'consensus'          => null,
                    'verification_stage' => 'unverified',
                ],
                [
                    'id'                 => 'subj-0001',
                    'label'              => 'Flower',
                    'photos'             => [0],
                    'taxon'              => null,
                    'identifications'    => [],
                    'ai_assessments'     => [],
                    'consensus'          => null,
                    'verification_stage' => 'unverified',
                ],
            ],
            'identifications' => [
                [
                    'user_id'         => 'user-same',
                    'taxon_name'      => 'Motacilla alba',
                    'taxon_key'       => 'motacilla-alba',
                    'scientific_name' => 'Motacilla alba',
                    'taxon_rank'      => 'species',
                    'subject_id'      => 'primary',
                ],
                [
                    'user_id'         => 'user-same',
                    'taxon_name'      => 'Rosa rugosa',
                    'taxon_key'       => 'rosa-rugosa',
                    'scientific_name' => 'Rosa rugosa',
                    'taxon_rank'      => 'species',
                    'subject_id'      => 'subj-0001',
                ],
            ],
        ]);

        BioUtils::updateConsensus($obs);

        // Same user can identify different subjects independently
        $this->assertSame('Motacilla alba', $obs['subjects'][0]['taxon']['name']);
        $this->assertSame('Rosa rugosa', $obs['subjects'][1]['taxon']['name']);
    }

    public function testEmptySubjectGetsNullTaxon(): void
    {
        $obs = $this->makeVerifiableObs([
            'subjects' => [
                [
                    'id'                 => 'primary',
                    'label'              => null,
                    'photos'             => [0],
                    'taxon'              => null,
                    'identifications'    => [],
                    'ai_assessments'     => [],
                    'consensus'          => null,
                    'verification_stage' => 'unverified',
                ],
                [
                    'id'                 => 'subj-empty',
                    'label'              => 'Unknown thing',
                    'photos'             => [0],
                    'taxon'              => null,
                    'identifications'    => [],
                    'ai_assessments'     => [],
                    'consensus'          => null,
                    'verification_stage' => 'unverified',
                ],
            ],
            'identifications' => [
                [
                    'user_id'         => 'owner1',
                    'taxon_name'      => 'Corvus corone',
                    'taxon_key'       => 'corvus-corone',
                    'scientific_name' => 'Corvus corone',
                    'taxon_rank'      => 'species',
                    'subject_id'      => 'primary',
                ],
                // No identification for subj-empty
            ],
        ]);

        BioUtils::updateConsensus($obs);

        // Primary has taxon
        $this->assertSame('Corvus corone', $obs['subjects'][0]['taxon']['name']);

        // Empty subject should have null taxon
        $this->assertNull($obs['subjects'][1]['taxon']);
        $this->assertSame('未同定', $obs['subjects'][1]['status']);
    }

    public function testPrimarySyncedToLegacy(): void
    {
        $obs = $this->makeVerifiableObs([
            'subjects' => [
                [
                    'id'                 => 'primary',
                    'label'              => null,
                    'photos'             => [0],
                    'taxon'              => null,
                    'identifications'    => [],
                    'ai_assessments'     => [],
                    'consensus'          => null,
                    'verification_stage' => 'unverified',
                ],
                [
                    'id'                 => 'subj-0001',
                    'label'              => 'Secondary',
                    'photos'             => [0],
                    'taxon'              => null,
                    'identifications'    => [],
                    'ai_assessments'     => [],
                    'consensus'          => null,
                    'verification_stage' => 'unverified',
                ],
            ],
            'identifications' => [
                [
                    'user_id'         => 'owner1',
                    'taxon_name'      => 'Aegithalos caudatus',
                    'taxon_key'       => 'aegithalos-caudatus',
                    'scientific_name' => 'Aegithalos caudatus',
                    'taxon_rank'      => 'species',
                    'subject_id'      => 'primary',
                ],
                [
                    'user_id'         => 'owner1',
                    'taxon_name'      => 'Quercus serrata',
                    'taxon_key'       => 'quercus-serrata',
                    'scientific_name' => 'Quercus serrata',
                    'taxon_rank'      => 'species',
                    'subject_id'      => 'subj-0001',
                ],
            ],
        ]);

        BioUtils::updateConsensus($obs);

        // Legacy obs['taxon'] should reflect primary subject, not secondary
        $this->assertSame('Aegithalos caudatus', $obs['taxon']['name']);
        $this->assertNotSame('Quercus serrata', $obs['taxon']['name']);

        // consensus should also be from primary
        $this->assertNotNull($obs['consensus']);
    }
}
