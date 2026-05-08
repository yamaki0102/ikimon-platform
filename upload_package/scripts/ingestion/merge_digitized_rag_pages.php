<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "CLI only.\n");
    exit(1);
}

$args = $argv;
array_shift($args);

[$basePath, $patchPath, $outputPath] = array_pad($args, 3, null);
if ($basePath === null || $patchPath === null) {
    fwrite(STDERR, "Usage: php merge_digitized_rag_pages.php <base_manifest.json> <patch_manifest.json> [output_manifest.json]\n");
    exit(1);
}

$baseResolved = realpath($basePath);
$patchResolved = realpath($patchPath);
if ($baseResolved === false || !is_file($baseResolved)) {
    fwrite(STDERR, "Base manifest not found: {$basePath}\n");
    exit(1);
}
if ($patchResolved === false || !is_file($patchResolved)) {
    fwrite(STDERR, "Patch manifest not found: {$patchPath}\n");
    exit(1);
}

$base = json_decode((string) file_get_contents($baseResolved), true, 512, JSON_INVALID_UTF8_SUBSTITUTE);
$patch = json_decode((string) file_get_contents($patchResolved), true, 512, JSON_INVALID_UTF8_SUBSTITUTE);
if (!is_array($base) || !is_array($patch)) {
    fwrite(STDERR, "Base or patch manifest is invalid JSON.\n");
    exit(1);
}

$basePages = [];
foreach (($base['pages'] ?? []) as $page) {
    if (!is_array($page) || !isset($page['pageNumber'])) {
        continue;
    }
    $basePages[(int) $page['pageNumber']] = $page;
}

$patchedPageNumbers = [];
foreach (($patch['pages'] ?? []) as $page) {
    if (!is_array($page) || !isset($page['pageNumber'])) {
        continue;
    }
    $pageNumber = (int) $page['pageNumber'];
    $basePages[$pageNumber] = $page;
    $patchedPageNumbers[] = $pageNumber;
}

ksort($basePages);
$mergedPages = array_values($basePages);
$chains = buildContinuityChains($mergedPages);
$retrievalUnits = buildRetrievalUnits($mergedPages, $chains);

$merged = $base;
$merged['pages'] = $mergedPages;
$merged['continuityChains'] = $chains;
$merged['retrievalUnits'] = $retrievalUnits;
$merged['processing']['mergedAt'] = gmdate(DATE_ATOM);
$merged['processing']['patchSource'] = $patchResolved;
$merged['processing']['patchedPageNumbers'] = array_values(array_unique($patchedPageNumbers));

$destination = $outputPath !== null && trim($outputPath) !== '' ? $outputPath : $baseResolved;
file_put_contents($destination, json_encode($merged, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

echo json_encode([
    'output' => $destination,
    'patchedPageCount' => count($patchedPageNumbers),
    'patchedPageNumbers' => array_values(array_unique($patchedPageNumbers)),
    'continuityChains' => count($chains),
    'retrievalUnits' => count($retrievalUnits),
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), PHP_EOL;

function buildContinuityChains(array $pages): array
{
    $chains = [];
    $current = null;

    foreach ($pages as $page) {
        $pageKey = continuityKey($page);
        $joinCurrent = $current !== null
            && (
                $pageKey !== null
                && $pageKey === $current['continuityKey']
                || (($current['continuesToNext'] ?? false) && ($page['continuesFromPrevious'] ?? false))
            );

        if (!$joinCurrent) {
            if ($current !== null) {
                $chains[] = finalizeChain($current);
            }
            $current = [
                'continuityKey' => $pageKey,
                'articleId' => $page['articleId'] ?? null,
                'sectionTitle' => $page['sectionTitle'] ?? null,
                'startPage' => $page['pageNumber'],
                'endPage' => $page['pageNumber'],
                'continuesToNext' => $page['continuesToNext'] ?? false,
                'spanStatuses' => [$page['spanStatus'] ?? 'single'],
                'pageNumbers' => [$page['pageNumber']],
                'summaries' => [$page['pageSummary'] ?? ''],
                'keywords' => collectKeywords($page['retrievalUnits'] ?? []),
                'taxa' => collectTaxa($page['retrievalUnits'] ?? []),
            ];
            continue;
        }

        $current['endPage'] = $page['pageNumber'];
        $current['continuesToNext'] = $page['continuesToNext'] ?? false;
        $current['spanStatuses'][] = $page['spanStatus'] ?? 'single';
        $current['pageNumbers'][] = $page['pageNumber'];
        $current['summaries'][] = $page['pageSummary'] ?? '';
        $current['keywords'] = array_values(array_unique(array_merge($current['keywords'], collectKeywords($page['retrievalUnits'] ?? []))));
        $current['taxa'] = mergeTaxa($current['taxa'], collectTaxa($page['retrievalUnits'] ?? []));
        if (($current['articleId'] ?? null) === null && ($page['articleId'] ?? null) !== null) {
            $current['articleId'] = $page['articleId'];
        }
        if (($current['sectionTitle'] ?? null) === null && ($page['sectionTitle'] ?? null) !== null) {
            $current['sectionTitle'] = $page['sectionTitle'];
        }
    }

    if ($current !== null) {
        $chains[] = finalizeChain($current);
    }

    foreach ($chains as $index => &$chain) {
        $chain['chainId'] = 'chain-' . str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT);
    }

    return $chains;
}

function continuityKey(array $page): ?string
{
    if (!empty($page['articleId'])) {
        return (string) $page['articleId'];
    }
    if (!empty($page['sectionIdHint'])) {
        return (string) $page['sectionIdHint'];
    }
    if (!empty($page['sectionTitle'])) {
        return mb_strtolower((string) $page['sectionTitle'], 'UTF-8');
    }
    return null;
}

function finalizeChain(array $chain): array
{
    return [
        'chainId' => '',
        'articleId' => $chain['articleId'] ?? null,
        'sectionTitle' => $chain['sectionTitle'] ?? null,
        'pageStart' => $chain['startPage'],
        'pageEnd' => $chain['endPage'],
        'pageNumbers' => $chain['pageNumbers'],
        'spanStatuses' => $chain['spanStatuses'],
        'summary' => trim(implode(' ', array_filter(array_unique($chain['summaries'])))),
        'keywords' => $chain['keywords'],
        'taxa' => array_values($chain['taxa']),
    ];
}

function buildRetrievalUnits(array $pages, array $chains): array
{
    $units = [];

    foreach ($chains as $chain) {
        $units[] = [
            'unitId' => $chain['chainId'],
            'type' => 'continuity_chain',
            'articleId' => $chain['articleId'],
            'pageStart' => $chain['pageStart'],
            'pageEnd' => $chain['pageEnd'],
            'title' => $chain['sectionTitle'] ?? ('pages ' . $chain['pageStart'] . '-' . $chain['pageEnd']),
            'summary' => $chain['summary'],
            'keywords' => $chain['keywords'],
            'taxa' => array_values($chain['taxa']),
        ];
    }

    foreach ($pages as $page) {
        foreach (($page['retrievalUnits'] ?? []) as $unit) {
            if (!is_array($unit)) {
                continue;
            }
            $units[] = [
                'unitId' => ($page['pageNumber'] ?? 0) . ':' . ($unit['unitIdHint'] ?? 'unit'),
                'type' => 'page_anchor',
                'articleId' => $unit['articleId'] ?? ($page['articleId'] ?? null),
                'pageStart' => $unit['pageSpanStart'] ?? ($page['pageNumber'] ?? 0),
                'pageEnd' => $unit['pageSpanEnd'] ?? ($page['pageNumber'] ?? 0),
                'anchorPage' => $page['pageNumber'] ?? 0,
                'title' => $unit['title'] ?? null,
                'summary' => $unit['summary'] ?? '',
                'facts' => $unit['facts'] ?? [],
                'keywords' => $unit['keywords'] ?? [],
                'taxa' => $unit['taxa'] ?? [],
            ];
        }
    }

    return $units;
}

function collectKeywords(array $units): array
{
    $keywords = [];
    foreach ($units as $unit) {
        if (!is_array($unit)) {
            continue;
        }
        $keywords = array_merge($keywords, $unit['keywords'] ?? []);
    }
    return array_values(array_unique(array_filter($keywords)));
}

function collectTaxa(array $units): array
{
    $taxa = [];
    foreach ($units as $unit) {
        if (!is_array($unit)) {
            continue;
        }
        foreach (($unit['taxa'] ?? []) as $taxon) {
            if (!is_array($taxon)) {
                continue;
            }
            $key = ($taxon['scientificName'] ?? '') . '|' . ($taxon['japaneseName'] ?? '');
            if ($key === '|') {
                continue;
            }
            $taxa[$key] = $taxon;
        }
    }
    return $taxa;
}

function mergeTaxa(array $left, array $right): array
{
    foreach ($right as $key => $value) {
        $left[$key] = $value;
    }
    return $left;
}
