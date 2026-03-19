<?php

/**
 * GrowthTracker — ユーザーの観察力変化を追跡
 *
 * 月次スナップショットで3指標を記録:
 * - avg_taxon_depth: 分類のランク深度平均（species=7...kingdom=1）
 * - evidence_diversity: evidence_tags のユニーク種類数
 * - taxon_breadth: カバーする綱（class）の数
 */

require_once __DIR__ . '/DataStore.php';

class GrowthTracker
{
    private const RANK_DEPTH = [
        'kingdom' => 1,
        'phylum' => 2,
        'class' => 3,
        'order' => 4,
        'family' => 5,
        'genus' => 6,
        'species' => 7,
        'subspecies' => 7,
    ];

    /**
     * ユーザーの現在の観察力スナップショットを計算
     */
    public static function snapshot(string $userId): array
    {
        $allObs = DataStore::fetchAll('observations');
        $userObs = array_filter($allObs, function ($o) use ($userId) {
            return ($o['user_id'] ?? '') === $userId;
        });

        if (empty($userObs)) {
            return [
                'month' => date('Y-m'),
                'metrics' => [
                    'avg_taxon_depth' => 0,
                    'evidence_diversity' => 0,
                    'taxon_breadth' => 0,
                    'total_species' => 0,
                    'total_observations' => 0,
                ],
                'created_at' => date('c'),
            ];
        }

        return [
            'month' => date('Y-m'),
            'metrics' => [
                'avg_taxon_depth' => self::calcAvgTaxonDepth($userObs),
                'evidence_diversity' => self::calcEvidenceDiversity($userObs),
                'taxon_breadth' => self::calcTaxonBreadth($userObs),
                'total_species' => self::calcSpeciesCount($userObs),
                'total_observations' => count($userObs),
            ],
            'created_at' => date('c'),
        ];
    }

    /**
     * スナップショットを保存（月1回自動更新）
     */
    public static function updateSnapshot(string $userId): array
    {
        $file = 'growth/' . $userId;
        $dir = DATA_DIR . '/growth';
        if (!is_dir($dir)) {
            mkdir($dir, 0777, true);
        }

        $history = DataStore::get($file) ?: [];
        $currentMonth = date('Y-m');

        // 今月分があれば上書き、なければ追加
        $snap = self::snapshot($userId);
        $updated = false;
        foreach ($history as &$h) {
            if (($h['month'] ?? '') === $currentMonth) {
                $h = $snap;
                $updated = true;
                break;
            }
        }
        unset($h);
        if (!$updated) {
            $history[] = $snap;
        }

        // 最新24ヶ月分のみ保持
        if (count($history) > 24) {
            $history = array_slice($history, -24);
        }

        DataStore::save($file, $history);
        return $snap;
    }

    /**
     * 成長ログを取得
     */
    public static function getHistory(string $userId): array
    {
        $file = 'growth/' . $userId;
        return DataStore::get($file) ?: [];
    }

    /**
     * 成長メッセージを生成（コードベース、AI不使用）
     */
    public static function generateMessages(string $userId): array
    {
        $history = self::getHistory($userId);
        if (count($history) < 2) {
            // データ不足時は現在の絶対値で表示
            $snap = !empty($history) ? $history[count($history) - 1] : self::snapshot($userId);
            $m = $snap['metrics'] ?? [];
            $msgs = [];
            if (($m['total_observations'] ?? 0) > 0) {
                $msgs[] = sprintf('%d件の観察を記録したよ', $m['total_observations']);
            }
            if (($m['total_species'] ?? 0) > 0) {
                $msgs[] = sprintf('%d種類の生き物に出会った', $m['total_species']);
            }
            return $msgs;
        }

        $current = $history[count($history) - 1]['metrics'] ?? [];
        $prev = $history[count($history) - 2]['metrics'] ?? [];
        $messages = [];

        // 分類精度の向上
        $depthDiff = ($current['avg_taxon_depth'] ?? 0) - ($prev['avg_taxon_depth'] ?? 0);
        if ($depthDiff >= 0.3) {
            $messages[] = '以前より一段深い分類ができるようになったよ';
        }

        // 証拠タグの多様化
        $evDiff = ($current['evidence_diversity'] ?? 0) - ($prev['evidence_diversity'] ?? 0);
        if ($evDiff >= 1) {
            $messages[] = sprintf('新しい観察ポイントを%d種類使えるようになった', (int)$evDiff);
        }

        // 分類群の拡大
        $breadthDiff = ($current['taxon_breadth'] ?? 0) - ($prev['taxon_breadth'] ?? 0);
        if ($breadthDiff >= 1) {
            $messages[] = '見る世界がさらに広がっている';
        }

        // 種数の増加
        $speciesDiff = ($current['total_species'] ?? 0) - ($prev['total_species'] ?? 0);
        if ($speciesDiff > 0) {
            $messages[] = sprintf('先月から%d種類の新しい生き物に出会った', (int)$speciesDiff);
        }

        if (empty($messages)) {
            $messages[] = '着実に観察を続けているよ。この調子！';
        }

        return $messages;
    }

    // --- 計算メソッド ---

    private static function calcAvgTaxonDepth(array $observations): float
    {
        $depths = [];
        foreach ($observations as $obs) {
            // ユーザーの同定ランクを優先、なければtaxonのrank
            $rank = '';
            foreach ($obs['identifications'] ?? [] as $id) {
                if (!empty($id['taxon_rank'])) {
                    $rank = strtolower($id['taxon_rank']);
                    break;
                }
            }
            if (!$rank) {
                $rank = strtolower($obs['taxon']['rank'] ?? '');
            }
            if (isset(self::RANK_DEPTH[$rank])) {
                $depths[] = self::RANK_DEPTH[$rank];
            }
        }
        return empty($depths) ? 0 : round(array_sum($depths) / count($depths), 2);
    }

    private static function calcEvidenceDiversity(array $observations): int
    {
        $tags = [];
        foreach ($observations as $obs) {
            foreach ($obs['evidence_tags'] ?? [] as $tag) {
                $tags[$tag] = true;
            }
        }
        return count($tags);
    }

    private static function calcTaxonBreadth(array $observations): int
    {
        $classes = [];
        foreach ($observations as $obs) {
            $class = $obs['taxon']['lineage']['class'] ?? '';
            if ($class !== '') {
                $classes[$class] = true;
            }
        }
        return count($classes);
    }

    private static function calcSpeciesCount(array $observations): int
    {
        $species = [];
        foreach ($observations as $obs) {
            $key = $obs['taxon']['key'] ?? ($obs['taxon']['name'] ?? '');
            if ($key !== '') {
                $species[$key] = true;
            }
        }
        return count($species);
    }
}
