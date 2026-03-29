<?php
ob_start();

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CSRF.php';
require_once __DIR__ . '/../libs/CorporateAccess.php';
require_once __DIR__ . '/../libs/CorporateInviteManager.php';
require_once __DIR__ . '/../libs/CorporateManager.php';
require_once __DIR__ . '/../libs/SiteManager.php';
require_once __DIR__ . '/../libs/UserStore.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    header('Location: login.php?redirect=' . urlencode('corporate_members.php'));
    exit;
}

$currentUser = Auth::user();
$corpId = trim((string)($_GET['corp'] ?? ''));
$siteId = trim((string)($_GET['site'] ?? ''));
if ($corpId === '' && $siteId !== '') {
    $corpId = (string)(CorporateAccess::resolveCorporationIdForSite($siteId) ?? '');
}
$corporation = CorporateAccess::getPreferredCorporation($currentUser, $corpId);
if (!$corporation) {
    http_response_code(403);
    exit('Access Denied.');
}

$corpId = (string)($corporation['id'] ?? '');
$canManage = CorporateAccess::canManageCorporation($corpId, $currentUser);
$roleOptions = ['owner' => 'Owner', 'admin' => 'Admin', 'editor' => 'Editor', 'viewer' => 'Viewer'];
$statusType = null;
$statusMessage = null;
$freshInvite = null;

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if (!CSRF::validate($_POST['csrf_token'] ?? '')) {
        $statusType = 'error';
        $statusMessage = 'CSRF token が無効です。ページを再読み込みしてください。';
    } elseif (!$canManage) {
        $statusType = 'error';
        $statusMessage = 'この操作を行う権限がありません。';
    } else {
        $action = (string)($_POST['action'] ?? '');
        if ($action === 'issue_invite') {
            $email = trim((string)($_POST['email'] ?? ''));
            $role = (string)($_POST['role'] ?? 'viewer');
            $existingUser = UserStore::findByEmail($email);
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $statusType = 'error';
                $statusMessage = 'メールアドレスの形式が正しくありません。';
            } elseif (!isset($roleOptions[$role])) {
                $statusType = 'error';
                $statusMessage = 'ロール指定が不正です。';
            } elseif ($existingUser && isset(($corporation['members'] ?? [])[(string)$existingUser['id']])) {
                $statusType = 'error';
                $statusMessage = 'そのメールアドレスの人は、すでにこの団体に参加しています。';
            } else {
                $pending = CorporateInviteManager::findExistingPending($corpId, $email);
                if ($pending) {
                    CorporateInviteManager::revoke((string)($pending['id'] ?? ''), (string)($currentUser['id'] ?? ''));
                }
                $freshInvite = CorporateInviteManager::create($corpId, $email, $role, (string)($currentUser['id'] ?? ''));
                if ($freshInvite) {
                    $statusType = 'success';
                    $statusMessage = '招待リンクを発行しました。リンクをそのまま相手に共有できます。';
                } else {
                    $statusType = 'error';
                    $statusMessage = '招待リンクの発行に失敗しました。';
                }
            }
        } elseif ($action === 'update_role') {
            $memberId = (string)($_POST['member_id'] ?? '');
            $role = (string)($_POST['role'] ?? 'viewer');
            if (!isset($roleOptions[$role])) {
                $statusType = 'error';
                $statusMessage = 'ロール指定が不正です。';
            } elseif (CorporateManager::updateMemberRole($corpId, $memberId, $role)) {
                $statusType = 'success';
                $statusMessage = '団体内ロールを更新しました。';
            } else {
                $statusType = 'error';
                $statusMessage = 'ロール更新に失敗しました。';
            }
        } elseif ($action === 'remove_member') {
            $memberId = (string)($_POST['member_id'] ?? '');
            $myRole = CorporateAccess::getUserCorpRole($corpId, $currentUser);
            if ($memberId === (string)($currentUser['id'] ?? '') && $myRole === 'owner') {
                $statusType = 'error';
                $statusMessage = 'Owner は自分自身を外せません。';
            } elseif (CorporateManager::removeMember($corpId, $memberId)) {
                $statusType = 'success';
                $statusMessage = 'メンバーを団体から外しました。';
            } else {
                $statusType = 'error';
                $statusMessage = 'メンバー削除に失敗しました。';
            }
        } elseif ($action === 'revoke_invite') {
            $inviteId = (string)($_POST['invite_id'] ?? '');
            $revoked = CorporateInviteManager::revoke($inviteId, (string)($currentUser['id'] ?? ''));
            if ($revoked) {
                $statusType = 'success';
                $statusMessage = '招待リンクを無効化しました。';
            } else {
                $statusType = 'error';
                $statusMessage = '招待リンクの無効化に失敗しました。';
            }
        }
    }
    $corporation = CorporateManager::get($corpId) ?? $corporation;
}

$sites = SiteManager::getByOwnerOrg($corpId);
if (empty($sites)) {
    foreach (SiteManager::listAll(true) as $site) {
        if (trim((string)($site['owner'] ?? '')) === trim((string)($corporation['name'] ?? ''))) {
            $sites[] = $site;
        }
    }
}
$focusSiteId = $siteId !== '' ? $siteId : (string)($sites[0]['id'] ?? '');
$pendingInvites = CorporateInviteManager::listByCorporation($corpId, 'pending');
$members = [];
foreach ($corporation['members'] ?? [] as $memberId => $memberMeta) {
    $user = UserStore::findById((string)$memberId);
    $members[] = [
        'id' => (string)$memberId,
        'name' => (string)($user['name'] ?? 'Unknown User'),
        'email' => (string)($user['email'] ?? 'メール未設定'),
        'avatar' => (string)($user['avatar'] ?? ''),
        'platform_role' => (string)($user['role'] ?? 'Observer'),
        'corp_role' => (string)($memberMeta['role'] ?? 'viewer'),
        'joined_at' => (string)($memberMeta['joined_at'] ?? ''),
    ];
}

$meta_title = ($corporation['settings']['workspace_label'] ?? $corporation['name'] ?? '契約団体') . ' メンバー管理';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>.panel{background:rgba(255,255,255,.9);border:1px solid rgba(8,47,42,.08);border-radius:28px;box-shadow:0 16px 46px rgba(16,24,40,.06)}</style>
</head>
<body class="js-loading bg-base text-text font-body">
<?php include 'components/nav.php'; ?>
<script nonce="<?= CspNonce::attr() ?>">document.body.classList.remove('js-loading');</script>
<main class="min-h-screen px-4 pb-20 pt-20 md:px-8">
    <div class="mx-auto max-w-6xl space-y-6">
        <section class="panel bg-gradient-to-br from-emerald-950 via-[#0f3d2e] to-sky-900 p-6 text-white md:p-8">
            <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <div class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/84">Member Workspace</div>
                    <h1 class="mt-4 text-3xl font-black tracking-[-0.05em] md:text-5xl"><?= htmlspecialchars((string)($corporation['settings']['workspace_label'] ?? $corporation['name'] ?? '契約団体')) ?>のメンバー管理</h1>
                    <p class="mt-4 max-w-3xl text-sm leading-8 text-white/82">既存アカウントの有無に関係なく、メールアドレスごとに招待リンクを発行できます。複数管理アカウント運用を前提にした入口です。</p>
                </div>
                <div class="flex flex-wrap gap-3">
                    <a href="corporate_dashboard.php?corp=<?= urlencode($corpId) ?>" class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-[#0f3d2e]">ワークスペースへ</a>
                    <a href="<?= $focusSiteId !== '' ? 'site_dashboard.php?site=' . urlencode($focusSiteId) : 'site_dashboard.php' ?>" class="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-5 text-sm font-bold text-white">記録ボードへ</a>
                </div>
            </div>
        </section>

        <?php if ($statusMessage): ?>
            <div class="panel px-5 py-4 text-sm font-bold <?= $statusType === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700' ?>">
                <?= htmlspecialchars($statusMessage) ?>
            </div>
        <?php endif; ?>

        <?php if ($freshInvite): ?>
            <section class="panel border-emerald-200 bg-emerald-50 p-5">
                <div class="text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">招待リンク</div>
                <p class="mt-2 text-sm leading-7 text-emerald-900">このリンクをそのまま共有してください。相手は既存アカウントでも新規アカウントでも参加できます。</p>
                <div class="mt-3 rounded-2xl border border-emerald-200 bg-white p-4 text-sm break-all text-slate-700"><?= htmlspecialchars((string)($freshInvite['accept_url'] ?? '')) ?></div>
            </section>
        <?php endif; ?>

        <section class="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <aside class="panel p-6 md:p-8">
                <div class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-emerald-700">Invite</div>
                <h2 class="mt-4 text-2xl font-black tracking-[-0.04em] text-[#12231f]">メンバーを招待</h2>
                <p class="mt-3 text-sm leading-7 text-slate-600">管理メンバー 5 人までが目安です。現場担当・確認役・公開前チェック役を分けると、継続運用しやすくなります。</p>
                <?php if ($canManage): ?>
                    <form method="post" class="mt-5 grid gap-3 rounded-[24px] border border-[#082f2a]/8 bg-slate-50 p-5">
                        <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(CSRF::generate()) ?>">
                        <input type="hidden" name="action" value="issue_invite">
                        <input type="email" name="email" required placeholder="招待したいメールアドレス" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none">
                        <select name="role" class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-400 focus:outline-none">
                            <?php foreach ($roleOptions as $roleValue => $roleLabel): ?>
                                <option value="<?= htmlspecialchars($roleValue) ?>"><?= htmlspecialchars($roleLabel) ?></option>
                            <?php endforeach; ?>
                        </select>
                        <button type="submit" class="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#0f3d2e] px-5 text-sm font-bold text-white">招待リンクを発行</button>
                    </form>
                <?php else: ?>
                    <div class="mt-5 rounded-[22px] border border-dashed border-[#082f2a]/12 bg-slate-50 p-5 text-sm leading-7 text-slate-500">招待できるのは Owner / Admin だけです。ロール変更や招待リンク発行は管理メンバーに依頼してください。</div>
                <?php endif; ?>

                <div class="mt-6">
                    <div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">招待待ち</div>
                    <div class="mt-3 space-y-3">
                        <?php foreach ($pendingInvites as $invite): ?>
                            <article class="rounded-[22px] border border-[#082f2a]/8 bg-white p-4">
                                <div class="flex items-start justify-between gap-3">
                                    <div>
                                        <div class="text-sm font-black text-[#12231f]"><?= htmlspecialchars((string)($invite['email'] ?? '')) ?></div>
                                        <div class="mt-1 text-xs uppercase tracking-[0.16em] text-slate-400"><?= htmlspecialchars((string)($invite['role'] ?? 'viewer')) ?> / <?= htmlspecialchars((string)($invite['expires_at'] ?? '')) ?>まで有効</div>
                                        <?php if (!empty($invite['accept_url'])): ?>
                                            <div class="mt-2 break-all text-xs text-slate-500"><?= htmlspecialchars((string)$invite['accept_url']) ?></div>
                                        <?php endif; ?>
                                    </div>
                                    <?php if ($canManage): ?>
                                        <form method="post">
                                            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(CSRF::generate()) ?>">
                                            <input type="hidden" name="action" value="revoke_invite">
                                            <input type="hidden" name="invite_id" value="<?= htmlspecialchars((string)($invite['id'] ?? '')) ?>">
                                            <button type="submit" class="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">無効化</button>
                                        </form>
                                    <?php endif; ?>
                                </div>
                            </article>
                        <?php endforeach; ?>
                        <?php if (empty($pendingInvites)): ?>
                            <div class="rounded-[22px] border border-dashed border-[#082f2a]/12 bg-slate-50 p-5 text-sm text-slate-500">現在の招待待ちはありません。</div>
                        <?php endif; ?>
                    </div>
                </div>
            </aside>

            <section class="panel p-6 md:p-8">
                <div class="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-sky-700">Members</div>
                <h2 class="mt-4 text-2xl font-black tracking-[-0.04em] text-[#12231f]">参加中のメンバー</h2>
                <div class="mt-5 space-y-3">
                    <?php foreach ($members as $member): ?>
                        <div class="rounded-[24px] border border-[#082f2a]/8 bg-white p-5">
                            <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                                <div class="flex items-center gap-3">
                                    <img src="<?= htmlspecialchars($member['avatar']) ?>" alt="" class="h-12 w-12 rounded-full bg-slate-100 object-cover">
                                    <div>
                                        <div class="text-lg font-black text-[#12231f]"><?= htmlspecialchars($member['name']) ?></div>
                                        <div class="text-sm text-slate-500"><?= htmlspecialchars($member['email']) ?></div>
                                        <div class="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-slate-400">Platform <?= htmlspecialchars($member['platform_role']) ?></div>
                                    </div>
                                </div>
                                <div class="flex flex-wrap items-center gap-3">
                                    <?php if ($canManage): ?>
                                        <form method="post" class="flex items-center gap-2">
                                            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(CSRF::generate()) ?>">
                                            <input type="hidden" name="action" value="update_role">
                                            <input type="hidden" name="member_id" value="<?= htmlspecialchars($member['id']) ?>">
                                            <select name="role" class="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
                                                <?php foreach ($roleOptions as $roleValue => $roleLabel): ?>
                                                    <option value="<?= htmlspecialchars($roleValue) ?>" <?= $member['corp_role'] === $roleValue ? 'selected' : '' ?>><?= htmlspecialchars($roleLabel) ?></option>
                                                <?php endforeach; ?>
                                            </select>
                                            <button type="submit" class="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">更新</button>
                                        </form>
                                        <form method="post">
                                            <input type="hidden" name="csrf_token" value="<?= htmlspecialchars(CSRF::generate()) ?>">
                                            <input type="hidden" name="action" value="remove_member">
                                            <input type="hidden" name="member_id" value="<?= htmlspecialchars($member['id']) ?>">
                                            <button type="submit" class="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700">外す</button>
                                        </form>
                                    <?php else: ?>
                                        <span class="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-600"><?= htmlspecialchars($member['corp_role']) ?></span>
                                    <?php endif; ?>
                                </div>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    <?php if (empty($members)): ?>
                        <div class="rounded-[24px] border border-dashed border-[#082f2a]/12 bg-slate-50 p-8 text-center text-sm text-slate-500">まだ団体メンバーがいません。</div>
                    <?php endif; ?>
                </div>
            </section>
        </section>
    </div>
</main>
</body>
</html>
