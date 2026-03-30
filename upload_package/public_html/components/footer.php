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
.sf{border-top:1px solid var(--color-border,#e5e7eb);background:linear-gradient(180deg,var(--color-bg-base,#fff) 0%,var(--color-bg-surface,#f8fafc) 100%);padding:48px 24px 128px}
@media(min-width:768px){.sf{padding-bottom:48px}}
.sf-in{max-width:80rem;margin:0 auto}
.sf-grid{display:grid;grid-template-columns:1fr;gap:16px;margin-bottom:40px;padding:0 16px}
@media(min-width:768px){.sf-grid{grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) minmax(0,.9fr);gap:20px}}
.sf-section{display:flex;flex-direction:column;gap:14px;padding:20px;border:1px solid var(--color-border,#e5e7eb);border-radius:24px;background:rgba(255,255,255,.72);box-shadow:0 12px 32px rgba(15,23,42,.04)}
.sf-h{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.14em;color:var(--color-text-faint,#9ca3af);margin:0}
.sf-intro{font-size:13px;line-height:1.7;color:var(--color-text-muted,#6b7280);margin:0}
.sf-links{display:flex;flex-direction:column;gap:10px}
.sf-links a,.sf-links button{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;color:var(--color-text,#111827);text-decoration:none;background:none;border:none;cursor:pointer;font:inherit;padding:0;text-align:left;transition:color .15s,transform .15s}
.sf-links a::after,.sf-links button::after{content:"↗";flex:0 0 auto;color:var(--color-text-faint,#9ca3af);font-size:12px;line-height:1.4;transform:translateY(2px)}
.sf-links a:hover,.sf-links button:hover{color:var(--color-text,#111827);transform:translateX(2px)}
.sf-links a:hover::after,.sf-links button:hover::after{color:var(--color-text-muted,#6b7280)}
.sf-link-main{font-weight:700;font-size:14px;line-height:1.5}
.sf-link-sub{display:block;margin-top:2px;font-weight:500;font-size:12px;line-height:1.6;color:var(--color-text-muted,#6b7280)}
.sf-clusters{display:grid;grid-template-columns:1fr;gap:12px}
@media(min-width:768px){.sf-clusters{grid-template-columns:1fr 1fr}}
.sf-cluster{padding:14px 14px 12px;border-radius:18px;background:var(--color-bg-surface,#f8fafc);border:1px solid var(--color-border,#e5e7eb)}
.sf-cluster-title{margin:0 0 10px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:var(--color-text-faint,#9ca3af)}
.sf-cluster .sf-links{gap:8px}
.sf-cluster .sf-link-main{font-size:13px}
.sf-bot{display:flex;flex-direction:column;align-items:center;border-top:1px solid var(--color-border,#e5e7eb);padding-top:32px}
.sf-logo{display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:16px;opacity:.45}
.sf-logo-box{width:24px;height:24px;background:var(--color-bg-surface,#f3f4f6);border-radius:8px}
.sf-logo-txt{font-weight:700;font-family:"Montserrat","Zen Kaku Gothic New",sans-serif}
.sf-copy{color:var(--color-text-muted,#6b7280);font-size:12px;text-align:center}
</style>

<footer class="sf">
    <div class="sf-in">
        <!-- Footer Links -->
        <div class="sf-grid">
            <!-- Column 1: ikimon -->
            <section class="sf-section">
                <p class="sf-h">ikimon</p>
                <p class="sf-intro">プロジェクトの考え方、更新情報、問い合わせ先をまとめた入口。</p>
                <div class="sf-links">
                    <a href="<?= $_fBase ?>/about.php">
                        <span>
                            <span class="sf-link-main"><?= __('nav.about') ?></span>
                            <span class="sf-link-sub">ikimon の目的と運営の考え方</span>
                        </span>
                    </a>
                    <a href="<?= $_fBase ?>/faq.php">
                        <span>
                            <span class="sf-link-main"><?= __('nav.faq') ?></span>
                            <span class="sf-link-sub">はじめる前によくある疑問を確認</span>
                        </span>
                    </a>
                    <a href="<?= $_fBase ?>/updates.php">
                        <span>
                            <span class="sf-link-main"><?= __('nav.updates') ?></span>
                            <span class="sf-link-sub">新機能や改善の履歴</span>
                        </span>
                    </a>
                    <a href="mailto:contact@ikimon.life">
                        <span>
                            <span class="sf-link-main"><?= __('nav.contact') ?></span>
                            <span class="sf-link-sub">運営への相談・連携・取材の窓口</span>
                        </span>
                    </a>
                </div>
            </section>

            <!-- Column 2: Service -->
            <section class="sf-section">
                <p class="sf-h">Service</p>
                <p class="sf-intro">学ぶ、活かす、つなげる。目的別に探しやすく再編した導線。</p>
                <div class="sf-clusters">
                    <div class="sf-cluster">
                        <p class="sf-cluster-title">Learn</p>
                        <div class="sf-links">
                            <a href="<?= $_fBase ?>/guides.php">
                                <span>
                                    <span class="sf-link-main">解説ガイド一覧</span>
                                    <span class="sf-link-sub">テーマごとの読み物をまとめて探す</span>
                                </span>
                            </a>
                            <a href="<?= $_fBase ?>/guide/regional-biodiversity.php">
                                <span>
                                    <span class="sf-link-main">地方創生と生物多様性</span>
                                    <span class="sf-link-sub">地域づくりと自然資本の接点を知る</span>
                                </span>
                            </a>
                            <a href="<?= $_fBase ?>/guide/nature-positive.php">
                                <span>
                                    <span class="sf-link-main">ネイチャーポジティブガイド</span>
                                    <span class="sf-link-sub">いま必要な考え方をやさしく整理</span>
                                </span>
                            </a>
                            <a href="<?= $_fBase ?>/guide/walking-brain-science.php">
                                <span>
                                    <span class="sf-link-main">お散歩と脳科学</span>
                                    <span class="sf-link-sub">日常観察が心身に与える意味を読む</span>
                                </span>
                            </a>
                        </div>
                    </div>
                    <div class="sf-cluster">
                        <p class="sf-cluster-title">Apply</p>
                        <div class="sf-links">
                            <a href="<?= $_fBase ?>/for-business/">
                                <span>
                                    <span class="sf-link-main"><?= __('nav.business') ?></span>
                                    <span class="sf-link-sub">企業・自治体との活用イメージ</span>
                                </span>
                            </a>
                            <a href="<?= $_fBase ?>/for-researcher.php">
                                <span>
                                    <span class="sf-link-main">データを持ち帰りたい方へ</span>
                                    <span class="sf-link-sub">研究・分析用途での活用方法</span>
                                </span>
                            </a>
                            <a href="<?= $_fBase ?>/century_archive.php">
                                <span>
                                    <span class="sf-link-main">記録が保全に変わる理由</span>
                                    <span class="sf-link-sub">投稿が未来の保全に接続する仕組み</span>
                                </span>
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Column 3: Legal -->
            <section class="sf-section">
                <p class="sf-h">Legal</p>
                <p class="sf-intro">安心して参加するための基本ルールと取り扱い。</p>
                <div class="sf-links">
                    <a href="<?= $_fBase ?>/terms.php">
                        <span>
                            <span class="sf-link-main"><?= __('nav.terms') ?></span>
                            <span class="sf-link-sub">サービス利用時の基本条件</span>
                        </span>
                    </a>
                    <a href="<?= $_fBase ?>/privacy.php">
                        <span>
                            <span class="sf-link-main"><?= __('nav.privacy') ?></span>
                            <span class="sf-link-sub">個人情報と観察データの扱い</span>
                        </span>
                    </a>
                    <a href="<?= $_fBase ?>/guidelines.php">
                        <span>
                            <span class="sf-link-main"><?= __('nav.guidelines') ?></span>
                            <span class="sf-link-sub">コミュニティ参加時の行動指針</span>
                        </span>
                    </a>
                </div>
            </section>
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
