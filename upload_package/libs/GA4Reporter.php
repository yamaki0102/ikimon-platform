<?php
declare(strict_types=1);

require_once __DIR__ . '/GoogleAuth.php';

/**
 * GA4Reporter — マルチサイト対応 GA4週次レポート生成クラス（Deep Analysis版）
 */
class GA4Reporter
{
    private const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
    private const GA4_SCOPE    = 'https://www.googleapis.com/auth/analytics.readonly';

    /** @return array{success: bool, site: string, report_file: string|null, error: string|null} */
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

    // ── GA4データ取得（7クエリ） ───────────────────────────────────────────────

    private static function fetchGA4Data(
        string $token, string $propertyId,
        string $startDate, string $endDate,
        string $prevStartDate, string $prevEndDate
    ): array {
        // 1) 今週 vs 先週 サマリー
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
                ['name' => 'bounceRate'],
            ],
        ]);

        // 2) トップページ Top10
        $topPages = self::callGA4($token, $propertyId, [
            'dateRanges' => [['startDate' => $startDate, 'endDate' => $endDate]],
            'dimensions' => [['name' => 'pagePath']],
            'metrics'    => [
                ['name' => 'screenPageViews'],
                ['name' => 'activeUsers'],
                ['name' => 'averageSessionDuration'],
                ['name' => 'bounceRate'],
            ],
            'limit'    => 10,
            'orderBys' => [['metric' => ['metricName' => 'screenPageViews'], 'desc' => true]],
        ]);

        // 3) 流入チャネル
        $channels = self::callGA4($token, $propertyId, [
            'dateRanges' => [['startDate' => $startDate, 'endDate' => $endDate]],
            'dimensions' => [['name' => 'sessionDefaultChannelGrouping']],
            'metrics'    => [['name' => 'sessions'], ['name' => 'newUsers'], ['name' => 'engagedSessions']],
            'limit'    => 8,
            'orderBys' => [['metric' => ['metricName' => 'sessions'], 'desc' => true]],
        ]);

        // 4) デバイス別
        $devices = self::callGA4($token, $propertyId, [
            'dateRanges' => [['startDate' => $startDate, 'endDate' => $endDate]],
            'dimensions' => [['name' => 'deviceCategory']],
            'metrics'    => [
                ['name' => 'sessions'],
                ['name' => 'activeUsers'],
                ['name' => 'bounceRate'],
                ['name' => 'averageSessionDuration'],
            ],
            'limit' => 3,
        ]);

        // 5) 新規 vs リピーター
        $userTypes = self::callGA4($token, $propertyId, [
            'dateRanges' => [['startDate' => $startDate, 'endDate' => $endDate]],
            'dimensions' => [['name' => 'newVsReturning']],
            'metrics'    => [
                ['name' => 'sessions'],
                ['name' => 'averageSessionDuration'],
                ['name' => 'screenPageViews'],
                ['name' => 'engagedSessions'],
            ],
            'limit' => 2,
        ]);

        // 6) ランディングページ（最初に訪れたページ）Top5
        $landingPages = self::callGA4($token, $propertyId, [
            'dateRanges' => [['startDate' => $startDate, 'endDate' => $endDate]],
            'dimensions' => [['name' => 'sessionDefaultLandingPage']],
            'metrics'    => [
                ['name' => 'sessions'],
                ['name' => 'bounceRate'],
                ['name' => 'averageSessionDuration'],
            ],
            'limit'    => 5,
            'orderBys' => [['metric' => ['metricName' => 'sessions'], 'desc' => true]],
        ]);

        // 7) 地域別 Top5
        $regions = self::callGA4($token, $propertyId, [
            'dateRanges' => [['startDate' => $startDate, 'endDate' => $endDate]],
            'dimensions' => [['name' => 'region']],
            'metrics'    => [['name' => 'sessions'], ['name' => 'activeUsers']],
            'limit'    => 5,
            'orderBys' => [['metric' => ['metricName' => 'sessions'], 'desc' => true]],
        ]);

        return [
            'summary'       => self::extractSummary($summary),
            'top_pages'     => self::extractDimensionRows($topPages),
            'channels'      => self::extractDimensionRows($channels),
            'devices'       => self::extractDimensionRows($devices),
            'user_types'    => self::extractDimensionRows($userTypes),
            'landing_pages' => self::extractDimensionRows($landingPages),
            'regions'       => self::extractDimensionRows($regions),
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
        if ($curlErr) { fwrite(STDERR, "[WARN] GA4 curl error: {$curlErr}\n"); return []; }
        return json_decode($raw, true) ?? [];
    }

    // ── Gemini 深掘り分析 ────────────────────────────────────────────────────

    private static function generateStructuredReport(array $site, array $ga4Data, string $startDate, string $endDate): array
    {
        if (!defined('GEMINI_API_KEY') || GEMINI_API_KEY === '') {
            return self::fallbackReport();
        }

        $ctx = json_encode([
            '集計期間'           => "{$startDate} 〜 {$endDate}",
            '今週サマリー'       => $ga4Data['summary']['今週'] ?? [],
            '先週サマリー'       => $ga4Data['summary']['先週'] ?? [],
            'トップページ'       => $ga4Data['top_pages'],
            '流入チャネル'       => $ga4Data['channels'],
            'デバイス別'         => $ga4Data['devices'],
            '新規_vs_リピーター' => $ga4Data['user_types'],
            'ランディングページ' => $ga4Data['landing_pages'],
            '地域別'             => $ga4Data['regions'],
        ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);

        $siteName        = $site['name'];
        $siteDescription = $site['description'] ?? $site['name'];

        $prompt = <<<PROMPT
あなたは「{$siteName}」のウェブ解析コンサルタントです。
サービス概要: {$siteDescription}

以下はGoogle Analytics 4から取得した今週（7日間）のデータです。

{$ctx}

このデータをもとに、経営者・担当者向けの深い分析レポートを作成してください。

【レポート方針】
- 専門用語には必ずカッコで説明を添える（例：直帰率（ページを1ページだけ見て離脱した割合））
- 数字は必ず「意味」とセットで伝える（数字の羅列ではなく、なぜその数字が重要かを説明する）
- 「データが示していること」と「ビジネスへの示唆」を必ず分けて述べる
- 仮説ベースの思考を入れる（「〜と考えられます」「〜の可能性があります」など）
- アクションは「誰が・何を・なぜ」が明確に伝わるように書く
- トーン：プロフェッショナルだが親しみやすい。難しい言葉を使わずに深い内容を伝える

【healthスコアの採点基準】
以下の要素を総合的に評価して0〜100点をつける：
- 前週比のトラフィック成長（プラス成長 +10点）
- エンゲージメント率（engagedSessions/sessions × 100：60%以上 +20点、40-60% +10点）
- 直帰率（30%以下 +20点、30-50% +10点）
- 新規ユーザー獲得（新規率60%以上 +15点）
- セッション継続時間（2分以上 +15点、1分以上 +8点）
- 複数チャネルからの流入（3チャネル以上 +20点）

必ず以下のJSON形式のみで出力してください（コードブロック記号不要）:
{
  "health_score": 数値（0〜100）,
  "health_label": "絶好調|好調|成長中|要改善",
  "health_comment": "スコアの根拠を1文で（専門用語に説明つき）",
  "summary_headline": "今週を象徴するひとこと（絵文字含む・40字以内）",
  "summary_text": "今週全体の状況を2〜3文で。数値と意味をセットで伝える。",
  "insights": [
    {
      "emoji": "絵文字1文字",
      "title": "発見タイトル（25字以内）",
      "finding": "データが示していること（1〜2文・数値引用）",
      "implication": "ビジネスへの示唆・意味（1〜2文）",
      "urgency": "high|medium|low"
    }
  ],
  "device_comment": "デバイス分布から読み取れること（2文・モバイル比率に触れる）",
  "audience_comment": "新規/リピーター比率が示す状況と、どちらを伸ばすべきかの考察（2文）",
  "landing_comment": "入口ページ（ランディングページ）の状況から読み取れる第一印象の課題や強み（2文）",
  "actions": [
    {
      "priority": "🔴 最優先|🟡 今週中|🟢 余裕があれば",
      "title": "アクションタイトル（25字以内）",
      "why": "なぜやるべきか（データ根拠つきで1〜2文）",
      "how": "具体的な実施方法（2〜3文）"
    }
  ],
  "checkpoint_metric": "来週注目すべき指標（専門用語には説明つき）",
  "checkpoint_reason": "なぜその指標を来週見るべきかの理由（2文）"
}

insightsは3〜4件、actionsは2〜3件。重複なく、それぞれ異なる観点で。
PROMPT;

        $url  = 'https://generativelanguage.googleapis.com/v1beta/models/' . self::GEMINI_MODEL . ':generateContent?key=' . GEMINI_API_KEY;
        $body = [
            'contents'         => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
            'generationConfig' => ['maxOutputTokens' => 2000, 'temperature' => 0.3],
        ];

        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS     => json_encode($body),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 45,
        ]);
        $raw = curl_exec($ch);
        curl_close($ch);

        $response = json_decode($raw, true);
        $text     = $response['candidates'][0]['content']['parts'][0]['text'] ?? '';
        $text     = preg_replace('/^```json\s*/m', '', $text);
        $text     = preg_replace('/^```\s*/m', '', $text);
        $parsed   = json_decode(trim($text), true);

        return is_array($parsed) ? $parsed : self::fallbackReport();
    }

    private static function fallbackReport(): array
    {
        return [
            'health_score' => 0, 'health_label' => '取得失敗',
            'health_comment' => 'Gemini APIへの接続に問題が発生しました。',
            'summary_headline' => 'レポート生成エラー', 'summary_text' => '',
            'insights' => [], 'device_comment' => '', 'audience_comment' => '',
            'landing_comment' => '', 'actions' => [],
            'checkpoint_metric' => '-', 'checkpoint_reason' => '-',
        ];
    }

    // ── HTML ビルド ────────────────────────────────────────────────────────────

    private static function buildHtml(array $site, array $ga4Data, array $g, string $startDate, string $endDate): string
    {
        $siteName    = htmlspecialchars($site['name']);
        $thisWeek    = $ga4Data['summary']['今週'] ?? [];
        $lastWeek    = $ga4Data['summary']['先週'] ?? [];
        $generatedAt = date('Y年n月j日 H:i');

        // ── ヘルススコア ──
        $score      = (int)($g['health_score'] ?? 0);
        $label      = htmlspecialchars($g['health_label'] ?? '');
        $scoreColor = $score >= 90 ? '#d97706' : ($score >= 70 ? '#16a34a' : ($score >= 40 ? '#2563eb' : '#dc2626'));
        $scoreBg    = $score >= 90 ? '#fffbeb' : ($score >= 70 ? '#f0fdf4' : ($score >= 40 ? '#eff6ff' : '#fef2f2'));
        $healthComment = nl2br(htmlspecialchars($g['health_comment'] ?? ''));

        // ── KPI ──
        $kpis = [
            ['label' => '訪問者数',     'sub' => 'ユニークユーザー', 'key' => 'activeUsers',     'unit' => '人'],
            ['label' => '訪問回数',     'sub' => 'セッション',       'key' => 'sessions',        'unit' => '回'],
            ['label' => 'ページ閲覧数', 'sub' => 'ページビュー',     'key' => 'screenPageViews', 'unit' => '回'],
        ];
        $kpiHtml = '';
        foreach ($kpis as $k) {
            $curr  = (int)($thisWeek[$k['key']] ?? 0);
            $prev  = (int)($lastWeek[$k['key']] ?? 1);
            $diff  = $curr - $prev;
            $pct   = round($diff / max($prev, 1) * 100, 1);
            $arrow = $diff > 0 ? '▲' : ($diff < 0 ? '▼' : '─');
            $clr   = $diff > 0 ? '#16a34a' : ($diff < 0 ? '#dc2626' : '#64748b');
            $sign  = $diff > 0 ? '+' : '';
            $kpiHtml .= <<<HTML
<td style="width:33%;padding:0 6px;vertical-align:top;">
  <div style="background:#f8fafc;border-radius:10px;padding:16px 8px;text-align:center;">
    <div style="font-size:26px;font-weight:800;color:#1e293b;line-height:1.1;">{$curr}<span style="font-size:13px;color:#64748b;font-weight:500;">{$k['unit']}</span></div>
    <div style="font-size:13px;font-weight:700;color:#334155;margin-top:5px;">{$k['label']}</div>
    <div style="font-size:11px;color:#94a3b8;margin-bottom:6px;">{$k['sub']}</div>
    <div style="font-size:13px;font-weight:700;color:{$clr};">{$arrow} {$sign}{$pct}%</div>
    <div style="font-size:10px;color:#cbd5e1;">先週比</div>
  </div>
</td>
HTML;
        }

        // ── 追加KPI（直帰率・平均滞在時間） ──
        $bounceRate = round((float)($thisWeek['bounceRate'] ?? 0) * 100, 1);
        $prevBounce = round((float)($lastWeek['bounceRate'] ?? 0) * 100, 1);
        $bounceDiff = round($bounceRate - $prevBounce, 1);
        // 直帰率は下がると良い（色を逆にする）
        $bounceClr  = $bounceDiff < 0 ? '#16a34a' : ($bounceDiff > 0 ? '#dc2626' : '#64748b');
        $bounceArrow = $bounceDiff < 0 ? '▼' : ($bounceDiff > 0 ? '▲' : '─');

        $avgDur     = (int)($thisWeek['averageSessionDuration'] ?? 0);
        $avgMin     = floor($avgDur / 60);
        $avgSec     = $avgDur % 60;
        $prevDur    = (int)($lastWeek['averageSessionDuration'] ?? 1);
        $durDiff    = $avgDur - $prevDur;
        $durClr     = $durDiff > 0 ? '#16a34a' : ($durDiff < 0 ? '#dc2626' : '#64748b');
        $durArrow   = $durDiff > 0 ? '▲' : ($durDiff < 0 ? '▼' : '─');
        $durSign    = $durDiff > 0 ? '+' : '';

        $engRate    = $thisWeek['sessions'] > 0
            ? round((int)($thisWeek['engagedSessions'] ?? 0) / max((int)$thisWeek['sessions'], 1) * 100, 1)
            : 0;

        // ── デバイス ──
        $deviceEmoji = ['mobile' => '📱', 'desktop' => '💻', 'tablet' => '📟'];
        $deviceLabel = ['mobile' => 'スマホ', 'desktop' => 'PC', 'tablet' => 'タブレット'];
        $totalDevSessions = array_sum(array_column($ga4Data['devices'], 'sessions'));
        $deviceHtml = '';
        foreach ($ga4Data['devices'] as $d) {
            $cat   = strtolower($d['deviceCategory'] ?? '');
            $emoji = $deviceEmoji[$cat] ?? '🖥';
            $lbl   = $deviceLabel[$cat] ?? $cat;
            $sess  = (int)($d['sessions'] ?? 0);
            $pct   = $totalDevSessions > 0 ? round($sess / $totalDevSessions * 100) : 0;
            $dur   = (int)($d['averageSessionDuration'] ?? 0);
            $durStr = floor($dur / 60) . '分' . ($dur % 60) . '秒';
            $barW  = max(4, $pct);
            $deviceHtml .= <<<HTML
<tr>
  <td style="padding:6px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:70px;font-size:13px;font-weight:600;color:#334155;">{$emoji} {$lbl}</td>
        <td>
          <div style="background:#e2e8f0;border-radius:4px;height:10px;overflow:hidden;">
            <div style="background:#3b82f6;width:{$barW}%;height:10px;border-radius:4px;"></div>
          </div>
        </td>
        <td style="width:50px;text-align:right;font-size:13px;font-weight:700;color:#1e293b;">{$pct}%</td>
        <td style="width:80px;text-align:right;font-size:11px;color:#64748b;">{$sess}回訪問</td>
      </tr>
      <tr>
        <td colspan="4" style="font-size:11px;color:#94a3b8;padding:0 0 2px 22px;">平均滞在 {$durStr}</td>
      </tr>
    </table>
  </td>
</tr>
HTML;
        }
        $deviceComment = nl2br(htmlspecialchars($g['device_comment'] ?? ''));

        // ── 新規 vs リピーター ──
        $userTypeHtml = '';
        $totalUtSessions = array_sum(array_column($ga4Data['user_types'], 'sessions'));
        $utLabel = ['new' => '🆕 新規訪問者', 'returning' => '🔄 リピーター'];
        $utColor = ['new' => '#3b82f6', 'returning' => '#8b5cf6'];
        foreach ($ga4Data['user_types'] as $u) {
            $type   = strtolower($u['newVsReturning'] ?? 'new');
            $lbl    = $utLabel[$type] ?? $type;
            $clr    = $utColor[$type] ?? '#64748b';
            $sess   = (int)($u['sessions'] ?? 0);
            $pct    = $totalUtSessions > 0 ? round($sess / $totalUtSessions * 100) : 0;
            $dur    = (int)($u['averageSessionDuration'] ?? 0);
            $pv     = round((float)($u['screenPageViews'] ?? 0), 1);
            $durStr = floor($dur / 60) . '分' . ($dur % 60) . '秒';
            $barW   = max(4, $pct);
            $userTypeHtml .= <<<HTML
<tr>
  <td style="padding:6px 0;">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="width:140px;font-size:13px;font-weight:600;color:{$clr};">{$lbl}</td>
        <td>
          <div style="background:#e2e8f0;border-radius:4px;height:10px;">
            <div style="background:{$clr};width:{$barW}%;height:10px;border-radius:4px;"></div>
          </div>
        </td>
        <td style="width:40px;text-align:right;font-size:13px;font-weight:700;color:#1e293b;">{$pct}%</td>
      </tr>
      <tr>
        <td colspan="3" style="font-size:11px;color:#94a3b8;padding:2px 0 2px 4px;">
          {$sess}回訪問　／　平均滞在 {$durStr}　／　平均{$pv}ページ閲覧
        </td>
      </tr>
    </table>
  </td>
</tr>
HTML;
        }
        $audienceComment = nl2br(htmlspecialchars($g['audience_comment'] ?? ''));

        // ── ランディングページ ──
        $landingHtml = '';
        foreach ($ga4Data['landing_pages'] as $lp) {
            $path    = htmlspecialchars($lp['sessionDefaultLandingPage'] ?? '/');
            $sess    = (int)($lp['sessions'] ?? 0);
            $bounce  = round((float)($lp['bounceRate'] ?? 0) * 100, 1);
            $dur     = (int)($lp['averageSessionDuration'] ?? 0);
            $durStr  = floor($dur / 60) . '分' . ($dur % 60) . '秒';
            $bounceClrLp = $bounce < 30 ? '#16a34a' : ($bounce > 60 ? '#dc2626' : '#d97706');
            // パスが長い場合は短縮
            $displayPath = mb_strlen($path) > 35 ? mb_substr($path, 0, 33) . '…' : $path;
            $landingHtml .= <<<HTML
<tr style="border-bottom:1px solid #f1f5f9;">
  <td style="padding:8px 4px;font-size:12px;color:#334155;font-family:monospace;">{$displayPath}</td>
  <td style="padding:8px 8px;font-size:12px;text-align:right;color:#1e293b;font-weight:600;">{$sess}回</td>
  <td style="padding:8px 8px;font-size:12px;text-align:right;font-weight:600;color:{$bounceClrLp};">{$bounce}%</td>
  <td style="padding:8px 4px;font-size:12px;text-align:right;color:#64748b;">{$durStr}</td>
</tr>
HTML;
        }
        $landingComment = nl2br(htmlspecialchars($g['landing_comment'] ?? ''));

        // ── 地域 ──
        $regionHtml = '';
        $totalRegSessions = array_sum(array_column($ga4Data['regions'], 'sessions'));
        foreach ($ga4Data['regions'] as $r) {
            $region = htmlspecialchars($r['region'] ?? '不明');
            $sess   = (int)($r['sessions'] ?? 0);
            $pct    = $totalRegSessions > 0 ? round($sess / $totalRegSessions * 100) : 0;
            $barW   = max(2, $pct);
            $regionHtml .= <<<HTML
<tr>
  <td style="padding:4px 0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="width:80px;font-size:12px;color:#334155;">{$region}</td>
      <td><div style="background:#e2e8f0;border-radius:3px;height:8px;"><div style="background:#06b6d4;width:{$barW}%;height:8px;border-radius:3px;"></div></div></td>
      <td style="width:30px;text-align:right;font-size:12px;font-weight:600;color:#1e293b;">{$pct}%</td>
      <td style="width:40px;text-align:right;font-size:11px;color:#94a3b8;">{$sess}回</td>
    </tr></table>
  </td>
</tr>
HTML;
        }

        // ── インサイト ──
        $insightsHtml = '';
        $urgencyBorder = ['high' => '#ef4444', 'medium' => '#f59e0b', 'low' => '#94a3b8'];
        foreach ($g['insights'] ?? [] as $ins) {
            $emoji  = htmlspecialchars($ins['emoji'] ?? '💡');
            $title  = htmlspecialchars($ins['title'] ?? '');
            $finding = nl2br(htmlspecialchars($ins['finding'] ?? ''));
            $impl   = nl2br(htmlspecialchars($ins['implication'] ?? ''));
            $urg    = $ins['urgency'] ?? 'medium';
            $bclr   = $urgencyBorder[$urg] ?? '#94a3b8';
            $insightsHtml .= <<<HTML
<tr><td style="padding:0 0 12px 0;">
  <div style="background:#fff;border:1px solid #e2e8f0;border-left:4px solid {$bclr};border-radius:0 10px 10px 0;padding:14px 18px;">
    <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:8px;">{$emoji} {$title}</div>
    <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;">データが示していること</div>
    <div style="font-size:13px;color:#475569;line-height:1.7;margin-bottom:10px;">{$finding}</div>
    <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:3px;text-transform:uppercase;letter-spacing:0.5px;">ビジネスへの意味</div>
    <div style="font-size:13px;color:#1e40af;line-height:1.7;background:#eff6ff;border-radius:6px;padding:8px 10px;">{$impl}</div>
  </div>
</td></tr>
HTML;
        }

        // ── アクション ──
        $actionsHtml = '';
        $priorityBg = ['🔴 最優先' => '#fef2f2', '🟡 今週中' => '#fffbeb', '🟢 余裕があれば' => '#f0fdf4'];
        foreach ($g['actions'] ?? [] as $a) {
            $pri   = $a['priority'] ?? '🟡 今週中';
            $title = htmlspecialchars($a['title'] ?? '');
            $why   = nl2br(htmlspecialchars($a['why'] ?? ''));
            $how   = nl2br(htmlspecialchars($a['how'] ?? ''));
            $bg    = $priorityBg[$pri] ?? '#f8fafc';
            $actionsHtml .= <<<HTML
<tr><td style="padding:0 0 12px 0;">
  <div style="background:{$bg};border:1px solid #e2e8f0;border-radius:10px;padding:16px 20px;">
    <div style="font-size:11px;font-weight:700;color:#64748b;margin-bottom:4px;">{$pri}</div>
    <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:10px;">{$title}</div>
    <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:3px;">なぜやるべきか</div>
    <div style="font-size:13px;color:#475569;line-height:1.7;margin-bottom:8px;">{$why}</div>
    <div style="font-size:12px;font-weight:700;color:#64748b;margin-bottom:3px;">どうやるか</div>
    <div style="font-size:13px;color:#475569;line-height:1.7;">{$how}</div>
  </div>
</td></tr>
HTML;
        }

        $summaryHeadline = htmlspecialchars($g['summary_headline'] ?? '');
        $summaryText     = nl2br(htmlspecialchars($g['summary_text'] ?? ''));
        $checkMetric     = htmlspecialchars($g['checkpoint_metric'] ?? '');
        $checkReason     = nl2br(htmlspecialchars($g['checkpoint_reason'] ?? ''));

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
<table width="620" cellpadding="0" cellspacing="0" style="max-width:620px;width:100%;">

  <!-- ヘッダー -->
  <tr><td style="background:linear-gradient(135deg,#1e3a5f,#2563eb);border-radius:16px 16px 0 0;padding:32px 32px 28px;">
    <div style="font-size:11px;color:rgba(255,255,255,0.6);letter-spacing:2px;">WEEKLY ANALYTICS REPORT</div>
    <div style="font-size:28px;font-weight:800;color:#fff;margin:8px 0 4px;">{$siteName}</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.75);">📅 {$startDate} 〜 {$endDate}</div>
    <div style="margin-top:18px;background:rgba(255,255,255,0.12);border-radius:10px;padding:16px 20px;">
      <div style="font-size:19px;font-weight:700;color:#fff;line-height:1.4;">{$summaryHeadline}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:8px;line-height:1.7;">{$summaryText}</div>
    </div>
  </td></tr>

  <!-- ヘルススコア -->
  <tr><td style="background:#fff;padding:24px 28px 0;">
    <div style="background:{$scoreBg};border-radius:12px;padding:16px 20px;display:table;width:100%;box-sizing:border-box;">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;">
          <div style="font-size:12px;font-weight:700;color:#64748b;letter-spacing:1px;">サイト健康スコア</div>
          <div style="font-size:13px;color:#475569;margin-top:4px;line-height:1.6;">{$healthComment}</div>
        </td>
        <td style="width:90px;text-align:right;vertical-align:middle;">
          <div style="font-size:42px;font-weight:900;color:{$scoreColor};line-height:1;">{$score}</div>
          <div style="font-size:13px;font-weight:700;color:{$scoreColor};">{$label}</div>
        </td>
      </tr></table>
    </div>
  </td></tr>

  <!-- KPI カード -->
  <tr><td style="background:#fff;padding:20px 28px 0;">
    <div style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:12px;">📊 主要指標（対前週比）</div>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>{$kpiHtml}</tr></table>
  </td></tr>

  <!-- 補助KPI -->
  <tr><td style="background:#fff;padding:16px 28px 0;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="width:50%;padding-right:6px;">
        <div style="background:#f8fafc;border-radius:10px;padding:12px 16px;">
          <div style="font-size:11px;color:#94a3b8;">直帰率（1ページで離脱した割合）</div>
          <div style="font-size:22px;font-weight:800;color:#1e293b;margin:4px 0;">{$bounceRate}<span style="font-size:13px;color:#64748b;">%</span></div>
          <div style="font-size:12px;color:{$bounceClr};">{$bounceArrow} 先週比 {$bounceDiff}%pt</div>
        </div>
      </td>
      <td style="width:50%;padding-left:6px;">
        <div style="background:#f8fafc;border-radius:10px;padding:12px 16px;">
          <div style="font-size:11px;color:#94a3b8;">平均滞在時間</div>
          <div style="font-size:22px;font-weight:800;color:#1e293b;margin:4px 0;">{$avgMin}<span style="font-size:13px;color:#64748b;">分</span>{$avgSec}<span style="font-size:13px;color:#64748b;">秒</span></div>
          <div style="font-size:12px;color:{$durClr};">{$durArrow} {$durSign}{$durDiff}秒　エンゲージ率 {$engRate}%</div>
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- デバイス別 -->
  <tr><td style="background:#fff;padding:20px 28px 0;">
    <div style="border-top:1px solid #f1f5f9;padding-top:18px;">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:12px;">📱 デバイス別アクセス</div>
      <table width="100%" cellpadding="0" cellspacing="0">{$deviceHtml}</table>
      <div style="font-size:13px;color:#475569;line-height:1.7;margin-top:8px;padding:10px 14px;background:#f8fafc;border-radius:8px;">{$deviceComment}</div>
    </div>
  </td></tr>

  <!-- 新規 vs リピーター -->
  <tr><td style="background:#fff;padding:20px 28px 0;">
    <div style="border-top:1px solid #f1f5f9;padding-top:18px;">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:12px;">👥 新規訪問者 vs リピーター</div>
      <table width="100%" cellpadding="0" cellspacing="0">{$userTypeHtml}</table>
      <div style="font-size:13px;color:#475569;line-height:1.7;margin-top:8px;padding:10px 14px;background:#f8fafc;border-radius:8px;">{$audienceComment}</div>
    </div>
  </td></tr>

  <!-- ランディングページ -->
  <tr><td style="background:#fff;padding:20px 28px 0;">
    <div style="border-top:1px solid #f1f5f9;padding-top:18px;">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:12px;">🚪 入口ページ（最初に訪れたページ）</div>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr style="background:#f8fafc;">
          <td style="padding:6px 4px;font-size:11px;font-weight:700;color:#64748b;">ページ</td>
          <td style="padding:6px 8px;font-size:11px;font-weight:700;color:#64748b;text-align:right;">訪問数</td>
          <td style="padding:6px 8px;font-size:11px;font-weight:700;color:#64748b;text-align:right;">直帰率</td>
          <td style="padding:6px 4px;font-size:11px;font-weight:700;color:#64748b;text-align:right;">滞在時間</td>
        </tr>
        {$landingHtml}
      </table>
      <div style="font-size:13px;color:#475569;line-height:1.7;margin-top:10px;padding:10px 14px;background:#f8fafc;border-radius:8px;">{$landingComment}</div>
    </div>
  </td></tr>

  <!-- 地域 -->
  <tr><td style="background:#fff;padding:20px 28px 0;">
    <div style="border-top:1px solid #f1f5f9;padding-top:18px;">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:12px;">🗾 アクセス地域 Top 5</div>
      <table width="100%" cellpadding="0" cellspacing="0">{$regionHtml}</table>
    </div>
  </td></tr>

  <!-- 深掘りインサイト -->
  <tr><td style="background:#fff;padding:20px 28px 0;">
    <div style="border-top:1px solid #f1f5f9;padding-top:18px;">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:14px;">🔍 深掘り分析</div>
      <div style="font-size:11px;color:#94a3b8;margin-bottom:12px;">左の色：🔴 緊急度高い　🟡 中　⚪ 低い</div>
      <table width="100%" cellpadding="0" cellspacing="0">{$insightsHtml}</table>
    </div>
  </td></tr>

  <!-- アクション -->
  <tr><td style="background:#fff;padding:20px 28px 0;">
    <div style="border-top:1px solid #f1f5f9;padding-top:18px;">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:14px;">💡 今週・来週のアクション</div>
      <table width="100%" cellpadding="0" cellspacing="0">{$actionsHtml}</table>
    </div>
  </td></tr>

  <!-- チェックポイント -->
  <tr><td style="background:#fff;padding:20px 28px 28px;border-radius:0 0 16px 16px;">
    <div style="border-top:1px solid #f1f5f9;padding-top:18px;">
      <div style="font-size:12px;font-weight:700;color:#94a3b8;letter-spacing:1px;margin-bottom:12px;">✅ 来週チェックすること</div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:16px 20px;">
        <div style="font-size:15px;font-weight:700;color:#15803d;margin-bottom:8px;">👀 {$checkMetric}</div>
        <div style="font-size:13px;color:#166534;line-height:1.7;">{$checkReason}</div>
      </div>
    </div>
  </td></tr>

  <!-- フッター -->
  <tr><td style="padding:16px 0;text-align:center;">
    <div style="font-size:11px;color:#94a3b8;">自動生成レポート　•　{$generatedAt}　•　Powered by GA4 + Gemini AI</div>
  </td></tr>

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
        if (!is_dir($reportDir)) { mkdir($reportDir, 0755, true); }
        $reportFile = rtrim($reportDir, '/') . '/ga4_weekly_' . $endDate . '.html';
        file_put_contents($reportFile, $html);
        return $reportFile;
    }

    // ── メール送信 ────────────────────────────────────────────────────────────

    private static function sendEmail(array $site, string $html, string $startDate, string $endDate): bool
    {
        if (empty($site['recipient_email'])) { return false; }
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
            if (empty($site[$key])) { throw new InvalidArgumentException("サイト設定に '{$key}' が未設定です"); }
        }
        if (!file_exists($site['credentials_path'])) {
            throw new InvalidArgumentException("credentials_path が見つかりません: {$site['credentials_path']}");
        }
    }

    // ── ユーティリティ ────────────────────────────────────────────────────────

    private static function extractSummary(array $data): array
    {
        $result = []; $metricNames = array_column($data['metricHeaders'] ?? [], 'name');
        foreach ($data['rows'] ?? [] as $row) {
            $range = $row['dimensionValues'][0]['value'] ?? 'range';
            foreach ($row['metricValues'] as $i => $val) { $result[$range][$metricNames[$i]] = $val['value']; }
        }
        return $result;
    }

    private static function extractDimensionRows(array $data): array
    {
        $dimNames = array_column($data['dimensionHeaders'] ?? [], 'name');
        $metricNames = array_column($data['metricHeaders'] ?? [], 'name');
        $rows = [];
        foreach ($data['rows'] ?? [] as $row) {
            $entry = [];
            foreach ($row['dimensionValues'] as $i => $val) { $entry[$dimNames[$i]] = $val['value']; }
            foreach ($row['metricValues'] as $i => $val) { $entry[$metricNames[$i]] = $val['value']; }
            $rows[] = $entry;
        }
        return $rows;
    }
}
