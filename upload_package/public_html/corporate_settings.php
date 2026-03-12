<?php
ob_start();

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CSRF.php';
require_once __DIR__ . '/../libs/CorporateAccess.php';
require_once __DIR__ . '/../libs/CorporateManager.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    header('Location: login.php?redirect=' . urlencode('corporate_settings.php'));
    exit;
}

$currentUser = Auth::user();
$corporation = CorporateAccess::getPreferredCorporation($currentUser, trim((string)($_GET['corp'] ?? '')));
if (!$corporation) {
    http_response_code(403);
    exit('Access Denied.');
}

$corpId = (string)($corporation['id'] ?? '');
$canManage = CorporateAccess::canManageCorporation($corpId, $currentUser);
$statusType = null;
$statusMessage = null;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if (!CSRF::validate($_POST['csrf_token'] ?? '')) {
        $statusType = 'error';
        $statusMessage = 'CSRF token が無効です。ページを再読み込みしてください。';
    } elseif (!$canManage) {
        $statusType = 'error';
        $statusMessage = 'この操作を行う権限がありません。';
    } else {
        $action = (string)($_POST['action'] ?? '');
        if ($action === 'save_workspace') {
            $corporation = CorporateManager::updateSettings($corpId, [
                'workspace_label' => trim((string)($_POST['workspace_label'] ?? '')),
                'locale' => trim((string)($_POST['locale'] ?? 'ja')),
                'timezone' => trim((string)($_POST['timezone'] ?? 'Asia/Tokyo')),
            ], (string)($currentUser['id'] ?? '')) ?? $corporation;
            $statusType = 'success';
            $statusMessage = 'ワークスペース設定を更新しました。';
        } elseif ($action === 'pause_workspace') {
            $corporation = CorporateManager::updateLifecycle($corpId, [
                'status' => 'paused',
                'pause_reason' => trim((string)($_POST['pause_reason'] ?? '')),
                'note' => '一時停止の相談を受け付けました。',
            ], (string)($currentUser['id'] ?? '')) ?? $corporation;
            $statusType = 'success';
            $statusMessage = 'ワークスペースを一時停止扱いにしました。運営側にも確認しやすい状態になります。';
        } elseif ($action === 'resume_workspace') {
            $corporation = CorporateManager::updateLifecycle($corpId, [
                'status' => 'active',
                'pause_reason' => '',
                'note' => '一時停止を解除しました。',
            ], (string)($currentUser['id'] ?? '')) ?? $corporation;
            $statusType = 'success';
            $statusMessage = 'ワークスペースを運用中へ戻しました。';
        } elseif ($action === 'request_cancel') {
            $corporation = CorporateManager::updateLifecycle($corpId, [
                'status' => 'cancel_requested',
                'cancel_effective_at' => trim((string)($_POST['cancel_effective_at'] ?? '')),
                'archive_policy' => trim((string)($_POST['archive_policy'] ?? 'keep_public')),
                'note' => trim((string)($_POST['cancel_note'] ?? '')),
            ], (string)($currentUser['id'] ?? '')) ?? $corporation;
            $statusType = 'success';
            $statusMessage = '解約相談を受け付けました。観察データ自体はすぐには消えず、運営側で次の扱いを確認します。';
        }
    }
}

$lifecycle = $corporation['lifecycle'] ?? ['status' => 'active'];
$meta_title = ($corporation['settings']['workspace_label'] ?? $corporation['name'] ?? '団体ワークスペース') . ' 設定';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>.panel{background:rgba(255,255,255,.92);border:1px solid rgba(8,47,42,.08);border-radius:28px;box-shadow:0 16px 46px rgba(16,24,40,.06)}</style>
</head>
<body class="js-loading bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">
<?php include 'components/nav.php'; ?>
<script nonce="<?= CspNonce::attr() ?>">document.body.classList.remove('js-loading');</script>
<main class="min-h-screen px-4 pb-20 pt-20 md:px-8">
    <div class="mx-auto max-w-5xl space-y-6">
        <section class="panel bg-gradient-to-br from-emerald-950 via-[#0f3d2e] to-sky-900 p-6 text-white md:p-8">
            <div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/84">Workspace Settings</div>
                    <h1 class="mt-4 text-3xl font-black tracking-[-0.05em] md:text-5xl"><?= htmlspecialchars((string)($corporation['settings']['workspace_label'] ?? $corporation['name'] ?? '団体ワークスペース')) ?> の設定</h1>
                    <p class="mt-4 max-w-3xl text-sm leading-8 text-white/82">多言語・タイムゾーン・一時停止・解約相談をまとめて扱うページです。契約機能と観察データ自体は分けて扱います。</p>
                </div>
                <a href="corporate_dashboard.php?corp=<?= urlencode($corpId) ?>" class="inline-flex min-h-[52px] items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-[#0f3d2e]">ワークスペースへ戻る</a>
            </div>
        </section>

        <?php if ($statusMessage): ?>
            <div class="panel px-5 py-4 text-sm font-bold <?= $statusType === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700' ?>"><?= htmlspecialchars($statusMessage) ?></div>
        <?php endif; ?>

        <section class="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <section class="panel p-6 md:p-8">
                <div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Workspace</div>
                <h2 class="mt-4 text-2xl font-black tracking-[-0.04em] text-[#10231f]">表示名と言語設定</h2>
                <?php if (!$canManage): ?>
                    <div class="mt-5 rounded-[22px] border border-dashed border-[#082f2a]/12 bg-slate-50 p-5 text-sm leading-7 text-slate-500">表示はできますが、設定を変えられるのは Owner / Admin だけです。</div>
                <?php else: ?>
                <form method="post" class="mt-5 space-y-4">
                    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(CSRF::generate()) ?>">
                    <input type="hidden" name="action" value="save_workspace">
                    <div>
                        <label class="mb-1 block text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">ワークスペース表示名</label>
                        <input type="text" name="workspace_label" value="<?= htmlspecialchars((string)($corporation['settings']['workspace_label'] ?? '')) ?>" class="min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm focus:border-emerald-400 focus:outline-none">
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label class="mb-1 block text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Language</label>
                            <select name="locale" class="min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm focus:border-emerald-400 focus:outline-none">
                                <?php foreach (['ja' => '日本語', 'en' => 'English', 'es' => 'Español', 'pt' => 'Português'] as $value => $label): ?>
                                    <option value="<?= htmlspecialchars($value) ?>" <?= (($corporation['settings']['locale'] ?? 'ja') === $value) ? 'selected' : '' ?>><?= htmlspecialchars($label) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                        <div>
                            <label class="mb-1 block text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Timezone</label>
                            <select name="timezone" class="min-h-[52px] w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm focus:border-emerald-400 focus:outline-none">
                                <?php foreach (['Asia/Tokyo', 'UTC', 'Europe/London', 'America/Los_Angeles', 'Asia/Singapore'] as $timezone): ?>
                                    <option value="<?= htmlspecialchars($timezone) ?>" <?= (($corporation['settings']['timezone'] ?? 'Asia/Tokyo') === $timezone) ? 'selected' : '' ?>><?= htmlspecialchars($timezone) ?></option>
                                <?php endforeach; ?>
                            </select>
                        </div>
                    </div>
                    <button type="submit" class="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#0f3d2e] px-6 text-sm font-bold text-white">設定を保存</button>
                </form>
                <?php endif; ?>
            </section>

            <section class="panel p-6 md:p-8">
                <div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Lifecycle</div>
                <h2 class="mt-4 text-2xl font-black tracking-[-0.04em] text-[#10231f]">一時停止と解約相談</h2>
                <div class="mt-4 rounded-[22px] border border-[#082f2a]/8 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
                    現在の状態: <strong><?= htmlspecialchars(CorporateManager::lifecycleLabel((string)($lifecycle['status'] ?? 'active'))) ?></strong><br>
                    観察データは契約状態と分けて扱います。解約相談を送っても、その場で全部削除する設計にはしていません。
                </div>

                <?php if ($canManage): ?>
                <form method="post" class="mt-5 space-y-4 rounded-[24px] border border-[#082f2a]/8 bg-slate-50 p-5">
                    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(CSRF::generate()) ?>">
                    <input type="hidden" name="action" value="<?= (($lifecycle['status'] ?? 'active') === 'paused') ? 'resume_workspace' : 'pause_workspace' ?>">
                    <?php if (($lifecycle['status'] ?? 'active') !== 'paused'): ?>
                        <div>
                            <label class="mb-1 block text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">一時停止の理由</label>
                            <textarea name="pause_reason" class="min-h-[110px] w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none" placeholder="例: 現地運用をいったん止めたい / 担当者入れ替え待ち"><?= htmlspecialchars((string)($lifecycle['pause_reason'] ?? '')) ?></textarea>
                        </div>
                    <?php endif; ?>
                    <button type="submit" class="inline-flex min-h-[52px] items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700">
                        <?= (($lifecycle['status'] ?? 'active') === 'paused') ? '一時停止を解除' : '一時停止にする' ?>
                    </button>
                </form>

                <form method="post" class="mt-4 space-y-4 rounded-[24px] border border-rose-200 bg-rose-50 p-5">
                    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(CSRF::generate()) ?>">
                    <input type="hidden" name="action" value="request_cancel">
                    <div>
                        <label class="mb-1 block text-xs font-extrabold uppercase tracking-[0.16em] text-rose-700">解約希望日</label>
                        <input type="date" name="cancel_effective_at" value="<?= htmlspecialchars(substr((string)($lifecycle['cancel_effective_at'] ?? ''), 0, 10)) ?>" class="min-h-[52px] w-full rounded-2xl border border-rose-200 bg-white px-4 text-sm focus:border-rose-400 focus:outline-none">
                    </div>
                    <div>
                        <label class="mb-1 block text-xs font-extrabold uppercase tracking-[0.16em] text-rose-700">解約後の扱い</label>
                        <select name="archive_policy" class="min-h-[52px] w-full rounded-2xl border border-rose-200 bg-white px-4 text-sm focus:border-rose-400 focus:outline-none">
                            <?php foreach (['keep_public' => '公開情報は残す', 'make_private' => '組織情報は非公開にする', 'handover_requested' => '引き継ぎを相談したい'] as $value => $label): ?>
                                <option value="<?= htmlspecialchars($value) ?>" <?= (($lifecycle['archive_policy'] ?? 'keep_public') === $value) ? 'selected' : '' ?>><?= htmlspecialchars($label) ?></option>
                            <?php endforeach; ?>
                        </select>
                    </div>
                    <div>
                        <label class="mb-1 block text-xs font-extrabold uppercase tracking-[0.16em] text-rose-700">補足メモ</label>
                        <textarea name="cancel_note" class="min-h-[110px] w-full rounded-2xl border border-rose-200 bg-white px-4 py-3 text-sm focus:border-rose-400 focus:outline-none" placeholder="例: 年度末で契約を止めたい / まずデータを持ち帰りたい"><?= htmlspecialchars((string)($lifecycle['last_note'] ?? '')) ?></textarea>
                    </div>
                    <button type="submit" class="inline-flex min-h-[52px] items-center justify-center rounded-full bg-rose-600 px-6 text-sm font-bold text-white">解約相談を送る</button>
                </form>
                <?php else: ?>
                <div class="mt-5 rounded-[22px] border border-dashed border-[#082f2a]/12 bg-slate-50 p-5 text-sm leading-7 text-slate-500">一時停止や解約相談も Owner / Admin が送る前提です。必要なら管理メンバーに依頼してください。</div>
                <?php endif; ?>
            </section>
        </section>
    </div>
</main>
</body>
</html>
