<?php
ob_start();

require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/SiteManager.php';

Auth::init();

$municipalityId = $_GET['area'] ?? 'municipality_demo';
$municipalityName = '自治体サンプル区域';
$municipalityLead = '市役所・区役所が、区域内の観測サイトを束ねて「現状」「空白」「次の打ち手」を読むためのデモです。';

$sites = SiteManager::listAll(true);
$totalSites = count($sites);
$totalObservations = 0;
$speciesSet = [];
$observerSet = [];
$activeSiteCount = 0;
$attentionSiteCount = 0;
$prioritySites = [];

foreach ($sites as $site) {
    $stats = SiteManager::getSiteStats($site['id']);
    $observations = SiteManager::getObservationsInSite($site['id']);

    $monthsCovered = count($stats['monthly_trend'] ?? []);
    $observationCount = (int)($stats['total_observations'] ?? 0);
    $speciesCount = (int)($stats['total_species'] ?? 0);
    $redListCount = (int)($stats['redlist_count'] ?? 0);
    $score = (int)($stats['credit_score'] ?? 0);
    $daysSince = (int)($stats['days_since_last_obs'] ?? 0);

    $totalObservations += $observationCount;
    if ($observationCount > 0) {
        $activeSiteCount++;
    }

    foreach ($observations as $obs) {
        $speciesName = $obs['taxon']['name'] ?? ($obs['species_name'] ?? null);
        if ($speciesName) {
            $speciesSet[$speciesName] = true;
        }

        $observerId = $obs['user_id'] ?? null;
        if ($observerId) {
            $observerSet[$observerId] = true;
        }
    }

    $priorityScore = 0;
    $priorityReason = '観測継続中';
    $priorityBadge = '継続中';
    $priorityTone = 'emerald';

    if ($observationCount === 0) {
        $priorityScore = 100;
        $priorityReason = 'まだ観測が入っていません。初回観測の開始が最優先です。';
        $priorityBadge = '初回観測待ち';
        $priorityTone = 'rose';
    } elseif ($monthsCovered < 3) {
        $priorityScore = 80;
        $priorityReason = '季節カバーが薄く、偏りが大きい状態です。未観測月の補完が必要です。';
        $priorityBadge = '季節カバー不足';
        $priorityTone = 'amber';
    } elseif ($redListCount > 0) {
        $priorityScore = 70;
        $priorityReason = '重要種照合があります。現地確認や庁内共有の優先度が高い候補です。';
        $priorityBadge = '重点確認候補';
        $priorityTone = 'sky';
    } elseif ($daysSince > 60) {
        $priorityScore = 50;
        $priorityReason = '更新が止まっています。継続観測の再開判断が必要です。';
        $priorityBadge = '更新停滞';
        $priorityTone = 'amber';
    }

    if ($priorityScore > 0) {
        $attentionSiteCount++;
    }

    $prioritySites[] = [
        'id' => $site['id'],
        'name' => $site['name'] ?? $site['id'],
        'description' => $site['description'] ?? '',
        'observations' => $observationCount,
        'species' => $speciesCount,
        'months' => $monthsCovered,
        'redlist' => $redListCount,
        'score' => $score,
        'priority_score' => $priorityScore,
        'priority_reason' => $priorityReason,
        'priority_badge' => $priorityBadge,
        'priority_tone' => $priorityTone,
    ];
}

usort($prioritySites, static function (array $a, array $b): int {
    return [$b['priority_score'], $b['observations'], $b['species']]
        <=> [$a['priority_score'], $a['observations'], $a['species']];
});

$prioritySites = array_slice($prioritySites, 0, 6);
$totalSpecies = count($speciesSet);
$totalParticipants = count($observerSet);
$inactiveSiteCount = max(0, $totalSites - $activeSiteCount);
$isMunicipalityOnboarding = $totalObservations === 0;

$decisionCards = [
    [
        'icon' => 'radar',
        'title' => 'どこが動いているか',
        'body' => '区域内のどのサイトで観測が継続しているか、止まっているかを一覧で把握します。',
    ],
    [
        'icon' => 'map-pinned',
        'title' => 'どこが空白か',
        'body' => '未観測サイト、季節カバー不足、更新停滞を見て、次にテコ入れすべき場所を絞ります。',
    ],
    [
        'icon' => 'users',
        'title' => '誰と動くか',
        'body' => '市民参加、委託調査、庁内連携のどこを強めるべきかを判断する土台にします。',
    ],
];

$useCases = [
    [
        'title' => '庁内の説明材料にする',
        'body' => '環境部門だけでなく、公園、道路、教育、地域連携の担当と同じ画面を見ながら話せる構成です。',
    ],
    [
        'title' => '委託調査の優先順位を決める',
        'body' => 'どこが未観測か、どこが重点確認候補かを見ながら、次の調査発注先や範囲を決めやすくします。',
    ],
    [
        'title' => '市民参加の配置を考える',
        'body' => '参加者数だけでなく、どのサイトに観測が偏っているかを見て、募集や観察会の設計に使えます。',
    ],
];

$onboardingActions = [
    '最初の観測拠点を決めて、境界と担当部署を確定する',
    '市民参加・委託調査・庁内協力のどれで初回観測を始めるか決める',
    '初回観測後に、未観測月と追加調査候補を読む',
];

$meta_title = '自治体向けデモ | ikimon.life';
$meta_description = '市役所・区役所が区域内の観測サイトを束ねて、現状、空白、次の打ち手を把握するための自治体向けデモ。';
$_SERVER['HTTP_HOST'] = $_SERVER['HTTP_HOST'] ?? parse_url(BASE_URL, PHP_URL_HOST) ?? 'ikimon.life';
$_SERVER['REQUEST_URI'] = $_SERVER['REQUEST_URI'] ?? '/dashboard_municipality.php?area=' . urlencode($municipalityId);
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <meta name="robots" content="noindex, nofollow">
    <style>
        body {
            background:
                radial-gradient(circle at top left, rgba(16, 185, 129, 0.12), transparent 28%),
                radial-gradient(circle at top right, rgba(59, 130, 246, 0.1), transparent 22%),
                linear-gradient(180deg, #f4f9f6 0%, #edf4f0 48%, #f8fbf9 100%);
            padding-top: env(safe-area-inset-top);
        }

        .municipality-shell {
            max-width: 1180px;
            margin: 0 auto;
        }

        .hero-panel {
            position: relative;
            overflow: hidden;
            border-radius: 32px;
            background: linear-gradient(135deg, #0f172a 0%, #0f4c45 54%, #1d4ed8 100%);
            color: white;
            box-shadow: 0 28px 90px rgba(15, 23, 42, 0.18);
        }

        .hero-panel::before {
            content: "";
            position: absolute;
            top: -18%;
            right: -10%;
            width: 360px;
            height: 360px;
            background: radial-gradient(circle, rgba(255, 255, 255, 0.14), transparent 70%);
            pointer-events: none;
        }

        .surface-card {
            background: rgba(255, 255, 255, 0.92);
            border: 1px solid rgba(8, 47, 42, 0.08);
            border-radius: 28px;
            box-shadow: 0 16px 46px rgba(16, 24, 40, 0.06);
        }

        .glass-card {
            background: rgba(255, 255, 255, 0.08);
            border: 1px solid rgba(255, 255, 255, 0.12);
            backdrop-filter: blur(18px);
            -webkit-backdrop-filter: blur(18px);
        }

        .fade-up {
            opacity: 0;
            transform: translateY(24px);
            transition: opacity .6s ease, transform .6s ease;
        }

        .fade-up.is-visible {
            opacity: 1;
            transform: translateY(0);
        }
    </style>
</head>

<body class="js-loading bg-base text-text font-body pb-24">
    <?php include('components/nav.php'); ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main class="min-h-screen px-4 pt-20 pb-12 md:px-8">
        <div class="municipality-shell space-y-8 md:space-y-10">
            <section class="hero-panel fade-up px-6 py-7 md:px-10 md:py-10">
                <div class="relative grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                    <div>
                        <div class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-white/84">
                            <i data-lucide="landmark" class="h-4 w-4"></i>
                            Municipality Demo
                        </div>
                        <h1 class="mt-5 font-heading text-[2.3rem] font-black leading-[1.06] tracking-[-0.06em] md:text-[4.2rem]">
                            区域の自然を、
                            施策判断のために
                            束ねて見る。
                        </h1>
                        <p class="mt-5 max-w-3xl text-[15px] leading-8 text-white/82 md:text-base">
                            <?= htmlspecialchars($municipalityLead) ?>
                            ここで見るのは、公式な面積達成率や認定状況ではなく、区域内の観測サイトから何が読めるかです。
                        </p>
                        <?php if (!empty($prioritySites)): ?>
                            <div class="mt-7 flex flex-wrap gap-3">
                                <a href="site_dashboard.php?site=<?= urlencode($prioritySites[0]['id']) ?>&demo=1" class="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full bg-white px-6 font-bold text-[#0f172a] shadow-[0_16px_28px_rgba(255,255,255,0.12)] transition hover:-translate-y-0.5">
                                    <i data-lucide="layout-dashboard" class="h-4 w-4"></i>
                                    自治体担当として詳しく見る
                                </a>
                                <?php if ($isMunicipalityOnboarding): ?>
                                    <a href="#municipality-onboarding" class="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-full border border-white/18 bg-white/10 px-6 font-bold text-white transition hover:-translate-y-0.5">
                                        <i data-lucide="route" class="h-4 w-4"></i>
                                        導入初月の動きを見る
                                    </a>
                                <?php endif; ?>
                            </div>
                        <?php endif; ?>
                    </div>

                    <div class="space-y-4">
                        <div class="glass-card rounded-[28px] p-6">
                            <div class="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/60">Area Summary</div>
                            <div class="mt-4 grid gap-3 sm:grid-cols-2">
                                <div class="rounded-[20px] border border-white/10 bg-white/8 p-4">
                                    <div class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/58">登録サイト</div>
                                    <div class="mt-2 text-3xl font-black text-white"><?= $totalSites ?></div>
                                </div>
                                <div class="rounded-[20px] border border-white/10 bg-white/8 p-4">
                                    <div class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/58">観測件数</div>
                                    <div class="mt-2 text-3xl font-black text-white"><?= number_format($totalObservations) ?></div>
                                </div>
                                <div class="rounded-[20px] border border-white/10 bg-white/8 p-4">
                                    <div class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/58">確認種数</div>
                                    <div class="mt-2 text-3xl font-black text-white"><?= number_format($totalSpecies) ?></div>
                                </div>
                                <div class="rounded-[20px] border border-white/10 bg-white/8 p-4">
                                    <div class="text-[10px] font-extrabold uppercase tracking-[0.18em] text-white/58">参加者</div>
                                    <div class="mt-2 text-3xl font-black text-white"><?= number_format($totalParticipants) ?></div>
                                </div>
                            </div>
                        </div>
                        <div class="glass-card rounded-[28px] p-6">
                            <div class="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/60">What To Watch</div>
                            <div class="mt-4 space-y-3 text-sm leading-7 text-white/84">
                                <?php if ($isMunicipalityOnboarding): ?>
                                    <div><strong>1.</strong> まずどこから観測を始めるか</div>
                                    <div><strong>2.</strong> 誰と始めるか</div>
                                    <div><strong>3.</strong> 初回観測後に何を読むか</div>
                                <?php else: ?>
                                    <div><strong>1.</strong> どのサイトが継続観測できているか</div>
                                    <div><strong>2.</strong> どこが未観測・季節カバー不足か</div>
                                    <div><strong>3.</strong> どこを先に現地確認・委託調査へ回すべきか</div>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section class="surface-card fade-up p-6 md:p-8">
                <div class="max-w-3xl">
                    <div class="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-blue-700">
                        <i data-lucide="target" class="h-4 w-4"></i>
                        Decision Lens
                    </div>
                    <h2 class="mt-4 font-heading text-[2rem] font-black leading-tight tracking-[-0.04em] text-[#12231f] md:text-[2.7rem]">
                        この画面で判断したいのは、3つだけです。
                    </h2>
                </div>
                <div class="mt-6 grid gap-4 lg:grid-cols-3">
                    <?php foreach ($decisionCards as $index => $card): ?>
                        <?php $tone = $index === 1 ? 'bg-amber-50 text-amber-700' : ($index === 2 ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'); ?>
                        <article class="rounded-[26px] border border-[#082f2a]/8 bg-white p-6 shadow-[0_14px_40px_rgba(16,24,40,0.05)]">
                            <div class="inline-flex h-14 w-14 items-center justify-center rounded-[20px] <?= $tone ?>">
                                <i data-lucide="<?= htmlspecialchars($card['icon']) ?>" class="h-5 w-5"></i>
                            </div>
                            <h3 class="mt-4 text-xl font-black leading-8 text-[#12231f]"><?= htmlspecialchars($card['title']) ?></h3>
                            <p class="mt-3 text-sm leading-7 text-slate-600"><?= htmlspecialchars($card['body']) ?></p>
                        </article>
                    <?php endforeach; ?>
                </div>
            </section>

            <?php if ($isMunicipalityOnboarding): ?>
                <section id="municipality-onboarding" class="surface-card fade-up p-6 md:p-8">
                    <div class="max-w-3xl">
                        <div class="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-rose-700">
                            <i data-lucide="route" class="h-4 w-4"></i>
                            First Month
                        </div>
                        <h2 class="mt-4 font-heading text-[2rem] font-black leading-tight tracking-[-0.04em] text-[#12231f] md:text-[2.7rem]">
                            いまは立上げ前。見るべきなのは初月の動きです。
                        </h2>
                        <p class="mt-3 text-[15px] leading-8 text-slate-600">
                            このデモはデータが薄い状態を隠しません。観測が少ないときに、自治体担当がどの順番で立ち上げるかを見るためのサンプルです。
                        </p>
                    </div>
                    <div class="mt-6 grid gap-4 lg:grid-cols-3">
                        <?php foreach ($onboardingActions as $index => $action): ?>
                            <article class="rounded-[26px] border border-[#082f2a]/8 bg-white p-6 shadow-[0_14px_40px_rgba(16,24,40,0.05)]">
                                <div class="inline-flex h-14 w-14 items-center justify-center rounded-[20px] <?= $index === 0 ? 'bg-rose-50 text-rose-700' : ($index === 1 ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700') ?>">
                                    <span class="text-lg font-black"><?= $index + 1 ?></span>
                                </div>
                                <p class="mt-4 text-base font-black leading-8 text-[#12231f]"><?= htmlspecialchars($action) ?></p>
                            </article>
                        <?php endforeach; ?>
                    </div>
                </section>
            <?php endif; ?>

            <section class="grid gap-4 fade-up lg:grid-cols-[0.86fr_1.14fr]">
                <aside class="surface-card p-6 md:p-8">
                    <div class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-emerald-700">
                        <i data-lucide="gauge" class="h-4 w-4"></i>
                        Current State
                    </div>
                    <h2 class="mt-4 text-2xl font-black leading-8 text-[#12231f]">いまの区域サマリー</h2>
                    <div class="mt-5 space-y-3">
                        <div class="rounded-[22px] border border-[#082f2a]/6 bg-slate-50 p-4">
                            <div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">観測継続中のサイト</div>
                            <div class="mt-2 text-3xl font-black text-[#12231f]"><?= $activeSiteCount ?></div>
                        </div>
                        <div class="rounded-[22px] border border-[#082f2a]/6 bg-slate-50 p-4">
                            <div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">未観測・停止中サイト</div>
                            <div class="mt-2 text-3xl font-black text-[#12231f]"><?= $inactiveSiteCount ?></div>
                        </div>
                        <div class="rounded-[22px] border border-[#082f2a]/6 bg-slate-50 p-4">
                            <div class="text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">重点確認候補</div>
                            <div class="mt-2 text-3xl font-black text-[#12231f]"><?= $attentionSiteCount ?></div>
                        </div>
                    </div>
                    <div class="mt-5 rounded-[22px] border border-blue-200 bg-blue-50 p-5 text-sm leading-7 text-blue-900">
                        <?php if ($isMunicipalityOnboarding): ?>
                            いまは立上げ前の空状態サンプルです。何もないことを隠さず、初回観測前後にどこが空白として見えるかを確認するための状態です。
                        <?php else: ?>
                            この画面は、登録サイトの観測状況を束ねたデモです。公式な 30x30 進捗や保護区面積を示すものではありません。
                        <?php endif; ?>
                    </div>
                </aside>

                <section class="surface-card p-6 md:p-8">
                    <div class="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-amber-700">
                        <i data-lucide="map-pinned" class="h-4 w-4"></i>
                        Priority Sites
                    </div>
                    <h2 class="mt-4 font-heading text-[2rem] font-black leading-tight tracking-[-0.04em] text-[#12231f]">
                        まず確認すべきサイト
                    </h2>
                    <div class="mt-6 space-y-3">
                        <?php foreach ($prioritySites as $site): ?>
                            <?php
                            $badgeClass = $site['priority_tone'] === 'rose'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : ($site['priority_tone'] === 'amber'
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : ($site['priority_tone'] === 'sky'
                                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'));
                            ?>
                            <a href="site_dashboard.php?site=<?= urlencode($site['id']) ?>&demo=1" class="block rounded-[24px] border border-[#082f2a]/8 bg-white p-5 transition hover:-translate-y-0.5 hover:border-emerald-200">
                                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div class="min-w-0">
                                        <div class="text-xl font-black leading-8 text-[#12231f]"><?= htmlspecialchars($site['name']) ?></div>
                                        <?php if (!empty($site['description'])): ?>
                                            <p class="mt-2 text-sm leading-7 text-slate-600"><?= htmlspecialchars($site['description']) ?></p>
                                        <?php endif; ?>
                                        <p class="mt-3 text-sm font-medium leading-7 text-slate-600"><?= htmlspecialchars($site['priority_reason']) ?></p>
                                    </div>
                                    <div class="flex flex-wrap gap-2 md:justify-end">
                                        <span class="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] <?= $badgeClass ?>">
                                            <?= htmlspecialchars($site['priority_badge']) ?>
                                        </span>
                                        <span class="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-600">
                                            参考指標 <?= $site['score'] ?>
                                        </span>
                                    </div>
                                </div>
                                <div class="mt-4 grid gap-2 sm:grid-cols-4">
                                    <div class="rounded-[18px] bg-slate-50 p-3 text-center">
                                        <div class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">観測件数</div>
                                        <div class="mt-1 text-lg font-black text-[#12231f]"><?= $site['observations'] ?></div>
                                    </div>
                                    <div class="rounded-[18px] bg-slate-50 p-3 text-center">
                                        <div class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">確認種数</div>
                                        <div class="mt-1 text-lg font-black text-[#12231f]"><?= $site['species'] ?></div>
                                    </div>
                                    <div class="rounded-[18px] bg-slate-50 p-3 text-center">
                                        <div class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">月別カバー</div>
                                        <div class="mt-1 text-lg font-black text-[#12231f]"><?= $site['months'] ?>/12</div>
                                    </div>
                                    <div class="rounded-[18px] bg-slate-50 p-3 text-center">
                                        <div class="text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-500">重要種照合</div>
                                        <div class="mt-1 text-lg font-black text-[#12231f]"><?= $site['redlist'] ?></div>
                                    </div>
                                </div>
                            </a>
                        <?php endforeach; ?>
                    </div>
                </section>
            </section>

            <section class="surface-card fade-up p-6 md:p-8">
                <div class="max-w-3xl">
                    <div class="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-blue-700">
                        <i data-lucide="briefcase-business" class="h-4 w-4"></i>
                        Municipal Use Cases
                    </div>
                    <h2 class="mt-4 font-heading text-[2rem] font-black leading-tight tracking-[-0.04em] text-[#12231f] md:text-[2.7rem]">
                        自治体での使いどころ
                    </h2>
                </div>
                <div class="mt-6 grid gap-4 lg:grid-cols-3">
                    <?php foreach ($useCases as $index => $useCase): ?>
                        <?php $tone = $index === 1 ? 'bg-amber-50 text-amber-700' : ($index === 2 ? 'bg-sky-50 text-sky-700' : 'bg-emerald-50 text-emerald-700'); ?>
                        <article class="rounded-[26px] border border-[#082f2a]/8 bg-white p-6 shadow-[0_14px_40px_rgba(16,24,40,0.05)]">
                            <div class="inline-flex h-14 w-14 items-center justify-center rounded-[20px] <?= $tone ?>">
                                <i data-lucide="<?= $index === 1 ? 'clipboard-list' : ($index === 2 ? 'megaphone' : 'building-2') ?>" class="h-5 w-5"></i>
                            </div>
                            <h3 class="mt-4 text-xl font-black leading-8 text-[#12231f]"><?= htmlspecialchars($useCase['title']) ?></h3>
                            <p class="mt-3 text-sm leading-7 text-slate-600"><?= htmlspecialchars($useCase['body']) ?></p>
                        </article>
                    <?php endforeach; ?>
                </div>
            </section>
        </div>
    </main>

    <script nonce="<?= CspNonce::attr() ?>">
        if (window.lucide) {
            window.lucide.createIcons();
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-visible');
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.16 });

        document.querySelectorAll('.fade-up').forEach((element) => observer.observe(element));
    </script>
</body>

</html>
