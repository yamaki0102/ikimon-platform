<?php

/**
 * EmbeddingStore - JSON file-based vector store for ikimon.life
 *
 * Stores embedding vectors alongside metadata in flat JSON files.
 * Supports brute-force cosine similarity search (optimal for < 10K vectors).
 *
 * Storage: data/embeddings/{type}.json
 * Types: observations, photos, papers, taxons, omoikane
 */

require_once __DIR__ . '/../config/config.php';

class EmbeddingStore
{
    private const BASE_DIR = 'embeddings';
    private const ROUND_PRECISION = 6; // decimal places for vector values

    /** In-memory cache for loaded vector files (per-request) */
    private static array $cache = [];

    // ─── CRUD Operations ────────────────────────────────────────

    /**
     * Save an embedding vector.
     */
    public static function save(string $type, string $id, array $vector, array $meta = []): void
    {
        $store = self::loadStore($type);

        // Round vector values to reduce JSON size
        $rounded = array_map(fn($v) => round($v, self::ROUND_PRECISION), $vector);

        $store['vectors'][$id] = array_merge([
            'v' => $rounded,
            'updated_at' => date('c'),
        ], $meta);

        self::saveStore($type, $store);
    }

    /**
     * Get a single embedding entry by ID.
     */
    public static function get(string $type, string $id): ?array
    {
        $store = self::loadStore($type);
        return $store['vectors'][$id] ?? null;
    }

    /**
     * Check if an embedding exists (optionally: updated after a given timestamp).
     */
    public static function exists(string $type, string $id, ?string $updatedAfter = null): bool
    {
        $entry = self::get($type, $id);
        if (!$entry) return false;
        if ($updatedAfter && isset($entry['updated_at'])) {
            return strtotime($entry['updated_at']) >= strtotime($updatedAfter);
        }
        return true;
    }

    /**
     * Delete an embedding.
     */
    public static function delete(string $type, string $id): void
    {
        $store = self::loadStore($type);
        unset($store['vectors'][$id]);
        self::saveStore($type, $store);
    }

    /**
     * Count vectors in a store.
     */
    public static function count(string $type): int
    {
        $store = self::loadStore($type);
        return count($store['vectors'] ?? []);
    }

    // ─── Search ─────────────────────────────────────────────────

    /**
     * Search for top-K most similar vectors using cosine similarity.
     * Returns [['id' => string, 'score' => float, ...meta], ...]
     */
    public static function search(array $queryVector, string $type, int $topK = 10, float $minScore = 0.3): array
    {
        $store = self::loadStore($type);
        $vectors = $store['vectors'] ?? [];

        if (empty($vectors)) return [];

        $results = [];
        $queryNorm = self::norm($queryVector);
        if ($queryNorm == 0) return [];

        foreach ($vectors as $id => $entry) {
            $v = $entry['v'] ?? null;
            if (!is_array($v)) continue;

            $score = self::cosineSimilarityFast($queryVector, $v, $queryNorm);
            if ($score >= $minScore) {
                $results[] = [
                    'id' => $id,
                    'score' => round($score, 4),
                    'mode' => $entry['mode'] ?? 'unknown',
                    'text' => $entry['text'] ?? '',
                ];
            }
        }

        // Sort by score descending
        usort($results, fn($a, $b) => $b['score'] <=> $a['score']);

        return array_slice($results, 0, $topK);
    }

    /**
     * Find similar items to an existing vector in the store.
     * Convenience wrapper: looks up the vector by ID, then searches.
     */
    public static function findSimilar(string $type, string $id, int $topK = 5, float $minScore = 0.3): array
    {
        $entry = self::get($type, $id);
        if (!$entry || empty($entry['v'])) return [];

        $results = self::search($entry['v'], $type, $topK + 1, $minScore);

        // Exclude self
        return array_values(array_filter($results, fn($r) => $r['id'] !== $id));
    }

    // ─── Math ───────────────────────────────────────────────────

    /**
     * Cosine similarity with pre-computed query norm.
     */
    private static function cosineSimilarityFast(array $a, array $b, float $aNorm): float
    {
        $dot = 0.0;
        $bNormSq = 0.0;
        $len = min(count($a), count($b));

        for ($i = 0; $i < $len; $i++) {
            $dot += $a[$i] * $b[$i];
            $bNormSq += $b[$i] * $b[$i];
        }

        $bNorm = sqrt($bNormSq);
        if ($bNorm == 0) return 0.0;

        return $dot / ($aNorm * $bNorm);
    }

    /**
     * Euclidean norm of a vector.
     */
    private static function norm(array $v): float
    {
        $sum = 0.0;
        foreach ($v as $val) {
            $sum += $val * $val;
        }
        return sqrt($sum);
    }

    // ─── File I/O ───────────────────────────────────────────────

    /**
     * Load a vector store file.
     */
    private static function loadStore(string $type): array
    {
        if (isset(self::$cache[$type])) {
            return self::$cache[$type];
        }

        $path = self::storePath($type);
        if (!file_exists($path)) {
            $store = [
                'meta' => [
                    'model' => 'gemini-embedding-2-preview',
                    'dimensions' => EmbeddingService::getDimensions(),
                    'created_at' => date('c'),
                ],
                'vectors' => [],
            ];
            self::$cache[$type] = $store;
            return $store;
        }

        $content = file_get_contents($path);
        $store = json_decode($content, true) ?: ['meta' => [], 'vectors' => []];
        self::$cache[$type] = $store;
        return $store;
    }

    /**
     * Save a vector store file (with flock).
     */
    private static function saveStore(string $type, array $store): void
    {
        $path = self::storePath($type);
        $dir = dirname($path);
        if (!file_exists($dir)) {
            mkdir($dir, 0777, true);
        }

        $store['meta']['updated_at'] = date('c');
        $json = json_encode($store, JSON_UNESCAPED_UNICODE);

        file_put_contents($path, $json, LOCK_EX);

        // Update cache
        self::$cache[$type] = $store;
    }

    /**
     * Get the file path for a store type.
     */
    private static function storePath(string $type): string
    {
        return DATA_DIR . '/' . self::BASE_DIR . '/' . $type . '.json';
    }

    /**
     * Clear in-memory cache (useful for long-running scripts).
     */
    public static function clearCache(): void
    {
        self::$cache = [];
    }
}
