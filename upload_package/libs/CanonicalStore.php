<?php

/**
 * CanonicalStore — Canonical Schema (5層) の PHP インターフェース
 *
 * SQLite ベースの正規データストア。100年耐久設計。
 * ADR-001, ADR-002, ADR-005 準拠。
 *
 * Layer 1: events        — いつ・どこで・どうやって
 * Layer 2: occurrences   — 何がいたか
 * Layer 3: evidence      — 証拠メディア
 * Layer 4: identifications — 同定ログ (immutable)
 * Layer 5: privacy_access — 公開制御
 * Layer 6: live_detections — リアルタイム (24h TTL)
 *
 * 全メソッド static。SiteManager と同じパターン。
 */

require_once __DIR__ . '/../config/config.php';

class CanonicalStore
{
    private static ?PDO $pdo = null;

    // ─── Connection ─────────────────────────────────────────────

    private static function getPDO(): PDO
    {
        if (self::$pdo === null) {
            $dbPath = DATA_DIR . '/ikimon.db';
            self::$pdo = new PDO('sqlite:' . $dbPath);
            self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            self::$pdo->exec('PRAGMA foreign_keys = ON');
            self::$pdo->exec('PRAGMA journal_mode = WAL');
        }
        return self::$pdo;
    }

    // ─── Layer 1: Events ────────────────────────────────────────

    /**
     * 観察イベント（セッション）を作成
     */
    public static function createEvent(array $data): string
    {
        $eventId = $data['event_id'] ?? self::uuid();
        $pdo = self::getPDO();

        $stmt = $pdo->prepare("
            INSERT INTO events (
                event_id, parent_event_id, event_date,
                decimal_latitude, decimal_longitude, geodetic_datum,
                coordinate_uncertainty_m, uncertainty_type,
                sampling_protocol, sampling_effort, capture_device,
                recorded_by, site_id
            ) VALUES (
                :event_id, :parent_event_id, :event_date,
                :lat, :lng, :datum,
                :uncertainty, :uncertainty_type,
                :protocol, :effort, :device,
                :recorded_by, :site_id
            )
        ");

        $stmt->execute([
            ':event_id'         => $eventId,
            ':parent_event_id'  => $data['parent_event_id'] ?? null,
            ':event_date'       => $data['event_date'] ?? date('c'),
            ':lat'              => $data['decimal_latitude'] ?? null,
            ':lng'              => $data['decimal_longitude'] ?? null,
            ':datum'            => $data['geodetic_datum'] ?? 'EPSG:4326',
            ':uncertainty'      => $data['coordinate_uncertainty_m'] ?? null,
            ':uncertainty_type' => $data['uncertainty_type'] ?? 'device_default',
            ':protocol'         => $data['sampling_protocol'] ?? null,
            ':effort'           => $data['sampling_effort'] ?? null,
            ':device'           => $data['capture_device'] ?? null,
            ':recorded_by'      => $data['recorded_by'] ?? null,
            ':site_id'          => $data['site_id'] ?? null,
        ]);

        return $eventId;
    }

    /**
     * イベントを取得
     */
    public static function getEvent(string $eventId): ?array
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("SELECT * FROM events WHERE event_id = :id");
        $stmt->execute([':id' => $eventId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    // ─── Layer 2: Occurrences ───────────────────────────────────

    /**
     * 観察レコードを作成
     */
    public static function createOccurrence(array $data): string
    {
        $occId = $data['occurrence_id'] ?? self::uuid();
        $pdo = self::getPDO();

        $confidenceContext = isset($data['confidence_context'])
            ? (is_string($data['confidence_context']) ? $data['confidence_context'] : json_encode($data['confidence_context'], JSON_UNESCAPED_UNICODE))
            : null;

        $stmt = $pdo->prepare("
            INSERT INTO occurrences (
                occurrence_id, event_id, scientific_name, taxon_rank,
                taxon_concept_version, basis_of_record, individual_count,
                evidence_tier, evidence_tier_at, evidence_tier_by,
                data_quality, observation_source, original_observation_id,
                detection_confidence, adjusted_confidence, confidence_context,
                detection_model, detection_model_hash
            ) VALUES (
                :occ_id, :event_id, :sci_name, :rank,
                :taxon_version, :basis, :count,
                :tier, :tier_at, :tier_by,
                :quality, :source, :orig_id,
                :det_conf, :adj_conf, :conf_ctx,
                :det_model, :det_hash
            )
        ");

        $stmt->execute([
            ':occ_id'        => $occId,
            ':event_id'      => $data['event_id'],
            ':sci_name'      => $data['scientific_name'] ?? null,
            ':rank'          => $data['taxon_rank'] ?? 'species',
            ':taxon_version' => $data['taxon_concept_version'] ?? null,
            ':basis'         => $data['basis_of_record'] ?? 'MachineObservation',
            ':count'         => $data['individual_count'] ?? null,
            ':tier'          => $data['evidence_tier'] ?? 1,
            ':tier_at'       => $data['evidence_tier_at'] ?? date('c'),
            ':tier_by'       => $data['evidence_tier_by'] ?? 'auto',
            ':quality'       => $data['data_quality'] ?? 'C',
            ':source'        => $data['observation_source'] ?? null,
            ':orig_id'       => $data['original_observation_id'] ?? null,
            ':det_conf'      => $data['detection_confidence'] ?? null,
            ':adj_conf'      => $data['adjusted_confidence'] ?? null,
            ':conf_ctx'      => $confidenceContext,
            ':det_model'     => $data['detection_model'] ?? null,
            ':det_hash'      => $data['detection_model_hash'] ?? null,
        ]);

        return $occId;
    }

    /**
     * 観察レコードを取得
     */
    public static function getOccurrence(string $occId): ?array
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("SELECT * FROM occurrences WHERE occurrence_id = :id");
        $stmt->execute([':id' => $occId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row && $row['confidence_context']) {
            $row['confidence_context'] = json_decode($row['confidence_context'], true);
        }
        return $row ?: null;
    }

    /**
     * Evidence Tier を更新
     */
    public static function updateEvidenceTier(string $occId, float $tier, string $by = 'auto'): void
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("
            UPDATE occurrences
            SET evidence_tier = :tier, evidence_tier_at = :at, evidence_tier_by = :by
            WHERE occurrence_id = :id
        ");
        $stmt->execute([
            ':tier' => $tier,
            ':at'   => date('c'),
            ':by'   => $by,
            ':id'   => $occId,
        ]);
    }

    /**
     * イベントに紐づく全 occurrence を取得
     */
    public static function getOccurrencesByEvent(string $eventId): array
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("SELECT * FROM occurrences WHERE event_id = :eid ORDER BY created_at");
        $stmt->execute([':eid' => $eventId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // ─── Layer 3: Evidence ──────────────────────────────────────

    /**
     * 証拠メディアを追加
     */
    public static function addEvidence(array $data): string
    {
        $evidenceId = $data['evidence_id'] ?? self::uuid();
        $pdo = self::getPDO();

        $metadata = isset($data['metadata'])
            ? (is_string($data['metadata']) ? $data['metadata'] : json_encode($data['metadata'], JSON_UNESCAPED_UNICODE))
            : null;

        $stmt = $pdo->prepare("
            INSERT INTO evidence (
                evidence_id, occurrence_id, media_type, media_path,
                media_hash, capture_timestamp, duration_seconds, metadata
            ) VALUES (
                :eid, :occ_id, :type, :path, :hash, :ts, :duration, :meta
            )
        ");

        $stmt->execute([
            ':eid'      => $evidenceId,
            ':occ_id'   => $data['occurrence_id'],
            ':type'     => $data['media_type'],
            ':path'     => $data['media_path'],
            ':hash'     => $data['media_hash'] ?? null,
            ':ts'       => $data['capture_timestamp'] ?? date('c'),
            ':duration' => $data['duration_seconds'] ?? null,
            ':meta'     => $metadata,
        ]);

        return $evidenceId;
    }

    /**
     * occurrence に紐づく全証拠を取得
     */
    public static function getEvidenceByOccurrence(string $occId): array
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("SELECT * FROM evidence WHERE occurrence_id = :oid ORDER BY created_at");
        $stmt->execute([':oid' => $occId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // ─── Layer 4: Identifications (Immutable) ───────────────────

    /**
     * 同定を記録（INSERT のみ。UPDATE 禁止）
     */
    public static function addIdentification(array $data): string
    {
        $idId = $data['identification_id'] ?? self::uuid();
        $pdo = self::getPDO();

        // 既存の is_current を 0 に更新
        $pdo->prepare("
            UPDATE identifications SET is_current = 0
            WHERE occurrence_id = :oid AND is_current = 1
        ")->execute([':oid' => $data['occurrence_id']]);

        $stmt = $pdo->prepare("
            INSERT INTO identifications (
                identification_id, occurrence_id, identified_by, taxon_name,
                taxon_concept_version, identification_method, confidence,
                reviewer_level, notes, is_current
            ) VALUES (
                :id, :occ_id, :by, :taxon,
                :version, :method, :conf,
                :level, :notes, 1
            )
        ");

        $stmt->execute([
            ':id'      => $idId,
            ':occ_id'  => $data['occurrence_id'],
            ':by'      => $data['identified_by'],
            ':taxon'   => $data['taxon_name'],
            ':version' => $data['taxon_concept_version'] ?? null,
            ':method'  => $data['identification_method'] ?? null,
            ':conf'    => $data['confidence'] ?? null,
            ':level'   => $data['reviewer_level'] ?? null,
            ':notes'   => $data['notes'] ?? null,
        ]);

        return $idId;
    }

    /**
     * occurrence の同定履歴を取得（最新→古い順）
     */
    public static function getIdentificationHistory(string $occId): array
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("
            SELECT * FROM identifications
            WHERE occurrence_id = :oid
            ORDER BY created_at DESC
        ");
        $stmt->execute([':oid' => $occId]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // ─── Layer 5: Privacy Access ────────────────────────────────

    /**
     * プライバシー設定を保存/更新
     */
    public static function setPrivacyAccess(string $occId, array $data): void
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("
            INSERT OR REPLACE INTO privacy_access (
                record_id, coordinate_precision, access_tier,
                legal_basis, sensitive_species
            ) VALUES (
                :id, :precision, :tier, :basis, :sensitive
            )
        ");

        $stmt->execute([
            ':id'        => $occId,
            ':precision' => $data['coordinate_precision'] ?? 'exact',
            ':tier'      => $data['access_tier'] ?? 'public',
            ':basis'     => $data['legal_basis'] ?? 'consent',
            ':sensitive' => $data['sensitive_species'] ?? 0,
        ]);
    }

    // ─── Layer 6: Live Detections ───────────────────────────────

    /**
     * ライブ検出を追加（24h TTL）
     */
    public static function addLiveDetection(array $data): string
    {
        $detId = $data['detection_id'] ?? self::uuid();
        $pdo = self::getPDO();

        $stmt = $pdo->prepare("
            INSERT INTO live_detections (
                detection_id, user_id, lat, lng,
                scientific_name, common_name,
                detection_confidence, adjusted_confidence,
                detection_type, occurrence_id,
                detected_at, expires_at, is_anonymous
            ) VALUES (
                :id, :uid, :lat, :lng,
                :sci, :common,
                :det_conf, :adj_conf,
                :type, :occ_id,
                :detected, :expires, :anon
            )
        ");

        $now = date('c');
        $stmt->execute([
            ':id'       => $detId,
            ':uid'      => $data['user_id'],
            ':lat'      => $data['lat'],
            ':lng'      => $data['lng'],
            ':sci'      => $data['scientific_name'] ?? null,
            ':common'   => $data['common_name'] ?? null,
            ':det_conf' => $data['detection_confidence'] ?? null,
            ':adj_conf' => $data['adjusted_confidence'] ?? null,
            ':type'     => $data['detection_type'] ?? 'audio',
            ':occ_id'   => $data['occurrence_id'] ?? null,
            ':detected' => $data['detected_at'] ?? $now,
            ':expires'  => $data['expires_at'] ?? date('c', strtotime('+24 hours')),
            ':anon'     => $data['is_anonymous'] ?? 1,
        ]);

        return $detId;
    }

    /**
     * 有効なライブ検出を取得（24h以内）
     */
    public static function getActiveLiveDetections(
        ?float $lat = null,
        ?float $lng = null,
        float $radiusKm = 10
    ): array {
        $pdo = self::getPDO();
        $now = date('c');

        if ($lat !== null && $lng !== null) {
            // 簡易的な矩形フィルタ（正確な距離計算は後段で）
            $latDelta = $radiusKm / 111.0;
            $lngDelta = $radiusKm / (111.0 * cos(deg2rad($lat)));

            $stmt = $pdo->prepare("
                SELECT * FROM live_detections
                WHERE expires_at > :now
                  AND lat BETWEEN :lat_min AND :lat_max
                  AND lng BETWEEN :lng_min AND :lng_max
                ORDER BY detected_at DESC
                LIMIT 500
            ");
            $stmt->execute([
                ':now'     => $now,
                ':lat_min' => $lat - $latDelta,
                ':lat_max' => $lat + $latDelta,
                ':lng_min' => $lng - $lngDelta,
                ':lng_max' => $lng + $lngDelta,
            ]);
        } else {
            $stmt = $pdo->prepare("
                SELECT * FROM live_detections
                WHERE expires_at > :now
                ORDER BY detected_at DESC
                LIMIT 500
            ");
            $stmt->execute([':now' => $now]);
        }

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * 期限切れのライブ検出を削除
     */
    public static function purgeExpiredLiveDetections(): int
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("DELETE FROM live_detections WHERE expires_at <= :now");
        $stmt->execute([':now' => date('c')]);
        return $stmt->rowCount();
    }

    // ─── Query Helpers ──────────────────────────────────────────

    /**
     * KPI メトリクスを取得（PoC ダッシュボード用）
     */
    public static function getKPIMetrics(): array
    {
        $pdo = self::getPDO();

        // モード別観察数
        $bySource = $pdo->query("
            SELECT observation_source, COUNT(*) as cnt
            FROM occurrences GROUP BY observation_source
        ")->fetchAll(PDO::FETCH_KEY_PAIR);

        // Tier 分布
        $byTier = $pdo->query("
            SELECT evidence_tier, COUNT(*) as cnt
            FROM occurrences GROUP BY evidence_tier ORDER BY evidence_tier
        ")->fetchAll(PDO::FETCH_KEY_PAIR);

        // 種数
        $speciesCount = $pdo->query("
            SELECT COUNT(DISTINCT scientific_name) FROM occurrences
            WHERE scientific_name IS NOT NULL
        ")->fetchColumn();

        // 総観察数
        $totalOcc = $pdo->query("SELECT COUNT(*) FROM occurrences")->fetchColumn();

        // Research Grade (Tier >= 3)
        $researchGrade = $pdo->query("
            SELECT COUNT(*) FROM occurrences WHERE evidence_tier >= 3
        ")->fetchColumn();

        return [
            'total_occurrences'    => (int) $totalOcc,
            'by_source'            => $bySource,
            'by_tier'              => $byTier,
            'unique_species'       => (int) $speciesCount,
            'research_grade_count' => (int) $researchGrade,
        ];
    }

    /**
     * 種名で occurrence を検索
     */
    public static function searchBySpecies(string $name, int $limit = 50): array
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("
            SELECT o.*, e.event_date, e.decimal_latitude, e.decimal_longitude
            FROM occurrences o
            JOIN events e ON o.event_id = e.event_id
            WHERE o.scientific_name LIKE :name
            ORDER BY o.created_at DESC
            LIMIT :limit
        ");
        $stmt->execute([':name' => "%{$name}%", ':limit' => $limit]);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // ─── Utilities ──────────────────────────────────────────────

    /**
     * UUIDv4 を生成
     */
    private static function uuid(): string
    {
        $data = random_bytes(16);
        $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
        $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
    }
}
