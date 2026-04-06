<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/AccessGate.php';
require_once __DIR__ . '/../libs/InviteManager.php';
require_once __DIR__ . '/../libs/UserStore.php';
require_once __DIR__ . '/../libs/CSRF.php';
require_once __DIR__ . '/../libs/RateLimiter.php';
require_once __DIR__ . '/../config/oauth_config.php';

Auth::init();

$error = null;
$activeTab = $_POST['action'] ?? ($_GET['tab'] ?? 'login');
$redirect = $_POST['redirect'] ?? ($_GET['redirect'] ?? 'index.php');
$inviteOnlyEnabled = AccessGate::isInviteOnlyEnabled();
$rememberedInviteCode = AccessGate::getRememberedInviteCode();
$inviteValidation = ['valid' => false, 'code' => $rememberedInviteCode, 'inviter' => null, 'error' => null];
if ($rememberedInviteCode !== '') {
    $inviteValidation = AccessGate::validateInviteCode($rememberedInviteCode);
}
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
        'invite_required' => AccessGate::getInviteOnlyMessage(),
        'oauth' => $_GET['msg'] ?? 'ソーシャルログインに失敗しました。',
    ];
    $error = $oauthErrors[$_GET['error']] ?? 'エラーが発生しました。';
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (isset($_POST['invite_code'])) {
        $inviteValidation = AccessGate::validateInviteCode((string)$_POST['invite_code']);
        $rememberedInviteCode = $inviteValidation['code'];
    }

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
            } elseif ($inviteOnlyEnabled && !$inviteValidation['valid']) {
                $error = $inviteValidation['error'] ?: AccessGate::getInviteOnlyMessage();
            } else {
                $user = UserStore::create($name, $email, $password, 'Observer', '観察者');
                if ($inviteOnlyEnabled && $inviteValidation['valid']) {
                    InviteManager::recordAcceptance($inviteValidation['code'], (string)$user['id'], (string)($user['name'] ?? ''));
                }

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
        body {
            background: var(--md-surface);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: var(--font-body);
        }
        .login-blob {
            position: fixed; inset: 0; pointer-events: none; overflow: hidden;
        }
        .login-blob::before {
            content: ''; position: absolute;
            top: -120px; left: -120px;
            width: 420px; height: 420px;
            border-radius: 50%;
            background: var(--md-primary-container);
            opacity: 0.45;
            filter: blur(80px);
        }
        .login-blob::after {
            content: ''; position: absolute;
            bottom: -120px; right: -120px;
            width: 360px; height: 360px;
            border-radius: 50%;
            background: var(--md-secondary-container);
            opacity: 0.4;
            filter: blur(80px);
        }
        .login-card {
            background: var(--md-surface-container-low);
            border-radius: var(--shape-xl);
            box-shadow: var(--elev-2);
            width: 100%; max-width: 420px;
            margin: 0 1rem;
            padding: 2.5rem 2rem;
            position: relative; z-index: 10;
        }
        /* Tab switcher */
        .tab-bar {
            display: flex;
            background: var(--md-surface-container);
            border-radius: var(--shape-full);
            padding: 4px;
            margin-bottom: 1.5rem;
            gap: 4px;
        }
        .tab-item {
            flex: 1; text-align: center;
            padding: 8px 0;
            font-size: var(--type-label-lg);
            font-weight: 600;
            border-radius: var(--shape-full);
            text-decoration: none;
            transition: background var(--motion-short) var(--motion-std),
                        color var(--motion-short) var(--motion-std),
                        box-shadow var(--motion-short) var(--motion-std);
            color: var(--md-on-surface-variant);
        }
        .tab-item.active {
            background: var(--md-surface-container-low);
            color: var(--md-on-surface);
            box-shadow: var(--elev-1);
        }
        /* M3 Filled TextField */
        .m3-field {
            margin-bottom: 1rem;
        }
        .m3-field label {
            display: block;
            font-size: var(--type-label-md);
            font-weight: 600;
            color: var(--md-on-surface-variant);
            margin-bottom: 6px;
            padding-left: 4px;
        }
        .m3-field input {
            width: 100%;
            background: var(--md-surface-variant);
            border: none;
            border-bottom: 2px solid var(--md-outline);
            border-radius: var(--shape-xs) var(--shape-xs) 0 0;
            padding: 14px 16px;
            font-size: var(--type-body-lg);
            color: var(--md-on-surface);
            outline: none;
            box-sizing: border-box;
            transition: border-color var(--motion-short) var(--motion-std),
                        background var(--motion-short) var(--motion-std);
        }
        .m3-field input:focus {
            border-bottom-color: var(--md-primary);
            background: var(--md-surface-container);
        }
        .m3-field input::placeholder {
            color: var(--md-on-surface-variant);
            opacity: 0.6;
        }
        /* M3 Filled Button */
        .m3-btn-primary {
            position: relative; overflow: hidden;
            display: flex; align-items: center; justify-content: center;
            width: 100%;
            background: var(--md-primary);
            color: var(--md-on-primary);
            border: none;
            border-radius: var(--shape-full);
            padding: 14px 24px;
            font-size: var(--type-label-lg);
            font-weight: 700;
            cursor: pointer;
            margin-top: 1.5rem;
            transition: box-shadow var(--motion-short) var(--motion-std);
        }
        .m3-btn-primary::before {
            content: ''; position: absolute; inset: 0;
            background: currentColor; opacity: 0;
            border-radius: inherit;
            transition: opacity var(--motion-short) var(--motion-std);
            pointer-events: none;
        }
        .m3-btn-primary:hover { box-shadow: var(--elev-1); }
        .m3-btn-primary:hover::before { opacity: 0.08; }
        .m3-btn-primary:active::before { opacity: 0.12; }
        /* M3 Outlined Button (OAuth) */
        .m3-btn-outlined {
            position: relative; overflow: hidden;
            display: flex; align-items: center; justify-content: center; gap: 12px;
            width: 100%;
            background: transparent;
            color: var(--md-on-surface);
            border: 1px solid var(--md-outline);
            border-radius: var(--shape-full);
            padding: 12px 24px;
            font-size: var(--type-label-lg);
            font-weight: 600;
            text-decoration: none;
            transition: background var(--motion-short) var(--motion-std),
                        box-shadow var(--motion-short) var(--motion-std);
            margin-bottom: 8px;
        }
        .m3-btn-outlined::before {
            content: ''; position: absolute; inset: 0;
            background: currentColor; opacity: 0;
            border-radius: inherit;
            transition: opacity var(--motion-short) var(--motion-std);
            pointer-events: none;
        }
        .m3-btn-outlined:hover::before { opacity: 0.08; }
        .m3-btn-outlined:active::before { opacity: 0.12; }
        /* Divider */
        .m3-divider {
            display: flex; align-items: center; gap: 12px;
            margin: 1.5rem 0;
        }
        .m3-divider::before, .m3-divider::after {
            content: ''; flex: 1;
            height: 1px; background: var(--md-outline-variant);
        }
        .m3-divider span {
            font-size: var(--type-label-sm);
            color: var(--md-on-surface-variant);
            white-space: nowrap;
        }
        /* Alert banners */
        .m3-banner-warn {
            background: var(--md-tertiary-container);
            color: var(--md-on-tertiary-container);
            border-radius: var(--shape-md);
            padding: 12px 16px;
            font-size: var(--type-body-sm);
            font-weight: 600;
            margin-bottom: 1.25rem;
            text-align: center;
        }
        .m3-banner-error {
            background: var(--md-error-container);
            color: var(--md-on-error-container);
            border-radius: var(--shape-md);
            padding: 12px 16px;
            font-size: var(--type-body-sm);
            font-weight: 600;
            margin-bottom: 1.25rem;
            text-align: center;
        }
        .m3-banner-info {
            background: var(--md-primary-container);
            color: var(--md-on-primary-container);
            border-radius: var(--shape-md);
            padding: 12px 16px;
            font-size: var(--type-body-sm);
            font-weight: 600;
            margin-bottom: 1.25rem;
            text-align: left;
            line-height: 1.6;
        }
    </style>
</head>

<body>
    <div class="login-blob"></div>

    <div class="login-card">
        <div style="text-align:center; margin-bottom:2rem;">
            <div style="font-size:var(--type-headline-sm); font-weight:900; color:var(--md-on-surface); font-family:var(--font-heading); letter-spacing:-0.01em; margin-bottom:4px;">
                ikimon へ<span style="color:var(--md-primary);">ようこそ</span>
            </div>
            <div style="font-size:var(--type-body-sm); color:var(--md-on-surface-variant);">自然とつながる、世界とつながる</div>
        </div>

        <?php if ($guestLimitMsg): ?>
            <div class="m3-banner-warn"><?php echo htmlspecialchars($guestLimitMsg); ?></div>
        <?php endif; ?>

        <?php if ($error): ?>
            <div class="m3-banner-error"><?php echo htmlspecialchars($error); ?></div>
        <?php endif; ?>

        <?php if ($inviteOnlyEnabled): ?>
            <div class="m3-banner-info">
                <?php echo htmlspecialchars(AccessGate::getInviteOnlyMessage()); ?>
                <?php if ($inviteValidation['valid'] && !empty($inviteValidation['inviter']['user_name'])): ?>
                    <br>招待者: <?php echo htmlspecialchars((string)$inviteValidation['inviter']['user_name']); ?> さん
                <?php endif; ?>
            </div>
        <?php endif; ?>

        <div class="tab-bar">
            <a href="?tab=login<?php echo $redirect !== 'index.php' ? '&redirect=' . urlencode($redirect) : ''; ?>" class="tab-item <?php echo $activeTab === 'login' ? 'active' : ''; ?>">ログイン</a>
            <a href="?tab=register<?php echo $redirect !== 'index.php' ? '&redirect=' . urlencode($redirect) : ''; ?>" class="tab-item <?php echo $activeTab === 'register' ? 'active' : ''; ?>">新規登録</a>
        </div>

        <?php if ($activeTab === 'register'): ?>
            <form method="POST">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf); ?>">
                <input type="hidden" name="action" value="register">
                <input type="hidden" name="redirect" value="<?php echo htmlspecialchars($redirect); ?>">
                <?php if ($inviteOnlyEnabled): ?>
                    <div class="m3-field">
                        <label>招待コード</label>
                        <input type="text" name="invite_code" value="<?php echo htmlspecialchars($rememberedInviteCode); ?>" placeholder="例: ABCD2345" required>
                    </div>
                <?php endif; ?>
                <div class="m3-field">
                    <label>名前</label>
                    <input type="text" name="name" placeholder="例: 山田 太郎" required autofocus>
                </div>
                <div class="m3-field">
                    <label>メールアドレス</label>
                    <input type="email" name="email" placeholder="you@example.com" required>
                </div>
                <div class="m3-field">
                    <label>パスワード</label>
                    <input type="password" name="password" placeholder="8文字以上" required>
                </div>
                <div class="m3-field">
                    <label>パスワード（確認）</label>
                    <input type="password" name="password_confirm" required>
                </div>
                <button type="submit" class="m3-btn-primary">アカウントを作成</button>
            </form>
        <?php else: ?>
            <form method="POST">
                <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf); ?>">
                <input type="hidden" name="action" value="login">
                <input type="hidden" name="redirect" value="<?php echo htmlspecialchars($redirect); ?>">
                <div class="m3-field">
                    <label>メールアドレス</label>
                    <input type="email" name="email" placeholder="you@example.com" required>
                </div>
                <div class="m3-field">
                    <label>パスワード</label>
                    <input type="password" name="password" required>
                </div>
                <button type="submit" class="m3-btn-primary">ログイン</button>
            </form>
        <?php endif; ?>

        <?php if (isOAuthEnabled('google') || isOAuthEnabled('twitter')): ?>
            <div class="m3-divider"><span>または</span></div>
            <?php if (isOAuthEnabled('google')): ?>
                <a href="oauth_login.php?provider=google<?php echo $rememberedInviteCode !== '' ? '&invite_code=' . urlencode($rememberedInviteCode) : ''; ?>" class="m3-btn-outlined">
                    <svg width="18" height="18" viewBox="0 0 48 48" style="pointer-events:none; flex-shrink:0;">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    Googleでログイン
                </a>
            <?php endif; ?>
            <?php if (isOAuthEnabled('twitter')): ?>
                <a href="oauth_login.php?provider=twitter<?php echo $rememberedInviteCode !== '' ? '&invite_code=' . urlencode($rememberedInviteCode) : ''; ?>" class="m3-btn-outlined">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" style="pointer-events:none; flex-shrink:0;">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                    </svg>
                    Xでログイン
                </a>
            <?php endif; ?>
        <?php endif; ?>

        <div style="text-align:center; margin-top:1.5rem;">
            <a href="index.php" style="font-size:var(--type-label-md); color:var(--md-on-surface-variant); text-decoration:none;">ゲストとして閲覧</a>
        </div>
    </div>
</body>

</html>
