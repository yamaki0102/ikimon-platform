<?php

/**
 * EmbeddingStore - Vector store for ikimon.life
 *
 * Stores embedding vectors alongside metadata.
 * Supports brute-force cosine similarity search (optimal for < 10K vectors).
 *
 * Storage backends:
 *   - JSON:   data/embeddings/{type}.json (default, human-readable)
 *   - Binary: data/embeddings/{type}.bin  (compact, quantization-aware)
 *
 * Types: observations, photos, papers, taxons, omoikane, species
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/VectorPacker.php';

class EmbeddingStore
{
    private const BASE_DIR = 'embeddings';
    private const ROUND_PRECISION = 6; // decimal places for vector values (JSON mode)

    /** Storage backend: 'json' (default), 'binary', or 'sqlite' */
    private static string $backend = 'json';

    /** Quantization format for binary/sqlite backend */
    private static string $quantFormat = VectorPacker::FORMAT_FLOAT32;

    /** SQLite PDO instance (lazy-initialized) */
    private static ?PDO $sqlitePdo = null;

    /** In-memory cache for loaded vector files (per-request) */
    private static array $cache = [];

    /** Pre-computed norms cache: type -> [id -> float] */
    private static array $normCache = [];

    // ─── Configuration ──────────────────────────────────────────

    /**
     * Set storage backend and quantization format.
     *
     * @param string $backend 'json' or 'binary'
     * @param string $format  VectorPacker::FORMAT_* (only for binary backend)
     */
    public static function configure(string $backend = 'json', string $format = VectorPacker::FORMAT_FLOAT32): void
    {
        self::$backend = $backend;
        self::$quantFormat = $format;
        self::clearCache();
    }

    /**
     * Get storage statistics for capacity planning.
     *
     * @return array{count: int, format: string, backend: string,
     *               bytes_per_vector: int, total_estimated_mb: float}
     */
    public static function stats(string $type): array
    {
        $count = self::count($type);
        $dim = 768;
        $bytesPerVector = self::$backend === 'binary'
            ? VectorPacker::estimateSize($dim, self::$quantFormat)
            : $dim * 8; // JSON: ~8 chars per float average

        return [
            'count' => $count,
            'format' => self::$backend === 'binary' ? self::$quantFormat : 'json',
            'backend' => self::$backend,
            'bytes_per_vector' => $bytesPerVector,
            'total_estimated_mb' => round($count * $bytesPerVector / 1048576, 2),
        ];
    }

    // ─── CRUD Operations ────────────────────────────────────────

    /**
     * Save an embedding vector.
     * Routes to SQLite backend when configured.
     */
    public static function save(string $type, string $id, array $vector, array $meta = []): void
    {
        // SQLite backend: quantize and store as BLOB
        if (self::$backend === 'sqlite') {
            self::saveSqlite($type, $id, $vector, $meta);
            return;
        }

        // JSON backend (default)
        $store = self::loadStore($type);

        // Round vector values to reduce JSON size
        $rounded = array_map(fn($v) => round($v, self::ROUND_PRECISION), $vector);

        $norm = VectorPacker::norm($rounded);

        $store['vectors'][$id] = array_merge([
            'v' => $rounded,
            'norm' => round($norm, 8),
            'updated_at' => date('c'),
        ], $meta);

        // Invalidate norm cache for this type
        unset(self::$normCache[$type]);

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
        if (self::$backend === 'sqlite') {
            return self::countSqlite($type);
        }
        $store = self::loadStore($type);
        return count($store['vectors'] ?? []);
    }

    // ─── Search ─────────────────────────────────────────────────

    /**
     * Search for top-K most similar vectors using cosine similarity.
     * Returns [['id' => string, 'score' => float, ...meta], ...]
     *
     * Uses pre-computed norms when available (O(n) dot products only).
     * Routes to SQLite backend when configured.
     */
    public static function search(array $queryVector, string $type, int $topK = 10, float $minScore = 0.3): array
    {
        if (self::$backend === 'sqlite') {
            return self::searchSqlite($queryVector, $type, $topK, $minScore);
        }

        $store = self::loadStore($type);
        $vectors = $store['vectors'] ?? [];

        if (empty($vectors)) return [];

        $results = [];
        $queryNorm = VectorPacker::norm($queryVector);
        if ($queryNorm == 0) return [];

        foreach ($vectors as $id => $entry) {
            $v = $entry['v'] ?? null;
            if (!is_array($v)) continue;

            // Use pre-stored norm if available, else compute
            $storedNorm = $entry['norm'] ?? null;

            $score = self::cosineSimilarityWithNorm($queryVector, $v, $queryNorm, $storedNorm);
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
     * Cosine similarity with pre-computed norms for both vectors.
     * When storedNorm is available, skips b's norm computation entirely.
     */
    private static function cosineSimilarityWithNorm(array $a, array $b, float $aNorm, ?float $storedNorm = null): float
    {
        $dot = 0.0;
        $bNormSq = 0.0;
        $len = min(count($a), count($b));

        if ($storedNorm !== null && $storedNorm > 0) {
            // Fast path: only compute dot product
            for ($i = 0; $i < $len; $i++) {
                $dot += $a[$i] * $b[$i];
            }
            return $dot / ($aNorm * $storedNorm);
        }

        // Fallback: compute b's norm inline
        for ($i = 0; $i < $len; $i++) {
            $dot += $a[$i] * $b[$i];
            $bNormSq += $b[$i] * $b[$i];
        }

        $bNorm = sqrt($bNormSq);
        if ($bNorm == 0) return 0.0;

        return $dot / ($aNorm * $bNorm);
    }

    /**
     * Cosine similarity with pre-computed query norm (legacy compatibility).
     */
    private static function cosineSimilarityFast(array $a, array $b, float $aNorm): float
    {
        return self::cosineSimilarityWithNorm($a, $b, $aNorm, null);
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
        self::$normCache = [];
    }

    // ─── Maintenance ─────────────────────────────────────────────

    /**
     * Backfill pre-computed norms for all vectors missing them.
     * Run once after upgrade, then norms are maintained on save().
     *
     * @return int Number of vectors updated
     */
    public static function backfillNorms(string $type): int
    {
        $store = self::loadStore($type);
        $updated = 0;

        foreach ($store['vectors'] as $id => &$entry) {
            if (isset($entry['norm'])) continue;
            $v = $entry['v'] ?? null;
            if (!is_array($v)) continue;

            $entry['norm'] = round(VectorPacker::norm($v), 8);
            $updated++;
        }
        unset($entry);

        if ($updated > 0) {
            self::saveStore($type, $store);
        }

        return $updated;
    }

    /**
     * Export store to binary format for migration/testing.
     *
     * @return string Path to the binary file
     */
    public static function exportBinary(string $type, string $format = VectorPacker::FORMAT_FLOAT16): string
    {
        $store = self::loadStore($type);
        $outPath = DATA_DIR . '/' . self::BASE_DIR . '/' . $type . '.bin';

        $entries = [];
        foreach ($store['vectors'] as $id => $entry) {
            $v = $entry['v'] ?? null;
            if (!is_array($v)) continue;

            $meta = $entry;
            unset($meta['v']);
            $entries[] = [
                'id' => $id,
                'packed' => base64_encode(VectorPacker::pack($v, $format)),
                'meta' => $meta,
            ];
        }

        $output = [
            'format' => $format,
            'dimensions' => 768,
            'count' => count($entries),
            'entries' => $entries,
        ];

        $dir = dirname($outPath);
        if (!file_exists($dir)) {
            mkdir($dir, 0777, true);
        }

        file_put_contents($outPath, json_encode($output, JSON_UNESCAPED_UNICODE), LOCK_EX);
        return $outPath;
    }

    // ─── SQLite Backend ─────────────────────────────────────────

    /**
     * Get or initialize the SQLite PDO for embedding storage.
     * Table: embeddings (type, id, vector_blob, norm, meta_json, updated_at)
     * 768-dim int8 = 782 bytes/vector vs 6KB+ in JSON → 7.5x compression
     */
    private static function getSqlitePdo(): PDO
    {
        if (self::$sqlitePdo !== null) return self::$sqlitePdo;

        $dbPath = DATA_DIR . '/embeddings/vectors.sqlite3';
        $dir = dirname($dbPath);
        if (!file_exists($dir)) mkdir($dir, 0777, true);

        $pdo = new PDO("sqlite:$dbPath", null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $pdo->exec('PRAGMA journal_mode=WAL');
        $pdo->exec('PRAGMA synchronous=NORMAL');
        $pdo->exec('PRAGMA busy_timeout=30000');

        $pdo->exec("CREATE TABLE IF NOT EXISTS embeddings (
            type TEXT NOT NULL,
            id TEXT NOT NULL,
            vector_blob BLOB NOT NULL,
            norm REAL NOT NULL,
            quant_format TEXT NOT NULL DEFAULT 'i8',
            meta_json TEXT DEFAULT '{}',
            updated_at TEXT NOT NULL,
            PRIMARY KEY (type, id)
        )");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_emb_type ON embeddings(type)");

        self::$sqlitePdo = $pdo;
        return $pdo;
    }

    /**
     * Save embedding to SQLite with quantization.
     */
    public static function saveSqlite(string $type, string $id, array $vector, array $meta = []): void
    {
        $pdo = self::getSqlitePdo();
        $format = self::$quantFormat;
        $blob = VectorPacker::pack($vector, $format);
        $norm = VectorPacker::norm($vector);

        $metaJson = json_encode($meta, JSON_UNESCAPED_UNICODE);
        $now = date('c');

        $stmt = $pdo->prepare(
            "INSERT OR REPLACE INTO embeddings (type, id, vector_blob, norm, quant_format, meta_json, updated_at)
             VALUES (:type, :id, :blob, :norm, :fmt, :meta, :now)"
        );
        $stmt->execute([
            ':type' => $type,
            ':id'   => $id,
            ':blob' => $blob,
            ':norm' => round($norm, 8),
            ':fmt'  => $format,
            ':meta' => $metaJson,
            ':now'  => $now,
        ]);
    }

    /**
     * Search SQLite embeddings with cosine similarity (brute-force).
     * Loads vectors in chunks to avoid memory explosion at 2.5M scale.
     *
     * @return array [['id' => string, 'score' => float, ...meta], ...]
     */
    public static function searchSqlite(array $queryVector, string $type, int $topK = 10, float $minScore = 0.3): array
    {
        $pdo = self::getSqlitePdo();
        $queryNorm = VectorPacker::norm($queryVector);
        if ($queryNorm == 0) return [];

        $results = [];
        $chunkSize = 5000;
        $offset = 0;

        do {
            $stmt = $pdo->prepare(
                "SELECT id, vector_blob, norm, meta_json FROM embeddings WHERE type = :type LIMIT :lim OFFSET :off"
            );
            $stmt->execute([':type' => $type, ':lim' => $chunkSize, ':off' => $offset]);
            $rows = $stmt->fetchAll();

            foreach ($rows as $row) {
                $v = VectorPacker::unpack($row['vector_blob']);
                $storedNorm = (float)$row['norm'];

                $score = self::cosineSimilarityWithNorm($queryVector, $v, $queryNorm, $storedNorm);
                if ($score >= $minScore) {
                    $meta = json_decode($row['meta_json'], true) ?: [];
                    $results[] = array_merge([
                        'id' => $row['id'],
                        'score' => round($score, 4),
                    ], $meta);
                }
            }

            $offset += $chunkSize;
        } while (count($rows) === $chunkSize);

        usort($results, fn($a, $b) => $b['score'] <=> $a['score']);
        return array_slice($results, 0, $topK);
    }

    /**
     * Get count of vectors in SQLite for a given type.
     */
    public static function countSqlite(string $type): int
    {
        $pdo = self::getSqlitePdo();
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM embeddings WHERE type = :type");
        $stmt->execute([':type' => $type]);
        return (int)$stmt->fetchColumn();
    }

    /**
     * Migrate existing JSON store to SQLite with quantization.
     *
     * @param string $type     Store type (observations, species, etc.)
     * @param string $format   Target quantization format
     * @return int Number of vectors migrated
     */
    public static function migrateJsonToSqlite(string $type, string $format = VectorPacker::FORMAT_INT8): int
    {
        $store = self::loadStore($type);
        $vectors = $store['vectors'] ?? [];
        if (empty($vectors)) return 0;

        $pdo = self::getSqlitePdo();
        $stmt = $pdo->prepare(
            "INSERT OR REPLACE INTO embeddings (type, id, vector_blob, norm, quant_format, meta_json, updated_at)
             VALUES (:type, :id, :blob, :norm, :fmt, :meta, :now)"
        );

        $count = 0;
        $pdo->beginTransaction();

        foreach ($vectors as $id => $entry) {
            $v = $entry['v'] ?? null;
            if (!is_array($v)) continue;

            $blob = VectorPacker::pack($v, $format);
            $norm = $entry['norm'] ?? VectorPacker::norm($v);
            $meta = $entry;
            unset($meta['v'], $meta['norm']);

            $stmt->execute([
                ':type' => $type,
                ':id'   => $id,
                ':blob' => $blob,
                ':norm' => round($norm, 8),
                ':fmt'  => $format,
                ':meta' => json_encode($meta, JSON_UNESCAPED_UNICODE),
                ':now'  => $entry['updated_at'] ?? date('c'),
            ]);
            $count++;

            if ($count % 1000 === 0) {
                $pdo->commit();
                $pdo->beginTransaction();
            }
        }

        $pdo->commit();
        return $count;
    }

    /**
     * Get SQLite storage statistics.
     */
    public static function sqliteStats(): array
    {
        $pdo = self::getSqlitePdo();
        $types = $pdo->query("SELECT type, COUNT(*) as cnt, SUM(LENGTH(vector_blob)) as bytes FROM embeddings GROUP BY type")->fetchAll();

        $result = [];
        foreach ($types as $row) {
            $result[$row['type']] = [
                'count' => (int)$row['cnt'],
                'storage_mb' => round($row['bytes'] / 1048576, 2),
                'avg_bytes_per_vector' => $row['cnt'] > 0 ? round($row['bytes'] / $row['cnt']) : 0,
            ];
        }
        return $result;
    }
}
