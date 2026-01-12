<!-- Footer Component -->
<footer class="border-t border-white/5 bg-[var(--color-bg-base)] py-12 px-6 pb-32 md:pb-12">
    <div class="max-w-7xl mx-auto flex flex-col items-center">
        
        <div class="flex flex-wrap justify-center gap-4 md:gap-6 mb-8 text-xs md:text-sm font-bold text-gray-400 px-4">
            <a href="about.php" class="hover:text-white transition whitespace-nowrap"><?php echo __('nav.about'); ?></a>
            <a href="team.php" class="hover:text-white transition whitespace-nowrap"><?php echo __('nav.team'); ?></a>
            <a href="updates.php" class="hover:text-white transition whitespace-nowrap"><?php echo __('nav.updates'); ?></a>
            <a href="guidelines.php" class="hover:text-white transition whitespace-nowrap"><?php echo __('nav.guidelines'); ?></a>
            <a href="terms.php" class="hover:text-white transition whitespace-nowrap"><?php echo __('nav.terms'); ?></a>
            <a href="privacy.php" class="hover:text-white transition whitespace-nowrap"><?php echo __('nav.privacy'); ?></a>
            <a href="mailto:contact@ikimon.life" class="hover:text-white transition whitespace-nowrap"><?php echo __('nav.contact'); ?></a>
            <a href="for-business.php" class="hover:text-[var(--color-primary)] transition border-l border-white/20 pl-4 md:pl-6 whitespace-nowrap"><?php echo __('nav.business'); ?></a>
        </div>

        <div class="flex items-center justify-center gap-2 mb-6 opacity-30">
            <div class="w-6 h-6 bg-white/20 rounded-lg"></div>
            <span class="font-bold font-heading">ikimon</span>
        </div>
        <p class="text-[var(--color-text-muted)] text-xs">
            <?php echo __('nav.copyright'); ?>
        </p>
    </div>
</footer>

