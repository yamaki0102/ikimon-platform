<?php

/**
 * SurveyLogService — 調査ライフログ集約サービス
 *
 * ユーザーの調査履歴・統計を集約するビューレイヤー。
 * EventLogService と同じアーキテクチャパターンを採用。
 * 新しいデータストアは作らず、surveys データを横断クエリ。
 */

require_once __DIR__ . '/../SurveyManager.php';

class SurveyLogService
{
    /**
     * ユーザーの調査履歴（月別グルーピング）
     *
     * @return array ['2026-02' => [...surveys], '2026-01' => [...]]
     */
    public static function getUserSurveyHistory(string $userId): array
    {
        $surveys = SurveyManager::listByUser($userId, 200);

        // Filter to completed surveys only
        $completed = array_filter($surveys, fn($s) => ($s['status'] ?? '') === 'completed');

        // Sort by started_at descending (newest first)
        usort($completed, fn($a, $b) => strcmp($b['started_at'] ?? '', $a['started_at'] ?? ''));

        // Group by year-month
        $byMonth = [];
        foreach ($completed as $s) {
            $ym = substr($s['started_at'] ?? '????-??', 0, 7);
            $byMonth[$ym][] = $s;
        }

        return $byMonth;
    }

    /**
     * ユーザーの調査サマリー統計
     *
     * @return array [
     *   'survey_count'        => int,    // 完了調査数
     *   'total_duration_min'  => int,    // 累計調査時間（分）
     *   'total_observations'  => int,    // 累計発見数
     *   'total_species'       => int,    // 累計種数
     *   'avg_quality_score'   => float,  // 平均品質スコア
     *   'first_survey_date'   => ?string,// 初回調査日
     *   'protocols'           => array   // プロトコル別集計
     * ]
     */
    public static function getUserSurveyStats(string $userId): array
    {
        $history = self::getUserSurveyHistory($userId);

        $count = 0;
        $totalDuration = 0;
        $totalObs = 0;
        $totalSp = 0;
        $qualitySum = 0;
        $firstDate = null;
        $protocols = [];

        foreach ($history as $ym => $surveys) {
            foreach ($surveys as $s) {
                $count++;

                $stats = $s['stats'] ?? [];
                $totalDuration += (int)($stats['duration_min'] ?? 0);
                $totalObs += (int)($stats['obs_count'] ?? 0);
                $totalSp += (int)($stats['sp_count'] ?? 0);
                $qualitySum += (int)($stats['quality_score'] ?? 50);

                $d = $s['started_at'] ?? null;
                if ($d && (!$firstDate || $d < $firstDate)) {
                    $firstDate = $d;
                }

                $proto = $s['protocol'] ?? 'casual';
                $protocols[$proto] = ($protocols[$proto] ?? 0) + 1;
            }
        }

        return [
            'survey_count'       => $count,
            'total_duration_min' => $totalDuration,
            'total_observations' => $totalObs,
            'total_species'      => $totalSp,
            'avg_quality_score'  => $count > 0 ? round($qualitySum / $count, 1) : 0,
            'first_survey_date'  => $firstDate ? substr($firstDate, 0, 10) : null,
            'protocols'          => $protocols,
        ];
    }

    /**
     * 天候ラベル定義（DwC互換英語キー + 日本語表示）
     *
     * @return array<string, array{emoji: string, label_ja: string, dwc_term: string}>
     */
    public static function getWeatherOptions(): array
    {
        return [
            'clear'  => ['emoji' => '☀️', 'label_ja' => '晴れ',   'dwc_term' => 'clear sky'],
            'cloudy' => ['emoji' => '⛅',  'label_ja' => '曇り',   'dwc_term' => 'cloudy'],
            'rain'   => ['emoji' => '🌧️', 'label_ja' => '雨',     'dwc_term' => 'rain'],
            'snow'   => ['emoji' => '🌨️', 'label_ja' => '雪',     'dwc_term' => 'snow'],
            'fog'    => ['emoji' => '🌫️', 'label_ja' => '霧',     'dwc_term' => 'fog'],
            'windy'  => ['emoji' => '🌪️', 'label_ja' => '強風',   'dwc_term' => 'strong wind'],
        ];
    }

    /**
     * 気温帯ラベル定義
     *
     * @return array<string, array{emoji: string, label_ja: string, range: string}>
     */
    public static function getTempRangeOptions(): array
    {
        return [
            'freezing' => ['emoji' => '🥶', 'label_ja' => '極寒',   'range' => '-5℃以下'],
            'cold'     => ['emoji' => '❄️', 'label_ja' => '寒い',   'range' => '0〜10℃'],
            'cool'     => ['emoji' => '🌤️', 'label_ja' => '涼しい', 'range' => '10〜20℃'],
            'warm'     => ['emoji' => '☀️', 'label_ja' => '暖かい', 'range' => '20〜30℃'],
            'hot'      => ['emoji' => '🔥', 'label_ja' => '暑い',   'range' => '30℃以上'],
        ];
    }

    /**
     * 天候キーから表示用ラベルを取得
     */
    public static function getWeatherLabel(string $key): string
    {
        $options = self::getWeatherOptions();
        if (isset($options[$key])) {
            return $options[$key]['emoji'] . ' ' . $options[$key]['label_ja'];
        }
        // Legacy: フリーテキスト天候はそのまま返す
        return $key;
    }

    /**
     * 気温帯キーから表示用ラベルを取得
     */
    public static function getTempRangeLabel(string $key): string
    {
        $options = self::getTempRangeOptions();
        if (isset($options[$key])) {
            return $options[$key]['emoji'] . ' ' . $options[$key]['label_ja'];
        }
        return $key;
    }
}
