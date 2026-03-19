<?php

/**
 * LiteratureIngestionPipeline.php — Multi-Source Paper Ingestion Orchestrator
 *
 * GBIF Literature + CrossRef + J-STAGE/CiNii の3ソースから
 * 学術論文を取得し、統一フォーマットで保存するパイプライン。
 *
 * Phase 2: 論文自動取り込み基盤。
 *
 * デュアルライト戦略:
 *   1. JSON (PaperStore / TaxonPaperIndex) — 既存システム互換
 *   2. SQLite (OmoikaneDB papers / paper_taxa) — Phase 4 VPS移行準備
 *
 * 使い方:
 *   $pipeline = new LiteratureIngestionPipeline();
 *   $result = $pipeline->ingestForTaxon('Parus minor');
 *   // or batch:
 *   $results = $pipeline->ingestBatch(['Parus minor', 'Papilio machaon'], 5);
 */

class LiteratureIngestionPipeline
{
    /** 各ソースごとのデフォルト取得件数 */
    const DEFAULT_PER_SOURCE = 10;

    /** ソース優先度（重複時に優先するソース） */
    const SOURCE_PRIORITY = ['crossref', 'jstage', 'cinii', 'gbif_lit'];

    private ?CrossRefClient $crossRef = null;
    private ?JStageClient $jstage = null;
    private ?OmoikaneDB $omoikane = null;
    private array $stats;
    private string $logDir;

    public function __construct(?string $mailto = null)
    {
        $this->stats = $this->emptyStats();
        $this->logDir = (defined('DATA_DIR') ? DATA_DIR : __DIR__ . '/../data/') . 'ingestion_logs/';
        if (!is_dir($this->logDir)) {
            @mkdir($this->logDir, 0755, true);
        }

        // Lazy-load clients
        $this->crossRef = new CrossRefClient($mailto);
        $this->jstage = new JStageClient();
    }

    /**
     * 単一の学名で全ソースから論文を取得・保存する。
     *
     * @param string $scientificName 学名
     * @param int    $perSource      ソースあたりの最大件数
     * @return array {new: int, duplicate: int, errors: string[], sources: array}
     */
    public function ingestForTaxon(string $scientificName, int $perSource = self::DEFAULT_PER_SOURCE): array
    {
        $this->stats = $this->emptyStats();
        $allPapers = [];

        // 1. CrossRef
        $allPapers = array_merge($allPapers, $this->fetchFromCrossRef($scientificName, $perSource));

        // 2. J-STAGE + CiNii（統合検索）
        usleep(500000); // 0.5s rate limit
        $allPapers = array_merge($allPapers, $this->fetchFromJStage($scientificName, $perSource));

        // 3. DOI重複排除 + ソース優先度適用
        $deduplicated = $this->deduplicateByDoi($allPapers);

        // 4. デュアルライト（JSON + SQLite）
        foreach ($deduplicated as $paper) {
            $this->persistPaper($paper, $scientificName);
        }

        $this->stats['total_fetched'] = count($allPapers);
        $this->stats['after_dedup'] = count($deduplicated);

        // ログ保存
        $this->saveLog($scientificName);

        return $this->stats;
    }

    /**
     * 複数の学名をバッチ処理する。
     *
     * @param array $scientificNames 学名配列
     * @param int   $perSource       ソースあたりの最大件数
     * @return array 学名 => ingestForTaxon結果
     */
    public function ingestBatch(array $scientificNames, int $perSource = 5): array
    {
        $results = [];
        foreach ($scientificNames as $name) {
            $results[$name] = $this->ingestForTaxon($name, $perSource);
            // ソース間レート制限（1秒）
            sleep(1);
        }
        return $results;
    }

    /**
     * CrossRef から論文を取得する。
     */
    private function fetchFromCrossRef(string $scientificName, int $limit): array
    {
        try {
            $response = $this->crossRef->searchBySpecies($scientificName, $limit);
            $this->stats['sources']['crossref'] = count($response['items']);
            return $response['items'];
        } catch (\Throwable $e) {
            $this->stats['errors'][] = "CrossRef: " . $e->getMessage();
            return [];
        }
    }

    /**
     * J-STAGE + CiNii から論文を取得する。
     */
    private function fetchFromJStage(string $scientificName, int $limit): array
    {
        try {
            $response = $this->jstage->searchAll($scientificName, $limit);
            $this->stats['sources']['jstage_cinii'] = count($response['items']);
            return $response['items'];
        } catch (\Throwable $e) {
            $this->stats['errors'][] = "J-STAGE/CiNii: " . $e->getMessage();
            return [];
        }
    }

    /**
     * DOI 重複排除。ソース優先度に基づきマージ。
     *
     * @param array $papers
     * @return array 重複排除後の論文配列
     */
    private function deduplicateByDoi(array $papers): array
    {
        $byDoi = [];
        $noDoi = [];

        foreach ($papers as $paper) {
            $doi = $paper['doi'] ?? null;
            if (!$doi) {
                // DOIなし論文はタイトルで重複チェック
                $titleKey = mb_strtolower(trim($paper['title'] ?? ''));
                if ($titleKey && !isset($byDoi['title:' . $titleKey])) {
                    $byDoi['title:' . $titleKey] = $paper;
                }
                continue;
            }

            $doi = strtolower(trim($doi));
            if (!isset($byDoi[$doi])) {
                $byDoi[$doi] = $paper;
            } else {
                // ソース優先度に基づきマージ
                $existing = $byDoi[$doi];
                $existingPriority = array_search($existing['source'] ?? '', self::SOURCE_PRIORITY);
                $newPriority = array_search($paper['source'] ?? '', self::SOURCE_PRIORITY);

                if ($newPriority !== false && ($existingPriority === false || $newPriority < $existingPriority)) {
                    // abstract が欠けている場合は補完
                    if (empty($paper['abstract']) && !empty($existing['abstract'])) {
                        $paper['abstract'] = $existing['abstract'];
                    }
                    $byDoi[$doi] = $paper;
                } else {
                    // 既存を維持しつつ abstract 補完
                    if (empty($existing['abstract']) && !empty($paper['abstract'])) {
                        $byDoi[$doi]['abstract'] = $paper['abstract'];
                    }
                }
            }
        }

        return array_values($byDoi);
    }

    /**
     * 論文をデュアルライト（JSON + SQLite）で保存する。
     *
     * @param array  $paper          正規化済み論文データ
     * @param string $scientificName 関連する学名
     */
    private function persistPaper(array $paper, string $scientificName): void
    {
        $doi = $paper['doi'] ?? null;
        $identifier = $doi ?: md5($paper['title'] ?? uniqid());

        // --- JSON ストレージ ---
        try {
            $existing = $doi ? PaperStore::findById($doi) : null;
            if ($existing) {
                $this->stats['duplicate']++;
            } else {
                PaperStore::append($paper);
                $this->stats['new']++;
            }

            // TaxonPaperIndex 更新
            if ($doi) {
                TaxonPaperIndex::add($scientificName, $doi);
            }
        } catch (\Throwable $e) {
            $this->stats['errors'][] = "JSON persist: " . $e->getMessage();
        }

        // --- SQLite ストレージ（OmoikaneDB）---
        try {
            $pdo = $this->getOmoikanePDO();
            if ($pdo && $doi) {
                // papers テーブル（UPSERT）
                $stmt = $pdo->prepare("
                    INSERT OR IGNORE INTO papers (doi, title, authors, year, journal, source, abstract, language, url, subjects)
                    VALUES (:doi, :title, :authors, :year, :journal, :source, :abstract, :language, :url, :subjects)
                ");
                $stmt->execute([
                    ':doi'      => $doi,
                    ':title'    => $paper['title'] ?? '',
                    ':authors'  => json_encode($paper['authors'] ?? [], JSON_UNESCAPED_UNICODE),
                    ':year'     => $paper['year'] ?? null,
                    ':journal'  => $paper['journal'] ?? '',
                    ':source'   => $paper['source'] ?? 'unknown',
                    ':abstract' => $paper['abstract'] ?? null,
                    ':language' => $paper['language'] ?? 'ja',
                    ':url'      => $paper['url'] ?? null,
                    ':subjects' => json_encode($paper['subjects'] ?? [], JSON_UNESCAPED_UNICODE),
                ]);

                // paper_taxa テーブル
                $stmt = $pdo->prepare("
                    INSERT OR IGNORE INTO paper_taxa (doi, taxon_key, confidence)
                    VALUES (:doi, :taxon_key, :confidence)
                ");
                $stmt->execute([
                    ':doi'        => $doi,
                    ':taxon_key'  => strtolower(trim($scientificName)),
                    ':confidence' => 1.0,
                ]);
            }
        } catch (\Throwable $e) {
            $this->stats['errors'][] = "SQLite persist: " . $e->getMessage();
        }
    }

    /**
     * OmoikaneDB の PDO を遅延取得する。
     */
    private function getOmoikanePDO(): ?\PDO
    {
        if ($this->omoikane === null) {
            try {
                $this->omoikane = new OmoikaneDB();
            } catch (\Throwable $e) {
                $this->stats['errors'][] = "OmoikaneDB init: " . $e->getMessage();
                return null;
            }
        }
        return $this->omoikane->getPDO();
    }

    /**
     * 取り込みログを保存する。
     */
    private function saveLog(string $scientificName): void
    {
        $log = [
            'taxon'     => $scientificName,
            'timestamp' => date('c'),
            'stats'     => $this->stats,
        ];
        $file = $this->logDir . date('Y-m-d') . '_' . md5($scientificName) . '.json';
        @file_put_contents($file, json_encode($log, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    /**
     * 取り込み進捗ファイルを更新する（バッチ処理の再開ポイント記録用）。
     *
     * @param string $progressFile  進捗ファイルパス
     * @param string $lastTaxon     最後に処理した学名
     * @param int    $processedCount 処理済み件数
     */
    public function updateProgress(string $progressFile, string $lastTaxon, int $processedCount): void
    {
        $progress = [];
        if (file_exists($progressFile)) {
            $progress = json_decode(file_get_contents($progressFile), true) ?: [];
        }

        $progress['last_taxon'] = $lastTaxon;
        $progress['processed_count'] = $processedCount;
        $progress['updated_at'] = date('c');
        $progress['sources_available'] = ['crossref', 'jstage', 'cinii'];

        file_put_contents($progressFile, json_encode($progress, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    }

    /**
     * 空の統計テンプレート。
     */
    private function emptyStats(): array
    {
        return [
            'new'           => 0,
            'duplicate'     => 0,
            'total_fetched' => 0,
            'after_dedup'   => 0,
            'errors'        => [],
            'sources'       => [],
        ];
    }

    /**
     * 最新の統計を取得する。
     */
    public function getStats(): array
    {
        return $this->stats;
    }
}
