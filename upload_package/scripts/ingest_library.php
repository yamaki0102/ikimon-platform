<?php

/**
 * Ingest Library V2 - Multi-Book Adapter Pattern
 * 
 * 監査結果 (2026-02-07) に基づく全面書き直し:
 * - Adapter Pattern: 本ごとのスキーマ差異を吸収
 * - Full Extraction: data_icons, family, photos, figures を全て保存
 * - Name Normalizer: name / japanese_name の揺れを吸収
 * - GBIF Enrichment: scientific_name を GBIF API で照合し taxon_key を付与
 * 
 * Usage: php scripts/ingest_library.php [--skip-gbif]
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/Services/GbifService.php';

// ============================================================
// CLI Options
// ============================================================
$skipGbif = in_array('--skip-gbif', $argv ?? []);
if ($skipGbif) {
    echo "[INFO] --skip-gbif mode: GBIF lookup will be skipped.\n";
}

// ============================================================
// Book Registry: All books to ingest
// ============================================================
$BOOK_REGISTRY = [
    [
        'id'          => 'book_genshoku_amphibians_reptiles',
        'title'       => '原色日本両生爬虫類図鑑',
        'author'      => 'Nakamura & Ueno',
        'publisher'   => 'Hoikusha',
        'year'        => '1963',
        'total_pages' => 214,
        'dir'         => __DIR__ . '/../../../book_digitization/原色日本両生爬虫類図鑑',
        'schema'      => 'genshoku'
    ],
    [
        'id'          => 'book_kumo_handbook',
        'title'       => 'クモ ハンドブック',
        'author'      => '',
        'publisher'   => '',
        'year'        => '',
        'total_pages' => 0,
        'dir'         => __DIR__ . '/../../../book_digitization/クモ_ハンドブック',
        'schema'      => 'handbook'
    ],
    [
        'id'          => 'book_kuwagata_handbook',
        'title'       => 'クワガタムシ ハンドブック 増補改訂版',
        'author'      => '',
        'publisher'   => '',
        'year'        => '',
        'total_pages' => 50,
        'dir'         => __DIR__ . '/../../../book_digitization/クワガタムシハンドブック増補改訂版',
        'schema'      => 'species_data'
    ],
    [
        'id'          => 'book_genshoku_trees_1',
        'title'       => '原色樹木図鑑 (I)',
        'author'      => '',
        'publisher'   => 'Hoikusha',
        'year'        => '',
        'total_pages' => 0,
        'dir'         => __DIR__ . '/../../../book_digitization/原色樹木図鑑',
        'schema'      => 'genshoku'
    ],
    [
        'id'          => 'book_genshoku_trees_2',
        'title'       => '原色樹木図鑑 (II)',
        'author'      => '',
        'publisher'   => 'Hoikusha',
        'year'        => '',
        'total_pages' => 0,
        'dir'         => __DIR__ . '/../../../book_digitization/原色樹木図鑑2',
        'schema'      => 'genshoku'
    ],
    [
        'id'          => 'book_insectarium_37',
        'title'       => 'インセクタリゥム Vol.37',
        'author'      => 'Tokyo Zoological Park Society',
        'publisher'   => '東京動物園協会',
        'year'        => '2000',
        'total_pages' => 31,
        'dir'         => __DIR__ . '/../../../book_digitization/インセクタリゥム37',
        'schema'      => 'magazine'
    ],
    [
        'id'          => 'book_gakken_live_insects',
        'title'       => '学研の図鑑LIVE 昆虫',
        'author'      => '学研プラス',
        'publisher'   => '学研プラス',
        'year'        => '2014',
        'total_pages' => 166,
        'dir'         => __DIR__ . '/../../../book_digitization/学研の図鑑LIVE_昆虫',
        'schema'      => 'v8_universal'
    ],
    [
        'id'          => 'book_fieldguide_butterflies',
        'title'       => 'フィールドガイド 日本のチョウ',
        'author'      => '',
        'publisher'   => '',
        'year'        => '',
        'total_pages' => 174,
        'dir'         => __DIR__ . '/../../../book_digitization/フィールドガイド_日本のチョウ',
        'schema'      => 'v8_universal'
    ],
    [
        'id'          => 'book_nakigoe_insects',
        'title'       => '鳴き声から調べる昆虫図鑑',
        'author'      => '',
        'publisher'   => '',
        'year'        => '',
        'total_pages' => 116,
        'dir'         => __DIR__ . '/../../../book_digitization/鳴き声から調べる昆虫図鑑',
        'schema'      => 'v8_universal'
    ],
];

// ============================================================
// Schema Adapters
// ============================================================

/**
 * Extract species entries from a JSON structure.
 * Different books use different JSON schemas.
 * 
 * @param array $json Raw decoded JSON
 * @param string $schema Schema variant identifier
 * @return array Normalized entries [ { jp_name, sci_name, description, family, data_icons, photos, figures, page_type } ]
 */
function extractEntries($json, $schema)
{
    $entries = [];
    $pageType = $json['meta']['page_type'] ?? 'UNKNOWN';

    // Get raw species entries based on schema
    $rawEntries = [];
    switch ($schema) {
        case 'genshoku':
            // Schema A: species_entries at root level
            $rawEntries = $json['species_entries'] ?? [];
            break;

        case 'handbook':
            // Schema B: species_entries nested under text_content
            $rawEntries = $json['text_content']['species_entries'] ?? [];
            break;

        case 'species_data':
            // Schema C: クワガタHB — species_info (single species per page)
            if (isset($json['species_info'])) {
                $si = $json['species_info'];
                $sizeStr = '';
                if (is_array($si['data_box']['body_length_mm'] ?? null)) {
                    $parts = [];
                    foreach ($si['data_box']['body_length_mm'] as $sex => $val) {
                        $parts[] = "{$sex}: {$val}";
                    }
                    $sizeStr = implode(', ', $parts);
                }
                $distStr = is_array($si['data_box']['distribution'] ?? null)
                    ? implode(', ', $si['data_box']['distribution'])
                    : ($si['data_box']['distribution'] ?? '');
                $habitatStr = is_array($si['data_box']['habitat'] ?? null)
                    ? implode(', ', $si['data_box']['habitat'])
                    : '';
                $callouts = [];
                foreach (($json['visual_features']['callouts'] ?? []) as $c) {
                    $callouts[] = ($c['number'] ?? '') . ': ' . ($c['text'] ?? '');
                }
                $rawEntries[] = [
                    'japanese_name' => $si['name_ja'] ?? null,
                    'scientific_name' => $si['scientific_name'] ?? null,
                    'family' => null,
                    'description' => $habitatStr ? "生息地: {$habitatStr}" : '',
                    'data_icons' => [
                        'size' => $sizeStr,
                        'season' => '',
                        'distribution' => $distStr
                    ],
                    'photos' => array_map(function ($s) {
                        return $s['label'] ?? '';
                    }, $json['visual_features']['specimens'] ?? []),
                    'figures' => $callouts,
                ];
            }
            // Also extract from text_content.items (VISUAL_LIST pages)
            if (isset($json['text_content']['items'])) {
                foreach ($json['text_content']['items'] as $item) {
                    $rawEntries[] = [
                        'name' => $item['name'] ?? null,
                        'scientific_name' => null,
                        'description' => '',
                    ];
                }
            }
            break;

        case 'magazine':
            // Schema D: インセクタリゥム — articles[], no species_entries
            // Magazine articles don't have structured species data
            break;

        case 'v8_universal':
            // Schema E: V8 Protocol — species_entries at root, with visual_features
            $rawEntries = $json['species_entries'] ?? [];
            // Enrich entries with visual_features if present
            foreach ($rawEntries as &$re) {
                $re['visual_features'] = $re['visual_features'] ?? [];
            }
            unset($re);
            break;

        case 'v9_archive_fusion':
            // Schema F: V9 Protocol (100-Year Sustainability)
            // species_entries at root with darwin_core, microhabitats,
            // substrate_tags, distribution_text, phenology_text
            $rawEntries = $json['species_entries'] ?? [];
            foreach ($rawEntries as &$re) {
                // Map darwin_core fields to normalized names
                $dc = $re['darwin_core'] ?? [];
                $re['scientific_name'] = $re['scientific_name'] ?? ($dc['scientificName'] ?? null);
                $re['japanese_name']   = $re['japanese_name'] ?? ($dc['vernacularName'] ?? null);
                $re['visual_features'] = $re['visual_features'] ?? [];
            }
            unset($re);
            break;

        default:
            // Fallback: try both locations
            $rawEntries = $json['species_entries']
                ?? $json['text_content']['species_entries']
                ?? [];
            break;
    }

    foreach ($rawEntries as $raw) {
        $entry = [
            // Name normalization: absorb name / japanese_name variance
            'jp_name'     => $raw['japanese_name'] ?? $raw['name'] ?? 'Unknown',
            'sci_name'    => $raw['scientific_name'] ?? null,
            'description' => $raw['description'] ?? ($raw['narrative_text'] ?? ''),
            'family'      => $raw['family'] ?? null,
            'page_type'   => $pageType,

            // Data Icons (size, season, distribution)
            'data_icons'  => normalizeDataIcons($raw, $schema),

            // Photos / Figures
            'photos'      => $raw['photos'] ?? [],
            'figures'     => $raw['figures'] ?? [],

            // Handbook-specific fields
            'rarity_stars' => $raw['rarity_stars'] ?? null,

            // V9 Archive Fusion fields (100-Year Sustainability)
            'microhabitats'     => $raw['microhabitats'] ?? [],
            'substrate_tags'    => $raw['substrate_tags'] ?? [],
            'distribution_text' => $raw['distribution_text'] ?? null,
            'phenology_text'    => $raw['phenology_text'] ?? null,
        ];

        $entries[] = $entry;
    }

    return $entries;
}

/**
 * Normalize data_icons across different schemas
 */
function normalizeDataIcons($raw, $schema)
{
    switch ($schema) {
        case 'genshoku':
            // Schema A: data_icons is an object { size, season, distribution }
            return $raw['data_icons'] ?? null;

        case 'handbook':
            // Schema B: size, season, distribution are top-level fields
            if (isset($raw['size']) || isset($raw['season']) || isset($raw['distribution'])) {
                $sizeStr = '';
                if (is_array($raw['size'] ?? null)) {
                    // { female: "12〜20mm", male: "10〜15mm" }
                    $parts = [];
                    foreach ($raw['size'] as $sex => $val) {
                        $parts[] = "{$sex}: {$val}";
                    }
                    $sizeStr = implode(', ', $parts);
                } else {
                    $sizeStr = $raw['size'] ?? '';
                }
                return [
                    'size'         => $sizeStr,
                    'season'       => $raw['season'] ?? '',
                    'distribution' => $raw['distribution'] ?? '',
                ];
            }
            return null;

        default:
            return $raw['data_icons'] ?? null;
    }
}

// ============================================================
// Main Ingestion Loop
// ============================================================

$totalKeys = 0;
$totalCitations = 0;
$totalGbifHits = 0;

foreach ($BOOK_REGISTRY as $bookMeta) {
    $bookDir = $bookMeta['dir'];
    $bookId = $bookMeta['id'];
    $schema = $bookMeta['schema'];

    echo "\n" . str_repeat('=', 60) . "\n";
    echo "Processing: {$bookMeta['title']} (schema: {$schema})\n";
    echo "Directory: {$bookDir}\n";

    if (!is_dir($bookDir)) {
        echo "[SKIP] Directory not found.\n";
        continue;
    }

    // Register Book Reference
    $refData = $bookMeta;
    unset($refData['dir'], $refData['schema']);
    DataStore::save("library/references/{$bookId}", $refData);
    echo "Book Reference Saved.\n";

    // Scan JSON files
    $files = glob($bookDir . '/*.json');
    echo "Found " . count($files) . " JSON files.\n";

    $bookKeys = 0;
    $bookCitations = 0;

    foreach ($files as $file) {
        $json = json_decode(file_get_contents($file), true);
        if (!$json) continue;

        $filename = basename($file);

        // Extract page number from filename
        if (preg_match('/Page(\d+)/', $filename, $matches)) {
            $page = (int)$matches[1];
        } else {
            $page = 0;
        }

        // Extract normalized entries via adapter
        $entries = extractEntries($json, $schema);

        foreach ($entries as $entry) {
            $jpName  = $entry['jp_name'];
            $sciName = $entry['sci_name'];
            $desc    = $entry['description'];

            // -----------------------------------------------
            // A. Detect & Save Identification Keys (検索表)
            // -----------------------------------------------
            if (mb_strpos($desc, '検索表') !== false || mb_strpos($desc, 'Key to') !== false) {
                $keyId = "key_{$bookId}_p{$page}_" . md5($jpName);
                $keyData = [
                    'id'           => $keyId,
                    'book_id'      => $bookId,
                    'page'         => $page,
                    'title'        => "Key found in: {$jpName}",
                    'target_taxon' => $sciName ?? $jpName,
                    'content_raw'  => $desc,
                    'type'         => 'raw_text'
                ];
                DataStore::save("library/keys/{$keyId}", $keyData);
                $bookKeys++;
                echo "  [KEY] P.{$page}: {$jpName}\n";
            }

            // -----------------------------------------------
            // B. Index Species Citation (Full Extraction)
            // -----------------------------------------------
            if ($sciName || $jpName !== 'Unknown') {
                $citId = "cit_{$bookId}_p{$page}_" . md5($jpName . $sciName);

                $citation = [
                    'id'              => $citId,
                    'book_id'         => $bookId,
                    'page'            => $page,
                    'taxon_name'      => $jpName,
                    'scientific_name' => $sciName,
                    'family'          => $entry['family'],
                    'data_icons'      => $entry['data_icons'],
                    'photos'          => $entry['photos'],
                    'figures'         => $entry['figures'],
                    'page_type'       => $entry['page_type'],
                    'rarity_stars'    => $entry['rarity_stars'],
                    'type'            => ($entry['page_type'] === 'VISUAL_PLATE') ? 'plate' : 'description',
                    // V9 Archive Fusion: 100-Year Sustainability data
                    'microhabitats'     => $entry['microhabitats'] ?: null,
                    'substrate_tags'    => $entry['substrate_tags'] ?: null,
                    'distribution_text' => $entry['distribution_text'],
                    'phenology_text'    => $entry['phenology_text'],
                    'dublin_core'       => [
                        'dc:source' => "{$bookId} (p.{$page})",
                        'dc:type' => 'Text',
                    ],
                    'darwin_core'       => [
                        'dwc:scientificName'   => $sciName,
                        'dwc:vernacularName'   => $jpName,
                        'dwc:occurrenceRemarks' => $desc ?? null,
                    ]
                ];

                // -----------------------------------------------
                // C. GBIF Enrichment (optional)
                // -----------------------------------------------
                if (!$skipGbif && $sciName) {
                    $gbif = GbifService::matchName($sciName);
                    if ($gbif && ($gbif['confidence'] ?? 0) >= 80) {
                        $citation['gbif_taxon_key']     = $gbif['taxon_key'];
                        $citation['gbif_status']        = $gbif['status'];
                        $citation['gbif_accepted_name'] = $gbif['accepted_name'];
                        $citation['gbif_accepted_key']  = $gbif['accepted_key'];
                        $citation['gbif_family']        = $gbif['family'];
                        $citation['gbif_match_type']    = $gbif['match_type'];

                        // Add DwC terms
                        $citation['darwin_core']['dwc:taxonConceptID']  = "gbif:{$gbif['taxon_key']}";
                        $citation['darwin_core']['dwc:taxonomicStatus'] = $gbif['status'];
                        $citation['darwin_core']['dwc:scientificName']  = $gbif['accepted_name'] ?? $sciName;
                        $citation['darwin_core']['dwc:originalNameUsage'] = $sciName; // Name as it appears in this specific historical text
                        $citation['darwin_core']['dwc:family']          = $gbif['family'];
                        $citation['darwin_core']['dwc:nameAccordingTo'] = $bookId; // Anchor the taxonomy to the specific book's publication

                        $totalGbifHits++;
                    }
                }

                // Add Geographic references for stability (Topography might change over 100 years, but the text remains)
                if (!empty($entry['distribution_text'])) {
                    $citation['darwin_core']['dwc:locality'] = mb_substr($entry['distribution_text'], 0, 200);
                }

                DataStore::save("library/index/{$citId}", $citation);
                $bookCitations++;
            }
        }
    }

    echo "Book Complete: Keys={$bookKeys}, Citations={$bookCitations}\n";
    $totalKeys += $bookKeys;
    $totalCitations += $bookCitations;
}

echo "\n" . str_repeat('=', 60) . "\n";
echo "=== INGESTION V2 COMPLETE ===\n";
echo "Total Keys Extracted: {$totalKeys}\n";
echo "Total Species Citations: {$totalCitations}\n";
echo "Total GBIF Enriched: {$totalGbifHits}\n";
