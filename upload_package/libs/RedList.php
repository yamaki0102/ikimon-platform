<?php
/**
 * RedList - Logic for checking endangered status
 * Supports Global (IUCN), National (MOE), and Local (Pref/City) lists.
 * NOW INCLUDES: Rosetta Stone Taxon Mapping
 */

class RedList {
    private static $mapping_file = 'redlist_mapping';
    private static $severity_order = ['CR' => 5, 'EN' => 4, 'VU' => 3, 'NT' => 2, 'DD' => 1, 'LC' => 0];
    private static $mapping_data = null;

    public static function check($taxon_key) {
        if (self::$mapping_data === null) {
            // Load the generated mapping file
            self::$mapping_data = DataStore::get(self::$mapping_file);
        }

        // 1. Direct Lookup by GBIF Key
        if (isset(self::$mapping_data[$taxon_key])) {
            return self::$mapping_data[$taxon_key];
        }

        // 2. Original fallback? No, we trust the mapping file.
        // If not in mapping, it's not on the maintained Red List.
        return null;
    }

    /**
     * Get the highest severity category code across all lists.
     * Used for location obscuring logic.
     */
    public static function getCategory($taxon_key) {
        $item = self::check($taxon_key);
        if (!$item || !isset($item['ranks'])) {
            return null;
        }

        $highest_score = -1;
        $highest_cat = null;

        foreach ($item['ranks'] as $scope => $data) {
            $code = $data['code'];
            $score = self::$severity_order[$code] ?? 0;
            if ($score > $highest_score) {
                $highest_score = $score;
                $highest_cat = $code;
            }
        }

        return $highest_cat;
    }
}
