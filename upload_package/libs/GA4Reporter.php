<?php
declare(strict_types=1);

require_once __DIR__ . '/GoogleAuth.php';

/**
 * GA4Reporter — マルチサイト対応 GA4週次レポート生成クラス
 *
 * サイト設定スキーマ:
 * [
 *   'slug'             => 'ikimon',                    // サイト識別子 (ファイル名に使用)
 *   'name'             => 'ikimon.life',                // 表示名
 *   'description'      => '市民参加型生物多様性...',    // Geminiプロンプトに渡すサイト説明
 *   'property_id'      => '123456789',                  // GA4 プロパティID
 *   'credentials_path' => '/path/to/sa.json',           // サービスアカウントJSONパス
 *   'recipient_email'  => 'admin@example.com',          // レポート送信先
 *   'report_dir'       => '/path/to/reports/',          // レポート保存先 (省略可: DATA_DIR/reports/{slug}/)
 * ]
 */
class GA4Reporter
{
    private const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
    private const GA4_SCOPE    = 'https://www.googleapis.com/auth/analytics.readonly';

    /**
     * 1サイト分のレポートを生成・保存・送信する
     *
     * @return array{success: bool, site: string, report_file: string|null, error: string|null}
     */
    public static function run(array $site): array
    {
        $slug = $site['slug'] ?? 'unknown';

        try {
            self::validateConfig($site);
        } catch (InvalidArgumentException $e) {
            return ['success' => false, 'site' => $slug, 'report_file' => null, 'error' => $e->getMessage()];
        }

        // アクセストークン取得
        try {
            $token = GoogleAuth::getAccessToken($site['credentials_path'], self::GA4_SCOPE);
        } catch (RuntimeException $e) {
            return ['success' => false, 'site' => $slug, 'report_file' => null, 'error' => '認証失敗: ' . $e->getMessage()];
        }

        // 集計期間
        $endDate       = date('Y-m-d');
        $startDate     = date('Y-m-d', strtotime('-7 days'));
        $prevEndDate   = date('Y-m-d', strtotime('-8 days'));
        $prevStartDate = date('Y-m-d', strtotime('-14 days'));

        // GA4データ取得
        $ga4Data = self::fetchGA4Data($token, $site['property_id'], $startDate, $endDate, $prevStartDate, $prevEndDate);

        // Geminiレポート生成
        $reportText = self::generateReport($site, $ga4Data, $startDate, $endDate);

        // 保存
        $reportFile = self::saveReport($site, $reportText, $startDate, $endDate);

        // メール送信
        self::sendEmail($site, $reportText, $reportFile, $startDate, $endDate);

        return ['success' => true, 'site' => $slug, 'report_file' => $reportFile, 'error' => null];
    }

    // ── GA4データ取得 ──────────────────────────────────────────────────────────

    private static function fetchGA4Data(
        string $token,
        string $propertyId,
        string $startDate,
        string $endDate,
        string $prevStartDate,
        string $prevEndDate
    ): array {
        $summary  = self::callGA4($token, $propertyId, [
            'dateRanges' => [
                ['startDate' => $startDate,     'endDate' => $endDate,     'name' => '今週'],
                ['startDate' => $prevStartDate, 'endDate' => $prevEndDate, 'name' => '先週'],
            ],
            'metrics' => [
                ['name' => 'sessions'],
                ['name' => 'activeUsers'],
                ['name' => 'newUsers'],
                ['name' => 'screenPageViews'],
                ['name' => 'engagedSessions'],
                ['name' => 'averageSessionDuration'],
            ],
        ]);

        $topPages = self::callGA4($token, $propertyId, [
            'dateRanges' => [['startDate' => $startDate, 'endDate' => $endDate]],
            'dimensions' => [['name' => 'pagePath']],
            'metrics'    => [
                ['name' => 'screenPageViews'],
                ['name' => 'activeUsers'],
                ['name' => 'averageSessionDuration'],
            ],
            'limit'    => 10,
            'orderBys' => [['metric' => ['metricName' => 'screenPageViews'], 'desc' => true]],
        ]);

        $channels = self::callGA4($token, $propertyId, [
            'dateRanges' => [['startDate' => $startDate, 'endDate' => $endDate]],
            'dimensions' => [['name' => 'sessionDefaultChannelGrouping']],
            'metrics'    => [
                ['name' => 'sessions'],
                ['name' => 'newUsers'],
            ],
            'limit'    => 8,
            'orderBys' => [['metric' => ['metricName' => 'sessions'], 'desc' => true]],
        ]);

        return [
            'summary'   => self::extractSummary($summary),
            'top_pages' => self::extractDimensionRows($topPages),
            'channels'  => self::extractDimensionRows($channels),
        ];
    }

    private static function callGA4(string $token, string $propertyId, array $body): array
    {
        $url = "https://analyticsdata.googleapis.com/v1beta/properties/{$propertyId}:runReport";
        $ch  = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $token,
            ],
            CURLOPT_POSTFIELDS     => json_encode($body),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
        ]);
        $raw     = curl_exec($ch);
        $curlErr = curl_error($ch);
        curl_close($ch);

        if ($curlErr) {
            fwrite(STDERR, "[WARN] GA4 curl error: {$curlErr}\n");
            return [];
        }
        return json_decode($raw, true) ?? [];
    }

    // ── Geminiレポート生成 ────────────────────────────────────────────────────

    private static function generateReport(array $site, array $ga4Data, string $startDate, string $endDate): string
    {
        if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') {
            return '[ERROR] GEMINI_API_KEY が未設定です';
        }

        $dataContext = json_encode([
            '集計期間'       => "{$startDate} 〜 {$endDate}",
            '今週サマリー'   => $ga4Data['summary']['今週'] ?? [],
            '先週サマリー'   => $ga4Data['summary']['先週'] ?? [],
            'トップ10ページ' => $ga4Data['top_pages'],
            '流入チャネル'   => $ga4Data['channels'],
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        $siteName        = $site['name'];
        $siteDescription = $site['description'] ?? $site['name'];

        $prompt = <<<PROMPT
あなたは「{$siteName}」の成長アナリストです。
サービス概要: {$siteDescription}

以下はGoogle Analytics 4から取得した直近7日間のアクセスデータです：

{$dataContext}

このデータを元に、以下の構成で週次レポートを日本語で作成してください。

## 📊 今週のサマリー
- ユーザー数・セッション数・PV を前週比で（%増減を明示）
- 1〜2文で今週の全体感を述べる

## 🔥 注目トレンド
- トップページ・流入元の中で特筆すべき動向を2〜3点
- {$siteName}のサービス特性の視点で解釈する

## 💡 今週のアクション提案
- データから読み取れる改善・施策アクションを1〜2個（具体的かつ実行可能に）

## ✅ 来週のチェックポイント
- 来週特に注目すべき指標を1つ、その理由とともに

---
注意: 数値は正確に引用する。推測や誇張をしない。親しみやすいが専門的なトーンで。
PROMPT;

        $url  = 'https://generativelanguage.googleapis.com/v1beta/models/' . self::GEMINI_MODEL . ':generateContent?key=' . GEMINI_API_KEY;
        $body = [
            'contents'         => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
            'generationConfig' => ['maxOutputTokens' => 1200, 'temperature' => 0.4],
        ];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode($body),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
        ]);
        $raw = curl_exec($ch);
        curl_close($ch);

        $response = json_decode($raw, true);
        return $response['candidates'][0]['content']['parts'][0]['text']
            ?? "[ERROR] Geminiレスポンス取得失敗: {$raw}";
    }

    // ── レポート保存 ──────────────────────────────────────────────────────────

    private static function saveReport(array $site, string $reportText, string $startDate, string $endDate): string
    {
        $reportDir = $site['report_dir']
            ?? (defined('DATA_DIR') ? DATA_DIR . '/reports/' . $site['slug'] : sys_get_temp_dir());

        if (!is_dir($reportDir)) {
            mkdir($reportDir, 0755, true);
        }

        $reportFile    = rtrim($reportDir, '/') . '/ga4_weekly_' . $endDate . '.md';
        $reportContent = "# {$site['name']} GA4週次レポート\n\n"
            . "**集計期間**: {$startDate} 〜 {$endDate}  \n"
            . "**生成日時**: " . date('Y-m-d H:i:s') . "\n\n"
            . "---\n\n"
            . $reportText;

        file_put_contents($reportFile, $reportContent);
        return $reportFile;
    }

    // ── メール送信 ────────────────────────────────────────────────────────────

    private static function sendEmail(array $site, string $reportText, string $reportFile, string $startDate, string $endDate): bool
    {
        if (empty($site['recipient_email'])) {
            return false;
        }

        $subject  = "=?UTF-8?B?" . base64_encode("{$site['name']} 週次レポート {$endDate}") . "?=";
        $mailBody = "{$site['name']} 週次レポート\n"
            . "集計期間: {$startDate} 〜 {$endDate}\n"
            . "生成日時: " . date('Y-m-d H:i:s') . "\n\n"
            . str_repeat('─', 40) . "\n\n"
            . $reportText
            . "\n\n" . str_repeat('─', 40) . "\n"
            . "このメールは自動生成されました。\n"
            . "レポートアーカイブ: {$reportFile}\n";

        $headers = implode("\r\n", [
            'From: report@ikimon.life',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: base64',
        ]);
        $encoded = chunk_split(base64_encode($mailBody));

        return mail($site['recipient_email'], $subject, $encoded, $headers);
    }

    // ── バリデーション ────────────────────────────────────────────────────────

    private static function validateConfig(array $site): void
    {
        foreach (['slug', 'name', 'property_id', 'credentials_path', 'recipient_email'] as $key) {
            if (empty($site[$key])) {
                throw new InvalidArgumentException("サイト設定に '{$key}' が未設定です");
            }
        }
        if (!file_exists($site['credentials_path'])) {
            throw new InvalidArgumentException("credentials_path が見つかりません: {$site['credentials_path']}");
        }
    }

    // ── ユーティリティ ────────────────────────────────────────────────────────

    private static function extractSummary(array $data): array
    {
        $result      = [];
        $metricNames = array_column($data['metricHeaders'] ?? [], 'name');
        foreach ($data['rows'] ?? [] as $row) {
            $range = $row['dimensionValues'][0]['value'] ?? 'range';
            foreach ($row['metricValues'] as $i => $val) {
                $result[$range][$metricNames[$i]] = $val['value'];
            }
        }
        return $result;
    }

    private static function extractDimensionRows(array $data): array
    {
        $dimNames    = array_column($data['dimensionHeaders'] ?? [], 'name');
        $metricNames = array_column($data['metricHeaders'] ?? [], 'name');
        $rows        = [];
        foreach ($data['rows'] ?? [] as $row) {
            $entry = [];
            foreach ($row['dimensionValues'] as $i => $val) {
                $entry[$dimNames[$i]] = $val['value'];
            }
            foreach ($row['metricValues'] as $i => $val) {
                $entry[$metricNames[$i]] = $val['value'];
            }
            $rows[] = $entry;
        }
        return $rows;
    }
}
