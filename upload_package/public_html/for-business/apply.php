<?php

/**
 * B2B Apply Page — Public プラン相談フォーム
 * 
 * 無料の Community は別導線でセルフ作成。
 * このページは Public プラン相談用。
 */
require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/CspNonce.php';
require_once ROOT_DIR . '/libs/CSRF.php';
require_once ROOT_DIR . '/libs/BrandMessaging.php';

$nonce = CspNonce::get();
CspNonce::sendHeader();
$csrfToken = CSRF::generate();
$regionalMessaging = BrandMessaging::regionalRevitalization();
$publicPlan = $regionalMessaging['public_plan'];
$communityPlan = $regionalMessaging['community_plan'];
$freePlan = $regionalMessaging['free_plan'];
$publicPlanSummary = $publicPlan['description'];
$freeMunicipalityPolicy = $regionalMessaging['support_policies'][0]['body'];
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Public プランの相談 | ikimon for Business</title>
    <meta name="description" content="<?= htmlspecialchars('ikimon for Business の Public プラン相談フォーム。' . $publicPlanSummary, ENT_QUOTES, 'UTF-8') ?>">
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

        /* Footer: uses shared components/footer.php */

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
                <a href="/for-business/#plans" class="hide-mobile">料金</a>
                <a href="status.php" class="hide-mobile">進み具合</a>
                <a href="demo.php" class="btn btn-outline" style="padding: 6px 16px; font-size: 12px;">デモ</a>
            </div>
        </div>
    </nav>

    <header class="page-header">
        <div class="container">
            <span class="badge badge-green">📝 APPLY</span>
            <h1 style="margin-top: 8px;">Public プランの相談</h1>
            <p>フォーム送信後は受付番号を発行します。運営側で内容を確認し、必要な出力や運用体制に合わせて Public 導入まで進めます。<?= htmlspecialchars($freeMunicipalityPolicy) ?></p>
        </div>
    </header>

    <section class="form-section">
        <div class="container">
            <div id="formArea" class="form-layout">
                <div class="form-main">
                    <form id="applyForm" method="POST" action="#" onsubmit="return handleSubmit(event)">
                        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
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
                            <input type="text" name="site_name" required placeholder="例：本社敷地、工場まわりの緑地、公園エリア">
                        </div>

                        <div class="field">
                            <label>拠点の所在地</label>
                            <input type="text" name="site_location" placeholder="例：静岡県浜松市中央区XX町 1-2-3">
                        </div>

                        <div class="field">
                            <label>プラン <span class="req">*必須</span></label>
                            <select name="plan" required>
                                <option value="">選択してください</option>
                                <option value="public">Public（<?= htmlspecialchars($publicPlan['description']) ?> / ¥39,800 / 月）</option>
                                <option value="consultation">まず相談したい</option>
                            </select>
                            <p style="margin-top:8px; font-size:12px; color:var(--muted);">個人利用と無料の <strong><?= htmlspecialchars($communityPlan['tag']) ?></strong> 団体ページは申込み不要です。<?= htmlspecialchars($communityPlan['description']) ?></p>
                        </div>

                        <div class="field-row">
                            <div class="field">
                                <label>始めたい時期</label>
                                <select name="expected_start">
                                    <option value="soon">できるだけ早く</option>
                                    <option value="this_month">今月中に</option>
                                    <option value="next_quarter">1〜3か月以内に</option>
                                    <option value="exploring">まずは相談したい</option>
                                </select>
                            </div>
                            <div class="field">
                                <label>想定している拠点数</label>
                                <select name="planned_site_count">
                                    <option value="1">1拠点</option>
                                    <option value="2-5">2〜5拠点</option>
                                    <option value="6+">6拠点以上</option>
                                </select>
                            </div>
                        </div>

                        <div class="field">
                            <label>主な使い方</label>
                            <select name="use_mode">
                                <option value="">選択してください</option>
                                <option value="archive">その場所の自然記録を残したい</option>
                                <option value="program">授業・観察会・小さな調査で使いたい</option>
                                <option value="team">チームで見返せる形にしたい</option>
                                <option value="handoff">外部資料づくりの下準備にしたい</option>
                            </select>
                        </div>

                        <div class="field">
                            <label>備考・ご質問など</label>
                            <textarea name="message" rows="3" placeholder="複数拠点の記録運用を検討中、学校連携もしたい、など自由にお書きください"></textarea>
                        </div>

                        <div class="form-submit">
                            <button type="submit" class="btn btn-primary-lp">📝 相談内容を送信する</button>
                        </div>
                        <p style="font-size: 11px; color: var(--muted); margin-top: 8px; text-align: center;">
                            送信後、担当よりご連絡いたします。<a href="../privacy.php" style="color: var(--primary);">プライバシーポリシー</a>に同意のうえお申し込みください。
                        </p>
                    </form>
                </div>

                <div class="form-sidebar">
                    <div class="sidebar-card">
                        <h3>🧭 どのプランを選ぶ？</h3>
                        <ul>
                            <li><span class="check">Free</span> 個人で始める入口。申込み不要</li>
                            <li><span class="check"><?= htmlspecialchars($communityPlan['tag']) ?></span> <?= htmlspecialchars($communityPlan['name']) ?>として無料で始めたいとき</li>
                            <li><span class="check"><?= htmlspecialchars($publicPlan['tag']) ?></span> <?= htmlspecialchars($publicPlan['description']) ?></li>
                        </ul>
                        <a href="create.php" class="btn btn-outline" style="width:100%; justify-content:center; margin-top:12px;">無料の団体ページを作る</a>
                    </div>

                    <div class="sidebar-card">
                        <h3>🎯 導入の流れ</h3>
                        <ul>
                            <li><span class="check">1.</span> 受付番号つきで申込み保存</li>
                            <li><span class="check">2.</span> 運営側で内容確認・初回連絡</li>
                            <li><span class="check">3.</span> 拠点境界と初期設定を準備</li>
                            <li><span class="check">4.</span> 記録ボードを開いて運用開始</li>
                        </ul>
                    </div>

                    <div class="sidebar-card">
                        <h3>✨ Public でできること</h3>
                        <ul>
                            <li><span class="check">✓</span> <?= htmlspecialchars($publicPlan['description']) ?></li>
                            <li><span class="check">✓</span> CSV / 証跡JSON / 各種レポート出力</li>
                            <li><span class="check">✓</span> 継続運用と提出向けの Public サポート</li>
                            <li><span class="check">✓</span> <?= htmlspecialchars($communityPlan['tag']) ?> で育てた活動をそのまま昇格</li>
                        </ul>
                        <div style="margin-top:14px; border-radius:14px; background:#ecfdf5; border:1px solid #bbf7d0; padding:12px 14px; font-size:13px; color:var(--primary-dark);">
                            <strong style="display:block; margin-bottom:4px;"><?= htmlspecialchars($communityPlan['tag']) ?> でできること</strong>
                            <?= htmlspecialchars($communityPlan['description']) ?>
                        </div>
                        <div style="margin-top:14px; border-radius:14px; background:#f0fdf4; border:1px solid #86efac; padding:12px 14px; font-size:13px; color:var(--primary-dark);">
                            <strong style="display:block; margin-bottom:4px;"><?= htmlspecialchars($freePlan['tag']) ?>の方針</strong>
                            <?= htmlspecialchars($freeMunicipalityPolicy) ?>
                        </div>
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
                <h2>ご相談ありがとうございます</h2>
                <p id="successLead">受付番号を発行しました。1営業日以内に、Public 導入や出力要件の進め方をご案内します。</p>
                <div style="margin-top: 20px; padding: 16px; border-radius: 12px; background: rgba(255,255,255,0.7);">
                    <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.08em; color: var(--primary-dark); text-transform: uppercase;">受付番号</div>
                    <div id="successReference" style="font-size: 24px; font-weight: 900; color: var(--primary-dark); margin-top: 6px;">-</div>
                    <p id="successNext" style="font-size: 13px; color: var(--primary-dark); margin-top: 8px;">次のご案内をお待ちください。</p>
                </div>
                <div style="margin-top: 24px;">
                    <a href="index.php" class="btn btn-outline">トップに戻る</a>
                    <a id="statusLink" href="status.php" class="btn btn-primary-lp">進み具合を見る</a>
                </div>
            </div>
        </div>
    </section>

    <?php include __DIR__ . '/../components/footer.php'; ?>

    <script nonce="<?= $nonce ?>">
        function getCsrfToken() {
            const m = document.cookie.match(/(?:^|;\\s*)ikimon_csrf=([a-f0-9]{64})/);
            return m ? m[1] : document.querySelector('input[name=\"csrf_token\"]')?.value || '';
        }

        function handleSubmit(e) {
            e.preventDefault();
            const form = document.getElementById('applyForm');
            const data = new FormData(form);
            const payload = Object.fromEntries(data.entries());
            const submitButton = form.querySelector('button[type="submit"]');
            submitButton.disabled = true;
            submitButton.textContent = '送信中...';

            fetch('../api/business/submit_application.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Csrf-Token': getCsrfToken()
                },
                body: JSON.stringify(payload)
            })
                .then(function(response) {
                    return response.json().then(function(json) {
                        if (!response.ok || !json.success) {
                            throw new Error(json.message || '送信に失敗しました。');
                        }
                        return json;
                    });
                })
                .then(function(result) {
                    document.getElementById('formArea').style.display = 'none';
                    document.getElementById('successMessage').classList.add('show');
                    document.getElementById('successReference').textContent = result.reference || '-';
                    document.getElementById('successNext').textContent = (result.status_label || '新規受付') + ' / 次の動き: ' + (result.next_action || '初回連絡');
                    document.getElementById('statusLink').href = 'status.php?ref=' + encodeURIComponent(result.reference || '');
                })
                .catch(function(error) {
                    alert(error.message || '送信に失敗しました。時間をおいてもう一度お試しください。');
                    submitButton.disabled = false;
                    submitButton.textContent = '📝 相談内容を送信する';
                });

            return false;
        }
    </script>
</body>

</html>
