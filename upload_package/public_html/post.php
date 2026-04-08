<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CSRF.php';
require_once __DIR__ . '/../libs/SurveyManager.php';
require_once __DIR__ . '/../libs/Asset.php';
require_once __DIR__ . '/../libs/SurveyorManager.php';

// Guest Access Allowed — ゲストは3件まで投稿可能
Auth::init();
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
<html lang="ja">

<head>
    <?php
    $meta_title = "投稿する — ikimon.life";
    $meta_description = "生き物を撮って投稿。GPS自動取得、写真からの日時・位置情報の自動抽出で、最短3タップで観察記録を残せます。";
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
            <a href="javascript:history.length > 1 ? history.back() : location.href='index.php'" aria-label="戻る" class="p-3 -ml-3 text-muted hover:text-text transition">
                <i data-lucide="x" class="w-6 h-6"></i>
            </a>
            <h1 class="text-sm font-black tracking-widest uppercase text-text">記録する</h1>
            <div class="w-10"></div>
        </header>

        <!-- オフラインバナー -->
        <div x-data="{ offline: !navigator.onLine }" @online.window="offline = false" @offline.window="offline = true"
            x-show="offline" x-transition
            class="fixed top-14 left-0 w-full md:max-w-md md:left-[50%] md:translate-x-[-50%] z-40 px-4 py-2 flex items-center gap-2" style="background:var(--md-error-container);border-bottom:1px solid var(--md-outline-variant);">
            <i data-lucide="wifi-off" class="w-3.5 h-3.5 text-danger"></i>
            <span class="text-xs font-bold text-danger">オフライン — 入力は端末に保存され、通信回復後に自動送信されます</span>
        </div>

        <!-- ゲストモードバナー -->
        <template x-if="isGuest">
            <div class="fixed top-14 left-0 w-full md:max-w-md md:left-[50%] md:translate-x-[-50%] z-40 px-4 py-2 flex items-center justify-between" style="background:var(--md-tertiary-container);border-bottom:1px solid var(--md-outline-variant);">
                <span class="text-xs text-accent font-bold flex items-center gap-1">
                    <i data-lucide="user" class="w-3 h-3"></i>
                    ゲスト投稿 <span x-text="guestPostCount"></span>/<span x-text="guestPostLimit"></span>件
                </span>
                <a href="login.php?redirect=post.php" class="text-[10px] font-bold text-primary bg-elevated px-3 py-1 rounded-full border border-primary/20 hover:bg-primary-surface transition">
                    🔑 ログインして無制限に
                </a>
            </div>
        </template>

        <main :class="isGuest ? 'pt-28 pb-32 px-4' : 'pt-20 pb-32 px-4'">

            <!-- 観察会連携バナー -->
            <template x-if="event_id">
                <div class="mb-4 flex items-center gap-3 px-4 py-3" style="background:var(--md-primary-container);border-radius:var(--shape-xl);">
                    <span class="text-2xl">📋</span>
                    <div class="flex-1 min-w-0">
                        <p class="text-xs font-bold text-primary truncate" x-text="event_name"></p>
                        <p class="text-[10px] text-primary/60">この観察会に記録が紐づけられます</p>
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
                            <p class="text-sm font-black text-sky-900">調査員モードが有効です</p>
                            <p class="text-xs text-sky-900/70 mt-1 leading-relaxed">
                                写真つきの通常記録に加えて、現地確認だけで公式記録を残せます。写真がない場合は、種名とメモをできるだけ具体的に残してください。
                            </p>
                            <div class="mt-3 flex flex-wrap gap-2">
                                <button type="button" @click="record_mode = 'standard'" class="px-3 py-2 rounded-xl text-xs font-bold border transition"
                                    :class="record_mode === 'standard' ? 'bg-primary text-white border-primary' : 'bg-white text-text border-sky-200'">
                                    通常記録
                                </button>
                                <button type="button" @click="record_mode = 'surveyor_official'" class="px-3 py-2 rounded-xl text-xs font-bold border transition"
                                    :class="record_mode === 'surveyor_official' ? 'bg-sky-600 text-white border-sky-600' : 'bg-white text-sky-800 border-sky-200'">
                                    調査員公式記録
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

                    <div class="border-2 border-dashed border-border rounded-3xl p-6 text-center transition bg-surface hover:bg-white/5">
                        <div x-show="photos.length === 0">
                            <i data-lucide="camera" class="w-10 h-10 mx-auto mb-3 text-primary"></i>
                            <p class="text-sm font-bold mb-1 text-text" x-text="record_mode === 'surveyor_official' ? '写真がなくても公式記録を残せます' : '生き物を撮影・選択'"></p>
                            <p class="text-xs text-muted mb-2" x-text="record_mode === 'surveyor_official' ? '📋 現地確認のみならこのまま下のフォームへ。写真があれば付けると再利用しやすくなります' : '📸 撮るだけでOK！名前は後からでも大丈夫'"></p>
                            <p x-show="record_mode !== 'surveyor_official'" class="text-[10px] text-faint mb-4">🌱 スズメもタンポポも、ふだんの記録が地域の生態系データの基盤になります</p>
                            <div class="flex flex-col gap-3">
                                <button type="button" @click="$refs.cameraInput.click()" class="m3-btn-filled" style="padding:20px 24px;border-radius:var(--shape-xl);justify-content:flex-start;">
                                    <i data-lucide="camera" class="w-6 h-6" style="pointer-events:none;flex-shrink:0;"></i>
                                    <div style="text-align:left;">
                                        <span style="display:block;">📸 写真を撮る</span>
                                        <span style="display:block;font-size:var(--type-body-sm);font-weight:400;opacity:0.8;">カメラロールにも保存されます</span>
                                    </div>
                                </button>
                                <button type="button" @click="$refs.galleryInput.click()" class="m3-btn-tonal" style="padding:18px 24px;border-radius:var(--shape-xl);justify-content:flex-start;">
                                    <i data-lucide="image" class="w-6 h-6" style="pointer-events:none;flex-shrink:0;"></i>
                                    <div style="text-align:left;">
                                        <span style="display:block;">🖼️ ギャラリーから選ぶ</span>
                                        <span style="display:block;font-size:var(--type-body-sm);font-weight:400;opacity:0.7;">保存済みの写真をアップロード</span>
                                    </div>
                                </button>
                                <template x-if="record_mode === 'surveyor_official'">
                                    <button type="button" @click="ensureFormReady()" class="m3-btn-tonal" style="padding:18px 24px;border-radius:var(--shape-xl);justify-content:flex-start;">
                                        <i data-lucide="clipboard-check" class="w-6 h-6" style="pointer-events:none;flex-shrink:0;"></i>
                                        <div style="text-align:left;">
                                            <span style="display:block;">📝 写真なしで公式記録する</span>
                                            <span style="display:block;font-size:var(--type-body-sm);font-weight:400;opacity:0.7;">位置・日時・種名・メモを残します</span>
                                        </div>
                                    </button>
                                </template>
                                <template x-if="record_mode !== 'surveyor_official'">
                                    <button type="button" @click="lightMode = true; ensureFormReady(); showDetails = true" class="w-full text-center py-2 text-xs font-bold text-faint hover:text-primary transition">
                                        <i data-lucide="pen-line" class="w-3 h-3 inline-block mr-1" style="pointer-events:none;"></i>
                                        写真なしでメモだけ残す
                                    </button>
                                </template>
                            </div>
                        </div>

                        <!-- Photo Counter -->
                        <div x-show="photos.length > 0" class="flex items-center justify-between mb-2 px-1">
                            <span class="text-xs font-bold text-muted">
                                📷 <span x-text="photos.length"></span>/5枚
                            </span>
                            <span x-show="photos.length >= 5" class="text-[10px] text-orange-400 font-bold">最大枚数です</span>
                        </div>

                        <!-- Preview Grid -->
                        <div class="grid grid-cols-2 gap-3" x-show="photos.length > 0">
                            <template x-for="(photo, index) in photos" :key="index">
                                <div class="relative aspect-square rounded-2xl overflow-hidden bg-surface shadow-md"
                                    :class="index === 0 ? 'ring-2 ring-primary ring-offset-2' : ''">
                                    <img :src="photo.preview" :alt="'観察写真 ' + (index + 1)" class="w-full h-full object-cover">
                                    <!-- Main photo badge -->
                                    <div x-show="index === 0" class="absolute bottom-1 left-1 bg-primary text-white text-[9px] font-black px-2 py-0.5 rounded-full z-20">メイン</div>
                                    <!-- Set as main (tap photo area) -->
                                    <button x-show="index !== 0" @click.prevent="setMainPhoto(index)"
                                        class="absolute bottom-1 left-1 bg-black/50 text-white text-[9px] font-bold px-2 py-1 rounded-full z-20 hover:bg-primary transition min-h-[32px]" title="メイン写真にする">
                                        <i data-lucide="star" class="w-3 h-3 inline-block mr-0.5" style="pointer-events:none;"></i>メインにする
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
                                    <i data-lucide="camera" class="w-4 h-4"></i> 撮影
                                </button>
                                <div class="w-full border-t border-border"></div>
                                <button type="button" @click="$refs.galleryInput.click()" class="text-xs font-bold flex items-center gap-1 hover:text-text transition px-2 py-2">
                                    <i data-lucide="image" class="w-4 h-4"></i> 選択
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- AI提案カード (自動トリガー) -->
                <div x-show="photos.length > 0" x-transition class="mt-4">

                    <!-- Loading -->
                    <div x-show="AiAssist && AiAssist.loading" x-transition class="px-4 py-4 text-center" style="background:var(--md-surface-container);border-radius:var(--shape-xl);">
                        <div class="flex items-center justify-center gap-2">
                            <span class="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></span>
                            <span class="text-sm font-bold text-text">AI が写真を分析中...</span>
                        </div>
                        <p class="text-[10px] text-muted mt-1">数秒で候補が表示されます</p>
                    </div>

                    <!-- 提案カード -->
                    <div x-show="aiSuggestions.length > 0 && !(AiAssist && AiAssist.loading)" x-transition>
                        <div class="flex items-center gap-2 mb-2 px-1">
                            <i data-lucide="sparkles" class="w-3.5 h-3.5 text-primary"></i>
                            <span class="text-[10px] font-black text-faint uppercase tracking-widest">AI候補</span>
                            <span x-show="aiSelectedIndices.length > 0" class="text-[9px] font-bold bg-primary text-white px-2 py-0.5 rounded-full" x-text="aiSelectedIndices.length + '件選択中'"></span>
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
                        <p class="text-[10px] text-faint mt-2 px-1 text-center">タップで選択・複数OK。選ばずに投稿してもOK</p>
                    </div>

                    <!-- エラー (非ブロッキング) -->
                    <div x-show="AiAssist && AiAssist.error && !AiAssist.loading && aiSuggestions.length === 0" x-transition
                        class="px-4 py-3 text-center" style="background:var(--md-surface-container);border-radius:var(--shape-xl);">
                        <p class="text-xs text-muted" x-text="AiAssist ? AiAssist.error : ''"></p>
                        <p class="text-[10px] text-faint mt-1">そのまま投稿できます</p>
                    </div>

                    <!-- フォールバック -->
                    <div x-show="!AiAssist || (!AiAssist.loading && !AiAssist.error && aiSuggestions.length === 0 && !aiAutoTriggered)" x-transition
                        class="px-4 py-3 text-center" style="background:var(--md-surface-container);border-radius:var(--shape-xl);">
                        <p class="text-sm font-bold text-text flex items-center justify-center gap-2">
                            <i data-lucide="sparkles" class="w-4 h-4 text-primary"></i>
                            投稿後に観察のヒントが自動で追加されます
                        </p>
                        <p class="text-[10px] text-muted mt-1.5 leading-relaxed">
                            いまはそのまま投稿してOKです。
                        </p>
                    </div>

                </div>
                <div x-show="photos.length > 0 || (canSurveyorOfficialPost && record_mode === 'surveyor_official')" x-transition class="mt-4">
                    <button type="submit" :disabled="submitting || !canSubmit"
                        class="m3-btn-filled"
                        <i data-lucide="send" x-show="!submitting" class="w-5 h-5"></i>
                        <span x-show="!submitting">
                            <span x-text="record_mode === 'surveyor_official' ? '公式記録を残す' : '足跡を残す'"></span>
                            <span x-show="photos.length > 0" class="ml-1 text-sm opacity-80" x-text="'(' + photos.length + '枚)'"></span>
                        </span>
                        <span x-show="submitting" class="flex items-center gap-2"><span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>送信中...</span>
                    </button>
                </div>

                <!-- Form Fields (Slide In) -->
                <div class="space-y-6" x-show="canOpenForm" x-transition x-ref="formFields">

                    <!-- 📍 Location (Essential - always visible) -->
                    <div>
                        <div class="flex justify-between items-center mb-2 px-2">
                            <label class="block text-[10px] font-black text-faint uppercase tracking-widest">場所</label>
                            <button type="button" @click="loadHistory()" class="text-[10px] font-bold text-primary flex items-center gap-1">
                                <i data-lucide="history" class="w-3 h-3"></i>
                                前回と同じ
                            </button>
                        </div>
                        <!-- 📍 Address Search -->
                        <div class="relative mb-2">
                            <input type="text" x-model="addressQuery"
                                @input.debounce.500ms="searchAddress()"
                                @keydown.enter.prevent="searchAddress()"
                                @focus="showAddressSuggestions = addressResults.length > 0"
                                @keydown.escape="showAddressSuggestions = false"
                                placeholder="住所で検索（例: 静岡市駿河区）"
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
                                        <span class="animate-pulse">📷</span> 写真から取得
                                    </span>
                                </template>
                                <template x-if="locationSource === 'gps'">
                                    <span class="inline-flex items-center gap-1">
                                        <i data-lucide="navigation" class="w-3 h-3 text-primary"></i> GPSから取得
                                    </span>
                                </template>
                                <template x-if="locationSource === 'manual'">
                                    <span class="inline-flex items-center gap-1">
                                        <i data-lucide="hand" class="w-3 h-3"></i> 手動で設定
                                    </span>
                                </template>
                                <template x-if="locationSource === 'default'">
                                    <span class="inline-flex items-center gap-1">
                                        <i data-lucide="map-pin" class="w-3 h-3"></i>
                                    </span>
                                </template>
                                <span x-text="locationName || '地図をタップ or 住所を入力'"></span>
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
                                <span>希少種は自動でさらに粗くなります <a href="faq.php#privacy" class="text-primary underline">詳しく</a></span>
                            </div>
                            <div class="flex items-center gap-2">
                                <label class="text-[10px] font-black text-faint uppercase tracking-widest whitespace-nowrap">公開範囲</label>
                                <select x-model="locationGranularity" class="flex-1 text-xs font-bold bg-surface border border-border rounded-xl px-3 py-2 focus:outline-none focus:border-primary appearance-none">
                                    <option value="exact">📍 詳細（デフォルト）</option>
                                    <option value="municipality">🏘️ 市区町村レベル</option>
                                    <option value="prefecture">🗾 都道府県レベル</option>
                                    <option value="hidden">🔒 位置を非公開</option>
                                </select>
                            </div>
                            <p class="text-[9px] text-faint mt-1 px-0.5" x-show="locationGranularity === 'hidden'">📍 正確な位置はあなたと管理者だけが見られます</p>
                        </div>
                        <!-- Quick info: date auto-set -->
                        <div class="mt-2 px-2 flex items-center gap-2 text-[10px] text-faint">
                            <i data-lucide="clock" class="w-3 h-3"></i>
                            <span x-text="observed_at ? new Date(observed_at).toLocaleString('ja-JP', {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'}) : ''"></span>
                            <template x-if="locationSource === 'exif'">
                                <span class="text-primary font-bold">📷 写真から自動設定</span>
                            </template>
                            <template x-if="locationSource !== 'exif'">
                                <span class="text-primary">✓ 自動設定</span>
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
                                環境や状態は、自動で入りつつあとから直せます
                            </p>
                            <p class="text-[10px] text-muted mt-1.5 leading-relaxed">
                                自動で選ばれた項目には「自動選択」がつきます。違っていたら投稿後に直せますし、ほかの人から提案が入ることもあります。
                            </p>
                        </div>

                        <div>
                            <div class="flex items-center gap-2 mb-2 px-2">
                                <label class="block text-[10px] font-black text-faint uppercase tracking-widest">環境</label>
                                <span x-show="biomeAutoSelected" class="text-[9px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold">自動選択</span>
                            </div>
                            <div class="relative">
                                <select x-model="biome" @change="biomeAutoSelected = false; biomeAutoReason = ''" class="m3-input" style="font-weight:600;">
                                    <option value="unknown">不明 / わからない</option>
                                    <option value="forest">🌲 森林 (Forest)</option>
                                    <option value="grassland">🍃 草地・河川敷 (Grassland)</option>
                                    <option value="wetland">💧 湿地・水辺 (Wetland)</option>
                                    <option value="coastal">🌊 海岸・干潟 (Coastal)</option>
                                    <option value="urban">🏢 都市・公園 (Urban)</option>
                                    <option value="farmland">🌾 農地・里山 (Farmland)</option>
                                </select>
                                <div class="absolute right-4 top-3.5 text-muted pointer-events-none">
                                    <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                </div>
                            </div>
                            <p class="text-[10px] text-faint px-2 mt-1.5" x-show="biomeAutoSelected && biomeAutoReason" x-text="'✨ ' + biomeAutoReason + '。投稿後でも直せるし、ほかの人から提案も入ります'"></p>
                        </div>

                        <div>
                            <div class="flex items-center gap-2 mb-2 px-2">
                                <label class="block text-[10px] font-black text-faint uppercase tracking-widest">個体数</label>
                                <span class="text-[9px] text-faint bg-surface px-2 py-0.5 rounded-full">任意・参考値</span>
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
                            <p class="text-[10px] text-faint px-2 mt-1.5">📊 正確でなくてOK。あとで他の人が訂正しやすい参考値として残せます</p>
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
                                        <h3 class="text-base font-bold text-text">撮影場所と現在地が離れています</h3>
                                        <p class="text-xs text-muted mt-1">
                                            約 <span x-text="gpsConflictData.distance >= 1000 ? (gpsConflictData.distance / 1000).toFixed(1) + 'km' : gpsConflictData.distance + 'm'" class="font-bold text-primary"></span> の差があります
                                        </p>
                                    </div>
                                    <div class="space-y-3">
                                        <button type="button" @click="usePhotoLocation()" class="m3-btn-filled" style="border-radius:var(--shape-full);">
                                            <span style="pointer-events:none;">📷</span> 撮影場所を使う（写真のGPS）
                                        </button>
                                        <button type="button" @click="useDeviceLocation()" class="m3-btn-tonal" style="border-radius:var(--shape-full);">
                                            <span>📍</span> 現在地を使う（デバイスGPS）
                                        </button>
                                    </div>
                                    <p class="text-center text-[10px] text-muted">あとから地図をタップして変更もできます</p>
                                </div>
                            </div>
                        </template>
                        <button type="button" @click="showDetails = !showDetails; if(showDetails && window.ikimonAnalytics) ikimonAnalytics.track('form_expand')"
                            class="m3-btn-tonal" style="border-radius:var(--shape-full);padding:14px 24px;"
                            <i data-lucide="chevron-down" class="w-4 h-4 transition-transform" :class="showDetails ? 'rotate-180' : ''"></i>
                            <span x-text="showDetails ? '閉じる' : '名前や詳細を追加する（任意）'"></span>
                        </button>

                        <div x-show="showDetails" x-transition class="space-y-6 mt-6">
                            <!-- Date (auto-set, editable here) -->
                            <div>
                                <label class="block text-[10px] font-black text-faint uppercase tracking-widest mb-2 px-2">観察日時</label>
                                <input type="datetime-local" x-model="observed_at" class="m3-input" style="font-weight:600;">
                                <p class="text-[10px] text-faint px-2 mt-1">※写真はEXIFから自動設定されます</p>
                            </div>

                            <!-- Name Selection -->
                            <div class="relative">
                                <div class="flex justify-between items-center mb-2 px-2">
                                    <label class="block text-[10px] font-black text-faint uppercase tracking-widest">名前（わかる場合）</label>
                                </div>
                                <div class="relative">
                                    <input type="text" x-model="taxon_name" @input.debounce.300ms="searchTaxon()" @focus="showSuggestions = suggestions.length > 0" @keydown.escape="showSuggestions = false" placeholder="和名 or 学名を入力..." autocomplete="off" class="w-full bg-surface border border-border rounded-2xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition text-text font-bold pl-11">
                                    <div class="absolute left-4 top-3.5 text-faint">
                                        <i data-lucide="search" class="w-4 h-4"></i>
                                    </div>
                                    <!-- Selected slug badge + thumbnail -->
                                    <div x-show="taxon_slug" class="absolute right-3 top-1.5 flex items-center gap-1.5">
                                    <img x-show="taxon_thumbnail" :src="taxon_thumbnail" :alt="taxon_name ? taxon_name + ' のサムネイル' : '種のサムネイル'" class="w-7 h-7 rounded-full object-cover border border-primary/30">
                                        <span class="text-[10px] font-bold bg-primary-surface text-primary px-2 py-1 rounded-full">✓ 確定</span>
                                    </div>
                                </div>
                                <!-- Autocomplete Dropdown -->
                                <div x-show="showSuggestions && suggestions.length > 0" x-transition @click.away="showSuggestions = false" class="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-2xl overflow-hidden z-50 shadow-xl max-h-60 overflow-y-auto">
                                    <template x-for="(s, i) in suggestions" :key="i">
                                        <button type="button" @click="selectTaxon(s)" class="w-full text-left px-3 py-2.5 hover:bg-white/5 transition border-b border-border last:border-b-0 flex items-center gap-3">
                                            <!-- Thumbnail -->
                                            <div class="flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden bg-surface-alt border border-border">
                                                <template x-if="s.thumbnail_url">
                                                    <img :src="s.thumbnail_url" :alt="s.jp_name || s.sci_name || '種のサムネイル'" class="w-full h-full object-cover" loading="lazy">
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
                                                        x-text="s.source === 'local' ? 'ローカル' : s.source === 'inat' ? 'iNat' : s.source === 'gbif' ? 'GBIF' : ''"></span>
                                                </div>
                                            </div>
                                            <i data-lucide="chevron-right" class="w-4 h-4 text-faint flex-shrink-0"></i>
                                        </button>
                                    </template>
                                    <p class="text-[10px] text-faint px-2 mt-1.5">✨ 名前がわからなくても投稿OK！誰かが助けてくれます🐾</p>
                                </div>

                                <!-- Soft Validation Alarms (Ecological Constraints) -->
                                <div x-show="validating || validationWarnings.length > 0" x-transition class="mt-2" style="display: none;">
                                    <!-- Loading state -->
                                    <div x-show="validating" class="flex items-center gap-2 px-3 py-2 bg-surface border border-border rounded-xl">
                                        <i data-lucide="loader-2" class="w-3.5 h-3.5 text-muted animate-spin"></i>
                                        <span class="text-[10px] text-muted font-bold">生態データをAI検証中...</span>
                                    </div>
                                    <!-- Warnings -->
                                    <template x-if="validationWarnings.length > 0">
                                        <div class="space-y-1.5">
                                            <template x-for="warning in validationWarnings">
                                                <div class="flex gap-2.5 items-start p-3 bg-warning/10 border border-warning/30 rounded-xl relative overflow-hidden">
                                                    <div class="absolute top-0 left-0 w-1 h-full bg-warning"></div>
                                                    <i data-lucide="alert-triangle" class="w-4 h-4 text-warning flex-shrink-0 mt-0.5"></i>
                                                    <div>
                                                        <div class="text-[10px] font-black text-warning tracking-wider uppercase mb-0.5" x-text="warning.type === 'season' ? '時期の確認' : warning.type === 'habitat' ? '生息環境の確認' : warning.type === 'altitude' ? '標高の確認' : '生態の確認'"></div>
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
                                        <label class="block text-[11px] font-black text-primary uppercase tracking-widest">同定のエビデンス（証拠）</label>
                                        <span class="text-[9px] text-white bg-primary px-2 py-0.5 rounded-full font-bold">必須</span>
                                    </div>
                                    <p class="text-[10px] text-muted mb-3 leading-relaxed">
                                        データの信頼性（Data Quality）を高めるため、同定の決め手となった特徴を選んでください。
                                    </p>
                                    <div class="space-y-3">
                                        <!-- Morphological Traits -->
                                        <div>
                                            <div class="text-[10px] font-bold text-faint mb-1.5 flex items-center gap-1"><i data-lucide="eye" class="w-3 h-3"></i> 形態的特徴</div>
                                            <div class="flex flex-wrap gap-2">
                                                <template x-for="trait in [
                                                {id: 'color_pattern', label: '体色・模様', emoji: '🎨'},
                                                {id: 'shape', label: '全体的な形', emoji: '📐'},
                                                {id: 'size', label: 'サイズ感', emoji: '📏'},
                                                {id: 'specific_part', label: '特定の部位（羽、葉など）', emoji: '🔍'}
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
                                            <div class="text-[10px] font-bold text-faint mb-1.5 flex items-center gap-1"><i data-lucide="footprints" class="w-3 h-3"></i> 生態的特徴・その他</div>
                                            <div class="flex flex-wrap gap-2">
                                                <template x-for="trait in [
                                                {id: 'behavior', label: '行動・鳴き声', emoji: '🎵'},
                                                {id: 'habitat', label: '生息環境', emoji: '🏞️'},
                                                {id: 'host_plant', label: '食草・寄主', emoji: '🌿'},
                                                {id: 'expert_id', label: '専門家・図鑑', emoji: '📖'},
                                                {id: 'intuition', label: 'なんとなく・AI任せ', emoji: '🤖'}
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
                                        <i data-lucide="info" class="w-3 h-3"></i> どれか1つ選んでね。迷ったら「なんとなく・AI任せ」でOK!
                                    </div>
                                </div>
                                <!-- Status (野生/植栽) -->
                                <div>
                                    <label class="block text-[10px] font-black text-faint uppercase tracking-widest mb-2 px-2">状態 <span class="text-primary normal-case">デフォルト: 野生</span></label>
                                    <div class="grid grid-cols-2 gap-2">
                                        <label class="cursor-pointer">
                                            <input type="radio" value="wild" x-model="cultivation" class="hidden peer">
                                            <div class="text-center py-3 rounded-2xl border border-border bg-surface peer-checked:bg-primary peer-checked:text-white peer-checked:border-primary transition text-xs font-bold text-muted">
                                                <i data-lucide="trees" class="w-4 h-4 mx-auto mb-1"></i>
                                                野生
                                            </div>
                                        </label>
                                        <label class="cursor-pointer">
                                            <input type="radio" value="cultivated" x-model="cultivation" class="hidden peer">
                                            <div class="text-center py-3 rounded-2xl border border-border bg-surface peer-checked:bg-secondary peer-checked:text-white peer-checked:border-secondary transition text-xs font-bold text-muted">
                                                <i data-lucide="flower-2" class="w-4 h-4 mx-auto mb-1"></i>
                                                植栽・飼育
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <div>
                                    <div class="flex items-center gap-2 mb-2 px-2">
                                        <label class="block text-[10px] font-black text-faint uppercase tracking-widest">個体の由来</label>
                                        <span class="text-[9px] text-faint bg-surface px-2 py-0.5 rounded-full">施設内でも野生はありえる</span>
                                    </div>
                                    <div class="grid grid-cols-2 gap-2">
                                        <template x-for="opt in [
                                            {value: 'wild', label: '野生', icon: 'trees', tone: 'primary'},
                                            {value: 'cultivated', label: '栽培個体', icon: 'flower-2', tone: 'secondary'},
                                            {value: 'captive', label: '飼育個体', icon: 'fence', tone: 'secondary'},
                                            {value: 'released', label: '放された個体', icon: 'bird', tone: 'warning'},
                                            {value: 'escaped', label: '逸出個体', icon: 'move-up-right', tone: 'warning'},
                                            {value: 'naturalized', label: '野外定着', icon: 'sprout', tone: 'primary'},
                                            {value: 'uncertain', label: '判断保留', icon: 'help-circle', tone: 'muted'}
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
                                    <p class="text-[10px] text-faint px-2 mt-1.5">🌿 植物園の雑草は wild、展示個体は cultivated / captive と分けて残せます</p>
                                </div>

                                <div>
                                    <div class="flex items-center gap-2 mb-2 px-2">
                                        <label class="block text-[10px] font-black text-faint uppercase tracking-widest">施設文脈</label>
                                        <span class="text-[9px] text-faint bg-surface px-2 py-0.5 rounded-full">100年後の来歴用</span>
                                    </div>
                                    <div class="relative">
                                        <select x-model="managed_context_type" class="w-full bg-surface border border-border rounded-2xl px-4 py-3 text-xs font-bold text-text focus:outline-none focus:border-primary appearance-none">
                                            <option value="">施設なし / ふつうの野外観察</option>
                                            <option value="botanical_garden">🌺 植物園</option>
                                            <option value="zoo">🦁 動物園</option>
                                            <option value="aquarium">🐟 水族館</option>
                                            <option value="aviary">🕊️ 花鳥園・鳥類園</option>
                                            <option value="conservation_center">🧬 保全施設・研究飼育</option>
                                            <option value="park_planting">🌳 公園植栽</option>
                                            <option value="school_biotope">🏫 学校ビオトープ</option>
                                            <option value="private_collection">🏠 私設コレクション</option>
                                            <option value="other">🏷️ その他</option>
                                        </select>
                                        <div class="absolute right-4 top-3.5 text-muted pointer-events-none">
                                            <i data-lucide="chevron-down" class="w-4 h-4"></i>
                                        </div>
                                    </div>
                                    <div class="mt-2 space-y-2" x-show="managed_context_type" x-transition>
                                        <input type="text" x-model="managed_site_name"
                                            placeholder="施設名（例: 浜松市動物園、○○植物園）"
                                            class="w-full bg-surface border border-border rounded-2xl px-4 py-3 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition text-sm text-text">
                                        <textarea x-model="managed_context_note"
                                            placeholder="展示温室、放飼場、植栽エリアなど補足があれば"
                                            class="w-full bg-surface border border-border rounded-2xl px-4 py-3 h-20 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition text-text placeholder-faint font-medium"></textarea>
                                    </div>
                                </div>

                                <!-- 🪨 Substrate/Terrain Tags (100-Year Archive Fusion) -->
                                <div>
                                    <div class="flex items-center gap-2 mb-2 px-2">
                                        <label class="block text-[10px] font-black text-faint uppercase tracking-widest">地面の状態</label>
                                        <span class="text-[9px] text-faint bg-surface px-2 py-0.5 rounded-full">任意・複数選択可</span>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <template x-for="tag in [
                                        {id: 'rock', label: '岩場', emoji: '🪨'},
                                        {id: 'sand', label: '砂地', emoji: '🏖️'},
                                        {id: 'gravel', label: '砂利', emoji: '🫘'},
                                        {id: 'grass', label: '草地', emoji: '🌿'},
                                        {id: 'leaf_litter', label: '落ち葉', emoji: '🍂'},
                                        {id: 'deadwood', label: '倒木・朽木', emoji: '🪵'},
                                        {id: 'water', label: '水辺', emoji: '💧'},
                                        {id: 'artificial', label: '人工物', emoji: '🏗️'}
                                    ]">
                                            <button type="button" @click="toggleSubstrate(tag.id)"
                                                class="px-3 py-2 rounded-xl border transition text-xs font-bold flex items-center gap-1.5"
                                                :class="substrate_tags.includes(tag.id) ? 'bg-primary text-white border-primary shadow-sm shadow-primary/20' : 'border-border bg-surface text-muted hover:border-primary/30'">
                                                <span x-text="tag.emoji"></span>
                                                <span x-text="tag.label"></span>
                                            </button>
                                        </template>
                                    </div>
                                    <p class="text-[10px] text-faint px-2 mt-1.5">🌍 地面の状態を記録すると、100年後の環境変化を追跡できるデータになります</p>
                                </div>


                                <!-- Life Stage -->
                                <div>
                                    <div class="flex items-center gap-2 mb-2 px-2">
                                        <label class="block text-[10px] font-black text-faint uppercase tracking-widest">ライフステージ</label>
                                        <span class="text-[9px] text-faint bg-surface px-2 py-0.5 rounded-full">任意</span>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <template x-for="stage in [
                                        {id: 'adult', label: '成体', sub: '成虫・成魚・成獣', icon: 'crown'},
                                        {id: 'juvenile', label: '幼体', sub: '幼虫・稚魚・芽生え', icon: 'sprout'},
                                        {id: 'egg', label: '卵・種子', sub: '卵塚・胞子も', icon: 'circle-dot'},
                                        {id: 'trace', label: '痕跡', sub: '足跡・糞・巣・脱皮', icon: 'footprints'}
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
                                                不明
                                            </div>
                                        </label>
                                    </div>
                                </div>

                                <!-- Note -->
                                <div>
                                    <label class="block text-[10px] font-black text-faint uppercase tracking-widest mb-2 px-2">メモ</label>
                                    <textarea x-model="note" placeholder="行動、環境、気づいたことを記録..." class="w-full bg-surface border border-border rounded-2xl px-4 py-3 h-24 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition text-text placeholder-faint font-medium"></textarea>
                                </div>

                                <!-- CC License Selector -->
                                <div>
                                    <div class="flex items-center gap-2 mb-2 px-2">
                                        <label class="block text-[10px] font-black text-faint uppercase tracking-widest">ライセンス</label>
                                        <span class="text-[9px] text-primary bg-primary/10 px-2 py-0.5 rounded-full font-bold">おすすめ: CC BY</span>
                                    </div>
                                    <div class="space-y-2">
                                        <label class="cursor-pointer block">
                                            <input type="radio" value="CC-BY" x-model="license" class="hidden peer">
                                            <div class="flex items-center gap-3 px-4 py-3 rounded-2xl border border-border bg-surface peer-checked:bg-primary/10 peer-checked:border-primary/40 transition">
                                                <span class="text-lg">🌍</span>
                                                <div class="flex-1">
                                                    <span class="text-xs font-bold text-text">CC BY（表示）</span>
                                                    <span class="block text-[10px] text-muted">クレジット表示で誰でも利用OK。GBIF共有対象 ✓</span>
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
                                                    <span class="text-xs font-bold text-text">CC0（パブリックドメイン）</span>
                                                    <span class="block text-[10px] text-muted">制限なし。最もオープン。GBIF共有対象 ✓</span>
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
                                                    <span class="text-xs font-bold text-text">CC BY-NC（表示-非営利）</span>
                                                    <span class="block text-[10px] text-muted">商用利用不可。GBIF共有対象外</span>
                                                </div>
                                                <div class="w-4 h-4 rounded-full border-2 border-border flex items-center justify-center">
                                                    <div class="w-2 h-2 rounded-full" :class="license === 'CC-BY-NC' ? 'bg-secondary' : ''"></div>
                                                </div>
                                            </div>
                                        </label>
                                    </div>
                                    <p class="text-[10px] text-faint px-2 mt-1.5">
                                        💡 CC BY を選ぶと、あなたの記録が世界中の研究に活用されます。
                                        <a href="faq.php#e1" class="text-primary underline">詳しくはFAQ</a>
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
                    <span x-text="record_mode === 'surveyor_official' ? '公式記録を残す' : '足跡を残す'"></span>
                    <span x-show="photos.length > 0" class="ml-1 text-sm opacity-80" x-text="'(' + photos.length + '枚)'"></span>
                </span>
                <span x-show="submitting" class="flex items-center gap-2"><span class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>送信中...</span>
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
                <h3 class="text-2xl font-black text-text mb-1">記録された！ 🐾</h3>
                <p class="text-sm text-muted mb-2">キミの気づきが、この場所の生態地図に足あとを刻んだよ</p>
                <p class="text-[11px] text-faint mb-4" x-show="!aiReady && !aiPending">観察のヒントは観察詳細に追記されます。うまく絞れないときは、他の人からの訂正や追加同定も入りやすくなります。</p>
                <div x-show="aiPending" class="bg-surface border border-border rounded-2xl p-4 mb-4 max-w-sm mx-auto">
                    <p class="text-sm font-bold text-text mb-1">🪄 観察のヒントを準備中</p>
                    <p class="text-xs text-muted leading-relaxed">投稿はもう完了しています。数秒で属・科レベルのヒントが付くことが多いです。</p>
                </div>
                <div x-show="aiReady" class="bg-primary-surface border border-primary-glow rounded-2xl p-4 mb-4 max-w-sm mx-auto">
                    <p class="text-sm text-primary font-bold mb-1">✨ 観察のヒントもついたよ</p>
                    <p class="text-xs text-primary/80 leading-relaxed" x-text="aiSummary || '観察詳細を開くと、いま見えている手がかりをすぐ確認できます。'"></p>
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
                                <p class="text-[10px] text-amber-600 mt-2 leading-relaxed">発見情報の記録は生態系保全に役立ちます。ご報告ありがとうございます。</p>
                            </div>
                        </div>
                    </div>
                </template>

                <div class="rounded-2xl border border-border bg-surface p-4 mb-6 max-w-sm mx-auto text-left">
                    <p class="text-[10px] font-black text-faint uppercase tracking-widest mb-2">この記録が次に育つこと</p>
                    <div class="space-y-2 text-xs text-text">
                        <div class="flex items-start gap-2">
                            <span class="mt-0.5">1.</span>
                            <p>観察詳細に、AIのヒントや同定の流れがまとまります</p>
                        </div>
                        <div class="flex items-start gap-2">
                            <span class="mt-0.5">2.</span>
                            <p>ほかの人の同定や訂正が入ると、記録が安定していきます</p>
                        </div>
                        <div class="flex items-start gap-2">
                            <span class="mt-0.5">3.</span>
                            <p>細部写真やメモを足すと、もっと下の分類群まで進みやすくなります</p>
                        </div>
                    </div>
                    <div class="mt-3 flex flex-wrap gap-2">
                        <span class="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold text-primary">訂正歓迎</span>
                        <span class="inline-flex items-center rounded-full bg-sky-50 px-3 py-1 text-[11px] font-bold text-sky-700">あとから追記OK</span>
                        <span x-show="!taxon_slug" class="inline-flex items-center rounded-full bg-warning/10 px-3 py-1 text-[11px] font-bold text-warning">名前はまだ育ちます</span>
                        <span x-show="taxon_slug" class="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-700">いまの名前を起点に育てられます</span>
                    </div>
                </div>

                <div class="space-y-3 max-w-xs mx-auto">
                    <a :href="'observation_detail.php?id=' + lastObservationId"
                        class="block w-full py-4 rounded-full bg-gradient-to-r from-primary to-accent text-white font-black text-center shadow-lg shadow-primary/20 active:scale-95 transition flex items-center justify-center gap-2">
                        <i data-lucide="eye" class="w-5 h-5"></i>
                        観察の詳細を見る
                    </a>
                    <a x-show="taxon_slug" :href="'species/' + encodeURIComponent(taxon_slug)"
                        class="block w-full py-3 rounded-full bg-surface border border-border text-text font-bold text-center text-sm hover:bg-white/5 transition flex items-center justify-center gap-2">
                        📖 <span x-text="taxon_name"></span> の図鑑を見る
                    </a>
                    <a x-show="!taxon_slug" href="id_center.php"
                        class="block w-full py-3 rounded-full bg-surface border border-primary/30 text-primary font-bold text-sm text-center hover:bg-primary-surface/20 transition flex items-center justify-center gap-2 active:scale-95">
                        <i data-lucide="search" class="w-4 h-4"></i>
                        みんなに名前を聞いてみる
                    </a>
                    <button @click="resetForm()" class="w-full py-3 rounded-full bg-secondary-surface border border-secondary/20 text-secondary font-bold text-sm hover:bg-secondary-surface/80 transition flex items-center justify-center gap-2 active:scale-95">
                        📸 もう一枚記録する
                    </button>
                    <?php if ($returnUrl): ?>
                        <a href="<?php echo $returnUrl; ?>" class="block w-full py-3 rounded-full bg-surface border border-primary/30 text-primary font-bold text-sm text-center hover:bg-primary-surface/20 transition flex items-center justify-center gap-2 active:scale-95">
                            🗺️ フィールドワークに戻る
                        </a>
                    <?php endif; ?>
                    <a href="index.php" class="block text-sm text-faint hover:text-text transition py-2 text-center">
                        🏠 ホームに戻る
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
            canSurveyorOfficialPost: <?php echo $canSurveyorOfficialPost ? 'true' : 'false'; ?>
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
                    <img :src="currentEvent.badge.image_url" :alt="currentEvent.badge.name ? currentEvent.badge.name + ' のバッジ' : 'バッジ'" class="w-20 h-20 mx-auto mt-3 object-contain drop-shadow-md">
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
                <span x-text="currentIndex < events.length - 1 ? '次の報酬へ！' : '最高！閉じる'"></span>
            </button>
        </div>
    </div>
</body>

</html>
