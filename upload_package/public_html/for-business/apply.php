<?php

/**
 * B2B Apply Page — 導入申込フォーム
 * 
 * セルフサービス申込。初期は問い合わせフォームとして機能。
 * 将来的に自動プロビジョニングに拡張予定。
 */
require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/CspNonce.php';

$nonce = CspNonce::get();
CspNonce::sendHeader();
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>導入の申込み | ikimon for Business</title>
    <meta name="description" content="ikimon for Business の導入申込フォーム。最短5分で開始できます。">
    <link rel="icon" type="image/png" sizes="32x32" href="../assets/img/favicon-32.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #10b981;
            --primary-dark: #065f46;
            --primary-light: #d1fae5;
            --accent: #3b82f6;
            --accent-dark: #1e40af;
            --text: #1a1a2e;
            --text-secondary: #4b5563;
            --muted: #9ca3af;
            --bg: #ffffff;
            --surface: #f9fafb;
            --border: #e5e7eb;
            --error: #ef4444;
            --error-light: #fee2e2;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: 'Noto Sans JP', sans-serif;
            background: var(--bg);
            color: var(--text);
            font-size: 16px;
            line-height: 1.8;
        }

        .container {
            max-width: 1100px;
            margin: 0 auto;
            padding: 0 24px;
        }

        .badge {
            display: inline-block;
            padding: 4px 14px;
            border-radius: 99px;
            font-size: 12px;
            font-weight: 700;
        }

        .badge-green {
            background: var(--primary-light);
            color: var(--primary-dark);
        }

        .btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 24px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 700;
            text-decoration: none;
            transition: all 0.2s;
            border: none;
            cursor: pointer;
        }

        .btn-primary-lp {
            background: var(--primary);
            color: white;
        }

        .btn-primary-lp:hover {
            background: var(--primary-dark);
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
        }

        .btn-outline {
            background: transparent;
            color: var(--primary);
            border: 2px solid var(--primary);
        }

        .lp-nav {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            z-index: 100;
            background: rgba(255, 255, 255, 0.92);
            backdrop-filter: blur(12px);
            border-bottom: 1px solid var(--border);
        }

        .lp-nav .inner {
            max-width: 1100px;
            margin: 0 auto;
            padding: 0 24px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            height: 60px;
        }

        .lp-nav .logo {
            font-size: 20px;
            font-weight: 900;
            color: var(--primary);
            text-decoration: none;
        }

        .lp-nav .logo sup {
            font-size: 10px;
            color: var(--accent);
            font-weight: 700;
            vertical-align: super;
        }

        .lp-nav-links {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .lp-nav-links a {
            font-size: 13px;
            font-weight: 700;
            color: var(--text-secondary);
            text-decoration: none;
        }

        .lp-nav-links a:hover {
            color: var(--primary);
        }

        .page-header {
            padding: 100px 0 40px;
            background: var(--surface);
            border-bottom: 1px solid var(--border);
        }

        .page-header h1 {
            font-size: 28px;
            font-weight: 900;
        }

        .page-header p {
            font-size: 15px;
            color: var(--text-secondary);
            margin-top: 8px;
            max-width: 560px;
        }

        /* Form */
        .form-section {
            padding: 48px 0 80px;
        }

        .form-layout {
            display: grid;
            grid-template-columns: 1fr 340px;
            gap: 40px;
            max-width: 900px;
            margin: 0 auto;
        }

        .form-main {}

        .form-sidebar {
            padding-top: 8px;
        }

        .field {
            margin-bottom: 20px;
        }

        .field label {
            display: block;
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 6px;
        }

        .field label .req {
            color: var(--error);
            font-size: 11px;
            margin-left: 4px;
        }

        .field input,
        .field select,
        .field textarea {
            width: 100%;
            padding: 10px 14px;
            border: 2px solid var(--border);
            border-radius: 8px;
            font-family: inherit;
            font-size: 14px;
            transition: border-color 0.2s;
            background: white;
        }

        .field input:focus,
        .field select:focus,
        .field textarea:focus {
            outline: none;
            border-color: var(--primary);
        }

        .field textarea {
            resize: vertical;
            min-height: 80px;
        }

        .field-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
        }

        .form-submit {
            margin-top: 24px;
        }

        .form-submit .btn {
            width: 100%;
            justify-content: center;
            padding: 14px;
            font-size: 16px;
        }

        .sidebar-card {
            background: var(--surface);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 20px;
            margin-bottom: 16px;
        }

        .sidebar-card h3 {
            font-size: 14px;
            font-weight: 900;
            margin-bottom: 8px;
        }

        .sidebar-card ul {
            list-style: none;
        }

        .sidebar-card li {
            font-size: 12px;
            padding: 4px 0;
            display: flex;
            align-items: center;
            gap: 6px;
        }

        .sidebar-card .check {
            color: var(--primary);
            font-weight: 700;
        }

        /* Success state */
        .success-message {
            display: none;
            text-align: center;
            padding: 48px;
            background: var(--primary-light);
            border-radius: 12px;
        }

        .success-message.show {
            display: block;
        }

        .success-message h2 {
            font-size: 24px;
            font-weight: 900;
            color: var(--primary-dark);
            margin-bottom: 8px;
        }

        .success-message p {
            font-size: 14px;
            color: var(--primary-dark);
        }

        .lp-footer {
            padding: 32px 0;
            text-align: center;
            font-size: 12px;
            color: var(--muted);
            border-top: 1px solid var(--border);
        }

        .lp-footer a {
            color: var(--text-secondary);
            text-decoration: none;
            margin: 0 8px;
        }

        @media (max-width: 768px) {
            .form-layout {
                grid-template-columns: 1fr;
            }

            .form-sidebar {
                order: -1;
            }

            .field-row {
                grid-template-columns: 1fr;
            }

            .page-header h1 {
                font-size: 22px;
            }

            .lp-nav-links a.hide-mobile {
                display: none;
            }
        }
    </style>
</head>

<body>
    <nav class="lp-nav">
        <div class="inner">
            <a href="index.php" class="logo">ikimon<sup>Business</sup></a>
            <div class="lp-nav-links">
                <a href="index.php" class="hide-mobile">概要</a>
                <a href="pricing.php" class="hide-mobile">料金</a>
                <a href="demo.php" class="btn btn-outline" style="padding: 6px 16px; font-size: 12px;">デモ</a>
            </div>
        </div>
    </nav>

    <header class="page-header">
        <div class="container">
            <span class="badge badge-green">📝 APPLY</span>
            <h1 style="margin-top: 8px;">導入の申込み</h1>
            <p>下記フォームを送信いただければ、最短翌営業日にサイト設定が完了します。</p>
        </div>
    </header>

    <section class="form-section">
        <div class="container">
            <div id="formArea" class="form-layout">
                <div class="form-main">
                    <form id="applyForm" method="POST" action="#" onsubmit="return handleSubmit(event)">
                        <h3 style="font-size: 16px; font-weight: 900; margin-bottom: 16px;">企業情報</h3>

                        <div class="field">
                            <label>会社名/団体名 <span class="req">*必須</span></label>
                            <input type="text" name="company" required placeholder="例：株式会社サンプル">
                        </div>

                        <div class="field-row">
                            <div class="field">
                                <label>担当者名 <span class="req">*必須</span></label>
                                <input type="text" name="contact_name" required placeholder="山田 太郎">
                            </div>
                            <div class="field">
                                <label>部署</label>
                                <input type="text" name="department" placeholder="環境推進室">
                            </div>
                        </div>

                        <div class="field-row">
                            <div class="field">
                                <label>メールアドレス <span class="req">*必須</span></label>
                                <input type="email" name="email" required placeholder="taro@example.co.jp">
                            </div>
                            <div class="field">
                                <label>電話番号</label>
                                <input type="tel" name="phone" placeholder="053-XXX-XXXX">
                            </div>
                        </div>

                        <h3 style="font-size: 16px; font-weight: 900; margin: 24px 0 16px;">サイト情報</h3>

                        <div class="field">
                            <label>モニタリング対象の拠点名 <span class="req">*必須</span></label>
                            <input type="text" name="site_name" required placeholder="例：本社敷地、工場隣接緑地">
                        </div>

                        <div class="field">
                            <label>拠点の所在地</label>
                            <input type="text" name="site_location" placeholder="例：静岡県浜松市中央区XX町 1-2-3">
                        </div>

                        <div class="field">
                            <label>プラン <span class="req">*必須</span></label>
                            <select name="plan" required>
                                <option value="">選択してください</option>
                                <option value="community">Community（無料）</option>
                                <option value="business">Business（¥498,000 / 年）</option>
                            </select>
                        </div>

                        <div class="field">
                            <label>備考・ご質問など</label>
                            <textarea name="message" rows="3" placeholder="複数拠点のモニタリングを検討中、など自由にお書きください"></textarea>
                        </div>

                        <div class="form-submit">
                            <button type="submit" class="btn btn-primary-lp">📝 申込みを送信する</button>
                        </div>
                        <p style="font-size: 11px; color: var(--muted); margin-top: 8px; text-align: center;">
                            送信後、担当よりご連絡いたします。<a href="../privacy.php" style="color: var(--primary);">プライバシーポリシー</a>に同意のうえお申し込みください。
                        </p>
                    </form>
                </div>

                <div class="form-sidebar">
                    <div class="sidebar-card">
                        <h3>🎯 導入の流れ</h3>
                        <ul>
                            <li><span class="check">1.</span> 本フォームで申込み送信</li>
                            <li><span class="check">2.</span> 担当より確認メール（1営業日以内）</li>
                            <li><span class="check">3.</span> サイト画面で敷地境界を描画</li>
                            <li><span class="check">4.</span> 観察開始！</li>
                        </ul>
                    </div>

                    <div class="sidebar-card">
                        <h3>✅ Business プラン特典</h3>
                        <ul>
                            <li><span class="check">✓</span> サイト数 無制限</li>
                            <li><span class="check">✓</span> 全6種レポート生成</li>
                            <li><span class="check">✓</span> 企業ダッシュボード</li>
                            <li><span class="check">✓</span> 観察会テンプレート</li>
                            <li><span class="check">✓</span> メンバー管理</li>
                            <li><span class="check">✓</span> データエクスポート</li>
                        </ul>
                    </div>

                    <div class="sidebar-card" style="background: var(--primary-light);">
                        <h3 style="color: var(--primary-dark);">💬 ご相談だけでもOK</h3>
                        <p style="font-size: 12px; color: var(--primary-dark);">
                            「まず話を聞きたい」という方も歓迎。備考欄にその旨ご記入ください。
                        </p>
                    </div>
                </div>
            </div>

            <div id="successMessage" class="success-message">
                <p style="font-size: 40px; margin-bottom: 12px;">🎉</p>
                <h2>お申込みありがとうございます</h2>
                <p>1営業日以内に担当者よりメールにてご連絡いたします。</p>
                <div style="margin-top: 24px;">
                    <a href="index.php" class="btn btn-outline">トップに戻る</a>
                </div>
            </div>
        </div>
    </section>

    <footer class="lp-footer">
        <div class="container">
            <p style="margin-bottom: 8px;">
                <a href="../index.php">ikimon ホーム</a>
                <a href="index.php">ikimon for Business</a>
                <a href="pricing.php">料金</a>
                <a href="mailto:contact@ikimon.life">お問い合わせ</a>
            </p>
            <p>&copy; <?php echo date('Y'); ?> ikimon Project.</p>
        </div>
    </footer>

    <script nonce="<?= $nonce ?>">
        function handleSubmit(e) {
            e.preventDefault();
            const form = document.getElementById('applyForm');
            const data = new FormData(form);

            // 初期フェーズ: mailto で送信
            const subject = encodeURIComponent('[ikimon B2B] 導入申込: ' + data.get('company'));
            const body = encodeURIComponent(
                '会社名: ' + data.get('company') + '\n' +
                '担当者: ' + data.get('contact_name') + '\n' +
                '部署: ' + (data.get('department') || '未記入') + '\n' +
                'メール: ' + data.get('email') + '\n' +
                '電話: ' + (data.get('phone') || '未記入') + '\n' +
                '拠点名: ' + data.get('site_name') + '\n' +
                '所在地: ' + (data.get('site_location') || '未記入') + '\n' +
                'プラン: ' + data.get('plan') + '\n' +
                '備考: ' + (data.get('message') || 'なし') + '\n'
            );
            window.location.href = 'mailto:contact@ikimon.life?subject=' + subject + '&body=' + body;

            // 成功表示
            document.getElementById('formArea').style.display = 'none';
            document.getElementById('successMessage').classList.add('show');

            return false;
        }
    </script>
</body>

</html>