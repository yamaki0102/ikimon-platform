<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/UserStore.php';
require_once __DIR__ . '/../libs/CSRF.php';

Auth::init();

$error = null;
$activeTab = $_POST['action'] ?? ($_GET['tab'] ?? 'login');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!CSRF::validate($_POST['csrf_token'] ?? '')) {
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
                    $loginUser = $user;
                    unset($loginUser['password_hash']);
                    $loginUser['rank'] = $loginUser['rank'] ?? Auth::getRankLabel($loginUser);
                    Auth::login($loginUser);
                    UserStore::update($user['id'], ['last_login_at' => date('Y-m-d H:i:s')]);
                    header('Location: index.php');
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
                $loginUser = $user;
                unset($loginUser['password_hash']);
                Auth::login($loginUser);
                header('Location: index.php');
                exit;
            }
        }
    }
}

$csrf = CSRF::generate();
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ログイン - ikimon</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        primary: 'var(--color-primary)',
                        secondary: 'var(--color-secondary)',
                        base: 'var(--color-bg-base)',
                        surface: 'var(--color-bg-surface)',
                    }
                }
            }
        }
    </script>
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;900&family=Noto+Sans+JP:wght@400;500;700;900&family=Zen+Kaku+Gothic+New:wght@400;500;700;900&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
</head>
<body class="bg-[var(--color-bg-base)] text-[var(--color-text)] font-sans flex items-center justify-center min-h-screen relative overflow-hidden" style="font-family: 'Noto Sans JP', sans-serif;">
    <div class="fixed inset-0 pointer-events-none">
        <div class="absolute top-0 left-0 w-[520px] h-[520px] bg-green-500/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow"></div>
        <div class="absolute bottom-0 right-0 w-[520px] h-[520px] bg-blue-500/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" style="animation-delay: 2s"></div>
    </div>

    <div class="w-full max-w-md p-8 glass-card rounded-3xl relative z-10 transition-all duration-500 hover:shadow-[0_0_50px_rgba(16,185,129,0.1)]">
        <div class="text-center mb-10">
            <h1 class="text-3xl font-black mb-2 tracking-tight" style="font-family: 'Zen Kaku Gothic New', sans-serif;">Welcome to <span class="bg-clip-text text-transparent bg-gradient-to-r from-[var(--color-primary)] to-emerald-600" style="font-family: 'Montserrat', sans-serif;">ikimon</span></h1>
            <p class="text-gray-400 text-sm">自然とつながる、世界とつながる</p>
        </div>

        <?php if ($error): ?>
        <div class="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm font-bold mb-6 text-center">
            <?php echo htmlspecialchars($error); ?>
        </div>
        <?php endif; ?>

        <div class="flex bg-white/5 p-1 rounded-full mb-6">
            <a href="?tab=login" class="flex-1 text-center py-2 text-sm font-bold rounded-full transition <?php echo $activeTab === 'login' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'; ?>">ログイン</a>
            <a href="?tab=register" class="flex-1 text-center py-2 text-sm font-bold rounded-full transition <?php echo $activeTab === 'register' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'; ?>">新規登録</a>
        </div>

        <?php if ($activeTab === 'register'): ?>
        <form method="POST" class="space-y-4">
            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf); ?>">
            <input type="hidden" name="action" value="register">
            <div>
                <label class="text-xs font-bold text-gray-400 ml-2">名前</label>
                <input type="text" name="name" class="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-500 transition text-white font-bold" placeholder="例: 山田 太郎" required>
            </div>
            <div>
                <label class="text-xs font-bold text-gray-400 ml-2">メールアドレス</label>
                <input type="email" name="email" class="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-500 transition text-white font-bold" placeholder="you@example.com" required>
            </div>
            <div>
                <label class="text-xs font-bold text-gray-400 ml-2">パスワード</label>
                <input type="password" name="password" class="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-500 transition text-white font-bold" placeholder="8文字以上" required>
            </div>
            <div>
                <label class="text-xs font-bold text-gray-400 ml-2">パスワード（確認）</label>
                <input type="password" name="password_confirm" class="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-500 transition text-white font-bold" required>
            </div>
            <button type="submit" class="btn-primary w-full justify-center text-sm">アカウントを作成</button>
        </form>
        <?php else: ?>
        <form method="POST" class="space-y-4">
            <input type="hidden" name="csrf_token" value="<?php echo htmlspecialchars($csrf); ?>">
            <input type="hidden" name="action" value="login">
            <div>
                <label class="text-xs font-bold text-gray-400 ml-2">メールアドレス</label>
                <input type="email" name="email" class="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-500 transition text-white font-bold" placeholder="you@example.com" required>
            </div>
            <div>
                <label class="text-xs font-bold text-gray-400 ml-2">パスワード</label>
                <input type="password" name="password" class="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 focus:outline-none focus:border-green-500 transition text-white font-bold" required>
            </div>
            <button type="submit" class="btn-primary w-full justify-center text-sm">ログイン</button>
        </form>
        <?php endif; ?>

        <div class="mt-8 text-center">
            <a href="index.php" class="text-xs font-bold text-gray-500 hover:text-white transition">ゲストとして閲覧</a>
        </div>
    </div>
</body>
</html>
