<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/UserStore.php';
require_once __DIR__ . '/../libs/CSRF.php';
require_once __DIR__ . '/../libs/RateLimiter.php';
require_once __DIR__ . '/../config/oauth_config.php';

Auth::init();

$error = null;
$activeTab = $_POST['action'] ?? ($_GET['tab'] ?? 'login');
$redirect = $_POST['redirect'] ?? ($_GET['redirect'] ?? 'index.php');
// Security: Prevent external redirect (no protocol, no //, no backslashes)
if (preg_match('#^(//)#', $redirect) || strpos($redirect, ':') !== false || strpos($redirect, '\\') !== false) {
    $redirect = 'index.php';
}

// Guest limit reached message
$guestLimitMsg = null;
if (($_GET['reason'] ?? '') === 'guest_limit') {
    $guestLimitMsg = 'ゲスト投稿の上限(' . Auth::GUEST_POST_LIMIT . '件)に達しました。ログインすると無制限に投稿できます 🌿';
}

// OAuth error handling
if (isset($_GET['error'])) {
    $oauthErrors = [
        'invalid_provider' => '無効なプロバイダーです。',
        'oauth_not_configured' => 'このログイン方法は現在利用できません。',
        'oauth_init_failed' => 'ソーシャルログインの開始に失敗しました。',
        'banned' => 'このアカウントは現在利用できません。',
        'oauth' => $_GET['msg'] ?? 'ソーシャルログインに失敗しました。',
    ];
    $error = $oauthErrors[$_GET['error']] ?? 'エラーが発生しました。';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Brute-force protection: 5 attempts per minute per IP
    $rateLimitKey = 'login_form_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
    if (!RateLimiter::check($rateLimitKey, 5, 60)) {
        $error = 'ログイン試行回数が多すぎます。1分後に再試行してください。';
    } elseif (!CSRF::validate($_POST['csrf_token'] ?? '')) {
        $error = 'セッションが無効です。ページを再読み込みしてください。';
    } else {
        $action = $_POST['action'] ?? 'login';
        if ($action === 'login') {
            $email = trim($_POST['email'] ?? '');
            $password = $_POST['password'] ?? '';

            if (!$email || !$password) {
                $error = 'メールアドレスとパスワードを入力してください。';
            } else {
                $user = UserStore::findByEmail($email);
                if (!$user || empty($user['password_hash']) || !password_verify($password, $user['password_hash'])) {
                    $error = 'メールアドレスまたはパスワードが間違っています。';
                } elseif (!empty($user['banned'])) {
                    $error = 'このアカウントは現在利用できません。';
                } else {
                    // ゲスト投稿データ引き継ぎ
                    $guestData = Auth::migrateGuestData();

                    $loginUser = $user;
                    unset($loginUser['password_hash']);
                    $loginUser['rank'] = $loginUser['rank'] ?? Auth::getRankLabel($loginUser);
                    Auth::login($loginUser);
                    UserStore::update($user['id'], ['last_login_at' => date('Y-m-d H:i:s')]);

                    // ゲスト観測データをユーザーに移行
                    if (!empty($guestData['guest_id']) && !empty($guestData['post_ids'])) {
                        require_once __DIR__ . '/../libs/DataStore.php';
                        $allObs = DataStore::fetchAll('observations');
                        $changed = false;
                        foreach ($allObs as $i => $obs) {
                            if (($obs['user_id'] ?? '') === $guestData['guest_id']
                                && in_array($obs['id'] ?? '', $guestData['post_ids'])
                            ) {
                                $allObs[$i]['user_id'] = $user['id'];
                                $allObs[$i]['user_name'] = $user['name'];
                                $allObs[$i]['updated_at'] = date('Y-m-d H:i:s');
                                $changed = true;
                            }
                        }
                        if ($changed) {
                            DataStore::save('observations', $allObs);
                            require_once __DIR__ . '/../libs/Gamification.php';
                            Gamification::syncUserStats($user['id']);
                        }
                    }

                    header('Location: ' . $redirect);
                    exit;
                }
            }
        } elseif ($action === 'register') {
            $name = trim($_POST['name'] ?? '');
            $email = trim($_POST['email'] ?? '');
            $password = $_POST['password'] ?? '';
            $passwordConfirm = $_POST['password_confirm'] ?? '';

            if (!$name || !$email || !$password) {
                $error = 'すべての項目を入力してください。';
            } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
                $error = 'メールアドレスの形式が正しくありません。';
            } elseif (strlen($password) < 8) {
                $error = 'パスワードは8文字以上にしてください。';
            } elseif ($password !== $passwordConfirm) {
                $error = 'パスワードが一致しません。';
            } elseif (UserStore::findByEmail($email)) {
                $error = 'このメールアドレスは既に登録されています。';
            } else {
                $user = UserStore::create($name, $email, $password, 'Observer', '観察者');

                // ゲスト投稿データ引き継ぎ
                $guestData = Auth::migrateGuestData();

                $loginUser = $user;
                unset($loginUser['password_hash']);
                Auth::login($loginUser);

                // ゲスト観測データをユーザーに移行
                if (!empty($guestData['guest_id']) && !empty($guestData['post_ids'])) {
                    require_once __DIR__ . '/../libs/DataStore.php';
                    $allObs = DataStore::fetchAll('observations');
                    $changed = false;
                    foreach ($allObs as $i => $obs) {
                        if (($obs['user_id'] ?? '') === $guestData['guest_id']
                            && in_array($obs['id'] ?? '', $guestData['post_ids'])
                        ) {
                            $allObs[$i]['user_id'] = $user['id'];
                            $allObs[$i]['user_name'] = $user['name'];
                            $allObs[$i]['updated_at'] = date('Y-m-d H:i:s');
                            $changed = true;
                        }
                    }
                    if ($changed) {
                        DataStore::save('observations', $allObs);
                        require_once __DIR__ . '/../libs/Gamification.php';
                        Gamification::syncUserStats($user['id']);
                    }
                }

                header('Location: ' . $redirect);
                exit;
            }
        }
    }
}

$csrf = CSRF::generate();
$meta_title = 'ログイン';
?>
<!DOCTYPE html>
<html lang="ja">

<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style>
        .login-bg {
            background: linear-gradient(135deg, var(--color-primary-surface) 0%, var(--color-primary-surface) 30%, var(--color-secondary-surface) 70%, var(--color-bg-surface) 100%);
        }
    </style>
</head>

<body class="login-bg font-sans flex items-center justify-center min-h-screen relative" style="font-family: 'Noto Sans JP', sans-serif;">
    <!-- 装飾ブロブ -->
    <div class="fixed inset-0 pointer-events-none overflow-hidden">
        <div class="absolute -top-20 -left-20 w-[400px] h-[400px] rounded-full blur-[100px] opacity-30" style="background: var(--color-primary-glow);"></div>
        <div class="absolute -bottom-20 -right-20 w-[400px] h-[400px] rounded-full blur-[100px] opacity-30" style="background: rgba(14, 165, 233, 0.3);"></div>
    </div>

    <div class="w-full max-w-md mx-4 p-8 rounded-3xl relative z-10 transition-all duration-500" style="background: var(--glass-surface-heavy); backdrop-filter: blur(16px); border: 1px solid var(--color-border-strong); box-shadow: 0 8px 32px rgba(0,0,0,0.1);">
        <div class="text-center mb-10">
            <h1 class="text-3xl font-black mb-2 tracking-tight" style="font-family: 'Zen Kaku Gothic New', sans-serif; color: var(--color-text);">ikimon へ<span class="bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-emerald-400" style="font-family: 'Montserrat', sans-serif;">ようこそ</span></h1>
            <p class="text-sm" style="color: var(--color-text-muted);">自然とつながる、世界とつながる</p>
        </div>

        <?php if ($guestLimitMsg): ?>
            <div class="p-4 rounded-xl text-sm font-bold mb-6 text-center" style="background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); color: #92400e;">
                <?php echo htmlspecialchars($guestLimitMsg); ?>
            </div>
        <?php endif; ?>

        <?php if ($error): ?>
            <div class="p-4 rounded-xl text-sm font-bold mb-6 text-center" style="background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); color: #991b1b;">
                <?php echo htmlspecialchars($error); ?>
            </div>
        <?php endif; ?>

        <div class="flex p-1 rounded-full mb-6" style="background: var(--color-bg-surface); border: 1px solid var(--color-border-strong);">
            <a href="?tab=login<?php echo $redirect !== 'index.php' ? '&redirect=' . urlencode($redirect) : ''; ?>" class="flex-1 text-center py-2 text-sm font-bold rounded-full transition <?php echo $activeTab === 'login' ? '' : ''; ?>" style="<?php echo $activeTab === 'login' ? 'background: var(--color-bg-base); color: var(--color-text); box-shadow: var(--shadow-sm);' : 'color: var(--color-text-muted);'; ?>">ログイン</a>
            <a href="?tab=register<?php echo $redirect !== 'index.php' ? '&redirect=' . urlencode($redirect) : ''; ?>" class="flex-1 text-center py-2 text-sm font-bold rounded-full transition" style="<?php echo $activeTab === 'register' ? 'background: var(--color-bg-base); color: var(--color-text); box-shadow: var(--shadow-sm);' : 'color: var(--color-text-muted);'; ?>">新規登録</a>
        </div>

        <?php if ($activeTab === 'register'): ?>
            <form method="POST" class="space-y-4">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf); ?>">
                <input type="hidden" name="action" value="register">
                <input type="hidden" name="redirect" value="<?php echo htmlspecialchars($redirect); ?>">
                <div>
                    <label class="text-xs font-bold ml-2" style="color: var(--color-text-secondary);">名前</label>
                    <input type="text" name="name" class="w-full rounded-2xl px-4 py-3 font-bold" style="background: var(--color-bg-base); border: 1.5px solid var(--color-border-strong); color: var(--color-text);" placeholder="例: 山田 太郎" required autofocus>
                </div>
                <div>
                    <label class="text-xs font-bold ml-2" style="color: var(--color-text-secondary);">メールアドレス</label>
                    <input type="email" name="email" class="w-full rounded-2xl px-4 py-3 font-bold" style="background: var(--color-bg-base); border: 1.5px solid var(--color-border-strong); color: var(--color-text);" placeholder="you@example.com" required autofocus>
                </div>
                <div>
                    <label class="text-xs font-bold ml-2" style="color: var(--color-text-secondary);">パスワード</label>
                    <input type="password" name="password" class="w-full rounded-2xl px-4 py-3 font-bold" style="background: var(--color-bg-base); border: 1.5px solid var(--color-border-strong); color: var(--color-text);" placeholder="8文字以上" required>
                </div>
                <div>
                    <label class="text-xs font-bold ml-2" style="color: var(--color-text-secondary);">パスワード（確認）</label>
                    <input type="password" name="password_confirm" class="w-full rounded-2xl px-4 py-3 font-bold" style="background: var(--color-bg-base); border: 1.5px solid var(--color-border-strong); color: var(--color-text);" required>
                </div>
                <button type="submit" class="btn-primary w-full justify-center text-sm">アカウントを作成</button>
            </form>
        <?php else: ?>
            <form method="POST" class="space-y-4">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf); ?>">
                <input type="hidden" name="action" value="login">
                <input type="hidden" name="redirect" value="<?php echo htmlspecialchars($redirect); ?>">
                <div>
                    <label class="text-xs font-bold ml-2" style="color: var(--color-text-secondary);">メールアドレス</label>
                    <input type="email" name="email" class="w-full rounded-2xl px-4 py-3 font-bold" style="background: var(--color-bg-base); border: 1.5px solid var(--color-border-strong); color: var(--color-text);" placeholder="you@example.com" required>
                </div>
                <div>
                    <label class="text-xs font-bold ml-2" style="color: var(--color-text-secondary);">パスワード</label>
                    <input type="password" name="password" class="w-full rounded-2xl px-4 py-3 font-bold" style="background: var(--color-bg-base); border: 1.5px solid var(--color-border-strong); color: var(--color-text);" required>
                </div>
                <button type="submit" class="btn-primary w-full justify-center text-sm">ログイン</button>
            </form>
        <?php endif; ?>

        <?php if (isOAuthEnabled('google') || isOAuthEnabled('twitter')): ?>
            <div class="relative my-6">
                <div class="absolute inset-0 flex items-center">
                    <div class="w-full" style="border-top: 1px solid var(--color-border);"></div>
                </div>
                <div class="relative flex justify-center text-xs"><span class="px-3 font-bold" style="background: rgba(255,255,255,0.85); color: var(--color-text-faint);">または</span></div>
            </div>
            <div class="space-y-3">
                <?php if (isOAuthEnabled('google')): ?>
                    <a href="oauth_login.php?provider=google" class="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-2xl transition font-bold text-sm" style="background: var(--color-bg-base); border: 1.5px solid var(--color-border-strong); color: var(--color-text);">
                        <svg width="18" height="18" viewBox="0 0 48 48">
                            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        </svg>
                        Googleでログイン
                    </a>
                <?php endif; ?>
                <?php if (isOAuthEnabled('twitter')): ?>
                    <a href="oauth_login.php?provider=twitter" class="flex items-center justify-center gap-3 w-full py-3 px-4 rounded-2xl transition font-bold text-sm" style="background: var(--color-bg-base); border: 1.5px solid var(--color-border-strong); color: var(--color-text);">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        Xでログイン
                    </a>
                <?php endif; ?>
            </div>
        <?php endif; ?>

        <div class="mt-8 text-center">
            <a href="index.php" class="text-xs font-bold transition" style="color: var(--color-text-faint);">ゲストとして閲覧</a>
        </div>
    </div>
</body>

</html>
