<?php

/**
 * B2B Demo Report — Anonymized wrapper
 * 
 * Renders the site report for ikan_hq in demo mode:
 * - Adds a persistent demo banner at top
 * - Forces public_mode=1 to anonymize user data
 * - Hides individual GPS coordinates
 * - Adds CTA at bottom to drive conversions
 * 
 * This is a thin wrapper that includes the real report generator.
 */
require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';

Auth::init();

// Force demo parameters
$_GET['site_id'] = 'ikan_hq';
$_GET['public_mode'] = '1';

// Capture the report output
ob_start();
require __DIR__ . '/../api/generate_site_report.php';
$reportHtml = ob_get_clean();

// Inject demo banner and CTA into the report HTML
$demoBanner = <<<'HTML'
<!-- Demo Banner -->
<div id="demo-banner" style="
    position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
    background: linear-gradient(135deg, #065f46 0%, #059669 100%);
    color: white; padding: 12px 24px;
    display: flex; align-items: center; justify-content: center; gap: 16px;
    font-size: 13px; font-weight: 700;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
">
    <span style="
        display: inline-flex; align-items: center; gap: 6px;
        padding: 3px 10px; border-radius: 100px;
        background: rgba(255,255,255,0.15); font-size: 10px;
        letter-spacing: 1px; text-transform: uppercase;
    ">🔍 DEMO</span>
    <span>愛管株式会社の実データによるデモレポートです</span>
    <a href="/for-business.php" style="
        padding: 6px 16px; border-radius: 100px;
        background: white; color: #065f46;
        font-size: 12px; font-weight: 800;
        text-decoration: none; white-space: nowrap;
        transition: transform 0.2s;
    " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
        導入を検討する →
    </a>
</div>
<style>
    body { padding-top: 52px !important; }
    .action-bar { bottom: 0; }
</style>
HTML;

$demoCta = <<<'HTML'
<!-- Demo CTA Section -->
<div style="
    max-width: 800px; margin: 40px auto 120px;
    padding: 40px; text-align: center;
    background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
    border-radius: 20px; border: 1px solid #a7f3d0;
">
    <h2 style="font-size: 24px; font-weight: 900; margin-bottom: 12px; color: #065f46;">
        御社のサイトでも、同じレポートが作れます。
    </h2>
    <p style="font-size: 14px; color: #6b7280; margin-bottom: 24px; line-height: 1.8;">
        このレポートは、市民科学の観察データから<strong style="color: #111;">完全自動</strong>で生成されています。<br>
        御社の敷地でも、同じ品質のTNFD対応レポートを毎月自動で出力できます。
    </p>
    <div style="display: flex; gap: 12px; justify-content: center; flex-wrap: wrap;">
        <a href="/for-business.php#contact" style="
            display: inline-flex; align-items: center; gap: 8px;
            padding: 16px 32px; border-radius: 100px;
            background: linear-gradient(135deg, #10b981, #059669);
            color: white; font-size: 16px; font-weight: 800;
            text-decoration: none; box-shadow: 0 8px 24px rgba(16,185,129,0.2);
            transition: all 0.3s;
        " onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            📧 無料診断を申し込む
        </a>
        <a href="/demo/" style="
            display: inline-flex; align-items: center; gap: 8px;
            padding: 16px 32px; border-radius: 100px;
            background: white; color: #374151;
            font-size: 14px; font-weight: 700;
            text-decoration: none; border: 1px solid #d1d5db;
            transition: all 0.3s;
        " onmouseover="this.style.background='#f9fafb'" onmouseout="this.style.background='white'">
            ← デモトップに戻る
        </a>
    </div>
    <p style="font-size: 11px; color: #9ca3af; margin-top: 16px;">
        ※ Communityプラン: 無料（サイト1件）/ Businessプラン: ¥298,000/年（税別、サイト10件まで）
    </p>
</div>
HTML;

// Inject banner after <body> tag
$reportHtml = preg_replace(
    '/(<body[^>]*>)/i',
    '$1' . $demoBanner,
    $reportHtml,
    1
);

// Replace the action bar with our demo version + CTA
$reportHtml = preg_replace(
    '/<!-- Action Bar.*?<\/div>/s',
    $demoCta . "\n" . '<!-- Demo Action Bar -->
<div class="action-bar no-print">
    <a href="/demo/" class="btn-back" style="text-decoration:none;">← デモトップに戻る</a>
    <button class="btn-print" onclick="window.print()">📄 PDFとして保存</button>
    <a href="/for-business.php" class="btn-print" style="text-decoration:none; background:#065f46;">導入を相談する</a>
</div>',
    $reportHtml,
    1
);

// Strip individual observer names from the HTML (privacy)
// The report doesn't show observer names by default in public_mode,
// but let's be safe and scrub any user references
$reportHtml = preg_replace('/投稿者[:：]\s*[^\s<]+/', '投稿者: —', $reportHtml);

echo $reportHtml;
