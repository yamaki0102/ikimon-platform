<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CSRF.php';
require_once __DIR__ . '/../libs/SurveyManager.php';
require_once __DIR__ . '/../libs/Asset.php';
require_once __DIR__ . '/../libs/SurveyorManager.php';
require_once __DIR__ . '/../libs/Lang.php';

// Guest Access Allowed — ゲストは3件まで投稿可能
Auth::init();
Lang::init();
$csrfToken = CSRF::generate(); // Must be called before any HTML output (setcookie requires headers not sent)

// Check for active survey (Auth::init() 後に呼ぶ — userId が必要)
$activeSurvey = null;
if (Auth::isLoggedIn()) {
    $activeSurvey = SurveyManager::getActive(Auth::user()['id']);
}

$isLoggedIn = Auth::isLoggedIn();
$isGuest = !$isLoggedIn;
$guestPostCount = 0;
$canPost = true;
$currentUser = Auth::user();
$canSurveyorOfficialPost = SurveyorManager::isApproved($currentUser);
$documentLang = Lang::current();
$jsLocale = $documentLang === 'pt-br' ? 'pt-BR' : $documentLang;

// Return URL after posting (e.g., from field_research.php)
$returnUrl = isset($_GET['return']) ? htmlspecialchars($_GET['return'], ENT_QUOTES, 'UTF-8') : '';

if ($isGuest) {
    Auth::initGuest();
    $guestPostCount = Auth::getGuestPostCount();
    $canPost = Auth::canGuestPost();

    // ゲスト上限到達 → ログインページへ
    if (!$canPost) {
        header('Location: login.php?redirect=' . urlencode('post.php') . '&reason=guest_limit');
        exit;
    }
}
?>
<!DOCTYPE html>
<html lang="<?= htmlspecialchars($documentLang, ENT_QUOTES, 'UTF-8') ?>">

<head>
    <?php
$meta_title = __('post_page.meta_title', 'Save today’s finds — ikimon');
$meta_description = __('post_page.meta_description', 'Save what you found nearby first. You can start with one photo even if the name is still unclear.');
    include __DIR__ . '/components/meta.php';
    ?>
    <style>
        /* M3 Filled TextField */
        .m3-input {
            width: 100%; box-sizing: border-box;
            background: var(--md-surface-variant);
            border: none;
            border-bottom: 2px solid var(--md-outline);
            border-radius: var(--shape-xs) var(--shape-xs) 0 0;
            padding: 12px 16px;
            font-size: var(--type-body-md);
            color: var(--md-on-surface);
            outline: none;
            transition: border-color var(--motion-short) var(--motion-std),
                        background var(--motion-short) var(--motion-std);
            appearance: none;
        }
        .m3-input:focus {
            border-bottom-color: var(--md-primary);
            background: var(--md-surface-container);
        }
        .m3-input::placeholder { color: var(--md-on-surface-variant); opacity: 0.7; }

        /* M3 Filter Chip (for individual count) */
        .m3-chip {
            position: relative; overflow: hidden;
            display: inline-flex; align-items: center; gap: 6px;
            padding: 10px 18px;
            min-height: 44px;
            border-radius: var(--shape-full);
            border: 1px solid var(--md-outline);
            background: transparent;
            color: var(--md-on-surface-variant);
            font-size: var(--type-label-lg);
            font-weight: 600;
            white-space: nowrap;
            cursor: pointer;
            transition: background var(--motion-short) var(--motion-std),
                        color var(--motion-short) var(--motion-std),
                        border-color var(--motion-short) var(--motion-std);
        }
        .m3-chip::before {
            content: ''; position: absolute; inset: 0;
            background: currentColor; opacity: 0;
            border-radius: inherit;
            transition: opacity var(--motion-short) var(--motion-std);
            pointer-events: none;
        }
        .m3-chip:hover::before { opacity: 0.08; }
        .m3-chip:active::before { opacity: 0.12; }
        .m3-chip.selected {
            background: var(--md-secondary-container);
            color: var(--md-on-secondary-container);
            border-color: transparent;
        }

        /* M3 Filled Button */
        .m3-btn-filled {
            position: relative; overflow: hidden;
            display: flex; align-items: center; justify-content: center; gap: 8px;
            width: 100%;
            background: var(--md-primary); color: var(--md-on-primary);
            border: none; border-radius: var(--shape-full);
            padding: 16px 24px;
            font-size: var(--type-label-lg); font-weight: 700;
            cursor: pointer;
            transition: box-shadow var(--motion-short) var(--motion-std);
        }
        .m3-btn-filled::before {
            content: ''; position: absolute; inset: 0;
            background: currentColor; opacity: 0; border-radius: inherit;
            transition: opacity var(--motion-short) var(--motion-std);
            pointer-events: none;
        }
        .m3-btn-filled:hover { box-shadow: var(--elev-1); }
        .m3-btn-filled:hover::before { opacity: 0.08; }
        .m3-btn-filled:active::before { opacity: 0.12; }
        .m3-btn-filled:disabled { opacity: 0.38; box-shadow: none; cursor: not-allowed; }

        /* M3 Tonal Button */
        .m3-btn-tonal {
            position: relative; overflow: hidden;
            display: flex; align-items: center; justify-content: center; gap: 8px;
            width: 100%;
            background: var(--md-secondary-container); color: var(--md-on-secondary-container);
            border: none; border-radius: var(--shape-full);
            padding: 14px 24px;
            font-size: var(--type-label-lg); font-weight: 700;
            cursor: pointer;
            transition: box-shadow var(--motion-short) var(--motion-std);
        }
        .m3-btn-tonal::before {
            content: ''; position: absolute; inset: 0;
            background: currentColor; opacity: 0; border-radius: inherit;
            transition: opacity var(--motion-short) var(--motion-std);
            pointer-events: none;
        }
        .m3-btn-tonal:hover { box-shadow: var(--elev-1); }
        .m3-btn-tonal:hover::before { opacity: 0.08; }
        .m3-btn-tonal:active::before { opacity: 0.12; }
    </style>
    <!-- EXIF.js for client-side extraction -->
    <!-- EXIF.js: Removed in favor of local js/exif-mini.js -->
    <!-- Leaflet -->
    <script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js"></script>
    <link href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css" rel="stylesheet" />
    <!-- Offline Manager -->
    <script src="<?= htmlspecialchars(Asset::versioned('/js/ToastManager.js')) ?>"></script>
    <script src="<?= htmlspecialchars(Asset::versioned('/js/OfflineManager.js')) ?>"></script>
    <script src="<?= htmlspecialchars(Asset::versioned('/js/gamification-modal.js')) ?>"></script>
</head>

<body class="js-loading font-body" style="background:var(--md-surface);color:var(--md-on-surface);">

    <script nonce="<?= CspNonce::attr() ?>">
        document.body.classList.remove('js-loading');
    </script>

    <div x-data="uploader()" class="w-full md:max-w-md mx-auto relative min-h-screen">

        <!-- Immersive Header -->
        <header class="fixed top-0 left-0 w-full md:max-w-md md:left-[50%] md:translate-x-[-50%] h-14 flex items-center justify-between px-4 bg-surface/90 backdrop-blur-xl z-50 border-b border-border">
            <a href="javascript:history.length > 1 ? history.back() : location.href='index.php'" aria-label="<?= __('post_page.back', 'Back') ?>" class="p-3 -ml-3 text-muted hover:text-text transition">
                <i data-lucide="x" class="w-6 h-6"></i>
            </a>
            <h1 class="text-sm font-black tracking-widest uppercase text-text"><?= __('post_page.title', 'Save today’s finds') ?></h1>
            <div class="w-10"></div>
        </header>

        <!-- オフラインバナー -->
        <div x-data="{ offline: !navigator.onLine }" @online.window="offline = false" @offline.window="offline = true"
            x-show="offline" x-transition
            class="fixed top-14 left-0 w-full md:max-w-md md:left-[50%] md:translate-x-[-50%] z-40 px-4 py-2 flex items-center gap-2" style="background:var(--md-error-container);border-bottom:1px solid var(--md-outline-variant);">
            <i data-lucide="wifi-off" class="w-3.5 h-3.5 text-danger"></i>
            <span class="text-xs font-bold text-danger"><?= __('post_page.offline_banner', 'Offline — input is saved on the device and sent automatically when the connection returns') ?></span>
        </div>

        <!-- ゲストモードバナー -->
        <template x-if="isGuest">
            <div class="fixed top-14 left-0 w-full md:max-w-md md:left-[50%] md:translate-x-[-50%] z-40 px-4 py-2 flex items-center justify-between" style="background:var(--md-tertiary-container);border-bottom:1px solid var(--md-outline-variant);">
                <span class="text-xs text-accent font-bold flex items-center gap-1">
                    <i data-lucide="user" class="w-3 h-3"></i>
                    <?= __('post_page.guest_count', 'Guest posts') ?> <span x-text="guestPostCount"></span>/<span x-text="guestPostLimit"></span>
                </span>
                <a href="login.php?redirect=post.php" class="text-[10px] font-bold text-primary bg-elevated px-3 py-1 rounded-full border border-primary/20 hover:bg-primary-surface transition">
                    🔑 <?= __('post_page.guest_continue', 'Sign in to continue') ?>
                </a>
            </div>
        </template>

        <main :class="isGuest ? 'pt-28 pb-32 px-4' : 'pt-20 pb-32 px-4'">
            <section class="mb-5 px-4 py-4" style="background:var(--md-primary-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
                <div class="flex items-start gap-3">
                    <div class="w-11 h-11 rounded-2xl bg-white/80 text-primary flex items-center justify-center shrink-0">
                        <i data-lucide="sparkles" class="w-5 h-5"></i>
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm font-black text-text"><?= __('post_page.hero_title', 'You do not need the right answer right away') ?></p>
                        <p class="text-xs text-muted mt-1 leading-relaxed"><?= __('post_page.hero_body', 'Save what you found nearby first. Even if the name is unclear, a record you can revisit later is what matters most.') ?></p>
                    </div>
                </div>
            </section>

            <div x-show="outboxCount > 0" x-transition class="mb-4 px-4 py-3 flex items-start gap-3" style="background:var(--md-tertiary-container);border-radius:var(--shape-xl);">
                <div class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                    <i data-lucide="cloud-upload" class="w-4 h-4"></i>
                </div>
                <div class="flex-1 min-w-0">
                    <p class="text-sm font-black text-text" x-text="'<?= addslashes(__('post_page.outbox_title', 'Outbox has {count} pending items')) ?>'.replace('{count}', outboxCount)"></p>
                    <p class="text-xs text-muted mt-1 leading-relaxed"><?= __('post_page.outbox_body', 'If the connection drops or a 5xx occurs, the item is moved to the queue. It will resend automatically when the connection returns.') ?></p>
                </div>
            </div>


            <!-- 観察会連携バナー -->
            <template x-if="event_id">
                <div class="mb-4 flex items-center gap-3 px-4 py-3" style="background:var(--md-primary-container);border-radius:var(--shape-xl);">
                    <span class="text-2xl">📋</span>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-primary truncate" x-text="event_name"></p>
                        <p class="text-[10px] text-primary/60"><?= __('post_page.event_linked', 'This record will be linked to the event') ?></p>
                    </div>
                    <button type="button" @click="event_id = null; event_name = ''" class="text-primary/40 hover:text-primary p-1">
                        <i data-lucide="x" class="w-4 h-4"></i>
                    </button>
                </div>
            </template>

            <form @submit.prevent="submit" class="space-y-8">
                <?php if ($canSurveyorOfficialPost): ?>
                <div class="px-4 py-4" style="background:var(--md-surface-container);border-radius:var(--shape-xl);box-shadow:var(--elev-1);">
                    <div class="flex items-start gap-3">
                        <div class="w-11 h-11 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                            <i data-lucide="badge-check" class="w-5 h-5"></i>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-sm font-black text-sky-900"><?= __('post_page.surveyor_title', 'Surveyor mode is enabled') ?></p>
                            <p class="text-xs text-sky-900/70 mt-1 leading-relaxed">
                                <?= __('post_page.surveyor_body', 'In addition to a normal photo record, you can leave an official record from field confirmation alone. If there is no photo, please record the species name and notes as specifically as possible.') ?>
                            </p>
                            <div class="mt-3 flex flex-wrap gap-2">
                                <button type="button" @click="record_mode = 'standard'" class="px-3 py-2 rounded-xl text-xs font-bold border transition"
                                    :class="record_mode === 'standard' ? 'bg-primary text-white border-primary' : 'bg-white text-text border-sky-200'">
                                    <?= __('post_page.mode_standard', 'Standard record') ?>
                                </button>
                                <button type="button" @click="record_mode = 'surveyor_official'" class="px-3 py-2 rounded-xl text-xs font-bold border transition"
                                    :class="record_mode === 'surveyor_official' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-sky-800 border-sky-200'">
                                    <?= __('post_page.mode_official', 'Official surveyor record') ?>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <?php endif; ?>

                <!-- Photo Upload Area -->
                <div class="relative">
                    <!-- 📷 EXIF Detection Toast -->
                    <div x-show="exifToastVisible" x-transition:enter="transition ease-out duration-300"
                        x-transition:enter-start="opacity-0 transform -translate-y-2"
                        x-transition:enter-end="opacity-100 transform translate-y-0"
                        x-transition:leave="transition ease-in duration-200"
                        x-transition:leave-start="opacity-100"
                        x-transition:leave-end="opacity-0"
                        class="absolute top-0 left-0 right-0 z-30 mx-2">
                        <div class="bg-primary/90 backdrop-blur-md text-white text-xs font-bold rounded-2xl px-4 py-2.5 flex items-center gap-2 shadow-lg shadow-primary/30">
                            <span class="text-base animate-bounce">📷</span>
                            <span x-text="exifToast"></span>
                            <span class="ml-auto text-white/60 text-[10px]">✨ Smart</span>
                        </div>
                    </div>
                    <!-- Hidden file inputs -->
                    <input type="file" accept="image/*" capture="environment" class="hidden" x-ref="cameraInput" @change="handleFiles">
                    <input type="file" multiple accept="image/*" class="hidden" x-ref="galleryInput" @change="handleFiles">
                    <input type="file" accept="video/*" capture="environment" class="hidden" x-ref="videoInput" @change="handleVideoFile">

                    <div class="border-2 border-dashed border-border rounded-3xl p-6 text-center transition bg-surface hover:bg-white/5">
                        <div x-show="photos.length === 0 && !videoAsset && !videoUploading && !videoProcessing">
                            <i data-lucide="camera" class="w-10 h-10 mx-auto mb-3 text-primary"></i>
                            <p class="text-sm font-bold mb-1 text-text" x-text="record_mode === 'surveyor_official' ? '<?= addslashes(__('post_page.photo_heading_official', 'You can leave an official record without a photo')) ?>' : '<?= addslashes(__('post_page.photo_heading_standard', 'Take or choose a living thing photo')) ?>'"></p>
                            <p class="text-xs text-muted mb-2" x-text="record_mode === 'surveyor_official' ? '<?= addslashes(__('post_page.photo_sub_official', 'If this is field confirmation only, continue to the form below. A photo helps reuse the record later if you have one.')) ?>' : '<?= addslashes(__('post_page.photo_sub_standard', 'A photo is enough to start. The name can come later.')) ?>'"></p>
                            <p x-show="record_mode !== 'surveyor_official'" class="text-[10px] text-faint mb-4">🌱 <?= __('post_page.photo_context', 'Everyday records become the base layer of local ecosystem data') ?></p>
                            <div class="flex flex-col gap-3">
                                <button type="button" @click="$refs.cameraInput.click()" class="m3-btn-filled" style="padding:20px 24px;border-radius:var(--shape-xl);justify-content:flex-start;">
                                    <i data-lucide="camera" class="w-6 h-6" style="pointer-events:none;flex-shrink:0;"></i>
                                    <div style="text-align:left;">
                                        <span style="display:block;">📸 <?= __('post_page.take_photo', 'Take a photo') ?></span>
                                        <span style="display:block;font-size:var(--type-body-sm);font-weight:400;opacity:0.8;"><?= __('post_page.take_photo_body', 'It will also be saved to your camera roll') ?></span>
                                    </div>
                                </button>
                                <button type="button" @click="$refs.galleryInput.click()" class="m3-btn-tonal" style="padding:18px 24px;border-radius:var(--shape-xl);justify-content:flex-start;">
                                    <i data-lucide="image" class="w-6 h-6" style="pointer-events:none;flex-shrink:0;"></i>
                                    <div style="text-align:left;">
                                        <span style="display:block;">🖼️ <?= __('post_page.choose_gallery', 'Choose from gallery') ?></span>
                                        <span style="display:block;font-size:var(--type-body-sm);font-weight:400;opacity:0.7;"><?= __('post_page.choose_gallery_body', 'Upload a saved photo') ?></span>
                                    </div>
                                </button>
                                <button type="button" @click="$refs.videoInput.click()" class="m3-btn-tonal" style="padding:18px 24px;border-radius:var(--shape-xl);justify-content:flex-start;">
                                    <i data-lucide="video" class="w-6 h-6" style="pointer-events:none;flex-shrink:0;"></i>
                                    <div style="text-align:left;">
                                        <span style="display:block;">🎥 15秒動画を残す</span>
                                        <span style="display:block;font-size:var(--type-body-sm);font-weight:400;opacity:0.7;">端末でできるだけ圧縮して、そのまま証拠動画として残す</span>
                                    </div>
                                </button>
                                <template x-if="record_mode === 'surveyor_official'">
                                    <button type="button" @click="ensureFormReady()" class="m3-btn-tonal" style="padding:18px 24px;border-radius:var(--shape-xl);justify-content:flex-start;">
                                        <i data-lucide="clipboard-check" class="w-6 h-6" style="pointer-events:none;flex-shrink:0;"></i>
                                        <div style="text-align:left;">
                                            <span style="display:block;">📝 <?= __('post_page.official_no_photo', 'Official record without photo') ?></span>
                                            <span style="display:block;font-size:var(--type-body-sm);font-weight:400;opacity:0.7;"><?= __('post_page.official_no_photo_body', 'We will keep location, date, species name, and notes') ?></span>
                                        </div>
                                    </button>
                                </template>
                                <template x-if="record_mode !== 'surveyor_official'">
                                    <button type="button" @click="lightMode = true; ensureFormReady(); showDetails = true" class="w-full text-center py-2 text-xs font-bold text-faint hover:text-primary transition">
                                        <i data-lucide="pen-line" class="w-3 h-3 inline-block mr-1" style="pointer-events:none;"></i>
                                        <?= __('post_page.note_only', 'Leave a note only') ?>
                                    </button>
                                </template>
                            </div>
                        </div>

                        <div x-show="videoAsset || videoUploading || videoProcessing || videoError" class="space-y-3">
                            <div class="text-left rounded-2xl border border-border bg-base/60 p-4">
                                <div class="flex items-start gap-3">
                                    <div class="w-24 h-24 rounded-2xl overflow-hidden bg-black flex items-center justify-center shrink-0">
                                        <template x-if="videoPreview">
                                            <video :src="videoPreview" class="w-full h-full object-cover" muted playsinline preload="metadata"></video>
                                        </template>
                                        <template x-if="!videoPreview">
                                            <i data-lucide="video" class="w-8 h-8 text-white/70"></i>
                                        </template>
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2">
                                            <span class="text-sm font-black text-text">短尺動画</span>
                                            <span class="text-[10px] font-bold px-2 py-1 rounded-full bg-primary/10 text-primary">15秒以内</span>
                                        </div>
                                        <p class="mt-1 text-xs text-muted" x-show="videoProcessing">端末で圧縮できるか確認している…</p>
                                        <p class="mt-1 text-xs text-muted" x-show="videoUploading" x-text="'Cloudflare Stream に直接送っている… ' + videoUploadProgress + '%'"></p>
                                        <p class="mt-1 text-xs text-muted" x-show="videoAsset && !videoUploading && !videoProcessing" x-text="'アップロード済み / ' + Math.max(1, Math.round((videoAsset.durationMs || 0) / 1000)) + '秒'"></p>
                                        <p class="mt-1 text-xs text-danger" x-show="videoError" x-text="videoError"></p>
                                        <div class="mt-3 h-2 rounded-full bg-black/10 overflow-hidden" x-show="videoUploading">
                                            <div class="h-full bg-primary transition-all" :style="'width:' + videoUploadProgress + '%'"></div>
                                        </div>
                                    </div>
                                    <button type="button" @click="clearVideo()" class="w-10 h-10 rounded-full bg-black/5 text-faint hover:text-danger hover:bg-danger/10 transition flex items-center justify-center">
                                        <i data-lucide="x" class="w-4 h-4"></i>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Photo Counter -->
                        <div x-show="photos.length > 0" class="flex items-center justify-between mb-2 px-1">
                            <span class="text-xs font-bold text-muted">
                                📷 <span x-text="photos.length"></span>/5枚
                            </span>
                            <span x-show="photos.length >= 5" class="text-[10px] text-orange-400 font-bold"><?= __('post_page.max_photos', 'You reached the max number of photos') ?></span>
                        </div>

                        <!-- Preview Grid -->
                        <div class="grid grid-cols-2 gap-3" x-show="photos.length > 0">
                            <template x-for="(photo, index) in photos" :key="index">
                                <div class="relative aspect-square rounded-2xl overflow-hidden bg-surface shadow-md"
                                    :class="index === 0 ? 'ring-2 ring-primary ring-offset-2' : ''">
                                    <img :src="photo.preview" :alt="'観察写真 ' + (index + 1)" class="w-full h-full object-cover">
                                    <!-- Main photo badge -->
                                    <div x-show="index === 0" class="absolute bottom-1 left-1 bg-primary text-white text-[9px] font-black px-2 py-0.5 rounded-full z-20"><?= __('post_page.main_photo', 'Main') ?></div>
                                    <!-- Set as main (tap photo area) -->
                                    <button x-show="index !== 0" @click.prevent="setMainPhoto(index)"
                                        class="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] font-bold px-2 py-1 rounded-full z-20 hover:bg-primary transition min-h-[32px]" title="メイン写真にする">
                                        <i data-lucide="star" class="w-3 h-3 inline-block mr-0.5" style="pointer-events:none;"></i><?= __('post_page.set_main', 'Set as main') ?>
                                    </button>
                                    <!-- Move left -->
                                    <button x-show="index > 0 && photos.length > 1" @click.prevent="movePhoto(index, index - 1)"
                                        class="absolute bottom-1 right-12 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center bg-black/50 rounded-full hover:bg-white/30 transition z-20" title="左に移動">
                                        <i data-lucide="chevron-left" class="w-3.5 h-3.5 text-white" style="pointer-events:none;"></i>
                                    </button>
                                    <!-- Move right -->
                                    <button x-show="index < photos.length - 1 && photos.length > 1" @click.prevent="movePhoto(index, index + 1)"
                                        class="absolute bottom-1 right-1 p-2 min-w-[36px] min-h-[36px] flex items-center justify-center bg-black/50 rounded-full hover:bg-white/30 transition z-20" title="右に移動">
                                        <i data-lucide="chevron-right" class="w-3.5 h-3.5 text-white" style="pointer-events:none;"></i>
                                    </button>
                                    <button @click.prevent="savePhoto(photo, index)" class="absolute top-1 left-1 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center bg-black/50 rounded-full hover:bg-primary transition z-30 sm:hidden" title="端末に保存">
                                        <i data-lucide="download" class="w-4 h-4 text-white" style="pointer-events:none;"></i>
                                    </button>
                                    <button @click.prevent="removePhoto(index)" class="absolute top-1 right-1 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center bg-black/50 rounded-full hover:bg-danger transition z-30">
                                        <i data-lucide="x" class="w-4 h-4 text-white" style="pointer-events:none;"></i>
                                    </button>
                                </div>
                            </template>
                            <!-- Add More Buttons in Grid -->
                            <div class="aspect-square border-2 border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-2 text-faint bg-surface">
                                <button type="button" @click="$refs.cameraInput.click()" class="text-xs font-bold flex items-center gap-1 hover:text-primary transition px-2 py-2">
                                    <i data-lucide="camera" class="w-4 h-4"></i> <?= __('post_page.shoot', 'Shoot') ?>
                                </button>
                                <div class="w-full border-t border-border"></div>
                                <button type="button" @click="$refs.galleryInput.click()" class="text-xs font-bold flex items-center gap-1 hover:text-text transition px-2 py-2">
                                    <i data-lucide="image" class="w-4 h-4"></i> <?= __('post_page.select', 'Select') ?>
                                </button>
                            </div>
                        </div>
                        <div x-show="photos.length > 0 && !videoAsset && !videoUploading && !videoProcessing" class="mt-3">
                            <button type="button" @click="$refs.videoInput.click()" class="w-full rounded-2xl border border-border px-4 py-3 text-left bg-base/50 hover:bg-base transition">
                                <span class="flex items-center gap-2 text-sm font-bold text-text">
                                    <i data-lucide="video" class="w-4 h-4 text-primary"></i>
                                    ここに15秒動画も追加する
                                </span>
                                <span class="block mt-1 text-[11px] text-muted">写真に加えて、動きや鳴き声を証拠として残せる</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- AI提案カード (自動トリガー) -->
                <div x-show="photos.length > 0" x-transition class="mt-4">

                    <!-- Loading -->
                    <div x-show="AiAssist && AiAssist.loading" x-transition class="px-4 py-4 text-center" style="background:var(--md-surface-container);border-radius:var(--shape-xl);">
                        <div class="flex items-center justify-center gap-2">
                            <span class="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></span>
                            <span class="text-sm font-bold text-text"><?= __('post_page.ai_analyzing', 'AI is analyzing the photo...') ?></span>
                        </div>
                        <p class="text-[10px] text-muted mt-1"><?= __('post_page.ai_wait', 'Candidates will appear in a few seconds') ?></p>
                    </div>

                    <!-- 提案カード -->
                    <div x-show="aiSuggestions.length > 0 && !(AiAssist && AiAssist.loading)" x-transition>
                        <div class="flex items-center gap-2 mb-2 px-1">
                            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-primary"></i>
                            <span class="text-[10px] font-black text-faint uppercase tracking-widest"><?= __('post_page.ai_candidates', 'AI candidates') ?></span>
                            <span x-show="aiSelectedIndices.length > 0" class="text-[9px] font-bold bg-primary text-white px-2 py-0.5 rounded-full" x-text="'<?= addslashes(__('post_page.ai_selected', '{count} selected')) ?>'.replace('{count}', aiSelectedIndices.length)"></span>
                        </div>
                        <div class="space-y-2">
                            <template x-for="(sg, idx) in aiSuggestions" :key="idx">
                                <button type="button" @click="toggleAiSuggestion(idx)"
                                    class="w-full text-left px-4 py-3 rounded-2xl border-2 transition-all"
                                    :class="aiSelectedIndices.includes(idx)
                                        ? 'border-primary bg-primary/10 shadow-sm'
                                        : 'border-border bg-surface hover:border-primary/30'"
                                    style="cursor:pointer;">
                                    <div class="flex items-center gap-3">
                                        <span class="text-2xl flex-shrink-0" x-text="sg.emoji || '🔍'"></span>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex items-center gap-2">
                                                <span class="text-sm font-bold text-text" x-text="sg.label"></span>
                                                <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                                                    :class="AiAssist.confidenceColor(sg.confidence)"
                                                    x-text="AiAssist.confidenceLabel(sg.confidence)"></span>
                                            </div>
                                            <p class="text-[11px] text-muted mt-0.5 line-clamp-1" x-text="sg.reason"></p>
                                        </div>
                                        <div class="flex-shrink-0">
                                            <div x-show="aiSelectedIndices.includes(idx)" class="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                                                <i data-lucide="check" class="w-4 h-4 text-white" style="pointer-events:none;"></i>
                                            </div>
                                            <div x-show="!aiSelectedIndices.includes(idx)" class="w-6 h-6 border-2 border-border rounded-full"></div>
                                        </div>
                                    </div>
                                </button>
                            </template>
                        </div>
                        <p class="text-[10px] text-faint mt-2 px-1 text-center"><?= __('post_page.ai_tap_hint', 'Tap to select. Multiple choices are OK. You can also post without selecting anything.') ?></p>
                    </div>

                    <!-- エラー (非ブロッキング) -->
                    <div x-show="AiAssist && AiAssist.error && !AiAssist.loading && aiSuggestions.length === 0" x-transition
                        class="px-4 py-3 text-center" style="background:var(--md-surface-container);border-radius:var(--shape-xl);">
                        <p class="text-xs text-muted" x-text="AiAssist ? AiAssist.error : ''"></p>
                                <p class="text-[10px] text-faint mt-1"><?= __('post_page.ai_nonblocking', 'You can post as is') ?></p>
                    </div>

                    <!-- フォールバック -->
                    <div x-show="!AiAssist || (!AiAssist.loading && !AiAssist.error && aiSuggestions.length === 0 && !aiAutoTriggered)" x-transition
                        class="px-4 py-3 text-center" style="background:var(--md-surface-container);border-radius:var(--shape-xl);">
                        <p class="text-sm font-bold text-text flex items-center justify-center gap-2">
                            <i data-lucide="sparkles" class="w-4 h-4 text-primary"></i>
                                <?= __('post_page.ai_post_hint', 'Observation hints will be added automatically after posting') ?>
                        </p>
                        <p class="text-[10px] text-muted mt-1.5 leading-relaxed">
                            <?= __('post_page.ai_post_hint_body', 'It is fine to post as is for now.') ?>
                        </p>
                    </div>

                </div>
                <div x-show="photos.length > 0 || videoAsset || videoUploading || videoProcessing || (canSurveyorOfficialPost && record_mode === 'surveyor_official')" x-transition class="mt-4">
                    <button type="submit" :disabled="submitting || !canSubmit"
                        class="m3-btn-filled">
                        <i data-lucide="send" x-show="!submitting" class="w-5 h-5"></i>
                        <span x-show="!submitting">
                            <span x-text="record_mode === 'surveyor_official' ? '公式記録を残す' : '足跡を残す'"></span>
                            <span x-show="photos.length > 0" class="ml-1 text-sm opacity-80" x-text="'(' + photos.length + '枚)'"></span>
                            <span x-show="videoAsset" class="ml-1 text-sm opacity-80">(+動画)</span>
                        </span>
                        <span x-show="submitting" class="flex items-center gap-2"><span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>送信中...</span>
                    </button>
                </div>

                <!-- Form Fields (Slide In) -->
                <div class="space-y-6" x-show="canOpenForm" x-transition x-ref="formFields">

                    <!-- 📍 Location (Essential - always visible) -->
                    <div>
                        <div class="flex justify-between items-center mb-2 px-2">
                            <label class="block text-[10px] font-black text-faint uppercase tracking-widest"><?= __('post_page.location_label', 'Location') ?></label>
                            <button type="button" @click="loadHistory()" class="text-[10px] font-bold text-primary flex items-center gap-1">
                                <i data-lucide="history" class="w-3 h-3"></i>
                                <?= __('post_page.same_as_last', 'Same as last time') ?>
                            </button>
                        </div>
                        <!-- 📍 Address Search -->
                        <div class="relative mb-2">
                            <input type="text" x-model="addressQuery"
                                @input.debounce.500ms="searchAddress()"
                                @keydown.enter.prevent="searchAddress()"
                                @focus="showAddressSuggestions = addressResults.length > 0"
                                @keydown.escape="showAddressSuggestions = false"
                                placeholder="<?= __('post_page.address_placeholder', 'Search by address (e.g. Suruga Ward, Shizuoka City)') ?>"
                                autocomplete="off"
                                class="m3-input" style="padding-left:44px;">
                            <div class="absolute left-3 top-2.5 text-faint">
                                <i data-lucide="search" class="w-4 h-4"></i>
                            </div>
                            <!-- Address suggestions dropdown -->
                            <div x-show="showAddressSuggestions && addressResults.length > 0" x-transition
                                @click.away="showAddressSuggestions = false"
                                style="position:absolute;left:0;right:0;top:100%;margin-top:4px;background:var(--md-surface-container-high);border-radius:var(--shape-md);overflow:hidden;z-index:50;box-shadow:var(--elev-3);max-height:12rem;overflow-y:auto;">
                                <template x-for="(addr, i) in addressResults" :key="i">
                                    <button type="button" @click="selectAddress(addr)"
                                        class="w-full text-left px-4 py-3 flex items-center gap-2 transition" style="border:none;border-bottom:1px solid var(--md-outline-variant);background:transparent;cursor:pointer;font-size:var(--type-body-sm);color:var(--md-on-surface);"
                                        <i data-lucide="map-pin" class="w-3 h-3 text-primary shrink-0"></i>
                                        <span class="text-xs text-text" x-text="addr.display_name"></span>
                                    </button>
                                </template>
                            </div>
                        </div>
                        <div id="map" class="w-full h-48 rounded-2xl mb-3 bg-surface border border-border overflow-hidden relative z-0"></div>
                        <div class="flex items-center justify-between px-2">
                            <p class="text-[10px] text-muted flex items-center gap-1">
                                <!-- Location Source Badge -->
                                <template x-if="locationSource === 'exif'">
                                    <span class="inline-flex items-center gap-1 bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                                        <span class="animate-pulse">📷</span> <?= __('post_page.source_exif', 'From photo') ?>
                                    </span>
                                </template>
                                <template x-if="locationSource === 'gps'">
                                    <span class="inline-flex items-center gap-1">
                                        <i data-lucide="navigation" class="w-3 h-3 text-primary"></i> <?= __('post_page.source_gps', 'From GPS') ?>
                                    </span>
                                </template>
                                <template x-if="locationSource === 'manual'">
                                    <span class="inline-flex items-center gap-1">
                                        <i data-lucide="hand" class="w-3 h-3"></i> <?= __('post_page.source_manual', 'Set manually') ?>
                                    </span>
                                </template>
                                <template x-if="locationSource === 'default'">
                                    <span class="inline-flex items-center gap-1">
                                        <i data-lucide="map-pin" class="w-3 h-3"></i>
                                    </span>
                                </template>
                                <span x-text="locationName || '<?= addslashes(__('post_page.location_fallback', 'Tap the map or enter an address')) ?>'"></span>
                            </p>
                            <p x-show="gpsAccuracy" class="text-[10px] font-mono flex items-center gap-1"
                                :class="gpsAccuracy < 20 ? 'text-primary' : gpsAccuracy < 100 ? 'text-warning' : 'text-danger'">
                                <span class="w-1.5 h-1.5 rounded-full animate-pulse"
                                    :class="gpsAccuracy < 20 ? 'bg-primary' : gpsAccuracy < 100 ? 'bg-warning' : 'bg-danger'"></span>
                                ±<span x-text="Math.round(gpsAccuracy)"></span>m
                            </p>
                        </div>
                        <!-- Privacy info + granularity selector -->
                        <div class="mt-2 px-2">
                            <div class="flex items-center gap-2 text-[10px] text-faint mb-2">
                                <i data-lucide="shield" class="w-3 h-3 text-primary"></i>
                                <span><?= __('post_page.privacy_hint', 'Rare species are automatically rounded more coarsely.') ?> <a href="faq.php#privacy" class="text-primary underline"><?= __('post_page.learn_more', 'Learn more') ?></a></span>
                            </div>
                            <div class="flex items-center gap-2">
                                <label class="text-[10px] font-black text-faint uppercase tracking-widest leading-tight"><?= __('post_page.visibility_label', 'Visibility') ?></label>
                                <select x-model="locationGranularity" class="flex-1 text-xs font-bold bg-surface border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary appearance-none">
                                    <option value="exact"><?= __('post_page.visibility_exact', '📍 Detailed (default)') ?></option>
                                    <option value="municipality"><?= __('post_page.visibility_municipality', '🏘️ Municipality level') ?></option>
                                    <option value="prefecture"><?= __('post_page.visibility_prefecture', '🗾 Prefecture level') ?></option>
                                    <option value="hidden"><?= __('post_page.visibility_hidden', '🔒 Hide location') ?></option>
                                </select>
                            </div>
                            <p class="text-[9px] text-faint mt-1 px-0.5" x-show="locationGranularity === 'hidden'"><?= __('post_page.visibility_hidden_note', '📍 Only you and administrators can see the exact location.') ?></p>
                            <div class="mt-2 rounded-2xl bg-surface border border-border px-3 py-3 text-[10px] leading-relaxed text-muted space-y-1">
                                <p x-show="locationGranularity === 'exact'"><?= __('post_page.visibility_exact_body', 'Public detail: the public map and JSON-LD use a rounded position as the environmental layer. Only you and administrators can see the original precision.') ?></p>
                                <p x-show="locationGranularity === 'municipality'"><?= __('post_page.visibility_municipality_body', 'Public detail: shared at municipality level. This is the recommended setting for ordinary school and home use.') ?></p>
                                <p x-show="locationGranularity === 'prefecture'"><?= __('post_page.visibility_prefecture_body', 'Public detail: rounded to prefecture level to reduce exposure for rare or sensitive records.') ?></p>
                                <p x-show="locationGranularity === 'hidden'"><?= __('post_page.visibility_hidden_body', 'Public detail: do not show map coordinates; only the region name appears publicly. Useful for school posts or records near home.') ?></p>
                            </div>
                        </div>
                        <!-- Quick info: date auto-set -->
                        <div class="mt-2 px-2 flex items-center gap-2 text-[10px] text-faint">
                            <i data-lucide="clock" class="w-3 h-3"></i>
                            <span x-text="observed_at ? new Date(observed_at).toLocaleString('<?= addslashes($jsLocale) ?>', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : ''"></span>
                            <template x-if="locationSource === 'exif'">
                                <span class="text-primary font-bold"><?= __('post_page.auto_from_photo', '📷 Auto set from photo') ?></span>
                            </template>
                            <template x-if="locationSource !== 'exif'">
                                <span class="text-primary"><?= __('post_page.auto_set', '✓ Auto set') ?></span>
                            </template>
                        </div>
                        <!-- Date discrepancy warning -->
                        <div x-show="dateWarningVisible" x-transition:enter="transition ease-out duration-300"
                            x-transition:enter-start="opacity-0 transform -translate-y-1"
                            x-transition:enter-end="opacity-100 transform translate-y-0"
                            x-transition:leave="transition ease-in duration-200"
                            x-transition:leave-start="opacity-100"
                            x-transition:leave-end="opacity-0"
                            class="mt-2 px-2">
                            <div class="flex items-center gap-2 px-3 py-2" style="background:var(--md-tertiary-container);border-radius:var(--shape-sm);">
                                <span class="text-base">⏰</span>
                                <span x-text="dateWarning" class="text-[11px] text-amber-700 font-medium"></span>
                            </div>
                        </div>


                    </div>

                    <!-- Quick Context Inputs -->
                    <div class="space-y-4">
                        <div class="px-4 py-3" style="background:var(--md-primary-container);border-radius:var(--shape-xl);">
                            <p class="text-sm font-bold text-text flex items-center gap-2">
                                <i data-lucide="sparkles" class="w-4 h-4 text-primary"></i>
                                <?= __('post_page.context_card_title', 'Context and condition can be auto-filled, then edited later.') ?>
                            </p>
                            <p class="text-[10px] text-muted mt-1.5 leading-relaxed">
                                <?= __('post_page.context_card_body', 'Items chosen automatically get an auto-selected badge. If they are wrong, you can fix them after posting, and others may also suggest edits.') ?>
                            </p>
                        </div>

                        <div>
                            <div class="flex items-center gap-2 mb-2 px-2">
                                <label class="block text-[10px] font-black text-faint uppercase tracking-widest"><?= __('post_page.biome_label', 'Environment') ?></label>
                                <span x-show="biomeAutoSelected" class="text-[9px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold"><?= __('post_page.auto_selected', 'Auto selected') ?></span>
                            </div>
                            <div class="relative">
                                <select x-model="biome" @change="biomeAutoSelected = false; biomeAutoReason = ''" class="m3-input" style="font-weight:600;">
                                    <option value="unknown"><?= __('post_page.biome_unknown', 'Unknown / not sure') ?></option>
                                    <option value="forest"><?= __('post_page.biome_forest', '🌲 Forest') ?></option>
                                    <option value="grassland"><?= __('post_page.biome_grassland', '🍃 Grassland / riverside') ?></option>
                                    <option value="wetland"><?= __('post_page.biome_wetland', '💧 Wetland / waterside') ?></option>
                                    <option value="coastal"><?= __('post_page.biome_coastal', '🌊 Coast / tidal flat') ?></option>
                                    <option value="urban"><?= __('post_page.biome_urban', '🏢 City / park') ?></option>
                                    <option value="farmland"><?= __('post_page.biome_farmland', '🌾 Farmland / satoyama') ?></option>
                                </select>
                                <div class="absolute right-4 top-3.5 text-muted pointer-events-none">
                                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                </div>
                            </div>
                            <p class="text-[10px] text-faint px-2 mt-1.5" x-show="biomeAutoSelected && biomeAutoReason" x-text="'✨ ' + biomeAutoReason + '<?= addslashes(__('post_page.biome_auto_suffix', '. You can still fix it after posting, and other people can suggest edits too.')) ?>'"></p>
                        </div>

                        <div>
                            <div class="flex items-center gap-2 mb-2 px-2">
                                <label class="block text-[10px] font-black text-faint uppercase tracking-widest"><?= __('post_page.count_label', 'Count') ?></label>
                                <span class="text-[9px] text-faint bg-surface px-2 py-0.5 rounded-full"><?= __('post_page.count_optional', 'Optional / approximate') ?></span>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <template x-for="opt in [
                                    {value: 1, label: '1'},
                                    {value: 3, label: '2〜5'},
                                    {value: 8, label: '6〜10'},
                                    {value: 30, label: '11〜50'},
                                    {value: 51, label: '50+'}
                                ]">
                                    <button type="button" @click="individual_count = (individual_count === opt.value) ? null : opt.value"
                                        class="m3-chip"
                                        :class="individual_count === opt.value ? 'selected' : ''">
                                        <span x-text="opt.label"></span>
                                    </button>
                                </template>
                            </div>
                            <p class="text-[10px] text-faint px-2 mt-1.5"><?= __('post_page.count_note', '📊 It does not need to be exact. You can leave an approximate value that others can correct later.') ?></p>
                        </div>
                    </div>

                    <!-- Optional Details (Collapsible) -->
                    <div class="mt-4">

                        <!-- GPS Conflict Modal -->
                        <template x-if="gpsConflict && gpsConflictData">
                            <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm"
                                x-transition:enter="transition ease-out duration-200"
                                x-transition:enter-start="opacity-0"
                                x-transition:enter-end="opacity-100">
                                <div style="background:var(--md-surface-container-high);border-radius:var(--shape-xl) var(--shape-xl) 0 0;width:100%;max-width:28rem;box-shadow:var(--elev-4);padding:1.5rem 1.5rem 2rem;gap:1rem;display:flex;flex-direction:column;"
                                    @click.outside="usePhotoLocation()">
                                    <div class="flex justify-center">
                                        <div style="width:2.5rem;height:4px;background:var(--md-outline-variant);border-radius:var(--shape-full);"></div>
                                    </div>
                                    <div class="text-center">
                                        <div class="text-3xl mb-2">🗺️</div>
                                        <h3 class="text-base font-bold text-text"><?= __('post_page.gps_conflict_title', 'The photo location and your current location are far apart.') ?></h3>
                                        <p class="text-xs text-muted mt-1">
                                            <?= __('post_page.gps_conflict_distance_prefix', 'About') ?> <span x-text="gpsConflictData.distance >= 1000 ? (gpsConflictData.distance / 1000).toFixed(1) + 'km' : gpsConflictData.distance + 'm'" class="font-bold text-primary"></span> <?= __('post_page.gps_conflict_distance_suffix', 'apart') ?>
                                        </p>
                                    </div>
                                    <div class="space-y-3">
                                        <button type="button" @click="usePhotoLocation()" class="m3-btn-filled" style="border-radius:var(--shape-full);">
                                            <span style="pointer-events:none;">📷</span> <?= __('post_page.use_photo_location', 'Use photo location (photo GPS)') ?>
                                        </button>
                                        <button type="button" @click="useDeviceLocation()" class="m3-btn-tonal" style="border-radius:var(--shape-full);">
                                            <span>📍</span> <?= __('post_page.use_device_location', 'Use current location (device GPS)') ?>
                                        </button>
                                    </div>
                                    <p class="text-center text-[10px] text-muted"><?= __('post_page.gps_conflict_note', 'You can also tap the map later to change it.') ?></p>
                                </div>
                            </div>
                        </template>
                        <button type="button" @click="showDetails = !showDetails; if(showDetails && window.ikimonAnalytics) ikimonAnalytics.track('form_expand')"
                            class="m3-btn-tonal" style="border-radius:var(--shape-full);padding:14px 24px;"
                        >
                            <i data-lucide="chevron-down" class="w-4 h-4 transition-transform" :class="showDetails ? 'rotate-180' : ''"></i>
                            <span x-text="showDetails ? '<?= addslashes(__('post_page.close_details', 'Close')) ?>' : '<?= addslashes(__('post_page.open_details', 'Add name and details (optional)')) ?>'"></span>
                        </button>

                        <div x-show="showDetails" x-transition class="space-y-6 mt-6">
                            <!-- Date (auto-set, editable here) -->
                            <div>
                                <label class="block text-[10px] font-black text-faint uppercase tracking-widest mb-2 px-2"><?= __('post_page.observed_at_label', 'Observed at') ?></label>
                                <input type="datetime-local" x-model="observed_at" class="m3-input" style="font-weight:600;">
                                <p class="text-[10px] text-faint px-2 mt-1"><?= __('post_page.observed_at_note', '※ Photos are set automatically from EXIF when available.') ?></p>
                            </div>

                            <!-- Name Selection -->
                            <div class="relative">
                                <div class="flex justify-between items-center mb-2 px-2">
                                    <label class="block text-[10px] font-black text-faint uppercase tracking-widest"><?= __('post_page.name_label', 'Name (if known)') ?></label>
                                </div>
                                <div class="relative">
                                    <input type="text" x-model="taxon_name" @input.debounce.300ms="searchTaxon()" @focus="showSuggestions = suggestions.length > 0" @keydown.escape="showSuggestions = false" placeholder="<?= __('post_page.name_placeholder', 'Enter common or scientific name...') ?>" autocomplete="off" class="w-full bg-surface border border-border rounded-2xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition text-text font-bold pl-11">
                                    <div class="absolute left-4 top-3.5 text-faint">
                                        <i data-lucide="search" class="w-4 h-4"></i>
                                    </div>
                                    <!-- Selected slug badge + thumbnail -->
                                    <div x-show="taxon_slug" class="absolute right-3 top-1.5 flex items-center gap-1.5">
<img x-show="taxon_thumbnail" :src="taxon_thumbnail" :alt="taxon_name ? taxon_name + '<?= addslashes(__('post_page.thumbnail_suffix', ' thumbnail')) ?>' : '<?= addslashes(__('post_page.species_thumbnail', 'Species thumbnail')) ?>'" class="w-7 h-7 rounded-full object-cover border border-primary/30">
                                        <span class="text-[10px] font-bold bg-primary-surface text-primary px-2 py-1 rounded-full">✓ <?= __('post_page.name_confirmed', 'Confirmed') ?></span>
                                    </div>
                                </div>
                                <!-- Autocomplete Dropdown -->
                                <div x-show="showSuggestions && suggestions.length > 0" x-transition @click.away="showSuggestions = false" class="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-2xl overflow-hidden z-50 shadow-xl max-h-60 overflow-y-auto">
                                    <template x-for="(s, i) in suggestions" :key="i">
                                        <button type="button" @click="selectTaxon(s)" class="w-full text-left px-3 py-2.5 hover:bg-white/5 transition border-b border-border last:border-b-0 flex items-center gap-3">
                                            <!-- Thumbnail -->
                                            <div class="flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden bg-surface-alt border border-border">
                                                <template x-if="s.thumbnail_url">
                                                <img :src="s.thumbnail_url" :alt="s.jp_name || s.sci_name || '<?= addslashes(__('post_page.species_thumbnail', 'Species thumbnail')) ?>'" class="w-full h-full object-cover" loading="lazy">
                                                </template>
                                                <template x-if="!s.thumbnail_url">
                                                    <div class="w-full h-full flex items-center justify-center text-faint">
                                                        <i data-lucide="leaf" class="w-4 h-4"></i>
                                                    </div>
                                                </template>
                                            </div>
                                            <!-- Name + meta -->
                                            <div class="flex-1 min-w-0">
                                                <div class="flex items-center gap-1.5">
                                                    <span class="text-sm font-bold text-text truncate" x-text="s.jp_name || s.sci_name"></span>
                                                    <span x-show="s.rank && s.rank !== 'species'" class="text-[9px] font-bold text-warning bg-warning/10 px-1.5 py-0.5 rounded-full" x-text="s.rank"></span>
                                                </div>
                                                <div class="flex items-center gap-1.5 mt-0.5">
                                                    <span class="text-[11px] text-faint italic truncate" x-text="s.sci_name"></span>
                                                    <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                                                        :class="s.source === 'local' ? 'bg-primary/10 text-primary' : s.source === 'inat' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'"
                                                        x-text="s.source === 'local' ? '<?= addslashes(__('post_page.source_local', 'Local')) ?>' : s.source === 'inat' ? 'iNat' : s.source === 'gbif' ? 'GBIF' : ''"></span>
                                                </div>
                                            </div>
                                            <i data-lucide="chevron-right" class="w-4 h-4 text-faint flex-shrink-0"></i>
                                        </button>
                                    </template>
                                        <p class="text-[10px] text-faint px-2 mt-1.5"><?= __('post_page.name_help', '✨ You can post even if you do not know the name. Someone may help later.') ?></p>
                                </div>

                                <!-- Soft Validation Alarms (Ecological Constraints) -->
                                <div x-show="validating || validationWarnings.length > 0" x-transition class="mt-2" style="display: none;">
                                    <!-- Loading state -->
                                    <div x-show="validating" class="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-xl">
                                        <i data-lucide="loader-2" class="w-3.5 h-3.5 text-muted animate-spin"></i>
                                        <span class="text-[10px] text-muted font-bold"><?= __('post_page.validation_loading', 'Validating ecological data with AI...') ?></span>
                                    </div>
                                    <!-- Warnings -->
                                    <template x-if="validationWarnings.length > 0">
                                        <div class="space-y-1.5">
                                            <template x-for="warning in validationWarnings">
                                                <div class="flex gap-2.5 items-start p-3 bg-warning/10 border border-warning/30 rounded-xl relative overflow-hidden">
                                                    <div class="absolute top-0 left-0 w-1 h-full bg-warning"></div>
                                                    <i data-lucide="alert-triangle" class="w-4 h-4 text-warning flex-shrink-0 mt-0.5"></i>
                                                    <div>
                                                        <div class="text-[10px] font-black text-warning tracking-wider uppercase mb-0.5" x-text="warning.type === 'season' ? 'Season check' : warning.type === 'habitat' ? 'Habitat check' : warning.type === 'altitude' ? 'Elevation check' : 'Ecology check'"></div>
                                                        <div class="text-[11px] text-warning-dark font-medium leading-relaxed" x-text="warning.message"></div>
                                                    </div>
                                                </div>
                                            </template>
                                        </div>
                                    </template>
                                </div>

                                <!-- Evidence UI (Morphological/Ecological Traits) -->
                                <div x-show="taxon_name.trim().length > 0" x-transition.duration.300ms class="bg-primary/5 border border-primary/20 rounded-2xl p-4 mt-2">
                                    <div class="flex items-center gap-2 mb-3">
                                        <label class="block text-[11px] font-black text-primary uppercase tracking-widest"><?= __('post_page.evidence_label', 'Identification evidence') ?></label>
                                        <span class="text-[9px] text-white bg-primary px-2 py-0.5 rounded-full font-bold"><?= __('post_page.required', 'Required') ?></span>
                                    </div>
                                    <p class="text-[10px] text-muted mb-3 leading-relaxed">
                                        <?= __('post_page.evidence_body', 'To improve data quality, choose the features that helped you identify it.') ?>
                                    </p>
                                    <div class="space-y-3">
                                        <!-- Morphological Traits -->
                                        <div>
                                            <div class="text-[10px] font-bold text-faint mb-1.5 flex items-center gap-1"><i data-lucide="eye" class="w-3 h-3"></i> <?= __('post_page.morphology_title', 'Morphological traits') ?></div>
                                            <div class="flex flex-wrap gap-2">
                                                <template x-for="trait in [
                                                {id: 'color_pattern', label: '<?= addslashes(__('post_page.evidence_color_pattern', 'Color / pattern')) ?>', emoji: '🎨'},
                                                {id: 'shape', label: '<?= addslashes(__('post_page.evidence_shape', 'Overall shape')) ?>', emoji: '📐'},
                                                {id: 'size', label: '<?= addslashes(__('post_page.evidence_size', 'Size')) ?>', emoji: '📏'},
                                                {id: 'specific_part', label: '<?= addslashes(__('post_page.evidence_specific_part', 'Specific part (wings, leaves, etc.)')) ?>', emoji: '🔍'}
                                            ]">
                                                    <button type="button" @click="toggleEvidence(trait.id)"
                                                        class="px-3 py-2 rounded-xl border transition text-xs font-bold flex items-center gap-1.5"
                                                        :class="evidence_tags.includes(trait.id) ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20' : 'bg-surface border-border text-muted hover:border-primary/30'">
                                                        <span x-text="trait.emoji"></span>
                                                        <span x-text="trait.label"></span>
                                                    </button>
                                                </template>
                                            </div>
                                        </div>
                                        <!-- Ecological Traits -->
                                        <div>
                                            <div class="text-[10px] font-bold text-faint mb-1.5 flex items-center gap-1"><i data-lucide="footprints" class="w-3 h-3"></i> <?= __('post_page.evidence_ecology_title', 'Ecological traits / others') ?></div>
                                            <div class="flex flex-wrap gap-2">
                                                <template x-for="trait in [
                                                {id: 'behavior', label: '<?= addslashes(__('post_page.evidence_behavior', 'Behavior / call')) ?>', emoji: '🎵'},
                                                {id: 'habitat', label: '<?= addslashes(__('post_page.evidence_habitat', 'Habitat')) ?>', emoji: '🏞️'},
                                                {id: 'host_plant', label: '<?= addslashes(__('post_page.evidence_host_plant', 'Host plant')) ?>', emoji: '🌿'},
                                                {id: 'expert_id', label: '<?= addslashes(__('post_page.evidence_expert_id', 'Expert / field guide')) ?>', emoji: '📖'},
                                                {id: 'intuition', label: '<?= addslashes(__('post_page.evidence_intuition', 'Gut feeling / AI-assisted')) ?>', emoji: '🤖'}
                                            ]">
                                                    <button type="button" @click="toggleEvidence(trait.id)"
                                                        class="px-3 py-2 rounded-xl border transition text-xs font-bold flex items-center gap-1.5"
                                                        :class="evidence_tags.includes(trait.id) ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20' : 'bg-surface border-border text-muted hover:border-primary/30'">
                                                        <span x-text="trait.emoji"></span>
                                                        <span x-text="trait.label"></span>
                                                    </button>
                                                </template>
                                            </div>
                                        </div>
                                    </div>
                                    <div x-show="taxon_name.trim().length > 0 && evidence_tags.length === 0" class="mt-3 text-[10px] font-bold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg flex items-center gap-1">
                                        <i data-lucide="info" class="w-3 h-3"></i> <?= __('post_page.evidence_tip', 'Pick at least one. If unsure, “gut feeling / AI-assisted” is fine.') ?>
                                    </div>
                                </div>
                                <!-- Status (野生/植栽) -->
                                <div>
                                    <label class="block text-[10px] font-black text-faint uppercase tracking-widest mb-2 px-2"><?= __('post_page.state_label', 'Condition') ?> <span class="text-primary normal-case"><?= __('post_page.state_default_wild', 'Default: wild') ?></span></label>
                                    <div class="grid grid-cols-2 gap-2">
                                        <label class="cursor-pointer">
                                            <input type="radio" value="wild" x-model="cultivation" class="hidden peer">
                                            <div class="text-center py-3 rounded-2xl border border-border bg-surface peer-checked:bg-primary peer-checked:text-white peer-checked:border-primary transition text-xs font-bold text-muted">
                                                <i data-lucide="trees" class="w-4 h-4 mx-auto mb-1"></i>
                                                <?= __('post_page.state_wild', 'Wild') ?>
                                            </div>
                                        </label>
                                        <label class="cursor-pointer">
                                            <input type="radio" value="cultivated" x-model="cultivation" class="hidden peer">
                                            <div class="text-center py-3 rounded-2xl border border-border bg-surface peer-checked:bg-secondary peer-checked:text-white peer-checked:border-secondary transition text-xs font-bold text-muted">
                                                <i data-lucide="flower-2" class="w-4 h-4 mx-auto mb-1"></i>
                                                <?= __('post_page.state_cultivated', 'Cultivated / captive') ?>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <div class="flex items-center gap-2 mb-2 px-2">
                                        <label class="block text-[10px] font-black text-faint uppercase tracking-widest"><?= __('post_page.origin_label', 'Origin') ?></label>
                                        <span class="text-[9px] text-faint bg-surface px-2 py-0.5 rounded-full"><?= __('post_page.origin_note', 'Wild individuals can exist even inside facilities.') ?></span>
                                    </div>
                                    <div class="grid grid-cols-2 gap-2">
                                        <template x-for="opt in [
                                            {value: 'wild', label: '<?= addslashes(__('post_page.origin_wild', 'Wild')) ?>', icon: 'trees', tone: 'primary'},
                                            {value: 'cultivated', label: '<?= addslashes(__('post_page.origin_cultivated', 'Cultivated')) ?>', icon: 'flower-2', tone: 'secondary'},
                                            {value: 'captive', label: '<?= addslashes(__('post_page.origin_captive', 'Captive')) ?>', icon: 'fence', tone: 'secondary'},
                                            {value: 'released', label: '<?= addslashes(__('post_page.origin_released', 'Released')) ?>', icon: 'bird', tone: 'warning'},
                                            {value: 'escaped', label: '<?= addslashes(__('post_page.origin_escaped', 'Escaped')) ?>', icon: 'move-up-right', tone: 'warning'},
                                            {value: 'naturalized', label: '<?= addslashes(__('post_page.origin_naturalized', 'Naturalized')) ?>', icon: 'sprout', tone: 'primary'},
                                            {value: 'uncertain', label: '<?= addslashes(__('post_page.origin_uncertain', 'Uncertain')) ?>', icon: 'help-circle', tone: 'muted'}
                                        ]">
                                            <label class="cursor-pointer">
                                                <input type="radio" :value="opt.value" x-model="organism_origin" class="hidden peer">
                                                <div class="text-center py-3 rounded-2xl border border-border bg-surface transition text-xs font-bold text-muted peer-checked:text-white"
                                                    :class="{
                                                        'peer-checked:bg-primary peer-checked:border-primary': opt.tone === 'primary',
                                                        'peer-checked:bg-secondary peer-checked:border-secondary': opt.tone === 'secondary',
                                                        'peer-checked:bg-warning peer-checked:border-warning': opt.tone === 'warning',
                                                        'peer-checked:bg-muted peer-checked:border-muted': opt.tone === 'muted'
                                                    }">
                                                    <i :data-lucide="opt.icon" class="w-4 h-4 mx-auto mb-1"></i>
                                                    <span x-text="opt.label"></span>
                                                </div>
                                            </label>
                                        </template>
                                    </div>
                                    <p class="text-[10px] text-faint px-2 mt-1.5"><?= __('post_page.origin_help', '🌿 You can separate wild weeds in botanical gardens from cultivated / captive display specimens.') ?></p>
                                </div>

                                <div>
                                    <div class="flex items-center gap-2 mb-2 px-2">
                                        <label class="block text-[10px] font-black text-faint uppercase tracking-widest"><?= __('post_page.facility_label', 'Facility context') ?></label>
                                        <span class="text-[9px] text-faint bg-surface px-2 py-0.5 rounded-full"><?= __('post_page.facility_badge', 'For historical context 100 years from now') ?></span>
                                    </div>
                                    <div class="relative">
                                        <select x-model="managed_context_type" class="w-full bg-surface border border-border rounded-2xl px-4 py-3 text-xs font-bold text-text focus:outline-none focus:border-primary appearance-none">
                                            <option value=""><?= __('post_page.facility_none', 'No facility / ordinary field observation') ?></option>
                                            <option value="botanical_garden"><?= __('post_page.facility_botanical_garden', '🌺 Botanical garden') ?></option>
                                            <option value="zoo"><?= __('post_page.facility_zoo', '🦁 Zoo') ?></option>
                                            <option value="aquarium"><?= __('post_page.facility_aquarium', '🐟 Aquarium') ?></option>
                                            <option value="aviary"><?= __('post_page.facility_aviary', '🕊️ Aviary / bird garden') ?></option>
                                            <option value="conservation_center"><?= __('post_page.facility_conservation_center', '🧬 Conservation center / captive breeding') ?></option>
                                            <option value="park_planting"><?= __('post_page.facility_park_planting', '🌳 Park planting') ?></option>
                                            <option value="school_biotope"><?= __('post_page.facility_school_biotope', '🏫 School biotope') ?></option>
                                            <option value="private_collection"><?= __('post_page.facility_private_collection', '🏠 Private collection') ?></option>
                                            <option value="other"><?= __('post_page.facility_other', '🏷️ Other') ?></option>
                                        </select>
                                        <div class="absolute right-4 top-3.5 text-muted pointer-events-none">
                                            <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                        </div>
                                    </div>
                                    <div class="mt-2 space-y-2" x-show="managed_context_type" x-transition>
                                        <input type="text" x-model="managed_site_name"
                                            placeholder="<?= __('post_page.facility_name_placeholder', 'Facility name (e.g. Hamamatsu City Zoo, XYZ Botanical Garden)') ?>"
                                            class="w-full bg-surface border border-border rounded-2xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition text-sm text-text">
                                        <textarea x-model="managed_context_note"
                                placeholder="<?= __('post_page.facility_note_placeholder', 'Add notes such as greenhouse, enclosure, or planting area if needed') ?>"
                                            class="w-full bg-surface border border-border rounded-2xl px-4 py-3 h-20 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition text-text placeholder-faint font-medium"></textarea>
                                    </div>
                                </div>

                                <!-- 🪨 Substrate/Terrain Tags (100-Year Archive Fusion) -->
                                <div>
                                    <div class="flex items-center gap-2 mb-2 px-2">
                                        <label class="block text-[10px] font-black text-faint uppercase tracking-widest"><?= __('post_page.substrate_label', 'Ground condition') ?></label>
                                        <span class="text-[9px] text-faint bg-surface px-2 py-0.5 rounded-full"><?= __('post_page.substrate_badge', 'Optional / multiple select') ?></span>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <template x-for="tag in [
                                        {id: 'rock', label: '<?= addslashes(__('post_page.substrate_rock', 'Rocky area')) ?>', emoji: '🪨'},
                                        {id: 'sand', label: '<?= addslashes(__('post_page.substrate_sand', 'Sand')) ?>', emoji: '🏖️'},
                                        {id: 'gravel', label: '<?= addslashes(__('post_page.substrate_gravel', 'Gravel')) ?>', emoji: '🫘'},
                                        {id: 'grass', label: '<?= addslashes(__('post_page.substrate_grass', 'Grassland')) ?>', emoji: '🌿'},
                                        {id: 'leaf_litter', label: '<?= addslashes(__('post_page.substrate_leaf_litter', 'Leaf litter')) ?>', emoji: '🍂'},
                                        {id: 'deadwood', label: '<?= addslashes(__('post_page.substrate_deadwood', 'Deadwood / fallen logs')) ?>', emoji: '🪵'},
                                        {id: 'water', label: '<?= addslashes(__('post_page.substrate_water', 'Waterside')) ?>', emoji: '💧'},
                                        {id: 'artificial', label: '<?= addslashes(__('post_page.substrate_artificial', 'Artificial surface')) ?>', emoji: '🏗️'}
                                    ]">
                                            <button type="button" @click="toggleSubstrate(tag.id)"
                                                class="px-3 py-2 rounded-xl border transition text-xs font-bold flex items-center gap-1.5"
                                                :class="substrate_tags.includes(tag.id) ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20' : 'border-border bg-surface text-muted hover:border-primary/30'">
                                                <span x-text="tag.emoji"></span>
                                                <span x-text="tag.label"></span>
                                            </button>
                                        </template>
                                    </div>
                                    <p class="text-[10px] text-faint px-2 mt-1.5"><?= __('post_page.substrate_note', '🌍 Recording ground conditions creates data that can track environmental change 100 years from now.') ?></p>
                                </div>

                                <!-- Satellite Mismatch -->
                                <div>
                                    <div class="flex items-center gap-2 mb-2 px-2">
                                        <label class="block text-[10px] font-black text-faint uppercase tracking-widest"><?= __('post_page.mismatch_label', 'Satellite vs reality') ?></label>
                                        <span class="text-[9px] text-faint bg-surface px-2 py-0.5 rounded-full"><?= __('post_page.optional', 'Optional') ?></span>
                                    </div>
                                    <textarea x-model="mismatch" rows="2"
                                        class="w-full rounded-xl border border-border bg-surface text-sm px-3 py-2 text-body placeholder:text-faint resize-none focus:outline-none focus:ring-1 focus:ring-primary/40"
                                        placeholder="<?= __('post_page.mismatch_placeholder', 'e.g. Predicted open water, but found dense reed bed') ?>"></textarea>
                                    <p class="text-[10px] text-faint px-2 mt-1"><?= __('post_page.mismatch_note', '🛰️ Disagreements between satellite predictions and field reality are valuable scientific data.') ?></p>
                                </div>

                                <!-- Life Stage -->
                                <div>
                                    <div class="flex items-center gap-2 mb-2 px-2">
                                        <label class="block text-[10px] font-black text-faint uppercase tracking-widest"><?= __('post_page.life_stage_label', 'Life stage') ?></label>
                                        <span class="text-[9px] text-faint bg-surface px-2 py-0.5 rounded-full"><?= __('post_page.optional', 'Optional') ?></span>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <template x-for="stage in [
                                        {id: 'adult', label: '<?= addslashes(__('post_page.life_stage_adult', 'Adult')) ?>', sub: '<?= addslashes(__('post_page.life_stage_adult_sub', 'Imago, fish, mammal, etc.')) ?>', icon: 'crown'},
                                        {id: 'juvenile', label: '<?= addslashes(__('post_page.life_stage_juvenile', 'Juvenile')) ?>', sub: '<?= addslashes(__('post_page.life_stage_juvenile_sub', 'Larva, fry, seedling')) ?>', icon: 'sprout'},
                                        {id: 'egg', label: '<?= addslashes(__('post_page.life_stage_egg', 'Egg / seed')) ?>', sub: '<?= addslashes(__('post_page.life_stage_egg_sub', 'Also egg masses and spores')) ?>', icon: 'circle-dot'},
                                        {id: 'trace', label: '<?= addslashes(__('post_page.life_stage_trace', 'Trace')) ?>', sub: '<?= addslashes(__('post_page.life_stage_trace_sub', 'Tracks, droppings, nests, molts')) ?>', icon: 'footprints'}
                                    ]">
                                            <label class="cursor-pointer">
                                                <input type="radio" :value="stage.id" x-model="life_stage" class="hidden peer">
                                                <div class="px-3 py-2 rounded-xl border border-border bg-surface peer-checked:bg-primary peer-checked:text-white peer-checked:border-primary transition text-muted flex flex-col items-center gap-0.5 min-w-[72px]">
                                                    <i :data-lucide="stage.icon" class="w-4 h-4"></i>
                                                    <span class="text-xs font-bold" x-text="stage.label"></span>
                                                    <span class="text-[8px] opacity-60" x-text="stage.sub"></span>
                                                </div>
                                            </label>
                                        </template>
                                        <label class="cursor-pointer">
                                            <input type="radio" value="unknown" x-model="life_stage" class="hidden peer">
                                            <div class="px-3 py-2 rounded-xl border border-border bg-surface peer-checked:bg-muted peer-checked:text-white peer-checked:border-muted transition text-xs font-bold text-faint flex flex-col items-center gap-0.5 min-w-[72px]">
                                                <i data-lucide="help-circle" class="w-4 h-4"></i>
                                                <?= __('post_page.life_stage_unknown', 'Unknown') ?>
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <!-- Note -->
                                <div>
                                    <label class="block text-[10px] font-black text-faint uppercase tracking-widest mb-2 px-2"><?= __('post_page.note_label', 'Notes') ?></label>
                                    <textarea x-model="note" placeholder="<?= __('post_page.note_placeholder', 'Record actions, surroundings, and what you noticed...') ?>" class="w-full bg-surface border border-border rounded-2xl px-4 py-3 h-24 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition text-text placeholder-faint font-medium"></textarea>
                                </div>

                                <!-- CC License Selector -->
                                <div>
                                    <div class="flex items-center gap-2 mb-2 px-2">
                                        <label class="block text-[10px] font-black text-faint uppercase tracking-widest"><?= __('post_page.license_label', 'License') ?></label>
                                        <span class="text-[9px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold"><?= __('post_page.license_badge', 'Recommended: CC BY') ?></span>
                                    </div>
                                    <div class="space-y-2">
                                        <label class="cursor-pointer block">
                                            <input type="radio" value="CC-BY" x-model="license" class="hidden peer">
                                            <div class="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-surface peer-checked:bg-primary/10 peer-checked:border-primary/40 transition">
                                                <span class="text-lg">🌍</span>
                                                <div class="flex-1">
                                                    <span class="text-xs font-bold text-text"><?= __('post_page.license_cc_by_title', 'CC BY (Attribution)') ?></span>
                                                    <span class="block text-[10px] text-muted"><?= __('post_page.license_cc_by_body', 'Anyone can use it with credit. Shared with GBIF ✓') ?></span>
                                                </div>
                                                <div class="w-4 h-4 rounded-full border-2 border-border peer-checked:border-primary flex items-center justify-center">
                                                    <div class="w-2 h-2 rounded-full" :class="license === 'CC-BY' ? 'bg-primary' : ''"></div>
                                                </div>
                                            </div>
                                        </label>
                                        <label class="cursor-pointer block">
                                            <input type="radio" value="CC0" x-model="license" class="hidden peer">
                                            <div class="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-surface peer-checked:bg-primary/10 peer-checked:border-primary/40 transition">
                                                <span class="text-lg">🔓</span>
                                                <div class="flex-1">
                                                    <span class="text-xs font-bold text-text"><?= __('post_page.license_cc0_title', 'CC0 (Public Domain)') ?></span>
                                                    <span class="block text-[10px] text-muted"><?= __('post_page.license_cc0_body', 'No restrictions. Most open. Shared with GBIF ✓') ?></span>
                                                </div>
                                                <div class="w-4 h-4 rounded-full border-2 border-border flex items-center justify-center">
                                                    <div class="w-2 h-2 rounded-full" :class="license === 'CC0' ? 'bg-primary' : ''"></div>
                                                </div>
                                            </div>
                                        </label>
                                        <label class="cursor-pointer block">
                                            <input type="radio" value="CC-BY-NC" x-model="license" class="hidden peer">
                                            <div class="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-surface peer-checked:bg-secondary/10 peer-checked:border-secondary/40 transition">
                                                <span class="text-lg">🔒</span>
                                                <div class="flex-1">
                                                    <span class="text-xs font-bold text-text"><?= __('post_page.license_cc_by_nc_title', 'CC BY-NC (Attribution-NonCommercial)') ?></span>
                                                    <span class="block text-[10px] text-muted"><?= __('post_page.license_cc_by_nc_body', 'No commercial use. Not shared with GBIF') ?></span>
                                                </div>
                                                <div class="w-4 h-4 rounded-full border-2 border-border flex items-center justify-center">
                                                    <div class="w-2 h-2 rounded-full" :class="license === 'CC-BY-NC' ? 'bg-secondary' : ''"></div>
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                    <p class="text-[10px] text-faint px-2 mt-1.5">
                                        <?= __('post_page.license_note', '💡 Choose CC BY and your record can help research around the world.') ?>
                                        <a href="faq.php#e1" class="text-primary underline"><?= __('post_page.license_faq', 'See FAQ for details') ?></a>
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Navigator Component -->

            </form>
        </main>

        <!-- Fixed Bottom Action Bar -->
        <div x-show="canOpenForm" x-transition class="fixed bottom-0 left-0 w-full md:max-w-md md:left-[50%] md:translate-x-[-50%] p-4 bg-gradient-to-t from-base via-base to-transparent z-40 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <button @click="submit" :disabled="submitting || !canSubmit"
                class="w-full py-4 rounded-full bg-gradient-to-r from-primary to-accent text-white font-black shadow-lg shadow-primary/20 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:shadow-none active:scale-95">
                <i data-lucide="send" x-show="!submitting" class="w-5 h-5"></i>
                <span x-show="!submitting">
                    <span x-text="record_mode === 'surveyor_official' ? '<?= addslashes(__('post_page.submit_official', 'Save official record')) ?>' : '<?= addslashes(__('post_page.submit_standard', 'Leave a record')) ?>'"></span>
                    <span x-show="photos.length > 0" class="ml-1 text-sm opacity-80" x-text="'(' + photos.length + '<?= addslashes(__('post_page.photo_count_suffix', ' photos')) ?>)'"></span>
                </span>
                <span x-show="submitting" class="flex items-center gap-2"><span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span><?= __('post_page.submitting', 'Sending...') ?></span>
            </button>
        </div>

        <!-- Fullscreen Loading Overlay -->
        <div x-show="submitting" x-transition.opacity
            class="fixed inset-0 z-[100] bg-base/90 backdrop-blur-xl flex flex-col items-center justify-center">

            <div x-show="!success" class="text-center w-full max-w-sm px-6">
                <div class="relative w-24 h-24 mx-auto mb-8">
                    <div class="absolute inset-0 border-4 border-surface rounded-full"></div>
                    <div class="absolute inset-0 border-4 border-primary rounded-full border-t-transparent animate-spin"></div>
                </div>
                <!-- Progress Bar -->
                <div class="w-full bg-surface rounded-full h-2 overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-primary to-secondary transition-all duration-300" :style="'width: ' + progress + '%'"></div>
                </div>
            </div>

            <div x-show="success" class="text-center" x-transition:enter="transition ease-out duration-500" x-transition:enter-start="opacity-0 scale-90" x-transition:enter-end="opacity-100 scale-100">
                <!-- Confetti burst -->
                <div class="relative">
                    <div class="absolute inset-0 flex justify-center items-center pointer-events-none">
                        <span class="text-4xl animate-ping" style="animation-duration:2s;animation-iteration-count:1;">🎉</span>
                    </div>
                    <div class="w-24 h-24 mx-auto mb-4 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center shadow-lg shadow-primary/30 animate-bounce" style="animation-duration: 1s; animation-iteration-count: 2;">
                        <i data-lucide="check" class="w-12 h-12 text-white"></i>
                    </div>
                </div>
                <h3 class="text-2xl font-black text-text mb-1"><?= __('post_page.success_title', 'Recorded!') ?> 🐾</h3>
                <p class="text-sm text-muted mb-2"><?= __('post_page.success_body', 'Your observation left a mark on this place’s ecological map.') ?></p>
                <p class="text-[11px] text-faint mb-4" x-show="!aiReady && !aiPending"><?= __('post_page.success_hint_later', 'Observation hints will be added to the detail view. If narrowing down is hard, corrections and additional identifications from others are easier to come in later.') ?></p>
                <div x-show="aiPending" class="bg-surface border border-border rounded-2xl p-4 mb-4 max-w-sm mx-auto">
                    <p class="text-sm font-bold text-text mb-1">🪄 <?= __('post_page.success_hint_pending_title', 'Preparing observation hints') ?></p>
                    <p class="text-xs text-muted leading-relaxed"><?= __('post_page.success_hint_pending_body', 'Your post is already complete. Genus- or family-level hints often appear within seconds.') ?></p>
                </div>
                <div x-show="aiReady" class="bg-primary-surface border border-primary-glow rounded-2xl p-4 mb-4 max-w-sm mx-auto">
                    <p class="text-sm text-primary font-bold mb-1">✨ <?= __('post_page.success_hint_ready', 'Observation hints are ready too') ?></p>
                    <p class="text-xs text-primary/80 leading-relaxed" x-text="aiSummary || '<?= addslashes(__('post_page.success_detail_fallback', 'Open the observation detail to review the clues visible right now.')) ?>'"></p>
                </div>

                <!-- Phase 15B P1: 外来種アラート -->
                <template x-if="invasiveAlert">
                    <div class="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 mb-4 max-w-sm mx-auto text-left">
                        <div class="flex items-start gap-3">
                            <div class="shrink-0 mt-0.5">
                                <template x-if="invasiveAlert.risk_level === 'High' || invasiveAlert.risk_level === 'Critical'">
                                    <span class="text-2xl">⚠️</span>
                                </template>
                                <template x-if="invasiveAlert.risk_level === 'Medium'">
                                    <span class="text-2xl">🔶</span>
                                </template>
                                <template x-if="invasiveAlert.risk_level === 'Low'">
                                    <span class="text-2xl">ℹ️</span>
                                </template>
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="text-xs font-black text-amber-800 uppercase tracking-widest mb-1" x-text="invasiveAlert.category"></p>
                                <p class="text-sm font-black text-amber-900">
                                    <span x-text="invasiveAlert.name"></span>
                                    <span class="text-xs font-normal text-amber-700 ml-1" x-text="'(' + invasiveAlert.scientific_name + ')'"></span>
                                </p>
                                <p class="text-xs text-amber-800 leading-relaxed mt-1" x-text="invasiveAlert.description"></p>
                                <div class="mt-2 rounded-xl bg-amber-100 px-3 py-2">
                                    <p class="text-xs font-bold text-amber-900">📋 <span x-text="invasiveAlert.action"></span></p>
                                </div>
                                <p class="text-[10px] text-amber-600 mt-2 leading-relaxed"><?= __('post_page.invasive_thanks', 'Recording sightings helps ecosystem conservation. Thank you for reporting it.') ?></p>
                            </div>
                        </div>
                    </div>
                </template>

                <div class="rounded-2xl border border-border bg-surface p-4 mb-6 max-w-sm mx-auto text-left">
                    <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-2" x-text="successGuidance.sectionTitle"></p>
                    <p class="text-xs text-muted leading-relaxed mb-3" x-text="successGuidance.sectionBody"></p>
                    <div class="space-y-3">
                        <template x-for="(card, index) in successGuidance.cards" :key="index">
                            <div class="rounded-2xl bg-surface-container-low border border-border px-3 py-3">
                                <div class="flex items-start gap-2">
                                    <span class="text-lg leading-none" x-text="card.icon"></span>
                                    <div class="min-w-0">
                                        <p class="text-[10px] font-black text-faint uppercase tracking-widest" x-text="card.title"></p>
                                        <p class="mt-1 text-xs text-text leading-relaxed" x-text="card.body"></p>
                                        <p x-show="card.note" class="mt-2 text-[11px] text-muted leading-relaxed" x-text="card.note"></p>
                                    </div>
                                </div>
                            </div>
                        </template>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                        <span class="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary"><?= __('post_page.tag_revision', 'Corrections welcome') ?></span>
                        <span class="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-[11px] font-bold text-sky-700"><?= __('post_page.tag_append', 'You can add more later') ?></span>
                        <span x-show="!taxon_slug" class="inline-flex items-center rounded-full bg-warning/10 px-3 py-1 text-[11px] font-bold text-warning"><?= __('post_page.tag_name_growing', 'The name can still grow') ?></span>
                        <span x-show="taxon_slug" class="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700"><?= __('post_page.tag_name_base', 'The current name can be a starting point') ?></span>
                    </div>
                </div>

                <div class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 mb-6 max-w-sm mx-auto text-left">
                    <p class="text-[10px] font-black text-emerald-700 uppercase tracking-widest mb-2" x-text="successRevisit.title"></p>
                    <p class="text-xs text-emerald-900 leading-relaxed" x-text="successRevisit.body"></p>
                    <p class="mt-2 text-[11px] text-emerald-800/80 leading-relaxed" x-text="successRevisit.note"></p>
                    <div class="mt-3 flex flex-wrap gap-2">
                        <button @click="continueAtSamePlace()" class="inline-flex items-center justify-center rounded-full bg-emerald-700 px-4 py-2 text-xs font-bold text-white transition hover:bg-emerald-600">
                            🌿 <?= __('post_page.revisit_record_cta', 'Record one more from this place') ?>
                        </button>
                        <a :href="successRevisit.collectionHref" class="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-bold text-emerald-800 transition hover:bg-emerald-100">
                            <span x-text="successRevisit.collectionLabel"></span>
                        </a>
                    </div>
                </div>

                <div class="space-y-3 max-w-xs mx-auto">
                    <a :href="'observation_detail.php?id=' + lastObservationId"
                        class="block w-full py-4 rounded-full bg-gradient-to-r from-primary to-accent text-white font-black text-center shadow-lg shadow-primary/20 active:scale-95 transition flex items-center justify-center gap-2">
                        <i data-lucide="eye" class="w-5 h-5"></i>
                        <?= __('post_page.view_detail', 'View observation details') ?>
                    </a>
                    <a x-show="taxon_slug" :href="'species/' + encodeURIComponent(taxon_slug)"
                        class="block w-full py-3 rounded-full bg-surface border border-border text-text font-bold text-center text-sm hover:bg-white/5 transition flex items-center justify-center gap-2">
                        📖 <span x-text="'<?= addslashes(__('post_page.view_species', 'View the guide for {name}')) ?>'.replace('{name}', taxon_name)"></span>
                    </a>
                    <a x-show="!taxon_slug" href="id_center.php"
                        class="block w-full py-3 rounded-full bg-surface border border-primary/30 text-primary font-bold text-sm text-center hover:bg-primary-surface/20 transition flex items-center justify-center gap-2 active:scale-95">
                        <i data-lucide="search" class="w-4 h-4"></i>
                        <?= __('post_page.ask_name', 'Ask others for the name') ?>
                    </a>
                    <button @click="resetForm()" class="w-full py-3 rounded-full bg-secondary-surface border border-secondary/20 text-secondary font-bold text-sm hover:bg-secondary-surface/80 transition flex items-center justify-center gap-2 active:scale-95">
                        📸 <?= __('post_page.record_another', 'Record another one') ?>
                    </button>
                    <?php if ($returnUrl): ?>
                        <a href="<?php echo $returnUrl; ?>" class="block w-full py-3 rounded-full bg-surface border border-primary/30 text-primary font-bold text-sm text-center hover:bg-primary-surface/20 transition flex items-center justify-center gap-2 active:scale-95">
                            🗺️ <?= __('post_page.return_fieldwork', 'Back to fieldwork') ?>
                        </a>
                    <?php endif; ?>
                    <a href="index.php" class="block text-sm text-faint hover:text-text transition py-2 text-center">
                        🏠 <?= __('post_page.return_home', 'Back to home') ?>
                    </a>
                </div>
            </div>
        </div>

        <!-- Login: 未ログイン時は login.php へリダイレクト -->

    </div>

    <!-- Post Uploader: PHP動的値注入 + 外部JS -->
    <script nonce="<?= CspNonce::attr() ?>">
        window.__POST_CONFIG = {
            isLoggedIn: <?php echo $isLoggedIn ? 'true' : 'false'; ?>,
            isGuest: <?php echo $isGuest ? 'true' : 'false'; ?>,
            guestPostCount: <?php echo $guestPostCount; ?>,
            guestPostLimit: <?php echo Auth::GUEST_POST_LIMIT; ?>,
            csrfToken: '<?php echo $csrfToken; ?>',
            survey_id: '<?php echo $activeSurvey ? $activeSurvey['id'] : ''; ?>',
            canSurveyorOfficialPost: <?php echo $canSurveyorOfficialPost ? 'true' : 'false'; ?>,
            successGuidance: {
                sectionTitle: '<?= addslashes(__('post_page.learning_section_title', 'Turn this record into learning')) ?>',
                sectionBody: '<?= addslashes(__('post_page.learning_section_body', 'The point is not perfect certainty at once. It is to leave a trace you can revisit, improve, and feed back into the next person’s learning loop.')) ?>',
                progressTitle: '<?= addslashes(__('post_page.learning_progress_title', 'Why this already counts as progress')) ?>',
                progressBodyDefault: '<?= addslashes(__('post_page.learning_progress_body_default', 'Saving a dated record with place already creates something you can revisit later.')) ?>',
                progressBodySpecies: '<?= addslashes(__('post_page.learning_progress_body_species', 'If the current name already reaches species, treat it as a strong working start only while the evidence stays aligned.')) ?>',
                progressBodyCoarse: '<?= addslashes(__('post_page.learning_progress_body_coarse', 'If the current name stops at genus or family, that is not failure. It means the record is staying honest about the evidence.')) ?>',
                retakeTitle: '<?= addslashes(__('post_page.learning_retake_title', 'What to add next time')) ?>',
                retakeBodySingle: '<?= addslashes(__('post_page.learning_retake_body_single', 'Next time, one closer photo and one wider place shot will make the next narrowing much easier.')) ?>',
                retakeBodyMulti: '<?= addslashes(__('post_page.learning_retake_body_multi', 'You already have multiple photos. The next gain is a decisive angle or a place clue that rules out similar taxa.')) ?>',
                contributionTitle: '<?= addslashes(__('post_page.learning_contribution_title', 'How this helps beyond you')) ?>',
                contributionBodyDefault: '<?= addslashes(__('post_page.learning_contribution_body_default', 'This first saved trace gives later identifications and corrections a real place to start from.')) ?>',
                contributionBodyNamed: '<?= addslashes(__('post_page.learning_contribution_body_named', 'Because this record already carries a name hypothesis, later reviews can focus on checking and refining instead of starting from zero.')) ?>',
                contributionNote: '<?= addslashes(__('post_page.learning_contribution_note', 'As records become clearer, they also become better guidance for the next person and stronger learning signal for future ikimon AI.')) ?>',
                revisitTitle: '<?= addslashes(__('post_page.revisit_title', 'Keep this place moving')) ?>',
                revisitBodyDefault: '<?= addslashes(__('post_page.revisit_body_default', 'A second dated record from the same place makes later comparison much easier.')) ?>',
                revisitBodyLoggedIn: '<?= addslashes(__('post_page.revisit_body_logged_in', 'Leave one more record here, then review the flow later in My places.')) ?>',
                revisitBodyGuest: '<?= addslashes(__('post_page.revisit_body_guest', 'Leave one more record here or look at nearby records first. Even two traces from the same place already make change easier to see.')) ?>',
                revisitNote: '<?= addslashes(__('post_page.revisit_note', 'Your current location is kept when you start another record from here.')) ?>',
                revisitCollectionProfile: '<?= addslashes(__('post_page.revisit_collection_profile', 'Review in My places')) ?>',
                revisitCollectionExplore: '<?= addslashes(__('post_page.revisit_collection_explore', 'See nearby records')) ?>'
            }
        };
    </script>
    <script src="<?= htmlspecialchars(Asset::versioned('/js/exif-mini.js')) ?>"></script>
    <script src="<?= htmlspecialchars(Asset::versioned('/js/ai-assist.js')) ?>"></script>
    <script src="<?= htmlspecialchars(Asset::versioned('/js/post-uploader.js')) ?>"></script>
    <script nonce="<?= CspNonce::attr() ?>">
        lucide.createIcons();
    </script>
    <!-- Level Up Modal -->
    <div x-data="gamificationModal"
        x-show="show"
        style="display: none;"
        class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        role="dialog" aria-modal="true" aria-labelledby="gamification-title">

        <div class="bg-surface border border-primary/30 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl shadow-primary/20 relative overflow-hidden"
            x-show="show"
            x-transition:enter="transition ease-out duration-500"
            x-transition:enter-start="opacity-0 scale-50 rotate-12"
            x-transition:enter-end="opacity-100 scale-100 rotate-0"
            x-transition:leave="transition ease-in duration-200"
            x-transition:leave-start="opacity-100 scale-100"
            x-transition:leave-end="opacity-0 scale-90">

            <!-- Confetti/Background Effect -->
            <div class="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none"></div>

            <!-- Icon -->
            <div class="relative mb-6">
                <div class="w-24 h-24 mx-auto rounded-full bg-surface-alt flex items-center justify-center border-4 border-surface shadow-xl animate-bounce">
                    <i :data-lucide="icon" class="w-12 h-12" :class="colorClass"></i>
                </div>
            </div>

            <!-- Title -->
            <h2 id="gamification-title" class="text-3xl font-black italic tracking-tighter mb-2" :class="colorClass" x-text="title"></h2>

            <!-- Message -->
            <div class="bg-surface-alt rounded-2xl p-4 mb-8 border border-white/5">
                <p class="text-sm font-bold text-text" x-text="message"></p>
                <!-- Badge Image if available -->
                <template x-if="currentEvent && currentEvent.type === 'badge_earned' && currentEvent.badge.image_url">
                        <img :src="currentEvent.badge.image_url" :alt="currentEvent.badge.name ? currentEvent.badge.name + '<?= addslashes(__('post_page.gamification_badge_suffix', ' badge')) ?>' : '<?= addslashes(__('post_page.gamification_badge_fallback', 'Badge')) ?>'" class="w-20 h-20 mx-auto mt-3 object-contain drop-shadow-md">
                </template>
                <!-- Quest Reward -->
                <template x-if="currentEvent && currentEvent.type === 'quest_complete'">
                    <div class="mt-2 text-warning font-black text-xl flex items-center justify-center gap-1">
                        <i data-lucide="coins" class="w-5 h-5"></i>
                        <span x-text="'+' + currentEvent.reward"></span>
                    </div>
                </template>
            </div>

            <!-- Button -->
            <button @click="next()" class="w-full py-4 rounded-full bg-gradient-to-r from-primary to-accent text-white font-black shadow-lg shadow-primary/30 active:scale-95 transition hover:scale-105">
                        <span x-text="currentIndex < events.length - 1 ? '<?= addslashes(__('post_page.gamification_next', 'Next reward!')) ?>' : '<?= addslashes(__('post_page.gamification_close', 'Awesome! Close')) ?>'"></span>
            </button>
        </div>
    </div>
</body>

</html>
