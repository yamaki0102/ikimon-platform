<?php

/**
 * EvidenceTierPromoter — Evidence Tier 自動昇格ロジック
 *
 * ADR-005 準拠。
 *
 * Tier 1   → AI単独判定
 * Tier 1.5 → AI高確信度 + 生態学的妥当性（自動昇格）
 * Tier 2   → コミュニティ検証（1名 reviewer 確認）
 * Tier 3   → 合意形成（2名合意 or 専門家1名）
 * Tier 4   → 外部監査（DNA, 標本, 学術引用）
 *
 * 全メソッド static。
 */

require_once __DIR__ . '/CanonicalStore.php';

class EvidenceTierPromoter
{
    // Tier 1 → 1.5 自動昇格の閾値
    const AUTO_PROMOTE_MIN_CONFIDENCE = 0.80;
    const NEARBY_RADIUS_M = 500;
    const NEARBY_YEARS = 3;

    /**
     * Tier 1 → 1.5 の自動昇格を試みる
     *
     * 条件:
     *   1. AI 確信度 ≥ 0.80
     *   2. 地域に当該種の過去の記録あり（500m圏内、過去3年）
     *   3. 季節的に妥当（繁殖期・越冬期の活動パターン一致）
     *
     * @return array 昇格結果 { promoted: bool, tier: float, context: array }
     */
    public static function tryAutoPromote(string $occurrenceId): array
    {
        $occ = CanonicalStore::getOccurrence($occurrenceId);
        if (!$occ) {
            return ['promoted' => false, 'error' => 'Occurrence not found'];
        }

        // 既に Tier 1 を超えている場合はスキップ
        if ($occ['evidence_tier'] > 1) {
            return ['promoted' => false, 'tier' => $occ['evidence_tier'], 'reason' => 'Already above Tier 1'];
        }

        $context = [
            'base' => $occ['detection_confidence'] ?? 0,
            'boosts' => [],
            'method' => 'contextual_boosting_v1',
        ];

        // 条件1: AI 確信度チェック
        $confidence = $occ['detection_confidence'] ?? 0;
        if ($confidence < self::AUTO_PROMOTE_MIN_CONFIDENCE) {
            return ['promoted' => false, 'tier' => 1, 'reason' => 'Confidence below threshold', 'context' => $context];
        }

        // 条件2: 近隣に過去の記録があるか
        $nearbyBoost = self::checkNearbyRecords($occ);
        if ($nearbyBoost) {
            $context['boosts'][] = $nearbyBoost;
        }

        // 条件3: 季節的妥当性
        $seasonBoost = self::checkSeasonalActivity($occ);
        if ($seasonBoost) {
            $context['boosts'][] = $seasonBoost;
        }

        // 昇格判定: 確信度が高く、近隣記録 OR 季節マッチがあれば昇格
        $totalBoost = array_sum(array_column($context['boosts'], 'value'));
        $adjusted = min(1.0, $confidence + $totalBoost);
        $context['adjusted'] = round($adjusted, 3);

        $shouldPromote = $confidence >= self::AUTO_PROMOTE_MIN_CONFIDENCE
            && count($context['boosts']) >= 1;

        if ($shouldPromote) {
            CanonicalStore::updateEvidenceTier($occurrenceId, 1.5, 'auto');

            // confidence_context を保存
            $pdo = self::getPDO();
            $stmt = $pdo->prepare("
                UPDATE occurrences
                SET adjusted_confidence = :adj, confidence_context = :ctx
                WHERE occurrence_id = :id
            ");
            $stmt->execute([
                ':adj' => $adjusted,
                ':ctx' => json_encode($context, JSON_UNESCAPED_UNICODE),
                ':id'  => $occurrenceId,
            ]);

            return ['promoted' => true, 'tier' => 1.5, 'context' => $context];
        }

        return ['promoted' => false, 'tier' => 1, 'reason' => 'No contextual evidence', 'context' => $context];
    }

    /**
     * 複数検出による統計的昇格（ライブスキャン用）
     *
     * 同じ種が短時間に N 回以上検出 → Tier 1.5
     */
    public static function tryStatisticalPromote(string $eventId, string $scientificName, int $minCount = 5): array
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("
            SELECT COUNT(*) FROM occurrences
            WHERE event_id = :eid AND scientific_name = :name AND evidence_tier = 1
        ");
        $stmt->execute([':eid' => $eventId, ':name' => $scientificName]);
        $count = (int) $stmt->fetchColumn();

        if ($count >= $minCount) {
            // 該当する全 occurrence を Tier 1.5 に昇格
            $update = $pdo->prepare("
                UPDATE occurrences
                SET evidence_tier = 1.5, evidence_tier_at = :at, evidence_tier_by = 'auto:statistical'
                WHERE event_id = :eid AND scientific_name = :name AND evidence_tier = 1
            ");
            $update->execute([
                ':at'   => date('c'),
                ':eid'  => $eventId,
                ':name' => $scientificName,
            ]);

            return ['promoted' => true, 'tier' => 1.5, 'count' => $count, 'method' => 'statistical'];
        }

        return ['promoted' => false, 'count' => $count, 'min_required' => $minCount];
    }

    /**
     * レビューによる昇格（Tier 2/3）
     *
     * @param string $occurrenceId 対象 occurrence
     * @param string $reviewerId   レビュアーの user_id
     * @param string $action       'approve' | 'reject'
     * @param string $taxonName    レビュアーの同定結果
     * @param string $reviewerLevel 'L0'-'L3'
     */
    public static function processReview(
        string $occurrenceId,
        string $reviewerId,
        string $action,
        string $taxonName,
        string $reviewerLevel = 'L1'
    ): array {
        // 同定を記録（immutable）
        CanonicalStore::addIdentification([
            'occurrence_id'       => $occurrenceId,
            'identified_by'       => $reviewerId,
            'taxon_name'          => $taxonName,
            'identification_method' => 'visual',
            'reviewer_level'      => $reviewerLevel,
        ]);

        if ($action !== 'approve') {
            return ['promoted' => false, 'action' => $action];
        }

        // 合意数を数える
        $identifications = CanonicalStore::getIdentificationHistory($occurrenceId);
        $approvals = array_filter($identifications, fn($id) =>
            $id['taxon_name'] === $taxonName && $id['identified_by'] !== 'auto'
        );
        $approvalCount = count($approvals);

        // 専門家（L3）が1名でも承認 → Tier 3
        $hasExpert = !empty(array_filter($approvals, fn($id) => $id['reviewer_level'] === 'L3'));

        $occ = CanonicalStore::getOccurrence($occurrenceId);
        $currentTier = $occ['evidence_tier'] ?? 1;

        if ($hasExpert && $currentTier < 3) {
            CanonicalStore::updateEvidenceTier($occurrenceId, 3, $reviewerId);
            return ['promoted' => true, 'tier' => 3, 'reason' => 'Expert approval'];
        }

        if ($approvalCount >= 2 && $currentTier < 3) {
            CanonicalStore::updateEvidenceTier($occurrenceId, 3, 'consensus');
            return ['promoted' => true, 'tier' => 3, 'reason' => 'Community consensus'];
        }

        if ($approvalCount >= 1 && $currentTier < 2) {
            CanonicalStore::updateEvidenceTier($occurrenceId, 2, $reviewerId);
            return ['promoted' => true, 'tier' => 2, 'reason' => 'Single reviewer'];
        }

        return ['promoted' => false, 'tier' => $currentTier, 'approvals' => $approvalCount];
    }

    // ─── Internal helpers ───────────────────────────────────────

    /**
     * 近隣の過去記録をチェック
     */
    private static function checkNearbyRecords(array $occ): ?array
    {
        $event = CanonicalStore::getEvent($occ['event_id']);
        if (!$event || !$event['decimal_latitude'] || !$event['decimal_longitude']) {
            return null;
        }

        $pdo = self::getPDO();
        $lat = $event['decimal_latitude'];
        $lng = $event['decimal_longitude'];
        $radiusDeg = self::NEARBY_RADIUS_M / 111000.0;
        $cutoff = date('Y-m-d', strtotime('-' . self::NEARBY_YEARS . ' years'));

        $stmt = $pdo->prepare("
            SELECT COUNT(*) FROM occurrences o
            JOIN events e ON o.event_id = e.event_id
            WHERE o.scientific_name = :name
              AND o.evidence_tier >= 1.5
              AND e.event_date >= :cutoff
              AND e.decimal_latitude BETWEEN :lat_min AND :lat_max
              AND e.decimal_longitude BETWEEN :lng_min AND :lng_max
              AND o.occurrence_id != :self_id
        ");
        $stmt->execute([
            ':name'    => $occ['scientific_name'],
            ':cutoff'  => $cutoff,
            ':lat_min' => $lat - $radiusDeg,
            ':lat_max' => $lat + $radiusDeg,
            ':lng_min' => $lng - $radiusDeg,
            ':lng_max' => $lng + $radiusDeg,
            ':self_id' => $occ['occurrence_id'],
        ]);
        $count = (int) $stmt->fetchColumn();

        if ($count > 0) {
            return [
                'type'     => 'nearby_observations',
                'value'    => min(0.15, $count * 0.05),
                'count'    => $count,
                'radius_m' => self::NEARBY_RADIUS_M,
            ];
        }

        return null;
    }

    /**
     * 季節的妥当性をチェック
     *
     * 簡易実装: 同じ月に過去の記録があればOK
     */
    private static function checkSeasonalActivity(array $occ): ?array
    {
        $event = CanonicalStore::getEvent($occ['event_id']);
        if (!$event) return null;

        $month = (int) date('n', strtotime($event['event_date']));

        $pdo = self::getPDO();
        $stmt = $pdo->prepare("
            SELECT COUNT(*) FROM occurrences o
            JOIN events e ON o.event_id = e.event_id
            WHERE o.scientific_name = :name
              AND CAST(strftime('%m', e.event_date) AS INTEGER) = :month
              AND o.evidence_tier >= 1.5
              AND o.occurrence_id != :self_id
        ");
        $stmt->execute([
            ':name'    => $occ['scientific_name'],
            ':month'   => $month,
            ':self_id' => $occ['occurrence_id'],
        ]);
        $count = (int) $stmt->fetchColumn();

        if ($count > 0) {
            return [
                'type'  => 'seasonal_activity',
                'value' => 0.05,
                'month' => $month,
            ];
        }

        return null;
    }

    private static function getPDO(): PDO
    {
        // CanonicalStore の PDO を使いたいが private なので、直接作る
        static $pdo = null;
        if ($pdo === null) {
            $dbPath = DATA_DIR . '/ikimon.db';
            $pdo = new PDO('sqlite:' . $dbPath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            $pdo->exec('PRAGMA journal_mode = WAL');
        }
        return $pdo;
    }
}
