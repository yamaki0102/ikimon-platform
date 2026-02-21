<?php

/**
 * TaxonPaperIndex - fast lookup mapping between scientific names and paper DOIs
 */

require_once __DIR__ . '/DataStore.php';

class TaxonPaperIndex
{
    private static $resource = 'library/taxon_paper_index';

    /**
     * Get the full index array
     * keys are lowercased scientific names, values are arrays of DOIs
     */
    public static function getIndex()
    {
        return DataStore::get(self::$resource, 0) ?: [];
    }

    /**
     * Save the entire index
     */
    public static function saveIndex($index)
    {
        return DataStore::save(self::$resource, $index);
    }

    /**
     * Add a single mapping (writes to disk immediately - use saveIndex for batching)
     */
    public static function add($scientificName, $doi)
    {
        $index = self::getIndex();
        $key = strtolower(trim($scientificName));
        if (!isset($index[$key])) {
            $index[$key] = [];
        }
        if (!in_array($doi, $index[$key])) {
            $index[$key][] = $doi;
            self::saveIndex($index);
        }
    }

    /**
     * Retrieve paper DOIs for a given taxon
     */
    public static function getPapersForTaxon($scientificName)
    {
        $index = self::getIndex();
        $key = strtolower(trim($scientificName));
        return $index[$key] ?? [];
    }
}
