<?php

require_once __DIR__ . '/../DataStore.php';

class LibraryService
{

    /**
     * Search for keys matching a query (e.g. "Turtle", "カメ")
     */
    public static function searchKeys($query)
    {
        if (empty($query)) return [];

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
        if (empty($taxonName)) return [];

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
        if (empty($taxonName)) return [];

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
     * Get papers by source (BHL, Plazi, OpenAlex, etc.) using TaxonPaperIndex + PaperStore
     */
    public static function getIndexedPapers(string $scientificName, ?string $source = null): array
    {
        if (empty($scientificName)) return [];

        require_once __DIR__ . '/../TaxonPaperIndex.php';
        require_once __DIR__ . '/../PaperStore.php';
        require_once __DIR__ . '/../Indexer.php';

        $dois = TaxonPaperIndex::getPapersForTaxon($scientificName);
        $papers = [];
        $seenDoi = [];

        foreach ($dois as $doi) {
            if (isset($seenDoi[$doi])) continue;
            $seenDoi[$doi] = true;

            // Skip DOIs not in the PaperStore index — avoids expensive full-dir scan
            $indexEntry = Indexer::getFromIndex('library/papers_index', $doi);
            if (empty($indexEntry)) continue;

            $paper = PaperStore::findById($doi, 'doi');
            if (!$paper) continue;

            if ($source !== null && ($paper['source'] ?? '') !== $source) continue;

            $papers[] = $paper;
        }

        return $papers;
    }

    /**
     * Get J-GLOBAL search links for a taxon
     */
    public static function getJGlobalLinks(string $scientificName): array
    {
        if (empty($scientificName)) return [];

        require_once __DIR__ . '/../TaxonPaperIndex.php';

        $index = TaxonPaperIndex::getIndex();
        $key = strtolower(trim($scientificName)) . ':jglobal';

        return $index[$key] ?? [];
    }

    /**
     * Get Japanese research institutions from OpenAlex paper authorships
     */
    public static function getJapaneseInstitutions(string $scientificName): array
    {
        if (empty($scientificName)) return [];

        $papers = self::getIndexedPapers($scientificName, 'OpenAlex');
        $institutions = [];
        $seen = [];

        foreach ($papers as $paper) {
            foreach ($paper['institutions'] ?? [] as $inst) {
                if (($inst['country'] ?? '') === 'JP') {
                    $name = $inst['name'] ?? '';
                    if ($name && !isset($seen[$name])) {
                        $seen[$name] = true;
                        $institutions[] = $name;
                    }
                }
            }
        }

        return $institutions;
    }

    /**
     * Get distilled ecological constraints and identification keys for a taxon
     * Currently fetches approved distillations from the Omoikane SQLite database.
     */
    public static function getDistilledKnowledgeForTaxon($scientificName)
    {
        require_once __DIR__ . '/../OmoikaneDB.php';

        $merged = [
            'ecological_constraints' => ['habitat' => [], 'altitude_range' => [], 'active_season' => [], 'notes' => []],
            'identification_keys' => []
        ];

        try {
            $db = new OmoikaneDB();
            $pdo = $db->getPDO();

            $stmt = $pdo->prepare("
                SELECT e.habitat, e.altitude, e.season, e.notes,
                       i.morphological_traits, i.similar_species, i.key_differences
                FROM species s
                LEFT JOIN ecological_constraints e ON s.id = e.species_id
                LEFT JOIN identification_keys i ON s.id = i.species_id
                WHERE s.scientific_name = ? AND s.distillation_status = 'distilled'
            ");
            $stmt->execute([trim($scientificName)]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if ($row) {
                if (!empty($row['habitat'])) {
                    $merged['ecological_constraints']['habitat'] = array_map('trim', explode(',', $row['habitat']));
                }
                if (!empty($row['altitude'])) {
                    $merged['ecological_constraints']['altitude_range'][] = $row['altitude'];
                }
                if (!empty($row['season'])) {
                    $merged['ecological_constraints']['active_season'] = array_map('trim', explode(',', $row['season']));
                }
                if (!empty($row['notes'])) {
                    $merged['ecological_constraints']['notes'][] = $row['notes'];
                }

                if (!empty($row['morphological_traits'])) {
                    $merged['identification_keys']['morphological_traits'] = array_map('trim', explode("\n", $row['morphological_traits']));
                }
                if (!empty($row['similar_species'])) {
                    $merged['identification_keys']['similar_species'] = array_map('trim', explode(',', $row['similar_species']));
                }
                if (!empty($row['key_differences'])) {
                    $merged['identification_keys']['key_differences'] = array_map('trim', explode("\n", $row['key_differences']));
                }
            }
        } catch (Exception $e) {
            error_log("Failed to fetch from OmoikaneDB: " . $e->getMessage());
        }

        return $merged;
    }

    /**
     * Get museum specimen records for a taxon from GBIF occurrence data.
     */
    public static function getSpecimenRecords($scientificName)
    {
        if (empty($scientificName)) return [];

        require_once __DIR__ . '/../OmoikaneDB.php';

        try {
            $db = new OmoikaneDB();
            $pdo = $db->getPDO();

            $stmt = $pdo->prepare("
                SELECT sr.* FROM specimen_records sr
                JOIN species s ON sr.species_id = s.id
                WHERE s.scientific_name = ?
                ORDER BY sr.event_date DESC
                LIMIT 10
            ");
            $stmt->execute([trim($scientificName)]);
            return $stmt->fetchAll(PDO::FETCH_ASSOC);
        } catch (Exception $e) {
            error_log("Failed to fetch specimens: " . $e->getMessage());
            return [];
        }
    }
}
