<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';

/**
 * IdentifiabilityScorer — 分類群×地域の写真同定可能性スコア
 *
 * 過去の同定修正パターンを分析し、写真では種レベル同定が困難な分類群を検出する。
 * iNaturalist フォーラムで 72+ 返信の長年の課題への回答。
 */
class IdentifiabilityScorer
{
    private const SCORES_FILE = DATA_DIR . '/config/identifiability_scores.json';
    private const CORRECTION_THRESHOLD = 0.40;
    private const MIN_SAMPLE_SIZE = 5;

    private static ?array $scores = null;

    public static function load(): array
    {
        if (self::$scores !== null) return self::$scores;
        if (file_exists(self::SCORES_FILE)) {
            self::$scores = json_decode(file_get_contents(self::SCORES_FILE), true) ?: [];
        } else {
            self::$scores = [];
        }
        return self::$scores;
    }

    /**
     * 分類群の同定可能性を評価
     *
     * @param string $taxonGroup 分類群名（目・科レベル）
     * @param string|null $region 地域（都道府県、null=全国）
     * @return array{identifiable: bool, score: float, recommended_rank: string, message: string|null}
     */
    public static function evaluate(string $taxonGroup, ?string $region = null): array
    {
        $scores = self::load();

        $key = self::buildKey($taxonGroup, $region);
        $entry = $scores[$key] ?? null;

        if ($entry === null && $region !== null) {
            $key = self::buildKey($taxonGroup, null);
            $entry = $scores[$key] ?? null;
        }

        if ($entry === null) {
            return [
                'identifiable' => true,
                'score' => 1.0,
                'recommended_rank' => 'species',
                'message' => null,
            ];
        }

        $correctionRate = (float)($entry['correction_rate'] ?? 0);
        $sampleSize = (int)($entry['sample_size'] ?? 0);

        if ($sampleSize < self::MIN_SAMPLE_SIZE) {
            return [
                'identifiable' => true,
                'score' => 1.0,
                'recommended_rank' => 'species',
                'message' => null,
            ];
        }

        $identifiable = $correctionRate < self::CORRECTION_THRESHOLD;
        $recommendedRank = $identifiable ? 'species' : ($entry['recommended_rank'] ?? 'genus');

        $message = null;
        if (!$identifiable) {
            $groupName = $entry['display_name'] ?? $taxonGroup;
            $message = match ($recommendedRank) {
                'family' => "{$groupName}は写真での種同定が非常に難しいグループです。科レベルでの投稿を推奨します",
                'genus' => "{$groupName}は写真での種同定が難しいグループです。属レベルでの投稿を推奨します",
                default => "{$groupName}は写真だけでは種の特定が困難な場合があります",
            };
        }

        return [
            'identifiable' => $identifiable,
            'score' => round(1.0 - $correctionRate, 3),
            'recommended_rank' => $recommendedRank,
            'message' => $message,
            'correction_rate' => $correctionRate,
            'sample_size' => $sampleSize,
        ];
    }

    /**
     * AI 提案の候補リストにidentifiabilityフィルタを適用
     *
     * @param array $suggestions ai_suggest の候補配列
     * @param string|null $region 地域
     * @return array フィルタ済み候補（identifiability_warning 付き）
     */
    public static function filterSuggestions(array $suggestions, ?string $region = null): array
    {
        $scores = self::load();
        if (empty($scores)) return $suggestions;

        foreach ($suggestions as &$s) {
            $label = $s['label'] ?? '';
            if (empty($label)) continue;

            $eval = self::evaluate($label, $region);
            if (!$eval['identifiable']) {
                $s['identifiability_warning'] = $eval['message'];
                $s['recommended_rank'] = $eval['recommended_rank'];
            }
        }
        unset($s);
        return $suggestions;
    }

    /**
     * バッチ計算: 全観察の同定修正率を分類群別に集計
     * scripts/calc_identifiability.php から呼ばれる
     */
    public static function recalculate(): array
    {
        $observations = DataStore::fetchAll('observations');
        $stats = [];

        foreach ($observations as $obs) {
            $ids = $obs['identifications'] ?? [];
            if (count($ids) < 2) continue;

            $firstId = $ids[0] ?? null;
            $lastId = end($ids);
            if (!$firstId || !$lastId) continue;

            $firstTaxon = $firstId['taxon_name'] ?? '';
            $lastTaxon = $lastId['taxon_name'] ?? '';
            if (empty($firstTaxon) || empty($lastTaxon)) continue;

            $group = self::extractGroup($obs);
            if (empty($group)) continue;

            if (!isset($stats[$group])) {
                $stats[$group] = ['total' => 0, 'corrected' => 0, 'display_name' => $group];
            }
            $stats[$group]['total']++;
            if ($firstTaxon !== $lastTaxon) {
                $stats[$group]['corrected']++;
            }
        }

        self::addKnownDifficultGroups($stats);

        $scores = [];
        foreach ($stats as $group => $data) {
            $total = $data['total'];
            if ($total < self::MIN_SAMPLE_SIZE) continue;

            $rate = $data['corrected'] / $total;
            $recommendedRank = 'species';
            if ($rate >= 0.60) {
                $recommendedRank = 'family';
            } elseif ($rate >= self::CORRECTION_THRESHOLD) {
                $recommendedRank = 'genus';
            }

            $key = self::buildKey($group, null);
            $scores[$key] = [
                'taxon_group' => $group,
                'display_name' => $data['display_name'],
                'correction_rate' => round($rate, 4),
                'sample_size' => $total,
                'corrected_count' => $data['corrected'],
                'recommended_rank' => $recommendedRank,
                'calculated_at' => date('c'),
            ];
        }

        $dir = dirname(self::SCORES_FILE);
        if (!is_dir($dir)) mkdir($dir, 0755, true);
        file_put_contents(self::SCORES_FILE, json_encode($scores, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
        self::$scores = $scores;

        return $scores;
    }

    private static function extractGroup(array $obs): ?string
    {
        $lineage = $obs['taxon']['lineage'] ?? [];
        return $lineage['family'] ?? ($lineage['order'] ?? ($lineage['class'] ?? null));
    }

    private static function buildKey(string $taxonGroup, ?string $region): string
    {
        $key = mb_strtolower(trim($taxonGroup));
        if ($region !== null) {
            $key .= ':' . mb_strtolower(trim($region));
        }
        return $key;
    }

    /**
     * 生物学的に写真同定困難と知られているグループを追加
     * データが少ない初期段階でも機能するように
     */
    private static function addKnownDifficultGroups(array &$stats): void
    {
        $knownDifficult = [
            'ハエ目' => ['rate' => 0.55, 'rank' => 'family', 'display' => 'ハエ目（双翅目）'],
            'ハチ目' => ['rate' => 0.45, 'rank' => 'genus', 'display' => 'ハチ目（膜翅目）'],
            'ダニ目' => ['rate' => 0.70, 'rank' => 'family', 'display' => 'ダニ目'],
            'ヨコバイ科' => ['rate' => 0.50, 'rank' => 'genus', 'display' => 'ヨコバイ科'],
            'イネ科' => ['rate' => 0.55, 'rank' => 'genus', 'display' => 'イネ科'],
            'スゲ属' => ['rate' => 0.60, 'rank' => 'genus', 'display' => 'スゲ属（カヤツリグサ科）'],
            'コケ植物門' => ['rate' => 0.65, 'rank' => 'family', 'display' => 'コケ植物'],
            '地衣類' => ['rate' => 0.60, 'rank' => 'family', 'display' => '地衣類'],
        ];

        foreach ($knownDifficult as $group => $meta) {
            if (isset($stats[$group]) && $stats[$group]['total'] >= self::MIN_SAMPLE_SIZE) {
                continue;
            }
            $stats[$group] = [
                'total' => self::MIN_SAMPLE_SIZE,
                'corrected' => (int)round($meta['rate'] * self::MIN_SAMPLE_SIZE),
                'display_name' => $meta['display'],
            ];
        }
    }
}
