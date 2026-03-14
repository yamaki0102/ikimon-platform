<?php

/**
 * DataStore - Scalable JSON Data Handler
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/Cache.php';
require_once __DIR__ . '/Indexer.php';

class DataStore
{
    private static $base_path = DATA_DIR;

    public static function setPath($path)
    {
        self::$base_path = $path;
    }

    public static function getBasePath()
    {
        return self::$base_path;
    }

    public static function get($file, $ttl = 3600)
    {
        // Try cache first
        $cached = Cache::get($file, $ttl);
        if ($cached !== null) return $cached;

        $path = self::$base_path . '/' . $file . '.json';
        if (!file_exists($path)) {
            return [];
        }
        $content = file_get_contents($path);
        $data = json_decode($content, true) ?: [];

        // Save to cache
        Cache::set($file, $data, $ttl);

        return $data;
    }

    public static function save($file, $data)
    {
        $path = self::$base_path . '/' . $file . '.json';
        $dir = dirname($path);
        if (!file_exists($dir)) {
            mkdir($dir, 0777, true);
        }

        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        // Invalidate cache
        Cache::clear($file);

        return file_put_contents($path, $json, LOCK_EX);
    }

    // High-performance append for large datasets (e.g. observations)
    public static function append($resource, $item, $timestamp = null)
    {
        $date = $timestamp ? date('Y-m', $timestamp) : date('Y-m');
        $file = "{$resource}/{$date}";
        $dir = self::$base_path . '/' . $resource;

        if (!file_exists($dir)) mkdir($dir, 0777, true);

        $path = self::$base_path . '/' . $file . '.json';

        // Robust Read-Modify-Write with flock
        $fp = fopen($path, 'c+'); // Open for read/write, create if not exists
        if (flock($fp, LOCK_EX)) {
            // Read current contents
            $filesize = filesize($path);
            $content = $filesize > 0 ? fread($fp, $filesize) : '';
            $data = json_decode($content, true) ?: [];

            // Modify
            $data[] = $item;
            $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

            // Write back
            ftruncate($fp, 0); // Clear file
            rewind($fp);      // Reset pointer
            fwrite($fp, $json);
            fflush($fp);

            // Release lock
            flock($fp, LOCK_UN);
        } else {
            // Fallback (extremely unlikely unless filesystem does not support locking)
            $data = self::get($file, 60);
            $data[] = $item;
            self::save($file, $data);
        }
        fclose($fp);

        // Invalidate cache immediately since data has changed
        Cache::clear($file);

        // Update Index
        if (isset($item['id'])) {
            Indexer::addToIndex("{$resource}_index", $item['id'], $file);
        }
        // User Index
        if (isset($item['user_id'])) {
            Indexer::addToIndex("user_{$item['user_id']}_{$resource}", $date, $item['id']);
        }

        return true;
    }

    public static function findById($file, $id, $key = 'id')
    {
        // 1. Check Index first
        $index = Indexer::getFromIndex("{$file}_index", $id);
        if (!empty($index)) {
            $targetFile = $index[0];
            $data = self::get($targetFile);
            foreach ($data as $item) {
                if (isset($item[$key]) && $item[$key] == $id) return $item;
            }
        }

        // 2. Check Legacy Main File
        $data = self::get($file);
        foreach ($data as $item) {
            if (isset($item[$key]) && $item[$key] == $id) return $item;
        }

        // 3. Fallback: Scan Partitions (Newest First) if not found yet
        // This is crucial if Index is out of sync or missing
        $dir = self::$base_path . '/' . $file;
        if (is_dir($dir)) {
            $files = glob($dir . '/*.json');
            rsort($files); // Newest first
            foreach ($files as $p_file) {
                $p_data = json_decode(file_get_contents($p_file), true) ?: [];
                foreach ($p_data as $item) {
                    if (isset($item[$key]) && $item[$key] == $id) {
                        // Optionally repair index here
                        Indexer::addToIndex("{$file}_index", $id, basename($p_file, '.json') ? ($file . '/' . basename($p_file, '.json')) : $file);
                        return $item;
                    }
                }
            }
        }

        return null;
    }

    public static function upsert($file, $item, $key = 'id')
    {
        // Note: For large datasets, upsert is expensive. Use append if possible.
        // Check if this is a partitioned resource
        $id = $item[$key] ?? null;
        if ($id) {
            $index = Indexer::getFromIndex("{$file}_index", $id);
            if (!empty($index)) {
                $targetFile = $index[0]; // e.g. "observations/2025-01"
                // Load, Update, Save Target
                $data = self::get($targetFile);
                $found = false;
                foreach ($data as $i => $existing) {
                    if (isset($existing[$key]) && $existing[$key] == $id) {
                        $data[$i] = array_merge($existing, $item);
                        $found = true;
                        break;
                    }
                }
                if ($found) {
                    return self::save($targetFile, $data);
                }
            }
        }

        $data = self::get($file);
        $found = false;
        foreach ($data as $i => $existing) {
            if (isset($existing[$key]) && isset($item[$key]) && $existing[$key] == $item[$key]) {
                $data[$i] = array_merge($existing, $item);
                $found = true;
                break;
            }
        }
        if (!$found) {
            $data[] = $item;
        }
        return self::save($file, $data);
    }

    // Generic Caching Wrapper for Expensive Computations (e.g. Ranking, Stats)
    public static function getCached($key, $ttl, $callback)
    {
        $cached = Cache::get($key, $ttl);
        if ($cached !== null) return $cached;

        $data = $callback();
        Cache::set($key, $data, $ttl);
        return $data;
    }

    // Partition-aware Fetch All (Merges all monthly files)
    // WARNING: Memory intensive. Use only in cached callbacks or background jobs.
    public static function fetchAll($resource)
    {
        // 1. Try legacy single file
        $legacy = self::get($resource);

        // 2. Scan partition directory
        $dir = self::$base_path . '/' . $resource;
        $partitions = [];
        if (is_dir($dir)) {
            $files = glob($dir . '/*.json');
            foreach ($files as $file) {
                $json = json_decode(file_get_contents($file), true) ?: [];
                $partitions = array_merge($partitions, $json);
            }
        }

        $merged = array_merge($legacy, $partitions);
        $unique = [];
        foreach ($merged as $item) {
            if (isset($item['id'])) {
                $unique[$item['id']] = $item;
            } else {
                $unique[] = $item;
            }
        }
        return array_values($unique);
    }

    // Partition-aware Get Latest
    public static function getLatest($resource, $limit = 10, $filter = null)
    {
        $results = [];
        $seenIds = [];

        // 1. Check Index for rapid retrieval (if available) - TODO in Phase 4

        // 2. Check Partitions (Newest to Oldest)
        $dir = self::$base_path . '/' . $resource;
        if (is_dir($dir)) {
            $files = glob($dir . '/*.json');
            rsort($files); // Newest files first (e.g. 2025-12.json before 2025-01.json)

            foreach ($files as $file) {
                $items = json_decode(file_get_contents($file), true) ?: [];
                // Items in partition are usually appended (oldest -> newest), so reverse
                $items = array_reverse($items);

                foreach ($items as $item) {
                    if ($filter && !$filter($item)) continue;
                    $itemId = $item['id'] ?? null;
                    if ($itemId !== null && isset($seenIds[$itemId])) continue;
                    $results[] = $item;
                    if ($itemId !== null) $seenIds[$itemId] = true;
                    if (count($results) >= $limit) break 2;
                }
            }
        }

        // 3. If not enough, check legacy
        if (count($results) < $limit) {
            $legacy = array_reverse(self::get($resource));
            foreach ($legacy as $item) {
                if ($filter && !$filter($item)) continue;
                $itemId = $item['id'] ?? null;
                if ($itemId !== null && isset($seenIds[$itemId])) continue;
                $results[] = $item;
                if ($itemId !== null) $seenIds[$itemId] = true;
                if (count($results) >= $limit) break;
            }
        }

        return $results;
    }
    // Lightweight Counter Increment (e.g. views, likes)
    // Stores counts in a separate simple key-value file to avoid heavy json parsing
    public static function increment($resource, $id, $field = 'views')
    {
        $dir = self::$base_path . '/counts/' . $resource;
        if (!file_exists($dir)) mkdir($dir, 0777, true);

        $file = $dir . '/' . $id . '.json';
        $data = [];

        // Robust Read-Modify-Write with flock
        $fp = fopen($file, 'c+');
        if (flock($fp, LOCK_EX)) {
            $filesize = filesize($file);
            $content = $filesize > 0 ? fread($fp, $filesize) : '';
            $data = json_decode($content, true) ?: [];

            if (!isset($data[$field])) $data[$field] = 0;
            $data[$field]++;

            $json = json_encode($data, JSON_UNESCAPED_UNICODE);

            ftruncate($fp, 0);
            rewind($fp);
            fwrite($fp, $json);
            fflush($fp);

            flock($fp, LOCK_UN);
        } else {
            // Fallback
            if (file_exists($file)) {
                $data = json_decode(file_get_contents($file), true) ?: [];
            }
            if (!isset($data[$field])) $data[$field] = 0;
            $data[$field]++;
            file_put_contents($file, json_encode($data), LOCK_EX);
        }
        fclose($fp);

        return $data[$field];
    }

    // Get Counts
    public static function getCounts($resource, $id)
    {
        $file = self::$base_path . '/counts/' . $resource . '/' . $id . '.json';
        if (file_exists($file)) {
            return json_decode(file_get_contents($file), true) ?: [];
        }
        return [];
    }
}
