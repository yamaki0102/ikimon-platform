<?php
/**
 * observation_feed_card_helpers.php
 *
 * observation_feed_card.php からforeachループ内でincludeされるため、
 * 関数定義は require_once でこのファイルにまとめて管理する。
 * 再宣言Fatal Errorを防ぐために分離。
 */

function _sensor_detection_body(?string $speciesName, string $sciName, bool $hasId, array $detMeta, string $src): string
{
    $html = '';
    if ($hasId && $speciesName) {
        $html .= '<p class="font-bold text-sm text-text leading-tight">' . htmlspecialchars($speciesName) . '</p>';
        if ($sciName) {
            $html .= '<p class="text-[10px] text-muted italic">' . htmlspecialchars($sciName) . '</p>';
        }
    } else {
        $color = 'text-primary';
        $html .= '<p class="text-xs ' . $color . ' font-bold">同定中</p>';
    }

    $parts = [];
    if ($detMeta['label']) {
        $parts[] = $detMeta['emoji'] . ' ' . htmlspecialchars($detMeta['label']);
    }
    if ($detMeta['engine_label']) {
        $parts[] = htmlspecialchars($detMeta['engine_label']);
    }
    if ($parts) {
        $html .= '<p class="text-[10px] text-muted mt-0.5">' . implode(' · ', $parts) . '</p>';
    }
    return $html;
}

function _fieldscan_env_summary(array $obs): string
{
    $env = $obs['environment_snapshot'] ?? $obs['env_snapshot'] ?? [];
    if (empty($env)) return '';

    $parts = [];
    if (!empty($env['habitat'])) {
        $parts[] = '<span class="text-[10px] text-muted">🌿 ' . htmlspecialchars($env['habitat']) . '</span>';
    }
    if (isset($env['canopy_cover'])) {
        $parts[] = '<span class="text-[10px] text-muted">🌳 ' . (int)$env['canopy_cover'] . '%</span>';
    }
    if (isset($obs['ndsi'])) {
        $ndsi = round((float)$obs['ndsi'], 2);
        $parts[] = '<span class="text-[10px] text-muted">🎵 NDSI ' . $ndsi . '</span>';
    }
    if (isset($obs['temp_celsius'])) {
        $parts[] = '<span class="text-[10px] text-muted">🌡 ' . round((float)$obs['temp_celsius'], 1) . '°C</span>';
    }

    if (empty($parts)) return '';

    return '<div class="flex flex-wrap gap-1.5 mt-2">' . implode('', $parts) . '</div>';
}

function _obs_card_menu(string $obsId, string $detailUrl, string $title, bool $loggedIn): string
{
    $safeTitle = htmlspecialchars($title, ENT_QUOTES);
    $safeDetail = htmlspecialchars($detailUrl);
    return <<<HTML
    <div class="relative">
        <button @click.stop="menuOpen = !menuOpen" class="p-2 transition rounded-full text-faint hover:bg-surface">
            <i data-lucide="more-horizontal" class="w-4 h-4"></i>
        </button>
        <div x-show="menuOpen" x-transition.opacity.duration.150ms
            style="position:absolute;right:0;top:100%;margin-top:4px;width:11rem;background:var(--md-surface-container-high);border-radius:var(--shape-md);box-shadow:var(--elev-3);z-index:30;padding:4px 0;overflow:hidden;">
            <a href="{$safeDetail}" class="flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface transition">
                <i data-lucide="eye" class="w-4 h-4 text-faint"></i>詳細を見る
            </a>
            <button @click="menuOpen=false;let u=location.origin+'/{$safeDetail}';if(navigator.share){navigator.share({title:'{$safeTitle}',url:u}).catch(()=>{})}else{navigator.clipboard.writeText(u)}"
                class="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-text hover:bg-surface transition text-left">
                <i data-lucide="share-2" class="w-4 h-4 text-faint"></i>シェアする
            </button>
        </div>
    </div>
HTML;
}

function _obs_card_actions(string $obsId, array $reactTypes, int $comments, string $detailUrl): string
{
    $html = '<div class="px-4 py-2 pb-0 flex items-center gap-0.5">';
    foreach ($reactTypes as $rtype => $remoji) {
        $html .= <<<REACT
        <button @click="if(!loggedIn){window.location.href='/login.php?redirect='+encodeURIComponent(window.location.pathname+window.location.search);return};let r=reactions.{$rtype};let prev=r.reacted;r.reacted=!r.reacted;r.count+=r.reacted?1:-1;total+=r.reacted?1:-1;if(r.reacted){scale=1.2;setTimeout(()=>scale=1,200)};fetch('/api/toggle_like.php',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:'{$obsId}',type:'{$rtype}'})}).then(res=>res.json()).then(data=>{if(!data.success){r.reacted=prev;r.count+=prev?1:-1;total+=prev?1:-1}}).catch(()=>{r.reacted=prev;r.count+=prev?1:-1;total+=prev?1:-1})"
            class="flex items-center gap-0.5 py-1.5 px-1.5 rounded-lg transition-all hover:bg-surface active:scale-90"
            :class="reactions.{$rtype}.reacted ? 'bg-primary/10' : ''">
            <span class="text-base" :class="reactions.{$rtype}.reacted ? 'opacity-100' : 'opacity-40'">{$remoji}</span>
            <span class="text-[10px] font-bold" :class="reactions.{$rtype}.reacted ? 'text-primary' : 'text-faint'" x-show="reactions.{$rtype}.count > 0" x-text="reactions.{$rtype}.count"></span>
        </button>
REACT;
    }

    $commentClass = $comments > 0 ? 'text-secondary' : 'text-faint group-hover:text-secondary';
    $safeDetail   = htmlspecialchars($detailUrl);
    $html .= <<<COMMENT
    <a href="{$safeDetail}" class="flex items-center gap-1.5 group active:scale-90 transition-transform py-1.5 px-2 rounded-lg hover:bg-surface">
        <i data-lucide="message-circle" class="w-5 h-5 transition pointer-events-none {$commentClass}"></i>
        <span class="text-xs font-bold">{$comments}</span>
    </a>
    <div class="flex-1"></div>
    </div>
COMMENT;

    return $html;
}
