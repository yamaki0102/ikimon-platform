<?php

/**
 * DataStageManager.php — Data Verification Stage Manager
 *
 * 観察データの「検証ステージ」を管理する。
 * DataQuality（A/B/C/D 品質グレード）とは直交する軸。
 *
 * 品質グレード: データの完全性（写真・位置情報・同定数）
 * 検証ステージ: データの検証プロセス段階
 *
 * ステージ遷移:
 *   unverified → ai_classified → human_verified → research_grade
 *                 ↘ needs_review (AI信頼度低の場合)
 *                   → human_verified → research_grade
 *
 * 100年データ設計: 全遷移を監査ログに記録し、将来のモデル非依存検証に対応。
 */

class DataStageManager
{
    // === 検証ステージ定数 ===

    /** 未検証: 投稿直後の初期状態 */
    const STAGE_UNVERIFIED = 'unverified';

    /** AI分類済: 機械学習モデルによる自動分類完了 */
    const STAGE_AI_CLASSIFIED = 'ai_classified';

    /** レビュー要: AI信頼度が閾値未満で人間の確認が必要 */
    const STAGE_NEEDS_REVIEW = 'needs_review';

    /** 人間検証済: 1人以上の同定者が確認 */
    const STAGE_HUMAN_VERIFIED = 'human_verified';

    /** 研究用: コミュニティ合意に達した最高品質データ */
    const STAGE_RESEARCH_GRADE = 'research_grade';

    /** AI分類の信頼度閾値（これ未満は needs_review へ） */
    const AI_CONFIDENCE_THRESHOLD = 0.7;

    /** 許可される遷移マップ: stage => [次に遷移可能なステージ] */
    const TRANSITIONS = [
        self::STAGE_UNVERIFIED     => [self::STAGE_AI_CLASSIFIED, self::STAGE_NEEDS_REVIEW, self::STAGE_HUMAN_VERIFIED],
        self::STAGE_AI_CLASSIFIED  => [self::STAGE_NEEDS_REVIEW, self::STAGE_HUMAN_VERIFIED, self::STAGE_RESEARCH_GRADE],
        self::STAGE_NEEDS_REVIEW   => [self::STAGE_HUMAN_VERIFIED, self::STAGE_AI_CLASSIFIED],
        self::STAGE_HUMAN_VERIFIED => [self::STAGE_RESEARCH_GRADE, self::STAGE_NEEDS_REVIEW],
        self::STAGE_RESEARCH_GRADE => [self::STAGE_NEEDS_REVIEW], // 降格のみ（異議申立時）
    ];

    /** ステージメタデータ（UI表示用） */
    const STAGE_META = [
        self::STAGE_UNVERIFIED => [
            'label'  => '未検証',
            'icon'   => 'circle-dashed',
            'color'  => 'text-gray-400',
            'bg'     => 'bg-gray-50',
            'weight' => 0.0,
        ],
        self::STAGE_AI_CLASSIFIED => [
            'label'  => 'AI分類済',
            'icon'   => 'bot',
            'color'  => 'text-blue-500',
            'bg'     => 'bg-blue-50',
            'weight' => 0.3,
        ],
        self::STAGE_NEEDS_REVIEW => [
            'label'  => 'レビュー要',
            'icon'   => 'eye',
            'color'  => 'text-amber-500',
            'bg'     => 'bg-amber-50',
            'weight' => 0.1,
        ],
        self::STAGE_HUMAN_VERIFIED => [
            'label'  => '人間検証済',
            'icon'   => 'user-check',
            'color'  => 'text-green-500',
            'bg'     => 'bg-green-50',
            'weight' => 0.7,
        ],
        self::STAGE_RESEARCH_GRADE => [
            'label'  => '研究用',
            'icon'   => 'shield-check',
            'color'  => 'text-emerald-600',
            'bg'     => 'bg-emerald-50',
            'weight' => 1.0,
        ],
    ];

    /**
     * 現在のステージを判定する。
     * 観察データから自動的にステージを推定（後方互換）。
     *
     * @param array $obs 観察データ
     * @return string ステージ定数
     */
    public static function resolveStage(array $obs): string
    {
        // 明示的にステージが設定済みならそれを返す
        if (!empty($obs['verification_stage'])) {
            return $obs['verification_stage'];
        }

        // 後方互換: 既存データから推定
        $grade = $obs['data_quality'] ?? DataQuality::calculate($obs);
        $identifications = $obs['identifications'] ?? [];
        $aiAssessment = $obs['ai_assessment'] ?? null;

        // Research Grade: Grade A かつ 2人以上の合意
        if ($grade === 'A' && count($identifications) >= 2) {
            return self::STAGE_RESEARCH_GRADE;
        }

        // Human Verified: 1人以上の同定あり
        if (!empty($identifications)) {
            return self::STAGE_HUMAN_VERIFIED;
        }

        // AI Classified: AI評価あり
        if ($aiAssessment) {
            $confidence = $aiAssessment['confidence'] ?? 0;
            if ($confidence >= self::AI_CONFIDENCE_THRESHOLD) {
                return self::STAGE_AI_CLASSIFIED;
            }
            return self::STAGE_NEEDS_REVIEW;
        }

        return self::STAGE_UNVERIFIED;
    }

    /**
     * ステージ遷移を実行する。
     * 遷移ルール検証 + 監査ログ記録。
     *
     * @param array  $obs       観察データ（参照渡し的に変更される）
     * @param string $newStage  遷移先ステージ
     * @param string $actor     遷移を実行した主体（user_id, 'ai', 'system'）
     * @param string $reason    遷移理由
     * @param array  $evidence  証拠データ（AI結果、同定データ等）
     * @return array ['success' => bool, 'observation' => array, 'error' => ?string]
     */
    public static function transition(array $obs, string $newStage, string $actor, string $reason = '', array $evidence = []): array
    {
        $currentStage = self::resolveStage($obs);

        // 同じステージへの遷移は無視
        if ($currentStage === $newStage) {
            return ['success' => true, 'observation' => $obs, 'error' => null];
        }

        // 遷移ルール検証
        $allowed = self::TRANSITIONS[$currentStage] ?? [];
        if (!in_array($newStage, $allowed, true)) {
            return [
                'success' => false,
                'observation' => $obs,
                'error' => "遷移不可: {$currentStage} → {$newStage}",
            ];
        }

        // 監査ログエントリ作成
        $logEntry = [
            'from'      => $currentStage,
            'to'        => $newStage,
            'actor'     => $actor,
            'reason'    => $reason,
            'evidence'  => self::sanitizeEvidence($evidence),
            'timestamp' => date('c'),
        ];

        // 観察データ更新
        $obs['verification_stage'] = $newStage;
        $obs['stage_updated_at'] = date('c');

        // 監査ログ追記
        if (!isset($obs['stage_history'])) {
            $obs['stage_history'] = [];
        }
        $obs['stage_history'][] = $logEntry;

        return ['success' => true, 'observation' => $obs, 'error' => null];
    }

    /**
     * AI分類結果を適用してステージを遷移する。
     *
     * @param array  $obs          観察データ
     * @param array  $aiResult     AI分類結果 ['taxon_name', 'confidence', 'model', ...]
     * @return array transition結果
     */
    public static function applyAiClassification(array $obs, array $aiResult): array
    {
        $confidence = $aiResult['confidence'] ?? 0;
        $newStage = $confidence >= self::AI_CONFIDENCE_THRESHOLD
            ? self::STAGE_AI_CLASSIFIED
            : self::STAGE_NEEDS_REVIEW;

        return self::transition($obs, $newStage, 'ai', 'AI classification', [
            'model'      => $aiResult['model'] ?? 'unknown',
            'confidence' => $confidence,
            'taxon'      => $aiResult['taxon_name'] ?? '',
        ]);
    }

    /**
     * 人間の同定を適用してステージを遷移する。
     *
     * @param array  $obs     観察データ
     * @param string $userId  同定者のユーザーID
     * @param string $taxon   同定した種名
     * @return array transition結果
     */
    public static function applyHumanIdentification(array $obs, string $userId, string $taxon): array
    {
        $currentStage = self::resolveStage($obs);

        // Research Grade 判定: Grade A かつ 2人以上合意
        $identifications = $obs['identifications'] ?? [];
        $grade = $obs['data_quality'] ?? DataQuality::calculate($obs);

        // 新しい同定を含めてカウント
        $taxonCounts = [];
        foreach ($identifications as $id) {
            $name = $id['taxon_name'] ?? '';
            if ($name) {
                $taxonCounts[$name] = ($taxonCounts[$name] ?? 0) + 1;
            }
        }
        $taxonCounts[$taxon] = ($taxonCounts[$taxon] ?? 0) + 1;

        $maxAgreement = !empty($taxonCounts) ? max($taxonCounts) : 0;

        // Research Grade 条件: 写真+位置+2人以上合意
        if ($grade <= 'B' && $maxAgreement >= 2) {
            return self::transition($obs, self::STAGE_RESEARCH_GRADE, $userId, 'Community consensus reached', [
                'taxon' => $taxon,
                'agreement_count' => $maxAgreement,
            ]);
        }

        // Human Verified
        return self::transition($obs, self::STAGE_HUMAN_VERIFIED, $userId, 'Human identification added', [
            'taxon' => $taxon,
        ]);
    }

    /**
     * ステージのメタ情報を取得する。
     *
     * @param string $stage
     * @return array
     */
    public static function getStageMeta(string $stage): array
    {
        return self::STAGE_META[$stage] ?? self::STAGE_META[self::STAGE_UNVERIFIED];
    }

    /**
     * ステージの重みを取得する（BIS スコア計算用）。
     *
     * @param string $stage
     * @return float 0.0 ~ 1.0
     */
    public static function getStageWeight(string $stage): float
    {
        $meta = self::STAGE_META[$stage] ?? null;
        return $meta['weight'] ?? 0.0;
    }

    /**
     * 観察リストのステージ別集計を取得する。
     *
     * @param array $observations
     * @return array ['stage' => count, ...]
     */
    public static function summarize(array $observations): array
    {
        $summary = array_fill_keys(array_keys(self::STAGE_META), 0);

        foreach ($observations as $obs) {
            $stage = self::resolveStage($obs);
            $summary[$stage] = ($summary[$stage] ?? 0) + 1;
        }

        return $summary;
    }

    /**
     * 証拠データのサニタイズ（大きすぎるデータを除去）。
     */
    private static function sanitizeEvidence(array $evidence): array
    {
        $sanitized = [];
        foreach ($evidence as $key => $value) {
            if (is_string($value) && strlen($value) > 500) {
                $sanitized[$key] = substr($value, 0, 500) . '...';
            } elseif (is_array($value) && count($value) > 20) {
                $sanitized[$key] = array_slice($value, 0, 20);
            } else {
                $sanitized[$key] = $value;
            }
        }
        return $sanitized;
    }
}
