<!-- Scan Recommendation Cards — おすすめ調査エリア -->
<div x-show="scanRecs.length > 0" x-cloak class="mb-6">
    <div class="flex items-center gap-2 mb-3">
        <i data-lucide="radar" class="w-5 h-5 text-emerald-600"></i>
        <h3 class="text-base font-bold">おすすめ調査エリア</h3>
        <span class="text-[10px] text-muted bg-surface-variant px-2 py-0.5 rounded-full" x-text="'GBIF/iNat比較'"></span>
    </div>
    <p class="text-xs text-muted mb-3">広域データベースとの差分に基づく、AIレンズやフィールドスキャンにおすすめのエリア</p>

    <!-- Summary -->
    <div x-show="scanSummary" class="flex gap-4 mb-3 text-xs text-muted">
        <span>GBIF <strong class="text-text" x-text="scanSummary?.gbif_species_in_area || 0"></strong>種</span>
        <span>iNaturalist <strong class="text-text" x-text="scanSummary?.inat_species_in_area || 0"></strong>種</span>
        <span>ikimon <strong class="text-emerald-600" x-text="scanSummary?.ikimon_species_in_area || 0"></strong>種</span>
        <span x-show="scanSummary?.coverage_rate !== undefined">
            カバー率 <strong class="text-primary" x-text="Math.round((scanSummary?.coverage_rate || 0) * 100) + '%'"></strong>
        </span>
    </div>

    <!-- Cards scroll -->
    <div class="flex gap-3 overflow-x-auto scrollbar-hide pb-2 md:grid md:grid-cols-3 md:overflow-visible">
        <template x-for="rec in scanRecs.slice(0, 6)" :key="rec.mesh_code">
            <div class="flex-shrink-0 w-64 md:w-auto rounded-2xl border border-border bg-surface p-3 shadow-sm">
                <!-- Header -->
                <div class="flex items-center gap-2 mb-2">
                    <span class="text-lg" x-text="rec.environment?.icon || '📍'"></span>
                    <span class="text-sm font-bold truncate" x-text="rec.environment?.label || 'エリア'"></span>
                    <span class="ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full"
                        :class="{
                            'bg-red-100 text-red-700': rec.priority === 'high',
                            'bg-amber-100 text-amber-700': rec.priority === 'medium',
                            'bg-emerald-100 text-emerald-700': rec.priority === 'low'
                        }"
                        x-text="rec.priority === 'high' ? '優先度 高' : rec.priority === 'medium' ? '優先度 中' : '優先度 低'">
                    </span>
                </div>

                <!-- Stats -->
                <div class="flex gap-2 mb-2 text-[11px]">
                    <span class="bg-surface-variant px-2 py-0.5 rounded-full">外部 <strong x-text="rec.external_species"></strong>種</span>
                    <span class="bg-surface-variant px-2 py-0.5 rounded-full">ikimon <strong x-text="rec.local_species"></strong>種</span>
                    <span class="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-bold">+<span x-text="rec.coverage_gap"></span>種</span>
                </div>

                <!-- Reasons -->
                <ul class="space-y-1 mb-3">
                    <template x-for="reason in rec.reasons?.slice(0, 2)" :key="reason">
                        <li class="text-[11px] text-muted leading-snug flex gap-1">
                            <i data-lucide="info" class="w-3 h-3 shrink-0 mt-0.5 text-muted"></i>
                            <span x-text="reason"></span>
                        </li>
                    </template>
                </ul>

                <!-- Action -->
                <a :href="'/field_research.php?mode=scan&lat=' + rec.center.lat + '&lng=' + rec.center.lng"
                    class="block text-center text-xs font-bold rounded-full py-2 transition"
                    style="background:var(--md-primary);color:var(--md-on-primary);">
                    このエリアを調査
                </a>
            </div>
        </template>
    </div>
</div>

<!-- Location permission prompt -->
<div x-show="!scanRecsLoaded && !scanRecsLoading" x-cloak class="mb-6 rounded-2xl border border-dashed border-border bg-surface-variant/30 p-4 text-center">
    <i data-lucide="map-pin" class="w-6 h-6 mx-auto text-muted mb-2"></i>
    <p class="text-xs text-muted mb-2">位置情報を許可するとおすすめスキャンエリアが表示されます</p>
    <button @click="requestLocationForScanRecs()"
        class="text-xs font-bold px-4 py-1.5 rounded-full"
        style="background:var(--md-secondary-container);color:var(--md-on-secondary-container);">
        位置情報を許可
    </button>
</div>
