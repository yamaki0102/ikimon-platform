<?php
/**
 * observation_feed_card.php — ソース別フィードカードコンポーネント
 *
 * 3つのソースで完全に異なるデザインを提供:
 *   post         → 写真ファーストカード（従来型）
 *   ikimon_sensor → AIセンサーカード（信頼度バー + 検出タイプ）
 *   fieldscan    → フィールドスキャンカード（環境データ + デュアルエンジン）
 *
 * 使い方:
 *   $cardObs = $obs;      // 観察レコード
 *   $cardReactionsJson    // json_encode済みリアクション
 *   $cardObsTotalReactions
 *   $cardLoggedIn         // bool
 *   include PUBLIC_DIR . 'components/observation_feed_card.php';
 */

require_once ROOT_DIR . 'libs/ObservationSourceHelper.php';
require_once __DIR__ . '/observation_feed_card_helpers.php';

$_src     = ObservationSourceHelper::getSource($cardObs);
$_srcMeta = ObservationSourceHelper::getMeta($_src);
$_detMeta = ObservationSourceHelper::getDetectionMeta($cardObs);

$_obsId      = $cardObs['id'];
$_detailUrl  = 'observation_detail.php?id=' . urlencode($_obsId);
$_taxon      = is_array($cardObs['taxon'] ?? null) ? $cardObs['taxon'] : [];
$_speciesName = $_taxon['name'] ?? ($cardObs['species_name'] ?? null);
$_sciName     = $_taxon['scientific_name'] ?? '';
$_hasId       = BioUtils::hasResolvedTaxon($cardObs);
$_userName    = $cardObs['user_name'] ?? substr($cardObs['user_id'] ?? '?', 0, 4);
$_avatar      = $cardObs['user_avatar'] ?? '/assets/img/default-avatar.svg';
$_timeAgo     = BioUtils::timeAgo($cardObs['observed_at'] ?? $cardObs['created_at'] ?? 'now');
$_place       = htmlspecialchars($cardObs['municipality'] ?? ($cardObs['location']['name'] ?? ''));
$_photos      = $cardObs['photos'] ?? [];
$_hasPhoto    = !empty($_photos);
$_obsComments = count($cardObs['identifications'] ?? []);

$_reactTypes  = ['footprint' => '👣', 'like' => '✨', 'suteki' => '❤️', 'manabi' => '🔬'];
?>
<article
    x-data='{ reactions: <?php echo $cardReactionsJson; ?>, total: <?php echo (int)$cardObsTotalReactions; ?>, scale: 1, menuOpen: false, loggedIn: <?php echo $cardLoggedIn ? 'true' : 'false'; ?> }'
    @click.outside="menuOpen = false"
    class="feed-card feed-card--animated overflow-hidden transition"
    style="background:var(--md-surface-container-low);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">

    <?php if ($_src === 'post'): ?>
    <?php /* ═══════════════════════════════════════════════════════
           フィールドノートカード: 写真ファースト
           ═══════════════════════════════════════════════════════ */ ?>

        <!-- Header -->
        <div class="px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-surface overflow-hidden">
                    <img src="<?php echo htmlspecialchars($_avatar); ?>" alt="" class="w-full h-full object-cover" loading="lazy" onerror="this.src='/assets/img/default-avatar.svg'">
                </div>
                <div>
                    <div class="flex items-center gap-1.5">
                        <p class="text-sm font-bold leading-none text-text"><?php echo htmlspecialchars($_userName); ?></p>
                        <?php echo ObservationSourceHelper::renderBadge($_src); ?>
                    </div>
                    <p class="text-token-xs text-muted mt-0.5"><?php echo $_timeAgo; ?><?php echo $_place ? ' · ' . $_place : ''; ?></p>
                </div>
            </div>
            <?php echo _obs_card_menu($_obsId, $_detailUrl, $_taxon['name'] ?? '観察記録', $cardLoggedIn); ?>
        </div>

        <!-- 写真 -->
        <div class="aspect-square w-full bg-surface relative overflow-hidden">
            <?php if ($_hasPhoto): ?>
                <img src="<?php echo htmlspecialchars($_photos[0]); ?>" alt="<?php echo htmlspecialchars($_speciesName ?? '観察写真'); ?>" class="w-full h-full object-cover" loading="lazy" decoding="async">
            <?php else: ?>
                <div class="w-full h-full flex items-center justify-center bg-primary/5">
                    <i data-lucide="camera-off" class="w-12 h-12 text-faint"></i>
                </div>
            <?php endif; ?>
            <a href="<?php echo htmlspecialchars($_detailUrl); ?>" class="absolute inset-0 z-[1]" aria-label="観察詳細を見る"></a>

            <!-- 種名バッジ -->
            <?php if ($_hasId): ?>
                <?php $_slug = $_taxon['slug'] ?? null; ?>
                <a href="<?php echo $_slug ? 'species/' . urlencode($_slug) : 'species.php?taxon=' . urlencode($_speciesName ?? ''); ?>"
                    onclick="event.stopPropagation()"
                    class="absolute bottom-2.5 left-2.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md flex items-center gap-1.5 border border-white/20 hover:bg-black/70 transition z-10 max-w-[calc(100%-3rem)] truncate">
                    <i data-lucide="check-circle-2" class="w-3 h-3 text-green-400"></i>
                    <span class="text-xs font-bold text-white"><?php echo htmlspecialchars($_speciesName ?? ''); ?></span>
                </a>
            <?php else: ?>
                <div class="absolute bottom-2 left-2 z-10">
                    <div class="px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md flex items-center gap-2 border border-white/10">
                        <i data-lucide="help-circle" class="w-3 h-3 text-white/50"></i>
                        <span class="text-xs text-white/60">同定中</span>
                    </div>
                </div>
            <?php endif; ?>
        </div>

        <!-- リアクション + キャプション -->
        <?php echo _obs_card_actions($_obsId, $_reactTypes, $_obsComments, $_detailUrl); ?>
        <div class="px-4 py-3">
            <p class="text-sm text-muted line-clamp-2">
                <span class="font-bold text-text"><?php echo htmlspecialchars($_userName); ?></span>
                <?php echo htmlspecialchars($cardObs['note'] ?? '記録しました'); ?>
            </p>
            <div class="flex items-center justify-between mt-2">
                <span class="text-token-xs text-muted"><?php echo date('Y.m.d H:i', strtotime($cardObs['observed_at'] ?? $cardObs['created_at'] ?? 'now')); ?></span>
                <a href="<?php echo htmlspecialchars($_detailUrl); ?>" class="text-token-xs font-bold text-muted hover:text-primary-dark transition">詳しく見る →</a>
            </div>
        </div>

    <?php elseif ($_src === 'ikimon_sensor'): ?>
    <?php /* ═══════════════════════════════════════════════════════
           AIレンズカード: AI検出ファースト
           写真があれば小さく補助、なければ音声波形的な視覚化
           ═══════════════════════════════════════════════════════ */ ?>

        <!-- Header -->
        <div class="px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-surface overflow-hidden">
                    <img src="<?php echo htmlspecialchars($_avatar); ?>" alt="" class="w-full h-full object-cover" loading="lazy" onerror="this.src='/assets/img/default-avatar.svg'">
                </div>
                <div>
                    <div class="flex items-center gap-1.5">
                        <p class="text-sm font-bold leading-none text-text"><?php echo htmlspecialchars($_userName); ?></p>
                        <?php echo ObservationSourceHelper::renderBadge($_src); ?>
                    </div>
                    <p class="text-token-xs text-muted mt-0.5"><?php echo $_timeAgo; ?><?php echo $_place ? ' · ' . $_place : ''; ?></p>
                </div>
            </div>
            <?php echo _obs_card_menu($_obsId, $_detailUrl, $_speciesName ?? '検出記録', $cardLoggedIn); ?>
        </div>

        <!-- センサー検出メイン表示 -->
        <a href="<?php echo htmlspecialchars($_detailUrl); ?>" class="block mx-4 mb-3 rounded-2xl overflow-hidden border"
            style="background:var(--md-surface-container);border-color:<?php echo $_src === 'ikimon_sensor' ? 'rgba(139,92,246,0.2)' : 'rgba(16,185,129,0.2)'; ?>;">

            <?php if ($_hasPhoto): ?>
                <!-- 写真あり: 横長レイアウト -->
                <div class="flex items-center gap-0">
                    <div class="w-24 h-24 flex-shrink-0 bg-surface overflow-hidden">
                        <img src="<?php echo htmlspecialchars($_photos[0]); ?>" alt="" class="w-full h-full object-cover">
                    </div>
                    <div class="flex-1 p-3">
                        <?php echo _sensor_detection_body($_speciesName, $_sciName, $_hasId, $_detMeta, $_src); ?>
                    </div>
                </div>
            <?php else: ?>
                <!-- 写真なし: 音声検出ビジュアル -->
                <div class="p-4">
                    <div class="flex items-center gap-3 mb-3">
                        <div class="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                            style="background:rgba(139,92,246,0.15);">
                            <i data-lucide="<?php echo $_detMeta['icon']; ?>" class="w-5 h-5 text-violet-600"></i>
                        </div>
                        <div class="flex-1">
                            <?php echo _sensor_detection_body($_speciesName, $_sciName, $_hasId, $_detMeta, $_src); ?>
                        </div>
                    </div>
                    <!-- 音声波形イメージ（装飾） -->
                    <div class="flex items-center gap-0.5 h-6 opacity-40">
                        <?php for ($wi = 0; $wi < 32; $wi++): ?>
                            <div class="flex-1 bg-violet-400 rounded-sm" style="height:<?php echo rand(20, 100); ?>%"></div>
                        <?php endfor; ?>
                    </div>
                </div>
            <?php endif; ?>
        </a>

        <!-- 信頼度バー -->
        <?php if ($_detMeta['confidence'] > 0): ?>
        <div class="px-4 pb-2">
            <div class="flex items-center gap-2">
                <span class="text-[10px] text-muted flex-shrink-0">AI確信度</span>
                <div class="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all"
                        style="width:<?php echo round($_detMeta['confidence'] * 100); ?>%;background:<?php echo $_detMeta['confidence'] >= 0.7 ? '#10b981' : ($_detMeta['confidence'] >= 0.4 ? '#f59e0b' : '#ef4444'); ?>;">
                    </div>
                </div>
                <span class="text-[10px] font-bold <?php echo $_detMeta['conf_label']['class']; ?> flex-shrink-0">
                    <?php echo round($_detMeta['confidence'] * 100); ?>%
                </span>
            </div>
        </div>
        <?php endif; ?>

        <?php echo _obs_card_actions($_obsId, $_reactTypes, $_obsComments, $_detailUrl); ?>

    <?php else: /* fieldscan */ ?>
    <?php /* ═══════════════════════════════════════════════════════
           フィールドスキャンカード: データリッチ表示
           環境センサー + デュアルエンジン情報を前面に
           ═══════════════════════════════════════════════════════ */ ?>

        <!-- Header -->
        <div class="px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-full bg-surface overflow-hidden">
                    <img src="<?php echo htmlspecialchars($_avatar); ?>" alt="" class="w-full h-full object-cover" loading="lazy" onerror="this.src='/assets/img/default-avatar.svg'">
                </div>
                <div>
                    <div class="flex items-center gap-1.5">
                        <p class="text-sm font-bold leading-none text-text"><?php echo htmlspecialchars($_userName); ?></p>
                        <?php echo ObservationSourceHelper::renderBadge($_src); ?>
                        <?php if ($_detMeta['is_dual']): ?>
                            <span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-700 border border-emerald-400/20">✓✓ デュアル</span>
                        <?php endif; ?>
                    </div>
                    <p class="text-token-xs text-muted mt-0.5"><?php echo $_timeAgo; ?><?php echo $_place ? ' · ' . $_place : ''; ?></p>
                </div>
            </div>
            <?php echo _obs_card_menu($_obsId, $_detailUrl, $_speciesName ?? 'スキャン記録', $cardLoggedIn); ?>
        </div>

        <!-- フィールドスキャンメイン表示 -->
        <a href="<?php echo htmlspecialchars($_detailUrl); ?>" class="block mx-4 mb-3 rounded-2xl overflow-hidden border border-emerald-400/20"
            style="background:var(--md-surface-container);">

            <?php if ($_hasPhoto): ?>
            <div class="flex items-stretch">
                <div class="w-24 flex-shrink-0 bg-surface overflow-hidden">
                    <img src="<?php echo htmlspecialchars($_photos[0]); ?>" alt="" class="w-full h-full object-cover">
                </div>
                <div class="flex-1 p-3">
                    <?php echo _sensor_detection_body($_speciesName, $_sciName, $_hasId, $_detMeta, $_src); ?>
                    <?php echo _fieldscan_env_summary($cardObs); ?>
                </div>
            </div>
            <?php else: ?>
            <div class="p-4">
                <div class="flex items-center gap-3 mb-3">
                    <div class="w-10 h-10 rounded-full bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                        <i data-lucide="scan-line" class="w-5 h-5 text-emerald-600"></i>
                    </div>
                    <div class="flex-1">
                        <?php echo _sensor_detection_body($_speciesName, $_sciName, $_hasId, $_detMeta, $_src); ?>
                    </div>
                </div>
                <?php echo _fieldscan_env_summary($cardObs); ?>
            </div>
            <?php endif; ?>
        </a>

        <!-- 信頼度バー -->
        <?php if ($_detMeta['confidence'] > 0): ?>
        <div class="px-4 pb-2">
            <div class="flex items-center gap-2">
                <span class="text-[10px] text-muted flex-shrink-0">
                    <?php echo $_detMeta['is_dual'] ? 'デュアル確信度' : 'AI確信度'; ?>
                </span>
                <div class="flex-1 h-1.5 bg-surface rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all"
                        style="width:<?php echo round($_detMeta['confidence'] * 100); ?>%;background:<?php echo $_detMeta['confidence'] >= 0.7 ? '#10b981' : ($_detMeta['confidence'] >= 0.4 ? '#f59e0b' : '#ef4444'); ?>;">
                    </div>
                </div>
                <span class="text-[10px] font-bold <?php echo $_detMeta['conf_label']['class']; ?> flex-shrink-0">
                    <?php echo round($_detMeta['confidence'] * 100); ?>%
                </span>
                <?php if ($_detMeta['is_tier_1_5']): ?>
                    <span class="text-[9px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-full border border-emerald-400/20">Tier 1.5</span>
                <?php endif; ?>
            </div>
        </div>
        <?php endif; ?>

        <?php echo _obs_card_actions($_obsId, $_reactTypes, $_obsComments, $_detailUrl); ?>

    <?php endif; ?>

</article>

