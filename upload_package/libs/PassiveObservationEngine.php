<?php

/**
 * PassiveObservationEngine.php — パッシブ観察の照合・判定エンジン
 *
 * 端末から送られたパッシブ検出イベント（音声分類、GPS、センサー）を
 * サーバー側の既知種データと照合し、信頼度を総合判定する。
 *
 * Phase 6: パッシブ観察プラットフォーム。
 */

class PassiveObservationEngine
{
    /** 検出タイプ */
    const TYPE_AUDIO = 'audio';       // 音声検出（鳥声・虫声）
    const TYPE_VISUAL = 'visual';     // 視覚検出（スキャンモード）
    const TYPE_SENSOR = 'sensor';     // センサー推定（動き・環境）

    /** 信頼度閾値 */
    const CONFIDENCE_AUTO_RECORD = 0.70;  // 自動記録
    const CONFIDENCE_SUGGEST = 0.50;      // ユーザー確認待ち
    const CONFIDENCE_DISCARD = 0.30;      // 破棄

    /** 環境ブースト: 既知の生息地にいる場合の信頼度加算 */
    const HABITAT_BOOST = 0.10;

    /** 季節ブースト: 活動シーズンと一致する場合 */
    const SEASON_BOOST = 0.05;

    /**
     * パッシブ検出イベントのバッチを処理する。
     *
     * @param array  $events   検出イベント配列
     * @param string $userId   ユーザーID
     * @param array  $sessionMeta セッション情報 (route, duration, device等)
     * @return array {observations: array, summary: array, session_id: string}
     */
    public static function processEventBatch(array $events, string $userId, array $sessionMeta = []): array
    {
        $sessionId = 'ps_' . bin2hex(random_bytes(6));
        $observations = [];
        $speciesSeen = [];

        foreach ($events as $event) {
            $result = self::processEvent($event);

            if ($result['action'] === 'discard') continue;

            // 同セッション内の同一種は最高信頼度のものだけ保持
            $speciesKey = $result['taxon_key'] ?? $result['taxon_name'] ?? 'unknown';
            if (isset($speciesSeen[$speciesKey])) {
                if ($result['confidence'] > $speciesSeen[$speciesKey]['confidence']) {
                    $speciesSeen[$speciesKey] = $result;
                } else {
                    // カウントだけ増やす
                    $speciesSeen[$speciesKey]['detection_count'] = ($speciesSeen[$speciesKey]['detection_count'] ?? 1) + 1;
                    continue;
                }
            }

            $result['detection_count'] = ($speciesSeen[$speciesKey]['detection_count'] ?? 0) + 1;
            $speciesSeen[$speciesKey] = $result;
        }

        // 観察レコードに変換
        foreach ($speciesSeen as $speciesKey => $detection) {
            $observations[] = self::toObservation($detection, $userId, $sessionId, $sessionMeta);
        }

        // サマリー生成
        $summary = self::buildSummary($observations, $sessionMeta);

        return [
            'session_id' => $sessionId,
            'observations' => $observations,
            'summary' => $summary,
        ];
    }

    /**
     * 単一の検出イベントを処理する。
     *
     * @param array $event 検出イベント
     * @return array {action: 'record'|'suggest'|'discard', confidence: float, ...}
     */
    public static function processEvent(array $event): array
    {
        $type = $event['type'] ?? self::TYPE_AUDIO;
        $confidence = (float) ($event['confidence'] ?? 0);
        $taxonName = $event['taxon_name'] ?? '';
        $lat = $event['lat'] ?? null;
        $lng = $event['lng'] ?? null;
        $timestamp = $event['timestamp'] ?? date('c');

        // 環境コンテキストによる信頼度補正
        $adjustedConfidence = self::adjustConfidence($confidence, $taxonName, $lat, $lng, $timestamp);

        // アクション判定
        $action = 'discard';
        if ($adjustedConfidence >= self::CONFIDENCE_AUTO_RECORD) {
            $action = 'record';
        } elseif ($adjustedConfidence >= self::CONFIDENCE_SUGGEST) {
            $action = 'suggest';
        }

        return [
            'action' => $action,
            'type' => $type,
            'taxon_name' => $taxonName,
            'taxon_key' => $event['taxon_key'] ?? null,
            'scientific_name' => $event['scientific_name'] ?? null,
            'confidence' => round($adjustedConfidence, 3),
            'original_confidence' => $confidence,
            'lat' => $lat,
            'lng' => $lng,
            'timestamp' => $timestamp,
            'model' => $event['model'] ?? 'unknown',
            'audio_snippet_hash' => $event['audio_snippet_hash'] ?? null,
            'photo_ref' => $event['photo_ref'] ?? null,
            'detection_count' => 1,
        ];
    }

    /**
     * 環境コンテキストを考慮して信頼度を補正する。
     */
    private static function adjustConfidence(float $base, string $taxonName, ?float $lat, ?float $lng, string $timestamp): float
    {
        $adjusted = $base;

        // 位置情報がない場合はペナルティ
        if ($lat === null || $lng === null) {
            $adjusted *= 0.8;
            return $adjusted;
        }

        // 季節ブースト（月ベースの簡易判定）
        $month = (int) date('n', strtotime($timestamp) ?: time());
        $season = self::monthToSeason($month);

        // OmoikaneDB から生態制約を照合（利用可能な場合）
        if ($taxonName && class_exists('OmoikaneDB')) {
            try {
                $db = new OmoikaneDB();
                $pdo = $db->getPDO();
                $stmt = $pdo->prepare("
                    SELECT ec.habitat, ec.altitude, ec.season
                    FROM species s
                    JOIN ecological_constraints ec ON s.id = ec.species_id
                    WHERE s.scientific_name = :name OR s.japanese_name = :name
                    LIMIT 1
                ");
                $stmt->execute([':name' => $taxonName]);
                $eco = $stmt->fetch();

                if ($eco) {
                    // 季節マッチ
                    $seasonStr = $eco['season'] ?? '';
                    if ($seasonStr && stripos($seasonStr, $season) !== false) {
                        $adjusted += self::SEASON_BOOST;
                    }
                    // 生息地情報があるだけでもブースト（データが存在する種 = 既知種）
                    if (!empty($eco['habitat'])) {
                        $adjusted += self::HABITAT_BOOST;
                    }
                }
            } catch (\Throwable $e) {
                // DB アクセス失敗は無視
            }
        }

        return min(1.0, max(0.0, $adjusted));
    }

    /**
     * 検出結果を観察レコードに変換する。
     */
    private static function toObservation(array $detection, string $userId, string $sessionId, array $sessionMeta): array
    {
        $stage = $detection['action'] === 'record' ? 'ai_classified' : 'unverified';

        return [
            'id' => 'pobs_' . bin2hex(random_bytes(8)),
            'user_id' => $userId,
            'session_id' => $sessionId,
            'observed_at' => $detection['timestamp'],
            'lat' => $detection['lat'],
            'lng' => $detection['lng'],
            'species_name' => $detection['taxon_name'],
            'taxon' => [
                'name' => $detection['taxon_name'],
                'scientific_name' => $detection['scientific_name'] ?? '',
            ],
            'detection_type' => $detection['type'],
            'detection_confidence' => $detection['confidence'],
            'detection_model' => $detection['model'],
            'detection_count' => $detection['detection_count'] ?? 1,
            'photo_ref' => $detection['photo_ref'],
            'audio_snippet_hash' => $detection['audio_snippet_hash'],
            'source' => 'passive',
            'source_device' => $sessionMeta['device'] ?? 'unknown',
            'location_uncertainty_m' => 5.0, // GPS default
            'schema_version' => '1.0',
            'record_mode' => $detection['type'] === self::TYPE_VISUAL ? 'scan' : 'pocket',
            'verification_stage' => $stage,
            'stage_history' => [[
                'from' => 'unverified',
                'to' => $stage,
                'actor' => 'passive_engine',
                'reason' => "Passive detection ({$detection['type']})",
                'timestamp' => date('c'),
            ]],
            'data_quality' => ($detection['photo_ref'] && $detection['lat']) ? 'B' : 'C',
            'device' => $sessionMeta['device'] ?? null,
            'import_source' => 'passive_observation',
            'created_at' => date('Y-m-d H:i:s'),
        ];
    }

    /**
     * セッションサマリーを生成する。
     */
    private static function buildSummary(array $observations, array $sessionMeta): array
    {
        $speciesNames = [];
        $byType = ['audio' => 0, 'visual' => 0, 'sensor' => 0];

        foreach ($observations as $obs) {
            $name = $obs['species_name'] ?? 'Unknown';
            $speciesNames[$name] = ($speciesNames[$name] ?? 0) + ($obs['detection_count'] ?? 1);
            $type = $obs['detection_type'] ?? 'audio';
            $byType[$type] = ($byType[$type] ?? 0) + 1;
        }

        arsort($speciesNames);

        return [
            'species_count' => count($speciesNames),
            'total_detections' => array_sum($speciesNames),
            'species' => $speciesNames,
            'by_type' => $byType,
            'duration_sec' => $sessionMeta['duration_sec'] ?? null,
            'distance_m' => $sessionMeta['distance_m'] ?? null,
            'route_polyline' => $sessionMeta['route_polyline'] ?? null,
        ];
    }

    /**
     * 月→季節変換（日本基準）。
     */
    private static function monthToSeason(int $month): string
    {
        return match (true) {
            $month >= 3 && $month <= 5  => 'Spring',
            $month >= 6 && $month <= 8  => 'Summer',
            $month >= 9 && $month <= 11 => 'Autumn',
            default                     => 'Winter',
        };
    }
}
