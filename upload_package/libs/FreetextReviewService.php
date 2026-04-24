<?php

/**
 * FreetextReviewService — freetext同定のレビューキュー管理
 * 
 * observationsの中からsource='freetext'のレコードを集約し、
 * 管理者がレビュー・承認・却下できる仕組みを提供する。
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/TaxonSearchService.php';

class FreetextReviewService
{
    private static string $reviewFile = '';

    private static function getReviewFile(): string
    {
        if (!self::$reviewFile) {
            self::$reviewFile = DATA_DIR . '/freetext_review.json';
        }
        return self::$reviewFile;
    }

    /**
     * レビューキュー取得
     * 全observationsからsource='freetext'を抽出し、レビュー状況と共に返す
     * 
     * @param string|null $status  'pending'|'approved'|'rejected'|null(全件)
     * @return array
     */
    public static function getQueue(?string $status = null): array
    {
        $reviews = self::loadReviews();
        $obs = DataStore::fetchAll('observations');

        $queue = [];
        foreach ($obs as $o) {
            $taxon = $o['taxon'] ?? [];
            if (($taxon['source'] ?? '') !== 'freetext') continue;

            $obsId = $o['id'] ?? '';
            $reviewStatus = $reviews[$obsId]['status'] ?? 'pending';

            if ($status !== null && $reviewStatus !== $status) continue;

            $queue[] = [
                'observation_id' => $obsId,
                'user_id' => $o['user_id'] ?? '',
                'user_name' => $o['user_name'] ?? '',
                'freetext_name' => $taxon['name'] ?? '',
                'scientific_name' => $taxon['scientific_name'] ?? '',
                'observed_at' => $o['observed_at'] ?? '',
                'photo' => $o['photos'][0] ?? null,
                'status' => $reviewStatus,
                'reviewed_at' => $reviews[$obsId]['reviewed_at'] ?? null,
                'resolved_taxon' => $reviews[$obsId]['resolved_taxon'] ?? null,
            ];
        }

        // Sort: pending first, then by date
        usort($queue, function ($a, $b) {
            if ($a['status'] === 'pending' && $b['status'] !== 'pending') return -1;
            if ($a['status'] !== 'pending' && $b['status'] === 'pending') return 1;
            return strcmp($b['observed_at'], $a['observed_at']);
        });

        return $queue;
    }

    /**
     * Freetext同定を承認し、正式なtaxonデータに置換
     * 
     * @param string $obsId         対象観察ID
     * @param array  $resolvedTaxon 正式なtaxonデータ (TaxonData::toObservationTaxon()形式)
     * @return bool
     */
    public static function approve(string $obsId, array $resolvedTaxon): bool
    {
        // Update the observation's taxon
        $allObs = DataStore::fetchAll('observations');
        $found = false;

        foreach ($allObs as &$o) {
            if ($o['id'] === $obsId) {
                // Preserve freetext name as note
                $originalName = $o['taxon']['name'] ?? '';
                $o['taxon'] = array_merge($o['taxon'] ?? [], $resolvedTaxon);
                $o['taxon']['source'] = 'reviewed';
                $o['taxon']['freetext_original'] = $originalName;
                $found = true;
                break;
            }
        }
        unset($o);

        if (!$found) return false;

        // Save observation update (partition-aware)
        self::saveObservations($allObs);

        // Record review decision
        $reviews = self::loadReviews();
        $reviews[$obsId] = [
            'status' => 'approved',
            'reviewed_at' => date('c'),
            'resolved_taxon' => $resolvedTaxon,
        ];
        self::saveReviews($reviews);

        return true;
    }

    /**
     * Freetext同定を却下
     * 
     * @param string $obsId   対象観察ID
     * @param string $reason  却下理由
     * @return bool
     */
    public static function reject(string $obsId, string $reason = ''): bool
    {
        $reviews = self::loadReviews();
        $reviews[$obsId] = [
            'status' => 'rejected',
            'reviewed_at' => date('c'),
            'reason' => $reason,
        ];
        self::saveReviews($reviews);
        return true;
    }

    /**
     * 指定された名前でTaxonSearchServiceを使って候補を検索
     * 
     * @param string $query  検索クエリ
     * @return array  候補リスト
     */
    public static function searchCandidates(string $query): array
    {
        return TaxonSearchService::search($query, ['limit' => 10]);
    }

    /**
     * 統計情報
     */
    public static function getStats(): array
    {
        $reviews = self::loadReviews();
        $queue = self::getQueue();

        return [
            'total' => count($queue),
            'pending' => count(array_filter($queue, fn($q) => $q['status'] === 'pending')),
            'approved' => count(array_filter($queue, fn($q) => $q['status'] === 'approved')),
            'rejected' => count(array_filter($queue, fn($q) => $q['status'] === 'rejected')),
        ];
    }

    // --- Private helpers ---

    private static function loadReviews(): array
    {
        $file = self::getReviewFile();
        if (!file_exists($file)) return [];
        $data = json_decode(file_get_contents($file), true);
        return is_array($data) ? $data : [];
    }

    private static function saveReviews(array $reviews): void
    {
        $file = self::getReviewFile();
        file_put_contents($file, json_encode($reviews, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
    }

    private static function saveObservations(array $allObs): void
    {
        $partitions = [];
        foreach ($allObs as $o) {
            $date = $o['observed_at'] ?? $o['created_at'] ?? date('Y-m-d');
            $month = substr($date, 0, 7);
            $partitions[$month][] = $o;
        }
        foreach ($partitions as $month => $items) {
            $file = DATA_DIR . "/observations/$month.json";
            $dir = dirname($file);
            if (!is_dir($dir)) mkdir($dir, 0755, true);
            file_put_contents($file, json_encode($items, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        }
    }
}
