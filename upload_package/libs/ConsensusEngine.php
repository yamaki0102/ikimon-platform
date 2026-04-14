<?php

/**
 * ConsensusEngine — 同定の合意形成エンジン
 *
 * 複数のレビュアー同定をもとに、観察レコードの最終同定を決定する。
 * Evidence Tier 2→3 の昇格判定を行う。
 *
 * ルール:
 * - 2名以上の独立レビュアーが同じ種名で一致 → 合意成立
 * - 全員一致の場合: Tier 3 + data_quality='A'
 * - 多数決の場合: Tier 2.5 + data_quality='B'（3人中2人一致など）
 * - 不一致の場合: Tier 2 のまま + フラグ付き
 * - 専門家レビュアー（expert）の同定は 2票分としてカウント
 *
 * 全メソッド static。
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/CanonicalStore.php';
require_once __DIR__ . '/AuditLog.php';

class ConsensusEngine
{
    /**
     * occurrence の同定履歴を評価し、合意状態を返す
     */
    public static function evaluate(string $occurrenceId): array
    {
        $identifications = CanonicalStore::getIdentificationHistory($occurrenceId);

        if (empty($identifications)) {
            return [
                'status'    => 'no_identifications',
                'consensus' => null,
                'tier'      => null,
                'votes'     => [],
            ];
        }

        // 投票を集計（expert は 2票）
        $votes = [];
        $voterIds = [];
        foreach ($identifications as $id) {
            $taxon = strtolower(trim($id['taxon_name'] ?? ''));
            if (empty($taxon)) continue;
            // 同一レビュアーの重複は最新のみ
            if (in_array($id['identified_by'], $voterIds, true)) continue;
            $voterIds[] = $id['identified_by'];

            $weight = ($id['reviewer_level'] === 'expert') ? 2 : 1;
            if (!isset($votes[$taxon])) {
                $votes[$taxon] = ['count' => 0, 'weighted' => 0, 'voters' => [], 'confidence_sum' => 0];
            }
            $votes[$taxon]['count']++;
            $votes[$taxon]['weighted'] += $weight;
            $votes[$taxon]['voters'][] = $id['identified_by'];
            $votes[$taxon]['confidence_sum'] += (float) ($id['confidence'] ?? 0);
        }

        $totalVoters = count($voterIds);
        if ($totalVoters < 1) {
            return [
                'status'    => 'no_valid_votes',
                'consensus' => null,
                'tier'      => null,
                'votes'     => $votes,
            ];
        }

        // 最多得票を取得
        uasort($votes, function ($a, $b) { return $b['weighted'] <=> $a['weighted']; });
        $topTaxon = array_key_first($votes);
        $topVote = $votes[$topTaxon];

        // 合意判定
        if ($totalVoters >= 2 && $topVote['count'] === $totalVoters) {
            // 全員一致
            return [
                'status'           => 'unanimous',
                'consensus'        => $topTaxon,
                'tier'             => 3,
                'data_quality'     => 'A',
                'voter_count'      => $totalVoters,
                'avg_confidence'   => round($topVote['confidence_sum'] / $topVote['count'], 3),
                'votes'            => $votes,
            ];
        }

        if ($totalVoters >= 3 && $topVote['count'] >= ceil($totalVoters * 0.67)) {
            // 多数決（2/3 以上）
            return [
                'status'           => 'majority',
                'consensus'        => $topTaxon,
                'tier'             => 2.5,
                'data_quality'     => 'B',
                'voter_count'      => $totalVoters,
                'majority_count'   => $topVote['count'],
                'avg_confidence'   => round($topVote['confidence_sum'] / $topVote['count'], 3),
                'votes'            => $votes,
            ];
        }

        if ($totalVoters === 1) {
            // 単独レビュー
            return [
                'status'           => 'single_review',
                'consensus'        => $topTaxon,
                'tier'             => 2,
                'data_quality'     => 'B',
                'voter_count'      => 1,
                'avg_confidence'   => round($topVote['confidence_sum'], 3),
                'votes'            => $votes,
            ];
        }

        // 不一致
        return [
            'status'       => 'disagreement',
            'consensus'    => null,
            'tier'         => null,
            'data_quality' => 'C',
            'voter_count'  => $totalVoters,
            'votes'        => $votes,
        ];
    }

    /**
     * 合意結果に基づいて Evidence Tier を更新
     */
    public static function applyConsensus(string $occurrenceId): array
    {
        $result = self::evaluate($occurrenceId);

        if ($result['tier'] === null) {
            return $result;
        }

        $occ = CanonicalStore::getOccurrence($occurrenceId);
        if (!$occ) {
            $result['error'] = 'Occurrence not found';
            return $result;
        }

        // 現在の tier より高い場合のみ昇格
        $currentTier = (float) ($occ['evidence_tier'] ?? 1);
        if ($result['tier'] > $currentTier) {
            CanonicalStore::updateEvidenceTier(
                $occurrenceId,
                $result['tier'],
                'consensus_engine'
            );

            // data_quality 更新
            $pdo = self::getPDO();
            $stmt = $pdo->prepare("UPDATE occurrences SET data_quality = :q WHERE occurrence_id = :id");
            $stmt->execute([':q' => $result['data_quality'], ':id' => $occurrenceId]);

            // 監査ログ
            AuditLog::log(
                AuditLog::ACTION_SYNC,
                'consensus_engine',
                $occurrenceId,
                (string)($occ['event_id'] ?? ''),
                json_encode(['tier' => $currentTier], JSON_UNESCAPED_UNICODE),
                json_encode([
                    'tier' => $result['tier'],
                    'status' => $result['status'],
                    'voters' => $result['voter_count'],
                ], JSON_UNESCAPED_UNICODE),
                ['source' => 'consensus_promote']
            );

            $result['promoted'] = true;
            $result['from_tier'] = $currentTier;
        } else {
            $result['promoted'] = false;
        }

        return $result;
    }

    /**
     * レビュー待ちの occurrence を一括評価
     */
    public static function processQueue(int $limit = 100): array
    {
        $pdo = self::getPDO();
        $stmt = $pdo->prepare("
            SELECT DISTINCT o.occurrence_id
            FROM occurrences o
            JOIN identifications i ON o.occurrence_id = i.occurrence_id
            WHERE o.evidence_tier < 3
            GROUP BY o.occurrence_id
            HAVING COUNT(DISTINCT i.identified_by) >= 2
            LIMIT :limit
        ");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        $results = [];
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $occId) {
            $results[] = self::applyConsensus($occId);
        }

        return [
            'processed' => count($results),
            'promoted'  => count(array_filter($results, function ($r) { return $r['promoted'] ?? false; })),
            'details'   => $results,
        ];
    }

    private static function getPDO(): PDO
    {
        static $pdo = null;
        if ($pdo === null) {
            $dbPath = DATA_DIR . '/ikimon.db';
            $pdo = new PDO('sqlite:' . $dbPath);
            $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        }
        return $pdo;
    }
}
