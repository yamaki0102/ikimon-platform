<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/DataStore.php';
require_once __DIR__ . '/../libs/Lang.php';
require_once __DIR__ . '/../libs/Services/EventLogService.php';
require_once __DIR__ . '/../libs/Services/SurveyLogService.php';

Auth::init();
Lang::init();

$user = Auth::user();
if (!$user) {
    header('Location: login.php?redirect=' . urlencode('guide_results.php'));
    exit;
}

$documentLang = method_exists('Lang', 'current') ? Lang::current() : 'ja';
$meta_title = __('guide_results.meta_title', 'ガイド成果確認');
$meta_description = __('guide_results.meta_description', '学び、観察、地図、調査成果をひとつの流れで振り返るページです。');

$allObs = DataStore::fetchAll('observations');
$userObs = array_values(array_filter($allObs, function ($obs) use ($user) {
    return isset($obs['user_id']) && (string)$obs['user_id'] === (string)$user['id'];
}));

usort($userObs, function ($a, $b) {
    return strtotime((string)($b['observed_at'] ?? $b['created_at'] ?? '')) <=> strtotime((string)($a['observed_at'] ?? $a['created_at'] ?? ''));
});

$species = [];
$places = [];
$months = [];
$identifiedCount = 0;
$openLicenseCount = 0;

foreach ($userObs as $obs) {
    $taxonKey = $obs['taxon']['key'] ?? $obs['taxon']['scientific_name'] ?? $obs['taxon']['name'] ?? $obs['taxon_name'] ?? null;
    if ($taxonKey) {
        $species[(string)$taxonKey] = true;
        $identifiedCount++;
    }

    $placeKey = trim((string)($obs['prefecture'] ?? '') . ':' . (string)($obs['municipality'] ?? ''));
    if ($placeKey !== ':') {
        $places[$placeKey] = true;
    }

    $dateRaw = (string)($obs['observed_at'] ?? $obs['created_at'] ?? '');
    $ts = $dateRaw !== '' ? strtotime($dateRaw) : false;
    if ($ts) {
        $months[date('Y-m', $ts)] = true;
    }

    $license = strtoupper((string)($obs['license'] ?? ''));
    if (in_array($license, ['CC-BY', 'CC0'], true)) {
        $openLicenseCount++;
    }
}

$recordCount = count($userObs);
$speciesCount = count($species);
$placeCount = count($places);
$monthCount = count($months);
$identifiedRate = $recordCount > 0 ? (int)round($identifiedCount / $recordCount * 100) : 0;
$openLicenseRate = $recordCount > 0 ? (int)round($openLicenseCount / $recordCount * 100) : 0;
$latestObs = $userObs[0] ?? null;
$eventStats = EventLogService::getUserEventStats($user['id']);
$surveyStats = SurveyLogService::getUserSurveyStats($user['id']);

$recentObs = array_slice($userObs, 0, 6);

require_once __DIR__ . '/components/experience_loop.php';
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang, ENT_QUOTES, 'UTF-8') ?>">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
</head>
<body class="js-loading pt-14 bg-base text-text font-body">
    <?php include __DIR__ . '/components/nav.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <main class="max-w-7xl mx-auto px-4 md:px-6 py-10 md:py-20 pb-32">
        <section class="grid lg:grid-cols-[1.05fr_0.95fr] gap-6 md:gap-8 items-stretch">
            <div class="rounded-[var(--shape-xl)] border border-[var(--color-border)] bg-[var(--md-surface-container)] p-6 md:p-8 shadow-sm">
                <p class="text-[10px] font-black uppercase tracking-[0.16em] text-primary mb-3"><?= htmlspecialchars(__('guide_results.eyebrow', 'Outcome review'), ENT_QUOTES, 'UTF-8') ?></p>
                <h1 class="text-3xl md:text-5xl font-black leading-tight text-text"><?= htmlspecialchars(__('guide_results.title', 'ガイド成果確認'), ENT_QUOTES, 'UTF-8') ?></h1>
                <p class="mt-4 max-w-2xl text-sm md:text-base leading-8 text-muted">
                    <?= htmlspecialchars(__('guide_results.lead', '読んだガイドを、行動の成果に戻すためのページです。観察、地図、調査、再訪の状況を見て、次の一手を決められます。'), ENT_QUOTES, 'UTF-8') ?>
                </p>
                <div class="mt-6 flex flex-wrap gap-3">
                    <a href="/post.php" class="btn-primary">
                        <i data-lucide="camera" class="w-4 h-4"></i>
                        <?= htmlspecialchars(__('guide_results.cta_record', '記録する'), ENT_QUOTES, 'UTF-8') ?>
                    </a>
                    <a href="/map.php" class="btn-secondary">
                        <i data-lucide="map" class="w-4 h-4"></i>
                        <?= htmlspecialchars(__('guide_results.cta_map', '地図で見る'), ENT_QUOTES, 'UTF-8') ?>
                    </a>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-3 md:gap-4">
                <?php foreach ([
                    ['value' => $recordCount, 'label' => __('guide_results.stat_records', '観察記録'), 'icon' => 'camera'],
                    ['value' => $speciesCount, 'label' => __('guide_results.stat_species', '見つけた種'), 'icon' => 'leaf'],
                    ['value' => $placeCount, 'label' => __('guide_results.stat_places', '記録した場所'), 'icon' => 'map-pin'],
                    ['value' => $monthCount, 'label' => __('guide_results.stat_months', '継続月数'), 'icon' => 'calendar-days'],
                ] as $stat): ?>
                    <div class="rounded-[var(--shape-xl)] border border-[var(--color-border)] bg-white/80 p-5 shadow-sm">
                        <i data-lucide="<?= htmlspecialchars($stat['icon'], ENT_QUOTES, 'UTF-8') ?>" class="w-5 h-5 text-primary mb-4"></i>
                        <p class="text-3xl md:text-4xl font-black text-text"><?= number_format((int)$stat['value']) ?></p>
                        <p class="mt-1 text-xs font-bold text-muted"><?= htmlspecialchars((string)$stat['label'], ENT_QUOTES, 'UTF-8') ?></p>
                    </div>
                <?php endforeach; ?>
            </div>
        </section>

        <?php renderExperienceLoop([
            'current' => 'results',
            'class' => 'mt-8',
            'title' => __('guide_results.loop_title', '成果から次の観察へ戻る'),
            'lead' => __('guide_results.loop_lead', '成果確認はゴールではなく、次の観察地点や学ぶテーマを選ぶための中継点です。'),
            'stat_label' => __('guide_results.loop_stat_label', '同定済み'),
            'stat_value' => $identifiedRate . '%',
        ]); ?>

        <section class="mt-8 grid lg:grid-cols-3 gap-4 md:gap-6">
            <div class="rounded-[var(--shape-xl)] border border-[var(--color-border)] bg-white/85 p-5 md:p-6 shadow-sm">
                <div class="flex items-center gap-3 mb-4">
                    <span class="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <i data-lucide="check-circle-2" class="w-5 h-5"></i>
                    </span>
                    <div>
                        <h2 class="text-lg font-black text-text"><?= htmlspecialchars(__('guide_results.quality_title', '記録の使いやすさ'), ENT_QUOTES, 'UTF-8') ?></h2>
                        <p class="text-xs text-muted"><?= htmlspecialchars(__('guide_results.quality_sub', '同定と再利用の状態'), ENT_QUOTES, 'UTF-8') ?></p>
                    </div>
                </div>
                <div class="space-y-4">
                    <div>
                        <div class="flex justify-between text-xs font-bold text-muted mb-2">
                            <span><?= htmlspecialchars(__('guide_results.identified_rate', '名前が付いている記録'), ENT_QUOTES, 'UTF-8') ?></span>
                            <span><?= $identifiedRate ?>%</span>
                        </div>
                        <div class="h-2 rounded-full bg-surface overflow-hidden"><div class="h-full bg-primary rounded-full" style="width:<?= $identifiedRate ?>%"></div></div>
                    </div>
                    <div>
                        <div class="flex justify-between text-xs font-bold text-muted mb-2">
                            <span><?= htmlspecialchars(__('guide_results.open_license_rate', '研究に使いやすいライセンス'), ENT_QUOTES, 'UTF-8') ?></span>
                            <span><?= $openLicenseRate ?>%</span>
                        </div>
                        <div class="h-2 rounded-full bg-surface overflow-hidden"><div class="h-full bg-secondary rounded-full" style="width:<?= $openLicenseRate ?>%"></div></div>
                    </div>
                </div>
            </div>

            <div class="rounded-[var(--shape-xl)] border border-[var(--color-border)] bg-white/85 p-5 md:p-6 shadow-sm">
                <div class="flex items-center gap-3 mb-4">
                    <span class="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-secondary/10 text-secondary">
                        <i data-lucide="users" class="w-5 h-5"></i>
                    </span>
                    <div>
                        <h2 class="text-lg font-black text-text"><?= htmlspecialchars(__('guide_results.community_title', '一緒に調べた成果'), ENT_QUOTES, 'UTF-8') ?></h2>
                        <p class="text-xs text-muted"><?= htmlspecialchars(__('guide_results.community_sub', '観察会と調査ログ'), ENT_QUOTES, 'UTF-8') ?></p>
                    </div>
                </div>
                <div class="grid grid-cols-3 gap-2">
                    <div class="rounded-2xl bg-surface p-3 text-center">
                        <p class="text-xl font-black text-text"><?= number_format((int)($eventStats['event_count'] ?? 0)) ?></p>
                        <p class="text-[10px] font-bold text-muted"><?= htmlspecialchars(__('guide_results.events', '観察会'), ENT_QUOTES, 'UTF-8') ?></p>
                    </div>
                    <div class="rounded-2xl bg-surface p-3 text-center">
                        <p class="text-xl font-black text-text"><?= number_format((int)($surveyStats['survey_count'] ?? 0)) ?></p>
                        <p class="text-[10px] font-bold text-muted"><?= htmlspecialchars(__('guide_results.surveys', '調査'), ENT_QUOTES, 'UTF-8') ?></p>
                    </div>
                    <div class="rounded-2xl bg-surface p-3 text-center">
                        <p class="text-xl font-black text-text"><?= number_format((int)($surveyStats['total_species'] ?? 0)) ?></p>
                        <p class="text-[10px] font-bold text-muted"><?= htmlspecialchars(__('guide_results.survey_species', '調査種'), ENT_QUOTES, 'UTF-8') ?></p>
                    </div>
                </div>
                <a href="/survey.php" class="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary">
                    <?= htmlspecialchars(__('guide_results.join_survey', '調査に参加する'), ENT_QUOTES, 'UTF-8') ?>
                    <i data-lucide="arrow-right" class="w-4 h-4"></i>
                </a>
            </div>

            <div class="rounded-[var(--shape-xl)] border border-[var(--color-border)] bg-white/85 p-5 md:p-6 shadow-sm">
                <div class="flex items-center gap-3 mb-4">
                    <span class="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                        <i data-lucide="route" class="w-5 h-5"></i>
                    </span>
                    <div>
                        <h2 class="text-lg font-black text-text"><?= htmlspecialchars(__('guide_results.next_title', '次の一手'), ENT_QUOTES, 'UTF-8') ?></h2>
                        <p class="text-xs text-muted"><?= htmlspecialchars(__('guide_results.next_sub', 'いま一番つながりやすい行動'), ENT_QUOTES, 'UTF-8') ?></p>
                    </div>
                </div>
                <div class="space-y-2">
                    <?php if ($recordCount === 0): ?>
                        <a href="/post.php" class="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-surface p-3 text-sm font-bold text-text">
                            <?= htmlspecialchars(__('guide_results.next_first_record', '最初の観察を投稿する'), ENT_QUOTES, 'UTF-8') ?>
                            <i data-lucide="camera" class="w-4 h-4 text-primary"></i>
                        </a>
                    <?php else: ?>
                        <a href="/map.php" class="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-surface p-3 text-sm font-bold text-text">
                            <?= htmlspecialchars(__('guide_results.next_map', '記録した場所を地図で見る'), ENT_QUOTES, 'UTF-8') ?>
                            <i data-lucide="map" class="w-4 h-4 text-primary"></i>
                        </a>
                        <a href="/id_workbench.php" class="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-surface p-3 text-sm font-bold text-text">
                            <?= htmlspecialchars(__('guide_results.next_identify', '名前が弱い記録を見直す'), ENT_QUOTES, 'UTF-8') ?>
                            <i data-lucide="microscope" class="w-4 h-4 text-primary"></i>
                        </a>
                        <a href="/guides.php" class="flex items-center justify-between rounded-2xl border border-[var(--color-border)] bg-surface p-3 text-sm font-bold text-text">
                            <?= htmlspecialchars(__('guide_results.next_guides', '次に読むガイドを選ぶ'), ENT_QUOTES, 'UTF-8') ?>
                            <i data-lucide="book-open" class="w-4 h-4 text-primary"></i>
                        </a>
                    <?php endif; ?>
                </div>
            </div>
        </section>

        <section class="mt-8 rounded-[var(--shape-xl)] border border-[var(--color-border)] bg-white/85 p-5 md:p-6 shadow-sm">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-5">
                <div>
                    <h2 class="text-xl font-black text-text"><?= htmlspecialchars(__('guide_results.recent_title', '最近の観察'), ENT_QUOTES, 'UTF-8') ?></h2>
                    <p class="text-sm text-muted"><?= htmlspecialchars(__('guide_results.recent_sub', '成果は個別の記録から育ちます。'), ENT_QUOTES, 'UTF-8') ?></p>
                </div>
                <a href="/profile.php" class="inline-flex items-center gap-2 text-sm font-bold text-primary">
                    <?= htmlspecialchars(__('guide_results.view_profile', 'マイページで詳しく見る'), ENT_QUOTES, 'UTF-8') ?>
                    <i data-lucide="arrow-right" class="w-4 h-4"></i>
                </a>
            </div>

            <?php if ($recentObs === []): ?>
                <div class="rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-surface p-8 text-center">
                    <p class="text-sm font-bold text-muted"><?= htmlspecialchars(__('guide_results.empty', 'まだ観察がありません。最初の一件から成果確認が始まります。'), ENT_QUOTES, 'UTF-8') ?></p>
                </div>
            <?php else: ?>
                <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <?php foreach ($recentObs as $obs):
                        $photo = $obs['photos'][0] ?? '';
                        $name = $obs['taxon']['name'] ?? $obs['taxon_name'] ?? __('guide_results.unknown_species', '種名募集中');
                        $date = (string)($obs['observed_at'] ?? $obs['created_at'] ?? '');
                        $dateTs = $date !== '' ? strtotime($date) : false;
                    ?>
                        <a href="/observation_detail.php?id=<?= urlencode((string)($obs['id'] ?? '')) ?>" class="group block rounded-2xl border border-[var(--color-border)] bg-surface overflow-hidden no-underline">
                            <div class="aspect-square bg-white overflow-hidden">
                                <?php if ($photo !== ''): ?>
                                    <img src="<?= htmlspecialchars($photo, ENT_QUOTES, 'UTF-8') ?>" alt="<?= htmlspecialchars((string)$name, ENT_QUOTES, 'UTF-8') ?>" class="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy">
                                <?php else: ?>
                                    <div class="h-full w-full flex items-center justify-center text-muted">
                                        <i data-lucide="image-off" class="w-7 h-7"></i>
                                    </div>
                                <?php endif; ?>
                            </div>
                            <div class="p-3">
                                <p class="truncate text-xs font-black text-text"><?= htmlspecialchars((string)$name, ENT_QUOTES, 'UTF-8') ?></p>
                                <p class="mt-1 text-[10px] text-muted"><?= $dateTs ? htmlspecialchars(date('Y.m.d', $dateTs), ENT_QUOTES, 'UTF-8') : '' ?></p>
                            </div>
                        </a>
                    <?php endforeach; ?>
                </div>
            <?php endif; ?>
        </section>
    </main>

    <?php include __DIR__ . '/components/footer.php'; ?>
    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
</body>
</html>
