<?php

/**
 * LiteratureIngestionQueue — 永続型学術論文取り込みキュー
 *
 * 観察駆動 + 優先度 3 段階の永続インデックスキュー。
 * 「バッチで終わる」設計を捨て、永続的に動き続ける。
 *
 * Tier 1 : ikimon.life で観察済み種 (コンセンサス確定時に enqueue)
 * Tier 2 : 日本種 (japanese_name あり) — 初期シード & 年次再取得
 * Tier 3 : 全球種 — オンデマンドのみ
 *
 * taxon_key = strtolower(trim(scientific_name)) — TaxonPaperIndex / paper_taxa と同規則
 *
 * ストレージ: data/library/literature_queue.sqlite3
 * パターン : ExtractionQueue に倣った SQLite WAL + PID claim 方式
 */

class LiteratureIngestionQueue
{
    private static ?self $instance = null;
    private \PDO $pdo;

    private const STALE_TIMEOUT_SEC = 300;
    private const MAX_ATTEMPTS      = 3;
    private const BACKOFF_BASE_SEC  = 600;

    private function __construct()
    {
        $dbPath = (defined('DATA_DIR') ? DATA_DIR : __DIR__ . '/../data/')
            . 'library/literature_queue.sqlite3';
        $dir = dirname($dbPath);
        if (!is_dir($dir)) {
            mkdir($dir, 0755, true);
        }
        $this->pdo = new \PDO('sqlite:' . $dbPath);
        $this->pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);
        $this->pdo->exec("PRAGMA journal_mode=WAL");
        $this->pdo->exec("PRAGMA busy_timeout=30000");
        $this->pdo->exec("PRAGMA synchronous=NORMAL");
        $this->initSchema();
    }

    public static function getInstance(): self
    {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function initSchema(): void
    {
        $this->pdo->exec("
            CREATE TABLE IF NOT EXISTS ingestion_queue (
                taxon_key        TEXT PRIMARY KEY,
                scientific_name  TEXT NOT NULL,
                tier             INTEGER NOT NULL DEFAULT 2,
                status           TEXT NOT NULL DEFAULT 'pending',
                worker_pid       INTEGER,
                priority_score   REAL NOT NULL DEFAULT 0.0,
                claimed_at       TEXT,
                last_ingested_at TEXT,
                next_retry_at    TEXT,
                attempts         INTEGER NOT NULL DEFAULT 0,
                papers_found     INTEGER NOT NULL DEFAULT 0,
                source_status    TEXT NOT NULL DEFAULT '{}',
                added_at         TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
            )
        ");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_queue_status  ON ingestion_queue(status)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_queue_tier    ON ingestion_queue(tier)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_queue_priority ON ingestion_queue(tier, priority_score DESC)");
        $this->pdo->exec("CREATE INDEX IF NOT EXISTS idx_queue_retry   ON ingestion_queue(next_retry_at)");
    }

    // -----------------------------------------------------------------------
    // Public API
    // -----------------------------------------------------------------------

    /**
     * 種をキューに追加（冪等）。
     * 既存エントリがある場合、tier が小さい（優先度高い）ほうを保持し priority を更新。
     */
    public function enqueue(
        string $scientificName,
        int    $tier = 2,
        float  $priority = 0.0
    ): void {
        $taxon_key = strtolower(trim($scientificName));
        if ($taxon_key === '') return;

        $now = date('Y-m-d H:i:s');
        $this->pdo->prepare("
            INSERT INTO ingestion_queue
                (taxon_key, scientific_name, tier, priority_score, added_at, updated_at)
            VALUES
                (:key, :name, :tier, :prio, :now, :now)
            ON CONFLICT(taxon_key) DO UPDATE SET
                tier           = MIN(tier, excluded.tier),
                priority_score = MAX(priority_score, excluded.priority_score),
                status         = CASE WHEN status = 'done' THEN 'pending' ELSE status END,
                next_retry_at  = CASE WHEN status = 'done' THEN NULL ELSE next_retry_at END,
                updated_at     = excluded.updated_at
        ")->execute([
            ':key'  => $taxon_key,
            ':name' => $scientificName,
            ':tier' => $tier,
            ':prio' => $priority,
            ':now'  => $now,
        ]);
    }

    /**
     * 処理待ちジョブをバッチで claim する（WAL atomic）。
     * tier_max 以下の tier のみ対象。
     *
     * @return array [{taxon_key, scientific_name, tier, attempts, ...}]
     */
    public function claimBatch(int $limit = 20, int $tierMax = 2): array
    {
        $this->releaseStaleClaims();

        $now = date('Y-m-d H:i:s');
        $pid = getmypid();

        $this->pdo->beginTransaction();
        try {
            $rows = $this->pdo->prepare("
                SELECT taxon_key FROM ingestion_queue
                WHERE status = 'pending'
                  AND tier <= :tier_max
                  AND (next_retry_at IS NULL OR next_retry_at <= :now)
                ORDER BY tier ASC, priority_score DESC, added_at ASC
                LIMIT :lim
            ");
            $rows->bindValue(':tier_max', $tierMax, \PDO::PARAM_INT);
            $rows->bindValue(':now', $now);
            $rows->bindValue(':lim', $limit, \PDO::PARAM_INT);
            $rows->execute();
            $keys = $rows->fetchAll(\PDO::FETCH_COLUMN);

            if (empty($keys)) {
                $this->pdo->rollBack();
                return [];
            }

            $placeholders = implode(',', array_fill(0, count($keys), '?'));
            $this->pdo->prepare("
                UPDATE ingestion_queue
                SET status = 'claimed', worker_pid = ?, claimed_at = ?, updated_at = ?
                WHERE taxon_key IN ($placeholders)
            ")->execute(array_merge([$pid, $now, $now], $keys));

            $this->pdo->commit();

            return $this->pdo->prepare("
                SELECT * FROM ingestion_queue WHERE taxon_key IN ($placeholders)
            ")->execute($keys) ? $this->pdo->prepare("
                SELECT * FROM ingestion_queue WHERE taxon_key IN ($placeholders)
            ")->execute($keys) : [];
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * claimBatch の修正版 — 結果取得を正しく行う。
     */
    public function claimBatchRows(int $limit = 20, int $tierMax = 2): array
    {
        $this->releaseStaleClaims();

        $now = date('Y-m-d H:i:s');
        $pid = getmypid();

        $this->pdo->beginTransaction();
        try {
            $stmt = $this->pdo->prepare("
                SELECT taxon_key FROM ingestion_queue
                WHERE status = 'pending'
                  AND tier <= :tier_max
                  AND (next_retry_at IS NULL OR next_retry_at <= :now)
                ORDER BY tier ASC, priority_score DESC, added_at ASC
                LIMIT :lim
            ");
            $stmt->bindValue(':tier_max', $tierMax, \PDO::PARAM_INT);
            $stmt->bindValue(':now', $now);
            $stmt->bindValue(':lim', $limit, \PDO::PARAM_INT);
            $stmt->execute();
            $keys = $stmt->fetchAll(\PDO::FETCH_COLUMN);

            if (empty($keys)) {
                $this->pdo->rollBack();
                return [];
            }

            $placeholders = implode(',', array_fill(0, count($keys), '?'));
            $upd = $this->pdo->prepare("
                UPDATE ingestion_queue
                SET status = 'claimed', worker_pid = ?, claimed_at = ?, updated_at = ?
                WHERE taxon_key IN ($placeholders)
            ");
            $upd->execute(array_merge([$pid, $now, $now], $keys));

            $this->pdo->commit();

            $sel = $this->pdo->prepare("
                SELECT * FROM ingestion_queue WHERE taxon_key IN ($placeholders)
            ");
            $sel->execute($keys);
            return $sel->fetchAll();
        } catch (\Throwable $e) {
            if ($this->pdo->inTransaction()) $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * 処理成功を記録する。
     */
    public function markDone(string $taxonKey, int $papersFound, array $sourceStatus = []): void
    {
        $now = date('Y-m-d H:i:s');
        $this->pdo->prepare("
            UPDATE ingestion_queue
            SET status = 'done',
                papers_found = :pf,
                source_status = :ss,
                last_ingested_at = :now,
                worker_pid = NULL,
                claimed_at = NULL,
                attempts = attempts + 1,
                updated_at = :now
            WHERE taxon_key = :key
        ")->execute([
            ':pf'  => $papersFound,
            ':ss'  => json_encode($sourceStatus, JSON_UNESCAPED_UNICODE),
            ':now' => $now,
            ':key' => strtolower(trim($taxonKey)),
        ]);
    }

    /**
     * 処理失敗を記録する。MAX_ATTEMPTS 未満なら指数バックオフで再試行。
     */
    public function markFailed(string $taxonKey, string $error = '', array $sourceStatus = []): void
    {
        $key  = strtolower(trim($taxonKey));
        $now  = date('Y-m-d H:i:s');
        $row  = $this->pdo->prepare("SELECT attempts FROM ingestion_queue WHERE taxon_key = ?");
        $row->execute([$key]);
        $attempts = (int)($row->fetchColumn() ?: 0) + 1;

        if ($attempts >= self::MAX_ATTEMPTS) {
            $this->pdo->prepare("
                UPDATE ingestion_queue
                SET status = 'failed',
                    attempts = :att,
                    source_status = :ss,
                    worker_pid = NULL,
                    claimed_at = NULL,
                    updated_at = :now
                WHERE taxon_key = :key
            ")->execute([
                ':att' => $attempts,
                ':ss'  => json_encode(array_merge($sourceStatus, ['last_error' => $error]), JSON_UNESCAPED_UNICODE),
                ':now' => $now,
                ':key' => $key,
            ]);
        } else {
            $backoffSec  = self::BACKOFF_BASE_SEC * (2 ** ($attempts - 1));
            $nextRetry   = date('Y-m-d H:i:s', time() + $backoffSec);
            $this->pdo->prepare("
                UPDATE ingestion_queue
                SET status = 'pending',
                    attempts = :att,
                    source_status = :ss,
                    next_retry_at = :retry,
                    worker_pid = NULL,
                    claimed_at = NULL,
                    updated_at = :now
                WHERE taxon_key = :key
            ")->execute([
                ':att'   => $attempts,
                ':ss'    => json_encode(array_merge($sourceStatus, ['last_error' => $error]), JSON_UNESCAPED_UNICODE),
                ':retry' => $nextRetry,
                ':now'   => $now,
                ':key'   => $key,
            ]);
        }
    }

    /**
     * タイムアウトしたクレームを解放する。
     */
    public function releaseStaleClaims(): void
    {
        $cutoff = date('Y-m-d H:i:s', time() - self::STALE_TIMEOUT_SEC);
        $this->pdo->prepare("
            UPDATE ingestion_queue
            SET status = 'pending', worker_pid = NULL, claimed_at = NULL, updated_at = datetime('now')
            WHERE status = 'claimed' AND claimed_at < :cutoff
        ")->execute([':cutoff' => $cutoff]);
    }

    /**
     * 年次再取得候補を pending に戻す。
     */
    public function requeueStale(int $daysSince = 365): int
    {
        $cutoff = date('Y-m-d H:i:s', time() - $daysSince * 86400);
        $stmt = $this->pdo->prepare("
            UPDATE ingestion_queue
            SET status = 'pending', next_retry_at = NULL, attempts = 0, updated_at = datetime('now')
            WHERE status = 'done'
              AND last_ingested_at < :cutoff
        ");
        $stmt->execute([':cutoff' => $cutoff]);
        return $stmt->rowCount();
    }

    /**
     * キュー全体の状態スナップショット。
     */
    public function snapshot(): array
    {
        $rows = $this->pdo->query("
            SELECT tier, status, COUNT(*) cnt,
                   MAX(CAST((julianday('now') - julianday(added_at)) * 86400 AS INTEGER)) max_age_sec
            FROM ingestion_queue
            GROUP BY tier, status
        ")->fetchAll();

        $result = ['by_tier_status' => [], 'total' => 0];
        foreach ($rows as $r) {
            $result['by_tier_status'][] = [
                'tier'        => (int)$r['tier'],
                'status'      => $r['status'],
                'count'       => (int)$r['cnt'],
                'max_age_sec' => (int)($r['max_age_sec'] ?? 0),
            ];
            $result['total'] += (int)$r['cnt'];
        }
        return $result;
    }
}
