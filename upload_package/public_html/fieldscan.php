<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../libs/Auth.php';
Auth::init();

$meta_title = 'FieldScan — AI生物スキャナー | ikimon.life';
$meta_description = '3つのAIエンジンが視覚・聴覚・環境を同時スキャン。歩くだけで生態系のタイムカプセルを生成する、100年アーカイブのためのAndroidアプリ。';
$meta_canonical = rtrim(BASE_URL, '/') . '/fieldscan';

$apkVersion = '0.5.1';
$apkSize = '15MB';
$apkFile = 'assets/downloads/ikimon-fieldscan.apk';
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
        <div class="text-6xl">🌿</div>
        <h1 class="text-3xl font-black tracking-tight">
            フィールドスキャン
            <span class="text-xs font-normal text-gray-500 ml-2">v<?= htmlspecialchars($apkVersion) ?></span>
        </h1>
        <p class="text-gray-400 text-sm leading-relaxed max-w-md mx-auto">
            歩くだけで、その場の生きものと環境を<br>
            まるごと記録するAndroidアプリ。
        </p>
    </section>

    <!-- What it records -->
    <section class="grid gap-3 mb-10">
        <h2 class="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">1回の散歩で記録されるもの</h2>

        <div class="bg-white/5 rounded-2xl p-5 flex items-start gap-4">
            <span class="text-2xl mt-1">🎧</span>
            <div>
                <div class="font-bold text-sm">音の記録</div>
                <div class="text-xs text-gray-400 mt-1 leading-relaxed">
                    鳥の声・虫の声・環境音。音響指数（ACI/NDSI）で「豊かさ」も数値化。オフラインで動作。
                </div>
            </div>
        </div>

        <div class="bg-white/5 rounded-2xl p-5 flex items-start gap-4">
            <span class="text-2xl mt-1">📷</span>
            <div>
                <div class="font-bold text-sm">場所の記録</div>
                <div class="text-xs text-gray-400 mt-1 leading-relaxed">
                    カメラが植生・水辺・開放度を自動分析。歩いた軌跡と重ね合わせてその場所の生態を記録する。
                </div>
            </div>
        </div>

        <div class="bg-white/5 rounded-2xl p-5 flex items-start gap-4">
            <span class="text-2xl mt-1">🌡️</span>
            <div>
                <div class="font-bold text-sm">環境の記録</div>
                <div class="text-xs text-gray-400 mt-1 leading-relaxed">
                    気圧・照度・標高を60秒ごとに自動スナップショット。種の記録だけでは残せない「その日の環境」を保存する。
                </div>
            </div>
        </div>
    </section>

    <!-- How it works -->
    <section class="mb-10">
        <h2 class="text-xs font-bold text-gray-500 uppercase tracking-wider px-1 mb-3">使い方</h2>
        <div class="bg-white/5 rounded-2xl p-5 space-y-4">
            <div class="flex items-center gap-3">
                <div class="bg-emerald-600 text-white text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0">1</div>
                <div class="text-xs text-gray-300"><strong class="text-white">散歩を始める</strong> — タップ1つで全センサーが起動</div>
            </div>
            <div class="flex items-center gap-3">
                <div class="bg-emerald-600 text-white text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0">2</div>
                <div class="text-xs text-gray-300"><strong class="text-white">歩くだけ</strong> — あとは自動。ポケットに入れたままでOK</div>
            </div>
            <div class="flex items-center gap-3">
                <div class="bg-emerald-600 text-white text-xs font-bold w-8 h-8 rounded-full flex items-center justify-center shrink-0">3</div>
                <div class="text-xs text-gray-300"><strong class="text-white">記録を終了する</strong> — 散歩のサマリーと記録データが ikimon.life に同期</div>
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
           download="ikimon-fieldscan-v<?= htmlspecialchars($apkVersion) ?>.apk"
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
                    初回起動時に<strong class="text-white">カメラ・マイク・位置情報</strong>を許可。Gemini Nano モデルが自動ダウンロード（WiFi推奨、約3GB）
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
                <div class="text-gray-500">推奨</div>
                <div class="text-gray-200 font-bold">Pixel 10 Pro</div>
            </div>
        </div>
        <div class="mt-3 text-[10px] text-gray-500">
            Tensor G5 搭載端末で最適化。Gemini Nano オンデバイスには Google Play Services が必要です。
        </div>
    </section>

    <!-- v0.5.1 Changelog -->
    <section class="bg-white/5 rounded-2xl p-5 mb-10">
        <h3 class="text-sm font-bold text-gray-300 mb-3">v0.5.1 の変更点</h3>
        <div class="text-xs text-gray-400 space-y-1.5">
            <div class="flex gap-2"><span class="text-red-400 shrink-0">!</span> ハルシネーション撲滅（存在しない生物の誤検出を排除）</div>
            <div class="flex gap-2"><span class="text-emerald-400 shrink-0">+</span> DetectionTier 導入（候補 / 概要 / 抑制の3段階分類）</div>
            <div class="flex gap-2"><span class="text-emerald-400 shrink-0">+</span> GPS速度ベースの自動適応スキャン（モード手動選択不要）</div>
            <div class="flex gap-2"><span class="text-emerald-400 shrink-0">+</span> 高確信度検出時に証拠写真を自動保存（WebP原寸）</div>
            <div class="flex gap-2"><span class="text-emerald-400 shrink-0">+</span> 音声ガイド分離（概要「〜の気配」/ 候補「発見、確信度高」）</div>
            <div class="flex gap-2"><span class="text-blue-400 shrink-0">~</span> Gemini Nano プロンプト強化（種レベル禁止・視認必須）</div>
            <div class="flex gap-2"><span class="text-blue-400 shrink-0">~</span> 音声検出しきい値引き上げ（0.10→0.35/0.50）</div>
            <div class="flex gap-2"><span class="text-blue-400 shrink-0">~</span> 信頼度に応じた分類階級の強制（LOW→綱、MEDIUM→目/科、HIGH→科）</div>
            <div class="flex gap-2"><span class="text-gray-500 shrink-0">-</span> ObservationMode（通勤/散歩/定点）廃止 → 全自動に</div>
        </div>
    </section>

    <!-- v0.2.0 Changelog -->
    <section class="bg-white/5 rounded-2xl p-5 mb-10">
        <h3 class="text-sm font-bold text-gray-300 mb-3">v0.2.0</h3>
        <div class="text-xs text-gray-400 space-y-1.5">
            <div class="flex gap-2"><span class="text-emerald-400 shrink-0">+</span> BirdNET V3 + Perch v2 デュアル音声エンジン</div>
            <div class="flex gap-2"><span class="text-emerald-400 shrink-0">+</span> 環境センサー統合（気圧・照度・コンパス・加速度）</div>
            <div class="flex gap-2"><span class="text-emerald-400 shrink-0">+</span> 加速度計ベースの適応型スキャン間隔</div>
            <div class="flex gap-2"><span class="text-emerald-400 shrink-0">+</span> ikimon.life 自動同期（passive_event API）</div>
            <div class="flex gap-2"><span class="text-emerald-400 shrink-0">+</span> 新種発見の触覚フィードバック</div>
            <div class="flex gap-2"><span class="text-emerald-400 shrink-0">+</span> Gemini Nano 環境分析（植生・水辺・都市度）</div>
            <div class="flex gap-2"><span class="text-blue-400 shrink-0">~</span> Detection データモデル拡張（taxonRank, engines, consensus）</div>
        </div>
    </section>

    <!-- Caution -->
    <section class="bg-amber-900/20 border border-amber-600/30 rounded-2xl p-5 mb-10">
        <div class="flex items-start gap-3">
            <span class="text-lg">⚠️</span>
            <div class="text-xs text-gray-300 space-y-1">
                <p><strong class="text-amber-300">AIによる推定について</strong></p>
                <p>検出結果はAIによる推定です。正確な同定が必要な場合は、ikimon.life のコミュニティによる確認をご利用ください。</p>
            </div>
        </div>
    </section>

    <!-- Privacy -->
    <section class="bg-white/5 rounded-2xl p-5 mb-10">
        <h3 class="text-sm font-bold text-gray-300 mb-3">プライバシー</h3>
        <div class="text-xs text-gray-400 space-y-2">
            <p>🔒 <strong class="text-gray-200">画像はサーバーに送信されません。</strong>視覚AIの処理は全てオンデバイスで完結します。</p>
            <p>🎤 音声AIはサーバー側で BirdNET V3 + Perch v2 を実行します。音声データは判定後に自動削除され、検出時のみ証拠として保持されます。</p>
            <p>📍 位置情報はローカルに保存され、スキャン終了後にユーザーの操作で ikimon.life に同期されます。</p>
            <p>🌡 環境センサーデータ（気圧・照度等）は生物多様性記録の一部として保存されます。個人を特定する情報は含まれません。</p>
        </div>
    </section>

    <!-- Credits -->
    <section class="text-center text-[10px] text-gray-600 space-y-1">
        <p>BirdNET+ V3.0 — Cornell Lab of Ornithology (CC BY-SA 4.0)</p>
        <p>Perch v2 — Google DeepMind (Apache 2.0)</p>
        <p>Gemini Nano — Google AI Edge (on-device)</p>
    </section>

</main>

<?php include __DIR__ . '/components/nav.php'; ?>

</body>
</html>
