<?php

/**
 * KnowledgeAutoReviewer.php — 蒸留知識の自動承認 + アラート
 *
 * 上流知識（学術論文からの AI 蒸留結果）を自動審査する。
 * 信頼できるソース + 高信頼度 → 自動承認
 * 問題の兆候がある場合 → アラートフラグ付きで要チェック
 *
 * 設計思想:
 *   学術論文は基本的に信頼できるソース。
 *   「デフォルト承認、例外だけ人間が確認」のワークフロー。
 *   100年データ: 全判定理由を記録し、将来の監査に対応。
 */

class KnowledgeAutoReviewer
{
    // === 承認ポリシー定数 ===

    /** 自動承認の信頼度閾値 */
    const AUTO_APPROVE_THRESHOLD = 0.6;

    /** 信頼できるソース（学術論文プラットフォーム） */
    const TRUSTED_SOURCES = ['crossref', 'jstage', 'cinii', 'gbif_lit'];

    /** アラートレベル */
    const ALERT_NONE = 'none';
    const ALERT_INFO = 'info';        // 参考情報（自動承認だが記録）
    const ALERT_WARNING = 'warning';  // 注意（自動承認するが目を通す価値あり）
    const ALERT_REVIEW = 'review';    // 要レビュー（自動承認しない）

    /**
     * 蒸留結果を自動審査する。
     *
     * @param array  $extracted   AI蒸留結果 (ecological_constraints, identification_keys)
     * @param array  $paperMeta   論文メタデータ (doi, source, year, title, abstract)
     * @param string $taxonKey    対象の学名
     * @return array {
     *   decision: 'auto_approved' | 'needs_review',
     *   alerts: [{level, code, message}],
     *   confidence: float,
     *   reason: string
     * }
     */
    public static function review(array $extracted, array $paperMeta, string $taxonKey = ''): array
    {
        $alerts = [];
        $confidence = 1.0; // 初期値（減点方式）

        // --- ソース信頼性チェック ---
        $source = $paperMeta['source'] ?? 'unknown';
        if (!in_array($source, self::TRUSTED_SOURCES, true)) {
            $alerts[] = self::alert(self::ALERT_WARNING, 'untrusted_source', "不明なソース: {$source}");
            $confidence -= 0.3;
        }

        // DOI なし → 信頼度低下
        if (empty($paperMeta['doi'])) {
            $alerts[] = self::alert(self::ALERT_INFO, 'no_doi', 'DOI なし（引用追跡不可）');
            $confidence -= 0.1;
        }

        // 古すぎる論文（1970年以前）→ 情報が古い可能性
        $year = $paperMeta['year'] ?? null;
        if ($year && $year < 1970) {
            $alerts[] = self::alert(self::ALERT_INFO, 'old_paper', "古い論文 ({$year}年) — 分類が変わっている可能性");
            $confidence -= 0.1;
        }

        // --- 抽出内容チェック ---
        $eco = $extracted['ecological_constraints'] ?? [];
        $idKeys = $extracted['identification_keys'] ?? [];

        // 生態制約が完全に空
        $ecoEmpty = self::isEcoEmpty($eco);
        $idKeysEmpty = empty($idKeys) || (is_array($idKeys) && count($idKeys) === 0);

        if ($ecoEmpty && $idKeysEmpty) {
            $alerts[] = self::alert(self::ALERT_WARNING, 'all_empty', '生態制約・同定キーが両方とも空');
            $confidence -= 0.3;
        }

        // 生息地が異常に多い（ハルシネーションの兆候）
        $habitats = $eco['habitat'] ?? [];
        if (is_array($habitats) && count($habitats) > 8) {
            $alerts[] = self::alert(self::ALERT_REVIEW, 'too_many_habitats', '生息地が ' . count($habitats) . ' 件 — AI ハルシネーションの可能性');
            $confidence -= 0.3;
        }

        // 同定キーが異常に多い
        if (is_array($idKeys) && count($idKeys) > 10) {
            $alerts[] = self::alert(self::ALERT_REVIEW, 'too_many_keys', '同定キーが ' . count($idKeys) . ' 件 — 過剰抽出の可能性');
            $confidence -= 0.3;
        }

        // 標高範囲の妥当性チェック
        $altitude = $eco['altitude_range'] ?? '';
        if ($altitude && preg_match('/(\d+)\s*m?\s*[-–]\s*(\d+)\s*m?/i', $altitude, $m)) {
            $low = (int) $m[1];
            $high = (int) $m[2];
            if ($high > 8848) {
                $alerts[] = self::alert(self::ALERT_REVIEW, 'invalid_altitude', "標高が異常: {$altitude}（エベレスト超え）");
                $confidence -= 0.4;
            }
            if ($low > $high) {
                $alerts[] = self::alert(self::ALERT_WARNING, 'altitude_inverted', "標高範囲が逆: {$altitude}");
                $confidence -= 0.1;
            }
        }

        // 希少種チェック（PrivacyFilter 連携）
        if ($taxonKey && class_exists('PrivacyFilter')) {
            if (PrivacyFilter::isProtectedSpecies($taxonKey)) {
                $alerts[] = self::alert(self::ALERT_WARNING, 'protected_species', "保護対象種: {$taxonKey} — 位置情報の取り扱いに注意");
            }
        }

        // テキスト内の疑わしいパターン
        $allText = json_encode($extracted, JSON_UNESCAPED_UNICODE);
        if (preg_match('/I cannot|I\'m sorry|As an AI|I don\'t have/i', $allText)) {
            $alerts[] = self::alert(self::ALERT_REVIEW, 'ai_refusal', 'AI拒否パターン検出 — 蒸留失敗の可能性');
            $confidence -= 0.5;
        }
        if (preg_match('/hallucin|fabricat|made up|not real/i', $allText)) {
            $alerts[] = self::alert(self::ALERT_REVIEW, 'hallucination_marker', '自己言及ハルシネーションマーカー検出');
            $confidence -= 0.5;
        }

        // --- 判定 ---
        $confidence = max(0.0, min(1.0, $confidence));
        $hasReviewAlert = !empty(array_filter($alerts, fn($a) => $a['level'] === self::ALERT_REVIEW));

        if ($hasReviewAlert || $confidence < self::AUTO_APPROVE_THRESHOLD) {
            return [
                'decision'   => 'needs_review',
                'alerts'     => $alerts,
                'confidence' => round($confidence, 2),
                'reason'     => self::summarizeAlerts($alerts),
            ];
        }

        return [
            'decision'   => 'auto_approved',
            'alerts'     => $alerts,
            'confidence' => round($confidence, 2),
            'reason'     => empty($alerts)
                ? '信頼ソース・正常な抽出内容'
                : '軽微な注意点あり、自動承認',
        ];
    }

    /**
     * バッチ審査: 蒸留データ全体に対して自動承認を適用する。
     *
     * @param array &$distilledData DOI => {status, data, review_status, ...} の連想配列（参照渡し）
     * @param array  $paperIndex    DOI => paperMeta のマップ
     * @return array {auto_approved: int, needs_review: int, alerts: array}
     */
    public static function batchReview(array &$distilledData, array $paperIndex = []): array
    {
        $stats = ['auto_approved' => 0, 'needs_review' => 0, 'skipped' => 0, 'alerts' => []];

        foreach ($distilledData as $doi => &$item) {
            // pending のみ対象
            if (($item['review_status'] ?? '') !== 'pending') {
                $stats['skipped']++;
                continue;
            }

            // status が distilled 以外は対象外
            if (($item['status'] ?? '') !== 'distilled') {
                $stats['skipped']++;
                continue;
            }

            $extracted = $item['data'] ?? [];
            $paperMeta = $paperIndex[$doi] ?? ['doi' => $doi, 'source' => 'unknown'];

            $result = self::review($extracted, $paperMeta, $item['taxon_key'] ?? '');

            if ($result['decision'] === 'auto_approved') {
                $item['review_status'] = 'approved';
                $item['reviewed_by'] = 'auto_reviewer';
                $item['reviewed_at'] = date('c');
                $item['review_confidence'] = $result['confidence'];
                $stats['auto_approved']++;
            } else {
                $item['review_status'] = 'needs_review';
                $item['review_alerts'] = $result['alerts'];
                $item['review_confidence'] = $result['confidence'];
                $stats['needs_review']++;
            }

            if (!empty($result['alerts'])) {
                $stats['alerts'][$doi] = $result['alerts'];
            }
        }
        unset($item);

        return $stats;
    }

    /**
     * SQLite版バッチ審査: OmoikaneDB の distilled_knowledge テーブルに対して適用。
     *
     * @param \PDO $pdo
     * @return array {auto_approved: int, needs_review: int}
     */
    public static function batchReviewSqlite(\PDO $pdo): array
    {
        $stats = ['auto_approved' => 0, 'needs_review' => 0];

        // 未レビューの蒸留知識を取得
        $stmt = $pdo->query("
            SELECT dk.id, dk.doi, dk.taxon_key, dk.knowledge_type, dk.content, dk.confidence,
                   p.source, p.year, p.title
            FROM distilled_knowledge dk
            LEFT JOIN papers p ON dk.doi = p.doi
            WHERE dk.reviewed_by IS NULL
            ORDER BY dk.created_at ASC
            LIMIT 100
        ");

        $updateApprove = $pdo->prepare("
            UPDATE distilled_knowledge SET reviewed_by = 'auto_reviewer', confidence = :confidence WHERE id = :id
        ");
        $updateFlag = $pdo->prepare("
            UPDATE distilled_knowledge SET confidence = :confidence WHERE id = :id
        ");

        while ($row = $stmt->fetch()) {
            $extracted = json_decode($row['content'] ?? '{}', true) ?: [];
            $paperMeta = [
                'doi'    => $row['doi'],
                'source' => $row['source'] ?? 'unknown',
                'year'   => $row['year'] ?? null,
                'title'  => $row['title'] ?? '',
            ];

            $result = self::review($extracted, $paperMeta, $row['taxon_key'] ?? '');

            if ($result['decision'] === 'auto_approved') {
                $updateApprove->execute([
                    ':confidence' => $result['confidence'],
                    ':id' => $row['id'],
                ]);
                $stats['auto_approved']++;
            } else {
                // confidence を更新してフラグとして残す
                $updateFlag->execute([
                    ':confidence' => $result['confidence'],
                    ':id' => $row['id'],
                ]);
                $stats['needs_review']++;
            }
        }

        return $stats;
    }

    // === 内部ヘルパー ===

    private static function alert(string $level, string $code, string $message): array
    {
        return [
            'level'   => $level,
            'code'    => $code,
            'message' => $message,
        ];
    }

    private static function isEcoEmpty(array $eco): bool
    {
        $habitat = $eco['habitat'] ?? [];
        $altitude = $eco['altitude_range'] ?? '';
        $season = $eco['active_season'] ?? [];
        $notes = $eco['notes'] ?? '';

        return (empty($habitat) || $habitat === [null])
            && empty($altitude)
            && (empty($season) || $season === [null])
            && empty($notes);
    }

    private static function summarizeAlerts(array $alerts): string
    {
        $reviewAlerts = array_filter($alerts, fn($a) => $a['level'] === self::ALERT_REVIEW);
        if (!empty($reviewAlerts)) {
            return implode('; ', array_map(fn($a) => $a['message'], $reviewAlerts));
        }
        $warningAlerts = array_filter($alerts, fn($a) => $a['level'] === self::ALERT_WARNING);
        if (!empty($warningAlerts)) {
            return implode('; ', array_map(fn($a) => $a['message'], $warningAlerts));
        }
        return '軽微な注意点のみ';
    }
}
