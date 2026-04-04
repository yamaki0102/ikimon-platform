<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
require_once __DIR__ . '/../libs/CspNonce.php';
require_once __DIR__ . '/../libs/Asset.php';

Auth::init();
CspNonce::sendHeader();

$currentUser = Auth::user();
$meta_title = 'Androidアプリのご案内';
$meta_description = 'ikimon.life の Android アプリ版ダウンロードとインストール手順。既存写真の位置情報を使って記録したい人向けの案内ページです。';
$apkVersionName = '0.1.2';
$apkFileName = 'ikimon-shell-v' . $apkVersionName . '-debug.apk';
$apkPath = '/assets/apk/' . $apkFileName;
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <style nonce="<?= CspNonce::attr() ?>">
        .android-app-hero {
            background:
                radial-gradient(circle at top right, rgba(16, 185, 129, 0.18), transparent 35%),
                linear-gradient(145deg, #07140f 0%, #0d2018 55%, #123326 100%);
        }
        .android-app-card {
            box-shadow: 0 24px 80px rgba(15, 23, 42, 0.08);
        }
    </style>
</head>
<body class="font-body" style="background:var(--md-surface);color:var(--md-on-surface);">
    <?php include __DIR__ . '/components/nav.php'; ?>

    <main class="pt-24 pb-24 px-4 md:px-6">
        <section class="android-app-hero mx-auto max-w-5xl overflow-hidden rounded-[2rem] border border-white/10 px-6 py-10 text-white md:px-10 md:py-14">
            <div class="max-w-3xl">
                <p class="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-100">
                    <i data-lucide="smartphone" class="w-3.5 h-3.5"></i>
                    Android Beta
                </p>
                <h1 class="mt-4 text-3xl md:text-5xl font-black tracking-tight leading-tight">Androidアプリ版を試す</h1>
                <p class="mt-4 max-w-2xl text-sm md:text-base leading-relaxed text-white/80">
                    ブラウザ版では Android の仕様で既存写真の位置情報が消えることがあります。Androidアプリ版なら、写真選択と EXIF 読み取りだけをネイティブ化して、今の画面のまま使えます。
                </p>
                <p class="mt-3 text-xs font-bold uppercase tracking-[0.18em] text-emerald-100/80">
                    Current build v<?= htmlspecialchars($apkVersionName, ENT_QUOTES, 'UTF-8') ?>
                </p>
                <div class="mt-6 flex flex-wrap gap-3">
                    <a href="<?= htmlspecialchars($apkPath, ENT_QUOTES, 'UTF-8') ?>" download class="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-black text-white transition hover:bg-emerald-400">
                        <i data-lucide="download" class="w-4 h-4"></i>
                        APKをダウンロード
                    </a>
                    <a href="/post.php" class="inline-flex items-center gap-2 rounded-full border border-white/20 px-5 py-3 text-sm font-black text-white/90 transition hover:bg-white/10">
                        <i data-lucide="camera" class="w-4 h-4"></i>
                        ブラウザ版で続ける
                    </a>
                </div>
            </div>
        </section>

        <section class="mx-auto mt-8 grid max-w-5xl gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div class="android-app-card rounded-[2rem] border border-border bg-elevated p-6 md:p-8">
                <h2 class="text-xl font-black tracking-tight">インストール手順</h2>
                <ol class="mt-5 space-y-4 text-sm leading-relaxed text-muted">
                    <li class="flex gap-3">
                        <span class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700">1</span>
                        <div>
                            <p class="font-bold text-text">このページで APK をダウンロード</p>
                            <p class="mt-1">上の <strong>APKをダウンロード</strong> を押すと、最新版の `<?= htmlspecialchars($apkFileName, ENT_QUOTES, 'UTF-8') ?>` が端末に保存されます。</p>
                        </div>
                    </li>
                    <li class="flex gap-3">
                        <span class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700">2</span>
                        <div>
                            <p class="font-bold text-text">初回だけ「この提供元を許可」</p>
                            <p class="mt-1">Chrome や Files から APK を開くと、Android がインストール許可を求めます。表示に従って一度だけ許可してください。</p>
                        </div>
                    </li>
                    <li class="flex gap-3">
                        <span class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700">3</span>
                        <div>
                            <p class="font-bold text-text">アプリを開いて、いつものアカウントでログイン</p>
                            <p class="mt-1">見た目や投稿フローはほぼ今の ikimon.life のままです。</p>
                        </div>
                    </li>
                    <li class="flex gap-3">
                        <span class="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-black text-emerald-700">4</span>
                        <div>
                            <p class="font-bold text-text">写真を選ぶと、位置情報を優先して読み取る</p>
                            <p class="mt-1">既存写真の EXIF GPS が取れる場合は自動で地図に反映されます。取れない場合はブラウザ版と同じく現在地や手動指定にフォールバックします。</p>
                        </div>
                    </li>
                </ol>
            </div>

            <aside class="android-app-card rounded-[2rem] border border-border bg-elevated p-6 md:p-8">
                <h2 class="text-xl font-black tracking-tight">このアプリで変わること</h2>
                <div class="mt-5 space-y-4 text-sm">
                    <div class="rounded-2xl bg-emerald-50 px-4 py-4">
                        <p class="font-bold text-emerald-900">改善されること</p>
                        <p class="mt-1 text-emerald-900/80">既存写真の位置情報を使える可能性が上がる。写真選択で毎回 Chrome の制限に引っかからない。</p>
                    </div>
                    <div class="rounded-2xl bg-surface px-4 py-4">
                        <p class="font-bold text-text">変わらないこと</p>
                        <p class="mt-1 text-muted">投稿画面、図鑑、マップ、ログイン情報はほぼそのまま。いきなり別アプリに作り変わるわけではありません。</p>
                    </div>
                    <div class="rounded-2xl bg-amber-50 px-4 py-4">
                        <p class="font-bold text-amber-900">今の配布状態</p>
                        <p class="mt-1 text-amber-900/80">現在はベータ版 APK 配布です。まずは位置情報まわりの改善を優先して試してもらう段階です。</p>
                    </div>
                </div>

                <div class="mt-6 rounded-2xl border border-border bg-base px-4 py-4">
                    <p class="text-xs font-black uppercase tracking-[0.18em] text-faint">Signed In</p>
                    <p class="mt-2 text-sm font-bold text-text">
                        <?= $currentUser ? htmlspecialchars($currentUser['name'], ENT_QUOTES, 'UTF-8') . ' さんはそのまま試せます。' : 'ログイン後に使うと、今のアカウントでそのまま続けられます。'; ?>
                    </p>
                </div>
            </aside>
        </section>
    </main>
</body>
</html>
