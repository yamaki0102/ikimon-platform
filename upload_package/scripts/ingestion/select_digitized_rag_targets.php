<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only.\n");
    exit(1);
}

$args = $argv;
array_shift($args);

[$manifestPath, $limitArg] = array_pad($args, 2, null);
if ($manifestPath === null) {
    fwrite(STDERR, "Usage: php select_digitized_rag_targets.php <manifest.json> [limit]\n");
    exit(1);
}

$resolved = realpath($manifestPath);
if ($resolved === false || !is_file($resolved)) {
    fwrite(STDERR, "Manifest not found: {$manifestPath}\n");
    exit(1);
}

$limit = max(1, (int) ($limitArg ?? 20));
$manifest = json_decode((string) file_get_contents($resolved), true, 512, JSON_INVALID_UTF8_SUBSTITUTE);
if (!is_array($manifest)) {
    fwrite(STDERR, "Manifest JSON is invalid: {$resolved}\n");
    exit(1);
}

$pages = $manifest['pages'] ?? [];
$genericTitles = [
    'frog gallery',
    'salamander gallery',
    'picture book',
    'content',
    'contents',
    'cover',
    'unknown',
];

$targets = [];
foreach ($pages as $page) {
    if (!is_array($page)) {
        continue;
    }

    $pageNumber = (int) ($page['pageNumber'] ?? 0);
    if ($pageNumber < 1) {
        continue;
    }

    $units = is_array($page['retrievalUnits'] ?? null) ? $page['retrievalUnits'] : [];
    $score = 0;
    $reasons = [];

    $sectionTitle = trim((string) ($page['sectionTitle'] ?? ''));
    $sectionTitleKey = mb_strtolower($sectionTitle, 'UTF-8');
    if ($sectionTitle === '' || in_array($sectionTitleKey, $genericTitles, true)) {
        $score += 3;
        $reasons[] = 'generic_section_title';
    }

    if (count($units) <= 1) {
        $score += 2;
        $reasons[] = 'low_retrieval_unit_count';
    }

    $taxonCount = 0;
    $scientificNameCount = 0;
    foreach ($units as $unit) {
        foreach (($unit['taxa'] ?? []) as $taxon) {
            if (!is_array($taxon)) {
                continue;
            }
            $taxonCount++;
            if (trim((string) ($taxon['scientificName'] ?? '')) !== '') {
                $scientificNameCount++;
            }
        }
    }

    if ($taxonCount === 0 && ($page['pageRole'] ?? '') === 'content') {
        $score += 3;
        $reasons[] = 'content_page_without_taxa';
    } elseif ($taxonCount > 0 && $scientificNameCount === 0) {
        $score += 1;
        $reasons[] = 'taxa_without_scientific_names';
    }

    $summary = trim((string) ($page['pageSummary'] ?? ''));
    if ($summary === '') {
        $score += 4;
        $reasons[] = 'empty_summary';
    } elseif (mb_strlen($summary, 'UTF-8') < 45 && ($page['contentDensity'] ?? '') !== 'sparse') {
        $score += 1;
        $reasons[] = 'short_summary';
    }

    if (($page['contentDensity'] ?? '') === 'figure_plate' && count($units) < 2) {
        $score += 2;
        $reasons[] = 'figure_plate_under_extracted';
    }

    if (($page['contentDensity'] ?? '') === 'mixed' && count($units) < 2) {
        $score += 1;
        $reasons[] = 'mixed_page_under_extracted';
    }

    $hasColumn = false;
    foreach ($units as $unit) {
        $title = mb_strtolower(trim((string) ($unit['title'] ?? '')), 'UTF-8');
        if (str_contains($title, 'コラム') || str_contains($title, 'column')) {
            $hasColumn = true;
            break;
        }
    }
    if ($hasColumn && $taxonCount === 0 && ($page['contentDensity'] ?? '') === 'mixed') {
        $score += 1;
        $reasons[] = 'column_without_taxa';
    }

    if ($score <= 0) {
        continue;
    }

    $targets[] = [
        'pageNumber' => $pageNumber,
        'fileName' => $page['fileName'] ?? null,
        'score' => $score,
        'pageRole' => $page['pageRole'] ?? null,
        'contentDensity' => $page['contentDensity'] ?? null,
        'sectionTitle' => $sectionTitle !== '' ? $sectionTitle : null,
        'retrievalUnitCount' => count($units),
        'taxonCount' => $taxonCount,
        'scientificNameCount' => $scientificNameCount,
        'reasons' => $reasons,
    ];
}

usort(
    $targets,
    static function (array $left, array $right): int {
        return [$right['score'], $left['retrievalUnitCount'], $left['pageNumber']]
            <=> [$left['score'], $right['retrievalUnitCount'], $right['pageNumber']];
    }
);

$selected = array_slice($targets, 0, $limit);
$pageNumbers = array_map(static fn(array $row): int => (int) $row['pageNumber'], $selected);

$result = [
    'manifest' => $resolved,
    'bookTitle' => $manifest['book']['title'] ?? null,
    'candidateCount' => count($selected),
    'pageNumbers' => $pageNumbers,
    'candidates' => $selected,
];

echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), PHP_EOL;
