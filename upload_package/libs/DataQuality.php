<?php

/**
 * DataQuality.php — Data Quality Assessment (Grade A-D)
 *
 * 観察データの品質を4段階で評価する。
 * B2Bレポートの信頼性表示やUI上のバッジ表示に使用。
 *
 * Grade A: Research Grade (写真+位置+2人以上の同定一致)
 * Grade B: Needs ID (写真+位置あり、同定不足)
 * Grade C: Casual (写真なし or 位置なし)
 * Grade D: Incomplete (写真なし AND 位置なし)
 */

class DataQuality
{
    const GRADE_A = 'A';
    const GRADE_B = 'B';
    const GRADE_C = 'C';
    const GRADE_D = 'D';

    /** Grade definitions: label, icon, color, description */
    const GRADES = [
        'A' => [
            'label'       => '研究用',
            'icon'        => 'shield-check',
            'emoji'       => '🟢',
            'color'       => 'text-green-600',
            'bg'          => 'bg-green-50',
            'border'      => 'border-green-200',
            'bar_color'   => 'bg-green-500',
            'description' => 'コミュニティが検証済み。研究・統計に利用可能。',
        ],
        'B' => [
            'label'       => '要同定',
            'icon'        => 'search',
            'emoji'       => '🟡',
            'color'       => 'text-amber-600',
            'bg'          => 'bg-amber-50',
            'border'      => 'border-amber-200',
            'bar_color'   => 'bg-amber-500',
            'description' => '基本情報あり。コミュニティの同定を待っています。',
        ],
        'C' => [
            'label'       => 'カジュアル',
            'icon'        => 'camera-off',
            'emoji'       => '🟠',
            'color'       => 'text-orange-600',
            'bg'          => 'bg-orange-50',
            'border'      => 'border-orange-200',
            'bar_color'   => 'bg-orange-400',
            'description' => '写真または位置情報が不足。統計利用は限定的。',
        ],
        'D' => [
            'label'       => '情報不足',
            'icon'        => 'circle-help',
            'emoji'       => '⚪',
            'color'       => 'text-gray-500',
            'bg'          => 'bg-gray-50',
            'border'      => 'border-gray-200',
            'bar_color'   => 'bg-gray-400',
            'description' => '写真・位置情報なし。メモとして保存。',
        ],
    ];

    /**
     * Calculate data quality grade for an observation.
     *
     * @param array $obs Observation data
     * @return string Grade (A, B, C, D)
     */
    public static function calculate(array $obs): string
    {
        $hasPhotos   = !empty($obs['photos']);
        $hasLocation = !empty($obs['lat']) && !empty($obs['lng']);
        $hasDate     = !empty($obs['observed_at']);

        // Grade D: No photos AND no location
        if (!$hasPhotos && !$hasLocation) {
            return self::GRADE_D;
        }

        // Grade C: Missing photos OR location
        if (!$hasPhotos || !$hasLocation) {
            return self::GRADE_C;
        }

        // Has both photos + location. Check identification consensus.
        $identifications = $obs['identifications'] ?? [];
        $status = $obs['status'] ?? '';

        // Grade A: Research Grade — status is '研究用' or 'Research Grade'
        if (in_array($status, ['研究用', 'Research Grade'], true)) {
            return self::GRADE_A;
        }

        // Grade A alternative: 2+ agreeing identifications on same taxon
        if (count($identifications) >= 2) {
            $taxonCounts = [];
            foreach ($identifications as $id) {
                $name = $id['taxon_name'] ?? '';
                if ($name) {
                    $taxonCounts[$name] = ($taxonCounts[$name] ?? 0) + 1;
                }
            }
            if (!empty($taxonCounts) && max($taxonCounts) >= 2) {
                return self::GRADE_A;
            }
        }

        // Grade B: Has photos + location, but needs more identification
        return self::GRADE_B;
    }

    /**
     * Get grade metadata.
     *
     * @param string $grade
     * @return array
     */
    public static function getGradeInfo(string $grade): array
    {
        return self::GRADES[$grade] ?? self::GRADES[self::GRADE_D];
    }

    /**
     * Get improvement hints for a given observation.
     * Returns actionable tips to upgrade the grade.
     *
     * @param array $obs
     * @return array List of hint strings
     */
    public static function getImprovementHints(array $obs): array
    {
        $grade = self::calculate($obs);
        $hints = [];

        if ($grade === self::GRADE_D || $grade === self::GRADE_C) {
            if (empty($obs['photos'])) {
                $hints[] = ['icon' => 'camera', 'text' => '📸 写真を追加するとグレードが上がります'];
            }
            if (empty($obs['lat']) || empty($obs['lng'])) {
                $hints[] = ['icon' => 'map-pin', 'text' => '📍 位置情報を追加するとグレードが上がります'];
            }
        }

        if ($grade === self::GRADE_B) {
            $idCount = count($obs['identifications'] ?? []);
            if ($idCount === 0) {
                $hints[] = ['icon' => 'tag', 'text' => '🏷️ 種名を提案してみんなの力でグレードAへ'];
            } elseif ($idCount === 1) {
                $hints[] = ['icon' => 'users', 'text' => '👥 もう1人の同定があればグレードAに到達します'];
            }
        }

        return $hints;
    }

    /**
     * Analyze a user's identification expertise by taxonomic group.
     * Returns an array of orders (目) with weighted scores.
     * Identifications matching consensus get 2x weight (quality bonus).
     *
     * @param string $userId
     * @return array ['order_name' => weighted_score, ...]  sorted desc
     */
    public static function getUserExpertise(string $userId): array
    {
        $allObs = DataStore::fetchAll('observations');
        $expertise = [];

        foreach ($allObs as $obs) {
            // Skip user's own observations
            if (($obs['user_id'] ?? '') === $userId) continue;

            foreach ($obs['identifications'] ?? [] as $id) {
                if (($id['user_id'] ?? '') !== $userId) continue;

                // Extract order from lineage
                $order = $id['lineage']['order'] ?? null;
                if (!$order) {
                    $order = $obs['taxon']['lineage']['order'] ?? null;
                }
                if (!$order) continue;

                // Weight: does this ID match the observation's consensus taxon?
                $weight = 1;
                $consensusTaxon = $obs['taxon']['name'] ?? '';
                $idTaxon = $id['taxon']['name'] ?? ($id['taxon_name'] ?? '');
                if ($consensusTaxon && $idTaxon && $consensusTaxon === $idTaxon) {
                    $weight = 2; // Quality bonus for matching consensus
                }

                $expertise[$order] = ($expertise[$order] ?? 0) + $weight;
            }
        }

        arsort($expertise);
        return $expertise;
    }

    /**
     * Get observations needing identification that match a user's expertise.
     *
     * @param string $userId
     * @param int $limit
     * @return array Filtered observations
     */
    public static function getRecommendedForUser(string $userId, int $limit = 20): array
    {
        $expertise = self::getUserExpertise($userId);
        if (empty($expertise)) return [];

        $expertOrders = array_keys(array_slice($expertise, 0, 5, true));

        $allObs = DataStore::fetchAll('observations');
        $recommended = [];

        foreach ($allObs as $obs) {
            // Skip own observations
            if (($obs['user_id'] ?? '') === $userId) continue;

            // Only Grade B (needs ID)
            if (self::calculate($obs) !== self::GRADE_B) continue;

            // Already identified by this user?
            $alreadyIdentified = false;
            foreach ($obs['identifications'] ?? [] as $id) {
                if (($id['user_id'] ?? '') === $userId) {
                    $alreadyIdentified = true;
                    break;
                }
            }
            if ($alreadyIdentified) continue;

            // Check if observation's order matches expertise
            $obsOrder = $obs['taxon']['lineage']['order'] ?? null;
            if ($obsOrder && in_array($obsOrder, $expertOrders, true)) {
                $recommended[] = $obs;
                if (count($recommended) >= $limit) break;
            }
        }

        return $recommended;
    }
}
