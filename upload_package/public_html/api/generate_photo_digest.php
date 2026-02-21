<?php

/**
 * 写真ダイジェストテンプレート
 *
 * 観察写真をグリッドで並べた視覚的レポート。
 * 環境教育、社内報告、イベント振り返り向け。
 *
 * Usage: api/generate_photo_digest.php?site_id=aikan_hq&limit=24
 */

require_once __DIR__ . '/../../libs/ReportEngine.php';

$siteId = $_GET['site_id'] ?? null;
if (!$siteId) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => 'site_id is required'], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$limit = intval($_GET['limit'] ?? 24);
$limit = max(4, min($limit, 48));

try {
    $engine = new ReportEngine($siteId, [
        'start_date'  => $_GET['start_date'] ?? null,
        'end_date'    => $_GET['end_date'] ?? null,
        'photo_limit' => $limit,
    ]);
    $d = $engine->compile();
} catch (\RuntimeException $e) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'message' => $e->getMessage()], JSON_UNESCAPED_UNICODE | JSON_HEX_TAG);
    exit;
}

$photos = $d['photos'];
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>写真ダイジェスト - <?php echo htmlspecialchars($d['siteName']); ?></title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;700;900&display=swap');

        :root {
            --primary: #10b981;
            --primary-dark: #065f46;
            --text: #1a1a2e;
            --muted: #6b7280;
            --border: #e5e7eb;
            --surface: #f9fafb;
            --photo-accent: #7c3aed;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans JP', 'Hiragino Sans', sans-serif;
            background: white;
            color: var(--text);
            font-size: 13px;
            line-height: 1.7;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 32px 40px;
            padding-bottom: 80px;
        }

        /* Header */
        .report-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid var(--photo-accent);
            padding-bottom: 14px;
            margin-bottom: 20px;
        }

        .brand-logo {
            font-size: 22px;
            font-weight: 900;
            color: var(--primary);
        }

        .brand-sub {
            font-size: 10px;
            color: var(--muted);
            letter-spacing: 1px;
            text-transform: uppercase;
        }

        .meta {
            text-align: right;
            font-size: 11px;
            color: var(--muted);
        }

        .meta strong {
            display: block;
            font-size: 12px;
            color: var(--text);
        }

        .report-title h1 {
            font-size: 22px;
            font-weight: 900;
            margin-bottom: 4px;
        }

        .report-title .sub {
            font-size: 12px;
            color: var(--muted);
            margin-bottom: 16px;
        }

        /* Stats bar */
        .stats-bar {
            display: flex;
            gap: 24px;
            padding: 10px 16px;
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 12px;
        }

        .stats-bar .stat {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .stats-bar .stat strong {
            color: var(--photo-accent);
            font-size: 16px;
        }

        /* Photo Grid */
        .photo-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 8px;
            margin-bottom: 24px;
        }

        .photo-card {
            border: 1px solid var(--border);
            border-radius: 6px;
            overflow: hidden;
            background: var(--surface);
        }

        .photo-card img {
            width: 100%;
            aspect-ratio: 1;
            object-fit: cover;
            display: block;
        }

        .photo-card .photo-caption {
            padding: 6px 8px;
            font-size: 10px;
            line-height: 1.3;
        }

        .photo-card .photo-species {
            font-weight: 700;
            display: block;
        }

        .photo-card .photo-date {
            color: var(--muted);
            font-size: 9px;
        }

        .photo-card .photo-observer {
            color: var(--muted);
            font-size: 9px;
        }

        .photo-card .rl-badge {
            display: inline-block;
            background: #fef2f2;
            color: #dc2626;
            font-size: 8px;
            font-weight: 700;
            padding: 1px 4px;
            border-radius: 3px;
            margin-top: 2px;
        }

        /* No photos fallback */
        .no-photos {
            text-align: center;
            padding: 40px;
            background: var(--surface);
            border: 2px dashed var(--border);
            border-radius: 8px;
            color: var(--muted);
        }

        .no-photos .emoji {
            font-size: 40px;
            margin-bottom: 8px;
        }

        .disclaimer {
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 6px;
            padding: 10px;
            font-size: 11px;
            color: #92400e;
        }

        .report-footer {
            margin-top: 24px;
            padding-top: 12px;
            border-top: 1px solid var(--border);
            font-size: 10px;
            color: var(--muted);
            text-align: center;
        }

        @media print {
            body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
            }

            .container {
                max-width: 100%;
                padding: 16px;
            }

            .no-print {
                display: none !important;
            }

            .photo-grid {
                grid-template-columns: repeat(4, 1fr);
            }
        }

        .action-bar {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            background: white;
            border-top: 1px solid var(--border);
            padding: 10px 24px;
            display: flex;
            justify-content: center;
            gap: 12px;
            z-index: 100;
        }

        .action-bar button {
            padding: 8px 24px;
            font-size: 13px;
            font-weight: 700;
            border-radius: 6px;
            cursor: pointer;
            border: none;
        }

        .btn-print {
            background: var(--photo-accent);
            color: white;
        }

        .btn-back {
            background: var(--surface);
            color: var(--text);
            border: 1px solid var(--border) !important;
        }
    </style>
</head>

<body>
    <div class="container">
        <!-- Header -->
        <div class="report-header">
            <div>
                <div class="brand-logo">ikimon</div>
                <div class="brand-sub">Biodiversity Monitoring Platform</div>
            </div>
            <div class="meta">
                <strong>写真ダイジェスト</strong>
                作成日: <?php echo $d['reportDate']; ?><br>
                対象期間: <?php echo $d['reportPeriod']; ?>
            </div>
        </div>

        <!-- Title -->
        <div class="report-title">
            <h1>📸 <?php echo htmlspecialchars($d['siteName']); ?> — 写真ダイジェスト</h1>
            <div class="sub">観察記録の写真一覧（<?php echo count($photos); ?>件抜粋）</div>
        </div>

        <!-- Stats -->
        <div class="stats-bar">
            <div class="stat">📷 写真数: <strong><?php echo count($photos); ?></strong></div>
            <div class="stat">🌿 確認種: <strong><?php echo $d['totalSpecies']; ?></strong></div>
            <div class="stat">🎯 BIS: <strong><?php echo $d['bis']; ?></strong></div>
            <div class="stat">📊 総観察: <strong><?php echo $d['totalObs']; ?></strong></div>
        </div>

        <!-- Photo Grid -->
        <?php if (!empty($photos)): ?>
            <div class="photo-grid">
                <?php foreach ($photos as $photo): ?>
                    <div class="photo-card">
                        <img src="<?php echo htmlspecialchars($photo['url']); ?>"
                            alt="<?php echo htmlspecialchars($photo['species'] ?? '観察写真'); ?>"
                            loading="lazy"
                            onerror="this.src='data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 200 200%22%3E%3Crect fill=%22%23f3f4f6%22 width=%22200%22 height=%22200%22/%3E%3Ctext x=%2250%%25%22 y=%2250%%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%239ca3af%22 font-size=%2224%22%3E📷%3C/text%3E%3C/svg%3E'">
                        <div class="photo-caption">
                            <span class="photo-species"><?php echo htmlspecialchars($photo['species'] ?? '未同定'); ?></span>
                            <span class="photo-date"><?php echo htmlspecialchars($photo['date'] ?? ''); ?></span>
                            <?php if (!empty($photo['observer'])): ?>
                                <span class="photo-observer">by <?php echo htmlspecialchars($photo['observer']); ?></span>
                            <?php endif; ?>
                            <?php if (!empty($photo['is_redlist'])): ?>
                                <span class="rl-badge">🔴 希少種</span>
                            <?php endif; ?>
                        </div>
                    </div>
                <?php endforeach; ?>
            </div>
        <?php else: ?>
            <div class="no-photos">
                <div class="emoji">📷</div>
                <p>対象期間に写真付きの観察データがありません。</p>
                <p style="font-size: 11px; margin-top: 4px;">観察時に写真を添付すると、ここに自動でギャラリーが生成されます。</p>
            </div>
        <?php endif; ?>

        <!-- Summary -->
        <div style="background: var(--surface); border: 1px solid var(--border); border-radius: 6px; padding: 12px; margin-bottom: 16px;">
            <h3 style="font-size: 12px; font-weight: 700; margin-bottom: 6px;">📊 データ概要</h3>
            <div style="font-size: 11px;">
                本ダイジェストは、<?php echo htmlspecialchars($d['siteName']); ?>において記録された
                <strong><?php echo $d['totalObs']; ?>件</strong>の観察データから、
                写真付きの記録を抜粋してまとめたものです。
                確認された<strong><?php echo $d['totalSpecies']; ?>種</strong>のうち、
                <strong><?php echo count($d['redListSpecies']); ?>種</strong>がレッドリスト掲載種として確認されています。
            </div>
        </div>

        <!-- Disclaimer -->
        <div class="disclaimer">
            <strong>写真について:</strong>
            写真は市民科学参加者により撮影されたものです。掲載にあたり、観察者の同意を得ることを推奨します。
            二次利用の際はデータ提供者のクレジット表記にご配慮ください。
        </div>

        <!-- Footer -->
        <div class="report-footer">
            <p>
                Generated by <strong>ikimon</strong> (https://ikimon.life)<br>
                &copy; <?php echo date('Y'); ?> ikimon Project. Based in Hamamatsu, Japan.
            </p>
        </div>
    </div>

    <!-- Action Bar -->
    <div class="action-bar no-print">
        <button class="btn-back" onclick="history.back()">← 戻る</button>
        <button class="btn-print" onclick="window.print()">🖨 PDF保存 / 印刷</button>
    </div>
</body>

</html>