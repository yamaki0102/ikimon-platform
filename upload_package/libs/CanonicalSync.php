<?php

/**
 * CanonicalSync — 既存 JSON 観察データ → Canonical Schema 同期
 *
 * 既存の DataStore (JSON) に蓄積された観察データを
 * Canonical Schema (SQLite 5層) に同期する。
 *
 * 用途:
 *   - 初回マイグレーション（既存データの一括取り込み）
 *   - 継続的な差分同期（新規投稿の自動反映）
 *
 * 全メソッド static。
 */

require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/CanonicalStore.php';
require_once __DIR__ . '/AuditLog.php';
require_once __DIR__ . '/CanonicalObservationGuard.php';

class CanonicalSync
{
    /**
     * 既存の全観察を Canonical Schema に同期（冪等）
     *
     * @return array { synced: int, skipped: int, errors: int }
     */
    public static function syncAll(): array
    {
        $observations = DataStore::fetchAll('observations');
        $synced = 0;
        $skipped = 0;
        $errors = 0;
        $skipReasons = [];

        foreach ($observations as $obs) {
            try {
                $result = self::syncOne($obs);
                if (($result['synced'] ?? false) === true) {
                    $synced++;
                } else {
                    $skipped++;
                    $reason = (string)($result['skip_reason'] ?? 'unknown');
                    $skipReasons[$reason] = ($skipReasons[$reason] ?? 0) + 1;
                }
            } catch (\Exception $e) {
                $errors++;
                error_log("[CanonicalSync] Error syncing {$obs['id']}: " . $e->getMessage());
            }
        }

        return [
            'synced' => $synced,
            'skipped' => $skipped,
            'errors' => $errors,
            'skip_reasons' => $skipReasons,
        ];
    }

    /**
     * 1件の観察を同期（冪等: 既存なら skip）
     *
     * @return array { synced: bool, skip_reason?: string }
     */
    public static function syncOne(array $obs): array
    {
        $obsId = $obs['id'] ?? '';
        if (empty($obsId)) {
            return ['synced' => false, 'skip_reason' => 'missing_observation_id'];
        }
        $guardDecision = CanonicalObservationGuard::shouldSkip($obs);
        if ($guardDecision !== null) {
            return ['synced' => false, 'skip_reason' => (string)$guardDecision['reason']];
        }

        // 既存チェック（original_observation_id で検索）
        $existing = self::findByOriginalId($obsId);
        if ($existing) {
            return ['synced' => false, 'skip_reason' => 'already_synced'];
        }

        // Event 作成
        $eventId = CanonicalStore::createEvent([
            'event_date'             => $obs['observed_at'] ?? $obs['created_at'] ?? date('c'),
            'decimal_latitude'       => $obs['lat'] ?? null,
            'decimal_longitude'      => $obs['lng'] ?? null,
            'coordinate_uncertainty_m' => $obs['gps_accuracy'] ?? null,
            'uncertainty_type'       => isset($obs['gps_accuracy']) ? 'measured' : 'device_default',
            'sampling_protocol'      => 'manual-photo',
            'capture_device'         => $obs['device'] ?? null,
            'recorded_by'            => $obs['user_id'] ?? null,
            'site_id'                => $obs['site_id'] ?? null,
        ]);

        // Evidence Tier の推定
        $tier = self::estimateTier($obs);

        // Occurrence 作成
        $scientificName = $obs['scientific_name'] ?? $obs['taxon']['scientific_name'] ?? null;
        $occId = CanonicalStore::createOccurrence([
            'event_id'                => $eventId,
            'scientific_name'         => $scientificName,
            'taxon_rank'              => $obs['taxon_rank'] ?? 'species',
            'basis_of_record'         => 'HumanObservation',
            'evidence_tier'           => $tier,
            'evidence_tier_by'        => 'sync',
            'data_quality'            => $obs['quality_grade'] ?? 'C',
            'observation_source'      => 'post',
            'original_observation_id' => $obsId,
            'detection_model'         => !empty($obs['ai_assessment']) ? 'gemini-vision' : null,
        ]);

        // Evidence（写真）
        $photos = $obs['photos'] ?? [];
        foreach ($photos as $photo) {
            $path = is_string($photo) ? $photo : ($photo['url'] ?? $photo['path'] ?? '');
            if ($path) {
                CanonicalStore::addEvidence([
                    'occurrence_id' => $occId,
                    'media_type'    => 'photo',
                    'media_path'    => $path,
                ]);
            }
        }

        // Identification（既存の同定があれば）
        $identifications = $obs['identifications'] ?? [];
        foreach ($identifications as $id) {
            $taxonName = $id['taxon_name'] ?? $id['scientific_name'] ?? '';
            if ($taxonName) {
                CanonicalStore::addIdentification([
                    'occurrence_id'       => $occId,
                    'identified_by'       => $id['user_id'] ?? $id['user_name'] ?? 'unknown',
                    'taxon_name'          => $taxonName,
                    'identification_method' => 'visual',
                ]);
            }
        }

        // 監査ログ
        AuditLog::log(
            AuditLog::ACTION_SYNC,
            'system:canonical_sync',
            $occId,
            $eventId,
            null,
            null,
            ['original_id' => $obsId, 'tier' => $tier]
        );

        return ['synced' => true];
    }

    /**
     * original_observation_id で既存レコードを検索
     */
    private static function findByOriginalId(string $obsId): ?array
    {
        static $pdo = null;
        if ($pdo === null) {
            $dbPath = DATA_DIR . '/ikimon.db';
            $pdo = new PDO('sqlite:' . $dbPath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        }

        $stmt = $pdo->prepare("
            SELECT occurrence_id FROM occurrences
            WHERE original_observation_id = :id LIMIT 1
        ");
        $stmt->execute([':id' => $obsId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * 既存観察データから Evidence Tier を推定
     */
    private static function estimateTier(array $obs): float
    {
        $quality = $obs['quality_grade'] ?? '';
        $status = $obs['status'] ?? '';

        // Research Grade → Tier 3
        if ($quality === 'Research Grade' || $status === '研究用') {
            return 3.0;
        }

        // 同定が2つ以上 → Tier 2
        $idCount = count($obs['identifications'] ?? []);
        if ($idCount >= 2) {
            return 2.0;
        }

        // 同定が1つ → Tier 2
        if ($idCount >= 1) {
            return 2.0;
        }

        // AI 判定あり + 写真あり → Tier 1
        if (!empty($obs['ai_assessment']) && !empty($obs['photos'])) {
            return 1.0;
        }

        return 1.0;
    }
}
