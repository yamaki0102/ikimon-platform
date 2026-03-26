<?php

require_once __DIR__ . '/../../config/config.php';
require_once ROOT_DIR . '/libs/Auth.php';
require_once ROOT_DIR . '/libs/CspNonce.php';
require_once ROOT_DIR . '/libs/CSRF.php';
require_once ROOT_DIR . '/libs/CorporateManager.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    header('Location: ../login.php?redirect=' . urlencode('for-business/create.php'));
    exit;
}

$currentUser = Auth::user();
$csrfToken = CSRF::generate();
$error = '';
$defaultName = trim((string)($currentUser['organization'] ?? $currentUser['name'] ?? ''));

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if (!CSRF::validate($_POST['csrf_token'] ?? '')) {
        $error = 'ページを再読み込みして、もう一度お試しください。';
    } else {
        $organizationName = trim((string)($_POST['organization_name'] ?? ''));
        $workspaceLabel = trim((string)($_POST['workspace_label'] ?? ''));

        if ($organizationName === '') {
            $error = '団体名を入力してください。';
        } else {
            $corpId = CorporateManager::register($organizationName, 'community');
            CorporateManager::addMember($corpId, (string)($currentUser['id'] ?? ''), 'owner');
            if ($workspaceLabel !== '' && $workspaceLabel !== $organizationName) {
                CorporateManager::updateSettings($corpId, ['workspace_label' => $workspaceLabel], (string)($currentUser['name'] ?? $currentUser['id'] ?? 'system'));
            }

            header('Location: ../corporate_dashboard.php?corp=' . urlencode($corpId) . '&welcome=1');
            exit;
        }
    }
}

CspNonce::sendHeader();
$meta_title = '無料で団体ワークスペースを作成';
$meta_description = '申込みなしで、無料の団体ワークスペースをその場で作れます。観察会、スポット登録、運営用の概要確認まで無料で開始できます。';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/../components/meta.php'; ?>
    <style nonce="<?= CspNonce::attr() ?>">
        .shell{min-height:100vh;background:radial-gradient(circle at top left,rgba(16,185,129,.10),transparent 32%),linear-gradient(180deg,#f8faf7 0%,#eef6f2 100%)}
        .panel{background:rgba(255,255,255,.92);border:1px solid rgba(15,23,42,.08);border-radius:28px;box-shadow:0 24px 60px rgba(15,23,42,.08)}
        .field{display:grid;gap:8px}
        .label{font-size:12px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#64748b}
        .input{min-height:52px;border-radius:18px;border:1px solid rgba(15,23,42,.12);padding:0 16px;font:inherit;background:#fff}
        .input:focus{outline:none;border-color:#10b981;box-shadow:0 0 0 4px rgba(16,185,129,.12)}
        .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:52px;padding:0 22px;border-radius:999px;font-size:14px;font-weight:900;text-decoration:none;border:none;cursor:pointer}
        .btn-primary{background:linear-gradient(135deg,#0b6b50,#10b981);color:#fff;box-shadow:0 12px 28px rgba(16,185,129,.24)}
        .btn-secondary{background:#fff;color:#10231f;border:1px solid rgba(15,23,42,.12)}
    </style>
</head>
<body class="shell text-[var(--color-text)] font-body">
<?php include __DIR__ . '/../components/nav.php'; ?>
<main class="px-4 pb-20 pt-20 md:px-8">
    <div class="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section class="panel p-6 md:p-8">
            <div class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-emerald-700">
                <i data-lucide="building-2" class="h-4 w-4"></i>Community Workspace
            </div>
            <h1 class="mt-5 text-3xl font-black tracking-[-0.05em] text-[#10231f] md:text-5xl">無料の団体ページを、その場で作る。</h1>
            <p class="mt-4 max-w-2xl text-sm leading-8 text-slate-600 md:text-[15px]">
                申込みや審査を待たずに、団体ワークスペースを今すぐ作れます。スポット登録、観察会開催、参加人数や発見種数の概要確認までは無料です。
            </p>
            <form method="post" class="mt-8 space-y-5">
                <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
                <div class="field">
                    <label class="label" for="organization_name">団体名</label>
                    <input class="input" id="organization_name" name="organization_name" value="<?= htmlspecialchars((string)($_POST['organization_name'] ?? $defaultName), ENT_QUOTES, 'UTF-8') ?>" placeholder="例: 浜松みどり観察会" maxlength="80" required>
                </div>
                <div class="field">
                    <label class="label" for="workspace_label">表示名（任意）</label>
                    <input class="input" id="workspace_label" name="workspace_label" value="<?= htmlspecialchars((string)($_POST['workspace_label'] ?? ''), ENT_QUOTES, 'UTF-8') ?>" placeholder="例: みどり観察会ワークスペース" maxlength="80">
                </div>
                <?php if ($error !== ''): ?>
                    <div class="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
                        <?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?>
                    </div>
                <?php endif; ?>
                <div class="flex flex-col gap-3 sm:flex-row">
                    <button type="submit" class="btn btn-primary"><i data-lucide="sparkles" class="h-4 w-4"></i>無料でワークスペースを作成</button>
                    <a href="apply.php" class="btn btn-secondary"><i data-lucide="messages-square" class="h-4 w-4"></i>Public を相談</a>
                </div>
            </form>
        </section>

        <aside class="space-y-4">
            <section class="panel p-6 md:p-8">
                <h2 class="text-2xl font-black tracking-[-0.04em] text-[#10231f]">無料でできること</h2>
                <ul class="mt-5 space-y-3 text-sm leading-7 text-slate-600">
                    <li>団体ページを作って、メンバーを集める</li>
                    <li>スポットを登録して、観察会を開く</li>
                    <li>観察数、参加人数、発見種数、分類群の概要を確認する</li>
                </ul>
            </section>
            <section class="panel p-6 md:p-8">
                <h2 class="text-2xl font-black tracking-[-0.04em] text-[#10231f]">Public で解放されること</h2>
                <ul class="mt-5 space-y-3 text-sm leading-7 text-slate-600">
                    <li>完全な種一覧と要配慮種の詳細表示</li>
                    <li>CSV、証跡JSON、各種レポートの出力</li>
                    <li>調査・報告向けの継続運用とサポート</li>
                </ul>
            </section>
        </aside>
    </div>
</main>
</body>
</html>
