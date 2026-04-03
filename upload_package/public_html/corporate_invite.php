<?php
ob_start();

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CSRF.php';
require_once __DIR__ . '/../libs/CorporateInviteManager.php';
require_once __DIR__ . '/../libs/CorporateManager.php';

Auth::init();
$token = trim((string)($_GET['token'] ?? ''));
$invite = $token !== '' ? CorporateInviteManager::findByToken($token) : null;
$currentUser = Auth::user();
$result = null;

if ($invite && $currentUser && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if (!CSRF::validate($_POST['csrf_token'] ?? '')) {
        $result = ['success' => false, 'message' => 'CSRF token が無効です。ページを再読み込みしてください。'];
    } else {
        $result = CorporateInviteManager::accept($token, $currentUser);
        $invite = CorporateInviteManager::findByToken($token);
    }
}

$corporation = $invite ? CorporateManager::get((string)($invite['corporation_id'] ?? '')) : null;
$meta_title = $corporation ? ((string)($corporation['name'] ?? '団体ワークスペース') . ' 招待') : '団体ワークスペース招待';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>.panel{background:rgba(255,255,255,.92);border:1px solid rgba(8,47,42,.08);border-radius:28px;box-shadow:0 16px 46px rgba(16,24,40,.06)}</style>
</head>
<body class="js-loading font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
<?php include 'components/nav.php'; ?>
<script nonce="<?= CspNonce::attr() ?>">document.body.classList.remove('js-loading');</script>
<main class="min-h-screen px-4 pb-20 pt-20 md:px-8">
    <div class="mx-auto max-w-2xl">
        <section class="panel p-8 md:p-10">
            <?php if (!$invite || !$corporation): ?>
                <h1 class="text-3xl font-black tracking-[-0.04em] text-[#10231f]">招待リンクが見つかりません</h1>
                <p class="mt-4 text-sm leading-8 text-slate-600">期限切れか、すでに無効化された可能性があります。招待した人に新しいリンクを発行してもらってください。</p>
            <?php else: ?>
                <div class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-emerald-700">Invitation</div>
                <h1 class="mt-4 text-3xl font-black tracking-[-0.04em] text-[#10231f]"><?= htmlspecialchars((string)($corporation['settings']['workspace_label'] ?? $corporation['name'] ?? '団体ワークスペース')) ?> に招待されています</h1>
                <p class="mt-4 text-sm leading-8 text-slate-600">このリンクは <strong><?= htmlspecialchars((string)($invite['email'] ?? '')) ?></strong> 宛てに発行されています。ログインすると、そのまま団体ワークスペースへ参加できます。</p>

                <div class="mt-5 grid gap-3 sm:grid-cols-2">
                    <div class="rounded-[22px] border border-[#082f2a]/8 bg-slate-50 p-4"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">参加ロール</div><div class="mt-2 text-2xl font-black text-[#10231f]"><?= htmlspecialchars((string)($invite['role'] ?? 'viewer')) ?></div></div>
                    <div class="rounded-[22px] border border-[#082f2a]/8 bg-slate-50 p-4"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">有効期限</div><div class="mt-2 text-2xl font-black text-[#10231f]"><?= htmlspecialchars(substr((string)($invite['expires_at'] ?? ''), 0, 10)) ?></div></div>
                </div>

                <?php if ($result): ?>
                    <div class="mt-5 rounded-[22px] border <?= !empty($result['success']) ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800' ?> p-5 text-sm leading-7">
                        <?= htmlspecialchars((string)($result['message'] ?? '')) ?>
                    </div>
                <?php endif; ?>

                <?php if (!$currentUser): ?>
                    <div class="mt-6 flex flex-wrap gap-3">
                        <a href="login.php?redirect=<?= urlencode('corporate_invite.php?token=' . $token) ?>" class="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#0f3d2e] px-6 text-sm font-bold text-white">ログインして参加</a>
                    </div>
                <?php elseif (($invite['status'] ?? '') === 'accepted'): ?>
                    <div class="mt-6 flex flex-wrap gap-3">
                        <a href="corporate_dashboard.php?corp=<?= urlencode((string)($corporation['id'] ?? '')) ?>" class="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#0f3d2e] px-6 text-sm font-bold text-white">ワークスペースを開く</a>
                    </div>
                <?php else: ?>
                    <form method="post" class="mt-6 flex flex-wrap gap-3">
                        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(CSRF::generate()) ?>">
                        <button type="submit" class="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#0f3d2e] px-6 text-sm font-bold text-white">このアカウントで参加する</button>
                    </form>
                <?php endif; ?>
            <?php endif; ?>
        </section>
    </div>
</main>
</body>
</html>
