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

<!-- Site Footer (self-styled — no Tailwind dependency) -->
<style>
.sf{border-top:1px solid var(--color-border,#e5e7eb);background:var(--color-bg-base,#fff);padding:48px 24px 128px}
@media(min-width:768px){.sf{padding-bottom:48px}}
.sf-in{max-width:80rem;margin:0 auto}
.sf-grid{display:grid;grid-template-columns:1fr 1fr;gap:32px;margin-bottom:40px;font-size:14px;font-weight:700;color:var(--color-text-muted,#6b7280);padding:0 16px}
@media(min-width:768px){.sf-grid{grid-template-columns:1fr 1fr 1fr}}
.sf-legal{grid-column:span 2}
@media(min-width:768px){.sf-legal{grid-column:span 1}}
.sf-h{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:var(--color-text-faint,#9ca3af);margin:0 0 12px}
.sf-links{display:flex;flex-direction:column;gap:8px}
.sf-links a,.sf-links button{color:inherit;text-decoration:none;background:none;border:none;cursor:pointer;font:inherit;padding:0;text-align:left;transition:color .15s}
.sf-links a:hover,.sf-links button:hover{color:var(--color-text,#111827)}
.sf-bot{display:flex;flex-direction:column;align-items:center;border-top:1px solid var(--color-border,#e5e7eb);padding-top:32px}
.sf-logo{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:16px;opacity:.3}
.sf-logo-box{width:24px;height:24px;background:var(--color-bg-surface,#f3f4f6);border-radius:8px}
.sf-logo-txt{font-weight:700;font-family:"Montserrat","Zen Kaku Gothic New",sans-serif}
.sf-copy{color:var(--color-text-muted,#6b7280);font-size:12px;text-align:center}
</style>

<footer class="sf">
    <div class="sf-in">
        <!-- Footer Links -->
        <div class="sf-grid">
            <!-- Column 1: ikimon -->
            <div>
                <p class="sf-h">ikimon</p>
                <div class="sf-links">
                    <a href="<?= $_fBase ?>/about.php"><?= __('nav.about') ?></a>
                    <a href="<?= $_fBase ?>/faq.php"><?= __('nav.faq') ?></a>
                    <a href="<?= $_fBase ?>/updates.php"><?= __('nav.updates') ?></a>
                    <a href="mailto:contact@ikimon.life"><?= __('nav.contact') ?></a>
                </div>
            </div>

            <!-- Column 2: Service -->
            <div>
                <p class="sf-h">Service</p>
                <div class="sf-links">
                    <a href="<?= $_fBase ?>/guides.php">解説ガイド一覧</a>
                    <a href="<?= $_fBase ?>/guide/regional-biodiversity.php">地方創生と生物多様性</a>
                    <a href="<?= $_fBase ?>/guide/nature-positive.php">ネイチャーポジティブガイド</a>
                    <a href="<?= $_fBase ?>/guide/walking-brain-science.php">お散歩と脳科学</a>
                    <a href="<?= $_fBase ?>/for-business/"><?= __('nav.business') ?></a>
                    <a href="<?= $_fBase ?>/for-researcher.php">データを持ち帰りたい方へ</a>
                    <a href="<?= $_fBase ?>/century_archive.php">記録が保全に変わる理由</a>
                </div>
            </div>

            <!-- Column 3: Legal -->
            <div class="sf-legal">
                <p class="sf-h">Legal</p>
                <div class="sf-links">
                    <a href="<?= $_fBase ?>/terms.php"><?= __('nav.terms') ?></a>
                    <a href="<?= $_fBase ?>/privacy.php"><?= __('nav.privacy') ?></a>
                    <a href="<?= $_fBase ?>/guidelines.php"><?= __('nav.guidelines') ?></a>
                </div>
            </div>
        </div>

        <!-- Logo & Copyright -->
        <div class="sf-bot">
            <div class="sf-logo">
                <div class="sf-logo-box"></div>
                <span class="sf-logo-txt">ikimon</span>
            </div>
            <p class="sf-copy"><?= __('nav.copyright') ?></p>
        </div>
    </div>
</footer>

<?php include __DIR__ . '/cookie_consent.php'; ?>

<!-- Passive Step Tracker (site-wide) -->
<script src="<?= $_fBase ?>/js/StepCounter.js" nonce="<?= CspNonce::attr() ?>"></script>
<script src="<?= $_fBase ?>/js/PassiveStepTracker.js" nonce="<?= CspNonce::attr() ?>"></script>
