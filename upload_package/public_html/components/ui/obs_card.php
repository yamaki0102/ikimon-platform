<?php
/**
 * Observation Card Component — 観察記録カード（グリッド用）
 *
 * Variables:
 *   $obs   array  観察レコード（必須）
 *             ['id', 'species_name', 'common_name', 'photo_url', 'observed_at',
 *              'location_name', 'identified', 'is_redlist', 'is_invasive']
 *   $obs_card_link  bool   リンク有効化（default: true）
 *   $obs_card_size  string 'sm' | 'md' (default: 'md')
 */

if (empty($obs)) return;

$linkEnabled = $obs_card_link ?? true;
$cardSize    = $obs_card_size ?? 'md';

$id            = htmlspecialchars((string)($obs['id'] ?? ''));
$rawSpeciesName = (string)($obs['species_name'] ?? __('obs_card.unidentified', 'Unidentified'));
$speciesName   = htmlspecialchars($rawSpeciesName);
$commonName  = htmlspecialchars((string)($obs['common_name'] ?? ''));
$photoUrl    = htmlspecialchars((string)($obs['photo_url'] ?? '/assets/img/placeholder.webp'));
$observedAt  = (string)($obs['observed_at'] ?? '');
$locationName= htmlspecialchars((string)($obs['location_name'] ?? ''));
$identified  = !empty($obs['identified']);
$isRedlist   = !empty($obs['is_redlist']);
$isInvasive  = !empty($obs['is_invasive']);

$dateDisplay = $observedAt ? date('m/d', strtotime($observedAt)) : '';

$aspectClass = $cardSize === 'sm' ? 'aspect-square' : 'aspect-[4/5]';
$tag = $linkEnabled ? 'a' : 'div';
$href = $linkEnabled ? 'href="observation_detail.php?id=' . $id . '"' : '';
$photoAlt = str_replace('{name}', $rawSpeciesName, __('obs_card.photo_alt', '{name} observation photo'));
?>
<<?= $tag ?> <?= $href ?>
   class="group relative overflow-hidden rounded-2xl <?= $aspectClass ?>
          bg-surface border border-border shadow-sm
          transition-all duration-300 hover:shadow-md hover:-translate-y-0.5 block">

    <!-- Photo -->
    <img src="<?= $photoUrl ?>"
         alt="<?= htmlspecialchars($photoAlt) ?>"
         loading="lazy"
         class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105">

    <!-- Gradient overlay -->
    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>

    <!-- Status badges (top-right) -->
    <div class="absolute top-2 right-2 flex flex-col gap-1 items-end">
        <?php if ($isRedlist): ?>
            <span class="inline-flex items-center gap-1 rounded-full bg-red-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                <i data-lucide="alert-triangle" class="w-3 h-3" aria-hidden="true"></i>RD
            </span>
        <?php endif; ?>
        <?php if ($isInvasive): ?>
            <span class="inline-flex items-center gap-1 rounded-full bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                <i data-lucide="shield-alert" class="w-3 h-3" aria-hidden="true"></i><?= htmlspecialchars(__('obs_card.invasive', 'Invasive')) ?>
            </span>
        <?php endif; ?>
        <?php if (!$identified): ?>
            <span class="inline-flex items-center gap-1 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-bold text-white/90 backdrop-blur-sm border border-white/20">
                ?
            </span>
        <?php endif; ?>
    </div>

    <!-- Bottom info -->
    <div class="absolute bottom-0 left-0 right-0 p-3">
        <p class="text-white font-bold text-sm leading-snug truncate">
            <?= $commonName ?: $speciesName ?>
        </p>
        <?php if ($commonName && $commonName !== $speciesName): ?>
            <p class="text-white/70 text-xs leading-snug truncate italic"><?= $speciesName ?></p>
        <?php endif; ?>
        <div class="flex items-center gap-2 mt-1">
            <?php if ($dateDisplay): ?>
                <span class="text-white/60 text-[11px]"><?= $dateDisplay ?></span>
            <?php endif; ?>
            <?php if ($locationName): ?>
                <span class="text-white/50 text-[10px] truncate flex items-center gap-0.5">
                    <i data-lucide="map-pin" class="w-3 h-3" aria-hidden="true"></i><?= $locationName ?>
                </span>
            <?php endif; ?>
        </div>
    </div>
</<?= $tag ?>>
