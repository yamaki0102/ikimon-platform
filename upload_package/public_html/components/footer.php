<?php
/**
 * Shared Footer Component — Self-contained, works on ALL pages.
 *
 * Dependencies auto-loaded if missing:
 *   - Lang.php  (for __() translations)
 *   - CspNonce  (for script nonces)
 *   - config.php → BASE_URL (for absolute href paths)
 */

// Auto-load Lang if the calling page hasn't loaded it (e.g. for-business LP)
if (!function_exists('__')) {
    require_once __DIR__ . '/../../libs/Lang.php';
    Lang::init();
}
if (!class_exists('CspNonce')) {
    require_once __DIR__ . '/../../libs/CspNonce.php';
}

// Absolute base for hrefs — works from any subdirectory
$_fBase = defined('BASE_URL') ? rtrim(BASE_URL, '/') : '';
?>

<!-- Site Footer -->
<footer class="border-t border-border bg-gradient-to-b from-base to-surface pt-12 pb-32 md:pb-12 px-6">
    <div class="max-w-7xl mx-auto">

        <!-- Footer Links Grid -->
        <div class="grid grid-cols-1 md:grid-cols-[1fr_1.4fr_0.9fr] gap-4 mb-10 px-4">

            <!-- Column 1: ikimon -->
            <section class="flex flex-col gap-3 p-5 border border-border rounded-3xl bg-white/70 shadow-sm">
                <p class="text-[10px] font-black uppercase tracking-[0.14em] text-faint m-0">ikimon</p>
                <p class="text-[13px] leading-relaxed text-muted m-0">プロジェクトの考え方、更新情報、問い合わせ先をまとめた入口。</p>
                <div class="flex flex-col gap-2.5">
                    <?php foreach ([
                        ['/about.php',   __('nav.about'),   'ikimon の目的と運営の考え方'],
                        ['/faq.php',     __('nav.faq'),     'はじめる前によくある疑問を確認'],
                        ['/updates.php', __('nav.updates'), '新機能や改善の履歴'],
                        ['/contact.php', __('nav.contact'), '運営への相談・導入相談・共同実証・取材の窓口'],
                    ] as [$href, $main, $sub]): ?>
                    <a href="<?= $_fBase . $href ?>"
                       class="group flex items-start justify-between gap-3 text-text no-underline transition-transform duration-150 hover:translate-x-0.5">
                        <span>
                            <span class="block font-bold text-sm leading-snug"><?= $main ?></span>
                            <span class="block mt-0.5 font-medium text-xs leading-relaxed text-muted"><?= $sub ?></span>
                        </span>
                        <span class="flex-none text-xs text-faint leading-snug mt-0.5 group-hover:text-muted transition-colors">↗</span>
                    </a>
                    <?php endforeach; ?>
                </div>
            </section>

            <!-- Column 2: Service -->
            <section class="flex flex-col gap-3 p-5 border border-border rounded-3xl bg-white/70 shadow-sm">
                <p class="text-[10px] font-black uppercase tracking-[0.14em] text-faint m-0">Service</p>
                <p class="text-[13px] leading-relaxed text-muted m-0">学ぶ、活かす、つなげる。目的別に探しやすく再編した導線。</p>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <!-- Learn -->
                    <div class="p-3.5 rounded-[18px] bg-surface border border-border">
                        <p class="text-[11px] font-extrabold tracking-wide uppercase text-faint mb-2.5">Learn</p>
                        <div class="flex flex-col gap-2">
                            <?php foreach ([
                                ['/guides.php',                          '解説ガイド一覧',         'テーマごとの読み物をまとめて探す'],
                                ['/guide/regional-biodiversity.php',     '地方創生と生物多様性',   '地域づくりと自然資本の接点を知る'],
                                ['/guide/nature-positive.php',           'ネイチャーポジティブガイド', 'いま必要な考え方をやさしく整理'],
                                ['/guide/walking-brain-science.php',     'お散歩と脳科学',          '日常観察が心身に与える意味を読む'],
                            ] as [$href, $main, $sub]): ?>
                            <a href="<?= $_fBase . $href ?>"
                               class="group flex items-start justify-between gap-3 text-text no-underline transition-transform duration-150 hover:translate-x-0.5">
                                <span>
                                    <span class="block font-bold text-[13px] leading-snug"><?= $main ?></span>
                                    <span class="block mt-0.5 font-medium text-xs leading-relaxed text-muted"><?= $sub ?></span>
                                </span>
                                <span class="flex-none text-xs text-faint leading-snug mt-0.5 group-hover:text-muted transition-colors">↗</span>
                            </a>
                            <?php endforeach; ?>
                        </div>
                    </div>
                    <!-- Apply -->
                    <div class="p-3.5 rounded-[18px] bg-surface border border-border">
                        <p class="text-[11px] font-extrabold tracking-wide uppercase text-faint mb-2.5">Apply</p>
                        <div class="flex flex-col gap-2">
                            <?php foreach ([
                                ['/for-business/',      __('nav.business'),      '企業・自治体との活用イメージ'],
                                ['/for-researcher.php', 'データを持ち帰りたい方へ', '研究・分析用途での活用方法'],
                                ['/century_archive.php','記録が保全に変わる理由', '投稿が未来の保全に接続する仕組み'],
                            ] as [$href, $main, $sub]): ?>
                            <a href="<?= $_fBase . $href ?>"
                               class="group flex items-start justify-between gap-3 text-text no-underline transition-transform duration-150 hover:translate-x-0.5">
                                <span>
                                    <span class="block font-bold text-[13px] leading-snug"><?= $main ?></span>
                                    <span class="block mt-0.5 font-medium text-xs leading-relaxed text-muted"><?= $sub ?></span>
                                </span>
                                <span class="flex-none text-xs text-faint leading-snug mt-0.5 group-hover:text-muted transition-colors">↗</span>
                            </a>
                            <?php endforeach; ?>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Column 3: Legal -->
            <section class="flex flex-col gap-3 p-5 border border-border rounded-3xl bg-white/70 shadow-sm">
                <p class="text-[10px] font-black uppercase tracking-[0.14em] text-faint m-0">Legal</p>
                <p class="text-[13px] leading-relaxed text-muted m-0">安心して参加するための基本ルールと取り扱い。</p>
                <div class="flex flex-col gap-2.5">
                    <?php foreach ([
                        ['/terms.php',     __('nav.terms'),     'サービス利用時の基本条件'],
                        ['/privacy.php',   __('nav.privacy'),   '個人情報と観察データの扱い'],
                        ['/guidelines.php',__('nav.guidelines'),'コミュニティ参加時の行動指針'],
                    ] as [$href, $main, $sub]): ?>
                    <a href="<?= $_fBase . $href ?>"
                       class="group flex items-start justify-between gap-3 text-text no-underline transition-transform duration-150 hover:translate-x-0.5">
                        <span>
                            <span class="block font-bold text-sm leading-snug"><?= $main ?></span>
                            <span class="block mt-0.5 font-medium text-xs leading-relaxed text-muted"><?= $sub ?></span>
                        </span>
                        <span class="flex-none text-xs text-faint leading-snug mt-0.5 group-hover:text-muted transition-colors">↗</span>
                    </a>
                    <?php endforeach; ?>
                </div>
            </section>
        </div>

        <!-- Logo & Copyright -->
        <div class="flex flex-col items-center border-t border-border pt-8">
            <div class="flex items-center justify-center gap-2 mb-4 opacity-45">
                <div class="w-6 h-6 bg-surface rounded-lg"></div>
                <span class="font-bold font-heading">ikimon</span>
            </div>
            <p class="text-muted text-xs text-center"><?= __('nav.copyright') ?></p>
        </div>

    </div>
</footer>

<?php include __DIR__ . '/cookie_consent.php'; ?>

<!-- Passive Step Tracker (site-wide) -->
<script src="<?= $_fBase ?>/js/StepCounter.js" nonce="<?= CspNonce::attr() ?>"></script>
<script src="<?= $_fBase ?>/js/PassiveStepTracker.js" nonce="<?= CspNonce::attr() ?>"></script>
