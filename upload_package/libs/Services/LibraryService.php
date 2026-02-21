<?php

require_once __DIR__ . '/../DataStore.php';

class LibraryService
{

    /**
     * Search for keys matching a query (e.g. "Turtle", "カメ")
     */
    public static function searchKeys($query)
    {
        $dir = DataStore::getBasePath() . '/library/keys';
        $matches = [];

        if (!is_dir($dir)) return [];

        $files = glob($dir . '/*.json');
        foreach ($files as $file) {
            $json = json_decode(file_get_contents($file), true);
            if (!$json) continue;

            // Simple search logic
            $haystack = ($json['target_taxon'] ?? '') . ' ' . ($json['title'] ?? '') . ' ' . ($json['content_raw'] ?? '');
            if (mb_stripos($haystack, $query) !== false) {
                // Add Book Info from reference store
                $book = DataStore::get("library/references/{$json['book_id']}");
                $json['book_title'] = $book['title'] ?? $json['book_id'];
                $matches[] = $json;
            }
        }
        return $matches;
    }

    public static function getKey($id)
    {
        return DataStore::get("library/keys/{$id}");
    }

    /**
     * Get a random key for "Daily Learning" or discovery
     */
    public static function getRandomKey()
    {
        $dir = DataStore::getBasePath() . '/library/keys';
        if (!is_dir($dir)) return null;

        $files = glob($dir . '/*.json');
        if (empty($files)) return null;

        $randomFile = $files[array_rand($files)];
        return json_decode(file_get_contents($randomFile), true);
    }

    /**
     * Get citations for a specific taxon name
     */
    public static function getCitations($taxonName)
    {
        $dir = DataStore::getBasePath() . '/library/index';

        if (!is_dir($dir)) return [];

        $files = glob($dir . '/*.json');
        $grouped = [];

        foreach ($files as $file) {
            $json = json_decode(file_get_contents($file), true);
            if (!$json) continue;

            // Loose match on name
            if (($json['taxon_name'] ?? '') === $taxonName || ($json['scientific_name'] ?? '') === $taxonName) {
                // Fetch book details
                $book = DataStore::get("library/references/{$json['book_id']}");
                $json['book_title'] = $book['title'] ?? $json['book_id'];
                $json['book_year'] = $book['year'] ?? '';

                $groupKey = ($json['book_id'] ?? '') . '|' . ($json['page'] ?? '') . '|' . ($json['taxon_name'] ?? '');

                if (!isset($grouped[$groupKey])) {
                    $grouped[$groupKey] = $json;
                } else {
                    $existing = $grouped[$groupKey];
                    // Compare richness of metadata
                    $existingScore = count($existing['data_icons'] ?? []) + (!empty($existing['gbif_status']) ? 1 : 0) + count($existing['darwin_core'] ?? []) + count($existing['dublin_core'] ?? []);
                    $newScore = count($json['data_icons'] ?? []) + (!empty($json['gbif_status']) ? 1 : 0) + count($json['darwin_core'] ?? []) + count($json['dublin_core'] ?? []);

                    if ($newScore > $existingScore) {
                        $grouped[$groupKey] = $json;
                    } else if ($newScore === $existingScore) {
                        // Merge photos if equally rich
                        $mergedPhotos = array_unique(array_merge($existing['photos'] ?? [], $json['photos'] ?? []));
                        if (!empty($mergedPhotos)) {
                            $grouped[$groupKey]['photos'] = array_values($mergedPhotos);
                        }
                    } else {
                        // Keep existing, but merge photos
                        $mergedPhotos = array_unique(array_merge($existing['photos'] ?? [], $json['photos'] ?? []));
                        if (!empty($mergedPhotos)) {
                            $grouped[$groupKey]['photos'] = array_values($mergedPhotos);
                        }
                    }
                }
            }
        }
        return array_values($grouped);
    }

    /**
     * Get academic papers linked to a taxon (via scientific name or query label)
     */
    public static function getPapersForTaxon($taxonName)
    {
        $dir = DataStore::getBasePath() . '/library/paper_taxa';
        $papers = [];
        $seenDoi = [];

        if (!is_dir($dir)) return [];

        $files = glob($dir . '/*.json');
        foreach ($files as $file) {
            $link = json_decode(file_get_contents($file), true);
            if (!$link) continue;

            // Match by scientific name, jp_name, or by query_label containing taxon name
            $sciMatch = ($link['scientific_name'] ?? '') === $taxonName;
            $jpMatch = ($link['jp_name'] ?? '') === $taxonName;
            $labelMatch = mb_stripos($link['query_label'] ?? '', $taxonName) !== false;

            if ($sciMatch || $jpMatch || $labelMatch) {
                // Avoid duplicates by DOI
                $doi = $link['doi'] ?? '';
                if (isset($seenDoi[$doi])) continue;
                $seenDoi[$doi] = true;

                // Fetch full paper metadata
                $paperId = $link['paper_id'] ?? '';
                $paper = DataStore::get("library/papers/{$paperId}");
                if ($paper) {
                    $paper['link_scientific_name'] = $link['scientific_name'] ?? '';
                    $paper['gbif_taxon_key'] = $link['gbif_taxon_key'] ?? null;
                    if (isset($link['darwin_core'])) {
                        $paper['darwin_core'] = $link['darwin_core'];
                    }
                    $papers[] = $paper;
                }
            }
        }

        // Sort by year descending
        usort($papers, function ($a, $b) {
            return ($b['year'] ?? 0) - ($a['year'] ?? 0);
        });

        return $papers;
    }
    /**
     * Get distilled ecological constraints and identification keys for a taxon
     * Currently fetches approved distillations based on DOIs linked to the scientific name
     */
    public static function getDistilledKnowledgeForTaxon($scientificName)
    {
        require_once __DIR__ . '/../TaxonPaperIndex.php';

        $dois = TaxonPaperIndex::getPapersForTaxon($scientificName);
        if (empty($dois)) return [];

        $distilledStore = DataStore::get('library/distilled_knowledge', 0) ?: [];
        $results = [];

        foreach ($dois as $doi) {
            if (isset($distilledStore[$doi])) {
                $item = $distilledStore[$doi];
                // Only return approved knowledge
                if (($item['review_status'] ?? '') === 'approved' || ($item['status'] ?? '') === 'distilled') {
                    // For PoC, allow pending as well if strict approval isn't mandated yet.
                    // Ideal: if ($item['review_status'] === 'approved')
                    $results[] = $item['data'];
                }
            }
        }

        // Merge results if multiple papers exist (simple array merge for PoC)
        $merged = [
            'ecological_constraints' => ['habitat' => [], 'altitude_range' => [], 'active_season' => [], 'notes' => []],
            'identification_keys' => []
        ];

        foreach ($results as $res) {
            if (!empty($res['ecological_constraints'])) {
                $ec = $res['ecological_constraints'];
                if (!empty($ec['habitat'])) $merged['ecological_constraints']['habitat'] = array_merge($merged['ecological_constraints']['habitat'], (array)$ec['habitat']);
                if (!empty($ec['altitude_range'])) $merged['ecological_constraints']['altitude_range'][] = $ec['altitude_range'];
                if (!empty($ec['active_season'])) $merged['ecological_constraints']['active_season'] = array_merge($merged['ecological_constraints']['active_season'], (array)$ec['active_season']);
                if (!empty($ec['notes'])) $merged['ecological_constraints']['notes'][] = $ec['notes'];
            }
            if (!empty($res['identification_keys'])) {
                $merged['identification_keys'] = array_merge($merged['identification_keys'], $res['identification_keys']);
            }
        }

        // Clean up arrays
        $merged['ecological_constraints']['habitat'] = array_unique(array_filter($merged['ecological_constraints']['habitat']));
        $merged['ecological_constraints']['altitude_range'] = array_unique(array_filter($merged['ecological_constraints']['altitude_range']));
        $merged['ecological_constraints']['active_season'] = array_unique(array_filter($merged['ecological_constraints']['active_season']));
        $merged['ecological_constraints']['notes'] = array_unique(array_filter($merged['ecological_constraints']['notes']));

        return $merged;
    }
}
