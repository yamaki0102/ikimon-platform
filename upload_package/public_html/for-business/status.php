<?php

require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/CspNonce.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/CSRF.php';
require_once ROOT_DIR . '/libs/BusinessApplicationManager.php';

CspNonce::sendHeader();
Auth::init();
$currentUser = Auth::user();

$reference = trim((string)($_GET['ref'] ?? ''));
$email = trim((string)($_GET['email'] ?? ''));
$application = null;
$searched = ($reference !== '' || $email !== '');

if ($reference !== '' && $email !== '') {
    $application = BusinessApplicationManager::findByReferenceAndEmail($reference, $email);
}

$claimMessage = null;
$claimType = null;
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && $reference !== '' && $email !== '') {
    if (!CSRF::validate($_POST['csrf_token'] ?? '')) {
        $claimType = 'error';
        $claimMessage = 'CSRF token が無効です。ページを再読み込みしてください。';
    } elseif (!$currentUser) {
        $claimType = 'error';
        $claimMessage = 'ワークスペースを受け取るにはログインが必要です。';
    } elseif (mb_strtolower((string)($currentUser['email'] ?? '')) !== mb_strtolower($email)) {
        $claimType = 'error';
        $claimMessage = '申込み時のメールアドレスと同じアカウントでログインしてください。';
    } else {
        $application = BusinessApplicationManager::claimWorkspace($reference, $email, $currentUser);
        if ($application) {
            $claimType = 'success';
            $claimMessage = 'このアカウントを団体ワークスペースへ接続しました。';
        } else {
            $claimType = 'error';
            $claimMessage = 'ワークスペースの受け取りに失敗しました。';
        }
    }
}

$statusLabel = $application['status_label'] ?? '確認待ち';
$steps = [
    'new' => 1,
    'reviewing' => 2,
    'contacted' => 3,
    'onboarding' => 4,
    'active' => 5,
    'closed' => 5,
];
$currentStep = $steps[$application['status'] ?? 'new'] ?? 1;
$workspaceCorpId = (string)($application['workspace']['corporation_id'] ?? '');
$canClaimWorkspace = $application
    && $workspaceCorpId !== ''
    && ($application['status'] ?? '') !== 'closed'
    && $currentUser
    && mb_strtolower((string)($currentUser['email'] ?? '')) === mb_strtolower($email);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>申込みの進み具合 | ikimon for Business</title>
    <link rel="icon" type="image/png" sizes="32x32" href="../assets/img/favicon-32.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700;900&display=swap" rel="stylesheet">
    <style>
        :root{--primary:#10b981;--primary-dark:#065f46;--primary-light:#d1fae5;--text:#1a1a2e;--text-secondary:#4b5563;--surface:#f9fafb;--border:#e5e7eb;}
        *{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Noto Sans JP',sans-serif;background:#fff;color:var(--text);line-height:1.8}
        .container{max-width:880px;margin:0 auto;padding:0 24px}
        .hero{padding:96px 0 32px;background:linear-gradient(135deg,#065f46 0%,#10b981 55%,#3b82f6 100%);color:#fff}
        .card{background:#fff;border:1px solid var(--border);border-radius:20px;padding:24px;box-shadow:0 16px 36px rgba(15,23,42,.06)}
        .field{margin-bottom:16px}
        .field label{display:block;font-size:13px;font-weight:800;margin-bottom:6px}
        .field input{width:100%;padding:12px 14px;border:2px solid var(--border);border-radius:10px;font:inherit}
        .field input:focus{outline:none;border-color:var(--primary)}
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:800;border:none;cursor:pointer}
        .btn-primary{background:var(--primary);color:#fff}
        .btn-outline{background:#fff;color:var(--primary-dark);border:2px solid rgba(255,255,255,.4)}
        .status-pill{display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;background:var(--primary-light);color:var(--primary-dark);font-size:12px;font-weight:800}
        .step-row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-top:20px}
        .step{padding:14px 12px;border-radius:16px;border:1px solid var(--border);background:var(--surface);text-align:center}
        .step.active{border-color:rgba(16,185,129,.25);background:#ecfdf5}
        .step.done{background:#f0fdf4}
        .step .num{width:28px;height:28px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#e5e7eb;font-size:12px;font-weight:900;margin-bottom:8px}
        .step.active .num,.step.done .num{background:var(--primary);color:#fff}
        .muted{color:var(--text-secondary);font-size:14px}
        .grid{display:grid;grid-template-columns:1.1fr .9fr;gap:20px}
        @media (max-width:768px){.grid,.step-row{grid-template-columns:1fr}.hero{padding-top:80px}}
    </style>
</head>
<body>
    <section class="hero">
        <div class="container">
            <div style="font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.82;">Application Status</div>
            <h1 style="margin-top:10px;font-size:40px;line-height:1.25;font-weight:900;">申込みの進み具合を確認</h1>
            <p style="margin-top:12px;max-width:640px;font-size:15px;opacity:.92;">受付番号と申込み時のメールアドレスで、立上げの進み具合を確認できます。</p>
        </div>
    </section>

    <main class="container" style="padding:28px 24px 72px;">
        <div class="grid">
            <section class="card">
                <h2 style="font-size:22px;font-weight:900;margin-bottom:12px;">照会する</h2>
                <form method="GET">
                    <div class="field">
                        <label>受付番号</label>
                        <input type="text" name="ref" value="<?= htmlspecialchars($reference, ENT_QUOTES, 'UTF-8') ?>" placeholder="例: IKM-BIZ-260312-ABC123">
                    </div>
                    <div class="field">
                        <label>申込み時のメールアドレス</label>
                        <input type="email" name="email" value="<?= htmlspecialchars($email, ENT_QUOTES, 'UTF-8') ?>" placeholder="taro@example.co.jp">
                    </div>
                    <button class="btn btn-primary" type="submit">進み具合を見る</button>
                </form>
                <?php if ($searched && !$application): ?>
                    <p style="margin-top:14px;color:#b91c1c;font-size:14px;">受付番号かメールアドレスが一致しませんでした。</p>
                <?php endif; ?>
            </section>

            <section class="card">
                <h2 style="font-size:22px;font-weight:900;margin-bottom:12px;">進み方の目安</h2>
                <div class="muted">1営業日以内に初回連絡、その後は拠点境界の準備と立上げ案内へ進みます。</div>
                <div class="step-row">
                    <?php
                    $labels = ['受付', '確認', '初回連絡', '立上げ準備', '運用開始'];
                    foreach ($labels as $index => $label):
                        $stepNo = $index + 1;
                        $stateClass = $stepNo < $currentStep ? 'done' : ($stepNo === $currentStep ? 'active' : '');
                    ?>
                    <div class="step <?= $stateClass ?>">
                        <div class="num"><?= $stepNo ?></div>
                        <div style="font-size:12px;font-weight:800;line-height:1.5;"><?= htmlspecialchars($label) ?></div>
                    </div>
                    <?php endforeach; ?>
                </div>
            </section>
        </div>

        <?php if ($application): ?>
            <section class="card" style="margin-top:20px;">
                <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between;">
                    <div>
                        <div class="status-pill"><?= htmlspecialchars($statusLabel) ?></div>
                        <h2 style="margin-top:10px;font-size:28px;font-weight:900;"><?= htmlspecialchars($application['company'] ?? '') ?></h2>
                        <p class="muted"><?= htmlspecialchars($application['site_name'] ?? '') ?> / <?= htmlspecialchars(BusinessApplicationManager::planLabel((string)($application['plan'] ?? ''))) ?> プラン</p>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:12px;font-weight:800;color:var(--text-secondary);">受付番号</div>
                        <div style="font-size:22px;font-weight:900;"><?= htmlspecialchars($application['reference'] ?? '') ?></div>
                    </div>
                </div>
                <div style="margin-top:18px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
                    <div style="padding:16px;border-radius:16px;background:var(--surface);">
                        <div style="font-size:12px;font-weight:800;color:var(--text-secondary);">次の動き</div>
                        <div style="margin-top:6px;font-weight:800;"><?= htmlspecialchars($application['ops']['next_action'] ?? '初回連絡') ?></div>
                    </div>
                    <div style="padding:16px;border-radius:16px;background:var(--surface);">
                        <div style="font-size:12px;font-weight:800;color:var(--text-secondary);">目安日</div>
                        <div style="margin-top:6px;font-weight:800;"><?= htmlspecialchars($application['ops']['next_due_at'] ?? '-') ?></div>
                    </div>
                </div>
                <?php if ($claimMessage): ?>
                    <div style="margin-top:16px;padding:16px;border-radius:16px;background:<?= $claimType === 'success' ? '#ecfdf5' : '#fff1f2' ?>;color:<?= $claimType === 'success' ? '#166534' : '#be123c' ?>;font-size:14px;font-weight:700;">
                        <?= htmlspecialchars($claimMessage, ENT_QUOTES, 'UTF-8') ?>
                    </div>
                <?php endif; ?>
                <?php if ($workspaceCorpId !== ''): ?>
                    <div style="margin-top:18px;padding:18px;border-radius:16px;background:var(--surface);">
                        <div style="font-size:12px;font-weight:800;color:var(--text-secondary);">ワークスペース</div>
                        <div style="margin-top:8px;font-weight:800;">立上げが進んだら、団体側ワークスペースへそのまま入れます。</div>
                        <div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:12px;">
                            <?php if (!$currentUser): ?>
                                <a class="btn btn-primary" href="../login.php?redirect=<?= urlencode('for-business/status.php?ref=' . rawurlencode($reference) . '&email=' . rawurlencode($email)) ?>">ログインして受け取る</a>
                            <?php elseif ($canClaimWorkspace): ?>
                                <form method="post">
                                    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(CSRF::generate(), ENT_QUOTES, 'UTF-8') ?>">
                                    <button class="btn btn-primary" type="submit">このアカウントで受け取る</button>
                                </form>
                            <?php endif; ?>
                            <a class="btn btn-outline" href="../corporate_dashboard.php?corp=<?= urlencode($workspaceCorpId) ?>">ワークスペースを見る</a>
                        </div>
                    </div>
                <?php endif; ?>
            </section>
        <?php endif; ?>
    </main>
</body>
</html>
