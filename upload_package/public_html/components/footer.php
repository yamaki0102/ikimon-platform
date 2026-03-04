<!-- Footer Component -->
<footer class="border-t border-border bg-base py-12 px-6 pb-32 md:pb-12">
    <div class="max-w-7xl mx-auto">

        <!-- 3-Column Footer Links -->
        <div class="grid grid-cols-2 md:grid-cols-3 gap-8 mb-10 text-sm font-bold text-muted px-4">
            <!-- Column 1: ikimon -->
            <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-faint mb-3">ikimon</p>
                <div class="flex flex-col gap-2">
                    <a href="about.php" class="hover:text-text transition"><?php echo __('nav.about'); ?></a>
                    <a href="faq.php" class="hover:text-text transition"><?php echo __('nav.faq'); ?></a>
                    <a href="team.php" class="hover:text-text transition"><?php echo __('nav.team'); ?></a>
                    <a href="updates.php" class="hover:text-text transition"><?php echo __('nav.updates'); ?></a>
                    <a href="mailto:contact@ikimon.life" class="hover:text-text transition"><?php echo __('nav.contact'); ?></a>
                </div>
            </div>

            <!-- Column 2: Service -->
            <div>
                <p class="text-[10px] font-black uppercase tracking-widest text-faint mb-3">Service</p>
                <div class="flex flex-col gap-2">
                    <a href="for-business/" class="hover:text-primary transition"><?php echo __('nav.business'); ?></a>
                    <a href="for-researcher.php" class="hover:text-text transition">研究者・専門家様</a>
                    <a href="showcase.php" class="hover:text-text transition"><?php echo __('nav.showcase'); ?></a>
                    <button onclick="localStorage.removeItem('ikimon_onboarded'); location.reload();" class="hover:text-text transition text-left"><?php echo __('nav.beginners'); ?></button>
                </div>
            </div>

            <!-- Column 3: Legal -->
            <div class="col-span-2 md:col-span-1">
                <p class="text-[10px] font-black uppercase tracking-widest text-faint mb-3">Legal</p>
                <div class="flex flex-col gap-2">
                    <a href="terms.php" class="hover:text-text transition"><?php echo __('nav.terms'); ?></a>
                    <a href="privacy.php" class="hover:text-text transition"><?php echo __('nav.privacy'); ?></a>
                    <a href="guidelines.php" class="hover:text-text transition"><?php echo __('nav.guidelines'); ?></a>
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