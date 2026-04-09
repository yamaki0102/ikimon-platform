<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/RedListManager.php';
require_once __DIR__ . '/DistributionAnalyzer.php';
require_once __DIR__ . '/InvasiveAlertManager.php';

/**
 * ObservationSignificanceScorer — 観察の保全・科学的重要度スコアリング
 *
 * 役割:
 *   「この観察は通常観察か、それとも重点観察として深く扱うべきか」を数値化する。
 *   AiAssessmentQueue の lane 昇格、RAG 深度制御、管理者アラートの判断に使う。
 *
 * スコア軸と加算値:
 *   保全重要度 (RedList): CR=+40, EN=+35, VU=+25, NT=+15, DD=+10
 *   地域希少性 (DistributionAnalyzer): area_first=+30, rare=+15
 *   外来種 (InvasiveAlertManager): hit=+20
 *   季節異常 (Omoikane season vs 観察月): mismatch=+15
 *   写真品質: 3枚以上=+5, 5枚以上=+10
 *   外来種でない希少種の誤同定リスク: -5 (近縁種多数の場合)
 *
 * 閾値:
 *   0-29  → normal   (fast/batch lane そのまま)
 *   30-59 → important (batch lane + 拡張 RAG)
 *   60+   → critical  (deep lane + admin alert + evidence bundle)
 */
class ObservationSignificanceScorer
{
    private const THRESHOLD_CRITICAL  = 60;
    private const THRESHOLD_IMPORTANT = 30;

    private const REDLIST_SCORES = [
        'CR'    => 40,
        'EN'    => 35,
        'CR+EN' => 40,
        'VU'    => 25,
        'NT'    => 15,
        'LP'    => 15,
        'DD'    => 10,
    ];

    /**
     * 観察の重要度を評価して返す。
     *
     * @param array $observation 観察データ (taxon, lat, lng, photos, observed_at, prefecture 等)
     * @return array{
     *   significance_score: int,
     *   sensitivity_level: string,
     *   reasons: array,
     *   redlist_category: string|null,
     *   distribution_rarity: string|null,
     *   is_invasive: bool,
     *   needs_deep_assessment: bool,
     *   needs_admin_alert: bool,
     *   photo_count: int,
     * }
     */
    public static function score(array $observation): array
    {
        $taxonName  = self::resolveTaxonName($observation);
        $sciName    = (string)($observation['taxon']['scientific_name'] ?? '');
        $lat        = (float)($observation['latitude'] ?? $observation['lat'] ?? 0);
        $lng        = (float)($observation['longitude'] ?? $observation['lng'] ?? 0);
        $photoCount = count($observation['photos'] ?? []);
        $observedAt = (string)($observation['observed_at'] ?? '');

        $totalScore = 0;
        $reasons    = [];

        // --- 軸1: 保全重要度 (RedList) ---
        $redlistCategory = null;
        if ($taxonName !== '') {
            $redlistCategory = self::resolveRedListCategory($taxonName, $observation['prefecture'] ?? null);
            if ($redlistCategory !== null && isset(self::REDLIST_SCORES[$redlistCategory])) {
                $pts = self::REDLIST_SCORES[$redlistCategory];
                $totalScore += $pts;
                $reasons[] = "レッドリスト({$redlistCategory}): +{$pts}点";
            }
        }

        // --- 軸2: 地域希少性 (DistributionAnalyzer) ---
        $distributionRarity = null;
        if ($taxonName !== '' && $lat !== 0.0 && $lng !== 0.0) {
            try {
                $rarity = DistributionAnalyzer::checkRarity($taxonName, $lat, $lng);
                $distributionRarity = $rarity['rarity_level'];
                if ($rarity['is_rare']) {
                    $pts = $rarity['rarity_level'] === 'area_first' ? 30 : 15;
                    $totalScore += $pts;
                    $reasons[] = "地域希少性({$rarity['rarity_level']} / {$rarity['area_name']}): +{$pts}点";
                }
            } catch (\Throwable $e) {
                // 非致命的 — スキップ
            }
        }

        // --- 軸3: 外来種 ---
        $isInvasive = false;
        if ($taxonName !== '') {
            try {
                $invasiveResult = InvasiveAlertManager::check($taxonName, $sciName);
                if ($invasiveResult !== null) {
                    $isInvasive = true;
                    $totalScore += 20;
                    $reasons[] = "外来種({$invasiveResult['category']}): +20点";
                }
            } catch (\Throwable $e) {
                // 非致命的 — スキップ
            }
        }

        // --- 軸4: 季節異常 (Omoikane ecological_constraints.season と照合) ---
        if ($observedAt !== '' && $taxonName !== '') {
            $seasonMismatch = self::detectSeasonMismatch($taxonName, $sciName, $observedAt);
            if ($seasonMismatch) {
                $totalScore += 15;
                $reasons[] = "季節異常（既知フェノロジーから外れる）: +15点";
            }
        }

        // --- 軸5: 写真品質 ---
        if ($photoCount >= 5) {
            $totalScore += 10;
            $reasons[] = "写真5枚以上: +10点";
        } elseif ($photoCount >= 3) {
            $totalScore += 5;
            $reasons[] = "写真3枚以上: +5点";
        }

        // --- 軸6: 誤同定リスク補正 (希少種かつ類似種多数の場合は慎重に) ---
        // スコアを下げるのではなく、理由に記録して LLM に伝える
        $hasIdentificationRisk = self::checkIdentificationRisk($taxonName, $sciName);
        if ($hasIdentificationRisk && $redlistCategory !== null) {
            $reasons[] = "注意: 近縁種との誤同定リスクあり（慎重な考察が必要）";
        }

        $totalScore = max(0, $totalScore);

        $sensitivityLevel = match (true) {
            $totalScore >= self::THRESHOLD_CRITICAL  => 'critical',
            $totalScore >= self::THRESHOLD_IMPORTANT => 'important',
            default                                  => 'normal',
        };

        return [
            'significance_score'    => $totalScore,
            'sensitivity_level'     => $sensitivityLevel,
            'reasons'               => $reasons,
            'redlist_category'      => $redlistCategory,
            'distribution_rarity'   => $distributionRarity,
            'is_invasive'           => $isInvasive,
            'has_identification_risk' => $hasIdentificationRisk,
            'needs_deep_assessment' => $sensitivityLevel !== 'normal',
            'needs_admin_alert'     => $sensitivityLevel === 'critical',
            'photo_count'           => $photoCount,
        ];
    }

    // --- Private helpers ---

    private static function resolveTaxonName(array $observation): string
    {
        return (string)(
            $observation['taxon']['name'] ??
            $observation['taxon_name'] ??
            $observation['species_name'] ??
            ''
        );
    }

    /**
     * RedListManager で国・都道府県を横断してカテゴリを調べ、最高深刻度のコードを返す。
     */
    private static function resolveRedListCategory(string $taxonName, ?string $prefecture): ?string
    {
        try {
            static $rlm = null;
            if ($rlm === null) {
                $rlm = new RedListManager();
            }

            $prefCode = self::prefNameToCode($prefecture ?? '');
            $result   = $rlm->lookup($taxonName, $prefCode ?: null);
            if (!$result) {
                return null;
            }

            $severityOrder = ['CR' => 5, 'EN' => 4, 'CR+EN' => 5, 'VU' => 3, 'NT' => 2, 'LP' => 2, 'DD' => 1];
            $best          = null;
            $bestScore     = -1;

            foreach ($result as $listId => $entry) {
                $cat = (string)($entry['category_en'] ?? $entry['category'] ?? '');
                $score = $severityOrder[$cat] ?? 0;
                if ($score > $bestScore) {
                    $bestScore = $score;
                    $best      = $cat;
                }
            }

            return $best;
        } catch (\Throwable $e) {
            return null;
        }
    }

    /**
     * OmoikaneDB の ecological_constraints.season と観察月を照合して季節異常を検出する。
     * OmoikaneDB が使えない場合は false を返す（非致命的）。
     */
    private static function detectSeasonMismatch(string $taxonName, string $sciName, string $observedAt): bool
    {
        try {
            $ts = strtotime($observedAt);
            if ($ts === false) {
                return false;
            }
            $observedMonth = (int)date('n', $ts);

            require_once __DIR__ . '/OmoikaneDB.php';
            $db  = new OmoikaneDB();
            $pdo = $db->getPDO();

            $speciesId = null;
            if ($taxonName !== '') {
                $stmt = $pdo->prepare("SELECT id FROM species WHERE japanese_name = :n AND distillation_status = 'distilled' LIMIT 1");
                $stmt->execute([':n' => $taxonName]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $speciesId = $row['id'];
                }
            }
            if ($speciesId === null && $sciName !== '') {
                $stmt = $pdo->prepare("SELECT id FROM species WHERE scientific_name = :n LIMIT 1");
                $stmt->execute([':n' => $sciName]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $speciesId = $row['id'];
                }
            }
            if ($speciesId === null) {
                return false;
            }

            $stmt = $pdo->prepare("SELECT season FROM ecological_constraints WHERE species_id = :id LIMIT 1");
            $stmt->execute([':id' => $speciesId]);
            $eco = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$eco || empty($eco['season'])) {
                return false;
            }

            return self::isSeasonMismatch($eco['season'], $observedMonth);
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * season テキストと観察月を比較してミスマッチを判定する。
     */
    private static function isSeasonMismatch(string $season, int $observedMonth): bool
    {
        $season = strtolower($season);
        $seasonNameMap = [
            'spring' => [3, 4, 5],
            'summer' => [6, 7, 8],
            'autumn' => [9, 10, 11],
            'fall'   => [9, 10, 11],
            'winter' => [12, 1, 2],
            '春'     => [3, 4, 5],
            '夏'     => [6, 7, 8],
            '秋'     => [9, 10, 11],
            '冬'     => [12, 1, 2],
        ];

        foreach ($seasonNameMap as $label => $months) {
            if (mb_strpos($season, $label) !== false) {
                if (!in_array($observedMonth, $months, true)) {
                    return true;
                }
                return false;
            }
        }

        if (preg_match_all('/(\d{1,2})/', $season, $matches)) {
            $nums = array_map('intval', $matches[1]);
            $nums = array_filter($nums, fn($n) => $n >= 1 && $n <= 12);
            $nums = array_values($nums);

            if (count($nums) >= 2) {
                $start = $nums[0];
                $end   = $nums[count($nums) - 1];
                if ($start <= $end) {
                    return !($observedMonth >= $start && $observedMonth <= $end);
                }
                return !($observedMonth >= $start || $observedMonth <= $end);
            }
        }

        return false;
    }

    /**
     * Omoikane identification_keys.similar_species で誤同定リスクを簡易チェック。
     */
    private static function checkIdentificationRisk(string $taxonName, string $sciName): bool
    {
        try {
            require_once __DIR__ . '/OmoikaneDB.php';
            $db  = new OmoikaneDB();
            $pdo = $db->getPDO();

            $speciesId = null;
            if ($taxonName !== '') {
                $stmt = $pdo->prepare("SELECT id FROM species WHERE japanese_name = :n AND distillation_status = 'distilled' LIMIT 1");
                $stmt->execute([':n' => $taxonName]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $speciesId = $row['id'];
                }
            }
            if ($speciesId === null && $sciName !== '') {
                $stmt = $pdo->prepare("SELECT id FROM species WHERE scientific_name = :n LIMIT 1");
                $stmt->execute([':n' => $sciName]);
                $row = $stmt->fetch(PDO::FETCH_ASSOC);
                if ($row) {
                    $speciesId = $row['id'];
                }
            }
            if ($speciesId === null) {
                return false;
            }

            $stmt = $pdo->prepare("SELECT similar_species FROM identification_keys WHERE species_id = :id LIMIT 1");
            $stmt->execute([':id' => $speciesId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row || empty($row['similar_species'])) {
                return false;
            }

            $parts = preg_split('/[,、・\s]+/u', $row['similar_species']);
            $parts = array_filter($parts, fn($p) => mb_strlen(trim($p)) > 1);
            return count($parts) >= 2;
        } catch (\Throwable $e) {
            return false;
        }
    }

    /**
     * 都道府県名 → RedListManager が使う prefCode に変換。
     * 未対応の場合は空文字を返す（国リストのみで判定）。
     */
    private static function prefNameToCode(string $prefName): string
    {
        $map = [
            '静岡県' => 'shizuoka',
            '愛知県' => 'aichi',
            '神奈川県' => 'kanagawa',
            '東京都' => 'tokyo',
            '大阪府' => 'osaka',
        ];
        return $map[$prefName] ?? '';
    }
}
