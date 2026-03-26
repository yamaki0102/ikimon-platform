<?php
ob_start();
require_once __DIR__ . '/../../libs/Auth.php';
require_once __DIR__ . '/../../libs/CorporateManager.php';
require_once __DIR__ . '/../../libs/SiteManager.php';

Auth::init();
Auth::requireRole('Analyst');
$currentUser = Auth::user();
$adminPage = 'corporate';
$allActiveSites = SiteManager::listAll(true);

$buildSiteState = static function (array $site): array {
    $stats = SiteManager::getSiteStats((string)($site['id'] ?? ''));
    $obs = (int)($stats['total_observations'] ?? 0);
    $months = (int)($stats['active_months'] ?? 0);
    $red = (int)($stats['redlist_count'] ?? 0);
    $days = (int)($stats['days_since_last_obs'] ?? 0);
    $label = '継続運用';
    $tone = 'emerald';
    $priority = 10;
    if ($obs === 0) {
        $label = '初回観測立上げ';
        $tone = 'rose';
        $priority = 100;
    } elseif ($months < 3) {
        $label = '季節カバー補完';
        $tone = 'amber';
        $priority = 80;
    } elseif ($red > 0) {
        $label = '重要種候補確認';
        $tone = 'sky';
        $priority = 70;
    } elseif ($days > 60) {
        $label = '継続観測再開';
        $tone = 'amber';
        $priority = 60;
    }
    return [
        'id' => $site['id'] ?? '',
        'name' => $site['name'] ?? '',
        'description' => $site['description'] ?? '',
        'observations' => $obs,
        'species' => (int)($stats['total_species'] ?? 0),
        'months' => $months,
        'reference' => (int)($stats['credit_score'] ?? 0),
        'label' => $label,
        'tone' => $tone,
        'priority' => $priority,
    ];
};

$resolveCorporationSites = static function (array $corp) use ($allActiveSites): array {
    $corpId = (string)($corp['id'] ?? '');
    $corpName = trim((string)($corp['name'] ?? ''));
    $sites = SiteManager::getByOwnerOrg($corpId);
    if (!empty($sites) || $corpName === '') {
        return $sites;
    }

    $fallback = [];
    foreach ($allActiveSites as $site) {
        if (trim((string)($site['owner'] ?? '')) === $corpName) {
            $fallback[] = $site;
        }
    }
    return $fallback;
};

$corpStates = [];
foreach (CorporateManager::list() as $corp) {
    $sites = array_map($buildSiteState, $resolveCorporationSites($corp));
    usort($sites, static fn(array $a, array $b): int => [$b['priority'], $b['observations']] <=> [$a['priority'], $a['observations']]);
    $siteCount = count($sites);
    $obsTotal = array_sum(array_column($sites, 'observations'));
    $attention = count(array_filter($sites, static fn(array $s): bool => ($s['priority'] ?? 0) >= 60));
    $stage = '運用安定';
    $tone = 'emerald';
    $priority = 10;
    $stageBody = '継続運用中。団体側画面で詳細を追う段階です。';
    if ($siteCount === 0) {
        $stage = '拠点未登録';
        $tone = 'rose';
        $priority = 120;
        $stageBody = '契約団体登録はあるが、まだ拠点がありません。';
    } elseif ($obsTotal === 0) {
        $stage = '観測立上げ前';
        $tone = 'rose';
        $priority = 100;
        $stageBody = '拠点はあるが観測がまだない状態です。';
    } elseif ($attention > 0) {
        $stage = '要フォロー';
        $tone = 'amber';
        $priority = 70;
        $stageBody = '運営側で先に見にいくべき拠点があります。';
    }
    $corpStates[] = [
        'id' => $corp['id'] ?? '',
        'name' => $corp['name'] ?? '',
        'plan' => $corp['plan'] ?? 'standard',
        'members' => count($corp['members'] ?? []),
        'sites' => $sites,
        'site_count' => $siteCount,
        'obs_total' => $obsTotal,
        'attention' => $attention,
        'stage' => $stage,
        'stage_body' => $stageBody,
        'tone' => $tone,
        'priority' => $priority,
        'focus_site_id' => $sites[0]['id'] ?? '',
    ];
}
usort($corpStates, static fn(array $a, array $b): int => [$b['priority'], $b['site_count'], $b['members']] <=> [$a['priority'], $a['site_count'], $a['members']]);

$affiliation = $currentUser ? CorporateManager::getUserAffiliation((string)($currentUser['id'] ?? '')) : null;
$selectedCorpId = trim((string)($_GET['corp'] ?? ($affiliation['corp_id'] ?? 'aikan_corp')));
$selected = null;
foreach ($corpStates as $corpState) {
    if (($corpState['id'] ?? '') === $selectedCorpId) {
        $selected = $corpState;
        break;
    }
}
if (!$selected && !empty($corpStates)) {
    $selected = $corpStates[0];
}

$contractCount = count($corpStates);
$publicCount = count(array_filter($corpStates, static fn(array $c): bool => ($c['plan'] ?? '') === 'public'));
$communityCount = count(array_filter($corpStates, static fn(array $c): bool => ($c['plan'] ?? '') === 'community'));
$siteTotal = array_sum(array_column($corpStates, 'site_count'));
$attentionTotal = count(array_filter($corpStates, static fn(array $c): bool => ($c['priority'] ?? 0) >= 70));
$searchIndex = array_map(static fn(array $c): array => ['id' => $c['id'], 'name' => $c['name'], 'plan' => $c['plan'], 'stage' => $c['stage']], $corpStates);
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php $adminTitle = '契約団体管理'; include __DIR__ . '/components/head.php'; ?>
    <style>
        .shell{min-height:100vh;background:radial-gradient(circle at top left,rgba(16,185,129,.12),transparent 28%),radial-gradient(circle at top right,rgba(59,130,246,.12),transparent 24%),linear-gradient(180deg,#020617 0%,#0f172a 36%,#111827 100%)}
        .hero{background:linear-gradient(135deg,rgba(6,95,70,.92) 0%,rgba(15,23,42,.94) 55%,rgba(30,64,175,.88) 100%);box-shadow:0 28px 80px rgba(2,6,23,.34)}
        .panel{background:rgba(15,23,42,.74);border:1px solid rgba(148,163,184,.12);box-shadow:0 20px 46px rgba(2,6,23,.16)}
    </style>
</head>
<body class="flex min-h-screen overflow-hidden" x-data="contractPortfolio()">
    <?php include __DIR__ . '/components/sidebar.php'; ?>
    <main class="shell flex-1 overflow-y-auto p-6 md:p-8">
        <div class="mx-auto max-w-7xl space-y-6">
            <section class="hero rounded-[30px] border border-white/10 p-6 md:p-8">
                <div class="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
                    <div>
                        <div class="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.24em] text-white/80"><i data-lucide="building-2" class="h-4 w-4"></i>Ikimon Contract Portfolio</div>
                        <h1 class="mt-5 text-3xl font-black leading-tight tracking-[-0.05em] text-white md:text-5xl">ikimon側の契約団体管理画面。</h1>
                        <p class="mt-4 max-w-3xl text-sm leading-8 text-slate-200 md:text-[15px]">ここは団体側の運用画面ではない。約100団体の契約管理を一覧で捌き、団体ごとの詳細は別ワークスペースに渡す面です。無料プラン側はその100倍規模を別レーンで処理し、この画面には混ぜません。</p>
                    </div>
                    <div class="space-y-4">
                        <div class="panel rounded-[24px] p-5">
                            <div class="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Current Focus</div>
                            <div class="mt-3 text-2xl font-black text-white"><?= htmlspecialchars($selected['name'] ?? '契約団体なし') ?></div>
                            <p class="mt-2 text-sm leading-7 text-slate-300"><?= htmlspecialchars($selected['stage_body'] ?? '契約団体を登録するとここに出ます。') ?></p>
                        </div>
                        <div class="panel rounded-[24px] p-5">
                            <div class="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-400">Operating Rule</div>
                            <div class="mt-3 text-xl font-black text-white">契約団体と無料プランを分ける</div>
                            <p class="mt-2 text-sm leading-7 text-slate-300">契約団体は伴走型。無料プランはセルフサーブと自動処理を前提に、同じ管理面へ流し込まない設計にします。</p>
                        </div>
                    </div>
                </div>
            </section>

            <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <article class="panel rounded-[22px] p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">契約団体</div><div class="mt-3 text-3xl font-black text-white"><?= $contractCount ?></div><p class="mt-2 text-sm leading-7 text-slate-400">伴走対象の契約団体数。</p></article>
                <article class="panel rounded-[22px] p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Public</div><div class="mt-3 text-3xl font-black text-white"><?= $publicCount ?></div><p class="mt-2 text-sm leading-7 text-slate-400">拠点記録を継続運用する団体数。</p></article>
                <article class="panel rounded-[22px] p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">Community</div><div class="mt-3 text-3xl font-black text-white"><?= $communityCount ?></div><p class="mt-2 text-sm leading-7 text-slate-400">セルフサーブ無料枠。契約管理の主レーンには混ぜない前提です。</p></article>
                <article class="panel rounded-[22px] p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">管理拠点</div><div class="mt-3 text-3xl font-black text-white"><?= $siteTotal ?></div><p class="mt-2 text-sm leading-7 text-slate-400">契約団体側ワークスペースへ紐づく拠点総数。</p></article>
                <article class="panel rounded-[22px] p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">要フォロー団体</div><div class="mt-3 text-3xl font-black text-white"><?= $attentionTotal ?></div><p class="mt-2 text-sm leading-7 text-slate-400">運営側が先に見にいく団体数。</p></article>
            </section>

            <section class="grid gap-4 xl:grid-cols-[1.04fr_0.96fr]">
                <article class="panel rounded-[28px] p-6 md:p-8">
                    <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <div class="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-emerald-300"><i data-lucide="folders" class="h-4 w-4"></i>Contract Organizations</div>
                            <h2 class="mt-4 text-2xl font-black tracking-[-0.04em] text-white">契約団体ポートフォリオ</h2>
                            <p class="mt-3 text-sm leading-8 text-slate-300">100団体規模でも、一覧で絞ってから団体側詳細へ入る構造にする。</p>
                        </div>
                        <input type="text" x-model.trim="search" placeholder="団体名・プラン・ステージで検索" class="w-full md:w-72 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-emerald-400/30 focus:outline-none">
                    </div>
                    <div class="mt-6 space-y-3">
                        <?php foreach ($corpStates as $corp): ?>
                            <?php
                            $badgeClass = $corp['tone'] === 'rose' ? 'border-rose-400/20 bg-rose-400/12 text-rose-300' : ($corp['tone'] === 'amber' ? 'border-amber-400/20 bg-amber-400/12 text-amber-300' : 'border-emerald-400/20 bg-emerald-400/12 text-emerald-300');
                            $isSelected = ($selected['id'] ?? '') === $corp['id'];
                            $haystack = strtolower($corp['name'] . ' ' . $corp['plan'] . ' ' . $corp['stage']);
                            ?>
                            <a href="?corp=<?= urlencode($corp['id']) ?>" x-show="matches('<?= htmlspecialchars($haystack, ENT_QUOTES, 'UTF-8') ?>')" class="block rounded-[24px] border <?= $isSelected ? 'border-emerald-400/30 bg-emerald-400/8' : 'border-white/8 bg-slate-950/30' ?> p-5 transition hover:-translate-y-0.5">
                                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <div class="flex flex-wrap items-center gap-2">
                                            <h3 class="text-xl font-black text-white"><?= htmlspecialchars($corp['name']) ?></h3>
                                            <span class="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-300"><?= htmlspecialchars($corp['plan']) ?></span>
                                        </div>
                                        <p class="mt-2 text-sm leading-7 text-slate-300"><?= htmlspecialchars($corp['stage_body']) ?></p>
                                    </div>
                                    <span class="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] <?= $badgeClass ?>"><?= htmlspecialchars($corp['stage']) ?></span>
                                </div>
                                <div class="mt-4 grid gap-2 sm:grid-cols-4">
                                    <div class="rounded-[18px] border border-white/8 bg-white/5 p-3"><div class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">拠点</div><div class="mt-1 text-xl font-black text-white"><?= $corp['site_count'] ?></div></div>
                                    <div class="rounded-[18px] border border-white/8 bg-white/5 p-3"><div class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">観測件数</div><div class="mt-1 text-xl font-black text-white"><?= number_format($corp['obs_total']) ?></div></div>
                                    <div class="rounded-[18px] border border-white/8 bg-white/5 p-3"><div class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">メンバー</div><div class="mt-1 text-xl font-black text-white"><?= $corp['members'] ?></div></div>
                                    <div class="rounded-[18px] border border-white/8 bg-white/5 p-3"><div class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">要対応拠点</div><div class="mt-1 text-xl font-black text-white"><?= $corp['attention'] ?></div></div>
                                </div>
                            </a>
                        <?php endforeach; ?>
                    </div>
                </article>

                <article class="panel rounded-[28px] p-6 md:p-8">
                    <div class="inline-flex items-center gap-2 rounded-full border border-sky-400/20 bg-sky-400/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-sky-300"><i data-lucide="monitor-up" class="h-4 w-4"></i>Selected Contract</div>
                    <?php if ($selected): ?>
                        <h2 class="mt-4 text-2xl font-black tracking-[-0.04em] text-white"><?= htmlspecialchars($selected['name']) ?></h2>
                        <p class="mt-3 text-sm leading-8 text-slate-300">ここから先は団体側ワークスペースへの入口。ikimon側の契約管理と、団体側の現場運用を分けて扱います。</p>
                        <div class="mt-5 grid gap-3 sm:grid-cols-2">
                            <div class="rounded-[22px] border border-white/8 bg-slate-950/30 p-4"><div class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">プラン</div><div class="mt-2 text-2xl font-black text-white"><?= htmlspecialchars($selected['plan']) ?></div></div>
                            <div class="rounded-[22px] border border-white/8 bg-slate-950/30 p-4"><div class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">契約メンバー</div><div class="mt-2 text-2xl font-black text-white"><?= $selected['members'] ?></div></div>
                            <div class="rounded-[22px] border border-white/8 bg-slate-950/30 p-4"><div class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">管理拠点</div><div class="mt-2 text-2xl font-black text-white"><?= $selected['site_count'] ?></div></div>
                            <div class="rounded-[22px] border border-white/8 bg-slate-950/30 p-4"><div class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-500">観測件数</div><div class="mt-2 text-2xl font-black text-white"><?= number_format($selected['obs_total']) ?></div></div>
                        </div>
                        <div class="mt-5 space-y-3">
                            <a href="<?= $selected['focus_site_id'] !== '' ? '../site_dashboard.php?site=' . urlencode($selected['focus_site_id']) : '../site_dashboard.php' ?>" class="block rounded-[22px] border border-white/8 bg-slate-950/30 p-5 transition hover:-translate-y-0.5 hover:border-emerald-400/20"><div class="text-lg font-black text-white">団体側ダッシュボード</div><p class="mt-2 text-sm leading-7 text-slate-300">契約団体が日常運用で使う画面です。ikimon管理画面ではなく、団体側の判断画面を開きます。</p></a>
                            <a href="<?= $selected['focus_site_id'] !== '' ? '../site_editor.php?site=' . urlencode($selected['focus_site_id']) : '../site_editor.php' ?>" class="block rounded-[22px] border border-white/8 bg-slate-950/30 p-5 transition hover:-translate-y-0.5 hover:border-emerald-400/20"><div class="text-lg font-black text-white">団体側の拠点設定</div><p class="mt-2 text-sm leading-7 text-slate-300">境界、説明文、公開前提を団体側ワークスペースで調整します。</p></a>
                            <a href="<?= $selected['focus_site_id'] !== '' ? '../csr_showcase.php?site_id=' . urlencode($selected['focus_site_id']) : '../for-business/' ?>" class="block rounded-[22px] border border-white/8 bg-slate-950/30 p-5 transition hover:-translate-y-0.5 hover:border-emerald-400/20"><div class="text-lg font-black text-white">公開向けショーケース</div><p class="mt-2 text-sm leading-7 text-slate-300">社外にどう見せるかを別導線で確認します。</p></a>
                        </div>
                        <?php if (!empty($selected['sites'])): ?>
                            <div class="mt-5 space-y-3">
                                <?php foreach ($selected['sites'] as $site): ?>
                                    <div class="rounded-[22px] border border-white/8 bg-slate-950/30 p-4">
                                        <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <div class="text-lg font-black text-white"><?= htmlspecialchars($site['name']) ?></div>
                                                <p class="mt-1 text-sm leading-7 text-slate-300"><?= htmlspecialchars($site['description']) ?></p>
                                            </div>
                                            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-300"><?= htmlspecialchars($site['label']) ?></span>
                                        </div>
                                        <div class="mt-3 grid gap-2 sm:grid-cols-4">
                                            <div class="rounded-[18px] border border-white/8 bg-white/5 p-3"><div class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">観測件数</div><div class="mt-1 text-xl font-black text-white"><?= number_format($site['observations']) ?></div></div>
                                            <div class="rounded-[18px] border border-white/8 bg-white/5 p-3"><div class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">確認種数</div><div class="mt-1 text-xl font-black text-white"><?= number_format($site['species']) ?></div></div>
                                            <div class="rounded-[18px] border border-white/8 bg-white/5 p-3"><div class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">月別カバー</div><div class="mt-1 text-xl font-black text-white"><?= $site['months'] ?>/12</div></div>
                                            <div class="rounded-[18px] border border-white/8 bg-white/5 p-3"><div class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500">参考指標</div><div class="mt-1 text-xl font-black text-white"><?= $site['reference'] ?></div></div>
                                        </div>
                                    </div>
                                <?php endforeach; ?>
                            </div>
                        <?php endif; ?>
                    <?php else: ?>
                        <div class="mt-6 rounded-[24px] border border-dashed border-white/10 bg-slate-950/20 p-8 text-center text-slate-300">契約団体を選ぶと団体側ワークスペースへの導線が出ます。</div>
                    <?php endif; ?>
                </article>
            </section>

            <section class="panel rounded-[28px] p-6 md:p-8">
                <div class="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-slate-300"><i data-lucide="split" class="h-4 w-4"></i>Operating Lanes</div>
                <h2 class="mt-4 text-2xl font-black tracking-[-0.04em] text-white md:text-4xl">契約団体と無料プランは、最初から別レーン。</h2>
                <p class="mt-3 text-sm leading-8 text-slate-300">契約団体は約100団体規模でも、人が伴走して価値を出すレーン。無料プランはその100倍規模を自動化とセルフサーブで処理するレーンとして切り分けます。</p>
                <div class="mt-6 grid gap-4 lg:grid-cols-2">
                    <article class="rounded-[24px] border border-emerald-400/20 bg-emerald-400/8 p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.2em] text-emerald-300">契約団体レーン</div><h3 class="mt-3 text-2xl font-black text-white">一覧で捌いて、詳細は団体側へ渡す</h3><p class="mt-3 text-sm leading-7 text-slate-200">団体一覧、プラン、拠点数、要フォロー状況を運営側で見て、必要なときだけ団体側ワークスペースに入る。</p></article>
                    <article class="rounded-[24px] border border-sky-400/20 bg-sky-400/8 p-5"><div class="text-[11px] font-extrabold uppercase tracking-[0.2em] text-sky-300">無料プランレーン</div><h3 class="mt-3 text-2xl font-black text-white">100倍規模は別キューで捌く</h3><p class="mt-3 text-sm leading-7 text-slate-200">無料側は大量投稿、セルフ登録、モデレーション、自動審査を中心に、契約団体管理とは別オペレーションで扱う。</p></article>
                </div>
            </section>
        </div>
    </main>
    <script nonce="<?= CspNonce::attr() ?>">
        function contractPortfolio(){return{search:'',index:<?= json_encode($searchIndex, JSON_UNESCAPED_UNICODE | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT) ?>,matches(h){const q=(this.search||'').trim().toLowerCase();return !q||h.includes(q)}}}
        if(window.lucide){window.lucide.createIcons();}
    </script>
</body>
</html>
