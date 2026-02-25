<?php

// Paths
$projectRoot = __DIR__ . '/../upload_package';
$libsDir = $projectRoot . '/libs';
// ikimon.life/tests -> ikimon.life -> ikimon -> antigravity -> .agent
$skillDir = __DIR__ . '/../../../.agent/skills/testing_mastery/scripts/logic_regression';

// Dependencies
require_once $projectRoot . '/config/config.php'; // ROOT_DIR, DATA_DIR
require_once $libsDir . '/DataStore.php';
require_once $libsDir . '/RedListManager.php';
require_once $libsDir . '/BiodiversityScorer.php';
require_once $skillDir . '/LogicTester.php';

use TestingMastery\LogicRegression\LogicTester;

echo "========================================\n";
echo " BIS Logic Regression Test (v1.0)\n";
echo "========================================\n";

// Test Cases
$cases = [
    [
        'label' => 'Case 1: Empty Site (No Obs)',
        'input' => [[], ['area_ha' => 1]],
        'expect' => [
            'total_score' => 0,
            'species_count' => 0,
            'shannon_index' => 0
        ]
    ],
    [
        'label' => 'Case 2: Single Species (Richness=0, DC=Low)',
        'input' => [
            [
                ['scientific_name' => 'Canis lupus', 'taxon' => ['name' => 'Canis lupus', 'class' => 'Mammalia'], 'quality_grade' => 'casual', 'observed_on' => '2026-01-01']
            ],
            ['area_ha' => 10]
        ],
        'expect' => [
            'species_count' => 1,
            'shannon_index' => 0.0, // 1種なら0
            'breakdown.richness.score' => 0.0,
            'breakdown.data_confidence.score' => 0.0 // 0.4 -> round(0.4)=0.0 ?? Wait, logic check needed.
        ],
        'float_precision' => 1
    ],
    [
        'label' => 'Case 3: High Diversity (Shannon > 0)',
        'input' => [
            [
                ['scientific_name' => 'Species A', 'taxon' => ['name' => 'Species A', 'class' => 'Aves'], 'quality_grade' => 'research', 'observed_on' => '2026-01-01'],
                ['scientific_name' => 'Species B', 'taxon' => ['name' => 'Species B', 'class' => 'Insecta'], 'quality_grade' => 'research', 'observed_on' => '2026-01-02'],
                ['scientific_name' => 'Species C', 'taxon' => ['name' => 'Species C', 'class' => 'Plantae'], 'quality_grade' => 'research', 'observed_on' => '2026-01-03']
            ],
            ['area_ha' => 1]
        ],
        'expect' => [
            'species_count' => 3,
            // H' = -sum(pi * ln(pi)) = -(1/3*ln(1/3) * 3) = -ln(1/3) = ln(3) ≈ 1.098
            'shannon_index' => 1.1,
            'breakdown.richness.score' => 31 // (1.098/3.5)*100 = 31.3 -> 31
        ],
        'float_precision' => 1
    ]
];

$tester = new LogicTester('BiodiversityScorer', 'calculate');
$result = $tester->run($cases);

echo "\nSummary: {$result['passed']}/{$result['total']} Passed.\n";

if ($result['failed'] > 0) {
    exit(1);
}
exit(0);
