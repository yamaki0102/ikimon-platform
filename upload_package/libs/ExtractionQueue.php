<?php

/**
 * ExtractionQueue - SQLite-backed extraction queue
 * Replaces the 75MB JSON file with row-level SQLite operations.
 * 
 * Usage:
 *   $eq = new ExtractionQueue();
 *   $batch = $eq->claimBatch(3, $workerPid);
 *   $eq->updateStatus('Homo sapiens', 'completed');
 *   $counts = $eq->getCounts();
 */

class ExtractionQueue
{
    private PDO $pdo;
    private static ?ExtractionQueue $instance = null;

    public function __construct()
    {
        $dbPath = DATA_DIR . '/library/extraction_queue.sqlite3';
        $this->pdo = new PDO("sqlite:$dbPath", null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 30
        ]);
        $this->pdo->exec('PRAGMA journal_mode=WAL');
        $this->pdo->exec('PRAGMA busy_timeout=30000');
        $this->pdo->exec('PRAGMA synchronous=NORMAL');
        $this->init();
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function init(): void
    {
        $this->pdo->exec("CREATE TABLE IF NOT EXISTS queue (
            species_name TEXT PRIMARY KEY,
            slug TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            source TEXT,
            gbif_key INTEGER,
            occurrence_count_jp INTEGER DEFAULT 0,
            retries INTEGER DEFAULT 0,
            worker_pid INTEGER,
            claimed_at TEXT,
            added_at TEXT,
            last_processed_at TEXT,
            note TEXT,
            prefetched_literature TEXT DEFAULT '[]',
            source_citations TEXT DEFAULT '[]',
            specimen_records TEXT DEFAULT '[]',
            error_message TEXT
        )");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_queue_status ON queue(status)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_queue_worker ON queue(worker_pid)");
    }

    public function getPDO(): PDO
    {
        return $this->pdo;
    }

    /**
     * Claim a batch of literature_ready species for processing.
     * Atomically marks them as 'processing' and assigns a worker PID.
     * Skips species already distilled in the main DB.
     */
    public function claimBatch(int $batchSize, int $workerPid, array $distilledSet = []): array
    {
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                "SELECT species_name, prefetched_literature, source_citations, specimen_records, retries 
                 FROM queue WHERE status = 'literature_ready' LIMIT :limit"
            );
            $stmt->execute([':limit' => $batchSize * 3]); // Fetch extra to account for distilled skips
            $candidates = $stmt->fetchAll(PDO::FETCH_ASSOC);

            $batch = [];
            $autoCompleted = 0;
            $updateStmt = $this->pdo->prepare(
                "UPDATE queue SET status = 'processing', worker_pid = :pid, claimed_at = :at, retries = retries + 1 
                 WHERE species_name = :name"
            );
            $completeStmt = $this->pdo->prepare(
                "UPDATE queue SET status = 'completed', last_processed_at = :at, note = 'Already distilled (worker check)' 
                 WHERE species_name = :name"
            );

            $now = date('Y-m-d H:i:s');
            foreach ($candidates as $row) {
                if (count($batch) >= $batchSize) break;
                $name = $row['species_name'];

                if (isset($distilledSet[$name])) {
                    $completeStmt->execute([':name' => $name, ':at' => $now]);
                    $autoCompleted++;
                    continue;
                }

                $updateStmt->execute([':pid' => $workerPid, ':at' => $now, ':name' => $name]);
                $row['prefetched_literature'] = json_decode($row['prefetched_literature'], true) ?: [];
                $row['source_citations'] = json_decode($row['source_citations'], true) ?: [];
                $row['specimen_records'] = json_decode($row['specimen_records'], true) ?: [];
                $batch[$name] = $row;
            }

            $this->pdo->commit();
            if ($autoCompleted > 0) {
                echo "[SKIP] Auto-completed $autoCompleted already-distilled species.\n";
            }
            return $batch;
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Update the status of a single species.
     */
    public function updateStatus(string $speciesName, string $newStatus, ?string $note = null): void
    {
        $sql = "UPDATE queue SET status = :status, last_processed_at = :at";
        $params = [':status' => $newStatus, ':at' => date('Y-m-d H:i:s'), ':name' => $speciesName];
        if ($note !== null) {
            $sql .= ", note = :note";
            $params[':note'] = $note;
        }
        $sql .= " WHERE species_name = :name";
        $this->pdo->prepare($sql)->execute($params);
    }

    /**
     * Reset processing items back to literature_ready (for shutdown handler).
     */
    public function resetProcessing(int $workerPid): int
    {
        $stmt = $this->pdo->prepare(
            "UPDATE queue SET status = 'literature_ready', worker_pid = NULL 
             WHERE status = 'processing' AND worker_pid = :pid"
        );
        $stmt->execute([':pid' => $workerPid]);
        return $stmt->rowCount();
    }

    /**
     * Reset ALL stuck processing items (for restart script).
     */
    public function resetAllStuck(): array
    {
        $stmt = $this->pdo->prepare(
            "UPDATE queue SET status = 'literature_ready', worker_pid = NULL 
             WHERE status = 'processing'"
        );
        $stmt->execute();
        $processing = $stmt->rowCount();

        $stmt2 = $this->pdo->prepare(
            "UPDATE queue SET status = 'literature_ready' WHERE status = 'failed'"
        );
        $stmt2->execute();
        $failed = $stmt2->rowCount();

        return ['processing' => $processing, 'failed' => $failed];
    }

    /**
     * Get counts by status.
     */
    public function getCounts(): array
    {
        $stmt = $this->pdo->query(
            "SELECT status, count(*) as cnt FROM queue GROUP BY status"
        );
        $counts = [
            'completed' => 0,
            'processing' => 0,
            'pending' => 0,
            'failed' => 0,
            'fetching_lit' => 0,
            'literature_ready' => 0,
            'no_literature' => 0,
            'invalid_name' => 0,
            'total' => 0
        ];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $counts[$row['status']] = (int)$row['cnt'];
            $counts['total'] += (int)$row['cnt'];
        }
        return $counts;
    }

    /**
     * Add a species to the queue (skip if exists).
     */
    public function addSpecies(string $name, array $data = []): bool
    {
        $stmt = $this->pdo->prepare("SELECT 1 FROM queue WHERE species_name = :name");
        $stmt->execute([':name' => $name]);
        if ($stmt->fetchColumn()) return false;

        $this->pdo->prepare(
            "INSERT INTO queue (species_name, slug, status, source, gbif_key, occurrence_count_jp, retries, added_at, prefetched_literature, source_citations, specimen_records)
             VALUES (:name, :slug, :status, :source, :gbif_key, :occ, :retries, :added, :lit, :cit, :spec)"
        )->execute([
            ':name' => $name,
            ':slug' => $data['slug'] ?? str_replace(' ', '-', strtolower($name)),
            ':status' => $data['status'] ?? 'pending',
            ':source' => $data['source'] ?? null,
            ':gbif_key' => $data['gbif_key'] ?? null,
            ':occ' => $data['occurrence_count_jp'] ?? 0,
            ':retries' => $data['retries'] ?? 0,
            ':added' => $data['added_at'] ?? date('Y-m-d H:i:s'),
            ':lit' => json_encode($data['prefetched_literature'] ?? []),
            ':cit' => json_encode($data['source_citations'] ?? []),
            ':spec' => json_encode($data['specimen_records'] ?? [])
        ]);
        return true;
    }

    /**
     * Update prefetched literature for a species.
     */
    public function updateLiterature(string $name, string $newStatus, array $literature, array $citations = [], array $specimens = []): void
    {
        $this->pdo->prepare(
            "UPDATE queue SET status = :status, prefetched_literature = :lit, source_citations = :cit, specimen_records = :spec, last_processed_at = :at
             WHERE species_name = :name"
        )->execute([
            ':status' => $newStatus,
            ':lit' => json_encode($literature),
            ':cit' => json_encode($citations),
            ':spec' => json_encode($specimens),
            ':at' => date('Y-m-d H:i:s'),
            ':name' => $name
        ]);
    }

    /**
     * Get species by status (with optional limit).
     */
    public function getByStatus(string $status, int $limit = 0): array
    {
        $sql = "SELECT * FROM queue WHERE status = :status";
        if ($limit > 0) $sql .= " LIMIT $limit";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':status' => $status]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Sync with distilled DB - mark already-distilled species as completed.
     */
    public function syncWithDistilledDB(array $distilledSet): int
    {
        $synced = 0;
        $stmt = $this->pdo->prepare(
            "UPDATE queue SET status = 'completed', last_processed_at = :at, note = 'Synced from DB'
             WHERE species_name = :name AND status != 'completed'"
        );
        foreach ($distilledSet as $name => $_) {
            $stmt->execute([':name' => $name, ':at' => date('Y-m-d H:i:s')]);
            $synced += $stmt->rowCount();
        }
        return $synced;
    }

    /**
     * Claim a single pending species for literature prefetching.
     * Atomically sets status to 'fetching_lit'.
     */
    public function claimForPrefetch(int $workerPid): ?array
    {
        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare(
                "SELECT species_name, slug, source, gbif_key FROM queue WHERE status = 'pending' LIMIT 1"
            );
            $stmt->execute();
            $row = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$row) {
                $this->pdo->commit();
                return null;
            }

            $now = date('Y-m-d H:i:s');
            $this->pdo->prepare(
                "UPDATE queue SET status = 'fetching_lit', worker_pid = :pid, claimed_at = :at WHERE species_name = :name"
            )->execute([':pid' => $workerPid, ':at' => $now, ':name' => $row['species_name']]);

            $this->pdo->commit();
            return $row;
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Update a species after prefetching with GBIF metadata, literature, citations, and specimens.
     */
    public function updatePrefetchResult(string $speciesName, array $updates): void
    {
        $setClauses = ['last_processed_at = :at'];
        $params = [':at' => date('Y-m-d H:i:s'), ':name' => $speciesName];

        if (isset($updates['status'])) {
            $setClauses[] = 'status = :status';
            $params[':status'] = $updates['status'];
        }
        if (isset($updates['gbif_key'])) {
            $setClauses[] = 'gbif_key = :gbif_key';
            $params[':gbif_key'] = $updates['gbif_key'];
        }
        if (isset($updates['prefetched_literature'])) {
            $setClauses[] = 'prefetched_literature = :lit';
            $params[':lit'] = json_encode($updates['prefetched_literature'], JSON_UNESCAPED_UNICODE);
        }
        if (isset($updates['source_citations'])) {
            $setClauses[] = 'source_citations = :cit';
            $params[':cit'] = json_encode($updates['source_citations'], JSON_UNESCAPED_UNICODE);
        }
        if (isset($updates['specimen_records'])) {
            $setClauses[] = 'specimen_records = :spec';
            $params[':spec'] = json_encode($updates['specimen_records'], JSON_UNESCAPED_UNICODE);
        }
        if (isset($updates['note'])) {
            $setClauses[] = 'note = :note';
            $params[':note'] = $updates['note'];
        }

        $sql = "UPDATE queue SET " . implode(', ', $setClauses) . " WHERE species_name = :name";
        $this->pdo->prepare($sql)->execute($params);
    }
}
