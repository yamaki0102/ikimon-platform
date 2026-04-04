<?php

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/DataStore.php';
require_once __DIR__ . '/MeshCode.php';

/**
 * ContributionLedger
 *
 * セッション単位の「何がたまったか / 何が前進したか」を
 * SQLite に集約する軽量 ledger。
 */
class ContributionLedger
{
    private static ?PDO $pdo = null;
    private static bool $schemaReady = false;

    private static function getPDO(): PDO
    {
        if (self::$pdo === null) {
            $dbPath = DATA_DIR . '/ikimon.db';
            self::$pdo = new PDO('sqlite:' . $dbPath);
            self::$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            self::$pdo->exec('PRAGMA foreign_keys = ON');
            self::$pdo->exec('PRAGMA journal_mode = WAL');
        }

        self::ensureSchema();
        return self::$pdo;
    }

    private static function ensureSchema(): void
    {
        if (self::$schemaReady) {
            return;
        }
        self::$schemaReady = true;

        $pdo = self::$pdo;
        if (!$pdo) {
            return;
        }

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS session_contributions (
                session_id TEXT PRIMARY KEY,
                canonical_event_id TEXT,
                user_id TEXT NOT NULL,
                official_record INTEGER DEFAULT 1,
                session_intent TEXT DEFAULT 'official',
                started_at TEXT,
                ended_at TEXT,
                duration_sec INTEGER DEFAULT 0,
                distance_m REAL DEFAULT 0,
                scan_mode TEXT,
                movement_mode TEXT,
                mesh3_count INTEGER DEFAULT 0,
                mesh4_count INTEGER DEFAULT 0,
                env_snapshot_count INTEGER DEFAULT 0,
                audio_segment_count INTEGER DEFAULT 0,
                visual_detection_count INTEGER DEFAULT 0,
                evidence_count INTEGER DEFAULT 0,
                data_point_count INTEGER DEFAULT 0,
                new_mesh_count INTEGER DEFAULT 0,
                revisit_mesh_count INTEGER DEFAULT 0,
                new_coverage_slot_count INTEGER DEFAULT 0,
                repeat_coverage_slot_count INTEGER DEFAULT 0,
                absence_slot_count INTEGER DEFAULT 0,
                archive_value_score REAL DEFAULT 0,
                community_coverage_gain REAL DEFAULT 0,
                repeatability_score REAL DEFAULT 0,
                effort_quality_score REAL DEFAULT 0,
                guaranteed_win_count INTEGER DEFAULT 0,
                summary_json TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        ");

        $pdo->exec("
            CREATE TABLE IF NOT EXISTS coverage_slots (
                slot_id TEXT PRIMARY KEY,
                mesh3 TEXT,
                mesh4 TEXT,
                season TEXT,
                timeband TEXT,
                weather TEXT,
                modality TEXT,
                movement TEXT,
                first_seen_at TEXT,
                last_seen_at TEXT,
                sample_count INTEGER DEFAULT 0,
                session_count INTEGER DEFAULT 0,
                user_count INTEGER DEFAULT 0,
                best_evidence_tier REAL DEFAULT 0,
                total_duration_sec INTEGER DEFAULT 0,
                coverage_status TEXT DEFAULT 'partial'
            )
        ");

        self::ensureColumn($pdo, 'session_contributions', 'official_record', "INTEGER DEFAULT 1");
        self::ensureColumn($pdo, 'session_contributions', 'session_intent', "TEXT DEFAULT 'official'");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_session_contributions_user ON session_contributions(user_id)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_session_contributions_official ON session_contributions(official_record)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_coverage_slots_mesh4 ON coverage_slots(mesh4)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_coverage_slots_mesh3 ON coverage_slots(mesh3)");
    }

    private static function ensureColumn(PDO $pdo, string $table, string $column, string $definition): void
    {
        $stmt = $pdo->query("PRAGMA table_info($table)");
        $columns = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
        foreach ($columns as $info) {
            if (($info['name'] ?? '') === $column) {
                return;
            }
        }
        $pdo->exec("ALTER TABLE $table ADD COLUMN $column $definition");
    }

    public static function recordSessionContribution(string $sessionId): ?array
    {
        $sessionLogs = array_values(array_filter(
            DataStore::fetchAll('passive_sessions'),
            static fn($row) => ($row['session_id'] ?? '') === $sessionId
        ));

        if (empty($sessionLogs)) {
            return null;
        }

        usort($sessionLogs, static fn($a, $b) => strcmp($a['created_at'] ?? '', $b['created_at'] ?? ''));

        $finalLog = end($sessionLogs);
        $userId = $finalLog['user_id'] ?? '';
        if ($userId === '') {
            return null;
        }

        $sessionMeta = [];
        foreach ($sessionLogs as $log) {
            $sessionMeta = array_merge($sessionMeta, $log['session_meta'] ?? []);
        }

        $observations = array_values(array_filter(
            DataStore::fetchAll('observations'),
            static fn($row) => ($row['passive_session_id'] ?? '') === $sessionId
        ));

        $envLogs = array_values(array_filter(
            DataStore::fetchAll('environment_logs'),
            static fn($row) => ($row['session_id'] ?? '') === $sessionId
        ));

        $routePoints = self::parseRoutePolyline($sessionMeta['route_polyline'] ?? '');
        $routeMeshData = self::meshSetFromPoints($routePoints);
        $obsMeshData = self::meshSetFromObservations($observations);

        $mesh3Set = array_values(array_unique(array_merge($routeMeshData['mesh3'], $obsMeshData['mesh3'])));
        $mesh4Set = array_values(array_unique(array_merge($routeMeshData['mesh4'], $obsMeshData['mesh4'])));

        $durationSec = (int)($sessionMeta['duration_sec'] ?? 0);
        foreach ($sessionLogs as $log) {
            $durationSec = max($durationSec, (int)($log['session_meta']['duration_sec'] ?? 0));
        }
        $distanceM = (float)($sessionMeta['distance_m'] ?? 0);
        foreach ($sessionLogs as $log) {
            $distanceM = max($distanceM, (float)($log['session_meta']['distance_m'] ?? 0));
        }

        $audioSegmentCount = 0;
        $visualDetectionCount = 0;
        $sensorCount = 0;
        foreach ($sessionLogs as $log) {
            $byType = $log['summary']['by_type'] ?? [];
            $audioSegmentCount += (int)($byType['audio'] ?? 0);
            $visualDetectionCount += (int)($byType['visual'] ?? 0);
            $sensorCount += (int)($byType['sensor'] ?? 0);
        }

        $envSnapshotCount = 0;
        foreach ($envLogs as $log) {
            $envSnapshotCount += (int)($log['observation_count'] ?? count($log['observations'] ?? []));
        }
        if ($envSnapshotCount === 0) {
            foreach ($sessionLogs as $log) {
                $envSnapshotCount = max($envSnapshotCount, (int)($log['env_observation_count'] ?? 0));
            }
        }

        $evidenceCount = 0;
        $audioObsMesh4 = [];
        $visualObsMesh4 = [];
        foreach ($observations as $obs) {
            if (!empty($obs['photo_ref']) || !empty($obs['audio_evidence_path']) || !empty($obs['audio_snippet_hash'])) {
                $evidenceCount++;
            }
            $mesh4 = $obs['mesh_code4'] ?? null;
            if (!$mesh4) {
                continue;
            }
            $type = $obs['detection_type'] ?? '';
            if ($type === 'audio') {
                $audioObsMesh4[$mesh4] = true;
            } elseif ($type === 'visual') {
                $visualObsMesh4[$mesh4] = true;
            }
        }

        $startedAt = $sessionLogs[0]['started_at'] ?? ($finalLog['created_at'] ?? date('c'));
        $endedAt = $finalLog['ended_at'] ?? ($finalLog['created_at'] ?? date('c'));
        $scanMode = $finalLog['scan_mode'] ?? ($sessionMeta['scan_mode'] ?? 'walk');
        $movementMode = $sessionMeta['movement_mode'] ?? 'walk';
        $officialRecord = array_key_exists('official_record', $sessionMeta)
            ? (bool)$sessionMeta['official_record']
            : true;
        $sessionIntent = (string)($sessionMeta['session_intent'] ?? ($officialRecord ? 'official' : 'test'));
        $weather = self::normalizeWeather($sessionMeta['weather'] ?? null);
        $season = self::seasonFromDate($startedAt);
        $timeband = self::timebandFromDate($startedAt);

        $dataPointCount = $envSnapshotCount + $audioSegmentCount + $visualDetectionCount + count($routePoints) + $sensorCount;
        $absenceSlotCount = empty($observations) ? count($mesh4Set) : 0;

        $slotSpecs = [];
        foreach ($mesh4Set as $mesh4) {
            $slotSpecs[] = self::slotSpec($mesh4, $season, $timeband, $weather, 'track', $movementMode);
        }
        if ($envSnapshotCount > 0) {
            foreach ($mesh4Set as $mesh4) {
                $slotSpecs[] = self::slotSpec($mesh4, $season, $timeband, $weather, 'env', $movementMode);
            }
        }
        foreach (array_keys($audioObsMesh4) as $mesh4) {
            $slotSpecs[] = self::slotSpec($mesh4, $season, $timeband, $weather, 'audio', $movementMode);
        }
        foreach (array_keys($visualObsMesh4) as $mesh4) {
            $slotSpecs[] = self::slotSpec($mesh4, $season, $timeband, $weather, 'visual', $movementMode);
        }
        $slotSpecs = self::uniqueSlotSpecs($slotSpecs);

        $pdo = self::getPDO();

        $slotIds = array_map(static fn($slot) => $slot['slot_id'], $slotSpecs);
        $existingSlotIds = [];
        $existingMesh4 = [];
        $totalCoverageBefore = (int)$pdo->query("SELECT COUNT(*) FROM coverage_slots")->fetchColumn();
        $stmtSessions = $pdo->prepare("SELECT COUNT(*) FROM session_contributions WHERE official_record = 1 AND session_id != :sid");
        $stmtSessions->execute([':sid' => $sessionId]);
        $totalSessionsBefore = (int)$stmtSessions->fetchColumn();

        $stmtHours = $pdo->prepare("SELECT COALESCE(SUM(duration_sec), 0) FROM session_contributions WHERE official_record = 1 AND session_id != :sid");
        $stmtHours->execute([':sid' => $sessionId]);
        $totalEffortBeforeSec = (int)$stmtHours->fetchColumn();

        $stmtContrib = $pdo->prepare("SELECT COUNT(DISTINCT user_id) FROM session_contributions WHERE official_record = 1 AND session_id != :sid");
        $stmtContrib->execute([':sid' => $sessionId]);
        $contributorsBefore = (int)$stmtContrib->fetchColumn();
        $stmtCurrentUser = $pdo->prepare("SELECT COUNT(*) FROM session_contributions WHERE official_record = 1 AND user_id = :uid AND session_id != :sid");
        $stmtCurrentUser->execute([':uid' => $userId, ':sid' => $sessionId]);
        $userSeenBefore = (int)$stmtCurrentUser->fetchColumn() > 0;

        if (!empty($slotIds)) {
            $placeholders = implode(',', array_fill(0, count($slotIds), '?'));
            $stmt = $pdo->prepare("SELECT slot_id, mesh4 FROM coverage_slots WHERE slot_id IN ($placeholders)");
            $stmt->execute($slotIds);
            foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
                $existingSlotIds[$row['slot_id']] = true;
            }

            $mesh4Placeholders = implode(',', array_fill(0, count($mesh4Set), '?'));
            if ($mesh4Placeholders !== '') {
                $stmtMeshes = $pdo->prepare("SELECT DISTINCT mesh4 FROM coverage_slots WHERE mesh4 IN ($mesh4Placeholders)");
                $stmtMeshes->execute($mesh4Set);
                foreach ($stmtMeshes->fetchAll(PDO::FETCH_COLUMN) as $mesh4) {
                    $existingMesh4[$mesh4] = true;
                }
            }
        }

        $newCoverageSlotCount = 0;
        $repeatCoverageSlotCount = 0;
        foreach ($slotSpecs as $slot) {
            if (isset($existingSlotIds[$slot['slot_id']])) {
                $repeatCoverageSlotCount++;
            } else {
                $newCoverageSlotCount++;
            }
        }

        $newMeshCount = 0;
        $revisitMeshCount = 0;
        foreach ($mesh4Set as $mesh4) {
            if (isset($existingMesh4[$mesh4])) {
                $revisitMeshCount++;
            } else {
                $newMeshCount++;
            }
        }

        $upsert = $pdo->prepare("
            INSERT INTO coverage_slots (
                slot_id, mesh3, mesh4, season, timeband, weather, modality, movement,
                first_seen_at, last_seen_at, sample_count, session_count, user_count,
                best_evidence_tier, total_duration_sec, coverage_status
            ) VALUES (
                :slot_id, :mesh3, :mesh4, :season, :timeband, :weather, :modality, :movement,
                :first_seen_at, :last_seen_at, 1, 1, 1,
                :best_evidence_tier, :total_duration_sec, :coverage_status
            )
            ON CONFLICT(slot_id) DO UPDATE SET
                last_seen_at = excluded.last_seen_at,
                sample_count = coverage_slots.sample_count + 1,
                session_count = coverage_slots.session_count + 1,
                best_evidence_tier = MAX(coverage_slots.best_evidence_tier, excluded.best_evidence_tier),
                total_duration_sec = coverage_slots.total_duration_sec + excluded.total_duration_sec,
                coverage_status = CASE
                    WHEN coverage_slots.sample_count + 1 >= 2 THEN 'repeatable'
                    ELSE coverage_slots.coverage_status
                END
        ");

        if ($officialRecord) {
            foreach ($slotSpecs as $slot) {
                $upsert->execute([
                    ':slot_id' => $slot['slot_id'],
                    ':mesh3' => $slot['mesh3'],
                    ':mesh4' => $slot['mesh4'],
                    ':season' => $slot['season'],
                    ':timeband' => $slot['timeband'],
                    ':weather' => $slot['weather'],
                    ':modality' => $slot['modality'],
                    ':movement' => $slot['movement'],
                    ':first_seen_at' => $startedAt,
                    ':last_seen_at' => $endedAt,
                    ':best_evidence_tier' => $evidenceCount > 0 ? 2 : 1,
                    ':total_duration_sec' => $durationSec,
                    ':coverage_status' => isset($existingSlotIds[$slot['slot_id']]) ? 'repeatable' : 'partial',
                ]);
            }
        }

        $archiveValueScore = round(
            self::normalize($durationSec / 60, 60) * 0.25 +
            self::normalize($envSnapshotCount, 30) * 0.20 +
            self::normalize($evidenceCount, 8) * 0.20 +
            self::normalize($newCoverageSlotCount, 12) * 0.20 +
            self::normalize($repeatCoverageSlotCount, 12) * 0.15,
            3
        );
        $communityCoverageGain = round($newCoverageSlotCount + ($repeatCoverageSlotCount * 0.35) + ($newMeshCount * 0.7), 3);
        $repeatabilityScore = round($revisitMeshCount + self::normalize($repeatCoverageSlotCount, 8) * 3, 3);
        $effortQualityScore = round(
            self::normalize($durationSec / 60, 45) * 0.4 +
            self::normalize($distanceM, 2500) * 0.2 +
            self::normalize($envSnapshotCount, 24) * 0.2 +
            self::normalize(count($routePoints), 60) * 0.2,
            3
        );

        $guaranteedWinCount = 0;
        foreach ([
            $newCoverageSlotCount > 0,
            $newMeshCount > 0,
            $revisitMeshCount > 0,
            $envSnapshotCount > 0,
            $durationSec >= 600,
            $dataPointCount >= 20,
        ] as $flag) {
            if ($flag) {
                $guaranteedWinCount++;
            }
        }

        $totalCoverageAfter = $totalCoverageBefore + ($officialRecord ? $newCoverageSlotCount : 0);
        $communityEffortAfterHours = round(($totalEffortBeforeSec + ($officialRecord ? $durationSec : 0)) / 3600, 1);
        $contributorsAfter = $contributorsBefore + (($officialRecord && !$userSeenBefore) ? 1 : 0);

        $headline = [
            'active_minutes' => (int)round($durationSec / 60),
            'distance_m' => (int)round($distanceM),
            'data_points' => $dataPointCount,
            'guaranteed_wins' => $guaranteedWinCount,
            'session_intent' => $sessionIntent,
            'official_record' => $officialRecord,
        ];

        $dataCollected = [
            ['label' => '環境ログ', 'value' => $envSnapshotCount, 'unit' => '件'],
            ['label' => '音声窓', 'value' => $audioSegmentCount, 'unit' => '件'],
            ['label' => '視覚検出', 'value' => $visualDetectionCount, 'unit' => '件'],
            ['label' => '移動軌跡', 'value' => round($distanceM / 1000, 1), 'unit' => 'km'],
            ['label' => 'データ点', 'value' => $dataPointCount, 'unit' => '点'],
        ];

        $contributionImpact = [];
        if (!$officialRecord) {
            $contributionImpact[] = ['icon' => '🧪', 'text' => 'このセッションは動作チェックとして保存され、本番の集計には反映されない'];
        }
        if ($newCoverageSlotCount > 0) {
            $contributionImpact[] = ['icon' => '🧩', 'text' => "新しい観測枠を {$newCoverageSlotCount} 個埋めた"];
        }
        if ($newMeshCount > 0) {
            $contributionImpact[] = ['icon' => '🗺️', 'text' => "新しいメッシュを {$newMeshCount} か所前進させた"];
        }
        if ($revisitMeshCount > 0) {
            $contributionImpact[] = ['icon' => '🔁', 'text' => "再訪メッシュ {$revisitMeshCount} か所で比較可能性を上げた"];
        }
        if ($envSnapshotCount > 0) {
            $contributionImpact[] = ['icon' => '🌡️', 'text' => "環境ログ {$envSnapshotCount} 件がタイムカプセルに追加された"];
        }
        if ($dataPointCount > 0) {
            $contributionImpact[] = ['icon' => '💾', 'text' => "今回の散歩で {$dataPointCount} データ点が蓄積された"];
        }
        if (empty($contributionImpact)) {
            $contributionImpact[] = ['icon' => '🚶', 'text' => '歩いた記録そのものが地域データの土台になった'];
        }

        $communityProgress = $officialRecord
            ? [
                ['icon' => '📈', 'text' => "累計セッションが {$totalSessionsBefore} → " . ($totalSessionsBefore + 1) . " になった"],
                ['icon' => '🌍', 'text' => "地域の観測枠が {$totalCoverageBefore} → {$totalCoverageAfter} に増えた"],
                ['icon' => '⏱️', 'text' => "みんなの累計観測時間が {$communityEffortAfterHours} 時間になった"],
                ['icon' => '🤝', 'text' => "この流れに参加した記録者は {$contributorsAfter} 人"],
            ]
            : [
                ['icon' => '🧰', 'text' => '今回の結果はテストログとして保持し、本番の共同観測カウントは増やしていない'],
                ['icon' => '📈', 'text' => "本番の累計セッションは {$totalSessionsBefore} のまま"],
                ['icon' => '🌍', 'text' => "本番の観測枠は {$totalCoverageBefore} のまま"],
                ['icon' => '⏱️', 'text' => "本番の累計観測時間は " . round($totalEffortBeforeSec / 3600, 1) . " 時間のまま"],
            ];

        $summary = [
            'headline' => $headline,
            'data_collected' => $dataCollected,
            'contribution_impact' => $contributionImpact,
            'community_progress' => $communityProgress,
            'scores' => [
                'archive_value_score' => $archiveValueScore,
                'community_coverage_gain' => $communityCoverageGain,
                'repeatability_score' => $repeatabilityScore,
                'effort_quality_score' => $effortQualityScore,
            ],
            'meshes' => [
                'mesh3_count' => count($mesh3Set),
                'mesh4_count' => count($mesh4Set),
                'new_mesh_count' => $newMeshCount,
                'revisit_mesh_count' => $revisitMeshCount,
            ],
        ];

        $canonicalEventId = null;
        foreach ($envLogs as $log) {
            if (!empty($log['canonical_event_id'])) {
                $canonicalEventId = $log['canonical_event_id'];
                break;
            }
        }

        $stmt = $pdo->prepare("
            INSERT INTO session_contributions (
                session_id, canonical_event_id, user_id, official_record, session_intent, started_at, ended_at,
                duration_sec, distance_m, scan_mode, movement_mode,
                mesh3_count, mesh4_count, env_snapshot_count, audio_segment_count,
                visual_detection_count, evidence_count, data_point_count,
                new_mesh_count, revisit_mesh_count, new_coverage_slot_count,
                repeat_coverage_slot_count, absence_slot_count, archive_value_score,
                community_coverage_gain, repeatability_score, effort_quality_score,
                guaranteed_win_count, summary_json, created_at, updated_at
            ) VALUES (
                :session_id, :canonical_event_id, :user_id, :official_record, :session_intent, :started_at, :ended_at,
                :duration_sec, :distance_m, :scan_mode, :movement_mode,
                :mesh3_count, :mesh4_count, :env_snapshot_count, :audio_segment_count,
                :visual_detection_count, :evidence_count, :data_point_count,
                :new_mesh_count, :revisit_mesh_count, :new_coverage_slot_count,
                :repeat_coverage_slot_count, :absence_slot_count, :archive_value_score,
                :community_coverage_gain, :repeatability_score, :effort_quality_score,
                :guaranteed_win_count, :summary_json, :created_at, :updated_at
            )
            ON CONFLICT(session_id) DO UPDATE SET
                canonical_event_id = excluded.canonical_event_id,
                user_id = excluded.user_id,
                official_record = excluded.official_record,
                session_intent = excluded.session_intent,
                started_at = excluded.started_at,
                ended_at = excluded.ended_at,
                duration_sec = excluded.duration_sec,
                distance_m = excluded.distance_m,
                scan_mode = excluded.scan_mode,
                movement_mode = excluded.movement_mode,
                mesh3_count = excluded.mesh3_count,
                mesh4_count = excluded.mesh4_count,
                env_snapshot_count = excluded.env_snapshot_count,
                audio_segment_count = excluded.audio_segment_count,
                visual_detection_count = excluded.visual_detection_count,
                evidence_count = excluded.evidence_count,
                data_point_count = excluded.data_point_count,
                new_mesh_count = excluded.new_mesh_count,
                revisit_mesh_count = excluded.revisit_mesh_count,
                new_coverage_slot_count = excluded.new_coverage_slot_count,
                repeat_coverage_slot_count = excluded.repeat_coverage_slot_count,
                absence_slot_count = excluded.absence_slot_count,
                archive_value_score = excluded.archive_value_score,
                community_coverage_gain = excluded.community_coverage_gain,
                repeatability_score = excluded.repeatability_score,
                effort_quality_score = excluded.effort_quality_score,
                guaranteed_win_count = excluded.guaranteed_win_count,
                summary_json = excluded.summary_json,
                updated_at = excluded.updated_at
        ");

        $now = date('c');
        $stmt->execute([
            ':session_id' => $sessionId,
            ':canonical_event_id' => $canonicalEventId,
            ':user_id' => $userId,
            ':official_record' => $officialRecord ? 1 : 0,
            ':session_intent' => $sessionIntent,
            ':started_at' => $startedAt,
            ':ended_at' => $endedAt,
            ':duration_sec' => $durationSec,
            ':distance_m' => $distanceM,
            ':scan_mode' => $scanMode,
            ':movement_mode' => $movementMode,
            ':mesh3_count' => count($mesh3Set),
            ':mesh4_count' => count($mesh4Set),
            ':env_snapshot_count' => $envSnapshotCount,
            ':audio_segment_count' => $audioSegmentCount,
            ':visual_detection_count' => $visualDetectionCount,
            ':evidence_count' => $evidenceCount,
            ':data_point_count' => $dataPointCount,
            ':new_mesh_count' => $newMeshCount,
            ':revisit_mesh_count' => $revisitMeshCount,
            ':new_coverage_slot_count' => $newCoverageSlotCount,
            ':repeat_coverage_slot_count' => $repeatCoverageSlotCount,
            ':absence_slot_count' => $absenceSlotCount,
            ':archive_value_score' => $archiveValueScore,
            ':community_coverage_gain' => $communityCoverageGain,
            ':repeatability_score' => $repeatabilityScore,
            ':effort_quality_score' => $effortQualityScore,
            ':guaranteed_win_count' => $guaranteedWinCount,
            ':summary_json' => json_encode($summary, JSON_UNESCAPED_UNICODE),
            ':created_at' => $now,
            ':updated_at' => $now,
        ]);

        return self::getSessionContribution($sessionId);
    }

    public static function getSessionContribution(string $sessionId): ?array
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("SELECT * FROM session_contributions WHERE session_id = :sid");
        $stmt->execute([':sid' => $sessionId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }
        $row['summary'] = !empty($row['summary_json']) ? json_decode($row['summary_json'], true) : [];
        return $row;
    }

    public static function getCommunitySnapshot(): array
    {
        $pdo = self::getPDO();
        $sessions = (int)$pdo->query("SELECT COUNT(*) FROM session_contributions WHERE official_record = 1")->fetchColumn();
        $hours = (float)$pdo->query("SELECT COALESCE(SUM(duration_sec), 0) / 3600.0 FROM session_contributions WHERE official_record = 1")->fetchColumn();
        $slots = (int)$pdo->query("SELECT COUNT(*) FROM coverage_slots")->fetchColumn();
        $contributors = (int)$pdo->query("SELECT COUNT(DISTINCT user_id) FROM session_contributions WHERE official_record = 1")->fetchColumn();

        return [
            'total_sessions' => $sessions,
            'total_effort_hours' => round($hours, 1),
            'total_coverage_slots' => $slots,
            'contributor_count' => $contributors,
        ];
    }

    public static function listRecentSessions(int $limit = 20): array
    {
        $pdo = self::getPDO();
        $limit = max(1, min(100, $limit));
        $stmt = $pdo->prepare("
            SELECT
                session_id,
                user_id,
                official_record,
                session_intent,
                started_at,
                ended_at,
                duration_sec,
                distance_m,
                scan_mode,
                movement_mode,
                data_point_count,
                env_snapshot_count,
                audio_segment_count,
                visual_detection_count,
                new_mesh_count,
                revisit_mesh_count,
                new_coverage_slot_count,
                repeat_coverage_slot_count,
                guaranteed_win_count,
                archive_value_score,
                community_coverage_gain,
                repeatability_score,
                effort_quality_score,
                updated_at
            FROM session_contributions
            ORDER BY COALESCE(ended_at, updated_at, started_at) DESC
            LIMIT :limit
        ");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    public static function getSessionDebug(string $sessionId): ?array
    {
        $ledger = self::getSessionContribution($sessionId);
        if ($ledger === null) {
            return null;
        }

        $sessionLogs = array_values(array_filter(
            DataStore::fetchAll('passive_sessions'),
            static fn($row) => ($row['session_id'] ?? '') === $sessionId
        ));
        usort($sessionLogs, static fn($a, $b) => strcmp($a['created_at'] ?? '', $b['created_at'] ?? ''));

        $envLogs = array_values(array_filter(
            DataStore::fetchAll('environment_logs'),
            static fn($row) => ($row['session_id'] ?? '') === $sessionId
        ));
        usort($envLogs, static fn($a, $b) => strcmp($a['created_at'] ?? '', $b['created_at'] ?? ''));

        $observations = array_values(array_filter(
            DataStore::fetchAll('observations'),
            static fn($row) => ($row['passive_session_id'] ?? '') === $sessionId
        ));
        usort($observations, static fn($a, $b) => strcmp($b['observed_at'] ?? '', $a['observed_at'] ?? ''));

        $sessionMeta = [];
        foreach ($sessionLogs as $log) {
            $sessionMeta = array_merge($sessionMeta, $log['session_meta'] ?? []);
        }

        $routePoints = self::parseRoutePolyline((string)($sessionMeta['route_polyline'] ?? ''));
        $observationTypes = [];
        $topSpecies = [];
        foreach ($observations as $obs) {
            $type = (string)($obs['detection_type'] ?? 'unknown');
            $observationTypes[$type] = ($observationTypes[$type] ?? 0) + 1;
            $name = (string)($obs['taxon']['name'] ?? $obs['taxon_name'] ?? '未同定');
            if ($name !== '') {
                $topSpecies[$name] = ($topSpecies[$name] ?? 0) + 1;
            }
        }
        arsort($topSpecies);

        return [
            'ledger' => $ledger,
            'derived' => [
                'passive_log_count' => count($sessionLogs),
                'environment_log_count' => count($envLogs),
                'observation_count' => count($observations),
                'route_point_count' => count($routePoints),
                'observation_types' => $observationTypes,
                'top_species' => array_slice($topSpecies, 0, 8, true),
            ],
            'session_meta' => $sessionMeta,
            'passive_logs' => array_map(
                static fn($log) => [
                    'created_at' => $log['created_at'] ?? null,
                    'started_at' => $log['started_at'] ?? null,
                    'ended_at' => $log['ended_at'] ?? null,
                    'scan_mode' => $log['scan_mode'] ?? null,
                    'is_incremental' => $log['is_incremental'] ?? false,
                    'is_final' => $log['is_final'] ?? false,
                    'event_count' => $log['event_count'] ?? 0,
                    'env_observation_count' => $log['env_observation_count'] ?? 0,
                    'summary' => $log['summary'] ?? [],
                ],
                $sessionLogs
            ),
            'environment_logs' => array_map(
                static fn($log) => [
                    'created_at' => $log['created_at'] ?? null,
                    'lat' => $log['lat'] ?? null,
                    'lng' => $log['lng'] ?? null,
                    'observation_count' => $log['observation_count'] ?? 0,
                    'observations' => array_slice($log['observations'] ?? [], 0, 12),
                ],
                $envLogs
            ),
            'observation_samples' => array_map(
                static fn($obs) => [
                    'id' => $obs['id'] ?? null,
                    'observed_at' => $obs['observed_at'] ?? null,
                    'detection_type' => $obs['detection_type'] ?? null,
                    'taxon_name' => $obs['taxon']['name'] ?? ($obs['taxon_name'] ?? '未同定'),
                    'confidence' => $obs['confidence'] ?? null,
                    'mesh_code4' => $obs['mesh_code4'] ?? null,
                    'has_photo' => !empty($obs['photo_ref']) || !empty($obs['photos']),
                    'has_audio' => !empty($obs['audio_evidence_path']) || !empty($obs['audio_snippet_hash']),
                ],
                array_slice($observations, 0, 20)
            ),
        ];
    }

    private static function parseRoutePolyline(string $polyline): array
    {
        if ($polyline === '') {
            return [];
        }
        $points = [];
        foreach (explode(';', $polyline) as $pair) {
            if ($pair === '') {
                continue;
            }
            [$lat, $lng] = array_pad(explode(',', $pair), 2, null);
            if ($lat === null || $lng === null) {
                continue;
            }
            $points[] = ['lat' => (float)$lat, 'lng' => (float)$lng];
        }
        return $points;
    }

    private static function meshSetFromPoints(array $points): array
    {
        $mesh3 = [];
        $mesh4 = [];
        foreach ($points as $pt) {
            if (empty($pt['lat']) || empty($pt['lng'])) {
                continue;
            }
            $info = MeshCode::fromLatLng((float)$pt['lat'], (float)$pt['lng']);
            $mesh3[$info['mesh3']] = true;
            $mesh4[$info['mesh4']] = true;
        }
        return ['mesh3' => array_keys($mesh3), 'mesh4' => array_keys($mesh4)];
    }

    private static function meshSetFromObservations(array $observations): array
    {
        $mesh3 = [];
        $mesh4 = [];
        foreach ($observations as $obs) {
            if (!empty($obs['mesh_code3'])) {
                $mesh3[$obs['mesh_code3']] = true;
            }
            if (!empty($obs['mesh_code4'])) {
                $mesh4[$obs['mesh_code4']] = true;
            }
        }
        return ['mesh3' => array_keys($mesh3), 'mesh4' => array_keys($mesh4)];
    }

    private static function slotSpec(string $mesh4, string $season, string $timeband, string $weather, string $modality, string $movement): array
    {
        $mesh3 = substr($mesh4, 0, 8);
        $slotId = implode('|', [$mesh4, $season, $timeband, $weather, $modality, $movement]);
        return [
            'slot_id' => $slotId,
            'mesh3' => $mesh3,
            'mesh4' => $mesh4,
            'season' => $season,
            'timeband' => $timeband,
            'weather' => $weather,
            'modality' => $modality,
            'movement' => $movement,
        ];
    }

    private static function uniqueSlotSpecs(array $slots): array
    {
        $unique = [];
        foreach ($slots as $slot) {
            $unique[$slot['slot_id']] = $slot;
        }
        return array_values($unique);
    }

    private static function seasonFromDate(string $date): string
    {
        $month = (int)date('n', strtotime($date) ?: time());
        return match (true) {
            $month >= 3 && $month <= 5 => 'spring',
            $month >= 6 && $month <= 8 => 'summer',
            $month >= 9 && $month <= 11 => 'autumn',
            default => 'winter',
        };
    }

    private static function timebandFromDate(string $date): string
    {
        $hour = (int)date('G', strtotime($date) ?: time());
        return match (true) {
            $hour < 6 => 'night',
            $hour < 9 => 'dawn',
            $hour < 12 => 'morning',
            $hour < 17 => 'day',
            $hour < 20 => 'evening',
            default => 'night',
        };
    }

    private static function normalizeWeather(?string $weather): string
    {
        $weather = strtolower(trim((string)$weather));
        if ($weather === '') {
            return 'unknown';
        }
        return match ($weather) {
            'clear', 'sunny' => 'clear',
            'cloudy', 'overcast' => 'cloudy',
            'rain', 'rainy' => 'rain',
            'snow' => 'snow',
            'fog', 'mist' => 'fog',
            default => 'unknown',
        };
    }

    private static function normalize(float $value, float $cap): float
    {
        if ($cap <= 0) {
            return 0.0;
        }
        return max(0.0, min($value / $cap, 1.0));
    }
}
