<?php

/**
 * EmbeddingStore - SQLite-based vector store for ikimon.life
 *
 * Stores embedding vectors as packed float32 BLOBs in SQLite.
 * Supports brute-force cosine similarity search in PHP.
 *
 * Storage: data/embeddings/embeddings.sqlite3
 * Types: observations, photos, papers, taxons, omoikane
 *
 * Scale design:
 *   - 768-dim float32 BLOB = 3,072 bytes/entry (vs ~30KB as JSON)
 *   - 1M entries ≈ 3GB — fits on RS Plan with room
 *   - WAL mode for concurrent read/write
 *   - Works on shared hosting (Apache + mod_php, no sqlite-vec required)
 *
 * API is backward-compatible with the JSON-file version.
 */

require_once __DIR__ . '/../config/config.php';

class EmbeddingStore
{
    private const DEFAULT_DIMENSIONS = 768;
    private const DEFAULT_MODEL = 'gemini-embedding-2-preview';

    /** Per-request PDO connection cache (PHP-FPM: 1 connection per request) */
    private static ?PDO $pdo = null;

    // ─── CRUD Operations ────────────────────────────────────────

    /**
     * Save an embedding vector.
     * Vector is stored as packed float32 BLOB (4 bytes/value).
     */
    public static function save(string $type, string $id, array $vector, array $meta = []): void
    {
        $pdo = self::getPDO();

        $blob = pack('f*', ...$vector);
        $dimensions = count($vector);
        $model = $meta['model'] ?? self::DEFAULT_MODEL;

        // Store extra meta (mode, text, has_photo, etc.) as JSON, excluding 'model'
        $metaJson = json_encode(
            array_diff_key($meta, ['model' => true]),
            JSON_UNESCAPED_UNICODE
        );

        $now = date('c');
        $compositeId = $type . ':' . $id;

        $stmt = $pdo->prepare("
            INSERT INTO embeddings
                (id, type, ref_id, embedding, metadata, dimensions, model, created_at, updated_at)
            VALUES
                (:id, :type, :ref_id, :embedding, :metadata, :dimensions, :model, :created_at, :updated_at)
            ON CONFLICT(id) DO UPDATE SET
                embedding  = excluded.embedding,
                metadata   = excluded.metadata,
                dimensions = excluded.dimensions,
                model      = excluded.model,
                updated_at = excluded.updated_at
        ");

        $stmt->execute([
            ':id'         => $compositeId,
            ':type'       => $type,
            ':ref_id'     => $id,
            ':embedding'  => $blob,
            ':metadata'   => $metaJson,
            ':dimensions' => $dimensions,
            ':model'      => $model,
            ':created_at' => $now,
            ':updated_at' => $now,
        ]);
    }

    /**
     * Get a single embedding entry by type and ID.
     * Returns array with 'v' (float[]), 'updated_at', and meta keys — same as legacy format.
     */
    public static function get(string $type, string $id): ?array
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("SELECT * FROM embeddings WHERE id = :id");
        $stmt->execute([':id' => $type . ':' . $id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? self::rowToEntry($row) : null;
    }

    /**
     * Check if an embedding exists (optionally: created/updated after a given timestamp).
     */
    public static function exists(string $type, string $id, ?string $updatedAfter = null): bool
    {
        $pdo = self::getPDO();
        $compositeId = $type . ':' . $id;

        if ($updatedAfter === null) {
            $stmt = $pdo->prepare("SELECT 1 FROM embeddings WHERE id = :id");
            $stmt->execute([':id' => $compositeId]);
            return (bool) $stmt->fetchColumn();
        }

        $stmt = $pdo->prepare("SELECT updated_at FROM embeddings WHERE id = :id");
        $stmt->execute([':id' => $compositeId]);
        $updatedAt = $stmt->fetchColumn();
        if ($updatedAt === false) return false;
        return strtotime($updatedAt) >= strtotime($updatedAfter);
    }

    /**
     * Delete an embedding.
     */
    public static function delete(string $type, string $id): void
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("DELETE FROM embeddings WHERE id = :id");
        $stmt->execute([':id' => $type . ':' . $id]);
    }

    /**
     * Count vectors in a store by type.
     */
    public static function count(string $type): int
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM embeddings WHERE type = :type");
        $stmt->execute([':type' => $type]);
        return (int) $stmt->fetchColumn();
    }

    // ─── Search ─────────────────────────────────────────────────

    /**
     * Search for top-K most similar vectors using cosine similarity.
     *
     * Streams all embeddings of the given type row-by-row from SQLite,
     * unpacks float32 BLOBs, and computes cosine similarity in PHP.
     * No full file load into memory — each row is processed and discarded.
     *
     * Performance: 100K × 768-dim ≈ 2–3 seconds on RS Plan.
     *
     * Returns [['id' => string, 'score' => float, 'mode' => string, 'text' => string], ...]
     */
    public static function search(
        array $queryVector,
        string $type,
        int $topK = 10,
        float $minScore = 0.3
    ): array {
        $queryNorm = self::norm($queryVector);
        if ($queryNorm == 0.0) return [];

        $pdo = self::getPDO();
        $stmt = $pdo->prepare(
            "SELECT ref_id, embedding, metadata FROM embeddings WHERE type = :type"
        );
        $stmt->execute([':type' => $type]);

        $results = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $v = self::unpackBlob((string) $row['embedding']);
            if ($v === null) continue;

            $score = self::cosineSimilarityFast($queryVector, $v, $queryNorm);
            if ($score < $minScore) continue;

            $meta = json_decode((string) ($row['metadata'] ?? '{}'), true) ?: [];
            $results[] = [
                'id'    => $row['ref_id'],
                'score' => round($score, 4),
                'mode'  => $meta['mode'] ?? 'unknown',
                'text'  => $meta['text'] ?? '',
            ];
        }

        usort($results, fn($a, $b) => $b['score'] <=> $a['score']);
        return array_slice($results, 0, $topK);
    }

    /**
     * Find similar items to an existing vector in the store.
     */
    public static function findSimilar(
        string $type,
        string $id,
        int $topK = 5,
        float $minScore = 0.3
    ): array {
        $entry = self::get($type, $id);
        if (!$entry || empty($entry['v'])) return [];

        $results = self::search($entry['v'], $type, $topK + 1, $minScore);
        return array_values(array_filter($results, fn($r) => $r['id'] !== $id));
    }

    // ─── Stats ──────────────────────────────────────────────────

    /**
     * Return per-type counts for all types present in the DB.
     */
    public static function stats(): array
    {
        $pdo = self::getPDO();
        $stmt = $pdo->query("SELECT type, COUNT(*) AS cnt FROM embeddings GROUP BY type");
        $out = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $out[$row['type']] = (int) $row['cnt'];
        }
        return $out;
    }

    // ─── Math ───────────────────────────────────────────────────

    /**
     * Cosine similarity with pre-computed query norm (fast inner loop).
     */
    private static function cosineSimilarityFast(array $a, array $b, float $aNorm): float
    {
        $dot = 0.0;
        $bNormSq = 0.0;
        $len = min(count($a), count($b));

        for ($i = 0; $i < $len; $i++) {
            $dot    += $a[$i] * $b[$i];
            $bNormSq += $b[$i] * $b[$i];
        }

        $bNorm = sqrt($bNormSq);
        if ($bNorm == 0.0) return 0.0;
        return $dot / ($aNorm * $bNorm);
    }

    private static function norm(array $v): float
    {
        $sum = 0.0;
        foreach ($v as $val) $sum += $val * $val;
        return sqrt($sum);
    }

    // ─── SQLite I/O ─────────────────────────────────────────────

    private static function getPDO(): PDO
    {
        if (self::$pdo !== null) return self::$pdo;

        $dir = DATA_DIR . '/embeddings';
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }

        $pdo = new PDO('sqlite:' . $dir . '/embeddings.sqlite3');
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        // WAL for concurrent reads alongside writes from the embedding queue
        $pdo->exec('PRAGMA journal_mode = WAL;');
        // NORMAL sync: safe + faster than FULL on RS Plan's disk
        $pdo->exec('PRAGMA synchronous = NORMAL;');
        // Wait up to 5s instead of failing immediately on lock
        $pdo->exec('PRAGMA busy_timeout = 5000;');
        // 8MB page cache (reduces I/O for repeated searches)
        $pdo->exec('PRAGMA cache_size = -8000;');

        self::initSchema($pdo);
        self::$pdo = $pdo;
        return $pdo;
    }

    private static function initSchema(PDO $pdo): void
    {
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS embeddings (
                id         TEXT PRIMARY KEY,        -- '{type}:{ref_id}'
                type       TEXT NOT NULL,           -- 'observations'|'photos'|'omoikane'|'papers'|'taxons'
                ref_id     TEXT NOT NULL,           -- original observation/species ID
                embedding  BLOB NOT NULL,           -- float32 packed: pack('f*', ...$vector)
                metadata   TEXT,                    -- JSON: mode, text, has_photo, etc.
                dimensions INTEGER NOT NULL DEFAULT 768,
                model      TEXT    NOT NULL DEFAULT 'gemini-embedding-2-preview',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        ");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_emb_type   ON embeddings(type)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_emb_ref_id ON embeddings(ref_id)");
    }

    /**
     * Unpack a float32 BLOB to PHP float array.
     */
    private static function unpackBlob(string $blob): ?array
    {
        if ($blob === '') return null;
        $values = unpack('f*', $blob);
        return $values ? array_values($values) : null;
    }

    /**
     * Convert DB row to legacy entry format with 'v' key for vector.
     */
    private static function rowToEntry(array $row): array
    {
        $meta = json_decode((string) ($row['metadata'] ?? '{}'), true) ?: [];
        $v    = self::unpackBlob((string) ($row['embedding'] ?? ''));
        return array_merge($meta, [
            'v'          => $v ?? [],
            'updated_at' => $row['updated_at'],
        ]);
    }

    /**
     * Clear in-memory PDO connection (useful for long-running scripts to release locks).
     */
    public static function clearCache(): void
    {
        self::$pdo = null;
    }
}
