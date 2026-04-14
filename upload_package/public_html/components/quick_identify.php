<?php

/**
 * quick_identify.php — クイック同定ボトムシート / サイドパネル
 */

$quickIdentifyLocale = class_exists('Lang') && method_exists('Lang', 'current') ? Lang::current() : 'ja';
$quickIdentifyStrings = [
    'title' => __('quick_identify.title', 'Suggest a name'),
    'observation_photo' => __('quick_identify.observation_photo', 'Observation photo'),
    'unidentified' => __('quick_identify.unidentified', 'Unidentified'),
    'photo_label' => __('quick_identify.photo_label', 'Observation photo {index}'),
    'photo_count_suffix' => __('quick_identify.photo_count_suffix', ' photos'),
    'observer_fallback' => __('quick_identify.observer_fallback', 'Observer'),
    'existing_suggestions' => __('quick_identify.existing_suggestions', 'Existing suggestions'),
    'existing_suggestions_count' => __('quick_identify.existing_suggestions_count', '({count})'),
    'name_missing' => __('quick_identify.name_missing', 'No name'),
    'search_label' => __('quick_identify.search_label', 'Search by common or scientific name'),
    'search_placeholder' => __('quick_identify.search_placeholder', 'Graphium, swallowtail...'),
    'selected_label' => __('quick_identify.selected_label', 'Selected'),
    'life_stage_label' => __('quick_identify.life_stage_label', 'Life stage'),
    'life_stage_adult' => __('quick_identify.life_stage_adult', 'Adult'),
    'life_stage_juvenile' => __('quick_identify.life_stage_juvenile', 'Juvenile'),
    'life_stage_egg' => __('quick_identify.life_stage_egg', 'Egg / seed / pupa'),
    'life_stage_trace' => __('quick_identify.life_stage_trace', 'Trace'),
    'life_stage_unknown' => __('quick_identify.life_stage_unknown', 'Unknown'),
    'note_label' => __('quick_identify.note_label', 'Note'),
    'optional' => __('quick_identify.optional', '(Optional)'),
    'note_placeholder' => __('quick_identify.note_placeholder', 'White spots on the back, a distinctive call...'),
    'submit' => __('quick_identify.submit', 'Send name'),
    'submitting' => __('quick_identify.submitting', 'Sending...'),
    'pass' => __('quick_identify.pass', 'Pass'),
    'later' => __('quick_identify.later', 'Later'),
    'details' => __('quick_identify.details', 'Details'),
    'learn_action_species' => __('quick_identify.learn_action_species', 'Open species guide'),
    'learn_action_details' => __('quick_identify.learn_action_details', 'Review this record'),
    'retake_action_record' => __('quick_identify.retake_action_record', 'Record this place again'),
    'retake_action_details' => __('quick_identify.retake_action_details', 'Check the current photos'),
    'contribution_action_review' => __('quick_identify.contribution_action_review', 'Open review notes'),
    'contribution_action_compare' => __('quick_identify.contribution_action_compare', 'See existing suggestions'),
    'learn_title' => __('quick_identify.learn_title', 'What counts as progress'),
    'learn_body' => __('quick_identify.learn_body', 'A genus-level or uncertain answer is still useful if it matches the evidence. The goal is to move one step closer, not to force certainty.'),
    'learn_body_species' => __('quick_identify.learn_body_species', 'A species-level suggestion is strongest when the photo, place, and season all line up. If any of those are weak, leaving room for uncertainty is better.'),
    'learn_body_genus' => __('quick_identify.learn_body_genus', 'Stopping at genus or another coarse rank is valid when the evidence is not enough for species. That is quality control, not failure.'),
    'retake_title' => __('quick_identify.retake_title', 'What to capture next time'),
    'retake_body' => __('quick_identify.retake_body', 'Try one closer photo, one side angle, and one place clue such as leaves, bark, or the ground around it.'),
    'retake_body_single_photo' => __('quick_identify.retake_body_single_photo', 'You only have one photo here. One closer shot and one wider place shot will make the next narrowing much easier.'),
    'retake_body_multi_photo' => __('quick_identify.retake_body_multi_photo', 'You already have multiple photos. The next gain is a decisive angle or a place clue that rules out similar taxa.'),
    'contribution_title' => __('quick_identify.contribution_title', 'How this helps everyone'),
    'contribution_body' => __('quick_identify.contribution_body', 'Your rationale-backed suggestion becomes part of the learning loop. Better observations today help guide the next person and future AI.'),
    'contribution_body_first' => __('quick_identify.contribution_body_first', 'This record has no earlier suggestion yet. Your first grounded suggestion can become the starting point for later review.'),
    'contribution_body_existing' => __('quick_identify.contribution_body_existing', 'This record already has suggestions. Your added rationale helps narrow the consensus and improves the training signal.'),
    'contribution_toast_first' => __('quick_identify.contribution_toast_first', 'You created the first clue for this record.'),
    'contribution_toast_existing' => __('quick_identify.contribution_toast_existing', 'Your suggestion added one more clue to the learning loop.'),
    'toast_success' => __('quick_identify.toast_success', 'Name sent'),
    'submit_failed_prefix' => __('quick_identify.submit_failed_prefix', 'Send failed: '),
    'submit_failed_fallback' => __('quick_identify.submit_failed_fallback', 'Please wait a bit and try again.'),
    'network_failed' => __('quick_identify.network_failed', 'Network error. Please try again where the signal is better.'),
];
$quickIdentifyState = [
    'locale' => $quickIdentifyLocale,
    'avatarAltTemplate' => __('user_avatar_alt', '{name} avatar'),
    'strings' => [
        'observationPhoto' => $quickIdentifyStrings['observation_photo'],
        'unidentified' => $quickIdentifyStrings['unidentified'],
        'photoLabel' => $quickIdentifyStrings['photo_label'],
        'photoCountSuffix' => $quickIdentifyStrings['photo_count_suffix'],
        'observerFallback' => $quickIdentifyStrings['observer_fallback'],
        'existingSuggestionsCount' => $quickIdentifyStrings['existing_suggestions_count'],
        'nameMissing' => $quickIdentifyStrings['name_missing'],
        'lifeStageAdult' => $quickIdentifyStrings['life_stage_adult'],
        'lifeStageJuvenile' => $quickIdentifyStrings['life_stage_juvenile'],
        'lifeStageEgg' => $quickIdentifyStrings['life_stage_egg'],
        'lifeStageTrace' => $quickIdentifyStrings['life_stage_trace'],
        'lifeStageUnknown' => $quickIdentifyStrings['life_stage_unknown'],
        'submit' => $quickIdentifyStrings['submit'],
        'submitting' => $quickIdentifyStrings['submitting'],
        'learnActionSpecies' => $quickIdentifyStrings['learn_action_species'],
        'learnActionDetails' => $quickIdentifyStrings['learn_action_details'],
        'retakeActionRecord' => $quickIdentifyStrings['retake_action_record'],
        'retakeActionDetails' => $quickIdentifyStrings['retake_action_details'],
        'contributionActionReview' => $quickIdentifyStrings['contribution_action_review'],
        'contributionActionCompare' => $quickIdentifyStrings['contribution_action_compare'],
        'learnTitle' => $quickIdentifyStrings['learn_title'],
        'learnBody' => $quickIdentifyStrings['learn_body'],
        'learnBodySpecies' => $quickIdentifyStrings['learn_body_species'],
        'learnBodyGenus' => $quickIdentifyStrings['learn_body_genus'],
        'retakeTitle' => $quickIdentifyStrings['retake_title'],
        'retakeBody' => $quickIdentifyStrings['retake_body'],
        'retakeBodySinglePhoto' => $quickIdentifyStrings['retake_body_single_photo'],
        'retakeBodyMultiPhoto' => $quickIdentifyStrings['retake_body_multi_photo'],
        'contributionTitle' => $quickIdentifyStrings['contribution_title'],
        'contributionBody' => $quickIdentifyStrings['contribution_body'],
        'contributionBodyFirst' => $quickIdentifyStrings['contribution_body_first'],
        'contributionBodyExisting' => $quickIdentifyStrings['contribution_body_existing'],
        'contributionToastFirst' => $quickIdentifyStrings['contribution_toast_first'],
        'contributionToastExisting' => $quickIdentifyStrings['contribution_toast_existing'],
        'toastSuccess' => $quickIdentifyStrings['toast_success'],
        'submitFailedPrefix' => $quickIdentifyStrings['submit_failed_prefix'],
        'submitFailedFallback' => $quickIdentifyStrings['submit_failed_fallback'],
        'networkFailed' => $quickIdentifyStrings['network_failed'],
    ],
    'lifeStageOptions' => [
        ['id' => 'adult', 'label' => $quickIdentifyStrings['life_stage_adult'], 'emoji' => '👑'],
        ['id' => 'juvenile', 'label' => $quickIdentifyStrings['life_stage_juvenile'], 'emoji' => '🌱'],
        ['id' => 'egg', 'label' => $quickIdentifyStrings['life_stage_egg'], 'emoji' => '🥚'],
        ['id' => 'trace', 'label' => $quickIdentifyStrings['life_stage_trace'], 'emoji' => '👣'],
        ['id' => 'unknown', 'label' => $quickIdentifyStrings['life_stage_unknown'], 'emoji' => '❓'],
    ],
];
?>

<div x-data="quickIdentify()"
    x-show="open"
    x-cloak
    @open-quick-id.window="openPanel($event.detail)"
    @keydown.escape.window="close()"
    class="fixed inset-0 z-[90]"
    role="dialog" aria-modal="true" aria-labelledby="quick-identify-title"
    x-transition:enter="transition ease-out duration-300"
    x-transition:enter-start="opacity-0"
    x-transition:enter-end="opacity-100"
    x-transition:leave="transition ease-in duration-200"
    x-transition:leave-start="opacity-100"
    x-transition:leave-end="opacity-0">

    <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" @click="close()"></div>

    <div class="absolute bottom-0 left-0 right-0 lg:bottom-auto lg:top-0 lg:left-auto lg:right-0 lg:w-[480px] lg:h-full bg-[#0a0d14] border-t lg:border-t-0 lg:border-l border-white/10 rounded-t-3xl lg:rounded-none shadow-2xl max-h-[90vh] lg:max-h-full overflow-y-auto overscroll-contain"
        x-transition:enter="transition ease-out duration-300"
        x-transition:enter-start="translate-y-full lg:translate-y-0 lg:translate-x-full"
        x-transition:enter-end="translate-y-0 lg:translate-x-0"
        x-transition:leave="transition ease-in duration-200"
        x-transition:leave-start="translate-y-0 lg:translate-x-0"
        x-transition:leave-end="translate-y-full lg:translate-y-0 lg:translate-x-full"
        @click.stop>

        <div class="lg:hidden w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-2"></div>

        <div class="sticky top-0 bg-[#0a0d14]/95 backdrop-blur-xl z-10 px-5 py-3 border-b border-white/5 flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 rounded-lg bg-[var(--color-primary)] text-black flex items-center justify-center">
                    <i data-lucide="microscope" class="w-4 h-4"></i>
                </div>
                <div>
                    <h2 id="quick-identify-title" class="text-sm font-black"><?= htmlspecialchars($quickIdentifyStrings['title']) ?></h2>
                    <p class="text-[10px] text-gray-500 font-mono" x-text="item ? item.id : ''"></p>
                </div>
            </div>
            <button @click="close()" class="p-2 hover:bg-white/10 rounded-full transition">
                <i data-lucide="x" class="w-5 h-5 text-gray-400"></i>
            </button>
        </div>

        <div class="px-5 py-4 space-y-5">
            <div class="flex gap-2 items-start" x-show="item">
                <div class="w-20 h-20 rounded-xl overflow-hidden bg-black/40 border border-white/10 flex-shrink-0 relative group cursor-pointer" @click="lightbox = true">
                    <img :src="item && item.photos && item.photos[0] ? item.photos[0] : ''" :alt="item && item.taxon ? item.taxon.name : strings.observationPhoto" class="w-full h-full object-cover group-hover:scale-110 transition duration-300" loading="lazy">
                    <div class="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                        <i data-lucide="maximize-2" class="w-4 h-4 text-white"></i>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-xs text-gray-400 truncate flex items-center gap-1">
                        <i data-lucide="calendar" class="w-3 h-3"></i>
                        <span x-text="item ? formatDate(item.observed_at) : ''"></span>
                    </p>
                    <p class="text-sm font-bold text-white mt-0.5 line-clamp-1" x-text="item && item.taxon ? item.taxon.name : strings.unidentified"></p>
                    <p class="text-[10px] text-gray-500 italic" x-text="item && item.taxon ? item.taxon.scientific_name : ''"></p>
                    <template x-if="item && item.photos && item.photos.length > 1">
                        <div class="flex gap-1 mt-1">
                            <template x-for="(photo, pi) in item.photos.slice(0, 4)" :key="pi">
                                <div class="w-6 h-6 rounded overflow-hidden border border-white/10 cursor-pointer hover:border-[var(--color-primary)] transition" @click.stop="lightboxIdx = pi; lightbox = true">
                                    <img :src="photo" :alt="photoAlt(pi + 1)" class="w-full h-full object-cover">
                                </div>
                            </template>
                            <template x-if="item.photos.length > 4">
                                <div class="w-6 h-6 rounded bg-white/5 border border-white/10 flex items-center justify-center text-[8px] font-bold text-gray-400" x-text="'+' + (item.photos.length - 4)"></div>
                            </template>
                        </div>
                    </template>
                </div>
            </div>

            <div x-show="item" class="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/5">
                <img :src="item ? (item.user_avatar || 'assets/img/default-avatar.svg') : ''" :alt="avatarAlt(item ? item.user_name : null)" class="w-8 h-8 rounded-full object-cover border border-white/10" loading="lazy">
                <div class="flex-1 min-w-0">
                    <p class="text-xs font-bold text-white/80 truncate" x-text="item ? (item.user_name || strings.observerFallback) : ''"></p>
                    <p x-show="item && item.location_name" class="text-[10px] text-gray-500 truncate flex items-center gap-1">
                        <i data-lucide="map-pin" class="w-2.5 h-2.5 shrink-0"></i>
                        <span x-text="item ? item.location_name : ''"></span>
                    </p>
                </div>
                <div class="text-right shrink-0">
                    <p class="text-[10px] text-gray-500 font-mono" x-text="item ? formatDate(item.observed_at) : ''"></p>
                    <p x-show="item && item.photos" class="text-[9px] text-gray-600" x-text="item && item.photos ? item.photos.length + strings.photoCountSuffix : ''"></p>
                </div>
            </div>

            <div x-show="item && item.identifications && item.identifications.length > 0">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5"><?= htmlspecialchars($quickIdentifyStrings['existing_suggestions']) ?> <span class="text-gray-600 normal-case" x-text="item && item.identifications ? strings.existingSuggestionsCount.replace('{count}', String(item.identifications.length)) : ''"></span></label>
                <div class="space-y-1.5 max-h-32 overflow-y-auto">
                    <template x-for="(eid, eidx) in (item ? item.identifications : [])" :key="eidx">
                        <div class="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                            <img :src="eid.user_avatar || 'assets/img/default-avatar.svg'" :alt="avatarAlt(eid.user_name)" class="w-5 h-5 rounded-full object-cover border border-white/10 shrink-0" loading="lazy">
                            <div class="flex-1 min-w-0">
                                <p class="text-xs font-bold text-white/80 truncate" x-text="eid.taxon_name || strings.nameMissing"></p>
                                <div class="flex items-center gap-1.5">
                                    <p class="text-[9px] text-gray-500 italic truncate" x-text="eid.scientific_name || ''"></p>
                                    <span x-show="eid.life_stage && eid.life_stage !== 'unknown'" class="text-[8px] px-1 py-0.5 rounded bg-white/10 text-gray-500 font-bold" x-text="lifeStageLabel(eid.life_stage)"></span>
                                </div>
                            </div>
                        </div>
                    </template>
                </div>
            </div>

            <div class="relative" @click.away="searchResults = []">
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5"><?= htmlspecialchars($quickIdentifyStrings['search_label']) ?></label>
                <div class="relative">
                    <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"></i>
                    <input type="text" x-model="query" @input.debounce.300ms="searchTaxon" @focus="if(query.length >= 2) searchTaxon()" x-ref="searchInput" placeholder="<?= htmlspecialchars($quickIdentifyStrings['search_placeholder']) ?>" class="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-[var(--color-primary)] transition">
                    <div x-show="searching" class="absolute right-3 top-1/2 -translate-y-1/2">
                        <div class="w-4 h-4 border-2 border-white/10 border-t-[var(--color-primary)] rounded-full animate-spin"></div>
                    </div>
                </div>

                <div x-show="searchResults.length > 0" x-transition class="absolute top-full left-0 right-0 mt-1 bg-[#111418] border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl max-h-[40vh] overflow-y-auto">
                    <template x-for="(result, ri) in searchResults" :key="result.key || ri">
                        <button @click.prevent="selectTaxon(result)" class="w-full text-left px-4 py-3 hover:bg-white/5 border-b border-white/5 last:border-0 transition flex items-center justify-between gap-2">
                            <div class="min-w-0">
                                <p class="font-bold text-sm truncate" x-text="result.canonicalName || result.ja_name || result.scientificName || result.scientific_name"></p>
                                <p class="text-xs text-gray-500 italic truncate" x-text="result.scientificName || result.scientific_name"></p>
                            </div>
                            <span class="text-[9px] px-2 py-0.5 rounded-full bg-white/10 font-bold uppercase shrink-0" x-text="result.rank"></span>
                        </button>
                    </template>
                </div>
            </div>

            <div x-show="selected" x-transition class="bg-[var(--color-primary)]/5 border border-[var(--color-primary)]/20 rounded-xl p-3 flex items-center justify-between gap-3">
                <div class="min-w-0">
                    <p class="text-[10px] font-bold text-[var(--color-primary)] flex items-center gap-1 mb-0.5">
                        <i data-lucide="check-circle-2" class="w-3 h-3"></i> <?= htmlspecialchars($quickIdentifyStrings['selected_label']) ?>
                    </p>
                    <p class="text-sm font-bold truncate" x-text="selected ? (selected.canonicalName || selected.ja_name || selected.scientificName || selected.scientific_name) : ''"></p>
                    <p class="text-xs text-gray-500 italic truncate" x-text="selected ? (selected.scientificName || selected.scientific_name) : ''"></p>
                </div>
                <button @click.prevent="clearSelection()" class="p-1.5 hover:bg-red-500/20 rounded-full transition shrink-0">
                    <i data-lucide="x" class="w-4 h-4 text-red-400"></i>
                </button>
            </div>

            <div class="grid gap-2">
                <div class="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)] mb-1" x-text="strings.learnTitle"></p>
                    <p class="text-xs text-gray-300 leading-relaxed" x-text="learnBody()"></p>
                    <a :href="learnActionHref()"
                        class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/80 transition hover:bg-white/10 hover:text-white">
                        <i data-lucide="book-open" class="w-3.5 h-3.5"></i>
                        <span x-text="learnActionLabel()"></span>
                    </a>
                </div>
                <div class="rounded-2xl border border-white/10 bg-white/5 p-3">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)] mb-1" x-text="strings.retakeTitle"></p>
                    <p class="text-xs text-gray-300 leading-relaxed" x-text="retakeBody()"></p>
                    <a :href="retakeActionHref()"
                        class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/80 transition hover:bg-white/10 hover:text-white">
                        <i data-lucide="camera" class="w-3.5 h-3.5"></i>
                        <span x-text="retakeActionLabel()"></span>
                    </a>
                </div>
                <div class="rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-primary)]/5 p-3">
                    <p class="text-[10px] font-bold uppercase tracking-widest text-[var(--color-primary)] mb-1" x-text="strings.contributionTitle"></p>
                    <p class="text-xs text-gray-300 leading-relaxed" x-text="contributionBody()"></p>
                    <a :href="contributionActionHref()"
                        class="mt-3 inline-flex items-center gap-1.5 rounded-full border border-[var(--color-primary)]/20 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-[var(--color-primary)] transition hover:bg-white/10">
                        <i data-lucide="git-branch-plus" class="w-3.5 h-3.5"></i>
                        <span x-text="contributionActionLabel()"></span>
                    </a>
                </div>
            </div>

            <input type="hidden" x-model="confidence" value="sure">

            <div>
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5"><?= htmlspecialchars($quickIdentifyStrings['life_stage_label']) ?></label>
                <div class="grid grid-cols-5 gap-1.5">
                    <template x-for="ls in lifeStageOptions" :key="ls.id">
                        <button type="button" @click="lifeStage = ls.id" :class="lifeStage === ls.id ? 'bg-[var(--color-primary)] text-black border-[var(--color-primary)]' : 'bg-white/5 border-white/10 text-gray-500'" class="flex flex-col items-center py-1.5 rounded-xl border transition overflow-hidden">
                            <span class="text-xs" x-text="ls.emoji"></span>
                            <span class="text-[8px] font-bold mt-0.5" x-text="ls.label"></span>
                        </button>
                    </template>
                </div>
            </div>

            <div>
                <label class="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5"><?= htmlspecialchars($quickIdentifyStrings['note_label']) ?> <span class="text-gray-600 normal-case"><?= htmlspecialchars($quickIdentifyStrings['optional']) ?></span></label>
                <textarea x-model="note" placeholder="<?= htmlspecialchars($quickIdentifyStrings['note_placeholder']) ?>" maxlength="200" class="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 h-16 text-sm focus:outline-none focus:border-[var(--color-primary)] transition resize-none"></textarea>
            </div>

            <button @click="submitIdentification()" :disabled="!selected || submitting" class="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition" :class="selected && !submitting ? 'bg-[var(--color-primary)] text-black hover:brightness-110 shadow-lg shadow-[var(--color-primary)]/20' : 'bg-white/5 text-gray-500 cursor-not-allowed'">
                <template x-if="!submitting">
                    <span class="flex items-center gap-2">
                        <i data-lucide="check-square" class="w-4 h-4"></i>
                        <span x-text="strings.submit"></span>
                    </span>
                </template>
                <template x-if="submitting">
                    <span class="flex items-center gap-2">
                        <div class="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin"></div>
                        <span x-text="strings.submitting"></span>
                    </span>
                </template>
            </button>

            <div class="flex gap-2 pb-4">
                <button @click="skipAndNext('pass')" class="flex-1 py-2 rounded-lg border border-white/5 bg-white/5 text-gray-400 text-xs font-bold hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 transition flex items-center justify-center gap-1.5">
                    <i data-lucide="x" class="w-3.5 h-3.5"></i> <?= htmlspecialchars($quickIdentifyStrings['pass']) ?>
                </button>
                <button @click="skipAndNext('later')" class="flex-1 py-2 rounded-lg border border-white/5 bg-white/5 text-gray-400 text-xs font-bold hover:bg-yellow-500/10 hover:text-yellow-400 hover:border-yellow-500/30 transition flex items-center justify-center gap-1.5">
                    <i data-lucide="bookmark" class="w-3.5 h-3.5"></i> <?= htmlspecialchars($quickIdentifyStrings['later']) ?>
                </button>
                <a :href="item ? 'observation_detail.php?id=' + item.id : '#'" class="flex-1 py-2 rounded-lg border border-white/5 bg-white/5 text-gray-400 text-xs font-bold hover:bg-white/10 hover:text-white transition flex items-center justify-center gap-1.5">
                    <i data-lucide="external-link" class="w-3.5 h-3.5"></i> <?= htmlspecialchars($quickIdentifyStrings['details']) ?>
                </a>
            </div>
        </div>
    </div>

    <div x-show="lightbox" x-transition.opacity class="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="quick-identify-lightbox-title" @click="lightbox = false">
        <h2 id="quick-identify-lightbox-title" class="sr-only"><?= htmlspecialchars($quickIdentifyStrings['observation_photo']) ?></h2>
        <button @click.stop="lightbox = false" class="absolute top-4 right-4 p-2 bg-white/10 rounded-full z-[101] hover:bg-white/20 transition">
            <i data-lucide="x" class="w-5 h-5 text-white"></i>
        </button>
        <template x-if="item && item.photos">
            <div class="relative max-w-full max-h-full" @click.stop>
                <img :src="item.photos[lightboxIdx] || ''" :alt="photoAlt(lightboxIdx + 1)" class="max-w-full max-h-[85vh] object-contain">
                <template x-if="item.photos.length > 1">
                    <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                        <template x-for="(p, pi) in item.photos" :key="pi">
                            <button @click.stop="lightboxIdx = pi" class="w-8 h-8 rounded-lg overflow-hidden border-2 transition" :class="lightboxIdx === pi ? 'border-[var(--color-primary)] scale-110' : 'border-white/20 opacity-60'">
                                <img :src="p" :alt="photoAlt(pi + 1)" class="w-full h-full object-cover">
                            </button>
                        </template>
                    </div>
                </template>
            </div>
        </template>
    </div>
</div>

<div x-data="{ showToast: false, toastMsg: '' }" @id-toast.window="toastMsg = $event.detail.message; showToast = true; setTimeout(() => showToast = false, 3000)" x-show="showToast" x-cloak class="fixed bottom-24 left-1/2 -translate-x-1/2 z-[95] px-6 py-3 bg-green-500/90 text-black font-bold text-sm rounded-full shadow-2xl flex items-center gap-2 backdrop-blur-md">
    <i data-lucide="check-circle-2" class="w-4 h-4"></i>
    <span x-text="toastMsg"></span>
</div>

<script nonce="<?= CspNonce::attr() ?>">
    function quickIdentify() {
        return {
            open: false,
            item: null,
            query: '',
            searchResults: [],
            selected: null,
            confidence: 'maybe',
            lifeStage: 'unknown',
            note: '',
            submitting: false,
            searching: false,
            lightbox: false,
            lightboxIdx: 0,
            locale: <?= json_encode($quickIdentifyState['locale'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>,
            avatarAltTemplate: <?= json_encode($quickIdentifyState['avatarAltTemplate'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>,
            strings: <?= json_encode($quickIdentifyState['strings'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>,
            lifeStageOptions: <?= json_encode($quickIdentifyState['lifeStageOptions'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?>,
            _queueItems: [],
            _currentIndex: -1,
            openPanel(detail) {
                this.item = detail.item || detail;
                this._queueItems = detail.queue || [];
                this._currentIndex = detail.index ?? -1;
                this.resetForm();
                this.open = true;
                this.$nextTick(() => {
                    lucide.createIcons();
                    if (this.$refs.searchInput) this.$refs.searchInput.focus();
                });
            },
            close() {
                this.open = false;
                this.item = null;
                this.resetForm();
            },
            resetForm() {
                this.query = '';
                this.searchResults = [];
                this.selected = null;
                this.confidence = 'maybe';
                this.lifeStage = 'unknown';
                this.note = '';
                this.submitting = false;
                this.lightbox = false;
                this.lightboxIdx = 0;
            },
            avatarAlt(name) {
                return this.avatarAltTemplate.replace('{name}', name || this.strings.observerFallback);
            },
            photoAlt(index) {
                return this.strings.photoLabel.replace('{index}', String(index));
            },
            lifeStageLabel(stage) {
                const labels = {
                    adult: this.strings.lifeStageAdult,
                    juvenile: this.strings.lifeStageJuvenile,
                    egg: this.strings.lifeStageEgg,
                    trace: this.strings.lifeStageTrace,
                    unknown: this.strings.lifeStageUnknown,
                };
                return labels[stage] || this.strings.lifeStageUnknown;
            },
            selectedRank() {
                return String(this.selected?.rank || '').toLowerCase();
            },
            currentIdentificationCount() {
                return Array.isArray(this.item?.identifications) ? this.item.identifications.length : 0;
            },
            learnBody() {
                const rank = this.selectedRank();
                if (rank === 'species' || rank === 'subspecies' || rank === 'variety') {
                    return this.strings.learnBodySpecies;
                }
                if (rank === 'genus' || rank === 'family' || rank === 'order' || rank === 'class') {
                    return this.strings.learnBodyGenus;
                }
                return this.strings.learnBody;
            },
            retakeBody() {
                const photoCount = Array.isArray(this.item?.photos) ? this.item.photos.length : 0;
                if (photoCount <= 1) {
                    return this.strings.retakeBodySinglePhoto;
                }
                if (photoCount >= 2) {
                    return this.strings.retakeBodyMultiPhoto;
                }
                return this.strings.retakeBody;
            },
            contributionBody() {
                return this.currentIdentificationCount() === 0
                    ? this.strings.contributionBodyFirst
                    : this.strings.contributionBodyExisting;
            },
            observationDetailHref(anchor = '') {
                if (!this.item?.id) return '#';
                return `observation_detail.php?id=${encodeURIComponent(this.item.id)}${anchor}`;
            },
            selectedTaxonLabel() {
                return this.selected?.canonicalName
                    || this.selected?.ja_name
                    || this.selected?.scientificName
                    || this.selected?.scientific_name
                    || '';
            },
            selectedTaxonHref() {
                const scientificName = this.selected?.scientificName || this.selected?.scientific_name || '';
                const commonName = this.selectedTaxonLabel();
                if (scientificName) {
                    return `species.php?name=${encodeURIComponent(scientificName)}`;
                }
                if (commonName) {
                    return `species.php?jp=${encodeURIComponent(commonName)}`;
                }
                return this.observationDetailHref('');
            },
            learnActionHref() {
                return this.selected ? this.selectedTaxonHref() : this.observationDetailHref('');
            },
            learnActionLabel() {
                return this.selected ? this.strings.learnActionSpecies : this.strings.learnActionDetails;
            },
            retakeActionHref() {
                const lat = this.item?.lat;
                const lng = this.item?.lng;
                if (lat !== undefined && lat !== null && lng !== undefined && lng !== null && lat !== '' && lng !== '') {
                    const params = new URLSearchParams({
                        return: 'observation_detail.php',
                        id: this.item?.id || '',
                        lat: String(lat),
                        lng: String(lng),
                    });
                    const placeName = this.item?.location_name || this.item?.municipality || this.item?.place_name || '';
                    if (placeName) {
                        params.set('location_name', placeName);
                    }
                    return `post.php?${params.toString()}`;
                }
                return this.observationDetailHref('');
            },
            retakeActionLabel() {
                const lat = this.item?.lat;
                const lng = this.item?.lng;
                return (lat !== undefined && lat !== null && lng !== undefined && lng !== null && lat !== '' && lng !== '')
                    ? this.strings.retakeActionRecord
                    : this.strings.retakeActionDetails;
            },
            contributionActionHref() {
                return this.observationDetailHref('#id-list-container');
            },
            contributionActionLabel() {
                return this.currentIdentificationCount() === 0
                    ? this.strings.contributionActionReview
                    : this.strings.contributionActionCompare;
            },
            async searchTaxon() {
                if (this.query.length < 2) {
                    this.searchResults = [];
                    return;
                }
                this.searching = true;
                try {
                    const res = await fetch(`api/search_taxon.php?q=${encodeURIComponent(this.query)}`);
                    const data = await res.json();
                    this.searchResults = data.results || [];
                } catch (e) {
                    console.error('Taxon search failed:', e);
                    this.searchResults = [];
                } finally {
                    this.searching = false;
                }
            },
            selectTaxon(result) {
                this.selected = result;
                this.searchResults = [];
                this.query = result.canonicalName || result.ja_name || result.scientificName || result.scientific_name;
            },
            clearSelection() {
                this.selected = null;
                this.query = '';
                this.$nextTick(() => {
                    if (this.$refs.searchInput) this.$refs.searchInput.focus();
                });
            },
            async submitIdentification() {
                if (!this.selected || !this.item || this.submitting) return;
                this.submitting = true;
                try {
                    const payload = {
                        observation_id: this.item.id,
                        taxon_key: this.selected.key || this.selected.gbif_key || null,
                        taxon_name: this.selected.canonicalName || this.selected.ja_name || this.selected.scientificName || this.selected.scientific_name,
                        scientific_name: this.selected.scientificName || this.selected.scientific_name,
                        taxon_rank: this.selected.rank || 'species',
                        taxon_slug: this.selected.slug || ((this.selected.canonicalName || this.selected.ja_name || '').toLowerCase().replace(/\s+/g, '-')),
                        confidence: this.confidence,
                        life_stage: this.lifeStage,
                        note: this.note,
                        inat_taxon_id: this.selected.inat_taxon_id || null,
                        lineage: this.selected.lineage || {
                            kingdom: this.selected.kingdom || null,
                            phylum: this.selected.phylum || null,
                            class: this.selected.class || null,
                            order: this.selected.order || null,
                            family: this.selected.family || null,
                            genus: this.selected.genus || null,
                        },
                        lineage_ids: this.selected.lineage_ids || {},
                    };
                    const _csrf = document.querySelector('meta[name=\"csrf-token\"]')?.content || '';
                    const res = await fetch('api/post_identification.php', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Csrf-Token': _csrf
                        },
                        body: JSON.stringify(payload)
                    });
                    const result = await res.json();
                    if (result.success) {
                        if (window.ikimonAnalytics) {
                            window.ikimonAnalytics.track('identification_habit_qualified', {
                                observation_id: this.item.id,
                                taxon_name: payload.taxon_name
                            });
                        }
                        this.$dispatch('identification-submitted', {
                            observationId: this.item.id,
                            taxonName: payload.taxon_name
                        });
                        const contributionToast = this.currentIdentificationCount() === 0
                            ? this.strings.contributionToastFirst
                            : this.strings.contributionToastExisting;
                        this.$dispatch('id-toast', { message: this.strings.toastSuccess + ' ' + contributionToast });
                        this.advanceToNext();
                    } else {
                        alert(this.strings.submitFailedPrefix + (result.message || this.strings.submitFailedFallback));
                        this.submitting = false;
                    }
                } catch (e) {
                    console.error('Identification submit failed:', e);
                    alert(this.strings.networkFailed);
                    this.submitting = false;
                }
            },
            skipAndNext(action) {
                if (!this.item) return;
                this.$dispatch('quick-id-action', { action: action, observationId: this.item.id });
                this.advanceToNext();
            },
            advanceToNext() {
                if (this._queueItems.length > 0 && this._currentIndex >= 0) {
                    const nextIndex = this._currentIndex + 1;
                    if (nextIndex < this._queueItems.length) {
                        this._currentIndex = nextIndex;
                        this.item = this._queueItems[nextIndex];
                        this.resetForm();
                        this.$nextTick(() => {
                            lucide.createIcons();
                            if (this.$refs.searchInput) this.$refs.searchInput.focus();
                        });
                        return;
                    }
                }
                this.close();
            },
            formatDate(d) {
                if (!d) return '';
                const locale = this.locale === 'pt-BR' ? 'pt-BR' : this.locale;
                return new Date(d).toLocaleDateString(locale, { month: 'short', day: 'numeric' });
            }
        };
    }
</script>
