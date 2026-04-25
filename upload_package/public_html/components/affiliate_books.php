<?php
/**
 * Affiliate Books Display Component
 *
 * 使用前に以下の変数をセット:
 *   $affiliateBooks   — AffiliateManager::getBooks() の結果
 *   $affiliateContext  — 'encyclopedia' | 'observation' | 'identification'
 */
if (empty($affiliateBooks)) return;

$header = AffiliateManager::getContextHeader($affiliateContext ?? 'encyclopedia');
?>
<section class="aff-section">
    <div class="aff-header">
        <div class="aff-header-left">
            <i data-lucide="<?= htmlspecialchars($header['icon']) ?>" class="aff-header-icon"></i>
            <h3 class="aff-title"><?= htmlspecialchars($header['title']) ?></h3>
        </div>
        <span class="aff-pr">PR</span>
    </div>

    <div class="aff-list">
        <?php foreach ($affiliateBooks as $book): ?>
        <div class="aff-book">
            <div class="aff-cover">
                <?php if (!empty($book['cover'])): ?>
                    <img src="<?= htmlspecialchars($book['cover']) ?>"
                         alt="<?= htmlspecialchars($book['title']) ?>"
                         loading="lazy" width="72" height="100">
                <?php else: ?>
                    <div class="aff-cover-placeholder">
                        <i data-lucide="book" class="h-6 w-6"></i>
                    </div>
                <?php endif; ?>
            </div>
            <div class="aff-info">
                <strong class="aff-book-title"><?= htmlspecialchars($book['title']) ?></strong>
                <span class="aff-meta"><?= htmlspecialchars($book['author']) ?></span>
                <?php if (!empty($book['description'])): ?>
                    <p class="aff-desc"><?= htmlspecialchars($book['description']) ?></p>
                <?php endif; ?>
                <div class="aff-shops">
                    <?php foreach ($book['shops'] as $shop): ?>
                    <a href="<?= htmlspecialchars($shop['url']) ?>"
                       class="aff-shop-btn"
                       style="--shop-color: <?= htmlspecialchars($shop['color']) ?>"
                       target="_blank"
                       rel="noopener sponsored">
                        <i data-lucide="<?= htmlspecialchars($shop['icon']) ?>" class="aff-shop-icon"></i>
                        <?= htmlspecialchars($shop['label']) ?>
                    </a>
                    <?php endforeach; ?>
                </div>
            </div>
        </div>
        <?php endforeach; ?>
    </div>

    <p class="aff-disclosure"><?= htmlspecialchars(__('affiliate.disclosure', 'We may receive a referral fee if you buy through these links.')) ?></p>
</section>

<style>
    .aff-section {
        margin: 28px 0;
        padding: 20px;
        border-radius: 16px;
        background: linear-gradient(135deg, rgba(16,185,129,.04), rgba(255,255,255,.9));
        border: 1px solid rgba(16,185,129,.12);
    }
    .aff-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 16px;
    }
    .aff-header-left {
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .aff-header-icon {
        width: 20px;
        height: 20px;
        color: var(--primary, #10b981);
        flex-shrink: 0;
    }
    .aff-title {
        margin: 0;
        font-size: 16px;
        font-weight: 800;
        letter-spacing: -.02em;
    }
    .aff-pr {
        display: inline-flex;
        align-items: center;
        padding: 3px 8px;
        border-radius: 999px;
        background: rgba(0,0,0,.06);
        color: rgba(0,0,0,.4);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
        flex-shrink: 0;
    }
    .aff-list {
        display: grid;
        gap: 16px;
    }
    .aff-book {
        display: flex;
        gap: 14px;
        align-items: flex-start;
    }
    .aff-cover {
        flex-shrink: 0;
        width: 72px;
    }
    .aff-cover img {
        width: 72px;
        height: auto;
        border-radius: 6px;
        box-shadow: 0 4px 12px rgba(0,0,0,.08);
        object-fit: cover;
    }
    .aff-cover-placeholder {
        width: 72px;
        height: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 6px;
        background: linear-gradient(135deg, #e8f5f0, #f0f4f2);
        color: rgba(16,185,129,.4);
    }
    .aff-info {
        flex: 1;
        min-width: 0;
    }
    .aff-book-title {
        display: block;
        font-size: 14px;
        font-weight: 800;
        line-height: 1.4;
        letter-spacing: -.01em;
    }
    .aff-meta {
        display: block;
        margin-top: 3px;
        font-size: 12px;
        color: rgba(0,0,0,.45);
        line-height: 1.5;
    }
    .aff-desc {
        margin: 6px 0 0;
        font-size: 13px;
        line-height: 1.65;
        color: rgba(0,0,0,.55);
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
    .aff-shops {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 10px;
    }
    .aff-shop-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 6px 12px;
        border-radius: 8px;
        background: var(--shop-color, #333);
        color: #fff;
        font-size: 11px;
        font-weight: 700;
        text-decoration: none;
        transition: opacity .15s ease, transform .15s ease;
        white-space: nowrap;
    }
    .aff-shop-btn:hover {
        opacity: .85;
        transform: translateY(-1px);
    }
    .aff-shop-icon {
        width: 12px;
        height: 12px;
    }
    .aff-disclosure {
        margin: 14px 0 0;
        font-size: 11px;
        color: rgba(0,0,0,.3);
        line-height: 1.5;
    }

    /* デスクトップ: 2列表示 */
    @media (min-width: 768px) {
        .aff-list {
            grid-template-columns: repeat(2, 1fr);
        }
        .aff-section {
            padding: 24px;
        }
    }
</style>
