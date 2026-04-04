<?php
ob_start();

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CorporateAccess.php';
require_once __DIR__ . '/../libs/CorporateInviteManager.php';
require_once __DIR__ . '/../libs/CorporateManager.php';
require_once __DIR__ . '/../libs/SiteManager.php';

Auth::init();
if (!Auth::isLoggedIn()) {
    header('Location: login.php?redirect=' . urlencode('corporate_dashboard.php'));
    exit;
}

$currentUser = Auth::user();
$visibleCorporations = CorporateAccess::getVisibleCorporations($currentUser);
$preferredCorpId = trim((string)($_GET['corp'] ?? ''));
$corporation = CorporateAccess::getPreferredCorporation($currentUser, $preferredCorpId);

$resolveSites = static function (array $corporation): array {
    $corpId = (string)($corporation['id'] ?? '');
    $corpName = trim((string)($corporation['name'] ?? ''));
    $sites = SiteManager::getByOwnerOrg($corpId);
    if (!empty($sites) || $corpName === '') {
        return $sites;
    }

    $fallback = [];
    foreach (SiteManager::listAll(true) as $site) {
        if (trim((string)($site['owner'] ?? '')) === $corpName) {
            $fallback[] = $site;
        }
    }
    return $fallback;
};

$sites = $corporation ? $resolveSites($corporation) : [];
$pendingInvites = $corporation ? CorporateInviteManager::listByCorporation((string)($corporation['id'] ?? ''), 'pending') : [];
$canManage = $corporation ? CorporateAccess::canManageCorporation((string)($corporation['id'] ?? ''), $currentUser) : false;
$canEdit = $corporation ? CorporateAccess::canEditCorporation((string)($corporation['id'] ?? ''), $currentUser) : false;
$planDef = $corporation ? CorporateManager::getPlanDefinition((string)($corporation['plan'] ?? 'community')) : ['label' => 'Community', 'site_limit' => 10, 'member_limit' => 20];
$lifecycle = $corporation['lifecycle'] ?? ['status' => 'active'];
$workspaceLabel = (string)($corporation['settings']['workspace_label'] ?? $corporation['name'] ?? 'ワークスペース');
$selectedSiteId = trim((string)($_GET['site'] ?? ($sites[0]['id'] ?? '')));
$selectedSiteStats = $selectedSiteId !== '' ? SiteManager::getSiteStats($selectedSiteId) : null;
$memberCount = count($corporation['members'] ?? []);
$nextSteps = [];
$isCommunityPlan = $corporation ? ((string)($corporation['plan'] ?? 'community') === 'community') : false;

if ($corporation) {
    if (empty($sites)) {
        $nextSteps[] = ['title' => '最初の拠点を追加', 'body' => '境界を描いて、どの場所の記録をまとめるか決めます。', 'href' => 'site_editor.php?corp=' . urlencode((string)$corporation['id']), 'label' => '拠点を作る'];
    }
    if ($memberCount < 2) {
        $nextSteps[] = ['title' => '運用メンバーを招待', 'body' => '撮る人、見る人、確認する人を分けると運用が続きやすくなります。', 'href' => 'corporate_members.php?corp=' . urlencode((string)$corporation['id']), 'label' => 'メンバーを招待'];
    }
    if (($lifecycle['status'] ?? 'active') === 'active' && !empty($sites) && ($selectedSiteStats['total_observations'] ?? 0) === 0) {
        $nextSteps[] = ['title' => '最初の記録を集める', 'body' => 'まずは身近な観察を数件ためると、ダッシュボードが育ち始めます。', 'href' => 'site_dashboard.php?site=' . urlencode($selectedSiteId), 'label' => '記録ボードを見る'];
    }
    if (($lifecycle['status'] ?? 'active') !== 'active') {
        $nextSteps[] = ['title' => '契約状態を確認', 'body' => '一時停止や解約相談中の場合は、次の扱いを先に決めておくと運用がぶれません。', 'href' => 'corporate_settings.php?corp=' . urlencode((string)$corporation['id']), 'label' => '設定を見る'];
    }
}

$meta_title = $corporation ? $workspaceLabel . ' ワークスペース' : '団体ワークスペース';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>
        .panel{background:var(--md-surface-container);border:1px solid var(--md-outline-variant);border-radius:var(--shape-xl);box-shadow:var(--elev-1)}
        .hero{background:linear-gradient(135deg,#0f766e 0%,#10b981 48%,#38bdf8 100%)}
        .chip{display:inline-flex;align-items:center;gap:.45rem;border-radius:var(--shape-full);padding:.45rem .85rem;font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}
    </style>
</head>
<body class="js-loading font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
<?php include 'components/nav.php'; ?>
<script nonce="<?= CspNonce::attr() ?>">document.body.classList.remove('js-loading');</script>
<main class="min-h-screen px-4 pb-20 pt-20 md:px-8">
    <div class="mx-auto max-w-6xl space-y-6">
        <?php if (!$corporation): ?>
            <section class="panel p-8 text-center md:p-12">
                <div class="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><i data-lucide="building-2" class="h-8 w-8"></i></div>
                <h1 class="mt-5 text-3xl font-black tracking-[-0.04em] text-[#10231f]">団体ワークスペースはまだありません</h1>
                <p class="mx-auto mt-4 max-w-2xl text-sm leading-8 text-slate-600">無料の団体ワークスペースは申込みなしでその場で作れます。スポット登録、観察会開催、概要確認まで無料。レポートや完全出力が必要になったら Public に上げる設計です。</p>
                <div class="mt-6 flex flex-wrap justify-center gap-3">
                    <a href="for-business/create.php" class="inline-flex min-h-[52px] items-center justify-center rounded-full bg-[#0f3d2e] px-6 text-sm font-bold text-white">無料で作成する</a>
                    <a href="for-business/apply.php" class="inline-flex min-h-[52px] items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-bold text-slate-700">Public を相談</a>
                </div>
            </section>
        <?php else: ?>
            <section class="hero rounded-[32px] p-6 text-white md:p-8">
                <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                        <div class="chip border border-white/18 bg-white/12 text-white/88">Organization Workspace</div>
                        <h1 class="mt-4 text-3xl font-black tracking-[-0.05em] md:text-5xl"><?= htmlspecialchars($workspaceLabel) ?></h1>
                        <p class="mt-4 max-w-3xl text-sm leading-8 text-white/84">個人の観察とは別に、団体で続けるための入口です。拠点・メンバー・公開状態・運用の進み具合をここから揃えます。</p>
                    </div>
                    <div class="flex flex-wrap gap-3">
                        <a href="<?= !empty($sites[0]['id']) ? 'site_dashboard.php?site=' . urlencode((string)$sites[0]['id']) : 'site_dashboard.php' ?>" class="inline-flex min-h-[52px] items-center justify-center rounded-full bg-white px-5 text-sm font-bold text-[#0f3d2e]">記録ボードを見る</a>
                        <?php if ($canEdit): ?>
                            <a href="site_editor.php?corp=<?= urlencode((string)$corporation['id']) ?>" class="inline-flex min-h-[52px] items-center justify-center rounded-full border border-white/20 bg-white/10 px-5 text-sm font-bold text-white">拠点を追加</a>
                        <?php endif; ?>
                    </div>
                </div>
                <?php if (count($visibleCorporations) > 1): ?>
                    <form method="get" class="mt-5">
                        <label class="mb-2 block text-xs font-extrabold uppercase tracking-[0.18em] text-white/70">ワークスペース切替</label>
                        <select name="corp" onchange="this.form.submit()" class="min-h-[48px] rounded-2xl border border-white/20 bg-white/12 px-4 text-sm font-bold text-white">
                            <?php foreach ($visibleCorporations as $item): ?>
                                <option value="<?= htmlspecialchars((string)($item['id'] ?? '')) ?>" <?= ((string)($item['id'] ?? '') === (string)($corporation['id'] ?? '')) ? 'selected' : '' ?> style="color:#10231f">
                                    <?= htmlspecialchars((string)($item['settings']['workspace_label'] ?? $item['name'] ?? '')) ?>
                                </option>
                            <?php endforeach; ?>
                        </select>
                    </form>
                <?php endif; ?>
            </section>

            <?php if (($lifecycle['status'] ?? 'active') !== 'active'): ?>
                <section class="panel border-amber-200 bg-amber-50 p-5 text-amber-900">
                    <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div class="text-xs font-extrabold uppercase tracking-[0.18em] text-amber-700"><?= htmlspecialchars(CorporateManager::lifecycleLabel((string)$lifecycle['status'])) ?></div>
                            <p class="mt-1 text-sm leading-7"><?= htmlspecialchars((string)($lifecycle['last_note'] ?? '契約状態が変わっています。今後の扱いを確認してください。')) ?></p>
                        </div>
                        <a href="corporate_settings.php?corp=<?= urlencode((string)$corporation['id']) ?>" class="inline-flex min-h-[48px] items-center justify-center rounded-full bg-amber-600 px-5 text-sm font-bold text-white">設定を開く</a>
                    </div>
                </section>
            <?php endif; ?>

            <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <article class="panel p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">契約プラン</div><div class="mt-3 text-3xl font-black text-[#10231f]"><?= htmlspecialchars($planDef['label']) ?></div><p class="mt-2 text-sm leading-7 text-slate-500">管理メンバー<?= (int)$planDef['member_limit'] ?>人まで / 拠点<?= (int)$planDef['site_limit'] ?>つまで</p></article>
                <article class="panel p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">団体メンバー</div><div class="mt-3 text-3xl font-black text-[#10231f]"><?= $memberCount ?></div><p class="mt-2 text-sm leading-7 text-slate-500">招待待ち <?= count($pendingInvites) ?>件</p></article>
                <article class="panel p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">管理拠点</div><div class="mt-3 text-3xl font-black text-[#10231f]"><?= count($sites) ?></div><p class="mt-2 text-sm leading-7 text-slate-500">場所ごとの記録を分けて育てます</p></article>
                <article class="panel p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">ワークスペース設定</div><div class="mt-3 text-xl font-black text-[#10231f]"><?= htmlspecialchars((string)($corporation['settings']['locale'] ?? 'ja')) ?> / <?= htmlspecialchars((string)($corporation['settings']['timezone'] ?? 'Asia/Tokyo')) ?></div><p class="mt-2 text-sm leading-7 text-slate-500">多言語や海外拠点にも伸ばせる設定です</p></article>
            </section>

            <?php
            /* ── Executive Summary: What → Why → Next ── */
            $totalObs    = (int)($selectedSiteStats['total_observations'] ?? 0);
            $totalSpecies= (int)($selectedSiteStats['total_species'] ?? 0);
            $daysSince   = (int)($selectedSiteStats['days_since_last_obs'] ?? 999);
            $siteCount   = count($sites);

            /* What is happening */
            if ($siteCount === 0) {
                $whatText = 'まだ拠点が登録されていません。拠点を作ることで、場所ごとの記録が育てられます。';
            } elseif ($totalObs === 0) {
                $whatText = '拠点は登録済みですが、観察記録がまだありません。最初の記録を集めましょう。';
            } elseif ($daysSince > 30) {
                $whatText = "最後の記録から {$daysSince} 日が経過しています。記録の継続性が落ちると生態系の変化を見逃します。";
            } else {
                $whatText = "{$siteCount} 拠点で {$totalObs} 件の観察、{$totalSpecies} 種を確認済み。記録は継続中です。";
            }

            /* Why it matters */
            if ($totalSpecies >= 50) {
                $whyText = '50種を超えた記録は、TNFD LEAPフェーズの「評価」ステップで活用できるデータ規模です。';
            } elseif ($totalSpecies >= 20) {
                $whyText = '20種以上の記録は、敷地の生物多様性報告書の基礎データとして十分な水準です。';
            } elseif ($totalObs > 0) {
                $whyText = '記録を積み上げると、種の季節変化・希少種の分布が可視化され、自然価値の報告が可能になります。';
            } else {
                $whyText = '記録の蓄積が「自然との接点」の証拠になります。投資家・行政・地域コミュニティへの開示に使えます。';
            }

            /* Next action */
            if (!empty($nextSteps)) {
                $nextText = htmlspecialchars($nextSteps[0]['title']) . ' — ' . htmlspecialchars($nextSteps[0]['body']);
                $nextHref = htmlspecialchars($nextSteps[0]['href']);
                $nextLabel = htmlspecialchars($nextSteps[0]['label']);
            } elseif ($selectedSiteId !== '') {
                $nextText = '記録ボードで種数・季節分布・データ品質を確認しましょう。';
                $nextHref = htmlspecialchars('site_dashboard.php?site=' . urlencode($selectedSiteId));
                $nextLabel = '記録ボードを開く';
            } else {
                $nextText = '拠点を作ると記録の整理・公開・報告がすべてつながります。';
                $nextHref = htmlspecialchars('for-business/create.php');
                $nextLabel = '拠点を作る';
            }
            ?>
            <section class="panel p-6 md:p-8">
                <div class="chip border border-emerald-200 bg-emerald-50 text-emerald-700 mb-5">Executive Summary</div>
                <div class="grid gap-4 md:grid-cols-3">
                    <div class="rounded-[20px] p-5" style="background:var(--md-surface-container-low)">
                        <p class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-2">何が起きているか</p>
                        <p class="text-sm leading-7 text-slate-700"><?= htmlspecialchars($whatText) ?></p>
                    </div>
                    <div class="rounded-[20px] p-5" style="background:var(--md-surface-container-low)">
                        <p class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400 mb-2">なぜ重要か</p>
                        <p class="text-sm leading-7 text-slate-700"><?= htmlspecialchars($whyText) ?></p>
                    </div>
                    <div class="rounded-[20px] p-5 flex flex-col gap-3" style="background:var(--md-surface-container-low)">
                        <p class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">次にやること</p>
                        <p class="text-sm leading-7 text-slate-700 flex-1"><?= htmlspecialchars($nextText) ?></p>
                        <a href="<?= $nextHref ?>"
                           class="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#0f3d2e] px-4 text-sm font-bold text-white self-start">
                            <?= $nextLabel ?>
                        </a>
                    </div>
                </div>
            </section>

            <?php if ($isCommunityPlan): ?>
                <section class="panel border border-sky-200 bg-sky-50 p-6 md:p-7">
                    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div class="chip border border-sky-200 bg-white text-sky-700">Upgrade Path</div>
                            <h2 class="mt-4 text-2xl font-black tracking-[-0.04em] text-sky-950">Community のまま始めて、出力が必要になったら Public に上げる</h2>
                            <p class="mt-3 max-w-3xl text-sm leading-8 text-slate-700">拠点登録、観察会運営、概要確認はこのまま無料で続けられます。種一覧の完全表示、CSV、証跡レポート、調査向け出力が必要になったタイミングだけ Public へ切り替える設計です。</p>
                        </div>
                        <div class="flex flex-wrap gap-3">
                            <a href="for-business/apply.php?plan=public&amp;source=workspace&amp;corp=<?= urlencode((string)$corporation['id']) ?>" class="inline-flex min-h-[48px] items-center justify-center rounded-full bg-sky-700 px-5 text-sm font-bold text-white">Public を相談</a>
                            <?php if ($selectedSiteId !== ''): ?>
                                <a href="site_dashboard.php?site=<?= urlencode($selectedSiteId) ?>" class="inline-flex min-h-[48px] items-center justify-center rounded-full border border-sky-200 bg-white px-5 text-sm font-bold text-sky-700">ロック箇所を見る</a>
                            <?php endif; ?>
                        </div>
                    </div>
                </section>
            <?php endif; ?>

            <section class="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <aside class="panel p-6 md:p-8">
                    <div class="chip border border-emerald-200 bg-emerald-50 text-emerald-700">Next Steps</div>
                    <h2 class="mt-4 text-2xl font-black tracking-[-0.04em] text-[#10231f]">最初にやること</h2>
                    <div class="mt-5 space-y-3">
                        <?php foreach ($nextSteps as $step): ?>
                            <article class="rounded-[22px] border border-[#082f2a]/8 bg-slate-50 p-4">
                                <h3 class="text-lg font-black text-[#10231f]"><?= htmlspecialchars($step['title']) ?></h3>
                                <p class="mt-2 text-sm leading-7 text-slate-600"><?= htmlspecialchars($step['body']) ?></p>
                                <a href="<?= htmlspecialchars($step['href']) ?>" class="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#0f3d2e] px-4 text-sm font-bold text-white"><?= htmlspecialchars($step['label']) ?></a>
                            </article>
                        <?php endforeach; ?>
                        <?php if (empty($nextSteps)): ?>
                            <article class="rounded-[22px] border border-[#082f2a]/8 bg-slate-50 p-4">
                                <h3 class="text-lg font-black text-[#10231f]">運用の土台はできています</h3>
                                <p class="mt-2 text-sm leading-7 text-slate-600">このまま記録を育てつつ、必要になったときだけ拠点やメンバーを足す運用で十分です。</p>
                            </article>
                        <?php endif; ?>
                    </div>
                    <div class="mt-5 rounded-[22px] border border-sky-200 bg-sky-50 p-5 text-sm leading-7 text-sky-900">
                        個人アカウントをそのまま使い、必要なときだけ団体モードへ切り替える設計です。別の企業専用ログインを増やしません。
                    </div>
                </aside>

                <section class="panel p-6 md:p-8">
                    <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                            <div class="chip border border-sky-200 bg-sky-50 text-sky-700">Sites</div>
                            <h2 class="mt-4 text-2xl font-black tracking-[-0.04em] text-[#10231f]">拠点と運用導線</h2>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <a href="corporate_members.php?corp=<?= urlencode((string)$corporation['id']) ?>" class="inline-flex min-h-[46px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">メンバー管理</a>
                            <a href="corporate_settings.php?corp=<?= urlencode((string)$corporation['id']) ?>" class="inline-flex min-h-[46px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">設定と解約</a>
                        </div>
                    </div>
                    <div class="mt-5 space-y-3">
                        <?php foreach ($sites as $site): ?>
                            <?php $stats = SiteManager::getSiteStats((string)($site['id'] ?? '')); ?>
                            <article class="rounded-[24px] border border-[#082f2a]/8 bg-white p-5">
                                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <h3 class="text-xl font-black text-[#10231f]"><?= htmlspecialchars((string)($site['name'] ?? '')) ?></h3>
                                        <p class="mt-1 text-sm text-slate-500"><?= htmlspecialchars((string)($site['address'] ?? '')) ?></p>
                                        <p class="mt-2 text-sm leading-7 text-slate-600"><?= htmlspecialchars((string)($site['description'] ?? '')) ?></p>
                                    </div>
                                    <div class="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-emerald-700">
                                        <?= (int)($stats['total_observations'] ?? 0) ?> records
                                    </div>
                                </div>
                                <div class="mt-4 grid gap-2 sm:grid-cols-3">
                                    <div class="rounded-[18px] border border-[#082f2a]/8 bg-slate-50 p-3"><div class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">確認種数</div><div class="mt-1 text-xl font-black text-[#10231f]"><?= (int)($stats['total_species'] ?? 0) ?></div></div>
                                    <div class="rounded-[18px] border border-[#082f2a]/8 bg-slate-50 p-3"><div class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">直近更新</div><div class="mt-1 text-xl font-black text-[#10231f]"><?= (int)($stats['days_since_last_obs'] ?? 0) ?>日</div></div>
                                    <div class="rounded-[18px] border border-[#082f2a]/8 bg-slate-50 p-3"><div class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">月別カバー</div><div class="mt-1 text-xl font-black text-[#10231f]"><?= (int)($stats['active_months'] ?? 0) ?>/12</div></div>
                                </div>
                                <div class="mt-4 flex flex-wrap gap-2">
                                    <a href="site_dashboard.php?site=<?= urlencode((string)($site['id'] ?? '')) ?>" class="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#0f3d2e] px-4 text-sm font-bold text-white">記録ボード</a>
                                    <?php if ($canEdit): ?>
                                        <a href="site_editor.php?site=<?= urlencode((string)($site['id'] ?? '')) ?>" class="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">拠点を編集</a>
                                    <?php endif; ?>
                                    <?php if ($isCommunityPlan): ?>
                                        <a href="for-business/apply.php?plan=public&amp;source=site_card&amp;corp=<?= urlencode((string)$corporation['id']) ?>&amp;site=<?= urlencode((string)($site['id'] ?? '')) ?>" class="inline-flex min-h-[44px] items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-4 text-sm font-bold text-sky-700">Public へ上げる</a>
                                    <?php endif; ?>
                                </div>
                            </article>
                        <?php endforeach; ?>
                        <?php if (empty($sites)): ?>
                            <article class="rounded-[24px] border border-dashed border-[#082f2a]/12 bg-slate-50 p-8 text-center text-sm text-slate-500">まだ拠点がありません。まずは 1 つ目の場所を登録すると、以後の運用導線が全部つながります。</article>
                        <?php endif; ?>
                    </div>
                </section>
            </section>
        <?php endif; ?>
    </div>
</main>
</body>
</html>
