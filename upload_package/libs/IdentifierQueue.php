<?php

/**
 * IdentifierQueue.php — Smart Identification Queue
 *
 * 同定者に最適な観察を優先的に提示するスマートキュー。
 * 同定者の得意分野（分類群エキスパティーズ）に基づき、
 * 最も効果的な同定リクエストを自動配分する。
 *
 * 優先度計算要素:
 *   1. 分類群マッチ: 同定者の得意分類群と一致
 *   2. データ品質: Grade B（写真+位置あり、同定不足）を優先
 *   3. 鮮度: 新しい観察ほど高優先
 *   4. 既存同定数: 同定が1件の観察を優先（あと1人でRG）
 *   5. 地域バランス: 同じサイトに集中しない
 */

class IdentifierQueue
{
    /** キュー優先度の重み */
    const WEIGHT_TAXON_MATCH  = 5.0;  // 得意分類群マッチ
    const WEIGHT_NEAR_RG      = 4.0;  // あと1人でResearch Grade
    const WEIGHT_FRESHNESS    = 2.0;  // 鮮度ボーナス（7日以内）
    const WEIGHT_NO_ID        = 1.5;  // まだ同定なし
    const WEIGHT_HAS_AI       = 1.0;  // AI候補あり（参考情報）

    /** 鮮度の基準日数 */
    const FRESHNESS_DAYS = 7;

    /** キューサイズのデフォルト上限 */
    const DEFAULT_LIMIT = 20;

    /**
     * 指定ユーザーに最適化されたキューを生成する。
     *
     * @param string $userId   同定者のユーザーID
     * @param int    $limit    最大件数
     * @param array  $filters  追加フィルタ ['site_id' => string, 'taxon_group' => string]
     * @return array スコア付き観察リスト [{observation, score, reasons}, ...]
     */
    public static function buildQueue(string $userId, int $limit = self::DEFAULT_LIMIT, array $filters = []): array
    {
        // 同定者の得意分類群を取得
        $expertise = DataQuality::getUserExpertise($userId);
        $expertOrders = array_keys(array_slice($expertise, 0, 10, true));

        // 全観察を取得してフィルタリング
        $candidates = self::getCandidateObservations($userId, $filters);

        // スコアリング
        $scored = [];
        $now = time();
        $seenSites = [];

        foreach ($candidates as $obs) {
            $score = 0.0;
            $reasons = [];

            // 1. 分類群マッチ
            $obsOrder = $obs['taxon']['lineage']['order'] ?? null;
            if ($obsOrder && in_array($obsOrder, $expertOrders, true)) {
                $rank = array_search($obsOrder, $expertOrders);
                $matchScore = self::WEIGHT_TAXON_MATCH * (1 - $rank * 0.1);
                $score += $matchScore;
                $reasons[] = '得意分類群';
            }

            // 2. あと1人でRG
            $idCount = count($obs['identifications'] ?? []);
            if ($idCount === 1) {
                $score += self::WEIGHT_NEAR_RG;
                $reasons[] = 'あと1人でRG';
            } elseif ($idCount === 0) {
                $score += self::WEIGHT_NO_ID;
                $reasons[] = '未同定';
            }

            // 3. 鮮度
            $observedAt = strtotime($obs['observed_at'] ?? $obs['created_at'] ?? '');
            if ($observedAt && ($now - $observedAt) < self::FRESHNESS_DAYS * 86400) {
                $daysSince = ($now - $observedAt) / 86400;
                $freshnessScore = self::WEIGHT_FRESHNESS * (1 - $daysSince / self::FRESHNESS_DAYS);
                $score += max(0, $freshnessScore);
                $reasons[] = '新しい観察';
            }

            // 4. AI候補あり
            if (!empty($obs['ai_assessment'])) {
                $score += self::WEIGHT_HAS_AI;
                $reasons[] = 'AI候補あり';
            }

            // 5. 地域バランス（同じサイトからは減点）
            $siteId = $obs['site_id'] ?? 'none';
            $siteCount = $seenSites[$siteId] ?? 0;
            if ($siteCount > 2) {
                $score *= 0.7; // 30%減点
            }
            $seenSites[$siteId] = $siteCount + 1;

            $scored[] = [
                'observation' => $obs,
                'score'       => round($score, 2),
                'reasons'     => $reasons,
            ];
        }

        // スコア降順ソート
        usort($scored, fn($a, $b) => $b['score'] <=> $a['score']);

        return array_slice($scored, 0, $limit);
    }

    /**
     * 特定の分類群でキューをフィルタリングする。
     *
     * @param string $userId
     * @param string $taxonGroup 分類群（例: 'Aves', 'Insecta'）
     * @param int    $limit
     * @return array
     */
    public static function buildQueueForGroup(string $userId, string $taxonGroup, int $limit = self::DEFAULT_LIMIT): array
    {
        return self::buildQueue($userId, $limit, ['taxon_group' => $taxonGroup]);
    }

    /**
     * キュー統計を取得する。
     *
     * @return array {total_needs_id: int, by_group: array, by_site: array, near_rg: int}
     */
    public static function getQueueStats(): array
    {
        $allObs = DataStore::fetchAll('observations');
        $stats = [
            'total_needs_id' => 0,
            'near_rg'        => 0,
            'by_group'       => [],
            'by_site'        => [],
        ];

        foreach ($allObs as $obs) {
            $grade = $obs['data_quality'] ?? DataQuality::calculate($obs);
            if ($grade !== 'B') continue;

            $stats['total_needs_id']++;

            $idCount = count($obs['identifications'] ?? []);
            if ($idCount === 1) {
                $stats['near_rg']++;
            }

            $group = $obs['taxon']['lineage']['class'] ?? $obs['taxon']['group'] ?? 'Unknown';
            $stats['by_group'][$group] = ($stats['by_group'][$group] ?? 0) + 1;

            $siteId = $obs['site_id'] ?? 'none';
            if ($siteId !== 'none') {
                $stats['by_site'][$siteId] = ($stats['by_site'][$siteId] ?? 0) + 1;
            }
        }

        arsort($stats['by_group']);
        arsort($stats['by_site']);

        return $stats;
    }

    /**
     * 同定候補の観察を取得する（内部用）。
     */
    private static function getCandidateObservations(string $userId, array $filters = []): array
    {
        $allObs = DataStore::fetchAll('observations');
        $candidates = [];

        foreach ($allObs as $obs) {
            // 自分の観察は除外
            if (($obs['user_id'] ?? '') === $userId) continue;

            // Grade B のみ（同定待ち）
            $grade = $obs['data_quality'] ?? DataQuality::calculate($obs);
            if ($grade !== 'B') continue;

            // 既に自分が同定済みなら除外
            foreach ($obs['identifications'] ?? [] as $id) {
                if (($id['user_id'] ?? '') === $userId) continue 2;
            }

            // サイトフィルタ
            if (!empty($filters['site_id']) && ($obs['site_id'] ?? '') !== $filters['site_id']) {
                continue;
            }

            // 分類群フィルタ
            if (!empty($filters['taxon_group'])) {
                $obsGroup = $obs['taxon']['lineage']['class']
                    ?? $obs['taxon']['group']
                    ?? '';
                if ($obsGroup !== $filters['taxon_group']) continue;
            }

            $candidates[] = $obs;
        }

        return $candidates;
    }
}
