<?php
declare(strict_types=1);

require_once __DIR__ . '/GoogleAuth.php';

/**
 * GA4Reporter — マルチサイト対応 GA4週次レポート生成クラス（HTML形式）
 */
class GA4Reporter
{
    private const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
    private const GA4_SCOPE    = 'https://www.googleapis.com/auth/analytics.readonly';

    /**
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

        try {
            $token = GoogleAuth::getAccessToken($site['credentials_path'], self::GA4_SCOPE);
        } catch (RuntimeException $e) {
            return ['success' => false, 'site' => $slug, 'report_file' => null, 'error' => '認証失敗: ' . $e->getMessage()];
        }

        $endDate       = date('Y-m-d');
        $startDate     = date('Y-m-d', strtotime('-7 days'));
        $prevEndDate   = date('Y-m-d', strtotime('-8 days'));
        $prevStartDate = date('Y-m-d', strtotime('-14 days'));

        $ga4Data    = self::fetchGA4Data($token, $site['property_id'], $startDate, $endDate, $prevStartDate, $prevEndDate);
        $geminiData = self::generateStructuredReport($site, $ga4Data, $startDate, $endDate);
        $html       = self::buildHtml($site, $ga4Data, $geminiData, $startDate, $endDate);
        $reportFile = self::saveReport($site, $html, $endDate);

        self::sendEmail($site, $html, $startDate, $endDate);

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
        $summary = self::callGA4($token, $propertyId, [
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
            'metrics'    => [['name' => 'sessions'], ['name' => 'newUsers']],
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
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Authorization: Bearer ' . $token],
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

    // ── Gemini 構造化レポート生成 ──────────────────────────────────────────────

    private static function generateStructuredReport(array $site, array $ga4Data, string $startDate, string $endDate): array
    {
        if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') {
            return self::fallbackReport();
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
あなたは「{$siteName}」のウェブ担当アシスタントです。
サービス概要: {$siteDescription}

以下はGoogle Analyticsから取得した今週のデータです：

{$dataContext}

このデータをもとに、ウェブやデータが苦手な人でも読める週次レポートを作成してください。

ルール：
- 専門用語を使わない（「セッション」→「訪問」、「PV」→「ページの閲覧回数」など）
- 数字には必ず意味の説明をつける（「46人が訪問しました」だけでなく「先週より6人多い46人が訪問しました」）
- 絵文字を積極的に使って親しみやすくする
- 短い文を使い、1文に1つの情報だけ入れる

必ず以下のJSON形式のみで出力してください（前後に余計なテキスト・コードブロック記号は一切不要）:
{
  "summary_headline": "今週を一言で表すポジティブなひとこと（絵文字含む、40字以内）",
  "summary_text": "今週全体の説明。数値を使いながら素人にもわかるように2〜3文で。",
  "trends": [
    {
      "emoji": "絵文字1文字",
      "title": "タイトル（20字以内）",
      "text": "わかりやすい説明（2文）"
    }
  ],
  "actions": [
    {
      "title": "やること（20字以内）",
      "text": "なぜやるべきか・どうやるかをわかりやすく（2〜3文）"
    }
  ],
  "checkpoint_metric": "来週注目する指標（専門用語なしで）",
  "checkpoint_reason": "なぜ注目するかをわかりやすく（2文）"
}

trendsは最大3件、actionsは最大2件。
PROMPT;

        $url  = 'https://generativelanguage.googleapis.com/v1beta/models/' . self::GEMINI_MODEL . ':generateContent?key=' . GEMINI_API_KEY;
        $body = [
            'contents'         => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
            'generationConfig' => ['maxOutputTokens' => 1500, 'temperature' => 0.4],
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
        $text     = $response['candidates'][0]['content']['parts'][0]['text'] ?? '';

        // コードブロック記号を除去してからパース
        $text    = preg_replace('/^```json\s*/m', '', $text);
        $text    = preg_replace('/^```\s*/m', '', $text);
        $parsed  = json_decode(trim($text), true);

        return is_array($parsed) ? $parsed : self::fallbackReport();
    }

    private static function fallbackReport(): array
    {
        return [
            'summary_headline' => 'レポートを生成できませんでした',
            'summary_text'     => 'Gemini APIへの接続に問題が発生しました。',
            'trends'           => [],
            'actions'          => [],
            'checkpoint_metric' => '-',
            'checkpoint_reason' => '-',
        ];
    }

    // ── HTML ビルド ────────────────────────────────────────────────────────────

    private static function buildHtml(array $site, array $ga4Data, array $gemini, string $startDate, string $endDate): string
    {
        $siteName  = htmlspecialchars($site['name']);
        $thisWeek  = $ga4Data['summary']['今週'] ?? [];
        $lastWeek  = $ga4Data['summary']['先週'] ?? [];
        $generatedAt = date('Y年n月j日 H:i');

        // KPIカード
        $kpis = [
            ['label' => '訪問者数',     'sublabel' => '（ユニークユーザー）', 'key' => 'activeUsers',     'suffix' => '人'],
            ['label' => '訪問回数',     'sublabel' => '（セッション）',       'key' => 'sessions',        'suffix' => '回'],
            ['label' => 'ページ閲覧数', 'sublabel' => '（ページビュー）',     'key' => 'screenPageViews', 'suffix' => '回'],
        ];
        $kpiHtml = '';
        foreach ($kpis as $k) {
            $curr    = (int)($thisWeek[$k['key']] ?? 0);
            $prev    = (int)($lastWeek[$k['key']] ?? 1);
            $diff    = $curr - $prev;
            $pct     = round($diff / max($prev, 1) * 100, 1);
            $arrow   = $diff > 0 ? '▲' : ($diff < 0 ? '▼' : '─');
            $clr     = $diff > 0 ? '#16a34a' : ($diff < 0 ? '#dc2626' : '#64748b');
            $sign    = $diff > 0 ? '+' : '';
            $kpiHtml .= <<<HTML
                <td style="width:33%;padding:0 8px;text-align:center;vertical-align:top;">
                  <div style="background:#f8fafc;border-radius:12px;padding:16px 8px;">
                    <div style="font-size:28px;font-weight:800;color:#1e293b;line-height:1;">{$curr}<span style="font-size:14px;font-weight:500;color:#64748b;">{$k['suffix']}</span></div>
                    <div style="font-size:13px;font-weight:600;color:#334155;margin-top:6px;">{$k['label']}</div>
                    <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">{$k['sublabel']}</div>
                    <div style="font-size:13px;font-weight:700;color:{$clr};">{$arrow} {$sign}{$pct}%</div>
                    <div style="font-size:11px;color:#94a3b8;">先週比</div>
                  </div>
                </td>
HTML;
        }

        // トレンドカード
        $trendsHtml = '';
        foreach ($gemini['trends'] ?? [] as $t) {
            $emoji = htmlspecialchars($t['emoji'] ?? '📌');
            $title = htmlspecialchars($t['title'] ?? '');
            $text  = nl2br(htmlspecialchars($t['text'] ?? ''));
            $trendsHtml .= <<<HTML
                <tr>
                  <td style="padding:0 0 12px 0;">
                    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
                      <div style="font-size:16px;font-weight:700;color:#1e293b;margin-bottom:6px;">{$emoji} {$title}</div>
                      <div style="font-size:14px;color:#475569;line-height:1.7;">{$text}</div>
                    </div>
                  </td>
                </tr>
HTML;
        }

        // アクションカード
        $actionsHtml = '';
        $actionColors = ['#2563eb', '#7c3aed'];
        foreach ($gemini['actions'] ?? [] as $i => $a) {
            $title = htmlspecialchars($a['title'] ?? '');
            $text  = nl2br(htmlspecialchars($a['text'] ?? ''));
            $clr   = $actionColors[$i % 2];
            $num   = $i + 1;
            $actionsHtml .= <<<HTML
                <tr>
                  <td style="padding:0 0 12px 0;">
                    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;border-left:4px solid {$clr};">
                      <div style="font-size:15px;font-weight:700;color:{$clr};margin-bottom:6px;">やること {$num}：{$title}</div>
                      <div style="font-size:14px;color:#475569;line-height:1.7;">{$text}</div>
                    </div>
                  </td>
                </tr>
HTML;
        }

        $summaryHeadline = htmlspecialchars($gemini['summary_headline'] ?? '');
        $summaryText     = nl2br(htmlspecialchars($gemini['summary_text'] ?? ''));
        $checkMetric     = htmlspecialchars($gemini['checkpoint_metric'] ?? '');
        $checkReason     = nl2br(htmlspecialchars($gemini['checkpoint_reason'] ?? ''));

        return <<<HTML
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{$siteName} 週次レポート</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Hiragino Sans','Meiryo',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

      <!-- ヘッダー -->
      <tr>
        <td style="background:linear-gradient(135deg,#1e40af,#3b82f6);border-radius:16px 16px 0 0;padding:32px 32px 24px;">
          <div style="font-size:12px;color:rgba(255,255,255,0.7);letter-spacing:1px;text-transform:uppercase;">Weekly Report</div>
          <div style="font-size:26px;font-weight:800;color:#fff;margin:6px 0 4px;">{$siteName}</div>
          <div style="font-size:13px;color:rgba(255,255,255,0.8);">📅 {$startDate} 〜 {$endDate}</div>
          <div style="margin-top:16px;background:rgba(255,255,255,0.15);border-radius:10px;padding:14px 18px;">
            <div style="font-size:18px;font-weight:700;color:#fff;">{$summaryHeadline}</div>
            <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:6px;line-height:1.6;">{$summaryText}</div>
          </div>
        </td>
      </tr>

      <!-- KPI カード -->
      <tr>
        <td style="background:#fff;padding:24px 24px 20px;">
          <div style="font-size:13px;font-weight:700;color:#64748b;letter-spacing:1px;margin-bottom:14px;">📊 今週の数字（先週との比較）</div>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>{$kpiHtml}</tr>
          </table>
        </td>
      </tr>

      <!-- 注目トレンド -->
      <tr>
        <td style="background:#fff;padding:0 24px 24px;">
          <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
            <div style="font-size:13px;font-weight:700;color:#64748b;letter-spacing:1px;margin-bottom:14px;">🔥 今週の注目ポイント</div>
            <table width="100%" cellpadding="0" cellspacing="0">{$trendsHtml}</table>
          </div>
        </td>
      </tr>

      <!-- アクション提案 -->
      <tr>
        <td style="background:#fff;padding:0 24px 24px;">
          <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
            <div style="font-size:13px;font-weight:700;color:#64748b;letter-spacing:1px;margin-bottom:14px;">💡 今週やってみること</div>
            <table width="100%" cellpadding="0" cellspacing="0">{$actionsHtml}</table>
          </div>
        </td>
      </tr>

      <!-- 来週のチェックポイント -->
      <tr>
        <td style="background:#fff;padding:0 24px 24px;border-radius:0 0 16px 16px;">
          <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
            <div style="font-size:13px;font-weight:700;color:#64748b;letter-spacing:1px;margin-bottom:14px;">✅ 来週チェックすること</div>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;">
              <div style="font-size:15px;font-weight:700;color:#15803d;margin-bottom:6px;">👀 {$checkMetric}</div>
              <div style="font-size:14px;color:#166534;line-height:1.7;">{$checkReason}</div>
            </div>
          </div>
        </td>
      </tr>

      <!-- フッター -->
      <tr>
        <td style="padding:16px 0;text-align:center;">
          <div style="font-size:11px;color:#94a3b8;">このレポートは自動生成されました　•　{$generatedAt}　•　Powered by GA4 + Gemini</div>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>
HTML;
    }

    // ── レポート保存 ──────────────────────────────────────────────────────────

    private static function saveReport(array $site, string $html, string $endDate): string
    {
        $reportDir = $site['report_dir']
            ?? (defined('DATA_DIR') ? DATA_DIR . '/reports/' . $site['slug'] : sys_get_temp_dir());

        if (!is_dir($reportDir)) {
            mkdir($reportDir, 0755, true);
        }

        $reportFile = rtrim($reportDir, '/') . '/ga4_weekly_' . $endDate . '.html';
        file_put_contents($reportFile, $html);
        return $reportFile;
    }

    // ── メール送信 ────────────────────────────────────────────────────────────

    private static function sendEmail(array $site, string $html, string $startDate, string $endDate): bool
    {
        if (empty($site['recipient_email'])) {
            return false;
        }

        $subject = "=?UTF-8?B?" . base64_encode("{$site['name']} 週次レポート {$endDate}") . "?=";
        $headers = implode("\r\n", [
            'From: report@ikimon.life',
            'MIME-Version: 1.0',
            'Content-Type: text/html; charset=UTF-8',
        ]);

        return mail($site['recipient_email'], $subject, $html, $headers);
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
