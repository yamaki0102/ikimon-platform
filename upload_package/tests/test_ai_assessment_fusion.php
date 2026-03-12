<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/AiObservationAssessment.php';

function assertSameValue($expected, $actual, string $message): void
{
    if ($expected !== $actual) {
        throw new RuntimeException($message . ' expected=' . var_export($expected, true) . ' actual=' . var_export($actual, true));
    }
}

$speciesA = [
    'taxon_id' => 'gbif:100',
    'provider' => 'gbif',
    'provider_id' => 100,
    'key' => 100,
    'gbif_key' => 100,
    'inat_taxon_id' => null,
    'name' => 'ツツジA',
    'canonical_name' => 'ツツジA',
    'scientific_name' => 'Rhododendron alpha',
    'slug' => 'rhododendron-alpha',
    'rank' => 'species',
    'lineage' => [
        'kingdom' => 'Plantae',
        'family' => 'ツツジ科',
        'genus' => 'ツツジ属',
    ],
    'lineage_ids' => [
        'kingdom' => 'gbif:1',
        'family' => 'gbif:10',
        'genus' => 'gbif:11',
    ],
    'ancestry' => 'gbif:1/gbif:10/gbif:11',
    'ancestry_ids' => ['gbif:1', 'gbif:10', 'gbif:11'],
    'full_path_ids' => ['gbif:1', 'gbif:10', 'gbif:11', 'gbif:100'],
    'taxonomy_version' => 'test-v1',
    'thumbnail_url' => null,
];

$speciesB = $speciesA;
$speciesB['taxon_id'] = 'gbif:101';
$speciesB['provider_id'] = 101;
$speciesB['key'] = 101;
$speciesB['gbif_key'] = 101;
$speciesB['name'] = 'ツツジB';
$speciesB['canonical_name'] = 'ツツジB';
$speciesB['scientific_name'] = 'Rhododendron beta';
$speciesB['slug'] = 'rhododendron-beta';
$speciesB['full_path_ids'] = ['gbif:1', 'gbif:10', 'gbif:11', 'gbif:101'];

$fusion = AiObservationAssessment::synthesizeCandidateFusion([$speciesA, $speciesB]);

assertSameValue('gbif:11', $fusion['recommended_taxon']['id'] ?? null, 'stable taxon should collapse to genus');
assertSameValue('genus', $fusion['recommended_taxon']['rank'] ?? null, 'stable rank should be genus');
assertSameValue('gbif:100', $fusion['best_specific_taxon']['id'] ?? null, 'best specific should keep top candidate');
assertSameValue('plant', $fusion['routing_hint'] ?? null, 'routing hint should detect plant');
assertSameValue('shared_lineage', $fusion['disagreement'] ?? null, 'disagreement should note shared lineage');

echo "OK\n";
