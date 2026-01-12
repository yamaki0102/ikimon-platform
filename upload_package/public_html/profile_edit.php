<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';

Auth::init();
$user = Auth::user();

if (!$user) {
    header('Location: login.php');
    exit;
}
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>プロフィール編集 - ikimon.life</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Noto+Sans+JP:wght@400;500;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
</head>

<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-body">
    <?php include('components/nav.php'); ?>

    <main class="max-w-2xl mx-auto px-6 py-24 md:py-32" x-data="profileEdit()">

        <header class="mb-10">
            <a href="profile.php" class="inline-flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-white transition mb-4">
                <i data-lucide="arrow-left" class="w-4 h-4"></i>
                プロフィールに戻る
            </a>
            <h1 class="text-3xl font-black">Edit Profile</h1>
            <p class="text-gray-400 mt-2">プロフィール情報の更新とパスワードの変更</p>
        </header>

        <div class="glass-card p-8 rounded-3xl border border-white/5 relative overflow-hidden">
            <!-- Loading Overlay -->
            <div x-show="loading" class="absolute inset-0 bg-black/50 z-10 flex items-center justify-center backdrop-blur-sm" x-transition>
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>

            <form @submit.prevent="submit" class="space-y-8">
                <!-- Basic Info -->
                <div class="space-y-6">
                    <h2 class="text-lg font-bold border-b border-white/10 pb-2">基本情報</h2>

                    <div>
                        <label class="block text-xs font-bold text-gray-400 mb-2 ml-1">アバター <span class="text-[10px] text-gray-600 font-normal">(Gravatar連携)</span></label>
                        <div class="flex items-center gap-4">
                            <img src="<?php echo $user['avatar']; ?>" class="w-20 h-20 rounded-[var(--radius-lg)] border-2 border-white/10">
                            <div class="text-xs text-gray-500">
                                <p>アバターは現在自動生成です。</p>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-400 mb-2 ml-1">表示名</label>
                        <input type="text" x-model="form.name" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 transition text-white font-bold" required maxlength="50">
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-gray-400 mb-2 ml-1">自己紹介</label>
                        <textarea x-model="form.bio" rows="4" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 transition text-white text-sm" placeholder="好きな生き物や活動地域など..." maxlength="500"></textarea>
                    </div>
                </div>

                <!-- Password Change -->
                <div class="space-y-6 pt-6">
                    <h2 class="text-lg font-bold border-b border-white/10 pb-2 flex items-center gap-2">
                        <i data-lucide="lock" class="w-4 h-4 text-green-500"></i>
                        パスワード変更
                    </h2>
                    <p class="text-xs text-gray-500">変更する場合のみ入力してください。</p>

                    <div>
                        <label class="block text-xs font-bold text-gray-400 mb-2 ml-1">現在のパスワード</label>
                        <input type="password" x-model="form.current_password" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 transition text-white font-bold" placeholder="変更するには現在のパスワードが必要です">
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold text-gray-400 mb-2 ml-1">新しいパスワード</label>
                            <input type="password" x-model="form.new_password" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 transition text-white font-bold" placeholder="8文字以上">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-gray-400 mb-2 ml-1">新しいパスワード（確認）</label>
                            <input type="password" x-model="form.confirm_password" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-green-500 transition text-white font-bold">
                        </div>
                    </div>
                </div>

                <!-- Error Message -->
                <div x-show="message" class="p-4 rounded-xl text-sm font-bold text-center" :class="success ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'" x-text="message" style="display: none;"></div>

                <div class="pt-4 flex justify-end gap-3">
                    <a href="profile.php" class="px-6 py-3 rounded-xl font-bold text-gray-400 hover:text-white hover:bg-white/5 transition">キャンセル</a>
                    <button type="submit" class="btn-primary px-8 py-3 rounded-xl font-bold shadow-lg shadow-green-500/20" :disabled="loading">
                        変更を保存
                    </button>
                </div>
            </form>
        </div>
    </main>

    <script>
        function profileEdit() {
            return {
                loading: false,
                message: '',
                success: false,
                form: {
                    name: '<?php echo addslashes($user['name']); ?>',
                    bio: '<?php echo addslashes($user['bio'] ?? ''); ?>',
                    current_password: '',
                    new_password: '',
                    confirm_password: ''
                },
                async submit() {
                    this.loading = true;
                    this.message = '';

                    try {
                        const res = await fetch('api/update_profile.php', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify(this.form)
                        });
                        const data = await res.json();

                        this.success = data.success;
                        this.message = data.message;

                        if (data.success) {
                            // Reset password fields
                            this.form.current_password = '';
                            this.form.new_password = '';
                            this.form.confirm_password = '';
                            setTimeout(() => {
                                window.location.href = 'profile.php';
                            }, 1500);
                        }
                    } catch (e) {
                        this.success = false;
                        this.message = '通信エラーが発生しました。';
                    } finally {
                        this.loading = false;
                    }
                }
            }
        }
        lucide.createIcons();
    </script>
</body>

</html>