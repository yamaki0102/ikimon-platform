<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/BioUtils.php';

$pass = 0;
$fail = 0;

function makeObservation(array $identifications): array
{
    return [
        'id' => 'obs_taxonomy',
        'user_id' => 'observer',
        'observed_at' => '2026-03-01 10:00:00',
        'lat' => 34.7,
        'lng' => 137.7,
        'photos' => ['uploads/test.jpg'],
        'cultivation' => 'wild',
        'identifications' => $identifications,
    ];
}

function assertSameValue(string $label, $actual, $expected): void
{
    global $pass, $fail;
    if ($actual === $expected) {
        $pass++;
        echo "PASS {$label}\n";
        return;
    }

    $fail++;
    echo "FAIL {$label} expected=" . json_encode($expected, JSON_UNESCAPED_UNICODE) . " actual=" . json_encode($actual, JSON_UNESCAPED_UNICODE) . "\n";
}

$orderVote = [
    'user_id' => 'u1',
    'taxon_id' => 'gbif:797',
    'taxon_name' => 'チョウ目',
    'taxon_rank' => 'order',
    'lineage' => ['kingdom' => 'Animalia', 'phylum' => 'Arthropoda', 'class' => 'Insecta', 'order' => 'Lepidoptera'],
    'lineage_ids' => ['kingdom' => 'gbif:1', 'phylum' => 'gbif:54', 'class' => 'gbif:216'],
    'ancestry_ids' => ['gbif:1', 'gbif:54', 'gbif:216'],
    'full_path_ids' => ['gbif:1', 'gbif:54', 'gbif:216', 'gbif:797'],
    'weight_snapshot' => 1.0,
];

$speciesVote = [
    'user_id' => 'u2',
    'taxon_id' => 'gbif:5128519',
    'taxon_key' => 5128519,
    'taxon_name' => 'オオムラサキ',
    'scientific_name' => 'Sasakia charonda',
    'taxon_rank' => 'species',
    'lineage' => ['kingdom' => 'Animalia', 'phylum' => 'Arthropoda', 'class' => 'Insecta', 'order' => 'Lepidoptera', 'family' => 'Nymphalidae', 'genus' => 'Sasakia'],
    'lineage_ids' => ['kingdom' => 'gbif:1', 'phylum' => 'gbif:54', 'class' => 'gbif:216', 'order' => 'gbif:797', 'family' => 'gbif:7017', 'genus' => 'gbif:1896785'],
    'ancestry_ids' => ['gbif:1', 'gbif:54', 'gbif:216', 'gbif:797', 'gbif:7017', 'gbif:1896785'],
    'full_path_ids' => ['gbif:1', 'gbif:54', 'gbif:216', 'gbif:797', 'gbif:7017', 'gbif:1896785', 'gbif:5128519'],
    'weight_snapshot' => 1.0,
];

$conflictVote = [
    'user_id' => 'u3',
    'taxon_id' => 'gbif:123456',
    'taxon_name' => 'コウチュウ目',
    'taxon_rank' => 'order',
    'lineage' => ['kingdom' => 'Animalia', 'phylum' => 'Arthropoda', 'class' => 'Insecta', 'order' => 'Coleoptera'],
    'lineage_ids' => ['kingdom' => 'gbif:1', 'phylum' => 'gbif:54', 'class' => 'gbif:216'],
    'ancestry_ids' => ['gbif:1', 'gbif:54', 'gbif:216'],
    'full_path_ids' => ['gbif:1', 'gbif:54', 'gbif:216', 'gbif:123456'],
    'weight_snapshot' => 1.0,
];

$familyVote = [
    'user_id' => 'u5',
    'taxon_id' => 'gbif:3176',
    'taxon_name' => 'ツツジ科',
    'taxon_rank' => 'family',
    'lineage' => ['kingdom' => 'Plantae', 'phylum' => 'Tracheophyta', 'class' => 'Magnoliopsida', 'order' => 'Ericales', 'family' => 'Ericaceae'],
    'lineage_ids' => ['kingdom' => 'gbif:6', 'phylum' => 'gbif:7707728', 'class' => 'gbif:220', 'order' => 'gbif:1353'],
    'ancestry_ids' => ['gbif:6', 'gbif:7707728', 'gbif:220', 'gbif:1353'],
    'full_path_ids' => ['gbif:6', 'gbif:7707728', 'gbif:220', 'gbif:1353', 'gbif:3176'],
    'weight_snapshot' => 1.0,
];

$genusVote = [
    'user_id' => 'u6',
    'taxon_id' => 'gbif:2907675',
    'taxon_name' => 'ツツジ属',
    'taxon_rank' => 'genus',
    'lineage' => ['kingdom' => 'Plantae', 'phylum' => 'Tracheophyta', 'class' => 'Magnoliopsida', 'order' => 'Ericales', 'family' => 'Ericaceae', 'genus' => 'Rhododendron'],
    'lineage_ids' => ['kingdom' => 'gbif:6', 'phylum' => 'gbif:7707728', 'class' => 'gbif:220', 'order' => 'gbif:1353', 'family' => 'gbif:3176'],
    'ancestry_ids' => ['gbif:6', 'gbif:7707728', 'gbif:220', 'gbif:1353', 'gbif:3176'],
    'full_path_ids' => ['gbif:6', 'gbif:7707728', 'gbif:220', 'gbif:1353', 'gbif:3176', 'gbif:2907675'],
    'weight_snapshot' => 1.0,
];

$obs = makeObservation([$orderVote, $speciesVote]);
BioUtils::updateConsensus($obs);
assertSameValue('lca_rank', $obs['taxon']['rank'] ?? null, 'order');
assertSameValue('lca_name', $obs['taxon']['name'] ?? null, 'チョウ目');
assertSameValue('lca_conflict', $obs['quality_flags']['has_lineage_conflict'] ?? null, false);
assertSameValue('lca_status', $obs['status'] ?? null, '要同定');

$obs = makeObservation([$speciesVote, array_merge($speciesVote, ['user_id' => 'u4'])]);
BioUtils::updateConsensus($obs);
assertSameValue('research_grade_rank', $obs['taxon']['rank'] ?? null, 'species');
assertSameValue('research_grade_status', $obs['status'] ?? null, '種レベル研究用');

$obs = makeObservation([$speciesVote, $conflictVote]);
BioUtils::updateConsensus($obs);
assertSameValue('conflict_flag', $obs['quality_flags']['has_lineage_conflict'] ?? null, true);
assertSameValue('conflict_count', $obs['lineage_consistency']['conflict_count'] ?? null, 1);

$obs = makeObservation([$genusVote, $familyVote]);
BioUtils::updateConsensus($obs);
assertSameValue('family_genus_community_rank', $obs['taxon']['rank'] ?? null, 'family');
assertSameValue('family_genus_community_name', $obs['taxon']['name'] ?? null, 'ツツジ科');
assertSameValue('family_genus_descendant_rank', $obs['best_supported_descendant_taxon']['rank'] ?? null, 'genus');
assertSameValue('family_genus_descendant_name', $obs['best_supported_descendant_taxon']['name'] ?? null, 'ツツジ属');
assertSameValue('family_genus_status', $obs['status'] ?? null, '研究利用可');

$legacySpeciesVote = [
    'user_id' => 'u7',
    'taxon_name' => 'ゴマダラカミキリ',
    'taxon_slug' => 'anoplophora-chinensis',
    'scientific_name' => 'Anoplophora chinensis',
    'taxon_rank' => 'species',
    'lineage' => [
        'kingdom' => null,
        'phylum' => null,
        'class' => null,
        'order' => null,
        'family' => null,
        'genus' => null,
    ],
    'weight_snapshot' => 0.5,
];

$obs = makeObservation([$legacySpeciesVote]);
BioUtils::updateConsensus($obs);
assertSameValue('legacy_identification_resolves_name', $obs['taxon']['name'] ?? null, 'ゴマダラカミキリ');
assertSameValue('legacy_identification_resolves_slug', $obs['taxon']['slug'] ?? null, 'anoplophora-chinensis');
assertSameValue('legacy_identification_resolves_id', !empty($obs['taxon']['id']), true);
assertSameValue('legacy_identification_keeps_status', $obs['status'] ?? null, '要同定');

echo "PASS={$pass} FAIL={$fail}\n";
exit($fail > 0 ? 1 : 0);
