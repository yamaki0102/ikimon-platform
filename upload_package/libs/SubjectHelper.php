<?php

/**
 * SubjectHelper — Multi-Subject Observation サポート
 *
 * 1つの観察に複数の生物（サブジェクト）を持てるようにする。
 * 既存の taxon / identifications / ai_assessments との後方互換を維持。
 */
class SubjectHelper
{
    /**
     * 既存observationに subjects[] がなければ自動生成。
     * 読み込み時に呼ぶことで、全コードが subjects[] 前提で動ける。
     */
    public static function ensureSubjects(array &$obs): void
    {
        if (!empty($obs['subjects']) && is_array($obs['subjects'])) {
            return;
        }

        // 既存データからprimary subjectを構築
        $photoCount = count($obs['photos'] ?? []);
        $photoIndices = $photoCount > 0 ? range(0, $photoCount - 1) : [];

        $obs['subjects'] = [
            [
                'id'                 => 'primary',
                'label'              => null,
                'photos'             => $photoIndices,
                'taxon'              => $obs['taxon'] ?? null,
                'identifications'    => [],
                'ai_assessments'     => [],
                'consensus'          => $obs['consensus'] ?? null,
                'verification_stage' => $obs['verification_stage'] ?? 'unverified',
            ]
        ];

        // 既存 identifications を primary に振り分け
        foreach ($obs['identifications'] ?? [] as $id) {
            if (!isset($id['subject_id']) || $id['subject_id'] === 'primary') {
                $obs['subjects'][0]['identifications'][] = $id;
            }
        }

        // 既存 ai_assessments を primary に振り分け
        foreach ($obs['ai_assessments'] ?? [] as $assessment) {
            if (!isset($assessment['subject_id']) || $assessment['subject_id'] === 'primary') {
                $obs['subjects'][0]['ai_assessments'][] = $assessment;
            }
        }
    }

    /**
     * subject_id で subject を参照で取得。
     *
     * @return array|null 参照ではなくコピー。変更は反映されない。findSubjectRef を使うこと。
     */
    public static function findSubject(array $obs, string $subjectId): ?array
    {
        foreach ($obs['subjects'] ?? [] as $subject) {
            if (($subject['id'] ?? '') === $subjectId) {
                return $subject;
            }
        }
        return null;
    }

    /**
     * subject_id で subject のインデックスを取得。
     */
    public static function findSubjectIndex(array $obs, string $subjectId): int
    {
        foreach ($obs['subjects'] ?? [] as $i => $subject) {
            if (($subject['id'] ?? '') === $subjectId) {
                return $i;
            }
        }
        return -1;
    }

    /**
     * 新しい subject を追加。
     *
     * @return string 生成された subject_id
     */
    public static function addSubject(array &$obs, string $label = '', array $photoIndices = []): string
    {
        self::ensureSubjects($obs);

        $subjectId = 'subj-' . bin2hex(random_bytes(4));

        // photos が空なら全写真を割り当て
        if (empty($photoIndices)) {
            $photoCount = count($obs['photos'] ?? []);
            $photoIndices = $photoCount > 0 ? range(0, $photoCount - 1) : [];
        }

        $obs['subjects'][] = [
            'id'                 => $subjectId,
            'label'              => $label !== '' ? $label : null,
            'photos'             => $photoIndices,
            'taxon'              => null,
            'identifications'    => [],
            'ai_assessments'     => [],
            'consensus'          => null,
            'verification_stage' => 'unverified',
        ];

        return $subjectId;
    }

    /**
     * subjects[] の情報を obs['taxon'] / obs['identifications'] 等に同期。
     * primary subject（最初のsubject）の結果をレガシーフィールドに反映。
     */
    public static function syncPrimaryToLegacy(array &$obs): void
    {
        if (empty($obs['subjects'])) {
            return;
        }

        $primary = $obs['subjects'][0];
        $obs['taxon'] = $primary['taxon'] ?? $obs['taxon'] ?? null;
        $obs['consensus'] = $primary['consensus'] ?? $obs['consensus'] ?? null;

        // verification_stage は観察全体で最も高いステージを採用
        $obs['verification_stage'] = self::highestStage($obs['subjects']);
    }

    /**
     * 全 subjects のうち最も高い verification_stage を返す。
     */
    private static function highestStage(array $subjects): string
    {
        $stageOrder = [
            'unverified'     => 0,
            'ai_classified'  => 1,
            'needs_review'   => 2,
            'human_verified' => 3,
            'research_grade' => 4,
        ];

        $highest = 'unverified';
        $highestOrder = 0;

        foreach ($subjects as $subject) {
            $stage = $subject['verification_stage'] ?? 'unverified';
            $order = $stageOrder[$stage] ?? 0;
            if ($order > $highestOrder) {
                $highestOrder = $order;
                $highest = $stage;
            }
        }

        return $highest;
    }

    /**
     * subject の identifications を obs['identifications'] から再構築。
     * obs['identifications']（フラット配列）を各 subject に振り分ける。
     */
    public static function distributeIdentifications(array &$obs): void
    {
        self::ensureSubjects($obs);

        // 各subjectのidentificationsをクリア
        foreach ($obs['subjects'] as &$subject) {
            $subject['identifications'] = [];
        }
        unset($subject);

        // フラットなidentificationsを振り分け
        foreach ($obs['identifications'] ?? [] as $id) {
            $sid = $id['subject_id'] ?? 'primary';
            $idx = self::findSubjectIndex($obs, $sid);
            if ($idx >= 0) {
                $obs['subjects'][$idx]['identifications'][] = $id;
            } else {
                // 見つからない場合はprimaryに
                $obs['subjects'][0]['identifications'][] = $id;
            }
        }
    }

    /**
     * subject の ai_assessments を obs['ai_assessments'] から再構築。
     */
    public static function distributeAiAssessments(array &$obs): void
    {
        self::ensureSubjects($obs);

        // 各subjectのai_assessmentsをクリア
        foreach ($obs['subjects'] as &$subject) {
            $subject['ai_assessments'] = [];
        }
        unset($subject);

        // フラットなai_assessmentsを振り分け
        foreach ($obs['ai_assessments'] ?? [] as $assessment) {
            $sid = $assessment['subject_id'] ?? 'primary';
            $idx = self::findSubjectIndex($obs, $sid);
            if ($idx >= 0) {
                $obs['subjects'][$idx]['ai_assessments'][] = $assessment;
            } else {
                $obs['subjects'][0]['ai_assessments'][] = $assessment;
            }
        }
    }

    /**
     * 観察のサブジェクト数を返す。
     */
    public static function subjectCount(array $obs): int
    {
        return count($obs['subjects'] ?? []);
    }

    /**
     * multi-subject かどうか（2つ以上のsubjectを持つ）。
     */
    public static function isMultiSubject(array $obs): bool
    {
        return self::subjectCount($obs) > 1;
    }

    /**
     * subject を削除。primary は削除不可。
     */
    public static function removeSubject(array &$obs, string $subjectId): bool
    {
        if ($subjectId === 'primary') {
            return false;
        }

        $idx = self::findSubjectIndex($obs, $subjectId);
        if ($idx < 0) {
            return false;
        }

        array_splice($obs['subjects'], $idx, 1);

        // フラットな identifications からも除去
        $obs['identifications'] = array_values(array_filter(
            $obs['identifications'] ?? [],
            fn($id) => ($id['subject_id'] ?? 'primary') !== $subjectId
        ));

        // フラットな ai_assessments からも除去
        $obs['ai_assessments'] = array_values(array_filter(
            $obs['ai_assessments'] ?? [],
            fn($a) => ($a['subject_id'] ?? 'primary') !== $subjectId
        ));

        return true;
    }
}
