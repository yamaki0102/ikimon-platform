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
        $citations = [];

        if (!is_dir($dir)) return [];

        $files = glob($dir . '/*.json');
        foreach ($files as $file) {
            $json = json_decode(file_get_contents($file), true);
            if (!$json) continue;

            // Loose match on name
            if (($json['taxon_name'] ?? '') === $taxonName || ($json['scientific_name'] ?? '') === $taxonName) {
                // Fetch book details
                $book = DataStore::get("library/references/{$json['book_id']}");
                $json['book_title'] = $book['title'] ?? $json['book_id'];
                $citations[] = $json;
            }
        }
        return $citations;
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
}
