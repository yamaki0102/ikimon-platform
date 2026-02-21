<?php

/**
 * PaperStore - Dedicated JSON Data Handler for Academic Papers
 * 
 * Uses the core DataStore logic but isolates records to `library/papers/`.
 */

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/Indexer.php';

class PaperStore
{
    /**
     * @var string The base directory for paper partitions
     */
    private static $resource = 'library/papers';

    /**
     * Get a specific paper by DOI or ID
     *
     * @param string $id
     * @param string $key e.g., 'doi' or 'id'
     * @return array|null
     */
    public static function findById($id, $key = 'doi')
    {
        return DataStore::findById(self::$resource, $id, $key);
    }

    /**
     * Append a new paper to the current month's partition
     *
     * @param array $paperData
     * @param int|null $timestamp Optional timestamp to force a specific partition
     * @return bool
     */
    public static function append($paperData, $timestamp = null)
    {
        // Ensure standard fields exist
        if (!isset($paperData['ingested_at'])) {
            $paperData['ingested_at'] = date('Y-m-d H:i:s');
        }

        return DataStore::append(self::$resource, $paperData, $timestamp);
    }

    /**
     * Fetch all papers (WARNING: Memory intensive, use for backgrounds jobs only)
     *
     * @return array
     */
    public static function fetchAll()
    {
        return DataStore::fetchAll(self::$resource);
    }

    /**
     * Updates an existing paper record
     */
    public static function upsert($paperData, $key = 'doi')
    {
        // DataStore upsert handles partitions if Indexer is working,
        // otherwise relies on fallback scanning.
        return DataStore::upsert(self::$resource, $paperData, $key);
    }

    /**
     * Get the latest papers added
     * 
     * @param int $limit
     * @return array
     */
    public static function getLatest($limit = 10)
    {
        return DataStore::getLatest(self::$resource, $limit);
    }
}
