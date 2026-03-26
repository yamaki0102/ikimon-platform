<?php

/**
 * SurveyRecommender — 調査推薦エンジン
 *
 * 蓄積データの空白地帯（時間的・空間的・分類群的ギャップ）を分析し、
 * 次にどこで・いつ・何を調査すべきかを提案する。
 *
 * 目的:
 * - 網羅度グリッドの穴を埋める行動を促す
 * - 季節ごとのデータバランスを維持
 * - レビュー待ち件数を減らす
 * - ユーザーのモチベーションを高める（ゲーミフィケーション連動）
 *
 * 全メソッド static。
 */

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/CanonicalStore.php';

class SurveyRecommender
{
    /**
     * ユーザー向けの行動提案を生成
     *
     * @param float|null $lat ユーザーの現在地
     * @param float|null $lng ユーザーの現在地
     * @param string|null $userId ユーザーID
     * @return array 提案リスト
     */
    public static function recommend(?float $lat = null, ?float $lng = null, ?string $userId = null): array
    {
        $recommendations = [];

        // 1. 空間ギャップ: 未調査グリッドセル
        $spatialGaps = self::findSpatialGaps($lat, $lng);
        if (!empty($spatialGaps)) {
            $recommendations[] = [
                'type'     => 'spatial_gap',
                'priority' => 'high',
                'icon'     => '🗺️',
                'title'    => '未調査エリアが近くにあります',
                'message'  => count($spatialGaps) . '個のグリッドセルがまだ調査されていません',
                'action'   => 'ウォークまたはライブスキャンで調査',
                'data'     => $spatialGaps,
            ];
        }

        // 2. 時間ギャップ: 最近調査されていない時間帯
        $temporalGaps = self::findTemporalGaps();
        foreach ($temporalGaps as $gap) {
            $recommendations[] = $gap;
        }

        // 3. レビュー提案: 待ち件数が多い場合
        $reviewBacklog = self::getReviewBacklog();
        if ($reviewBacklog > 0) {
            $recommendations[] = [
                'type'     => 'review_needed',
                'priority' => $reviewBacklog > 20 ? 'high' : 'medium',
                'icon'     => '🔍',
                'title'    => 'レビュー待ちが' . $reviewBacklog . '件あります',
                'message'  => 'AI判定のみの観察をレビューしてTier昇格させましょう',
                'action'   => '同定センターでレビュー',
                'data'     => ['backlog' => $reviewBacklog],
            ];
        }

        // 4. 個人的な提案: ユーザーの活動に基づく
        if ($userId) {
            $personalRecs = self::personalRecommendations($userId);
            $recommendations = array_merge($recommendations, $personalRecs);
        }

        // 5. 季節提案
        $seasonalRecs = self::seasonalRecommendations();
        $recommendations = array_merge($recommendations, $seasonalRecs);

        // priority でソート（high > medium > low）
        usort($recommendations, function ($a, $b) {
            $order = ['high' => 0, 'medium' => 1, 'low' => 2];
            return ($order[$a['priority']] ?? 9) <=> ($order[$b['priority']] ?? 9);
        });

        return array_slice($recommendations, 0, 5); // 最大5件
    }

    /**
     * 未調査の空間グリッド（~100mセル）を検索
     */
    private static function findSpatialGaps(?float $lat, ?float $lng): array
    {
        if ($lat === null || $lng === null) return [];

        $pdo = self::getPDO();

        // 周囲 1km のグリッドを調べる（0.01度 ≈ 1km）
        $gridSize = 0.001; // ~100m
        $radius = 0.01;    // ~1km

        // この範囲内の既存グリッドセル
        $stmt = $pdo->prepare("
            SELECT
                ROUND(decimal_latitude / :gs) * :gs2 as grid_lat,
                ROUND(decimal_longitude / :gs3) * :gs4 as grid_lng,
                COUNT(*) as obs_count
            FROM events
            WHERE decimal_latitude BETWEEN :lat_min AND :lat_max
              AND decimal_longitude BETWEEN :lng_min AND :lng_max
            GROUP BY grid_lat, grid_lng
        ");
        $stmt->execute([
            ':gs'      => $gridSize,
            ':gs2'     => $gridSize,
            ':gs3'     => $gridSize,
            ':gs4'     => $gridSize,
            ':lat_min' => $lat - $radius,
            ':lat_max' => $lat + $radius,
            ':lng_min' => $lng - $radius,
            ':lng_max' => $lng + $radius,
        ]);

        $surveyed = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $key = round($row['grid_lat'], 4) . ',' . round($row['grid_lng'], 4);
            $surveyed[$key] = (int) $row['obs_count'];
        }

        // 理論上のグリッドセルと比較して未調査を見つける
        $gaps = [];
        for ($gLat = $lat - $radius; $gLat <= $lat + $radius; $gLat += $gridSize) {
            for ($gLng = $lng - $radius; $gLng <= $lng + $radius; $gLng += $gridSize) {
                $key = round($gLat, 4) . ',' . round($gLng, 4);
                if (!isset($surveyed[$key])) {
                    $gaps[] = ['lat' => round($gLat, 4), 'lng' => round($gLng, 4)];
                }
            }
        }

        // 近い順にソート
        usort($gaps, function ($a, $b) use ($lat, $lng) {
            $dA = pow($a['lat'] - $lat, 2) + pow($a['lng'] - $lng, 2);
            $dB = pow($b['lat'] - $lat, 2) + pow($b['lng'] - $lng, 2);
            return $dA <=> $dB;
        });

        return array_slice($gaps, 0, 10);
    }

    /**
     * 時間的ギャップを検出
     */
    private static function findTemporalGaps(): array
    {
        $pdo = self::getPDO();
        $gaps = [];

        // 早朝（5-7時）の調査が少ない場合
        $earlyMorning = $pdo->query("
            SELECT COUNT(*) FROM events
            WHERE CAST(strftime('%H', event_date) AS INTEGER) BETWEEN 5 AND 6
              AND event_date >= datetime('now', '-30 days')
        ")->fetchColumn();

        if ((int) $earlyMorning < 3) {
            $gaps[] = [
                'type'     => 'temporal_gap',
                'priority' => 'medium',
                'icon'     => '🌅',
                'title'    => '早朝の調査データが不足',
                'message'  => '5〜7時台の観察は鳥類の検出率が最も高い時間帯です',
                'action'   => '早朝ウォークで鳥類データを補完',
                'data'     => ['time_range' => '05:00-07:00', 'current_count' => (int) $earlyMorning],
            ];
        }

        // 夜間（19-21時）のデータ
        $evening = $pdo->query("
            SELECT COUNT(*) FROM events
            WHERE CAST(strftime('%H', event_date) AS INTEGER) BETWEEN 19 AND 21
              AND event_date >= datetime('now', '-30 days')
        ")->fetchColumn();

        if ((int) $evening < 2) {
            $gaps[] = [
                'type'     => 'temporal_gap',
                'priority' => 'low',
                'icon'     => '🌙',
                'title'    => '夜間データも価値あり',
                'message'  => '夜行性の生物（フクロウ、コウモリ等）の検出に有効です',
                'action'   => '夕方〜夜のウォークを試す',
                'data'     => ['time_range' => '19:00-21:00', 'current_count' => (int) $evening],
            ];
        }

        return $gaps;
    }

    /**
     * レビュー待ち件数
     */
    private static function getReviewBacklog(): int
    {
        $pdo = self::getPDO();
        return (int) $pdo->query("
            SELECT COUNT(*) FROM occurrences WHERE evidence_tier = 1
        ")->fetchColumn();
    }

    /**
     * ユーザー別のパーソナル提案
     */
    private static function personalRecommendations(string $userId): array
    {
        $pdo = self::getPDO();
        $recs = [];

        // ユーザーの最終セッション日時
        $lastSession = $pdo->prepare("
            SELECT MAX(event_date) FROM events WHERE recorded_by = :uid
        ");
        $lastSession->execute([':uid' => $userId]);
        $last = $lastSession->fetchColumn();

        if ($last) {
            $daysSince = (int) ((time() - strtotime($last)) / 86400);
            if ($daysSince >= 7) {
                $recs[] = [
                    'type'     => 'personal',
                    'priority' => 'medium',
                    'icon'     => '🚶',
                    'title'    => $daysSince . '日間フィールドに出ていません',
                    'message'  => '定期的な観察が長期データの価値を高めます',
                    'action'   => '今日ウォークに出かけよう',
                    'data'     => ['days_since_last' => $daysSince],
                ];
            }
        }

        // ユーザーの種数
        $userSpecies = $pdo->prepare("
            SELECT COUNT(DISTINCT o.scientific_name)
            FROM occurrences o
            JOIN events e ON o.event_id = e.event_id
            WHERE e.recorded_by = :uid AND o.scientific_name IS NOT NULL
        ");
        $userSpecies->execute([':uid' => $userId]);
        $count = (int) $userSpecies->fetchColumn();

        $totalSpecies = (int) $pdo->query("
            SELECT COUNT(DISTINCT scientific_name) FROM occurrences WHERE scientific_name IS NOT NULL
        ")->fetchColumn();

        if ($totalSpecies > 0 && $count < $totalSpecies * 0.5) {
            $remaining = $totalSpecies - $count;
            $recs[] = [
                'type'     => 'personal',
                'priority' => 'low',
                'icon'     => '🎯',
                'title'    => 'あと' . $remaining . '種で全種コンプリート',
                'message'  => '他のユーザーが見つけた種をあなたも探してみましょう',
                'action'   => '図鑑で未観察の種をチェック',
                'data'     => ['user_species' => $count, 'total_species' => $totalSpecies],
            ];
        }

        return $recs;
    }

    /**
     * 季節に応じた提案
     */
    private static function seasonalRecommendations(): array
    {
        $month = (int) date('n');
        $recs = [];

        // 春 (3-5月): 渡り鳥
        if ($month >= 3 && $month <= 5) {
            $recs[] = [
                'type'     => 'seasonal',
                'priority' => 'low',
                'icon'     => '🌸',
                'title'    => '春の渡りシーズン',
                'message'  => '渡り鳥の飛来をウォークモードで記録しましょう。水辺や林縁がおすすめ',
                'action'   => '水辺でウォーク',
                'data'     => ['season' => 'spring_migration'],
            ];
        }

        // 夏 (6-8月): 昆虫ピーク
        if ($month >= 6 && $month <= 8) {
            $recs[] = [
                'type'     => 'seasonal',
                'priority' => 'low',
                'icon'     => '🦋',
                'title'    => '昆虫の活動ピーク',
                'message'  => 'ライブスキャンのカメラ検出で昆虫データを蓄積しましょう',
                'action'   => '草地でライブスキャン',
                'data'     => ['season' => 'insect_peak'],
            ];
        }

        // 秋 (9-11月): 秋の渡り + キノコ
        if ($month >= 9 && $month <= 11) {
            $recs[] = [
                'type'     => 'seasonal',
                'priority' => 'low',
                'icon'     => '🍂',
                'title'    => '秋の渡り & 菌類シーズン',
                'message'  => '秋は渡りの逆行＋キノコ類が豊富。林床スキャンも有効',
                'action'   => '林でライブスキャン',
                'data'     => ['season' => 'autumn_migration_fungi'],
            ];
        }

        // 冬 (12-2月): 越冬鳥
        if ($month === 12 || $month <= 2) {
            $recs[] = [
                'type'     => 'seasonal',
                'priority' => 'low',
                'icon'     => '❄️',
                'title'    => '越冬鳥の観察シーズン',
                'message'  => '水辺や干潟でウォークモード。カモ類やシギ類が飛来しています',
                'action'   => '水辺でウォーク',
                'data'     => ['season' => 'winter_birds'],
            ];
        }

        return $recs;
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
