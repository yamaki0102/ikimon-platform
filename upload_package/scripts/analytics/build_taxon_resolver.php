<?php

/**
 * Build Taxon Resolver
 * 
 * Merges GBIF keys from paper_taxa + scientific names from library/index
 * to produce a unified taxon_resolver.json for species page routing.
 * 
 * Usage: php scripts/build_taxon_resolver.php
 */
require_once __DIR__ . '/../config/config.php';

echo "=== Building Taxon Resolver ===\n";

$resolver = []; // keyed by slug

// Helper: create URL slug from scientific name
function makeSlug($name)
{
    $slug = strtolower(trim($name));
    $slug = preg_replace('/[^a-z0-9\s\-]/', '', $slug);
    $slug = preg_replace('/\s+/', '-', $slug);
    return $slug;
}

// --- Source 1: paper_taxa (has GBIF keys) ---
$ptDir = DATA_DIR . '/library/paper_taxa';
$ptFiles = glob($ptDir . '/*.json');
$ptCount = 0;

foreach ($ptFiles as $f) {
    $link = json_decode(file_get_contents($f), true);
    if (!$link) continue;

    $sciName = $link['scientific_name'] ?? '';
    $jpName = $link['jp_name'] ?? '';
    $gbifKey = $link['gbif_taxon_key'] ?? null;

    if (!$sciName) continue;

    $slug = makeSlug($sciName);
    if (!$slug) continue;

    if (!isset($resolver[$slug])) {
        $resolver[$slug] = [
            'accepted_name' => $sciName,
            'slug' => $slug,
            'gbif_key' => $gbifKey,
            'ja_name' => $jpName,
            'synonyms' => [],
            'historical_names' => [],
            'sources' => []
        ];
    } else {
        // Merge: prefer existing, but fill gaps
        if (!$resolver[$slug]['gbif_key'] && $gbifKey) {
            $resolver[$slug]['gbif_key'] = $gbifKey;
        }
        if (!$resolver[$slug]['ja_name'] && $jpName) {
            $resolver[$slug]['ja_name'] = $jpName;
        }
    }

    $originalName = $link['darwin_core']['dwc:originalNameUsage'] ?? null;
    $gbifAccepted = $link['gbif_accepted_name'] ?? ($link['darwin_core']['dwc:scientificName'] ?? null);

    // We want to store the historic name if it differs from the accepted gbif name.
    if ($originalName && $gbifAccepted && $originalName !== $gbifAccepted && !in_array($originalName, $resolver[$slug]['historical_names'])) {
        $resolver[$slug]['historical_names'][] = $originalName;
    }

    if (!in_array('paper_taxa', $resolver[$slug]['sources'])) {
        $resolver[$slug]['sources'][] = 'paper_taxa';
    }
    $ptCount++;
}
echo "paper_taxa: processed $ptCount links\n";

// --- Source 2: library/index (has scientific names, some have GBIF status) ---
$idxDir = DATA_DIR . '/library/index';
$idxFiles = glob($idxDir . '/*.json');
$idxCount = 0;
$idxNew = 0;

foreach ($idxFiles as $f) {
    $entry = json_decode(file_get_contents($f), true);
    if (!$entry) continue;

    $sciName = $entry['scientific_name'] ?? '';
    $jpName = $entry['taxon_name'] ?? '';
    $gbifKey = $entry['gbif_taxon_key'] ?? null;
    $gbifStatus = $entry['gbif_status'] ?? '';
    $gbifAccepted = $entry['gbif_accepted_name'] ?? '';

    if (!$sciName && !$jpName) continue;

    // If we have a scientific name, use it
    if ($sciName) {
        $slug = makeSlug($sciName);
        if (!$slug) continue;

        if (!isset($resolver[$slug])) {
            $resolver[$slug] = [
                'accepted_name' => $sciName,
                'slug' => $slug,
                'gbif_key' => $gbifKey,
                'ja_name' => $jpName,
                'synonyms' => [],
                'historical_names' => [],
                'sources' => []
            ];
            $idxNew++;
        } else {
            // Fill gaps
            if (!$resolver[$slug]['ja_name'] && $jpName) {
                $resolver[$slug]['ja_name'] = $jpName;
            }
            if (!$resolver[$slug]['gbif_key'] && $gbifKey) {
                $resolver[$slug]['gbif_key'] = $gbifKey;
            }
            if (!isset($resolver[$slug]['historical_names'])) {
                $resolver[$slug]['historical_names'] = [];
            }
        }

        $originalName = $entry['darwin_core']['dwc:originalNameUsage'] ?? null;
        $gbifAccepted = $entry['gbif_accepted_name'] ?? ($entry['darwin_core']['dwc:scientificName'] ?? null);

        if ($originalName && $gbifAccepted && $originalName !== $gbifAccepted && !in_array($originalName, $resolver[$slug]['historical_names'])) {
            $resolver[$slug]['historical_names'][] = $originalName;
        }

        // Handle SYNONYM status
        if ($gbifStatus === 'SYNONYM' && $gbifAccepted) {
            $acceptedSlug = makeSlug($gbifAccepted);
            // Record this as a synonym
            if ($acceptedSlug !== $slug) {
                if (!isset($resolver[$acceptedSlug])) {
                    $resolver[$acceptedSlug] = [
                        'accepted_name' => $gbifAccepted,
                        'slug' => $acceptedSlug,
                        'gbif_key' => null,
                        'ja_name' => $jpName,
                        'synonyms' => [$sciName],
                        'historical_names' => [],
                        'sources' => []
                    ];
                } else {
                    if (!in_array($sciName, $resolver[$acceptedSlug]['synonyms'])) {
                        $resolver[$acceptedSlug]['synonyms'][] = $sciName;
                    }
                    if (!isset($resolver[$acceptedSlug]['historical_names'])) {
                        $resolver[$acceptedSlug]['historical_names'] = [];
                    }
                }
                // Mark original slug as synonym redirect
                $resolver[$slug]['redirect_to'] = $acceptedSlug;
            }
        }

        if (!in_array('library/index', $resolver[$slug]['sources'])) {
            $resolver[$slug]['sources'][] = 'library/index';
        }
    }

    $idxCount++;
}
echo "library/index: processed $idxCount entries ($idxNew new species)\n";

// --- Source 3: Red Lists (national + prefectural) ---
$rlDir = DATA_DIR . '/redlists';
$rlFiles = glob($rlDir . '/*.json');
$rlCount = 0;
$rlNew = 0;

foreach ($rlFiles as $f) {
    $rlData = json_decode(file_get_contents($f), true);
    if (!$rlData || empty($rlData['species'])) continue;

    foreach ($rlData['species'] as $sp) {
        $sciName = $sp['sci_name'] ?? '';
        $jpName = $sp['ja_name'] ?? '';

        if (!$sciName || !$jpName) continue;

        $slug = makeSlug($sciName);
        if (!$slug) continue;

        if (!isset($resolver[$slug])) {
            $resolver[$slug] = [
                'accepted_name' => $sciName,
                'slug' => $slug,
                'gbif_key' => null,
                'ja_name' => $jpName,
                'synonyms' => [],
                'sources' => []
            ];
            $rlNew++;
        } else {
            // Fill ja_name if missing
            if (!$resolver[$slug]['ja_name'] && $jpName) {
                $resolver[$slug]['ja_name'] = $jpName;
            }
        }

        if (!in_array('redlist', $resolver[$slug]['sources'])) {
            $resolver[$slug]['sources'][] = 'redlist';
        }
        $rlCount++;
    }
}
echo "redlists: processed $rlCount entries ($rlNew new species)\n";

// --- Build JP→slug reverse index ---
$jpIndex = [];
foreach ($resolver as $slug => $data) {
    if (!empty($data['ja_name'])) {
        $jpIndex[$data['ja_name']] = $slug;
    }
}

// --- Also collect ja_names from library/index that have NO scientific_name ---
// These won't have a slug but we still want jpIndex for backward compat
$jpOnlyCount = 0;
$skipPatterns = ['まえがき', '目次', '概説', '検索表', 'PLATE', '付表', '索引', '参考文献', '図版', '凡例', '解説', '続き'];
foreach ($idxFiles as $f) {
    $entry = json_decode(file_get_contents($f), true);
    if (!$entry) continue;
    $sciName = $entry['scientific_name'] ?? '';
    $jpName = $entry['taxon_name'] ?? '';
    if (!$jpName || $sciName) continue; // only for entries WITHOUT scientific name
    if (isset($jpIndex[$jpName])) continue; // already mapped

    // Filter out non-species entries
    $skip = false;
    foreach ($skipPatterns as $pat) {
        if (mb_strpos($jpName, $pat) !== false) {
            $skip = true;
            break;
        }
    }
    if ($skip) continue;
    if (preg_match('/^\d/', $jpName)) continue; // starts with number
    if (mb_strlen($jpName) < 2) continue; // too short

    // Store as jp_name → jp_name (no slug, fallback mode)
    $jpIndex[$jpName] = '__jp__' . $jpName;
    $jpOnlyCount++;
}
echo "JP-only entries (no scientific name): $jpOnlyCount\n";

// --- Output ---
$output = [
    'version' => '1.0',
    'generated_at' => date('c'),
    'stats' => [
        'total_taxa' => count($resolver),
        'with_gbif_key' => count(array_filter($resolver, fn($r) => !empty($r['gbif_key']))),
        'with_ja_name' => count(array_filter($resolver, fn($r) => !empty($r['ja_name']))),
        'synonyms' => count(array_filter($resolver, fn($r) => !empty($r['redirect_to']))),
        'historical_names' => array_sum(array_map(fn($r) => count($r['historical_names'] ?? []), $resolver)),
    ],
    'taxa' => $resolver,
    'jp_index' => $jpIndex
];

$outFile = DATA_DIR . '/taxon_resolver.json';
file_put_contents($outFile, json_encode($output, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

echo "\n=== RESULT ===\n";
echo "Output: $outFile\n";
echo "Total taxa: " . $output['stats']['total_taxa'] . "\n";
echo "With GBIF key: " . $output['stats']['with_gbif_key'] . "\n";
echo "With ja_name: " . $output['stats']['with_ja_name'] . "\n";
echo "Synonyms: " . $output['stats']['synonyms'] . "\n";
echo "Historical Names Found: " . $output['stats']['historical_names'] . "\n";
echo "JP index: " . count($jpIndex) . " entries\n";
echo "File size: " . round(filesize($outFile) / 1024) . " KB\n";
