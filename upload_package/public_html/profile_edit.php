<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';

Auth::init();
$user = Auth::user();

if (!$user) {
    header('Location: login.php');
    exit;
}
$meta_title = "プロフィール編集";
$meta_description = "ikimon.lifeのプロフィール情報を更新します。";
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.css">
    <style>
        .glass-card {
            background: var(--glass-surface);
            backdrop-filter: blur(var(--glass-blur));
            border: 1px solid var(--glass-border);
            box-shadow: var(--shadow-sm);
        }

        /* Avatar upload specific styles */
        .avatar-upload-area {
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .avatar-upload-area:hover,
        .avatar-upload-area.drag-over {
            border-color: var(--color-primary);
            background: var(--color-primary-surface);
        }

        /* Password section transition */
        .password-section {
            transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.4s ease;
            overflow: hidden;
            max-height: 0;
            opacity: 0;
        }

        .password-section.open {
            max-height: 500px;
            opacity: 1;
        }

        /* Crop Modal */
        .crop-modal {
            position: fixed;
            inset: 0;
            z-index: 50;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(4px);
        }

        .crop-container {
            background: var(--color-elevated, #fff);
            border-radius: 1.5rem;
            padding: 1.5rem;
            max-width: 90vw;
            max-height: 85vh;
            width: 28rem;
            box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
        }

        .crop-canvas-wrap {
            width: 100%;
            max-height: 60vh;
            overflow: hidden;
            border-radius: 0.75rem;
            background: #f3f4f6;
        }

        .crop-canvas-wrap img {
            display: block;
            max-width: 100%;
        }
    </style>
</head>

<body class="bg-base text-text font-body selection:bg-primary-surface selection:text-primary-dark pb-20 md:pb-0">
    <?php include('components/nav.php'); ?>

    <main class="max-w-2xl mx-auto px-4 md:px-6 py-20 md:py-28" x-data="profileEdit()">

        <!-- Header -->
        <header class="mb-8 md:mb-10 text-center md:text-left">
            <a href="profile.php" class="inline-flex items-center gap-2 text-xs font-bold text-muted hover:text-text transition mb-4 md:mb-6 px-3 py-1.5 rounded-full hover:bg-surface">
                <i data-lucide="arrow-left" class="w-4 h-4"></i>
                プロフィールに戻る
            </a>
            <h1 class="text-2xl md:text-3xl font-black tracking-tight mb-2">プロフィール編集</h1>
            <p class="text-sm font-bold text-muted">あなたの個性を表現しよう</p>
        </header>

        <div class="glass-card p-6 md:p-8 rounded-3xl relative overflow-hidden">
            <!-- Loading Overlay -->
            <div x-show="loading" class="absolute inset-0 bg-base/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm" x-transition.opacity>
                <div class="w-12 h-12 border-4 border-surface border-t-primary rounded-full animate-spin mb-4"></div>
                <p class="text-xs font-bold text-faint uppercase tracking-widest animate-pulse">Saving changes...</p>
            </div>

            <form @submit.prevent="submit" class="space-y-8 md:space-y-10">

                <!-- Avatar Section -->
                <div>
                    <h2 class="text-sm font-bold text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i data-lucide="image" class="w-4 h-4"></i> アバター画像
                    </h2>

                    <div class="flex flex-col md:flex-row items-center gap-6">
                        <!-- Preview Circle -->
                        <div class="relative group shrink-0">
                            <div class="w-28 h-28 rounded-[var(--radius-lg)] overflow-hidden border-4 border-surface shadow-lg bg-surface">
                                <img :src="avatarPreview" class="w-full h-full object-cover transition duration-500 group-hover:scale-105">
                            </div>
                            <button type="button"
                                @click="$refs.avatarInput.click()"
                                class="absolute bottom-0 right-0 w-8 h-8 bg-elevated text-text rounded-full shadow-md flex items-center justify-center border border-border hover:bg-surface hover:scale-110 transition z-10">
                                <i data-lucide="camera" class="w-4 h-4"></i>
                            </button>
                        </div>

                        <!-- Upload Area -->
                        <div class="flex-1 w-full dashed-border rounded-xl p-6 text-center cursor-pointer avatar-upload-area relative"
                            @click="$refs.avatarInput.click()"
                            @dragover.prevent="$el.classList.add('drag-over')"
                            @dragleave.prevent="$el.classList.remove('drag-over')"
                            @drop.prevent="$el.classList.remove('drag-over'); handleDrop($event)">

                            <i data-lucide="upload-cloud" class="w-8 h-8 text-faint mx-auto mb-2"></i>
                            <p class="text-sm font-bold text-muted mb-1">画像をアップロード</p>
                            <p class="text-token-xs text-faint">ドラッグ＆ドロップ、またはクリックして選択<br>推奨: 正方形（自動圧縮されます）</p>

                            <input type="file" x-ref="avatarInput" accept="image/jpeg,image/png,image/webp"
                                @change="previewAvatar($event)" class="hidden">
                        </div>
                    </div>
                </div>

                <!-- Crop Modal -->
                <template x-if="showCropModal">
                    <div class="crop-modal" @click.self="closeCropper()" x-transition.opacity>
                        <div class="crop-container" @click.stop>
                            <div class="flex items-center justify-between mb-4">
                                <h3 class="text-base font-black flex items-center gap-2">
                                    <i data-lucide="crop" class="w-5 h-5 text-primary"></i>
                                    画像をトリミング
                                </h3>
                                <button type="button" @click="closeCropper()" class="w-8 h-8 rounded-full hover:bg-surface flex items-center justify-center transition">
                                    <i data-lucide="x" class="w-5 h-5 text-muted"></i>
                                </button>
                            </div>
                            <div class="crop-canvas-wrap mb-4">
                                <img x-ref="cropImage" :src="cropSrc" alt="Crop preview">
                            </div>
                            <div class="flex gap-3 justify-end">
                                <button type="button" @click="closeCropper()"
                                    class="px-5 py-2.5 rounded-xl text-sm font-bold text-muted hover:bg-surface transition">
                                    キャンセル
                                </button>
                                <button type="button" @click="applyCrop()"
                                    class="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-primary hover:brightness-110 transition shadow-lg shadow-primary/20 flex items-center gap-2">
                                    <i data-lucide="check" class="w-4 h-4"></i>
                                    決定
                                </button>
                            </div>
                        </div>
                    </div>
                </template>

                <!-- Basic Info -->
                <div class="space-y-5">
                    <h2 class="text-sm font-bold text-muted uppercase tracking-widest mb-2 flex items-center gap-2 border-t border-border pt-8">
                        <i data-lucide="user" class="w-4 h-4"></i> 基本情報
                    </h2>

                    <div>
                        <label class="block text-xs font-bold text-gray-500 mb-1.5 ml-1">表示名 <span class="text-red-400">*</span></label>
                        <div class="relative">
                            <input type="text" x-model="form.name"
                                class="w-full bg-white/50 border border-gray-200 rounded-xl pl-4 pr-10 py-3 text-sm focus:outline-none focus:border-[var(--color-primary)] focus:bg-white transition font-bold"
                                required maxlength="50" placeholder="あなたのニックネーム">
                            <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" x-show="form.name.length > 0">
                                <i data-lucide="check" class="w-4 h-4 text-green-500" x-show="form.name.length <= 50"></i>
                            </div>
                        </div>
                        <p class="text-token-xs text-gray-400 text-right mt-1" x-text="form.name.length + '/50'"></p>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-muted mb-1.5 ml-1">自己紹介</label>
                        <textarea x-model="form.bio" rows="4"
                            class="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary focus:bg-elevated transition resize-none"
                            placeholder="好きな生き物、活動地域、専門分野など..." maxlength="500"></textarea>
                        <p class="text-token-xs text-faint text-right mt-1" x-text="form.bio.length + '/500'"></p>
                    </div>
                </div>

                <!-- Password Change (Accordion) -->
                <div class="pt-2">
                    <button type="button" @click="togglePasswordSection()"
                        class="w-full flex items-center justify-between py-3 px-1 group">
                        <h2 class="text-sm font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2 group-hover:text-gray-600 transition">
                            <i data-lucide="lock" class="w-4 h-4"></i> パスワード変更
                        </h2>
                        <i data-lucide="chevron-down" class="w-4 h-4 text-gray-400 transition-transform duration-300"
                            :class="showPasswordSection ? 'rotate-180' : ''"></i>
                    </button>

                    <div class="password-section" :class="showPasswordSection ? 'open' : ''">
                        <div class="p-5 bg-surface rounded-2xl border border-border space-y-4 mt-2">
                            <p class="text-xs text-muted font-bold mb-2">セキュリティのため、変更時のみ入力してください。</p>

                            <div>
                                <label class="block text-xs font-bold text-gray-500 mb-1.5 ml-1">現在のパスワード</label>
                                <input type="password" x-model="form.current_password"
                                    class="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] transition"
                                    placeholder="••••••••">
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 mb-1.5 ml-1">新しいパスワード</label>
                                    <input type="password" x-model="form.new_password"
                                        class="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] transition"
                                        placeholder="8文字以上">
                                </div>
                                <div>
                                    <label class="block text-xs font-bold text-gray-500 mb-1.5 ml-1">新しいパスワード（確認）</label>
                                    <input type="password" x-model="form.confirm_password"
                                        class="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--color-primary)] transition"
                                        :class="{'border-red-300 bg-red-50': passwordMismatch, 'border-green-300 bg-green-50': passwordMatch}">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Message Toast Area -->
                <div x-show="message" x-transition
                    class="p-4 rounded-xl text-sm font-bold flex items-center gap-2"
                    :class="success ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'">
                    <i :data-lucide="success ? 'check-circle' : 'alert-circle'" class="w-5 h-5 shrink-0"></i>
                    <span x-text="message"></span>
                </div>

                <!-- Actions -->
                <div class="pt-4 flex flex-col-reverse md:flex-row justify-end gap-3">
                    <a href="profile.php" class="px-6 py-3.5 rounded-xl font-bold text-gray-500 text-center hover:bg-gray-100 transition text-sm">キャンセル</a>
                    <button type="submit"
                        class="px-8 py-3.5 rounded-xl font-bold shadow-lg shadow-primary/20 text-white text-sm transition transform active:scale-95 flex items-center justify-center gap-2"
                        :class="hasChanges ? 'bg-primary hover:brightness-110' : 'bg-surface cursor-not-allowed text-faint shadow-none'"
                        :disabled="!hasChanges || loading">
                        <i data-lucide="save" class="w-4 h-4"></i>
                        変更を保存
                    </button>
                </div>
            </form>
        </div>
    </main>

    <script src="https://cdnjs.cloudflare.com/ajax/libs/cropperjs/1.6.2/cropper.min.js"></script>
    <script nonce="<?= CspNonce::attr() ?>">
        function profileEdit() {
            return {
                loading: false,
                message: '',
                success: false,
                avatarPreview: <?php echo json_encode($user['avatar'] ?? 'assets/img/default-avatar.svg', JSON_HEX_TAG); ?>,
                avatarFile: null,
                showPasswordSection: false,
                showCropModal: false,
                cropSrc: '',
                cropper: null,
                initialForm: {},
                form: {
                    name: <?php echo json_encode($user['name'] ?? '', JSON_HEX_TAG | JSON_UNESCAPED_UNICODE); ?>,
                    bio: <?php echo json_encode($user['bio'] ?? '', JSON_HEX_TAG | JSON_UNESCAPED_UNICODE); ?>,
                    current_password: '',
                    new_password: '',
                    confirm_password: ''
                },

                init() {
                    this.initialForm = JSON.parse(JSON.stringify(this.form));
                    this.$watch('form.new_password', val => {
                        if (val.length > 0 && !this.showPasswordSection) this.showPasswordSection = true;
                    });
                },

                togglePasswordSection() {
                    this.showPasswordSection = !this.showPasswordSection;
                    if (!this.showPasswordSection) {
                        this.form.current_password = '';
                        this.form.new_password = '';
                        this.form.confirm_password = '';
                    }
                },

                get passwordMatch() {
                    return this.form.new_password.length >= 8 && this.form.new_password === this.form.confirm_password;
                },

                get passwordMismatch() {
                    return this.form.confirm_password.length > 0 && this.form.new_password !== this.form.confirm_password;
                },

                get hasChanges() {
                    if (this.avatarFile) return true;
                    if (this.form.name !== this.initialForm.name) return true;
                    if (this.form.bio !== this.initialForm.bio) return true;
                    if (this.form.new_password.length > 0) return true;
                    return false;
                },

                handleDrop(event) {
                    const file = event.dataTransfer.files[0];
                    if (file) this.processFile(file);
                },

                previewAvatar(event) {
                    const file = event.target.files[0];
                    if (file) this.processFile(file);
                },

                processFile(file) {
                    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
                        this.showMessage(false, 'JPEG, PNG, WebP形式の画像のみアップロード可能です。');
                        return;
                    }
                    this.message = '';
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        this.showCropper(e.target.result);
                    };
                    reader.readAsDataURL(file);
                },

                showCropper(dataUrl) {
                    this.cropSrc = dataUrl;
                    this.showCropModal = true;
                    this.$nextTick(() => {
                        const imgEl = this.$refs.cropImage;
                        if (!imgEl) return;
                        if (this.cropper) {
                            this.cropper.destroy();
                            this.cropper = null;
                        }
                        this.cropper = new Cropper(imgEl, {
                            aspectRatio: 1,
                            viewMode: 1,
                            dragMode: 'move',
                            autoCropArea: 0.9,
                            responsive: true,
                            restore: false,
                            guides: false,
                            center: true,
                            highlight: false,
                            cropBoxMovable: true,
                            cropBoxResizable: true,
                            toggleDragModeOnDblclick: false,
                            background: false,
                        });
                        lucide.createIcons();
                    });
                },

                closeCropper() {
                    if (this.cropper) {
                        this.cropper.destroy();
                        this.cropper = null;
                    }
                    this.showCropModal = false;
                    this.cropSrc = '';
                    // Reset file input so same file can be re-selected
                    if (this.$refs.avatarInput) this.$refs.avatarInput.value = '';
                },

                async applyCrop() {
                    if (!this.cropper) return;
                    const canvas = this.cropper.getCroppedCanvas({
                        width: 512,
                        height: 512,
                        imageSmoothingEnabled: true,
                        imageSmoothingQuality: 'high',
                    });
                    const blob = await new Promise(resolve =>
                        canvas.toBlob(resolve, 'image/webp', 0.85)
                    );
                    this.avatarFile = blob;
                    this.avatarPreview = canvas.toDataURL('image/webp', 0.85);
                    this.closeCropper();
                },

                showMessage(isSuccess, msg) {
                    this.success = isSuccess;
                    this.message = msg;
                    // Auto clear success message
                    if (isSuccess) {
                        setTimeout(() => this.message = '', 3000);
                    }
                },

                async submit() {
                    if (!this.hasChanges) return;

                    this.loading = true;
                    this.message = '';

                    try {
                        // 1. Upload avatar if changed
                        if (this.avatarFile) {
                            const fd = new FormData();
                            fd.append('avatar', this.avatarFile, 'avatar.webp');
                            const avatarRes = await fetch('api/upload_avatar.php', {
                                method: 'POST',
                                headers: {
                                    'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
                                },
                                body: fd
                            });
                            const avatarData = await avatarRes.json();
                            if (!avatarData.success) {
                                throw new Error(avatarData.message || 'アバターのアップロードに失敗しました。');
                            }
                        }

                        // 2. Update profile data
                        const res = await fetch('api/update_profile.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]')?.content || ''
                            },
                            body: JSON.stringify(this.form)
                        });
                        const data = await res.json();

                        if (!data.success) {
                            throw new Error(data.message || '更新に失敗しました。');
                        }

                        this.showMessage(true, 'プロフィールを更新しました！✨');

                        // Reset sensitive fields & update initial state
                        this.form.current_password = '';
                        this.form.new_password = '';
                        this.form.confirm_password = '';
                        this.showPasswordSection = false;
                        this.avatarFile = null;
                        this.initialForm = JSON.parse(JSON.stringify(this.form));

                        setTimeout(() => {
                            window.location.href = 'profile.php';
                        }, 1000);

                    } catch (e) {
                        this.showMessage(false, e.message || '通信エラーが発生しました。');
                    } finally {
                        this.loading = false;
                        window.scrollTo({
                            top: 0,
                            behavior: 'smooth'
                        });
                    }
                }
            }
        }

        document.addEventListener('DOMContentLoaded', () => {
            lucide.createIcons();
        });
    </script>
</body>

</html>