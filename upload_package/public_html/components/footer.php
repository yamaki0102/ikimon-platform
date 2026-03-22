<!-- Footer Component -->
<footer class="border-t border-border bg-base py-12 px-6 pb-32 md:pb-12">
    <div class="max-w-7xl mx-auto">

        <!-- 4-Column Footer Links -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10 text-sm font-bold text-muted px-4">
            <!-- Column 1: ikimon -->
            <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-faint mb-3">ikimon</p>
                <div class="flex flex-col gap-0">
                    <a href="/about.php" class="hover:text-text transition py-2 min-h-11 flex items-center"><?php echo __('nav.about'); ?></a>
                    <a href="/guide/ikimon-approach.php" class="hover:text-text transition py-2 min-h-11 flex items-center">ikimon のアプローチ</a>
                    <a href="/faq.php" class="hover:text-text transition py-2 min-h-11 flex items-center"><?php echo __('nav.faq'); ?></a>
                    <a href="/updates.php" class="hover:text-text transition py-2 min-h-11 flex items-center"><?php echo __('nav.updates'); ?></a>
                    <a href="mailto:contact@ikimon.life" class="hover:text-text transition py-2 min-h-11 flex items-center"><?php echo __('nav.contact'); ?></a>
                </div>
            </div>

            <!-- Column 2: ガイド -->
            <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-faint mb-3">Guides</p>
                <div class="flex flex-col gap-0">
                    <a href="/guide/nature-positive.php" class="hover:text-text transition py-2 min-h-11 flex items-center">ネイチャーポジティブガイド</a>
                    <a href="/guide/satoyama-initiative.php" class="hover:text-text transition py-2 min-h-11 flex items-center">里山イニシアティブガイド</a>
                    <a href="/guide/walking-brain-science.php" class="hover:text-text transition py-2 min-h-11 flex items-center">自然と健康の科学</a>
                    <a href="/guide/regional-biodiversity.php" class="hover:text-text transition py-2 min-h-11 flex items-center">地方創生と生きもの</a>
                    <a href="/guide/japan-biodiversity.php" class="hover:text-text transition py-2 min-h-11 flex items-center">日本の生物多様性</a>
                    <a href="/guidelines.php" class="hover:text-text transition py-2 min-h-11 flex items-center"><?php echo __('nav.guidelines'); ?></a>
                </div>
            </div>

            <!-- Column 3: ビジネス -->
            <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-faint mb-3">Business</p>
                <div class="flex flex-col gap-0">
                    <a href="/for-business/" class="hover:text-text transition py-2 min-h-11 flex items-center"><?php echo __('nav.business'); ?></a>
                    <a href="/for-researcher.php" class="hover:text-text transition py-2 min-h-11 flex items-center">研究者・専門家様</a>
                    <a href="/pricing.php" class="hover:text-text transition py-2 min-h-11 flex items-center">料金プラン</a>
                </div>
            </div>

            <!-- Column 4: 法的情報 -->
            <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-faint mb-3">Legal</p>
                <div class="flex flex-col gap-0">
                    <a href="/terms.php" class="hover:text-text transition py-2 min-h-11 flex items-center"><?php echo __('nav.terms'); ?></a>
                    <a href="/privacy.php" class="hover:text-text transition py-2 min-h-11 flex items-center"><?php echo __('nav.privacy'); ?></a>
                </div>
            </div>
        </div>

        <!-- Logo & Copyright -->
        <div class="flex flex-col items-center border-t border-border pt-8">
            <div class="flex items-center justify-center gap-2 mb-4 opacity-30">
                <div class="w-6 h-6 bg-surface rounded-lg"></div>
                <span class="font-bold font-heading">ikimon</span>
            </div>
            <p class="text-[var(--color-text-muted)] text-xs text-center">
                <?php echo __('nav.copyright'); ?>
            </p>
        </div>
    </div>
</footer>

<?php include __DIR__ . '/cookie_consent.php'; ?>

<!-- Passive Step Tracker (site-wide) -->
<script src="/js/StepCounter.js" nonce="<?= CspNonce::attr() ?>"></script>
<script src="/js/PassiveStepTracker.js" nonce="<?= CspNonce::attr() ?>"></script>