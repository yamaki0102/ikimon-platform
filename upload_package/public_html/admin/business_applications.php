<?php

require_once __DIR__ . '/../../config/config.php';
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CSRF.php';
require_once __DIR__ . '/../../libs/BusinessApplicationManager.php';
require_once __DIR__ . '/../../libs/CorporateInviteManager.php';
require_once __DIR__ . '/../../libs/CorporateManager.php';

Auth::init();
Auth::requireRole('Analyst');
$currentUser = Auth::user();
$adminPage = 'applications';
$pendingFlags = 0;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!CSRF::validate($_POST['csrf_token'] ?? '')) {
        http_response_code(403);
        exit('Invalid CSRF token.');
    }
    $appId = trim((string)($_POST['application_id'] ?? ''));
    $action = trim((string)($_POST['action'] ?? ''));
    $actor = (string)($currentUser['name'] ?? $currentUser['id'] ?? 'admin');

    if ($appId !== '') {
        if ($action === 'workflow') {
            BusinessApplicationManager::updateWorkflow($appId, [
                'status' => $_POST['status'] ?? '',
                'owner' => $_POST['owner'] ?? '',
                'next_action' => $_POST['next_action'] ?? '',
                'next_due_at' => $_POST['next_due_at'] ?? '',
                'priority' => $_POST['priority'] ?? '',
            ], $actor);
        } elseif ($action === 'note') {
            BusinessApplicationManager::addNote($appId, (string)($_POST['note'] ?? ''), $actor);
        } elseif ($action === 'checklist') {
            BusinessApplicationManager::toggleChecklist($appId, (string)($_POST['check_key'] ?? ''), $actor);
        } elseif ($action === 'provision_corporation') {
            $updated = BusinessApplicationManager::provisionCorporation($appId, $actor);
            if ($updated) {
                BusinessApplicationManager::toggleChecklist($appId, 'corporation_created', $actor);
            }
        } elseif ($action === 'issue_owner_invite') {
            $selectedApplication = BusinessApplicationManager::findById($appId);
            $corpId = (string)($selectedApplication['workspace']['corporation_id'] ?? '');
            $inviteEmail = trim((string)($selectedApplication['email'] ?? ''));
            if ($corpId !== '' && $inviteEmail !== '') {
                $corporation = CorporateManager::get($corpId);
                $ownerExists = false;
                foreach (($corporation['members'] ?? []) as $member) {
                    if ((string)($member['role'] ?? '') === 'owner') {
                        $ownerExists = true;
                        break;
                    }
                }
                $pending = CorporateInviteManager::findExistingPending($corpId, $inviteEmail);
                if ($pending) {
                    CorporateInviteManager::revoke((string)($pending['id'] ?? ''), $actor);
                }
                CorporateInviteManager::create($corpId, $inviteEmail, $ownerExists ? 'admin' : 'owner', $actor);
            }
        }
    }

    $redirect = 'business_applications.php';
    if ($appId !== '') {
        $redirect .= '?app=' . urlencode($appId);
    }
    header('Location: ' . $redirect);
    exit;
}

$applications = BusinessApplicationManager::listAll();
$stats = BusinessApplicationManager::stats();
$selectedId = trim((string)($_GET['app'] ?? ($applications[0]['id'] ?? '')));
$selected = null;
foreach ($applications as $application) {
    if (($application['id'] ?? '') === $selectedId) {
        $selected = $application;
        break;
    }
}
if (!$selected && !empty($applications)) {
    $selected = $applications[0];
}

$searchIndex = array_map(static function (array $item): array {
    return [
        'id' => $item['id'] ?? '',
        'haystack' => mb_strtolower(implode(' ', [
            $item['reference'] ?? '',
            $item['company'] ?? '',
            $item['contact_name'] ?? '',
            $item['plan'] ?? '',
            $item['status_label'] ?? '',
            $item['site_name'] ?? '',
        ])),
    ];
}, $applications);

$csrfToken = CSRF::generate();
$selectedCorpId = (string)($selected['workspace']['corporation_id'] ?? '');
$selectedInvite = ($selectedCorpId !== '' && !empty($selected['email'])) ? CorporateInviteManager::findExistingPending($selectedCorpId, (string)$selected['email']) : null;
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php $adminTitle = 'B2B申込み管理'; include __DIR__ . '/components/head.php'; ?>
</head>
<body class="flex h-screen overflow-hidden" x-data="applicationInbox()">
    <?php include __DIR__ . '/components/sidebar.php'; ?>

    <main class="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-950">
        <div class="mx-auto max-w-7xl space-y-6">
            <section class="rounded-[30px] border border-white/10 bg-gradient-to-br from-emerald-950 via-slate-900 to-sky-950 p-6 md:p-8 shadow-2xl">
                <div class="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                    <div>
                        <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white/80">
                            <i data-lucide="inbox" class="h-4 w-4"></i>B2B Applications
                        </div>
                        <h1 class="mt-5 text-3xl font-black tracking-[-0.05em] text-white md:text-5xl">申込みから立上げまでを、1画面で捌く。</h1>
                        <p class="mt-4 max-w-3xl text-sm leading-8 text-slate-200 md:text-[15px]">明日から複数社の申込みが来ても、受付番号・次の動き・立上げチェックを一箇所で追えるようにします。メール受信箱を主システムにしないことが前提です。</p>
                    </div>
                    <div class="grid gap-4 sm:grid-cols-2">
                        <article class="rounded-[22px] border border-white/10 bg-white/5 p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">総申込み</div><div class="mt-3 text-3xl font-black text-white"><?= number_format($stats['total']) ?></div></article>
                        <article class="rounded-[22px] border border-white/10 bg-white/5 p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">今日見るもの</div><div class="mt-3 text-3xl font-black text-amber-300"><?= number_format($stats['due_today']) ?></div></article>
                        <article class="rounded-[22px] border border-white/10 bg-white/5 p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Public</div><div class="mt-3 text-3xl font-black text-emerald-300"><?= number_format($stats['public']) ?></div></article>
                        <article class="rounded-[22px] border border-white/10 bg-white/5 p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">相談</div><div class="mt-3 text-3xl font-black text-sky-300"><?= number_format($stats['consultation'] ?? 0) ?></div></article>
                    </div>
                </div>
            </section>

            <section class="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
                <article class="glass-panel rounded-[28px] p-6 md:p-8">
                    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <div class="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-emerald-300"><i data-lucide="folders" class="h-4 w-4"></i>Application Queue</div>
                            <h2 class="mt-4 text-2xl font-black tracking-[-0.04em] text-white">受付一覧</h2>
                            <p class="mt-2 text-sm leading-7 text-slate-300">会社名、受付番号、プラン、ステータスで絞れます。</p>
                        </div>
                        <input x-model.trim="search" type="text" placeholder="会社名・受付番号・担当者で検索" class="w-full md:w-72 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400/30 focus:outline-none">
                    </div>
                    <div class="mt-6 space-y-3">
                        <?php foreach ($applications as $application): ?>
                            <?php
                            $status = (string)($application['status'] ?? 'new');
                            $tone = in_array($status, ['new', 'reviewing'], true) ? 'amber' : (in_array($status, ['onboarding', 'active'], true) ? 'emerald' : 'slate');
                            $badge = $tone === 'amber' ? 'border-amber-400/20 bg-amber-400/12 text-amber-300' : ($tone === 'emerald' ? 'border-emerald-400/20 bg-emerald-400/12 text-emerald-300' : 'border-white/10 bg-white/5 text-slate-300');
                            $isSelected = (($selected['id'] ?? '') === ($application['id'] ?? ''));
                            $haystack = mb_strtolower(implode(' ', [
                                $application['reference'] ?? '',
                                $application['company'] ?? '',
                                $application['contact_name'] ?? '',
                                $application['plan'] ?? '',
                                $application['status_label'] ?? '',
                                $application['site_name'] ?? '',
                            ]));
                            ?>
                            <a href="?app=<?= urlencode((string)($application['id'] ?? '')) ?>" x-show="matches('<?= htmlspecialchars($haystack, ENT_QUOTES, 'UTF-8') ?>')" class="block rounded-[24px] border <?= $isSelected ? 'border-emerald-400/30 bg-emerald-400/8' : 'border-white/8 bg-slate-950/30' ?> p-5 transition hover:-translate-y-0.5">
                                <div class="flex items-start justify-between gap-3">
                                    <div>
                                        <div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400"><?= htmlspecialchars($application['reference'] ?? '') ?></div>
                                        <div class="mt-2 text-xl font-black text-white"><?= htmlspecialchars($application['company'] ?? '') ?></div>
                                        <p class="mt-1 text-sm leading-7 text-slate-300"><?= htmlspecialchars($application['site_name'] ?? '') ?> / <?= htmlspecialchars($application['contact_name'] ?? '') ?></p>
                                    </div>
                                    <span class="rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] <?= $badge ?>"><?= htmlspecialchars($application['status_label'] ?? '') ?></span>
                                </div>
                                <div class="mt-4 grid gap-2 sm:grid-cols-3">
                                    <div class="rounded-[18px] border border-white/8 bg-white/5 p-3"><div class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">プラン</div><div class="mt-1 text-lg font-black text-white"><?= htmlspecialchars(BusinessApplicationManager::planLabel((string)($application['plan'] ?? ''))) ?></div></div>
                                    <div class="rounded-[18px] border border-white/8 bg-white/5 p-3"><div class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">次の動き</div><div class="mt-1 text-sm font-bold text-white"><?= htmlspecialchars($application['ops']['next_action'] ?? '-') ?></div></div>
                                    <div class="rounded-[18px] border border-white/8 bg-white/5 p-3"><div class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">期日</div><div class="mt-1 text-sm font-bold text-white"><?= htmlspecialchars($application['ops']['next_due_at'] ?? '-') ?></div></div>
                                </div>
                            </a>
                        <?php endforeach; ?>
                        <?php if (count($applications) === 0): ?>
                            <div class="rounded-[24px] border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-300">まだ申込みはありません。</div>
                        <?php endif; ?>
                    </div>
                </article>

                <article class="glass-panel rounded-[28px] p-6 md:p-8">
                    <?php if ($selected): ?>
                        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                            <div>
                                <div class="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-sky-300"><i data-lucide="clipboard-list" class="h-4 w-4"></i>Selected Application</div>
                                <h2 class="mt-4 text-2xl font-black tracking-[-0.04em] text-white"><?= htmlspecialchars($selected['company'] ?? '') ?></h2>
                                <p class="mt-2 text-sm leading-7 text-slate-300"><?= htmlspecialchars($selected['contact_name'] ?? '') ?> / <?= htmlspecialchars($selected['email'] ?? '') ?> / <?= htmlspecialchars($selected['site_name'] ?? '') ?></p>
                            </div>
                            <div class="rounded-[20px] border border-white/10 bg-white/5 px-4 py-3 text-right">
                                <div class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">受付番号</div>
                                <div class="mt-1 text-xl font-black text-white"><?= htmlspecialchars($selected['reference'] ?? '') ?></div>
                            </div>
                        </div>

                        <div class="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div class="rounded-[22px] border border-white/8 bg-slate-950/30 p-4"><div class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">プラン</div><div class="mt-2 text-2xl font-black text-white"><?= htmlspecialchars(BusinessApplicationManager::planLabel((string)($selected['plan'] ?? ''))) ?></div></div>
                            <div class="rounded-[22px] border border-white/8 bg-slate-950/30 p-4"><div class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">開始時期</div><div class="mt-2 text-xl font-black text-white"><?= htmlspecialchars(BusinessApplicationManager::expectedStartLabel((string)($selected['expected_start'] ?? ''))) ?></div></div>
                            <div class="rounded-[22px] border border-white/8 bg-slate-950/30 p-4"><div class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">想定拠点</div><div class="mt-2 text-xl font-black text-white"><?= htmlspecialchars(BusinessApplicationManager::siteCountLabel((string)($selected['planned_site_count'] ?? ''))) ?></div></div>
                            <div class="rounded-[22px] border border-white/8 bg-slate-950/30 p-4"><div class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">現在ステータス</div><div class="mt-2 text-xl font-black text-white"><?= htmlspecialchars((string)($selected['status_label'] ?? '-')) ?></div></div>
                        </div>

                        <div class="mt-6 grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
                            <form method="POST" class="rounded-[24px] border border-white/8 bg-slate-950/30 p-5 space-y-4">
                                <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
                                <input type="hidden" name="application_id" value="<?= htmlspecialchars((string)($selected['id'] ?? ''), ENT_QUOTES, 'UTF-8') ?>">
                                <input type="hidden" name="action" value="workflow">
                                <div class="text-lg font-black text-white">次の動きを更新</div>
                                <div>
                                    <label class="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">ステータス</label>
                                    <select name="status" class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                                        <?php foreach (['new', 'reviewing', 'contacted', 'onboarding', 'active', 'closed'] as $status): ?>
                                            <option value="<?= $status ?>" <?= (($selected['status'] ?? '') === $status) ? 'selected' : '' ?>><?= htmlspecialchars(BusinessApplicationManager::statusLabel($status)) ?></option>
                                        <?php endforeach; ?>
                                    </select>
                                </div>
                                <div>
                                    <label class="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">担当</label>
                                    <input type="text" name="owner" value="<?= htmlspecialchars((string)($selected['ops']['owner'] ?? ''), ENT_QUOTES, 'UTF-8') ?>" class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                                </div>
                                <div>
                                    <label class="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">次の動き</label>
                                    <input type="text" name="next_action" value="<?= htmlspecialchars((string)($selected['ops']['next_action'] ?? ''), ENT_QUOTES, 'UTF-8') ?>" class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                                </div>
                                <div class="grid gap-3 sm:grid-cols-2">
                                    <div>
                                        <label class="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">期日</label>
                                        <input type="date" name="next_due_at" value="<?= htmlspecialchars((string)($selected['ops']['next_due_at'] ?? ''), ENT_QUOTES, 'UTF-8') ?>" class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                                    </div>
                                    <div>
                                        <label class="mb-1 block text-xs font-bold uppercase tracking-[0.14em] text-slate-400">優先度</label>
                                        <select name="priority" class="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white">
                                            <?php foreach (['low' => 'low', 'normal' => 'normal', 'high' => 'high'] as $value => $label): ?>
                                                <option value="<?= $value ?>" <?= (($selected['priority'] ?? '') === $value) ? 'selected' : '' ?>><?= htmlspecialchars($label) ?></option>
                                            <?php endforeach; ?>
                                        </select>
                                    </div>
                                </div>
                                <button class="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-emerald-400">更新を保存</button>
                            </form>

                            <div class="space-y-4">
                                <form method="POST" class="rounded-[24px] border border-white/8 bg-slate-950/30 p-5">
                                    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
                                    <input type="hidden" name="application_id" value="<?= htmlspecialchars((string)($selected['id'] ?? ''), ENT_QUOTES, 'UTF-8') ?>">
                                    <input type="hidden" name="action" value="note">
                                    <div class="text-lg font-black text-white">運用メモ</div>
                                    <textarea name="note" rows="4" class="mt-3 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500" placeholder="初回連絡で確認したこと、次回までの宿題、運用メモなど"></textarea>
                                    <button class="mt-3 inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:border-emerald-400/30 hover:bg-emerald-400/10">メモを追加</button>
                                </form>

                                <form method="POST" class="rounded-[24px] border border-white/8 bg-slate-950/30 p-5">
                                    <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
                                    <input type="hidden" name="application_id" value="<?= htmlspecialchars((string)($selected['id'] ?? ''), ENT_QUOTES, 'UTF-8') ?>">
                                    <input type="hidden" name="action" value="provision_corporation">
                                    <div class="text-lg font-black text-white">初期セットアップ</div>
                                    <p class="mt-2 text-sm leading-7 text-slate-300">契約団体レコードを先に作って、立上げを mail だけに依存しない流れにします。</p>
                                    <div class="mt-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300">
                                        <?= !empty($selected['workspace']['corporation_id']) ? '契約団体ID: ' . htmlspecialchars((string)$selected['workspace']['corporation_id']) : 'まだ契約団体は作られていません。' ?>
                                    </div>
                                    <button class="mt-3 inline-flex items-center justify-center rounded-2xl bg-sky-500 px-4 py-3 text-sm font-black text-slate-950 transition hover:bg-sky-400" <?= !empty($selected['workspace']['corporation_id']) ? 'disabled style="opacity:.5;cursor:not-allowed;"' : '' ?>>契約団体を作る</button>
                                </form>

                                <div class="rounded-[24px] border border-white/8 bg-slate-950/30 p-5">
                                    <div class="text-lg font-black text-white">申込み担当者を受け入れる</div>
                                    <p class="mt-2 text-sm leading-7 text-slate-300">契約団体を作ったあと、そのまま担当者に招待リンクを渡せます。メール運用だけに戻さないための導線です。</p>
                                    <div class="mt-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3 text-sm text-slate-300">
                                        <?= $selectedCorpId !== '' ? 'ワークスペースID: ' . htmlspecialchars($selectedCorpId) : 'まず契約団体を作ると、この申込みから招待リンクを発行できます。'; ?>
                                    </div>
                                    <?php if ($selectedInvite): ?>
                                        <div class="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">
                                            <div class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-300">最新の招待リンク</div>
                                            <div class="mt-2 break-all text-xs leading-6 text-emerald-50"><?= htmlspecialchars((string)($selectedInvite['accept_url'] ?? '')) ?></div>
                                            <div class="mt-2 text-xs text-emerald-200">有効期限: <?= htmlspecialchars((string)($selectedInvite['expires_at'] ?? '-')) ?></div>
                                        </div>
                                    <?php endif; ?>
                                    <div class="mt-3 flex flex-wrap gap-3">
                                        <form method="POST">
                                            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
                                            <input type="hidden" name="application_id" value="<?= htmlspecialchars((string)($selected['id'] ?? ''), ENT_QUOTES, 'UTF-8') ?>">
                                            <input type="hidden" name="action" value="issue_owner_invite">
                                            <button class="inline-flex items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-black text-emerald-200 transition hover:bg-emerald-400/18" <?= $selectedCorpId === '' ? 'disabled style="opacity:.5;cursor:not-allowed;"' : '' ?>>招待リンクを発行</button>
                                        </form>
                                        <?php if ($selectedCorpId !== ''): ?>
                                            <a href="../corporate_dashboard.php?corp=<?= urlencode($selectedCorpId) ?>" class="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:border-sky-400/30 hover:bg-sky-400/10">ワークスペースを見る</a>
                                            <a href="../corporate_members.php?corp=<?= urlencode($selectedCorpId) ?>" class="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white transition hover:border-sky-400/30 hover:bg-sky-400/10">招待一覧へ</a>
                                        <?php endif; ?>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="mt-6 grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
                            <div class="rounded-[24px] border border-white/8 bg-slate-950/30 p-5">
                                <div class="text-lg font-black text-white">立上げチェック</div>
                                <div class="mt-4 space-y-3">
                                    <?php foreach (($selected['checklist'] ?? []) as $step): ?>
                                        <form method="POST" class="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/5 px-4 py-3">
                                            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars($csrfToken, ENT_QUOTES, 'UTF-8') ?>">
                                            <input type="hidden" name="application_id" value="<?= htmlspecialchars((string)($selected['id'] ?? ''), ENT_QUOTES, 'UTF-8') ?>">
                                            <input type="hidden" name="action" value="checklist">
                                            <input type="hidden" name="check_key" value="<?= htmlspecialchars((string)($step['key'] ?? ''), ENT_QUOTES, 'UTF-8') ?>">
                                            <button class="h-10 w-10 shrink-0 rounded-full border <?= !empty($step['done']) ? 'border-emerald-400 bg-emerald-400 text-slate-950' : 'border-white/15 bg-transparent text-white' ?> text-sm font-black"><?= !empty($step['done']) ? '✓' : '○' ?></button>
                                            <div class="flex-1">
                                                <div class="text-sm font-bold text-white"><?= htmlspecialchars((string)($step['label'] ?? '')) ?></div>
                                                <div class="text-xs text-slate-400"><?= !empty($step['updated_at']) ? htmlspecialchars((string)$step['updated_at']) : '未対応' ?></div>
                                            </div>
                                        </form>
                                    <?php endforeach; ?>
                                </div>
                            </div>

                            <div class="rounded-[24px] border border-white/8 bg-slate-950/30 p-5">
                                <div class="text-lg font-black text-white">タイムライン</div>
                                <div class="mt-4 space-y-3">
                                    <?php foreach (array_reverse($selected['timeline'] ?? []) as $event): ?>
                                        <div class="rounded-2xl border border-white/8 bg-white/5 p-4">
                                            <div class="flex items-center justify-between gap-3">
                                                <div class="text-sm font-black text-white"><?= htmlspecialchars((string)($event['label'] ?? '')) ?></div>
                                                <div class="text-xs text-slate-400"><?= htmlspecialchars((string)($event['at'] ?? '')) ?></div>
                                            </div>
                                            <div class="mt-2 text-sm leading-7 text-slate-300"><?= htmlspecialchars((string)($event['note'] ?? '')) ?></div>
                                            <div class="mt-1 text-xs text-slate-500"><?= htmlspecialchars((string)($event['by'] ?? 'system')) ?></div>
                                        </div>
                                    <?php endforeach; ?>
                                </div>
                            </div>
                        </div>
                    <?php else: ?>
                        <div class="rounded-[24px] border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-300">申込みが入るとここに詳細が出ます。</div>
                    <?php endif; ?>
                </article>
            </section>
        </div>
    </main>
    <script nonce="<?= CspNonce::attr() ?>">
        function applicationInbox(){
            return {
                search: '',
                index: <?= json_encode($searchIndex, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>,
                matches(haystack) {
                    const q = (this.search || '').trim().toLowerCase();
                    return !q || haystack.includes(q);
                }
            }
        }
        if (window.lucide) { window.lucide.createIcons(); }
    </script>
</body>
</html>
