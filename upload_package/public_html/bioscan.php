<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();

$meta_title = 'BioScan — AI生物スキャナー | ikimon.life';
$meta_description = 'スマホのカメラを向けるだけ。Gemini Nano AIがオンデバイスで生物をリアルタイム同定。ネット不要、完全無料。';
$meta_canonical = rtrim(BASE_URL, '/') . '/bioscan';

$apkVersion = '0.1.0';
$apkSize = '14MB';
$apkFile = 'assets/downloads/ikimon-bioscan.apk';
?>
<!DOCTYPE html>
<html lang="ja">
<head>
    <?php include __DIR__ . '/components/meta.php'; ?>
    <link rel="stylesheet" href="assets/css/tokens.css?v=2026_naturalism">
    <link rel="stylesheet" href="assets/css/input.css?v=2026_naturalism">
</head>
<body class="bg-[#050505] text-white min-h-screen">

<?php include __DIR__ . '/components/nav.php'; ?>

<main class="max-w-2xl mx-auto px-4 py-8" style="padding-top: calc(var(--nav-height, 56px) + 2rem); padding-bottom: calc(var(--bottom-nav-height, 72px) + 2rem)">

    <!-- Hero -->
    <section class="text-center space-y-4 mb-12">
        <div class="text-6xl">🔬</div>
        <h1 class="text-3xl font-black tracking-tight">
            Bio<span class="text-emerald-400">Scan</span>
        </h1>
        <p class="text-gray-400 text-sm leading-relaxed max-w-md mx-auto">
            カメラを向けるだけで、AIが生物をリアルタイム同定。<br>
            Gemini Nano がオンデバイスで動くから、<br>
            <strong class="text-white">ネットがなくても、山奥でも使える。</strong>
        </p>
    </section>

    <!-- Feature Cards -->
    <section class="grid gap-3 mb-10">
        <div class="bg-white/5 rounded-2xl p-5 flex items-start gap-4">
            <span class="text-2xl mt-1">👁</span>
            <div>
                <div class="font-bold text-sm">カメラ — 視覚AI</div>
                <div class="text-xs text-gray-400 mt-1">
                    Gemini Nano がオンデバイスで画像を分析。2秒間隔の連続スキャンで、歩きながら自動検出。
                </div>
            </div>
        </div>

        <div class="bg-white/5 rounded-2xl p-5 flex items-start gap-4">
            <span class="text-2xl mt-1">👂</span>
            <div>
                <div class="font-bold text-sm">マイク — 聴覚AI</div>
                <div class="text-xs text-gray-400 mt-1">
                    BirdNET AI（6,522種対応）が周囲の鳥の声をリアルタイム判定。3秒チャンクで常時モニタリング。
                </div>
            </div>
        </div>

        <div class="bg-white/5 rounded-2xl p-5 flex items-start gap-4">
            <span class="text-2xl mt-1">📍</span>
            <div>
                <div class="font-bold text-sm">GPS — 空間マッピング</div>
                <div class="text-xs text-gray-400 mt-1">
                    全ての検出に位置情報を自動付与。歩いた軌跡と発見が、生態系のデジタルツインを構築する。
                </div>
            </div>
        </div>

        <div class="bg-white/5 rounded-2xl p-5 flex items-start gap-4">
            <span class="text-2xl mt-1">✈️</span>
            <div>
                <div class="font-bold text-sm">オフライン動作</div>
                <div class="text-xs text-gray-400 mt-1">
                    視覚AIはGemini Nanoがオンデバイスで処理。ネット接続不要。山奥や離島でも使える。
                    <span class="text-gray-500">（音声AIはネット接続時のみ）</span>
                </div>
            </div>
        </div>
    </section>

    <!-- Download Section -->
    <section class="bg-gradient-to-br from-emerald-900/30 to-emerald-800/10 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-4 mb-10">
        <h2 class="text-lg font-black">Android アプリをダウンロード</h2>

        <div class="flex items-center justify-center gap-3 text-xs text-gray-400">
            <span>v<?= htmlspecialchars($apkVersion) ?></span>
            <span>·</span>
            <span><?= htmlspecialchars($apkSize) ?></span>
            <span>·</span>
            <span>Android 14+</span>
        </div>

        <a href="<?= htmlspecialchars($apkFile) ?>"
           download="ikimon-bioscan-v<?= htmlspecialchars($apkVersion) ?>.apk"
           class="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-bold py-4 px-8 rounded-xl text-base transition">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            APK をダウンロード
        </a>

        <p class="text-[10px] text-gray-500 leading-relaxed">
            Google Play 外からのインストールです。<br>
            ダウンロード後、「提供元不明のアプリのインストール」を許可してください。
        </p>
    </section>

    <!-- Install Steps -->
    <section class="space-y-3 mb-10">
        <h3 class="text-sm font-bold text-gray-300 px-1">インストール手順</h3>
        <div class="space-y-2">
            <div class="bg-white/5 rounded-xl p-4 flex items-start gap-3">
                <span class="bg-emerald-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">1</span>
                <div class="text-xs text-gray-300">
                    上のボタンから <strong class="text-white">APK をダウンロード</strong>
                </div>
            </div>
            <div class="bg-white/5 rounded-xl p-4 flex items-start gap-3">
                <span class="bg-emerald-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">2</span>
                <div class="text-xs text-gray-300">
                    ダウンロード完了の通知をタップ、または <strong class="text-white">ファイルアプリ → ダウンロード</strong> から開く
                </div>
            </div>
            <div class="bg-white/5 rounded-xl p-4 flex items-start gap-3">
                <span class="bg-emerald-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">3</span>
                <div class="text-xs text-gray-300">
                    「提供元不明のアプリ」を許可 → <strong class="text-white">インストール</strong>
                </div>
            </div>
            <div class="bg-white/5 rounded-xl p-4 flex items-start gap-3">
                <span class="bg-emerald-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5">4</span>
                <div class="text-xs text-gray-300">
                    初回起動時に<strong class="text-white">カメラ・マイク・位置情報</strong>を許可。Gemini Nano モデルが自動ダウンロードされます（WiFi推奨、約3GB）
                </div>
            </div>
        </div>
    </section>

    <!-- Requirements -->
    <section class="bg-white/5 rounded-2xl p-5 mb-10">
        <h3 class="text-sm font-bold text-gray-300 mb-3">動作要件</h3>
        <div class="grid grid-cols-2 gap-3 text-xs">
            <div>
                <div class="text-gray-500">OS</div>
                <div class="text-gray-200 font-bold">Android 14 以上</div>
            </div>
            <div>
                <div class="text-gray-500">RAM</div>
                <div class="text-gray-200 font-bold">6GB 以上</div>
            </div>
            <div>
                <div class="text-gray-500">ストレージ</div>
                <div class="text-gray-200 font-bold">約4GB（モデル含む）</div>
            </div>
            <div>
                <div class="text-gray-500">必須</div>
                <div class="text-gray-200 font-bold">Google Play Services</div>
            </div>
        </div>
    </section>

    <!-- Caution -->
    <section class="bg-amber-900/20 border border-amber-600/30 rounded-2xl p-5 mb-10">
        <div class="flex items-start gap-3">
            <span class="text-lg">⚠️</span>
            <div class="text-xs text-gray-300 space-y-1">
                <p><strong class="text-amber-300">AI推定について</strong></p>
                <p>BioScan の同定結果は Gemini Nano による推定であり、正確性は保証されません。確信度に応じて分類階級（綱・目・科）で表示し、無理に細かく同定しない設計にしています。</p>
                <p>正確な同定が必要な場合は、ikimon.life 上で専門家やコミュニティによる確認を経てください。</p>
            </div>
        </div>
    </section>

    <!-- Privacy -->
    <section class="bg-white/5 rounded-2xl p-5">
        <h3 class="text-sm font-bold text-gray-300 mb-3">プライバシー</h3>
        <div class="text-xs text-gray-400 space-y-2">
            <p>🔒 <strong class="text-gray-200">画像はサーバーに送信されません。</strong>視覚AIの処理は全てオンデバイスで完結します。</p>
            <p>🎤 音声AIは BirdNET API への送信が必要ですが、録音データは判定後に自動削除されます（検出時のみ証拠として保持）。</p>
            <p>📍 位置情報はローカルに保存され、ユーザーが明示的に ikimon.life に送信するまで外部に共有されません。</p>
        </div>
    </section>

</main>

<?php include __DIR__ . '/components/bottom_nav.php'; ?>

</body>
</html>
