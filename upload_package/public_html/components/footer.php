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
<footer class="border-t border-border bg-[#f8fafc] px-6 pb-32 pt-16 md:pb-14">
    <div class="mx-auto max-w-6xl">
        <div class="grid gap-12 border-b border-slate-200 pb-12 lg:grid-cols-[1.25fr_1fr_1fr_1fr]">
            <section class="max-w-sm">
                <div class="flex items-center gap-2">
                    <div class="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                        <span class="text-sm font-black">i</span>
                    </div>
                    <span class="font-heading text-lg font-black text-slate-900">ikimon</span>
                </div>
                <p class="mt-4 text-sm leading-7 text-slate-600">
                    <?= htmlspecialchars(__('footer.summary', 'Save what you found nearby and review it later, place by place.')) ?>
                </p>
            </section>

            <?php
            $footerGroups = [
                __('footer.group_start', 'Start') => [
                    ['/explore.php', __('footer.link_explore', 'Discover')],
                    ['/post.php', __('footer.link_record', 'Record')],
                    ['/profile.php', __('footer.link_my_places', 'My places')],
                    ['/events.php', __('footer.link_events', 'Events')],
                ],
                __('footer.group_learn', 'Learn') => [
                    ['/guides.php', __('footer.link_guides', 'Guide list')],
                    ['/guide_results.php', __('footer.link_guide_results', 'ガイド成果確認')],
                    ['/about.php', __('nav.about')],
                    ['/faq.php', __('nav.faq')],
                    ['/updates.php', __('nav.updates')],
                ],
                __('footer.group_trust', 'Trust') => [
                    ['/for-business/', __('footer.link_business', 'Support as an organization')],
                    ['/contact.php', __('nav.contact')],
                    ['/terms.php', __('nav.terms')],
                    ['/privacy.php', __('nav.privacy')],
                ],
            ];
            ?>
            <?php foreach ($footerGroups as $groupTitle => $links): ?>
                <section>
                    <p class="text-[11px] font-black uppercase tracking-[0.16em] text-slate-400"><?= htmlspecialchars($groupTitle) ?></p>
                    <div class="mt-4 flex flex-col gap-3">
                        <?php foreach ($links as [$href, $label]): ?>
                            <a href="<?= $_fBase . $href ?>" class="text-sm font-medium text-slate-700 transition hover:text-slate-900 hover:underline underline-offset-4">
                                <?= htmlspecialchars($label) ?>
                            </a>
                        <?php endforeach; ?>
                    </div>
                </section>
            <?php endforeach; ?>
        </div>

        <div class="flex flex-col gap-3 pt-6 text-xs text-slate-500 md:flex-row md:items-center md:justify-between">
            <p><?= __('nav.copyright') ?></p>
            <p><?= htmlspecialchars(__('footer.bottom_note', 'Keep nearby nature records in a form you can revisit later.')) ?></p>
        </div>
    </div>
</footer>

<?php include __DIR__ . '/cookie_consent.php'; ?>

<!-- Passive Step Tracker (site-wide) -->
<?php if (!(defined('IS_STAGING_SITE') && IS_STAGING_SITE)): ?>
<script src="<?= $_fBase ?>/js/StepCounter.js" nonce="<?= CspNonce::attr() ?>"></script>
<script src="<?= $_fBase ?>/js/PassiveStepTracker.js" nonce="<?= CspNonce::attr() ?>"></script>
<?php endif; ?>
